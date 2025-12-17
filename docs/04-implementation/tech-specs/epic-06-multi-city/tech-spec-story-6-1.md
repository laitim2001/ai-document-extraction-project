# Tech Spec: Story 6.1 - City Data Model and RLS Configuration

## Story Reference
- **Story ID**: 6.1
- **Story Title**: 城市數據模型與 RLS 配置
- **Epic**: Epic 6 - 多城市數據隔離
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
建立多城市數據隔離的基礎架構，包含 City/Region 數據模型和 PostgreSQL Row Level Security (RLS) 策略，確保業務數據在數據庫層級就實現自動隔離。

### 1.2 Scope
- Region 和 City Prisma 模型設計
- UserCityAccess 權限關聯模型
- 業務表添加 cityCode 欄位
- PostgreSQL RLS 策略配置
- Prisma 中間件自動設置 RLS context
- 數據遷移和種子數據

### 1.3 Dependencies
- Story 1.0: 專案初始化（Prisma 配置）
- Story 1.2: 用戶角色基礎
- PostgreSQL 15+ (支援 RLS)

---

## 2. Database Schema Design

### 2.1 New Prisma Models

```prisma
// prisma/schema.prisma

// ============================================
// Region Model - 區域（如 APAC, EMEA, AMER）
// ============================================
model Region {
  id          String       @id @default(uuid())
  code        String       @unique                    // e.g., "APAC", "EMEA"
  name        String                                  // e.g., "Asia Pacific"
  parentId    String?      @map("parent_id")          // 支援階層式區域
  timezone    String       @default("UTC")
  status      RegionStatus @default(ACTIVE)
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  // Relations
  parent      Region?      @relation("RegionHierarchy", fields: [parentId], references: [id])
  children    Region[]     @relation("RegionHierarchy")
  cities      City[]

  @@index([parentId])
  @@index([status])
  @@map("regions")
}

enum RegionStatus {
  ACTIVE
  INACTIVE
}

// ============================================
// City Model - 城市
// ============================================
model City {
  id          String     @id @default(uuid())
  code        String     @unique                      // e.g., "HKG", "SIN", "LON"
  name        String                                  // e.g., "Hong Kong", "Singapore"
  regionId    String     @map("region_id")
  timezone    String     @default("UTC")              // e.g., "Asia/Hong_Kong"
  currency    String     @default("USD")              // e.g., "HKD", "SGD"
  locale      String     @default("en-US")            // 語言區域設定
  status      CityStatus @default(ACTIVE)
  config      Json?                                   // 城市特定配置（閾值、選項等）
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  // Relations
  region        Region           @relation(fields: [regionId], references: [id])
  documents     Document[]
  userAccesses  UserCityAccess[]
  auditLogs     AuditLog[]
  systemConfigs SystemConfig[]

  @@index([regionId])
  @@index([status])
  @@index([code])
  @@map("cities")
}

enum CityStatus {
  ACTIVE      // 啟用中
  INACTIVE    // 已停用
  PENDING     // 待啟用
}

// ============================================
// UserCityAccess Model - 用戶城市訪問權限
// ============================================
model UserCityAccess {
  id          String      @id @default(uuid())
  userId      String      @map("user_id")
  cityId      String      @map("city_id")
  accessLevel AccessLevel @default(FULL)
  isPrimary   Boolean     @default(false) @map("is_primary")  // 主要城市
  grantedBy   String      @map("granted_by")
  grantedAt   DateTime    @default(now()) @map("granted_at")
  expiresAt   DateTime?   @map("expires_at")                  // 可選的過期時間
  reason      String?                                          // 授權原因

  // Relations
  user        User        @relation("UserCityAccess", fields: [userId], references: [id], onDelete: Cascade)
  city        City        @relation(fields: [cityId], references: [id])
  grantor     User        @relation("GrantedCityAccess", fields: [grantedBy], references: [id])

  @@unique([userId, cityId])
  @@index([userId])
  @@index([cityId])
  @@index([expiresAt])
  @@map("user_city_access")
}

enum AccessLevel {
  READ_ONLY   // 僅讀取
  FULL        // 完整訪問（讀寫）
}

// ============================================
// Update User Model - 添加城市相關欄位
// ============================================
model User {
  // ... existing fields ...

  isGlobalAdmin     Boolean @default(false) @map("is_global_admin")
  isRegionalManager Boolean @default(false) @map("is_regional_manager")

  // Relations
  cityAccesses      UserCityAccess[] @relation("UserCityAccess")
  grantedAccesses   UserCityAccess[] @relation("GrantedCityAccess")
}

// ============================================
// Update Document Model - 添加 cityCode
// ============================================
model Document {
  // ... existing fields ...
  cityCode    String   @map("city_code")

  // Relations
  city        City     @relation(fields: [cityCode], references: [code])

  @@index([cityCode])
}

// ============================================
// Update ProcessingQueue Model - 添加 cityCode
// ============================================
model ProcessingQueue {
  // ... existing fields ...
  cityCode    String   @map("city_code")

  @@index([cityCode])
}

// ============================================
// Update AuditLog Model - 添加 cityCode
// ============================================
model AuditLog {
  // ... existing fields ...
  cityCode    String?  @map("city_code")  // 可選，全局操作為 null

  // Relations
  city        City?    @relation(fields: [cityCode], references: [code])

  @@index([cityCode])
}
```

