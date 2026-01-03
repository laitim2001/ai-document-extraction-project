/**
 * @fileoverview Prompt 合併引擎
 * @description
 *   實現三種合併策略：
 *   - OVERRIDE: 完全覆蓋（較高層級取代較低層級）
 *   - APPEND: 附加到後面（保留較低層級，新增較高層級）
 *   - PREPEND: 附加到前面（較高層級在前，較低層級在後）
 *
 * @module src/services/prompt-merge-engine
 * @since Epic 14 - Story 14.3
 * @lastModified 2026-01-03
 *
 * @features
 *   - 三種合併策略
 *   - 智能合併（保留區塊結構）
 *   - 可自定義分隔符
 *
 * @dependencies
 *   - @prisma/client - MergeStrategy enum
 *
 * @related
 *   - src/types/prompt-resolution.ts - 類型定義
 *   - src/services/prompt-resolver.service.ts - 主解析服務
 */

import { MergeStrategy } from '@prisma/client';
import type { MergeContext } from '@/types/prompt-resolution';

/**
 * Prompt 合併引擎
 * @description 負責按策略合併多層 Prompt 配置
 */
export class PromptMergeEngine {
  /** 預設分隔符 */
  private readonly DEFAULT_SEPARATOR = '\n\n---\n\n';

  /**
   * 合併兩個 Prompt
   * @param context - 合併上下文
   * @returns 合併後的 Prompt 字串
   */
  merge(context: MergeContext): string {
    const { basePrompt, overridePrompt, strategy, separator } = context;
    const sep = separator ?? this.DEFAULT_SEPARATOR;

    switch (strategy) {
      case MergeStrategy.OVERRIDE:
        return overridePrompt;

      case MergeStrategy.APPEND:
        if (!basePrompt.trim()) return overridePrompt;
        if (!overridePrompt.trim()) return basePrompt;
        return `${basePrompt}${sep}${overridePrompt}`;

      case MergeStrategy.PREPEND:
        if (!basePrompt.trim()) return overridePrompt;
        if (!overridePrompt.trim()) return basePrompt;
        return `${overridePrompt}${sep}${basePrompt}`;

      default:
        return overridePrompt;
    }
  }

  /**
   * 智能合併（保留區塊結構）
   * @param context - 合併上下文
   * @returns 合併後的 Prompt 字串
   */
  smartMerge(context: MergeContext): string {
    const { basePrompt, overridePrompt, strategy } = context;
    const baseInstructions = this.extractInstructions(basePrompt);
    const overrideInstructions = this.extractInstructions(overridePrompt);

    switch (strategy) {
      case MergeStrategy.OVERRIDE:
        return this.mergeInstructions(baseInstructions, overrideInstructions, 'override');
      case MergeStrategy.APPEND:
        return this.mergeInstructions(baseInstructions, overrideInstructions, 'append');
      case MergeStrategy.PREPEND:
        return this.mergeInstructions(overrideInstructions, baseInstructions, 'append');
      default:
        return overridePrompt;
    }
  }

  /**
   * 提取 Prompt 中的指令區塊
   */
  private extractInstructions(prompt: string): Map<string, string> {
    const instructions = new Map<string, string>();
    const sectionPattern = /##\s+([^\n]+)\n([\s\S]*?)(?=##\s+|$)/g;
    let match;

    while ((match = sectionPattern.exec(prompt)) !== null) {
      const [, title, content] = match;
      instructions.set(title.trim().toLowerCase(), content.trim());
    }

    if (instructions.size === 0 && prompt.trim()) {
      instructions.set('main', prompt.trim());
    }

    return instructions;
  }

  /**
   * 合併指令區塊
   */
  private mergeInstructions(
    base: Map<string, string>,
    override: Map<string, string>,
    mode: 'override' | 'append'
  ): string {
    const merged = new Map(base);

    for (const [key, value] of override) {
      if (mode === 'override' || !merged.has(key)) {
        merged.set(key, value);
      } else {
        const existing = merged.get(key)!;
        merged.set(key, `${existing}\n\n${value}`);
      }
    }

    const sections: string[] = [];
    for (const [title, content] of merged) {
      if (title === 'main') {
        sections.push(content);
      } else {
        const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1);
        sections.push(`## ${formattedTitle}\n${content}`);
      }
    }

    return sections.join('\n\n');
  }

  /**
   * 批量合併多個 Prompt
   */
  mergeMultiple(
    prompts: Array<{ prompt: string; strategy: MergeStrategy }>
  ): string {
    if (prompts.length === 0) return '';
    if (prompts.length === 1) return prompts[0].prompt;

    let result = prompts[0].prompt;

    for (let i = 1; i < prompts.length; i++) {
      result = this.merge({
        basePrompt: result,
        overridePrompt: prompts[i].prompt,
        strategy: prompts[i].strategy,
      });
    }

    return result;
  }
}
