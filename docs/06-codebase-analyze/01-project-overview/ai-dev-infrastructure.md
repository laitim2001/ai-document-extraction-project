# AI Development Infrastructure Analysis

> Analyzed: 2026-04-09
> Scope: `.claude/` directory, CLAUDE.md files, agents, skills, rules, settings

---

## 1. Overview

The project has a comprehensive Claude Code AI assistant infrastructure with 9 rule files, 9 agents, 4 skills, 2 CLAUDE.md guidance files, and a local settings file. An additional 50+ BMAD framework commands are installed as external slash commands.

```
.claude/
├── CLAUDE.md                   # Detailed dev service startup & troubleshooting guide
├── settings.local.json         # Local permissions & experimental flags
├── rules/                      # 9 rule files (auto-loaded as context)
│   ├── general.md              # Naming, git, i18n architecture, file headers
│   ├── typescript.md           # Type safety, Zod, no-any, import order
│   ├── services.md             # Three-tier mapping, confidence routing
│   ├── api-design.md           # REST conventions, RFC 7807, response format
│   ├── components.md           # Component structure, shadcn/ui, state mgmt
│   ├── database.md             # Prisma schema naming, migrations
│   ├── testing.md              # Test structure, coverage targets
│   ├── i18n.md                 # Translation sync, ICU format, routing
│   └── technical-obstacles.md  # Obstacle handling protocol (no silent changes)
├── agents/                     # 9 custom agents
│   ├── architecture-reviewer.md
│   ├── code-implementer.md
│   ├── code-quality-checker.md
│   ├── fullstack-scaffolder.md
│   ├── i18n-guardian.md
│   ├── project-analyst.md
│   ├── requirement-analyst.md
│   ├── session-manager.md
│   └── test-strategist.md
├── skills/                     # 4 custom skills (slash commands)
│   ├── plan-change/SKILL.md
│   ├── plan-fix/SKILL.md
│   ├── plan-story/SKILL.md
│   └── quickcompact/SKILL.md
└── commands/bmad/              # 50+ BMAD framework commands (external)
    ├── core/                   # Core agents, workflows, tasks, tools
    ├── bmm/                    # BMM agents + workflows (dev, PM, architect, etc.)
    └── bmb/                    # BMB builder agents + workflows
```

---

## 2. CLAUDE.md Files

### Root `CLAUDE.md` (v3.1.0, last updated 2026-02-23)

Primary system prompt loaded automatically. Key sections:

| Section | Content |
|---------|---------|
| Language rules | Must respond in Traditional Chinese; code identifiers in English |
| Project mission | AI document extraction for SCM freight invoices (450K-500K/year target) |
| Three-tier mapping | Universal (70-80%) -> Company-Specific (10-15%) -> LLM (5-10%) |
| Confidence routing | >=95% AUTO_APPROVE, 80-94% QUICK_REVIEW, <80% FULL_REVIEW |
| Tech stack | Next.js 15 + TypeScript 5 + React 18.3 + Prisma 7.2 (117 models) + next-intl 4.7 |
| Code scale | 165+ components, 124+ services, 175+ API route files, 89 hooks, 30 i18n namespaces |
| Parallel agent protocol | Auto-trigger conditions, 5-step execution flow, agent selection guide |
| i18n sync rules | Mandatory 3-language sync, npm run i18n:check before completion |
| Technical obstacle rules | Never deviate from design without user approval |
| Doc index | 20+ cross-references to rule files, specs, and checklists |

### `.claude/CLAUDE.md` (last updated 2026-01-14)

Operational guide for AI assistant. Key sections:

| Section | Content |
|---------|---------|
| Service startup | Docker Compose -> check ports -> npm run dev (port 3005 default, 3200 recommended) |
| Docker ports | PostgreSQL:5433, pgAdmin:5050, Azurite:10010-10012 |
| Port conflict resolution | Windows netstat/taskkill commands, backup ports list |
| Troubleshooting | 4 common problems: server timeout, Prisma connection, background tasks, Azure Storage |
| E2E testing flow | Startup -> navigate -> execute -> verify -> report |

---

## 3. Rule Files (9 files)

All rule files use YAML frontmatter with `paths:` globs to scope when they are loaded.

