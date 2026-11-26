# =========================================================
#  AI 서류 심사관 - Windows 개발 서버 실행 스크립트
#  API 서버(8080)와 웹 프론트엔드(3000)를 각각 새 창으로 띄우고,
#  준비가 끝나면 브라우저로 웹페이지를 자동으로 엽니다.
#
#  프로젝트 루트의 dev-windows.bat이 이 스크립트를 실행합니다.
#  (cmd는 chcp 65001 상태에서 UTF-8 한글 배치 파일을 잘못 읽어 주석 줄 일부를
#   명령으로 실행하는 버그가 있어, 로직은 PowerShell로 옮기고 .bat은 ASCII만 씁니다.
#   이 파일은 Windows PowerShell 5.1이 한글을 읽을 수 있도록 UTF-8 BOM으로 저장합니다.)
#
#  선행 조건: Node.js 22+, Git for Windows, PostgreSQL 실행 중
#  옵션:  dev-windows.bat --push   DB 스키마를 다시 적용
#         dev-windows.bat --no-open 브라우저 자동 실행 안 함
#         dev-windows.bat --host    .env의 DOMAIN으로 https 공개 (Caddy 창 추가)
#                                   처음 한 번: 관리자 PowerShell에서 scripts\windows\setup-host.ps1
#  이미 떠 있는 API·웹 서버는 다시 띄우지 않으므로, 개발 중에 --host로
#  다시 실행하면 도메인 공개(Caddy)만 추가됩니다.
# =========================================================

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $Root

$ForcePush = $false
$OpenBrowser = $true
$HostDomain = $false
foreach ($a in $args) {
  switch ($a.ToLower()) {
    '--push'    { $ForcePush = $true }
    '--no-open' { $OpenBrowser = $false }
    '--host'    { $HostDomain = $true }
  }
}
$Host.UI.RawUI.WindowTitle = if ($HostDomain) { 'My ATS - 개발 서버 + 도메인' } else { 'My ATS - 개발 서버' }

