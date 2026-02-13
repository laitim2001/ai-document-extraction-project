# Azure 註冊功能修復 - ✅ 已完成

> **建立日期**: 2025-11-25 **完成日期**: 2025-11-26 **狀態**: ✅ 已完成 **優先級**: 高

---

## 🎉 修復結果

**問題已完全解決！** 公司 Azure 環境的用戶註冊功能現在正常運作。

### 驗證結果

- ✅ Seed API 執行成功（3 個 Role，6 個 Currency）
- ✅ 用戶註冊功能正常
- ✅ 所有核心功能運作正常
- ✅ 代碼已提交至 GitHub (commit e554be6)

### 最終根本原因

**`.dockerignore` 排除了 Prisma migrations！**

原始問題鏈：

```
.dockerignore 包含 "**/migrations" 規則
    ↓
Docker build 時 migrations 資料夾被排除
    ↓
Container 中 /app/packages/db/prisma/migrations/ 目錄為空
    ↓
startup.sh 執行 "prisma migrate deploy" 報告 "No migration found"
    ↓
資料庫 Schema 未建立（Role、Currency 等表不存在）
    ↓
Seed 無法執行（依賴表結構）
    ↓
用戶註冊時 roleId 外鍵約束失敗 → 500 錯誤
```

---

## 📋 問題摘要（歷史記錄）

### 問題描述

