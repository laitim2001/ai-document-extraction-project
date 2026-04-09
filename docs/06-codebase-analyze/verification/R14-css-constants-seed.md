# R14: CSS/Constants/Seed/Middleware/Events Verification

**Date**: 2026-04-09
**Scope**: CSS Custom Properties, Tailwind Theme, Constants Usage, Database Seed Data, Middleware Chain, Event System & Jobs
**Verification Points**: 125

---

## Set A: CSS Custom Properties & Tailwind Theme (30 pts)

### A1. globals.css Custom Properties (Complete List)

**File**: `src/app/globals.css` (109 lines)

#### :root (Light Mode) -- 26 properties + 9 confidence properties

| Property | Value | Category |
|----------|-------|----------|
| `--background` | `0 0% 100%` | Core |
| `--foreground` | `222.2 84% 4.9%` | Core |
| `--card` | `0 0% 100%` | Surface |
| `--card-foreground` | `222.2 84% 4.9%` | Surface |
| `--popover` | `0 0% 100%` | Surface |
| `--popover-foreground` | `222.2 84% 4.9%` | Surface |
| `--primary` | `222.2 47.4% 11.2%` | Brand |
| `--primary-foreground` | `210 40% 98%` | Brand |
| `--secondary` | `210 40% 96.1%` | Brand |
| `--secondary-foreground` | `222.2 47.4% 11.2%` | Brand |
| `--muted` | `210 40% 96.1%` | UI |
| `--muted-foreground` | `215.4 16.3% 46.9%` | UI |
| `--accent` | `210 40% 96.1%` | UI |
| `--accent-foreground` | `222.2 47.4% 11.2%` | UI |
| `--destructive` | `0 84.2% 60.2%` | Semantic |
| `--destructive-foreground` | `210 40% 98%` | Semantic |
| `--border` | `214.3 31.8% 91.4%` | UI |
| `--input` | `214.3 31.8% 91.4%` | UI |
| `--ring` | `222.2 84% 4.9%` | UI |
| `--radius` | `0.5rem` | Layout |
| `--chart-1` through `--chart-5` | various | Charts |
| `--confidence-high` | `142 76% 36%` | Confidence |
| `--confidence-high-bg` | `142 76% 95%` | Confidence |
| `--confidence-high-text` | `142 76% 25%` | Confidence |
| `--confidence-medium` | `45 93% 47%` | Confidence |
| `--confidence-medium-bg` | `45 93% 95%` | Confidence |
| `--confidence-medium-text` | `45 93% 30%` | Confidence |
| `--confidence-low` | `0 84% 60%` | Confidence |
| `--confidence-low-bg` | `0 84% 95%` | Confidence |
| `--confidence-low-text` | `0 84% 35%` | Confidence |

**Total :root properties**: 35

### A2. HSL Variable Theming Verification

**VERIFIED**: All CSS custom properties use HSL format without the `hsl()` wrapper (e.g., `222.2 84% 4.9%`). The `hsl()` wrapper is applied at the Tailwind config level: `'hsl(var(--background))'`. This is the standard shadcn/ui HSL variable theming pattern.

### A3. Tailwind Config Color Definitions

**File**: `tailwind.config.ts` (85 lines)

All standard colors reference CSS variables correctly:

| Tailwind Color | CSS Variable Reference | Status |
|----------------|----------------------|--------|
| `background` | `hsl(var(--background))` | CORRECT |
| `foreground` | `hsl(var(--foreground))` | CORRECT |
| `card.DEFAULT` | `hsl(var(--card))` | CORRECT |
| `card.foreground` | `hsl(var(--card-foreground))` | CORRECT |
| `popover.DEFAULT` | `hsl(var(--popover))` | CORRECT |
| `popover.foreground` | `hsl(var(--popover-foreground))` | CORRECT |
| `primary.DEFAULT` | `hsl(var(--primary))` | CORRECT |
| `primary.foreground` | `hsl(var(--primary-foreground))` | CORRECT |
| `secondary.DEFAULT` | `hsl(var(--secondary))` | CORRECT |
| `secondary.foreground` | `hsl(var(--secondary-foreground))` | CORRECT |
| `muted.DEFAULT` | `hsl(var(--muted))` | CORRECT |
| `muted.foreground` | `hsl(var(--muted-foreground))` | CORRECT |
| `accent.DEFAULT` | `hsl(var(--accent))` | CORRECT |
| `accent.foreground` | `hsl(var(--accent-foreground))` | CORRECT |
| `destructive.DEFAULT` | `hsl(var(--destructive))` | CORRECT |
| `destructive.foreground` | `hsl(var(--destructive-foreground))` | CORRECT |
| `border` | `hsl(var(--border))` | CORRECT |
| `input` | `hsl(var(--input))` | CORRECT |
| `ring` | `hsl(var(--ring))` | CORRECT |
| `chart.1-5` | `hsl(var(--chart-N))` | CORRECT |

