# Manual Setup Checklist（Mode B 後備路徑）

> **狀態**：✅ 完整內容（v1.0 階段 D）
> **定位**：**Mode B 後備路徑** — 不採用 Bicep 時的手動 az CLI / Portal 對照清單
> **建立日期**：2026-04-27
> **適用環境**：UAT（Prod 變數對應 §3 開頭表格）

---

## 🎯 §1 文件目的

此文件是 **CHANGE-055 v0.3 三種使用模式中的 Mode B 後備路徑**：當 Infra Team **不採用 Bicep**，改以 Azure Portal 點擊操作或自有 CLI / Terraform pipeline 手動建立應用層資源時的對照清單。

**設計原則**：
- ✅ 與 `bicep/main.bicep` **語義上完全等價**（建立的資源、配置、tag 一致）
- ✅ 對應到 `../uat-deployment/02-azure-resources-setup.md` 每個 Action 的詳細命令
- ✅ Markdown checkbox 格式，可直接 fork 為個人 / 團隊執行追蹤清單
- ✅ 每個資源標註對應的 Bicep module 路徑，方便雙向比對

> **本檔不重寫詳細命令** — 詳細 az CLI 命令、verify 步驟、failure handling 請看 STEP-02。本檔聚焦 checklist + 對照表。

---

## 🤝 §2 適用情境

| 情境 | 為何採用 Mode B | 行動指引 |
|------|---------------|---------|
| Infra Team 偏好 Azure Portal 點擊操作 | 已建立 SOP / 不引入新工具（Bicep）| 用 §3 checklist 逐項在 Portal 對照建立 |
| Infra Team 用既有 CI/CD pipeline | 已有 Terraform / 自定 PowerShell pipeline | 將 Bicep 作為 spec 參考翻譯，§3 作為驗收清單 |
| 緊急情境：需快速重建單一資源 | DR / 誤刪復原，不想跑整個 Bicep | 找出對應節跑單一 az 命令 |
| Infra Team 已建好部分資源 | Mode C Hybrid 場景 | 標記已建項目 + 跳過，只跑剩餘 |

> **Mode A（推薦）**：直接跑 `bicep/main.bicep`（見 `../README.md` §4）。
> **Mode C（Hybrid）**：部分 Bicep + 部分 manual，視 Infra Team 既有資源狀況決定。

---

## ✅ §3 全資源 Checklist

> **環境變數約定**：以下命令引用 `${RG_NAME}` / `${ACR_NAME}` 等變數，定義於 `../uat-deployment/00-overview.md` §5。
>
> **UAT vs Prod 變數對照**：
>
> | 變數 | UAT 值 | Prod 值（預留）|
> |------|--------|--------------|
> | `${RG_NAME}` | `rg-ai-document-extraction-uat` | `rg-ai-document-extraction-prod` |
> | `${ACR_NAME}` | `acraidocextractuat` | `acraidocextractprod` |
> | `${POSTGRES_NAME}` | `psql-aidocextract-uat` | `psql-aidocextract-prod` |
> | `${STORAGE_NAME}` | `staidocextractuat` | `staidocextractprod` |
> | `${KV_NAME}` | `kv-aidocextract-uat` | `kv-aidocextract-prod` |
> | `${CAE_NAME}` | `cae-aidocextract-uat` | `cae-aidocextract-prod` |
> | `${CA_NAME}` | `ca-aidocextract-uat` | `ca-aidocextract-prod` |
> | `${APP_INSIGHTS_NAME}` | `appi-aidocextract-uat` | `appi-aidocextract-prod` |
> | `${LOCATION}` | `southeastasia` | `southeastasia` |
>
> 完整命名規則見：`../naming-conventions.md`

---

### 1. Azure Container Registry（ACR）

- [ ] 1.1 建立 ACR（Standard tier, admin disabled）
  ```bash
  az acr create \
    --resource-group "${RG_NAME}" --name "${ACR_NAME}" \
    --sku Standard --admin-enabled false \
    --location "${LOCATION}" \
    --tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction
  ```
- [ ] 1.2 驗證 `adminUserEnabled=false`（強制走 Managed Identity）
  ```bash
  az acr show -n "${ACR_NAME}" -g "${RG_NAME}" --query "adminUserEnabled" -o tsv
  # 預期: false
  ```
