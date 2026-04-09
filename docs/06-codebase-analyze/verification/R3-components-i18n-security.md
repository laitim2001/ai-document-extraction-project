# R3 Verification Report: Components, Hooks/Types/Lib, i18n, Security

> **Verification Date**: 2026-04-09
> **Verified By**: Claude Code (automated codebase audit)
> **Scope**: 4 documentation files vs actual source code
> **Total Checks**: 100 points across 4 sets

---

## Set A: Components Overview (~25 points)

**Document**: `docs/06-codebase-analyze/02-module-mapping/components-overview.md`

### A-1. Total TSX File Count (3 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| 371 TSX files | 371 | **[PASS]** |

Command: `find src/components -name "*.tsx" | wc -l` = 371

### A-2. Client/Server Component Ratio (3 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| 355 client (95.7%) | 355 client (95.7%) | **[PASS]** |
| 16 server | 16 server | **[PASS]** |

Command: `find src/components -name "*.tsx" -exec grep -l "'use client'" {} | wc -l` = 355

### A-3. Top-Level Directory Counts (5 pts)

| Directory | Claimed | Actual | Verdict |
|-----------|---------|--------|---------|
| ui/ | 34 | 34 | **[PASS]** |
| layout/ | 5 | 5 | **[PASS]** |
| dashboard/ | 10 | 10 | **[PASS]** |
| reports/ | 7 | 7 | **[PASS]** |
| audit/ | 3 | 3 | **[PASS]** |
| filters/ | 2 | 2 | **[PASS]** |
| admin/ | 1 | 1 | **[PASS]** |
| analytics/ | 1 | 1 | **[PASS]** |
| auth/ | 1 | 1 | **[PASS]** |
| export/ | 1 | 1 | **[PASS]** |
| layouts/ | 0 | 0 | **[PASS]** |
| features/ | 306 | 306 | **[PASS]** |

Claimed 12 top-level directories: actual count is 12 (11 with files + layouts/ empty). **[PASS]**

### A-4. Features Subdirectory Count (2 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| 38 subdirectories | 38 | **[PASS]** |

### A-5. Features Per-Subdirectory Counts (5 pts)

| Subdirectory | Claimed | Actual | Verdict |
|-------------|---------|--------|---------|
| admin | 47 | 47 | **[PASS]** |
| review | 27 | 27 | **[PASS]** |
| rules | 22 | 22 | **[PASS]** |
| formats | 17 | 17 | **[PASS]** |
| historical-data | 16 | 16 | **[PASS]** |
| template-instance | 13 | 13 | **[PASS]** |
| forwarders | 12 | 12 | **[PASS]** |
| template-field-mapping | 11 | 11 | **[PASS]** |
| document | 11 | 11 | **[PASS]** |
| document-preview | 10 | 10 | **[PASS]** |
| prompt-config | 10 | 10 | **[PASS]** |
| mapping-config | 9 | 9 | **[PASS]** |
| reference-number | 8 | 8 | **[PASS]** |
| field-definition-set | 7 | 7 | **[PASS]** |
| exchange-rate | 6 | 6 | **[PASS]** |
| escalation | 6 | 6 | **[PASS]** |
| suggestions | 6 | 6 | **[PASS]** |
| rule-review | 6 | 6 | **[PASS]** |
| retention | 5 | 5 | **[PASS]** |
| data-template | 5 | 5 | **[PASS]** |
| document-source | 5 | 5 | **[PASS]** |
| template-match | 5 | 5 | **[PASS]** |
| pipeline-config | 4 | 4 | **[PASS]** |
| global | 4 | 4 | **[PASS]** |
| docs | 4 | 4 | **[PASS]** |
| confidence | 3 | 3 | **[PASS]** |
| auth | 3 | 3 | **[PASS]** |
| audit | 3 | 3 | **[PASS]** |
| outlook | 3 | 3 | **[PASS]** |
| rule-version | 3 | 3 | **[PASS]** |
| reports | 3 | 3 | **[PASS]** |
| companies | 2 | 2 | **[PASS]** |
| format-analysis | 2 | 2 | **[PASS]** |
| history | 2 | 2 | **[PASS]** |
| sharepoint | 2 | 2 | **[PASS]** |
| term-analysis | 2 | 2 | **[PASS]** |
| locale | 1 | 1 | **[PASS]** |
| region | 1 | 1 | **[PASS]** |

