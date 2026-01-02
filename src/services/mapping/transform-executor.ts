/**
 * @fileoverview 轉換執行器（Strategy Pattern）
 * @description
 *   使用策略模式實現五種轉換類型：
 *   - DIRECT: 直接映射
 *   - CONCAT: 多欄位連接
 *   - SPLIT: 分割取值
 *   - LOOKUP: 查表映射
 *   - CUSTOM: 自定義表達式
 *
 * @module src/services/mapping/transform-executor
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 *
 * @features
 *   - 策略模式實現五種轉換類型
 *   - 類型安全的轉換參數處理
 *   - 安全的 CUSTOM 表達式執行
 *
 * @dependencies
 *   - @/types/field-mapping - 類型定義
 */

import type {
  ITransformExecutor,
  EffectiveRule,
  TransformType,
  TransformParams,
} from '@/types/field-mapping';

// ============================================================================
// 策略介面定義
// ============================================================================

/**
 * 轉換策略介面
 */
interface TransformStrategy {
  /**
   * 執行轉換
   * @param values 來源欄位值（按 sourceFields 順序）
   * @param params 轉換參數
   * @returns 轉換後的值
   */
  execute(
    values: (string | number | null)[],
    params: TransformParams | null
  ): string | number | null;
}

// ============================================================================
// 策略實現
// ============================================================================

/**
 * DIRECT 策略：直接映射
 * @description 直接返回第一個來源欄位的值
 */
class DirectStrategy implements TransformStrategy {
  execute(values: (string | number | null)[]): string | number | null {
    return values[0] ?? null;
  }
}

/**
 * CONCAT 策略：多欄位連接
 * @description 使用分隔符連接多個欄位值
 */
class ConcatStrategy implements TransformStrategy {
  execute(
    values: (string | number | null)[],
    params: TransformParams | null
  ): string | number | null {
    const separator = params?.separator ?? '';

    // 過濾掉 null 值並轉為字串
    const stringValues = values
      .filter((v): v is string | number => v !== null && v !== undefined)
      .map((v) => String(v));

    if (stringValues.length === 0) {
      return null;
    }

    return stringValues.join(separator);
  }
}

/**
 * SPLIT 策略：分割取值
 * @description 使用分隔符分割第一個欄位值，返回指定索引位置的值
 */
class SplitStrategy implements TransformStrategy {
  execute(
    values: (string | number | null)[],
    params: TransformParams | null
  ): string | number | null {
    const value = values[0];
    if (value === null || value === undefined) {
      return null;
    }

    const stringValue = String(value);
    const separator = params?.separator ?? params?.delimiter ?? ',';
    const index = params?.index ?? 0;

    const parts = stringValue.split(separator);
    const result = parts[index]?.trim();

    return result ?? null;
  }
}

/**
 * LOOKUP 策略：查表映射
 * @description 在映射表中查找來源值，返回對應的目標值
 */
class LookupStrategy implements TransformStrategy {
  execute(
    values: (string | number | null)[],
    params: TransformParams | null
  ): string | number | null {
    const value = values[0];
    if (value === null || value === undefined) {
      return params?.defaultValue ?? null;
    }

    const stringValue = String(value);
    const lookupTable = params?.lookupTable ?? {};
    const defaultValue = params?.defaultValue ?? null;

    return lookupTable[stringValue] ?? defaultValue;
  }
}

/**
 * CUSTOM 策略：自定義表達式
 * @description 使用自定義表達式轉換值（僅支援簡單替換）
 */
class CustomStrategy implements TransformStrategy {
  execute(
    values: (string | number | null)[],
    params: TransformParams | null,
    sourceFields?: string[]
  ): string | number | null {
    const expression = params?.expression ?? '';
    if (!expression) {
      return values[0] ?? null;
    }

    let result = expression;

    // 支援 ${fieldName} 和 ${0}, ${1} 等替換
    if (sourceFields && sourceFields.length > 0) {
      sourceFields.forEach((field, idx) => {
        const value = values[idx] ?? '';
        const stringValue = String(value);

        // 替換 ${fieldName}
        result = result.replace(
          new RegExp(`\\$\\{${this.escapeRegex(field)}\\}`, 'g'),
          stringValue
        );

        // 替換 ${index}
        result = result.replace(
          new RegExp(`\\$\\{${idx}\\}`, 'g'),
          stringValue
        );
      });
    } else {
      // 只使用索引替換
      values.forEach((value, idx) => {
        const stringValue = value !== null ? String(value) : '';
        result = result.replace(
          new RegExp(`\\$\\{${idx}\\}`, 'g'),
          stringValue
        );
      });
    }

    return result;
  }