- [ ] 1.3 取得 `loginServer` 並記錄
  ```bash
  az acr show -n "${ACR_NAME}" -g "${RG_NAME}" --query "loginServer" -o tsv
  # 預期: acraidocextractuat.azurecr.io
  ```
- [ ] 1.4 寫入 `deployment-state/uat.yaml`（`resources.acr.login_server`）
- ⏱️ **預估時間**: 2-3 分鐘
- 📜 **對應 Bicep**: `bicep/modules/acr.bicep`
- 📚 **詳細命令**: `../uat-deployment/02-azure-resources-setup.md` Action 2.2

---

### 2. PostgreSQL Flexible Server

- [ ] 2.1 安全取得 admin password（不要 hardcode 到 script）
  ```bash
  read -s -p "Enter PostgreSQL admin password (min 12 chars, mixed case + digit + symbol): " PG_ADMIN_PASSWORD
  echo
  ```
- [ ] 2.2 建立 PostgreSQL Flexible Server（B2s Burstable, PG 15, 7-day backup）
  ```bash
  az postgres flexible-server create \
    --resource-group "${RG_NAME}" --name "${POSTGRES_NAME}" \
    --location "${LOCATION}" \
    --tier Burstable --sku-name Standard_B2s \
    --version 15 --storage-size 32 --storage-auto-grow Enabled \
    --backup-retention 7 --geo-redundant-backup Disabled \
    --high-availability Disabled \
    --admin-user pgadmin --admin-password "${PG_ADMIN_PASSWORD}" \
    --tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction \
    --yes
  unset PG_ADMIN_PASSWORD  # 立即清除 shell 變數
  ```
- [ ] 2.3 Polling 直到 `state=Ready`（典型 5-15 分鐘，最長 20 分鐘）
  ```bash
  az postgres flexible-server show -g "${RG_NAME}" -n "${POSTGRES_NAME}" --query "state" -o tsv
  # 預期: Ready
  ```
- [ ] 2.4 取得 FQDN 並記錄（`resources.postgres.fqdn`）
  ```bash
  az postgres flexible-server show -g "${RG_NAME}" -n "${POSTGRES_NAME}" \
    --query "fullyQualifiedDomainName" -o tsv
  # 預期: psql-aidocextract-uat.postgres.database.azure.com
  ```
- [ ] 2.5 確認 `version=15` / `tier=Burstable` / `backupRetention=7`
- [ ] 2.6 寫入 `deployment-state/uat.yaml`（不寫入 password — 留待 STEP-03 寫入 KV）
- ⏱️ **預估時間**: 5-15 分鐘（PG 建立為主要瓶頸）
- 📜 **對應 Bicep**: `bicep/modules/postgres.bicep`
- 📚 **詳細命令**: `../uat-deployment/02-azure-resources-setup.md` Action 2.4
- ⚠️ **絕對禁止**：`--public-network-access Enabled` 在 prod 不可開（UAT 開但須 IP allowlist）

---

### 3. Storage Account + Blob Container

- [ ] 3.1 建立 Storage Account（Standard_LRS, TLS 1.2, no public blob）
  ```bash
  az storage account create \
    --resource-group "${RG_NAME}" --name "${STORAGE_NAME}" \
    --location "${LOCATION}" \
    --sku Standard_LRS --kind StorageV2 --access-tier Hot \
    --min-tls-version TLS1_2 \
    --allow-blob-public-access false --allow-shared-key-access true \
    --tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction
  ```
- [ ] 3.2 啟用 Blob soft-delete（7 天）+ Container soft-delete（7 天）+ versioning
  ```bash
  az storage account blob-service-properties update \
    --resource-group "${RG_NAME}" --account-name "${STORAGE_NAME}" \
    --enable-delete-retention true --delete-retention-days 7 \
    --enable-container-delete-retention true --container-delete-retention-days 7 \
    --enable-versioning true
  ```
- [ ] 3.3 建立 `documents` container（`--auth-mode login` 走 AAD，避免取 account key）
  ```bash
  az storage container create \
    --account-name "${STORAGE_NAME}" --name documents \
    --auth-mode login --public-access off
  ```
- [ ] 3.4 驗證 `allowBlobPublicAccess=false` + `documents` container 存在
- [ ] 3.5 寫入 `deployment-state/uat.yaml`（`resources.storage.blob_endpoint`）
- ⏱️ **預估時間**: 1-2 分鐘
- 📜 **對應 Bicep**: `bicep/modules/storage.bicep`
- 📚 **詳細命令**: `../uat-deployment/02-azure-resources-setup.md` Action 2.5
- ⚠️ **絕對禁止**：`--allow-blob-public-access true` / `--public-access blob|container`

