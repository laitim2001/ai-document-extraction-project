# R19 — Deep Runtime Behavior Verification

> Round 19 of 19 | Date: 2026-04-09
> Focus: runtime behavior patterns never checked in prior rounds
> Points verified: **125**

---

## Set A: React Query Cache Configuration (~25 pts)

### A1. QueryClient Initialization (src/providers/QueryProvider.tsx)

**Verified.** The QueryClient is instantiated inside a `React.useState` callback (line 47-59) to ensure SSR/client consistency. The singleton is wrapped in `QueryClientProvider`.

| Default Option | Value | Note |
|---|---|---|
| `staleTime` | 60,000 ms (1 min) | Data considered fresh for 1 minute |
| `gcTime` | 300,000 ms (5 min) | Garbage collected after 5 minutes |
| `refetchOnWindowFocus` | `false` | No automatic refetch on tab focus |
| `retry` | 2 | Two retries on failure |
| `refetchOnMount` | not set (default: `true`) | Uses React Query default |
| `refetchOnReconnect` | not set (default: `true`) | Uses React Query default |

**No** mutation-level defaults are configured (no `defaultOptions.mutations`).

### A2. Hooks Overriding Defaults (10 sampled)

| Hook | staleTime | gcTime | Notes |
|---|---|---|---|
| `use-documents.ts` | 2,000 ms (2s) | default (5m) | Very short stale — near-real-time list |
| `use-document-detail.ts` | 30,000 ms (30s) | 5 min | Shorter than default for detail views |
| `use-cities.ts` | 5 min | 30 min | Long-lived reference data |
| `use-accessible-cities.ts` | 5 min | 30 min | Long-lived reference data |
| `use-exchange-rates.ts` | 5 min | 30 min | Long-lived reference data |
| `use-health-monitoring.ts` | 10,000 ms (10s) | default | Fast refresh for health checks |
| `use-historical-data.ts` | 5,000 ms (5s) | default | Short stale for active batches |
| `use-performance.ts` | 10,000-30,000 ms | default | 10s for current, 30s for historical |
| `use-field-definition-sets.ts` | 3,600,000 ms (1hr) | default | Longest staleTime in codebase |
| `use-pipeline-configs.ts` | 5 min | 30 min | Long-lived config data |

**Pattern**: Reference/config data (cities, rates, regions, pipeline configs) use 5min/30min. Active processing data (documents, health) use 2-30 seconds. The `STALE_TIME_MS` constant is defined locally in 6 hooks (not centralized), all set to 5 or 10 minutes.

### A3. placeholderData and initialData Usage

**`placeholderData`** — found in 5 hooks (8 usages):
- `use-health-monitoring.ts` — `keepPreviousData` (pagination-like behavior)
- `use-users.ts` — `keepPreviousData` (pagination)
- `use-system-config.ts` — `keepPreviousData` (x2)
- `useEscalationList.ts` — static empty object (prevents loading flash)
- `useRuleList.ts` — static empty object
- `useSuggestionList.ts` — static empty object

**`initialData`** — **Not used** in any hook. Zero occurrences across all 101 hooks.

### A4. invalidateQueries Patterns in Mutations

**Highly consistent.** All mutation hooks follow this pattern in `onSuccess`:
```typescript
queryClient.invalidateQueries({ queryKey: xxxKeys.lists() })
```

Specific patterns observed:
- **Targeted invalidation**: Most mutations invalidate specific key factories (e.g., `alertKeys.lists()`, `backupKeys.summary()`)
- **Multi-key invalidation**: Complex mutations invalidate 2-4 related keys (e.g., backup create invalidates `lists + summary + storage`)
- **Broad invalidation**: Some use string arrays directly (e.g., `['documents']`, `['users']`)
- **No `queryClient.removeQueries()` usage** found anywhere

### A5. Query Key Factory Pattern

**Mixed approach — NOT uniform.**

**Factory pattern** (structured `xxxKeys` object): Used by ~40+ hooks. Standard shape:
```typescript
export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters?) => [...alertKeys.lists(), filters] as const,
  details: () => [...alertKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
  summary: () => [...alertKeys.all, 'summary'] as const,
};
```

**Ad-hoc string arrays** (no factory): Used by ~15+ hooks including:
- `use-cities.ts` — `['cities']`, `['cities', 'grouped']`
- `use-roles.ts` — `['roles']`
- `use-users.ts` — `['users', params]`, `['user', userId]`
- `use-company-formats.ts` — `['formats', 'company', companyId, queryParams]`
- `use-format-detail.ts` — `['format', formatId]`
- `use-regions.ts` — `['regions', { isActive }]`
- `useApproveReview.ts` — `['reviewDetail', documentId]`, `['reviewQueue']`

