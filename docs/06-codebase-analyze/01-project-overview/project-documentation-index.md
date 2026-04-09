# Project Documentation Index

> Generated: 2026-04-09 | Scope: All `docs/` (excl. 06-codebase-analyze) and `claudedocs/`

---

## Documentation Overview

| Directory | Files | Purpose |
|-----------|-------|---------|
| `docs/00-discovery` | 8 | Initial research, past discussions, product brief |
| `docs/01-planning` | 27 | PRD, UX design specification |
| `docs/02-architecture` | 11 | Architecture decisions, confidence thresholds |
| `docs/02-solutioning` | 1 | Placeholder (README only) |
| `docs/03-epics` | 23 | Epic definitions, dependency diagrams |
| `docs/04-implementation` | 315 | Stories (155), sprint status, registries, prompts |
| `docs/05-analysis` | 29 | Architecture analysis reports (4 sub-collections) |
| `docs/_backup` | 4 | Backup copies |
| `docs/Doc Sample` | 135 | Sample freight invoice documents |
| `docs/Doc template` | 1 | Document template |
| `claudedocs/` | ~300 | AI assistant docs, change registry, testing, prompts |
| **Total** | **~554** | |

---

## docs/00-discovery (8 files)

Initial project discovery and research phase.

| File | Purpose |
|------|---------|
| `product-brief-*.md` | Product brief dated 2025-12-14 — project inception document |
| `README.md` | Discovery phase overview |
| `past-discussions/` (6 files) | Pre-project analysis: batch preprocessing, data mapping, development approach, freight invoice AI plan, project flow |

**Codebase relevance**: Provides business context for why the 3-tier mapping system and confidence routing were designed.

---

## docs/01-planning (27 files)

Product requirements and UX design specifications.

### PRD (13 files)
| File | Purpose |
|------|---------|
| `prd/prd.md` | Master PRD — complete product requirements document |
| `prd/sections/executive-summary.md` | Project mission, target metrics (450K invoices/year) |
| `prd/sections/functional-requirements.md` | Detailed functional requirements |
| `prd/sections/non-functional-requirements.md` | Performance, security, scalability targets |
| `prd/sections/product-scope.md` | Scope boundaries |
| `prd/sections/user-journeys.md` | Key user workflows |
| `prd/sections/innovation-novel-patterns.md` | 3-tier mapping, confidence routing, auto-learning |
| Other sections (6) | Classification, phasing, SaaS/B2B, success criteria, index |

### UX Design (13 files)
| File | Purpose |
|------|---------|
| `ux/ux-design-specification.md` | Master UX specification |
| `ux/sections/core-user-experience.md` | Core UX patterns and principles |
| `ux/sections/component-strategy.md` | shadcn/ui component selection |
| `ux/sections/user-journey-flows.md` | User flow diagrams |
| `ux/sections/design-system-foundation.md` | Color, typography, spacing system |
| Other sections (8) | Visual design, responsive, accessibility, consistency patterns |

**Codebase relevance**: Source of truth for functional requirements; UX patterns map to `src/components/` structure.

---

## docs/02-architecture (11 files)

System architecture decisions and validation.

| File | Purpose |
|------|---------|
| `architecture.md` | Master architecture document |
| `confidence-thresholds-design.md` | Confidence routing design (AUTO_APPROVE/QUICK_REVIEW/FULL_REVIEW) |
| `tier3-llm-implementation-assessment.md` | Tier 3 LLM classification feasibility |
| `sections/core-architecture-decisions.md` | Tech stack decisions (Next.js 15, Prisma, etc.) |
| `sections/project-structure-boundaries.md` | Module boundaries, layering rules |
| `sections/implementation-patterns-consistency-rules.md` | Coding patterns and consistency enforcement |
| Other sections (5) | Context analysis, starter template eval, validation results, completion summary, index |

**Codebase relevance**: Directly governs `src/services/extraction-v3/` pipeline design and Prisma schema structure.

---

## docs/02-solutioning (1 file)

| File | Purpose |
|------|---------|
| `README.md` | Placeholder — solutioning phase documentation (empty) |

---

## docs/03-epics (23 files)

Epic definitions covering all 22 Epics (Epic 0-21).

| File | Purpose |
|------|---------|
| `epics.md` | Master epics document |
| `sections/epic-list.md` | Full epic list with priorities |
| `sections/epic-overview.md` | Epic dependency and scheduling overview |
| `sections/epic-dependency-diagram.md` | Visual dependency graph between epics |
| `sections/requirements-inventory.md` | Requirements traceability to epics |
| `sections/epic-0-historical-data.md` ~ `epic-15-*` | Individual epic definitions (16 epics) |

> Note: Epics 16-21 are defined in `docs/04-implementation/stories/` directories but not in `docs/03-epics/sections/`.

**Codebase relevance**: Maps 1:1 to story directories under `docs/04-implementation/stories/epic-*`.

---

## docs/04-implementation (315 files)

