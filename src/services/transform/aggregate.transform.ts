/**
 * @fileoverview AGGREGATE 行項目聚合轉換器
 * @description
 *   從 TransformContext 中的 lineItems/extraCharges 進行過濾和聚合
 *   支援 classifiedAs 過濾、多種聚合函數（SUM, AVG, COUNT, MAX, MIN, FIRST, LAST）
 *
 * @module src/services/transform/aggregate
 * @since CHANGE-043 Phase 2
 * @lastModified 2026-02-25
 *
 * @features
 *   - 按 classifiedAs 過濾 lineItems/extraCharges
 *   - 支援 classifiedAsIn 多值匹配
 *   - 支援 descriptionPattern 正則匹配
 *   - SUM/AVG/COUNT/MAX/MIN/FIRST/LAST 聚合
 *   - defaultValue 當無匹配時返回
 *
 * @dependencies
 *   - ./types.ts - Transform 介面
 */

import type { Transform, TransformContext, TransformParams, AggregateTransformParams } from './types';

// ============================================================================
// Types
// ============================================================================

interface AggregateItem {
  description: string;
  classifiedAs?: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
}

// ============================================================================
// AggregateTransform Implementation
// ============================================================================

/**
 * AGGREGATE 行項目聚合轉換器
 * @description
 *   從 lineItems/extraCharges 中過濾並聚合數據
 *   適用於將行項目費用轉換為 Pivot 模式的單一欄位值
 *
 * @example
 * ```typescript
 * const transform = new AggregateTransform();
 * const result = await transform.execute(
 *   null, // sourceValue 不使用
 *   {
 *     source: 'all',
 *     filter: { classifiedAs: 'THC' },
 *     aggregation: 'SUM',
 *     field: 'amount',
 *   },
 *   context // context.lineItems 包含原始行項目
 * );
 * // result: 150 (THC items sum)
 * ```
 */
export class AggregateTransform implements Transform {
  /**
   * 轉換類型
   */
  readonly type = 'AGGREGATE' as const;

  /**
   * 執行聚合轉換
   *
   * @param _value - 不使用（AGGREGATE 從 context 讀取數據）
   * @param params - 聚合參數（source, filter, aggregation, field）
   * @param context - 轉換上下文（包含 lineItems/extraCharges）
   * @returns 聚合結果
   */
  async execute(
    _value: unknown,
    params: TransformParams,
    context: TransformContext
  ): Promise<unknown> {
    if (!params || !('source' in params) || !('aggregation' in params)) {
      throw new Error('AGGREGATE 轉換需要 source 和 aggregation 參數');
    }

    const aggParams = params as AggregateTransformParams;

    // 1. 選擇數據源
    const items = this.selectSource(aggParams.source, context);

    // 2. 過濾
    const filtered = this.filterItems(items, aggParams.filter);

    // 3. 聚合
    if (filtered.length === 0) {
      return aggParams.defaultValue ?? null;
    }

    return this.aggregate(filtered, aggParams.aggregation, aggParams.field);
  }

  /**
   * 驗證轉換參數
   */
  validateParams(params: TransformParams): { isValid: boolean; error?: string } {
    if (!params) {
      return { isValid: false, error: 'AGGREGATE 轉換需要參數' };
    }

    if (!('source' in params)) {
      return { isValid: false, error: '缺少 source 參數' };
    }

    const aggParams = params as AggregateTransformParams;

    // CHANGE-045: extraCharges removed; 'all' now means lineItems only (kept for backward compat)
    if (!['lineItems', 'extraCharges', 'all'].includes(aggParams.source)) {
      return { isValid: false, error: 'source 必須為 lineItems 或 all' };
    }

    if (!aggParams.filter || typeof aggParams.filter !== 'object') {
      return { isValid: false, error: '缺少 filter 參數' };
    }

    // 至少需要一個過濾條件
    const hasFilter = aggParams.filter.classifiedAs ||
      (aggParams.filter.classifiedAsIn && aggParams.filter.classifiedAsIn.length > 0) ||
      aggParams.filter.descriptionPattern;

    if (!hasFilter) {
      return { isValid: false, error: '至少需要一個過濾條件' };
    }

    if (!['SUM', 'AVG', 'COUNT', 'FIRST', 'LAST', 'MAX', 'MIN'].includes(aggParams.aggregation)) {
      return { isValid: false, error: '不支援的聚合函數' };
    }

    if (!['amount', 'quantity', 'unitPrice'].includes(aggParams.field)) {
      return { isValid: false, error: '不支援的聚合欄位' };
    }

    return { isValid: true };
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  /**
   * 選擇數據源
   */
  private selectSource(
    source: AggregateTransformParams['source'],
    context: TransformContext
  ): AggregateItem[] {
    switch (source) {
      case 'lineItems':
        return (context.lineItems || []) as AggregateItem[];
      case 'extraCharges':
        // CHANGE-045: extraCharges removed from Stage 3; return empty for backward compat
        return [];
      case 'all':
        // CHANGE-045: 'all' now returns lineItems only
        return (context.lineItems || []) as AggregateItem[];
      default:
        return [];
    }
  }

  /**
   * 過濾項目
   */
  private filterItems(
    items: AggregateItem[],
    filter: AggregateTransformParams['filter']
  ): AggregateItem[] {
    return items.filter((item) => {
      // classifiedAs 精確匹配
      if (filter.classifiedAs) {
        if (item.classifiedAs !== filter.classifiedAs) return false;
      }

      // classifiedAsIn 列表匹配
      if (filter.classifiedAsIn && filter.classifiedAsIn.length > 0) {
        if (!item.classifiedAs || !filter.classifiedAsIn.includes(item.classifiedAs)) return false;
      }

      // descriptionPattern 正則匹配
      if (filter.descriptionPattern) {
        try {
          const regex = new RegExp(filter.descriptionPattern, 'i');
          if (!regex.test(item.description)) return false;
        } catch {
          // 無效正則，跳過此過濾條件
        }
      }

      return true;
    });
  }

  /**
   * 執行聚合計算
   */
  private aggregate(
    items: AggregateItem[],
    aggregation: AggregateTransformParams['aggregation'],
    field: AggregateTransformParams['field']
  ): number {
    const values = items.map((item) => {
      const val = item[field];
      return typeof val === 'number' ? val : 0;
    });

    switch (aggregation) {
      case 'SUM':
        return values.reduce((sum, v) => sum + v, 0);
      case 'AVG':
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      case 'COUNT':
        return items.length;
      case 'MAX':
        return Math.max(...values);
      case 'MIN':
        return Math.min(...values);
      case 'FIRST':
        return values[0] ?? 0;
      case 'LAST':
        return values[values.length - 1] ?? 0;
      default:
        return 0;
    }
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * AGGREGATE 轉換器單例
 */
export const aggregateTransform = new AggregateTransform();