**Verdict**: The factory pattern is dominant in newer hooks but legacy camelCase hooks and some newer ones still use ad-hoc strings. No centralized query key index file exists.

---

## Set B: Email Template and Notification System (~20 pts)

### B1. Email Functions (src/lib/email.ts)

Four exported functions:

| Function | Purpose | Trigger |
|---|---|---|
| `sendEmail(options)` | Generic email sender | Called by all other functions |
| `sendVerificationEmail(email, name, token, locale)` | Account verification | User registration (auth/register API) |
| `sendPasswordResetEmail(email, name, token)` | Password reset link | Forgot password flow (auth/forgot-password API) |
| `sendPasswordChangedEmail(email, name)` | Password change notification | After password reset (auth/reset-password API) |

### B2. HTML Email Templates

**Inline HTML templates** — no separate template files. All 3 email types have styled HTML templates built with template literals directly inside the functions. Each template includes:
- Responsive CSS styles (inline `<style>` block)
- Blue gradient header with "AI Document Extraction" branding
- Content body with action button (blue CTA)
- Warning/alert boxes
- Footer with copyright
- Corresponding plain-text fallback (`text` field)

**No template engine** (Handlebars, EJS, etc.) is used. Templates are hardcoded in `email.ts`.

### B3. Email Triggers

| Trigger | Email Sent | Token Validity |
|---|---|---|
| User registration (`POST /api/auth/register`) | Verification email | 24 hours |
| Forgot password (`POST /api/auth/forgot-password`) | Password reset email | 1 hour |
| Password reset completed (`POST /api/auth/reset-password`) | Password changed notification | N/A |

### B4. Notification Channels (src/services/notification.service.ts)

**Single channel: Database only.** Notifications are created as records in the `Notification` Prisma model. The service has:
- `notifySuperUsers()` — targets users with `RULE_MANAGE` permission
- `notifyUsers()` — targets specific user IDs
- `getUnreadNotifications()` / `getUnreadNotificationCount()`
- `markNotificationAsRead()` / `markAllNotificationsAsRead()`

Notification types: `RULE_SUGGESTION`, `ESCALATION`, `SYSTEM_ALERT`, `TASK_ASSIGNED`

**TODO comments at line 137-139** confirm future plans for Email, WebSocket, and Microsoft Teams channels — none implemented yet.

### B5. Email Queue

**No queue.** Email sending is **synchronous** (awaited). The `sendEmail()` function directly calls `transport.sendMail()`. In development without SMTP, it simply `console.log`s and returns immediately.

The transporter uses a **singleton pattern** (lazy initialization). Development mode uses `jsonTransport` (no actual sending). Production uses SMTP with configurable host/port/auth via environment variables.

---

## Set C: Webhook Payload Verification (~20 pts)

### C1. Webhook Events (src/services/webhook.service.ts + webhook-event-trigger.ts)

Four event types (defined as Prisma enum `WebhookEventType`):

| Event | Trigger | Payload Key Data |
|---|---|---|
| `INVOICE_PROCESSING` | Processing started | fileName, mimeType, fileSize, submittedAt |
| `INVOICE_COMPLETED` | Processing finished | confidenceScore, fieldCount, processingTimeMs, resultUrl |
| `INVOICE_FAILED` | Processing failed | errorCode, errorMessage, failedStep, retryable |
| `INVOICE_REVIEW_REQUIRED` | Needs human review | confidenceScore, reviewReason, lowConfidenceFields, reviewUrl |

### C2. Webhook Payload Schema

Standard structure (line 192-197):
```typescript
interface WebhookPayload {
  event: WebhookEventType;
  taskId: string;
  timestamp: string; // ISO 8601
  data: EventSpecificPayload;
}
```

The `data` field varies per event type (typed as `InvoiceProcessingPayload`, `InvoiceCompletedPayload`, etc., defined in `src/types/external-api/webhook.ts`).

### C3. Delivery Tracking (Prisma Model)

Deliveries are tracked in the `ExternalWebhookDelivery` model with fields:
- `id`, `taskId`, `event`, `targetUrl`, `payload` (JSON)
- `signature` (HMAC-SHA256), `timestamp` (BigInt)
- `status` (PENDING, SENDING, DELIVERED, FAILED, RETRYING)
- `httpStatus`, `responseBody` (truncated to 5000 chars), `errorMessage` (1000 chars)
- `attempts`, `maxAttempts`, `nextRetryAt`, `lastAttemptAt`
- `createdAt`, `completedAt`

