-- Prospective data: append-only experiment ledger, not live trading.
CREATE SCHEMA IF NOT EXISTS owl_research;
CREATE TABLE IF NOT EXISTS owl_research.price_predictions (
 decision_id text PRIMARY KEY,
 model_sha256 text NOT NULL CHECK(model_sha256 ~ '^[0-9a-f]{64}$'),
 frozen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 evidence_at timestamptz NOT NULL,
 target_at timestamptz NOT NULL,
 venue text NOT NULL,
 symbol text NOT NULL,
 entry_price numeric NOT NULL CHECK(entry_price>0),
 proposed_side text NOT NULL CHECK(proposed_side IN ('LONG','SHORT','NO_TRADE')),
 prediction jsonb NOT NULL,
 evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 CHECK (evidence_at<=frozen_at AND target_at>frozen_at)
);
CREATE TABLE IF NOT EXISTS owl_research.price_outcomes (
 decision_id text PRIMARY KEY REFERENCES owl_research.price_predictions(decision_id),
 provider_venue text NOT NULL,
 observed_at timestamptz NOT NULL,
 exact_target_at timestamptz NOT NULL,
 exit_price numeric NOT NULL CHECK(exit_price>0),
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 fee_bps numeric NOT NULL CHECK(fee_bps>=0),
 slippage_bps numeric NOT NULL CHECK(slippage_bps>=0),
 funding_bps numeric NOT NULL,
 funding_basis text NOT NULL,
 outcome_quality text NOT NULL CHECK(outcome_quality IN ('EXACT_INDEPENDENT','REJECTED')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION owl_research.prevent_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_RESEARCH_LEDGER'; END $$;
DROP TRIGGER IF EXISTS price_predictions_immutable ON owl_research.price_predictions;
CREATE TRIGGER price_predictions_immutable BEFORE UPDATE OR DELETE ON owl_research.price_predictions FOR EACH ROW EXECUTE FUNCTION owl_research.prevent_mutation();
DROP TRIGGER IF EXISTS price_outcomes_immutable ON owl_research.price_outcomes;
CREATE TRIGGER price_outcomes_immutable BEFORE UPDATE OR DELETE ON owl_research.price_outcomes FOR EACH ROW EXECUTE FUNCTION owl_research.prevent_mutation();
REVOKE ALL ON SCHEMA owl_research FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA owl_research FROM PUBLIC,anon,authenticated;
