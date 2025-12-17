# Story 1-5: Modify User Role & City - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-5-modify-user-role-city

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.5 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Medium |
| Dependencies | Story 1.4 |
| Blocking | Story 1.6 |
| FR Coverage | FR39 |

---

## Objective

Implement user profile editing functionality that allows system administrators to modify user roles and city assignments, with comprehensive audit logging and session refresh mechanisms to ensure permission changes take effect immediately.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Edit user form | EditUserDialog component with pre-filled data |
| AC2 | Successful modification | updateUser service with role/city updates |
| AC3 | Immediate permission effect | Session refresh mechanism on role changes |

---

## Implementation Guide

### Phase 1: User Detail Page (20 min)

#### Step 1.1: Create User Detail Page

Create `src/app/(dashboard)/admin/users/[id]/page.tsx`:

```typescript
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getUserById } from '@/services/user.service'
import { UserDetailView } from '@/components/features/admin/UserDetailView'
import { UserDetailSkeleton } from '@/components/features/admin/UserDetailSkeleton'

interface UserDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<UserDetailSkeleton />}>
        <UserDetailContent userId={id} />
      </Suspense>
    </div>
  )
}

async function UserDetailContent({ userId }: { userId: string }) {
  const user = await getUserById(userId)

  if (!user) {
    notFound()
  }

  return <UserDetailView user={user} />
}
```

#### Step 1.2: Create UserDetailView Component

Create `src/components/features/admin/UserDetailView.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Edit, Shield, MapPin, Calendar, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EditUserDialog } from './EditUserDialog'
import { formatDate } from '@/lib/utils/date'
import type { UserWithRoles } from '@/services/user.service'

interface UserDetailViewProps {
  user: UserWithRoles
}

export function UserDetailView({ user }: UserDetailViewProps) {
  const router = useRouter()
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const getStatusBadgeVariant = (status: string) => {
    return status === 'ACTIVE' ? 'success' : 'secondary'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin/users')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">User Details</h1>
              <p className="text-muted-foreground">View and manage user information</p>
            </div>
          </div>
          <Button onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit User
          </Button>
        </div>

        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{user.name}</CardTitle>
                  <Badge variant={getStatusBadgeVariant(user.status)}>
                    {user.status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {/* Roles Section */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <Shield className="h-4 w-4" />
                Assigned Roles
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((userRole) => (
                  <Badge key={userRole.role.id} variant="outline">
                    {userRole.role.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* City Section */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4" />
                City Assignment
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.roles
                  .filter(ur => ur.city)
                  .map((userRole) => (
                    <Badge key={userRole.city!.id} variant="secondary">
                      {userRole.city!.name} ({userRole.city!.code})
                    </Badge>
                  ))}
                {!user.roles.some(ur => ur.city) && (
                  <span className="text-muted-foreground text-sm">No city assigned</span>
                )}
              </div>
            </div>

            {/* Dates Section */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <Calendar className="h-4 w-4" />
                Account Created
              </h3>
              <p className="text-muted-foreground text-sm">
                {formatDate(user.createdAt)}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Last Login</h3>
              <p className="text-muted-foreground text-sm">
                {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditUserDialog
        user={user}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  )
}
```

---

### Phase 2: Edit User Dialog (30 min)

#### Step 2.1: Create Validation Schema

Update `src/lib/validations/user.ts`:

```typescript
import { z } from 'zod'

// Existing createUserSchema...

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  roleIds: z
    .array(z.string().uuid('Invalid role ID'))
    .min(1, 'Please select at least one role'),
  cityId: z
    .string()
    .uuid('Invalid city ID')
    .optional()
    .nullable(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
```

#### Step 2.2: Create EditUserDialog Component

