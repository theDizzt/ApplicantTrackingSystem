# Ubuntu Linux VM 배포 가이드 — AI 서류 심사관 (ATS)

## 시스템 요구사항

| 구분 | 사양 |
|------|------|
| Web 서버 | vCore 4, RAM 8 GB |
| DB 서버  | vCore 4, RAM 8 GB |
| OS       | Ubuntu Server 22.04/24.04 LTS 권장 |
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
- `DATABASE_URL` — 개발 PC용 줄(`127.0.0.1`) 대신 주석 처리된 Docker용 줄(`@db:5432`)을 사용하고, 비밀번호를 `POSTGRES_PASSWORD`와 맞춤
- `POSTGRES_PASSWORD` — DB 비밀번호
- `SESSION_SECRET` — 최소 32자 랜덤 문자열 (`openssl rand -hex 32`)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API 키
- `ADMIN_USERNAME` — 관리자 포털 아이디
- `ADMIN_PASSWORD_HASH` — bcrypt 비밀번호 해시

관리자 비밀번호 해시 생성 예:

```bash
sudo apt-get install -y apache2-utils
htpasswd -bnBC 12 "" '사용할 강력한 비밀번호' | tr -d ':\n'; echo
```

선택 항목:
- `MISTRAL_API_KEY` — 선택 사항. 설정 시 스캔·이미지 문서 OCR에 Mistral OCR을 우선 사용합니다(미설정 시 비전 모델 OCR 폴백).

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

### 3단계 — DB 마이그레이션

```bash
# 단일 서버
docker compose run --rm migrate

# Web VM에서 (외부 DB 연결)
docker compose -f docker-compose.web.yml run --rm migrate
```

현재 저장소는 버전 파일 기반 마이그레이션이 아니라 Drizzle `push`를 사용합니다. 따라서 다음 원칙을 지킵니다.

1. 운영 스키마 변경 전 `pg_dump` 백업
2. 앱 이미지 빌드
3. `migrate`가 성공한 경우에만 앱 시작
4. `/healthz` 200 확인

`docker compose up`도 `migrate` 완료를 앱의 시작 조건으로 사용합니다. 스키마가 없거나 마이그레이션이 실패하면 앱은 정상 상태로 시작하지 않습니다.

### 4단계 — 서비스 시작

```bash
# 단일 서버
docker compose up -d

# 별도 VM: 반드시 DB를 먼저 시작하고 health를 확인
# DB VM:
docker compose -f docker-compose.db.yml up -d
docker compose -f docker-compose.db.yml ps

# Web VM: 마이그레이션 후 앱 시작
docker compose -f docker-compose.web.yml run --rm migrate
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
DB_HOST=<DB VM 사설 IP>
DB_PORT=5432
```

`DB_HOST`는 `0.0.0.0`이 아니라 Web VM에서 도달 가능한 **DB VM 사설 IP**로 지정합니다. 단일 VM에서는 기본값 `127.0.0.1`을 유지합니다.

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
ufw deny 5432/tcp
```

클라우드 보안 그룹에서도 TCP 5432의 소스를 Web VM 사설 IP 또는 Web 보안 그룹으로만 제한합니다. 공인 인터넷(`0.0.0.0/0`)에는 열지 않습니다.

---

### Web VM 설정

**.env (Web VM)**
```env
# DB VM 내부망 IP로 설정
DATABASE_URL=postgresql://ats_user:your_strong_password@<DB VM 내부망 IP>:5432/atsdb

SESSION_SECRET=your_32char_random_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt hash>
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-xxx
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# 선택 사항 — 설정 시 Mistral OCR 우선 사용 (미설정 시 비전 모델 OCR 폴백)
# MISTRAL_API_KEY=xxx

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

> 도메인 인증서 자동 발급(`docker-compose.https.yml` + Caddy), Cloudflare Tunnel, Certbot 등 **단계별 설정 방법은 [HTTPS.md](HTTPS.md)** 에 정리되어 있습니다.
>
> ```bash
> # .env 에 DOMAIN, ACME_EMAIL 설정 후
> docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
> ```

- 앱은 `trust proxy`를 활성화하고 **세션 쿠키 `secure: "auto"`** 로 동작합니다.
  - HTTP 접속(로컬·온프렘 평문): 쿠키 `Secure` 미적용 → 로그인 정상 동작
  - HTTPS 접속(상위 LB/프록시에서 TLS 종료): `X-Forwarded-Proto: https` 를 신뢰해 자동으로 `Secure` 쿠키 적용
