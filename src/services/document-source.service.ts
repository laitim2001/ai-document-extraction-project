/**
 * @fileoverview 文件來源追蹤服務
 * @description
 *   提供文件來源資訊的查詢與統計功能，包含：
 *   - 獲取單一文件的來源詳細資訊
 *   - 來源類型統計
 *   - 來源類型趨勢分析
 *   - 按來源類型搜尋文件
 *
 * @module src/services/document-source.service
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 來源資訊查詢
 *   - 來源統計
 *   - 來源趨勢
 *   - 來源搜尋
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *   - @/types/document-source.types - 類型定義
 *
 * @related
 *   - src/types/document-source.types.ts - 類型定義
 *   - src/lib/constants/source-types.ts - 來源類型常數
 *   - src/app/api/documents/[documentId]/source/route.ts - API 路由
 */

import { PrismaClient, Document, DocumentSourceType, Prisma } from '@prisma/client'
import type {
  DocumentSourceInfo,
  SourceTypeStats,
  SourceSearchOptions,
  SourceSearchResult,
  SharePointSourceMetadata,
  OutlookSourceMetadata,
  ManualUploadSourceMetadata,
  ApiSourceMetadata,
  SourceTypeTrendData,
} from '@/types/document-source.types'

// ============================================================
// 類型定義
// ============================================================

type DocumentWithUploader = Document & {
  uploader?: { id: string; name: string; email: string } | null
}

