#!/bin/bash

# =====================================================
#  AI 서류 심사관 (ATS) 설치 스크립트
#  대상 OS: Ubuntu 20.04+ / Debian, Rocky Linux 8+ / RHEL 계열
#  로컬 또는 서버 환경에 직접 설치합니다. (Docker 불필요)
#
#  구성 요소:
#    - Node.js 20 + pnpm (모노레포 빌드)
#    - PostgreSQL 15+ (데이터베이스)
#    - API 서버 (Express, systemd 서비스로 등록)
#    - 웹 프론트엔드 (정적 빌드, Nginx로 서빙)
#    - OpenAI API 연동 (API 키 필요)
# =====================================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="ats-checker"
API_PORT="${API_PORT:-8080}"
WEB_PORT="${WEB_PORT:-80}"
DB_NAME="${DB_NAME:-ats_checker}"
DB_USER="${DB_USER:-ats_user}"

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   AI 서류 심사관 (ATS) 설치 스크립트${NC}"
echo -e "${BLUE}==============================================${NC}"
echo -e "  설치 경로: ${GREEN}${INSTALL_DIR}${NC}"
echo ""

# =====================================
# 1. OS 감지
# =====================================
detect_os() {
    echo -e "${CYAN}[1/8] OS 정보 확인${NC}"
    OS_FAMILY="unknown"
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            rocky|rhel|centos|almalinux|ol) OS_FAMILY="rhel" ;;
            ubuntu|debian)                  OS_FAMILY="debian" ;;
        esac
        echo -e "  OS: ${GREEN}${NAME} ${VERSION_ID}${NC} (계열: ${OS_FAMILY})"
    fi
    if [ "$OS_FAMILY" = "unknown" ]; then
        echo -e "${RED}[오류] 지원하지 않는 OS입니다. Ubuntu/Debian 또는 Rocky/RHEL 계열이 필요합니다.${NC}"
        exit 1
    fi

    if [ "$OS_FAMILY" = "rhel" ]; then
        PKG="dnf"
        command -v dnf &>/dev/null || PKG="yum"
    else
        PKG="apt-get"
    fi

    # root 또는 sudo 확인
    SUDO=""
    if [ "$(id -u)" -ne 0 ]; then
        if command -v sudo &>/dev/null; then
            SUDO="sudo"
        else
            echo -e "${RED}[오류] root 권한 또는 sudo가 필요합니다.${NC}"
            exit 1
        fi
    fi
    echo ""
}

# =====================================
# 2. 기본 패키지 설치
# =====================================
install_base_packages() {
    echo -e "${CYAN}[2/8] 기본 패키지 설치${NC}"
    if [ "$OS_FAMILY" = "debian" ]; then
        $SUDO apt-get update -y
        $SUDO apt-get install -y curl ca-certificates gnupg git build-essential openssl
    else
        $SUDO $PKG install -y curl ca-certificates git gcc-c++ make openssl
    fi
    echo -e "  ${GREEN}완료${NC}"
    echo ""
}

