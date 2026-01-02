# Tech Spec: Story 14.3 - Prompt 解析與合併服務

## 概述

**Story**: Story 14.3 - Prompt Resolution & Merge Service
**Epic**: Epic 14 - Prompt 配置與動態生成
**目標**: 實現動態 Prompt 解析服務，根據 Company 和 Format 動態組合最適合的 Prompt

---

## 1. 功能需求

### 1.1 核心功能

1. **三層配置解析**: Format > Company > Global 優先級
2. **合併策略運行**: OVERRIDE / APPEND / PREPEND
3. **變數替換引擎**: 靜態、動態、上下文變數支援
4. **快取機制**: 避免重複查詢和計算

### 1.2 Acceptance Criteria

- 按優先級查找配置（Format > Company > Global）
- 按 mergeStrategy 合併多層 Prompt
- 支援變數替換（靜態、動態、上下文）
- 解析響應時間 < 50ms（含快取）

---

## 2. 技術設計

### 2.1 核心類型定義

```typescript
// src/types/prompt-resolution.ts

/**
 * @fileoverview Prompt 解析相關類型定義
 * @module src/types/prompt-resolution
 * @since Epic 14 - Story 14.3
 */

import { PromptType, PromptScope, MergeStrategy } from '@prisma/client';

/**
 * Prompt 解析請求
 */
export interface PromptResolutionRequest {
  /** Prompt 類型 */
  promptType: PromptType;
  /** 公司 ID（可選） */
  companyId?: string | null;
  /** 文件格式 ID（可選） */
  documentFormatId?: string | null;
  /** 上下文變數 */
  contextVariables?: Record<string, unknown>;
}

/**
 * 解析後的 Prompt 結果
 */
export interface ResolvedPrompt {
  /** 最終的 System Prompt */
  systemPrompt: string;
  /** 最終的 User Prompt Template */
  userPromptTemplate: string;
  /** 應用的配置層級 */
  appliedLayers: AppliedLayer[];
  /** 替換的變數 */
  replacedVariables: ReplacedVariable[];
  /** 解析元資料 */
  metadata: ResolutionMetadata;
}

/**
 * 應用的配置層級
 */
export interface AppliedLayer {
  /** 層級範圍 */
  scope: PromptScope;
  /** 配置 ID */
  configId: string;
  /** 配置名稱 */
  configName: string;
  /** 合併策略 */
  mergeStrategy: MergeStrategy;
}

/**
 * 已替換的變數
 */
export interface ReplacedVariable {
  /** 變數名稱 */
  name: string;
  /** 變數類型 */
  type: VariableType;
  /** 原始佔位符 */
  placeholder: string;
  /** 替換後的值 */
  value: string;
}

/**
 * 變數類型
 */
export enum VariableType {
  /** 靜態變數 - 配置時定義 */
  STATIC = 'STATIC',
  /** 動態變數 - 運行時計算 */
  DYNAMIC = 'DYNAMIC',
  /** 上下文變數 - 來自處理流程 */
  CONTEXT = 'CONTEXT',
}

/**
 * 解析元資料
 */
export interface ResolutionMetadata {
  /** 解析時間（毫秒） */
  resolutionTimeMs: number;
  /** 是否從快取獲取 */
  cached: boolean;
  /** 快取鍵（如果有） */
  cacheKey?: string;
  /** 查詢的配置數量 */
  queriedConfigs: number;
  /** 合併的配置數量 */
  mergedConfigs: number;
}

/**
 * 變數提供者介面
 */
export interface VariableProvider {
  /** 提供變數值 */
  provide(
    variableName: string,
    context: VariableContext
  ): Promise<string | null>;
  /** 支援的變數名稱列表 */
  supportedVariables: string[];
}

/**
 * 變數上下文
 */
export interface VariableContext {
  companyId?: string | null;
  documentFormatId?: string | null;
  documentId?: string;
  customContext?: Record<string, unknown>;
}

/**
 * 合併上下文
 */
export interface MergeContext {
  /** 基礎 Prompt（較低層級） */
  basePrompt: string;
  /** 覆蓋 Prompt（較高層級） */
  overridePrompt: string;
  /** 合併策略 */
  strategy: MergeStrategy;
  /** 分隔符 */
  separator?: string;
}
```

