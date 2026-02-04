# Story 21.1: 資料庫模型與遷移

**Status:** pending

---

## Story

**As a** 系統開發者,
**I want** 建立 ExchangeRate 的資料庫模型和遷移,
**So that** 系統可以儲存和管理貨幣匯率記錄。

---

## 背景說明

### 問題陳述

系統需要管理不同貨幣對的匯率記錄，支援：
- 不同年份的匯率
- 雙向匯率追蹤（原始記錄 vs 自動產生的反向記錄）
- 高精度計算（18 位數，8 位小數）

### 設計決策

- **Decimal(18, 8)**：確保匯率計算精度
- **唯一約束**：(fromCurrency, toCurrency, effectiveYear)
- **inverseOfId**：追蹤自動產生的反向記錄來源
- **ExchangeRateSource**：區分手動輸入、批次匯入、自動反向

---

## Acceptance Criteria

### AC1: ExchangeRate 模型

**Given** Prisma Schema
**When** 執行遷移
**Then** 正確建立 ExchangeRate 表和所有欄位

### AC2: ExchangeRateSource 枚舉

**Given** Prisma Schema
**When** 查看枚舉定義
**Then** 包含 MANUAL, IMPORTED, AUTO_INVERSE 三個值

### AC3: 自關聯設計

**Given** ExchangeRate 模型
**When** 查看關聯
**Then** 正確建立 inverseOf 和 inverseRates 自關聯

### AC4: 唯一約束

**Given** ExchangeRate 模型
**When** 嘗試建立相同 fromCurrency + toCurrency + effectiveYear 的記錄
**Then** 資料庫拒絕並拋出唯一約束錯誤

### AC5: 索引建立

**Given** ExchangeRate 模型
**When** 查看索引
**Then** 包含以下索引：
  - (fromCurrency, toCurrency)
  - effectiveYear
  - isActive

---

## Tasks / Subtasks

- [ ] **Task 1: Prisma Schema** (AC: #1, #2, #3, #4, #5)
  - [ ] 1.1 新增 ExchangeRateSource 枚舉
  - [ ] 1.2 新增 ExchangeRate 模型
  - [ ] 1.3 定義 inverseOf/inverseRates 自關聯
  - [ ] 1.4 設定唯一約束和索引

- [ ] **Task 2: 資料庫遷移** (AC: #1)
  - [ ] 2.1 執行 `prisma migrate dev`
  - [ ] 2.2 驗證遷移成功
  - [ ] 2.3 執行 `prisma generate`

- [ ] **Task 3: 基礎類型定義** (AC: #1, #2)
  - [ ] 3.1 新增 `src/types/exchange-rate.ts`
  - [ ] 3.2 定義 ExchangeRate 相關類型
  - [ ] 3.3 定義 ISO 4217 貨幣代碼常數

---

## Dev Notes

### 依賴項

- 無前置依賴

### 新增文件

```
prisma/
└── schema.prisma                    # 更新：新增 ExchangeRate

src/
└── types/
    └── exchange-rate.ts             # 新增
```

### Prisma Schema 設計

```prisma
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
  effectiveYear   Int                 // 生效年份
  effectiveFrom   DateTime?           // 可選：精確生效日期
  effectiveTo     DateTime?           // 可選：精確結束日期
  isActive        Boolean             @default(true)
  source          ExchangeRateSource  @default(MANUAL)
  inverseOfId     String?             @map("inverse_of_id")
  description     String?
  createdById     String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  inverseOf       ExchangeRate?       @relation("InverseRate", fields: [inverseOfId], references: [id])
  inverseRates    ExchangeRate[]      @relation("InverseRate")

  @@unique([fromCurrency, toCurrency, effectiveYear])
  @@index([fromCurrency, toCurrency])
  @@index([effectiveYear])
  @@index([isActive])
  @@map("exchange_rates")
}
```

### 常用貨幣代碼（ISO 4217）

```typescript
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
] as const;
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `prisma/schema.prisma` - 更新
- `src/types/exchange-rate.ts` - 新增
