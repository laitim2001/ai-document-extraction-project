# Story 15-3: 格式匹配與動態配置

## Story 資訊

| 項目 | 內容 |
|------|------|
| **Story ID** | 15-3 |
| **Epic** | Epic 15 - 統一 3 層機制到日常處理流程 |
| **標題** | 格式匹配與動態配置 |
| **估點** | 5 點 |
| **優先級** | High |
| **狀態** | Backlog |

---

## User Story

**As a** 文件處理系統
**I want to** 根據識別的 Company 自動匹配或創建 DocumentFormat，並動態獲取相應的配置
**So that** 每個文件都能使用最適合的欄位映射和 Prompt 配置進行處理

---

## 驗收標準 (Acceptance Criteria)

### AC1: 格式匹配
- [ ] 系統能根據 companyId 和文件特徵（如抬頭、佈局）匹配現有的 DocumentFormat
- [ ] 支援多種匹配策略：精確匹配、模糊匹配、特徵匹配
- [ ] 匹配信心度 > 80% 時自動使用，否則創建新格式

### AC2: 格式創建
- [ ] 當無法匹配現有格式時，自動創建新的 DocumentFormat
- [ ] 新格式繼承 Company 的預設配置
- [ ] 記錄格式創建的來源和初始特徵

### AC3: 動態配置獲取
- [ ] 整合 Epic 13 的欄位映射配置
- [ ] 整合 Epic 14 的 Prompt 配置
- [ ] 配置解析遵循層級繼承規則

### AC4: 統一處理器整合
- [ ] 實現 FormatMatchingStep 和 ConfigResolutionStep
- [ ] 正確更新 ProcessingContext
- [ ] 支援功能開關控制

---

## 技術設計

### 1. 核心服務

#### 1.1 FormatMatchingService

