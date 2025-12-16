# Story 1-7: Custom Role Management - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-7-custom-role-management

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.7 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Large |
| Dependencies | Story 1.2 |
| Blocking | None |
| FR Coverage | FR41 |

---

## Objective

Implement a comprehensive role management system that allows system administrators to create, edit, and delete custom roles with specific permission sets. System-defined roles must be protected from modification, and roles with active user assignments must be protected from deletion.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Add custom role | AddRoleDialog with permission selector |
| AC2 | Role creation & usage | Role CRUD API + user assignment integration |
| AC3 | System role protection | isSystem flag check in API |
| AC4 | Role deletion protection | User count check before delete |

---

## Implementation Guide

### Phase 1: Role Management Page (25 min)

#### Step 1.1: Create Role List Page

Create `src/app/(dashboard)/admin/roles/page.tsx`:

```typescript
import { Suspense } from 'react'
import { getRoles } from '@/services/role.service'
import { RoleList } from '@/components/features/admin/RoleList'
import { RoleListSkeleton } from '@/components/features/admin/RoleListSkeleton'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export const metadata = {
  title: 'Role Management | Admin',
  description: 'Manage system and custom roles',
}

export default function RolesPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">
            Create and manage custom roles with specific permissions
          </p>
        </div>
      </div>

      <Suspense fallback={<RoleListSkeleton />}>
        <RoleListContent />
      </Suspense>
    </div>
  )
}

async function RoleListContent() {
  const roles = await getRoles()
  return <RoleList initialRoles={roles} />
}
```

#### Step 1.2: Create RoleList Component

Create `src/components/features/admin/RoleList.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Edit, Trash2, Lock, Users, Shield } from 'lucide-react'
import { AddRoleDialog } from './AddRoleDialog'
import { EditRoleDialog } from './EditRoleDialog'
import { DeleteRoleDialog } from './DeleteRoleDialog'
import type { RoleWithDetails } from '@/services/role.service'

interface RoleListProps {
  initialRoles: RoleWithDetails[]
}

export function RoleList({ initialRoles }: RoleListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleWithDetails | null>(null)
  const [deletingRole, setDeletingRole] = useState<RoleWithDetails | null>(null)

  const { data: roles = initialRoles } = useQuery<RoleWithDetails[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await fetch('/api/admin/roles')
      const result = await response.json()
      return result.data
    },
    initialData: initialRoles,
  })

  // Separate system and custom roles
  const systemRoles = roles.filter((r) => r.isSystem)
  const customRoles = roles.filter((r) => !r.isSystem)

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Role
        </Button>
      </div>

      <div className="space-y-6">
        {/* System Roles Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">System Roles</CardTitle>
            </div>
            <CardDescription>
              Predefined roles that cannot be modified or deleted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoleTable
              roles={systemRoles}
              onEdit={setEditingRole}
              onDelete={setDeletingRole}
            />
          </CardContent>
        </Card>

        {/* Custom Roles Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Custom Roles</CardTitle>
            </div>
            <CardDescription>
              User-defined roles with custom permission sets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {customRoles.length > 0 ? (
              <RoleTable
                roles={customRoles}
                onEdit={setEditingRole}
                onDelete={setDeletingRole}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No custom roles created yet</p>
                <p className="text-sm">Click "Add Custom Role" to create one</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <AddRoleDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {editingRole && (
        <EditRoleDialog
          role={editingRole}
          open={!!editingRole}
          onOpenChange={(open) => !open && setEditingRole(null)}
        />
      )}

      {deletingRole && (
        <DeleteRoleDialog
          role={deletingRole}
          open={!!deletingRole}
          onOpenChange={(open) => !open && setDeletingRole(null)}
        />
      )}
    </>
  )
}

interface RoleTableProps {
  roles: RoleWithDetails[]
  onEdit: (role: RoleWithDetails) => void
  onDelete: (role: RoleWithDetails) => void
}

function RoleTable({ roles, onEdit, onDelete }: RoleTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-center">Permissions</TableHead>
          <TableHead className="text-center">Users</TableHead>
          <TableHead className="w-[80px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <TableRow key={role.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium">{role.name}</span>
                {role.isSystem && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="mr-1 h-3 w-3" />
                    System
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-[300px] truncate">
              {role.description || '-'}
            </TableCell>
            <TableCell className="text-center">
              <Badge variant="outline">{role._count?.permissions ?? 0}</Badge>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span>{role._count?.userRoles ?? 0}</span>
              </div>
            </TableCell>
            <TableCell>
              {!role.isSystem && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(role)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(role)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

---

### Phase 2: Permission Selector Component (30 min)

#### Step 2.1: Define Permission Categories

Create `src/types/permission-categories.ts`:

```typescript
import { PERMISSIONS } from './permissions'

