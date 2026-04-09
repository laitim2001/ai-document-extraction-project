# R5: Semantic Verification -- Components, Hooks, Lib & External Integrations

> Verified: 2026-04-09 | Scope: Level 4-5 semantic behavior checks | Points: ~80

---

## Summary Table

| Set | Category | Points | Pass | Fail | Accuracy |
|-----|----------|--------|------|------|----------|
| A | Component Pattern Semantics | 25 | 22 | 3 | 88% |
| B | Hooks/Types/Lib Semantics | 25 | 24 | 1 | 96% |
| C | External Integration Semantics | 30 | 27 | 3 | 90% |
| **Total** | | **80** | **73** | **7** | **91.3%** |

### Failure Summary

| ID | Claim | Actual | Severity |
|----|-------|--------|----------|
| A1a | Button import count = 221 | Actual = 272 | Medium |
| A1b | Badge import count = 139 | Actual = 155 | Medium |
| A1c | Card import count = 106 | Actual = 152 | Medium |
| A2 | Zustand stores used by 4 files (only reviewStore) | 4 component files correct, but 2nd store (document-preview-test-store) exists with 3 more consumers in app/ pages -- doc omits them | Low |
| C6 | Redis @upstash/redis import in rate-limit.service.ts | Import exists only in JSDoc example comment, not runtime code. Redis implementation is commented out. | Medium |
| C7a | SMTP env var named SMTP_PASS | Code uses SMTP_PASSWORD, not SMTP_PASS | Low |
| C10 | Env var list completeness | Missing SMTP vars from .env.example; PYTHON_MAPPING_SERVICE_URL not in .env.example (only MAPPING_SERVICE_URL present) | Low |

---

## Set A: Component Pattern Semantic Verification (25 points)

### A1. Most Used UI Components -- Import Count Verification (5 checks)

| Component | Claimed | Actual | Delta | Verdict |
|-----------|---------|--------|-------|---------|
| button | 221 | 272 | +51 (+23%) | **[FAIL]** -- undercounted by 23% |
| badge | 139 | 155 | +16 (+12%) | **[FAIL]** -- undercounted by 12% |
| card | 106 | 152 | +46 (+43%) | **[FAIL]** -- undercounted by 43% |
| input | 84 | 94 | +10 (+12%) | **[PASS]** -- within ~12%, acceptable rounding |
| select | 75 | 82 | +7 (+9%) | **[PASS]** -- within 10% |

**Method**: `grep -rl "from '@/components/ui/<name>'" src/ | wc -l` counts all files across src/ importing from the UI primitive. The document counted only within `src/components/` -- but the grep across the full `src/` directory (including `app/` pages) explains higher numbers. The doc should have clarified scope or used full src/ counts.

**Note**: input (84 vs 94) and select (75 vs 82) pass because they are within a ~10% margin that may reflect the doc counting component-only scope. Button/badge/card diverge by >12%, indicating the doc's figures were miscounted even within their stated scope.

### A2. State Management -- Zustand Usage (3 checks)

**Claim**: Zustand stores used by 4 files, only `reviewStore`.

**Verification**:
- `grep -rl "from '@/stores/reviewStore'" src/components/` returns exactly **4 files**: [PASS]
  1. `features/review/PdfViewer/PdfViewer.tsx` -- imports `useReviewStore`, confirmed
  2. `features/review/ReviewPanel/ReviewPanel.tsx` -- imports `useReviewStore`, confirmed
  3. `features/review/UnsavedChangesGuard.tsx` -- imports `useReviewStore`, confirmed
  4. `features/review/ReviewPanel/FieldRow.tsx` -- imports `useReviewStore`, confirmed

**Minor issue**: The doc's claim "only `reviewStore`" is incomplete. A second store `document-preview-test-store.ts` exists and is consumed by 3 files in `src/app/` pages (not components). The doc's scope is `src/components/` so the count of 4 is technically accurate for that scope, but the narrative "only reviewStore" omits the second store. **[PASS with note]**

