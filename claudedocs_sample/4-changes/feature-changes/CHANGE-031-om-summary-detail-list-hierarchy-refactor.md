# CHANGE-031: OM Summary Detail List 顯示層級重構

> **建立日期**: 2025-12-16
> **完成日期**: 2025-12-16
> **狀態**: ✅ 已完成
> **優先級**: High
> **複雜度**: 高
> **實際工時**: ~4 小時

---

## 1. 變更概述

### 1.1 當前層級結構
```
第1層 - Expense Category
  └── 第2層 - Operating Company (根據 Item Detail 的 OpCo 過濾)
        └── 第3層 - OM Expense Header
              └── 第4層 - OM Expense Item Details
```

### 1.2 期望層級結構 (根據設計圖)
```
第1層 - OM Expense Category (藍色背景)
  └── 第2層 - OM Expense Header (黃色背景)
        └── 第3層 - OM Expense Item Detail (OpCos) (橙色背景)
              └── 第4層 - OM Expense Item Detail Name (粉色背景)
```

### 1.3 設計圖參考
![OM Summary 設計圖](c:\Users\rci.ChrisLai\Documents\it-budget-project-management-portal-OMExpense-summary-screen-6.png)

### 1.4 變更原因
- 邏輯更清晰：Category → Header → OpCo → Item 的層級更符合數據結構
- 用戶體驗：更容易按 Header 查看所有相關 Item

---

## 2. 數據結構分析

### 2.1 現有數據模型關係
```
OMExpense (Header)
├── category: string
├── financialYear: number
└── items: OMExpenseItem[]
      ├── name: string (Item Name)
      ├── opCoId: string (Operating Company)
      ├── budgetAmount: number
      └── monthly: OMExpenseMonthly[]
```

### 2.2 新層級對應
| 層級 | 數據來源 | 顯示內容 | 背景色 |
|------|----------|----------|--------|
| 第1層 | `OMExpense.category` | Category 名稱 | 藍色 |
| 第2層 | `OMExpense` | Header 名稱 + Budget 總額 | 黃色 |
| 第3層 | `OMExpenseItem.opCoId` | OpCo 名稱 | 橙色 |
| 第4層 | `OMExpenseItem.name` | Item 名稱 + Budget 金額 | 粉色 |

---

## 3. 技術設計

### 3.1 影響範圍

| 類型 | 檔案路徑 | 變更說明 |
|------|----------|----------|
| 組件 | `apps/web/src/components/om-summary/OMSummaryDetailGrid.tsx` | 重構層級顯示邏輯 |
| 組件 | `apps/web/src/components/om-summary/OMSummaryTable.tsx` | 可能需要調整數據傳遞 |
| API | `packages/api/src/routers/omExpense.ts` | 可能需要調整 `getDetail` 返回結構 |
| 樣式 | 各組件的 className | 調整各層級背景色 |

### 3.2 新數據結構設計

```typescript
// 新的 Detail 數據結構
interface CategoryGroup {
  category: string;
  headers: HeaderGroup[];
}

interface HeaderGroup {
  headerId: string;
  headerName: string;
  headerBudget: number;  // 該 Header 下所有 Item 的 Budget 總和
  opCoGroups: OpCoGroup[];
}

interface OpCoGroup {
  opCoId: string;
  opCoName: string;
  items: ItemDetail[];
}

interface ItemDetail {
  itemId: string;
  itemName: string;
  budgetAmount: number;
  // ... 其他欄位
}
```

### 3.3 數據轉換邏輯

```typescript
function transformToNewHierarchy(rawData: OMExpenseData[]): CategoryGroup[] {
  const categoryMap = new Map<string, CategoryGroup>();

  for (const expense of rawData) {
    // 第1層: Category
    if (!categoryMap.has(expense.category)) {
      categoryMap.set(expense.category, {
        category: expense.category,
        headers: []
      });
    }
    const categoryGroup = categoryMap.get(expense.category)!;

    // 第2層: Header
    const headerGroup: HeaderGroup = {
      headerId: expense.id,
      headerName: expense.name,
      headerBudget: 0,
      opCoGroups: []
    };

    // 第3層: OpCo → 第4層: Item
    const opCoMap = new Map<string, OpCoGroup>();
    for (const item of expense.items) {
      if (!opCoMap.has(item.opCoId)) {
        opCoMap.set(item.opCoId, {
          opCoId: item.opCoId,
          opCoName: item.opCo.name,
          items: []
        });
      }
      opCoMap.get(item.opCoId)!.items.push({
        itemId: item.id,
        itemName: item.name,
        budgetAmount: item.budgetAmount,
        // ...
      });
      headerGroup.headerBudget += item.budgetAmount;
    }

    headerGroup.opCoGroups = Array.from(opCoMap.values());
    categoryGroup.headers.push(headerGroup);
  }

  return Array.from(categoryMap.values());
}
```

### 3.4 UI 組件結構

