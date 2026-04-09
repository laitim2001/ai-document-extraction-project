# Codebase Analysis Playbook

A systematic methodology for comprehensive codebase understanding, documentation, and verification. Derived from real-world analysis of a 200+ table, 13-project enterprise ERP system.

---

## Overview

This playbook produces a complete set of analysis documents that serve as a **living reference** for any codebase. The process has 6 phases, designed to be executed sequentially with Claude Code.

**Expected output**: 10-15 analysis documents + 10-20 detailed module reports + system diagrams  
**Expected effort**: 3-5 sessions depending on codebase size  
**Verification target**: 95%+ accuracy across 1,000+ sampling points

---

## Phase 1: Project Skeleton & Technology Inventory

### Goal
Understand the project structure, technology stack, and high-level architecture before diving into code.

### Prompt Template

```
Analyze this codebase and produce a comprehensive project overview document. Cover:

1. **Technology Stack**: Framework, language, DB, ORM, UI controls, external libraries
2. **Solution Structure**: List all projects/modules with their purpose (1-2 sentences each)
3. **Key Architecture Patterns**: Data access, authentication, page lifecycle, error handling
4. **External Integrations**: APIs, services, file exchanges, messaging
5. **Build & Run**: How to build, required dependencies, environment setup
6. **Coding Conventions**: Naming patterns, file organization, code style

Output as a single Markdown file. Keep each section concise but complete.
Do NOT guess - only document what you can verify in the actual code.
```

### Key Actions
- Glob for solution/project files (`.sln`, `.csproj`, `package.json`, `pom.xml`, etc.)
- Read main config files (`Web.config`, `appsettings.json`, `.env.example`, etc.)
- Count files by type to understand scale
- Identify entry points (Main, Startup, Program.cs, index.ts, etc.)

### Output
- `CLAUDE.md` (root) - project overview for Claude Code context
- `docs/00-project-overview.md` - full technology inventory

---

## Phase 2: Module-by-Module Functional Mapping

### Goal
Map every module/folder to its business purpose, key files, and dependencies.

### Prompt Template

```
For each major module/folder in this project, produce a functional analysis covering:

1. **Module Purpose**: What business function does this serve? (1-2 sentences)
2. **Page/Endpoint Inventory**: List all pages, controllers, or API endpoints with their function
3. **Key Files**: The most important files and why
4. **Data Flow**: What data does this module read/write? Which tables/APIs?
5. **Dependencies**: Which other modules does this depend on or get called by?
6. **Business Classes**: Key classes and their responsibilities

Group modules by business domain. Produce one overview file per domain group,
plus one detailed file per major module.

Focus on WHAT each file does, not line-by-line code explanation.
```

### Phased Approach (for large codebases)
Split into logical groups based on the architecture:

| Phase | Scope | Example |
|-------|-------|---------|
| P1 | Core/shared libraries | Business classes, base classes, utilities, integrations |
| P2 | Feature modules (by domain) | User-facing features grouped by business area |
| P3 | Data layer + Infrastructure | ORM/DB models, background jobs, migrations, DevOps |

### Output
- `docs/01-module-overview.md` through `docs/0N-xxx.md` (overview per domain)
- `docs/detail/P1-xxx.md`, `P2-xxx.md`, `P3-xxx.md` (detailed per module)
- Subfolder `CLAUDE.md` files for each major directory

---

## Phase 3: Database & Data Layer Analysis

### Goal
Document all data persistence objects and their relationships to application code.

### Prompt Template

