---
document_type: deployment_procedure
step_id: STEP-05
title: Database Schema Migration（套用 CHANGE-056 baseline）
estimated_duration: 20-40 minutes
requires_approval: true
approver: app-team-lead
environment: uat
status: ✅ 完整內容（v0.3 階段 C）
prerequisites:
  - STEP-02 completed（PostgreSQL Flexible Server ready）
  - STEP-03 completed（DATABASE_URL secret 已注入 KV）
  - CHANGE-056 已完成（0001_initial_baseline migration 已建立）
outputs:
  - migrations_applied: <list of migration names>
  - schema_version: <last migration name>
  - prisma_engine_version: <version>
---

# STEP-05: Database Schema Migration（套用 CHANGE-056 baseline）

> **狀態**：✅ 完整內容（階段 C）
>
> 依賴 CHANGE-056（Prisma migration baseline）已完成。

## 🎯 Objective

在 UAT 的 PostgreSQL Flexible Server 上套用 Prisma migration baseline，建立完整 122 models / 113 enums 的 schema，並通過 schema diff 驗證確保零差異。

---

## 🔴 關鍵警告（執行前必讀）

> **本 STEP 為 L4 (Critical) 失敗等級**（見 `99-ai-execution-guide.md` §3.1）

| 警告 | 說明 |
|------|------|
| 🔴 **絕對禁止** | `prisma db push`（會繞過 migration history） |
| 🔴 **絕對禁止** | `--accept-data-loss`（破壞性，可能 drop column / index） |
| 🔴 **絕對禁止** | `prisma migrate reset`（清空所有資料） |
| 🔴 **絕對禁止** | `prisma migrate resolve --applied/--rolled-back`（除非 app-team-lead 明確指示） |
| 🔴 **失敗即停** | Migration 失敗時**立即停止**，不可嘗試 force resolve / retry |
| 🔴 **失敗 SOP** | 1. 停止 → 2. 保留 backup → 3. 寫入 `failures` → 4. 通知 app-team-lead |
| 🟡 **加密欄位** | ENCRYPTION_KEY 已綁定加密欄位（`ApiKey`、`SmtpPassword` 等），schema 變更需特別小心 |
| 🟡 **單一執行者** | 本 STEP 期間禁止其他 session 同時操作 DB（state file race condition）|

---

## 🔁 Idempotency 說明

- ✅ `prisma migrate deploy` **本身是 idempotent**：已套用的 migration 不會重跑（依 `_prisma_migrations` 表的記錄判定）
- ⚠️ 但**第一次失敗後的重試有風險**：可能在 `_prisma_migrations` 表留下 `finished_at = null` 的 partial state record
- ⚠️ 若遇到 partial state：**不要自行清理**，立即升級給 app-team-lead 處理（可能需 `migrate resolve --rolled-back`）
- ✅ 本 STEP 的 verify 區塊（5.6 / 5.7）也是 idempotent，可重複執行確認狀態

---

## 📋 Environment Variables

> 基於 STEP-00 §5 通用環境變數 + 本 STEP 增補。

```bash
# 從 STEP-00 / state file 載入
export PROJECT_ROOT="$(git rev-parse --show-toplevel)"
export STATE_FILE="${PROJECT_ROOT}/deployment-state/uat.yaml"
export RG_NAME="rg-ai-document-extraction-uat"
export POSTGRES_NAME="psql-aidocextract-uat"
export KV_NAME="kv-aidocextract-uat"

# 從 state file 取 DB FQDN（STEP-02 寫入）
export DB_FQDN=$(yq '.resources.postgres.fqdn' ${STATE_FILE})

# 本 STEP 內部使用（不寫入 state file）
export BACKUP_DIR="${PROJECT_ROOT}/deployment-state/backups"
export BACKUP_FILE="${BACKUP_DIR}/backup-pre-migrate-$(date +%Y%m%d-%H%M%S).sql"
```

---

## 🛠️ Actions

### Action 5.1: 確認 PostgreSQL 連線