### 2.2 Database Migration SQL

```sql
-- prisma/migrations/XXXXXX_add_multi_city_support/migration.sql

-- 1. Create regions table
CREATE TABLE "regions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "parent_id" UUID,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "regions_code_key" UNIQUE ("code"),
    CONSTRAINT "regions_parent_fkey" FOREIGN KEY ("parent_id")
        REFERENCES "regions"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_regions_parent_id" ON "regions"("parent_id");
CREATE INDEX "idx_regions_status" ON "regions"("status");

-- 2. Create cities table
CREATE TABLE "cities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "region_id" UUID NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en-US',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cities_code_key" UNIQUE ("code"),
    CONSTRAINT "cities_region_fkey" FOREIGN KEY ("region_id")
        REFERENCES "regions"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_cities_region_id" ON "cities"("region_id");
CREATE INDEX "idx_cities_status" ON "cities"("status");
CREATE INDEX "idx_cities_code" ON "cities"("code");

-- 3. Create user_city_access table
CREATE TABLE "user_city_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "access_level" VARCHAR(20) NOT NULL DEFAULT 'FULL',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "reason" TEXT,

    CONSTRAINT "user_city_access_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_city_access_unique" UNIQUE ("user_id", "city_id"),
    CONSTRAINT "user_city_access_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_city_access_city_fkey" FOREIGN KEY ("city_id")
        REFERENCES "cities"("id") ON DELETE RESTRICT,
    CONSTRAINT "user_city_access_grantor_fkey" FOREIGN KEY ("granted_by")
        REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_user_city_access_user_id" ON "user_city_access"("user_id");
CREATE INDEX "idx_user_city_access_city_id" ON "user_city_access"("city_id");
CREATE INDEX "idx_user_city_access_expires_at" ON "user_city_access"("expires_at");

-- 4. Add cityCode to existing tables
ALTER TABLE "users" ADD COLUMN "is_global_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "is_regional_manager" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "documents" ADD COLUMN "city_code" VARCHAR(10);
ALTER TABLE "processing_queue" ADD COLUMN "city_code" VARCHAR(10);
ALTER TABLE "audit_logs" ADD COLUMN "city_code" VARCHAR(10);

-- 5. Add foreign key constraints
ALTER TABLE "documents" ADD CONSTRAINT "documents_city_fkey"
    FOREIGN KEY ("city_code") REFERENCES "cities"("code") ON DELETE RESTRICT;

-- 6. Create indexes for cityCode columns
CREATE INDEX "idx_documents_city_code" ON "documents"("city_code");
CREATE INDEX "idx_processing_queue_city_code" ON "processing_queue"("city_code");
CREATE INDEX "idx_audit_logs_city_code" ON "audit_logs"("city_code");

-- 7. Create composite indexes for common queries
CREATE INDEX "idx_documents_city_status" ON "documents"("city_code", "status");
CREATE INDEX "idx_documents_city_created" ON "documents"("city_code", "created_at" DESC);
```

---

## 3. Row Level Security (RLS) Implementation

### 3.1 RLS Enable and Policy Functions

