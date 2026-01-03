/**
 * @fileoverview Prompt 解析服務工廠
 * @description
 *   提供 Prompt 解析服務的單例管理。
 *   確保整個應用程式使用同一個服務實例，共享快取。
 *
 * @module src/services/prompt-resolver.factory
 * @since Epic 14 - Story 14.3
 * @lastModified 2026-01-03
 *
 * @features
 *   - 單例模式
 *   - 延遲初始化
 *   - 可重置（用於測試）
 *
 * @related
 *   - src/services/prompt-resolver.service.ts - 解析服務
 */

import { PrismaClient } from '@prisma/client';
import { PromptResolverService } from './prompt-resolver.service';
import { PromptVariableEngine } from './prompt-variable-engine.service';
import { PromptMergeEngine } from './prompt-merge-engine.service';
import { PromptCache } from './prompt-cache.service';

/** 服務單例實例 */
let resolverInstance: PromptResolverService | null = null;
let variableEngineInstance: PromptVariableEngine | null = null;
let mergeEngineInstance: PromptMergeEngine | null = null;
let cacheInstance: PromptCache | null = null;

/**
 * 取得 Prompt 解析服務實例
 * @param prisma - Prisma 客戶端
 * @returns PromptResolverService 實例
 */
export function getPromptResolver(prisma: PrismaClient): PromptResolverService {
  if (!resolverInstance) {
    variableEngineInstance = new PromptVariableEngine(prisma);
    mergeEngineInstance = new PromptMergeEngine();
    cacheInstance = new PromptCache();

    resolverInstance = new PromptResolverService(
      prisma,
      variableEngineInstance,
      mergeEngineInstance,
      cacheInstance
    );
  }

  return resolverInstance;
}

/**
 * 取得變數引擎實例
 * @param prisma - Prisma 客戶端
 * @returns PromptVariableEngine 實例
 */
export function getVariableEngine(prisma: PrismaClient): PromptVariableEngine {
  if (!variableEngineInstance) {
    variableEngineInstance = new PromptVariableEngine(prisma);
  }
  return variableEngineInstance;
}

/**
 * 取得合併引擎實例
 * @returns PromptMergeEngine 實例
 */
export function getMergeEngine(): PromptMergeEngine {
  if (!mergeEngineInstance) {
    mergeEngineInstance = new PromptMergeEngine();
  }
  return mergeEngineInstance;
}

/**
 * 取得快取服務實例
 * @returns PromptCache 實例
 */
export function getPromptCache(): PromptCache {
  if (!cacheInstance) {
    cacheInstance = new PromptCache();
  }
  return cacheInstance;
}

/**
 * 重置所有服務實例
 * @description 用於測試或需要重新初始化的場景
 */
export function resetPromptResolver(): void {
  resolverInstance = null;
  variableEngineInstance = null;
  mergeEngineInstance = null;
  cacheInstance = null;
}

/**
 * 清除快取
 * @description 便捷方法，用於清除解析快取
 */
export async function clearPromptCache(): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.clear();
  }
}
