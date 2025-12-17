# Story 1-3: User List & Search - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-3-user-list-search

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.3 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Medium |
| Dependencies | Story 1.0, 1.1, 1.2 |
| Blocking | Story 1.4 ~ 1.8 |
| FR Coverage | FR37 |

---

## Objective

Implement a comprehensive user management interface that allows system administrators to view, search, and filter all system users with pagination support.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | User list display | DataTable with user info columns |
| AC2 | Pagination (20 per page) | Server-side pagination with React Query |
| AC3 | Search by name/email | Debounced search with URL state |
| AC4 | Filter by role/city/status | Multi-select dropdowns |
| AC5 | Skeleton loading state | Suspense + Skeleton components |

---

## Implementation Guide

### Phase 1: Database Schema Update (10 min)

No schema changes required. Uses existing User, Role, UserRole models from Story 1-2.

**Verify existing schema supports:**
- User with roles relation
- UserRole with cityId for city filtering
- lastLoginAt field (add if missing)

```prisma
// Update User model if lastLoginAt is missing
model User {
  // ... existing fields
  lastLoginAt DateTime? @map("last_login_at")
}
```

---

### Phase 2: Service Layer (20 min)

#### Step 2.1: User Service Extension

Update `src/services/user.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { UserStatus, Prisma } from '@prisma/client'

// ===========================================
// Types
// ===========================================

export interface GetUsersParams {
  page: number
  pageSize: number
  search?: string
  roleId?: string
  cityId?: string
  status?: UserStatus
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastLoginAt'
  sortOrder?: 'asc' | 'desc'
}

export interface UsersResult {
  data: UserWithRoles[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface UserWithRoles {
  id: string
  email: string
  name: string
  image: string | null
  status: UserStatus
  createdAt: Date
  lastLoginAt: Date | null
  roles: {
    role: {
      id: string
      name: string
    }
    cityId: string | null
    city?: {
      id: string
      name: string
      code: string
    } | null
  }[]
}

// ===========================================
// Functions
// ===========================================

export async function getUsers(params: GetUsersParams): Promise<UsersResult> {
  const {
    page = 1,
    pageSize = 20,
    search,
    roleId,
    cityId,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params

  // Build where clause
  const where: Prisma.UserWhereInput = {
    // Search filter
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
    // Role filter
    ...(roleId && {
      roles: { some: { roleId } },
    }),
    // City filter
    ...(cityId && {
      roles: { some: { cityId } },
    }),
    // Status filter
    ...(status && { status }),
  }

  // Execute parallel queries for data and count
  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        roles: {
          include: {
            role: {
              select: { id: true, name: true },
            },
            city: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return {
    data: data as UserWithRoles[],
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getUserById(id: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: { select: { id: true, name: true } },
          city: { select: { id: true, name: true, code: true } },
        },
      },
    },
  }) as Promise<UserWithRoles | null>
}
```

---

### Phase 3: API Endpoint (20 min)

#### Step 3.1: Create Users API Route

Create `src/app/api/admin/users/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUsers, type GetUsersParams } from '@/services/user.service'
import { PERMISSIONS } from '@/types/permissions'
import type { UserStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { title: 'Unauthorized', status: 401 },
        },
        { status: 401 }
      )
    }

    // Check permission
    const hasPermission = session.user.roles?.some((role) =>
      role.permissions.includes(PERMISSIONS.USER_VIEW)
    )

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: { title: 'Forbidden', status: 403, detail: 'USER_VIEW permission required' },
        },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params: GetUsersParams = {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      search: searchParams.get('search') || undefined,
      roleId: searchParams.get('roleId') || undefined,
      cityId: searchParams.get('cityId') || undefined,
      status: (searchParams.get('status') as UserStatus) || undefined,
      sortBy: (searchParams.get('sortBy') as GetUsersParams['sortBy']) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as GetUsersParams['sortOrder']) || 'desc',
    }

    // Validate pagination
    if (params.page < 1) params.page = 1
    if (params.pageSize < 1 || params.pageSize > 100) params.pageSize = 20

    const result = await getUsers(params)

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta,
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch users',
        },
      },
      { status: 500 }
    )
  }
}
```

---

### Phase 4: React Query Hook (15 min)

#### Step 4.1: Create useUsers Hook

Create `src/hooks/useUsers.ts`:

```typescript
'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { UserStatus } from '@prisma/client'

// ===========================================
// Types
// ===========================================

export interface UseUsersParams {
  page: number
  pageSize?: number
  search?: string
  roleId?: string
  cityId?: string
  status?: UserStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface UserListItem {
  id: string
  email: string
  name: string
  image: string | null
  status: UserStatus
  createdAt: string
  lastLoginAt: string | null
  roles: {
    role: { id: string; name: string }
    city?: { id: string; name: string; code: string } | null
  }[]
}

interface UsersResponse {
  success: boolean
  data?: UserListItem[]
  meta?: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  error?: {
    title: string
    status: number
    detail?: string
  }
}

// ===========================================
// Fetch Function
// ===========================================

async function fetchUsers(params: UseUsersParams): Promise<UsersResponse> {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const response = await fetch(`/api/admin/users?${searchParams}`)
  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to fetch users')
  }

  return json
}

// ===========================================
// Hook
// ===========================================

export function useUsers(params: UseUsersParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => fetchUsers(params),
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: keepPreviousData, // Keep previous data while fetching
  })
}
```