---

### 4. Container Apps Environment（CAE）

- [ ] 4.1 從 Infra handoff 取得 Log Analytics workspace customer ID + shared key
  ```bash
  LOG_ANALYTICS_CUSTOMER_ID=$(az monitor log-analytics workspace show \
    --ids "${LOG_ANALYTICS_WORKSPACE_ID}" --query "customerId" -o tsv)
  LOG_ANALYTICS_SHARED_KEY=$(az monitor log-analytics workspace get-shared-keys \
    --ids "${LOG_ANALYTICS_WORKSPACE_ID}" --query "primarySharedKey" -o tsv)
  ```
- [ ] 4.2 建立 Container Apps Environment（連 Infra 提供的 LA workspace）
  ```bash
  az containerapp env create \
    --resource-group "${RG_NAME}" --name "${CAE_NAME}" \
    --location "${LOCATION}" \
    --logs-workspace-id "${LOG_ANALYTICS_CUSTOMER_ID}" \
    --logs-workspace-key "${LOG_ANALYTICS_SHARED_KEY}" \
    --tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction
  ```
- [ ] 4.3 Polling 直到 `provisioningState=Succeeded`（典型 2-5 分鐘）
- [ ] 4.4 取得 `defaultDomain` 與 `staticIp` 並記錄
  ```bash
  az containerapp env show -g "${RG_NAME}" -n "${CAE_NAME}" \
    --query "{defaultDomain: properties.defaultDomain, staticIp: properties.staticIp}" -o json
  ```
- [ ] 4.5 寫入 `deployment-state/uat.yaml`（`resources.container_apps_env.{name,id,default_domain}`）
- ⏱️ **預估時間**: 2-5 分鐘
- 📜 **對應 Bicep**: `bicep/modules/container-apps-env.bicep`
- 📚 **詳細命令**: `../uat-deployment/02-azure-resources-setup.md` Action 2.3

---

### 5. Application Insights

- [ ] 5.1 確認 application-insights extension 已安裝
  ```bash
  az extension add --name application-insights --upgrade --yes
  ```
- [ ] 5.2 建立 App Insights（workspace-based, 連 Infra 的 LA workspace）
  ```bash
  az monitor app-insights component create \
    --resource-group "${RG_NAME}" --app "${APP_INSIGHTS_NAME}" \
    --location "${LOCATION}" \
    --workspace "${LOG_ANALYTICS_WORKSPACE_ID}" \
    --kind web --application-type web \
    --tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction
  ```
- [ ] 5.3 取得 `connectionString`（敏感，不寫入 state file plain text）
  ```bash
  APPI_CONN_STRING=$(az monitor app-insights component show \
    -g "${RG_NAME}" -a "${APP_INSIGHTS_NAME}" --query "connectionString" -o tsv)
  ```
- [ ] 5.4 驗證 connection string 格式（`InstrumentationKey=...;IngestionEndpoint=https://...`）
- [ ] 5.5 寫入 `deployment-state/uat.yaml`（`resources.app_insights.id` 即可，connection string 留待 STEP-03 寫 KV）
- ⏱️ **預估時間**: 1-2 分鐘
- 📜 **對應 Bicep**: `bicep/modules/app-insights.bicep`
- 📚 **詳細命令**: `../uat-deployment/02-azure-resources-setup.md` Action 2.6

---

### 6. Key Vault（若 App Team 自建；共享版本由 Infra Team 建）

> **二選一**：若 Infra Team 提供共享 KV，本節**跳過**並改記錄 Infra 提供的 KV URI。
> 若 App Team 自建（推薦 UAT 走此路徑），執行以下步驟。

- [ ] 6.1 建立 Key Vault（RBAC mode, soft-delete 90 天, purge protection）
  ```bash
  az keyvault create \
    --resource-group "${RG_NAME}" --name "${KV_NAME}" \
    --location "${LOCATION}" \
    --enable-rbac-authorization true \
    --enable-soft-delete true --retention-days 90 \
    --enable-purge-protection true \
    --sku standard \
    --tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction
  ```
