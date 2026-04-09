# R16: Codebase Coverage Gap Analysis

**Date**: 2026-04-09
**Scope**: Systematic scan of every directory and file area in the project vs. the 31 analysis documents + 45 verification reports
**Purpose**: Identify codebase areas that are NOT covered by any existing analysis document

---

## 1. Complete Filesystem Map

### Top-Level Directories

| Directory | File Count | Est. LOC | Description |
|-----------|-----------|----------|-------------|
| `src/` | 1,363+ | ~136,000 | Main application source code |
| `prisma/` | 15+ files + 10 migrations | ~5,400 + 958 SQL | Database schema, seed, migrations |
| `scripts/` | 106 files + 1 subdir | ~23,122 | Utility/debug/test/admin scripts |
| `messages/` | 102 JSON (34/lang) | — | i18n translation files |
| `python-services/` | 12 files | ~2,719 | Python OCR + Mapping microservices |
| `tests/` | 4 files (3 gitkeep + 1 test) | ~100 | Formal test directory (mostly empty) |
| `public/` | 3 gitkeep files | 0 | Static assets (empty placeholder) |
| `docs/` | 100+ files | — | Project documentation (01–06) |
| `claudedocs/` | ~299 files | — | AI assistant documentation |
| `.claude/` | 82 files | — | Claude Code config (rules/agents/skills/commands) |
| `.bmad/` | 463 files | — | BMAD framework |
| `.github/` | 11 agent files | ~187 | GitHub Copilot agent definitions |
| `.vscode/` | 3 files | ~17,700 | VS Code workspace settings + snippets |
| `openapi/` | 1 file | 1,067 | OpenAPI specification |
| `exports/` | 11 xlsx files | — | Export test artifacts |
| `bmad-custom-src/` | 1 file | — | BMAD custom configuration |
| `.playwright-mcp/` | 100+ files | — | Playwright MCP screenshots/logs |

### Root-Level Config Files (14 files)

| File | Lines | Description |
|------|-------|-------------|
| `next.config.ts` | 59 | Next.js configuration (i18n, webpack, headers) |
| `tailwind.config.ts` | 85 | Tailwind CSS theme & plugin configuration |
| `tsconfig.json` | 42 | TypeScript compiler options |
| `docker-compose.yml` | 101 | Docker services (PostgreSQL, pgAdmin, Azurite) |
| `components.json` | 20 | shadcn/ui component registry |
| `.eslintrc.json` | 12 | ESLint rules |
| `.prettierrc` | 10 | Prettier formatting rules |
| `postcss.config.mjs` | 9 | PostCSS configuration |
| `.gitignore` | 81 | Git ignore patterns |
| `prisma.config.ts` | 15 | Prisma configuration |
| `package.json` | ~130 | Dependencies + npm scripts |
| `package-lock.json` | 632K | Lock file (not analyzed) |
| `next-env.d.ts` | 6 | Next.js environment types |
| `CLAUDE.md` | 550+ | Claude Code project instructions |

### Root-Level Miscellaneous (28 files, NOT in git)

| Category | Count | Description |
|----------|-------|-------------|
| Session conversation logs (`.txt`) | 9 | Claude Code session exports |
| Screenshot images (`.png`) | 7 | UI testing screenshots |
| Excel reports (`.xlsx`) | 2 | Test output artifacts |
| JSON data files | 2 | `batch-result.json`, `temp_response.json` |
| Backup markdown | 2 | `CLAUDE_backup.md`, `CLAUDE_backup_v2.6.0_20260209.md` |
| Guide markdown | 2 | `AI-ASSISTANT-GUIDE.md`, `INDEX-MAINTENANCE-GUIDE.md` |
| Empty file | 1 | `nul` (artifact from Windows NUL redirect) |
| Temp JSON | 1 | `Usersrci.ChrisLaiDocuments...temp_configs.json` |

### src/ Subdirectory Map

