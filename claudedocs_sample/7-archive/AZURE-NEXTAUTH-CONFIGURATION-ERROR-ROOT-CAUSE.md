# Azure NextAuth Configuration 錯誤根本原因分析

> **診斷日期**: 2025-11-22
> **問題狀態**: ✅ 根本原因已確定
> **錯誤類型**: Prisma Client 模組缺失
> **影響範圍**: 所有需要資料庫認證的功能(登入、註冊)

---

## 📋 問題摘要

### 用戶報告的錯誤
在 `https://app-itpm-dev-001.azurewebsites.net/zh-TW/login` 登入時:
```
帳號: admin@itpm.local
密碼: admin123

❌ 登入錯誤: Configuration
```

### 控制台輸出
```javascript
🔐 開始登入流程 {email: 'admin@itpm.local', callbackUrl: '/dashboard'}
📊 signIn 結果: {error: 'Configuration', code: undefined, status: 200, ok: true, url: null}
❌ 登入錯誤: Configuration
```

---

## 🔍 診斷過程

### Step 1: 檢查環境變數 ✅
```bash
az webapp config appsettings list \
  --name app-itpm-dev-001 \
  --resource-group rg-itpm-dev \
  | grep -E "(NEXTAUTH_SECRET|NEXTAUTH_URL|DATABASE_URL)"
```

**結果**:
- ✅ DATABASE_URL: 正確的 PostgreSQL 連接字串
- ✅ NEXTAUTH_SECRET: 使用 Key Vault reference
- ✅ NEXTAUTH_URL: 使用 Key Vault reference

**Key Vault 驗證**:
```bash
az keyvault secret show --vault-name kv-itpm-dev --name ITPM-DEV-NEXTAUTH-URL
# 結果: "https://app-itpm-dev-001.azurewebsites.net" ✅
```

---

### Step 2: 檢查資料庫用戶 ✅
```sql
SELECT id, email, name, "roleId", password IS NOT NULL as has_password
FROM "User"
WHERE email = 'admin@itpm.local';
```

**查詢結果**:
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
- ✅ RoleId 正確(1 = ProjectManager)

---

### Step 3: 分析 NextAuth 配置 ✅
**文件**: `apps/web/src/auth.ts`

**Credentials Provider 邏輯**:
```typescript
async authorize(credentials) {
  // 1. 驗證 email/password 是否提供
  if (!email || !password) {
    throw new Error('請提供 Email 和密碼');
  }

  // 2. 使用 Prisma 查找用戶
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  // 3. 驗證密碼
  const isPasswordValid = await bcrypt.compare(password, user.password);

  // 4. 返回用戶對象
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    role: user.role,
  };
}
```

**結論**: 邏輯正確,沒有明顯問題。

---

### Step 4: 檢查 Azure App Service 日誌 ❌ 發現根本原因!

```bash
az webapp log tail --name app-itpm-dev-001 --resource-group rg-itpm-dev
```

**關鍵錯誤訊息**:
```
❌ Error: Cannot find module '@prisma/client'
Require stack:
- /app/apps/web/.next/server/app/api/auth/[...nextauth]/route.js
- /app/node_modules/.pnpm/next@14.2.33_@playwright+test@1.56.1_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/server/require.js
- /app/node_modules/.pnpm/next@14.2.33_@playwright+test@1.56.1_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/server/next-server.js
- /app/node_modules/.pnpm/next@14.2.33_@playwright+test@1.56.1_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/server/next.js
- /app/apps/web/server.js

code: 'MODULE_NOT_FOUND'
```

---

## 🎯 根本原因

### 問題分析
**Prisma Client 在 Docker 映像中未被正確複製到生產環境**

1. **Build 階段**: Prisma Client 成功生成(builder stage line 64)
2. **Runtime 階段**: 複製 Prisma Client 到 runner stage 時出現問題
3. **執行時錯誤**: NextAuth 的 `authorize` 函數嘗試使用 `prisma.user.findUnique()` 時,因為找不到 `@prisma/client` 模組而失敗
4. **NextAuth 錯誤處理**: 將任何 `authorize` 函數中的錯誤都轉換為通用的 "Configuration" 錯誤

### 為什麼會發生?

**Dockerfile 當前邏輯**(docker/Dockerfile lines 108-110):
```dockerfile
# 硬編碼 Prisma 版本號
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma ./node_modules/.prisma
```

