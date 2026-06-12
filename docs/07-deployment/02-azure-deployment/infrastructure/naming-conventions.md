# Azure 資源命名規範

> **狀態**：✅ 完整內容（v1.0 階段 D）
> **適用範圍**：本專案所有 Azure 資源（UAT / Prod / 任何環境）
> **建立日期**：2026-04-27

---

## 🎯 1. 設計原則

| 原則 | 說明 |
|------|------|
| **可識別** | 名稱直接看出「專案 + 環境 + 資源類型」 |
| **符合 Azure 規則** | 各資源類型有不同字符限制（globally unique / kebab-case / 不可含 `-` 等）|
| **Pilot Production 可區分** | UAT 與 Prod 名稱必須不同（避免誤操作） |
| **避免衝突** | Globally unique namespace（ACR / Storage / KV）需考慮命名衝突 |
| **Tag 補充元資料** | 名稱限制嚴格時，用 tag 補充（owner / change / cost-center）|

---

## 📋 2. 通用模式

### 2.1 名稱結構

```
<resource-type-prefix>-<project-short>-<environment>[-suffix]
```

| 元素 | 範例 | 說明 |
|------|------|------|
| `resource-type-prefix` | `rg` / `acr` / `kv` / `psql` | Azure 資源類型縮寫（見 §4 對照表） |
| `project-short` | `aidocextract` | 專案短名（無連字符版本，方便 globally unique） |
| `environment` | `uat` / `prod` / `dev` | 環境後綴 |
| `suffix`（選用）| `-001` / `-eus` | 用於避免衝突或標示 region |

### 2.2 字符限制速查

| 類型 | 字符規則 | 長度範圍 | Global Unique？ |
|------|---------|---------|----------------|
| Resource Group | alphanumeric + `-` `_` `.` | 1-90 | 否（per subscription） |
| Container Registry (ACR) | **alphanumeric only**（不允許 `-`）| 5-50 | ✅ **是** |
| Storage Account | **alphanumeric only**（lowercase） | 3-24 | ✅ **是** |
| Key Vault | alphanumeric + `-` | 3-24 | ✅ **是** |
| Container Apps Env | alphanumeric + `-` | 2-32 | 否 |
| Container App | lowercase + `-` | 2-32 | 否 |
| PostgreSQL Flexible | lowercase + `-` | 3-63 | ✅ **是**（DNS 名稱） |
| Application Insights | alphanumeric + `-` | 1-260 | 否 |
| Log Analytics Workspace | alphanumeric + `-` | 4-63 | 否 |

---

## 🏷️ 3. UAT 環境完整命名範例

| 資源 | 命名 | 字符規則符合？ |
|------|------|--------------|
| Resource Group | `rg-ai-document-extraction-uat` | ✅ |
| Container Registry | `acraidocextractuat` | ✅（無 `-`） |
| Storage Account | `staidocextractuat` | ✅（lowercase, no `-`） |
| Key Vault（App Team 自建）| `kv-aidocextract-uat` | ✅ |
| Container Apps Environment | `cae-aidocextract-uat` | ✅ |
| Container App | `ca-aidocextract-uat` | ✅ |
| PostgreSQL Flexible Server | `psql-aidocextract-uat` | ✅ |
| Application Insights | `appi-aidocextract-uat` | ✅ |
| Log Analytics（若 App Team 建）| `log-aidocextract-uat` | ✅ |

### 3.1 Prod 環境對應

| UAT | Prod |
|-----|------|
| `rg-ai-document-extraction-uat` | `rg-ai-document-extraction-prod` |
| `acraidocextractuat` | `acraidocextractprod` |
| `staidocextractuat` | `staidocextractprod` |
| `kv-aidocextract-uat` | `kv-aidocextract-prod` |
| `cae-aidocextract-uat` | `cae-aidocextract-prod` |
| `ca-aidocextract-uat` | `ca-aidocextract-prod` |
| `psql-aidocextract-uat` | `psql-aidocextract-prod` |
| `appi-aidocextract-uat` | `appi-aidocextract-prod` |

---

## 📚 4. 資源類型 Prefix 對照表

> 參考 [Azure Cloud Adoption Framework naming](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)。

