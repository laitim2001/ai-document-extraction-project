/**
 * @fileoverview 欄位映射引擎
 * @description
 *   核心映射引擎，負責將提取的欄位值根據配置規則進行映射轉換。
 *   整合 ConfigResolver 和 TransformExecutor 來實現完整的映射流程。
 *
 * @module src/services/mapping/field-mapping-engine
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 *
 * @features
 *   - 套用配置規則到提取欄位
 *   - 追蹤規則套用來源
 *   - 處理未映射欄位
 *
 * @dependencies
 *   - @/types/field-mapping - 類型定義
 *   - ./config-resolver - 配置解析
 *   - ./transform-executor - 轉換執行
 */

import type {
  IFieldMappingEngine,
  ExtractedFieldValue,
  MappedFieldValue,
  ResolvedConfig,
  EffectiveRule,
  AppliedConfigInfo,
} from '@/types/field-mapping';
import { TransformExecutor } from './transform-executor';
import { ConfigResolver } from './config-resolver';

// ============================================================================
// FieldMappingEngine 實現
// ============================================================================

/**
 * 欄位映射引擎
 * @description 核心引擎，負責執行欄位映射
 */
export class FieldMappingEngine implements IFieldMappingEngine {
  private readonly transformExecutor: TransformExecutor;

  constructor(transformExecutor?: TransformExecutor) {
    this.transformExecutor = transformExecutor ?? new TransformExecutor();
  }

  /**
   * 套用映射規則
   * @description
   *   根據解析後的配置列表，對提取的欄位套用映射規則。
   *   規則優先級：FORMAT > COMPANY > GLOBAL（由 ConfigResolver.mergeConfigs 處理）
   *
   * @param extractedFields 提取的欄位
   * @param configs 解析後的配置列表（按優先級排序，高優先級在前）
   * @returns 映射後的欄位值列表
   */
  applyRules(
    extractedFields: ExtractedFieldValue[],
    configs: ResolvedConfig[]
  ): MappedFieldValue[] {
    const mappedFields: MappedFieldValue[] = [];

    // 1. 合併配置規則（高優先級覆蓋低優先級）
    const mergedRules = ConfigResolver.mergeConfigs(configs);

    if (mergedRules.length === 0) {
      return mappedFields;
    }

    // 2. 建立來源欄位值映射（fieldName -> value）
    const sourceValueMap = this.buildSourceValueMap(extractedFields);

    // 3. 建立配置資訊映射（configId -> configInfo）
    const configInfoMap = this.buildConfigInfoMap(configs);

    // 4. 對每個規則執行映射
    for (const rule of mergedRules) {
      const mappedField = this.applyRule(rule, sourceValueMap, configInfoMap);
      if (mappedField) {
        mappedFields.push(mappedField);
      }
    }

    return mappedFields;
  }

  /**
   * 取得未映射的欄位
   * @description 找出提取欄位中沒有被任何規則映射的欄位
   *
   * @param extractedFields 提取的欄位
   * @param mappedFields 映射後的欄位
   * @returns 未映射的欄位名稱列表
   */
  getUnmappedFields(
    extractedFields: ExtractedFieldValue[],
    mappedFields: MappedFieldValue[]
  ): string[] {
    // 收集所有被映射的來源欄位
    const mappedSourceFields = new Set<string>();
    for (const mapped of mappedFields) {
      for (const sourceField of mapped.sourceFields) {
        mappedSourceFields.add(sourceField);
      }
    }

    // 找出未被映射的欄位
    const unmappedFields: string[] = [];
    for (const extracted of extractedFields) {
      if (!mappedSourceFields.has(extracted.fieldName)) {
        unmappedFields.push(extracted.fieldName);
      }
    }

    return unmappedFields;
  }

  /**
   * 驗證規則是否可套用
   * @description 檢查規則所需的來源欄位是否都存在
   *
   * @param rule 映射規則
   * @param sourceValueMap 來源欄位值映射
   * @returns 是否可套用
   */
  canApplyRule(
    rule: EffectiveRule,
    sourceValueMap: Record<string, string | number | null>
  ): boolean {
    // 檢查所有來源欄位是否都存在
    return rule.sourceFields.every((field) => field in sourceValueMap);
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 建立來源欄位值映射
   */
  private buildSourceValueMap(
    extractedFields: ExtractedFieldValue[]
  ): Record<string, string | number | null> {
    const map: Record<string, string | number | null> = {};

    for (const field of extractedFields) {
      map[field.fieldName] = field.value;
    }

    return map;
  }

  /**
   * 建立配置資訊映射
   */
  private buildConfigInfoMap(
    configs: ResolvedConfig[]
  ): Map<string, { name: string; scope: ResolvedConfig['scope'] }> {
    const map = new Map<string, { name: string; scope: ResolvedConfig['scope'] }>();

    for (const config of configs) {
      map.set(config.id, { name: config.name, scope: config.scope });
    }

    return map;
  }

  /**
   * 套用單一規則
   */
  private applyRule(
    rule: EffectiveRule,
    sourceValueMap: Record<string, string | number | null>,
    configInfoMap: Map<string, { name: string; scope: ResolvedConfig['scope'] }>
  ): MappedFieldValue | null {
    // 檢查是否可套用
    if (!this.canApplyRule(rule, sourceValueMap)) {
      return null;
    }

    // 收集原始值
    const originalValues = rule.sourceFields.map(
      (field) => sourceValueMap[field] ?? null
    );

    try {
      // 執行轉換
      const transformedValue = this.transformExecutor.execute(sourceValueMap, rule);

      // 建立配置資訊
      const configInfo = configInfoMap.get(rule.configId);
      const appliedConfig: AppliedConfigInfo | undefined = configInfo
        ? {
            configId: rule.configId,
            configName: configInfo.name,
            scope: configInfo.scope,
            ruleId: rule.id,
            priority: rule.priority,
          }
        : undefined;

      return {
        targetField: rule.targetField,
        value: transformedValue,
        sourceFields: rule.sourceFields,
        originalValues,
        transformType: rule.transformType,
        success: true,
        ruleId: rule.id,
        appliedConfig,
      };
    } catch (error) {
      console.error(
        `[FieldMappingEngine] Error applying rule ${rule.id}:`,
        error
      );

      return {
        targetField: rule.targetField,
        value: null,
        sourceFields: rule.sourceFields,
        originalValues,
        transformType: rule.transformType,
        success: false,
        error: error instanceof Error ? error.message : '轉換失敗',
        ruleId: rule.id,
      };
    }
  }
}

// ============================================================================
// 導出
// ============================================================================

/**
 * FieldMappingEngine 單例實例
 */
export const fieldMappingEngine = new FieldMappingEngine();
