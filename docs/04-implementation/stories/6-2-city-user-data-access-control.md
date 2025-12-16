# Story 6.2: 城市用戶數據訪問控制

**Status:** ready-for-dev

---

## Story

**As a** 城市用戶,
**I want** 只能訪問本城市的數據,
**So that** 確保數據隔離和安全。

---

## Acceptance Criteria

### AC1: 自動數據過濾

**Given** 城市用戶（Data Processor）已登入
**When** 查詢任何業務數據（發票、提取結果、審計記錄）
**Then** 系統自動過濾，僅返回該用戶所屬城市的數據
**And** 無法通過任何方式訪問其他城市數據

### AC2: 直接訪問防護

**Given** 城市用戶嘗試直接存取其他城市的資源
**When** 通過 URL 或 API 指定其他城市的資源 ID
**Then** 系統返回 403 Forbidden 或空結果
**And** 記錄此次存取嘗試至安全日誌

### AC3: 統計數據隔離

**Given** 城市用戶查看統計數據
**When** 載入儀表板
**Then** 所有統計僅反映該城市的數據
**And** 不顯示跨城市匯總選項

### AC4: UI 城市標識

**Given** 城市用戶使用系統
**When** 查看頁面
**Then** 顯示當前城市標識
**And** 不顯示城市切換選項

---

## Tasks / Subtasks

