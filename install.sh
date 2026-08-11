#!/bin/bash

# ----------------------------------------
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
# ----------------------------------------

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

echo -e "${BLUE}----------------------------------------${NC}"
echo -e "${BLUE}   AI 서류 심사관 (ATS) 설치 스크립트${NC}"
echo -e "${BLUE}----------------------------------------${NC}"
echo -e "  설치 경로: ${GREEN}${INSTALL_DIR}${NC}"
echo ""

# ----------------------------------------
# 1. OS 감지
# ----------------------------------------
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
}

# postgres 사용자로 psql 실행 (root로 실행 시 $SUDO가 비어 있어도 동작하도록)
psql_as_postgres() {
    if [ -n "$SUDO" ]; then
        $SUDO -u postgres psql "$@"
    elif command -v runuser &>/dev/null; then
        runuser -u postgres -- psql "$@"
    else
        su -s /bin/sh postgres -c "psql $(printf '%q ' "$@")"
    fi
}

# ----------------------------------------
# 2. 기본 패키지 설치
# ----------------------------------------
install_base_packages() {
    echo -e "${CYAN}[2/8] 기본 패키지 설치${NC}"
    if [ "$OS_FAMILY" = "debian" ]; then
        $SUDO apt-get update -y
        $SUDO apt-get install -y curl ca-certificates gnupg git build-essential openssl acl zstd
    else
        $SUDO $PKG install -y curl ca-certificates git gcc-c++ make openssl acl zstd
    fi
    echo -e "  ${GREEN}완료${NC}"
    echo ""
}

# ----------------------------------------
# 3. Node.js 20 + pnpm 설치
# ----------------------------------------
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

# ----------------------------------------
# 4. PostgreSQL 설치 및 DB 생성
# ----------------------------------------
install_postgres() {
    echo -e "${CYAN}[4/8] PostgreSQL 설치 및 데이터베이스 생성${NC}"

    read -p "  기존 PostgreSQL 서버를 사용하시겠습니까? (y=기존 사용 / n=새로 설치): " USE_EXISTING_DB
    if [ "$USE_EXISTING_DB" = "y" ] || [ "$USE_EXISTING_DB" = "Y" ]; then
        read -p "  DATABASE_URL을 입력하세요 (예: postgres://user:pass@host:5432/dbname): " DATABASE_URL
        if [ -z "$DATABASE_URL" ]; then
            echo -e "${RED}[오류] DATABASE_URL이 비어 있습니다.${NC}"; exit 1
        fi
        # 재실행 시 기존 .env.production의 DATABASE_URL을 새 값으로 갱신 (빌드/서비스 불일치 방지)
        ENV_FILE="${INSTALL_DIR}/.env.production"
        if [ -f "$ENV_FILE" ] && grep -q "^DATABASE_URL=" "$ENV_FILE"; then
            TMP_ENV=$(mktemp)
            awk -v url="$DATABASE_URL" 'BEGIN{FS=OFS="="} /^DATABASE_URL=/{print "DATABASE_URL" OFS url; next} {print}' "$ENV_FILE" > "$TMP_ENV"
            cat "$TMP_ENV" > "$ENV_FILE"
            rm -f "$TMP_ENV"
            echo -e "  기존 .env.production의 DATABASE_URL을 새 값으로 갱신했습니다."
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
        # (로컬 DB를 가리키는 경우에만 — 외부 DB URL이면 로컬 사용자 비밀번호를 건드리지 않음)
        ENV_DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
        ENV_DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
        if [ -n "$ENV_DB_PASS" ] && { [ "$ENV_DB_HOST" = "localhost" ] || [ "$ENV_DB_HOST" = "127.0.0.1" ]; }; then
            psql_as_postgres -c "ALTER USER ${DB_USER} WITH PASSWORD '${ENV_DB_PASS}';" 2>/dev/null || true
        fi
        echo -e "  기존 .env.production의 DATABASE_URL 재사용 (비밀번호 동기화 완료)"
        echo ""
        return
    fi

    # DB 및 사용자 생성 (이미 있으면 무시)
    DB_PASS=$(openssl rand -hex 16)
    psql_as_postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
        psql_as_postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
    psql_as_postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
        psql_as_postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
    # 최초 생성 시에도 비밀번호를 확실히 적용
    psql_as_postgres -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

    DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
    echo -e "  데이터베이스: ${GREEN}${DB_NAME}${NC} (사용자: ${DB_USER})"
    echo ""
}

# ----------------------------------------
# 5. 환경변수 설정 (.env)
# ----------------------------------------
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

