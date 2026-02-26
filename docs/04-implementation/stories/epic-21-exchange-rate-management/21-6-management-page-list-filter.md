# Story 21.6: 管理頁面 - 列表與篩選

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 在管理介面中查看和篩選匯率記錄,
**So that** 可以快速找到需要管理的匯率資料。

---

## 背景說明

### 問題陳述

需要建立匯率管理的列表頁面，包含：
- 按年份分組顯示
- 多條件篩選
- 分頁和排序
- 快速操作（切換狀態、刪除）

---

## Acceptance Criteria

### AC1: 列表頁面

**Given** /admin/exchange-rates
**When** 進入頁面
**Then**:
  - 顯示匯率列表
  - 按年份分組或展平顯示
  - 顯示關鍵欄位（貨幣對、匯率、年份、狀態、來源）

### AC2: 篩選器

**Given** 列表頁面
**When** 使用篩選器
**Then** 支援以下篩選：
  - 年份選擇
  - 來源貨幣
  - 目標貨幣
  - 啟用狀態
  - 來源類型（MANUAL/IMPORTED/AUTO_INVERSE）

### AC3: 分頁和排序

**Given** 大量匯率記錄
**When** 瀏覽列表
**Then**:
  - 支援分頁
  - 支援按欄位排序

### AC4: 快速操作

**Given** 列表中的記錄
**When** 點擊操作按鈕
**Then** 可以：
  - 切換啟用狀態
  - 編輯記錄
  - 刪除記錄

### AC5: i18n 支援

**Given** 切換語言
**When** 查看列表頁
**Then** 所有標籤和訊息正確顯示翻譯

---

## Tasks / Subtasks

