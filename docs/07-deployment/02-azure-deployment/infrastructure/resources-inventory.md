# Azure 資源規格清單（Resources Inventory）

> **狀態**：✅ v1.0 完整內容（CHANGE-055 階段 D）
> **適用範圍**：UAT + Prod（Pilot → Full Rollout）
> **建立日期**：2026-04-27
> **維護**：App Team + Infra Admin（共同維護）

---

## 🎯 1. 文件目的

這份 inventory 是 **不論採用 Mode A / B / C 都需要** 的核心文件：

| 角色 | 怎麼用這份 |
|------|-----------|
| **Infra Team / Infra Admin** | 看這份**決策 SKU、tier、配置**；可作為 Terraform / 自家 pipeline 的規格輸入；review App Team 是否合理 |
| **App Team** | 看這份**對齊配置**（哪些值不可改、哪些可調）；對 Bicep parameters 的權威來源 |
| **Security Team** | 看這份審查 RBAC 賦權清單與資料保護機制（soft-delete / purge-protection / Managed Identity）|
| **Cost / Finance** | 看這份**月成本估算**作為預算討論輸入（Azure Calculator 試算前的初稿）|
| **DR / SRE** | 看這份理解**備份/還原能力**與**HA 現況**（v0.3 暫無 HA 但有每日備份）|

**核心理念**：
- 不論 Infra Team 採 Bicep / Terraform / Portal，本文件是**唯一規格真相**
- Bicep 模板僅是這份 spec 的**機器可執行翻譯**
- 任何資源配置變更，必須**先更新本文件**，再更新 Bicep / Terraform / Portal

> **與 azure-deployment-plan.md §2 / §🔟 的關係**：本文件是 §2（資源選型）+ §🔟（預算）+ §9（網路需求）的**整合落地版本**，並補上 Prod 對應規格。

---

## 📋 2. 文件結構說明

每個資源（§3.1 - §3.6）提供以下標準欄位：

| 欄位 | 說明 |
|------|------|
| **資源類型** | Azure 資源類型全名 + Provider |
| **UAT / Prod 命名** | 對應 `naming-conventions.md` |
| **SKU / Tier (UAT)** | 保守方案（成本優先）|
| **SKU / Tier (Prod)** | 標準方案（v0.3 暫不 HA）|
| **關鍵配置** | 必須設定的非預設值（admin disabled / soft-delete / TLS 1.2+ / etc.）|
| **Managed Identity 整合** | 是否使用 + 哪些 RBAC role |
| **連線需求** | 對 §6 應用層網路需求清單的引用 |
| **預估月成本** | UAT / Prod 的 USD 估算 |
| **歸屬** | App Team / Infra Team / 共享 |

---

## 🔧 3. 6 大資源完整 Inventory

### 3.1 Azure Container Registry (ACR)

| 欄位 | 內容 |
|------|------|
| **資源類型** | `Microsoft.ContainerRegistry/registries` |
| **UAT 命名** | `acraidocextractuat`（globally unique，無 `-`，5-50 字元 alphanumeric only）|
| **Prod 命名** | `acraidocextractprod` |
| **SKU / Tier (UAT)** | **Standard**（支援 webhook + geo-replication 預留；Basic 不支援 webhook）|
| **SKU / Tier (Prod)** | **Standard**（可選 Premium 啟用 geo-replication，現階段不需要）|
| **關鍵配置** | • `admin-enabled=false`（🔴 強制走 Managed Identity，不留 admin user）<br>• `min-tls-version=TLS1_2`<br>• Image retention policy: 30 days untagged manifests<br>• Geo-replication: **off**（Prod 可選 SE Asia + East Asia 雙寫，現不啟用）<br>• Quarantine policy: disabled（image scan 走外部工具）|
| **Managed Identity 整合** | ✅ Container App 用 System-Assigned MI，賦予 `AcrPull` role |
| **連線需求** | • Container App → ACR: HTTPS 443（pull image）<br>• GitHub Actions → ACR: HTTPS 443（push image，OIDC federated identity）|
| **預估月成本（UAT）** | **$20 / 月**（Standard tier 固定費用 + 100 GB included storage）|
| **預估月成本（Prod）** | **$20-50 / 月**（無 geo-replication: $20；啟用 geo-replication 約 $50）|
| **歸屬** | **App Team** 自建 |
| **依賴** | Resource Group（Infra Team 提供）|
| **對應 Bicep** | `bicep/modules/acr.bicep` |
| **對應 Action** | `uat-deployment/02-azure-resources-setup.md#action-22` |

