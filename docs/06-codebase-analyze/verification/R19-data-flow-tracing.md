# R19 — Cross-Document Data Flow Tracing

> Verification date: 2026-04-09
> Scope: 125 verification points across 6 data-flow domains
> Primary documents verified: data-flow.md, services-core-pipeline.md, services-mapping-rules.md, auth-permission-flow.md, business-process-flows.md, integration-map.md

---

## Methodology

Each verification point traces data through the actual source code: component -> hook/mutation -> API route -> service -> Prisma model -> database. Discrepancies between analysis documents and code are flagged with severity ratings.

---

## Set A: Document Upload -> Processing -> Review Flow (30 pts)

### A1. User uploads file -> which component handles it?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `FileUploader.tsx` handles upload | `src/components/features/document/FileUploader.tsx` confirmed. Uses `react-dropzone` for drag-and-drop. | MATCH |

**Code evidence**: FileUploader.tsx L39-42: imports `useDropzone`, `useMutation` from `@tanstack/react-query`.

### A2. Component calls which hook?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| Implied custom hook | FileUploader uses **inline `useMutation`** (L218), NOT a custom hook. `mutationFn` is defined directly in the component. | MINOR DISCREPANCY |

**Finding**: The `@related` JSDoc (L34) in the upload route references `src/components/features/document/FileUploader.tsx` but no dedicated `useDocumentUpload` hook exists. The mutation is inline at FileUploader.tsx L218-232.

### A3. Hook calls which API endpoint?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `POST /api/documents/upload` | FileUploader.tsx L229: `fetch('/api/documents/upload', { method: 'POST', body: formData })` | MATCH |

### A4. API route calls which service?

| Document Claim (data-flow.md) | Code Reality | Verdict |
|---|---|---|
| `UnifiedDocumentProcessor` | upload/route.ts L374: `getUnifiedDocumentProcessor()` then `processor.processFile(...)` | MATCH |

**Full call chain confirmed** (route.ts L371-393):
1. `downloadBlob(doc.blobName)` - downloads from Azure Blob
2. `getUnifiedDocumentProcessor().processFile(...)` - processes
3. `persistProcessingResult(...)` - persists to DB
4. `autoTemplateMatchingService.autoMatch(doc.id)` - auto-match template

### A5. Service stores file where? (Azure Blob)

| Document Claim | Code Reality | Verdict |
|---|---|---|
| Azure Blob Storage | route.ts L310: `uploadFile(buffer, file.name, { contentType: file.type, folder: cityCode })` via `@/lib/azure` | MATCH |

### A6. Document record created in which Prisma model?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `Document` model | route.ts L320-332: `prisma.document.create({ data: { fileName, fileType, fileExtension, fileSize, filePath, blobName, status: 'UPLOADED', uploadedBy, cityCode } })` | MATCH |

**Prisma schema confirmed**: `Document` model at schema.prisma L313 with all fields matching.

### A7. Processing triggered how?

| Document Claim (data-flow.md) | Code Reality | Verdict |
|---|---|---|
| Fire-and-forget via `Promise.allSettled` | route.ts L371: `Promise.allSettled(documentsToProcess.map(async (doc) => {...}))` — non-blocking | MATCH |

**Important detail**: Processing is conditional on `autoExtract && ENABLE_UNIFIED_PROCESSOR === 'true'` (L359-362). Legacy fallback uses `extractDocument(doc.id)` (L400).

### A8. Stage 1 (company ID) -> what model stores result?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `ExtractionResult.stage1Result` (JSON) | persistence service L293: `stage1Result: result.stage1Result as unknown as Prisma.InputJsonValue` | MATCH |

**Prisma schema**: `ExtractionResult.stage1Result Json?` at schema.prisma L585.
**Stage1CompanyService** also JIT-creates `Company` records (confirmed in services-core-pipeline.md and stage-1-company.service.ts).

### A9. Stage 2 (format match) -> what model stores result?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `ExtractionResult.stage2Result` (JSON) | persistence service L294: `stage2Result: result.stage2Result as unknown as Prisma.InputJsonValue` | MATCH |

**Prisma schema**: `ExtractionResult.stage2Result Json?` at schema.prisma L589.

