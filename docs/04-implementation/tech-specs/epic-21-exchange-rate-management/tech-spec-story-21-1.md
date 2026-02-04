# Tech Spec: Story 21.1 - 資料庫模型與遷移

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-21-1

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 21.1 |
| **Epic** | Epic 21 - Exchange Rate Management |
| **Estimated Effort** | 2 Story Points |
| **Dependencies** | 無 |
| **Blocking** | Story 21-2, 21-3 |

---

## Objective

建立 ExchangeRate 資料庫模型，包含枚舉定義、自關聯設計、索引和唯一約束。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-21.1.1 | ExchangeRate 模型 | Prisma Schema |
| AC-21.1.2 | ExchangeRateSource 枚舉 | Prisma Enum |
| AC-21.1.3 | 自關聯設計 | inverseOf/inverseRates |
| AC-21.1.4 | 唯一約束 | @@unique |
| AC-21.1.5 | 索引建立 | @@index |

---

## Implementation Guide

### Phase 1: Prisma Schema (1 point)

```prisma
// prisma/schema.prisma

enum ExchangeRateSource {
  MANUAL          // 手動輸入
  IMPORTED        // 批次匯入
  AUTO_INVERSE    // 自動產生的反向記錄
}

model ExchangeRate {
  id              String              @id @default(cuid())
  fromCurrency    String              @db.VarChar(3)  // ISO 4217
  toCurrency      String              @db.VarChar(3)  // ISO 4217
  rate            Decimal             @db.Decimal(18, 8)  // 高精度
  effectiveYear   Int                 @map("effective_year")
  effectiveFrom   DateTime?           @map("effective_from")
  effectiveTo     DateTime?           @map("effective_to")
  isActive        Boolean             @default(true) @map("is_active")
  source          ExchangeRateSource  @default(MANUAL)
  inverseOfId     String?             @map("inverse_of_id")
  description     String?
  createdById     String?             @map("created_by_id")
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  // 自關聯：追蹤反向匯率
  inverseOf       ExchangeRate?       @relation("InverseRate", fields: [inverseOfId], references: [id], onDelete: SetNull)
  inverseRates    ExchangeRate[]      @relation("InverseRate")

  @@unique([fromCurrency, toCurrency, effectiveYear])
  @@index([fromCurrency, toCurrency])
  @@index([effectiveYear])
  @@index([isActive])
  @@index([source])
  @@map("exchange_rates")
}
```

### Phase 2: 類型定義 (1 point)

```typescript
// src/types/exchange-rate.ts

import type { ExchangeRate as PrismaExchangeRate, ExchangeRateSource } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

export type { ExchangeRateSource };

export interface ExchangeRate extends Omit<PrismaExchangeRate, 'rate'> {
  rate: Decimal | number | string;
}

// 常用貨幣列表（ISO 4217）
export const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
] as const;

export type CurrencyCode = typeof COMMON_CURRENCIES[number]['code'];

// API 響應類型
export interface ExchangeRateWithRelations extends ExchangeRate {
  hasInverse: boolean;
  inverseRate?: {
    id: string;
    rate: number;
  };
}

// 轉換結果類型
export interface ConvertResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  path: 'direct' | 'inverse' | string;  // cross:XXX→USD→YYY
  rateId?: string;
  rateIds?: string[];
  effectiveYear: number;
}

// 批次查詢結果
export interface BatchRateResult {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  path: string;
  found: boolean;
  rateId?: string;
}
```

---

## File Structure

```
prisma/
└── schema.prisma                    # 更新：新增 ExchangeRate

src/types/
└── exchange-rate.ts                 # 新增
```

---

## Testing Checklist

- [ ] ExchangeRate 表正確建立
- [ ] ExchangeRateSource 枚舉正確定義
- [ ] 自關聯 inverseOf/inverseRates 正常運作
- [ ] 唯一約束 (fromCurrency, toCurrency, effectiveYear) 生效
- [ ] 所有索引正確建立
- [ ] Decimal(18, 8) 精度正確
