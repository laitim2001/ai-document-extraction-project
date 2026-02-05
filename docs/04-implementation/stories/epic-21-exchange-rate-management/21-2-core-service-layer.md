# Story 21.2: 核心服務層

**Status:** done

---

## Story

**As a** 系統開發者,
**I want** 建立 ExchangeRate 的核心服務層，包含轉換邏輯,
**So that** API 層可以調用統一的業務邏輯處理匯率操作。

---

## 背景說明

### 問題陳述

需要一個核心服務層處理：
- 基本 CRUD 操作
- 匯率轉換計算（含 Fallback 邏輯）
- 自動反向匯率建立
- 批次匯率查詢

### Convert Fallback 邏輯

```
1. 直接查詢：HKD → USD（找到則返回）
2. 反向計算：USD → HKD 存在，計算 1/rate
3. 交叉匯率：HKD → USD → EUR（通過 USD 中轉）
4. 找不到：返回錯誤
```

---

## Acceptance Criteria

### AC1: CRUD 操作

**Given** exchange-rate.service.ts
**When** 調用 list/getById/create/update/delete
**Then** 正確執行資料庫操作並返回結果

### AC2: 自動反向匯率

**Given** 建立匯率時 createInverse = true
**When** 調用 create 方法
**Then**:
  - 建立原始記錄（source = MANUAL）
  - 建立反向記錄（source = AUTO_INVERSE, inverseOfId = 原始 ID）
  - 反向匯率 = 1 / 原始匯率

### AC3: 轉換計算

**Given** convert(fromCurrency, toCurrency, amount, year)
**When** 執行轉換
**Then** 按 Fallback 邏輯返回結果：
  - 直接匹配 → 使用該匯率
  - 反向計算 → 使用 1/rate
  - 交叉匯率 → 使用 USD 中轉
  - 找不到 → 拋出錯誤

### AC4: 批次查詢

**Given** batchGetRates(pairs, year)
**When** 查詢多個貨幣對
**Then** 返回每個貨幣對的匯率結果（含轉換路徑說明）

### AC5: 刪除關聯處理

**Given** 刪除一筆匯率記錄
**When** 該記錄有自動產生的反向記錄
**Then** 同時刪除反向記錄

### AC6: Zod 驗證 Schema

**Given** exchange-rate.schema.ts
**When** 驗證 API 輸入
**Then** 正確驗證貨幣代碼、匯率值、年份等欄位

---

## Tasks / Subtasks

