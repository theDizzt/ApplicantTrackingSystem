# HTTPS로 호스팅하기

My ATS를 `https://`로 서비스하는 방법을 정리한 문서입니다. 상황에 맞는 방법을 하나 고르면 됩니다.

## 목차

1. [어떤 방법을 고를까](#1-어떤-방법을-고를까)
2. [앱이 HTTPS에서 동작하는 원리](#2-앱이-https에서-동작하는-원리)
3. [방법 A — Docker + Caddy (도메인이 있는 서버, 운영 권장)](#3-방법-a--docker--caddy-도메인이-있는-서버-운영-권장)
4. [방법 B — Cloudflare Tunnel (공유기 포트 개방 없이 공개)](#4-방법-b--cloudflare-tunnel-공유기-포트-개방-없이-공개)
5. [방법 C — 개발 PC를 HTTPS로 (휴대폰에서 음성 녹음 테스트)](#5-방법-c--개발-pc를-https로-휴대폰에서-음성-녹음-테스트)
6. [방법 D — Docker 없이 Ubuntu에 직접 설치한 서버 (Certbot)](#6-방법-d--docker-없이-ubuntu에-직접-설치한-서버-certbot)
7. [설정이 잘 됐는지 확인하기](#7-설정이-잘-됐는지-확인하기)
8. [문제 해결](#8-문제-해결)
9. [보안 체크리스트](#9-보안-체크리스트)

---

## 1. 어떤 방법을 고를까

| 상황 | 추천 방법 | 도메인 | 공유기/방화벽 포트 개방 | 인증서 |
|---|---|---|---|---|
| 클라우드 VM·사내 서버에 Docker로 운영 | **A. Docker + Caddy** | 필요 | 80, 443 | Let's Encrypt 자동 발급·갱신 |
| 집·학교 PC에서 잠깐 외부에 보여 주기(시연) | **B. Cloudflare Tunnel** | 없어도 됨(임시 주소) | 필요 없음 | Cloudflare가 처리 |
| 같은 와이파이의 휴대폰으로 음성 녹음 테스트 | **C. 개발 PC HTTPS** | 필요 없음 | 필요 없음(같은 네트워크) | mkcert 로컬 인증서 |
| `install.sh`로 Ubuntu에 직접 설치한 서버 | **D. Certbot** | 필요 | 80, 443 | Let's Encrypt 자동 갱신 |

> **왜 HTTPS가 필요한가요?**
> - 로그인 세션 쿠키와 이력서 내용이 암호화되어 전송됩니다.
> - 브라우저는 **HTTPS(또는 localhost)에서만 마이크 사용을 허용**합니다. `http://192.168.0.10:3000`처럼 IP로 접속하면 **음성 자기소개서 녹음이 동작하지 않습니다.**

---

## 2. 앱이 HTTPS에서 동작하는 원리

앱 자체는 HTTP로 동작하고, **앞단의 프록시가 HTTPS를 처리(TLS 종료)** 하는 구조입니다. 앱 코드는 이미 이 구조에 맞춰져 있습니다.

```
브라우저 ──HTTPS──▶ Caddy / Cloudflare / Certbot-Nginx ──HTTP──▶ 컨테이너 Nginx(:80) ──▶ Node API(:8080)
                     (인증서, X-Forwarded-Proto: https 설정)        (헤더를 그대로 전달)        (trust proxy, Secure 쿠키)
```

| 구성 요소 | 설정 | 역할 |
|---|---|---|
| 앞단 프록시 | `X-Forwarded-Proto: https` | "원래 요청은 HTTPS였다"고 앱에 알림 |
| 컨테이너 Nginx (`docker/nginx.conf`) | `X-Forwarded-Proto`가 있으면 그대로 전달 | 앞단 정보를 Node까지 보존 |
| Node API (`artifacts/api-server/src/app.ts`) | 운영 모드에서 `trust proxy` 사용 | 전달된 프로토콜을 믿음 |
| 세션 쿠키 | `secure: "auto"` | HTTPS 요청이면 `Secure` 쿠키, HTTP면 일반 쿠키 |

그래서 **HTTP로 쓰다가 HTTPS 앞단을 붙여도 앱 설정을 바꿀 필요가 없습니다.** 로그인도 HTTP·HTTPS 모두에서 동작합니다.

---

## 3. 방법 A — Docker + Caddy (도메인이 있는 서버, 운영 권장)

기존 Docker 구성(`docker-compose.yml` 또는 `docker-compose.web.yml`) 앞에 [Caddy](https://caddyserver.com)를 붙입니다. Caddy는 **Let's Encrypt 인증서를 자동으로 발급·갱신**하고, HTTP로 들어온 요청을 HTTPS로 넘겨 줍니다.

추가된 파일:

| 파일 | 내용 |
|---|---|
| `docker-compose.https.yml` | Caddy 서비스 추가, 앱의 외부 포트 닫기 |
| `docker/Caddyfile` | 도메인, 보안 헤더, 업로드 50MB·타임아웃 600초, 앱으로 프록시 |

### 3-1. 준비물

- [ ] 서버의 **공인 IP**
- [ ] **도메인** (예: `ats.example.com`). 가비아·Cloudflare·Route 53 등 어디서 사도 됩니다.
- [ ] Docker와 **Docker Compose v2.24 이상** (`docker compose version`으로 확인)
- [ ] 서버 방화벽·클라우드 보안그룹에서 **TCP 80, TCP 443, UDP 443** 허용
- [ ] 기존 방식으로 앱이 HTTP로 한 번 이상 정상 실행된 상태 ([docs/DOCKER.md](DOCKER.md))

### 3-2. 도메인 DNS 설정

도메인 관리 화면에서 A 레코드를 추가합니다.

| 종류 | 이름(호스트) | 값 | TTL |
|---|---|---|---|
| A | `ats` (→ `ats.example.com`) | 서버 공인 IP | 300 |

설정 후 반영을 확인합니다. 서버 IP가 나와야 합니다.

```bash
nslookup ats.example.com
# 또는
dig +short ats.example.com
```

> Cloudflare에서 DNS를 관리한다면 처음에는 프록시(주황색 구름)를 **끄고(DNS only)** 인증서를 받으세요. 켜 두면 Caddy가 인증서를 받지 못할 수 있습니다.

### 3-3. 환경변수 설정

서버의 `.env`에 두 줄을 채웁니다(`.env.example`에 자리가 있습니다).

```dotenv
DOMAIN=ats.example.com
ACME_EMAIL=you@example.com     # 인증서 만료 알림을 받을 이메일
```

### 3-4. 실행

```bash
# 단일 서버 (DB 포함)
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d

# Web VM (외부 DB 사용)
docker compose -f docker-compose.web.yml -f docker-compose.https.yml up -d
```

처음 실행하면 Caddy가 인증서를 발급받습니다(보통 10~30초). 진행 상황은 로그로 봅니다.

```bash
docker logs -f ats-caddy
# "certificate obtained successfully" 가 보이면 완료
```

이제 `https://ats.example.com`으로 접속합니다. `http://`로 들어와도 자동으로 `https://`로 넘어갑니다.

> **매번 `-f` 두 개를 적기 번거롭다면** `.env`에 아래 한 줄을 넣으면 `docker compose up -d`만으로 같은 구성이 됩니다.
> ```dotenv
> COMPOSE_FILE=docker-compose.yml:docker-compose.https.yml
> ```
> (Windows 서버에서는 구분자가 `;` 입니다.)

### 3-5. 이 구성이 바꾸는 것

- 앱 컨테이너의 **외부 포트(80)를 닫고** Caddy만 앱에 접근합니다. 외부에서 앱에 직접 접속해 `X-Forwarded-Proto`를 속이는 것을 막습니다.
- 응답에 보안 헤더를 붙입니다: `Strict-Transport-Security`(1년), `X-Content-Type-Options`, `Referrer-Policy`.
- 인증서는 `caddy_data` 볼륨에 저장되고 **만료 30일 전에 자동 갱신**됩니다.

### 3-6. 업데이트·중지

```bash
# 새 버전 배포 (HTTPS 구성 유지)
git pull
docker compose -f docker-compose.yml -f docker-compose.https.yml build
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d

# Caddyfile만 고쳤을 때 (무중단 설정 재적용)
docker exec ats-caddy caddy reload --config /etc/caddy/Caddyfile

# HTTPS 앞단 없이 원래(HTTP) 구성으로 되돌리기
docker compose -f docker-compose.yml -f docker-compose.https.yml down
docker compose up -d
```

> `caddy_data` 볼륨을 지우면 인증서를 다시 발급받습니다. Let's Encrypt는 **같은 도메인에 주당 발급 횟수 제한**이 있으니 볼륨을 함부로 지우지 마세요.

---

## 4. 방법 B — Cloudflare Tunnel (공유기 포트 개방 없이 공개)

집이나 학교 PC처럼 **공인 IP가 없거나 공유기 포트를 열 수 없을 때** 쓰는 방법입니다. PC에서 Cloudflare로 나가는 연결만 만들기 때문에 방화벽 설정이 필요 없습니다. 개발 서버(`dev-windows.bat`)와 Docker 구성 모두에 쓸 수 있습니다.

### 4-1. cloudflared 설치

```powershell
# Windows
winget install --id Cloudflare.cloudflared
```

```bash
# macOS
brew install cloudflared
# Ubuntu: https://pkg.cloudflare.com 의 안내대로 apt 저장소 추가 후 설치
```

### 4-2. 임시 주소로 바로 공개 (가입·도메인 불필요, 시연용)

앱을 평소처럼 띄운 뒤 다른 터미널에서 실행합니다.

```bash
# 개발 서버(dev-windows.bat)를 공개할 때 — 웹 포트(기본 3000)
cloudflared tunnel --url http://localhost:3000

# Docker 구성을 공개할 때 — 앱 포트(기본 80)
cloudflared tunnel --url http://localhost:80
```

출력에 나오는 `https://<임의 이름>.trycloudflare.com` 주소로 누구나 HTTPS 접속할 수 있습니다.

- 터미널을 닫으면 주소가 사라지고, 다시 실행하면 **주소가 바뀝니다.**
- 개발 서버는 외부 도메인 접속을 이미 허용하도록 설정되어 있어(`vite.config.ts`의 `allowedHosts: true`) 따로 바꿀 것이 없습니다.
- 시연이 끝나면 꼭 터미널을 닫으세요. 실행 중에는 인터넷의 누구나 접속할 수 있습니다.

### 4-3. 내 도메인으로 고정 주소 만들기

도메인을 Cloudflare에 등록(네임서버 변경)한 경우입니다.

```bash
cloudflared tunnel login                        # 브라우저에서 도메인 선택
cloudflared tunnel create my-ats                # 터널 생성 (자격 증명 파일이 만들어짐)
cloudflared tunnel route dns my-ats ats.example.com
cloudflared tunnel run --url http://localhost:80 my-ats
```

계속 켜 두려면 서비스로 등록합니다: `cloudflared service install` ([공식 문서](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)).

> Cloudflare가 `X-Forwarded-Proto: https`를 붙여 보내므로 Docker 구성에서도 Secure 쿠키가 자동으로 적용됩니다.

---

## 5. 방법 C — 개발 PC를 HTTPS로 (휴대폰에서 음성 녹음 테스트)

`dev-windows.bat`(또는 `dev-macos.sh`)로 띄운 개발 서버를 HTTPS로 엽니다. 같은 와이파이의 휴대폰에서 `https://<PC IP>:3000`으로 접속해 **음성 자기소개서 녹음까지 테스트**할 수 있습니다.

개발 서버 설정(`vite.config.ts`)에 **`DEV_HTTPS_CERT` / `DEV_HTTPS_KEY` 환경변수를 넣으면 HTTPS로 뜨도록** 기능을 추가해 두었습니다. 변수가 없으면 지금처럼 HTTP로 뜹니다.

### 5-1. mkcert 설치

[mkcert](https://github.com/FiloSottile/mkcert)는 내 PC가 신뢰하는 로컬 인증서를 만들어 주는 도구입니다.

```powershell
# Windows (둘 중 하나)
winget install --id FiloSottile.mkcert
choco install mkcert
```

```bash
# macOS
brew install mkcert
```

### 5-2. 인증서 만들기

저장소 루트에서 실행합니다. 마지막 IP는 **내 PC의 내부 IP**로 바꾸세요(`ipconfig`의 IPv4 주소, 예: `192.168.0.39`).

```powershell
cd C:\Github\ApplicantTrackingSystem
mkcert -install                     # 최초 1회: 내 PC에 로컬 인증 기관 등록 (관리자 권한 창이 뜰 수 있음)
mkdir certs
mkcert -cert-file certs/dev-cert.pem -key-file certs/dev-key.pem localhost 127.0.0.1 192.168.0.39
```

> `certs/` 폴더와 `*.pem` 파일은 `.gitignore`에 들어 있어 커밋되지 않습니다. **개인 키이므로 공유하지 마세요.**

### 5-3. 환경변수 설정

`.env.local`(macOS는 `.env.development`)에 두 줄을 추가합니다. 경로는 저장소 루트 기준이며 절대 경로도 됩니다.

```dotenv
DEV_HTTPS_CERT=certs/dev-cert.pem
DEV_HTTPS_KEY=certs/dev-key.pem
```

### 5-4. 실행

`dev-windows.bat`을 다시 실행하면 브라우저가 `https://localhost:3000`으로 열리고 안내 문구도 `https://`로 표시됩니다. API 서버(8080)는 내부용이라 HTTP 그대로이며, 웹 서버가 `/api` 요청을 대신 전달하므로 신경 쓸 필요가 없습니다.

### 5-5. 휴대폰에서 접속하기

1. PC와 휴대폰을 **같은 와이파이**에 연결합니다.
2. Windows 방화벽이 3000번 포트를 막으면 허용합니다(관리자 PowerShell).
   ```powershell
   New-NetFirewallRule -DisplayName "My ATS dev (3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
   ```
3. 휴대폰 브라우저에서 `https://192.168.0.39:3000`(내 PC IP)으로 접속합니다.
4. "안전하지 않은 연결" 경고가 뜹니다. 휴대폰은 mkcert 인증 기관을 모르기 때문입니다.
   - **간단한 방법**: 경고 화면에서 "고급 → 계속 진행"을 누릅니다. 테스트에는 충분하고, 마이크도 동작합니다.
   - **경고 없이 쓰려면**: `mkcert -CAROOT`로 나오는 폴더의 `rootCA.pem`을 휴대폰에 옮겨 설치합니다.
     - Android: 설정 → 보안 → 암호화 및 사용자 인증 정보 → 인증서 설치 → CA 인증서
     - iOS: 파일을 열어 프로필 설치 → 설정 → 일반 → 정보 → 인증서 신뢰 설정에서 켜기
5. 음성 자소서 화면에서 마이크 권한을 허용하면 녹음 파형이 움직입니다.

> 설정을 끄려면 `.env.local`에서 두 줄을 지우거나 앞에 `#`를 붙이고 다시 실행하면 됩니다.

---

## 6. 방법 D — Docker 없이 Ubuntu에 직접 설치한 서버 (Certbot)

`install.sh`로 설치하면 Nginx 설정이 `/etc/nginx/conf.d/<앱이름>.conf`에 `server_name _;`로 만들어집니다. Certbot으로 이 설정에 인증서를 붙입니다.

```bash
# 1) DNS A 레코드가 서버를 가리키는지 확인 (3-2와 같음)
dig +short ats.example.com

# 2) server_name을 도메인으로 바꾸기
sudo sed -i 's/server_name _;/server_name ats.example.com;/' /etc/nginx/conf.d/*.conf
sudo nginx -t && sudo systemctl reload nginx

# 3) 방화벽 열기
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 4) Certbot 설치 후 인증서 발급 (HTTP→HTTPS 리디렉션도 자동 설정)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ats.example.com --redirect -m you@example.com --agree-tos

# 5) 자동 갱신 확인
sudo certbot renew --dry-run
```

- `install.sh`에서 웹 포트를 80이 아닌 값으로 바꿨다면 Certbot이 80 포트로 인증할 수 있도록 80을 열어 두세요.
- Nginx가 `X-Forwarded-Proto $scheme`을 Node에 넘기므로 HTTPS 접속 시 Secure 쿠키가 자동으로 적용됩니다.

---

## 7. 설정이 잘 됐는지 확인하기

```bash
# HTTPS 응답과 보안 헤더
curl -I https://ats.example.com
#   HTTP/2 200
#   strict-transport-security: max-age=31536000   ← 방법 A

# HTTP → HTTPS 리디렉션
curl -I http://ats.example.com
#   HTTP/1.1 308 Permanent Redirect
#   location: https://ats.example.com/

# API 상태
curl https://ats.example.com/api/healthz
#   {"status":"ok"}

# 인증서 정보 (발급자, 만료일)
echo | openssl s_client -connect ats.example.com:443 -servername ats.example.com 2>/dev/null | openssl x509 -noout -issuer -dates
```

브라우저에서도 확인합니다.

- [ ] 주소창에 자물쇠가 표시되는지
- [ ] 로그인 후 개발자 도구 → Application → Cookies에서 `connect.sid` 쿠키에 **Secure** 체크가 있는지
- [ ] 이력서 PDF 업로드(최대 10MB)와 음성 파일 업로드(최대 50MB)가 되는지
- [ ] 음성 자소서에서 마이크 권한 요청이 뜨고 녹음 파형이 움직이는지
- [ ] AI 서류 심사처럼 오래 걸리는 작업이 끝까지 완료되는지

---

## 8. 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| Caddy 로그에 `challenge failed`, `timeout during connect` | 80번 포트가 막혔거나 DNS가 아직 서버를 가리키지 않음 | 보안그룹·방화벽에서 TCP 80 허용, `dig +short 도메인` 확인, Cloudflare 프록시는 DNS only로 |
| `too many certificates already issued` | Let's Encrypt 발급 횟수 제한 | 일주일 기다리기. 테스트할 때는 `caddy_data` 볼륨을 지우지 말 것 |
| `docker compose` 실행 시 `!reset` 관련 오류 | Docker Compose가 2.24보다 오래됨 | `docker compose version` 확인 후 Docker 업데이트 |
| Caddy 시작 시 `port is already allocated` (80/443) | 다른 웹서버(기존 Nginx, IIS 등)가 포트 사용 중 | 해당 서비스 중지. 앱을 기존 HTTP 구성으로 켜 둔 상태라면 `down` 후 HTTPS 구성으로 다시 `up` |
| 브라우저에 `ERR_TOO_MANY_REDIRECTS` | Cloudflare SSL 모드가 Flexible인데 Caddy도 HTTPS 리디렉션 | Cloudflare SSL/TLS 모드를 **Full (strict)** 로 변경 |
| `502 Bad Gateway` | 앱 컨테이너가 아직 준비되지 않았거나 종료됨 | `docker compose ps`, `docker logs ats-app` 확인 |
| 업로드 시 `413 Request Entity Too Large` | 앞단 프록시의 업로드 한도 | `docker/Caddyfile`의 `max_size`, Certbot-Nginx는 `client_max_body_size 50m;` 확인 |
| 로그인했는데 바로 로그아웃됨 | HTTPS로 받은 Secure 쿠키를 HTTP 주소로 접속해 사용 | 항상 `https://` 주소로 접속 (방법 A는 자동 리디렉션됨) |
| 휴대폰에서 마이크 권한 요청이 아예 안 뜸 | HTTP로 접속함 | 방법 B 또는 C로 HTTPS 접속 |
| 개발 서버가 `개발용 HTTPS cert 파일을 찾을 수 없습니다` 오류로 종료 | `DEV_HTTPS_CERT` 경로가 틀림 | 저장소 루트 기준 경로인지 확인, `certs/` 폴더에 파일이 있는지 확인 |
| `dev-windows.bat`이 "웹 서버가 90초 안에 뜨지 않았습니다"로 실패 | "My ATS - Web" 창의 오류 확인 | 인증서 경로 오류가 가장 흔함. 위 항목 참고 |
| 개발 서버 HTTPS에서 화면이 자동 새로 고침되지 않음 | 브라우저가 인증서를 신뢰하지 않아 실시간 연결(웹소켓)이 막힘 | PC에서 `mkcert -install` 실행, 휴대폰은 5-5의 인증서 설치 |

---

## 9. 보안 체크리스트

- [ ] `SESSION_SECRET`을 32자 이상 임의 문자열로 바꿨다 (`openssl rand -hex 32`)
- [ ] 관리자 비밀번호(`ADMIN_PASSWORD_HASH`)를 기본값이 아닌 값으로 바꿨다
- [ ] `ADMIN_EMAILS`에는 정말 관리자인 계정만 넣었다
- [ ] Node API 포트(8080)와 DB 포트(5432)는 외부에 공개하지 않았다 (기본 설정은 `127.0.0.1`에만 열림)
- [ ] HTTPS 앞단(방법 A)을 쓸 때 앱 컨테이너의 80 포트가 외부에 열려 있지 않다 (`docker compose ps`의 PORTS 확인)
- [ ] 개발용 인증서(`certs/*.pem`)와 `.env`, `.env.local`을 커밋하지 않았다
- [ ] Cloudflare 임시 터널은 시연이 끝나면 종료했다
- [ ] `Strict-Transport-Security`를 켠 도메인은 1년 동안 HTTP로 접속할 수 없다는 점을 알고 있다 (HTTPS를 그만둘 계획이 있다면 `docker/Caddyfile`의 `max-age`를 줄일 것)
