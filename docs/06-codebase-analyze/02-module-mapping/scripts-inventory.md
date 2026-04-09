# Scripts Directory - Complete Inventory & Analysis

> **Total Files**: 116 (114 scripts + tsconfig.json + CLAUDE.md)
> **Total LOC**: 27,767 (scripts only, excl. config/docs)
> **Extensions**: .ts (48), .mjs (61), .cjs (1), .js (3), .sql (1)
> **Subdirectory**: `test-template-matching/` (7 files, 4,509 LOC)
> **Analysis Date**: 2026-04-09

---

## 1. Statistics Summary

| Metric | Value |
|--------|-------|
| Script files | 114 |
| TypeScript (.ts) | 48 (42%) |
| ES Module (.mjs) | 61 (54%) |
| CommonJS (.cjs/.js) | 4 (3.5%) |
| SQL | 1 (0.5%) |
| Avg LOC/file | 244 |
| Largest file | `test-plan-003-e2e.ts` (1,569 LOC) |
| Use Prisma directly | 86 files (75%) |
| Call external APIs (OpenAI/HTTP) | 17 files (15%) |
| Registered in package.json | 2 (`i18n:check`, `index:check`) |

### LOC Distribution by Category

| Category | Files | LOC | % of Total |
|----------|-------|-----|------------|
| Test Plan Execution | 14 | 7,445 | 27% |
| Template Matching Tests | 7 | 4,509 | 16% |
| CHANGE/FIX Verification | 17 | 3,829 | 14% |
| Data Inspection (check-*) | 29 | 3,184 | 12% |
| Extraction & Pipeline Tests | 11 | 2,905 | 10% |
| Debug & Analysis (analyze-*/debug-*) | 14 | 2,185 | 8% |
| i18n & Code Quality Tools | 4 | 1,693 | 6% |
| Data Fix / Maintenance | 6 | 1,100 | 4% |
| Admin Operations | 7 | 645 | 2% |
| Temp / Misc | 5 | 272 | 1% |

---

## 2. File Inventory by Category

### 2A. Admin Operations (7 files, 645 LOC)

Scripts that create/modify users, roles, and company records.

| File | Ext | LOC | Purpose | Writes DB? |
|------|-----|-----|---------|------------|
| `create-admin.ts` | .ts | 94 | Create System Admin user account | Yes |
| `grant-admin-access.ts` | .ts | 174 | Grant admin role + all city access to user by email | Yes |
| `assign-admin-role.js` | .js | 75 | Assign admin role to existing user | Yes |
| `fix-user-permissions.ts` | .ts | 170 | Repair broken user permission assignments | Yes |
| `check-user.ts` | .ts | 47 | Read-only: inspect user record by email | No |
| `activate-company.ts` | .ts | 31 | Set company status to ACTIVE | Yes |
| `create-test-companies.ts` | .ts | 54 | Seed test company records for development | Yes |

### 2B. i18n & Code Quality Tools (4 files, 1,693 LOC) -- PRODUCTION USE

| File | Ext | LOC | Purpose | npm Script? |
|------|-----|-----|---------|-------------|
| `check-i18n-completeness.ts` | .ts | 239 | Check TS constants have matching i18n keys | Yes: `npm run i18n:check` |
| `check-i18n.ts` | .ts | 323 | Scan components for hardcoded Chinese; check translation sync | No (manual) |
| `check-index-sync.js` | .js | 252 | Verify PROJECT-INDEX.md links match filesystem | Yes: `npm run index:check` |
| `e2e-i18n-check.ts` | .ts | 879 | E2E browser-based i18n validation (fetch all pages) | No (manual) |

### 2C. Batch Processing Inspection (11 files, 1,057 LOC)

Read-only scripts to inspect batch job status and results.

| File | Ext | LOC | Purpose |
|------|-----|-----|---------|
| `check-batch-status.mjs` | .mjs | 59 | Query batch record by ID |
| `check-batch-status-now.mjs` | .mjs | 88 | Realtime batch status + file counts |
| `check-batch-config.mjs` | .mjs | 62 | Inspect batch configuration settings |
| `check-batch3-simple.mjs` | .mjs | 183 | Simplified batch 3 status query |
| `monitor-batch-progress.mjs` | .mjs | 115 | Poll batch progress at intervals |
| `list-batches.mjs` | .mjs | 68 | List all historical batches |
| `query-batches.mjs` | .mjs | 33 | Filtered batch query |
| `find-batch.ts` | .ts | 45 | Find batch by name/ID |
| `verify-batch-results.ts` | .ts | 152 | Validate batch processing completeness |
| `analyze-batch-results.ts` | .ts | 127 | Analyze batch success/failure rates |
| `analyze-batch-results.mjs` | .mjs | 125 | Same as above (ESM version) |

