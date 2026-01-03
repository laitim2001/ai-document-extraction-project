/**
 * @fileoverview 信心度計算與路由決策類型定義
 * @description
 *   定義統一處理流程中信心度計算和路由決策所需的所有類型：
 *   - 7 維度信心度計算（EXTRACTION, ISSUER_IDENTIFICATION, FORMAT_MATCHING 等）
 *   - 路由決策機制（AUTO_APPROVE, QUICK_REVIEW, FULL_REVIEW）
 *   - 配置來源優先級和加成
 *   - 可配置的權重和閾值
 *
 * @module src/types/confidence
 * @since Epic 2 - Story 2.5 (Confidence Score Calculation)
 * @lastModified 2026-01-03
 *
 * @features
 *   - 7 維度信心度計算模型（Story 15.5）
 *   - 配置來源加成機制
 *   - 可配置的路由閾值
 *   - 信心度等級分類
 *   - 向下兼容 Epic 2 的基礎類型
 *
 * @related
 *   - src/services/unified-processor/adapters/confidence-calculator-adapter.ts
 *   - src/services/unified-processor/adapters/routing-decision-adapter.ts
 *   - src/services/unified-processor/steps/confidence-calculation.step.ts
 *   - src/services/unified-processor/steps/routing-decision.step.ts
 */

// ============================================================
// Epic 15.5 - 7 維度信心度計算（新增）
// ============================================================

/**
 * 信心度計算維度
 * @description 7 個維度，各有不同權重
 * @since Epic 15 - Story 15.5
 */
export enum ConfidenceDimension {
  /** OCR/GPT 提取品質 (25%) */
  EXTRACTION = 'EXTRACTION',
  /** 發行商識別準確度 (15%) */
  ISSUER_IDENTIFICATION = 'ISSUER_IDENTIFICATION',
  /** 文件格式匹配程度 (15%) */
  FORMAT_MATCHING = 'FORMAT_MATCHING',
  /** 配置來源匹配 (10%) */
  CONFIG_MATCH = 'CONFIG_MATCH',
  /** 歷史準確率 (15%) */
  HISTORICAL_ACCURACY = 'HISTORICAL_ACCURACY',
  /** 欄位完整性 (10%) */
  FIELD_COMPLETENESS = 'FIELD_COMPLETENESS',
  /** 術語匹配程度 (10%) */
  TERM_MATCHING = 'TERM_MATCHING',
}

/**
 * 路由決策結果
 * @description 基於信心度分數的路由策略
 * @since Epic 15 - Story 15.5
 */
export enum RoutingDecision {
  /** 自動通過 (≥90%) */
  AUTO_APPROVE = 'AUTO_APPROVE',
  /** 快速審核 (70-89%) */
  QUICK_REVIEW = 'QUICK_REVIEW',
  /** 完整審核 (<70%) */
  FULL_REVIEW = 'FULL_REVIEW',
}

/**
 * 配置來源優先級
 * @description 用於決定配置加成的來源層級
 * @since Epic 15 - Story 15.5
 */
export enum ConfigSource {
  /** 特定文件配置 (+10%) */
  SPECIFIC = 'SPECIFIC',
  /** 公司級配置 (+5%) */
  COMPANY = 'COMPANY',
  /** 格式級配置 (+3%) */
  FORMAT = 'FORMAT',
  /** 全局配置 (+1%) */
  GLOBAL = 'GLOBAL',
  /** 默認配置 (+0%) */
  DEFAULT = 'DEFAULT',
}

/**
 * 信心度等級（枚舉版本）
 * @description 基於分數範圍的等級分類
 * @since Epic 15 - Story 15.5
 */
export enum ConfidenceLevelEnum {
  /** 非常高 (95-100) */
  VERY_HIGH = 'VERY_HIGH',
  /** 高 (85-94) */
  HIGH = 'HIGH',
  /** 中等 (70-84) */
  MEDIUM = 'MEDIUM',
  /** 低 (50-69) */
  LOW = 'LOW',
  /** 非常低 (0-49) */
  VERY_LOW = 'VERY_LOW',
}

/**
 * 維度權重配置
 * @description 各維度的權重百分比（總和應為 1.0）
 */
export type ConfidenceWeights = Record<ConfidenceDimension, number>;

/**
 * 配置來源加成設定
 */
export type ConfigSourceBonuses = Record<ConfigSource, number>;

/**
 * 單一維度的分數詳情
 */
export interface DimensionScore {
  /** 維度類型 */
  dimension: ConfidenceDimension;
  /** 原始分數 (0-100) */
  rawScore: number;
  /** 加權後分數 */
  weightedScore: number;
  /** 權重 */
  weight: number;
  /** 分數來源說明 */
  source: string;
  /** 詳細說明 */
  details?: string;
}