export interface PermissionInfo {
  code: string
  name: string
  description: string
}

export const PERMISSION_CATEGORIES: Record<string, PermissionInfo[]> = {
  'Invoice Management': [
    {
      code: PERMISSIONS.INVOICE_VIEW,
      name: 'View Invoices',
      description: 'Can view invoice list and details',
    },
    {
      code: PERMISSIONS.INVOICE_CREATE,
      name: 'Create/Upload Invoices',
      description: 'Can upload and create new invoices',
    },
    {
      code: PERMISSIONS.INVOICE_REVIEW,
      name: 'Review Invoices',
      description: 'Can review and verify invoice data',
    },
    {
      code: PERMISSIONS.INVOICE_APPROVE,
      name: 'Approve Invoices',
      description: 'Can approve processed invoices',
    },
  ],
  'Reports': [
    {
      code: PERMISSIONS.REPORT_VIEW,
      name: 'View Reports',
      description: 'Can access and view reports',
    },
    {
      code: PERMISSIONS.REPORT_EXPORT,
      name: 'Export Reports',
      description: 'Can export reports to Excel/CSV',
    },
  ],
  'Extraction Rules': [
    {
      code: PERMISSIONS.RULE_VIEW,
      name: 'View Rules',
      description: 'Can view extraction rules',
    },
    {
      code: PERMISSIONS.RULE_MANAGE,
      name: 'Manage Rules',
      description: 'Can create and edit extraction rules',
    },
    {
      code: PERMISSIONS.RULE_APPROVE,
      name: 'Approve Rules',
      description: 'Can approve rule changes',
    },
  ],
  'User Management': [
    {
      code: PERMISSIONS.USER_VIEW,
      name: 'View Users',
      description: 'Can view user list',
    },
    {
      code: PERMISSIONS.USER_MANAGE,
      name: 'Manage All Users',
      description: 'Can manage all system users',
    },
    {
      code: PERMISSIONS.USER_MANAGE_CITY,
      name: 'Manage City Users',
      description: 'Can manage users within assigned city',
    },
    {
      code: PERMISSIONS.USER_MANAGE_REGION,
      name: 'Manage Region Users',
      description: 'Can manage users within assigned region',
    },
  ],
  'System Administration': [
    {
      code: PERMISSIONS.SYSTEM_CONFIG,
      name: 'System Configuration',
      description: 'Can modify system settings',
    },
    {
      code: PERMISSIONS.SYSTEM_MONITOR,
      name: 'System Monitoring',
      description: 'Can view system health and metrics',
    },
  ],
  'Audit': [
    {
      code: PERMISSIONS.AUDIT_VIEW,
      name: 'View Audit Logs',
      description: 'Can view audit trail and logs',
    },
    {
      code: PERMISSIONS.AUDIT_EXPORT,
      name: 'Export Audit Logs',
      description: 'Can export audit data',
    },
  ],
}

// Flatten all permissions for quick lookup
export const ALL_PERMISSIONS = Object.values(PERMISSION_CATEGORIES).flat()

