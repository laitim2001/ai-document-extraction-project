"""
@fileoverview Forwarder Mapping FastAPI 服務
@description
  提供 Forwarder 識別的 RESTful API：
  - POST /identify - 從 OCR 文本識別 Forwarder
  - GET /forwarders - 獲取所有 Forwarder 列表
  - GET /health - 健康檢查

  信心度路由規則：
  - >= 80%: 自動識別（AUTO_IDENTIFY）
  - 50-79%: 需要審核（NEEDS_REVIEW）
  - < 50%: 無法識別（UNIDENTIFIED）

@module python-services/mapping/src/main
@since Epic 2 - Story 2.3 (Forwarder Auto-Identification)
@lastModified 2025-12-18

@features
  - FastAPI 異步 HTTP 服務
  - 基於模式的 Forwarder 識別
  - 可配置的識別模式
  - 結構化日誌 (structlog)
  - 健康檢查端點
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

from identifier import ForwarderMatcher, IdentificationResult
from identifier.matcher import ForwarderPattern


# ============================================================
# Configuration
# ============================================================

class Settings(BaseSettings):
    """應用程式設定"""

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8001, alias="PORT")
    debug: bool = Field(default=False, alias="DEBUG")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:3000",
        alias="CORS_ORIGINS",
        description="允許的 CORS 來源（逗號分隔）",
    )

    # Database (for loading forwarder patterns)
    database_url: str = Field(
        default="",
        alias="DATABASE_URL",
        description="PostgreSQL 連接字串",
    )

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

class IdentifyRequest(BaseModel):
    """識別請求"""
    text: str = Field(..., description="OCR 提取的文本內容", min_length=1)
    documentId: Optional[str] = Field(None, description="文件 ID（用於追蹤）")


class IdentifyResponse(BaseModel):
    """識別響應"""
    success: bool
    documentId: Optional[str] = None
    forwarderId: Optional[str] = None
    forwarderCode: Optional[str] = None
    forwarderName: Optional[str] = None
    confidence: float
    matchMethod: str
    matchedPatterns: list[str]
    matchDetails: list[dict]
    isIdentified: bool
    needsReview: bool
    status: str  # "IDENTIFIED", "NEEDS_REVIEW", "UNIDENTIFIED"


class ForwarderInfo(BaseModel):
    """Forwarder 資訊"""
    id: str
    code: str
    name: str
    displayName: str
    priority: int


class ForwardersResponse(BaseModel):
    """Forwarder 列表響應"""
    success: bool
    forwarders: list[ForwarderInfo]
    total: int


class HealthResponse(BaseModel):
    """健康檢查響應"""
    status: str
    service: str
    version: str
    forwarderCount: int


# ============================================================
# Default Forwarder Patterns (Fallback)
# ============================================================

# 當無法從資料庫載入時使用的預設模式
DEFAULT_FORWARDER_PATTERNS: list[ForwarderPattern] = [
    ForwarderPattern(
        forwarder_id="default-dhl",
        code="DHL",
        name="DHL Express",
        display_name="DHL Express",
        names=["DHL", "DHL Express", "DHL Global", "DHL International"],
        keywords=["waybill", "awb number", "dhl tracking", "express worldwide"],
        formats=[r"\d{10}", r"[A-Z]{3}\d{7}"],
        logo_text=["dhl", "simply delivered"],
        priority=100,
    ),
    ForwarderPattern(
        forwarder_id="default-fedex",
        code="FDX",
        name="FedEx",
        display_name="FedEx",
        names=["FedEx", "Federal Express", "FedEx Express", "FedEx Ground"],
        keywords=["fedex tracking", "door tag", "express saver", "international priority"],
        formats=[r"\d{12}", r"\d{15}", r"\d{20,22}"],
        logo_text=["fedex", "federal express"],
        priority=100,
    ),
    ForwarderPattern(
        forwarder_id="default-ups",
        code="UPS",
        name="UPS",
        display_name="UPS (United Parcel Service)",
        names=["UPS", "United Parcel Service", "UPS Express", "UPS Ground"],
        keywords=["ups tracking", "worldship", "ground shipping"],
        formats=[r"1Z[A-Z0-9]{16}", r"\d{9}", r"\d{18}"],
        logo_text=["ups", "united parcel service"],
        priority=100,
    ),
    ForwarderPattern(
        forwarder_id="default-maersk",
        code="MAERSK",
        name="Maersk",
        display_name="Maersk Line",
        names=["Maersk", "Maersk Line", "A.P. Moller-Maersk"],
        keywords=["bill of lading", "container number", "booking number", "vessel name"],
        formats=[r"MSKU\d{7}", r"MRKU\d{7}"],
        logo_text=["maersk", "constant care"],
        priority=90,
    ),
    ForwarderPattern(
        forwarder_id="default-msc",
        code="MSC",
        name="MSC",
        display_name="Mediterranean Shipping Company",
        names=["MSC", "Mediterranean Shipping Company"],
        keywords=["msc tracking", "bill of lading", "container tracking"],
        formats=[r"MSCU\d{7}", r"MEDU\d{7}"],
        logo_text=["msc", "mediterranean shipping"],
        priority=90,
    ),
    ForwarderPattern(
        forwarder_id="default-sf",
        code="SF",
        name="SF Express",
        display_name="SF Express",
        names=["SF Express", "S.F. Express"],
        keywords=["sf tracking", "express delivery", "waybill number"],
        formats=[r"SF\d{12}"],
        logo_text=["sf express", "sf"],
        priority=80,
    ),
]


# ============================================================
# Application
# ============================================================

# 全域匹配器實例
matcher: Optional[ForwarderMatcher] = None
forwarder_list: list[ForwarderInfo] = []


def load_patterns_from_db() -> list[ForwarderPattern]:
    """
    從資料庫載入 Forwarder 模式

    Returns:
        Forwarder 模式列表
    """
    if not settings.database_url:
        logger.warning("database_url_not_configured", using="default_patterns")
        return DEFAULT_FORWARDER_PATTERNS

    try:
        import psycopg2
        import json

        conn = psycopg2.connect(settings.database_url)
        cur = conn.cursor()

        cur.execute("""
            SELECT id, code, name, display_name, identification_patterns, priority
            FROM forwarders
            WHERE is_active = true
            ORDER BY priority DESC
        """)

        patterns: list[ForwarderPattern] = []
        for row in cur.fetchall():
            forwarder_id, code, name, display_name, patterns_json, priority = row

            # 解析 JSON 模式
            if isinstance(patterns_json, str):
                patterns_data = json.loads(patterns_json)
            else:
                patterns_data = patterns_json

            patterns.append(ForwarderPattern(
                forwarder_id=forwarder_id,
                code=code,
                name=name,
                display_name=display_name,
                names=patterns_data.get("names", []),
                keywords=patterns_data.get("keywords", []),
                formats=patterns_data.get("formats", []),
                logo_text=patterns_data.get("logoText", []),
                priority=priority or 0,
            ))

        cur.close()
        conn.close()

        logger.info("patterns_loaded_from_db", count=len(patterns))
        return patterns

    except Exception as e:
        logger.error("failed_to_load_patterns_from_db", error=str(e))
        return DEFAULT_FORWARDER_PATTERNS


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    global matcher, forwarder_list

    logger.info("application_startup")

    # 載入 Forwarder 模式
    patterns = load_patterns_from_db()
    matcher = ForwarderMatcher(patterns)

    # 建立 Forwarder 列表
    forwarder_list = [
        ForwarderInfo(
            id=p.forwarder_id,
            code=p.code,
            name=p.name,
            displayName=p.display_name,
            priority=p.priority,
        )
        for p in patterns
        if p.code != "UNKNOWN"
    ]

    logger.info("matcher_ready", forwarder_count=len(forwarder_list))

    yield

    logger.info("application_shutdown")


app = FastAPI(
    title="Forwarder Mapping Service",
    description="Forwarder 自動識別服務",
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
        service="forwarder-mapping",
        version="1.0.0",
        forwarderCount=len(forwarder_list),
    )


@app.get("/forwarders", response_model=ForwardersResponse)
async def get_forwarders() -> ForwardersResponse:
    """獲取所有 Forwarder 列表"""
    return ForwardersResponse(
        success=True,
        forwarders=forwarder_list,
        total=len(forwarder_list),
    )


@app.post("/identify", response_model=IdentifyResponse)
async def identify_forwarder(request: IdentifyRequest) -> IdentifyResponse:
    """
    從 OCR 文本識別 Forwarder

    Args:
        request: 包含 OCR 文本的請求

    Returns:
        識別結果，包含信心度和匹配詳情
    """
    if matcher is None:
        raise HTTPException(
            status_code=503,
            detail="Matcher not initialized",
        )

    logger.info(
        "identify_request",
        document_id=request.documentId,
        text_length=len(request.text),
    )

    # 執行識別
    result = matcher.identify(request.text)

    # 決定狀態
    if result.is_identified:
        status = "IDENTIFIED"
        needs_review = False
    elif result.confidence >= ForwarderMatcher.THRESHOLD_NEEDS_REVIEW:
        status = "NEEDS_REVIEW"
        needs_review = True
    else:
        status = "UNIDENTIFIED"
        needs_review = False

    logger.info(
        "identify_completed",
        document_id=request.documentId,
        forwarder_code=result.forwarder_code,
        confidence=result.confidence,
        status=status,
    )

    return IdentifyResponse(
        success=True,
        documentId=request.documentId,
        forwarderId=result.forwarder_id,
        forwarderCode=result.forwarder_code,
        forwarderName=result.forwarder_name,
        confidence=result.confidence,
        matchMethod=result.match_method,
        matchedPatterns=result.matched_patterns,
        matchDetails=result.match_details,
        isIdentified=result.is_identified,
        needsReview=needs_review,
        status=status,
    )


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
