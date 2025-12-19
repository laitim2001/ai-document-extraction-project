/**
 * @fileoverview 映射規則相關類型定義
 * @description
 *   提供映射規則管理功能的 TypeScript 類型定義：
 *   - 規則列表查詢和響應類型
 *   - 規則詳情類型
 *   - 提取方法配置
 *   - 規則狀態配置
 *   - 規則創建和測試相關類型 (Story 4-2)
 *
 * @module src/types/rule
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @prisma/client - RuleStatus, ExtractionType enum
 *   - zod - 運行時驗證
 */

import type { RuleStatus } from '@prisma/client'
import { z } from 'zod'

/**
 * 提取類型枚舉（非 Prisma 類型）
 * 用於 Story 4-2 規則建議功能
 */
export type ExtractionType =
  | 'REGEX'
  | 'POSITION'
  | 'KEYWORD'
  | 'AI_PROMPT'
  | 'TEMPLATE'

// ============================================================
// Extraction Method Types
// ============================================================

/**
 * 提取方法類型
 * 對應 extractionPattern.method 的可能值
 */
export type ExtractionMethod =
  | 'regex'       // 正則表達式
  | 'keyword'     // 關鍵字匹配
  | 'position'    // 位置提取（座標）
  | 'azure_field' // Azure DI 欄位
  | 'ai_prompt'   // AI 提示詞

/**
 * 提取模式 JSON 結構
 */
export interface ExtractionPattern {
  /** 提取方法 */
  method: ExtractionMethod
  /** 正則表達式模式 */
  pattern?: string
  /** 關鍵字列表 */
  keywords?: string[]
  /** 位置數據 */
  position?: {
    page: number
    region: {
      x: number
      y: number
      width: number
      height: number
    }
  }
  /** Azure DI 欄位名稱 */
  azureFieldName?: string
  /** AI 提取提示詞 */
  aiPrompt?: string
  /** 信心度加成 */
  confidence_boost?: number
}

// ============================================================
// Rule List Types (AC1)
// ============================================================

/**
 * 規則列表查詢參數
 */
