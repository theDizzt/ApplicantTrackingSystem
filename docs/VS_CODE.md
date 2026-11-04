# VS Code에서 개발하기

## 권장 환경

Windows에서는 프로젝트를 **Ubuntu WSL 2 안에서** 여세요. 일부 네이티브 패키지의 Windows 바이너리는 이 저장소의 pnpm 설정에서 제외되어 있어, Windows 기본 PowerShell에서 `pnpm install`을 실행하면 설치나 빌드가 실패할 수 있습니다.

1. WSL 2 Ubuntu와 VS Code의 **WSL** 확장을 설치합니다.
2. VS Code의 WSL 터미널에서 저장소를 Linux 홈 디렉터리(예: `~/projects`)에 복제합니다. `/mnt/c` 경로보다 WSL 파일 시스템 안에서 작업하는 편이 빠르고 안정적입니다.
3. Ubuntu에 Git, curl, 빌드 도구를 설치합니다. Node Version Manager가 없다면 공식 설치 안내에 따라 설치하고, Docker Desktop을 쓰는 경우 설정에서 Ubuntu WSL 통합을 켭니다. DB 컨테이너를 사용하려면 Docker Compose 2.20 이상이 필요합니다.
4. 저장소 폴더에서 다음 명령을 실행합니다.

```bash
sudo apt update
sudo apt install -y build-essential curl git
nvm install
nvm use
npm install --global pnpm@10.26.1
code .
```

VS Code가 WSL 모드로 열렸는지 왼쪽 아래의 원격 표시를 확인하세요. 확장 권장 목록을 승인하면 Prettier, Tailwind CSS, Docker 지원을 설치합니다.

## 처음 한 번 설정하기

VS Code 통합 터미널에서:

```bash
pnpm install --frozen-lockfile
cp .env.local.example .env.local
```

`.env.local`을 열어 `SESSION_SECRET`을 임의의 값으로 바꾸세요. 예:

```bash
openssl rand -hex 32
```

AI 분석 기능을 사용할 때만 `AI_INTEGRATIONS_OPENAI_API_KEY`에 본인의 키를 입력합니다. 키가 비어 있어도 웹·API 서버는 실행되지만, AI 분석 요청은 동작하지 않습니다. `.env.local`은 Git에서 제외됩니다.

## 데이터베이스와 서버 실행

1. VS Code에서 `Ctrl+Shift+P` → **Tasks: Run Task** → **My ATS: Apply local database schema**를 실행합니다. 로컬 PostgreSQL 컨테이너를 시작한 뒤 현재 개발 스키마를 적용합니다. 이 작업은 로컬 개발 DB에만 사용하세요.
2. 같은 메뉴에서 **My ATS: Run web and API**를 실행합니다.
3. 웹은 `http://localhost:3000`, API 상태 확인은 `http://localhost:8080/api/healthz`에서 확인합니다.
4. 실행 작업 터미널에서 `Ctrl+C`를 누르면 웹·API 서버가 종료됩니다. 데이터베이스는 유지됩니다.

나중에 데이터베이스만 시작하거나 중지하려면 **My ATS: Start local database** 또는 **My ATS: Stop local database** 작업을 실행합니다. 중지 작업은 저장된 DB 볼륨을 삭제하지 않습니다.

기본 DB 포트 `5432`가 이미 사용 중이면 `.env.local`에서 `DB_PORT`와 `DATABASE_URL`의 포트를 같은 값(예: `5433`)으로 바꾸세요.

## 검사

- **My ATS: Typecheck web frontend** — 웹 프론트엔드 타입 검사
- **My ATS: Install dependencies** — 잠금 파일 기준으로 의존성 설치

현재 전체 작업공간 타입 검사(`pnpm run typecheck`)는 기존 API 테스트 파일의 TypeScript 오류 때문에 통과하지 않습니다. VS Code 작업에는 통과가 확인된 웹 프론트엔드 타입 검사만 등록했습니다.

브라우저에서 `/login`, `/register` 경로도 로컬 API 서버에 연결되어 동작합니다.