**問題**:
- ❌ 版本號硬編碼(`5.22.0`)可能與實際安裝的 Prisma 版本不匹配
- ❌ pnpm 的虛擬存儲路徑可能因依賴變化而改變
- ❌ 路徑不存在時 Docker COPY 不會報錯,導致靜默失敗

---

## ⚙️ 錯誤鏈路追蹤

```
用戶嘗試登入
  → 前端調用 signIn({ email, password })
    → NextAuth 調用 Credentials Provider 的 authorize()
      → authorize() 嘗試執行 prisma.user.findUnique()
        → require('@prisma/client') 失敗
          → 拋出 MODULE_NOT_FOUND 錯誤
            → NextAuth 捕獲錯誤並返回 {error: 'Configuration'}
              → 前端顯示翻譯後的錯誤訊息
                ✅ "系統配置錯誤,請聯絡管理員" (翻譯已修復)
```

---

## 🔧 解決方案

### 方案 1: 動態查找 Prisma Client 路徑(推薦) ⭐

**優點**:
- ✅ 自動適應 Prisma 版本變化
- ✅ 不需要手動更新版本號
- ✅ 更可維護

**實施方案**:
修改 Dockerfile,在 builder stage 動態獲取正確的 Prisma Client 路徑:

```dockerfile
# Builder stage 添加
FROM base AS builder
# ... 現有代碼 ...

# 生成 Prisma Client
RUN cd packages/db && pnpm prisma generate

# 🆕 動態查找 Prisma Client 路徑並保存
RUN PRISMA_CLIENT_PATH=$(find /app/node_modules/.pnpm -type d -name "@prisma+client*" | head -1) && \
    echo "$PRISMA_CLIENT_PATH" > /tmp/prisma_client_path.txt

# Build 應用
RUN pnpm build --filter=@itpm/web

# Runner stage 使用動態路徑
FROM base AS runner
# ... 現有代碼 ...

# 🆕 使用動態路徑複製 Prisma Client
COPY --from=builder /tmp/prisma_client_path.txt /tmp/prisma_client_path.txt
RUN PRISMA_CLIENT_PATH=$(cat /tmp/prisma_client_path.txt) && \
    cp -r "$PRISMA_CLIENT_PATH/node_modules/@prisma/client" ./node_modules/@prisma/client && \
    cp -r "$PRISMA_CLIENT_PATH/node_modules/.prisma" ./node_modules/.prisma
```

---

### 方案 2: 在 Runner Stage 重新生成 Prisma Client

**優點**:
- ✅ 100% 確保 Prisma Client 存在
- ✅ 不依賴 COPY 路徑邏輯

**缺點**:
- ❌ 增加映像大小(需要保留 prisma CLI)
- ❌ 增加構建時間

**實施方案**:
```dockerfile
FROM base AS runner
# ... 現有代碼 ...

# 保留 Prisma CLI 和相關依賴
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm/prisma* ./node_modules/.pnpm/
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma ./packages/db/prisma

# 在 runtime 重新生成 Prisma Client
RUN cd packages/db && npx prisma generate
```

---

### 方案 3: 檢查並修復硬編碼版本號

**優點**:
- ✅ 最小化改動
- ✅ 如果版本號正確則立即可用

**缺點**:
- ❌ 每次 Prisma 升級都需要手動更新 Dockerfile
- ❌ 維護負擔高

**實施方案**:
1. 查詢當前 Prisma 版本:
   ```bash
   grep "@prisma/client" package.json
   ```

2. 檢查 pnpm 虛擬存儲路徑:
   ```bash
   find node_modules/.pnpm -name "@prisma+client*" -type d
   ```

3. 更新 Dockerfile lines 108-110 使用正確的版本號和路徑

---

## 📊 影響範圍

### 受影響功能
- ❌ 所有使用 Credentials Provider 的登入功能
- ❌ 所有需要資料庫訪問的 NextAuth 操作
- ❌ 註冊功能(如果使用 Prisma)
- ❌ 用戶資料查詢

### 不受影響功能
- ✅ Azure AD B2C SSO 登入(不依賴 Prisma)
- ✅ 靜態頁面渲染
- ✅ 前端 UI 顯示

---

## 🚀 修復步驟(方案 1 - 推薦)

