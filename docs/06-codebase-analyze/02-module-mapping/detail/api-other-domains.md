# API Routes - Other Domains

> 148 route files | Auth: 97/148 (65.5%) | Zod: 86/148 (58.1%) | Generated: 2026-04-09

---

## Analytics (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 1 | `/analytics/city-comparison` | GET | Y | Y | City comparison analytics |
| 2 | `/analytics/global` | GET | Y | Y | Global analytics overview |
| 3 | `/analytics/region/:code/cities` | GET | Y | Y | Region city detail analytics |

## Audit (7 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 4 | `/audit/logs` | GET | Y | N | Audit log query |
| 5 | `/audit/query` | POST | Y | Y | Audit query |
| 6 | `/audit/query/count` | POST | Y | N | Audit query result count preview |
| 7 | `/audit/reports` | GET POST | Y | Y | Audit report list/create |
| 8 | `/audit/reports/:jobId` | GET | Y | N | Report job detail |
| 9 | `/audit/reports/:jobId/download` | GET | Y | N | Download audit report |
| 10 | `/audit/reports/:jobId/verify` | POST | Y | Y | Verify report integrity |

## Auth (7 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 11 | `/auth/[...nextauth]` | (handler) | N | N | NextAuth v5 route handler |
| 12 | `/auth/forgot-password` | POST | N | Y | Forgot password request |
| 13 | `/auth/register` | POST | N | Y | User registration |
| 14 | `/auth/resend-verification` | POST | N | Y | Resend email verification |
| 15 | `/auth/reset-password` | POST | N | Y | Reset password |
| 16 | `/auth/verify-email` | GET | N | N | Email verification |
| 17 | `/auth/verify-reset-token` | GET | N | N | Verify reset token |

> Auth routes are public by design -- no session auth required.

## Cities (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 18 | `/cities` | GET | Y | N | City list |
| 19 | `/cities/:code` | GET | Y | N | Single city detail |
| 20 | `/cities/accessible` | GET | Y | N | User accessible cities |

## Companies (12 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 21 | `/companies` | GET POST | Y | Y | Company list/create |
| 22 | `/companies/:id` | GET PUT | Y | Y | Company detail/update |
| 23 | `/companies/:id/activate` | POST | Y | Y | Activate company |
| 24 | `/companies/:id/classified-as-values` | GET | N | N | Company classified-as values |
| 25 | `/companies/:id/deactivate` | POST | Y | Y | Deactivate company |
| 26 | `/companies/:id/documents` | GET | Y | Y | Company recent documents |
| 27 | `/companies/:id/rules` | GET POST | Y | Y | Company mapping rules |
| 28 | `/companies/:id/rules/:ruleId` | PUT | Y | Y | Update company rule |
| 29 | `/companies/:id/stats` | GET | Y | Y | Company statistics |
| 30 | `/companies/check-code` | GET | Y | Y | Check code availability |
| 31 | `/companies/identify` | POST | Y | Y | Company identification |
| 32 | `/companies/list` | GET | Y | Y | Simplified company list (dropdowns) |

## Confidence (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 33 | `/confidence/:id` | GET POST | N | Y | Confidence score query/update |
| 34 | `/confidence/:id/review` | POST | N | Y | Review result recording |

## Corrections (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 35 | `/corrections/patterns` | GET | Y | N | Correction pattern list |
| 36 | `/corrections/patterns/:id` | GET PATCH | Y | Y | Pattern detail/update |

## Cost (5 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 37 | `/cost/city-summary` | GET | N | Y | City AI cost summary |
| 38 | `/cost/city-trend` | GET | N | Y | City AI cost trend |
| 39 | `/cost/comparison` | GET | N | Y | City cost comparison |
| 40 | `/cost/pricing` | GET POST | N | Y | API pricing config CRUD |
| 41 | `/cost/pricing/:id` | GET PATCH | N | Y | Single pricing config |