**Command**:
```bash
# 從 state file 取 DB FQDN
DB_FQDN=$(yq '.resources.postgres.fqdn' ${STATE_FILE})
echo "Target DB: ${DB_FQDN}"

# 5.1a. 基本網路可達性（TCP 5432）
pg_isready -h ${DB_FQDN} -p 5432 -t 10

# 5.1b. 檢查防火牆規則（若 UAT 採 public ingress）
az postgres flexible-server firewall-rule list \
  --resource-group ${RG_NAME} \
  --name ${POSTGRES_NAME} \
  --output table

# 5.1c. 若 Private Endpoint：透過 jump host / Bastion 測試
# （視 Infra Team handoff 而定，跳過此 step 若採 public ingress）
```

**Verify**:
```bash
pg_isready -h ${DB_FQDN} -p 5432 && echo "✅ DB reachable" || echo "❌ DB not reachable"
```

**Expected Output**:
```
<DB_FQDN>:5432 - accepting connections
✅ DB reachable
```

**If Fails**:
- `pg_isready` 失敗 → 檢查 Infra Team 防火牆規則 / VNet 整合（升級 infra-admin）
- 若使用 Private Endpoint 需從 jump host 測試 → 切換到 jump host 重跑
- 不可繼續至 5.2

---

### Action 5.2: 設定 DATABASE_URL（從 Key Vault）

**Command**:
```bash
# 5.2a. 從 KV 取 DATABASE_URL（必須含 sslmode=require）
DATABASE_URL=$(az keyvault secret show \
  --vault-name ${KV_NAME} \
  --name database-url \
  --query value -o tsv)

# 5.2b. 驗證 URL 含 sslmode=require（不暴露 URL 內容）
if [[ "${DATABASE_URL}" != *"sslmode=require"* ]]; then
  echo "❌ DATABASE_URL missing sslmode=require"
  exit 1
fi

# 5.2c. Export（僅當前 shell session，不寫入任何檔案）
export DATABASE_URL
echo "✅ DATABASE_URL loaded (length=${#DATABASE_URL})"
```

**Verify**:
```bash
# 用 prisma 內建測試（不印 URL）
npx prisma db execute --stdin <<< "SELECT 1;" \
  --schema=${PROJECT_ROOT}/prisma/schema.prisma 2>&1 | tail -5
```

**Expected Output**:
```
✅ DATABASE_URL loaded (length=<some-number>)
Script executed successfully.
```

**If Fails**:
- KV 存取失敗 → 確認 deploy agent 有 KV `Get` 權限（升級 infra-admin）
- URL 缺 `sslmode=require` → 重新從 STEP-03 注入正確的 URL
- 連線失敗 → 回到 5.1

**🔐 Security Note**:
- ❌ **絕對禁止**將 `DATABASE_URL` 寫入 state file
- ❌ **絕對禁止**用 `echo $DATABASE_URL` 列印
- ✅ 僅在當前 shell session 中 export，session 結束後失效

---

### Action 5.3: 強制 Backup（即使是 UAT）

**Command**:
```bash
# 5.3a. 建立備份目錄
mkdir -p ${BACKUP_DIR}

# 5.3b. 完整 pg_dump（即使 UAT 沒資料也要建立 baseline backup）
pg_dump "${DATABASE_URL}" \
  --no-owner --no-privileges \
  --format=plain \
  --file=${BACKUP_FILE} \
  --verbose 2>&1 | tail -10

# 5.3c. 驗證備份檔案存在且非空
ls -la ${BACKUP_FILE}
[[ -s ${BACKUP_FILE} ]] && echo "✅ Backup created" || echo "❌ Backup empty"
```

**Verify**:
```bash
# 確認備份內含 SQL header
head -5 ${BACKUP_FILE} | grep -q "PostgreSQL database dump" && echo "✅ Valid pg_dump"
```

**Expected Output**:
```
✅ Backup created
✅ Valid pg_dump
```

