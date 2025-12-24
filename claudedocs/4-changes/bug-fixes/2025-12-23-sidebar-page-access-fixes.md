# Bug Fix Report: Sidebar Page Access Issues

**Date**: 2025-12-23
**Related Task**: REFACTOR-001 Sidebar Testing
**Status**: Resolved

---

## Executive Summary

During sidebar navigation testing after the REFACTOR-001 (Forwarder → Company) refactoring, three distinct issues were discovered and fixed:

1. **Permission Wildcard Issue** - Multiple pages showing `access_denied`
2. **pdfjs-dist SSR Error** - `/review` page throwing server-side rendering error
3. **Tailwind Config ESM Issue** - Build error with ES module imports

---

## Issue 1: Permission Wildcard Not Recognized

### Affected Pages
- `/forwarders`
- `/forwarders/new`
- `/admin/users`
- `/admin/roles`
- `/admin/monitoring/health`

### Symptoms
Users were redirected to `/dashboard?error=access_denied` when accessing these pages, even though they had full permissions (`['*']`) in development mode.

### Root Cause
The `hasPermission` function in `src/middlewares/resource-access.ts` used direct array `includes()` check:

```typescript
// Original code - doesn't recognize wildcard
role.permissions.includes(requiredPermission)
```

In development mode, users are assigned `permissions: ['*']` (wildcard), but the direct check `['*'].includes('users:read')` returns `false`.

### Solution
Modified `hasPermission` to support wildcard permissions:

```typescript
// Fixed code
const hasPermission = (
  userPermissions: string[],
  requiredPermission: string
): boolean => {
  // Check for wildcard permission
  if (userPermissions.includes('*')) {
    return true
  }
  return userPermissions.includes(requiredPermission)
}
```

### Files Modified
- `src/middlewares/resource-access.ts`
- `src/app/(dashboard)/forwarders/new/page.tsx`
- `src/app/(dashboard)/admin/roles/page.tsx`
- `src/app/(dashboard)/admin/monitoring/health/page.tsx`

---

## Issue 2: pdfjs-dist SSR Compatibility Error

### Affected Pages
- `/review` (Review Queue List)
- `/review/[id]` (Review Detail)

### Error Message
```
TypeError: Object.defineProperty called on non-object
    at (ssr)/./node_modules/pdfjs-dist/build/pdf.mjs
    at ./src/components/features/review/PdfViewer/PdfViewer.tsx
    at ./src/components/features/review/PdfViewer/index.ts
    at ./src/components/features/review/index.ts
    at ./src/app/(dashboard)/review/page.tsx
```

### Root Cause Analysis

**The Problem:**
`pdfjs-dist` is an ESM module that relies on browser APIs (`window`, `document`). When Next.js performs Server-Side Rendering (SSR), it attempts to load the module in Node.js environment, causing the error.

**Why Dynamic Import Alone Wasn't Enough:**
Even though we created `DynamicPdfViewer` using `next/dynamic` with `ssr: false`, the error persisted because of **barrel export behavior**.

```typescript
// PdfViewer/index.ts (original)
export { PdfViewer } from './PdfViewer'        // ← Problem!
export { DynamicPdfViewer } from './DynamicPdfViewer'
```

When any file imports from the barrel:
```typescript
import { DynamicPdfViewer } from './PdfViewer'  // Imports from index.ts
```

Webpack loads ALL exports from `index.ts`, including `PdfViewer`, which triggers the pdfjs-dist import during SSR.

### Solution

1. **Created Dynamic Wrapper** (`DynamicPdfViewer.tsx`):
```typescript
'use client'
import dynamic from 'next/dynamic'
import { PdfLoadingSkeleton } from './PdfLoadingSkeleton'

const DynamicPdfViewer = dynamic(
  () => import('./PdfViewer').then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => <PdfLoadingSkeleton />,
  }
)

export { DynamicPdfViewer }
```

2. **Removed PdfViewer from Barrel Export** (`PdfViewer/index.ts`):
```typescript
// Don't export PdfViewer directly - it causes SSR errors!
// If needed, import directly from './PdfViewer/PdfViewer'
export { DynamicPdfViewer } from './DynamicPdfViewer'
export { PdfToolbar } from './PdfToolbar'
export { PdfHighlightOverlay } from './PdfHighlightOverlay'
export { PdfLoadingSkeleton } from './PdfLoadingSkeleton'
```

