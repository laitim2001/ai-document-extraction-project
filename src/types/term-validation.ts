/**
 * @fileoverview AI 術語驗證服務類型定義
 * @description
 *   定義術語驗證相關的類型、介面和枚舉，用於：
 *   - AI 驅動的術語分類和驗證
 *   - 術語批次處理配置
 *   - 成本追蹤和統計
 *
 * @module src/types/term-validation
 * @author Development Team
 * @since Epic 0 - Story 0-10 (AI 術語驗證服務)
 * @lastModified 2025-01-01
 *
 * @features
 *   - 術語分類枚舉（有效/無效類別）
 *   - 驗證結果介面
 *   - 批次處理配置
 *   - 成本統計介面
 *
 * @related
 *   - src/services/ai-term-validator.service.ts - 核心驗證服務
 *   - src/services/batch-term-aggregation.service.ts - 批次術語聚合
 *   - src/services/hierarchical-term-aggregation.service.ts - 階層式術語聚合
 */

// ============================================================================
// 術語分類枚舉
// ============================================================================

/**
 * 術語分類枚舉
 * @description 定義所有可能的術語分類類別
 *
 * 有效類別（保留在系統中）：
 * - FREIGHT_CHARGE: 運費相關費用
 * - SURCHARGE: 附加費用
 * - SERVICE_FEE: 服務費用
 * - DUTY_TAX: 關稅和稅費
 *
 * 無效類別（過濾掉）：
 * - ADDRESS: 地址信息
 * - PERSON_NAME: 人名
 * - COMPANY_NAME: 公司名稱
 * - BUILDING_NAME: 建築物名稱
 * - AIRPORT_CODE: 機場代碼
 * - REFERENCE: 參考編號
 * - OTHER: 其他非費用信息
 */
export enum TermCategory {
  // 有效類別 - 費用相關術語
  FREIGHT_CHARGE = 'FREIGHT_CHARGE',
  SURCHARGE = 'SURCHARGE',
  SERVICE_FEE = 'SERVICE_FEE',
  DUTY_TAX = 'DUTY_TAX',

  // 無效類別 - 需要過濾的術語
  ADDRESS = 'ADDRESS',
  PERSON_NAME = 'PERSON_NAME',
  COMPANY_NAME = 'COMPANY_NAME',
  BUILDING_NAME = 'BUILDING_NAME',
  AIRPORT_CODE = 'AIRPORT_CODE',
  REFERENCE = 'REFERENCE',
  OTHER = 'OTHER',
}

/**
 * 有效術語類別集合
 * @description 用於快速判斷術語是否為有效的費用類別
 */
export const VALID_TERM_CATEGORIES: ReadonlySet<TermCategory> = new Set([
  TermCategory.FREIGHT_CHARGE,
  TermCategory.SURCHARGE,
  TermCategory.SERVICE_FEE,
  TermCategory.DUTY_TAX,
]);

/**
 * 無效術語類別集合
 * @description 用於快速判斷術語是否應該被過濾
 */
export const INVALID_TERM_CATEGORIES: ReadonlySet<TermCategory> = new Set([
  TermCategory.ADDRESS,
  TermCategory.PERSON_NAME,
  TermCategory.COMPANY_NAME,
  TermCategory.BUILDING_NAME,
  TermCategory.AIRPORT_CODE,
  TermCategory.REFERENCE,
  TermCategory.OTHER,
]);

// ============================================================================
// 驗證結果介面
// ============================================================================

/**
 * 單一術語驗證結果
 * @description GPT-5.2 對單一術語的驗證結果
 */
export interface TermValidationResult {
  /** 原始術語文字 */
  term: string;

  /** 是否為有效的費用術語 */
  isValid: boolean;

  /** 術語分類類別 */
  category: TermCategory;

  /** AI 判斷信心度 (0-100) */
  confidence: number;

  /** 驗證來源 */
  source: 'AI' | 'FALLBACK' | 'CACHED';

  /** AI 提供的理由說明（可選） */
  reasoning?: string;
}

/**
 * GPT-5.2 API 返回的單一術語結構
 * @description 對應 GPT-5.2 結構化輸出的格式
 */
export interface GPTTermClassification {
  /** 原始術語 */
  term: string;

  /** 術語分類 */
  category: TermCategory;

  /** 信心度 (0-100) */
  confidence: number;

  /** 分類理由 */
  reasoning: string;
}

/**
 * GPT-5.2 API 完整回應結構
 * @description 對應 response_format 的 JSON Schema
 */
export interface GPTValidationResponse {
  /** 術語分類結果陣列 */
  classifications: GPTTermClassification[];

  /** 處理的術語總數 */
  totalProcessed: number;
}

// ============================================================================
// 批次處理配置
// ============================================================================

/**
 * 術語驗證配置
 * @description 控制 AI 術語驗證服務的行為
 */
export interface TermValidationConfig {
  /** 是否啟用 AI 驗證（預設: true） */
  enabled: boolean;

  /** 每批次處理的術語數量（預設: 50，最大: 100） */
  batchSize: number;

  /** 最大並行批次數（預設: 3） */
  maxConcurrency: number;

  /** 最小信心度閾值 (0-100)，低於此值使用 fallback（預設: 70） */
  minConfidenceThreshold: number;

