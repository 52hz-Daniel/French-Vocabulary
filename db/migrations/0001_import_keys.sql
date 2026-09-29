ALTER TABLE "forms" ADD COLUMN "external_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "occurrences" ADD COLUMN "external_key" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "forms_entry_external_key_uidx" ON "forms" USING btree ("lexical_entry_id","external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrences_external_key_uidx" ON "occurrences" USING btree ("external_key");