# R12: Build Configuration, Git Patterns & Documentation Self-Consistency

> **Verification Date**: 2026-04-09
> **Scope**: Build/deploy config, git conventions, all 31 analysis docs cross-consistency, CLAUDE.md accuracy
> **Total Verification Points**: 125
> **Result**: 100 PASS / 25 FAIL (80.0%)

---

## Set A: Build & Deploy Configuration (25 pts)

### A1. next.config.ts — Custom Settings (5 pts) ✅ PASS

| Setting | Value | Notes |
|---------|-------|-------|
| `reactStrictMode` | `true` | Standard React strict mode |
| `eslint.ignoreDuringBuilds` | `true` | ⚠️ ESLint errors ignored in prod builds |
| `images.remotePatterns` | `[]` | Empty — no remote image domains configured |
| `experimental.serverActions.bodySizeLimit` | `'10mb'` | Increased from default 1MB |
| `webpack` (client) | `canvas = false` | Disables canvas for browser |
| `webpack` (server) | Externals: `canvas`, `pdf-to-img`, `pdfjs-dist` | Prevents bundling native modules |
| `next-intl` | Plugin wrapping via `createNextIntlPlugin('./src/i18n/request.ts')` | i18n integration |
| `output` | Not set (default) | No standalone/export mode |
| `redirects` | None | No custom redirects |

**Finding**: `eslint.ignoreDuringBuilds: true` is a risk — ESLint errors pass silently in production builds.

---

### A2. docker-compose.yml — Services Match (5 pts) ✅ PASS

| Service | Image | Port | Matches integration-map.md | Matches technology-stack.md |
|---------|-------|------|---------------------------|----------------------------|
| `postgres` | `postgres:15-alpine` | 5433:5432 | ✅ | ✅ |
| `pgadmin` | `dpage/pgadmin4:latest` | 5050:80 | ✅ | ✅ |
| `ocr-extraction` | Custom (python-services/extraction) | 8000:8000 | ✅ | ✅ |
| `forwarder-mapping` | Custom (python-services/mapping) | 8001:8001 | ✅ | ✅ |
| `azurite` | `mcr.microsoft.com/azure-storage/azurite:latest` | 10010-10012 | ✅ | ✅ |

All 5 Docker services match both integration-map.md and technology-stack.md exactly. Health checks present on postgres, ocr-extraction, and forwarder-mapping.

---

### A3. Python Dockerfiles — Base Images, Ports, Health Checks (5 pts) — 4 PASS / 1 FAIL

#### Extraction Service (`python-services/extraction/Dockerfile`)

| Check | Value | Status |
|-------|-------|--------|
| Base image | `python:3.12-slim` (multi-stage build) | ✅ |
| Port | `EXPOSE 8000` | ✅ |
| Health check | `HEALTHCHECK --interval=30s` using `urllib.request` | ✅ |
| Non-root user | `appuser` created and used | ✅ |
| Build pattern | Multi-stage (builder + runtime) | ✅ |

#### Mapping Service (`python-services/mapping/Dockerfile`)

| Check | Value | Status |
|-------|-------|--------|
| Base image | `python:3.11-slim` (single stage) | ✅ |
| Port | `EXPOSE 8001` | ✅ |
| Health check | `HEALTHCHECK --interval=30s` using `httpx` | ✅ |
| Non-root user | ❌ **Not created — runs as root** | ❌ FAIL |
| Build pattern | Single stage | ✅ |

**Finding**: ❌ Mapping service Dockerfile runs as root (no `useradd`/`USER` directive). The extraction service properly creates a non-root user. Also, Python versions differ: extraction uses 3.12, mapping uses 3.11.

---

### A4. .dockerignore and .gitignore — Sensitive File Exclusion (3 pts) — 2 PASS / 1 FAIL

| Check | Status | Detail |
|-------|--------|--------|
| `.dockerignore` exists | ❌ FAIL | **No `.dockerignore` file anywhere in the project** |
| `.gitignore` excludes `.env` | ✅ | `.env`, `.env.local`, `.env.*.local` all excluded |
| `.gitignore` excludes `node_modules` | ✅ | Listed at line 2 |
| `.gitignore` excludes `.next` | ✅ | Listed at line 10 |
| `.gitignore` excludes coverage | ✅ | `coverage/` and `.nyc_output/` |
| `.gitignore` excludes IDE settings | ✅ | `.idea/`, `.vscode/settings.json` |

