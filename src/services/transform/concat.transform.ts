/**
 * @fileoverview CONCAT 字串合併轉換器
 * @description
 *   實現字串合併的轉換邏輯，將多個欄位值合併為單一字串
 *   支援自定義分隔符
 *
 * @module src/services/transform/concat
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - 多欄位合併
 *   - 自定義分隔符
 *   - 空值過濾
 *
 * @dependencies
 *   - ./types.ts - Transform 介面
 */

import type {
  Transform,
  TransformContext,
  TransformParams,
  ConcatTransformParams,
} from './types';

// ============================================================================
// Concat Transform Implementation
// ============================================================================

/**
 * CONCAT 字串合併轉換器
 * @description
 *   將多個欄位值合併為單一字串
 *   空值會被過濾掉
 *
 * @example
 * ```typescript
 * const transform = new ConcatTransform();
 * const context = {
 *   row: { first_name: 'John', last_name: 'Doe' },
 *   sourceField: 'first_name',
 *   targetField: 'full_name'
 * };
 * const params = { fields: ['first_name', 'last_name'], separator: ' ' };
 * const result = await transform.execute('John', params, context);
 * // result: 'John Doe'
 * ```
 */
export class ConcatTransform implements Transform {
  /**
   * 轉換類型
   */
  readonly type = 'CONCAT' as const;

  /**
   * 執行字串合併
   *
   * @description
   *   1. 從 context.row 中取得指定欄位的值
   *   2. 過濾空值
   *   3. 使用分隔符合併
   *
   * @param _value - 不直接使用（從 context.row 取得欄位值）
   * @param params - 合併參數
   * @param context - 轉換上下文
   * @returns 合併後的字串
   */
  async execute(
    _value: unknown,
    params: TransformParams,
    context: TransformContext
  ): Promise<unknown> {
    const concatParams = params as ConcatTransformParams;

    if (!concatParams?.fields || !Array.isArray(concatParams.fields)) {
      throw new Error('CONCAT 轉換需要提供 fields 陣列參數');
    }

    const separator = concatParams.separator ?? '';

    // 從 row 中取得欄位值並過濾空值
    const values = concatParams.fields
      .map((field) => context.row[field])
      .filter((v) => v !== null && v !== undefined && v !== '')
      .map((v) => String(v));

    return values.join(separator);
  }

  /**
   * 驗證轉換參數
   *
   * @param params - 轉換參數
   * @returns 驗證結果
   */
  validateParams(params: TransformParams): { isValid: boolean; error?: string } {
    const concatParams = params as ConcatTransformParams;

    if (!concatParams) {
      return { isValid: false, error: 'CONCAT 轉換需要提供參數' };
    }

    if (!concatParams.fields || !Array.isArray(concatParams.fields)) {
      return { isValid: false, error: 'CONCAT 轉換需要提供 fields 陣列' };
    }

    if (concatParams.fields.length === 0) {
      return { isValid: false, error: 'fields 陣列不能為空' };
    }

    if (concatParams.fields.some((f) => typeof f !== 'string')) {
      return { isValid: false, error: 'fields 陣列中的元素必須是字串' };
    }

    return { isValid: true };
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * CONCAT 轉換器單例
 */
export const concatTransform = new ConcatTransform();
