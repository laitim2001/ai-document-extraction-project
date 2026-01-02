# Story 14-3: Prompt 解析與合併服務

> **Epic**: Epic 14 - Prompt 配置與動態生成
> **Story Points**: 8
> **Priority**: High
> **Status**: Backlog

---

## 📋 User Story

**As a** 系統
**I want** 能夠解析和合併多層級的 Prompt 配置
**So that** 最終生成的 Prompt 能結合全域、公司、格式級別的配置

---

## 🎯 Acceptance Criteria

### AC 14-3-1: Prompt 配置鏈解析
- [ ] 能夠按優先級載入配置：Specific > Format > Company > Global
- [ ] 支援配置繼承和覆蓋機制
- [ ] 在缺少上層配置時優雅降級
- [ ] 記錄配置解析過程用於除錯

### AC 14-3-2: Prompt 合併策略
- [ ] 實現 OVERRIDE 策略：高優先級完全覆蓋低優先級
- [ ] 實現 APPEND 策略：高優先級附加在低優先級後面
- [ ] 實現 PREPEND 策略：高優先級插入在低優先級前面
- [ ] 每個 PromptType 可獨立配置合併策略

### AC 14-3-3: 變數替換引擎
- [ ] 支援 `{{variableName}}` 語法的變數佔位符
- [ ] 提供預設變數集（documentType, companyName, formatName 等）
- [ ] 支援自定義變數注入
- [ ] 處理未定義變數時提供有意義的錯誤訊息

### AC 14-3-4: Prompt 引擎整合
- [ ] 提供統一的 `resolvePrompt(type, context)` 方法
- [ ] 返回完整解析後的 Prompt 字串
- [ ] 支援快取以提升效能
- [ ] 提供解析結果的元資料（使用的配置層級等）

---

## 🏗️ Technical Design

### 服務架構

```
src/services/prompt-engine/
├── prompt-resolution.service.ts     # 配置鏈解析服務
├── prompt-merge.service.ts          # Prompt 合併服務
├── prompt-variable.service.ts       # 變數替換服務
├── prompt-engine.service.ts         # 統一引擎服務
├── types.ts                         # 類型定義
└── index.ts                         # 模組導出
```

### 類型定義

```typescript
// src/services/prompt-engine/types.ts

/**
 * 配置層級優先級（數字越高優先級越高）
 */
export enum ConfigLevel {
  GLOBAL = 1,
  COMPANY = 2,
  FORMAT = 3,
  SPECIFIC = 4,
}

/**
 * 合併策略
 */
export enum MergeStrategy {
  OVERRIDE = 'OVERRIDE',   // 高優先級完全覆蓋
  APPEND = 'APPEND',       // 高優先級附加在後
  PREPEND = 'PREPEND',     // 高優先級插入在前
}

/**
 * Prompt 類型
 */
export enum PromptType {
  ISSUER_IDENTIFICATION = 'ISSUER_IDENTIFICATION',
  TERM_CLASSIFICATION = 'TERM_CLASSIFICATION',
  FIELD_EXTRACTION = 'FIELD_EXTRACTION',
  VALIDATION = 'VALIDATION',
}

/**
 * 解析上下文
 */
export interface ResolutionContext {
  companyId?: string;
  documentFormatId?: string;
  documentType?: string;
  additionalVariables?: Record<string, string>;
}

/**
 * 配置項目
 */
export interface PromptConfigItem {
  id: string;
  level: ConfigLevel;
  promptType: PromptType;
  promptTemplate: string;
  mergeStrategy: MergeStrategy;
  variables?: Record<string, string>;
}

/**
 * 解析結果
 */
export interface ResolvedPrompt {
  promptType: PromptType;
  finalPrompt: string;
  usedConfigs: Array<{
    configId: string;
    level: ConfigLevel;
    mergeStrategy: MergeStrategy;
  }>;
  variables: Record<string, string>;
  resolvedAt: Date;
}
```

### Prompt 配置鏈解析服務

