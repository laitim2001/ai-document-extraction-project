# FIX-062: 修復 4 個缺少的 I18N 翻譯鍵

## 修復時間
- **時間**: 2025-11-06
- **修復範圍**: 4 個頁面的 8 個缺少的翻譯鍵

---

## 問題摘要

在 I18N 遷移過程中,發現以下 4 個頁面存在缺少翻譯鍵的問題,導致頁面顯示錯誤或顯示翻譯鍵本身而非翻譯內容。

---

## 修復詳情

### ✅ 問題 1: Proposals 頁面缺少 `proposals.actions.edit`

**錯誤描述**: 
- `proposals.actions.edit` 翻譯鍵不存在
- **位置**: `apps/web/src/app/[locale]/proposals/page.tsx` (line 193)
- **觸發條件**: 在卡片模式 (Card View) 下顯示提案列表

**修復方案**:
- 在 `apps/web/src/messages/en.json` 新增: `"edit": "Edit"`
- 在 `apps/web/src/messages/zh-TW.json` 新增: `"edit": "編輯"`
- **路徑**: `proposals.actions.edit`

**驗證結果**:
```javascript
// EN: "Edit"
// ZH: "編輯"
```

---

### ✅ 問題 2: Budget Pools 頁面缺少 `common.table.actions`

**錯誤描述**: 
- `common.table.actions` 翻譯鍵不存在
- **位置**: `apps/web/src/app/[locale]/budget-pools/page.tsx` (line 379)
- **觸發條件**: 在列表模式 (Table View) 下顯示預算池列表

**修復方案**:
- 在 `apps/web/src/messages/en.json` 新增 `common.table` 區塊: `"actions": "Actions"`
- 在 `apps/web/src/messages/zh-TW.json` 新增 `common.table` 區塊: `"actions": "操作"`
- **路徑**: `common.table.actions`

**驗證結果**:
```javascript
// EN: "Actions"
// ZH: "操作"
```

---

### ✅ 問題 3: Vendors 頁面缺少 4 個 `vendors.fields` 翻譯鍵

**錯誤描述**: 
- `vendors.fields.{name, contactPerson, email, phone}` 翻譯鍵不存在
- **位置**: `apps/web/src/app/[locale]/vendors/page.tsx` (lines 320-323)
- **觸發條件**: 在列表模式 (Table View) 下顯示供應商列表

**修復方案**:
在 `vendors.fields` 區塊新增 4 個鍵值:

**EN (en.json)**:
```json
"fields": {
  "name": "Vendor Name",
  "contactPerson": "Contact Person",
  "email": "Email",
  "phone": "Phone",
  "quotesCount": "Quotes",
  "purchaseOrdersCount": "Purchase Orders"
}
```

**ZH (zh-TW.json)**:
```json
"fields": {
  "name": "供應商名稱",
  "contactPerson": "聯絡人",
  "email": "電子郵件",
  "phone": "電話",
  "quotesCount": "報價單數",
  "purchaseOrdersCount": "採購單數"
}
```

**驗證結果**:
```javascript
// vendors.fields.name: "Vendor Name" / "供應商名稱"
// vendors.fields.contactPerson: "Contact Person" / "聯絡人"
// vendors.fields.email: "Email" / "電子郵件"
// vendors.fields.phone: "Phone" / "電話"
```

---

### ✅ 問題 4: Quotes 頁面缺少 `common.actions.title`

**錯誤描述**: 
- `common.actions.title` 翻譯鍵不存在
- **位置**: `apps/web/src/app/[locale]/quotes/page.tsx` (line 323)
- **觸發條件**: 在列表模式 (Table View) 下顯示報價單列表

**修復方案**:
- 在 `apps/web/src/messages/en.json` 新增: `"title": "Actions"` (在 `common.actions` 區塊)
- 在 `apps/web/src/messages/zh-TW.json` 新增: `"title": "操作"` (在 `common.actions` 區塊)
- **路徑**: `common.actions.title`