```typescript
// src/services/format-matching.service.ts

/**
 * @fileoverview 文件格式匹配服務
 * @description
 *   負責根據文件特徵和發行者信息匹配或創建 DocumentFormat
 *   支援多種匹配策略和自動格式創建
 *
 * @module src/services/format-matching
 * @since Epic 15 - Story 15.3
 */

import { prisma } from '@/lib/prisma';
import { DocumentFormat, Prisma } from '@prisma/client';
import { ProcessingContext } from '@/types/processing';

interface MatchResult {
  format: DocumentFormat | null;
  confidence: number;
  matchMethod: 'EXACT' | 'FUZZY' | 'FEATURE' | 'NEW';
  matchDetails?: {
    matchedFields: string[];
    score: number;
  };
}

interface DocumentFeatures {
  headerText?: string;
  logoSignature?: string;
  layoutPattern?: string;
  fieldPositions?: Record<string, { x: number; y: number }>;
  detectedFields?: string[];
}

export class FormatMatchingService {
  private readonly confidenceThreshold = 0.8;

  /**
   * 匹配或創建 DocumentFormat
   *
   * @param companyId - 識別的公司 ID
   * @param features - 文件特徵
   * @param context - 處理上下文
   * @returns 匹配結果
   */
  async matchOrCreateFormat(
    companyId: string,
    features: DocumentFeatures,
    context: ProcessingContext
  ): Promise<MatchResult> {
    // 1. 嘗試精確匹配
    const exactMatch = await this.tryExactMatch(companyId, features);
    if (exactMatch.confidence >= this.confidenceThreshold) {
      return exactMatch;
    }

    // 2. 嘗試模糊匹配
    const fuzzyMatch = await this.tryFuzzyMatch(companyId, features);
    if (fuzzyMatch.confidence >= this.confidenceThreshold) {
      return fuzzyMatch;
    }

    // 3. 嘗試特徵匹配
    const featureMatch = await this.tryFeatureMatch(companyId, features);
    if (featureMatch.confidence >= this.confidenceThreshold) {
      return featureMatch;
    }

    // 4. 創建新格式
    const newFormat = await this.createNewFormat(companyId, features, context);
    return {
      format: newFormat,
      confidence: 1.0,
      matchMethod: 'NEW',
    };
  }

  /**
   * 精確匹配 - 基於 headerText 和 logoSignature
   */
  private async tryExactMatch(
    companyId: string,
    features: DocumentFeatures
  ): Promise<MatchResult> {
    if (!features.headerText && !features.logoSignature) {
      return { format: null, confidence: 0, matchMethod: 'EXACT' };
    }

    const formats = await prisma.documentFormat.findMany({
      where: {
        companyId,
        OR: [
          features.headerText
            ? { headerPattern: features.headerText }
            : undefined,
          features.logoSignature
            ? { logoSignature: features.logoSignature }
            : undefined,
        ].filter(Boolean) as Prisma.DocumentFormatWhereInput[],
      },
    });

    if (formats.length === 0) {
      return { format: null, confidence: 0, matchMethod: 'EXACT' };
    }

    // 計算最佳匹配
    let bestMatch: DocumentFormat | null = null;
    let bestScore = 0;

    for (const format of formats) {
      let score = 0;
      const matchedFields: string[] = [];

      if (format.headerPattern === features.headerText) {
        score += 0.5;
        matchedFields.push('headerPattern');
      }
      if (format.logoSignature === features.logoSignature) {
        score += 0.5;
        matchedFields.push('logoSignature');
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = format;
      }
    }

    return {
      format: bestMatch,
      confidence: bestScore,
      matchMethod: 'EXACT',
      matchDetails: { matchedFields: [], score: bestScore },
    };
  }

  /**
   * 模糊匹配 - 使用相似度計算
   */
  private async tryFuzzyMatch(
    companyId: string,
    features: DocumentFeatures
  ): Promise<MatchResult> {
    const formats = await prisma.documentFormat.findMany({
      where: { companyId },
    });

    if (formats.length === 0) {
      return { format: null, confidence: 0, matchMethod: 'FUZZY' };
    }

    let bestMatch: DocumentFormat | null = null;
    let bestScore = 0;

    for (const format of formats) {
      const score = this.calculateSimilarity(format, features);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = format;
      }
    }

    return {
      format: bestMatch,
      confidence: bestScore,
      matchMethod: 'FUZZY',
    };
  }

  /**
   * 特徵匹配 - 基於佈局和欄位位置
   */
  private async tryFeatureMatch(
    companyId: string,
    features: DocumentFeatures
  ): Promise<MatchResult> {
    if (!features.layoutPattern && !features.detectedFields) {
      return { format: null, confidence: 0, matchMethod: 'FEATURE' };
    }

    const formats = await prisma.documentFormat.findMany({
      where: {
        companyId,
        // 只考慮有特徵數據的格式
        OR: [
          { layoutPattern: { not: null } },
          { detectedFields: { not: Prisma.DbNull } },
        ],
      },
    });

    let bestMatch: DocumentFormat | null = null;
    let bestScore = 0;

    for (const format of formats) {
      let score = 0;

      // 佈局模式匹配
      if (format.layoutPattern && features.layoutPattern) {
        score += this.compareLayoutPatterns(
          format.layoutPattern,
          features.layoutPattern
        ) * 0.4;
      }

      // 檢測欄位匹配
      if (format.detectedFields && features.detectedFields) {
        const formatFields = format.detectedFields as string[];
        const matchedCount = features.detectedFields.filter(
          f => formatFields.includes(f)
        ).length;
        score += (matchedCount / Math.max(formatFields.length, features.detectedFields.length)) * 0.6;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = format;
      }
    }

    return {
      format: bestMatch,
      confidence: bestScore,
      matchMethod: 'FEATURE',
    };
  }

  /**
   * 創建新的 DocumentFormat
   */
  private async createNewFormat(
    companyId: string,
    features: DocumentFeatures,
    context: ProcessingContext
  ): Promise<DocumentFormat> {
    // 獲取公司信息
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    // 生成格式名稱
    const formatCount = await prisma.documentFormat.count({
      where: { companyId },
    });
    const formatName = `${company?.name || 'Unknown'} Format ${formatCount + 1}`;

    // 創建新格式
    return prisma.documentFormat.create({
      data: {
        companyId,
        name: formatName,
        description: `Auto-created from file: ${context.fileName}`,
        headerPattern: features.headerText,
        logoSignature: features.logoSignature,
        layoutPattern: features.layoutPattern,
        detectedFields: features.detectedFields || [],
        createdBy: 'SYSTEM',
        isAutoCreated: true,
        sourceFileId: context.fileId,
      },
    });
  }

  /**
   * 計算格式與特徵的相似度
   */
  private calculateSimilarity(
    format: DocumentFormat,
    features: DocumentFeatures
  ): number {
    let totalScore = 0;
    let factors = 0;

    // Header 相似度
    if (format.headerPattern && features.headerText) {
      totalScore += this.stringSimilarity(format.headerPattern, features.headerText);
      factors++;
    }

    // Logo 相似度
    if (format.logoSignature && features.logoSignature) {
      totalScore += format.logoSignature === features.logoSignature ? 1 : 0;
      factors++;
    }

    return factors > 0 ? totalScore / factors : 0;
  }

  /**
   * 字串相似度（Levenshtein distance based）
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 比較佈局模式
   */
  private compareLayoutPatterns(pattern1: string, pattern2: string): number {
    // 簡化的佈局比較 - 可擴展為更複雜的模式匹配
    return this.stringSimilarity(pattern1, pattern2);
  }
}

export const formatMatchingService = new FormatMatchingService();
```

