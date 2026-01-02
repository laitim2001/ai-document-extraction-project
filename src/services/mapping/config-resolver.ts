/**
 * @fileoverview 映射配置解析器
 * @description
 *   負責從資料庫獲取並解析映射配置，實現三層優先級系統：
 *   - GLOBAL（全域）< COMPANY（公司）< FORMAT（文件格式）
 *   - 高優先級配置會覆蓋低優先級的同名規則
 *
 * @module src/services/mapping/config-resolver
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 *
 * @features
 *   - 三層配置優先級解析
 *   - 配置規則合併
 *   - 支援快取整合
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫存取
 *   - @/types/field-mapping - 類型定義
 */

import { prisma } from '@/lib/prisma';
import type {
  IConfigResolver,
  MappingContext,
  ResolvedConfig,
  EffectiveRule,
  ConfigScope,
  TransformParams,
  TransformType,
} from '@/types/field-mapping';

// ============================================================================
// 常數定義
// ============================================================================

/**
 * 配置範圍優先級（數字越大優先級越高）
 */
const SCOPE_PRIORITY: Record<ConfigScope, number> = {
  GLOBAL: 1,
  COMPANY: 2,
  FORMAT: 3,
};

// ============================================================================
// ConfigResolver 實現
// ============================================================================

/**
 * 映射配置解析器
 * @description 負責從資料庫獲取映射配置並按優先級解析
 */
export class ConfigResolver implements IConfigResolver {
  // ==========================================================================
  // 公開方法
  // ==========================================================================

  /**
   * 解析有效配置（按優先級排序）
   * @description
   *   根據上下文獲取所有適用的配置，按優先級從高到低排序：
   *   FORMAT > COMPANY > GLOBAL
   *
   * @param context 映射上下文
   * @returns 解析後的配置列表（按優先級排序，高優先級在前）
   */
  async resolveConfigs(context: MappingContext): Promise<ResolvedConfig[]> {
    const configs: ResolvedConfig[] = [];

    // 1. 獲取 FORMAT 配置（最高優先級）
    if (context.documentFormatId) {
      const formatConfig = await this.fetchFormatConfig(context.documentFormatId);
      if (formatConfig) {
        configs.push(formatConfig);
      }
    }

    // 2. 獲取 COMPANY 配置
    if (context.companyId) {
      const companyConfig = await this.fetchCompanyConfig(context.companyId);
      if (companyConfig) {
        configs.push(companyConfig);
      }
    }

    // 3. 獲取 GLOBAL 配置（最低優先級）
    const globalConfig = await this.fetchGlobalConfig();
    if (globalConfig) {
      configs.push(globalConfig);
    }

    return configs;
  }

  /**
   * 獲取全域配置
   * @returns 全域配置（如存在且啟用）
   */
  async fetchGlobalConfig(): Promise<ResolvedConfig | null> {
    const config = await prisma.fieldMappingConfig.findFirst({
      where: {
        scope: 'GLOBAL',
        isActive: true,
      },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!config) {
      return null;
    }

    return this.mapToResolvedConfig(config);
  }

  /**
   * 獲取公司配置
   * @param companyId 公司 ID
   * @returns 公司配置（如存在且啟用）
   */
  async fetchCompanyConfig(companyId: string): Promise<ResolvedConfig | null> {
    const config = await prisma.fieldMappingConfig.findFirst({
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

    if (!config) {
      return null;
    }

    return this.mapToResolvedConfig(config);
  }

  /**
   * 獲取文件格式配置
   * @param documentFormatId 文件格式 ID
   * @returns 文件格式配置（如存在且啟用）
   */
  async fetchFormatConfig(documentFormatId: string): Promise<ResolvedConfig | null> {
    const config = await prisma.fieldMappingConfig.findFirst({
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

    if (!config) {
      return null;
    }

    return this.mapToResolvedConfig(config);
  }

  // ==========================================================================
  // 靜態方法
  // ==========================================================================

  /**
   * 合併多個配置的規則
   * @description
   *   按優先級合併規則，高優先級配置的規則會覆蓋低優先級的同名規則。
   *   相同 targetField 的規則只保留優先級最高的。
   *
   * @param configs 配置列表（按優先級排序，高優先級在前）
   * @returns 合併後的有效規則列表
   */
  static mergeConfigs(configs: ResolvedConfig[]): EffectiveRule[] {
    // 使用 Map 來追蹤每個 targetField 的規則
    const ruleMap = new Map<string, EffectiveRule>();

    // 從低優先級到高優先級遍歷，這樣高優先級會覆蓋低優先級
    const reversedConfigs = [...configs].reverse();

    for (const config of reversedConfigs) {
      for (const rule of config.rules) {
        // 高優先級配置的規則會覆蓋低優先級的
        ruleMap.set(rule.targetField, rule);
      }
    }

    // 按規則優先級排序
    const mergedRules = Array.from(ruleMap.values());
    mergedRules.sort((a, b) => a.priority - b.priority);

    return mergedRules;
  }

  /**
   * 獲取配置範圍優先級
   * @param scope 配置範圍
   * @returns 優先級數值
   */
  static getScopePriority(scope: ConfigScope): number {
    return SCOPE_PRIORITY[scope];
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 將 Prisma 模型映射為 ResolvedConfig
   * @param config Prisma 配置模型
   * @returns 解析後的配置
   */
  private mapToResolvedConfig(
    config: NonNullable<Awaited<ReturnType<typeof prisma.fieldMappingConfig.findFirst>>> & {
      rules: Array<{
        id: string;
        configId: string;
        sourceFields: unknown; // Prisma JsonValue
        targetField: string;
        transformType: string;
        transformParams: unknown; // Prisma JsonValue
        priority: number;
        isActive: boolean;
        description: string | null;
      }>;
    }
  ): ResolvedConfig {
    if (!config) {
      throw new Error('Config is null');
    }

    return {
      id: config.id,
      name: config.name,
      scope: config.scope as ConfigScope,
      companyId: config.companyId ?? undefined,
      documentFormatId: config.documentFormatId ?? undefined,
      isActive: config.isActive,
      version: config.version,
      rules: config.rules.map((rule) => this.mapToEffectiveRule(rule)),
    };
  }

  /**
   * 將 Prisma 規則映射為 EffectiveRule
   * @param rule Prisma 規則模型
   * @returns 有效規則
   */
  private mapToEffectiveRule(rule: {
    id: string;
    configId: string;
    sourceFields: unknown; // Prisma JsonValue
    targetField: string;
    transformType: string;
    transformParams: unknown; // Prisma JsonValue
    priority: number;
    isActive: boolean;
    description: string | null;
  }): EffectiveRule {
    // 安全地將 JsonValue 轉換為 string[]
    const sourceFields = Array.isArray(rule.sourceFields)
      ? (rule.sourceFields as string[])
      : [];

    return {
      id: rule.id,
      configId: rule.configId,
      sourceFields,
      targetField: rule.targetField,
      transformType: rule.transformType as TransformType,
      transformParams: rule.transformParams as TransformParams | null,
      priority: rule.priority,
      isActive: rule.isActive,
      description: rule.description ?? undefined,
    };
  }
}

// ============================================================================
// 導出
// ============================================================================

/**
 * ConfigResolver 單例實例
 */
export const configResolver = new ConfigResolver();