### A4. Custom Theme Extensions Count

| Extension Type | Count | Items |
|---------------|-------|-------|
| **Colors** | 12 groups (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border/input/ring, chart, confidence) | 24 color tokens |
| **borderRadius** | 3 | lg, md, sm (all use `--radius` variable) |
| **Keyframes** | 2 | accordion-down, accordion-up |
| **Animation** | 2 | accordion-down, accordion-up |
| **Plugins** | 1 | tailwindcss-animate |

### A5. Dark Mode Variables

**VERIFIED**: `.dark` class exists in globals.css (lines 49-84) with 23 overrides:
- All core colors overridden (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring)
- All 5 chart colors overridden with different dark-mode hues
- Confidence `-bg` and `-text` variants overridden (6 properties) -- but NOT the base `--confidence-high`, `--confidence-medium`, `--confidence-low` (these remain the same in dark mode)

**FINDING**: Dark mode overrides do NOT include the base confidence colors (`--confidence-high`, `--confidence-medium`, `--confidence-low`), only the `-bg` and `-text` sub-variants. This means the primary confidence badge colors remain unchanged in dark mode.

### A6. Hardcoded Hex Colors in .tsx Components

**FINDING**: 48 instances of hardcoded hex colors found across 12 component files:

| File | Hex Colors | Context |
|------|-----------|---------|
| `CityDetailPanel.tsx` | `#3b82f6`, `#10b981` | Recharts stroke |
| `ForwarderComparisonChart.tsx` | `#3b82f6`, `#22c55e`, `#eab308`, `#8b5cf6`, `#06b6d4` | Chart colors object |
| `AiCostReportContent.tsx` | `#0078d4`, `#10a37f`, `#00bcf2`, `#8884d8` | Provider brand colors + chart |
| `CityComparison.tsx` | `#8884d8`, `#82ca9d`, `#ffc658`, `#ff7300`, `#00C49F`, `#0088FE` | Chart palette |
| `PerformanceDashboard.tsx` | `#f0f0f0`, `#9ca3af`, `#f59e0b`, `#ef4444`, `#3b82f6`, `#10b981`, `#8b5cf6` | Chart UI |
| `RegionView.tsx` | `#8884d8` | Bar chart fill |
| `GlobalTrend.tsx` | `#8884d8`, `#82ca9d`, `#ffc658` | Line chart strokes |
| `SwaggerUIWrapper.tsx` | `#10b981`, `#3b82f6`, `#f59e0b`, `#ef4444` | HTTP method badges |
| `CodeBlock.tsx` | `#6b7280` | Copy icon color |
| `SourceTypeStats.tsx` | `#94a3b8` | Fallback chart color |
| `AiCostCard.tsx` | `#0078d4`, `#10a37f`, `#00bcf2` | Provider brand colors |
| `login/page.tsx` | `#f25022`, `#7fba00`, `#00a4ef`, `#ffb900` | Microsoft logo colors |

**Assessment**: Most hardcoded colors are in chart/visualization components (Recharts) which do not support CSS variable references. The Microsoft logo colors are brand-mandated. This is an acceptable pattern for data visualization but could be improved by centralizing chart color palettes into a shared constant.

### A7. Confidence Color Tokens

**VERIFIED**: All confidence tokens exist:

| Token | globals.css :root | globals.css .dark | tailwind.config.ts | Component Usage |
|-------|:--:|:--:|:--:|:--:|
| `--confidence-high` | `142 76% 36%` | (inherited) | `hsl(142, 76%, 36%)` | badge.tsx, FieldRow.tsx, ConfidenceBadge.tsx |
| `--confidence-high-bg` | `142 76% 95%` | `142 76% 15%` | -- | FieldRow.tsx |
| `--confidence-high-text` | `142 76% 25%` | `142 76% 75%` | -- | -- |
| `--confidence-medium` | `45 93% 47%` | (inherited) | `hsl(45, 93%, 47%)` | badge.tsx, FieldRow.tsx, ConfidenceBadge.tsx |
| `--confidence-medium-bg` | `45 93% 95%` | `45 93% 15%` | -- | FieldRow.tsx |
| `--confidence-medium-text` | `45 93% 30%` | `45 93% 75%` | -- | -- |
| `--confidence-low` | `0 84% 60%` | (inherited) | `hsl(0, 84%, 60%)` | badge.tsx, FieldRow.tsx, ConfidenceBadge.tsx |
| `--confidence-low-bg` | `0 84% 95%` | `0 84% 15%` | -- | FieldRow.tsx |
| `--confidence-low-text` | `0 84% 35%` | `0 84% 75%` | -- | -- |

**FINDING (Inconsistency)**: The `tailwind.config.ts` confidence colors use HARDCODED HSL values (`hsl(142, 76%, 36%)`) instead of referencing CSS variables (`hsl(var(--confidence-high))`). This means Tailwind utility classes like `text-confidence-high` will NOT respond to dark mode changes, while components using the CSS variables directly (via `hsl(var(--confidence-high))`) will. This is a minor theme consistency issue.

Additionally, a custom CSS animation `confidence-pulse` exists in globals.css for low-confidence attention states, used via `.confidence-low-attention` class in `FieldRow.tsx`.

---

## Set B: Constants Usage Tracing (30 pts)

### B1. Constants File Inventory

| # | File | Exports | Lines |
|---|------|---------|-------|
| 1 | `processing-steps.ts` | 8 exports (1 array, 1 object flags, 2 records, 1 array order, 4 functions) | 315 |
| 2 | `processing-steps-v3.ts` | 14 exports (5 records, 1 array, 1 config array, 1 mapping, 7 functions) | 347 |
| 3 | `prompt-config-list.ts` | 2 exports (PROMPT_CONFIG_LIST, PROMPT_TYPE_ORDER) | 39 |
| 4 | `stage-prompt-templates.ts` | 8 exports (3 types, 2 interfaces, STAGE_TEMPLATES record, STAGE_PROMPT_TYPES, + 3 functions) | 400 |
| 5 | `standard-fields.ts` | 9 exports (3 types, 1 interface, FIELD_CATEGORIES, STANDARD_FIELDS, + 6 functions) | 578 |

### B2. Import Usage Verification

| Constant File | Importers | Status |
|--------------|-----------|--------|
| `processing-steps.ts` | `unified-document-processor.service.ts`, `step-factory.ts` | ACTIVE (2 files) |
| `processing-steps-v3.ts` | `extraction-v3/index.ts`, `extraction-v3.service.ts` | ACTIVE (2 files) |
| `prompt-config-list.ts` | `PromptConfigList.tsx` | ACTIVE (1 file) |
| `stage-prompt-templates.ts` | `TemplatePreviewDialog.tsx`, `PromptTemplateInserter.tsx`, `PromptEditor.tsx` | ACTIVE (3 files) |
| `standard-fields.ts` | `SourceFieldSelector.tsx`, `FormulaEditor.tsx` | ACTIVE (2 files) |

**All 5 constant files are actively imported and used. No orphaned constants found.**

### B3. PROCESSING_STEPS_V3 vs extraction-v3 Enum Match

**Source of truth**: `src/types/extraction-v3.types.ts` lines 49-64

| ProcessingStepV3 Enum Value | In constants/processing-steps-v3.ts | Match |
|-----------------------------|:---:|:---:|
| `FILE_PREPARATION` | CORRECT | Yes |
| `DYNAMIC_PROMPT_ASSEMBLY` | CORRECT | Yes |
| `UNIFIED_GPT_EXTRACTION` | CORRECT | Yes |
| `RESULT_VALIDATION` | CORRECT | Yes |
| `TERM_RECORDING` | CORRECT | Yes |
| `CONFIDENCE_CALCULATION` | CORRECT | Yes |
| `ROUTING_DECISION` | CORRECT | Yes |

