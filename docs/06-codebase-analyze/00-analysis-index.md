# Codebase Analysis — Master Index

> **Project**: AI Document Extraction System
> **Analysis Date**: 2026-04-09
> **Codebase Snapshot**: Branch `main`
> **Methodology**: Based on `codebase-analyze-playbook.md`
> **Total Documents Produced**: 31 analysis files + 5 diagrams + 44 verification reports = 80 files

---

## Codebase Scale Summary

| Metric | Count | Lines |
|--------|-------|-------|
| Total src/ files | 1,363 | ~136,000 |
| Services | 200 | ~99,684 |
| Components (TSX) | 371 | ~98,252 |
| API Route files | 331 | ~66,787 |
| Hooks | 104 | ~28,528 |
| Types | 93 | ~38,749 |
| Lib/Utils | 68 | — |
| Pages | 82 | — |
| Prisma Models | 122 | 4,354 (schema) |
| Prisma Enums | 113 | — |
| i18n JSON files | 102 (34/lang) | — |
| Python Services | 12 | ~2,719 |
| Stores | 2 | — |
| Validations | 6+9 | — |
| Constants | 5 | — |

---

## Phase 1: Project Overview & Technology Inventory

| Document | Path | Status |
|----------|------|--------|
| Technology Stack | `01-project-overview/technology-stack.md` | ✅ Done |
| Architecture Patterns | `01-project-overview/architecture-patterns.md` | ✅ Done |
| Project Metrics | `01-project-overview/project-metrics.md` | ✅ Done |

## Phase 2: Module-by-Module Functional Mapping

### Services Layer (200 files, ~100K lines)

| Document | Path | Status |
|----------|------|--------|
| Services Overview | `02-module-mapping/services-overview.md` | ✅ Done |
| Core Pipeline Detail | `02-module-mapping/detail/services-core-pipeline.md` | ✅ Done |
| Mapping & Rules Detail | `02-module-mapping/detail/services-mapping-rules.md` | ✅ Done |
| Support Services Detail | `02-module-mapping/detail/services-support.md` | ✅ Done |

### API Routes (331 files, ~67K lines)

| Document | Path | Status |
|----------|------|--------|
| API Routes Overview | `02-module-mapping/api-routes-overview.md` | ✅ Done |
| Admin API Detail | `02-module-mapping/detail/api-admin.md` | ✅ Done |
| V1 API Detail | `02-module-mapping/detail/api-v1.md` | ✅ Done |
| Other Domains Detail | `02-module-mapping/detail/api-other-domains.md` | ✅ Done |

### Components (371 files, ~98K lines)

| Document | Path | Status |
|----------|------|--------|
| Components Overview | `02-module-mapping/components-overview.md` | ✅ Done |

### Hooks + Types + Lib + Support Dirs

| Document | Path | Status |
|----------|------|--------|
| Hooks/Types/Lib Overview | `02-module-mapping/hooks-types-lib-overview.md` | ✅ Done |

### Pages + Python + External

| Document | Path | Status |
|----------|------|--------|
| Pages & Routing | `02-module-mapping/pages-routing-overview.md` | ✅ Done |
| Python Services | `07-external-integrations/python-services.md` | ✅ Done |
| External Integrations | `07-external-integrations/integration-map.md` | ✅ Done |

## Phase 3: Database & Data Layer

| Document | Path | Status |
|----------|------|--------|
| Prisma Model Inventory | `03-database/prisma-model-inventory.md` | ✅ Done |
| Enum Inventory | `03-database/enum-inventory.md` | ✅ Done |
| Migration History | `03-database/migration-history.md` | ✅ Done |

## Phase 4: System Diagrams (Mermaid)

| Document | Path | Status |
|----------|------|--------|
| System Architecture | `04-diagrams/system-architecture.md` | ✅ Done |
| Data Flow | `04-diagrams/data-flow.md` | ✅ Done |
| ER Diagrams | `04-diagrams/er-diagrams.md` | ✅ Done |
| Auth & Permission Flow | `04-diagrams/auth-permission-flow.md` | ✅ Done |
| Business Process Flows | `04-diagrams/business-process-flows.md` | ✅ Done |

## Phase 5: Security & Quality Audit

