/**
 * @fileoverview 規則版本歷史相關類型定義
 * @description
 *   定義版本歷史管理功能所需的所有 TypeScript 類型，
 *   包括版本詳情、對比結果、回滾請求等。
 *
 * @module src/types/version
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 版本詳情類型
 *   - 版本歷史列表響應
 *   - 版本對比類型
 *   - 回滾請求與結果類型
 *
 * @related
 *   - prisma/schema.prisma - RuleVersion 模型
 *   - src/app/api/rules/[id]/versions - 版本歷史 API
 */

// ============================================================
// Extraction Pattern Type
// ============================================================

/**
 * 提取模式
 * 對應 Prisma 中的 extractionPattern Json 欄位結構
 */
export interface ExtractionPattern {
  /** 提取方法 */
  method: 'regex' | 'keyword' | 'position' | 'azure_field' | 'ai_prompt' | 'template'
  /** 正則表達式模式（regex 方法） */
  pattern?: string
  /** 關鍵字列表（keyword 方法） */
  keywords?: string[]
  /** 位置信息（position 方法） */
  position?: {
    page?: number
    region?: string
  }
  /** Azure 欄位名稱（azure_field 方法） */
  azureFieldName?: string
  /** AI 提示詞（ai_prompt 方法） */
  aiPrompt?: string
  /** 信心度加成 */
  confidence_boost?: number
}

// ============================================================
// Version Detail Types
// ============================================================

/**
 * 版本創建者信息
 */
export interface VersionCreator {
  /** 用戶 ID */
  id: string
  /** 用戶名稱 */
  name: string | null
  /** 用戶郵箱 */
  email: string
}

/**
 * 版本詳情
 */
export interface VersionDetail {
  /** 版本記錄 ID */
  id: string
  /** 版本號 */
  version: number
  /** 提取模式 */
  extractionPattern: ExtractionPattern
  /** 信心度 (0-1) */
  confidence: number
  /** 優先級 */
  priority: number
  /** 變更原因 */
  changeReason: string | null
  /** 創建者 */
  createdBy: VersionCreator
  /** 創建時間 (ISO 8601) */
  createdAt: string
  /** 是否為當前活躍版本 */
  isActive: boolean
}

// ============================================================
// API Response Types
// ============================================================

/**
 * 版本歷史列表響應
 */
export interface VersionsResponse {
  /** 規則 ID */
  ruleId: string
  /** 規則名稱 (欄位名稱) */
  ruleName: string
  /** 欄位標籤 */
  fieldLabel: string
  /** 當前活躍版本號 */
  currentVersion: number
  /** 版本總數 */
  totalVersions: number
  /** 版本列表 */
  versions: VersionDetail[]
}

// ============================================================
// Comparison Types
// ============================================================

/**
 * 欄位差異項目
 */
export interface FieldDifference {
  /** 欄位名稱 */
  field: string
  /** 欄位標籤 */
  label: string
  /** 版本 1 的值 */
  value1: string | number | null
  /** 版本 2 的值 */
  value2: string | number | null
  /** 是否有變更 */
  changed: boolean
}

/**
 * Pattern 差異分析
 */
export interface PatternDiff {
  /** 新增的內容行 */
  added: string[]
  /** 移除的內容行 */
  removed: string[]
  /** 未變更的內容行 */
  unchanged: string[]
}

/**
 * 版本對比響應
 */
export interface CompareResponse {
  /** 版本 1 詳情 */
  version1: VersionDetail
  /** 版本 2 詳情 */
  version2: VersionDetail
  /** 欄位差異列表 */
  differences: FieldDifference[]
  /** Pattern 差異分析 */
  patternDiff: PatternDiff
  /** 人類可讀的差異摘要 */
  summaryText: string
}

// ============================================================
// Rollback Types
// ============================================================

/**
 * 回滾請求
 */
export interface RollbackRequest {
  /** 目標版本 ID */
  targetVersionId: string
  /** 回滾原因（選填） */
  reason?: string
}

/**
 * 回滾結果
 */
export interface RollbackResult {
  /** 規則 ID */
  ruleId: string
  /** 原版本號 */
  fromVersion: number
  /** 回滾目標版本號 */
  toVersion: number
  /** 新創建的版本號 */
  newVersion: number
  /** 結果訊息 */
  message: string
  /** 創建時間 (ISO 8601) */
  createdAt: string
}

// ============================================================
// Version Summary Type (for list view)
// ============================================================

/**
 * 版本摘要（用於列表顯示）
 */
export interface VersionSummary {
  /** 版本記錄 ID */
  id: string
  /** 版本號 */
  version: number
  /** 信心度 (0-1) */
  confidence: number
  /** 優先級 */
  priority: number
  /** 變更原因 */
  changeReason: string | null
  /** 創建者 */
  createdBy: VersionCreator
  /** 創建時間 (ISO 8601) */
  createdAt: string
  /** 是否為當前活躍版本 */
  isActive: boolean
}

// ============================================================
// UI State Types
// ============================================================

/**
 * 版本選擇狀態
 */
export interface VersionSelectionState {
  /** 已選擇的版本 ID 列表 */
  selectedVersions: string[]
  /** 最大選擇數量 */
  maxSelection: 2
}

// ============================================================
// API Query Parameters
// ============================================================

/**
 * 版本列表查詢參數
 */
export interface VersionsQueryParams {
  /** 返回數量限制（預設 20，最大 100） */
  limit?: number
  /** 分頁偏移（預設 0） */
  offset?: number
}

/**
 * 版本對比查詢參數
 */
export interface CompareQueryParams {
  /** 版本 1 ID */
  v1: string
  /** 版本 2 ID */
  v2: string
}