export interface RulesQueryParams {
  /** Forwarder ID 篩選 */
  forwarderId?: string
  /** 欄位名稱搜索 */
  fieldName?: string
  /** 狀態篩選 */
  status?: RuleStatus
  /** 類別篩選 */
  category?: string
  /** 頁碼 */
  page?: number
  /** 每頁筆數 */
  pageSize?: number
  /** 排序欄位 */
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'fieldName'
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 規則列表項
 */
export interface RuleListItem {
  /** 規則 ID */
  id: string
  /** 關聯的 Forwarder */
  forwarder: {
    id: string
    name: string
    code: string
  } | null
  /** 標準欄位名稱 */
  fieldName: string
  /** 顯示標籤 */
  fieldLabel: string
  /** 提取模式 */
  extractionPattern: ExtractionPattern
  /** 規則狀態 */
  status: RuleStatus
  /** 版本號 */
  version: number
  /** 優先級 */
  priority: number
  /** 是否為必填欄位 */
  isRequired: boolean
  /** 欄位類別 */
  category: string | null
  /** 創建者 */
  createdBy: {
    id: string
    name: string
  } | null
  /** 創建時間 */
  createdAt: string
  /** 更新時間 */
  updatedAt: string
  /** 統計數據 */
  stats: {
    /** 應用次數 */
    applicationCount: number
    /** 成功率 (百分比) */
    successRate: number | null
    /** 最後應用時間 */
    lastAppliedAt: string | null
  }
}

/**
 * 規則列表摘要
 */
export interface RulesSummary {
  /** 總規則數 */
  totalRules: number
  /** 生效中規則數 */
  activeRules: number
  /** 草稿規則數 */
  draftRules: number
  /** 待審核規則數 */
  pendingReviewRules: number
  /** 已棄用規則數 */
  deprecatedRules: number
  /** 通用規則數 (forwarderId = NULL) */
  universalRules: number
}

/**
 * 規則列表 API 響應
 */
export interface RulesListResponse {
  success: true
  data: {
    rules: RuleListItem[]
    pagination: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
    summary: RulesSummary
  }
}

// ============================================================
// Rule Detail Types (AC2)
// ============================================================

/**
 * 規則統計數據
 */
export interface RuleStats {
  /** 總應用次數 */
  totalApplications: number
  /** 成功應用次數 */
  successfulApplications: number
  /** 成功率 (百分比) */
  successRate: number | null
  /** 最近 7 天應用次數 */
  last7DaysApplications: number
  /** 最近 7 天成功率 */
  last7DaysSuccessRate: number | null
  /** 平均信心度 */
  averageConfidence: number
  /** 趨勢方向 */
  trend: 'up' | 'down' | 'stable'
  /** 趨勢變化百分比 */
  trendPercentage: number
}

/**
 * 最近應用記錄
 */
export interface RecentApplication {
  /** 記錄 ID */
  id: string
  /** 文件 ID */
  documentId: string
  /** 文件名稱 */
  documentName: string
  /** 提取的值 */
  extractedValue: string | null
  /** 是否準確 */
  isAccurate: boolean | null
  /** 應用時間 */
  appliedAt: string
}

/**
 * 規則詳情
 */
export interface RuleDetail {
  /** 規則 ID */
  id: string
  /** 關聯的 Forwarder */
  forwarder: {
    id: string
    name: string
    code: string
    logoUrl?: string
  } | null
  /** 標準欄位名稱 */
  fieldName: string
  /** 顯示標籤 */
  fieldLabel: string
  /** 提取模式 */
  extractionPattern: ExtractionPattern
  /** 信心度閾值 */
  confidence: number
  /** 優先級 */
  priority: number
  /** 規則狀態 */
  status: RuleStatus
  /** 版本號 */
  version: number
  /** 規則描述 */
  description: string | null
  /** 是否為必填 */
  isRequired: boolean
  /** 驗證正則 */
  validationPattern: string | null
  /** 預設值 */
  defaultValue: string | null
  /** 欄位類別 */
  category: string | null
  /** 創建者 */
  createdBy: {
    id: string
    name: string
    email: string
  } | null
  /** 創建時間 */
  createdAt: string
  /** 更新時間 */
  updatedAt: string
  /** 統計數據 */
  stats: RuleStats
  /** 最近應用記錄 */
  recentApplications: RecentApplication[]
}

/**
 * 規則詳情 API 響應
 */
export interface RuleDetailResponse {
  success: true
  data: RuleDetail
}

// ============================================================
// Extraction Method Configuration
// ============================================================

/**
 * 提取方法配置
 */
export const EXTRACTION_METHODS: {
  value: ExtractionMethod
  label: string
  description: string
  icon: string
  color: string
}[] = [
  {
    value: 'regex',
    label: '正則表達式',
    description: '使用正則表達式匹配文字模式',
    icon: 'Regex',
    color: 'blue',
  },
  {
    value: 'position',
    label: '位置提取',
    description: '根據 PDF 座標位置提取',
    icon: 'Target',
    color: 'green',
  },
  {
    value: 'keyword',
    label: '關鍵字匹配',
    description: '根據關鍵字定位提取',
    icon: 'Search',
    color: 'yellow',
  },
  {
    value: 'ai_prompt',
    label: 'AI 提示詞',
    description: '使用 LLM 智能提取',
    icon: 'Brain',
    color: 'purple',
  },
  {
    value: 'azure_field',
    label: 'Azure DI 欄位',
    description: '直接使用 Azure Document Intelligence 欄位',
    icon: 'Cloud',
    color: 'cyan',
  },
]

// ============================================================
// Rule Status Configuration
// ============================================================

/**
 * 規則狀態配置
 */
export const RULE_STATUSES: {
  value: RuleStatus
  label: string
  description: string
  color: 'success' | 'secondary' | 'warning' | 'muted' | 'destructive'
}[] = [
  {
    value: 'ACTIVE',
    label: '生效中',
    description: '規則正在被系統使用',
    color: 'success',
  },
  {
    value: 'DRAFT',
    label: '草稿',
    description: '規則尚未啟用',
    color: 'secondary',
  },
  {
    value: 'PENDING_REVIEW',
    label: '待審核',
    description: '規則等待 Super User 審核',
    color: 'warning',
  },
  {
    value: 'DEPRECATED',
    label: '已棄用',
    description: '規則已被新版本取代',
    color: 'muted',
  },
]

/**
 * 根據狀態值獲取狀態配置
 */
export function getRuleStatusConfig(status: RuleStatus) {
  return RULE_STATUSES.find((s) => s.value === status) ?? RULE_STATUSES[0]
}

/**
 * 根據提取方法獲取配置
 */
export function getExtractionMethodConfig(method: ExtractionMethod) {
  return EXTRACTION_METHODS.find((m) => m.value === method) ?? EXTRACTION_METHODS[0]
}

// ============================================================
// Field Category Configuration
// ============================================================

/**
 * 欄位類別
 */
export const FIELD_CATEGORIES: {
  value: string
  label: string
}[] = [
  { value: 'basic', label: '基本資訊' },
  { value: 'amount', label: '金額相關' },
  { value: 'party', label: '相關方' },
  { value: 'logistics', label: '物流資訊' },
  { value: 'reference', label: '參考編號' },
  { value: 'other', label: '其他' },
]

// ============================================================
// Standard Field Names
// ============================================================

/**
 * 標準欄位名稱配置
 */
export const STANDARD_FIELD_NAMES: {
  name: string
  label: string
  category: string
}[] = [
  // 基本資訊
  { name: 'invoice_number', label: '發票號碼', category: 'basic' },
  { name: 'invoice_date', label: '發票日期', category: 'basic' },
  { name: 'due_date', label: '到期日', category: 'basic' },
  // 金額相關
  { name: 'total_amount', label: '總金額', category: 'amount' },
  { name: 'currency', label: '幣別', category: 'amount' },
  { name: 'tax_amount', label: '稅額', category: 'amount' },
  { name: 'subtotal', label: '小計', category: 'amount' },
  // 相關方
  { name: 'shipper_name', label: '發貨人名稱', category: 'party' },
  { name: 'consignee_name', label: '收貨人名稱', category: 'party' },
  { name: 'notify_party', label: '通知方', category: 'party' },
  // 物流資訊
  { name: 'container_number', label: '貨櫃號', category: 'logistics' },
  { name: 'bl_number', label: '提單號', category: 'logistics' },
  { name: 'vessel_name', label: '船名', category: 'logistics' },
  { name: 'voyage_number', label: '航次', category: 'logistics' },
  { name: 'port_of_loading', label: '裝貨港', category: 'logistics' },
  { name: 'port_of_discharge', label: '卸貨港', category: 'logistics' },
  { name: 'etd', label: '預計開航日', category: 'logistics' },
  { name: 'eta', label: '預計到港日', category: 'logistics' },
  // 參考編號
  { name: 'reference_number', label: '參考編號', category: 'reference' },
  { name: 'po_number', label: '採購單號', category: 'reference' },
  { name: 'booking_number', label: '訂艙號', category: 'reference' },
]

/**
 * 根據欄位名稱獲取標準欄位配置
 */
export function getStandardFieldConfig(fieldName: string) {
  return STANDARD_FIELD_NAMES.find((f) => f.name === fieldName)
}

// ============================================================
// Rule Creation Types (Story 4-2)
// ============================================================

/**
 * 正則表達式模式配置
 */
export interface RegexPattern {
  /** 模式類型標識 */
  type: 'REGEX'
  /** 正則表達式 */
  expression: string
  /** 正則標誌 (i, g, m 等) */
  flags?: string
  /** 命名捕獲組 */
  groups?: string[]
}

/**
 * 位置提取模式配置
 */
export interface PositionPattern {
  /** 模式類型標識 */
  type: 'POSITION'
  /** 座標配置 */
  coordinates: {
    /** 頁碼 */
    page: number
    /** X 座標 (百分比 0-100) */
    x: number
    /** Y 座標 (百分比 0-100) */
    y: number
    /** 寬度 (百分比 0-100) */
    width: number
    /** 高度 (百分比 0-100) */
    height: number
  }
  /** 容差百分比 (0-50) */
  tolerance?: number
}

/**
 * 關鍵字匹配模式配置
 */
export interface KeywordPattern {
  /** 模式類型標識 */
  type: 'KEYWORD'
  /** 關鍵字列表 */
  keywords: string[]
  /** 相對位置 */
  position: 'before' | 'after' | 'above' | 'below'
  /** 偏移量 */
  offset?: number
  /** 最大搜索距離 */
  maxDistance?: number
}

/**
 * AI 提示詞模式配置
 */
export interface PromptPattern {
  /** 模式類型標識 */
  type: 'AI_PROMPT'
  /** 提示詞內容 */
  prompt: string
  /** 輸出格式 */
  outputFormat?: string
  /** 範例 */
  examples?: {
    input: string
    output: string
  }[]
}

/**
 * 模板匹配模式配置
 */
export interface TemplatePattern {
  /** 模式類型標識 */
  type: 'TEMPLATE'
  /** 模板 ID */
  templateId?: string
  /** 區域配置 */
  regions: {
    name: string
    coordinates: PositionPattern['coordinates']
  }[]
}

/**
 * Pattern 配置聯合類型
 * 根據提取類型選擇對應的配置結構
 */
export type PatternConfig =
  | RegexPattern
  | PositionPattern
  | KeywordPattern
  | PromptPattern
  | TemplatePattern

/**
 * 創建規則請求參數
 */
export interface CreateRuleRequest {
  /** Forwarder ID */
  forwarderId: string
  /** 目標欄位名稱 */
  fieldName: string
  /** 提取類型 */
  extractionType: ExtractionType
  /** Pattern 配置（字符串或對象） */
  pattern: string | PatternConfig
  /** 優先級 (0-100) */
  priority?: number
  /** 信心度閾值 (0-1) */
  confidence?: number
  /** 規則描述 */
  description?: string
  /** 是否儲存為草稿 */
  saveAsDraft?: boolean
}

/**
 * 創建規則響應
 */
export interface CreateRuleResponse {
  success: true
  data: {
    /** 規則建議 ID */
    suggestionId: string
    /** 狀態 */
    status: 'DRAFT' | 'PENDING_REVIEW'
    /** 提示訊息 */
    message: string
  }
}

// ============================================================
// Rule Testing Types (Story 4-2)
// ============================================================

/**
 * 測試規則請求參數
 */
export interface TestRuleRequest {
  /** 提取類型 */
  extractionType: ExtractionType
  /** Pattern 配置 */
  pattern: string | PatternConfig
  /** 已上傳的文件 ID */
  documentId?: string
  /** Base64 編碼的文件內容 */
  documentContent?: string
}

/**
 * 匹配位置資訊
 */
export interface MatchPosition {
  /** 頁碼 */
  page: number
  /** X 座標 */
  x: number
  /** Y 座標 */
  y: number
  /** 寬度 */
  width: number
  /** 高度 */
  height: number
  /** 匹配的文字 */
  text: string
}

/**
 * 測試規則響應
 */
export interface TestRuleResponse {
  success: true
  data: {
    /** 是否匹配成功 */
    matched: boolean
    /** 提取的值 */
    extractedValue: string | null
    /** 信心度 */
    confidence: number
    /** 匹配位置列表 */
    matchPositions?: MatchPosition[]
    /** 調試資訊 */
    debugInfo?: {
      /** 處理時間 (毫秒) */
      processingTime: number
      /** 匹配嘗試次數 */
      matchAttempts: number
      /** 錯誤訊息列表 */
      errors?: string[]
    }
  }
}

// ============================================================
// Rule Creation Validation Schemas (Story 4-2)
// ============================================================

/**
 * 正則模式驗證 Schema
 */
export const regexPatternSchema = z.object({
  expression: z
    .string()
    .min(1, '請輸入正則表達式')
    .refine(
      (val) => {
        try {
          new RegExp(val)
          return true
        } catch {
          return false
        }
      },
      { message: '正則表達式語法錯誤' }
    ),
  flags: z.string().optional(),
  groups: z.array(z.string()).optional(),
})

/**
 * 位置模式驗證 Schema
 */
export const positionPatternSchema = z.object({
  coordinates: z.object({
    page: z.number().min(1, '頁碼必須大於 0'),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(0).max(100),
    height: z.number().min(0).max(100),
  }),
  tolerance: z.number().min(0).max(50).optional(),
})

/**
 * 關鍵字模式驗證 Schema
 */
export const keywordPatternSchema = z.object({
  keywords: z.array(z.string()).min(1, '至少需要一個關鍵字'),
  position: z.enum(['before', 'after', 'above', 'below']),
  offset: z.number().optional(),
  maxDistance: z.number().optional(),
})

/**
 * AI 提示詞模式驗證 Schema
 */
export const promptPatternSchema = z.object({
  prompt: z.string().min(10, '提示詞至少需要 10 個字符'),
  outputFormat: z.string().optional(),
  examples: z
    .array(
      z.object({
        input: z.string(),
        output: z.string(),
      })
    )
    .optional(),
})

/**
 * 模板模式驗證 Schema
 */
export const templatePatternSchema = z.object({
  templateId: z.string().optional(),
  regions: z
    .array(
      z.object({
        name: z.string().min(1, '區域名稱不能為空'),
        coordinates: z.object({
          page: z.number().min(1),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          width: z.number().min(0).max(100),
          height: z.number().min(0).max(100),
        }),
      })
    )
    .min(1, '至少需要一個區域'),
})

/**
 * 創建規則表單驗證 Schema
 */
export const createRuleFormSchema = z.object({
  forwarderId: z.string().min(1, '請選擇 Forwarder'),
  fieldName: z.string().min(1, '請選擇目標欄位'),
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  pattern: z.string().min(1, '請輸入提取模式'),
  priority: z.number().min(0).max(100).default(0),
  confidence: z.number().min(0).max(1).default(0.8),
  description: z.string().optional(),
  saveAsDraft: z.boolean().optional(),
})

/**
 * 創建規則表單類型
 */
export type CreateRuleFormValues = z.infer<typeof createRuleFormSchema>

/**
 * 測試規則請求驗證 Schema
 */
export const testRuleRequestSchema = z
  .object({
    extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
    pattern: z.string().or(z.record(z.string(), z.unknown())),
    documentId: z.string().optional(),
    documentContent: z.string().optional(),
  })
  .refine((data) => data.documentId || data.documentContent, {
    message: '請提供文件 ID 或文件內容',
  })
