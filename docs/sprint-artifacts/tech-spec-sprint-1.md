# Sprint 1 Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Approved for Development

---

## Executive Summary

Sprint 1 establishes the foundational infrastructure for the AI Document Extraction System, covering three interdependent stories that create the technical foundation for all subsequent development.

| Story | Name | Objective | Dependencies |
|-------|------|-----------|--------------|
| 1-0 | Project Init Foundation | Initialize Next.js project with core dependencies | None |
| 1-1 | Azure AD SSO Login | Implement Azure AD authentication | Story 1-0 |
| 1-2 | User Database & Role Foundation | Establish RBAC infrastructure | Story 1-0, 1-1 |

**Sprint Goal:** Deliver a working authentication system with role-based access control that enables team members to log in via Azure AD and be assigned appropriate roles.

---

## Table of Contents

1. [Environment Configuration](#1-environment-configuration)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Story 1-0: Project Init Foundation](#4-story-1-0-project-init-foundation)
5. [Story 1-1: Azure AD SSO Login](#5-story-1-1-azure-ad-sso-login)
6. [Story 1-2: User Database & Role Foundation](#6-story-1-2-user-database-role-foundation)
7. [Database Schema](#7-database-schema)
8. [API Specifications](#8-api-specifications)
9. [Security Considerations](#9-security-considerations)
10. [Testing Strategy](#10-testing-strategy)
11. [Deployment Configuration](#11-deployment-configuration)
12. [Appendices](#12-appendices)

---

## 1. Environment Configuration

### 1.1 Development Environment

| Component | Local Development | Production |
|-----------|-------------------|------------|
| Database | Docker PostgreSQL (localhost:5432) | Azure PostgreSQL |
| Azure AD | Production App Registration (shared) | Azure AD Production |
| Runtime | Node.js 20.x LTS | Azure App Service |
| Container | Docker Desktop | Azure Container Registry |

### 1.2 Environment Variables

```bash
# .env.local (Development)

# Database - Local Docker
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_document_extraction?schema=public"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Azure AD Configuration (Production credentials)
AZURE_AD_CLIENT_ID="<your-client-id>"
AZURE_AD_CLIENT_SECRET="<your-client-secret>"
AZURE_AD_TENANT_ID="<your-tenant-id>"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"
```

```bash
# .env.production (Azure Deployment)

# Database - Azure PostgreSQL
DATABASE_URL="postgresql://<user>:<password>@<server>.postgres.database.azure.com:5432/ai_document_extraction?schema=public&sslmode=require"

# Azure AD Configuration
AZURE_AD_CLIENT_ID="${AZURE_AD_CLIENT_ID}"
AZURE_AD_CLIENT_SECRET="${AZURE_AD_CLIENT_SECRET}"
AZURE_AD_TENANT_ID="${AZURE_AD_TENANT_ID}"

# NextAuth Configuration
NEXTAUTH_URL="https://<your-app>.azurewebsites.net"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
```

### 1.3 Local Docker PostgreSQL Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: ai-doc-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_document_extraction
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**Docker Commands:**
```bash
# Start PostgreSQL
docker-compose up -d

# Stop PostgreSQL
docker-compose down

# View logs
docker-compose logs -f postgres
```

---

## 2. Technology Stack

### 2.1 Core Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | Full-stack React framework |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | Latest | UI component library |
| Prisma | 5.x | ORM & database toolkit |
| NextAuth | v5 (beta) | Authentication |

### 2.2 Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| ESLint | 8.x | Linting |
| Prettier | 3.x | Code formatting |
| ts-node | 10.x | TypeScript execution |
| @types/node | Latest | Node.js types |

### 2.3 State Management

| Technology | Purpose |
|------------|---------|
| Zustand | Client-side UI state |
| React Query v5 | Server state management |
| React Hook Form | Form handling |
| Zod | Schema validation |

---

## 3. Architecture Overview

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Browser   │  │  React 19   │  │     Zustand + RQ        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS APP LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  App Router │  │  API Routes │  │     Middleware          │ │
│  │   (Pages)   │  │    (BFF)    │  │  (Auth Protection)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   NextAuth  │  │   Prisma    │  │    Business Services    │ │
│  │  (Azure AD) │  │  (ORM)      │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   PostgreSQL Database                        ││
│  │   (Docker Local / Azure PostgreSQL Production)              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Authentication Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  User    │────▶│  Login Page  │────▶│   Azure AD   │────▶│ Callback │
└──────────┘     └──────────────┘     └──────────────┘     └──────────┘
                                                                  │
                                                                  ▼
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│Dashboard │◀────│  Middleware  │◀────│   NextAuth   │◀────│ Create/  │
│  (Home)  │     │  (Protect)   │     │   Session    │     │Update DB │
└──────────┘     └──────────────┘     └──────────────┘     └──────────┘
```

### 3.3 Directory Structure

```
ai-document-extraction/
├── .env.example                    # Environment template
├── .env.local                      # Local environment (gitignored)
├── .eslintrc.json                  # ESLint configuration
├── .prettierrc                     # Prettier configuration
├── .gitignore                      # Git ignore rules
├── components.json                 # shadcn/ui configuration
├── docker-compose.yml              # Local PostgreSQL
├── next.config.mjs                 # Next.js configuration
├── package.json                    # Dependencies
├── tailwind.config.ts              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
│
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── migrations/                # Migration files
│   └── seed.ts                    # Seed data script
│
├── public/
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   └── locales/
│       ├── en.json
│       └── zh-TW.json
│
├── src/
│   ├── app/
│   │   ├── globals.css            # Global styles
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Home page (redirect)
│   │   │
│   │   ├── (auth)/                # Auth route group
│   │   │   ├── layout.tsx         # Auth layout (centered)
│   │   │   ├── login/
│   │   │   │   └── page.tsx       # Login page
│   │   │   └── error/
│   │   │       └── page.tsx       # Auth error page
│   │   │
│   │   ├── (dashboard)/           # Protected route group
│   │   │   ├── layout.tsx         # Dashboard layout (sidebar)
│   │   │   └── dashboard/
│   │   │       └── page.tsx       # Dashboard home
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts   # NextAuth API
│   │       ├── roles/
│   │       │   └── route.ts       # Roles API
│   │       └── health/
│   │           └── route.ts       # Health check
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── table.tsx
│   │   │   └── toast.tsx
│   │   │
│   │   ├── features/              # Feature components
│   │   │   └── auth/
│   │   │       ├── LoginButton.tsx
│   │   │       ├── LogoutButton.tsx
│   │   │       └── UserMenu.tsx
│   │   │
│   │   └── layouts/               # Layout components
│   │       ├── AuthLayout.tsx
│   │       ├── DashboardLayout.tsx
│   │       └── Sidebar.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── utils.ts               # Utility functions
│   │   └── validations/           # Zod schemas
│   │       └── user.schema.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth hook
│   │   └── useRoles.ts            # Roles hook
│   │
│   ├── services/
│   │   ├── role.service.ts        # Role service layer
│   │   └── user.service.ts        # User service layer
│   │
│   ├── stores/
│   │   └── ui.store.ts            # UI state store
│   │
│   ├── types/
│   │   ├── next-auth.d.ts         # NextAuth type extensions
│   │   ├── permissions.ts         # Permission constants
│   │   ├── role-permissions.ts    # Role-permission mapping
│   │   ├── role.ts                # Role types
│   │   └── user.ts                # User types
│   │
│   └── middleware.ts              # Route protection
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 4. Story 1-0: Project Init Foundation

### 4.1 Objective

Initialize the Next.js project with all core dependencies, configuration files, and directory structure to enable development of subsequent stories.

### 4.2 Implementation Steps

#### Step 1: Create Next.js Project

```bash
npx create-next-app@latest ai-document-extraction \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

#### Step 2: Initialize shadcn/ui

```bash
cd ai-document-extraction
npx shadcn@latest init
```

**shadcn/ui Configuration (components.json):**
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

#### Step 3: Install UI Components

```bash
npx shadcn@latest add button card table dialog toast form input label badge tabs
```

#### Step 4: Install Core Dependencies

```bash
# Prisma ORM
npm install prisma @prisma/client

# State Management
npm install zustand @tanstack/react-query

# Form & Validation
npm install zod react-hook-form @hookform/resolvers

# Development
npm install -D prettier ts-node @types/node
```

#### Step 5: Initialize Prisma

```bash
npx prisma init
```

### 4.3 Configuration Files

#### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### ESLint Configuration (.eslintrc.json)

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error"
  }
}
```

#### Prettier Configuration (.prettierrc)

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 4.4 Core Files

#### Prisma Client Singleton (src/lib/prisma.ts)

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

#### Utility Functions (src/lib/utils.ts)

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}
```

### 4.5 Validation Checklist

| Item | Command | Expected Result |
|------|---------|-----------------|
| Dev Server | `npm run dev` | Runs on localhost:3000 |
| Build | `npm run build` | No errors |
| Lint | `npm run lint` | No errors |
| TypeScript | `npx tsc --noEmit` | No type errors |
| Prisma | `npx prisma generate` | Client generated |

---

## 5. Story 1-1: Azure AD SSO Login

### 5.1 Objective

Implement Azure AD Single Sign-On authentication using NextAuth v5, enabling users to log in with their corporate Microsoft accounts.

### 5.2 Azure AD App Registration

**Required Azure Portal Configuration:**

1. Navigate to Azure Portal > Azure Active Directory > App registrations
2. Create new registration or use existing
3. Configure redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/azure-ad`
   - Production: `https://<your-domain>/api/auth/callback/azure-ad`
4. Generate client secret
5. Note: Client ID, Client Secret, Tenant ID

### 5.3 Dependencies

```bash
npm install next-auth@beta @auth/prisma-adapter
```

### 5.4 Implementation

#### NextAuth Configuration (src/lib/auth.ts)

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
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { roles: true },
          })

          if (!existingUser) {
            // Create new user with default role
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
          } else {
            // Update existing user's Azure AD info
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
          console.error('Sign in error:', error)
          return false
        }
      }
      return true
    },

    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub

        // Fetch user roles from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          include: {
            roles: {
              include: { role: true },
            },
          },
        })

        if (dbUser) {
          session.user.roles = dbUser.roles.map((ur) => ({
            id: ur.role.id,
            name: ur.role.name,
            permissions: ur.role.permissions,
          }))
          session.user.status = dbUser.status
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
      console.log(`User ${user.email} signed in. New user: ${isNewUser}`)
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token?.email}`)
    },
  },
  debug: process.env.NODE_ENV === 'development',
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
```

#### API Route (src/app/api/auth/[...nextauth]/route.ts)

```typescript
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

#### Middleware (src/middleware.ts)

```typescript
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/error', '/api/health']

// Routes that are only accessible when NOT authenticated
const authRoutes = ['/login', '/error']

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname

  // Allow API auth routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    // If logged in and trying to access auth pages, redirect to dashboard
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

#### Login Page (src/app/(auth)/login/page.tsx)

```typescript
'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
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
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">AI Document Extraction</CardTitle>
          <CardDescription>Sign in with your corporate account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-500">
              {error === 'OAuthAccountNotLinked'
                ? 'This email is already linked to another account.'
                : 'An error occurred during authentication. Please try again.'}
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
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
              <span className="flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 21 21" fill="currentColor">
                  <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z" />
                </svg>
                Sign in with Microsoft
              </span>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### Auth Layout (src/app/(auth)/layout.tsx)

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      {children}
    </div>
  )
}
```

#### Error Page (src/app/(auth)/error/page.tsx)

```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'You do not have permission to access this application.',
  Verification: 'The verification token has expired or has already been used.',
  OAuthSignin: 'Error occurred during OAuth sign in.',
  OAuthCallback: 'Error occurred during OAuth callback.',
  OAuthCreateAccount: 'Could not create OAuth account.',
  EmailCreateAccount: 'Could not create email account.',
  Callback: 'Error occurred during callback.',
  OAuthAccountNotLinked: 'This email is already associated with another account.',
  default: 'An unexpected error occurred.',
}

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'default'

  const errorMessage = errorMessages[error] || errorMessages.default

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-red-600">
            Authentication Error
          </CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-500">
            Error Code: {error}
          </div>
          <Button asChild className="w-full">
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 5.5 Session Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| Strategy | JWT | Stateless session storage |
| Max Age | 8 hours | Session lifetime |
| Idle Timeout | 30 minutes | Implemented via client-side check |

### 5.6 Validation Checklist

| Item | Test Method | Expected Result |
|------|-------------|-----------------|
| Login Button | Click "Sign in with Microsoft" | Redirects to Azure AD |
| Login Success | Complete Azure AD auth | Redirects to dashboard |
| Protected Routes | Access /dashboard without auth | Redirects to /login |
| Session Persistence | Refresh page after login | Stays logged in |
| Logout | Click logout button | Clears session, redirects to login |
| First Login | New Azure AD user | Creates User record in DB |

---

## 6. Story 1-2: User Database & Role Foundation

### 6.1 Objective

Establish the Role-Based Access Control (RBAC) infrastructure with predefined roles and automatic role assignment for new users.

### 6.2 Role Definitions

| Role | Description | Default Assignment |
|------|-------------|-------------------|
| System Admin | Full system access | Manual only |
| Super User | Rule and forwarder management | Manual only |
| Data Processor | Basic invoice processing | Auto (first login) |
| City Manager | City-level management | Manual only |
| Regional Manager | Multi-city management | Manual only |
| Auditor | Read-only audit access | Manual only |

### 6.3 Permission System

#### Permission Constants (src/types/permissions.ts)

```typescript
export const PERMISSIONS = {
  // Invoice Operations
  INVOICE_VIEW: 'invoice:view',
  INVOICE_CREATE: 'invoice:create',
  INVOICE_REVIEW: 'invoice:review',
  INVOICE_APPROVE: 'invoice:approve',

  // Report Operations
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  // Rule Management
  RULE_VIEW: 'rule:view',
  RULE_MANAGE: 'rule:manage',
  RULE_APPROVE: 'rule:approve',

  // Forwarder Management
  FORWARDER_VIEW: 'forwarder:view',
  FORWARDER_MANAGE: 'forwarder:manage',

  // User Management
  USER_VIEW: 'user:view',
  USER_MANAGE: 'user:manage',
  USER_MANAGE_CITY: 'user:manage:city',
  USER_MANAGE_REGION: 'user:manage:region',

  // System Administration
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_MONITOR: 'system:monitor',

  // Audit Operations
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
```

#### Role-Permission Mapping (src/types/role-permissions.ts)

```typescript
import { PERMISSIONS } from './permissions'

export const ROLE_PERMISSIONS = {
  'Data Processor': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
  ],

  'City Manager': [
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

  'Regional Manager': [
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

  'Super User': [
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

  Auditor: [
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
  ],

  'System Admin': Object.values(PERMISSIONS),
} as const

export type RoleName = keyof typeof ROLE_PERMISSIONS
```

### 6.4 Service Layer

#### Role Service (src/services/role.service.ts)

```typescript
import { prisma } from '@/lib/prisma'
import type { Role, UserRole } from '@prisma/client'

export async function getAllRoles(): Promise<Role[]> {
  return prisma.role.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getRoleByName(name: string): Promise<Role | null> {
  return prisma.role.findUnique({
    where: { name },
  })
}

export async function getUserRoles(userId: string): Promise<Role[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  })
  return userRoles.map((ur) => ur.role)
}

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

export async function removeRoleFromUser(userId: string, roleId: string): Promise<void> {
  await prisma.userRole.delete({
    where: {
      userId_roleId: { userId, roleId },
    },
  })
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  })

  return userRoles.some((ur) => ur.role.permissions.includes(permission))
}

export async function hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  })

  return userRoles.some((ur) =>
    permissions.some((p) => ur.role.permissions.includes(p))
  )
}
```

### 6.5 Seed Data

#### Seed Script (prisma/seed.ts)

```typescript
import { PrismaClient } from '@prisma/client'
import { ROLE_PERMISSIONS } from '../src/types/role-permissions'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Define all system roles
  const roles = [
    {
      name: 'System Admin',
      description: 'Full system access with all permissions',
    },
    {
      name: 'Super User',
      description: 'Can manage rules and forwarder configurations',
    },
    {
      name: 'Data Processor',
      description: 'Basic invoice processing and review permissions',
    },
    {
      name: 'City Manager',
      description: 'Can manage users and data within their assigned city',
    },
    {
      name: 'Regional Manager',
      description: 'Can manage users and data across multiple cities in their region',
    },
    {
      name: 'Auditor',
      description: 'Read-only access to reports and audit logs',
    },
  ]

  // Upsert each role
  for (const role of roles) {
    const permissions =
      ROLE_PERMISSIONS[role.name as keyof typeof ROLE_PERMISSIONS] || []

    const result = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        permissions: permissions,
      },
      create: {
        name: role.name,
        description: role.description,
        permissions: permissions,
        isSystem: true,
      },
    })

    console.log(`✓ Role: ${result.name} (${permissions.length} permissions)`)
  }

  console.log('\nSeed completed successfully!')
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

