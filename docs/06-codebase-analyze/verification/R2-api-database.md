# R2: API Routes & Database Verification Report

> **Verified**: 2026-04-09 | **Verifier**: Claude Opus 4.6 | **Score**: 80/100

---

## Documents Under Verification

| # | Document | Path |
|---|----------|------|
| 1 | API Routes Overview | `docs/06-codebase-analyze/02-module-mapping/api-routes-overview.md` |
| 2 | API Admin Detail | `docs/06-codebase-analyze/02-module-mapping/detail/api-admin.md` |
| 3 | API V1 Detail | `docs/06-codebase-analyze/02-module-mapping/detail/api-v1.md` |
| 4 | Prisma Model Inventory | `docs/06-codebase-analyze/03-database/prisma-model-inventory.md` |

---

## Set A: API Route Counts (22/25)

### A1. Total Route File Count

| Check | Result |
|-------|--------|
| **[PASS] Total route.ts count** | Doc: 331, Actual: **331** -- exact match |
| **[PASS] Admin domain count** | Doc: 106, Actual: **106** -- exact match |
| **[PASS] V1 domain count** | Doc: 77, Actual: **77** -- exact match |
| **[PASS] Other domain count** | Doc: 148, Actual: **148** -- exact match |

### A2. HTTP Method Distribution

| Method | Doc | Actual | Result |
|--------|-----|--------|--------|
| GET | 225 | **226** | **[FAIL]** Off by +1 (Other domain: doc=102, actual=103) |
| POST | 148 | **149** | **[FAIL]** Off by +1 (Other domain: doc=56, actual=57) |
| PATCH | 33 | **33** | **[PASS]** |
| DELETE | 31 | **31** | **[PASS]** |
| PUT | 8 | **8** | **[PASS]** |
| **Total** | **445** | **447** | **[FAIL]** Off by +2 total |

**Note**: GET and POST each have +1 in the "Other" domain. Admin and V1 method counts match exactly. Likely 1 route in Other exports both GET and POST that was missed. The variance is minor (0.4%).

### A3. Per-Domain Method Counts (Admin & V1)

| Domain | GET | POST | PATCH | DELETE | PUT | Result |
|--------|-----|------|-------|--------|-----|--------|
| Admin | 71/71 | 54/54 | 12/12 | 16/16 | 6/6 | **[PASS]** All match |
| V1 | 52/52 | 38/38 | 15/15 | 14/14 | 0/0 | **[PASS]** All match |

### A4. Special Endpoints

| Check | Result |
|-------|--------|
| **[PASS] SSE: `/admin/logs/stream`** | Confirmed -- uses `ReadableStream` + SSE encoding |
| **[PASS] SSE: `/admin/historical-data/batches/:batchId/progress`** | Confirmed -- uses `encodeSSEMessage()` SSE pattern |
| **[PASS] Upload: `/admin/document-preview-test/extract`** | Confirmed -- uses `FormData` |
| **[PASS] Upload: `/documents/upload`** | Confirmed -- uses `FormData` |
| **[PASS] Upload: `/v1/invoices`** | Confirmed -- uses `FormData` |

### A5. Sub-domain Route Counts (Other Domain)

All 30+ sub-domains verified. Every single count matches the doc: rules=20, documents=19, companies=12, reports=12, auth=7, audit=7, review=5, workflows=5, workflow-executions=4, cost=5, dashboard=5, n8n=4, statistics=4, test-tasks=4, docs=4, escalations=3, analytics=3, cities=3, routing=3, corrections=2, history=2, confidence=2, mapping=2, test=2, health=1, openapi=1, extraction=1, prompts=1, exports=1, jobs=1, roles=1, rollback-logs=1, workflow-errors=1.

| Check | Result |
|-------|--------|
| **[PASS] All Other sub-domain counts** | 30+ sub-domains verified, all match |

### A6. Section Header vs Table Count (api-admin.md)

