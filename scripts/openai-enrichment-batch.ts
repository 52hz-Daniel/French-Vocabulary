import "./load-env";
import { createReadStream } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { Pool } from "pg";

const command=process.argv[2];
const batchId=process.argv[3];
const connectionString=process.env.DATABASE_INGEST_URL??process.env.DATABASE_ADMIN_URL;
if(!connectionString)throw new Error("DATABASE_INGEST_URL or DATABASE_ADMIN_URL is required");
if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY is required");
const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const pool=new Pool({connectionString,max:1});

const schema={type:"object",additionalProperties:false,properties:{field:{type:"string",enum:["definition_fr","preferred_sentence_zh"]},value:{type:"string"},confidence:{type:"number",minimum:0,maximum:1},notes:{type:"string"}},required:["field","value","confidence","notes"]};

async function submit(){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const jobs=(await client.query<{id:string;field:string;model:string;lemma:string;part_of_speech:string;gloss:string;sentence_fr:string}>(`
      SELECT ej.id,ej.field,coalesce(ej.model,'gpt-4o-mini') AS model,l.lemma,le.part_of_speech,coalesce(se.short_gloss_zh,'') AS gloss,o.sentence_fr
      FROM enrichment_jobs ej
      LEFT JOIN senses se ON ej.target_type='sense' AND se.id=ej.target_id
      LEFT JOIN occurrences target_o ON ej.target_type='occurrence' AND target_o.id=ej.target_id
      LEFT JOIN study_items si ON si.sense_id=se.id OR si.preferred_occurrence_id=target_o.id
      LEFT JOIN senses canonical_se ON canonical_se.id=si.sense_id
      LEFT JOIN lexical_entries le ON le.id=coalesce(se.lexical_entry_id,canonical_se.lexical_entry_id)
      LEFT JOIN lexemes l ON l.id=le.lexeme_id
      LEFT JOIN occurrences o ON o.id=coalesce(target_o.id,si.preferred_occurrence_id)
      WHERE ej.status='queued' AND ej.next_attempt_at<=now()
      ORDER BY ej.created_at FOR UPDATE OF ej SKIP LOCKED LIMIT 50000
    `)).rows;
    if(!jobs.length){await client.query("ROLLBACK");console.log("No enrichment jobs are queued");return;}
    const lines=jobs.map(job=>JSON.stringify({custom_id:job.id,method:"POST",url:"/v1/responses",body:{model:job.model,input:[{role:"system",content:"Draft one missing bilingual French-study field. Return only the requested structured value. Do not invent source claims. This is an unverified proposal for human review."},{role:"user",content:job.field==="definition_fr"?`Write a concise French dictionary definition for lemma '${job.lemma}' (${job.part_of_speech}), matching Chinese sense '${job.gloss}' and usage '${job.sentence_fr}'.`:`Translate this French source sentence accurately into Simplified Chinese: ${job.sentence_fr}`}],text:{format:{type:"json_schema",name:"vocabulary_enrichment",strict:true,schema}}}})).join("\n");
    const filePath=path.join(tmpdir(),`tcf-enrichment-${Date.now()}.jsonl`);await writeFile(filePath,lines,"utf8");
    let file;
    try { file=await openai.files.create({file:createReadStream(filePath),purpose:"batch"}); }
    finally { await unlink(filePath).catch(()=>undefined); }
    const batch=await openai.batches.create({input_file_id:file.id,endpoint:"/v1/responses",completion_window:"24h",metadata:{purpose:"tcf-vocabulary-enrichment"}});
    await client.query("UPDATE enrichment_jobs SET status='submitted',attempts=attempts+1,output=jsonb_build_object('batchId',$1),updated_at=now() WHERE id=ANY($2::uuid[])",[batch.id,jobs.map(job=>job.id)]);
    await client.query("COMMIT");console.log(JSON.stringify({batchId:batch.id,jobs:jobs.length},null,2));
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

function outputText(body:any):string|undefined{for(const item of body?.output??[])for(const content of item?.content??[])if(content?.type==="output_text")return content.text;return undefined;}
async function sync(id:string){
  const batch=await openai.batches.retrieve(id);if(batch.status!=="completed"){console.log(JSON.stringify({batchId:id,status:batch.status,counts:batch.request_counts},null,2));return;}if(!batch.output_file_id)throw new Error("Completed batch has no output file");
  const text=await (await openai.files.content(batch.output_file_id)).text();const client=await pool.connect();
  try{await client.query("BEGIN");for(const line of text.split("\n").filter(Boolean)){const record=JSON.parse(line);const jobId=record.custom_id;const raw=outputText(record.response?.body);if(!raw){await client.query("UPDATE enrichment_jobs SET status='failed',error=$2,updated_at=now() WHERE id=$1",[jobId,JSON.stringify(record.error??"Missing structured output")]);continue;}const proposal=JSON.parse(raw);const job=(await client.query<{target_type:string;target_id:string;field:string}>("SELECT target_type,target_id,field FROM enrichment_jobs WHERE id=$1 FOR UPDATE",[jobId])).rows[0];if(!job)continue;await client.query(`INSERT INTO content_review_tasks (sense_id,occurrence_id,field,status,proposed_value,evidence) VALUES (CASE WHEN $1='sense' THEN $2::uuid END,CASE WHEN $1='occurrence' THEN $2::uuid END,$3,'open',$4,$5)`,[job.target_type,job.target_id,job.field,JSON.stringify(proposal),JSON.stringify({provider:"openai",batchId:id,model:record.response?.body?.model})]);await client.query("UPDATE enrichment_jobs SET status='needs_review',output=$2,error=NULL,updated_at=now() WHERE id=$1",[jobId,JSON.stringify({batchId:id,proposal})]);}await client.query("COMMIT");console.log(JSON.stringify({batchId:id,status:"synced"},null,2));}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

try{if(command==="submit")await submit();else if(command==="sync"&&batchId)await sync(batchId);else throw new Error("Usage: tsx scripts/openai-enrichment-batch.ts submit | sync <batch-id>");}finally{await pool.end();}