// Get permission info by code
export function getPermissionInfo(code: string): PermissionInfo | undefined {
  return ALL_PERMISSIONS.find((p) => p.code === code)
}
```

#### Step 2.2: Create PermissionSelector Component

Create `src/components/features/admin/PermissionSelector.tsx`:

```typescript
'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CheckSquare, Square, MinusSquare } from 'lucide-react'
import { PERMISSION_CATEGORIES, type PermissionInfo } from '@/types/permission-categories'

interface PermissionSelectorProps {
  selectedPermissions: string[]
  onChange: (permissions: string[]) => void
  disabled?: boolean
}

export function PermissionSelector({
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionSelectorProps) {
  const handleTogglePermission = (code: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedPermissions, code])
    } else {
      onChange(selectedPermissions.filter((p) => p !== code))
    }
  }

  const handleToggleCategory = (categoryPermissions: PermissionInfo[]) => {
    const categoryCodes = categoryPermissions.map((p) => p.code)
    const allSelected = categoryCodes.every((code) =>
      selectedPermissions.includes(code)
    )

    if (allSelected) {
      // Deselect all in category
      onChange(selectedPermissions.filter((p) => !categoryCodes.includes(p)))
    } else {
      // Select all in category
      const newPermissions = new Set([...selectedPermissions, ...categoryCodes])
      onChange(Array.from(newPermissions))
    }
  }

  const handleSelectAll = () => {
    const allCodes = Object.values(PERMISSION_CATEGORIES)
      .flat()
      .map((p) => p.code)
    onChange(allCodes)
  }

  const handleDeselectAll = () => {
    onChange([])
  }

  const getCategoryState = (categoryPermissions: PermissionInfo[]) => {
    const categoryCodes = categoryPermissions.map((p) => p.code)
    const selectedCount = categoryCodes.filter((code) =>
      selectedPermissions.includes(code)
    ).length

    if (selectedCount === 0) return 'none'
    if (selectedCount === categoryCodes.length) return 'all'
    return 'partial'
  }

  return (
    <div className="space-y-4">
      {/* Header with select all/none */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedPermissions.length} permission(s) selected
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={disabled}
          >
            <CheckSquare className="mr-1 h-4 w-4" />
            Select All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            disabled={disabled}
          >
            <Square className="mr-1 h-4 w-4" />
            Deselect All
          </Button>
        </div>
      </div>

      {/* Permission Categories */}
      <Accordion type="multiple" className="w-full" defaultValue={Object.keys(PERMISSION_CATEGORIES)}>
        {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
          const state = getCategoryState(permissions)
          const selectedInCategory = permissions.filter((p) =>
            selectedPermissions.includes(p.code)
          ).length

          return (
            <AccordionItem key={category} value={category}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!disabled) {
                        handleToggleCategory(permissions)
                      }
                    }}
                  >
                    {state === 'all' && (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    )}
                    {state === 'partial' && (
                      <MinusSquare className="h-4 w-4 text-primary" />
                    )}
                    {state === 'none' && (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="font-medium">{category}</span>
                  <Badge variant="outline" className="ml-2">
                    {selectedInCategory}/{permissions.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 pl-7 pt-2">
                  {permissions.map((permission) => (
                    <div
                      key={permission.code}
                      className="flex items-start space-x-3 rounded-md border p-3"
                    >
                      <Checkbox
                        id={permission.code}
                        checked={selectedPermissions.includes(permission.code)}
                        onCheckedChange={(checked) =>
                          handleTogglePermission(permission.code, checked as boolean)
                        }
                        disabled={disabled}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor={permission.code}
                          className="cursor-pointer font-medium"
                        >
                          {permission.name}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {permission.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
```

---

### Phase 3: Add Role Dialog (25 min)

#### Step 3.1: Create Validation Schema

Create `src/lib/validations/role.ts`:

```typescript
import { z } from 'zod'

export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s]+$/, 'Role name can only contain letters, numbers, and spaces'),
  description: z
    .string()
    .max(200, 'Description must be less than 200 characters')
    .optional(),
  permissions: z
    .array(z.string())
    .min(1, 'Please select at least one permission'),
})

export const updateRoleSchema = createRoleSchema

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
```

#### Step 3.2: Create AddRoleDialog Component

Create `src/components/features/admin/AddRoleDialog.tsx`:

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { PermissionSelector } from './PermissionSelector'
import { createRoleSchema, type CreateRoleInput } from '@/lib/validations/role'

interface AddRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddRoleDialog({ open, onOpenChange }: AddRoleDialogProps) {
  const queryClient = useQueryClient()

  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: CreateRoleInput) => {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to create role')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Role created successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      form.reset()
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const onSubmit = (data: CreateRoleInput) => {
    createMutation.mutate(data)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
          <DialogDescription>
            Define a new role with specific permissions. This role can be assigned to users.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Role Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Invoice Reviewer" {...field} />
                  </FormControl>
                  <FormDescription>
                    A unique name for this role (letters, numbers, spaces only)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this role's purpose..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Permissions */}
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permissions *</FormLabel>
                  <FormDescription>
                    Select the permissions this role should have
                  </FormDescription>
                  <FormControl>
                    <PermissionSelector
                      selectedPermissions={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Role
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

### Phase 4: Edit Role Dialog (20 min)

#### Step 4.1: Create EditRoleDialog Component

Create `src/components/features/admin/EditRoleDialog.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, AlertCircle } from 'lucide-react'
import { PermissionSelector } from './PermissionSelector'
import { updateRoleSchema, type UpdateRoleInput } from '@/lib/validations/role'
import type { RoleWithDetails } from '@/services/role.service'

interface EditRoleDialogProps {
  role: RoleWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditRoleDialog({ role, open, onOpenChange }: EditRoleDialogProps) {
  const queryClient = useQueryClient()
  const isSystemRole = role.isSystem

  const form = useForm<UpdateRoleInput>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions?.map((rp) => rp.permission.code) ?? [],
    },
  })

  // Reset form when role changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: role.name,
        description: role.description ?? '',
        permissions: role.permissions?.map((rp) => rp.permission.code) ?? [],
      })
    }
  }, [role, open, form])

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateRoleInput) => {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to update role')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Role updated successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const onSubmit = (data: UpdateRoleInput) => {
    updateMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Role
            {isSystemRole && (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
          </DialogTitle>
          <DialogDescription>
            {isSystemRole
              ? 'System roles cannot be modified. View permissions below.'
              : 'Update the role name, description, and permissions.'}
          </DialogDescription>
        </DialogHeader>

        {isSystemRole && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This is a system-defined role and cannot be edited. System roles are
              managed by the application.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Role Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Invoice Reviewer"
                      disabled={isSystemRole}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this role's purpose..."
                      className="resize-none"
                      rows={2}
                      disabled={isSystemRole}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Permissions */}
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permissions *</FormLabel>
                  <FormControl>
                    <PermissionSelector
                      selectedPermissions={field.value}
                      onChange={field.onChange}
                      disabled={isSystemRole}
                    />
                  </FormControl>
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
                {isSystemRole ? 'Close' : 'Cancel'}
              </Button>
              {!isSystemRole && (
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Phase 5: Delete Role Dialog (15 min)

#### Step 5.1: Create DeleteRoleDialog Component

Create `src/components/features/admin/DeleteRoleDialog.tsx`:

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, Users } from 'lucide-react'
import type { RoleWithDetails } from '@/services/role.service'

interface DeleteRoleDialogProps {
  role: RoleWithDetails
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteRoleDialog({ role, open, onOpenChange }: DeleteRoleDialogProps) {
  const queryClient = useQueryClient()
  const usersCount = role._count?.userRoles ?? 0
  const hasUsers = usersCount > 0

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to delete role')
      }

      return response.json()
    },
    onSuccess: () => {
      toast.success('Role deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleDelete = () => {
    if (!hasUsers) {
      deleteMutation.mutate()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Role</AlertDialogTitle>
          <AlertDialogDescription>
            {hasUsers ? (
              <span>
                This role cannot be deleted because it is assigned to{' '}
                <strong>{usersCount}</strong> user(s).
              </span>
            ) : (
              <span>
                Are you sure you want to delete the role{' '}
                <strong>"{role.name}"</strong>? This action cannot be undone.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasUsers && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>
                Please reassign or remove these {usersCount} user(s) from this
                role before deleting.
              </span>
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          {!hasUsers && (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Role
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

### Phase 6: Role API Endpoints (30 min)

#### Step 6.1: Create Role Routes

Create `src/app/api/admin/roles/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRoles, createRole, checkRoleNameExists } from '@/services/role.service'
import { createRoleSchema } from '@/lib/validations/role'
import { logAudit } from '@/lib/audit/logger'
import { AppError, handleApiError, createErrorResponse } from '@/lib/errors'
import { PERMISSIONS, hasPermission } from '@/lib/auth/permissions'

// GET /api/admin/roles
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    if (!hasPermission(session.user, PERMISSIONS.USER_VIEW)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const roles = await getRoles()
    return NextResponse.json({ success: true, data: roles })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/roles
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    if (!hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const body = await request.json()

    // Validate request body
    const validationResult = createRoleSchema.safeParse(body)
    if (!validationResult.success) {
      return createErrorResponse(
        'validation_error',
        'Validation Failed',
        400,
        validationResult.error.errors.map(e => e.message).join(', ')
      )
    }

    const { name, description, permissions } = validationResult.data

    // Check if role name already exists
    const nameExists = await checkRoleNameExists(name)
    if (nameExists) {
      return createErrorResponse(
        'conflict',
        'Role Name Exists',
        409,
        `A role with the name "${name}" already exists`
      )
    }

    // Create role
    const role = await createRole({
      name,
      description,
      permissions,
    })

    // Log audit
    await logAudit({
      entityType: 'ROLE',
      entityId: role.id,
      action: 'CREATE_ROLE',
      newValue: { name, description, permissions },
      performedBy: session.user.id,
    })

    return NextResponse.json({ success: true, data: role }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

#### Step 6.2: Create Role [id] Routes

Create `src/app/api/admin/roles/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getRoleById,
  updateRole,
  deleteRole,
  checkRoleInUse,
  checkRoleNameExists,
} from '@/services/role.service'
import { updateRoleSchema } from '@/lib/validations/role'
import { logAudit } from '@/lib/audit/logger'
import { AppError, handleApiError, createErrorResponse } from '@/lib/errors'
import { PERMISSIONS, hasPermission } from '@/lib/auth/permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/roles/[id]
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
    const role = await getRoleById(id)

    if (!role) {
      throw new AppError('not_found', 'Role Not Found', 404, 'Role does not exist')
    }

    return NextResponse.json({ success: true, data: role })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/admin/roles/[id]
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

    // Get existing role
    const existingRole = await getRoleById(id)
    if (!existingRole) {
      throw new AppError('not_found', 'Role Not Found', 404, 'Role does not exist')
    }

    // Check if system role
    if (existingRole.isSystem) {
      throw new AppError(
        'forbidden',
        'System Role Protected',
        403,
        'System roles cannot be modified'
      )
    }

    // Validate request body
    const validationResult = updateRoleSchema.safeParse(body)
    if (!validationResult.success) {
      return createErrorResponse(
        'validation_error',
        'Validation Failed',
        400,
        validationResult.error.errors.map(e => e.message).join(', ')
      )
    }

    const { name, description, permissions } = validationResult.data

    // Check if new name conflicts with existing role
    if (name !== existingRole.name) {
      const nameExists = await checkRoleNameExists(name, id)
      if (nameExists) {
        return createErrorResponse(
          'conflict',
          'Role Name Exists',
          409,
          `A role with the name "${name}" already exists`
        )
      }
    }

    // Prepare old values for audit
    const oldValues = {
      name: existingRole.name,
      description: existingRole.description,
      permissions: existingRole.permissions?.map((rp) => rp.permission.code),
    }

    // Update role
    const updatedRole = await updateRole(id, { name, description, permissions })

    // Log audit
    await logAudit({
      entityType: 'ROLE',
      entityId: id,
      action: 'UPDATE_ROLE_PERMISSIONS',
      oldValue: oldValues,
      newValue: { name, description, permissions },
      performedBy: session.user.id,
    })

    return NextResponse.json({ success: true, data: updatedRole })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/admin/roles/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new AppError('unauthorized', 'Unauthorized', 401, 'Please log in')
    }

    if (!hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const { id } = await params

    // Get existing role
    const existingRole = await getRoleById(id)
    if (!existingRole) {
      throw new AppError('not_found', 'Role Not Found', 404, 'Role does not exist')
    }

    // Check if system role
    if (existingRole.isSystem) {
      throw new AppError(
        'forbidden',
        'System Role Protected',
        403,
        'System roles cannot be deleted'
      )
    }

    // Check if role is in use
    const usersCount = await checkRoleInUse(id)
    if (usersCount > 0) {
      return createErrorResponse(
        'conflict',
        'Role In Use',
        409,
        `This role is assigned to ${usersCount} user(s). Please reassign these users before deleting.`,
        { usersCount }
      )
    }

    // Delete role
    await deleteRole(id)

    // Log audit
    await logAudit({
      entityType: 'ROLE',
      entityId: id,
      action: 'DELETE_ROLE',
      oldValue: {
        name: existingRole.name,
        description: existingRole.description,
      },
      performedBy: session.user.id,
    })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    return handleApiError(error)
  }
}
```

---

### Phase 7: Role Service Layer (25 min)

#### Step 7.1: Create Role Service

Create `src/services/role.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// ===========================================
// Types
// ===========================================

export interface RoleWithDetails {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
  permissions?: Array<{
    permission: {
      id: string
      code: string
      name: string
    }
  }>
  _count?: {
    userRoles: number
    permissions: number
  }
}

export interface CreateRoleData {
  name: string
  description?: string
  permissions: string[]
}

export interface UpdateRoleData {
  name: string
  description?: string
  permissions: string[]
}

// ===========================================
// Functions
// ===========================================

/**
 * Get all roles with details
 */
export async function getRoles(): Promise<RoleWithDetails[]> {
  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    include: {
      permissions: {
        include: {
          permission: {
            select: { id: true, code: true, name: true },
          },
        },
      },
      _count: {
        select: {
          userRoles: true,
          permissions: true,
        },
      },
    },
  })

  return roles as RoleWithDetails[]
}

/**
 * Get single role by ID
 */
export async function getRoleById(id: string): Promise<RoleWithDetails | null> {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: {
        include: {
          permission: {
            select: { id: true, code: true, name: true },
          },
        },
      },
      _count: {
        select: {
          userRoles: true,
          permissions: true,
        },
      },
    },
  })

  return role as RoleWithDetails | null
}

/**
 * Check if role name already exists
 */
export async function checkRoleNameExists(
  name: string,
  excludeId?: string
): Promise<boolean> {
  const role = await prisma.role.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId && { id: { not: excludeId } }),
    },
  })

  return !!role
}

