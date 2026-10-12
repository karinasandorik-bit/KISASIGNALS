-- Run as DB owner, in a dedicated DB after the tables have been created.
-- Secret is supplied at deployment time, never committed to repo.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='oos_collector') THEN
   CREATE ROLE oos_collector LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
 END IF;
END $$;
REVOKE ALL ON SCHEMA owl_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA owl_internal TO oos_collector;
GRANT SELECT ON owl_internal.predictions TO oos_collector;
GRANT USAGE ON SCHEMA public TO oos_collector;
GRANT SELECT, INSERT ON public.evidence_events TO oos_collector;
REVOKE UPDATE, DELETE, TRUNCATE ON public.evidence_events FROM oos_collector;
-- This role still may INSERT other event types in this shared table.
-- Production hardening requires RLS or a dedicated SECURITY DEFINER function
-- restricting event_type='oos_independent_world', and immutable table triggers.
