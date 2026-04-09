# API Routes Overview

> Generated: 2026-04-09 | Source: `src/app/api/**/*.ts` | Total: **331 route files, 448 HTTP methods** (includes `withCityFilter()` wrapper exports and 1 destructured NextAuth export)

---

## 1. Domain Summary

| Domain | Route Files | GET | POST | PATCH | PUT | DELETE | Total Methods |
|--------|------------|-----|------|-------|-----|--------|---------------|
| `/admin/*` | 106 | 68 | 51 | 12 | 6 | 16 | 153 |
| `/v1/*` | 77 | 50 | 37 | 15 | 0 | 14 | 116 |
| Other | 148 | 109 | 61 | 6 | 2 | 1 | 179 |
| **Total** | **331** | **227** | **149** | **33** | **8** | **31** | **448** |

> Note: "Other" domain includes 28 routes using `export const GET/POST = withCityFilter(...)` wrapper pattern (cost, dashboard, reports, statistics, workflow-executions, workflows, audit) and 1 destructured NextAuth export (`export const { GET, POST } = handlers`).

### Method Distribution

```
GET     227  (50.7%)  ████████████████████
POST    149  (33.3%)  █████████████
PATCH    33  ( 7.4%)  ███
DELETE   31  ( 6.9%)  ███
PUT       8  ( 1.8%)  █
```

---

## 2. Authentication Coverage

| Domain | Files w/ Auth | Total | Coverage | Notes |
|--------|--------------|-------|----------|-------|
| `/admin/*` | 101 | 106 | **95.3%** | 5 routes lack auth: company-stats, term-stats, files/detail, document-preview-test, term-analysis |
| `/v1/*` | 3 | 77 | **3.9%** | Only `/v1/users/me/*` has session auth; most v1 routes are unprotected |
| Other | 97 | 148 | **65.5%** | Auth missing on cost, dashboard, reports, n8n, mapping, statistics |
| **Total** | **201** | **331** | **60.7%** | |

**Auth patterns detected**: `getServerSession`, `requireAuth`, `requirePermission`, `checkPermission`, `withAuth`, `requireRole`

### Routes Without Auth (High-Risk)

| Domain | Count | Key Gaps |
|--------|-------|----------|
| `/admin/*` | 5 | `historical-data/batches/:batchId/company-stats`, `historical-data/batches/:batchId/term-stats`, `historical-data/files/:id/detail`, `document-preview-test/extract`, `term-analysis` |
| `/v1/*` | 74 | Nearly all v1 routes; designed as internal/service API |
| Other | 51 | `cost/*` (5), `dashboard/*` (5), `reports/*` (8), `n8n/*` (4), `confidence/*` (2), `mapping/*` (2), `statistics/*` (4), `docs/*` (4), `health` (1), `openapi` (1), `workflow-executions/*` (4), `test/*` (2), `auth/*` (7) |

---

## 3. Zod Validation Coverage

| Domain | Files w/ Zod | Total | Coverage |
|--------|-------------|-------|----------|
| `/admin/*` | 65 | 106 | **61.3%** |
| `/v1/*` | 64 | 77 | **83.1%** |
| Other | 86 | 148 | **58.1%** |
| **Total** | **215** | **331** | **64.9%** |

**Zod patterns detected**: `.parse()`, `.safeParse()`, `z.object`, `z.string()`, `z.enum()`, imported `Schema`/`schema`

---

## 4. Special Endpoints

### SSE (Server-Sent Events) - 2 confirmed

| Path | Purpose |
|------|---------|
| `/admin/logs/stream` | Real-time system log streaming |
| `/admin/historical-data/batches/:batchId/progress` | Batch processing progress SSE |

### File Upload (FormData) - 15 routes

| Path | Purpose |
|------|---------|
| `/admin/document-preview-test/extract` | OCR test extraction |
| `/admin/historical-data/upload` | Historical data file upload |
| `/admin/historical-data/batches` | Batch creation with files |
| `/companies/:id` | Company logo/attachment |
| `/documents/upload` | Main document upload |
| `/documents/:id/blob` | Document blob proxy |
| `/documents/:id/process` | Document processing trigger |
| `/test/extraction-compare` | Extraction comparison test |
| `/test/extraction-v2` | Extraction V2 test |
| `/v1/extraction-v3/test` | V3 extraction test |
| `/v1/formats/:id/files` | Format file association |
| `/v1/invoices` | Invoice submission |
| `/v1/prompt-configs/test` | Prompt config test |
| `/admin/retention/restore` | Data restore from archive |
| `/documents/:id` | Document detail/update |

