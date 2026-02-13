# Azure 部署檢查清單

> **文檔版本**: 1.1.0
> **最後更新**: 2025-11-26
> **用途**: Azure 生產環境和 UAT 環境部署的完整檢查清單
> **相關**: 解決 Registration API 500 錯誤問題 (缺少 seed data)
>
> **v1.1.0 更新** (2025-11-26):
> - ✅ Seed 現在由 `startup.sh` 自動執行（v1.3.0+）
> - 更新部署流程，移除手動 Seed 步驟
> - 新增自動 Seed 驗證項目

---

## 📋 部署前檢查 (Pre-Deployment)

### 1. 環境變數配置

確認所有必需的環境變數已在 Azure App Service 配置中設定:

#### 數據庫配置
- [ ] `DATABASE_URL` - Azure PostgreSQL 連接字串
  - 格式: `postgresql://[user]:[password]@[host].postgres.database.azure.com:5432/[db]?sslmode=require`
  - 確認已啟用 SSL (`sslmode=require`)

#### NextAuth.js 認證
- [ ] `NEXTAUTH_SECRET` - 已從 Key Vault 讀取
- [ ] `NEXTAUTH_URL` - 設定為應用程式 URL
- [ ] `NEXTAUTH_SESSION_MAX_AGE` - 預設 86400 (24小時)

#### Azure AD B2C (如果使用)
- [ ] `AZURE_AD_B2C_TENANT_NAME`
- [ ] `AZURE_AD_B2C_TENANT_ID`
- [ ] `AZURE_AD_B2C_CLIENT_ID`
- [ ] `AZURE_AD_B2C_CLIENT_SECRET`
- [ ] `AZURE_AD_B2C_PRIMARY_USER_FLOW`

#### Email 服務 (SendGrid)
- [ ] `SENDGRID_API_KEY` - 從 Key Vault 讀取
- [ ] `SENDGRID_FROM_EMAIL`
- [ ] `SENDGRID_FROM_NAME`

#### Azure Storage (檔案上傳)
- [ ] `AZURE_STORAGE_ACCOUNT_NAME`
- [ ] `AZURE_STORAGE_ACCOUNT_KEY` - 從 Key Vault 讀取
- [ ] `AZURE_STORAGE_CONTAINER_QUOTES`
- [ ] `AZURE_STORAGE_CONTAINER_INVOICES`

#### 應用程式設定
- [ ] `NODE_ENV=production`
- [ ] `NEXT_TELEMETRY_DISABLED=1`
- [ ] `WEBSITES_PORT=3000`

---

### 2. Azure 資源檢查

確認所有 Azure 資源已正確創建並配置:

#### App Service
- [ ] App Service Plan 已創建 (SKU: P1V2 或以上推薦生產環境)
- [ ] App Service 已創建
- [ ] Managed Identity 已啟用
- [ ] Container 設定已配置
  - Registry: `acritpmdev.azurecr.io`
  - Image: `itpm-web:latest` (或特定版本標籤)
  - Port: `3000`

#### Azure Database for PostgreSQL
- [ ] PostgreSQL Flexible Server 已創建 (版本 16)
- [ ] 數據庫 `itpm_dev` 已創建
- [ ] Firewall 規則已設定
  - [ ] 允許 Azure 服務訪問
  - [ ] 允許 App Service 出站 IP 訪問 (所有 20+ 個 IP)
  - [ ] (可選) 允許開發者 IP 用於手動管理
- [ ] SSL/TLS 已啟用

#### Azure Container Registry
- [ ] ACR 已創建
- [ ] Admin user 已啟用 (或使用 Managed Identity)
- [ ] 最新 Docker 映像已推送

