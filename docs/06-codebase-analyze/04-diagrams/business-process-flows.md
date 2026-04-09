# Business Process Flows - Three-Tier Mapping & Confidence Routing

> Generated: 2026-04-09 | Source: architecture-patterns.md, services-core-pipeline.md, services-overview.md

## Three-Tier Mapping Architecture

```mermaid
flowchart TD
    TERM(["Source Term from Invoice<br/>(e.g., 'Ocean Frt', 'THC')"])

    TERM --> T2{"TIER 2: Forwarder-Specific Override<br/>Company-specific mapping rules<br/>Only records DIFFERENCES from universal"}
    T2 -->|Match found| RESULT_T2(["Mapped Field<br/>Source: COMPANY_SPECIFIC<br/>Bonus: 100"])

    T2 -->|No match| T1{"TIER 1: Universal Mapping<br/>Covers 70-80% common terms<br/>Single shared source"}
    T1 -->|Match found| RESULT_T1(["Mapped Field<br/>Source: UNIVERSAL<br/>Bonus: 80"])

    T1 -->|No match| T3{"TIER 3: LLM Classification<br/>GPT-5.2 AI classification<br/>Handles unknown terms"}
    T3 -->|Classified| RESULT_T3(["Mapped Field<br/>Source: LLM_INFERRED<br/>Bonus: 50"])
    T3 -->|Unable to classify| MANUAL(["Manual Review Required"])

    style T2 fill:#4a9eff,color:#fff
    style T1 fill:#22c55e,color:#fff
    style T3 fill:#f59e0b,color:#fff
    style MANUAL fill:#ef4444,color:#fff
```

## Confidence Scoring - Six Dimensions (V3.1)

```mermaid
pie title "Confidence Score Weight Distribution"
    "Stage 1 Company (20%)" : 20
    "Stage 2 Format (15%)" : 15
    "Stage 3 Extraction (30%)" : 30
    "Field Completeness (20%)" : 20
    "Config Source Bonus (15%)" : 15
```

```mermaid
flowchart TD
    SCORE["Weighted Confidence Score<br/>= sum of 6 dimensions"]

    D1["Stage 1: Company ID Confidence<br/>Weight: 20%"]
    D2["Stage 2: Format ID Confidence<br/>Weight: 15%"]
    D3["Stage 3: Extraction Confidence<br/>Weight: 30%"]
    D4["Field Completeness<br/>Weight: 20%<br/>Required: invoiceNumber, invoiceDate,<br/>vendorName, totalAmount, currency"]
    D5["Config Source Bonus<br/>Weight: 15%<br/>COMPANY_SPECIFIC: 100<br/>UNIVERSAL: 80<br/>LLM_INFERRED: 50"]

    D1 --> SCORE
    D2 --> SCORE
    D3 --> SCORE
    D4 --> SCORE
    D5 --> SCORE
```

## Confidence Routing Decision

```mermaid
flowchart TD
    SCORE(["Final Confidence Score"])

    SCORE --> CHECK_SMART{"Smart Downgrade<br/>Rules Apply?"}

    CHECK_SMART -->|New Company| DOWNGRADE_NC["Downgrade from AUTO_APPROVE<br/>to QUICK_REVIEW"]
    CHECK_SMART -->|New Format| FORCE_QUICK["Downgrade from AUTO_APPROVE<br/>to QUICK_REVIEW"]
    CHECK_SMART -->|LLM_INFERRED config| FORCE_QUICK2["Downgrade from AUTO_APPROVE<br/>to QUICK_REVIEW"]
    CHECK_SMART -->|>3 items needing classification| DOWNGRADE2["Downgrade from AUTO_APPROVE<br/>to QUICK_REVIEW"]
    CHECK_SMART -->|Stage failure| FORCE_FULL2["Force FULL_REVIEW"]

    CHECK_SMART -->|No downgrades| THRESHOLD{"Score Threshold"}

    THRESHOLD -->|">= 90%"| AUTO["AUTO_APPROVE<br/>No human review needed"]
    THRESHOLD -->|"70% - 89%"| QUICK["QUICK_REVIEW<br/>One-click confirm/correct"]
    THRESHOLD -->|"< 70%"| FULL["FULL_REVIEW<br/>Detailed manual review"]

    AUTO --> QUEUE["ProcessingQueue<br/>Persist routing decision"]
    QUICK --> QUEUE
    FULL --> QUEUE
    DOWNGRADE_NC --> QUEUE
    FORCE_QUICK --> QUEUE
    FORCE_QUICK2 --> QUEUE
    FORCE_FULL2 --> QUEUE
    DOWNGRADE2 --> QUEUE

    style AUTO fill:#22c55e,color:#fff
    style QUICK fill:#f59e0b,color:#fff
    style FULL fill:#ef4444,color:#fff
```

> **Note on smart downgrade implementation**: In `generateRoutingDecision()` (confidence-v3-1.service.ts), new company / new format / LLM_INFERRED config / >3 classification items all only downgrade AUTO_APPROVE to QUICK_REVIEW. Only stage failure forces FULL_REVIEW. The project CLAUDE.md documents a stricter design ("New Company -> Force FULL_REVIEW") which is not reflected in the main pipeline code -- the documented behavior may exist in a separate validation layer or represent a planned enhancement.

## End-to-End Business Flow

```mermaid
flowchart LR
    subgraph INPUT["Document Sources"]
        MANUAL_UP["Manual Upload"]
        SP["SharePoint"]
        OL["Outlook"]
        N8N["n8n Workflow"]
    end

    subgraph PROCESS["Processing Pipeline"]
        OCR["OCR<br/>Azure DI / GPT Vision"]
        IDENTIFY["Company + Format<br/>Identification"]
        EXTRACT["Field Extraction<br/>+ Mapping (3-Tier)"]
        SCORE["Confidence<br/>Scoring"]
    end

    subgraph REVIEW["Review Routing"]
        AUTO["AUTO_APPROVE<br/>Target: 90-95%"]
        QUICK["QUICK_REVIEW"]
        FULL["FULL_REVIEW"]
    end

    subgraph OUTPUT["Output"]
        TEMPLATE["Template Instance<br/>(ERP Export)"]
        REPORT["Reports &<br/>Analytics"]
        LEARN["Rule Learning<br/>(Corrections -> Suggestions)"]
    end

    INPUT --> OCR --> IDENTIFY --> EXTRACT --> SCORE
    SCORE --> AUTO --> TEMPLATE
    SCORE --> QUICK --> TEMPLATE
    SCORE --> FULL --> TEMPLATE
    TEMPLATE --> REPORT
    FULL -->|Corrections| LEARN
    QUICK -->|Corrections| LEARN
    LEARN -->|New rules| EXTRACT
```

## Prompt Config Resolution Hierarchy

| Priority | Scope | Description |
|----------|-------|-------------|
| 1 (highest) | FORMAT | Format-specific prompt for a specific company's document layout |
| 2 | COMPANY | Company-specific prompt (applies to all formats) |
| 3 (lowest) | GLOBAL | Default fallback prompt (applies to all companies) |

If no DB config found, hardcoded fallback prompts are used (defined in stage services).