#### Package.json Seed Configuration

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

### 6.6 API Endpoints

#### Roles API (src/app/api/roles/route.ts)

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAllRoles } from '@/services/role.service'
import { PERMISSIONS } from '@/types/permissions'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { title: 'Unauthorized', status: 401 } },
        { status: 401 }
      )
    }

    // Check if user has permission to view roles
    const hasPermission = session.user.roles?.some(
      (role) =>
        role.permissions.includes(PERMISSIONS.USER_MANAGE) ||
        role.permissions.includes(PERMISSIONS.SYSTEM_CONFIG)
    )

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: { title: 'Forbidden', status: 403 } },
        { status: 403 }
      )
    }

    const roles = await getAllRoles()

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

### 6.7 Type Extensions

#### NextAuth Types (src/types/next-auth.d.ts)

```typescript
import { DefaultSession, DefaultUser } from 'next-auth'
import { UserStatus } from '@prisma/client'

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

### 6.8 Validation Checklist

| Item | Test Method | Expected Result |
|------|-------------|-----------------|
| Seed Data | `npx prisma db seed` | 6 roles created |
| Role Query | GET `/api/roles` | Returns all roles |
| First Login | New Azure AD user | Assigned Data Processor role |
| Session Roles | Check session after login | Contains role and permissions |
| Permission Check | Call hasPermission() | Returns correct boolean |

---

## 7. Database Schema

### 7.1 Complete Prisma Schema (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===========================================
// Authentication Models (NextAuth Required)
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

// ===========================================
// User & Role Models
// ===========================================

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

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  permissions String[] // Array of permission strings
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")

  // Relations
  users UserRole[]

  @@map("roles")
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  roleId    String   @map("role_id")
  cityId    String?  @map("city_id") // For city-scoped roles
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@map("user_roles")
}

// ===========================================
// Enums
// ===========================================

enum UserStatus {
  ACTIVE
  INACTIVE
}
```