### Webhook Endpoints - 11 routes

| Path | Purpose |
|------|---------|
| `/n8n/webhook` | n8n webhook receiver |
| `/n8n/documents` | n8n document submission |
| `/n8n/documents/:id/status` | n8n document status |
| `/n8n/documents/:id/result` | n8n document result |
| `/admin/integrations/n8n/webhook-configs` | Webhook config CRUD |
| `/admin/integrations/n8n/webhook-configs/:id` | Single config operations |
| `/admin/integrations/n8n/webhook-configs/:id/test` | Webhook connection test |
| `/admin/integrations/n8n/webhook-configs/:id/history` | Config change history |
| `/v1/webhooks` | Webhook delivery history |
| `/v1/webhooks/stats` | Webhook statistics |
| `/v1/webhooks/:deliveryId/retry` | Manual retry delivery |

---

## 5. "Other" Domain Breakdown

| Sub-domain | Route Files | Auth Coverage | Key Purpose |
|------------|------------|---------------|-------------|
| `/rules/*` | 20 | 100% (20/20) | Mapping rule CRUD, suggestions, versioning |
| `/documents/*` | 19 | 100% (19/19) | Document CRUD, upload, processing, sources |
| `/companies/*` | 12 | 92% (11/12) | Company management, rules, stats |
| `/reports/*` | 12 | 33% (4/12) | City cost, monthly, regional, expense reports |
| `/auth/*` | 7 | 0% (0/7) | NextAuth handler, register, password reset (public by design) |
| `/audit/*` | 7 | 100% (7/7) | Audit logs, queries, reports |
| `/review/*` | 5 | 100% (5/5) | Review queue, approve, correct, escalate |
| `/workflows/*` | 5 | 100% (5/5) | Workflow trigger, cancel, retry |
| `/workflow-executions/*` | 4 | 0% (0/4) | Execution list, details, stats |
| `/cost/*` | 5 | 0% (0/5) | AI cost tracking, pricing |
| `/dashboard/*` | 5 | 0% (0/5) | Statistics, AI cost dashboard |
| `/n8n/*` | 4 | 0% (0/4) | n8n integration (service-to-service) |
| `/statistics/*` | 4 | 0% (0/4) | Processing statistics |
| `/test-tasks/*` | 4 | 100% (4/4) | Test task management |
| `/docs/*` | 4 | 0% (0/4) | API documentation (public by design) |
| `/escalations/*` | 3 | 100% (3/3) | Escalation management |
| `/analytics/*` | 3 | 100% (3/3) | City/region analytics |
| `/cities/*` | 3 | 100% (3/3) | City data |
| `/routing/*` | 3 | 100% (3/3) | Document routing queue |
| `/corrections/*` | 2 | 100% (2/2) | Correction patterns |
| `/history/*` | 2 | 100% (2/2) | Resource change history |
| `/confidence/*` | 2 | 0% (0/2) | Confidence scoring |
| `/mapping/*` | 2 | 0% (0/2) | Field mapping |
| `/test/*` | 2 | 0% (0/2) | Extraction testing |
| Others | 9 | varies | health, openapi, extraction, prompts, exports, jobs, roles, rollback-logs, workflow-errors |

---

## 6. Detail Files

| File | Content |
|------|---------|
| [api-admin.md](detail/api-admin.md) | Complete `/admin/*` route inventory (106 routes) |
| [api-v1.md](detail/api-v1.md) | Complete `/v1/*` route inventory (77 routes) |
| [api-other-domains.md](detail/api-other-domains.md) | Complete other domains inventory (148 routes) |

---

## 7. Key Observations

1. **V1 domain has almost no auth** (3/77) -- these routes appear designed as internal service APIs, but this is a significant security concern if exposed publicly.
2. **Admin domain has strong auth** (95.3%) -- only 5 routes lack auth (company-stats, term-stats, files/detail, document-preview-test, term-analysis).
3. **Zod validation is strongest in V1** (83.1%) -- newer APIs follow validation best practices.
4. **Reports domain lacks auth** (33%) -- city-cost and regional reports are publicly accessible.
5. **Total HTTP method count (448)** across 331 route files means average 1.35 methods/file. The increase from naive counting (417) is due to 28 routes using `withCityFilter()` wrapper exports and 1 destructured NextAuth export.
6. **GET dominates** at 50.7%, reflecting the read-heavy nature of the document extraction domain.
