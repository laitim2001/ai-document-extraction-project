# CHANGE-030: OM Summary 頁面添加搜索功能

> **建立日期**: 2025-12-16
> **狀態**: 📋 待確認
> **優先級**: Medium
> **複雜度**: 中
> **預估工時**: 3-4 小時

---

## 1. 變更概述

### 1.1 當前行為
- OM Summary 頁面沒有搜索功能
- 用戶需要手動展開層級結構尋找特定項目

### 1.2 期望行為
- **O&M Summary Tab**: 可搜索 OM Expense Name (Header 或 Item 名稱)
- **Project Summary Tab**: 可搜索 Project Name

### 1.3 變更原因
- 提升用戶體驗：快速定位特定項目
- 數據量大時更易於查找

---

## 2. 技術設計

### 2.1 影響範圍

| 類型 | 檔案路徑 | 變更說明 |
|------|----------|----------|
| 頁面 | `apps/web/src/app/[locale]/om-summary/page.tsx` | 添加搜索輸入框和狀態 |
| 組件 | `apps/web/src/components/om-summary/OMSummaryTable.tsx` | 接收搜索詞並過濾顯示 |
| 組件 | `apps/web/src/components/om-summary/OMSummaryDetailGrid.tsx` | 接收搜索詞並過濾顯示 |
| API | `packages/api/src/routers/omExpense.ts` | (可選) 後端搜索過濾 |
| i18n | `apps/web/src/messages/*.json` | 添加搜索相關翻譯 |

### 2.2 UI 設計

```
┌─────────────────────────────────────────────────────────┐
│ O&M Summary | Project Summary                           │
├─────────────────────────────────────────────────────────┤
│ Financial Year: [FY2026 ▼]  Operating Companies: [All▼] │
│                                                         │
│ 🔍 Search: [_________________________] [Search]         │  ← 新增
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ (搜索結果會高亮或過濾顯示)                            │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2.3 實現方案

#### 方案 A: 前端過濾 (推薦)
```typescript
// 1. 添加搜索狀態
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

// 2. 過濾邏輯
const filteredData = useMemo(() => {
  if (!debouncedSearch) return originalData;

  return originalData.filter(item =>
    item.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    item.items?.some(subItem =>
      subItem.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
  );
}, [originalData, debouncedSearch]);
```

#### 方案 B: 後端搜索
- 在 API 添加 `search` 參數
- 適用於數據量非常大的情況

### 2.4 搜索範圍

| Tab | 搜索欄位 |
|-----|----------|
| O&M Summary | OM Expense Header Name, OM Expense Item Name |
| Project Summary | Project Name, Project Code |

### 2.5 建議方案
- **採用方案 A (前端過濾)**: 因為數據已經載入，前端過濾響應更快
- 使用 debounce 避免頻繁過濾影響性能

---

## 3. 測試計畫

### 3.1 功能測試
- [ ] 輸入搜索詞，結果正確過濾
- [ ] 清空搜索詞，顯示全部數據
- [ ] 搜索不區分大小寫
- [ ] 搜索包含子層級匹配

### 3.2 性能測試
- [ ] 大量數據 (500+ 項目) 時搜索響應時間 < 200ms
- [ ] Debounce 正常工作 (不會頻繁觸發)

### 3.3 UI 測試
- [ ] 搜索框樣式與現有設計一致
- [ ] 無搜索結果時顯示友好提示

---

## 4. 確認事項

**請確認以下事項：**

1. ✅ O&M Summary 搜索 OM Expense Name 是否正確？
2. ✅ Project Summary 搜索 Project Name 是否正確？
3. ❓ 搜索結果是否需要高亮匹配文字？
4. ❓ 是否需要「無結果」的提示訊息？
5. ❓ 搜索是否需要支援 Project Code？

---

## 5. i18n 翻譯需求

```json
{
  "omSummary": {
    "search": {
      "placeholder": "搜尋 OM Expense 名稱...",
      "projectPlaceholder": "搜尋專案名稱...",
      "noResults": "找不到符合的結果",
      "button": "搜尋"
    }
  }
}
```

---

## 6. 相關文件
- `apps/web/src/app/[locale]/om-summary/page.tsx` - OM Summary 頁面
- `apps/web/src/components/om-summary/` - OM Summary 相關組件
- `apps/web/src/hooks/useDebounce.ts` - Debounce Hook