### 2.2 PromptResolver 服務

```typescript
// src/services/prompt-resolver.service.ts

/**
 * @fileoverview Prompt 解析服務 - 三層配置解析與合併
 * @module src/services/prompt-resolver
 * @since Epic 14 - Story 14.3
 *
 * @description
 *   實現 Prompt 配置的三層解析邏輯：
 *   1. 查找 Format 層配置
 *   2. 查找 Company 層配置
 *   3. 查找 Global 層配置
 *   4. 按合併策略組合最終 Prompt
 *   5. 運行變數替換
 */

import { PrismaClient, PromptConfig, PromptType, PromptScope, MergeStrategy } from '@prisma/client';
import {
  PromptResolutionRequest,
  ResolvedPrompt,
  AppliedLayer,
  VariableContext,
} from '@/types/prompt-resolution';
import { PromptVariableEngine } from './prompt-variable-engine.service';
import { PromptMergeEngine } from './prompt-merge-engine.service';
import { PromptCache } from './prompt-cache.service';

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
   */
  async resolve(request: PromptResolutionRequest): Promise<ResolvedPrompt> {
    const startTime = Date.now();
    const { promptType, companyId, documentFormatId, contextVariables } = request;

    // 1. 檢查快取
    const cacheKey = this.buildCacheKey(promptType, companyId, documentFormatId);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const resolved = await this.applyContextVariables(
        cached, contextVariables, { companyId, documentFormatId }
      );
      return { ...resolved, metadata: { ...resolved.metadata, cached: true, cacheKey } };
    }

    // 2. 查找所有層級的配置
    const configs = await this.findConfigs(promptType, companyId, documentFormatId);

    // 3. 按層級合併
    const merged = await this.mergeConfigs(configs);

    // 4. 替換變數
    const variableContext: VariableContext = {
      companyId, documentFormatId, customContext: contextVariables,
    };
    const { prompt: resolved, replacedVariables } = await this.variableEngine.replace(
      merged, variableContext
    );

    // 5. 建立結果
    const result: ResolvedPrompt = {
      systemPrompt: resolved.systemPrompt,
      userPromptTemplate: resolved.userPromptTemplate,
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

    // 6. 快取結果
    await this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * 查找所有層級的配置
   */
  private async findConfigs(
    promptType: PromptType,
    companyId?: string | null,
    documentFormatId?: string | null
  ): Promise<PromptConfig[]> {
    const configs: PromptConfig[] = [];

    // 1. 查找 Global 配置
    const globalConfig = await this.prisma.promptConfig.findFirst({
      where: { promptType, scope: PromptScope.GLOBAL, isActive: true },
    });
    if (globalConfig) configs.push(globalConfig);

    // 2. 查找 Company 配置
    if (companyId) {
      const companyConfig = await this.prisma.promptConfig.findFirst({
        where: { promptType, scope: PromptScope.COMPANY, companyId, isActive: true },
      });
      if (companyConfig) configs.push(companyConfig);
    }

    // 3. 查找 Format 配置
    if (documentFormatId) {
      const formatConfig = await this.prisma.promptConfig.findFirst({
        where: { promptType, scope: PromptScope.FORMAT, documentFormatId, isActive: true },
      });
      if (formatConfig) configs.push(formatConfig);
    }

    return configs;
  }

  /**
   * 合併多層配置
   */
  private async mergeConfigs(configs: PromptConfig[]): Promise<{
    systemPrompt: string;
    userPromptTemplate: string;
  }> {
    if (configs.length === 0) {
      return { systemPrompt: '', userPromptTemplate: '' };
    }

    // 按優先級排序：GLOBAL < COMPANY < FORMAT
    const scopePriority = {
      [PromptScope.GLOBAL]: 0,
      [PromptScope.COMPANY]: 1,
      [PromptScope.FORMAT]: 2,
    };
    const sorted = [...configs].sort(
      (a, b) => scopePriority[a.scope] - scopePriority[b.scope]
    );

    // 逐層合併
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
   * 應用上下文變數
   */
  private async applyContextVariables(
    resolved: ResolvedPrompt,
    contextVariables: Record<string, unknown> | undefined,
    variableContext: VariableContext
  ): Promise<ResolvedPrompt> {
    if (!contextVariables || Object.keys(contextVariables).length === 0) {
      return resolved;
    }
    const { prompt, replacedVariables } = await this.variableEngine.replace(
      { systemPrompt: resolved.systemPrompt, userPromptTemplate: resolved.userPromptTemplate },
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
    return `prompt:${promptType}:${companyId || 'null'}:${documentFormatId || 'null'}`;
  }

  /**
   * 清除指定配置的快取
   */
  async invalidateCache(promptType: PromptType): Promise<void> {
    const pattern = `prompt:${promptType}:*`;
    await this.cache.invalidatePattern(pattern);
  }
}
```

