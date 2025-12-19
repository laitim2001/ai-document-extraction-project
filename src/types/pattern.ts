/**
 * @fileoverview 修正模式相關類型定義
 * @description
 *   定義修正模式分析系統所需的所有類型：
 *   - 提取上下文類型
 *   - 修正模式類型
 *   - 查詢參數和響應類型
 *   - 相似度分析類型
 *   - 狀態配置常量
 *
 * @module src/types/pattern
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 */

import type { PatternStatus } from '@prisma/client';

// ============================================================
// 提取上下文類型
// ============================================================

/**
 * 提取上下文資訊
 * 記錄欄位提取時的位置和方法資訊
 */
export interface ExtractionContext {
  /** 頁碼 */
  pageNumber?: number;
  /** 邊界框位置 */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 周圍文字 */
  surroundingText?: string;
  /** 提取方法 */
  extractionMethod?: string;
  /** 提取信心度 */
  confidence?: number;
}

// ============================================================
// 修正模式類型
// ============================================================

/**
 * 模式內的樣本值
 */
export interface PatternSampleValue {
  /** 原始值 */
  originalValue: string;
  /** 修正值 */
  correctedValue: string;
  /** 相似度分數 */
  similarity?: number;
  /** 出現次數 */
  count: number;
}

/**
 * 修正模式項目（列表用）
 */
export interface CorrectionPatternItem {
  id: string;
  forwarder: {
    id: string;
    name: string;
    code: string;
  };
  fieldName: string;
  patternHash: string;
  patterns: PatternSampleValue[];
  occurrenceCount: number;
  status: PatternStatus;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

/**
 * 模式關聯的修正記錄
 */
export interface PatternCorrection {
  id: string;
  documentId: string;
  documentName: string;
  originalValue: string | null;
  correctedValue: string;
  correctedBy: {
    id: string;
    name: string;
  };
  correctedAt: string;
}

/**
 * 修正模式詳情（包含關聯修正）
 */
export interface CorrectionPatternDetail extends CorrectionPatternItem {
  corrections: PatternCorrection[];
  suggestion?: {
    id: string;
    status: string;
    createdAt: string;
  };
}

// ============================================================
// 查詢參數類型
// ============================================================

/**
 * 模式列表查詢參數
 */
export interface PatternsQueryParams {
  /** 依 Forwarder 過濾 */
  forwarderId?: string;
  /** 依欄位名稱過濾 */
  fieldName?: string;
  /** 依狀態過濾 */
  status?: PatternStatus;
  /** 最小出現次數過濾 */
  minOccurrences?: number;
  /** 分頁 - 頁碼 */
  page?: number;
  /** 分頁 - 每頁筆數 */
  pageSize?: number;
  /** 排序欄位 */
  sortBy?: 'occurrenceCount' | 'lastSeenAt' | 'confidence';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================
// API 響應類型
// ============================================================

/**
 * 模式列表統計摘要
 */
export interface PatternsSummary {
  totalPatterns: number;
  candidatePatterns: number;
  detectedPatterns: number;
  processedPatterns: number;
  ignoredPatterns: number;
}

/**
 * 模式列表響應
 */
export interface PatternsListResponse {
  success: true;
  data: {
    patterns: CorrectionPatternItem[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    summary: PatternsSummary;
  };
}

/**
 * 模式詳情響應
 */
export interface PatternDetailResponse {
  success: true;
  data: CorrectionPatternDetail;
}

/**
 * 模式狀態更新請求
 */
export interface UpdatePatternStatusRequest {
  status: 'IGNORED' | 'PROCESSED';
  reason?: string;
}

// ============================================================
// 分析任務類型
// ============================================================

/**
 * 分析結果
 */
export interface AnalysisResult {
  /** 分析的修正數量 */
  totalAnalyzed: number;
  /** 發現的模式數量 */
  patternsDetected: number;
  /** 更新的模式數量 */
  patternsUpdated: number;
  /** 新建候選規則數量 */
  candidatesCreated: number;
  /** 執行時間 (ms) */
  executionTime: number;
  /** 執行狀態 */
  status: 'success' | 'partial' | 'failed';
  /** 錯誤訊息 */
  errorMessage?: string;
}

/**
 * 分析任務日誌
 */
export interface PatternAnalysisLogEntry {
  id: string;
  totalAnalyzed: number;
  patternsDetected: number;
  patternsUpdated: number;
  candidatesCreated: number;
  executionTime: number;
  status: string;
  errorMessage?: string;
  startedAt: string;
  completedAt: string;
}

// ============================================================
// 相似度分析類型
// ============================================================

/**
 * 相似度計算結果
 */
export interface SimilarityResult {
  /** 相似度分數 (0-1) */
  similarity: number;
  /** 是否達到匹配閾值 */
  isMatch: boolean;
}

/**
 * 分組後的修正記錄
 */
export interface GroupedCorrection {
  id: string;
  originalValue: string | null;
  correctedValue: string;
  documentId: string;
  correctedAt: Date;
}

/**
 * 模式分組
 */
export interface PatternGroup {
  /** 分組鍵 (forwarderId:fieldName) */
  key: string;
  forwarderId: string;
  fieldName: string;
  corrections: GroupedCorrection[];
}

/**
 * 數值相似度結果
 */
export interface NumericSimilarityResult {
  similarity: number;
  isNumeric: boolean;
}

/**
 * 日期相似度結果
 */
export interface DateSimilarityResult {
  similarity: number;
  isDate: boolean;
  formatChange?: string;
}

/**
 * 數值轉換模式檢測結果
 */
export interface NumericTransformPattern {
  hasPattern: boolean;
  type: 'multiply' | 'add' | 'none';
  factor?: number;
}

/**
 * 日期格式轉換模式檢測結果
 */
export interface DateFormatPattern {
  hasPattern: boolean;
  fromFormat?: string;
  toFormat?: string;
}

// ============================================================
// 狀態配置常量
// ============================================================

/**
 * 模式狀態配置
 */
export const PATTERN_STATUSES: {
  value: PatternStatus;
  label: string;
  description: string;
  color: 'secondary' | 'warning' | 'info' | 'success' | 'muted';
}[] = [
  {
    value: 'DETECTED',
    label: '已檢測',
    description: '已識別的修正模式，出現次數 < 3',
    color: 'secondary',
  },
  {
    value: 'CANDIDATE',
    label: '候選',
    description: '達到閾值的候選模式，等待審核',
    color: 'warning',
  },
  {
    value: 'SUGGESTED',
    label: '已建議',
    description: '已生成規則升級建議',
    color: 'info',
  },
  {
    value: 'PROCESSED',
    label: '已處理',
    description: '已完成處理',
    color: 'success',
  },
  {
    value: 'IGNORED',
    label: '已忽略',
    description: '手動標記為忽略',
    color: 'muted',
  },
];

/**
 * 模式分析閾值常量
 */
export const PATTERN_THRESHOLDS = {
  /** 候選標記閾值（修正次數） */
  CANDIDATE_THRESHOLD: 3,
  /** 相似度閾值 */
  SIMILARITY_THRESHOLD: 0.8,
  /** 字串長度相似度容差 */
  LENGTH_TOLERANCE: 0.3,
  /** 最大樣本值數量 */
  MAX_SAMPLE_VALUES: 10,
} as const;

/**
 * 獲取狀態顯示配置
 */
export function getPatternStatusConfig(status: PatternStatus) {
  return PATTERN_STATUSES.find((s) => s.value === status) ?? PATTERN_STATUSES[0];
}
