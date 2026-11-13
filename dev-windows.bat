@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion
title My ATS - 개발 서버

rem =========================================================
rem  AI 서류 심사관 - Windows 개발 서버 실행 스크립트
rem  API 서버(8080)와 웹 프론트엔드(3000)를 각각 새 창으로 띄우고,
rem  준비가 끝나면 브라우저로 웹페이지를 자동으로 엽니다.
rem
rem  선행 조건: Node.js 22+, Git for Windows, PostgreSQL 실행 중
rem  옵션:  dev-windows.bat --push   DB 스키마를 다시 적용
rem         dev-windows.bat --no-open 브라우저 자동 실행 안 함
rem =========================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

set "FORCE_PUSH=0"
set "OPEN_BROWSER=1"
for %%A in (%*) do (
  if /i "%%~A"=="--push" set "FORCE_PUSH=1"
  if /i "%%~A"=="--no-open" set "OPEN_BROWSER=0"
)

rem ---- 1. 필수 도구 확인 ------------------------------------
where node >nul 2>&1 || (
  echo [오류] Node.js가 없습니다. https://nodejs.org 에서 설치하세요.
  goto :fail
)
where curl >nul 2>&1 || (
  echo [오류] curl.exe를 찾을 수 없습니다.
  goto :fail
)

rem package.json의 스크립트가 bash 문법(export, sh -c)을 쓰므로 Git Bash를 스크립트 셸로 지정
set "GIT_BASH="
for %%P in ("%ProgramFiles%\Git\bin\bash.exe" "%ProgramFiles(x86)%\Git\bin\bash.exe" "%LocalAppData%\Programs\Git\bin\bash.exe") do (
  if not defined GIT_BASH if exist "%%~P" set "GIT_BASH=%%~P"
)
if not defined GIT_BASH (
  echo [오류] Git Bash^(bash.exe^)를 찾을 수 없습니다. Git for Windows를 설치하세요.
  goto :fail
)
set "npm_config_script_shell=%GIT_BASH%"
rem Git Bash가 BASE_PATH=/ 같은 값을 Windows 경로로 바꾸지 않도록 변환 끄기
set "MSYS_NO_PATHCONV=1"
set "MSYS2_ENV_CONV_EXCL=*"

rem pnpm 찾기: 전역 pnpm → corepack(Node 24 이하) → npx(Node 25+는 corepack 미포함)
set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"
set "PNPM="
where pnpm >nul 2>&1 && set "PNPM=pnpm"
if not defined PNPM where corepack >nul 2>&1 && set "PNPM=corepack pnpm"
if not defined PNPM where npx >nul 2>&1 && set "PNPM=npx --yes pnpm@10.26.1"
if not defined PNPM (
  echo [오류] pnpm을 찾을 수 없습니다. 'npm install -g pnpm@10.26.1'로 설치하세요.
  goto :fail
)

rem ---- 2. 환경 변수 (.env.local) -----------------------------
if not exist ".env.local" (
  copy /y ".env.local.example" ".env.local" >nul
  echo [안내] .env.local 파일을 새로 만들었습니다.
  echo        DATABASE_URL을 이 PC의 PostgreSQL 계정에 맞게 고치고,
  echo        SESSION_SECRET을 임의의 긴 문자열로 바꾼 뒤 다시 실행하세요.
  start "" notepad ".env.local"
  goto :fail
)

for /f "usebackq eol=# tokens=1,* delims==" %%K in (".env.local") do (
  if not "%%K"=="" set "%%K=%%L"
)

if not defined DATABASE_URL (
  echo [오류] .env.local에 DATABASE_URL이 없습니다.
  goto :fail
)
if not defined SESSION_SECRET (
  echo [오류] .env.local에 SESSION_SECRET이 없습니다.
  goto :fail
)
if not defined API_PORT set "API_PORT=8080"
if not defined WEB_PORT set "WEB_PORT=3000"
if "%API_PORT%"=="%WEB_PORT%" (
  echo [오류] API_PORT와 WEB_PORT는 서로 달라야 합니다.
  goto :fail
)

