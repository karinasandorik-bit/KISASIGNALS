-- Run as PostgreSQL owner; provision role password out of band.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='oos_collector') THEN
  CREATE ROLE oos_collector LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
 END IF;
END $$;
REVOKE ALL ON SCHEMA owl_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA owl_internal, public TO oos_collector;
GRANT SELECT ON owl_internal.predictions TO oos_collector;
GRANT SELECT ON public.evidence_events TO oos_collector;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.evidence_events FROM oos_collector;
-- Only one fixed event type can be inserted, through this guarded function.
CREATE OR REPLACE FUNCTION public.oos_insert_world(
 p_id text,p_observed timestamptz,p_payload jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE prior jsonb;
BEGIN
 IF p_id IS NULL OR length(p_id)=0 OR p_payload->>'predictionId' IS DISTINCT FROM p_id
    OR p_payload->>'authentication' IS DISTINCT FROM 'HMAC_VERIFIED'
    OR p_payload->>'provenanceStatus' IS DISTINCT FROM 'CLAIMED_NEEDS_SOURCE_AUDIT'
    OR p_payload->>'receiptSha256' !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'INVALID_OOS_RECEIPT';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM owl_internal.predictions WHERE id=p_id) THEN
  RAISE EXCEPTION 'UNKNOWN_PREDICTION';
 END IF;
 INSERT INTO public.evidence_events(event_type,event_id,observed_at,payload)
 VALUES('oos_independent_world',p_id,p_observed,p_payload)
 ON CONFLICT(event_type,event_id) DO NOTHING;
 IF FOUND THEN RETURN true; END IF;
 SELECT payload INTO prior FROM public.evidence_events
 WHERE event_type='oos_independent_world' AND event_id=p_id;
 IF prior->>'receiptSha256' IS DISTINCT FROM p_payload->>'receiptSha256' THEN
  RAISE EXCEPTION 'IMMUTABLE_WORLD_CONFLICT';
 END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.oos_insert_world(text,timestamptz,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oos_insert_world(text,timestamptz,jsonb) TO oos_collector;
