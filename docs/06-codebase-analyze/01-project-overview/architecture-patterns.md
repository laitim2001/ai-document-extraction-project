# Architecture Patterns

> Generated: 2026-04-09
> Source: Verified from actual codebase files

---

## 1. App Router with Locale-Based Routing

**Pattern**: All user-facing pages are nested under `[locale]` dynamic segment with route groups.

```
src/app/[locale]/
  (auth)/auth/         # 6 auth pages (login, register, forgot-password, etc.)
  (dashboard)/         # 72 dashboard pages (admin, documents, review, etc.)
    admin/             # 41 admin pages
    documents/         # Document management pages
    review/            # Review workflow pages
    ...
```

**Key files**:
- `src/i18n/config.ts` -- Locale definitions (`en`, `zh-TW`, `zh-CN`)
- `src/i18n/routing.ts` -- `defineRouting()` with `localePrefix: 'always'`
- `src/middleware.ts` -- Locale detection and redirect

**Rule**: Components must use `Link`, `useRouter`, `usePathname` from `@/i18n/routing`, not from `next/link` or `next/navigation`.

---

## 2. Three-Tier Mapping System

**Pattern**: Hierarchical term resolution with cascading fallback.

| Tier | Name | Coverage | Maintenance |
|------|------|----------|-------------|
| Tier 1 | Universal Mapping | 70-80% common terms | Low (single source) |
| Tier 2 | Forwarder-Specific Override | Per-company exceptions | Medium (delta only) |
| Tier 3 | LLM Classification (GPT-5.2) | Unknown terms | Auto (AI-powered) |

**Resolution flow**: Tier 2 (company override) > Tier 1 (universal) > Tier 3 (LLM fallback).

**Key files**:
- `src/services/mapping/` -- Mapping service layer
- `python-services/mapping/` -- FastAPI mapping service (port 8001)

---

## 3. Three-Stage Extraction Pipeline (V3)

**Pattern**: Sequential orchestrated pipeline with per-stage GPT calls.

```
Stage 1: Company Identification
    → Identifies which company/forwarder the document belongs to
Stage 2: Format Detection
    → Determines document format and layout structure
Stage 3: Field Extraction
    → Extracts individual data fields based on company + format context
```

**Post-processing**: Reference number matching, exchange rate conversion, confidence scoring, routing decision.

**Key files** (`src/services/extraction-v3/`):
- `stages/stage-orchestrator.service.ts` -- Pipeline coordinator
- `stages/stage-1-company.service.ts` -- Company identification
- `stages/stage-2-format.service.ts` -- Format detection
- `stages/stage-3-extraction.service.ts` -- Field extraction
- `stages/gpt-caller.service.ts` -- Shared GPT API caller
- `stages/reference-number-matcher.service.ts` -- Post-processing
- `stages/exchange-rate-converter.service.ts` -- Post-processing
- `confidence-v3-1.service.ts` -- Six-dimension confidence scoring (5 active + 1 optional)
- `prompt-assembly.service.ts` -- Dynamic prompt construction
- `unified-gpt-extraction.service.ts` -- Unified entry point

**Utilities** (`src/services/extraction-v3/utils/`):
- `classify-normalizer.ts`, `pdf-converter.ts`, `prompt-builder.ts`, `prompt-merger.ts`, `variable-replacer.ts`

---

## 4. Confidence Routing Mechanism

**Pattern**: Six-dimension weighted scoring (5 active + 1 optional) that routes documents to appropriate review levels.

| Confidence Range | Route | Action |
|------------------|-------|--------|
| >= 90% | AUTO_APPROVE | Automatic approval, no human review |
| 70-89% | QUICK_REVIEW | One-click confirm/correct |
| < 70% | FULL_REVIEW | Detailed manual review |

**Six scoring dimensions** (weights verified from `confidence-v3-1.service.ts`):
- STAGE_1_COMPANY: 20%
- STAGE_2_FORMAT: 15%
- STAGE_3_EXTRACTION: 30%
- FIELD_COMPLETENESS: 20%
- CONFIG_SOURCE_BONUS: 15%
- REFERENCE_NUMBER_MATCH: optional (5%, borrowed from CONFIG_SOURCE_BONUS when enabled)

**Smart downgrade rules** (V3.1) -- two separate functions:
- `generateRoutingDecision`: New company -> Downgrade AUTO_APPROVE to QUICK_REVIEW
- `getSmartReviewType`: New company -> Force FULL_REVIEW; New company + new format -> Force FULL_REVIEW
- New format -> Force QUICK_REVIEW
- DEFAULT config source -> Downgrade one level

**CONFIG_SOURCE_BONUS**: COMPANY_SPECIFIC: 100, UNIVERSAL: 80, LLM_INFERRED: 50.

**Key file**: `src/services/extraction-v3/confidence-v3-1.service.ts`

---

## 5. Authentication Flow

**Pattern**: Dual auth strategy -- Azure AD SSO + local credential login.

| Method | Provider | Use Case |
|--------|----------|----------|
| Azure AD SSO | `next-auth` + `@azure/identity` | Corporate users (Entra ID) |
| Local credentials | `next-auth` + `bcryptjs` | Dev/admin accounts |

**Session management**: Database sessions via `@auth/prisma-adapter` (Prisma models: `User`, `Account`, `Session`, `VerificationToken`).

**Authorization**: Role-based with granular permissions (e.g., `USER_VIEW`, `RULE_MANAGE`, `INVOICE_CREATE`), plus city-level and region-level access control (`UserCityAccess`, `UserRegionAccess`).

