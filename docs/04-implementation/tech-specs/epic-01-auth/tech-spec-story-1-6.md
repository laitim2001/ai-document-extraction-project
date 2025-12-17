# Story 1-6: Disable/Enable User Account - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-6-disable-enable-user-account

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.6 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Medium |
| Dependencies | Story 1.5 |
| Blocking | Story 1.7, 1.8 |
| FR Coverage | FR40 |

---

## Objective

Implement user account status management functionality that allows system administrators to disable and enable user accounts. Disabled users must be blocked from logging into the system, with appropriate error messaging and audit trail.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Disable user account | Status toggle with confirmation dialog |
| AC2 | Enable user account | Status toggle (direct action) |
| AC3 | Block disabled user login | NextAuth callback + error page |

---

## Implementation Guide

### Phase 1: Status Toggle UI (20 min)

#### Step 1.1: Status Toggle Button Component

Create `src/components/features/admin/UserStatusToggle.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, UserCheck, UserX, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type UserStatus = 'ACTIVE' | 'INACTIVE'

interface UserStatusToggleProps {
  userId: string
  currentStatus: UserStatus
  userName: string
}

export function UserStatusToggle({
  userId,
  currentStatus,
  userName,
}: UserStatusToggleProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null)
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: async (newStatus: UserStatus) => {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to update status')
      }

      return response.json()
    },
    onSuccess: (_, newStatus) => {
      const action = newStatus === 'INACTIVE' ? 'disabled' : 'enabled'
      toast.success(`User account ${action} successfully`)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowConfirmDialog(false)
      setPendingStatus(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
      setShowConfirmDialog(false)
      setPendingStatus(null)
    },
  })

  const handleStatusChange = (newStatus: UserStatus) => {
    if (newStatus === 'INACTIVE') {
      // Disabling requires confirmation
      setPendingStatus(newStatus)
      setShowConfirmDialog(true)
    } else {
      // Enabling is direct
      statusMutation.mutate(newStatus)
    }
  }

  const confirmStatusChange = () => {
    if (pendingStatus) {
      statusMutation.mutate(pendingStatus)
    }
  }

  const isLoading = statusMutation.isPending

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {currentStatus === 'ACTIVE' ? (
            <DropdownMenuItem
              onClick={() => handleStatusChange('INACTIVE')}
              className="text-destructive focus:text-destructive"
            >
              <UserX className="mr-2 h-4 w-4" />
              Disable Account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => handleStatusChange('ACTIVE')}>
              <UserCheck className="mr-2 h-4 w-4" />
              Enable Account
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable User Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to disable the account for{' '}
                <strong>{userName}</strong>?
              </p>
              <p className="text-destructive">
                This will immediately prevent the user from logging in and accessing
                the system.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusChange}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

#### Step 1.2: Status Badge Component

Create `src/components/features/admin/UserStatusBadge.tsx`:

```typescript
import { Badge, BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type UserStatus = 'ACTIVE' | 'INACTIVE'

interface UserStatusBadgeProps {
  status: UserStatus
  className?: string
}

const statusConfig: Record<UserStatus, { label: string; variant: BadgeProps['variant'] }> = {
  ACTIVE: {
    label: 'Active',
    variant: 'default',
  },
  INACTIVE: {
    label: 'Inactive',
    variant: 'secondary',
  },
}

export function UserStatusBadge({ status, className }: UserStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge
      variant={config.variant}
      className={cn(
        status === 'ACTIVE' && 'bg-green-100 text-green-800 hover:bg-green-100',
        status === 'INACTIVE' && 'bg-gray-100 text-gray-800 hover:bg-gray-100',
        className
      )}
    >
      {config.label}
    </Badge>
  )
}
```

#### Step 1.3: Update User Table

Update `src/components/features/admin/UserTable.tsx` to include status toggle:

```typescript
'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { UserStatusBadge } from './UserStatusBadge'
import { UserStatusToggle } from './UserStatusToggle'
import { formatDate } from '@/lib/utils/date'
import type { UserWithRoles } from '@/services/user.service'

interface UserTableProps {
  users: UserWithRoles[]
}

