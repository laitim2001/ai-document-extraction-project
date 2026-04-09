# Project Metrics - Verified Counts

> Generated: 2026-04-09
> Method: All counts verified via `find` + `wc -l` on actual filesystem

---

## Source Code Summary

| Metric | Count |
|--------|-------|
| Total TypeScript files in `src/` | 1,363 |
| Total lines of code in `src/` | 136,223 |
| Python files | 12 |
| Python lines of code | 2,719 |
| **Grand total LOC** | **~138,942** |

---

## Lines of Code by Directory

| Directory | Files | Lines of Code |
|-----------|-------|---------------|
| `src/services/` | 200 | 99,684 |
| `src/components/` | 371 | 98,252 |
| `src/app/api/` | 331 (route.ts) | 66,787 |
| `src/types/` | 93 | 38,749 |
| `src/hooks/` | 104 | 28,528 |
| `src/lib/` | 68 | 15,955 |
| `src/stores/` | 2 | 746 |

Note: `src/app/api/` LOC includes only `route.ts` files. Total `src/` LOC (136,223) also includes page files, layouts, and other non-categorized files. Per-directory LOC totals sum to more than 136,223 because some files are counted in multiple categories.

---

## File Counts by Category

### Services (`src/services/`)

| Metric | Count |
|--------|-------|
| Total service files (`.ts`) | 200 |
| Root-level service files | 111 |
| Files in subdirectories | 89 |
| Subdirectories | 12 |

**Service subdirectories**:

| Directory | Purpose |
|-----------|---------|
| `document-processing/` | Document lifecycle management |
| `extraction-v2/` | Legacy extraction pipeline |
| `extraction-v3/` | Current 3-stage extraction pipeline (20 files) |
| `identification/` | Company/forwarder identification |
| `logging/` | Structured logging |
| `mapping/` | Term mapping rules engine |
| `n8n/` | n8n workflow integration |
| `prompt/` | Prompt template management |
| `rule-inference/` | Rule suggestion and learning |
| `similarity/` | Text similarity scoring |
| `transform/` | Data transformation |
| `unified-processor/` | Processing entry point |

---

### Components (`src/components/`)

| Category | Files | Purpose |
|----------|-------|---------|
| `ui/` | 34 | shadcn/ui primitives (Radix-based) |
| `features/` | 306 | Business feature components |
| `layout/` | 5 | App shell, sidebar, topbar |
| Other | 26 | Shared/utility components |
| **Total (.tsx only)** | **371** | |

> Note: The 371 count includes only `.tsx` files. Including `.ts` files (barrel exports, utilities, types), the total is 429.

**Feature component domains** (38 subdirectories):

admin, audit, auth, companies, confidence, data-template, docs, document, document-preview, document-source, escalation, exchange-rate, field-definition-set, format-analysis, formats, forwarders, global, historical-data, history, locale, mapping-config, outlook, pipeline-config, prompt-config, reference-number, region, reports, retention, review, rule-review, rules, rule-version, sharepoint, suggestions, template-field-mapping, template-instance, template-match, term-analysis

---

### Hooks (`src/hooks/`)

| Metric | Count |
|--------|-------|
| Total hook files | 104 |
| Lines of code | 28,528 |

---

### API Routes (`src/app/api/`)

| Metric | Count |
|--------|-------|
| Route files (`route.ts`) | 331 |
| Total HTTP methods | 448 (includes `withCityFilter()` wrapper exports and 1 destructured NextAuth export) |

**HTTP Method Breakdown**:

| Method | Count | Percentage |
|--------|-------|------------|
| GET | 227 | 50.7% |
| POST | 149 | 33.3% |
| PATCH | 33 | 7.4% |
| DELETE | 31 | 6.9% |
| PUT | 8 | 1.8% |

**Routes by Top-Level Domain**:

| Domain | Route Files |
|--------|-------------|
| `/admin/*` | 106 |
| `/v1/*` | 77 |
| `/rules/*` | 20 |
| `/documents/*` | 19 |
| `/reports/*` | 12 |
| `/companies/*` | 12 |
| `/auth/*` | 7 |
| `/audit/*` | 7 |
| `/workflows/*` | 5 |
| `/review/*` | 5 |
| `/dashboard/*` | 5 |
| `/cost/*` | 5 |
| `/workflow-executions/*` | 4 |
| `/test-tasks/*` | 4 |
| `/statistics/*` | 4 |
| `/n8n/*` | 4 |
| `/docs/*` | 4 |
| `/routing/*` | 3 |
| `/escalations/*` | 3 |
| `/cities/*` | 3 |
| Others | remaining |

