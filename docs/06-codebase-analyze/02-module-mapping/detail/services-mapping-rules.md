# Services: Mapping, Rule Inference & Similarity

> Analysis date: 2026-04-09
> Total files: 15 | Total LOC: 4,231

---

## 1. File Inventory

### `src/services/mapping/` (7 files, 2,216 LOC)

| File | LOC | Purpose | Key Exports |
|------|-----|---------|-------------|
| `index.ts` | 118 | Module barrel export + constants | `CONFIG_SCOPE_PRIORITY`, `TRANSFORM_TYPES`, `DEFAULT_CACHE_TTL_MS` |
| `config-resolver.ts` | 300 | Three-tier config resolution from DB (GLOBAL < COMPANY < FORMAT) | `ConfigResolver`, `configResolver` |
| `field-mapping-engine.ts` | 253 | Core mapping engine: applies rules, tracks sources, reports unmapped fields | `FieldMappingEngine`, `fieldMappingEngine` |
| `transform-executor.ts` | 348 | Strategy-pattern executor for 5 transform types | `TransformExecutor`, `transformExecutor` |
| `dynamic-mapping.service.ts` | 397 | Main entry point; orchestrates resolver + engine + cache | `DynamicMappingService`, `dynamicMappingService` |
| `mapping-cache.ts` | 346 | In-memory TTL cache with scope-level invalidation | `MappingCache`, `mappingCache`, `CacheStats` |
| `source-field.service.ts` | 454 | Source field registry: standard (90+), extracted, custom, li_*, _ref_* | `getStandardSourceFields`, `getAvailableSourceFields`, `getGroupedSourceFields`, `searchFields`, `LINE_ITEM_SUGGESTIONS`, `REFERENCE_NUMBER_SYNTHETIC_FIELDS` |

### `src/services/rule-inference/` (4 files, 1,123 LOC)

