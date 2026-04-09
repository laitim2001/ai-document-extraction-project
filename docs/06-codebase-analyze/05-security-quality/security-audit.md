# Security Audit Report

> **Audit Date**: 2026-04-09
> **Scope**: src/ directory (all API routes, services, lib, components)
> **Route Files**: 331 total | **Estimated Endpoints**: 400+
> **Overall Security Score**: 5.7 / 10 (Medium-Low)

---

## 1. Authentication Coverage

### Middleware Analysis

The main `src/middleware.ts` **skips all `/api` paths** (line 92: `pathname.startsWith('/api')`).
This means **every API route must implement its own auth check** -- there is no centralized API auth middleware.

The `authConfig.authorized` callback in `src/lib/auth.config.ts` protects `/dashboard` and `/api/v1` paths,
but this only runs for page routes (the middleware matcher excludes `/api`).

### Auth Coverage by Domain

| Domain | With Auth | Total | Coverage | Risk |
|--------|-----------|-------|----------|------|
| `/admin/*` | 101 | 106 | **95%** | LOW |
| `/rules/*` | 20 | 20 | **100%** | -- |
| `/review/*` | 5 | 5 | **100%** | -- |
| `/routing/*` | 3 | 3 | **100%** | -- |
| `/audit/*` | 7 | 7 | **100%** | -- |
| `/analytics/*` | 3 | 3 | **100%** | -- |
| `/documents/*` | 19 | 19 | **100%** | -- |
| `/companies/*` | 11 | 12 | 92% | LOW |
| `/workflows/*` | 5 | 5 | **100%** | -- |
| `/escalations/*` | 3 | 3 | **100%** | -- |
| `/cities/*` | 3 | 3 | **100%** | -- |
| `/test-tasks/*` | 4 | 4 | **100%** | -- |
| `/history/*` | 2 | 2 | **100%** | -- |
| `/corrections/*` | 2 | 2 | **100%** | -- |
| `/v1/*` | 14 (session+api-key) | 77 | **18%** | **HIGH** |
| `/reports/*` | 4 | 12 | 33% | **HIGH** |
| `/cost/*` | 0 | 5 | **0%** | **HIGH** |
| `/dashboard/*` | 0 | 5 | **0%** | **HIGH** |
| `/n8n/*` | 0 | 4 | **0%** | MEDIUM |
| `/mapping/*` | 0 | 2 | **0%** | **HIGH** |
| `/statistics/*` | 0 | 4 | **0%** | **HIGH** |
| `/workflow-exec/*` | 0 | 4 | **0%** | MEDIUM |
| `/confidence/*` | 0 | 2 | **0%** | MEDIUM |
| `/prompts/*` | 0 | 1 | **0%** | MEDIUM |
| `/auth/*` | 0 | 7 | 0% | Intentional |
| `/health/*` | 0 | 1 | 0% | Intentional |
| **TOTAL** | **201** | **331** | **61%** | -- |

### HIGH Risk: 63 Unprotected /v1/* Routes

The `/v1/*` domain has **63 out of 77 routes with NO auth** (session or API key).
Only 3 use `auth()` session check, 11 use external API key auth.

Critical unprotected `/v1/*` routes include:
- `/v1/exchange-rates/` (GET, POST) -- financial data
- `/v1/exchange-rates/import/` (POST) -- bulk import
- `/v1/prompt-configs/` (GET, POST) -- AI prompt configs
- `/v1/prompt-configs/[id]/` (PATCH, DELETE) -- modify/delete prompts
- `/v1/field-mapping-configs/` (POST) -- create configs
- `/v1/template-instances/` (POST) -- create instances
- `/v1/documents/[id]/match/` (POST) -- modify document matching
- `/v1/pipeline-configs/` (POST) -- pipeline configuration
- `/v1/regions/` (POST) -- create regions

### Other 0% Auth Domains

| Domain | Routes | Concern |
|--------|--------|---------|
| `/cost/*` | 5 routes | Cost/pricing data exposed |
| `/dashboard/*` | 5 routes | Statistics with potential sensitive data |
| `/statistics/*` | 4 routes | Processing statistics |
| `/mapping/*` | 2 routes | Mapping rules |
| `/n8n/*` | 4 routes | Workflow integration (may use own auth) |

---

