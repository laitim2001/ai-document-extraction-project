/**
 * @fileoverview Forwarder 相關類型定義
 * @description
 *   定義 Forwarder Profile 功能所需的所有 TypeScript 類型，
 *   包含列表項目、查詢參數、分頁資訊等。
 *
 *   設計說明：
 *   - 適配現有 Prisma schema 的 `isActive` boolean 欄位
 *   - 在 UI 層轉換為易讀的狀態顯示
 *
 * @module src/types/forwarder
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - prisma/schema.prisma - Forwarder 模型定義
 *
 * @related
 *   - src/services/forwarder.service.ts - Forwarder 業務邏輯
 *   - src/app/api/forwarders/route.ts - API 端點
 *   - src/hooks/use-forwarders.ts - React Query Hook
 */

import { z } from 'zod'

// ============================================================
// 狀態相關
// ============================================================

/**
 * Forwarder 顯示狀態
 * @description 從 isActive boolean 轉換的 UI 友好狀態
 */
export type ForwarderDisplayStatus = 'active' | 'inactive'

/**
 * 將 isActive 轉換為顯示狀態
 */
export function getForwarderDisplayStatus(isActive: boolean): ForwarderDisplayStatus {
  return isActive ? 'active' : 'inactive'
}

/**
 * 狀態標籤配置
 */
export const FORWARDER_STATUS_CONFIG = {
  active: {
    label: '啟用',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  inactive: {
    label: '停用',
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
} as const

// ============================================================
// 列表項目類型
// ============================================================

/**
 * Forwarder 列表項目
 * @description 用於列表頁面顯示的 Forwarder 資料
 */
export interface ForwarderListItem {
  /** Forwarder ID */
  id: string
  /** Forwarder 名稱 */
  name: string
  /** Forwarder 代碼 */
  code: string
  /** 顯示名稱 */
  displayName: string
  /** 是否啟用 */
  isActive: boolean
  /** 優先級 */
  priority: number
  /** 關聯的映射規則數量 */
  ruleCount: number
  /** 最後更新時間 */
  updatedAt: Date | string
  /** 建立時間 */
  createdAt: Date | string
}

/**
 * Forwarder 詳細資訊（用於詳情頁/編輯）
 */
export interface ForwarderDetail extends ForwarderListItem {
  /** 識別模式 */
  identificationPatterns: ForwarderIdentificationPattern[]
  /** 關聯的文件數量 */
  documentCount?: number
}

/**
 * Forwarder 識別模式
 */
export interface ForwarderIdentificationPattern {
  /** 模式類型 */
  type: 'keyword' | 'regex' | 'domain'
  /** 模式值 */
  value: string
  /** 優先級 */
  priority?: number
}

// ============================================================
// 分頁與查詢
// ============================================================

/**
 * 分頁資訊
 */
export interface PaginationInfo {
  /** 當前頁碼 (1-based) */
  page: number
  /** 每頁筆數 */
  limit: number
  /** 總筆數 */
  total: number
  /** 總頁數 */
  totalPages: number
}

/**
 * 排序方向
 */
export type SortOrder = 'asc' | 'desc'

/**
 * Forwarder 可排序欄位
 */
export type ForwarderSortField = 'name' | 'code' | 'updatedAt' | 'createdAt' | 'priority' | 'ruleCount'

/**
 * Forwarder 查詢參數
 */
export interface ForwardersQueryParams {
  /** 搜尋關鍵字 (name, code) */
  search?: string
  /** 篩選狀態 (true = active, false = inactive, undefined = all) */
  isActive?: boolean
  /** 頁碼 */
  page?: number
  /** 每頁筆數 */
  limit?: number
  /** 排序欄位 */
  sortBy?: ForwarderSortField
  /** 排序方向 */
  sortOrder?: SortOrder
}

/**
 * Forwarder 列表 API 回應
 */
export interface ForwardersResponse {
  /** Forwarder 列表 */
  data: ForwarderListItem[]
  /** 分頁資訊 */
  pagination: PaginationInfo
}

// ============================================================
// Zod Schemas（運行時驗證）
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
export const ForwardersQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true
      if (val === 'false') return false
      return undefined
    }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  sortBy: z.enum(['name', 'code', 'updatedAt', 'createdAt', 'priority', 'ruleCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

/**
 * 驗證後的查詢參數類型
 */
export type ValidatedForwardersQuery = z.infer<typeof ForwardersQuerySchema>

// ============================================================
// 表格相關
// ============================================================

/**
 * 表格欄位配置
 */
export interface ForwarderTableColumn {
  /** 欄位 ID */
  id: ForwarderSortField | 'status' | 'actions'
  /** 欄位標題 */
  label: string
  /** 是否可排序 */
  sortable: boolean
  /** 欄位寬度 */
  width?: string
  /** 對齊方式 */
  align?: 'left' | 'center' | 'right'
}

/**
 * 預設表格欄位配置
 */
export const DEFAULT_FORWARDER_COLUMNS: ForwarderTableColumn[] = [
  { id: 'name', label: '名稱', sortable: true, width: '200px' },
  { id: 'code', label: '代碼', sortable: true, width: '120px' },
  { id: 'status', label: '狀態', sortable: false, width: '100px', align: 'center' },
  { id: 'ruleCount', label: '規則數', sortable: true, width: '100px', align: 'center' },
  { id: 'priority', label: '優先級', sortable: true, width: '100px', align: 'center' },
  { id: 'updatedAt', label: '最後更新', sortable: true, width: '180px' },
  { id: 'actions', label: '操作', sortable: false, width: '100px', align: 'center' },
]

// ============================================================
// 篩選器相關
// ============================================================

/**
 * 篩選器狀態
 */
export interface ForwarderFiltersState {
  /** 搜尋關鍵字 */
  search: string
  /** 狀態篩選 */
  status: 'all' | 'active' | 'inactive'
}

/**
 * 預設篩選器狀態
 */
export const DEFAULT_FORWARDER_FILTERS: ForwarderFiltersState = {
  search: '',
  status: 'all',
}

/**
 * 狀態篩選選項
 */
export const FORWARDER_STATUS_OPTIONS = [
  { value: 'all', label: '全部狀態' },
  { value: 'active', label: '啟用' },
  { value: 'inactive', label: '停用' },
] as const