```
Analyze the data/persistence layer of this project. Inventory ALL objects that
exist in your stack, and cross-reference each with its usage in application code.

Pick the sections that apply to your technology:

## For SQL databases (SQL Server, PostgreSQL, MySQL, etc.)
1. **Table Inventory**: All tables with column counts, primary keys, and purpose
2. **View Inventory**: All views with their source tables and business meaning
3. **Stored Procedures / Functions**: All SPs/functions with parameters and callers
4. **Triggers**: All triggers and their purpose
5. **Indexes**: Key indexes and their performance implications
6. **Migrations**: Migration history and pending changes

## For NoSQL databases (MongoDB, DynamoDB, Firebase, etc.)
1. **Collection/Table Inventory**: All collections with schema patterns and purpose
2. **Index Definitions**: All indexes (compound, TTL, geospatial, etc.)
3. **Aggregation Pipelines / Queries**: Complex queries documented

## For ORM / Data Models
1. **Model/Entity Inventory**: All models with field counts and relationships
2. **Association/Relationship Map**: FK, belongs_to, has_many, etc.
3. **Migration History**: Schema evolution over time

## For API-driven data (GraphQL, REST, gRPC)
1. **Schema/Endpoint Inventory**: All types, queries, mutations, endpoints
2. **Resolver/Handler Map**: Which code handles which data operation

Cross-reference every data object with its usage in application code.
Flag any orphaned objects (defined but never called from code).
```

### Data Sources (in priority order)
1. Production DB definition scripts / schema dumps (if available)
2. Migration files (Flyway, Liquibase, EF Migrations, Alembic, Knex, Prisma, etc.)
3. ORM model definitions (DbContext, Sequelize, Prisma schema, SQLAlchemy, ActiveRecord, etc.)
4. Direct DB connection (read-only)
5. API schema files (OpenAPI/Swagger, GraphQL SDL, .proto files)

### Technology-Specific Tips

| Technology | Watch Out For |
|-----------|---------------|
| SQL Server | `sys.columns.max_length` returns BYTES not CHARS for nvarchar (divide by 2) |
| PostgreSQL | Schema namespaces (public vs custom); check `pg_catalog` for system objects |
| MySQL | `SHOW CREATE TABLE` for actual DDL; charset affects column sizes |
| MongoDB | Schema-less = document samples needed; use `$jsonSchema` if defined |
| Prisma/Sequelize | Generated types may differ from actual DB; verify both sides |
| Entity Framework | EDMX Database-First models may have schema drift across multiple .edmx files |

### Output
- `docs/database/` - DB/data object inventories
- Cross-reference tables (which data object is used by which module)
- Baseline counts for verification

---

## Phase 4: System Diagrams

### Goal
Create visual representations of architecture, data flow, and business processes.

### Prompt Template

```
Create Mermaid diagrams for this system. For each diagram:
1. Base it ONLY on verified documentation and source code
2. Include file paths or line numbers as comments for traceability
3. Keep each diagram focused (one concept per diagram)

Produce these diagram types:
- System architecture (high-level component view)
- Module dependency graph
- Database ER diagram (key tables only, not all 200)
- Key business process flows (order lifecycle, batch processing, etc.)
- Authentication/authorization flow
- External integration flows
- Deployment architecture (if applicable)

Use Mermaid syntax. Each diagram should have a title and brief description.
```

### Diagram Categories

| Category | What to show |
|----------|-------------|
| Architecture | Projects, layers, external systems |
| Data Flow | How data moves between modules |
| ER Diagram | Table relationships (group by domain) |
| Process Flow | Business workflows step by step |
| Sequence | Key page interactions, API call chains |

### Output
- `docs/diagrams/` - all Mermaid diagram files
- Embed diagrams in relevant module docs

---

## Phase 5: Multi-Round Verification

### Goal
Systematically verify documentation accuracy against actual source code through progressive sampling.

### Methodology: 5-Level Verification Depth

```
Level 1 - Existence Check (easiest):
  "Does this file/class/table exist at the stated path?"

Level 2 - Count Verification:
  "Are the stated counts correct? (X tables, Y methods, Z pages)"

Level 3 - Signature Verification:
  "Do method signatures, parameter types, return types match?"

Level 4 - Semantic Verification:
  "Does the described behavior match the actual code logic?"

Level 5 - Cross-Reference Verification:
  "Are cross-document references consistent? Do SP calls match?"
```

### Verification Prompt Template

