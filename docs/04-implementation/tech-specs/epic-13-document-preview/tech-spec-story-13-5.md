# Tech Spec: Story 13.5 - 動態欄位映射服務整合

## 概覽

| 項目 | 內容 |
|------|------|
| **Story ID** | 13.5 |
| **Story 名稱** | 動態欄位映射服務整合 |
| **Epic** | Epic 13 - 文件預覽與欄位映射 |
| **優先級** | High |
| **估計點數** | 8 |
| **依賴** | Story 13.4 (映射配置 API) |

---

## 目標

在文件處理流程中動態應用欄位映射配置，根據文件的 Company 和 DocumentFormat 自動選擇適當的映射策略，並按優先級（Format > Company > Global）執行轉換。

---

## Acceptance Criteria 對應

| AC | 描述 | 實現方式 |
|----|------|----------|
| AC1 | 根據 Company/DocumentFormat 獲取適用配置 | ConfigResolver.resolveConfig() |
| AC2 | 按優先級解析配置 (Format > Company > Global) | 三層配置合併策略 |
| AC3 | 按規則順序執行映射 | FieldMappingEngine.applyRules() |
| AC4 | 支援各種轉換類型 | TransformExecutor 策略模式 |
| AC5 | 結果緩存機制 | MappingCache 服務 |
| AC6 | 處理流水線整合 | DynamicMappingService 中間件 |

---

## 實現指南

### Phase 1: 類型定義與介面設計

**檔案**: `src/types/field-mapping.ts`

```typescript
/**
 * @fileoverview 欄位映射服務類型定義
 * @module src/types/field-mapping
 * @since Epic 13 - Story 13.5
 */

import type { TransformType, ConfigScope } from './mapping-config';

// ============================================================================
// 輸入/輸出類型
// ============================================================================

/**
 * 欄位提取結果（來自 Azure DI 或 GPT Vision）
 */
export interface ExtractedFieldValue {
  fieldName: string;
  value: string | number | null;
  confidence: number;
  source: 'AZURE_DI' | 'GPT_VISION' | 'MANUAL';
  boundingBox?: BoundingBox;
}

/**
 * 映射後的欄位結果
 */
export interface MappedFieldValue {
  targetField: string;
  value: string | number | null;
  confidence: number;
  sourceFields: string[];
  transformType: TransformType;
  appliedRuleId: string;
  appliedConfigId: string;
  appliedConfigScope: ConfigScope;
}

/**
 * 映射執行上下文
 */
export interface MappingContext {
  documentId: string;
  companyId: string | null;
  documentFormatId: string | null;
  extractedFields: ExtractedFieldValue[];
  metadata?: Record<string, unknown>;
}

/**
 * 映射執行結果
 */
export interface MappingResult {
  documentId: string;
  mappedFields: MappedFieldValue[];
  unmappedFields: string[];
  appliedConfigs: AppliedConfigInfo[];
  executionTimeMs: number;
  cached: boolean;
}

/**
 * 已應用配置資訊
 */
export interface AppliedConfigInfo {
  configId: string;
  scope: ConfigScope;
  name: string;
  rulesApplied: number;
}

// ============================================================================
// 轉換參數類型
// ============================================================================

export interface DirectTransformParams {
  type: 'DIRECT';
}

export interface ConcatTransformParams {
  type: 'CONCAT';
  separator: string;
  order: string[]; // 欄位順序
}

export interface SplitTransformParams {
  type: 'SPLIT';
  delimiter: string;
  index: number; // 取第幾個部分 (0-based)
}

export interface LookupTransformParams {
  type: 'LOOKUP';
  lookupTable: Record<string, string>;
  defaultValue?: string;
  caseSensitive?: boolean;
}

export interface CustomTransformParams {
  type: 'CUSTOM';
  expression: string; // 簡單表達式，如 "{{field1}} - {{field2}}"
}

export type TransformParams =
  | DirectTransformParams
  | ConcatTransformParams
  | SplitTransformParams
  | LookupTransformParams
  | CustomTransformParams;

// ============================================================================
// 緩存類型
// ============================================================================

export interface CacheKey {
  companyId: string | null;
  documentFormatId: string | null;
}

export interface CachedConfig {
  config: ResolvedConfig;
  cachedAt: Date;
  expiresAt: Date;
}

export interface ResolvedConfig {
  effectiveRules: EffectiveRule[];
  appliedConfigs: AppliedConfigInfo[];
}

export interface EffectiveRule {
  ruleId: string;
  configId: string;
  configScope: ConfigScope;
  sourceFields: string[];
  targetField: string;
  transformType: TransformType;
  transformParams: TransformParams;
  priority: number;
}
```