Create `src/components/features/admin/EditUserDialog.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Mail, Lock } from 'lucide-react'
import { updateUserSchema, type UpdateUserInput } from '@/lib/validations/user'
import type { UserWithRoles } from '@/services/user.service'

interface EditUserDialogProps {
  user: UserWithRoles
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Role {
  id: string
  name: string
  isSystem: boolean
}

interface City {
  id: string
  name: string
  code: string
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const queryClient = useQueryClient()

  // Fetch roles
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await fetch('/api/admin/roles')
      const result = await response.json()
      return result.data
    },
    enabled: open,
  })

  // Fetch cities
  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ['cities'],
    queryFn: async () => {
      const response = await fetch('/api/admin/cities')
      const result = await response.json()
      return result.data
    },
    enabled: open,
  })

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name,
      roleIds: user.roles.map(r => r.role.id),
      cityId: user.roles.find(r => r.cityId)?.cityId ?? null,
    },
  })

  // Reset form when user changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: user.name,
        roleIds: user.roles.map(r => r.role.id),
        cityId: user.roles.find(r => r.cityId)?.cityId ?? null,
      })
    }
  }, [user, open, form])

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateUserInput) => {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to update user')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('User updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user', user.id] })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const onSubmit = (data: UpdateUserInput) => {
    updateMutation.mutate(data)
  }

  const handleRoleToggle = (roleId: string, checked: boolean) => {
    const currentRoles = form.getValues('roleIds')
    if (checked) {
      form.setValue('roleIds', [...currentRoles, roleId], { shouldValidate: true })
    } else {
      form.setValue(
        'roleIds',
        currentRoles.filter(id => id !== roleId),
        { shouldValidate: true }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information, roles, and city assignment.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Email (Read-only) */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
                <Lock className="h-3 w-3 text-muted-foreground" />
              </label>
              <Input
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed as it is linked to Azure AD
              </p>
            </div>

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter display name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Roles */}
            <FormField
              control={form.control}
              name="roleIds"
              render={() => (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  <FormDescription>
                    Select one or more roles for this user
                  </FormDescription>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center space-x-2 rounded-md border p-3"
                      >
                        <Checkbox
                          id={`role-${role.id}`}
                          checked={form.watch('roleIds').includes(role.id)}
                          onCheckedChange={(checked) =>
                            handleRoleToggle(role.id, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={`role-${role.id}`}
                          className="text-sm font-medium leading-none cursor-pointer flex-1"
                        >
                          {role.name}
                          {role.isSystem && (
                            <span className="ml-1 text-xs text-muted-foreground">(System)</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* City */}
            <FormField
              control={form.control}
              name="cityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City Assignment</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    value={field.value ?? 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No city assigned</SelectItem>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name} ({city.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Required for City Manager role
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Phase 3: Update User API (25 min)

#### Step 3.1: Create PATCH Endpoint

Create `src/app/api/admin/users/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { updateUser, getUserById } from '@/services/user.service'
import { updateUserSchema } from '@/lib/validations/user'
import { logUserChange } from '@/lib/audit/logger'
import { AppError, handleApiError, createErrorResponse } from '@/lib/errors'
import { PERMISSIONS, hasPermission } from '@/lib/auth/permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/users/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    if (!hasPermission(session.user, PERMISSIONS.USER_VIEW)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const { id } = await params
    const user = await getUserById(id)

    if (!user) {
      throw new AppError('not_found', 'User Not Found', 404, 'User does not exist')
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/admin/users/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    if (!hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const { id } = await params
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

    // Get current user data for audit logging
    const currentUser = await getUserById(id)
    if (!currentUser) {
      throw new AppError('not_found', 'User Not Found', 404, 'User does not exist')
    }

    // Prepare old values for audit
    const oldValues = {
      name: currentUser.name,
      roleIds: currentUser.roles.map(r => r.role.id),
      cityId: currentUser.roles.find(r => r.cityId)?.cityId ?? null,
    }

    // Update user
    const updatedUser = await updateUser(id, validationResult.data)

    // Log changes
    const newValues = {
      name: validationResult.data.name,
      roleIds: validationResult.data.roleIds,
      cityId: validationResult.data.cityId,
    }

    // Log role changes if any
    const rolesChanged = JSON.stringify(oldValues.roleIds.sort()) !==
                         JSON.stringify(newValues.roleIds.sort())
    if (rolesChanged) {
      await logUserChange({
        userId: id,
        action: 'UPDATE_ROLE',
        oldValue: oldValues.roleIds,
        newValue: newValues.roleIds,
        performedBy: session.user.id,
      })
    }

    // Log city changes if any
    if (oldValues.cityId !== newValues.cityId) {
      await logUserChange({
        userId: id,
        action: 'UPDATE_CITY',
        oldValue: oldValues.cityId,
        newValue: newValues.cityId,
        performedBy: session.user.id,
      })
    }

    // Log name changes if any
    if (oldValues.name !== newValues.name) {
      await logUserChange({
        userId: id,
        action: 'UPDATE_INFO',
        oldValue: { name: oldValues.name },
        newValue: { name: newValues.name },
        performedBy: session.user.id,
      })
    }

    return NextResponse.json({ success: true, data: updatedUser })
  } catch (error) {
    return handleApiError(error)
  }
}
```

---

### Phase 4: User Service Update (20 min)

#### Step 4.1: Add updateUser Function

Update `src/services/user.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { UpdateUserInput } from '@/lib/validations/user'