```sql
-- prisma/migrations/XXXXXX_enable_rls/migration.sql

-- ============================================
-- Enable RLS on business tables
-- ============================================
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "processing_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extraction_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "escalations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too (important for security)
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "processing_queue" FORCE ROW LEVEL SECURITY;
ALTER TABLE "extraction_results" FORCE ROW LEVEL SECURITY;
ALTER TABLE "corrections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "escalations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

-- ============================================
-- Create RLS helper function
-- ============================================
CREATE OR REPLACE FUNCTION user_has_city_access(check_city_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
    user_cities TEXT[];
BEGIN
    -- Get session variables
    is_admin := COALESCE(
        current_setting('app.is_global_admin', true)::BOOLEAN,
        false
    );

    -- Global admin bypasses all restrictions
    IF is_admin THEN
        RETURN true;
    END IF;

    -- Get user's authorized city codes
    user_cities := string_to_array(
        COALESCE(current_setting('app.user_city_codes', true), ''),
        ','
    );

    -- Check if city is in user's authorized list
    RETURN check_city_code = ANY(user_cities);
EXCEPTION
    WHEN OTHERS THEN
        -- Fail closed on any error
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- Create RLS policies for documents
-- ============================================
CREATE POLICY documents_city_isolation_select ON "documents"
    FOR SELECT
    USING (user_has_city_access(city_code));

CREATE POLICY documents_city_isolation_insert ON "documents"
    FOR INSERT
    WITH CHECK (user_has_city_access(city_code));

CREATE POLICY documents_city_isolation_update ON "documents"
    FOR UPDATE
    USING (user_has_city_access(city_code))
    WITH CHECK (user_has_city_access(city_code));

CREATE POLICY documents_city_isolation_delete ON "documents"
    FOR DELETE
    USING (user_has_city_access(city_code));

-- ============================================
-- Create RLS policies for processing_queue
-- ============================================
CREATE POLICY processing_queue_city_isolation ON "processing_queue"
    FOR ALL
    USING (user_has_city_access(city_code))
    WITH CHECK (user_has_city_access(city_code));

-- ============================================
-- Create RLS policies for extraction_results
-- (via document relationship)
-- ============================================
CREATE POLICY extraction_results_city_isolation ON "extraction_results"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "documents" d
            WHERE d.id = extraction_results.document_id
            AND user_has_city_access(d.city_code)
        )
    );

-- ============================================
-- Create RLS policies for corrections
-- (via document relationship)
-- ============================================
CREATE POLICY corrections_city_isolation ON "corrections"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "documents" d
            WHERE d.id = corrections.document_id
            AND user_has_city_access(d.city_code)
        )
    );

-- ============================================
-- Create RLS policies for escalations
-- (via document relationship)
-- ============================================
CREATE POLICY escalations_city_isolation ON "escalations"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "documents" d
            WHERE d.id = escalations.document_id
            AND user_has_city_access(d.city_code)
        )
    );

-- ============================================
-- Create RLS policies for audit_logs
-- ============================================
CREATE POLICY audit_logs_city_isolation ON "audit_logs"
    FOR ALL
    USING (
        city_code IS NULL  -- Global logs visible to all
        OR user_has_city_access(city_code)
    );

-- ============================================
-- Create bypass policy for service role
-- ============================================
DO $$
BEGIN
    -- Create service role if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
END $$;

CREATE POLICY service_bypass_documents ON "documents"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY service_bypass_processing_queue ON "processing_queue"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY service_bypass_extraction_results ON "extraction_results"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY service_bypass_corrections ON "corrections"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY service_bypass_escalations ON "escalations"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY service_bypass_audit_logs ON "audit_logs"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
```

---

## 4. Application Layer Implementation

### 4.1 Database Context Manager

```typescript
// src/lib/db-context.ts
import { PrismaClient } from '@prisma/client'
import { auth } from '@/lib/auth'

// Singleton pattern for Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

/**
 * RLS Context interface
 */
export interface RlsContext {
  isGlobalAdmin: boolean
  cityCodes: string[]
  userId?: string
}

/**
 * Creates a Prisma client with RLS context extension
 */
function createPrismaClient() {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

  return prisma.$extends({
    query: {
      $allOperations: async ({ args, query, operation, model }) => {
        // Skip RLS for certain operations/models
        const skipRlsModels = ['Region', 'City', 'User', 'Role', 'MappingRule', 'Forwarder']
        if (skipRlsModels.includes(model || '')) {
          return query(args)
        }

        // Get current session
        const session = await auth()

        // Build RLS context
        const context: RlsContext = {
          isGlobalAdmin: session?.user?.isGlobalAdmin || false,
          cityCodes: session?.user?.cityCodes || [],
          userId: session?.user?.id,
        }

        // Set RLS context before query
        await setRlsContext(prisma, context)

        // Execute the query
        return query(args)
      },
    },
  })
}

/**
 * Sets PostgreSQL session variables for RLS
 */
async function setRlsContext(
  prisma: PrismaClient,
  context: RlsContext
): Promise<void> {
  const isGlobalAdmin = context.isGlobalAdmin ? 'true' : 'false'
  const cityCodes = context.cityCodes.join(',')

  await prisma.$executeRaw`
    SELECT
      set_config('app.is_global_admin', ${isGlobalAdmin}, true),
      set_config('app.user_city_codes', ${cityCodes}, true)
  `
}

/**
 * Export configured Prisma client
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * Execute a transaction with specific RLS context
 * Useful for background jobs or system operations
 */
export async function withRlsContext<T>(
  context: RlsContext,
  operation: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  const basePrisma = new PrismaClient()

  try {
    // Set context
    await setRlsContext(basePrisma, context)

    // Execute operation
    return await operation(basePrisma)
  } finally {
    await basePrisma.$disconnect()
  }
}

/**
 * Execute operation as service role (bypass RLS)
 */
export async function withServiceRole<T>(
  operation: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return withRlsContext(
    { isGlobalAdmin: true, cityCodes: [] },
    operation
  )
}
```

### 4.2 City Access Service