---

### Phase 2: 配置解析器實現

**檔案**: `src/services/mapping/config-resolver.ts`

```typescript
/**
 * @fileoverview 欄位映射配置解析器 - 負責三層配置合併
 * @module src/services/mapping/config-resolver
 * @since Epic 13 - Story 13.5
 *
 * @description
 *   實現三層優先級配置解析：
 *   1. Format Level (最高優先級) - 特定 DocumentFormat 的配置
 *   2. Company Level (中優先級) - 特定 Company 的配置
 *   3. Global Level (最低優先級) - 全局預設配置
 *
 *   規則合併策略：
 *   - 相同 targetField 的規則，高優先級覆蓋低優先級
 *   - 不同 targetField 的規則全部保留
 *   - 同一配置內規則按 priority 排序執行
 */

import { prisma } from '@/lib/prisma';
import type {
  ResolvedConfig,
  EffectiveRule,
  AppliedConfigInfo,
  CacheKey,
  TransformParams,
} from '@/types/field-mapping';
import { MappingCache } from './mapping-cache';

export class ConfigResolver {
  private cache: MappingCache;

  constructor() {
    this.cache = new MappingCache();
  }

  /**
   * 解析適用於指定上下文的欄位映射配置
   *
   * @param companyId - 公司 ID
   * @param documentFormatId - 文件格式 ID
   * @returns 解析後的有效配置
   */
  async resolveConfig(
    companyId: string | null,
    documentFormatId: string | null
  ): Promise<ResolvedConfig> {
    const cacheKey: CacheKey = { companyId, documentFormatId };

    // 1. 嘗試從緩存獲取
    const cached = this.cache.getConfig(cacheKey);
    if (cached) {
      return cached.config;
    }

    // 2. 從資料庫獲取三層配置
    const [globalConfig, companyConfig, formatConfig] = await Promise.all([
      this.fetchGlobalConfig(),
      companyId ? this.fetchCompanyConfig(companyId) : null,
      documentFormatId ? this.fetchFormatConfig(documentFormatId) : null,
    ]);

    // 3. 合併配置
    const resolved = this.mergeConfigs(globalConfig, companyConfig, formatConfig);

    // 4. 緩存結果
    this.cache.setConfig(cacheKey, resolved);

    return resolved;
  }

  /**
   * 獲取全局配置
   */
  private async fetchGlobalConfig() {
    return prisma.fieldMappingConfig.findFirst({
      where: {
        scope: 'GLOBAL',
        isActive: true,
        companyId: null,
        documentFormatId: null,
      },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { priority: 'asc' },
        },
      },
    });
  }

  /**
   * 獲取公司級配置
   */
  private async fetchCompanyConfig(companyId: string) {
    return prisma.fieldMappingConfig.findFirst({
      where: {
        scope: 'COMPANY',
        companyId,
        isActive: true,
      },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { priority: 'asc' },
        },
      },
    });
  }

  /**
   * 獲取格式級配置
   */
  private async fetchFormatConfig(documentFormatId: string) {
    return prisma.fieldMappingConfig.findFirst({
      where: {
        scope: 'FORMAT',
        documentFormatId,
        isActive: true,
      },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { priority: 'asc' },
        },
      },
    });
  }

  /**
   * 合併三層配置，高優先級覆蓋低優先級
   */
  private mergeConfigs(
    globalConfig: ConfigWithRules | null,
    companyConfig: ConfigWithRules | null,
    formatConfig: ConfigWithRules | null
  ): ResolvedConfig {
    const effectiveRules: EffectiveRule[] = [];
    const appliedConfigs: AppliedConfigInfo[] = [];
    const targetFieldMap = new Map<string, EffectiveRule>();

    // 按優先級順序處理：Global → Company → Format
    const configsToProcess = [
      { config: globalConfig, scope: 'GLOBAL' as const },
      { config: companyConfig, scope: 'COMPANY' as const },
      { config: formatConfig, scope: 'FORMAT' as const },
    ];

    for (const { config, scope } of configsToProcess) {
      if (!config) continue;

      let rulesApplied = 0;

      for (const rule of config.rules) {
        const effectiveRule: EffectiveRule = {
          ruleId: rule.id,
          configId: config.id,
          configScope: scope,
          sourceFields: rule.sourceFields as string[],
          targetField: rule.targetField,
          transformType: rule.transformType as TransformType,
          transformParams: rule.transformParams as TransformParams,
          priority: rule.priority,
        };

        // 高優先級覆蓋低優先級（相同 targetField）
        targetFieldMap.set(rule.targetField, effectiveRule);
        rulesApplied++;
      }

      if (rulesApplied > 0) {
        appliedConfigs.push({
          configId: config.id,
          scope,
          name: config.name,
          rulesApplied,
        });
      }
    }

    // 按 priority 排序最終規則列表
    effectiveRules.push(...targetFieldMap.values());
    effectiveRules.sort((a, b) => a.priority - b.priority);

    return { effectiveRules, appliedConfigs };
  }

  /**
   * 清除指定上下文的緩存
   */
  invalidateCache(cacheKey: CacheKey): void {
    this.cache.invalidate(cacheKey);
  }

  /**
   * 清除所有緩存
   */
  clearAllCache(): void {
    this.cache.clear();
  }
}

type ConfigWithRules = NonNullable<Awaited<ReturnType<ConfigResolver['fetchGlobalConfig']>>>;
```