/**
 * 信心度計算結果（7 維度版本）
 * @since Epic 15 - Story 15.5
 */
export interface ConfidenceCalculationResult {
  /** 總信心度分數 (0-100) */
  overallScore: number;
  /** 信心度等級 */
  level: ConfidenceLevelEnum;
  /** 各維度分數詳情 */
  dimensions: DimensionScore[];
  /** 配置來源加成 */
  configSourceBonus: number;
  /** 實際使用的配置來源 */
  configSource: ConfigSource;
  /** 計算時間戳 */
  calculatedAt: Date;
  /** 是否有警告 */
  hasWarnings: boolean;
  /** 警告訊息列表 */
  warnings: string[];
}

/**
 * 路由決策結果詳情
 * @since Epic 15 - Story 15.5
 */
export interface RoutingDecisionResult {
  /** 路由決策 */
  decision: RoutingDecision;
  /** 信心度分數 */
  confidenceScore: number;
  /** 信心度等級 */
  confidenceLevel: ConfidenceLevelEnum;
  /** 決策原因 */
  reason: string;
  /** 使用的閾值配置 */
  thresholds: RoutingThresholds;
  /** 建議的審核優先級 (1-5) */
  reviewPriority: number;
  /** 預估審核時間（分鐘） */
  estimatedReviewTime: number;
  /** 決策時間戳 */
  decidedAt: Date;
}

/**
 * 信心度計算輸入參數
 * @since Epic 15 - Story 15.5
 */
export interface ConfidenceCalculationInput {
  /** 處理後的文件 ID */
  processedFileId: string;
  /** OCR/GPT 提取信心度 */
  extractionConfidence?: number;
  /** 發行商識別結果 */
  issuerIdentification?: {
    identified: boolean;
    confidence: number;
    method: string;
  };
  /** 格式匹配結果 */
  formatMatching?: {
    matched: boolean;
    confidence: number;
    formatId?: string;
  };
  /** 配置來源信息 */
  configInfo?: {
    source: ConfigSource;
    configId?: string;
  };
  /** 歷史準確率數據 */
  historicalData?: {
    totalProcessed: number;
    successfullyMapped: number;
    averageAccuracy: number;
  };
  /** 欄位完整性信息 */
  fieldCompleteness?: {
    totalFields: number;
    filledFields: number;
    requiredFields: number;
    filledRequiredFields: number;
  };
  /** 術語匹配信息 */
  termMatching?: {
    totalTerms: number;
    matchedTerms: number;
    unmatchedTerms: number;
    newTerms: number;
  };
}

/**
 * 信心度計算配置
 * @since Epic 15 - Story 15.5
 */
export interface ConfidenceCalculationConfig {
  /** 維度權重 */
  weights: ConfidenceWeights;
  /** 配置來源加成 */
  configSourceBonuses: ConfigSourceBonuses;
  /** 路由閾值 */
  routingThresholds: RoutingThresholds;
  /** 是否啟用歷史數據加權 */
  enableHistoricalWeighting: boolean;
  /** 最小樣本數（用於歷史準確率計算） */
  minSampleSize: number;
}

// ============================================================
// 預設常數（Epic 15.5）
// ============================================================

/**
 * 預設維度權重
 */
export const DEFAULT_DIMENSION_WEIGHTS: ConfidenceWeights = {
  [ConfidenceDimension.EXTRACTION]: 0.25,
  [ConfidenceDimension.ISSUER_IDENTIFICATION]: 0.15,
  [ConfidenceDimension.FORMAT_MATCHING]: 0.15,
  [ConfidenceDimension.CONFIG_MATCH]: 0.10,
  [ConfidenceDimension.HISTORICAL_ACCURACY]: 0.15,
  [ConfidenceDimension.FIELD_COMPLETENESS]: 0.10,
  [ConfidenceDimension.TERM_MATCHING]: 0.10,
};

/**
 * 預設配置來源加成
 */
export const DEFAULT_CONFIG_SOURCE_BONUSES: ConfigSourceBonuses = {
  [ConfigSource.SPECIFIC]: 10,
  [ConfigSource.COMPANY]: 5,
  [ConfigSource.FORMAT]: 3,
  [ConfigSource.GLOBAL]: 1,
  [ConfigSource.DEFAULT]: 0,
};

/**
 * 信心度等級分數範圍
 */
export const CONFIDENCE_LEVEL_RANGES: Record<ConfidenceLevelEnum, { min: number; max: number }> = {
  [ConfidenceLevelEnum.VERY_HIGH]: { min: 95, max: 100 },
  [ConfidenceLevelEnum.HIGH]: { min: 85, max: 94 },
  [ConfidenceLevelEnum.MEDIUM]: { min: 70, max: 84 },
  [ConfidenceLevelEnum.LOW]: { min: 50, max: 69 },
  [ConfidenceLevelEnum.VERY_LOW]: { min: 0, max: 49 },
};

