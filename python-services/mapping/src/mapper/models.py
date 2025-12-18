"""
@fileoverview Field Mapping Pydantic 模型定義
@description
  定義欄位映射相關的資料模型：
  - 提取方法類型（regex, keyword, position, azure_field）
  - 映射規則模型
  - 提取結果模型
  - API 請求/響應模型

@module python-services/mapping/src/mapper/models
@since Epic 2 - Story 2.4 (Field Mapping & Extraction)
@lastModified 2025-12-18
"""

from enum import Enum
from typing import Optional, Union
from pydantic import BaseModel, Field


# ============================================================
# Enums
# ============================================================

class ExtractionMethod(str, Enum):
    """提取方法類型"""
    REGEX = "regex"
    KEYWORD = "keyword"
    POSITION = "position"
    AZURE_FIELD = "azure_field"
    LLM = "llm"


class ConfidenceSource(str, Enum):
    """信心度來源（三層架構）"""
    TIER1 = "tier1"      # 通用映射規則
    TIER2 = "tier2"      # Forwarder 特定規則
    TIER3 = "tier3"      # LLM 智能分類
    AZURE = "azure"      # Azure Document Intelligence


# ============================================================
# Extraction Pattern Models
# ============================================================

class RegexExtractionPattern(BaseModel):
    """正則表達式提取模式"""
    method: str = "regex"
    pattern: str
    flags: Optional[str] = None
    group_index: Optional[int] = Field(None, alias="groupIndex")
    confidence_boost: Optional[float] = Field(None, alias="confidenceBoost")

    class Config:
        populate_by_name = True


class KeywordExtractionPattern(BaseModel):
    """關鍵字提取模式"""
    method: str = "keyword"
    keywords: list[str]
    proximity_words: Optional[list[str]] = Field(None, alias="proximityWords")
    max_distance: Optional[int] = Field(None, alias="maxDistance")
    confidence_boost: Optional[float] = Field(None, alias="confidenceBoost")

    class Config:
        populate_by_name = True


class PositionRegion(BaseModel):
    """位置區域"""
    top: float
    left: float
    width: float
    height: float


class PositionExtractionPattern(BaseModel):
    """位置提取模式"""
    method: str = "position"
    page: Optional[int] = None
    region: PositionRegion
    confidence_boost: Optional[float] = Field(None, alias="confidenceBoost")

    class Config:
        populate_by_name = True


class AzureFieldExtractionPattern(BaseModel):
    """Azure 欄位提取模式"""
    method: str = "azure_field"
    azure_field_name: str = Field(..., alias="azureFieldName")
    fallback_pattern: Optional[str] = Field(None, alias="fallbackPattern")
    confidence_boost: Optional[float] = Field(None, alias="confidenceBoost")

    class Config:
        populate_by_name = True


# 聯合類型
ExtractionPattern = Union[
    RegexExtractionPattern,
    KeywordExtractionPattern,
    PositionExtractionPattern,
    AzureFieldExtractionPattern,
]


# ============================================================
# Mapping Rule Model
# ============================================================

class MappingRule(BaseModel):
    """映射規則"""
    id: str
    field_name: str = Field(..., alias="fieldName")
    field_label: str = Field(..., alias="fieldLabel")
    extraction_pattern: dict = Field(..., alias="extractionPattern")
    priority: int = 0
    is_required: bool = Field(False, alias="isRequired")
    validation_pattern: Optional[str] = Field(None, alias="validationPattern")
    default_value: Optional[str] = Field(None, alias="defaultValue")
    category: Optional[str] = None

    class Config:
        populate_by_name = True


# ============================================================
# Field Mapping Result Models
# ============================================================

class BoundingBox(BaseModel):
    """邊界框"""
    x: float
    y: float
    width: float
    height: float


class FieldPosition(BaseModel):
    """欄位位置"""
    page: int
    bounding_box: Optional[BoundingBox] = Field(None, alias="boundingBox")

    class Config:
        populate_by_name = True


class FieldMappingResult(BaseModel):
    """單一欄位映射結果"""
    value: Optional[str] = None
    raw_value: Optional[str] = Field(None, alias="rawValue")
    confidence: float
    source: str
    rule_id: Optional[str] = Field(None, alias="ruleId")
    extraction_method: str = Field(..., alias="extractionMethod")
    position: Optional[FieldPosition] = None
    is_validated: Optional[bool] = Field(None, alias="isValidated")
    validation_error: Optional[str] = Field(None, alias="validationError")

    class Config:
        populate_by_name = True


class UnmappedFieldDetail(BaseModel):
    """未映射欄位詳情"""
    reason: str
    attempts: list[str]


class ExtractionStatistics(BaseModel):
    """提取統計"""
    total_fields: int = Field(..., alias="totalFields")
    mapped_fields: int = Field(..., alias="mappedFields")
    unmapped_fields: int = Field(..., alias="unmappedFields")
    average_confidence: float = Field(..., alias="averageConfidence")
    processing_time_ms: int = Field(..., alias="processingTimeMs")
    rules_applied: int = Field(..., alias="rulesApplied")

    class Config:
        populate_by_name = True


# ============================================================
# API Request/Response Models
# ============================================================

class MapFieldsRequest(BaseModel):
    """欄位映射請求"""
    document_id: str = Field(..., alias="documentId")
    forwarder_id: Optional[str] = Field(None, alias="forwarderId")
    ocr_text: str = Field(..., alias="ocrText")
    azure_invoice_data: Optional[dict] = Field(None, alias="azureInvoiceData")
    mapping_rules: list[MappingRule] = Field(..., alias="mappingRules")

    class Config:
        populate_by_name = True


class MapFieldsResponse(BaseModel):
    """欄位映射響應"""
    success: bool
    document_id: str = Field(..., alias="documentId")
    forwarder_id: Optional[str] = Field(None, alias="forwarderId")
    field_mappings: dict[str, FieldMappingResult] = Field(..., alias="fieldMappings")
    statistics: ExtractionStatistics
    unmapped_field_details: Optional[dict[str, UnmappedFieldDetail]] = Field(
        None, alias="unmappedFieldDetails"
    )
    error_message: Optional[str] = Field(None, alias="errorMessage")

    class Config:
        populate_by_name = True