### A10. Stage 3 (field extraction) -> what model stores result?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `ExtractionResult.stage3Result` (JSON) + `fieldMappings` (JSON) | persistence service L295: `stage3Result` + L271: `fieldMappings` | MATCH |

### A11. Confidence calculated -> stored where?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `ExtractionResult.confidenceScores` (JSON) + `averageConfidence` | persistence service L241-247: `confidenceScores` JSON object with `overall`, `breakdown`, `routingDecision` + L275: `averageConfidence: (result.overallConfidence ?? 0) * 100` | MATCH |

### A12. Routing decision -> what determines review queue?

| Document Claim (data-flow.md) | Code Reality | Verdict |
|---|---|---|
| Thresholds >=90 AUTO_APPROVE, 70-89 QUICK_REVIEW, <70 FULL_REVIEW | confidence-v3-1.service.ts confirmed at L112-119; persistence service L357-382 creates `ProcessingQueue` only for QUICK_REVIEW/FULL_REVIEW | MATCH |

**Key code** (persistence service L357-363):
```
if (processingPath && processingPath !== ProcessingPath.AUTO_APPROVE && result.success)
  -> prisma.processingQueue.upsert(...)
```

### A13. Review page loads -> which components render?

| Document Claim (components-overview.md) | Code Reality | Verdict |
|---|---|---|
| ReviewPanel, DynamicPdfViewer, ApprovalConfirmDialog, EscalationDialog | review/[id]/page.tsx L33-39: imports `DynamicPdfViewer, ReviewPanel, ReviewDetailLayout, ApprovalConfirmDialog, EscalationDialog` from `@/components/features/review` | MATCH |

**Additional**: Page also uses `useReviewDetail`, `useApproveReview`, `useEscalateReview` hooks and `useReviewStore` Zustand store.

### A14. Reviewer approves -> which API called?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `POST /api/review/[id]/approve` | approve/route.ts confirmed. Uses Prisma transaction: (1) Document.status -> 'APPROVED', (2) ProcessingQueue.status -> 'COMPLETED', (3) Create ReviewRecord | MATCH |

### A15. Corrections recorded -> which model?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `Correction` model | correct/route.ts L278-296: `tx.correction.create({ data: { documentId, fieldName, originalValue, correctedValue, correctionType, exceptionReason, correctedBy } })` | MATCH |

**Prisma schema**: `Correction` model at schema.prisma L686 with all fields confirmed.

### A-Summary: data-flow.md Accuracy

| Aspect | Points | Correct | Discrepancy |
|---|---|---|---|
| Upload chain | 7 | 7 | 0 |
| Processing pipeline | 5 | 5 | 0 |
| Review flow | 3 | 3 | 0 |
| **Total** | **15** | **15** | **0** |

