# R17: Second Gap Analysis — Non-src Project Content

**Date**: 2026-04-09
**Scope**: ALL non-src directories and files in the project
**Prior Coverage**: R16 gap analysis covered src/ (90%+), created scripts-inventory.md, developer-tooling.md, ai-dev-infrastructure.md
**Purpose**: Map every non-src area, determine analysis coverage, identify remaining gaps

---

## 1. Complete Non-src Filesystem Map

### 1A. Directory-Level File Counts

| Directory | Files | Est. LOC | In Analysis? | Primary Analysis Doc |
|-----------|-------|----------|-------------|---------------------|
| `docs/` | 642 | ~120K+ | Mixed | See Section 2 breakdown |
| `.bmad/` | 463 | ~40K+ | No (out of scope) | `ai-dev-infrastructure.md` mentions only |
| `claudedocs/` | 299 | ~30K+ | No (not analyzed) | `ai-dev-infrastructure.md` mentions only |
| `.next/` | 283 | — | N/A (build output) | N/A |
| `claudedocs_sample/` | 254 | ~25K+ | No | Not referenced anywhere |
| `.playwright-mcp/` | 122 | — | N/A (ephemeral) | N/A |
| `scripts/` | 116 | ~27,767 | **YES** | `scripts-inventory.md` (R16 created) |
| `messages/` | 103 | ~18K | **YES** | `i18n-coverage.md` |
| `.claude/` | 79 | ~8K | **YES** | `ai-dev-infrastructure.md` (R16 created) |
| `prisma/` | 23 | ~10K+ | Partial | `prisma-model-inventory.md`, `migration-history.md` |
| `python-services/` | 18 | ~2,719 | **YES** | `python-services.md` |
| `.github/` | 11 | ~200 | No (out of scope) | Mentioned in R16 gap analysis |
| `exports/` | 9 | — | N/A (test artifacts) | N/A |
| `tests/` | 4 | ~100 | **YES** | `testing-infrastructure.md` |
| `public/` | 3 | 0 | N/A (empty) | N/A |
| `.vscode/` | 3 | ~17K | **YES** | `developer-tooling.md` (R16 created) |
| `openapi/` | 1 | 1,067 | No | Mentioned in R16 gap analysis |
| `bmad-custom-src/` | 1 | ~20 | No (out of scope) | N/A |
| **Root files** | 51 | ~4K+ | Partial | `developer-tooling.md` (config files only) |
| **TOTAL** | **2,485** | — | — | — |

### 1B. CLAUDE.md Files Scattered Across Project (16 total)

| Path | Lines | Analyzed? |
|------|-------|-----------|
| `./CLAUDE.md` (root) | 550+ | YES -- `ai-dev-infrastructure.md` |
| `.claude/CLAUDE.md` | ~200 | YES -- `ai-dev-infrastructure.md` |
| `claudedocs/CLAUDE.md` | 395 | NO |
| `claudedocs_sample/CLAUDE.md` | unknown | NO |
| `messages/CLAUDE.md` | unknown | NO |
| `prisma/CLAUDE.md` | unknown | NO |
| `scripts/CLAUDE.md` | unknown | NO |
| `src/app/[locale]/CLAUDE.md` | unknown | NO |
| `src/app/api/CLAUDE.md` | unknown | NO |
| `src/components/CLAUDE.md` | unknown | NO |
| `src/hooks/CLAUDE.md` | unknown | NO |
| `src/i18n/CLAUDE.md` | unknown | NO |
| `src/lib/CLAUDE.md` | unknown | NO |
| `src/services/CLAUDE.md` | unknown | NO |
| `src/services/extraction-v3/CLAUDE.md` | unknown | NO |
| `src/types/CLAUDE.md` | unknown | NO |

**Finding**: `ai-dev-infrastructure.md` documented 2 CLAUDE.md files but mentioned "16 per-directory CLAUDE.md files" existed. The content of 14 per-directory CLAUDE.md files has never been inventoried.

---

## 2. Detailed Breakdown: docs/ Directory (642 files)

### 2A. docs/ Subdirectory Map