3. **Updated Parent Barrel** (`review/index.ts`):
```typescript
// Only export DynamicPdfViewer, not PdfViewer
export { DynamicPdfViewer } from './PdfViewer'
```

4. **Updated Consumer** (`review/[id]/page.tsx`):
```typescript
import { DynamicPdfViewer, ... } from '@/components/features/review'

// Use DynamicPdfViewer instead of PdfViewer
<DynamicPdfViewer url={data.document.fileUrl} pageCount={1} />
```

### Key Learnings

**Barrel Export Gotcha:**
> When using barrel exports (index.ts), webpack loads ALL exports from that file during build, even if you only import one. This can cause SSR issues with browser-only dependencies.

**Solution Pattern:**
1. Never export browser-only components from barrel files
2. Use dynamic import with `ssr: false` for browser-only components
3. Document the limitation clearly in the barrel file

### Files Modified
- `src/components/features/review/PdfViewer/DynamicPdfViewer.tsx` (NEW)
- `src/components/features/review/PdfViewer/index.ts`
- `src/components/features/review/index.ts`
- `src/app/(dashboard)/review/[id]/page.tsx`

---

## Issue 3: Tailwind Config ESM Import

### Error Message
```
Configuring Next.js via next.config.ts requires to import next from "next/types/index.d.ts".
```

### Root Cause
`tailwind.config.ts` was importing from `next.config.ts`, which triggered TypeScript module resolution issues in Next.js 15.

### Solution
Moved shared configuration to a separate file and updated imports.

### Files Modified
- `tailwind.config.ts`
- `next.config.ts`

---

## Testing Verification

All fixed pages were tested and confirmed working:

| Page | Status | Notes |
|------|--------|-------|
| `/dashboard` | ✅ Working | - |
| `/invoices` | ✅ Working | - |
| `/invoices/upload` | ✅ Working | - |
| `/review` | ✅ Working | pdfjs-dist fix applied |
| `/escalations` | ✅ Working | - |
| `/rules` | ✅ Working | - |
| `/forwarders` | ✅ Working | Permission wildcard fix |
| `/reports/monthly` | ✅ Working | - |
| `/global` | ✅ Working | - |
| `/admin/users` | ✅ Working | Permission wildcard fix |
| `/admin/roles` | ✅ Working | Permission wildcard fix |
| `/admin/monitoring/health` | ✅ Working | Permission wildcard fix |
| `/audit/query` | ✅ Working | - |

---

## Prevention Recommendations

1. **Permission System**: Always include wildcard check in permission validation functions
2. **Browser-Only Libraries**: Use dynamic imports with `ssr: false`, and avoid barrel exports
3. **Testing**: Add automated tests for permission checks and page accessibility
4. **Documentation**: Document known SSR-incompatible packages in CLAUDE.md

---

## Issue 4: API Route Permission Wildcard Not Recognized (Session 2)

### Discovered Date
2025-12-23 (Manual testing after initial fixes)

### Affected Pages/APIs
- `/escalations` → Returns 403 from `/api/escalations`
- `/rules` → Returns 403 from `/api/rules`

### Symptoms
Pages render successfully but API calls return 403 Forbidden. Console shows:
```
GET /api/escalations?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc 403
GET /api/rules?page=1&pageSize=20&sortBy=updatedAt&sortOrder=desc 403
```

### Root Cause
While the middleware permission check was fixed (Issue 1), API route handlers have their own permission check functions that also didn't support wildcard permissions:

```typescript
// Original code in API routes - doesn't recognize wildcard
function hasRuleViewPermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) => r.permissions.includes(PERMISSIONS.RULE_VIEW))  // ← Problem!
}
```

When user has `permissions: ['*']`, the check `['*'].includes(PERMISSIONS.RULE_VIEW)` returns `false`.

### Solution
Added wildcard check to all API route permission functions:

```typescript
// Fixed code
function hasRuleViewPermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_VIEW)
  )
}
```

### Files Modified (20 files)
**Escalation Routes:**
- `src/app/api/escalations/route.ts`
- `src/app/api/escalations/[id]/route.ts`
- `src/app/api/escalations/[id]/resolve/route.ts`

