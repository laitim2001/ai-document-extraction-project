# Story 21.7: 管理頁面 - 表單

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 通過表單新增和編輯匯率記錄,
**So that** 可以方便地管理匯率資料。

---

## 背景說明

### 問題陳述

需要建立匯率新增/編輯表單，包含：
- 貨幣選擇器
- 匯率輸入（高精度）
- 年份選擇
- 可選的精確日期範圍
- 反向匯率自動建立選項

---

## Acceptance Criteria

### AC1: 新增頁面

**Given** /admin/exchange-rates/new
**When** 進入頁面
**Then** 顯示空白的匯率建立表單

### AC2: 編輯頁面

**Given** /admin/exchange-rates/[id]
**When** 進入頁面
**Then** 載入現有記錄資料到表單

### AC3: 貨幣選擇

**Given** 表單中的貨幣選擇器
**When** 選擇貨幣
**Then**:
  - 顯示貨幣代碼和名稱
  - 支援搜尋過濾
  - 驗證來源和目標不能相同

### AC4: 反向匯率選項

**Given** 新增匯率時
**When** 勾選「同時建立反向匯率」
**Then**:
  - 顯示計算的反向匯率預覽
  - 建立時同時建立反向記錄

### AC5: 表單驗證

**Given** 提交表單
**When** 資料不符合要求
**Then** 顯示對應的驗證錯誤訊息

### AC6: 成功處理

**Given** 提交表單成功
**When** 伺服器響應成功
**Then**:
  - 顯示成功訊息
  - 返回列表頁面

---

## Tasks / Subtasks

- [x] **Task 1: 新增頁面** (AC: #1)
  - [x] 1.1 新增 `/admin/exchange-rates/new/page.tsx`
  - [x] 1.2 整合 ExchangeRateForm 組件

- [x] **Task 2: 編輯頁面** (AC: #2)
  - [x] 2.1 新增 `/admin/exchange-rates/[id]/page.tsx`
  - [x] 2.2 載入現有資料
  - [x] 2.3 處理更新邏輯

- [x] **Task 3: ExchangeRateForm 組件** (AC: #3, #4, #5)
  - [x] 3.1 建立 ExchangeRateForm 組件
  - [x] 3.2 整合 CurrencySelect
  - [x] 3.3 實現反向匯率預覽
  - [x] 3.4 使用 React Hook Form + Zod 驗證

- [x] **Task 4: 成功處理** (AC: #6)
  - [x] 4.1 顯示成功 Toast
  - [x] 4.2 重新導向列表頁

---

## Dev Notes

### 依賴項

- **Story 21-6**: 管理頁面 - 列表與篩選（CurrencySelect 組件）

### 新增文件

```
src/
├── app/[locale]/(dashboard)/admin/exchange-rates/
│   ├── new/page.tsx                         # 新增
│   └── [id]/page.tsx                        # 新增
└── components/features/exchange-rate/
    └── ExchangeRateForm.tsx                 # 新增
```

### 表單欄位設計

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| fromCurrency | Select | ✅ | 來源貨幣 |
| toCurrency | Select | ✅ | 目標貨幣 |
| rate | Number | ✅ | 匯率（最多 8 位小數） |
| effectiveYear | Number | ✅ | 生效年份 |
| effectiveFrom | Date | | 精確生效日期 |
| effectiveTo | Date | | 精確結束日期 |
| description | Text | | 說明 |
| createInverse | Checkbox | | 同時建立反向匯率 |

### ExchangeRateForm 組件設計

```typescript
interface ExchangeRateFormProps {
  initialData?: ExchangeRate;
  onSuccess?: () => void;
}

export function ExchangeRateForm({ initialData, onSuccess }: ExchangeRateFormProps) {
  const isEditing = !!initialData;

  // React Hook Form + Zod
  const form = useForm({
    resolver: zodResolver(createExchangeRateSchema),
    defaultValues: initialData || {
      fromCurrency: '',
      toCurrency: '',
      rate: '',
      effectiveYear: new Date().getFullYear(),
      createInverse: false,
    },
  });

  // 計算反向匯率預覽
  const rate = form.watch('rate');
  const inverseRate = rate ? (1 / Number(rate)).toFixed(8) : '';

  return (
    <Form {...form}>
      {/* 表單欄位 */}

      {/* 反向匯率預覽 */}
      {form.watch('createInverse') && (
        <div className="p-4 bg-muted rounded-lg">
          <p>將同時建立反向匯率：{inverseRate}</p>
        </div>
      )}
    </Form>
  );
}
```

### i18n 擴展

```json
// 新增到 exchangeRate.json
{
  "form": {
    "fromCurrency": "來源貨幣",
    "toCurrency": "目標貨幣",
    "rate": "匯率",
    "effectiveYear": "生效年份",
    "effectiveFrom": "生效日期",
    "effectiveTo": "結束日期",
    "description": "說明",
    "createInverse": "同時建立反向匯率",
    "inversePreview": "反向匯率預覽",
    "submit": "儲存",
    "cancel": "取消"
  },
  "validation": {
    "sameCurrency": "來源和目標貨幣不能相同",
    "invalidRate": "請輸入有效的匯率",
    "requiredCurrency": "請選擇貨幣"
  }
}
```

---

## Implementation Notes

### 已完成功能

**完成日期**: 2026-02-06

#### 1. 新增頁面 (`/admin/exchange-rates/new`)
- Server Component 使用 `getTranslations` 獲取翻譯
- 返回連結導向列表頁
- 整合 `ExchangeRateForm` 組件

#### 2. 編輯頁面 (`/admin/exchange-rates/[id]`)
- Client Component 使用 `useExchangeRate` hook 載入資料
- `FormSkeleton` 載入骨架屏
- 錯誤狀態使用 `Alert` 組件顯示
- 編輯模式禁用貨幣對和年份欄位

#### 3. ExchangeRateForm 組件
- **貨幣選擇**: 整合 `CurrencySelect` 組件（Combobox with search）
- **匯率輸入**: `step="0.00000001"` 支援 8 位小數精度
- **年份選擇**: 下拉選單（當前年份 +1 到過去 9 年）
- **日期範圍**: 可選的 `effectiveFrom` 和 `effectiveTo`
- **反向匯率**: Checkbox + 即時計算預覽（`1 / rate`）
- **表單驗證**: Zod schema + React Hook Form，相同貨幣檢查
- **成功處理**: Toast 通知 + 自動導向列表頁

#### 4. i18n 翻譯
- 擴展 `exchangeRate.json`：
  - `form.title.create/edit`
  - `form.fromCurrency/toCurrency/rate/effectiveYear/effectiveFrom/effectiveTo/description/createInverse/inversePreview/submit/cancel`
  - `validation.sameCurrency/invalidRate/requiredCurrency/requiredRate/requiredYear/ratePositive`
- 支援 en, zh-TW, zh-CN 三種語言

### 技術細節

- 使用 `ExchangeRateDetail` 類型（來自 hooks）取代 `ExchangeRateWithRelations`
- 日期字段處理兼容 ISO 格式和 `YYYY-MM-DD` 格式
- 編輯模式下 `rate`、`effectiveFrom`、`effectiveTo`、`description` 可修改

---

## Related Files

- `src/app/[locale]/(dashboard)/admin/exchange-rates/new/page.tsx` - 新增
- `src/app/[locale]/(dashboard)/admin/exchange-rates/[id]/page.tsx` - 新增
- `src/components/features/exchange-rate/ExchangeRateForm.tsx` - 新增
- `messages/{locale}/exchangeRate.json` - 更新