function Fail([string[]]$Lines) {
  foreach ($l in $Lines) { Write-Host $l }
  exit 1
}
function Test-Command([string]$Name) {
  [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}
function Test-Url([string]$Url, [switch]$Insecure) {
  $flags = if ($Insecure) { '-skf' } else { '-sf' }
  & curl.exe $flags $Url *> $null
  $LASTEXITCODE -eq 0
}

# ---- 1. 필수 도구 확인 ------------------------------------
if (-not (Test-Command 'node')) { Fail '[오류] Node.js가 없습니다. https://nodejs.org 에서 설치하세요.' }
if (-not (Test-Command 'curl.exe')) { Fail '[오류] curl.exe를 찾을 수 없습니다.' }

# package.json의 스크립트가 bash 문법(export, sh -c)을 쓰므로 Git Bash를 스크립트 셸로 지정
$GitBash = @(
  "$env:ProgramFiles\Git\bin\bash.exe",
  "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
  "$env:LocalAppData\Programs\Git\bin\bash.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $GitBash) { Fail '[오류] Git Bash(bash.exe)를 찾을 수 없습니다. Git for Windows를 설치하세요.' }
$env:npm_config_script_shell = $GitBash
# Git Bash가 BASE_PATH=/ 같은 값을 Windows 경로로 바꾸지 않도록 변환 끄기
$env:MSYS_NO_PATHCONV = '1'
$env:MSYS2_ENV_CONV_EXCL = '*'

# pnpm 찾기: 전역 pnpm → corepack(Node 24 이하) → npx(Node 25+는 corepack 미포함)
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
$Pnpm = $null
if (Test-Command 'pnpm') { $Pnpm = @('pnpm') }
elseif (Test-Command 'corepack') { $Pnpm = @('corepack', 'pnpm') }
elseif (Test-Command 'npx') { $Pnpm = @('npx', '--yes', 'pnpm@10.26.1') }
if (-not $Pnpm) { Fail "[오류] pnpm을 찾을 수 없습니다. 'npm install -g pnpm@10.26.1'로 설치하세요." }
$PnpmCmd = $Pnpm -join ' '   # 새 cmd 창에 넘길 때 쓰는 문자열
function Invoke-Pnpm {
  $rest = @($Pnpm | Select-Object -Skip 1) + $args
  & $Pnpm[0] @rest
  $LASTEXITCODE -eq 0
}

# ---- 2. 환경 변수 (.env) -----------------------------
# 예전 이름(.env.local)을 쓰던 경우 .env 하나로 합친다
if (-not (Test-Path '.env') -and (Test-Path '.env.local')) {
  Rename-Item '.env.local' '.env'
  Write-Host '[안내] .env.local 파일을 .env로 이름을 바꿨습니다.'
}
if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Start-Process notepad '.env'
  Fail @(
    '[안내] .env 파일을 새로 만들었습니다.',
    '       DATABASE_URL을 이 PC의 PostgreSQL 계정에 맞게 고치고,',
    '       SESSION_SECRET을 임의의 긴 문자열로 바꾼 뒤 다시 실행하세요.'
  )
}

# KEY=VALUE 줄을 읽는다. # 주석·빈 줄은 건너뛰고, 값은 첫 '=' 뒤 전체를 그대로 쓴다.
foreach ($line in Get-Content '.env' -Encoding UTF8) {
  if ($line -match '^\s*(#|$)') { continue }
  $i = $line.IndexOf('=')
  if ($i -lt 1) { continue }
  Set-Item -Path "Env:$($line.Substring(0, $i).Trim())" -Value $line.Substring($i + 1)
}

if (-not $env:DATABASE_URL) { Fail '[오류] .env에 DATABASE_URL이 없습니다.' }
if (-not $env:SESSION_SECRET) { Fail '[오류] .env에 SESSION_SECRET이 없습니다.' }
if (-not $env:API_PORT) { $env:API_PORT = '8080' }
if (-not $env:WEB_PORT) { $env:WEB_PORT = '3000' }
$ApiPort = $env:API_PORT
$WebPort = $env:WEB_PORT
if ($ApiPort -eq $WebPort) { Fail '[오류] API_PORT와 WEB_PORT는 서로 달라야 합니다.' }

# 개발용 HTTPS: .env에 DEV_HTTPS_CERT/DEV_HTTPS_KEY가 있으면 웹 서버가 https로 뜬다 (docs/HTTPS.md)
$WebScheme = if ($env:DEV_HTTPS_CERT) { 'https' } else { 'http' }

# 도메인 공개(--host) 사전 점검 — 서버를 띄우기 전에 빠르게 실패한다
if ($HostDomain) {
  if (-not $env:DOMAIN) { Fail '[오류] .env에 DOMAIN이 비어 있습니다. 예: DOMAIN=example.com' }
  if (-not (Test-Command 'caddy')) {
    Fail @(
      '[오류] caddy가 없습니다. 관리자 PowerShell에서 아래를 한 번 실행하세요.',
      '       powershell -ExecutionPolicy Bypass -File scripts\windows\setup-host.ps1'
    )
  }
  # Caddy는 웹 서버에 http로 연결한다. 개발용 https 인증서를 켜 두면 연결이 깨지므로 막는다.
  if ($WebScheme -eq 'https') {
    Fail @(
      '[오류] 도메인 공개(--host)는 Caddy가 인증서를 맡습니다.',
      '       .env의 DEV_HTTPS_CERT, DEV_HTTPS_KEY를 비우고 다시 실행하세요.'
    )
  }
}

# ---- 3. 의존성 설치 (처음 한 번 / lock 파일 변경 시) --------
$NeedInstall = -not (Test-Path 'artifacts\job-doc-check\node_modules') -or
               -not (Test-Path 'node_modules\.pnpm\node_modules\@esbuild\win32-x64')
if ($NeedInstall) {
  Write-Host '[1/4] 의존성을 설치합니다...'
  if (-not (Invoke-Pnpm install)) { Fail '[오류] pnpm install에 실패했습니다.' }
} else {
  Write-Host '[1/4] 의존성 확인 완료'
}

# ---- 4. DB 스키마 적용 (처음 한 번 또는 --push) -------------
$PushMarker = 'node_modules\.ats-db-pushed'
if ($ForcePush) { Remove-Item $PushMarker -Force -ErrorAction SilentlyContinue }
if (-not (Test-Path $PushMarker)) {
  Write-Host '[2/4] DB 스키마를 적용합니다...'
  if (-not (Invoke-Pnpm --filter '@workspace/db' run push)) {
    Fail '[오류] DB 스키마 적용에 실패했습니다. PostgreSQL 실행 여부와 DATABASE_URL을 확인하세요.'
  }
  New-Item -ItemType File $PushMarker -Force | Out-Null
} else {
  Write-Host '[2/4] DB 스키마 적용됨 (다시 적용: dev-windows.bat --push)'
}

# 새 cmd 창을 열어 명령을 실행한다. 창은 이 스크립트의 환경 변수를 그대로 물려받는다.
function Start-Window([string]$Title, [string]$Command) {
  Start-Process cmd.exe -WorkingDirectory $Root -ArgumentList "/k title $Title&& $Command"
}
function Wait-Url([string]$Url, [int]$Seconds, [switch]$Insecure) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    if (Test-Url $Url -Insecure:$Insecure) { return $true }
    Start-Sleep -Seconds 1
  }
  $false
}

