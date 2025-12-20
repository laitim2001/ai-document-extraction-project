/**
 * @fileoverview 文件來源追蹤類型定義
 * @description
 *   定義文件來源資訊的資料結構，包含：
 *   - 各種來源類型的元數據結構 (SharePoint, Outlook, 手動上傳, API)
 *   - API 回應格式
 *   - 統計與搜尋相關類型
 *
 * @module src/types/document-source.types
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - SharePoint 來源元數據 (重用 sharepoint.ts 定義)
 *   - Outlook 來源元數據 (重用 outlook.ts 定義)
 *   - 手動上傳來源元數據
 *   - API 來源元數據
 *   - 來源統計類型
 *   - 來源搜尋選項
 *
 * @dependencies
 *   - @prisma/client - DocumentSourceType enum
 *   - ./sharepoint - SharePointSourceMetadata
 *   - ./outlook - OutlookSourceMetadata
 *
 * @related
 *   - src/services/document-source.service.ts - 業務邏輯
 *   - src/lib/constants/source-types.ts - 來源類型常數
 */

import { DocumentSourceType } from '@prisma/client'

// 重用現有來源元數據類型（避免重複定義）
import type { SharePointSourceMetadata } from './sharepoint'
import type { OutlookSourceMetadata } from './outlook'

// 重新導出以便統一使用
export type { SharePointSourceMetadata, OutlookSourceMetadata }

// ============================================================
// 來源元數據類型
// ============================================================

/**
 * 手動上傳來源元數據
 */
export interface ManualUploadSourceMetadata {
  /** 上傳時間 */
  uploadedAt: string
  /** 上傳者 ID */
  uploadedBy: string
  /** 上傳者名稱 */
  uploadedByName?: string
  /** 上傳方式 */
  uploadMethod: 'web' | 'api' | 'drag-drop'
  /** 原始檔案名稱 */
  originalFileName: string
  /** 來源 IP (可選) */
  sourceIp?: string
  /** User Agent (可選) */
  userAgent?: string
}

/**
 * API 來源元數據
 */
export interface ApiSourceMetadata {
  /** 提交時間 */
  submittedAt: string
  /** API Key ID */
  apiKeyId: string
  /** 系統名稱 */
  systemName?: string
  /** 請求 ID */
  requestId?: string
  /** 原始檔案名稱 */
  originalFileName: string
}

/**
 * 統一來源元數據型別
 */
export type SourceMetadata =
  | SharePointSourceMetadata
  | OutlookSourceMetadata
  | ManualUploadSourceMetadata
  | ApiSourceMetadata

// ============================================================
// API 回應類型
// ============================================================

/**
 * 文件來源資訊 (API 回應)
 */
export interface DocumentSourceInfo {
  /** 來源類型 */
  type: DocumentSourceType
  /** 顯示名稱 */
  displayName: string
  /** 圖示名稱 */
  icon: 'upload' | 'sharepoint' | 'mail' | 'api' | 'file'
  /** 詳細資訊 */
  details: SourceDetails
}

/**
 * 來源詳細資訊
 */
export interface SourceDetails {
  /** 原始檔案名稱 */
  originalFileName: string
  /** 獲取/上傳時間 */
  acquiredAt: string

  /** SharePoint 特定資訊 */
  sharepoint?: {
    siteUrl: string
    siteName?: string
    libraryPath: string
    webUrl: string
    lastModifiedDateTime?: string
  }

  /** Outlook 特定資訊 */
  outlook?: {
    senderEmail: string
    senderName?: string
    subject: string
    receivedAt: string
    attachmentIndex: number
    totalAttachments: number
  }

  /** 手動上傳特定資訊 */
  manual?: {
    uploadedBy: string
    uploadedByName?: string
    uploadMethod: string
  }

  /** API 特定資訊 */
  api?: {
    systemName?: string
    requestId?: string
    apiKeyId: string
  }
}

// ============================================================
// 統計類型
// ============================================================

/**
 * 來源類型統計
 */
export interface SourceTypeStats {
  /** 來源類型 */
  sourceType: DocumentSourceType
  /** 文件數量 */
  count: number
  /** 百分比 */
  percentage: number
}

/**
 * 來源類型趨勢資料點
 */
export interface SourceTypeTrendData {
  /** 月份 (YYYY-MM 格式) */
  month: string
  /** 手動上傳數量 */
  MANUAL_UPLOAD: number
  /** SharePoint 數量 */
  SHAREPOINT: number
  /** Outlook 數量 */
  OUTLOOK: number
  /** API 數量 */
  API: number
}

// ============================================================
// 搜尋類型
// ============================================================

/**
 * 來源搜尋選項
 */
export interface SourceSearchOptions {
  /** 來源類型篩選 */
  sourceType?: DocumentSourceType
  /** 寄件者 Email (Outlook) */
  senderEmail?: string
  /** 郵件主旨 (Outlook) */
  subject?: string
  /** SharePoint URL */
  sharepointUrl?: string
  /** 城市 ID */
  cityId?: string
  /** 頁碼 */
  page?: number
  /** 每頁數量 */
  limit?: number
}

/**
 * 來源搜尋結果
 */
export interface SourceSearchResult {
  /** 文件列表 */
  items: DocumentWithSource[]
  /** 總數 */
  total: number
  /** 頁碼 */
  page: number
  /** 每頁數量 */
  limit: number
  /** 總頁數 */
  totalPages: number
}

/**
 * 包含來源資訊的文件
 */
export interface DocumentWithSource {
  id: string
  originalFileName: string
  sourceType: DocumentSourceType
  /** 來源元數據（從 Prisma JSON 欄位返回，可能是 Record<string, unknown>） */
  sourceMetadata: SourceMetadata | Record<string, unknown> | null
  createdAt: string
  city?: {
    id: string
    name: string
    code: string
  }
  uploadedBy?: {
    id: string
    name: string | null
  }
}