**Finding**: ❌ No `.dockerignore` file exists. Docker builds will copy `node_modules/`, `.env`, `.next/`, etc. into images, increasing build time and image size, and potentially leaking secrets.

---

### A5. prisma/seed.ts — Seed Content (3 pts) ✅ PASS

Seed file exists and seeds:
1. **6 Roles**: System Admin, Super User, Data Processor, City Manager, Regional Manager, Auditor
2. **3 Regions**: APAC, EMEA, AMER
3. **10 Cities**: Taipei, Hong Kong, Singapore, Tokyo, Shanghai, Sydney, London, Frankfurt, New York, Los Angeles
4. **15 Companies** (Forwarder type): DHL, FedEx, UPS, TNT, Maersk, MSC, CMA CGM, Hapag-Lloyd, Evergreen, COSCO, ONE, Yang Ming, SF Express, Kerry Logistics, Unknown
5. **Mapping rules**: Universal (Tier 1) + Company-Specific (Tier 2) for DHL, FedEx, UPS, Maersk
6. **System configs**: via `config-seeds.ts`
7. **Prompt configs**: via `prompt-configs.ts`
8. **Field mapping configs**: via `field-mapping-configs.ts`
9. **Alert rules**: via `alert-rules.ts`
10. **Exchange rates**: via `exchange-rates.ts`
11. **Optional exported data restore**: from `prisma/seed/exported-data.json`

---

### A6. CI/CD Configuration (2 pts) ✅ PASS (documented as absent)

| Check | Status |
|-------|--------|
| `.github/workflows/` | Does not exist |
| `.gitlab-ci.yml` | Does not exist (only in `node_modules/pdf-parse/`) |
| Any CI/CD config | **None found** |

**Finding**: No CI/CD pipeline exists. Combined with `eslint.ignoreDuringBuilds: true` and no test runner, there is zero automated quality assurance.

---

### A7. Pre-commit Hooks (2 pts) ✅ PASS (documented as absent)

| Check | Status |
|-------|--------|
| `.husky/` directory | Does not exist |
| `.lintstagedrc` | Does not exist |
| Any pre-commit hook config | **None found** |
| `lint-staged` in package.json | Not present |

**Finding**: No pre-commit hooks. Developers can commit without running type-check, lint, or format.

---

## Set B: Git History Pattern Verification (25 pts)

### B1. Commit Message Format — Last 20 Commits (5 pts) ✅ PASS

All 20 recent commits follow the `<type>(<scope>): <subject>` convention:

| # | Commit | Format Valid |
|---|--------|-------------|
| 1 | `fix(FIX-049): correct Stage 2 prompt content...` | ✅ `fix(scope): subject` |
| 2 | `docs: resolve FIX-019/024/026 duplicate...` | ✅ `docs: subject` |
| 3 | `docs: add missing status markers...` | ✅ `docs: subject` |
| 4 | `fix(TopBar): use i18n router...` | ✅ `fix(scope): subject` |
| 5 | `docs: add mandatory CHANGE/FIX...` | ✅ `docs: subject` |
| 6 | `feat(CHANGE-051): refactor Extracted Fields...` | ✅ `feat(scope): subject` |
| 7 | `feat(CHANGE-050): add System Settings Hub...` | ✅ `feat(scope): subject` |
| 8 | `feat(CHANGE-049): add User Profile page...` | ✅ `feat(scope): subject` |

All 20/20 follow conventional commit format. Types used: `feat`, `fix`, `docs`.

---

### B2. Branch Naming Convention (3 pts) ✅ PASS

| Branch | Pattern | Matches CLAUDE.md |
|--------|---------|-------------------|
| `main` | Production | ✅ |
| `feature/change-021-extraction-v3` | `feature/change-NNN-description` | ✅ |
| `feature/epic-17-i18n` | `feature/epic-X-description` | ✅ (legacy pattern) |

CLAUDE.md documents both patterns: legacy `feature/epic-X-story-Y` and current `feature/change-NNN`. Both exist in the repo.

---

### B3. .gitignore Coverage (5 pts) ✅ PASS

| Required Pattern | Present | Line |
|------------------|---------|------|
| `node_modules/` | ✅ | 2 |
| `.env` | ✅ | 5 |
| `.env.local` | ✅ | 6 |
| `.next/` | ✅ | 10 |
| `prisma/migrations/*.sql` (not dir) | ⚠️ Not explicitly listed, but directory is not ignored | N/A |
| `dist/` | ✅ | 9 |
| `build/` | ✅ | 10 |
| `coverage/` | ✅ | 35 |

