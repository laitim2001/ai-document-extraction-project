/**
 * @fileoverview Prompt 解析服務 - 三層配置解析與合併
 * @description
 *   實現 Prompt 配置的三層解析邏輯：
 *   1. 查找 Global 層配置（基礎）
 *   2. 查找 Company 層配置（覆蓋/合併）
 *   3. 查找 Format 層配置（最高優先級）
 *   4. 按合併策略組合最終 Prompt
 *   5. 執行變數替換
 *
 * @module src/services/prompt-resolver
 * @since Epic 14 - Story 14.3
 * @lastModified 2026-01-03
 *
 * @features
 *   - 三層配置解析（Format > Company > Global）
 *   - 合併策略支援（OVERRIDE/APPEND/PREPEND）
 *   - 變數替換（靜態/動態/上下文）
 *   - 快取機制（5分鐘 TTL）
 *
 * @dependencies
 *   - @prisma/client - 資料庫查詢
 *   - ./prompt-variable-engine.service - 變數替換
 *   - ./prompt-merge-engine.service - Prompt 合併
 *   - ./prompt-cache.service - 快取服務
 *
 * @related
 *   - src/types/prompt-resolution.ts - 類型定義
 *   - src/services/prompt-resolver.factory.ts - 工廠函數
 */

import { PrismaClient, PromptConfig, PromptType, PromptScope } from '@prisma/client';
import type {
  PromptResolutionRequest,
  ResolvedPromptResult,
  AppliedLayer,
  VariableContext,
  IntermediatePrompt,
} from '@/types/prompt-resolution';
import { PromptVariableEngine } from './prompt-variable-engine.service';
import { PromptMergeEngine } from './prompt-merge-engine.service';
import { PromptCache } from './prompt-cache.service';

/**
 * Prompt 解析服務
 * @description 負責解析和合併多層 Prompt 配置
 */
export class PromptResolverService {
  private readonly prisma: PrismaClient;
  private readonly variableEngine: PromptVariableEngine;
  private readonly mergeEngine: PromptMergeEngine;
  private readonly cache: PromptCache;

  constructor(
    prisma: PrismaClient,
    variableEngine: PromptVariableEngine,
    mergeEngine: PromptMergeEngine,
    cache: PromptCache
  ) {
    this.prisma = prisma;
    this.variableEngine = variableEngine;
    this.mergeEngine = mergeEngine;
    this.cache = cache;
  }

  /**
   * 解析 Prompt 配置
   * @param request - 解析請求
   * @returns 解析後的 Prompt 結果
   */
  async resolve(request: PromptResolutionRequest): Promise<ResolvedPromptResult> {
    const startTime = Date.now();
    const { promptType, companyId, documentFormatId, contextVariables } = request;

    // 1. 檢查快取
    const cacheKey = this.buildCacheKey(promptType, companyId, documentFormatId);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      // 對快取結果應用上下文變數
      const resolved = await this.applyContextVariables(
        cached,
        contextVariables,
        { companyId, documentFormatId }
      );
      return {
        ...resolved,
        metadata: {
          ...resolved.metadata,
          cached: true,
          cacheKey,
          resolutionTimeMs: Date.now() - startTime,
        },
      };
    }

    // 2. 查找所有層級的配置
    const configs = await this.findConfigs(promptType, companyId, documentFormatId);

    // 3. 按層級合併
    const merged = await this.mergeConfigs(configs);

    // 4. 替換變數
    const variableContext: VariableContext = {
      companyId,
      documentFormatId,
      customContext: contextVariables,
    };
    const { prompt: resolvedPrompt, replacedVariables } = await this.variableEngine.replace(
      merged,
      variableContext
    );

    // 5. 建立結果
    const result: ResolvedPromptResult = {
      systemPrompt: resolvedPrompt.systemPrompt,
      userPromptTemplate: resolvedPrompt.userPromptTemplate,
      appliedLayers: configs.map(c => ({
        scope: c.scope,
        configId: c.id,
        configName: c.name,
        mergeStrategy: c.mergeStrategy,
      })),
      replacedVariables,
      metadata: {
        resolutionTimeMs: Date.now() - startTime,
        cached: false,
        queriedConfigs: configs.length,
        mergedConfigs: configs.length,
      },
    };