#### Azure Key Vault
- [ ] Key Vault 已創建
- [ ] App Service Managed Identity 已加入 Access Policy
- [ ] 所有敏感環境變數已儲存為 Secrets
  - `ITPM-DEV-DATABASE-URL`
  - `ITPM-DEV-NEXTAUTH-SECRET`
  - `ITPM-DEV-SENDGRID-API-KEY`
  - `ITPM-DEV-STORAGE-ACCOUNT-KEY`

#### Azure Blob Storage
- [ ] Storage Account 已創建
- [ ] Containers 已創建
  - `quotes`
  - `invoices`
- [ ] Access 權限已設定 (Private)

---

## 🚀 部署流程 (Deployment Steps)

### Step 1: 建置 Docker 映像

```bash
# 在本地建置 Docker 映像
docker build -t acritpmdev.azurecr.io/itpm-web:latest -f docker/Dockerfile .

# 測試映像 (可選)
docker run -p 3000:3000 --env-file .env.production acritpmdev.azurecr.io/itpm-web:latest
```

**檢查點:**
- [ ] Docker 建置成功無錯誤
- [ ] (可選) 本地測試通過

---

### Step 2: 推送映像到 ACR

```bash
# 登入 ACR
az acr login --name acritpmdev

# 推送映像
docker push acritpmdev.azurecr.io/itpm-web:latest
```

**檢查點:**
- [ ] 映像推送成功
- [ ] ACR 中可見最新映像標籤

---

### Step 3: 執行數據庫 Migration

```bash
# 方式一: 使用本地 Prisma CLI (推薦)
DATABASE_URL='<Azure-PostgreSQL-URL>' pnpm db:migrate

# 方式二: 在 App Service SSH 中執行
cd /app/packages/db
npx prisma migrate deploy
```

**檢查點:**
- [ ] Migration 執行成功
- [ ] 所有表結構已創建
- [ ] 無錯誤或警告

---

### Step 4: ✅ Seed Data (現在自動執行)

> **v1.3.0+ 更新**: Seed 現在由 `startup.sh` 自動執行，**不再需要手動執行**！

容器啟動時，`startup.sh` 會自動執行：
1. Prisma migrate deploy
2. Seed 基礎數據（Role + Currency）
3. 啟動 Next.js 應用

**驗證自動 Seed 成功:**

```bash
# 查看容器日誌，確認 Seed 執行
az webapp log tail --name <APP_NAME> --resource-group <RG_NAME> | grep -E "Seed|Role|Currency"

# 預期看到:
# 🌱 Step 2/2: 執行基礎種子資料 (Seed)...
#   ✅ Role: ProjectManager (ID: 1)
#   ✅ Role: Supervisor (ID: 2)
#   ✅ Role: Admin (ID: 3)
#   ✅ Currency: TWD (新台幣)
# 📊 Seed 完成: 3 Roles, 6 Currencies
# ✅ Seed 執行成功
```

**備用方案（如自動 Seed 失敗）:**

```bash
# 使用 Seed API 手動執行
curl -X POST "https://<APP_NAME>.azurewebsites.net/api/admin/seed" \
  -H "Authorization: Bearer <NEXTAUTH_SECRET>" \
  -H "Content-Type: application/json"
```

**檢查點:**
- [ ] 容器日誌顯示 "Seed 執行成功"
- [ ] Role 表包含 3 筆記錄 (ProjectManager, Supervisor, Admin)
- [ ] Currency 表包含 6 筆記錄 (TWD, USD, CNY, HKD, JPY, EUR)

---

### Step 5: 重啟 App Service

```bash
# 重啟應用程式
az webapp restart --name app-itpm-dev-001 --resource-group rg-itpm-dev
```

**檢查點:**
- [ ] App Service 成功重啟
- [ ] 無錯誤訊息

---

## ✅ 部署後驗證 (Post-Deployment Verification)

### 1. 基礎健康檢查

```bash
# 檢查應用程式是否運行
curl -I https://app-itpm-dev-001.azurewebsites.net

# 檢查健康端點 (如果有)
curl https://app-itpm-dev-001.azurewebsites.net/api/health
```