### 2.3 變數替換引擎

```typescript
// src/services/prompt-variable-engine.service.ts

/**
 * @fileoverview Prompt 變數替換引擎
 * @module src/services/prompt-variable-engine
 * @since Epic 14 - Story 14.3
 *
 * @description
 *   支援三種類型的變數替換：
 *   1. 靜態變數 - 配置時定義，直接替換
 *   2. 動態變數 - 運行時計算（如 knownTerms）
 *   3. 上下文變數 - 來自處理流程
 */

import { PrismaClient } from '@prisma/client';
import { VariableType, VariableContext, ReplacedVariable, VariableProvider } from '@/types/prompt-resolution';

interface VariableReplacementResult {
  prompt: { systemPrompt: string; userPromptTemplate: string };
  replacedVariables: ReplacedVariable[];
}

export class PromptVariableEngine {
  private readonly prisma: PrismaClient;
  private readonly providers: Map<string, VariableProvider>;
  private readonly VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.providers = new Map();
    this.registerBuiltInProviders();
  }

  /**
   * 註冊內建變數提供者
   */
  private registerBuiltInProviders(): void {
    // 公司名稱提供者
    this.registerProvider({
      supportedVariables: ['companyName'],
      provide: async (name, ctx) => {
        if (!ctx.companyId) return null;
        const company = await this.prisma.company.findUnique({
          where: { id: ctx.companyId },
          select: { name: true },
        });
        return company?.name || null;
      },
    });

    // 已知術語提供者
    this.registerProvider({
      supportedVariables: ['knownTerms', 'termList'],
      provide: async (name, ctx) => {
        const where: Record<string, unknown> = { isActive: true };
        if (ctx.companyId) where.companyId = ctx.companyId;
        if (ctx.documentFormatId) where.documentFormatId = ctx.documentFormatId;

        const terms = await this.prisma.aggregatedTerm.findMany({
          where,
          select: { originalTerm: true, mappedCategory: true },
          orderBy: { occurrenceCount: 'desc' },
          take: 50,
        });

        if (terms.length === 0) return '暫無已知術語';
        return terms.map(t => `- ${t.originalTerm} → ${t.mappedCategory}`).join('\n');
      },
    });

    // 文件格式名稱提供者
    this.registerProvider({
      supportedVariables: ['formatName', 'documentFormatName'],
      provide: async (name, ctx) => {
        if (!ctx.documentFormatId) return null;
        const format = await this.prisma.documentFormat.findUnique({
          where: { id: ctx.documentFormatId },
          select: { name: true },
        });
        return format?.name || null;
      },
    });

    // 日期時間提供者
    this.registerProvider({
      supportedVariables: ['currentDate', 'currentTime', 'currentDateTime'],
      provide: async (name) => {
        const now = new Date();
        switch (name) {
          case 'currentDate': return now.toISOString().split('T')[0];
          case 'currentTime': return now.toTimeString().split(' ')[0];
          case 'currentDateTime': return now.toISOString();
          default: return null;
        }
      },
    });

    // 統計信息提供者
    this.registerProvider({
      supportedVariables: ['termCount', 'documentCount'],
      provide: async (name, ctx) => {
        const where: Record<string, unknown> = {};
        if (ctx.companyId) where.companyId = ctx.companyId;
        if (ctx.documentFormatId) where.documentFormatId = ctx.documentFormatId;

        switch (name) {
          case 'termCount': {
            const count = await this.prisma.aggregatedTerm.count({ where });
            return count.toString();
          }
          case 'documentCount': {
            const count = await this.prisma.processedFile.count({ where });
            return count.toString();
          }
          default: return null;
        }
      },
    });
  }

  /**
   * 註冊變數提供者
   */
  registerProvider(provider: VariableProvider): void {
    for (const varName of provider.supportedVariables) {
      this.providers.set(varName, provider);
    }
  }

  /**
   * 替換 Prompt 中的變數
   */
  async replace(
    prompt: { systemPrompt: string; userPromptTemplate: string },
    context: VariableContext
  ): Promise<VariableReplacementResult> {
    const replacedVariables: ReplacedVariable[] = [];
    const variableValues = new Map<string, string>();

    // 1. 收集所有變數
    const allVariables = new Set<string>();
    const collectVariables = (text: string) => {
      let match;
      while ((match = this.VARIABLE_PATTERN.exec(text)) !== null) {
        allVariables.add(match[1]);
      }
      this.VARIABLE_PATTERN.lastIndex = 0;
    };
    collectVariables(prompt.systemPrompt);
    collectVariables(prompt.userPromptTemplate);

    // 2. 解析所有變數值
    for (const varName of allVariables) {
      const value = await this.resolveVariable(varName, context);
      if (value !== null) {
        variableValues.set(varName, value.value);
        replacedVariables.push({
          name: varName,
          type: value.type,
          placeholder: `{{${varName}}}`,
          value: value.value,
        });
      }
    }

    // 3. 運行替換
    const replaceVariables = (text: string): string => {
      return text.replace(this.VARIABLE_PATTERN, (match, varName) => {
        return variableValues.get(varName) || match;
      });
    };

    return {
      prompt: {
        systemPrompt: replaceVariables(prompt.systemPrompt),
        userPromptTemplate: replaceVariables(prompt.userPromptTemplate),
      },
      replacedVariables,
    };
  }

  /**
   * 解析單個變數值
   */
  private async resolveVariable(
    varName: string,
    context: VariableContext
  ): Promise<{ value: string; type: VariableType } | null> {
    // 1. 優先檢查上下文變數
    if (context.customContext && varName in context.customContext) {
      const value = context.customContext[varName];
      return { value: String(value), type: VariableType.CONTEXT };
    }

    // 2. 檢查動態變數提供者
    const provider = this.providers.get(varName);
    if (provider) {
      const value = await provider.provide(varName, context);
      if (value !== null) {
        return { value, type: VariableType.DYNAMIC };
      }
    }

    return null;
  }

  /**
   * 獲取所有支援的變數列表
   */
  getSupportedVariables(): string[] {
    return Array.from(this.providers.keys());
  }
}
```

