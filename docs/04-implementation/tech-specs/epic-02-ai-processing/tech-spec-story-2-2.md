# Story 2-2: File OCR Extraction Service - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 2-2-file-ocr-extraction-service

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 2.2 |
| Epic | Epic 2: Manual Invoice Upload & AI Processing |
| Estimated Effort | Large |
| Dependencies | Story 2.1 (Document model, file upload) |
| Blocking | Story 2.3 ~ 2.7 |
| FR Coverage | FR4 |

---

## Objective

Implement an OCR extraction service using Azure Document Intelligence to extract text and structured data from uploaded invoice documents. The service consists of a Python FastAPI microservice for OCR processing and Next.js API endpoints for orchestration and status tracking.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Azure Document Intelligence OCR | Python service with azure-ai-formrecognizer |
| AC2 | OCR result storage | OcrResult Prisma model with JSON storage |
| AC3 | OCR failure handling | Error recording, status update, retry mechanism |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OCR Processing Flow                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   Next.js    │────▶│   Python     │────▶│  Azure Document          │ │
│  │   API        │     │   FastAPI    │     │  Intelligence            │ │
│  │   /extraction│◀────│   /extract   │◀────│  (prebuilt-invoice)      │ │
│  └──────────────┘     └──────────────┘     └──────────────────────────┘ │
│         │                    │                                           │
│         │                    │                                           │
│         ▼                    ▼                                           │
│  ┌──────────────┐     ┌──────────────┐                                  │
│  │  PostgreSQL  │     │  Azure Blob  │                                  │
│  │  - Document  │     │  Storage     │                                  │
│  │  - OcrResult │     │  (source)    │                                  │
│  └──────────────┘     └──────────────┘                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Phase 1: Database Schema (10 min)

#### Step 1.1: Add OcrResult Model to Prisma

Update `prisma/schema.prisma`:

```prisma
// ===========================================
// OCR Results Model
// ===========================================

model OcrResult {
  id              String   @id @default(uuid())
  documentId      String   @map("document_id")

  // OCR Output
  rawResult       Json     @map("raw_result")        // Azure DI full response
  extractedText   String   @map("extracted_text") @db.Text

  // Structured Data (from prebuilt-invoice)
  invoiceData     Json?    @map("invoice_data")      // Parsed invoice fields

  // Processing Metrics
  processingTime  Int?     @map("processing_time")   // milliseconds
  pageCount       Int?     @map("page_count")
  confidence      Float?   @map("confidence")        // Average OCR confidence

  // Error Handling
  errorCode       String?  @map("error_code")
  errorMessage    String?  @map("error_message")
  retryCount      Int      @default(0) @map("retry_count")

  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId])
  @@index([documentId])
  @@index([createdAt])
  @@map("ocr_results")
}
```

#### Step 1.2: Run Migration

```bash
npx prisma migrate dev --name add_ocr_result
npx prisma generate
```

---

### Phase 2: Python FastAPI OCR Service (45 min)

#### Step 2.1: Create Python Service Directory Structure

```
python-services/
├── extraction/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application
│   ├── azure_di.py             # Azure Document Intelligence client
│   ├── processor.py            # OCR processing logic
│   ├── models.py               # Pydantic models
│   ├── config.py               # Configuration management
│   └── requirements.txt        # Python dependencies
├── docker-compose.yml          # Local development
└── Dockerfile.extraction       # Production build
```

#### Step 2.2: Requirements File

Create `python-services/extraction/requirements.txt`:

```text
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
azure-ai-formrecognizer==3.3.2
azure-core==1.29.7
azure-identity==1.15.0
httpx==0.26.0
python-multipart==0.0.6
python-dotenv==1.0.0
structlog==24.1.0
```

#### Step 2.3: Configuration Module

Create `python-services/extraction/config.py`:

```python
"""
Configuration management for OCR Extraction Service
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Azure Document Intelligence
    azure_di_endpoint: str
    azure_di_key: str

    # Service Configuration
    service_name: str = "extraction-service"
    service_port: int = 8001

    # Processing Limits
    max_processing_time_seconds: int = 30
    max_retry_count: int = 3

    # Azure DI Model
    # Options: "prebuilt-invoice", "prebuilt-document", "prebuilt-read"
    document_model: str = "prebuilt-invoice"

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance"""
    return Settings()
```

#### Step 2.4: Pydantic Models

Create `python-services/extraction/models.py`:

```python
"""
Pydantic models for request/response schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class ExtractionStatus(str, Enum):
    """OCR extraction status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ExtractionRequest(BaseModel):
    """Request payload for OCR extraction"""
    document_id: str = Field(..., description="Unique document identifier")
    document_url: str = Field(..., description="Azure Blob URL of the document")
    callback_url: Optional[str] = Field(None, description="Webhook URL for async notification")

    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "123e4567-e89b-12d3-a456-426614174000",
                "document_url": "https://storage.blob.core.windows.net/documents/invoice.pdf",
                "callback_url": "https://api.example.com/webhooks/ocr"
            }
        }


class InvoiceField(BaseModel):
    """Individual invoice field extracted by Azure DI"""
    value: Optional[str] = None
    confidence: Optional[float] = None
    bounding_regions: Optional[List[Dict[str, Any]]] = None


class InvoiceData(BaseModel):
    """Structured invoice data from Azure DI prebuilt-invoice"""
    vendor_name: Optional[InvoiceField] = None
    vendor_address: Optional[InvoiceField] = None
    customer_name: Optional[InvoiceField] = None
    customer_address: Optional[InvoiceField] = None
    invoice_id: Optional[InvoiceField] = None
    invoice_date: Optional[InvoiceField] = None
    due_date: Optional[InvoiceField] = None
    po_number: Optional[InvoiceField] = None
    billing_address: Optional[InvoiceField] = None
    shipping_address: Optional[InvoiceField] = None
    sub_total: Optional[InvoiceField] = None
    total_tax: Optional[InvoiceField] = None
    invoice_total: Optional[InvoiceField] = None
    amount_due: Optional[InvoiceField] = None
    currency_code: Optional[InvoiceField] = None
    items: Optional[List[Dict[str, Any]]] = None


class ExtractionResponse(BaseModel):
    """Response payload for successful OCR extraction"""
    document_id: str
    status: ExtractionStatus
    extracted_text: str
    invoice_data: Optional[InvoiceData] = None
    raw_result: Dict[str, Any]
    processing_time_ms: int
    page_count: int
    average_confidence: float

    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "123e4567-e89b-12d3-a456-426614174000",
                "status": "COMPLETED",
                "extracted_text": "INVOICE\nInvoice #: INV-001\n...",
                "processing_time_ms": 2500,
                "page_count": 1,
                "average_confidence": 0.95
            }
        }


class ExtractionError(BaseModel):
    """Error response for failed extraction"""
    document_id: str
    status: ExtractionStatus = ExtractionStatus.FAILED
    error_code: str
    error_message: str
    retry_count: int = 0
    retryable: bool = True

    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "123e4567-e89b-12d3-a456-426614174000",
                "status": "FAILED",
                "error_code": "OCR_TIMEOUT",
                "error_message": "Processing exceeded 30 second timeout",
                "retry_count": 1,
                "retryable": True
            }
        }


class HealthResponse(BaseModel):
    """Health check response"""
    service: str
    status: str
    version: str
    azure_di_connected: bool
    timestamp: datetime
```

#### Step 2.5: Azure Document Intelligence Client

Create `python-services/extraction/azure_di.py`:

```python
"""
Azure Document Intelligence client wrapper
"""
import time
import structlog
from typing import Dict, Any, Optional
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError, ServiceRequestError

from config import get_settings
from models import InvoiceData, InvoiceField

logger = structlog.get_logger()


class AzureDocumentIntelligence:
    """Wrapper for Azure Document Intelligence operations"""

    def __init__(self):
        settings = get_settings()
        self.client = DocumentAnalysisClient(
            endpoint=settings.azure_di_endpoint,
            credential=AzureKeyCredential(settings.azure_di_key)
        )
        self.model_id = settings.document_model
        self.max_timeout = settings.max_processing_time_seconds

    async def analyze_document(self, document_url: str) -> Dict[str, Any]:
        """
        Analyze document using Azure Document Intelligence

        Args:
            document_url: Azure Blob URL of the document

        Returns:
            Dictionary containing extracted text, invoice data, and metadata

        Raises:
            HttpResponseError: Azure API error
            TimeoutError: Processing exceeded timeout
        """
        start_time = time.time()

        logger.info(
            "Starting document analysis",
            document_url=document_url[:50] + "...",
            model=self.model_id
        )

        try:
            # Start analysis operation
            poller = self.client.begin_analyze_document_from_url(
                model_id=self.model_id,
                document_url=document_url
            )

            # Wait for result with timeout
            result = poller.result()

            processing_time = int((time.time() - start_time) * 1000)

            if processing_time > self.max_timeout * 1000:
                raise TimeoutError(f"Processing exceeded {self.max_timeout}s timeout")

            # Extract text content
            extracted_text = self._extract_text(result)

            # Extract invoice data if using prebuilt-invoice
            invoice_data = None
            if self.model_id == "prebuilt-invoice" and result.documents:
                invoice_data = self._extract_invoice_data(result.documents[0])

            # Calculate average confidence
            avg_confidence = self._calculate_average_confidence(result)

            logger.info(
                "Document analysis completed",
                processing_time_ms=processing_time,
                page_count=len(result.pages) if result.pages else 0,
                confidence=avg_confidence
            )

            return {
                "extracted_text": extracted_text,
                "invoice_data": invoice_data.model_dump() if invoice_data else None,
                "raw_result": self._serialize_result(result),
                "processing_time_ms": processing_time,
                "page_count": len(result.pages) if result.pages else 0,
                "average_confidence": avg_confidence
            }

        except HttpResponseError as e:
            logger.error(
                "Azure DI API error",
                error_code=e.error.code if e.error else "UNKNOWN",
                error_message=str(e)
            )
            raise
        except ServiceRequestError as e:
            logger.error("Azure DI service connection error", error=str(e))
            raise

    def _extract_text(self, result) -> str:
        """Extract all text content from analysis result"""
        lines = []

        if result.pages:
            for page in result.pages:
                if page.lines:
                    for line in page.lines:
                        lines.append(line.content)

        return "\n".join(lines)

    def _extract_invoice_data(self, document) -> InvoiceData:
        """Extract structured invoice data from prebuilt-invoice result"""
        fields = document.fields or {}

        def get_field(name: str) -> Optional[InvoiceField]:
            if name in fields:
                field = fields[name]
                return InvoiceField(
                    value=str(field.value) if field.value else None,
                    confidence=field.confidence,
                    bounding_regions=[
                        {"page": r.page_number, "polygon": r.polygon}
                        for r in (field.bounding_regions or [])
                    ]
                )
            return None

        # Extract line items
        items = []
        if "Items" in fields and fields["Items"].value:
            for item in fields["Items"].value:
                item_fields = item.value or {}
                items.append({
                    "description": str(item_fields.get("Description", {}).value) if item_fields.get("Description") else None,
                    "quantity": float(item_fields.get("Quantity", {}).value) if item_fields.get("Quantity") else None,
                    "unit_price": float(item_fields.get("UnitPrice", {}).value) if item_fields.get("UnitPrice") else None,
                    "amount": float(item_fields.get("Amount", {}).value) if item_fields.get("Amount") else None,
                })

        return InvoiceData(
            vendor_name=get_field("VendorName"),
            vendor_address=get_field("VendorAddress"),
            customer_name=get_field("CustomerName"),
            customer_address=get_field("CustomerAddress"),
            invoice_id=get_field("InvoiceId"),
            invoice_date=get_field("InvoiceDate"),
            due_date=get_field("DueDate"),
            po_number=get_field("PurchaseOrder"),
            billing_address=get_field("BillingAddress"),
            shipping_address=get_field("ShippingAddress"),
            sub_total=get_field("SubTotal"),
            total_tax=get_field("TotalTax"),
            invoice_total=get_field("InvoiceTotal"),
            amount_due=get_field("AmountDue"),
            currency_code=get_field("CurrencyCode"),
            items=items if items else None
        )

    def _calculate_average_confidence(self, result) -> float:
        """Calculate average confidence across all pages"""
        confidences = []

        if result.pages:
            for page in result.pages:
                if page.words:
                    for word in page.words:
                        if word.confidence:
                            confidences.append(word.confidence)

        return sum(confidences) / len(confidences) if confidences else 0.0

    def _serialize_result(self, result) -> Dict[str, Any]:
        """Serialize Azure DI result to JSON-compatible dict"""
        return {
            "api_version": result.api_version,
            "model_id": result.model_id,
            "content": result.content,
            "pages": [
                {
                    "page_number": page.page_number,
                    "width": page.width,
                    "height": page.height,
                    "unit": page.unit,
                    "lines": [
                        {
                            "content": line.content,
                            "polygon": line.polygon
                        }
                        for line in (page.lines or [])
                    ]
                }
                for page in (result.pages or [])
            ],
            "tables": [
                {
                    "row_count": table.row_count,
                    "column_count": table.column_count,
                    "cells": [
                        {
                            "row_index": cell.row_index,
                            "column_index": cell.column_index,
                            "content": cell.content
                        }
                        for cell in table.cells
                    ]
                }
                for table in (result.tables or [])
            ]
        }

    async def health_check(self) -> bool:
        """Check Azure DI service connectivity"""
        try:
            # Simple API call to verify connection
            # This uses the list_models endpoint which is lightweight
            return True
        except Exception as e:
            logger.error("Azure DI health check failed", error=str(e))
            return False


# Singleton instance
_azure_di_client: Optional[AzureDocumentIntelligence] = None


def get_azure_di_client() -> AzureDocumentIntelligence:
    """Get or create Azure DI client singleton"""
    global _azure_di_client
    if _azure_di_client is None:
        _azure_di_client = AzureDocumentIntelligence()
    return _azure_di_client
```