# ---- 5. API 서버 ------------------------------------------
$ApiHealth = "http://127.0.0.1:$ApiPort/api/healthz"
if (Test-Url $ApiHealth) {
  Write-Host "[3/4] API 서버가 이미 실행 중입니다 (포트 $ApiPort)"
} else {
  Write-Host "[3/4] API 서버 시작 (포트 $ApiPort)..."
  Start-Window "My ATS - API ($ApiPort)" "set PORT=$ApiPort&& $PnpmCmd --filter @workspace/api-server run dev"
  if (-not (Wait-Url $ApiHealth 120)) {
    Fail '[오류] API 서버가 120초 안에 뜨지 않았습니다. "My ATS - API" 창의 로그를 확인하세요.'
  }
}
Write-Host '      API 서버 준비 완료'

# ---- 6. 웹 프론트엔드 --------------------------------------
# -k: 개발용 인증서(mkcert)는 curl이 모르는 인증 기관이라 검증을 건너뛴다
$WebUrl = "${WebScheme}://127.0.0.1:$WebPort/"
if (Test-Url $WebUrl -Insecure) {
  Write-Host "[4/4] 웹 프론트엔드가 이미 실행 중입니다 (포트 $WebPort)"
} else {
  Write-Host "[4/4] 웹 프론트엔드 시작 (포트 $WebPort)..."
  Start-Window "My ATS - Web ($WebPort)" "set PORT=$WebPort&& set BASE_PATH=/&& set API_PROXY_TARGET=http://127.0.0.1:$ApiPort&& $PnpmCmd --filter @workspace/job-doc-check run dev"
  if (-not (Wait-Url $WebUrl 90 -Insecure)) {
    Fail '[오류] 웹 서버가 90초 안에 뜨지 않았습니다. "My ATS - Web" 창의 로그를 확인하세요.'
  }
}

# ---- 7. 도메인 공개 (--host) -------------------------------
# Caddyfile은 환경 변수 DOMAIN, WEB_PORT를 읽는다 (새 창에 그대로 전달됨)
if ($HostDomain) {
  if (Get-Process caddy -ErrorAction SilentlyContinue) {
    Write-Host "[+] Caddy가 이미 실행 중입니다 (https://$env:DOMAIN)"
  } else {
    Write-Host "[+] 도메인 공개 시작 (https://$env:DOMAIN)..."
    Write-Host '    처음 실행하면 인증서 발급에 몇 초~1분 걸립니다. 공유기에서 80, 443 포트를 이 PC로 넘겨야 합니다.'
    Start-Window 'My ATS - Domain (Caddy)' 'caddy run --config scripts\windows\Caddyfile --adapter caddyfile'
  }
}

if ($OpenBrowser) { Start-Process "${WebScheme}://localhost:$WebPort" }

Write-Host ''
Write-Host '========================================='
if ($HostDomain) { Write-Host ' 개발 서버 + 도메인 공개 실행 중' } else { Write-Host ' 개발 서버 실행 중' }
Write-Host '========================================='
Write-Host "  웹:      ${WebScheme}://localhost:$WebPort"
if ($HostDomain) { Write-Host "  도메인:  https://$env:DOMAIN" }
Write-Host "  API:     http://localhost:$ApiPort/api/healthz"
Write-Host "  관리자:  ${WebScheme}://localhost:$WebPort/admin"
if ($HostDomain) {
  Write-Host '  종료:    "My ATS - API" / "My ATS - Web" / "My ATS - Domain (Caddy)" 창을 닫으세요'
} else {
  Write-Host '  종료:    "My ATS - API" / "My ATS - Web" 창을 닫으세요'
}
exit 0
