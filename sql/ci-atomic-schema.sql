-- Disposable CI-only schema. Never apply to production without a reviewed migration.
CREATE SCHEMA IF NOT EXISTS owl_internal;
CREATE TABLE IF NOT EXISTS owl_internal.predictions (
  id text PRIMARY KEY,
  commitment text NOT NULL,
  payload jsonb NOT NULL,
  target_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS owl_internal.outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prediction_id text NOT NULL UNIQUE REFERENCES owl_internal.predictions(id),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','LEASED','DONE')),
  worker_id text,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS owl_internal.settlements (
  prediction_id text PRIMARY KEY REFERENCES owl_internal.predictions(id),
  outcome jsonb NOT NULL
);

-- Precreate shared ledger DDL to avoid concurrent CREATE TABLE races across Node test files.
CREATE TABLE IF NOT EXISTS public.evidence_events (
 event_type text NOT NULL,
 event_id text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 payload jsonb NOT NULL,
 PRIMARY KEY(event_type,event_id)
);

CREATE TABLE IF NOT EXISTS public.owl_email_outbox_v2 (
 decision_id text PRIMARY KEY,
 payload_hash text NOT NULL,
 signal jsonb NOT NULL,
 recipient text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING',
 created_at timestamptz NOT NULL DEFAULT now(),
 claimed_at timestamptz,
 sent_at timestamptz,
 provider_message_id text,
 error_code text,
 CHECK (status IN ('PENDING','CLAIMED','SENT','UNKNOWN','REJECTED'))
);

CREATE TABLE IF NOT EXISTS public.owl_market_report_delivery (
 report_id text PRIMARY KEY,
 window_start timestamptz NOT NULL,
 window_end timestamptz NOT NULL,
 recipient text NOT NULL,
 state text NOT NULL CHECK(state IN ('PENDING','CONFIG_MISSING','SENDING','SENT','FAILED','UNKNOWN')),
 attempts integer NOT NULL DEFAULT 0,
 provider_message_id text,
 last_error text,
 payload jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
