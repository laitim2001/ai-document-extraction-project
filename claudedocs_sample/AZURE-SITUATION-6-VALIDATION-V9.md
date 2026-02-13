# SITUATION-6 部署指引驗證記錄 - v9 Fresh Build

**驗證日期**: 2025-11-25
**驗證版本**: v9-fresh-build
**驗證目的**: 從零開始完整驗證個人 Azure 環境部署流程

---

## 驗證摘要

### 總體結果: ✅ 驗證通過

| 階段 | 狀態 | 說明 |
|------|------|------|
| 前置檢查 | ✅ 通過 | Azure CLI、Node.js、Docker 正常 |
| Docker 構建 | ✅ 通過 | --no-cache 從零構建成功 |
| ACR 推送 | ✅ 通過 | 鏡像成功推送到 acritpmdev |
| App Service 部署 | ✅ 通過 | 應用程式正常運行 |
| 端點驗證 | ✅ 通過 | 多個端點返回預期狀態碼 |

---

## 詳細驗證記錄

### 1. 前置檢查

```bash
# Azure CLI 登入
az login  # ✅ 成功

# 工具版本
node --version   # v20.11.0 ✅
pnpm --version   # 8.15.3 ✅
docker --version # Docker version 27.5.1 ✅
```

### 2. Docker 構建 (從零開始)

```bash
# 執行構建指令
docker build --no-cache -t itpm-web:latest -f docker/Dockerfile .
```

**構建結果**:
- 構建時間: ~7 分鐘 (包含 350.8 秒的 chown 操作)
- 鏡像大小: 1.79GB
- 頁面數量: 66 頁 (Next.js 14.2.33)
- 構建時間 (Next.js): 42.932s

**關鍵構建步驟**:
1. ✅ 依賴安裝 (649 packages) - 19.4s
2. ✅ Prisma Client 生成 (builder stage) - 3.0s
3. ✅ Next.js 構建 - 44.7s
4. ✅ Prisma Client 生成 (runner stage) - 14.0s
5. ✅ @prisma/client 模組載入測試通過
6. ✅ 鏡像導出 - 29.6s

### 3. ACR 推送

```bash
# 登入 ACR
az acr login --name acritpmdev  # ✅ Login Succeeded

# 推送鏡像
docker push acritpmdev.azurecr.io/itpm-web:latest
# ✅ 推送成功 (sha256:b80a27ff1f473bab9bc903f75d91fdb1cf1d51bb810620aa23c167cf93ae5197)

docker push acritpmdev.azurecr.io/itpm-web:v9-fresh-build
# ✅ 推送成功 (使用已存在的層)
```

### 4. App Service 部署

```bash
# 重啟 App Service
az webapp restart --name app-itpm-dev-001 --resource-group rg-itpm-dev
# ✅ 重啟成功
```

### 5. 端點驗證

| 端點 | HTTP 狀態碼 | 結果 |
|------|-------------|------|
| `/zh-TW/login` | 200 | ✅ 正常 |
| `/` | 307 | ✅ 正常 (重定向) |
| `/zh-TW/dashboard` | 200 | ✅ 正常 |
| `/api/trpc` | 404 | ✅ 正常 (tRPC 需要具體 procedure) |

**應用程式 URL**: https://app-itpm-dev-001.azurewebsites.net

---

## 腳本修復記錄

### 已修復問題

在此次驗證過程中 (含前置 session)，發現並修復了以下腳本問題:

#### 1. jq 依賴移除

**問題**: 所有 5 個部署腳本 (`01-setup-resources.sh` 到 `05-setup-appservice.sh`) 都依賴 `jq` 工具，但 Windows Git Bash 環境沒有預安裝 `jq`。

**解決方案**: 將所有 `jq` 調用替換為 Azure CLI 原生查詢語法:

```bash
# 修復前 (使用 jq)
az group show --name "$RESOURCE_GROUP" | jq -r '.name'

# 修復後 (使用 Azure CLI 原生查詢)
az group show --name "$RESOURCE_GROUP" --query "name" -o tsv
```

**受影響文件**:
- `azure/scripts/01-setup-resources.sh`
- `azure/scripts/02-setup-database.sh`
- `azure/scripts/03-setup-storage.sh`
- `azure/scripts/04-setup-acr.sh`
- `azure/scripts/05-setup-appservice.sh`

#### 2. Storage Account 認證修復

