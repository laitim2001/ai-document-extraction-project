/**
 * @fileoverview AI API 使用量與成本追蹤相關類型定義
 * @description
 *   定義 AI API 成本追蹤功能所需的所有類型，包括：
 *   - 成本摘要與趨勢數據結構
 *   - 異常檢測結果類型
 *   - API 請求參數與響應類型
 *
 * @module src/types/ai-cost
 * @since Epic 7 - Story 7.6 (AI API 使用成本顯示)
 * @lastModified 2025-12-19
 *
 * @features
 *   - API 提供者類型定義
 *   - 成本摘要數據結構
 *   - 趨勢與每日明細類型
 *   - 異常檢測類型
 *
 * @dependencies
 *   - Prisma ApiProvider enum
 *
 * @related
 *   - src/services/ai-cost.service.ts - 成本計算服務
 *   - src/app/api/dashboard/ai-cost/ - API 路由
 */

// ============================================================
// Enums & Constants
// ============================================================

/**
 * API 服務提供者
 * 與 Prisma schema 中的 ApiProvider 對應
 */
export type ApiProviderType = 'AZURE_DOC_INTELLIGENCE' | 'OPENAI' | 'AZURE_OPENAI';

/**
 * 時間粒度
 */
export type Granularity = 'day' | 'week' | 'month';

// ============================================================
// Cost Summary Types
// ============================================================

/**
 * 各 Provider 的成本明細
 */
export interface ProviderCost {
  /** API 提供者 */
  provider: ApiProviderType;
  /** 總呼叫次數 */
  totalCalls: number;
  /** 成功呼叫次數 */
  successCalls: number;
  /** 失敗呼叫次數 */
  failedCalls: number;
  /** 總輸入 tokens */
  totalInputTokens: number;
  /** 總輸出 tokens */
  totalOutputTokens: number;
  /** 總成本（USD） */
  totalCost: number;
  /** 平均每次呼叫成本 */
  averageCostPerCall: number;
  /** 成功率 (0-100) */
  successRate: number;
}

/**
 * AI 成本摘要
 */
export interface AiCostSummary {
  /** 查詢期間開始日期 */
  periodStart: string;
  /** 查詢期間結束日期 */
  periodEnd: string;
  /** 總成本（USD） */
  totalCost: number;
  /** 總 API 呼叫次數 */
  totalCalls: number;
  /** 總輸入 tokens */
  totalInputTokens: number;
  /** 總輸出 tokens */
  totalOutputTokens: number;
  /** 整體成功率 (0-100) */
  overallSuccessRate: number;
  /** 各提供者成本明細 */
  providerBreakdown: ProviderCost[];
  /** 與上期比較的成本變化百分比 */
  costChangePercentage: number | null;
  /** 與上期比較的呼叫次數變化百分比 */
  callsChangePercentage: number | null;
}

// ============================================================
// Trend Data Types
// ============================================================

/**
 * 趨勢數據點
 */
export interface TrendDataPoint {
  /** 日期 (YYYY-MM-DD) */
  date: string;
  /** 總成本 */
  totalCost: number;
  /** 總呼叫次數 */
  totalCalls: number;
  /** 成功呼叫次數 */
  successCalls: number;
  /** 失敗呼叫次數 */
  failedCalls: number;
  /** 各提供者成本 */
  providerCosts: {
    provider: ApiProviderType;
    cost: number;
    calls: number;
  }[];
}

/**
 * 趨勢數據響應
 */
export interface AiCostTrend {
  /** 時間粒度 */
  granularity: Granularity;
  /** 數據點列表 */
  data: TrendDataPoint[];
  /** 期間總成本 */
  periodTotal: number;
  /** 平均每日成本 */
  averageDailyCost: number;
  /** 成本峰值 */
  peakCost: number;
  /** 成本峰值日期 */
  peakDate: string;
}

// ============================================================
// Daily Detail Types
// ============================================================

/**
 * 單筆 API 使用記錄
 */
export interface ApiUsageRecord {
  /** 記錄 ID */
  id: string;
  /** 關聯文件 ID */
  documentId: string | null;
  /** 城市代碼 */
  cityCode: string;
  /** API 提供者 */
  provider: ApiProviderType;
  /** 操作類型 */
  operation: string;
  /** 輸入 tokens */
  tokensInput: number | null;
  /** 輸出 tokens */
  tokensOutput: number | null;
  /** 預估成本 */
  estimatedCost: number;
  /** 響應時間 (ms) */
  responseTime: number | null;
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息 */
  errorMessage: string | null;
  /** 建立時間 */
  createdAt: string;
}

/**
 * 每日明細響應
 */
