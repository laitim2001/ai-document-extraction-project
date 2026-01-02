/**
 * @fileoverview 動態欄位映射服務
 * @description
 *   主服務入口，整合 ConfigResolver、TransformExecutor、FieldMappingEngine
 *   和 MappingCache，提供完整的動態欄位映射功能。
 *
 *   映射流程：
 *   1. 檢查快取是否有可用配置
 *   2. 從資料庫解析配置（FORMAT > COMPANY > GLOBAL）
 *   3. 合併配置規則（高優先級覆蓋低優先級）
 *   4. 套用映射規則到提取欄位
 *   5. 返回映射結果
 *
 * @module src/services/mapping/dynamic-mapping
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 *
 * @features
 *   - 完整的欄位映射流程整合
 *   - 智能配置快取機制
 *   - 三層配置優先級處理
 *   - 執行時間追蹤
 *   - 錯誤處理和日誌
 *
 * @dependencies
 *   - @/types/field-mapping - 類型定義
 *   - ./config-resolver - 配置解析
 *   - ./transform-executor - 轉換執行
 *   - ./field-mapping-engine - 映射引擎
 *   - ./mapping-cache - 配置快取
 */

import type {
  IDynamicMappingService,
  ExtractedFieldValue,
  MappingContext,
  MappingResult,
  ConfigScope,
  ResolvedConfig,
  CacheKey,
} from '@/types/field-mapping';
import { ConfigResolver, configResolver } from './config-resolver';
import { TransformExecutor, transformExecutor } from './transform-executor';
import { FieldMappingEngine, fieldMappingEngine } from './field-mapping-engine';
import { MappingCache, mappingCache, CacheStats } from './mapping-cache';

// ============================================================================
// DynamicMappingService 實現
// ============================================================================

/**
 * 動態欄位映射服務
 * @description
 *   主服務入口，整合所有映射相關組件，提供統一的映射介面。
 *   支援配置快取、三層優先級配置解析、五種轉換類型。
 */
export class DynamicMappingService implements IDynamicMappingService {
  private readonly configResolver: ConfigResolver;
  private readonly transformExecutor: TransformExecutor;
  private readonly fieldMappingEngine: FieldMappingEngine;
  private readonly cache: MappingCache;

  constructor(options?: {
    configResolver?: ConfigResolver;
    transformExecutor?: TransformExecutor;
    fieldMappingEngine?: FieldMappingEngine;
    cache?: MappingCache;
  }) {
    this.configResolver = options?.configResolver ?? configResolver;
    this.transformExecutor = options?.transformExecutor ?? transformExecutor;
    this.fieldMappingEngine = options?.fieldMappingEngine ?? fieldMappingEngine;
    this.cache = options?.cache ?? mappingCache;
  }

  // ==========================================================================
  // IDynamicMappingService 實現
  // ==========================================================================