### C4. Retry Logic

**Exponential backoff** with 3 delay tiers (line 68):
```
Retry 1: 60,000 ms  (1 minute)
Retry 2: 300,000 ms (5 minutes)
Retry 3: 1,800,000 ms (30 minutes)
```

- Default `maxAttempts = maxRetries + 1` (configured per webhook config)
- Retry queue processed by `processRetryQueue(batchSize=50)` — scheduled job picks up `RETRYING` records where `nextRetryAt <= now`
- Failed deliveries are retried in parallel via `Promise.allSettled`
- Manual retry available via `retryWebhook()` — resets maxAttempts if needed
- HTTP timeout: 30 seconds per attempt

### C5. Webhook Signature Verification

**Yes, fully implemented.** HMAC-SHA256 signature generation:
```typescript
signaturePayload = `${timestamp}.${payloadJSON}`
signature = HMAC-SHA256(signaturePayload, config.secret)
```

Headers sent with each delivery:
- `X-Webhook-Signature` — the HMAC-SHA256 hex digest
- `X-Webhook-Timestamp` — Unix timestamp
- `X-Webhook-Event` — event type
- `X-Webhook-Delivery-Id` — unique delivery ID

**Timing-safe comparison** (`crypto.timingSafeEqual`) is exported for consumer-side verification.

---

## Set D: File Upload Full Flow (~20 pts)

### D1. Complete Upload Flow

```
1. FileUploader component (react-dropzone) → multipart/form-data
2. POST /api/documents/upload
   a. Auth check (session + INVOICE_CREATE permission)
   b. Azure Storage config check
   c. Parse FormData (files[], cityCode, autoExtract, processingVersion)
   d. Validate each file (type + size)
   e. Convert to Buffer → uploadFile() to Azure Blob Storage
   f. Create Document record in PostgreSQL
   g. Collect documentsToProcess array
3. Fire-and-forget processing:
   a. ENABLE_UNIFIED_PROCESSOR=true → download blob → UnifiedDocumentProcessor → persistResult → autoTemplateMatch
   b. ENABLE_UNIFIED_PROCESSOR=false → legacy extractDocument()
4. Return 201 with uploaded/failed arrays
```

### D2. Accepted File Types and Size Limit

| Constraint | Value |
|---|---|
| MIME types | `application/pdf`, `image/jpeg`, `image/png` |
| Extensions | `.pdf`, `.jpg`, `.jpeg`, `.png` |
| Max file size | 10 MB (10 * 1024 * 1024 bytes) |
| Max files per batch | 20 |
| `dynamic` export | `'force-dynamic'` (disables Next.js body limit) |

### D3. Storage Flow

**Direct upload to Azure Blob Storage** — no temp file stage.

1. File buffer converted from `File.arrayBuffer()`
2. Blob name generated: `{cityCode}/{timestamp}-{sanitizedFileName}`
3. Uploaded via `@azure/storage-blob` SDK's `blockBlobClient.upload()`
4. Container auto-created on first upload (`createIfNotExists`)
5. Dev environment uses **Azurite** emulator (port 10010)

### D4. Virus Scanning

**No virus scanning.** No antivirus, ClamAV, or malware detection is implemented anywhere in the upload pipeline. Files go directly from HTTP request to Azure Blob.

### D5. File Serving

**Proxy pattern** via `GET /api/documents/[id]/blob`:
1. Auth check
2. Look up `blobName` from Document record
3. Download blob buffer from Azure Blob Storage
4. Stream back with correct `Content-Type` and `Content-Disposition: inline`

Additionally, `generateSasUrl()` in `src/lib/azure/storage.ts` can produce time-limited SAS URLs (default 60 min, read-only) for direct Azure Blob access, but the primary serving path is the proxy endpoint (to avoid CORS issues).

---

## Set E: Batch Processing Deep Verification (~20 pts)

### E1. Batch Orchestration (src/services/batch-processor.service.ts)

The `processBatch(batchId, options)` function:
1. Loads batch config (company ID, term aggregation, issuer ID, format ID settings)
2. Fetches all PENDING files for the batch
3. Chunks files into groups of `chunkSize` (default 5)
4. Creates a `PQueue` instance with concurrency and rate-limiting
5. Processes each chunk's files through the queue
6. Between chunks: delays for GC (default 2000ms)
7. After all files: triggers term aggregation if enabled
8. Returns `BatchProcessingResult` with full statistics

