#!/bin/sh
# =============================================================================
# DB 스키마 마이그레이션 실행 스크립트
# 사용법: docker compose exec app sh /app/migrate.sh
# (또는) docker compose run --rm migrate
# =============================================================================
set -e

echo "=== DB 스키마 마이그레이션 ==="
echo "DATABASE_URL: ${DATABASE_URL%%@*}@***"

# drizzle-kit push는 TypeScript 환경 필요 → migrate 서비스에서 실행
# 이 스크립트는 migrate 서비스 컨테이너(builder 스테이지) 내에서 실행됩니다.
cd /workspace
DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run push

echo ""
echo "=== 마이그레이션 완료 ==="