- [ ] 6.2 驗證 `enableRbacAuthorization=true`（強制走 RBAC，不用 access policy）
- [ ] 6.3 驗證 `enablePurgeProtection=true`（誤刪保護）
- [ ] 6.4 取得 `vaultUri` 並記錄
  ```bash
  az keyvault show -n "${KV_NAME}" --query "properties.vaultUri" -o tsv
  # 預期: https://kv-aidocextract-uat.vault.azure.net/
  ```
- [ ] 6.5 寫入 `deployment-state/uat.yaml`（`resources.key_vault.uri`）
- ⏱️ **預估時間**: 1-2 分鐘
- 📜 **對應 Bicep**: 視自建決策，可加 `bicep/modules/key-vault.bicep`（目前未列入 §4 標準 6 module）
- 📚 **詳細命令**: STEP-02 為 STEP-03 預留 placeholder；實際建立放在 STEP-03 Action 3.1

---

### 7. Container App + System-Assigned Managed Identity

> **重要**：Container App 在 STEP-08 First Deployment 時建立（含初始 image），不在 STEP-02 預先建立。
> 本節是 **預先檢查清單**（在 STEP-08 執行時對照），不在 §4 順序中。

- [ ] 7.1（STEP-08 時）建立 Container App + 啟用 System-Assigned MI
  ```bash
  az containerapp create \
    --resource-group "${RG_NAME}" --name "${CA_NAME}" \
    --environment "${CAE_NAME}" \
    --image "${ACR_LOGIN_SERVER}/aidocextract:<initial-tag>" \
    --target-port 3000 --ingress external \
    --min-replicas 0 --max-replicas 5 \
    --cpu 1.0 --memory 2.0Gi \
    --system-assigned \
    --registry-server "${ACR_LOGIN_SERVER}" --registry-identity system \
    --tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction
  ```
- [ ] 7.2 取得 MI principal ID
  ```bash
  CA_PRINCIPAL_ID=$(az containerapp show -g "${RG_NAME}" -n "${CA_NAME}" \
    --query "identity.principalId" -o tsv)
  ```
- [ ] 7.3 RBAC 賦權 1：Key Vault Secrets User
  ```bash
  KV_RESOURCE_ID=$(az keyvault show -n "${KV_NAME}" --query id -o tsv)
  az role assignment create \
    --role "Key Vault Secrets User" \
    --assignee-object-id "${CA_PRINCIPAL_ID}" --assignee-principal-type ServicePrincipal \
    --scope "${KV_RESOURCE_ID}"
  ```
- [ ] 7.4 RBAC 賦權 2：Storage Blob Data Contributor
  ```bash
  STORAGE_RESOURCE_ID=$(az storage account show -g "${RG_NAME}" -n "${STORAGE_NAME}" --query id -o tsv)
  az role assignment create \
    --role "Storage Blob Data Contributor" \
    --assignee-object-id "${CA_PRINCIPAL_ID}" --assignee-principal-type ServicePrincipal \
    --scope "${STORAGE_RESOURCE_ID}"
  ```
- [ ] 7.5 RBAC 賦權 3：AcrPull
  ```bash
  ACR_RESOURCE_ID=$(az acr show -n "${ACR_NAME}" --query id -o tsv)
  az role assignment create \
    --role "AcrPull" \
    --assignee-object-id "${CA_PRINCIPAL_ID}" --assignee-principal-type ServicePrincipal \
    --scope "${ACR_RESOURCE_ID}"
  ```
- [ ] 7.6 寫入 `deployment-state/uat.yaml`（`resources.container_app.{name,id,fqdn,principal_id}`）
- ⏱️ **預估時間**: 5-10 分鐘（Container App 啟動 + 3 個 RBAC 賦權）
- 📜 **對應 Bicep**: `bicep/modules/container-app.bicep`（含 inline `Microsoft.Authorization/roleAssignments` 區段）
- 📚 **詳細命令**: `../uat-deployment/02-azure-resources-setup.md` Action 2.7（產出 `rbac-pending.sh`）+ STEP-08

---

## 🔢 §4 完整執行順序（依依賴關係）