### Step 1: 備份當前 Dockerfile
```bash
cp docker/Dockerfile docker/Dockerfile.backup
```

### Step 2: 修改 Dockerfile
實施方案 1 的動態路徑查找邏輯

### Step 3: 重新建置 Docker 映像
```bash
docker build -t acritpmdev.azurecr.io/itpm-web:latest \
             -t acritpmdev.azurecr.io/itpm-web:v8-prisma-fix \
             -f docker/Dockerfile .
```

### Step 4: 本地測試驗證
```bash
docker run --rm -e DATABASE_URL='...' \
           -e NEXTAUTH_SECRET='test-secret' \
           -e NEXTAUTH_URL='http://localhost:3000' \
           -p 3001:3000 \
           acritpmdev.azurecr.io/itpm-web:v8-prisma-fix

# 測試登入 API
curl -X POST http://localhost:3001/api/auth/callback/credentials \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@itpm.local","password":"admin123"}'
```

### Step 5: 推送到 ACR
```bash
az acr login --name acritpmdev

docker push acritpmdev.azurecr.io/itpm-web:latest
docker push acritpmdev.azurecr.io/itpm-web:v8-prisma-fix
```

### Step 6: 部署到 Azure App Service
```bash
az webapp config container set \
  --name app-itpm-dev-001 \
  --resource-group rg-itpm-dev \
  --docker-custom-image-name acritpmdev.azurecr.io/itpm-web:v8-prisma-fix

az webapp restart \
  --name app-itpm-dev-001 \
  --resource-group rg-itpm-dev
```

### Step 7: 驗證修復
1. 訪問 `https://app-itpm-dev-001.azurewebsites.net/zh-TW/login`
2. 使用 `admin@itpm.local` / `admin123` 登入
3. 預期結果: ✅ 成功登入並重定向到 `/dashboard`

### Step 8: 檢查日誌確認無錯誤
```bash
az webapp log tail --name app-itpm-dev-001 --resource-group rg-itpm-dev \
  | grep -E "(Error|error|prisma|@prisma/client)"
```

**預期**: 不再看到 "Cannot find module '@prisma/client'" 錯誤

---

## 📝 學習要點

### For Development Team

1. **Docker Multi-stage Build 陷阱**:
   - Next.js standalone output 不會自動包含 workspace packages 的依賴
   - pnpm monorepo 需要明確複製 `@prisma/client`
   - 硬編碼版本號會導致維護問題

2. **錯誤診斷策略**:
   - NextAuth "Configuration" 是通用錯誤,需要查看日誌找根本原因
   - 環境變數正確不代表應用能正常運行
   - **Always check Azure App Service logs** for runtime errors

3. **Prisma in Docker**:
   - Prisma Client 在生成後必須存在於 runtime 環境
   - 需要複製 `@prisma/client` 和 `.prisma` 目錄
   - pnpm 的虛擬存儲路徑結構複雜,建議使用動態查找

4. **測試策略**:
   - 本地 Docker 測試不能完全模擬 Azure 環境
   - 部署到 Azure 後必須測試所有依賴資料庫的功能
   - 錯誤日誌是診斷生產問題的最重要工具

### For DevOps Team

1. **部署檢查清單更新**:
   - ✅ 檢查 Docker 映像包含所有必要的依賴
   - ✅ 驗證 Prisma Client 在 runtime 環境中可用
   - ✅ 測試資料庫連接和基本查詢
   - ✅ 測試認證流程(登入/註冊)

2. **監控和警報**:
   - 設置 "MODULE_NOT_FOUND" 錯誤警報
   - 監控登入成功率
   - 追蹤 NextAuth 錯誤頻率

---

## ✅ 修復驗證檢查清單

部署 v8-prisma-fix 後,驗證以下項目:

- [ ] Azure App Service 啟動無錯誤
- [ ] 無 "Cannot find module '@prisma/client'" 日誌
- [ ] 登入頁面正常載入(`/zh-TW/login`)
- [ ] 使用 `admin@itpm.local` / `admin123` 成功登入
- [ ] 登入後重定向到 `/dashboard`
- [ ] 不再顯示 "Configuration" 錯誤
- [ ] 其他需要資料庫的功能正常(註冊、用戶查詢等)

---

**文檔創建日期**: 2025-11-22
**最後更新**: 2025-11-22
**下一步行動**: 實施方案 1 並重新部署