| Document | Path | Status |
|----------|------|--------|
| Security Audit | `05-security-quality/security-audit.md` | ✅ Done |
| Code Quality Report | `05-security-quality/code-quality.md` | ✅ Done |

## Phase 6: i18n Analysis

| Document | Path | Status |
|----------|------|--------|
| i18n Coverage | `06-i18n-analysis/i18n-coverage.md` | ✅ Done |

## Phase 8: UI Design System

| Document | Path | Status |
|----------|------|--------|
| UI Patterns | `08-ui-design-system/ui-patterns.md` | ✅ Done |

## Phase 9: Testing Infrastructure

| Document | Path | Status |
|----------|------|--------|
| Testing Infrastructure | `09-testing/testing-infrastructure.md` | ✅ Done |

---

## Verification Summary

### Round 1-3: Level 1-3 (Existence / Count / Signature)

| Round | Scope | Points | Pass | Fail | Accuracy |
|-------|-------|--------|------|------|----------|
| R1 | Overview + Services (4 files) | 103 | 77 | 26 | 74.8% |
| R2 | API Routes + Database (4 files) | 100 | 80 | 20 | 80.0% |
| R3 | Components + i18n + Security (4 files) | 100 | 84 | 16 | 84.0% |
| **Subtotal** | **12 files** | **303** | **241** | **62** | **79.5%** |

### Round 5: Level 4-5 (Semantic / Cross-Reference)

| Round | Scope | Points | Pass | Fail | Accuracy |
|-------|-------|--------|------|------|----------|
| R5-V1 | Services + Pipeline semantic | 85 | 76 | 9 | 89.4% |
| R5-V2 | API + Security + Cross-ref | 85 | 71 | 14 | 83.5% |
| R5-V3 | Components + Hooks + External | 80 | 73 | 7 | 91.3% |
| **Subtotal** | **All analysis files** | **250** | **220** | **30** | **88.0%** |

### Round 6-7: Deep Semantic + Cross-Reference

| Round | Scope | Points | Pass | Fail | Accuracy |
|-------|-------|--------|------|------|----------|
| R6 (4 reports) | Fix confirm + deep semantic | 500 | ~430 | ~70 | ~86% |
| R7 (4 reports) | API + Services + Components + Cross-cut | 500 | ~473 | ~27 | ~94.6% |

### Round 8-15: Exhaustive + Final Reconciliation (30 reports)

| Round | Reports | Focus | Approximate Pass Rate |
|-------|---------|-------|-----------------------|
| R8 | 4 | Components/Prisma deep, conventions, remaining API/services | 95.4% |
| R9 | 4 | Exhaustive components/types, e2e flows, Prisma, services/hooks | 94.2% |
| R10 | 4 | Exhaustive API/Prisma, components, cross-service config, enums/orphans | ~90% |
| R11 | 4 | Full-stack chains, Zod, complete services/hooks/types, Prisma relations | ~97% |
| R12 | 4 | Build/git/doc consistency, components 90%+ push, perf/a11y, Prisma complete | ~82% |
| R13 | 4 | Exports/barrels, final consistency sweep, CLAUDE.md check, pages/Python/Docker | ~86% |
| R14 | 3 | API response format, CSS/constants/seed, regression/env/orphans | ~88% |
| R15 | 4 | API/Prisma patterns, component props, final reconciliation, middleware/auth deep | ~87% |

### Grand Total (All 44 Verification Reports)

| Metric | Value |
|--------|-------|
| Total verification points | 4,928 |
| Total PASS | 4,487 |
| Total FAIL | 441 |
| **Overall pass rate** | **91.1%** |

### Accuracy Trajectory

| Phase | Pass Rate | Notes |
|-------|-----------|-------|
| R1-R3 (Initial) | 79.5% | Baseline: existence + count + signature checks |
| R5 (Semantic) | 88.0% | Semantic + cross-reference verification |
| R7 (Deep) | 94.6% | Peak: deep semantic checks |
| R8-R15 (Exhaustive) | 90-97% | Exhaustive edge-case checks stabilized at ~91% |
| **All rounds** | **91.1%** | 4,487 / 4,928 points |

### Verification Reports (44 files)