> `analyze-batch-results.cjs` (125 LOC) is a CommonJS duplicate of the .mjs version.

### 2D. Extraction & DHL Debug (10 files, 1,402 LOC)

Inspect OCR/GPT extraction results, mostly DHL-specific.

| File | Ext | LOC | Purpose |
|------|-----|-----|---------|
| `check-dhl-extraction.mjs` | .mjs | 277 | Inspect DHL document extraction output |
| `check-dhl-details.mjs` | .mjs | 181 | Query DHL extraction detail records |
| `check-dhl-lineitems.mjs` | .mjs | 127 | Inspect DHL line-item extraction |
| `analyze-dhl-extraction.mjs` | .mjs | 191 | Analyze DHL extraction quality metrics |
| `analyze-dhl-lineitems.mjs` | .mjs | 99 | Analyze DHL line-item accuracy |
| `analyze-dhl-problem.mjs` | .mjs | 114 | Diagnose specific DHL extraction failures |
| `check-extraction-structure.mjs` | .mjs | 58 | Verify extraction result JSON schema |
| `check-full-extraction.mjs` | .mjs | 117 | Full extraction result dump |
| `check-gpt-extraction-detail.mjs` | .mjs | 108 | GPT extraction raw response inspection |
| `check-gpt-and-terms.mjs` | .mjs | 130 | Cross-check GPT results vs term mapping |

### 2E. Format, Company & Config Inspection (10 files, 1,149 LOC)

| File | Ext | LOC | Purpose |
|------|-----|-----|---------|
| `check-format-id.mjs` | .mjs | 63 | Query document format by ID |
| `check-format-id.ts` | .ts | 39 | Same (.ts version) |
| `check-company-config.mjs` | .mjs | 111 | Inspect company extraction configuration |
| `check-prompt-config.mjs` | .mjs | 41 | Query prompt configuration records |
| `check-fields.ts` | .ts | 41 | List field definitions |
| `check-resultdata.mjs` | .mjs | 106 | Inspect extraction result data JSON |
| `check-status.mjs` | .mjs | 68 | General document status check |
| `check-export-issue.mjs` | .mjs | 140 | Debug Excel export issues |
| `check-review-queue.js` | .js | 434 | Inspect review queue state (largest check script) |
| `check-change047.mjs` | .mjs | 106 | Verify CHANGE-047 data state |

### 2F. Term & Issuer Analysis (8 files, 978 LOC)

| File | Ext | LOC | Purpose |
|------|-----|-----|---------|
| `analyze-term-structure.mjs` | .mjs | 153 | Analyze term mapping hierarchical structure |
| `check-term-structure.mjs` | .mjs | 92 | Verify term mapping data integrity |
| `check-issuer-stats.mjs` | .mjs | 55 | Issuer identification statistics |
| `check-issuer-status.mjs` | .mjs | 117 | Issuer processing status details |
| `analyze-issuer-issue.ts` | .ts | 124 | Diagnose issuer identification failures |
| `debug-issuer-structure.mjs` | .mjs | 159 | Debug issuer data relationships |
| `debug-company-matching.mjs` | .mjs | 211 | Debug company matching algorithm |
| `test-company-matching.mjs` | .mjs | 67 | Test company matching logic |

### 2G. Debug Utilities (4 files, 783 LOC)

| File | Ext | LOC | Purpose |
|------|-----|-----|---------|
| `debug-format-issue.mjs` | .mjs | 271 | Debug document format detection issues |
| `debug-hierarchical-export.mjs` | .mjs | 304 | Debug hierarchical term export failures |
| `analyze-failures.mjs` | .mjs | 113 | Analyze processing failure patterns |
| `create-dhl-prompt-config.mjs` | .mjs | 95 | Create DHL-specific prompt config (one-time setup) |

### 2H. Data Fix & Maintenance (6 files, 1,100 LOC) -- WRITES DATA

| File | Ext | LOC | Purpose | Risk |
|------|-----|-----|---------|------|
| `backfill-document-format-id.mjs` | .mjs | 262 | FIX-006: backfill missing formatId on historical files | Medium |
| `fix-file-detected-type.mjs` | .mjs | 108 | Fix detectedType field for batch files | Medium |
| `reset-stuck-files.mjs` | .mjs | 73 | Reset PROCESSING→DETECTED for stuck files | Medium |
| `reset-and-trigger-batch.mjs` | .mjs | 133 | Reset batch to PENDING + trigger via API | **High** |
| `reaggregate-batch-terms.mjs` | .mjs | 219 | FIX-007: re-aggregate terms with correct issuerId | Medium |
| `reprocess-missing-issuer.ts` | .ts | 305 | FIX-005: re-run issuer classification on files | **High** (calls GPT) |

