/**
 * @fileoverview Transform 轉換器模組入口
 * @description
 *   提供欄位轉換器的統一導出入口
 *   支援 DIRECT、FORMULA、LOOKUP、CONCAT、SPLIT 五種轉換類型
 *
 * @module src/services/transform
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - TransformExecutor 統一執行入口
 *   - 各種轉換器類型和實例
 *   - 類型定義導出
 *
 * @exports
 *   - TransformExecutor - 執行器類
 *   - transformExecutor - 執行器單例
 *   - DirectTransform, FormulaTransform, LookupTransform... - 各轉換器類
 *   - directTransform, formulaTransform, lookupTransform... - 各轉換器單例
 *   - Types - 相關類型定義
 */

// ============================================================================
// Types
// ============================================================================

export type {
  Transform,
  TransformContext,
  TransformResult,
  BatchTransformResult,
  FieldTransformType,
  TransformParams,
  FormulaTransformParams,
  LookupTransformParams,
  ConcatTransformParams,
  SplitTransformParams,
  CustomTransformParams,
} from './types';

// ============================================================================
// Transform Executor
// ============================================================================

export { TransformExecutor, transformExecutor } from './transform-executor';

// ============================================================================
// Individual Transforms
// ============================================================================

export { DirectTransform, directTransform } from './direct.transform';
export { FormulaTransform, formulaTransform } from './formula.transform';
export { LookupTransform, lookupTransform } from './lookup.transform';
export { ConcatTransform, concatTransform } from './concat.transform';
export { SplitTransform, splitTransform } from './split.transform';
