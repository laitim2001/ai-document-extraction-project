# 2025-12-23 環境設置與代碼合併修復

> **日期**: 2025-12-23
> **類型**: 環境配置 / 代碼合併
> **狀態**: ✅ 已完成
> **關聯**: REFACTOR-001 後的首次本地環境啟動

---

## 問題概覽

在 REFACTOR-001 (Forwarder → Company) 重構完成後，首次在新電腦上啟動本地開發環境時遇到多個問題。

### 問題清單

| # | 問題 | 嚴重程度 | 狀態 |
|---|------|----------|------|
| 1 | 本地開發無法登入（顯示 Azure AD 登入） | 高 | ✅ 已修復 |
| 2 | 資料庫表不存在 (P2021 錯誤) | 高 | ✅ 已修復 |
| 3 | Seed 失敗（Forwarder 欄位不存在） | 高 | ✅ 已修復 |
| 4 | 巢狀目錄代碼未同步 | 高 | ✅ 已修復 |
| 5 | pdfjs-dist ESM/CJS 兼容性問題 | 中 | ⏳ 待處理 |

---

## 問題 1: 本地開發無法登入

### 症狀
- 訪問 `http://localhost:3000` 時被重定向到 Azure AD 登入頁面
- 預期應該顯示本地開發登入表單（email/password）

### 根本原因
`.env` 文件中的 Azure AD 配置使用了 `placeholder` 值，但 `isAzureADConfigured()` 函數的判斷邏輯需要特定前綴才會識別為「未配置」。

### 分析
`src/lib/auth.config.ts` 中的 `isAzureADConfigured()` 函數邏輯：

```typescript
export function isAzureADConfigured(): boolean {
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = process.env.AZURE_AD_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    return false;
  }

  // 檢查是否為 placeholder 值（開發環境）
  if (clientId.startsWith('your-') || clientId === 'placeholder') {
    return false;
  }

  return true;
}
```

原本 `.env` 使用：
```
AZURE_AD_CLIENT_ID="placeholder"
```

### 解決方案
修改 `.env` 中的 Azure AD 配置使用 `your-` 前綴：

```env
# Azure AD (Entra ID) Configuration - Use 'your-' prefix for dev mode
AZURE_AD_CLIENT_ID="your-azure-ad-client-id"
AZURE_AD_CLIENT_SECRET="your-azure-ad-client-secret"
AZURE_AD_TENANT_ID="your-azure-ad-tenant-id"
```

### 驗證
重啟開發伺服器後，成功顯示本地開發登入表單。

---

## 問題 2: 資料庫表不存在

### 症狀
Dashboard API 返回 500 錯誤，日誌顯示：
```
PrismaClientKnownRequestError: P2021
The table `public.documents` does not exist in the current database.
```

### 根本原因
新電腦的 Docker PostgreSQL 容器是新建立的，資料庫中沒有執行 Prisma migrations。

### 解決方案
執行資料庫遷移：

```bash
npx prisma migrate deploy
```

### 驗證
遷移完成後，所有表已建立。

---

## 問題 3: Seed 失敗

### 症狀
執行 `npx prisma db seed` 時報錯：
```
The column `forwarders.code` does not exist in the current database.
```

### 根本原因
Prisma migrations 和 schema 不同步。REFACTOR-001 重構後的 schema 中已將 `Forwarder` 改為 `Company`，但 migration 歷史可能存在問題。

### 解決方案
強制同步 schema 與資料庫：

```bash
npx prisma db push --accept-data-loss
```

**注意**: `--accept-data-loss` 會刪除現有數據，僅適用於開發環境。

### 驗證
Schema 同步後，seed 執行成功。

---

## 問題 4: 巢狀目錄代碼未同步

### 症狀
在測試頁面時發現某些 API 路由返回 404 或類型錯誤，經檢查發現：
- 實際源代碼位於 `ai-document-extraction-project/ai-document-extraction-project/`（巢狀目錄）
- 根目錄的代碼缺少 REFACTOR-001 的變更

### 根本原因
從源電腦複製項目時，創建了巢狀目錄結構，導致：
- Git 追蹤的是根目錄
- 實際修改的代碼在巢狀目錄中

### 解決方案

1. **識別變更檔案**
```bash
git -C "巢狀目錄" status
```
發現 94 個修改檔案和多個新增檔案。

