#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL using a private environment variable}"
: "${BACKUP_DIRECTORY:?Set BACKUP_DIRECTORY outside Railway on a trusted machine}"
mkdir -p -- "$BACKUP_DIRECTORY"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIRECTORY/owl-genesis-$stamp.dump"
tmp="$out.partial"
trap 'rm -f -- "$tmp"' ERR INT TERM
pg_dump --dbname="$SOURCE_DATABASE_URL" --format=custom --no-owner --no-acl --file="$tmp"
test -s "$tmp"
pg_restore --list "$tmp" >/dev/null
mv -- "$tmp" "$out"
sha256sum "$out" > "$out.sha256"
echo "BACKUP_WRITTEN=$out"
echo "BACKUP_BYTES=$(wc -c < "$out")"
echo "BACKUP_SHA256=$(cut -d ' ' -f1 "$out.sha256")"
echo "BACKUP_CATALOG_OK=true"