| Directory | File Count | Description | Primary Analysis Doc |
|-----------|-----------|-------------|---------------------|
| `src/app/[locale]/` | 82 pages | Next.js pages + layouts | `pages-routing-overview.md` |
| `src/app/api/` | 331 routes | API route handlers | `api-routes-overview.md` + detail/ |
| `src/app/` (root) | 3 files | `globals.css`, `layout.tsx`, `page.tsx` | `R14-css-constants-seed.md` (partial) |
| `src/components/` | 371 files | React components | `components-overview.md` |
| `src/services/` | 200 files | Business logic services | `services-overview.md` + detail/ |
| `src/hooks/` | 104 files | Custom React hooks | `hooks-types-lib-overview.md` |
| `src/types/` | 93 files | TypeScript type definitions | `hooks-types-lib-overview.md` |
| `src/lib/` | 68 files | Utilities, auth, reports, routing | `hooks-types-lib-overview.md` |
| `src/i18n/` | 4 files | i18n configuration | `i18n-coverage.md` |
| `src/validations/` | 6 files | Zod validation schemas | `hooks-types-lib-overview.md` (partial) |
| `src/constants/` | 5 files | Application constants | `R14-css-constants-seed.md` |
| `src/config/` | 2 files | Feature flags + index | `hooks-types-lib-overview.md` (partial) |
| `src/providers/` | 3 files | React context providers | Mentioned in `architecture-patterns.md` |
| `src/stores/` | 2 files | Zustand state stores | `R12-perf-a11y-state.md` (partial) |
| `src/contexts/` | 2 files | React context definitions | Mentioned briefly |
| `src/middlewares/` | 5 files | API middleware functions | `R15-middleware-auth-deep.md` |
| `src/events/` | 1 file | Event handler | `R14-css-constants-seed.md` |
| `src/jobs/` | 2 files | Background job definitions | `R14-css-constants-seed.md` |
| `src/middleware.ts` | 1 file (182 LOC) | Next.js root middleware | `R15-middleware-auth-deep.md` |

---

## 2. Coverage Matrix

### Legend
- **FULL**: Dedicated analysis document with file-level inventory
- **PARTIAL**: Mentioned in an analysis doc but not inventoried deeply
- **VERIFICATION-ONLY**: Covered only in verification rounds, not in a primary analysis doc
- **UNCOVERED**: Not analyzed in any document

### Core Source Code (`src/`)

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `src/services/` (200 files) | FULL | `services-overview.md` + 3 detail files |
| `src/app/api/` (331 routes) | FULL | `api-routes-overview.md` + 3 detail files |
| `src/components/` (371 files) | FULL | `components-overview.md` |
| `src/hooks/` (104 files) | FULL | `hooks-types-lib-overview.md` |
| `src/types/` (93 files) | FULL | `hooks-types-lib-overview.md` |
| `src/lib/` (68 files) | FULL | `hooks-types-lib-overview.md` |
| `src/app/[locale]/` (82 pages) | FULL | `pages-routing-overview.md` |
| `src/i18n/` (4 files) | FULL | `i18n-coverage.md` |
| `src/validations/` (6 files) | PARTIAL | `hooks-types-lib-overview.md` (listed, not deep) |
| `src/constants/` (5 files) | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `src/config/` (2 files) | PARTIAL | Feature flags mentioned in `hooks-types-lib-overview.md` |
| `src/providers/` (3 files) | PARTIAL | Mentioned in `architecture-patterns.md` |
| `src/stores/` (2 files) | VERIFICATION-ONLY | `R12-perf-a11y-state.md` |
| `src/contexts/` (2 files) | PARTIAL | Brief mention only |
| `src/middlewares/` (5 files) | VERIFICATION-ONLY | `R15-middleware-auth-deep.md` |
| `src/events/` (1 file) | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `src/jobs/` (2 files) | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `src/middleware.ts` (1 file) | VERIFICATION-ONLY | `R15-middleware-auth-deep.md` |
| `src/app/globals.css` | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `src/app/layout.tsx`, `page.tsx` | UNCOVERED | Root layout + redirect page |