```
1. RG（Infra Team 已建，STEP-01 驗證）
        ↓
2. ACR（§3.1）— 獨立資源，先建以利 STEP-04 docker push
        ↓
3. PostgreSQL Flexible（§3.2）— 5-15 min 瓶頸，先啟動讓它在背景 provision
        ↓
4. Storage Account（§3.3）— 與 PG 並行可行
        ↓
5. Key Vault（§3.6，若 App Team 自建）— STEP-03 才實際填入 secrets
        ↓
6. Application Insights（§3.5）— 需 Infra LA workspace ID
        ↓
7. Container Apps Environment（§3.4）— 需 Infra LA workspace credentials
        ↓
8. ⏸ STEP-03/04/05/06/07（Secrets / Image / Migration / Seed / Functional Test）
        ↓
9. Container App + RBAC（§3.7）— STEP-08 First Deployment 時執行
```

> **並行優化建議**：若熟練操作，§3.1 / §3.2 / §3.3 可同時跑（不同 az 命令在不同 terminal）。但 §3.4 必須等 §3.5（App Insights 不必等 CAE，但 CAE workspace 設定可重用）。

---

## ✔️ §5 全資源驗證命令（all-in-one）

執行完整一輪後，跑以下命令確認 6 大資源狀態：

```bash
#!/usr/bin/env bash
# All-in-one verification script

set -euo pipefail
echo "=== Verifying UAT App-Layer Resources ==="

# 1. Resource Group
echo -n "RG: "
az group show --name "${RG_NAME}" --query "properties.provisioningState" -o tsv

# 2. ACR
echo -n "ACR loginServer: "
az acr show -n "${ACR_NAME}" -g "${RG_NAME}" --query "loginServer" -o tsv
echo -n "ACR adminEnabled (must be false): "
az acr show -n "${ACR_NAME}" -g "${RG_NAME}" --query "adminUserEnabled" -o tsv

# 3. PostgreSQL
echo -n "PG state: "
az postgres flexible-server show -g "${RG_NAME}" -n "${POSTGRES_NAME}" --query "state" -o tsv
echo -n "PG FQDN: "
az postgres flexible-server show -g "${RG_NAME}" -n "${POSTGRES_NAME}" --query "fullyQualifiedDomainName" -o tsv
echo -n "PG version: "
az postgres flexible-server show -g "${RG_NAME}" -n "${POSTGRES_NAME}" --query "version" -o tsv

# 4. Storage
echo -n "Storage status: "
az storage account show -g "${RG_NAME}" -n "${STORAGE_NAME}" --query "provisioningState" -o tsv
echo -n "Storage publicBlobAccess (must be false): "
az storage account show -g "${RG_NAME}" -n "${STORAGE_NAME}" --query "allowBlobPublicAccess" -o tsv

# 5. Key Vault（若自建）
echo -n "KV uri: "
az keyvault show -n "${KV_NAME}" --query "properties.vaultUri" -o tsv 2>/dev/null || echo "(not created — using shared KV)"

# 6. App Insights
echo -n "App Insights kind: "
az monitor app-insights component show -g "${RG_NAME}" -a "${APP_INSIGHTS_NAME}" --query "kind" -o tsv

# 7. Container Apps Environment
echo -n "CAE provisioningState: "
az containerapp env show -g "${RG_NAME}" -n "${CAE_NAME}" --query "properties.provisioningState" -o tsv
echo -n "CAE defaultDomain: "
az containerapp env show -g "${RG_NAME}" -n "${CAE_NAME}" --query "properties.defaultDomain" -o tsv

# 8. Container App（STEP-08 後才存在）
echo -n "Container App FQDN: "
az containerapp show -g "${RG_NAME}" -n "${CA_NAME}" --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null \
  || echo "(not created yet — created in STEP-08)"

echo "=== Verification complete ==="
```

預期所有狀態為 `Succeeded` / `Ready` / `false`（public access 類）。

---

## 🏷️ §6 Tag 套用提醒

> **強制要求**：所有資源建立時**必加** tags（依 `../naming-conventions.md` §6）。

每個 az CLI 命令必須附帶：

```bash
--tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction
```

| Tag Key | 必填？ | UAT 值 | 用途 |
|---------|--------|--------|------|
| `environment` | ✅ | `uat` / `prod` | 環境識別 |
| `owner` | ✅ | `app-team` | 維運責任 |
| `change` | ✅ | `CHANGE-055` | 變更追蹤 |
| `project` | ✅ | `ai-document-extraction` | 跨多 RG 識別 |
| `cost-center` | 🟡 建議 | `SCM-APAC` | 成本歸屬 |
| `expiration` | 🟡 UAT 建議 | `2026-09-30` | 清理參考 |