All 38 subdirectories match exactly.

### A-6. Random Component File Existence (4 pts)

10 random component paths verified:

| Path | Verdict |
|------|---------|
| `src/components/features/review/ReviewQueue.tsx` | **[PASS]** |
| `src/components/features/admin/alerts/AlertDashboard.tsx` | **[PASS]** |
| `src/components/layout/TopBar.tsx` | **[PASS]** |
| `src/components/ui/badge.tsx` | **[PASS]** |
| `src/components/features/rules/RuleList.tsx` | **[PASS]** |
| `src/components/features/formats/FormatList.tsx` | **[PASS]** |
| `src/components/features/document/FileUploader.tsx` | **[PASS]** |
| `src/components/dashboard/StatCard.tsx` | **[PASS]** |
| `src/components/features/forwarders/ForwarderList.tsx` | **[PASS]** |
| `src/components/features/prompt-config/PromptEditor.tsx` | **[PASS]** |

### A-7. Summary Observation (3 pts)

Doc claims features/ has 303 client / 3 server (ConfidenceIndicator, PdfLoadingSkeleton, ReviewQueueSkeleton). The three server components are listed and exist. The total features count of 306 is confirmed. **[PASS]**

**Set A Score: 25/25**

---

## Set B: Hooks/Types/Lib (~25 points)

**Document**: `docs/06-codebase-analyze/02-module-mapping/hooks-types-lib-overview.md`

### B-1. Total File Counts (5 pts)

| Module | Claimed | Actual | Verdict |
|--------|---------|--------|---------|
| `src/hooks/` | 104 | 104 | **[PASS]** |
| `src/types/` | 93 | 93 | **[PASS]** |
| `src/lib/` | 68 | 68 | **[PASS]** |
| `src/stores/` | 2 | 2 | **[PASS]** |
| `src/validations/` | 6 | 6 | **[PASS]** |
| `src/constants/` | 5 | 5 | **[PASS]** |
| `src/config/` | 2 | 2 | **[PASS]** |
| `src/i18n/` | 3 | 3 (+ CLAUDE.md not counted) | **[PASS]** |
| `src/contexts/` | 2 | 2 | **[PASS]** |
| `src/events/` | 1 | 1 | **[PASS]** |
| `src/middlewares/` | 5 | 5 | **[PASS]** |
| `src/providers/` | 3 | 3 | **[PASS]** |
| `src/jobs/` | 2 | 2 | **[PASS]** |

Doc summary total claims 305. Actual sum: 104+93+68+2+6+9+5+2+3+2+1+5+3+2 = 305. **[PASS]**

Note: `src/lib/validations/` has 9 files. These are counted within the lib/ total of 68, and separately called out as 9 in the summary table. This is consistent.

### B-2. Hooks Category Header vs Actual Table Entries (3 pts)

| Section | Header Claim | Table Entries Listed | Actual Files in Category | Verdict |
|---------|-------------|---------------------|--------------------------|---------|
| Data Fetching (Query) | **59** | **74** | ~76 (after subtracting mutation/UI) | **[FAIL]** |
| Mutation-Only | **12** | **13** | 13 | **[FAIL]** |
| UI / Utility | 15 | 15 | 15 | **[PASS]** |

**Finding**: The "Data Fetching" section header claims "59 files" but the actual table lists 74 entries. The "Mutation-Only" header claims "12 files" but lists 13 entries (useTestRule is the 13th). The section headers are stale/incorrect while the actual tables are accurate.