- [ ] **Task 1: 用戶城市綁定** (AC: #1)
  - [ ] 1.1 在用戶創建時指定城市
  - [ ] 1.2 在登入時載入城市資訊
  - [ ] 1.3 將城市資訊存入 session
  - [ ] 1.4 在 JWT token 包含城市代碼

- [ ] **Task 2: API 層過濾** (AC: #1)
  - [ ] 2.1 創建 `withCityFilter` API middleware
  - [ ] 2.2 自動注入城市過濾條件
  - [ ] 2.3 處理關聯查詢的城市過濾
  - [ ] 2.4 驗證新增數據的城市歸屬

- [ ] **Task 3: 資源訪問驗證** (AC: #2)
  - [ ] 3.1 創建 `validateResourceAccess` 函數
  - [ ] 3.2 在 API 路由檢查資源城市
  - [ ] 3.3 處理跨城市訪問嘗試
  - [ ] 3.4 返回適當的錯誤響應

- [ ] **Task 4: 安全日誌記錄** (AC: #2)
  - [ ] 4.1 創建安全事件日誌表
  - [ ] 4.2 記錄跨城市訪問嘗試
  - [ ] 4.3 包含用戶、資源、時間資訊
  - [ ] 4.4 設置告警閾值

- [ ] **Task 5: 儀表板數據隔離** (AC: #3)
  - [ ] 5.1 修改儀表板 API 添加城市過濾
  - [ ] 5.2 確保所有統計查詢包含城市條件
  - [ ] 5.3 隱藏跨城市匯總功能
  - [ ] 5.4 驗證圖表數據正確性

- [ ] **Task 6: UI 城市顯示** (AC: #4)
  - [ ] 6.1 在導航欄顯示城市標識
  - [ ] 6.2 創建城市 Badge 組件
  - [ ] 6.3 在頁面標題顯示城市名稱
  - [ ] 6.4 移除城市切換選項（對城市用戶）

- [ ] **Task 7: Session 城市管理** (AC: #1, #4)
  - [ ] 7.1 擴展 NextAuth session 類型
  - [ ] 7.2 在登入時獲取用戶城市
  - [ ] 7.3 提供 useUserCity hook
  - [ ] 7.4 處理城市變更（管理員操作）

- [ ] **Task 8: 測試與驗證** (AC: #1-4)
  - [ ] 8.1 測試數據自動過濾
  - [ ] 8.2 測試直接訪問防護
  - [ ] 8.3 測試統計數據隔離
  - [ ] 8.4 測試安全日誌記錄
  - [ ] 8.5 滲透測試

---

## Dev Notes

### 依賴項

- **Story 6.1**: 城市數據模型與 RLS

### Architecture Compliance

```typescript
// types/next-auth.d.ts - 擴展 Session 類型
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      cityCodes: string[]      // 用戶授權城市列表
      primaryCityCode: string  // 主要城市
      isGlobalAdmin: boolean   // 是否為全局管理者
      isRegionalManager: boolean // 是否為區域經理
    } & DefaultSession['user']
  }

  interface User {
    cityCodes: string[]
    primaryCityCode: string
    isGlobalAdmin: boolean
    isRegionalManager: boolean
  }
}
```

```typescript
// src/lib/auth.ts - NextAuth 配置擴展
import NextAuth from 'next-auth'
import { getUserCityCodes } from '@/lib/city-access'

export const { handlers, auth, signIn, signOut } = NextAuth({
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // 登入時獲取用戶城市
        const cityCodes = await getUserCityCodes(user.id)
        token.cityCodes = cityCodes
        token.primaryCityCode = cityCodes[0] || null
        token.isGlobalAdmin = user.roles?.some(r => r.name === 'GLOBAL_ADMIN')
        token.isRegionalManager = user.roles?.some(r => r.name === 'REGIONAL_MANAGER')
      }
      return token
    },
    async session({ session, token }) {
      session.user.cityCodes = token.cityCodes as string[]
      session.user.primaryCityCode = token.primaryCityCode as string
      session.user.isGlobalAdmin = token.isGlobalAdmin as boolean
      session.user.isRegionalManager = token.isRegionalManager as boolean
      return session
    },
  },
})
```

```typescript
// src/middleware/city-filter.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// API 中間件：驗證並過濾城市數據
export async function withCityFilter(
  request: NextRequest,
  handler: (req: NextRequest, cityFilter: CityFilter) => Promise<NextResponse>
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const cityFilter: CityFilter = {
    isGlobalAdmin: session.user.isGlobalAdmin,
    cityCodes: session.user.cityCodes,
    primaryCityCode: session.user.primaryCityCode,
  }

  return handler(request, cityFilter)
}

interface CityFilter {
  isGlobalAdmin: boolean
  cityCodes: string[]
  primaryCityCode: string
}

// 構建 Prisma where 條件
export function buildCityWhereClause(
  cityFilter: CityFilter,
  fieldName: string = 'cityCode'
): Record<string, unknown> {
  if (cityFilter.isGlobalAdmin) {
    return {} // 全局管理者不需要過濾
  }

  if (cityFilter.cityCodes.length === 1) {
    return { [fieldName]: cityFilter.cityCodes[0] }
  }

  return { [fieldName]: { in: cityFilter.cityCodes } }
}
```

```typescript
// src/middleware/resource-access.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 驗證資源訪問權限
export async function validateResourceAccess(
  resourceType: 'document' | 'escalation' | 'correction',
  resourceId: string
): Promise<{ allowed: boolean; cityCode?: string }> {
  const session = await auth()

  if (!session?.user) {
    return { allowed: false }
  }

  // 全局管理者有完整訪問權限
  if (session.user.isGlobalAdmin) {
    return { allowed: true }
  }

  // 查詢資源的城市歸屬
  let cityCode: string | null = null

  switch (resourceType) {
    case 'document':
      const doc = await prisma.document.findUnique({
        where: { id: resourceId },
        select: { cityCode: true },
      })
      cityCode = doc?.cityCode || null
      break

    case 'escalation':
      const esc = await prisma.escalation.findUnique({
        where: { id: resourceId },
        include: { document: { select: { cityCode: true } } },
      })
      cityCode = esc?.document?.cityCode || null
      break

    case 'correction':
      const cor = await prisma.correction.findUnique({
        where: { id: resourceId },
        include: { document: { select: { cityCode: true } } },
      })
      cityCode = cor?.document?.cityCode || null
      break
  }

  if (!cityCode) {
    return { allowed: false }
  }

  const allowed = session.user.cityCodes.includes(cityCode)

  // 記錄未授權的訪問嘗試
  if (!allowed) {
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resourceType,
      resourceId,
      resourceCityCode: cityCode,
      userCityCodes: session.user.cityCodes,
    })
  }

  return { allowed, cityCode }
}

// 記錄安全事件
async function logSecurityEvent(event: SecurityEvent) {
  await prisma.securityLog.create({
    data: {
      userId: event.userId,
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      details: {
        resourceCityCode: event.resourceCityCode,
        userCityCodes: event.userCityCodes,
        timestamp: new Date().toISOString(),
      },
      severity: 'MEDIUM',
      ipAddress: event.ipAddress,
    },
  })
}

interface SecurityEvent {
  userId: string
  eventType: string
  resourceType: string
  resourceId: string
  resourceCityCode: string
  userCityCodes: string[]
  ipAddress?: string
}
```

```typescript
// src/app/api/documents/[id]/route.ts - 使用示例
import { NextRequest, NextResponse } from 'next/server'
import { validateResourceAccess } from '@/middleware/resource-access'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 驗證資源訪問權限
  const access = await validateResourceAccess('document', params.id)

  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    )
  }

  // RLS 會自動過濾，但我們已經驗證過了
  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      extractionResults: true,
      corrections: true,
    },
  })

  if (!document) {
    return NextResponse.json(
      { success: false, error: 'Document not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: document,
  })
}
```

```typescript
// src/hooks/useUserCity.ts
'use client'

import { useSession } from 'next-auth/react'
import { useMemo } from 'react'

interface UseUserCityReturn {
  cityCodes: string[]
  primaryCityCode: string | null
  isGlobalAdmin: boolean
  isRegionalManager: boolean
  isSingleCity: boolean
  canAccessCity: (cityCode: string) => boolean
}

export function useUserCity(): UseUserCityReturn {
  const { data: session } = useSession()

  return useMemo(() => {
    const cityCodes = session?.user?.cityCodes || []
    const primaryCityCode = session?.user?.primaryCityCode || null
    const isGlobalAdmin = session?.user?.isGlobalAdmin || false
    const isRegionalManager = session?.user?.isRegionalManager || false

    return {
      cityCodes,
      primaryCityCode,
      isGlobalAdmin,
      isRegionalManager,
      isSingleCity: cityCodes.length === 1 && !isGlobalAdmin,
      canAccessCity: (cityCode: string) =>
        isGlobalAdmin || cityCodes.includes(cityCode),
    }
  }, [session])
}
```

```typescript
// src/components/layout/CityIndicator.tsx
'use client'

import { useUserCity } from '@/hooks/useUserCity'
import { Badge } from '@/components/ui/badge'
import { MapPin } from 'lucide-react'

export function CityIndicator() {
  const { primaryCityCode, isSingleCity, isGlobalAdmin, isRegionalManager } = useUserCity()

  if (isGlobalAdmin) {
    return (
      <Badge variant="secondary" className="gap-1">
        <MapPin className="h-3 w-3" />
        全球
      </Badge>
    )
  }

  if (isRegionalManager) {
    return (
      <Badge variant="secondary" className="gap-1">
        <MapPin className="h-3 w-3" />
        區域
      </Badge>
    )
  }

  if (isSingleCity && primaryCityCode) {
    return (
      <Badge variant="outline" className="gap-1">
        <MapPin className="h-3 w-3" />
        {primaryCityCode}
      </Badge>
    )
  }

  return null
}
```

```prisma
// 安全日誌模型
model SecurityLog {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  eventType   String   @map("event_type")
  resourceType String? @map("resource_type")
  resourceId  String?  @map("resource_id")
  details     Json?
  severity    SecuritySeverity @default(LOW)
  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")
  createdAt   DateTime @default(now()) @map("created_at")

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([eventType])
  @@index([severity])
  @@index([createdAt])
  @@map("security_logs")
}

enum SecuritySeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 安全考量

- **多層防護**: RLS + API 層驗證 + UI 隱藏
- **審計追蹤**: 所有跨城市訪問嘗試都記錄
- **最小權限**: 用戶只能訪問明確授權的城市
- **防禦縱深**: 即使繞過一層，其他層仍能阻止

### References

- [Source: docs/03-epics/sections/epic-6-multi-city-data-isolation.md#story-62]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR44]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 6.2 |
| Story Key | 6-2-city-user-data-access-control |
| Epic | Epic 6: 多城市數據隔離 |
| FR Coverage | FR44 |
| Dependencies | Story 6.1 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
