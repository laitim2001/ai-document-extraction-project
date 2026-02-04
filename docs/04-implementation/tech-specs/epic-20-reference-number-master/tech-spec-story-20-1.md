# Tech Spec: Story 20.1 - 資料庫模型與基礎設施

> **Version**: 1.0.0
> **Created**: 2026-02-04
> **Status**: Draft
> **Story Key**: STORY-20-1

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 20.1 |
| **Epic** | Epic 20 - Reference Number Master Setup |
| **Estimated Effort** | 4 Story Points |
| **Dependencies** | 無 |
| **Blocking** | Story 20-2, 20-3 |

---

## Objective

建立 Region 和 ReferenceNumber 的資料庫模型，作為參考號碼管理系統的基礎架構。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-20.1.1 | Region 模型 | Prisma Schema |
| AC-20.1.2 | ReferenceNumber 模型 | Prisma Schema |
| AC-20.1.3 | 枚舉類型 | Prisma Enum |
| AC-20.1.4 | 索引與約束 | Prisma @@unique, @@index |
| AC-20.1.5 | 預設地區種子資料 | Seed Script |

---

## Implementation Guide

### Phase 1: Prisma Schema (2 points)

#### 1.1 新增 Region 模型

```prisma
// prisma/schema.prisma

/**
 * 地區配置表
 * 用於分類管理 Reference Number
 *
 * @since Epic 20 - Story 20.1
 */
model Region {
  id              String              @id @default(cuid())

  // ================================
  // 基本資訊
  // ================================
  code            String              @unique  // 地區代碼，如 APAC
  name            String                       // 地區名稱
  description     String?                      // 說明

  // ================================
  // 狀態控制
  // ================================
  isDefault       Boolean             @default(false) @map("is_default")  // 是否為系統預設
  isActive        Boolean             @default(true) @map("is_active")
  sortOrder       Int                 @default(0) @map("sort_order")

  // ================================
  // 時間戳
  // ================================
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  // ================================
  // 關聯
  // ================================
  referenceNumbers ReferenceNumber[]

  // ================================
  // 索引
  // ================================
  @@index([isActive])
  @@index([sortOrder])
  @@map("regions")
}
```

#### 1.2 新增枚舉類型

```prisma
/**
 * 參考號碼類型
 * @since Epic 20 - Story 20.1
 */
enum ReferenceNumberType {
  SHIPMENT        // 運輸單號
  DELIVERY        // 交貨單號
  BOOKING         // 訂艙號
  CONTAINER       // 櫃號
  HAWB            // House Air Waybill
  MAWB            // Master Air Waybill
  BL              // Bill of Lading
  CUSTOMS         // 報關單號
  OTHER           // 其他
}

/**
 * 參考號碼狀態
 * @since Epic 20 - Story 20.1
 */
enum ReferenceNumberStatus {
  ACTIVE          // 有效
  EXPIRED         // 已過期
  CANCELLED       // 已取消
}
```

#### 1.3 新增 ReferenceNumber 模型

```prisma
/**
 * 參考號碼主檔
 * 用於管理 Shipment/Delivery Number 等參考號碼
 *
 * @since Epic 20 - Story 20.1
 */
model ReferenceNumber {
  id              String                  @id @default(cuid())

  // ================================
  // 識別資訊
  // ================================
  code            String                  @unique  // 唯一識別碼（導入導出用）
  number          String                           // 號碼值
  type            ReferenceNumberType     @default(SHIPMENT)
  status          ReferenceNumberStatus   @default(ACTIVE)

  // ================================
  // 分類資訊
  // ================================
  year            Int                              // 年份
  regionId        String                  @map("region_id")
  region          Region                  @relation(fields: [regionId], references: [id])

  // ================================
  // 描述資訊
  // ================================
  description     String?

  // ================================
  // 有效期
  // ================================
  validFrom       DateTime?               @map("valid_from")
  validUntil      DateTime?               @map("valid_until")

  // ================================
  // 使用追蹤
  // ================================
  matchCount      Int                     @default(0) @map("match_count")
  lastMatchedAt   DateTime?               @map("last_matched_at")

  // ================================
  // 狀態與審計
  // ================================
  isActive        Boolean                 @default(true) @map("is_active")
  createdById     String                  @map("created_by_id")
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  // ================================
  // 約束與索引
  // ================================
  @@unique([number, type, year, regionId], name: "unique_reference_number")
  @@index([year])
  @@index([type])
  @@index([status])
  @@index([regionId])
  @@index([isActive])
  @@index([number])  // 用於搜尋
  @@map("reference_numbers")
}
```