// ... existing code ...

/**
 * Update user information including roles and city
 */
export async function updateUser(
  userId: string,
  data: UpdateUserInput
): Promise<UserWithRoles> {
  const { name, roleIds, cityId } = data

  // Use transaction to ensure atomicity
  const updatedUser = await prisma.$transaction(async (tx) => {
    // Update user basic info
    await tx.user.update({
      where: { id: userId },
      data: {
        name,
        updatedAt: new Date(),
      },
    })

    // Delete existing role assignments
    await tx.userRole.deleteMany({
      where: { userId },
    })

    // Create new role assignments
    await tx.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
        cityId: cityId ?? null,
      })),
    })

    // Return updated user with relations
    return tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: { select: { id: true, name: true } },
            city: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })
  })

  return updatedUser as UserWithRoles
}

/**
 * Update user roles only (for role changes)
 */
export async function updateUserRoles(
  userId: string,
  roleIds: string[],
  cityId?: string | null
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Delete existing role assignments
    await tx.userRole.deleteMany({
      where: { userId },
    })

    // Create new role assignments
    await tx.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
        cityId: cityId ?? null,
      })),
    })
  })
}
```

---

### Phase 5: Audit Logging (15 min)

#### Step 5.1: Create Audit Logger

Create `src/lib/audit/logger.ts`:

```typescript
import { prisma } from '@/lib/prisma'

export type AuditAction =
  | 'UPDATE_ROLE'
  | 'UPDATE_CITY'
  | 'UPDATE_INFO'
  | 'UPDATE_STATUS'
  | 'CREATE_USER'
  | 'DELETE_USER'
  | 'CREATE_ROLE'
  | 'UPDATE_ROLE_PERMISSIONS'
  | 'DELETE_ROLE'

export type EntityType = 'USER' | 'ROLE' | 'PERMISSION' | 'CITY'

interface LogUserChangeParams {
  userId: string
  action: AuditAction
  oldValue: unknown
  newValue: unknown
  performedBy: string
}

interface LogParams {
  entityType: EntityType
  entityId: string
  action: AuditAction
  oldValue?: unknown
  newValue?: unknown
  performedBy: string
  metadata?: Record<string, unknown>
}

/**
 * Log user-related changes to audit log
 */
export async function logUserChange(params: LogUserChangeParams): Promise<void> {
  await logAudit({
    entityType: 'USER',
    entityId: params.userId,
    action: params.action,
    oldValue: params.oldValue,
    newValue: params.newValue,
    performedBy: params.performedBy,
  })
}

/**
 * General audit logging function
 */