---

### 3.2 Container Apps Environment + Container App

| 欄位 | 內容 |
|------|------|
| **資源類型** | • `Microsoft.App/managedEnvironments`（CAE）<br>• `Microsoft.App/containerApps`（CA）|
| **UAT 命名** | • CAE: `cae-aidocextract-uat`<br>• CA: `ca-aidocextract-uat` |
| **Prod 命名** | • CAE: `cae-aidocextract-prod`<br>• CA: `ca-aidocextract-prod` |
| **SKU / Tier (UAT)** | **Consumption plan**（pay-per-use，工作時段外 scale to 0）<br>• 0.5 vCPU / 1 GiB memory<br>• `minReplicas=0-1`（工作時段 1，其他 0）<br>• `maxReplicas=5` |
| **SKU / Tier (Prod)** | **Consumption plan**（同 UAT）<br>• 0.5-1 vCPU / 1-2 GiB memory<br>• `minReplicas=1`（避免工作時段 cold start）<br>• `maxReplicas=5`（依 Pilot 觀察調整）|
| **關鍵配置（Environment）** | • Log Analytics 整合（Infra Team 提供 workspace）<br>• Workload profile: `Consumption`（不採 Dedicated）<br>• Zone redundant: **disabled**（v0.3 §9 決策）<br>• VNet integration: 視 Infra Team 決策（若 Hub-Spoke 則需 internal subnet）|
| **關鍵配置（App）** | • Ingress: External（HTTPS only）+ Insecure traffic redirect<br>• Target port: 3000（Next.js standalone）<br>• Transport: Auto<br>• Revision mode: Single（先採用，之後可改 Multiple 做 blue/green）<br>• Scale rule: HTTP concurrent requests = 50 / replica<br>• Health probes: `/api/health` (liveness + readiness + startup)<br>• Image: `${ACR_LOGIN_SERVER}/ai-document-extraction:${tag}` |
| **Managed Identity 整合** | ✅ **System-Assigned MI**，需以下 role：<br>• `AcrPull` on ACR<br>• `Key Vault Secrets User` on KV<br>• `Storage Blob Data Contributor` on Storage Account<br>• （可選）`Monitoring Metrics Publisher` on App Insights |
| **連線需求** | • User → CA: HTTPS 443（外部）<br>• CA → PostgreSQL: TCP 5432<br>• CA → KV: HTTPS 443<br>• CA → Storage: HTTPS 443<br>• CA → ACR: HTTPS 443<br>• CA → Azure OpenAI / DI: HTTPS 443<br>• CA → Microsoft Graph: HTTPS 443<br>• CA → SMTP: TCP 587/465 |
| **預估月成本（UAT）** | **$0-30 / 月**（Consumption + scale to 0；非工作時段幾乎無消耗）|
| **預估月成本（Prod）** | **$50-150 / 月**（minReplicas=1 全天 + Pilot 階段 <100 user）|
| **歸屬** | **App Team** 自建 |
| **依賴** | RG + Log Analytics workspace（Infra Team 提供）+ ACR + KV + Storage |
| **對應 Bicep** | `bicep/modules/container-apps-env.bicep` + `bicep/modules/container-app.bicep` |
| **對應 Action** | `uat-deployment/02-azure-resources-setup.md#action-23` + `08-first-deployment.md` |

---

### 3.3 PostgreSQL Flexible Server

