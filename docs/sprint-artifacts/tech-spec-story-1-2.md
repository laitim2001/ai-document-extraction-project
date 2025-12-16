# Story 1-2: User Database & Role Foundation - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-2-user-database-role-foundation

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.2 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Medium |
| Dependencies | Story 1.0, Story 1.1 |
| Blocking | Stories 1.3 ~ 1.8 (User Management features) |

---

## Objective

Establish a comprehensive Role-Based Access Control (RBAC) infrastructure with predefined system roles, permission definitions, and automatic role assignment for new users logging in via Azure AD.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | First login creates user with default role | signIn callback + UserRole creation |
| AC2 | 6 predefined system roles | Seed data with permission arrays |

---

## Role Definitions

### System Roles

| Role | Description | Default | Scope |
|------|-------------|---------|-------|
| System Admin | Full system access | No | Global |
| Super User | Rule and forwarder management | No | Global |
| Data Processor | Basic invoice processing | Yes (first login) | Global |
| City Manager | City-level management | No | City |
| Regional Manager | Multi-city management | No | Region |
| Auditor | Read-only audit access | No | Global |

### Permission Matrix

| Permission | Data Processor | City Manager | Regional Manager | Super User | Auditor | System Admin |
|------------|:-------------:|:------------:|:----------------:|:----------:|:-------:|:------------:|
| invoice:view | O | O | O | O | - | O |
| invoice:create | O | O | O | O | - | O |
| invoice:review | O | O | O | O | - | O |
| invoice:approve | - | O | O | O | - | O |
| report:view | - | O | O | O | O | O |
| report:export | - | O | O | O | O | O |
| rule:view | - | - | - | O | - | O |
| rule:manage | - | - | - | O | - | O |
| rule:approve | - | - | - | O | - | O |
| forwarder:view | - | O | O | O | - | O |
| forwarder:manage | - | - | - | O | - | O |
| user:view | - | O | O | - | - | O |
| user:manage | - | - | - | - | - | O |
| user:manage:city | - | O | - | - | - | O |
| user:manage:region | - | - | O | - | - | O |
| system:config | - | - | - | - | - | O |
| system:monitor | - | - | - | - | - | O |
| audit:view | - | - | - | - | O | O |
| audit:export | - | - | - | - | O | O |

---

## Implementation Guide

### Phase 1: Permission System (15 min)

#### Step 1.1: Create Permission Constants

Create `src/types/permissions.ts`:

```typescript
/**
 * Permission constants for the RBAC system.
 * All permissions follow the pattern: resource:action[:scope]
 */
export const PERMISSIONS = {
  // ===========================================
  // Invoice Operations
  // ===========================================
  INVOICE_VIEW: 'invoice:view',
  INVOICE_CREATE: 'invoice:create',
  INVOICE_REVIEW: 'invoice:review',
  INVOICE_APPROVE: 'invoice:approve',

  // ===========================================
  // Report Operations
  // ===========================================
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  // ===========================================
  // Rule Management
  // ===========================================
  RULE_VIEW: 'rule:view',
  RULE_MANAGE: 'rule:manage',
  RULE_APPROVE: 'rule:approve',

  // ===========================================
  // Forwarder Management
  // ===========================================
  FORWARDER_VIEW: 'forwarder:view',
  FORWARDER_MANAGE: 'forwarder:manage',

  // ===========================================
  // User Management
  // ===========================================
  USER_VIEW: 'user:view',
  USER_MANAGE: 'user:manage',
  USER_MANAGE_CITY: 'user:manage:city',
  USER_MANAGE_REGION: 'user:manage:region',

  // ===========================================
  // System Administration
  // ===========================================
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_MONITOR: 'system:monitor',

  // ===========================================
  // Audit Operations
  // ===========================================
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * Type guard to check if a string is a valid permission
 */
export function isValidPermission(value: string): value is Permission {
  return Object.values(PERMISSIONS).includes(value as Permission)
}

/**
 * Get all permissions as an array
 */
export function getAllPermissions(): Permission[] {
  return Object.values(PERMISSIONS)
}
```

#### Step 1.2: Create Role-Permission Mapping

Create `src/types/role-permissions.ts`:

```typescript
import { PERMISSIONS, type Permission } from './permissions'

/**
 * Role names in the system
 */
export const ROLE_NAMES = {
  SYSTEM_ADMIN: 'System Admin',
  SUPER_USER: 'Super User',
  DATA_PROCESSOR: 'Data Processor',
  CITY_MANAGER: 'City Manager',
  REGIONAL_MANAGER: 'Regional Manager',
  AUDITOR: 'Auditor',
} as const

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES]

/**
 * Default role for new users
 */
export const DEFAULT_ROLE: RoleName = ROLE_NAMES.DATA_PROCESSOR

/**
 * Role-Permission mapping configuration
 */
export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  [ROLE_NAMES.DATA_PROCESSOR]: [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
  ],

  [ROLE_NAMES.CITY_MANAGER]: [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE_CITY,
    PERMISSIONS.FORWARDER_VIEW,
  ],

  [ROLE_NAMES.REGIONAL_MANAGER]: [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE_REGION,
    PERMISSIONS.FORWARDER_VIEW,
  ],

  [ROLE_NAMES.SUPER_USER]: [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.RULE_VIEW,
    PERMISSIONS.RULE_MANAGE,
    PERMISSIONS.RULE_APPROVE,
    PERMISSIONS.FORWARDER_VIEW,
    PERMISSIONS.FORWARDER_MANAGE,
  ],

  [ROLE_NAMES.AUDITOR]: [
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
  ],

  [ROLE_NAMES.SYSTEM_ADMIN]: Object.values(PERMISSIONS),
} as const

/**
 * Role descriptions for display
 */
export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  [ROLE_NAMES.SYSTEM_ADMIN]: 'Full system access with all permissions',
  [ROLE_NAMES.SUPER_USER]: 'Can manage rules and forwarder configurations',
  [ROLE_NAMES.DATA_PROCESSOR]: 'Basic invoice processing and review permissions',
  [ROLE_NAMES.CITY_MANAGER]: 'Can manage users and data within their assigned city',
  [ROLE_NAMES.REGIONAL_MANAGER]: 'Can manage users and data across multiple cities in their region',
  [ROLE_NAMES.AUDITOR]: 'Read-only access to reports and audit logs',
} as const

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(roleName: RoleName): Permission[] {
  return [...ROLE_PERMISSIONS[roleName]]
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(roleName: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[roleName].includes(permission)
}
```

---

### Phase 2: Type Definitions (10 min)

#### Step 2.1: Create Role Types

Create `src/types/role.ts`:

```typescript
import type { Role as PrismaRole, UserRole as PrismaUserRole } from '@prisma/client'

/**
 * Role with user count
 */
export interface RoleWithUserCount extends PrismaRole {
  _count?: {
    users: number
  }
}

/**
 * User role with full role details
 */
export interface UserRoleWithRole extends PrismaUserRole {
  role: PrismaRole
}

/**
 * Role assignment request
 */
export interface AssignRoleRequest {
  userId: string
  roleName: string
  cityId?: string
}

/**
 * Role removal request
 */
export interface RemoveRoleRequest {
  userId: string
  roleId: string
}

/**
 * Session role data (simplified for token)
 */
export interface SessionRole {
  id: string
  name: string
  permissions: string[]
}
```

#### Step 2.2: Create User Types

Create `src/types/user.ts`:

```typescript
import type { User as PrismaUser, UserStatus } from '@prisma/client'
import type { SessionRole } from './role'

/**
 * User with roles
 */
export interface UserWithRoles extends PrismaUser {
  roles: {
    role: {
      id: string
      name: string
      permissions: string[]
    }
    cityId?: string | null
  }[]
}

/**
 * User session data
 */
export interface SessionUser {
  id: string
  email: string
  name: string
  image?: string | null
  status: UserStatus
  roles: SessionRole[]
}

/**
 * User list item (for admin views)
 */
export interface UserListItem {
  id: string
  email: string
  name: string
  image?: string | null
  status: UserStatus
  createdAt: Date
  roles: string[]
}

/**
 * User creation data (from Azure AD)
 */
export interface CreateUserData {
  email: string
  name: string
  image?: string | null
  azureAdId: string
}
```

---

### Phase 3: Service Layer (20 min)

#### Step 3.1: Create Role Service