#### 1.2 ConfigResolutionService

```typescript
// src/services/config-resolution.service.ts

/**
 * @fileoverview 動態配置解析服務
 * @description
 *   整合 Epic 13 (欄位映射) 和 Epic 14 (Prompt 配置) 的配置獲取
 *   提供統一的配置解析介面
 *
 * @module src/services/config-resolution
 * @since Epic 15 - Story 15.3
 */

import { prisma } from '@/lib/prisma';
import { ProcessingContext } from '@/types/processing';
import { promptResolutionService } from './prompt-resolution.service';
import { PromptType } from '@prisma/client';

interface ResolvedConfig {
  // 欄位映射配置
  fieldMappingConfig: FieldMappingConfig | null;

  // Prompt 配置
  promptConfigs: Map<PromptType, ResolvedPromptConfig>;

  // 配置層級資訊
  configLevel: 'SPECIFIC' | 'COMPANY' | 'FORMAT' | 'GLOBAL' | 'DEFAULT';

  // 解析時間
  resolvedAt: Date;
}

interface FieldMappingConfig {
  id: string;
  name: string;
  mappings: FieldMapping[];
  scope: string;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformationType?: string;
  defaultValue?: string;
}

interface ResolvedPromptConfig {
  type: PromptType;
  systemPrompt: string;
  userPromptTemplate: string;
  configChain: string[];
}

export class ConfigResolutionService {
  /**
   * 解析完整配置
   *
   * @param context - 處理上下文
   * @returns 解析後的配置
   */
  async resolveConfig(context: ProcessingContext): Promise<ResolvedConfig> {
    const { identifiedCompanyId, documentFormatId } = context;

    // 1. 解析欄位映射配置
    const fieldMappingConfig = await this.resolveFieldMappingConfig(
      identifiedCompanyId,
      documentFormatId
    );

    // 2. 解析 Prompt 配置
    const promptConfigs = await this.resolvePromptConfigs(context);

    // 3. 確定配置層級
    const configLevel = this.determineConfigLevel(
      identifiedCompanyId,
      documentFormatId,
      fieldMappingConfig
    );

    return {
      fieldMappingConfig,
      promptConfigs,
      configLevel,
      resolvedAt: new Date(),
    };
  }

  /**
   * 解析欄位映射配置
   */
  private async resolveFieldMappingConfig(
    companyId?: string,
    formatId?: string
  ): Promise<FieldMappingConfig | null> {
    // 嘗試按優先級獲取配置

    // 1. Specific (Company + Format)
    if (companyId && formatId) {
      const specific = await prisma.fieldMappingConfig.findFirst({
        where: {
          companyId,
          documentFormatId: formatId,
          isActive: true,
        },
        include: { mappings: true },
      });
      if (specific) {
        return this.transformFieldMappingConfig(specific, 'SPECIFIC');
      }
    }

    // 2. Format only
    if (formatId) {
      const formatConfig = await prisma.fieldMappingConfig.findFirst({
        where: {
          documentFormatId: formatId,
          companyId: null,
          isActive: true,
        },
        include: { mappings: true },
      });
      if (formatConfig) {
        return this.transformFieldMappingConfig(formatConfig, 'FORMAT');
      }
    }

    // 3. Company only
    if (companyId) {
      const companyConfig = await prisma.fieldMappingConfig.findFirst({
        where: {
          companyId,
          documentFormatId: null,
          isActive: true,
        },
        include: { mappings: true },
      });
      if (companyConfig) {
        return this.transformFieldMappingConfig(companyConfig, 'COMPANY');
      }
    }

    // 4. Global
    const globalConfig = await prisma.fieldMappingConfig.findFirst({
      where: {
        companyId: null,
        documentFormatId: null,
        isGlobal: true,
        isActive: true,
      },
      include: { mappings: true },
    });
    if (globalConfig) {
      return this.transformFieldMappingConfig(globalConfig, 'GLOBAL');
    }

    return null;
  }

  /**
   * 解析所有類型的 Prompt 配置
   */
  private async resolvePromptConfigs(
    context: ProcessingContext
  ): Promise<Map<PromptType, ResolvedPromptConfig>> {
    const types: PromptType[] = [
      'ISSUER_IDENTIFICATION',
      'TERM_CLASSIFICATION',
      'FIELD_EXTRACTION',
      'VALIDATION',
    ];

    const configs = new Map<PromptType, ResolvedPromptConfig>();

    await Promise.all(
      types.map(async (type) => {
        try {
          const resolved = await promptResolutionService.resolvePrompt(
            type,
            context
          );
          configs.set(type, {
            type,
            systemPrompt: resolved.systemPrompt,
            userPromptTemplate: resolved.userPromptTemplate,
            configChain: resolved.configChain.map(c => c.name),
          });
        } catch {
          // 某些類型可能沒有配置，忽略錯誤
        }
      })
    );

    return configs;
  }

  /**
   * 確定最終的配置層級
   */
  private determineConfigLevel(
    companyId?: string,
    formatId?: string,
    fieldMappingConfig?: FieldMappingConfig | null
  ): ResolvedConfig['configLevel'] {
    if (fieldMappingConfig) {
      return fieldMappingConfig.scope as ResolvedConfig['configLevel'];
    }

    if (companyId && formatId) {
      return 'SPECIFIC';
    }
    if (companyId) {
      return 'COMPANY';
    }
    if (formatId) {
      return 'FORMAT';
    }
    return 'DEFAULT';
  }

  /**
   * 轉換欄位映射配置格式
   */
  private transformFieldMappingConfig(
    config: any,
    scope: string
  ): FieldMappingConfig {
    return {
      id: config.id,
      name: config.name,
      scope,
      mappings: config.mappings.map((m: any) => ({
        sourceField: m.sourceField,
        targetField: m.targetField,
        transformationType: m.transformationType,
        defaultValue: m.defaultValue,
      })),
    };
  }
}

export const configResolutionService = new ConfigResolutionService();
```

