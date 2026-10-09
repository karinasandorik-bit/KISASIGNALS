# Owned DEX Recovery — migration boundary

Owner: karinasandorik-bit. No write access or deployment dependence on deontey303/crypto-monitor.

## Repositories to create under this owner
- OWL-CORE: bounded capabilities, evidence contracts, signed audit trail.
- KISA-DEX: independent market ingestion and PostgreSQL-backed shadow outcomes.
Keep KISASIGNALS as the trading decision/dashboard repository. Do not duplicate it.

## PostgreSQL compatibility blockers
The old DEX worker used SQLite `INSERT OR IGNORE` and `INSERT OR REPLACE`.
Postgres equivalent for immutable insert:
```sql
INSERT INTO runs(source,tick) VALUES ($1,$2)
ON CONFLICT (source,tick) DO NOTHING;
```
For state upsert:
```sql
INSERT INTO state(source,ts,cooldown) VALUES ($1,$2,$3)
ON CONFLICT (source) DO UPDATE
SET ts=EXCLUDED.ts,cooldown=EXCLUDED.cooldown;
```
Every query must use Postgres parameterization and run within a transaction where appropriate.

## Acceptance gates
1. Read market quotes from at least one real source with observed_at and source identity.
2. Freeze decision before outcome availability; never backfill a decision as prospective.
3. Insert decision with unique ID and source/evidence hashes.
4. Settle only after horizon with separately timestamped quotes.
5. Verify finalized outcome cannot be updated or deleted, including in a rollback-only test transaction.
6. Read the same record back after process restart.
7. Confirm cron cycle_ok; reject deployment if SQLSTATE 42601 appears.
8. No real exchange orders, signer or wallet keys in the DEX service.

## Migration safety
Do not repoint Railway services until new repo CI and shadow-only smoke test pass.
No copying of secret values. No claim of completed settlement without DB readback.