**VERIFIED**: All 7 V3 step names in `processing-steps-v3.ts` exactly match the `ProcessingStepV3` enum in `extraction-v3.types.ts`. The constants file imports from the types file, ensuring compile-time consistency.

Note: There is also a `ProcessingStepV3_1` enum (line 983) with an expanded 8-step pipeline (FILE_PREPARATION, STAGE_1_COMPANY_IDENTIFICATION, STAGE_2_FORMAT_IDENTIFICATION, STAGE_3_FIELD_EXTRACTION, TERM_RECORDING, CONFIDENCE_CALCULATION, ROUTING_DECISION). No separate constants file exists for this newer V3.1 variant.

### B4. STANDARD_FIELDS Field Count and Categories

| Category | Field Count | Fields |
|----------|:-----------:|--------|
| basic | 5 | invoice_number, invoice_date, due_date, po_number, reference_number |
| vendor | 5 | vendor_name, vendor_code, vendor_address, vendor_tax_id, vendor_contact |
| logistics | 10 | shipment_no, tracking_number, bl_number, container_number, origin, destination, ship_date, delivery_date, eta, etd |
| shipment | 6 | weight, volume, quantity, package_type, commodity, hs_code |
| charges | 12 | sea_freight, air_freight, terminal_handling, documentation_fee, customs_fee, insurance, storage_fee, handling_fee, pickup_fee, delivery_fee, fuel_surcharge, security_fee, other_charges |
| amount | 7 | subtotal, tax_amount, tax_rate, total_amount, currency, exchange_rate, discount |
| customs | 4 | customs_declaration_no, customs_value, duty_amount, vat_amount |
| other | 3 | notes, payment_terms, incoterms |

**Total**: 52 standard fields across 8 categories. 17 marked as `isCommon: true`.

All fields use `labelKey` pointing to `standardFields.fields.*` i18n namespace, which is correct.

### B5. stage-prompt-templates vs prompt-assembly.service.ts

**FINDING**: The `stage-prompt-templates.ts` constants are **NOT imported by `prompt-assembly.service.ts`**. Grep for `stage-prompt-templates` and `STAGE_TEMPLATES` in `src/services/extraction-v3/` returned no matches.

The templates in `stage-prompt-templates.ts` are used exclusively by UI components (PromptEditor, PromptTemplateInserter, TemplatePreviewDialog) for the Prompt Config management page. The actual prompt assembly service (`prompt-assembly.service.ts`) builds prompts dynamically from the database `PromptConfig` model records, not from these hardcoded constants.

**Assessment**: This is correct by design -- the constants serve as default templates for the UI's "Insert Template" feature, while the runtime pipeline uses database-stored prompts. No inconsistency.

---

## Set C: Database Seed Data Verification (25 pts)

### C1. Seed File Overview

**File**: `prisma/seed.ts` (1250+ lines)
**Seed data modules** (imported from `prisma/seed-data/`):
- `forwarders.ts` -- Company/Forwarder data
- `mapping-rules.ts` -- Mapping rules
- `config-seeds.ts` -- System configs
- `prompt-configs.ts` -- Prompt configs
- `field-mapping-configs.ts` -- Field mapping configs
- `alert-rules.ts` -- Alert rules
- `exchange-rates.ts` -- Exchange rates

### C2. Seeded Model Counts vs R12 Claims

| Model | R12 Claim | Actual Count | Status |
|-------|:---------:|:------------:|:------:|
| **Roles** | 6 | 6 (System Admin, Super User, Data Processor, City Manager, Regional Manager, Auditor) | MATCH |
| **Regions** | 3 | **4** (GLOBAL, APAC, EMEA, AMER) | MISMATCH -- R12 missed GLOBAL region |
| **Cities** | 10 | 10 (TPE, HKG, SGP, TYO, SHA, SYD, LON, FRA, NYC, LAX) | MATCH |
| **Companies** | 15 | 15 (DHL, FDX, UPS, TNT, MAERSK, MSC, CMACGM, HLAG, EVRG, COSCO, ONE, YML, SF, KERRY, UNKNOWN) | MATCH |

