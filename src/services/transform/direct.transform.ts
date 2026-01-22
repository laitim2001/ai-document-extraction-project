/**
 * @fileoverview DIRECT 直接映射轉換器
 * @description
 *   實現最簡單的轉換邏輯：直接複製源欄位值到目標欄位
 *   不進行任何值的修改或計算
 *
 * @module src/services/transform/direct
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - 直接值複製
 *   - 無參數需求
 *   - 最高效能的轉換類型
 *
 * @dependencies
 *   - ./types.ts - Transform 介面
 */

import type { Transform, TransformContext, TransformParams } from './types';

// ============================================================================
// Direct Transform Implementation
// ============================================================================

/**
 * DIRECT 直接映射轉換器
 * @description
 *   直接將源欄位值複製到目標欄位
 *   適用於一對一直接對應的欄位映射
 *
 * @example
 * ```typescript
 * const transform = new DirectTransform();
 * const result = await transform.execute('hello', null, context);
 * // result: 'hello'
 * ```
 */
export class DirectTransform implements Transform {
  /**
   * 轉換類型
   */
  readonly type = 'DIRECT' as const;

  /**
   * 執行直接映射
   *
   * @description
   *   直接返回輸入值，不做任何修改
   *   支援任何類型的值：string、number、boolean、object、array 等
   *
   * @param value - 源欄位值
   * @param _params - 不使用（DIRECT 不需要參數）
   * @param _context - 不使用（DIRECT 不需要上下文）
   * @returns 原始值
   */
  async execute(
    value: unknown,
    _params: TransformParams,
    _context: TransformContext
  ): Promise<unknown> {
    return value;
  }

  /**
   * 驗證轉換參數
   *
   * @description DIRECT 轉換不需要參數，永遠返回有效
   *
   * @param _params - 不使用
   * @returns 永遠返回 { isValid: true }
   */
  validateParams(_params: TransformParams): { isValid: boolean; error?: string } {
    // DIRECT 轉換不需要任何參數
    return { isValid: true };
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * DIRECT 轉換器單例
 */
export const directTransform = new DirectTransform();
