/**
 * @fileoverview Transform 執行器（工廠模式）
 * @description
 *   提供統一的轉換執行入口，根據轉換類型選擇對應的轉換器執行
 *   支援批量轉換和錯誤處理
 *
 * @module src/services/transform/transform-executor
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - 工廠模式選擇轉換器
 *   - 統一的執行介面
 *   - 批量轉換支援
 *   - 錯誤隔離處理
 *
 * @dependencies
 *   - ./types.ts - Transform 介面和類型
 *   - ./direct.transform.ts - DIRECT 轉換器
 *   - ./formula.transform.ts - FORMULA 轉換器
 *   - ./lookup.transform.ts - LOOKUP 轉換器
 *   - ./concat.transform.ts - CONCAT 轉換器
 *   - ./split.transform.ts - SPLIT 轉換器
 */

import type {
  Transform,
  TransformContext,
  TransformParams,
  FieldTransformType,
  TransformResult,
  BatchTransformResult,
} from './types';
import type { TemplateFieldMappingRule } from '@/types/template-field-mapping';

import { DirectTransform } from './direct.transform';
import { FormulaTransform } from './formula.transform';
import { LookupTransform } from './lookup.transform';
import { ConcatTransform } from './concat.transform';
import { SplitTransform } from './split.transform';

// ============================================================================
// TransformExecutor Class
// ============================================================================

/**
 * Transform 執行器
 * @description
 *   統一的轉換執行入口，管理所有轉換器實例
 *   使用工廠模式根據轉換類型選擇對應的轉換器
 *
 * @example
 * ```typescript
 * const executor = new TransformExecutor();
 *
 * // 單一值轉換
 * const result = await executor.execute(
 *   'hello',
 *   'DIRECT',
 *   null,
 *   { row: {}, sourceField: 'src', targetField: 'tgt' }
 * );
 *
 * // 批量轉換
 * const results = await executor.executeMany(
 *   { name: 'John', age: 30 },
 *   [
 *     { sourceField: 'name', targetField: 'userName', transformType: 'DIRECT', ... },
 *     { sourceField: 'age', targetField: 'userAge', transformType: 'DIRECT', ... }
 *   ]
 * );
 * ```
 */
export class TransformExecutor {
  /**
   * 轉換器實例映射
   */
  private transforms: Map<FieldTransformType, Transform>;

  /**
   * 建構子
   * @description 初始化所有轉換器實例
   */
  constructor() {
    this.transforms = new Map<FieldTransformType, Transform>();
    this.transforms.set('DIRECT', new DirectTransform());
    this.transforms.set('FORMULA', new FormulaTransform());
    this.transforms.set('LOOKUP', new LookupTransform());
    this.transforms.set('CONCAT', new ConcatTransform());
    this.transforms.set('SPLIT', new SplitTransform());
    // CUSTOM 轉換器因安全考量暫不啟用
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * 執行單一轉換
   *
   * @description
   *   根據轉換類型選擇對應的轉換器並執行
   *
   * @param value - 源欄位值
   * @param type - 轉換類型
   * @param params - 轉換參數
   * @param context - 轉換上下文
   * @returns 轉換後的值
   * @throws Error 如果轉換類型未支援或轉換失敗
   */
  async execute(
    value: unknown,
    type: FieldTransformType,
    params: TransformParams,
    context: TransformContext
  ): Promise<unknown> {
    const transform = this.transforms.get(type);

    if (!transform) {
      throw new Error(`不支援的轉換類型: ${type}`);
    }

    return transform.execute(value, params, context);
  }

  /**
   * 安全執行單一轉換
   *
   * @description
   *   與 execute 相同，但會捕獲錯誤並返回 TransformResult
   *
   * @param value - 源欄位值
   * @param type - 轉換類型
   * @param params - 轉換參數
   * @param context - 轉換上下文
   * @returns 轉換結果（包含成功狀態和錯誤訊息）
   */
  async executeSafe(
    value: unknown,
    type: FieldTransformType,
    params: TransformParams,
    context: TransformContext
  ): Promise<TransformResult> {
    try {
      const result = await this.execute(value, type, params, context);
      return { success: true, value: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '轉換失敗',
      };
    }
  }

  /**
   * 批量執行轉換
   *
   * @description
   *   根據映射規則列表，將源欄位轉換為目標欄位
   *   每個規則獨立執行，單一規則失敗不影響其他規則
   *
   * @param sourceFields - 源欄位值映射
   * @param mappings - 映射規則列表
   * @returns 批量轉換結果
   */
  async executeMany(
    sourceFields: Record<string, unknown>,
    mappings: TemplateFieldMappingRule[]
  ): Promise<BatchTransformResult> {
    const results: Record<string, TransformResult> = {};
    let errorCount = 0;

    // 按 order 排序
    const sortedMappings = [...mappings].sort((a, b) => a.order - b.order);

    for (const mapping of sortedMappings) {
      const sourceValue = sourceFields[mapping.sourceField];
      const context: TransformContext = {
        row: sourceFields,
        sourceField: mapping.sourceField,
        targetField: mapping.targetField,
      };

      const result = await this.executeSafe(
        sourceValue,
        mapping.transformType,
        mapping.transformParams ?? null,
        context
      );

      results[mapping.targetField] = result;

      if (!result.success) {
        errorCount++;
      }
    }

    return {
      fields: results,
      allSuccess: errorCount === 0,
      errorCount,
    };
  }

  /**
   * 驗證映射規則的轉換參數
   *
   * @description
   *   驗證所有映射規則的轉換參數是否有效
   *
   * @param mappings - 映射規則列表
   * @returns 驗證結果列表
   */
  validateMappings(
    mappings: TemplateFieldMappingRule[]
  ): Array<{ targetField: string; isValid: boolean; error?: string }> {
    return mappings.map((mapping) => {
      const transform = this.transforms.get(mapping.transformType);

      if (!transform) {
        return {
          targetField: mapping.targetField,
          isValid: false,
          error: `不支援的轉換類型: ${mapping.transformType}`,
        };
      }

      const validation = transform.validateParams(mapping.transformParams ?? null);

      return {
        targetField: mapping.targetField,
        ...validation,
      };
    });
  }

  /**
   * 檢查轉換類型是否支援
   *
   * @param type - 轉換類型
   * @returns 是否支援
   */
  isSupported(type: FieldTransformType): boolean {
    return this.transforms.has(type);
  }

  /**
   * 取得支援的轉換類型列表
   *
   * @returns 支援的轉換類型
   */
  getSupportedTypes(): FieldTransformType[] {
    return Array.from(this.transforms.keys());
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * TransformExecutor 單例
 */
export const transformExecutor = new TransformExecutor();