| 欄位 | 內容 |
|------|------|
| **資源類型** | `Microsoft.DBforPostgreSQL/flexibleServers` |
| **UAT 命名** | `psql-aidocextract-uat`（DNS: `<name>.postgres.database.azure.com`，globally unique）|
| **Prod 命名** | `psql-aidocextract-prod` |
| **SKU / Tier (UAT)** | **Burstable B2s**（2 vCore, 4 GB RAM）<br>• Storage: **32 GB** + auto-grow enabled<br>• Backup retention: **7 天**<br>• Geo-redundant backup: disabled<br>• High Availability: **disabled**（v0.3 §9 決策）|
| **SKU / Tier (Prod)** | **General Purpose D2ds_v5**（2 vCore, 8 GB RAM）<br>• Storage: **64 GB** + auto-grow enabled<br>• Backup retention: **14 天**<br>• Geo-redundant backup: disabled（同 region 簡化）<br>• High Availability: **disabled**（v0.3 §9 決策；Pilot 後可升級為 Zone-redundant，重啟即可無架構變更）|
| **PostgreSQL 版本** | **15**（與本地開發、Docker compose 一致；CHANGE-056 baseline 對應）|
| **關鍵配置** | • Authentication: PG admin password + Microsoft Entra ID（雙模式；Pilot 後切純 MI）<br>• 🔴 PITR (Point-in-time recovery): **enabled**（Flexible 預設支援）<br>• Connection pooling: 由應用層處理（Prisma + PgBouncer 視需要）<br>• `tcp_keepalives_idle=300`（避免 NAT 中斷）<br>• `log_min_duration_statement=1000`（慢查詢日誌）<br>• Maintenance window: 週日 02:00 SE Asia time<br>• Network: 視 Infra Team 決定 Public access vs Private endpoint |
| **Managed Identity 整合** | ✅ Container App MI 透過 Microsoft Entra authentication 連線（Pilot 後啟用），`pg_aad_authentication` extension 啟用 |
| **連線需求** | • Container App → PG: TCP 5432<br>• GitHub Actions → PG: TCP 5432（migration deploy；視 Infra Team 是否允許 GitHub IP 進入）<br>• 開發者 → PG: TCP 5432（debug，僅透過 jump host / VPN）|
| **預估月成本（UAT）** | **$30 / 月**（B2s + 32 GB + 7d backup）|
| **預估月成本（Prod）** | **~$180 / 月**（D2ds_v5 + 64 GB + 14d backup，無 HA；啟用 Zone-redundant HA 約 +$90 = $270）|
| **歸屬** | **App Team** 自建（資料庫實例）；Infra Team 提供網路接入 |
| **依賴** | RG + （可選）VNet/Subnet + Private DNS zone（若用 Private Endpoint）|
| **對應 Bicep** | `bicep/modules/postgres.bicep` |
| **對應 Action** | `uat-deployment/02-azure-resources-setup.md#action-24` |

---

### 3.4 Storage Account + Blob Container "documents"

| 欄位 | 內容 |
|------|------|
| **資源類型** | `Microsoft.Storage/storageAccounts` + `blobServices/containers` |
| **UAT 命名** | `staidocextractuat`（globally unique，3-24 字元 lowercase alphanumeric only）|
| **Prod 命名** | `staidocextractprod` |
| **SKU / Tier (UAT)** | **Standard_LRS**（Locally Redundant，3 copies in 1 datacenter）<br>• Kind: StorageV2<br>• Access tier: **Hot** |
| **SKU / Tier (Prod)** | **Standard_ZRS**（Zone Redundant，3 copies across 3 AZs）<br>• Kind: StorageV2<br>• Access tier: **Hot** + Lifecycle rule（90 天未存取 → Cool tier，365 天 → Archive 可選）<br>• 註：v0.3 §9 暫不 HA，但 ZRS 為 Storage 層級的「免費」HA（不影響應用設計）|
| **Container 名稱** | `documents`（與 `AZURE_STORAGE_CONTAINER` env 對應；UAT/Prod 同名，環境靠 storage account 區隔）|
| **關鍵配置** | • `min-tls-version=TLS1_2`<br>• `allow-blob-public-access=false`<br>• `allow-shared-key-access=true`（Pilot；Full Rollout 改 false 強制 OAuth）<br>• 🔴 Soft-delete (blob): enabled<br>　- UAT: **7 天**<br>　- Prod: **30 天**<br>• 🔴 Soft-delete (container): enabled（同上週期）<br>• Versioning: enabled<br>• Encryption: Microsoft-managed keys（可選 CMK from KV）<br>• Immutable blob: **off**（Prod 可選啟用，合規要求出現時）<br>• Public access: blocked at storage account level |
| **Managed Identity 整合** | ✅ Container App MI 賦予 `Storage Blob Data Contributor` role on Storage Account scope（最小權限：`...Reader` 不夠，需 Contributor 才能寫入）|
| **連線需求** | • Container App → Storage: HTTPS 443<br>• GitHub Actions → Storage: HTTPS 443（測試 fixtures 上傳，可選）|
| **預估月成本（UAT）** | **$10 / 月**（Standard_LRS Hot + 50 GB + 低 transaction）|
| **預估月成本（Prod）** | **$30-60 / 月**（Standard_ZRS Hot + 200-500 GB + lifecycle to Cool；視文件保留週期）|
| **歸屬** | **App Team** 自建 |
| **依賴** | RG + （可選）Private Endpoint（Infra Team 配置）|
| **對應 Bicep** | `bicep/modules/storage.bicep` |
| **對應 Action** | `uat-deployment/02-azure-resources-setup.md#action-25` |