## Dashboard (5 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 42 | `/dashboard/ai-cost` | GET | N | Y | AI cost summary |
| 43 | `/dashboard/ai-cost/anomalies` | GET | N | Y | AI cost anomaly detection |
| 44 | `/dashboard/ai-cost/daily/:date` | GET | N | Y | Daily AI cost detail |
| 45 | `/dashboard/ai-cost/trend` | GET | N | Y | AI cost trend |
| 46 | `/dashboard/statistics` | GET | N | Y | Dashboard statistics overview |

## Docs (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 47 | `/docs` | GET | N | N | API documentation redirect |
| 48 | `/docs/error-codes` | GET | N | N | Error codes reference |
| 49 | `/docs/examples` | GET | N | N | SDK examples |
| 50 | `/docs/version` | GET | N | N | API version info |

> Docs routes are public by design.

## Documents (19 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 51 | `/documents` | GET | Y | N | Document list |
| 52 | `/documents/:id` | GET | Y | N | Document detail |
| 53 | `/documents/:id/blob` | GET | Y | N | Document blob stream proxy |
| 54 | `/documents/:id/process` | POST | Y | N | Trigger document processing |
| 55 | `/documents/:id/progress` | GET | Y | N | Processing progress |
| 56 | `/documents/:id/retry` | POST | Y | N | Retry processing |
| 57 | `/documents/:id/source` | GET | Y | N | Document source info |
| 58 | `/documents/:id/trace` | GET | Y | N | Processing trace chain |
| 59 | `/documents/:id/trace/report` | POST | Y | N | Generate trace report |
| 60 | `/documents/from-outlook` | POST | Y | Y | Submit from Outlook |
| 61 | `/documents/from-outlook/status/:fetchLogId` | GET | Y | N | Outlook fetch status |
| 62 | `/documents/from-sharepoint` | POST | Y | Y | Submit from SharePoint |
| 63 | `/documents/from-sharepoint/status/:fetchLogId` | GET | Y | Y | SharePoint fetch status |
| 64 | `/documents/processing` | GET | Y | N | Processing document list |
| 65 | `/documents/processing/stats` | GET | Y | N | Processing statistics |
| 66 | `/documents/route` | GET | Y | N | Document list (main) |
| 67 | `/documents/search` | GET | Y | N | Document search |
| 68 | `/documents/sources/stats` | GET | Y | N | Source type statistics |
| 69 | `/documents/sources/trend` | GET | Y | N | Source type trend |
| 70 | `/documents/upload` | POST | Y | N | File upload (FormData) |

## Escalations (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 71 | `/escalations` | GET | Y | N | Escalation list |
| 72 | `/escalations/:id` | GET | Y | N | Escalation detail |
| 73 | `/escalations/:id/resolve` | POST | Y | Y | Resolve escalation |

## Exports (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 74 | `/exports/multi-city` | POST | Y | Y | Multi-city report export |

## Extraction (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 75 | `/extraction` | POST | Y | Y | OCR extraction trigger |

## Health (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 76 | `/health` | GET | N | N | Health check (public) |

## History (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 77 | `/history/:resourceType/:resourceId` | GET | Y | Y | Resource change history |
| 78 | `/history/:resourceType/:resourceId/compare` | GET | Y | Y | Version comparison |

## Jobs (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 79 | `/jobs/pattern-analysis` | GET POST | Y | N | Pattern analysis task |

## Mapping (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 80 | `/mapping` | GET POST | N | Y | Field mapping operations |
| 81 | `/mapping/:id` | GET | N | Y | Single document mapping result |

## n8n (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 82 | `/n8n/documents` | POST | N | Y | n8n document submission |
| 83 | `/n8n/documents/:id/result` | GET | N | N | n8n document result |
| 84 | `/n8n/documents/:id/status` | GET | N | N | n8n document status |
| 85 | `/n8n/webhook` | POST | N | Y | n8n webhook receiver |

