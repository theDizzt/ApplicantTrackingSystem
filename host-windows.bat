@echo off
rem =========================================================
rem  이 PC를 도메인(https)으로 공개합니다.
rem  dev-windows.bat --host 와 같습니다. 개발 서버가 꺼져 있으면 함께 띄우고,
rem  이미 떠 있으면 도메인 공개(Caddy)만 추가합니다.
rem  - 처음 한 번: 관리자 PowerShell에서 scripts\windows\setup-host.ps1 실행
rem  - .env의 DOMAIN 값을 사용합니다. 공유기에서 80, 443 포트를 이 PC로 넘겨야 합니다.
rem  - 다른 옵션도 그대로 넘깁니다. 예: host-windows.bat --no-open
rem =========================================================
call "%~dp0dev-windows.bat" --host %*