### 7.2 Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐
│      User        │       │     Account      │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │──────<│ userId (FK)      │
│ email (UNIQUE)   │       │ provider         │
│ name             │       │ providerAccountId│
│ image            │       │ access_token     │
│ azureAdId        │       │ refresh_token    │
│ status           │       │ ...              │
│ createdAt        │       └──────────────────┘
│ updatedAt        │
└────────┬─────────┘
         │
         │ 1:N
         │
         ▼
┌──────────────────┐       ┌──────────────────┐
│    UserRole      │       │      Role        │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ userId (FK)      │──────<│ name (UNIQUE)    │
│ roleId (FK)      │>──────│ description      │
│ cityId           │       │ permissions[]    │
│ createdAt        │       │ isSystem         │
└──────────────────┘       │ createdAt        │
                           └──────────────────┘
```

### 7.3 Migration Commands

```bash
# Create migration
npx prisma migrate dev --name init

# Apply migration to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate

# Run seed data
npx prisma db seed

# Open Prisma Studio
npx prisma studio
```

---

## 8. API Specifications

### 8.1 Response Format

All API responses follow RFC 7807 Problem Details standard:

```typescript
// Success Response
interface SuccessResponse<T> {
  success: true
  data: T
  meta?: {
    total?: number
    page?: number
    pageSize?: number
  }
}