| Section | Header Claim | Table Rows | Actual Files | Result |
|---------|-------------|------------|-------------|--------|
| Historical Data | "17 routes" | 19 entries (#39-#57) | 19 | **[FAIL]** Header says 17, table+code both show 19 |
| Retention | "6 routes" | 7 entries (#92-#98) | 7 | **[FAIL]** Header says 6, table+code both show 7 |

**Note**: The table contents are complete and accurate; only the section header counts are wrong. The overall 106-route total in the doc is correct.

---

## Set B: API Auth Coverage (18/25)

### B1. Individual Route Auth Verification (15 routes sampled)

| Route | Doc Auth | Actual Auth | Result |
|-------|----------|-------------|--------|
| `/admin/alerts` | Y | Y (await auth()) | **[PASS]** |
| `/admin/api-keys` | Y | Y (await auth()) | **[PASS]** |
| `/admin/backups` | Y | Y (await auth()) | **[PASS]** |
| `/admin/config` | Y | Y (await auth()) | **[PASS]** |
| `/admin/logs` | Y | Y (await auth()) | **[PASS]** |
| `/admin/roles` | Y | Y (await auth()) | **[PASS]** |
| `/admin/users` | Y | Y (await auth()) | **[PASS]** |
| `/admin/settings` | Y | Y (await auth()) | **[PASS]** |
| `/admin/document-preview-test/extract` | N | N | **[PASS]** |
| `/admin/historical-data/upload` | N | Y (getAuthSession) | **[FAIL]** Doc says N, code has getAuthSession |
| `/admin/term-analysis` | N | N | **[PASS]** |
| `/v1/data-templates` | N | N | **[PASS]** |
| `/v1/exchange-rates` | N | N | **[PASS]** |
| `/v1/users/me` | Y | Y | **[PASS]** |
| `/v1/users/me/password` | Y | Y | **[PASS]** |

### B2. Auth Coverage Totals

| Domain | Doc | Actual | Result |
|--------|-----|--------|--------|
| Admin | 96/106 (90.6%) | **101/106 (95.3%)** | **[FAIL]** 5 routes incorrectly marked as no-auth |
| V1 | 3/77 (3.9%) | **3/77 (3.9%)** | **[PASS]** |
| Other | 97/148 (65.5%) | **93/148 (62.8%)** | **[FAIL]** 4 document routes overcounted |
| **Total** | **196/331 (59.2%)** | **197/331 (59.5%)** | **[FAIL]** Off by +1 net |

### B3. Admin Auth Mismatches (5 routes incorrectly marked N)

These routes import `getAuthSession` from `@/lib/auth` and enforce session checks, but the doc marks them as Auth=**N**:

| Route | Doc | Actual |
|-------|-----|--------|
| `/admin/historical-data/batches` | **N** | **Y** (getAuthSession) |
| `/admin/historical-data/batches/:batchId` | **N** | **Y** (getAuthSession) |
| `/admin/historical-data/batches/:batchId/process` | **N** | **Y** (getAuthSession) |
| `/admin/historical-data/files` | **N** | **Y** (getAuthSession) |
| `/admin/historical-data/upload` | **N** | **Y** (getAuthSession) |

**Root cause**: These routes use `getAuthSession()` instead of `auth()`. The doc generator likely only searched for `auth()` pattern and missed `getAuthSession()`.

### B4. Other Domain Auth Mismatch (4 document routes overcounted)

Doc claims documents domain has 100% auth (19/19), but these 4 routes lack auth:

| Route | Status |
|-------|--------|
| `/documents/from-outlook` | No auth import |
| `/documents/from-outlook/status/[fetchLogId]` | No auth import |
| `/documents/from-sharepoint` | No auth import |
| `/documents/from-sharepoint/status/[fetchLogId]` | No auth import |

**Actual documents auth**: 15/19 (79%), not 19/19 (100%).

### B5. Zod Validation Coverage

| Domain | Doc | Actual | Result |
|--------|-----|--------|--------|
| Admin | 65/106 (61.3%) | **65/106** | **[PASS]** Exact match |
| V1 | 64/77 (83.1%) | **64/77** | **[PASS]** Exact match |
| Total | 215/331 (64.9%) | **215/331** | **[PASS]** Exact match |

---

## Set C: Database Models (21/25)

### C1. Schema-Level Counts

| Metric | Doc | Actual | Result |
|--------|-----|--------|--------|
| Total Models | 122 | **122** | **[PASS]** Exact match |
| Total Enums | 113 | **113** | **[PASS]** Exact match |
| Total Relations (@relation) | 256 | **256** | **[PASS]** Exact match |
| Cascade Deletes | 46 | **46** | **[PASS]** Exact match |
| SetNull Deletes | 1 | **1** (ExchangeRate.inverseOf) | **[PASS]** Exact match |
| PK uuid() | 47 | **47** | **[PASS]** Exact match |
| PK cuid() | 74 | **74** | **[PASS]** Exact match |
| PK composite/none | 1 (VerificationToken) | **1** | **[PASS]** Exact match |

### C2. Model Field Counts (10 sampled)

| Model | Doc Fields | Actual Fields | Result |
|-------|-----------|---------------|--------|
| VerificationToken | 3 | **3** | **[PASS]** |
| Account | 11 | **12** (scalar only, excl. relation) | **[FAIL]** Off by +1 |
| Session | 6 | **7** | **[FAIL]** Off by +1 |
| Region | 11 | **9** (non-array) / **10** (scalar) | **[FAIL]** Neither matches |
| City | 12 | **14** (non-array) / **27** (scalar) | **[FAIL]** Neither matches |
| OcrResult | 11 | **14** (non-array) / **13** (scalar) | **[FAIL]** Off by +2 to +3 |
| ProcessingQueue | 14 | **19** (non-array) / **17** (scalar) | **[FAIL]** Off by +3 to +5 |
| BulkOperation | 7 | **9** | **[FAIL]** Off by +2 |
| RuleCacheVersion | 4 | **5** | **[FAIL]** Off by +1 |
| SystemSetting | 6 | **7** | **[FAIL]** Off by +1 |

**Assessment**: 9 out of 10 field counts are wrong. The doc systematically undercounts fields. The counting methodology is inconsistent -- no single approach (scalar-only, non-array, all fields) reproduces the doc's numbers. This is a **systematic documentation error** in field counts across the entire inventory.

### C3. Relationship Verification (5 cascade deletes)

| Relationship | Doc Claim | Actual | Result |
|-------------|-----------|--------|--------|
| Account -> User (Cascade) | Yes | **Yes** | **[PASS]** |
| OcrResult -> Document (Cascade) | Yes | **Yes** | **[PASS]** |
| Session -> User (Cascade) | Yes | **Yes** | **[PASS]** |
| UserRole -> User+Role (Cascade) | Yes | **Yes** (both confirmed) | **[PASS]** |
| FieldMappingRule -> FieldMappingConfig (Cascade) | Yes | **Yes** | **[PASS]** |

### C4. PK Type Verification (10 sampled)

| Model | Doc PK | Actual PK | Result |
|-------|--------|-----------|--------|
| User | cuid | **cuid** | **[PASS]** |
| Document | uuid | **uuid** | **[PASS]** |
| Company | uuid | **uuid** | **[PASS]** |
| Region | uuid | **uuid** | **[PASS]** |
| MappingRule | uuid | **uuid** | **[PASS]** |
| SystemConfig | cuid | **cuid** | **[PASS]** |
| HistoricalBatch | uuid | **uuid** | **[PASS]** |
| Alert | cuid | **cuid** | **[PASS]** |
| ExchangeRate | cuid | **cuid** | **[PASS]** |
| FieldDefinitionSet | uuid | **uuid** | **[PASS]** |

---

## Set D: Enums & Migrations (19/25)

### D1. Enum Count

| Check | Result |
|-------|--------|
| **[PASS] Total enums** | Doc: 113, Actual: **113** -- exact match |

### D2. Enum Value Verification (10 sampled)

| Enum | Doc (N/A -- no enum values in doc) | Actual Values | Result |
|------|-----|------|--------|
| DocumentStatus | N/A | 14 values: UPLOADING, UPLOADED, OCR_PROCESSING, OCR_COMPLETED, OCR_FAILED, MAPPING_PROCESSING, MAPPING_COMPLETED, REF_MATCH_FAILED, PENDING_REVIEW, IN_REVIEW, COMPLETED, FAILED, APPROVED, ESCALATED | **[N/A]** Doc does not list enum values |
| QueueStatus | N/A | 5 values: PENDING, IN_PROGRESS, COMPLETED, SKIPPED, CANCELLED | **[N/A]** |
| UserStatus | N/A | 3 values: ACTIVE, INACTIVE, SUSPENDED | **[N/A]** |
| CompanyType | N/A | 6 values: FORWARDER, EXPORTER, CARRIER, CUSTOMS_BROKER, OTHER, UNKNOWN | **[N/A]** |
| ReviewAction | N/A | 3 values: APPROVED, CORRECTED, ESCALATED | **[N/A]** |
| CorrectionType | N/A | 2 values: NORMAL, EXCEPTION | **[N/A]** |
| AlertSeverity | N/A | 5 values: INFO, WARNING, ERROR, CRITICAL, EMERGENCY | **[N/A]** |
| BackupStatus | N/A | 5 values: PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELLED | **[N/A]** |
| ProcessingPath | N/A | 4 values: AUTO_APPROVE, QUICK_REVIEW, FULL_REVIEW, MANUAL_REQUIRED | **[N/A]** |
| RegionStatus | N/A | 2 values: ACTIVE, INACTIVE | **[N/A]** |

**Note**: The Prisma Model Inventory doc does not include an enum value inventory, so individual enum values cannot be verified against the doc. The enums exist and are well-formed in the schema. **This is a documentation coverage gap**, not a verification failure. Scoring reduced for incomplete doc coverage.

### D3. Migration Counts

| Check | Result |
|-------|--------|
| **[PASS] Migration directories** | **10** migration directories found |
| **[PASS] Date range** | 2025-12-18 through 2025-12-19 |

**Note**: The doc does not make migration count claims, so this is baseline data only.

### D4. V1 Sub-domain Route Counts

All 19 V1 sub-domains verified:

| Sub-domain | Doc | Actual | Result |
|------------|-----|--------|--------|
| admin | 2 | 2 | **[PASS]** |
| batches | 2 | 2 | **[PASS]** |
| data-templates | 3 | 3 | **[PASS]** |
| documents | 3 | 3 | **[PASS]** |
| exchange-rates | 7 | 7 | **[PASS]** |
| extraction-v3 | 1 | 1 | **[PASS]** |
| field-definition-sets | 7 | 7 | **[PASS]** |
| field-mapping-configs | 8 | 8 | **[PASS]** |
| formats | 6 | 6 | **[PASS]** |
| invoices | 7 | 7 | **[PASS]** |
| pipeline-configs | 3 | 3 | **[PASS]** |
| prompt-configs | 3 | 3 | **[PASS]** |
| reference-numbers | 5 | 5 | **[PASS]** |
| regions | 2 | 2 | **[PASS]** |
| template-field-mappings | 3 | 3 | **[PASS]** |
| template-instances | 5 | 5 | **[PASS]** |
| template-matching | 4 | 4 | **[PASS]** |
| users | 3 | 3 | **[PASS]** |
| webhooks | 3 | 3 | **[PASS]** |

### D5. Route HTTP Method Spot Checks (5 routes)

| Route | Doc Methods | Actual Methods | Result |
|-------|------------|----------------|--------|
| `/admin/alerts` | GET POST | GET POST | **[PASS]** |
| `/admin/alerts/rules/:id` | GET PUT DELETE | GET PUT DELETE | **[PASS]** |
| `/v1/exchange-rates/:id` | GET PATCH DELETE | GET PATCH DELETE | **[PASS]** |
| `/v1/template-instances/:id/rows/:rowId` | PATCH DELETE | PATCH DELETE | **[PASS]** |
| `/admin/users/:id` | GET PATCH | GET PATCH | **[PASS]** |

---

## Summary

### Score Breakdown

| Set | Points | Max | Key Findings |
|-----|--------|-----|-------------|
| A: Route Counts | 22 | 25 | Total + domain counts perfect; GET/POST each off by 1; 2 section header typos |
| B: Auth Coverage | 18 | 25 | 5 admin routes incorrectly marked no-auth; 4 doc routes overcounted; Zod perfect |
| C: Database Models | 21 | 25 | All schema-level counts perfect; PK types perfect; 9/10 field counts wrong |
| D: Enums & Migrations | 19 | 25 | Enum/migration counts match; doc lacks enum value inventory; all route details correct |
| **Total** | **80** | **100** | |

### Critical Failures (Must Fix)

| # | Issue | Impact | Location |
|---|-------|--------|----------|
| 1 | **Admin auth: 5 routes marked N that have `getAuthSession`** | Security audit will see false gaps | `api-admin.md` rows #39, #40, #46, #50, #57 |
| 2 | **Documents auth: claimed 100% (19/19), actual 79% (15/19)** | Security gap hidden by false 100% claim | `api-routes-overview.md` section 5, documents row |
| 3 | **Model field counts systematically wrong (9/10 fail)** | Entire field count column unreliable | `prisma-model-inventory.md` all "Fields" columns |

### Minor Issues

| # | Issue | Location |
|---|-------|----------|
| 4 | GET count 225 vs actual 226, POST 148 vs 149 (total 445 vs 447) | `api-routes-overview.md` method table |
| 5 | Historical Data section header says "17 routes" but lists 19 | `api-admin.md` line 90 |
| 6 | Retention section header says "6 routes" but lists 7 | `api-admin.md` line 183 |
| 7 | Auth total 196 vs actual 197 (net of admin +5, other -4) | `api-routes-overview.md` auth table |
| 8 | Doc has no enum value inventory (113 enums undocumented) | `prisma-model-inventory.md` |

### Root Cause Analysis

1. **Auth detection gap**: The doc generator searched for `auth()` pattern but missed `getAuthSession()` -- a different function from the same `@/lib/auth` module used in 5 historical-data routes.
2. **Field count methodology**: No consistent counting methodology was applied. Some counts appear to exclude `id`/`createdAt`/`updatedAt`, others don't. The undercounting ranges from -1 to -5 per model.
3. **Method count**: Two routes in the "Other" domain export GET or POST via `export const METHOD = wrapper(...)` pattern that may have been missed by a narrow grep.

---

*Verification completed: 2026-04-09*