#### 1.3 處理步驟實現

```typescript
// src/services/unified-processor/steps/format-matching-step.ts

/**
 * @fileoverview 格式匹配處理步驟
 * @module src/services/unified-processor/steps/format-matching-step
 * @since Epic 15 - Story 15.3
 */

import { ProcessingStep, ProcessingContext } from '@/types/processing';
import { formatMatchingService } from '@/services/format-matching.service';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

export class FormatMatchingStep implements ProcessingStep {
  readonly name = 'FormatMatching';
  readonly isOptional = true;

  async execute(context: ProcessingContext): Promise<void> {
    // 檢查功能開關
    if (!FEATURE_FLAGS.ENABLE_FORMAT_MATCHING) {
      return;
    }

    // 需要先有 Company 識別結果
    if (!context.identifiedCompanyId) {
      return;
    }

    // 構建文件特徵
    const features = this.extractFeatures(context);

    // 匹配或創建格式
    const result = await formatMatchingService.matchOrCreateFormat(
      context.identifiedCompanyId,
      features,
      context
    );

    // 更新上下文
    if (result.format) {
      context.documentFormatId = result.format.id;
      context.documentFormatName = result.format.name;
      context.formatConfidence = result.confidence;
      context.formatMatchMethod = result.matchMethod;
    }
  }

  /**
   * 從處理上下文中提取文件特徵
   */
  private extractFeatures(context: ProcessingContext) {
    // 從 Azure DI 或 GPT Vision 結果中提取特徵
    const azureResult = context.azureDIResult;
    const gptResult = context.gptVisionResult;

    return {
      headerText: gptResult?.issuerInfo?.headerText || azureResult?.documentTitle,
      logoSignature: gptResult?.issuerInfo?.logoSignature,
      layoutPattern: azureResult?.layoutPattern,
      detectedFields: azureResult?.fields?.map(f => f.name) || [],
    };
  }
}
```

