---
name: 로컬/온프렘 배포 함정
description: Docker(Alpine)·로컬 HTTP 설치에서 빌드/로그인이 깨지는 두 가지 원인과 규칙
---

## 규칙 1: Docker 이미지는 반드시 glibc(Debian) 계열 사용
`pnpm-workspace.yaml`의 overrides가 musl 네이티브 바이너리(`@rollup/rollup-linux-x64-musl` 등)를 전부 제외한다.
**Why:** Replit(글리브시) 최적화를 위한 설정이라 Alpine(node:*-alpine)에서 `pnpm install --frozen-lockfile` 후 vite build가 MODULE_NOT_FOUND로 실패한다.
**How to apply:** Dockerfile은 `node:*-slim`(Debian) 기반 유지. Alpine으로 되돌리지 말 것. Debian에서는 tini 경로가 `/usr/bin/tini`.

## 규칙 2: 세션 쿠키는 `secure: "auto"` + X-Forwarded-Proto 패스스루
**Why:** `secure: isProduction`이면 로컬/온프렘 HTTP 설치(NODE_ENV=production, TLS 없음)에서 브라우저가 쿠키를 버려 로그인·회원가입이 조용히 실패한다.
**How to apply:** express-session cookie.secure="auto" 유지. nginx(도커·install.sh 둘 다)는 상위 프록시가 보낸 X-Forwarded-Proto가 있으면 유지하고 없을 때만 `$scheme`을 쓰는 map을 사용 — 무조건 `$scheme`으로 덮으면 상위 TLS 종료 환경에서 Secure 플래그가 빠진다.
