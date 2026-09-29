import { currentUserId, withUserClient } from "./user-context";
import { scheduleReview, SCHEDULER_VERSION, type StoredReviewCard } from "@/domain/scheduler";

function hash(value: string): number { let result = 2166136261; for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619); return result >>> 0; }
function shuffled<T>(values: T[], seed: number): T[] { const result=[...values]; let state=seed||1; for(let i=result.length-1;i>0;i--){state=(state*1664525+1013904223)>>>0; const j=state%(i+1); [result[i],result[j]]=[result[j],result[i]];} return result; }

export async function createReviewSession(collectionSlug?: string, userId = currentUserId()) {
  return withUserClient(userId, async (client) => {
    const collection = collectionSlug ? (await client.query<{ id: string }>("SELECT id FROM collections WHERE slug=$1", [collectionSlug])).rows[0] : null;
    if (collectionSlug && !collection) throw new Error("Collection not found");
    const result = await client.query<{ id: string }>("INSERT INTO study_sessions (user_id,collection_id,mode,scheduler_version) VALUES ($1,$2,'mixed',$3) RETURNING id", [userId, collection?.id ?? null, SCHEDULER_VERSION]);
    return { sessionId: result.rows[0].id };
  });
}

export async function nextReviewQuestion(sessionId: string, userId = currentUserId()) {
  return withUserClient(userId, async (client) => {
    const session = (await client.query<{ collection_id: string | null }>("SELECT collection_id FROM study_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE", [sessionId, userId])).rows[0];
    if (!session) throw new Error("Review session not found");
    const target = (await client.query<{ study_item_id: string; sense_id: string; occurrence_id: string; lemma: string; ipa: string | null; part_of_speech: string; gloss: string; sentence_fr: string; question_count: number }>(`
      SELECT si.id AS study_item_id,se.id AS sense_id,o.id AS occurrence_id,l.lemma,le.ipa,le.part_of_speech,se.short_gloss_zh AS gloss,o.sentence_fr,
             (SELECT count(*)::int FROM review_questions rq WHERE rq.session_id=$1) AS question_count
      FROM study_items si JOIN senses se ON se.id=si.sense_id JOIN lexical_entries le ON le.id=se.lexical_entry_id JOIN lexemes l ON l.id=le.lexeme_id JOIN occurrences o ON o.id=si.preferred_occurrence_id
      LEFT JOIN review_cards rc ON rc.study_item_id=si.id AND rc.user_id=$2
      WHERE si.status='STUDY_READY' AND ($3::uuid IS NULL OR si.collection_id=$3) AND (rc.due_at IS NULL OR rc.due_at<=now())
        AND NOT EXISTS (SELECT 1 FROM review_questions rq WHERE rq.session_id=$1 AND rq.study_item_id=si.id)
      ORDER BY rc.due_at NULLS FIRST,si.priority DESC LIMIT 1
    `, [sessionId, userId, session.collection_id])).rows[0];
    if (!target) { await client.query("UPDATE study_sessions SET completed_at=coalesce(completed_at,now()) WHERE id=$1", [sessionId]); return null; }
    const candidates = (await client.query<{ sense_id: string; gloss: string; part_of_speech: string }>(`
      SELECT se.id AS sense_id,se.short_gloss_zh AS gloss,le.part_of_speech FROM senses se JOIN lexical_entries le ON le.id=se.lexical_entry_id
      JOIN study_items si ON si.sense_id=se.id WHERE si.status='STUDY_READY' AND se.id<>$1 AND se.short_gloss_zh<>$2
      ORDER BY (le.part_of_speech=$3) DESC,si.priority DESC LIMIT 12
    `, [target.sense_id, target.gloss, target.part_of_speech])).rows;
    const unique = [...new Map(candidates.map((item) => [item.gloss, item])).values()].slice(0, 3);
    if (unique.length < 3) throw new Error("At least three distinct study-ready distractors are required");
    const seed = hash(`${target.study_item_id}:${target.question_count}`);
    const options = shuffled([{ senseId: target.sense_id, label: target.gloss }, ...unique.map((item) => ({ senseId: item.sense_id, label: item.gloss }))], seed);
    const question = (await client.query<{ id: string }>("INSERT INTO review_questions (session_id,study_item_id,prompt_occurrence_id,correct_sense_id,mode,seed) VALUES ($1,$2,$3,$4,'WORD_RECOGNITION',$5) RETURNING id", [sessionId,target.study_item_id,target.occurrence_id,target.sense_id,seed])).rows[0];
    for (let index=0; index<options.length; index++) await client.query("INSERT INTO review_question_options (question_id,position,sense_id) VALUES ($1,$2,$3)", [question.id,index,options[index].senseId]);
    return { questionId: question.id, studyItemId: target.study_item_id, word: target.lemma, ipa: target.ipa, partOfSpeech: target.part_of_speech, sentenceFrench: target.sentence_fr, options };
  });
}