| Directory | Files | Content Type | LOC (key files) | Analyzed? |
|-----------|-------|-------------|-----------------|-----------|
| `docs/00-discovery/` | 8 | Requirements discovery, past discussions, product brief | ~2K | NO |
| `docs/01-planning/` | 27 | PRD (1,669 LOC), UX design spec (14 sections) | ~8K | NO |
| `docs/02-architecture/` | 11 | Architecture doc (1,207 LOC), confidence thresholds, tier-3 LLM assessment | ~5K | NO |
| `docs/02-solutioning/` | 1 | README placeholder | ~5 | N/A (empty) |
| `docs/03-epics/` | 23 | Epic definitions (3,331 LOC combined), all 16 epics + overview sections | ~8K | NO |
| `docs/04-implementation/` | 315 | Stories (155), tech-specs (150), sprint-status.yaml (327), registries, context | ~80K+ | NO |
| `docs/05-analysis/` | 29 | Prior architecture analyses (9 ARCH reports), 3 analysis suites, samples | ~25K | NO |
| `docs/06-codebase-analyze/` | 84 | **This analysis effort** (31 analysis + 4 R16 + 49 verification) | ~100K | YES (self) |
| `docs/Doc template/` | 1 | Excel import template | — | N/A (binary) |
| `docs/MIGRATION-GUIDE.md` | 1 | Database migration guide | unknown | NO |

### 2B. docs/04-implementation/ Deep Breakdown (315 files)

| Subdirectory | Files | Content |
|-------------|-------|---------|
| `stories/` | 155 | Story implementation docs for Epics 0-21 (22 epics) |
| `tech-specs/` | 150 | Technical specifications per story |
| `prompt-templates/` | 3 | AI prompt templates for story development |
| Root files | 7 | api-registry.md (989 LOC), component-registry.md (253 LOC), implementation-context.md (465 LOC), lessons-learned.md (305 LOC), dev-checklist.md (258 LOC), sprint-status.yaml (327 LOC), tech-spec-sprint-1.md |

**Notable**: `sprint-status.yaml` is referenced in CLAUDE.md as "唯一真實來源" (single source of truth) for project progress.

### 2C. docs/05-analysis/ Breakdown (29 files)

| Subdirectory | Files | Content |
|-------------|-------|---------|
| Root (timestamped ARCH reports) | 9 | Architecture analyses dated 2026-01-30 to 2026-02-25, covering extraction v2/v3 comparison, unified processor refactoring, field definition closed-loop, line-item pivot design |
| `latest-overview/` | 9 | AIDE Architecture Analysis V1, Features Mapping, E2E Flow Tracing, Design Decisions, Security Quality, Recommendations |
| `latest-overview-20260302/` | 4 | Deep analysis report (ZH), action plan, .docx export |
| `overview/` | 3 | System architecture overview, features mapping, data flow analysis (2026-02-13) |
| `sample/` | 2 | MAF Claude Hybrid Architecture V7, Features Mapping V7 |
| `README.md` | 1 | Index |

---

## 3. Detailed Breakdown: claudedocs/ Directory (299 files)

### 3A. claudedocs/ Subdirectory Map

| Directory | Files | Content | Analyzed? |
|-----------|-------|---------|-----------|
| `claudedocs/7-archive/` | 130 | Legacy project files from another project (FEAT-001~005, AZURE-DEPLOY-PREP, epic-9, handoff, testing templates) | NO |
| `claudedocs/4-changes/` | 105 | **52 FIX docs + 53 CHANGE docs** -- the active change management system | NO |
| `claudedocs/5-status/` | 30 | 3 test plans + 27 test reports (md, json, xlsx) + TESTING-FRAMEWORK.md | NO |
| `claudedocs/1-planning/` | 20 | 18 epic overviews (epic-0 through epic-16) + 1 story + 1 plan doc + 1 e2e pipeline plan | NO |
| `claudedocs/6-ai-assistant/` | 8 | 7 SITUATION prompts + 1 analysis doc | **YES** (mentioned in `ai-dev-infrastructure.md`) |
| `claudedocs/reference/` | 3 | dev-checklists.md (108 LOC), directory-structure.md (178 LOC), project-progress.md (81 LOC) | NO |
| `claudedocs/CLAUDE.md` | 1 | Index for all claudedocs (395 LOC) | NO |
| `claudedocs/8-conversation-log/` | 1 | Session log | NO |
| `claudedocs/3-progress/` | 0 | Empty (progress reports) | N/A |
| `claudedocs/2-sprints/` | 0 | Empty (sprint tracking) | N/A |

### 3B. CHANGE/FIX Document Counts (Verified)

