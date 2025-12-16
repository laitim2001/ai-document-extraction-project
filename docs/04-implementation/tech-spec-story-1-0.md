# Story 1-0: Project Init Foundation - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 1-0-project-init-foundation

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 1.0 |
| Epic | Epic 1: User Authentication & Access Control |
| Estimated Effort | Medium |
| Dependencies | None |
| Blocking | Story 1.1, 1.2, and all subsequent stories |

---

## Objective

Initialize a production-ready Next.js 15 project with all core dependencies, configuration files, and directory structure that serves as the foundation for the AI Document Extraction System.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Next.js 15.x with TypeScript strict mode | `create-next-app` with TypeScript, App Router |
| AC2 | shadcn/ui initialized with 10 base components | `npx shadcn@latest init` + component installation |
| AC3 | Standard directory structure | Create required folders under `src/` |
| AC4 | Prisma ORM with PostgreSQL | `npx prisma init`, create singleton client |

---

## Implementation Guide

### Phase 1: Project Creation (15 min)

#### Step 1.1: Create Next.js Project

```bash
# Navigate to parent directory
cd C:\Users\rci.ChrisLai\Documents\GitHub

# Create new Next.js project
npx create-next-app@latest ai-document-extraction \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# Navigate to project
cd ai-document-extraction
```

**Verification:**
- [ ] Project created successfully
- [ ] `src/` directory exists
- [ ] `tsconfig.json` has strict mode enabled
- [ ] `package.json` shows Next.js 15.x

#### Step 1.2: Verify TypeScript Strict Mode

Ensure `tsconfig.json` contains:
```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

### Phase 2: UI Framework Setup (20 min)

#### Step 2.1: Initialize shadcn/ui

```bash
npx shadcn@latest init
```

**Configuration Prompts:**
- Style: **default**
- Base color: **slate**
- CSS variables: **yes**
- tailwind.config location: **tailwind.config.ts**
- components.json location: **./components.json**
- Components path: **@/components**
- Utilities path: **@/lib/utils**
- React Server Components: **yes**

**Verification:**
- [ ] `components.json` created
- [ ] `src/lib/utils.ts` created
- [ ] `tailwind.config.ts` updated

#### Step 2.2: Install Base UI Components

```bash
npx shadcn@latest add button card table dialog toast form input label badge tabs
```

**Expected Files in `src/components/ui/`:**
- `button.tsx`
- `card.tsx`
- `table.tsx`
- `dialog.tsx`
- `toast.tsx` + `toaster.tsx` + `use-toast.ts`
- `form.tsx`
- `input.tsx`
- `label.tsx`
- `badge.tsx`
- `tabs.tsx`

---

### Phase 3: Directory Structure (10 min)

#### Step 3.1: Create Directory Structure

```bash
# Create all required directories
mkdir -p src/components/features
mkdir -p src/components/layouts
mkdir -p src/lib/validations
mkdir -p src/hooks
mkdir -p src/stores
mkdir -p src/services
mkdir -p src/types
mkdir -p tests/unit
mkdir -p tests/integration
mkdir -p tests/e2e
mkdir -p public/assets/images
mkdir -p public/assets/icons
mkdir -p public/locales
```

#### Step 3.2: Create Placeholder Files

Create `.gitkeep` files to preserve empty directories:

```bash
touch src/components/features/.gitkeep
touch src/components/layouts/.gitkeep
touch src/lib/validations/.gitkeep
touch src/hooks/.gitkeep
touch src/stores/.gitkeep
touch src/services/.gitkeep
touch src/types/.gitkeep
touch tests/unit/.gitkeep
touch tests/integration/.gitkeep
touch tests/e2e/.gitkeep
```

---

### Phase 4: Prisma Setup (15 min)

#### Step 4.1: Install Prisma Dependencies

```bash
npm install prisma @prisma/client
npm install -D ts-node
```

#### Step 4.2: Initialize Prisma

```bash
npx prisma init
```

#### Step 4.3: Configure Database Connection

Update `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ===========================================
// User & Role Models (Foundation)
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

  roles UserRole[]

  @@map("users")
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  permissions String[]
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")

  users UserRole[]

  @@map("roles")
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  roleId    String   @map("role_id")
  cityId    String?  @map("city_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@map("user_roles")
}

