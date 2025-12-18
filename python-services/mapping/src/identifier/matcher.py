"""
@fileoverview Forwarder 識別匹配器
@description
  實現基於模式匹配的 Forwarder 識別邏輯：
  - 名稱匹配：公司名稱變體匹配
  - 關鍵詞匹配：獨特關鍵詞/短語匹配
  - 格式匹配：追蹤號碼格式正則匹配
  - Logo 文字匹配：Logo 附近文字匹配

  信心度計算規則：
  - 名稱匹配: +40 分
  - 關鍵詞匹配: +15 分/每個（最高 30 分）
  - 格式匹配: +20 分
  - Logo 文字匹配: +10 分
  - 匹配數量加成: +5 分/額外匹配

@module python-services/mapping/src/identifier/matcher
@since Epic 2 - Story 2.3 (Forwarder Auto-Identification)
@lastModified 2025-12-18
"""

import re
from dataclasses import dataclass, field
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class ForwarderPattern:
    """Forwarder 識別模式配置"""

    forwarder_id: str
    code: str
    name: str
    display_name: str
    names: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    formats: list[str] = field(default_factory=list)
    logo_text: list[str] = field(default_factory=list)
    priority: int = 0


@dataclass
class MatchDetail:
    """匹配詳細資訊"""

    match_type: str  # "name", "keyword", "format", "logo_text"
    pattern: str
    matched_text: str
    score: float


@dataclass
class IdentificationResult:
    """識別結果"""

    forwarder_id: Optional[str]
    forwarder_code: Optional[str]
    forwarder_name: Optional[str]
    confidence: float
    match_method: str
    matched_patterns: list[str]
    match_details: list[dict]
    is_identified: bool

    def to_dict(self) -> dict:
        """轉換為字典格式"""
        return {
            "forwarderId": self.forwarder_id,
            "forwarderCode": self.forwarder_code,
            "forwarderName": self.forwarder_name,
            "confidence": self.confidence,
            "matchMethod": self.match_method,
            "matchedPatterns": self.matched_patterns,
            "matchDetails": self.match_details,
            "isIdentified": self.is_identified,
        }


