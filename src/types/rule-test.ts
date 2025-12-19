/**
 * @fileoverview 規則測試相關類型定義
 * @description
 *   提供規則變更效果測試功能的 TypeScript 類型定義：
 *   - 測試任務狀態和變更類型
 *   - 測試配置和結果類型
 *   - 測試詳情類型
 *   - API 請求和響應類型
 *
 * @module src/types/rule-test
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @prisma/client - TestTaskStatus, TestChangeType enum
 *   - zod - 運行時驗證
 */

import type { TestTaskStatus, TestChangeType } from '@prisma/client'
import { z } from 'zod'

// Re-export Prisma enums for convenience
export type { TestTaskStatus, TestChangeType }

// ============================================================
// Test Scope Types
// ============================================================

/**
 * 測試範圍類型
 */
export type TestScope = 'recent' | 'specific' | 'date_range' | 'all'

/**
 * 測試範圍配置
 */
export const TEST_SCOPES: {
  value: TestScope
  label: string
  description: string
}[] = [
  {
    value: 'recent',
    label: '最近處理',
    description: '測試最近 N 筆處理過的文件',
  },
  {
    value: 'specific',
    label: '指定文件',
    description: '選擇特定文件進行測試',
  },
  {
    value: 'date_range',
    label: '日期範圍',
    description: '測試指定日期範圍內的文件',
  },
  {
    value: 'all',
    label: '全部文件',
    description: '測試該 Forwarder 的所有歷史文件',
  },
]

// ============================================================
// Test Configuration Types
// ============================================================

/**
 * 測試配置
 */
export interface TestConfig {
  /** 測試範圍 */
  scope: TestScope
  /** 最近文件數量（scope='recent' 時使用） */
  recentCount?: number
  /** 指定文件 ID 列表（scope='specific' 時使用） */
  documentIds?: string[]
  /** 日期範圍（scope='date_range' 時使用） */
  dateRange?: {
    start: string // ISO 格式日期
    end: string
  }
  /** 最大測試文件數 */
  maxDocuments?: number
}

/**
 * 測試配置驗證 Schema
 */
export const testConfigSchema = z
  .object({
    scope: z.enum(['recent', 'specific', 'date_range', 'all']),
    recentCount: z.number().min(1).max(1000).optional(),
    documentIds: z.array(z.string()).optional(),
    dateRange: z
      .object({
        start: z.string(),
        end: z.string(),
      })
      .optional(),
    maxDocuments: z.number().min(1).max(10000).optional(),
  })
  .refine(
    (data) => {
      if (data.scope === 'recent') return data.recentCount !== undefined
      if (data.scope === 'specific')
        return data.documentIds && data.documentIds.length > 0
      if (data.scope === 'date_range') return data.dateRange !== undefined
      return true
    },
    {
      message: '請根據選擇的範圍提供相應的配置',
    }
  )

// ============================================================
// Test Results Types
// ============================================================

/**
 * 測試結果摘要
 */
export interface TestResults {
  /** 改善數量（原錯新對） */
  improved: number
  /** 退化數量（原對新錯） */
  regressed: number
  /** 無變化數量 */
  unchanged: number
  /** 雙錯數量 */
  bothWrong: number
  /** 雙對數量 */
  bothRight: number
  /** 改善率 (百分比) */
  improvementRate: number
  /** 退化率 (百分比) */
  regressionRate: number
  /** 總測試文件數 */
  totalTested: number
  /** 原規則準確數 */
  originalAccurate: number
  /** 新規則準確數 */
  testAccurate: number
  /** 原規則準確率 */
  originalAccuracyRate: number
  /** 新規則準確率 */
  testAccuracyRate: number
}

/**
 * 變更類型配置
 */
export const TEST_CHANGE_TYPES: {
  value: TestChangeType
  label: string
  description: string
  color: 'success' | 'destructive' | 'secondary' | 'warning' | 'muted'
  icon: string
}[] = [
  {
    value: 'IMPROVED',
    label: '改善',
    description: '原規則錯誤，新規則正確',
    color: 'success',
    icon: 'TrendingUp',
  },
  {
    value: 'REGRESSED',
    label: '退化',
    description: '原規則正確，新規則錯誤',
    color: 'destructive',
    icon: 'TrendingDown',
  },
  {
    value: 'BOTH_RIGHT',
    label: '雙對',
    description: '原規則和新規則都正確',
    color: 'success',
    icon: 'CheckCircle2',
  },
  {
    value: 'BOTH_WRONG',
    label: '雙錯',
    description: '原規則和新規則都錯誤',
    color: 'warning',
    icon: 'XCircle',
  },
  {
    value: 'UNCHANGED',
    label: '無變化',
    description: '結果相同但無法判斷正確性',
    color: 'muted',
    icon: 'Minus',
  },
]

/**
 * 根據變更類型獲取配置
 */
export function getChangeTypeConfig(changeType: TestChangeType) {
  return (
    TEST_CHANGE_TYPES.find((t) => t.value === changeType) ?? TEST_CHANGE_TYPES[4]
  )
}

// ============================================================
// Test Task Status Types
// ============================================================

/**
 * 測試任務狀態配置
 */
