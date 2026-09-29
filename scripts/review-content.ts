import "./load-env";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { DEV_USER_ID } from "@/db/schema";

const [action, taskId] = process.argv.slice(2);
if (!taskId || !["accept", "reject"].includes(action)) throw new Error("Usage: tsx scripts/review-content.ts accept|reject <task-id>");
const connectionString = process.env.DATABASE_INGEST_URL ?? process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_INGEST_URL or DATABASE_ADMIN_URL is required");
const reviewerId = process.env.REVIEWER_USER_ID ?? DEV_USER_ID;
const pool = new Pool({ connectionString, max: 1 });

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const task = (await client.query<{ sense_id: string | null; occurrence_id: string | null; field: string; proposed_value: { value?: string } }>(
      "SELECT sense_id,occurrence_id,field,proposed_value FROM content_review_tasks WHERE id=$1 AND status='open' FOR UPDATE",
      [taskId],
    )).rows[0];
    if (!task) throw new Error("Open review task not found");
    if (action === "accept") {
      const value = task.proposed_value?.value?.trim();
      if (!value) throw new Error("The proposal has no value");
      if (task.field === "definition_fr" && task.sense_id) {
        await client.query("UPDATE senses SET definition_fr=$1,verification_status='verified',reviewed_by=$2,reviewed_at=now(),updated_at=now() WHERE id=$3", [value, reviewerId, task.sense_id]);
      } else if (task.field === "preferred_sentence_zh" && task.occurrence_id) {
        await client.query("UPDATE occurrence_translations SET is_preferred=false,updated_at=now() WHERE occurrence_id=$1 AND language='zh' AND is_preferred", [task.occurrence_id]);
        const hash = createHash("sha256").update(value).digest("hex");
        const translation = (await client.query<{ id: string }>(`INSERT INTO occurrence_translations (occurrence_id,language,text,provider_kind,provider_name,status,content_hash,is_preferred,verified_at) VALUES ($1,'zh',$2,'ai_reviewed','openai','translated',$3,true,now()) ON CONFLICT (occurrence_id,language,content_hash) DO UPDATE SET is_preferred=true,status='translated',verified_at=now(),updated_at=now() RETURNING id`, [task.occurrence_id, value, hash])).rows[0];
        await client.query("UPDATE study_items SET preferred_translation_id=$1,updated_at=now() WHERE preferred_occurrence_id=$2", [translation.id, task.occurrence_id]);
      } else {
        throw new Error(`Unsupported review target: ${task.field}`);
      }
    }
    await client.query("UPDATE content_review_tasks SET status=$1,assigned_to=$2,resolved_at=now(),updated_at=now() WHERE id=$3", [action === "accept" ? "accepted" : "rejected", reviewerId, taskId]);
    await client.query(`UPDATE enrichment_jobs SET status=$1,updated_at=now() WHERE status='needs_review' AND field=$2 AND target_id=coalesce($3::uuid,$4::uuid)`, [action === "accept" ? "completed" : "failed", task.field, task.sense_id, task.occurrence_id]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ taskId, action, reviewerId }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