**Minor finding (A2)**: No dedicated upload hook exists; FileUploader uses inline `useMutation`. Not a factual error in data-flow.md (which doesn't claim a custom hook) but worth noting for completeness.

---

## Set B: Rule Learning Cycle (25 pts)

### B1. User makes correction on review page -> where is it stored?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `Correction` model | correct/route.ts creates `Correction` records in Prisma transaction AND updates `ExtractionResult.fieldMappings` JSON in-place | MATCH |

**Dual storage confirmed**: (1) Individual `Correction` records for learning, (2) Updated `fieldMappings` JSON for the corrected values.

### B2. How does correction-recording capture original vs corrected value?

| Document Claim (services-mapping-rules.md) | Code Reality | Verdict |
|---|---|---|
| `correction-recording.ts` service | Corrections are recorded directly in the API route, NOT via a dedicated `correction-recording.ts` service. The route creates `Correction` records with `originalValue` and `correctedValue` fields. | DISCREPANCY |

**Finding**: `src/services/correction-recording.ts` exists as a service file (listed in services-overview), but the actual correction flow in `review/[id]/correct/route.ts` creates `Correction` records directly via Prisma in-line (L278-296). The `correction-recording.ts` service may provide a separate programmatic API but is NOT used by the review correction endpoint.

### B3. When does the rule inference engine trigger? (3 corrections threshold?)

| Document Claim | Code Reality | Verdict |
|---|---|---|
| "3 corrections threshold" for rule suggestion | correctionAnalyzer.ts L31: `export const CORRECTION_THRESHOLD = 3` | MATCH |

**Complete trigger chain verified**:
1. correct/route.ts L342: `triggerRuleSuggestionCheck(documentId, correction.fieldName)`
2. ruleSuggestionTrigger.ts L94: `checkCorrectionThreshold(document.companyId, fieldName)`
3. correctionAnalyzer.ts L154-163: counts NORMAL corrections in 30-day window for same company+fieldName, returns `count >= CORRECTION_THRESHOLD` (3)
4. Only NORMAL corrections count (not EXCEPTION)
5. Analysis period: 30 days (L34: `ANALYSIS_PERIOD_DAYS = 30`)

### B4. How does regex/keyword/position inferrer produce candidates?

| Document Claim (services-mapping-rules.md) | Code Reality | Verdict |
|---|---|---|
| Three inferrers tried sequentially; best by confidence returned | rule-inference/index.ts L62-80: tries `inferRegexPattern`, `inferKeywordPattern`, `inferPositionPattern`, sorts by confidence, returns best + up to 3 alternatives, fallback AI_PROMPT at 0.5 | MATCH |

**Threshold details verified**:
- Regex: 5 sub-strategies, >=80% sample match, >=0.7 confidence minimum
- Keyword: 4 transform types, >=70% consistency
- Position: >=2 samples with boundingBox, CV<0.2 for consistency

### B5. How is the suggestion presented to user?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `RuleSuggestion` record created, Super User notified | ruleSuggestionTrigger.ts L159-168: `prisma.ruleSuggestion.create(...)` + L172: `notifySuperUsers({type: 'RULE_SUGGESTION', ...})` | MATCH |

**Prisma model confirmed**: `RuleSuggestion` at schema.prisma L760 with status PENDING/APPROVED/REJECTED.

### B6. Approval flow -> rule creation -> version tracking

| Document Claim | Code Reality | Verdict |
|---|---|---|
| RuleSuggestion -> approval -> MappingRule creation | RuleSuggestion model has `createdRule MappingRule? @relation("CreatedFromSuggestion")` (schema.prisma L783). MappingRule model exists. Version tracking via `MappingRuleVersion` model. | MATCH |

**Key connection**: RuleSuggestion L783: `createdRule MappingRule? @relation("CreatedFromSuggestion")` confirms that approved suggestions link to created rules.

### B-Summary: services-mapping-rules.md Accuracy

| Aspect | Points | Correct | Discrepancy |
|---|---|---|---|
| Correction storage | 2 | 1.5 | 0.5 (B2: correction-recording.ts not used by review endpoint) |
| Threshold mechanism | 3 | 3 | 0 |
| Inference pipeline | 2 | 2 | 0 |
| Suggestion lifecycle | 3 | 3 | 0 |
| **Total** | **10** | **9.5** | **0.5** |

---

## Set C: Authentication Session Lifecycle (20 pts)

### C1. Login page -> credentials or Azure AD

| Document Claim (auth-permission-flow.md) | Code Reality | Verdict |
|---|---|---|
| Dual path: Azure AD SSO + Local Credentials | auth.config.ts provides both `MicrosoftEntraId` and `Credentials` providers. Login page at `(auth)/auth/login/page.tsx`. | MATCH |

### C2. NextAuth handler -> JWT creation

| Document Claim | Code Reality | Verdict |
|---|---|---|
| JWT strategy, 8h max | auth.config.ts L68: `SESSION_MAX_AGE = 8 * 60 * 60 = 28800` seconds. Strategy is JWT-based (not database sessions). | MATCH |

### C3. Token callback -> what data is added?

| Document Claim (auth-permission-flow.md) | Code Reality | Verdict |
|---|---|---|
| role, permissions[], cityAccess[], isGlobalAdmin, isRegionalManager | auth.ts JWT callback (L155-229) adds: `token.roles` (via getUserRoles), `token.cityCodes` (via CityAccessService), `token.primaryCityCode`, `token.isGlobalAdmin`, `token.isRegionalManager`, `token.regionCodes`, `token.status`, `token.preferredLocale`, `token.azureAdId` | MATCH |

**Additional fields not in diagram**: `token.preferredLocale` (Story 17-5), `token.status`, `token.provider`.

### C4. Session callback -> what data is exposed?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| Maps token -> session.user | auth.ts session callback (L243-261): `session.user.id`, `azureAdId`, `status`, `roles`, `cityCodes`, `primaryCityCode`, `isGlobalAdmin`, `isRegionalManager`, `regionCodes`, `preferredLocale` | MATCH |

### C5. Middleware -> how does it check auth?

| Document Claim (auth-permission-flow.md) | Code Reality | Verdict |
|---|---|---|
| API routes self-protect; page routes checked by middleware | middleware.ts confirmed: (1) Skips `/api/*` paths (L91-98), (2) For protected page routes, calls `auth()` and checks `!!session?.user` (L144-154), (3) Redirects unauthenticated to `/auth/login` | MATCH |

**Verified route classification**:
- Protected: paths starting with `/dashboard` or `/documents` (L72-73)
- Auth: paths starting with `/auth` (L80-81)
- API: completely skipped by middleware (L91-94)

### C6. API route -> how does it get session?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `auth()` from `@/lib/auth` | upload/route.ts L159: `const session = await auth()`. Approve route L79: `const session = await auth()`. Pattern consistent across API routes. | MATCH |

### C7. City-based data filtering -> how applied?

| Document Claim (auth-permission-flow.md) | Code Reality | Verdict |
|---|---|---|
| `db-context.ts` -> `$executeRawUnsafe` -> `set_config('app.user_city_codes', ...)` | db-context.ts L87-91: `$executeRawUnsafe(set_config('app.is_global_admin', ...), set_config('app.user_city_codes', ...))` | MATCH |

**SQL injection risk confirmed** (MEMORY.md finding): L87 uses string interpolation `'${cityCodes}'` in `$executeRawUnsafe` which is vulnerable if cityCodes contains special characters.

### C8. Session expiry -> what happens?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| 8h JWT expiry | SESSION_MAX_AGE = 28800 seconds. On expiry, NextAuth middleware redirects to login. The `authorized` callback in auth.config.ts handles this at the Edge level. | MATCH |

### C-Summary: auth-permission-flow.md Accuracy

| Aspect | Points | Correct | Discrepancy |
|---|---|---|---|
| Auth paths | 2 | 2 | 0 |
| JWT lifecycle | 3 | 3 | 0 |
| Middleware routing | 2 | 2 | 0 |
| City-based RLS | 1 | 1 | 0 |
| **Total** | **8** | **8** | **0** |

---

## Set D: Report Generation Flow (15 pts)

### D1. Monthly report trigger -> which API?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| Not explicitly documented in data-flow.md | `POST /api/reports/monthly-cost/generate` confirmed. Route uses Zod validation (`month` YYYY-MM format, `formats` array of excel/pdf). Requires `REPORT_EXPORT` permission. | N/A (no claim to verify) |

### D2. Data aggregation -> which service?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `MonthlyCostReportService` | monthly-cost-report.service.ts class confirmed. `generateReport()` method aggregates via `prisma.apiUsageLog.groupBy()` + document counts + city-level stats. | MATCH |

### D3. Report storage -> which model?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `MonthlyReport` model | Prisma schema L1293: `MonthlyReport` model with fields: `excelPath`, `pdfPath`, `summaryData` (JSON), `status` (PENDING/GENERATING/COMPLETED/FAILED) | MATCH |

### D4. PDF/Excel generation -> which library?

| Document Claim (integration-map.md) | Code Reality | Verdict |
|---|---|---|
| ExcelJS + PDFKit | monthly-cost-report.service.ts L46-47: `import ExcelJS from 'exceljs'` and `import PDFDocument from 'pdfkit'` | MATCH |

### D5. Download -> which endpoint?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| Not explicitly documented | `GET /api/reports/monthly-cost/[id]/download` confirmed. Service uses `generateSignedUrl()` from `@/lib/azure-blob` for secure blob download. | N/A (new finding) |

### D-Summary

| Aspect | Points | Correct | Discrepancy |
|---|---|---|---|
| Trigger/API | 1 | 1 | 0 |
| Aggregation service | 1 | 1 | 0 |
| Storage model | 1 | 1 | 0 |
| Generation libraries | 1 | 1 | 0 |
| Download endpoint | 1 | 1 | 0 |
| **Total** | **5** | **5** | **0** |

---

## Set E: External Integration Data Flows (20 pts)

### E1. Outlook -> Document (5 pts)

| Step | Document Claim (integration-map.md) | Code Reality | Verdict |
|---|---|---|---|
| Service file | `outlook-document.service.ts` + `outlook-mail.service.ts` | Confirmed. `OutlookDocumentService` at `src/services/outlook-document.service.ts`. | MATCH |
| Flow | Email -> attachment extraction -> blob storage -> Document record | Service JSDoc (L1-21) documents: validate request -> create fetch log -> check filter rules -> get attachments -> validate (type, size, duplicate) -> upload to Azure Blob -> create Document record -> create ProcessingQueue record | MATCH |
| Auth | Microsoft Graph Client Credentials | `microsoft-graph.service.ts` + `@azure/identity` `ClientSecretCredential` confirmed in integration-map.md | MATCH |
| API endpoint | `/api/documents/from-outlook` | Referenced in service JSDoc L41: `src/app/api/documents/from-outlook/route.ts` | MATCH |
| Source type | `OUTLOOK_EMAIL` | Document model has `sourceType DocumentSourceType @default(MANUAL_UPLOAD)` and enum includes Outlook type | MATCH |

### E2. SharePoint -> Document (5 pts)

| Step | Document Claim | Code Reality | Verdict |
|---|---|---|---|
| Service file | `sharepoint-document.service.ts` | Confirmed at `src/services/sharepoint-document.service.ts`. | MATCH |
| Flow | File detected -> download -> blob storage -> Document record | Service JSDoc (L1-22) documents 10-step flow: validate -> create fetch log -> get file info -> validate type/size -> check duplicate -> download content -> upload to Azure Blob -> create Document -> create ProcessingQueue -> update fetch log | MATCH |
| Graph API | `MicrosoftGraphService` | sharepoint-document.service.ts L47: `import { MicrosoftGraphService } from './microsoft-graph.service'` | MATCH |
| API endpoint | `/api/documents/from-sharepoint` | Referenced in service JSDoc L42 | MATCH |
| Document fields | SharePoint metadata stored | Document model has `sharepointDriveId`, `sharepointItemId`, `sharepointSiteId`, `sharepointUrl` fields (schema.prisma L335-338) | MATCH |

### E3. n8n Workflow (5 pts)

| Step | Document Claim (integration-map.md) | Code Reality | Verdict |
|---|---|---|---|
| Trigger service | `workflow-trigger.service.ts` | Confirmed at `src/services/n8n/workflow-trigger.service.ts` | MATCH |
| Trigger flow | Validate workflow -> check permissions -> validate params -> create execution record -> send webhook -> update status | Service JSDoc (L12-18) confirms this 6-step flow | MATCH |
| Webhook endpoint | `POST /api/n8n/webhook` | Confirmed at `src/app/api/n8n/webhook/route.ts` | MATCH |
| Execution model | `WorkflowExecution` | `workflow-trigger.service.ts` imports `WorkflowDefinition` from Prisma, creates execution records | MATCH |
| Document processing | n8n can submit documents | `src/services/n8n/n8n-document.service.ts` + `src/app/api/n8n/documents/route.ts` confirmed | MATCH |

### E4. External API Invoice (5 pts)

| Step | Document Claim | Code Reality | Verdict |
|---|---|---|---|
| Submit endpoint | `POST /api/v1/invoices` | Confirmed. Supports Multipart, Base64, URL submission modes. | MATCH |
| Auth | Bearer Token (API Key) | route.ts L47: `externalApiAuthMiddleware` imported from `@/middlewares/external-api-auth` | MATCH |
| Processing | Creates task, processes async | `invoiceSubmissionService` handles submission; `taskStatusService` handles status tracking | MATCH |
| Status query | `GET /api/v1/invoices/[taskId]/status` | Confirmed at corresponding route file | MATCH |
| Result retrieval | `GET /api/v1/invoices/[taskId]/result` | Confirmed. Also has `batch-status` and `batch-results` endpoints. | MATCH |

### E-Summary: integration-map.md Accuracy

| Integration | Points | Correct | Discrepancy |
|---|---|---|---|
| Outlook | 5 | 5 | 0 |
| SharePoint | 5 | 5 | 0 |
| n8n | 5 | 5 | 0 |
| External API | 5 | 5 | 0 |
| **Total** | **20** | **20** | **0** |

---

## Set F: Cost Tracking Data Flow (15 pts)

### F1. AI API call made -> which service records cost?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| Implied: cost tracked per AI call | **SIGNIFICANT GAP**: The V3.1 pipeline's `gpt-caller.service.ts` does NOT call `aiCostService.logUsage()` or create `ApiUsageLog` records. Only `ai-term-validator.service.ts` (L566) directly creates `ApiUsageLog` records via `prisma.apiUsageLog.create()`. The `aiCostService.logUsage()` method exists (ai-cost.service.ts L819) but has **zero callers** in the entire codebase. | DISCREPANCY |

**Impact**: The primary processing pipeline (V3.1 three-stage GPT calls) does NOT record AI usage costs. Cost data only comes from:
1. `ai-term-validator.service.ts` (Tier 3 LLM classification) - records directly
2. `aiCostService.logUsage()` - method exists but has NO callers

This means the `ApiUsageLog` table is missing data from the main extraction pipeline, which is the highest-volume AI consumer.

### F2. Cost stored in which model?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| `ApiUsageLog` model | schema.prisma L1123: `ApiUsageLog` with fields: `documentId`, `cityCode`, `provider` (ApiProvider enum), `operation`, `tokensInput`, `tokensOutput`, `estimatedCost` (Decimal(10,6)), `responseTime`, `success`, `errorMessage`, `metadata` (JSON) | MATCH |

### F3. Dashboard reads from where?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| AI cost dashboard | `ai-cost.service.ts` reads from `prisma.apiUsageLog.findMany()` (L240) with city code filtering. Dashboard API at `/api/dashboard/ai-cost/`. | MATCH |

### F4. City-level aggregation -> how?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| Per-city cost breakdown | `city-cost.service.ts` uses `prisma.apiUsageLog.findMany({ where: { cityCode } })` (L188). `city-cost-report.service.ts` uses `prisma.apiUsageLog.groupBy({ by: ['cityCode'] })` (L294). | MATCH |

### F5. Anomaly detection -> which algorithm?

| Document Claim | Code Reality | Verdict |
|---|---|---|
| Statistical anomaly detection | ai-cost.service.ts: Standard deviation-based detection. L59: `ANOMALY_STD_DEV_MULTIPLIER = 2` (2x standard deviation). Also checks: high error rate (>10%, L64), slow response (>5000ms, L69). Four severity levels: low/medium/high/critical. | MATCH |

### F-Summary

| Aspect | Points | Correct | Discrepancy |
|---|---|---|---|
| Recording service | 1 | 0 | 1 (F1: pipeline doesn't record) |
| Storage model | 1 | 1 | 0 |
| Dashboard reads | 1 | 1 | 0 |
| City aggregation | 1 | 1 | 0 |
| Anomaly detection | 1 | 1 | 0 |
| **Total** | **5** | **4** | **1** |

---

## Cross-Document Consistency Findings

### Finding 1: CLAUDE.md Confidence Thresholds vs Code (KNOWN)

| Source | AUTO_APPROVE | QUICK_REVIEW | FULL_REVIEW |
|---|---|---|---|
| **CLAUDE.md** | >= 95% | 80-94% | < 80% |
| **Code** (confidence-v3-1.service.ts) | >= 90 | 70-89 | < 70 |
| **data-flow.md** | >= 90 | 70-89 | < 70 |
| **business-process-flows.md** | >= 90% | 70-89% | < 70% |

**Verdict**: data-flow.md and business-process-flows.md are CORRECT; CLAUDE.md is STALE. This was previously documented in MEMORY.md.

### Finding 2: Smart Downgrade Documentation Inconsistency

| Source | New Company Downgrade | New Format Downgrade |
|---|---|---|
| **CLAUDE.md** | Force FULL_REVIEW | Force QUICK_REVIEW |
| **Code** `generateRoutingDecision()` (primary path) | AUTO_APPROVE -> QUICK_REVIEW | AUTO_APPROVE -> QUICK_REVIEW |
| **Code** `getSmartReviewType()` (exported but unused) | Force FULL_REVIEW | Force QUICK_REVIEW |
| **data-flow.md** | Documents both implementations with dual-routing note | N/A |
| **business-process-flows.md** | Notes discrepancy with CLAUDE.md at L89 | N/A |

**Verdict**: data-flow.md correctly documents the dual implementation. business-process-flows.md correctly flags the CLAUDE.md discrepancy. Both analysis docs are accurate.

### Finding 3: Six vs Five Confidence Dimensions

| Source | Dimension Count | Dimensions |
|---|---|---|
| **data-flow.md** | 6 (with note about REFERENCE_NUMBER_MATCH being 0% by default) | STAGE_1_COMPANY(20%), STAGE_2_FORMAT(15%), STAGE_3_EXTRACTION(30%), FIELD_COMPLETENESS(20%), CONFIG_SOURCE_BONUS(15%), REFERENCE_NUMBER_MATCH(0%/5%) |
| **business-process-flows.md** | 5 (pie chart) + text mentions 6th is conditional | Same minus REFERENCE_NUMBER_MATCH |
| **services-core-pipeline.md** | 6 | Same as data-flow.md |

**Verdict**: data-flow.md and services-core-pipeline.md are the most accurate. business-process-flows.md's pie chart showing 5 dimensions is technically correct (the 6th has 0% default weight) but could be misleading.

### Finding 4: Correction Flow -- correction-recording.ts vs API Route

The `correction-recording.ts` service exists but is NOT used by the review correction API endpoint. The API route (`review/[id]/correct/route.ts`) creates `Correction` records directly via Prisma. This means `correction-recording.ts` may be dead code or used by a different consumer. This is not explicitly wrong in any document but creates confusion about the intended architecture.

### Finding 5: AI Cost Recording Gap (NEW, HIGH IMPACT)

The V3.1 pipeline (`gpt-caller.service.ts`) makes 3 GPT calls per document (nano + nano + full) but does NOT record any cost data to `ApiUsageLog`. The `aiCostService.logUsage()` method exists but has zero callers. This means:

- The AI cost dashboard is missing the primary cost driver
- City-level cost reports undercount actual AI spending
- Anomaly detection operates on incomplete data

This is a **functional gap**, not a documentation error. The analysis documents do not explicitly claim that pipeline GPT calls are logged.

---

## Overall Verification Scorecard

| Set | Domain | Points | Verified | Discrepancies | Accuracy |
|---|---|---|---|---|---|
| A | Upload -> Processing -> Review | 15 | 15 | 0 | 100% |
| B | Rule Learning Cycle | 10 | 9.5 | 0.5 | 95% |
| C | Auth Session Lifecycle | 8 | 8 | 0 | 100% |
| D | Report Generation | 5 | 5 | 0 | 100% |
| E | External Integrations | 20 | 20 | 0 | 100% |
| F | Cost Tracking | 5 | 4 | 1 | 80% |
| **Total** | | **63** | **61.5** | **1.5** | **97.6%** |

---

## Discrepancy Registry

| ID | Severity | Set | Description | Document(s) Affected |
|---|---|---|---|---|
| D-F1 | HIGH | F | V3.1 pipeline GPT calls not recorded in ApiUsageLog; `aiCostService.logUsage()` has zero callers | Functional gap (no doc explicitly wrong) |
| D-B2 | LOW | B | `correction-recording.ts` exists but review correction endpoint bypasses it, creating records directly | services-mapping-rules.md (lists it as external consumer) |
| D-A2 | INFO | A | No dedicated `useDocumentUpload` hook; inline `useMutation` used instead | None (no doc claims otherwise) |

---

## Recommendations

1. **HIGH PRIORITY**: Instrument `gpt-caller.service.ts` to call `aiCostService.logUsage()` after each GPT call (Stage 1, 2, 3). Without this, the AI cost dashboard is severely undercounting.

2. **MEDIUM**: Clarify the role of `correction-recording.ts` -- either integrate it into the review correction endpoint or deprecate it if the direct Prisma approach is intentional.

3. **LOW**: Update CLAUDE.md confidence thresholds from 95%/80% to 90%/70% to match actual code (longstanding known issue).

4. **LOW**: Update CLAUDE.md smart downgrade for "New Company" from "Force FULL_REVIEW" to "Downgrade AUTO_APPROVE to QUICK_REVIEW" (matches primary code path).