/**
 * 路由決策對應的審核優先級
 */
export const ROUTING_REVIEW_PRIORITY: Record<RoutingDecision, number> = {
  [RoutingDecision.AUTO_APPROVE]: 5, // 最低優先級（自動通過）
  [RoutingDecision.QUICK_REVIEW]: 3, // 中等優先級
  [RoutingDecision.FULL_REVIEW]: 1, // 最高優先級（需要完整審核）
};

/**
 * 路由決策對應的預估審核時間（分鐘）
 */
export const ROUTING_ESTIMATED_TIME: Record<RoutingDecision, number> = {
  [RoutingDecision.AUTO_APPROVE]: 0,
  [RoutingDecision.QUICK_REVIEW]: 2,
  [RoutingDecision.FULL_REVIEW]: 10,
};

/**
 * 預設信心度計算配置
 */
export const DEFAULT_CONFIDENCE_CALCULATION_CONFIG: ConfidenceCalculationConfig = {
  weights: DEFAULT_DIMENSION_WEIGHTS,
  configSourceBonuses: DEFAULT_CONFIG_SOURCE_BONUSES,
  routingThresholds: {
    autoApprove: 90,
    quickReview: 70,
  },
  enableHistoricalWeighting: true,
  minSampleSize: 10,
};

// ============================================================
// 介面定義（Epic 15.5）
// ============================================================

/**
 * 信心度計算器介面
 */
export interface IConfidenceCalculator {
  calculate(input: ConfidenceCalculationInput): ConfidenceCalculationResult;
  getLevel(score: number): ConfidenceLevelEnum;
  validateWeights(weights: ConfidenceWeights): boolean;
}

/**
 * 路由決策器介面
 */
export interface IRoutingDecider {
  decide(confidenceResult: ConfidenceCalculationResult): RoutingDecisionResult;
  getThresholds(): RoutingThresholds;
  setThresholds(thresholds: RoutingThresholds): void;
}

/**
 * 信心度歷史記錄
 */
export interface ConfidenceHistoryRecord {
  /** 記錄 ID */
  id: string;
  /** 處理文件 ID */
  processedFileId: string;
  /** 信心度結果 */
  confidenceResult: ConfidenceCalculationResult;
  /** 路由決策 */
  routingResult: RoutingDecisionResult;
  /** 最終結果（人工確認後） */
  finalOutcome?: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
  /** 記錄時間 */
  createdAt: Date;
}

/**
 * 信心度統計
 */
export interface ConfidenceStatistics {
  /** 總處理數量 */
  totalProcessed: number;
  /** 各路由決策數量 */
  routingCounts: Record<RoutingDecision, number>;
  /** 各信心度等級數量 */
  levelCounts: Record<ConfidenceLevelEnum, number>;
  /** 平均信心度分數 */
  averageScore: number;
  /** 自動通過率 */
  autoApproveRate: number;
  /** 統計時間範圍 */
  period: {
    from: Date;
    to: Date;
  };
}

// ============================================================
// Epic 2 - 基礎類型（向下兼容）
// ============================================================

/**
 * 信心度等級（字串類型 - 舊版兼容）
 * - high: ≥90% 自動通過
 * - medium: 70-89% 快速審核
 * - low: <70% 完整審核
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * 信心度計算因素（舊版）
 * 每個因素範圍 0-100，加權計算最終分數
 */
export interface ConfidenceFactors {
  /** OCR 識別清晰度分數 (0-100) */
  ocrConfidence: number;
  /** 規則匹配精準度分數 (0-100) */
  ruleMatchScore: number;
  /** 格式驗證結果分數 (0-100) */
  formatValidation: number;
  /** 歷史準確率分數 (0-100) */
  historicalAccuracy: number;
}

/**
 * 因素權重類型
 */
export type ConfidenceFactorWeights = {
  [K in keyof ConfidenceFactors]: number;
};

/**
 * 單一因素貢獻明細
 */
export interface FactorContribution {
  /** 因素名稱 */
  factor: keyof ConfidenceFactors;
  /** 因素權重 (0-1) */
  weight: number;
  /** 原始分數 (0-100) */
  rawScore: number;
  /** 加權後貢獻 */
  contribution: number;
}

/**
 * 單一欄位信心度計算結果
 */
export interface FieldConfidenceResult {
  /** 最終加權分數 (0-100) */
  score: number;
  /** 信心度等級分類 */
  level: ConfidenceLevel;
  /** 個別因素分數 */
  factors: ConfidenceFactors;
  /** 顯示顏色（用於 UI） */
  color: string;
  /** 背景顏色（用於 UI） */
  bgColor: string;
  /** 因素貢獻明細 */
  breakdown: FactorContribution[];
}