Create `src/services/role.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { Role, UserRole } from '@prisma/client'
import { DEFAULT_ROLE, ROLE_PERMISSIONS, type RoleName } from '@/types/role-permissions'
import type { Permission } from '@/types/permissions'

/**
 * Get all roles
 */
export async function getAllRoles(): Promise<Role[]> {
  return prisma.role.findMany({
    orderBy: { name: 'asc' },
  })
}

/**
 * Get roles with user count
 */
export async function getRolesWithUserCount(): Promise<(Role & { _count: { users: number } })[]> {
  return prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { users: true },
      },
    },
  })
}

/**
 * Get role by name
 */
export async function getRoleByName(name: string): Promise<Role | null> {
  return prisma.role.findUnique({
    where: { name },
  })
}

/**
 * Get role by ID
 */
export async function getRoleById(id: string): Promise<Role | null> {
  return prisma.role.findUnique({
    where: { id },
  })
}

/**
 * Get user's roles
 */
export async function getUserRoles(userId: string): Promise<Role[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  })
  return userRoles.map((ur) => ur.role)
}

/**
 * Get user's permissions (aggregated from all roles)
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const roles = await getUserRoles(userId)
  const permissionSet = new Set<string>()

  for (const role of roles) {
    for (const permission of role.permissions) {
      permissionSet.add(permission)
    }
  }

  return Array.from(permissionSet)
}

/**
 * Assign role to user
 */
export async function assignRoleToUser(
  userId: string,
  roleName: string,
  cityId?: string
): Promise<UserRole> {
  const role = await getRoleByName(roleName)
  if (!role) {
    throw new Error(`Role not found: ${roleName}`)
  }

  // Check if already assigned
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id },
  })

  if (existing) {
    throw new Error(`User already has role: ${roleName}`)
  }

  return prisma.userRole.create({
    data: {
      userId,
      roleId: role.id,
      cityId,
    },
  })
}

/**
 * Assign default role to new user
 */
export async function assignDefaultRole(userId: string): Promise<UserRole | null> {
  const defaultRole = await getRoleByName(DEFAULT_ROLE)

  if (!defaultRole) {
    console.error(`Default role not found: ${DEFAULT_ROLE}`)
    return null
  }

  try {
    return await prisma.userRole.create({
      data: {
        userId,
        roleId: defaultRole.id,
      },
    })
  } catch (error) {
    console.error('Failed to assign default role:', error)
    return null
  }
}

/**
 * Remove role from user
 */
export async function removeRoleFromUser(userId: string, roleId: string): Promise<void> {
  await prisma.userRole.delete({
    where: {
      userId_roleId: { userId, roleId },
    },
  })
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  return permissions.includes(permission)
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  return permissions.some((p) => userPermissions.includes(p))
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  return permissions.every((p) => userPermissions.includes(p))
}

/**
 * Check if user has a specific role
 */
export async function hasRole(userId: string, roleName: string): Promise<boolean> {
  const roles = await getUserRoles(userId)
  return roles.some((r) => r.name === roleName)
}
```

#### Step 3.2: Create User Service

Create `src/services/user.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { User, UserStatus } from '@prisma/client'
import { assignDefaultRole } from './role.service'
import type { UserWithRoles, CreateUserData } from '@/types/user'

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  })
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email },
  })
}

/**
 * Get user with roles
 */
export async function getUserWithRoles(id: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: { role: true },
      },
    },
  })
}

/**
 * Create new user (typically from Azure AD login)
 */
export async function createUser(data: CreateUserData): Promise<User> {
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      image: data.image,
      azureAdId: data.azureAdId,
      status: 'ACTIVE',
    },
  })

  // Assign default role
  await assignDefaultRole(user.id)

  return user
}

/**
 * Update user
 */
export async function updateUser(
  id: string,
  data: Partial<Pick<User, 'name' | 'image' | 'status'>>
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data,
  })
}

/**
 * Update user status
 */
export async function updateUserStatus(id: string, status: UserStatus): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { status },
  })
}

/**
 * Get all users with their roles
 */
export async function getAllUsersWithRoles(): Promise<UserWithRoles[]> {
  return prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: {
      roles: {
        include: { role: true },
      },
    },
  })
}

/**
 * Check if user exists
 */
export async function userExists(email: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { email },
  })
  return count > 0
}

/**
 * Sync user from Azure AD (create or update)
 */
export async function syncUserFromAzureAD(data: CreateUserData): Promise<User> {
  const existing = await getUserByEmail(data.email)

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        image: data.image,
        azureAdId: data.azureAdId,
      },
    })
  }

  return createUser(data)
}
```

