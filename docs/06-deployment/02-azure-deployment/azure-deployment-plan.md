# Azure 生產部署主規劃（CHANGE-055）

> **建立日期**: 2026-04-22
> **狀態**: 📋 規劃中（Phase 1：技術決策階段）
> **追蹤**: CHANGE-055
> **前置**: CHANGE-054 + FIX-054 已完成（本地部署可靠性與 SYSTEM_USER_ID 可覆蓋機制）

本文件是 AI Document Extraction 項目部署到 Azure 生產環境的**主規劃文件**。涵蓋所有架構決策、選型比較、風險評估、分階段實施路徑。

---

## 📐 整體目標架構（草案）

```
┌─────────────────────────────────────────────────────────────────┐
│  Azure Subscription                                              │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Resource Group: rg-ai-document-extraction-prod            │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │ Container   │  │ App Service  │  │ Static Web App   │  │ │
│  │  │ Apps        │◄─┤ Plan（或     │  │ （如需純前端）   │  │ │
│  │  │ (Next.js)   │  │ Container    │  └──────────────────┘  │ │
│  │  │             │  │ Apps Env）   │                         │ │
│  │  └──────┬──────┘  └──────────────┘                         │ │
│  │         │                                                    │ │
│  │         ├───────► Azure Database for PostgreSQL             │ │
│  │         │           Flexible Server                           │ │
│  │         │                                                    │ │
│  │         ├───────► Azure Blob Storage                        │ │
│  │         │                                                    │ │
│  │         ├───────► Azure OpenAI Service                      │ │
│  │         │                                                    │ │
│  │         ├───────► Document Intelligence                     │ │
│  │         │                                                    │ │
│  │         ├───────► Key Vault (secrets + encryption keys)     │ │
│  │         │                                                    │ │
│  │         ├───────► Container Registry (ACR)                  │ │
│  │         │                                                    │ │
│  │         └───────► Application Insights + Log Analytics      │ │
│  │                                                              │ │
│  │  Optional:                                                   │ │
│  │  - VNet + Private Endpoints                                  │ │
│  │  - Front Door / Application Gateway                          │ │
│  │  - Service Bus（若未來加入異步處理）                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

CI/CD: GitHub Actions → ACR → Container Apps rolling update
```

---

## 1️⃣ 容器化 / 建置

### 決策 1.1：Dockerfile 架構
**目標**：multi-stage Next.js production image，minimal size

```dockerfile
# 預期結構（草案）
FROM node:20-alpine AS deps
# ...install
FROM node:20-alpine AS builder
# ...build
FROM node:20-alpine AS runner
# ...standalone output + static
```

**必須包含**：
- `next.config.ts` 開啟 `output: 'standalone'`
- Prisma Client 生成（建置時）
- 非 root user 執行
- Health check endpoint（`/api/health`）

**Effort**：~1 天實作 + 半天優化 image size

### 決策 1.2：Image Registry
| 選項 | 優點 | 缺點 |
|------|------|------|
| **Azure Container Registry (ACR)** | Azure 生態整合、Managed Identity、VNet 支援 | 額外費用 |
| Docker Hub（public） | 免費 | 🔴 私有鏡像需付費，Rate limit 風險 |
| GitHub Container Registry | GitHub Actions 整合方便 | Azure 拉取需配置 |

**推薦**：**ACR**（符合企業級需求）

---

## 2️⃣ Azure 資源選型

### 決策 2.1：應用主體運算

| 選項 | 適用場景 | 本專案契合度 |
|------|---------|------------|
| **Azure Container Apps** | 容器化、自動 scale、serverless | ⭐⭐⭐⭐⭐ 推薦 |
| App Service for Containers | 傳統 PaaS、簡單部署 | ⭐⭐⭐⭐ 備選 |
| AKS（Kubernetes） | 大規模、複雜拓撲 | ⭐⭐ 過度工程化 |
| Azure Functions | 短任務 / 事件驅動 | ❌ Next.js 不適合 |

**推薦**：**Container Apps**
- 理由：符合 Next.js standalone build、自動 scale、無 K8s 運維負擔、支援 Revision 部署
- Revision 模式可做 blue/green 或 canary

### 決策 2.2：資料庫

| 選項 | 適用場景 | 本專案契合度 |
|------|---------|------------|
| **Azure Database for PostgreSQL Flexible Server** | PostgreSQL PaaS，最新版本 | ⭐⭐⭐⭐⭐ 推薦 |
| Azure Cosmos DB (PostgreSQL API) | 水平擴展、多地區 | ⭐⭐ 成本高、本專案不需要 |
| Azure Database for PostgreSQL Single Server | Legacy，將 deprecate | ❌ 不選 |