| Round | Document | Path |
|-------|----------|------|
| R1 | Overview + Services | `verification/R1-overview-services.md` |
| R2 | API Routes + Database | `verification/R2-api-database.md` |
| R3 | Components + i18n + Security | `verification/R3-components-i18n-security.md` |
| R5 | Semantic Services + Pipeline | `verification/R5-semantic-services-pipeline.md` |
| R5 | Semantic API + Security | `verification/R5-semantic-api-security.md` |
| R5 | Semantic Components + External | `verification/R5-semantic-components-external.md` |
| R6 | Fix Confirm + New Checks A | `verification/R6-fix-confirm-and-new-A.md` |
| R6 | Fix Confirm + New Checks B | `verification/R6-fix-confirm-and-new-B.md` |
| R6 | Deep Semantic Cross-Ref | `verification/R6-deep-semantic-cross-ref.md` |
| R6 | Comprehensive New Checks D | `verification/R6-comprehensive-new-D.md` |
| R7 | API Deep Semantic | `verification/R7-api-deep-semantic.md` |
| R7 | Services + Hooks Deep | `verification/R7-services-hooks-deep.md` |
| R7 | Components + Architecture Deep | `verification/R7-components-arch-deep.md` |
| R7 | Cross-Cut Consistency | `verification/R7-crosscut-consistency.md` |
| R8 | Components + Prisma Deep | `verification/R8-components-prisma-deep.md` |
| R8 | Conventions + Config Final | `verification/R8-conventions-config-final.md` |
| R8 | Remaining API Routes | `verification/R8-remaining-api-routes.md` |
| R8 | Remaining Services Deep | `verification/R8-remaining-services-deep.md` |
| R9 | Components + Types Exhaustive | `verification/R9-components-types-exhaustive.md` |
| R9 | E2E Flows + Middleware | `verification/R9-e2e-flows-middleware.md` |
| R9 | Prisma Exhaustive | `verification/R9-prisma-exhaustive.md` |
| R9 | Services + Hooks Exhaustive | `verification/R9-services-hooks-exhaustive.md` |
| R10 | API + Prisma Exhaustive | `verification/R10-api-prisma-exhaustive.md` |
| R10 | Components Exhaustive | `verification/R10-components-exhaustive.md` |
| R10 | Cross-Service Config | `verification/R10-cross-service-config.md` |
| R10 | Enums + Orphans + Diagrams | `verification/R10-enums-orphans-diagrams.md` |
| R11 | Chains + Zod + Config | `verification/R11-chains-zod-config.md` |
| R11 | Complete Services + Hooks + Types | `verification/R11-complete-services-hooks-types.md` |
| R11 | Components + API Complete | `verification/R11-components-api-complete.md` |
| R11 | Prisma + Diagrams Final | `verification/R11-prisma-diagrams-final.md` |
| R12 | Build + Git + Doc Consistency | `verification/R12-build-git-doc-consistency.md` |
| R12 | Components Push 90% | `verification/R12-components-push-90.md` |
| R12 | Perf + A11y + State | `verification/R12-perf-a11y-state.md` |
| R12 | Prisma Complete | `verification/R12-prisma-complete.md` |
| R13 | Exports + Barrels + Imports | `verification/R13-exports-barrels-imports.md` |
| R13 | Final Consistency Sweep | `verification/R13-final-consistency-sweep.md` |
| R13 | Fix CLAUDE.md Consistency | `verification/R13-fix-claudemd-consistency.md` |
| R13 | Pages + Python + Docker | `verification/R13-pages-python-docker.md` |
| R14 | API Response Format | `verification/R14-api-response-format.md` |
| R14 | CSS + Constants + Seed | `verification/R14-css-constants-seed.md` |
| R14 | Regression + Env + Orphans | `verification/R14-regression-env-orphans.md` |
| R15 | API + Prisma Patterns | `verification/R15-api-prisma-patterns.md` |
| R15 | Component Props + Contracts | `verification/R15-component-props-contracts.md` |
| R15 | Final Reconciliation | `verification/R15-final-reconciliation.md` |
| R15 | Middleware + Auth Deep | `verification/R15-middleware-auth-deep.md` |

### Critical Findings from Verification