### Phase 2: 類型定義 (1 point)

#### 2.1 Region 類型

```typescript
// src/types/region.ts

/**
 * @fileoverview 地區類型定義
 * @module src/types/region
 * @since Epic 20 - Story 20.1
 */

export interface Region {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegionListItem {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateRegionInput {
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateRegionInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}
```

#### 2.2 ReferenceNumber 類型

```typescript
// src/types/reference-number.ts

/**
 * @fileoverview 參考號碼類型定義
 * @module src/types/reference-number
 * @since Epic 20 - Story 20.1
 */

export type ReferenceNumberType =
  | 'SHIPMENT'
  | 'DELIVERY'
  | 'BOOKING'
  | 'CONTAINER'
  | 'HAWB'
  | 'MAWB'
  | 'BL'
  | 'CUSTOMS'
  | 'OTHER';

export type ReferenceNumberStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ReferenceNumber {
  id: string;
  code: string;
  number: string;
  type: ReferenceNumberType;
  status: ReferenceNumberStatus;
  year: number;
  regionId: string;
  region: {
    id: string;
    code: string;
    name: string;
  };
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  matchCount: number;
  lastMatchedAt: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceNumberListItem {
  id: string;
  code: string;
  number: string;
  type: ReferenceNumberType;
  status: ReferenceNumberStatus;
  year: number;
  regionCode: string;
  regionName: string;
  matchCount: number;
  isActive: boolean;
  updatedAt: string;
}

// 類型標籤
export const REFERENCE_NUMBER_TYPE_LABELS: Record<ReferenceNumberType, string> = {
  SHIPMENT: '運輸單號',
  DELIVERY: '交貨單號',
  BOOKING: '訂艙號',
  CONTAINER: '櫃號',
  HAWB: '分提單',
  MAWB: '主提單',
  BL: '提單',
  CUSTOMS: '報關單',
  OTHER: '其他',
};

// 狀態標籤
export const REFERENCE_NUMBER_STATUS_LABELS: Record<ReferenceNumberStatus, string> = {
  ACTIVE: '有效',
  EXPIRED: '已過期',
  CANCELLED: '已取消',
};
```

### Phase 3: Seed Data (1 point)

```typescript
// prisma/seed/regions.ts

/**
 * @fileoverview 預設地區種子資料
 * @module prisma/seed/regions
 * @since Epic 20 - Story 20.1
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_REGIONS = [
  {
    code: 'GLOBAL',
    name: 'Global',
    description: '全球通用',
    isDefault: true,
    sortOrder: 0,
  },
  {
    code: 'APAC',
    name: 'Asia Pacific',
    description: '亞太地區',
    isDefault: true,
    sortOrder: 1,
  },
  {
    code: 'EMEA',
    name: 'Europe, Middle East, Africa',
    description: '歐洲、中東、非洲',
    isDefault: true,
    sortOrder: 2,
  },
  {
    code: 'AMER',
    name: 'Americas',
    description: '美洲',
    isDefault: true,
    sortOrder: 3,
  },
];

export async function seedRegions() {
  console.log('Seeding regions...');

  for (const region of DEFAULT_REGIONS) {
    await prisma.region.upsert({
      where: { code: region.code },
      update: {
        name: region.name,
        description: region.description,
        sortOrder: region.sortOrder,
      },
      create: region,
    });
  }

  console.log(`Seeded ${DEFAULT_REGIONS.length} regions`);
}
```

---

## File Structure

```
prisma/
├── schema.prisma                     # 更新：新增 Region, ReferenceNumber
└── seed/
    └── regions.ts                    # 新增

src/types/
├── region.ts                         # 新增
└── reference-number.ts               # 新增
```

---

## Testing Checklist

### 資料庫測試
- [ ] Prisma 遷移成功執行
- [ ] Region 表正確建立
- [ ] ReferenceNumber 表正確建立
- [ ] 唯一約束正確執行
- [ ] 索引正確建立

### Seed 測試
- [ ] 預設地區建立成功
- [ ] 重複執行 seed 不會報錯（upsert）

---

## Migration Notes

```bash
# 1. 創建遷移
npx prisma migrate dev --name add_region_and_reference_number

# 2. 生成 Prisma Client
npx prisma generate

# 3. 執行 Seed
npx prisma db seed
```