**推薦**：**Flexible Server**
- 版本：PostgreSQL 15（與本地一致）
- Tier：依負載估算（Burstable B2s PoC / General Purpose 正式）
- High Availability：Zone-redundant（推薦正式環境）

### 決策 2.3：Blob Storage
- **Azure Blob Storage** — 與 Azurite 本地完全對應，現有代碼無需改動
- Container 命名：`documents`（與 `AZURE_STORAGE_CONTAINER` env 一致）
- Access：Private + SAS token 或 Managed Identity（推薦後者）

### 決策 2.4：Secrets / Config

| 層級 | 工具 |
|------|------|
| 一般 config（非敏感） | Container Apps env vars |
| 敏感 secrets | **Azure Key Vault**（通過 Managed Identity 讀取） |
| 引用方式 | Container Apps secret reference syntax：`@Microsoft.KeyVault(SecretUri=...)` |

**必進 Key Vault**：
- `AUTH_SECRET` / `JWT_SECRET` / `SESSION_SECRET` / `ENCRYPTION_KEY`
- `AZURE_OPENAI_API_KEY` / `AZURE_DI_KEY`
- `AZURE_STORAGE_CONNECTION_STRING`（或改用 Managed Identity + `DefaultAzureCredential`）
- 所有 Microsoft Graph credentials

### 決策 2.5：IaC 工具

| 選項 | 優點 | 缺點 |
|------|------|------|
| **Bicep** | Azure 原生、簡潔、ARM Template 升級 | 僅限 Azure |
| Terraform | 多雲、生態成熟 | 需額外學習 |
| ARM Templates | 原始 | JSON 冗長、難讀 |
| Pulumi（TypeScript） | 與專案語言一致 | 新工具、團隊熟悉度 |

**推薦**：**Bicep**（Azure-first 專案的最佳選擇）
- 目錄：`infrastructure/bicep/`
- 分層：`main.bicep` + `modules/`（每個資源一個 module）

---

## 3️⃣ 🔴 Schema Migration 策略（Critical）

### 現況
- 本地使用 `prisma db push --accept-data-loss`
- Prisma Schema 定義 122 models / 113 enums
- `prisma/migrations/` 只有 10 個 migrations（停留在 2025-12-19）

### 方案 A：**重建 Migration 基線（推薦）**

**步驟**：
1. 從**乾淨**的資料庫執行 `prisma migrate dev --name initial_baseline`，讓 Prisma 自動生成涵蓋所有 122 models 的 migration
2. 驗證此 migration 能完整建立 schema
3. 之後所有 schema 變更都走 `prisma migrate dev`（不再 `db push`）
4. 生產部署用 `prisma migrate deploy`

**優點**：
- ✅ 有完整的 migration 歷史
- ✅ Prod 部署可追溯、可 rollback
- ✅ 符合 Prisma 官方最佳實踐

**缺點**：
- ⚠️ 既有本地開發環境需**重新初始化 migration history**
- ⚠️ 過去所有 schema 變更會被壓縮成單一 "initial baseline" migration
- ⚠️ 若已部署過某個 prod 環境，需 `prisma migrate resolve` 同步狀態

### 方案 B：**接受 `db push` 繼續使用**

- 生產部署也用 `prisma db push --skip-seed`（不用 --accept-data-loss）
- 僅在破壞性變更時手動寫 migration

**優點**：簡單
**缺點**：🔴 prod 無法可靠 rollback，資料損失風險

### 推薦：**方案 A**
- 作為獨立 CHANGE 追蹤（CHANGE-056? `prisma-migration-baseline`）
- 先在本地驗證完整流程後，才能用在 prod

### 方案 A 執行順序（建議）
1. 建立空 DB → `prisma migrate dev --name initial_baseline`
2. Diff 比對：`initial_baseline` 產生的 schema vs 現有 DB 的 schema（確保無漏）
3. 在 staging 環境驗證
4. 保留既有 10 個 migrations 或歸檔（TBD）

---

## 4️⃣ 🔴 Seed 策略

### 區分兩類 seed

| 類別 | 範圍 | 是否進 prod？ |
|------|------|--------------|
| **System Baseline Seed**（必要） | Roles、Regions、Cities、System User、Default System Configs | ✅ 必須 |
| **Reference Data Seed**（可選） | Companies（DHL/FedEx 等）、Mapping Rules、Prompt Configs、Exchange Rates | ✅ 推薦 |
| **Development Seed**（不進 prod） | Dev User (`dev-user-1`)、Test Companies、`exported-data.json` 測試資料 | ❌ 不進 prod |

