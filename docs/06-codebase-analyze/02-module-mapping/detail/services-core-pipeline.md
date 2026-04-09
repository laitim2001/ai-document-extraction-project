# Core Processing Pipeline - Module Analysis

> **Scope**: `src/services/extraction-v3/`, `src/services/unified-processor/`, `src/services/document-processing/`
> **Total Files**: 44 TypeScript files | **Total LOC**: 18,235
> **Analysis Date**: 2026-04-09

---

## 1. Architecture Overview

The core pipeline has three layers:

```
UnifiedDocumentProcessor (entry point)
  |
  +-- V2 path: 11-step pipeline (Azure DI + GPT)    [unified-processor/steps/]
  |     via StepHandlerFactory -> BaseStepHandler pattern
  |
  +-- V3 path: 7-step single GPT call               [extraction-v3/]
  |     ExtractionV3Service.processFileV3()
  |
  +-- V3.1 path: 7-step three-stage GPT call         [extraction-v3/stages/]
        ExtractionV3Service.processFileV3_1()
          -> StageOrchestrator -> Stage1 -> Stage2 -> Stage3
```

**Routing logic** (unified-document-processor.service.ts L160-218):
- `forceLegacy` / `!enableUnifiedProcessor` -> Legacy adapter
- `forceV3` or `shouldUseExtractionV3(fileId)` feature flag -> V3/V3.1
- Otherwise -> V2 11-step pipeline
- V3 failure can fallback to V2 (`fallbackToV2OnError`)
- V3.1 failure can fallback to V3 (`fallbackToV3OnError`)

**V3 vs V3.1 selection** (extraction-v3.service.ts L165-177):
- Controlled by `useExtractionV3_1` flag + `extractionV3_1Percentage` grayscale

---

## 2. File Inventory

### 2.1 extraction-v3/ (20 files, 10,582 LOC)

| File | LOC | Purpose | Key Exports |
|------|-----|---------|-------------|
| `index.ts` | 382 | Barrel export for entire module | All public APIs, types, constants |
| `extraction-v3.service.ts` | 1,238 | **Main entry**: V3/V3.1 pipeline orchestration | `ExtractionV3Service`, `processFileV3`, `checkExtractionV3Health` |
| `prompt-assembly.service.ts` | 680 | Load DB config, build prompts, 5-min cache | `PromptAssemblyService`, `assemblePrompt`, `loadStage1/2/3PromptConfig` |
| `unified-gpt-extraction.service.ts` | 556 | V3 single-call GPT-5.2 Vision extraction | `UnifiedGptExtractionService`, `extractWithGpt` |
| `result-validation.service.ts` | 558 | Zod schema validation + company/format JIT creation | `ResultValidationService`, `validateExtractionResult` |
| `confidence-v3.service.ts` | 451 | V3 5-dimension confidence (EXTRACTION 30%, ISSUER 20%, FORMAT 15%, FIELD 20%, HISTORICAL 15%) | `ConfidenceV3Service`, `ROUTING_THRESHOLDS_V3` |
| `confidence-v3-1.service.ts` | 666 | V3.1 6-dimension confidence + smart routing | `ConfidenceV3_1Service`, `getSmartReviewTypeV3_1`, `ROUTING_THRESHOLDS_V3_1` |

