# Azure 部署文件（🚧 規劃中）

> **狀態**: 📋 待規劃（CHANGE-055 尚未建立）
> **建立日期**: 2026-04-22
> **預期負責**: 待指派

本目錄將存放 AI Document Extraction 項目部署到 Azure 生產環境的所有相關文件。目前為 **placeholder**，等待 CHANGE-055 規劃啟動。

---

## ⚠️ 為何還沒寫

Azure 部署牽涉架構決策與風險評估，不適合直接動手。需要先完成規劃，才能產出具體的 IaC、Dockerfile、CI/CD pipeline、Schema migration 策略。

**相關討論**：2026-04-22 session — FIX-054 + CHANGE-054 完成後延伸討論（見 `claudedocs/8-conversation-log/daily/20260422.md`）。

---

## 📋 待規劃項目清單（9 大類）

| # | 類別 | 關鍵議題 |
|---|------|---------|
| 1 | **容器化 / 建置** | Dockerfile（multi-stage Next.js build）；target 為 App Service for Containers / Container Apps / AKS |
| 2 | **Azure 資源選型** | Database for PostgreSQL Flexible Server；Blob Storage；App Service / Container Apps / AKS；Key Vault；Container Registry (ACR) |
| 3 | **🔴 Schema 遷移策略** | 目前本地用 `prisma db push --accept-data-loss` — **在 prod 極度危險**。需設計正式 `prisma migrate` 流程或評估風險。122 models vs 10 migrations 的落差是歷史問題 |
| 4 | **🔴 Seed 策略** | prod 不應跑完整 seed（例：`dev-user-1` 不應在 prod 存在）。需要 `prod-seed.ts` 只建必要資料（roles / regions / system-user），或完全手動執行 |
| 5 | **配置注入** | Azure App Service / Container Apps 環境變數 ↔ `.env` 映射；Key Vault 引用（`@Microsoft.KeyVault(SecretUri=...)`）；FIX-054 的 `SYSTEM_USER_ID` 在 prod 對應真實 system user UUID |
| 6 | **CI/CD Pipeline** | GitHub Actions 或 Azure DevOps；`main` push → build → push ACR → deploy；PR → preview slot；DB migration 在部署前/中的時機 |
| 7 | **部署前自檢** | `scripts/verify-environment.ts` 改造為 Azure-aware（跳過 Docker 檢查、加入 Key Vault / Managed Identity 驗證） |
| 8 | **運維觀測** | Application Insights 整合；Log Analytics；Alerts（延用既有 `AlertRule` 模型？） |
| 9 | **安全強化** | HTTPS only / TLS 1.2+；`AUTH_TRUST_HOST` 關閉；Azure AD 真實 SSO；Rate limit 強制啟用（`UPSTASH_REDIS_*`） |

---

## 📐 預期文件結構（待實作）

```
02-azure-deployment/
├── README.md                          ← 本文件
├── azure-deployment-plan.md           ← CHANGE-055 總規劃
├── infrastructure/                    ← IaC
│   ├── bicep-or-terraform.md          ← 選型決策
│   └── resources-inventory.md         ← 所有 Azure 資源清單
├── pipeline/
│   ├── github-actions.md              ← CI/CD workflow 設計
│   └── deployment-flow.md             ← 部署步驟
├── database/
│   ├── migration-strategy.md          ← Schema migration 策略（🔴 critical）
│   └── seed-strategy.md               ← prod seed 設計
├── configuration/
│   ├── key-vault-integration.md       ← 敏感值管理
│   ├── environment-variables.md       ← prod env 對照表
│   └── managed-identity.md            ← Managed Identity 設定
├── observability/
│   ├── application-insights.md        ← APM 整合
│   └── alerts-and-logs.md             ← 警報與日誌
├── security/
│   ├── network-topology.md            ← VNet / Private Endpoint
│   └── hardening-checklist.md         ← 生產安全強化
└── runbooks/
    ├── first-deployment.md            ← 首次部署手冊
    ├── rollback-procedure.md          ← Rollback 程序
    └── incident-response.md           ← 事件回應
```

---

## 🔗 與本地部署的關係

不是所有本地部署資產都需要重寫。已可部分重用：

| 資產 | 可重用？ |
|------|---------|
| `.env.example` 結構（41 變數分級） | ✅ 作為 prod env 配置的基礎，但 placeholder 需換成真實值或 Key Vault 引用 |
| `FIX-054` 的 `SYSTEM_USER_ID` env 機制 | ✅ Azure 直接設環境變數即可 |
| `scripts/verify-environment.ts` | 🟡 部分可用（env/DB 檢查 OK）；Docker 容器檢查在 Azure 無意義，需要 `--production` 模式 |
| `scripts/init-new-environment.*` | ❌ 完全本地（假設 `docker-compose` + `pg_isready`），Azure 部署流程完全不同 |
| `project-initialization-guide.md` | ❌ 專注本地；Azure 需獨立 guide |
| Seed 腳本 `prisma/seed.ts` | ⚠️ 部分可用；dev-user-1 區塊在 prod 應移除 |

---

## 🚦 下一步

1. **建立 CHANGE-055 規劃文件**（`claudedocs/4-changes/feature-changes/CHANGE-055-azure-deployment-foundation.md`）
   - 範圍定義、架構決策、effort 估算
2. **架構評審**（與 DevOps / 安全團隊討論）
3. **PoC**：選定一個最小可行組合（例：Container Apps + Database Flexible Server + Key Vault）
4. **撰寫本目錄下的所有文件**
5. **首次部署演練**

---

## 📞 聯絡與討論

- 部署頂層導覽：[`../README.md`](../README.md)
- 本地部署對照：[`../01-local-deployment/README.md`](../01-local-deployment/README.md)
- 相關 session 紀錄：`claudedocs/8-conversation-log/daily/20260422.md`