  /** API 呼叫超時時間（毫秒）（預設: 30000） */
  timeout: number;

  /** 失敗時重試次數（預設: 2） */
  retryCount: number;

  /** 是否啟用快取（預設: true） */
  cacheEnabled: boolean;

  /** 快取 TTL（秒）（預設: 3600 = 1小時） */
  cacheTTL: number;

  /** 是否在 AI 失敗時使用 fallback（預設: true） */
  fallbackEnabled: boolean;
}

/**
 * 預設驗證配置
 */
export const DEFAULT_VALIDATION_CONFIG: TermValidationConfig = {
  enabled: true,
  batchSize: 50,
  maxConcurrency: 3,
  minConfidenceThreshold: 70,
  timeout: 30000,
  retryCount: 2,
  cacheEnabled: true,
  cacheTTL: 3600,
  fallbackEnabled: true,
};

// ============================================================================
// 成本追蹤介面
// ============================================================================

/**
 * 單次驗證成本記錄
 * @description 記錄每次 AI 驗證的成本詳情
 */
export interface TermValidationCostRecord {
  /** 唯一識別碼 */
  id: string;

  /** 關聯的批次 ID（可選） */
  batchId?: string;

  /** 驗證時間戳 */
  timestamp: Date;

  /** 處理的術語數量 */
  termCount: number;

  /** 輸入 Token 數量 */
  inputTokens: number;

  /** 輸出 Token 數量 */
  outputTokens: number;

  /** 總 Token 數量 */
  totalTokens: number;

  /** 估算成本（USD） */
  estimatedCost: number;

  /** API 呼叫延遲（毫秒） */
  latencyMs: number;

  /** 是否成功 */
  success: boolean;

  /** 錯誤訊息（如果失敗） */
  errorMessage?: string;
}

/**
 * 術語驗證統計
 * @description 彙總統計資訊
 */
export interface TermValidationStats {
  /** 統計時間範圍 - 開始 */
  periodStart: Date;

  /** 統計時間範圍 - 結束 */
  periodEnd: Date;

  /** 總驗證次數 */
  totalValidations: number;

  /** 總處理術語數 */
  totalTermsProcessed: number;

  /** 有效術語數 */
  validTermsCount: number;

  /** 無效術語數 */
  invalidTermsCount: number;

  /** 總 Token 使用量 */
  totalTokensUsed: number;

  /** 總成本（USD） */
  totalCost: number;

  /** 平均每批次成本（USD） */
  avgCostPerBatch: number;

  /** 平均每術語成本（USD） */
  avgCostPerTerm: number;

  /** 成功率 (0-100) */
  successRate: number;

  /** 平均延遲（毫秒） */
  avgLatencyMs: number;

  /** 按類別統計 */
  categoryBreakdown: Record<TermCategory, number>;
}

/**
 * 成本查詢參數
 */
export interface TermValidationCostQuery {
  /** 開始日期 */
  startDate?: Date;

  /** 結束日期 */
  endDate?: Date;

  /** 批次 ID */
  batchId?: string;

  /** 最大記錄數 */
  limit?: number;

  /** 偏移量 */
  offset?: number;
}

// ============================================================================
// API 請求/回應介面
// ============================================================================

/**
 * 術語驗證 API 請求
 * POST /api/v1/admin/terms/validate
 */
export interface TermValidationRequest {
  /** 要驗證的術語列表 */
  terms: string[];

  /** 可選的配置覆蓋 */
  config?: Partial<TermValidationConfig>;

  /** 關聯的批次 ID（可選） */
  batchId?: string;
}

/**
 * 術語驗證 API 回應
 */
export interface TermValidationResponse {
  /** 是否成功 */
  success: boolean;

  /** 驗證結果列表 */
  results: TermValidationResult[];

  /** 有效術語列表 */
  validTerms: string[];

  /** 無效術語列表 */
  invalidTerms: string[];

  /** 統計摘要 */
  summary: {
    total: number;
    valid: number;
    invalid: number;
    validRate: number;
  };

  /** 成本資訊 */
  cost?: {
    tokensUsed: number;
    estimatedCost: number;
  };

  /** 處理時間（毫秒） */
  processingTimeMs: number;
}

/**
 * 成本查詢 API 回應
 * GET /api/v1/admin/costs/term-validation
 */
export interface TermValidationCostResponse {
  /** 是否成功 */
  success: boolean;

  /** 統計資訊 */
  stats: TermValidationStats;

  /** 詳細記錄（可選） */
  records?: TermValidationCostRecord[];

  /** 分頁資訊 */
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ============================================================================
// 工具函數類型
// ============================================================================

/**
 * 檢查術語類別是否為有效的費用類別
 */
export function isValidTermCategory(category: TermCategory): boolean {
  return VALID_TERM_CATEGORIES.has(category);
}

/**
 * 檢查術語類別是否應該被過濾
 */
export function isInvalidTermCategory(category: TermCategory): boolean {
  return INVALID_TERM_CATEGORIES.has(category);
}

/**
 * 從字串解析術語類別
 */
export function parseTermCategory(value: string): TermCategory | null {
  const upperValue = value.toUpperCase();
  if (Object.values(TermCategory).includes(upperValue as TermCategory)) {
    return upperValue as TermCategory;
  }
  return null;
}
