# Story 1-8: City Manager User Management - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-8-city-manager-user-management

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.8 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Medium-Large |
| Dependencies | Story 1.3 ~ 1.6 |
| Blocking | None |
| FR Coverage | FR42 |

---

## Objective

Implement city-scoped user management functionality that allows City Managers to manage users within their assigned city while preventing cross-city operations. System Administrators retain full access to all users regardless of city assignment.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | City-filtered user list | Automatic city filtering in API |
| AC2 | City-restricted user creation | City selector limited to assigned cities |
| AC3 | Cross-city operation blocking | Permission middleware + 403 responses |

---

## Implementation Guide

### Phase 1: City Data Model (20 min)

#### Step 1.1: Update Prisma Schema

Ensure `prisma/schema.prisma` includes City model:

```prisma
model City {
  id        String   @id @default(uuid())
  code      String   @unique                    // e.g., "TPE", "HKG"
  name      String                              // e.g., "台北", "香港"
  nameEn    String?  @map("name_en")            // e.g., "Taipei", "Hong Kong"
  region    String?                             // e.g., "Taiwan", "Greater China"
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  userRoles UserRole[]

  @@map("cities")
}

// Update UserRole to include City relation
model UserRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  roleId    String   @map("role_id")
  cityId    String?  @map("city_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role  @relation(fields: [roleId], references: [id], onDelete: Cascade)
  city City? @relation(fields: [cityId], references: [id])

  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@index([cityId])
  @@map("user_roles")
}
```

#### Step 1.2: Create City Seed Data

Create `prisma/seeds/cities.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const cities = [
  // Taiwan
  { code: 'TPE', name: '台北', nameEn: 'Taipei', region: 'Taiwan' },
  { code: 'KHH', name: '高雄', nameEn: 'Kaohsiung', region: 'Taiwan' },
  { code: 'TXG', name: '台中', nameEn: 'Taichung', region: 'Taiwan' },

  // Greater China
  { code: 'HKG', name: '香港', nameEn: 'Hong Kong', region: 'Greater China' },
  { code: 'SHA', name: '上海', nameEn: 'Shanghai', region: 'Greater China' },
  { code: 'PEK', name: '北京', nameEn: 'Beijing', region: 'Greater China' },
  { code: 'GZH', name: '廣州', nameEn: 'Guangzhou', region: 'Greater China' },

  // Southeast Asia
  { code: 'BKK', name: '曼谷', nameEn: 'Bangkok', region: 'Southeast Asia' },
  { code: 'SGP', name: '新加坡', nameEn: 'Singapore', region: 'Southeast Asia' },
  { code: 'KUL', name: '吉隆坡', nameEn: 'Kuala Lumpur', region: 'Southeast Asia' },
  { code: 'MNL', name: '馬尼拉', nameEn: 'Manila', region: 'Southeast Asia' },

  // Japan & Korea
  { code: 'TYO', name: '東京', nameEn: 'Tokyo', region: 'Japan' },
  { code: 'OSA', name: '大阪', nameEn: 'Osaka', region: 'Japan' },
  { code: 'SEL', name: '首爾', nameEn: 'Seoul', region: 'Korea' },

  // Oceania
  { code: 'SYD', name: '雪梨', nameEn: 'Sydney', region: 'Oceania' },
  { code: 'MEL', name: '墨爾本', nameEn: 'Melbourne', region: 'Oceania' },
  { code: 'AKL', name: '奧克蘭', nameEn: 'Auckland', region: 'Oceania' },
]

export async function seedCities() {
  console.log('Seeding cities...')

  for (const city of cities) {
    await prisma.city.upsert({
      where: { code: city.code },
      update: {
        name: city.name,
        nameEn: city.nameEn,
        region: city.region,
      },
      create: city,
    })
  }

  console.log(`Seeded ${cities.length} cities`)
}
```

---

### Phase 2: City Permission Middleware (30 min)

#### Step 2.1: Create City Permission Helper

Create `src/lib/auth/city-permission.ts`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'
import { AppError } from '@/lib/errors'

