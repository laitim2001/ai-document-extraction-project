/**
 * @fileoverview 批量處理術語聚合類型定義
 * @description
 *   定義批量處理流程中術語聚合相關的類型：
 *   - 術語聚合配置選項
 *   - 公司術語聚合結果
 *   - 通用術語識別
 *   - 批量聚合統計數據
 *
 * @module src/types/batch-term-aggregation
 * @since Epic 0 - Story 0.7 (批量處理術語聚合整合)
 * @lastModified 2025-12-25
 *
 * @related
 *   - src/services/batch-term-aggregation.service.ts - 使用這些類型的主要服務
 *   - src/services/term-aggregation.service.ts - 基礎術語聚合服務
 *   - src/services/batch-processor.service.ts - 批量處理服務
 *   - prisma/schema.prisma - TermAggregationResult 模型
 */

/**
 * 術語聚合配置
 * @description 控制批量處理時術語聚合的行為
 */
export interface TermAggregationConfig {
  /** 是否啟用術語聚合 */
  enabled: boolean;
  /** 術語相似度閾值 (0-1)，預設 0.85 */
  similarityThreshold: number;
  /** 是否自動分類術語 */
  autoClassify: boolean;
  /** 是否啟用 AI 術語驗證（預設 false） */
  aiValidationEnabled?: boolean;
}

/**
 * 公司術語
 * @description 單個術語在特定公司中的出現信息
 */
export interface CompanyTerm {
  /** 術語名稱 */
  term: string;
  /** 出現頻率 */
  frequency: number;
  /** 建議的費用類別 */
  suggestedCategory?: string;
  /** 分類信心度 (0-1) */
  confidence?: number;
  /** 是否為通用術語（出現在多個公司） */
  isUniversal: boolean;
}

/**
 * 公司術語聚合結果
 * @description 單個公司的術語聚合結果
 */
export interface CompanyTermAggregation {
  /** 公司 ID */
  companyId: string;
  /** 公司名稱 */
  companyName: string;
  /** 唯一術語數量 */
  uniqueTermCount: number;
  /** 術語出現總次數 */
  totalOccurrences: number;
  /** 術語列表 */
  terms: CompanyTerm[];
}

/**
 * 通用術語公司分佈
 * @description 術語在各公司中的分佈情況
 */
export interface TermCompanyDistribution {
  /** 公司 ID */
  companyId: string;
  /** 公司名稱 */
  companyName: string;
  /** 在該公司中的出現次數 */
  frequency: number;
}

/**
 * 通用術語
 * @description 出現在多個公司中的術語
 */
export interface UniversalTerm {
  /** 術語名稱 */
  term: string;
  /** 總出現頻率 */
  totalFrequency: number;
  /** 出現在多少個公司中 */
  companyCount: number;
  /** 在各公司中的分佈 */
  companies: TermCompanyDistribution[];
  /** 建議的費用類別 */
  suggestedCategory?: string;
  /** 分類信心度 (0-1) */
  confidence?: number;
}

/**
 * 批量術語聚合統計
 * @description 批量處理術語聚合的統計摘要
 */
export interface BatchTermAggregationStats {
  /** 唯一術語總數 */
  totalUniqueTerms: number;
  /** 術語出現總次數 */
  totalOccurrences: number;
  /** 通用術語數量（出現在 2+ 公司） */
  universalTermsCount: number;
  /** 公司特定術語數量 */
  companySpecificCount: number;
  /** 已分類術語數量 */
  classifiedTermsCount: number;
  /** 含有術語的公司數量 */
  companiesWithTerms: number;
  /** AI 驗證統計（可選） */
  aiValidation?: {
    /** 驗證前術語數 */
    termsBeforeValidation: number;
    /** 驗證後術語數（有效術語） */
    termsAfterValidation: number;
    /** 被過濾的術語數 */
    filteredTermsCount: number;
    /** AI 驗證成本（USD） */
    validationCost: number;
    /** 驗證耗時（毫秒） */
    validationTimeMs: number;
  };
}

/**
 * 批量術語聚合結果
 * @description 整個批量處理的術語聚合結果
 */
export interface BatchTermAggregationResult {
  /** 批次 ID */
  batchId: string;
  /** 統計摘要 */
  stats: BatchTermAggregationStats;
  /** 通用術語列表（出現在 2+ 公司） */
  universalTerms: UniversalTerm[];
  /** 按公司分組的術語 */
  companyTerms: CompanyTermAggregation[];
  /** 聚合完成時間 */
  aggregatedAt: Date;
}

/**
 * 術語分佈摘要
 * @description 用於 UI 展示的術語分佈摘要
 */
export interface TermDistributionSummary {
  /** 最常見的術語 */
  topTerms: { term: string; frequency: number }[];
  /** 按類別分類的統計 */
  categoryBreakdown: { category: string; count: number }[];
  /** 按公司分類的統計 */
  companyBreakdown: { companyName: string; termCount: number }[];
}

/**
 * 術語聚合 API 響應
 * @description API 返回的術語聚合結果
 */
export interface TermAggregationResponse {
  /** 批次 ID */
  batchId: string;
  /** 聚合狀態 */
  status: 'pending' | 'aggregating' | 'completed' | 'failed';
  /** 統計摘要 */
  stats?: BatchTermAggregationStats;
  /** 分佈摘要（用於快速預覽） */
  summary?: TermDistributionSummary;
  /** 錯誤信息（如果失敗） */
  error?: string;
  /** 聚合完成時間 */
  aggregatedAt?: Date;
}

/**
 * 術語聚合錯誤
 * @description 術語聚合過程中的錯誤信息
 */
export interface TermAggregationError {
  /** 錯誤代碼 */
  code: string;
  /** 錯誤訊息 */
  message: string;
  /** 受影響的批次 ID */
  batchId?: string;
  /** 受影響的文件 ID（如果是文件級別錯誤） */
  fileId?: string;
}

/**
 * 開始術語聚合請求
 * @description 手動觸發術語聚合的請求參數
 */
export interface StartTermAggregationRequest {
  /** 批次 ID */
  batchId: string;
  /** 覆蓋預設配置 */
  config?: Partial<TermAggregationConfig>;
}

/**
 * 術語聚合進度
 * @description 術語聚合的進度信息
 */
export interface TermAggregationProgress {
  /** 批次 ID */
  batchId: string;
  /** 當前狀態 */
  status: 'pending' | 'aggregating' | 'completed' | 'failed';
  /** 已處理的文件數 */
  processedFiles: number;
  /** 總文件數 */
  totalFiles: number;
  /** 當前發現的唯一術語數 */
  currentUniqueTerms: number;
  /** 開始時間 */
  startedAt?: Date;
  /** 預估剩餘時間（秒） */
  estimatedRemainingSeconds?: number;
}

/**
 * 術語聚合預設配置
 */
export const DEFAULT_TERM_AGGREGATION_CONFIG: TermAggregationConfig = {
  enabled: true,
  similarityThreshold: 0.85,
  autoClassify: false,
  aiValidationEnabled: false,
};

/**
 * 通用術語判定閾值（出現在至少 N 個公司）
 */
export const UNIVERSAL_TERM_MIN_COMPANIES = 2;