---

### Phase 3: 轉換執行器實現

**檔案**: `src/services/mapping/transform-executor.ts`

```typescript
/**
 * @fileoverview 欄位轉換執行器 - 策略模式實現各種轉換類型
 * @module src/services/mapping/transform-executor
 * @since Epic 13 - Story 13.5
 */

import type {
  ExtractedFieldValue,
  TransformParams,
  DirectTransformParams,
  ConcatTransformParams,
  SplitTransformParams,
  LookupTransformParams,
  CustomTransformParams,
} from '@/types/field-mapping';

/**
 * 轉換策略介面
 */
interface TransformStrategy {
  execute(
    sourceValues: Map<string, ExtractedFieldValue>,
    sourceFields: string[],
    params: TransformParams
  ): { value: string | number | null; confidence: number };
}

/**
 * 直接映射策略
 */
class DirectTransformStrategy implements TransformStrategy {
  execute(
    sourceValues: Map<string, ExtractedFieldValue>,
    sourceFields: string[],
    _params: DirectTransformParams
  ) {
    const sourceField = sourceFields[0];
    const source = sourceValues.get(sourceField);

    if (!source) {
      return { value: null, confidence: 0 };
    }

    return { value: source.value, confidence: source.confidence };
  }
}

/**
 * 串接策略
 */
class ConcatTransformStrategy implements TransformStrategy {
  execute(
    sourceValues: Map<string, ExtractedFieldValue>,
    sourceFields: string[],
    params: ConcatTransformParams
  ) {
    const orderedFields = params.order.length > 0 ? params.order : sourceFields;
    const values: string[] = [];
    let totalConfidence = 0;
    let fieldCount = 0;

    for (const fieldName of orderedFields) {
      const source = sourceValues.get(fieldName);
      if (source && source.value !== null) {
        values.push(String(source.value));
        totalConfidence += source.confidence;
        fieldCount++;
      }
    }

    if (values.length === 0) {
      return { value: null, confidence: 0 };
    }

    return {
      value: values.join(params.separator),
      confidence: fieldCount > 0 ? totalConfidence / fieldCount : 0,
    };
  }
}

/**
 * 拆分策略
 */
class SplitTransformStrategy implements TransformStrategy {
  execute(
    sourceValues: Map<string, ExtractedFieldValue>,
    sourceFields: string[],
    params: SplitTransformParams
  ) {
    const sourceField = sourceFields[0];
    const source = sourceValues.get(sourceField);

    if (!source || source.value === null) {
      return { value: null, confidence: 0 };
    }

    const parts = String(source.value).split(params.delimiter);
    const targetPart = parts[params.index];

    if (targetPart === undefined) {
      return { value: null, confidence: 0 };
    }

    return { value: targetPart.trim(), confidence: source.confidence };
  }
}

/**
 * 查表策略
 */
class LookupTransformStrategy implements TransformStrategy {
  execute(
    sourceValues: Map<string, ExtractedFieldValue>,
    sourceFields: string[],
    params: LookupTransformParams
  ) {
    const sourceField = sourceFields[0];
    const source = sourceValues.get(sourceField);

    if (!source || source.value === null) {
      return { value: params.defaultValue ?? null, confidence: 0 };
    }

    const lookupKey = params.caseSensitive
      ? String(source.value)
      : String(source.value).toLowerCase();

    const lookupTable = params.caseSensitive
      ? params.lookupTable
      : Object.fromEntries(
          Object.entries(params.lookupTable).map(([k, v]) => [k.toLowerCase(), v])
        );

    const mappedValue = lookupTable[lookupKey];

    if (mappedValue !== undefined) {
      return { value: mappedValue, confidence: source.confidence };
    }

    return { value: params.defaultValue ?? null, confidence: 0.5 };
  }
}

/**
 * 自定義表達式策略
 */
class CustomTransformStrategy implements TransformStrategy {
  execute(
    sourceValues: Map<string, ExtractedFieldValue>,
    sourceFields: string[],
    params: CustomTransformParams
  ) {
    let result = params.expression;
    let totalConfidence = 0;
    let fieldCount = 0;

    // 替換 {{fieldName}} 佔位符
    for (const fieldName of sourceFields) {
      const source = sourceValues.get(fieldName);
      const placeholder = `{{${fieldName}}}`;

      if (source && source.value !== null) {
        result = result.replace(new RegExp(placeholder, 'g'), String(source.value));
        totalConfidence += source.confidence;
        fieldCount++;
      } else {
        result = result.replace(new RegExp(placeholder, 'g'), '');
      }
    }

    return {
      value: result.trim(),
      confidence: fieldCount > 0 ? totalConfidence / fieldCount : 0,
    };
  }
}

/**
 * 轉換執行器 - 統一入口
 */
export class TransformExecutor {
  private strategies: Map<string, TransformStrategy>;

  constructor() {
    this.strategies = new Map([
      ['DIRECT', new DirectTransformStrategy()],
      ['CONCAT', new ConcatTransformStrategy()],
      ['SPLIT', new SplitTransformStrategy()],
      ['LOOKUP', new LookupTransformStrategy()],
      ['CUSTOM', new CustomTransformStrategy()],
    ]);
  }

  /**
   * 執行欄位轉換
   */
  execute(
    sourceValues: Map<string, ExtractedFieldValue>,
    sourceFields: string[],
    transformType: string,
    transformParams: TransformParams
  ): { value: string | number | null; confidence: number } {
    const strategy = this.strategies.get(transformType);

    if (!strategy) {
      console.warn(`Unknown transform type: ${transformType}, falling back to DIRECT`);
      return this.strategies.get('DIRECT')!.execute(
        sourceValues,
        sourceFields,
        { type: 'DIRECT' }
      );
    }

    return strategy.execute(sourceValues, sourceFields, transformParams);
  }
}
```