```
You are verifying documentation accuracy against actual source code.

## Target File
`docs/detail/[MODULE].md`

## Rules
- Only do research (Read, Grep, Glob). Do NOT edit any files.
- For each check: [PASS] or [FAIL] + one-line description
- For failures: state what doc says vs what code actually shows
- Aim for ~100 verification points

## What to Verify

### Set A: [Category] (~N points)
[Specific instructions for what to check and how]

### Set B: [Category] (~N points)
[Specific instructions for what to check and how]

## Output Format
Final summary: total checked, PASS count, FAIL count, list of ALL failures.
```

### Verification Rounds Strategy

| Round | Focus | Points | Depth |
|-------|-------|--------|-------|
| R1-R2 | File existence, basic counts | 200-400 | Level 1-2 |
| R3-R4 | Method signatures, control names | 400-600 | Level 3 |
| R5-R6 | Business logic, query patterns, data access calls | 500+ | Level 4 |
| R7-R8 | Cross-doc consistency, edge cases, config values | 500+ | Level 5 |
| R9+ | Diminishing returns - stop or go deeper on specific modules | 500+ | Level 4-5 |

### Parallel Verification Pattern

Launch 5 agents simultaneously, each covering a different document group:

```
Agent 1: Core/shared layer docs (base classes, utilities, integrations)
Agent 2: Feature module group A docs (e.g., Users + Auth + Permissions)
Agent 3: Feature module group B docs (e.g., Products + Orders + Payments)
Agent 4: Feature module group C docs (e.g., Reports + Admin + Settings)
Agent 5: Data/infra layer docs (DB models, migrations, jobs, workers)
```

Each agent should target ~100 points for a total of ~500 per round.

### Tracking Verification Results

Maintain a running tally:

```markdown
| Round | Points | Errors | Fixed | Accuracy |
|-------|--------|--------|-------|----------|
| R1    | 200    | 5      | 5     | 97.5%    |
| R2    | 300    | 3      | 3     | 99.0%    |
| ...   | ...    | ...    | ...   | ...      |
| Total | 3,000  | 15     | 15    | 99.5%    |
```

### When to Stop Verification
- Consecutive 500+ points with 0 errors = high confidence
- Accuracy stabilized above 99% for 2+ rounds
- All document sections have been sampled at least once
- Diminishing returns: finding only presentation issues, not factual errors

---

## Phase 6: Maintenance & Refresh

### Goal
Keep documentation current as the codebase evolves.

### CLAUDE.md Rules (for Claude Code auto-maintenance)

Create `.claude/rules/` with:

```markdown
# claude-md-maintenance.md
When making significant code changes, check if the folder's CLAUDE.md needs updating.

Update when: new files added, files deleted/renamed, architecture changes,
new issues discovered, security issues found/fixed.

Do NOT update for: minor bug fixes, formatting, adding comments.
```

```markdown
# development-log.md
When completing significant work, record it in docs/development-log/.

Log: bug fixes with root cause, new features, architecture decisions,
security issues, schema changes, integration changes.

Format: ## [HH:MM] Title / Scope / Change / Key decisions / Issues / Testing
```

### Periodic Health Check Prompt

```
Audit all CLAUDE.md and documentation files in this project:

1. Check each CLAUDE.md is under 180 lines
2. Verify file references still exist (no stale paths)
3. Verify counts still match (table counts, page counts, etc.)
4. Check for any new files not mentioned in docs
5. Report a health score for each file

Output a summary table with file path, health score, and issues found.
```

---

## Quick-Start Prompt

For a brand new project, use this all-in-one prompt to kick off Phase 1-2:

```
I want you to perform a comprehensive analysis of this entire codebase.

## Step 1: Project Overview
Scan the full project structure and produce a technology inventory:
- Framework, language, database, libraries, external integrations
- Solution/project structure with purpose of each module
- Key architecture patterns
- Build and run instructions

## Step 2: Module Mapping
For each major folder/module:
- List all files with their purpose (1 sentence each)
- Identify key classes, pages, or endpoints
- Map data flow (which tables/APIs does it touch?)
- Note cross-module dependencies

## Step 3: Data / Persistence Layer
Inventory all data objects that apply to this project's stack:
- DB tables, collections, views, stored procedures, functions, triggers, migrations
- ORM models, API schemas, GraphQL types
- Cross-reference each with application code usage

## Output Structure
Create these files:
- CLAUDE.md (root) - project context for future sessions
- docs/00-project-overview.md - technology stack and architecture
- docs/01-module-index.md through docs/0N-xxx.md - module overviews
- docs/detail/P1-xxx.md through P3-xxx.md - detailed module analysis
- CLAUDE.md in each major subfolder

## Rules
- Only document what you can verify in actual code
- Include file counts and object counts as baseline for future verification
- Flag security issues, dead code, and technical debt as you find them
- Use English for all documentation
- Keep each file under 200 lines; split into detail files if needed
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Do This Instead |
|-------------|-------------|-----------------|
| Reading entire files into context | Context overflow, loses focus | Grep for specific patterns, read targeted sections |
| Verifying the same things twice | Wastes budget, inflates numbers | Track what was verified, pass exclusion lists to agents |
| Guessing when you can check | Accumulates silent errors | Always verify against source code before documenting |
| One giant document | Unusable, hard to maintain | Split by module, keep each file < 200 lines |
| Documenting line-by-line | Too detailed, instantly stale | Document WHAT and WHY, not every HOW |
| Fixing code during verification | Scope creep, risky changes | Verify first, fix separately, commit separately |
| Counting sub-agent points loosely | Inflated confidence | Use conservative counting, verify agent "FAIL" reports |

---

## Metrics from Real-World Case Study

Reference data from applying this playbook to a 13-project .NET enterprise ERP system (ASP.NET Web Forms, SQL Server, 200+ tables). Your numbers will vary by codebase size and complexity:

| Metric | Value |
|--------|-------|
| Total verification points | 3,738 |
| Errors found | 16 |
| Errors fixed | 16 |
| Final accuracy | 99.57% |
| Documents produced | 34 analysis files + 20 diagrams + 38 CLAUDE.md |
| Verification rounds | 16 (R1-R16) |
| Consecutive zero-error points | 1,049 (R13+R14) |

### Error Distribution by Type

| Error Type | Count | Example |
|-----------|-------|---------|
| Data source attribution | 3 | "Currency from CodeMaster" vs actual "customer table JOIN" |
| Property count mismatch | 2 | EDMX says 46, generated .cs has 9 (Schema Drift) |
| Count/quantity errors | 5 | SP count, function count discrepancies |
| Classification errors | 3 | Wrong category or grouping |
| Config value errors | 2 | Incorrect parameter descriptions |
| Stale references | 1 | Reference to non-existent file |

---

## File Structure Template

```
project-root/
  CLAUDE.md                          # Root project context (< 180 lines)
  .claude/rules/
    claude-md-maintenance.md         # Auto-maintenance rules
    development-log.md               # Logging rules
  docs/
    00-project-overview.md           # Tech stack, architecture
    01-module-A-overview.md          # Module group overviews
    02-module-B-overview.md
    ...
    05-workflows-and-batch.md        # Cross-cutting concerns
    07-database-object-index.md      # DB object inventory
    08-report-index.md               # Reports inventory (if applicable)
    09-security-and-tech-debt.md     # Issues found during analysis
    detail/
      P1-core-classes.md             # Detailed analysis per area
      P2-module-A-detail.md
      P2-module-B-detail.md
      P3-data-models.md
      P3-workflows.md
    diagrams/
      01-system-architecture.md      # Mermaid diagrams
      02-data-flow.md
      ...
    development-log/
      development-log-YYYYMMDD.md    # Work history
  module-A/
    CLAUDE.md                        # Subfolder context
  module-B/
    CLAUDE.md
```

---

## License

This playbook is open for reuse and adaptation. Attribution appreciated but not required.
