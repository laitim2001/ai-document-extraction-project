# CHANGE-011: OM Expense Item 新增 On-Going 欄位

## 概述
為 OM Expense Item Detail 新增 `isOngoing` (持續進行中) 欄位，當選取時 End date 變為非必填。同時修改 Data Import 邏輯以支援此新欄位。

## 要求清單

### 要求 1: 新增 isOngoing 欄位
- **模型**: `OMExpenseItem`
- **欄位**: `isOngoing` (Boolean, 默認 false)
- **業務邏輯**:
  - 當 `isOngoing = true` 時，`endDate` 為非必填
  - 當 `isOngoing = false` 時，`endDate` 為必填
- **影響範圍**:
  - Prisma schema
  - OM Expense Item 表單
  - OM Expense Item 列表顯示
  - Data Import 處理邏輯

### 問題 1: Data Import 邏輯修改
- **頁面**: `/data-import` → Excel 檔案處理流程
- **現況** (CHANGE-010): endDate 空值會報錯
- **新需求**:
  1. 先檢查是否有數據和數據類型是否正確 (需要是日期格式)，如果正確就直接進一步處理
  2. 如果數據為空就在生成 item detail 記錄時把 `isOngoing` 設定為 `true`，再繼續進行
  3. 如果有數據但數據類型錯誤也是跳至錯誤狀況，不繼續執行

## 影響範圍

### 修改檔案
| 檔案 | 變更 |
|------|------|
| `packages/db/prisma/schema.prisma` | 新增 OMExpenseItem.isOngoing 欄位 |
| `apps/web/src/app/[locale]/data-import/page.tsx` | 修改 endDate 驗證邏輯 |
| `packages/api/src/routers/omExpense.ts` | 支援 isOngoing 欄位 |
| `apps/web/src/components/om-expense/OMExpenseItemForm.tsx` | 新增 On-Going checkbox |
| `apps/web/src/components/om-expense/OMExpenseItemList.tsx` | 顯示 On-Going 狀態 |
| `apps/web/src/messages/en.json` | 新增翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 新增翻譯鍵 |

### API 變更
- `omExpense.importData`: 支援 isOngoing 欄位
- `omExpense.createWithItems`: 支援 isOngoing 欄位
- `omExpense.addItem`: 支援 isOngoing 欄位
- `omExpense.updateItem`: 支援 isOngoing 欄位

## 技術實現細節

### 1. Prisma Schema 變更
```prisma
model OMExpenseItem {
  // ... 現有欄位
  isOngoing Boolean @default(false) // CHANGE-011: 持續進行中標記
  endDate   DateTime? // 改為可選（當 isOngoing=true 時可為 null）
  // ...
}
```

### 2. Data Import 邏輯變更
```typescript
// CHANGE-011: 修改 endDate 驗證邏輯
const rawEndDate = row[EXCEL_COLUMN_MAP.endDate];
const endDateIsEmpty = rawEndDate === null || rawEndDate === undefined || rawEndDate === '' ||
  (typeof rawEndDate === 'string' && rawEndDate.trim() === '');

let endDate: string | null = null;
let isOngoing = false;

if (endDateIsEmpty) {
  // 空值 → 設定 isOngoing = true，繼續處理
  isOngoing = true;
  endDate = null;
} else {
  // 有值 → 驗證格式
  endDate = formatDate(rawEndDate);
  if (!endDate) {
    // 格式錯誤 → 報錯
    errorRows.push({
      rowNumber,
      field: 'End Date',
      reason: t('errors.invalidEndDateFormat', { row: rowNumber, value: String(rawEndDate) }),
      rawValue: String(rawEndDate),
    });
    continue;
  }
}
```

### 3. API 處理
```typescript
// 創建 OMExpenseItem 時
const newItem = await tx.oMExpenseItem.create({
  data: {
    // ... 其他欄位
    isOngoing: item.isOngoing ?? false,
    endDate: item.isOngoing ? null : (item.endDate ? new Date(item.endDate) : null),
  },
});
```

## 實施計劃

### Phase 1: Schema 更新 ✅
- [x] 修改 Prisma schema 新增 isOngoing 欄位
- [x] 修改 endDate 為可選
- [x] 生成並執行 migration