```typescript
// src/services/prompt-engine/prompt-resolution.service.ts

/**
 * @fileoverview Prompt 配置鏈解析服務
 * @description
 *   負責按優先級載入和排序 Prompt 配置
 *   支援 Global > Company > Format > Specific 四層繼承
 *
 * @module src/services/prompt-engine/prompt-resolution
 * @since Epic 14 - Story 14-3
 */

import { prisma } from '@/lib/prisma';
import {
  ConfigLevel,
  PromptType,
  ResolutionContext,
  PromptConfigItem
} from './types';

export class PromptResolutionService {
  /**
   * 解析配置鏈
   * @description 按優先級載入所有相關配置
   */
  async resolveConfigChain(
    promptType: PromptType,
    context: ResolutionContext
  ): Promise<PromptConfigItem[]> {
    const { companyId, documentFormatId } = context;

    const configs = await prisma.promptConfig.findMany({
      where: {
        promptType,
        isActive: true,
        OR: [
          // Global 配置
          { companyId: null, documentFormatId: null },
          // Company 配置
          { companyId, documentFormatId: null },
          // Format 配置
          { documentFormatId },
          // Specific 配置 (Company + Format)
          { companyId, documentFormatId },
        ],
      },
      orderBy: { priority: 'asc' },
    });

    return configs.map(config => ({
      id: config.id,
      level: this.determineLevel(config),
      promptType: config.promptType as PromptType,
      promptTemplate: config.promptTemplate,
      mergeStrategy: config.mergeStrategy as MergeStrategy,
      variables: config.variables as Record<string, string>,
    }));
  }

  /**
   * 判斷配置層級
   */
  private determineLevel(config: {
    companyId: string | null;
    documentFormatId: string | null;
  }): ConfigLevel {
    if (config.companyId && config.documentFormatId) {
      return ConfigLevel.SPECIFIC;
    }
    if (config.documentFormatId) {
      return ConfigLevel.FORMAT;
    }
    if (config.companyId) {
      return ConfigLevel.COMPANY;
    }
    return ConfigLevel.GLOBAL;
  }

  /**
   * 按層級排序配置（優先級由低到高）
   */
  sortByLevel(configs: PromptConfigItem[]): PromptConfigItem[] {
    return [...configs].sort((a, b) => a.level - b.level);
  }
}
```

### Prompt 合併服務

```typescript
// src/services/prompt-engine/prompt-merge.service.ts

/**
 * @fileoverview Prompt 合併服務
 * @description
 *   實現三種合併策略：OVERRIDE, APPEND, PREPEND
 *   按優先級由低到高依序合併配置
 *
 * @module src/services/prompt-engine/prompt-merge
 * @since Epic 14 - Story 14-3
 */

import { MergeStrategy, PromptConfigItem } from './types';

export class PromptMergeService {
  private readonly separator = '\n\n';

  /**
   * 合併多個配置項目
   * @description 按順序應用合併策略
   */
  merge(configs: PromptConfigItem[]): string {
    if (configs.length === 0) return '';
    if (configs.length === 1) return configs[0].promptTemplate;

    let result = '';

    for (const config of configs) {
      result = this.applyStrategy(
        result,
        config.promptTemplate,
        config.mergeStrategy
      );
    }

    return result.trim();
  }

  /**
   * 應用合併策略
   */
  private applyStrategy(
    existing: string,
    incoming: string,
    strategy: MergeStrategy
  ): string {
    switch (strategy) {
      case MergeStrategy.OVERRIDE:
        return incoming;

      case MergeStrategy.APPEND:
        return existing
          ? `${existing}${this.separator}${incoming}`
          : incoming;

      case MergeStrategy.PREPEND:
        return existing
          ? `${incoming}${this.separator}${existing}`
          : incoming;

      default:
        return incoming;
    }
  }
}
```

### 變數替換服務

