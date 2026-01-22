/**
 * @fileoverview LOOKUP 查表映射轉換器
 * @description
 *   實現查表映射的轉換邏輯，根據對照表將源值轉換為目標值
 *   支援預設值設定
 *
 * @module src/services/transform/lookup
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - 查表映射
 *   - 預設值支援
 *   - 字串鍵值匹配
 *
 * @dependencies
 *   - ./types.ts - Transform 介面
 */

import type {
  Transform,
  TransformContext,
  TransformParams,
  LookupTransformParams,
} from './types';

// ============================================================================
// Lookup Transform Implementation
// ============================================================================

/**
 * LOOKUP 查表映射轉換器
 * @description
 *   根據對照表將源值轉換為目標值
 *   如果源值不在對照表中，返回預設值或原始值
 *
 * @example
 * ```typescript
 * const transform = new LookupTransform();
 * const params = {
 *   lookupTable: { 'AIR': '空運', 'SEA': '海運' },
 *   defaultValue: '其他'
 * };
 * const result = await transform.execute('AIR', params, context);
 * // result: '空運'
 * ```
 */
export class LookupTransform implements Transform {
  /**
   * 轉換類型
   */
  readonly type = 'LOOKUP' as const;

  /**
   * 執行查表映射
   *
   * @description
   *   1. 將源值轉為字串作為查表鍵
   *   2. 在對照表中查找對應值
   *   3. 未找到時返回預設值或原始值
   *
   * @param value - 源欄位值
   * @param params - 查表參數
   * @param _context - 不使用
   * @returns 查表結果
   */
  async execute(
    value: unknown,
    params: TransformParams,
    _context: TransformContext
  ): Promise<unknown> {
    const lookupParams = params as LookupTransformParams;

    if (!lookupParams?.lookupTable) {
      throw new Error('LOOKUP 轉換需要提供 lookupTable 參數');
    }

    // 將值轉為字串作為查表鍵
    const key = this.toKey(value);

    // 查表
    if (key in lookupParams.lookupTable) {
      return lookupParams.lookupTable[key];
    }

    // 未找到時返回預設值或原始值
    if (lookupParams.defaultValue !== undefined) {
      return lookupParams.defaultValue;
    }

    return value;
  }

  /**
   * 將值轉換為查表鍵
   *
   * @description
   *   - null/undefined → 空字串
   *   - 其他類型 → String(value)
   *
   * @param value - 源值
   * @returns 查表鍵
   */
  private toKey(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  /**
   * 驗證轉換參數
   *
   * @param params - 轉換參數
   * @returns 驗證結果
   */
  validateParams(params: TransformParams): { isValid: boolean; error?: string } {
    const lookupParams = params as LookupTransformParams;

    if (!lookupParams) {
      return { isValid: false, error: 'LOOKUP 轉換需要提供參數' };
    }

    if (!lookupParams.lookupTable) {
      return { isValid: false, error: 'LOOKUP 轉換需要提供 lookupTable' };
    }

    if (typeof lookupParams.lookupTable !== 'object' || Array.isArray(lookupParams.lookupTable)) {
      return { isValid: false, error: 'lookupTable 必須是物件' };
    }

    if (Object.keys(lookupParams.lookupTable).length === 0) {
      return { isValid: false, error: 'lookupTable 不能為空' };
    }

    return { isValid: true };
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * LOOKUP 轉換器單例
 */
export const lookupTransform = new LookupTransform();
