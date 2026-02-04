# Story 20.1: 資料庫模型與基礎設施

**Status:** draft

---

## Story

**As a** 系統管理員,
**I want** 建立 Region 和 ReferenceNumber 的資料庫模型,
**So that** 系統可以管理不同地區的參考號碼記錄。

---

## 背景說明

### 問題陳述

SCM 部門需要一個集中管理 Shipment/Delivery Number 的功能，用於驗證文件中提取的號碼是否為有效記錄。本 Story 建立基礎資料庫結構。

### 設計決策

- **地區為主要分類維度**：不與 Company 關聯，使用 Region 表管理
- **可擴展地區列表**：預設地區（APAC, EMEA, AMER, GLOBAL）+ 管理員可新增
- **唯一約束**：同年份、同類型、同地區的號碼唯一

---

## Acceptance Criteria

### AC1: Region 模型

**Given** Prisma Schema
**When** 執行遷移
**Then** 正確建立 Region 表：
  - id, code (唯一), name, description
  - isDefault, isActive, sortOrder
  - createdAt, updatedAt

### AC2: ReferenceNumber 模型

**Given** Prisma Schema
**When** 執行遷移
**Then** 正確建立 ReferenceNumber 表：
  - id, code (唯一), number, type, status
  - year, regionId (必填), description
  - validFrom, validUntil
  - matchCount, lastMatchedAt
  - isActive, createdById, createdAt, updatedAt

### AC3: 枚舉類型

**Given** Prisma Schema
**When** 定義枚舉
**Then** 正確建立：
  - ReferenceNumberType: SHIPMENT, DELIVERY, BOOKING, CONTAINER, HAWB, MAWB, BL, CUSTOMS, OTHER
  - ReferenceNumberStatus: ACTIVE, EXPIRED, CANCELLED

### AC4: 索引與約束

**Given** ReferenceNumber 模型
**When** 執行查詢
**Then**:
  - `(number, type, year, regionId)` 組合唯一
  - 正確建立索引：year, type, regionId

### AC5: 預設地區種子資料

**Given** 資料庫初始化
**When** 執行 seed
**Then** 建立預設地區：APAC, EMEA, AMER, GLOBAL

---

## Tasks / Subtasks

- [ ] **Task 1: Prisma Schema** (AC: #1, #2, #3, #4)
  - [ ] 1.1 新增 Region 模型
  - [ ] 1.2 新增 ReferenceNumberType 枚舉
  - [ ] 1.3 新增 ReferenceNumberStatus 枚舉
  - [ ] 1.4 新增 ReferenceNumber 模型
  - [ ] 1.5 建立 Region → ReferenceNumber 關聯
  - [ ] 1.6 執行資料庫遷移

- [ ] **Task 2: 類型定義** (AC: #1, #2)
  - [ ] 2.1 新增 `src/types/region.ts`
  - [ ] 2.2 新增 `src/types/reference-number.ts`
  - [ ] 2.3 定義 API 請求/響應類型

- [ ] **Task 3: Seed Data** (AC: #5)
  - [ ] 3.1 新增 `prisma/seed/regions.ts`
  - [ ] 3.2 建立預設地區資料（APAC, EMEA, AMER, GLOBAL）
  - [ ] 3.3 整合到主 seed 文件

---

## Dev Notes

### 依賴項

- 無前置依賴

### 新增文件

```
prisma/
├── schema.prisma                     # 更新：新增 Region, ReferenceNumber
└── seed/
    └── regions.ts                    # 新增

src/types/
├── region.ts                         # 新增
└── reference-number.ts               # 新增
```

### Prisma Schema 設計

```prisma
// 地區配置表
model Region {
  id              String              @id @default(cuid())
  code            String              @unique
  name            String
  description     String?
  isDefault       Boolean             @default(false)
  isActive        Boolean             @default(true)
  sortOrder       Int                 @default(0)
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  referenceNumbers ReferenceNumber[]

  @@index([isActive])
  @@map("regions")
}

enum ReferenceNumberType {
  SHIPMENT
  DELIVERY
  BOOKING
  CONTAINER
  HAWB
  MAWB
  BL
  CUSTOMS
  OTHER
}

enum ReferenceNumberStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

model ReferenceNumber {
  id              String                  @id @default(cuid())
  code            String                  @unique
  number          String
  type            ReferenceNumberType     @default(SHIPMENT)
  status          ReferenceNumberStatus   @default(ACTIVE)
  year            Int
  regionId        String                  @map("region_id")
  region          Region                  @relation(fields: [regionId], references: [id])
  description     String?
  validFrom       DateTime?               @map("valid_from")
  validUntil      DateTime?               @map("valid_until")
  matchCount      Int                     @default(0) @map("match_count")
  lastMatchedAt   DateTime?               @map("last_matched_at")
  isActive        Boolean                 @default(true) @map("is_active")
  createdById     String                  @map("created_by_id")
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  @@unique([number, type, year, regionId])
  @@index([year])
  @@index([type])
  @@index([regionId])
  @@index([isActive])
  @@map("reference_numbers")
}
```

### 預設地區資料

```typescript
const defaultRegions = [
  { code: 'APAC', name: 'Asia Pacific', isDefault: true, sortOrder: 1 },
  { code: 'EMEA', name: 'Europe, Middle East, Africa', isDefault: true, sortOrder: 2 },
  { code: 'AMER', name: 'Americas', isDefault: true, sortOrder: 3 },
  { code: 'GLOBAL', name: 'Global', isDefault: true, sortOrder: 0 },
];
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `prisma/schema.prisma` - 更新
- `prisma/seed/regions.ts` - 新增
- `src/types/region.ts` - 新增
- `src/types/reference-number.ts` - 新增
