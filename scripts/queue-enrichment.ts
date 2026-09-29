import "./load-env";
import { Pool } from "pg";

const connectionString=process.env.DATABASE_INGEST_URL??process.env.DATABASE_ADMIN_URL;
if(!connectionString)throw new Error("DATABASE_INGEST_URL or DATABASE_ADMIN_URL is required");
const model=process.env.OPENAI_ENRICHMENT_MODEL??"gpt-4o-mini";
const pool=new Pool({connectionString,max:1});
try{
  const result=await pool.query(`
    INSERT INTO enrichment_jobs (target_type,target_id,field,provider,model,input_hash,status)
    SELECT 'sense',se.id,'definition_fr','openai', $1, md5(concat_ws('|',l.lemma,le.part_of_speech,se.short_gloss_zh,o.sentence_fr)), 'queued'
    FROM senses se JOIN lexical_entries le ON le.id=se.lexical_entry_id JOIN lexemes l ON l.id=le.lexeme_id
    JOIN study_items si ON si.sense_id=se.id JOIN occurrences o ON o.id=si.preferred_occurrence_id
    WHERE se.definition_fr IS NULL
    ON CONFLICT (target_type,target_id,field,input_hash) DO NOTHING;

    INSERT INTO enrichment_jobs (target_type,target_id,field,provider,model,input_hash,status)
    SELECT 'occurrence',o.id,'preferred_sentence_zh','openai',$1,md5(o.sentence_fr),'queued'
    FROM study_items si JOIN occurrences o ON o.id=si.preferred_occurrence_id
    LEFT JOIN occurrence_translations ot ON ot.id=si.preferred_translation_id
    WHERE ot.id IS NULL
    ON CONFLICT (target_type,target_id,field,input_hash) DO NOTHING;
  `,[model]);
  const counts=(await pool.query("SELECT field,status,count(*)::int AS count FROM enrichment_jobs GROUP BY field,status ORDER BY field,status")).rows;
  console.log(JSON.stringify({queuedOrExisting:result.rowCount,counts},null,2));
}finally{await pool.end();}