---

### Phase 4: 映射引擎實現

**檔案**: `src/services/mapping/field-mapping-engine.ts`

```typescript
/**
 * @fileoverview 欄位映射引擎 - 執行映射規則
 * @module src/services/mapping/field-mapping-engine
 * @since Epic 13 - Story 13.5
 */

import type {
  ExtractedFieldValue,
  MappedFieldValue,
  EffectiveRule,
  ResolvedConfig,
} from '@/types/field-mapping';
import { TransformExecutor } from './transform-executor';

export class FieldMappingEngine {
  private transformExecutor: TransformExecutor;

  constructor() {
    this.transformExecutor = new TransformExecutor();
  }

  /**
   * 執行欄位映射
   *
   * @param extractedFields - 提取的欄位列表
   * @param config - 解析後的配置
   * @returns 映射結果和未映射欄位
   */
  applyRules(
    extractedFields: ExtractedFieldValue[],
    config: ResolvedConfig
  ): { mappedFields: MappedFieldValue[]; unmappedFields: string[] } {
    // 建立欄位查找表
    const sourceValuesMap = new Map<string, ExtractedFieldValue>();
    for (const field of extractedFields) {
      sourceValuesMap.set(field.fieldName, field);
    }

    const mappedFields: MappedFieldValue[] = [];
    const mappedSourceFields = new Set<string>();

    // 按優先級順序執行規則
    for (const rule of config.effectiveRules) {
      // 檢查所有來源欄位是否存在
      const hasAllSourceFields = rule.sourceFields.every(
        (sf) => sourceValuesMap.has(sf)
      );

      if (!hasAllSourceFields) {
        continue; // 跳過缺少來源欄位的規則
      }

      // 執行轉換
      const { value, confidence } = this.transformExecutor.execute(
        sourceValuesMap,
        rule.sourceFields,
        rule.transformType,
        rule.transformParams
      );

      // 記錄映射結果
      mappedFields.push({
        targetField: rule.targetField,
        value,
        confidence,
        sourceFields: rule.sourceFields,
        transformType: rule.transformType,
        appliedRuleId: rule.ruleId,
        appliedConfigId: rule.configId,
        appliedConfigScope: rule.configScope,
      });

      // 標記已使用的來源欄位
      for (const sf of rule.sourceFields) {
        mappedSourceFields.add(sf);
      }
    }

    // 找出未映射的欄位
    const unmappedFields = extractedFields
      .map((f) => f.fieldName)
      .filter((fn) => !mappedSourceFields.has(fn));

    return { mappedFields, unmappedFields };
  }
}
```

