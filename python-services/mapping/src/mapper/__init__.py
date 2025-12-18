"""
@fileoverview Field Mapper 模組導出
@description
  欄位映射模組，提供：
  - FieldMapper: 核心欄位映射類
  - 相關資料模型

@module python-services/mapping/src/mapper
@since Epic 2 - Story 2.4 (Field Mapping & Extraction)
@lastModified 2025-12-18
"""

from .models import (
    ExtractionMethod,
    ConfidenceSource,
    ExtractionPattern,
    RegexExtractionPattern,
    KeywordExtractionPattern,
    PositionExtractionPattern,
    AzureFieldExtractionPattern,
    MappingRule,
    FieldMappingResult,
    ExtractionStatistics,
    UnmappedFieldDetail,
    MapFieldsRequest,
    MapFieldsResponse,
)
from .field_mapper import FieldMapper

__all__ = [
    # Classes
    "FieldMapper",
    # Enums
    "ExtractionMethod",
    "ConfidenceSource",
    # Pattern Types
    "ExtractionPattern",
    "RegexExtractionPattern",
    "KeywordExtractionPattern",
    "PositionExtractionPattern",
    "AzureFieldExtractionPattern",
    # Models
    "MappingRule",
    "FieldMappingResult",
    "ExtractionStatistics",
    "UnmappedFieldDetail",
    "MapFieldsRequest",
    "MapFieldsResponse",
]