/**
 * Check if role is assigned to any users
 */
export async function checkRoleInUse(roleId: string): Promise<number> {
  const count = await prisma.userRole.count({
    where: { roleId },
  })

  return count
}

/**
 * Create a new custom role
 */
export async function createRole(data: CreateRoleData): Promise<RoleWithDetails> {
  const { name, description, permissions } = data

  // Get permission IDs from codes
  const permissionRecords = await prisma.permission.findMany({
    where: { code: { in: permissions } },
    select: { id: true },
  })

  const role = await prisma.$transaction(async (tx) => {
    // Create role
    const newRole = await tx.role.create({
      data: {
        name,
        description,
        isSystem: false,
      },
    })

    // Create role-permission associations
    if (permissionRecords.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionRecords.map((p) => ({
          roleId: newRole.id,
          permissionId: p.id,
        })),
      })
    }

    // Return role with relations
    return tx.role.findUniqueOrThrow({
      where: { id: newRole.id },
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        _count: {
          select: {
            userRoles: true,
            permissions: true,
          },
        },
      },
    })
  })

  return role as RoleWithDetails
}

/**
 * Update an existing role
 */
export async function updateRole(
  id: string,
  data: UpdateRoleData
): Promise<RoleWithDetails> {
  const { name, description, permissions } = data

  // Get permission IDs from codes
  const permissionRecords = await prisma.permission.findMany({
    where: { code: { in: permissions } },
    select: { id: true },
  })

  const role = await prisma.$transaction(async (tx) => {
    // Update role basic info
    await tx.role.update({
      where: { id },
      data: {
        name,
        description,
        updatedAt: new Date(),
      },
    })

    // Delete existing permissions
    await tx.rolePermission.deleteMany({
      where: { roleId: id },
    })

    // Create new permission associations
    if (permissionRecords.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionRecords.map((p) => ({
          roleId: id,
          permissionId: p.id,
        })),
      })
    }

    // Return updated role
    return tx.role.findUniqueOrThrow({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        _count: {
          select: {
            userRoles: true,
            permissions: true,
          },
        },
      },
    })
  })

  return role as RoleWithDetails
}