---

### 3.5 Application Insights

| 欄位 | 內容 |
|------|------|
| **資源類型** | `Microsoft.Insights/components`（workspace-based）|
| **UAT 命名** | `appi-aidocextract-uat` |
| **Prod 命名** | `appi-aidocextract-prod` |
| **SKU / Tier (UAT)** | **連到 Infra Team 提供的 Log Analytics workspace**（不自建 workspace）<br>• Sampling: **enabled**（adaptive，預設 100% → 自動 throttle）<br>• Retention: **30 天** |
| **SKU / Tier (Prod)** | 同 UAT，但：<br>• Retention: **60 天**（依稽核需求可拉長至 90 天）<br>• Sampling: 視 cost vs 解析度需求調整 |
| **關鍵配置** | • `Application_Type=web`<br>• `WorkspaceResourceId=<Infra Team 提供>`（key 點：所有 telemetry 寫入 Infra Team 共享 workspace）<br>• Connection String 注入 Container App env var: `APPLICATIONINSIGHTS_CONNECTION_STRING`<br>• Disable IP masking: 視隱私法規<br>• Custom metrics: 啟用<br>• Live Metrics Stream: enabled（debug 用）|
| **Managed Identity 整合** | 🟡 通常用 connection string 注入即可；若需 MI-based 認證（去除 instrumentation key），賦予 `Monitoring Metrics Publisher` role |
| **連線需求** | • Container App → App Insights: HTTPS 443（telemetry endpoint）|
| **預估月成本（UAT）** | **$5-30 / 月**（依 telemetry 量；Pilot < 5GB / 月落在前 5GB 免費額度）|
| **預估月成本（Prod）** | **$30-100 / 月**（依 sampling rate + retention；可開 Daily Cap 控制）|
| **歸屬** | **共享**（App Team 建立 Application Insights instance；Log Analytics workspace 由 **Infra Team** 提供）|
| **依賴** | Infra Team 提供 Log Analytics workspace ID + key |
| **對應 Bicep** | `bicep/modules/app-insights.bicep` |
| **對應 Action** | `uat-deployment/02-azure-resources-setup.md#action-26` |

---

### 3.6 Key Vault

> ⚠️ **依 v0.3 Mode C，可能由 Infra Team 提供共享 KV，或 App Team 自建。** 以下情境二擇一。

#### 情境 A：Infra Team 提供共享 KV（推薦）

| 欄位 | 內容 |
|------|------|
| **歸屬** | **Infra Team** 提供（App Team 不自建）|
| **使用方式** | App Team 在共享 KV 中建立 secret prefix（如 `aidocextract-uat-*` / `aidocextract-prod-*`）|
| **必要前置** | Infra Team 賦予 App Team 對應 secret prefix 的 `Key Vault Secrets Officer`（管理 secret）<br>Container App MI 賦予 `Key Vault Secrets User`（讀 secret）|
| **預估月成本** | $0（由 Infra Team budget 承擔，App Team 視作 0）|

