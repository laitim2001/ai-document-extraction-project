/**
 * @fileoverview 審計查詢服務
 * @description
 *   提供審計查詢功能的核心業務邏輯：
 *   - 多條件篩選查詢
 *   - 分頁與排序支援
 *   - 城市權限過濾
 *   - 大量結果處理機制
 *
 * @module src/services/audit-query.service
 * @since Epic 8 - Story 8.3 (處理記錄查詢)
 * @lastModified 2025-12-20
 *
 * @features
 *   - AC1: 查詢表單（時間範圍、城市、狀態篩選）
 *   - AC2: 查詢結果（分頁、每頁 50 筆）
 *   - AC3: 結果內篩選（排序）
 *   - AC4: 大量結果處理（超過 10,000 筆警告）
 *   - AC5: 權限控制（AUDITOR/GLOBAL_ADMIN + 城市過濾）
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/middlewares/city-filter - 城市過濾中間件
 *   - @/types/audit-query - 審計查詢類型
 *
 * @related
 *   - src/app/api/audit/query/route.ts - 審計查詢 API
 *   - src/components/audit/AuditQueryForm.tsx - 查詢表單組件
 *   - src/components/audit/AuditResultTable.tsx - 結果表格組件
 */

import { prisma } from '@/lib/prisma'
import { CityFilterContext } from '@/middlewares/city-filter'
import {
  AuditQueryParams,
  AuditQueryResult,
  ProcessingRecord,
  CountPreview,
  MAX_QUERY_RESULTS,
  DEFAULT_PAGE_SIZE
} from '@/types/audit-query'
import { Prisma, DocumentStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 文件查詢結果類型（使用實際 Prisma Schema 關聯）
 */
type DocumentWithRelations = Prisma.DocumentGetPayload<{
  include: {
    forwarder: { select: { code: true; name: true } }
    city: { select: { code: true; name: true } }
    processingQueue: {
      select: {
        assignedTo: true
        completedAt: true
        processingPath: true
        assignee: { select: { id: true; name: true } }
      }
    }
    corrections: { select: { id: true } }
    apiUsageLogs: { select: { estimatedCost: true } }
    extractionResult: {
      select: { fieldMappings: true }
    }
    reviewRecords: {
      select: { completedAt: true }
      orderBy: { completedAt: 'desc' }
      take: 1
    }
  }
}>

// ============================================================
// AuditQueryService Class
// ============================================================

/**
 * 審計查詢服務
 *
 * @description
 *   提供審計人員查詢處理記錄的核心功能。
 *   支援多條件篩選、分頁排序，並自動應用城市權限過濾。
 */
export class AuditQueryService {
  /**
   * 查詢超時時間（毫秒）
   */
  private readonly QUERY_TIMEOUT = 30000

  /**
   * 執行審計查詢
   *
   * @description
   *   根據查詢參數執行審計查詢，返回處理記錄列表。
   *   當結果超過 MAX_QUERY_RESULTS 時，返回截斷標記。
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市權限過濾上下文
   * @returns 查詢結果
   */
  async executeQuery(
    params: AuditQueryParams,
    cityFilter: CityFilterContext
  ): Promise<AuditQueryResult> {
    const startTime = Date.now()
    const where = this.buildWhereClause(params, cityFilter)

    // 計算總數
    const total = await prisma.document.count({ where })

    // 超過限制返回截斷結果
    if (total > MAX_QUERY_RESULTS) {
      return {
        records: [],
        total,
        page: 1,
        pageSize: params.pageSize || DEFAULT_PAGE_SIZE,
        totalPages: Math.ceil(total / (params.pageSize || DEFAULT_PAGE_SIZE)),
        queryTime: Date.now() - startTime,
        isTruncated: true
      }
    }

    const page = params.page || 1
    const pageSize = params.pageSize || DEFAULT_PAGE_SIZE
    const orderBy = this.buildOrderBy(params.sortBy, params.sortOrder)

    const documents = await prisma.document.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        forwarder: { select: { code: true, name: true } },
        city: { select: { code: true, name: true } },
        processingQueue: {
          select: {
            assignedTo: true,
            completedAt: true,
            processingPath: true,
            assignee: { select: { id: true, name: true } }
          }
        },
        corrections: { select: { id: true } },
        apiUsageLogs: { select: { estimatedCost: true } },
        extractionResult: {
          select: { fieldMappings: true }
        },
        reviewRecords: {
          select: { completedAt: true },
          orderBy: { completedAt: 'desc' },
          take: 1
        }
      }
    })

    return {
      records: documents.map(doc => this.toProcessingRecord(doc as DocumentWithRelations)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      queryTime: Date.now() - startTime,
      isTruncated: false
    }
  }

  /**
   * 獲取結果計數預覽
   *
   * @description
   *   快速計算符合條件的記錄數量，用於在執行完整查詢前
   *   檢查結果是否超過限制。
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市權限過濾上下文
   * @returns 計數預覽
   */
  async getResultCountPreview(
    params: AuditQueryParams,
    cityFilter: CityFilterContext
  ): Promise<CountPreview> {
    const where = this.buildWhereClause(params, cityFilter)
    const count = await prisma.document.count({ where })
    return {
      count,
      exceedsLimit: count > MAX_QUERY_RESULTS
    }
  }

  /**
   * 建立查詢條件
   *
   * @description
   *   根據查詢參數和城市權限建立 Prisma where 條件。
   *   自動應用城市過濾和多條件篩選。
   *
   * @param params - 查詢參數
   * @param cityFilter - 城市權限過濾上下文
   * @returns Prisma where 條件
   */
  private buildWhereClause(
    params: AuditQueryParams,
    cityFilter: CityFilterContext
  ): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = {
      createdAt: {
        gte: new Date(params.startDate),
        lte: new Date(params.endDate)
      }
    }

    // 城市權限過濾（非 Global Admin 必須限制城市）
    if (!cityFilter.isGlobalAdmin) {
      where.cityCode = { in: cityFilter.cityCodes }
    }

    // 城市篩選（用戶指定的城市，受權限限制）
    if (params.cityCodes?.length) {
      if (cityFilter.isGlobalAdmin) {
        where.cityCode = { in: params.cityCodes }
      } else {
        // 只允許用戶有權限的城市
        const allowedCities = params.cityCodes.filter(c =>
          cityFilter.cityCodes.includes(c)
        )
        if (allowedCities.length > 0) {
          where.cityCode = { in: allowedCities }
        }
      }
    }

    // Forwarder 篩選
    if (params.forwarderIds?.length) {
      where.forwarderId = { in: params.forwarderIds }
    }

    // 狀態篩選
    if (params.statuses?.length) {
      where.status = { in: params.statuses as DocumentStatus[] }
    }

    // 操作人員篩選（查詢 processingQueue.assignedTo）
    if (params.operatorIds?.length) {
      where.processingQueue = {
        assignedTo: { in: params.operatorIds }
      }
    }

    // 搜尋關鍵字
    if (params.searchTerm) {
      where.OR = [
        { id: { contains: params.searchTerm, mode: 'insensitive' } },
        { forwarder: { code: { contains: params.searchTerm, mode: 'insensitive' } } },
        { forwarder: { name: { contains: params.searchTerm, mode: 'insensitive' } } }
      ]
    }

    return where
  }

  /**
   * 建立排序條件
   *
   * @param sortBy - 排序欄位
   * @param sortOrder - 排序方向
   * @returns Prisma orderBy 條件
   */
  private buildOrderBy(
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Prisma.DocumentOrderByWithRelationInput {
    const order = sortOrder || 'desc'

    switch (sortBy) {
      case 'forwarder':
        return { forwarder: { code: order } }
      case 'status':
        return { status: order }
      case 'processedAt':
        return { processingQueue: { completedAt: order } }
      case 'createdAt':
      default:
        return { createdAt: order }
    }
  }

  /**
   * 轉換文件為處理記錄
   *
   * @description
   *   將資料庫查詢結果轉換為前端顯示的 ProcessingRecord 格式。
   *
   * @param doc - 文件查詢結果（含關聯）
   * @returns 處理記錄
   */
  private toProcessingRecord(doc: DocumentWithRelations): ProcessingRecord {
    // 計算 AI 成本總和（Decimal 需轉換為 number）
    const totalAiCost = doc.apiUsageLogs?.reduce(
      (sum, log) => sum + (log.estimatedCost ? Number(log.estimatedCost) : 0),
      0
    ) || 0

    // 計算審核耗時（從分配到完成）
    const queue = doc.processingQueue
    const reviewDuration =
      queue?.completedAt && doc.createdAt
        ? Math.round(
            (new Date(queue.completedAt).getTime() -
              new Date(doc.createdAt).getTime()) /
              1000
          )
        : undefined

    // 從提取結果獲取發票號碼
    let invoiceNumber: string | undefined
    if (doc.extractionResult?.fieldMappings) {
      const mappings = doc.extractionResult.fieldMappings as Record<
        string,
        { value?: string | null }
      >
      invoiceNumber = mappings['invoiceNumber']?.value ?? undefined
    }

    // 判斷處理類型
    const processingType: 'AUTO' | 'MANUAL' =
      queue?.processingPath === 'AUTO_APPROVE' ? 'AUTO' : 'MANUAL'

    return {
      id: doc.id,
      documentId: doc.id,
      invoiceNumber,
      forwarderCode: doc.forwarder?.code || '',
      forwarderName: doc.forwarder?.name || '',
      cityCode: doc.cityCode,
      cityName: doc.city?.name || doc.cityCode,
      status: doc.status,
      processingType,
      processedBy: queue?.assignedTo ?? undefined,
      processedByName: queue?.assignee?.name ?? undefined,
      processedAt: queue?.completedAt?.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      aiCost: totalAiCost > 0 ? totalAiCost : undefined,
      reviewDuration,
      corrections: doc.corrections?.length || 0,
      escalated: doc.status === 'ESCALATED'
    }
  }
}

// ============================================================
// Service Instance
// ============================================================

/**
 * 審計查詢服務單例實例
 */
export const auditQueryService = new AuditQueryService()