### 設計決策

建立 `prisma/seed-prod.ts`，與現有 `prisma/seed.ts` 並存：
```
prisma/
├── seed.ts           ← 本地/dev（現有，含 dev-user-1）
├── seed-prod.ts      ← production（不含 dev-user-1，不含 exported-data）
└── seed-data/        ← 共用資料模組
```

`package.json`：
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

Production 執行：
```bash
npx ts-node prisma/seed-prod.ts
```

### Seed 執行時機
- **首次部署**：手動一次性執行（DBA approval）
- **後續更新**：不再自動 seed（避免覆寫 prod 資料）；reference data 變更透過 admin UI 或專用 migration script

### System User 建立
- FIX-054 機制已支援 `SYSTEM_USER_ID` env 覆蓋
- Prod `seed-prod.ts` 建立固定 `system-user-1` 或手動指定 UUID
- 透過 Key Vault secret 或 Container Apps env var 注入

---

## 5️⃣ 配置注入

### 映射表：`.env` ↔ Azure

| `.env` 變數 | Azure 位置 | 機制 |
|------------|-----------|------|
| `DATABASE_URL` | Key Vault secret → Container Apps secret ref | Managed Identity |
| `AUTH_SECRET` / `JWT_SECRET` / `SESSION_SECRET` / `ENCRYPTION_KEY` | Key Vault | secret ref |
| `AZURE_OPENAI_*` / `AZURE_DI_*` | Key Vault（API keys） + Container Apps env（endpoint） | 分開 |
| `AZURE_STORAGE_*` | Managed Identity + DefaultAzureCredential | 改代碼（移除 connection string 寫法） |
| `SYSTEM_USER_ID` | Container Apps env var | 直接設 |
| `NODE_ENV` | Container Apps env var | `"production"` |
| `AUTH_TRUST_HOST` | Container Apps env var | `"false"`（已走 HTTPS） |
| `AUTH_URL` | Container Apps env var | 正式域名 |
| `NEXT_PUBLIC_APP_URL` | Container Apps env var | 正式域名 |

### Managed Identity 優先
凡是能用 Managed Identity 的地方都用（減少 secret rotation 負擔）：
- Blob Storage → System-Assigned Identity + Storage Blob Data Contributor role
- Key Vault → System-Assigned Identity + Get/List secrets policy
- Azure OpenAI → Managed Identity + Cognitive Services User role（若支援）

---

## 6️⃣ CI/CD Pipeline

### 推薦：GitHub Actions

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy to Azure Production
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'prisma/**'
      - 'package.json'
      - 'Dockerfile'

jobs:
  test:
    # npm run type-check + lint
  build-and-push:
    needs: test
    # docker build + push to ACR
  migrate:
    needs: build-and-push
    # prisma migrate deploy（連 prod DB 執行）
  deploy:
    needs: migrate
    # az containerapp update --image ACR/...