export async function answerReviewQuestion(input: { sessionId: string; questionId: string; selectedSenseId: string; idempotencyKey: string; responseMs: number }, userId=currentUserId()) {
  return withUserClient(userId, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${userId}:${input.idempotencyKey}`]);
    const previous = await client.query("SELECT correct,payload FROM encounter_events WHERE user_id=$1 AND idempotency_key=$2", [userId,input.idempotencyKey]);
    if (previous.rows[0]) return { correct: previous.rows[0].correct, duplicate: true, schedule: previous.rows[0].payload?.schedule };
    const question = (await client.query<{ study_item_id:string;correct_sense_id:string;occurrence_id:string|null }>(`SELECT rq.study_item_id,rq.correct_sense_id,rq.prompt_occurrence_id AS occurrence_id FROM review_questions rq JOIN study_sessions ss ON ss.id=rq.session_id WHERE rq.id=$1 AND rq.session_id=$2 AND ss.user_id=$3 FOR UPDATE`, [input.questionId,input.sessionId,userId])).rows[0];
    if (!question) throw new Error("Review question not found");
    const answered = await client.query("SELECT correct,payload FROM encounter_events WHERE user_id=$1 AND question_id=$2 AND event_type='review_answer'", [userId,input.questionId]);
    if (answered.rows[0]) return { correct: answered.rows[0].correct, duplicate: true, schedule: answered.rows[0].payload?.schedule };
    const option = await client.query("SELECT 1 FROM review_question_options WHERE question_id=$1 AND sense_id=$2", [input.questionId,input.selectedSenseId]);
    if (!option.rowCount) throw new Error("Selected answer was not shown in this question");
    const correct = input.selectedSenseId === question.correct_sense_id;
    const cardRow = (await client.query(`SELECT * FROM review_cards WHERE user_id=$1 AND study_item_id=$2 FOR UPDATE`, [userId,question.study_item_id])).rows[0];
    const now = new Date();
    const scheduled = scheduleReview(cardRow as StoredReviewCard|undefined,correct,now);
    const next=scheduled.card;
    const schedule = { dueAt: next.due.toISOString(), stability: next.stability, difficulty: next.difficulty, state: scheduled.state, repetitions: next.reps, lapses: next.lapses };
    await client.query(`INSERT INTO encounter_events (idempotency_key,user_id,session_id,study_item_id,question_id,occurrence_id,event_type,mode,answer_sense_id,correct,response_ms,rating,payload) VALUES ($1,$2,$3,$4,$5,$6,'review_answer','WORD_RECOGNITION',$7,$8,$9,$10,$11)`, [input.idempotencyKey,userId,input.sessionId,question.study_item_id,input.questionId,question.occurrence_id,input.selectedSenseId,correct,Math.max(0,input.responseMs),scheduled.rating,JSON.stringify({schedule})]);
    await client.query(`INSERT INTO review_cards (user_id,study_item_id,due_at,stability,difficulty,elapsed_days,scheduled_days,learning_steps,repetitions,lapses,state,scheduler_version,last_reviewed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (user_id,study_item_id) DO UPDATE SET due_at=EXCLUDED.due_at,stability=EXCLUDED.stability,difficulty=EXCLUDED.difficulty,elapsed_days=EXCLUDED.elapsed_days,scheduled_days=EXCLUDED.scheduled_days,learning_steps=EXCLUDED.learning_steps,repetitions=EXCLUDED.repetitions,lapses=EXCLUDED.lapses,state=EXCLUDED.state,scheduler_version=EXCLUDED.scheduler_version,last_reviewed_at=EXCLUDED.last_reviewed_at,updated_at=now()`, [userId,question.study_item_id,next.due,next.stability,next.difficulty,next.elapsed_days,next.scheduled_days,next.learning_steps,next.reps,next.lapses,scheduled.state,SCHEDULER_VERSION,now]);
    await client.query(`INSERT INTO user_daily_metrics (user_id,day,encounters,reviews,correct,incorrect,study_seconds,new_items) VALUES ($1,current_date,1,$2,$3,$4,$5,$6) ON CONFLICT (user_id,day) DO UPDATE SET encounters=user_daily_metrics.encounters+1,reviews=user_daily_metrics.reviews+EXCLUDED.reviews,correct=user_daily_metrics.correct+EXCLUDED.correct,incorrect=user_daily_metrics.incorrect+EXCLUDED.incorrect,study_seconds=user_daily_metrics.study_seconds+EXCLUDED.study_seconds,new_items=user_daily_metrics.new_items+EXCLUDED.new_items,updated_at=now()`, [userId,cardRow?1:0,correct?1:0,correct?0:1,Math.round(Math.max(0,input.responseMs)/1000),cardRow?0:1]);
    return { correct, duplicate:false, correctSenseId: question.correct_sense_id, schedule };
  });
}