---

### Phase 5: UI Components (45 min)

#### Step 5.1: User List Page

Create `src/app/(dashboard)/admin/users/page.tsx`:

```typescript
import { Suspense } from 'react'
import { UserList } from '@/components/features/admin/UserList'
import { UserListSkeleton } from '@/components/features/admin/UserListSkeleton'

export const metadata = {
  title: 'User Management | AI Document Extraction',
}

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage system users, roles, and permissions
          </p>
        </div>
      </div>

      <Suspense fallback={<UserListSkeleton />}>
        <UserList />
      </Suspense>
    </div>
  )
}
```

#### Step 5.2: User List Component

Create `src/components/features/admin/UserList.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useUsers, type UseUsersParams } from '@/hooks/useUsers'
import { UserSearchBar } from './UserSearchBar'
import { UserFilters } from './UserFilters'
import { UserTable } from './UserTable'
import { UserListSkeleton } from './UserListSkeleton'
import { Pagination } from '@/components/ui/pagination'
import { Card, CardContent } from '@/components/ui/card'

export function UserList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Parse URL params
  const params: UseUsersParams = {
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: 20,
    search: searchParams.get('search') || undefined,
    roleId: searchParams.get('roleId') || undefined,
    cityId: searchParams.get('cityId') || undefined,
    status: (searchParams.get('status') as UseUsersParams['status']) || undefined,
  }

  const { data, isLoading, error } = useUsers(params)

  // Update URL params
  const updateParams = useCallback(
    (newParams: Partial<UseUsersParams>) => {
      const current = new URLSearchParams(searchParams.toString())

      Object.entries(newParams).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          current.delete(key)
        } else {
          current.set(key, String(value))
        }
      })

      // Reset page when filters change
      if ('search' in newParams || 'roleId' in newParams || 'cityId' in newParams || 'status' in newParams) {
        current.set('page', '1')
      }

      router.push(`${pathname}?${current.toString()}`)
    },
    [router, pathname, searchParams]
  )

  if (isLoading) {
    return <UserListSkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-red-500">Failed to load users. Please try again.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <UserSearchBar
          value={params.search || ''}
          onChange={(search) => updateParams({ search })}
        />
        <UserFilters
          roleId={params.roleId}
          cityId={params.cityId}
          status={params.status}
          onChange={updateParams}
        />
      </div>

      {/* User Table */}
      <UserTable users={data?.data || []} />

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={(page) => updateParams({ page })}
          />
        </div>
      )}

      {/* Result Summary */}
      {data?.meta && (
        <p className="text-center text-sm text-muted-foreground">
          Showing {data.data?.length || 0} of {data.meta.total} users
        </p>
      )}
    </div>
  )
}
```

#### Step 5.3: User Table Component

Create `src/components/features/admin/UserTable.tsx`:

```typescript
'use client'

import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { UserListItem } from '@/hooks/useUsers'

interface UserTableProps {
  users: UserListItem[]
}

export function UserTable({ users }: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No users found
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">User</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              {/* User Info */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image || undefined} alt={user.name} />
                    <AvatarFallback>
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              </TableCell>

              {/* Roles */}
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((userRole, index) => (
                    <Badge key={index} variant="secondary">
                      {userRole.role.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>

              {/* City */}
              <TableCell>
                {user.roles[0]?.city ? (
                  <span>{user.roles[0].city.name}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {user.status}
                </Badge>
              </TableCell>

              {/* Last Login */}
              <TableCell className="text-muted-foreground">
                {user.lastLoginAt
                  ? formatDistanceToNow(new Date(user.lastLoginAt), {
                      addSuffix: true,
                      locale: zhTW,
                    })
                  : 'Never'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

#### Step 5.4: Search Bar Component

Create `src/components/features/admin/UserSearchBar.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'

interface UserSearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function UserSearchBar({ value, onChange }: UserSearchBarProps) {
  const [inputValue, setInputValue] = useState(value)
  const debouncedValue = useDebounce(inputValue, 300)

  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue)
    }
  }, [debouncedValue, onChange, value])

  useEffect(() => {
    setInputValue(value)
  }, [value])

  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search by name or email..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}
```

#### Step 5.5: useDebounce Hook

Create `src/hooks/useDebounce.ts`:

```typescript
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
```

#### Step 5.6: Filters Component

Create `src/components/features/admin/UserFilters.tsx`:

```typescript
'use client'

import { useRoles } from '@/hooks/useRoles'
import { useCities } from '@/hooks/useCities'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { UserStatus } from '@prisma/client'

interface UserFiltersProps {
  roleId?: string
  cityId?: string
  status?: UserStatus
  onChange: (params: { roleId?: string; cityId?: string; status?: UserStatus }) => void
}