export async function logAudit(params: LogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        performedBy: params.performedBy,
        performedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    })
  } catch (error) {
    // Log error but don't throw - audit logging should not break main operation
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Query audit logs for an entity
 */
export async function getAuditLogs(params: {
  entityType?: EntityType
  entityId?: string
  action?: AuditAction
  performedBy?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const {
    entityType,
    entityId,
    action,
    performedBy,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = params

  const where = {
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...(action && { action }),
    ...(performedBy && { performedBy }),
    ...(startDate || endDate
      ? {
          performedAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  }

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ])

  return { logs, total }
}
```

#### Step 5.2: Update Prisma Schema

Ensure `prisma/schema.prisma` includes AuditLog model:

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  entityType  String   @map("entity_type")
  entityId    String   @map("entity_id")
  action      String
  oldValue    String?  @map("old_value") @db.Text
  newValue    String?  @map("new_value") @db.Text
  performedBy String   @map("performed_by")
  performedAt DateTime @map("performed_at")
  metadata    String?  @db.Text

  @@index([entityType, entityId])
  @@index([performedBy])
  @@index([performedAt])
  @@index([action])
  @@map("audit_logs")
}
```

---

### Phase 6: Session Refresh Mechanism (15 min)

#### Step 6.1: Session Refresh Strategy

For permission changes to take effect immediately, implement a session refresh approach:

**Option A: Short JWT Expiry (Recommended)**

Update `src/lib/auth.ts`:

```typescript
import NextAuth from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 1 hour - shorter for more frequent permission refresh
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.roles = await getUserRolesWithPermissions(user.id)
      }

      // Force refresh on update trigger or periodically
      if (trigger === 'update' || shouldRefreshToken(token)) {
        token.roles = await getUserRolesWithPermissions(token.id as string)
        token.lastRefresh = Date.now()
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.roles = token.roles as UserRole[]
      }
      return session
    },
  },
})

function shouldRefreshToken(token: JWT): boolean {
  const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
  const lastRefresh = (token.lastRefresh as number) || 0
  return Date.now() - lastRefresh > REFRESH_INTERVAL
}

async function getUserRolesWithPermissions(userId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      city: true,
    },
  })

  return userRoles.map((ur) => ({
    roleId: ur.role.id,
    roleName: ur.role.name,
    cityId: ur.cityId,
    cityName: ur.city?.name ?? null,
    permissions: ur.role.permissions.map((rp) => rp.permission.code),
  }))
}
```

**Option B: Manual Session Refresh**

Create `src/lib/auth/session-refresh.ts`:

```typescript
import { useSession } from 'next-auth/react'

export function useSessionRefresh() {
  const { update } = useSession()

  const refreshSession = async () => {
    await update({})
  }

  return { refreshSession }
}
```

Usage in EditUserDialog after successful update:

```typescript
import { useSessionRefresh } from '@/lib/auth/session-refresh'

// In component
const { refreshSession } = useSessionRefresh()

// After successful update
onSuccess: async () => {
  toast.success('User updated successfully')

  // If updating current user, refresh session
  if (user.id === currentUserId) {
    await refreshSession()
  }

  queryClient.invalidateQueries({ queryKey: ['users'] })
  onOpenChange(false)
},
```

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── admin/
│   │       └── users/
│   │           ├── page.tsx              # User list (Story 1-3)
│   │           └── [id]/
│   │               └── page.tsx          # User detail page
│   └── api/
│       └── admin/
│           └── users/
│               ├── route.ts              # GET, POST (Story 1-4)
│               └── [id]/
│                   └── route.ts          # GET, PATCH
├── components/
│   └── features/
│       └── admin/
│           ├── UserDetailView.tsx        # User detail display
│           ├── UserDetailSkeleton.tsx    # Loading skeleton
│           └── EditUserDialog.tsx        # Edit user form
├── lib/
│   ├── audit/
│   │   └── logger.ts                     # Audit logging utility
│   └── validations/
│       └── user.ts                       # Zod schemas (extended)
└── services/
    └── user.service.ts                   # Extended with updateUser
```

---

## API Endpoints

### GET /api/admin/users/[id]

Get single user details.

**Response:**
```typescript
{
  success: true,
  data: {
    id: string
    email: string
    name: string
    image: string | null
    status: 'ACTIVE' | 'INACTIVE'
    createdAt: string
    lastLoginAt: string | null
    roles: Array<{
      role: { id: string, name: string }
      cityId: string | null
      city: { id: string, name: string, code: string } | null
    }>
  }
}
```

### PATCH /api/admin/users/[id]

Update user information.

**Request:**
```typescript
{
  name: string          // Required
  roleIds: string[]     // Required, min 1
  cityId?: string | null
}
```

**Response:**
```typescript
{
  success: true,
  data: User // Updated user with roles
}
```

**Error Responses:**
- `400` - Validation error
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - User not found

---

## Verification Checklist

### Functional Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| View user detail page | User info displayed correctly | [ ] |
| Open edit dialog | Form pre-filled with current data | [ ] |
| Email field read-only | Cannot modify email | [ ] |
| Change user name | Name updated successfully | [ ] |
| Change user roles | Roles updated, audit logged | [ ] |
| Change city assignment | City updated, audit logged | [ ] |
| Submit with empty roles | Validation error shown | [ ] |
| Permission check | Non-admin cannot edit | [ ] |

### Audit Log Verification

| Action | Audit Record Created | Status |
|--------|---------------------|--------|
| Role change | UPDATE_ROLE logged | [ ] |
| City change | UPDATE_CITY logged | [ ] |
| Name change | UPDATE_INFO logged | [ ] |
| Old/new values captured | Correct values stored | [ ] |

### Permission Testing

| Scenario | Expected Result | Status |
|----------|-----------------|--------|
| Session refresh after role change | New permissions active | [ ] |
| Short JWT expiry | Permissions refresh within interval | [ ] |

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Story 1.0 | Project foundation | Required |
| Story 1.1 | Authentication | Required |
| Story 1.2 | User/Role schema | Required |
| Story 1.3 | User list (navigation) | Required |
| Story 1.4 | Add user dialog (reuse components) | Required |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data inconsistency | Use database transactions |
| Permission delay | Implement session refresh |
| Audit log failure | Non-blocking logging with error capture |
| Concurrent edits | Optimistic locking (future enhancement) |

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