## 2. SQL Injection Risk

### $executeRawUnsafe -- HIGH RISK (2 instances)

**File**: `src/lib/db-context.ts` lines 87 and 106

```typescript
// Line 87 -- VULNERABLE: string interpolation into SQL
await prismaClient.$executeRawUnsafe(`
  SELECT
    set_config('app.is_global_admin', '${isGlobalAdmin}', true),
    set_config('app.user_city_codes', '${cityCodes}', true)
`)
```

- `isGlobalAdmin` is derived from boolean (safe: always 'true'/'false')
- `cityCodes` is `string[]` joined by comma -- **if city codes contain quotes or SQL metacharacters, this is exploitable**
- **Severity**: HIGH -- city codes come from user session data
- **Fix**: Use `Prisma.sql` tagged template or parameterized `$executeRaw`

### $queryRaw -- SAFE (13 instances)

All 13 `$queryRaw` usages across services and API routes use Prisma's **tagged template literal** syntax (`$queryRaw\`...\``), which automatically parameterizes values. Verified in:
- `city-cost-report.service.ts` (2)
- `dashboard-statistics.service.ts` (2)
- `monthly-cost-report.service.ts` (2)
- `health-check.service.ts` (1)
- `reference-number.service.ts` (1, uses `Prisma.sql`)
- `analytics/city-comparison/route.ts` (1)
- `analytics/global/route.ts` (3)
- `health/route.ts` (1)

---

## 3. PII Leakage

### auth.config.ts -- HIGH RISK (9 console.logs)

**File**: `src/lib/auth.config.ts`

| Line | Content | PII? |
|------|---------|------|
| 120 | `'[Auth] Missing email or password'` | No |
| 129 | `'[Auth] isDevelopmentMode:', isDevelopmentMode...` | No |
| 134 | `'[Auth] Development mode login for:', email` | **YES** |
| 146 | `'[Auth] Production mode - verifying credentials for:', email` | **YES** |
| 168 | `'[Auth] User not found or no password:', email` | **YES** |
| 175 | `'[Auth] Invalid password for:', email` | **YES** |
| 181 | `'[Auth] User status not ACTIVE:', user.status` | No |
| 192 | `'[Auth] Email not verified for:', email` | **YES** |
| 196 | `'[Auth] Login successful for:', email` | **YES** |

**6 out of 9 log statements expose user email addresses to server logs.**
This violates GDPR/privacy principles. Server logs may be accessible to ops staff or log aggregation services.

### Other PII Concerns

- `alert.service.ts:593` -- logs recipient email
- `alert-notification.service.ts:408` -- logs recipient email
- `email.ts:105` -- logs email details in dev mode (acceptable if dev-only)

---

## 4. Input Validation (Zod)

### Coverage Statistics

| Category | Total | With Zod | Coverage |
|----------|-------|----------|----------|
| Route files with mutation methods (POST/PATCH/PUT/DELETE) | 195 | 159 | **82%** |
| Routes lacking Zod validation | -- | 36 | 18% gap |

### Top Unvalidated Mutation Endpoints

These routes handle data modification but lack Zod schema validation:

| # | Route | Risk |
|---|-------|------|
| 1 | `/documents/upload/route.ts` | HIGH -- file upload without schema |
| 2 | `/documents/[id]/process/route.ts` | HIGH -- triggers processing |
| 3 | `/admin/historical-data/upload/route.ts` | HIGH -- bulk data upload |
| 4 | `/admin/backups/[id]/route.ts` | MEDIUM -- backup operations |
| 5 | `/admin/restore/[id]/route.ts` | MEDIUM -- restore operations |
| 6 | `/admin/historical-data/batches/[batchId]/process/route.ts` | MEDIUM |
| 7 | `/v1/documents/[id]/unmatch/route.ts` | MEDIUM |
| 8 | `/jobs/pattern-analysis/route.ts` | LOW |
| 9 | `/admin/document-preview-test/extract/route.ts` | LOW -- test endpoint |
| 10 | `/admin/integrations/*/test/route.ts` (3 routes) | LOW -- test endpoints |

---

## 5. Hardcoded Secrets

### .env Protection

- `.env.example` exists and is committed: **PASS**
- `.gitignore` includes `.env`, `.env.local`, `.env.*.local`: **PASS**
- No `.env` files in git tracking: **PASS**
- No hardcoded API keys, passwords, or connection strings found in source: **PASS**