### 2I. CHANGE/FIX Verification Scripts (17 files, 3,829 LOC)

Scripts created to verify specific CHANGE or FIX implementations.

| File | Ext | LOC | Tracks |
|------|-----|-----|--------|
| `verify-change-006.mjs` | .mjs | 222 | CHANGE-006 |
| `verify-change-006-db.mjs` | .mjs | 169 | CHANGE-006 (DB layer) |
| `check-change006-batch.mjs` | .mjs | 166 | CHANGE-006 batch |
| `check-change006-batch3.mjs` | .mjs | 222 | CHANGE-006 batch 3 |
| `check-change006-result.mjs` | .mjs | 128 | CHANGE-006 results |
| `run-change006-test.mjs` | .mjs | 308 | CHANGE-006 E2E test runner |
| `test-change-010.ts` | .ts | 330 | CHANGE-010 |
| `test-change-024-v3-1-integration.ts` | .ts | 627 | CHANGE-024 V3.1 integration |
| `test-fix-004b.ts` | .ts | 112 | FIX-004b |
| `test-fix-005.ts` | .ts | 53 | FIX-005 |
| `verify-fix-005.ts` | .ts | 275 | FIX-005 verification |
| `verify-fix005-results.ts` | .ts | 332 | FIX-005 results |
| `test-fix-006.mjs` | .mjs | 209 | FIX-006 |
| `test-fix-008-e2e.mjs` | .mjs | 121 | FIX-008 E2E |
| `validate-fix-008-batch.mjs` | .mjs | 222 | FIX-008 batch |
| `verify-address-filter.mjs` | .mjs | 198 | Address filter logic |
| `setup-formats-and-test.ts` | .ts | 135 | Format setup + smoke test |

### 2J. Test Plan Execution (14 files, 7,445 LOC) -- LARGEST CATEGORY

End-to-end test plans for major features; many call local API + GPT.

| File | Ext | LOC | Purpose |
|------|-----|-----|---------|
| `test-plan-003-e2e.ts` | .ts | 1,569 | Full E2E test plan 003 |
| `e2e-test-plan-002.ts` | .ts | 823 | E2E test plan 002 |
| `run-test-plan-003-full.mjs` | .mjs | 606 | Execute test plan 003 (full) |
| `run-test-plan-003-prisma.mjs` | .mjs | 489 | Test plan 003 Prisma-only variant |
| `verify-test-plan-003.mjs` | .mjs | 166 | Verify test plan 003 results |
| `export-test-plan-003-temp.ts` | .ts | 305 | Export test plan 003 data |
| `run-test-plan-005.mjs` | .mjs | 494 | Execute test plan 005 |
| `run-test-plan-005-prisma.ts` | .ts | 473 | Test plan 005 Prisma variant |
| `run-e2e-historical-test.ts` | .ts | 537 | Historical data E2E test |
| `run-full-historical-test.mjs` | .mjs | 398 | Full historical processing test |
| `test-e2e-pipeline.ts` | .ts | 650 | End-to-end pipeline integration test |
| `test-dual-processing.ts` | .ts | 453 | Dual processing mode comparison |
| `test-excel-export.ts` | .ts | 292 | Excel export functionality test |
| `test-hierarchical-aggregation.ts` | .ts | 190 | Hierarchical term aggregation test |

### 2K. Extraction & AI Model Tests (7 files, 1,961 LOC)

| File | Ext | LOC | Purpose | Calls GPT? |
|------|-----|-----|---------|------------|
| `test-gpt5-nano-extraction.ts` | .ts | 854 | GPT-5-nano cost optimization evaluation | Yes |
| `test-multi-stage-extraction.ts` | .ts | 464 | Three-stage extraction pipeline test | Yes |
| `test-model-capabilities.ts` | .ts | 322 | Compare GPT model capabilities | Yes |
| `test-gpt-vision-service.mjs` | .mjs | 104 | GPT Vision service smoke test | Yes |
| `test-pdf-conversion.mjs` | .mjs | 76 | PDF→image conversion test | No |
| `test-v3-upload.ts` | .ts | 67 | V3 upload endpoint test | No |
| `test-export-api.mjs` | .mjs | 74 | Export API endpoint test | No |

### 2L. Template Matching Test Suite (7 files, 4,509 LOC)

Structured test suite in `test-template-matching/` subdirectory.

| File | LOC | Purpose |
|------|-----|---------|
| `01-data-exploration.ts` | 360 | Query all template matching data from DB |
| `02-prepare-test-data.ts` | 333 | Create test templates, fields, instances |
| `03-execute-matching.ts` | 809 | Run template matching algorithm |
| `04-priority-cascade.ts` | 877 | Test priority cascade logic |
| `05-transform-validation.ts` | 821 | Validate field transformation rules |
| `06-boundary-conditions.ts` | 500 | Edge cases and boundary testing |
| `07-pipeline-integration.ts` | 809 | Full pipeline integration test |

