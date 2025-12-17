# Tech Spec: Story 9-5 - 自動獲取來源追蹤

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 9: 自動化文件獲取 |
| Story ID | 9.5 |
| 標題 | 自動獲取來源追蹤 |
| 優先級 | Medium |
| 估計點數 | 5 |
| 狀態 | ready-for-dev |
| 前置依賴 | Story 9-1, Story 9-3 |

---

## 目錄

1. [概述](#概述)
2. [架構設計](#架構設計)
3. [資料模型](#資料模型)
4. [型別定義](#型別定義)
5. [服務層實作](#服務層實作)
6. [API 路由設計](#api-路由設計)
7. [前端元件](#前端元件)
8. [測試規格](#測試規格)
9. [驗收標準對照](#驗收標準對照)

---

## 概述

### 功能摘要

本 Story 實作文件來源追蹤功能，讓使用者可以查看每個文件的原始來源資訊，包括 SharePoint 文件路徑、Outlook 郵件詳情等，並支援按來源類型篩選文件列表。

### 核心功能

1. **SharePoint 來源顯示** - 顯示文件路徑、站點名稱、獲取時間
2. **Outlook 來源顯示** - 顯示寄件者、主旨、收件時間、附件資訊
3. **來源類型篩選** - 支援在文件列表中按來源類型篩選
4. **來源統計圖表** - 視覺化呈現各來源類型的文件分佈

### 設計原則

- **統一資料結構** - 使用 `sourceMetadata` JSON 欄位彈性儲存各類來源資訊
- **漸進式揭露** - 先顯示來源類型徽章，點擊後展示詳細資訊
- **效能優先** - 關鍵欄位建立索引，統計查詢使用 groupBy

---

## 架構設計

### 系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                    Document Detail Page                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                Document Info Panel                         │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Invoice #12345                    [SharePoint]      │  │ │
│  │  │ Amount: $1,234.56                                   │  │ │
│  │  │ Date: 2024/01/15                                    │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │            DocumentSourceDetails Component                 │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ 來源資訊                         [SharePoint]        │  │ │
│  │  │ ─────────────────────────────────────────────────── │  │ │
│  │  │ 📄 原始檔名：invoice_202401.pdf                      │  │ │
│  │  │ 📅 獲取時間：2024/01/15 10:30                        │  │ │
│  │  │ ─────────────────────────────────────────────────── │  │ │
│  │  │ SharePoint 詳情                                      │  │ │
│  │  │ 📁 站點：Finance Portal                              │  │ │
│  │  │ 📁 路徑：/Invoices/2024/January                      │  │ │
│  │  │ 🔗 在 SharePoint 中查看                              │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Document List Page                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Filters:                                                   │ │
│  │ [SourceTypeFilter ▼] [City ▼] [Date Range] [Search...]    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ │ File Name        │ Source      │ City   │ Date      │   │ │
│  │ ├──────────────────┼─────────────┼────────┼───────────┤   │ │
│  │ │ invoice_001.pdf  │ [SharePoint]│ Taipei │ 2024/01/15│   │ │
│  │ │ receipt_002.pdf  │ [Outlook]   │ Tokyo  │ 2024/01/14│   │ │
│  │ │ bill_003.pdf     │ [手動上傳]  │ Taipei │ 2024/01/13│   │ │
│  │ └──────────────────┴─────────────┴────────┴───────────┘   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Dashboard / Reports                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              SourceTypeStats Component                     │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ 文件來源分佈                                         │  │ │
│  │  │                                                     │  │ │
│  │  │     ╭──────╮   ● 手動上傳  50 (50%)                 │  │ │
│  │  │    ╱        ╲  ● SharePoint 30 (30%)               │  │ │
│  │  │   │  Pie    │  ● Outlook    20 (20%)               │  │ │
│  │  │   │  Chart  │  ─────────────────────               │  │ │
│  │  │    ╲        ╱  總計: 100 個文件                     │  │ │
│  │  │     ╰──────╯                                        │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 資料流程

```
┌──────────────────────────────────────────────────────────────────┐
│                 來源資訊查詢流程                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User ──────────────────────────────────────────────────────┐    │
│    │                                                        │    │
│    │ 1. 查看文件詳情                                        │    │
│    │                                                        │    │
│    ▼                                                        │    │
│  ┌──────────────────────────┐                               │    │
│  │   DocumentSourceDetails │                               │    │
│  │   useQuery()            │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 2. GET /api/documents/:id/source            │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   DocumentSourceService │                               │    │
│  │   getSourceInfo()       │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 3. 查詢 Document + sourceMetadata           │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   Prisma / Database     │                               │    │
│  │   Document.findUnique() │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 4. 根據 sourceType 建構回應                  │    │
│               │    - SHAREPOINT → SharePoint details        │    │
│               │    - OUTLOOK → Outlook details              │    │
│               │    - MANUAL_UPLOAD → Upload details         │    │
│               │    - API → API details                      │    │
│               ▼                                             │    │
│  User ◄────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                 來源篩選流程                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User ──────────────────────────────────────────────────────┐    │
│    │                                                        │    │
│    │ 1. 選擇來源類型 (SharePoint)                           │    │
│    ▼                                                        │    │
│  ┌──────────────────────────┐                               │    │
│  │   SourceTypeFilter      │                               │    │
│  │   onChange()            │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 2. 更新 URL query params                    │    │
│               │    ?sourceType=SHAREPOINT                   │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   DocumentList          │                               │    │
│  │   useQuery() with       │                               │    │
│  │   sourceType filter     │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 3. GET /api/documents/search                │    │
│               │    ?sourceType=SHAREPOINT                   │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   DocumentSourceService │                               │    │
│  │   searchBySource()      │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 4. WHERE sourceType = 'SHAREPOINT'          │    │
│               ▼                                             │    │
│  ┌──────────────────────────┐                               │    │
│  │   Filtered Results      │                               │    │
│  └────────────┬─────────────┘                               │    │
│               │                                             │    │
│               │ 5. 顯示篩選後的文件列表                      │    │
│               ▼                                             │    │
│  User ◄────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 資料模型

### Document 模型來源欄位 (已定義於 Story 9-1)

```prisma
// prisma/schema.prisma

// ============================================
// 文件來源類型
// ============================================
enum DocumentSourceType {
  MANUAL_UPLOAD   // 手動上傳
  SHAREPOINT      // SharePoint 自動獲取
  OUTLOOK         // Outlook 郵件附件
  API             // 外部 API 提交
}

// ============================================
// Document 模型 (來源追蹤欄位)
// ============================================
model Document {
  id                String    @id @default(cuid())

  // ... 其他欄位 ...

  // 來源追蹤
  sourceType        DocumentSourceType  @default(MANUAL_UPLOAD)
  sourceMetadata    Json?               // 彈性儲存來源詳細資訊

  // SharePoint 特定欄位 (便於查詢)
  sharepointItemId  String?             // SharePoint 項目 ID
  sharepointDriveId String?             // SharePoint 驅動器 ID
  sharepointSiteId  String?             // SharePoint 站點 ID
  sharepointUrl     String?             // SharePoint Web URL

  // 索引
  @@index([sourceType])
  @@index([sharepointItemId])
  @@map("documents")
}
```

### sourceMetadata JSON 結構

```typescript
// types/document-source.types.ts

/**
 * SharePoint 來源元數據
 */
export interface SharePointSourceMetadata {
  /** SharePoint Web URL */
  sharepointUrl: string
  /** 完整 Web URL (可直接開啟) */
  webUrl: string
  /** 站點名稱 */
  siteName?: string
  /** 文件庫名稱 */
  libraryName?: string
  /** 資料夾路徑 */
  folderPath?: string
  /** 檔案建立時間 */
  createdDateTime: string
  /** 最後修改時間 */
  lastModifiedDateTime: string
  /** 獲取時間 */
  fetchedAt: string
  /** 關聯的 FetchLog ID */
  fetchLogId: string
  /** SharePoint Config ID */
  configId?: string
}

/**
 * Outlook 來源元數據
 */
export interface OutlookSourceMetadata {
  /** 郵件 ID (如果使用 MESSAGE_ID 模式) */
  messageId?: string
  /** 郵件主旨 */
  subject: string
  /** 寄件者 Email */
  senderEmail: string
  /** 寄件者名稱 */
  senderName?: string
  /** 收件時間 */
  receivedAt: string
  /** 附件原始名稱 */
  attachmentName: string
  /** 附件索引 (0-based) */
  attachmentIndex: number
  /** 郵件總附件數 */
  totalAttachments: number
  /** 獲取時間 */
  fetchedAt: string
  /** 關聯的 FetchLog ID */
  fetchLogId: string
  /** Outlook Config ID */
  configId?: string
}

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
```

---

## 型別定義

### 來源資訊型別

```typescript
// types/document-source.types.ts

import { DocumentSourceType } from '@prisma/client'

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
  sourceMetadata: SourceMetadata | null
  createdAt: string
  city?: {
    id: string
    name: string
    code: string
  }
  uploadedBy?: {
    id: string
    name: string
  }
}
```

### 來源配置常數

```typescript
// lib/constants/source-types.ts

import { DocumentSourceType } from '@prisma/client'

/**
 * 來源類型配置
 */
export const SOURCE_TYPE_CONFIG: Record<DocumentSourceType, {
  label: string
  labelEn: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  MANUAL_UPLOAD: {
    label: '手動上傳',
    labelEn: 'Manual Upload',
    icon: 'Upload',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300'
  },
  SHAREPOINT: {
    label: 'SharePoint',
    labelEn: 'SharePoint',
    icon: 'FileSpreadsheet',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300'
  },
  OUTLOOK: {
    label: 'Outlook 郵件',
    labelEn: 'Outlook',
    icon: 'Mail',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    borderColor: 'border-cyan-300'
  },
  API: {
    label: '外部 API',
    labelEn: 'External API',
    icon: 'Globe',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300'
  }
}

/**
 * 圖表顏色
 */
export const SOURCE_TYPE_CHART_COLORS: Record<DocumentSourceType, string> = {
  MANUAL_UPLOAD: '#6b7280',
  SHAREPOINT: '#3b82f6',
  OUTLOOK: '#06b6d4',
  API: '#8b5cf6'
}

/**
 * 來源類型選項 (用於篩選器)
 */
export const SOURCE_TYPE_OPTIONS = [
  { value: '', label: '所有來源' },
  { value: 'MANUAL_UPLOAD', label: '手動上傳' },
  { value: 'SHAREPOINT', label: 'SharePoint' },
  { value: 'OUTLOOK', label: 'Outlook 郵件' },
  { value: 'API', label: '外部 API' }
] as const
```

---

## 服務層實作

### DocumentSourceService

```typescript
// lib/services/document-source.service.ts

import { PrismaClient, Document, DocumentSourceType, Prisma } from '@prisma/client'
import {
  DocumentSourceInfo,
  SourceDetails,
  SourceTypeStats,
  SourceSearchOptions,
  SourceSearchResult,
  SharePointSourceMetadata,
  OutlookSourceMetadata,
  ManualUploadSourceMetadata,
  ApiSourceMetadata
} from '@/types/document-source.types'

export class DocumentSourceService {
  constructor(private prisma: PrismaClient) {}

  // ============================================
  // 來源資訊查詢
  // ============================================

  /**
   * 獲取文件來源資訊
   */
  async getSourceInfo(documentId: string): Promise<DocumentSourceInfo | null> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } }
      }
    })

    if (!document) return null

    const metadata = (document.sourceMetadata as Record<string, any>) || {}

    switch (document.sourceType) {
      case 'SHAREPOINT':
        return this.buildSharePointSourceInfo(document, metadata as SharePointSourceMetadata)
      case 'OUTLOOK':
        return this.buildOutlookSourceInfo(document, metadata as OutlookSourceMetadata)
      case 'MANUAL_UPLOAD':
        return this.buildManualSourceInfo(document, metadata as ManualUploadSourceMetadata)
      case 'API':
        return this.buildApiSourceInfo(document, metadata as ApiSourceMetadata)
      default:
        return this.buildDefaultSourceInfo(document)
    }
  }

  /**
   * 建構 SharePoint 來源資訊
   */
  private buildSharePointSourceInfo(
    document: Document,
    metadata: SharePointSourceMetadata
  ): DocumentSourceInfo {
    return {
      type: 'SHAREPOINT',
      displayName: 'SharePoint',
      icon: 'sharepoint',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: metadata.fetchedAt || document.createdAt.toISOString(),
        sharepoint: {
          siteUrl: document.sharepointUrl || metadata.sharepointUrl || '',
          siteName: metadata.siteName,
          libraryPath: this.buildLibraryPath(metadata),
          webUrl: metadata.webUrl || '',
          lastModifiedDateTime: metadata.lastModifiedDateTime
        }
      }
    }
  }

  /**
   * 建構 Outlook 來源資訊
   */
  private buildOutlookSourceInfo(
    document: Document,
    metadata: OutlookSourceMetadata
  ): DocumentSourceInfo {
    return {
      type: 'OUTLOOK',
      displayName: 'Outlook 郵件',
      icon: 'mail',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: metadata.fetchedAt || document.createdAt.toISOString(),
        outlook: {
          senderEmail: metadata.senderEmail || '',
          senderName: metadata.senderName,
          subject: metadata.subject || '',
          receivedAt: metadata.receivedAt || '',
          attachmentIndex: metadata.attachmentIndex ?? 0,
          totalAttachments: metadata.totalAttachments ?? 1
        }
      }
    }
  }

  /**
   * 建構手動上傳來源資訊
   */
  private buildManualSourceInfo(
    document: Document & { uploadedBy?: { id: string; name: string; email: string } | null },
    metadata: ManualUploadSourceMetadata
  ): DocumentSourceInfo {
    return {
      type: 'MANUAL_UPLOAD',
      displayName: '手動上傳',
      icon: 'upload',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: metadata.uploadedAt || document.createdAt.toISOString(),
        manual: {
          uploadedBy: document.uploadedById || '',
          uploadedByName: document.uploadedBy?.name || metadata.uploadedByName || '未知',
          uploadMethod: this.getUploadMethodLabel(metadata.uploadMethod)
        }
      }
    }
  }

  /**
   * 建構 API 來源資訊
   */
  private buildApiSourceInfo(
    document: Document,
    metadata: ApiSourceMetadata
  ): DocumentSourceInfo {
    return {
      type: 'API',
      displayName: '外部 API',
      icon: 'api',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: metadata.submittedAt || document.createdAt.toISOString(),
        api: {
          systemName: metadata.systemName,
          requestId: metadata.requestId,
          apiKeyId: metadata.apiKeyId
        }
      }
    }
  }

  /**
   * 建構預設來源資訊
   */
  private buildDefaultSourceInfo(document: Document): DocumentSourceInfo {
    return {
      type: 'MANUAL_UPLOAD',
      displayName: '未知來源',
      icon: 'file',
      details: {
        originalFileName: document.originalFileName,
        acquiredAt: document.createdAt.toISOString()
      }
    }
  }

  // ============================================
  // 統計查詢
  // ============================================

  /**
   * 獲取來源類型統計
   */
  async getSourceTypeStats(options?: {
    cityId?: string
    dateFrom?: Date
    dateTo?: Date
  }): Promise<SourceTypeStats[]> {
    const where: Prisma.DocumentWhereInput = {
      isDeleted: false
    }

    if (options?.cityId) {
      where.cityId = options.cityId
    }

    if (options?.dateFrom || options?.dateTo) {
      where.createdAt = {}
      if (options.dateFrom) {
        where.createdAt.gte = options.dateFrom
      }
      if (options.dateTo) {
        where.createdAt.lte = options.dateTo
      }
    }

    const stats = await this.prisma.document.groupBy({
      by: ['sourceType'],
      where,
      _count: { _all: true }
    })

    const total = stats.reduce((sum, s) => sum + s._count._all, 0)

    return stats.map(s => ({
      sourceType: s.sourceType,
      count: s._count._all,
      percentage: total > 0 ? Math.round((s._count._all / total) * 100) : 0
    }))
  }

  /**
   * 獲取來源類型趨勢 (按月)
   */
  async getSourceTypeTrend(options?: {
    cityId?: string
    months?: number
  }): Promise<Array<{
    month: string
    MANUAL_UPLOAD: number
    SHAREPOINT: number
    OUTLOOK: number
    API: number
  }>> {
    const monthsCount = options?.months || 6
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsCount)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    const where: Prisma.DocumentWhereInput = {
      isDeleted: false,
      createdAt: { gte: startDate }
    }

    if (options?.cityId) {
      where.cityId = options.cityId
    }

    const documents = await this.prisma.document.findMany({
      where,
      select: {
        sourceType: true,
        createdAt: true
      }
    })

    // 按月分組
    const monthlyData: Record<string, Record<DocumentSourceType, number>> = {}

    documents.forEach(doc => {
      const monthKey = `${doc.createdAt.getFullYear()}-${String(doc.createdAt.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          MANUAL_UPLOAD: 0,
          SHAREPOINT: 0,
          OUTLOOK: 0,
          API: 0
        }
      }

      monthlyData[monthKey][doc.sourceType]++
    })

    // 轉換為陣列並排序
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data
      }))
  }

  // ============================================
  // 搜尋與篩選
  // ============================================

  /**
   * 按來源搜尋文件
   */
  async searchBySource(options: SourceSearchOptions): Promise<SourceSearchResult> {
    const { page = 1, limit = 20 } = options
    const where: Prisma.DocumentWhereInput = {
      isDeleted: false
    }

    // 來源類型篩選
    if (options.sourceType) {
      where.sourceType = options.sourceType
    }

    // 城市篩選
    if (options.cityId) {
      where.cityId = options.cityId
    }

    // Outlook 特定搜尋 - 寄件者 Email
    if (options.senderEmail) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          sourceType: 'OUTLOOK',
          sourceMetadata: {
            path: ['senderEmail'],
            string_contains: options.senderEmail
          }
        }
      ]
    }

    // Outlook 特定搜尋 - 主旨
    if (options.subject) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          sourceType: 'OUTLOOK',
          sourceMetadata: {
            path: ['subject'],
            string_contains: options.subject
          }
        }
      ]
    }

    // SharePoint 特定搜尋
    if (options.sharepointUrl) {
      where.sharepointUrl = { contains: options.sharepointUrl }
    }

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          city: { select: { id: true, name: true, code: true } },
          uploadedBy: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.document.count({ where })
    ])

    return {
      items: items.map(item => ({
        id: item.id,
        originalFileName: item.originalFileName,
        sourceType: item.sourceType,
        sourceMetadata: item.sourceMetadata as any,
        createdAt: item.createdAt.toISOString(),
        city: item.city || undefined,
        uploadedBy: item.uploadedBy || undefined
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }

  // ============================================
  // 輔助方法
  // ============================================

  /**
   * 建構文件庫路徑
   */
  private buildLibraryPath(metadata: SharePointSourceMetadata): string {
    const parts: string[] = []
    if (metadata.libraryName) parts.push(metadata.libraryName)
    if (metadata.folderPath) parts.push(metadata.folderPath)
    return parts.join('/') || '/'
  }

  /**
   * 獲取上傳方式標籤
   */
  private getUploadMethodLabel(method?: string): string {
    switch (method) {
      case 'web': return '網頁上傳'
      case 'drag-drop': return '拖曳上傳'
      case 'api': return 'API 上傳'
      default: return '未知'
    }
  }
}
```

---

## API 路由設計

### 文件來源資訊 API

```typescript
// app/api/documents/[documentId]/source/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSourceService } from '@/lib/services/document-source.service'

interface RouteParams {
  params: Promise<{ documentId: string }>
}

/**
 * GET /api/documents/:documentId/source
 * 獲取文件來源資訊
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '請先登入' },
        { status: 401 }
      )
    }

    const { documentId } = await params
    const service = new DocumentSourceService(prisma)
    const sourceInfo = await service.getSourceInfo(documentId)

    if (!sourceInfo) {
      return NextResponse.json(
        { error: 'NotFound', message: '找不到指定的文件' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: sourceInfo
    })

  } catch (error) {
    console.error('Failed to fetch document source info:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取來源資訊失敗' },
      { status: 500 }
    )
  }
}
```

### 來源統計 API

```typescript
// app/api/documents/sources/stats/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSourceService } from '@/lib/services/document-source.service'

/**
 * GET /api/documents/sources/stats
 * 獲取來源類型統計
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '請先登入' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId') || undefined
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const service = new DocumentSourceService(prisma)
    const stats = await service.getSourceTypeStats({
      cityId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined
    })

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Failed to fetch source type stats:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取統計資料失敗' },
      { status: 500 }
    )
  }
}
```

### 來源趨勢 API

```typescript
// app/api/documents/sources/trend/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSourceService } from '@/lib/services/document-source.service'

/**
 * GET /api/documents/sources/trend
 * 獲取來源類型趨勢
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '請先登入' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId') || undefined
    const months = parseInt(searchParams.get('months') || '6')

    const service = new DocumentSourceService(prisma)
    const trend = await service.getSourceTypeTrend({
      cityId,
      months: Math.min(months, 12) // 最多 12 個月
    })

    return NextResponse.json({
      success: true,
      data: trend
    })

  } catch (error) {
    console.error('Failed to fetch source type trend:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '獲取趨勢資料失敗' },
      { status: 500 }
    )
  }
}
```

### 文件搜尋 API (擴展來源篩選)

```typescript
// app/api/documents/search/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DocumentSourceService } from '@/lib/services/document-source.service'
import { DocumentSourceType } from '@prisma/client'

/**
 * GET /api/documents/search
 * 搜尋文件 (支援來源篩選)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '請先登入' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    const sourceService = new DocumentSourceService(prisma)
    const result = await sourceService.searchBySource({
      sourceType: (searchParams.get('sourceType') as DocumentSourceType) || undefined,
      senderEmail: searchParams.get('senderEmail') || undefined,
      subject: searchParams.get('subject') || undefined,
      sharepointUrl: searchParams.get('sharepointUrl') || undefined,
      cityId: searchParams.get('cityId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Failed to search documents:', error)
    return NextResponse.json(
      { error: 'InternalError', message: '搜尋文件失敗' },
      { status: 500 }
    )
  }
}
```

---

## 前端元件

### DocumentSourceBadge

```typescript
// components/documents/DocumentSourceBadge.tsx

'use client'

import { DocumentSourceType } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Upload, Mail, FileSpreadsheet, Globe, HelpCircle } from 'lucide-react'
import { SOURCE_TYPE_CONFIG } from '@/lib/constants/source-types'

interface Props {
  /** 來源類型 */
  sourceType: DocumentSourceType | string
  /** 工具提示內容 */
  tooltip?: string
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 是否顯示文字 */
  showLabel?: boolean
}

const ICON_MAP = {
  Upload,
  Mail,
  FileSpreadsheet,
  Globe,
  HelpCircle
}

export function DocumentSourceBadge({
  sourceType,
  tooltip,
  size = 'md',
  showLabel = true
}: Props) {
  const config = SOURCE_TYPE_CONFIG[sourceType as DocumentSourceType] || {
    label: '未知',
    icon: 'HelpCircle',
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300'
  }

  const Icon = ICON_MAP[config.icon as keyof typeof ICON_MAP] || HelpCircle

  const sizeClasses = {
    sm: 'text-xs py-0 px-1.5',
    md: 'text-sm py-0.5 px-2',
    lg: 'text-base py-1 px-3'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  }

  const badge = (
    <Badge
      variant="outline"
      className={`
        gap-1 font-normal
        ${config.bgColor} ${config.borderColor}
        ${sizeClasses[size]}
      `}
    >
      <Icon className={`${iconSizes[size]} ${config.color}`} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
```

### DocumentSourceDetails

```typescript
// components/documents/DocumentSourceDetails.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentSourceBadge } from './DocumentSourceBadge'
import {
  FileText,
  Calendar,
  User,
  Mail,
  Link2,
  Folder,
  Clock,
  Paperclip,
  Upload,
  Globe,
  ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { DocumentSourceInfo } from '@/types/document-source.types'

interface Props {
  /** 文件 ID */
  documentId: string
  /** 是否為卡片模式 */
  asCard?: boolean
}

export function DocumentSourceDetails({ documentId, asCard = true }: Props) {
  const { data: sourceInfo, isLoading, error } = useQuery<{ data: DocumentSourceInfo }>({
    queryKey: ['document-source', documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/source`)
      if (!response.ok) throw new Error('Failed to fetch source info')
      return response.json()
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (error || !sourceInfo?.data) {
    return null
  }

  const { data } = sourceInfo
  const { details } = data

  const content = (
    <div className="space-y-4">
      {/* 共用資訊 */}
      <div className="space-y-2">
        <DetailRow
          icon={<FileText className="h-4 w-4" />}
          label="原始檔名"
          value={details.originalFileName}
        />
        <DetailRow
          icon={<Calendar className="h-4 w-4" />}
          label="獲取時間"
          value={formatDateTime(details.acquiredAt)}
        />
      </div>

      {/* SharePoint 詳情 */}
      {details.sharepoint && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            SharePoint 詳情
          </h4>
          <div className="space-y-2 pl-6">
            {details.sharepoint.siteName && (
              <DetailRow
                icon={<Folder className="h-4 w-4" />}
                label="站點"
                value={details.sharepoint.siteName}
              />
            )}
            {details.sharepoint.libraryPath && (
              <DetailRow
                icon={<Folder className="h-4 w-4" />}
                label="路徑"
                value={details.sharepoint.libraryPath}
              />
            )}
            {details.sharepoint.lastModifiedDateTime && (
              <DetailRow
                icon={<Clock className="h-4 w-4" />}
                label="最後修改"
                value={formatDateTime(details.sharepoint.lastModifiedDateTime)}
              />
            )}
            {details.sharepoint.webUrl && (
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <a
                  href={details.sharepoint.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  在 SharePoint 中查看
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outlook 詳情 */}
      {details.outlook && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-cyan-600" />
            郵件詳情
          </h4>
          <div className="space-y-2 pl-6">
            <DetailRow
              icon={<User className="h-4 w-4" />}
              label="寄件者"
              value={
                details.outlook.senderName
                  ? `${details.outlook.senderName} <${details.outlook.senderEmail}>`
                  : details.outlook.senderEmail
              }
            />
            <DetailRow
              icon={<Mail className="h-4 w-4" />}
              label="主旨"
              value={details.outlook.subject}
            />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="收件時間"
              value={formatDateTime(details.outlook.receivedAt)}
            />
            {details.outlook.totalAttachments > 1 && (
              <DetailRow
                icon={<Paperclip className="h-4 w-4" />}
                label="附件"
                value={`第 ${details.outlook.attachmentIndex + 1} 個，共 ${details.outlook.totalAttachments} 個`}
              />
            )}
          </div>
        </div>
      )}

      {/* 手動上傳詳情 */}
      {details.manual && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-gray-600" />
            上傳詳情
          </h4>
          <div className="space-y-2 pl-6">
            <DetailRow
              icon={<User className="h-4 w-4" />}
              label="上傳者"
              value={details.manual.uploadedByName || '未知'}
            />
            <DetailRow
              icon={<Upload className="h-4 w-4" />}
              label="上傳方式"
              value={details.manual.uploadMethod}
            />
          </div>
        </div>
      )}

      {/* API 詳情 */}
      {details.api && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-600" />
            API 詳情
          </h4>
          <div className="space-y-2 pl-6">
            {details.api.systemName && (
              <DetailRow
                icon={<Globe className="h-4 w-4" />}
                label="系統"
                value={details.api.systemName}
              />
            )}
            {details.api.requestId && (
              <DetailRow
                icon={<FileText className="h-4 w-4" />}
                label="請求 ID"
                value={details.api.requestId}
                mono
              />
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (!asCard) {
    return content
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">來源資訊</CardTitle>
          <DocumentSourceBadge sourceType={data.type} />
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

// 詳情列元件
function DetailRow({
  icon,
  label,
  value,
  mono = false
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0">{label}：</span>
      <span className={`break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  )
}

// 日期格式化
function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'yyyy/MM/dd HH:mm', { locale: zhTW })
  } catch {
    return dateStr
  }
}

// 需要的圖示
import { FileSpreadsheet } from 'lucide-react'
```

### SourceTypeFilter

```typescript
// components/documents/SourceTypeFilter.tsx

'use client'

import { DocumentSourceType } from '@prisma/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Upload, Mail, FileSpreadsheet, Globe, Filter } from 'lucide-react'
import { SOURCE_TYPE_OPTIONS } from '@/lib/constants/source-types'

interface Props {
  /** 當前選擇的值 */
  value: string
  /** 變更事件 */
  onChange: (value: string) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 佔位符 */
  placeholder?: string
}

const ICON_MAP = {
  '': Filter,
  MANUAL_UPLOAD: Upload,
  SHAREPOINT: FileSpreadsheet,
  OUTLOOK: Mail,
  API: Globe
}

export function SourceTypeFilter({
  value,
  onChange,
  disabled = false,
  placeholder = '篩選來源'
}: Props) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {SOURCE_TYPE_OPTIONS.map((option) => {
          const Icon = ICON_MAP[option.value as keyof typeof ICON_MAP] || Filter
          return (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
```

### SourceTypeStats

```typescript
// components/documents/SourceTypeStats.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'
import {
  SOURCE_TYPE_CONFIG,
  SOURCE_TYPE_CHART_COLORS
} from '@/lib/constants/source-types'
import { DocumentSourceType } from '@prisma/client'
import { SourceTypeStats as StatsType } from '@/types/document-source.types'

interface Props {
  /** 城市 ID 篩選 */
  cityId?: string
  /** 開始日期 */
  dateFrom?: Date
  /** 結束日期 */
  dateTo?: Date
  /** 標題 */
  title?: string
}

export function SourceTypeStats({
  cityId,
  dateFrom,
  dateTo,
  title = '文件來源分佈'
}: Props) {
  const { data, isLoading } = useQuery<{ data: StatsType[] }>({
    queryKey: [
      'source-type-stats',
      cityId,
      dateFrom?.toISOString(),
      dateTo?.toISOString()
    ],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cityId) params.set('cityId', cityId)
      if (dateFrom) params.set('dateFrom', dateFrom.toISOString())
      if (dateTo) params.set('dateTo', dateTo.toISOString())

      const response = await fetch(`/api/documents/sources/stats?${params}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const stats = data?.data || []
  const total = stats.reduce((sum, s) => sum + s.count, 0)

  const chartData = stats.map(s => ({
    name: SOURCE_TYPE_CONFIG[s.sourceType as DocumentSourceType]?.label || s.sourceType,
    value: s.count,
    percentage: s.percentage,
    fill: SOURCE_TYPE_CHART_COLORS[s.sourceType as DocumentSourceType] || '#94a3b8'
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            暫無資料
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {/* 圓餅圖 */}
            <div className="w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} 個文件`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 圖例與數據 */}
            <div className="flex-1 space-y-3">
              {chartData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {item.value}
                    </span>
                    {' '}({item.percentage}%)
                  </div>
                </div>
              ))}

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between font-medium">
                  <span>總計</span>
                  <span>{total} 個文件</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### SourceTypeTrend

```typescript
// components/documents/SourceTypeTrend.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  SOURCE_TYPE_CONFIG,
  SOURCE_TYPE_CHART_COLORS
} from '@/lib/constants/source-types'

interface Props {
  /** 城市 ID 篩選 */
  cityId?: string
  /** 顯示月數 */
  months?: number
  /** 標題 */
  title?: string
}

export function SourceTypeTrend({
  cityId,
  months = 6,
  title = '來源類型趨勢'
}: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['source-type-trend', cityId, months],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cityId) params.set('cityId', cityId)
      params.set('months', months.toString())

      const response = await fetch(`/api/documents/sources/trend?${params}`)
      if (!response.ok) throw new Error('Failed to fetch trend')
      return response.json()
    }
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  const trendData = data?.data || []

  if (trendData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            暫無資料
          </div>
        </CardContent>
      </Card>
    )
  }

  // 格式化月份
  const formattedData = trendData.map((item: any) => ({
    ...item,
    month: formatMonth(item.month)
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="MANUAL_UPLOAD"
                name={SOURCE_TYPE_CONFIG.MANUAL_UPLOAD.label}
                fill={SOURCE_TYPE_CHART_COLORS.MANUAL_UPLOAD}
                stackId="stack"
              />
              <Bar
                dataKey="SHAREPOINT"
                name={SOURCE_TYPE_CONFIG.SHAREPOINT.label}
                fill={SOURCE_TYPE_CHART_COLORS.SHAREPOINT}
                stackId="stack"
              />
              <Bar
                dataKey="OUTLOOK"
                name={SOURCE_TYPE_CONFIG.OUTLOOK.label}
                fill={SOURCE_TYPE_CHART_COLORS.OUTLOOK}
                stackId="stack"
              />
              <Bar
                dataKey="API"
                name={SOURCE_TYPE_CONFIG.API.label}
                fill={SOURCE_TYPE_CHART_COLORS.API}
                stackId="stack"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  return `${year}/${month}`
}
```

---

## 測試規格

### 單元測試

```typescript
// __tests__/services/document-source.service.test.ts

import { DocumentSourceService } from '@/lib/services/document-source.service'
import { PrismaClient, DocumentSourceType } from '@prisma/client'
import { mockDeep, DeepMockProxy } from 'jest-mock-extended'

describe('DocumentSourceService', () => {
  let service: DocumentSourceService
  let prisma: DeepMockProxy<PrismaClient>

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    service = new DocumentSourceService(prisma)
  })

  describe('getSourceInfo', () => {
    it('should return SharePoint source info correctly', async () => {
      const mockDocument = {
        id: 'doc-1',
        originalFileName: 'invoice.pdf',
        sourceType: 'SHAREPOINT' as DocumentSourceType,
        sourceMetadata: {
          sharepointUrl: 'https://company.sharepoint.com/sites/Finance',
          webUrl: 'https://company.sharepoint.com/sites/Finance/Documents/invoice.pdf',
          siteName: 'Finance Portal',
          libraryName: 'Documents',
          folderPath: '/Invoices/2024',
          fetchedAt: '2024-01-15T10:00:00Z',
          lastModifiedDateTime: '2024-01-14T15:30:00Z'
        },
        sharepointUrl: 'https://company.sharepoint.com/sites/Finance',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        uploadedBy: null
      }

      prisma.document.findUnique.mockResolvedValue(mockDocument as any)

      const result = await service.getSourceInfo('doc-1')

      expect(result).not.toBeNull()
      expect(result?.type).toBe('SHAREPOINT')
      expect(result?.displayName).toBe('SharePoint')
      expect(result?.icon).toBe('sharepoint')
      expect(result?.details.originalFileName).toBe('invoice.pdf')
      expect(result?.details.sharepoint).toBeDefined()
      expect(result?.details.sharepoint?.siteName).toBe('Finance Portal')
      expect(result?.details.sharepoint?.libraryPath).toBe('Documents//Invoices/2024')
    })

    it('should return Outlook source info correctly', async () => {
      const mockDocument = {
        id: 'doc-2',
        originalFileName: 'receipt.pdf',
        sourceType: 'OUTLOOK' as DocumentSourceType,
        sourceMetadata: {
          senderEmail: 'vendor@example.com',
          senderName: 'Vendor Company',
          subject: 'Invoice for October 2024',
          receivedAt: '2024-01-15T09:00:00Z',
          attachmentIndex: 0,
          totalAttachments: 2,
          fetchedAt: '2024-01-15T09:30:00Z'
        },
        createdAt: new Date('2024-01-15T09:30:00Z'),
        uploadedBy: null
      }

      prisma.document.findUnique.mockResolvedValue(mockDocument as any)

      const result = await service.getSourceInfo('doc-2')

      expect(result).not.toBeNull()
      expect(result?.type).toBe('OUTLOOK')
      expect(result?.displayName).toBe('Outlook 郵件')
      expect(result?.icon).toBe('mail')
      expect(result?.details.outlook).toBeDefined()
      expect(result?.details.outlook?.senderEmail).toBe('vendor@example.com')
      expect(result?.details.outlook?.subject).toBe('Invoice for October 2024')
      expect(result?.details.outlook?.totalAttachments).toBe(2)
    })

    it('should return manual upload source info correctly', async () => {
      const mockDocument = {
        id: 'doc-3',
        originalFileName: 'bill.pdf',
        sourceType: 'MANUAL_UPLOAD' as DocumentSourceType,
        sourceMetadata: {
          uploadedAt: '2024-01-15T08:00:00Z',
          uploadMethod: 'drag-drop'
        },
        uploadedById: 'user-1',
        uploadedBy: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
        createdAt: new Date('2024-01-15T08:00:00Z')
      }

      prisma.document.findUnique.mockResolvedValue(mockDocument as any)

      const result = await service.getSourceInfo('doc-3')

      expect(result).not.toBeNull()
      expect(result?.type).toBe('MANUAL_UPLOAD')
      expect(result?.displayName).toBe('手動上傳')
      expect(result?.details.manual).toBeDefined()
      expect(result?.details.manual?.uploadedByName).toBe('John Doe')
      expect(result?.details.manual?.uploadMethod).toBe('拖曳上傳')
    })

    it('should return null for non-existent document', async () => {
      prisma.document.findUnique.mockResolvedValue(null)

      const result = await service.getSourceInfo('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getSourceTypeStats', () => {
    it('should return correct statistics', async () => {
      prisma.document.groupBy.mockResolvedValue([
        { sourceType: 'MANUAL_UPLOAD' as DocumentSourceType, _count: { _all: 50 } },
        { sourceType: 'SHAREPOINT' as DocumentSourceType, _count: { _all: 30 } },
        { sourceType: 'OUTLOOK' as DocumentSourceType, _count: { _all: 20 } }
      ] as any)

      const result = await service.getSourceTypeStats()

      expect(result).toHaveLength(3)
      expect(result.find(s => s.sourceType === 'MANUAL_UPLOAD')?.count).toBe(50)
      expect(result.find(s => s.sourceType === 'MANUAL_UPLOAD')?.percentage).toBe(50)
      expect(result.find(s => s.sourceType === 'SHAREPOINT')?.count).toBe(30)
      expect(result.find(s => s.sourceType === 'SHAREPOINT')?.percentage).toBe(30)
      expect(result.find(s => s.sourceType === 'OUTLOOK')?.count).toBe(20)
      expect(result.find(s => s.sourceType === 'OUTLOOK')?.percentage).toBe(20)
    })

    it('should filter by city', async () => {
      await service.getSourceTypeStats({ cityId: 'city-1' })

      expect(prisma.document.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cityId: 'city-1'
          })
        })
      )
    })

    it('should filter by date range', async () => {
      const dateFrom = new Date('2024-01-01')
      const dateTo = new Date('2024-01-31')

      await service.getSourceTypeStats({ dateFrom, dateTo })

      expect(prisma.document.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: dateFrom,
              lte: dateTo
            }
          })
        })
      )
    })
  })

  describe('searchBySource', () => {
    it('should filter by source type', async () => {
      prisma.document.findMany.mockResolvedValue([])
      prisma.document.count.mockResolvedValue(0)

      await service.searchBySource({ sourceType: 'SHAREPOINT' })

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceType: 'SHAREPOINT'
          })
        })
      )
    })

    it('should paginate results correctly', async () => {
      prisma.document.findMany.mockResolvedValue([])
      prisma.document.count.mockResolvedValue(100)

      const result = await service.searchBySource({ page: 3, limit: 20 })

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20
        })
      )
      expect(result.totalPages).toBe(5)
    })
  })
})
```

### API 測試

```typescript
// __tests__/api/documents/source.test.ts

import { createMocks } from 'node-mocks-http'
import { GET } from '@/app/api/documents/[documentId]/source/route'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: jest.fn()
    }
  }
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

describe('GET /api/documents/:documentId/source', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 for unauthenticated requests', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const { req } = createMocks({ method: 'GET' })
    const response = await GET(req as any, { params: Promise.resolve({ documentId: 'doc-1' }) })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 404 for non-existent document', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.document.findUnique as jest.Mock).mockResolvedValue(null)

    const { req } = createMocks({ method: 'GET' })
    const response = await GET(req as any, { params: Promise.resolve({ documentId: 'non-existent' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('NotFound')
  })

  it('should return source info for valid document', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      originalFileName: 'test.pdf',
      sourceType: 'MANUAL_UPLOAD',
      sourceMetadata: { uploadMethod: 'web' },
      createdAt: new Date(),
      uploadedBy: { id: 'user-1', name: 'Test User' }
    })

    const { req } = createMocks({ method: 'GET' })
    const response = await GET(req as any, { params: Promise.resolve({ documentId: 'doc-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.type).toBe('MANUAL_UPLOAD')
    expect(data.data.displayName).toBe('手動上傳')
  })
})
```

### 元件測試

```typescript
// __tests__/components/DocumentSourceBadge.test.tsx

import { render, screen } from '@testing-library/react'
import { DocumentSourceBadge } from '@/components/documents/DocumentSourceBadge'

describe('DocumentSourceBadge', () => {
  it('should render SharePoint badge correctly', () => {
    render(<DocumentSourceBadge sourceType="SHAREPOINT" />)

    expect(screen.getByText('SharePoint')).toBeInTheDocument()
  })

  it('should render Outlook badge correctly', () => {
    render(<DocumentSourceBadge sourceType="OUTLOOK" />)

    expect(screen.getByText('Outlook 郵件')).toBeInTheDocument()
  })

  it('should render Manual Upload badge correctly', () => {
    render(<DocumentSourceBadge sourceType="MANUAL_UPLOAD" />)

    expect(screen.getByText('手動上傳')).toBeInTheDocument()
  })

  it('should render tooltip when provided', () => {
    render(
      <DocumentSourceBadge
        sourceType="SHAREPOINT"
        tooltip="From Finance Portal"
      />
    )

    // Tooltip content is rendered on hover
    expect(screen.getByText('SharePoint')).toBeInTheDocument()
  })

  it('should hide label when showLabel is false', () => {
    render(<DocumentSourceBadge sourceType="SHAREPOINT" showLabel={false} />)

    expect(screen.queryByText('SharePoint')).not.toBeInTheDocument()
  })
})
```

### E2E 測試

```typescript
// e2e/document-source.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Document Source Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'user@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should display source badge in document list', async ({ page }) => {
    await page.goto('/documents')

    // Check for source badges
    await expect(page.locator('[data-testid="source-badge"]').first()).toBeVisible()
  })

  test('should filter documents by source type', async ({ page }) => {
    await page.goto('/documents')

    // Open source filter
    await page.click('[data-testid="source-filter"]')
    await page.click('text=SharePoint')

    // Verify URL updated
    await expect(page).toHaveURL(/sourceType=SHAREPOINT/)

    // Verify only SharePoint documents shown
    const badges = page.locator('[data-testid="source-badge"]')
    const count = await badges.count()

    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toContainText('SharePoint')
    }
  })

  test('should display source details on document detail page', async ({ page }) => {
    await page.goto('/documents')

    // Click first document
    await page.click('[data-testid="document-row"]')

    // Wait for detail page
    await page.waitForURL(/\/documents\/\w+/)

    // Check source details card
    await expect(page.locator('text=來源資訊')).toBeVisible()
    await expect(page.locator('text=原始檔名')).toBeVisible()
    await expect(page.locator('text=獲取時間')).toBeVisible()
  })

  test('should display SharePoint details for SharePoint sourced document', async ({ page }) => {
    // Navigate to a SharePoint sourced document
    await page.goto('/documents?sourceType=SHAREPOINT')
    await page.click('[data-testid="document-row"]')

    // Check SharePoint specific details
    await expect(page.locator('text=SharePoint 詳情')).toBeVisible()
    await expect(page.locator('text=站點')).toBeVisible()
    await expect(page.locator('text=在 SharePoint 中查看')).toBeVisible()
  })

  test('should display Outlook details for Outlook sourced document', async ({ page }) => {
    // Navigate to an Outlook sourced document
    await page.goto('/documents?sourceType=OUTLOOK')
    await page.click('[data-testid="document-row"]')

    // Check Outlook specific details
    await expect(page.locator('text=郵件詳情')).toBeVisible()
    await expect(page.locator('text=寄件者')).toBeVisible()
    await expect(page.locator('text=主旨')).toBeVisible()
    await expect(page.locator('text=收件時間')).toBeVisible()
  })

  test('should display source type statistics chart', async ({ page }) => {
    await page.goto('/dashboard')

    // Check for stats chart
    await expect(page.locator('text=文件來源分佈')).toBeVisible()

    // Check chart is rendered
    await expect(page.locator('svg.recharts-surface')).toBeVisible()
  })
})
```

---

## 驗收標準對照

| AC 編號 | 驗收標準 | 實作內容 | 狀態 |
|---------|----------|----------|------|
| AC1 | SharePoint 來源顯示 | `DocumentSourceDetails` 元件顯示 SharePoint 來源類型、文件路徑、獲取時間、原始文件名，並提供「在 SharePoint 中查看」連結 | ✅ |
| AC2 | Outlook 來源顯示 | `DocumentSourceDetails` 元件顯示 Outlook 來源類型、寄件者地址、郵件主旨、接收時間、附件原始名稱及附件索引 | ✅ |
| AC3 | 來源類型篩選 | `SourceTypeFilter` 元件支援按來源類型（手動上傳/SharePoint/Outlook/API）篩選文件列表 | ✅ |

---

## 相依性

### 前置 Stories
- **Story 9-1**: SharePoint 文件監控 API（`Document.sourceType` 和 `sourceMetadata` 欄位定義）
- **Story 9-3**: Outlook 郵件附件擷取 API（Outlook 來源追蹤資料）

### 外部相依
- `recharts` - 圖表視覺化
- `date-fns` - 日期格式化
- `@tanstack/react-query` - 資料獲取與快取

### 後續 Stories
- 無直接後續（Epic 9 最後一個 Story）

---

## 部署注意事項

### 資料庫索引

```sql
-- 確保來源類型索引存在
CREATE INDEX IF NOT EXISTS idx_documents_source_type
ON documents(source_type);

-- SharePoint 項目 ID 索引
CREATE INDEX IF NOT EXISTS idx_documents_sharepoint_item
ON documents(sharepoint_item_id)
WHERE sharepoint_item_id IS NOT NULL;
```

### 效能考量

1. **sourceMetadata JSON 查詢** - Prisma 的 JSON 欄位查詢效能較低，複雜搜尋考慮提取常用欄位
2. **統計查詢快取** - 使用 React Query 快取統計資料，減少資料庫查詢
3. **圖表延遲載入** - SourceTypeStats 和 SourceTypeTrend 使用 dynamic import 減少初始載入時間

---

## 備註

### 來源追蹤用途

1. **審計需求** - 追蹤文件原始來源，滿足合規要求
2. **問題排查** - 快速定位文件獲取問題的來源
3. **統計分析** - 了解各來源文件比例，優化獲取策略
4. **用戶體驗** - 清楚顯示文件來自何處，增加透明度

### 未來擴展

1. **來源詳細搜尋** - 支援按寄件者、主旨等搜尋 Outlook 來源文件
2. **來源健康監控** - 監控各來源的文件獲取成功率
3. **來源配額管理** - 按來源類型設定文件數量配額
