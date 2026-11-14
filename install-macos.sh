#!/bin/bash
# =========================================================
# AI 서류 심사관 — macOS 개발 환경 설정 스크립트
# 대상: macOS (Apple Silicon / Intel), Homebrew 기반
# 용도: 개발·테스트 환경 구성 (운영 배포는 리눅스 + install.sh 사용)
#
# 사용법:
#   chmod +x install-macos.sh && ./install-macos.sh
#
# 완료 후 실행:
#   ./dev-macos.sh
# =========================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
# 예전 이름(.env.development)을 쓰던 경우 .env 하나로 합친다
if [ ! -f "${INSTALL_DIR}/.env" ] && [ -f "${INSTALL_DIR}/.env.development" ]; then
    mv "${INSTALL_DIR}/.env.development" "${INSTALL_DIR}/.env"
    echo "[안내] .env.development 파일을 .env로 이름을 바꿨습니다."
fi
DB_NAME="${DB_NAME:-ats_checker_dev}"
DB_USER="$(whoami)"   # Homebrew PostgreSQL은 현재 macOS 사용자 계정으로 접속
PG_VERSION="${PG_VERSION:-16}"
ENV_FILE="${INSTALL_DIR}/.env"

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN} AI 서류 심사관 — macOS 개발 환경 설정${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# ----------------------------------------
# 0. macOS 확인
# ----------------------------------------
if [ "$(uname)" != "Darwin" ]; then
    echo -e "${RED}[오류] 이 스크립트는 macOS 전용입니다. 리눅스에서는 install.sh를 사용하세요.${NC}"
    exit 1
fi

# ----------------------------------------
# 1. Homebrew
# ----------------------------------------
echo -e "${CYAN}[1/5] Homebrew 확인${NC}"
if ! command -v brew >/dev/null 2>&1; then
    echo -e "${YELLOW}  Homebrew가 없습니다. 설치를 시작합니다...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Apple Silicon 기본 경로 반영
    if [ -d /opt/homebrew/bin ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
fi
echo -e "  ${GREEN}Homebrew 준비 완료${NC}"
echo ""

# ----------------------------------------
# 2. Node.js 20+ / pnpm
# ----------------------------------------
echo -e "${CYAN}[2/5] Node.js / pnpm 설치${NC}"
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
fi
if [ "$NODE_MAJOR" -lt 20 ]; then
    brew install node@22 || brew install node
    brew link --overwrite node@22 2>/dev/null || true
fi
command -v pnpm >/dev/null 2>&1 || brew install pnpm
# poppler(pdftoppm): 스캔(이미지) PDF 이력서 OCR 폴백에 필요
command -v pdftoppm >/dev/null 2>&1 || brew install poppler
echo -e "  node: ${GREEN}$(node -v)${NC}, pnpm: ${GREEN}$(pnpm -v)${NC}"
echo ""

# ----------------------------------------
# 3. PostgreSQL
# ----------------------------------------
echo -e "${CYAN}[3/5] PostgreSQL 설치 및 시작${NC}"
if ! brew list "postgresql@${PG_VERSION}" >/dev/null 2>&1; then
    brew install "postgresql@${PG_VERSION}"
fi
brew services start "postgresql@${PG_VERSION}" >/dev/null

# psql 경로 보장 (keg-only 대응)
PG_BIN="$(brew --prefix)/opt/postgresql@${PG_VERSION}/bin"
export PATH="${PG_BIN}:$PATH"

# DB가 뜰 때까지 대기 (최대 15초)
for i in $(seq 1 15); do
    if "${PG_BIN}/pg_isready" -q 2>/dev/null; then break; fi
    sleep 1
done
if ! "${PG_BIN}/pg_isready" -q 2>/dev/null; then
    echo -e "${RED}[오류] PostgreSQL이 시작되지 않았습니다. 'brew services list'로 상태를 확인하세요.${NC}"
    exit 1
fi

# 데이터베이스 생성 (이미 있으면 건너뜀)
if ! "${PG_BIN}/psql" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    "${PG_BIN}/createdb" "${DB_NAME}"
    echo -e "  데이터베이스 ${GREEN}${DB_NAME}${NC} 생성 완료"
else
    echo -e "  데이터베이스 ${GREEN}${DB_NAME}${NC} 이미 존재 — 재사용"
fi
DATABASE_URL="postgres://${DB_USER}@localhost:5432/${DB_NAME}"
echo ""

# ----------------------------------------
# 4. 환경변수 파일 (.env)
# ----------------------------------------
echo -e "${CYAN}[4/5] 환경변수 설정${NC}"
if [ -f "$ENV_FILE" ]; then
    echo -e "  ${YELLOW}기존 ${ENV_FILE} 발견 — 재사용합니다.${NC}"
    grep -q "^DATABASE_URL=" "$ENV_FILE" || echo "DATABASE_URL=${DATABASE_URL}" >> "$ENV_FILE"
else
    SESSION_SECRET=$(openssl rand -hex 32)
    cat > "$ENV_FILE" <<EOF
NODE_ENV=development
PORT=8080
DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
EOF
    chmod 600 "$ENV_FILE"
    echo -e "  ${GREEN}${ENV_FILE} 생성 완료${NC}"
fi
echo -e "  ${YELLOW}AI API 키는 실행 후 관리자 페이지(/admin → AI 설정)에서 등록하세요.${NC}"
echo ""

# ----------------------------------------
# 5. 의존성 설치 + DB 스키마 반영
# ----------------------------------------
echo -e "${CYAN}[5/5] 의존성 설치 및 DB 스키마 적용${NC}"
cd "$INSTALL_DIR"
pnpm install
DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run push
echo -e "  ${GREEN}완료${NC}"
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} 설정 완료!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e " 개발 서버 실행:  ${CYAN}./dev-macos.sh${NC}"
echo -e "   - 웹:  http://localhost:3000"
echo -e "   - API: http://localhost:8080/api/healthz"
echo ""
