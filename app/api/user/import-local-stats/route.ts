import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUserId, withUserClient } from "@/db/user-context";

interface LegacyStats { collectionId?: string; itemStats?: Record<string,{attempts?:number;correct?:number;incorrect?:number;lastCorrect?:boolean;lastStudiedAt?:string}> }
function stableUuid(value:string){const hex=createHash("sha256").update(value).digest("hex").slice(0,32);return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`;}

export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as LegacyStats|null;
  const entries=Object.entries(body?.itemStats??{});
  if(!body?.collectionId||entries.length>5000)return NextResponse.json({error:"Invalid legacy stats payload"},{status:400});
  const userId=currentUserId();
  try{
    const imported=await withUserClient(userId,async client=>{
      let count=0;
      for(const [externalKey,raw] of entries){
        const stats={attempts:Math.max(0,Math.trunc(raw.attempts??0)),correct:Math.max(0,Math.trunc(raw.correct??0)),incorrect:Math.max(0,Math.trunc(raw.incorrect??0))};
        if(!stats.attempts)continue;
        const item=(await client.query<{id:string}>(`SELECT si.id FROM lexemes l JOIN lexical_entries le ON le.lexeme_id=l.id JOIN senses se ON se.lexical_entry_id=le.id JOIN study_items si ON si.sense_id=se.id JOIN collections c ON c.id=si.collection_id WHERE l.external_key=$1 AND c.slug=$2 LIMIT 1`,[externalKey,body.collectionId])).rows[0];
        if(!item)continue;
        const idempotencyKey=stableUuid(`legacy:${userId}:${body.collectionId}:${externalKey}`);
        const occurredAt=raw.lastStudiedAt&&Number.isFinite(Date.parse(raw.lastStudiedAt))?new Date(raw.lastStudiedAt):new Date();
        const inserted=await client.query(`INSERT INTO encounter_events (idempotency_key,user_id,study_item_id,event_type,correct,occurred_at,payload) VALUES ($1,$2,$3,'legacy_import',$4,$5,$6) ON CONFLICT (user_id,idempotency_key) DO NOTHING`,[idempotencyKey,userId,item.id,raw.lastCorrect??null,occurredAt,JSON.stringify({legacyStats:stats})]);
        if(!inserted.rowCount)continue;
        await client.query(`INSERT INTO review_cards (user_id,study_item_id,due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,repetitions,lapses,state,scheduler_version,last_reviewed_at) VALUES ($1,$2,now(),0,0,0,0,0,$3,$4,'review','legacy-import-v1',$5) ON CONFLICT (user_id,study_item_id) DO UPDATE SET repetitions=greatest(review_cards.repetitions,EXCLUDED.repetitions),lapses=greatest(review_cards.lapses,EXCLUDED.lapses),last_reviewed_at=greatest(review_cards.last_reviewed_at,EXCLUDED.last_reviewed_at),updated_at=now()`,[userId,item.id,stats.attempts,stats.incorrect,occurredAt]);
        count++;
      }
      return count;
    });
    return NextResponse.json({imported});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Legacy import failed"},{status:503});}
}