### 2.4 Prompt 合併引擎

```typescript
// src/services/prompt-merge-engine.service.ts

/**
 * @fileoverview Prompt 合併引擎
 * @module src/services/prompt-merge-engine
 * @since Epic 14 - Story 14.3
 *
 * @description
 *   實現三種合併策略：
 *   - OVERRIDE: 完全覆蓋
 *   - APPEND: 附加到後面
 *   - PREPEND: 附加到前面
 */

import { MergeStrategy } from '@prisma/client';
import { MergeContext } from '@/types/prompt-resolution';

export class PromptMergeEngine {
  private readonly DEFAULT_SEPARATOR = '\n\n---\n\n';

  /**
   * 合併兩個 Prompt
   */
  merge(context: MergeContext): string {
    const { basePrompt, overridePrompt, strategy, separator } = context;
    const sep = separator || this.DEFAULT_SEPARATOR;

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
   * 智能合併（保留關鍵指令）
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
        sections.push(`## ${title.charAt(0).toUpperCase() + title.slice(1)}\n${content}`);
      }
    }

    return sections.join('\n\n');
  }
}
```

### 2.5 Prompt 快取服務

```typescript
// src/services/prompt-cache.service.ts

/**
 * @fileoverview Prompt 解析結果快取服務
 * @module src/services/prompt-cache
 * @since Epic 14 - Story 14.3
 */

import { ResolvedPrompt } from '@/types/prompt-resolution';

export class PromptCache {
  private readonly cache: Map<string, { data: ResolvedPrompt; expiresAt: number }>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 分鐘

  constructor() {
    this.cache = new Map();
  }

  async get(key: string): Promise<ResolvedPrompt | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  async set(key: string, data: ResolvedPrompt, ttl?: number): Promise<void> {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttl || this.DEFAULT_TTL),
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}
```

### 2.6 服務工廠

```typescript
// src/services/prompt-resolver.factory.ts