/**
 * 文件信心度統計資訊
 */
export interface DocumentConfidenceStats {
  /** 總欄位數 */
  totalFields: number;
  /** 高信心度欄位數 */
  highConfidence: number;
  /** 中信心度欄位數 */
  mediumConfidence: number;
  /** 低信心度欄位數 */
  lowConfidence: number;
  /** 平均分數 */
  averageScore: number;
  /** 最低分數 */
  minScore: number;
  /** 最高分數 */
  maxScore: number;
}

/**
 * 處理建議類型
 */
export type ProcessingRecommendation = 'auto_approve' | 'quick_review' | 'full_review';

/**
 * 文件整體信心度結果
 */
export interface DocumentConfidenceResult {
  /** 整體分數 (0-100) */
  overallScore: number;
  /** 整體信心度等級 */
  level: ConfidenceLevel;
  /** 顯示顏色 */
  color: string;
  /** 背景顏色 */
  bgColor: string;
  /** 各欄位信心度結果 */
  fieldScores: Record<string, FieldConfidenceResult>;
  /** 統計資訊 */
  stats: DocumentConfidenceStats;
  /** 處理路徑建議 */
  recommendation: ProcessingRecommendation;
}

/**
 * 信心度閾值配置
 */
export interface ConfidenceThreshold {
  /** 最小分數（含） */
  min: number;
  /** 英文標籤 */
  label: string;
  /** 中文標籤 */
  labelZh: string;
  /** 顯示顏色（文字） */
  color: string;
  /** 背景顏色 */
  bgColor: string;
  /** 描述說明 */
  description: string;
}

/**
 * 信心度閾值映射
 */
export type ConfidenceThresholds = Record<ConfidenceLevel, ConfidenceThreshold>;

/**
 * 處理路徑路由閾值
 */
export interface RoutingThresholds {
  /** 自動通過閾值（≥ 此值自動批准） */
  autoApprove: number;
  /** 快速審核閾值（≥ 此值進入快速審核） */
  quickReview: number;
  /** 完整審核閾值（低於快速審核進入完整審核）- 可選 */
  fullReview?: number;
}

/**
 * 歷史準確度資料
 */
export interface HistoricalAccuracyData {
  /** 準確率 (0-100) */
  accuracy: number;
  /** 樣本數量 */
  sampleSize: number;
}

/**
 * Forwarder 欄位歷史準確度映射
 */
export type ForwarderFieldAccuracy = Record<string, HistoricalAccuracyData>;

// ============================================================
// API Types
// ============================================================

/**
 * 信心度 API 響應
 */
export interface ConfidenceApiResponse {
  success: boolean;
  data: DocumentConfidenceResult | null;
  error?: string;
}

/**
 * 信心度計算請求
 */
export interface CalculateConfidenceRequest {
  documentId: string;
  /** 強制重新計算 */
  force?: boolean;
}

/**
 * 重新計算信心度請求
 */
export interface RecalculateConfidenceRequest {
  documentId: string;
  /** 更新後的欄位映射 */
  updatedMappings: Record<string, unknown>;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 將舊版 ConfidenceLevel 轉換為新版 ConfidenceLevelEnum
 */
export function toConfidenceLevelEnum(level: ConfidenceLevel): ConfidenceLevelEnum {
  switch (level) {
    case 'high':
      return ConfidenceLevelEnum.HIGH;
    case 'medium':
      return ConfidenceLevelEnum.MEDIUM;
    case 'low':
      return ConfidenceLevelEnum.LOW;
    default:
      return ConfidenceLevelEnum.MEDIUM;
  }
}

/**
 * 將新版 ConfidenceLevelEnum 轉換為舊版 ConfidenceLevel
 */
export function toConfidenceLevel(level: ConfidenceLevelEnum): ConfidenceLevel {
  switch (level) {
    case ConfidenceLevelEnum.VERY_HIGH:
    case ConfidenceLevelEnum.HIGH:
      return 'high';
    case ConfidenceLevelEnum.MEDIUM:
      return 'medium';
    case ConfidenceLevelEnum.LOW:
    case ConfidenceLevelEnum.VERY_LOW:
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * 將 RoutingDecision 轉換為 ProcessingRecommendation
 */
export function toProcessingRecommendation(decision: RoutingDecision): ProcessingRecommendation {
  switch (decision) {
    case RoutingDecision.AUTO_APPROVE:
      return 'auto_approve';
    case RoutingDecision.QUICK_REVIEW:
      return 'quick_review';
    case RoutingDecision.FULL_REVIEW:
      return 'full_review';
    default:
      return 'full_review';
  }
}
