# ============================================================================
# AI Document Extraction - Production Dockerfile
# ============================================================================
# Purpose: Multi-stage build for Next.js 15 + Prisma 7.2 production image
# Target:  Azure Container Apps (CHANGE-055 Phase 2)
# Reference: docs/06-deployment/02-azure-deployment/uat-deployment/04-container-build-push.md
#
# Build:
#   docker build --platform linux/amd64 -t myacr.azurecr.io/ai-document-extraction:tag .
#
# Run locally:
#   docker run -p 3000:3000 --env-file .env myacr.azurecr.io/ai-document-extraction:tag
#
# Notes:
# - Requires next.config.ts: output: 'standalone'
# - Multi-stage reduces final image to ~250-400 MB
# - Runs as non-root user (nextjs:nodejs, uid 1001)
# - Health check at /api/health
# - Uses node:20-slim (Debian) instead of alpine — canvas 3.x has C++17 compile
#   bug on Alpine GCC 14 (uint8_t cstdint include missing); Debian glibc has
#   prebuilt napi binaries available for canvas/sharp/etc.
# ============================================================================


# ============================================================================
# Stage 1: deps — 安裝依賴（cache 優化）
# ----------------------------------------------------------------------------
# 此 stage 僅複製 package.json + lockfile + prisma schema，
# 變更頻率最低，可最大化 Docker layer 快取命中率
# ============================================================================
FROM node:20-slim AS deps

# Debian glibc base — canvas / pdf-to-img / sharp 等套件有 napi prebuilt binaries
# 不需要 Python / make / g++（除非 prebuild 不可用時 fallback 編譯）
# OpenSSL 是 Prisma query engine runtime 依賴
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 複製 package 描述檔與 Prisma schema（postinstall 可能觸發 prisma generate）
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma

# 使用 npm ci 確保 lockfile 一致性（CI 友善）
# 含 devDependencies（builder stage 需要 typescript / tailwindcss / prisma CLI 等）
RUN npm ci


# ============================================================================
# Stage 2: builder — Build Next.js + Generate Prisma Client
# ----------------------------------------------------------------------------
# 使用 deps stage 的 node_modules 直接 build，不再重新安裝
# 產出 .next/standalone/（含 server.js）+ .next/static/
# ============================================================================
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 重用 deps stage 已安裝的 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 複製整個專案（受 .dockerignore 限制）
COPY . .

# 關閉 Next.js telemetry，避免 build 期間外部請求
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build-time dummy environment variables
# Next.js 在 "Collecting page data" 階段會 module-load 所有 API routes，
# 部分 services 在 module-level instantiate 加密/外部服務 client，需要 env var 存在。
# 這些 dummy 值僅在 builder stage 存在，不會 COPY 到 runner stage，runtime 必須由
# Container Apps secrets 注入真實值。
ENV ENCRYPTION_KEY=00000000000000000000000000000000000000000000000000000000000000000
ENV NEXTAUTH_SECRET=build-time-dummy-secret-do-not-use-in-production
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV NEXTAUTH_URL=http://localhost:3000

# 生成 Prisma Client（必須在 next build 之前，否則 build 階段引用 @prisma/client 會失敗）
RUN npx prisma generate

# Build Next.js（依 next.config.ts 的 output: 'standalone' 產生 .next/standalone/）
RUN npm run build


# ============================================================================
# Stage 3: runner — Minimal production image
# ----------------------------------------------------------------------------
# 只複製 standalone output + 必要的 runtime 檔案（i18n / prisma engine / public）
# 不執行任何 npm install，最終 image 大小約 250-400 MB
# ============================================================================
FROM node:20-slim AS runner

# Runtime dependencies（Prisma query engine 需要 OpenSSL）
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production runtime 環境變數
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# HOSTNAME 0.0.0.0 確保容器內 server 監聽所有介面（Container Apps 必要）
ENV HOSTNAME=0.0.0.0

# 建立非 root user（uid 1001）— 安全最佳實踐
# Debian: useradd / groupadd 取代 alpine 的 addgroup / adduser
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# --------------------------------------------------------------------------
# 複製 Next.js standalone output
# --------------------------------------------------------------------------
# .next/standalone/ 內含：
#   - server.js（Next.js 自帶最小化 server）
#   - 必要的 node_modules subset（next 自動 trace 出來的）
#   - package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 靜態資源（CSS / JS chunks / 圖片）— standalone 不會自動帶
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# public/ 靜態檔案（favicon / robots.txt / 圖片等）
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma schema + migrations（runtime 可能需要查 schema metadata）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# i18n 翻譯文件（next-intl runtime 必要）
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages

# --------------------------------------------------------------------------
# 複製 Prisma Client（standalone trace 不一定包含 .prisma engine binaries）
# --------------------------------------------------------------------------
# .prisma/ 含 query engine binary（platform-specific .so 檔）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
# @prisma/client 含 generated client code
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# 切換至非 root user 執行
USER nextjs

EXPOSE 3000

# Health check：Container Apps / Kubernetes liveness 探測指向 /api/health
# - interval=30s：每 30 秒檢查一次
# - timeout=5s：單次檢查超時 5 秒
# - start-period=30s：容器啟動後給 30 秒暖機（Next.js 冷啟動）
# - retries=3：連續 3 次失敗才標記 unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# 啟動 Next.js standalone server
CMD ["node", "server.js"]