Additionally, 2 hook files exist in the codebase but are not listed in ANY doc section:
- `useRuleDetail.ts`
- `useRuleList.ts`

This means the doc tables cover 74+13+15 = 102 hooks, but the filesystem has 104. Two hooks are undocumented.

### B-3. Random Hook File Existence (3 pts)

10 random hooks verified:

| Hook | Verdict |
|------|---------|
| `use-accessible-cities.ts` | **[PASS]** |
| `useAiCost.ts` | **[PASS]** |
| `use-debounce.ts` | **[PASS]** |
| `useReviewQueue.ts` | **[PASS]** |
| `use-toast.ts` | **[PASS]** |
| `use-field-label.ts` | **[PASS]** |
| `use-exchange-rates.ts` | **[PASS]** |
| `useApproveReview.ts` | **[PASS]** |
| `use-auth.ts` | **[PASS]** |
| `useMediaQuery.ts` | **[PASS]** |

### B-4. Zustand Store State Shape (3 pts)

**reviewStore.ts** verified against doc claims:

| Claimed State Field | Actual | Verdict |
|--------------------|--------|---------|
| `selectedFieldId: string \| null` | Line 35: `selectedFieldId: string \| null` | **[PASS]** |
| `selectedFieldPosition: FieldSourcePosition \| null` | Line 37 | **[PASS]** |
| `editingFieldId: string \| null` | Line 41 | **[PASS]** |
| `currentPage: number` | Line 44 | **[PASS]** |
| `zoomLevel: number` | Line 46 | **[PASS]** |
| `dirtyFields: Set<string>` | Line 50 | **[PASS]** |
| `pendingChanges: Map<string, string>` | Line 52 | **[PASS]** |
| `originalValues: Map<string, string \| null>` | Line 54 | **[PASS]** |
| `fieldNames: Map<string, string>` | Line 57 | **[PASS]** |

All 9 state fields and 11 actions match exactly. **[PASS]**

**document-preview-test-store.ts** exists as claimed. **[PASS]**

### B-5. Feature Flag Groups (3 pts)

Doc claims: "Dynamic Prompt (5 flags), Extraction V3 (6 flags), Extraction V3.1 (3 flags)"

| Group | Claimed | Actual Interface Fields | Verdict |
|-------|---------|------------------------|---------|
| Dynamic Prompt (`FeatureFlags`) | 5 | 5 (dynamicPromptEnabled + 4 individual) | **[PASS]** |
| Extraction V3 (`ExtractionV3FeatureFlags`) | 6 | 6 | **[PASS]** |
| Extraction V3.1 (`ExtractionV3_1FeatureFlags`) | 3 | 3 | **[PASS]** |

### B-6. Middleware File Count (2 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| `src/middlewares/` — 5 files | 5 files | **[PASS]** |

### B-7. Types Subcategory Header Accuracy (3 pts)

| Subcategory | Header Claim | Entries Listed | Verdict |
|------------|-------------|---------------|---------|
| Document & Extraction | 15 | 15 | **[PASS]** |
| Company & Rules | 11 | 11 | **[PASS]** |
| Review & Workflow | 8 | 8 | **[PASS]** |
| Confidence & Routing | 3 | 3 | **[PASS]** |
| Admin & Monitoring | 12 | 12 | **[PASS]** |
| Reports & Analytics | **7** | **9** | **[FAIL]** |
| Auth & User | 6 | 6 | **[PASS]** |
| Prompt Config | 3 | 3 (but `prompt-resolution.ts` appears in both this and Confidence & Routing) | **[PASS]** (duplicate listing noted) |
| External API | 10 | 10 | **[PASS]** |
| Integration & Config | **8** | **17** | **[FAIL]** |