```tsx
// OMSummaryDetailGrid.tsx
{categories.map(category => (
  <CategoryRow key={category.category} category={category}>    {/* 第1層 - 藍色 */}
    {category.headers.map(header => (
      <HeaderRow key={header.headerId} header={header}>         {/* 第2層 - 黃色 */}
        {header.opCoGroups.map(opCo => (
          <OpCoRow key={opCo.opCoId} opCo={opCo}>               {/* 第3層 - 橙色 */}
            {opCo.items.map(item => (
              <ItemRow key={item.itemId} item={item} />          {/* 第4層 - 粉色 */}
            ))}
          </OpCoRow>
        ))}
      </HeaderRow>
    ))}
  </CategoryRow>
))}
```

### 3.5 樣式設計

```typescript
const levelStyles = {
  level1_category: 'bg-blue-100 dark:bg-blue-900/30',      // 藍色
  level2_header: 'bg-yellow-100 dark:bg-yellow-900/30',    // 黃色
  level3_opco: 'bg-orange-100 dark:bg-orange-900/30',      // 橙色
  level4_item: 'bg-pink-100 dark:bg-pink-900/30',          // 粉色
};
```

---

## 4. 實施計劃

### Phase 1: 後端調整 (如需要)
- [x] 檢查現有 `getDetail` API - **無需調整**，現有結構可支援前端轉換
- [x] 確保返回的數據包含所有必要欄位 - **確認完成**

### Phase 2: 前端數據轉換
- [x] 實現 `transformToHeaderCentric` 函數 - 在 `OMSummaryDetailGrid.tsx` 中新增
- [x] 定義新類型結構：`HeaderOpCoGroup`, `CategoryHeaderGroup`, `HeaderCentricCategoryGroup`

### Phase 3: UI 組件重構
- [x] 重構 `OMSummaryDetailGrid.tsx` - 使用新 4 層 Accordion 結構
- [x] 調整各層級樣式 (藍 → 黃 → 橙 → 粉)
- [x] 實現展開/收合功能 - 所有層級預設展開
- [x] 新增 `ItemTableNew` 組件支援層級樣式

### Phase 4: 測試驗證
- [x] TypeScript 類型檢查通過
- [ ] UI 驗收（待瀏覽器測試）
- [ ] 性能測試（大數據量）

### 實際變更的文件
| 檔案 | 變更類型 | 說明 |
|------|----------|------|
| `apps/web/src/components/om-summary/OMSummaryDetailGrid.tsx` | 重構 | 新增類型定義、轉換函數、重構渲染邏輯 |

### 新增代碼摘要

#### 新類型定義 (Lines 137-180)
```typescript
interface HeaderOpCoGroup { ... }
interface CategoryHeaderGroup { ... }
interface HeaderCentricCategoryGroup { ... }
```

#### 數據轉換函數 (Lines 327-475)
```typescript
function transformToHeaderCentric(data: CategoryDetailGroup[]): HeaderCentricCategoryGroup[]
```

#### 層級樣式 (Lines 545-550)
```typescript
const levelStyles = {
  category: 'bg-blue-100 dark:bg-blue-900/30 ...',
  header: 'bg-yellow-100 dark:bg-yellow-900/30 ...',
  opCo: 'bg-orange-100 dark:bg-orange-900/30 ...',
  item: 'bg-pink-50 dark:bg-pink-900/20',
};
```

#### 新組件 (Lines 866-956)
```typescript
function ItemTableNew({ items, subTotal, levelStyle, ... }) { ... }
```

---

## 5. 測試計畫

### 5.1 功能測試
- [ ] 層級結構正確顯示
- [ ] 各層級可展開/收合
- [ ] 數據正確分組
- [ ] Budget 金額計算正確

### 5.2 UI 測試
- [ ] 各層級背景色正確
- [ ] 縮排層級清晰
- [ ] Dark mode 樣式正確

### 5.3 邊界情況
- [ ] 空數據顯示
- [ ] 單一 Category/Header/OpCo 的情況
- [ ] 大量數據 (100+ Headers) 性能

---

## 6. 確認事項

**確認結果：**

1. ✅ 新層級結構: Category → Header → OpCo → Item - **已實現**
2. ✅ 背景色: 藍 → 黃 → 橙 → 粉 - **已實現**
3. ✅ Header 行顯示 Budget 總額 - **已實現**
4. ✅ 各層級展開/收合功能 - **已實現** (使用 Radix UI Accordion)
5. ✅ 各層級項目數量顯示 - **已實現** (顯示 "X items")
6. ✅ 搜索過濾功能整合 - **已整合** (來自 CHANGE-030)

---

## 7. 相關文件
- 設計圖: `it-budget-project-management-portal-OMExpense-summary-screen-6.png`
- `apps/web/src/components/om-summary/OMSummaryDetailGrid.tsx` - 現有組件
- `packages/api/src/routers/omExpense.ts` - OM Expense API (`getDetail`)
- `CHANGE-004-om-summary-header-detail-display.md` - 相關變更記錄
