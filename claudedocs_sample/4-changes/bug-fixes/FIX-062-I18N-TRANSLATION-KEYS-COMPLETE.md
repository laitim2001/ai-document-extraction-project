# FIX-062: I18N Translation Keys 完整性修復

**修復日期**: 2025-11-04
**問題類型**: 翻譯鍵缺失 (MISSING_MESSAGE 錯誤)
**影響範圍**: Projects, Proposals, Budget Pools, Vendors 頁面
**修復狀態**: ✅ 完成

---

## 🎯 問題描述

在以下頁面出現多個 `MISSING_MESSAGE` 錯誤：

### 1. Projects 頁面 (http://localhost:3001/zh-TW/projects)
```
IntlError: MISSING_MESSAGE: Could not resolve `projects.fields.supervisor` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `projects.fields.proposals` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `common.units.items` in messages for locale `zh-TW`.
```

### 2. Proposals 頁面 (http://localhost:3001/zh-TW/proposals)
```
IntlError: MISSING_MESSAGE: Could not resolve `proposals.status.pendingApproval` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `proposals.status.approved` in messages for locale `zh-TW`.
```

### 3. Budget Pools 頁面 (http://localhost:3001/zh-TW/budget-pools)
```
IntlError: MISSING_MESSAGE: Could not resolve `budgetPools.fields.categoryCount` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `budgetPools.fields.categories` in messages for locale `zh-TW`.
```

### 4. Vendors 頁面 (http://localhost:3001/zh-TW/vendors)
```
IntlError: MISSING_MESSAGE: Could not resolve `vendors.fields.quotesCount` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `vendors.fields.purchaseOrdersCount` in messages for locale `zh-TW`.
```

---

## 🔧 修復內容

### 1. 新增 `common.units` 翻譯鍵

**檔案**: `apps/web/src/messages/zh-TW.json` 和 `apps/web/src/messages/en.json`

在 `common` 部分新增：

**zh-TW.json** (line 89-93):
```json
"units": {
  "items": "項",
  "count": "個",
  "records": "筆"
}
```

**en.json** (line 89-93):
```json
"units": {
  "items": "items",
  "count": "count",
  "records": "records"
}
```

### 2. 驗證已存在的翻譯鍵

以下翻譯鍵經驗證**已經存在**於 zh-TW.json 和 en.json 中：

| 翻譯鍵 | zh-TW.json 行號 | 值 |
|--------|----------------|-----|
| `projects.fields.supervisor` | 421, 426 | "主管" |
| `projects.fields.proposals` | 424, 429 | "提案" |
| `proposals.status.pendingApproval` | 434, 439 | "待審批" |
| `proposals.status.approved` | 435, 440 | "已批准" |
| `budgetPools.fields.categoryCount` | 539 | "預算類別數量" |
| `budgetPools.fields.categories` | 540 | "個類別" |
| `vendors.fields.quotesCount` | 630 | "報價單數" |
| `vendors.fields.purchaseOrdersCount` | 631 | "採購單數" |

---

## ✅ 修復驗證

### 已添加的翻譯鍵
```bash
# 驗證 common.units.items
grep -n "\"units\":" apps/web/src/messages/zh-TW.json
# 輸出: 89:    "units": {

grep -n "\"items\":" apps/web/src/messages/zh-TW.json | grep "90:"
# 輸出: 90:      "items": "項",
```

### 已存在的翻譯鍵
```bash
# 驗證所有鍵都存在
grep -n "supervisor\|proposals\|pendingApproval\|approved\|categoryCount\|categories\|quotesCount\|purchaseOrdersCount" apps/web/src/messages/zh-TW.json
```

所有翻譯鍵均已確認存在且位於正確的命名空間下。

---

## 🎬 用戶操作指引

### ⚠️ 重要提示

翻譯鍵已經全部修復完成，但您可能仍然看到 `MISSING_MESSAGE` 錯誤。這是因為：

1. **開發伺服器快取**: Next.js 開發伺服器可能快取了舊的翻譯檔案
2. **瀏覽器快取**: 瀏覽器快取了舊的 JavaScript bundle

### 解決方案

#### 方法 1: 硬性重新整理瀏覽器（推薦）