```typescript
// src/services/prompt-engine/prompt-variable.service.ts

/**
 * @fileoverview Prompt 變數替換服務
 * @description
 *   處理 {{variableName}} 格式的變數佔位符
 *   提供預設變數集和自定義變數支援
 *
 * @module src/services/prompt-engine/prompt-variable
 * @since Epic 14 - Story 14-3
 */

import { ResolutionContext } from './types';

export class PromptVariableService {
  private readonly variablePattern = /\{\{(\w+)\}\}/g;

  /**
   * 預設變數集
   */
  private readonly defaultVariables: Record<string, string> = {
    currentDate: new Date().toISOString().split('T')[0],
    currentYear: new Date().getFullYear().toString(),
    systemVersion: '1.0.0',
  };

  /**
   * 替換變數
   */
  substitute(
    template: string,
    context: ResolutionContext,
    additionalVars: Record<string, string> = {}
  ): { result: string; usedVariables: Record<string, string> } {
    const variables = this.buildVariableMap(context, additionalVars);
    const usedVariables: Record<string, string> = {};
    const missingVariables: string[] = [];

    const result = template.replace(
      this.variablePattern,
      (match, varName) => {
        if (varName in variables) {
          usedVariables[varName] = variables[varName];
          return variables[varName];
        }
        missingVariables.push(varName);
        return match; // 保留未替換的變數
      }
    );

    if (missingVariables.length > 0) {
      console.warn(
        `[PromptVariable] Missing variables: ${missingVariables.join(', ')}`
      );
    }

    return { result, usedVariables };
  }

  /**
   * 建立變數映射表
   */
  private buildVariableMap(
    context: ResolutionContext,
    additionalVars: Record<string, string>
  ): Record<string, string> {
    return {
      ...this.defaultVariables,
      companyId: context.companyId || '',
      documentFormatId: context.documentFormatId || '',
      documentType: context.documentType || '',
      ...context.additionalVariables,
      ...additionalVars,
    };
  }

  /**
   * 提取模板中的變數名稱
   */
  extractVariableNames(template: string): string[] {
    const matches = template.matchAll(this.variablePattern);
    return Array.from(matches).map(m => m[1]);
  }
}
```

### Prompt 引擎服務

```typescript
// src/services/prompt-engine/prompt-engine.service.ts

/**
 * @fileoverview Prompt 引擎服務
 * @description
 *   統一的 Prompt 解析和生成入口
 *   整合配置解析、合併和變數替換功能
 *
 * @module src/services/prompt-engine/prompt-engine
 * @since Epic 14 - Story 14-3
 */

import { PromptResolutionService } from './prompt-resolution.service';
import { PromptMergeService } from './prompt-merge.service';
import { PromptVariableService } from './prompt-variable.service';
import {
  PromptType,
  ResolutionContext,
  ResolvedPrompt
} from './types';

export class PromptEngineService {
  private resolutionService: PromptResolutionService;
  private mergeService: PromptMergeService;
  private variableService: PromptVariableService;

  // 簡單的記憶體快取
  private cache: Map<string, { prompt: ResolvedPrompt; expiry: number }>;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 分鐘

  constructor() {
    this.resolutionService = new PromptResolutionService();
    this.mergeService = new PromptMergeService();
    this.variableService = new PromptVariableService();
    this.cache = new Map();
  }

  /**
   * 解析 Prompt
   * @description 統一入口，完成配置解析、合併和變數替換
   */
  async resolvePrompt(
    promptType: PromptType,
    context: ResolutionContext,
    options: { skipCache?: boolean } = {}
  ): Promise<ResolvedPrompt> {
    const cacheKey = this.buildCacheKey(promptType, context);

    // 檢查快取
    if (!options.skipCache) {
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
    }

    // 1. 解析配置鏈
    const configs = await this.resolutionService.resolveConfigChain(
      promptType,
      context
    );

    // 2. 排序配置
    const sortedConfigs = this.resolutionService.sortByLevel(configs);

    // 3. 合併 Prompt
    const mergedTemplate = this.mergeService.merge(sortedConfigs);

    // 4. 變數替換
    const { result: finalPrompt, usedVariables } =
      this.variableService.substitute(mergedTemplate, context);

    // 5. 建立結果
    const resolved: ResolvedPrompt = {
      promptType,
      finalPrompt,
      usedConfigs: sortedConfigs.map(c => ({
        configId: c.id,
        level: c.level,
        mergeStrategy: c.mergeStrategy,
      })),
      variables: usedVariables,
      resolvedAt: new Date(),
    };

    // 6. 儲存快取
    this.setCache(cacheKey, resolved);

    return resolved;
  }

  /**
   * 解析多個 Prompt 類型
   */
  async resolveMultiple(
    promptTypes: PromptType[],
    context: ResolutionContext
  ): Promise<Map<PromptType, ResolvedPrompt>> {
    const results = new Map<PromptType, ResolvedPrompt>();

    await Promise.all(
      promptTypes.map(async (type) => {
        const resolved = await this.resolvePrompt(type, context);
        results.set(type, resolved);
      })
    );

    return results;
  }

  /**
   * 清除快取
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  private buildCacheKey(
    promptType: PromptType,
    context: ResolutionContext
  ): string {
    return `${promptType}:${context.companyId || ''}:${context.documentFormatId || ''}`;
  }

  private getCached(key: string): ResolvedPrompt | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.prompt;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, prompt: ResolvedPrompt): void {
    this.cache.set(key, {
      prompt,
      expiry: Date.now() + this.cacheTTL,
    });
  }
}

// 單例導出
export const promptEngine = new PromptEngineService();
```

