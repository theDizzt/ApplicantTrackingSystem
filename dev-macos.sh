#!/bin/bash
# =========================================================
# AI 서류 심사관 — macOS 개발 서버 실행 스크립트
# API 서버(8080)와 웹 프론트엔드(3000)를 함께 실행합니다.
# 종료: Ctrl+C (두 서버 모두 종료됨)
#
# 선행 조건: ./install-macos.sh 실행 완료
# =========================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
# 예전 이름(.env.development)을 쓰던 경우 .env 하나로 합친다
if [ ! -f "${INSTALL_DIR}/.env" ] && [ -f "${INSTALL_DIR}/.env.development" ]; then
    mv "${INSTALL_DIR}/.env.development" "${INSTALL_DIR}/.env"
    echo "[안내] .env.development 파일을 .env로 이름을 바꿨습니다."
fi
ENV_FILE="${INSTALL_DIR}/.env"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-3000}"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}[오류] ${ENV_FILE}이 없습니다. 먼저 ./install-macos.sh를 실행하세요.${NC}"
    exit 1
fi

# .env 로드
set -a
source "$ENV_FILE"
set +a
export PORT="$API_PORT"

cd "$INSTALL_DIR"

# Ctrl+C 시 자식 프로세스 정리
PIDS=()
cleanup() {
    echo ""
    echo -e "${CYAN}서버를 종료합니다...${NC}"
    for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo -e "${CYAN}[1/2] API 서버 시작 (포트 ${API_PORT})...${NC}"
pnpm --filter @workspace/api-server run dev &
PIDS+=($!)

# API 서버가 뜰 때까지 대기 (최대 60초 — 첫 실행은 빌드 포함)
for i in $(seq 1 60); do
    if curl -sf "http://localhost:${API_PORT}/api/healthz" >/dev/null 2>&1; then break; fi
    sleep 1
done
if curl -sf "http://localhost:${API_PORT}/api/healthz" >/dev/null 2>&1; then
    echo -e "  ${GREEN}API 서버 준비 완료${NC}"
else
    echo -e "${RED}[오류] API 서버가 시작되지 않았습니다. 위 로그를 확인하세요.${NC}"
    exit 1
fi

echo -e "${CYAN}[2/2] 웹 프론트엔드 시작 (포트 ${WEB_PORT})...${NC}"
# BASE_PATH=/ : 루트 경로 서빙, API_PROXY_TARGET : /api 요청을 API 서버로 전달
PORT="$WEB_PORT" BASE_PATH=/ API_PROXY_TARGET="http://localhost:${API_PORT}" \
    pnpm --filter @workspace/job-doc-check run dev &
PIDS+=($!)

sleep 2
# 개발용 HTTPS: .env에 DEV_HTTPS_CERT/DEV_HTTPS_KEY가 있으면 https로 뜬다 (docs/HTTPS.md)
WEB_SCHEME="http"
if [ -n "${DEV_HTTPS_CERT:-}" ]; then WEB_SCHEME="https"; fi
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} 개발 서버 실행 중${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "  웹:      ${CYAN}${WEB_SCHEME}://localhost:${WEB_PORT}${NC}"
echo -e "  API:     ${CYAN}http://localhost:${API_PORT}/api/healthz${NC}"
echo -e "  관리자:  ${CYAN}${WEB_SCHEME}://localhost:${WEB_PORT}/admin${NC}"
echo -e "  종료:    Ctrl+C"
echo ""

wait