- [x] **Task 1: Zod 驗證** (AC: #6)
  - [x] 1.1 新增 `src/lib/validations/exchange-rate.schema.ts`
  - [x] 1.2 定義 createExchangeRateSchema
  - [x] 1.3 定義 updateExchangeRateSchema
  - [x] 1.4 定義 convertSchema
  - [x] 1.5 定義 batchGetRatesSchema
  - [x] 1.6 定義 getExchangeRatesQuerySchema

- [x] **Task 2: 服務層 - CRUD** (AC: #1)
  - [x] 2.1 新增 `src/services/exchange-rate.service.ts`
  - [x] 2.2 實現 list（含篩選、分頁、排序、批次反向檢查）
  - [x] 2.3 實現 getById（含反向匯率資訊）
  - [x] 2.4 實現 create（含自動反向邏輯、唯一約束檢查）
  - [x] 2.5 實現 update（只更新提供的欄位）
  - [x] 2.6 實現 delete（含關聯刪除、transaction）
  - [x] 2.7 實現 toggle

- [x] **Task 3: 服務層 - 轉換邏輯** (AC: #2, #3, #4)
  - [x] 3.1 實現 createWithInverse（整合至 create 方法）
  - [x] 3.2 實現 convert（含 Fallback: direct → inverse → cross(USD)）
  - [x] 3.3 實現 batchGetRates（並行查詢、錯誤容錯）
  - [x] 3.4 實現 findDirectRate（內部 helper）
  - [x] 3.5 實現 findRate（含反向計算）

- [x] **Task 4: 刪除邏輯** (AC: #5)
  - [x] 4.1 實現 deleteWithInverse（整合至 delete 方法，使用 transaction）

- [ ] **Task 5: 單元測試**（後續 Story 實作）
  - [ ] 5.1 CRUD 操作測試
  - [ ] 5.2 反向匯率建立測試
  - [ ] 5.3 Convert Fallback 邏輯測試
  - [ ] 5.4 批次查詢測試

---

## Dev Notes

### 依賴項

- **Story 21-1**: ExchangeRate 模型

### 新增文件

```
src/
├── lib/validations/
│   └── exchange-rate.schema.ts      # 新增
└── services/
    └── exchange-rate.service.ts     # 新增
```

### Zod Schema 設計

```typescript
// src/lib/validations/exchange-rate.schema.ts

import { z } from 'zod';

const currencyCodeSchema = z.string().length(3).toUpperCase();

export const createExchangeRateSchema = z.object({
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  rate: z.number().positive().or(z.string().transform(Number)),
  effectiveYear: z.number().int().min(2000).max(2100),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  createInverse: z.boolean().default(false),  // 是否自動建立反向
}).refine(
  (data) => data.fromCurrency !== data.toCurrency,
  { message: '來源和目標貨幣不能相同', path: ['toCurrency'] }
);

export const updateExchangeRateSchema = z.object({
  rate: z.number().positive().optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const convertSchema = z.object({
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  amount: z.number().positive(),
  year: z.number().int().optional(),  // 預設為當前年份
});

export const batchGetRatesSchema = z.object({
  pairs: z.array(z.object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
  })).min(1).max(50),
  year: z.number().int().optional(),
});
```

### 服務層設計

```typescript
// src/services/exchange-rate.service.ts

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// CRUD Operations
// ============================================================================

export async function list(query: GetExchangeRatesQuery) {
  // 支援篩選：year, fromCurrency, toCurrency, isActive, source
  // 支援分頁和排序
}

export async function getById(id: string) {
  // 返回單一記錄，含反向記錄資訊
}

export async function create(
  input: CreateExchangeRateInput,
  createdById: string
) {
  // 如果 createInverse = true，使用 transaction 同時建立兩筆
}

// ============================================================================
// Convert Logic
// ============================================================================

export async function convert(
  fromCurrency: string,
  toCurrency: string,
  amount: number,
  year?: number
): Promise<ConvertResult> {
  const effectiveYear = year || new Date().getFullYear();

  // 1. 直接查詢
  const direct = await findDirectRate(fromCurrency, toCurrency, effectiveYear);
  if (direct) {
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: amount * direct.rate.toNumber(),
      rate: direct.rate.toNumber(),
      path: 'direct',
      rateId: direct.id,
    };
  }

  // 2. 反向計算
  const inverse = await findDirectRate(toCurrency, fromCurrency, effectiveYear);
  if (inverse) {
    const rate = 1 / inverse.rate.toNumber();
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: amount * rate,
      rate,
      path: 'inverse',
      rateId: inverse.id,
    };
  }

  // 3. 交叉匯率（通過 USD）
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const toUsd = await findRate(fromCurrency, 'USD', effectiveYear);
    const fromUsd = await findRate('USD', toCurrency, effectiveYear);

    if (toUsd && fromUsd) {
      const rate = toUsd.rate * fromUsd.rate;
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: amount * rate,
        rate,
        path: `cross:${fromCurrency}→USD→${toCurrency}`,
        rateIds: [toUsd.id, fromUsd.id],
      };
    }
  }

  // 4. 找不到
  throw new Error(`找不到 ${fromCurrency} → ${toCurrency} 的匯率記錄`);
}

// 內部方法：查找匯率（含反向）
async function findRate(
  from: string,
  to: string,
  year: number
): Promise<{ rate: number; id: string } | null> {
  const direct = await findDirectRate(from, to, year);
  if (direct) return { rate: direct.rate.toNumber(), id: direct.id };

  const inverse = await findDirectRate(to, from, year);
  if (inverse) return { rate: 1 / inverse.rate.toNumber(), id: inverse.id };

  return null;
}
```

### ConvertResult 類型

```typescript
interface ConvertResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  path: 'direct' | 'inverse' | string;  // cross:XXX→USD→YYY
  rateId?: string;
  rateIds?: string[];
}
```

---

## Implementation Notes

### 完成日期: 2026-02-05

### 新增文件

| 文件 | 說明 |
|------|------|
| `src/lib/validations/exchange-rate.schema.ts` | Zod 驗證 Schema（6 個 schema + 5 個 inferred types） |
| `src/services/exchange-rate.service.ts` | 核心服務層（8 個 public 方法 + 2 個 internal helpers） |

### 設計決策

1. **列表反向檢查優化**: 使用 `groupBy` 批次查詢取代 N+1 個別查詢
2. **Create 唯一約束**: 在建立前先檢查 `fromCurrency_toCurrency_effectiveYear` 唯一約束，提供清楚的錯誤訊息
3. **Delete with Transaction**: 使用 `$transaction` 確保刪除反向記錄和主記錄的一致性
4. **Convert Fallback**: direct → inverse → cross(USD) → throw Error，每層失敗自動往下
5. **BatchGetRates 容錯**: 使用 try/catch 確保單一貨幣對失敗不影響其他結果
6. **rate 類型處理**: Prisma Decimal 在 service 層一律轉為 number，避免前端需額外處理

---

## Related Files

- `src/lib/validations/exchange-rate.schema.ts` - 新增
- `src/services/exchange-rate.service.ts` - 新增
