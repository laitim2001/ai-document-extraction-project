/**
 * @fileoverview Prompt 組裝服務 - V3 架構
 * @description
 *   從資料庫讀取配置並組裝完整的 GPT Prompt：
 *   - 載入已知公司列表
 *   - 載入文件格式模式
 *   - 載入術語映射規則
 *   - 動態組裝 System Prompt
 *   - 生成 JSON Schema
 *
 *   注意：此服務需要 Schema 更新才能完全運作，
 *   目前使用簡化實現返回預設值。
 *
 * @module src/services/extraction-v3/prompt-assembly
 * @since CHANGE-021 - Unified Processor V3 Refactoring
 * @lastModified 2026-01-30
 *
 * @features
 *   - 從 Prisma 載入配置（需 Schema 更新）
 *   - 公司/格式/映射規則整合
 *   - Token 使用估算
 *   - 快取支援（可選）
 *
 * @dependencies
 *   - @/lib/prisma - Prisma ORM
 *   - ./utils/prompt-builder - Prompt 構建工具
 *
 * @related
 *   - src/services/extraction-v3/extraction-v3.service.ts - V3 主服務
 *   - src/types/extraction-v3.types.ts - V3 類型定義
 */

import { prisma } from '@/lib/prisma';
import type {
  DynamicPromptConfig,
  AssembledPrompt,
  KnownCompanyForPrompt,
  FormatPatternForPrompt,
  FieldDefinition,
  IssuerIdentificationRulesConfig,
  FormatIdentificationRulesConfig,
  FieldExtractionRulesConfig,
  TermClassificationRulesConfig,
} from '@/types/extraction-v3.types';
import {
  buildFullSystemPrompt,
  buildUserPrompt,
  getDefaultStandardFields,
} from './utils/prompt-builder';

// ============================================================================
// Types
// ============================================================================

/**
 * Prompt 組裝選項
 */
export interface PromptAssemblyOptions {
  /** 城市代碼（用於篩選公司） */
  cityCode?: string;
  /** 已知公司 ID（如果已識別，載入其特定配置） */
  existingCompanyId?: string;
  /** 已知格式 ID（如果已識別，載入其特定配置） */
  existingFormatId?: string;
  /** 是否包含所有公司（預設 true） */
  includeAllCompanies?: boolean;
  /** 最大公司數量限制（避免 Token 過多） */
  maxCompanies?: number;
  /** 最大格式數量限制 */
  maxFormats?: number;
  /** 是否使用快取 */
  useCache?: boolean;
  /** 額外指示 */
  additionalInstructions?: string;
}

/**
 * 組裝結果
 */
export interface PromptAssemblyResult {
  /** 是否成功 */
  success: boolean;
  /** 組裝後的 Prompt */
  prompt?: AssembledPrompt;
  /** 動態配置（用於後續步驟） */
  config?: DynamicPromptConfig;
  /** 錯誤訊息 */
  error?: string;
  /** 處理時間（毫秒） */
  processingTimeMs: number;
}

/**
 * CHANGE-025: 階段 Prompt 配置
 */
export interface StagePromptConfig {
  /** System Prompt */
  systemPrompt: string;
  /** User Prompt 模板 */
  userPromptTemplate: string;
  /** 變數 */
  variables: Record<string, unknown> | null;
  /** 配置範圍 */
  scope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
  /** 版本號 */
  version: number;
}

// ============================================================================
// Constants
// ============================================================================

/** 預設配置 */
const DEFAULT_OPTIONS: Required<Omit<PromptAssemblyOptions, 'cityCode' | 'existingCompanyId' | 'existingFormatId' | 'additionalInstructions'>> = {
  includeAllCompanies: true,
  maxCompanies: 100,
  maxFormats: 50,
  useCache: true,
};

/** 快取存儲（簡易實現） */
const promptConfigCache = new Map<string, { config: DynamicPromptConfig; timestamp: number }>();

/** 快取有效期（毫秒） */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘

// ============================================================================
// Service Class
// ============================================================================

/**
 * Prompt 組裝服務
 *
 * @description 從資料庫載入配置並組裝完整的 GPT Prompt
 *
 * @example
 * ```typescript
 * const result = await PromptAssemblyService.assemblePrompt({
 *   cityCode: 'HKG',
 * });
 * if (result.success) {
 *   console.log(result.prompt.systemPrompt);
 * }
 * ```
 */