interface CityPermissionContext {
  userId: string
  userCityId: string | null
  hasFullAccess: boolean
  hasCityAccess: boolean
}

/**
 * Get the current user's city permission context
 */
export async function getCityPermissionContext(): Promise<CityPermissionContext> {
  const session = await auth()

  if (!session?.user) {
    throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
  }

  const userPermissions = session.user.roles.flatMap((r) => r.permissions)
  const hasFullAccess = userPermissions.includes(PERMISSIONS.USER_MANAGE)
  const hasCityAccess = userPermissions.includes(PERMISSIONS.USER_MANAGE_CITY)

  // Get user's assigned city
  const userCity = session.user.roles.find((r) => r.cityId)?.cityId ?? null

  return {
    userId: session.user.id,
    userCityId: userCity,
    hasFullAccess,
    hasCityAccess,
  }
}

/**
 * Check if the current user can manage the target user
 */
export async function checkCityManagePermission(
  targetUserId: string
): Promise<void> {
  const context = await getCityPermissionContext()

  // System Admin can manage all users
  if (context.hasFullAccess) {
    return
  }

  // City Manager can only manage users in their city
  if (context.hasCityAccess) {
    const targetUserCity = await getUserCityId(targetUserId)

    if (!context.userCityId) {
      throw new AppError(
        'forbidden',
        'No City Assigned',
        403,
        'You do not have a city assignment. Please contact your administrator.'
      )
    }

    if (targetUserCity !== context.userCityId) {
      throw new AppError(
        'forbidden',
        'Access Denied',
        403,
        'You can only manage users in your assigned city'
      )
    }

    return
  }

  throw new AppError(
    'forbidden',
    'Insufficient Permissions',
    403,
    'You do not have permission to manage users'
  )
}

/**
 * Check if the current user can create a user in the specified city
 */
export async function checkCityCreatePermission(
  targetCityId: string | null
): Promise<void> {
  const context = await getCityPermissionContext()

  // System Admin can create users in any city
  if (context.hasFullAccess) {
    return
  }

  // City Manager can only create users in their city
  if (context.hasCityAccess) {
    if (!context.userCityId) {
      throw new AppError(
        'forbidden',
        'No City Assigned',
        403,
        'You do not have a city assignment'
      )
    }

    if (targetCityId !== context.userCityId) {
      throw new AppError(
        'forbidden',
        'Invalid City Selection',
        403,
        'You can only create users in your assigned city'
      )
    }

    return
  }

  throw new AppError(
    'forbidden',
    'Insufficient Permissions',
    403,
    'You do not have permission to create users'
  )
}

/**
 * Get the city filter for user queries
 * Returns null if no filter needed (full access)
 */
export async function getCityFilter(): Promise<string | null> {
  const context = await getCityPermissionContext()

  // System Admin sees all users
  if (context.hasFullAccess) {
    return null
  }

  // City Manager sees only their city's users
  if (context.hasCityAccess) {
    if (!context.userCityId) {
      throw new AppError(
        'forbidden',
        'No City Assigned',
        403,
        'You do not have a city assignment'
      )
    }
    return context.userCityId
  }

  throw new AppError(
    'forbidden',
    'Insufficient Permissions',
    403,
    'You do not have permission to view users'
  )
}

/**
 * Get a user's city ID
 */
async function getUserCityId(userId: string): Promise<string | null> {
  const userRole = await prisma.userRole.findFirst({
    where: { userId },
    select: { cityId: true },
  })

  return userRole?.cityId ?? null
}

/**
 * Get available cities for the current user
 * System Admin: all cities
 * City Manager: only their assigned city
 */