/**
 * @fileoverview Prompt 解析服務工廠
 * @module src/services/prompt-resolver.factory
 * @since Epic 14 - Story 14.3
 */

import { PrismaClient } from '@prisma/client';
import { PromptResolverService } from './prompt-resolver.service';
import { PromptVariableEngine } from './prompt-variable-engine.service';
import { PromptMergeEngine } from './prompt-merge-engine.service';
import { PromptCache } from './prompt-cache.service';

let instance: PromptResolverService | null = null;

export function getPromptResolver(prisma: PrismaClient): PromptResolverService {
  if (!instance) {
    const variableEngine = new PromptVariableEngine(prisma);
    const mergeEngine = new PromptMergeEngine();
    const cache = new PromptCache();
    instance = new PromptResolverService(prisma, variableEngine, mergeEngine, cache);
  }
  return instance;
}

export function resetPromptResolver(): void {
  instance = null;
}
```

---

## 3. 使用範例

```typescript
import { getPromptResolver } from '@/services/prompt-resolver.factory';
import { PromptType } from '@prisma/client';
import prisma from '@/lib/prisma';

const resolver = getPromptResolver(prisma);

// 解析術語分類 Prompt
const resolved = await resolver.resolve({
  promptType: PromptType.TERM_CLASSIFICATION,
  companyId: 'company-dhl-123',
  documentFormatId: 'format-express-invoice-456',
  contextVariables: { documentId: 'doc-789', pageNumber: 1 },
});

console.log(resolved.systemPrompt);       // 最終合併的 System Prompt
console.log(resolved.appliedLayers);      // 應用的配置層級
console.log(resolved.replacedVariables);  // 替換的變數列表
```

---

## 4. 效能考量

### 4.1 快取策略

| 快取類型 | TTL | 失效觸發 |
|----------|-----|----------|
| 解析結果 | 5 分鐘 | 配置更新、手動清除 |
| 變數值 | 1 分鐘 | 資料變更 |

### 4.2 效能目標

| 指標 | 目標 | 說明 |
|------|------|------|
| 快取命中解析 | < 5ms | 直接返回快取結果 |
| 完整解析 | < 50ms | 查詢 + 合併 + 變數替換 |
| 變數替換 | < 20ms | 包含動態查詢 |

---

## 5. 錯誤處理

```typescript
// src/lib/errors/prompt-resolution-errors.ts

export class PromptResolutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PromptResolutionError';
  }
}

export class NoGlobalPromptError extends PromptResolutionError {
  constructor(promptType: string) {
    super(`No global prompt found for type: ${promptType}`, 'NO_GLOBAL_PROMPT', { promptType });
  }
}

export class VariableResolutionError extends PromptResolutionError {
  constructor(variableName: string, reason: string) {
    super(`Failed to resolve variable: ${variableName}`, 'VARIABLE_RESOLUTION_FAILED', { variableName, reason });
  }
}
```

---

## 6. 測試計劃

### 6.1 單元測試

```typescript
describe('PromptResolverService', () => {
  describe('resolve', () => {
    it('should return global prompt when no company/format config', async () => {});
    it('should merge company prompt with global using APPEND', async () => {});
    it('should merge format prompt with company using OVERRIDE', async () => {});
    it('should replace static variables', async () => {});
    it('should replace dynamic variables', async () => {});
    it('should use cache on second call', async () => {});
  });
});

describe('PromptMergeEngine', () => {
  describe('merge', () => {
    it('should override with OVERRIDE strategy', () => {});
    it('should append with APPEND strategy', () => {});
    it('should prepend with PREPEND strategy', () => {});
  });
});

describe('PromptVariableEngine', () => {
  describe('replace', () => {
    it('should replace known variables', async () => {});
    it('should preserve unknown variables', async () => {});
  });
});
```

---

## 7. 依賴關係

```
Story 14.3 依賴:
├── Story 14.1 (PromptConfig 模型)
└── 現有服務: prisma

Story 14.3 被依賴:
└── Story 14.4 (GPT Vision 整合)
```

---

*Tech Spec 建立日期: 2026-01-02*
*版本: 1.0.0*