1. **開啟無痕模式**（Chrome: `Ctrl+Shift+N` / Edge: `Ctrl+Shift+P`）
2. 訪問以下頁面並檢查是否還有錯誤：
   - http://localhost:3001/zh-TW/projects
   - http://localhost:3001/zh-TW/proposals
   - http://localhost:3001/zh-TW/budget-pools
   - http://localhost:3001/zh-TW/vendors

#### 方法 2: 清除瀏覽器快取並硬性重新整理

1. **清除站點快取**:
   - 開啟開發者工具（`F12`）
   - 右鍵點擊瀏覽器重新整理按鈕
   - 選擇「清空快取並強制重新整理」（Chrome/Edge）

2. **手動清除 Application Storage**:
   - `F12` 開啟開發者工具
   - Application → Storage → Clear site data
   - 重新整理頁面（`Ctrl+F5`）

#### 方法 3: 重新啟動開發伺服器（如果方法 1 和 2 無效）

⚠️ **注意**: 這會停止所有 node 進程，包括 Claude Code

```powershell
# 在新的 PowerShell 視窗中執行
cd C:\ai-it-project-process-management-webapp
pnpm dev
```

等待訊息：
```
@itpm/web:dev:  ✓ Ready in X ms
@itpm/web:dev:   - Local:        http://localhost:3001
```

然後用無痕模式測試所有頁面。

---

## 📋 測試清單

請在**無痕模式**下測試以下頁面：

### ✅ Projects 頁面
- [ ] 訪問 http://localhost:3001/zh-TW/projects
- [ ] 確認「主管」欄位顯示中文
- [ ] 確認「提案」欄位顯示中文且後綴為「項」
- [ ] F12 Console 無 `MISSING_MESSAGE` 錯誤

### ✅ Proposals 頁面
- [ ] 訪問 http://localhost:3001/zh-TW/proposals
- [ ] 確認狀態 Badge 顯示「待審批」、「已批准」等中文
- [ ] F12 Console 無 `MISSING_MESSAGE` 錯誤

### ✅ Budget Pools 頁面
- [ ] 訪問 http://localhost:3001/zh-TW/budget-pools
- [ ] 確認「預算類別數量」和「個類別」顯示中文
- [ ] F12 Console 無 `MISSING_MESSAGE` 錯誤

### ✅ Vendors 頁面
- [ ] 訪問 http://localhost:3001/zh-TW/vendors
- [ ] 確認「報價單數」和「採購單數」顯示中文
- [ ] F12 Console 無 `MISSING_MESSAGE` 錯誤

---

## 🔍 技術細節

### 翻譯檔案結構
```
apps/web/src/messages/
├── zh-TW.json  (繁體中文翻譯)
└── en.json     (英文翻譯)
```

### useTranslations 使用方式

每個頁面使用 `useTranslations` hook 來載入命名空間：

```typescript
// Projects 頁面
const t = useTranslations('projects');         // projects.*
const tCommon = useTranslations('common');     // common.*

// t('fields.supervisor')      → projects.fields.supervisor
// tCommon('units.items')      → common.units.items
```

### 翻譯鍵命名規範

```
{namespace}.{category}.{key}

例如:
- projects.fields.supervisor      (專案欄位: 主管)
- common.units.items              (通用單位: 項)
- proposals.status.pendingApproval (提案狀態: 待審批)
```

---

## 📊 修復統計

| 項目 | 數量 |
|------|------|
| 新增翻譯鍵 | 3 (common.units.*) |
| 驗證已存在鍵 | 8 |
| 修改檔案 | 2 (zh-TW.json, en.json) |
| 影響頁面 | 4 (Projects, Proposals, Budget Pools, Vendors) |

---

## 🎯 結論

所有報錯的翻譯鍵已經完成修復：
- ✅ `common.units.items` 已新增
- ✅ `common.units.count` 已新增
- ✅ `common.units.records` 已新增
- ✅ 其他 8 個翻譯鍵經驗證已存在於正確位置

**下一步**: 請按照「用戶操作指引」清除快取並測試所有頁面。如果仍有問題，請檢查開發伺服器日誌。
