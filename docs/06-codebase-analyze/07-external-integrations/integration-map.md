# External Integrations Map

> Generated: 2026-04-09 | Integrations: 9 major categories

---

## Integration Summary

| Integration | Category | Key Files | Env Vars |
|-------------|----------|-----------|----------|
| Azure Blob Storage | Storage | 2 modules (26 files) | 2 |
| Azure Document Intelligence | AI/OCR | Python service + Node proxy | 2 |
| Azure OpenAI (GPT-5.2) | AI | 11 files | 4 |
| Microsoft Graph API | Office 365 | 2 services | 3 |
| NextAuth + Azure AD | Auth | 3 core files | 4 |
| n8n Workflow Engine | Automation | 9 services + 3 API routes | 2 |
| Nodemailer (SMTP) | Email | 1 module | 4 |
| Rate Limiting (In-Memory Map) | Rate-limit | 1 service (Redis is placeholder only) | 0 (env vars declared but unused) |
| PostgreSQL + Prisma | Database | 122 models | 1 |

---

## 1. Azure Blob Storage

**Purpose**: Document file storage (uploads, logos, reports)

### Implementation Files

| File | Purpose |
|------|---------|
| `src/lib/azure/storage.ts` | Primary module: upload, SAS URL generation, delete, exists check |
| `src/lib/azure/index.ts` | Re-export |
| `src/lib/azure-blob.ts` | Legacy module: File/Buffer upload, SAS URL, delete |

### Consumers (26 files)

- `src/services/document.service.ts` - Document CRUD (upload/delete blobs)
- `src/services/batch-processor.service.ts` - Batch processing pipeline
- `src/services/extraction.service.ts` - Passes blob URL to Python OCR
- `src/services/result-retrieval.service.ts` - Retrieves processed results
- `src/services/sharepoint-document.service.ts` - SharePoint-to-blob transfer
- `src/services/outlook-document.service.ts` - Outlook attachment storage
- `src/services/backup.service.ts` - Backup file storage
- `src/services/restore.service.ts` - Restore from backup
- `src/services/expense-report.service.ts` - Report file storage
- `src/services/monthly-cost-report.service.ts` - Report generation
- `src/services/health-check.service.ts` - Blob storage health probe
- `src/services/traceability.service.ts` - Traceability records
- `src/services/data-retention.service.ts` - Retention policy enforcement
- `src/services/n8n/n8n-document.service.ts` - n8n document processing
- `src/app/api/documents/upload/route.ts` - Upload API endpoint
- `src/app/api/documents/[id]/process/route.ts` - Processing endpoint
- `src/app/api/documents/[id]/blob/route.ts` - Direct blob access
- `src/app/api/review/[id]/route.ts` - Review with blob access
- `src/app/api/companies/[id]/route.ts` - Company logo storage
- `src/app/api/admin/historical-data/upload/route.ts` - Historical data upload
- `src/app/api/admin/historical-data/batches/[batchId]/route.ts` - Batch blob access

### Env Vars

| Variable | Example | Required |
|----------|---------|----------|
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;...` | Yes |
| `AZURE_STORAGE_CONTAINER` | `documents` | Yes (default: documents) |

### Dev Environment

Uses **Azurite** emulator (Docker):
- Blob: port 10010
- Queue: port 10011
- Table: port 10012

---

## 2. Azure Document Intelligence (OCR)

**Purpose**: Invoice OCR extraction using prebuilt-invoice model

### Implementation

| Layer | File | Purpose |
|-------|------|---------|
| Python | `python-services/extraction/src/ocr/azure_di.py` | Direct Azure DI SDK client |
| Python | `python-services/extraction/src/ocr/processor.py` | Retry logic and error handling |
| Python | `python-services/extraction/src/main.py` | FastAPI endpoints |
| Node.js | `src/services/extraction.service.ts` | HTTP proxy to Python service |
| Node.js | `src/services/azure-di.service.ts` | Alternative direct DI access |

### SDK

- `azure-ai-documentintelligence==1.0.0` (Python)
- Model: `prebuilt-invoice`
- Features: High-res OCR, language detection

### Env Vars

| Variable | Example | Required |
|----------|---------|----------|
| `AZURE_DI_ENDPOINT` | `https://your-resource.cognitiveservices.azure.com/` | Yes |
| `AZURE_DI_KEY` | API key | Yes |
| `OCR_SERVICE_URL` | `http://localhost:8000` | No (has default) |