```typescript
// src/lib/city-access.ts
import { prisma, withServiceRole } from '@/lib/db-context'
import { AccessLevel } from '@prisma/client'

/**
 * City access management service
 */
export class CityAccessService {
  /**
   * Check if user has access to a specific city
   */
  static async hasAccess(
    userId: string,
    cityCode: string
  ): Promise<boolean> {
    // Use service role to bypass RLS for this check
    return withServiceRole(async (tx) => {
      const access = await tx.userCityAccess.findFirst({
        where: {
          userId,
          city: { code: cityCode, status: 'ACTIVE' },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      })

      return !!access
    })
  }

  /**
   * Get all city codes user has access to
   */
  static async getUserCityCodes(userId: string): Promise<string[]> {
    return withServiceRole(async (tx) => {
      const accesses = await tx.userCityAccess.findMany({
        where: {
          userId,
          city: { status: 'ACTIVE' },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          city: { select: { code: true } },
        },
        orderBy: [
          { isPrimary: 'desc' },
          { grantedAt: 'asc' },
        ],
      })

      return accesses.map(a => a.city.code)
    })
  }

  /**
   * Get user's primary city code
   */
  static async getPrimaryCityCode(userId: string): Promise<string | null> {
    return withServiceRole(async (tx) => {
      const access = await tx.userCityAccess.findFirst({
        where: {
          userId,
          isPrimary: true,
          city: { status: 'ACTIVE' },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          city: { select: { code: true } },
        },
      })

      if (access) return access.city.code

      // Fallback to first access
      const firstAccess = await tx.userCityAccess.findFirst({
        where: {
          userId,
          city: { status: 'ACTIVE' },
        },
        include: {
          city: { select: { code: true } },
        },
        orderBy: { grantedAt: 'asc' },
      })

      return firstAccess?.city.code || null
    })
  }

  /**
   * Grant city access to user
   */
  static async grantAccess(params: {
    userId: string
    cityCode: string
    grantedBy: string
    accessLevel?: AccessLevel
    isPrimary?: boolean
    expiresAt?: Date
    reason?: string
  }): Promise<void> {
    const { userId, cityCode, grantedBy, accessLevel, isPrimary, expiresAt, reason } = params

    await withServiceRole(async (tx) => {
      // Get city
      const city = await tx.city.findUnique({
        where: { code: cityCode },
      })

      if (!city) {
        throw new Error(`City not found: ${cityCode}`)
      }

      // If setting as primary, unset other primaries first
      if (isPrimary) {
        await tx.userCityAccess.updateMany({
          where: { userId, isPrimary: true },
          data: { isPrimary: false },
        })
      }

      // Upsert access
      await tx.userCityAccess.upsert({
        where: {
          userId_cityId: { userId, cityId: city.id },
        },
        create: {
          userId,
          cityId: city.id,
          accessLevel: accessLevel || 'FULL',
          isPrimary: isPrimary || false,
          grantedBy,
          expiresAt,
          reason,
        },
        update: {
          accessLevel: accessLevel || 'FULL',
          isPrimary: isPrimary || false,
          grantedBy,
          grantedAt: new Date(),
          expiresAt,
          reason,
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'UserCityAccess',
          entityId: userId,
          action: 'GRANT_CITY_ACCESS',
          performedBy: grantedBy,
          changes: {
            cityCode,
            accessLevel: accessLevel || 'FULL',
            isPrimary: isPrimary || false,
            expiresAt: expiresAt?.toISOString(),
          },
        },
      })
    })
  }

  /**
   * Revoke city access from user
   */
  static async revokeAccess(params: {
    userId: string
    cityCode: string
    revokedBy: string
    reason?: string
  }): Promise<void> {
    const { userId, cityCode, revokedBy, reason } = params

    await withServiceRole(async (tx) => {
      const city = await tx.city.findUnique({
        where: { code: cityCode },
      })

      if (!city) return

      // Delete access
      await tx.userCityAccess.deleteMany({
        where: {
          userId,
          cityId: city.id,
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'UserCityAccess',
          entityId: userId,
          action: 'REVOKE_CITY_ACCESS',
          performedBy: revokedBy,
          changes: {
            cityCode,
            reason,
          },
        },
      })
    })
  }

  /**
   * Get all cities in a region
   */
  static async getCitiesByRegion(regionCode: string): Promise<string[]> {
    return withServiceRole(async (tx) => {
      const cities = await tx.city.findMany({
        where: {
          region: { code: regionCode },
          status: 'ACTIVE',
        },
        select: { code: true },
      })

      return cities.map(c => c.code)
    })
  }

  /**
   * Clean up expired accesses (for scheduled job)
   */
  static async cleanupExpiredAccesses(): Promise<number> {
    return withServiceRole(async (tx) => {
      const result = await tx.userCityAccess.deleteMany({
        where: {
          expiresAt: { lte: new Date() },
        },
      })

      return result.count
    })
  }
}
```

### 4.3 Session Type Extensions

```typescript
// types/next-auth.d.ts
import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      cityCodes: string[]
      primaryCityCode: string | null
      isGlobalAdmin: boolean
      isRegionalManager: boolean
      regionCodes?: string[]
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    cityCodes: string[]
    primaryCityCode: string | null
    isGlobalAdmin: boolean
    isRegionalManager: boolean
    regionCodes?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    cityCodes: string[]
    primaryCityCode: string | null
    isGlobalAdmin: boolean
    isRegionalManager: boolean
    regionCodes?: string[]
  }
}
```

