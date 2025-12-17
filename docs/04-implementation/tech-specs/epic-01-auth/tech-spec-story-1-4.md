# Story 1-4: Add User & Role Assignment - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-4-add-user-role-assignment

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.4 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Medium |
| Dependencies | Story 1.3 |
| Blocking | Story 1.5, 1.6 |
| FR Coverage | FR38 |

---

## Objective

Enable system administrators to manually add new users to the system with role assignments, supporting scenarios where users need pre-registration before their first Azure AD login.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Add user form dialog | Dialog with form fields + Zod validation |
| AC2 | Create user with roles | POST API + Prisma transaction |
| AC3 | Email duplicate check | Unique constraint validation |

---

## Implementation Guide

### Phase 1: Validation Schema (10 min)

#### Step 1.1: Create User Validation Schema

Create `src/lib/validations/user.schema.ts`:

```typescript
import { z } from 'zod'

// ===========================================
// Create User Schema
// ===========================================

export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters'),

  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\u4e00-\u9fa5\s\-\.]+$/, 'Name contains invalid characters'),

  roleIds: z
    .array(z.string().uuid('Invalid role ID'))
    .min(1, 'Please select at least one role'),

  cityId: z
    .string()
    .uuid('Invalid city ID')
    .optional()
    .nullable(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

// ===========================================
// Update User Schema
// ===========================================

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),

  roleIds: z
    .array(z.string().uuid('Invalid role ID'))
    .min(1, 'Please select at least one role')
    .optional(),

  cityId: z
    .string()
    .uuid('Invalid city ID')
    .optional()
    .nullable(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
```

---

### Phase 2: Service Layer Extension (15 min)

#### Step 2.1: Add Create User Function

Add to `src/services/user.service.ts`:

```typescript
import { AppError } from '@/lib/errors'
import type { CreateUserInput } from '@/lib/validations/user.schema'

// ===========================================
// Check Email Exists
// ===========================================

export async function checkEmailExists(email: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { email: email.toLowerCase() },
  })
  return count > 0
}

// ===========================================
// Create User
// ===========================================

export async function createUser(input: CreateUserInput, createdById: string) {
  const { email, name, roleIds, cityId } = input

  // Check for duplicate email
  const emailExists = await checkEmailExists(email)
  if (emailExists) {
    throw new AppError(
      'validation_error',
      'Email Already Exists',
      409,
      'This email address is already registered'
    )
  }

  // Create user with roles in a transaction
  const user = await prisma.$transaction(async (tx) => {
    // Create user
    const newUser = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        status: 'ACTIVE',
      },
    })

    // Create role assignments
    await tx.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId: newUser.id,
        roleId,
        cityId: cityId || null,
      })),
    })

    // Log audit event
    await tx.auditLog.create({
      data: {
        entityType: 'USER',
        entityId: newUser.id,
        action: 'CREATE',
        newValue: JSON.stringify({ email, name, roleIds, cityId }),
        performedBy: createdById,
        performedAt: new Date(),
      },
    })

    // Return user with roles
    return tx.user.findUnique({
      where: { id: newUser.id },
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

  return user
}
```

#### Step 2.2: Create AppError Class

Create `src/lib/errors.ts`:

```typescript
export class AppError extends Error {
  constructor(
    public type: string,
    public title: string,
    public status: number,
    public detail: string
  ) {
    super(detail)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
```

---

### Phase 3: API Endpoint (20 min)

#### Step 3.1: Add POST Handler to Users API

Update `src/app/api/admin/users/route.ts`:

```typescript
import { createUserSchema } from '@/lib/validations/user.schema'
import { createUser } from '@/services/user.service'
import { isAppError } from '@/lib/errors'
import { PERMISSIONS } from '@/types/permissions'

// ... existing GET handler ...

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { title: 'Unauthorized', status: 401 } },
        { status: 401 }
      )
    }

    // Check permission
    const hasPermission = session.user.roles?.some((role) =>
      role.permissions.includes(PERMISSIONS.USER_MANAGE)
    )

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: {
            title: 'Forbidden',
            status: 403,
            detail: 'USER_MANAGE permission required',
          },
        },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createUserSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Failed',
            status: 400,
            detail: validationResult.error.errors[0].message,
            errors: validationResult.error.errors,
          },
        },
        { status: 400 }
      )
    }

    // Create user
    const user = await createUser(validationResult.data, session.user.id)

    return NextResponse.json(
      { success: true, data: user },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create user error:', error)

    if (isAppError(error)) {
      return NextResponse.json(
        { success: false, error: error.toJSON() },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to create user',
        },
      },
      { status: 500 }
    )
  }
}
```

---

### Phase 4: React Query Mutation (15 min)

#### Step 4.1: Add useCreateUser Hook

Update `src/hooks/useUsers.ts`:

