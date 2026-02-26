# Story 21.5: Import/Export API

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 批次導入和導出匯率記錄,
**So that** 可以快速建立或備份大量匯率資料。

---

## 背景說明

### 問題陳述

手動建立大量匯率記錄效率低下，需要支援：
- JSON 格式的批次導入
- 匯率資料導出備份
- 導入時的錯誤處理和報告

---

## Acceptance Criteria

### AC1: Export API

**Given** GET /api/v1/exchange-rates/export
**When** 導出匯率資料
**Then**:
  - 支援篩選條件（year, isActive）
  - 返回 JSON 格式的完整資料
  - 包含 exportVersion 和時間戳

### AC2: Import API

**Given** POST /api/v1/exchange-rates/import
**When** 導入匯率資料
**Then**:
  - 驗證每筆記錄格式
  - 支援 overwriteExisting 選項
  - 支援 skipInvalid 選項
  - 返回導入結果統計

### AC3: Import 錯誤處理

**Given** 導入資料包含錯誤
**When** skipInvalid = true
**Then** 跳過錯誤記錄，繼續導入其他記錄，並在結果中報告錯誤

### AC4: Import 反向匯率

**Given** 導入資料
**When** 記錄包含 createInverse = true
**Then** 同時建立反向匯率記錄

---

## Tasks / Subtasks

- [x] **Task 1: Export API** (AC: #1)
  - [x] 1.1 新增 `/api/v1/exchange-rates/export/route.ts`
  - [x] 1.2 實現 GET 端點
  - [x] 1.3 支援篩選參數

- [x] **Task 2: Import API** (AC: #2, #3, #4)
  - [x] 2.1 新增 `/api/v1/exchange-rates/import/route.ts`
  - [x] 2.2 實現 POST 端點
  - [x] 2.3 實現驗證和錯誤處理
  - [x] 2.4 實現 overwrite 邏輯
  - [x] 2.5 處理反向匯率建立

- [x] **Task 3: Zod Schema 擴展**
  - [x] 3.1 新增 importExchangeRatesSchema
  - [x] 3.2 新增 exportExchangeRatesQuerySchema

- [ ] **Task 4: React Query Hooks** (延後至 Story 21-8)
  - [ ] 4.1 新增 useExportExchangeRates
  - [ ] 4.2 新增 useImportExchangeRates

---

## Dev Notes

### 依賴項

- **Story 21-3**: CRUD API 端點

### 新增文件

```
src/app/api/v1/exchange-rates/
├── export/route.ts                  # 新增
└── import/route.ts                  # 新增
```

### Export 響應格式

```json
{
  "exportVersion": "1.0",
  "exportedAt": "2026-02-04T10:00:00.000Z",
  "totalCount": 25,
  "items": [
    {
      "fromCurrency": "HKD",
      "toCurrency": "USD",
      "rate": "0.12800000",
      "effectiveYear": 2026,
      "effectiveFrom": null,
      "effectiveTo": null,
      "source": "MANUAL",
      "isActive": true,
      "description": "2026 年度匯率"
    }
  ]
}
```

### Import 請求格式

```json
{
  "exportVersion": "1.0",
  "items": [
    {
      "fromCurrency": "HKD",
      "toCurrency": "USD",
      "rate": 0.128,
      "effectiveYear": 2026,
      "description": "2026 年度匯率",
      "createInverse": true
    }
  ],
  "options": {
    "overwriteExisting": false,
    "skipInvalid": true
  }
}
```

### Import 響應格式

```json
{
  "success": true,
  "data": {
    "imported": 10,
    "updated": 2,
    "skipped": 1,
    "errors": [
      {
        "index": 5,
        "error": "來源和目標貨幣不能相同"
      }
    ]
  }
}
```

### Zod Schema

```typescript
export const importExchangeRatesSchema = z.object({
  exportVersion: z.string().optional(),
  items: z.array(z.object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    rate: z.number().positive().or(z.string().transform(Number)),
    effectiveYear: z.number().int().min(2000).max(2100),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().default(true),
    createInverse: z.boolean().default(false),
  })).min(1).max(500),
  options: z.object({
    overwriteExisting: z.boolean().default(false),
    skipInvalid: z.boolean().default(false),
  }).default({}),
});

export const exportExchangeRatesQuerySchema = z.object({
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  isActive: z.string().transform(v => v === 'true').optional(),
});
```

---

## Implementation Notes

**Completed: 2026-02-06**

### 實作內容

#### 1. Schema 擴展 (`src/lib/validations/exchange-rate.schema.ts`)
- `exportExchangeRatesQuerySchema`: 導出查詢參數驗證 (year, isActive)
- `importExchangeRatesSchema`: 導入資料驗證 (items 1-500, options)
- `importExchangeRateItemSchema`: 單一導入項目驗證

#### 2. 服務層擴展 (`src/services/exchange-rate.service.ts`)
- `exportExchangeRates()`: 導出匯率為 JSON 格式，含 exportVersion 和時間戳
- `importExchangeRates()`: 批次導入匯率，支援：
  - `overwriteExisting`: 覆寫已存在記錄
  - `skipInvalid`: 跳過錯誤記錄繼續處理
  - `createInverse`: 每筆記錄同時建立反向匯率

#### 3. API 端點
- `GET /api/v1/exchange-rates/export`: 導出匯率資料
- `POST /api/v1/exchange-rates/import`: 批次導入匯率

### 技術細節
- 導入時使用 Prisma transaction 確保 createInverse 的原子性
- 反向記錄會自動檢查是否已存在，避免重複建立
- skipInvalid=false 時，任何錯誤會使整批導入失敗（回報詳細錯誤位置）
- 支援 rate 欄位輸入 number 或 string（自動轉換）

---

## Related Files

- `src/app/api/v1/exchange-rates/export/route.ts` - 新增
- `src/app/api/v1/exchange-rates/import/route.ts` - 新增
- `src/lib/validations/exchange-rate.schema.ts` - 更新
