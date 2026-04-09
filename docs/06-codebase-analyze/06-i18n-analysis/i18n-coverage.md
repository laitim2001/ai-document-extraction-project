# i18n Coverage Analysis

> Generated: 2026-04-09 | Framework: next-intl 4.7 | Locales: en, zh-TW, zh-CN

---

## 1. Configuration Summary

### Supported Locales

| Code | Language | Role |
|------|----------|------|
| `en` | English | Default (fallback) |
| `zh-TW` | 繁體中文 | Primary target users |
| `zh-CN` | 简体中文 | Extended support |

- **Config file**: `src/i18n/config.ts`
- **Default locale**: `en`
- **Locale prefix strategy**: `always` (URL always includes `/en/`, `/zh-TW/`, `/zh-CN/`)
- **Timezone**: `Asia/Taipei`
- **Routing**: `src/i18n/routing.ts` — exports `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`
- **Server-side loader**: `src/i18n/request.ts` — dynamic import with fallback chain (locale -> en -> empty object)

### Namespace Registration

- **Registered in `request.ts`**: 34 namespaces
- **JSON files per locale**: 34 each
- **Status**: All 34 registered namespaces have matching JSON files in all 3 locales. No orphaned files.

---

## 2. Translation Files — Per-Namespace Key Counts

| # | Namespace | en | zh-TW | zh-CN | Delta |
|---|-----------|---:|------:|------:|-------|
| 1 | admin | 525 | 525 | 525 | -- |
| 2 | auth | 154 | 154 | 154 | -- |
| 3 | common | 97 | 97 | 85 | **zh-CN -12** |
| 4 | companies | 205 | 205 | 205 | -- |
| 5 | confidence | 40 | 40 | 40 | -- |
| 6 | dashboard | 57 | 57 | 57 | -- |
| 7 | dataTemplates | 89 | 89 | 89 | -- |
| 8 | dialogs | 46 | 46 | 46 | -- |
| 9 | documentPreview | 247 | 247 | 247 | -- |
| 10 | documents | 194 | 194 | 194 | -- |
| 11 | errors | 40 | 40 | 40 | -- |
| 12 | escalation | 105 | 105 | 105 | -- |
| 13 | exchangeRate | 93 | 93 | 93 | -- |
| 14 | fieldDefinitionSet | 120 | 120 | 120 | -- |
| 15 | fieldMappingConfig | 59 | 59 | 59 | -- |
| 16 | formats | 219 | 219 | 219 | -- |
| 17 | global | 48 | 48 | 48 | -- |
| 18 | historicalData | 254 | 254 | 254 | -- |
| 19 | navigation | 68 | 68 | 68 | -- |
| 20 | pipelineConfig | 78 | 78 | 78 | -- |
| 21 | profile | 40 | 40 | 40 | -- |
| 22 | promptConfig | 147 | 147 | 147 | -- |
| 23 | referenceNumber | 129 | 129 | 129 | -- |
| 24 | region | 47 | 47 | 47 | -- |
| 25 | reports | 130 | 130 | 130 | -- |
| 26 | review | 82 | 82 | 82 | -- |
| 27 | rules | 318 | 318 | 318 | -- |
| 28 | standardFields | 61 | 61 | 61 | -- |
| 29 | systemSettings | 67 | 67 | 67 | -- |
| 30 | templateFieldMapping | 190 | 190 | 190 | -- |
| 31 | templateInstance | 202 | 202 | 202 | -- |
| 32 | templateMatchingTest | 169 | 169 | 169 | -- |
| 33 | termAnalysis | 52 | 52 | 52 | -- |
| 34 | validation | 33 | 33 | 33 | -- |
| | **TOTAL** | **4,405** | **4,405** | **4,393** | **zh-CN -12** |

---

## 3. Missing Translation Keys

### zh-CN `common.json` — 12 missing keys

The following keys exist in `en` and `zh-TW` but are absent in `zh-CN`:

| Key | Section |
|-----|---------|
| `locale.switchLanguage` | Locale switcher |
| `locale.languages.en` | Locale switcher |
| `locale.languages.zh-TW` | Locale switcher |
| `city.globalAdmin` | City role badges |
| `city.globalAdminTooltip` | City role badges |
| `city.regionalManager` | City role badges |
| `city.regionalManagerTooltip` | City role badges |
| `city.multiCityAccess` | City role badges |
| `city.multiCityTooltip` | City role badges |
| `city.noCityConfigured` | City role badges |
| `city.noCityTooltip` | City role badges |
| `city.contactAdmin` | City role badges |

**Impact**: Users with `zh-CN` locale will fall back to `en` for these keys (per the request.ts fallback chain). The locale switcher labels and city-role indicator tooltips will appear in English.

**All other 33 namespaces**: en = zh-TW = zh-CN (zero delta).

---

## 4. `npm run i18n:check` Output

Script: `npx ts-node scripts/check-i18n-completeness.ts`

```
Checking: PROMPT_TYPES
  Source: src/types/prompt-config.ts
  i18n: messages/*/promptConfig.json -> types
  Found keys: ISSUER_IDENTIFICATION, TERM_CLASSIFICATION, FIELD_EXTRACTION,
              VALIDATION, STAGE_1_COMPANY_IDENTIFICATION,
              STAGE_2_FORMAT_IDENTIFICATION, STAGE_3_FIELD_EXTRACTION
  Result: ALL translations complete

Final: PASS - All i18n translations complete
```