```typescript
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { CreateUserInput } from '@/lib/validations/user.schema'

// ... existing useUsers hook ...

// ===========================================
// Create User Mutation
// ===========================================

interface CreateUserResponse {
  success: boolean
  data?: UserListItem
  error?: {
    type: string
    title: string
    status: number
    detail: string
  }
}

async function createUserRequest(input: CreateUserInput): Promise<CreateUserResponse> {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const json = await response.json()

  if (!response.ok) {
    throw new Error(json.error?.detail || 'Failed to create user')
  }

  return json
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createUserRequest,
    onSuccess: () => {
      // Invalidate users list to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

---

### Phase 5: UI Components (40 min)

#### Step 5.1: Add User Dialog Component

Create `src/components/features/admin/AddUserDialog.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Loader2 } from 'lucide-react'
import { useCreateUser } from '@/hooks/useUsers'
import { useRoles } from '@/hooks/useRoles'
import { useCities } from '@/hooks/useCities'
import { createUserSchema, type CreateUserInput } from '@/lib/validations/user.schema'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export function AddUserDialog() {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const { mutate: createUser, isPending } = useCreateUser()
  const { data: rolesData } = useRoles()
  const { data: citiesData } = useCities()

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      name: '',
      roleIds: [],
      cityId: null,
    },
  })

  const onSubmit = (data: CreateUserInput) => {
    createUser(data, {
      onSuccess: () => {
        toast({
          title: 'User created',
          description: `${data.name} has been added successfully.`,
        })
        setOpen(false)
        form.reset()
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        })
      },
    })
  }

  // Reset form when dialog closes
  const handleOpenChange = (open: boolean) => {
    setOpen(open)
    if (!open) {
      form.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. The user will be able to log in via Azure AD.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="user@company.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Must match the user's Azure AD email address
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Roles Field */}
            <FormField
              control={form.control}
              name="roleIds"
              render={() => (
                <FormItem>
                  <FormLabel>Roles</FormLabel>
                  <div className="space-y-2">
                    {rolesData?.data?.map((role) => (
                      <FormField
                        key={role.id}
                        control={form.control}
                        name="roleIds"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(role.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || []
                                  if (checked) {
                                    field.onChange([...current, role.id])
                                  } else {
                                    field.onChange(
                                      current.filter((id) => id !== role.id)
                                    )
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {role.name}
                              {role.description && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({role.description})
                                </span>
                              )}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* City Field */}
            <FormField
              control={form.control}
              name="cityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City (Optional)</FormLabel>
                  <Select
                    value={field.value || ''}
                    onValueChange={(value) => field.onChange(value || null)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No city assigned</SelectItem>
                      {citiesData?.data?.map((city) => (
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
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

#### Step 5.2: Update User List Page

Update `src/app/(dashboard)/admin/users/page.tsx`:

```typescript
import { Suspense } from 'react'
import { UserList } from '@/components/features/admin/UserList'
import { UserListSkeleton } from '@/components/features/admin/UserListSkeleton'
import { AddUserDialog } from '@/components/features/admin/AddUserDialog'

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
        <AddUserDialog />
      </div>

      <Suspense fallback={<UserListSkeleton />}>
        <UserList />
      </Suspense>
    </div>
  )
}
```

#### Step 5.3: Add Required UI Components

```bash
npx shadcn@latest add checkbox dialog form
```

---

### Phase 6: Update Roles Hook (10 min)

#### Step 6.1: Ensure useRoles Returns All Fields

Update `src/hooks/useRoles.ts`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

export interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  isSystem: boolean
}

interface RolesResponse {
  success: boolean
  data?: Role[]
}

async function fetchRoles(): Promise<RolesResponse> {
  const response = await fetch('/api/roles')
  if (!response.ok) {
    throw new Error('Failed to fetch roles')
  }
  return response.json()
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

---

## Verification Checklist

### Functionality

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Open dialog | Click "Add User" button | Dialog opens | [ ] |
| Validation | Submit empty form | Shows validation errors | [ ] |
| Email format | Enter invalid email | Shows email error | [ ] |
| No roles | Submit without roles | Shows "select at least one role" | [ ] |
| Create user | Fill valid data, submit | User created, dialog closes | [ ] |
| List refresh | After creation | New user appears in list | [ ] |
| Duplicate email | Use existing email | Shows "already registered" error | [ ] |
| Toast message | After success/error | Shows appropriate toast | [ ] |

### Permission

| Test Case | User Role | Expected Result | Status |
|-----------|-----------|-----------------|--------|
| See Add button | System Admin | Button visible | [ ] |
| See Add button | Data Processor | Button hidden | [ ] |
| API call | No USER_MANAGE | 403 Forbidden | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/lib/validations/user.schema.ts` | Zod validation schemas |
| `src/lib/errors.ts` | AppError class |
| `src/services/user.service.ts` | Extended with createUser |
| `src/app/api/admin/users/route.ts` | Added POST handler |
| `src/hooks/useUsers.ts` | Added useCreateUser hook |
| `src/components/features/admin/AddUserDialog.tsx` | Add user dialog |

---

## Next Steps

After completing Story 1-4:
1. Proceed to **Story 1-5** (Modify User Role & City)
2. Add edit functionality to user table rows
3. Implement user detail page

---

*Generated by BMAD Method - Create Tech Spec Workflow*
