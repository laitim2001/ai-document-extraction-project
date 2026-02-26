/**
 * @fileoverview Prompt 合併工具 - 多層配置合併處理
 * @description
 *   實現 PromptConfig 的三層合併策略：
 *   - OVERRIDE: 完全覆蓋父層 Prompt
 *   - APPEND: 附加到父層 Prompt 末尾
 *   - PREPEND: 插入到父層 Prompt 開頭
 *
 *   支援 Scope 優先級鏈：FORMAT > COMPANY > GLOBAL > 硬編碼預設
 *
 * @module src/services/extraction-v3/utils/prompt-merger
 * @since CHANGE-026 - Prompt 配置與 Stage 服務整合
 * @lastModified 2026-02-03
 *
 * @features
 *   - 三種合併策略實現
 *   - 多層配置的級聯合併
 *   - 合併結果追蹤
 *   - 類型安全的 Prisma enum 支援
 *
 * @related
 *   - src/services/extraction-v3/utils/variable-replacer.ts - 變數替換工具
 *   - src/services/extraction-v3/prompt-assembly.service.ts - Prompt 組裝服務
 *   - src/types/prompt-config.ts - Prompt 配置類型定義
 */

import type { MergeStrategy } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * 單一 Prompt 配置（用於合併）
 */
export interface PromptConfigForMerge {
  /** 配置 ID */
  id: string;
  /** 配置名稱 */
  name: string;
  /** 配置範圍 */
  scope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
  /** 系統提示詞 */
  systemPrompt: string;
  /** 用戶提示詞模板 */
  userPromptTemplate: string;
  /** 合併策略 */
  mergeStrategy: MergeStrategy;
}

/**
 * 合併後的 Prompt 結果
 */
export interface MergedPromptResult {
  /** 合併後的系統提示詞 */
  systemPrompt: string;
  /** 合併後的用戶提示詞模板 */
  userPromptTemplate: string;
  /** 應用的配置來源（按優先級順序） */
  appliedConfigs: AppliedConfigInfo[];
}

/**
 * 應用的配置資訊
 */
export interface AppliedConfigInfo {
  /** 配置 ID */
  id: string;
  /** 配置名稱 */
  name: string;
  /** 配置範圍 */
  scope: string;
  /** 使用的合併策略 */
  mergeStrategy: string;
}

/**
 * 合併選項
 */