**問題**: `03-setup-storage.sh` 使用 `--auth-mode login` 時遇到權限問題。

**錯誤訊息**:
```
You do not have the required permissions needed to perform this operation.
```

**解決方案**: 改用 Storage Account Key 認證:

```bash
# 修復前
az storage blob service-properties ... --auth-mode login

# 修復後
STORAGE_KEY=$(az storage account keys list \
    --resource-group "$RESOURCE_GROUP" \
    --account-name "$STORAGE_ACCOUNT" \
    --query "[0].value" -o tsv)
az storage blob service-properties ... --account-key "$STORAGE_KEY"
```

#### 3. ACR 角色分配修復

**問題**: `05-setup-appservice.sh` 中的 ACR 角色分配缺少必要的 `--resource-group` 參數。

**錯誤訊息**:
```
MissingSubscription: The request did not have a subscription...
```

**解決方案**: 添加 `--resource-group` 參數和錯誤處理:

```bash
# 修復後
ACR_RESOURCE_ID=$(az acr show \
    --name "$ACR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "id" -o tsv 2>/dev/null || echo "")

if [ -n "$ACR_RESOURCE_ID" ] && [ -n "$PRINCIPAL_ID" ]; then
    # 檢查角色是否已存在
    EXISTING_ROLE=$(az role assignment list \
        --assignee "$PRINCIPAL_ID" \
        --role "AcrPull" \
        --scope "$ACR_RESOURCE_ID" \
        --query "[0].id" -o tsv 2>/dev/null || echo "")

    if [ -z "$EXISTING_ROLE" ]; then
        az role assignment create ... || log_warning "角色分配可能已存在或權限不足"
    fi
fi
```

---

## SITUATION-6 文檔驗證結果

### 驗證項目對照

根據 `SITUATION-6-AZURE-DEPLOY-PERSONAL.md` 的檢查清單:

#### 首次部署前 ✅
- [x] 已登入正確的個人 Azure 訂閱
- [x] Node.js >= 20.0.0 (v20.11.0)
- [x] Docker daemon 運行中
- [x] pnpm >= 8.0.0 (8.15.3)

#### 部署中 ✅
- [x] 資源群組創建成功 (rg-itpm-dev)
- [x] PostgreSQL 資料庫啟動 (psql-itpm-dev-001)
- [x] Storage Account 容器創建 (stitpmdev001)
- [x] ACR 可訪問 (acritpmdev)
- [x] App Service 運行中 (app-itpm-dev-001)
- [x] Docker 映像推送成功

#### 部署後 ✅
- [x] 應用程式可訪問
- [x] 登入頁面正常顯示 (HTTP 200)
- [x] 儀表板頁面可訪問 (HTTP 200)
- [ ] 登入功能正常 (未測試實際登入，需要用戶互動)
- [ ] 資料庫連接正常 (未測試資料庫操作)
- [ ] 文件上傳功能正常 (未測試)
- [x] 日誌無嚴重錯誤 (容器正常啟動)

---

## 建議改進

### 文檔改進建議

1. **添加 jq 替代說明**: 在 SITUATION-6 文檔中說明腳本已移除 jq 依賴，改用 Azure CLI 原生查詢。

2. **添加 Windows 相容性說明**: 說明腳本已優化支援 Windows Git Bash 環境。

3. **添加構建時間預估**:
   - 首次構建 (--no-cache): ~7 分鐘
   - 增量構建: ~2-3 分鐘

### 腳本改進建議

1. **添加進度指示器**: 特別是 Docker 構建過程中的長時間操作 (如 chown)。

2. **添加超時處理**: 為長時間操作添加超時機制。

3. **添加驗證腳本**: 創建 `azure/scripts/helper/verify-deployment.sh`

---

## 版本信息

| 項目 | 版本/值 |
|------|---------|
| Docker 鏡像 Tag | v9-fresh-build |
| 鏡像 SHA | sha256:b80a27ff1f473bab9bc903f75d91fdb1cf1d51bb810620aa23c167cf93ae5197 |
| Next.js 版本 | 14.2.33 |
| Prisma 版本 | 5.22.0 |
| Node.js 版本 | 20 (Alpine 3.17) |
| 頁面數量 | 66 |

---

**驗證人**: AI Assistant
**驗證環境**: Windows 11 + Git Bash + Docker Desktop
**部署目標**: Azure App Service (app-itpm-dev-001)
