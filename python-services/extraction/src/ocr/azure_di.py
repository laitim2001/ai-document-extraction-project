"""
@fileoverview Azure Document Intelligence 客戶端封裝
@description
  提供 Azure Document Intelligence (Form Recognizer) 的客戶端封裝：
  - 初始化 Azure DI 客戶端
  - 執行發票 OCR 分析
  - 處理分析結果

@module python-services/extraction/src/ocr/azure_di
@since Epic 2 - Story 2.2 (File OCR Extraction Service)
@lastModified 2025-12-18

@features
  - Azure Document Intelligence 客戶端初始化
  - 發票模型 (prebuilt-invoice) OCR 分析
  - URL 和 Bytes 兩種輸入方式支援
  - 錯誤處理和重試機制
"""

import time
from typing import Any, Optional
import structlog
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import (
    AnalyzeResult,
    AnalyzeDocumentRequest,
    DocumentAnalysisFeature,
)
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError

logger = structlog.get_logger(__name__)


class AzureDocumentIntelligenceClient:
    """
    Azure Document Intelligence 客戶端

    封裝 Azure DI SDK，提供發票 OCR 功能
    """

    def __init__(self, endpoint: str, api_key: str):
        """
        初始化客戶端

        Args:
            endpoint: Azure Document Intelligence 端點 URL
            api_key: Azure API 金鑰
        """
        self.endpoint = endpoint
        self.client = DocumentIntelligenceClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(api_key),
        )
        self.model_id = "prebuilt-invoice"  # 使用發票預建模型
        logger.info("azure_di_client_initialized", endpoint=endpoint)

    async def analyze_document_from_url(
        self,
        document_url: str,
        features: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        從 URL 分析文件

        Args:
            document_url: 文件 URL（需要公開訪問或有 SAS token）
            features: 額外的分析特性（可選）

        Returns:
            分析結果字典，包含原始結果和結構化數據
        """
        start_time = time.time()
        logger.info("analyze_document_start", url=document_url[:100])

        try:
            # 準備分析請求
            analyze_request = AnalyzeDocumentRequest(url_source=document_url)

            # 執行分析（同步 API，使用長輪詢）
            poller = self.client.begin_analyze_document(
                model_id=self.model_id,
                analyze_request=analyze_request,
                features=self._get_features(features),
            )

            # 等待結果
            result: AnalyzeResult = poller.result()

            processing_time = int((time.time() - start_time) * 1000)
            logger.info(
                "analyze_document_complete",
                processing_time_ms=processing_time,
                page_count=len(result.pages) if result.pages else 0,
            )

            return self._parse_result(result, processing_time)

        except HttpResponseError as e:
            logger.error(
                "analyze_document_error",
                error_code=e.error.code if e.error else "UNKNOWN",
                error_message=str(e),
            )
            raise

    async def analyze_document_from_bytes(
        self,
        document_bytes: bytes,
        content_type: str = "application/pdf",
        features: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        從 bytes 分析文件

        Args:
            document_bytes: 文件二進制數據
            content_type: MIME 類型
            features: 額外的分析特性（可選）

        Returns:
            分析結果字典
        """
        start_time = time.time()
        logger.info("analyze_document_bytes_start", size=len(document_bytes))

        try:
            # 執行分析（使用 bytes 輸入）
            poller = self.client.begin_analyze_document(
                model_id=self.model_id,
                analyze_request=document_bytes,
                content_type=content_type,
                features=self._get_features(features),
            )

            # 等待結果
            result: AnalyzeResult = poller.result()

            processing_time = int((time.time() - start_time) * 1000)
            logger.info(
                "analyze_document_bytes_complete",
                processing_time_ms=processing_time,
                page_count=len(result.pages) if result.pages else 0,
            )

            return self._parse_result(result, processing_time)

        except HttpResponseError as e:
            logger.error(
                "analyze_document_bytes_error",
                error_code=e.error.code if e.error else "UNKNOWN",
                error_message=str(e),
            )
            raise

    def _get_features(
        self, features: Optional[list[str]]
    ) -> Optional[list[DocumentAnalysisFeature]]:
        """轉換特性列表為 SDK 枚舉"""
        if not features:
            return None

        feature_map = {
            "ocrHighResolution": DocumentAnalysisFeature.OCR_HIGH_RESOLUTION,
            "languages": DocumentAnalysisFeature.LANGUAGES,
        }
        return [feature_map[f] for f in features if f in feature_map]

    def _parse_result(
        self, result: AnalyzeResult, processing_time: int
    ) -> dict[str, Any]:
        """
        解析 Azure DI 分析結果

        Args:
            result: Azure DI 原始分析結果
            processing_time: 處理時間（毫秒）

        Returns:
            結構化的分析結果字典
        """
        # 提取文字內容
        extracted_text = result.content or ""

        # 計算整體信心度（基於文件中所有欄位的平均信心度）
        confidence = self._calculate_confidence(result)

        # 提取發票數據
        invoice_data = self._extract_invoice_data(result)

        return {
            "rawResult": result.as_dict(),
            "extractedText": extracted_text,
            "invoiceData": invoice_data,
            "processingTime": processing_time,
            "pageCount": len(result.pages) if result.pages else 0,
            "confidence": confidence,
        }

    def _calculate_confidence(self, result: AnalyzeResult) -> float:
        """計算整體信心度"""
        if not result.documents:
            return 0.0

        total_confidence = 0.0
        field_count = 0

        for doc in result.documents:
            if doc.fields:
                for field in doc.fields.values():
                    if field and hasattr(field, "confidence") and field.confidence:
                        total_confidence += field.confidence
                        field_count += 1

        if field_count == 0:
            return 0.0

        return round(total_confidence / field_count, 4)

    def _extract_invoice_data(self, result: AnalyzeResult) -> dict[str, Any]:
        """
        從分析結果提取發票數據

        提取欄位包括：
        - 供應商資訊 (VendorName, VendorAddress)
        - 客戶資訊 (CustomerName, CustomerAddress)
        - 發票資訊 (InvoiceId, InvoiceDate, DueDate)
        - 金額 (SubTotal, TotalTax, InvoiceTotal)
        - 項目明細 (Items)
        """
        if not result.documents:
            return {}

        invoice_data: dict[str, Any] = {}

        for doc in result.documents:
            if not doc.fields:
                continue

            # 提取標準發票欄位
            field_mappings = {
                "vendorName": "VendorName",
                "vendorAddress": "VendorAddress",
                "customerName": "CustomerName",
                "customerAddress": "CustomerAddress",
                "invoiceId": "InvoiceId",
                "invoiceDate": "InvoiceDate",
                "dueDate": "DueDate",
                "purchaseOrder": "PurchaseOrder",
                "subTotal": "SubTotal",
                "totalTax": "TotalTax",
                "invoiceTotal": "InvoiceTotal",
                "amountDue": "AmountDue",
                "currency": "CurrencyCode",
            }

            for local_key, azure_key in field_mappings.items():
                field = doc.fields.get(azure_key)
                if field:
                    invoice_data[local_key] = self._extract_field_value(field)

            # 提取項目明細
            items_field = doc.fields.get("Items")
            if items_field and items_field.value:
                invoice_data["items"] = self._extract_line_items(items_field.value)

        return invoice_data

    def _extract_field_value(self, field: Any) -> Any:
        """提取欄位值"""
        if not field:
            return None

        # 處理不同類型的值
        if hasattr(field, "value"):
            value = field.value
            # 處理日期類型
            if hasattr(value, "isoformat"):
                return value.isoformat()
            # 處理貨幣類型
            if hasattr(value, "amount"):
                return {
                    "amount": float(value.amount) if value.amount else None,
                    "currencyCode": getattr(value, "currency_code", None),
                }
            return value

        return None

    def _extract_line_items(self, items: list[Any]) -> list[dict[str, Any]]:
        """提取項目明細"""
        line_items = []

        for item in items:
            if not hasattr(item, "value") or not item.value:
                continue

            item_data = {}
            item_fields = item.value

            # 提取項目欄位
            item_mappings = {
                "description": "Description",
                "quantity": "Quantity",
                "unit": "Unit",
                "unitPrice": "UnitPrice",
                "amount": "Amount",
                "productCode": "ProductCode",
            }

            for local_key, azure_key in item_mappings.items():
                if azure_key in item_fields:
                    field = item_fields[azure_key]
                    item_data[local_key] = self._extract_field_value(field)

            if item_data:
                line_items.append(item_data)

        return line_items