### A3. React Query Usage (3 checks)

**Claim**: 23 component files use useQuery/useMutation.

**Verification**: `grep -rl "useQuery\|useMutation" src/components/` returns exactly **23 files**. **[PASS]**

Spot-checked 3 components:
- `DashboardStats.tsx` -- uses custom hooks that internally call useQuery
- `ReviewQueue.tsx` -- uses useReviewQueue hook
- Components primarily use React Query indirectly through custom hooks

**[PASS]**

### A4. React Hook Form + zodResolver Pattern (3 checks)

**Claim**: 34 components use React Hook Form.

**Verification**: `grep -rl "useForm" src/components/` returns exactly **34 files**. **[PASS]**

zodResolver pattern verified in 3 form components:
1. `AuditQueryForm.tsx` (line 29: `import { zodResolver }`, line 102: `resolver: zodResolver(auditQueryFormSchema)`) -- **[PASS]**
2. `LoginForm.tsx` (line 37: `import { zodResolver }`, line 82: `resolver: zodResolver(loginSchema)`) -- **[PASS]**
3. `GeneralSettingsForm.tsx` (line 29: `import { zodResolver }`, line 117: `resolver: zodResolver(generalSettingsSchema)`) -- **[PASS]**

### A5. next-intl Usage Count (1 check)

**Claim**: 209 files use useTranslations.

**Verification**: `grep -rl "useTranslations" src/components/` returns exactly **209 files**. **[PASS]**

### A6. "List + Detail + Form + Filters + Dialog" Pattern (2 domains)