### Database & Prisma

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `prisma/schema.prisma` (122 models) | FULL | `prisma-model-inventory.md` |
| Prisma enums (113) | FULL | `enum-inventory.md` |
| Migration history (10 dirs) | PARTIAL | `migration-history.md` (listed, SQL not deep-analyzed) |
| `prisma/seed.ts` (1,456 LOC) | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `prisma/seed-data/` (7 files, 2,236 LOC) | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `prisma/seed/exported-data.json` (4,428 LOC) | UNCOVERED | Large JSON seed export |
| `prisma/sql/audit_log_immutability.sql` | UNCOVERED | PostgreSQL trigger for audit immutability |
| `prisma/CLAUDE.md` | UNCOVERED | Prisma development instructions |

### External & Infrastructure

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `python-services/` (12 files) | FULL | `python-services.md` |
| `docker-compose.yml` | PARTIAL | `integration-map.md`, `R13-pages-python-docker.md` |
| `messages/` (102 JSON) | FULL | `i18n-coverage.md` |
| External integrations | FULL | `integration-map.md` |

### Tooling & Configuration

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `next.config.ts` | PARTIAL | `technology-stack.md` mentions features, not full analysis |
| `tailwind.config.ts` | VERIFICATION-ONLY | `R14-css-constants-seed.md` |
| `tsconfig.json` | PARTIAL | Mentioned in `technology-stack.md` |
| `package.json` (deps + scripts) | PARTIAL | `technology-stack.md` (deps), scripts not inventoried |
| `.eslintrc.json` | UNCOVERED | No analysis of ESLint rules |
| `.prettierrc` | UNCOVERED | No analysis of Prettier config |
| `postcss.config.mjs` | UNCOVERED | Trivial (9 lines) |
| `components.json` | UNCOVERED | shadcn/ui registry config |
| `.gitignore` | UNCOVERED | Git ignore patterns |
| `prisma.config.ts` | UNCOVERED | Prisma configuration |

### Scripts Directory (MAJOR GAP)

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `scripts/` (106 files, 23K LOC) | **UNCOVERED** | Only 3 mentions across all docs |
| `scripts/test-template-matching/` (7 files) | **UNCOVERED** | Template matching test suite |
| `scripts/CLAUDE.md` | **UNCOVERED** | Scripts development guide |
| `scripts/check-i18n*.ts` (2 files) | PARTIAL | Referenced in `i18n-coverage.md` |

### Testing

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `tests/` directory structure | FULL | `testing-infrastructure.md` |
| Playwright configuration | PARTIAL | `testing-infrastructure.md` |
| Test patterns & framework | FULL | `testing-infrastructure.md` |

### Developer Tooling (ALL UNCOVERED)

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `.vscode/settings.json` | **UNCOVERED** | VS Code workspace settings |
| `.vscode/extensions.json` | **UNCOVERED** | Recommended VS Code extensions |
| `.vscode/typescript.code-snippets` (14,795 bytes) | **UNCOVERED** | Large TypeScript snippet library |
| `openapi/spec.yaml` (1,067 lines) | **UNCOVERED** | OpenAPI 3.0 specification |
| `.github/agents/` (11 files) | **UNCOVERED** | GitHub Copilot agent configs |
| `.bmad/` (463 files) | **UNCOVERED** | BMAD methodology framework |
| `bmad-custom-src/custom.yaml` | **UNCOVERED** | BMAD custom configuration |

### AI Assistant Infrastructure (ALL UNCOVERED)

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `.claude/rules/` (9 rule files) | **UNCOVERED** | Development rules for Claude Code |
| `.claude/agents/` (9 agent definitions) | **UNCOVERED** | Custom AI agent configurations |
| `.claude/skills/` (4 skills) | **UNCOVERED** | Custom skills (plan-change/fix/story, quickcompact) |
| `.claude/commands/bmad/` (64 commands) | **UNCOVERED** | BMAD integration commands |
| `claudedocs/` (299 files) | **UNCOVERED** | Full AI assistant documentation system |
| Root `CLAUDE.md` | **UNCOVERED** | Master project instructions for AI |
| 16 per-directory `CLAUDE.md` files | **UNCOVERED** | Local context files scattered in codebase |