| File | LOC | Purpose | Key Exports |
|------|-----|---------|-------------|
| `index.ts` | 176 | Engine entry: tries all strategies, picks best by confidence, falls back to AI_PROMPT | `RuleInferenceEngine`, `ruleInferenceEngine` |
| `regex-inferrer.ts` | 272 | Infers regex patterns from corrected values (invoice#, date, amount, code, generic) | `inferRegexPattern` |
| `keyword-inferrer.ts` | 358 | Detects transformation patterns between original and corrected values | `inferKeywordPattern` |
| `position-inferrer.ts` | 317 | Infers position-based extraction rules from bounding box data | `inferPositionPattern` |

### `src/services/similarity/` (4 files, 892 LOC)

| File | LOC | Purpose | Key Exports |
|------|-----|---------|-------------|
| `index.ts` | 38 | Barrel export | (re-exports all below) |
| `levenshtein.ts` | 211 | Levenshtein edit distance + normalized similarity + threshold optimization | `levenshteinDistance`, `levenshteinSimilarity`, `calculateSimilarityWithThreshold`, `findSimilarStrings` |
| `numeric-similarity.ts` | 281 | Multi-format numeric parsing + relative similarity + multiply/add pattern detection | `parseNumericValue`, `numericSimilarity`, `detectNumericTransformPattern` |
| `date-similarity.ts` | 362 | 10 date format parsers + same-day detection + format conversion pattern | `dateSimilarity`, `detectDateFormatPattern`, `formatDate`, `getSupportedDateFormats` |

---

## 2. Three-Tier Mapping Architecture

### Overview

```
Input extracted fields
  |
  v
DynamicMappingService.mapFields()           [dynamic-mapping.service.ts:89]
  |
  +--> ConfigResolver.resolveConfigs()      [config-resolver.ts:68]
  |      |
  |      +--> fetchFormatConfig()           priority 3 (highest)
  |      +--> fetchCompanyConfig()          priority 2
  |      +--> fetchGlobalConfig()           priority 1 (lowest)
  |
  +--> FieldMappingEngine.applyRules()      [field-mapping-engine.ts:58]
  |      |
  |      +--> ConfigResolver.mergeConfigs() [config-resolver.ts:188] (static)
  |      +--> TransformExecutor.execute()   [transform-executor.ts:241]
  |
  +--> Return MappingResult
```

### Config Scope Priority (config-resolver.ts, line 40-44)

```typescript
const SCOPE_PRIORITY: Record<ConfigScope, number> = {
  GLOBAL: 1,    // Lowest -- applies to all companies
  COMPANY: 2,   // Company-specific overrides
  FORMAT: 3,    // Document format-specific (highest)
};
```

Types: `ConfigScope = 'GLOBAL' | 'COMPANY' | 'FORMAT'` (field-mapping.ts:540)

### Override Logic (config-resolver.ts, line 188-207)

`ConfigResolver.mergeConfigs()` implements the override:
1. Reverses the config array (so low-priority processes first)
2. Iterates rules, keyed by `targetField`
3. Higher-priority configs overwrite the same `targetField` entry in the Map
4. Result: for any given targetField, only the highest-priority rule survives
5. Final rules sorted by `rule.priority` (ascending)

**Key design**: The merge is per-targetField, not per-rule. A FORMAT config rule for "invoiceNumber" completely replaces a GLOBAL rule for "invoiceNumber".

### Database Query Pattern

Each scope query (config-resolver.ts lines 101-173) follows the same pattern:
- Table: `fieldMappingConfig` (Prisma model)
- Filter: `scope` + optional `companyId`/`documentFormatId` + `isActive: true`
- Include: nested `rules` where `isActive: true`, ordered by `priority: 'asc'`

---

## 3. Transform Types (transform-executor.ts)

Five transform strategies via Strategy Pattern (factory at line 203-224):

| Type | Strategy Class | Behavior | Required Params |
|------|---------------|----------|-----------------|
| `DIRECT` | `DirectStrategy` (line 61) | Returns first non-null value from sourceFields aliases | None |
| `CONCAT` | `ConcatStrategy` (line 71) | Joins non-null values with separator | `separator?` (default: `""`) |
| `SPLIT` | `SplitStrategy` (line 95) | Splits first non-null value, returns part at index | `separator`/`delimiter`, `index` |
| `LOOKUP` | `LookupStrategy` (line 120) | Maps value through lookupTable, with defaultValue | `lookupTable`, `defaultValue?` |
| `CUSTOM` | `CustomStrategy` (line 142) | String template with `${fieldName}` / `${index}` substitution | `expression` |

### Rule Applicability (field-mapping-engine.ts, line 131-141)

- `CONCAT`: **all** sourceFields must exist in sourceValueMap
- `DIRECT`, `SPLIT`, `LOOKUP`, `CUSTOM`: **any one** sourceField existing is sufficient (alias behavior)

### Validation Rules (transform-executor.ts, line 295-338)

- `DIRECT`: no params required
- `CONCAT`: no params required (separator optional)
- `SPLIT`: requires `separator` or `delimiter` + non-negative integer `index`
- `LOOKUP`: requires `lookupTable` object
- `CUSTOM`: requires `expression` string

---

## 4. Mapping Cache (mapping-cache.ts)

### Configuration Constants (lines 36-46)

| Constant | Value | Purpose |
|----------|-------|---------|
| `DEFAULT_TTL_MS` | 300,000 (5 min) | Default cache entry TTL |
| `MAX_CACHE_SIZE` | 1,000 | Maximum entries before eviction |
| `CLEANUP_INTERVAL_MS` | 60,000 (1 min) | Periodic cleanup interval |

### Cache Key Structure

Serialized as `type:scope[:company:id][:format:id]` (line 242-253).

### Invalidation

- By scope + optional ID: `invalidate(scope, id?)` (line 157-188)
- Full clear: `clear()` (line 146)
- Eviction: oldest-first when hitting MAX_CACHE_SIZE (line 265-281)
- DynamicMappingService exposes `invalidateCache()` and `clearCache()` (lines 150-166)

### Cache Bypass

`MappingContext.enableCache` defaults to true; `forceRefresh` forces re-fetch (dynamic-mapping.service.ts line 293).

---

## 5. Source Field Service (source-field.service.ts)

### Field Sources

| Source | Description | Count |
|--------|-------------|-------|
| `standard` | From `INVOICE_FIELDS` (invoice-fields.ts) | 90+ fields |
| `extracted` | Dynamic fields from GPT extraction results | Variable |
| `custom` | User-created fields | Variable |
| `definition` | From FieldDefinitionSet (CHANGE-042) | Variable |

### Special Pseudo-Fields

**Line Item fields** (CHANGE-043, line 127-166): 12 predefined charge categories (OCEAN_FREIGHT, THC, HANDLING_FEE, etc.), each producing `li_{TYPE}_total` and `li_{TYPE}_count` = 24 options.

**Reference Number synthetic fields** (CHANGE-047, line 182-207): 6 fields (`_ref_number`, `_ref_type`, `_ref_SHIPMENT`, `_ref_HAWB`, `_ref_MAWB`, `_ref_BOOKING`) injected by template-matching-engine during pipeline execution.

### Category Display Order (line 104-117)

`basic > shipper > consignee > shipping > package > charges > reference > payment > syntheticRef > lineItem > extracted > custom`

---

## 6. Rule Inference Engine (rule-inference/)

### Inference Pipeline (index.ts, line 62-80)

```
CorrectionSample[]
  |
  +--> inferRegexPattern()       -- tries 5 sub-strategies
  +--> inferKeywordPattern()     -- analyzes original->corrected transforms
  +--> inferPositionPattern()    -- requires >= 2 samples with boundingBox
  |
  v
Sort candidates by confidence (descending)
  |
  +--> Best candidate returned with up to 3 alternatives
  +--> Fallback: AI_PROMPT type at confidence 0.5
```

### Regex Inferrer (regex-inferrer.ts)

Five sub-strategies tried in order (line 70-77):

| Strategy | Function | Patterns Checked |
|----------|----------|-----------------|
| Invoice Number | `inferInvoiceNumberPattern` (line 101) | `XX-NNNNNN`, `XXNNNNN`, pure digits, Taiwan unified invoice |
| Date | `inferDatePattern` (line 132) | ISO, DD/MM/YYYY, YYYY/MM/DD, YYYYMMDD |
| Amount | `inferAmountPattern` (line 162) | Currency format, amount+currency code, plain decimal |
| Code | `inferCodePattern` (line 194) | Container# (ABCD1234567), tracking#, generic alphanumeric |
| Generic | `inferGenericPattern` (line 227) | Character-class structure analysis (A/a/0/X mapping) |

**Match threshold**: >= 0.8 (80%) of samples must match the pattern (line 114).
**Generic pattern confidence**: multiplied by 0.8 penalty factor (line 267).
**Minimum return confidence**: >= 0.7 to be accepted as a REGEX candidate (line 81).

### Keyword Inferrer (keyword-inferrer.ts)

Detects transformation types between original and corrected values:

| Type | Condition | Confidence | Example |
|------|-----------|-----------|---------|
| `prefix_removal` | original.endsWith(corrected) | 0.9 | "PREFIX-123" -> "123" |
| `suffix_removal` | original.startsWith(corrected) | 0.9 | "123-SUFFIX" -> "123" |
| `extraction` | original.includes(corrected) | 0.8 | "abc123def" -> "123" |
| `format_change` | normalized strings match (strip `[-\s_.]`) | 0.85 | "INV-123" -> "INV123" |

**Consistency threshold**: >= 70% of samples must share the same transformation type (line 214).
**Multi-variant penalty**: if prefix/suffix values differ across samples, confidence x 0.7 (lines 231, 245).

### Position Inferrer (position-inferrer.ts)

- Requires >= 2 samples with valid `context.boundingBox` (line 88)
- Calculates bounding box statistics: min, max, mean, std for x, y, width, height (line 146-161)
- **Consistency check**: Coefficient of Variation (CV = std/mean) must be < 0.2 for both X and Y (line 194-198)
- **Confidence formula** (line 203-216): `(xConf + yConf) / 2 * sampleConf * 0.8` where xConf = `max(0, 1 - CV*5)` and sampleConf = `min(1, count/5)`
- Region margin: mean +/- 1.5 * std (line 227-239)
- Optional anchor detection from surrounding text with common prefix >= 3 chars (line 266-290)

---

## 7. Similarity Algorithms (similarity/)

### Levenshtein Distance (levenshtein.ts)

- **Algorithm**: Standard DP matrix, O(m*n) time and space (lines 42-75)
- **Similarity normalization**: `1 - distance / max(len1, len2)`, with lowercase + trim preprocessing (line 96-115)
- **Threshold optimization** (line 138-175): Early exit when length difference alone makes threshold impossible (`minPossibleSimilarity = 1 - |lenDiff| / maxLen`)
- **Batch search** `findSimilarStrings()`: default threshold 0.8, returns sorted descending by similarity (line 194-211)

### Numeric Similarity (numeric-similarity.ts)

**Parsing** (line 44-85): Strips currency symbols (15 currencies), letters, whitespace. Handles:
- US format: `1,234.56` (comma thousands, dot decimal)
- EU format: `1.234,56` (dot thousands, comma decimal)
- Negative: `-123` or `(123)`

**Similarity** (line 114-144): `max(0, 1 - |diff| / max(|a|, |b|))`
- Special case: both zero = 1.0
- Special case: one zero, other < 1 = `1 - |other|`

**Transform pattern detection** (line 189-252):
- Requires >= 2 numeric pairs (non-zero originals)
- **Multiply pattern** (e.g. exchange rate): if ratio CV < 5%, returns factor (4 decimal places)
- **Add pattern** (e.g. fixed adjustment): if diff CV < 5%, returns factor (2 decimal places)

### Date Similarity (date-similarity.ts)

**Supported formats** (10 formats, lines 44-108):
`YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY/MM/DD`, `DD-MM-YYYY`, `MM-DD-YYYY`, `YYYYMMDD`, `YYYY年M月D日`, `DD/MM/YY`, `DD.MM.YYYY`

**Date validation**: year 1900-2100, valid month/day (lines 170-185).

**Similarity** (line 223-254):
- Same day, different format: similarity = 1.0, reports `formatChange` string
- Different dates within 365 days: `max(0, 1 - daysDiff / 365)`
- Beyond 365 days: similarity = 0

**Format pattern detection** (line 288-323): Requires >= 2 same-day pairs with consistent from/to format to confirm a pattern.

---

## 8. Cross-Service Dependencies

```
DynamicMappingService
  ├── ConfigResolver      --> prisma (fieldMappingConfig table)
  ├── FieldMappingEngine  --> TransformExecutor
  ├── TransformExecutor   --> (standalone, Strategy Pattern)
  └── MappingCache        --> (in-memory Map)

RuleInferenceEngine
  ├── regex-inferrer      --> @/types/suggestion
  ├── keyword-inferrer    --> @/types/suggestion
  └── position-inferrer   --> @/types/suggestion

Similarity module
  ├── levenshtein         --> @/types/pattern (SimilarityResult)
  ├── numeric-similarity  --> @/types/pattern (NumericSimilarityResult, NumericTransformPattern)
  └── date-similarity     --> @/types/pattern (DateSimilarityResult, DateFormatPattern)
```

### External Consumers

- `src/services/unified-processor/steps/field-mapping.step.ts` -- uses DynamicMappingService
- `src/services/rule-suggestion-generator.ts` -- uses RuleInferenceEngine
- `src/services/rule-testing.service.ts` -- uses similarity functions for test comparisons
- `src/components/features/*/SourceFieldCombobox` -- uses source-field.service for dropdown options

### Type Definition Files

| Types file | Used by |
|-----------|---------|
| `src/types/field-mapping.ts` (lines 531-1514) | All mapping/ files |
| `src/types/suggestion.ts` (lines 85-101) | All rule-inference/ files |
| `src/types/pattern.ts` (lines 231-289) | All similarity/ files |
| `src/types/invoice-fields.ts` | source-field.service.ts |

---

## 9. Key Thresholds Summary

| Module | Threshold | Value | Location |
|--------|-----------|-------|----------|
| Mapping cache | Default TTL | 5 min (300,000 ms) | mapping-cache.ts:36 |
| Mapping cache | Max entries | 1,000 | mapping-cache.ts:41 |
| Mapping cache | Cleanup interval | 1 min (60,000 ms) | mapping-cache.ts:46 |
| Regex inferrer | Pattern match rate | >= 80% | regex-inferrer.ts:114 |
| Regex inferrer | Minimum confidence to accept | >= 70% (0.7) | regex-inferrer.ts:81 |
| Generic pattern | Confidence penalty factor | x 0.8 | regex-inferrer.ts:267 |
| Keyword inferrer | Consistency rate | >= 70% | keyword-inferrer.ts:214 |
| Keyword inferrer | Multi-variant penalty | x 0.7 | keyword-inferrer.ts:231 |
| Position inferrer | CV threshold (consistency) | < 0.2 | position-inferrer.ts:195 |
| Position inferrer | Region margin | 1.5x std | position-inferrer.ts:227 |
| Position inferrer | Sample confidence cap | count/5, max 1.0 | position-inferrer.ts:214 |
| AI_PROMPT fallback | Default confidence | 0.5 | rule-inference/index.ts:118 |
| Levenshtein batch | Default threshold | 0.8 | levenshtein.ts:198 |
| Numeric transform | CV threshold (pattern detection) | < 5% (0.05) | numeric-similarity.ts:219,234 |
| Date similarity | Same-year window | 365 days | date-similarity.ts:248 |
| Date pattern | Minimum pairs | >= 2 | date-similarity.ts:304 |
