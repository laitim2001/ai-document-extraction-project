# CHANGE-034: Projects 頁面預設值與過濾器優化

## 概述
優化專案頁面的預設顯示方式、排序方式，以及重新組織過濾條件的顯示邏輯。

## 變更類型
- **類型**: UI/UX 優化 (CHANGE)
- **優先級**: 中
- **影響範圍**: 僅前端

## 需求描述

### 1. 預設顯示模式
- **現狀**: 預設為卡片視圖 (`'card'`)
- **需求**: 預設為列表視圖 (`'list'`)

### 2. 預設排序方式
- **現狀**: 預設按 `createdAt` 排序
- **需求**: 預設按 `projectCode` 排序

### 3. 過濾條件重組
- **現狀**: 所有過濾條件平鋪顯示，SlidersHorizontal 按鈕無功能
- **需求**:
  - **主要過濾條件** (固定顯示，按順序):
    1. Financial Year (financialYear)
    2. Project Name (搜尋框)
    3. Project Code (新增)
    4. Project Category (新增)
    5. Budget Pool (budgetPoolId)
  - **進階過濾條件** (點擊 SlidersHorizontal 按鈕後顯示):
    - Status
    - Global/Local Flag
    - Priority
    - Currency
    - Sort By

## 受影響的檔案
| 檔案路徑 | 變更說明 |
|----------|----------|
| `apps/web/src/app/[locale]/projects/page.tsx` | 主要變更檔案 |

## 技術方案

### 1. 修改預設值

```tsx
// 現有代碼 (Line 139)
const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

// 改為
const [viewMode, setViewMode] = useState<'card' | 'list'>('list');

// 現有代碼 (Line 129)
const [sortBy, setSortBy] = useState<...>('createdAt');

// 改為
const [sortBy, setSortBy] = useState<...>('projectCode');
```

### 2. 新增過濾條件狀態

```tsx
// 新增狀態
const [projectCodeFilter, setProjectCodeFilter] = useState('');
const [projectCategoryFilter, setProjectCategoryFilter] = useState('');
const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
```

### 3. SlidersHorizontal 按鈕功能

```tsx
// 現有代碼 (Line 654-656)
<Button variant="outline" size="icon">
  <SlidersHorizontal className="h-4 w-4" />
</Button>

// 改為
<Button
  variant="outline"
  size="icon"
  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
>
  <SlidersHorizontal className="h-4 w-4" />
</Button>
```

### 4. 過濾區域重構

```tsx
{/* 主要過濾條件 - 固定顯示 */}
<div className="flex flex-wrap gap-4">
  {/* 1. Financial Year */}
  <Select value={financialYearFilter} onValueChange={setFinancialYearFilter}>
    ...
  </Select>

  {/* 2. Project Name (搜尋框) */}
  <Input
    placeholder={t('searchPlaceholder')}
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />

  {/* 3. Project Code (新增) */}
  <Input
    placeholder={t('filters.projectCode')}
    value={projectCodeFilter}
    onChange={(e) => setProjectCodeFilter(e.target.value)}
  />

  {/* 4. Project Category (新增) */}
  <Select value={projectCategoryFilter} onValueChange={setProjectCategoryFilter}>
    ...
  </Select>

  {/* 5. Budget Pool */}
  <Select value={budgetPoolFilter} onValueChange={setBudgetPoolFilter}>
    ...
  </Select>

  {/* 進階過濾按鈕 */}
  <Button variant="outline" size="icon" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
    <SlidersHorizontal className="h-4 w-4" />
  </Button>
</div>

{/* 進階過濾條件 - 條件顯示 */}
{showAdvancedFilters && (
  <div className="flex flex-wrap gap-4 mt-4 p-4 bg-muted/50 rounded-lg">
    {/* Status, Global Flag, Priority, Currency, Sort By */}
  </div>
)}
```

## 需要新增的元素

### 1. Project Category 選項
需要確認資料來源：
- 是否有現有的 ProjectCategory 模型/欄位？
- 或需要從現有專案中提取 unique categories？

### 2. I18N 翻譯鍵
```json
{
  "projects": {
    "filters": {
      "projectCode": "Project Code",
      "projectCodePlaceholder": "Filter by project code...",
      "projectCategory": "Project Category",
      "allCategories": "All Categories",
      "advancedFilters": "Advanced Filters"
    }
  }
}
```

## 測試驗證
- [ ] 頁面預設顯示列表視圖
- [ ] 頁面預設按 Project Code 排序
- [ ] 主要過濾條件正確顯示（5 個過濾器 + 進階按鈕）
- [ ] 點擊 SlidersHorizontal 按鈕可展開/收起進階過濾條件
- [ ] 進階過濾條件正確顯示
- [ ] 所有過濾條件功能正常
- [ ] 過濾條件順序符合需求

## 已確認項目 ✅

### 1. Project Category 資料來源
**已確認**: 使用 Project 模型中的 `projectCategory` 欄位
- 位置: `packages/db/prisma/schema.prisma` Line 206
- 類型: `String?` (可選字串)
- 範例值: "Data Lines", "Hardware", "Software"

### 2. 進階過濾器展示方式
**已確認**: 使用下拉展開區域 (Collapsible Section)

## 預估工作量
- **開發時間**: 2-3 小時
- **測試時間**: 0.5 小時

## 相關文件
- 原始頁面: `apps/web/src/app/[locale]/projects/page.tsx`
- I18N: `apps/web/src/messages/en.json`, `apps/web/src/messages/zh-TW.json`

---

**建立日期**: 2025-12-18
**狀態**: 已確認，待實施
