#!/usr/bin/env bash
set -Eeuo pipefail
# RESTORE_DATABASE_URL must point at a disposable, independent PostgreSQL database.
# Never point this script at a production database.
for v in RESTORE_DATABASE_URL BACKUP_PASSPHRASE S3_BUCKET S3_ENDPOINT BACKUP_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  if [[ -z "${!v:-}" ]]; then echo "Missing $v" >&2; exit 2; fi
done
if [[ "${DATABASE_URL:-}" == "$RESTORE_DATABASE_URL" ]]; then echo "Refusing identical source/destination" >&2; exit 3; fi
umask 077
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$S3_BUCKET/$BACKUP_KEY" "$dir/archive.enc" --no-progress
aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://$S3_BUCKET/$BACKUP_KEY.sha256" "$dir/sha256" --no-progress
echo "$(cat "$dir/sha256")  $dir/archive.enc" | sha256sum --check --status
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -in "$dir/archive.enc" -out "$dir/archive.dump" -pass env:BACKUP_PASSPHRASE
pg_restore --list "$dir/archive.dump" > /dev/null
pg_restore --dbname="$RESTORE_DATABASE_URL" --no-owner --no-acl --exit-on-error "$dir/archive.dump"
psql "$RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc "select current_database(), count(*) from pg_class where relkind='r';"
echo "RESTORE_VERIFIED key=$BACKUP_KEY encrypted_sha256=$(cat "$dir/sha256")"
