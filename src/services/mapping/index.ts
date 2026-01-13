/**
 * @fileoverview 映射模組統一導出
 * @description
 *   統一導出映射相關的所有服務、類別和類型。
 *   提供三層配置優先級系統和五種轉換類型的完整映射功能。
 *
 * @module src/services/mapping
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 *
 * @features
 *   - ConfigResolver - 配置解析器（三層優先級）
 *   - TransformExecutor - 轉換執行器（五種轉換類型）
 *   - FieldMappingEngine - 欄位映射引擎
 *   - MappingCache - 映射配置快取
 *   - DynamicMappingService - 動態映射服務（主入口）
 *
 * @example
 * ```typescript
 * import { dynamicMappingService } from '@/services/mapping';
 *
 * const result = await dynamicMappingService.mapFields(
 *   extractedFields,
 *   { companyId: 'xxx', documentFormatId: 'yyy' }
 * );
 * ```
 */

// ============================================================================
// 配置解析器
// ============================================================================

export { ConfigResolver, configResolver } from './config-resolver';

// ============================================================================
// 轉換執行器
// ============================================================================

export { TransformExecutor, transformExecutor } from './transform-executor';

// ============================================================================
// 欄位映射引擎
// ============================================================================

export { FieldMappingEngine, fieldMappingEngine } from './field-mapping-engine';

// ============================================================================
// 映射快取
// ============================================================================

export {
  MappingCache,
  mappingCache,
  type CacheStats,
} from './mapping-cache';

// ============================================================================
// 動態映射服務（主入口）
// ============================================================================

export {
  DynamicMappingService,
  dynamicMappingService,
} from './dynamic-mapping.service';

// ============================================================================
// 來源欄位服務（Story 16.6）
// ============================================================================

export {
  // Functions
  getStandardSourceFields,
  getAvailableSourceFields,
  getGroupedSourceFields,
  formatExtractedFieldLabel,
  searchFields,
  isValidFieldName,
  createCustomFieldOption,
  findFieldByName,
  getFieldStatistics,
  // Constants
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  // Types
  type SourceFieldOption,
  type GroupedSourceFields,
  type ExtractedFieldInfo,
} from './source-field.service';

// ============================================================================
// 常數定義
// ============================================================================

/**
 * 預設快取 TTL（5 分鐘）
 */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 配置範圍優先級
 * @description 數字越大優先級越高
 */
export const CONFIG_SCOPE_PRIORITY = {
  GLOBAL: 1,
  COMPANY: 2,
  FORMAT: 3,
} as const;

/**
 * 轉換類型列表
 */
export const TRANSFORM_TYPES = [
  'DIRECT',
  'CONCAT',
  'SPLIT',
  'LOOKUP',
  'CUSTOM',
] as const;