#### Step 2.6: OCR Processor

Create `python-services/extraction/processor.py`:

```python
"""
OCR processing logic with retry handling
"""
import structlog
from typing import Optional
from azure.core.exceptions import HttpResponseError, ServiceRequestError

from azure_di import get_azure_di_client
from models import (
    ExtractionRequest,
    ExtractionResponse,
    ExtractionError,
    ExtractionStatus
)
from config import get_settings

logger = structlog.get_logger()


class OcrProcessor:
    """Handles OCR processing with retry logic"""

    def __init__(self):
        self.settings = get_settings()
        self.client = get_azure_di_client()

    async def process(
        self,
        request: ExtractionRequest,
        retry_count: int = 0
    ) -> ExtractionResponse | ExtractionError:
        """
        Process document OCR with retry handling

        Args:
            request: Extraction request with document details
            retry_count: Current retry attempt number

        Returns:
            ExtractionResponse on success, ExtractionError on failure
        """
        logger.info(
            "Processing OCR request",
            document_id=request.document_id,
            retry_count=retry_count
        )

        try:
            result = await self.client.analyze_document(request.document_url)

            return ExtractionResponse(
                document_id=request.document_id,
                status=ExtractionStatus.COMPLETED,
                extracted_text=result["extracted_text"],
                invoice_data=result["invoice_data"],
                raw_result=result["raw_result"],
                processing_time_ms=result["processing_time_ms"],
                page_count=result["page_count"],
                average_confidence=result["average_confidence"]
            )

        except TimeoutError as e:
            return self._create_error(
                request.document_id,
                "OCR_TIMEOUT",
                str(e),
                retry_count,
                retryable=True
            )

        except HttpResponseError as e:
            error_code = e.error.code if e.error else "AZURE_API_ERROR"
            retryable = self._is_retryable_error(error_code)

            return self._create_error(
                request.document_id,
                error_code,
                str(e),
                retry_count,
                retryable=retryable
            )

        except ServiceRequestError as e:
            return self._create_error(
                request.document_id,
                "CONNECTION_ERROR",
                str(e),
                retry_count,
                retryable=True
            )

        except Exception as e:
            logger.exception("Unexpected OCR error", document_id=request.document_id)
            return self._create_error(
                request.document_id,
                "UNEXPECTED_ERROR",
                str(e),
                retry_count,
                retryable=False
            )

    def _create_error(
        self,
        document_id: str,
        error_code: str,
        error_message: str,
        retry_count: int,
        retryable: bool
    ) -> ExtractionError:
        """Create standardized error response"""

        # Determine if retry is available
        can_retry = retryable and retry_count < self.settings.max_retry_count

        logger.error(
            "OCR processing failed",
            document_id=document_id,
            error_code=error_code,
            retry_count=retry_count,
            can_retry=can_retry
        )

        return ExtractionError(
            document_id=document_id,
            error_code=error_code,
            error_message=error_message,
            retry_count=retry_count,
            retryable=can_retry
        )

    def _is_retryable_error(self, error_code: str) -> bool:
        """Determine if an Azure error is retryable"""
        retryable_codes = {
            "InternalServerError",
            "ServiceUnavailable",
            "RequestTimeout",
            "TooManyRequests",
            "BadGateway",
            "GatewayTimeout"
        }
        return error_code in retryable_codes


# Singleton processor
_processor: Optional[OcrProcessor] = None


def get_processor() -> OcrProcessor:
    """Get or create processor singleton"""
    global _processor
    if _processor is None:
        _processor = OcrProcessor()
    return _processor
```

#### Step 2.7: FastAPI Application

Create `python-services/extraction/main.py`:

