#!/bin/bash
# One-command start: build frontend, init DB, serve everything on :8000
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "No .env found — copying .env.example (LLM_MOCK=true)."
  cp .env.example .env
fi

echo "==> Building frontend..."
cd "$ROOT/frontend"
npm install
npm run build

echo "==> Installing backend deps..."
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -r requirements.txt

echo "==> Initializing database..."
python -c "from app.models import init_db; init_db()"

echo "==> Starting server on :8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
