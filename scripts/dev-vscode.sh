#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[오류] .env.local 파일이 없습니다."
  echo "먼저 cp .env.local.example .env.local 을 실행하고 SESSION_SECRET을 바꾸세요."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[오류] curl이 필요합니다. Ubuntu에서 sudo apt install curl 을 실행하세요."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DATABASE_URL:?DATABASE_URL을 .env.local에 설정하세요}"
: "${SESSION_SECRET:?SESSION_SECRET을 .env.local에 설정하세요}"

API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-3000}"
if [[ "$API_PORT" == "$WEB_PORT" ]]; then
  echo "[오류] API_PORT와 WEB_PORT는 서로 달라야 합니다."
  exit 1
fi

API_PID=""
WEB_PID=""
cleanup() {
  trap - EXIT INT TERM
  echo
  echo "[vscode] 개발 서버를 종료합니다."
  [[ -z "$WEB_PID" ]] || kill "$WEB_PID" 2>/dev/null || true
  [[ -z "$API_PID" ]] || kill "$API_PID" 2>/dev/null || true
  [[ -z "$WEB_PID" ]] || wait "$WEB_PID" 2>/dev/null || true
  [[ -z "$API_PID" ]] || wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[vscode] Starting local services (API ${API_PORT}, web ${WEB_PORT})"
(
  cd "$ROOT_DIR"
  PORT="$API_PORT" pnpm --filter @workspace/api-server run dev
) &
API_PID=$!

API_READY=false
for _ in $(seq 1 60); do
  if curl --silent --fail "http://127.0.0.1:${API_PORT}/api/healthz" >/dev/null; then
    API_READY=true
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    wait "$API_PID" || true
    echo "[오류] API 서버가 시작되지 않았습니다. DB 연결과 .env.local을 확인하세요."
    exit 1
  fi
  sleep 1
done

if [[ "$API_READY" != true ]]; then
  echo "[오류] API 준비 시간이 초과되었습니다. DB 상태와 API 로그를 확인하세요."
  exit 1
fi

(
  cd "$ROOT_DIR"
  PORT="$WEB_PORT" \
  BASE_PATH=/ \
  API_PROXY_TARGET="http://127.0.0.1:${API_PORT}" \
    pnpm --filter @workspace/job-doc-check run dev
) &
WEB_PID=$!

WEB_READY=false
for _ in $(seq 1 60); do
  if curl --silent --fail "http://127.0.0.1:${WEB_PORT}/" >/dev/null; then
    WEB_READY=true
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    wait "$WEB_PID" || true
    echo "[오류] 웹 서버가 시작되지 않았습니다. WEB_PORT를 확인하세요."
    exit 1
  fi
  sleep 1
done

if [[ "$WEB_READY" != true ]]; then
  echo "[오류] 웹 서버 준비 시간이 초과되었습니다."
  exit 1
fi

echo "[vscode] Ready: http://localhost:${WEB_PORT}"
echo "[vscode] API health: http://localhost:${API_PORT}/api/healthz"
echo "[vscode] 이 터미널에서 Ctrl+C를 누르면 개발 서버가 종료됩니다."

wait -n "$API_PID" "$WEB_PID" || true
