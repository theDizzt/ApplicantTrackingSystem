#!/bin/bash

# ATENA 프로젝트 통합 관리 시스템 설치 스크립트
# 대상 OS: Rocky Linux 9.7 (Blue Onyx) / RHEL 계열, Ubuntu/Debian (WSL 포함)
# 시스템 사양을 자동으로 확인하여 적합한 언어 모델을 설치합니다.
# Ollama는 프로젝트 디렉토리에 로컬 설치됩니다 (root 권한 불필요)
# 주요 변경:
#   - WSL Ubuntu 자동 감지 및 지원 (경고 없이 진행, apt-get 안내)
#   - SadTalker Python 버전 가드: 3.8~3.11 전용 (3.12+ 비호환)
#   - Docker → Host IP: WSL 환경에서 host.docker.internal 자동 감지
#   - 코드 등록 파일 크기 제한 10MB (빌드 시 자동 반영)

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 설치 경로 (현재 스크립트와 같은 위치)
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Ollama는 현재 사용자의 홈 디렉토리에 설치 (root 계정으로 실행해도 홈 폴더에 설치됨)
OLLAMA_LOCAL_DIR="${HOME}/ollama"

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  ATENA 프로젝트 통합 관리 시스템 설치${NC}"
echo -e "${BLUE}==========================================${NC}"
echo -e "${MAGENTA}  대상 OS: Rocky Linux 9.7 / RHEL 계열${NC}"
echo -e "${MAGENTA}  Ollama 설치 경로: ${OLLAMA_LOCAL_DIR} (홈 디렉토리)${NC}"
echo ""

# =====================================
# OS 감지 및 호환성 확인
# =====================================

detect_os() {
    echo -e "${CYAN}[OS 정보 확인]${NC}"

    OS_NAME="Unknown"
    OS_VERSION="Unknown"
    OS_FAMILY="unknown"

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="${NAME:-Unknown}"
        OS_VERSION="${VERSION_ID:-Unknown}"

        case "$ID" in
            rocky|rhel|centos|almalinux|ol)
                OS_FAMILY="rhel"
                ;;
            ubuntu|debian)
                OS_FAMILY="debian"
                ;;
            *)
                OS_FAMILY="other"
                ;;
        esac
    fi

    # WSL 환경 감지 (Windows Subsystem for Linux)
    WSL_MODE=false
    if grep -qi microsoft /proc/version 2>/dev/null || grep -qi wsl /proc/version 2>/dev/null; then
        WSL_MODE=true
    fi

    echo -e "  OS: ${GREEN}${OS_NAME} ${OS_VERSION}${NC}"
    echo -e "  계열: ${GREEN}${OS_FAMILY}${NC}"
    if [ "$WSL_MODE" = "true" ]; then
        echo -e "  환경: ${CYAN}WSL (Windows Subsystem for Linux)${NC}"
    fi

    if [ "$OS_FAMILY" = "rhel" ]; then
        : # Rocky/RHEL 계열 — 정상 경로
    elif [ "$OS_FAMILY" = "debian" ]; then
        echo -e "${CYAN}[정보] Ubuntu/Debian 계열이 감지되었습니다. apt-get 경로로 진행합니다.${NC}"
        if [ "$WSL_MODE" = "true" ]; then
            echo -e "${CYAN}  WSL 환경 — Docker Desktop 또는 WSL 내 Docker를 사용해 주세요.${NC}"
        fi
    else
        echo -e "${YELLOW}[경고] 이 스크립트는 Rocky Linux 9.7 / RHEL 계열에 최적화되어 있습니다.${NC}"
        echo -e "${YELLOW}현재 OS: ${OS_NAME} ${OS_VERSION}${NC}"
        read -p "계속 진행하시겠습니까? (y/n): " OS_CONTINUE
        if [ "$OS_CONTINUE" != "y" ] && [ "$OS_CONTINUE" != "Y" ]; then
            echo "설치가 취소되었습니다."
            exit 1
        fi
    fi
    echo ""
}

# =====================================
# 시스템 사양 확인 함수들
# =====================================

detect_system_specs() {
    echo -e "${CYAN}[시스템 사양 자동 감지]${NC}"
    echo ""

    # CPU 정보
    echo -e "${YELLOW}[1/4] CPU 정보 확인 중...${NC}"
    if [ -f /proc/cpuinfo ]; then
        CPU_MODEL=$(grep -m1 "model name" /proc/cpuinfo | cut -d: -f2 | xargs)
        CPU_CORES=$(grep -c "^processor" /proc/cpuinfo)
        CPU_SOCKETS=$(grep "physical id" /proc/cpuinfo | sort -u | wc -l)
        CPU_CORES_PER_SOCKET=$(grep "cpu cores" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs 2>/dev/null || echo "$CPU_CORES")
    elif command -v sysctl &> /dev/null; then
        CPU_MODEL=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
        CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo "1")
        CPU_SOCKETS=1
        CPU_CORES_PER_SOCKET=$CPU_CORES
    else
        CPU_MODEL="Unknown"
        CPU_CORES=1
        CPU_SOCKETS=1
        CPU_CORES_PER_SOCKET=1
    fi
    echo -e "  CPU 모델: ${GREEN}${CPU_MODEL}${NC}"
    echo -e "  논리 CPU(스레드): ${GREEN}${CPU_CORES}${NC}"
    echo -e "  소켓 수: ${GREEN}${CPU_SOCKETS}${NC}"

    # 메모리 정보
    echo -e "${YELLOW}[2/4] 메모리 정보 확인 중...${NC}"
    if [ -f /proc/meminfo ]; then
        TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))
        TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))
    elif command -v sysctl &> /dev/null; then
        TOTAL_MEM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
        TOTAL_MEM_GB=$((TOTAL_MEM_BYTES / 1024 / 1024 / 1024))
        TOTAL_MEM_MB=$((TOTAL_MEM_BYTES / 1024 / 1024))
    else
        TOTAL_MEM_GB=8
        TOTAL_MEM_MB=8192
    fi
    echo -e "  총 메모리: ${GREEN}${TOTAL_MEM_GB}GB${NC}"

    # GPU 정보
    echo -e "${YELLOW}[3/4] GPU 정보 확인 중...${NC}"
    GPU_AVAILABLE=false
    GPU_VRAM=0
    GPU_TYPE="none"
    GPU_NAME="없음"

    # NVIDIA GPU 확인
    GPU_COMPUTE_CAP=""
    GPU_DRIVER=""
    GPU_T600_OPTIMIZED=false
    OLLAMA_GPU_LAYERS=0

    if command -v nvidia-smi &> /dev/null; then
        GPU_INFO=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>/dev/null || echo "")
        if [ -n "$GPU_INFO" ]; then
            GPU_AVAILABLE=true
            GPU_TYPE="nvidia"
            GPU_NAME=$(echo "$GPU_INFO" | head -1 | cut -d',' -f1 | xargs)
            GPU_VRAM_MB=$(echo "$GPU_INFO" | head -1 | cut -d',' -f2 | xargs)
            GPU_VRAM=$((GPU_VRAM_MB / 1024))
            GPU_COUNT=$(echo "$GPU_INFO" | wc -l)
            GPU_COMPUTE_CAP=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader 2>/dev/null | head -1 || echo "unknown")
            GPU_DRIVER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1 || echo "unknown")
            echo -e "  GPU: ${GREEN}${GPU_NAME} x${GPU_COUNT}${NC}"
            echo -e "  VRAM: ${GREEN}${GPU_VRAM}GB${NC} (${GPU_VRAM_MB}MB) | Compute: ${GREEN}${GPU_COMPUTE_CAP}${NC} | Driver: ${GREEN}${GPU_DRIVER}${NC}"

            # GPU 레이어 결정 — T600(4096MB) 경계값 포함 처리
            if [ "${GPU_VRAM_MB:-0}" -ge 16384 ] 2>/dev/null; then
                OLLAMA_GPU_LAYERS=999
            elif [ "${GPU_VRAM_MB:-0}" -ge 8192 ] 2>/dev/null; then
                OLLAMA_GPU_LAYERS=40
            elif [ "${GPU_VRAM_MB:-0}" -ge 5120 ] 2>/dev/null; then
                OLLAMA_GPU_LAYERS=24
            elif [ "${GPU_VRAM_MB:-0}" -ge 3840 ] 2>/dev/null; then
                # T600 / 4GB VRAM: 부분 GPU 오프로딩 (14B → 16레이어)
                OLLAMA_GPU_LAYERS=16
                GPU_T600_OPTIMIZED=true
            elif [ "${GPU_VRAM_MB:-0}" -ge 2048 ] 2>/dev/null; then
                OLLAMA_GPU_LAYERS=8
            fi

            if [ "$GPU_T600_OPTIMIZED" = "true" ]; then
                echo -e "  ${YELLOW}[T600/4GB]${NC} 부분 GPU 오프로딩 모드: ${OLLAMA_GPU_LAYERS}레이어 GPU + 나머지 CPU RAM"
            else
                echo -e "  GPU 레이어: ${GREEN}${OLLAMA_GPU_LAYERS}${NC}"
            fi

            # nvidia-container-toolkit 확인 (Docker GPU 접근 필수)
            if rpm -q nvidia-container-toolkit &>/dev/null || \
               dpkg -l 2>/dev/null | grep -q "nvidia-container-toolkit"; then
                echo -e "  ${GREEN}[OK]${NC} nvidia-container-toolkit 설치됨"
            else
                echo -e "  ${YELLOW}[경고]${NC} nvidia-container-toolkit 미설치 — Docker GPU 사용 불가"
                echo -e "  ${YELLOW}설치 방법 (Rocky Linux 9):${NC}"
                echo -e "    curl -s -L https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo \\"
                echo -e "      | sudo tee /etc/yum.repos.d/nvidia-container-toolkit.repo"
                echo -e "    sudo dnf install -y nvidia-container-toolkit"
                echo -e "    sudo nvidia-ctk runtime configure --runtime=docker"
                echo -e "    sudo systemctl restart docker"
            fi
        fi
    fi

    # AMD GPU 확인
    if [ "$GPU_AVAILABLE" = false ] && command -v rocm-smi &> /dev/null; then
        GPU_INFO=$(rocm-smi --showmeminfo vram 2>/dev/null || echo "")
        if [ -n "$GPU_INFO" ]; then
            GPU_AVAILABLE=true
            GPU_TYPE="amd"
            GPU_NAME="AMD ROCm GPU"
            echo -e "  GPU: ${GREEN}AMD ROCm GPU 감지${NC}"
        fi
    fi

    if [ "$GPU_AVAILABLE" = false ]; then
        echo -e "  GPU: ${YELLOW}사용 가능한 GPU 없음 (CPU 모드 사용)${NC}"
    fi

    # 디스크 정보
    echo -e "${YELLOW}[4/4] 디스크 공간 확인 중...${NC}"
    AVAILABLE_DISK=$(df -BG "$INSTALL_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo "50")
    echo -e "  사용 가능한 디스크: ${GREEN}${AVAILABLE_DISK}GB${NC}"
    echo ""
}

# =====================================
# 성능 튜닝 자동 계산
# =====================================

calculate_tuning() {
    echo -e "${CYAN}[서버 자원 기반 성능 튜닝 계산]${NC}"
    echo ""

    # === 동시 접속자 수 ===
    MAX_USERS=${MAX_USERS:-200}

    # === PostgreSQL 튜닝 ===
    # shared_buffers: 전체 RAM의 25% (최대 32GB)
    PG_SHARED_BUFFERS_MB=$((TOTAL_MEM_MB / 4))
    if [ "$PG_SHARED_BUFFERS_MB" -gt 32768 ]; then
        PG_SHARED_BUFFERS_MB=32768
    fi
    PG_SHARED_BUFFERS_GB=$((PG_SHARED_BUFFERS_MB / 1024))

    # effective_cache_size: 전체 RAM의 75%
    PG_EFFECTIVE_CACHE_MB=$((TOTAL_MEM_MB * 3 / 4))
    PG_EFFECTIVE_CACHE_GB=$((PG_EFFECTIVE_CACHE_MB / 1024))

    # maintenance_work_mem: 전체 RAM의 5% (최대 2GB)
    PG_MAINTENANCE_WORK_MB=$((TOTAL_MEM_MB / 20))
    if [ "$PG_MAINTENANCE_WORK_MB" -gt 2048 ]; then
        PG_MAINTENANCE_WORK_MB=2048
    fi

    # work_mem: (RAM - shared_buffers) / (max_connections * 3)
    PG_MAX_CONNECTIONS=$((MAX_USERS + 50))
    PG_WORK_MEM_KB=$(( (TOTAL_MEM_MB - PG_SHARED_BUFFERS_MB) * 1024 / (PG_MAX_CONNECTIONS * 3) ))
    if [ "$PG_WORK_MEM_KB" -gt 524288 ]; then
        PG_WORK_MEM_KB=524288
    fi

    # wal_buffers: shared_buffers의 3% (최대 256MB, 최소 64MB)
    PG_WAL_BUFFERS_MB=$((PG_SHARED_BUFFERS_MB * 3 / 100))
    if [ "$PG_WAL_BUFFERS_MB" -lt 64 ]; then
        PG_WAL_BUFFERS_MB=64
    fi
    if [ "$PG_WAL_BUFFERS_MB" -gt 256 ]; then
        PG_WAL_BUFFERS_MB=256
    fi

    # max_worker_processes: CPU 코어 수 (최대 32)
    PG_MAX_WORKERS=$CPU_CORES
    if [ "$PG_MAX_WORKERS" -gt 32 ]; then
        PG_MAX_WORKERS=32
    fi

    # max_parallel_workers_per_gather: CPU 코어의 1/4 (최소 2, 최대 8)
    PG_PARALLEL_GATHER=$((CPU_CORES / 4))
    if [ "$PG_PARALLEL_GATHER" -lt 2 ]; then
        PG_PARALLEL_GATHER=2
    fi
    if [ "$PG_PARALLEL_GATHER" -gt 8 ]; then
        PG_PARALLEL_GATHER=8
    fi

    # max_parallel_workers: CPU 코어의 절반 (최대 16)
    PG_PARALLEL_WORKERS=$((CPU_CORES / 2))
    if [ "$PG_PARALLEL_WORKERS" -gt 16 ]; then
        PG_PARALLEL_WORKERS=16
    fi

    # max_parallel_maintenance_workers: CPU 코어의 1/4 (최대 8)
    PG_PARALLEL_MAINT=$((CPU_CORES / 4))
    if [ "$PG_PARALLEL_MAINT" -gt 8 ]; then
        PG_PARALLEL_MAINT=8
    fi

    # WAL 크기
    PG_MIN_WAL_SIZE="2GB"
    PG_MAX_WAL_SIZE="8GB"
    if [ "$TOTAL_MEM_GB" -lt 32 ]; then
        PG_MIN_WAL_SIZE="1GB"
        PG_MAX_WAL_SIZE="4GB"
    fi

    # === Node.js 앱 튜닝 ===
    # max-old-space-size: 전체 RAM의 15% (최소 2GB, 최대 16GB)
    # 실제 상한은 아래 DOCKER_APP_MEM_GB 계산 후 70% 이하로 재조정됨
    NODE_HEAP_MB=$((TOTAL_MEM_MB * 15 / 100))
    if [ "$NODE_HEAP_MB" -lt 2048 ]; then
        NODE_HEAP_MB=2048
    fi
    if [ "$NODE_HEAP_MB" -gt 16384 ]; then
        NODE_HEAP_MB=16384
    fi

    # UV_THREADPOOL_SIZE: CPU 코어의 절반 (최소 4, 최대 128)
    UV_POOL_SIZE=$((CPU_CORES / 2))
    if [ "$UV_POOL_SIZE" -lt 4 ]; then
        UV_POOL_SIZE=4
    fi
    if [ "$UV_POOL_SIZE" -gt 128 ]; then
        UV_POOL_SIZE=128
    fi

    # === Docker 리소스 제한 ===
    # DB 컨테이너: CPU의 20%, RAM의 30%
    DOCKER_DB_CPU=$((CPU_CORES * 20 / 100))
    if [ "$DOCKER_DB_CPU" -lt 2 ]; then
        DOCKER_DB_CPU=2
    fi
    DOCKER_DB_CPU_RESERVE=$((DOCKER_DB_CPU / 2))
    if [ "$DOCKER_DB_CPU_RESERVE" -lt 1 ]; then
        DOCKER_DB_CPU_RESERVE=1
    fi
    DOCKER_DB_MEM_GB=$((TOTAL_MEM_GB * 30 / 100))
    if [ "$DOCKER_DB_MEM_GB" -lt 4 ]; then
        DOCKER_DB_MEM_GB=4
    fi
    DOCKER_DB_MEM_RESERVE_GB=$((DOCKER_DB_MEM_GB / 2))

    # 앱 컨테이너: CPU의 30%, RAM의 25%
    DOCKER_APP_CPU=$((CPU_CORES * 30 / 100))
    if [ "$DOCKER_APP_CPU" -lt 2 ]; then
        DOCKER_APP_CPU=2
    fi
    DOCKER_APP_CPU_RESERVE=$((DOCKER_APP_CPU / 2))
    if [ "$DOCKER_APP_CPU_RESERVE" -lt 1 ]; then
        DOCKER_APP_CPU_RESERVE=1
    fi
    DOCKER_APP_MEM_GB=$((TOTAL_MEM_GB * 25 / 100))
    if [ "$DOCKER_APP_MEM_GB" -lt 6 ]; then
        DOCKER_APP_MEM_GB=6
    fi
    DOCKER_APP_MEM_RESERVE_GB=$((DOCKER_APP_MEM_GB / 2))

    # NODE_HEAP_MB은 컨테이너 메모리 한도의 70% 이하로 제한 (OOM 방지)
    DOCKER_APP_MEM_MB=$((DOCKER_APP_MEM_GB * 1024))
    MAX_NODE_HEAP_MB=$((DOCKER_APP_MEM_MB * 70 / 100))
    if [ "$NODE_HEAP_MB" -gt "$MAX_NODE_HEAP_MB" ]; then
        NODE_HEAP_MB=$MAX_NODE_HEAP_MB
    fi
    if [ "$NODE_HEAP_MB" -lt 2048 ]; then
        NODE_HEAP_MB=2048
    fi

    # === Ollama 리소스 ===
    # Ollama: CPU의 40%, RAM의 35%
    OLLAMA_CPU=$((CPU_CORES * 40 / 100))
    OLLAMA_MEM_GB=$((TOTAL_MEM_GB * 35 / 100))
    OLLAMA_NUM_PARALLEL=$((MAX_USERS / 50))
    if [ "$OLLAMA_NUM_PARALLEL" -lt 2 ]; then
        OLLAMA_NUM_PARALLEL=2
    fi
    if [ "$OLLAMA_NUM_PARALLEL" -gt 8 ]; then
        OLLAMA_NUM_PARALLEL=8
    fi

    echo -e "  ${BLUE}[PostgreSQL 튜닝]${NC}"
    echo -e "  - max_connections: ${GREEN}${PG_MAX_CONNECTIONS}${NC}"
    echo -e "  - shared_buffers: ${GREEN}${PG_SHARED_BUFFERS_GB}GB${NC}"
    echo -e "  - effective_cache_size: ${GREEN}${PG_EFFECTIVE_CACHE_GB}GB${NC}"
    echo -e "  - maintenance_work_mem: ${GREEN}${PG_MAINTENANCE_WORK_MB}MB${NC}"
    echo -e "  - work_mem: ${GREEN}${PG_WORK_MEM_KB}kB${NC}"
    echo -e "  - wal_buffers: ${GREEN}${PG_WAL_BUFFERS_MB}MB${NC}"
    echo -e "  - max_worker_processes: ${GREEN}${PG_MAX_WORKERS}${NC}"
    echo -e "  - max_parallel_workers: ${GREEN}${PG_PARALLEL_WORKERS}${NC}"
    echo -e "  - max_parallel_workers_per_gather: ${GREEN}${PG_PARALLEL_GATHER}${NC}"
    echo ""
    echo -e "  ${BLUE}[Node.js 앱 튜닝]${NC}"
    echo -e "  - max-old-space-size: ${GREEN}${NODE_HEAP_MB}MB${NC}"
    echo -e "  - UV_THREADPOOL_SIZE: ${GREEN}${UV_POOL_SIZE}${NC}"
    echo ""
    echo -e "  ${BLUE}[Docker 리소스]${NC}"
    echo -e "  - DB 컨테이너: ${GREEN}CPU ${DOCKER_DB_CPU}코어, RAM ${DOCKER_DB_MEM_GB}GB${NC}"
    echo -e "  - 앱 컨테이너: ${GREEN}CPU ${DOCKER_APP_CPU}코어, RAM ${DOCKER_APP_MEM_GB}GB${NC}"
    echo ""
    echo -e "  ${BLUE}[Ollama 리소스]${NC}"
    echo -e "  - CPU 할당: ${GREEN}${OLLAMA_CPU}코어${NC}"
    echo -e "  - 메모리 할당: ${GREEN}${OLLAMA_MEM_GB}GB${NC}"
    echo -e "  - 동시 처리: ${GREEN}${OLLAMA_NUM_PARALLEL}개${NC}"
    echo ""
}

