/**
 * @fileoverview Forwarder 相關類型定義
 * @description
 *   定義 Forwarder Profile 功能所需的所有 TypeScript 類型，
 *   包含列表項目、詳情頁面、統計資料、查詢參數、分頁資訊等。
 *
 *   設計說明：
 *   - Story 5.5 新增 ForwarderStatus enum 和生命週期管理
 *   - 在 UI 層轉換為易讀的狀態顯示
 *   - Story 5-2 新增詳情頁面相關類型（統計、規則摘要、近期文件）
 *
 * @module src/types/forwarder
 * @author Development Team
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-19
 *
 * @features
 *   - Story 5.1: 列表頁面類型（ForwarderListItem, ForwardersQueryParams）
 *   - Story 5.2: 詳情頁面類型（ForwarderDetailView, ForwarderStats, RulesSummary）
 *   - Story 5.5: 新增/停用 Forwarder（ForwarderStatus, CreateForwarder, UpdateForwarder）
 *
 * @dependencies
 *   - prisma/schema.prisma - Forwarder 模型定義
 *
 * @related
 *   - src/services/forwarder.service.ts - Forwarder 業務邏輯
 *   - src/app/api/forwarders/route.ts - API 端點
 *   - src/app/api/forwarders/[id]/route.ts - Detail API 端點
 *   - src/hooks/use-forwarders.ts - React Query Hook
 *   - src/hooks/use-forwarder-detail.ts - Detail Hook
 */

import { z } from 'zod'

// ============================================================
// Story 5.5: Forwarder 狀態 Enum（對應 Prisma）
// ============================================================

/**
 * Forwarder 狀態（對應 Prisma ForwarderStatus enum）
 * @description
 *   - ACTIVE: 啟用中 - 可處理文件
 *   - INACTIVE: 已停用 - 暫停所有處理
 *   - PENDING: 待設定 - 新建立，尚未配置規則
 */
export type ForwarderStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'

/**
 * Forwarder 狀態標籤配置
 * @description Story 5.5 - 三種狀態的顯示配置
 */
export const FORWARDER_STATUS_CONFIG: Record<
  ForwarderStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string; description: string }
> = {
  ACTIVE: {
    label: '啟用',
    variant: 'default',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    description: '可正常處理文件',
  },
  INACTIVE: {
    label: '停用',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    description: '暫停所有處理',
  },
  PENDING: {
    label: '待設定',
    variant: 'outline',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    description: '尚未配置規則',
  },
} as const

// ============================================================
// 狀態相關（向後兼容）
// ============================================================

/**
 * Forwarder 顯示狀態
 * @description 從 isActive boolean 轉換的 UI 友好狀態（向後兼容）
 * @deprecated 使用 ForwarderStatus 替代
 */
export type ForwarderDisplayStatus = 'active' | 'inactive'

/**
 * 將 isActive 轉換為顯示狀態
 * @deprecated 使用 ForwarderStatus 替代
 */
export function getForwarderDisplayStatus(isActive: boolean): ForwarderDisplayStatus {
  return isActive ? 'active' : 'inactive'
}

/**
 * 將 ForwarderStatus 轉換為 isActive boolean
 * @description 向後兼容轉換函數
 */
export function getIsActiveFromStatus(status: ForwarderStatus): boolean {
  return status === 'ACTIVE'
}

/**
 * 舊版狀態標籤配置（向後兼容）
 * @deprecated 使用 FORWARDER_STATUS_CONFIG 替代
 */