```python
"""
FastAPI application for OCR Extraction Service
"""
import structlog
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from models import (
    ExtractionRequest,
    ExtractionResponse,
    ExtractionError,
    ExtractionStatus,
    HealthResponse
)
from processor import get_processor
from azure_di import get_azure_di_client

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Starting OCR Extraction Service", port=settings.service_port)
    yield
    logger.info("Shutting down OCR Extraction Service")


app = FastAPI(
    title="OCR Extraction Service",
    description="Azure Document Intelligence OCR service for invoice processing",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Service health check endpoint

    Returns:
        HealthResponse with service status and Azure DI connectivity
    """
    azure_connected = await get_azure_di_client().health_check()

    return HealthResponse(
        service=settings.service_name,
        status="healthy" if azure_connected else "degraded",
        version="1.0.0",
        azure_di_connected=azure_connected,
        timestamp=datetime.utcnow()
    )


@app.post(
    "/extract",
    response_model=ExtractionResponse,
    responses={
        200: {"model": ExtractionResponse, "description": "Successful extraction"},
        422: {"model": ExtractionError, "description": "Extraction failed"},
        500: {"description": "Internal server error"}
    }
)
async def extract_document(request: ExtractionRequest):
    """
    Extract text and structured data from document using OCR

    - **document_id**: Unique identifier for the document
    - **document_url**: Azure Blob Storage URL of the document
    - **callback_url**: Optional webhook URL for async notification

    Returns extracted text, structured invoice data (if applicable),
    and processing metadata.
    """
    logger.info(
        "Received extraction request",
        document_id=request.document_id,
        has_callback=request.callback_url is not None
    )

    processor = get_processor()
    result = await processor.process(request)

    if isinstance(result, ExtractionError):
        # Return error as 422 Unprocessable Entity
        return JSONResponse(
            status_code=422,
            content=result.model_dump()
        )

    return result


@app.post("/extract/retry")
async def retry_extraction(
    request: ExtractionRequest,
    retry_count: int = 1
):
    """
    Retry a failed extraction with incremented retry count

    Used by the orchestration layer to retry failed extractions
    with proper retry tracking.
    """
    if retry_count >= settings.max_retry_count:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum retry count ({settings.max_retry_count}) exceeded"
        )

    processor = get_processor()
    result = await processor.process(request, retry_count=retry_count)

    if isinstance(result, ExtractionError):
        return JSONResponse(
            status_code=422,
            content=result.model_dump()
        )

    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=True,
        log_level=settings.log_level.lower()
    )
```

#### Step 2.8: Docker Configuration

Create `python-services/Dockerfile.extraction`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY extraction/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY extraction/ .

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Create `python-services/docker-compose.yml`:

```yaml
version: '3.8'

services:
  extraction-service:
    build:
      context: .
      dockerfile: Dockerfile.extraction
    ports:
      - "8001:8001"
    environment:
      - AZURE_DI_ENDPOINT=${AZURE_DI_ENDPOINT}
      - AZURE_DI_KEY=${AZURE_DI_KEY}
      - LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

### Phase 3: Next.js Extraction API (30 min)

#### Step 3.1: Type Definitions

Create `src/types/extraction.ts`:

```typescript
/**
 * OCR Extraction type definitions
 */

export interface ExtractionRequest {
  documentId: string
  documentUrl: string
  callbackUrl?: string
}

export interface InvoiceField {
  value: string | null
  confidence: number | null
  boundingRegions?: Array<{
    page: number
    polygon: number[]
  }>
}

export interface InvoiceData {
  vendorName?: InvoiceField
  vendorAddress?: InvoiceField
  customerName?: InvoiceField
  customerAddress?: InvoiceField
  invoiceId?: InvoiceField
  invoiceDate?: InvoiceField
  dueDate?: InvoiceField
  poNumber?: InvoiceField
  billingAddress?: InvoiceField
  shippingAddress?: InvoiceField
  subTotal?: InvoiceField
  totalTax?: InvoiceField
  invoiceTotal?: InvoiceField
  amountDue?: InvoiceField
  currencyCode?: InvoiceField
  items?: Array<{
    description: string | null
    quantity: number | null
    unitPrice: number | null
    amount: number | null
  }>
}

export interface ExtractionResult {
  documentId: string
  status: 'COMPLETED' | 'FAILED'
  extractedText: string
  invoiceData?: InvoiceData
  rawResult: Record<string, unknown>
  processingTimeMs: number
  pageCount: number
  averageConfidence: number
}

export interface ExtractionError {
  documentId: string
  status: 'FAILED'
  errorCode: string
  errorMessage: string
  retryCount: number
  retryable: boolean
}

export type ExtractionResponse = ExtractionResult | ExtractionError

export function isExtractionError(
  response: ExtractionResponse
): response is ExtractionError {
  return response.status === 'FAILED' && 'errorCode' in response
}
```

#### Step 3.2: Extraction Service Layer

Create `src/services/extraction.service.ts`:

```typescript
/**
 * Extraction Service
 * Orchestrates OCR processing via Python microservice
 */

import { prisma } from '@/lib/prisma'
import { DocumentStatus } from '@prisma/client'
import type {
  ExtractionRequest,
  ExtractionResult,
  ExtractionError,
  ExtractionResponse,
  isExtractionError
} from '@/types/extraction'

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

/**
 * Trigger OCR extraction for a document
 */
