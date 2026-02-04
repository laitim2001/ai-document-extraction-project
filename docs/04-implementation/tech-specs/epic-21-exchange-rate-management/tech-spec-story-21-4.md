# Tech Spec: Story 21.4 - 轉換計算 API

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-21-4

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 21.4 |
| **Epic** | Epic 21 - Exchange Rate Management |
| **Estimated Effort** | 3 Story Points |
| **Dependencies** | Story 21-2 |
| **Blocking** | Story 21-8 |

---

## Objective

建立貨幣轉換計算 API，支援單一轉換和批次查詢，包含完整的 Fallback 邏輯。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-21.4.1 | 單一轉換 API | POST /api/v1/exchange-rates/convert |
| AC-21.4.2 | 批次查詢 API | POST /api/v1/exchange-rates/batch |
| AC-21.4.3 | Fallback 邏輯 | direct → inverse → cross |
| AC-21.4.4 | 年份參數 | 預設當前年份 |
| AC-21.4.5 | 精度處理 | Decimal 計算 |

---

## Implementation Guide

### Phase 1: Convert API (1.5 points)

```typescript
// src/app/api/v1/exchange-rates/convert/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { convert } from '@/services/exchange-rate.service';
import { convertSchema } from '@/lib/validations/exchange-rate.schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = convertSchema.parse(body);

    const result = await convert(
      validated.fromCurrency,
      validated.toCurrency,
      validated.amount,
      validated.year
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('找不到')) {
      return NextResponse.json({
        type: 'https://api.example.com/errors/rate-not-found',
        title: 'Exchange Rate Not Found',
        status: 404,
        detail: error.message,
      }, { status: 404 });
    }
    throw error;
  }
}
```

### Phase 2: Batch API (1 point)

```typescript
// src/app/api/v1/exchange-rates/batch/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { batchGetRates } from '@/services/exchange-rate.service';
import { batchGetRatesSchema } from '@/lib/validations/exchange-rate.schema';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = batchGetRatesSchema.parse(body);

  const results = await batchGetRates(validated.pairs, validated.year);

  return NextResponse.json({
    success: true,
    data: {
      rates: results,
      effectiveYear: validated.year || new Date().getFullYear(),
    },
  });
}
```

### Phase 3: React Query Hooks (0.5 points)

```typescript
// src/hooks/use-exchange-rates.ts (擴展)

export function useConvertCurrency() {
  return useMutation({
    mutationFn: async (data: {
      fromCurrency: string;
      toCurrency: string;
      amount: number;
      year?: number;
    }) => {
      const res = await fetch('/api/v1/exchange-rates/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to convert');
      }
      return res.json();
    },
  });
}

export function useBatchRates() {
  return useMutation({
    mutationFn: async (data: {
      pairs: Array<{ fromCurrency: string; toCurrency: string }>;
      year?: number;
    }) => {
      const res = await fetch('/api/v1/exchange-rates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to fetch rates');
      return res.json();
    },
  });
}
```

---

## API 響應格式

### Convert API

**請求：**
```json
{
  "fromCurrency": "HKD",
  "toCurrency": "USD",
  "amount": 1000,
  "year": 2026
}
```

**成功響應（直接匹配）：**
```json
{
  "success": true,
  "data": {
    "fromCurrency": "HKD",
    "toCurrency": "USD",
    "amount": 1000,
    "convertedAmount": 128.00,
    "rate": 0.128,
    "path": "direct",
    "rateId": "cuid...",
    "effectiveYear": 2026
  }
}
```

**成功響應（反向計算）：**
```json
{
  "success": true,
  "data": {
    "fromCurrency": "USD",
    "toCurrency": "HKD",
    "amount": 100,
    "convertedAmount": 781.25,
    "rate": 7.8125,
    "path": "inverse",
    "rateId": "cuid...",
    "effectiveYear": 2026
  }
}
```

**成功響應（交叉匯率）：**
```json
{
  "success": true,
  "data": {
    "fromCurrency": "HKD",
    "toCurrency": "EUR",
    "amount": 1000,
    "convertedAmount": 118.28,
    "rate": 0.11828,
    "path": "cross:HKD→USD→EUR",
    "rateIds": ["cuid1...", "cuid2..."],
    "effectiveYear": 2026
  }
}
```

**錯誤響應：**
```json
{
  "type": "https://api.example.com/errors/rate-not-found",
  "title": "Exchange Rate Not Found",
  "status": 404,
  "detail": "找不到 HKD → EUR 的匯率記錄（年份：2026）"
}
```

### Batch API

**請求：**
```json
{
  "pairs": [
    { "fromCurrency": "HKD", "toCurrency": "USD" },
    { "fromCurrency": "USD", "toCurrency": "EUR" },
    { "fromCurrency": "HKD", "toCurrency": "JPY" }
  ],
  "year": 2026
}
```

**響應：**
```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "fromCurrency": "HKD",
        "toCurrency": "USD",
        "rate": 0.128,
        "path": "direct",
        "found": true,
        "rateId": "cuid..."
      },
      {
        "fromCurrency": "USD",
        "toCurrency": "EUR",
        "rate": 0.924,
        "path": "direct",
        "found": true,
        "rateId": "cuid..."
      },
      {
        "fromCurrency": "HKD",
        "toCurrency": "JPY",
        "rate": 19.84,
        "path": "cross:HKD→USD→JPY",
        "found": true
      }
    ],
    "effectiveYear": 2026
  }
}
```

---

## File Structure

```
src/app/api/v1/exchange-rates/
├── convert/route.ts                 # 新增
└── batch/route.ts                   # 新增
```

---

## Testing Checklist

- [ ] Convert API 直接匹配正確
- [ ] Convert API 反向計算正確
- [ ] Convert API 交叉匯率正確
- [ ] Convert API 找不到時返回 404
- [ ] Convert API 未指定年份使用當前年份
- [ ] Batch API 批次查詢正確
- [ ] Batch API 部分找不到時標記 found: false
- [ ] 精度計算正確（小數位）
