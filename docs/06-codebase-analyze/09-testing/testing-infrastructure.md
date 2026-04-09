# Testing Infrastructure Analysis

> Analysis date: 2026-04-09
> Scope: All automated tests, test configuration, test documentation, and coverage gaps

---

## 1. Executive Summary

The project has **virtually no automated test infrastructure**. Despite comprehensive testing documentation and aspirational coverage targets (80% unit, 70% integration), the actual codebase contains only **1 automated test file** across 1,074+ production source files. Testing has been conducted almost entirely through **manual E2E testing via Playwright MCP browser automation** and documented in markdown reports, not through a repeatable automated test suite.

**Key finding**: There is no test runner configured (no Jest, no Vitest), no `npm test` script, no CI/CD pipeline, and no test coverage tooling.

---

## 2. Test Framework Configuration

### 2.1 Test Runner: None Configured

| Item | Status |
|------|--------|
| Jest | Not installed, no config |
| Vitest | Not installed, no config |
| `npm test` script | Does not exist |
| `npm run test:unit` | Does not exist |
| `npm run test:coverage` | Does not exist |
| Coverage tool (c8, istanbul) | Not installed |

The `package.json` `scripts` section has **zero test-related entries**. The testing rules file (`.claude/rules/testing.md`) references `npm run test:unit`, `npm run test:coverage`, etc., but these scripts were never created.

### 2.2 Playwright

| Item | Detail |
|------|--------|
| Package | `playwright: ^1.57.0` (devDependency) |
| `playwright.config.ts` | Does not exist |
| `@playwright/test` | Not installed (only base `playwright` package) |
| E2E test files | None (only `.gitkeep` in `tests/e2e/`) |

Playwright is installed as a dev dependency but is used exclusively through the **Playwright MCP plugin** for interactive browser testing during development, not as a scripted test runner. No `@playwright/test` package is present, meaning Playwright's test runner cannot be used.

### 2.3 package.json Test Dependencies

```
devDependencies (test-relevant only):
  "playwright": "^1.57.0"         -- Browser automation only, no test runner
```

Missing expected dependencies: `@playwright/test`, `vitest` or `jest`, `@testing-library/react`, `@testing-library/jest-dom`, `msw` (mock service worker), `node-mocks-http`.

---

## 3. Test Directory Structure

```
tests/
  unit/
    .gitkeep
    services/
      batch-processor-parallel.test.ts    <-- Only automated test file
  integration/
    .gitkeep                              <-- Empty
  e2e/
    .gitkeep                              <-- Empty
```

The directory scaffolding exists (created 2025-12-17) but was never populated beyond a single test file added 2026-02-26.

### 3.1 Inline Test Files

No `*.test.*` or `*.spec.*` files exist anywhere under `src/`.

---

## 4. The Single Automated Test File

**File**: `tests/unit/services/batch-processor-parallel.test.ts` (290 lines)

| Attribute | Detail |
|-----------|--------|
| Related to | CHANGE-010 (batch parallel processing) |
| Library tested | `p-queue-compat` concurrency behavior |
| Test count | 8 test cases in 5 describe blocks |
| Pattern | Uses Jest-style `describe`/`it`/`expect` (no runner configured to execute it) |
| Categories | Concurrency control (3), error handling (2), rate limiting (2), performance (1) |

This file tests the third-party `p-queue-compat` library behavior rather than the project's own `batch-processor.service.ts` implementation. It uses Jest/Vitest globals (`describe`, `it`, `expect`) but there is no test runner configured to execute it.

---

## 5. E2E / Manual Testing (How Testing Actually Works)

Testing is performed manually using the **Playwright MCP plugin** for browser automation during development sessions. Results are documented in markdown and Excel files under `claudedocs/5-status/testing/`.

### 5.1 Test Documentation Inventory

| Category | Count | Location |
|----------|-------|----------|
| Test plans | 3 | `claudedocs/5-status/testing/plans/` |
| Test reports (.md) | 13 | `claudedocs/5-status/testing/reports/` |
| Test reports (.json) | 6 | CHANGE-024 automated API test results |
| Test data (.xlsx) | 5 | Hierarchical terms test data |
| UAT reports | 1 | Epic 18 local auth UAT |

### 5.2 Flows Tested (Via Manual E2E)

Based on test reports, the following flows have been manually tested:

| Flow | Test Reports | Status |
|------|-------------|--------|
| Historical data upload + processing (132 PDFs) | TEST-REPORT-001 through 005, E2E report | Extensively tested |
| Dual processing (native PDF vs GPT Vision) | TEST-REPORT-001 | Tested |
| GPT Vision issuer classification | TEST-REPORT-FIX005 | Tested |
| CHANGE-005 (unspecified) | TEST-REPORT-003-CHANGE-005 | Tested |
| CHANGE-010 parallel processing | TEST-REPORT-CHANGE-010 | Tested (unit + manual) |
| CHANGE-024 (API-level) | 6 JSON reports | Tested |
| Local auth system (Epic 18) | UAT-EPIC-18 | UAT completed |

