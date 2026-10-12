# OWL backup recovery acceptance gate

Status: PREPARED, NOT EXECUTED. Do not switch off Railway until all three gates are proven.

1. On a trusted external machine or isolated GitHub Actions runner, install the PostgreSQL **18** client tools matching the Railway source database. Configure `SOURCE_DATABASE_URL` privately from Railway; NEVER commit or print it. Set `BACKUP_DIRECTORY` to a directory outside Railway. Run `bash scripts/backup-genesis.sh`; retain the .dump and .sha256 files in encrypted, access-controlled storage. Verify the backup bytes and hash.

2. Provision an explicitly disposable **empty database** with name containing `restore`, `scratch`, or `test`, preferably PostgreSQL 18 for compatibility (the existing Supabase OWL instance is PostgreSQL 17 and already contains tables; DO NOT restore onto it). Set `RESTORE_DATABASE_URL` privately. Run `bash scripts/restore-verify.sh /path/to/file.dump`. This script refuses nonempty targets and databases with other names. Confirm `RESTORE_COMPLETE=true`, record resulting table count and independent application-specific row checks. Drop the scratch database only after acceptance.

3. Only after external backup + successful restore, re-evaluate Railway service cost. Keep market recorder event-driven and continuous; move only non-real-time research jobs to GitHub Actions schedule. Schedule delays and usage limits make Actions unsuitable for 24/7 order-book reconstruction.

No production orders; email and signal permissions remain disabled unless independently validated.