enum UserStatus {
  ACTIVE
  INACTIVE
}
```

#### Step 4.4: Create Prisma Client Singleton

Create `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
```

---

### Phase 5: Additional Dependencies (10 min)

#### Step 5.1: Install State Management

```bash
npm install zustand @tanstack/react-query
```

#### Step 5.2: Install Form & Validation

```bash
npm install zod react-hook-form @hookform/resolvers
```

#### Step 5.3: Install Development Tools

```bash
npm install -D prettier
```

---

### Phase 6: Configuration Files (15 min)

#### Step 6.1: Environment Variables Template

Create `.env.example`:

```bash
# Database - Local Docker PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_document_extraction?schema=public"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Azure AD (Story 1.1)
# AZURE_AD_CLIENT_ID=""
# AZURE_AD_CLIENT_SECRET=""
# AZURE_AD_TENANT_ID=""

# NextAuth (Story 1.1)
# NEXTAUTH_URL=""
# NEXTAUTH_SECRET=""
```

Create `.env.local` (copy from .env.example and fill in values).

#### Step 6.2: ESLint Configuration

Update `.eslintrc.json`:

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

#### Step 6.3: Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

#### Step 6.4: Update .gitignore

Add to `.gitignore`:

```
# Local environment
.env.local
.env.development.local
.env.test.local
.env.production.local

# Prisma
prisma/migrations/*_dev*

# IDE
.idea/
.vscode/settings.json

# OS
.DS_Store
Thumbs.db
```

---

### Phase 7: Docker Setup (10 min)

#### Step 7.1: Create Docker Compose

Create `docker-compose.yml`:

```yaml
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

#### Step 7.2: Start Database

```bash
docker-compose up -d
```

---

### Phase 8: Initialize Database (10 min)

#### Step 8.1: Generate Prisma Client

```bash
npx prisma generate
```

#### Step 8.2: Run Initial Migration

```bash
npx prisma migrate dev --name init
```

---

### Phase 9: Create Base Pages (15 min)

#### Step 9.1: Update Root Layout

Update `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Document Extraction',
  description: 'AI-powered document extraction and processing system',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

#### Step 9.2: Update Home Page

Update `src/app/page.tsx`:

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            AI Document Extraction
          </CardTitle>
          <CardDescription>
            Intelligent document processing powered by AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-gray-500">
            Project initialized successfully. Ready for development.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline">Documentation</Button>
            <Button>Get Started</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
```

---

## Verification Checklist

### Build Verification

| Command | Expected Result | Status |
|---------|-----------------|--------|
| `npm run dev` | Server starts on port 3000 | [ ] |
| `npm run build` | Builds without errors | [ ] |
| `npm run lint` | No ESLint errors | [ ] |
| `npx tsc --noEmit` | No TypeScript errors | [ ] |

### Database Verification

| Command | Expected Result | Status |
|---------|-----------------|--------|
| `docker-compose ps` | postgres container running | [ ] |
| `npx prisma generate` | Client generated | [ ] |
| `npx prisma migrate status` | No pending migrations | [ ] |
| `npx prisma studio` | Opens database viewer | [ ] |

### File Structure Verification

| Directory/File | Exists | Status |
|----------------|--------|--------|
| `src/components/ui/button.tsx` | Yes | [ ] |
| `src/lib/prisma.ts` | Yes | [ ] |
| `src/lib/utils.ts` | Yes | [ ] |
| `prisma/schema.prisma` | Yes | [ ] |
| `docker-compose.yml` | Yes | [ ] |
| `.env.example` | Yes | [ ] |
| `components.json` | Yes | [ ] |

---

## File List (Expected Output)

### Created Files

| File Path | Description |
|-----------|-------------|
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/app/layout.tsx` | Updated root layout |
| `src/app/page.tsx` | Updated home page |
| `prisma/schema.prisma` | Database schema |
| `docker-compose.yml` | PostgreSQL container |
| `.env.example` | Environment template |
| `.prettierrc` | Prettier configuration |

### Generated Files (by tools)

| File Path | Generated By |
|-----------|--------------|
| `components.json` | shadcn/ui init |
| `src/lib/utils.ts` | shadcn/ui init |
| `src/components/ui/*` | shadcn/ui add |
| `prisma/migrations/*` | prisma migrate |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 5432 in use | Stop other PostgreSQL instances or change port |
| Prisma generate fails | Check DATABASE_URL format |
| shadcn/ui init fails | Ensure Tailwind CSS is properly configured |
| TypeScript errors | Run `npm install` and check tsconfig.json |

---

## Next Steps

After completing Story 1-0:
1. Proceed to **Story 1-1** (Azure AD SSO Login)
2. Ensure Docker PostgreSQL is running
3. Verify all components render correctly

---

*Generated by BMAD Method - Create Tech Spec Workflow*
