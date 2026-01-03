/**
 * @fileoverview Prompt 變數替換引擎
 * @description
 *   支援三種類型的變數替換：
 *   1. 靜態變數 - 配置時定義，直接替換
 *   2. 動態變數 - 運行時計算（如 knownTerms, companyName）
 *   3. 上下文變數 - 來自處理流程傳入
 *
 * @module src/services/prompt-variable-engine
 * @since Epic 14 - Story 14.3
 * @lastModified 2026-01-03
 *
 * @features
 *   - 內建變數提供者（companyName, knownTerms 等）
 *   - 可擴展的提供者架構
 *   - 變數替換追蹤
 *
 * @dependencies
 *   - @prisma/client - 資料庫查詢
 *
 * @related
 *   - src/types/prompt-resolution.ts - 類型定義
 *   - src/services/prompt-resolver.service.ts - 主解析服務
 */

import { PrismaClient } from '@prisma/client';
import type {
  VariableContext,
  VariableProvider,
  ReplacedVariable,
  VariableReplacementResult,
} from '@/types/prompt-resolution';
import { ResolutionVariableType } from '@/types/prompt-resolution';

/**
 * Prompt 變數替換引擎
 */
export class PromptVariableEngine {
  private readonly prisma: PrismaClient;
  private readonly providers: Map<string, VariableProvider>;
  private readonly VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.providers = new Map();
    this.registerBuiltInProviders();
  }

  private registerBuiltInProviders(): void {
    // 公司名稱
    this.registerProvider({
      supportedVariables: ['companyName'],
      provide: async (_name, ctx) => {
        if (!ctx.companyId) return null;
        const company = await this.prisma.company.findUnique({
          where: { id: ctx.companyId },
          select: { name: true },
        });
        return company?.name ?? null;
      },
    });

    // 公司顯示名稱
    this.registerProvider({
      supportedVariables: ['companyDisplayName'],
      provide: async (_name, ctx) => {
        if (!ctx.companyId) return null;
        const company = await this.prisma.company.findUnique({
          where: { id: ctx.companyId },
          select: { displayName: true },
        });
        return company?.displayName ?? null;
      },
    });

    // 已知術語（使用 MappingRule 模型）
    this.registerProvider({
      supportedVariables: ['knownTerms', 'termList'],
      provide: async (_name, ctx) => {
        const where: Record<string, unknown> = { isActive: true };
        if (ctx.companyId) where.companyId = ctx.companyId;
        // Note: MappingRule 沒有 documentFormatId，只按 companyId 過濾

        const rules = await this.prisma.mappingRule.findMany({
          where,
          select: { fieldName: true, fieldLabel: true },
          orderBy: { priority: 'desc' },
          take: 50,
        });

        if (rules.length === 0) return '暫無已知映射規則';
        return rules.map(r => `- ${r.fieldName} → ${r.fieldLabel}`).join('\n');
      },
    });

    // 文件格式名稱
    this.registerProvider({
      supportedVariables: ['formatName', 'documentFormatName'],
      provide: async (_name, ctx) => {
        if (!ctx.documentFormatId) return null;
        const format = await this.prisma.documentFormat.findUnique({
          where: { id: ctx.documentFormatId },
          select: { name: true },
        });
        return format?.name ?? null;
      },
    });

    // 日期時間
    this.registerProvider({
      supportedVariables: ['currentDate', 'currentTime', 'currentDateTime'],
      provide: async (name) => {
        const now = new Date();
        if (name === 'currentDate') return now.toISOString().split('T')[0];
        if (name === 'currentTime') return now.toTimeString().split(' ')[0];
        if (name === 'currentDateTime') return now.toISOString();
        return null;
      },
    });

    // 統計信息
    this.registerProvider({
      supportedVariables: ['termCount', 'documentCount'],
      provide: async (name, ctx) => {
        if (name === 'termCount') {
          // 使用 MappingRule 計算規則數量
          const where: Record<string, unknown> = { isActive: true };
          if (ctx.companyId) where.companyId = ctx.companyId;
          // Note: MappingRule 沒有 documentFormatId
          const count = await this.prisma.mappingRule.count({ where });
          return count.toString();
        }
        if (name === 'documentCount') {
          // 使用 HistoricalFile 計算文件數量
          const where: Record<string, unknown> = {};
          if (ctx.companyId) where.identifiedCompanyId = ctx.companyId;
          if (ctx.documentFormatId) where.documentFormatId = ctx.documentFormatId;
          const count = await this.prisma.historicalFile.count({ where });
          return count.toString();
        }
        return null;
      },
    });
  }

  registerProvider(provider: VariableProvider): void {
    for (const varName of provider.supportedVariables) {
      this.providers.set(varName, provider);
    }
  }

  async replace(
    prompt: { systemPrompt: string; userPromptTemplate: string },
    context: VariableContext
  ): Promise<VariableReplacementResult> {
    const replacedVariables: ReplacedVariable[] = [];
    const variableValues = new Map<string, string>();

    const allVariables = new Set<string>();
    this.collectVariables(prompt.systemPrompt, allVariables);
    this.collectVariables(prompt.userPromptTemplate, allVariables);

    for (const varName of allVariables) {
      const resolved = await this.resolveVariable(varName, context);
      if (resolved !== null) {
        variableValues.set(varName, resolved.value);
        replacedVariables.push({
          name: varName,
          type: resolved.type,
          placeholder: `{{${varName}}}`,
          value: resolved.value,
        });
      }
    }

    const replaceVars = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variableValues.get(varName) ?? match;
      });
    };

    return {
      prompt: {
        systemPrompt: replaceVars(prompt.systemPrompt),
        userPromptTemplate: replaceVars(prompt.userPromptTemplate),
      },
      replacedVariables,
    };
  }

  private collectVariables(text: string, target: Set<string>): void {
    const matches = text.matchAll(/\{\{(\w+)\}\}/g);
    for (const match of matches) {
      target.add(match[1]);
    }
  }

  private async resolveVariable(
    varName: string,
    context: VariableContext
  ): Promise<{ value: string; type: ResolutionVariableType } | null> {
    if (context.customContext && varName in context.customContext) {
      const value = context.customContext[varName];
      return { value: String(value), type: ResolutionVariableType.CONTEXT };
    }

    const provider = this.providers.get(varName);
    if (provider) {
      const value = await provider.provide(varName, context);
      if (value !== null) {
        return { value, type: ResolutionVariableType.DYNAMIC };
      }
    }

    return null;
  }

  getSupportedVariables(): string[] {
    return Array.from(this.providers.keys());
  }

  isVariableSupported(varName: string): boolean {
    return this.providers.has(varName);
  }

  async previewVariables(
    template: string,
    context: VariableContext
  ): Promise<Array<{ name: string; value: string | null; supported: boolean }>> {
    const variables = new Set<string>();
    this.collectVariables(template, variables);

    const results: Array<{ name: string; value: string | null; supported: boolean }> = [];
    for (const varName of variables) {
      const resolved = await this.resolveVariable(varName, context);
      results.push({
        name: varName,
        value: resolved?.value ?? null,
        supported: resolved !== null,
      });
    }
    return results;
  }
}