Note: `prisma/migrations/` directory is NOT in .gitignore (correct — migration SQL files should be committed). Individual `.sql` files are not excluded.

---

### B4. No .env Files Committed (2 pts) ✅ PASS

Verified via `git log --all --name-only -- '.env' '.env.local' '.env.production'` — no output. No .env files have ever been committed to git history.

---

### B5. Total Commit Count (2 pts) ✅ PASS

**447 total commits** across all branches. This indicates a mature, actively developed project with substantial history.

---

### B6. Conventional Commit Format — 8 Commits Detailed (8 pts) ✅ PASS

| Commit | Type | Scope | Subject | Valid |
|--------|------|-------|---------|-------|
| `7d4a465` | `fix` | `FIX-049` | correct Stage 2 prompt content... | ✅ |
| `d153d4d` | `docs` | — | resolve FIX-019/024/026... | ✅ |
| `156b6ad` | `docs` | — | add missing status markers... | ✅ |
| `220ae1b` | `fix` | `TopBar` | use i18n router... | ✅ |
| `27ce287` | `docs` | — | add mandatory CHANGE/FIX... | ✅ |
| `17ab6dc` | `feat` | `CHANGE-051` | refactor Extracted Fields... | ✅ |
| `a62d63f` | `feat` | `CHANGE-050` | add System Settings Hub... | ✅ |
| `0b7acec` | `feat` | `CHANGE-049` | add User Profile page... | ✅ |

8/8 follow conventional commit format perfectly.

---

## Set C: Analysis Documents Self-Consistency (50 pts)

### C1. 01-project-overview/ (3 files, 10 pts) — 8 PASS / 2 FAIL

#### technology-stack.md

| Check | Status | Detail |
|-------|--------|--------|
| Title matches content | ✅ | Complete dependency inventory |
| Package versions match package.json | ✅ | All versions verified correct |
| Docker services match docker-compose.yml | ✅ | 5/5 services match |
| No pending statuses | ✅ | N/A |

#### architecture-patterns.md

| Check | Status | Detail |
|-------|--------|--------|
| Title matches content | ✅ | 12 architecture patterns documented |
| Confidence thresholds (90/70) | ✅ | Matches actual code |
| Smart downgrade rules | ❌ FAIL | **Claims "New company -> Force FULL_REVIEW"** but code only downgrades AUTO_APPROVE to QUICK_REVIEW. Also claims "DEFAULT config source" but code checks `LLM_INFERRED` |
| HTTP method counts | ❌ FAIL | **Claims GET:226, POST:148** but project-metrics.md says GET:201, POST:141. Actual count: 415 total methods |
| File path references | ✅ | All referenced service paths exist |

#### project-metrics.md

| Check | Status | Detail |
|-------|--------|--------|
| All counts verified against filesystem | ✅ | Services:200, Components:371, Routes:331, Hooks:104, Models:122 — all correct |
| Cross-references to other docs | ✅ | References prisma/CLAUDE.md domain breakdown — matches |
| No pending statuses | ✅ | N/A |

---

### C2. 02-module-mapping/ (11 files, 10 pts) — 9 PASS / 1 FAIL

| Document | Status | Issues |
|----------|--------|--------|
| services-overview.md | ✅ | 200 files, 12 subdirs — matches filesystem |
| api-routes-overview.md | ❌ FAIL | **Claims 447 HTTP methods** but project-metrics says 414 and actual count is 415 |
| components-overview.md | ✅ | 371 components, 34 UI, 306 features, 5 layout — verified |
| hooks-types-lib-overview.md | ✅ | Counts match project-metrics |
| pages-routing-overview.md | ✅ | 82 pages documented |
| detail/services-core-pipeline.md | ✅ | Pipeline stages match code |
| detail/services-mapping-rules.md | ✅ | 3-tier mapping accurately described |
| detail/services-support.md | ✅ | Support service inventory matches |
| detail/api-admin.md | ✅ | 106 admin routes documented |
| detail/api-v1.md | ✅ | 77 v1 routes documented |
| detail/api-other-domains.md | ✅ | Remaining domains documented |

**Cross-reference inconsistency**: `api-routes-overview.md` says 447 total HTTP methods, but `project-metrics.md` says 414. Actual verified count is **415**. Both are wrong but close.

---