| Type | Count | Location | Content Format |
|------|-------|----------|---------------|
| CHANGE-001 through CHANGE-053 | **53** | `claudedocs/4-changes/feature-changes/` | Feature change planning docs |
| FIX-001 through FIX-049 | **52** | `claudedocs/4-changes/bug-fixes/` | Bug fix planning docs (includes b-suffix variants: 019b, 024b, 026b) |
| **Total** | **105** | — | — |

**CLAUDE.md Claim**: "累計 33 CHANGE + 35 FIX" -- **STALE**. Actual counts: 53 CHANGE + 52 FIX = 105 total.

### 3C. claudedocs_sample/ (254 files) -- Separate Directory

This appears to be a copy/fork of `claudedocs/7-archive/sample-project-files/` content. It contains legacy project documentation from a different project (FEAT-001~005, AZURE-DEPLOY-PREP, epic-9 architecture). This is **not referenced** by any analysis document or project configuration.

---

## 4. Detailed Breakdown: prisma/ Directory (23 files)

| Item | Count | LOC | Analyzed? | Analysis Doc |
|------|-------|-----|-----------|-------------|
| `schema.prisma` | 1 | 4,354 | **YES** | `prisma-model-inventory.md` |
| `migrations/` (10 dirs + lock) | 11 | ~958 SQL | PARTIAL | `migration-history.md` (listed, SQL not deep-analyzed) |
| `seed.ts` | 1 | ~1,456 | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `seed-data/` (7 files) | 7 | ~2,236 | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `seed/exported-data.json` | 1 | 4,428 | **NO** | Not analyzed anywhere |
| `sql/audit_log_immutability.sql` | 1 | ~100 | **NO** | Not analyzed anywhere |
| `CLAUDE.md` | 1 | unknown | **NO** | Not inventoried |

---

## 5. Detailed Breakdown: .github/ Directory (11 files)

All 11 files are GitHub Copilot agent definitions in `.github/agents/`:

| File | Content |
|------|---------|
| `bmd-custom-bmb-bmad-builder.agent.md` | BMAD Builder Copilot agent |
| `bmd-custom-bmm-analyst.agent.md` | Analyst Copilot agent |
| `bmd-custom-bmm-architect.agent.md` | Architect Copilot agent |
| `bmd-custom-bmm-dev.agent.md` | Developer Copilot agent |
| `bmd-custom-bmm-pm.agent.md` | Product Manager Copilot agent |
| `bmd-custom-bmm-quick-flow-solo-dev.agent.md` | Quick-flow Solo Dev Copilot agent |
| `bmd-custom-bmm-sm.agent.md` | Scrum Master Copilot agent |
| `bmd-custom-bmm-tea.agent.md` | TEA (Test Engineering Architect) Copilot agent |
| `bmd-custom-bmm-tech-writer.agent.md` | Tech Writer Copilot agent |
| `bmd-custom-bmm-ux-designer.agent.md` | UX Designer Copilot agent |
| `bmd-custom-core-bmad-master.agent.md` | BMAD Master Copilot agent |

**Status**: OUT OF SCOPE -- auto-generated BMAD framework integration, ~17 lines each.

---

## 6. Root-Level Files (51 files)

### 6A. Analyzed Files (14 config files)

All documented in `developer-tooling.md` (R16 created):

| File | Lines | Content |
|------|-------|---------|
| `CLAUDE.md` | 550+ | Master project instructions |
| `next.config.ts` | 59 | Next.js configuration |
| `tailwind.config.ts` | 85 | Tailwind CSS theme |
| `tsconfig.json` | 42 | TypeScript compiler options |
| `docker-compose.yml` | 101 | Docker services |
| `components.json` | 20 | shadcn/ui registry |
| `.eslintrc.json` | 12 | ESLint rules |
| `.prettierrc` | 10 | Prettier formatting |
| `postcss.config.mjs` | 9 | PostCSS config |
| `prisma.config.ts` | 15 | Prisma config |
| `package.json` | ~130 | Dependencies + scripts |
| `.gitignore` | 81 | Git ignore patterns |
| `.env.example` | ~40 | Environment template |
| `next-env.d.ts` | 6 | Next.js env types |

### 6B. Unanalyzed but Tracked Files

