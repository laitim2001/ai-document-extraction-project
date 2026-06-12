---
document_type: deployment_procedure
step_id: STEP-01
title: Prerequisites Verification（前置條件檢查）
estimated_duration: 30-45 minutes
requires_approval: false
approver: none
environment: uat
status: ✅ 完整內容（v0.3 階段 B）
prerequisites:
  - STEP-00 已閱讀並理解 Mode C 邊界
  - Infra Team handoff 文件已收到
outputs:
  - prerequisites_check_passed: true|false
  - infra_handoff_validated: true|false
  - deployment_state_file_initialized: true|false
  - missing_items: []
---

# STEP-01: Prerequisites Verification（前置條件檢查）

> **目的**：在執行任何資源建立前，徹底驗證所有環境前提條件，避免中途失敗。
>
> **重要原則**：本 STEP 全為**唯讀檢查**，不會修改任何 Azure 資源。任何檢查失敗都不會造成損害。

---

## 🎯 1. Objective

確認以下 7 大類前置條件全部就緒：
1. 本地工具版本
2. Azure 帳號與權限
3. Subscription 與 Quota
4. Infra Team handoff 完整性
5. 應用程式碼準備度
6. CHANGE-056 baseline 就緒
7. Reference data JSON 就緒

任一項失敗 → **不可進入 STEP-02**。

---

## ✅ 2. Prerequisites Checklist（總覽）

```
□ 工具：Azure CLI / Docker / Node / Prisma / jq 安裝且版本符合
□ 帳號：az login 成功 + 正確 subscription + Contributor role
□ Quota：CPU / Memory / DB / Public IP 額度足夠
□ Infra：RG / VNet / 共享 KV / Log Analytics handoff 收到
□ 代碼：Dockerfile / next.config standalone / verify-environment 通過
□ DB 基線：prisma/migrations/0001_initial_baseline 存在（CHANGE-056）
□ Seed Data：seed-prod-essential.ts + seed-prod-reference.ts + reference JSON 就緒
```

---

## 🔧 3. Action 1.1: 本地工具檢查

### Command
```bash
# 取得各工具版本
az version --output json
docker --version
node --version
npm --version
npx prisma --version
jq --version
git --version
```

### Verify
```bash
# 檢查每個工具是否符合最低版本
az version --output json | jq -r '."azure-cli"'
node --version | sed 's/v//' | awk -F. '{print ($1 >= 20)}'
docker --version | grep -oP 'Docker version \K[0-9]+'
```

### Expected Output

| 工具 | 最低版本 | 預期 |
|------|---------|------|
| Azure CLI | 2.50+ | `2.50.0` 或更新 |
| Docker | 24.0+ | `24.0.0` 或更新 |
| Node.js | 20.x | `v20.0.0` 或更新 |
| npm | 10.x | `10.0.0` 或更新 |
| Prisma | 7.2.x | `7.2.0` 或更新 |
| jq | 1.6+ | `jq-1.6` 或更新 |
| git | 2.40+ | `git version 2.40.0` 或更新 |

### If Fails
- Azure CLI 缺失 → `winget install Microsoft.AzureCLI` (Windows) 或 `brew install azure-cli` (Mac)
- Docker 缺失 → 安裝 Docker Desktop
- Node 版本太低 → `nvm install 20 && nvm use 20`
- Prisma 缺失 → `npm install --no-save prisma@7.2.0`
- jq 缺失 → `winget install jqlang.jq` 或 `brew install jq`

---

## 🔧 4. Action 1.2: Azure 帳號與權限

### Command
```bash
# 登入 Azure（若未登入）
az login --tenant ${TENANT_ID}

# 切換到目標 subscription
az account set --subscription ${SUBSCRIPTION_ID}

# 顯示當前身分
az account show --output json
```

### Verify
```bash
# 驗證 subscription
az account show --query "id" -o tsv

# 驗證對 RG 的角色（必須有 Contributor）
az role assignment list \
  --assignee $(az account show --query "user.name" -o tsv) \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}" \
  --output json | jq -r '.[].roleDefinitionName'
```

### Expected Output
```
# subscription id 應與 ${SUBSCRIPTION_ID} 一致
<your-subscription-id>

# Role 應包含 "Contributor" 或 "Owner"
Contributor
```

### If Fails
- `Subscription not found` → 確認 SUBSCRIPTION_ID 拼字 + 是否已 invite
- 無 Contributor role → 聯繫 Infra Admin 加入 RBAC

---

## 🔧 5. Action 1.3: Subscription Quota 檢查

### Command
```bash
# 檢查目標 region 的 quota
az vm list-usage --location ${LOCATION} --output table

# 檢查 PostgreSQL Flexible Server quota
az postgres flexible-server list-skus --location ${LOCATION} --output table | head -20

# 檢查 Container Apps Environment quota
az containerapp env list --query "length(@)"
```