Note: The built-in check only validates `PROMPT_TYPES` constants. It does not detect the 12 missing zh-CN keys in `common.json`.

---

## 5. Usage Patterns

### Hook/Function Usage

| Hook / Function | Files | Total Calls |
|-----------------|------:|------------:|
| `useTranslations` (client) | 262 | 594 |
| `useLocale` | 36 | 74 |
| `getTranslations` (server) | 21 | 51 |

**Total i18n-aware source files**: 262 (client) + 21 (server) = **283 unique files** using i18n.

### i18n Routing Adoption

Components use `Link`, `useRouter`, `usePathname` from `@/i18n/routing` (locale-aware navigation). This is enforced by project rules.

### Formatting Utilities

| Utility | Path |
|---------|------|
| Date formatting | `src/lib/i18n-date.ts` |
| Number formatting | `src/lib/i18n-number.ts` |
| Currency formatting | `src/lib/i18n-currency.ts` |
| Zod validation i18n | `src/lib/i18n-zod.ts` |
| API error i18n | `src/lib/i18n-api-error.ts` |

### Locale Preference Persistence

`src/hooks/use-locale-preference.ts` saves to both LocalStorage and database (if authenticated).

---

## 6. Hardcoded Strings Spot-Check

### Feature Components (src/components/features/)

Found **10 instances across 6 files** with hardcoded English strings in JSX:

| File | Example String | Severity |
|------|---------------|----------|
| `format-analysis/FormatTermsPanel.tsx` | "Select a format to view terms", "No terms found..." | Medium |
| `format-analysis/CompanyFormatTree.tsx` | "No companies found" | Medium |
| `docs/SwaggerUIWrapper.tsx` | "Failed to Load Documentation" | Low (dev tool) |
| `docs/SDKExamplesContent.tsx` | "Loading examples...", code docs | Low (dev tool) |
| `forwarders/ForwarderTable.tsx` | "Open menu" (sr-only) | Low |
| `template-instance/TemplateInstanceCard.tsx` | "More actions" (sr-only) | Low |

**Assessment**: The `format-analysis/` components (2 files) have user-facing hardcoded strings that should be i18n-ized. The `docs/` components are developer tools and `sr-only` labels are accessibility hints — lower priority.

### Type Definition Files (src/types/)

Found **120 hardcoded `label` strings across 13 type files**:

| File | Count | Nature |
|------|------:|--------|
| `invoice-fields.ts` | 94 | Field labels ("Invoice Number", "Shipper Name", etc.) |
| `backup.ts` | 4 | Backup type/status labels |
| `audit-report.ts` | 4 | Export format labels ("Excel", "PDF", etc.) |
| `forwarder.ts` | 3 | Form field labels |
| `document-progress.ts` | 3 | Source labels ("API", "SharePoint", "Outlook") |
| `logging.ts` | 3 | Log level labels |
| Others (7 files) | 9 | Misc config/prompt labels |

**Assessment**: The `invoice-fields.ts` labels (94) are used as display defaults in the extraction pipeline and admin UI. These are partially mitigated by the `use-field-label.ts` hook which resolves i18n keys at render time, but the underlying type constants remain English-only. The `backup.ts` and `audit-report.ts` labels are admin-facing and less critical.

---

## 7. Constants-to-i18n Sync Status

### Checked Constants

| Constant File | Constant | i18n Namespace | Status |
|---------------|----------|---------------|--------|
| `src/types/prompt-config.ts` | `PROMPT_TYPES` | `promptConfig.types.*` | Synced (verified by i18n:check) |
| `src/constants/standard-fields.ts` | `FIELD_CATEGORIES` | Uses `labelKey` (i18n key ref) | Synced (design uses keys, not strings) |
| `src/constants/processing-steps-v3.ts` | Pipeline steps | `documents.detail.timeline.steps.*` | Synced |
| `src/types/invoice-fields.ts` | 94 field defs | Hardcoded English labels | **NOT synced** |
| `src/types/backup.ts` | 4 config objects | Hardcoded English labels | **NOT synced** |

---

## 8. Summary & Recommendations

### Overall Health: 99.7% coverage (4,393/4,405 keys in weakest locale)

| Metric | Value | Status |
|--------|-------|--------|
| Namespaces | 34 x 3 locales = 102 JSON files | Complete |
| en total keys | 4,405 | Baseline |
| zh-TW total keys | 4,405 (100%) | Complete |
| zh-CN total keys | 4,393 (99.7%) | **12 keys missing** |
| Components using i18n | 283 files | Excellent adoption |
| `request.ts` registration | 34/34 match | Complete |
| i18n:check script | PASS | Partial scope |

### Action Items

| Priority | Issue | Fix |
|----------|-------|-----|
| **P1** | 12 missing keys in `messages/zh-CN/common.json` (`locale.*`, `city.*`) | Add translations |
| **P2** | 120 hardcoded labels in `src/types/` (mainly `invoice-fields.ts`) | Migrate to i18n keys |
| **P2** | 2 feature components with hardcoded strings (`format-analysis/`) | Replace with `useTranslations` |
| **P3** | `i18n:check` script only validates `PROMPT_TYPES` | Extend to cover all constant-to-i18n mappings |
| **P3** | `docs/` components have hardcoded English (dev tools) | Low priority — i18n if user-facing |

---

*Analysis performed against codebase as of 2026-04-09.*