export function UserTable({ users }: UserTableProps) {
  const router = useRouter()

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((ur) => (
                    <Badge key={ur.role.id} variant="outline">
                      {ur.role.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {user.roles.find((ur) => ur.city)?.city?.name ?? '-'}
              </TableCell>
              <TableCell>
                <UserStatusBadge status={user.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <UserStatusToggle
                    userId={user.id}
                    currentStatus={user.status}
                    userName={user.name}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

---

### Phase 2: Status Change API (20 min)

#### Step 2.1: Create Status Endpoint

Create `src/app/api/admin/users/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { updateUserStatus, getUserById } from '@/services/user.service'
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

    if (!hasPermission(session.user, PERMISSIONS.USER_MANAGE)) {
      throw new AppError('forbidden', 'Forbidden', 403, 'Insufficient permissions')
    }

    const { id } = await params
    const body = await request.json()

    // Validate request body
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

    // Get current user for audit
    const currentUser = await getUserById(id)
    if (!currentUser) {
      throw new AppError('not_found', 'User Not Found', 404, 'User does not exist')
    }

    // Prevent self-disable
    if (id === session.user.id && status === 'INACTIVE') {
      throw new AppError(
        'bad_request',
        'Invalid Operation',
        400,
        'You cannot disable your own account'
      )
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

#### Step 2.2: Add Service Function

Update `src/services/user.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { UserStatus } from '@prisma/client'

// ... existing code ...

/**
 * Update user account status
 */
export async function updateUserStatus(
  userId: string,
  status: UserStatus
): Promise<{ id: string; status: UserStatus }> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      status: true,
    },
  })

  return user
}

/**
 * Check if user is active (for login)
 */
export async function isUserActive(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { status: true },
  })

  return user?.status === 'ACTIVE'
}
```

---

### Phase 3: Login Blocking (25 min)

#### Step 3.1: Update NextAuth Configuration

Update `src/lib/auth.ts` to check user status:

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
  pages: {
    signIn: '/login',
    error: '/error',  // Custom error page
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'azure-ad') {
        // Check if user exists in database
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { status: true },
        })

        // If user exists but is inactive, redirect to error
        if (dbUser && dbUser.status === 'INACTIVE') {
          return '/error?error=AccountDisabled'
        }

        // If user doesn't exist, allow sign in (will be created by adapter)
        // or implement your own logic for new users
      }

      return true
    },

    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (user && account) {
        token.id = user.id
        const roles = await getUserRolesWithPermissions(user.id)
        token.roles = roles
        token.lastRefresh = Date.now()
      }

      // Periodic refresh
      if (trigger === 'update' || shouldRefreshToken(token)) {
        try {
          // Re-check user status
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { status: true },
          })

          if (dbUser?.status === 'INACTIVE') {
            // Force sign out by returning null or empty token
            return { ...token, error: 'AccountDisabled' }
          }

          token.roles = await getUserRolesWithPermissions(token.id as string)
          token.lastRefresh = Date.now()
        } catch {
          // Token refresh failed, continue with existing token
        }
      }

      return token
    },

    async session({ session, token }) {
      // Check for error in token
      if (token.error === 'AccountDisabled') {
        throw new Error('AccountDisabled')
      }

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

---

### Phase 4: Error Page (15 min)

#### Step 4.1: Create Error Page

Create `src/app/(auth)/error/page.tsx`:

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ShieldOff, Ban, HelpCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ErrorConfig {
  icon: typeof AlertCircle
  title: string
  description: string
  actionLabel: string
  actionHref: string
}

const errorConfigs: Record<string, ErrorConfig> = {
  AccountDisabled: {
    icon: Ban,
    title: 'Account Disabled',
    description:
      'Your account has been disabled. Please contact your system administrator for assistance.',
    actionLabel: 'Contact Support',
    actionHref: 'mailto:support@example.com?subject=Account%20Disabled',
  },
  AccessDenied: {
    icon: ShieldOff,
    title: 'Access Denied',
    description:
      'You do not have permission to access this resource. Please contact your administrator if you believe this is an error.',
    actionLabel: 'Go Back',
    actionHref: '/',
  },
  Configuration: {
    icon: AlertCircle,
    title: 'Configuration Error',
    description:
      'There is a problem with the server configuration. Please try again later or contact support.',
    actionLabel: 'Try Again',
    actionHref: '/login',
  },
  Default: {
    icon: HelpCircle,
    title: 'Authentication Error',
    description:
      'An error occurred during authentication. Please try again or contact support if the problem persists.',
    actionLabel: 'Try Again',
    actionHref: '/login',
  },
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error') || 'Default'
  const config = errorConfigs[errorCode] || errorConfigs.Default
  const Icon = config.icon

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <Icon className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl">{config.title}</CardTitle>
          <CardDescription className="text-base">
            {config.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href={config.actionHref}>{config.actionLabel}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </Button>
          </div>

          {errorCode === 'AccountDisabled' && (
            <div className="rounded-md border bg-muted p-4 text-sm">
              <h4 className="font-medium mb-2">What to do next:</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Contact your department manager</li>
                <li>Email IT support at support@example.com</li>
                <li>Provide your email address for verification</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  )
}
```