| Priority | Finding | Source | Impact |
|----------|---------|--------|--------|
| 🟢 FIXED | Total src/ LOC: corrected to ~136K (was 375K) | project-metrics.md | Resolved |
| 🔴 HIGH | Rate limiting uses in-memory Map, NOT Upstash Redis | security-audit.md, integration-map.md | Security gap misrepresented |
| 🔴 HIGH | Dual smart routing conflict: generateRoutingDecision() vs getSmartReviewType() | services-core-pipeline.md, diagrams | Business logic ambiguity |
| 🔴 HIGH | Auth coverage: 59% → actual 73% | security-audit.md | Security posture understated |
| 🟡 MEDIUM | Model field counts systematic undercount | prisma-model-inventory.md | Data accuracy |
| 🟡 MEDIUM | RFC 7807 inconsistent: top-level vs nested format | api-routes-overview.md | API consistency |
| 🟡 MEDIUM | UI component import counts undercount (scoped to components/ only) | components-overview.md | Completeness |
| 🟡 MEDIUM | Dependency count: 62+12 → actual 77+20 | technology-stack.md | Completeness |
| 🟢 LOW | ER diagram field names conceptual vs actual | er-diagrams.md | Presentation |
| 🟢 LOW | Env var name mismatch (SMTP_PASS vs SMTP_PASSWORD) | integration-map.md | Minor |

### Perfect Scores

| Document | Verification | Score |
|----------|-------------|-------|
| services-mapping-rules.md | R5-V1 Set B | **25/25 (100%)** |
| components-overview.md | R3 Set A | **25/25 (100%)** |

---

## Directory Structure

```
docs/06-codebase-analyze/
├── 00-analysis-index.md                ← This file (master index)
├── codebase-analyze-playbook.md        ← Methodology reference
│
├── 01-project-overview/                ← Phase 1: Tech stack & metrics (3 files)
│   ├── technology-stack.md
│   ├── architecture-patterns.md
│   └── project-metrics.md
│
├── 02-module-mapping/                  ← Phase 2: Module analysis (11 files)
│   ├── services-overview.md
│   ├── api-routes-overview.md
│   ├── components-overview.md
│   ├── hooks-types-lib-overview.md
│   ├── pages-routing-overview.md
│   └── detail/
│       ├── services-core-pipeline.md
│       ├── services-mapping-rules.md
│       ├── services-support.md
│       ├── api-admin.md
│       ├── api-v1.md
│       └── api-other-domains.md
│
├── 03-database/                        ← Phase 3: Data layer (3 files)
│   ├── prisma-model-inventory.md
│   ├── enum-inventory.md
│   └── migration-history.md
│
├── 04-diagrams/                        ← Phase 4: Mermaid diagrams (5 files)
│   ├── system-architecture.md
│   ├── data-flow.md
│   ├── er-diagrams.md
│   ├── auth-permission-flow.md
│   └── business-process-flows.md
│
├── 05-security-quality/                ← Phase 5: Audit (2 files)
│   ├── security-audit.md
│   └── code-quality.md
│
├── 06-i18n-analysis/                   ← Phase 6: i18n (1 file)
│   └── i18n-coverage.md
│
├── 07-external-integrations/           ← Phase 7: External (2 files)
│   ├── python-services.md
│   └── integration-map.md
│
├── 08-ui-design-system/                ← Phase 8: UI patterns (1 file)
│   └── ui-patterns.md
│
├── 09-testing/                         ← Phase 9: Testing (1 file)
│   └── testing-infrastructure.md
│
└── verification/                       ← Verification reports (44 files, R1-R15)
    ├── R1-overview-services.md
    ├── R2-api-database.md
    ├── R3-components-i18n-security.md
    ├── R5-semantic-*.md                (3 files)
    ├── R6-*.md                         (4 files)
    ├── R7-*.md                         (4 files)
    ├── R8-*.md                         (4 files)
    ├── R9-*.md                         (4 files)
    ├── R10-*.md                        (4 files)
    ├── R11-*.md                        (4 files)
    ├── R12-*.md                        (4 files)
    ├── R13-*.md                        (4 files)
    ├── R14-*.md                        (3 files)
    └── R15-*.md                        (4 files)
```
