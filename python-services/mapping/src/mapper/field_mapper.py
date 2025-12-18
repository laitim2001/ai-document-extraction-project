"""
@fileoverview 欄位映射核心邏輯
@description
  實現三層映射架構的欄位提取邏輯：
  - Tier 1: 通用映射規則（Universal Rules）
  - Tier 2: Forwarder 特定規則
  - Tier 3: LLM 智能分類（待實現）

  提取方法：
  - regex: 正則表達式匹配
  - keyword: 關鍵字鄰近匹配
  - position: 位置區域提取
  - azure_field: Azure DI 欄位直接映射

@module python-services/mapping/src/mapper/field_mapper
@since Epic 2 - Story 2.4 (Field Mapping & Extraction)
@lastModified 2025-12-18

@features
  - 多種提取方法支援
  - 信心度計算
  - 欄位驗證
  - 值正規化（日期、金額等）
"""

import re
import time
from datetime import datetime
from typing import Optional
import structlog

from .models import (
    ConfidenceSource,
    ExtractionMethod,
    MappingRule,
    FieldMappingResult,
    FieldPosition,
    BoundingBox,
    ExtractionStatistics,
    UnmappedFieldDetail,
)

logger = structlog.get_logger(__name__)


class FieldMapper:
    """
    欄位映射器

    實現三層映射架構，從 OCR 文本和 Azure 發票數據中提取欄位值。
    """

    # 信心度常數
    BASE_CONFIDENCE = {
        "azure_field": 90,   # Azure DI 直接提取，基礎信心度高
        "regex": 85,         # 正則匹配，相對可靠
        "keyword": 75,       # 關鍵字匹配，中等可靠
        "position": 70,      # 位置提取，依賴文件格式
        "llm": 60,           # LLM 分類，變動較大
    }

    # 日期格式模式
    DATE_PATTERNS = [
        (r"(\d{4})-(\d{2})-(\d{2})", "%Y-%m-%d"),  # 2024-12-18
        (r"(\d{2})/(\d{2})/(\d{4})", "%m/%d/%Y"),  # 12/18/2024
        (r"(\d{2})-(\d{2})-(\d{4})", "%m-%d-%Y"),  # 12-18-2024
        (r"(\d{2})\.(\d{2})\.(\d{4})", "%d.%m.%Y"), # 18.12.2024
        (r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})", None),  # 18 Dec 2024
    ]

    MONTH_MAP = {
        "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
        "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
        "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
    }

    def __init__(self):
        """初始化映射器"""
        self.rules_applied = 0

    def map_fields(
        self,
        ocr_text: str,
        rules: list[MappingRule],
        azure_invoice_data: Optional[dict] = None,
        forwarder_id: Optional[str] = None,
    ) -> tuple[dict[str, FieldMappingResult], dict[str, UnmappedFieldDetail], ExtractionStatistics]:
        """
        執行欄位映射

        Args:
            ocr_text: OCR 提取的文本
            rules: 映射規則列表（已按優先級排序）
            azure_invoice_data: Azure Document Intelligence 發票數據
            forwarder_id: Forwarder ID（用於決定 tier 來源）

        Returns:
            tuple: (欄位映射結果, 未映射欄位詳情, 提取統計)
        """
        start_time = time.time()
        self.rules_applied = 0

        # 結果容器
        field_mappings: dict[str, FieldMappingResult] = {}
        unmapped_details: dict[str, UnmappedFieldDetail] = {}

        # 按欄位名稱分組規則
        rules_by_field: dict[str, list[MappingRule]] = {}
        for rule in rules:
            if rule.field_name not in rules_by_field:
                rules_by_field[rule.field_name] = []
            rules_by_field[rule.field_name].append(rule)

        # 對每個欄位執行提取
        for field_name, field_rules in rules_by_field.items():
            # 按優先級排序（降序）
            sorted_rules = sorted(field_rules, key=lambda r: r.priority, reverse=True)

            result = self._extract_field(
                field_name=field_name,
                rules=sorted_rules,
                ocr_text=ocr_text,
                azure_invoice_data=azure_invoice_data,
                forwarder_id=forwarder_id,
            )

            if result:
                field_mappings[field_name] = result
            else:
                # 記錄未映射原因
                unmapped_details[field_name] = UnmappedFieldDetail(
                    reason="no_matching_rule",
                    attempts=[r.extraction_pattern.get("method", "unknown") for r in sorted_rules],
                )

        # 計算統計
        processing_time = int((time.time() - start_time) * 1000)
        statistics = self._calculate_statistics(
            field_mappings=field_mappings,
            total_rules=len(rules_by_field),
            processing_time=processing_time,
        )

        return field_mappings, unmapped_details, statistics

    def _extract_field(
        self,
        field_name: str,
        rules: list[MappingRule],
        ocr_text: str,
        azure_invoice_data: Optional[dict],
        forwarder_id: Optional[str],
    ) -> Optional[FieldMappingResult]:
        """
        提取單一欄位值

        遍歷規則，使用第一個成功提取的結果。

        Args:
            field_name: 欄位名稱
            rules: 該欄位的規則列表
            ocr_text: OCR 文本
            azure_invoice_data: Azure 發票數據
            forwarder_id: Forwarder ID

        Returns:
            欄位映射結果或 None
        """
        for rule in rules:
            pattern = rule.extraction_pattern
            method = pattern.get("method", "regex")

            try:
                result = None

                if method == "azure_field":
                    result = self._extract_azure_field(
                        pattern=pattern,
                        azure_data=azure_invoice_data,
                        rule=rule,
                        forwarder_id=forwarder_id,
                    )
                elif method == "regex":
                    result = self._extract_regex(
                        pattern=pattern,
                        ocr_text=ocr_text,
                        rule=rule,
                        forwarder_id=forwarder_id,
                    )
                elif method == "keyword":
                    result = self._extract_keyword(
                        pattern=pattern,
                        ocr_text=ocr_text,
                        rule=rule,
                        forwarder_id=forwarder_id,
                    )
                elif method == "position":
                    # 位置提取需要更多上下文資訊，暫時跳過
                    logger.debug("position_extraction_not_implemented", field=field_name)
                    continue

                if result and result.value:
                    self.rules_applied += 1
                    return result

            except Exception as e:
                logger.warning(
                    "extraction_error",
                    field=field_name,
                    method=method,
                    rule_id=rule.id,
                    error=str(e),
                )
                continue

        return None

    def _extract_azure_field(
        self,
        pattern: dict,
        azure_data: Optional[dict],
        rule: MappingRule,
        forwarder_id: Optional[str],
    ) -> Optional[FieldMappingResult]:
        """
        從 Azure Document Intelligence 數據提取欄位

        Args:
            pattern: 提取模式
            azure_data: Azure 發票數據
            rule: 映射規則
            forwarder_id: Forwarder ID

        Returns:
            欄位映射結果或 None
        """
        if not azure_data:
            return None

        azure_field_name = pattern.get("azureFieldName") or pattern.get("azure_field_name")
        if not azure_field_name:
            return None

        # 從 Azure 數據中查找欄位
        value = self._get_azure_field_value(azure_data, azure_field_name)
        if value is None:
            return None

        # 計算信心度
        confidence_boost = pattern.get("confidenceBoost") or pattern.get("confidence_boost", 0)
        base_confidence = self.BASE_CONFIDENCE["azure_field"]
        confidence = min(100, base_confidence + confidence_boost)

        # 正規化值
        normalized_value = self._normalize_value(value, rule.field_name)

        # 驗證
        is_valid, validation_error = self._validate_value(
            normalized_value, rule.validation_pattern
        )

        return FieldMappingResult(
            value=normalized_value,
            raw_value=str(value),
            confidence=confidence,
            source=ConfidenceSource.AZURE.value,
            rule_id=rule.id,
            extraction_method=ExtractionMethod.AZURE_FIELD.value,
            is_validated=is_valid,
            validation_error=validation_error,
        )

    def _extract_regex(
        self,
        pattern: dict,
        ocr_text: str,
        rule: MappingRule,
        forwarder_id: Optional[str],
    ) -> Optional[FieldMappingResult]:
        """
        使用正則表達式提取欄位

        Args:
            pattern: 提取模式
            ocr_text: OCR 文本
            rule: 映射規則
            forwarder_id: Forwarder ID

        Returns:
            欄位映射結果或 None
        """
        regex_pattern = pattern.get("pattern")
        if not regex_pattern:
            return None

        # 準備正則表達式標誌
        flags_str = pattern.get("flags", "")
        flags = 0
        if "i" in flags_str:
            flags |= re.IGNORECASE
        if "m" in flags_str:
            flags |= re.MULTILINE
        if "s" in flags_str:
            flags |= re.DOTALL

        try:
            match = re.search(regex_pattern, ocr_text, flags)
            if not match:
                return None

            # 提取值
            group_index = pattern.get("groupIndex") or pattern.get("group_index", 0)
            try:
                raw_value = match.group(group_index)
            except IndexError:
                raw_value = match.group(0)

            if not raw_value:
                return None

            # 計算信心度
            confidence_boost = pattern.get("confidenceBoost") or pattern.get("confidence_boost", 0)
            base_confidence = self.BASE_CONFIDENCE["regex"]
            confidence = min(100, base_confidence + confidence_boost)

            # 決定來源 tier
            source = self._determine_source(rule, forwarder_id)

            # 正規化值
            normalized_value = self._normalize_value(raw_value, rule.field_name)

            # 驗證
            is_valid, validation_error = self._validate_value(
                normalized_value, rule.validation_pattern
            )

            return FieldMappingResult(
                value=normalized_value,
                raw_value=raw_value,
                confidence=confidence,
                source=source,
                rule_id=rule.id,
                extraction_method=ExtractionMethod.REGEX.value,
                is_validated=is_valid,
                validation_error=validation_error,
            )

        except re.error as e:
            logger.warning("invalid_regex_pattern", pattern=regex_pattern, error=str(e))
            return None

    def _extract_keyword(
        self,
        pattern: dict,
        ocr_text: str,
        rule: MappingRule,
        forwarder_id: Optional[str],
    ) -> Optional[FieldMappingResult]:
        """
        使用關鍵字鄰近匹配提取欄位

        Args:
            pattern: 提取模式
            ocr_text: OCR 文本
            rule: 映射規則
            forwarder_id: Forwarder ID

        Returns:
            欄位映射結果或 None
        """
        keywords = pattern.get("keywords", [])
        if not keywords:
            return None

        max_distance = pattern.get("maxDistance") or pattern.get("max_distance", 50)
        text_lower = ocr_text.lower()

        for keyword in keywords:
            keyword_lower = keyword.lower()
            idx = text_lower.find(keyword_lower)

            if idx == -1:
                continue

            # 在關鍵字後查找值
            start_pos = idx + len(keyword)
            end_pos = min(start_pos + max_distance, len(ocr_text))
            context = ocr_text[start_pos:end_pos]

            # 嘗試提取值（簡單策略：找到冒號後的內容或下一個詞）
            value = self._extract_value_after_keyword(context)
            if not value:
                continue

            # 計算信心度
            confidence_boost = pattern.get("confidenceBoost") or pattern.get("confidence_boost", 0)
            base_confidence = self.BASE_CONFIDENCE["keyword"]
            confidence = min(100, base_confidence + confidence_boost)

            # 決定來源 tier
            source = self._determine_source(rule, forwarder_id)

            # 正規化值
            normalized_value = self._normalize_value(value, rule.field_name)

            # 驗證
            is_valid, validation_error = self._validate_value(
                normalized_value, rule.validation_pattern
            )

            return FieldMappingResult(
                value=normalized_value,
                raw_value=value,
                confidence=confidence,
                source=source,
                rule_id=rule.id,
                extraction_method=ExtractionMethod.KEYWORD.value,
                is_validated=is_valid,
                validation_error=validation_error,
            )

        return None

    def _extract_value_after_keyword(self, context: str) -> Optional[str]:
        """
        從關鍵字後的上下文提取值

        Args:
            context: 關鍵字後的文本上下文

        Returns:
            提取的值或 None
        """
        # 移除前導空白和標點
        context = context.lstrip(" :：\t\n")

        if not context:
            return None

        # 嘗試提取到行尾或下一個主要分隔符
        match = re.match(r"^([^\n\r|]{1,100})", context)
        if match:
            value = match.group(1).strip()
            # 移除尾部標點
            value = re.sub(r"[,;:\s]+$", "", value)
            return value if value else None

        return None

    def _get_azure_field_value(self, azure_data: dict, field_name: str) -> Optional[str]:
        """
        從 Azure 發票數據中獲取欄位值

        Args:
            azure_data: Azure 發票數據
            field_name: 欄位名稱

        Returns:
            欄位值或 None
        """
        # Azure Invoice 欄位通常在 fields 或直接在根級別
        if "fields" in azure_data:
            fields = azure_data["fields"]
        else:
            fields = azure_data

        # 嘗試直接獲取
        if field_name in fields:
            field_data = fields[field_name]
            if isinstance(field_data, dict):
                return field_data.get("value") or field_data.get("content")
            return str(field_data)

        # 嘗試不區分大小寫匹配
        field_name_lower = field_name.lower()
        for key, value in fields.items():
            if key.lower() == field_name_lower:
                if isinstance(value, dict):
                    return value.get("value") or value.get("content")
                return str(value)

        return None

    def _determine_source(self, rule: MappingRule, forwarder_id: Optional[str]) -> str:
        """
        決定信心度來源 tier

        Args:
            rule: 映射規則
            forwarder_id: Forwarder ID

        Returns:
            來源 tier 字串
        """
        # 如果規則沒有關聯特定 forwarder，則為 Tier 1（通用規則）
        # 如果規則關聯特定 forwarder 且匹配當前 forwarder，則為 Tier 2
        # TODO: Tier 3 (LLM) 待實現

        # 從規則 ID 判斷是否為通用規則
        # 通用規則通常沒有 forwarder_id 關聯
        # 這裡簡化處理：假設規則本身已經按照正確的層級傳入
        if forwarder_id:
            return ConfidenceSource.TIER2.value
        return ConfidenceSource.TIER1.value

    def _normalize_value(self, value: str, field_name: str) -> str:
        """
        正規化欄位值

        Args:
            value: 原始值
            field_name: 欄位名稱（用於決定正規化策略）

        Returns:
            正規化後的值
        """
        if not value:
            return value

        # 基本清理
        value = value.strip()

        # 日期欄位正規化
        if "date" in field_name.lower():
            normalized_date = self._normalize_date(value)
            if normalized_date:
                return normalized_date

        # 金額欄位正規化
        if any(
            keyword in field_name.lower()
            for keyword in ["amount", "charge", "fee", "cost", "total", "price", "duty", "tax"]
        ):
            normalized_amount = self._normalize_amount(value)
            if normalized_amount:
                return normalized_amount

        # 重量欄位正規化
        if "weight" in field_name.lower():
            normalized_weight = self._normalize_weight(value)
            if normalized_weight:
                return normalized_weight

        return value

    def _normalize_date(self, value: str) -> Optional[str]:
        """
        正規化日期為 YYYY-MM-DD 格式

        Args:
            value: 原始日期字串

        Returns:
            正規化的日期字串或 None
        """
        for pattern, date_format in self.DATE_PATTERNS:
            match = re.search(pattern, value, re.IGNORECASE)
            if match:
                try:
                    if date_format:
                        # 標準格式
                        date_str = match.group(0)
                        parsed = datetime.strptime(date_str, date_format)
                        return parsed.strftime("%Y-%m-%d")
                    else:
                        # 特殊格式（如 18 Dec 2024）
                        groups = match.groups()
                        if len(groups) == 3:
                            day = groups[0].zfill(2)
                            month = self.MONTH_MAP.get(groups[1], "01")
                            year = groups[2]
                            return f"{year}-{month}-{day}"
                except ValueError:
                    continue

        return None

    def _normalize_amount(self, value: str) -> Optional[str]:
        """
        正規化金額

        Args:
            value: 原始金額字串

        Returns:
            正規化的金額字串（純數字，2位小數）或 None
        """
        # 移除貨幣符號和空格
        cleaned = re.sub(r"[^\d.,\-]", "", value)
        if not cleaned:
            return None

        # 處理千分位分隔符
        # 嘗試判斷逗號是千分位還是小數點
        if "," in cleaned and "." in cleaned:
            # 兩者都有，通常逗號是千分位
            cleaned = cleaned.replace(",", "")
        elif "," in cleaned:
            # 只有逗號，判斷位置
            parts = cleaned.split(",")
            if len(parts) == 2 and len(parts[1]) <= 2:
                # 逗號後面只有1-2位，當作小數點
                cleaned = cleaned.replace(",", ".")
            else:
                # 當作千分位
                cleaned = cleaned.replace(",", "")

        try:
            amount = float(cleaned)
            return f"{amount:.2f}"
        except ValueError:
            return None

    def _normalize_weight(self, value: str) -> Optional[str]:
        """
        正規化重量值

        Args:
            value: 原始重量字串

        Returns:
            正規化的重量字串或 None
        """
        # 移除單位
        cleaned = re.sub(r"(kg|lb|lbs|kgs|g|gram|grams)\.?", "", value, flags=re.IGNORECASE)
        cleaned = cleaned.strip()

        # 提取數字
        match = re.search(r"[\d.,]+", cleaned)
        if match:
            return self._normalize_amount(match.group(0))

        return None

    def _validate_value(
        self, value: str, validation_pattern: Optional[str]
    ) -> tuple[bool, Optional[str]]:
        """
        驗證欄位值

        Args:
            value: 欄位值
            validation_pattern: 驗證正則表達式

        Returns:
            tuple: (是否有效, 錯誤訊息)
        """
        if not validation_pattern or not value:
            return True, None

        try:
            if re.match(validation_pattern, value):
                return True, None
            else:
                return False, f"Value does not match pattern: {validation_pattern}"
        except re.error as e:
            logger.warning("invalid_validation_pattern", pattern=validation_pattern, error=str(e))
            return True, None  # 模式無效時視為通過

    def _calculate_statistics(
        self,
        field_mappings: dict[str, FieldMappingResult],
        total_rules: int,
        processing_time: int,
    ) -> ExtractionStatistics:
        """
        計算提取統計

        Args:
            field_mappings: 欄位映射結果
            total_rules: 總規則數（即總欄位數）
            processing_time: 處理時間（毫秒）

        Returns:
            提取統計
        """
        mapped_count = len(field_mappings)
        unmapped_count = total_rules - mapped_count

        # 計算平均信心度
        if mapped_count > 0:
            total_confidence = sum(r.confidence for r in field_mappings.values())
            avg_confidence = total_confidence / mapped_count
        else:
            avg_confidence = 0.0

        return ExtractionStatistics(
            total_fields=total_rules,
            mapped_fields=mapped_count,
            unmapped_fields=unmapped_count,
            average_confidence=round(avg_confidence, 2),
            processing_time_ms=processing_time,
            rules_applied=self.rules_applied,
        )
