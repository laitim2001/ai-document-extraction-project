/**
 * @fileoverview Forwarder 服務層
 * @description
 *   提供 Forwarder Profile 相關的業務邏輯，包含查詢、創建、更新等功能。
 *   Forwarder 代表貨運代理商，是三層映射系統中 Tier 2 的關鍵角色。
 *
 *   主要功能：
 *   - Forwarder 列表查詢（分頁、搜尋、篩選、排序）
 *   - Forwarder 詳情查詢（含統計、規則摘要、近期文件）
 *   - Forwarder CRUD 操作（Story 5.5）
 *   - 規則數量統計
 *   - 規則列表查詢
 *   - Forwarder 停用/啟用（Story 5.5）
 *
 * @module src/services/forwarder.service
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-19
 *
 * @features
 *   - Story 5.1: 列表查詢功能（getForwarders, getForwarderById）
 *   - Story 5.2: 詳情檢視功能（getForwarderDetailView, getForwarderRules, getForwarderStatsById）
 *   - Story 5.5: CRUD 操作（createForwarder, updateForwarder）
 *   - Story 5.5: 生命週期管理（deactivateForwarder, activateForwarder）
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/prisma - Prisma 單例實例
 *   - @/types/forwarder - Forwarder 類型定義
 *
 * @related
 *   - src/app/api/forwarders/route.ts - 列表/創建 API 端點
 *   - src/app/api/forwarders/[id]/route.ts - 詳情/更新 API 端點
 *   - src/app/api/forwarders/[id]/deactivate/route.ts - 停用 API
 *   - src/app/api/forwarders/[id]/activate/route.ts - 啟用 API
 *   - src/types/forwarder.ts - 類型定義
 *   - prisma/schema.prisma - 資料庫模型
 */

import { prisma } from '@/lib/prisma'
import type {
  Prisma,
  RuleStatus as PrismaRuleStatus,
  ForwarderStatus as PrismaForwarderStatus,
} from '@prisma/client'
import type {
  ForwarderListItem,
  ForwardersResponse,
  ForwarderDetail,
  ForwarderDetailView,
  ForwarderIdentificationPattern,
  ValidatedForwardersQuery,
  ValidatedRulesQuery,
  ForwarderSortField,
  SortOrder,
  RulesSummary,
  RuleStatusCounts,
  ForwarderStats as ForwarderStatsData,
  DailyTrendData,
  RecentDocumentItem,
  RuleListItem,
  RulesResponse,
  RuleStatus,
  ForwarderStatus,
  CreateForwarderFormData,
  UpdateForwarderFormData,
  DeactivateForwarderRequest,
  ActivateForwarderRequest,
  CreateForwarderResponse,
  UpdateForwarderResponse,
  ForwarderStatusChangeResponse,
} from '@/types/forwarder'
import { mapDocumentStatus, getIsActiveFromStatus } from '@/types/forwarder'

// ============================================================
// 類型定義
// ============================================================

/**
 * Forwarder 列表查詢參數
 */
export interface GetForwardersParams {
  /** 搜尋關鍵字（name, code） */
  search?: string
  /** 狀態篩選 */
  isActive?: boolean
  /** 頁碼（從 1 開始）*/
  page?: number
  /** 每頁數量 */
  limit?: number
  /** 排序欄位 */
  sortBy?: ForwarderSortField
  /** 排序方向 */
  sortOrder?: SortOrder
}

/**
 * 排序欄位對應
 * ruleCount 需要特殊處理（計算欄位）
 */
const SORT_FIELD_MAP: Record<ForwarderSortField, string> = {
  name: 'name',
  code: 'code',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
  priority: 'priority',
  ruleCount: '_count.mappingRules', // 特殊處理
}

// ============================================================
// Forwarder 列表查詢
// ============================================================

/**
 * 獲取 Forwarder 列表（分頁、搜尋、篩選、排序）
 *
 * @description
 *   查詢 Forwarder 列表，支援：
 *   - 關鍵字搜尋（name, code, displayName）
 *   - 狀態篩選（isActive）
 *   - 分頁
 *   - 多欄位排序
 *   - 包含規則數量統計
 *
 * @param params - 查詢參數
 * @returns Forwarder 列表和分頁資訊
 *
 * @example
 *   const result = await getForwarders({
 *     search: 'DHL',
 *     isActive: true,
 *     page: 1,
 *     limit: 10,
 *     sortBy: 'updatedAt',
 *     sortOrder: 'desc',
 *   })
 */