**檢查點:**
- [ ] HTTP 200 OK
- [ ] 響應時間 < 5 秒

---

### 2. 數據庫連接驗證

通過 App Service SSH 或 Prisma Studio:

```bash
# 驗證數據庫連接
PGPASSWORD='<password>' psql -h psql-itpm-dev-001.postgres.database.azure.com -U itpmadmin -d itpm_dev -c "SELECT 1;"
```

**檢查點:**
- [ ] 連接成功
- [ ] 可以查詢數據

---

### 3. ⭐ Seed Data 驗證 (Critical)

**這是最重要的驗證步驟!**

```bash
# 驗證 Role 表
PGPASSWORD='<password>' psql -h psql-itpm-dev-001.postgres.database.azure.com -U itpmadmin -d itpm_dev -c "SELECT * FROM \"Role\";"

# 預期結果:
#  id |     name
# ----+----------------
#   1 | ProjectManager
#   2 | Supervisor
#   3 | Admin

# 驗證 Currency 表
PGPASSWORD='<password>' psql -h psql-itpm-dev-001.postgres.database.azure.com -U itpmadmin -d itpm_dev -c "SELECT * FROM \"Currency\";"

# 預期結果: 6 筆記錄 (TWD, USD, CNY, HKD, JPY, EUR)
```

**檢查點:**
- [ ] Role 表包含 3 筆記錄
  - [ ] ID 1: ProjectManager
  - [ ] ID 2: Supervisor
  - [ ] ID 3: Admin
- [ ] Currency 表包含 6 筆記錄
- [ ] 所有記錄的主鍵和欄位值正確

**⚠️ 如果此驗證失敗,請立即執行 `./scripts/azure-seed.sh` 或 `pnpm db:seed:minimal`**

---

### 4. 功能端點測試

#### 4.1 註冊 API 測試 (Registration API)

**這是此次部署最重要的測試項目!**

```bash
# 測試用戶註冊
curl -X POST https://app-itpm-dev-001.azurewebsites.net/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "測試用戶",
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

**預期結果**:
```json
{
  "success": true,
  "message": "註冊成功",
  "user": {
    "id": "uuid",
    "name": "測試用戶",
    "email": "test@example.com"
  }
}
```

**檢查點:**
- [ ] HTTP 201 Created
- [ ] 返回 `success: true`
- [ ] 用戶記錄已創建
- [ ] **無 500 錯誤** (之前的問題)
- [ ] **無 P2003 外鍵約束錯誤** (之前的 root cause)

**如果返回 500 錯誤**:
1. 立即檢查 App Service 日誌
2. 確認是否為 P2003 錯誤 (外鍵約束)
3. 如果是,執行 seed data (Step 4)
4. 重試註冊 API

---

#### 4.2 登入 API 測試

```bash
# 測試 NextAuth 登入
curl -X POST https://app-itpm-dev-001.azurewebsites.net/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "redirect": false
  }'
```

**檢查點:**
- [ ] 登入成功
- [ ] 返回 session token
- [ ] 無錯誤

---

#### 4.3 Session 驗證

```bash
# 檢查 session 端點
curl https://app-itpm-dev-001.azurewebsites.net/api/auth/session
```

**檢查點:**
- [ ] 返回 session 或 null (取決於是否登入)
- [ ] 無 500 錯誤

---

### 5. 日誌檢查

```bash
# 查看最新 50 條日誌
az webapp log tail --name app-itpm-dev-001 --resource-group rg-itpm-dev