The largest documentation directory — implementation artifacts.

### Top-level Files (7)

| File | Purpose |
|------|---------|
| `sprint-status.yaml` | **Single source of truth** for all sprint/story status |
| `implementation-context.md` | Cross-cutting implementation decisions and context |
| `api-registry.md` | API endpoint registry |
| `component-registry.md` | Component inventory |
| `dev-checklist.md` | Developer checklist before/after implementation |
| `lessons-learned.md` | Accumulated implementation lessons |
| `tech-spec-sprint-1.md` | Sprint 1 technical specification |

### Stories (155 files across 22 epic directories)

| Epic Directory | Stories | Scope |
|----------------|---------|-------|
| `epic-0-historical-data` | 11 | Batch upload, processing, term aggregation |
| `epic-1-auth` | 9 | Azure AD SSO, user/role management |
| `epic-2-invoice-upload` | 7 | Document upload, AI processing |
| `epic-3-invoice-review` | 8 | Review workflow, corrections |
| `epic-4-mapping-rules` | 8 | 3-tier mapping rule management |
| `epic-5-forwarder-config` | 5 | Company (forwarder) configuration |
| `epic-6-multi-city` | 5 | Multi-city data isolation |
| `epic-7-reports-dashboard` | 10 | Reports, dashboard, cost tracking |
| `epic-8-audit-compliance` | 6 | Audit trail, compliance |
| `epic-9-auto-retrieval` | 5 | SharePoint/Outlook document retrieval |
| `epic-10-n8n-workflow` | 7 | n8n workflow integration |
| `epic-11-external-api` | 6 | External API services |
| `epic-12-system-admin` | 7 | System admin, monitoring |
| `epic-13-document-preview` | 9 | PDF preview, field mapping UI |
| `epic-14-prompt-config` | 4 | Prompt configuration system |
| `epic-15-unified-processor` | 5 | Unified 3-tier processing pipeline |
| `epic-16-format-management` | 8 | Document format management |
| `epic-17-i18n` | 5 | Internationalization (en/zh-TW/zh-CN) |
| `epic-18-local-auth` | 5 | Local account authentication |
| `epic-19-template-matching` | 9 | Template matching and data templates |
| `epic-20-reference-number-master` | 7 | Reference number master data |
| `epic-21-exchange-rate-management` | 9 | Exchange rate conversion |

### Prompt Templates (3 files)

| File | Purpose |
|------|---------|
| `prompt-templates/all-story-prompts.md` | Consolidated story development prompts |
| `prompt-templates/generic-story-dev-prompt.md` | Reusable story implementation prompt template |
| `prompt-templates/story-1-0-dev-prompt.md` | Story 1-0 specific prompt |

**Codebase relevance**: Each story maps to specific `src/` implementations; `sprint-status.yaml` tracks completion status.

---

## docs/05-analysis (29 files)

Architecture analysis reports organized in 4 sub-collections.

### Root-level Analysis (9 files)
| File | Purpose |
|------|---------|
| `2026-01-30-ARCH-extraction-architecture-comparison.md` | V1 vs V2 vs V3 extraction architecture comparison |
| `2026-01-30-ARCH-unified-document-processing-analysis.md` | Unified processing flow analysis |
| `2026-01-30-ARCH-unified-processor-refactoring-plan.md` | V2→V3 refactoring roadmap |
| `2026-01-31-ARCH-unified-document-processing-v3-analysis.md` | V3 architecture deep analysis |
| `2026-02-05-ARCH-unified-document-processing-v3.1-analysis.md` | V3.1 enhancements (confidence routing) |
| `2026-02-23-ARCH-field-definition-closed-loop.md` | Field definition closed-loop design |
| `2026-02-23-ARCH-field-definition-feasibility.md` | Field definition feasibility study |
| `2026-02-25-ARCH-line-item-pivot-design.md` | Line item pivot/flatten strategy |
| `2026-02-25-ARCH-template-instance-line-item-expansion.md` | Template instance line item expansion |

### latest-overview/ (8 files)
| File | Purpose |
|------|---------|
| `AIDE-Architecture-Analysis-V1.md` | System architecture overview analysis |
| `AIDE-Features-Architecture-Mapping-V1.md` | Feature-to-architecture mapping |
| `BATCH1-ARCH-LAYERS.md` | Architecture layer breakdown |
| `BATCH1-FEATURE-MAPPING.md` | Feature mapping matrix |
| `TASK3-E2E-FLOW-TRACING.md` | End-to-end flow tracing |
| `TASK4-DESIGN-DECISIONS.md` | Design decision inventory |
| `TASK5-SECURITY-QUALITY.md` | Security and quality assessment |
| `TASK6-RECOMMENDATIONS.md` | Improvement recommendations |