```typescript
// src/services/unified-processor/steps/config-resolution-step.ts

/**
 * @fileoverview 配置解析處理步驟
 * @module src/services/unified-processor/steps/config-resolution-step
 * @since Epic 15 - Story 15.3
 */

import { ProcessingStep, ProcessingContext } from '@/types/processing';
import { configResolutionService } from '@/services/config-resolution.service';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

export class ConfigResolutionStep implements ProcessingStep {
  readonly name = 'ConfigResolution';
  readonly isOptional = true;

  async execute(context: ProcessingContext): Promise<void> {
    // 檢查功能開關
    if (!FEATURE_FLAGS.ENABLE_DYNAMIC_CONFIG) {
      return;
    }

    // 解析配置
    const config = await configResolutionService.resolveConfig(context);

    // 更新上下文
    if (config.fieldMappingConfig) {
      context.fieldMappingConfigId = config.fieldMappingConfig.id;
      context.fieldMappings = config.fieldMappingConfig.mappings;
    }

    context.promptConfigs = config.promptConfigs;
    context.configLevel = config.configLevel;
  }
}
```

### 2. 功能開關配置

```typescript
// src/lib/feature-flags.ts (更新)

export const FEATURE_FLAGS = {
  // 統一處理器
  ENABLE_UNIFIED_PROCESSOR: process.env.ENABLE_UNIFIED_PROCESSOR === 'true',

  // 各步驟開關
  ENABLE_ISSUER_IDENTIFICATION: process.env.ENABLE_ISSUER_IDENTIFICATION !== 'false',
  ENABLE_FORMAT_MATCHING: process.env.ENABLE_FORMAT_MATCHING !== 'false',
  ENABLE_DYNAMIC_CONFIG: process.env.ENABLE_DYNAMIC_CONFIG !== 'false',
  ENABLE_TERM_LEARNING: process.env.ENABLE_TERM_LEARNING !== 'false',
  ENABLE_ENHANCED_CONFIDENCE: process.env.ENABLE_ENHANCED_CONFIDENCE !== 'false',

  // 自動創建
  ENABLE_AUTO_CREATE_COMPANY: process.env.ENABLE_AUTO_CREATE_COMPANY !== 'false',
  ENABLE_AUTO_CREATE_FORMAT: process.env.ENABLE_AUTO_CREATE_FORMAT !== 'false',

  // 配置層級控制
  FORMAT_MATCHING_CONFIDENCE_THRESHOLD:
    Number(process.env.FORMAT_MATCHING_CONFIDENCE_THRESHOLD) || 0.8,
};
```

### 3. 類型定義更新