# ----------------------------------------
# 6. 빌드
# ----------------------------------------
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

# ----------------------------------------
# 7. systemd 서비스 등록 (API 서버)
# ----------------------------------------
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
    $SUDO systemctl enable ${APP_NAME}-api.service
    # 재실행 시에도 새 빌드가 반영되도록 restart 사용 (enable --now는 이미 실행 중이면 아무것도 안 함)
    $SUDO systemctl restart ${APP_NAME}-api.service
    sleep 2
    if $SUDO systemctl is-active --quiet ${APP_NAME}-api.service; then
        echo -e "  ${GREEN}API 서버 실행 중 (포트 ${API_PORT})${NC}"
    else
        echo -e "  ${RED}API 서버 시작 실패. 로그 확인: journalctl -u ${APP_NAME}-api -n 50${NC}"
    fi
    echo ""
}

# ----------------------------------------
# 8. Nginx 설치 및 설정 (프론트엔드 + API 프록시)
# ----------------------------------------
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
# 상위 프록시(TLS 종료 LB 등)가 보낸 X-Forwarded-Proto가 있으면 유지,
# 없으면(직접 접속) 현재 연결의 스킴을 사용
map \$http_x_forwarded_proto \$forwarded_proto {
    default \$http_x_forwarded_proto;
    ""      \$scheme;
}

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
        proxy_set_header X-Forwarded-Proto \$forwarded_proto;
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

# ----------------------------------------
# 9. (선택) 로컬 LLM(Ollama) 설치
# ----------------------------------------
OLLAMA_INSTALLED=false
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:14b}"
OLLAMA_PULL_RETRIES="${OLLAMA_PULL_RETRIES:-3}"
OLLAMA_PULL_RETRY_DELAY="${OLLAMA_PULL_RETRY_DELAY:-10}"
# Ollama 서비스가 실제 사용하는 모델 저장 경로 확정 (systemd Environment 우선)
detect_ollama_models_dir() {
    OLLAMA_MODELS_DIR=""
    SVC_ENV=$($SUDO systemctl show ollama -p Environment --value 2>/dev/null || true)
    for kv in $SVC_ENV; do
        case "$kv" in
            OLLAMA_MODELS=*) OLLAMA_MODELS_DIR="${kv#OLLAMA_MODELS=}" ;;
        esac
    done
    if [ -z "$OLLAMA_MODELS_DIR" ]; then
        # 공식 설치 스크립트 기본값: ollama 시스템 사용자의 홈
        if id ollama &>/dev/null; then
            OLLAMA_MODELS_DIR="/usr/share/ollama/.ollama/models"
        else
            OLLAMA_MODELS_DIR="${HOME}/.ollama/models"
        fi
    fi
}

