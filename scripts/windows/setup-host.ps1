#Requires -RunAsAdministrator
# =========================================================
# 이 PC를 도메인 서버로 쓰기 위한 1회 설정 (관리자 권한 필요)
#  1. IIS(기본 웹 서버) 중지 — 80번 포트를 Caddy가 쓰도록
#  2. Caddy 설치 (Chocolatey)
#  3. Windows 방화벽에서 80/443 포트 허용
# 되돌리기: Set-Service W3SVC -StartupType Automatic; Start-Service W3SVC
# =========================================================
$ErrorActionPreference = 'Stop'

Write-Host '[1/3] IIS 중지' -ForegroundColor Cyan
$iis = Get-Service W3SVC -ErrorAction SilentlyContinue
if ($iis) {
    if ($iis.Status -ne 'Stopped') { Stop-Service W3SVC -Force }
    Set-Service W3SVC -StartupType Disabled
    Write-Host '  IIS를 중지하고 자동 시작을 껐습니다.'
} else {
    Write-Host '  IIS가 없습니다. 건너뜀'
}

Write-Host '[2/3] Caddy 설치' -ForegroundColor Cyan
if (Get-Command caddy -ErrorAction SilentlyContinue) {
    Write-Host '  이미 설치됨'
} elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install caddy -y --no-progress
} else {
    winget install --id CaddyServer.Caddy -e --accept-source-agreements --accept-package-agreements
}

Write-Host '[3/3] 방화벽 규칙' -ForegroundColor Cyan
$rules = @(
    @{ Name = 'My ATS - HTTP (80)';    Protocol = 'TCP'; Port = 80 },
    @{ Name = 'My ATS - HTTPS (443)';  Protocol = 'TCP'; Port = 443 },
    @{ Name = 'My ATS - HTTP3 (443)';  Protocol = 'UDP'; Port = 443 }
)
foreach ($r in $rules) {
    if (-not (Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Action Allow `
            -Protocol $r.Protocol -LocalPort $r.Port | Out-Null
        Write-Host "  추가: $($r.Name)"
    } else {
        Write-Host "  이미 있음: $($r.Name)"
    }
}

Write-Host ''
Write-Host '설정 완료. 이제 host-windows.bat을 실행하세요.' -ForegroundColor Green