### 4.4 NextAuth Configuration Update

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db-context'
import { CityAccessService } from '@/lib/city-access'
import Credentials from 'next-auth/providers/credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      // ... credential configuration
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // Initial sign in
        token.id = user.id
        token.isGlobalAdmin = user.isGlobalAdmin || false
        token.isRegionalManager = user.isRegionalManager || false

        // Load city access
        const cityCodes = await CityAccessService.getUserCityCodes(user.id)
        token.cityCodes = cityCodes
        token.primaryCityCode = await CityAccessService.getPrimaryCityCode(user.id)

        // Load region codes for regional managers
        if (token.isRegionalManager) {
          // Regional managers get all cities in their regions
          // Implementation depends on region assignment model
        }
      }

      // Refresh city access periodically
      if (trigger === 'update') {
        token.cityCodes = await CityAccessService.getUserCityCodes(token.id as string)
        token.primaryCityCode = await CityAccessService.getPrimaryCityCode(token.id as string)
      }

      return token
    },

    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.cityCodes = token.cityCodes as string[]
      session.user.primaryCityCode = token.primaryCityCode as string | null
      session.user.isGlobalAdmin = token.isGlobalAdmin as boolean
      session.user.isRegionalManager = token.isRegionalManager as boolean
      session.user.regionCodes = token.regionCodes as string[] | undefined

      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})
```

---

## 5. Seed Data

### 5.1 Seed Script

```typescript
// prisma/seed/cities.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const regions = [
  {
    code: 'APAC',
    name: 'Asia Pacific',
    timezone: 'Asia/Hong_Kong'
  },
  {
    code: 'EMEA',
    name: 'Europe, Middle East & Africa',
    timezone: 'Europe/London'
  },
  {
    code: 'AMER',
    name: 'Americas',
    timezone: 'America/New_York'
  },
]

const cities = [
  // APAC
  {
    code: 'HKG',
    name: '香港',
    regionCode: 'APAC',
    timezone: 'Asia/Hong_Kong',
    currency: 'HKD',
    locale: 'zh-HK',
    config: { dateFormat: 'DD/MM/YYYY', confidenceThreshold: 0.85 }
  },
  {
    code: 'SIN',
    name: 'Singapore',
    regionCode: 'APAC',
    timezone: 'Asia/Singapore',
    currency: 'SGD',
    locale: 'en-SG',
    config: { dateFormat: 'DD/MM/YYYY', confidenceThreshold: 0.80 }
  },
  {
    code: 'TYO',
    name: '東京',
    regionCode: 'APAC',
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    locale: 'ja-JP',
    config: { dateFormat: 'YYYY/MM/DD', confidenceThreshold: 0.85 }
  },
  {
    code: 'SYD',
    name: 'Sydney',
    regionCode: 'APAC',
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    locale: 'en-AU',
    config: { dateFormat: 'DD/MM/YYYY', confidenceThreshold: 0.80 }
  },
  {
    code: 'SHA',
    name: '上海',
    regionCode: 'APAC',
    timezone: 'Asia/Shanghai',
    currency: 'CNY',
    locale: 'zh-CN',
    config: { dateFormat: 'YYYY-MM-DD', confidenceThreshold: 0.85 }
  },

  // EMEA
  {
    code: 'LON',
    name: 'London',
    regionCode: 'EMEA',
    timezone: 'Europe/London',
    currency: 'GBP',
    locale: 'en-GB',
    config: { dateFormat: 'DD/MM/YYYY', confidenceThreshold: 0.80 }
  },
  {
    code: 'FRA',
    name: 'Frankfurt',
    regionCode: 'EMEA',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    locale: 'de-DE',
    config: { dateFormat: 'DD.MM.YYYY', confidenceThreshold: 0.80 }
  },
  {
    code: 'DXB',
    name: 'Dubai',
    regionCode: 'EMEA',
    timezone: 'Asia/Dubai',
    currency: 'AED',
    locale: 'en-AE',
    config: { dateFormat: 'DD/MM/YYYY', confidenceThreshold: 0.80 }
  },

  // AMER
  {
    code: 'NYC',
    name: 'New York',
    regionCode: 'AMER',
    timezone: 'America/New_York',
    currency: 'USD',
    locale: 'en-US',
    config: { dateFormat: 'MM/DD/YYYY', confidenceThreshold: 0.80 }
  },
  {
    code: 'LAX',
    name: 'Los Angeles',
    regionCode: 'AMER',
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    locale: 'en-US',
    config: { dateFormat: 'MM/DD/YYYY', confidenceThreshold: 0.80 }
  },
  {
    code: 'SAO',
    name: 'São Paulo',
    regionCode: 'AMER',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    locale: 'pt-BR',
    config: { dateFormat: 'DD/MM/YYYY', confidenceThreshold: 0.80 }
  },
]

