/**
 * @fileoverview 審計報告匯出相關類型定義
 * @description
 *   - 審計報告配置和數據類型
 *   - 報告輸出格式定義
 *   - 報告任務狀態和生命週期
 *
 * @module src/types/audit-report
 * @since Epic 8 - Story 8.5
 * @lastModified 2025-12-20
 */

import type { AuditReportType, ReportOutputFormat, ReportJobStatus2 } from '@prisma/client'

// =====================
// 報告類型常數
// =====================

/**
 * 審計報告類型選項
 */
export const AUDIT_REPORT_TYPES = {
  PROCESSING_RECORDS: {
    value: 'PROCESSING_RECORDS' as const,
    label: '處理記錄報告',
    description: '包含所有文件處理操作的詳細記錄',
  },
  CHANGE_HISTORY: {
    value: 'CHANGE_HISTORY' as const,
    label: '變更歷史報告',
    description: '資料變更追蹤，包含版本差異',
  },
  FULL_AUDIT: {
    value: 'FULL_AUDIT' as const,
    label: '完整審計報告',
    description: '包含處理記錄、變更歷史和原始文件清單',
  },
  COMPLIANCE_SUMMARY: {
    value: 'COMPLIANCE_SUMMARY' as const,
    label: '合規摘要報告',
    description: '合規性統計和摘要資訊',
  },
} as const

/**
 * 報告輸出格式選項
 */