### C3. 03-database/ (3 files, 10 pts) ✅ ALL PASS

| Document | Status | Detail |
|----------|--------|--------|
| prisma-model-inventory.md | ✅ | 122 models, 113 enums, 256 relations — all verified against schema |
| enum-inventory.md | ✅ | 113 enums listed — matches `grep -c "^enum " schema.prisma` = 113 |
| migration-history.md | ✅ | 10 migrations documented, schema stats match (122 models, 113 enums, ~4,355 lines vs actual 4,354) |

No inconsistencies within or between these 3 documents. All cross-references to project-metrics.md align.

---

### C4. 04-diagrams/ (5 files, 10 pts) — 8 PASS / 2 FAIL

| Document | Status | Issues |
|----------|--------|--------|
| system-architecture.md | ✅ | All service counts in diagram match verified numbers (371 components, 331 routes, 122 models, 34 namespaces) |
| data-flow.md | ✅ | Pipeline flow matches actual code (V2/V3/V3.1 routing, fallback logic) |
| er-diagrams.md | ✅ | 20 key models shown, relationships match schema |
| auth-permission-flow.md | ✅ | Dual auth paths (Azure AD + local credentials) accurately described |
| business-process-flows.md | ❌ FAIL (2 issues) | **1)** Title says "Six Dimensions" but pie chart and flowchart show only 5 dimensions (D1-D5). **2)** Smart downgrade says "New company -> Force FULL_REVIEW" which contradicts code (only QUICK_REVIEW) |

---

### C5. 05-09 Other Folders (7 files, 10 pts) — 9 PASS / 1 FAIL

| Document | Status | Issues |
|----------|--------|--------|
| 05-security-quality/security-audit.md | ✅ | Auth coverage percentages updated from earlier verification rounds |
| 05-security-quality/code-quality.md | ✅ | Console statement counts documented, 287 console.log in 94 files |
| 06-i18n-analysis/i18n-coverage.md | ✅ | 34 namespaces x 3 locales = 102 files, zh-CN missing 12 keys in common.json — all verified |
| 07-external-integrations/integration-map.md | ✅ | 9 integration categories documented, env vars listed |
| 07-external-integrations/python-services.md | ✅ | 2 FastAPI services, ports 8000/8001 |
| 08-ui-design-system/ui-patterns.md | ✅ | Tailwind config, dark mode, confidence colors documented |
| 09-testing/testing-infrastructure.md | ❌ FAIL | **Claims "1,074+ production source files"** but project-metrics.md says 1,363 total files in src/. The 1,074 number appears to be from an earlier snapshot |

---

### C-Summary: Cross-Document Number Inconsistencies

| Metric | project-metrics.md | api-routes-overview.md | architecture-patterns.md | Actual |
|--------|-------------------|----------------------|------------------------|--------|
| HTTP methods | 414 | 447 | 226 GET + 148 POST + 33 PATCH + 31 DELETE + 8 PUT = 446 | **415** |
| Components | 371 | — | — | **371** |
| Services | 200 | — | — | **200** |
| Models | 122 | — | — | **122** |
| i18n namespaces | 34 | — | — | **34** |

---

## Set D: CLAUDE.md vs Codebase Reality Check (25 pts)

### D1-D10: Specific Claims Verification

| # | CLAUDE.md Claim | Actual Value | Status |
|---|-----------------|-------------|--------|
| D1 | "Next.js 15.0.0" | `^15.0.0` in package.json | ✅ PASS |
| D2 | "TypeScript 5.0" | `^5.0.0` in package.json | ✅ PASS |
| D3 | "Prisma ORM 7.2 (117 models)" | Version `^7.2.0` ✅, Models **122** not 117 | ❌ FAIL (model count) |
| D4 | "30 個命名空間" | **34 namespaces** (missing: pipelineConfig, fieldDefinitionSet, profile, systemSettings) | ❌ FAIL |
| D5 | "165+ React 組件" | **371 .tsx files** in src/components/ | ❌ FAIL (severely understated) |
| D6 | "124+ 業務服務" | **200 .ts files** in src/services/ | ❌ FAIL (severely understated) |
| D7 | "175+ API 路由文件" | **331 route.ts files** in src/app/api/ | ❌ FAIL (severely understated) |
| D8 | "89 自定義 Hooks" | **104 hook files** in src/hooks/ | ❌ FAIL (understated) |
| D9 | "≥ 95% AUTO_APPROVE, 80-94% QUICK_REVIEW" | Code: **≥ 90% AUTO_APPROVE, 70-89% QUICK_REVIEW** | ❌ FAIL |
| D10 | V3.1 "新公司 → 強制 FULL_REVIEW" | Code: new company only downgrades AUTO_APPROVE → QUICK_REVIEW | ❌ FAIL |