### 模組導出

```typescript
// src/services/prompt-engine/index.ts

export * from './types';
export * from './prompt-resolution.service';
export * from './prompt-merge.service';
export * from './prompt-variable.service';
export * from './prompt-engine.service';
```

---

## 📊 Database Schema

### PromptConfig 模型擴展

```prisma
// prisma/schema.prisma

model PromptConfig {
  id               String   @id @default(cuid())

  // 配置範圍
  companyId        String?  @map("company_id")
  documentFormatId String?  @map("document_format_id")

  // Prompt 配置
  promptType       String   @map("prompt_type")
  promptTemplate   String   @map("prompt_template") @db.Text
  mergeStrategy    String   @default("OVERRIDE") @map("merge_strategy")
  priority         Int      @default(0)

  // 變數
  variables        Json?

  // 狀態
  isActive         Boolean  @default(true) @map("is_active")

  // 審計
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")
  createdBy        String?  @map("created_by")

  // 關聯
  company          Company?        @relation(fields: [companyId], references: [id])
  documentFormat   DocumentFormat? @relation(fields: [documentFormatId], references: [id])

  @@unique([companyId, documentFormatId, promptType])
  @@index([promptType])
  @@index([companyId])
  @@index([documentFormatId])
  @@map("prompt_configs")
}
```

---

## 🧪 Testing Strategy

### 單元測試

```typescript
// tests/unit/services/prompt-engine/prompt-merge.test.ts

import { PromptMergeService } from '@/services/prompt-engine';
import { MergeStrategy, ConfigLevel, PromptType } from '@/services/prompt-engine/types';

describe('PromptMergeService', () => {
  let service: PromptMergeService;

  beforeEach(() => {
    service = new PromptMergeService();
  });

  describe('merge', () => {
    it('should return empty string for empty configs', () => {
      expect(service.merge([])).toBe('');
    });

    it('should return single config template as-is', () => {
      const configs = [{
        id: '1',
        level: ConfigLevel.GLOBAL,
        promptType: PromptType.ISSUER_IDENTIFICATION,
        promptTemplate: 'Global prompt',
        mergeStrategy: MergeStrategy.OVERRIDE,
      }];

      expect(service.merge(configs)).toBe('Global prompt');
    });

    it('should override with OVERRIDE strategy', () => {
      const configs = [
        {
          id: '1',
          level: ConfigLevel.GLOBAL,
          promptType: PromptType.ISSUER_IDENTIFICATION,
          promptTemplate: 'Global prompt',
          mergeStrategy: MergeStrategy.OVERRIDE,
        },
        {
          id: '2',
          level: ConfigLevel.COMPANY,
          promptType: PromptType.ISSUER_IDENTIFICATION,
          promptTemplate: 'Company prompt',
          mergeStrategy: MergeStrategy.OVERRIDE,
        },
      ];

      expect(service.merge(configs)).toBe('Company prompt');
    });

    it('should append with APPEND strategy', () => {
      const configs = [
        {
          id: '1',
          level: ConfigLevel.GLOBAL,
          promptType: PromptType.ISSUER_IDENTIFICATION,
          promptTemplate: 'Global prompt',
          mergeStrategy: MergeStrategy.OVERRIDE,
        },
        {
          id: '2',
          level: ConfigLevel.COMPANY,
          promptType: PromptType.ISSUER_IDENTIFICATION,
          promptTemplate: 'Company addition',
          mergeStrategy: MergeStrategy.APPEND,
        },
      ];

      expect(service.merge(configs)).toContain('Global prompt');
      expect(service.merge(configs)).toContain('Company addition');
    });
  });
});
```