#### 情境 B：App Team 自建 KV（後備）

| 欄位 | 內容 |
|------|------|
| **資源類型** | `Microsoft.KeyVault/vaults` |
| **UAT 命名** | `kv-aidocextract-uat`（globally unique，3-24 字元）|
| **Prod 命名** | `kv-aidocextract-prod` |
| **SKU / Tier** | **Standard**（FIPS 140-2 Level 1；Pilot 階段足夠；如需 HSM-backed key 則升級 Premium）|
| **關鍵配置** | • 🔴 **Soft-delete: enabled**（不可關閉，Azure 預設）<br>• 🔴 **Purge protection: enabled**（防 admin 誤刪 + bypass soft-delete；一旦啟用無法關閉）<br>• Soft-delete retention: **90 天**（Azure 強制最小 7，建議 90）<br>• `enable-rbac-authorization=true`（用 Azure RBAC，不用 Access Policy）<br>• Network: 視 Infra Team 決定（Public + IP allowlist / Private Endpoint）<br>• Diagnostic settings: 寫入 Infra Team Log Analytics workspace |
| **Managed Identity 整合** | ✅ Container App MI 賦予 `Key Vault Secrets User` role（讀 secret，scope 至 KV resource）|
| **連線需求** | • Container App → KV: HTTPS 443（讀 secret）<br>• 開發者 → KV: HTTPS 443（管理 secret，via az CLI / Portal）|
| **預估月成本（UAT/Prod）** | **$3-10 / 月**（Standard tier 免費上限 10K transaction/月，超出後 $0.03 / 10K）|
| **歸屬** | **App Team** 自建（情境 B）|
| **對應 Bicep** | `bicep/modules/key-vault.bicep`（提供作為 Mode A 範例；情境 A 不執行此 module）|
| **對應 Action** | `uat-deployment/03-secrets-configuration.md` |

#### 必進 Key Vault 的 Secret 清單（不論情境 A/B）

| Secret Name | 來源 | 輪替週期 |
|-------------|------|---------|
| `AUTH-SECRET` | 隨機產生 | 每季 |
| `JWT-SECRET` | 隨機產生 | 每季 |
| `SESSION-SECRET` | 隨機產生 | 每季 |
| `ENCRYPTION-KEY` | 🔴 **不可變更**（變更會讓加密資料無法解密）| 永不 |
| `AZURE-OPENAI-API-KEY` | Azure OpenAI resource key | 半年 |
| `AZURE-DI-KEY` | Document Intelligence resource key | 半年 |
| `AZURE-STORAGE-CONNECTION-STRING` | Storage account connection string（Pilot；Full Rollout 改 Managed Identity） | 移除（用 MI 取代）|
| `MS-GRAPH-CLIENT-SECRET` | Microsoft Graph App Registration | 每季 |
| `PG-ADMIN-PASSWORD` | PostgreSQL admin password（Pilot；Full Rollout 改 Microsoft Entra Auth）| 每季 |

---

## 🔐 4. Managed Identity & RBAC 對照表

Container App 使用 **System-Assigned Managed Identity**（隨 Container App 建立而產生 principal ID），需以下 role assignments：

| # | Role | Scope | 用途 | 何時賦予 |
|---|------|-------|------|---------|
| 1 | `AcrPull` | ACR resource | Container App 從 ACR pull image | STEP-08（Container App 建立後）|
| 2 | `Key Vault Secrets User` | KV resource（或 secret-level scope）| 讀取 secret（不能寫）| STEP-08 |
| 3 | `Storage Blob Data Contributor` | Storage Account resource | 讀寫 `documents` container | STEP-08 |
| 4 | `Monitoring Metrics Publisher` | App Insights resource | 寫入 telemetry（若不用 connection string）| 可選 |

**RBAC 賦權腳本**：見 `uat-deployment/02-azure-resources-setup.md` Action 2.7（產出 `deployment-state/rbac-pending.sh`，於 STEP-08 後執行）。

**Bicep 整合**：在 `container-app.bicep` module 內以 `Microsoft.Authorization/roleAssignments` resource 自動建立。