---

### Phase 4: Seed Data (15 min)

#### Step 4.1: Create Seed Script

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import {
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  ROLE_DESCRIPTIONS,
} from '../src/types/role-permissions'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...\n')

  // ===========================================
  // Seed System Roles
  // ===========================================
  console.log('Creating system roles...')

  const roleData = Object.values(ROLE_NAMES).map((name) => ({
    name,
    description: ROLE_DESCRIPTIONS[name],
    permissions: [...ROLE_PERMISSIONS[name]],
    isSystem: true,
  }))

  for (const role of roleData) {
    const result = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        permissions: role.permissions,
      },
      create: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
      },
    })

    console.log(`  ✓ ${result.name} (${role.permissions.length} permissions)`)
  }

  // ===========================================
  // Summary
  // ===========================================
  const roleCount = await prisma.role.count()
  const userCount = await prisma.user.count()

  console.log('\n========================================')
  console.log('Seed completed successfully!')
  console.log('========================================')
  console.log(`Roles: ${roleCount}`)
  console.log(`Users: ${userCount}`)
  console.log('========================================\n')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

#### Step 4.2: Update package.json

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

#### Step 4.3: Run Seed

```bash
npx prisma db seed
```

---

### Phase 5: API Endpoints (20 min)

#### Step 5.1: Create Roles API

Create `src/app/api/roles/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAllRoles, getRolesWithUserCount } from '@/services/role.service'
import { PERMISSIONS } from '@/types/permissions'

/**
 * GET /api/roles
 * Get all roles (requires USER_MANAGE or SYSTEM_CONFIG permission)
 */
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // Check permission
    const hasPermission = session.user.roles?.some(
      (role) =>
        role.permissions.includes(PERMISSIONS.USER_MANAGE) ||
        role.permissions.includes(PERMISSIONS.SYSTEM_CONFIG)
    )

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            title: 'Forbidden',
            status: 403,
            detail: 'Insufficient permissions',
          },
        },
        { status: 403 }
      )
    }

    // Check if user count is requested
    const { searchParams } = new URL(request.url)
    const includeCount = searchParams.get('includeCount') === 'true'

    const roles = includeCount
      ? await getRolesWithUserCount()
      : await getAllRoles()

    return NextResponse.json({
      success: true,
      data: roles,
    })
  } catch (error) {
    console.error('Get roles error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch roles',
        },
      },
      { status: 500 }
    )
  }
}
```

#### Step 5.2: Create Health Check API

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  services: {
    database: 'connected' | 'disconnected'
  }
  version?: string
}

/**
 * GET /api/health
 * Health check endpoint (no auth required)
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const timestamp = new Date().toISOString()

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'healthy',
      timestamp,
      services: {
        database: 'connected',
      },
      version: process.env.npm_package_version || '1.0.0',
    })
  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        services: {
          database: 'disconnected',
        },
      },
      { status: 503 }
    )
  }
}
```

---

### Phase 6: Permission Hooks (15 min)

#### Step 6.1: Create useAuth Hook

Create `src/hooks/useAuth.ts`:

```typescript
'use client'

import { useSession } from 'next-auth/react'
import { useMemo } from 'react'
import type { Permission } from '@/types/permissions'

/**
 * Hook for accessing authentication state and permission checking
 */