| 資源類型 | Prefix | 範例 |
|---------|--------|------|
| Resource Group | `rg-` | `rg-aidocextract-uat` |
| Virtual Network | `vnet-` | `vnet-shared-uat` |
| Subnet | `snet-` | `snet-cae-uat` |
| Network Security Group | `nsg-` | `nsg-cae-uat` |
| Public IP | `pip-` | `pip-cae-uat` |
| Container Registry | `acr` | `acraidocextractuat`（無 `-`） |
| Container Apps Environment | `cae-` | `cae-aidocextract-uat` |
| Container App | `ca-` | `ca-aidocextract-uat` |
| App Service Plan | `asp-` | (本專案不使用) |
| App Service | `app-` | (本專案不使用) |
| Function App | `func-` | (本專案不使用) |
| Storage Account | `st` | `staidocextractuat`（lowercase, 無 `-`） |
| Key Vault | `kv-` | `kv-aidocextract-uat` |
| PostgreSQL Flexible Server | `psql-` | `psql-aidocextract-uat` |
| MySQL Flexible Server | `mysql-` | (本專案不使用) |
| Cosmos DB | `cosmos-` | (本專案不使用) |
| Redis Cache | `redis-` | (Upstash external，不適用) |
| Application Insights | `appi-` | `appi-aidocextract-uat` |
| Log Analytics Workspace | `log-` | `log-aidocextract-uat` |
| Service Bus | `sb-` | (未來可能) |
| Front Door | `afd-` | (未來可能) |
| Application Gateway | `agw-` | (未來可能) |
| Managed Identity（User-Assigned） | `id-` | `id-aidocextract-uat` |
| Private Endpoint | `pe-` | `pe-postgres-uat` |
| Private DNS Zone | `pdz-` | (Infra Team 管) |

---

## 🔢 5. Global Unique Names 衝突處理

### 5.1 衝突風險最高的 3 類資源

1. **Container Registry**（DNS：`<name>.azurecr.io`）
2. **Storage Account**（DNS：`<name>.blob.core.windows.net`）
3. **Key Vault**（DNS：`<name>.vault.azure.net`）

### 5.2 衝突應對策略

```bash
# Step 1: STEP-01 加入 pre-flight check
az acr check-name --name acraidocextractuat
az storage account check-name --name staidocextractuat
az keyvault list-deleted --query "[?name=='kv-aidocextract-uat']"  # 軟刪除可能阻擋
```

### 5.3 衝突時的命名後綴規則

若名稱衝突，加 4-6 字元 hex 隨機 suffix（**不要用日期或順序號**，避免 brute-force enumeration）：

```bash
SUFFIX=$(openssl rand -hex 3)  # e.g. "3f7a2b"
ACR_NAME="acraidocextractuat${SUFFIX}"  # 變成 acraidocextractuat3f7a2b
```

---

## 🏷️ 6. Tag 規範

每個資源**必須**含以下 tags：

| Tag Key | 必須？ | 範例值 | 用途 |
|---------|--------|--------|------|
| `environment` | ✅ | `uat` / `prod` / `dev` | 環境識別 |
| `owner` | ✅ | `app-team` / `infra-team` | 維運責任 |
| `change` | ✅ | `CHANGE-055` | 變更追蹤 |
| `project` | ✅ | `ai-document-extraction` | 跨多 RG 識別 |
| `cost-center` | 🟡（建議）| `SCM-APAC` | 成本歸屬 |
| `data-classification` | 🟡（建議）| `internal` / `confidential` | 資料敏感度 |
| `expiration` | 🟡（建議，UAT 用）| `2026-09-30` | UAT 環境清理參考 |

### 6.1 Tag 應用範例

```bash
# az CLI
az containerapp create ... \
  --tags environment=uat owner=app-team change=CHANGE-055 project=ai-document-extraction

# Bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  // ...
  tags: {
    environment: 'uat'
    owner: 'app-team'
    change: 'CHANGE-055'
    project: 'ai-document-extraction'
  }
}
```

---

## 🌍 7. Region 命名（多 region 預留）

若未來擴展到多 region，加入 region 後綴：

| Region | Suffix | 範例 |
|--------|--------|------|
| Southeast Asia（主） | `sea` 或無 | `psql-aidocextract-uat` |
| East Asia | `ea` | `psql-aidocextract-uat-ea` |
| Australia East | `ae` | `psql-aidocextract-uat-ae` |
| Japan East | `je` | `psql-aidocextract-uat-je` |

> **目前 UAT/Pilot 僅部署 Southeast Asia，無 region suffix。**

---

## ❌ 8. 禁止事項

| ❌ 禁止 | 原因 | 正確做法 |
|---------|------|---------|
| 用個人姓名（`acrjohnsmithuat`） | 不可維護 | 用團隊/專案名 |
| 用機密（`kv-secret-key-uat`） | 名稱不應暴露用途 | 用通用名稱 |
| 大寫混用（`ACRaidocExtract`） | 部分資源強制 lowercase | 全 lowercase |
| 過長（>90 chars） | RG 上限 90 字 | 用簡短專案代碼 |
| `:latest` / `dev` mixing | 跨環境誤操作 | 環境 suffix 必須明確 |
| 用 `temp` / `test` / `xxx` | 流入 prod 困擾 | 用真實環境名 |

---

## 🔗 9. 相關文件

- **CHANGE-055 主規劃**：`../azure-deployment-plan.md`
- **資源 Inventory**：`./resources-inventory.md`
- **STEP-00 Overview**：`../uat-deployment/00-overview.md` §2.1
- **Azure CAF Naming**：[官方參考](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-abbreviations)

---

*文件版本: v1.0（階段 D）*
*最後更新: 2026-04-27*
