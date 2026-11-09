# Windows에서 바로 실행하기 (dev-windows.bat)

WSL이나 Docker 없이 Windows에서 `dev-windows.bat`을 더블클릭해 웹·API 개발 서버를 띄우는 방법입니다.
처음 한 번은 **직접 채워 넣어야 하는 값**이 있으므로 이 문서를 순서대로 따라 하세요.

---

## 0. 한눈에 보기

| 단계 | 할 일 | 직접 입력? |
|---|---|---|
| 1 | Node.js, Git for Windows, PostgreSQL 설치 | – |
| 2 | PostgreSQL에 전용 계정·DB 만들기 | ✅ 비밀번호 정하기 |
| 3 | `.env.local` 만들기 | ✅ `DATABASE_URL`, `SESSION_SECRET` |
| 4 | (선택) AI 키, 관리자 계정 | ✅ `AI_INTEGRATIONS_OPENAI_API_KEY`, `ADMIN_*` |
| 5 | `dev-windows.bat` 실행 → 브라우저 자동 실행 | – |

---

## 1. 필요한 프로그램

| 프로그램 | 버전 | 확인 방법 (PowerShell / cmd) |
|---|---|---|
| Node.js | 22 이상 | `node -v` |
| Git for Windows | 아무 버전 (Git Bash 포함) | `git --version` |
| PostgreSQL | 15 이상 (16 권장) | 서비스 `postgresql-x64-16` 실행 중인지 확인 |

- **pnpm은 따로 설치하지 않아도 됩니다.** bat가 전역 `pnpm` → `corepack`(Node 24 이하) → `npx pnpm@10.26.1`(Node 25 이상은 corepack이 빠져 있음) 순서로 찾아서 `package.json`에 고정된 버전을 사용합니다.
- **Git Bash가 꼭 필요합니다.** `package.json` 스크립트가 `export`, `sh -c` 같은 bash 문법을 쓰기 때문에 bat가 Git Bash를 스크립트 셸로 지정합니다. 기본 경로(`C:\Program Files\Git\bin\bash.exe`)에 설치되어 있으면 자동으로 찾습니다.
- PostgreSQL 실행 여부 확인 (PowerShell):

  ```powershell
  Get-Service postgresql*
  ```

  `Status`가 `Running`이 아니면 `서비스` 앱에서 시작하거나 `Start-Service postgresql-x64-16`을 관리자 권한으로 실행하세요.

---

## 2. PostgreSQL 계정·DB 만들기 ✅

포트 번호: 1876 (5432번 사용 불가능)
앱 전용 계정과 데이터베이스를 하나 만듭니다. PostgreSQL 설치 시 정한 `postgres`(슈퍼유저) 비밀번호가 필요합니다.

### 방법 A — psql (명령줄)

`psql`은 PATH에 없을 수 있으므로 전체 경로로 실행합니다.

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h 127.0.0.1
```

접속되면 아래 SQL을 입력합니다. `여기에_비밀번호`는 직접 정한 값으로 바꾸세요.

```sql
CREATE USER ats_local WITH PASSWORD '여기에_비밀번호';
CREATE DATABASE atsdb OWNER ats_local ENCODING 'UTF8';
\q
```

### 방법 B — pgAdmin (GUI)

1. pgAdmin 실행 → 서버 접속 (`postgres` 비밀번호 입력)
2. **Login/Group Roles** 우클릭 → Create → Login/Group Role
   - General › Name: `ats_local`
   - Definition › Password: 직접 정한 비밀번호
   - Privileges › **Can login?** 켜기
3. **Databases** 우클릭 → Create → Database
   - Database: `atsdb`, Owner: `ats_local`

> 계정 이름·DB 이름은 바꿔도 됩니다. 다음 단계의 `DATABASE_URL`에 같은 값을 넣기만 하면 됩니다.

---

## 3. `.env.local` 작성하기 ✅

`dev-windows.bat`을 처음 실행하면 `.env.local.example`을 복사해 `.env.local`을 만들고 메모장으로 열어 준 뒤 멈춥니다.
(직접 만들어도 됩니다: 프로젝트 루트에서 `copy .env.local.example .env.local`)

`.env.local`은 `.gitignore`에 들어 있어 **Git에 올라가지 않습니다.** 키와 비밀번호를 넣어도 됩니다.

### 3-1. 반드시 바꿔야 하는 값

#### `DATABASE_URL`

형식:

```
DATABASE_URL=postgresql://<계정>:<비밀번호>@127.0.0.1:<포트>/<DB이름>
```

2단계 예시대로 만들었다면:

```
DATABASE_URL=postgresql://ats_local:여기에_비밀번호@127.0.0.1:5432/atsdb
```

주의할 점:
- 예시 파일의 기본값(`ats_vscode:ats_vscode_local`)은 Docker 컨테이너용입니다. **로컬 PostgreSQL에서는 그대로 쓰면 접속에 실패합니다.**
- 비밀번호에 `@ : / ? # %` 같은 특수문자가 있으면 URL 인코딩해야 합니다 (예: `@` → `%40`, `#` → `%23`). 영문·숫자만 쓰면 가장 편합니다.
- PostgreSQL 포트를 5432가 아닌 값으로 설치했다면 그 포트로 바꾸세요.