---

### Phase 5: 緩存服務實現

**檔案**: `src/services/mapping/mapping-cache.ts`

```typescript
/**
 * @fileoverview 映射配置緩存服務
 * @module src/services/mapping/mapping-cache
 * @since Epic 13 - Story 13.5
 */

import type { CacheKey, CachedConfig, ResolvedConfig } from '@/types/field-mapping';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 分鐘

export class MappingCache {
  private cache: Map<string, CachedConfig>;
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  /**
   * 生成緩存鍵
   */
  private generateKey(cacheKey: CacheKey): string {
    return `${cacheKey.companyId || 'null'}:${cacheKey.documentFormatId || 'null'}`;
  }

  /**
   * 獲取緩存的配置
   */
  getConfig(cacheKey: CacheKey): CachedConfig | null {
    const key = this.generateKey(cacheKey);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // 檢查是否過期
    if (new Date() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * 設置緩存
   */
  setConfig(cacheKey: CacheKey, config: ResolvedConfig): void {
    const key = this.generateKey(cacheKey);
    const now = new Date();

    this.cache.set(key, {
      config,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
    });
  }

  /**
   * 使特定緩存失效
   */
  invalidate(cacheKey: CacheKey): void {
    const key = this.generateKey(cacheKey);
    this.cache.delete(key);
  }

  /**
   * 清除所有緩存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 獲取緩存統計
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
```

---

### Phase 6: 動態映射服務實現

**檔案**: `src/services/mapping/dynamic-mapping.service.ts`