```typescript
// src/types/processing.ts (更新)

import { PromptType } from '@prisma/client';

export interface ProcessingContext {
  fileId: string;
  batchId?: string;
  fileName?: string;

  // 第 1 層: 文件類型
  fileType: 'NATIVE_PDF' | 'SCANNED_PDF' | 'IMAGE';
  processingMethod: 'DUAL_PROCESSING' | 'GPT_VISION';

  // 第 2 層: 發行者/格式
  identifiedCompanyId?: string;
  identifiedCompanyName?: string;
  documentFormatId?: string;
  documentFormatName?: string;
  issuerConfidence?: number;
  formatConfidence?: number;
  formatMatchMethod?: 'EXACT' | 'FUZZY' | 'FEATURE' | 'NEW';

  // 動態配置 (Story 15-3)
  fieldMappingConfigId?: string;
  fieldMappings?: FieldMapping[];
  promptConfigs?: Map<PromptType, ResolvedPromptConfig>;
  configLevel?: 'SPECIFIC' | 'COMPANY' | 'FORMAT' | 'GLOBAL' | 'DEFAULT';

  // 提取結果
  azureDIResult?: AzureDIResult;
  gptVisionResult?: GPTVisionResult;
  mappedData?: Record<string, unknown>;

  // 術語
  extractedTerms?: string[];
  newTerms?: string[];

  // 信心度
  overallConfidence?: number;
  routingDecision?: 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW';
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformationType?: string;
  defaultValue?: string;
}

interface ResolvedPromptConfig {
  type: PromptType;
  systemPrompt: string;
  userPromptTemplate: string;
  configChain: string[];
}
```

### 4. 單元測試

```typescript
// tests/unit/services/format-matching.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormatMatchingService } from '@/services/format-matching.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma');

describe('FormatMatchingService', () => {
  let service: FormatMatchingService;

  beforeEach(() => {
    service = new FormatMatchingService();
    vi.clearAllMocks();
  });

  describe('matchOrCreateFormat', () => {
    it('should return exact match when header matches', async () => {
      vi.mocked(prisma.documentFormat.findMany).mockResolvedValue([
        {
          id: 'format-1',
          name: 'DHL Invoice',
          companyId: 'company-1',
          headerPattern: 'DHL Express Invoice',
          logoSignature: null,
        },
      ]);

      const result = await service.matchOrCreateFormat(
        'company-1',
        { headerText: 'DHL Express Invoice' },
        { fileId: 'test-1' }
      );

      expect(result.matchMethod).toBe('EXACT');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.format?.id).toBe('format-1');
    });

    it('should create new format when no match found', async () => {
      vi.mocked(prisma.documentFormat.findMany).mockResolvedValue([]);
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: 'company-1',
        name: 'New Company',
      });
      vi.mocked(prisma.documentFormat.count).mockResolvedValue(0);
      vi.mocked(prisma.documentFormat.create).mockResolvedValue({
        id: 'new-format-1',
        name: 'New Company Format 1',
        companyId: 'company-1',
      });

      const result = await service.matchOrCreateFormat(
        'company-1',
        { headerText: 'Unknown Header' },
        { fileId: 'test-1', fileName: 'test.pdf' }
      );

      expect(result.matchMethod).toBe('NEW');
      expect(result.confidence).toBe(1.0);
      expect(prisma.documentFormat.create).toHaveBeenCalled();
    });

    it('should return fuzzy match when similarity is high', async () => {
      vi.mocked(prisma.documentFormat.findMany)
        .mockResolvedValueOnce([]) // exact match
        .mockResolvedValueOnce([
          {
            id: 'format-1',
            name: 'DHL Invoice',
            companyId: 'company-1',
            headerPattern: 'DHL Express Invoice',
          },
        ]); // fuzzy match

      const result = await service.matchOrCreateFormat(
        'company-1',
        { headerText: 'DHL Express Invocie' }, // typo
        { fileId: 'test-1' }
      );

      expect(result.matchMethod).toBe('FUZZY');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });
});

// tests/unit/services/config-resolution.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigResolutionService } from '@/services/config-resolution.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma');
vi.mock('@/services/prompt-resolution.service');

describe('ConfigResolutionService', () => {
  let service: ConfigResolutionService;

  beforeEach(() => {
    service = new ConfigResolutionService();
    vi.clearAllMocks();
  });

  describe('resolveConfig', () => {
    it('should resolve specific config when both company and format exist', async () => {
      vi.mocked(prisma.fieldMappingConfig.findFirst).mockResolvedValue({
        id: 'config-1',
        name: 'DHL Invoice Config',
        companyId: 'company-1',
        documentFormatId: 'format-1',
        mappings: [
          { sourceField: 'vendor', targetField: 'companyName' },
        ],
      });

      const result = await service.resolveConfig({
        fileId: 'test-1',
        identifiedCompanyId: 'company-1',
        documentFormatId: 'format-1',
      });

      expect(result.configLevel).toBe('SPECIFIC');
      expect(result.fieldMappingConfig).not.toBeNull();
    });

    it('should fallback to global config when no specific config exists', async () => {
      vi.mocked(prisma.fieldMappingConfig.findFirst)
        .mockResolvedValueOnce(null) // specific
        .mockResolvedValueOnce(null) // format
        .mockResolvedValueOnce(null) // company
        .mockResolvedValueOnce({
          id: 'global-config',
          name: 'Global Config',
          isGlobal: true,
          mappings: [],
        }); // global

      const result = await service.resolveConfig({
        fileId: 'test-1',
        identifiedCompanyId: 'company-1',
        documentFormatId: 'format-1',
      });

      expect(result.configLevel).toBe('GLOBAL');
    });
  });
});
```

