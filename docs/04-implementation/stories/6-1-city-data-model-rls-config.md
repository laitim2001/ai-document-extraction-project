# Story 6.1: 城市數據模型與 RLS 配置

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 按城市隔離所有業務數據,
**So that** 確保數據安全和合規。

---

## Acceptance Criteria

### AC1: 城市數據模型

**Given** 系統初始化
**When** 創建數據表
**Then** 所有業務數據表包含 cityCode 欄位
**And** 創建 City 資料表（id, code, name, region, timezone, status）
**And** 配置適當的外鍵關聯

### AC2: RLS 策略配置

**Given** 數據庫配置
**When** 配置 PostgreSQL Row Level Security 策略
**Then** 所有業務數據表啟用 RLS
**And** 策略基於 session 變數過濾數據
**And** 查詢自動過濾非授權城市數據

### AC3: 自動過濾機制

**Given** 用戶執行查詢
**When** 數據庫處理請求
**Then** RLS 策略自動應用
**And** 無需應用層額外過濾
**And** 性能影響最小化

### AC4: 數據完整性

**Given** 創建新業務數據
**When** 插入記錄
**Then** 必須指定有效的 cityCode
**And** 外鍵約束確保城市存在
**And** 無效城市代碼時拒絕插入

---

## Tasks / Subtasks