  /**
   * 執行欄位映射
   * @description
   *   根據上下文解析配置，套用映射規則到提取欄位，返回映射結果。
   *   支援快取以提高效能。
   *
   * @param extractedFields 提取的欄位列表
   * @param context 映射上下文（包含 companyId、documentFormatId 等）
   * @returns 映射結果，包含映射後的欄位、未映射欄位、執行統計
   */
  async mapFields(
    extractedFields: ExtractedFieldValue[],
    context: MappingContext
  ): Promise<MappingResult> {
    const startTime = Date.now();

    try {
      // 1. 驗證輸入
      if (!extractedFields || extractedFields.length === 0) {
        return this.createEmptyResult(startTime, '沒有提取的欄位需要映射');
      }

      // 2. 解析配置（使用快取）
      const configs = await this.resolveConfigsWithCache(context);

      if (configs.length === 0) {
        return this.createEmptyResult(startTime, '沒有可用的映射配置', extractedFields);
      }

      // 3. 套用映射規則
      const mappedFields = this.fieldMappingEngine.applyRules(extractedFields, configs);

      // 4. 取得未映射欄位
      const unmappedFields = this.fieldMappingEngine.getUnmappedFields(
        extractedFields,
        mappedFields
      );

      // 5. 計算統計
      const rulesApplied = mappedFields.filter((f) => f.success).length;

      return {
        success: true,
        mappedFields,
        unmappedFields,
        executionTimeMs: Date.now() - startTime,
        configsUsed: configs.length,
        rulesApplied,
      };
    } catch (error) {
      console.error('[DynamicMappingService] Error mapping fields:', error);

      return {
        success: false,
        mappedFields: [],
        unmappedFields: extractedFields.map((f) => f.fieldName),
        error: error instanceof Error ? error.message : '映射過程發生錯誤',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 使特定範圍的快取失效
   * @description
   *   當配置被更新時，應呼叫此方法使相關快取失效。
   *   例如：更新公司配置後，使該公司的所有快取失效。
   *
   * @param scope 配置範圍（GLOBAL、COMPANY、FORMAT）
   * @param id 相關 ID（companyId 或 documentFormatId）
   */
  invalidateCache(scope: ConfigScope, id?: string): void {
    this.cache.invalidate(scope, id);
    console.log(
      `[DynamicMappingService] Cache invalidated: scope=${scope}, id=${id ?? 'all'}`
    );
  }

  /**
   * 清空所有快取
   * @description
   *   清空所有映射配置快取。
   *   通常在系統重啟或大規模配置變更時使用。
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[DynamicMappingService] All cache cleared');
  }

  // ==========================================================================
  // 擴展方法
  // ==========================================================================

  /**
   * 取得快取統計
   * @returns 快取統計資訊
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * 取得快取命中率
   * @returns 命中率（0-1）
   */
  getCacheHitRate(): number {
    return this.cache.getHitRate();
  }

  /**
   * 重設快取統計
   */
  resetCacheStats(): void {
    this.cache.resetStats();
  }

  /**
   * 預載配置到快取
   * @description
   *   預先載入指定上下文的配置到快取，以提高後續映射效能。
   *
   * @param context 映射上下文
   */
  async preloadConfigs(context: MappingContext): Promise<void> {
    try {
      await this.resolveConfigsWithCache({
        ...context,
        forceRefresh: true,
      });
      console.log('[DynamicMappingService] Configs preloaded for context:', context);
    } catch (error) {
      console.error('[DynamicMappingService] Failed to preload configs:', error);
    }
  }

  /**
   * 驗證映射規則
   * @description
   *   在套用映射前驗證規則的有效性。
   *
   * @param context 映射上下文
   * @returns 驗證結果
   */
  async validateConfigs(
    context: MappingContext
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const configs = await this.resolveConfigsWithCache(context);

      for (const config of configs) {
        for (const rule of config.rules) {
          // 驗證轉換參數
          const validation = TransformExecutor.validateParams(
            rule.transformType,
            rule.transformParams
          );
          if (!validation.valid) {
            errors.push(
              `Config "${config.name}" - Rule "${rule.id}": ${validation.error}`
            );
          }

          // 驗證來源欄位
          if (!rule.sourceFields || rule.sourceFields.length === 0) {
            errors.push(
              `Config "${config.name}" - Rule "${rule.id}": 缺少來源欄位`
            );
          }

          // 驗證目標欄位
          if (!rule.targetField) {
            errors.push(
              `Config "${config.name}" - Rule "${rule.id}": 缺少目標欄位`
            );
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : '驗證過程發生錯誤'],
      };
    }
  }

  /**
   * 釋放資源
   * @description
   *   清理服務使用的資源，包括停止快取清理計時器。
   */
  dispose(): void {
    this.cache.dispose();
    console.log('[DynamicMappingService] Service disposed');
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 解析配置（使用快取）
   */
  private async resolveConfigsWithCache(
    context: MappingContext
  ): Promise<ResolvedConfig[]> {
    const configs: ResolvedConfig[] = [];
    const enableCache = context.enableCache !== false;
    const forceRefresh = context.forceRefresh === true;

    // 1. 嘗試從快取獲取 FORMAT 配置
    if (context.documentFormatId) {
      const formatConfig = await this.getConfigWithCache(
        {
          type: 'config',
          scope: 'FORMAT',
          documentFormatId: context.documentFormatId,
        },
        () => this.configResolver.fetchFormatConfig(context.documentFormatId!),
        enableCache && !forceRefresh
      );
      if (formatConfig) {
        configs.push(formatConfig);
      }
    }

    // 2. 嘗試從快取獲取 COMPANY 配置
    if (context.companyId) {
      const companyConfig = await this.getConfigWithCache(
        {
          type: 'config',
          scope: 'COMPANY',
          companyId: context.companyId,
        },
        () => this.configResolver.fetchCompanyConfig(context.companyId!),
        enableCache && !forceRefresh
      );
      if (companyConfig) {
        configs.push(companyConfig);
      }
    }

    // 3. 嘗試從快取獲取 GLOBAL 配置
    const globalConfig = await this.getConfigWithCache(
      {
        type: 'config',
        scope: 'GLOBAL',
      },
      () => this.configResolver.fetchGlobalConfig(),
      enableCache && !forceRefresh
    );
    if (globalConfig) {
      configs.push(globalConfig);
    }

    return configs;
  }

  /**
   * 從快取獲取配置（或從資料庫獲取並快取）
   */
  private async getConfigWithCache(
    key: CacheKey,
    fetchFn: () => Promise<ResolvedConfig | null>,
    useCache: boolean
  ): Promise<ResolvedConfig | null> {
    // 嘗試從快取獲取
    if (useCache) {
      const cached = this.cache.get(key);
      if (cached) {
        return cached.config;
      }
    }

    // 從資料庫獲取
    const config = await fetchFn();

    // 快取結果（即使是 null）
    if (config && useCache) {
      this.cache.set(key, config);
    }

    return config;
  }

  /**
   * 建立空結果
   */
  private createEmptyResult(
    startTime: number,
    message?: string,
    extractedFields?: ExtractedFieldValue[]
  ): MappingResult {
    return {
      success: true,
      mappedFields: [],
      unmappedFields: extractedFields?.map((f) => f.fieldName) ?? [],
      error: message,
      executionTimeMs: Date.now() - startTime,
      configsUsed: 0,
      rulesApplied: 0,
    };
  }
}

// ============================================================================
// 導出
// ============================================================================

/**
 * DynamicMappingService 單例實例
 */
export const dynamicMappingService = new DynamicMappingService();