- 컨테이너 내 Nginx는 상위 프록시가 보낸 **`X-Forwarded-Proto` 를 그대로 패스스루**하고, 없으면 자신의 `$scheme` 으로 설정합니다.
- 따라서 앞단에 별도 TLS 종료 프록시(LB, Cloudflare 등)를 두는 구성에서도 세션·쿠키가 올바르게 동작합니다.
- 외부 프록시는 클라이언트가 임의로 보낸 전달 헤더를 제거한 뒤 신뢰할 수 있는 `X-Forwarded-Proto`와 `X-Forwarded-For`를 새로 설정해야 합니다.
- Node API의 8080 포트는 외부에 공개하지 않고 같은 컨테이너/호스트의 Nginx만 접근하게 합니다.

### 업로드와 타임아웃

- 오디오 업로드: 최대 50MB
- 브라우저 녹음: 최대 10분
- ffmpeg 정규화: 최대 90초
- API 인스턴스당 동시 음성 처리: 2건(초과 시 HTTP 429 및 `Retry-After`)
- PDF 텍스트 변환과 스캔 PDF 렌더링: 각각 최대 60초
- Docker Nginx와 Ubuntu 직접 설치 Nginx: `client_max_body_size 50m`
- AI 요청 프록시 타임아웃: 600초
- 음성 원본과 변환 파일은 임시 처리 후 삭제하며 영구 업로드 볼륨에 보관하지 않습니다.

---

## 상태 확인

```bash
curl -fsS http://127.0.0.1/healthz
```

`/healthz`는 단순 Nginx 응답이 아닙니다. Nginx가 Node API로 요청을 전달하고 API가 PostgreSQL에 `select 1`을 성공해야 HTTP 200을 반환합니다. DB 연결 실패 시 503입니다.

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
# 1. DB 백업
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-ats_user}" \
  -d "${POSTGRES_DB:-atsdb}" -Fc > "backup-$(date +%F-%H%M).dump"

# 2. 새 버전 빌드
docker compose build app

# 3. 마이그레이션 실행
docker compose run --rm migrate

# 4. 앱 재시작 후 준비 상태 확인
docker compose up -d --no-deps app
curl -fsS http://127.0.0.1/healthz
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

## 백업과 복구

### PostgreSQL 백업

```bash
mkdir -p backups
chmod 700 backups
docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-ats_user}" \
  -d "${POSTGRES_DB:-atsdb}" \
  -Fc > "backups/atsdb-$(date +%F-%H%M%S).dump"
```

백업 파일은 같은 VM에만 두지 말고 암호화된 별도 저장소로 복제하며 정기적으로 복구 연습을 합니다.

### PostgreSQL 복구

복구는 기존 데이터를 덮을 수 있는 파괴적 작업입니다. 유지보수 시간을 확보하고 현재 DB를 한 번 더 백업한 뒤 실행합니다.

```bash
docker compose stop app
cat backups/atsdb-YYYY-MM-DD-HHMMSS.dump | \
  docker compose exec -T db pg_restore \
    -U "${POSTGRES_USER:-ats_user}" \
    -d "${POSTGRES_DB:-atsdb}" \
    --clean --if-exists --no-owner
docker compose up -d app
curl -fsS http://127.0.0.1/healthz
```

분리형 DB VM에서는 DB VM에서 같은 명령을 실행하거나 `pg_dump`/`pg_restore`에 내부망 호스트를 지정합니다.

### 업로드 볼륨 백업

음성 원본은 영구 저장하지 않지만, `uploads` 볼륨에 다른 사용자 파일이 추가될 수 있으므로 함께 백업합니다.

```bash
docker run --rm \
  -v ats_uploads:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'tar czf /backup/uploads-$(date +%F-%H%M%S).tar.gz -C /data .'
```

실제 볼륨 이름은 `docker volume ls`로 확인합니다.

---

## Docker 없이 Ubuntu에 직접 설치

저장소 루트에서 다음을 실행합니다.

```bash
sudo bash install.sh
```

설치 스크립트는 Node.js 22, pnpm 10, PostgreSQL, Nginx, poppler-utils, ffmpeg를 설치하고, DB 스키마 적용과 프론트/API 빌드를 순서대로 수행합니다. 관리자 아이디와 8자 이상의 비밀번호를 입력받아 bcrypt 해시만 `.env`에 저장합니다. (예전 `.env.production`이 있으면 `.env`로 이름을 바꿔 그대로 씁니다.)

직접 설치 후 확인:

```bash
sudo systemctl status my-ats-api nginx
curl -fsS http://127.0.0.1/api/healthz
```

TLS를 Nginx에서 직접 종료하려면 Certbot 등으로 인증서를 구성하고 HTTP를 HTTPS로 리디렉션합니다. 클라우드 로드밸런서에서 TLS를 종료한다면 신뢰할 수 있는 `X-Forwarded-Proto: https`가 Nginx까지 보존되어야 합니다.

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

이 명령은 PostgreSQL과 업로드 볼륨을 영구 삭제합니다. 초기화가 명확히 필요한 경우에만, 백업과 복구 가능 여부를 확인한 뒤 실행합니다.