Azure 部署環境 (https://app-itpm-company-dev-001.azurewebsites.net/zh-TW/register) 註冊功能回報 500
Internal Server Error，錯誤訊息為「註冊失敗，請稍後再試」。

### 根本原因

**Role 資料表為空** - 部署流程只執行 `prisma migrate deploy`，沒有執行 seed 腳本。

當使用者嘗試註冊時：

1. API (`/api/auth/register`) 嘗試建立使用者，預設 `roleId: 1` (ProjectManager)
2. 由於 Role 資料表為空，違反外鍵約束
3. Prisma 拋出錯誤，API 回傳 500 錯誤

```typescript
// apps/web/src/app/api/auth/register/route.ts
const user = await prisma.user.create({
  data: {
    name: validatedData.name,
    email: validatedData.email,
    password: hashedPassword,
    roleId: 1, // ← 這裡假設 Role id=1 存在
  },
});
```

## 🔧 已實施的解決方案

### 1. 應用啟動時自動 Seed (Auto-Seed on Startup)

建立了以下檔案，讓應用程式啟動時自動檢查並初始化必要的基礎資料：

#### 新增檔案

| 檔案路徑                      | 用途                                      |
| ----------------------------- | ----------------------------------------- |
| `apps/web/src/lib/db-init.ts` | 資料庫初始化邏輯，檢查 Role 表並執行 seed |
| `apps/web/instrumentation.ts` | Next.js 啟動 hook，呼叫 db-init           |

#### 修改檔案

| 檔案路徑                   | 修改內容                         |
| -------------------------- | -------------------------------- |
| `apps/web/next.config.mjs` | 啟用 `instrumentationHook: true` |

### 2. Migrate + Seed Docker 映像

建立了專用的 migration 映像，可用於一次性執行資料庫遷移和 seed：

| 檔案路徑                      | 用途                                   |
| ----------------------------- | -------------------------------------- |
| `Dockerfile.migrate`          | 專用於 migration + seed 的 Docker 映像 |
| `scripts/migrate-and-seed.sh` | 合併的 migration 和 seed 腳本          |

**映像已推送至 ACR**: `acritpmcompany.azurecr.io/itpm-migrate:latest`

## ⏳ 待完成事項

> **全部已完成！** 以下為歷史記錄。

### ✅ 高優先級（已完成）

- [x] **重新建構並部署應用程式 Docker 映像**
  - 修正 .dockerignore 排除 migrations 的問題
  - 創建 startup.sh 確保 migration 在啟動時執行
  - 創建 Currency migration
  - 部署成功

- [x] **驗證註冊功能**
  - 2025-11-26 驗證通過
  - Seed API 返回成功（roles: 3, currencies: 6）
  - 用戶註冊功能正常

### ✅ 中優先級（已完成）

- [x] **驗證 Seed 機制是否運作**
  - Seed API 端點 `/api/admin/seed` 已創建並可用
  - 可透過 HTTP POST 觸發 seed

- [x] **更新部署文件**
  - azure/docs/DEPLOYMENT-TROUBLESHOOTING.md 已創建
  - SITUATION-7/8/9 已更新
  - docs/deployment/03-troubleshooting.md 已更新

### ✅ 低優先級（已完成）

- [x] **建立手動 seed 端點**
  - 創建 `/api/admin/seed` API 端點
  - 支援 GET（檢查狀態）和 POST（執行 seed）

---

## 🔧 最終解決方案

### 修改的關鍵檔案

| 檔案路徑 | 修改內容 |
|---------|---------|
| `.dockerignore` | 註解掉 `**/migrations` |
| `.gitignore` | 添加 `!packages/db/prisma/migrations/**/*.sql` |
| `docker/startup.sh` | 創建啟動腳本，執行 migrate deploy |
| `docker/Dockerfile` | 複製並執行 startup.sh |
| `packages/db/prisma/schema.prisma` | BudgetPool.currencyId 改為 nullable |
| `packages/db/prisma/migrations/20251126100000_add_currency/` | 創建 Currency migration |
| `apps/web/src/app/api/admin/seed/route.ts` | 創建 Seed API 端點 |

### 執行的步驟

```bash
# 1. 修改 .dockerignore（移除 migrations 排除）
# 2. 創建 Currency migration
# 3. 創建 startup.sh
# 4. 創建 Seed API
# 5. 重建 Docker image
docker build -f docker/Dockerfile -t acritpmcompany.azurecr.io/itpm-web:latest .

# 6. 推送到 ACR
docker push acritpmcompany.azurecr.io/itpm-web:latest

# 7. 重啟 App Service
az webapp restart --name app-itpm-company-dev-001 --resource-group RG-RCITest-RAPO-N8N

# 8. 執行 Seed
Invoke-WebRequest -Uri "https://app-itpm-company-dev-001.azurewebsites.net/api/admin/seed" -Method POST

# 9. 提交並推送
git add . && git commit -m "fix: resolve registration 500 error - include migrations in Docker image" && git push
```

---

## 🔄 歷史解決方案（已被更好方案替代）

## 📝 技術細節

### 資料庫連線資訊

| 項目   | 值                                                    |
| ------ | ----------------------------------------------------- |
| 伺服器 | psql-itpm-company-dev-001.postgres.database.azure.com |
| 資料庫 | itpm_dev                                              |
| 使用者 | itpmadmin                                             |
| 密碼   | ItpmDev2025SecureX1                                   |

### Azure 資源

| 資源類型           | 名稱                      |
| ------------------ | ------------------------- |
| Resource Group     | RG-RCITest-RAPO-N8N       |
| App Service        | app-itpm-company-dev-001  |
| PostgreSQL         | psql-itpm-company-dev-001 |
| Container Registry | acritpmcompany            |

### Seed 資料內容

`packages/db/prisma/seed-minimal.ts` 會建立：

1. **Roles (角色)**
   - ProjectManager (專案經理)
   - TeamMember (團隊成員)
   - Stakeholder (利害關係人)
   - Admin (管理員)

2. **Currencies (幣別)**
   - TWD (新台幣)
   - USD (美元)
   - EUR (歐元)
   - JPY (日圓)
   - CNY (人民幣)

## 🔄 回復指引

如果需要移除 Auto-Seed 功能，可以：

1. 刪除 `apps/web/src/lib/db-init.ts`
2. 刪除 `apps/web/instrumentation.ts`
3. 在 `apps/web/next.config.mjs` 中移除 `instrumentationHook: true`

## 📊 問題排查日誌

### 2025-11-25 診斷過程

1. **發現問題**: 使用者回報 Azure 環境註冊失敗 (500 錯誤)
2. **檢查 API**: 確認 `/api/auth/register` 使用 `roleId: 1`
3. **檢查 Schema**: 確認 User 有 FK 到 Role
4. **嘗試連線資料庫**: 發現密碼已更新為 `ItpmDev2025SecureX1`
5. **確認根因**: Role 資料表為空
6. **選擇方案**: 使用者選擇「流程修復」而非快速修復
7. **實施 Auto-Seed**: 建立 db-init.ts 和 instrumentation.ts
8. **Docker 建構失敗**: 當前網路 SSL 憑證問題
9. **暫停**: 等待網路環境正常後繼續

### 網路問題說明

當前環境的企業 Proxy 會對 HTTPS 流量進行 SSL 憑證替換，導致：

- Docker 建構時無法下載 npm 套件
- 無法取得 Google Fonts 等外部資源
- 錯誤訊息：`unable to get local issuer certificate`

此問題在公司內部網路環境下不會發生。

## 📚 相關文件

- [Azure 部署檢查清單](./AZURE-DEPLOYMENT-CHECKLIST.md)
- [Prisma 修復部署成功](./AZURE-PRISMA-FIX-DEPLOYMENT-SUCCESS.md)
- [Seed 資料實施摘要](./AZURE-SEED-DATA-IMPLEMENTATION-SUMMARY.md)