export async function getAvailableCities(): Promise<Array<{
  id: string
  code: string
  name: string
  region: string | null
}>> {
  const context = await getCityPermissionContext()

  // System Admin gets all active cities
  if (context.hasFullAccess) {
    return prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, region: true },
      orderBy: [{ region: 'asc' }, { name: 'asc' }],
    })
  }

  // City Manager gets only their city
  if (context.hasCityAccess && context.userCityId) {
    return prisma.city.findMany({
      where: {
        id: context.userCityId,
        isActive: true,
      },
      select: { id: true, code: true, name: true, region: true },
    })
  }

  return []
}
```

---

### Phase 3: Update User API for City Filtering (25 min)

#### Step 3.1: Update GET /api/admin/users

Update `src/app/api/admin/users/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUsers, createUser } from '@/services/user.service'
import { getCityFilter, checkCityCreatePermission } from '@/lib/auth/city-permission'
import { createUserSchema } from '@/lib/validations/user'
import { AppError, handleApiError, createErrorResponse } from '@/lib/errors'
import { PERMISSIONS, hasPermission } from '@/lib/auth/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    // Check basic view permission
    if (!hasPermission(session.user, PERMISSIONS.USER_VIEW)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || undefined
    const roleId = searchParams.get('roleId') || undefined
    const status = searchParams.get('status') as 'ACTIVE' | 'INACTIVE' | undefined
    const sortBy = (searchParams.get('sortBy') as any) || 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

    // Get city filter based on user's permissions
    // This will automatically filter for City Managers
    const cityFilter = await getCityFilter()

    // Use cityFilter if present, otherwise use query param (for System Admin filtering)
    const cityId = cityFilter || searchParams.get('cityId') || undefined

    const result = await getUsers({
      page,
      pageSize,
      search,
      roleId,
      cityId,
      status,
      sortBy,
      sortOrder,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    // Check if user has any user management permission
    const hasFullAccess = hasPermission(session.user, PERMISSIONS.USER_MANAGE)
    const hasCityAccess = hasPermission(session.user, PERMISSIONS.USER_MANAGE_CITY)

    if (!hasFullAccess && !hasCityAccess) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const body = await request.json()

    // Validate request body
    const validationResult = createUserSchema.safeParse(body)
    if (!validationResult.success) {
      return createErrorResponse(
        'validation_error',
        'Validation Failed',
        400,
        validationResult.error.errors.map(e => e.message).join(', ')
      )
    }

    // Check city create permission
    await checkCityCreatePermission(validationResult.data.cityId ?? null)

    // Create user
    const user = await createUser(validationResult.data)

    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

#### Step 3.2: Update PATCH/Status Endpoints

Update `src/app/api/admin/users/[id]/route.ts` to include city permission check:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { updateUser, getUserById } from '@/services/user.service'
import { checkCityManagePermission, checkCityCreatePermission } from '@/lib/auth/city-permission'
import { updateUserSchema } from '@/lib/validations/user'
import { logUserChange } from '@/lib/audit/logger'
import { AppError, handleApiError, createErrorResponse } from '@/lib/errors'
import { PERMISSIONS, hasPermission } from '@/lib/auth/permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    // Check basic permission
    const hasFullAccess = hasPermission(session.user, PERMISSIONS.USER_MANAGE)
    const hasCityAccess = hasPermission(session.user, PERMISSIONS.USER_MANAGE_CITY)

    if (!hasFullAccess && !hasCityAccess) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const { id } = await params

    // Check city permission for target user
    await checkCityManagePermission(id)

    const body = await request.json()

    // Validate request body
    const validationResult = updateUserSchema.safeParse(body)
    if (!validationResult.success) {
      return createErrorResponse(
        'validation_error',
        'Validation Failed',
        400,
        validationResult.error.errors.map(e => e.message).join(', ')
      )
    }

    // If changing city, check permission for target city
    if (validationResult.data.cityId !== undefined) {
      await checkCityCreatePermission(validationResult.data.cityId)
    }

    // Get current user for audit
    const currentUser = await getUserById(id)
    if (!currentUser) {
      throw new AppError('not_found', 'User Not Found', 404, 'User does not exist')
    }

    // Update user
    const updatedUser = await updateUser(id, validationResult.data)

    // Log changes (similar to Story 1-5)
    // ... audit logging code ...

    return NextResponse.json({ success: true, data: updatedUser })
  } catch (error) {
    return handleApiError(error)
  }
}
```

Update `src/app/api/admin/users/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { updateUserStatus, getUserById } from '@/services/user.service'
import { checkCityManagePermission } from '@/lib/auth/city-permission'
import { logUserChange } from '@/lib/audit/logger'
import { AppError, handleApiError, createErrorResponse } from '@/lib/errors'
import { PERMISSIONS, hasPermission } from '@/lib/auth/permissions'

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    // Check basic permission
    const hasFullAccess = hasPermission(session.user, PERMISSIONS.USER_MANAGE)
    const hasCityAccess = hasPermission(session.user, PERMISSIONS.USER_MANAGE_CITY)

    if (!hasFullAccess && !hasCityAccess) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const { id } = await params

    // Check city permission for target user
    await checkCityManagePermission(id)

    const body = await request.json()

    // Validate
    const validationResult = updateStatusSchema.safeParse(body)
    if (!validationResult.success) {
      return createErrorResponse(
        'validation_error',
        'Validation Failed',
        400,
        validationResult.error.errors.map(e => e.message).join(', ')
      )
    }

    const { status } = validationResult.data

    // Prevent self-disable
    if (id === session.user.id && status === 'INACTIVE') {
      throw new AppError(
        'bad_request',
        'Invalid Operation',
        400,
        'You cannot disable your own account'
      )
    }

    // Get current user for audit
    const currentUser = await getUserById(id)
    if (!currentUser) {
      throw new AppError('not_found', 'User Not Found', 404, 'User does not exist')
    }

    // Update status
    const updatedUser = await updateUserStatus(id, status)

    // Log audit
    await logUserChange({
      userId: id,
      action: 'UPDATE_STATUS',
      oldValue: currentUser.status,
      newValue: status,
      performedBy: session.user.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        status: updatedUser.status,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
```

---

### Phase 4: City API Endpoint (15 min)

#### Step 4.1: Create City API

Create `src/app/api/admin/cities/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAvailableCities } from '@/lib/auth/city-permission'
import { prisma } from '@/lib/prisma'
import { AppError, handleApiError } from '@/lib/errors'
import { PERMISSIONS, hasPermission } from '@/lib/auth/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    // Any user with user view permission can see cities
    // But the list will be filtered based on their role
    if (!hasPermission(session.user, PERMISSIONS.USER_VIEW)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    // If requesting all cities (for System Admin filtering UI)
    if (all && hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      const cities = await prisma.city.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          nameEn: true,
          region: true,
        },
        orderBy: [{ region: 'asc' }, { name: 'asc' }],
      })

      return NextResponse.json({ success: true, data: cities })
    }

    // Otherwise, return filtered cities based on user's permission
    const cities = await getAvailableCities()
    return NextResponse.json({ success: true, data: cities })
  } catch (error) {
    return handleApiError(error)
  }
}
```

---

### Phase 5: City Selector Component Update (20 min)

#### Step 5.1: Create Intelligent City Selector

Create `src/components/features/admin/CitySelector.tsx`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface City {
  id: string
  code: string
  name: string
  nameEn?: string
  region: string | null
}

interface CitySelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  allowClear?: boolean
  placeholder?: string
  showAll?: boolean  // For System Admin filter dropdown
}

export function CitySelector({
  value,
  onChange,
  disabled = false,
  allowClear = true,
  placeholder = 'Select a city',
  showAll = false,
}: CitySelectorProps) {
  const { data: cities = [], isLoading } = useQuery<City[]>({
    queryKey: ['cities', showAll],
    queryFn: async () => {
      const url = showAll ? '/api/admin/cities?all=true' : '/api/admin/cities'
      const response = await fetch(url)
      const result = await response.json()
      return result.data
    },
  })

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />
  }

  // Group cities by region
  const groupedCities = cities.reduce((acc, city) => {
    const region = city.region || 'Other'
    if (!acc[region]) {
      acc[region] = []
    }
    acc[region].push(city)
    return acc
  }, {} as Record<string, City[]>)

  // If only one city available, auto-select it
  if (cities.length === 1 && !value) {
    onChange(cities[0].id)
  }

  return (
    <Select
      value={value ?? 'none'}
      onValueChange={(v) => onChange(v === 'none' ? null : v)}
      disabled={disabled || cities.length === 0}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowClear && (
          <SelectItem value="none">
            {showAll ? 'All Cities' : 'No city assigned'}
          </SelectItem>
        )}
        {Object.entries(groupedCities).map(([region, regionCities]) => (
          <SelectGroup key={region}>
            <SelectLabel className="text-xs text-muted-foreground">
              {region}
            </SelectLabel>
            {regionCities.map((city) => (
              <SelectItem key={city.id} value={city.id}>
                {city.name} ({city.code})
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
```