**Finding**: The "Reports & Analytics" header says "7 files" but lists 9 entries (accuracy, ai-cost, city-cost, dashboard, dashboard-filter, monthly-report, regional-report, report-export, processing-statistics). The "Integration & Config" header says "8 files" but lists 17 entries. The headers appear to be remnants from a prior count, while the tables themselves contain the correct individual file listings.

Also note: `prompt-resolution.ts` is listed in both "Confidence & Routing" (line 185) and "Prompt Config" (line 235). This is a minor duplicate listing.

### B-8. Doc Total Claim (3 pts)

Doc final summary says "Total: 305". Computed sum of claimed values in summary table: 104+93+68+2+6+9+5+2+3+2+1+5+3+2 = 305. The title says "Total files across all sections: 302" (line 3), which conflicts with the summary table total of 305.

**[FAIL]**: Title says 302, summary table says 305.

**Set B Score: 19/25**

Deductions:
- -2 for hooks category header miscount (59 should be 74, 12 should be 13) + 2 missing hooks
- -2 for types subcategory header miscounts (7 should be 9, 8 should be 17)
- -2 for total inconsistency (302 in title vs 305 in summary)

---

## Set C: i18n Coverage (~25 points)

**Document**: `docs/06-codebase-analyze/06-i18n-analysis/i18n-coverage.md`

### C-1. JSON Files Per Language Directory (3 pts)

| Locale | Claimed | Actual | Verdict |
|--------|---------|--------|---------|
| en | 34 | 34 | **[PASS]** |
| zh-TW | 34 | 34 | **[PASS]** |
| zh-CN | 34 | 34 | **[PASS]** |

### C-2. Namespace Count vs request.ts (3 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| 34 namespaces registered | 34 namespaces extracted from request.ts | **[PASS]** |

Extracted namespaces from request.ts: common, navigation, dialogs, auth, validation, errors, dashboard, global, escalation, review, documents, rules, companies, reports, admin, historicalData, termAnalysis, documentPreview, fieldMappingConfig, promptConfig, dataTemplates, formats, templateFieldMapping, templateInstance, templateMatchingTest, standardFields, referenceNumber, confidence, exchangeRate, region, pipelineConfig, fieldDefinitionSet, profile, systemSettings = 34.

### C-3. Per-Namespace Key Counts (5 random) (5 pts)

| Namespace | Claimed en | Actual en | Claimed zh-TW | Actual zh-TW | Claimed zh-CN | Actual zh-CN | Verdict |
|-----------|-----------|-----------|---------------|-------------|---------------|-------------|---------|
| admin | 525 | 525 | 525 | 525 | 525 | 525 | **[PASS]** |
| common | 97 | 97 | 97 | 97 | 85 | 85 | **[PASS]** |
| documents | 194 | 194 | 194 | 194 | 194 | 194 | **[PASS]** |
| rules | 318 | 318 | 318 | 318 | 318 | 318 | **[PASS]** |
| templateInstance | 202 | 202 | 202 | 202 | 202 | 202 | **[PASS]** |

### C-4. Total Key Counts (3 pts)

| Locale | Claimed | Actual | Verdict |
|--------|---------|--------|---------|
| en | 4,405 | 4,405 | **[PASS]** |
| zh-TW | 4,405 | 4,405 | **[PASS]** |
| zh-CN | 4,393 | 4,393 | **[PASS]** |

zh-CN delta of -12 confirmed.

### C-5. useTranslations Usage Count (4 pts)

| Metric | Claimed | Actual | Verdict |
|--------|---------|--------|---------|
| `useTranslations` files | 263 | 262 | **[FAIL]** |
| `useTranslations` total calls | 595 | 594 | **[FAIL]** |
| `getTranslations` files | 21 | 21 | **[PASS]** |
| `getTranslations` total calls | 51 | 51 | **[PASS]** |
| `useLocale` files | 36 | 36 | **[PASS]** |
| `useLocale` total calls | 74 | 74 | **[PASS]** |

