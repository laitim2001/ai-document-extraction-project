/**
 * @fileoverview OCR 提取相關類型定義
 * @description
 *   提供 OCR 提取功能的 TypeScript 類型定義：
 *   - OCR 結果類型
 *   - 發票數據結構
 *   - API 請求/響應類型
 *
 * @module src/types/extraction
 * @since Epic 2 - Story 2.2 (File OCR Extraction Service)
 * @lastModified 2025-12-18
 */

import type { Prisma } from '@prisma/client'

// JSON 類型別名
type JsonValue = Prisma.JsonValue

// ============================================================
// OCR Error Codes
// ============================================================

/**
 * OCR 錯誤代碼
 */
export type OcrErrorCode =
  | 'SUCCESS'
  | 'INVALID_INPUT'
  | 'NETWORK_ERROR'
  | 'SERVICE_ERROR'
  | 'TIMEOUT'
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'UNKNOWN_ERROR'

// ============================================================
// Invoice Data Types
// ============================================================

/**
 * 貨幣金額
 */
export interface CurrencyAmount {
  /** 金額數值 */
  amount: number | null
  /** 貨幣代碼 (ISO 4217) */
  currencyCode: string | null
}

/**
 * 發票項目明細
 */
export interface InvoiceLineItem {
  /** 描述 */
  description: string | null
  /** 數量 */
  quantity: number | null
  /** 單位 */
  unit: string | null
  /** 單價 */
  unitPrice: CurrencyAmount | null
  /** 金額 */
  amount: CurrencyAmount | null
  /** 產品代碼 */
  productCode: string | null
}

/**
 * 結構化發票數據
 */
export interface InvoiceData {
  // 供應商資訊
  /** 供應商名稱 */
  vendorName: string | null
  /** 供應商地址 */
  vendorAddress: string | null

  // 客戶資訊
  /** 客戶名稱 */
  customerName: string | null
  /** 客戶地址 */
  customerAddress: string | null

  // 發票資訊
  /** 發票編號 */
  invoiceId: string | null
  /** 發票日期 */
  invoiceDate: string | null
  /** 到期日 */
  dueDate: string | null
  /** 採購單號 */
  purchaseOrder: string | null

  // 金額
  /** 小計 */
  subTotal: CurrencyAmount | null
  /** 稅額 */
  totalTax: CurrencyAmount | null
  /** 總金額 */
  invoiceTotal: CurrencyAmount | null
  /** 應付金額 */
  amountDue: CurrencyAmount | null
  /** 貨幣代碼 */
  currency: string | null

  // 項目明細
  /** 項目列表 */
  items: InvoiceLineItem[]
}

// ============================================================
// OCR Result Types
// ============================================================

/**
 * Python OCR 服務響應
 */
export interface PythonOcrResponse {
  /** 是否成功 */
  success: boolean
  /** 錯誤代碼 */
  errorCode: OcrErrorCode
  /** 錯誤訊息 */
  errorMessage: string | null
  /** 重試次數 */
  retryCount: number
  /** Azure DI 原始結果 */
  rawResult: JsonValue | null
  /** 提取的文字 */
  extractedText: string
  /** 發票數據 */
  invoiceData: InvoiceData | null
  /** 處理時間 (ms) */
  processingTime: number | null
  /** 頁數 */
  pageCount: number | null
  /** 信心度 (0-1) */
  confidence: number | null
}

/**
 * 資料庫 OCR 結果
 */
export interface OcrResultRecord {
  /** 記錄 ID */
  id: string
  /** 文件 ID */
  documentId: string
  /** 原始結果 */
  rawResult: JsonValue
  /** 提取的文字 */
  extractedText: string
  /** 發票數據 */
  invoiceData: JsonValue | null
  /** 處理時間 */
  processingTime: number | null
  /** 頁數 */
  pageCount: number | null
  /** 信心度 */
  confidence: number | null
  /** 錯誤代碼 */
  errorCode: string | null
  /** 錯誤訊息 */
  errorMessage: string | null
  /** 重試次數 */
  retryCount: number
  /** 建立時間 */
  createdAt: Date
  /** 更新時間 */
  updatedAt: Date
}

// ============================================================
// API Types
// ============================================================

/**
 * 提取請求（從 URL）
 */
export interface ExtractFromUrlRequest {
  /** 文件 ID */
  documentId: string
}

/**
 * 提取響應
 */
export interface ExtractionResponse {
  /** 是否成功 */
  success: boolean
  /** OCR 結果 */
  data: OcrResultRecord | null
  /** 錯誤訊息 */
  error?: string
}

/**
 * OCR 狀態
 */
export type OcrStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