```

### 關鍵設計
- **Migration 在 deploy 前**：避免 app 啟動時 schema 不符
- **Migration 失敗則中止 deploy**：保護資料庫
- **Blue/Green via Container Apps Revisions**：流量切換零 downtime
- **Rollback**：`az containerapp revision set-mode --mode single --revision <previous>`

### Pull Request Preview（可選）
- 每個 PR 自動部署到獨立 revision（不同 weight）
- PR merge / close 後清理
- 成本較高，先不實施

---

## 7️⃣ 部署前自檢

### `verify-environment.ts` 改造為 Azure-aware

新增 `--production` flag：
```bash
npm run verify-environment -- --production
```

**production 模式差異**：
| 檢查項 | local | production |
|--------|-------|-----------|
| Docker 容器 | 檢查 | **跳過** |
| DATABASE_URL port | 5433 預期 | 5432 預期（Flexible Server） |
| Placeholder 偵測 | ✅ | ✅（更嚴格） |
| Key Vault 可達性 | - | **新增檢查** |
| Managed Identity | - | **新增檢查** |
| Application Insights 連線 | - | **新增檢查** |

實作方式：
- 環境變數 `NODE_ENV=production` 時自動啟用 production 模式
- 或 CLI flag `--production`

---

## 8️⃣ 運維觀測

### Application Insights 整合
```typescript
// 預期新增 src/lib/telemetry.ts
import { ApplicationInsights } from '@microsoft/applicationinsights-web'
```

**追蹤項目**：
- 所有 API route 延遲
- V3 extraction pipeline 各 stage 耗時
- Prisma query 效能
- 外部 API 失敗率（Azure OpenAI / Document Intelligence）

### 既有 `AlertRule` model 整合
- 本地 `AlertRule` / `AlertRecord` 繼續作為「業務層警報」
- Azure Monitor Alerts 做「基礎設施層警報」
- 兩者可透過 webhook 雙向同步

### Log 策略
- 應用 log → `stdout` → Container Apps log → Log Analytics
- 結構化 log（JSON）方便查詢
- PII 過濾（與 FIX-050 同樣嚴格）

---

## 9️⃣ 安全強化

### HTTPS Only / TLS 1.2+
- Container Apps 預設 HTTPS ingress
- Custom domain + managed certificate
- `AUTH_TRUST_HOST="false"`

### Azure AD 真實 SSO
- 關閉 dev mode（`NODE_ENV=production` 時 `auth.config.ts` 已跳過 dev bypass）
- Azure AD App Registration 正式設定
- Conditional Access policies

### Rate Limit 強制啟用
- Upstash Redis 正式配置（`UPSTASH_REDIS_REST_URL` / `_TOKEN`）
- 所有 API 啟用 rate limit middleware（FIX-052 已支援 Redis 優先）

### Network 層級（可選，企業級推薦）
- VNet + Private Endpoints（DB / Key Vault / Storage 不走 public internet）
- Network Security Groups
- Web Application Firewall（Azure Front Door）

### Secret Rotation
- `AUTH_SECRET` / `JWT_SECRET` / `SESSION_SECRET`：每季輪替
- `ENCRYPTION_KEY`：🔴 **不可變更**（變更會讓加密資料無法解密）
- Azure OpenAI / DI API Keys：半年輪替
- 文件化於 `security/secret-rotation-runbook.md`（待建）

---

## 📊 Effort 估算

| Phase | 子項 | Effort（Person-Day） | 依賴 |
|-------|------|---------------------|------|
| **1.1** 主規劃文件 | 本文件 | 1 | — |
| **1.2** 架構評審 | 會議 + 反覆討論 | 2-3 | DevOps / 安全團隊可用時間 |
| **1.3** Schema migration 策略決策 | 研究 + PoC | 2-3 | — |
| **Phase 1 total** | | **~6-7 days** | |
| **2.1** Dockerfile + build | | 2 | Phase 1 完成 |
| **2.2** Bicep IaC | | 4-5 | 架構評審通過 |
| **2.3** Key Vault 整合代碼 | | 2 | — |
| **2.4** verify-environment --production | | 1 | — |
| **2.5** seed-prod.ts | | 2 | Schema migration 策略定 |
| **2.6** Schema migration 正式化 | | 3-5 | Phase 1 決策 |
| **Phase 2 total** | | **~14-17 days** | |
| **3.1** GitHub Actions workflow | | 3 | Phase 2 完成 |
| **3.2** Migration hook | | 2 | — |
| **3.3** 首次部署演練 | | 2 | 所有 Phase 2 完成 |
| **Phase 3 total** | | **~7 days** | |
| **4.1** App Insights 整合 | | 3 | 部署成功後 |
| **4.2** Alert rules | | 2 | — |
| **4.3** VNet / Private Endpoint（可選） | | 3-5 | 正式上線前 |
| **4.4** Secret rotation docs | | 1 | — |
| **Phase 4 total** | | **~9-11 days** | |
| **🎯 Grand total** | | **~36-42 days（~2 個月）** | |

> 注意：Effort 為**單人估算**且不含阻塞時間（架構評審、Azure 資源申請、安全合規審查）。實際 elapsed time 會更長。

---

## 🛣️ 分階段實施路徑

```
Phase 1（本 CHANGE-055，~1-2 週）
  規劃 → 評審 → 決策定案
        │
        ▼
Phase 2（CHANGE-056~058，~3 週）
  IaC + 容器化 + Schema migration + Key Vault
        │
        ▼
Phase 3（CHANGE-059~060，~1.5 週）
  CI/CD + 首次部署演練
        │
        ▼
Phase 4（CHANGE-061+，~2 週）
  Observability + Security hardening
        │
        ▼