### Verify
```bash
# 重點關注以下 limit（>= App 層需求）
# - Total Regional vCPUs：>= 4
# - Standard ESv5 Family vCPUs：>= 2（DB 用）
# - Public IP Addresses Standard：>= 2
```

### Expected Output
- vCPU 可用數：>= 4
- DB SKU 在清單中：`Standard_B2s` 或 `Standard_D2ds_v5`
- 無「Quota exceeded」訊息

### If Fails
- Quota 不足 → 透過 Azure Portal 提交 quota increase request（通常 1-2 個工作天）
- DB SKU 不可用 → 換 region 或聯繫 Infra Admin

---

## 🔧 6. Action 1.4: Infra Team Handoff 驗證

### Command
```bash
# 確認 handoff 文件存在
INFRA_HANDOFF_FILE="${PROJECT_ROOT}/infra-handoff/uat.yaml"
test -f "${INFRA_HANDOFF_FILE}" && echo "OK: handoff file exists" || echo "MISSING"

# 解析 handoff 並驗證 RG 存在
RG_FROM_HANDOFF=$(yq '.resource_group.name' "${INFRA_HANDOFF_FILE}")
az group show --name "${RG_FROM_HANDOFF}" --output json
```

### Verify

**Handoff 文件必須包含**：
```yaml
# infra-handoff/uat.yaml
resource_group:
  name: rg-ai-document-extraction-uat
  location: southeastasia
  app_team_role: Contributor

# 至少 ONE OF 以下兩種 KV 配置：
shared_key_vault:                # Option A: 共享 KV
  name: <name>
  uri: <uri>
  app_team_secret_permissions: [Get, List, Set]
# OR
app_team_owns_kv: true           # Option B: App Team 自建 KV

log_analytics:
  workspace_id: <id>

network:
  vnet_id: <id> | "managed-by-container-apps"  # 若用 Managed VNet
  ingress_type: external | internal
```

### Expected Output
- Handoff 文件存在
- RG 在 Azure 可見且 provisioningState=Succeeded
- 所有必要欄位齊全

### If Fails
- Handoff 缺失 → 聯繫 Infra Team 補交（這是 STEP-02 開工的硬性條件）
- RG 不存在 → Infra Team 尚未建立，不可繼續

---

## 🔧 7. Action 1.5: 應用程式碼準備度

### Command
```bash
cd ${PROJECT_ROOT}

# 檢查 Dockerfile 存在
test -f Dockerfile && echo "OK" || echo "MISSING Dockerfile"

# 檢查 next.config.ts 已啟用 standalone
grep -q "output.*standalone" next.config.ts && echo "OK: standalone enabled" || echo "MISSING: standalone"

# 執行本地 verify-environment（CHANGE-054 機制）
npm run verify-environment 2>&1 | tail -20

# 確認 git 狀態
git status --porcelain | wc -l  # 預期 0（clean）或可控的 staged 變更
git rev-parse --short HEAD
```

### Verify
```bash
# Dockerfile multi-stage 結構驗證
grep -c "^FROM" Dockerfile  # 預期 >= 3（deps / builder / runner）

# package.json 必要 script
jq -r '.scripts."verify-environment"' package.json
jq -r '.scripts."i18n:check"' package.json
```

### Expected Output
- `Dockerfile` 存在且含 multi-stage（>= 3 個 FROM）
- `next.config.ts` 含 `output: 'standalone'`
- `verify-environment` 通過（或 known-issues 已記錄）
- Git working tree clean 或只有 expected staged 變更

### If Fails
- Dockerfile 缺失 → 此為 Phase 2 的 STEP-04 前置產出，CHANGE-055 Phase 2 必須先完成 Dockerfile
- standalone 未啟用 → 修改 `next.config.ts` 加入 `output: 'standalone'`
- verify-environment 失敗 → 修復本地問題（CHANGE-054 自檢腳本會列出具體問題）

---

## 🔧 8. Action 1.6: CHANGE-056 Migration Baseline 就緒

### Command
```bash
# 檢查 baseline migration 存在
ls prisma/migrations/

# 確認 baseline 命名（應為 0001_initial_baseline 或同等）
test -d prisma/migrations/0001_initial_baseline && echo "OK" || echo "MISSING baseline"

# 確認舊 migrations 已歸檔
test -d prisma/migrations/_archive && ls prisma/migrations/_archive/ | wc -l
```

### Verify
- `prisma/migrations/0001_initial_baseline/migration.sql` 存在
- `prisma/migrations/_archive/` 包含 10 個舊 migrations（CHANGE-056 歸檔）
- `prisma/migrations/migration_lock.toml` 存在且 provider = postgresql

### Expected Output
```
0001_initial_baseline/
_archive/        # 含 10 個 2025_* 子目錄
migration_lock.toml
```