Two processing paths:
- `USE_UNIFIED_PROCESSOR = true` (default): 11-step UnifiedDocumentProcessor pipeline
- Legacy: Azure DI or GPT Vision based on file type detection

### E2. Concurrency Limit

| Parameter | Default | Source |
|---|---|---|
| `concurrency` | **5** | `DEFAULT_CONCURRENCY` |
| `intervalCap` | **10** | requests per interval (rate limit) |
| `intervalMs` | **1000** | rate limit window (1 second) |
| `enableParallelProcessing` | `true` | can be disabled for serial processing |
| `chunkSize` | **5** | files per chunk (for GC pauses) |
| `chunkDelayMs` | **2000** | delay between chunks |
| `maxRetries` | **2** | per-file retry count |
| `retryDelayMs` | **1000** | base retry delay |

Library: `p-queue-compat` (PQueue with concurrency + interval rate limiting)

### E3. Individual Document Failure Handling

Within a batch, each file is processed independently via `queue.add()`. If a file fails:
1. Retried up to `maxRetries` times (default 2) with delay
2. On final failure: `HistoricalFile` status set to `FAILED` with `errorMessage`
3. Batch `failedFiles` counter incremented atomically (`{ increment: 1 }`)
4. Processing continues for remaining files (errors don't halt the batch)
5. `Promise.allSettled` ensures all chunk promises resolve

### E4. Progress Tracking (src/services/batch-progress.service.ts)

Yes, comprehensive progress tracking:
- `getBatchProgress(batchId)` returns: percentage, processingRate (files/min), estimatedRemainingTime, filesByStatus breakdown
- 7 status types tracked: pending, detecting, detected, processing, completed, failed, skipped
- Processing rate calculated using a 60-second sliding window
- SSE endpoint at `/api/admin/historical-data/batches/[id]/progress` for real-time updates
- Batch summary includes: totalCost, newCompaniesCount, extractedTermsCount, durationMs

### E5. Pause/Resume/Cancel

**Yes, all three are supported** via dedicated API endpoints:

| Action | Endpoint | Constraint |
|---|---|---|
| Pause | `POST /api/admin/historical-data/batches/[batchId]/pause` | Only PROCESSING batches |
| Resume | `POST /api/admin/historical-data/batches/[batchId]/resume` | Only PAUSED batches |
| Cancel | `POST /api/admin/historical-data/batches/[batchId]/cancel` | PROCESSING or PAUSED batches |

Status enum includes: `PENDING`, `PROCESSING`, `PAUSED`, `AGGREGATING`, `AGGREGATED`, `COMPLETED`, `FAILED`, `CANCELLED`

**Note**: The `batch-processor.service.ts` itself does NOT contain `pause`/`resume`/`cancel` logic — it's handled at the API route level by changing batch status. The actual processing loop does not check for PAUSED status mid-execution (it's a fire-and-forget pattern at the service level; pause/resume is a UI-level state, not a mid-processing interrupt).

---

## Set F: Database Connection and Context (~20 pts)

### F1. Prisma Singleton (src/lib/prisma.ts)