> n8n routes are service-to-service and use webhook-based auth.

## OpenAPI (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 86 | `/openapi` | GET | N | N | OpenAPI spec endpoint |

## Prompts (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 87 | `/prompts/resolve` | GET POST | N | Y | Prompt resolution |

## Reports (12 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 88 | `/reports/city-cost` | GET | N | N | City cost report |
| 89 | `/reports/city-cost/anomaly/:cityCode` | GET | N | N | City cost anomaly analysis |
| 90 | `/reports/city-cost/trend` | GET | N | N | City cost trend |
| 91 | `/reports/expense-detail/estimate` | POST | N | N | Expense detail row estimate |
| 92 | `/reports/expense-detail/export` | POST | N | N | Expense detail export |
| 93 | `/reports/jobs/:jobId` | GET | Y | N | Report job status |
| 94 | `/reports/monthly-cost` | GET | Y | N | Monthly cost report history |
| 95 | `/reports/monthly-cost/:id/download` | GET | Y | N | Download monthly report |
| 96 | `/reports/monthly-cost/generate` | POST | Y | Y | Generate monthly report |
| 97 | `/reports/regional/city/:cityCode` | GET | N | N | Regional city detail |
| 98 | `/reports/regional/export` | GET | N | Y | Regional report export |
| 99 | `/reports/regional/summary` | GET | N | N | Regional summary |

## Review (5 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 100 | `/review` | GET | Y | N | Review queue |
| 101 | `/review/:id` | GET | Y | N | Review detail |
| 102 | `/review/:id/approve` | POST | Y | Y | Approve review |
| 103 | `/review/:id/correct` | PATCH | Y | Y | Correct extraction |
| 104 | `/review/:id/escalate` | POST | Y | Y | Escalate case |

## Roles (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 105 | `/roles` | GET | Y | N | Role list |

## Rollback Logs (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 106 | `/rollback-logs` | GET | Y | Y | Rollback history |

## Routing (3 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 107 | `/routing` | POST | Y | Y | Document routing |
| 108 | `/routing/queue` | GET | Y | Y | Processing queue |
| 109 | `/routing/queue/:id/assign` | POST | Y | Y | Assign queue item |

## Rules (20 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 110 | `/rules` | GET POST | Y | Y | Mapping rule list/create |
| 111 | `/rules/:id` | GET PATCH | Y | Y | Single rule detail/update |
| 112 | `/rules/:id/accuracy` | GET | Y | N | Rule accuracy stats |
| 113 | `/rules/:id/metrics` | GET | Y | N | Rule metrics |
| 114 | `/rules/:id/preview` | POST | Y | Y | Rule preview |
| 115 | `/rules/:id/test` | POST | Y | Y | Batch rule test |
| 116 | `/rules/:id/versions` | GET | Y | Y | Rule version history |
| 117 | `/rules/:id/versions/compare` | GET | Y | Y | Version comparison |
| 118 | `/rules/:id/versions/rollback` | POST | Y | Y | Version rollback |
| 119 | `/rules/bulk` | POST PATCH DELETE | Y | Y | Bulk rule operations |
| 120 | `/rules/bulk/undo` | GET POST | Y | Y | Undo bulk operation |
| 121 | `/rules/suggestions` | GET POST | Y | Y | Rule suggestions |
| 122 | `/rules/suggestions/:id` | GET PATCH | Y | Y | Single suggestion |
| 123 | `/rules/suggestions/:id/approve` | POST | Y | Y | Approve suggestion |
| 124 | `/rules/suggestions/:id/impact` | GET | Y | N | Impact analysis |
| 125 | `/rules/suggestions/:id/reject` | POST | Y | Y | Reject suggestion |
| 126 | `/rules/suggestions/:id/simulate` | POST | Y | Y | Simulate suggestion |
| 127 | `/rules/suggestions/generate` | POST | Y | Y | Generate suggestions |
| 128 | `/rules/test` | POST | Y | Y | Rule test |
| 129 | `/rules/version` | GET | Y | N | Rule cache version |