export async function getForwarders(
  params: GetForwardersParams = {}
): Promise<ForwardersResponse> {
  const {
    search,
    isActive,
    page = 1,
    limit = 10,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = params

  // 構建 where 條件
  const where: Prisma.ForwarderWhereInput = {
    // 搜尋條件（name, code, displayName）
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { code: { contains: search, mode: 'insensitive' as const } },
        { displayName: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    // 狀態篩選
    ...(isActive !== undefined && { isActive }),
  }

  // 構建排序條件
  let orderBy: Prisma.ForwarderOrderByWithRelationInput | Prisma.ForwarderOrderByWithRelationInput[]

  if (sortBy === 'ruleCount') {
    // ruleCount 需要按關聯數量排序
    orderBy = {
      mappingRules: {
        _count: sortOrder,
      },
    }
  } else {
    orderBy = {
      [SORT_FIELD_MAP[sortBy] || 'updatedAt']: sortOrder,
    }
  }

  // 執行並行查詢（資料 + 總數）
  const [forwardersRaw, total] = await prisma.$transaction([
    prisma.forwarder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: {
        _count: {
          select: {
            mappingRules: true,
          },
        },
      },
    }),
    prisma.forwarder.count({ where }),
  ])

  // 轉換為 ForwarderListItem 格式
  const data: ForwarderListItem[] = forwardersRaw.map((f) => ({
    id: f.id,
    name: f.name,
    code: f.code,
    displayName: f.displayName,
    isActive: f.isActive,
    // Story 5.5: 新增 status 欄位
    status: f.status as ForwarderStatus,
    priority: f.priority,
    ruleCount: f._count.mappingRules,
    updatedAt: f.updatedAt,
    createdAt: f.createdAt,
    // Story 5.5: 新增欄位
    logoUrl: f.logoUrl,
    description: f.description,
    contactEmail: f.contactEmail,
    defaultConfidence: f.defaultConfidence,
  }))

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * 從已驗證的查詢參數獲取 Forwarder 列表
 *
 * @description
 *   包裝 getForwarders，接受 Zod 驗證後的查詢參數
 *
 * @param query - 已驗證的查詢參數
 * @returns Forwarder 列表和分頁資訊
 */
export async function getForwardersFromQuery(
  query: ValidatedForwardersQuery
): Promise<ForwardersResponse> {
  return getForwarders({
    search: query.search,
    isActive: query.isActive,
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  })
}

// ============================================================
// Forwarder 詳情查詢
// ============================================================

/**
 * 根據 ID 獲取 Forwarder 詳情
 *
 * @description
 *   獲取單個 Forwarder 的完整資訊，包含：
 *   - 基本資料
 *   - 識別模式
 *   - 規則數量
 *   - 文件數量
 *
 * @param id - Forwarder ID
 * @returns Forwarder 詳情或 null
 */
export async function getForwarderById(id: string): Promise<ForwarderDetail | null> {
  const forwarder = await prisma.forwarder.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          mappingRules: true,
          documents: true,
        },
      },
    },
  })

  if (!forwarder) {
    return null
  }

  // 解析識別模式 JSON（Prisma 返回 JsonValue 類型，需要類型斷言）
  const identificationPatterns = Array.isArray(forwarder.identificationPatterns)
    ? (forwarder.identificationPatterns as unknown as ForwarderIdentificationPattern[])
    : []

  return {
    id: forwarder.id,
    name: forwarder.name,
    code: forwarder.code,
    displayName: forwarder.displayName,
    isActive: forwarder.isActive,
    // Story 5.5: 新增 status 欄位
    status: forwarder.status as ForwarderStatus,
    priority: forwarder.priority,
    ruleCount: forwarder._count.mappingRules,
    documentCount: forwarder._count.documents,
    identificationPatterns,
    updatedAt: forwarder.updatedAt,
    createdAt: forwarder.createdAt,
    // Story 5.5: 新增欄位
    logoUrl: forwarder.logoUrl,
    description: forwarder.description,
    contactEmail: forwarder.contactEmail,
    defaultConfidence: forwarder.defaultConfidence,
  }
}

/**
 * 根據 Code 獲取 Forwarder
 *
 * @param code - Forwarder 代碼
 * @returns Forwarder 或 null
 */
