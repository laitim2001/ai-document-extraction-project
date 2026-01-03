/**
 * @fileoverview 術語學習系統類型定義
 * @description
 *   定義持續術語學習流程所需的所有類型：
 *   - 術語狀態與來源枚舉
 *   - 術語檢測與匹配結果
 *   - 術語記錄與驗證請求
 *   - 同義詞候選與統計數據
 *
 * @module src/types/term-learning
 * @since Epic 15 - Story 15.4 (持續術語學習)
 * @lastModified 2026-01-03
 *
 * @related
 *   - src/services/unified-processor/steps/term-recording.step.ts - 術語記錄步驟
 *   - src/services/unified-processor/adapters/term-recorder-adapter.ts - 術語記錄適配器
 *   - src/types/term-validation.ts - AI 術語驗證類型（注意：TermCategory 用途不同）
 *   - src/services/hierarchical-term-aggregation.service.ts - 底層術語聚合服務
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * 術語狀態枚舉
 * @description 追蹤術語在驗證流程中的狀態
 */
export enum TermStatus {
  /** 待驗證 - 新發現的術語，等待人工確認 */
  PENDING = 'PENDING',
  /** 已驗證 - 人工確認為有效術語 */
  VERIFIED = 'VERIFIED',
  /** 已拒絕 - 人工確認為無效術語（地址、人名等） */
  REJECTED = 'REJECTED',
  /** 系統預設 - 系統內建的通用術語 */
  SYSTEM = 'SYSTEM',
  /** 已棄用 - 曾經有效但已不再使用 */
  DEPRECATED = 'DEPRECATED',
}

/**
 * 術語來源枚舉
 * @description 記錄術語是如何被添加到系統中的
 */
export enum TermSource {
  /** 歷史數據初始化 - Epic 0 批次處理產生 */
  HISTORICAL_INIT = 'HISTORICAL_INIT',
  /** 日常自動處理 - 日常文件處理時自動發現 */
  DAILY_AUTO = 'DAILY_AUTO',
  /** 人工審核添加 - 審核員手動添加 */
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  /** AI 建議 - GPT-4o 分類建議 */
  AI_SUGGESTION = 'AI_SUGGESTION',
  /** 系統預設 - 系統內建 */
  SYSTEM_DEFAULT = 'SYSTEM_DEFAULT',
}

/**
 * 費用分類枚舉
 * @description 運費發票中常見的費用類型分類
 * @note 命名為 FreightChargeCategory 以區別於 term-validation.ts 中的 TermCategory
 *       term-validation.ts 的 TermCategory 用於 AI 驗證（區分有效/無效術語）
 *       此處的 FreightChargeCategory 用於業務層面的費用子分類
 */
export enum FreightChargeCategory {
  /** 基本費用 - 運費、手續費等 */
  FEE = 'FEE',
  /** 稅金 - 關稅、增值稅等 */
  TAX = 'TAX',
  /** 折扣 - 各類折扣優惠 */
  DISCOUNT = 'DISCOUNT',
  /** 附加費 - 燃油附加費、旺季附加費等 */
  SURCHARGE = 'SURCHARGE',
  /** 運輸服務 - 提貨、配送等 */
  TRANSPORT_SERVICE = 'TRANSPORT_SERVICE',
  /** 倉儲服務 - 倉儲、裝卸等 */
  WAREHOUSING = 'WAREHOUSING',
  /** 報關服務 - 報關、清關等 */
  CUSTOMS = 'CUSTOMS',
  /** 保險服務 - 貨物保險等 */
  INSURANCE = 'INSURANCE',
  /** 其他 - 無法分類的費用 */
  OTHER = 'OTHER',
}

/**
 * 術語匹配方法枚舉
 * @description 記錄術語是如何被匹配的
 */
