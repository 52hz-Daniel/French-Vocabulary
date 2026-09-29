import type { PoolClient } from "pg";
import { normalizeFrench } from "@/domain/normalize";
import { currentUserId, withUserClient } from "./user-context";

export interface LibraryQuery {
  query?: string;
  collection?: string;
  status?: "all" | "review" | "difficult" | "new";
  favorite?: boolean;
  sort?: "lemma" | "meaning" | "status" | "due";
  direction?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

function limit(value?: number) { return Math.max(1, Math.min(value ?? 40, 100)); }
function decodeCursor(value?: string): { value: string; id: string } { try { return value ? JSON.parse(Buffer.from(value, "base64url").toString("utf8")) : { value: "", id: "" }; } catch { return { value: "", id: "" }; } }
function encodeCursor(value: string, id: string): string { return Buffer.from(JSON.stringify({ value, id })).toString("base64url"); }

export async function listLibrary(input: LibraryQuery, userId = currentUserId()) {
  const normalized = normalizeFrench(input.query ?? "");
  const cursor = decodeCursor(input.cursor);
  const sortExpressions = {
    lemma: "l.normalized_lemma",
    meaning: "coalesce(se.short_gloss_zh,'')",
    status: "CASE WHEN coalesce(rc.lapses,0)>0 THEN '2' WHEN rc.due_at IS NOT NULL THEN '1' ELSE '0' END",
    due: "coalesce(to_char(rc.due_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US'),'9999')",
  } as const;
  const sortExpression = sortExpressions[input.sort ?? "lemma"];
  const direction = input.direction === "desc" ? "DESC" : "ASC";
  const comparison = direction === "DESC" ? "<" : ">";
  return withUserClient(userId, async (client) => {
    const result = await client.query<{
      id: string; lemma: string; normalized_lemma: string; ipa: string | null; part_of_speech: string; gender: string | null; gloss: string | null; status: string; due_at: Date | null; lapses: number | null; collection_slug: string; bookmarked: boolean; sort_value: string;
    }>(`
      SELECT si.id, l.lemma, l.normalized_lemma, le.ipa, le.part_of_speech, le.gender,
             se.short_gloss_zh AS gloss, si.status, rc.due_at, rc.lapses, c.slug AS collection_slug,
             (ub.user_id IS NOT NULL) AS bookmarked, ${sortExpression} AS sort_value
      FROM study_items si
      JOIN collections c ON c.id = si.collection_id
      JOIN senses se ON se.id = si.sense_id
      JOIN lexical_entries le ON le.id = se.lexical_entry_id
      JOIN lexemes l ON l.id = le.lexeme_id
      LEFT JOIN review_cards rc ON rc.study_item_id = si.id AND rc.user_id = $1
      LEFT JOIN user_bookmarks ub ON ub.study_item_id = si.id AND ub.user_id = $1
      WHERE ($2 = '' OR c.slug = $2)
        AND ($3 = '' OR l.search_lemma ILIKE '%' || $3 || '%' OR l.search_lemma % $3 OR coalesce(se.short_gloss_zh,'') ILIKE '%' || $4 || '%')
        AND ($5 = 'all' OR ($5 = 'review' AND rc.due_at <= now()) OR ($5 = 'difficult' AND coalesce(rc.lapses,0) > 0) OR ($5 = 'new' AND rc.due_at IS NULL))
        AND (NOT $6::boolean OR ub.user_id IS NOT NULL)
        AND ($7 = '' OR (${sortExpression},si.id) ${comparison} ($7::text,$8::uuid))
      ORDER BY ${sortExpression} ${direction}, si.id ${direction}
      LIMIT $9
    `, [userId, input.collection ?? "", normalized, input.query ?? "", input.status ?? "all", input.favorite ?? false, cursor.value, cursor.id || "00000000-0000-0000-0000-000000000000", limit(input.limit) + 1]);
    const hasMore = result.rows.length > limit(input.limit);
    const rows = result.rows.slice(0, limit(input.limit));
    const last = rows.at(-1);
    return { items: rows.map((row) => ({ id: row.id, lemma: row.lemma, ipa: row.ipa, partOfSpeech: row.part_of_speech, gender: row.gender, meaningChinese: row.gloss, status: row.status, dueAt: row.due_at, lapses: row.lapses ?? 0, collectionId: row.collection_slug, bookmarked: row.bookmarked })), nextCursor: hasMore && last ? encodeCursor(last.sort_value, last.id) : null };
  });
}

export async function listLibraryOptions(userId = currentUserId()) {
  return withUserClient(userId, async (client) => ({
    collections: (await client.query<{ slug: string; title: string }>("SELECT slug,title FROM collections WHERE available ORDER BY title")).rows,
  }));
}

export async function getStudyItem(id: string, client?: PoolClient) {
  const operation = async (connection: PoolClient) => {
    const item = await connection.query<{
      id: string; collection_slug: string; collection_title: string; lemma: string; ipa: string | null; part_of_speech: string; gender: string | null; definition_fr: string | null; definition_zh: string | null; gloss: string | null; occurrence_id: string; sentence_fr: string; sentence_zh: string | null; source_reference: string; status: string;
    }>(`
      SELECT si.id, c.slug AS collection_slug, c.title AS collection_title, l.lemma, le.ipa, le.part_of_speech, le.gender,
             se.definition_fr, se.definition_zh, se.short_gloss_zh AS gloss, o.id AS occurrence_id,
             o.sentence_fr, ot.text AS sentence_zh, o.source_reference, si.status
      FROM study_items si JOIN collections c ON c.id=si.collection_id JOIN senses se ON se.id=si.sense_id
      JOIN lexical_entries le ON le.id=se.lexical_entry_id JOIN lexemes l ON l.id=le.lexeme_id
      JOIN occurrences o ON o.id=si.preferred_occurrence_id LEFT JOIN occurrence_translations ot ON ot.id=si.preferred_translation_id
      WHERE si.id=$1
    `, [id]);
    if (!item.rows[0]) return null;
    const forms = await connection.query<{ surface: string; form_kind: string; mood: string | null; tense: string | null; person: string | null; number: string | null; gender: string | null }>(`SELECT surface,form_kind,mood,tense,person,number,gender FROM forms f JOIN senses se ON se.lexical_entry_id=f.lexical_entry_id JOIN study_items si ON si.sense_id=se.id WHERE si.id=$1 ORDER BY form_kind,mood,tense,person,number,surface LIMIT 200`, [id]);
    return { ...item.rows[0], forms: forms.rows };
  };
  return client ? operation(client) : withUserClient(currentUserId(), operation);
}

export async function getTodaySummary(userId = currentUserId()) {
  return withUserClient(userId, async (client) => (await client.query<{ available: number; due: number; difficult: number; collection_title: string | null }>(`
    SELECT count(*) FILTER (WHERE si.status='STUDY_READY')::int AS available,
           count(*) FILTER (WHERE si.status='STUDY_READY' AND (rc.due_at IS NULL OR rc.due_at<=now()))::int AS due,
           count(*) FILTER (WHERE coalesce(rc.lapses,0)>0)::int AS difficult,
           min(c.title) AS collection_title
    FROM study_items si JOIN collections c ON c.id=si.collection_id LEFT JOIN review_cards rc ON rc.study_item_id=si.id AND rc.user_id=$1
  `, [userId])).rows[0]);
}

export async function getProgress(userId = currentUserId()) {
  return withUserClient(userId, async (client) => {
    const totals = (await client.query(`SELECT count(*)::int AS active, count(*) FILTER (WHERE rc.repetitions>0)::int AS studied, coalesce(sum(rc.repetitions),0)::int AS reviews, coalesce(sum(rc.lapses),0)::int AS lapses FROM study_items si LEFT JOIN review_cards rc ON rc.study_item_id=si.id AND rc.user_id=$1 WHERE si.status='STUDY_READY'`, [userId])).rows[0];
    const days = (await client.query(`SELECT day,encounters,reviews,correct,incorrect,study_seconds,new_items FROM user_daily_metrics WHERE user_id=$1 AND day>=current_date-29 ORDER BY day`, [userId])).rows;
    const priority = (await client.query(`SELECT si.id,l.lemma,coalesce(rc.lapses,0)::int AS lapses FROM study_items si JOIN senses se ON se.id=si.sense_id JOIN lexical_entries le ON le.id=se.lexical_entry_id JOIN lexemes l ON l.id=le.lexeme_id LEFT JOIN review_cards rc ON rc.study_item_id=si.id AND rc.user_id=$1 WHERE si.status='STUDY_READY' ORDER BY coalesce(rc.lapses,0) DESC,si.priority DESC LIMIT 3`, [userId])).rows;
    return { totals, days, priority };
  });
}