export const LEGACY_FORWARDER_STATUS_CONFIG = {
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
 *   Story 5.5: 新增 status, logoUrl, description, contactEmail, defaultConfidence 欄位
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
  /** 是否啟用（向後兼容，從 status 計算） */
  isActive: boolean
  /** Story 5.5: Forwarder 狀態 */
  status: ForwarderStatus
  /** 優先級 */
  priority: number
  /** 關聯的映射規則數量 */
  ruleCount: number
  /** 最後更新時間 */
  updatedAt: Date | string
  /** 建立時間 */
  createdAt: Date | string
  /** Story 5.5: Logo URL */
  logoUrl?: string | null
  /** Story 5.5: 描述 */
  description?: string | null
  /** Story 5.5: 聯絡電子郵件 */
  contactEmail?: string | null
  /** Story 5.5: 預設信心度 (0-1) */
  defaultConfidence?: number
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
// Story 5-2: 詳情頁面相關類型
// ============================================================

/**
 * 映射規則狀態（對應 Prisma RuleStatus enum）
 */
export type RuleStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'DEPRECATED'

/**
 * 規則狀態配置
 */
export const RULE_STATUS_CONFIG = {
  DRAFT: {
    label: '草稿',
    variant: 'outline' as const,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  PENDING_REVIEW: {
    label: '待審核',
    variant: 'secondary' as const,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  ACTIVE: {
    label: '啟用',
    variant: 'default' as const,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  DEPRECATED: {
    label: '已棄用',
    variant: 'destructive' as const,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
} as const

/**
 * 規則狀態數量統計
 */
export interface RuleStatusCounts {
  /** 啟用中的規則數 */
  active: number
  /** 草稿規則數 */
  draft: number
  /** 待審核規則數 */
  pendingReview: number
  /** 已棄用規則數 */
  deprecated: number
}

/**
 * 規則摘要資訊
 */
export interface RulesSummary {
  /** 規則總數 */
  total: number
  /** 按狀態分組的數量 */
  byStatus: RuleStatusCounts
}

/**
 * 每日趨勢資料點
 */
export interface DailyTrendData {
  /** 日期 (YYYY-MM-DD) */
  date: string
  /** 文件數量 */
  count: number
  /** 成功數量 */
  successCount: number
}

/**
 * Forwarder 統計資料
 */
export interface ForwarderStats {
  /** 文件總數 */
  totalDocuments: number
  /** 過去 30 天處理數 */
  processedLast30Days: number
  /** 成功率 (0-100) */
  successRate: number
  /** 平均信心度 (0-100) */
  avgConfidence: number
  /** 每日趨勢資料（最近 30 天） */
  dailyTrend: DailyTrendData[]
}

/**
 * 文件處理狀態（簡化的顯示用狀態）
 * @description 將 Prisma DocumentStatus 映射到簡化的顯示狀態
 */
export type DocumentProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NEEDS_REVIEW'

/**
 * 文件處理狀態配置
 */
export const DOCUMENT_PROCESSING_STATUS_CONFIG: Record<
  DocumentProcessingStatus,
  { label: string; variant: string; className: string }
> = {
  PENDING: {
    label: '待處理',
    variant: 'outline',
    className: 'bg-gray-100 text-gray-800',
  },
  PROCESSING: {
    label: '處理中',
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800',
  },
  COMPLETED: {
    label: '已完成',
    variant: 'default',
    className: 'bg-green-100 text-green-800',
  },
  FAILED: {
    label: '失敗',
    variant: 'destructive',
    className: 'bg-red-100 text-red-800',
  },
  NEEDS_REVIEW: {
    label: '待審核',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800',
  },
}

/**
 * 將 Prisma DocumentStatus 映射到顯示用狀態
 * @param prismaStatus - Prisma 的 DocumentStatus
 * @returns 顯示用的處理狀態
 */
export function mapDocumentStatus(prismaStatus: string): DocumentProcessingStatus {
  const statusMap: Record<string, DocumentProcessingStatus> = {
    UPLOADING: 'PENDING',
    UPLOADED: 'PENDING',
    OCR_PROCESSING: 'PROCESSING',
    OCR_COMPLETED: 'PROCESSING',
    OCR_FAILED: 'FAILED',
    MAPPING_PROCESSING: 'PROCESSING',
    MAPPING_COMPLETED: 'PROCESSING',
    PENDING_REVIEW: 'NEEDS_REVIEW',
    IN_REVIEW: 'NEEDS_REVIEW',
    APPROVED: 'COMPLETED',
    ESCALATED: 'NEEDS_REVIEW',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  }
  return statusMap[prismaStatus] ?? 'PENDING'
}

/**
 * 近期文件項目
 */
export interface RecentDocumentItem {
  /** 文件 ID */
  id: string
  /** 檔案名稱 */
  fileName: string
  /** 文件處理狀態 */
  status: DocumentProcessingStatus
  /** 信心度 (0-100) */
  confidence: number | null
  /** 處理時間 */
  processedAt: Date | string | null
  /** 建立時間 */
  createdAt: Date | string
}

/**
 * Forwarder 詳情檢視（含統計資料）
 * @description 用於詳情頁面的完整資料結構
 */
export interface ForwarderDetailView extends ForwarderDetail {
  /** 規則摘要 */
  rulesSummary: RulesSummary
  /** 統計資料 */
  stats: ForwarderStats
  /** 近期文件（最多 10 筆） */
  recentDocuments: RecentDocumentItem[]
}

/**
 * 規則列表項目
 */
export interface RuleListItem {
  /** 規則 ID */
  id: string
  /** 欄位名稱 */
  fieldName: string
  /** 規則狀態 */
  status: RuleStatus
  /** 版本號 */
  version: number
  /** 信心度 (0-100) */
  confidence: number
  /** 匹配次數 */
  matchCount: number
  /** 最後匹配時間 */
  lastMatchedAt: Date | string | null
  /** 更新時間 */
  updatedAt: Date | string
}

/**
 * 規則查詢參數
 */
export interface RulesQueryParams {
  /** 狀態篩選 */
  status?: RuleStatus
  /** 搜尋欄位名稱 */
  search?: string
  /** 頁碼 */
  page?: number
  /** 每頁筆數 */
  limit?: number
  /** 排序欄位 */
  sortBy?: 'fieldName' | 'status' | 'confidence' | 'matchCount' | 'updatedAt'
  /** 排序方向 */
  sortOrder?: SortOrder
}

/**
 * 規則列表 API 回應
 */
export interface RulesResponse {
  /** 規則列表 */
  data: RuleListItem[]
  /** 分頁資訊 */
  pagination: PaginationInfo
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

/**
 * 規則狀態驗證 Schema
 */
export const RuleStatusSchema = z.enum(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'DEPRECATED'])

/**
 * 規則查詢參數驗證 Schema
 */
export const RulesQuerySchema = z.object({
  status: RuleStatusSchema.optional(),
  search: z.string().optional(),
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
  sortBy: z.enum(['fieldName', 'status', 'confidence', 'matchCount', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

/**
 * 驗證後的規則查詢參數類型
 */
export type ValidatedRulesQuery = z.infer<typeof RulesQuerySchema>

/**
 * Forwarder ID 參數驗證 Schema
 */
export const ForwarderIdSchema = z.object({
  id: z.string().cuid(),
})

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

// ============================================================
// Story 5.5: 新增/編輯 Forwarder 表單相關
// ============================================================

/**
 * 創建 Forwarder 表單驗證 Schema
 * @description Story 5.5 - 新增 Forwarder 的表單驗證
 */
export const CreateForwarderSchema = z.object({
  name: z
    .string()
    .min(1, '名稱為必填')
    .max(100, '名稱最多 100 個字符'),
  code: z
    .string()
    .min(2, '代碼至少 2 個字符')
    .max(20, '代碼最多 20 個字符')
    .regex(/^[A-Z0-9_]+$/, '代碼只能包含大寫字母、數字和底線')
    .transform((v) => v.toUpperCase()),
  description: z.string().max(500, '描述最多 500 個字符').optional().nullable(),
  contactEmail: z
    .string()
    .email('請輸入有效的電子郵件')
    .optional()
    .nullable()
    .or(z.literal('')),
  defaultConfidence: z.number().min(0).max(1),
})

/**
 * 創建 Forwarder 表單資料類型
 */
export type CreateForwarderFormData = z.infer<typeof CreateForwarderSchema>

/**
 * 創建 Forwarder API 請求資料（含 Logo）
 */
export interface CreateForwarderRequest extends CreateForwarderFormData {
  /** Logo 檔案（可選） */
  logo?: File | null
}

/**
 * 更新 Forwarder 表單驗證 Schema
 * @description Story 5.5 - 編輯 Forwarder 的表單驗證（不包含 code）
 */
export const UpdateForwarderSchema = z.object({
  name: z.string().min(1, '名稱為必填').max(100, '名稱最多 100 個字符').optional(),
  description: z.string().max(500, '描述最多 500 個字符').optional().nullable(),
  contactEmail: z
    .string()
    .email('請輸入有效的電子郵件')
    .optional()
    .nullable()
    .or(z.literal('')),
  defaultConfidence: z.number().min(0).max(1).optional(),
})

/**
 * 更新 Forwarder 表單資料類型
 */
export type UpdateForwarderFormData = z.infer<typeof UpdateForwarderSchema>

/**
 * 更新 Forwarder API 請求資料（含 Logo）
 */
export interface UpdateForwarderRequest extends UpdateForwarderFormData {
  /** 新的 Logo 檔案（可選） */
  logo?: File | null
  /** 是否移除現有 Logo */
  removeLogo?: boolean
}

/**
 * 停用 Forwarder Schema
 * @description Story 5.5 - 停用 Forwarder 的請求驗證
 */
export const DeactivateForwarderSchema = z.object({
  reason: z.string().max(500, '原因最多 500 個字符').optional(),
  deactivateRules: z.boolean().default(true),
})

/**
 * 停用 Forwarder 請求資料類型
 */
export type DeactivateForwarderRequest = z.infer<typeof DeactivateForwarderSchema>

/**
 * 啟用 Forwarder Schema
 * @description Story 5.5 - 啟用 Forwarder 的請求驗證
 */
export const ActivateForwarderSchema = z.object({
  reactivateRules: z.boolean().default(false),
})

/**
 * 啟用 Forwarder 請求資料類型
 */
export type ActivateForwarderRequest = z.infer<typeof ActivateForwarderSchema>

/**
 * 檢查代碼唯一性請求 Schema
 * @description Story 5.5 - 異步檢查 code 是否已存在
 */
export const CheckCodeSchema = z.object({
  code: z
    .string()
    .min(2, '代碼至少 2 個字符')
    .max(20, '代碼最多 20 個字符')
    .regex(/^[A-Z0-9_]+$/, '代碼只能包含大寫字母、數字和底線'),
  excludeId: z.string().uuid().optional(),
})

/**
 * 檢查代碼唯一性回應
 */
export interface CheckCodeResponse {
  /** 是否可用 */
  available: boolean
  /** 錯誤訊息（如果不可用） */
  message?: string
}

/**
 * Forwarder 創建成功回應
 */
export interface CreateForwarderResponse {
  success: true
  data: {
    id: string
    name: string
    code: string
    status: ForwarderStatus
    message: string
  }
}

/**
 * Forwarder 更新成功回應
 */
export interface UpdateForwarderResponse {
  success: true
  data: {
    id: string
    name: string
    code: string
    description: string | null
    logoUrl: string | null
    contactEmail: string | null
    defaultConfidence: number
    status: ForwarderStatus
    message: string
  }
}

/**
 * Forwarder 狀態變更回應
 */
export interface ForwarderStatusChangeResponse {
  success: true
  data: {
    id: string
    name: string
    status: ForwarderStatus
    rulesAffected?: number
    message: string
  }
}

/**
 * Logo 上傳限制
 */
export const LOGO_UPLOAD_CONFIG = {
  /** 最大檔案大小 (5MB) */
  maxSize: 5 * 1024 * 1024,
  /** 允許的 MIME 類型 */
  acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'],
  /** 檔案類型說明 */
  acceptedTypesLabel: 'PNG, JPG, WebP, GIF, SVG',
  /** 建議的尺寸 */
  recommendedSize: { width: 200, height: 200 },
} as const

/**
 * Forwarder 表單欄位標籤配置
 */
export const FORWARDER_FORM_LABELS = {
  name: {
    label: 'Forwarder 名稱',
    placeholder: '例如：DHL Express',
    description: '用於顯示的完整名稱',
  },
  code: {
    label: 'Forwarder 代碼',
    placeholder: '例如：DHL_EXPRESS',
    description: '唯一識別碼（大寫字母、數字、底線）',
  },
  description: {
    label: '描述',
    placeholder: '輸入 Forwarder 的描述...',
    description: '選填，最多 500 個字符',
  },
  contactEmail: {
    label: '聯絡電子郵件',
    placeholder: 'contact@example.com',
    description: '選填，用於接收通知',
  },
  defaultConfidence: {
    label: '預設信心度',
    description: '新規則的預設信心度閾值',
  },
  logo: {
    label: 'Logo 圖片',
    description: '選填，建議 200x200 像素',
  },
} as const

/**
 * 停用/啟用對話框文案
 */
export const FORWARDER_ACTION_DIALOGS = {
  deactivate: {
    title: '停用 Forwarder',
    description: '停用後將暫停此 Forwarder 的所有文件處理。確定要繼續嗎？',
    confirmText: '確認停用',
    cancelText: '取消',
    reasonLabel: '停用原因',
    reasonPlaceholder: '選填，輸入停用原因...',
    deactivateRulesLabel: '同時停用所有相關規則',
    warningMessage: '此 Forwarder 有 {ruleCount} 條啟用中的規則',
  },
  activate: {
    title: '啟用 Forwarder',
    description: '啟用後此 Forwarder 將恢復文件處理功能。確定要繼續嗎？',
    confirmText: '確認啟用',
    cancelText: '取消',
    reactivateRulesLabel: '同時重新啟用之前的規則',
    infoMessage: '此 Forwarder 有 {ruleCount} 條可恢復的規則',
  },
} as const
