---
document_type: deployment_procedure
step_id: STEP-06
title: Essential Seed 執行（系統基礎資料）
estimated_duration: 5-10 minutes
requires_approval: false
approver: none
environment: uat
status: ✅ 完整內容（階段 C）
prerequisites:
  - STEP-05 completed（Schema 已建立）
  - prisma/seed-prod-essential.ts 已實作
outputs:
  - roles_count: <expected: 7-10>
  - regions_count: <expected: 5-7>
  - cities_count: <expected: 20-30>
  - system_user_id: system-user-prod
  - system_settings_count: <number>
---

# STEP-06: Essential Seed 執行（系統基礎資料）

## 🎯 Objective

在 UAT 環境執行 **essential seed**，建立系統運作必要的最基礎資料，使 Container App 啟動後能進行登入、城市選擇、權限驗證等核心流程。

---

## 📦 Essential Seed 範圍說明

> **參考**：`../azure-deployment-plan.md` §4 Seed 策略

### ✅ 進 Essential Seed（本步驟處理）

| 資料類別 | Prisma Model | 預期數量 | 用途 |
|---------|-------------|---------|------|
| Roles | `Role` | 7-10 | 角色定義（SUPER_ADMIN / ADMIN / OPERATOR / REVIEWER / FORWARDER_VIEWER 等） |
| Regions | `Region` | 5-7 | 區域（APAC / EMEA / AMERICAS 等） |
| Cities | `City` | 20-30 | 城市（HKG / SIN / TPE / TYO 等，含時區/幣別） |
| System User | `User` | 1 | `system-user-prod`（與 FIX-054 機制配合） |
| Default SystemSettings | `SystemSetting` | N | 系統預設參數（confidence threshold、retention days 等） |
| FeatureFlag | `FeatureFlag` | N | 功能開關預設值 |

### ❌ 不進 Essential Seed（屬 Reference Seed → STEP-07）

| 資料類別 | 原因 |
|---------|------|
| Companies（公司基本資料） | 業務資料，由 admin 維護 |
| Tier 1 Universal Mappings | 需手動整理 prod-grade JSON，首次上線手動執行 |
| Prompt Configs | 同上，避免覆寫 prod admin UI 變更 |
| Exchange Rates | 同上 |

### ❌ 絕不進 Production Seed（僅本地 dev）

| 資料類別 | 風險 |
|---------|------|
| `dev-user-1` | 命名語義誤導 + FIX-054 已修正為 `system-user-prod` |
| Test Companies / Mock Documents | 污染 prod-grade 資料 |
| `exported-data.json` 測試資料 | 可能含 dev 環境敏感資料 |

> **設計重點**：Essential seed 必須 **idempotent**（每次部署自動執行不破壞既有資料）。

---

## 🔧 Environment Variables

```bash
# 繼承自 STEP-00 通用配置
export RG_NAME="rg-ai-document-extraction-uat"
export POSTGRES_NAME="psql-aidocextract-uat"

# Essential seed 必要變數
export SYSTEM_USER_ID="system-user-prod"        # FIX-054 機制（不是 dev-user-1）
export DATABASE_URL="<從 STEP-05 繼承或從 KV 重新取得>"

# 部署狀態檔
export DEPLOYMENT_STATE_FILE="${PROJECT_ROOT}/deployment-state/uat.yaml"
```

---

## 📋 Action Steps

### Action 6.1: 確認 `seed-prod-essential.ts` 存在且 idempotent

**Command**:
```bash
test -f prisma/seed-prod-essential.ts && echo "EXISTS" || echo "MISSING"
```

**程式碼審查 Checklist**（執行前必須通過）：

```bash
# 1. 所有寫入必須使用 upsert（不可用 create）
grep -E "prisma\.\w+\.create\(" prisma/seed-prod-essential.ts | grep -v "upsert"
# 預期輸出：（空，如有結果代表存在 .create() 違反 idempotency）

# 2. 不可有 hardcoded dev-user-1
grep "dev-user-1" prisma/seed-prod-essential.ts
# 預期輸出：（空）

# 3. 不可 console.log 任何 secret / 密碼
grep -E "console\.log.*(password|secret|key)" prisma/seed-prod-essential.ts
# 預期輸出：（空）

# 4. 必須引用 process.env.SYSTEM_USER_ID
grep "SYSTEM_USER_ID" prisma/seed-prod-essential.ts
# 預期輸出：至少一行（使用 env 注入而非硬編碼）
```

