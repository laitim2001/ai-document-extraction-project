/**
 * @fileoverview FORMULA 公式計算轉換器
 * @description
 *   實現公式計算的轉換邏輯，支援變數佔位符和基本數學運算
 *   安全執行：只允許數字和基本運算符
 *
 * @module src/services/transform/formula
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - 變數佔位符替換 {field_name}
 *   - 基本運算符支援 + - * / ( )
 *   - 安全的公式求值
 *   - 數值類型檢查
 *
 * @dependencies
 *   - ./types.ts - Transform 介面
 */

import type {
  Transform,
  TransformContext,
  TransformParams,
  FormulaTransformParams,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * 允許的公式字符（數字、運算符、空白、小數點、括號）
 */
const SAFE_FORMULA_PATTERN = /^[\d\s\+\-\*\/\.\(\)]+$/;

/**
 * 變數佔位符模式 {field_name}
 */
const VARIABLE_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

// ============================================================================
// Formula Transform Implementation
// ============================================================================

/**
 * FORMULA 公式計算轉換器
 * @description
 *   支援變數佔位符和基本數學運算
 *   會替換公式中的 {field_name} 為實際值後計算
 *
 * @example
 * ```typescript
 * const transform = new FormulaTransform();
 * const context = {
 *   row: { sea_freight: 500, terminal_handling: 100 },
 *   sourceField: 'sea_freight',
 *   targetField: 'total_shipping'
 * };
 * const params = { formula: '{sea_freight} + {terminal_handling}' };
 * const result = await transform.execute(500, params, context);
 * // result: 600
 * ```
 */
export class FormulaTransform implements Transform {
  /**
   * 轉換類型
   */
  readonly type = 'FORMULA' as const;

  /**
   * 執行公式計算
   *
   * @description
   *   1. 解析公式中的變數佔位符
   *   2. 替換為實際數值
   *   3. 安全計算公式結果
   *
   * @param _value - 源欄位值（公式模式下通常不直接使用）
   * @param params - 公式參數
   * @param context - 轉換上下文（提供整行資料用於變數替換）
   * @returns 計算結果
   * @throws Error 公式無效或計算失敗時拋出
   */
  async execute(
    _value: unknown,
    params: TransformParams,
    context: TransformContext
  ): Promise<unknown> {
    const formulaParams = params as FormulaTransformParams;

    if (!formulaParams?.formula) {
      throw new Error('FORMULA 轉換需要提供 formula 參數');
    }

    // 替換變數佔位符
    const expression = this.replaceVariables(formulaParams.formula, context.row);

    // 安全計算
    return this.safeEval(expression);
  }

  /**
   * 替換公式中的變數佔位符
   *
   * @param formula - 原始公式
   * @param row - 整行資料
   * @returns 替換後的表達式
   */
  private replaceVariables(formula: string, row: Record<string, unknown>): string {
    return formula.replace(VARIABLE_PATTERN, (match, fieldName) => {
      const value = row[fieldName];

      if (value === undefined || value === null) {
        // 缺失值視為 0
        return '0';
      }

      const numValue = Number(value);
      if (Number.isNaN(numValue)) {
        // 非數值視為 0
        return '0';
      }

      return String(numValue);
    });
  }

  /**
   * 安全計算公式
   *
   * @description
   *   只允許數字和基本運算符，防止代碼注入
   *
   * @param expression - 純數字表達式
   * @returns 計算結果
   * @throws Error 公式無效時拋出
   */
  private safeEval(expression: string): number {
    // 移除空白後檢查
    const cleanExpr = expression.replace(/\s+/g, '');

    if (!SAFE_FORMULA_PATTERN.test(cleanExpr)) {
      throw new Error(`公式包含不允許的字符: ${expression}`);
    }

    // 檢查是否為空表達式
    if (!cleanExpr || cleanExpr === '') {
      throw new Error('公式不能為空');
    }

    try {
      // 使用 Function 安全計算
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const result = Function(`"use strict"; return (${cleanExpr})`)() as number;

      // 檢查結果是否有效
      if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
        throw new Error(`公式計算結果無效: ${expression} = ${result}`);
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`公式計算失敗: ${expression} - ${error.message}`);
      }
      throw new Error(`公式計算失敗: ${expression}`);
    }
  }

  /**
   * 驗證轉換參數
   *
   * @param params - 轉換參數
   * @returns 驗證結果
   */
  validateParams(params: TransformParams): { isValid: boolean; error?: string } {
    const formulaParams = params as FormulaTransformParams;

    if (!formulaParams) {
      return { isValid: false, error: 'FORMULA 轉換需要提供參數' };
    }

    if (!formulaParams.formula || typeof formulaParams.formula !== 'string') {
      return { isValid: false, error: 'FORMULA 轉換需要提供 formula 字串' };
    }

    if (formulaParams.formula.trim() === '') {
      return { isValid: false, error: 'formula 不能為空' };
    }

    // 驗證公式語法（替換變數為 0 後檢查）
    const testExpr = formulaParams.formula.replace(VARIABLE_PATTERN, '0');
    const cleanExpr = testExpr.replace(/\s+/g, '');

    if (!SAFE_FORMULA_PATTERN.test(cleanExpr)) {
      return {
        isValid: false,
        error: `公式包含不允許的字符，只允許數字和運算符 + - * / ( )`,
      };
    }

    return { isValid: true };
  }
}

// ============================================================================
// Export
// ============================================================================

/**
 * FORMULA 轉換器單例
 */
export const formulaTransform = new FormulaTransform();