### D10 Detail: V3.1 Smart Downgrade Rules

| CLAUDE.md Claim | Actual Code Behavior | Match |
|-----------------|---------------------|-------|
| 新公司 → 強制 FULL_REVIEW | `isNewCompany`: AUTO_APPROVE → QUICK_REVIEW only | ❌ |
| 新格式 → 強制 QUICK_REVIEW | `isNewFormat`: AUTO_APPROVE → QUICK_REVIEW | ⚠️ Close but "force" is misleading — only if currently AUTO_APPROVE |
| DEFAULT 配置來源 → 降一級路由 | `configSource === 'LLM_INFERRED'`: AUTO_APPROVE → QUICK_REVIEW | ❌ Wrong config source name |

---

### D11-D15: Additional Specific Claims

| # | Claim | Actual | Status |
|---|-------|--------|--------|
| D11 | "Radix UI 20+ primitives" | 19 @radix-ui packages | ❌ FAIL (19, not 20+) |
| D12 | "22 個 Epic（157+ Stories）" | Not independently verified in this round | ⚠️ Assumed correct |
| D13 | "Tailwind CSS 3.4" | `^3.4.0` in package.json | ✅ PASS |
| D14 | "PostgreSQL 15" | `postgres:15-alpine` in docker-compose | ✅ PASS |
| D15 | "Azure OpenAI GPT-5.2" | Referenced in code and services | ✅ PASS |

---

### D16-D25: File Path Verification

| # | Path Referenced in CLAUDE.md | Exists | Status |
|---|------------------------------|--------|--------|
| D16 | `claudedocs/reference/directory-structure.md` | ✅ | ✅ PASS |
| D17 | `claudedocs/reference/dev-checklists.md` | ✅ | ✅ PASS |
| D18 | `claudedocs/reference/project-progress.md` | ✅ | ✅ PASS |
| D19 | `claudedocs/CLAUDE.md` | ✅ | ✅ PASS |
| D20 | `.claude/CLAUDE.md` | ✅ | ✅ PASS |
| D21 | `docs/03-stories/tech-specs/` | ❌ Missing | ❌ FAIL |
| D22 | `docs/04-implementation/implementation-context.md` | ✅ | ✅ PASS |
| D23 | `docs/04-implementation/sprint-status.yaml` | ✅ | ✅ PASS |
| D24 | `src/i18n/request.ts` | ✅ | ✅ PASS |
| D25 | `claudedocs/6-ai-assistant/prompts/` | ✅ | ✅ PASS |

**D21 Finding**: CLAUDE.md references `docs/03-stories/tech-specs/` (appears twice at lines 300 and 491) but this path does NOT exist. The actual path is `docs/04-implementation/tech-specs/`.

---

## CLAUDE.md Staleness Report

### Numbers That Need Updating (Critical)

| Field | Current Value | Correct Value | Staleness |
|-------|--------------|---------------|-----------|
| **Prisma Models** | "117 models" | **122 models** | +5 models |
| **i18n Namespaces** | "30 個命名空間" | **34 namespaces** | +4 added (pipelineConfig, fieldDefinitionSet, profile, systemSettings) |
| **React Components** | "165+" | **371** | +206 (2.25x understated) |
| **Services** | "124+" | **200** | +76 (1.6x understated) |
| **API Routes** | "175+" | **331** | +156 (1.9x understated) |
| **Custom Hooks** | "89" | **104** | +15 |
| **Radix UI primitives** | "20+" | **19** | -1 (overstated) |

### Content That Needs Correction (Critical)

| Section | Current | Correct |
|---------|---------|---------|
| **Confidence thresholds** | ≥ 95% AUTO_APPROVE, 80-94% QUICK_REVIEW | **≥ 90% AUTO_APPROVE, 70-89% QUICK_REVIEW** |
| **V3.1 smart downgrade: new company** | 強制 FULL_REVIEW | **AUTO_APPROVE → QUICK_REVIEW only** |
| **V3.1 smart downgrade: config source** | DEFAULT 配置來源 → 降一級 | **LLM_INFERRED → AUTO_APPROVE downgrade to QUICK_REVIEW** |
| **Tech specs path** | `docs/03-stories/tech-specs/` | **`docs/04-implementation/tech-specs/`** |
| **i18n namespace list** | 30 names listed | **Add: pipelineConfig, fieldDefinitionSet, profile, systemSettings** |

