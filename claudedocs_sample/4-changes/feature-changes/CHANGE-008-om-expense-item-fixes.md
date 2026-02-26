# CHANGE-008: OM Expense Item 修正

## 概述
修復 Edit Item 對話框中 lastFYActualExpense 無法保存的問題，並增強 Description 輸入欄位。

## 問題與修正

### 問題 1: lastFYActualExpense 無法保存
- **現象**: 在 Edit Item 對話框輸入「上年度實際支出」後儲存，重新開啟時欄位顯示空值
- **根本原因**: `om-expenses/[id]/page.tsx` 的 `transformedItems` useMemo 中，沒有包含 `lastFYActualExpense` 欄位
- **影響**: API 正確儲存了數據，但前端轉換數據時遺漏該欄位，導致 Edit Item Form 的 `initialData` 沒有該值
- **修正**: 在 `transformedItems` 映射中添加 `lastFYActualExpense: item.lastFYActualExpense`

### 要求 1: Edit Item Description 改為可調整大小
- **頁面**: `/om-expenses/{id}` → Edit Item 對話框
- **變更**: Description textarea 從 2 行固定大小改為 5 行可調整大小
- **修正**: `className="resize-none" rows={2}` → `className="resize-y min-h-[120px]" rows={5}`

### 問題 2: Basic Info Description 換行未保留
- **頁面**: `/om-expenses/{id}` → Basic Information → Description
- **現象**: Description 中的換行符號 `\n` 沒有被渲染，文字全擠在一起
- **修正**: 添加 `whitespace-pre-wrap` CSS 類別保留換行

## 影響範圍

### 修改文件
| 文件 | 變更 |
|------|------|
| `apps/web/src/app/[locale]/om-expenses/[id]/page.tsx` | transformedItems 添加 lastFYActualExpense + Description whitespace-pre-wrap |
| `apps/web/src/components/om-expense/OMExpenseItemForm.tsx` | Description textarea resize-y + rows=5 |

### API 變更
- 無 API 變更（API 已正確支援 lastFYActualExpense）

## 實施計劃

### Phase 1: 修正
- [x] 問題 1: 在 transformedItems 中添加 lastFYActualExpense
- [x] 要求 1: Description textarea 改為可調整大小 (5 行)
- [x] 問題 2: Basic Info Description 添加 whitespace-pre-wrap

### Phase 2: 測試驗證
- [x] 本地測試 lastFYActualExpense 保存和讀取
- [x] 本地測試 Description textarea 調整大小功能
- [x] 本地測試 Description 換行顯示

## 相關文檔
- CHANGE-006: OM Expense UI 增強 (lastFYActualExpense 編輯欄位首次添加)
- CHANGE-007: OM Expense UI 修正 (OM Summary 資料關聯)

---

**創建日期**: 2025-12-11
**狀態**: ✅ 已完成
**優先級**: 高（影響用戶數據保存）