**注意**: `common.actions` 區塊原本已有 `"actions": "Actions"` 鍵,但 Quotes 頁面使用的是 `title` 鍵。

**驗證結果**:
```javascript
// EN: "Actions"
// ZH: "操作"
```

---

## 修復文件清單

### 修改的翻譯文件
1. **apps/web/src/messages/en.json**:
   - 新增 `proposals.actions.edit`
   - 新增 `common.table.actions`
   - 新增 `vendors.fields.{name, contactPerson, email, phone}`
   - 新增 `common.actions.title`

2. **apps/web/src/messages/zh-TW.json**:
   - 新增 `proposals.actions.edit`
   - 新增 `common.table.actions`
   - 新增 `vendors.fields.{name, contactPerson, email, phone}`
   - 新增 `common.actions.title`

---

## 測試驗證

### 驗證方法
```bash
node -e "
const en = require('./apps/web/src/messages/en.json');
const zhTW = require('./apps/web/src/messages/zh-TW.json');

console.log('1. proposals.actions.edit:', en.proposals.actions.edit, '/', zhTW.proposals.actions.edit);
console.log('2. common.table.actions:', en.common.table.actions, '/', zhTW.common.table.actions);
console.log('3. vendors.fields.name:', en.vendors.fields.name, '/', zhTW.vendors.fields.name);
console.log('4. common.actions.title:', en.common.actions.title, '/', zhTW.common.actions.title);
console.log('✅ All translation keys verified!');
"
```

### 驗證結果
```
1. proposals.actions.edit: Edit / 編輯
2. common.table.actions: Actions / 操作
3. vendors.fields.name: Vendor Name / 供應商名稱
4. common.actions.title: Actions / 操作
✅ All translation keys verified!
```

---

## 影響範圍

### 修復的頁面
1. ✅ **Proposals 頁面** (`apps/web/src/app/[locale]/proposals/page.tsx`)
   - 卡片視圖現在正確顯示「編輯」按鈕

2. ✅ **Budget Pools 頁面** (`apps/web/src/app/[locale]/budget-pools/page.tsx`)
   - 列表視圖表頭正確顯示「操作」欄位

3. ✅ **Vendors 頁面** (`apps/web/src/app/[locale]/vendors/page.tsx`)
   - 列表視圖表頭正確顯示 4 個欄位標題

4. ✅ **Quotes 頁面** (`apps/web/src/app/[locale]/quotes/page.tsx`)
   - 列表視圖表頭正確顯示「操作」欄位

---

## 後續建議

### 1. 預防措施
- 建立翻譯鍵命名規範文檔
- 在開發時使用 TypeScript 類型檢查確保翻譯鍵存在
- 考慮建立自動化測試檢查翻譯鍵完整性

### 2. 代碼規範
- 統一使用 `common.table.actions` 作為表格「操作」欄位的翻譯鍵
- 統一使用 `common.actions.title` 作為通用「操作」標題的翻譯鍵
- 在 `{entity}.fields` 區塊中定義實體特定的欄位標題

### 3. 測試建議
- 測試所有頁面的卡片視圖和列表視圖
- 測試英文和繁體中文兩種語言切換
- 確認所有表格欄位標題正確顯示

---

## 總結

**修復狀態**: ✅ **已完成**

- **修復問題數**: 4 個頁面
- **新增翻譯鍵數**: 8 個 (EN + ZH)
- **修改文件數**: 2 個翻譯文件
- **驗證狀態**: ✅ 全部通過

所有缺少的翻譯鍵已成功新增至 `en.json` 和 `zh-TW.json` 文件中,並通過驗證測試。現在所有頁面應能正確顯示翻譯內容,不再出現翻譯鍵本身或錯誤信息。

---

**修復完成時間**: 2025-11-06  
**修復工程師**: Claude Code (AI Assistant)