| File | Content | Priority |
|------|---------|----------|
| `AI-ASSISTANT-GUIDE.md` | Legacy AI assistant guide (predates CLAUDE.md) | LOW |
| `INDEX-MAINTENANCE-GUIDE.md` | Barrel export maintenance guide | LOW |
| `PROJECT-INDEX.md` | Project index/overview | LOW |
| `CLAUDE_backup.md` | Backup of older CLAUDE.md version | SKIP |
| `CLAUDE_backup_v2.6.0_20260209.md` | Versioned CLAUDE.md backup | SKIP |

### 6C. Untracked Artifacts (should be .gitignore'd)

| Category | Count | Files |
|----------|-------|-------|
| Session conversation logs (.txt) | 9 | `2026-02-*-local-command-*.txt`, `conversation-*.txt`, `2026-02-*-this-session-*.txt` |
| Screenshots (.png) | 7 | `after-*.png`, `change-*.png`, `fix044-*.png`, `template-instance-detail.png` |
| Excel reports (.xlsx) | 2 | `FIX-002-report.xlsx`, `hierarchical-terms-report.xlsx` |
| Temp data files | 4 | `batch-result.json`, `temp_query.ts`, `temp_response.json`, `Usersrci...temp_configs.json` |
| Windows artifacts | 2 | `nul`, `processingSteps` |
| Build artifacts | 1 | `tsconfig.tsbuildinfo` |

---

## 7. Coverage Matrix Summary

### 7A. Non-src Areas: Analysis Coverage Status