---

## 🔗 5. Infra Team Handoff 清單

App Team **無法自建**、需要 Infra Team 提供的資訊（對應 STEP-01 prerequisites Action 1.4）：

| # | 項目 | 用途 | 必要？ | 備註 |
|---|------|------|-------|------|
| 1 | **Resource Group** ID + 名稱 | 所有資源歸屬此 RG | 🔴 必要 | UAT/Prod 各一 |
| 2 | **Subscription** ID | `az account set --subscription` | 🔴 必要 | UAT/Prod 可同一 sub 或分離 |
| 3 | **Tenant** ID | Microsoft Entra tenant | 🔴 必要 | 通常與 Infra Team 一致 |
| 4 | **Location / Region** | 所有資源建立 region | 🔴 必要 | 預設 `southeastasia` |
| 5 | **Log Analytics Workspace** ID + customerId + sharedKey | App Insights / Container Apps Environment 整合 | 🔴 必要 | 通常 Infra Team 共用 workspace |
| 6 | **VNet ID + Subnet ID for Container Apps** | 若 CAE 採 VNet integration | 🟡 視 Infra 決策 | 若 Hub-Spoke 必要；否則可空 |
| 7 | **共享 Key Vault URI** | 若採情境 A（Infra 提供共享 KV）| 🟡 視情境 | 情境 B 自建則不需要 |
| 8 | **Private DNS Zones** | • `privatelink.postgres.database.azure.com`<br>• `privatelink.blob.core.windows.net`<br>• `privatelink.vaultcore.azure.net`<br>• `privatelink.azurecr.io` | 🟡 視 Private Endpoint 決策 | Infra Team 通常已建立全 sub 共享 zone |
| 9 | **Public IP allowlist** for ACR / Storage / KV | 若 Infra Team 對外資源也用 firewall | 🟡 視 Infra 決策 | 提交 GitHub Actions runner IP / VPN CIDR |
| 10 | **Azure OpenAI / Document Intelligence resource** | App Team 不一定能自建（quota / region 限制）| 🟡 視 Infra 決策 | 若 Infra 統一管理 → 提供 endpoint + key |
| 11 | **Microsoft Entra App Registration**（若用 Azure AD SSO）| Authentication | 🟡 視 Auth 設計 | tenant + clientId + clientSecret |
| 12 | **Custom Domain + TLS certificate** | Container App ingress 自訂域名 | 🟢 Pilot 後 | 需 DNS CNAME + KV-managed cert |
| 13 | **GitHub OIDC Federated Credential**（若 CI/CD）| GitHub Actions 推 image / deploy 不用 secret | 🟢 Phase 3 | App Team 提交 GitHub repo 給 Infra 配置 |

---

## 🌐 6. 應用層對網路的需求清單

直接引用 `azure-deployment-plan.md` §9 Network — 13 條通訊路徑表格：

| # | 通訊路徑 | 協定 / 端口 | 說明 | 認證方式 |
|---|---------|-----------|------|---------|
| 1 | User → Container App | HTTPS / 443 | 入口（LAN/VPN 或公網 + IP allowlist 由 Infra Admin 決定）| NextAuth JWT |
| 2 | Container App → PostgreSQL | TCP / 5432 | 應用必須能 reach DB | Microsoft Entra MI（Pilot 後）|
| 3 | Container App → Key Vault | HTTPS / 443 | 讀 secret | Managed Identity |
| 4 | Container App → Blob Storage | HTTPS / 443 | 讀寫 `documents` container | Managed Identity + DefaultAzureCredential |
| 5 | Container App → Azure OpenAI | HTTPS / 443 | LLM Tier 3 分類 | API key 或 Managed Identity |
| 6 | Container App → Document Intelligence | HTTPS / 443 | OCR | API key |
| 7 | Container App → ACR | HTTPS / 443 | Pull image | Managed Identity (`AcrPull`) |
| 8 | Container App → SharePoint / Outlook | HTTPS / 443 | Microsoft Graph API | Microsoft Entra App + secret |
| 9 | Container App → SMTP（Email 通知）| TCP / 587 / 465 | 視 SMTP server 配置 | username + password from KV |
| 10 | GitHub Actions → ACR | HTTPS / 443 | Push image | OIDC federated identity |
| 11 | GitHub Actions → Container Apps | HTTPS / 443 | `az containerapp update` | OIDC federated identity |
| 12 | GitHub Actions → PostgreSQL | TCP / 5432 | `prisma migrate deploy` | OIDC + 短期 token |
| 13 | Container App → App Insights | HTTPS / 443 | telemetry | connection string 或 MI |

