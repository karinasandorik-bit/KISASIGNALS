-- Apply as database owner to a dedicated, EMPTY CI PostgreSQL instance.
CREATE SCHEMA IF NOT EXISTS owl_internal;
CREATE TABLE IF NOT EXISTS owl_internal.predictions(
 id text PRIMARY KEY, commitment text NOT NULL, payload jsonb NOT NULL, target_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS owl_internal.outbox(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 prediction_id text UNIQUE NOT NULL REFERENCES owl_internal.predictions(id),
 state text NOT NULL DEFAULT 'PENDING',worker_id text, lease_until timestamptz,
 attempts integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.evidence_events(
 event_type text NOT NULL,event_id text NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(),
 payload jsonb NOT NULL, PRIMARY KEY(event_type,event_id)
);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='oos_reader') THEN
 CREATE ROLE oos_reader LOGIN PASSWORD 'ci_only_override_in_runner' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
END IF; END $$;
REVOKE ALL ON SCHEMA owl_internal FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA owl_internal FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA owl_internal TO oos_reader;
GRANT USAGE ON SCHEMA public TO oos_reader;
GRANT SELECT ON owl_internal.predictions TO oos_reader;
GRANT SELECT ON public.evidence_events TO oos_reader;
ALTER ROLE oos_reader SET default_transaction_read_only = on;
