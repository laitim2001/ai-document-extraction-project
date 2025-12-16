# Story 1-1: Azure AD SSO Login - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-1-azure-ad-sso-login

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.1 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Medium-High |
| Dependencies | Story 1.0 (Project Init) |
| Blocking | Story 1.2 and all auth-dependent stories |

---

## Objective

Implement Azure AD Single Sign-On (SSO) authentication using NextAuth v5, enabling users to securely log in with their corporate Microsoft accounts.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Azure AD Login Flow | NextAuth Azure AD Provider + OAuth 2.0 |
| AC2 | Session Timeout (8 hours) | JWT strategy with maxAge |
| AC3 | Idle Timeout (30 minutes) | Client-side session check |

---

## Prerequisites

### Azure AD App Registration

Before implementation, ensure the following is configured in Azure Portal:

1. **Azure Portal** > **Azure Active Directory** > **App registrations**
2. **Create or select** the application
3. **Configure Redirect URIs:**
   - Development: `http://localhost:3000/api/auth/callback/azure-ad`
   - Production: `https://<your-domain>/api/auth/callback/azure-ad`
4. **Generate Client Secret** (copy immediately, shown only once)
5. **Record the following values:**
   - Application (client) ID
   - Directory (tenant) ID
   - Client secret value

### Required Environment Variables

```bash
AZURE_AD_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
AZURE_AD_CLIENT_SECRET="your-client-secret-value"
AZURE_AD_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
```

---

## Implementation Guide

### Phase 1: Install Dependencies (5 min)

```bash
npm install next-auth@beta @auth/prisma-adapter
```

**Package Versions:**
- `next-auth@5.0.0-beta.x` (NextAuth v5)
- `@auth/prisma-adapter` (Prisma adapter for NextAuth)

---

### Phase 2: Update Prisma Schema (10 min)

Update `prisma/schema.prisma` to add NextAuth required models:

```prisma
// ===========================================
// NextAuth Required Models
// ===========================================

model Account {
  id                String  @id @default(uuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// Update User model to add relations
model User {
  id            String     @id @default(uuid())
  email         String     @unique
  name          String
  image         String?
  azureAdId     String?    @unique @map("azure_ad_id")
  emailVerified DateTime?  @map("email_verified")
  status        UserStatus @default(ACTIVE)
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  // Relations
  accounts Account[]
  sessions Session[]
  roles    UserRole[]

  @@map("users")
}
```

Run migration:
```bash
npx prisma migrate dev --name add_auth_models
```

---

### Phase 3: NextAuth Configuration (30 min)

#### Step 3.1: Create Auth Configuration

Create `src/lib/auth.ts`:

```typescript
import NextAuth from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import type { NextAuthConfig } from 'next-auth'

const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),

  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: 'openid email profile User.Read',
        },
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  pages: {
    signIn: '/login',
    error: '/error',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'azure-ad') {
        try {
          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          })

          if (!existingUser) {
            // Create new user
            const newUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name!,
                image: user.image,
                azureAdId: profile?.sub as string,
                status: 'ACTIVE',
              },
            })

            // Assign default role (Data Processor)
            const defaultRole = await prisma.role.findUnique({
              where: { name: 'Data Processor' },
            })

            if (defaultRole) {
              await prisma.userRole.create({
                data: {
                  userId: newUser.id,
                  roleId: defaultRole.id,
                },
              })
            }

            console.log(`New user created: ${user.email}`)
          } else {
            // Update existing user
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: user.name!,
                image: user.image,
                azureAdId: profile?.sub as string,
              },
            })
          }
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
        // Set user ID from token
        session.user.id = token.sub

        // Fetch user with roles from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: {
            roles: {
              include: { role: true },
            },
          },
        })

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

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
  },

  events: {
    async signIn({ user, isNewUser }) {
      console.log(`User signed in: ${user.email}, New: ${isNewUser}`)
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token?.email}`)
    },
  },

  debug: process.env.NODE_ENV === 'development',
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
```

#### Step 3.2: Create API Route

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

---

### Phase 4: Middleware Setup (15 min)

Create `src/middleware.ts`:

```typescript
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/error', '/api/health']