**If Fails**:
- 權限不足 → 確認 DATABASE_URL 角色具 `pg_read_all_data`
- 磁碟不足 → 清理 `${BACKUP_DIR}` 舊檔
- ⚠️ Backup 失敗時**禁止繼續至 5.4**（這是 prod 流程演練的核心）

**📌 為何 UAT 也需 backup**：
1. 流程演練：完全模擬 prod migration 流程
2. Roll-forward 保險：若 migrate deploy 中途失敗仍可還原至已知狀態
3. 審計追蹤：backup 檔名含 timestamp，可佐證執行時序

---

### Action 5.4: 確認 baseline migration 存在

**Command**:
```bash
# 5.4a. 確認 CHANGE-056 產出的 baseline migration 存在
ls -la ${PROJECT_ROOT}/prisma/migrations/0001_initial_baseline/migration.sql

# 5.4b. 確認 migration_lock.toml 存在（Prisma 強制要求）
ls -la ${PROJECT_ROOT}/prisma/migrations/migration_lock.toml

# 5.4c. 列出所有 migrations（baseline 應為唯一非 _archive 目錄）
ls -d ${PROJECT_ROOT}/prisma/migrations/*/ | grep -v _archive
```

**Verify**:
```bash
[[ -f ${PROJECT_ROOT}/prisma/migrations/0001_initial_baseline/migration.sql ]] && \
  echo "✅ Baseline exists" || echo "❌ Baseline missing — STOP"
```

**Expected Output**:
```
-rw-r--r-- ... migration.sql (size > 0)
✅ Baseline exists
```

**If Fails**:
- ❌ **若 baseline 缺失**：**立即停止執行**，回到 CHANGE-056 完成 baseline 重建
- 不可自行 `prisma migrate dev` 生成（會建立錯誤版本歷史）
- 升級給 app-team-lead

---

### Action 5.5: 執行 prisma migrate deploy（🔴 敏感操作）

> **⚠️ 此 Action 為 L4 critical level，需 app-team-lead 明確 approval**
>
> AI 助手必須在執行前向人類確認，並輸出 Pre-Action Safety Check（見 `99-ai-execution-guide.md` §4.1）

**Command**:
```bash
# 5.5a. 執行 migration deploy（唯一允許的 prod migration 指令）
cd ${PROJECT_ROOT}
npx prisma migrate deploy 2>&1 | tee /tmp/migrate-deploy.log

# 5.5b. 取得 exit code
MIGRATE_EXIT=${PIPESTATUS[0]}
echo "Migrate deploy exit code: ${MIGRATE_EXIT}"
```

**🚫 絕對禁止指令**（無論失敗與否都不可使用）：
- ❌ `prisma db push`
- ❌ `prisma db push --accept-data-loss`
- ❌ `prisma migrate dev`（這是 local-only 指令）
- ❌ `prisma migrate reset`
- ❌ `prisma migrate resolve --applied 0001_initial_baseline`（除非 app-team-lead 明確指示）

**Verify**:
```bash
# 確認 exit code = 0
[[ ${MIGRATE_EXIT} -eq 0 ]] && echo "✅ Migration succeeded" || echo "❌ Migration FAILED — STOP IMMEDIATELY"

# 確認 log 含 "All migrations have been successfully applied"
grep -q "All migrations have been successfully applied\|already in sync" /tmp/migrate-deploy.log && \
  echo "✅ Log confirms success"
```

**Expected Output**:
```
Datasource "db": PostgreSQL database "<dbname>" at "<DB_FQDN>:5432"

1 migration found in prisma/migrations

Applying migration `0001_initial_baseline`

The following migration(s) have been applied:

migrations/
  └─ 0001_initial_baseline/
    └─ migration.sql

All migrations have been successfully applied.

Migrate deploy exit code: 0
✅ Migration succeeded
✅ Log confirms success
```

**Estimated Duration**: 1-3 分鐘（122 models / 113 enums + 索引建立）