### 5.3 Testing Framework Document

`claudedocs/5-status/testing/TESTING-FRAMEWORK.md` defines an aspirational testing strategy with:
- Test directory conventions
- Coverage targets (80% unit, 70% integration)
- Test plan/report templates
- Manual test execution flow

This framework document was created 2025-12-27 but the automated testing infrastructure described within it was never implemented.

---

## 6. CI/CD Integration

| Item | Status |
|------|--------|
| `.github/workflows/` | Does not exist |
| GitHub Actions | None configured |
| Pre-commit hooks | None |
| Pre-push checks | None |

The `.github/` directory contains only BMAD agent definitions, not CI/CD workflows. There is no automated quality gate of any kind -- no lint-on-push, no type-check-on-PR, no test execution.

---

## 7. Coverage Gap Analysis

### 7.1 Production Code Volume (No Test Coverage)

| Module | Files | Tests | Coverage |
|--------|-------|-------|----------|
| Services (`src/services/`) | 200 | 0 | 0% |
| API Routes (`src/app/api/`) | 331 | 0 | 0% |
| Components (`src/components/`) | 371 | 0 | 0% |
| Hooks (`src/hooks/`) | 104 | 0 | 0% |
| Lib/Utils (`src/lib/`) | 68 | 0 | 0% |
| **Total** | **1,074** | **0** | **0%** |

The single test file in `tests/unit/services/` tests a third-party library, not project code.

### 7.2 Critical Untested Modules

These high-risk modules have zero automated test coverage:

| Module | Risk | Why It Matters |
|--------|------|----------------|
| `src/services/extraction-v3/` | Critical | Core 3-stage AI extraction pipeline |
| `src/services/confidence-v3-1.service.ts` | Critical | Confidence scoring drives routing decisions |
| `src/services/mapping/` | High | 3-tier mapping system (core business logic) |
| `src/services/batch-processor.service.ts` | High | Processes 450K+ invoices/year |
| `src/app/api/documents/upload/route.ts` | High | Primary document ingestion endpoint |
| `src/lib/auth.config.ts` | High | Authentication configuration (has known PII leak) |
| `src/services/rule-suggestion-generator.ts` | Medium | Auto-learning from corrections |
| `src/lib/validations/` | Medium | Zod schemas used across all API routes |

### 7.3 Estimated Overall Test Coverage

**0%** automated test coverage. All testing has been manual/ad-hoc.

---

## 8. Gap Between Documentation and Reality

| Documented (CLAUDE.md / testing.md) | Reality |
|--------------------------------------|---------|
| Coverage target: 80% unit, 70% integration | 0% actual coverage |
| `npm run test` / `test:unit` / `test:coverage` | Scripts do not exist |
| Vitest as test runner (per testing.md templates) | Not installed |
| E2E tests with Playwright test runner | No `@playwright/test`, no config, no test files |
| Tests run on every commit/PR/release | No CI/CD pipeline exists |
| Test directory with sample files listed | Only `.gitkeep` files + 1 orphaned test |

---

## 9. What Exists vs What Is Missing

### Exists
- Test directory scaffold (`tests/unit/`, `tests/integration/`, `tests/e2e/`)
- 1 unit test file (not executable without a test runner)
- Comprehensive testing documentation framework and templates
- 19+ manual test reports documenting real-world testing
- Playwright base package installed
- Testing rules and conventions documented in `.claude/rules/testing.md`

### Missing (Required to Enable Automated Testing)
1. **Test runner** -- Install Vitest (recommended per project docs) or Jest
2. **Test scripts** -- Add `test`, `test:unit`, `test:integration`, `test:e2e`, `test:coverage` to package.json
3. **Playwright config** -- Create `playwright.config.ts`, install `@playwright/test`
4. **Testing libraries** -- `@testing-library/react`, `@testing-library/jest-dom`, `msw`
5. **CI/CD pipeline** -- GitHub Actions workflow for lint + type-check + test on PR
6. **Test coverage tooling** -- c8 or istanbul for coverage reports
7. **Actual test files** -- Unit tests for services, integration tests for APIs, E2E tests for critical flows

---

## 10. Recommendations (Priority Order)

| Priority | Action | Impact |
|----------|--------|--------|
| P0 | Install Vitest + configure `npm run test` | Enables any testing at all |
| P0 | Write unit tests for confidence scoring + routing | Most critical business logic |
| P1 | Write unit tests for extraction pipeline stages | Core processing correctness |
| P1 | Create GitHub Actions CI with lint + type-check | Prevents regressions on every PR |
| P1 | Install `@playwright/test` + write E2E for upload flow | Automates most-tested manual flow |
| P2 | Add API integration tests for document endpoints | 331 route files with 0 coverage |
| P2 | Add test coverage reporting with minimum thresholds | Track progress toward 80% target |
| P3 | Write component tests with Testing Library | 371 components untested |