## Statistics (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 130 | `/statistics/processing` | GET | N | Y | Processing statistics |
| 131 | `/statistics/processing/cities` | GET | N | Y | City statistics summary |
| 132 | `/statistics/processing/realtime` | GET | N | N | Realtime statistics |
| 133 | `/statistics/processing/reconcile` | POST | N | Y | Statistics reconciliation |

## Test (2 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 134 | `/test/extraction-compare` | GET POST | N | Y | Extraction comparison test |
| 135 | `/test/extraction-v2` | GET POST | N | Y | Extraction V2 test |

## Test Tasks (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 136 | `/test-tasks/:taskId` | GET | Y | Y | Test task status |
| 137 | `/test-tasks/:taskId/cancel` | POST | Y | Y | Cancel test task |
| 138 | `/test-tasks/:taskId/details` | GET | Y | Y | Test task details |
| 139 | `/test-tasks/:taskId/report` | GET | Y | Y | Test report download |

## Workflow Errors (1 route)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 140 | `/workflow-errors/statistics` | GET | Y | Y | Workflow error statistics |

## Workflow Executions (4 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 141 | `/workflow-executions` | GET | N | Y | Execution list |
| 142 | `/workflow-executions/:id` | GET | N | N | Execution detail |
| 143 | `/workflow-executions/running` | GET | N | N | Running executions |
| 144 | `/workflow-executions/stats` | GET | N | Y | Execution statistics |

## Workflows (5 routes)

| # | Path | Methods | Auth | Zod | Purpose |
|---|------|---------|------|-----|---------|
| 145 | `/workflows/executions/:id/cancel` | POST | Y | N | Cancel workflow execution |
| 146 | `/workflows/executions/:id/error` | GET | Y | N | Execution error detail |
| 147 | `/workflows/executions/:id/retry` | POST | Y | N | Retry execution |
| 148 | `/workflows/trigger` | POST | Y | Y | Manual workflow trigger |
| 149 | `/workflows/triggerable` | GET | Y | Y | Triggerable workflow list |

> Note: Row 66 in Documents section is a duplicate listing for /documents route (same as row 51). Actual unique count is 148.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total route files | 148 |
| HTTP methods | GET: 102, POST: 56, PATCH: 6, PUT: 2, DELETE: 1 (Total: 167) |
| Auth coverage | 97/148 (65.5%) |
| Zod coverage | 86/148 (58.1%) |
| File upload | 4 (documents/upload, companies/:id, test/extraction-compare, test/extraction-v2) |
| Webhook | 2 (n8n/webhook, n8n/documents) |

### Auth Coverage by Sub-domain

| Sub-domain | Auth/Total | Coverage | Risk Level |
|------------|-----------|----------|------------|
| rules | 20/20 | 100% | Low |
| documents | 19/19 | 100% | Low |
| review | 5/5 | 100% | Low |
| workflows | 5/5 | 100% | Low |
| audit | 7/7 | 100% | Low |
| analytics | 3/3 | 100% | Low |
| cities | 3/3 | 100% | Low |
| routing | 3/3 | 100% | Low |
| escalations | 3/3 | 100% | Low |
| test-tasks | 4/4 | 100% | Low |
| companies | 11/12 | 92% | Low |
| reports | 4/12 | 33% | Medium |
| auth | 0/7 | 0% | N/A (public by design) |
| docs | 0/4 | 0% | N/A (public by design) |
| cost | 0/5 | 0% | High |
| dashboard | 0/5 | 0% | High |
| statistics | 0/4 | 0% | Medium |
| n8n | 0/4 | 0% | Medium (service-to-service) |
| workflow-executions | 0/4 | 0% | Medium |
| confidence | 0/2 | 0% | Medium |
| mapping | 0/2 | 0% | Medium |
| test | 0/2 | 0% | Low (dev/test only) |