**App Team 不關心的層**（Infra Admin 自行決定）：
- VNet topology（Hub-Spoke / Single VNet / Multi-region）
- Private Endpoint vs Service Endpoint
- NSG rules、Firewall、Web Application Firewall
- DDoS protection
- 跨 region 連通性

---

## 💰 7. 月成本總計（三方案對比）

> ⚠️ 以下為 AI 助手粗估（USD，Southeast Asia region），**非官方報價**。Infra Admin 需以 Azure Calculator 試算定案。

### 7.1 方案對比表

| 方案 | 基礎設施 | AI 服務（DI + OpenAI） | 月總計 |
|------|---------|---------------------|--------|
| **保守（PoC / UAT）** | $120-230 | $975-1,500 | **$1,100-1,730** |
| **標準（Pilot / Prod）** | $420-770 | $975-1,500 | **$1,400-2,270** |
| **企業（HA + 網路安全）** | $1,000-1,900 | $975-1,500 | **$2,000-3,400** |

### 7.2 v0.3 預期定位

依 v0.3 §9 決策（暫不需要 Zone-redundant HA + 網路完全委外 Infra Admin）：

> **本專案預期落在「保守」與「標準」之間**：
> - Pilot 階段（W4-W10）：使用「保守」方案 → 月度約 **$1,100-1,500 USD**（約 NT$36K-50K）
> - Pilot 後 Full Rollout：升級到「標準」方案 → 月度約 **$1,400-2,000 USD**（約 NT$45K-65K）
> - 升級到「企業」方案的 trigger：合規要求 / 業務 RTO < 1 小時 / 跨 region DR

### 7.3 基礎設施明細（保守方案 = 本專案 Pilot 預期）

| 資源 | UAT 月成本 | Prod 月成本 | 註 |
|------|-----------|------------|-----|
| ACR (Standard) | $20 | $20 | §3.1 |
| Container Apps (Consumption, scale to 0) | $0-30 | $50-150 | §3.2 |
| PostgreSQL (B2s UAT / D2ds_v5 Prod, no HA) | $30 | $180 | §3.3 |
| Storage (LRS UAT / ZRS Prod) | $10 | $30-60 | §3.4 |
| App Insights | $5-30 | $30-100 | §3.5 |
| Key Vault (Standard, 自建情境 B) | $3-10 | $3-10 | §3.6 |
| **基礎設施小計** | **$68-130** | **$313-520** | — |

### 7.4 AI 服務明細（與方案無關，與處理量強相關）

| 服務 | 用量假設 | 月成本 |
|------|---------|--------|
| Document Intelligence Prebuilt Invoice | 37.5K 張/月 × 2 頁平均 × $0.01/頁 | **$750** |
| Azure OpenAI GPT-5.2（Tier 3 分類）| 37.5K × 20% 觸發 = 7.5K 次 × (3K input + 1K output tokens) × ($5/$15 per 1M) | **$225** |
| **AI 服務小計** | — | **~$975** |

> 註：450-500K 張/年 ÷ 12 月 ≈ 37.5K-41.7K 張/月。Pilot 階段 100-200 張/週遠低於此，故 Pilot 階段 AI 成本約為上方的 5-10%（**$50-100/月**）。

---

## 🌍 8. Region 規劃

| 環境 | Region | 理由 |
|------|--------|------|
| **UAT** | Southeast Asia (`southeastasia`) | 與本地時區 + 網路延遲最佳；多數 Azure SKU 完整支援 |
| **Prod** | Southeast Asia (`southeastasia`) | 與 UAT 同 region 簡化路由 + 跨環境驗證 |
| **未來擴展** | East Asia / Japan East | v0.3 不規劃；若業務擴展到日本/韓國再評估 |