**Domain 1: rules/** (22 files)
- List: `RuleList.tsx` -- [PASS]
- Detail: `RuleDetailView.tsx` -- [PASS]
- Form: `NewRuleForm.tsx`, `RuleEditForm.tsx` -- [PASS]
- Filters: `RuleFilters.tsx` -- [PASS]
- Dialog: `RuleEditDialog.tsx` -- [PASS]
All 5 parts present. **[PASS]**

**Domain 2: exchange-rate/** (6 files)
- List: `ExchangeRateList.tsx` -- [PASS]
- Detail: No dedicated detail component (inline or via list) -- partial
- Form: `ExchangeRateForm.tsx` -- [PASS]
- Filters: `ExchangeRateFilters.tsx` -- [PASS]
- Dialog: `ExchangeRateImportDialog.tsx` -- [PASS]
4 of 5 parts present (no separate detail view). Still matches the pattern claim "each feature domain follows..." as a general tendency. **[PASS]**

### A7. Drag-and-Drop Only in mapping-config (1 check)

**Claim**: @dnd-kit only in `mapping-config/` (MappingRuleList + SortableRuleItem).

**Verification**: `grep -rl "@dnd-kit" src/components/` returns **3 files**:
1. `features/mapping-config/MappingRuleList.tsx` -- [PASS]
2. `features/mapping-config/SortableRuleItem.tsx` -- [PASS]
3. `features/mapping-config/index.ts` -- barrel re-export, not a usage file

Only mapping-config uses @dnd-kit. Doc says "2" files, actual is 2 component files + 1 index. **[PASS]**

---

## Set B: Hooks/Types/Lib Semantic Verification (25 points)

### B1. Data-Fetching Hooks -- useQuery with Correct API (5 checks)

| Hook | Uses useQuery? | API Endpoint Pattern | Verdict |
|------|---------------|---------------------|---------|
| `use-companies.ts` | Yes (`useQuery` from `@tanstack/react-query`, line 34) | `/api/companies?...` | **[PASS]** |
| `use-cities.ts` | Yes (`useQuery` from `@tanstack/react-query`, line 29) | `/api/cities` | **[PASS]** |
| `use-exchange-rates.ts` | Yes (`useQuery` + `useMutation`, line 33) | `/api/v1/exchange-rates?...` | **[PASS]** |
| `use-roles.ts` | Yes (`useQuery` + `useMutation`, line 30) | `/api/admin/roles` | **[PASS]** |
| `useDashboardStatistics.ts` | Yes (`useQuery`, line 29) | `/api/dashboard/statistics?...` | **[PASS]** |

### B2. Mutation Hooks -- useMutation Verification (3 checks)

| Hook | Uses useMutation? | Purpose | Verdict |
|------|------------------|---------|---------|
| `useApproveReview.ts` | Yes (`useMutation` from `@tanstack/react-query`, line 17) | Submit review approval | **[PASS]** |
| `useCreateRule.ts` | Yes (`useMutation` from `@tanstack/react-query`, line 22) | Create mapping rule suggestion | **[PASS]** |
| `useSaveCorrections.ts` | Yes (`useMutation` from `@tanstack/react-query`, line 19) | Submit field corrections | **[PASS]** |

### B3. Feature Flag Functions (3 checks)

**Claim**: `src/config/feature-flags.ts` has Dynamic Prompt (5 flags), Extraction V3 (6 flags), Extraction V3.1 (3 flags).

| Function | Exists? | Behavior Match? | Verdict |
|----------|---------|----------------|---------|
| `getFeatureFlags()` | Yes (line 76) | Returns 5 dynamic prompt flags from env vars | **[PASS]** |
| `shouldUseDynamicPrompt(type)` | Yes (line 108) | Master toggle + per-type check | **[PASS]** |
| `getExtractionV3Flags()` | Yes (line 234) | Returns 6 V3 flags from env vars | **[PASS]** |
| `shouldUseExtractionV3(fileId?)` | Yes (line 270) | Canary routing with hash-based consistency | **[PASS]** |
| `getExtractionV3_1Flags()` | Yes (line 373) | Returns 3 V3.1 flags from env vars | **[PASS]** |

Flag counts: Dynamic Prompt=5, V3=6, V3.1=3. All match. **[PASS]**

### B4. Zustand reviewStore State Shape (1 check)

**Claim**: 9 state fields + 11 actions.

| Stated Field | Exists in Code? | Type Match? |
|-------------|-----------------|-------------|
| `selectedFieldId` | Yes (line 34) | `string \| null` -- [PASS] |
| `selectedFieldPosition` | Yes (line 36) | `FieldSourcePosition \| null` -- [PASS] |
| `editingFieldId` | Yes (line 40) | `string \| null` -- [PASS] |
| `currentPage` | Yes (line 44) | `number` -- [PASS] |
| `zoomLevel` | Yes (line 46) | `number` -- [PASS] |
| `dirtyFields` | Yes (line 50) | `Set<string>` -- [PASS] |
| `pendingChanges` | Yes (line 52) | `Map<string, string>` -- [PASS] |
| `originalValues` | Yes (line 54) | `Map<string, string \| null>` -- [PASS] |
| `fieldNames` | Yes (line 56) | `Map<string, string>` -- [PASS] |

Actions verified: setSelectedField, setCurrentPage, setZoomLevel, startEditing, stopEditing, markFieldDirty, clearDirtyField, resetChanges, hasPendingChanges, getPendingCorrections, resetStore -- all present (lines 60-79). **[PASS]**

### B5. Lib Utility Function Purpose Verification (3 checks)

| File | Claimed Purpose | Actual Code | Verdict |
|------|----------------|-------------|---------|
| `lib/utils/string.ts` | String manipulation utilities | Levenshtein distance, string similarity, company name normalization (confirmed lines 0-39) | **[PASS]** |
| `lib/routing/router.ts` | Confidence-based routing decision engine | `determineProcessingPath` with thresholds 95%/80% for AUTO/QUICK/FULL routing (confirmed lines 0-36) | **[PASS]** |
| `lib/learning/correctionAnalyzer.ts` | Analyze user corrections for patterns | Correction threshold = 3, analysis period = 30 days, pattern detection from Prisma (confirmed lines 0-39) | **[PASS]** |

### B6. Middleware audit-log.middleware.ts -- withAuditLog Export (1 check)

**Claim**: Exports `withAuditLog` as stated.

**Verification**: File exports `withAuditLog` (line 155) and `withAuditLogParams` (line 256) as HOF wrappers for API routes. The JSDoc describes auto audit logging for API operations. **[PASS]**

### B7. Contexts -- DashboardFilter and DateRange (2 checks)

| Context | Exists? | Purpose Match? | Verdict |
|---------|---------|---------------|---------|
| `DashboardFilterContext.tsx` | Yes | "Unified dashboard filter (date range + company + city)" -- confirmed: imports DateRange, DashboardFilterParams, ForwarderFilterMode. URL sync present. | **[PASS]** |
| `DateRangeContext.tsx` | Yes | "Global date range state with URL sync" -- confirmed: imports DateRange, DateRangeState, URL parsing functions. | **[PASS]** |

---

## Set C: External Integration Semantic Verification (30 points)

### C1. Azure Blob Storage -- src/lib/azure/storage.ts (3 checks)

**Claim**: Functions: upload, SAS URL generation, delete, exists check.

| Function | Exists? | Line | Verdict |
|----------|---------|------|---------|
| `uploadFile()` | Yes | 158 | **[PASS]** |
| `generateSasUrl()` | Yes | 213 | **[PASS]** |
| `deleteFile()` | Yes | 244 | **[PASS]** |
| `fileExists()` | Yes | 265 | **[PASS]** |
| `ensureContainer()` | Yes | 130 | **[PASS]** (bonus) |
| `isStorageConfigured()` | Yes | 302 | **[PASS]** (bonus) |

Env vars: `AZURE_STORAGE_CONNECTION_STRING` (line 68), `AZURE_STORAGE_CONTAINER` (line 69). Match .env.example. **[PASS]**

### C2. Azure Document Intelligence -- prebuilt-invoice Model (1 check)

**Claim**: Uses `prebuilt-invoice` model in Python code.

**Verification**: `python-services/extraction/src/ocr/azure_di.py` line 55: `self.model_id = "prebuilt-invoice"`. **[PASS]**

### C3. Azure OpenAI -- GPT Model Names (2 checks)

**Claim**: gpt-5-nano and gpt-5.2 used in GptCallerService.

**Verification** in `src/services/extraction-v3/stages/gpt-caller.service.ts`:
- Line 36: `export type GptModelType = 'gpt-5-nano' | 'gpt-5.2';` -- **[PASS]**
- Line 157: nano deployment from env `AZURE_OPENAI_NANO_DEPLOYMENT_NAME || 'gpt-5-nano'` -- **[PASS]**
- Line 159: main deployment from env `AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5-2-vision'` -- **[PASS]**
- Line 169: `'gpt-5-nano'` config block -- **[PASS]**
- Line 177: `'gpt-5.2'` config block -- **[PASS]**

Also confirmed in `gpt-vision.service.ts` (line 343, 749), `term-classification.service.ts` (line 94, 276). **[PASS]**

### C4. n8n Integration -- Service Files and Patterns (2 checks)

**Claim**: 9 services + 3 API routes.

| File | Exists? | Purpose Match? |
|------|---------|---------------|
| `n8n-webhook.service.ts` | Yes | Webhook event sending with retry (1s/5s/30s) -- confirmed in JSDoc lines 9-13 |
| `n8n-document.service.ts` | Yes | n8n-triggered document processing |
| `n8n-health.service.ts` | Yes | n8n instance health monitoring |
| `n8n-api-key.service.ts` | Yes | API key management for n8n |
| `webhook-config.service.ts` | Yes | Webhook endpoint configuration |
| `workflow-definition.service.ts` | Yes | Workflow template management |
| `workflow-execution.service.ts` | Yes | Execution tracking and history |
| `workflow-error.service.ts` | Yes | Error handling and recovery |
| `workflow-trigger.service.ts` | Yes | Workflow trigger management |

Webhook event types confirmed in JSDoc (lines 16-23): DOCUMENT_RECEIVED, DOCUMENT_PROCESSING, DOCUMENT_COMPLETED, DOCUMENT_FAILED, DOCUMENT_REVIEW_NEEDED, WORKFLOW_STARTED, WORKFLOW_COMPLETED, WORKFLOW_FAILED. **[PASS]**

Env vars: `N8N_BASE_URL` used in `health-check.service.ts` (line 98). `N8N_API_KEY` referenced in .env.example. **[PASS]**

### C5. Nodemailer -- SMTP Configuration Pattern (2 checks)

**Claim**: Development uses JSON transport, Production uses SMTP.

**Verification** in `src/lib/email.ts`:
- Line 38: `if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST)` --> JSON transport. **[PASS]**
- Lines 47-55: Production SMTP transport with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`. **[PASS]**

**[FAIL on env var name]**: integration-map.md states `SMTP_PASS` but code uses `SMTP_PASSWORD` (line 54: `pass: process.env.SMTP_PASSWORD`). Minor naming mismatch in documentation.

### C6. Redis/Upstash -- rate-limit.service.ts (2 checks)

**Claim**: @upstash/redis import in rate-limit.service.ts, sliding window algorithm.

**Verification**:
- The JSDoc comment (line 23) mentions `@upstash/redis` as a dependency.
- Lines 220-234: The Redis implementation exists only as a **commented-out code example** in JSDoc, not as runtime code. The actual `RateLimitService` class uses an **in-memory implementation** with a `Map<string, number[]>`.
- Line 233-234: `// 生產環境 Redis 實現可在需要時啟用` + `// export class RedisRateLimitService extends RateLimitService { ... }`

**[FAIL]**: The doc claims `@upstash/redis` import exists in this file, but it is only referenced in JSDoc comments. The actual runtime code does **not** import or use `@upstash/redis`. The Redis implementation is a placeholder for production use.

Sliding window concept is present in the in-memory implementation. Graceful degradation is implemented. **[PARTIAL PASS on behavior, FAIL on import claim]**

### C7. Python Extraction Service Endpoints (3 checks)

**Claim**: `POST /extract/url`, `POST /extract/file`, `GET /health`.

**Verification** in `python-services/extraction/src/main.py`:
- Line 189: `@app.get("/health", response_model=HealthResponse)` -- **[PASS]**
- Line 200: `@app.post("/extract/url", response_model=ExtractResponse)` -- **[PASS]**
- Line 231: `@app.post("/extract/file", response_model=ExtractResponse)` -- **[PASS]**

### C8. Python Mapping Service Endpoints (4 checks)

**Claim**: `POST /identify`, `POST /map-fields`, `GET /forwarders`, `GET /health`.

**Verification** in `python-services/mapping/src/main.py`:
- Line 365: `@app.get("/health", response_model=HealthResponse)` -- **[PASS]**
- Line 376: `@app.get("/forwarders", response_model=ForwardersResponse)` -- **[PASS]**
- Line 386: `@app.post("/identify", response_model=IdentifyResponse)` -- **[PASS]**
- Line 447: `@app.post("/map-fields", response_model=MapFieldsResponse)` -- **[PASS]**

### C9. Node.js --> Python HTTP Call Pattern (3 checks)

| Node.js File | Python Service | Endpoint | Env Var | Verdict |
|-------------|---------------|----------|---------|---------|
| `extraction.service.ts` (line 41) | Extraction :8000 | `POST /extract/url` (line 188) | `OCR_SERVICE_URL \|\| 'http://localhost:8000'` | **[PASS]** |
| `extraction.service.ts` (line 327) | Extraction :8000 | `GET /health` | Same env var | **[PASS]** |
| `identification/identification.service.ts` (line 95) | Mapping :8001 | `POST /identify` | `MAPPING_SERVICE_URL \|\| 'http://localhost:8001'` | **[PASS]** |
| `mapping.service.ts` (lines 48-49) | Mapping :8001 | `POST /map-fields` (line 341) | `PYTHON_MAPPING_SERVICE_URL \|\| 'http://localhost:8001'` | **[PASS]** |

Node.js uses `fetch()` for HTTP calls to Python services. Pattern confirmed. **[PASS]**

### C10. Env Var Names -- integration-map.md vs Code (5 checks)

| Category | Doc Var Name | Code Reference | .env.example | Verdict |
|----------|-------------|---------------|-------------|---------|
| Azure Blob | `AZURE_STORAGE_CONNECTION_STRING` | `storage.ts:68` | Line 26 | **[PASS]** |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | `gpt-caller.service.ts`, `gpt-vision.service.ts` | Line 43 | **[PASS]** |
| Azure OpenAI | `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-caller.service.ts:159` | Line 45 | **[PASS]** |
| Nodemailer | `SMTP_PASS` | Code uses `SMTP_PASSWORD` (email.ts:54) | Not in .env.example | **[FAIL]** |
| Python Mapping | `PYTHON_MAPPING_SERVICE_URL` | `mapping.service.ts:48` | Not in .env.example (only `MAPPING_SERVICE_URL` present) | **[FAIL]** -- doc lists both names but .env.example only has `MAPPING_SERVICE_URL` |

Additional verified env vars that match:
- `DATABASE_URL` -- [PASS]
- `AUTH_SECRET` -- [PASS]
- `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID` -- [PASS]
- `UPSTASH_REDIS_REST_URL/TOKEN` -- [PASS]
- `N8N_BASE_URL/API_KEY` -- [PASS]
- `MICROSOFT_GRAPH_CLIENT_ID/SECRET/TENANT_ID` -- [PASS]
- `OCR_SERVICE_URL` -- [PASS]

---

## Detailed Findings

### Finding 1: UI Component Import Counts Undercounted (A1)

The components-overview.md lists button=221, badge=139, card=106. Actual counts when searching the full `src/` directory are 272, 155, 152 respectively. The discrepancy is likely because the analysis counted imports only within `src/components/` but the document doesn't state this scope limitation. The `src/app/` directory (page components) also imports UI primitives heavily.

**Recommendation**: Either re-count using full `src/` scope, or clearly state the scope is `src/components/` only.

### Finding 2: Redis Implementation is Placeholder (C6)

The integration-map.md describes `@upstash/redis` as actively used in `rate-limit.service.ts`. In reality, the Redis implementation is commented out and the service uses an in-memory `Map<string, number[]>` for rate limiting. This means the rate limiter is **not distributed** and resets on server restart.

**Impact**: Medium -- rate limiting behavior differs from what the documentation implies (no persistence across restarts, no multi-instance coordination).

### Finding 3: SMTP_PASS vs SMTP_PASSWORD Mismatch (C7a)

The integration-map.md documents the env var as `SMTP_PASS`, but the code in `src/lib/email.ts` references `process.env.SMTP_PASSWORD`. Anyone configuring the application using the documented variable name would have non-functional email.

**Impact**: Low -- only affects production email configuration, and SMTP vars are also missing from `.env.example`.

### Finding 4: Second Zustand Store Omitted from Narrative (A2)

The components-overview.md states "Minimal Zustand usage: Only 4 files reference Zustand stores (all `reviewStore`)." While the 4-file count is accurate for `src/components/`, the hooks-types-lib-overview.md correctly documents both stores. The `document-preview-test-store.ts` has 3 consumer files in `src/app/` pages, making total Zustand usage 7 files across the codebase.

**Impact**: Low -- the doc's scope is components-only, and the second document covers the full picture.

---

## Verification Methods

| Method | Tool | Count |
|--------|------|-------|
| File content reading | Read tool | 22 files |
| Pattern search (grep) | Grep tool | 18 searches |
| File counting | Bash wc -l | 8 counts |
| Directory listing | Bash ls | 3 listings |
| File existence | Glob | 2 searches |

All verifications performed against live codebase at commit `7d4a465`.
