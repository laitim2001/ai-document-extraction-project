# Python Services Analysis

> Generated: 2026-04-09 | Total LOC: ~1,870 | Services: 2 | Framework: FastAPI

---

## Architecture Overview

```
Node.js (Next.js)                    Python Services
┌──────────────────┐        HTTP     ┌────────────────────────────┐
│ extraction.       │───────────────>│ Extraction Service :8000   │
│   service.ts      │  POST /extract │   └─ Azure Document Intel. │
│                   │                │                            │
│ identification.   │───────────────>│ Mapping Service :8001      │
│   service.ts      │  POST /identify│   ├─ ForwarderMatcher      │
│ mapping.service.  │  POST /map-fld │   └─ FieldMapper           │
│   ts              │                │                            │
└──────────────────┘                └────────────────────────────┘
```

---

## Service 1: OCR Extraction Service (port 8000)

**Path**: `python-services/extraction/`
**Runtime**: Python 3.12, FastAPI, Uvicorn
**Purpose**: OCR text extraction via Azure Document Intelligence

### Endpoints

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| GET | `/health` | - | `HealthResponse` | Health check (reports Azure config status) |
| POST | `/extract/url` | `ExtractUrlRequest` | `ExtractResponse` | Extract from document URL (SAS token) |
| POST | `/extract/file` | multipart (file + documentId) | `ExtractResponse` | Extract from uploaded file |

### Request/Response Schemas

**ExtractUrlRequest**:
- `documentUrl` (HttpUrl, required) - Document URL with SAS token
- `documentId` (str, optional) - Tracking ID

**ExtractResponse**:
- `success` (bool), `errorCode` (str), `errorMessage` (str?)
- `retryCount` (int), `rawResult` (dict?), `extractedText` (str)
- `invoiceData` (dict?), `processingTime` (int?), `pageCount` (int?), `confidence` (float?)

### Key Components

| File | LOC | Purpose |
|------|-----|---------|
| `main.py` | 293 | FastAPI app, routes, config, Pydantic models |
| `ocr/azure_di.py` | 320 | Azure DI client wrapper (prebuilt-invoice model) |
| `ocr/processor.py` | 269 | Retry logic, error classification, MIME validation |

### Azure DI Integration

- **Model**: `prebuilt-invoice` (Azure Document Intelligence)
- **SDK**: `azure-ai-documentintelligence==1.0.0`
- **Features**: URL and bytes input, optional high-res OCR
- **Invoice Fields Extracted**: vendorName, customerName, invoiceId, invoiceDate, dueDate, subTotal, totalTax, invoiceTotal, amountDue, currency, line items
- **Retry**: Exponential backoff (configurable max_retries, retry_delay)
- **Error Codes**: SUCCESS, INVALID_INPUT, NETWORK_ERROR, SERVICE_ERROR, TIMEOUT, UNSUPPORTED_FORMAT, FILE_TOO_LARGE, UNKNOWN_ERROR
- **Supported MIME**: PDF, JPEG, PNG, TIFF, BMP

### Env Vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `AZURE_DI_ENDPOINT` | "" | Azure Document Intelligence endpoint |
| `AZURE_DI_KEY` | "" | Azure DI API key |
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8000 | Server port |
| `DEBUG` | false | Debug mode (reload, console logs) |
| `CORS_ORIGINS` | http://localhost:3000 | Allowed CORS origins |
| `MAX_RETRIES` | 3 | Max retry attempts |
| `RETRY_DELAY` | 1.0 | Base retry delay (seconds) |

### Node.js Caller

- **File**: `src/services/extraction.service.ts` (line 41)
- **URL**: `process.env.OCR_SERVICE_URL || 'http://localhost:8000'`
- **Calls**: `POST /extract/url`, `GET /health`

---

## Service 2: Forwarder Mapping Service (port 8001)

**Path**: `python-services/mapping/`
**Runtime**: Python 3.11, FastAPI, Uvicorn
**Purpose**: Forwarder identification and field mapping from OCR text

### Endpoints

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| GET | `/health` | - | `HealthResponse` | Health check (reports forwarder count) |
| GET | `/forwarders` | - | `ForwardersResponse` | List all active forwarders |
| POST | `/identify` | `IdentifyRequest` | `IdentifyResponse` | Identify forwarder from OCR text |
| POST | `/map-fields` | `MapFieldsRequest` | `MapFieldsResponse` | Extract field values from OCR text |

