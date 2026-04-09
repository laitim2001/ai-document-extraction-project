# Data Flow - Document Processing Pipeline

> Generated: 2026-04-09 | Source: services-core-pipeline.md, architecture-patterns.md

## Pipeline Version Routing

The `UnifiedDocumentProcessor` selects the processing path based on feature flags.

```mermaid
flowchart TD
    UPLOAD["Document Upload<br/>POST /api/documents/upload"]
    UDP["UnifiedDocumentProcessor"]

    UPLOAD --> UDP

    UDP -->|forceLegacy or<br/>!enableUnifiedProcessor| LEGACY["Legacy Adapter<br/>batch-processor.service.ts"]
    UDP -->|forceV3 or<br/>feature flag enabled| V3CHECK{"V3.1 enabled?<br/>+ grayscale %"}

    V3CHECK -->|Yes| V31["V3.1: Three-Stage Pipeline<br/>StageOrchestrator"]
    V3CHECK -->|No| V3["V3: Single GPT Call<br/>UnifiedGptExtractionService"]
    UDP -->|default| V2["V2: 11-Step Pipeline<br/>StepHandlerFactory"]

    V31 -->|failure + fallbackToV3OnError| V3
    V3 -->|failure + fallbackToV2OnError| V2
```

## V3.1 Pipeline - Primary Path (Detailed)

```mermaid
flowchart TD
    START(["File Input<br/>buffer + fileName + mimeType + cityCode"])

    PREP["1. FILE PREPARATION<br/>PdfConverter.convertToBase64()<br/>PDF -> Base64 PNG images"]
    START --> PREP

    REF{"1b. REFERENCE NUMBER<br/>MATCHING (optional)<br/>DB ILIKE substring on fileName"}
    PREP --> REF
    REF -->|enabled + no matches| ABORT(["ABORT Pipeline<br/>(FIX-036)"])
    REF -->|matches found or disabled| S1

    S1["2. STAGE 1: COMPANY ID<br/>GPT-5-nano (low-detail images)<br/>Identify company/forwarder<br/>JIT create if new"]
    S1 --> S2

    S2["3. STAGE 2: FORMAT ID<br/>GPT-5-nano<br/>Detect document format/layout<br/>JIT create if new"]
    S2 --> S3

    S3["4. STAGE 3: FIELD EXTRACTION<br/>GPT-5.2 (auto/high-detail images)<br/>Load mapping rules (Tier1 + Tier2)<br/>Structured JSON output (CHANGE-042)"]
    S3 --> FX

    FX{"4b. EXCHANGE RATE<br/>CONVERSION (optional)<br/>Convert amounts to target currency"}
    FX --> TERM

    TERM["5. TERM RECORDING<br/>(placeholder - TODO)"]
    TERM --> CONFIDENCE

    CONFIDENCE["6. CONFIDENCE CALCULATION<br/>ConfidenceV3_1Service<br/>6 weighted dimensions"]
    CONFIDENCE --> ROUTE

    ROUTE["7. ROUTING DECISION<br/>>= 90: AUTO_APPROVE<br/>70-89: QUICK_REVIEW<br/>< 70: FULL_REVIEW<br/>+ smart downgrade rules"]
    ROUTE --> PERSIST

    PERSIST["8. PERSISTENCE<br/>ProcessingQueue + ExtractionResult<br/>+ DocumentProcessingStage"]
    PERSIST --> DONE(["Complete"])
```

## V2 Pipeline - 11 Steps

```mermaid
flowchart LR
    S01["1. File Type<br/>Detection"] --> S02["2. Smart<br/>Routing"]
    S02 --> S03["3. Azure DI<br/>OCR"]
    S03 --> S04["4. Issuer<br/>Identification"]
    S04 --> S05["5. Format<br/>Matching"]
    S05 --> S06["6. Config<br/>Fetching"]
    S06 --> S07["7. GPT Enhanced<br/>Extraction"]
    S07 --> S08["8. Field<br/>Mapping"]
    S08 --> S09["9. Term<br/>Recording"]
    S09 --> S10["10. Confidence<br/>Calculation"]
    S10 --> S11["11. Routing<br/>Decision"]
```

## Key Differences Between Versions

| Aspect | V2 (11-Step) | V3 (Single Call) | V3.1 (Three-Stage) |
|--------|-------------|-----------------|-------------------|
| OCR | Azure Document Intelligence | GPT-5.2 Vision | GPT-5.2 Vision |
| GPT Calls | 1 (enhanced extraction) | 1 (unified) | 3 (nano+nano+full) |
| Company ID | Adapter-based | Single GPT output | Dedicated Stage 1 |
| Format ID | Adapter-based | Single GPT output | Dedicated Stage 2 |
| Fallback | None | Falls back to V2 | Falls back to V3 |
| Config | Adapter-fetched | Prompt assembly | Per-stage prompt config |
