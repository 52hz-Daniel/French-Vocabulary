-- The importer replaces only unresolved derived quality issues for the selected
-- collection. Reviewed catalog rows remain protected by RESTRICT constraints.
GRANT DELETE ON "study_item_issues" TO tcf_ingest;