// Error Response
interface ErrorResponse {
  success: false
  error: {
    type?: string
    title: string
    status: number
    detail?: string
    instance?: string
  }
}
```

### 8.2 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handlers | No |
| GET | `/api/health` | Health check | No |
| GET | `/api/roles` | Get all roles | Yes (Admin) |

### 8.3 Health Check API (src/app/api/health/route.ts)

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
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

## 9. Security Considerations

### 9.1 Authentication Security

| Aspect | Implementation |
|--------|----------------|
| Session Strategy | JWT (stateless, scalable) |
| Session Duration | 8 hours maximum |
| Token Storage | HTTP-only cookies |
| CSRF Protection | NextAuth built-in |
| OAuth Provider | Azure AD (enterprise) |

### 9.2 Authorization Security

| Aspect | Implementation |
|--------|----------------|
| Access Control | Role-Based (RBAC) |
| Permission Check | Server-side only |
| Route Protection | Middleware-based |
| API Protection | Session validation |

### 9.3 Data Security

| Aspect | Implementation |
|--------|----------------|
| Database Connection | SSL/TLS encrypted |
| Sensitive Data | Never logged |
| Environment Variables | .env files (gitignored) |
| Secrets Management | Azure Key Vault (production) |

### 9.4 Security Checklist

- [ ] All environment variables in .env.local (not committed)
- [ ] NEXTAUTH_SECRET is cryptographically random (32+ chars)
- [ ] Production uses HTTPS only
- [ ] Azure AD redirect URIs are properly configured
- [ ] Database connection uses SSL in production
- [ ] No sensitive data in client-side code
- [ ] API routes validate session before processing

---

## 10. Testing Strategy

### 10.1 Manual Testing Checklist

#### Story 1-0: Project Init

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Dev Server | Run `npm run dev` | Server starts on port 3000 |
| Build | Run `npm run build` | Builds without errors |
| Lint | Run `npm run lint` | No ESLint errors |
| Type Check | Run `npx tsc --noEmit` | No TypeScript errors |
| Prisma Generate | Run `npx prisma generate` | Client generated |

#### Story 1-1: Azure AD Login

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Login Page | Navigate to /login | Shows login button |
| Azure Redirect | Click login button | Redirects to Azure AD |
| Successful Login | Complete Azure auth | Redirects to dashboard |
| Protected Route | Access /dashboard without auth | Redirects to login |
| Session Persist | Refresh after login | Stays logged in |
| Logout | Click logout | Returns to login page |
| New User | First-time Azure login | Creates DB record |

#### Story 1-2: Roles & Permissions

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Seed Roles | Run `npx prisma db seed` | 6 roles created |
| View Roles | GET /api/roles (as admin) | Returns role list |
| Default Role | New user login | Has Data Processor role |
| Session Roles | Check session.user.roles | Contains assigned roles |
| Permission Check | Access admin feature | Properly restricted |

### 10.2 Integration Test Scenarios

```typescript
// tests/integration/auth.test.ts (Future implementation)
describe('Authentication Flow', () => {
  it('should redirect unauthenticated users to login')
  it('should allow authenticated users to access dashboard')
  it('should create new user on first Azure AD login')
  it('should assign default role to new users')
  it('should include roles in session')
})
```

---

## 11. Deployment Configuration

### 11.1 Local Development

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 4. Initialize database
npx prisma generate
npx prisma migrate dev
npx prisma db seed

# 5. Start development server
npm run dev
```