# =====================================
# 모델 자동 선택 로직
# =====================================

auto_select_model() {
    echo -e "${CYAN}[권장 모델 자동 선택]${NC}"
    echo ""

    # 기본값
    RECOMMENDED_MODEL="qwen2.5:0.5b"
    RECOMMENDED_CODE_MODEL="qwen2.5-coder:7b"
    RECOMMENDED_EMBEDDING="nomic-embed-text"
    MODEL_TIER="최소"
    CODE_MODEL_TIER="경량"

    # GPU 사용 가능 여부와 VRAM/RAM에 따른 모델 선택
    if [ "$GPU_AVAILABLE" = true ]; then
        if [ "$GPU_VRAM" -ge 48 ]; then
            RECOMMENDED_MODEL="qwen2.5:14b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:14b"
            MODEL_TIER="고성능"
            CODE_MODEL_TIER="최고성능"
            echo -e "  ${GREEN}[최고사양 GPU 감지] VRAM ${GPU_VRAM}GB - 14B + 코드생성 14B 모델 권장${NC}"
        elif [ "$GPU_VRAM" -ge 24 ]; then
            RECOMMENDED_MODEL="qwen2.5:14b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:14b"
            MODEL_TIER="고성능"
            CODE_MODEL_TIER="고성능"
            echo -e "  ${GREEN}[고사양 GPU 감지] VRAM ${GPU_VRAM}GB - 14B + 코드생성 14B 모델 권장${NC}"
        elif [ "$GPU_VRAM" -ge 12 ]; then
            RECOMMENDED_MODEL="qwen2.5:7b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:14b"
            MODEL_TIER="중간"
            CODE_MODEL_TIER="중간"
            echo -e "  ${GREEN}[중사양 GPU 감지] VRAM ${GPU_VRAM}GB - 7B + 코드생성 14B 모델 권장${NC}"
        elif [ "$GPU_VRAM" -ge 8 ]; then
            RECOMMENDED_MODEL="qwen2.5:3b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:7b"
            MODEL_TIER="경량"
            CODE_MODEL_TIER="경량"
            echo -e "  ${GREEN}[저사양 GPU 감지] VRAM ${GPU_VRAM}GB - 3B + 코드생성 7B 모델 권장${NC}"
        elif [ "$GPU_VRAM" -ge 4 ]; then
            # T600 등 4GB VRAM: 부분 GPU 오프로딩으로 RAM이 충분하면 14B도 실행 가능
            if [ "$TOTAL_MEM_GB" -ge 32 ]; then
                RECOMMENDED_MODEL="qwen2.5:14b"
                RECOMMENDED_CODE_MODEL="qwen2.5-coder:14b"
                MODEL_TIER="고성능 (GPU ${OLLAMA_GPU_LAYERS}레이어+CPU)"
                CODE_MODEL_TIER="고성능 (GPU+CPU)"
                echo -e "  ${GREEN}[T600/4GB GPU + RAM ${TOTAL_MEM_GB}GB]${NC} 14B 부분 GPU 오프로딩 (${OLLAMA_GPU_LAYERS}레이어 GPU, 나머지 CPU RAM)"
            elif [ "$TOTAL_MEM_GB" -ge 16 ]; then
                RECOMMENDED_MODEL="qwen2.5:7b"
                RECOMMENDED_CODE_MODEL="qwen2.5-coder:7b"
                MODEL_TIER="중간 (GPU완전+CPU보조)"
                CODE_MODEL_TIER="중간"
                echo -e "  ${GREEN}[T600/4GB GPU + RAM ${TOTAL_MEM_GB}GB]${NC} 7B 완전 GPU 실행 권장"
            else
                RECOMMENDED_MODEL="qwen2.5:3b"
                RECOMMENDED_CODE_MODEL="qwen2.5-coder:3b"
                MODEL_TIER="경량 (완전 GPU)"
                CODE_MODEL_TIER="경량"
                echo -e "  ${YELLOW}[T600/4GB GPU + RAM ${TOTAL_MEM_GB}GB]${NC} 3B 완전 GPU 실행 (RAM 부족으로 14B 오프로딩 제한)"
            fi
        else
            RECOMMENDED_MODEL="qwen2.5:0.5b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:1.5b"
            MODEL_TIER="최소"
            CODE_MODEL_TIER="최소"
            echo -e "  ${YELLOW}[최소 GPU 감지] VRAM ${GPU_VRAM}GB - 0.5B + 코드생성 1.5B 모델 권장${NC}"
        fi
    else
        # CPU 전용 - 메모리 기준
        if [ "$TOTAL_MEM_GB" -ge 128 ]; then
            RECOMMENDED_MODEL="qwen2.5:14b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:14b"
            MODEL_TIER="고성능 (CPU)"
            CODE_MODEL_TIER="최고성능 (CPU)"
            echo -e "  ${GREEN}[최고용량 RAM 감지] ${TOTAL_MEM_GB}GB - 14B + 코드생성 14B 모델 권장 (CPU)${NC}"
        elif [ "$TOTAL_MEM_GB" -ge 64 ]; then
            RECOMMENDED_MODEL="qwen2.5:14b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:14b"
            MODEL_TIER="고성능 (CPU)"
            CODE_MODEL_TIER="고성능 (CPU)"
            echo -e "  ${GREEN}[고용량 RAM 감지] ${TOTAL_MEM_GB}GB - 14B + 코드생성 14B 모델 권장 (CPU)${NC}"
        elif [ "$TOTAL_MEM_GB" -ge 32 ]; then
            RECOMMENDED_MODEL="qwen2.5:7b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:14b"
            MODEL_TIER="중간 (CPU)"
            CODE_MODEL_TIER="중간 (CPU)"
            echo -e "  ${GREEN}[중용량 RAM 감지] ${TOTAL_MEM_GB}GB - 7B + 코드생성 14B 모델 권장 (CPU)${NC}"
        elif [ "$TOTAL_MEM_GB" -ge 16 ]; then
            RECOMMENDED_MODEL="qwen2.5:3b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:7b"
            MODEL_TIER="경량 (CPU)"
            CODE_MODEL_TIER="경량 (CPU)"
            echo -e "  ${GREEN}[저용량 RAM 감지] ${TOTAL_MEM_GB}GB - 3B + 코드생성 7B 모델 권장 (CPU)${NC}"
        elif [ "$TOTAL_MEM_GB" -ge 8 ]; then
            RECOMMENDED_MODEL="qwen2.5:1.5b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:3b"
            MODEL_TIER="초경량 (CPU)"
            CODE_MODEL_TIER="초경량 (CPU)"
            echo -e "  ${YELLOW}[제한된 RAM 감지] ${TOTAL_MEM_GB}GB - 1.5B + 코드생성 3B 모델 권장 (CPU)${NC}"
        else
            RECOMMENDED_MODEL="qwen2.5:0.5b"
            RECOMMENDED_CODE_MODEL="qwen2.5-coder:1.5b"
            MODEL_TIER="최소 (CPU)"
            CODE_MODEL_TIER="최소 (CPU)"
            echo -e "  ${YELLOW}[최소 RAM 감지] ${TOTAL_MEM_GB}GB - 0.5B + 코드생성 1.5B 모델 권장 (CPU)${NC}"
        fi
    fi

    echo ""
    echo -e "  권장 LLM 모델 (텍스트 분석): ${BLUE}${RECOMMENDED_MODEL}${NC} (${MODEL_TIER})"
    echo -e "  권장 코드생성 모델 (UI 프로토타입): ${BLUE}${RECOMMENDED_CODE_MODEL}${NC} (${CODE_MODEL_TIER})"
    echo -e "  권장 임베딩 모델: ${BLUE}${RECOMMENDED_EMBEDDING}${NC}"
    echo ""
}

# =====================================
# Rocky Linux 필수 패키지 확인
# =====================================

check_prerequisites() {
    echo -e "${CYAN}[필수 패키지 확인]${NC}"
    echo ""

    MISSING_PKGS=()

    # curl 확인
    if ! command -v curl &> /dev/null; then
        MISSING_PKGS+=("curl")
    fi

    # tar 확인
    if ! command -v tar &> /dev/null; then
        MISSING_PKGS+=("tar")
    fi

    # docker 확인
    if ! command -v docker &> /dev/null; then
        echo -e "  ${YELLOW}[경고] Docker가 설치되어 있지 않습니다.${NC}"
        if [ "$OS_FAMILY" = "rhel" ]; then
            echo -e "  Rocky Linux 9에서 Docker 설치:"
            echo -e "    sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo"
            echo -e "    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"
            echo -e "    sudo systemctl enable --now docker"
            echo -e "    sudo usermod -aG docker \$USER"
        elif [ "$OS_FAMILY" = "debian" ]; then
            if [ "$WSL_MODE" = "true" ]; then
                echo -e "  WSL 환경 — Docker Desktop for Windows 설치를 권장합니다:"
                echo -e "    https://www.docker.com/products/docker-desktop"
                echo -e "  또는 WSL 내 Docker Engine 설치:"
            else
                echo -e "  Ubuntu/Debian에서 Docker 설치:"
            fi
            echo -e "    sudo apt-get update"
            echo -e "    sudo apt-get install -y ca-certificates curl gnupg"
            echo -e "    sudo install -m 0755 -d /etc/apt/keyrings"
            echo -e "    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
            echo -e "    echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null"
            echo -e "    sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin"
            echo -e "    sudo systemctl enable --now docker"
            echo -e "    sudo usermod -aG docker \$USER"
        fi
        echo ""
        MISSING_PKGS+=("docker")
    fi

    # docker compose 확인
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
        echo -e "  ${YELLOW}[경고] Docker Compose가 설치되어 있지 않습니다.${NC}"
        MISSING_PKGS+=("docker-compose-plugin")
    fi

    if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
        echo -e "  ${RED}누락된 패키지: ${MISSING_PKGS[*]}${NC}"
        echo ""
        if [ "$OS_FAMILY" = "rhel" ]; then
            echo -e "  ${YELLOW}설치 명령어: sudo dnf install -y ${MISSING_PKGS[*]}${NC}"
        elif [ "$OS_FAMILY" = "debian" ]; then
            echo -e "  ${YELLOW}설치 명령어: sudo apt-get install -y ${MISSING_PKGS[*]}${NC}"
        fi
        read -p "누락된 패키지를 무시하고 계속하시겠습니까? (y/n): " PKG_CONTINUE
        if [ "$PKG_CONTINUE" != "y" ] && [ "$PKG_CONTINUE" != "Y" ]; then
            echo "설치가 취소되었습니다. 필수 패키지를 설치한 후 다시 시도하세요."
            exit 1
        fi
    else
        echo -e "  ${GREEN}모든 필수 패키지가 설치되어 있습니다.${NC}"
    fi
    echo ""
}

# =====================================
# LibreOffice 설치 (PDF 변환용)
# =====================================

install_libreoffice() {
    echo -e "${CYAN}[LibreOffice 설치 - PDF 변환 기능]${NC}"
    echo ""

    if command -v libreoffice &> /dev/null || command -v soffice &> /dev/null; then
        LO_VERSION=$(libreoffice --version 2>/dev/null || soffice --version 2>/dev/null || echo "Unknown")
        echo -e "  ${GREEN}LibreOffice가 이미 설치되어 있습니다: ${LO_VERSION}${NC}"
        LIBREOFFICE_INSTALLED=true
        echo ""
        return
    fi

    echo "LibreOffice는 문서(DOCX, XLSX, PPTX, HWP 등)를 PDF로 변환하는 데 사용됩니다."
    echo ""
    read -p "LibreOffice를 설치하시겠습니까? (y/n, 기본값: y): " INSTALL_LO
    INSTALL_LO=${INSTALL_LO:-y}

    if [ "$INSTALL_LO" != "y" ] && [ "$INSTALL_LO" != "Y" ]; then
        echo -e "  ${YELLOW}LibreOffice 설치를 건너뜁니다. PDF 변환 기능이 비활성화됩니다.${NC}"
        LIBREOFFICE_INSTALLED=false
        echo ""
        return
    fi

    echo -e "  ${YELLOW}LibreOffice 설치 중... (시간이 소요될 수 있습니다)${NC}"

    if [ "$OS_FAMILY" = "rhel" ]; then
        echo -e "  ${CYAN}[1/3] LibreOffice 설치 (dnf)...${NC}"
        sudo dnf install -y libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress 2>&1 | tail -5

        echo -e "  ${CYAN}[2/3] 한글 폰트 설치...${NC}"
        sudo dnf install -y google-noto-sans-cjk-ttc-fonts google-noto-serif-cjk-ttc-fonts \
            dejavu-sans-fonts dejavu-serif-fonts dejavu-sans-mono-fonts 2>&1 | tail -3

        if ! rpm -q google-noto-sans-cjk-ttc-fonts &>/dev/null; then
            echo -e "  ${YELLOW}Noto CJK 폰트 미설치 - EPEL 저장소 확인 중...${NC}"
            sudo dnf install -y epel-release 2>/dev/null || true
            sudo dnf install -y google-noto-sans-cjk-ttc-fonts 2>/dev/null || true
        fi

        echo -e "  ${CYAN}[3/3] 폰트 캐시 갱신...${NC}"
        sudo fc-cache -f 2>/dev/null || true

    elif [ "$OS_FAMILY" = "debian" ]; then
        echo -e "  ${CYAN}[1/3] LibreOffice 설치 (apt)...${NC}"
        sudo apt-get update -qq
        sudo apt-get install -y libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress 2>&1 | tail -5

        echo -e "  ${CYAN}[2/3] 한글 폰트 설치...${NC}"
        sudo apt-get install -y fonts-noto-cjk fonts-noto-cjk-extra fonts-dejavu 2>&1 | tail -3

        echo -e "  ${CYAN}[3/3] 폰트 캐시 갱신...${NC}"
        sudo fc-cache -f 2>/dev/null || true
    else
        echo -e "  ${RED}지원하지 않는 OS입니다. 수동으로 LibreOffice를 설치하세요.${NC}"
        LIBREOFFICE_INSTALLED=false
        echo ""
        return
    fi

    if command -v libreoffice &> /dev/null || command -v soffice &> /dev/null; then
        LO_VERSION=$(libreoffice --version 2>/dev/null || soffice --version 2>/dev/null || echo "Unknown")
        echo -e "  ${GREEN}LibreOffice 설치 완료: ${LO_VERSION}${NC}"
        LIBREOFFICE_INSTALLED=true
    else
        echo -e "  ${RED}LibreOffice 설치에 실패했습니다. 수동 설치가 필요합니다.${NC}"
        echo -e "  ${YELLOW}설치 명령어: sudo dnf install -y libreoffice-core libreoffice-writer libreoffice-calc${NC}"
        LIBREOFFICE_INSTALLED=false
    fi
    echo ""
}

# =====================================
# 폐쇄망용 LibreOffice RPM 패키징
# =====================================