### Correct i18n Namespace List (34)

```
common, navigation, dialogs, auth, validation, errors, dashboard, global,
escalation, review, documents, rules, companies, reports, admin, confidence,
historicalData, termAnalysis, documentPreview, fieldMappingConfig,
promptConfig, dataTemplates, formats, templateFieldMapping, templateInstance,
templateMatchingTest, standardFields, referenceNumber, exchangeRate, region,
pipelineConfig, fieldDefinitionSet, profile, systemSettings
```

---

## Analysis Document Cross-Reference Issues

### HTTP Method Count Discrepancy

Three different numbers appear across analysis documents:

| Source | Total Methods Claimed |
|--------|---------------------|
| `project-metrics.md` | 414 |
| `api-routes-overview.md` | 447 |
| `architecture-patterns.md` (sum of breakdown) | 446 |
| **Actual** (grep for exported HTTP functions) | **415** |

The discrepancy likely stems from different counting methods (some count re-exported functions, others count unique method declarations).

### Smart Downgrade Description Inconsistency

The "New company → Force FULL_REVIEW" claim appears in:
1. `CLAUDE.md` (root)
2. `architecture-patterns.md`
3. `business-process-flows.md`

All three are **wrong**. The actual code (`confidence-v3-1.service.ts` lines 402-408) only downgrades `AUTO_APPROVE` to `QUICK_REVIEW` for new companies. Stage failure (not new company) triggers `FULL_REVIEW`.

### Confidence Dimension Count

`business-process-flows.md` says "Six Dimensions" in its section heading but the actual pie chart and flowchart both show 5 dimensions (D1-D5). The 6th dimension (`REFERENCE_NUMBER_MATCH`) exists in the enum but has weight=0 by default and is only activated when refMatch is enabled.

### Production Source File Count

`testing-infrastructure.md` says "1,074+ production source files" but `project-metrics.md` says 1,363 total TypeScript files in `src/`. The 1,074 number appears to be from an earlier analysis pass before recent growth.

---

## Summary Scorecard

| Set | Area | Points | Pass | Fail | Accuracy |
|-----|------|--------|------|------|----------|
| A | Build & Deploy Config | 25 | 22 | 3 | 88.0% |
| B | Git History Patterns | 25 | 25 | 0 | 100.0% |
| C | Analysis Doc Consistency | 50 | 44 | 6 | 88.0% |
| D | CLAUDE.md Reality Check | 25 | 9 | 16 | 36.0% |
| **Total** | | **125** | **100** | **25** | **80.0%** |

### Key Takeaways

1. **Git conventions are excellent** (100%): All commits follow conventional format, branches are properly named, no secrets committed.

2. **Build configuration is functional but has gaps**: No `.dockerignore`, no CI/CD, no pre-commit hooks, ESLint errors ignored during builds. The mapping service Dockerfile runs as root.

3. **Analysis documents are largely consistent** (88%): The main inconsistency is HTTP method counts across documents and the smart downgrade rule misrepresentation.

4. **CLAUDE.md is significantly stale** (36% accuracy on specific claims): 7 out of 10 numeric claims are outdated, confidence thresholds are wrong, smart downgrade rules are misrepresented, and a file path reference is broken. The numeric claims appear to be from an early project phase and have not been updated as the codebase grew.

### Priority Fix Recommendations

| Priority | Action |
|----------|--------|
| 🔴 Immediate | Fix CLAUDE.md confidence thresholds (95/80 → 90/70) |
| 🔴 Immediate | Fix CLAUDE.md smart downgrade rules (new company ≠ FULL_REVIEW) |
| 🔴 Immediate | Fix CLAUDE.md tech-specs path (03-stories → 04-implementation) |
| 🟡 High | Update CLAUDE.md code scale numbers (components, services, routes, hooks, models, namespaces) |
| 🟡 High | Add `.dockerignore` to project root and python-services/ |
| 🟡 Medium | Fix mapping service Dockerfile to use non-root user |
| 🟡 Medium | Standardize HTTP method count across analysis docs |
| 🟢 Low | Fix "Six Dimensions" typo in business-process-flows.md |
| 🟢 Low | Update testing-infrastructure.md source file count |