export async function getForwarderByCode(code: string): Promise<ForwarderListItem | null> {
  const forwarder = await prisma.forwarder.findUnique({
    where: { code },
    include: {
      _count: {
        select: {
          mappingRules: true,
        },
      },
    },
  })

  if (!forwarder) {
    return null
  }

  return {
    id: forwarder.id,
    name: forwarder.name,
    code: forwarder.code,
    displayName: forwarder.displayName,
    isActive: forwarder.isActive,
    // Story 5.5: 新增 status 欄位
    status: forwarder.status as ForwarderStatus,
    priority: forwarder.priority,
    ruleCount: forwarder._count.mappingRules,
    updatedAt: forwarder.updatedAt,
    createdAt: forwarder.createdAt,
    // Story 5.5: 新增欄位
    logoUrl: forwarder.logoUrl,
    description: forwarder.description,
    contactEmail: forwarder.contactEmail,
    defaultConfidence: forwarder.defaultConfidence,
  }
}

// ============================================================
// Forwarder 統計
// ============================================================

/**
 * Forwarder 統計資訊
 */
export interface ForwarderStats {
  /** 總數 */
  total: number
  /** 啟用數 */
  active: number
  /** 停用數 */
  inactive: number
  /** 有規則的 Forwarder 數 */
  withRules: number
}

/**
 * 獲取 Forwarder 統計資訊
 *
 * @returns 統計資訊
 */
export async function getForwarderStats(): Promise<ForwarderStats> {
  const [total, active, withRules] = await prisma.$transaction([
    prisma.forwarder.count(),
    prisma.forwarder.count({ where: { isActive: true } }),
    prisma.forwarder.count({
      where: {
        mappingRules: {
          some: {},
        },
      },
    }),
  ])

  return {
    total,
    active,
    inactive: total - active,
    withRules,
  }
}

// ============================================================
// Forwarder 檢查
// ============================================================

/**
 * 檢查 Forwarder 是否存在
 *
 * @param id - Forwarder ID
 * @returns 是否存在
 */
export async function forwarderExists(id: string): Promise<boolean> {
  const count = await prisma.forwarder.count({
    where: { id },
  })
  return count > 0
}

/**
 * 檢查 Forwarder 代碼是否已存在
 *
 * @param code - Forwarder 代碼
 * @param excludeId - 排除的 ID（用於更新時檢查）
 * @returns 是否已存在
 */
export async function forwarderCodeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const count = await prisma.forwarder.count({
    where: {
      code,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
  })
  return count > 0
}

/**
 * 檢查 Forwarder 名稱是否已存在
 *
 * @param name - Forwarder 名稱
 * @param excludeId - 排除的 ID（用於更新時檢查）
 * @returns 是否已存在
 */
export async function forwarderNameExists(
  name: string,
  excludeId?: string
): Promise<boolean> {
  const count = await prisma.forwarder.count({
    where: {
      name,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
  })
  return count > 0
}

// ============================================================
// Forwarder 選項（用於下拉選單）
// ============================================================

/**
 * Forwarder 選項項目
 */
export interface ForwarderOption {
  value: string
  label: string
  code: string
}

/**
 * 獲取所有啟用的 Forwarder 選項
 *
 * @description
 *   用於表單下拉選單，只返回啟用的 Forwarder
 *
 * @returns Forwarder 選項列表
 */
export async function getActiveForwarderOptions(): Promise<ForwarderOption[]> {
  const forwarders = await prisma.forwarder.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      displayName: true,
    },
  })

  return forwarders.map((f) => ({
    value: f.id,
    label: f.displayName || f.name,
    code: f.code,
  }))
}

/**
 * 獲取所有 Forwarder 選項（包含停用）
 *
 * @returns Forwarder 選項列表
 */
export async function getAllForwarderOptions(): Promise<ForwarderOption[]> {
  const forwarders = await prisma.forwarder.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      displayName: true,
    },
  })

  return forwarders.map((f) => ({
    value: f.id,
    label: f.displayName || f.name,
    code: f.code,
  }))
}

// ============================================================
// Story 5-2: Forwarder 詳情檢視
// ============================================================

/**
 * 獲取規則摘要統計
 *
 * @description
 *   統計 Forwarder 的規則數量，按狀態分組
 *
 * @param forwarderId - Forwarder ID
 * @returns 規則摘要
 */