- [x] **Task 1: 列表頁面** (AC: #1)
  - [x] 1.1 新增 `/admin/exchange-rates/page.tsx`
  - [x] 1.2 建立 ExchangeRateList 組件
  - [x] 1.3 實現展平列表模式（含排序）

- [x] **Task 2: 篩選器** (AC: #2)
  - [x] 2.1 建立 ExchangeRateFilters 組件
  - [x] 2.2 建立 CurrencySelect 組件
  - [x] 2.3 實現篩選邏輯（URL 參數同步）

- [x] **Task 3: 分頁和排序** (AC: #3)
  - [x] 3.1 整合分頁組件
  - [x] 3.2 實現排序功能（可排序欄位：fromCurrency, toCurrency, rate, effectiveYear）

- [x] **Task 4: 快速操作** (AC: #4)
  - [x] 4.1 實現切換狀態功能（useToggleExchangeRate）
  - [x] 4.2 實現刪除確認對話框（AlertDialog）
  - [x] 4.3 連結編輯頁面

- [x] **Task 5: i18n** (AC: #5)
  - [x] 5.1 新增 `messages/en/exchangeRate.json`
  - [x] 5.2 新增 `messages/zh-TW/exchangeRate.json`
  - [x] 5.3 新增 `messages/zh-CN/exchangeRate.json`

---

## Dev Notes

### 依賴項

- **Story 21-3**: CRUD API 端點

### 新增文件

```
src/
├── app/[locale]/(dashboard)/admin/exchange-rates/
│   └── page.tsx                             # 新增
└── components/features/exchange-rate/
    ├── index.ts                             # 新增
    ├── ExchangeRateList.tsx                 # 新增
    ├── ExchangeRateFilters.tsx              # 新增
    └── CurrencySelect.tsx                   # 新增

messages/
├── en/exchangeRate.json                     # 新增
├── zh-TW/exchangeRate.json                  # 新增
└── zh-CN/exchangeRate.json                  # 新增
```

### i18n 翻譯文件

```json
// messages/en/exchangeRate.json
{
  "title": "Exchange Rates",
  "description": "Manage currency exchange rates",
  "list": {
    "fromCurrency": "From",
    "toCurrency": "To",
    "rate": "Rate",
    "effectiveYear": "Year",
    "source": "Source",
    "status": "Status",
    "actions": "Actions"
  },
  "filters": {
    "year": "Year",
    "fromCurrency": "From Currency",
    "toCurrency": "To Currency",
    "status": "Status",
    "source": "Source",
    "all": "All"
  },
  "source": {
    "MANUAL": "Manual",
    "IMPORTED": "Imported",
    "AUTO_INVERSE": "Auto Inverse"
  },
  "actions": {
    "add": "Add Exchange Rate",
    "edit": "Edit",
    "delete": "Delete",
    "toggle": "Toggle Status",
    "export": "Export",
    "import": "Import"
  },
  "messages": {
    "created": "Exchange rate created successfully",
    "updated": "Exchange rate updated successfully",
    "deleted": "Exchange rate deleted successfully",
    "toggled": "Status toggled successfully",
    "confirmDelete": "Are you sure you want to delete this exchange rate?"
  }
}
```

```json
// messages/zh-TW/exchangeRate.json
{
  "title": "匯率管理",
  "description": "管理貨幣匯率記錄",
  "list": {
    "fromCurrency": "來源貨幣",
    "toCurrency": "目標貨幣",
    "rate": "匯率",
    "effectiveYear": "年份",
    "source": "來源",
    "status": "狀態",
    "actions": "操作"
  },
  "filters": {
    "year": "年份",
    "fromCurrency": "來源貨幣",
    "toCurrency": "目標貨幣",
    "status": "狀態",
    "source": "來源",
    "all": "全部"
  },
  "source": {
    "MANUAL": "手動輸入",
    "IMPORTED": "批次匯入",
    "AUTO_INVERSE": "自動反向"
  },
  "actions": {
    "add": "新增匯率",
    "edit": "編輯",
    "delete": "刪除",
    "toggle": "切換狀態",
    "export": "導出",
    "import": "導入"
  },
  "messages": {
    "created": "匯率建立成功",
    "updated": "匯率更新成功",
    "deleted": "匯率刪除成功",
    "toggled": "狀態切換成功",
    "confirmDelete": "確定要刪除此匯率記錄嗎？"
  }
}
```

### CurrencySelect 組件設計

```typescript
interface CurrencySelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// 使用 ISO 4217 貨幣代碼列表
// 支援搜尋過濾
// 顯示貨幣代碼 + 名稱
```

---

## Implementation Notes

### 完成日期
2026-02-06

### 實作摘要

1. **頁面組件**: `src/app/[locale]/(dashboard)/admin/exchange-rates/page.tsx`
   - URL 參數同步（篩選、分頁、排序）
   - 整合 ExchangeRateList 和 ExchangeRateFilters

2. **列表組件**: `src/components/features/exchange-rate/ExchangeRateList.tsx`
   - Table 表格顯示（fromCurrency, toCurrency, rate, effectiveYear, source, status）
   - 可排序欄位（點擊標題切換升序/降序）
   - 分頁導航
   - DropdownMenu 快速操作（Edit, Toggle, Delete）
   - AlertDialog 刪除確認
   - Skeleton 載入狀態

3. **篩選組件**: `src/components/features/exchange-rate/ExchangeRateFilters.tsx`
   - 年份 Select
   - 來源貨幣 CurrencySelect
   - 目標貨幣 CurrencySelect
   - 狀態 Select（啟用/停用）
   - 來源類型 Select（MANUAL/IMPORTED/AUTO_INVERSE）
   - 清除篩選按鈕

4. **貨幣選擇組件**: `src/components/features/exchange-rate/CurrencySelect.tsx`
   - Combobox 實現（Command + Popover）
   - 支援搜尋過濾
   - 顯示貨幣代碼 + 名稱

5. **i18n**: `messages/{en,zh-TW,zh-CN}/exchangeRate.json`
   - 頁面標題/描述
   - 列表欄位標籤
   - 篩選器標籤
   - 來源類型翻譯
   - 操作按鈕文字
   - 訊息提示
   - 分頁資訊

### 設計決策

- **URL 參數同步**: 篩選條件同步到 URL，支援分享連結和瀏覽器歷史
- **ExchangeRateSourceType**: 使用嚴格類型（'MANUAL' | 'IMPORTED' | 'AUTO_INVERSE'）確保類型安全
- **刪除確認**: 使用 AlertDialog 而非 window.confirm，提供更好的 UX

### 技術細節

- 使用 `useExchangeRates`, `useDeleteExchangeRate`, `useToggleExchangeRate` React Query hooks
- 使用 `useSearchParams` 和 `usePathname` 進行 URL 狀態管理
- 使用 `useTranslations` (next-intl) 進行國際化

---

## Related Files

- `src/app/[locale]/(dashboard)/admin/exchange-rates/page.tsx` - 新增
- `src/components/features/exchange-rate/` - 新增目錄
- `messages/{locale}/exchangeRate.json` - 新增