package_libreoffice_offline() {
    echo -e "${CYAN}[폐쇄망용 LibreOffice RPM 패키지 다운로드]${NC}"
    echo ""

    OFFLINE_PKG_DIR="${INSTALL_DIR}/offline-packages/libreoffice"

    if [ -d "$OFFLINE_PKG_DIR" ] && [ "$(ls -A $OFFLINE_PKG_DIR/*.rpm 2>/dev/null | wc -l)" -gt 0 ]; then
        echo -e "  ${GREEN}이미 오프라인 패키지가 존재합니다: ${OFFLINE_PKG_DIR}${NC}"
        echo -e "  $(ls $OFFLINE_PKG_DIR/*.rpm 2>/dev/null | wc -l)개의 RPM 패키지"
        echo ""
        return
    fi

    read -p "폐쇄망 배포용 LibreOffice RPM 패키지를 다운로드하시겠습니까? (y/n, 기본값: n): " DL_OFFLINE
    DL_OFFLINE=${DL_OFFLINE:-n}

    if [ "$DL_OFFLINE" != "y" ] && [ "$DL_OFFLINE" != "Y" ]; then
        echo -e "  ${YELLOW}오프라인 패키지 다운로드를 건너뜁니다.${NC}"
        echo ""
        return
    fi

    mkdir -p "$OFFLINE_PKG_DIR"

    if [ "$OS_FAMILY" = "rhel" ]; then
        echo -e "  ${CYAN}EPEL 저장소 활성화 (폰트 패키지 필요)...${NC}"
        sudo dnf install -y epel-release 2>/dev/null || true

        echo -e "  ${CYAN}의존성 포함 RPM 패키지 다운로드 중...${NC}"
        sudo dnf download --resolve --destdir="$OFFLINE_PKG_DIR" \
            libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress \
            google-noto-sans-cjk-ttc-fonts google-noto-serif-cjk-ttc-fonts \
            dejavu-sans-fonts dejavu-serif-fonts dejavu-sans-mono-fonts 2>&1 | tail -5

        PKG_COUNT=$(ls "$OFFLINE_PKG_DIR"/*.rpm 2>/dev/null | wc -l)
        echo -e "  ${GREEN}${PKG_COUNT}개의 RPM 패키지가 다운로드되었습니다.${NC}"
        echo -e "  ${GREEN}경로: ${OFFLINE_PKG_DIR}${NC}"
        echo ""

        cat > "${OFFLINE_PKG_DIR}/install-offline.sh" << 'OFFLINE_LO_EOF'
#!/bin/bash
# 폐쇄망 LibreOffice 설치 스크립트
# 사용법: sudo bash install-offline.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "  LibreOffice 오프라인 설치 (폐쇄망)"
echo "=========================================="
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "이 스크립트는 root 권한으로 실행해야 합니다."
    echo "사용법: sudo bash install-offline.sh"
    exit 1
fi

RPM_COUNT=$(ls "$SCRIPT_DIR"/*.rpm 2>/dev/null | wc -l)
if [ "$RPM_COUNT" -eq 0 ]; then
    echo "오류: RPM 패키지가 없습니다."
    exit 1
fi

echo "RPM 패키지 ${RPM_COUNT}개 설치 중..."
dnf install -y "$SCRIPT_DIR"/*.rpm 2>&1 | tail -10

echo ""
echo "폰트 캐시 갱신 중..."
fc-cache -f 2>/dev/null || true

if command -v libreoffice &> /dev/null; then
    echo ""
    echo "LibreOffice 설치 완료!"
    libreoffice --version
else
    echo ""
    echo "오류: LibreOffice 설치에 실패했습니다."
    exit 1
fi
OFFLINE_LO_EOF
        chmod +x "${OFFLINE_PKG_DIR}/install-offline.sh"
        echo -e "  ${GREEN}폐쇄망 설치 스크립트 생성: ${OFFLINE_PKG_DIR}/install-offline.sh${NC}"
    fi
    echo ""
}

# =====================================
# Java 17 설치 (OpenDataLoader PDF 처리용)
# =====================================

install_java17() {
    echo -e "${CYAN}[Java 17 설치 - OpenDataLoader PDF 텍스트 추출]${NC}"
    echo ""

    if command -v java &> /dev/null; then
        JAVA_VER=$(java -version 2>&1 | head -1)
        JAVA_MAJOR=$(java -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+)\..*/\1/' 2>/dev/null || echo "0")
        echo -e "  ${GREEN}Java가 이미 설치되어 있습니다: ${JAVA_VER}${NC}"
        if [ "$JAVA_MAJOR" -ge 17 ]; then
            echo -e "  ${GREEN}Java 17+ 요구사항 충족${NC}"
            JAVA17_INSTALLED=true
        else
            echo -e "  ${YELLOW}[경고] Java ${JAVA_MAJOR} 감지. OpenDataLoader PDF는 Java 17 이상이 필요합니다.${NC}"
            JAVA17_INSTALLED=false
        fi
        echo ""
        if [ "$JAVA17_INSTALLED" = true ]; then
            return
        fi
    fi

    echo "OpenDataLoader PDF는 PDF 문서에서 구조화된 텍스트(표 포함)를 추출합니다."
    echo "Java 17 이상이 필요하며, 문서당 JVM을 실행하여 약 10초 소요됩니다."
    echo ""
    read -p "Java 17 (OpenJDK)을 설치하시겠습니까? (y/n, 기본값: y): " INSTALL_JAVA
    INSTALL_JAVA=${INSTALL_JAVA:-y}

    if [ "$INSTALL_JAVA" != "y" ] && [ "$INSTALL_JAVA" != "Y" ]; then
        echo -e "  ${YELLOW}Java 17 설치를 건너뜁니다. OpenDataLoader PDF 기능이 비활성화되고 unpdf 폴백이 사용됩니다.${NC}"
        JAVA17_INSTALLED=false
        echo ""
        return
    fi

    echo -e "  ${YELLOW}Java 17 (OpenJDK) 설치 중...${NC}"

    if [ "$OS_FAMILY" = "rhel" ]; then
        sudo dnf install -y java-17-openjdk 2>&1 | tail -5
    elif [ "$OS_FAMILY" = "debian" ]; then
        sudo apt-get update -qq
        sudo apt-get install -y openjdk-17-jre 2>&1 | tail -5
    else
        echo -e "  ${RED}지원하지 않는 OS입니다. 수동으로 Java 17을 설치하세요.${NC}"
        JAVA17_INSTALLED=false
        echo ""
        return
    fi

    if command -v java &> /dev/null; then
        JAVA_VER=$(java -version 2>&1 | head -1)
        echo -e "  ${GREEN}Java 설치 완료: ${JAVA_VER}${NC}"
        JAVA17_INSTALLED=true
    else
        echo -e "  ${RED}Java 설치에 실패했습니다. 수동 설치가 필요합니다.${NC}"
        if [ "$OS_FAMILY" = "rhel" ]; then
            echo -e "  ${YELLOW}설치 명령어: sudo dnf install -y java-17-openjdk${NC}"
        fi
        JAVA17_INSTALLED=false
    fi
    echo ""
}

# =====================================
# 폐쇄망용 Java 17 RPM 패키징
# =====================================

package_java17_offline() {
    echo -e "${CYAN}[폐쇄망용 Java 17 RPM 패키지 다운로드]${NC}"
    echo ""

    OFFLINE_JAVA_DIR="${INSTALL_DIR}/offline-packages/java17"

    if [ -d "$OFFLINE_JAVA_DIR" ] && [ "$(ls -A $OFFLINE_JAVA_DIR/*.rpm 2>/dev/null | wc -l)" -gt 0 ]; then
        echo -e "  ${GREEN}이미 오프라인 패키지가 존재합니다: ${OFFLINE_JAVA_DIR}${NC}"
        echo -e "  $(ls $OFFLINE_JAVA_DIR/*.rpm 2>/dev/null | wc -l)개의 RPM 패키지"
        echo ""
        return
    fi

    if [ "$OS_FAMILY" != "rhel" ]; then
        echo -e "  ${YELLOW}RHEL 계열이 아닌 OS에서는 오프라인 패키지를 지원하지 않습니다.${NC}"
        echo ""
        return
    fi

    read -p "폐쇄망 이전을 위해 Java 17 RPM 패키지를 다운로드하시겠습니까? (y/n, 기본값: n): " DOWNLOAD_JAVA_OFFLINE
    DOWNLOAD_JAVA_OFFLINE=${DOWNLOAD_JAVA_OFFLINE:-n}

    if [ "$DOWNLOAD_JAVA_OFFLINE" != "y" ] && [ "$DOWNLOAD_JAVA_OFFLINE" != "Y" ]; then
        echo -e "  ${YELLOW}오프라인 패키지 다운로드를 건너뜁니다.${NC}"
        echo ""
        return
    fi

    mkdir -p "$OFFLINE_JAVA_DIR"

    echo -e "  ${YELLOW}Java 17 RPM 패키지 다운로드 중...${NC}"
    sudo dnf download --resolve --destdir="$OFFLINE_JAVA_DIR" \
        java-17-openjdk 2>&1 | tail -5

    RPM_COUNT=$(ls "$OFFLINE_JAVA_DIR"/*.rpm 2>/dev/null | wc -l)
    if [ "$RPM_COUNT" -gt 0 ]; then
        echo -e "  ${GREEN}${RPM_COUNT}개의 RPM 패키지가 다운로드되었습니다.${NC}"

        cat > "${OFFLINE_JAVA_DIR}/install-offline.sh" << 'JAVA_OFFLINE_EOF'
#!/bin/bash
echo "폐쇄망 Java 17 설치 시작..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo rpm -ivh --nodeps "${SCRIPT_DIR}"/*.rpm 2>/dev/null || \
sudo dnf localinstall -y "${SCRIPT_DIR}"/*.rpm 2>/dev/null || \
echo "설치 실패. 수동으로 RPM을 설치하세요."
java -version 2>&1 && echo "Java 17 설치 완료!" || echo "Java 설치를 확인하세요."
JAVA_OFFLINE_EOF
        chmod +x "${OFFLINE_JAVA_DIR}/install-offline.sh"
        echo -e "  폐쇄망 설치: ${GREEN}bash ${OFFLINE_JAVA_DIR}/install-offline.sh${NC}"
    else
        echo -e "  ${RED}RPM 패키지 다운로드에 실패했습니다.${NC}"
    fi
    echo ""
}

# =====================================
# Vision PDF 이미지 변환 도구 설치
# (poppler-utils, ImageMagick, ghostscript)
# =====================================

install_pdf_image_tools() {
    echo -e "${CYAN}[PDF 이미지 변환 도구 설치 - Vision 문서 분석용]${NC}"
    echo ""

    TOOLS_INSTALLED=()
    TOOLS_MISSING=()

    if command -v pdftoppm &> /dev/null; then
        TOOLS_INSTALLED+=("pdftoppm (poppler-utils)")
    else
        TOOLS_MISSING+=("poppler-utils")
    fi

    if command -v convert &> /dev/null; then
        TOOLS_INSTALLED+=("convert (ImageMagick)")
    else
        TOOLS_MISSING+=("ImageMagick")
    fi

    if command -v gs &> /dev/null; then
        TOOLS_INSTALLED+=("gs (Ghostscript)")
    else
        TOOLS_MISSING+=("ghostscript")
    fi

    if [ ${#TOOLS_INSTALLED[@]} -gt 0 ]; then
        echo -e "  ${GREEN}이미 설치된 도구:${NC}"
        for tool in "${TOOLS_INSTALLED[@]}"; do
            echo -e "    - ${GREEN}${tool}${NC}"
        done
    fi

    if [ ${#TOOLS_MISSING[@]} -eq 0 ]; then
        echo -e "  ${GREEN}모든 PDF 이미지 변환 도구가 설치되어 있습니다.${NC}"
        PDF_IMAGE_TOOLS_INSTALLED=true
        echo ""
        return
    fi

    echo ""
    echo "Vision 문서 분석은 PDF를 이미지로 변환하여 AI 비전 모델이 분석합니다."
    echo "다음 도구가 필요합니다 (하나 이상 설치 권장):"
    echo "  - poppler-utils (pdftoppm) : 가장 빠르고 안정적 [권장]"
    echo "  - ImageMagick (convert)    : 범용 이미지 처리"
    echo "  - ghostscript (gs)         : PDF 렌더링 엔진"
    echo ""
    echo -e "  ${YELLOW}미설치 도구: ${TOOLS_MISSING[*]}${NC}"
    echo ""

    read -p "PDF 이미지 변환 도구를 설치하시겠습니까? (y/n, 기본값: y): " INSTALL_PDF_TOOLS
    INSTALL_PDF_TOOLS=${INSTALL_PDF_TOOLS:-y}

    if [ "$INSTALL_PDF_TOOLS" != "y" ] && [ "$INSTALL_PDF_TOOLS" != "Y" ]; then
        echo -e "  ${YELLOW}PDF 이미지 변환 도구 설치를 건너뜁니다.${NC}"
        if [ ${#TOOLS_INSTALLED[@]} -eq 0 ]; then
            echo -e "  ${RED}[주의] Vision 문서 분석 기능이 작동하지 않습니다.${NC}"
            PDF_IMAGE_TOOLS_INSTALLED=false
        else
            PDF_IMAGE_TOOLS_INSTALLED=true
        fi
        echo ""
        return
    fi

    echo -e "  ${YELLOW}PDF 이미지 변환 도구 설치 중...${NC}"

    if [ "$OS_FAMILY" = "rhel" ]; then
        echo -e "  ${CYAN}[1/3] poppler-utils 설치 (pdftoppm)...${NC}"
        sudo dnf install -y poppler-utils 2>&1 | tail -3

        echo -e "  ${CYAN}[2/3] ImageMagick 설치 (convert)...${NC}"
        sudo dnf install -y ImageMagick 2>&1 | tail -3

        echo -e "  ${CYAN}[3/3] Ghostscript 설치 (gs)...${NC}"
        sudo dnf install -y ghostscript 2>&1 | tail -3

    elif [ "$OS_FAMILY" = "debian" ]; then
        echo -e "  ${CYAN}[1/3] poppler-utils 설치 (pdftoppm)...${NC}"
        sudo apt-get install -y poppler-utils 2>&1 | tail -3

        echo -e "  ${CYAN}[2/3] ImageMagick 설치 (convert)...${NC}"
        sudo apt-get install -y imagemagick 2>&1 | tail -3

        echo -e "  ${CYAN}[3/3] Ghostscript 설치 (gs)...${NC}"
        sudo apt-get install -y ghostscript 2>&1 | tail -3
    else
        echo -e "  ${RED}지원하지 않는 OS입니다. 수동 설치가 필요합니다.${NC}"
        PDF_IMAGE_TOOLS_INSTALLED=false
        echo ""
        return
    fi

    echo ""
    echo -e "  ${CYAN}설치 결과 확인:${NC}"
    FINAL_INSTALLED=0
    if command -v pdftoppm &> /dev/null; then
        echo -e "    ${GREEN}pdftoppm (poppler-utils) - 설치 완료${NC}"
        FINAL_INSTALLED=$((FINAL_INSTALLED + 1))
    else
        echo -e "    ${RED}pdftoppm (poppler-utils) - 설치 실패${NC}"
    fi
    if command -v convert &> /dev/null; then
        echo -e "    ${GREEN}convert (ImageMagick) - 설치 완료${NC}"
        FINAL_INSTALLED=$((FINAL_INSTALLED + 1))
    else
        echo -e "    ${RED}convert (ImageMagick) - 설치 실패${NC}"
    fi
    if command -v gs &> /dev/null; then
        echo -e "    ${GREEN}gs (Ghostscript) - 설치 완료${NC}"
        FINAL_INSTALLED=$((FINAL_INSTALLED + 1))
    else
        echo -e "    ${RED}gs (Ghostscript) - 설치 실패${NC}"
    fi

    if [ $FINAL_INSTALLED -gt 0 ]; then
        echo -e "  ${GREEN}PDF 이미지 변환 도구 ${FINAL_INSTALLED}개 설치 완료${NC}"
        PDF_IMAGE_TOOLS_INSTALLED=true
    else
        echo -e "  ${RED}PDF 이미지 변환 도구 설치에 실패했습니다. 수동 설치가 필요합니다.${NC}"
        echo -e "  ${YELLOW}설치 명령어: sudo dnf install -y poppler-utils ImageMagick ghostscript${NC}"
        PDF_IMAGE_TOOLS_INSTALLED=false
    fi
    echo ""
}

# =====================================
# SadTalker 전신 아바타 립싱크 엔진 설치
# =====================================

install_sadtalker() {
    echo -e "${CYAN}[SadTalker 전신 아바타 립싱크 엔진 설치]${NC}"
    echo ""
    echo -e "  SadTalker는 사진 한 장으로 립싱크 + 전신 애니메이션 영상을 생성합니다."
    echo -e "  온라인 도움말 영상에서 '아바타 영상 생성' 기능에 사용됩니다."
    echo -e "  ${CYAN}설치 경로: /opt/SadTalker${NC}"
    echo -e "  ${CYAN}필수 사양: Python 3.8+, CUDA 또는 CPU 모드 지원${NC}"
    echo -e "  ${CYAN}필요 공간: 약 6~10 GB (모델 포함)${NC}"
    echo ""
    echo -e "  ${YELLOW}[선택사항] SadTalker 없이도 정적 사진 오버레이로 아바타 영상을 생성할 수 있습니다.${NC}"
    echo ""

    # 이미 설치되어 있으면 건너뜀
    if [ -f "/opt/SadTalker/inference.py" ]; then
        echo -e "  ${GREEN}SadTalker가 이미 설치되어 있습니다: /opt/SadTalker${NC}"
        SADTALKER_INSTALLED=true
        echo ""
        return
    fi

    read -p "SadTalker를 설치하시겠습니까? (y/n, 기본값: y): " INSTALL_ST_INPUT
    INSTALL_ST_INPUT=${INSTALL_ST_INPUT:-y}

    if [ "$INSTALL_ST_INPUT" != "y" ] && [ "$INSTALL_ST_INPUT" != "Y" ]; then
        echo -e "  ${YELLOW}SadTalker 설치를 건너뜁니다. (아바타 영상 = 정적 사진 오버레이 모드)${NC}"
        SADTALKER_INSTALLED=false

        # SadTalker 없어도 rembg는 배경 제거 품질 향상에 필요 → 독립 설치 제공
        echo ""
        echo -e "  ${CYAN}[배경 제거] rembg (AI 세그멘테이션) 독립 설치${NC}"
        echo -e "  rembg는 SadTalker 없이도 아바타 배경 제거 품질을 개선합니다."
        echo -e "  (미설치 시: ImageMagick fuzz → FFmpeg colorkey 폴백 사용)"
        read -p "  rembg를 설치하시겠습니까? (y/n, 기본값: y): " INSTALL_REMBG_INPUT
        INSTALL_REMBG_INPUT=${INSTALL_REMBG_INPUT:-y}
        if [ "$INSTALL_REMBG_INPUT" = "y" ] || [ "$INSTALL_REMBG_INPUT" = "Y" ]; then
            # rembg도 Python 3.12+ 에서 onnxruntime 호환 문제 → 3.11 이하 선호
            PYTHON_BIN=$(command -v python3.11 || command -v python3.10 || command -v python3.9 || command -v python3.8 || command -v python3)
            if [ -n "$PYTHON_BIN" ]; then
                ST_PIP_OFFLINE="${INSTALL_DIR}/offline-packages/pip_pkgs"
                if [ -d "$ST_PIP_OFFLINE" ]; then
                    "$PYTHON_BIN" -m pip install --no-index --find-links="$ST_PIP_OFFLINE" rembg opencv-python-headless onnxruntime 2>&1 | tail -5
                else
                    "$PYTHON_BIN" -m pip install rembg opencv-python-headless onnxruntime 2>&1 | tail -5
                fi
                REMBG_OK=$("$PYTHON_BIN" -c "import rembg; print('OK')" 2>/dev/null || echo "FAIL")
                if [ "$REMBG_OK" = "OK" ]; then
                    echo -e "  ${GREEN}rembg 설치 완료 — 아바타 배경 자동 제거 활성화${NC}"
                else
                    echo -e "  ${YELLOW}rembg 설치 실패 — ImageMagick fuzz 폴백 방식으로 배경 제거${NC}"
                fi
            else
                echo -e "  ${YELLOW}python3를 찾을 수 없어 rembg 설치를 건너뜁니다.${NC}"
            fi
        fi
        echo ""
        return
    fi

    # Python 3.8~3.11 확인 (SadTalker는 3.12+ 비호환)
    PYTHON_BIN=""
    for py in python3.11 python3.10 python3.9 python3.8 python3; do
        if command -v "$py" &> /dev/null; then
            PY_VER=$("$py" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
            PY_MAJ=$(echo "$PY_VER" | cut -d. -f1)
            PY_MIN=$(echo "$PY_VER" | cut -d. -f2)
            if [ "$PY_MAJ" -ge 3 ] && [ "$PY_MIN" -ge 8 ] && [ "$PY_MIN" -le 11 ] 2>/dev/null; then
                PYTHON_BIN="$py"
                break
            fi
        fi
    done

    if [ -z "$PYTHON_BIN" ]; then
        echo -e "  ${RED}Python 3.8~3.11이 설치되어 있지 않습니다.${NC}"
        echo -e "  ${YELLOW}SadTalker는 Python 3.12+ 와 호환되지 않습니다.${NC}"
        if [ "$OS_FAMILY" = "rhel" ]; then
            echo -e "  ${YELLOW}수동 설치: sudo dnf install -y python3.11${NC}"
        elif [ "$OS_FAMILY" = "debian" ]; then
            echo -e "  ${YELLOW}수동 설치: sudo apt-get install -y python3.11 python3.11-venv python3.11-dev${NC}"
        fi
        SADTALKER_INSTALLED=false
        echo ""
        return
    fi
    echo -e "  ${GREEN}Python: ${PYTHON_BIN} ($PY_VER)${NC}"

    # pip 확인
    if ! "$PYTHON_BIN" -m pip --version &> /dev/null; then
        echo -e "  ${YELLOW}pip 설치 중...${NC}"
        "$PYTHON_BIN" -m ensurepip --upgrade 2>&1 | tail -3 || \
            sudo dnf install -y python3-pip 2>&1 | tail -3
    fi

    # git 확인
    if ! command -v git &> /dev/null; then
        echo -e "  ${YELLOW}git 설치 중...${NC}"
        if [ "$OS_FAMILY" = "rhel" ]; then
            sudo dnf install -y git 2>&1 | tail -3
        else
            sudo apt-get install -y git 2>&1 | tail -3
        fi
    fi

    # ── SadTalker 클론 ────────────────────────────────────────────
    echo ""
    echo -e "  ${CYAN}[1/4] SadTalker GitHub 클론 중...${NC}"
    echo -e "  ${YELLOW}오프라인 환경이라면 offline-packages/sadtalker/ 에 소스를 배치하세요.${NC}"
    echo ""

    SADTALKER_OFFLINE_DIR="${INSTALL_DIR}/offline-packages/sadtalker"

    if [ -d "${SADTALKER_OFFLINE_DIR}/SadTalker" ]; then
        echo -e "  ${GREEN}오프라인 소스 감지: ${SADTALKER_OFFLINE_DIR}/SadTalker${NC}"
        sudo cp -r "${SADTALKER_OFFLINE_DIR}/SadTalker" /opt/SadTalker
    elif [ -d "${SADTALKER_OFFLINE_DIR}" ] && ls "${SADTALKER_OFFLINE_DIR}"/*.tar.gz &>/dev/null 2>&1; then
        echo -e "  ${GREEN}오프라인 아카이브 감지. 압축 해제 중...${NC}"
        sudo mkdir -p /opt/SadTalker
        sudo tar -xzf "${SADTALKER_OFFLINE_DIR}"/*.tar.gz -C /opt/ 2>&1 | tail -5
    else
        if command -v git &> /dev/null; then
            sudo git clone --depth=1 https://github.com/OpenTalker/SadTalker /opt/SadTalker 2>&1 | tail -10
        else
            echo -e "  ${RED}git가 없어 SadTalker를 클론할 수 없습니다.${NC}"
            SADTALKER_INSTALLED=false
            echo ""
            return
        fi
    fi

    if [ ! -f "/opt/SadTalker/inference.py" ]; then
        echo -e "  ${RED}SadTalker 소스 설치 실패.${NC}"
        SADTALKER_INSTALLED=false
        echo ""
        return
    fi
    echo -e "  ${GREEN}SadTalker 소스 준비 완료: /opt/SadTalker${NC}"

    # ── Python 의존성 설치 ─────────────────────────────────────────
    echo ""
    echo -e "  ${CYAN}[2/4] SadTalker Python 의존성 설치 중...${NC}"
    echo -e "  ${YELLOW}(PyTorch + CUDA 패키지 포함, 약 3~5분 소요)${NC}"
    echo ""

    ST_REQS="/opt/SadTalker/requirements.txt"
    ST_PIP_OFFLINE="${SADTALKER_OFFLINE_DIR}/pip_pkgs"
    if [ -f "$ST_REQS" ]; then
        if [ -d "$ST_PIP_OFFLINE" ]; then
            echo -e "  ${GREEN}오프라인 pip 패키지 감지: ${ST_PIP_OFFLINE}${NC}"
            "$PYTHON_BIN" -m pip install --no-index --find-links="$ST_PIP_OFFLINE" torch torchvision torchaudio 2>&1 | tail -5
            "$PYTHON_BIN" -m pip install --no-index --find-links="$ST_PIP_OFFLINE" -r "$ST_REQS" 2>&1 | tail -10
        elif [ "$GPU_AVAILABLE" = true ] && [ "$GPU_TYPE" = "nvidia" ]; then
            echo -e "  ${GREEN}GPU 모드 (CUDA) 설치 중...${NC}"
            "$PYTHON_BIN" -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118 2>&1 | tail -5
            "$PYTHON_BIN" -m pip install -r "$ST_REQS" 2>&1 | tail -10
        else
            echo -e "  ${YELLOW}CPU 모드 설치 중...${NC}"
            "$PYTHON_BIN" -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu 2>&1 | tail -5
            "$PYTHON_BIN" -m pip install -r "$ST_REQS" 2>&1 | tail -10
        fi
    else
        echo -e "  ${YELLOW}requirements.txt 없음. 기본 패키지만 설치합니다.${NC}"
        if [ -d "$ST_PIP_OFFLINE" ]; then
            "$PYTHON_BIN" -m pip install --no-index --find-links="$ST_PIP_OFFLINE" face-alignment insightface basicsr facexlib gfpgan 2>&1 | tail -5
        else
            "$PYTHON_BIN" -m pip install face-alignment insightface basicsr facexlib gfpgan 2>&1 | tail -5
        fi
    fi

    # ── rembg + opencv (배경 제거) ────────────────────────────────
    echo ""
    echo -e "  ${CYAN}[3/4] 배경 제거 패키지 설치 중 (rembg + opencv-python)...${NC}"
    if [ -d "$ST_PIP_OFFLINE" ]; then
        "$PYTHON_BIN" -m pip install --no-index --find-links="$ST_PIP_OFFLINE" rembg opencv-python-headless onnxruntime 2>&1 | tail -5
    else
        "$PYTHON_BIN" -m pip install rembg opencv-python-headless onnxruntime 2>&1 | tail -5
    fi

    REMBG_OK=$("$PYTHON_BIN" -c "import rembg; print('OK')" 2>/dev/null || echo "FAIL")
    if [ "$REMBG_OK" = "OK" ]; then
        echo -e "  ${GREEN}rembg 설치 완료 — 아바타 배경 자동 제거 활성화${NC}"
    else
        echo -e "  ${YELLOW}rembg 설치 실패 — colorkey 폴백 방식으로 배경 제거${NC}"
    fi

    # ── 사전 학습 모델 다운로드 ───────────────────────────────────
    echo ""
    echo -e "  ${CYAN}[4/4] SadTalker 사전 학습 모델 다운로드 중...${NC}"
    echo -e "  ${YELLOW}(약 4~6 GB, 인터넷 속도에 따라 5~20분 소요)${NC}"
    echo ""

    SADTALKER_MODEL_OFFLINE="${SADTALKER_OFFLINE_DIR}/checkpoints"
    if [ -d "$SADTALKER_MODEL_OFFLINE" ]; then
        echo -e "  ${GREEN}오프라인 모델 감지. 복사 중...${NC}"
        sudo cp -r "$SADTALKER_MODEL_OFFLINE" /opt/SadTalker/
        sudo cp -r "${SADTALKER_OFFLINE_DIR}/gfpgan" /opt/SadTalker/ 2>/dev/null || true
    elif [ -f "/opt/SadTalker/scripts/download_models.sh" ]; then
        sudo bash /opt/SadTalker/scripts/download_models.sh 2>&1 | tail -20
    else
        echo -e "  ${YELLOW}모델 다운로드 스크립트를 찾을 수 없습니다.${NC}"
        echo -e "  ${YELLOW}수동 설치: cd /opt/SadTalker && bash scripts/download_models.sh${NC}"
    fi

    # 소유권 설정
    sudo chown -R "$USER":"$USER" /opt/SadTalker 2>/dev/null || true

    # 설치 확인
    if [ -f "/opt/SadTalker/inference.py" ]; then
        SADTALKER_INSTALLED=true
        echo ""
        echo -e "  ${GREEN}SadTalker 설치 완료!${NC}"
        echo -e "  ${GREEN}경로: /opt/SadTalker${NC}"
        echo -e "  ${GREEN}전신 립싱크 모드: python3 inference.py --preprocess full${NC}"
        echo -e "  ${GREEN}(자연스러운 머리/상체 움직임 활성화 — --still 플래그 미사용)${NC}"
    else
        SADTALKER_INSTALLED=false
        echo -e "  ${RED}SadTalker 설치 실패.${NC}"
    fi
    echo ""
}

# =====================================
# 폐쇄망용 PDF 이미지 변환 도구 RPM 패키징
# =====================================

package_pdf_image_tools_offline() {
    echo -e "${CYAN}[폐쇄망용 PDF 이미지 변환 도구 RPM 패키지 다운로드]${NC}"
    echo ""

    OFFLINE_PKG_DIR="${INSTALL_DIR}/offline-packages/pdf-image-tools"

    if [ -d "$OFFLINE_PKG_DIR" ] && [ "$(ls -A $OFFLINE_PKG_DIR/*.rpm 2>/dev/null | wc -l)" -gt 0 ]; then
        echo -e "  ${GREEN}이미 오프라인 패키지가 존재합니다: ${OFFLINE_PKG_DIR}${NC}"
        echo -e "  $(ls $OFFLINE_PKG_DIR/*.rpm 2>/dev/null | wc -l)개의 RPM 패키지"
        echo ""
        return
    fi

    read -p "폐쇄망 배포용 PDF 이미지 변환 도구 RPM 패키지를 다운로드하시겠습니까? (y/n, 기본값: n): " DL_PDF_TOOLS
    DL_PDF_TOOLS=${DL_PDF_TOOLS:-n}

    if [ "$DL_PDF_TOOLS" != "y" ] && [ "$DL_PDF_TOOLS" != "Y" ]; then
        echo -e "  ${YELLOW}오프라인 패키지 다운로드를 건너뜁니다.${NC}"
        echo ""
        return
    fi

    mkdir -p "$OFFLINE_PKG_DIR"

    if [ "$OS_FAMILY" = "rhel" ]; then
        echo -e "  ${CYAN}의존성 포함 RPM 패키지 다운로드 중...${NC}"
        sudo dnf download --resolve --destdir="$OFFLINE_PKG_DIR" \
            poppler-utils ImageMagick ghostscript 2>&1 | tail -5

        PKG_COUNT=$(ls "$OFFLINE_PKG_DIR"/*.rpm 2>/dev/null | wc -l)
        echo -e "  ${GREEN}${PKG_COUNT}개의 RPM 패키지가 다운로드되었습니다.${NC}"
        echo -e "  ${GREEN}경로: ${OFFLINE_PKG_DIR}${NC}"
        echo ""

        cat > "${OFFLINE_PKG_DIR}/install-offline.sh" << 'OFFLINE_PDF_TOOLS_EOF'
#!/bin/bash
# 폐쇄망 PDF 이미지 변환 도구 설치 스크립트
# 사용법: sudo bash install-offline.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "  PDF 이미지 변환 도구 오프라인 설치 (폐쇄망)"
echo "  (poppler-utils, ImageMagick, Ghostscript)"
echo "=========================================="
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "이 스크립트는 root 권한으로 실행해야 합니다."
    echo "사용법: sudo bash install-offline.sh"
    exit 1
fi

RPM_COUNT=$(ls "$SCRIPT_DIR"/*.rpm 2>/dev/null | wc -l)
if [ "$RPM_COUNT" -eq 0 ]; then
    echo "오류: RPM 패키지가 없습니다."
    exit 1
fi

echo "RPM 패키지 ${RPM_COUNT}개 설치 중..."
dnf install -y "$SCRIPT_DIR"/*.rpm 2>&1 | tail -10

echo ""
echo "설치 결과 확인:"
command -v pdftoppm &> /dev/null && echo "  - pdftoppm: 설치됨" || echo "  - pdftoppm: 미설치"
command -v convert &> /dev/null && echo "  - convert: 설치됨" || echo "  - convert: 미설치"
command -v gs &> /dev/null && echo "  - gs: 설치됨" || echo "  - gs: 미설치"

echo ""
echo "PDF 이미지 변환 도구 설치 완료!"
OFFLINE_PDF_TOOLS_EOF
        chmod +x "${OFFLINE_PKG_DIR}/install-offline.sh"
        echo -e "  ${GREEN}폐쇄망 설치 스크립트 생성: ${OFFLINE_PKG_DIR}/install-offline.sh${NC}"
    fi
    echo ""
}

# =====================================
# 네트워크 설정
# =====================================

DEFAULT_IP="0.0.0.0"
DEFAULT_APP_PORT="5559"
DEFAULT_DB_PORT="5433"
DEFAULT_OLLAMA_PORT="51434"

# 변수 초기화
PDF_IMAGE_TOOLS_INSTALLED=false
JAVA17_INSTALLED=false
SADTALKER_INSTALLED=false

# OS 감지
detect_os

# 시스템 사양 감지
detect_system_specs

# 모델 자동 선택
auto_select_model

# 성능 튜닝 계산
calculate_tuning

# 필수 패키지 확인
check_prerequisites

# LibreOffice 설치
install_libreoffice

# 폐쇄망용 LibreOffice 패키지 다운로드 (선택)
package_libreoffice_offline

# Java 17 설치 (OpenDataLoader PDF 처리용)
install_java17

# 폐쇄망용 Java 17 패키지 다운로드 (선택)
package_java17_offline

# PDF 이미지 변환 도구 설치 (Vision 문서 분석용)
install_pdf_image_tools

# 폐쇄망용 PDF 이미지 변환 도구 패키지 다운로드 (선택)
package_pdf_image_tools_offline

# SadTalker 전신 아바타 립싱크 엔진 설치 (선택)
install_sadtalker

echo -e "${CYAN}[네트워크 설정]${NC}"
echo ""
echo "현재 서버의 네트워크 인터페이스:"
echo "-------------------------------------------"
ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v "127.0.0.1" | while read ip; do
    echo "  - $ip"
done 2>/dev/null || echo "  (네트워크 정보를 가져올 수 없습니다)"
echo "-------------------------------------------"
echo ""
echo "IP 선택 옵션:"
echo "  0.0.0.0 = 모든 인터페이스에서 접속 허용 (권장)"
echo "  특정 IP = 해당 인터페이스에서만 접속 허용"
echo ""

read -p "바인딩할 IP 주소를 입력하세요 (기본값: $DEFAULT_IP): " HOST_IP
HOST_IP=${HOST_IP:-$DEFAULT_IP}

if [ "$HOST_IP" != "0.0.0.0" ]; then
    if ! ip -4 addr show 2>/dev/null | grep -q "$HOST_IP"; then
        echo ""
        echo -e "${YELLOW}[경고] IP '$HOST_IP'이(가) 이 서버에서 발견되지 않았습니다.${NC}"
        echo "사용 가능한 IP:"
        ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v "127.0.0.1"
        echo ""
        read -p "계속하시겠습니까? (y/n): " CONTINUE
        if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
            echo "설치가 취소되었습니다."
            exit 1
        fi
    fi
fi

read -p "애플리케이션 포트를 입력하세요 (기본값: $DEFAULT_APP_PORT): " APP_PORT
APP_PORT=${APP_PORT:-$DEFAULT_APP_PORT}

read -p "데이터베이스 포트를 입력하세요 (기본값: $DEFAULT_DB_PORT): " DB_PORT
DB_PORT=${DB_PORT:-$DEFAULT_DB_PORT}

read -p "동시 접속 사용자 수를 입력하세요 (기본값: $MAX_USERS): " INPUT_MAX_USERS
if [ -n "$INPUT_MAX_USERS" ]; then
    MAX_USERS=$INPUT_MAX_USERS
    # 사용자 수 변경 시 튜닝 재계산
    calculate_tuning > /dev/null 2>&1
fi

read -p "세션 암호화 키를 입력하세요 (기본값: 자동생성): " SESSION_SECRET
if [ -z "$SESSION_SECRET" ]; then
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)
fi

# LoRA 어댑터 학습 진행률 콜백 보호용 내부 시크릿 (자동생성)
ADAPTER_INTERNAL_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)

echo ""
echo -e "${CYAN}[Docker → Host 통신용 IP 자동 감지]${NC}"
DOCKER_HOST_IP=""

# WSL 환경에서는 host.docker.internal 사용 (Docker Desktop 연동)
if [ "$WSL_MODE" = "true" ]; then
    # WSL에서 host.docker.internal이 해석되는지 확인
    WSL_HOST_IP=$(getent hosts host.docker.internal 2>/dev/null | awk '{print $1}' || echo "")
    if [ -n "$WSL_HOST_IP" ]; then
        DOCKER_HOST_IP="$WSL_HOST_IP"
        echo -e "  ${CYAN}WSL 환경 감지 — host.docker.internal: ${GREEN}${DOCKER_HOST_IP}${NC}"
    else
        # WSL에서 Windows 호스트 IP 감지 (/etc/resolv.conf 네임서버)
        WSL_WINDOWS_IP=$(grep nameserver /etc/resolv.conf 2>/dev/null | awk '{print $2}' | head -1 || echo "")
        if [ -n "$WSL_WINDOWS_IP" ]; then
            DOCKER_HOST_IP="$WSL_WINDOWS_IP"
            echo -e "  ${CYAN}WSL 환경 — Windows 호스트 IP (resolv.conf): ${GREEN}${DOCKER_HOST_IP}${NC}"
        fi
    fi
fi

if [ -z "$DOCKER_HOST_IP" ] && command -v docker &> /dev/null; then
    DOCKER_HOST_IP=$(docker network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null || echo "")
fi
if [ -z "$DOCKER_HOST_IP" ]; then
    DOCKER_HOST_IP=$(ip -4 addr show docker0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' || echo "")
fi
if [ -z "$DOCKER_HOST_IP" ]; then
    DOCKER_HOST_IP="172.17.0.1"
fi
echo -e "  Docker 브릿지 게이트웨이 IP: ${GREEN}${DOCKER_HOST_IP}${NC}"
echo -e "  (Docker 컨테이너에서 호스트의 Ollama에 연결할 때 사용됩니다)"
echo ""

echo ""
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}  Ollama 설치 설정 (AI/LLM 기능)${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""
echo "Ollama는 폐쇄망 환경에서 AI 기능을 제공합니다."
echo "설치하지 않으면 AI 분석 기능이 비활성화됩니다."
echo ""
echo -e "${MAGENTA}Ollama 설치 경로: ${OLLAMA_LOCAL_DIR}${NC}"
echo -e "${MAGENTA}(시스템 전역이 아닌 프로젝트 디렉토리에 로컬 설치)${NC}"
echo ""
echo -e "시스템 사양 기반 권장 모델: ${GREEN}${RECOMMENDED_MODEL}${NC}"
echo ""

read -p "Ollama를 설치하시겠습니까? (y/n, 기본값: y): " INSTALL_OLLAMA
INSTALL_OLLAMA=${INSTALL_OLLAMA:-y}

# ── rhwp 한글 편집 서버 설정 ──────────────────────────────────────────
echo ""
echo -e "${BLUE}=== rhwp 한글(HWP) 웹 편집기 설정 ===${NC}"
echo -e "  rhwp는 Rust → WebAssembly 기반 한글 문서 웹 편집기입니다."
echo -e "  소스: https://github.com/edwardkim/rhwp"
echo -e "  데모: https://edwardkim.github.io/rhwp/"
echo ""
echo -e "  편집기 UI: 한컴오피스 스타일 메뉴바+툴바 (파일·편집·보기·입력·서식·쪽·표·도구)"
echo -e "  엔진:      Rust wasm-pack → WebAssembly → 브라우저 실시간 HWP 렌더링·편집"
echo ""
echo -e "  [1] 로컬 Docker 컨테이너로 설치"
echo -e "      · rhwp-src/ 소스 또는 offline-packages/rhwp/rhwp-image.tar.gz 필요"
echo -e "      · 최초 빌드 시 Rust WASM 컴파일 포함 15~30분 소요"
echo -e "      · 빌드 완료 후 offline-packages/rhwp/rhwp-image.tar.gz 저장 → 다른 서버 이식 가능"
echo -e "  [2] 이미 실행 중인 외부 rhwp 서버 IP 사용"
echo -e "  [3] 한글 편집기 사용 안함"
echo ""
read -p "선택 (1/2/3, 기본값: 3): " RHWP_INSTALL_MODE
RHWP_INSTALL_MODE=${RHWP_INSTALL_MODE:-3}

RHWP_HOST_IP="${HOST_IP}"
RHWP_PORT="8082"
RHWP_URL="http://devpi-rhwp:8080"
INSTALL_RHWP_LOCAL="n"

if [ "$RHWP_INSTALL_MODE" = "1" ]; then
    INSTALL_RHWP_LOCAL="y"
    read -p "rhwp 서비스 포트 (기본값: 8082): " RHWP_PORT_INPUT
    RHWP_PORT=${RHWP_PORT_INPUT:-8082}
    RHWP_URL="http://${HOST_IP}:${RHWP_PORT}"
    echo -e "  ${GREEN}rhwp 로컬 설치 예정 (포트: ${RHWP_PORT})${NC}"
    echo ""
    echo -e "  ${YELLOW}※ 설치 방법 안내 (아래 3가지 중 하나로 자동 감지):${NC}"
    echo -e "     A) offline-packages/rhwp/rhwp-image.tar.gz  — 폐쇄망 이미지 로드 (즉시)"
    echo -e "     B) rhwp-src/                                — 소스 빌드 (15~30분, 인터넷 필요)"
    echo -e "     C) GitHub에서 직접 clone + 빌드             — 설치 중 선택 가능"
elif [ "$RHWP_INSTALL_MODE" = "2" ]; then
    read -p "rhwp 서버 IP 또는 호스트 (예: 192.168.1.100): " RHWP_REMOTE_IP
    read -p "rhwp 서버 포트 (기본값: 8080): " RHWP_REMOTE_PORT
    RHWP_REMOTE_PORT=${RHWP_REMOTE_PORT:-8080}
    RHWP_URL="http://${RHWP_REMOTE_IP}:${RHWP_REMOTE_PORT}"
    echo -e "  ${GREEN}외부 rhwp 서버 사용: ${RHWP_URL}${NC}"
else
    RHWP_URL=""
    echo -e "  ${YELLOW}한글 편집기 비활성화 (한글 문서 웹 편집 기능 미사용)${NC}"
fi

INSTALL_TTS_LOCAL="n"

# ── MeloTTS 한국어 음성 합성 서버 설정 ──────────────────────────────────
echo ""
echo -e "${BLUE}=== MeloTTS 한국어 TTS 서버 설정 ===${NC}"
echo -e "  온라인 도움말 영상 생성 시 한국어 나레이션을 자동 합성합니다."
echo -e "  엔진: MeloTTS (pip 기반 VITS, 한국어 'KR' 화자, CPU/GPU 자동감지)"
echo -e "  ${CYAN}[참고] Docker 빌드 시 PyTorch CPU + MeloTTS 다운로드: 약 1~2GB${NC}"
echo ""
read -p "MeloTTS TTS 서버를 설치하시겠습니까? (y/n, 기본값: y): " INSTALL_TTS_INPUT
INSTALL_TTS_INPUT=${INSTALL_TTS_INPUT:-y}

HELP_TTS_URL=""
TTS_PORT="5500"

if [ "$INSTALL_TTS_INPUT" = "y" ] || [ "$INSTALL_TTS_INPUT" = "Y" ]; then
    INSTALL_TTS_LOCAL="y"
    read -p "TTS 서비스 포트 (기본값: 5500): " TTS_PORT_INPUT
    TTS_PORT=${TTS_PORT_INPUT:-5500}
    HELP_TTS_URL="http://devpi-tts:5500"
    echo -e "  ${GREEN}MeloTTS 로컬 설치 예정 (포트: ${TTS_PORT})${NC}"
    echo -e "  ${CYAN}[안내] 컨테이너 최초 시작 시 MeloTTS 한국어 모델이 자동 다운로드됩니다.${NC}"
else
    echo -e "  ${YELLOW}TTS 비활성화 (음성 없이 자막만 포함된 영상 생성)${NC}"
fi

OLLAMA_MODEL=$RECOMMENDED_MODEL
OLLAMA_CODE_MODEL=$RECOMMENDED_CODE_MODEL
OLLAMA_EMBEDDING=$RECOMMENDED_EMBEDDING
OLLAMA_VISION_MODEL="minicpm-v"
OLLAMA_PORT=$DEFAULT_OLLAMA_PORT

if [ "$INSTALL_OLLAMA" == "y" ] || [ "$INSTALL_OLLAMA" == "Y" ]; then
    echo ""
    echo "=== LLM 모델 선택 (텍스트 분석용) ==="
    echo "  0) ${RECOMMENDED_MODEL} - 시스템 사양 기반 자동 선택 (권장)"
    echo "  1) qwen2.5:14b  - 고성능 (GPU 16GB+ / RAM 64GB+)"
    echo "  2) qwen2.5:7b   - 중간 성능 (GPU 8GB+ / RAM 32GB+)"
    echo "  3) qwen2.5:3b   - 경량 (GPU 4GB+ / RAM 16GB+)"
    echo "  4) qwen2.5:1.5b - 초경량 (GPU 2GB+ / RAM 8GB+)"
    echo "  5) qwen2.5:0.5b - 최소 (RAM 4GB+)"
    echo ""
    read -p "설치할 LLM 모델 번호를 선택하세요 (기본값: 0): " MODEL_CHOICE

    case $MODEL_CHOICE in
        1) OLLAMA_MODEL="qwen2.5:14b" ;;
        2) OLLAMA_MODEL="qwen2.5:7b" ;;
        3) OLLAMA_MODEL="qwen2.5:3b" ;;
        4) OLLAMA_MODEL="qwen2.5:1.5b" ;;
        5) OLLAMA_MODEL="qwen2.5:0.5b" ;;
        *) OLLAMA_MODEL=$RECOMMENDED_MODEL ;;
    esac

    echo ""
    echo "=== 코드생성 모델 선택 (UI 프로토타입/코드리뷰용) ==="
    echo "코드리뷰(ProtoType) 기능에서 CBD 기반 자동 코드 생성에 사용됩니다."
    echo "  0) ${RECOMMENDED_CODE_MODEL} - 시스템 사양 기반 자동 선택 (권장)"
    echo "  1) qwen2.5-coder:14b  - 최고 품질 (GPU 12GB+ / RAM 32GB+) [권장]"
    echo "  2) qwen2.5-coder:14b  - 고성능 (GPU 12GB+ / RAM 32GB+)"
    echo "  3) qwen2.5-coder:7b   - 중간 성능 (GPU 8GB+ / RAM 16GB+)"
    echo "  4) qwen2.5-coder:3b   - 경량 (GPU 4GB+ / RAM 8GB+)"
    echo "  5) qwen2.5-coder:1.5b - 초경량 (RAM 4GB+)"
    echo "  6) 설치 안함           - 코드 생성 기능 비활성화"
    echo ""
    read -p "설치할 코드생성 모델 번호를 선택하세요 (기본값: 0): " CODE_MODEL_CHOICE

    case $CODE_MODEL_CHOICE in
        1) OLLAMA_CODE_MODEL="qwen2.5-coder:14b" ;;
        2) OLLAMA_CODE_MODEL="qwen2.5-coder:14b" ;;
        3) OLLAMA_CODE_MODEL="qwen2.5-coder:7b" ;;
        4) OLLAMA_CODE_MODEL="qwen2.5-coder:3b" ;;
        5) OLLAMA_CODE_MODEL="qwen2.5-coder:1.5b" ;;
        6) OLLAMA_CODE_MODEL="" ;;
        *) OLLAMA_CODE_MODEL=$RECOMMENDED_CODE_MODEL ;;
    esac

    echo ""
    echo "=== Vision 모델 선택 (문서 시각 분석용) ==="
    echo "PDF 차트/다이어그램/표 등 시각적 요소를 AI로 분석합니다."
    echo ""

    # GPU/RAM 기반 비전 모델 자동 추천
    RECOMMENDED_VISION="minicpm-v"
    if [ "$GPU_AVAILABLE" = true ] && [ "$GPU_VRAM" -ge 16 ]; then
        RECOMMENDED_VISION="llama3.2-vision"
    elif [ "$TOTAL_MEM_GB" -ge 64 ]; then
        RECOMMENDED_VISION="llama3.2-vision"
    fi

    echo "  0) ${RECOMMENDED_VISION} - 시스템 사양 기반 자동 선택 (권장)"
    echo "  1) llama3.2-vision  - 고성능 비전 (GPU 12GB+ / RAM 64GB+, 11B)"
    echo "  2) minicpm-v        - 경량 비전 (GPU 6GB+ / RAM 16GB+, 8B)"
    echo "  3) llava             - 범용 비전 (GPU 8GB+ / RAM 32GB+, 7B)"
    echo "  4) moondream         - 초경량 비전 (GPU 2GB+ / RAM 8GB+, 1.8B)"
    echo "  5) 설치 안함         - Vision 분석 기능 비활성화"
    echo ""
    read -p "설치할 Vision 모델 번호를 선택하세요 (기본값: 0): " VISION_CHOICE

    case $VISION_CHOICE in
        1) OLLAMA_VISION_MODEL="llama3.2-vision" ;;
        2) OLLAMA_VISION_MODEL="minicpm-v" ;;
        3) OLLAMA_VISION_MODEL="llava" ;;
        4) OLLAMA_VISION_MODEL="moondream" ;;
        5) OLLAMA_VISION_MODEL="" ;;
        *) OLLAMA_VISION_MODEL=$RECOMMENDED_VISION ;;
    esac

    read -p "Ollama 포트를 입력하세요 (기본값: $DEFAULT_OLLAMA_PORT): " OLLAMA_PORT
    OLLAMA_PORT=${OLLAMA_PORT:-$DEFAULT_OLLAMA_PORT}
fi

echo ""
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}  설정 확인${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""
echo -e "  ${BLUE}[OS 정보]${NC}"
echo "  - OS: $OS_NAME $OS_VERSION ($OS_FAMILY 계열)"
echo ""
echo -e "  ${BLUE}[시스템 정보]${NC}"
echo "  - CPU: $CPU_MODEL ($CPU_CORES 논리코어)"
echo "  - 메모리: ${TOTAL_MEM_GB}GB"
echo "  - GPU: $GPU_NAME ($GPU_TYPE)"
if [ "$GPU_AVAILABLE" = true ]; then
    echo "  - GPU VRAM: ${GPU_VRAM}GB"
fi
echo "  - 디스크 여유: ${AVAILABLE_DISK}GB"
echo ""
echo -e "  ${BLUE}[네트워크 설정]${NC}"
echo "  - 바인딩 IP: $HOST_IP"
echo "  - 앱 포트: $APP_PORT"
echo "  - DB 포트: $DB_PORT"
echo "  - 동시 사용자: ${MAX_USERS}명"
echo ""
echo -e "  ${BLUE}[성능 튜닝 (자동 계산)]${NC}"
echo "  - PostgreSQL shared_buffers: ${PG_SHARED_BUFFERS_GB}GB"
echo "  - PostgreSQL max_connections: ${PG_MAX_CONNECTIONS}"
echo "  - PostgreSQL work_mem: ${PG_WORK_MEM_KB}kB"
echo "  - Node.js heap: ${NODE_HEAP_MB}MB"
echo "  - UV_THREADPOOL_SIZE: ${UV_POOL_SIZE}"
echo "  - DB 컨테이너: CPU ${DOCKER_DB_CPU}, RAM ${DOCKER_DB_MEM_GB}GB"
echo "  - 앱 컨테이너: CPU ${DOCKER_APP_CPU}, RAM ${DOCKER_APP_MEM_GB}GB"
echo ""
if [ "$INSTALL_OLLAMA" == "y" ] || [ "$INSTALL_OLLAMA" == "Y" ]; then
    echo -e "  ${BLUE}[AI/LLM 설정]${NC}"
    echo "  - Ollama: 로컬 설치 (${OLLAMA_LOCAL_DIR})"
    echo "  - LLM 모델: $OLLAMA_MODEL"
    if [ -n "$OLLAMA_CODE_MODEL" ]; then
        echo "  - 코드생성 모델: $OLLAMA_CODE_MODEL"
    else
        echo "  - 코드생성 모델: 설치 안함"
    fi
    echo "  - 임베딩 모델: $OLLAMA_EMBEDDING"
    if [ -n "$OLLAMA_VISION_MODEL" ]; then
        echo "  - Vision 모델: $OLLAMA_VISION_MODEL"
    else
        echo "  - Vision 모델: 설치 안함"
    fi
    echo "  - Ollama 포트: $OLLAMA_PORT"
    echo "  - 동시 처리 수: ${OLLAMA_NUM_PARALLEL}"
else
    echo -e "  ${YELLOW}[AI/LLM 설정]${NC}"
    echo "  - Ollama: 설치 안함"
fi
echo ""
echo -e "  ${BLUE}[PDF 변환 (LibreOffice)]${NC}"
if [ "$LIBREOFFICE_INSTALLED" = true ]; then
    echo "  - LibreOffice: 설치됨"
    echo "  - 지원 형식: DOCX, XLSX, PPTX, HWP, ODT, ODS, ODP, RTF, CSV, HTML"
else
    echo "  - LibreOffice: 미설치 (PDF 변환 기능 비활성화)"
fi
echo ""
echo -e "  ${BLUE}[PDF 텍스트 추출 (OpenDataLoader PDF + Java 17)]${NC}"
if [ "$JAVA17_INSTALLED" = true ]; then
    JAVA_VER_DISPLAY=$(java -version 2>&1 | head -1 || echo "Unknown")
    echo "  - Java 17: 설치됨 (${JAVA_VER_DISPLAY})"
    echo "  - OpenDataLoader PDF: 테이블 구조 보존, Markdown 출력, XY-Cut 읽기 순서"
    echo "  - JAR 경로: node_modules/@opendataloader/pdf/lib/opendataloader-pdf-cli.jar"
    echo "  - 폴백: unpdf → Tesseract OCR"
else
    echo "  - Java 17: 미설치 (OpenDataLoader PDF 비활성화, unpdf 폴백 사용)"
    if [ "$OS_FAMILY" = "rhel" ]; then
        echo "  - 수동 설치: sudo dnf install -y java-17-openjdk"
    fi
fi
echo ""
echo -e "  ${BLUE}[Vision PDF 이미지 변환 도구]${NC}"
if [ "$PDF_IMAGE_TOOLS_INSTALLED" = true ]; then
    command -v pdftoppm &> /dev/null && echo "  - pdftoppm (poppler-utils): 설치됨"
    command -v convert &> /dev/null && echo "  - convert (ImageMagick): 설치됨"
    command -v gs &> /dev/null && echo "  - gs (Ghostscript): 설치됨"
else
    echo "  - PDF 이미지 변환 도구: 미설치 (Vision 문서 분석 비활성화)"
fi
echo ""

read -p "위 설정으로 진행하시겠습니까? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "설치가 취소되었습니다."
    exit 1
fi

# =====================================
# Ollama 로컬 설치 (프로젝트 디렉토리)
# =====================================

if [ "$INSTALL_OLLAMA" == "y" ] || [ "$INSTALL_OLLAMA" == "Y" ]; then
    echo ""
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${CYAN}  Ollama 로컬 설치 중...${NC}"
    echo -e "${CYAN}  설치 경로: ${OLLAMA_LOCAL_DIR}${NC}"
    echo -e "${CYAN}==========================================${NC}"

    # Ollama 로컬 디렉토리 구조 생성
    mkdir -p "${OLLAMA_LOCAL_DIR}/bin"
    mkdir -p "${OLLAMA_LOCAL_DIR}/models"
    mkdir -p "${OLLAMA_LOCAL_DIR}/logs"

    OLLAMA_BIN="${OLLAMA_LOCAL_DIR}/bin/ollama"

    if [ -f "$OLLAMA_BIN" ]; then
        echo -e "${GREEN}Ollama가 이미 로컬에 설치되어 있습니다.${NC}"
        OLLAMA_VERSION=$("$OLLAMA_BIN" --version 2>/dev/null || echo "버전 확인 불가")
        echo "현재 버전: $OLLAMA_VERSION"
    else
        echo "Ollama 바이너리를 다운로드합니다..."
        echo -e "  설치 위치: ${GREEN}${OLLAMA_BIN}${NC}"

        # 아키텍처 감지
        ARCH=$(uname -m)
        case "$ARCH" in
            x86_64|amd64)
                OLLAMA_ARCH="amd64"
                ;;
            aarch64|arm64)
                OLLAMA_ARCH="arm64"
                ;;
            *)
                echo -e "${RED}[오류] 지원되지 않는 아키텍처: $ARCH${NC}"
                exit 1
                ;;
        esac

        # Ollama 아카이브 다운로드 후 바이너리 추출 (root 권한 불필요)
        # 2025년부터 Ollama는 .tar.zst 아카이브로 배포됩니다
        OLLAMA_DOWNLOAD_URL="https://ollama.com/download/ollama-linux-${OLLAMA_ARCH}.tar.zst"
        OLLAMA_TAR_GZ_URL="https://ollama.com/download/ollama-linux-${OLLAMA_ARCH}.tar.gz"
        OLLAMA_TGZ_URL="https://ollama.com/download/ollama-linux-${OLLAMA_ARCH}.tgz"

        echo "다운로드 URL: $OLLAMA_DOWNLOAD_URL"
        echo ""

        DOWNLOAD_SUCCESS=false
        OLLAMA_TEMP_DIR=$(mktemp -d)

        # 방법 1: .tar.zst 아카이브 다운로드 (최신 형식)
        echo "아카이브 형식(.tar.zst)으로 다운로드 시도 중..."
        if command -v curl &> /dev/null; then
            if curl -fSL -o "${OLLAMA_TEMP_DIR}/ollama.tar.zst" "$OLLAMA_DOWNLOAD_URL" 2>/dev/null; then
                # zstd 해제 도구 확인
                if command -v zstd &> /dev/null || command -v tar &> /dev/null; then
                    echo "아카이브 추출 중..."
                    if tar --zstd -xf "${OLLAMA_TEMP_DIR}/ollama.tar.zst" -C "${OLLAMA_TEMP_DIR}" 2>/dev/null || \
                       (command -v zstd &> /dev/null && zstd -d "${OLLAMA_TEMP_DIR}/ollama.tar.zst" -o "${OLLAMA_TEMP_DIR}/ollama.tar" 2>/dev/null && tar xf "${OLLAMA_TEMP_DIR}/ollama.tar" -C "${OLLAMA_TEMP_DIR}" 2>/dev/null); then
                        # 바이너리 찾기 (아카이브 내부 구조에 따라)
                        FOUND_BIN=$(find "${OLLAMA_TEMP_DIR}" -name "ollama" -type f 2>/dev/null | head -1)
                        if [ -n "$FOUND_BIN" ] && [ -f "$FOUND_BIN" ]; then
                            cp "$FOUND_BIN" "$OLLAMA_BIN"
                            # lib 디렉토리도 있으면 복사 (GPU 지원 라이브러리)
                            FOUND_LIB_DIR=$(find "${OLLAMA_TEMP_DIR}" -name "lib" -type d 2>/dev/null | head -1)
                            if [ -n "$FOUND_LIB_DIR" ] && [ -d "$FOUND_LIB_DIR" ]; then
                                cp -r "$FOUND_LIB_DIR" "${OLLAMA_LOCAL_DIR}/"
                                echo "GPU 지원 라이브러리 복사 완료"
                            fi
                            DOWNLOAD_SUCCESS=true
                            echo -e "${GREEN}.tar.zst 아카이브에서 바이너리 추출 완료${NC}"
                        fi
                    fi
                else
                    echo -e "${YELLOW}zstd 해제 도구가 없습니다. 다른 형식을 시도합니다.${NC}"
                    if [ "$OS_FAMILY" = "rhel" ]; then
                        echo "  설치: sudo dnf install -y zstd"
                    fi
                fi
            fi
        fi

        # 방법 2: .tar.gz 또는 .tgz 아카이브 시도 (대안)
        if [ "$DOWNLOAD_SUCCESS" = false ]; then
            echo "대안 형식(.tar.gz)으로 다운로드 시도 중..."
            if command -v curl &> /dev/null; then
                if curl -fSL -o "${OLLAMA_TEMP_DIR}/ollama.tar.gz" "$OLLAMA_TAR_GZ_URL" 2>/dev/null; then
                    if tar xzf "${OLLAMA_TEMP_DIR}/ollama.tar.gz" -C "${OLLAMA_TEMP_DIR}" 2>/dev/null; then
                        FOUND_BIN=$(find "${OLLAMA_TEMP_DIR}" -name "ollama" -type f 2>/dev/null | head -1)
                        if [ -n "$FOUND_BIN" ] && [ -f "$FOUND_BIN" ]; then
                            cp "$FOUND_BIN" "$OLLAMA_BIN"
                            FOUND_LIB_DIR=$(find "${OLLAMA_TEMP_DIR}" -name "lib" -type d 2>/dev/null | head -1)
                            if [ -n "$FOUND_LIB_DIR" ] && [ -d "$FOUND_LIB_DIR" ]; then
                                cp -r "$FOUND_LIB_DIR" "${OLLAMA_LOCAL_DIR}/"
                            fi
                            DOWNLOAD_SUCCESS=true
                            echo -e "${GREEN}.tar.gz 아카이브에서 바이너리 추출 완료${NC}"
                        fi
                    fi
                fi
            fi
        fi

        # 방법 3: GitHub Releases에서 직접 바이너리 다운로드 시도
        if [ "$DOWNLOAD_SUCCESS" = false ]; then
            echo "GitHub Releases에서 다운로드 시도 중..."
            GITHUB_URL="https://github.com/ollama/ollama/releases/latest/download/ollama-linux-${OLLAMA_ARCH}.tar.zst"
            if command -v curl &> /dev/null; then
                if curl -fSL -o "${OLLAMA_TEMP_DIR}/ollama-gh.tar.zst" "$GITHUB_URL" 2>/dev/null; then
                    if tar --zstd -xf "${OLLAMA_TEMP_DIR}/ollama-gh.tar.zst" -C "${OLLAMA_TEMP_DIR}" 2>/dev/null; then
                        FOUND_BIN=$(find "${OLLAMA_TEMP_DIR}" -name "ollama" -type f 2>/dev/null | head -1)
                        if [ -n "$FOUND_BIN" ] && [ -f "$FOUND_BIN" ]; then
                            cp "$FOUND_BIN" "$OLLAMA_BIN"
                            FOUND_LIB_DIR=$(find "${OLLAMA_TEMP_DIR}" -name "lib" -type d 2>/dev/null | head -1)
                            if [ -n "$FOUND_LIB_DIR" ] && [ -d "$FOUND_LIB_DIR" ]; then
                                cp -r "$FOUND_LIB_DIR" "${OLLAMA_LOCAL_DIR}/"
                            fi
                            DOWNLOAD_SUCCESS=true
                            echo -e "${GREEN}GitHub에서 바이너리 추출 완료${NC}"
                        fi
                    fi
                fi
            fi
        fi

        # 임시 디렉토리 정리
        rm -rf "${OLLAMA_TEMP_DIR}"

        if [ "$DOWNLOAD_SUCCESS" = false ] || [ ! -f "$OLLAMA_BIN" ]; then
            echo -e "${RED}[오류] Ollama 다운로드에 실패했습니다.${NC}"
            echo ""
            echo "폐쇄망 환경에서는 다음 방법으로 수동 설치하세요:"
            echo "  1. 외부 네트워크에서 다운로드:"
            echo "     curl -fSL -o ollama.tar.zst $OLLAMA_DOWNLOAD_URL"
            echo "  2. 아카이브 추출:"
            echo "     tar --zstd -xf ollama.tar.zst"
            echo "  3. 바이너리 복사:"
            echo "     cp bin/ollama ${OLLAMA_BIN}"
            echo "     chmod +x ${OLLAMA_BIN}"
            echo ""
            echo "  또는 zstd가 없다면 먼저 설치하세요:"
            echo "     sudo dnf install -y zstd"
            echo ""
            read -p "Ollama 없이 계속 진행하시겠습니까? (y/n): " CONTINUE_WITHOUT_OLLAMA
            if [ "$CONTINUE_WITHOUT_OLLAMA" != "y" ] && [ "$CONTINUE_WITHOUT_OLLAMA" != "Y" ]; then
                exit 1
            fi
            INSTALL_OLLAMA="n"
        else
            chmod +x "$OLLAMA_BIN"
            echo -e "${GREEN}Ollama 바이너리 다운로드 완료${NC}"
            OLLAMA_VERSION=$("$OLLAMA_BIN" --version 2>/dev/null || echo "버전 확인 불가")
            echo "설치된 버전: $OLLAMA_VERSION"
        fi
    fi

    if [ "$INSTALL_OLLAMA" == "y" ] || [ "$INSTALL_OLLAMA" == "Y" ]; then
        echo ""
        echo "Ollama 서비스 시작 중..."
        echo -e "  모델 저장 경로: ${GREEN}${OLLAMA_LOCAL_DIR}/models${NC}"
        echo -e "  로그 경로: ${GREEN}${OLLAMA_LOCAL_DIR}/logs${NC}"

        # 기존 Ollama 프로세스 종료 (로컬 바이너리 기준)
        pkill -f "${OLLAMA_BIN}" 2>/dev/null || true
        sleep 1

        # 환경변수 설정 후 Ollama 시작 (로컬 경로 사용)
        export OLLAMA_HOST="0.0.0.0:${OLLAMA_PORT}"
        export OLLAMA_MODELS="${OLLAMA_LOCAL_DIR}/models"
        export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL}"
        export OLLAMA_MAX_LOADED_MODELS=2
        export OLLAMA_KEEP_ALIVE="10m"

        # CPU 기반 성능 튜닝
        export OLLAMA_NUM_THREAD=$((CPU_CORES * 70 / 100))
        if [ "$OLLAMA_NUM_THREAD" -gt 32 ]; then
            OLLAMA_NUM_THREAD=32
        fi
        export GOMAXPROCS=$OLLAMA_CPU

        # NVIDIA GPU 환경변수
        if [ "$GPU_TYPE" = "nvidia" ] && [ "$GPU_AVAILABLE" = "true" ]; then
            export NVIDIA_VISIBLE_DEVICES=all
            export NVIDIA_DRIVER_CAPABILITIES=compute,utility
            export CUDA_VISIBLE_DEVICES=0
            export OLLAMA_NUM_GPU_LAYERS=${OLLAMA_GPU_LAYERS}
            export OLLAMA_FLASH_ATTENTION=1
            if [ "$GPU_T600_OPTIMIZED" = "true" ]; then
                # T600 4GB VRAM: OOM 방지 256MB 예약
                export OLLAMA_GPU_OVERHEAD=268435456
                echo -e "  ${CYAN}[T600 GPU]${NC} GPU 레이어=${OLLAMA_GPU_LAYERS}, Flash Attention=ON, VRAM 256MB 예약"
            fi
        fi

        nohup "$OLLAMA_BIN" serve > "${OLLAMA_LOCAL_DIR}/logs/ollama.log" 2>&1 &
        OLLAMA_PID=$!
        echo "Ollama PID: $OLLAMA_PID"

        # Ollama 시작 대기
        echo "Ollama 서비스 시작 대기 중..."
        for i in $(seq 1 30); do
            if curl -s "http://localhost:${OLLAMA_PORT}/api/tags" > /dev/null 2>&1; then
                echo -e "${GREEN}Ollama 서비스가 시작되었습니다.${NC}"
                break
            fi
            sleep 1
            if [ "$i" -eq 30 ]; then
                echo -e "${YELLOW}[경고] Ollama 시작 시간이 초과되었습니다. 로그를 확인하세요:${NC}"
                echo "  tail -f ${OLLAMA_LOCAL_DIR}/logs/ollama.log"
            fi
        done

        # LLM 모델 다운로드
        echo ""
        echo -e "${YELLOW}LLM 모델 다운로드 중: $OLLAMA_MODEL${NC}"
        echo "이 과정은 모델 크기에 따라 몇 분에서 수십 분이 소요될 수 있습니다..."
        echo ""

        if OLLAMA_HOST="http://localhost:${OLLAMA_PORT}" OLLAMA_MODELS="${OLLAMA_LOCAL_DIR}/models" "$OLLAMA_BIN" pull $OLLAMA_MODEL; then
            echo ""
            echo -e "${GREEN}LLM 모델 다운로드 완료: $OLLAMA_MODEL${NC}"
        else
            echo ""
            echo -e "${YELLOW}[경고] LLM 모델 다운로드에 실패했습니다.${NC}"
            echo "나중에 수동으로 다운로드하세요:"
            echo "  OLLAMA_HOST=http://localhost:${OLLAMA_PORT} ${OLLAMA_BIN} pull $OLLAMA_MODEL"
        fi

        # 임베딩 모델 다운로드 (RAG용)
        echo ""
        echo -e "${YELLOW}임베딩 모델 다운로드 중: $OLLAMA_EMBEDDING${NC}"

        if OLLAMA_HOST="http://localhost:${OLLAMA_PORT}" OLLAMA_MODELS="${OLLAMA_LOCAL_DIR}/models" "$OLLAMA_BIN" pull $OLLAMA_EMBEDDING; then
            echo ""
            echo -e "${GREEN}임베딩 모델 다운로드 완료: $OLLAMA_EMBEDDING${NC}"
        else
            echo ""
            echo -e "${YELLOW}[경고] 임베딩 모델 다운로드에 실패했습니다.${NC}"
            echo "나중에 수동으로 다운로드하세요:"
            echo "  OLLAMA_HOST=http://localhost:${OLLAMA_PORT} ${OLLAMA_BIN} pull $OLLAMA_EMBEDDING"
        fi

        # 코드생성 모델 다운로드 (UI 프로토타입/코드리뷰용)
        if [ -n "$OLLAMA_CODE_MODEL" ]; then
            echo ""
            echo -e "${YELLOW}코드생성 모델 다운로드 중: $OLLAMA_CODE_MODEL${NC}"
            echo "이 모델은 코드리뷰(ProtoType) 기능에서 CBD 기반 자동 코드 생성에 사용됩니다."
            echo "32B 모델의 경우 약 18~20GB 다운로드가 필요하며 시간이 많이 소요될 수 있습니다."
            echo ""

            if OLLAMA_HOST="http://localhost:${OLLAMA_PORT}" OLLAMA_MODELS="${OLLAMA_LOCAL_DIR}/models" "$OLLAMA_BIN" pull $OLLAMA_CODE_MODEL; then
                echo ""
                echo -e "${GREEN}코드생성 모델 다운로드 완료: $OLLAMA_CODE_MODEL${NC}"
            else
                echo ""
                echo -e "${YELLOW}[경고] 코드생성 모델 다운로드에 실패했습니다.${NC}"
                echo "나중에 수동으로 다운로드하세요:"
                echo "  OLLAMA_HOST=http://localhost:${OLLAMA_PORT} ${OLLAMA_BIN} pull $OLLAMA_CODE_MODEL"
            fi
        else
            echo ""
            echo -e "${YELLOW}코드생성 모델 설치를 건너뜁니다. (코드 생성 기능 비활성화)${NC}"
        fi

        # Vision 모델 다운로드 (문서 시각 분석용)
        if [ -n "$OLLAMA_VISION_MODEL" ]; then
            echo ""
            echo -e "${YELLOW}Vision 모델 다운로드 중: $OLLAMA_VISION_MODEL${NC}"
            echo "이 모델은 PDF 문서의 차트, 다이어그램, 표 등을 AI로 분석합니다."
            echo ""

            if OLLAMA_HOST="http://localhost:${OLLAMA_PORT}" OLLAMA_MODELS="${OLLAMA_LOCAL_DIR}/models" "$OLLAMA_BIN" pull $OLLAMA_VISION_MODEL; then
                echo ""
                echo -e "${GREEN}Vision 모델 다운로드 완료: $OLLAMA_VISION_MODEL${NC}"
            else
                echo ""
                echo -e "${YELLOW}[경고] Vision 모델 다운로드에 실패했습니다.${NC}"
                echo "나중에 수동으로 다운로드하세요:"
                echo "  OLLAMA_HOST=http://localhost:${OLLAMA_PORT} ${OLLAMA_BIN} pull $OLLAMA_VISION_MODEL"
            fi
        else
            echo ""
            echo -e "${YELLOW}Vision 모델 설치를 건너뜁니다. (Vision 분석 기능 비활성화)${NC}"
        fi
    fi
fi

# =====================================
# Ollama systemd 서비스 파일 생성 (로컬 경로)
# =====================================

if [ "$INSTALL_OLLAMA" == "y" ] || [ "$INSTALL_OLLAMA" == "Y" ]; then
    echo ""
    echo -e "${CYAN}Ollama 서비스 관리 스크립트 생성 중...${NC}"

    # Ollama 시작 스크립트
    cat > "${OLLAMA_LOCAL_DIR}/start-ollama.sh" << OLLAMA_START_EOF
#!/bin/bash
# Ollama 로컬 시작 스크립트
# 설치 경로: ${OLLAMA_LOCAL_DIR}

OLLAMA_DIR="${OLLAMA_LOCAL_DIR}"
OLLAMA_BIN="\${OLLAMA_DIR}/bin/ollama"
OLLAMA_LOG="\${OLLAMA_DIR}/logs/ollama.log"

export OLLAMA_HOST="0.0.0.0:${OLLAMA_PORT}"
export OLLAMA_MODELS="\${OLLAMA_DIR}/models"
export OLLAMA_NUM_PARALLEL=${OLLAMA_NUM_PARALLEL}
export OLLAMA_MAX_LOADED_MODELS=2
export OLLAMA_KEEP_ALIVE="10m"
export OLLAMA_NUM_THREAD=${OLLAMA_NUM_THREAD}
export GOMAXPROCS=${OLLAMA_CPU}

# NVIDIA GPU 설정 (T600 포함)
$(if [ "$GPU_TYPE" = "nvidia" ] && [ "$GPU_AVAILABLE" = "true" ]; then
    echo "export NVIDIA_VISIBLE_DEVICES=all"
    echo "export NVIDIA_DRIVER_CAPABILITIES=compute,utility"
    echo "export CUDA_VISIBLE_DEVICES=0"
    echo "export OLLAMA_NUM_GPU_LAYERS=${OLLAMA_GPU_LAYERS}"
    echo "export OLLAMA_FLASH_ATTENTION=1"
    if [ "$GPU_T600_OPTIMIZED" = "true" ]; then
        echo "export OLLAMA_GPU_OVERHEAD=268435456  # 256MB VRAM 예약 (T600 OOM 방지)"
    fi
fi)

if pgrep -f "\${OLLAMA_BIN}" > /dev/null 2>&1; then
    echo "Ollama is already running."
    exit 0
fi

echo "Starting Ollama..."
echo "  Binary: \${OLLAMA_BIN}"
echo "  Models: \${OLLAMA_MODELS}"
echo "  Port: ${OLLAMA_PORT}"
echo "  Log: \${OLLAMA_LOG}"

nohup "\${OLLAMA_BIN}" serve >> "\${OLLAMA_LOG}" 2>&1 &
echo "Ollama started with PID: \$!"

# 시작 대기
for i in \$(seq 1 20); do
    if curl -s "http://localhost:${OLLAMA_PORT}/api/tags" > /dev/null 2>&1; then
        echo "Ollama is ready."
        exit 0
    fi
    sleep 1
done
echo "Warning: Ollama may not have started properly. Check: \${OLLAMA_LOG}"
OLLAMA_START_EOF
    chmod +x "${OLLAMA_LOCAL_DIR}/start-ollama.sh"

    # Ollama 중지 스크립트
    cat > "${OLLAMA_LOCAL_DIR}/stop-ollama.sh" << OLLAMA_STOP_EOF
#!/bin/bash
# Ollama 로컬 중지 스크립트
OLLAMA_BIN="${OLLAMA_LOCAL_DIR}/bin/ollama"
echo "Stopping Ollama..."
pkill -f "\${OLLAMA_BIN}" 2>/dev/null
echo "Ollama stopped."
OLLAMA_STOP_EOF
    chmod +x "${OLLAMA_LOCAL_DIR}/stop-ollama.sh"

    # Ollama systemd 유닛 파일 생성 (선택적으로 설치)
    cat > "${OLLAMA_LOCAL_DIR}/ollama-local.service" << OLLAMA_SERVICE_EOF
[Unit]
Description=Ollama Local Service (ATENA)
After=network-online.target

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=${OLLAMA_LOCAL_DIR}
ExecStart=${OLLAMA_LOCAL_DIR}/bin/ollama serve
Environment="OLLAMA_HOST=0.0.0.0:${OLLAMA_PORT}"
Environment="OLLAMA_MODELS=${OLLAMA_LOCAL_DIR}/models"
Environment="OLLAMA_NUM_PARALLEL=${OLLAMA_NUM_PARALLEL}"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_NUM_THREAD=${OLLAMA_NUM_THREAD}"
Environment="GOMAXPROCS=${OLLAMA_CPU}"
$(if [ "$GPU_TYPE" = "nvidia" ] && [ "$GPU_AVAILABLE" = "true" ]; then
    echo "Environment=\"NVIDIA_VISIBLE_DEVICES=all\""
    echo "Environment=\"NVIDIA_DRIVER_CAPABILITIES=compute,utility\""
    echo "Environment=\"CUDA_VISIBLE_DEVICES=0\""
    echo "Environment=\"OLLAMA_NUM_GPU_LAYERS=${OLLAMA_GPU_LAYERS}\""
    echo "Environment=\"OLLAMA_FLASH_ATTENTION=1\""
    if [ "$GPU_T600_OPTIMIZED" = "true" ]; then
        echo "Environment=\"OLLAMA_GPU_OVERHEAD=268435456\""
    fi
fi)
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
OLLAMA_SERVICE_EOF

    echo -e "${GREEN}Ollama 관리 스크립트가 생성되었습니다.${NC}"
    echo -e "  시작: ${OLLAMA_LOCAL_DIR}/start-ollama.sh"
    echo -e "  중지: ${OLLAMA_LOCAL_DIR}/stop-ollama.sh"
    echo ""
    echo -e "${YELLOW}[선택사항] systemd 서비스로 등록하려면:${NC}"
    echo -e "  sudo cp ${OLLAMA_LOCAL_DIR}/ollama-local.service /etc/systemd/system/"
    echo -e "  sudo systemctl daemon-reload"
    echo -e "  sudo systemctl enable --now ollama-local"
fi

# =====================================
# 설정 파일 생성
# =====================================

echo ""
echo -e "${CYAN}설정 파일 생성 중...${NC}"

# .env 파일 생성
cat > "${INSTALL_DIR}/.env" << EOF
# ATENA 시스템 설정 파일
# 생성일: $(date '+%Y-%m-%d %H:%M:%S')
# 대상 OS: ${OS_NAME} ${OS_VERSION}
# 서버 사양: CPU ${CPU_CORES}코어, RAM ${TOTAL_MEM_GB}GB
# 동시 사용자: ${MAX_USERS}명

# 네트워크 설정
HOST_IP=$HOST_IP
APP_PORT=$APP_PORT
DB_PORT=$DB_PORT
SESSION_SECRET=$SESSION_SECRET

# Ollama 설정 (로컬 설치)
OLLAMA_HOST=http://localhost:$OLLAMA_PORT
OLLAMA_MODEL=$OLLAMA_MODEL
OLLAMA_CODE_MODEL=${OLLAMA_CODE_MODEL:-qwen2.5-coder:14b}
OLLAMA_EMBEDDING_MODEL=$OLLAMA_EMBEDDING
OLLAMA_VISION_MODEL=${OLLAMA_VISION_MODEL:-llava}

# GPU 설정 (NVIDIA T600 포함)
# GPU: ${GPU_NAME} (${GPU_TYPE}, VRAM ${GPU_VRAM}GB, Compute ${GPU_COMPUTE_CAP})
$(if [ "$GPU_TYPE" = "nvidia" ] && [ "$GPU_AVAILABLE" = "true" ]; then
    echo "NVIDIA_VISIBLE_DEVICES=all"
    echo "NVIDIA_DRIVER_CAPABILITIES=compute,utility"
    echo "CUDA_VISIBLE_DEVICES=0"
    echo "OLLAMA_NUM_GPU_LAYERS=${OLLAMA_GPU_LAYERS}"
    echo "OLLAMA_FLASH_ATTENTION=1"
    if [ "$GPU_T600_OPTIMIZED" = "true" ]; then
        echo "# T600 4GB VRAM: 부분 GPU 오프로딩 (${OLLAMA_GPU_LAYERS}레이어 GPU + CPU RAM 혼용)"
        echo "# 14B 모델 기준 qwen2.5:14b → GPU ${OLLAMA_GPU_LAYERS}레이어, 나머지 CPU RAM 사용"
        echo "OLLAMA_GPU_OVERHEAD=268435456"
    fi
else
    echo "# GPU 없음 또는 비NVIDIA — CPU 전용 모드"
    echo "# OLLAMA_NUM_GPU_LAYERS=0"
fi)

# LLM 타임아웃 설정 (밀리초)
LLM_TOTAL_TIMEOUT=600000
LLM_CONNECT_TIMEOUT=180000
LLM_IDLE_TIMEOUT=180000

# Node.js 성능 튜닝
NODE_OPTIONS=--max-old-space-size=${NODE_HEAP_MB}
UV_THREADPOOL_SIZE=${UV_POOL_SIZE}

# PDF 변환 (LibreOffice)
LIBREOFFICE_INSTALLED=${LIBREOFFICE_INSTALLED:-false}

# LoRA 어댑터 학습 진행률 콜백 보호 (localhost + 공유 시크릿)
ADAPTER_INTERNAL_SECRET=$ADAPTER_INTERNAL_SECRET

# LoRA 어댑터 학습 노드 (선택, GPU 노드에서만)
# ADAPTER_PYTHON_BIN=/usr/bin/python3

# 한글 편집기 (rhwp) — 로컬 Docker 설치 시 사용
RHWP_PORT=${RHWP_PORT:-8082}
RHWP_URL=${RHWP_URL:-}
EOF

echo -e "${GREEN}.env 파일이 생성되었습니다.${NC}"

# 시스템 정보 JSON 파일 생성
cat > "${INSTALL_DIR}/system-info.json" << EOF
{
  "generated_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "os": {
    "name": "${OS_NAME}",
    "version": "${OS_VERSION}",
    "family": "${OS_FAMILY}"
  },
  "cpu": {
    "model": "${CPU_MODEL}",
    "cores": ${CPU_CORES},
    "sockets": ${CPU_SOCKETS}
  },
  "memory": {
    "total_gb": ${TOTAL_MEM_GB},
    "total_mb": ${TOTAL_MEM_MB}
  },
  "gpu": {
    "available": ${GPU_AVAILABLE},
    "type": "${GPU_TYPE}",
    "name": "${GPU_NAME}",
    "vram_gb": ${GPU_VRAM}
  },
  "disk": {
    "available_gb": ${AVAILABLE_DISK}
  },
  "models": {
    "llm": "${OLLAMA_MODEL}",
    "code": "${OLLAMA_CODE_MODEL}",
    "embedding": "${OLLAMA_EMBEDDING}",
    "vision": "${OLLAMA_VISION_MODEL}"
  },
  "network": {
    "host_ip": "${HOST_IP}",
    "app_port": ${APP_PORT},
    "db_port": ${DB_PORT},
    "ollama_port": ${OLLAMA_PORT}
  },
  "tuning": {
    "max_users": ${MAX_USERS},
    "postgresql": {
      "max_connections": ${PG_MAX_CONNECTIONS},
      "shared_buffers_gb": ${PG_SHARED_BUFFERS_GB},
      "effective_cache_size_gb": ${PG_EFFECTIVE_CACHE_GB},
      "maintenance_work_mem_mb": ${PG_MAINTENANCE_WORK_MB},
      "work_mem_kb": ${PG_WORK_MEM_KB},
      "wal_buffers_mb": ${PG_WAL_BUFFERS_MB},
      "max_worker_processes": ${PG_MAX_WORKERS},
      "max_parallel_workers": ${PG_PARALLEL_WORKERS},
      "max_parallel_workers_per_gather": ${PG_PARALLEL_GATHER},
      "max_parallel_maintenance_workers": ${PG_PARALLEL_MAINT}
    },
    "nodejs": {
      "max_old_space_size_mb": ${NODE_HEAP_MB},
      "uv_threadpool_size": ${UV_POOL_SIZE}
    },
    "docker": {
      "db_cpu": ${DOCKER_DB_CPU},
      "db_mem_gb": ${DOCKER_DB_MEM_GB},
      "app_cpu": ${DOCKER_APP_CPU},
      "app_mem_gb": ${DOCKER_APP_MEM_GB}
    },
    "ollama": {
      "cpu": ${OLLAMA_CPU},
      "mem_gb": ${OLLAMA_MEM_GB},
      "num_parallel": ${OLLAMA_NUM_PARALLEL},
      "num_thread": ${OLLAMA_NUM_THREAD:-0}
    }
  },
  "ollama_install": {
    "path": "${OLLAMA_LOCAL_DIR}",
    "binary": "${OLLAMA_LOCAL_DIR}/bin/ollama",
    "models_dir": "${OLLAMA_LOCAL_DIR}/models"
  },
  "libreoffice": {
    "installed": ${LIBREOFFICE_INSTALLED:-false},
    "pdf_conversion": ${LIBREOFFICE_INSTALLED:-false}
  },
  "java17": {
    "installed": ${JAVA17_INSTALLED:-false},
    "version": "$(java -version 2>&1 | head -1 2>/dev/null || echo 'not installed')",
    "purpose": "OpenDataLoader PDF text extraction"
  },
  "pdf_image_tools": {
    "installed": ${PDF_IMAGE_TOOLS_INSTALLED:-false},
    "pdftoppm": $(command -v pdftoppm &>/dev/null && echo true || echo false),
    "imagemagick": $(command -v convert &>/dev/null && echo true || echo false),
    "ghostscript": $(command -v gs &>/dev/null && echo true || echo false)
  }
}
EOF

echo -e "${GREEN}system-info.json 파일이 생성되었습니다.${NC}"

# =====================================
# 데이터 디렉터리 생성 (LoRA 어댑터 학습/업로드)
# =====================================
mkdir -p "${INSTALL_DIR}/uploads"
mkdir -p "${INSTALL_DIR}/data/adapters"
chmod 750 "${INSTALL_DIR}/data/adapters" 2>/dev/null || true
echo -e "${GREEN}데이터 디렉터리 준비 완료: data/adapters, uploads${NC}"

# =====================================
# Docker Compose 설정 (성능 튜닝 적용)
# =====================================

if [ -f "docker-compose.override.yml" ]; then
    rm docker-compose.override.yml
fi

cat > docker-compose.override.yml << EOF
# ATENA 시스템 Docker Compose Override
# 생성일: $(date '+%Y-%m-%d %H:%M:%S')
# 서버 사양: CPU ${CPU_CORES}코어, RAM ${TOTAL_MEM_GB}GB, 동시 사용자 ${MAX_USERS}명
# 성능 튜닝이 서버 자원에 맞게 자동 계산되었습니다.
services:
  db:
    ports:
      - "${HOST_IP}:${DB_PORT}:5432"
    command:
      - "postgres"
      - "-c"
      - "max_connections=${PG_MAX_CONNECTIONS}"
      - "-c"
      - "shared_buffers=${PG_SHARED_BUFFERS_GB}GB"
      - "-c"
      - "effective_cache_size=${PG_EFFECTIVE_CACHE_GB}GB"
      - "-c"
      - "maintenance_work_mem=${PG_MAINTENANCE_WORK_MB}MB"
      - "-c"
      - "checkpoint_completion_target=0.9"
      - "-c"
      - "wal_buffers=${PG_WAL_BUFFERS_MB}MB"
      - "-c"
      - "default_statistics_target=200"
      - "-c"
      - "random_page_cost=1.1"
      - "-c"
      - "effective_io_concurrency=200"
      - "-c"
      - "work_mem=${PG_WORK_MEM_KB}kB"
      - "-c"
      - "huge_pages=try"
      - "-c"
      - "min_wal_size=${PG_MIN_WAL_SIZE}"
      - "-c"
      - "max_wal_size=${PG_MAX_WAL_SIZE}"
      - "-c"
      - "max_worker_processes=${PG_MAX_WORKERS}"
      - "-c"
      - "max_parallel_workers_per_gather=${PG_PARALLEL_GATHER}"
      - "-c"
      - "max_parallel_workers=${PG_PARALLEL_WORKERS}"
      - "-c"
      - "max_parallel_maintenance_workers=${PG_PARALLEL_MAINT}"
      - "-c"
      - "log_min_duration_statement=1000"
      - "-c"
      - "idle_in_transaction_session_timeout=60000"
      - "-c"
      - "statement_timeout=300000"
    deploy:
      resources:
        limits:
          cpus: '${DOCKER_DB_CPU}'
          memory: ${DOCKER_DB_MEM_GB}G
        reservations:
          cpus: '${DOCKER_DB_CPU_RESERVE}'
          memory: ${DOCKER_DB_MEM_RESERVE_GB}G

  app:
    environment:
      SESSION_SECRET: ${SESSION_SECRET}
      HOST_IP: ${HOST_IP}
      APP_PORT: ${APP_PORT}
      OLLAMA_HOST: http://${DOCKER_HOST_IP}:${OLLAMA_PORT}
      OLLAMA_MODEL: ${OLLAMA_MODEL}
      OLLAMA_CODE_MODEL: ${OLLAMA_CODE_MODEL:-qwen2.5-coder:14b}
      OLLAMA_EMBEDDING_MODEL: ${OLLAMA_EMBEDDING}
      OLLAMA_VISION_MODEL: ${OLLAMA_VISION_MODEL:-llava}
      LLM_TOTAL_TIMEOUT: "600000"
      LLM_CONNECT_TIMEOUT: "180000"
      LLM_IDLE_TIMEOUT: "180000"
      NODE_OPTIONS: "--max-old-space-size=${NODE_HEAP_MB}"
      UV_THREADPOOL_SIZE: "${UV_POOL_SIZE}"
    ports:
      - "${HOST_IP}:${APP_PORT}:5000"
    volumes:
      - ./uploads:/app/uploads
      - ./data/adapters:/app/data/adapters
    extra_hosts:
      - "host.docker.internal:host-gateway"
    deploy:
      resources:
        limits:
          cpus: '${DOCKER_APP_CPU}'
          memory: ${DOCKER_APP_MEM_GB}G
        reservations:
          cpus: '${DOCKER_APP_CPU_RESERVE}'
          memory: ${DOCKER_APP_MEM_RESERVE_GB}G
EOF

echo -e "${GREEN}docker-compose.override.yml 파일이 생성되었습니다 (성능 튜닝 적용).${NC}"

# =====================================
# 기본 docker-compose.yml도 튜닝 반영
# =====================================

echo ""
echo -e "${CYAN}docker-compose.yml 기본 설정 업데이트 중...${NC}"

cat > "${INSTALL_DIR}/docker-compose.yml" << EOF
# ATENA 시스템 Docker Compose
# 자동 생성일: $(date '+%Y-%m-%d %H:%M:%S')
# 서버: CPU ${CPU_CORES}코어, RAM ${TOTAL_MEM_GB}GB, 동시 사용자 ${MAX_USERS}명
services:
  db:
    image: postgres:15-alpine
    container_name: devpi-db
    environment:
      POSTGRES_DB: devpi
      POSTGRES_USER: devpi_user
      POSTGRES_PASSWORD: devpi_password
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    command:
      - "postgres"
      - "-c"
      - "max_connections=${PG_MAX_CONNECTIONS}"
      - "-c"
      - "shared_buffers=${PG_SHARED_BUFFERS_GB}GB"
      - "-c"
      - "effective_cache_size=${PG_EFFECTIVE_CACHE_GB}GB"
      - "-c"
      - "maintenance_work_mem=${PG_MAINTENANCE_WORK_MB}MB"
      - "-c"
      - "checkpoint_completion_target=0.9"
      - "-c"
      - "wal_buffers=${PG_WAL_BUFFERS_MB}MB"
      - "-c"
      - "default_statistics_target=200"
      - "-c"
      - "random_page_cost=1.1"
      - "-c"
      - "effective_io_concurrency=200"
      - "-c"
      - "work_mem=${PG_WORK_MEM_KB}kB"
      - "-c"
      - "huge_pages=try"
      - "-c"
      - "min_wal_size=${PG_MIN_WAL_SIZE}"
      - "-c"
      - "max_wal_size=${PG_MAX_WAL_SIZE}"
      - "-c"
      - "max_worker_processes=${PG_MAX_WORKERS}"
      - "-c"
      - "max_parallel_workers_per_gather=${PG_PARALLEL_GATHER}"
      - "-c"
      - "max_parallel_workers=${PG_PARALLEL_WORKERS}"
      - "-c"
      - "max_parallel_maintenance_workers=${PG_PARALLEL_MAINT}"
      - "-c"
      - "log_min_duration_statement=1000"
      - "-c"
      - "idle_in_transaction_session_timeout=60000"
      - "-c"
      - "statement_timeout=300000"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "${HOST_IP}:${DB_PORT}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U devpi_user -d devpi"]
      interval: 5s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '${DOCKER_DB_CPU}'
          memory: ${DOCKER_DB_MEM_GB}G
        reservations:
          cpus: '${DOCKER_DB_CPU_RESERVE}'
          memory: ${DOCKER_DB_MEM_RESERVE_GB}G

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: devpi-app
    environment:
      DATABASE_URL: postgresql://devpi_user:devpi_password@db:5432/devpi
      SESSION_SECRET: ${SESSION_SECRET}
      NODE_ENV: production
      NODE_OPTIONS: "--max-old-space-size=${NODE_HEAP_MB}"
      UV_THREADPOOL_SIZE: "${UV_POOL_SIZE}"
      OLLAMA_HOST: http://${DOCKER_HOST_IP}:${OLLAMA_PORT}
      OLLAMA_MODEL: ${OLLAMA_MODEL}
      OLLAMA_CODE_MODEL: ${OLLAMA_CODE_MODEL:-qwen2.5-coder:14b}
      OLLAMA_EMBEDDING_MODEL: ${OLLAMA_EMBEDDING}
      OLLAMA_VISION_MODEL: ${OLLAMA_VISION_MODEL:-llava}
      LLM_TOTAL_TIMEOUT: "600000"
      LLM_CONNECT_TIMEOUT: "180000"
      LLM_IDLE_TIMEOUT: "180000"
      RHWP_URL: ${RHWP_URL:-}
      HELP_TTS_URL: ${HELP_TTS_URL:-}
    ports:
      - "${HOST_IP}:${APP_PORT}:5000"
    depends_on:
      db:
        condition: service_healthy
$(if [ "$INSTALL_TTS_LOCAL" = "y" ]; then
echo "      tts:"
echo "        condition: service_started"
fi)
    volumes:
      - ./uploads:/app/uploads
      - ./data/adapters:/app/data/adapters
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
    deploy:
      resources:
        limits:
          cpus: '${DOCKER_APP_CPU}'
          memory: ${DOCKER_APP_MEM_GB}G
        reservations:
          cpus: '${DOCKER_APP_CPU_RESERVE}'
          memory: ${DOCKER_APP_MEM_RESERVE_GB}G
$(if [ "$GPU_TYPE" = "nvidia" ] && [ "$GPU_AVAILABLE" = "true" ]; then
cat << NVIDIA_COMPOSE_EOF

  # ── NVIDIA GPU 전용 Ollama 서비스 ──────────────────────────────────────
  # T600 (4GB VRAM, Turing CC ${GPU_COMPUTE_CAP}) 부분 GPU 오프로딩
  # ollama 바이너리는 로컬 설치이므로 이 서비스는 Docker 내 GPU 접근용 더미입니다.
  # 실제 Ollama는 ~/ollama/bin/ollama 로 실행됩니다.
  # Docker Compose에서 GPU를 활용하는 다른 서비스가 있을 경우 아래 예시 참고:
  #
  # ollama-gpu:
  #   image: ollama/ollama:latest
  #   container_name: devpi-ollama-gpu
  #   environment:
  #     - NVIDIA_VISIBLE_DEVICES=all
  #     - NVIDIA_DRIVER_CAPABILITIES=compute,utility
  #     - OLLAMA_HOST=0.0.0.0:${OLLAMA_PORT}
  #     - OLLAMA_NUM_GPU_LAYERS=${OLLAMA_GPU_LAYERS}
  #     - OLLAMA_FLASH_ATTENTION=1
$(if [ "$GPU_T600_OPTIMIZED" = "true" ]; then
    echo  "#     - OLLAMA_GPU_OVERHEAD=268435456"
fi)
  #   ports:
  #     - "${HOST_IP}:${OLLAMA_PORT}:11434"
  #   volumes:
  #     - ${HOME}/ollama/models:/root/.ollama/models
  #   restart: unless-stopped
  #   deploy:
  #     resources:
  #       reservations:
  #         devices:
  #           - driver: nvidia
  #             count: all
  #             capabilities: [gpu]
NVIDIA_COMPOSE_EOF
fi)
$(if [ "$INSTALL_RHWP_LOCAL" = "y" ]; then
cat << RHWP_COMPOSE_EOF

  # ── rhwp HWP 웹 편집기 (Rust → WebAssembly 기반) ────────────────────────
  # 이미지 빌드: docker build --no-cache -f Dockerfile.rhwp -t devpi-rhwp:latest .
  # 폐쇄망 이식: offline-packages/rhwp/rhwp-image.tar.gz 배치 후 install.sh 실행
  rhwp:
    image: devpi-rhwp:latest
    container_name: devpi-rhwp
    ports:
      - "${HOST_IP}:${RHWP_PORT}:8080"
    volumes:
      - ./uploads/hangul-docs:/app/documents
    environment:
      - DOCUMENT_DIR=/app/documents
      - STATIC_DIR=/app/static
      - PORT=8080
      - NODE_ENV=production
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
RHWP_COMPOSE_EOF
fi)

$(if [ "$INSTALL_TTS_LOCAL" = "y" ]; then
cat << MELO_COMPOSE_EOF

  # ── MeloTTS 한국어 음성 합성 서버 ──────────────────────────────────────
  # 엔진: MeloTTS (pip 기반 VITS, 한국어 'KR' 화자, CPU/GPU 자동감지)
  # 폐쇄망 이식: docker save devpi-melotts:latest > offline-packages/melotts/melotts-image.tar
  tts:
    build:
      context: ${INSTALL_DIR}
      dockerfile: Dockerfile.melotts
    image: devpi-melotts:latest
    container_name: devpi-tts
    ports:
      - "${HOST_IP}:${TTS_PORT}:5500"
    volumes:
      - melo_models:/root/.local/share/melo
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
MELO_COMPOSE_EOF
fi)

volumes:
  postgres_data:
$(if [ "$INSTALL_TTS_LOCAL" = "y" ]; then
echo "  melo_models:"
fi)
EOF

echo -e "${GREEN}docker-compose.yml이 업데이트되었습니다.${NC}"

# =====================================
# OS 레벨 튜닝 가이드 생성
# =====================================

echo ""
echo -e "${CYAN}OS 레벨 튜닝 가이드 생성 중...${NC}"

cat > "${INSTALL_DIR}/os-tuning.sh" << 'OS_TUNING_EOF'
#!/bin/bash
# ATENA 시스템 - Rocky Linux 9 OS 레벨 성능 튜닝
# 이 스크립트는 root 권한으로 실행해야 합니다.
# 사용법: sudo bash os-tuning.sh

set -e

if [ "$EUID" -ne 0 ]; then
    echo "이 스크립트는 root 권한으로 실행해야 합니다."
    echo "사용법: sudo bash os-tuning.sh"
    exit 1
fi

echo "============================================"
echo "  Rocky Linux 9 OS 레벨 성능 튜닝"
echo "============================================"
echo ""

# SELinux 설정 (Docker 호환)
echo "[1/6] SELinux 설정 확인..."
if command -v getenforce &> /dev/null; then
    SELINUX_STATUS=$(getenforce)
    echo "  현재 SELinux: $SELINUX_STATUS"
    if [ "$SELINUX_STATUS" = "Enforcing" ]; then
        echo "  Docker 호환을 위해 container-selinux 확인..."
        dnf list installed container-selinux 2>/dev/null || dnf install -y container-selinux
    fi
fi

# 방화벽 포트 개방
echo "[2/6] 방화벽 포트 설정..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=5559/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=5433/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=51434/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo "  포트 5559, 5433, 51434 개방 완료"
else
    echo "  firewalld가 설치되어 있지 않습니다."
fi

# 커널 파라미터 튜닝
echo "[3/6] 커널 파라미터 튜닝..."
cat > /etc/sysctl.d/99-atena-tuning.conf << SYSCTL_EOF
# ATENA 시스템 성능 튜닝
# 네트워크 튜닝 (200명 동시 접속)
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535

# 메모리 튜닝
vm.swappiness = 10
vm.dirty_ratio = 20
vm.dirty_background_ratio = 5
vm.overcommit_memory = 1

# 파일 디스크립터
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288

# PostgreSQL Huge Pages 지원
vm.nr_hugepages = 0
SYSCTL_EOF
sysctl --system > /dev/null 2>&1
echo "  커널 파라미터 적용 완료"

# 파일 디스크립터 제한
echo "[4/6] 파일 디스크립터 제한 설정..."
cat > /etc/security/limits.d/99-atena.conf << LIMITS_EOF
# ATENA 시스템 파일 디스크립터 제한
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
LIMITS_EOF
echo "  파일 디스크립터 제한 설정 완료"

# Transparent Huge Pages 비활성화 (PostgreSQL 권장)
echo "[5/6] Transparent Huge Pages 비활성화..."
if [ -f /sys/kernel/mm/transparent_hugepage/enabled ]; then
    echo never > /sys/kernel/mm/transparent_hugepage/enabled
    echo never > /sys/kernel/mm/transparent_hugepage/defrag
    # 영구 설정
    cat > /etc/systemd/system/disable-thp.service << THP_EOF
[Unit]
Description=Disable Transparent Huge Pages (THP)
DefaultDependencies=no
After=sysinit.target local-fs.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never | tee /sys/kernel/mm/transparent_hugepage/enabled > /dev/null'
ExecStart=/bin/sh -c 'echo never | tee /sys/kernel/mm/transparent_hugepage/defrag > /dev/null'

[Install]
WantedBy=basic.target
THP_EOF
    systemctl daemon-reload
    systemctl enable disable-thp
    echo "  THP 비활성화 완료"
fi

# I/O 스케줄러 최적화
echo "[6/6] I/O 스케줄러 확인..."
for dev in /sys/block/sd*/queue/scheduler /sys/block/nvme*/queue/scheduler; do
    if [ -f "$dev" ]; then
        CURRENT=$(cat "$dev" | grep -oP '\[\K[^\]]+')
        DISK_NAME=$(echo "$dev" | grep -oP '(sd[a-z]+|nvme[0-9]+n[0-9]+)')
        echo "  $DISK_NAME: $CURRENT"
    fi
done

echo ""
echo "============================================"
echo "  OS 레벨 튜닝 완료!"
echo "============================================"
echo ""
echo "변경사항을 완전히 적용하려면 시스템을 재부팅하세요:"
echo "  sudo reboot"
OS_TUNING_EOF
chmod +x "${INSTALL_DIR}/os-tuning.sh"

echo -e "${GREEN}os-tuning.sh 파일이 생성되었습니다.${NC}"
echo -e "${YELLOW}  OS 레벨 튜닝 적용: sudo bash ${INSTALL_DIR}/os-tuning.sh${NC}"

# =====================================
# Docker 컨테이너 시작
# =====================================

echo ""
echo "Docker 컨테이너를 시작합니다..."

# =====================================
# rhwp 한글 편집기 Docker 이미지 빌드/로드
# =====================================
if [ "$INSTALL_RHWP_LOCAL" = "y" ]; then
    echo ""
    echo -e "${CYAN}[rhwp] 한글 편집기 Docker 이미지 준비 중...${NC}"

    RHWP_IMAGE_TAR="${INSTALL_DIR}/offline-packages/rhwp/rhwp-image.tar"
    RHWP_IMAGE_TARGZ="${INSTALL_DIR}/offline-packages/rhwp/rhwp-image.tar.gz"
    RHWP_SRC_DIR="${INSTALL_DIR}/rhwp-src"

    if [ -f "${RHWP_IMAGE_TARGZ}" ]; then
        echo -e "  폐쇄망 이미지 파일 발견: ${RHWP_IMAGE_TARGZ}"
        echo -e "  Docker 이미지 로드 중..."
        gunzip -c "${RHWP_IMAGE_TARGZ}" | docker load
        echo -e "  ${GREEN}rhwp 이미지 로드 완료${NC}"
    elif [ -f "${RHWP_IMAGE_TAR}" ]; then
        echo -e "  폐쇄망 이미지 파일 발견: ${RHWP_IMAGE_TAR}"
        docker load < "${RHWP_IMAGE_TAR}"
        echo -e "  ${GREEN}rhwp 이미지 로드 완료${NC}"
    elif [ -d "${RHWP_SRC_DIR}" ]; then
        echo -e "  소스 디렉터리 발견: ${RHWP_SRC_DIR}"
        echo -e "  ${YELLOW}⚠️  WASM 멀티스테이지 빌드 — Rust 컴파일 포함, 15~30분 소요됩니다.${NC}"
        echo -e "  (인터넷 연결 필요: crates.io 의존성 다운로드)"
        docker build --no-cache -f "${INSTALL_DIR}/Dockerfile.rhwp" \
            -t devpi-rhwp:latest "${INSTALL_DIR}"
        echo -e "  ${GREEN}rhwp WASM 이미지 빌드 완료${NC}"
    else
        echo -e "  ${YELLOW}[경고] rhwp 소스 또는 이미지를 찾을 수 없습니다.${NC}"
        echo -e "  준비 가능한 항목:"
        echo -e "    A) ${RHWP_SRC_DIR}/           ← git clone으로 준비"
        echo -e "    B) ${RHWP_IMAGE_TARGZ}  ← 오프라인 이미지 tar.gz"
        echo -e "    C) ${RHWP_IMAGE_TAR}        ← 오프라인 이미지 tar"
        echo ""
        read -p "  지금 GitHub에서 소스를 내려받아 바로 빌드하시겠습니까? [y/N]: " _RHWP_CLONE_NOW
        if [ "${_RHWP_CLONE_NOW:-N}" = "y" ] || [ "${_RHWP_CLONE_NOW:-N}" = "Y" ]; then
            echo -e "  ${CYAN}rhwp 소스 clone 중...${NC}"
            if git clone --depth=1 https://github.com/edwardkim/rhwp "${RHWP_SRC_DIR}"; then
                echo -e "  ${CYAN}Docker 이미지 빌드 중 (최초 빌드: Rust WASM 포함 15~30분 소요)...${NC}"
                if docker build -f "${INSTALL_DIR}/Dockerfile.rhwp" \
                        -t devpi-rhwp:latest "${INSTALL_DIR}"; then
                    echo -e "  ${GREEN}rhwp 이미지 빌드 완료${NC}"
                    # 폐쇄망 이식용 이미지 저장
                    mkdir -p "${INSTALL_DIR}/offline-packages/rhwp"
                    echo -e "  ${CYAN}오프라인 이미지 저장 중 (offline-packages/rhwp/rhwp-image.tar.gz)...${NC}"
                    docker save devpi-rhwp:latest | gzip > "${RHWP_IMAGE_TARGZ}" \
                        && echo -e "  ${GREEN}저장 완료 → 다른 서버 이식 시 사용 가능${NC}" \
                        || echo -e "  ${YELLOW}이미지 저장 실패 (실행에는 영향 없음)${NC}"
                else
                    echo -e "  ${RED}[오류] Docker 이미지 빌드 실패. rhwp 없이 진행합니다.${NC}"
                    INSTALL_RHWP_LOCAL="n"
                    RHWP_URL=""
                fi
            else
                echo -e "  ${RED}[오류] git clone 실패 (인터넷 연결 확인). rhwp 없이 진행합니다.${NC}"
                INSTALL_RHWP_LOCAL="n"
                RHWP_URL=""
            fi
        else
            echo -e "  ${YELLOW}rhwp 없이 진행합니다. 한글 편집 기능은 비활성화됩니다.${NC}"
            echo -e "  나중에 rhwp를 추가하려면 설치 디렉터리에서 아래 명령을 실행하세요:"
            echo -e "    ${CYAN}git clone --depth=1 https://github.com/edwardkim/rhwp rhwp-src${NC}"
            echo -e "    ${CYAN}docker build -f Dockerfile.rhwp -t devpi-rhwp:latest .${NC}"
            echo -e "    ${CYAN}docker compose up -d rhwp${NC}"
            INSTALL_RHWP_LOCAL="n"
            RHWP_URL=""
        fi

        # INSTALL_RHWP_LOCAL이 n 으로 확정된 경우: docker-compose.yml에서 rhwp 블록 제거
        if [ "$INSTALL_RHWP_LOCAL" = "n" ] && [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
            # rhwp 서비스 블록 제거 (  rhwp: 부터 다음 최상위 키까지)
            awk '
                /^  rhwp:/ { skip=1; next }
                skip && /^[^ \t]/ { skip=0; print; next }
                skip && /^  [^ \t]/ { skip=0; print; next }
                skip { next }
                { print }
            ' "${INSTALL_DIR}/docker-compose.yml" > /tmp/_compose_tmp.yml \
                && mv /tmp/_compose_tmp.yml "${INSTALL_DIR}/docker-compose.yml" \
                && echo -e "  ${GREEN}rhwp 서비스가 docker-compose.yml에서 제거되었습니다.${NC}" \
                || echo -e "  ${YELLOW}[경고] docker-compose.yml 수정 실패 — 수동으로 rhwp 블록을 제거하세요.${NC}"
            sed -i 's/RHWP_URL: .*/RHWP_URL:/' "${INSTALL_DIR}/docker-compose.yml" 2>/dev/null || true
        fi
    fi
fi

# =====================================
# MeloTTS 한국어 음성 합성 서버 Docker 이미지 빌드
# =====================================
if [ "$INSTALL_TTS_LOCAL" = "y" ]; then
    echo ""
    echo -e "${CYAN}=========================================${NC}"
    echo -e "${CYAN} MeloTTS 한국어 TTS Docker 이미지 빌드${NC}"
    echo -e "${CYAN}=========================================${NC}"
    echo -e "  ${YELLOW}[참고] PyTorch CPU + MeloTTS pip 다운로드: 약 1~2GB, 소요시간 10~20분${NC}"
    echo -e "  ${CYAN}컨테이너 첫 기동 시 MeloTTS 한국어 모델이 자동 다운로드됩니다.${NC}"
    echo ""

    if docker build -t devpi-melotts:latest -f "${INSTALL_DIR}/Dockerfile.melotts" "${INSTALL_DIR}"; then
        echo -e "  ${GREEN}✔ MeloTTS Docker 이미지 빌드 완료${NC}"
        # 폐쇄망 이식용 이미지 저장
        mkdir -p "${INSTALL_DIR}/offline-packages/melotts"
        MELO_IMAGE_TAR="${INSTALL_DIR}/offline-packages/melotts/melotts-image.tar.gz"
        echo -e "  ${CYAN}폐쇄망 이식용 이미지 저장 중 (offline-packages/melotts/melotts-image.tar.gz)...${NC}"
        docker save devpi-melotts:latest | gzip > "${MELO_IMAGE_TAR}" \
            && echo -e "  ${GREEN}저장 완료 → 다른 서버 이식 시 docker load < melotts-image.tar.gz${NC}" \
            || echo -e "  ${YELLOW}이미지 저장 실패 (실행에는 영향 없음)${NC}"
    else
        echo -e "  ${RED}[오류] MeloTTS 이미지 빌드 실패.${NC}"
        echo -e "  ${YELLOW}TTS 없이 진행합니다. 나중에 수동으로 빌드하려면:${NC}"
        echo -e "    ${CYAN}docker build -t devpi-melotts:latest -f Dockerfile.melotts .${NC}"
        echo -e "    ${CYAN}docker compose up -d tts && docker compose restart app${NC}"
        INSTALL_TTS_LOCAL="n"
        HELP_TTS_URL=""
        # docker-compose.yml에서 tts 블록 제거
        if [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
            awk '
                /^  tts:/ { skip=1; next }
                skip && /^[^ \t]/ { skip=0; print; next }
                skip && /^  [^ \t]/ { skip=0; print; next }
                skip { next }
                { print }
            ' "${INSTALL_DIR}/docker-compose.yml" > /tmp/_compose_tts_tmp.yml \
                && mv /tmp/_compose_tts_tmp.yml "${INSTALL_DIR}/docker-compose.yml" \
                && echo -e "  ${GREEN}tts 서비스가 docker-compose.yml에서 제거되었습니다.${NC}"
            sed -i 's/HELP_TTS_URL: .*/HELP_TTS_URL:/' "${INSTALL_DIR}/docker-compose.yml" 2>/dev/null || true
        fi
    fi
fi

# docker compose v2 또는 docker-compose v1 감지
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}[오류] Docker Compose가 설치되어 있지 않습니다.${NC}"
    echo "설정 파일은 정상적으로 생성되었습니다."
    echo "Docker Compose 설치 후 아래 명령어로 실행하세요:"
    echo "  docker compose up -d --build"
    exit 1
fi

$DOCKER_COMPOSE down 2>/dev/null
$DOCKER_COMPOSE up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}  설치가 완료되었습니다!${NC}"
    echo -e "${GREEN}==========================================${NC}"
    echo ""
    echo -e "${BLUE}[접속 정보]${NC}"
    echo "접속 주소: http://${HOST_IP}:${APP_PORT}"
    if [ "$HOST_IP" == "0.0.0.0" ]; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
        echo "로컬 접속: http://localhost:${APP_PORT}"
        echo "네트워크 접속: http://${LOCAL_IP}:${APP_PORT}"
    fi
    echo ""
    echo -e "${BLUE}[시스템 사양]${NC}"
    echo "  - OS: $OS_NAME $OS_VERSION"
    echo "  - CPU: $CPU_MODEL ($CPU_CORES 코어)"
    echo "  - 메모리: ${TOTAL_MEM_GB}GB"
    echo "  - GPU: $GPU_NAME"
    echo "  - 동시 사용자: ${MAX_USERS}명"
    echo ""
    echo -e "${BLUE}[성능 튜닝 결과]${NC}"
    echo "  - PostgreSQL: shared_buffers=${PG_SHARED_BUFFERS_GB}GB, max_conn=${PG_MAX_CONNECTIONS}"
    echo "  - Node.js: heap=${NODE_HEAP_MB}MB, threads=${UV_POOL_SIZE}"
    echo "  - Docker DB: CPU=${DOCKER_DB_CPU}, RAM=${DOCKER_DB_MEM_GB}GB"
    echo "  - Docker App: CPU=${DOCKER_APP_CPU}, RAM=${DOCKER_APP_MEM_GB}GB"
    echo ""
    if [ "$INSTALL_OLLAMA" == "y" ] || [ "$INSTALL_OLLAMA" == "Y" ]; then
        echo -e "${BLUE}[AI/LLM 설정]${NC}"
        echo "  - Ollama 경로: ${OLLAMA_LOCAL_DIR}"
        echo "  - 바이너리: ${OLLAMA_LOCAL_DIR}/bin/ollama"
        echo "  - 모델 저장: ${OLLAMA_LOCAL_DIR}/models"
        echo "  - LLM 모델: $OLLAMA_MODEL"
        if [ -n "$OLLAMA_CODE_MODEL" ]; then
            echo "  - 코드생성 모델: $OLLAMA_CODE_MODEL"
        else
            echo "  - 코드생성 모델: 설치 안함"
        fi
        echo "  - 임베딩 모델: $OLLAMA_EMBEDDING"
        if [ -n "$OLLAMA_VISION_MODEL" ]; then
            echo "  - Vision 모델: $OLLAMA_VISION_MODEL"
        else
            echo "  - Vision 모델: 설치 안함"
        fi
        echo "  - 포트: $OLLAMA_PORT"
        echo "  - CPU 할당: ${OLLAMA_CPU}코어, 메모리: ${OLLAMA_MEM_GB}GB"
        echo ""
        echo "Ollama 관리 명령어:"
        echo "  - 시작: ${OLLAMA_LOCAL_DIR}/start-ollama.sh"
        echo "  - 중지: ${OLLAMA_LOCAL_DIR}/stop-ollama.sh"
        echo "  - 상태 확인: ${OLLAMA_LOCAL_DIR}/bin/ollama list"
        echo "  - Docker→Ollama: http://${DOCKER_HOST_IP}:${OLLAMA_PORT}"
        echo "  - 모델 추가: OLLAMA_HOST=http://localhost:${OLLAMA_PORT} OLLAMA_MODELS=${OLLAMA_LOCAL_DIR}/models ${OLLAMA_LOCAL_DIR}/bin/ollama pull <모델명>"
        echo "  - 로그 확인: tail -f ${OLLAMA_LOCAL_DIR}/logs/ollama.log"
        echo ""
    fi
    echo -e "${BLUE}[한글 편집기 (rhwp — HWP WebAssembly 편집기)]${NC}"
    if [ "$INSTALL_RHWP_LOCAL" = "y" ]; then
        echo "  - 엔진:       Rust → wasm-pack → WebAssembly (브라우저 실행)"
        echo "  - 편집기 UI:  한컴오피스 스타일 메뉴바+툴바+문서편집 영역"
        echo "  - 상태:       로컬 Docker 컨테이너 (devpi-rhwp)"
        echo "  - 외부 포트:  http://${HOST_IP}:${RHWP_PORT}"
        echo "  - 내부 URL:   ${RHWP_URL}"
        echo "  - 문서 저장:  ./uploads/hangul-docs/"
        echo "  - 정적 파일:  /app/static/ (WASM 빌드 결과물)"
        echo ""
        echo "  ※ WASM 빌드 상태 확인:"
        echo "     curl -s http://${HOST_IP}:${RHWP_PORT}/api/status"
        echo "     → editorReady: true, wasmReady: true 이면 실제 편집기 활성화"
        echo ""
        echo "  ※ 빌드 재실행 (소스 업데이트 또는 최초 빌드 시):"
        echo "     docker build --no-cache -f Dockerfile.rhwp -t devpi-rhwp:latest ."
        echo "     docker compose restart devpi-rhwp"
        echo ""
        echo "  ※ 폐쇄망 이식용 이미지 저장:"
        echo "     mkdir -p offline-packages/rhwp"
        echo "     docker save devpi-rhwp:latest | gzip > offline-packages/rhwp/rhwp-image.tar.gz"
    elif [ -n "$RHWP_URL" ]; then
        echo "  - 상태: 외부 서버 연동"
        echo "  - 서버 URL: ${RHWP_URL}"
        echo "  - 상태 확인: curl -s ${RHWP_URL}/api/status"
    else
        echo "  - 상태: 비활성화"
        echo "  - 활성화 방법 (나중에 추가 설치):"
        echo "     git clone --depth=1 https://github.com/edwardkim/rhwp rhwp-src"
        echo "     docker build --no-cache -f Dockerfile.rhwp -t devpi-rhwp:latest ."
        echo "     # docker-compose.yml의 RHWP_URL을 http://<서버IP>:8082 로 변경 후:"
        echo "     docker compose up -d rhwp && docker compose restart app"
    fi
    echo ""
    echo -e "${BLUE}[PDF 변환 (LibreOffice)]${NC}"
    if [ "$LIBREOFFICE_INSTALLED" = true ]; then
        echo "  - 상태: 설치됨"
        echo "  - 지원 형식: DOCX, XLSX, PPTX, HWP, ODT, ODS, ODP, RTF, CSV, HTML"
        echo "  - 변환 API: POST /api/pdf-converter/convert"
    else
        echo "  - 상태: 미설치 (PDF 변환 기능 비활성화)"
        echo "  - 수동 설치: sudo dnf install -y libreoffice-core libreoffice-writer libreoffice-calc"
    fi
    if [ -d "${INSTALL_DIR}/offline-packages/libreoffice" ]; then
        echo "  - 폐쇄망 패키지: ${INSTALL_DIR}/offline-packages/libreoffice/"
        echo "  - 폐쇄망 설치: sudo bash ${INSTALL_DIR}/offline-packages/libreoffice/install-offline.sh"
    fi
    echo ""
    echo -e "${BLUE}[PDF 텍스트 추출 (OpenDataLoader PDF)]${NC}"
    if [ "$JAVA17_INSTALLED" = true ]; then
        echo "  - Java 17: 설치됨"
        echo "  - OpenDataLoader PDF: 테이블 구조 보존, Markdown 출력"
        echo "  - JAR 경로: node_modules/@opendataloader/pdf/lib/opendataloader-pdf-cli.jar"
        echo "  - 폴백 순서: ODL → unpdf → Tesseract OCR"
    else
        echo "  - Java 17: 미설치 (OpenDataLoader PDF 비활성화, unpdf 폴백 사용)"
        echo "  - 수동 설치: sudo dnf install -y java-17-openjdk"
    fi
    if [ -d "${INSTALL_DIR}/offline-packages/java17" ]; then
        echo "  - 폐쇄망 패키지: ${INSTALL_DIR}/offline-packages/java17/"
        echo "  - 폐쇄망 설치: sudo bash ${INSTALL_DIR}/offline-packages/java17/install-offline.sh"
    fi
    echo ""
    echo -e "${BLUE}[Vision PDF 이미지 변환 도구]${NC}"
    if [ "$PDF_IMAGE_TOOLS_INSTALLED" = true ]; then
        echo "  - 상태: 설치됨"
        command -v pdftoppm &> /dev/null && echo "  - pdftoppm (poppler-utils): 사용 가능"
        command -v convert &> /dev/null && echo "  - convert (ImageMagick): 사용 가능"
        command -v gs &> /dev/null && echo "  - gs (Ghostscript): 사용 가능"
    else
        echo "  - 상태: 미설치 (Vision 문서 분석 비활성화)"
        echo "  - 수동 설치: sudo dnf install -y poppler-utils ImageMagick ghostscript"
    fi
    if [ -d "${INSTALL_DIR}/offline-packages/pdf-image-tools" ]; then
        echo "  - 폐쇄망 패키지: ${INSTALL_DIR}/offline-packages/pdf-image-tools/"
        echo "  - 폐쇄망 설치: sudo bash ${INSTALL_DIR}/offline-packages/pdf-image-tools/install-offline.sh"
    fi
    echo ""
    echo -e "${BLUE}[SadTalker 전신 아바타 립싱크 엔진]${NC}"
    if [ "$SADTALKER_INSTALLED" = true ]; then
        echo "  - 상태: 설치됨"
        echo "  - 경로: /opt/SadTalker"
        echo "  - 모드: --preprocess full (전신 애니메이션, 자연스러운 움직임)"
        echo "  - 배경 제거: rembg (설치 시) 또는 colorkey 폴백"
        echo "  - 기본 아바타: 여성 아바타(전신), 남성 아바타(전신) DB 등록됨"
        if [ -f "/opt/SadTalker/inference.py" ]; then
            echo "  - 실행 테스트: cd /opt/SadTalker && python3 inference.py --help"
        fi
    else
        echo "  - 상태: 미설치 (정적 사진 오버레이 모드로 아바타 영상 생성)"
        echo "  - 기본 아바타: 여성/남성 전신 플레이스홀더 이미지 DB 등록됨"
        echo "  - 나중에 설치: sudo bash ${INSTALL_DIR}/install.sh 재실행 또는"
        echo "    sudo git clone --depth=1 https://github.com/OpenTalker/SadTalker /opt/SadTalker"
        echo "    cd /opt/SadTalker && pip3 install -r requirements.txt"
        echo "    bash scripts/download_models.sh"
        echo "    pip3 install rembg opencv-python-headless onnxruntime"
    fi
    if [ -d "${INSTALL_DIR}/offline-packages/sadtalker" ]; then
        echo "  - 폐쇄망 소스: ${INSTALL_DIR}/offline-packages/sadtalker/"
    fi
    echo ""
    echo -e "${BLUE}[로그인 정보]${NC}"
    echo "  아이디: admin"
    echo "  비밀번호: 1234"
    echo ""
    echo -e "${YELLOW}[추가 작업]${NC}"
    echo "  OS 튜닝 적용 (권장): sudo bash ${INSTALL_DIR}/os-tuning.sh"
    if [ "$INSTALL_OLLAMA" == "y" ] || [ "$INSTALL_OLLAMA" == "Y" ]; then
        echo "  Ollama systemd 등록: sudo cp ${OLLAMA_LOCAL_DIR}/ollama-local.service /etc/systemd/system/"
    fi
    echo ""
    echo -e "${YELLOW}[LoRA 어댑터 학습 노드 설정 (선택, GPU 노드에서만)]${NC}"
    echo "  scripts/train_lora.py 실행을 위해 다음 Python 패키지가 필요합니다(폐쇄망: 휠 사전 배치):"
    echo "    torch, transformers, peft, datasets, accelerate"
    echo "    (GPU 노드 추가) bitsandbytes"
    echo "  학습은 앱 컨테이너가 child_process로 spawn하므로, 동일 컨테이너에서 학습할 경우"
    echo "  Dockerfile에 Python + 위 패키지를 추가해야 합니다. 별도 GPU 워커 노드 권장."
    echo ""
    echo "다른 사용자는 같은 네트워크에서 위 주소로 접속할 수 있습니다."
    echo ""
else
    echo -e "${RED}설치 중 오류가 발생했습니다. 로그를 확인하세요:${NC}"
    echo "  $DOCKER_COMPOSE logs -f"
fi