# =====================================
# 3. Node.js 20 + pnpm 설치
# =====================================
install_nodejs() {
    echo -e "${CYAN}[3/8] Node.js 20 + pnpm 설치${NC}"
    NEED_NODE=true
    if command -v node &>/dev/null; then
        NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
        if [ "$NODE_MAJOR" -ge 20 ]; then
            echo -e "  Node.js $(node -v) 이미 설치됨"
            NEED_NODE=false
        fi
    fi

    if [ "$NEED_NODE" = true ]; then
        if [ "$OS_FAMILY" = "debian" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
            $SUDO apt-get install -y nodejs
        else
            curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
            $SUDO $PKG install -y nodejs
        fi
    fi

    if ! command -v pnpm &>/dev/null; then
        $SUDO npm install -g pnpm@10
    fi
    echo -e "  Node: ${GREEN}$(node -v)${NC} / pnpm: ${GREEN}$(pnpm -v)${NC}"
    echo ""
}

# =====================================
# 4. PostgreSQL 설치 및 DB 생성
# =====================================
install_postgres() {
    echo -e "${CYAN}[4/8] PostgreSQL 설치 및 데이터베이스 생성${NC}"

    read -p "  기존 PostgreSQL 서버를 사용하시겠습니까? (y=기존 사용 / n=새로 설치): " USE_EXISTING_DB
    if [ "$USE_EXISTING_DB" = "y" ] || [ "$USE_EXISTING_DB" = "Y" ]; then
        read -p "  DATABASE_URL을 입력하세요 (예: postgres://user:pass@host:5432/dbname): " DATABASE_URL
        if [ -z "$DATABASE_URL" ]; then
            echo -e "${RED}[오류] DATABASE_URL이 비어 있습니다.${NC}"; exit 1
        fi
        echo ""
        return
    fi

    if ! command -v psql &>/dev/null; then
        if [ "$OS_FAMILY" = "debian" ]; then
            $SUDO apt-get install -y postgresql postgresql-contrib
        else
            $SUDO $PKG install -y postgresql-server postgresql-contrib
            # Rocky/RHEL: 초기화 필요
            if [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
                $SUDO postgresql-setup --initdb
            fi
            # 로컬 접속을 md5 인증으로 변경 (기본 ident는 패스워드 접속 불가)
            PG_HBA=$($SUDO find /var/lib/pgsql -name pg_hba.conf | head -1)
            if [ -n "$PG_HBA" ]; then
                $SUDO sed -i 's/^\(host.*127.0.0.1\/32.*\)ident/\1md5/' "$PG_HBA"
                $SUDO sed -i 's/^\(host.*::1\/128.*\)ident/\1md5/' "$PG_HBA"
            fi
        fi
    fi
    $SUDO systemctl enable --now postgresql

    # 재실행 시: 기존 .env.production의 DATABASE_URL을 그대로 사용 (비밀번호 불일치 방지)
    ENV_FILE="${INSTALL_DIR}/.env.production"
    if [ -f "$ENV_FILE" ] && grep -q "^DATABASE_URL=" "$ENV_FILE"; then
        DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | cut -d= -f2-)
        # .env의 비밀번호를 DB에 다시 적용해 항상 일치하도록 보장
        ENV_DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
        if [ -n "$ENV_DB_PASS" ]; then
            $SUDO -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${ENV_DB_PASS}';" 2>/dev/null || true
        fi
        echo -e "  기존 .env.production의 DATABASE_URL 재사용 (비밀번호 동기화 완료)"
        echo ""
        return
    fi

    # DB 및 사용자 생성 (이미 있으면 무시)
    DB_PASS=$(openssl rand -hex 16)
    $SUDO -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
        $SUDO -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    $SUDO -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
        $SUDO -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
    # 최초 생성 시에도 비밀번호를 확실히 적용
    $SUDO -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

    DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
    echo -e "  데이터베이스: ${GREEN}${DB_NAME}${NC} (사용자: ${DB_USER})"
    echo ""
}

# =====================================
# 5. 환경변수 설정 (.env)
# =====================================
setup_env() {
    echo -e "${CYAN}[5/8] 환경변수 설정${NC}"

    ENV_FILE="${INSTALL_DIR}/.env.production"
    if [ -f "$ENV_FILE" ]; then
        echo -e "  ${YELLOW}기존 ${ENV_FILE} 발견 — 재사용합니다.${NC}"
        # 기존 파일에서 DATABASE_URL이 없으면 추가
        grep -q "^DATABASE_URL=" "$ENV_FILE" || echo "DATABASE_URL=${DATABASE_URL}" >> "$ENV_FILE"
        echo ""
        return
    fi

    # AI API 키는 설치 시 입력받지 않습니다.
    # 설치 완료 후 관리자 페이지(/admin → AI 설정)에서 등록하세요.
    echo -e "  ${YELLOW}AI API 키는 설치 후 관리자 페이지(/admin → AI 설정)에서 등록합니다.${NC}"

    SESSION_SECRET=$(openssl rand -hex 32)

    cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=${API_PORT}
DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
EOF
    chmod 600 "$ENV_FILE"
    echo -e "  ${GREEN}${ENV_FILE} 생성 완료${NC}"
    echo ""
}

# =====================================
# 6. 빌드
# =====================================
build_app() {
    echo -e "${CYAN}[6/8] 애플리케이션 빌드${NC}"
    cd "$INSTALL_DIR"

    pnpm install

    # DB 스키마 반영
    echo -e "  DB 스키마 적용 중..."
    DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run push

    # API 서버 빌드
    echo -e "  API 서버 빌드 중..."
    NODE_ENV=production pnpm --filter @workspace/api-server run build

    # 프론트엔드 빌드 (vite.config.ts가 PORT/BASE_PATH를 요구함.
    #  빌드 결과물은 Nginx가 루트(/)에서 서빙하므로 BASE_PATH=/,
    #  PORT는 dev 서버용 값이라 빌드에는 영향 없음)
    echo -e "  웹 프론트엔드 빌드 중..."
    PORT=3000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/job-doc-check run build

    echo -e "  ${GREEN}빌드 완료${NC}"
    echo ""
}

# =====================================
# 7. systemd 서비스 등록 (API 서버)
# =====================================
setup_systemd() {
    echo -e "${CYAN}[7/8] systemd 서비스 등록${NC}"

    RUN_USER="${SUDO_USER:-$(whoami)}"
    $SUDO tee /etc/systemd/system/${APP_NAME}-api.service > /dev/null <<EOF
[Unit]
Description=AI 서류 심사관 API 서버
After=network.target postgresql.service

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env.production
ExecStart=$(command -v node) --enable-source-maps ${INSTALL_DIR}/artifacts/api-server/dist/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    $SUDO systemctl daemon-reload
    $SUDO systemctl enable --now ${APP_NAME}-api.service
    sleep 2
    if $SUDO systemctl is-active --quiet ${APP_NAME}-api.service; then
        echo -e "  ${GREEN}API 서버 실행 중 (포트 ${API_PORT})${NC}"
    else
        echo -e "  ${RED}API 서버 시작 실패. 로그 확인: journalctl -u ${APP_NAME}-api -n 50${NC}"
    fi
    echo ""
}

# =====================================
# 8. Nginx 설치 및 설정 (프론트엔드 + API 프록시)
# =====================================
setup_nginx() {
    echo -e "${CYAN}[8/8] Nginx 설치 및 설정${NC}"

    if ! command -v nginx &>/dev/null; then
        if [ "$OS_FAMILY" = "debian" ]; then
            $SUDO apt-get install -y nginx
        else
            $SUDO $PKG install -y nginx
        fi
    fi

    BUILD_DIR="${INSTALL_DIR}/artifacts/job-doc-check/dist/public"
    # vite outDir이 dist인 경우 대비
    [ -d "$BUILD_DIR" ] || BUILD_DIR="${INSTALL_DIR}/artifacts/job-doc-check/dist"

    # 홈 디렉토리는 nginx(www-data)가 접근할 수 없으므로 /var/www로 복사해 서빙
    STATIC_DIR="/var/www/${APP_NAME}"
    $SUDO mkdir -p "$STATIC_DIR"
    $SUDO rm -rf "${STATIC_DIR:?}"/*
    $SUDO cp -r "$BUILD_DIR"/. "$STATIC_DIR"/
    $SUDO chmod -R a+rX "$STATIC_DIR"

    NGINX_CONF="/etc/nginx/conf.d/${APP_NAME}.conf"
    $SUDO tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen ${WEB_PORT};
    server_name _;

    client_max_body_size 20M;

    # API 프록시
    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    # 정적 프론트엔드 (SPA)
    location / {
        root ${STATIC_DIR};
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    # Ubuntu 기본 사이트 비활성화 (포트 충돌 방지)
    [ -f /etc/nginx/sites-enabled/default ] && $SUDO rm -f /etc/nginx/sites-enabled/default

    # Rocky/RHEL: SELinux에서 nginx가 앱 디렉토리 및 프록시 접근 허용
    if [ "$OS_FAMILY" = "rhel" ] && command -v setsebool &>/dev/null; then
        $SUDO setsebool -P httpd_can_network_connect 1 || true
        command -v chcon &>/dev/null && $SUDO chcon -Rt httpd_sys_content_t "$STATIC_DIR" 2>/dev/null || true
    fi

    $SUDO nginx -t && $SUDO systemctl enable --now nginx && $SUDO systemctl reload nginx

    # 방화벽 개방 (설치되어 있는 경우만)
    if command -v firewall-cmd &>/dev/null && $SUDO firewall-cmd --state &>/dev/null; then
        $SUDO firewall-cmd --permanent --add-port=${WEB_PORT}/tcp || true
        $SUDO firewall-cmd --reload || true
    elif command -v ufw &>/dev/null && $SUDO ufw status | grep -q active; then
        $SUDO ufw allow ${WEB_PORT}/tcp || true
    fi

    echo -e "  ${GREEN}Nginx 설정 완료${NC}"
    echo ""
}

# =====================================
# 9. (선택) 로컬 LLM(Ollama) 설치
# =====================================
OLLAMA_INSTALLED=false
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:14b}"
install_ollama() {
    echo -e "${CYAN}[선택] 로컬 LLM(Ollama) 설치${NC}"
    read -p "  로컬 LLM(Ollama)을 설치하시겠습니까? (y/n): " INSTALL_LLM
    if [ "$INSTALL_LLM" != "y" ] && [ "$INSTALL_LLM" != "Y" ]; then
        echo -e "  ${YELLOW}건너뜁니다. (나중에 관리자 페이지에서 외부 API 또는 로컬 LLM을 설정할 수 있습니다)${NC}"
        echo ""
        return
    fi

    # Ollama 설치 (이미 있으면 생략)
    if command -v ollama &>/dev/null; then
        echo -e "  Ollama 이미 설치됨: $(ollama --version 2>/dev/null | head -1)"
    else
        echo -e "  Ollama 설치 중..."
        curl -fsSL https://ollama.com/install.sh | sh
    fi

    # systemd 등록 및 시작 (공식 스크립트가 등록하지만, WSL 등에서 누락될 수 있어 보강)
    if [ ! -f /etc/systemd/system/ollama.service ] && [ ! -f /usr/lib/systemd/system/ollama.service ]; then
        OLLAMA_BIN=$(command -v ollama)
        $SUDO tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=${OLLAMA_BIN} serve
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=127.0.0.1:11434"

[Install]
WantedBy=multi-user.target
EOF
        $SUDO systemctl daemon-reload
    fi
    $SUDO systemctl enable --now ollama 2>/dev/null || true

    # 서버 기동 대기
    echo -e "  Ollama 서버 기동 대기 중..."
    for i in $(seq 1 30); do
        if curl -fsS http://localhost:11434/api/version &>/dev/null; then break; fi
        sleep 1
    done
    if ! curl -fsS http://localhost:11434/api/version &>/dev/null; then
        echo -e "  ${RED}Ollama 서버가 응답하지 않습니다. 수동 확인: systemctl status ollama${NC}"
        echo ""
        return
    fi

    # 권장 모델 다운로드 (RAM 32GB 기준 qwen2.5:14b 권장)
    echo -e "  권장 모델 다운로드 중: ${GREEN}${OLLAMA_MODEL}${NC} (수 GB, 시간이 걸릴 수 있습니다)"
    if ollama pull "$OLLAMA_MODEL"; then
        OLLAMA_INSTALLED=true
        echo -e "  ${GREEN}로컬 LLM 설치 완료${NC}"
    else
        echo -e "  ${RED}모델 다운로드 실패. 나중에 수동 실행: ollama pull ${OLLAMA_MODEL}${NC}"
    fi
    echo ""
}

# =====================================
# 실행
# =====================================
detect_os
install_base_packages
install_nodejs
install_postgres
setup_env
build_app
setup_systemd
setup_nginx
install_ollama

HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$HOST_IP" ] && HOST_IP="localhost"

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}   설치 완료!${NC}"
echo -e "${GREEN}==============================================${NC}"
echo ""
echo -e "${BLUE}[접속 정보]${NC}"
echo "  웹 접속:     http://${HOST_IP}:${WEB_PORT}"
echo "  관리자 포털: http://${HOST_IP}:${WEB_PORT}/admin/login"
echo "  API 상태:    curl http://localhost:${API_PORT}/api/healthz"
echo ""
echo -e "${BLUE}[서비스 관리]${NC}"
echo "  API 상태 확인: systemctl status ${APP_NAME}-api"
echo "  API 재시작:    sudo systemctl restart ${APP_NAME}-api"
echo "  API 로그:      journalctl -u ${APP_NAME}-api -f"
echo "  Nginx 재시작:  sudo systemctl restart nginx"
echo ""
echo -e "${BLUE}[AI 설정 (필수)]${NC}"
echo "  관리자 포털(/admin) 로그인 → 'AI 설정' 탭에서 등록:"
if [ "$OLLAMA_INSTALLED" = true ]; then
    echo "   ✔ 로컬 LLM(Ollama) 설치 완료 — 아래 값을 그대로 입력하세요:"
    echo "      Base URL: http://localhost:11434/v1"
    echo "      API 키:   ollama"
    echo "      모델:     ${OLLAMA_MODEL}"
else
    echo "   - OpenAI 사용:  Base URL=https://api.openai.com/v1, API 키=sk-..., 모델=gpt-4o-mini 등"
    echo "   - 로컬 LLM(Ollama): Base URL=http://localhost:11434/v1, API 키=ollama, 모델=qwen2.5:14b 등"
fi
echo "  저장 후 '연결 테스트' 버튼으로 확인하세요."
echo ""
echo -e "${BLUE}[환경변수]${NC}"
echo "  설정 파일: ${INSTALL_DIR}/.env.production"
echo "  변경 후:   sudo systemctl restart ${APP_NAME}-api"
echo ""
echo -e "${BLUE}[업데이트 방법]${NC}"
echo "  1. 코드 갱신 (git pull 또는 파일 복사)"
echo "  2. bash ${INSTALL_DIR}/install.sh 재실행 (기존 설정 유지됨)"
echo ""
