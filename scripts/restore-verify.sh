#!/usr/bin/env bash
set -Eeuo pipefail
: "${1:?Usage: restore-verify.sh /absolute/path/to/backup.dump}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL for a separate EMPTY TEST database}"
dump="$1"
test -s "$dump"
test -f "$dump.sha256"
(cd "$(dirname "$dump")" && sha256sum --check "$(basename "$dump").sha256")
pg_restore --list "$dump" > /dev/null
db_name="$(psql "$RESTORE_DATABASE_URL" -Atqc 'select current_database()')"
case "$db_name" in *restore*|*scratch*|*test*) ;; *) echo "RESTORE_REFUSED_TARGET_NAME=$db_name" >&2;exit 5;; esac
count="$(psql "$RESTORE_DATABASE_URL" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")"
if [ "$count" != "0" ];then echo "RESTORE_REFUSED_NONEMPTY_DATABASE" >&2;exit 6;fi
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-acl --exit-on-error "$dump"
tables="$(psql "$RESTORE_DATABASE_URL" -Atqc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
echo "RESTORE_VERIFIED_DB=$db_name"
echo "RESTORE_PUBLIC_TABLES=$tables"
echo "RESTORE_COMPLETE=true"