### Misc Root-Level Artifacts (ALL UNCOVERED — LOW PRIORITY)

| Area | Coverage Level | Notes |
|------|---------------|-------|
| Session logs (9 `.txt` files) | UNCOVERED | Development session exports |
| Screenshots (7 `.png` files) | UNCOVERED | UI test artifacts |
| `AI-ASSISTANT-GUIDE.md` | UNCOVERED | Legacy AI guide |
| `INDEX-MAINTENANCE-GUIDE.md` | UNCOVERED | Barrel index guide |
| `CLAUDE_backup*.md` (2 files) | UNCOVERED | CLAUDE.md version backups |
| `exports/` (11 xlsx) | UNCOVERED | Export test artifacts |
| `.playwright-mcp/` (100+ files) | UNCOVERED | Playwright MCP artifacts |
| `batch-result.json` | UNCOVERED | Test data artifact |

### Project Documentation (docs/ 01–05)

| Area | Coverage Level | Covered By |
|------|---------------|------------|
| `docs/00-discovery/` | **UNCOVERED** | Requirements discovery documents |
| `docs/01-planning/` | **UNCOVERED** | PRD, planning documents |
| `docs/02-architecture/` | **UNCOVERED** | System architecture design docs |
| `docs/02-solutioning/` | **UNCOVERED** | Solution design documents |
| `docs/03-epics/` | **UNCOVERED** | Epic and story definitions |
| `docs/04-implementation/` | **UNCOVERED** | Sprint status, implementation context |
| `docs/05-analysis/` (9 ARCH reports + 3 subdirs) | **UNCOVERED** | Prior architecture analysis reports |
| `docs/coding-standards.md` | **UNCOVERED** | Coding standards document |
| `docs/MIGRATION-GUIDE.md` | **UNCOVERED** | Database migration guide |

---

## 3. Uncovered Areas — Prioritized List

### Priority: HIGH (Significant codebase area, warrants dedicated analysis)

#### GAP-1: `scripts/` Directory — Utility & Debug Scripts
- **Size**: 106 files + 7 template-matching test files = 113 files, ~23,122 LOC
- **Content**: Database check scripts (31), test runners (22), verification scripts (7), debug scripts (4), data manipulation (7), admin utilities (6), i18n checks (2), seed/setup (5), analysis tools (10+)
- **Why Important**: These scripts reveal real operational patterns—what data issues the team encounters, what debugging workflows exist, what testing strategies are used outside Playwright. They also contain database query patterns and API interaction patterns not visible in `src/`.
- **Recommendation**: **New analysis document** — `02-module-mapping/scripts-inventory.md` — categorized inventory with purpose, dependencies, and usage frequency.

#### GAP-2: OpenAPI Specification
- **Size**: 1 file, 1,067 lines
- **Content**: `openapi/spec.yaml` — formal OpenAPI 3.0 specification
- **Why Important**: This is the formal API contract. It should be cross-referenced against the actual 331 route files to detect spec drift (endpoints in code but not in spec, or vice versa).
- **Recommendation**: **Fold into existing** `02-module-mapping/api-routes-overview.md` — add a section on OpenAPI spec coverage and drift analysis.

