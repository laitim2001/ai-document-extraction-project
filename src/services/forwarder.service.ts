/**
 * @fileoverview Forwarder 服務層
 * @description
 *   提供 Forwarder Profile 相關的業務邏輯，包含查詢、創建、更新等功能。
 *   Forwarder 代表貨運代理商，是三層映射系統中 Tier 2 的關鍵角色。
 *
 *   主要功能：
 *   - Forwarder 列表查詢（分頁、搜尋、篩選、排序）
 *   - Forwarder 詳情查詢
 *   - Forwarder CRUD 操作
 *   - 規則數量統計
 *
 * @module src/services/forwarder.service
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/prisma - Prisma 單例實例
 *   - @/types/forwarder - Forwarder 類型定義
 *
 * @related
 *   - src/app/api/forwarders/route.ts - API 端點
 *   - src/types/forwarder.ts - 類型定義
 *   - prisma/schema.prisma - 資料庫模型
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type {
  ForwarderListItem,
  ForwardersResponse,
  ForwarderDetail,
  ForwarderIdentificationPattern,
  ValidatedForwardersQuery,
  ForwarderSortField,
  SortOrder,
} from '@/types/forwarder'

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
    priority: f.priority,
    ruleCount: f._count.mappingRules,
    updatedAt: f.updatedAt,
    createdAt: f.createdAt,
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
    priority: forwarder.priority,
    ruleCount: forwarder._count.mappingRules,
    documentCount: forwarder._count.documents,
    identificationPatterns,
    updatedAt: forwarder.updatedAt,
    createdAt: forwarder.createdAt,
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
    priority: forwarder.priority,
    ruleCount: forwarder._count.mappingRules,
    updatedAt: forwarder.updatedAt,
    createdAt: forwarder.createdAt,
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