// Routes only accessible when NOT authenticated
const authRoutes = ['/login', '/error']

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname

  // Allow API auth routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Allow public API routes
  if (pathname.startsWith('/api/health')) {
    return NextResponse.next()
  }

  // Allow static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Handle public routes
  if (publicRoutes.includes(pathname)) {
    // Redirect logged-in users away from auth pages
    if (isLoggedIn && authRoutes.includes(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return NextResponse.next()
  }

  // Protect all other routes
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
```

---

### Phase 5: Auth Pages (30 min)

#### Step 5.1: Create Auth Layout

Create `src/app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      {children}
    </div>
  )
}
```

#### Step 5.2: Create Login Page

Create `src/app/(auth)/login/page.tsx`:

```typescript
'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function LoginForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      await signIn('azure-ad', { callbackUrl })
    } catch (error) {
      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">
            AI Document Extraction
          </CardTitle>
          <CardDescription>
            Sign in with your corporate Microsoft account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">
              <div className="font-medium">Authentication Error</div>
              <div className="mt-1">
                {error === 'OAuthAccountNotLinked'
                  ? 'This email is already linked to another account.'
                  : error === 'AccessDenied'
                  ? 'You do not have permission to access this application.'
                  : 'An error occurred during authentication. Please try again.'}
              </div>
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Signing in...
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <svg className="h-5 w-5" viewBox="0 0 21 21" fill="currentColor">
                  <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z" />
                </svg>
                Sign in with Microsoft
              </span>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
```

#### Step 5.3: Create Error Page

Create `src/app/(auth)/error/page.tsx`:

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Configuration Error',
    description: 'There is a problem with the server configuration.',
  },
  AccessDenied: {
    title: 'Access Denied',
    description: 'You do not have permission to access this application.',
  },
  Verification: {
    title: 'Verification Failed',
    description: 'The verification token has expired or has already been used.',
  },
  OAuthSignin: {
    title: 'OAuth Sign In Error',
    description: 'Error occurred during OAuth sign in process.',
  },
  OAuthCallback: {
    title: 'OAuth Callback Error',
    description: 'Error occurred during OAuth callback process.',
  },
  OAuthCreateAccount: {
    title: 'Account Creation Failed',
    description: 'Could not create OAuth account.',
  },
  OAuthAccountNotLinked: {
    title: 'Account Not Linked',
    description: 'This email is already associated with another account.',
  },
  default: {
    title: 'Authentication Error',
    description: 'An unexpected error occurred during authentication.',
  },
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'default'
  const errorInfo = errorMessages[error] || errorMessages.default

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-red-600">
            {errorInfo.title}
          </CardTitle>
          <CardDescription>{errorInfo.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <div className="font-medium">Error Code</div>
            <code className="mt-1 text-xs">{error}</code>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href="/login">Try Again</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Return Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  )
}
```

---

### Phase 6: Dashboard Placeholder (15 min)

#### Step 6.1: Create Dashboard Layout

Create `src/app/(dashboard)/layout.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">AI Document Extraction</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {session.user?.name}
            </span>
            <form
              action={async () => {
                'use server'
                const { signOut } = await import('@/lib/auth')
                await signOut({ redirectTo: '/login' })
              }}
            >
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
```

#### Step 6.2: Create Dashboard Page

Create `src/app/(dashboard)/dashboard/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">User Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{session?.user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline">{session?.user?.status || 'ACTIVE'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {session?.user?.roles?.map((role) => (
                <Badge key={role.id} variant="secondary">
                  {role.name}
                </Badge>
              )) || <span className="text-muted-foreground">No roles assigned</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {session?.user?.roles?.reduce(
                (acc, role) => acc + role.permissions.length,
                0
              ) || 0}{' '}
              permissions granted
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

---

### Phase 7: Type Definitions (10 min)

Create `src/types/next-auth.d.ts`:

```typescript
import { DefaultSession, DefaultUser } from 'next-auth'
import type { UserStatus } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      status: UserStatus
      roles: {
        id: string
        name: string
        permissions: string[]
      }[]
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    status?: UserStatus
    roles?: {
      id: string
      name: string
      permissions: string[]
    }[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    accessToken?: string
  }
}
```

---

### Phase 8: Update Environment Template (5 min)

Update `.env.example`:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_document_extraction?schema=public"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Azure AD Configuration
AZURE_AD_CLIENT_ID="your-client-id"
AZURE_AD_CLIENT_SECRET="your-client-secret"
AZURE_AD_TENANT_ID="your-tenant-id"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
```

---

## Verification Checklist

### Authentication Flow

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Login Page | Navigate to /login | Shows login button | [ ] |
| Azure Redirect | Click login button | Redirects to Azure AD | [ ] |
| Login Success | Complete Azure auth | Redirects to /dashboard | [ ] |
| User Display | View dashboard | Shows user name and email | [ ] |
| Session Persist | Refresh page | Stays logged in | [ ] |

### Route Protection

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Protected Route | Access /dashboard without auth | Redirects to /login | [ ] |
| Auth Route | Access /login when logged in | Redirects to /dashboard | [ ] |
| Public Route | Access / | Accessible | [ ] |

### User Management

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| New User | First-time Azure login | Creates User record | [ ] |
| Default Role | Check new user roles | Has Data Processor role | [ ] |
| Session Roles | Check session.user.roles | Contains role data | [ ] |

### Logout

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Logout Button | Click Sign out | Returns to /login | [ ] |
| Session Clear | Access /dashboard after logout | Redirects to /login | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/lib/auth.ts` | NextAuth configuration |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth API route |
| `src/middleware.ts` | Route protection middleware |
| `src/app/(auth)/layout.tsx` | Auth pages layout |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/error/page.tsx` | Error page |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout |
| `src/app/(dashboard)/dashboard/page.tsx` | Dashboard page |
| `src/types/next-auth.d.ts` | NextAuth type extensions |
| `prisma/schema.prisma` | Updated with Account, Session models |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid redirect_uri" | Check Azure AD App redirect URI configuration |
| "NEXTAUTH_SECRET missing" | Generate with `openssl rand -base64 32` |
| Session not persisting | Verify cookie settings and NEXTAUTH_URL |
| User not created | Check database connection and Prisma logs |
| Roles not in session | Run `npx prisma db seed` to create roles |

---

## Next Steps

After completing Story 1-1:
1. Proceed to **Story 1-2** (User Database & Role Foundation)
2. Run seed data for roles: `npx prisma db seed`
3. Test complete authentication flow

---

*Generated by BMAD Method - Create Tech Spec Workflow*
