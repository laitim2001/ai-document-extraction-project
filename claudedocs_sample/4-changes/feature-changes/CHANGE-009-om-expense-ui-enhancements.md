# CHANGE-009: OM Expense UI 增強 (點擊編輯與顯示優化)

## 概述
增強 OM Expense 編輯頁面的用戶體驗，包括點擊 Item Name 直接編輯、簡化 OpCo 顯示。

## 要求清單

### 要求 1: Item Name 可點擊編輯
- **頁面**: `/om-expenses/{id}` → Line Items 表格
- **現況**: 必須點擊 Actions 欄位中的編輯按鈕才能編輯項目
- **需求**: 點擊 Item Name 即可開啟編輯對話框
- **影響組件**: `OMExpenseItemList.tsx` - `SortableRow` 組件

### 要求 2: Line Items OpCo 只顯示 Company Name
- **頁面**: `/om-expenses/{id}` → Line Items 表格 → OpCo 欄位
- **現況**: 顯示 `opCo.code` (如 "TGT")
- **需求**: 改為顯示 `opCo.name` (如 "TGT DC")
- **影響組件**: `OMExpenseItemList.tsx` - `SortableRow` 組件

### 要求 3: Basic Info Default OpCo 只顯示 Company Name
- **頁面**: `/om-expenses/{id}` → Basic Information → Default OpCo
- **現況**: 顯示兩行
  - Badge: `defaultOpCo.code`
  - 文字: `defaultOpCo.name`
- **需求**: 只用 Badge 樣式顯示 `defaultOpCo.name`
- **影響檔案**: `om-expenses/[id]/page.tsx`

## 影響範圍

### 修改檔案
| 檔案 | 變更 |
|------|------|
| `apps/web/src/components/om-expense/OMExpenseItemList.tsx` | Item Name 可點擊 + OpCo 改顯示 name |
| `apps/web/src/app/[locale]/om-expenses/[id]/page.tsx` | Default OpCo 改為只顯示 name |

### API 變更
- 無 API 變更（前端 UI 調整）

## 實施計劃

### Phase 1: 實施
- [x] 要求 1: Item Name 可點擊編輯
- [x] 要求 2: Line Items OpCo 只顯示 company name
- [x] 要求 3: Basic Info Default OpCo 只顯示 company name

### Phase 2: 測試驗證
- [x] 測試點擊 Item Name 可開啟編輯對話框
- [x] 測試 Line Items 的 OpCo 欄位顯示 company name
- [x] 測試 Basic Info 的 Default OpCo 只顯示一行 company name

### 問題修復
- [x] **問題**: 缺少 `omExpenses.items.clickToEdit` 翻譯鍵導致 IntlError
- [x] **修正**: 添加翻譯鍵到 `en.json` 和 `zh-TW.json`

## 技術實現細節

### 要求 1: Item Name 可點擊編輯
**檔案**: `apps/web/src/components/om-expense/OMExpenseItemList.tsx`
```tsx
// Line 263-279: SortableRow 組件中的 Item Name TableCell
<button
  onClick={onEdit}
  className="text-left hover:text-primary hover:underline cursor-pointer transition-colors"
  title={t('items.clickToEdit', { defaultValue: '點擊編輯' })}
>
  {item.name}
</button>
```

### 要求 2: Line Items OpCo 只顯示 company name
**檔案**: `apps/web/src/components/om-expense/OMExpenseItemList.tsx`
```tsx
// Line 281-286: OpCo 欄位改為顯示 name
{item.opCo?.name || '-'}  // 原本是 item.opCo?.code
```

### 要求 3: Basic Info Default OpCo 只顯示 company name
**檔案**: `apps/web/src/app/[locale]/om-expenses/[id]/page.tsx`
```tsx
// Line 450-463: defaultOpCo 只用 Badge 顯示 name
<Badge variant="outline" className="font-mono">
  {omExpense.defaultOpCo.name}  // 移除原本顯示 code 的行和額外的 name 行
</Badge>
```

## 相關文檔
- CHANGE-008: OM Expense Item 修正 (lastFYActualExpense 保存問題)
- CHANGE-007: OM Expense UI 修正 (OM Summary 資料關聯)
- CHANGE-006: OM Expense UI 增強 (lastFYActualExpense 編輯欄位)

---

**創建日期**: 2025-12-11
**狀態**: ✅ 已完成
**優先級**: 中（用戶體驗優化）
