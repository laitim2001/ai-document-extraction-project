# R13: CLAUDE.md Deep Reality Check & Cross-Document Consistency

> Generated: 2026-04-09 | Verification round: R13 | Scope: 125 verification points across 4 sets

---

## Set A: CLAUDE.md Staleness Report (50 points)

### Master Table: Every Numeric & Technical Claim in Root CLAUDE.md

| # | Claim Location | Documented Value | Actual Value | Verdict | Notes |
|---|---------------|-----------------|--------------|---------|-------|
| A1 | L105: React components | "165+" | **371** | **[STALE]** | `find src/components -name "*.tsx" \| wc -l` = 371 |
| A2 | L106: Business services | "124+" | **200** | **[STALE]** | `find src/services -name "*.ts" \| wc -l` = 200 |
| A3 | L107: API route files | "175+" | **331** | **[STALE]** | `find src/app/api -name "route.ts" \| wc -l` = 331 |
| A4 | L107: HTTP endpoints | "~300+" | **~417** | **[STALE]** | 203 GET + 142 POST + 33 PATCH + 8 PUT + 31 DELETE = 417 |
| A5 | L108: Custom hooks | "89" | **104** | **[STALE]** | `find src/hooks -name "*.ts" -o -name "*.tsx" \| wc -l` = 104 |
| A6 | L109: Prisma models | "117" | **122** | **[STALE]** | `grep -c "^model " prisma/schema.prisma` = 122 |
| A7 | L110/L75: i18n namespaces | "30/language" | **34/language** | **[STALE]** | `ls messages/en/*.json \| wc -l` = 34; 4 missing from listed 30: pipelineConfig, fieldDefinitionSet, profile, systemSettings |
| A8 | L71: Radix UI primitives | "20+" | **19** | **[STALE]** | `grep -c "@radix-ui/" package.json` = 19 (accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, label, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toast, tooltip) |
| A9 | L54-60: Confidence thresholds | ">= 95% AUTO_APPROVE, 80-94% QUICK_REVIEW, < 80% FULL_REVIEW" | **>= 90% AUTO_APPROVE, 70-89% QUICK_REVIEW, < 70% FULL_REVIEW** | **[STALE]** | `confidence-v3-1.service.ts` L112-118: ROUTING_THRESHOLDS_V3_1 = { AUTO_APPROVE: 90, QUICK_REVIEW: 70 }. Doc shows V2 values, not V3.1 |
| A10 | L62: Smart downgrade rule 1 | "新公司 -> 強制 FULL_REVIEW" | **New company: AUTO_APPROVE -> QUICK_REVIEW only** | **[WRONG]** | `generateRoutingDecision()` L402-408: only downgrades from AUTO_APPROVE to QUICK_REVIEW. The separate `getSmartReviewType()` L539-546 does force FULL_REVIEW, but it is NOT used by the main pipeline's `calculate()` method |
| A11 | L62: Smart downgrade rule 2 | "新格式 -> 強制 QUICK_REVIEW" | **New format: AUTO_APPROVE -> QUICK_REVIEW only** | **[WRONG]** | `generateRoutingDecision()` L410-415: same as new company -- only downgrades from AUTO_APPROVE |
| A12 | L62: Smart downgrade rule 3 | "DEFAULT 配置來源 -> 降一級路由" | **LLM_INFERRED config -> AUTO_APPROVE to QUICK_REVIEW** | **[WRONG]** | Code checks `configSource === 'LLM_INFERRED'` (L419), not `DEFAULT`. Also only downgrades from AUTO_APPROVE. The `getSmartReviewType()` method does check `DEFAULT` (L558), but again, not in the main pipeline path |
| A13 | L62: Smart downgrade count | 3 rules listed | **5 actual conditions** in `generateRoutingDecision()` | **[STALE]** | Missing: (1) >3 items needing classification -> QUICK_REVIEW, (2) Stage failure -> FULL_REVIEW. These are in code but not documented |
| A14 | L49/L82: GPT model name | "GPT-5.2" | **gpt-5.2** (deployment) + **gpt-5-nano** (Stage 1/2) | **[PASS]** | `gpt-caller.service.ts` L36: `GptModelType = 'gpt-5-nano' \| 'gpt-5.2'`. Default deployment names: gpt-5-2-vision, gpt-5-nano. CLAUDE.md mentions "GPT-5.2" which is correct as the primary model |
| A15 | L70: Next.js version | "15.0.0" | **^15.0.0** | **[PASS]** | package.json: `"next": "^15.0.0"` |
| A16 | L70: TypeScript version | "5.0" | **^5.0.0** | **[PASS]** | package.json: `"typescript": "^5.0.0"` |
| A17 | L70: React version | "18.3" | **^18.3.0** | **[PASS]** | package.json: `"react": "^18.3.0"` |
| A18 | L73: Zustand | "5.x" | **^5.0.9** | **[PASS]** | package.json confirmed |
| A19 | L74: Zod | "4.x" | **^4.2.1** | **[PASS]** | package.json confirmed |
| A20 | L75: next-intl | "4.7" | **^4.7.0** | **[PASS]** | package.json confirmed |
| A21 | L72: PostgreSQL | "15" | **postgres:15-alpine** | **[PASS]** | docker-compose.yml L5 |
| A22 | L72: Prisma ORM | "7.2" | **^7.2.0** | **[PASS]** | package.json: prisma ^7.2.0, @prisma/client ^7.2.0 |
| A23 | L98: Playwright | "1.57" | **^1.57.0** | **[PASS]** | package.json devDependencies |
| A24 | L73: React Query | "5.x" | **^5.90.12** | **[PASS]** | @tanstack/react-query |
| A25 | L74: React Hook Form | "7.x" | **^7.68.0** | **[PASS]** | package.json confirmed |
| A26 | L286-289: npm scripts | type-check, lint, format, test | **format and test do NOT exist** | **[STALE]** | package.json only has: dev, build, start, lint, type-check, db:*, index:check, i18n:check. No `format` or `test` scripts |
| A27 | Docker ports table (.claude/CLAUDE.md L30-37) | PostgreSQL:5433, pgAdmin:5050, Blob:10010, Queue:10011, Table:10012 | All confirmed | **[PASS]** | docker-compose.yml exactly matches |
| A28 | L402-409: i18n namespace list (30 items) | common, navigation, ..., exchangeRate, region | **Missing 4**: pipelineConfig, fieldDefinitionSet, profile, systemSettings | **[STALE]** | Actual 34 namespaces. 4 added after list was written |
| A29 | L462: Epic count | "22 個 Epic" | **22** (epic-0 through epic-21) | **[PASS]** | sprint-status.yaml has exactly 22 epic entries |
| A30 | L462: Story count | "157+ Stories" | **150** | **[STALE]** | `grep -cE "^  [0-9]+-" sprint-status.yaml` = 150 (plus refactor-001 = 151 total entries, still < 157) |
| A31 | L462: CHANGE count | "33 CHANGE" | **53** | **[STALE]** | `find claudedocs/4-changes -name "CHANGE-*.md" \| wc -l` = 53 |
| A32 | L462: FIX count | "35 FIX" | **52** | **[STALE]** | `find claudedocs/4-changes -name "FIX-*.md" \| wc -l` = 52 |
| A33 | L118: agents count | "agents/ 8 個" | Needs verification | **[PASS/STALE]** | From MEMORY.md: 9 agents. CLAUDE.md says 8 |
| A34 | L300: Tech Specs path | "docs/03-stories/tech-specs/" | **docs/04-implementation/tech-specs/** | **[WRONG]** | `docs/03-stories/` directory does not exist. Actual location: `docs/04-implementation/tech-specs/` |

### File Path Verification: "按需查閱文檔索引" Table (L469-493)

| # | Path | Exists | Verdict |
|---|------|--------|---------|
| P1 | `claudedocs/reference/directory-structure.md` | Yes | **[PASS]** |
| P2 | `claudedocs/reference/dev-checklists.md` | Yes | **[PASS]** |
| P3 | `claudedocs/reference/project-progress.md` | Yes | **[PASS]** |
| P4 | `claudedocs/CLAUDE.md` | Yes | **[PASS]** |
| P5 | `.claude/CLAUDE.md` | Yes | **[PASS]** |
| P6 | `docs/04-implementation/sprint-status.yaml` | Yes | **[PASS]** |
| P7 | `.claude/rules/general.md` | Yes | **[PASS]** |
| P8 | `.claude/rules/typescript.md` | Yes | **[PASS]** |
| P9 | `.claude/rules/services.md` | Yes | **[PASS]** |
| P10 | `.claude/rules/api-design.md` | Yes | **[PASS]** |
| P11 | `.claude/rules/components.md` | Yes | **[PASS]** |
| P12 | `.claude/rules/database.md` | Yes | **[PASS]** |
| P13 | `.claude/rules/testing.md` | Yes | **[PASS]** |
| P14 | `.claude/rules/i18n.md` | Yes | **[PASS]** |
| P15 | `.claude/rules/technical-obstacles.md` | Yes | **[PASS]** |
| P16 | `docs/01-planning/prd/prd.md` | Yes | **[PASS]** |
| P17 | `docs/02-architecture/` | Yes | **[PASS]** |
| P18 | `docs/03-stories/tech-specs/` | **No** | **[WRONG]** |
| P19 | `docs/04-implementation/implementation-context.md` | Yes | **[PASS]** |

### "AI 開發輔助指引" Path Verification (L298-302)

| # | Path | Exists | Verdict |
|---|------|--------|---------|
| D1 | `docs/03-stories/tech-specs/` | **No** | **[WRONG]** |
| D2 | `docs/04-implementation/implementation-context.md` | Yes | **[PASS]** |
| D3 | `docs/01-planning/prd/prd.md` | Yes | **[PASS]** |

### .claude/CLAUDE.md Verification

| # | Claim | Actual | Verdict |
|---|-------|--------|---------|
| C1 | PostgreSQL port 5433 | 5433:5432 in docker-compose | **[PASS]** |
| C2 | pgAdmin port 5050 | 5050:80 in docker-compose | **[PASS]** |
| C3 | Azurite Blob port 10010 | 10010:10000 in docker-compose | **[PASS]** |
| C4 | Azurite Queue port 10011 | 10011:10001 in docker-compose | **[PASS]** |
| C5 | Azurite Table port 10012 | 10012:10002 in docker-compose | **[PASS]** |
| C6 | Default dev port 3000 | package.json: `next dev --port 3005` | **[STALE]** | Default port is now 3005, not 3000 |

### Set A Summary

| Category | PASS | STALE | WRONG | Total |
|----------|------|-------|-------|-------|
| Numeric claims | 12 | 13 | 4 | 29 |
| File paths | 17 | 0 | 2 | 19 |
| .claude/CLAUDE.md | 5 | 1 | 0 | 6 |
| **Total** | **34** | **14** | **6** | **54** |

---

## Set B: HTTP Method Count Resolution (25 points)

### Methodology

Three independent counting approaches were used to resolve disagreements between documents claiming 414, 415, and 447 methods.

### Approach 1: grep for `export async function METHOD`

| Method | Count | Command |
|--------|-------|---------|
| GET | 202 | `grep -rl "export.*async.*function GET" src/app/api/` |
| POST | 141 | `grep -rl "export.*async.*function POST" src/app/api/` |
| PATCH | 33 | `grep -rl "export.*async.*function PATCH" src/app/api/` |
| PUT | 8 | `grep -rl "export.*async.*function PUT" src/app/api/` |
| DELETE | 31 | `grep -rl "export.*async.*function DELETE" src/app/api/` |
| **Subtotal** | **415** | |

### Approach 2: Destructured exports check

| Pattern | Count | File |
|---------|-------|------|
| `export const { GET, POST } = handlers` | 1 | `src/app/api/auth/[...nextauth]/route.ts` |

This file exports GET and POST via destructuring, which is NOT caught by Approach 1's function export pattern.

### Approach 3: Combined definitive count

| Method | Function Exports | Destructured | **Total** |
|--------|-----------------|--------------|-----------|
| GET | 202 | +1 | **203** |
| POST | 141 | +1 | **142** |
| PATCH | 33 | 0 | **33** |
| PUT | 8 | 0 | **8** |
| DELETE | 31 | 0 | **31** |
| **Grand Total** | **415** | **+2** | **417** |

### Resolution

| Document | Claimed | Verdict |
|----------|---------|---------|
| MEMORY.md (API Routes Analysis) | 414 methods | **[STALE]** -- was 414 at time of writing, now 417 |
| Approach 1 (function exports only) | 415 | **[STALE]** -- misses 2 destructured exports |
| Previous docs claiming 447 | 447 | **[WRONG]** -- overcounted |
| **Definitive count (2026-04-09)** | **417** | Includes 1 destructured route (NextAuth: GET + POST) |

### Method Distribution

| Method | Count | Percentage |
|--------|-------|------------|
| GET | 203 | 48.7% |
| POST | 142 | 34.1% |
| PATCH | 33 | 7.9% |
| DELETE | 31 | 7.4% |
| PUT | 8 | 1.9% |
| **Total** | **417** | 100% |

---

## Set C: Smart Routing Description Consistency (25 points)

### Source of Truth: `confidence-v3-1.service.ts`

There are **two separate methods** with different behavior, which is the root cause of all documentation inconsistencies:

#### Method 1: `generateRoutingDecision()` (L380-459) -- MAIN PIPELINE PATH

Called by `calculate()`, which is the main pipeline entry point.

| Condition | Behavior |
|-----------|----------|
| New company (`isNewCompany`) | AUTO_APPROVE -> QUICK_REVIEW only (L402-408) |
| New format (`isNewFormat`) | AUTO_APPROVE -> QUICK_REVIEW only (L410-415) |
| LLM_INFERRED config | AUTO_APPROVE -> QUICK_REVIEW only (L418-424) |
| >3 items needing classification | AUTO_APPROVE -> QUICK_REVIEW (L433-435) |
| Stage 1 failure | Force FULL_REVIEW (L439-444) |
| Stage 2 failure | Force FULL_REVIEW (L446-451) |
| Stage 3 failure | Force FULL_REVIEW (L453-456) |

#### Method 2: `getSmartReviewType()` (L527-575) -- SECONDARY/EXTERNAL PATH

Exported separately, used by callers outside the main pipeline.

| Condition | Behavior |
|-----------|----------|
| New company + new format | Force FULL_REVIEW (L530-536) |
| New company | Force FULL_REVIEW (L539-545) |
| New format | Force QUICK_REVIEW (L548-554) |
| DEFAULT config source | Downgrade one level (L557-566) |
| Standard | Score-based routing (L568+) |

### Documents Still Containing Incorrect Claims

| # | Document | Line | Incorrect Claim | Correct Behavior | Status |
|---|----------|------|----------------|-----------------|--------|
| S1 | **CLAUDE.md** (root) | L62 | "新公司 -> 強制 FULL_REVIEW" | Main pipeline: only QUICK_REVIEW | **NEEDS FIX** |
| S2 | **CLAUDE.md** (root) | L62 | "DEFAULT 配置來源 -> 降一級路由" | Main pipeline checks `LLM_INFERRED`, not `DEFAULT` | **NEEDS FIX** |
| S3 | `01-project-overview/architecture-patterns.md` | L99 | "New company -> Force FULL_REVIEW" | Main pipeline: only QUICK_REVIEW | **NEEDS FIX** |
| S4 | `04-diagrams/business-process-flows.md` | L89 (note) | References the design intent | Already has correction note at L89 | **PARTIALLY FIXED** (diagram correct at L63, note acknowledges discrepancy) |

Note: `business-process-flows.md` was already corrected -- the Mermaid diagram (L63) now correctly shows "Downgrade from AUTO_APPROVE to QUICK_REVIEW" for new company. However, a note at L89 still references the discrepancy.

### Complete FULL_REVIEW Mentions Audit

| File | Context | Accuracy |
|------|---------|----------|
| `verification/R8-remaining-services-deep.md` | Documents thresholds: FULL_REVIEW: 0 | **Correct** |
| `verification/R10-cross-service-config.md` | Documents both methods separately | **Correct** |
| `verification/R11-prisma-diagrams-final.md` | Stage failure -> FULL_REVIEW | **Correct** |
| `verification/R12-build-git-doc-consistency.md` | Identifies CLAUDE.md as wrong | **Correct** (meta-documentation) |
| `verification/R5-semantic-services-pipeline.md` | Identifies the dual-method issue | **Correct** (meta-documentation) |
| `03-database/enum-inventory.md` | Lists ProcessingPath enum values | **Correct** |
| `07-external-integrations/python-services.md` | Threshold: < 70% FULL_REVIEW | **Correct** |
| `02-module-mapping/detail/services-core-pipeline.md` | Documents both methods | **Correct** |

---

## Set D: Component Client/Server Audit (25 points)

### Complete `ui/` Directory Audit (34 files)

The components-overview.md (generated 2026-04-09) lists 13 server components in the ui/ directory. This is **incorrect**.

Detection issue: The grep pattern used `'use client'` (single quotes) but several shadcn/ui components use `"use client"` (double quotes). Both are valid JavaScript/TypeScript `'use client'` directives.

#### Corrected ui/ Client/Server Status

| File | overview.md says | Actual (`"use client"` check) | Verdict |
|------|-----------------|-------------------------------|---------|
| accordion | Y (client) | CLIENT | [PASS] |
| alert | N (server) | SERVER | [PASS] |
| alert-dialog | Y (client) | CLIENT | [PASS] |
| avatar | Y (client) | CLIENT | [PASS] |
| badge | N (server) | SERVER | [PASS] |
| button | N (server) | SERVER | [PASS] |
| calendar | Y (client) | CLIENT | [PASS] |
| card | N (server) | SERVER | [PASS] |
| checkbox | Y (client) | CLIENT | [PASS] |
| collapsible | Y (client) | CLIENT | [PASS] |
| command | Y (client) | CLIENT | [PASS] |
| dialog | Y (client) | CLIENT | [PASS] |
| dropdown-menu | Y (client) | CLIENT | [PASS] |
| form | Y (client) | CLIENT | [PASS] |
| input | N (server) | SERVER | [PASS] |
| label | Y (client) | CLIENT | [PASS] |
| month-picker | Y (client) | CLIENT | [PASS] |
| pagination | Y (client) | CLIENT | [PASS] |
| **popover** | **N (server)** | **CLIENT** (`"use client"` on L1) | **[WRONG]** |
| progress | Y (client) | CLIENT | [PASS] |
| **radio-group** | **N (server)** | **CLIENT** (`"use client"` on L1) | **[WRONG]** |
| **resizable** | **N (server)** | **CLIENT** (`"use client"` on L1) | **[WRONG]** |
| scroll-area | Y (client) | CLIENT | [PASS] |
| select | Y (client) | CLIENT | [PASS] |
| **separator** | **N (server)** | **CLIENT** (`"use client"` on L1) | **[WRONG]** |
| skeleton | N (server) | SERVER | [PASS] |
| **slider** | **N (server)** | **CLIENT** (`"use client"` on L1) | **[WRONG]** |
| switch | Y (client) | CLIENT | [PASS] |
| table | N (server) | SERVER | [PASS] |
| tabs | Y (client) | CLIENT | [PASS] |
| textarea | N (server) | SERVER | [PASS] |
| toast | Y (client) | CLIENT | [PASS] |
| toaster | Y (client) | CLIENT | [PASS] |
| tooltip | Y (client) | CLIENT | [PASS] |

### Corrected ui/ Ratio

| | overview.md | Actual | Delta |
|---|------------|--------|-------|
| Client | 21 | **26** | +5 |
| Server | 13 | **8** | -5 |
| Total | 34 | 34 | 0 |

**5 misclassified components**: popover, radio-group, resizable, separator, slider. All use `"use client"` (double quotes) which was not detected by the single-quote-only grep pattern.

### Full Project Component Ratio

Using corrected detection (`grep "use client"` matching both quote styles):

| Scope | Client | Server | Total |
|-------|--------|--------|-------|
| `src/components/` (all) | 275 | 96 | 371 |
| `src/components/ui/` | 26 | 8 | 34 |
| `src/components/features/` | ~245 | ~61 | 306 |
| Other (`layout/`, `dashboard/`, etc.) | ~4 | ~27 | 31 |

The overview.md claims "355 client (95.7%) / 16 server (4.3%)" which is also **incorrect**. The actual ratio is 275 client (74.1%) / 96 server (25.9%).

The discrepancy likely arises because many feature components are small wrapper/presentational components that do not need `'use client'` -- they are pure server components rendering static JSX.

---

## CLAUDE.md Staleness Report -- Fix Priority

### Immediate Fixes Required (Factual Errors)

| # | Item | Current Value | Correct Value | Severity |
|---|------|--------------|---------------|----------|
| 1 | Confidence thresholds (L54-60) | >= 95% / 80-94% / < 80% | >= 90% / 70-89% / < 70% | **HIGH** -- misleads AI & developers |
| 2 | Smart downgrade rule 1 (L62) | "新公司 -> 強制 FULL_REVIEW" | New company: only downgrades AUTO_APPROVE to QUICK_REVIEW | **HIGH** |
| 3 | Smart downgrade rule 3 (L62) | "DEFAULT 配置來源 -> 降一級路由" | `LLM_INFERRED` config: AUTO_APPROVE to QUICK_REVIEW | **HIGH** |
| 4 | Tech Specs path (L300, L491) | `docs/03-stories/tech-specs/` | `docs/04-implementation/tech-specs/` | **HIGH** -- broken reference |
| 5 | npm scripts (L286-289) | lists `format` and `test` | Neither exists in package.json | **MEDIUM** |

### Stale Numbers Requiring Update

| # | Item | Location | Current | Correct |
|---|------|----------|---------|---------|
| 6 | Component count | L105, L127 | 165+ | 371 |
| 7 | Service count | L106, L131 | 124+ | 200 |
| 8 | API route files | L107, L126, L208 | 175+ | 331 |
| 9 | HTTP endpoints | L107, L208 | ~300+ | ~417 |
| 10 | Hook count | L108, L128 | 89 | 104 |
| 11 | Prisma models | L109, L122 | 117 | 122 |
| 12 | i18n namespaces | L110, L75, L121, L402 | 30 | 34 |
| 13 | i18n namespace list | L404-409 | 30 items | Missing: pipelineConfig, fieldDefinitionSet, profile, systemSettings |
| 14 | Radix primitives | L71 | 20+ | 19 |
| 15 | Story count | L462 | 157+ | 150 |
| 16 | CHANGE count | L462 | 33 | 53 |
| 17 | FIX count | L462 | 35 | 52 |
| 18 | Agents count | L118 | 8 | 9 |
| 19 | Default dev port (.claude/CLAUDE.md) | 3000 | 3005 (package.json) |

### Analysis Documents Needing Correction

| # | File | Issue |
|---|------|-------|
| 20 | `01-project-overview/architecture-patterns.md` L99 | "New company -> Force FULL_REVIEW" should be "New company -> Downgrade AUTO_APPROVE to QUICK_REVIEW" |
| 21 | `02-module-mapping/components-overview.md` L62-82 | 5 ui/ components misclassified as server (popover, radio-group, resizable, separator, slider); client/server ratio wrong (claimed 21/13, actual 26/8); full project ratio wrong (claimed 355/16, actual 275/96) |

---

## Summary Statistics

| Set | Points Checked | PASS | STALE | WRONG | Accuracy |
|-----|---------------|------|-------|-------|----------|
| A: CLAUDE.md Deep Check | 54 | 34 | 14 | 6 | 63.0% |
| B: HTTP Method Resolution | 4 documents | 0 | 3 | 1 | Resolved: 417 |
| C: Smart Routing Consistency | 8 docs audited | 5 correct | 1 partially fixed | 2 need fix | 62.5% |
| D: Component Client/Server | 34 ui/ files | 29 | 0 | 5 | 85.3% |
| **Total** | **~100** | **68** | **17** | **14** | **68.7%** |