---

## 3. Azure OpenAI (GPT-5.2)

**Purpose**: Vision OCR, term classification, field extraction, AI processing

### Implementation Files (11)

| File | Purpose |
|------|---------|
| `src/services/gpt-vision.service.ts` | GPT-5.2 Vision for document analysis |
| `src/services/term-classification.service.ts` | Tier 3 LLM term classification |
| `src/services/ai-term-validator.service.ts` | AI-powered term validation |
| `src/services/extraction-v3/unified-gpt-extraction.service.ts` | V3 unified GPT extraction |
| `src/services/extraction-v3/stages/gpt-caller.service.ts` | Centralized GPT API caller |
| `src/services/extraction-v2/gpt-mini-extractor.service.ts` | V2 GPT Mini extraction |
| `src/lib/prompts/extraction-prompt.ts` | Extraction prompt templates |
| `src/lib/prompts/optimized-extraction-prompt.ts` | Optimized prompt templates |
| `src/app/api/v1/prompt-configs/test/route.ts` | Prompt testing endpoint |
| `src/app/api/test/extraction-compare/route.ts` | Extraction comparison endpoint |
| `src/app/api/rules/test/route.ts` | Rule testing with AI |

### SDK

- `openai` (npm) - OpenAI SDK configured for Azure endpoint

### Env Vars