**FINDING**: Regions seed count is **4** (not 3). The GLOBAL region was added in Story 20.1 but prior verification reports counted only the original 3 (APAC, EMEA, AMER).

### C3. Complete List of All Seeded Models

| # | Prisma Model | Seed Method | Count |
|---|-------------|-------------|-------|
| 1 | `Role` | upsert by name | 6 |
| 2 | `Region` | upsert by code | 4 |
| 3 | `City` | upsert by code | 10 |
| 4 | `User` | upsert by email/id | 3 (system, dev, admin) |
| 5 | `Company` | upsert by code | 15 |
| 6 | `MappingRule` | findFirst + create/update | ~50+ (universal + company-specific) |
| 7 | `SystemConfig` | findUnique by key + create/update | Variable (from CONFIG_SEED_DATA) |
| 8 | `DataTemplate` | findUnique by id + create/update | 3 (ERP, Expense, Logistics) |
| 9 | `TemplateFieldMapping` | findFirst + create/update | 1 (ERP global mapping with 12 rules) |
| 10 | `PromptConfig` | findFirst + create | Variable (from PROMPT_CONFIG_SEEDS) |
| 11 | `FieldMappingConfig` + `FieldMappingRule` | findFirst + create | Variable (from FIELD_MAPPING_CONFIG_SEEDS) |
| 12 | `AlertRule` | findFirst by name + create/update | Variable (from ALERT_RULE_SEEDS) |
| 13 | `ExchangeRate` | findFirst + create | Variable (from EXCHANGE_RATE_SEEDS) |

**Total seeded models**: 13 Prisma models

Additionally, the seed supports restoring exported data from `prisma/seed/exported-data.json` for:
- Additional Companies (beyond FORWARDER_SEED_DATA)
- DocumentFormats
- Additional PromptConfigs (with company/format scope)

### C4. Seed Data Values Validation

**Roles** (6):
| Role Name | Permission Count | System Role |
|-----------|:----------------:|:-----:|
| System Admin | All permissions | Yes |
| Super User | Rule + Company management | Yes |
| Data Processor | Basic invoice processing | Yes |
| City Manager | City-level management | Yes |
| Regional Manager | Multi-city management | Yes |
| Auditor | Read-only audit | Yes |

**Regions** (4):
| Code | Name | Timezone | Sort |
|------|------|----------|:----:|
| GLOBAL | Global | UTC | 0 |
| APAC | Asia Pacific | Asia/Hong_Kong | 1 |
| EMEA | Europe, Middle East & Africa | Europe/London | 2 |
| AMER | Americas | America/New_York | 3 |

**Cities** (10):
| Code | Name | Region | Currency | Locale |
|------|------|--------|----------|--------|
| TPE | Taipei | APAC | TWD | zh-TW |
| HKG | Hong Kong | APAC | HKD | zh-HK |
| SGP | Singapore | APAC | SGD | en-SG |
| TYO | Tokyo | APAC | JPY | ja-JP |
| SHA | Shanghai | APAC | CNY | zh-CN |
| SYD | Sydney | APAC | AUD | en-AU |
| LON | London | EMEA | GBP | en-GB |
| FRA | Frankfurt | EMEA | EUR | de-DE |
| NYC | New York | AMER | USD | en-US |
| LAX | Los Angeles | AMER | USD | en-US |

**All city codes, currencies, and timezones are valid IATA/ISO codes and IANA timezone identifiers.**

**Companies** (15):
| Code | Type | Priority |
|------|------|:--------:|
| DHL | Express | 100 |
| FDX | Express | 95 |
| UPS | Express | 90 |
| TNT | Express | 85 |
| MAERSK | Ocean | 80 |
| MSC | Ocean | 75 |
| CMACGM | Ocean | 70 |
| HLAG | Ocean | 65 |
| EVRG | Ocean | 60 |
| COSCO | Ocean | 55 |
| ONE | Ocean | 50 |
| YML | Ocean | 45 |
| SF | Regional | 40 |
| KERRY | Regional | 35 |
| UNKNOWN | Fallback | 0 |