#### Step 4.2: Create Layout

Create `src/app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
```

---

### Phase 5: Session Invalidation (10 min)

#### Step 5.1: Active Session Check Middleware

Create `src/middleware.ts` or update existing:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const session = await auth()

  // Check protected routes
  if (request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Check for AccountDisabled error in session
    // This requires the session callback to handle it
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/invoices/:path*',
    '/reports/:path*',
  ],
}
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── error/
│   │   │   └── page.tsx              # Error page
│   │   └── layout.tsx                # Auth layout
│   └── api/
│       └── admin/
│           └── users/
│               └── [id]/
│                   └── status/
│                       └── route.ts   # Status endpoint
├── components/
│   └── features/
│       └── admin/
│           ├── UserStatusToggle.tsx   # Status toggle button
│           ├── UserStatusBadge.tsx    # Status badge display
│           └── UserTable.tsx          # Updated with status
├── lib/
│   └── auth.ts                        # Updated with status check
└── services/
    └── user.service.ts                # Extended with status functions
```

---

## API Endpoints

### PATCH /api/admin/users/[id]/status

Update user account status.

**Request:**
```typescript
{
  status: 'ACTIVE' | 'INACTIVE'
}
```

**Response (Success):**
```typescript
{
  success: true,
  data: {
    id: string
    status: 'ACTIVE' | 'INACTIVE'
  }
}
```

**Response (Error - Self Disable):**
```typescript
{
  success: false,
  error: {
    type: 'bad_request',
    title: 'Invalid Operation',
    status: 400,
    detail: 'You cannot disable your own account'
  }
}
```

---

## Security Considerations

### Login Flow with Status Check

```
User attempts login
       │
       ▼
Azure AD authenticates
       │
       ▼
NextAuth signIn callback
       │
       ├─── User not in DB ──► Allow (new user setup)
       │
       ├─── User ACTIVE ──► Allow login
       │
       └─── User INACTIVE ──► Redirect to /error?error=AccountDisabled
```

### Session Validation Flow

```
User makes request
       │
       ▼
JWT callback (on refresh)
       │
       ▼
Check user status in DB
       │
       ├─── ACTIVE ──► Continue, refresh roles
       │
       └─── INACTIVE ──► Set token.error = 'AccountDisabled'
                                │
                                ▼
                         Session callback
                                │
                                ▼
                         Throw error, force logout
```

---

## Verification Checklist

### Functional Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Disable active user | Status changes to INACTIVE | [ ] |
| Enable disabled user | Status changes to ACTIVE | [ ] |
| Confirmation dialog shown | Dialog appears before disable | [ ] |
| Self-disable blocked | Error message shown | [ ] |
| Audit log created | Status change logged | [ ] |

### Login Blocking Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Disabled user login | Redirect to error page | [ ] |
| Error page displays | AccountDisabled message shown | [ ] |
| Active user login | Normal login flow | [ ] |
| Session refresh | Disabled user gets logged out | [ ] |

### UI Testing

| Test Case | Expected Result | Status |
|-----------|-----------------|--------|
| Status badge - Active | Green badge shown | [ ] |
| Status badge - Inactive | Gray badge shown | [ ] |
| Toggle button visibility | Correct action shown per status | [ ] |
| Loading state | Spinner during operation | [ ] |

---

## Error Messages

| Error Code | Display Message | Cause |
|------------|-----------------|-------|
| AccountDisabled | Your account has been disabled... | User status = INACTIVE |
| AccessDenied | You do not have permission... | Missing required permission |
| Configuration | Server configuration error... | OAuth misconfiguration |
| Default | An error occurred during auth... | Unknown error |

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Story 1.0 | Project foundation | Required |
| Story 1.1 | Authentication | Required |
| Story 1.2 | User schema with status | Required |
| Story 1.5 | Audit logging infrastructure | Required |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Self-disable | Server-side check prevents |
| Race condition | Database transaction for status update |
| Session persistence | Periodic session refresh with status check |
| User confusion | Clear error message with next steps |

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