rem 개발용 HTTPS: .env.local에 DEV_HTTPS_CERT/DEV_HTTPS_KEY가 있으면 웹 서버가 https로 뜬다 (docs/HTTPS.md)
set "WEB_SCHEME=http"
if defined DEV_HTTPS_CERT set "WEB_SCHEME=https"

rem ---- 3. 의존성 설치 (처음 한 번 / lock 파일 변경 시) --------
set "NEED_INSTALL=0"
if not exist "artifacts\job-doc-check\node_modules" set "NEED_INSTALL=1"
if not exist "node_modules\.pnpm\node_modules\@esbuild\win32-x64" set "NEED_INSTALL=1"
if "%NEED_INSTALL%"=="1" (
  echo [1/4] 의존성을 설치합니다...
  call %PNPM% install || (
    echo [오류] pnpm install에 실패했습니다.
    goto :fail
  )
) else (
  echo [1/4] 의존성 확인 완료
)

rem ---- 4. DB 스키마 적용 (처음 한 번 또는 --push) -------------
set "PUSH_MARKER=node_modules\.ats-db-pushed"
if "%FORCE_PUSH%"=="1" del /q "%PUSH_MARKER%" >nul 2>&1
if not exist "%PUSH_MARKER%" (
  echo [2/4] DB 스키마를 적용합니다...
  call %PNPM% --filter @workspace/db run push || (
    echo [오류] DB 스키마 적용에 실패했습니다. PostgreSQL 실행 여부와 DATABASE_URL을 확인하세요.
    goto :fail
  )
  echo.>"%PUSH_MARKER%"
) else (
  echo [2/4] DB 스키마 적용됨 ^(다시 적용: dev-windows.bat --push^)
)

rem ---- 5. API 서버 ------------------------------------------
echo [3/4] API 서버 시작 ^(포트 %API_PORT%^)...
start "My ATS - API (%API_PORT%)" cmd /k "set PORT=%API_PORT%&& %PNPM% --filter @workspace/api-server run dev"

set /a WAITED=0
:wait_api
curl -sf "http://127.0.0.1:%API_PORT%/api/healthz" >nul 2>&1 && goto :api_ready
set /a WAITED+=1
if %WAITED% geq 120 (
  echo [오류] API 서버가 120초 안에 뜨지 않았습니다. "My ATS - API" 창의 로그를 확인하세요.
  goto :fail
)
timeout /t 1 /nobreak >nul
goto :wait_api
:api_ready
echo       API 서버 준비 완료

rem ---- 6. 웹 프론트엔드 --------------------------------------
echo [4/4] 웹 프론트엔드 시작 ^(포트 %WEB_PORT%^)...
start "My ATS - Web (%WEB_PORT%)" cmd /k "set PORT=%WEB_PORT%&& set BASE_PATH=/&& set API_PROXY_TARGET=http://127.0.0.1:%API_PORT%&& %PNPM% --filter @workspace/job-doc-check run dev"

set /a WAITED=0
:wait_web
rem -k: 개발용 인증서(mkcert)는 curl이 모르는 인증 기관이라 검증을 건너뛴다
curl -skf "%WEB_SCHEME%://127.0.0.1:%WEB_PORT%/" >nul 2>&1 && goto :web_ready
set /a WAITED+=1
if %WAITED% geq 90 (
  echo [오류] 웹 서버가 90초 안에 뜨지 않았습니다. "My ATS - Web" 창의 로그를 확인하세요.
  goto :fail
)
timeout /t 1 /nobreak >nul
goto :wait_web
:web_ready

if "%OPEN_BROWSER%"=="1" start "" "%WEB_SCHEME%://localhost:%WEB_PORT%"

echo.
echo =========================================
echo  개발 서버 실행 중
echo =========================================
echo   웹:      %WEB_SCHEME%://localhost:%WEB_PORT%
echo   API:     http://localhost:%API_PORT%/api/healthz
echo   관리자:  %WEB_SCHEME%://localhost:%WEB_PORT%/admin
echo   종료:    "My ATS - API" / "My ATS - Web" 창을 닫으세요
echo.
pause
exit /b 0

:fail
echo.
pause
exit /b 1
