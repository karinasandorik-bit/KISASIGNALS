# OWL NEST — Disaster recovery (v0.1)

Status: **PROCEDURE PREPARED; RESTORE NOT VERIFIED**. Never stop or delete Railway's PostgreSQL until an independent successful restore and app-level checks are recorded.

## Protection invariant
1. Code is versioned in GitHub; never commit .env, credentials, database dumps, trading account secrets, or personal data.
2. A backup is only valid if: external copy exists, encrypted bytes are verified, PostgreSQL accepts restore, and application-level record counts/checks pass.
3. Use a separate external runner with authorized network access to Railway's PostgreSQL TCP endpoint; do not copy credentials into issues or chat.
4. Retain a second independent recovery destination. Record backup SHA-256, restore test timestamp, Postgres versions, table counts, latest immutable decision ID, and source commit.
5. Freeze schema/write traffic briefly or use a consistent pg_dump snapshot; before cutover, reconcile writes occurring after snapshot.

## Portable test commands (on an authorized secure runner)

\`\`\`bash
set -euo pipefail
umask 077
# Supply SOURCE_DATABASE_URL and RESTORE_DATABASE_URL only through a secret manager.
# Set recipient key to a recipient-controlled AGE public key.
: "\${SOURCE_DATABASE_URL:?required}"
: "\${RESTORE_DATABASE_URL:?required}"
: "\${AGE_RECIPIENT:?required}"
pg_dump --dbname="\$SOURCE_DATABASE_URL" --format=custom --no-owner --no-acl --file=owl.dump
sha256sum owl.dump > owl.dump.sha256
age -r "\$AGE_RECIPIENT" -o owl.dump.age owl.dump
sha256sum owl.dump.age > owl.dump.age.sha256
sha256sum -c owl.dump.age.sha256
# Transfer owl.dump.age and hash to independently controlled private object storage.
# Restore into a NEW empty database of compatible PostgreSQL major version.
pg_restore --dbname="\$RESTORE_DATABASE_URL" --no-owner --no-acl --exit-on-error owl.dump
# Run read-only application-specific verification queries against restored database.
\`\`\`

## Acceptance gate
- [ ] Encrypted off-platform backup uploaded; remote SHA-256 verified.
- [ ] Separate, clean PostgreSQL restored without errors.
- [ ] Independent record count and newest decision/outcome match captured source snapshot.
- [ ] Worker successfully starts against the recovered environment in read-only or shadow mode.
- [ ] Recovery receipt committed WITHOUT secrets and WITHOUT sensitive table contents.

## Current infrastructure
- Railway GENESIS: legacy execution and original PostgreSQL.
- Supabase OWL: independent DB, **not established to be a complete replica**.
- Supabase Edge Function \`owl-nest\`: separate authenticated operational entrypoint.
- Vercel: account exists, project creation returned authorization 403 on 2026-10-11; public deployment unverified.

Do not claim disaster-recovery readiness before all acceptance checks are satisfied.
