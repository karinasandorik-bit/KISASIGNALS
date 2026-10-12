-- Execute as GENESIS PostgreSQL admin in a secure psql session.
-- Set a strong secret via psql variable, never commit credentials.
-- Example: psql "$DATABASE_URL" -v fault_password='...generated secret...' -f scripts/bootstrap-fault-db.sql
\set ON_ERROR_STOP on
SELECT format('CREATE ROLE owl_fault_runner LOGIN PASSWORD %L', :'fault_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='owl_fault_runner') \gexec
SELECT 'CREATE DATABASE owl_fault_lab OWNER owl_fault_runner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='owl_fault_lab') \gexec
\connect owl_fault_lab
REVOKE ALL ON DATABASE owl_fault_lab FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE owl_fault_lab TO owl_fault_runner;
GRANT USAGE,CREATE ON SCHEMA public TO owl_fault_runner;
SELECT current_database() AS database_name, rolname FROM pg_roles WHERE rolname='owl_fault_runner';