```typescript
/**
 * @fileoverview 動態映射服務 - 統一入口，整合到處理流水線
 * @module src/services/mapping/dynamic-mapping.service
 * @since Epic 13 - Story 13.5
 *
 * @description
 *   提供統一的欄位映射服務入口，整合：
 *   - ConfigResolver: 配置解析
 *   - FieldMappingEngine: 規則執行
 *   - MappingCache: 結果緩存
 *
 * @dependencies
 *   - ConfigResolver - 三層配置解析
 *   - FieldMappingEngine - 映射規則執行
 *   - MappingCache - 緩存服務
 */

import type {
  MappingContext,
  MappingResult,
  ExtractedFieldValue,
} from '@/types/field-mapping';
import { ConfigResolver } from './config-resolver';
import { FieldMappingEngine } from './field-mapping-engine';

export class DynamicMappingService {
  private configResolver: ConfigResolver;
  private mappingEngine: FieldMappingEngine;

  constructor() {
    this.configResolver = new ConfigResolver();
    this.mappingEngine = new FieldMappingEngine();
  }

  /**
   * 執行動態欄位映射
   *
   * @param context - 映射上下文（包含文件資訊和提取欄位）
   * @returns 映射結果
   */
  async executeMapping(context: MappingContext): Promise<MappingResult> {
    const startTime = performance.now();

    // 1. 解析適用的配置
    const resolvedConfig = await this.configResolver.resolveConfig(
      context.companyId,
      context.documentFormatId
    );

    // 2. 執行映射
    const { mappedFields, unmappedFields } = this.mappingEngine.applyRules(
      context.extractedFields,
      resolvedConfig
    );

    const executionTimeMs = performance.now() - startTime;

    // 3. 返回結果
    return {
      documentId: context.documentId,
      mappedFields,
      unmappedFields,
      appliedConfigs: resolvedConfig.appliedConfigs,
      executionTimeMs,
      cached: false, // 可由調用方判斷是否來自緩存
    };
  }

  /**
   * 批量執行映射（用於批次處理）
   */
  async executeBatchMapping(
    contexts: MappingContext[]
  ): Promise<MappingResult[]> {
    return Promise.all(contexts.map((ctx) => this.executeMapping(ctx)));
  }

  /**
   * 預覽映射結果（不保存，用於 UI 預覽）
   */
  async previewMapping(
    extractedFields: ExtractedFieldValue[],
    companyId: string | null,
    documentFormatId: string | null
  ): Promise<{
    mappedFields: MappingResult['mappedFields'];
    unmappedFields: string[];
    appliedConfigs: MappingResult['appliedConfigs'];
  }> {
    const resolvedConfig = await this.configResolver.resolveConfig(
      companyId,
      documentFormatId
    );

    const { mappedFields, unmappedFields } = this.mappingEngine.applyRules(
      extractedFields,
      resolvedConfig
    );

    return {
      mappedFields,
      unmappedFields,
      appliedConfigs: resolvedConfig.appliedConfigs,
    };
  }

  /**
   * 使配置緩存失效
   */
  invalidateConfigCache(
    companyId: string | null,
    documentFormatId: string | null
  ): void {
    this.configResolver.invalidateCache({ companyId, documentFormatId });
  }

  /**
   * 清除所有緩存
   */
  clearAllCaches(): void {
    this.configResolver.clearAllCache();
  }
}

// 單例導出
export const dynamicMappingService = new DynamicMappingService();
```

---

### Phase 7: 處理流水線整合

**檔案**: `src/services/document-processing/mapping-pipeline-step.ts`

```typescript
/**
 * @fileoverview 映射流水線步驟 - 將動態映射整合到文件處理流程
 * @module src/services/document-processing/mapping-pipeline-step
 * @since Epic 13 - Story 13.5
 */

import type { ProcessingContext, PipelineStep } from '@/types/processing-pipeline';
import { dynamicMappingService } from '@/services/mapping/dynamic-mapping.service';
import type { ExtractedFieldValue } from '@/types/field-mapping';

export class MappingPipelineStep implements PipelineStep {
  name = 'DynamicFieldMapping';

  async execute(context: ProcessingContext): Promise<ProcessingContext> {
    // 1. 從上下文獲取提取結果
    const extractedFields = this.extractFieldsFromContext(context);

    if (extractedFields.length === 0) {
      console.log(`[MappingPipelineStep] No extracted fields for document ${context.documentId}`);
      return context;
    }

    // 2. 執行動態映射
    const mappingResult = await dynamicMappingService.executeMapping({
      documentId: context.documentId,
      companyId: context.companyId ?? null,
      documentFormatId: context.documentFormatId ?? null,
      extractedFields,
    });

    // 3. 將映射結果存入上下文
    return {
      ...context,
      mappingResult,
      mappedFields: mappingResult.mappedFields,
      unmappedFields: mappingResult.unmappedFields,
      processingMetrics: {
        ...context.processingMetrics,
        mappingTimeMs: mappingResult.executionTimeMs,
        appliedConfigsCount: mappingResult.appliedConfigs.length,
      },
    };
  }

  /**
   * 從處理上下文提取欄位資料
   */
  private extractFieldsFromContext(context: ProcessingContext): ExtractedFieldValue[] {
    const fields: ExtractedFieldValue[] = [];

    // 從 Azure DI 結果提取
    if (context.azureDiResult?.extractedData) {
      for (const [fieldName, fieldData] of Object.entries(context.azureDiResult.extractedData)) {
        fields.push({
          fieldName,
          value: fieldData.value,
          confidence: fieldData.confidence,
          source: 'AZURE_DI',
          boundingBox: fieldData.boundingBox,
        });
      }
    }

    // 從 GPT Vision 結果提取
    if (context.gptVisionResult?.extractedFields) {
      for (const field of context.gptVisionResult.extractedFields) {
        // 避免重複（GPT Vision 結果可能覆蓋 Azure DI）
        const existingIndex = fields.findIndex(f => f.fieldName === field.fieldName);
        if (existingIndex >= 0) {
          // 保留信心度較高的
          if (field.confidence > fields[existingIndex].confidence) {
            fields[existingIndex] = {
              ...field,
              source: 'GPT_VISION',
            };
          }
        } else {
          fields.push({
            ...field,
            source: 'GPT_VISION',
          });
        }
      }
    }

    return fields;
  }
}
```