### Identification Confidence Scoring

| Match Type | Score | Cap |
|------------|-------|-----|
| Name match | +40 | First match only |
| Keyword match | +15/each | Max 30 total |
| Format match (regex) | +20 | First match only |
| Logo text match | +10 | First match only |
| Bonus per extra match | +5 | - |

**Routing Thresholds**:
- >= 80%: IDENTIFIED (auto)
- 50-79%: NEEDS_REVIEW
- < 50%: UNIDENTIFIED

### Field Mapping (3-Tier Architecture)

| Method | Base Confidence | Description |
|--------|-----------------|-------------|
| azure_field | 90% | Direct Azure DI field extraction |
| regex | 85% | Regular expression matching |
| keyword | 75% | Keyword proximity matching |
| position | 70% | Position-based extraction (not implemented) |
| llm | 60% | LLM classification (placeholder) |

**Extraction Routing**:
- >= 90%: AUTO_APPROVE
- 70-89%: QUICK_REVIEW
- < 70%: FULL_REVIEW

### Key Components

| File | LOC | Purpose |
|------|-----|---------|
| `main.py` | 540 | FastAPI app, routes, default patterns (6 forwarders), DB loader |
| `identifier/matcher.py` | 311 | Pattern matching engine (name, keyword, format, logo) |
| `mapper/models.py` | 214 | Pydantic models (MappingRule, FieldMappingResult, etc.) |
| `mapper/field_mapper.py` | 695 | 3-tier field extraction + normalization (date, amount, weight) |

### Default Forwarder Patterns (Fallback)

DHL, FedEx, UPS, Maersk, MSC, SF Express - used when DB unavailable.

### DB Pattern Loading

- Connects via `psycopg2` to PostgreSQL
- Queries: `SELECT ... FROM forwarders WHERE is_active = true ORDER BY priority DESC`
- Parses `identification_patterns` JSON column

### Env Vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST` | 0.0.0.0 | Server host |
| `PORT` | 8001 | Server port |
| `DEBUG` | false | Debug mode |
| `CORS_ORIGINS` | http://localhost:3000 | Allowed CORS origins |
| `DATABASE_URL` | "" | PostgreSQL connection string |

### Node.js Callers

- **Identification**: `src/services/identification/identification.service.ts` (line 95)
  - URL: `process.env.MAPPING_SERVICE_URL || 'http://localhost:8001'`
  - Calls: `POST /identify`
- **Field Mapping**: `src/services/mapping.service.ts` (line 48)
  - URL: `process.env.PYTHON_MAPPING_SERVICE_URL || 'http://localhost:8001'`
  - Calls: `POST /map-fields`

---

## Docker Deployment

| Service | Dockerfile | Base Image | Port |
|---------|-----------|------------|------|
| Extraction | `python-services/extraction/Dockerfile` | python:3.12-slim (multi-stage) | 8000 |
| Mapping | `python-services/mapping/Dockerfile` | python:3.11-slim | 8001 |

Both include HEALTHCHECK directives and run as non-root users (extraction only).

### Key Dependencies

**Extraction**: fastapi 0.115.6, azure-ai-documentintelligence 1.0.0, azure-core 1.32.0, pydantic 2.10.4, structlog 24.4.0
**Mapping**: fastapi >=0.109.0, pydantic >=2.5.0, psycopg2-binary >=2.9.9, structlog >=24.1.0, httpx >=0.26.0

---

## Data Flow: Upload to Extraction

```
1. User uploads file via /documents/upload (Next.js API)
2. File stored in Azure Blob Storage
3. SAS URL generated for the blob
4. Node.js calls Python Extraction: POST /extract/url {documentUrl: sasUrl}
5. Python calls Azure DI: prebuilt-invoice model
6. Azure DI returns: raw OCR text + structured invoice fields
7. Python returns ExtractResponse to Node.js
8. Node.js calls Python Mapping: POST /identify {text: ocrText}
9. Python matches against forwarder patterns -> returns company ID
10. Node.js calls Python Mapping: POST /map-fields {ocrText, rules, azureInvoiceData}
11. Python applies 3-tier mapping -> returns field values with confidence
12. Node.js persists results to PostgreSQL
```