# 或通過 Azure Portal 查看
# App Service > Monitoring > Log stream
```

**檢查點:**
- [ ] 無 ERROR 級別日誌
- [ ] 無 Prisma P2003 錯誤 (外鍵約束)
- [ ] 無數據庫連接錯誤
- [ ] 應用程式正常啟動訊息

---

### 6. 前端頁面驗證

手動測試以下頁面:

- [ ] `/login` - 登入頁面正常顯示
- [ ] `/register` - 註冊頁面正常顯示
- [ ] `/dashboard` - 儀表板 (需要登入)
- [ ] 完整的用戶註冊流程 (從頁面進行註冊)

---

## 🐛 常見問題排查 (Troubleshooting)

### 問題 1: Registration API 返回 500 錯誤

**症狀**:
```json
{
  "success": false,
  "error": "註冊失敗,請稍後再試"
}
```

**診斷步驟**:
1. 查看 App Service 日誌:
   ```bash
   az webapp log tail --name app-itpm-dev-001 --resource-group rg-itpm-dev
   ```
2. 尋找 Prisma 錯誤訊息 (特別是 P2003)
3. 檢查 Role 表是否為空:
   ```sql
   SELECT COUNT(*) FROM "Role";
   ```

**解決方法**:
- 如果 Role 表為空,執行 seed:
  ```bash
  DATABASE_URL='<Azure-PostgreSQL-URL>' pnpm db:seed:minimal
  ```
- 重啟 App Service
- 重試註冊 API

**Root Cause**: Missing seed data in Azure database. Local environment worked because seed.ts was run, but Azure only had migrations without seed data.

---

### 問題 2: 數據庫連接失敗

**症狀**:
- App Service 無法啟動
- 日誌顯示 `Can't reach database server`

**解決方法**:
1. 檢查 DATABASE_URL 環境變數是否正確
2. 檢查 PostgreSQL Firewall 規則
3. 確認 SSL 模式 (`sslmode=require`)
4. 驗證網路連接

---

### 問題 3: Docker 映像無法啟動

**症狀**:
- App Service 顯示 "Application Error"
- Container 日誌顯示啟動失敗

**解決方法**:
1. 檢查 Dockerfile 是否正確
2. 確認所有依賴已安裝
3. 檢查 Prisma Client 是否已生成
4. 驗證環境變數配置

---

## 📝 部署記錄範本

每次部署後,記錄以下信息:

```markdown
### 部署記錄: YYYY-MM-DD HH:MM

**部署人員**: [Name]
**部署環境**: Production / UAT
**Git Commit**: [commit hash]
**Docker Image Tag**: [tag]

**執行步驟**:
- [x] 建置 Docker 映像
- [x] 推送到 ACR
- [x] 執行 Migration
- [x] ⭐ 執行 Seed Data
- [x] 重啟 App Service
- [x] 驗證 seed data
- [x] 測試 Registration API
- [x] 測試登入流程

**驗證結果**:
- Registration API: ✅ 成功 / ❌ 失敗
- Login API: ✅ 成功 / ❌ 失敗
- Seed Data: ✅ 完整 / ❌ 缺失

**問題記錄**: (如果有)
- [描述問題]
- [解決方法]

**備註**: (如果有)
```

---

## 🔗 相關文檔

- [Azure Deployment Seed Script](../scripts/azure-seed.sh)
- [Minimal Seed Data](../packages/db/prisma/seed-minimal.ts)
- [Dockerfile Configuration](../docker/Dockerfile)
- [Environment Variables Guide](../DEVELOPMENT-SETUP.md#environment-variables)
- [FIX-XXX: Registration API 500 Error](../FIXLOG.md) (待添加)

---

## 📞 支援聯絡

遇到問題時,請聯絡:
- **DevOps Team**: devops@company.com
- **Database Team**: dba@company.com
- **Application Team**: dev@company.com

---

**文檔維護**: Development Team
**審核週期**: 每次重大部署後更新
**下次審核**: 2025-12-26

---

## 📝 更新記錄

### v1.1.0 (2025-11-26)
- ✅ 更新 Step 4: Seed 現在由 startup.sh 自動執行
- 新增自動 Seed 驗證方式
- 更新備用方案（使用 Seed API）

### v1.0.0 (2025-11-22)
- 初始版本