export function UserFilters({ roleId, cityId, status, onChange }: UserFiltersProps) {
  const { data: rolesData } = useRoles()
  const { data: citiesData } = useCities()

  const hasFilters = roleId || cityId || status

  const clearFilters = () => {
    onChange({ roleId: undefined, cityId: undefined, status: undefined })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Role Filter */}
      <Select
        value={roleId || 'all'}
        onValueChange={(value) => onChange({ roleId: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          {rolesData?.data?.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* City Filter */}
      <Select
        value={cityId || 'all'}
        onValueChange={(value) => onChange({ cityId: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Cities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cities</SelectItem>
          {citiesData?.data?.map((city) => (
            <SelectItem key={city.id} value={city.id}>
              {city.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={status || 'all'}
        onValueChange={(value) =>
          onChange({ status: value === 'all' ? undefined : (value as UserStatus) })
        }
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="INACTIVE">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
```

#### Step 5.7: Skeleton Component

Create `src/components/features/admin/UserListSkeleton.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export function UserListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search and Filters Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full sm:w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {/* Header */}
            <div className="flex gap-4 p-4">
              <Skeleton className="h-4 w-[300px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>

            {/* Rows */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[200px]" />
                  </div>
                </div>
                <Skeleton className="h-5 w-[80px]" />
                <Skeleton className="h-4 w-[60px]" />
                <Skeleton className="h-5 w-[60px]" />
                <Skeleton className="h-4 w-[80px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

### Phase 6: Cities Hook & API (15 min)

#### Step 6.1: Create useCities Hook

Create `src/hooks/useCities.ts`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

interface City {
  id: string
  code: string
  name: string
  region: string | null
}

interface CitiesResponse {
  success: boolean
  data?: City[]
}

async function fetchCities(): Promise<CitiesResponse> {
  const response = await fetch('/api/cities')
  return response.json()
}

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

#### Step 6.2: Create Cities API

Create `src/app/api/cities/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { title: 'Unauthorized', status: 401 } },
        { status: 401 }
      )
    }

    const cities = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        region: true,
      },
    })

    return NextResponse.json({ success: true, data: cities })
  } catch (error) {
    console.error('Get cities error:', error)
    return NextResponse.json(
      { success: false, error: { title: 'Internal Server Error', status: 500 } },
      { status: 500 }
    )
  }
}
```

---

### Phase 7: Additional UI Components (20 min)

#### Step 7.1: Add Pagination Component

If not already available from shadcn/ui, create `src/components/ui/pagination.tsx`:

```typescript
'use client'

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = generatePageNumbers(currentPage, totalPages)

  return (
    <nav className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((page, index) => {
        if (page === 'ellipsis') {
          return (
            <Button key={`ellipsis-${index}`} variant="ghost" size="icon" disabled>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )
        }

        return (
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'outline'}
            size="icon"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        )
      })}

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}

function generatePageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 5, 'ellipsis', total]
  }

  if (current >= total - 2) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  }

  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}
```

#### Step 7.2: Add Avatar Component

```bash
npx shadcn@latest add avatar
```

---

## Verification Checklist

### Functionality

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| List display | Navigate to /admin/users | Shows user table with columns | [ ] |
| Pagination | Have 25+ users, click page 2 | Shows users 21-40 | [ ] |
| Search | Type "john" in search | Filters to matching users | [ ] |
| Role filter | Select "Data Processor" | Shows only Data Processors | [ ] |
| City filter | Select "Taipei" | Shows only Taipei users | [ ] |
| Status filter | Select "Inactive" | Shows only inactive users | [ ] |
| Combined filters | Search + Role + Status | Correct intersection | [ ] |
| Clear filters | Click clear button | All filters reset | [ ] |
| Loading state | Slow network | Shows skeleton | [ ] |
| Empty state | No matching results | Shows "No users found" | [ ] |

### Permission

| Test Case | User Role | Expected Result | Status |
|-----------|-----------|-----------------|--------|
| Access page | System Admin | Full access | [ ] |
| Access page | Data Processor | 403 Forbidden | [ ] |
| Access API | No auth | 401 Unauthorized | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/services/user.service.ts` | Extended with getUsers |
| `src/app/api/admin/users/route.ts` | Users list API |
| `src/app/api/cities/route.ts` | Cities API |
| `src/app/(dashboard)/admin/users/page.tsx` | Users page |
| `src/components/features/admin/UserList.tsx` | Main list component |
| `src/components/features/admin/UserTable.tsx` | Table component |
| `src/components/features/admin/UserSearchBar.tsx` | Search component |
| `src/components/features/admin/UserFilters.tsx` | Filters component |
| `src/components/features/admin/UserListSkeleton.tsx` | Skeleton component |
| `src/hooks/useUsers.ts` | Users query hook |
| `src/hooks/useCities.ts` | Cities query hook |
| `src/hooks/useDebounce.ts` | Debounce utility hook |
| `src/components/ui/pagination.tsx` | Pagination component |

---

## Next Steps

After completing Story 1-3:
1. Proceed to **Story 1-4** (Add User & Role Assignment)
2. Add "Add User" button to the users page
3. Implement user creation dialog

---

*Generated by BMAD Method - Create Tech Spec Workflow*
