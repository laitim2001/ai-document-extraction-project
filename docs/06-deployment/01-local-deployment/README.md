# 本地部署文件

> **最後更新**: 2026-04-22（CHANGE-054）
> **適用對象**: 本機開發環境（macOS / Windows / Linux + Docker Desktop）
> **不適用**: Azure 生產部署（見 [`../02-azure-deployment/`](../02-azure-deployment/)）

---

## 📖 文件導覽

| 文件 | 用途 | 何時看 |
|------|------|--------|
| [**project-initialization-guide.md**](./project-initialization-guide.md) | 🌟 **主要參考**：724 行完整部署指南 | 任何時候 — 這是最權威的單一入口 |
| [environment-variables-reference.md](./environment-variables-reference.md) | 41 個 `.env` 變數逐一詳解 | 查變數用途、生成方式、缺失影響 |
| [docker-services-architecture.md](./docker-services-architecture.md) | 5 個容器架構、port、volume、日誌 | 理解 Docker 網路；除錯容器問題 |
| [cross-computer-workflow.md](./cross-computer-workflow.md) | 跨電腦同步流程 + FIX-054 遷移 | 在多台電腦間切換開發 |
| [onboarding-checklist.md](./onboarding-checklist.md) | 新開發者 Day-1 checklist | 新人入職 |

---

## 🎯 快速決策

```
我是誰？想做什麼？
│
├─ 新人第一天 → onboarding-checklist.md
│
├─ 全新環境想跑起來
│     ├─ 快：./scripts/init-new-environment.sh（然後看 project-initialization-guide.md Section 0）
│     └─ 偵錯：project-initialization-guide.md Section 1-6（手動 10 步）
│
├─ 切換電腦 → cross-computer-workflow.md
│
├─ 查變數或 placeholder → environment-variables-reference.md
│
├─ 容器壞了 / port 佔用 / 日誌看不懂 → docker-services-architecture.md
│
└─ 啟動失敗有錯誤訊息 → project-initialization-guide.md Section 9（問題 1-9）
```

---

## 🏃 3 分鐘總覽

### 本地環境需要 5 個 Docker 容器
| 容器 | Port | 用途 | 缺了會怎樣 |
|------|------|------|-----------|
| `ai-doc-extraction-db` | 5433 | PostgreSQL 15 | 應用完全無法啟動 |
| `ai-doc-extraction-azurite` | 10010-10012 | Azure Blob 模擬 | 文件上傳失敗 |
| `ai-doc-extraction-ocr` | 8000 | Python OCR | OCR 提取不可用 |
| `ai-doc-extraction-mapping` | 8001 | Python Mapping | 映射服務不可用 |
| `ai-doc-extraction-pgadmin` | 5050 | DB 管理 UI | 僅工具性，不影響應用 |

### 一鍵啟動（推薦）
```bash
docker-compose up -d        # Docker 服務
./scripts/init-new-environment.sh  # 10 步自動化
npm run verify-environment  # 27 項自檢
npm run dev                 # 啟動 Next.js
```

### 必要 env 變數（11 個 🔴）
`DATABASE_URL` / `AUTH_SECRET` / `AUTH_URL` / `AUTH_TRUST_HOST` / `JWT_SECRET` / `JWT_EXPIRES_IN` / `SESSION_SECRET` / `ENCRYPTION_KEY` / **`SYSTEM_USER_ID`** / `NEXT_PUBLIC_APP_URL` / `NODE_ENV`

### 預設帳號
| 帳號 | 用途 |
|------|------|
| `admin@ai-document-extraction.com` / `ChangeMe@2026!` | 管理員（密碼登入） |
| `dev@example.com`（無密碼） | Dev mode 登入測試 |

---

## 🔗 相關文件

- 部署頂層導覽：[`../README.md`](../README.md)
- 規劃文件：`claudedocs/4-changes/feature-changes/CHANGE-054-*.md`
- 修復文件：`claudedocs/4-changes/bug-fixes/FIX-054-*.md`
- 根 CLAUDE.md 「跨電腦開發協作」章節
- `.env.example`（專案根目錄）
- `scripts/init-new-environment.sh` / `.ps1` / `verify-environment.ts`