| Variable | Example | Required |
|----------|---------|----------|
| `AZURE_OPENAI_API_KEY` | Subscription key | Yes |
| `AZURE_OPENAI_ENDPOINT` | `https://your-resource.cognitiveservices.azure.com/` | Yes |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-5.2` | Yes |
| `AZURE_OPENAI_API_VERSION` | `2025-03-01-preview` | Yes |

---

## 4. Microsoft Graph API (SharePoint / Outlook)

**Purpose**: SharePoint document fetching, Outlook email monitoring

### Implementation Files

| File | Purpose |
|------|---------|
| `src/services/microsoft-graph.service.ts` | Graph API client (Client Credentials Flow) |
| `src/services/outlook-mail.service.ts` | Outlook email/attachment operations |
| `src/services/outlook-document.service.ts` | Outlook attachment to blob pipeline |
| `src/services/outlook-config.service.ts` | Outlook connection configuration |
| `src/services/sharepoint-document.service.ts` | SharePoint document download |
| `src/services/sharepoint-config.service.ts` | SharePoint connection configuration |

### Auth Method

- Azure AD Application (Client Credentials Flow)
- SDK: `@microsoft/microsoft-graph-client`, `@azure/identity` (`ClientSecretCredential`)

### Env Vars

| Variable | Example | Required |
|----------|---------|----------|
| `MICROSOFT_GRAPH_CLIENT_ID` | Azure App Registration ID | Yes |
| `MICROSOFT_GRAPH_CLIENT_SECRET` | App secret | Yes |
| `MICROSOFT_GRAPH_TENANT_ID` | Azure AD tenant ID | Yes |

---

## 5. NextAuth + Azure AD (Authentication)

**Purpose**: Enterprise SSO + local account authentication

### Implementation Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | Full NextAuth v5 config (Prisma adapter, RBAC, city permissions) |
| `src/lib/auth.config.ts` | Edge-compatible config (for middleware, no DB) |
| `src/middleware.ts` | Route protection middleware |
| `src/types/next-auth.d.ts` | Type extensions (role, permissions, cities) |
| `src/lib/password.ts` | bcrypt password hashing |
| `src/lib/token.ts` | JWT token utilities |

### Providers

1. **Azure AD (Entra ID)** - Enterprise SSO
2. **Credentials** - Local email/password login

### Session Strategy

- JWT-based (stateless)
- 8-hour max session duration
- Extended with: role, permissions, cityAccess, isGlobalAdmin, isRegionalManager

### Env Vars

| Variable | Example | Required |
|----------|---------|----------|
| `AUTH_SECRET` | Random secret for JWT signing | Yes |
| `AZURE_AD_CLIENT_ID` | Azure App Registration ID | Yes |
| `AZURE_AD_CLIENT_SECRET` | App secret | Yes |
| `AZURE_AD_TENANT_ID` | Azure AD tenant ID | Yes |

---

## 6. n8n Workflow Engine

**Purpose**: Workflow automation, webhook triggers, document processing pipelines

### Implementation Files (9 services + API routes)

| File | Purpose |
|------|---------|
| `src/services/n8n/n8n-webhook.service.ts` | Webhook event sending with retry (1s/5s/30s) |
| `src/services/n8n/n8n-document.service.ts` | n8n-triggered document processing |
| `src/services/n8n/n8n-health.service.ts` | n8n instance health monitoring |
| `src/services/n8n/n8n-api-key.service.ts` | API key management for n8n |
| `src/services/n8n/webhook-config.service.ts` | Webhook endpoint configuration |
| `src/services/n8n/workflow-definition.service.ts` | Workflow template management |
| `src/services/n8n/workflow-execution.service.ts` | Execution tracking and history |
| `src/services/n8n/workflow-error.service.ts` | Error handling and recovery |
| `src/services/n8n/workflow-trigger.service.ts` | Workflow trigger management |
| `src/lib/middleware/n8n-api.middleware.ts` | n8n API authentication middleware |
| `src/app/api/n8n/documents/route.ts` | n8n document submission endpoint |
| `src/app/api/n8n/documents/[id]/result/route.ts` | n8n result retrieval endpoint |

### Webhook Event Types

DOCUMENT_RECEIVED, DOCUMENT_PROCESSING, DOCUMENT_COMPLETED, DOCUMENT_FAILED, DOCUMENT_REVIEW_NEEDED, WORKFLOW_STARTED, WORKFLOW_COMPLETED, WORKFLOW_FAILED

### Env Vars

| Variable | Example | Required |
|----------|---------|----------|
| `N8N_BASE_URL` | `http://localhost:5678` | Yes |
| `N8N_API_KEY` | n8n instance API key | Yes |

---

## 7. Nodemailer (SMTP Email)

**Purpose**: Verification emails, password reset emails, notifications

### Implementation

| File | Purpose |
|------|---------|
| `src/lib/email.ts` | SMTP transport setup + email sending functions |

### Behavior

- **Development**: Uses JSON transport (console.log output) if SMTP not configured
- **Production**: SMTP transport with configurable host/port/auth

### Env Vars

| Variable | Example | Required |
|----------|---------|----------|
| `SMTP_HOST` | `smtp.office365.com` | Production only |
| `SMTP_PORT` | `587` | No (default: 587) |
| `SMTP_USER` | Email address | Production only |
| `SMTP_PASSWORD` | Password | Production only |

---

## 8. Rate Limiting (In-Memory Map)

**Purpose**: API rate limiting (sliding window algorithm)

> **Note**: Despite `@upstash/redis` being listed as a dependency and referenced in JSDoc comments, the actual `RateLimitService` implementation uses an **in-memory `Map`** for storage (see `rate-limit.service.ts` line 72). Upstash Redis is a placeholder for future production use. The env vars below are declared but not consumed by the current rate-limit implementation.

### Implementation

| File | Purpose |
|------|---------|
| `src/services/rate-limit.service.ts` | Sliding window rate limiter using in-memory Map (Redis is placeholder only) |
| `src/services/health-check.service.ts` | Redis connectivity health probe |

### Features

- Sliding window algorithm per API key
- Per-minute request limits
- In-memory storage (development); Redis planned for production
- Admin reset capability
- Usage monitoring

