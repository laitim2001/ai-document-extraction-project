# CHANGE-006: OM Expense UI 增強

## 概述
根據用戶測試反饋，對 OM Expense 相關頁面進行多項 UI 增強。

## 變更需求

### 需求 1: 隱藏 OM Summary Detail List 的 Description
- **頁面**: `/om-summary` → Detail List
- **變更**: 隱藏 OM Expense Description 和 OM Expense Items Detail Description
- **原因**: 簡化顯示，Description 內容較長影響閱讀體驗

### 需求 2: 添加 Last Year Actual Amount 編輯欄位
- **頁面**: `/om-expenses/{id}` → Edit Item 對話框
- **變更**: 添加 "Last Year Actual Maintenance Charges" 輸入欄位
- **欄位**: `lastFYActualExpense` (已存在於 OMExpenseItem schema)
- **類型**: 數字輸入，可選填

### 需求 3: Description 改為 Textarea
- **頁面**: `/om-expenses/{id}/edit`
- **變更**: 將 Description 輸入欄從 Input 改為 Textarea
- **規格**: 預設顯示 5 行

### 需求 4: 預設 List View
- **頁面**: `/om-expenses`
- **變更**: 將預設視圖從 Card View 改為 List View
- **原因**: List View 更適合瀏覽大量數據

## 影響範圍

### 修改文件
| 文件 | 變更 |
|------|------|
| `apps/web/src/components/om-summary/OMSummaryDetailGrid.tsx` | 隱藏 description 欄位 |
| `apps/web/src/components/om-expense/OMExpenseItemForm.tsx` | 添加 lastFYActualExpense 輸入欄位 |
| `apps/web/src/components/om-expense/OMExpenseForm.tsx` | Description 改為 Textarea |
| `apps/web/src/app/[locale]/om-expenses/page.tsx` | 預設 viewMode 改為 'list' |
| `apps/web/src/messages/en.json` | 添加相關翻譯 |
| `apps/web/src/messages/zh-TW.json` | 添加相關翻譯 |

### API 變更
- 無 API 變更（所有欄位已存在）

### Schema 變更
- 無 Schema 變更（lastFYActualExpense 已在 FEAT-008 添加）

## 實施計劃

### Phase 1: UI 變更
- [x] 創建變更記錄文檔
- [x] 需求 1: 隱藏 OM Summary 的 description
- [x] 需求 2: 添加 lastFYActualExpense 編輯欄位
- [x] 需求 3: Description 改為 Textarea (5行)
- [x] 需求 4: 預設 List View

### Phase 2: 測試驗證
- [x] 翻譯完整性檢查 (pnpm validate:i18n 通過)
- [ ] 本地測試所有變更
- [ ] TypeScript 類型檢查

## 實施細節

### 需求 1: OMSummaryDetailGrid.tsx
- 註解隱藏 3 處 description 顯示區域
- Line 402-407: Header description
- Line 455-458: Item description (OMExpenseHeaderSection)
- Line 555-558: Item description (ItemTable)

### 需求 2: OMExpenseItemForm.tsx
- 新增 type 定義: `lastFYActualExpense?: number | null`
- 新增 Zod schema: `lastFYActualExpense: z.number().optional().nullable()`
- 新增 defaultValues/reset 邏輯
- 新增 Form UI (Input type="number")
- 新增翻譯鍵: `omExpenses.itemFields.lastFYActualExpense`

### 需求 3: OMExpenseForm.tsx
- Textarea rows 從 3 改為 5

### 需求 4: om-expenses/page.tsx
- viewMode 初始值從 'card' 改為 'list'

## 相關文檔
- FEAT-008: OM Expense Data Import (lastFYActualExpense 欄位來源)
- CHANGE-004: OM Summary Header-Detail Display

---

**創建日期**: 2025-12-10
**完成日期**: 2025-12-11
**狀態**: ✅ 已完成
**優先級**: 中