**Data Templates** (3):
| ID | Name | Scope | Field Count |
|----|------|-------|:-----------:|
| erp-standard-import | ERP Standard Import | GLOBAL | 12 |
| expense-report-format | Expense Report Format | GLOBAL | 8 |
| logistics-tracking-format | Logistics Tracking Format | GLOBAL | 11 |

### C5. Seed Idempotency

**VERIFIED**: The seed script uses `upsert` for all main entities (Role, Region, City, User, Company). For MappingRule, SystemConfig, DataTemplate, TemplateFieldMapping, PromptConfig, FieldMappingConfig, AlertRule, and ExchangeRate, it uses `findFirst`/`findUnique` + conditional `create`/`update`, which is functionally idempotent.

All entity types check for existence before creating:
- Roles: `prisma.role.upsert({ where: { name } })`
- Regions: `prisma.region.upsert({ where: { code } })`
- Cities: `prisma.city.upsert({ where: { code } })`
- Users: `prisma.user.upsert({ where: { email } })` or `where: { id }`
- Companies: `prisma.company.upsert({ where: { code } })`
- Others: `findFirst` + conditional create/update

**Result**: Safe to run `npx prisma db seed` multiple times.

### C6. package.json Seed Configuration

**VERIFIED**: `package.json` contains:
```json
"scripts": {
  "db:seed": "prisma db seed"
}
```
And in the `prisma` section:
```json
"prisma": {
  "seed": "npx ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Both the npm script shortcut and the Prisma seed configuration are present and correct.

---

## Set D: Middleware Chain Execution Order (20 pts)

### D1. Main Middleware (src/middleware.ts) Execution Flow

**File**: `src/middleware.ts` (183 lines)

```
Request arrives
    |
    v
[1] Skip check: /api, /_next, static files (.xxx), /favicon
    |-- If matches → NextResponse.next() (bypass)
    |
    v
[2] Locale extraction from URL path
    |-- If no locale prefix → detect from cookie/Accept-Language → redirect to /{locale}/path
    |
    v
[3] next-intl middleware processing (intlMiddleware)
    |
    v