**Portal 操作提醒**：在 Portal 建資源時，**Review + Create** 頁前的 **Tags** 標籤頁要逐一填入以上 4 個必填 tag。

**檢核**：建完跑以下命令確認所有資源都有 4 個必填 tags：
```bash
az resource list --resource-group "${RG_NAME}" \
  --query "[].{name:name, env:tags.environment, owner:tags.owner, change:tags.change, project:tags.project}" -o table
```

---

## 🔄 §7 與 Bicep 的對等性聲明

本 checklist 與 `bicep/main.bicep` **語義上完全等價**。差異僅在執行方式：

| 維度 | Bicep（Mode A） | Manual（Mode B，本檔） |
|------|---------------|---------------------|
| 執行方式 | Declarative IaC（`az deployment group create`）| Imperative CLI（單條 `az` 命令）|
| Idempotency | ✅ 重複執行只更新差異 | ⚠️ 需手動 check `--query` 確認狀態 |
| Git 追蹤 | ✅ Bicep 檔可 diff | ⚠️ checklist 勾選不入 git |
| 並行控制 | ✅ Bicep 自動 dependency graph | ⚠️ 須依 §4 順序手動 |
| DR 重建 | 一鍵 redeploy | 須重跑 §3 全部 7 節 |

**保證等價的 6 大資源 module 對照**：

| Manual Section | Bicep Module | 主要參數 |
|---------------|-------------|---------|
| §3.1 ACR | `bicep/modules/acr.bicep` | `acrName, location, sku=Standard, adminEnabled=false` |
| §3.2 PostgreSQL | `bicep/modules/postgres.bicep` | `postgresName, tier=Burstable, skuName=Standard_B2s, version=15, backupRetentionDays=7` |
| §3.3 Storage | `bicep/modules/storage.bicep` | `storageName, sku=Standard_LRS, containerName=documents, softDeleteDays=7` |
| §3.4 CAE | `bicep/modules/container-apps-env.bicep` | `caeName, location, logAnalyticsWorkspaceId` |
| §3.5 App Insights | `bicep/modules/app-insights.bicep` | `appInsightsName, workspaceResourceId, kind=web` |
| §3.7 Container App | `bicep/modules/container-app.bicep` | `caName, image, minReplicas=0, maxReplicas=5, systemAssignedIdentity=true, roleAssignments[3]` |

> **測試等價性**：在同一 RG 跑完 Bicep + 跑完本 checklist 應產生**完全相同**的資源（除了 GUID / timestamp 等自動生成欄位）。`az resource list` 輸出 schema 一致。

---

## 📚 §8 與 STEP-02 的關係

| 文件 | 角色 | 內容 |
|------|------|------|
| **本檔（resources-checklist.md）** | **Summary checklist** | Markdown checkbox 對照清單 + Bicep 對應 |
| **`../uat-deployment/02-azure-resources-setup.md`** | **Detailed runbook** | 完整 az CLI 命令、Verify 命令、Expected Output、If Fails、AI Execution Hint |

**閱讀順序建議**：
1. **Infra Team 第一次接觸** → 先看本檔（5 分鐘掌握全貌）
2. **實際執行時** → 跳到 STEP-02 對應 Action（含 polling 邏輯、failure handling）
3. **驗收時** → 回本檔 §5 跑 all-in-one verification
4. **與 Bicep 對照** → 用本檔 §7 對照表，找對應 Bicep module 比對配置

**為何不在本檔重寫詳細命令？**
- ✅ 避免**雙份維護**（命令更新時兩邊容易不同步）
- ✅ STEP-02 含 AI Execution Hint（polling 規則 / failure escalation），本檔不需要
- ✅ 本檔聚焦 **Mode B 對話面板**（給人類 Infra Team 看的 SOP）

---

## 🔗 §9 相關文件

- **CHANGE-055 主規劃**：`../../azure-deployment-plan.md`
- **Infrastructure README**：`../README.md`（三種使用模式）
- **Bicep 模板**：`../bicep/main.bicep` + `../bicep/modules/*.bicep`
- **資源規格清單**：`../resources-inventory.md`
- **命名規範**：`../naming-conventions.md`
- **STEP-02 詳細 runbook**：`../../uat-deployment/02-azure-resources-setup.md`
- **STEP-08 First Deployment**（Container App + RBAC）：`../../uat-deployment/08-first-deployment.md`

---

*文件版本: v1.0（階段 D）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