### 2M. Export & Hierarchical Terms (4 files, 944 LOC)

| File | Ext | LOC | Purpose |
|------|-----|-----|---------|
| `export-hierarchical-terms.ts` | .ts | 443 | Export hierarchical term mapping to Excel |
| `test-hierarchical-export.mjs` | .mjs | 146 | Test hierarchical export output |
| `test-hierarchical-service.mjs` | .mjs | 274 | Test hierarchical aggregation service |
| `test-document-query.ts` | .ts | 81 | Test document query patterns |

### 2N. Temp / Throwaway Scripts (5 files, 272 LOC)

| File | Ext | LOC | Purpose |
|------|-----|-----|---------|
| `temp-check-doc.ts` | .ts | 40 | One-off document inspection |
| `temp-query-docs.ts` | .ts | 20 | Temporary document query |
| `temp-query-prompt.ts` | .ts | 76 | Temporary prompt config query |
| `init-db.sql` | .sql | 11 | DB initialization (uuid-ossp extension) |
| `analyze-batch-results.cjs` | .cjs | 125 | CJS duplicate of .mjs version |

---

## 3. Key Patterns

### 3.1 Prisma Usage

**86 of 114 scripts (75%) use Prisma directly.** Common initialization pattern:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

All scripts use the `@prisma/adapter-pg` PostgreSQL driver adapter, not the default Prisma engine.

### 3.2 External API Calls

| API | Files | Examples |
|-----|-------|---------|
| Azure OpenAI (GPT) | 10+ | `test-gpt5-nano-extraction.ts`, `test-model-capabilities.ts` |
| Local Next.js API (fetch) | 15+ | `run-test-plan-*.mjs`, `test-e2e-pipeline.ts` |
| Azure Blob Storage | 2-3 | `test-e2e-pipeline.ts`, `test-v3-upload.ts` |

### 3.3 Manual vs Automated

| Type | Count | Description |
|------|-------|-------------|
| **npm-registered** | 2 | `check-i18n-completeness.ts`, `check-index-sync.js` |
| **One-time fix** | 6 | `backfill-*`, `fix-*`, `reset-*` (created for specific FIX) |
| **Reusable debug** | ~30 | `check-*`, `analyze-*` (ad-hoc DB inspection) |
| **Test execution** | ~25 | `test-*`, `run-*` (feature/fix verification) |
| **Temporary** | ~5 | `temp-*` (should be deleted) |

### 3.4 Dangerous Scripts (Data Modification)

| Risk | Scripts | Action |
|------|---------|--------|
| **High** | `reset-and-trigger-batch.mjs` | Resets batch status + triggers reprocessing via API |
| **High** | `reprocess-missing-issuer.ts` | Re-runs GPT classification (costs $, modifies data) |
| **Medium** | `reset-stuck-files.mjs` | Bulk updateMany on historicalFile records |
| **Medium** | `backfill-document-format-id.mjs` | Backfills column values on historical files |
| **Medium** | `fix-file-detected-type.mjs` | Updates detectedType for batch files |
| **Medium** | `reaggregate-batch-terms.mjs` | Re-aggregates term mapping data |
| **Low** | `create-admin.ts`, `grant-admin-access.ts` | Creates/modifies user records |

### 3.5 Duplicate / Multi-Version Files

| Base Name | Versions | Note |
|-----------|----------|------|
| `analyze-batch-results` | .ts, .mjs, .cjs | 3 versions of same logic |
| `check-format-id` | .ts, .mjs | 2 versions |
| `verify-fix-005` / `verify-fix005-results` | 2 .ts files | Overlapping verification |

---

## 4. Observations & Recommendations

### Growth Pattern
Scripts accumulated organically during development (CHANGE-006 alone has 6 scripts). The 61 .mjs files suggest early scripts predated the tsconfig.json setup that later enabled .ts usage.

### Cleanup Candidates
- **5 temp-* files** (157 LOC) -- safe to remove
- **3 duplicate versions** of analyze-batch-results -- consolidate to .ts
- **~17 CHANGE/FIX verification scripts** -- archive after confirmed stable (these are one-time verification tools)

### Production-Critical Scripts
Only 2 scripts are wired into `package.json`:
1. `check-i18n-completeness.ts` (`npm run i18n:check`) -- used in CI/dev workflow
2. `check-index-sync.js` (`npm run index:check`) -- project index validation

### Missing from Analysis
- No shell scripts (.sh/.bat) found
- No scheduled/cron scripts -- all are manual execution
- No migration scripts beyond init-db.sql (migrations handled by Prisma)