async function getRulesSummary(forwarderId: string): Promise<RulesSummary> {
  const rules = await prisma.mappingRule.groupBy({
    by: ['status'],
    where: { forwarderId },
    _count: {
      id: true,
    },
  })

  const byStatus: RuleStatusCounts = {
    active: 0,
    draft: 0,
    pendingReview: 0,
    deprecated: 0,
  }

  let total = 0
  for (const rule of rules) {
    const count = rule._count.id
    total += count
    switch (rule.status) {
      case 'ACTIVE':
        byStatus.active = count
        break
      case 'DRAFT':
        byStatus.draft = count
        break
      case 'PENDING_REVIEW':
        byStatus.pendingReview = count
        break
      case 'DEPRECATED':
        byStatus.deprecated = count
        break
    }
  }

  return { total, byStatus }
}

/**
 * 獲取每日趨勢資料
 *
 * @description
 *   計算過去 30 天每天的文件處理數量和成功數量
 *
 * @param forwarderId - Forwarder ID
 * @returns 每日趨勢資料陣列
 */
async function getDailyTrend(forwarderId: string): Promise<DailyTrendData[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  // 獲取過去 30 天的文件
  const documents = await prisma.document.findMany({
    where: {
      forwarderId,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      createdAt: true,
      status: true,
    },
  })

  // 建立日期到資料的映射
  const trendMap = new Map<string, { count: number; successCount: number }>()

  // 初始化過去 30 天的資料
  for (let i = 0; i < 30; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    trendMap.set(dateStr, { count: 0, successCount: 0 })
  }

  // 統計每天的數量
  for (const doc of documents) {
    const dateStr = doc.createdAt.toISOString().split('T')[0]
    const existing = trendMap.get(dateStr)
    if (existing) {
      existing.count++
      if (doc.status === 'COMPLETED') {
        existing.successCount++
      }
    }
  }

  // 轉換為陣列並按日期排序
  const trend: DailyTrendData[] = []
  for (const [date, data] of trendMap) {
    trend.push({
      date,
      count: data.count,
      successCount: data.successCount,
    })
  }

  // 按日期升序排序
  trend.sort((a, b) => a.date.localeCompare(b.date))

  return trend
}

/**
 * 獲取 Forwarder 統計資料
 *
 * @description
 *   計算 Forwarder 的處理統計，包含：
 *   - 總文件數
 *   - 過去 30 天處理數
 *   - 成功率
 *   - 平均信心度
 *   - 每日趨勢
 *
 * @param forwarderId - Forwarder ID
 * @returns 統計資料
 */
export async function getForwarderStatsById(forwarderId: string): Promise<ForwarderStatsData> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 並行執行多個查詢
  const [totalDocuments, last30Days, completedCount, avgConfidenceResult, dailyTrend] =
    await Promise.all([
      // 總文件數
      prisma.document.count({
        where: { forwarderId },
      }),
      // 過去 30 天處理數
      prisma.document.count({
        where: {
          forwarderId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      // 成功完成數（用於計算成功率）
      prisma.document.count({
        where: {
          forwarderId,
          status: 'COMPLETED',
        },
      }),
      // 平均信心度（從 ExtractionResult）
      prisma.extractionResult.aggregate({
        where: {
          document: {
            forwarderId,
          },
        },
        _avg: {
          averageConfidence: true,
        },
      }),
      // 每日趨勢
      getDailyTrend(forwarderId),
    ])

  // 計算成功率
  const successRate = totalDocuments > 0 ? Math.round((completedCount / totalDocuments) * 100) : 0

  // 平均信心度（0-100 範圍）
  const avgConfidence = avgConfidenceResult._avg?.averageConfidence
    ? Math.round(avgConfidenceResult._avg.averageConfidence)
    : 0

  return {
    totalDocuments,
    processedLast30Days: last30Days,
    successRate,
    avgConfidence,
    dailyTrend,
  }
}

/**
 * 獲取近期文件
 *
 * @description
 *   獲取 Forwarder 最近處理的文件列表
 *
 * @param forwarderId - Forwarder ID
 * @param limit - 限制數量（預設 10）
 * @returns 近期文件列表
 */
export async function getForwarderRecentDocuments(
  forwarderId: string,
  limit: number = 10
): Promise<RecentDocumentItem[]> {
  const documents = await prisma.document.findMany({
    where: { forwarderId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      fileName: true,
      status: true,
      updatedAt: true,
      createdAt: true,
      extractionResult: {
        select: {
          averageConfidence: true,
        },
      },
    },
  })

  return documents.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    status: mapDocumentStatus(doc.status),
    confidence: doc.extractionResult?.averageConfidence ?? null,
    processedAt: doc.updatedAt,
    createdAt: doc.createdAt,
  }))
}