| File | Scoped Paths | Key Rules |
|------|-------------|-----------|
| `general.md` | (no path filter) | Language: Traditional Chinese for user comms; naming conventions (kebab-case files, PascalCase components, camelCase functions, UPPER_SNAKE constants); mandatory JSDoc headers (`@fileoverview`, `@module`, `@since`, `@lastModified`); git workflow (feature/fix/hotfix branches, conventional commits); no console.log in committed code |
| `typescript.md` | `src/**/*.{ts,tsx}` | `interface` preferred over `type`; Zod for runtime validation; no `any` type; no non-null assertions; use optional chaining + nullish coalescing; strict import order (React -> 3rd party -> local components -> hooks -> utils -> types); Locale type from `@/i18n/config` |
| `services.md` | `src/services/**/*.ts` | Three-tier mapping architecture (Universal -> Company-Specific -> LLM); confidence thresholds (90/70); single responsibility; custom Error classes; service registration in `src/services/index.ts` |
| `api-design.md` | `src/app/api/**/*.ts` | REST route structure under `v1/`; success format `{ success: true, data: T, meta? }`; error format RFC 7807 `{ type, title, status, detail, instance }`; Zod input validation required; standard pagination params |
| `components.md` | `src/components/**/*.tsx, src/app/**/*.tsx` | Three categories: UI (shadcn/ui, don't modify), Features (business logic), Layouts; structure order: `'use client'` -> imports -> types -> component (Hooks -> State -> Effects -> Handlers -> Render); use `@/i18n/routing` Link, not `next/link` |
| `database.md` | `prisma/**/*` | PascalCase model names, camelCase fields with `@map("snake_case")`, `@@map("table_name")` for plural snake_case tables; IDs: `@default(uuid())` for new models, `cuid()` legacy; migration naming: `YYYYMMDDHHMMSS_description` |
| `testing.md` | `tests/**/*.{ts,tsx}, **/*.test.ts, **/*.spec.ts` | Directory: `tests/{unit,integration,e2e}/`; coverage targets: unit >=80%, integration >=70%, E2E critical flows; domain-specific: three-tier mapping fallback, confidence boundary values (69/70/89/90), i18n 3-language rendering |
| `i18n.md` | `src/**/*.{ts,tsx}, messages/**/*.json` | next-intl framework; 3 languages (en, zh-TW, zh-CN); ICU MessageFormat; constant-to-i18n mapping table; must sync all 3 language files; `npm run i18n:check` required; format utilities in `src/lib/i18n-{date,number,currency}.ts` |
| `technical-obstacles.md` | (no path filter) | Never substitute components/simplify features/hide problems without user approval; 4-step protocol: investigate -> document -> ask user -> record tech debt; includes user inquiry template and tech debt tracking format |

---

## 4. Agents (9 agents)

| Agent | Model | Tools | Modifies Code? | Purpose |
|-------|-------|-------|----------------|---------|
| `architecture-reviewer` | sonnet | Read, Glob, Grep | No (read-only) | Validates designs against all 9 rule files; generates review reports with CRITICAL/HIGH/MEDIUM findings; 2 modes: pre-implementation design review, post-implementation structure review |
| `code-implementer` | opus | (default) | Yes | Writes/modifies production code from approved specs; follows project conventions; structured output (Completed, Key Decisions, Integration Notes, Needs Attention, Testing Suggestions) |
| `code-quality-checker` | sonnet | Read, Glob, Grep, Bash | No (read-only) | Post-development quality gate; checks JSDoc headers, RFC 7807, i18n routing, Zod validation, no-any, no-console.log; runs type-check + lint + i18n:check; max 20 issues per review |
| `fullstack-scaffolder` | sonnet | Read, Glob, Grep, Write | Yes (new files only) | Generates compliant file skeletons for new features: validation -> service -> API routes -> hooks -> components -> page -> i18n (8-step order); reads similar files first for pattern matching |
| `i18n-guardian` | haiku | Read, Glob, Grep, Bash | No (suggests fixes) | Validates translation sync across en/zh-TW/zh-CN; checks constant-to-i18n mapping; validates ICU format; runs `npm run i18n:check`; 3 modes: full sync, targeted, post-change |
| `project-analyst` | sonnet | Read, Glob, Grep, Bash, Write, Edit | No (docs only) | Audits documentation against codebase state; checks directory structure drift, tech stack drift, API route drift, component count drift, rule file relevance; writes only to CLAUDE.md, rules/, claudedocs/ |
| `requirement-analyst` | sonnet | Read, Glob, Grep, WebSearch | No (read-only) | Explores new feature ideas; evaluates impact across 6 dimensions (mapping, confidence, data model, i18n, API, UI); checks for overlap with existing features; directs to /plan-story or /plan-change |
| `session-manager` | haiku | Read, Glob, Grep, Bash, Write, Edit | No (docs only) | End-of-session automation (SITUATION-5); captures git changes, identifies related CHANGE/FIX docs, generates progress summary, runs quality checks, updates tracking docs, drafts commit message |
| `test-strategist` | sonnet | Read, Glob, Grep | No (docs only) | Plans test strategy after feature development; determines test types needed per file category; designs test cases with domain-specific coverage (mapping tiers, confidence boundaries, i18n); generates TEST-PLAN documents |

### Model Distribution

| Model | Count | Use Case |
|-------|-------|----------|
| opus | 1 | Code implementation (highest capability needed) |
| sonnet | 6 | Analysis, review, planning (balanced capability/cost) |
| haiku | 2 | Structural tasks (i18n-guardian, session-manager - cost-efficient) |

---

## 5. Skills (4 slash commands)

| Skill | Trigger | Purpose | Key Features |
|-------|---------|---------|-------------|
| `/plan-change` | User invocation | Create CHANGE-XXX planning doc for feature modifications | Auto-scans for next available number (must use `CHANGE-*.md` glob to avoid number segment gaps); collects change info via Q&A; auto-analyzes impact on i18n/Prisma/API/components/services; generates structured markdown in `claudedocs/4-changes/feature-changes/` |
| `/plan-fix` | User invocation | Create FIX-XXX planning doc for bug fixes | Same number-scanning safety rule as plan-change; collects bug info (discovery method, reproduction steps); auto-analyzes related code areas; generates structured markdown in `claudedocs/4-changes/bug-fixes/` |
| `/plan-story` | User invocation | Create complete Story + Tech Spec + Prompt Template for new features | Generates 3 files: Story doc, Tech Spec doc, prompt entry in `all-story-prompts.md`; includes forced completion checklist (type-check, lint, sprint-status update, git commit) |
| `/quickcompact` | User invocation | Save session state and compact context | Generates 400-word summary with 4 sections: key decisions, file status table, next steps, blockers; then executes /compact with the summary |

---

## 6. Claude Code Settings

### Local Settings (`.claude/settings.local.json`)

**Experimental flags**:
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`: `"1"` (enables parallel agent orchestration)

**Permissions**: 100+ explicitly allowed operations including:
- Git operations: init, add, commit, branch, push, checkout, clone, mv
- NPM: install, run (type-check, lint, build, dev, db:seed, test), npx (prisma, shadcn, ts-node)
- Docker: compose up/ps, exec, inspect
- System: findstr, powershell, curl, timeout, taskkill, wc
- BMAD workflows: Multiple slash commands for product-brief, PRD, UX design, sprint planning, story creation, etc.
- WebSearch and WebFetch (github.com, ui.shadcn.com domains)

---

## 7. BMAD Framework Integration

50+ external BMAD (Business Model Architecture Design) commands installed under `.claude/commands/bmad/`:

| Module | Count | Key Commands |
|--------|-------|-------------|
| `bmm/workflows/` | 30+ | create-product-brief, create-prd, create-architecture, create-epics-stories, create-story, create-tech-spec, dev-story, quick-dev, sprint-planning, sprint-status, code-review, correct-course, retrospective, research, 6x testarch-* workflows, 4x create-excalidraw-* visualization |
| `bmm/agents/` | 9 | analyst, architect, dev, pm, quick-flow-solo-dev, sm, tea, tech-writer, ux-designer |
| `bmb/workflows/` | 6 | create-agent, create-module, create-workflow, edit-agent, edit-workflow, workflow-compliance-check |
| `core/` | 5 | bmad-master agent, party-mode workflow, brainstorming-session, advanced-elicitation task, shard-doc tool, index-docs task |

---

## 8. AI Development Workflow Integration

### Document-Driven Development Cycle

```
1. Requirement Discovery     -> requirement-analyst agent
2. Planning                  -> /plan-story, /plan-change, /plan-fix skills
3. Architecture Review       -> architecture-reviewer agent
4. Scaffolding               -> fullstack-scaffolder agent
5. Implementation            -> code-implementer agent (opus model)
6. Quality Check             -> code-quality-checker agent
7. i18n Validation           -> i18n-guardian agent
8. Test Planning             -> test-strategist agent
9. Session Save              -> session-manager agent, /quickcompact skill
10. Documentation Audit      -> project-analyst agent
```

### Parallel Agent Orchestration Protocol

Defined in root CLAUDE.md, triggered automatically when:
- 2+ independent CHANGE/FIX items being developed
- Single feature splits into 3+ independent modules
- 5+ independent file modifications
- User explicitly requests parallel work

5-step flow: Explore & Plan -> Parallel Dispatch (run_in_background) -> Monitor & Aggregate -> Unified Verification (type-check, lint, i18n:check) -> Unified Commit (only on user request)

Constraints: No parallel modification of same file; i18n unified after all agents complete; no git operations inside agents; dependency ordering via TaskUpdate `addBlockedBy`.

---

## 9. Situation Prompts

6 predefined situation prompts in `claudedocs/6-ai-assistant/prompts/`:

| ID | File | Use Case |
|----|------|----------|
| SITUATION-1 | `PROJECT-ONBOARDING.md` | New conversation startup, project introduction |
| SITUATION-2 | `FEATURE-DEV-PREP.md` | Pre-development task analysis |
| SITUATION-3 | `FEATURE-ENHANCEMENT.md` | Feature enhancement, code optimization |
| SITUATION-4 | `NEW-FEATURE-DEV.md` | New feature implementation |
| SITUATION-5 | `SAVE-PROGRESS.md` | Save progress, end session |
| SITUATION-6 | `SERVICE-STARTUP.md` | Service startup, environment restart |
| SITUATION-7 | `SEED-DATA-MAINTENANCE.md` | Seed data maintenance, deployment |

---

## 10. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Skills for planning, not agents | Planning docs need user interaction during creation |
| Agents for background analysis | Analysis runs independently, reports back |
| haiku for structural tasks | i18n-guardian and session-manager are pattern-matching tasks; cost-efficient |
| opus only for code-implementer | Code writing requires highest reasoning capability |
| 9 separate rule files with path scoping | Rules auto-load only for relevant file types; keeps context focused |
| BMAD framework co-installed | Provides additional PM/architecture/sprint workflows beyond project-specific tools |
| Explicit permission allowlist | Fine-grained control over which bash commands, tools, and web domains the AI can access |