**If Fails**:
- 🔴 **L4 Critical 失敗 SOP**：
  1. **立即停止**，不可重試任何 prisma 指令
  2. 保留 `${BACKUP_FILE}` 與 `/tmp/migrate-deploy.log`
  3. 寫入 state file `failures` 區段（含完整 error message）
  4. **通知 app-team-lead**，等待人類介入
  5. 不可自行 `migrate resolve` / `migrate reset`
- 常見錯誤 + 升級對應：
  - `P3009 (migrate found failed migrations)` → 升級 app-team-lead
  - `P1001 (cannot reach database)` → 回到 5.1 排查
  - `P3018 (migration failed during execution)` → backup 還原 + 升級
  - 任何 ENCRYPTION_KEY 相關錯誤 → 立即升級（不可改動 key）

---

### Action 5.6: 驗證 migration 套用（_prisma_migrations 表）

**Command**:
```bash
# 5.6a. 查詢 _prisma_migrations 表
psql "${DATABASE_URL}" -c "SELECT migration_name, applied_steps_count, started_at, finished_at FROM _prisma_migrations ORDER BY started_at;"

# 5.6b. 檢查 finished_at 不為 null（表示完整套用）
INCOMPLETE=$(psql "${DATABASE_URL}" -tAc "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL;")
echo "Incomplete migrations: ${INCOMPLETE}"

# 5.6c. 確認 122 個 tables 已建立（+ Prisma 內部表 _prisma_migrations）
TABLE_COUNT=$(psql "${DATABASE_URL}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "Public schema table count: ${TABLE_COUNT}"
```

**Verify**:
```bash
# 5.6 三項驗證
[[ ${INCOMPLETE} -eq 0 ]] && echo "✅ All migrations complete" || echo "❌ Partial state detected"

# 預期 ≈ 122 + Prisma 內部表（容忍 ±5 因 Prisma 版本）
[[ ${TABLE_COUNT} -ge 120 && ${TABLE_COUNT} -le 130 ]] && \
  echo "✅ Table count in expected range (${TABLE_COUNT})" || \
  echo "⚠️ Unexpected table count (${TABLE_COUNT})"
```

**Expected Output**:
```
       migration_name        | applied_steps_count |          started_at           |          finished_at
-----------------------------+---------------------+-------------------------------+-------------------------------
 0001_initial_baseline       |                   1 | 2026-05-13 ...                | 2026-05-13 ...
(1 row)

Incomplete migrations: 0
Public schema table count: 123
✅ All migrations complete
✅ Table count in expected range (123)
```

**If Fails**:
- `INCOMPLETE > 0`（partial state）→ **L4 critical**，升級 app-team-lead
- `TABLE_COUNT < 120` → migration 未完整執行，升級 app-team-lead
- `_prisma_migrations` 表不存在 → migration 完全沒跑成功，回到 5.5 重檢

---

### Action 5.7: Schema diff 驗證（零差異要求）

**Command**:
```bash
# 5.7a. 從 UAT DB 反向產出 schema 至 /tmp
npx prisma db pull \
  --schema=/tmp/schema.verify.prisma \
  --print 2>&1 | tail -10

# 注意：db pull 預設會覆蓋 schema 檔，故指定獨立路徑
DATABASE_URL="${DATABASE_URL}" \
  npx prisma db pull \
  --schema=/tmp/schema.verify.prisma

# 5.7b. 比對 prisma/schema.prisma vs /tmp/schema.verify.prisma
diff ${PROJECT_ROOT}/prisma/schema.prisma /tmp/schema.verify.prisma > /tmp/schema-diff.txt
DIFF_LINES=$(wc -l < /tmp/schema-diff.txt)
echo "Diff lines: ${DIFF_LINES}"

# 5.7c. 若有差異，輸出供 app-team-lead 判斷
[[ ${DIFF_LINES} -gt 0 ]] && cat /tmp/schema-diff.txt
```

