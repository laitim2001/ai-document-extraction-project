# 本地開發 vs Azure 部署 — 環境差異權威對照

> **建立日期**: 2026-06-08
> **狀態**: ✅ 權威參考（本地 ↔ Azure DEV 配置與行為差異的單一真實來源）
> **適用**: 所有在本項目持續開發 / 部署的人與 AI 助手
> **相關**: [`01-local-deployment/`](./01-local-deployment/)（本地細節）、[`02-azure-deployment/`](./02-azure-deployment/)（Azure 細節）

---

## 🎯 為什麼有這份文件

本項目**同時**需要：
- 在**本機持續開發與測試**（`npm run dev` + Docker 模擬服務）
- **部署到 Azure**（DEV → UAT → PROD）

兩者的配置與行為**不同**（最明顯：本地用 Azurite 模擬 Blob，Azure 用真實 Azure Blob Storage）。為避免兩套流程互相污染、避免「在本地能跑、上 Azure 卻掛」或反之，**本文件明確列出每一處差異**。

> 🔴 **核心原則**：任何改動先分類為 **本地專屬 / Azure 專屬 / 共用**，三者不可混淆。
> 共用程式碼（`src/`）以「讀環境變數」適應兩種環境，**絕不**為單一環境硬編碼。

---

## 📊 1. 總覽對照表

| 面向 | 🖥️ 本地開發（`npm run dev`） | ☁️ Azure DEV（App Service 容器） |
|------|------------------------------|----------------------------------|
| **啟動方式** | `npm run dev`（Next.js dev server, port 3005） | Docker 容器 → `scripts/docker-entrypoint.sh`（port 3000 內部） |
| **設定來源** | `.env`（專案根目錄，gitignored） | App Service「應用程式設定」（環境變數） |
| **部署用機密** | 不適用 | `.env.azure-dev.local`（gitignored，**僅部署操作時讀取**，不入映像） |
| **資料庫** | 本機 Docker `postgres:15` @ `localhost:5433`（user `postgres`） | Azure PostgreSQL Flexible @ 私有端點（user `raposcmaidocprocessingdev`，`sslmode=require`） |
| **Blob 儲存** | **Azurite 模擬器** @ `localhost:10010`（帳號 `devstoreaccount1`） | **真實 Azure Blob Storage**（`stscmdocprocessingdev`，私有端點） |
| **OCR / AI（Document Intelligence + OpenAI）** | 呼叫真實 Azure 服務（**無本地模擬器**） | 呼叫真實 Azure 服務 |
| **Python 微服務（OCR/Mapping）** | 本機 Docker `:8000` / `:8001` | （視 Azure 部署方式，另行規劃） |
| **建立 Schema** | `prisma db push`（手動執行） | 容器啟動時 `prisma/bootstrap-db.js` 套用 `init.sql`（**自動，僅空庫**） |
| **Seed 資料** | `prisma/seed.ts`（含 `dev-user-1` + 測試資料） | `prisma/seed-prod-essential.ts`（**僅必要資料 + 管理員，無測試污染**） |
| **預設管理員** | `admin@ai-document-extraction.com`（seed.ts 內定） | `admin@rci-t.com`（由 `SEED_ADMIN_PASSWORD` 設定密碼） |
| **登入模式** | dev 旁路：任意 email 可登入（`NODE_ENV=development` 且未設真實 Azure AD） | 真實密碼驗證（`NODE_ENV=production`，旁路關閉） |
| **HTTPS / 網域** | `http://localhost:3005` | HTTPS（App Service 預設網域 + 自訂網域 `rci-t.com`） |

---

## 🔍 2. 各面向細節

### 2.1 資料庫（PostgreSQL）

| | 本地 | Azure DEV |
|---|------|-----------|
| 連線 | `postgresql://postgres:postgres@localhost:5433/ai_document_extraction?schema=public` | `postgresql://raposcmaidocprocessingdev:<pwd>@pgsql-raposcm-aidocprocessing-dev.postgres.database.azure.com:5432/ai_document_extraction?sslmode=require` |
| 來源 | docker-compose 容器 | Azure PostgreSQL Flexible（私有端點，僅 VNet 內可達） |
| 帳號 | `postgres`（超級權限） | `raposcmaidocprocessingdev`（DBA 建立的應用程式角色，最小權限）|
| TLS | 不需要 | **必須**（`sslmode=require`） |
| 誰能連 | 本機任何程式 | 只有 VNet 內（如 App Service 容器）；開發者本機**連不到** |

> ⚠️ 因 Azure DB 在私有網路後，**migration / seed 不在本機跑**，而是由容器啟動時於 VNet 內執行。

### 2.2 Blob 儲存（最常被搞混的一處）

| | 本地 | Azure DEV |
|---|------|-----------|
| 實體 | **Azurite 模擬器**（docker） | **真實 Azure Blob Storage** |
| `AZURE_STORAGE_CONNECTION_STRING` | Azurite 開發帳號字串（`devstoreaccount1...BlobEndpoint=http://127.0.0.1:10010...`） | 真實帳號連線字串（`stscmdocprocessingdev`，`https://...core.windows.net`） |
| Container | `documents` | `documents`（同名，靠帳號區隔） |
| 設定位置 | `.env` | App Service 應用程式設定 |

