/**
 * @fileoverview Transform 轉換器類型定義
 * @description
 *   定義欄位轉換器的介面和相關類型
 *   支援 DIRECT、FORMULA、LOOKUP、CONCAT、SPLIT、CUSTOM 六種轉換類型
 *
 * @module src/services/transform/types
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - Transform 介面定義
 *   - 轉換參數類型
 *   - 轉換上下文類型
 *
 * @dependencies
 *   - src/types/template-field-mapping.ts - 轉換類型定義
 */

import type {
  FieldTransformType,
  FormulaTransformParams,
  LookupTransformParams,
  ConcatTransformParams,
  SplitTransformParams,
  CustomTransformParams,
  TransformParams,
} from '@/types/template-field-mapping';

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type {
  FieldTransformType,
  FormulaTransformParams,
  LookupTransformParams,
  ConcatTransformParams,
  SplitTransformParams,
  CustomTransformParams,
  TransformParams,
};

// ============================================================================
// Transform Interface
// ============================================================================

/**
 * 轉換上下文
 * @description 提供轉換時可用的額外資訊
 */
export interface TransformContext {
  /**
   * 整行的所有欄位值
   * @description 用於 FORMULA 計算和 CONCAT 合併
   */
  row: Record<string, unknown>;
  /**
   * 來源欄位名稱
   */
  sourceField: string;
  /**
   * 目標欄位名稱
   */
  targetField: string;
}

/**
 * 轉換器介面
 * @description 所有轉換器必須實現的介面
 */
export interface Transform {
  /**
   * 轉換類型
   */
  readonly type: FieldTransformType;

  /**
   * 執行轉換
   *
   * @param value - 源欄位值
   * @param params - 轉換參數
   * @param context - 轉換上下文
   * @returns 轉換後的值
   * @throws Error 轉換失敗時拋出
   */
  execute(
    value: unknown,
    params: TransformParams,
    context: TransformContext
  ): Promise<unknown>;

  /**
   * 驗證轉換參數
   *
   * @param params - 轉換參數
   * @returns 驗證結果
   */
  validateParams(params: TransformParams): { isValid: boolean; error?: string };
}

// ============================================================================
// Transform Result Types
// ============================================================================

/**
 * 轉換結果
 */
export interface TransformResult {
  /**
   * 是否成功
   */
  success: boolean;
  /**
   * 轉換後的值
   */
  value?: unknown;
  /**
   * 錯誤訊息
   */
  error?: string;
}

/**
 * 批量轉換結果
 */
export interface BatchTransformResult {
  /**
   * 目標欄位名 → 轉換結果
   */
  fields: Record<string, TransformResult>;
  /**
   * 是否全部成功
   */
  allSuccess: boolean;
  /**
   * 錯誤數量
   */
  errorCount: number;
}