2. **複製檔案到根目錄**
使用 PowerShell 腳本將所有變更複製到根目錄：

```powershell
# 複製修改的檔案
$modifiedFiles = @(
    "src/services/forwarder.service.ts",
    "src/types/forwarder.ts",
    # ... 其他 94 個檔案
)
foreach ($file in $modifiedFiles) {
    Copy-Item -Path "巢狀目錄/$file" -Destination "根目錄/$file" -Force
}

# 複製新增的檔案
$newFiles = @(
    "src/services/company.service.ts",
    "src/types/company.ts",
    "src/types/company-filter.ts",
    "src/hooks/use-companies.ts",
    "src/hooks/use-company-detail.ts",
    "src/hooks/useCompanyList.ts",
    "src/app/api/companies/",
    # ... 其他新增檔案
)
```

3. **驗證代碼**
```bash
npx prisma generate   # 重新生成 Prisma Client
npm run type-check    # TypeScript 類型檢查 ✅
npm run lint          # ESLint 檢查 ✅ (僅 warnings)
```

4. **刪除巢狀目錄**
```bash
npx rimraf "./ai-document-extraction-project"
```
使用 `rimraf` 處理 Windows 長路徑問題（node_modules 路徑過長）。

### 驗證
- TypeScript 類型檢查通過
- ESLint 檢查通過（僅有 warnings）
- 開發伺服器成功啟動
- Dashboard 頁面正常載入

---

## 問題 5: pdfjs-dist ESM/CJS 兼容性問題

### 症狀
訪問 `/review` 頁面時控制台報錯：
```
TypeError: Cannot read properties of undefined (reading 'GlobalWorkerOptions')
```

### 根本原因
`pdfjs-dist` 套件的 ESM/CJS 模組兼容性問題，在 Next.js App Router 環境中常見。

### 狀態
⏳ **待處理** - 此問題已存在，不影響其他功能。

### 可能的解決方案
1. 使用 dynamic import 載入 pdfjs
2. 配置 next.config.ts 的 webpack 設定
3. 考慮使用 react-pdf 替代方案

---

## 受影響的檔案

### 修改的檔案 (94 個)
主要類別：
- API Routes (`src/app/api/**/*.ts`)
- Services (`src/services/*.ts`)
- Components (`src/components/**/*.tsx`)
- Hooks (`src/hooks/*.ts`)
- Types (`src/types/*.ts`)

### 新增的檔案
| 檔案 | 說明 |
|------|------|
| `src/services/company.service.ts` | Company 服務層 |
| `src/types/company.ts` | Company 類型定義 |
| `src/types/company-filter.ts` | Company 篩選器類型 |
| `src/hooks/use-companies.ts` | Company Hooks |
| `src/hooks/use-company-detail.ts` | Company 詳情 Hook |
| `src/hooks/useCompanyList.ts` | Company 列表 Hook |
| `src/app/api/companies/` | Company API 端點 |
| `docs/03-epics/sections/epic-0-*.md` | Epic 0 相關文檔 |

---

## 經驗教訓

### 1. 環境配置標準化
- `.env` 文件應有清晰的註釋說明開發模式配置
- 應使用一致的 placeholder 命名規範（`your-` 前綴）

### 2. 複製項目時注意目錄結構
- 複製項目前確認目標目錄結構
- 使用 `git status` 驗證工作目錄正確

### 3. Prisma Schema 同步
- 開發環境可使用 `npx prisma db push` 快速同步
- 生產環境必須使用 `npx prisma migrate deploy`

### 4. Windows 長路徑問題
- 使用 `rimraf` 處理 node_modules 刪除
- 或啟用 Windows 長路徑支援

---

## 驗證清單

- [x] 本地開發登入正常運作
- [x] Dashboard 頁面正常載入
- [x] Global 頁面正常載入
- [x] Invoices 頁面正常載入
- [x] TypeScript 類型檢查通過
- [x] ESLint 檢查通過
- [x] 巢狀目錄已刪除
- [ ] Review 頁面 pdfjs 問題修復（待處理）

---

## 相關文檔

- [REFACTOR-001: Forwarder → Company](../refactoring/REFACTOR-001-forwarder-to-company.md)
- [開發環境設置指南](../../../docs/04-implementation/setup-guide.md)

---

*記錄人: AI Assistant*
*記錄時間: 2025-12-23*
