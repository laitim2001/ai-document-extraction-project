# Azure 登入 I18n 翻譯修復部署記錄

> **部署日期**: 2025-11-22
> **部署版本**: v7-i18n-fix
> **部署目的**: 修復 Azure 登入頁面翻譯缺失和 Configuration 錯誤

---

## 📋 問題總結

### 問題 1: I18n 翻譯 Keys 缺失 ✅ 已修復
**錯誤訊息**:
```
MISSING_MESSAGE: auth.login.errors.invalidCredentials (zh-TW)
MISSING_MESSAGE: auth.login.errors.configurationError (zh-TW)
```

**根本原因**:
- 登入頁面代碼使用 `t('errors.invalidCredentials')` 等翻譯 keys
- `auth.login.errors` 部分在 `en.json` 和 `zh-TW.json` 中完全缺失
- 只有 `auth.register.errors` 存在

**修復方案**:
1. 創建自動化腳本 `scripts/add-login-errors.js`
2. 為 `auth.login` 添加完整的 `errors` 部分（13 個 keys）
3. 驗證通過 `pnpm validate:i18n` ✅

### 問題 2: NextAuth Configuration 錯誤 ⏳ 待驗證
**錯誤訊息**:
```
❌ 登入錯誤: Configuration
```

**當前狀態**:
- 環境變數配置正確（DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL）
- 測試用戶 `admin@itpm.local` 在數據庫中存在
- 密碼 hash 存在
- 需要部署最新代碼後再次測試

---

## 🔧 修復內容

### 1. 新增翻譯 Keys

#### `apps/web/src/messages/en.json`
```json
{
  "auth": {
    "login": {
      "errors": {
        "invalidCredentials": "Invalid email or password",
        "configurationError": "System configuration error, please contact administrator",
        "accessDenied": "Access denied",
        "verificationRequired": "Email verification required",
        "loginFailed": "Login failed, please try again",
        "emailRequired": "Please enter your email",
        "passwordRequired": "Please enter your password",
        "emailPasswordRequired": "Please enter your email and password",
        "invalidEmailFormat": "Invalid email format",
        "passwordTooShort": "Password must be at least 8 characters",
        "accountLocked": "Account is locked, please contact administrator",
        "accountDisabled": "Account is disabled",
        "sessionExpired": "Session expired, please login again"
      }
    }
  }
}
```

#### `apps/web/src/messages/zh-TW.json`
```json
{
  "auth": {
    "login": {
      "errors": {
        "invalidCredentials": "電子郵件或密碼錯誤",
        "configurationError": "系統配置錯誤，請聯絡管理員",
        "accessDenied": "存取被拒絕",
        "verificationRequired": "需要電子郵件驗證",
        "loginFailed": "登入失敗，請重試",
        "emailRequired": "請輸入電子郵件",
        "passwordRequired": "請輸入密碼",
        "emailPasswordRequired": "請輸入電子郵件和密碼",
        "invalidEmailFormat": "電子郵件格式無效",
        "passwordTooShort": "密碼長度至少 8 個字元",
        "accountLocked": "帳號已被鎖定，請聯絡管理員",
        "accountDisabled": "帳號已被停用",
        "sessionExpired": "登入階段已過期，請重新登入"
      }
    }
  }
}
```

### 2. 新增工具腳本

#### `scripts/add-login-errors.js` (142 行)
**用途**: 自動化添加 `auth.login.errors` 翻譯 keys

**功能**:
- 讀取現有 `en.json` 和 `zh-TW.json`
- 添加或合併 `auth.login.errors` 部分
- 寫回文件並保持 JSON 格式（2 空格縮排）
- 提供執行結果報告

**執行方式**:
```bash
node scripts/add-login-errors.js
```

---

## 🚀 部署步驟

### Step 1: 本地驗證 ✅
```bash
# 1. 執行腳本添加翻譯
node scripts/add-login-errors.js
# 輸出: ✅ 成功添加 13 個錯誤翻譯 keys (en + zh-TW)

# 2. 驗證翻譯文件
pnpm validate:i18n
# 輸出: ✅ 所有檢查通過！翻譯文件完全正確。(1796 個鍵)

# 3. 驗證翻譯內容
node -e "const data = require('./apps/web/src/messages/zh-TW.json'); console.log(JSON.stringify(data.auth.login.errors, null, 2));"
# 輸出: 完整的 13 個錯誤翻譯 ✅
```

### Step 2: 建置 Docker 映像 🔄
```bash
# 建置映像（包含翻譯修復）
docker build -t acritpmdev.azurecr.io/itpm-web:latest \
             -t acritpmdev.azurecr.io/itpm-web:v7-i18n-fix \
             -f docker/Dockerfile .
```

**預期結果**: 成功建置包含最新翻譯的 Docker 映像

### Step 3: 推送到 ACR ⏳
```bash
# 登入 ACR
az acr login --name acritpmdev

# 推送映像
docker push acritpmdev.azurecr.io/itpm-web:latest
docker push acritpmdev.azurecr.io/itpm-web:v7-i18n-fix
```

