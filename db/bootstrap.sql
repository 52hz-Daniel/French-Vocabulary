DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tcf_app') THEN
    CREATE ROLE tcf_app LOGIN PASSWORD 'tcf_local';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tcf_ingest') THEN
    CREATE ROLE tcf_ingest LOGIN PASSWORD 'tcf_local_ingest';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE tcf_lab TO tcf_app, tcf_ingest;
GRANT USAGE ON SCHEMA public TO tcf_app, tcf_ingest;