---

### Phase 8: 模組導出

**檔案**: `src/services/mapping/index.ts`

```typescript
/**
 * @fileoverview 欄位映射服務模組導出
 * @module src/services/mapping
 * @since Epic 13 - Story 13.5
 */

// 核心服務
export { ConfigResolver } from './config-resolver';
export { FieldMappingEngine } from './field-mapping-engine';
export { TransformExecutor } from './transform-executor';
export { MappingCache } from './mapping-cache';
export { DynamicMappingService, dynamicMappingService } from './dynamic-mapping.service';

// 類型導出
export type {
  ExtractedFieldValue,
  MappedFieldValue,
  MappingContext,
  MappingResult,
  AppliedConfigInfo,
  TransformParams,
  DirectTransformParams,
  ConcatTransformParams,
  SplitTransformParams,
  LookupTransformParams,
  CustomTransformParams,
  CacheKey,
  CachedConfig,
  ResolvedConfig,
  EffectiveRule,
} from '@/types/field-mapping';
```

---

## 項目結構

```
src/
├── types/
│   └── field-mapping.ts              # 類型定義
├── services/
│   ├── mapping/
│   │   ├── index.ts                  # 模組導出
│   │   ├── config-resolver.ts        # 配置解析器
│   │   ├── field-mapping-engine.ts   # 映射引擎
│   │   ├── transform-executor.ts     # 轉換執行器
│   │   ├── mapping-cache.ts          # 緩存服務
│   │   └── dynamic-mapping.service.ts # 統一入口
│   └── document-processing/
│       └── mapping-pipeline-step.ts  # 流水線整合
└── tests/
    └── unit/
        └── services/
            └── mapping/
                ├── config-resolver.test.ts
                ├── field-mapping-engine.test.ts
                ├── transform-executor.test.ts
                └── dynamic-mapping.service.test.ts
```

---

## API 端點（可選擴展）

| 方法 | 端點 | 描述 |
|------|------|------|
| POST | `/api/v1/mapping/execute` | 執行欄位映射 |
| POST | `/api/v1/mapping/preview` | 預覽映射結果 |
| POST | `/api/v1/mapping/batch` | 批量執行映射 |
| POST | `/api/v1/mapping/cache/invalidate` | 使緩存失效 |

---

## 驗證清單

### 功能驗證
- [ ] ConfigResolver 正確解析三層配置
- [ ] 優先級順序正確：Format > Company > Global
- [ ] 所有轉換類型正確執行
- [ ] 緩存正確運作和過期
- [ ] 流水線整合正確執行

### 效能驗證
- [ ] 映射執行時間 < 50ms/文件
- [ ] 緩存命中率 > 90%（相同配置）
- [ ] 批量處理正確並行

### 測試覆蓋
- [ ] 單元測試覆蓋率 > 80%
- [ ] 整合測試覆蓋主要流程
- [ ] 邊界條件測試（空欄位、無規則等）

---

## 依賴關係

### 內部依賴
- Story 13.4: FieldMappingConfig, FieldMappingRule Prisma 模型

### 外部依賴
- `@prisma/client`: 資料庫操作

---

## 風險與緩解

| 風險 | 影響 | 緩解策略 |
|------|------|----------|
| 配置解析效能 | 延遲增加 | 使用緩存機制 |
| 複雜轉換表達式 | 執行錯誤 | 限制表達式語法，提供驗證 |
| 緩存一致性 | 配置更新不即時 | 配置更新時主動失效緩存 |

---

*Tech Spec 建立日期: 2026-01-02*
*版本: 1.0.0*
