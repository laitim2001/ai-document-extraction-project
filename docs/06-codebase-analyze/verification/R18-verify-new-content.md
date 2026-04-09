# R18: CHANGE/FIX Documentation, Project Structure, OpenAPI & Seed Data Verification

> **Generated**: 2026-04-09
> **Scope**: 125 verification points across 4 categories
> **Status**: COMPLETE

---

## Set A: CHANGE/FIX Document Verification (~50 pts)

### A1. CHANGE Document Count

| Metric | Value |
|--------|-------|
| **Active CHANGE docs** (`claudedocs/4-changes/feature-changes/`) | **53** |
| Archive CHANGE docs (`claudedocs/7-archive/sample-project-files/`) | 2 (sample project, not this project) |
| Numbering range | CHANGE-001 through CHANGE-053 |
| Numbering gaps | **None** (all 53 numbers present) |

### A2. FIX Document Count

| Metric | Value |
|--------|-------|
| **Active FIX docs** (`claudedocs/4-changes/bug-fixes/`) | **52** |
| Numbering range | FIX-001 through FIX-049 + FIX-019b + FIX-024b + FIX-026b |
| Numbering gaps | **None** (all 49 base numbers present, plus 3 b-suffix docs) |

### A3. CLAUDE.md Claim vs Actual Count

| Item | CLAUDE.md Claim | Actual Count | Variance | Verdict |
|------|-----------------|--------------|----------|---------|
| CHANGE docs | 33 | **53** | **+20 (+60%)** | OUTDATED |
| FIX docs | 35 | **52** | **+17 (+49%)** | OUTDATED |

> **Finding**: CLAUDE.md states "累計 33 CHANGE + 35 FIX" which is **significantly outdated**. The actual counts are 53 CHANGE + 52 FIX (total 105 vs claimed 68). The CLAUDE.md was last updated 2026-02-23 but development continued through at least CHANGE-053 and FIX-049 (2026-03-02).

### A4. CHANGE Document Status Summary (20 sampled + full scan)

| Status | Count | % |
|--------|-------|---|
| Explicitly marked completed (various markers) | 39 | 74% |
| Explicitly marked planning | 1 (CHANGE-052) | 2% |
| Status in non-standard format / table / implied by completion date | 13 | 24% |

**20 CHANGE Docs Sampled (title + status verification):**

| Doc | Title | Status Verified |
|-----|-------|-----------------|
| CHANGE-001 | Native PDF 雙重處理架構增強 | ✅ 已完成 |
| CHANGE-004 | Azure DI BoundingBox 座標提取 | ✅ 已完成 |
| CHANGE-005 | 統一管道步驟重排序 | ✅ 已完成 |
| CHANGE-006 | GPT Vision 動態配置提取與 Term 記錄 | ✅ 已完成 |
| CHANGE-010 | 批次處理並行化優化 | No status emoji; has 完成日期: 2026-01-19 |
| CHANGE-015 | 端到端管線整合 Phase 3 | ✅ 已完成 |
| CHANGE-020 | 新提取架構測試 - Azure DI prebuilt-document | ✅ 已完成（取代by CHANGE-021） |
| CHANGE-025 | 統一文件處理流程架構優化 | ✅ 已完成 |
| CHANGE-030 | Sidebar Navigation Reorganization | ✅ 已完成 |
| CHANGE-035 | 參考編號匯入功能改為 Excel 格式 | ✅ 已完成 |
| CHANGE-038 | Template Field Mapping Source Field 動態載入 | No status emoji in header |
| CHANGE-041 | 文件列表頁整合批量匹配對話框 | ✅ 已完成 |
| CHANGE-043 | Line Item Pivot 展平策略 | ✅ 已完成 |
| CHANGE-045 | FieldDefinitionSet 欄位類型區分 | ✅ 已完成 |
| CHANGE-047 | 注入 Reference Number 到 Template Instance Row | ✅ 已完成 |
| CHANGE-049 | User Profile 個人資料頁面 | ✅ 已完成 |
| CHANGE-050 | System Settings Hub 統一系統設定頁面 | ✅ 已完成 |
| CHANGE-051 | Extracted Fields 顯示重構 | ✅ 已完成 |
| CHANGE-052 | GLOBAL_ADMIN 角色名稱統一修正 | 📋 規劃中 |
| CHANGE-053 | 增強 Stage 2 格式識別硬編碼 Prompt | ✅ 已完成 (in table format) |

### A5. FIX Document Status Summary (15 sampled + full scan)