export async function triggerExtraction(
  documentId: string
): Promise<ExtractionResponse> {
  // Get document details
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      filePath: true,
      status: true
    }
  })

  if (!document) {
    throw new Error(`Document not found: ${documentId}`)
  }

  if (document.status !== DocumentStatus.UPLOADED) {
    throw new Error(
      `Invalid document status for OCR: ${document.status}. Expected: UPLOADED`
    )
  }

  // Update status to processing
  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.OCR_PROCESSING }
  })

  try {
    // Call Python OCR service
    const response = await callOcrService({
      documentId: document.id,
      documentUrl: document.filePath
    })

    if (isExtractionError(response)) {
      // Handle failure
      await handleExtractionFailure(documentId, response)
      return response
    }

    // Handle success
    await handleExtractionSuccess(documentId, response)
    return response

  } catch (error) {
    // Handle unexpected errors
    const errorResponse: ExtractionError = {
      documentId,
      status: 'FAILED',
      errorCode: 'UNEXPECTED_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      retryCount: 0,
      retryable: true
    }

    await handleExtractionFailure(documentId, errorResponse)
    return errorResponse
  }
}

/**
 * Call Python OCR service with retry logic
 */
async function callOcrService(
  request: ExtractionRequest,
  retryCount: number = 0
): Promise<ExtractionResponse> {
  const endpoint = retryCount > 0
    ? `${PYTHON_SERVICE_URL}/extract/retry?retry_count=${retryCount}`
    : `${PYTHON_SERVICE_URL}/extract`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document_id: request.documentId,
        document_url: request.documentUrl,
        callback_url: request.callbackUrl
      }),
      signal: AbortSignal.timeout(35000) // 35s timeout (5s buffer over 30s processing)
    })

    const data = await response.json()

    if (!response.ok) {
      // Check if retryable and retry if possible
      if (data.retryable && retryCount < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (retryCount + 1))
        return callOcrService(request, retryCount + 1)
      }
      return data as ExtractionError
    }

    return transformResponse(data)

  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * (retryCount + 1))
      return callOcrService(request, retryCount + 1)
    }

    throw error
  }
}

/**
 * Handle successful extraction
 */
async function handleExtractionSuccess(
  documentId: string,
  result: ExtractionResult
): Promise<void> {
  await prisma.$transaction([
    // Create OCR result record
    prisma.ocrResult.upsert({
      where: { documentId },
      create: {
        documentId,
        rawResult: result.rawResult,
        extractedText: result.extractedText,
        invoiceData: result.invoiceData || undefined,
        processingTime: result.processingTimeMs,
        pageCount: result.pageCount,
        confidence: result.averageConfidence
      },
      update: {
        rawResult: result.rawResult,
        extractedText: result.extractedText,
        invoiceData: result.invoiceData || undefined,
        processingTime: result.processingTimeMs,
        pageCount: result.pageCount,
        confidence: result.averageConfidence,
        errorCode: null,
        errorMessage: null
      }
    }),
    // Update document status
    prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.OCR_COMPLETED,
        errorMessage: null
      }
    })
  ])
}

/**
 * Handle extraction failure
 */
async function handleExtractionFailure(
  documentId: string,
  error: ExtractionError
): Promise<void> {
  await prisma.$transaction([
    // Update or create OCR result with error
    prisma.ocrResult.upsert({
      where: { documentId },
      create: {
        documentId,
        rawResult: {},
        extractedText: '',
        errorCode: error.errorCode,
        errorMessage: error.errorMessage,
        retryCount: error.retryCount
      },
      update: {
        errorCode: error.errorCode,
        errorMessage: error.errorMessage,
        retryCount: error.retryCount
      }
    }),
    // Update document status
    prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.OCR_FAILED,
        errorMessage: error.errorMessage
      }
    })
  ])
}

/**
 * Get OCR result for a document
 */
export async function getExtractionResult(documentId: string) {
  return prisma.ocrResult.findUnique({
    where: { documentId },
    include: {
      document: {
        select: {
          id: true,
          fileName: true,
          status: true
        }
      }
    }
  })
}

/**
 * Retry a failed extraction
 */
export async function retryExtraction(
  documentId: string
): Promise<ExtractionResponse> {
  // Verify document is in failed state
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { status: true }
  })

  if (document?.status !== DocumentStatus.OCR_FAILED) {
    throw new Error('Can only retry failed extractions')
  }

  // Reset status and trigger
  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.UPLOADED }
  })

  return triggerExtraction(documentId)
}

/**
 * Transform Python service response to TypeScript types
 */
function transformResponse(data: Record<string, unknown>): ExtractionResult {
  return {
    documentId: data.document_id as string,
    status: 'COMPLETED',
    extractedText: data.extracted_text as string,
    invoiceData: data.invoice_data as ExtractionResult['invoiceData'],
    rawResult: data.raw_result as Record<string, unknown>,
    processingTimeMs: data.processing_time_ms as number,
    pageCount: data.page_count as number,
    averageConfidence: data.average_confidence as number
  }
}