  /**
   * 轉義正則表達式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================================================
// 策略工廠
// ============================================================================

/**
 * 轉換策略工廠
 * @description 根據轉換類型返回對應的策略實例
 */
class TransformStrategyFactory {
  private static readonly strategies: Record<TransformType, TransformStrategy> = {
    DIRECT: new DirectStrategy(),
    CONCAT: new ConcatStrategy(),
    SPLIT: new SplitStrategy(),
    LOOKUP: new LookupStrategy(),
    CUSTOM: new CustomStrategy(),
  };

  /**
   * 獲取策略
   * @param type 轉換類型
   * @returns 對應的策略實例
   */
  static getStrategy(type: TransformType): TransformStrategy {
    const strategy = this.strategies[type];
    if (!strategy) {
      throw new Error(`Unknown transform type: ${type}`);
    }
    return strategy;
  }
}

// ============================================================================
// TransformExecutor 實現
// ============================================================================

/**
 * 轉換執行器
 * @description 使用策略模式執行欄位值轉換
 */
export class TransformExecutor implements ITransformExecutor {
  /**
   * 執行轉換
   * @param sourceValues 來源欄位值映射（fieldName -> value）
   * @param rule 要套用的規則
   * @returns 轉換後的值
   */
  execute(
    sourceValues: Record<string, string | number | null>,
    rule: EffectiveRule
  ): string | number | null {
    try {
      // 1. 獲取來源欄位值（按 sourceFields 順序）
      const values = rule.sourceFields.map((field) => sourceValues[field] ?? null);

      // 2. 獲取對應的策略
      const strategy = TransformStrategyFactory.getStrategy(rule.transformType);

      // 3. 執行轉換
      if (rule.transformType === 'CUSTOM' && strategy instanceof CustomStrategy) {
        // CUSTOM 策略需要額外傳入 sourceFields
        return strategy.execute(values, rule.transformParams, rule.sourceFields);
      }

      return strategy.execute(values, rule.transformParams);
    } catch (error) {
      console.error(
        `[TransformExecutor] Error executing transform for rule ${rule.id}:`,
        error
      );
      return null;
    }
  }

  /**
   * 批量執行轉換
   * @param sourceValues 來源欄位值映射
   * @param rules 要套用的規則列表
   * @returns 轉換結果映射（targetField -> value）
   */
  executeBatch(
    sourceValues: Record<string, string | number | null>,
    rules: EffectiveRule[]
  ): Record<string, string | number | null> {
    const results: Record<string, string | number | null> = {};

    for (const rule of rules) {
      if (rule.isActive) {
        results[rule.targetField] = this.execute(sourceValues, rule);
      }
    }

    return results;
  }

  /**
   * 驗證轉換參數
   * @param type 轉換類型
   * @param params 轉換參數
   * @returns 驗證結果
   */
  static validateParams(
    type: TransformType,
    params: TransformParams | null
  ): { valid: boolean; error?: string } {
    switch (type) {
      case 'DIRECT':
        // DIRECT 不需要參數
        return { valid: true };

      case 'CONCAT':
        // CONCAT 的 separator 是可選的
        return { valid: true };

      case 'SPLIT':
        // SPLIT 需要 separator/delimiter 和 index
        if (!params?.separator && !params?.delimiter) {
          return { valid: false, error: 'SPLIT requires separator or delimiter' };
        }
        if (params.index === undefined) {
          return { valid: false, error: 'SPLIT requires index' };
        }
        if (typeof params.index !== 'number' || params.index < 0) {
          return { valid: false, error: 'SPLIT index must be a non-negative number' };
        }
        return { valid: true };

      case 'LOOKUP':
        // LOOKUP 需要 lookupTable
        if (!params?.lookupTable) {
          return { valid: false, error: 'LOOKUP requires lookupTable' };
        }
        return { valid: true };

      case 'CUSTOM':
        // CUSTOM 需要 expression
        if (!params?.expression) {
          return { valid: false, error: 'CUSTOM requires expression' };
        }
        return { valid: true };

      default:
        return { valid: false, error: `Unknown transform type: ${type}` };
    }
  }
}

// ============================================================================
// 導出
// ============================================================================

/**
 * TransformExecutor 單例實例
 */
export const transformExecutor = new TransformExecutor();