### Step 4: 部署到 Azure App Service ⏳
```bash
# 更新 App Service 使用新映像
az webapp config container set \
  --name app-itpm-dev-001 \
  --resource-group rg-itpm-dev \
  --docker-custom-image-name acritpmdev.azurecr.io/itpm-web:v7-i18n-fix
```

### Step 5: 重啟 App Service ⏳
```bash
# 重啟服務
az webapp restart \
  --name app-itpm-dev-001 \
  --resource-group rg-itpm-dev
```

### Step 6: 驗證部署 ⏳

#### 6.1 檢查應用程式健康
```bash
curl -I https://app-itpm-dev-001.azurewebsites.net
# 預期: HTTP/1.1 200 OK
```

#### 6.2 測試登入頁面
訪問: `https://app-itpm-dev-001.azurewebsites.net/zh-TW/login`

**驗證項目**:
- [ ] 頁面正常載入
- [ ] 沒有 `MISSING_MESSAGE` 錯誤
- [ ] 使用 `admin@itpm.local` / `admin123` 登入
- [ ] 錯誤訊息顯示正確的中文翻譯
- [ ] Configuration 錯誤是否解決

#### 6.3 檢查應用程式日誌
```bash
az webapp log tail --name app-itpm-dev-001 --resource-group rg-itpm-dev
```

查看是否有錯誤訊息。

---

## 📊 數據庫驗證

### 測試用戶狀態
```sql
SELECT id, email, name, "roleId", password IS NOT NULL as has_password
FROM "User"
WHERE email = 'admin@itpm.local';
```

**查詢結果** ✅:
```json
{
  "id": "a81b3fb0-2416-409f-a4b7-a95d412bc7dd",
  "email": "admin@itpm.local",
  "name": "chris",
  "roleId": 1,
  "has_password": true
}
```

- ✅ 用戶存在
- ✅ 密碼 hash 存在
- ✅ RoleId 正確 (1 = ProjectManager)

---

## 🔍 故障排除

### 如果登入仍然失敗

#### 1. 檢查環境變數
```bash
az webapp config appsettings list \
  --name app-itpm-dev-001 \
  --resource-group rg-itpm-dev \
  | grep -E "(NEXTAUTH_SECRET|NEXTAUTH_URL|DATABASE_URL)"
```

**預期結果**:
- NEXTAUTH_SECRET: `@Microsoft.KeyVault(...)`
- NEXTAUTH_URL: `@Microsoft.KeyVault(...)`
- DATABASE_URL: 正確的 PostgreSQL 連接字串

#### 2. 檢查 Key Vault Secrets
```bash
az keyvault secret show \
  --vault-name kv-itpm-dev \
  --name ITPM-DEV-NEXTAUTH-SECRET

az keyvault secret show \
  --vault-name kv-itpm-dev \
  --name ITPM-DEV-NEXTAUTH-URL
```

#### 3. 檢查 NextAuth 配置
查看 `packages/auth/index.ts` 和 `packages/auth/auth.config.ts`：
- Credentials provider 配置是否正確
- 密碼驗證邏輯是否正確
- Session 配置是否正確

#### 4. 測試密碼 Hash
```bash
# 在本地驗證密碼 hash 是否正確
node -e "
const bcrypt = require('bcrypt');
const password = 'admin123';
const hash = '<從數據庫獲取的 hash>';
console.log('Password matches:', bcrypt.compareSync(password, hash));
"
```

---

## 📝 部署檢查清單

- [x] 本地添加翻譯 keys
- [x] 驗證翻譯文件正確性 (`pnpm validate:i18n`)
- [x] 創建自動化腳本 (`scripts/add-login-errors.js`)
- [ ] 建置 Docker 映像 (v7-i18n-fix)
- [ ] 推送映像到 ACR
- [ ] 部署到 App Service
- [ ] 重啟 App Service
- [ ] 驗證登入功能
- [ ] 檢查應用程式日誌
- [ ] 測試翻譯顯示正確

---

## 🎯 預期結果

部署完成後，應該能夠：

1. ✅ **翻譯問題修復**:
   - 登入頁面不再顯示 `MISSING_MESSAGE` 錯誤
   - 所有錯誤訊息顯示正確的中文翻譯
   - `invalidCredentials` → "電子郵件或密碼錯誤"
   - `configurationError` → "系統配置錯誤，請聯絡管理員"

2. ⏳ **Configuration 錯誤修復** (待驗證):
   - 使用 `admin@itpm.local` / `admin123` 成功登入
   - 或顯示正確的錯誤訊息（如密碼錯誤）

---

## 📞 如果問題持續存在

### 選項 1: 檢查 NextAuth 配置
1. 讀取 `packages/auth/index.ts`
2. 檢查 Credentials provider 配置
3. 驗證密碼驗證邏輯

### 選項 2: 檢查 Azure 日誌
1. 查看 App Service 日誌中的詳細錯誤訊息
2. 搜尋 "Configuration", "NextAuth", "auth" 關鍵字
3. 識別具體的錯誤原因

### 選項 3: 測試本地環境
1. 使用 Azure 數據庫連接本地應用程式
2. 測試登入功能是否正常
3. 對比本地和 Azure 環境的差異

---

**最後更新**: 2025-11-22
**部署狀態**: 🔄 建置中
**下一步**: 等待 Docker 建置完成 → 推送 → 部署 → 驗證