// ============================================================
// 服務類
// ============================================================

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
        uploader: { select: { id: true, name: true, email: true } },
      },
    })

    if (!document) return null

    // 安全轉型 sourceMetadata
    const metadata = document.sourceMetadata as unknown as Record<string, unknown> | null
    const safeMetadata = metadata || {}

    switch (document.sourceType) {
      case 'SHAREPOINT':
        return this.buildSharePointSourceInfo(
          document,
          safeMetadata as unknown as Partial<SharePointSourceMetadata>
        )
      case 'OUTLOOK':
        return this.buildOutlookSourceInfo(
          document,
          safeMetadata as unknown as Partial<OutlookSourceMetadata>
        )
      case 'MANUAL_UPLOAD':
        return this.buildManualSourceInfo(
          document as DocumentWithUploader,
          safeMetadata as unknown as Partial<ManualUploadSourceMetadata>
        )
      case 'API':
        return this.buildApiSourceInfo(
          document,
          safeMetadata as unknown as Partial<ApiSourceMetadata>
        )
      default:
        return this.buildDefaultSourceInfo(document)
    }
  }

  /**
   * 建構 SharePoint 來源資訊
   */
  private buildSharePointSourceInfo(
    document: Document,
    metadata: Partial<SharePointSourceMetadata>
  ): DocumentSourceInfo {
    return {
      type: 'SHAREPOINT',
      displayName: 'SharePoint',
      icon: 'sharepoint',
      details: {
        originalFileName: document.fileName,
        acquiredAt: metadata.fetchedAt || document.createdAt.toISOString(),
        sharepoint: {
          siteUrl: document.sharepointUrl || metadata.sharepointUrl || '',
          siteName: undefined, // SharePointSourceMetadata 不含 siteName
          libraryPath: this.buildLibraryPath(metadata),
          webUrl: metadata.webUrl || '',
          lastModifiedDateTime: metadata.lastModifiedDateTime,
        },
      },
    }
  }

  /**
   * 建構 Outlook 來源資訊
   */
  private buildOutlookSourceInfo(
    document: Document,
    metadata: Partial<OutlookSourceMetadata>
  ): DocumentSourceInfo {
    return {
      type: 'OUTLOOK',
      displayName: 'Outlook 郵件',
      icon: 'mail',
      details: {
        originalFileName: document.fileName,
        acquiredAt: document.createdAt.toISOString(),
        outlook: {
          senderEmail: metadata.senderEmail || '',
          senderName: metadata.senderName,
          subject: metadata.subject || '',
          receivedAt: metadata.receivedAt || '',
          attachmentIndex: metadata.attachmentIndex ?? 0,
          totalAttachments: metadata.totalAttachments ?? 1,
        },
      },
    }
  }

  /**
   * 建構手動上傳來源資訊
   */
  private buildManualSourceInfo(
    document: DocumentWithUploader,
    metadata: Partial<ManualUploadSourceMetadata>
  ): DocumentSourceInfo {
    return {
      type: 'MANUAL_UPLOAD',
      displayName: '手動上傳',
      icon: 'upload',
      details: {
        originalFileName: document.fileName,
        acquiredAt: metadata.uploadedAt || document.createdAt.toISOString(),
        manual: {
          uploadedBy: document.uploadedBy || '',
          uploadedByName:
            document.uploader?.name || metadata.uploadedByName || '未知',
          uploadMethod: this.getUploadMethodLabel(metadata.uploadMethod),
        },
      },
    }
  }

  /**
   * 建構 API 來源資訊
   */
  private buildApiSourceInfo(
    document: Document,
    metadata: Partial<ApiSourceMetadata>
  ): DocumentSourceInfo {
    return {
      type: 'API',
      displayName: '外部 API',
      icon: 'api',
      details: {
        originalFileName: document.fileName,
        acquiredAt: metadata.submittedAt || document.createdAt.toISOString(),
        api: {
          systemName: metadata.systemName,
          requestId: metadata.requestId,
          apiKeyId: metadata.apiKeyId || '',
        },
      },
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
        originalFileName: document.fileName,
        acquiredAt: document.createdAt.toISOString(),
      },
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
    const where: Prisma.DocumentWhereInput = {}

    // 城市篩選（使用 cityCode）
    if (options?.cityId) {
      where.cityCode = options.cityId
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
      _count: { _all: true },
    })

    const total = stats.reduce((sum, s) => sum + s._count._all, 0)

    return stats.map((s) => ({
      sourceType: s.sourceType,
      count: s._count._all,
      percentage: total > 0 ? Math.round((s._count._all / total) * 100) : 0,
    }))
  }

  /**
   * 獲取來源類型趨勢 (按月)
   */
  async getSourceTypeTrend(options?: {
    cityId?: string
    months?: number
  }): Promise<SourceTypeTrendData[]> {
    const monthsCount = options?.months || 6
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - monthsCount)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    const where: Prisma.DocumentWhereInput = {
      createdAt: { gte: startDate },
    }

    // 城市篩選（使用 cityCode）
    if (options?.cityId) {
      where.cityCode = options.cityId
    }

    const documents = await this.prisma.document.findMany({
      where,
      select: {
        sourceType: true,
        createdAt: true,
      },
    })

    // 按月分組
    const monthlyData: Record<string, Record<DocumentSourceType, number>> = {}

    documents.forEach((doc) => {
      const monthKey = `${doc.createdAt.getFullYear()}-${String(doc.createdAt.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          MANUAL_UPLOAD: 0,
          SHAREPOINT: 0,
          OUTLOOK: 0,
          API: 0,
        }
      }

      monthlyData[monthKey][doc.sourceType]++
    })

    // 轉換為陣列並排序
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data,
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
    const where: Prisma.DocumentWhereInput = {}

    // 來源類型篩選
    if (options.sourceType) {
      where.sourceType = options.sourceType
    }

    // 城市篩選（使用 cityCode）
    if (options.cityId) {
      where.cityCode = options.cityId
    }

    // Outlook 特定搜尋 - 寄件者 Email
    if (options.senderEmail) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          sourceType: 'OUTLOOK',
          sourceMetadata: {
            path: ['senderEmail'],
            string_contains: options.senderEmail,
          },
        },
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
            string_contains: options.subject,
          },
        },
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
          uploader: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        id: item.id,
        originalFileName: item.fileName,
        sourceType: item.sourceType,
        sourceMetadata: item.sourceMetadata as unknown as Record<string, unknown> | null,
        createdAt: item.createdAt.toISOString(),
        city: item.city || undefined,
        uploadedBy: item.uploader
          ? { id: item.uploader.id, name: item.uploader.name }
          : undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  // ============================================
  // 輔助方法
  // ============================================

  /**
   * 建構文件庫路徑
   */
  private buildLibraryPath(metadata: Partial<SharePointSourceMetadata>): string {
    // SharePointSourceMetadata 不一定有 libraryName/folderPath
    // 使用 driveId 或其他可用資訊
    return metadata.driveId || '/'
  }

  /**
   * 獲取上傳方式標籤
   */
  private getUploadMethodLabel(method?: string): string {
    switch (method) {
      case 'web':
        return '網頁上傳'
      case 'drag-drop':
        return '拖曳上傳'
      case 'api':
        return 'API 上傳'
      default:
        return '未知'
    }
  }
}