export interface DailyDetail {
  /** 查詢日期 */
  date: string;
  /** 當日成本摘要 */
  summary: {
    totalCost: number;
    totalCalls: number;
    successRate: number;
  };
  /** 使用記錄列表 */
  records: ApiUsageRecord[];
  /** 分頁信息 */
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ============================================================
// Anomaly Detection Types
// ============================================================

/**
 * 異常類型
 */
export type AnomalyType =
  | 'cost_spike'       // 成本突增
  | 'high_error_rate'  // 高錯誤率
  | 'unusual_volume'   // 異常呼叫量
  | 'slow_response';   // 響應時間過長

/**
 * 異常嚴重程度
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 異常記錄
 */
export interface Anomaly {
  /** 異常 ID */
  id: string;
  /** 異常類型 */
  type: AnomalyType;
  /** 嚴重程度 */
  severity: AnomalySeverity;
  /** 發生日期 */
  date: string;
  /** 相關提供者 */
  provider: ApiProviderType | null;
  /** 異常描述 */
  description: string;
  /** 當前值 */
  currentValue: number;
  /** 基準值（正常值） */
  baselineValue: number;
  /** 偏差百分比 */
  deviationPercentage: number;
  /** 是否已確認 */
  acknowledged: boolean;
  /** 確認者 */
  acknowledgedBy: string | null;
  /** 確認時間 */
  acknowledgedAt: string | null;
}

/**
 * 異常檢測響應
 */
export interface AnomalyDetectionResult {
  /** 檢測期間開始 */
  periodStart: string;
  /** 檢測期間結束 */
  periodEnd: string;
  /** 異常列表 */
  anomalies: Anomaly[];
  /** 各嚴重程度統計 */
  severityCounts: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

// ============================================================
// API Request Types
// ============================================================

/**
 * 成本摘要查詢參數
 */
export interface AiCostSummaryParams {
  /** 城市代碼（可多選） */
  cityCodes?: string[];
  /** 開始日期 */
  startDate?: string;
  /** 結束日期 */
  endDate?: string;
  /** 是否強制刷新快取 */
  forceRefresh?: boolean;
}

/**
 * 趨勢查詢參數
 */
export interface AiCostTrendParams {
  /** 城市代碼（可多選） */
  cityCodes?: string[];
  /** 開始日期 */
  startDate: string;
  /** 結束日期 */
  endDate: string;
  /** 時間粒度 */
  granularity?: Granularity;
  /** 提供者過濾 */
  providers?: ApiProviderType[];
}

/**
 * 每日明細查詢參數
 */
export interface DailyDetailParams {
  /** 查詢日期 */
  date: string;
  /** 城市代碼（可多選） */
  cityCodes?: string[];
  /** 提供者過濾 */
  providers?: ApiProviderType[];
  /** 僅顯示失敗記錄 */
  failedOnly?: boolean;
  /** 頁碼 */
  page?: number;
  /** 每頁數量 */
  limit?: number;
}

/**
 * 異常檢測查詢參數
 */
export interface AnomalyDetectionParams {
  /** 城市代碼（可多選） */
  cityCodes?: string[];
  /** 檢測天數（預設 7 天） */
  days?: number;
  /** 嚴重程度過濾 */
  minSeverity?: AnomalySeverity;
  /** 是否包含已確認的異常 */
  includeAcknowledged?: boolean;
}

// ============================================================
// API Response Types
// ============================================================

/**
 * API 成功響應
 */
export interface AiCostApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    cached?: boolean;
    cachedAt?: string;
    expiresAt?: string;
  };
}

/**
 * API 錯誤響應
 */
export interface AiCostApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================
// Component Props Types
// ============================================================

/**
 * AiCostCard 組件 Props
 */
export interface AiCostCardProps {
  /** 城市代碼過濾 */
  cityCodes?: string[];
  /** 日期範圍（天數） */
  dateRange?: number;
  /** 是否顯示詳細信息連結 */
  showDetailLink?: boolean;
  /** 自定義 className */
  className?: string;
}

/**
 * 成本趨勢圖表 Props
 */
export interface CostTrendChartProps {
  /** 趨勢數據 */
  data: TrendDataPoint[];
  /** 時間粒度 */
  granularity: Granularity;
  /** 是否顯示提供者分類 */
  showProviderBreakdown?: boolean;
  /** 圖表高度 */
  height?: number;
  /** 自定義 className */
  className?: string;
}

/**
 * 提供者成本分佈圖表 Props
 */
export interface ProviderDistributionProps {
  /** 提供者成本數據 */
  data: ProviderCost[];
  /** 圖表類型 */
  chartType?: 'pie' | 'bar';
  /** 自定義 className */
  className?: string;
}
