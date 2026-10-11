#!/usr/bin/env bash
set -Eeuo pipefail
# Requires DATABASE_URL, BACKUP_PASSPHRASE, S3_BUCKET, S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
# Never commit credentials or the plaintext dump.
for v in DATABASE_URL BACKUP_PASSPHRASE S3_BUCKET S3_ENDPOINT AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  if [[ -z "${!v:-}" ]]; then echo "Missing required secret: $v" >&2; exit 2; fi
done
umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
key="owl/postgres/${stamp}.dump.enc"
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$work/db.dump"
pg_restore --list "$work/db.dump" > "$work/archive.toc"
openssl enc -aes-256-cbc -pbkdf2 -iter 250000 -salt -in "$work/db.dump" -out "$work/db.dump.enc" -pass env:BACKUP_PASSPHRASE
sha256sum "$work/db.dump.enc" | awk '{print $1}' > "$work/sha256"
aws --endpoint-url "$S3_ENDPOINT" s3 cp "$work/db.dump.enc" "s3://$S3_BUCKET/$key" --no-progress
aws --endpoint-url "$S3_ENDPOINT" s3 cp "$work/sha256" "s3://$S3_BUCKET/$key.sha256" --no-progress
aws --endpoint-url "$S3_ENDPOINT" s3 cp "$work/archive.toc" "s3://$S3_BUCKET/$key.toc" --no-progress
echo "BACKUP_UPLOADED key=$key sha256=$(cat "$work/sha256")"
# BACKUP_UPLOADED is not evidence of a successful restore.