/**
 * Delete a role
 */
export async function deleteRole(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Delete role-permission associations
    await tx.rolePermission.deleteMany({
      where: { roleId: id },
    })

    // Delete the role
    await tx.role.delete({
      where: { id },
    })
  })
}
```

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── admin/
│   │       └── roles/
│   │           └── page.tsx              # Role management page
│   └── api/
│       └── admin/
│           └── roles/
│               ├── route.ts              # GET, POST
│               └── [id]/
│                   └── route.ts          # GET, PATCH, DELETE
├── components/
│   └── features/
│       └── admin/
│           ├── RoleList.tsx              # Role list display
│           ├── RoleListSkeleton.tsx      # Loading skeleton
│           ├── AddRoleDialog.tsx         # Create role form
│           ├── EditRoleDialog.tsx        # Edit role form
│           ├── DeleteRoleDialog.tsx      # Delete confirmation
│           └── PermissionSelector.tsx    # Permission multi-select
├── lib/
│   └── validations/
│       └── role.ts                       # Zod schemas
├── services/
│   └── role.service.ts                   # Role CRUD operations
└── types/
    └── permission-categories.ts          # Permission groupings
```

---

## API Endpoints

### GET /api/admin/roles

Get all roles.

**Response:**
```typescript
{
  success: true,
  data: Array<{
    id: string
    name: string
    description: string | null
    isSystem: boolean
    createdAt: string
    _count: {
      userRoles: number
      permissions: number
    }
  }>
}
```

