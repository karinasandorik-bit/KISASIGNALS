# OWL NEST | Disaster recovery v0.1
Status: **code installed, backup not yet verified**. Do not shut down Railway from this document alone.

## What was discovered (2026-10-11)
- Railway GENESIS: PostgreSQL 18, persistent `postgres-volume` (500 MB); KISASIGNALS; KISA-DEX; Telegram webhook.
- Railway SWE-REPLAY-LAB: OWL-CORE worker, persistent `owl-state` mounted at `/data` (500 MB).
- Separate Supabase OWL runs PostgreSQL 17; **not a verified Railway replica**.
- Code in GitHub is separate from PostgreSQL rows and `/data` files.

## Bootstrap
1. Create a **private** bucket at a provider outside Railway, preferably supporting S3-compatible API and versioning. Restrict access and enable retention.
2. Store six GitHub Actions repository secrets: `OWL_RAILWAY_DATABASE_URL` (a reachable TLS-protected public Railway connection string), `OWL_BACKUP_PASSPHRASE` (strong independently retained passphrase), `OWL_BACKUP_S3_BUCKET`, `OWL_BACKUP_S3_ENDPOINT`, `OWL_BACKUP_ACCESS_KEY_ID`, `OWL_BACKUP_SECRET_ACCESS_KEY`. Never place these in repository files, issues, or logs. Verify network access and billing limits first.
3. Set GitHub Actions variable `OWL_BACKUP_ENABLED=true`. Until then the scheduled workflow intentionally does **not** execute.
4. Trigger workflow manually. Confirm the encrypted object, SHA-256 sidecar and table-of-contents sidecar are present in the external bucket. This is only an upload check.
5. Provision a separate disposable PostgreSQL **18** database with TLS. Set `RESTORE_DATABASE_URL` and `BACKUP_KEY` locally in a secure environment, plus the S3 secrets; run `bash ops/backup/verify-restore.sh`. Confirm expected table counts and specific ledger identifiers against the source.
6. Also back up the Railway `/data` volume using a safe, separately authenticated export path; the PG dump does not contain it.
7. Repeat restores and record time-to-restore, oldest recoverable snapshot, hashes, row counts and successful replay of a shadow trade. Test a provider failure before declaring recovery ready.

## Important limits
- GitHub Actions scheduled jobs can be delayed or skipped. Monitor last-success and have a second trigger.
- An external bucket, credentials, and independent database are required; a GitHub repository or Supabase project alone is not an adequate verified backup.
- PostgreSQL 18 → PostgreSQL 17 is **not** a supported downgrade route. Use PostgreSQL 18 or newer for the restore target.
- Free hosting can sleep, pause, or exhaust quotas. Event-driven / scheduled jobs do not replace a persistent WebSocket/L2 recorder; that service needs reliable always-on compute or a redesign.
- Restore script assumes an **empty disposable target database**, and restores without roles/ownership/ACL. Cluster globals and extension compatibility need separate handling.
- Backups with one shared passphrase need a separately secured copy of that secret. Do not use the source Railway volume as the only copy.
- Keep production untouched until an independently verified restore and read-only comparison pass.