### If Fails
- Baseline 缺失 → CHANGE-056 尚未實施，**必須先完成 CHANGE-056** 才能執行 STEP-05 migration
- 舊 migrations 未歸檔 → CHANGE-056 PoC 不完整

---

## 🔧 9. Action 1.7: Reference Data JSON 就緒

### Command
```bash
# 檢查 prod-grade reference data 存在
ls prisma/seed-data/reference/

REF_DIR="prisma/seed-data/reference"
test -f "${REF_DIR}/companies.json" && echo "companies: OK"
test -f "${REF_DIR}/tier1-mappings.json" && echo "mappings: OK"
test -f "${REF_DIR}/prompt-configs.json" && echo "prompts: OK"
test -f "${REF_DIR}/exchange-rates.json" && echo "rates: OK"

# 計算 record 數量
jq 'length' "${REF_DIR}/companies.json"
jq 'length' "${REF_DIR}/tier1-mappings.json"
```

### Verify

| 檔案 | 預期 record 數（Pilot）| Schema 驗證 |
|------|---------------------|------------|
| `companies.json` | 5-10（Pilot），≤100（Full） | 含 name / region / cityCode |
| `tier1-mappings.json` | 50-100（Pilot），50-200（Full） | 含 sourceTerm / targetField / confidence |
| `prompt-configs.json` | 3-10 | 含 stage / promptText |
| `exchange-rates.json` | 5-20 | 含 fromCurrency / toCurrency / rate |

### Expected Output
- 4 個檔案全部存在
- record 數量在預期範圍內
- JSON schema 驗證通過

### If Fails
- Reference JSON 缺失 → 需先在 CHANGE-055 Phase 2.7 完成（手動整理 prod-grade JSON）
- record 數量異常 → review reference data 整理品質

---

## 🔧 10. Action 1.8: 初始化 Deployment State File

### Command
```bash
mkdir -p "${PROJECT_ROOT}/deployment-state"
touch "${PROJECT_ROOT}/deployment-state/.gitkeep"

# 確認 .gitignore 排除 *.yaml in deployment-state
grep -q "deployment-state/\*\.yaml" "${PROJECT_ROOT}/.gitignore" && echo "OK: gitignored" || \
  echo "deployment-state/*.yaml" >> "${PROJECT_ROOT}/.gitignore"

# 建立初始 state file
cat > "${PROJECT_ROOT}/deployment-state/uat.yaml" <<EOF
metadata:
  environment: uat
  started_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
  last_updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
  executed_by: ${USER:-ai-assistant}

steps_completed: []

resources: {}

flags:
  reference_seed_executed: false
  smoke_test_passed: false

failures: []

next_step: STEP-02
EOF

echo "OK: state file initialized"
cat "${PROJECT_ROOT}/deployment-state/uat.yaml"
```

### Verify
- `deployment-state/uat.yaml` 已建立
- `.gitignore` 已排除 `deployment-state/*.yaml`
- `next_step` 為 `STEP-02`

### Expected Output
state file 結構符合 `00-overview.md` §6.2 規格。

### If Fails
- 寫入權限錯誤 → 檢查 PROJECT_ROOT 是否正確

---

## 📊 11. Prerequisites 總結報告

完成 Action 1.1 ~ 1.8 後，AI 助手或人類執行者應產出總結：

```yaml
# 寫入 deployment-state/uat.yaml 的 steps_completed
- step_id: STEP-01
  completed_at: <ISO timestamp>
  status: success
  checks:
    tools_versions: pass
    azure_authentication: pass
    quota_check: pass
    infra_handoff: pass
    code_readiness: pass
    migration_baseline: pass
    reference_data: pass
    state_file: initialized
  notes:
    - <任何特殊發現>
```

---

## 🤖 12. AI Execution Hint

當 AI 助手執行此 STEP：

1. **依序執行 Action 1.1 → 1.8**，每個 Action 後立即 verify
2. 若任一 Action fail：
   - 寫入 `failures` 區段
   - **停止執行**，回報給人類，不可繼續 STEP-02
3. 若 Quota 申請需等 1-2 天 → 標記 STEP-01 為 `partial`，繼續其他 actions，最後總結未完項
4. **不要修改任何 Azure 資源**（本 STEP 全 read-only）
5. 完成後寫入 state file，並向人類確認可進入 STEP-02

---

## ✅ 13. Exit Criteria

- [ ] Action 1.1 ~ 1.8 全部 pass
- [ ] `deployment-state/uat.yaml` 已建立且 step STEP-01 狀態為 success
- [ ] 無 Critical / High blocker
- [ ] 已知 minor issues 已記錄但不阻塞
- [ ] **進入 `02-azure-resources-setup.md`**

---

*文件版本: v1.0（階段 B 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