#### Step 5.2: Update AddUserDialog with City Selector

Update `src/components/features/admin/AddUserDialog.tsx`:

```typescript
// ... existing imports ...
import { CitySelector } from './CitySelector'

// In the form JSX, replace the city select with:
<FormField
  control={form.control}
  name="cityId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>City Assignment</FormLabel>
      <FormControl>
        <CitySelector
          value={field.value ?? null}
          onChange={field.onChange}
          placeholder="Select a city (optional)"
        />
      </FormControl>
      <FormDescription>
        Required for City Manager role
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

### Phase 6: UI Permission Indicators (15 min)

#### Step 6.1: Create Permission Scope Indicator

Create `src/components/features/admin/PermissionScopeIndicator.tsx`:

```typescript
'use client'

import { useSession } from 'next-auth/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Globe, MapPin, Info } from 'lucide-react'
import { PERMISSIONS } from '@/types/permissions'

export function PermissionScopeIndicator() {
  const { data: session } = useSession()

  if (!session?.user) return null

  const userPermissions = session.user.roles.flatMap((r) => r.permissions)
  const hasFullAccess = userPermissions.includes(PERMISSIONS.USER_MANAGE)
  const hasCityAccess = userPermissions.includes(PERMISSIONS.USER_MANAGE_CITY)
  const userCity = session.user.roles.find((r) => r.cityName)?.cityName

  if (hasFullAccess) {
    return (
      <Alert className="mb-4 border-primary/20 bg-primary/5">
        <Globe className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Global Access
          <Badge variant="outline" className="font-normal">
            System Administrator
          </Badge>
        </AlertTitle>
        <AlertDescription>
          You can view and manage all users across all cities.
        </AlertDescription>
      </Alert>
    )
  }

  if (hasCityAccess && userCity) {
    return (
      <Alert className="mb-4 border-blue-500/20 bg-blue-500/5">
        <MapPin className="h-4 w-4 text-blue-500" />
        <AlertTitle className="flex items-center gap-2">
          City Scope: <span className="text-blue-600">{userCity}</span>
          <Badge variant="outline" className="font-normal">
            City Manager
          </Badge>
        </AlertTitle>
        <AlertDescription>
          You can only view and manage users assigned to {userCity}.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertTitle>View Only</AlertTitle>
      <AlertDescription>
        You have read-only access to user information.
      </AlertDescription>
    </Alert>
  )
}
```

#### Step 6.2: Update User List Page

Update `src/components/features/admin/UserList.tsx`:

```typescript
// Add import
import { PermissionScopeIndicator } from './PermissionScopeIndicator'

// Add at the top of the component's return:
export function UserList({ initialUsers }: UserListProps) {
  // ... existing code ...

  return (
    <>
      {/* Permission Scope Indicator */}
      <PermissionScopeIndicator />

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        {/* ... existing filters ... */}
      </div>

      {/* User Table */}
      {/* ... rest of the component ... */}
    </>
  )
}
```

---

### Phase 7: City Service Layer (15 min)

#### Step 7.1: Create City Service

Create `src/services/city.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'

export interface CityInfo {
  id: string
  code: string
  name: string
  nameEn: string | null
  region: string | null
  isActive: boolean
}

/**
 * Get all active cities
 */
export async function getCities(): Promise<CityInfo[]> {
  return prisma.city.findMany({
    where: { isActive: true },
    orderBy: [{ region: 'asc' }, { name: 'asc' }],
  })
}

/**
 * Get city by ID
 */
export async function getCityById(id: string): Promise<CityInfo | null> {
  return prisma.city.findUnique({
    where: { id },
  })
}

/**
 * Get city by code
 */
export async function getCityByCode(code: string): Promise<CityInfo | null> {
  return prisma.city.findUnique({
    where: { code },
  })
}

/**
 * Get cities by region
 */
export async function getCitiesByRegion(region: string): Promise<CityInfo[]> {
  return prisma.city.findMany({
    where: {
      region,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  })
}

/**
 * Get all unique regions
 */
export async function getRegions(): Promise<string[]> {
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { region: true },
    distinct: ['region'],
    orderBy: { region: 'asc' },
  })

  return cities
    .map((c) => c.region)
    .filter((r): r is string => r !== null)
}
```

---

## Project Structure

```
src/
├── app/
│   └── api/
│       └── admin/
│           ├── cities/
│           │   └── route.ts              # GET cities
│           └── users/
│               ├── route.ts              # Updated with city filter
│               └── [id]/
│                   ├── route.ts          # Updated with city check
│                   └── status/
│                       └── route.ts      # Updated with city check
├── components/
│   └── features/
│       └── admin/
│           ├── CitySelector.tsx          # City dropdown
│           └── PermissionScopeIndicator.tsx  # Scope display
├── lib/
│   └── auth/
│       └── city-permission.ts            # City permission logic
├── services/
│   └── city.service.ts                   # City data access
└── prisma/
    └── seeds/
        └── cities.ts                     # City seed data