export const REPORT_OUTPUT_FORMATS = {
  EXCEL: {
    value: 'EXCEL' as const,
    label: 'Excel (.xlsx)',
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  PDF: {
    value: 'PDF' as const,
    label: 'PDF',
    extension: 'pdf',
    mimeType: 'application/pdf',
  },
  CSV: {
    value: 'CSV' as const,
    label: 'CSV',
    extension: 'csv',
    mimeType: 'text/csv',
  },
  JSON: {
    value: 'JSON' as const,
    label: 'JSON',
    extension: 'json',
    mimeType: 'application/json',
  },
} as const

/**
 * 報告任務狀態選項
 */
export const REPORT_JOB_STATUSES = {
  PENDING: { value: 'PENDING' as const, label: '等待中', color: 'bg-gray-100 text-gray-700' },
  QUEUED: { value: 'QUEUED' as const, label: '排隊中', color: 'bg-blue-100 text-blue-700' },
  PROCESSING: { value: 'PROCESSING' as const, label: '處理中', color: 'bg-yellow-100 text-yellow-700' },
  GENERATING: { value: 'GENERATING' as const, label: '生成中', color: 'bg-yellow-100 text-yellow-700' },
  SIGNING: { value: 'SIGNING' as const, label: '簽章中', color: 'bg-purple-100 text-purple-700' },
  COMPLETED: { value: 'COMPLETED' as const, label: '已完成', color: 'bg-green-100 text-green-700' },
  FAILED: { value: 'FAILED' as const, label: '失敗', color: 'bg-red-100 text-red-700' },
  CANCELLED: { value: 'CANCELLED' as const, label: '已取消', color: 'bg-gray-100 text-gray-500' },
  EXPIRED: { value: 'EXPIRED' as const, label: '已過期', color: 'bg-orange-100 text-orange-700' },
} as const

// =====================
// 閾值常數
// =====================

/** 大型報告閾值（超過此數量使用背景處理） */
export const LARGE_REPORT_THRESHOLD = 5000

/** 報告過期天數 */
export const REPORT_EXPIRY_DAYS = 7

/** 最大報告記錄數 */
export const MAX_REPORT_RECORDS = 50000

// =====================
// 類型定義
// =====================

/**
 * 審計報告配置
 */
export interface AuditReportConfig {
  /** 報告類型 */
  reportType: AuditReportType
  /** 輸出格式 */
  outputFormat: ReportOutputFormat
  /** 報告標題 */
  title: string
  /** 日期範圍 */
  dateRange: {
    from: Date | string
    to: Date | string
  }
  /** 過濾條件 */
  filters: {
    cityIds?: string[]
    // REFACTOR-001: forwarder → company
    companyIds?: string[]
    userIds?: string[]
    statuses?: string[]
  }
  /** 包含的欄位 */
  includedFields: string[]
  /** 是否包含變更歷史 */
  includeChanges: boolean
  /** 是否包含原始文件 */
  includeFiles: boolean
}

/**
 * 審計報告數據
 */
export interface AuditReportData {
  /** 報告元數據 */
  metadata: {
    title: string
    reportType: AuditReportType
    generatedAt: Date
    generatedBy: string
    dateRange: {
      from: Date
      to: Date
    }
    filters: Record<string, unknown>
    totalRecords: number
  }
  /** 處理記錄 */
  processingRecords: ProcessingRecordItem[]
  /** 變更歷史 */
  changeHistory: ChangeHistoryItem[]
  /** 文件清單 */
  fileList: FileListItem[]
}

/**
 * 處理記錄項目
 */
export interface ProcessingRecordItem {
  id: string
  timestamp: Date
  userId: string
  userName: string
  action: string
  resourceType: string
  resourceId: string
  resourceName?: string
  ipAddress?: string
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL'
  details?: Record<string, unknown>
}

/**
 * 變更歷史項目
 */
export interface ChangeHistoryItem {
  id: string
  resourceType: string
  resourceId: string
  version: number
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'
  changedBy: string
  changedByName: string
  changeReason?: string
  changes?: {
    before: Record<string, unknown>
    after: Record<string, unknown>
    changedFields: string[]
  }
  createdAt: Date
}

/**
 * 文件清單項目
 */
export interface FileListItem {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  status: string
  forwarderName?: string
  cityCode?: string
  createdAt: Date
  processedAt?: Date
}

/**
 * 審計報告任務
 */
export interface AuditReportJob {
  id: string
  reportType: AuditReportType
  outputFormat: ReportOutputFormat
  title: string
  queryParams: Record<string, unknown>
  dateFrom: Date
  dateTo: Date
  cityIds: string[]
  forwarderIds: string[]
  includedFields: string[]
  includeChanges: boolean
  includeFiles: boolean
  status: ReportJobStatus2
  progress: number
  totalRecords: number | null
  processedRecords: number
  fileUrl: string | null
  fileSize: bigint | null
  checksum: string | null
  digitalSignature: string | null
  errorMessage: string | null
  errorDetails: Record<string, unknown> | null
  requestedById: string
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  expiresAt: Date | null
}

/**
 * 審計報告下載記錄
 */
export interface AuditReportDownload {
  id: string
  reportJobId: string
  downloadedById: string
  downloadedAt: Date
  ipAddress: string | null
  userAgent: string | null
}

/**
 * 報告完整性驗證結果
 */
export interface ReportIntegrityResult {
  isValid: boolean
  details: {
    checksumMatch: boolean
    signatureValid: boolean
    originalChecksum: string
    calculatedChecksum: string
  }
}

// =====================
// API 請求/響應類型
// =====================

/**
 * 建立報告請求
 */
export interface CreateAuditReportRequest {
  reportType: AuditReportType
  outputFormat: ReportOutputFormat
  title: string
  dateRange: {
    from: string
    to: string
  }
  filters?: {
    cityIds?: string[]
    forwarderIds?: string[]
    userIds?: string[]
    statuses?: string[]
  }
  includedFields?: string[]
  includeChanges?: boolean
  includeFiles?: boolean
}

/**
 * 建立報告響應
 */
export interface CreateAuditReportResponse {
  jobId: string
  isAsync: boolean
  estimatedRecords: number
  message: string
}

/**
 * 報告列表查詢參數
 */
export interface AuditReportListParams {
  page?: number
  limit?: number
  status?: ReportJobStatus2
  reportType?: AuditReportType
}

/**
 * 報告列表響應
 */
export interface AuditReportListResponse {
  items: AuditReportJobListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * 報告任務列表項目（簡化版）
 */
export interface AuditReportJobListItem {
  id: string
  title: string
  reportType: AuditReportType
  outputFormat: ReportOutputFormat
  status: ReportJobStatus2
  progress: number
  totalRecords: number | null
  createdAt: Date
  completedAt: Date | null
  expiresAt: Date | null
  downloadCount?: number
}

/**
 * 報告詳情響應
 */
export interface AuditReportDetailResponse {
  job: AuditReportJob
  downloads: AuditReportDownload[]
  requestedBy: {
    id: string
    name: string
    email: string
  }
}

/**
 * 下載報告響應
 */
export interface DownloadReportResponse {
  downloadUrl: string
  fileName: string
  fileSize: number
  checksum: string
}

/**
 * 驗證報告響應
 */
export interface VerifyReportResponse {
  isValid: boolean
  details: {
    checksumMatch: boolean
    signatureValid: boolean
    originalChecksum: string
    calculatedChecksum: string
  }
  verifiedAt: string
}

// =====================
// 輔助函數
// =====================

/**
 * 取得報告類型配置
 */
export function getReportTypeConfig(type: AuditReportType) {
  const config = AUDIT_REPORT_TYPES[type as keyof typeof AUDIT_REPORT_TYPES]
  return config || AUDIT_REPORT_TYPES.PROCESSING_RECORDS
}

/**
 * 取得輸出格式配置
 */
export function getOutputFormatConfig(format: ReportOutputFormat) {
  const config = REPORT_OUTPUT_FORMATS[format as keyof typeof REPORT_OUTPUT_FORMATS]
  return config || REPORT_OUTPUT_FORMATS.EXCEL
}

/**
 * 取得任務狀態配置
 */
export function getJobStatusConfig(status: ReportJobStatus2) {
  const config = REPORT_JOB_STATUSES[status as keyof typeof REPORT_JOB_STATUSES]
  return config || REPORT_JOB_STATUSES.PENDING
}

/**
 * 檢查報告是否可下載
 */
export function isReportDownloadable(job: Pick<AuditReportJob, 'status' | 'expiresAt' | 'fileUrl'>): boolean {
  if (job.status !== 'COMPLETED') return false
  if (!job.fileUrl) return false
  if (job.expiresAt && new Date(job.expiresAt) < new Date()) return false
  return true
}

/**
 * 計算報告過期日期
 */
export function calculateExpiryDate(createdAt: Date = new Date()): Date {
  return new Date(createdAt.getTime() + REPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}
