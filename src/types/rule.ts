/**
 * @fileoverview 映射規則相關類型定義
 * @description
 *   提供映射規則管理功能的 TypeScript 類型定義：
 *   - 規則列表查詢和響應類型
 *   - 規則詳情類型
 *   - 提取方法配置
 *   - 規則狀態配置
 *
 * @module src/types/rule
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @prisma/client - RuleStatus enum
 */

import type { RuleStatus } from '@prisma/client'

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