**Verify**: 上述 4 項檢查全部通過。

**If Fails**:
- 若 `MISSING`：**停止執行**。需先在 CHANGE-055 Phase 2.6 完成 `seed-prod-essential.ts` 建立。
- 若 hardcoded `dev-user-1` 存在：回到 CHANGE-055 修正後再來。
- 若使用 `.create()` 而非 `.upsert()`：違反 idempotency 原則，必須重構。

---

### Action 6.2: 設定執行環境

**Command**:
```bash
# 確認 Node 版本
node --version
# 預期：v20.x.x 或更新

# 確認 ts-node 可用
npx ts-node --version

# 確認 DATABASE_URL（已從 STEP-05 注入或重新從 Key Vault 取得）
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'YES' || echo 'NO')"

# 設定 SYSTEM_USER_ID
export SYSTEM_USER_ID="system-user-prod"
echo "SYSTEM_USER_ID: $SYSTEM_USER_ID"
```

**Verify**: Node 20+、`DATABASE_URL` 已設、`SYSTEM_USER_ID` = `system-user-prod`。

**Expected Output**:
```
v20.x.x
ts-node v10.x.x
DATABASE_URL is set: YES
SYSTEM_USER_ID: system-user-prod
```

**If Fails**:
- Node 版本不符：升級 Node 至 20+。
- `DATABASE_URL` 未設：回 STEP-05 重新取得連線字串（從 Key Vault `kv-aidocextract-uat` secret `database-url`）。

---

### Action 6.3: Dry-run 預覽（若 seed 腳本支援）

> **建議**：`seed-prod-essential.ts` 應實作 `--dry-run` flag，列出將執行的 upsert 操作但不寫入 DB。若未實作，跳過此 Action。

**Command**:
```bash
npx ts-node prisma/seed-prod-essential.ts --dry-run
```

**Expected Output**（範例）：
```
[DRY-RUN] Would upsert 8 roles
[DRY-RUN] Would upsert 6 regions
[DRY-RUN] Would upsert 25 cities
[DRY-RUN] Would upsert system user (id=system-user-prod)
[DRY-RUN] Would upsert 12 system settings
[DRY-RUN] Would upsert 8 feature flags
[DRY-RUN] No data written.
```

**If Fails**:
- 腳本不支援 `--dry-run`：跳過此步，直接進 Action 6.4。
- 報錯 `Cannot connect to database`：檢查 `DATABASE_URL` 與 PostgreSQL firewall 規則。

---

### Action 6.4: 執行 Essential Seed

**Command**:
```bash
npx ts-node prisma/seed-prod-essential.ts
```

**預計執行時間**：30-60 秒。

**Expected Output**（範例）：
```
🌱 Starting essential seed for production...
📋 Seeding roles...
  ✅ Upserted: SUPER_ADMIN (29 permissions)
  ✅ Upserted: ADMIN (24 permissions)
  ✅ Upserted: OPERATOR (12 permissions)
  ✅ Upserted: REVIEWER (8 permissions)
  ✅ Upserted: FORWARDER_VIEWER (3 permissions)
  ... (共 7-10 個)
🌍 Seeding regions...
  ✅ Upserted: APAC (Asia-Pacific)
  ✅ Upserted: EMEA (Europe-Middle East-Africa)
  ✅ Upserted: AMERICAS
  ... (共 5-7 個)
🏙️ Seeding cities...
  ✅ Upserted: HKG (Hong Kong, APAC)
  ✅ Upserted: SIN (Singapore, APAC)
  ✅ Upserted: TPE (Taipei, APAC)
  ... (共 20-30 個)
👤 Seeding system user...
  ✅ Upserted: system-user-prod (System / ACTIVE)
⚙️ Seeding default system settings...
  ✅ Upserted: 12 settings
🚩 Seeding feature flags...
  ✅ Upserted: 8 flags
✨ Essential seed completed in 42.3s
```

**If Fails**:
| 錯誤 | 可能原因 | 處置 |
|------|---------|------|
| `P2002: Unique constraint failed` | 既有資料 unique key 衝突 | 檢查 seed 是否使用 `upsert` 而非 `create` |
| `P2003: Foreign key constraint failed` | Role/Region 順序錯誤 | 確認 seed 順序：Roles → Regions → Cities → SystemUser |
| `Cannot connect to database` | DATABASE_URL 或 firewall | 回 STEP-05 確認 |
| `process.env.SYSTEM_USER_ID is undefined` | 環境變數未匯出 | 重新 `export SYSTEM_USER_ID=system-user-prod` |

