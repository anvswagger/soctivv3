#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/supabase/migrations"

if [ ! -d "${MIGRATIONS_DIR}" ]; then
  echo "Missing supabase/migrations directory." >&2
  exit 1
fi

mapfile -t files < <(ls -1 "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | xargs -n1 basename | sort)

if [ "${#files[@]}" -eq 0 ]; then
  echo "No migrations found." >&2
  exit 1
fi

prev=""
for f in "${files[@]}"; do
  if [[ ! "${f}" =~ ^[0-9]{14}_.+\.sql$ ]]; then
    echo "Invalid migration filename: ${f}" >&2
    exit 1
  fi
  ts="${f:0:14}"
  if [ -n "${prev}" ] && [ "${ts}" -le "${prev}" ]; then
    echo "Non-monotonic migration order: ${prev} -> ${ts} (${f})" >&2
    exit 1
  fi
  prev="${ts}"
done

echo "Migration filenames are ordered and valid."

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_PROJECT_REF:-}" ] || [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "Missing Supabase secrets for diff check. Set SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD." >&2
  exit 1
fi

cd "${ROOT_DIR}"
npx --yes supabase@latest link --project-ref "${SUPABASE_PROJECT_REF}"

diff_output="$(npx --yes supabase@latest db diff --linked --schema public)"
if [ -n "${diff_output}" ]; then
  echo "Schema drift detected between migrations and linked database:" >&2
  echo "${diff_output}" >&2
  exit 1
fi

echo "Supabase schema matches migrations."