# API 서버 실행 계정이 불완전(partial) blob을 삭제할 수 있도록 최소 권한 부여
# (파일 unlink에는 상위 디렉터리 쓰기 권한이 필요함. Ollama 서비스는 보통
#  ollama 계정으로 돌아 blobs 디렉터리가 ollama:ollama 소유이기 때문)
grant_cleanup_permission() {
    RUN_USER="${SUDO_USER:-$(whoami)}"
    BLOBS_DIR="${OLLAMA_MODELS_DIR}/blobs"
    # Ollama 서비스 실행 계정 확인 (디렉터리를 새로 만들 때 소유권을 이 계정에 줘야
    # 서비스가 pull 시 blob을 기록할 수 있음. root 소유로 만들면 pull이 실패한다)
    OLLAMA_SVC_USER=$($SUDO systemctl show ollama -p User --value 2>/dev/null || true)
    if [ -z "$OLLAMA_SVC_USER" ]; then
        if id ollama &>/dev/null; then OLLAMA_SVC_USER="ollama"; else OLLAMA_SVC_USER="$RUN_USER"; fi
    fi
    if [ ! -d "$BLOBS_DIR" ]; then
        $SUDO mkdir -p "$BLOBS_DIR" 2>/dev/null || true
        # 새로 만든 저장소는 반드시 Ollama 서비스 계정 소유로.
        # 소유권 변경은 모델 저장소 자신에게만 적용 (상위 디렉터리는 절대 건드리지 않음)
        $SUDO chown "${OLLAMA_SVC_USER}:${OLLAMA_SVC_USER}" "$OLLAMA_MODELS_DIR" "$BLOBS_DIR" 2>/dev/null || true
    fi
    [ -d "$BLOBS_DIR" ] || return 0
    # 소유권 안전장치: 어떤 경로로든 root 소유가 됐다면 서비스 계정으로 복구 (저장소 범위로 한정)
    if [ "$(stat -c %U "$BLOBS_DIR" 2>/dev/null)" = "root" ] && [ "$OLLAMA_SVC_USER" != "root" ]; then
        $SUDO chown "${OLLAMA_SVC_USER}:${OLLAMA_SVC_USER}" "$OLLAMA_MODELS_DIR" "$BLOBS_DIR" 2>/dev/null || true
    fi
    # 이미 실행 계정 소유이면 권한 작업 불필요
    [ "$(stat -c %U "$BLOBS_DIR" 2>/dev/null)" = "$RUN_USER" ] && return 0
    GRANT_OK=false
    if command -v setfacl &>/dev/null; then
        # ACL: 해당 계정에게 이 디렉터리(rwx)와 기존 파일(rw)만 허용
        if $SUDO setfacl -m "u:${RUN_USER}:rwx" "$OLLAMA_MODELS_DIR" "$BLOBS_DIR" 2>/dev/null; then
            $SUDO setfacl -m "u:${RUN_USER}:rw" "$BLOBS_DIR"/* 2>/dev/null || true
            # 새로 생성되는 blob에도 기본 ACL 적용 (이후 취소된 다운로드 파일 포함)
            $SUDO setfacl -d -m "u:${RUN_USER}:rw" "$BLOBS_DIR" 2>/dev/null || true
            GRANT_OK=true
            echo -e "  임시 파일 정리 권한 부여(ACL): ${RUN_USER} → ${BLOBS_DIR}"
        fi
    fi
    if [ "$GRANT_OK" = false ] && getent group ollama &>/dev/null; then
        # ACL 미지원/실패 시: ollama 그룹 가입 + 그룹 쓰기 허용 (차선책)
        # setgid(g+s)로 이후 생성되는 blob도 ollama 그룹 소유가 되게 해,
        # 그룹 쓰기(디렉터리)만으로 새 partial 파일도 삭제 가능하게 유지한다.
        # (unlink는 파일이 아니라 상위 디렉터리 쓰기 권한만 필요)
        if $SUDO usermod -aG ollama "$RUN_USER" 2>/dev/null \
            && $SUDO chgrp ollama "$OLLAMA_MODELS_DIR" "$BLOBS_DIR" 2>/dev/null \
            && $SUDO chmod g+rwx "$OLLAMA_MODELS_DIR" 2>/dev/null \
            && $SUDO chmod g+rwxs "$BLOBS_DIR" 2>/dev/null; then
            GRANT_OK=true
            echo -e "  임시 파일 정리 권한 부여(그룹): ${RUN_USER} → ollama 그룹 (setgid 적용)"
        fi
    fi
    # 최종 검증: 실행 계정이 실제로 blobs 디렉터리의 파일을 삭제할 수 있는지 확인
    if [ "$GRANT_OK" = true ] && command -v sudo &>/dev/null; then
        PROBE="${BLOBS_DIR}/.cleanup-permission-probe"
        $SUDO touch "$PROBE" 2>/dev/null || true
        if sudo -u "$RUN_USER" rm "$PROBE" 2>/dev/null \
            || sudo -u "$RUN_USER" -g ollama rm "$PROBE" 2>/dev/null; then
            GRANT_OK=true
        else
            $SUDO rm -f "$PROBE" 2>/dev/null || true
            GRANT_OK=false
        fi
    fi
    if [ "$GRANT_OK" = false ]; then
        echo -e "  ${YELLOW}경고: ${BLOBS_DIR}에 대한 삭제 권한을 부여하지 못했습니다. 관리자 화면의 '임시 파일 정리'가 동작하지 않을 수 있습니다.${NC}"
    fi
}

# 확정된 모델 경로를 API 서버(.env.production)와 공유하고 서비스에 반영
share_models_path_with_api() {
    ENV_FILE="${INSTALL_DIR}/.env.production"
    [ -f "$ENV_FILE" ] || return 0
    if grep -q "^OLLAMA_MODELS=" "$ENV_FILE"; then
        sed -i "s|^OLLAMA_MODELS=.*|OLLAMA_MODELS=${OLLAMA_MODELS_DIR}|" "$ENV_FILE"
    else
        echo "OLLAMA_MODELS=${OLLAMA_MODELS_DIR}" >> "$ENV_FILE"
    fi
    echo -e "  API 서버에 모델 경로 공유: OLLAMA_MODELS=${OLLAMA_MODELS_DIR}"
    # API 서비스가 이미 실행 중이면 새 환경변수 반영
    $SUDO systemctl restart ${APP_NAME}-api.service 2>/dev/null || true
}

install_ollama() {
    echo -e "${CYAN}[선택] 로컬 LLM(Ollama) 설치${NC}"
    if [ "$OLLAMA_ONLY" = true ]; then
        echo -e "  ${YELLOW}--ollama 모드: 로컬 LLM 설치 단계만 실행합니다.${NC}"
    else
        read -p "  로컬 LLM(Ollama)을 설치하시겠습니까? (y/n): " INSTALL_LLM
        if [ "$INSTALL_LLM" != "y" ] && [ "$INSTALL_LLM" != "Y" ]; then
            echo -e "  ${YELLOW}건너뜁니다. (나중에 관리자 페이지에서 외부 API 또는 로컬 LLM을 설정할 수 있습니다)${NC}"
            echo ""
            return
        fi
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

    # 모델 저장 경로 확정 + API 서버와 공유 + 정리 권한 부여
    # (pull "이전"에 실행해, 다운로드가 어디로 가든 API가 정리할 수 있게 함)
    detect_ollama_models_dir
    grant_cleanup_permission
    share_models_path_with_api

    # 권장 모델 다운로드 (RAM 32GB 기준 qwen2.5:14b 권장)
    # 네트워크가 끊겨도 자동 재시도 (Ollama pull은 이어받기를 지원하므로 재시도 시 이어서 받음)
    # 주의: `ollama pull`은 CLI가 아니라 Ollama "서버"가 blob을 기록하므로,
    #       저장 위치는 위에서 확정한 서비스의 OLLAMA_MODELS 경로다.
    echo -e "  권장 모델 다운로드 중: ${GREEN}${OLLAMA_MODEL}${NC} (수 GB, 시간이 걸릴 수 있습니다)"
    PULL_OK=false
    for attempt in $(seq 1 "$OLLAMA_PULL_RETRIES"); do
        if ollama pull "$OLLAMA_MODEL"; then
            PULL_OK=true
            break
        fi
        if [ "$attempt" -lt "$OLLAMA_PULL_RETRIES" ]; then
            echo -e "  ${YELLOW}다운로드 실패 (시도 ${attempt}/${OLLAMA_PULL_RETRIES}). ${OLLAMA_PULL_RETRY_DELAY}초 후 이어서 재시도합니다...${NC}"
            sleep "$OLLAMA_PULL_RETRY_DELAY"
        fi
    done

    # pull 이후 재적용: pull이 새로 만든 디렉터리/파일까지 권한 보장
    # (그룹 방식은 기본 ACL이 없어 새 파일에 그룹 쓰기 재부여가 필요)
    grant_cleanup_permission

    if [ "$PULL_OK" = true ]; then
        OLLAMA_INSTALLED=true
        echo -e "  ${GREEN}로컬 LLM 설치 완료${NC}"
    else
        echo -e "  ${RED}모델 다운로드가 ${OLLAMA_PULL_RETRIES}회 모두 실패했습니다.${NC}"
        echo -e "  ${YELLOW}네트워크 복구 후 아래 명령으로 이 단계만 다시 실행하세요 (전체 설치 불필요):${NC}"
        echo -e "      bash ${INSTALL_DIR}/install.sh --ollama"
    fi
    echo ""
}

# ----------------------------------------
# 실행
# ----------------------------------------
# 옵션 파싱: --ollama → 로컬 LLM 설치 단계만 실행 (전체 설치 생략)
OLLAMA_ONLY=false
case "${1:-}" in
    --ollama|--ollama-only)
        OLLAMA_ONLY=true
        ;;
    "") ;;
    *)
        echo -e "${RED}[오류] 알 수 없는 옵션: $1${NC}"
        echo "  사용법: bash install.sh            # 전체 설치"
        echo "          bash install.sh --ollama   # 로컬 LLM(Ollama) 단계만 재실행"
        exit 1
        ;;
esac

if [ "$OLLAMA_ONLY" = true ]; then
    detect_os
    install_ollama
    if [ "$OLLAMA_INSTALLED" = true ]; then
        echo -e "${GREEN}로컬 LLM(Ollama) 설치가 완료되었습니다.${NC}"
        echo "  관리자 포털(/admin) → 'AI 설정' 탭에서 등록:"
        echo "      Base URL: http://localhost:11434/v1"
        echo "      API 키:   ollama"
        echo "      모델:     ${OLLAMA_MODEL}"
    fi
    exit 0
fi

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

echo -e "${GREEN}----------------------------------------${NC}"
echo -e "${GREEN}   설치 완료!${NC}"
echo -e "${GREEN}----------------------------------------${NC}"
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