/**
 * 獲取 Forwarder 詳情檢視（含統計資料）
 *
 * @description
 *   獲取 Forwarder 的完整詳情，包含：
 *   - 基本資料
 *   - 識別模式
 *   - 規則摘要（按狀態分組）
 *   - 處理統計（成功率、平均信心度、趨勢）
 *   - 近期文件列表
 *
 * @param id - Forwarder ID
 * @returns 完整的詳情檢視資料或 null
 *
 * @example
 *   const detail = await getForwarderDetailView('cuid123')
 *   if (detail) {
 *     console.log(detail.stats.successRate)
 *     console.log(detail.rulesSummary.byStatus.active)
 *   }
 */
export async function getForwarderDetailView(id: string): Promise<ForwarderDetailView | null> {
  // 首先獲取基本詳情
  const detail = await getForwarderById(id)
  if (!detail) {
    return null
  }

  // 並行獲取其他資料
  const [rulesSummary, stats, recentDocuments] = await Promise.all([
    getRulesSummary(id),
    getForwarderStatsById(id),
    getForwarderRecentDocuments(id, 10),
  ])

  return {
    ...detail,
    rulesSummary,
    stats,
    recentDocuments,
  }
}

// ============================================================
// Story 5-2: Forwarder 規則列表
// ============================================================

/**
 * 規則列表查詢參數
 */
export interface GetForwarderRulesParams {
  /** Forwarder ID */
  forwarderId: string
  /** 狀態篩選 */
  status?: RuleStatus
  /** 搜尋欄位名稱 */
  search?: string
  /** 頁碼（從 1 開始）*/
  page?: number
  /** 每頁數量 */
  limit?: number
  /** 排序欄位 */
  sortBy?: 'fieldName' | 'status' | 'confidence' | 'matchCount' | 'updatedAt'
  /** 排序方向 */
  sortOrder?: SortOrder
}

/**
 * 獲取 Forwarder 的規則列表（分頁）
 *
 * @description
 *   獲取指定 Forwarder 的映射規則列表，支援：
 *   - 狀態篩選
 *   - 欄位名稱搜尋
 *   - 分頁
 *   - 排序
 *
 * @param params - 查詢參數
 * @returns 規則列表和分頁資訊
 *
 * @example
 *   const result = await getForwarderRules({
 *     forwarderId: 'cuid123',
 *     status: 'ACTIVE',
 *     page: 1,
 *     limit: 10,
 *   })
 */
export async function getForwarderRules(params: GetForwarderRulesParams): Promise<RulesResponse> {
  const {
    forwarderId,
    status,
    search,
    page = 1,
    limit = 10,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = params

  // 構建 where 條件
  const where: Prisma.MappingRuleWhereInput = {
    forwarderId,
    ...(status && { status: status as PrismaRuleStatus }),
    ...(search && {
      fieldName: { contains: search, mode: 'insensitive' as const },
    }),
  }

  // 構建排序條件
  const orderBy: Prisma.MappingRuleOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  }

  // 執行並行查詢
  const [rulesRaw, total] = await prisma.$transaction([
    prisma.mappingRule.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      select: {
        id: true,
        fieldName: true,
        status: true,
        version: true,
        confidence: true,
        updatedAt: true,
        // 計算 matchCount 需要從 applications 關聯
        _count: {
          select: {
            applications: true,
          },
        },
      },
    }),
    prisma.mappingRule.count({ where }),
  ])

  // 轉換為 RuleListItem 格式
  const data: RuleListItem[] = rulesRaw.map((rule) => ({
    id: rule.id,
    fieldName: rule.fieldName,
    status: rule.status as RuleStatus,
    version: rule.version,
    confidence: Math.round(rule.confidence * 100), // 轉換為百分比
    matchCount: rule._count.applications,
    lastMatchedAt: null, // 需要從 applications 查詢最新的，暫時使用 null
    updatedAt: rule.updatedAt,
  }))

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * 從已驗證的查詢參數獲取規則列表
 *
 * @param forwarderId - Forwarder ID
 * @param query - 已驗證的查詢參數
 * @returns 規則列表和分頁資訊
 */