#### `SESSION_SECRET`

로그인 세션을 암호화하는 키입니다. 비어 있으면 API 서버가 시작되지 않습니다. 아무 긴 임의 문자열이면 되며, 아래 명령으로 만들 수 있습니다.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

출력된 값을 붙여 넣습니다.

```
SESSION_SECRET=3f9a...(64자리)
```

### 3-2. 선택 값

#### AI 기능 — `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

비어 있어도 웹·API 서버는 뜨지만 **서류 심사, 면접 연습, 음성 자기소개서 등 AI 기능은 동작하지 않습니다.**

```
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```

- 키는 https://platform.openai.com/api-keys 에서 발급합니다.
- OpenAI 호환 서버(Azure OpenAI, 사설 프록시 등)를 쓰면 `BASE_URL`을 그 주소로 바꿉니다.
- 음성 인식(STT)은 `API_KEY`와 `BASE_URL`이 **둘 다** 있어야 동작합니다.
- 관리자 페이지(`/admin`)의 설정에서도 키·주소·모델을 바꿀 수 있으며, 그 값이 있으면 환경 변수보다 우선합니다.

#### OCR — `MISTRAL_API_KEY`

넣으면 스캔 PDF·이미지 공고에 Mistral 전용 OCR을 먼저 사용합니다. 비워 두면 OpenAI 호환 비전 OCR로 대신합니다.

```
MISTRAL_API_KEY=
```

#### 관리자 계정 — `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`

개발 모드에서는 코드에 들어 있는 개발용 관리자 계정이 기본으로 쓰입니다. **내 계정으로 `/admin`에 로그인하려면** 두 값을 직접 넣으세요. 비밀번호는 원문이 아니라 **bcrypt 해시**로 넣어야 합니다.

해시 만들기 (의존성 설치가 끝난 뒤, 프로젝트 루트에서):

```powershell
cd artifacts\api-server
node -e "require('bcrypt').hash(process.argv[1], 12).then(console.log)" "내비밀번호"
cd ..\..
```

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$....(출력된 값 그대로)
```

#### 포트 — `API_PORT`, `WEB_PORT`

기본값은 API `8080`, 웹 `3000`입니다. 다른 프로그램이 쓰고 있으면 바꾸세요. 두 값은 서로 달라야 합니다.

### 3-3. 작성 규칙 (bat가 파일을 읽는 방식 때문)

- 한 줄에 `이름=값` 하나. **`=` 앞뒤에 공백을 넣지 마세요.**
- 값을 **따옴표로 감싸지 마세요.** 따옴표까지 값으로 들어갑니다.
- `#`으로 시작하는 줄은 주석입니다. 값 뒤에 붙인 `# 설명`은 주석이 아니라 값의 일부가 되니 쓰지 마세요.

### 3-4. 완성 예시

```
DATABASE_URL=postgresql://ats_local:MyLocalPw123@127.0.0.1:5432/atsdb
SESSION_SECRET=3f9a1c0e8b7d4a2f6e5c9b8a7d6e5f4c3b2a1908f7e6d5c4b3a2918f7e6d5c4b
API_PORT=8080
WEB_PORT=3000
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-xxxxxxxx
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
MISTRAL_API_KEY=
```

> 예시 파일에 있는 `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_PORT`는 Docker DB 컨테이너용입니다. 로컬 PostgreSQL을 쓰면 무시해도 됩니다. 실제 접속에는 `DATABASE_URL`만 쓰입니다.

---

## 4. 실행하기