| Status | Count | % |
|--------|-------|---|
| ✅ 已完成 | 19 | 37% |
| ✅ 已修復 | 19 | 37% |
| ✅ 已解決 | 1 | 2% |
| ⏸️ 已取代 | 1 (FIX-010, replaced by FIX-026) | 2% |
| No status emoji / non-standard format | 12 | 23% |

**15 FIX Docs Sampled (title + status verification):**

| Doc | Title | Status Verified |
|-----|-------|-----------------|
| FIX-001 | Code Review P1 Bug Fixes | Status: Fixed (English, no emoji) |
| FIX-005 | GPT_VISION 處理缺少發行者識別 | No explicit status in header |
| FIX-010 | pdfjs-dist v5 ESM Module Error | ⏸️ 已取代（被 FIX-026 取代） |
| FIX-015 | Export Script Address Filtering | ✅ 已完成 |
| FIX-019 | pdfjs-dist Next.js 伺服器環境相容性問題 | ✅ 已解決 |
| FIX-019b | 匯出空白 Excel - 認證重導向問題 | ✅ 已修復 |
| FIX-024 | Hooks API Path Errors | ✅ 已修復 |
| FIX-024b | EmailNotVerified 錯誤訊息未正確顯示 | ✅ 已修復 (implied) |
| FIX-026 | pdfjs-dist v5 ESM 最終解決方案 | ✅ 已完成 |
| FIX-030 | 生產模式認證與 Session 同步問題 | ✅ 已完成 |
| FIX-035 | Companies 頁面構建快取與 Locale 問題 | ✅ 已完成 (implied) |
| FIX-039 | extracted-fields API 查詢不存在的 HistoricalFile 表 | ✅ 已修復 |
| FIX-043 | FieldDefinitionSet 欄位定義未注入 Stage 3 Prompt | ✅ 已修復 |
| FIX-046 | Mapping Rule Transform Type Stale Closure 問題 | ✅ 已完成 |
| FIX-048 | 提取管線缺失 ProcessingQueue 記錄建立 | ✅ 已完成 |
| FIX-049 | Seed/Static Prompts Stage 2 內容錯誤 + 信心度範圍不一致 | ✅ 已完成 |

### A6. Status Format Inconsistency Issue

**13 CHANGE docs and 12 FIX docs** lack a standard status emoji marker in the first 10 lines of the file. These docs use varying formats:
- Completion date field without explicit status (e.g., CHANGE-010: "完成日期: 2026-01-19")
- English "Status: Fixed" (e.g., FIX-001)
- Status embedded in markdown table rows (e.g., CHANGE-053)
- No status field at all in some early docs

> **Recommendation**: Standardize all CHANGE/FIX docs to have `> **狀態**: ✅ 已完成` in the first 5 lines for tooling/scanning consistency.

### A7. Cross-Reference: 10 CHANGE/FIX Docs vs Actual Code

| Doc | Feature Described | Code Evidence | Verified |
|-----|-------------------|---------------|----------|
| CHANGE-007 | Forwarders to Companies path refactor | `src/app/*/companies/` directory exists with CRUD pages | ✅ |
| CHANGE-030 | Sidebar navigation reorganization | `Sidebar` component in `src/components/layout/` imported by `DashboardLayout.tsx` | ✅ |
| CHANGE-035 | Reference number Excel import | `src/app/api/v1/reference-numbers/import/route.ts` exists | ✅ |
| CHANGE-038 | Template field mapping dynamic source | `src/app/[locale]/(dashboard)/admin/template-field-mappings/` exists with new/[id]/page.tsx | ✅ |
| CHANGE-049 | User profile page | `src/app/[locale]/(dashboard)/profile/{page.tsx,client.tsx}` exists | ✅ |
| CHANGE-050 | System settings hub | `src/app/[locale]/(dashboard)/admin/settings/{page.tsx,client.tsx}` exists | ✅ |
| FIX-029 | i18n missing translations | 34 JSON files per language (en, zh-TW, zh-CN) = 102 total confirmed | ✅ |
| FIX-039 | extracted-fields API historical file | API route structure confirmed in v1/formats/ | ✅ |
| CHANGE-041 | Document list bulk match dialog | Documents page exists with bulk match integration | ✅ |
| CHANGE-043 | Line item pivot flatten | Service and component code paths exist | ✅ |

**Result: 10/10 cross-references confirmed** — all CHANGE/FIX docs describe features that have corresponding code artifacts.

---

## Set B: Project Documentation Structure (~25 pts)

### B1. File Counts by Documentation Directory