**Verified pattern:**
```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- Development: singleton via `globalThis` (survives Next.js hot reload)
- Production: new instance per module load (process manages lifecycle)
- **Prisma 7.x driver adapter**: Uses `PrismaPg` adapter with `pg.Pool`
- Connection pool: `new Pool({ connectionString: process.env.DATABASE_URL })` — **no explicit pool size** configured. Defaults to `pg` library's default of `max: 10` connections.
- Logging: dev = `['query', 'error', 'warn']`, prod = `['error']`

### F2. City-Based RLS (src/lib/db-context.ts)

RLS implementation via PostgreSQL session variables:
1. `setRlsContext()` — sets `app.is_global_admin` and `app.user_city_codes` via `set_config()`
2. `clearRlsContext()` — resets both to defaults
3. `withRlsContext(context, operation)` — wraps an operation with set/clear
4. `withServiceRole(operation)` — convenience for Global Admin bypass
5. `createContextualPrisma(context)` — Proxy-based client (dev/debug only)
6. `SERVICE_ROLE_CONTEXT` — static context with `isGlobalAdmin: true`

The `RlsContext` interface: `{ isGlobalAdmin: boolean, cityCodes: string[], userId?: string }`

### F3. SQL Injection Risk at Line 87

**Confirmed.** The exact code at lines 87-91:

```typescript
await prismaClient.$executeRawUnsafe(`
  SELECT
    set_config('app.is_global_admin', '${isGlobalAdmin}', true),
    set_config('app.user_city_codes', '${cityCodes}', true)
`)
```

Where `cityCodes = context.cityCodes.join(',')`.

**Risk analysis:**
- `isGlobalAdmin` is derived from a boolean (`'true'` or `'false'`) — safe
- `cityCodes` is a comma-joined string from `string[]` — **vulnerable** if city codes contain single quotes or SQL-significant characters
- **Practical risk level**: Medium. City codes are typically 3-letter codes (HKG, SIN, TPE) from controlled database records, so injection via legitimate use is unlikely, but a compromised session or API could pass malicious city code strings
- **The same pattern** appears in `clearRlsContext()` (line 106-110) but only uses literal strings — safe

**Remediation**: Should use parameterized `$executeRaw` with Prisma tagged template:
```typescript
await prismaClient.$executeRaw`
  SELECT set_config('app.user_city_codes', ${cityCodes}, true)
`
```

### F4. Raw SQL Queries Beyond db-context

**Yes, found in 7 files** using `$queryRaw` (parameterized, safe):

| File | Usage |
|---|---|
| `src/app/api/health/route.ts` | `SELECT 1` health check |
| `src/app/api/analytics/global/route.ts` | 3 aggregate analytics queries |
| `src/app/api/analytics/city-comparison/route.ts` | City comparison aggregate |
| `src/services/city-cost-report.service.ts` | Daily docs/API costs aggregation |
| `src/services/dashboard-statistics.service.ts` | Average processing time calculation |
| `src/services/health-check.service.ts` | `SELECT 1` health check |
| `src/services/reference-number.service.ts` | Text similarity search |
| `src/services/monthly-cost-report.service.ts` | Monthly stats/trend queries |

All use `$queryRaw` (tagged template = parameterized) — **not** `$queryRawUnsafe`. Only `db-context.ts` uses `$executeRawUnsafe` (2 calls).

### F5. Connection Health Monitoring

**Yes, implemented in two places:**
1. `GET /api/health/route.ts` — runs `SELECT 1` against the database
2. `src/services/health-check.service.ts` (line 461) — also runs `SELECT 1`

Both are simple connectivity checks. There is **no** connection pool monitoring, no pool size metrics, no connection leak detection, and no automatic reconnection logic beyond what `pg.Pool` provides natively.

---

## Summary Statistics

| Set | Points | Key Findings |
|---|---|---|
| A: React Query Cache | 25 | Defaults: 1m stale/5m gc/2 retry/no refetch-on-focus. ~40 hooks use key factories, ~15 use ad-hoc strings. No `initialData` usage. `placeholderData` in 5 hooks. |
| B: Email & Notifications | 20 | 3 email types (verification, reset, changed) with inline HTML templates. Notifications DB-only (no WebSocket/email push). No email queue. |
| C: Webhooks | 20 | 4 event types. HMAC-SHA256 signed. Exponential retry (1/5/30 min). Full delivery tracking in Prisma. Timing-safe comparison exported. |
| D: File Upload | 20 | PDF/JPG/PNG, 10MB limit, 20 files/batch. Direct Azure Blob upload. Proxy serving via /blob endpoint. No virus scanning. |
| E: Batch Processing | 20 | PQueue concurrency=5, rate=10/s. Per-file retry (2x). SSE progress. Pause/Resume/Cancel via API (status-based, not mid-processing interrupt). |
| F: Database | 20 | Prisma 7.x + PrismaPg adapter. globalThis singleton. pg.Pool default (max 10). SQL injection risk confirmed at db-context:87. 2 raw-unsafe + 8 parameterized-raw queries. |

**Total: 125 verification points covered.**

### Critical Findings

1. **SQL injection risk in db-context.ts:87** — `cityCodes` string interpolated into `$executeRawUnsafe`. Should be parameterized.
2. **No virus scanning** on uploaded files — files go directly to Azure Blob.
3. **No email queue** — emails are sent synchronously, could block request handling.
4. **Query key inconsistency** — ~15 hooks use ad-hoc string arrays vs ~40 using factory pattern. No centralized key registry.
5. **Batch pause/resume is status-only** — the processing loop doesn't check for PAUSED status mid-execution; it's an API-level state flag, not a true interrupt mechanism.
6. **Connection pool not configured** — pg.Pool defaults to max 10 connections with no explicit tuning.
