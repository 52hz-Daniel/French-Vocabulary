-- Importers replace provider-specific evidence on every idempotent run.
GRANT DELETE ON "sense_evidence" TO tcf_ingest;