| Directory | File Count | Notes |
|-----------|------------|-------|
| `docs/01-planning/` | 3 entries (README.md, prd/, ux/) | Contains PRD and UX subdirs |
| `docs/02-architecture/` | 11 files | Architecture docs, confidence thresholds |
| `docs/03-epics/` | 23 files | Epic definition files |
| `docs/04-implementation/` | 315 files | Stories, tech-specs, prompt-templates, sprint-status.yaml |
| `docs/05-analysis/` | 29 files | Analysis reports |
| `docs/06-codebase-analyze/` | 55+ files | Verification reports (R1-R17 rounds) |

> **Path Discrepancy**: CLAUDE.md references `docs/03-stories/tech-specs/` but the actual directory is `docs/03-epics/` for epic files. Tech specs are at `docs/04-implementation/tech-specs/`. The `docs/03-stories/` directory does **not exist** (empty, not tracked in git).

### B2. CLAUDE.md "按需查閱文檔索引" Path Verification

| # | Referenced Path | Exists? |
|---|----------------|---------|
| 1 | `claudedocs/reference/directory-structure.md` | ✅ |
| 2 | `claudedocs/reference/dev-checklists.md` | ✅ |
| 3 | `claudedocs/reference/project-progress.md` | ✅ |
| 4 | `claudedocs/CLAUDE.md` | ✅ |
| 5 | `.claude/CLAUDE.md` | ✅ |
| 6 | `docs/04-implementation/sprint-status.yaml` | ✅ |
| 7 | `.claude/rules/general.md` | ✅ |
| 8 | `.claude/rules/typescript.md` | ✅ |
| 9 | `.claude/rules/i18n.md` | ✅ |
| 10 | `docs/01-planning/prd/prd.md` | ✅ |

**Additional paths verified:**
- `docs/04-implementation/implementation-context.md` — ✅ EXISTS
- `docs/02-architecture/` — ✅ EXISTS (11 files)
- `docs/04-implementation/tech-specs/` — ✅ EXISTS
- `docs/03-stories/tech-specs/` — **MISSING** (referenced in CLAUDE.md AI 開發輔助指引 section, should be `docs/04-implementation/tech-specs/`)

**Result: 10/10 indexed paths exist. 1 additional path in CLAUDE.md body is incorrect (`docs/03-stories/tech-specs/`).**

### B3. Sprint-Status.yaml vs CLAUDE.md Claims

| Claim | CLAUDE.md | sprint-status.yaml | Match? |
|-------|-----------|---------------------|--------|
| Total Epics | 22 | **22** (epic-0 through epic-21) | ✅ |
| All Epics done | "全部 22 個 Epic 已完成" | All 22 show `done` status | ✅ |
| Story count | "157+ Stories" | **150 stories** counted (grep `^  [0-9]+-[0-9]+-`) | **~150, not 157+** |
| Total done entries | — | 174 `done` entries (includes epics, retrospectives, refactors) | — |

> **Finding**: The story count of ~150 is slightly below the "157+" claim. This could be due to counting methodology — the 150 count only matches lines starting with story-format IDs. Including `refactor-001`, additional sub-entries, and counting methodology differences could account for the gap. The claim is approximately correct.

---

## Set C: OpenAPI Spec Verification (~25 pts)

### C1. OpenAPI Spec Location & Existence

| Item | Value |
|------|-------|
| **File path** | `openapi/spec.yaml` |
| **Exists** | ✅ Yes |
| **Size** | 30,181 bytes |
| **Version** | OpenAPI 3.0.3 |
| **API Title** | "Invoice Extraction API" |
| **API Version** | 1.0.0 |

### C2. Spec Endpoint Count

| Metric | Count |
|--------|-------|
| **Paths defined** | 7 |
| **HTTP methods defined** | 10 |
| **Actual API route files** | 331 |
| **Coverage** | **~2%** (7/331 paths) |

**Paths in spec:**
1. `/invoices` (GET, POST)
2. `/invoices/{taskId}` (GET)
3. `/tasks/{taskId}/status` (GET)
4. `/webhooks` (GET, POST)
5. `/webhooks/{webhookId}` (GET, PATCH, DELETE)
6. `/webhooks/{webhookId}/deliveries` (GET)
7. `/webhooks/{webhookId}/deliveries/{deliveryId}/retry` (POST)

### C3. Spec vs Actual Routes Comparison (10 endpoints)

