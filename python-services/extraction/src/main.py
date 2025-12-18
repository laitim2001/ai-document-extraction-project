"""
@fileoverview OCR Extraction FastAPI 服務
@description
  提供 OCR 文件提取的 RESTful API：
  - POST /extract/url - 從 URL 提取
  - POST /extract/file - 從上傳文件提取
  - GET /health - 健康檢查

@module python-services/extraction/src/main
@since Epic 2 - Story 2.2 (File OCR Extraction Service)
@lastModified 2025-12-18

@features
  - FastAPI 異步 HTTP 服務
  - Azure Document Intelligence 整合
  - 結構化日誌 (structlog)
  - 健康檢查端點
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, HttpUrl
from pydantic_settings import BaseSettings

from ocr import AzureDocumentIntelligenceClient, DocumentProcessor


# ============================================================
# Configuration
# ============================================================

class Settings(BaseSettings):
    """應用程式設定"""

    # Azure Document Intelligence
    azure_di_endpoint: str = Field(
        default="",
        alias="AZURE_DI_ENDPOINT",
        description="Azure Document Intelligence 端點",
    )
    azure_di_key: str = Field(
        default="",
        alias="AZURE_DI_KEY",
        description="Azure Document Intelligence API 金鑰",
    )

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    debug: bool = Field(default=False, alias="DEBUG")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:3000",
        alias="CORS_ORIGINS",
        description="允許的 CORS 來源（逗號分隔）",
    )

    # Processing
    max_retries: int = Field(default=3, alias="MAX_RETRIES")
    retry_delay: float = Field(default=1.0, alias="RETRY_DELAY")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()


# ============================================================
# Logging
# ============================================================

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
        structlog.processors.JSONRenderer() if not settings.debug else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


# ============================================================
# Models
# ============================================================

class ExtractUrlRequest(BaseModel):
    """URL 提取請求"""
    documentUrl: HttpUrl = Field(..., description="文件 URL（需要 SAS token）")
    documentId: Optional[str] = Field(None, description="文件 ID（用於追蹤）")


class ExtractResponse(BaseModel):
    """提取響應"""
    success: bool
    errorCode: str
    errorMessage: Optional[str] = None
    retryCount: int = 0
    rawResult: Optional[dict] = None
    extractedText: str = ""
    invoiceData: Optional[dict] = None
    processingTime: Optional[int] = None
    pageCount: Optional[int] = None
    confidence: Optional[float] = None


class HealthResponse(BaseModel):
    """健康檢查響應"""
    status: str
    service: str
    version: str
    azureConfigured: bool


# ============================================================
# Application
# ============================================================

# 全域處理器實例
processor: Optional[DocumentProcessor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    global processor

    logger.info("application_startup")

    # 初始化 Azure 客戶端和處理器
    if settings.azure_di_endpoint and settings.azure_di_key:
        azure_client = AzureDocumentIntelligenceClient(
            endpoint=settings.azure_di_endpoint,
            api_key=settings.azure_di_key,
        )
        processor = DocumentProcessor(
            azure_client=azure_client,
            max_retries=settings.max_retries,
            retry_delay=settings.retry_delay,
        )
        logger.info("azure_client_initialized")
    else:
        logger.warning("azure_credentials_not_configured")

    yield

    logger.info("application_shutdown")


app = FastAPI(
    title="OCR Extraction Service",
    description="Azure Document Intelligence OCR 提取服務",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Routes
# ============================================================

@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """健康檢查端點"""
    return HealthResponse(
        status="healthy",
        service="ocr-extraction",
        version="1.0.0",
        azureConfigured=bool(settings.azure_di_endpoint and settings.azure_di_key),
    )


@app.post("/extract/url", response_model=ExtractResponse)
async def extract_from_url(request: ExtractUrlRequest) -> ExtractResponse:
    """
    從 URL 提取文件內容

    Args:
        request: 包含文件 URL 的請求

    Returns:
        OCR 提取結果
    """
    if processor is None:
        raise HTTPException(
            status_code=503,
            detail="Azure Document Intelligence not configured",
        )

    logger.info(
        "extract_url_request",
        document_id=request.documentId,
        url=str(request.documentUrl)[:100],
    )

    result = await processor.process_from_url(
        document_url=str(request.documentUrl),
        document_id=request.documentId,
    )

    return ExtractResponse(**result)


@app.post("/extract/file", response_model=ExtractResponse)
async def extract_from_file(
    file: UploadFile = File(..., description="要處理的文件"),
    documentId: Optional[str] = Form(None, description="文件 ID"),
) -> ExtractResponse:
    """
    從上傳文件提取內容

    Args:
        file: 上傳的文件
        documentId: 文件 ID（可選）

    Returns:
        OCR 提取結果
    """
    if processor is None:
        raise HTTPException(
            status_code=503,
            detail="Azure Document Intelligence not configured",
        )

    # 驗證文件類型
    content_type = file.content_type or "application/octet-stream"
    if content_type not in DocumentProcessor.SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}",
        )

    # 讀取文件內容
    document_bytes = await file.read()

    logger.info(
        "extract_file_request",
        document_id=documentId,
        filename=file.filename,
        content_type=content_type,
        size=len(document_bytes),
    )

    result = await processor.process_from_bytes(
        document_bytes=document_bytes,
        content_type=content_type,
        document_id=documentId,
    )

    return ExtractResponse(**result)


# ============================================================
# Entry Point
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