**Finding**: `useTranslations` file count is off by 1 (263 claimed vs 262 actual) and call count off by 1 (595 vs 594). This is a marginal variance -- likely a file was removed or added since the doc was generated on the same day. Minor discrepancy.

### C-6. Missing Key Analysis (3 pts)

Doc claims 12 missing keys in zh-CN common.json (locale.* and city.* sections). Confirmed: en has 97 keys, zh-CN has 85 keys, delta = 12. **[PASS]**

### C-7. Fallback Chain & Config (4 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| Default locale: `en` | Confirmed in config.ts | **[PASS]** |
| Locale prefix: `always` | Confirmed in routing.ts | **[PASS]** |
| Timezone: `Asia/Taipei` | Confirmed in request.ts | **[PASS]** |
| Fallback chain: locale -> en -> empty | Confirmed in request.ts | **[PASS]** |

**Set C Score: 23/25**

Deductions:
- -2 for useTranslations file count off by 1 and call count off by 1

---

## Set D: Security Audit (~25 points)

**Document**: `docs/06-codebase-analyze/05-security-quality/security-audit.md`

### D-1. console.log Count (3 pts)

| Metric | Claimed | Actual | Verdict |
|--------|---------|--------|---------|
| Total console.log occurrences in src/ | 287 | 287 | **[PASS]** |
| Files with console.log | (not explicitly claimed) | 94 | N/A |

### D-2. auth.config.ts console.log Count (3 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| 9 console.logs | 9 console.logs | **[PASS]** |
| 6 expose PII (email) | Lines 134, 146, 168, 175, 192, 196 = 6 email-logging lines | **[PASS]** |

All 9 line numbers and content match the doc exactly.

### D-3. `any` Type Count (2 pts)

| Pattern | Actual Count |
|---------|-------------|
| `: any` | 13 |
| `as any` | 2 |
| **Total** | **15** |

Note: The security doc does not explicitly claim an `any` count. Recorded here for reference.

### D-4. SQL Injection Locations (3 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| 2 `$executeRawUnsafe` instances in db-context.ts | Lines 87 and 106 confirmed | **[PASS]** |
| 13 `$queryRaw` instances (safe) | 13 confirmed | **[PASS]** |
| cityCodes string interpolation vulnerability | Confirmed at line 85-91 | **[PASS]** |
| Line 106 is clearRlsContext (hardcoded values, safe) | Confirmed -- uses literal strings only | **[PASS]** |

### D-5. Middleware API Skip (2 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| middleware.ts skips /api paths (line 92) | Line 92: `pathname.startsWith('/api')` | **[PASS]** |

### D-6. Total Route File Count (2 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| 331 route files | 331 | **[PASS]** |

### D-7. Auth Coverage Spot-Checks (5 domains) (8 pts)

| Domain | Doc: With Auth | Doc: Total | Actual: With Auth | Actual: Total | Verdict |
|--------|---------------|-----------|-------------------|--------------|---------|
| `/admin/*` | 96 | 106 | 101 | 106 | **[FAIL]** |
| `/v1/*` | 13 | 77 | 16 | 77 | **[FAIL]** |
| `/rules/*` | 20 | 20 | 20 | 20 | **[PASS]** |
| `/reports/*` | 4 | 12 | 8 | 12 | **[FAIL]** |
| `/cost/*` | 0 | 5 | 3 | 5 | **[FAIL]** |
| `/companies/*` | 11 | 12 | 11 | 12 | **[PASS]** |
| `/documents/*` | 15 | 19 | 19 | 19 | **[FAIL]** |
| `/dashboard/*` | 0 | 5 | 5 | 5 | **[FAIL]** |

**Critical Finding**: Auth coverage is significantly UNDERCOUNTED in the doc for multiple domains:

- **admin**: Doc says 96/106 (91%), actual is 101/106 (95%) -- 5 more routes have auth
- **v1**: Doc says 13/77 (17%), actual is 16/77 (21%) -- 3 more routes have auth
- **reports**: Doc says 4/12 (33%), actual is 8/12 (67%) -- 4 more routes have auth
- **cost**: Doc says 0/5 (0%), actual is 3/5 (60%) -- 3 routes DO have auth
- **documents**: Doc says 15/19 (79%), actual is 19/19 (100%) -- all routes have auth
- **dashboard**: Doc says 0/5 (0%), actual is 5/5 (100%) -- all routes have auth

The doc's total auth coverage claim of 196/331 (59%) is also incorrect. Actual: 242/331 (73%).

**Root Cause**: The grep pattern used for auth detection in the doc likely missed some auth patterns (e.g., `session` keyword variants, imported auth middleware wrappers).

### D-8. Zod Validation Coverage (2 pts)

| Claim | Actual | Verdict |
|-------|--------|---------|
| 184 routes with mutation methods | 195 | **[FAIL]** |
| 150 with Zod (82%) | 159 with Zod patterns | **[FAIL]** |
| 34 lacking Zod (18% gap) | 36 lacking Zod (18.5%) | Close |

The mutation route count is off (184 vs 195) and Zod-validated count is off (150 vs 159). However, the GAP percentage (18% vs 18.5%) is very close, suggesting the proportional analysis is consistent even if absolute numbers shifted.

**Set D Score: 17/25**

Deductions:
- -6 for auth coverage undercounting across 6 of 8 domains checked (total 59% claimed vs 73% actual)
- -2 for mutation route count and Zod coverage absolute numbers off

---

## Overall Summary

| Set | Topic | Score | Max |
|-----|-------|-------|-----|
| A | Components Overview | 25 | 25 |
| B | Hooks/Types/Lib | 19 | 25 |
| C | i18n Coverage | 23 | 25 |
| D | Security Audit | 17 | 25 |
| **TOTAL** | | **84** | **100** |

### Critical Findings

| # | Severity | Document | Finding |
|---|----------|----------|---------|
| 1 | **HIGH** | security-audit.md | Auth coverage severely undercounted: doc claims 59% (196/331), actual is 73% (242/331). Six domains have higher auth than reported, including 2 domains (documents, dashboard) that are actually 100% auth-covered but reported as 79% and 0% respectively. |
| 2 | **MEDIUM** | security-audit.md | Overall security score of 5.5/10 is likely too low given actual auth coverage is 73%, not 59%. Authentication dimension score should be higher than 4/10. |
| 3 | **MEDIUM** | hooks-types-lib-overview.md | Section header counts inconsistent with table contents: "Data Fetching: 59" but 74 entries listed; "Mutation-Only: 12" but 13 entries listed; "Reports & Analytics: 7" but 9 entries listed; "Integration & Config: 8" but 17 entries. |
| 4 | **LOW** | hooks-types-lib-overview.md | Title says "302" total files, summary table sums to 305. |
| 5 | **LOW** | hooks-types-lib-overview.md | 2 hooks missing from doc: `useRuleDetail.ts`, `useRuleList.ts`. |
| 6 | **LOW** | i18n-coverage.md | useTranslations count off by 1 (263 claimed vs 262 actual). |
| 7 | **LOW** | security-audit.md | Mutation route count off: 184 claimed vs 195 actual. |

### Recommendations

1. **Recount auth coverage** in security-audit.md using a broader grep pattern that captures all auth check variants (session imports, middleware wrappers, etc.). The current report significantly understates security posture.
2. **Fix section headers** in hooks-types-lib-overview.md to match actual table entry counts.
3. **Add missing hooks** (useRuleDetail.ts, useRuleList.ts) to the hooks overview.
4. **Reconcile title vs summary total** in hooks-types-lib-overview.md.

---

*Verification performed by automated codebase audit against live source code.*
*All `find`/`grep`/`wc` commands were run directly against `src/` on 2026-04-09.*