- [ ] **Task 1: City 數據模型** (AC: #1)
  - [ ] 1.1 創建 City Prisma 模型
  - [ ] 1.2 定義城市狀態枚舉
  - [ ] 1.3 定義區域枚舉
  - [ ] 1.4 添加時區支援

- [ ] **Task 2: Region 數據模型** (AC: #1)
  - [ ] 2.1 創建 Region Prisma 模型
  - [ ] 2.2 定義區域與城市關聯
  - [ ] 2.3 支援階層式區域結構

- [ ] **Task 3: 業務表 cityCode 欄位** (AC: #1)
  - [ ] 3.1 為 Document 添加 cityCode
  - [ ] 3.2 為 ProcessingQueue 添加 cityCode
  - [ ] 3.3 為 ExtractionResult 添加 cityCode
  - [ ] 3.4 為 Correction 添加 cityCode
  - [ ] 3.5 為 AuditLog 添加 cityCode
  - [ ] 3.6 創建數據遷移腳本

- [ ] **Task 4: RLS 策略 SQL** (AC: #2)
  - [ ] 4.1 創建 RLS 啟用腳本
  - [ ] 4.2 為 documents 表創建策略
  - [ ] 4.3 為 processing_queue 表創建策略
  - [ ] 4.4 為 extraction_results 表創建策略
  - [ ] 4.5 為其他業務表創建策略

- [ ] **Task 5: Session 變數管理** (AC: #2)
  - [ ] 5.1 創建 `src/lib/db-context.ts`
  - [ ] 5.2 實現設置 session 變數函數
  - [ ] 5.3 在每次請求設置用戶城市
  - [ ] 5.4 支援多城市訪問列表

- [ ] **Task 6: Prisma 中間件** (AC: #3)
  - [ ] 6.1 創建 Prisma 擴展
  - [ ] 6.2 自動設置 RLS context
  - [ ] 6.3 處理連接池 session
  - [ ] 6.4 確保 transaction 安全

- [ ] **Task 7: 性能優化** (AC: #3)
  - [ ] 7.1 為 cityCode 創建索引
  - [ ] 7.2 分析查詢計劃
  - [ ] 7.3 優化 RLS 策略效率
  - [ ] 7.4 添加複合索引

- [ ] **Task 8: 數據完整性約束** (AC: #4)
  - [ ] 8.1 添加外鍵約束
  - [ ] 8.2 添加 CHECK 約束
  - [ ] 8.3 設置 NOT NULL 約束
  - [ ] 8.4 創建驗證觸發器

- [ ] **Task 9: 種子數據** (AC: #1)
  - [ ] 9.1 創建初始城市數據
  - [ ] 9.2 創建區域數據
  - [ ] 9.3 設置預設配置

- [ ] **Task 10: 驗證與測試** (AC: #1-4)
  - [ ] 10.1 測試 RLS 策略生效
  - [ ] 10.2 測試跨城市數據隔離
  - [ ] 10.3 測試性能影響
  - [ ] 10.4 測試數據完整性

---

## Dev Notes

### 依賴項

- **Story 1.0**: 專案初始化（Prisma 配置）
- **Story 1.2**: 用戶角色基礎

### Architecture Compliance

```prisma
// 區域模型
model Region {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  parentId    String?  @map("parent_id")
  timezone    String   @default("UTC")
  status      RegionStatus @default(ACTIVE)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  parent      Region?  @relation("RegionHierarchy", fields: [parentId], references: [id])
  children    Region[] @relation("RegionHierarchy")
  cities      City[]

  @@map("regions")
}

// 城市模型
model City {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  regionId    String   @map("region_id")
  timezone    String   @default("UTC")
  currency    String   @default("USD")
  status      CityStatus @default(ACTIVE)
  config      Json?    // 城市特定配置
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  region      Region   @relation(fields: [regionId], references: [id])
  documents   Document[]
  users       UserCityAccess[]
  auditLogs   AuditLog[]

  @@index([regionId])
  @@index([status])
  @@map("cities")
}

enum RegionStatus {
  ACTIVE
  INACTIVE
}

enum CityStatus {
  ACTIVE      // 啟用中
  INACTIVE    // 已停用
  PENDING     // 待啟用
}

// 用戶城市訪問權限
model UserCityAccess {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  cityId      String   @map("city_id")
  accessLevel AccessLevel @default(FULL)
  grantedBy   String   @map("granted_by")
  grantedAt   DateTime @default(now()) @map("granted_at")
  expiresAt   DateTime? @map("expires_at")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  city        City     @relation(fields: [cityId], references: [id])
  grantor     User     @relation("GrantedBy", fields: [grantedBy], references: [id])

  @@unique([userId, cityId])
  @@index([userId])
  @@index([cityId])
  @@map("user_city_access")
}

enum AccessLevel {
  READ_ONLY   // 僅讀取
  FULL        // 完整訪問
}

// 業務表示例：Document 添加 cityCode
model Document {
  id          String   @id @default(uuid())
  cityCode    String   @map("city_code")  // 新增：城市代碼
  // ... 其他欄位 ...

  city        City     @relation(fields: [cityCode], references: [code])

  @@index([cityCode])
  @@map("documents")
}
```

```sql
-- RLS 策略配置腳本
-- prisma/migrations/XXXXXX_enable_rls/migration.sql

-- 啟用 RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 創建策略函數：檢查用戶是否有權訪問該城市
CREATE OR REPLACE FUNCTION user_has_city_access(city_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- 檢查是否為全局管理者（訪問所有城市）
  IF current_setting('app.is_global_admin', true) = 'true' THEN
    RETURN true;
  END IF;

  -- 檢查用戶授權城市列表
  RETURN city_code = ANY(
    string_to_array(
      current_setting('app.user_city_codes', true),
      ','
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Documents 表 RLS 策略
CREATE POLICY documents_city_isolation ON documents
  FOR ALL
  USING (user_has_city_access(city_code))
  WITH CHECK (user_has_city_access(city_code));

-- Processing Queue 表 RLS 策略
CREATE POLICY processing_queue_city_isolation ON processing_queue
  FOR ALL
  USING (user_has_city_access(city_code))
  WITH CHECK (user_has_city_access(city_code));

-- Extraction Results 表 RLS 策略
CREATE POLICY extraction_results_city_isolation ON extraction_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = extraction_results.document_id
      AND user_has_city_access(d.city_code)
    )
  );

-- Corrections 表 RLS 策略
CREATE POLICY corrections_city_isolation ON corrections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = corrections.document_id
      AND user_has_city_access(d.city_code)
    )
  );

-- Audit Logs 表 RLS 策略（直接有 city_code）
CREATE POLICY audit_logs_city_isolation ON audit_logs
  FOR ALL
  USING (
    city_code IS NULL  -- 全局日誌
    OR user_has_city_access(city_code)
  );

-- 為服務帳號創建 bypass 策略
CREATE POLICY service_bypass ON documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 創建索引以優化 RLS 性能
CREATE INDEX IF NOT EXISTS idx_documents_city_code ON documents(city_code);
CREATE INDEX IF NOT EXISTS idx_processing_queue_city_code ON processing_queue(city_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_city_code ON audit_logs(city_code);
```

```typescript
// src/lib/db-context.ts
import { PrismaClient, Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'

// 擴展 Prisma Client 以支援 RLS context
export function createPrismaClient() {
  const prisma = new PrismaClient()

  return prisma.$extends({
    query: {
      $allOperations: async ({ args, query, operation, model }) => {
        // 獲取當前用戶 session
        const session = await auth()

        if (!session?.user) {
          // 未登入用戶，使用限制性 context
          await setRlsContext(prisma, {
            isGlobalAdmin: false,
            cityCodes: [],
          })
        } else {
          // 設置用戶的城市訪問權限
          await setRlsContext(prisma, {
            isGlobalAdmin: session.user.isGlobalAdmin || false,
            cityCodes: session.user.cityCodes || [],
          })
        }

        return query(args)
      },
    },
  })
}

interface RlsContext {
  isGlobalAdmin: boolean
  cityCodes: string[]
}

async function setRlsContext(prisma: PrismaClient, context: RlsContext) {
  await prisma.$executeRaw`
    SELECT
      set_config('app.is_global_admin', ${context.isGlobalAdmin.toString()}, true),
      set_config('app.user_city_codes', ${context.cityCodes.join(',')}, true)
  `
}

// 導出配置了 RLS 的 Prisma 實例
export const prisma = createPrismaClient()
```

```typescript
// src/lib/city-access.ts
import { prisma } from '@/lib/db-context'

// 檢查用戶是否有權訪問特定城市
export async function hasAccessToCity(
  userId: string,
  cityCode: string
): Promise<boolean> {
  const access = await prisma.userCityAccess.findFirst({
    where: {
      userId,
      city: { code: cityCode },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  })

  return !!access
}

// 獲取用戶所有授權城市
export async function getUserCityCodes(userId: string): Promise<string[]> {
  const accesses = await prisma.userCityAccess.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      city: {
        select: { code: true },
      },
    },
  })

  return accesses.map(a => a.city.code)
}

// 授予用戶城市訪問權限
export async function grantCityAccess(
  userId: string,
  cityCode: string,
  grantedBy: string,
  accessLevel: 'READ_ONLY' | 'FULL' = 'FULL',
  expiresAt?: Date
): Promise<void> {
  const city = await prisma.city.findUnique({
    where: { code: cityCode },
  })

  if (!city) {
    throw new Error(`City not found: ${cityCode}`)
  }

  await prisma.userCityAccess.upsert({
    where: {
      userId_cityId: {
        userId,
        cityId: city.id,
      },
    },
    create: {
      userId,
      cityId: city.id,
      accessLevel,
      grantedBy,
      expiresAt,
    },
    update: {
      accessLevel,
      grantedBy,
      grantedAt: new Date(),
      expiresAt,
    },
  })
}

// 撤銷用戶城市訪問權限
export async function revokeCityAccess(
  userId: string,
  cityCode: string
): Promise<void> {
  const city = await prisma.city.findUnique({
    where: { code: cityCode },
  })

  if (!city) return

  await prisma.userCityAccess.deleteMany({
    where: {
      userId,
      cityId: city.id,
    },
  })
}
```

```typescript
// prisma/seed-cities.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const regions = [
  { code: 'APAC', name: 'Asia Pacific', timezone: 'Asia/Hong_Kong' },
  { code: 'EMEA', name: 'Europe, Middle East & Africa', timezone: 'Europe/London' },
  { code: 'AMER', name: 'Americas', timezone: 'America/New_York' },
]

const cities = [
  // APAC
  { code: 'HKG', name: '香港', regionCode: 'APAC', timezone: 'Asia/Hong_Kong', currency: 'HKD' },
  { code: 'SIN', name: 'Singapore', regionCode: 'APAC', timezone: 'Asia/Singapore', currency: 'SGD' },
  { code: 'TYO', name: 'Tokyo', regionCode: 'APAC', timezone: 'Asia/Tokyo', currency: 'JPY' },
  { code: 'SYD', name: 'Sydney', regionCode: 'APAC', timezone: 'Australia/Sydney', currency: 'AUD' },
  // EMEA
  { code: 'LON', name: 'London', regionCode: 'EMEA', timezone: 'Europe/London', currency: 'GBP' },
  { code: 'FRA', name: 'Frankfurt', regionCode: 'EMEA', timezone: 'Europe/Berlin', currency: 'EUR' },
  // AMER
  { code: 'NYC', name: 'New York', regionCode: 'AMER', timezone: 'America/New_York', currency: 'USD' },
  { code: 'LAX', name: 'Los Angeles', regionCode: 'AMER', timezone: 'America/Los_Angeles', currency: 'USD' },
]

async function seedCities() {
  console.log('Seeding regions and cities...')

  // 創建區域
  for (const region of regions) {
    await prisma.region.upsert({
      where: { code: region.code },
      create: region,
      update: region,
    })
  }

  // 創建城市
  for (const city of cities) {
    const region = await prisma.region.findUnique({
      where: { code: city.regionCode },
    })

    if (!region) continue

    await prisma.city.upsert({
      where: { code: city.code },
      create: {
        code: city.code,
        name: city.name,
        regionId: region.id,
        timezone: city.timezone,
        currency: city.currency,
      },
      update: {
        name: city.name,
        timezone: city.timezone,
        currency: city.currency,
      },
    })
  }

  console.log('Cities seeded successfully!')
}

seedCities()
```

### 性能考量

- **索引策略**: 為所有 cityCode 欄位創建索引
- **RLS 函數優化**: 使用 SECURITY DEFINER 確保策略效率
- **連接池**: 確保 session 變數正確設置在每個連接
- **查詢計劃**: 定期分析 RLS 對查詢計劃的影響

### References

- [Source: docs/03-epics/sections/epic-6-multi-city-data-isolation.md#story-61]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR43]
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 6.1 |
| Story Key | 6-1-city-data-model-rls-config |
| Epic | Epic 6: 多城市數據隔離 |
| FR Coverage | FR43 |
| Dependencies | Story 1.0, Story 1.2 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