프로젝트 루트의 `dev-windows.bat`을 더블클릭하거나 cmd에서 실행합니다.

```bat
dev-windows.bat
```

진행 순서:

1. **[1/4] 의존성 설치**: 처음 한 번 `pnpm install`이 실행됩니다 (몇 분 걸릴 수 있음).
2. **[2/4] DB 스키마 적용**: `drizzle-kit push`로 테이블을 만듭니다. 성공하면 `node_modules\.ats-db-pushed` 표시 파일이 생기고, 다음부터는 이 단계를 건너뜁니다.
3. **[3/4] API 서버**: `My ATS - API` 창이 새로 열리고, 빌드 후 `http://localhost:8080/api/healthz`가 응답할 때까지 기다립니다 (최대 120초).
4. **[4/4] 웹 서버**: `My ATS - Web` 창이 열리고, 준비되면 **브라우저에서 `http://localhost:3000`이 자동으로 열립니다.**

| 주소 | 용도 |
|---|---|
| http://localhost:3000 | 웹 |
| http://localhost:3000/admin | 관리자 |
| http://localhost:8080/api/healthz | API 상태 확인 |

**종료:** `My ATS - API`, `My ATS - Web` 두 창을 닫으면 됩니다. DB 데이터는 그대로 남습니다.

### 옵션

| 명령 | 동작 |
|---|---|
| `dev-windows.bat --push` | DB 스키마를 다시 적용 (스키마를 바꿨을 때) |
| `dev-windows.bat --no-open` | 브라우저를 자동으로 열지 않음 |

`drizzle-kit push`가 데이터 손실 가능성이 있는 변경을 감지하면 터미널에서 확인을 물어볼 수 있습니다. 내용을 읽고 선택하세요.

---

## 5. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `Git Bash(bash.exe)를 찾을 수 없습니다` | Git for Windows를 기본 경로에 설치하세요. |
| `DB 스키마 적용에 실패했습니다` + `password authentication failed` | `DATABASE_URL`의 계정·비밀번호가 틀렸습니다. 2단계에서 만든 값과 비교하세요. |
| `database "atsdb" does not exist` | 2단계의 `CREATE DATABASE`를 실행하지 않았습니다. |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL 서비스가 꺼져 있거나 포트가 다릅니다. |
| `No schema files found` | 최신 코드인지 확인하세요 (`lib/db/drizzle.config.ts`의 Windows 경로 수정 포함). |
| `SESSION_SECRET is required` | `.env.local`에 `SESSION_SECRET`이 비어 있습니다. |
| `API 서버가 120초 안에 뜨지 않았습니다` | `My ATS - API` 창의 로그를 확인하세요. 대부분 DB 접속 문제입니다. |
| `Port 3000 is already in use` | 다른 프로그램이 포트를 쓰고 있습니다. `.env.local`의 `WEB_PORT`를 바꾸세요. |
| 웹 화면은 뜨는데 AI 기능만 오류 | `AI_INTEGRATIONS_OPENAI_API_KEY`가 비었거나 잘못되었습니다. |
| esbuild / rollup / tailwind 관련 `Cannot find module ...win32-x64...` | `pnpm-workspace.yaml`에서 Windows 바이너리를 막는 줄이 되살아난 경우입니다. 해당 줄을 지우고 `npx --yes pnpm@10.26.1 install`을 다시 실행하세요. |
| 처음부터 다시 하고 싶음 | `.env.local`을 지우고 다시 실행하면 새로 만들어 줍니다. DB 스키마만 다시 적용하려면 `--push`를 쓰세요. |

---

## 참고: bat가 내부적으로 하는 일

- `.env.local`의 값을 환경 변수로 읽어 들입니다.
- `npm_config_script_shell`을 Git Bash로 지정해 bash 문법 스크립트가 cmd에서도 돌게 합니다.
- `MSYS_NO_PATHCONV=1`, `MSYS2_ENV_CONV_EXCL=*`를 설정해 Git Bash가 `BASE_PATH=/` 같은 값을 `C:/Program Files/Git/`로 바꾸지 않게 합니다.
- 웹 서버는 `BASE_PATH=/`, `API_PROXY_TARGET=http://127.0.0.1:<API_PORT>`로 실행되어 `/api` 요청을 API 서버로 전달합니다.

WSL·Docker 기반 환경은 [VS_CODE.md](VS_CODE.md), 배포는 [DOCKER.md](DOCKER.md)를 참고하세요.