class ForwarderMatcher:
    """
    Forwarder 識別匹配器

    基於預設的識別模式對 OCR 文本進行匹配，
    計算信心度並返回最佳匹配結果。
    """

    # 信心度分數配置
    SCORE_NAME_MATCH = 40.0
    SCORE_KEYWORD_MATCH = 15.0
    SCORE_KEYWORD_MAX = 30.0
    SCORE_FORMAT_MATCH = 20.0
    SCORE_LOGO_TEXT_MATCH = 10.0
    SCORE_BONUS_PER_MATCH = 5.0

    # 信心度閾值
    THRESHOLD_AUTO_IDENTIFY = 80.0  # >= 80% 自動識別
    THRESHOLD_NEEDS_REVIEW = 50.0  # >= 50% 需要審核

    def __init__(self, patterns: list[ForwarderPattern]):
        """
        初始化匹配器

        Args:
            patterns: Forwarder 識別模式列表
        """
        # 按優先級排序（高優先級先檢查）
        self._patterns = sorted(patterns, key=lambda p: -p.priority)
        logger.info("matcher_initialized", pattern_count=len(patterns))

    def identify(self, text: str) -> IdentificationResult:
        """
        識別文本中的 Forwarder

        Args:
            text: OCR 提取的文本內容

        Returns:
            識別結果，包含信心度和匹配詳情
        """
        if not text or not text.strip():
            return self._create_unidentified_result("empty_text")

        # 預處理文本
        normalized_text = self._normalize_text(text)

        best_result: Optional[IdentificationResult] = None
        best_confidence = 0.0

        # 對每個 Forwarder 模式進行匹配
        for pattern in self._patterns:
            if pattern.code == "UNKNOWN":
                continue

            result = self._match_pattern(pattern, normalized_text, text)

            if result.confidence > best_confidence:
                best_confidence = result.confidence
                best_result = result

        # 如果沒有匹配到任何結果
        if best_result is None or best_confidence < self.THRESHOLD_NEEDS_REVIEW:
            return self._create_unidentified_result("no_match")

        logger.info(
            "identification_completed",
            forwarder_code=best_result.forwarder_code,
            confidence=best_result.confidence,
            match_method=best_result.match_method,
        )

        return best_result

    def _normalize_text(self, text: str) -> str:
        """
        標準化文本以進行匹配

        Args:
            text: 原始文本

        Returns:
            標準化後的文本（小寫，移除多餘空白）
        """
        # 轉小寫
        normalized = text.lower()
        # 移除多餘空白
        normalized = re.sub(r"\s+", " ", normalized)
        return normalized.strip()

    def _match_pattern(
        self, pattern: ForwarderPattern, normalized_text: str, original_text: str
    ) -> IdentificationResult:
        """
        對單個 Forwarder 模式進行匹配

        Args:
            pattern: Forwarder 識別模式
            normalized_text: 標準化文本
            original_text: 原始文本（用於格式匹配）

        Returns:
            匹配結果
        """
        total_score = 0.0
        matched_patterns: list[str] = []
        match_details: list[dict] = []
        primary_method = "none"

        # 1. 名稱匹配
        name_matched = False
        for name in pattern.names:
            name_lower = name.lower()
            if name_lower in normalized_text:
                if not name_matched:
                    total_score += self.SCORE_NAME_MATCH
                    primary_method = "name"
                    name_matched = True
                matched_patterns.append(f"name:{name}")
                match_details.append(
                    {
                        "type": "name",
                        "pattern": name,
                        "score": self.SCORE_NAME_MATCH if len(match_details) == 0 else self.SCORE_BONUS_PER_MATCH,
                    }
                )

        # 2. 關鍵詞匹配
        keyword_score = 0.0
        for keyword in pattern.keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in normalized_text:
                score_to_add = min(
                    self.SCORE_KEYWORD_MATCH,
                    self.SCORE_KEYWORD_MAX - keyword_score,
                )
                if score_to_add > 0:
                    keyword_score += score_to_add
                    total_score += score_to_add
                    if primary_method == "none":
                        primary_method = "keyword"
                matched_patterns.append(f"keyword:{keyword}")
                match_details.append(
                    {
                        "type": "keyword",
                        "pattern": keyword,
                        "score": score_to_add,
                    }
                )

        # 3. 格式匹配（使用正則表達式）
        for fmt in pattern.formats:
            try:
                regex = re.compile(fmt, re.IGNORECASE)
                matches = regex.findall(original_text)
                if matches:
                    total_score += self.SCORE_FORMAT_MATCH
                    if primary_method == "none":
                        primary_method = "format"
                    # 只記錄第一個匹配
                    matched_patterns.append(f"format:{fmt}")
                    match_details.append(
                        {
                            "type": "format",
                            "pattern": fmt,
                            "matchedValue": matches[0] if isinstance(matches[0], str) else str(matches[0]),
                            "score": self.SCORE_FORMAT_MATCH,
                        }
                    )
                    break  # 只計算一次格式匹配分數
            except re.error as e:
                logger.warning(
                    "invalid_regex_pattern",
                    pattern=fmt,
                    forwarder_code=pattern.code,
                    error=str(e),
                )

        # 4. Logo 文字匹配
        for logo_text in pattern.logo_text:
            logo_text_lower = logo_text.lower()
            if logo_text_lower in normalized_text:
                total_score += self.SCORE_LOGO_TEXT_MATCH
                if primary_method == "none":
                    primary_method = "logo_text"
                matched_patterns.append(f"logo:{logo_text}")
                match_details.append(
                    {
                        "type": "logo_text",
                        "pattern": logo_text,
                        "score": self.SCORE_LOGO_TEXT_MATCH,
                    }
                )
                break  # 只計算一次 Logo 文字匹配分數

        # 計算最終信心度（最高 100%）
        confidence = min(total_score, 100.0)

        return IdentificationResult(
            forwarder_id=pattern.forwarder_id,
            forwarder_code=pattern.code,
            forwarder_name=pattern.display_name,
            confidence=confidence,
            match_method=primary_method,
            matched_patterns=matched_patterns,
            match_details=match_details,
            is_identified=confidence >= self.THRESHOLD_AUTO_IDENTIFY,
        )

    def _create_unidentified_result(self, reason: str) -> IdentificationResult:
        """
        創建未識別結果

        Args:
            reason: 未識別原因

        Returns:
            未識別的結果
        """
        return IdentificationResult(
            forwarder_id=None,
            forwarder_code=None,
            forwarder_name=None,
            confidence=0.0,
            match_method="none",
            matched_patterns=[],
            match_details=[{"reason": reason}],
            is_identified=False,
        )