**不規劃 Geo-redundant**：
- 依 v0.3 §9 暫不需要跨 region HA
- Storage 用 LRS (UAT) / ZRS (Prod) 已足夠
- DB 不啟用 geo-redundant backup
- 未來升級路徑：Azure Front Door + 多 region Container App + DB read replica（W11+ 評估）

---

## 🏷️ 9. Tag 標準

引用 `naming-conventions.md` §6。每個資源**必須**含以下 tags：

| Tag Key | 必須？ | 範例值 |
|---------|--------|--------|
| `environment` | ✅ | `uat` / `prod` |
| `owner` | ✅ | `app-team` / `infra-team` |
| `change` | ✅ | `CHANGE-055` |
| `project` | ✅ | `ai-document-extraction` |
| `cost-center` | 🟡 建議 | `SCM-APAC` |
| `data-classification` | 🟡 建議 | `internal` / `confidential` |
| `expiration` | 🟡 建議（UAT）| `2026-09-30` |

---

## 🔗 10. 與 Bicep 模板的對應

| Bicep Module | 對應 Resource | 在本 Inventory 章節 |
|-------------|--------------|------------------|
| `acr.bicep` | Azure Container Registry | §3.1 |
| `container-apps-env.bicep` | Container Apps Environment | §3.2 |
| `container-app.bicep` | Container App | §3.2 |
| `postgres.bicep` | PostgreSQL Flexible Server | §3.3 |
| `storage.bicep` | Storage Account + Blob Container | §3.4 |
| `app-insights.bicep` | Application Insights | §3.5 |
| `key-vault.bicep`（情境 B） | Key Vault | §3.6 |

**對應的 main.bicep orchestration**：
```
infrastructure/bicep/main.bicep
  ├── module acr            → §3.1
  ├── module logAnalytics   → 視情境 A/B
  ├── module appInsights    → §3.5
  ├── module storage        → §3.4
  ├── module keyVault       → §3.6（情境 B）
  ├── module postgres       → §3.3
  ├── module cae            → §3.2 Environment
  └── module containerApp   → §3.2 App + RBAC
```

**對應 az CLI 部署 Action**（雙路徑並存）：
- `uat-deployment/02-azure-resources-setup.md` Action 2.1-2.8

---

## 📝 11. 變更紀錄

| 版本 | 日期 | 變更 | 作者 |
|------|------|------|------|
| **v1.0** | 2026-04-27 | 初版（CHANGE-055 v0.3 階段 D）| AI 助手 |

**待後續更新**：
- 🟡 Infra Admin 採用 Azure Calculator 試算後，更新 §7 月成本（取代估算）
- 🟡 Infra Admin 決定情境 A vs B 後，移除 §3.6 不適用情境
- 🟡 Pilot 階段（W4-W10）實測後，依實際資源使用量更新 §3.2 / §3.3 SKU
- 🟢 Full Rollout（W11+）若升級到 Zone-redundant HA，更新 §3.3 SKU + §7 月成本

---

## 🔗 12. 相關文件

- **CHANGE-055 主規劃**：`../azure-deployment-plan.md`（§2 資源選型 + §🔟 預算 + §9 網路需求）
- **Infrastructure 入口**：`./README.md`（Optional Track 定位 + Mode A/B/C 使用）
- **命名規範**：`./naming-conventions.md`（§4 prefix 對照表 + §6 tag 標準）
- **STEP-02 Azure 資源建立**：`../uat-deployment/02-azure-resources-setup.md`（az CLI / Bicep 雙路徑）
- **STEP-03 Secrets 注入**：`../uat-deployment/03-secrets-configuration.md`（KV secret 清單對應 §3.6）
- **CHANGE-056 Schema baseline**：`../../../../claudedocs/4-changes/feature-changes/CHANGE-056-prisma-migration-baseline.md`（PG 15 baseline）

---

*文件版本: v1.0（CHANGE-055 階段 D）*
*最後更新: 2026-04-27*
*維護者: App Team + Infra Admin（共同維護）*
