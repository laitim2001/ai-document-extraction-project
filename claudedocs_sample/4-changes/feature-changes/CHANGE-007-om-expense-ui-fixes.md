# CHANGE-007: OM Expense UI 修正與增強

## 概述
根據 CHANGE-006 後的本地測試反饋，對 OM Expense 相關功能進行進一步修正。

## 變更需求

### 需求 1: Last Year Actual Expense 資料關聯
- **頁面**: `/om-summary` → Category Summary 和 Details List
- **問題**: 確認 "Last Year Actual Expense" 顯示欄位是否已與 OMExpenseItem.lastFYActualExpense 建立關聯
- **目標**: 如尚未關聯，建立正確的資料對應

### 需求 2: Description Textarea 可調整大小
- **頁面**: `/om-expenses/{id}/edit`
- **問題**: Description textarea 目前固定行數，無法調整大小
- **變更**: 移除 `resize-none`，允許用戶調整輸入框大小

### 需求 3: Tab 切換時重置選取狀態
- **頁面**: `/om-expenses/{id}`
- **問題**: 在 Monthly Records tab 選取 item 後，返回 Item List tab 時，Monthly Records tab 名稱仍顯示已選取的項目名稱
- **變更**: 切換到 Item List tab 時，重置 Monthly Records 的選取狀態

## 影響範圍

### 修改文件
| 文件 | 變更 |
|------|------|
| `packages/api/src/routers/omExpense.ts` | getSummary 使用 lastFYActualExpense 欄位 |
| `apps/web/src/components/om-expense/OMExpenseForm.tsx` | textarea resize-y + min-h |
| `apps/web/src/app/[locale]/om-expenses/[id]/page.tsx` | Tab 切換重置邏輯 |

## 實施計劃

### Phase 1: 調查與修正
- [x] 需求 1: 修改 API getSummary 使用 lastFYActualExpense 欄位
- [x] 需求 2: 修改 textarea 樣式 (resize-y + min-h)
- [x] 需求 3: 實現 tab 切換重置邏輯 (handleTabChange)

### Phase 2: 測試驗證
- [x] TypeScript 類型檢查 (通過)
- [ ] 本地測試所有變更

## 實施細節

### 需求 1: omExpense.ts (packages/api/src/routers/)
- 修改 getSummary 中的 Category Summary 計算邏輯
- 修改 getSummary 中的 Detail Data 計算邏輯
- 優先使用 `expenseItem.lastFYActualExpense`
- 回退到 `previousYearMap` (自動查詢上年度資料)

### 需求 2: OMExpenseForm.tsx
- 移除 `resize-none`，改為 `resize-y min-h-[120px]`
- 允許用戶垂直調整輸入框大小

### 需求 3: om-expenses/[id]/page.tsx
- 新增 `handleTabChange` 函數
- 切換到 'items' tab 時重置 `selectedItemId` 為 null
- 清除 Monthly Records tab 名稱顯示

## 相關文檔
- CHANGE-006: OM Expense UI 增強 (lastFYActualExpense 編輯欄位)
- FEAT-008: OM Expense Data Import (lastFYActualExpense 欄位來源)

---

**創建日期**: 2025-12-11
**完成日期**: 2025-12-11
**狀態**: ✅ 已完成
**優先級**: 中