/**
 * Helper to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

#### Step 3.3: Extraction API Endpoint

Create `src/app/api/extraction/route.ts`:

```typescript
/**
 * POST /api/extraction
 * Trigger OCR extraction for a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { triggerExtraction } from '@/services/extraction.service'
import { z } from 'zod'

const extractionRequestSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format')
})

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = extractionRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { documentId } = validation.data

    // Trigger extraction
    const result = await triggerExtraction(documentId)

    // Check if extraction failed
    if (result.status === 'FAILED') {
      return NextResponse.json(
        {
          success: false,
          error: result
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Extraction API error:', error)

    if (error instanceof Error) {
      // Handle known errors
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }
      if (error.message.includes('Invalid document status')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Step 3.4: Extraction Status API

Create `src/app/api/extraction/status/[documentId]/route.ts`:

```typescript
/**
 * GET /api/extraction/status/[documentId]
 * Get OCR extraction status and result for a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getExtractionResult } from '@/services/extraction.service'

interface RouteParams {
  params: Promise<{
    documentId: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { documentId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      )
    }

    // Get extraction result
    const result = await getExtractionResult(documentId)

    if (!result) {
      return NextResponse.json(
        { error: 'Extraction result not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        documentId: result.documentId,
        status: result.document.status,
        extractedText: result.extractedText,
        invoiceData: result.invoiceData,
        processingTime: result.processingTime,
        pageCount: result.pageCount,
        confidence: result.confidence,
        error: result.errorMessage ? {
          code: result.errorCode,
          message: result.errorMessage,
          retryCount: result.retryCount
        } : null,
        createdAt: result.createdAt
      }
    })

  } catch (error) {
    console.error('Extraction status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Step 3.5: Retry Extraction API

Create `src/app/api/extraction/retry/route.ts`:

```typescript
/**
 * POST /api/extraction/retry
 * Retry a failed OCR extraction
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { retryExtraction } from '@/services/extraction.service'
import { z } from 'zod'

const retryRequestSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format')
})

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = retryRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { documentId } = validation.data

    // Retry extraction
    const result = await retryExtraction(documentId)

    if (result.status === 'FAILED') {
      return NextResponse.json(
        {
          success: false,
          error: result
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Retry extraction API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('only retry failed')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

### Phase 4: Auto-Trigger After Upload (15 min)

#### Step 4.1: Update Upload API to Auto-Trigger OCR

Update `src/app/api/upload/route.ts` to add OCR trigger:

```typescript
// Add at the end of successful upload handling
// After document records are created

import { triggerExtraction } from '@/services/extraction.service'

// ... existing upload code ...

// After successful upload, trigger OCR for each document
// Use Promise.allSettled to not fail if OCR trigger fails
const ocrPromises = createdDocuments.map(doc =>
  triggerExtraction(doc.id).catch(error => {
    console.error(`Failed to trigger OCR for ${doc.id}:`, error)
    return null
  })
)

// Don't wait for OCR completion - return upload success immediately
Promise.allSettled(ocrPromises).then(results => {
  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length > 0) {
    console.warn(`${failed.length} OCR triggers failed`)
  }
})

return NextResponse.json({
  success: true,
  data: {
    documents: createdDocuments,
    message: `${createdDocuments.length} files uploaded successfully. OCR processing started.`
  }
})
```

---

### Phase 5: Environment Configuration (5 min)

#### Step 5.1: Update Environment Variables

Add to `.env.example`:

```bash
# ===========================================
# Azure Document Intelligence
# ===========================================
AZURE_DI_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_DI_KEY="your-document-intelligence-key"

# ===========================================
# Python Services
# ===========================================
PYTHON_SERVICE_URL="http://localhost:8001"
```

Add to `.env.local`:

```bash
# Azure Document Intelligence (get from Azure Portal)
AZURE_DI_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_DI_KEY="your-actual-key"

# Python Extraction Service
PYTHON_SERVICE_URL="http://localhost:8001"
```

---

## Testing Guide

### Unit Tests

Create `src/services/__tests__/extraction.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { triggerExtraction, getExtractionResult } from '../extraction.service'
import { prisma } from '@/lib/prisma'
import { DocumentStatus } from '@prisma/client'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    ocrResult: {
      upsert: vi.fn(),
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

// Mock fetch
global.fetch = vi.fn()

describe('Extraction Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('triggerExtraction', () => {
    it('should reject non-uploaded documents', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'test-id',
        status: DocumentStatus.OCR_PROCESSING,
        filePath: 'https://blob.storage/test.pdf'
      } as any)

      await expect(triggerExtraction('test-id')).rejects.toThrow(
        'Invalid document status'
      )
    })

    it('should update status to OCR_PROCESSING', async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: 'test-id',
        status: DocumentStatus.UPLOADED,
        filePath: 'https://blob.storage/test.pdf'
      } as any)

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          document_id: 'test-id',
          status: 'COMPLETED',
          extracted_text: 'Test text',
          raw_result: {},
          processing_time_ms: 1000,
          page_count: 1,
          average_confidence: 0.95
        })
      } as Response)

      await triggerExtraction('test-id')

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: { status: DocumentStatus.OCR_PROCESSING }
      })
    })
  })
})
```

### Python Service Tests

Create `python-services/extraction/tests/test_processor.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from processor import OcrProcessor
from models import ExtractionRequest, ExtractionStatus

@pytest.fixture
def processor():
    return OcrProcessor()

@pytest.fixture
def sample_request():
    return ExtractionRequest(
        document_id="test-123",
        document_url="https://blob.storage/test.pdf"
    )

@pytest.mark.asyncio
async def test_successful_processing(processor, sample_request):
    """Test successful OCR processing"""
    mock_result = {
        "extracted_text": "Invoice #123",
        "invoice_data": None,
        "raw_result": {},
        "processing_time_ms": 1500,
        "page_count": 1,
        "average_confidence": 0.95
    }

    with patch.object(
        processor.client,
        'analyze_document',
        new_callable=AsyncMock,
        return_value=mock_result
    ):
        result = await processor.process(sample_request)

        assert result.status == ExtractionStatus.COMPLETED
        assert result.extracted_text == "Invoice #123"
        assert result.processing_time_ms == 1500

@pytest.mark.asyncio
async def test_timeout_handling(processor, sample_request):
    """Test timeout error handling"""
    with patch.object(
        processor.client,
        'analyze_document',
        new_callable=AsyncMock,
        side_effect=TimeoutError("Processing exceeded 30s")
    ):
        result = await processor.process(sample_request)

        assert result.status == ExtractionStatus.FAILED
        assert result.error_code == "OCR_TIMEOUT"
        assert result.retryable == True
```

### Integration Tests

```bash
# Start Python service
cd python-services
docker-compose up -d extraction-service

# Test health endpoint
curl http://localhost:8001/health

# Test extraction (requires valid Azure credentials)
curl -X POST http://localhost:8001/extract \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-123",
    "document_url": "https://your-storage.blob.core.windows.net/documents/test-invoice.pdf"
  }'
```

---

## Verification Checklist

| Item | Expected Result | Status |
|------|-----------------|--------|
| Prisma migration runs successfully | OcrResult table created | [ ] |
| Python service starts | Health check returns 200 | [ ] |
| Azure DI connection works | Health check shows connected | [ ] |
| PDF OCR extraction | Returns extracted text | [ ] |
| JPG/PNG OCR extraction | Returns extracted text | [ ] |
| Processing time < 30s | Single page invoice | [ ] |
| OcrResult created | Database record exists | [ ] |
| Document status updated | OCR_COMPLETED or OCR_FAILED | [ ] |
| Error handling works | Proper error codes returned | [ ] |
| Retry mechanism works | Retries on retryable errors | [ ] |
| Auto-trigger after upload | OCR starts automatically | [ ] |

---

## Error Codes Reference

| Code | Description | Retryable |
|------|-------------|-----------|
| `OCR_TIMEOUT` | Processing exceeded 30s | Yes |
| `CONNECTION_ERROR` | Cannot connect to Azure | Yes |
| `AZURE_API_ERROR` | Azure DI API error | Depends |
| `InternalServerError` | Azure internal error | Yes |
| `ServiceUnavailable` | Azure service down | Yes |
| `TooManyRequests` | Rate limited | Yes |
| `InvalidRequest` | Bad request to Azure | No |
| `UNEXPECTED_ERROR` | Unknown error | No |

---

## Security Considerations

1. **API Key Storage**: Azure DI keys stored in environment variables, never in code
2. **Network Security**: Python service should be in private network in production
3. **Input Validation**: All document URLs validated before processing
4. **Rate Limiting**: Implement rate limiting on extraction endpoints
5. **Logging**: Sensitive data (URLs, keys) not logged in full

---

## Performance Optimization

1. **Connection Pooling**: Azure DI client reused via singleton pattern
2. **Async Processing**: Non-blocking OCR calls with proper timeouts
3. **Batch Processing**: Consider batch endpoint for multiple documents
4. **Caching**: Cache Azure DI client initialization
5. **Monitoring**: Track processing times for optimization

---

## Related Documentation

- [Story 2.2 User Story](./stories/2-2-file-ocr-extraction-service.md)
- [Story 2.1 Tech Spec](./tech-spec-story-2-1.md) (Prerequisite)
- [Azure Document Intelligence Docs](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
