#!/bin/sh
set -eu

PORT="${PORT:-8000}"
export APP_ENV="${APP_ENV:-production}"
DATA_DIR="${DATA_DIR:-/app/data}"

mkdir -p "$DATA_DIR/preview" "$DATA_DIR/publish"

default_secret="change-me-in-production"
example_secret="change-me-in-production-please-use-32b+"
if [ -z "${JWT_SECRET:-}" ] || [ "$JWT_SECRET" = "$default_secret" ] || [ "$JWT_SECRET" = "$example_secret" ]; then
  secret_file="$DATA_DIR/.jwt_secret"
  if [ -f "$secret_file" ]; then
    JWT_SECRET="$(cat "$secret_file")"
  else
    JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
    echo "$JWT_SECRET" > "$secret_file"
  fi
  export JWT_SECRET
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1 --timeout-keep-alive 75