export async function seedCities() {
  console.log('Seeding regions and cities...')

  // Create regions
  for (const region of regions) {
    await prisma.region.upsert({
      where: { code: region.code },
      create: region,
      update: {
        name: region.name,
        timezone: region.timezone,
      },
    })
    console.log(`  Region: ${region.code}`)
  }

  // Create cities
  for (const city of cities) {
    const region = await prisma.region.findUnique({
      where: { code: city.regionCode },
    })

    if (!region) {
      console.error(`  Region not found: ${city.regionCode}`)
      continue
    }

    await prisma.city.upsert({
      where: { code: city.code },
      create: {
        code: city.code,
        name: city.name,
        regionId: region.id,
        timezone: city.timezone,
        currency: city.currency,
        locale: city.locale,
        config: city.config,
      },
      update: {
        name: city.name,
        timezone: city.timezone,
        currency: city.currency,
        locale: city.locale,
        config: city.config,
      },
    })
    console.log(`  City: ${city.code} (${city.name})`)
  }

  console.log('Cities seeded successfully!')
}

// Run if called directly
if (require.main === module) {
  seedCities()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e)
      prisma.$disconnect()
      process.exit(1)
    })
}
```

---

## 6. API Endpoints

### 6.1 City Management API

```typescript
// src/app/api/admin/cities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db-context'
import { z } from 'zod'

// GET /api/admin/cities - List all cities
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { type: 'UNAUTHORIZED', title: 'Authentication required' },
      { status: 401 }
    )
  }

  // Only global admins can list all cities
  if (!session.user.isGlobalAdmin) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Global admin access required' },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const regionCode = searchParams.get('region')
  const status = searchParams.get('status')

  const cities = await prisma.city.findMany({
    where: {
      ...(regionCode && { region: { code: regionCode } }),
      ...(status && { status: status as any }),
    },
    include: {
      region: {
        select: { code: true, name: true },
      },
      _count: {
        select: {
          documents: true,
          userAccesses: true,
        },
      },
    },
    orderBy: [
      { region: { code: 'asc' } },
      { code: 'asc' },
    ],
  })

  return NextResponse.json({
    success: true,
    data: cities.map(city => ({
      id: city.id,
      code: city.code,
      name: city.name,
      region: city.region,
      timezone: city.timezone,
      currency: city.currency,
      locale: city.locale,
      status: city.status,
      config: city.config,
      stats: {
        documents: city._count.documents,
        users: city._count.userAccesses,
      },
      createdAt: city.createdAt,
      updatedAt: city.updatedAt,
    })),
  })
}

// POST /api/admin/cities - Create new city
const createCitySchema = z.object({
  code: z.string().min(2).max(10).toUpperCase(),
  name: z.string().min(1).max(100),
  regionCode: z.string(),
  timezone: z.string().default('UTC'),
  currency: z.string().length(3).default('USD'),
  locale: z.string().default('en-US'),
  config: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Global admin access required' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const validation = createCitySchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'VALIDATION_ERROR',
        title: 'Invalid request data',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { code, name, regionCode, timezone, currency, locale, config } = validation.data

  // Check region exists
  const region = await prisma.region.findUnique({
    where: { code: regionCode },
  })

  if (!region) {
    return NextResponse.json(
      { type: 'NOT_FOUND', title: 'Region not found' },
      { status: 404 }
    )
  }

  // Check code uniqueness
  const existing = await prisma.city.findUnique({
    where: { code },
  })

  if (existing) {
    return NextResponse.json(
      { type: 'CONFLICT', title: 'City code already exists' },
      { status: 409 }
    )
  }

  // Create city
  const city = await prisma.city.create({
    data: {
      code,
      name,
      regionId: region.id,
      timezone,
      currency,
      locale,
      config,
      status: 'PENDING',
    },
    include: {
      region: { select: { code: true, name: true } },
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      entityType: 'City',
      entityId: city.id,
      action: 'CREATE',
      performedBy: session.user.id,
      changes: { code, name, regionCode, timezone, currency, locale },
    },
  })

  return NextResponse.json({
    success: true,
    data: city,
  }, { status: 201 })
}
```

### 6.2 User City Access API

```typescript
// src/app/api/admin/users/[userId]/cities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { CityAccessService } from '@/lib/city-access'
import { z } from 'zod'

// GET /api/admin/users/[userId]/cities - Get user's city accesses
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await auth()

  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Global admin access required' },
      { status: 403 }
    )
  }

  const accesses = await prisma.userCityAccess.findMany({
    where: { userId: params.userId },
    include: {
      city: {
        include: {
          region: { select: { code: true, name: true } },
        },
      },
      grantor: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [
      { isPrimary: 'desc' },
      { grantedAt: 'desc' },
    ],
  })

  return NextResponse.json({
    success: true,
    data: accesses.map(access => ({
      id: access.id,
      city: {
        code: access.city.code,
        name: access.city.name,
        region: access.city.region,
      },
      accessLevel: access.accessLevel,
      isPrimary: access.isPrimary,
      grantedBy: access.grantor,
      grantedAt: access.grantedAt,
      expiresAt: access.expiresAt,
      reason: access.reason,
    })),
  })
}