export async function getForwarderRulesFromQuery(
  forwarderId: string,
  query: ValidatedRulesQuery
): Promise<RulesResponse> {
  return getForwarderRules({
    forwarderId,
    status: query.status as RuleStatus | undefined,
    search: query.search,
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  })
}

// ============================================================
// Story 5.5: Forwarder CRUD 操作
// ============================================================

/**
 * 創建 Forwarder 輸入參數
 */
export interface CreateForwarderInput {
  /** 名稱 */
  name: string
  /** 代碼 */
  code: string
  /** 描述 */
  description?: string | null
  /** 聯絡電子郵件 */
  contactEmail?: string | null
  /** 預設信心度 */
  defaultConfidence?: number
  /** Logo URL（上傳後的 URL） */
  logoUrl?: string | null
  /** 創建者 ID */
  createdById: string
}

/**
 * 創建新的 Forwarder
 *
 * @description
 *   Story 5.5 - 創建新的 Forwarder Profile
 *   - 初始狀態為 PENDING
 *   - 設定 isActive = false（需要配置規則後才啟用）
 *   - displayName 預設等於 name
 *
 * @param input - 創建參數
 * @returns 創建的 Forwarder ID 和狀態
 */
export async function createForwarder(input: CreateForwarderInput): Promise<{
  id: string
  name: string
  code: string
  status: ForwarderStatus
}> {
  const forwarder = await prisma.forwarder.create({
    data: {
      name: input.name,
      code: input.code,
      displayName: input.name, // 預設等於 name
      description: input.description,
      contactEmail: input.contactEmail,
      defaultConfidence: input.defaultConfidence ?? 0.8,
      logoUrl: input.logoUrl,
      status: 'PENDING' as PrismaForwarderStatus,
      isActive: false, // PENDING 狀態下 isActive 為 false
      createdById: input.createdById,
      identificationPatterns: [], // 空陣列，由後續設定
    },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
    },
  })

  return {
    id: forwarder.id,
    name: forwarder.name,
    code: forwarder.code,
    status: forwarder.status as ForwarderStatus,
  }
}

/**
 * 更新 Forwarder 輸入參數
 */
export interface UpdateForwarderInput {
  /** 名稱 */
  name?: string
  /** 描述 */
  description?: string | null
  /** 聯絡電子郵件 */
  contactEmail?: string | null
  /** 預設信心度 */
  defaultConfidence?: number
  /** Logo URL（上傳後的 URL） */
  logoUrl?: string | null
}

/**
 * 更新 Forwarder
 *
 * @description
 *   Story 5.5 - 更新 Forwarder Profile 基本資訊
 *   - 不允許修改 code
 *   - 不允許直接修改 status（使用 deactivate/activate）
 *
 * @param id - Forwarder ID
 * @param input - 更新參數
 * @returns 更新後的 Forwarder 資料
 */
export async function updateForwarder(
  id: string,
  input: UpdateForwarderInput
): Promise<{
  id: string
  name: string
  code: string
  description: string | null
  logoUrl: string | null
  contactEmail: string | null
  defaultConfidence: number
  status: ForwarderStatus
}> {
  // 構建更新資料，只包含有值的欄位
  const updateData: Prisma.ForwarderUpdateInput = {}

  if (input.name !== undefined) {
    updateData.name = input.name
    updateData.displayName = input.name // 同步更新 displayName
  }
  if (input.description !== undefined) {
    updateData.description = input.description
  }
  if (input.contactEmail !== undefined) {
    updateData.contactEmail = input.contactEmail
  }
  if (input.defaultConfidence !== undefined) {
    updateData.defaultConfidence = input.defaultConfidence
  }
  if (input.logoUrl !== undefined) {
    updateData.logoUrl = input.logoUrl
  }

  const forwarder = await prisma.forwarder.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      logoUrl: true,
      contactEmail: true,
      defaultConfidence: true,
      status: true,
    },
  })

  return {
    ...forwarder,
    status: forwarder.status as ForwarderStatus,
  }
}

/**
 * 停用 Forwarder
 *
 * @description
 *   Story 5.5 - 停用 Forwarder Profile
 *   - 將狀態從 ACTIVE 改為 INACTIVE
 *   - 可選擇同時停用所有 ACTIVE 規則（改為 DEPRECATED）
 *   - 記錄停用原因
 *
 * @param id - Forwarder ID
 * @param options - 停用選項
 * @returns 停用結果
 */