export interface MergeOptions {
  /** 合併分隔符（預設 '\n\n'） */
  separator?: string;
  /** 是否追蹤來源（預設 true） */
  trackSources?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SEPARATOR = '\n\n';

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 合併父層和子層 Prompt
 *
 * @description
 *   根據指定的合併策略將兩個 Prompt 合併：
 *   - OVERRIDE: 子層完全取代父層
 *   - APPEND: 子層附加到父層末尾
 *   - PREPEND: 子層插入到父層開頭
 *
 * @param parentPrompt - 父層 Prompt（GLOBAL 或硬編碼預設）
 * @param childPrompt - 子層 Prompt（COMPANY 或 FORMAT 級）
 * @param strategy - 合併策略
 * @param options - 合併選項
 * @returns 合併後的 Prompt
 *
 * @example
 * // OVERRIDE: 子層完全取代
 * mergePrompts('Parent prompt', 'Child prompt', 'OVERRIDE');
 * // Result: 'Child prompt'
 *
 * // APPEND: 子層附加到父層後
 * mergePrompts('Parent prompt', 'Child prompt', 'APPEND');
 * // Result: 'Parent prompt\n\nChild prompt'
 *
 * // PREPEND: 子層插入到父層前
 * mergePrompts('Parent prompt', 'Child prompt', 'PREPEND');
 * // Result: 'Child prompt\n\nParent prompt'
 */
export function mergePrompts(
  parentPrompt: string,
  childPrompt: string,
  strategy: MergeStrategy,
  options?: MergeOptions
): string {
  const separator = options?.separator ?? DEFAULT_SEPARATOR;

  // 處理空值情況
  if (!childPrompt || childPrompt.trim() === '') {
    return parentPrompt;
  }
  if (!parentPrompt || parentPrompt.trim() === '') {
    return childPrompt;
  }

  switch (strategy) {
    case 'OVERRIDE':
      return childPrompt;

    case 'APPEND':
      return `${parentPrompt}${separator}${childPrompt}`;

    case 'PREPEND':
      return `${childPrompt}${separator}${parentPrompt}`;

    default:
      console.warn(
        `[PromptMerger] Unknown merge strategy: ${strategy}, using OVERRIDE`
      );
      return childPrompt;
  }
}

/**
 * 合併多層 Prompt 配置
 *
 * @description
 *   按照 Scope 優先級（GLOBAL → COMPANY → FORMAT）依序合併配置。
 *   每一層根據其 mergeStrategy 決定如何與上一層合併。
 *
 * @param basePrompt - 基礎 Prompt（硬編碼預設）
 * @param configs - 按優先級排序的配置列表（GLOBAL 在前，FORMAT 在後）
 * @param options - 合併選項
 * @returns 合併結果
 *
 * @example
 * const result = mergePromptConfigs(
 *   { systemPrompt: 'Default', userPromptTemplate: 'Default user' },
 *   [
 *     { scope: 'GLOBAL', systemPrompt: 'Global', mergeStrategy: 'APPEND', ... },
 *     { scope: 'COMPANY', systemPrompt: 'Company', mergeStrategy: 'OVERRIDE', ... },
 *   ]
 * );
 */
export function mergePromptConfigs(
  basePrompt: { systemPrompt: string; userPromptTemplate: string },
  configs: PromptConfigForMerge[],
  options?: MergeOptions
): MergedPromptResult {
  const appliedConfigs: AppliedConfigInfo[] = [];
  let currentSystem = basePrompt.systemPrompt;
  let currentUser = basePrompt.userPromptTemplate;

  // 按 Scope 優先級排序：GLOBAL → COMPANY → FORMAT
  const sortedConfigs = [...configs].sort((a, b) => {
    const scopeOrder = { GLOBAL: 0, COMPANY: 1, FORMAT: 2 };
    return scopeOrder[a.scope] - scopeOrder[b.scope];
  });

  for (const config of sortedConfigs) {
    // 合併 systemPrompt
    if (config.systemPrompt && config.systemPrompt.trim() !== '') {
      currentSystem = mergePrompts(
        currentSystem,
        config.systemPrompt,
        config.mergeStrategy,
        options
      );
    }

    // 合併 userPromptTemplate
    if (config.userPromptTemplate && config.userPromptTemplate.trim() !== '') {
      currentUser = mergePrompts(
        currentUser,
        config.userPromptTemplate,
        config.mergeStrategy,
        options
      );
    }

    // 記錄來源
    if (options?.trackSources !== false) {
      appliedConfigs.push({
        id: config.id,
        name: config.name,
        scope: config.scope,
        mergeStrategy: config.mergeStrategy,
      });
    }
  }

  return {
    systemPrompt: currentSystem,
    userPromptTemplate: currentUser,
    appliedConfigs,
  };
}

/**
 * 選擇最高優先級的配置
 *
 * @description
 *   從多個配置中選擇最高優先級的配置（FORMAT > COMPANY > GLOBAL）。
 *   不進行合併，僅返回最高優先級的配置。
 *
 * @param configs - 配置列表
 * @returns 最高優先級的配置，若無配置則返回 null
 */
export function selectHighestPriorityConfig(
  configs: PromptConfigForMerge[]
): PromptConfigForMerge | null {
  if (!configs || configs.length === 0) {
    return null;
  }

  const scopePriority = { FORMAT: 3, COMPANY: 2, GLOBAL: 1 };

  return configs.reduce((highest, current) => {
    const currentPriority = scopePriority[current.scope] ?? 0;
    const highestPriority = scopePriority[highest.scope] ?? 0;
    return currentPriority > highestPriority ? current : highest;
  });
}

/**
 * 創建分層合併結果摘要
 *
 * @description
 *   為調試和審計目的生成合併過程的可讀摘要。
 *
 * @param result - 合併結果
 * @returns 可讀的摘要字串
 */
export function createMergeSummary(result: MergedPromptResult): string {
  if (result.appliedConfigs.length === 0) {
    return '[PromptMerger] Using default hardcoded prompts (no custom configs applied)';
  }

  const configSummaries = result.appliedConfigs.map(
    (c) => `  - ${c.scope}: "${c.name}" (${c.mergeStrategy})`
  );

  return [
    '[PromptMerger] Applied configurations:',
    ...configSummaries,
  ].join('\n');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 檢查合併策略是否有效
 */
export function isValidMergeStrategy(value: string): value is MergeStrategy {
  return ['OVERRIDE', 'APPEND', 'PREPEND'].includes(value);
}

/**
 * 取得合併策略的中文描述
 */
export function getMergeStrategyDescription(strategy: MergeStrategy): string {
  const descriptions: Record<MergeStrategy, string> = {
    OVERRIDE: '完全覆蓋父層配置',
    APPEND: '附加到父層配置末尾',
    PREPEND: '插入到父層配置開頭',
  };
  return descriptions[strategy] ?? '未知策略';
}

/**
 * 計算合併後的 Token 估算
 *
 * @description
 *   粗略估算合併後 Prompt 的 Token 數量。
 *   使用簡單的字元數除以 4 的估算方式。
 *
 * @param result - 合併結果
 * @returns 估算的 Token 數量
 */
export function estimateMergedTokens(result: MergedPromptResult): number {
  const totalChars =
    (result.systemPrompt?.length ?? 0) +
    (result.userPromptTemplate?.length ?? 0);
  // 粗略估算：平均 4 個字元 = 1 token
  return Math.ceil(totalChars / 4);
}
