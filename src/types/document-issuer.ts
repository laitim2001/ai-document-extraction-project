/**
 * @fileoverview 文件發行者識別相關類型定義
 * @description
 *   - 定義文件發行者識別相關的 TypeScript 類型
 *   - 區分 documentIssuer（發行者）與 transactionParties（交易對象）
 *   - 提供發行者匹配結果和配置類型
 *
 * @module src/types/document-issuer
 * @since Epic 0 - Story 0.8 (文件發行者識別)
 * @lastModified 2025-12-26
 *
 * @features
 *   - IssuerIdentificationMethod: 發行者識別方法 enum
 *   - TransactionPartyRole: 交易對象角色 enum
 *   - DocumentIssuerResult: 發行者識別結果
 *   - TransactionParty: 交易對象信息
 *   - IssuerIdentificationConfig: 識別配置
 */

// ============================================================
// Enums (與 Prisma Schema 保持一致)
// ============================================================

/**
 * 發行者識別方法
 * 表示從文件哪個區域識別出發行者
 */
export type IssuerIdentificationMethod =
  | 'LOGO'        // 從公司 Logo 識別
  | 'HEADER'      // 從文件標題區識別
  | 'LETTERHEAD'  // 從信頭紙識別
  | 'FOOTER'      // 從頁尾識別
  | 'AI_INFERENCE' // AI 推斷（無明確視覺線索）

/**
 * 交易對象角色
 * 表示公司在交易中扮演的角色
 */
export type TransactionPartyRole =
  | 'VENDOR'        // 供應商
  | 'SHIPPER'       // 發貨人
  | 'CONSIGNEE'     // 收貨人
  | 'CARRIER'       // 承運人
  | 'BUYER'         // 買方
  | 'SELLER'        // 賣方
  | 'NOTIFY_PARTY'  // 通知方
  | 'OTHER'         // 其他

// ============================================================
// Interfaces
// ============================================================

/**
 * GPT Vision 提取的發行者原始信息
 * 來自 AI 模型的直接輸出
 */
export interface RawDocumentIssuerInfo {
  /** 發行公司名稱（從 Logo/標題識別） */
  name: string
  /** 識別方法 */
  identificationMethod: IssuerIdentificationMethod
  /** 識別信心度 (0-100) */
  confidence: number
  /** 原始文字（在文件上看到的原始公司名稱） */
  rawText?: string
}

/**
 * 文件發行者識別結果
 * 包含 AI 提取結果和公司匹配結果
 */
export interface DocumentIssuerResult {
  /** 發行公司名稱 */
  name: string
  /** 識別方法 */
  identificationMethod: IssuerIdentificationMethod
  /** 識別信心度 (0-100) */
  confidence: number
  /** 原始文字 */
  rawText?: string
  /** 匹配到的公司 ID */
  companyId?: string
  /** 是否為新建公司 */
  isNewCompany?: boolean
  /** 公司匹配類型 */
  matchType?: 'EXACT' | 'VARIANT' | 'FUZZY' | 'NEW'
  /** 公司匹配分數 */
  matchScore?: number
}

/**
 * 交易對象信息
 */
export interface TransactionParty {
  /** 交易角色 */
  role: TransactionPartyRole
  /** 公司/組織名稱 */
  name: string
  /** 匹配到的公司 ID（如果有） */
  companyId?: string
  /** 是否為新建公司 */
  isNewCompany?: boolean
  /** 公司匹配類型 */
  matchType?: 'EXACT' | 'VARIANT' | 'FUZZY' | 'NEW'
  /** 公司匹配分數 */
  matchScore?: number
}

/**
 * 發行者識別配置
 */
export interface IssuerIdentificationConfig {
  /** 是否啟用發行者識別 */
  enabled: boolean
  /** 識別信心度閾值（低於此值需人工確認） */
  confidenceThreshold: number
  /** 識別方法優先順序 */
  methodPriority: IssuerIdentificationMethod[]
  /** 是否自動創建新公司 */
  createCompanyIfNotFound: boolean
  /** 模糊匹配閾值 */
  fuzzyMatchThreshold: number
}

/**
 * 發行者識別統計
 * 用於批量處理統計
 */
export interface IssuerIdentificationStats {
  /** 總處理文件數 */
  totalFiles: number
  /** 成功識別數 */
  identifiedCount: number
  /** 失敗數 */
  failedCount: number
  /** 低信心度數（需人工確認） */
  lowConfidenceCount: number
  /** 新建公司數 */
  newCompanyCount: number
  /** 識別方法分佈 */
  methodDistribution: Record<IssuerIdentificationMethod, number>
  /** 公司分佈（公司 ID -> 文件數） */
  issuerDistribution: Record<string, number>
}

/**
 * 交易對象處理結果
 */
export interface TransactionPartyProcessingResult {
  /** 處理的文件 ID */
  fileId: string
  /** 交易對象列表 */
  parties: TransactionParty[]
  /** 處理成功 */
  success: boolean
  /** 錯誤信息 */
  error?: string
}

// ============================================================
// Constants
// ============================================================

/**
 * 預設發行者識別配置
 */
export const DEFAULT_ISSUER_CONFIG: IssuerIdentificationConfig = {
  enabled: true,
  confidenceThreshold: 70,
  methodPriority: ['LOGO', 'HEADER', 'LETTERHEAD', 'FOOTER', 'AI_INFERENCE'],
  createCompanyIfNotFound: true,
  fuzzyMatchThreshold: 0.9,
}

/**
 * 識別方法優先級權重
 * 用於計算綜合信心度
 */
export const METHOD_PRIORITY_WEIGHTS: Record<IssuerIdentificationMethod, number> = {
  LOGO: 1.0,        // Logo 識別最可靠
  HEADER: 0.95,     // 標題區次之
  LETTERHEAD: 0.90, // 信頭紙
  FOOTER: 0.85,     // 頁尾
  AI_INFERENCE: 0.75, // AI 推斷最低
}