### 整合測試

```typescript
// tests/integration/services/prompt-engine.test.ts

import { promptEngine, PromptType } from '@/services/prompt-engine';

describe('PromptEngineService Integration', () => {
  describe('resolvePrompt', () => {
    it('should resolve prompt with global config only', async () => {
      const result = await promptEngine.resolvePrompt(
        PromptType.ISSUER_IDENTIFICATION,
        {}
      );

      expect(result.finalPrompt).toBeTruthy();
      expect(result.usedConfigs.length).toBeGreaterThan(0);
    });

    it('should merge company-level config', async () => {
      const result = await promptEngine.resolvePrompt(
        PromptType.ISSUER_IDENTIFICATION,
        { companyId: 'test-company-id' }
      );

      expect(result.usedConfigs.some(
        c => c.level === 2 // ConfigLevel.COMPANY
      )).toBe(true);
    });
  });
});
```

---

## 📁 Files to Create/Modify

### New Files
| File | Description |
|------|-------------|
| `src/services/prompt-engine/types.ts` | 類型定義 |
| `src/services/prompt-engine/prompt-resolution.service.ts` | 配置解析服務 |
| `src/services/prompt-engine/prompt-merge.service.ts` | 合併服務 |
| `src/services/prompt-engine/prompt-variable.service.ts` | 變數替換服務 |
| `src/services/prompt-engine/prompt-engine.service.ts` | 統一引擎 |
| `src/services/prompt-engine/index.ts` | 模組導出 |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | 添加 PromptConfig 索引 |
| `src/services/index.ts` | 導出 prompt-engine 模組 |

---

## 🔗 Dependencies

### Upstream
- **Story 14-1**: PromptConfig 資料模型
- **Story 14-2**: Prompt 配置 UI（配置來源）

### Downstream
- **Story 14-4**: GPT Vision 服務整合（消費 resolvePrompt）
- **Story 15-3**: 格式匹配動態配置（整合使用）

---

## 📝 Implementation Notes

### 效能考量
- 使用記憶體快取減少資料庫查詢
- 快取 TTL 設為 5 分鐘，平衡即時性和效能
- 支援批次解析多個 Prompt 類型

### 合併策略選擇
- `OVERRIDE`: 適用於需要完全替換的場景（如特定公司專用 prompt）
- `APPEND`: 適用於需要補充說明的場景（如額外指示）
- `PREPEND`: 適用於需要優先處理的指示

### 變數處理
- 支援 `{{variableName}}` 格式
- 未定義變數會保留原樣並記錄警告
- 提供預設變數集（日期、版本等）

---

## ✅ Definition of Done

- [ ] 所有 Acceptance Criteria 通過
- [ ] 配置鏈解析正確（四層優先級）
- [ ] 三種合併策略實現正確
- [ ] 變數替換功能完整
- [ ] 單元測試覆蓋率 > 80%
- [ ] 整合測試通過
- [ ] 程式碼審查通過
- [ ] 文檔更新完成

---

*Created: 2026-01-02*
*Epic: 14 - Prompt 配置與動態生成*
