#!/bin/sh
# =============================================================================
# 컨테이너 엔트리포인트
# 순서: DB 연결 대기 → DB 스키마 마이그레이션 → Node.js 시작 → Nginx 시작
# =============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[entrypoint]${NC} $*"; }
ok()   { echo -e "${GREEN}[entrypoint]${NC} $*"; }
warn() { echo -e "${YELLOW}[entrypoint]${NC} $*"; }
err()  { echo -e "${RED}[entrypoint]${NC} $*" >&2; }

# ── 필수 환경변수 확인 ────────────────────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
    err "DATABASE_URL 환경변수가 설정되지 않았습니다."
    exit 1
fi
if [ -z "$SESSION_SECRET" ]; then
    err "SESSION_SECRET 환경변수가 설정되지 않았습니다."
    exit 1
fi

# ── PostgreSQL 연결 대기 ──────────────────────────────────────────────────────
log "PostgreSQL 연결 대기 중..."

MAX_RETRIES=30
RETRY=0
until node -e "
  const pg = require('/app/node_modules/pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  client.connect()
    .then(() => { client.end(); process.exit(0); })
    .catch(() => process.exit(1));
" 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        err "PostgreSQL에 연결할 수 없습니다 (${MAX_RETRIES}회 시도). DATABASE_URL을 확인하세요."
        exit 1
    fi
    warn "  DB 연결 대기 중... (${RETRY}/${MAX_RETRIES})"
    sleep 2
done
ok "PostgreSQL 연결 성공"

# ── DB 스키마 마이그레이션 ────────────────────────────────────────────────────
# drizzle-kit push가 없으므로 SQL로 직접 테이블 존재 여부를 확인 후 초기 마이그레이션 안내
log "DB 스키마 확인 중..."

TABLES_EXIST=$(node -e "
  const pg = require('/app/node_modules/pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  client.connect().then(async () => {
    const res = await client.query(
      \"SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'\"
    );
    client.end();
    console.log(res.rows[0].cnt);
  }).catch(e => { console.error(e.message); process.exit(1); });
" 2>/dev/null || echo "0")

if [ "$TABLES_EXIST" = "0" ]; then
    warn "DB 스키마가 없습니다. 마이그레이션을 실행하세요:"
    warn "  docker compose exec app sh /app/migrate.sh"
    warn "  (앱은 계속 시작됩니다. 스키마 없이 API 호출 시 오류가 발생합니다)"
else
    ok "DB 스키마 확인 완료 (users 테이블 존재)"
fi

# ── Node.js API 서버 시작 ─────────────────────────────────────────────────────
log "Node.js API 서버 시작 중 (port 8080)..."
export PORT=8080
export NODE_ENV=production

node --enable-source-maps /app/dist/index.mjs &
NODE_PID=$!

# API 서버 준비 대기
log "API 서버 헬스체크 대기 중..."
RETRY=0
until curl -sf http://127.0.0.1:8080/api/healthz > /dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge 30 ]; then
        err "API 서버가 시작되지 않았습니다. 로그를 확인하세요."
        kill $NODE_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
ok "API 서버 준비 완료"

# ── Nginx 시작 ────────────────────────────────────────────────────────────────
log "Nginx 시작 중 (port 80)..."
nginx -t 2>&1 && ok "Nginx 설정 검증 통과"
nginx -g "daemon off;" &
NGINX_PID=$!
ok "Nginx 시작 완료"

ok "=== 서비스 시작 완료 ==="
log "  프론트엔드: http://0.0.0.0:80"
log "  API 서버:   http://0.0.0.0:8080/api"
log "  Node PID:   $NODE_PID"
log "  Nginx PID:  $NGINX_PID"

# PID 파일 저장 (재시작/헬스체크용)
echo $NODE_PID > /tmp/node.pid
echo $NGINX_PID > /tmp/nginx.pid

# 두 프로세스 중 하나라도 종료되면 컨테이너 종료
wait $NODE_PID $NGINX_PID
