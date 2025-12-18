"""
@fileoverview 文件處理器模組
@description
  提供文件 OCR 處理的高層封裝：
  - 支援 URL 和 Bytes 輸入
  - 錯誤處理和重試機制
  - 處理結果標準化

@module python-services/extraction/src/ocr/processor
@since Epic 2 - Story 2.2 (File OCR Extraction Service)
@lastModified 2025-12-18

@features
  - 統一的文件處理介面
  - 自動重試機制（指數退避）
  - 詳細的錯誤分類
"""

import asyncio
from typing import Any, Optional
from enum import Enum
import structlog

from .azure_di import AzureDocumentIntelligenceClient

logger = structlog.get_logger(__name__)


class OcrErrorCode(str, Enum):
    """OCR 錯誤代碼"""
    SUCCESS = "SUCCESS"
    INVALID_INPUT = "INVALID_INPUT"
    NETWORK_ERROR = "NETWORK_ERROR"
    SERVICE_ERROR = "SERVICE_ERROR"
    TIMEOUT = "TIMEOUT"
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class DocumentProcessor:
    """
    文件處理器

    封裝 OCR 處理邏輯，提供統一的處理介面
    """

    # 支援的 MIME 類型
    SUPPORTED_MIME_TYPES = {
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/tiff",
        "image/bmp",
    }

    def __init__(
        self,
        azure_client: AzureDocumentIntelligenceClient,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        """
        初始化處理器

        Args:
            azure_client: Azure Document Intelligence 客戶端
            max_retries: 最大重試次數
            retry_delay: 重試延遲（秒）
        """
        self.azure_client = azure_client
        self.max_retries = max_retries
        self.retry_delay = retry_delay

    async def process_from_url(
        self,
        document_url: str,
        document_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        從 URL 處理文件

        Args:
            document_url: 文件 URL
            document_id: 文件 ID（用於日誌追蹤）

        Returns:
            處理結果字典
        """
        logger.info(
            "process_document_from_url",
            document_id=document_id,
            url=document_url[:100] if document_url else None,
        )

        return await self._process_with_retry(
            self.azure_client.analyze_document_from_url,
            document_url,
            document_id=document_id,
        )

    async def process_from_bytes(
        self,
        document_bytes: bytes,
        content_type: str,
        document_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        從 bytes 處理文件

        Args:
            document_bytes: 文件二進制數據
            content_type: MIME 類型
            document_id: 文件 ID（用於日誌追蹤）

        Returns:
            處理結果字典
        """
        # 驗證 MIME 類型
        if content_type not in self.SUPPORTED_MIME_TYPES:
            return self._create_error_result(
                OcrErrorCode.UNSUPPORTED_FORMAT,
                f"Unsupported content type: {content_type}",
            )

        logger.info(
            "process_document_from_bytes",
            document_id=document_id,
            content_type=content_type,
            size=len(document_bytes),
        )

        return await self._process_with_retry(
            self.azure_client.analyze_document_from_bytes,
            document_bytes,
            content_type,
            document_id=document_id,
        )

    async def _process_with_retry(
        self,
        process_func,
        *args,
        document_id: Optional[str] = None,
        **kwargs,
    ) -> dict[str, Any]:
        """
        帶重試的處理邏輯

        Args:
            process_func: 處理函數
            *args: 處理函數參數
            document_id: 文件 ID
            **kwargs: 額外參數

        Returns:
            處理結果
        """
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries):
            try:
                result = await process_func(*args)
                return {
                    "success": True,
                    "errorCode": OcrErrorCode.SUCCESS,
                    "errorMessage": None,
                    "retryCount": attempt,
                    **result,
                }

            except asyncio.TimeoutError as e:
                last_error = e
                logger.warning(
                    "process_timeout",
                    document_id=document_id,
                    attempt=attempt + 1,
                )
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (2**attempt))

            except Exception as e:
                last_error = e
                error_code = self._classify_error(e)

                # 某些錯誤不應重試
                if error_code in {
                    OcrErrorCode.INVALID_INPUT,
                    OcrErrorCode.UNSUPPORTED_FORMAT,
                    OcrErrorCode.FILE_TOO_LARGE,
                }:
                    logger.error(
                        "process_error_no_retry",
                        document_id=document_id,
                        error_code=error_code,
                        error=str(e),
                    )
                    return self._create_error_result(
                        error_code, str(e), attempt
                    )

                logger.warning(
                    "process_error_retrying",
                    document_id=document_id,
                    error_code=error_code,
                    attempt=attempt + 1,
                    error=str(e),
                )

                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (2**attempt))

        # 所有重試失敗
        error_code = self._classify_error(last_error)
        logger.error(
            "process_failed_all_retries",
            document_id=document_id,
            error_code=error_code,
            error=str(last_error),
        )
        return self._create_error_result(
            error_code,
            str(last_error),
            self.max_retries,
        )

    def _classify_error(self, error: Optional[Exception]) -> OcrErrorCode:
        """分類錯誤類型"""
        if error is None:
            return OcrErrorCode.UNKNOWN_ERROR

        error_str = str(error).lower()

        if "timeout" in error_str:
            return OcrErrorCode.TIMEOUT
        if "network" in error_str or "connection" in error_str:
            return OcrErrorCode.NETWORK_ERROR
        if "invalid" in error_str or "bad request" in error_str:
            return OcrErrorCode.INVALID_INPUT
        if "too large" in error_str or "size" in error_str:
            return OcrErrorCode.FILE_TOO_LARGE
        if "unsupported" in error_str or "format" in error_str:
            return OcrErrorCode.UNSUPPORTED_FORMAT
        if "service" in error_str or "500" in error_str or "503" in error_str:
            return OcrErrorCode.SERVICE_ERROR

        return OcrErrorCode.UNKNOWN_ERROR

    def _create_error_result(
        self,
        error_code: OcrErrorCode,
        error_message: str,
        retry_count: int = 0,
    ) -> dict[str, Any]:
        """創建錯誤結果"""
        return {
            "success": False,
            "errorCode": error_code,
            "errorMessage": error_message,
            "retryCount": retry_count,
            "rawResult": None,
            "extractedText": "",
            "invoiceData": None,
            "processingTime": None,
            "pageCount": None,
            "confidence": None,
        }