**Key files**:
- `src/app/api/auth/` -- 7 route files
- Auth pages under `src/app/[locale]/(auth)/auth/` -- 6 pages

---

## 6. API Design -- RFC 7807 Error Format

**Pattern**: Standardized success/error response envelopes across all 331 API route files.

**Success response**:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }
  }
}
```

**Error response** (RFC 7807):
```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Field 'email' is required",
  "instance": "/api/v1/users",
  "errors": { "email": ["Required"] }
}
```

**HTTP method distribution** (verified, 448 total; includes `withCityFilter()` wrapper exports and 1 destructured NextAuth export):
- GET: 227 routes
- POST: 149 routes
- PATCH: 33 routes
- DELETE: 31 routes
- PUT: 8 routes

---

## 7. Service Layer Architecture

**Pattern**: Domain-organized service modules with index barrel exports.

**12 service subdirectories** under `src/services/`:

| Directory | Purpose |
|-----------|---------|
| `extraction-v3/` | Three-stage AI extraction pipeline (current) |
| `extraction-v2/` | Previous extraction version (retained) |
| `unified-processor/` | Document processing entry point |
| `document-processing/` | Core document lifecycle management |
| `identification/` | Company/forwarder identification |
| `mapping/` | Term mapping rules engine |
| `rule-inference/` | Rule suggestion and learning |
| `similarity/` | Text similarity scoring |
| `transform/` | Data transformation utilities |
| `prompt/` | Prompt template management |
| `n8n/` | n8n workflow integration |
| `logging/` | Structured logging service |

Plus 111 standalone service files at `src/services/` root level.

---

## 8. State Management Strategy

**Pattern**: Dual-store approach separating UI state from server state.

| Concern | Tool | Location |
|---------|------|----------|
| UI state (sidebar, dialogs, theme) | Zustand 5.x | `src/stores/` (2 files) |
| Server state (API data, cache) | React Query 5.x | `src/hooks/` (104 files) |
| Form state | React Hook Form 7.x | Per-component |
| URL state | Next.js App Router | `searchParams` |

---

## 9. Component Architecture

**Pattern**: Three-tier component organization.

| Tier | Directory | Count | Purpose |
|------|-----------|-------|---------|
| UI primitives | `src/components/ui/` | 34 | shadcn/ui + Radix primitives |
| Feature components | `src/components/features/` | 306 | Domain-specific business UI |
| Layout components | `src/components/layout/` | 5 | App shell, sidebar, topbar |

**Feature component domains** (38 subdirectories):
admin, audit, auth, companies, confidence, data-template, docs, document, document-preview, document-source, escalation, exchange-rate, field-definition-set, format-analysis, formats, forwarders, global, historical-data, history, locale, mapping-config, outlook, pipeline-config, prompt-config, reference-number, region, reports, retention, review, rule-review, rules, rule-version, sharepoint, suggestions, template-field-mapping, template-instance, template-match, term-analysis.

---

## 10. Internationalization Architecture

**Pattern**: Namespace-based message files with locale-aware routing.

```
messages/
  en/       (34 JSON files)
  zh-TW/    (34 JSON files)
  zh-CN/    (34 JSON files)
```

**34 namespaces**: common, navigation, dialogs, auth, validation, errors, dashboard, global, escalation, review, documents, rules, companies, reports, admin, confidence, historicalData, termAnalysis, documentPreview, fieldMappingConfig, promptConfig, dataTemplates, formats, templateFieldMapping, templateInstance, templateMatchingTest, standardFields, referenceNumber, exchangeRate, region, pipelineConfig, fieldDefinitionSet, profile, systemSettings.

**Formatting utilities**: `src/lib/i18n-date.ts`, `src/lib/i18n-number.ts`, `src/lib/i18n-currency.ts`, `src/lib/i18n-zod.ts`.

---

## 11. Document Processing Pipeline (Full Flow)

**Pattern**: Upload-to-result orchestrated pipeline.

```
1. Upload (src/app/api/documents/upload/route.ts)
   → UnifiedDocumentProcessor
2. OCR (Azure Document Intelligence via Python service, port 8000)
   → Raw text extraction
3. Stage Orchestrator (src/services/extraction-v3/stages/stage-orchestrator.service.ts)
   → Stage 1: Company ID → Stage 2: Format ID → Stage 3: Field Extraction
4. Post-processing
   → Reference number matching
   → Exchange rate conversion
   → Confidence calculation (6-dimension weighted score, 5 active + 1 optional)
5. Routing Decision
   → AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW
6. Persistence
   → ProcessingQueue + ExtractionResult + DocumentProcessingStage
```

---

## 12. API Route Organization

**Pattern**: Domain-grouped routes under `src/app/api/`.

| Domain | Route Files | Scope |
|--------|-------------|-------|
| `/admin/*` | 106 | System admin (alerts, backups, config, health, logs, users) |
| `/v1/*` | 77 | Versioned APIs (batches, formats, field mapping, prompts) |
| `/rules/*` | 20 | Mapping rule CRUD and management |
| `/documents/*` | 19 | Document lifecycle and processing |
| `/reports/*` | 12 | Report generation and download |
| `/companies/*` | 12 | Company management |
| `/auth/*` | 7 | Authentication endpoints |
| `/audit/*` | 7 | Audit trail and reports |
| `/workflows/*` | 5 | n8n workflow management |
| Others | 66 | Review, dashboard, cost, cities, analytics, etc. |
