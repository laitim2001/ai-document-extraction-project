# 部署文件中心

> **最後更新**: 2026-06-08
> **目錄版本**: 2.1（新增 local-vs-azure 差異對照；Azure DEV 實施中 CHANGE-055）

本目錄集中管理 AI Document Extraction 項目的所有部署相關文件，依**目標環境**分為兩大分支。

---

## 📂 目錄結構

```
docs/07-deployment/
├── README.md                              ← 你在這裡（頂層導覽）
├── local-vs-azure-differences.md          ← 🆕 本地 ↔ Azure 差異權威對照（必讀）
│
├── 01-local-deployment/                   ✅ 已完整（CHANGE-054）
│   ├── README.md                          ← 本地部署索引
│   ├── project-initialization-guide.md    ← 主要參考（724 行完整指南）
│   ├── environment-variables-reference.md ← 41 個 env 變數詳解
│   ├── docker-services-architecture.md    ← Docker 容器架構與操作
│   ├── cross-computer-workflow.md         ← 跨電腦開發同步
│   └── onboarding-checklist.md            ← 新開發者首日 checklist
│
└── 02-azure-deployment/                   🚧 實施中（CHANGE-055 / DEV 環境）
    ├── README.md                          ← Azure 部署索引
    ├── azure-deployment-plan.md           ← 主規劃（10 項決策）
    ├── uat-deployment/                    ← 12 份人 + AI 可讀步驟文件
    └── infrastructure/                    ← Bicep 模板 + 資源規格清單
```

---

## 🎯 依情境快速導覽

| 情境 | 去哪裡 |
|------|--------|
| 🆕 **第一次在本機執行專案** | [`01-local-deployment/README.md`](01-local-deployment/README.md) → 看 Quick Start |
| 👨‍💻 **新開發者入職 Day 1** | [`01-local-deployment/onboarding-checklist.md`](01-local-deployment/onboarding-checklist.md) |
| 🔄 **切換電腦繼續開發** | [`01-local-deployment/cross-computer-workflow.md`](01-local-deployment/cross-computer-workflow.md) |
| 🔍 **查某個 env 變數用途** | [`01-local-deployment/environment-variables-reference.md`](01-local-deployment/environment-variables-reference.md) |
| 🐳 **Docker 容器相關操作** | [`01-local-deployment/docker-services-architecture.md`](01-local-deployment/docker-services-architecture.md) |
| 🐛 **遇到部署錯誤** | [`01-local-deployment/project-initialization-guide.md#9-常見問題排解`](01-local-deployment/project-initialization-guide.md) |
| 🔀 **搞清楚本地與 Azure 的差別** | [`local-vs-azure-differences.md`](local-vs-azure-differences.md) — 🆕 權威逐項對照 |
| ☁️ **Azure 部署** | [`02-azure-deployment/README.md`](02-azure-deployment/README.md)（實施中 / DEV 環境） |

---

## 🚀 一鍵本地部署

```bash
# 前置：Docker Desktop 啟動 + git clone 完成
./scripts/init-new-environment.sh         # Unix / Git Bash
.\scripts\init-new-environment.ps1        # Windows PowerShell
npm run init-env                          # 或透過 npm
```

完整流程說明：[`01-local-deployment/project-initialization-guide.md`](01-local-deployment/project-initialization-guide.md)

---

## 📋 環境對比（速覽）

> **完整逐項差異 → [`local-vs-azure-differences.md`](local-vs-azure-differences.md)**（權威對照）。以下為速覽：

| 面向 | 本地開發 | Azure DEV（實施中） |
|------|---------|---------------------|
| 資料庫 | docker postgres:5433（user `postgres`） | Azure PostgreSQL Flexible（私有端點，user `raposcmaidocprocessingdev`、`sslmode=require`） |
| Blob Storage | Azurite（模擬器）:10010 | 真實 Azure Blob Storage（`stscmdocprocessingdev`） |
| 應用主體 | `npm run dev`（本機 :3005） | App Service for Containers（容器 :3000，HTTPS） |
| 環境變數 | `.env` 檔案 | App Service 應用程式設定 |
| 部署機密 | — | `.env.azure-dev.local`（gitignored，僅部署操作時讀） |
| SSO / 登入 | Dev mode（任意 email） | 真實密碼驗證（`NODE_ENV=production`） |
| Schema 建立 | `prisma db push`（手動） | 容器啟動 `bootstrap-db.js` 套 `init.sql`（自動，僅空庫） |
| Seed 策略 | `prisma/seed.ts`（含 dev-user-1 + 測試資料） | `prisma/seed-prod-essential.ts`（必要資料 + 管理員，無測試污染） |
| 預設管理員 | `admin@ai-document-extraction.com` | `admin@rci-t.com`（密碼來自 `SEED_ADMIN_PASSWORD`） |

---

## 🔗 相關資源

- **CHANGE-054**: 本地部署可靠性強化（已完成）→ `claudedocs/4-changes/feature-changes/CHANGE-054-*.md`
- **FIX-054**: SYSTEM_USER_ID 硬編碼修正（已完成）→ `claudedocs/4-changes/bug-fixes/FIX-054-*.md`
- **腳本**: `scripts/init-new-environment.{sh,ps1}` + `scripts/verify-environment.ts`
- **範本**: `.env.example`（41 個變數 / 3 級分類）
