#!/usr/bin/env bash
#
# Apply pending migrations to the hosted Supabase project (ARCH-5).
#
# `supabase db push` is the normal way to do this, but it shells out to a
# containerised psql and Docker Desktop isn't installed on this machine. This
# script does the same job over the Management API instead: it runs every file
# in supabase/migrations/ that isn't already recorded in
# supabase_migrations.schema_migrations, and records each one as it applies it.
# That's the same bookkeeping table the CLI uses, so `supabase migration list`
# stays accurate and a later `db push` won't try to re-run anything.
#
# Auth: SUPABASE_ACCESS_TOKEN if set, otherwise the CLI's macOS Keychain entry.
# The token is never printed.
#
# Usage:
#   ./supabase/apply-migrations.sh            # apply pending migrations
#   ./supabase/apply-migrations.sh --dry-run  # list them without applying
#
set -euo pipefail

PROJECT_REF=dzajismvbgrkxjsouewl
MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/migrations"
DRY_RUN=${1:-}

TOKEN=${SUPABASE_ACCESS_TOKEN:-$(security find-generic-password -s "Supabase CLI" -w 2>/dev/null || true)}
if [ -z "$TOKEN" ]; then
    echo "No Supabase access token. Set SUPABASE_ACCESS_TOKEN or run 'supabase login'." >&2
    exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# run_sql <file> [read_only]
run_sql() {
    local read_only=${2:-false}
    python3 - "$1" "$read_only" > "$tmp/payload.json" <<'PY'
import json, sys
print(json.dumps({"query": open(sys.argv[1]).read(), "read_only": sys.argv[2] == "true"}))
PY

    local response
    response=$(curl -sS -X POST \
        "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        --data-binary @"$tmp/payload.json")

    # The API returns a JSON array on success and an object with "message" on error.
    if printf '%s' "$response" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(1 if isinstance(d, dict) and "message" in d else 0)' 2>/dev/null; then
        printf '%s' "$response"
    else
        echo "SQL failed: $response" >&2
        return 1
    fi
}

cat > "$tmp/bootstrap.sql" <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);
SQL
run_sql "$tmp/bootstrap.sql" > /dev/null

applied=0
for file in "$MIGRATIONS_DIR"/*.sql; do
    base=$(basename "$file" .sql)
    version=${base%%_*}
    name=${base#*_}

    echo "select count(*) as n from supabase_migrations.schema_migrations where version = '$version';" \
        > "$tmp/check.sql"
    count=$(run_sql "$tmp/check.sql" true | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["n"])')

    if [ "$count" != "0" ]; then
        echo "  ok      $base"
        continue
    fi

    if [ "$DRY_RUN" = "--dry-run" ]; then
        echo "  pending $base"
        continue
    fi

    {
        cat "$file"
        printf "\ninsert into supabase_migrations.schema_migrations (version, name) values ('%s', '%s');\n" \
            "$version" "$name"
    } > "$tmp/run.sql"

    run_sql "$tmp/run.sql" > /dev/null
    echo "  applied $base"
    applied=$((applied + 1))
done

if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "Dry run — nothing was applied."
else
    echo "Done. $applied migration(s) applied."
    echo "Regenerate the TypeScript types next: (cd frontend && npm run types)"
fi