🚀 Go-Live
```

---

## 🚦 Gate Criteria（階段轉換條件）

### Phase 1 → Phase 2
- [ ] 本文件所有決策項目有明確結論（不再是「推薦 X」，而是「已決定 X」）
- [ ] 架構評審會議紀錄歸檔
- [ ] Schema migration 策略 PoC 通過
- [ ] Effort 估算獲得核准

### Phase 2 → Phase 3
- [ ] 手動部署能從 local Docker image 推到 Container Apps 並成功啟動
- [ ] Key Vault secret reference 可成功讀取
- [ ] Managed Identity 與 Storage / DB 連線正常
- [ ] `verify-environment.ts --production` 可在 Azure 環境運作

### Phase 3 → Phase 4
- [ ] GitHub Actions workflow 端對端成功（含 migration）
- [ ] Blue/Green 部署演練通過
- [ ] Rollback 程序驗證
- [ ] 首次 smoke test 通過

### Phase 4 → Go-Live
- [ ] Application Insights 追蹤所有關鍵路徑
- [ ] Alert rules 通過演練
- [ ] Penetration test 或安全審查
- [ ] Disaster Recovery 演練
- [ ] 資料備份 / 還原 runbook

---

## 📂 預期子文件結構（待實施）

```
02-azure-deployment/
├── README.md                           ← 目錄索引（已存在）
├── azure-deployment-plan.md            ← 本文件（主規劃）
├── infrastructure/                     ← Phase 2
│   ├── bicep-decision.md               ← IaC 工具選型決策記錄
│   ├── resources-inventory.md          ← 所有 Azure 資源清單
│   └── naming-conventions.md           ← 命名規範
├── pipeline/                           ← Phase 3
│   ├── github-actions.md               ← CI/CD workflow 設計
│   └── deployment-flow.md              ← 部署步驟 runbook
├── database/                           ← Phase 1-2
│   ├── migration-strategy.md           ← Schema migration 策略（🔴 critical）
│   └── seed-strategy.md                ← production-seed 設計
├── configuration/                      ← Phase 2
│   ├── key-vault-integration.md        ← 敏感值管理
│   ├── environment-variables.md        ← prod env 對照表
│   └── managed-identity.md             ← MI 設定
├── observability/                      ← Phase 4
│   ├── application-insights.md         ← APM 整合
│   └── alerts-and-logs.md              ← 警報與日誌
├── security/                           ← Phase 4
│   ├── network-topology.md             ← VNet / Private Endpoint
│   ├── hardening-checklist.md          ← 生產安全強化
│   └── secret-rotation-runbook.md      ← Secret 輪替手冊
└── runbooks/                           ← Phase 3+
    ├── first-deployment.md             ← 首次部署手冊
    ├── rollback-procedure.md           ← Rollback 程序
    ├── incident-response.md            ← 事件回應
    └── disaster-recovery.md            ← 災難還原
```

---

## ❓ 待決策項目（需要你確認）

1. **運算選型**：Container Apps vs App Service for Containers？
2. **IaC 工具**：Bicep vs Terraform？
3. **Schema migration 方案**：A（重建基線）vs B（繼續 db push）？
4. **Seed 時機**：手動一次性 vs 每次部署自動？
5. **Phase 時程**：是否接受 ~2 個月 elapsed time？
6. **評審流程**：DevOps / 安全團隊誰需要參與架構評審？
7. **預算**：Azure 資源月成本限制？（會影響 tier 選擇）
8. **上線目標日期**：是否有硬性 deadline？
9. **HA 要求**：是否需要 Zone-redundant 部署？（成本 +50%）
10. **網路架構**：是否需要 VNet + Private Endpoint？（企業級 +複雜度）

---

## 🔗 關聯文件

- **CHANGE-055 追蹤**：`claudedocs/4-changes/feature-changes/CHANGE-055-azure-deployment-foundation.md`
- **Azure 目錄 README**：`README.md`（同目錄）
- **本地部署對照**：`../01-local-deployment/`
- **FIX-054**（SYSTEM_USER_ID 可覆蓋）：`claudedocs/4-changes/bug-fixes/FIX-054-*.md`
- **CHANGE-054**（本地部署可靠性）：`claudedocs/4-changes/feature-changes/CHANGE-054-*.md`
- **討論紀錄**：`claudedocs/8-conversation-log/daily/20260422.md` §Azure 部署議題

---

## 📝 修訂歷史

| 日期 | 版本 | 變更 |
|------|------|------|
| 2026-04-22 | 0.1（初稿） | 9 大類決策架構、Phase 規劃、Effort 估算 |
| 待定 | 0.2 | 架構評審後的決策定案 |
| 待定 | 1.0 | Phase 1 完成，進入實施階段 |

---

*文件建立日期: 2026-04-22*
*維護者: AI 助手 + 開發團隊*
*狀態: 📋 Phase 1 規劃中*