**Verify**:
```bash
# 預期：零差異或僅 Prisma 自動格式化（如註解、空行）
[[ ${DIFF_LINES} -eq 0 ]] && \
  echo "✅ Schema fully synced (zero diff)" || \
  echo "⚠️ Diff detected — review /tmp/schema-diff.txt"
```

**Expected Output**:
```
Diff lines: 0
✅ Schema fully synced (zero diff)
```

**If Fails**:
- 若 diff 含實質差異（model / field / enum / index）→ **不可繼續**，升級 app-team-lead
- 若 diff 僅含 Prisma 自動格式化（comment / blank line）→ 記錄在 state file `notes` 後可繼續
- ⚠️ 不可手動編輯 `/tmp/schema.verify.prisma` 強制比對通過

**清理**:
```bash
rm -f /tmp/schema.verify.prisma /tmp/schema-diff.txt /tmp/migrate-deploy.log
```

---

### Action 5.8: 寫入 state file

**Command**:
```bash
# 5.8a. 取得 Prisma engine 版本
PRISMA_VERSION=$(npx prisma --version 2>&1 | grep "@prisma/client" | awk '{print $2}')

# 5.8b. 取得最新 migration 名稱（schema_version）
LATEST_MIGRATION=$(psql "${DATABASE_URL}" -tAc \
  "SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 1;")

# 5.8c. 原子性寫入 state file（用 yq）
yq -i ".steps_completed += [{
  \"step_id\": \"STEP-05\",
  \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"status\": \"success\"
}]" ${STATE_FILE}

yq -i ".resources.database.migrations_applied = [\"${LATEST_MIGRATION}\"]" ${STATE_FILE}
yq -i ".resources.database.schema_version = \"${LATEST_MIGRATION}\"" ${STATE_FILE}
yq -i ".resources.database.prisma_engine_version = \"${PRISMA_VERSION}\"" ${STATE_FILE}
yq -i ".resources.database.backup_pre_migrate = \"${BACKUP_FILE}\"" ${STATE_FILE}
yq -i ".next_step = \"STEP-06\"" ${STATE_FILE}
yq -i ".metadata.last_updated = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" ${STATE_FILE}
```

**Verify**:
```bash
# 確認寫入成功
yq '.resources.database.schema_version' ${STATE_FILE}
yq '.next_step' ${STATE_FILE}
```

**Expected Output**:
```
"0001_initial_baseline"
"STEP-06"
```

**If Fails**:
- yq 寫入失敗 → 不可用 `sed` 修補（會破壞 YAML 結構）
- 升級給 app-team-lead 手動修補 state file

**🔐 Security Note**:
- ✅ state file 只寫 migration 名稱、版本號、backup 路徑
- ❌ 不寫 DATABASE_URL、不寫 backup 內容、不寫任何 secret value

---

## ✅ Exit Criteria

- [ ] 5.1: PostgreSQL 連線測試通過
- [ ] 5.2: DATABASE_URL 從 KV 載入成功（含 sslmode=require）
- [ ] 5.3: pg_dump backup 建立完成（${BACKUP_FILE}）
- [ ] 5.4: `0001_initial_baseline` migration 存在
- [ ] 5.5: `prisma migrate deploy` 成功（exit code = 0）
- [ ] 5.6: `_prisma_migrations` 表記錄完整（incomplete = 0）
- [ ] 5.6: Public schema 表數量 ≈ 122-128
- [ ] 5.7: Schema diff 零差異（或僅格式化差異）
- [ ] 5.8: State file 已更新（schema_version / next_step）
- [ ] 進入 STEP-06（Seed Essential Data）

---

## 🤖 AI Execution Hint

- 本 STEP `requires_approval: true` → 執行 Action 5.5 前必須暫停請求人類確認
- 本 STEP 為 L4 critical → 任何 verify 失敗**立即停止**，不可 retry
- Pre-Action 5.5 必須輸出完整 Safety Check（見 `99-ai-execution-guide.md` §4.1）
- 失敗時的 state file `failures` 寫入格式參考 `99-ai-execution-guide.md` §3.2

---

*文件版本: v1.0（階段 C 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
