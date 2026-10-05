#!/usr/bin/env bash
set -euo pipefail

# Backs up the Postgres database and the local object-storage directory.
# Exists because of the tradeoff documented in docs/ARCHITECTURE.md §O:
# storage is on local disk instead of S3 (no cloud spend), which means
# there is zero redundancy unless something backs it up. Run this on a
# schedule — see the crontab example in the root README.
#
# Usage:
#   ./infra/backup.sh
#
# Env overrides:
#   BACKUP_DIR       Where backups are written. Defaults to a sibling
#                     directory OUTSIDE this repo (../homeinterior-backups)
#                     so `rm -rf` on the repo can't take backups with it.
#                     For real disaster recovery, point this at a second
#                     disk or a cheap off-site target — a sibling
#                     directory on the same disk does not survive a disk
#                     failure, only a repo-level mistake.
#   STORAGE_ROOT      Defaults to <repo>/storage (matches apps/api/.env's
#                     default of "../../storage" resolved from apps/api/).
#   RETENTION_DAYS    Local backups older than this are pruned. Default 14.
#   DATABASE_URL      Read from apps/api/.env if not already exported.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/../homeinterior-backups}"
STORAGE_ROOT="${STORAGE_ROOT:-$ROOT_DIR/storage}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$ROOT_DIR/apps/api/.env" ]; then
  # Extract just this one line rather than sourcing the whole file — .env
  # also sets STORAGE_ROOT to a path relative to apps/api/, which would
  # silently clobber this script's own (repo-root-relative) default above.
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$ROOT_DIR/apps/api/.env" | cut -d= -f2- | tr -d "\"'")"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set and apps/api/.env was not found — export it first." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Prisma's DATABASE_URL carries a `?schema=...` query param that Prisma
# itself understands but libpq (and therefore pg_dump) does not — strip
# the query string entirely; the schema defaults to "public" either way.
PG_DUMP_URL="${DATABASE_URL%%\?*}"

echo "==> Dumping Postgres to $BACKUP_DIR/db-$TIMESTAMP.sql.gz"
pg_dump "$PG_DUMP_URL" --no-owner --no-privileges | gzip > "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

if [ -d "$STORAGE_ROOT" ]; then
  echo "==> Archiving $STORAGE_ROOT to $BACKUP_DIR/storage-$TIMESTAMP.tar.gz"
  tar -czf "$BACKUP_DIR/storage-$TIMESTAMP.tar.gz" -C "$(dirname "$STORAGE_ROOT")" "$(basename "$STORAGE_ROOT")"
else
  echo "==> Skipping storage archive — $STORAGE_ROOT does not exist"
fi

echo "==> Pruning backups older than $RETENTION_DAYS days in $BACKUP_DIR"
find "$BACKUP_DIR" -maxdepth 1 -name '*.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "==> Done. Current backups:"
ls -lh "$BACKUP_DIR"