| Spec Path | Actual Route Exists? | Notes |
|-----------|---------------------|-------|
| `/invoices` | ✅ `src/app/api/v1/invoices/route.ts` | Matches |
| `/invoices/{taskId}` | ✅ `src/app/api/v1/invoices/[taskId]/route.ts` | Matches |
| `/tasks/{taskId}/status` | ❌ No `/api/v1/tasks/` directory | **Spec path not implemented** |
| `/webhooks` | ✅ `src/app/api/v1/webhooks/route.ts` | Matches |
| `/webhooks/{webhookId}` | ✅ `src/app/api/v1/webhooks/[webhookId]/route.ts` | Matches |
| Actual: `/documents/*` | ❌ Not in spec | Major domain missing |
| Actual: `/admin/*` | ❌ Not in spec | Largest domain missing |
| Actual: `/companies/*` | ❌ Not in spec | Major domain missing |
| Actual: `/rules/*` | ❌ Not in spec | Major domain missing |
| Actual: `/v1/exchange-rates/*` | ❌ Not in spec | Missing |

### C4. Spec Maintenance Status

| Item | Value |
|------|-------|
| **Auto-generated?** | No — manually maintained |
| **Git commits** | 1 only (`e3aeac3` — Epic 11 Story 11-6) |
| **Last updated** | 2024-12-21 (over 15 months ago) |
| **Staleness** | **SEVERELY STALE** — covers only 7 of 331 route files |

> **Finding**: The OpenAPI spec is essentially a **skeleton** created during Epic 11 and never maintained since. It covers only the external-facing `/invoices` and `/webhooks` endpoints from the initial API design. The 300+ internal admin, document, company, rules, template, and v1 endpoints are completely absent. The `/tasks/{taskId}/status` path defined in the spec doesn't even have a corresponding route implementation.

---

## Set D: Seed Data Verification (~25 pts)

### D1. Seed File Overview

| Item | Value |
|------|-------|
| **Main seed file** | `prisma/seed.ts` (1,456 lines) |
| **Seed data modules** | 7 files in `prisma/seed-data/` |
| **Exported data** | `prisma/seed/exported-data.json` (169 KB) |
| **Idempotency** | ✅ Uses `upsert` pattern throughout |

**Seed data module files:**
1. `forwarders.ts` — Company (Forwarder) definitions
2. `mapping-rules.ts` — Universal + company-specific mapping rules
3. `config-seeds.ts` — System configuration
4. `prompt-configs.ts` — Prompt configuration seeds
5. `field-mapping-configs.ts` — Field mapping configuration
6. `alert-rules.ts` — Alert rule definitions
7. `exchange-rates.ts` — Exchange rate seeds

### D2. Region Verification

| Region Code | Name | Timezone | Verified |
|-------------|------|----------|----------|
| GLOBAL | Global | UTC | ✅ |
| APAC | Asia Pacific | Asia/Hong_Kong | ✅ |
| EMEA | Europe, Middle East & Africa | Europe/London | ✅ |
| AMER | Americas | America/New_York | ✅ |

**Total regions: 4 (including GLOBAL)** — ✅ Matches R14 finding.

### D3. City Verification

| # | Code | Name | Region | Currency | Verified |
|---|------|------|--------|----------|----------|
| 1 | TPE | Taipei | APAC | TWD | ✅ |
| 2 | HKG | Hong Kong | APAC | HKD | ✅ |
| 3 | SGP | Singapore | APAC | SGD | ✅ |
| 4 | TYO | Tokyo | APAC | JPY | ✅ |
| 5 | SHA | Shanghai | APAC | CNY | ✅ |
| 6 | SYD | Sydney | APAC | AUD | ✅ |
| 7 | LON | London | EMEA | GBP | ✅ |
| 8 | FRA | Frankfurt | EMEA | EUR | ✅ |
| 9 | NYC | New York | AMER | USD | ✅ |
| 10 | LAX | Los Angeles | AMER | USD | ✅ |

**Total cities: 10** — ✅ Matches expected count.

### D4. Company (Forwarder) Verification

| # | Code | Name | Category |
|---|------|------|----------|
| 1 | DHL | DHL Express | Express |
| 2 | FDX | FedEx | Express |
| 3 | UPS | UPS | Express |
| 4 | TNT | TNT Express | Express |
| 5 | MAERSK | Maersk | Ocean |
| 6 | MSC | MSC | Ocean |
| 7 | CMACGM | CMA CGM | Ocean |
| 8 | HLAG | Hapag-Lloyd | Ocean |
| 9 | EVRG | Evergreen | Ocean |
| 10 | COSCO | COSCO | Ocean |
| 11 | ONE | ONE | Ocean |
| 12 | YML | Yang Ming | Ocean |
| 13 | SF | SF Express | Regional |
| 14 | KERRY | Kerry Logistics | Regional |
| 15 | UNKNOWN | Unknown | Unknown |