---

### Action 6.5: 驗證資料 Count

**Command**（使用 psql 或 prisma db pull / Prisma Studio 查詢）：

```bash
# 取得 PostgreSQL 連線字串（已 export 在 DATABASE_URL）
PSQL="psql $DATABASE_URL"

# 1. Roles 預期 7-10 個
$PSQL -c "SELECT count(*) AS roles_count FROM roles;"

# 2. Regions 預期 5-7 個
$PSQL -c "SELECT count(*) AS regions_count FROM regions;"

# 3. Cities 預期 20-30 個（Pilot：HKG + SIN 必須存在）
$PSQL -c "SELECT count(*) AS cities_count FROM cities;"
$PSQL -c "SELECT code, name, timezone FROM cities WHERE code IN ('HKG', 'SIN') ORDER BY code;"

# 4. SystemSettings 預期 N 個（>0）
$PSQL -c "SELECT count(*) AS system_settings_count FROM system_settings;"

# 5. FeatureFlag 預期 N 個（>0）
$PSQL -c "SELECT count(*) AS feature_flags_count FROM feature_flags;"
```

**Expected Output**:
```
 roles_count
-------------
           8
 regions_count
---------------
             6
 cities_count
--------------
           25
 code | name      | timezone
------+-----------+---------------------
 HKG  | Hong Kong | Asia/Hong_Kong
 SIN  | Singapore | Asia/Singapore
 system_settings_count
-----------------------
                    12
 feature_flags_count
---------------------
                   8
```

**Verify**:
- ✅ Roles ≥ 7
- ✅ Regions ≥ 5
- ✅ Cities ≥ 20，且 HKG + SIN 必定存在（Pilot 必要）
- ✅ SystemSettings > 0
- ✅ FeatureFlag > 0

**If Fails**:
- Count 為 0：seed 可能 silent fail（檢查 Action 6.4 的完整輸出）
- Count 低於預期：seed 腳本可能漏定義某些資料（回 codebase 檢查 `seed-data/essential/*.json`）
- HKG / SIN 不存在：**阻塞 Pilot 上線**，必須在 seed 腳本補入

---

### Action 6.6: 驗證 system-user-prod 完整性（FIX-054 機制核心）

> **重要性**：此用戶為 `company-auto-create.service` / `batch-processor.service` / `sharepoint-document.service` / `outlook-document.service` 等多個核心服務的 `createdById` 依賴。若不存在或非 active，多個業務流程將崩潰。

**Command**:
```bash
$PSQL -c "
SELECT
  id,
  email,
  name,
  status,
  \"isActive\",
  \"createdAt\"
FROM users
WHERE id = 'system-user-prod';
"

# 確認有對應 Role assignment
$PSQL -c "
SELECT
  u.id AS user_id,
  u.email,
  r.name AS role_name
FROM users u
LEFT JOIN user_roles ur ON ur.\"userId\" = u.id
LEFT JOIN roles r ON r.id = ur.\"roleId\"
WHERE u.id = 'system-user-prod';
"
```

**Expected Output**:
```
       id        |               email               |  name  | status | isActive
-----------------+-----------------------------------+--------+--------+----------
 system-user-prod| system@ai-document-extraction.app | System | ACTIVE | t

   user_id      | email                             | role_name
----------------+-----------------------------------+--------------
 system-user-prod| system@ai-document-extraction.app | SUPER_ADMIN
```

**Verify**:
- ✅ `id` = `system-user-prod`
- ✅ `status` = `ACTIVE`
- ✅ `isActive` = `true`
- ✅ 至少有一個 Role assignment（建議 SUPER_ADMIN 或 SYSTEM）

**If Fails**:
- 用戶不存在：**重新執行 Action 6.4**（確認 SYSTEM_USER_ID env 正確）
- `isActive` = false：seed 腳本邏輯錯誤，需修正 upsert 的 `update` 區塊
- 無 Role assignment：seed 漏建立 `UserRole` 關聯，需補

---

### Action 6.7: 寫入 State File

