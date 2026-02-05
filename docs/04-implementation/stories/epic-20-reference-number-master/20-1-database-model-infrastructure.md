# Story 20.1: 資料庫模型與基礎設施

**Status:** done
**Completed:** 2026-02-04

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

### 完成日期
2026-02-04

### 實作摘要

1. **Region 模型擴充**
   - 新增 `description` 欄位（地區說明）
   - 新增 `isDefault` 欄位（系統預設標記）
   - 新增 `sortOrder` 欄位（排序順序）
   - 新增 `referenceNumbers` 關聯

2. **ReferenceNumber 模型**
   - 完整實作符合 Tech Spec 規格
   - 包含 code（唯一識別碼）、number（號碼值）、type、status
   - 年份和地區分類
   - 有效期追蹤（validFrom/validUntil）
   - 使用追蹤（matchCount/lastMatchedAt）
   - 複合唯一約束：`(number, type, year, regionId)`

3. **枚舉類型**
   - `ReferenceNumberType`: 9 種類型（SHIPMENT, DELIVERY, BOOKING, CONTAINER, HAWB, MAWB, BL, CUSTOMS, OTHER）
   - `ReferenceNumberStatus`: 3 種狀態（ACTIVE, EXPIRED, CANCELLED）

4. **類型定義**
   - `src/types/region.ts`: Region API 類型、常量、輔助函數
   - `src/types/reference-number.ts`: ReferenceNumber 類型、常量、輔助函數

5. **種子資料**
   - 更新 seed.ts 添加 GLOBAL 地區
   - 更新現有地區添加 description、isDefault、sortOrder

### 設計決策

- **保留現有 Region.status enum**：未使用 isActive boolean，因為現有系統已使用 RegionStatus enum
- **使用 cuid() 作為 ReferenceNumber ID**：與 Tech Spec 一致，便於分散式系統
- **複合索引設計**：針對常見查詢模式（year, type, status, regionId, number）建立索引

### 遷移已完成

**執行日期**: 2026-02-05

```bash
# 執行的命令
npx prisma db push --accept-data-loss  # 同步 schema 到資料庫
npx prisma db seed                      # 執行種子資料
npx prisma generate                     # 重新生成 Prisma Client
```

**驗證結果**:
- ✅ `reference_numbers` 表已建立，包含所有欄位
- ✅ `regions` 表已更新，包含 description, is_default, sort_order 欄位
- ✅ 4 個預設地區已建立：GLOBAL, APAC, EMEA, AMER
- ✅ Prisma Client 已重新生成

---

## Related Files

- `prisma/schema.prisma` - 更新
- `prisma/seed.ts` - 更新（加入 GLOBAL 地區、讀取導出資料功能）
- `prisma/seed/exported-data.json` - 新增（導出的資料備份）
- `src/types/region.ts` - 新增
- `src/types/reference-number.ts` - 新增
