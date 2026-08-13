# Docker 배포 가이드 — AI 서류 심사관 (ATS)

## 시스템 요구사항

| 구분 | 사양 |
|------|------|
| Web 서버 | vCore 4, RAM 8 GB |
| DB 서버  | vCore 4, RAM 8 GB |
| OS       | Rocky Linux 9 / RHEL 9 / Ubuntu 22.04 |
| Docker   | 24.0 이상 |
| Docker Compose | 2.20 이상 |

---

## 구성 옵션

### A. 단일 서버 (개발/테스트)

Web과 DB를 한 서버에서 운영합니다.

```
서버 (8 vCore / 16 GB+)
  ├── ats-db   컨테이너 (PostgreSQL)
  └── ats-app  컨테이너 (Node.js + Nginx)
```

### B. 분리 서버 (운영 권장) ← 이 가이드 기준

```
Web VM (4 vCore / 8 GB)          DB VM (4 vCore / 8 GB)
  ├── ats-app  (Node.js + Nginx)    └── ats-db  (PostgreSQL)
  └── ← 내부망으로 DB VM 연결 →
```

---

## 빠른 시작

### 1단계 — 환경변수 설정

```bash
cp .env.example .env
vi .env
```

변경 필수 항목:
- `POSTGRES_PASSWORD` — DB 비밀번호
- `SESSION_SECRET` — 최소 32자 랜덤 문자열 (`openssl rand -hex 32`)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API 키

### 2단계 — 이미지 빌드

```bash
# 단일 서버
docker compose build

# 또는 Web VM에서만
docker compose -f docker-compose.web.yml build
```

빌드는 약 5~10분 소요됩니다 (pnpm install + Vite + esbuild).

> **베이스 이미지**: 런타임은 `node:22-slim`(Debian) 기반입니다.
> Nginx·tini·curl과 함께 **`poppler-utils`(pdftoppm)** 를 설치합니다 — 스캔(이미지) PDF 이력서 OCR 폴백에 필요합니다.

### 3단계 — DB 마이그레이션 (최초 1회)

```bash
# 단일 서버
docker compose run --rm migrate

# Web VM에서 (외부 DB 연결)
docker compose -f docker-compose.web.yml run --rm migrate
```

### 4단계 — 서비스 시작

```bash
# 단일 서버
docker compose up -d

# 별도 VM
# DB VM:
docker compose -f docker-compose.db.yml up -d

# Web VM:
docker compose -f docker-compose.web.yml up -d
```

---

## 분리 VM 구성 상세

### DB VM 설정

**.env (DB VM)**
```env
POSTGRES_DB=atsdb
POSTGRES_USER=ats_user
POSTGRES_PASSWORD=your_strong_password
DB_PORT=5432
```

**실행:**
```bash
docker compose -f docker-compose.db.yml up -d
```

**방화벽 설정 (DB VM):**
```bash
# Rocky Linux / RHEL
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="<Web VM IP>" port port="5432" protocol="tcp" accept'
firewall-cmd --reload

# Ubuntu
ufw allow from <Web VM IP> to any port 5432
```

---

### Web VM 설정

**.env (Web VM)**
```env
# DB VM 내부망 IP로 설정
DATABASE_URL=postgresql://ats_user:your_strong_password@<DB VM 내부망 IP>:5432/atsdb

SESSION_SECRET=your_32char_random_string
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-xxx
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

APP_PORT=80
```

**실행:**
```bash
# 마이그레이션 (최초 1회)
docker compose -f docker-compose.web.yml run --rm migrate

# 앱 시작
docker compose -f docker-compose.web.yml up -d
```

---

## HTTPS / 리버스 프록시 구성

- 앱은 `trust proxy`를 활성화하고 **세션 쿠키 `secure: "auto"`** 로 동작합니다.
  - HTTP 접속(로컬·온프렘 평문): 쿠키 `Secure` 미적용 → 로그인 정상 동작
  - HTTPS 접속(상위 LB/프록시에서 TLS 종료): `X-Forwarded-Proto: https` 를 신뢰해 자동으로 `Secure` 쿠키 적용
- 컨테이너 내 Nginx는 상위 프록시가 보낸 **`X-Forwarded-Proto` 를 그대로 패스스루**하고, 없으면 자신의 `$scheme` 으로 설정합니다.
- 따라서 앞단에 별도 TLS 종료 프록시(LB, Cloudflare 등)를 두는 구성에서도 세션·쿠키가 올바르게 동작합니다.

---

## 운영 명령어

### 로그 확인

```bash
# 전체 로그
docker compose logs -f

# 앱만
docker compose logs -f app

# 마지막 100줄
docker compose logs --tail=100 app
```

### 서비스 상태

```bash
docker compose ps
docker stats
```

### 재시작

```bash
docker compose restart app
```

### 업데이트 배포

```bash
# 새 버전 빌드
docker compose build app

# 마이그레이션 실행 (스키마 변경 시)
docker compose run --rm migrate

# 무중단 재시작
docker compose up -d --no-deps app
```

### DB 수동 마이그레이션

스키마가 변경되었을 때:
```bash
docker compose run --rm migrate
```

---

## 성능 튜닝 적용값

설치 스크립트(`install.sh`) 동일 계산식 기준 — **4 vCore / 8 GB 전용 서버**:

### PostgreSQL (DB 컨테이너)

| 파라미터 | 값 | 계산 근거 |
|----------|----|----|
| `shared_buffers` | 2 GB | RAM × 25% |
| `effective_cache_size` | 6 GB | RAM × 75% |
| `maintenance_work_mem` | 410 MB | RAM × 5% |
| `work_mem` | 15360 kB | (RAM - shared_buffers) × 50% / max_conn |
| `max_connections` | 200 | 운영 기본값 |
| `wal_buffers` | 64 MB | shared_buffers × 3% |
| `max_worker_processes` | 4 | vCore 수 |
| `max_parallel_workers` | 4 | vCore 수 |
| `max_parallel_workers_per_gather` | 2 | vCore / 2 |
| `min_wal_size` | 1 GB | — |
| `max_wal_size` | 4 GB | — |

### Node.js (App 컨테이너)

| 파라미터 | 값 | 계산 근거 |
|----------|----|----|
| `--max-old-space-size` | 6144 MB | RAM × 75% |
| `UV_THREADPOOL_SIZE` | 8 | vCore × 2 |

---

## 디렉토리 구조

```
프로젝트 루트/
├── Dockerfile                  # 멀티스테이지 빌드
├── docker-compose.yml          # 단일 서버 (통합)
├── docker-compose.web.yml      # Web VM 전용
├── docker-compose.db.yml       # DB VM 전용
├── .env.example                # 환경변수 템플릿
└── docker/
    ├── nginx.conf              # Nginx 설정
    ├── entrypoint.sh           # 컨테이너 시작 스크립트
    └── migrate.sh              # DB 마이그레이션 스크립트
```

---

## 트러블슈팅

### 앱이 시작되지 않을 때

```bash
# 로그 확인
docker compose logs app

# 컨테이너 내부 접속
docker compose exec app sh
```

### DB 연결 오류

```bash
# DB 상태 확인
docker compose exec db pg_isready -U ats_user -d atsdb

# 연결 테스트
docker compose exec app node -e "
  const pg = require('./node_modules/pg');
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => { console.log('OK'); c.end(); }).catch(console.error);
"
```

### 이미지 재빌드 (캐시 무시)

```bash
docker compose build --no-cache app
```

### 볼륨 데이터 초기화 (주의: 데이터 삭제)

```bash
docker compose down -v
```