export class PromptAssemblyService {
  /**
   * 組裝完整的 Prompt
   *
   * @param options - 組裝選項
   * @param imageCount - 圖片數量（用於 User Prompt）
   * @returns 組裝結果
   */
  static async assemblePrompt(
    options: PromptAssemblyOptions = {},
    imageCount: number = 1
  ): Promise<PromptAssemblyResult> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    try {
      // 檢查快取
      const cacheKey = this.buildCacheKey(mergedOptions);
      if (mergedOptions.useCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          const { systemPrompt, schema, metadata } = buildFullSystemPrompt(cached);
          return {
            success: true,
            prompt: {
              systemPrompt,
              userPrompt: buildUserPrompt(imageCount, options.additionalInstructions),
              outputSchema: schema,
              metadata,
            },
            config: cached,
            processingTimeMs: Date.now() - startTime,
          };
        }
      }

      // 載入動態配置
      const config = await this.loadDynamicConfig(mergedOptions);

      // 構建 Prompt
      const { systemPrompt, schema, metadata } = buildFullSystemPrompt(config);
      const userPrompt = buildUserPrompt(imageCount, options.additionalInstructions);

      // 更新快取
      if (mergedOptions.useCache) {
        this.setCache(cacheKey, config);
      }

      return {
        success: true,
        prompt: {
          systemPrompt,
          userPrompt,
          outputSchema: schema,
          metadata,
        },
        config,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 載入動態配置
   *
   * @param options - 組裝選項
   * @returns 動態 Prompt 配置
   */
  static async loadDynamicConfig(
    options: PromptAssemblyOptions
  ): Promise<DynamicPromptConfig> {
    const [
      issuerIdentificationRules,
      formatIdentificationRules,
      fieldExtractionRules,
      termClassificationRules,
    ] = await Promise.all([
      this.loadIssuerIdentificationRules(options),
      this.loadFormatIdentificationRules(options),
      this.loadFieldExtractionRules(options),
      this.loadTermClassificationRules(options),
    ]);

    return {
      issuerIdentificationRules,
      formatIdentificationRules,
      fieldExtractionRules,
      termClassificationRules,
    };
  }

  /**
   * 載入公司識別規則
   *
   * @description
   *   目前使用簡化實現，從 Company 表載入基本資訊。
   *   完整功能需要 Schema 新增 aliases 和 identifiers 欄位。
   */
  private static async loadIssuerIdentificationRules(
    options: PromptAssemblyOptions
  ): Promise<IssuerIdentificationRulesConfig> {
    try {
      // 簡化版本：只載入公司基本資訊
      const companies = await prisma.company.findMany({
        where: {
          status: 'ACTIVE',
          ...(options.cityCode ? { cityCode: options.cityCode } : {}),
          ...(options.existingCompanyId ? { id: options.existingCompanyId } : {}),
        },
        take: options.maxCompanies || DEFAULT_OPTIONS.maxCompanies,
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      });

      const knownCompanies: KnownCompanyForPrompt[] = companies.map((c) => ({
        id: c.id,
        name: c.displayName || c.name,
        aliases: [], // TODO: 需要 Schema 更新
        identifiers: [], // TODO: 需要 Schema 更新
      }));

      return {
        knownCompanies,
        identificationMethods: ['LOGO', 'HEADER', 'ADDRESS', 'TAX_ID'],
      };
    } catch (error) {
      console.warn('[PromptAssembly] Failed to load companies:', error);
      return {
        knownCompanies: [],
        identificationMethods: ['LOGO', 'HEADER', 'ADDRESS', 'TAX_ID'],
      };
    }
  }

  /**
   * 載入格式識別規則
   *
   * @description
   *   目前使用簡化實現，從 DocumentFormat 表載入基本資訊。
   *   完整功能需要 Schema 新增 patterns 和 keywords 欄位。
   */
  private static async loadFormatIdentificationRules(
    options: PromptAssemblyOptions
  ): Promise<FormatIdentificationRulesConfig> {
    try {
      // 簡化版本：只載入格式基本資訊
      const formats = await prisma.documentFormat.findMany({
        where: {
          ...(options.existingCompanyId ? { companyId: options.existingCompanyId } : {}),
          ...(options.existingFormatId ? { id: options.existingFormatId } : {}),
        },
        take: options.maxFormats || DEFAULT_OPTIONS.maxFormats,
        select: {
          id: true,
          name: true,
          documentType: true,
        },
      });

      const formatPatterns: FormatPatternForPrompt[] = formats.map((f) => ({
        formatId: f.id,
        formatName: f.name || f.documentType || 'Unknown',
        patterns: [], // TODO: 需要 Schema 更新
        keywords: [], // TODO: 需要 Schema 更新
      }));

      return {
        formatPatterns,
      };
    } catch (error) {
      console.warn('[PromptAssembly] Failed to load formats:', error);
      return {
        formatPatterns: [],
      };
    }
  }

  /**
   * 載入欄位提取規則
   *
   * @description
   *   使用預設標準欄位定義。
   *   自定義欄位功能需要 CustomFieldConfig 表。
   */
  private static async loadFieldExtractionRules(
    _options: PromptAssemblyOptions
  ): Promise<FieldExtractionRulesConfig> {
    // 標準欄位使用預設定義
    const standardFields = getDefaultStandardFields();

    // 自定義欄位：需要 Schema 更新後實現
    const customFields: FieldDefinition[] = [];

    return {
      standardFields,
      customFields,
      extraChargesConfig: {
        enabled: true,
        categories: [
          'Freight',
          'Handling',
          'Documentation',
          'Insurance',
          'Customs',
          'Storage',
          'Surcharge',
          'Other',
        ],
      },
    };
  }

  /**
   * 載入術語分類規則
   *
   * @description
   *   目前返回空映射。
   *   完整功能需要 MappingRule 表的 tier, sourceTerm, targetCategory 欄位。
   */
  private static async loadTermClassificationRules(
    _options: PromptAssemblyOptions
  ): Promise<TermClassificationRulesConfig> {
    // TODO: 需要 Schema 更新以支援完整的術語映射功能
    // 目前返回空映射，GPT 將自行進行術語分類

    return {
      universalMappings: {},
      companyMappings: {},
      fallbackBehavior: 'MARK_UNCLASSIFIED',
    };
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * 構建快取鍵
   */
  private static buildCacheKey(options: PromptAssemblyOptions): string {
    return JSON.stringify({
      cityCode: options.cityCode,
      existingCompanyId: options.existingCompanyId,
      existingFormatId: options.existingFormatId,
      maxCompanies: options.maxCompanies,
      maxFormats: options.maxFormats,
    });
  }

  /**
   * 從快取獲取
   */
  private static getFromCache(key: string): DynamicPromptConfig | null {
    const cached = promptConfigCache.get(key);
    if (!cached) return null;

    // 檢查是否過期
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      promptConfigCache.delete(key);
      return null;
    }

    return cached.config;
  }

  /**
   * 設置快取
   */
  private static setCache(key: string, config: DynamicPromptConfig): void {
    promptConfigCache.set(key, {
      config,
      timestamp: Date.now(),
    });
  }

  /**
   * 清除快取
   */
  static clearCache(): void {
    promptConfigCache.clear();
  }

  /**
   * 獲取快取統計
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: promptConfigCache.size,
      keys: Array.from(promptConfigCache.keys()),
    };
  }

  // ==========================================================================
  // CHANGE-025: Stage 1/2 Prompt 配置載入方法
  // ==========================================================================

  /**
   * CHANGE-025: 載入 Stage 1 公司識別 Prompt 配置
   *
   * @description
   *   從 PromptConfig 表載入 STAGE_1_COMPANY_IDENTIFICATION 類型的提示配置。
   *   優先級：FORMAT > COMPANY > GLOBAL
   *
   * @param options - 載入選項
   * @returns Stage 1 Prompt 配置（或 null 使用預設）
   */
  static async loadStage1PromptConfig(options: {
    companyId?: string;
    formatId?: string;
  }): Promise<StagePromptConfig | null> {
    const { companyId, formatId } = options;

    try {
      // 按優先級查找配置：FORMAT > COMPANY > GLOBAL
      const configs = await prisma.promptConfig.findMany({
        where: {
          promptType: 'STAGE_1_COMPANY_IDENTIFICATION',
          isActive: true,
          OR: [
            // FORMAT scope（需要同時匹配 companyId 和 formatId）
            ...(formatId && companyId
              ? [{ scope: 'FORMAT' as const, companyId, documentFormatId: formatId }]
              : []),
            // COMPANY scope
            ...(companyId
              ? [{ scope: 'COMPANY' as const, companyId, documentFormatId: null }]
              : []),
            // GLOBAL scope
            { scope: 'GLOBAL' as const, companyId: null, documentFormatId: null },
          ],
        },
        orderBy: [
          // 優先返回更具體的配置
          { scope: 'desc' }, // FORMAT > COMPANY > GLOBAL
        ],
        take: 1,
      });

      if (configs.length === 0) {
        return null;
      }

      const config = configs[0];
      return {
        systemPrompt: config.systemPrompt,
        userPromptTemplate: config.userPromptTemplate,
        variables: config.variables as Record<string, unknown> | null,
        scope: config.scope,
        version: config.version,
      };
    } catch (error) {
      console.warn('[PromptAssembly] Failed to load Stage 1 prompt config:', error);
      return null;
    }
  }

  /**
   * CHANGE-025: 載入 Stage 2 格式識別 Prompt 配置
   *
   * @description
   *   從 PromptConfig 表載入 STAGE_2_FORMAT_IDENTIFICATION 類型的提示配置。
   *   優先級：FORMAT > COMPANY > GLOBAL
   *
   * @param options - 載入選項
   * @returns Stage 2 Prompt 配置（或 null 使用預設）
   */
  static async loadStage2PromptConfig(options: {
    companyId?: string;
    formatId?: string;
  }): Promise<StagePromptConfig | null> {
    const { companyId, formatId } = options;

    try {
      const configs = await prisma.promptConfig.findMany({
        where: {
          promptType: 'STAGE_2_FORMAT_IDENTIFICATION',
          isActive: true,
          OR: [
            ...(formatId && companyId
              ? [{ scope: 'FORMAT' as const, companyId, documentFormatId: formatId }]
              : []),
            ...(companyId
              ? [{ scope: 'COMPANY' as const, companyId, documentFormatId: null }]
              : []),
            { scope: 'GLOBAL' as const, companyId: null, documentFormatId: null },
          ],
        },
        orderBy: [{ scope: 'desc' }],
        take: 1,
      });

      if (configs.length === 0) {
        return null;
      }

      const config = configs[0];
      return {
        systemPrompt: config.systemPrompt,
        userPromptTemplate: config.userPromptTemplate,
        variables: config.variables as Record<string, unknown> | null,
        scope: config.scope,
        version: config.version,
      };
    } catch (error) {
      console.warn('[PromptAssembly] Failed to load Stage 2 prompt config:', error);
      return null;
    }
  }

  /**
   * CHANGE-025: 載入 Stage 3 欄位提取 Prompt 配置
   *
   * @description
   *   從 PromptConfig 表載入 STAGE_3_FIELD_EXTRACTION 類型的提示配置。
   *   優先級：FORMAT > COMPANY > GLOBAL
   *
   * @param options - 載入選項
   * @returns Stage 3 Prompt 配置（或 null 使用預設）
   */
  static async loadStage3PromptConfig(options: {
    companyId?: string;
    formatId?: string;
  }): Promise<StagePromptConfig | null> {
    const { companyId, formatId } = options;

    try {
      const configs = await prisma.promptConfig.findMany({
        where: {
          promptType: 'STAGE_3_FIELD_EXTRACTION',
          isActive: true,
          OR: [
            ...(formatId && companyId
              ? [{ scope: 'FORMAT' as const, companyId, documentFormatId: formatId }]
              : []),
            ...(companyId
              ? [{ scope: 'COMPANY' as const, companyId, documentFormatId: null }]
              : []),
            { scope: 'GLOBAL' as const, companyId: null, documentFormatId: null },
          ],
        },
        orderBy: [{ scope: 'desc' }],
        take: 1,
      });

      if (configs.length === 0) {
        return null;
      }

      const config = configs[0];
      return {
        systemPrompt: config.systemPrompt,
        userPromptTemplate: config.userPromptTemplate,
        variables: config.variables as Record<string, unknown> | null,
        scope: config.scope,
        version: config.version,
      };
    } catch (error) {
      console.warn('[PromptAssembly] Failed to load Stage 3 prompt config:', error);
      return null;
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 快速組裝 Prompt
 */
export async function assemblePrompt(
  options?: PromptAssemblyOptions,
  imageCount?: number
): Promise<PromptAssemblyResult> {
  return PromptAssemblyService.assemblePrompt(options, imageCount);
}

/**
 * 載入動態配置
 */
export async function loadDynamicConfig(
  options?: PromptAssemblyOptions
): Promise<DynamicPromptConfig> {
  return PromptAssemblyService.loadDynamicConfig(options || {});
}

/**
 * 清除 Prompt 快取
 */
export function clearPromptCache(): void {
  PromptAssemblyService.clearCache();
}

// ============================================================================
// CHANGE-025: Stage Prompt Config Convenience Functions
// ============================================================================

/**
 * CHANGE-025: 載入 Stage 1 公司識別 Prompt 配置
 */
export async function loadStage1PromptConfig(options: {
  companyId?: string;
  formatId?: string;
}): Promise<StagePromptConfig | null> {
  return PromptAssemblyService.loadStage1PromptConfig(options);
}

/**
 * CHANGE-025: 載入 Stage 2 格式識別 Prompt 配置
 */
export async function loadStage2PromptConfig(options: {
  companyId?: string;
  formatId?: string;
}): Promise<StagePromptConfig | null> {
  return PromptAssemblyService.loadStage2PromptConfig(options);
}

/**
 * CHANGE-025: 載入 Stage 3 欄位提取 Prompt 配置
 */
export async function loadStage3PromptConfig(options: {
  companyId?: string;
  formatId?: string;
}): Promise<StagePromptConfig | null> {
  return PromptAssemblyService.loadStage3PromptConfig(options);
}
