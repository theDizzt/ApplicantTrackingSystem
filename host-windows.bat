@echo off
chcp 65001 >nul
setlocal EnableExtensions DisableDelayedExpansion
title My ATS - 도메인 (Caddy)

rem =========================================================
rem  이 PC를 도메인(https)으로 공개합니다.
rem  - 먼저 dev-windows.bat으로 개발 서버를 띄워 두세요.
rem  - 처음 한 번: 관리자 PowerShell에서 scripts\windows\setup-host.ps1 실행
rem  - .env의 DOMAIN 값을 사용합니다. 공유기에서 80, 443 포트를 이 PC로 넘겨야 합니다.
rem  - 종료: 이 창에서 Ctrl+C
rem =========================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

if not exist ".env" (
  echo [오류] .env 파일이 없습니다. 먼저 dev-windows.bat을 실행하세요.
  goto :fail
)
for /f "usebackq eol=# tokens=1,* delims==" %%K in (".env") do (
  if not "%%K"=="" set "%%K=%%L"
)
if not defined DOMAIN (
  echo [오류] .env에 DOMAIN이 비어 있습니다. 예: DOMAIN=example.com
  goto :fail
)
if not defined WEB_PORT set "WEB_PORT=3000"

where caddy >nul 2>&1 || (
  echo [오류] caddy가 없습니다. 관리자 PowerShell에서 아래를 한 번 실행하세요.
  echo        powershell -ExecutionPolicy Bypass -File scripts\windows\setup-host.ps1
  goto :fail
)

curl -skf "http://127.0.0.1:%WEB_PORT%/" >nul 2>&1 || curl -skf "https://127.0.0.1:%WEB_PORT%/" >nul 2>&1 || (
  echo [오류] 웹 개발 서버^(포트 %WEB_PORT%^)가 꺼져 있습니다. 먼저 dev-windows.bat을 실행하세요.
  goto :fail
)

echo 도메인: https://%DOMAIN%
echo 처음 실행하면 인증서 발급에 몇 초~1분 걸립니다. 종료: Ctrl+C
echo.
caddy run --config "scripts\windows\Caddyfile" --adapter caddyfile
goto :eof

:fail
echo.
pause
exit /b 1