#### GAP-3: Developer Tooling & DX Configuration
- **Size**: `.vscode/` (3 files, 17K+ bytes), `.eslintrc.json`, `.prettierrc`, `components.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `prisma.config.ts`, `postcss.config.mjs` = ~14 files, ~350 LOC
- **Content**: Complete developer experience configuration — code formatting rules, editor snippets, TypeScript compiler strictness, shadcn/ui registry, build configuration
- **Why Important**: The `.vscode/typescript.code-snippets` file alone is 14,795 bytes and likely encodes project-specific code generation patterns. `next.config.ts` contains webpack customization, security headers, and i18n routing. `tsconfig.json` strictness settings affect type safety guarantees claimed in other analysis docs.
- **Recommendation**: **New analysis document** — `01-project-overview/developer-tooling.md` — full inventory of DX config, build pipeline, code quality enforcement, and snippet library.

### Priority: MEDIUM (Minor but provides completeness)

#### GAP-4: AI Assistant Infrastructure (`.claude/` + `claudedocs/`)
- **Size**: `.claude/` = 82 files (9 rules, 9 agents, 4 skills, 64 BMAD commands), `claudedocs/` = 299 files, 16 per-directory `CLAUDE.md` files
- **Content**: Complete AI-assisted development infrastructure — development rules, custom agents with model selections, planning skills, session management, epic planning docs, progress reports, change management
- **Why Important**: This is a novel aspect of the project — an AI-native development methodology. The agents define review workflows, the rules enforce coding standards, and the skills automate planning. This infrastructure shapes how all code in `src/` was written.
- **Recommendation**: **New analysis document** — `01-project-overview/ai-dev-infrastructure.md` — inventory of rules, agents, skills, CLAUDE.md hierarchy, and how they integrate.

#### GAP-5: `prisma/seed.ts` + `prisma/seed-data/` Deep Content Analysis
- **Size**: `seed.ts` (1,456 LOC) + `seed-data/` (7 files, 2,236 LOC) + `seed/exported-data.json` (4,428 lines) = ~8,120 lines
- **Content**: Database seeding logic — default companies/forwarders, mapping rules, alert rules, exchange rates, field mapping configs, prompt configs, and a large exported dataset
- **Why Important**: Seed data defines the baseline system state. The entities seeded (forwarders, mapping rules, prompt configs) directly affect the 3-tier mapping system behavior. `R14-css-constants-seed.md` touches on this but only at verification level, not as a primary analysis.
- **Recommendation**: **Fold into existing** `03-database/` — add `seed-data-analysis.md` or extend `prisma-model-inventory.md` with a seed data section.

#### GAP-6: `prisma/sql/` — Raw SQL Triggers
- **Size**: 1 file (`audit_log_immutability.sql`), ~100 LOC
- **Content**: PostgreSQL triggers preventing audit log modification (DELETE/UPDATE protection)
- **Why Important**: This is a security-critical database constraint not visible in Prisma schema. The security audit should reference this.
- **Recommendation**: **Fold into existing** `05-security-quality/security-audit.md` — add a database-level security section.

#### GAP-7: `prisma/migrations/` SQL Content Analysis
- **Size**: 10 migration directories, ~958 LOC total SQL
- **Content**: DDL statements for all schema changes — table creation, column additions, index creation, enum modifications
- **Why Important**: `migration-history.md` lists migration names and dates but doesn't analyze the SQL content for patterns (e.g., missing indexes, implicit cascading deletes, column type changes).
- **Recommendation**: **Fold into existing** `03-database/migration-history.md` — add a SQL patterns section analyzing index strategy, cascade behavior, and schema evolution patterns.

#### GAP-8: Small `src/` Directories Not in Primary Analysis
- **Size**: `contexts/` (2 files), `events/` (1 file), `jobs/` (2 files), `stores/` (2 files), `providers/` (3 files), `config/` (2 files) = 12 files total
- **Content**: React contexts (DashboardFilter, DateRange), event handlers (document-processed), background jobs (pattern-analysis, webhook-retry), Zustand stores (review, document-preview-test), providers (Auth, Query, Theme), feature flags config
- **Why Important**: These are infrastructure-level modules that connect the main code areas. They appear in verification reports but have no primary analysis entry.
- **Recommendation**: **Fold into existing** `02-module-mapping/hooks-types-lib-overview.md` — add dedicated sections for "Contexts & Providers", "State Stores", "Event Handlers & Jobs", and "Feature Flags Configuration".

#### GAP-9: docs/05-analysis/ Prior Architecture Reports
- **Size**: 9 architecture analysis reports + 3 subdirectories with 13+ files = 22+ files
- **Content**: Prior deep architecture analyses (extraction v2/v3 comparisons, unified processor refactoring, field definition closed-loop design, template instance line item expansion)
- **Why Important**: These represent institutional knowledge about design decisions. They predate the `06-codebase-analyze/` effort and contain different perspectives.
- **Recommendation**: **Cross-reference only** — add a note in `00-analysis-index.md` acknowledging these prior analyses and their relationship to the current codebase analysis.

### Priority: LOW (Trivial or not actionable)

#### GAP-10: `.bmad/` Framework (463 files)
- **Content**: BMAD (Business Model Agent Development) methodology framework — agents, workflows, templates, documentation
- **Recommendation**: OUT OF SCOPE — this is a third-party framework, not project-specific code. Not worth analyzing.

#### GAP-11: `.github/agents/` (11 files)
- **Content**: GitHub Copilot agent definitions referencing BMAD agents (11 files, ~17 lines each)
- **Recommendation**: OUT OF SCOPE — auto-generated configuration, trivial.

#### GAP-12: Root-Level Artifacts (session logs, screenshots, xlsx)
- **Content**: 28+ temporary/artifact files in project root
- **Recommendation**: CLEANUP NEEDED — these should be `.gitignore`d or moved to a dedicated directory. Not worth analyzing.

#### GAP-13: `exports/` Directory (11 xlsx files)
- **Content**: Test output Excel files from batch processing tests
- **Recommendation**: CLEANUP NEEDED — test artifacts, not source code.

#### GAP-14: `.playwright-mcp/` (100+ files)
- **Content**: Playwright MCP screenshots, console logs, network logs from E2E testing sessions
- **Recommendation**: OUT OF SCOPE — ephemeral test artifacts.

#### GAP-15: `public/` (3 gitkeep files)
- **Content**: Empty placeholder directories for icons, images, locales
- **Recommendation**: NOT NEEDED — nothing to analyze.

#### GAP-16: `src/app/layout.tsx` and `src/app/page.tsx` (Root)
- **Size**: 2 files, ~40 LOC
- **Content**: Root layout (font loading, metadata) and root page (redirect to locale)
- **Recommendation**: **Trivial** — could be mentioned in `pages-routing-overview.md` but low value.

---

## 4. Coverage Summary Statistics

| Category | Items | Fully Covered | Partially Covered | Verification Only | Uncovered |
|----------|-------|---------------|-------------------|-------------------|-----------|
| src/ directories (19) | 19 | 8 (42%) | 5 (26%) | 5 (26%) | 1 (5%) |
| Prisma/Database | 7 areas | 2 (29%) | 1 (14%) | 2 (29%) | 2 (29%) |
| Config files (14) | 14 | 0 (0%) | 4 (29%) | 1 (7%) | 9 (64%) |
| Scripts | 1 major dir | 0 (0%) | 0 (0%) | 0 (0%) | 1 (100%) |
| External/Infra | 4 areas | 3 (75%) | 1 (25%) | 0 (0%) | 0 (0%) |
| Developer tooling | 6 areas | 0 (0%) | 0 (0%) | 0 (0%) | 6 (100%) |
| AI infrastructure | 5 areas | 0 (0%) | 0 (0%) | 0 (0%) | 5 (100%) |
| Project docs (01–05) | 9 dirs | 0 (0%) | 0 (0%) | 0 (0%) | 9 (100%) |

### Overall Coverage Score

- **Core source code (`src/`)**: ~90% covered (strong)
- **Database layer**: ~60% covered (seed data and SQL triggers are gaps)
- **Build/Config/DX**: ~15% covered (major gap)
- **Scripts**: 0% covered (major gap)
- **AI development infrastructure**: 0% covered (unique gap)
- **Prior project documentation**: 0% covered (not necessarily needed)

---

## 5. Recommendations — New Documents Needed

### Must-Create (HIGH priority)

| # | Document | Path | Covers | Est. Effort |
|---|----------|------|--------|-------------|
| 1 | Scripts Inventory | `02-module-mapping/scripts-inventory.md` | GAP-1: 113 files, 23K LOC utility scripts | Medium |
| 2 | Developer Tooling & Config | `01-project-overview/developer-tooling.md` | GAP-3: All root config files, VS Code snippets, build config | Low-Medium |

### Should-Create (MEDIUM priority)

| # | Document | Path | Covers | Est. Effort |
|---|----------|------|--------|-------------|
| 3 | AI Development Infrastructure | `01-project-overview/ai-dev-infrastructure.md` | GAP-4: .claude/ rules/agents/skills, CLAUDE.md hierarchy | Medium |
| 4 | Seed Data Analysis | `03-database/seed-data-analysis.md` | GAP-5: seed.ts + seed-data/ + exported-data.json | Low |

### Should-Extend (fold into existing docs)

| # | Existing Document | Add Section | Covers |
|---|-------------------|-------------|--------|
| 5 | `api-routes-overview.md` | OpenAPI Spec Drift Analysis | GAP-2 |
| 6 | `security-audit.md` | Database-Level Security (SQL triggers) | GAP-6 |
| 7 | `migration-history.md` | SQL Content Pattern Analysis | GAP-7 |
| 8 | `hooks-types-lib-overview.md` | Contexts, Providers, Stores, Events, Jobs, Config sections | GAP-8 |
| 9 | `00-analysis-index.md` | Cross-reference to docs/05-analysis/ prior reports | GAP-9 |

---

## 6. Barrel Index (`index.ts`) Coverage Check

The codebase contains **86 barrel index files** across `src/`. These are partially covered in `R13-exports-barrels-imports.md` (verification only). Key barrel files and their coverage:

| Location | Count | Covered? |
|----------|-------|----------|
| `src/components/features/*/index.ts` | 56 | VERIFICATION-ONLY (R13) |
| `src/lib/*/index.ts` | 10 | VERIFICATION-ONLY (R13) |
| `src/services/*/index.ts` | 13 | VERIFICATION-ONLY (R13) |
| `src/config/index.ts` | 1 | UNCOVERED |
| `src/middlewares/index.ts` | 1 | UNCOVERED |
| `src/types/index.ts` | 2 | UNCOVERED |
| Page-level component barrels | 3 | UNCOVERED |

**Recommendation**: The barrel file pattern is well-understood and R13 provides sufficient verification. No additional analysis needed.

---

## 7. Declaration Files (`.d.ts`)

Only **1 declaration file** found: `src/types/next-auth.d.ts` (Next-Auth session type augmentation). Plus `next-env.d.ts` at root (auto-generated). Both are trivial and covered implicitly in `hooks-types-lib-overview.md`.

---

## 8. Key Finding: The "Scripts Gap"

The single largest uncovered area is `scripts/` with **106 utility files totaling 23,122 LOC**. This is nearly **17% of the entire `src/` codebase** by line count. These scripts break down as:

| Category | Files | Examples |
|----------|-------|---------|
| Database checkers | 31 | `check-batch-status.mjs`, `check-company-config.mjs`, `check-i18n.ts` |
| Test runners | 22 | `test-e2e-pipeline.ts`, `test-gpt5-nano-extraction.ts`, `test-dual-processing.ts` |
| Analysis/Debug | 14 | `analyze-batch-results.ts`, `debug-format-issue.mjs`, `analyze-dhl-extraction.mjs` |
| Verification | 7 | `verify-change-006.mjs`, `verify-batch-results.ts` |
| Data manipulation | 7 | `backfill-document-format-id.mjs`, `reset-stuck-files.mjs`, `reaggregate-batch-terms.mjs` |
| Admin utilities | 6 | `create-admin.ts`, `assign-admin-role.js`, `grant-admin-access.ts`, `fix-user-permissions.ts` |
| E2E runners | 5 | `run-test-plan-003-full.mjs`, `run-test-plan-005.mjs` |
| Template matching | 7 (subdir) | `01-data-exploration.ts` through `07-pipeline-integration.ts` |
| Misc/temp | 7 | `temp-check-doc.ts`, `temp-query-docs.ts`, `find-batch.ts` |

These scripts are a goldmine for understanding:
1. **Operational pain points** — what breaks in production
2. **Data migration patterns** — how schema changes are backfilled
3. **Testing strategies** — integration tests run outside the formal test framework
4. **Admin operations** — user and permission management workflows
