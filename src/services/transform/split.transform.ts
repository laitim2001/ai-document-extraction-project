/**
 * @fileoverview SPLIT 字串分割轉換器
 * @description
 *   實現字串分割的轉換邏輯，將字串按分隔符分割並取指定索引的部分
 *
 * @module src/services/transform/split
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - 字串分割
 *   - 指定索引取值
 *   - 越界處理
 *
 * @dependencies
 *   - ./types.ts - Transform 介面
 */

import type {
  Transform,
  TransformContext,
  TransformParams,
  SplitTransformParams,
} from './types';

// ============================================================================
// Split Transform Implementation
// ============================================================================

/**
 * SPLIT 字串分割轉換器
 * @description
 *   將字串按分隔符分割並取指定索引的部分
 *   索引越界時返回空字串
 *
 * @example
 * ```typescript
 * const transform = new SplitTransform();
 * const params = { separator: '-', index: 1 };
 * const result = await transform.execute('2026-01-22', params, context);
 * // result: '01'
 * ```
 */
export class SplitTransform implements Transform {
  /**
   * 轉換類型
   */
  readonly type = 'SPLIT' as const;

  /**
   * 執行字串分割
   *
   * @description
   *   1. 將源值轉為字串
   *   2. 按分隔符分割
   *   3. 取指定索引的部分
   *
   * @param value - 源欄位值
   * @param params - 分割參數
   * @param _context - 不使用
   * @returns 分割後取得的部分
   */
  async execute(
    value: unknown,
    params: TransformParams,
    _context: TransformContext
  ): Promise<unknown> {
    const splitParams = params as SplitTransformParams;

    if (!splitParams?.separator) {
      throw new Error('SPLIT 轉換需要提供 separator 參數');
    }

    if (splitParams.index === undefined || splitParams.index === null) {
      throw new Error('SPLIT 轉換需要提供 index 參數');
    }

    // 將值轉為字串
    const strValue = value === null || value === undefined ? '' : String(value);

    // 分割
    const parts = strValue.split(splitParams.separator);

    // 取指定索引（支援負數索引）
    let index = splitParams.index;
    if (index < 0) {
      index = parts.length + index;
    }

    // 越界處理
    if (index < 0 || index >= parts.length) {
      return '';
    }

    return parts[index];
  }

  /**
   * 驗證轉換參數
   *
   * @param params - 轉換參數
   * @returns 驗證結果
   */
  validateParams(params: TransformParams): { isValid: boolean; error?: string } {
    const splitParams = params as SplitTransformParams;

    if (!splitParams) {
      return { isValid: false, error: 'SPLIT 轉換需要提供參數' };
    }

    if (splitParams.separator === undefined || splitParams.separator === null) {
      return { isValid: false, error: 'SPLIT 轉換需要提供 separator' };
    }

    if (typeof splitParams.separator !== 'string') {
      return { isValid: false, error: 'separator 必須是字串' };
    }

    if (splitParams.index === undefined || splitParams.index === null) {
      return { isValid: false, error: 'SPLIT 轉換需要提供 index' };
    }

    if (typeof splitParams.index !== 'number' || !Number.isInteger(splitParams.index)) {
      return { isValid: false, error: 'index 必須是整數' };
    }

    return { isValid: true };
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * SPLIT 轉換器單例
 */
export const splitTransform = new SplitTransform();