[4] Auth check via NextAuth `auth()`
    |-- If protected route (/dashboard/*, /documents/*) && not logged in → redirect to login
    |-- If auth route (/auth/*) && logged in → redirect to dashboard
    |-- If root path (/{locale}/) → redirect to dashboard or login based on auth
    |
    v
[5] Return intl response
```

**Matcher**: `['/((?!api|_next|.*\\..*).*)']` -- matches all paths except API, Next.js internals, and static files.

**Key behavior**: API routes (`/api/*`) are completely skipped by the main middleware. API-level auth/filtering is handled by the 4 API middlewares below.

### D2. Four API Middlewares

| # | Middleware | File | Purpose | Pattern |
|---|-----------|------|---------|---------|
| 1 | `withCityFilter` | `city-filter.ts` | City-based data access control | HOF wrapping handler |
| 2 | `withResourceAccess` | `resource-access.ts` | Per-resource city access validation | HOF wrapping handler |
| 3 | `withAuditLog` / `withAuditLogParams` | `audit-log.middleware.ts` | Auto-log API operations | HOF wrapping handler |
| 4 | `externalApiAuthMiddleware` | `external-api-auth.ts` | External API key auth | Function called within handler |

All are exported from `src/middlewares/index.ts`.

### D3. Middleware Usage Across API Routes

**withCityFilter** (most widely used):
- 28 API route files, 69 total occurrences
- Domains: dashboard/statistics, dashboard/ai-cost, cost/*, reports/*, workflow-executions/*, statistics/processing/*, audit/query/*

**externalApiAuthMiddleware**:
- 10 API route files (all under `/v1/`)
- Routes: v1/invoices/*, v1/webhooks/*
- Called as function inside handler: `await externalApiAuthMiddleware(request, ['query'])`

**withAuditLogParams**:
- 3 API route files
- Routes: documents/[id]/trace, documents/[id]/trace/report, documents/[id]/source

**withResourceAccess**:
- **0 API route files** (defined but NOT used by any route)
- **FINDING**: `withResourceAccess` is exported from `src/middlewares/resource-access.ts` and re-exported from `src/middlewares/index.ts`, but no API route actually invokes it. The `validateResourceAccess` function (the non-HOF version) may be used directly in some routes, but the HOF wrapper has zero adoption.

### D4. 5 Sample API Routes -- Middleware Trace

| Route | Middlewares Applied | Order |
|-------|-------------------|-------|
| `GET /api/dashboard/statistics` | `withCityFilter` | Auth → City context → handler |
| `POST /api/v1/invoices` | `externalApiAuthMiddleware` | API Key auth → handler |
| `GET /api/documents/[id]/trace` | `withAuditLogParams` | Auth → Audit log → handler |
| `GET /api/reports/regional/summary` | `withCityFilter` | Auth → City context → handler |
| `GET /api/workflow-executions` | `withCityFilter` | Auth → City context → handler |

**Pattern**: Middlewares are NOT chained (no middleware calls another middleware). Each API route selects ONE middleware wrapper. City-filter routes get auth via `withCityFilter`'s built-in `auth()` call.

### D5. Middleware Chain vs Documentation

The middleware chain follows a consistent pattern:
1. **Page-level middleware** (`src/middleware.ts`): i18n + auth for page routes
2. **API-level middlewares** (per-route HOF): Each API route chooses which middleware to wrap with

**Key architectural insight**: There is no global API middleware chain. Each API route independently chooses its auth/filtering strategy. This is typical for Next.js App Router where route handlers are individual functions.

---

## Set E: Event System + Job Scheduling (20 pts)

### E1. Document Processed Event Handler

**File**: `src/events/handlers/document-processed.handler.ts` (166 lines)

**Purpose**: Records processing statistics when a document finishes processing.

**Functions**:
- `handleDocumentProcessed(event)` -- Maps status to result type (AUTO_APPROVED, MANUAL_REVIEWED, FAILED, ESCALATED), records stats via `processingStatsService.recordProcessingResult()`
- `handleDocumentProcessedBatch(events)` -- Batch wrapper using `Promise.allSettled`
- `registerDocumentProcessedHandler()` -- Stub for event bus registration (commented out)

**Error handling**: Non-blocking -- catches errors and logs them, never re-throws. This prevents stats recording failures from blocking the main document processing flow.

### E2. Pattern Analysis Job

**File**: `src/jobs/pattern-analysis-job.ts` (141 lines)

**Trigger mechanism**: Manual trigger via function call or API endpoint (`POST /api/jobs/pattern-analysis`)

**CRON config** (reference only, not auto-scheduled):
```typescript
CRON_CONFIG = {
  schedule: '0 2 * * *',  // Daily at 2:00 AM
  timezone: 'Asia/Taipei',
}
```

**What it does**: Calls `patternAnalysisService.analyzeCorrections()` to detect correction patterns across processed documents. Returns metrics: totalAnalyzed, patternsDetected, patternsUpdated, candidatesCreated, executionTime.

### E3. Webhook Retry Job

**File**: `src/jobs/webhook-retry-job.ts` (221 lines)

**Retry logic**:
- Calls `webhookService.processRetryQueue(batchSize)` with default batch size of 50
- Queries `ExternalWebhookDelivery` records with `status: 'RETRYING'` and `nextRetryAt <= now`
- Status reporting: getPendingRetryCount(), getWebhookRetryStatus() (pending, retrying, failedToday, deliveredToday)

**CRON config** (reference only):
```typescript
WEBHOOK_RETRY_CRON_CONFIG = {
  schedule: '* * * * *',  // Every minute
  timezone: 'Asia/Taipei',
}
```

### E4. Event Emitter/Listener Patterns

**Search results**: Grep for `eventBus`, `EventEmitter`, `event-bus` found references in:
1. `system-config.service.ts` -- EventEmitter-like usage
2. `logger.service.ts` -- EventEmitter-like usage
3. `document-processed.handler.ts` -- Commented-out `eventBus.on()` reference

**FINDING**: There is NO dedicated event bus implementation (`src/lib/event-bus.ts` does not exist). The event handler code includes a commented-out registration pattern suggesting the event bus was planned but not implemented:
```typescript
// eventBus.on('document:processed', handleDocumentProcessed)
```

The `handleDocumentProcessed` function is exported but has **zero callers** outside its own file. This means the document processing statistics event handler is **defined but never invoked** by the main processing pipeline.

### E5. Job Scheduling Mechanism

**Jobs are NOT auto-scheduled within the application.** Both jobs provide:
1. A manual trigger function (exportable, callable from API routes)
2. A CRON configuration constant (for reference/documentation)
3. Instructions for external scheduling via Vercel Cron or n8n

**External scheduling approach**:
- Vercel Cron: Configure in `vercel.json` to hit the API endpoint
- n8n: Set up HTTP webhook to POST to the API endpoint
- Manual: Direct API call

No `setInterval`, `node-cron`, or internal scheduler was found in the codebase.

### E6. Summary vs Documentation Claims

| Claim | Actual | Status |
|-------|--------|:------:|
| `document-processed.handler.ts` records processing stats | Correct code exists, but never called | PARTIALLY TRUE |
| `pattern-analysis-job.ts` runs daily at 2 AM | CRON config exists, but requires external scheduler | PARTIALLY TRUE |
| `webhook-retry-job.ts` retries failed webhooks | Correct implementation with batch processing | TRUE |
| Event bus pattern exists | Commented out, no implementation | FALSE |

---

## Summary of Findings

### Verified Correct (No Issues)

| Area | Finding |
|------|---------|
| HSL theming | Standard shadcn/ui pattern, all colors use CSS variables via `hsl(var(--X))` |
| Dark mode | Complete `.dark` class with 23 overrides |
| Constants usage | All 5 constant files actively imported, no orphans |
| V3 step names | 7 steps match `ProcessingStepV3` enum exactly |
| Seed idempotency | All entities use upsert/findFirst pattern |
| Seed roles | 6 roles with correct names and permissions |
| Seed cities | 10 cities with valid IATA codes, currencies, timezones |
| Seed companies | 15 companies covering Express, Ocean, Regional, Unknown |
| package.json seed config | Both script and prisma.seed configured |
| Main middleware | Correct i18n + auth flow for page routes |
| withCityFilter | 28 API routes, most widely used middleware |
| Webhook retry job | Complete implementation with batch processing |

### Discrepancies Found

| # | Severity | Area | Finding |
|---|:--------:|------|---------|
| 1 | LOW | CSS | Tailwind `confidence` colors use hardcoded HSL values instead of CSS variable references -- dark mode won't affect Tailwind utility classes for confidence |
| 2 | LOW | CSS | 48 hardcoded hex colors in 12 chart/visualization components (acceptable for Recharts) |
| 3 | LOW | CSS | Dark mode does not override base confidence colors (`--confidence-high/medium/low`) |
| 4 | MEDIUM | Seed | Region count is 4 (including GLOBAL), not 3 as claimed in prior reports |
| 5 | MEDIUM | Middleware | `withResourceAccess` HOF is defined and exported but has zero API route usage |
| 6 | HIGH | Events | `handleDocumentProcessed` is defined but never called -- processing statistics are NOT being recorded |
| 7 | MEDIUM | Events | Event bus system is planned (commented-out `eventBus.on()`) but not implemented |
| 8 | LOW | Jobs | Pattern analysis and webhook retry jobs require external scheduling (not self-scheduling) |
| 9 | LOW | Templates | `stage-prompt-templates.ts` is UI-only, not used by the runtime prompt assembly service (by design) |

### Critical Finding: Dead Event Handler

The `handleDocumentProcessed` function in `src/events/handlers/document-processed.handler.ts` has **zero callers** in the entire codebase. The function records processing statistics (AUTO_APPROVED, MANUAL_REVIEWED, FAILED, ESCALATED) to `processingStatsService`, but the document processing pipeline never invokes it. This means **processing outcome statistics may not be accumulating** unless recorded through a different mechanism.

### Statistics

| Category | Points | Verified | Issues |
|----------|:------:|:--------:|:------:|
| Set A: CSS/Tailwind | 30 | 30 | 3 low |
| Set B: Constants | 30 | 30 | 0 |
| Set C: Seed Data | 25 | 25 | 1 medium |
| Set D: Middleware | 20 | 20 | 1 medium |
| Set E: Events/Jobs | 20 | 20 | 1 high, 1 medium, 1 low |
| **Total** | **125** | **125** | **9 findings** |