### Phase 2: 前端 UI 更新 ✅
- [x] OMExpenseItemForm: 新增 On-Going checkbox
- [x] 條件式 End Date 必填驗證
- [x] End Date disabled 當 isOngoing=true
- [x] 新增翻譯鍵 (isOngoing.label, isOngoing.description, endDate.requiredWhenNotOngoing, endDate.ongoingHint)

### Phase 3: API 更新 ✅
- [x] importOMExpenseItemSchema: 支援 isOngoing
- [x] omExpenseItemSchema: 支援 isOngoing
- [x] updateItemSchema: 支援 isOngoing
- [x] importData procedure: 支援 isOngoing 邏輯

### Phase 4: Data Import 邏輯修改 ✅
- [x] 修改 endDate 驗證邏輯 (空值 → isOngoing=true)
- [x] 保留格式錯誤報錯邏輯

### Phase 5: 測試驗證 ✅
- [x] 測試 On-Going checkbox 功能
- [x] 測試空白 End Date 導入時 isOngoing = true
- [x] 測試有效 End Date 導入
- [x] 測試無效格式 End Date 報錯

## 實作記錄

### 2025-12-11 實作完成

**修改檔案清單**:
1. `packages/db/prisma/schema.prisma` - 新增 isOngoing 欄位，endDate 改為可選
2. `apps/web/src/app/[locale]/data-import/page.tsx` - 空值時設定 isOngoing=true
3. `packages/api/src/routers/omExpense.ts` - API schema 和 procedure 支援 isOngoing
4. `apps/web/src/components/om-expense/OMExpenseItemForm.tsx` - 新增 checkbox UI 和條件式驗證
5. `apps/web/src/messages/en.json` - 新增翻譯
6. `apps/web/src/messages/zh-TW.json` - 新增翻譯

**驗證結果**:
- ✅ Prisma generate 成功
- ✅ i18n 驗證通過 (2285 個鍵，結構一致)
- ⚠️ TypeScript 錯誤為預先存在問題，非 CHANGE-011 引起

### 2025-12-11 測試發現問題並修復

**問題 1: isOngoing 保存無效**
- 現象: 勾選 On-Going 並保存後，重新開啟 item detail 時未選中
- 原因: `updateItem` API procedure 未處理 isOngoing 欄位
- 修復: 更新 `omExpense.ts` updateItem 邏輯
  - 新增 isOngoing 到 dataToUpdate
  - 當 isOngoing=true 時自動清空 endDate
  - 修正日期驗證邏輯考慮 isOngoing 狀態
- Commit: `b349192`

**問題 2: 日期格式解析錯誤**
- 現象: Data import 時所有日期驗證失敗
- 錯誤: "Invalid end date format: Thu Jul 30 2026 00:00:00 GMT+0000"
- 原因: `formatDate` 函數未處理 JavaScript Date 對象
- 修復: 新增 `if (value instanceof Date)` 處理
- Commit: `9506345`

**問題 3: isOngoing 未傳遞到 API**
- 現象: Data import 時空 endDate 的項目沒有設定 isOngoing=true
- 原因: 前端 mutation payload 未包含 isOngoing 欄位
- 修復: 在 map 函數中新增 `isOngoing: item.isOngoing ?? false`
- Commit: `2fec107`

**問題 4: lastFYActualExpense 欄位映射錯誤**
- 現象: FY25 Actual OM Expense Charges 數據未導入
- 原因: EXCEL_COLUMN_MAP 映射到錯誤的欄位 (index 13 而非 10)
- 修復: 修正 `lastFYActualExpense: 10` (Column K)
- Commit: `c401f51`

## 相關文檔
- CHANGE-010: Data Import 增強 (日期驗證與欄位默認值)
- FEAT-007: OM Expense 表頭-明細架構重構

---

**創建日期**: 2025-12-11
**完成日期**: 2025-12-11
**狀態**: ✅ 已完成並測試通過
**優先級**: 高

## Git Commits

| Commit | 描述 |
|--------|------|
| `9ff6d8c` | feat(om-expense): CHANGE-011 新增 isOngoing 持續進行中欄位 |
| `b349192` | fix(om-expense): CHANGE-011 修復 isOngoing 保存和清空 endDate |
| `9506345` | fix(data-import): 修復 Date 對象格式的日期解析 |
| `2fec107` | fix(data-import): CHANGE-011 修復 isOngoing 和 lastFYActualExpense 傳遞 |
| `c401f51` | fix(data-import): 修正 EXCEL_COLUMN_MAP lastFYActualExpense 欄位映射 |