**stages/** (8 files, 4,103 LOC)

| File | LOC | Purpose | Key Exports |
|------|-----|---------|-------------|
| `index.ts` | 71 | Barrel export for stages | Stage1/2/3, Orchestrator, GptCaller |
| `stage-orchestrator.service.ts` | 479 | Sequential Stage 1->2->3 coordination | `StageOrchestratorService` |
| `stage-1-company.service.ts` | 531 | Company identification via GPT-5-nano | `Stage1CompanyService` |
| `stage-2-format.service.ts` | 604 | Format identification via GPT-5-nano | `Stage2FormatService` |
| `stage-3-extraction.service.ts` | 1,451 | Field extraction via GPT-5.2 (largest file) | `Stage3ExtractionService` |
| `gpt-caller.service.ts` | 514 | Unified Azure OpenAI API caller (nano + full) | `GptCallerService` |
| `reference-number-matcher.service.ts` | 109 | DB-first substring matching on filename | `ReferenceNumberMatcherService` |
| `exchange-rate-converter.service.ts` | 344 | Post-extraction FX conversion | `ExchangeRateConverterService` |

**utils/** (5 files, 1,948 LOC)

| File | LOC | Purpose | Key Exports |
|------|-----|---------|-------------|
| `pdf-converter.ts` | 396 | PDF -> Base64 PNG images (pdf-to-img) | `PdfConverter`, `convertPdfToBase64Images` |
| `prompt-builder.ts` | 726 | Build system/user prompts, JSON schema generation | `buildFullSystemPrompt`, `buildUserPrompt`, `generateJsonSchema` |
| `prompt-merger.ts` | 323 | Three merge strategies: OVERRIDE/APPEND/PREPEND | `mergePrompts`, `mergePromptConfigs` |
| `variable-replacer.ts` | 460 | `${xxx}` template variable substitution | `replaceVariables`, `buildStage1/2/3VariableContext` |
| `classify-normalizer.ts` | 43 | Normalize GPT classifiedAs to Title Case | `normalizeClassifiedAs` |

### 2.2 unified-processor/ (22 files, 7,388 LOC)

| File | LOC | Purpose | Key Exports |
|------|-----|---------|-------------|
| `index.ts` | 116 | Barrel export | All public APIs |
| `unified-document-processor.service.ts` | 775 | **Top-level entry**: V2/V3 routing, status updates | `UnifiedDocumentProcessorService`, `getUnifiedDocumentProcessor` |

**interfaces/** (1 file)

| File | LOC | Purpose |
|------|-----|---------|
| `step-handler.interface.ts` | 260 | `IStepHandler` interface + `BaseStepHandler` abstract class (timeout, retry, skip) |

**factory/** (1 file)

| File | LOC | Purpose |
|------|-----|---------|
| `step-factory.ts` | 179 | Creates all 11 step handlers in order, with caching |

**steps/** (11 files, 3,116 LOC)

| File | LOC | Purpose |
|------|-----|---------|
| `file-type-detection.step.ts` | 101 | Detect PDF/image MIME type |
| `smart-routing.step.ts` | 114 | Pre-route based on file characteristics |
| `azure-di-extraction.step.ts` | 219 | Azure Document Intelligence OCR |
| `issuer-identification.step.ts` | 340 | Identify document issuer company |
| `format-matching.step.ts` | 214 | Match document format template |
| `config-fetching.step.ts` | 442 | Fetch company/format-specific configs |
| `gpt-enhanced-extraction.step.ts` | 394 | GPT Vision enhanced field extraction |
| `field-mapping.step.ts` | 283 | Apply field mapping rules |
| `term-recording.step.ts` | 302 | Record extracted terms for learning |
| `confidence-calculation.step.ts` | 445 | Calculate confidence score |
| `routing-decision.step.ts` | 262 | Determine review routing |

**adapters/** (7 files, 2,942 LOC)

| File | LOC | Purpose |
|------|-----|---------|
| `legacy-processor.adapter.ts` | 217 | Bridge to batch-processor.service.ts |
| `config-fetcher-adapter.ts` | 361 | Fetch PromptConfig/FieldMappingConfig from DB |
| `format-matcher-adapter.ts` | 292 | Match DocumentFormat by company |
| `issuer-identifier-adapter.ts` | 230 | Identify issuer via company-matcher |
| `confidence-calculator-adapter.ts` | 627 | Calculate confidence with V3/V3.1 services |
| `routing-decision-adapter.ts` | 451 | Generate routing decision from confidence |
| `term-recorder-adapter.ts` | 764 | Record terms to DB for rule learning |

### 2.3 document-processing/ (2 files, 265 LOC)

| File | LOC | Purpose | Key Exports |
|------|-----|---------|-------------|
| `index.ts` | 20 | Barrel export | `MappingPipelineStep` |
| `mapping-pipeline-step.ts` | 245 | Integrates DynamicMappingService into pipeline | `MappingPipelineStep`, `createMappingPipelineStep` |

---

## 3. V3.1 Pipeline Data Flow (Primary Path)

```
Input: fileBuffer + fileName + mimeType + cityCode
  |
  v
[1] FILE_PREPARATION
    PdfConverter.convertToBase64() -> Base64 image array + pageCount
  |
  v
[1b] REFERENCE_NUMBER_MATCHING (CHANGE-032, optional)
     ReferenceNumberMatcherService.match()
     -> DB ILIKE substring match on fileName
     -> If enabled && matchesFound=0: ABORT pipeline (FIX-036)
  |
  v
[2] STAGE_1_COMPANY_IDENTIFICATION (GPT-5-nano)
    Stage1CompanyService.execute()
    -> PromptConfig lookup (FORMAT>COMPANY>GLOBAL) or hardcoded fallback
    -> Variable replacement (${knownCompanies}, etc.)
    -> GptCallerService.callNano() with low-detail images
    -> Parse JSON response -> resolve company ID (DB match or JIT create)
    Output: companyId, companyName, confidence, isNewCompany
  |
  v
[3] STAGE_2_FORMAT_IDENTIFICATION (GPT-5-nano)
    Stage2FormatService.execute()
    -> Load format patterns for identified company
    -> PromptConfig lookup or hardcoded fallback
    -> GptCallerService.callNano()
    -> Resolve format ID (DB match or JIT create)
    Output: formatId, formatName, confidence, isNewFormat, configSource
  |
  v
[4] STAGE_3_FIELD_EXTRACTION (GPT-5.2)
    Stage3ExtractionService.execute()
    -> Load PromptConfig (FORMAT>COMPANY>GLOBAL)
    -> Load mapping rules (Tier1 universal + Tier2 company-specific)
    -> Load field definitions (FieldDefinitionSet)
    -> GptCallerService.callFull() with auto/high-detail images
    -> JSON structured output (CHANGE-042)
    -> normalizeClassifiedAs() on all line items (CHANGE-046)
    Output: standardFields, lineItems, customFields, tokenUsage
  |
  v
[4b] EXCHANGE_RATE_CONVERSION (CHANGE-032, optional)
     ExchangeRateConverterService.convert()
     -> Convert totalAmount/subtotal to target currency
  |
  v
[5] TERM_RECORDING (placeholder - TODO at L540)
  |
  v
[6] CONFIDENCE_CALCULATION
    ConfidenceV3_1Service.calculate()
    -> 6 dimensions: STAGE_1_COMPANY(20%), STAGE_2_FORMAT(15%),
       STAGE_3_EXTRACTION(30%), FIELD_COMPLETENESS(20%),
       CONFIG_SOURCE_BONUS(15%), REFERENCE_NUMBER_MATCH(0% by default, 5% when enabled)
    -> CONFIG_SOURCE_BONUS scores: COMPANY_SPECIFIC:100, UNIVERSAL:80, LLM_INFERRED:50
  |
  v
[7] ROUTING_DECISION
    Thresholds: >=90 AUTO_APPROVE, 70-89 QUICK_REVIEW, <70 FULL_REVIEW
    Smart downgrades (two implementations exist — see note below):
      - New company -> downgrade from AUTO_APPROVE to QUICK_REVIEW (generateRoutingDecision)
      - New format -> downgrade from AUTO_APPROVE to QUICK_REVIEW (generateRoutingDecision)
      - LLM_INFERRED config -> downgrade from AUTO_APPROVE to QUICK_REVIEW
      - DEFAULT config source -> downgrade one level (getSmartReviewType only)
      - Stage failure -> FULL_REVIEW
      - >3 items needing classification -> downgrade from AUTO_APPROVE
```

> **Dual routing implementation note**: `confidence-v3-1.service.ts` contains two separate routing
> methods with different downgrade behavior for new companies/formats:
>
> | Method | New Company | New Format | Called By |
> |--------|-------------|------------|-----------|
> | `generateRoutingDecision()` (L373) | AUTO_APPROVE -> QUICK_REVIEW | AUTO_APPROVE -> QUICK_REVIEW | `calculate()` — main V3.1 pipeline path |
> | `getSmartReviewType()` (L527) | -> FULL_REVIEW (forced) | -> QUICK_REVIEW (forced) | External callers via `getSmartReviewTypeV3_1()` export |
>
> The `generateRoutingDecision()` is the primary path used during pipeline execution
> (`calculate()` at L184). The `getSmartReviewType()` is a separate standalone method exported as
> `getSmartReviewTypeV3_1()` via `index.ts`, available for external consumers.
> As of this analysis, it is exported but not actively imported elsewhere in the codebase.

---

## 4. Key Configuration & Constants

### Routing Thresholds (confidence-v3.service.ts L91-98 and confidence-v3-1.service.ts L112-119)

| Level | V3 Threshold | V3.1 Threshold |
|-------|-------------|----------------|
| AUTO_APPROVE | >= 90 | >= 90 |
| QUICK_REVIEW | >= 70 | >= 70 |
| FULL_REVIEW | < 70 | < 70 |

### GPT Model Configuration (gpt-caller.service.ts L153-183)

| Setting | GPT-5-nano | GPT-5.2 |
|---------|-----------|---------|
| maxTokens | 4,096 | 8,192 |
| temperature | undefined (default 1) | 0.1 |
| defaultImageDetail | low | auto |
| Use case | Stage 1 & 2 (identification) | Stage 3 (extraction) |
| Deployment env var | `AZURE_OPENAI_NANO_DEPLOYMENT_NAME` | `AZURE_OPENAI_DEPLOYMENT_NAME` |

### Common Config (gpt-caller.service.ts L153-165)

| Setting | Value |
|---------|-------|
| API Version | `2024-12-01-preview` |
| Timeout | 300,000ms (5 min) |
| Retry Count | 2 |
| Retry Delay | 1,000ms (exponential backoff) |
| Endpoint env | `AZURE_OPENAI_ENDPOINT` |
| API Key env | `AZURE_OPENAI_API_KEY` |

### Prompt Cache (prompt-assembly.service.ts L122-125)

| Setting | Value |
|---------|-------|
| Cache type | In-memory `Map` |
| TTL | 5 minutes |
| Key | JSON of cityCode + companyId + formatId + limits |

### Required Fields (confidence-v3.service.ts L104-110)

`invoiceNumber`, `invoiceDate`, `vendorName`, `totalAmount`, `currency`

---

## 5. Prisma Models Accessed

| Service | Models Accessed | Operations |
|---------|----------------|------------|
| `prompt-assembly.service.ts` | `Company`, `DocumentFormat`, `PromptConfig` | findMany (companies, formats), findMany with scope priority (prompt configs) |
| `result-validation.service.ts` | `Company`, `User`, `DocumentFormat` | findUnique, findFirst, create (JIT) |
| `stage-1-company.service.ts` | `Company`, `User` | findFirst (match), create (JIT) |
| `stage-2-format.service.ts` | `DocumentFormat` | findMany (company formats), findFirst (match), create (JIT) |
| `stage-3-extraction.service.ts` | `PromptConfig`, `FieldMappingConfig`, `MappingRule`, `FieldDefinitionSet` | findFirst/findMany (config loading) |
| `stage-orchestrator.service.ts` | `Company` | findMany (known companies list, limit 50) |
| `unified-document-processor.service.ts` | `Document` | update (status: OCR_PROCESSING, MAPPING_PROCESSING) |
| `reference-number-matcher.service.ts` | (delegates to `reference-number.service.ts`) | ILIKE substring match |
| `exchange-rate-converter.service.ts` | (delegates to `exchange-rate.service.ts`) | Rate lookup + conversion |

---

## 6. External Services Called

| Service | External Dependency | Protocol |
|---------|-------------------|----------|
| `gpt-caller.service.ts` | Azure OpenAI (GPT-5-nano, GPT-5.2) | REST via `fetch` |
| `unified-gpt-extraction.service.ts` | Azure OpenAI (GPT-5.2 Vision) | REST via `fetch` |
| `pdf-converter.ts` | `pdf-to-img` library | Local (in-process) |
| `azure-di-extraction.step.ts` | Azure Document Intelligence | Via `azure-di.service.ts` |
| `exchange-rate-converter.service.ts` | Exchange rate service (internal DB) | Internal service call |
| `reference-number-matcher.service.ts` | Reference number service (PostgreSQL ILIKE) | Internal service call |

---

## 7. TODO/FIXME Comments Found

| File | Line | Comment |
|------|------|---------|
| `extraction-v3.service.ts` | 540 | `TODO: 實現術語記錄邏輯（與 V3 相同，可選步驟）` |
| `extraction-v3.service.ts` | 1016 | `TODO: 實現術語記錄邏輯` |
| `prompt-assembly.service.ts` | 272-273 | `TODO: 需要 Schema 更新` (company aliases/identifiers) |
| `prompt-assembly.service.ts` | 317-318 | `TODO: 需要 Schema 更新` (format patterns/keywords) |
| `prompt-assembly.service.ts` | 377 | `TODO: 需要 Schema 更新以支援完整的術語映射功能` |
| `stage-3-extraction.service.ts` | 191 | `TODO: Phase 2 實現實際 GPT 調用` |
| `stage-3-extraction.service.ts` | 521, 546 | `TODO: Phase 2 - 實現完整的術語映射載入` |
| `confidence-calculator-adapter.ts` | 539 | `TODO: 整合歷史準確率服務` |
| `legacy-processor.adapter.ts` | 76 | `TODO: 整合現有的 batch-processor.service.ts` |

---

## 8. Design Patterns Observed

| Pattern | Where | Description |
|---------|-------|-------------|
| **Strategy** | V2/V3/V3.1 routing | UnifiedDocumentProcessor selects processing strategy via feature flags |
| **Template Method** | `BaseStepHandler` | Abstract `doExecute()` with built-in timeout, retry, skip logic |
| **Factory** | `StepHandlerFactory` | Creates all 11 V2 step handlers with caching |
| **Adapter** | `unified-processor/adapters/` | 7 adapters bridge step interface to existing services |
| **Pipeline** | Both V2 and V3 | Sequential step execution with context passing |
| **Singleton** | `getUnifiedDocumentProcessor()` | Module-level singleton for the processor |
| **Grayscale Release** | Feature flags | Percentage-based V3/V3.1 rollout with random selection |
| **Fallback Chain** | V3.1 -> V3 -> V2 | Cascading fallback on failure |
| **JIT Creation** | Stage 1 & 2, ResultValidation | Auto-create Company/DocumentFormat if not found |
| **Prompt Config Cascade** | Stage 1/2/3 | FORMAT > COMPANY > GLOBAL scope priority |

---

## 9. Change History References

Key CHANGE/FIX tags found in source:

| Tag | Feature |
|-----|---------|
| CHANGE-019 | Intermediate status updates (OCR_PROCESSING, MAPPING_PROCESSING) |
| CHANGE-021 | V3 pure GPT Vision pipeline |
| CHANGE-023 | Image detail mode control |
| CHANGE-024 | V3.1 three-stage architecture |
| CHANGE-025 | Stage prompt loading + smart routing |
| CHANGE-026 | Prompt merger + variable replacer |
| CHANGE-032 | Reference number matching + FX conversion |
| CHANGE-036 | DB-first substring matching (replaced regex) |
| CHANGE-042 | Structured JSON output (json_schema response_format) |
| CHANGE-045 | extraCharges removed from Stage 3 |
| CHANGE-046 | classifiedAs normalization |
| FIX-036 | Abort pipeline when refMatch enabled but no matches found |