// POST /api/admin/users/[userId]/cities - Grant city access
const grantAccessSchema = z.object({
  cityCode: z.string(),
  accessLevel: z.enum(['READ_ONLY', 'FULL']).default('FULL'),
  isPrimary: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await auth()

  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Global admin access required' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const validation = grantAccessSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'VALIDATION_ERROR',
        title: 'Invalid request data',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const { cityCode, accessLevel, isPrimary, expiresAt, reason } = validation.data

  try {
    await CityAccessService.grantAccess({
      userId: params.userId,
      cityCode,
      grantedBy: session.user.id,
      accessLevel,
      isPrimary,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      reason,
    })

    return NextResponse.json({
      success: true,
      message: 'City access granted',
    })
  } catch (error) {
    return NextResponse.json(
      { type: 'ERROR', title: (error as Error).message },
      { status: 400 }
    )
  }
}

// DELETE /api/admin/users/[userId]/cities/[cityCode] - Revoke city access
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string; cityCode: string } }
) {
  const session = await auth()

  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json(
      { type: 'FORBIDDEN', title: 'Global admin access required' },
      { status: 403 }
    )
  }

  const reason = request.nextUrl.searchParams.get('reason')

  await CityAccessService.revokeAccess({
    userId: params.userId,
    cityCode: params.cityCode,
    revokedBy: session.user.id,
    reason: reason || undefined,
  })

  return NextResponse.json({
    success: true,
    message: 'City access revoked',
  })
}
```

---

## 7. Performance Optimization

### 7.1 Index Strategy

```sql
-- Additional indexes for RLS performance

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_documents_city_status_created
    ON documents(city_code, status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_documents_city_forwarder
    ON documents(city_code, forwarder_id);

CREATE INDEX CONCURRENTLY idx_processing_queue_city_status
    ON processing_queue(city_code, status);

CREATE INDEX CONCURRENTLY idx_audit_logs_city_created
    ON audit_logs(city_code, created_at DESC);

-- Partial indexes for active records only
CREATE INDEX CONCURRENTLY idx_user_city_access_active
    ON user_city_access(user_id, city_id)
    WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

CREATE INDEX CONCURRENTLY idx_cities_active
    ON cities(code)
    WHERE status = 'ACTIVE';
```

### 7.2 Query Plan Analysis

```typescript
// src/lib/rls-performance.ts

/**
 * Analyze RLS query performance
 */
export async function analyzeRlsPerformance(
  query: string
): Promise<QueryPlan> {
  const result = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    ${Prisma.raw(query)}
  `

  return result[0]['QUERY PLAN'][0]
}

/**
 * Log slow RLS queries for optimization
 */
export function logSlowQuery(
  query: string,
  duration: number,
  threshold: number = 100
): void {
  if (duration > threshold) {
    console.warn(`[RLS SLOW QUERY] ${duration}ms: ${query.substring(0, 200)}...`)

    // Could also send to monitoring system
    // metrics.recordSlowQuery(query, duration)
  }
}
```

---

## 8. Testing Strategy

### 8.1 RLS Policy Tests

```typescript
// __tests__/rls/city-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

describe('RLS City Isolation', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient()

    // Seed test data
    await seedTestCities()
    await seedTestDocuments()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  describe('Document Access', () => {
    it('should only return documents for authorized cities', async () => {
      // Set RLS context for HKG user
      await prisma.$executeRaw`
        SELECT set_config('app.is_global_admin', 'false', true),
               set_config('app.user_city_codes', 'HKG', true)
      `

      const documents = await prisma.document.findMany()

      // Should only get HKG documents
      expect(documents.every(d => d.cityCode === 'HKG')).toBe(true)
    })

    it('should return all documents for global admin', async () => {
      // Set RLS context for global admin
      await prisma.$executeRaw`
        SELECT set_config('app.is_global_admin', 'true', true),
               set_config('app.user_city_codes', '', true)
      `

      const documents = await prisma.document.findMany()

      // Should get documents from multiple cities
      const cityCodes = [...new Set(documents.map(d => d.cityCode))]
      expect(cityCodes.length).toBeGreaterThan(1)
    })

    it('should prevent access to unauthorized city documents', async () => {
      // Set RLS context for SIN user
      await prisma.$executeRaw`
        SELECT set_config('app.is_global_admin', 'false', true),
               set_config('app.user_city_codes', 'SIN', true)
      `

      // Try to access HKG document directly by ID
      const hkgDoc = await prisma.document.findFirst({
        where: { cityCode: 'HKG' },
      })

      // Should return null due to RLS
      expect(hkgDoc).toBeNull()
    })

    it('should support multi-city access', async () => {
      // Set RLS context for multi-city user
      await prisma.$executeRaw`
        SELECT set_config('app.is_global_admin', 'false', true),
               set_config('app.user_city_codes', 'HKG,SIN', true)
      `

      const documents = await prisma.document.findMany()

      // Should only get HKG and SIN documents
      const cityCodes = [...new Set(documents.map(d => d.cityCode))]
      expect(cityCodes.every(c => ['HKG', 'SIN'].includes(c))).toBe(true)
    })
  })

  describe('Insert Protection', () => {
    it('should allow insert for authorized city', async () => {
      await prisma.$executeRaw`
        SELECT set_config('app.is_global_admin', 'false', true),
               set_config('app.user_city_codes', 'HKG', true)
      `

      const doc = await prisma.document.create({
        data: {
          fileName: 'test.pdf',
          cityCode: 'HKG',
          // ... other fields
        },
      })

      expect(doc.cityCode).toBe('HKG')
    })

    it('should reject insert for unauthorized city', async () => {
      await prisma.$executeRaw`
        SELECT set_config('app.is_global_admin', 'false', true),
               set_config('app.user_city_codes', 'HKG', true)
      `

      await expect(
        prisma.document.create({
          data: {
            fileName: 'test.pdf',
            cityCode: 'SIN', // Not authorized
            // ... other fields
          },
        })
      ).rejects.toThrow()
    })
  })
})
```

### 8.2 City Access Service Tests

```typescript
// __tests__/services/city-access.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CityAccessService } from '@/lib/city-access'

describe('CityAccessService', () => {
  describe('grantAccess', () => {
    it('should grant city access to user', async () => {
      await CityAccessService.grantAccess({
        userId: 'user-1',
        cityCode: 'HKG',
        grantedBy: 'admin-1',
        accessLevel: 'FULL',
        isPrimary: true,
      })

      const hasAccess = await CityAccessService.hasAccess('user-1', 'HKG')
      expect(hasAccess).toBe(true)
    })

    it('should handle primary city switching', async () => {
      // Grant first city as primary
      await CityAccessService.grantAccess({
        userId: 'user-1',
        cityCode: 'HKG',
        grantedBy: 'admin-1',
        isPrimary: true,
      })

      // Grant second city as primary
      await CityAccessService.grantAccess({
        userId: 'user-1',
        cityCode: 'SIN',
        grantedBy: 'admin-1',
        isPrimary: true,
      })

      const primaryCity = await CityAccessService.getPrimaryCityCode('user-1')
      expect(primaryCity).toBe('SIN')
    })
  })

  describe('getUserCityCodes', () => {
    it('should return all user city codes', async () => {
      // Grant multiple cities
      await CityAccessService.grantAccess({
        userId: 'user-2',
        cityCode: 'HKG',
        grantedBy: 'admin-1',
      })
      await CityAccessService.grantAccess({
        userId: 'user-2',
        cityCode: 'SIN',
        grantedBy: 'admin-1',
      })

      const cityCodes = await CityAccessService.getUserCityCodes('user-2')
      expect(cityCodes).toContain('HKG')
      expect(cityCodes).toContain('SIN')
    })

    it('should exclude expired accesses', async () => {
      await CityAccessService.grantAccess({
        userId: 'user-3',
        cityCode: 'LON',
        grantedBy: 'admin-1',
        expiresAt: new Date(Date.now() - 1000), // Expired
      })

      const cityCodes = await CityAccessService.getUserCityCodes('user-3')
      expect(cityCodes).not.toContain('LON')
    })
  })
})
```

---

## 9. Monitoring & Observability

### 9.1 RLS Metrics

```typescript
// src/lib/rls-metrics.ts
import { metrics } from '@/lib/monitoring'

export const rlsMetrics = {
  /**
   * Track RLS context set operations
   */
  trackContextSet(userId: string, cityCodes: string[]): void {
    metrics.increment('rls.context.set', {
      user_id: userId,
      city_count: cityCodes.length.toString(),
    })
  },

  /**
   * Track RLS policy evaluation time
   */
  trackPolicyEvaluation(table: string, duration: number): void {
    metrics.histogram('rls.policy.duration', duration, {
      table,
    })
  },

  /**
   * Track blocked access attempts
   */
  trackBlockedAccess(userId: string, attemptedCity: string): void {
    metrics.increment('rls.blocked_access', {
      user_id: userId,
      attempted_city: attemptedCity,
    })
  },
}
```

---

## 10. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | 城市數據模型 | Region, City, UserCityAccess models | Schema migration test |
| AC2 | RLS 策略配置 | PostgreSQL RLS policies with session vars | RLS policy tests |
| AC3 | 自動過濾機制 | Prisma middleware sets RLS context | Integration tests |
| AC4 | 數據完整性 | Foreign key constraints, NOT NULL | Constraint tests |

---

## 11. Security Considerations

1. **RLS Bypass Protection**: Only service_role can bypass RLS
2. **Session Variable Security**: Use `set_config` with `is_local=true`
3. **Audit Trail**: All city access changes logged
4. **Access Expiration**: Support for time-limited access
5. **Fail Closed**: RLS function returns false on any error

---

## 12. References

- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma Client Extensions](https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions)
- Story 6.1 Requirements
- Architecture Document: Data Isolation Section
