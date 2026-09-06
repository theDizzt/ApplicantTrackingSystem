# =============================================================================
# AI 서류 심사관 (ATS) — Multi-stage Dockerfile
# Target: 4 vCore / 8 GB RAM per service
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: deps — workspace-level dependency install
# -----------------------------------------------------------------------------
# NOTE: Debian-based image (glibc) is required — this workspace's
# pnpm-workspace.yaml excludes all musl native binaries (e.g.
# @rollup/rollup-linux-x64-musl), so Alpine images cannot build.
FROM node:22-slim AS deps

# Install pnpm
RUN npm install -g pnpm@10 --quiet

WORKDIR /workspace

# Copy workspace manifests first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy every package.json in the monorepo (keeps the pnpm virtual store happy)
COPY lib/db/package.json                             ./lib/db/
COPY lib/api-zod/package.json                        ./lib/api-zod/
COPY lib/api-spec/package.json                       ./lib/api-spec/
COPY lib/api-client-react/package.json               ./lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json  ./lib/integrations-openai-ai-server/
COPY lib/integrations-openai-ai-react/package.json   ./lib/integrations-openai-ai-react/
COPY artifacts/api-server/package.json               ./artifacts/api-server/
COPY artifacts/job-doc-check/package.json            ./artifacts/job-doc-check/

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: builder — compile frontend + API server
# -----------------------------------------------------------------------------
FROM deps AS builder

WORKDIR /workspace

# Copy source code
COPY lib/                   ./lib/
COPY attached_assets/       ./attached_assets/
COPY artifacts/api-server/  ./artifacts/api-server/
COPY artifacts/job-doc-check/ ./artifacts/job-doc-check/

# ── Build frontend ──────────────────────────────────────────────────────────
# BASE_PATH=/ because Nginx serves the SPA from root in Docker
# PORT is required by vite.config.ts but not used during build
ENV BASE_PATH=/ \
    PORT=3000   \
    NODE_ENV=production \
    REPL_ID=""
RUN pnpm --filter @workspace/job-doc-check run build

# ── Build API server ────────────────────────────────────────────────────────
RUN pnpm --filter @workspace/api-server run build

# ── Create self-contained production deployment for API ─────────────────────
# pnpm deploy copies the package + only its production node_modules
RUN pnpm --filter @workspace/api-server deploy --prod /api-deploy

# Overwrite with the compiled dist (pnpm deploy copies src; we want the build)
RUN cp -r /workspace/artifacts/api-server/dist /api-deploy/dist

# -----------------------------------------------------------------------------
# Stage 3: production — Node.js API + Nginx static server
# -----------------------------------------------------------------------------
FROM node:22-slim AS production

LABEL org.opencontainers.image.title="AI 서류 심사관 (ATS)" \
      org.opencontainers.image.description="AI-powered applicant tracking system" \
      org.opencontainers.image.version="1.0.0"

# Install Nginx + tini (proper PID 1 / signal handling) + curl (healthcheck)
# poppler-utils: 스캔 PDF OCR, ffmpeg: 음성 자기소개서 오디오 정규화
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx tini curl poppler-utils ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ── API server ───────────────────────────────────────────────────────────────
WORKDIR /app

# Production node_modules from pnpm deploy (includes native modules like bcrypt)
COPY --from=builder /api-deploy/node_modules ./node_modules

# Compiled API bundle (index.mjs + pino workers)
COPY --from=builder /api-deploy/dist ./dist

# Shared uploads directory
RUN mkdir -p /app/uploads && chown node:node /app/uploads

# ── Frontend static files ────────────────────────────────────────────────────
COPY --from=builder /workspace/artifacts/job-doc-check/dist/public /usr/share/nginx/html

# ── Runtime config ───────────────────────────────────────────────────────────
COPY docker/nginx.conf   /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose: 80 (Nginx → frontend + API proxy), 8080 (internal Node.js only)
EXPOSE 80

# Use tini as PID 1 for proper signal propagation
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