| Area | Files | Coverage | Analysis Doc(s) |
|------|-------|----------|----------------|
| **scripts/** | 116 | **FULL** | `scripts-inventory.md` (R16) |
| **messages/** | 103 | **FULL** | `i18n-coverage.md` |
| **python-services/** | 18 | **FULL** | `python-services.md` |
| **.claude/** | 79 | **FULL** | `ai-dev-infrastructure.md` (R16) |
| **.vscode/** | 3 | **FULL** | `developer-tooling.md` (R16) |
| **Root config files** | 14 | **FULL** | `developer-tooling.md` (R16) |
| **tests/** | 4 | **FULL** | `testing-infrastructure.md` |
| **prisma/schema** | 1 | **FULL** | `prisma-model-inventory.md` |
| **prisma/enums** | (in schema) | **FULL** | `enum-inventory.md` |
| **prisma/migrations** | 11 | **PARTIAL** | `migration-history.md` (listed, SQL not deep) |
| **prisma/seed** | 8 | **VERIFICATION-ONLY** | `R14-css-constants-seed.md` |
| **prisma/sql** | 1 | **UNCOVERED** | — |
| **prisma/CLAUDE.md** | 1 | **UNCOVERED** | — |
| **openapi/spec.yaml** | 1 | **UNCOVERED** | R16 noted gap, not yet addressed |
| **claudedocs/ (4-changes)** | 105 | **UNCOVERED** | Change management docs never inventoried |
| **claudedocs/ (5-status)** | 30 | **UNCOVERED** | Test reports never inventoried |
| **claudedocs/ (1-planning)** | 20 | **UNCOVERED** | Epic planning docs never inventoried |
| **claudedocs/ (7-archive)** | 130 | **UNCOVERED** (low priority) | Legacy docs from another project |
| **claudedocs/ (reference)** | 3 | **UNCOVERED** | AI reference materials |
| **claudedocs/ (CLAUDE.md)** | 1 | **UNCOVERED** | Claudedocs index file |
| **claudedocs_sample/** | 254 | **UNCOVERED** (skip) | Duplicate of archive content |
| **docs/00-discovery/** | 8 | **UNCOVERED** | Requirements discovery |
| **docs/01-planning/** | 27 | **UNCOVERED** | PRD + UX design |
| **docs/02-architecture/** | 11 | **UNCOVERED** | Architecture decisions |
| **docs/03-epics/** | 23 | **UNCOVERED** | Epic definitions |
| **docs/04-implementation/** | 315 | **UNCOVERED** | Stories + tech-specs + registries |
| **docs/05-analysis/** | 29 | **UNCOVERED** | Prior architecture analysis reports |
| **docs/MIGRATION-GUIDE.md** | 1 | **UNCOVERED** | DB migration guide |
| **.bmad/** | 463 | OUT OF SCOPE | Third-party framework |
| **.github/agents/** | 11 | OUT OF SCOPE | Auto-generated configs |
| **public/** | 3 | N/A | Empty placeholders |
| **.next/** | 283 | N/A | Build output |
| **.playwright-mcp/** | 122 | N/A | Ephemeral artifacts |
| **exports/** | 9 | N/A | Test artifacts |
| **Root artifacts** | 25 | N/A | Temp files, should be gitignored |
| **Per-directory CLAUDE.md** | 14 | **UNCOVERED** | Local AI context files |

### 7B. Coverage Score by Category

| Category | Items | Fully | Partial | Verif-Only | Uncovered | Score |
|----------|-------|-------|---------|------------|-----------|-------|
| Source code (src/) | 19 dirs | 8 | 5 | 5 | 1 | **90%** |
| Database (prisma/) | 6 areas | 2 | 1 | 1 | 2 | **55%** |
| Infrastructure (scripts, python, tests) | 4 | 3 | 0 | 0 | 1 | **93%** |
| Config & tooling | 3 areas | 3 | 0 | 0 | 0 | **100%** |
| i18n (messages/) | 1 | 1 | 0 | 0 | 0 | **100%** |
| AI infrastructure (.claude/) | 1 | 1 | 0 | 0 | 0 | **100%** |
| Project docs (docs/00-05) | 7 dirs | 0 | 0 | 0 | 7 | **0%** |
| claudedocs/ | 8 subdirs | 0 | 1 | 0 | 7 | **6%** |
| OpenAPI | 1 | 0 | 0 | 0 | 1 | **0%** |
| Per-directory CLAUDE.md | 14 files | 0 | 0 | 0 | 14 | **0%** |

---

## 8. Prioritized Remaining Gaps

### PRIORITY HIGH -- Warrants New Analysis

#### GAP-H1: docs/04-implementation/ — Story & Tech-Spec Inventory
- **Size**: 315 files (~80K+ LOC)
- **Content**: 155 story implementation docs across 22 epics, 150 tech-specs, sprint-status.yaml (single source of truth), api-registry.md (989 LOC), component-registry.md (253 LOC), implementation-context.md (465 LOC), lessons-learned.md (305 LOC)
- **Why Important**: This is the most extensive documentation directory. The stories and tech-specs are the development blueprints that shaped every line of code in src/. Cross-referencing these against actual implementation would reveal specification drift and unfulfilled requirements.
- **Recommendation**: **New analysis doc** -- `docs/06-codebase-analyze/10-project-docs/implementation-docs-inventory.md` -- inventory stories by epic, identify tech-spec coverage, flag any specification-to-implementation drift for critical features.

#### GAP-H2: claudedocs/4-changes/ — CHANGE/FIX Document Inventory
- **Size**: 105 files (53 CHANGE + 52 FIX)
- **Content**: The complete change management history of the project since Phase 2. Each file contains: problem description, impact analysis, implementation plan, status, and related files.
- **Why Important**: These documents are the operational log of the project's evolution. They connect bugs to root causes, features to business requirements, and track the status of every change. CLAUDE.md's claim of "33 CHANGE + 35 FIX" is significantly stale (actual: 53+52=105).
- **Recommendation**: **New analysis doc** -- `docs/06-codebase-analyze/10-project-docs/change-management-inventory.md` -- full inventory with statuses, categorization by area (pipeline, UI, i18n, database, etc.), completion rate, and cross-reference to affected src/ files.

#### GAP-H3: openapi/spec.yaml — API Contract Drift Analysis
- **Size**: 1 file, 1,067 lines
- **Content**: OpenAPI 3.0 specification defining the formal API contract
- **Why Important**: This should be the authoritative API definition. Drift between spec and actual 331 route files creates integration risks. R16 noted this gap but did not address it.
- **Recommendation**: **Fold into** `02-module-mapping/api-routes-overview.md` -- add a section cross-referencing OpenAPI spec endpoints against actual route files, identifying undocumented endpoints and spec-only endpoints.

### PRIORITY MEDIUM -- Completes the Picture

#### GAP-M1: docs/01-planning/ + docs/02-architecture/ — Design Document Inventory
- **Size**: 38 files (27 planning + 11 architecture)
- **Content**: PRD (1,669 LOC, 10 sections), UX Design Specification (14 sections), Architecture Document (1,207 LOC, 8 sections), confidence thresholds design, tier-3 LLM assessment
- **Why Important**: These are the foundational design documents. Cross-referencing PRD requirements against actual features would reveal completeness. Architecture doc confidence thresholds (95%/80%) are known to differ from code (90%/70%) -- per MEMORY.md.
- **Recommendation**: **New analysis doc** -- `docs/06-codebase-analyze/10-project-docs/design-docs-inventory.md` -- inventory with key claims extracted, flagging known discrepancies between design docs and implementation.

#### GAP-M2: docs/05-analysis/ — Prior Analysis Cross-Reference
- **Size**: 29 files across 4 subdirectories + root
- **Content**: Architecture analyses from 2026-01-30 to 2026-03-02, including AIDE Deep Analysis Report, extraction v2/v3 comparisons, and field definition feasibility studies
- **Why Important**: These prior analyses contain institutional knowledge and different analytical perspectives. Some findings may overlap or conflict with the current 06-codebase-analyze/ effort.
- **Recommendation**: **Fold into** `00-analysis-index.md` -- add a "Prior Analysis Reports" section with brief summary of each, noting which findings have been superseded by the current analysis.

#### GAP-M3: Per-Directory CLAUDE.md Files (14 files)
- **Size**: 14 files scattered in src/ subdirectories + messages/ + prisma/ + scripts/
- **Content**: Local context instructions for AI assistants working in specific directories
- **Why Important**: These files shape how AI assistants interact with each codebase area. They may contain rules or conventions not captured in the main `.claude/rules/` files.
- **Recommendation**: **Fold into** `01-project-overview/ai-dev-infrastructure.md` -- add a section inventorying all 16 CLAUDE.md files with their key directives.

#### GAP-M4: claudedocs/5-status/ — Test Report Inventory
- **Size**: 30 files (3 test plans, 27 test reports in md/json/xlsx formats)
- **Content**: Testing plans (TEST-PLAN-001 to 003), test reports for various CHANGEs (CHANGE-005, 010, 024), Epic-0 comprehensive E2E reports, UAT report for Epic-18, TESTING-FRAMEWORK.md
- **Recommendation**: **Fold into** `09-testing/testing-infrastructure.md` -- add a section documenting the manual/semi-automated test history preserved in claudedocs.

#### GAP-M5: prisma/seed + prisma/sql — Complete Database Auxiliary Analysis
- **Size**: `seed.ts` (1,456 LOC) + `seed-data/` (7 files, 2,236 LOC) + `exported-data.json` (4,428 lines) + `audit_log_immutability.sql` (~100 LOC)
- **Content**: Complete database seeding logic and a PostgreSQL trigger for audit log immutability
- **Why Important**: R16 identified this gap. Seed data defines baseline system state. The SQL trigger is a security-critical constraint not visible in Prisma schema.
- **Recommendation**: **New analysis doc** -- `docs/06-codebase-analyze/03-database/seed-data-analysis.md` (as R16 recommended, not yet created)

### PRIORITY LOW -- Can Be Ignored

#### GAP-L1: docs/00-discovery/ (8 files)
Past discussion notes and product brief. Historical context only. Not actionable for codebase analysis.

#### GAP-L2: docs/03-epics/ (23 files)
Epic definitions with 3,331 LOC. Duplicate of information in docs/04-implementation/stories/. The stories are the more detailed and authoritative source.

#### GAP-L3: claudedocs/1-planning/ (20 files)
Epic overview docs (18 files) -- parallel to docs/03-epics/ content. Planning artefacts, not codebase.

#### GAP-L4: claudedocs/7-archive/ (130 files)
Legacy project files from another project (FEAT-001~005 from a different system). Not relevant to current codebase analysis.

#### GAP-L5: claudedocs_sample/ (254 files)
Appears to be a copy of claudedocs/7-archive/sample-project-files/. **Cleanup candidate** -- should be removed or gitignored.

#### GAP-L6: claudedocs/reference/ (3 files)
dev-checklists.md, directory-structure.md, project-progress.md -- operational reference docs for AI assistant usage, not codebase content.

#### GAP-L7: Root-level artifacts (25+ files)
Session logs, screenshots, temp files. **Cleanup candidate** -- should be gitignored.

---

## 9. CLAUDE.md Accuracy Check (Non-src Claims)

| Claim in CLAUDE.md | Actual | Status |
|--------------------|--------|--------|
| "157+ Stories" | 155 story files in docs/04-implementation/stories/ | CLOSE (within rounding) |
| "累計 33 CHANGE + 35 FIX" | 53 CHANGE + 52 FIX = 105 | **STALE** -- should be 53+52 |
| "22 個 Epic" | 22 epic subdirs in stories/ | CORRECT |
| "Prisma Models 117" | 122 models (per analysis-index.md) | **STALE** -- should be 122 |
| "i18n 命名空間 30/語言" | 34/語言 (per MEMORY.md) | **STALE** -- should be 34 |
| "i18n JSON files 102" | 103 files (34x3=102 in namespaces + 1 CLAUDE.md) | CORRECT (102 JSON + 1 md) |
| "API 路由 175 files ~300 端點" | 331 route files, 414 HTTP methods | **STALE** -- significantly grown |
| "React 組件 165+" | 371 files (per analysis-index.md) | **STALE** -- should be 371 |
| "Hooks 89" | 104 (per analysis-index.md) | **STALE** -- should be 104 |
| "業務服務 124+" | 200 (per analysis-index.md) | **STALE** -- should be 200 |

**Observation**: CLAUDE.md code scale metrics are severely outdated. The project has roughly doubled in size since those numbers were written.

---

## 10. Summary Statistics

### What R16 Created (Previously Missing)

| New Doc | Covers | Status |
|---------|--------|--------|
| `scripts-inventory.md` | 116 scripts, 27,767 LOC | COMPLETE |
| `developer-tooling.md` | Root configs, VS Code, npm scripts, build pipeline | COMPLETE |
| `ai-dev-infrastructure.md` | .claude/ rules, agents, skills, CLAUDE.md hierarchy | COMPLETE |

### What R17 Identified as Still Missing

| Priority | Gap | Est. Files Uncovered | Recommendation |
|----------|-----|---------------------|----------------|
| HIGH | docs/04-implementation/ inventory | 315 files | New analysis doc |
| HIGH | CHANGE/FIX inventory | 105 files | New analysis doc |
| HIGH | OpenAPI spec drift | 1 file | Fold into existing |
| MEDIUM | Design docs inventory | 38 files | New analysis doc |
| MEDIUM | Prior analysis cross-ref | 29 files | Fold into existing |
| MEDIUM | Per-directory CLAUDE.md | 14 files | Fold into existing |
| MEDIUM | Test report inventory | 30 files | Fold into existing |
| MEDIUM | Seed data + SQL analysis | 10 files | New analysis doc (R16 recommended) |
| LOW | Discovery docs, epics, archive, sample, reference | 436 files | Skip or note only |
| N/A | Build output, ephemeral artifacts, cleanup targets | ~430 files | N/A |

### Overall Non-src Analysis Coverage

| Metric | Value |
|--------|-------|
| Total non-src files (excl. build/.next) | ~2,200 |
| Fully analyzed | ~340 (scripts + messages + python + .claude + .vscode + configs + tests) |
| Partially analyzed | ~35 (prisma migrations, seed) |
| Uncovered (meaningful) | ~577 (docs/00-05 + claudedocs active + OpenAPI + per-dir CLAUDE.md) |
| Uncovered (low priority) | ~436 (archive, sample, discovery, epics duplicates) |
| Out of scope / ephemeral | ~810 (.bmad + .github + .next + .playwright + exports + root artifacts) |
| **Meaningful coverage rate** | **~40%** of non-src content (340+35 of 952 meaningful files) |

**Key Insight**: While src/ code analysis is at 90%+, non-src content analysis is at approximately 40%. The largest meaningful gaps are in project documentation (docs/00-05, 414 files) and change management (claudedocs/4-changes, 105 files). These areas are documentation rather than code, so the gap is less critical for understanding system behavior but important for understanding design intent and project history.

---

## 11. Recommendations

### Immediate Actions

1. **Update CLAUDE.md code scale metrics** -- the counts are severely stale and misleading for any AI assistant reading them
2. **Create seed-data-analysis.md** -- R16 recommended this and it's still pending
3. **Add OpenAPI drift section to api-routes-overview.md** -- quick check of spec vs actual routes

### If Deeper Documentation Analysis is Desired

4. Create `10-project-docs/change-management-inventory.md` -- inventory all 105 CHANGE/FIX docs
5. Create `10-project-docs/implementation-docs-inventory.md` -- map 315 implementation files
6. Extend `ai-dev-infrastructure.md` with per-directory CLAUDE.md inventory

### Cleanup Recommendations

7. Add `claudedocs_sample/` to `.gitignore` (254 duplicate files)
8. Move root-level screenshots, session logs, temp files to a dedicated `.artifacts/` directory or `.gitignore` them
9. Review `docs/02-solutioning/` (contains only an empty README)