**Rule Routes:**
- `src/app/api/rules/route.ts`
- `src/app/api/rules/[id]/route.ts`
- `src/app/api/rules/[id]/metrics/route.ts`
- `src/app/api/rules/[id]/test/route.ts`
- `src/app/api/rules/test/route.ts`

**Rule Suggestion Routes:**
- `src/app/api/rules/suggestions/route.ts`
- `src/app/api/rules/suggestions/[id]/route.ts`
- `src/app/api/rules/suggestions/[id]/approve/route.ts`
- `src/app/api/rules/suggestions/[id]/reject/route.ts`
- `src/app/api/rules/suggestions/[id]/impact/route.ts`
- `src/app/api/rules/suggestions/[id]/simulate/route.ts`
- `src/app/api/rules/suggestions/generate/route.ts`

**Test Task Routes:**
- `src/app/api/test-tasks/[taskId]/cancel/route.ts`

**Admin Routes:**
- `src/app/api/admin/roles/route.ts`
- `src/app/api/admin/roles/[id]/route.ts`
- `src/app/api/admin/users/[id]/status/route.ts`
- `src/app/api/roles/route.ts`

---

## Issue 5: Page Response Slow (Performance Analysis)

### Report Date
2025-12-23

### User Report
> "現在本項目的頁面反應時候有點慢, 是有什麼原因導致的嗎? 即使已經不是剛啟動也是一樣慢"

### Analysis Results

#### 1. Prisma Query Logging Enabled
**File**: `src/lib/prisma.ts:54-56`
```typescript
log: process.env.NODE_ENV === 'development'
  ? ['query', 'error', 'warn']  // ← Query logging adds I/O overhead
  : ['error'],
```

This logs every database query to the console, adding I/O overhead.

#### 2. Multiple Independent COUNT Queries
The `/api/dashboard/statistics` endpoint executes ~14 individual COUNT queries:
```
prisma:query SELECT COUNT(*) ... FROM "documents" ...
prisma:query SELECT COUNT(*) ... FROM "processing_queues" ...
prisma:query SELECT AVG(EXTRACT(EPOCH FROM ...)) ...
(repeated 14+ times)
```

These queries could be optimized into fewer batch queries or a single raw SQL query.

#### 3. Response Times After Compilation
| Endpoint | First Request | Subsequent |
|----------|--------------|------------|
| `/dashboard` | 6754ms | 332-776ms |
| `/api/dashboard/statistics` | 3652ms | 286-832ms |
| `/api/auth/session` | 2702ms | 140-300ms |
| `/global` | 16312ms | N/A |

### Potential Optimizations

| Optimization | Impact | Difficulty |
|-------------|--------|------------|
| Disable query logging (change `['query', 'error', 'warn']` to `['error', 'warn']`) | Medium | Easy |
| Batch dashboard statistics queries | High | Medium |
| Add API response caching (React Query already configured) | Medium | Medium |
| Use `Promise.all()` for independent queries | Medium | Easy |

### Status
**Documented** - Optimizations are recorded for future implementation. The current response times (300-800ms after compilation) are acceptable for development but may need optimization for production.

---

## Updated Testing Verification

| Page | Status | Notes |
|------|--------|-------|
| `/dashboard` | ✅ Working | - |
| `/invoices` | ✅ Working | - |
| `/invoices/upload` | ✅ Working | - |
| `/review` | ✅ Working | pdfjs-dist fix applied |
| `/escalations` | ✅ Working | **API permission wildcard fix (Issue 4)** |
| `/rules` | ✅ Working | **API permission wildcard fix (Issue 4)** |
| `/forwarders` | ✅ Working | Permission wildcard fix |
| `/reports/monthly` | ✅ Working | - |
| `/global` | ✅ Working | - |
| `/admin/users` | ✅ Working | Permission wildcard fix |
| `/admin/roles` | ✅ Working | Permission wildcard fix |
| `/admin/monitoring/health` | ✅ Working | Permission wildcard fix |
| `/audit/query` | ✅ Working | - |

---

## Related Documentation

- REFACTOR-001: `claudedocs/4-changes/refactoring/REFACTOR-001-forwarder-to-company.md`
- Permission System: `src/middlewares/resource-access.ts`
- PDF Viewer: `src/components/features/review/PdfViewer/index.ts`
- Prisma Config: `src/lib/prisma.ts`