**Total companies: 15** — ✅ Matches expected count (14 named + 1 UNKNOWN).

> **Note**: CLAUDE.md header comment says "14 個常見的物流/貨代公司" but actual count is 15 (includes UNKNOWN sentinel).

### D5. Role Verification

| # | Role Name | Description |
|---|-----------|-------------|
| 1 | System Admin | 系統管理員 - 擁有所有權限 |
| 2 | Super User | 可管理規則和 Forwarder |
| 3 | Data Processor | 基礎發票處理權限（新用戶預設角色） |
| 4 | City Manager | 管理本城市用戶和數據 |
| 5 | Regional Manager | 管理多城市用戶和數據 |
| 6 | Auditor | 只讀報表和審計日誌 |

**Total roles: 6** — ✅ Matches expected count and seed.ts header comment.

### D6. Idempotency Pattern Verification

The seed file uses the `upsert` pattern consistently across all entity types:

| Entity | Upsert Key | Pattern |
|--------|-----------|---------|
| Roles | `name` | `prisma.role.upsert({ where: { name } })` |
| Regions | `code` | `prisma.region.upsert({ where: { code } })` |
| Cities | `code` | `prisma.city.upsert({ where: { code } })` |
| Users | `email` or `id` | `prisma.user.upsert(...)` |
| Companies | `code` | `prisma.company.upsert({ where: { code } })` |
| Mapping Rules | `findFirst` + conditional create/update | Handles null `companyId` case |

**Idempotency: ✅ CONFIRMED** — All entities use upsert or findFirst+conditional patterns. Safe to run multiple times.

### D7. Additional Seed Users

| User | Email | Role | Purpose |
|------|-------|------|---------|
| System | system@ai-document-extraction.internal | System Admin | Seed data creator |
| Dev User | dev@example.com | System Admin + isGlobalAdmin | Development authentication |
| Admin | admin@ai-document-extraction.com | System Admin + isGlobalAdmin | Production admin (CHANGE-039) |

> **Security Note**: The production admin user has a hardcoded default password `ChangeMe@2026!` with a warning to change immediately. The password is hashed via `hashPassword()`.

---

## Summary of Findings

### Critical Issues

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **CLAUDE.md CHANGE/FIX count severely outdated** | HIGH | CLAUDE.md line ~項目進度追蹤 |
| 2 | **OpenAPI spec covers only 2% of routes** (7/331) | HIGH | `openapi/spec.yaml` |
| 3 | **CLAUDE.md references non-existent `docs/03-stories/tech-specs/`** | MEDIUM | CLAUDE.md AI 開發輔助指引 |

### Moderate Issues

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 4 | 25 CHANGE/FIX docs (13+12) lack standardized status emoji in header | MEDIUM | Various docs |
| 5 | `/tasks/{taskId}/status` in OpenAPI spec has no corresponding route | LOW | `openapi/spec.yaml` |
| 6 | Story count ~150 vs CLAUDE.md claim "157+" (minor variance) | LOW | `sprint-status.yaml` |

### Verified Correct

| Item | Verification | Result |
|------|-------------|--------|
| 22 Epics all done | sprint-status.yaml | ✅ |
| 10/10 CLAUDE.md indexed paths exist | File system check | ✅ |
| 10/10 CHANGE/FIX cross-references to code | Grep + file existence | ✅ |
| 4 Regions (incl. GLOBAL) | seed.ts | ✅ |
| 10 Cities | seed.ts | ✅ |
| 15 Companies (incl. UNKNOWN) | forwarders.ts | ✅ |
| 6 Roles | role-permissions.ts | ✅ |
| Seed idempotency (upsert pattern) | Code review | ✅ |
| seed-data/ directory exists with 7 modules | File system | ✅ |
| CHANGE/FIX numbering has no gaps | Sequential check | ✅ |

### Quantitative Score

| Set | Points Available | Points Verified | Score |
|-----|-----------------|-----------------|-------|
| A: CHANGE/FIX Docs | ~50 | 47 (3 deducted for outdated CLAUDE.md claim + status inconsistency) | 94% |
| B: Project Docs Structure | ~25 | 23 (2 deducted for wrong path reference + story count variance) | 92% |
| C: OpenAPI Spec | ~25 | 18 (7 deducted for severely stale spec + phantom route) | 72% |
| D: Seed Data | ~25 | 25 | 100% |
| **Total** | **~125** | **113** | **90%** |

---

*Report generated by R18 verification round*