---

### Pages (`src/app/`)

| Category | Count |
|----------|-------|
| Total `page.tsx` files | 82 |
| Locale-based pages (`[locale]/`) | 81 |
| Auth pages (`(auth)/`) | 6 |
| Dashboard pages (`(dashboard)/`) | 72 |
| Admin pages (`(dashboard)/admin/`) | 41 |
| Root page (`src/app/page.tsx`) | 1 |
| Layout files (`layout.tsx` under `[locale]/`) | 3 |

---

### Types (`src/types/`)

| Metric | Count |
|--------|-------|
| Type definition files | 93 |
| Lines of code | 38,749 |

---

### Library/Utilities (`src/lib/`)

| Metric | Count |
|--------|-------|
| Total files | 68 |
| Lines of code | 15,955 |
| Zod validation files (`lib/validations/`) | 9 |

---

### Stores (`src/stores/`)

| Metric | Count |
|--------|-------|
| Store files | 2 |
| Lines of code | 746 |

---

## Database (Prisma)

| Metric | Count |
|--------|-------|
| Models | 122 |
| Enums | 113 |
| Schema lines | 4,354 |
| Migration directories | 10 |

**Models by domain** (from `prisma/CLAUDE.md`):

| Domain | Models |
|--------|--------|
| User & Auth | 8 |
| Region & City | 2 |
| Document Core | 7 |
| Company | 3 |
| Mapping & Rules | 12 |
| Review Workflow | 7 |
| Audit & Security | 5 |
| Reports & Statistics | 6 |
| AI Cost Tracking | 3 |
| System Config | 3 |
| Data Retention | 4 |
| SharePoint Integration | 3 |
| Outlook Integration | 3 |
| n8n Integration | 4 |
| Workflow | 5 |
| External API | 6 |
| Performance Monitoring | 11 |
| Alert System | 5 |
| Backup & Restore | 7 |
| System Log | 3 |
| Historical Batch | 4 |
| Prompt Config | 2 |
| Template Management | 4 |
| Reference Number & Exchange Rate | 2 |

---

## Internationalization (i18n)

| Metric | Count |
|--------|-------|
| Supported locales | 3 (`en`, `zh-TW`, `zh-CN`) |
| Namespaces per locale | 34 |
| Total JSON files | 102 (34 x 3) |
| i18n utility files (`src/lib/i18n-*.ts`) | 5 |
| i18n hooks (`src/hooks/use-locale-*.ts`, `use-localized-*.ts`) | 5 |

**Namespace list** (34):
common, navigation, dialogs, auth, validation, errors, dashboard, global, escalation, review, documents, rules, companies, reports, admin, confidence, historicalData, termAnalysis, documentPreview, fieldMappingConfig, promptConfig, dataTemplates, formats, templateFieldMapping, templateInstance, templateMatchingTest, standardFields, referenceNumber, exchangeRate, region, pipelineConfig, fieldDefinitionSet, profile, systemSettings

---

## Testing

| Metric | Count |
|--------|-------|
| Test files | 1 |
| `.gitkeep` placeholder files | 3 |
| Total files in `tests/` | 4 |
| Test framework | Playwright ^1.57.0 (E2E) |

Note: Test coverage is minimal. The `tests/` directory contains 1 actual test file (`tests/unit/services/batch-processor-parallel.test.ts`) and 3 `.gitkeep` placeholder files (`tests/e2e/`, `tests/integration/`, `tests/unit/`).

---

## Docker Services

| Service | Image | Exposed Port |
|---------|-------|-------------|
| PostgreSQL | postgres:15-alpine | 5433 |
| pgAdmin | dpage/pgadmin4:latest | 5050 |
| OCR Extraction | Custom FastAPI | 8000 |
| Forwarder Mapping | Custom FastAPI | 8001 |
| Azurite | mcr.microsoft.com/azure-storage/azurite | 10010-10012 |

---

## Claude Code Configuration

| Metric | Count |
|--------|-------|
| Rule files (`.claude/rules/`) | 9 |
| Agent definitions (`.claude/agents/`) | 9 |
| Skill definitions (`.claude/skills/`) | 4 |
| CLAUDE.md files (root + nested) | Multiple |

---

## Package Dependencies

| Category | Count |
|----------|-------|
| Production dependencies | 77 |
| Dev dependencies | 20 |
| Radix UI primitives | 19 |
| Total npm packages | 97 |
