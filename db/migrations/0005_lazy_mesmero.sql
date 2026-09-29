DROP INDEX "lexemes_normalized_trgm_idx";--> statement-breakpoint
ALTER TABLE "lexemes" ADD COLUMN "search_lemma" text;--> statement-breakpoint
UPDATE "lexemes" SET "search_lemma" = lower(unaccent("normalized_lemma"));--> statement-breakpoint
ALTER TABLE "lexemes" ALTER COLUMN "search_lemma" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "lexemes_search_trgm_idx" ON "lexemes" USING gin ("search_lemma" gin_trgm_ops);
