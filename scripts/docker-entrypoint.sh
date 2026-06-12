#!/bin/sh
# ============================================================================
# Container entrypoint (CHANGE-055 — Azure DEV / private-network deployment)
# ----------------------------------------------------------------------------
# 容器在 VNet 內，可直連私有 PostgreSQL。啟動順序：
#   1) bootstrap DB schema（若 public schema 為空，套用 prisma/init.sql）
#   2) essential seed（idempotent：roles / regions / cities / system user / admin / settings）
#   3) 啟動 Next.js standalone server
#
# 失敗即中止（set -e）—— 寧可開不起來也不要在 schema/seed 異常下對外服務。
# ============================================================================
set -e

echo "[entrypoint] Step 1/3: bootstrap database schema (if needed)"
node prisma/bootstrap-db.js

echo "[entrypoint] Step 2/3: run essential seed (idempotent)"
node prisma/dist/seed-prod-essential.js

echo "[entrypoint] Step 3/3: starting Next.js server"
exec node server.js