---

## 依賴關係

### 前置依賴
- **Story 15-1**: 處理流程重構 - 統一入口（提供 ProcessingContext 和 Pipeline）
- **Story 15-2**: 發行者識別整合（提供 identifiedCompanyId）
- **Story 13-5**: 動態欄位映射服務（提供欄位映射配置結構）
- **Story 14-3**: Prompt 解析與合併服務（提供 Prompt 配置解析）

### 後續 Story
- **Story 15-4**: 持續術語學習（使用 documentFormatId 記錄術語）
- **Story 15-5**: 信心度計算增強（使用 configLevel 和 formatConfidence）

---

## Prisma Schema 更新

```prisma
// 新增 DocumentFormat 欄位
model DocumentFormat {
  id              String   @id @default(cuid())
  companyId       String   @map("company_id")
  name            String
  description     String?

  // 匹配特徵
  headerPattern   String?  @map("header_pattern")
  logoSignature   String?  @map("logo_signature")
  layoutPattern   String?  @map("layout_pattern")
  detectedFields  Json?    @map("detected_fields")

  // 元數據
  isAutoCreated   Boolean  @default(false) @map("is_auto_created")
  sourceFileId    String?  @map("source_file_id")
  createdBy       String   @map("created_by")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // 關聯
  company         Company  @relation(fields: [companyId], references: [id])
  terms           Term[]
  promptConfigs   PromptConfig[]
  fieldMappingConfigs FieldMappingConfig[]

  @@map("document_formats")
}
```

---

## 實施計劃

### 開發順序

1. **Phase 1: 格式匹配服務** (2 小時)
   - 實現 FormatMatchingService
   - 三種匹配策略實現

2. **Phase 2: 配置解析服務** (1.5 小時)
   - 實現 ConfigResolutionService
   - 整合欄位映射和 Prompt 配置

3. **Phase 3: 處理步驟整合** (1.5 小時)
   - 實現 FormatMatchingStep
   - 實現 ConfigResolutionStep

4. **Phase 4: 類型和 Schema 更新** (1 小時)
   - 更新 ProcessingContext 類型
   - 更新 Prisma Schema

5. **Phase 5: 測試** (2 小時)
   - 單元測試
   - 整合測試

---

## 變更日誌

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0.0 | 2026-01-02 | 初始版本 |

---

*Story created: 2026-01-02*
*Epic: 15 - 統一 3 層機制到日常處理流程*