### Secret Management Score: 9/10

The only minor concern: `auth.config.ts` line 83 contains mock value prefixes (`your-`, `test-`, etc.)
which is acceptable for validation logic.

---

## 6. Risk Summary

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | 63 unprotected /v1/* API routes (including mutation endpoints) | **HIGH** | Auth |
| 2 | SQL injection risk in db-context.ts ($executeRawUnsafe with cityCodes) | **HIGH** | SQL |
| 3 | 6 PII leakage points in auth.config.ts (user emails logged) | **HIGH** | PII |
| 4 | /cost/*, /dashboard/*, /statistics/*, /mapping/* have 0% auth | **HIGH** | Auth |
| 5 | No centralized API auth middleware (each route must self-protect) | **MEDIUM** | Architecture |
| 6 | 36 mutation endpoints lack Zod input validation | **MEDIUM** | Validation |
| 7 | /n8n/*, /workflow-executions/* lack session auth (may have own auth) | **LOW** | Auth |
| 8 | 2 PII leaks in alert services (email addresses in logs) | **LOW** | PII |

---

## 7. Recommendations

### Immediate (This Week)

1. **Fix SQL injection**: Replace `$executeRawUnsafe` in `db-context.ts` with parameterized `$executeRaw` using tagged template literals
2. **Remove PII from logs**: Replace 6 email-logging `console.log` calls in `auth.config.ts` with either:
   - Remove entirely, or
   - Use `logger.debug()` with email hash/mask, disabled in production

### High Priority (This Month)

3. **Add centralized API auth middleware**: Create a shared middleware for `/api/*` routes that checks session by default, with explicit opt-out for public endpoints
4. **Protect /v1/* routes**: Add `auth()` session check to all 63 unprotected routes. If designed for external access, add API key auth
5. **Protect /cost/*, /dashboard/*, /statistics/*, /mapping/***: Add session auth (16 routes total)
6. **Add Zod validation** to remaining 36 mutation endpoints

### Medium Priority (This Quarter)

7. Replace all 287 `console.log` calls with structured logger
8. Implement rate limiting middleware for public-facing API routes
9. Add CSRF protection for mutation endpoints

---

## Overall Security Score Justification: 5.7/10

| Dimension | Score | Weight | Notes |
|-----------|-------|--------|-------|
| Authentication Coverage | 4.5/10 | 30% | 61% coverage (admin 95%, but critical /v1/ gap remains) |
| Input Validation | 7/10 | 20% | 82% Zod coverage on mutations |
| SQL Security | 7/10 | 15% | 13/15 safe, 2 $executeRawUnsafe |
| PII Protection | 3/10 | 15% | Active email logging in auth |
| Secret Management | 9/10 | 10% | Excellent .env handling |
| Architecture | 5/10 | 10% | No centralized API auth layer |
| **Weighted Total** | **5.7/10** | 100% | Medium-Low |

---

## 8. R15 Verification Addendum (2026-04-09)

Additional findings from R15 deep verification rounds:

### Authentication vs Authorization Gap

Of the 201 routes with authentication checks, **134 routes authenticate but do not authorize** (i.e., they verify the user is logged in via `getServerSession`/`auth()` but do not check roles, permissions, or resource ownership). This means a valid session grants access to any authenticated route regardless of user role.

### Audit Logging Coverage

`withAuditLog` middleware adoption is only **0.9%** (3 out of 331 route files). The vast majority of state-changing operations (POST/PATCH/PUT/DELETE) are not audit-logged at the API layer. Audit trails rely on manual `auditLog.create()` calls within service functions, which is inconsistent.

### Rate Limiting Scope

Rate limiting (via `rate-limit.service.ts`) is applied to only **7 external-facing API routes** (primarily `/v1/*` endpoints with API key auth). No rate limiting exists for:
- Internal dashboard API routes (331 - 7 = 324 routes)
- Authentication endpoints (`/auth/register`, `/auth/forgot-password`) -- vulnerable to brute-force
- File upload endpoints (`/documents/upload`, `/admin/historical-data/upload`)

---

*Generated by Claude Code Security Audit*
*Audit scope: src/ directory, 331 API route files, 200+ service files*