> 程式碼（`src/lib/azure/storage.ts` 等）**讀同一個變數名** `AZURE_STORAGE_CONNECTION_STRING`，只有**值**不同 → 切換環境零改碼。

### 2.3 AI 服務（OpenAI / Document Intelligence）

- 兩種環境**都呼叫真實 Azure 服務**（沒有本地模擬器）。
- 模型部署名稱（本項目）：`gpt-5.4-nano-aidocprocessing`（Stage 1/2）、`gpt-5.4-mini-aidocprocessing`（Stage 3）。
- 設定位置：本地 `.env`；Azure App Service 應用程式設定。值可相同（共用同一 AI 資源）或各自指定。

### 2.4 Schema 建立與 Seed

| | 本地 | Azure DEV |
|---|------|-----------|
| 建表 | 手動 `npx prisma db push` | 容器啟動 `bootstrap-db.js`：偵測 public schema 為空才套 `init.sql`（122 表），已有則跳過 |
| `init.sql` | 不使用 | Docker build 時由 `prisma migrate diff --from-empty --to-schema` 產生（不入 git，每次 build 重產） |
| Seed 腳本 | `prisma/seed.ts`（`prisma.config.ts` 指定的 `db seed`） | `prisma/seed-prod-essential.ts`（容器 entrypoint 執行編譯後的 JS） |
| Seed 內容 | 角色/區域/城市 + **dev-user-1 + 測試公司 + 匯入測試資料** | 角色/區域/城市 + system user + **本地管理員** + 系統設定（**無測試資料**） |

### 2.5 認證與管理員帳號

| | 本地 | Azure DEV |
|---|------|-----------|
| `NODE_ENV` | `development` | `production` |
| 登入旁路 | 啟用（未設真實 Azure AD 時，任意 `@` email 可登入） | **關閉**（一律真實密碼驗證） |
| 管理員 | `admin@ai-document-extraction.com` / `ChangeMe@2026!`（seed.ts） | `admin@rci-t.com` / 由 `SEED_ADMIN_PASSWORD` 設定（seed-prod-essential，bcrypt + `emailVerified`） |

### 2.6 機密與設定

| | 本地 | Azure DEV |
|---|------|-----------|
| 一般設定 + 機密 | `.env`（gitignored） | App Service 應用程式設定 |
| 部署操作用機密 | 不適用 | `.env.azure-dev.local`（gitignored，含 `AZURE_DEV_PG_USER/PASSWORD`、`SEED_ADMIN_*`） |
| 不可入 git | `.env` | `.env.azure-dev.local`、`init.sql`、`prisma/dist/` |

---

## 📁 3. 檔案歸屬（避免交叉）

| 類別 | 檔案 | 說明 |
|------|------|------|
| 🖥️ **本地專屬** | `docker-compose.yml` | 本機 5 個服務容器（postgres/azurite/ocr/mapping/pgadmin） |
| | `.env` | 本地設定（指向 localhost + Azurite） |
| | `prisma/seed.ts` + `prisma/seed-data/` + `prisma/seed/` | 本地 seed（含測試資料） |
| | `scripts/init-new-environment.{sh,ps1}` | 本機初始化 |
| ☁️ **Azure 專屬** | `Dockerfile` | 生產映像建置 |
| | `scripts/docker-entrypoint.sh` | 容器啟動（bootstrap + seed + server） |
| | `prisma/bootstrap-db.js` | runtime 套用 init.sql（僅容器內） |
| | `prisma/seed-prod-essential.ts` | 生產 essential seed |
| | `prisma/init.sql`（build 產生） | schema DDL（不入 git） |
| | `.env.azure-dev.local` | 部署機密（不入 git，不入映像） |
| 🔗 **共用** | `prisma/schema.prisma` | 兩環境的 schema 真實來源 |
| | `src/`、`next.config.ts`、`messages/` | 程式碼（以環境變數適應，不為單一環境硬編碼） |

> 確認：`npm run dev` **完全不執行** Dockerfile / entrypoint / bootstrap；`prisma db seed`（本地）用 `seed.ts` **而非** `seed-prod-essential.ts`。兩套互不干擾。

---

## ✅ 4. 開發 / 部署時的自我檢查

改動前先問自己：
- [ ] 這個改動屬於 **本地 / Azure / 共用** 哪一類？
- [ ] 若是共用程式碼，是否用「讀環境變數」而非硬編碼某一環境的值？
- [ ] 我有沒有把 Azure 專屬的值（真實連線字串/私有 host）寫進 `.env`？（不該）
- [ ] 我有沒有把本地專屬的值（Azurite/localhost）帶進 App Service 設定？（不該）
- [ ] 新機密有沒有放對位置（本地 `.env` / 部署 `.env.azure-dev.local` / 執行期 App Service 設定），且都 gitignored？

---

## 🔗 5. 延伸閱讀

- 本地完整指南：[`01-local-deployment/project-initialization-guide.md`](./01-local-deployment/project-initialization-guide.md)
- 本地環境變數詳解：[`01-local-deployment/environment-variables-reference.md`](./01-local-deployment/environment-variables-reference.md)
- Azure 部署主規劃：[`02-azure-deployment/azure-deployment-plan.md`](./02-azure-deployment/azure-deployment-plan.md)
- Azure 資源清單：[`02-azure-deployment/infrastructure/resources-inventory.md`](./02-azure-deployment/infrastructure/resources-inventory.md)