### 11.2 Production Deployment (Azure)

```bash
# 1. Set environment variables in Azure App Service
# DATABASE_URL, AZURE_AD_*, NEXTAUTH_*

# 2. Build
npm run build

# 3. Run migrations
npx prisma migrate deploy

# 4. Seed data (if needed)
npx prisma db seed

# 5. Start
npm start
```

### 11.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Build
        run: npm run build

      - name: Deploy to Azure
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
```

---

## 12. Appendices

### 12.1 Troubleshooting

| Issue | Solution |
|-------|----------|
| Prisma generate fails | Check DATABASE_URL format |
| Azure AD login fails | Verify redirect URI configuration |
| Session not persisting | Check NEXTAUTH_SECRET is set |
| Permission denied | Verify role assignment |
| Build fails | Run `npx tsc --noEmit` for type errors |

### 12.2 Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run lint                   # Run ESLint
npm run lint -- --fix          # Fix ESLint issues

# Database
npx prisma generate            # Generate Prisma Client
npx prisma migrate dev         # Run migrations (dev)
npx prisma migrate deploy      # Run migrations (prod)
npx prisma db seed             # Run seed data
npx prisma studio              # Open Prisma Studio
npx prisma migrate reset       # Reset database (dev only)

# Docker
docker-compose up -d           # Start PostgreSQL
docker-compose down            # Stop PostgreSQL
docker-compose logs -f         # View logs

# Utilities
openssl rand -base64 32        # Generate NEXTAUTH_SECRET
```

### 12.3 Reference Links

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js v5 Documentation](https://authjs.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Azure AD Integration](https://docs.microsoft.com/azure/active-directory/)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-16 | BMAD System | Initial creation |

---

*Generated by BMAD Method - Create Tech Spec Workflow*