export const TEST_TASK_STATUSES: {
  value: TestTaskStatus
  label: string
  description: string
  color: 'default' | 'secondary' | 'success' | 'destructive' | 'muted'
}[] = [
  {
    value: 'PENDING',
    label: '等待執行',
    description: '測試任務已建立，等待執行',
    color: 'default',
  },
  {
    value: 'RUNNING',
    label: '執行中',
    description: '測試正在進行中',
    color: 'secondary',
  },
  {
    value: 'COMPLETED',
    label: '已完成',
    description: '測試已完成',
    color: 'success',
  },
  {
    value: 'FAILED',
    label: '執行失敗',
    description: '測試執行過程中發生錯誤',
    color: 'destructive',
  },
  {
    value: 'CANCELLED',
    label: '已取消',
    description: '測試被使用者取消',
    color: 'muted',
  },
]

/**
 * 根據狀態獲取配置
 */
export function getTaskStatusConfig(status: TestTaskStatus) {
  return (
    TEST_TASK_STATUSES.find((s) => s.value === status) ?? TEST_TASK_STATUSES[0]
  )
}

// ============================================================
// Test Detail Types
// ============================================================

/**
 * 測試詳情項目
 */
export interface TestDetailItem {
  /** 詳情 ID */
  id: string
  /** 文件資訊 */
  document: {
    id: string
    fileName: string
    createdAt: string
  }
  /** 原規則提取結果 */
  originalResult: string | null
  /** 原規則信心度 */
  originalConfidence: number | null
  /** 新規則提取結果 */
  testResult: string | null
  /** 新規則信心度 */
  testConfidence: number | null
  /** 實際正確值 */
  actualValue: string | null
  /** 原規則是否準確 */
  originalAccurate: boolean
  /** 新規則是否準確 */
  testAccurate: boolean
  /** 變更類型 */
  changeType: TestChangeType
  /** 備註 */
  notes: string | null
}

// ============================================================
// Test Task Types
// ============================================================

/**
 * 測試任務基本資訊
 */
export interface RuleTestTask {
  /** 任務 ID */
  id: string
  /** 規則資訊 */
  rule: {
    id: string
    fieldName: string
    fieldLabel: string
  }
  /** Forwarder 資訊 */
  forwarder: {
    id: string
    name: string
    code: string
  }
  /** 原始提取模式 */
  originalPattern: unknown | null
  /** 測試提取模式 */
  testPattern: unknown
  /** 測試配置 */
  config: TestConfig
  /** 任務狀態 */
  status: TestTaskStatus
  /** 進度百分比 (0-100) */
  progress: number
  /** 總測試文件數 */
  totalDocuments: number
  /** 已測試文件數 */
  testedDocuments: number
  /** 測試結果（完成後） */
  results: TestResults | null
  /** 錯誤訊息 */
  errorMessage: string | null
  /** 開始時間 */
  startedAt: string | null
  /** 完成時間 */
  completedAt: string | null
  /** 創建者 */
  createdBy: {
    id: string
    name: string
  }
  /** 創建時間 */
  createdAt: string
}

// ============================================================
// API Request Types
// ============================================================

/**
 * 啟動測試請求參數
 */
export interface StartRuleTestRequest {
  /** 測試的規則模式 */
  testPattern: unknown
  /** 測試配置 */
  config: TestConfig
}

/**
 * 啟動測試請求驗證 Schema
 */
export const startRuleTestRequestSchema = z.object({
  testPattern: z.unknown(),
  config: testConfigSchema,
})

/**
 * 取消測試請求
 */
export interface CancelRuleTestRequest {
  /** 任務 ID */
  taskId: string
}

// ============================================================
// API Response Types
// ============================================================

/**
 * 啟動測試響應
 */
export interface StartRuleTestResponse {
  success: true
  data: {
    /** 任務 ID */
    taskId: string
    /** 任務狀態 */
    status: TestTaskStatus
    /** 預估測試文件數 */
    estimatedDocuments: number
    /** 提示訊息 */
    message: string
  }
}

/**
 * 測試任務狀態響應
 */
export interface RuleTestTaskResponse {
  success: true
  data: RuleTestTask
}

/**
 * 測試詳情列表響應
 */
export interface RuleTestDetailsResponse {
  success: true
  data: {
    details: TestDetailItem[]
    pagination: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
  }
}

/**
 * 測試報告生成響應
 */
export interface RuleTestReportResponse {
  success: true
  data: {
    /** 報告下載 URL */
    downloadUrl: string
    /** 報告格式 */
    format: 'pdf' | 'excel'
    /** 報告檔名 */
    fileName: string
    /** 過期時間 */
    expiresAt: string
  }
}

// ============================================================
// Query Parameters Types
// ============================================================

/**
 * 測試詳情查詢參數
 */
export interface TestDetailsQueryParams {
  /** 頁碼 */
  page?: number
  /** 每頁筆數 */
  pageSize?: number
  /** 變更類型篩選 */
  changeType?: TestChangeType
  /** 排序欄位 */
  sortBy?: 'createdAt' | 'changeType' | 'confidence'
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 測試歷史查詢參數
 */
export interface TestHistoryQueryParams {
  /** 規則 ID */
  ruleId?: string
  /** Forwarder ID */
  forwarderId?: string
  /** 狀態篩選 */
  status?: TestTaskStatus
  /** 頁碼 */
  page?: number
  /** 每頁筆數 */
  pageSize?: number
}

// ============================================================
// Report Types
// ============================================================

/**
 * 報告格式
 */
export type ReportFormat = 'pdf' | 'excel'

/**
 * 報告格式配置
 */
export const REPORT_FORMATS: {
  value: ReportFormat
  label: string
  mimeType: string
  extension: string
}[] = [
  {
    value: 'pdf',
    label: 'PDF 報告',
    mimeType: 'application/pdf',
    extension: '.pdf',
  },
  {
    value: 'excel',
    label: 'Excel 報告',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
]