export async function deactivateForwarder(
  id: string,
  options: {
    reason?: string
    deactivateRules?: boolean
  } = {}
): Promise<{
  id: string
  name: string
  status: ForwarderStatus
  rulesAffected: number
}> {
  const { deactivateRules = true } = options

  // 使用事務確保一致性
  const result = await prisma.$transaction(async (tx) => {
    // 1. 更新 Forwarder 狀態
    const forwarder = await tx.forwarder.update({
      where: { id },
      data: {
        status: 'INACTIVE' as PrismaForwarderStatus,
        isActive: false,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    })

    let rulesAffected = 0

    // 2. 如果需要，停用所有 ACTIVE 規則
    if (deactivateRules) {
      const updateResult = await tx.mappingRule.updateMany({
        where: {
          forwarderId: id,
          status: 'ACTIVE',
        },
        data: {
          status: 'DEPRECATED',
        },
      })
      rulesAffected = updateResult.count
    }

    return {
      id: forwarder.id,
      name: forwarder.name,
      status: forwarder.status as ForwarderStatus,
      rulesAffected,
    }
  })

  return result
}

/**
 * 啟用 Forwarder
 *
 * @description
 *   Story 5.5 - 啟用 Forwarder Profile
 *   - 將狀態從 INACTIVE/PENDING 改為 ACTIVE
 *   - 可選擇重新啟用之前的 DEPRECATED 規則（改為 ACTIVE）
 *
 * @param id - Forwarder ID
 * @param options - 啟用選項
 * @returns 啟用結果
 */
export async function activateForwarder(
  id: string,
  options: {
    reactivateRules?: boolean
  } = {}
): Promise<{
  id: string
  name: string
  status: ForwarderStatus
  rulesAffected: number
}> {
  const { reactivateRules = false } = options

  // 使用事務確保一致性
  const result = await prisma.$transaction(async (tx) => {
    // 1. 更新 Forwarder 狀態
    const forwarder = await tx.forwarder.update({
      where: { id },
      data: {
        status: 'ACTIVE' as PrismaForwarderStatus,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    })

    let rulesAffected = 0

    // 2. 如果需要，重新啟用 DEPRECATED 規則
    if (reactivateRules) {
      const updateResult = await tx.mappingRule.updateMany({
        where: {
          forwarderId: id,
          status: 'DEPRECATED',
        },
        data: {
          status: 'ACTIVE',
        },
      })
      rulesAffected = updateResult.count
    }

    return {
      id: forwarder.id,
      name: forwarder.name,
      status: forwarder.status as ForwarderStatus,
      rulesAffected,
    }
  })

  return result
}

/**
 * 獲取 Forwarder 的 ACTIVE 規則數量
 *
 * @description
 *   Story 5.5 - 用於停用對話框顯示影響的規則數
 *
 * @param forwarderId - Forwarder ID
 * @returns ACTIVE 規則數量
 */
export async function getActiveRulesCount(forwarderId: string): Promise<number> {
  return prisma.mappingRule.count({
    where: {
      forwarderId,
      status: 'ACTIVE',
    },
  })
}

/**
 * 獲取 Forwarder 的 DEPRECATED 規則數量
 *
 * @description
 *   Story 5.5 - 用於啟用對話框顯示可恢復的規則數
 *
 * @param forwarderId - Forwarder ID
 * @returns DEPRECATED 規則數量
 */
export async function getDeprecatedRulesCount(forwarderId: string): Promise<number> {
  return prisma.mappingRule.count({
    where: {
      forwarderId,
      status: 'DEPRECATED',
    },
  })
}

/**
 * 獲取 Forwarder 原始資料（用於編輯）
 *
 * @description
 *   Story 5.5 - 獲取 Forwarder 的完整原始資料供編輯使用
 *
 * @param id - Forwarder ID
 * @returns Forwarder 原始資料或 null
 */
export async function getForwarderForEdit(id: string): Promise<{
  id: string
  name: string
  code: string
  description: string | null
  logoUrl: string | null
  contactEmail: string | null
  defaultConfidence: number
  status: ForwarderStatus
} | null> {
  const forwarder = await prisma.forwarder.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      logoUrl: true,
      contactEmail: true,
      defaultConfidence: true,
      status: true,
    },
  })

  if (!forwarder) {
    return null
  }

  return {
    ...forwarder,
    status: forwarder.status as ForwarderStatus,
  }
}