### POST /api/admin/roles

Create a new custom role.

**Request:**
```typescript
{
  name: string          // 2-50 chars
  description?: string  // max 200 chars
  permissions: string[] // min 1
}
```

### PATCH /api/admin/roles/[id]

Update an existing role.

**Request:** Same as POST

### DELETE /api/admin/roles/[id]

Delete a custom role.

**Error (Role In Use):**
```typescript
{
  success: false,
  error: {
    type: 'conflict',
    title: 'Role In Use',
    status: 409,
    detail: 'This role is assigned to 5 user(s)...',
    usersCount: 5
  }
}
```

---

## Verification Checklist

### Role CRUD Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| List roles | System + custom roles displayed | [ ] |
| Create role | Role created with permissions | [ ] |
| Edit role | Role updated successfully | [ ] |
| Delete role | Role deleted (if not in use) | [ ] |

### Permission Selector Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Category display | Permissions grouped correctly | [ ] |
| Select all in category | All category permissions selected | [ ] |
| Select/deselect all | All permissions toggled | [ ] |
| Validation | At least 1 permission required | [ ] |

### Protection Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Edit system role | UI disabled, API returns 403 | [ ] |
| Delete system role | Button hidden, API returns 403 | [ ] |
| Delete role in use | Warning shown, API returns 409 | [ ] |

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Story 1.0 | Project foundation | Required |
| Story 1.2 | Role/Permission schema | Required |

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