```

---

## API Endpoints

### GET /api/admin/cities

Get available cities for current user.

**Query Parameters:**
- `all=true` - Return all cities (System Admin only)

**Response:**
```typescript
{
  success: true,
  data: Array<{
    id: string
    code: string
    name: string
    nameEn?: string
    region: string | null
  }>
}
```

---

## Permission Matrix

| Action | System Admin | City Manager | Regular User |
|--------|--------------|--------------|--------------|
| View all users | ✅ | ❌ (city only) | ❌ |
| View city users | ✅ | ✅ | ❌ |
| Create any user | ✅ | ❌ | ❌ |
| Create city user | ✅ | ✅ | ❌ |
| Edit any user | ✅ | ❌ | ❌ |
| Edit city user | ✅ | ✅ | ❌ |
| Change user city | ✅ | ❌ | ❌ |
| Disable any user | ✅ | ❌ | ❌ |
| Disable city user | ✅ | ✅ | ❌ |

---

## Verification Checklist

### City Filter Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| City Manager user list | Only city users shown | [ ] |
| System Admin user list | All users shown | [ ] |
| City filter (Admin) | Filter works correctly | [ ] |

### City Restriction Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| City Manager create user | Can only select own city | [ ] |
| City Manager edit other city user | Returns 403 | [ ] |
| City Manager disable other city user | Returns 403 | [ ] |
| System Admin edit any user | Works for all cities | [ ] |

### UI Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Permission scope indicator | Correct scope displayed | [ ] |
| City selector (Admin) | All cities available | [ ] |
| City selector (City Manager) | Only own city shown | [ ] |

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Story 1.0 | Project foundation | Required |
| Story 1.2 | User/Role schema | Required |
| Story 1.3 | User list | Required |
| Story 1.4 | User creation | Required |
| Story 1.5 | User editing | Required |
| Story 1.6 | User status | Required |

---

## Security Considerations

### Defense in Depth

1. **Frontend**: Hide/disable UI elements based on permissions
2. **API Route**: Check permissions before processing
3. **Service Layer**: Validate city access in business logic
4. **Database**: Use parameterized queries with city filter

### Cross-City Attack Prevention

```typescript
// Always verify city access server-side
await checkCityManagePermission(targetUserId)

// Never trust client-provided city IDs without validation
await checkCityCreatePermission(body.cityId)
```

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