    // 6. 快取結果（不包含上下文變數替換的版本）
    const cacheResult: ResolvedPromptResult = {
      ...result,
      systemPrompt: merged.systemPrompt,
      userPromptTemplate: merged.userPromptTemplate,
      replacedVariables: [],
    };
    await this.cache.set(cacheKey, cacheResult);

    return result;
  }

  /**
   * 查找所有層級的配置
   * @description 按優先級順序查找：GLOBAL → COMPANY → FORMAT
   */
  private async findConfigs(
    promptType: PromptType,
    companyId?: string | null,
    documentFormatId?: string | null
  ): Promise<PromptConfig[]> {
    const configs: PromptConfig[] = [];

    // 1. 查找 Global 配置
    const globalConfig = await this.prisma.promptConfig.findFirst({
      where: {
        promptType,
        scope: PromptScope.GLOBAL,
        isActive: true,
      },
    });
    if (globalConfig) configs.push(globalConfig);

    // 2. 查找 Company 配置
    if (companyId) {
      const companyConfig = await this.prisma.promptConfig.findFirst({
        where: {
          promptType,
          scope: PromptScope.COMPANY,
          companyId,
          isActive: true,
        },
      });
      if (companyConfig) configs.push(companyConfig);
    }

    // 3. 查找 Format 配置
    if (documentFormatId) {
      const formatConfig = await this.prisma.promptConfig.findFirst({
        where: {
          promptType,
          scope: PromptScope.FORMAT,
          documentFormatId,
          isActive: true,
        },
      });
      if (formatConfig) configs.push(formatConfig);
    }

    return configs;
  }

  /**
   * 合併多層配置
   * @description 按優先級順序合併：GLOBAL < COMPANY < FORMAT
   */
  private async mergeConfigs(configs: PromptConfig[]): Promise<IntermediatePrompt> {
    if (configs.length === 0) {
      return { systemPrompt: '', userPromptTemplate: '' };
    }

    // 按優先級排序
    const scopePriority: Record<PromptScope, number> = {
      [PromptScope.GLOBAL]: 0,
      [PromptScope.COMPANY]: 1,
      [PromptScope.FORMAT]: 2,
    };

    const sorted = [...configs].sort(
      (a, b) => scopePriority[a.scope] - scopePriority[b.scope]
    );

    // 從最低優先級開始逐層合併
    let systemPrompt = sorted[0].systemPrompt;
    let userPromptTemplate = sorted[0].userPromptTemplate;

    for (let i = 1; i < sorted.length; i++) {
      const config = sorted[i];

      systemPrompt = this.mergeEngine.merge({
        basePrompt: systemPrompt,
        overridePrompt: config.systemPrompt,
        strategy: config.mergeStrategy,
      });

      userPromptTemplate = this.mergeEngine.merge({
        basePrompt: userPromptTemplate,
        overridePrompt: config.userPromptTemplate,
        strategy: config.mergeStrategy,
      });
    }

    return { systemPrompt, userPromptTemplate };
  }

  /**
   * 應用上下文變數到已快取的結果
   */
  private async applyContextVariables(
    resolved: ResolvedPromptResult,
    contextVariables: Record<string, unknown> | undefined,
    variableContext: VariableContext
  ): Promise<ResolvedPromptResult> {
    if (!contextVariables || Object.keys(contextVariables).length === 0) {
      return resolved;
    }

    const { prompt, replacedVariables } = await this.variableEngine.replace(
      {
        systemPrompt: resolved.systemPrompt,
        userPromptTemplate: resolved.userPromptTemplate,
      },
      { ...variableContext, customContext: contextVariables }
    );

    return {
      ...resolved,
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate,
      replacedVariables: [...resolved.replacedVariables, ...replacedVariables],
    };
  }

  /**
   * 建立快取鍵
   */
  private buildCacheKey(
    promptType: PromptType,
    companyId?: string | null,
    documentFormatId?: string | null
  ): string {
    return `prompt:${promptType}:${companyId ?? 'null'}:${documentFormatId ?? 'null'}`;
  }

  /**
   * 清除指定類型的快取
   * @param promptType - Prompt 類型
   */
  async invalidateCache(promptType: PromptType): Promise<void> {
    const pattern = `prompt:${promptType}:*`;
    await this.cache.invalidatePattern(pattern);
  }

  /**
   * 清除所有快取
   */
  async clearAllCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * 取得快取統計
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 取得支援的變數列表
   */
  getSupportedVariables(): string[] {
    return this.variableEngine.getSupportedVariables();
  }
}