**Command**:
```bash
# 取得 count 結果（用 PSQL 查詢取數字）
ROLES_COUNT=$($PSQL -tAc "SELECT count(*) FROM roles;")
REGIONS_COUNT=$($PSQL -tAc "SELECT count(*) FROM regions;")
CITIES_COUNT=$($PSQL -tAc "SELECT count(*) FROM cities;")
SETTINGS_COUNT=$($PSQL -tAc "SELECT count(*) FROM system_settings;")

# 寫入 state file（手動編輯或腳本 append）
cat >> "$DEPLOYMENT_STATE_FILE" <<EOF

# === STEP-06 Essential Seed Outputs ===
step_06_essential_seed:
  completed_at: $(date -Iseconds)
  status: success
  outputs:
    roles_count: $ROLES_COUNT
    regions_count: $REGIONS_COUNT
    cities_count: $CITIES_COUNT
    system_user_id: system-user-prod
    system_settings_count: $SETTINGS_COUNT
EOF
```

**Verify**: `cat $DEPLOYMENT_STATE_FILE` 內含 `step_06_essential_seed` 區塊。

**If Fails**: 手動編輯 `deployment-state/uat.yaml` 補入 outputs。

---

### Action 6.8: 重複執行驗證 Idempotency（建議）

> **目的**：證明 essential seed 可重複執行而不破壞資料，符合 CI/CD 自動執行的設計前提。

**Command**:
```bash
# 記錄第一次的 timestamp
FIRST_RUN_TS=$($PSQL -tAc "SELECT max(\"updatedAt\") FROM roles;")

# 再次執行 seed
npx ts-node prisma/seed-prod-essential.ts

# 驗證 count 不變
$PSQL -c "SELECT count(*) FROM roles;"
$PSQL -c "SELECT count(*) FROM regions;"
$PSQL -c "SELECT count(*) FROM cities;"

# 驗證 updatedAt 變更（upsert 的 update 路徑被觸發）
SECOND_RUN_TS=$($PSQL -tAc "SELECT max(\"updatedAt\") FROM roles;")
echo "First run:  $FIRST_RUN_TS"
echo "Second run: $SECOND_RUN_TS"
```

**Verify**:
- ✅ Count 數字完全相同（roles_count / regions_count / cities_count 不變）
- ✅ 無 error / warning
- ✅ `updatedAt` timestamp 已更新（代表 upsert update 路徑生效）

**If Fails**:
- Count 增加：違反 idempotency，seed 中可能有 `.create()` 而非 `.upsert()`
- 報錯 `unique constraint`：seed 中的 upsert `where` 條件設定錯誤

---

## 🎯 重要原則

| 原則 | 說明 |
|------|------|
| ✅ Essential seed 必須 idempotent | 可重複執行，每次 CI/CD 部署自動跑 |
| ✅ 每次部署 CI/CD 自動執行 | 屬於 deployment pipeline 的標準步驟（migrate → seed-essential → app start） |
| ✅ 使用 `upsert` 而非 `create` | 確保 idempotency 與 prod 安全 |
| ✅ 透過 env 注入 SYSTEM_USER_ID | FIX-054 機制，不可硬編碼 |
| ❌ 禁止建立業務資料 | Companies / MappingRules / Documents 屬 Reference Seed 範疇（STEP-07） |
| ❌ 禁止載入 `exported-data.json` | 該檔案僅供 local dev 使用，含 dev 環境痕跡 |
| ❌ 禁止使用 `dev-user-1` | 命名語義誤導，FIX-054 已遷移至 `system-user-prod` |
| ❌ 禁止 console.log secrets | 任何 secret / password / token 不可輸出至 log |

---

## 🤖 AI Execution Hint

- 執行 Action 6.4 前必須先完成 6.1（程式碼審查），不可跳步
- Action 6.5 的 count 驗證是 fail-fast 機制，count 不符立即停止進入 STEP-07
- Action 6.6 是 FIX-054 依賴核心，**絕對不可跳過**
- Action 6.8 失敗時不得忽略——idempotency 是 CI/CD 自動化前提

---

## ✅ Exit Criteria

- [ ] Action 6.1: `seed-prod-essential.ts` 存在且通過程式碼審查
- [ ] Action 6.4: seed 執行成功，無 error
- [ ] Action 6.5: 各資料 count 符合預期（Roles ≥ 7、Regions ≥ 5、Cities ≥ 20，HKG+SIN 存在）
- [ ] Action 6.6: `system-user-prod` 已建立、active=true、有 Role assignment
- [ ] Action 6.7: state file 已寫入 `step_06_essential_seed` outputs
- [ ] Action 6.8（建議）: idempotency 驗證通過
- [ ] 進入 **STEP-07: Reference Seed**（手動執行，requires_approval: true）

---

*文件版本: v1.0（階段 C 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