export function useAuth() {
  const { data: session, status } = useSession()

  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated'
  const user = session?.user

  /**
   * All user permissions (aggregated from all roles)
   */
  const permissions = useMemo(() => {
    if (!user?.roles) return []

    const permissionSet = new Set<string>()
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        permissionSet.add(permission)
      }
    }
    return Array.from(permissionSet)
  }, [user?.roles])

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission)
  }

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.some((p) => permissions.includes(p))
  }

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.every((p) => permissions.includes(p))
  }

  /**
   * Check if user has a specific role
   */
  const hasRole = (roleName: string): boolean => {
    return user?.roles?.some((r) => r.name === roleName) ?? false
  }

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (roleNames: string[]): boolean => {
    return roleNames.some((name) => hasRole(name))
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
  }
}
```

#### Step 6.2: Create useRoles Hook

Create `src/hooks/useRoles.ts`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import type { Role } from '@prisma/client'

interface RoleWithCount extends Role {
  _count?: {
    users: number
  }
}

interface RolesResponse {
  success: boolean
  data?: RoleWithCount[]
  error?: {
    title: string
    status: number
    detail?: string
  }
}

/**
 * Fetch all roles from the API
 */
async function fetchRoles(includeCount = false): Promise<RoleWithCount[]> {
  const url = `/api/roles${includeCount ? '?includeCount=true' : ''}`
  const response = await fetch(url)
  const json: RolesResponse = await response.json()

  if (!json.success || !json.data) {
    throw new Error(json.error?.detail || 'Failed to fetch roles')
  }

  return json.data
}

/**
 * Hook for fetching roles
 */
export function useRoles(options?: { includeCount?: boolean }) {
  const { includeCount = false } = options ?? {}

  return useQuery({
    queryKey: ['roles', { includeCount }],
    queryFn: () => fetchRoles(includeCount),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

---

### Phase 7: Update NextAuth Callbacks (10 min)

Update `src/lib/auth.ts` callbacks to use services:

```typescript
// In callbacks section
callbacks: {
  async signIn({ user, account, profile }) {
    if (account?.provider === 'azure-ad') {
      try {
        const { syncUserFromAzureAD } = await import('@/services/user.service')

        await syncUserFromAzureAD({
          email: user.email!,
          name: user.name!,
          image: user.image ?? undefined,
          azureAdId: profile?.sub as string,
        })

        return true
      } catch (error) {
        console.error('SignIn error:', error)
        return false
      }
    }
    return true
  },

  async session({ session, token }) {
    if (token.sub && session.user) {
      session.user.id = token.sub

      const { getUserWithRoles } = await import('@/services/user.service')
      const dbUser = await getUserWithRoles(token.sub)

      if (dbUser) {
        session.user.status = dbUser.status
        session.user.roles = dbUser.roles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          permissions: ur.role.permissions,
        }))
      }
    }
    return session
  },
}
```

---

## Verification Checklist

### Database Verification

| Command | Expected Result | Status |
|---------|-----------------|--------|
| `npx prisma db seed` | 6 roles created | [ ] |
| `npx prisma studio` | View roles in database | [ ] |
| Query Role table | All roles have permissions | [ ] |

### API Verification

| Test Case | Method | Expected Result | Status |
|-----------|--------|-----------------|--------|
| Get roles (no auth) | GET /api/roles | 401 Unauthorized | [ ] |
| Get roles (no permission) | GET /api/roles | 403 Forbidden | [ ] |
| Get roles (admin) | GET /api/roles | 200 with role list | [ ] |
| Health check | GET /api/health | 200 healthy | [ ] |

### Authentication Flow

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| New user login | First Azure AD login | User created with Data Processor role | [ ] |
| Session roles | Check session after login | Contains role and permissions | [ ] |
| Permission check | Call hasPermission() | Returns correct boolean | [ ] |

### Hook Verification

| Test Case | Component | Expected Result | Status |
|-----------|-----------|-----------------|--------|
| useAuth | Any component | Returns user and permission methods | [ ] |
| hasPermission | Permission check | Returns true/false correctly | [ ] |
| useRoles | Admin component | Fetches and caches roles | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/types/permissions.ts` | Permission constants |
| `src/types/role-permissions.ts` | Role-permission mapping |
| `src/types/role.ts` | Role type definitions |
| `src/types/user.ts` | User type definitions |
| `src/services/role.service.ts` | Role service layer |
| `src/services/user.service.ts` | User service layer |
| `src/hooks/useAuth.ts` | Auth hook with permission checking |
| `src/hooks/useRoles.ts` | Roles query hook |
| `src/app/api/roles/route.ts` | Roles API endpoint |
| `src/app/api/health/route.ts` | Health check endpoint |
| `prisma/seed.ts` | Database seed script |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Seed fails with "Role not found" | Check ROLE_PERMISSIONS keys match ROLE_NAMES |
| Session has no roles | Run `npx prisma db seed` to create roles |
| Permission check always fails | Verify role has correct permissions in database |
| API returns 403 | Check user has required permission |

---

## Next Steps

After completing Story 1-2:
1. All Sprint 1 foundations are complete
2. Proceed to **Story 1-3** (User List & Search)
3. Begin implementing user management features
4. Consider setting up E2E tests for auth flow

---

*Generated by BMAD Method - Create Tech Spec Workflow*
