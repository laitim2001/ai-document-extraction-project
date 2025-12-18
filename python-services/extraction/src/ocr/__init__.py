"""
OCR Module

封裝 Azure Document Intelligence 客戶端和文件處理邏輯
"""

from .azure_di import AzureDocumentIntelligenceClient
from .processor import DocumentProcessor

__all__ = ["AzureDocumentIntelligenceClient", "DocumentProcessor"]