### Env Vars (declared but not used by current rate-limit code)

| Variable | Example | Required |
|----------|---------|----------|
| `UPSTASH_REDIS_REST_URL` | `https://your-instance.upstash.io` | No (placeholder) |
| `UPSTASH_REDIS_REST_TOKEN` | REST API token | No (placeholder) |

---

## 9. PostgreSQL + Prisma ORM

**Purpose**: Primary data store for all business entities

### Implementation

| File | Purpose |
|------|---------|
| `src/lib/prisma.ts` | Prisma Client singleton |
| `src/lib/db-context.ts` | DB context utilities (city-based RLS) |
| `prisma/schema.prisma` | 122 model definitions |

### Env Vars

| Variable | Example | Required |
|----------|---------|----------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/ai_document_extraction` | Yes |

### Docker

- PostgreSQL 15 on port 5433 (not default 5432)
- pgAdmin on port 5050

---

## Complete Env Var Reference

| Variable | Service | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL | Yes |
| `AUTH_SECRET` | NextAuth | Yes |
| `AZURE_AD_CLIENT_ID` | Azure AD SSO | Yes |
| `AZURE_AD_CLIENT_SECRET` | Azure AD SSO | Yes |
| `AZURE_AD_TENANT_ID` | Azure AD SSO | Yes |
| `NEXT_PUBLIC_APP_URL` | Next.js | Yes |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage | Yes |
| `AZURE_STORAGE_CONTAINER` | Blob Storage | No (default: documents) |
| `AZURE_DI_ENDPOINT` | Document Intelligence | Yes |
| `AZURE_DI_KEY` | Document Intelligence | Yes |
| `OCR_SERVICE_URL` | Python OCR proxy | No (default: localhost:8000) |
| `MAPPING_SERVICE_URL` | Python Mapping proxy (used by identification.service.ts; this is the name in .env.example) | No (default: localhost:8001) |
| `PYTHON_MAPPING_SERVICE_URL` | Python Mapping proxy (used by mapping.service.ts; not in .env.example) | No (default: localhost:8001) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI | Yes |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI | Yes |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Azure OpenAI | Yes |
| `AZURE_OPENAI_API_VERSION` | Azure OpenAI | Yes |
| `MICROSOFT_GRAPH_CLIENT_ID` | Graph API | Yes |
| `MICROSOFT_GRAPH_CLIENT_SECRET` | Graph API | Yes |
| `MICROSOFT_GRAPH_TENANT_ID` | Graph API | Yes |
| `N8N_BASE_URL` | n8n | Yes |
| `N8N_API_KEY` | n8n | Yes |
| `UPSTASH_REDIS_REST_URL` | Redis (placeholder) | No |
| `UPSTASH_REDIS_REST_TOKEN` | Redis (placeholder) | No |
| `SMTP_HOST` | Nodemailer | Prod only |
| `SMTP_PORT` | Nodemailer | No (default: 587) |
| `SMTP_USER` | Nodemailer | Prod only |
| `SMTP_PASSWORD` | Nodemailer | Prod only |
| `BCRYPT_SALT_ROUNDS` | Password hashing | No (default: 12) |
| `ENABLE_UNIFIED_PROCESSOR` | Feature flag | No (default: false) |

---

## 10. File Processing Libraries

**Purpose**: PDF parsing/rendering/generation and Excel export

### PDF Processing

| Package | Purpose |
|---------|---------|
| `pdfjs-dist` | PDF parsing and rendering (client + server) |
| `pdf-parse` | Server-side PDF text extraction |
| `pdf-to-img` | PDF to image conversion (for OCR pipeline) |
| `react-pdf` | PDF viewer component (document preview UI) |
| `pdfkit` | PDF generation (reports, exports) |
| `canvas` | Server-side canvas for PDF rendering support |

### Excel Processing

| Package | Purpose |
|---------|---------|
| `exceljs` | Excel file generation and export (template exports, reports) |
