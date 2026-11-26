@echo off
rem My ATS - Windows dev server launcher.
rem The real logic lives in scripts\windows\dev.ps1.
rem Keep this file ASCII-only: cmd misreads UTF-8 (Korean) batch files
rem after chcp 65001 and runs fragments of comment lines as commands.
rem Options: --push (re-apply DB schema), --no-open (no browser), --host (https via Caddy)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\dev.ps1" %*
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
