#!/usr/bin/env bash
# Rebuilds a throwaway local database from the migrations, for tests.
#   scripts/local-db.sh "postgres://postgres@127.0.0.1:54329/postgres" onlyloafs_test
# Needs the psql command-line client and a PostgreSQL 15+ server you control.
set -euo pipefail
ADMIN_URL="${1:?admin connection URL}"; DB="${2:-onlyloafs_test}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
psql "$ADMIN_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists $DB" -c "create database $DB"
TARGET="${ADMIN_URL%/*}/$DB"
psql "$TARGET" -X -q -v ON_ERROR_STOP=1 -f "$HERE/supabase/local/shim.sql"
for file in "$HERE"/supabase/migrations/*.sql; do
  psql "$TARGET" -X -q -v ON_ERROR_STOP=1 -f "$file"
done
echo "$TARGET"
