---
document_type: deployment_procedure
step_id: STEP-07
title: Reference Seed 手動執行（公司 + Tier 1 Mappings）
estimated_duration: 15-30 minutes
requires_approval: true
approver: app-team-lead
environment: uat
status: ✅ 完整內容（v0.3 階段 C）
prerequisites:
  - STEP-06 completed
  - prisma/seed-prod-reference.ts 已實作
  - prisma/seed-data/reference/*.json 已準備（手動整理的 prod-grade JSON）
outputs:
  - companies_count: <expected: 5-10 for Pilot, ≤100 for full>
  - tier1_mappings_count: <expected: 50-100 for Pilot, 50-200 for full>
  - prompt_configs_count: <number>
  - exchange_rates_count: <number>
---

# STEP-07: Reference Seed 手動執行（公司 + Tier 1 Mappings）

> **此 STEP 為首次上線手動執行一次，不應在後續部署重複執行。**

## 🎯 Objective

執行 reference seed，建立業務初始參考資料：
- Companies 基本資料（Pilot：5-10 間 / Full：≤100 間）
- Tier 1 Universal Mapping Rules（Pilot：50-100 條 / Full：50-200 條）
- Default Prompt Configs（GPT-5.2 Stage 1/2/3 提示詞）
- 初始 Exchange Rates 快照

---

## ⚠️ 關鍵警告（執行前必讀）

> **此區塊為人類 + AI 助手必讀。違反任一條都可能造成 prod 資料覆寫或不可逆破壞。**

| 警告 | 說明 |
|------|------|
| 🔴 **手動執行一次，永不重複** | 此 STEP 為首次上線執行 — 後續部署絕對**不可**再執行 `seed-prod-reference.ts`，否則會覆寫 prod 使用者建立 / 修改的資料 |
| 🔴 **requires_approval: true** | 此 STEP frontmatter 標記 `approver: app-team-lead`，AI 助手必須**暫停** + 等待人類確認，不可自行執行（見 `99-ai-execution-guide.md` §4.2） |
| 🔴 **Reference data 必須是 prod-grade JSON** | `prisma/seed-data/reference/*.json` 必須是**人工整理**的乾淨資料，**不可從 dev DB dump**（dev DB 含測試髒資料、`dev-user-1` 關聯等） |
| 🔴 **Tier 2 Forwarder-Specific Mappings 不在此 seed 範圍** | 只 seed Tier 1 Universal（`scope=UNIVERSAL`）。Tier 2（`scope=COMPANY_SPECIFIC`）透過上線後 V3.1 智能降級 + `rule-suggestion-generator` 學習建立，詳見 Action 7.8 |
| 🔴 **執行前必須有 lock 機制** | 必須先檢查 `flags.reference_seed_executed` — 若已為 `true`，**立即停止**並走 Action 7.2 緊急流程 |

---

## 📋 Action 7.1: 驗證 Reference Data JSON 完整性

**目的**：確認 4 份 prod-grade JSON 結構正確、欄位齊全、信心度達標。**任一份失敗即停止後續步驟。**

### 路徑
```
prisma/seed-data/reference/
├── companies.json           # Pilot 5-10 / Full ≤100
├── tier1-mappings.json      # Pilot 50-100 / Full 50-200
├── prompt-configs.json      # 3-10 筆（Stage 1/2/3 各至少 1）
└── exchange-rates.json      # 5-20 筆
```

### 7.1.1 companies.json 驗證

**Required Schema**：`name`, `region`, `cityCode`, `status`, `contactInfo`

```bash
# Command
COMPANIES_FILE="${PROJECT_ROOT}/prisma/seed-data/reference/companies.json"

# 1. 檔案存在 + 是合法 JSON Array
jq -e 'type == "array"' ${COMPANIES_FILE} || { echo "FAIL: not a JSON array"; exit 1; }

# 2. 數量檢查（Pilot 5-10 / Full ≤100）
COMPANIES_COUNT=$(jq 'length' ${COMPANIES_FILE})
echo "Companies count: ${COMPANIES_COUNT}"
[[ ${COMPANIES_COUNT} -ge 5 && ${COMPANIES_COUNT} -le 100 ]] || { echo "FAIL: count out of range"; exit 1; }

# 3. 必填欄位驗證（每筆都必須有 5 個 key）
jq -e 'all(.[]; has("name") and has("region") and has("cityCode") and has("status") and has("contactInfo"))' \
  ${COMPANIES_FILE} || { echo "FAIL: missing required fields"; exit 1; }

# 4. status 值合法性
jq -e 'all(.[]; .status as $s | ["ACTIVE","INACTIVE","PENDING"] | index($s))' \
  ${COMPANIES_FILE} || { echo "FAIL: invalid status value"; exit 1; }
```

**Expected Output**：4 個 jq 命令全部 exit 0，`COMPANIES_COUNT` 在預期範圍內。

**If Fails**：依錯誤訊息修正 JSON 後重新執行 — 不要進入 7.2。

### 7.1.2 tier1-mappings.json 驗證

**Required Schema**：`sourceTerm`, `targetField`, `confidence`, `scope=UNIVERSAL`

```bash
# Command
MAPPINGS_FILE="${PROJECT_ROOT}/prisma/seed-data/reference/tier1-mappings.json"

# 1. 數量範圍 50-200
MAPPINGS_COUNT=$(jq 'length' ${MAPPINGS_FILE})
[[ ${MAPPINGS_COUNT} -ge 50 && ${MAPPINGS_COUNT} -le 200 ]] || { echo "FAIL: count ${MAPPINGS_COUNT} out of [50,200]"; exit 1; }

# 2. 必填欄位
jq -e 'all(.[]; has("sourceTerm") and has("targetField") and has("confidence") and has("scope"))' \
  ${MAPPINGS_FILE} || { echo "FAIL: missing required fields"; exit 1; }

# 3. scope 必須全部為 UNIVERSAL（嚴禁 Tier 2 混入）
NON_UNIVERSAL=$(jq '[.[] | select(.scope != "UNIVERSAL")] | length' ${MAPPINGS_FILE})
[[ ${NON_UNIVERSAL} -eq 0 ]] || { echo "FAIL: ${NON_UNIVERSAL} non-UNIVERSAL rules detected — Tier 2 forbidden in seed"; exit 1; }

# 4. confidence >= 0.8（Tier 1 品質門檻）
LOW_CONF=$(jq '[.[] | select(.confidence < 0.8)] | length' ${MAPPINGS_FILE})
[[ ${LOW_CONF} -eq 0 ]] || { echo "FAIL: ${LOW_CONF} mappings below 0.8 confidence"; exit 1; }
```

**Expected Output**：`MAPPINGS_COUNT` 在 [50,200]，無非 UNIVERSAL 規則，無低信心度條目。

**If Fails**：若有 Tier 2 規則混入，**必須**從 JSON 中移除（Tier 2 屬於上線後學習範疇，見 7.8）。

### 7.1.3 prompt-configs.json 驗證

**Required Schema**：`stage`, `promptText`, `modelName`, `temperature`

```bash
# Command
PROMPTS_FILE="${PROJECT_ROOT}/prisma/seed-data/reference/prompt-configs.json"

# 1. 數量 3-10
PROMPTS_COUNT=$(jq 'length' ${PROMPTS_FILE})
[[ ${PROMPTS_COUNT} -ge 3 && ${PROMPTS_COUNT} -le 10 ]] || { echo "FAIL: count out of [3,10]"; exit 1; }

# 2. 三個 stage 必須都有對應 prompt
for STAGE in STAGE_1_COMPANY STAGE_2_FORMAT STAGE_3_FIELD; do
  HAS_STAGE=$(jq --arg s "${STAGE}" '[.[] | select(.stage == $s)] | length' ${PROMPTS_FILE})
  [[ ${HAS_STAGE} -ge 1 ]] || { echo "FAIL: missing prompt for ${STAGE}"; exit 1; }
done

# 3. temperature 範圍 0.0-1.0
jq -e 'all(.[]; .temperature >= 0 and .temperature <= 1)' ${PROMPTS_FILE} \
  || { echo "FAIL: temperature out of range"; exit 1; }
```

**Expected Output**：3 個 stage 各至少 1 筆，temperature 全部在合法範圍。

### 7.1.4 exchange-rates.json 驗證

**Required Schema**：`fromCurrency`, `toCurrency`, `rate`, `effectiveDate`

```bash
# Command
RATES_FILE="${PROJECT_ROOT}/prisma/seed-data/reference/exchange-rates.json"

# 1. 數量 5-20
RATES_COUNT=$(jq 'length' ${RATES_FILE})
[[ ${RATES_COUNT} -ge 5 && ${RATES_COUNT} -le 20 ]] || { echo "FAIL: count out of [5,20]"; exit 1; }

# 2. 必填欄位 + rate > 0
jq -e 'all(.[]; has("fromCurrency") and has("toCurrency") and has("rate") and has("effectiveDate") and .rate > 0)' \
  ${RATES_FILE} || { echo "FAIL: schema or rate invalid"; exit 1; }

# 3. effectiveDate 為 ISO-8601
jq -e 'all(.[]; .effectiveDate | test("^\\d{4}-\\d{2}-\\d{2}"))' \
  ${RATES_FILE} || { echo "FAIL: effectiveDate not ISO-8601"; exit 1; }
```

**Expected Output**：所有 4 份 JSON 通過驗證。

---

## 📋 Action 7.2: 確認 Lock 機制（避免重複執行）

**目的**：檢查 `flags.reference_seed_executed`，防止覆寫已存在的 prod 資料。

```bash
# Command
STATE_FILE="${PROJECT_ROOT}/deployment-state/uat.yaml"
LOCK=$(yq '.flags.reference_seed_executed' ${STATE_FILE})

if [[ "${LOCK}" == "true" ]]; then
  echo "🛑 Reference seed has already been executed."
  echo "    Executed at: $(yq '.flags.reference_seed_executed_at' ${STATE_FILE})"
  echo "    STOP. Re-running will overwrite prod data."
  exit 1
fi

echo "✅ Lock not set — safe to proceed."
```

**Expected Output**：`Lock not set` 訊息。

**If Fails（lock 已為 true）**：**立即停止**。如確實需要強制覆寫（極罕見情境，例如 reference data 集體更新），走以下緊急流程：

> ### 🆘 緊急覆寫流程（極罕見，需 app-team-lead + DBA 雙簽）
> 1. 取得 app-team-lead 書面 approval（mail / Teams 截圖存檔）
> 2. 完整 backup 當前所有 reference tables（不限於本 STEP 範圍）
> 3. 手動 reset flag：`yq -i '.flags.reference_seed_executed = false' ${STATE_FILE}`
> 4. 在 `failures` 區塊記錄強制覆寫原因 + approval 文件路徑
> 5. 重新執行 Action 7.3 起後續流程

---

## 📋 Action 7.3: 預先 Backup 當前資料

**目的**：即使 UAT 第一次執行（資料應為空），也必須建立 backup 作為回滾保險。

```bash
# Command
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${PROJECT_ROOT}/backups"
BACKUP_FILE="${BACKUP_DIR}/pre-seed-reference-${TIMESTAMP}.sql"
mkdir -p ${BACKUP_DIR}

# pg_dump 限定相關 tables（不要整 DB dump，避免 backup 過大）
pg_dump "${DATABASE_URL}" \
  --table=companies \
  --table=mapping_rules \
  --table=prompt_configs \
  --table=exchange_rates \
  --data-only \
  --no-owner \
  --no-privileges \
  > ${BACKUP_FILE}

# 驗證 backup 檔案存在且大小 > 0
[[ -s ${BACKUP_FILE} ]] && echo "✅ Backup created: ${BACKUP_FILE}"
ls -lh ${BACKUP_FILE}
```

**Expected Output**：
```
✅ Backup created: backups/pre-seed-reference-20260513-093000.sql
-rw-r--r-- 1 user user 2.4K May 13 09:30 backups/pre-seed-reference-20260513-093000.sql
```

**If Fails**：
- `pg_dump` 連線失敗 → 確認 `DATABASE_URL` + 網路 / Firewall（與 STEP-05 同源）
- 表不存在 → 確認 STEP-05 migration 已完成

---

## 📋 Action 7.4: ⚠️ APPROVAL GATE（人類確認）

**此 Action 為強制 Approval Gate — AI 助手必須暫停，等待 app-team-lead 書面確認後才可進入 7.5。**

AI 助手必須輸出以下訊息給人類：

```markdown
## ⚠️ APPROVAL REQUIRED — STEP-07 Action 7.5

**即將執行**：`PRISMA_SEED_PROD_ALLOW=true npx ts-node prisma/seed-prod-reference.ts --confirm`

**影響範圍**（依 7.1 驗證結果）：
  - Companies：載入 ${COMPANIES_COUNT} 間
  - Tier 1 Mappings：載入 ${MAPPINGS_COUNT} 條（全部 scope=UNIVERSAL）
  - Prompt Configs：載入 ${PROMPTS_COUNT} 筆
  - Exchange Rates：載入 ${RATES_COUNT} 筆

**不可逆性**：
  - ✅ 可透過 7.3 backup 還原（pg_restore）
  - ⚠️ 但代價大 — 還原會清空當前資料 + 重新跑業務驗證

**Backup 已建立**：`${BACKUP_FILE}`

**Approver**：app-team-lead

請確認後回覆 `yes` 繼續，或 `no` 中止並查問題。
```

**等待人類回應**：
- `yes` → 進入 Action 7.5
- `no` → 中止本 STEP，記錄 `failures` 並回退到 STEP-06 完成狀態

---

## 📋 Action 7.5: 執行 Reference Seed

**目的**：實際執行 `seed-prod-reference.ts`，雙保險（環境變數 + flag）防呆。

```bash
# Command
cd ${PROJECT_ROOT}

# 雙保險：環境變數 PRISMA_SEED_PROD_ALLOW + CLI --confirm flag
PRISMA_SEED_PROD_ALLOW=true npx ts-node prisma/seed-prod-reference.ts --confirm 2>&1 | tee \
  "${PROJECT_ROOT}/logs/seed-reference-${TIMESTAMP}.log"

SEED_EXIT_CODE=${PIPESTATUS[0]}
[[ ${SEED_EXIT_CODE} -eq 0 ]] || { echo "FAIL: seed exit code ${SEED_EXIT_CODE}"; exit 1; }
```

**Expected Output**（範例）：
```
[seed-prod-reference] Loading companies.json (8 records)...
[seed-prod-reference] Inserted 8 companies.
[seed-prod-reference] Loading tier1-mappings.json (75 records)...
[seed-prod-reference] Inserted 75 mapping rules (scope=UNIVERSAL).
[seed-prod-reference] Loading prompt-configs.json (5 records)...
[seed-prod-reference] Inserted 5 prompt configs.
[seed-prod-reference] Loading exchange-rates.json (12 records)...
[seed-prod-reference] Inserted 12 exchange rates.
[seed-prod-reference] ✅ Done in 47s.
```

**預計執行時間**：1-3 分鐘。

**If Fails**：
- ❌ **不可直接 retry** — 部分資料可能已寫入，retry 會造成 unique constraint violation
- ✅ 正確流程：
  1. 檢查 log 確認失敗點
  2. `pg_restore` 從 7.3 backup 還原（清空已部分寫入的資料）
  3. 修正 JSON 或 seed script
  4. 重新從 Action 7.3 開始

---

## 📋 Action 7.6: 驗證資料 Count + Sample Check

**目的**：比對資料庫實際 count 與 JSON 預期一致，並抽樣驗證內容正確。

### 7.6.1 Count 驗證

```bash
# Command
psql "${DATABASE_URL}" <<EOF
SELECT 'companies' AS table_name, count(*) FROM companies
UNION ALL
SELECT 'tier1_mappings', count(*) FROM mapping_rules WHERE scope = 'UNIVERSAL'
UNION ALL
SELECT 'tier2_mappings', count(*) FROM mapping_rules WHERE scope = 'COMPANY_SPECIFIC'
UNION ALL
SELECT 'prompt_configs', count(*) FROM prompt_configs
UNION ALL
SELECT 'exchange_rates', count(*) FROM exchange_rates;
EOF
```

**Expected Output**：
```
   table_name    | count
-----------------+-------
 companies       |     8     ← 與 COMPANIES_COUNT 一致
 tier1_mappings  |    75     ← 與 MAPPINGS_COUNT 一致
 tier2_mappings  |     0     ← 必須為 0（Tier 2 不在 seed 範圍）
 prompt_configs  |     5     ← 與 PROMPTS_COUNT 一致
 exchange_rates  |    12     ← 與 RATES_COUNT 一致
```

**🔴 關鍵驗證**：`tier2_mappings = 0`。若有任何非 0 數字，代表 seed 邏輯或 JSON 有 bug，立即停止並 review。

### 7.6.2 Sample Check（抽樣比對 JSON ↔ DB）

```bash
# 抽 3 筆 company
psql "${DATABASE_URL}" -c "SELECT name, region, city_code, status FROM companies LIMIT 3;"

# 抽 5 筆 tier 1 mapping
psql "${DATABASE_URL}" -c "SELECT source_term, target_field, confidence, scope FROM mapping_rules WHERE scope='UNIVERSAL' LIMIT 5;"

# 確認 prompt_configs 連到正確 stage
psql "${DATABASE_URL}" -c "SELECT stage, model_name, temperature FROM prompt_configs ORDER BY stage;"

# 確認 exchange_rates 在 effectiveDate 範圍內
psql "${DATABASE_URL}" -c "SELECT from_currency, to_currency, rate, effective_date FROM exchange_rates WHERE effective_date <= NOW() ORDER BY effective_date DESC LIMIT 5;"
```

**Expected Output**：
- Companies sample 3 筆 → 比對 JSON 對應 records 內容相符
- Mappings sample 5 筆 → 全部 `scope=UNIVERSAL`，confidence ≥ 0.8
- Prompt configs → 出現 `STAGE_1_COMPANY` / `STAGE_2_FORMAT` / `STAGE_3_FIELD` 三個 stage
- Exchange rates → effective_date 全部 ≤ NOW()

**If Fails**：count 不符或 sample 內容異常 → 不要繼續 7.7（不可寫入 lock），先排查 seed 邏輯。

---

## 📋 Action 7.7: 設置 Lock + 寫入 State File

**目的**：標記 reference seed 已執行，防止後續部署重複執行。

```bash
# Command
NOW_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
STATE_FILE="${PROJECT_ROOT}/deployment-state/uat.yaml"

# 1. 設置 lock flag + 時間戳
yq -i ".flags.reference_seed_executed = true" ${STATE_FILE}
yq -i ".flags.reference_seed_executed_at = \"${NOW_ISO}\"" ${STATE_FILE}

# 2. 寫入各類資料 count（從 7.6.1 取得）
yq -i ".resources.reference_seed.companies_count = ${COMPANIES_COUNT}" ${STATE_FILE}
yq -i ".resources.reference_seed.tier1_mappings_count = ${MAPPINGS_COUNT}" ${STATE_FILE}
yq -i ".resources.reference_seed.prompt_configs_count = ${PROMPTS_COUNT}" ${STATE_FILE}
yq -i ".resources.reference_seed.exchange_rates_count = ${RATES_COUNT}" ${STATE_FILE}
yq -i ".resources.reference_seed.backup_file = \"${BACKUP_FILE}\"" ${STATE_FILE}

# 3. Append 到 steps_completed + 更新 next_step
yq -i ".steps_completed += [{\"step_id\": \"STEP-07\", \"completed_at\": \"${NOW_ISO}\", \"status\": \"success\"}]" ${STATE_FILE}
yq -i ".next_step = \"STEP-08\"" ${STATE_FILE}
yq -i ".metadata.last_updated = \"${NOW_ISO}\"" ${STATE_FILE}
```

**Verify**：
```bash
yq '.flags.reference_seed_executed' ${STATE_FILE}     # 預期 true
yq '.resources.reference_seed' ${STATE_FILE}          # 預期顯示 4 個 count
yq '.next_step' ${STATE_FILE}                          # 預期 STEP-08
```

**Expected Output**：所有欄位皆符合預期。

---

## 📋 Action 7.8: 文件化 Tier 2 後續策略（重要提醒）

> **此 Action 不執行命令，但必須讓人類 + AI 助手清楚理解 Tier 2 的建立路徑。**

### Tier 2 不進 Seed — 為什麼？

| 理由 | 說明 |
|------|------|
| **資料尚未確定** | 每間 Forwarder 5-10 條 override，會隨實際文件樣本演化 |
| **避免覆寫** | Seed re-run 會蓋掉學習中的 rules |
| **品質保證** | Tier 2 必須由實際使用者修正驗證，不應是工程師憑空 seed |

### Tier 2 透過上線後機制建立（1-3 個月學習期）

```
1. V3.1 智能降級保護
   └─ 新公司 → 強制 FULL_REVIEW（不讓 AI 自動通過）

2. 審核員手動修正
   └─ 系統記錄為候選 rule（不立即寫入 mapping_rules 表）

3. rule-suggestion-generator 累積樣本
   └─ 同一 sourceTerm 被修正 3+ 次後，提示 admin 加入 Tier 2

4. Admin 審核通過
   └─ 寫入 mapping_rules 表，scope=COMPANY_SPECIFIC

5. 穩定後（可選）
   └─ Prod 已驗證的 Tier 2 rules 可匯出 JSON，作為下一環境（DR / 新區域）的 seed
```

### AI 助手 / Reviewer 提醒

- ❌ **永遠不要**為了「補完 Tier 2」而手動寫 SQL 直接 INSERT — 會繞過學習機制 + 跳過審核
- ✅ Tier 2 的正確建立路徑只有「使用者修正 → suggestion → admin approve」
- ✅ Tier 1 也不從 Admin UI 動態增加（變更 reference 走 PR + 下次手動 seed-reference 的代價）

---

## ✅ Exit Criteria

進入 STEP-08 前，全部勾選：

- [ ] Action 7.1：4 份 reference JSON 全部通過 schema 驗證
- [ ] Action 7.2：lock flag 確認為 false（首次執行）
- [ ] Action 7.3：backup 檔案已建立且大小 > 0
- [ ] Action 7.4：app-team-lead 已書面 approve
- [ ] Action 7.5：seed 執行 exit code = 0
- [ ] Action 7.6：DB count 與 JSON 一致 + Tier 2 為 0 + sample check 通過
- [ ] Action 7.7：state file `flags.reference_seed_executed = true` + counts 已寫入
- [ ] Action 7.8：團隊已理解 Tier 2 不進 seed 的設計

→ 進入 **`08-first-deployment.md`**

---

## 🤖 AI Execution Hint（給 AI 助手的特別提示）

- **Approval Gate（Action 7.4）必須暫停** — 不可自行 confirm，必須等人類回覆 `yes`
- **執行前必檢查 lock**（7.2）— `flags.reference_seed_executed=true` 立刻停止
- **失敗時不要 retry seed**（7.5）— 必須先 `pg_restore` 還原，否則 unique constraint 會堆積
- **Tier 2 計數驗證是硬規則**（7.6.1）— `mapping_rules WHERE scope='COMPANY_SPECIFIC'` 必須為 0
- **Tier 2 學習路徑不要繞過**（7.8）— 任何「幫使用者預先 seed Tier 2」的提議都應拒絕

---

*文件版本: v1.0（階段 C 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