### latest-overview-20260302/ (4 files)
| File | Purpose |
|------|---------|
| `AIDE_深度分析報告.md` | Deep analysis report (Chinese) |
| `AIDE-行動規劃-代碼驗證版.md` | Action plan with code verification |
| `AIDE-行動規劃-基於深度分析.md` | Action plan based on deep analysis |
| `AIDE-Deep-Analysis-Report-ZH.docx` | Word export of deep analysis |

### overview/ (3 files) + sample/ (2 files)
Earlier architecture analysis iterations and sample MAF analysis documents.

**Codebase relevance**: Documents architecture evolution decisions that shaped `src/services/extraction-v3/` and the 3-tier mapping system.

---

## claudedocs/ (~300 files)

AI assistant operational documentation.

### claudedocs/1-planning (20 files)

| Subdirectory | Files | Purpose |
|--------------|-------|---------|
| `epics/` | 17 | Epic overview docs (epic-0 through epic-16), one per epic |
| `plan-docs/` | 1 | CHANGE-032 plan document |
| Root | 2 | `e2e-pipeline-integration-plan.md`, architecture notes |

### claudedocs/2-sprints (0 files)
Empty — sprint tracking moved to `docs/04-implementation/sprint-status.yaml`.

### claudedocs/3-progress (0 files)
Empty — progress tracking consolidated elsewhere.

### claudedocs/4-changes (105 files)

| Subdirectory | Files | Purpose |
|--------------|-------|---------|
| `feature-changes/` | 53 | CHANGE-001 ~ CHANGE-053 feature change docs |
| `bug-fixes/` | 52 | FIX-001 ~ FIX-049 (+ 019b/024b/026b) bug fix docs |

> Full registry: see `docs/06-codebase-analyze/02-module-mapping/change-fix-registry.md`

### claudedocs/5-status (30 files)

| Subdirectory | Files | Purpose |
|--------------|-------|---------|
| `testing/plans/` | 3 | Test plans (TEST-PLAN-001 ~ 003) |
| `testing/reports/` | 26 | Test reports (md + json + xlsx), UAT reports |
| `testing/` | 1 | `TESTING-FRAMEWORK.md` — testing methodology |

### claudedocs/6-ai-assistant (8 files)

| Subdirectory | Files | Purpose |
|--------------|-------|---------|
| `prompts/` | 7 | SITUATION-1 ~ SITUATION-7 context prompts |
| `analysis/` | 1 | Historical data flow analysis |

### claudedocs/7-archive (130 files)

| Subdirectory | Files | Purpose |
|--------------|-------|---------|
| `templates/` | 6 | Doc templates (bug-fix, daily, feature-change, refactoring, sprint, weekly) |
| `sample-project-files/` | 124 | Archived sample analysis, bug-fixes, testing-validation, features |

### claudedocs/8-conversation-log (1 file)
Single conversation history log (`daily/conversation-history-20260213-1649pm.md`).

### claudedocs/reference (3 files)

| File | Purpose |
|------|---------|
| `dev-checklists.md` | Developer checklists for post-implementation verification |
| `directory-structure.md` | Complete project directory structure reference |
| `project-progress.md` | Project progress tracking and version history |

**Codebase relevance**: `4-changes/` directly correlates to git commits; `5-status/testing/` documents verification results; `reference/` files are referenced by CLAUDE.md.

---

## Cross-Reference: Documentation ↔ Codebase Analysis

| Analysis Area | Primary Docs Source | Key Files |
|---------------|-------------------|-----------|
| Architecture overview | `docs/02-architecture/` | `architecture.md`, `confidence-thresholds-design.md` |
| Feature inventory | `docs/03-epics/`, `docs/04-implementation/stories/` | 155 story files across 22 epics |
| API design | `docs/04-implementation/` | `api-registry.md`, `implementation-context.md` |
| Pipeline evolution | `docs/05-analysis/` | 9 ARCH-* files documenting V1→V3.1 |
| Change history | `claudedocs/4-changes/` | 53 CHANGEs + 52 FIXes |
| Testing evidence | `claudedocs/5-status/testing/` | 26 test reports |
| Sprint tracking | `docs/04-implementation/` | `sprint-status.yaml` (single source of truth) |

---

## Documentation Health Observations

1. **Well-structured change tracking**: 105 CHANGE/FIX documents with consistent formatting; 92% marked as completed.
2. **Empty directories**: `claudedocs/2-sprints/` and `claudedocs/3-progress/` are empty — tracking consolidated into `sprint-status.yaml`.
3. **Large archive**: `claudedocs/7-archive/` (130 files) and `docs/Doc Sample/` (135 files) are substantial but low-utility for analysis.
4. **Analysis report proliferation**: `docs/05-analysis/` has 4 separate sub-collections of overlapping analysis — latest is `latest-overview-20260302/`.
5. **Epic 16-21 gap**: These later epics have story files in `docs/04-implementation/stories/` but no epic definition in `docs/03-epics/sections/`.
6. **Documentation version**: PRD and architecture docs were created Dec 2025; may not fully reflect CHANGE-020 through CHANGE-053 pipeline evolution.
