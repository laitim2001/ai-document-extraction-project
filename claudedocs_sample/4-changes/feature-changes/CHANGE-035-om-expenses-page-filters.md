# CHANGE-035: OM Expenses 頁面過濾器優化

## 概述
優化 OM Expenses 頁面的過濾條件，確保包含所有必要的過濾選項。

## 變更類型
- **類型**: UI 優化 (CHANGE)
- **優先級**: 中
- **影響範圍**: 僅前端

## 需求描述

### 過濾條件需求
需要以下過濾條件（按順序）：
1. **Financial Year** - 會計年度 ✅ 已存在
2. **OM Expenses Name** - 名稱搜尋 ⚠️ 需新增
3. **Expense Category** - 費用類別 ✅ 已存在
4. **Operating Company** - 營運公司 ✅ 已存在

## 現狀分析

### 現有過濾器 (Line 259-322)
```tsx
// 現有過濾器結構:
1. Financial Year Select     ✅
2. Operating Company Select  ✅ (目前順序第2)
3. Expense Category Select   ✅ (目前順序第3)
```

### 缺少的過濾器
- **OM Expenses Name 搜尋框**: 目前頁面沒有名稱搜尋功能

## 受影響的檔案
| 檔案路徑 | 變更說明 |
|----------|----------|
| `apps/web/src/app/[locale]/om-expenses/page.tsx` | 新增名稱搜尋過濾器，調整順序 |

## 技術方案

### 1. 新增名稱搜尋狀態

```tsx
// 新增狀態 (已有 useDebounce hook)
const [nameSearch, setNameSearch] = useState('');
const debouncedNameSearch = useDebounce(nameSearch, 300);
```

### 2. 更新查詢參數

```tsx
// 修改 API 查詢
const { data, isLoading } = api.omExpense.getAll.useQuery({
  page,
  limit: 10,
  financialYear: financialYearFilter || undefined,
  operatingCompanyId: opCoFilter || undefined,
  expenseCategoryId: categoryFilter || undefined,
  search: debouncedNameSearch || undefined,  // 新增
});
```

### 3. 重構過濾器區域

```tsx
{/* 過濾條件 - 按順序 */}
<div className="flex flex-wrap gap-4">
  {/* 1. Financial Year */}
  <Select value={financialYearFilter} onValueChange={setFinancialYearFilter}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder={t('filters.financialYear')} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{t('filters.allYears')}</SelectItem>
      {financialYears.map((year) => (
        <SelectItem key={year} value={year.toString()}>
          FY{year}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* 2. OM Expenses Name (新增) */}
  <div className="relative">
    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      type="search"
      placeholder={t('filters.searchPlaceholder')}
      value={nameSearch}
      onChange={(e) => setNameSearch(e.target.value)}
      className="pl-8 w-[200px]"
    />
  </div>

  {/* 3. Expense Category */}
  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder={t('filters.category')} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
      {categories?.map((cat) => (
        <SelectItem key={cat.id} value={cat.id}>
          {cat.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* 4. Operating Company */}
  <Select value={opCoFilter} onValueChange={setOpCoFilter}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder={t('filters.operatingCompany')} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{t('filters.allCompanies')}</SelectItem>
      {operatingCompanies?.map((company) => (
        <SelectItem key={company.id} value={company.id}>
          {company.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

## 後端確認

### API 支援檢查
需確認 `api.omExpense.getAll` 是否支援 `search` 參數：
- 如果支援 → 直接使用
- 如果不支援 → 需要在 `packages/api/src/routers/omExpense.ts` 新增

## 需要新增的 I18N 翻譯鍵

```json
{
  "omExpenses": {
    "filters": {
      "searchPlaceholder": "Search by name...",
      "searchPlaceholderZH": "搜尋名稱..."
    }
  }
}
```

## 測試驗證
- [ ] Financial Year 過濾器正常運作
- [ ] OM Expenses Name 搜尋功能正常（含防抖）
- [ ] Expense Category 過濾器正常運作
- [ ] Operating Company 過濾器正常運作
- [ ] 過濾條件順序符合需求
- [ ] 多個過濾條件組合使用正常
- [ ] 清除過濾條件功能正常

## 預估工作量
- **開發時間**: 1-1.5 小時
- **測試時間**: 0.5 小時

## 依賴項目
- 確認後端 API 是否支援 name search 參數
- 如不支援需先更新後端

## 相關文件
- 原始頁面: `apps/web/src/app/[locale]/om-expenses/page.tsx`
- API Router: `packages/api/src/routers/omExpense.ts`
- I18N: `apps/web/src/messages/en.json`, `apps/web/src/messages/zh-TW.json`

---

**建立日期**: 2025-12-18
**狀態**: 已確認，待實施
