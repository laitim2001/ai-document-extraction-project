# 部署文件中心

> **最後更新**: 2026-04-22
> **目錄版本**: 2.0（CHANGE-054 後重構為本地 / Azure 兩大分支）

本目錄集中管理 AI Document Extraction 項目的所有部署相關文件，依**目標環境**分為兩大分支。

---

## 📂 目錄結構

```
docs/06-deployment/
├── README.md                              ← 你在這裡（頂層導覽）
│
├── 01-local-deployment/                   ✅ 已完整（CHANGE-054）
│   ├── README.md                          ← 本地部署索引
│   ├── project-initialization-guide.md    ← 主要參考（724 行完整指南）
│   ├── environment-variables-reference.md ← 41 個 env 變數詳解
│   ├── docker-services-architecture.md    ← Docker 容器架構與操作
│   ├── cross-computer-workflow.md         ← 跨電腦開發同步
│   └── onboarding-checklist.md            ← 新開發者首日 checklist
│
└── 02-azure-deployment/                   🚧 規劃中（CHANGE-055 待建）
    └── README.md                          ← Placeholder + 待規劃項目清單
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
| ☁️ **Azure 生產部署** | [`02-azure-deployment/README.md`](02-azure-deployment/README.md)（待規劃） |

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

## 📋 環境對比

| 面向 | 本地開發 | Azure 生產（待規劃） |
|------|---------|---------------------|
| 資料庫 | docker postgres:5433 | Azure Database for PostgreSQL Flexible Server |
| Blob Storage | Azurite（模擬器）:10010 | Azure Blob Storage |
| OCR | docker python-services:8000 | Azure Container Apps / Function |
| 應用主體 | `npm run dev`（本機 :3005） | Azure Container Apps / App Service |
| 環境變數 | `.env` 檔案 | App Service Settings / Key Vault |
| SSO | Dev mode（任意 email） | Azure AD (Entra ID) 真實認證 |
| Schema migration | `prisma db push --accept-data-loss` | ⚠️ 待設計正式 migration 流程 |
| Seed 策略 | 完整 seed（含 dev-user-1） | ⚠️ 待決策（prod-seed 或手動） |

---

## 🔗 相關資源

- **CHANGE-054**: 本地部署可靠性強化（已完成）→ `claudedocs/4-changes/feature-changes/CHANGE-054-*.md`
- **FIX-054**: SYSTEM_USER_ID 硬編碼修正（已完成）→ `claudedocs/4-changes/bug-fixes/FIX-054-*.md`
- **腳本**: `scripts/init-new-environment.{sh,ps1}` + `scripts/verify-environment.ts`
- **範本**: `.env.example`（41 個變數 / 3 級分類）
