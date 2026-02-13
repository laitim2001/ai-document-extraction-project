# CHANGE-010: Data Import 增強 (日期驗證與欄位默認值)

## 概述
增強 OM Expense Data Import 功能，包括 Maintenance end date 驗證、FY25 Actual 導入、Currency 默認值設定。

## 要求清單

### 問題 1: Maintenance end date 驗證增強
- **頁面**: `/data-import` → Excel 檔案處理流程
- **現況**: `formatDate()` 函數對空值或無效值返回 `null`，不會報錯，API 端會默認使用年度結束日期
- **需求**:
  1. 先檢查是否有數據，數據類型是否正確，如果正確就直接進一步處理
  2. 如果數據為空就跳至錯誤狀況，不繼續執行
  3. 如果有數據但數據類型錯誤也是跳至錯誤狀況，不繼續執行
- **影響檔案**: `apps/web/src/app/[locale]/data-import/page.tsx`

### 要求 1: FY25 Actual 導入至 lastFYActualExpense
- **頁面**: `/data-import` → OM Expense Items 導入
- **現況**: `lastFYActualExpense` 使用 `safeFloat(value, 0) || null`，空值時為 `null`
- **需求**: 空值時默認為 `0.00`，而非 `null`
- **影響檔案**:
  - `apps/web/src/app/[locale]/data-import/page.tsx` (前端解析)
  - `packages/api/src/routers/omExpense.ts` (API 端處理)

### 要求 2: Currency 默認設定為美元 (USD)
- **頁面**: `/data-import` → OM Expense Items 導入
- **現況**: 導入時未設定 `currencyId` 欄位
- **需求**: 所有導入的 OM Expense Items 的 currency 默認設定為美元 (USD)
- **影響檔案**:
  - `apps/web/src/app/[locale]/data-import/page.tsx` (前端解析)
  - `packages/api/src/routers/omExpense.ts` (API 端處理)

## 影響範圍

### 修改檔案
| 檔案 | 變更 |
|------|------|
| `apps/web/src/app/[locale]/data-import/page.tsx` | endDate 驗證 + lastFYActualExpense 默認值 |
| `packages/api/src/routers/omExpense.ts` | lastFYActualExpense 默認值 + currencyId 默認 USD |

### API 變更
- `omExpense.importData` procedure:
  - `lastFYActualExpense`: `null` → `0` 默認值
  - `currencyId`: 新增欄位，默認查詢 USD

## 技術實現細節

### 問題 1: endDate 驗證增強
**檔案**: `apps/web/src/app/[locale]/data-import/page.tsx`

```typescript
// 現有的 formatDate 函數
const formatDate = (value: CellValue): string | null => {
  if (value == null || value === '') return null;
  // ... 日期解析邏輯
};

// 新增: validateEndDate 函數 - 驗證 endDate 並返回錯誤訊息
const validateEndDate = (value: CellValue, rowIndex: number): { valid: boolean; date: string | null; error?: string } => {
  // 1. 檢查是否為空
  if (value == null || value === '' || (typeof value === 'string' && value.trim() === '')) {
    return {
      valid: false,
      date: null,
      error: `Row ${rowIndex}: Maintenance end date is required but empty`
    };
  }

  // 2. 嘗試解析日期
  const parsedDate = formatDate(value);

  // 3. 檢查是否解析成功
  if (!parsedDate) {
    return {
      valid: false,
      date: null,
      error: `Row ${rowIndex}: Maintenance end date has invalid format: "${value}"`
    };
  }

  return { valid: true, date: parsedDate };
};
```

### 要求 1: lastFYActualExpense 默認值
**前端**: `apps/web/src/app/[locale]/data-import/page.tsx`
```typescript
// 變更前
const lastFYActualExpense = row.length > EXCEL_COLUMN_MAP.lastFYActualExpense
  ? safeFloat(row[EXCEL_COLUMN_MAP.lastFYActualExpense], 0) || null
  : null;

// 變更後 - 默認 0 而非 null
const lastFYActualExpense = row.length > EXCEL_COLUMN_MAP.lastFYActualExpense
  ? safeFloat(row[EXCEL_COLUMN_MAP.lastFYActualExpense], 0) ?? 0
  : 0;
```

**API**: `packages/api/src/routers/omExpense.ts`
```typescript
// 變更前
lastFYActualExpense: item.lastFYActualExpense ?? null,

// 變更後
lastFYActualExpense: item.lastFYActualExpense ?? 0,
```

### 要求 2: currencyId 默認 USD
**API**: `packages/api/src/routers/omExpense.ts`
```typescript
// 在 importData procedure 中查詢 USD currency
const usdCurrency = await tx.currency.findFirst({
  where: { code: 'USD' }
});

// 創建 OMExpenseItem 時設定 currencyId
const newItem = await tx.oMExpenseItem.create({
  data: {
    // ... 其他欄位
    currencyId: usdCurrency?.id ?? null, // 默認 USD
  },
});
```

## 實施計劃

### Phase 1: 前端驗證增強
- [x] 問題1: endDate 空值檢查和錯誤處理
- [x] 問題1: endDate 格式驗證和錯誤處理
- [x] 要求1: lastFYActualExpense 前端默認值改為 0
- [x] 新增翻譯鍵: `missingEndDate`, `invalidEndDateFormat`

### Phase 2: API 端處理
- [x] 要求1: lastFYActualExpense API 默認值改為 0
- [x] 要求2: 查詢 USD currency 並設定 currencyId

### Phase 3: 欄位映射修正 (2025-12-11 補充)
- [x] 修正 EXCEL_COLUMN_MAP 中 lastFYActualExpense 欄位映射
  - 錯誤: index 13 (Column N)
  - 正確: index 10 (Column K: "FY25 Actual OM Expense Charges")

### Phase 4: 測試驗證
- [x] 測試空白 endDate 報錯 (已改為 CHANGE-011 isOngoing=true)
- [x] 測試無效格式 endDate 報錯
- [x] 測試 lastFYActualExpense 空值時為 0
- [x] 測試 currencyId 默認為 USD

## 相關文檔
- CHANGE-008: OM Expense Item 修正 (lastFYActualExpense 保存問題)
- CHANGE-009: OM Expense UI 增強 (點擊編輯與顯示優化)
- FEAT-007: OM Expense 表頭-明細架構重構

---

**創建日期**: 2025-12-11
**完成日期**: 2025-12-11
**狀態**: ✅ 已完成並測試通過
**優先級**: 高（數據完整性）

## 實作記錄

### 2025-12-11 補充修正
- 發現 EXCEL_COLUMN_MAP 中 lastFYActualExpense 欄位映射錯誤
- 經實際檢查 Excel 檔案，Column K (index 10) 才是 "FY25 Actual OM Expense Charges"
- 原本錯誤映射到 index 13 (Column N)
- 已在 commit `c401f51` 中修正