export enum TermMatchMethod {
  /** 精確匹配 - 術語完全相同 */
  EXACT = 'EXACT',
  /** 模糊匹配 - 基於 Levenshtein 距離的相似度匹配 */
  FUZZY = 'FUZZY',
  /** 同義詞匹配 - 匹配到已知的同義詞 */
  SYNONYM = 'SYNONYM',
  /** 新術語 - 未匹配到任何現有術語 */
  NEW = 'NEW',
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * 術語基礎介面
 * @description 系統中存儲的完整術語資訊
 */
export interface Term {
  /** 術語 ID */
  id: string;
  /** 術語原始文字 */
  term: string;
  /** 正規化後的術語（小寫、去空格） */
  normalizedTerm: string;
  /** 所屬公司 ID */
  companyId: string;
  /** 所屬文件格式 ID */
  documentFormatId: string;
  /** 術語狀態 */
  status: TermStatus;
  /** 術語來源 */
  source: TermSource;
  /** 費用分類（可選） */
  category?: FreightChargeCategory;
  /** 出現次數 */
  occurrences: number;
  /** 首次出現日期 */
  firstSeenAt: Date;
  /** 最後出現日期 */
  lastSeenAt: Date;
  /** 驗證者 ID（如已驗證） */
  verifiedBy?: string;
  /** 驗證時間（如已驗證） */
  verifiedAt?: Date;
  /** AI 分類信心度 (0-100) */
  aiConfidence?: number;
  /** 同義詞列表 */
  synonyms?: string[];
  /** 父術語 ID（如果是同義詞） */
  parentTermId?: string;
  /** 創建時間 */
  createdAt: Date;
  /** 更新時間 */
  updatedAt: Date;
}

/**
 * 檢測到的術語
 * @description 從文件中提取並檢測的術語（尚未確定是新術語還是已存在）
 */
export interface DetectedTerm {
  /** 術語原始文字 */
  term: string;
  /** 正規化後的術語 */
  normalizedTerm: string;
  /** 在當前文件中的出現次數 */
  occurrences: number;
  /** 金額（如有關聯） */
  amount?: number;
  /** 幣別（如有關聯） */
  currency?: string;
  /** 來源欄位（lineItems, customFields 等） */
  sourceField?: string;
  /** 來源行號（如果來自 lineItems） */
  lineIndex?: number;
}

/**
 * 匹配到的術語
 * @description 與現有術語匹配成功的結果
 */
export interface MatchedTerm {
  /** 輸入的術語 */
  inputTerm: string;
  /** 匹配到的術語 */
  matchedTerm: Term;
  /** 匹配方法 */
  matchMethod: TermMatchMethod;
  /** 匹配相似度 (0-100) */
  similarity: number;
  /** 是否需要人工確認 */
  needsConfirmation: boolean;
}

/**
 * 新術語（未匹配到現有術語）
 * @description 需要創建的新術語資訊
 */
export interface NewTerm {
  /** 術語原始文字 */
  term: string;
  /** 正規化後的術語 */
  normalizedTerm: string;
  /** 所屬公司 ID */
  companyId: string;
  /** 所屬文件格式 ID */
  documentFormatId: string;
  /** 術語來源 */
  source: TermSource;
  /** 出現次數 */
  occurrences: number;
  /** AI 分類結果（可選） */
  aiClassification?: {
    /** 建議的費用分類 */
    category: FreightChargeCategory;
    /** 信心度 (0-100) */
    confidence: number;
    /** 分類理由 */
    reasoning?: string;
  };
  /** 可能的同義詞候選 */
  synonymCandidates?: SynonymCandidate[];
}

/**
 * 同義詞候選
 * @description 可能是現有術語同義詞的候選項
 */
export interface SynonymCandidate {
  /** 現有術語 */
  existingTerm: Term;
  /** 相似度分數 (0-100) */
  similarity: number;
  /** 相似度計算方法 */
  method: 'levenshtein' | 'semantic' | 'pattern';
  /** 建議合併原因 */
  reason?: string;
}

// ============================================================================
// Detection & Processing Results
// ============================================================================

/**
 * 新術語檢測結果
 * @description 術語檢測步驟的完整輸出
 */
export interface NewTermDetectionResult {
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息（如失敗） */
  error?: string;
  /** 所有檢測到的術語 */
  detectedTerms: DetectedTerm[];
  /** 匹配到的現有術語 */
  matchedTerms: MatchedTerm[];
  /** 需要創建的新術語 */
  newTerms: NewTerm[];
  /** 同義詞候選（需人工確認） */
  synonymCandidates: SynonymCandidate[];
  /** 處理統計 */
  stats: TermDetectionStats;
  /** 處理耗時（毫秒） */
  processingTimeMs: number;
}

/**
 * 術語檢測統計
 * @description 術語檢測過程的統計數據
 */
export interface TermDetectionStats {
  /** 檢測到的術語總數 */
  totalDetected: number;
  /** 精確匹配數量 */
  exactMatches: number;
  /** 模糊匹配數量 */
  fuzzyMatches: number;
  /** 同義詞匹配數量 */
  synonymMatches: number;
  /** 新術語數量 */
  newTerms: number;
  /** 需要人工確認的數量 */
  needsConfirmation: number;
  /** 過濾掉的無效術語數量（地址、人名等） */
  filteredInvalid: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * 術語記錄請求
 * @description 用於 TermRecorderAdapter 的記錄請求
 */
export interface TermRecordRequest {
  /** 公司 ID */
  companyId: string;
  /** 文件格式 ID */
  documentFormatId: string;
  /** 處理批次 ID（可選） */
  batchId?: string;
  /** 文件 ID（可選） */
  fileId?: string;
  /** 術語來源 */
  source: TermSource;
  /** 檢測到的術語列表 */
  detectedTerms: DetectedTerm[];
  /** 是否自動保存新術語 */
  autoSaveNewTerms: boolean;
  /** 是否執行 AI 分類 */
  performAiClassification: boolean;
  /** 模糊匹配閾值 (0-100)，默認 85 */
  fuzzyMatchThreshold?: number;
}

/**
 * 術語記錄結果
 * @description 術語記錄操作的結果
 */
export interface TermRecordResult {
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息（如失敗） */
  error?: string;
  /** 新創建的術語 ID 列表 */
  createdTermIds: string[];
  /** 更新的術語 ID 列表 */
  updatedTermIds: string[];
  /** 匹配到的現有術語 */
  matchedTerms: MatchedTerm[];
  /** 需要人工確認的同義詞候選 */
  pendingSynonyms: SynonymCandidate[];
  /** 統計數據 */
  stats: TermDetectionStats;
  /** 處理耗時（毫秒） */
  processingTimeMs: number;
}

/**
 * 術語驗證請求
 * @description 人工驗證術語的請求
 */
export interface TermVerificationRequest {
  /** 術語 ID */
  termId: string;
  /** 驗證動作 */
  action: 'verify' | 'reject' | 'merge';
  /** 驗證者 ID */
  verifiedBy: string;
  /** 費用分類（如果是驗證動作） */
  category?: FreightChargeCategory;
  /** 合併目標術語 ID（如果是合併動作） */
  mergeIntoTermId?: string;
  /** 備註 */
  notes?: string;
}

/**
 * 術語驗證結果
 * @description 術語驗證操作的結果
 */
export interface TermVerificationResult {
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息（如失敗） */
  error?: string;
  /** 更新後的術語 */
  term?: Term;
  /** 執行的動作 */
  action: 'verify' | 'reject' | 'merge';
  /** 時間戳 */
  timestamp: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * 術語記錄配置
 * @description 控制術語記錄行為的配置
 */
export interface TermRecordingConfig {
  /** 是否啟用術語記錄 */
  enabled: boolean;
  /** 是否自動保存新術語 */
  autoSaveNewTerms: boolean;
  /** 是否執行 AI 分類 */
  performAiClassification: boolean;
  /** 模糊匹配閾值 (0-100) */
  fuzzyMatchThreshold: number;
  /** 同義詞檢測閾值 (0-100) */
  synonymThreshold: number;
  /** 最小術語長度 */
  minTermLength: number;
  /** 最大術語長度 */
  maxTermLength: number;
  /** 忽略的術語模式（正則） */
  ignorePatterns: string[];
  /** 是否過濾無效術語（地址、人名等） */
  filterInvalidTerms: boolean;
}

/**
 * 默認術語記錄配置
 */
export const DEFAULT_TERM_RECORDING_CONFIG: TermRecordingConfig = {
  enabled: true,
  autoSaveNewTerms: true,
  performAiClassification: true,
  fuzzyMatchThreshold: 85,
  synonymThreshold: 80,
  minTermLength: 2,
  maxTermLength: 200,
  ignorePatterns: [
    '^\\d+$', // 純數字
    '^[\\d.,]+$', // 數字和標點
    '^\\s*$', // 空白
  ],
  filterInvalidTerms: true,
};

// ============================================================================
// Step Output Types (for UnifiedProcessor integration)
// ============================================================================

/**
 * 術語記錄步驟輸出
 * @description Step 9 (TERM_RECORDING) 的輸出數據
 */
export interface TermRecordingStepOutput {
  /** 檢測到的術語總數 */
  totalDetected: number;
  /** 新術語數量 */
  newTermsCount: number;
  /** 匹配到的術語數量 */
  matchedTermsCount: number;
  /** 更新的術語數量（增加出現次數） */
  updatedTermsCount: number;
  /** 需要人工確認的數量 */
  pendingConfirmationCount: number;
  /** 是否有同義詞候選 */
  hasSynonymCandidates: boolean;
  /** 處理耗時（毫秒） */
  processingTimeMs: number;
  /** Index signature for Record<string, unknown> compatibility */
  [key: string]: unknown;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * 術語查詢過濾器
 */
export interface TermQueryFilter {
  /** 公司 ID */
  companyId?: string;
  /** 文件格式 ID */
  documentFormatId?: string;
  /** 術語狀態 */
  status?: TermStatus | TermStatus[];
  /** 術語來源 */
  source?: TermSource | TermSource[];
  /** 費用分類 */
  category?: FreightChargeCategory | FreightChargeCategory[];
  /** 搜尋關鍵字 */
  searchTerm?: string;
  /** 最小出現次數 */
  minOccurrences?: number;
  /** 創建日期範圍 - 開始 */
  createdAfter?: Date;
  /** 創建日期範圍 - 結束 */
  createdBefore?: Date;
}

/**
 * 術語統計摘要
 */
export interface TermStatsSummary {
  /** 術語總數 */
  totalTerms: number;
  /** 各狀態數量 */
  byStatus: Record<TermStatus, number>;
  /** 各來源數量 */
  bySource: Record<TermSource, number>;
  /** 各分類數量 */
  byCategory: Record<FreightChargeCategory, number>;
  /** 待驗證數量 */
  pendingCount: number;
  /** 今日新增數量 */
  todayNewCount: number;
  /** 本週新增數量 */
  weekNewCount: number;
}
