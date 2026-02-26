# Story 14-4: GPT Vision 服務整合

> **Epic**: Epic 14 - Prompt 配置與動態生成
> **Story Points**: 8
> **Priority**: High
> **Status**: Backlog

---

## 📋 User Story

**As a** 系統
**I want** GPT Vision 服務能使用動態生成的 Prompt
**So that** AI 處理能根據公司/格式特定配置產生更準確的結果

---

## 🎯 Acceptance Criteria

### AC 14-4-1: Prompt 引擎整合
- [ ] GPT Vision 服務在處理前調用 PromptEngine 獲取動態 Prompt
- [ ] 支援四種 Prompt 類型的動態載入
- [ ] 在缺少特定配置時優雅降級到全域 Prompt
- [ ] 記錄使用的 Prompt 配置用於追蹤

### AC 14-4-2: 上下文變數注入
- [ ] 自動注入處理上下文（公司名稱、格式名稱等）
- [ ] 支援從提取結果注入動態變數
- [ ] 處理變數替換失敗的情況
- [ ] 提供變數替換的日誌記錄

### AC 14-4-3: 多階段處理支援
- [ ] 發行者識別階段使用 ISSUER_IDENTIFICATION Prompt
- [ ] 術語分類階段使用 TERM_CLASSIFICATION Prompt
- [ ] 欄位提取階段使用 FIELD_EXTRACTION Prompt
- [ ] 驗證階段使用 VALIDATION Prompt

### AC 14-4-4: 效能與監控
- [ ] Prompt 解析時間 < 50ms
- [ ] 記錄 Prompt 使用統計
- [ ] 支援 Prompt 效果追蹤（與處理準確率關聯）
- [ ] 提供 Prompt 使用報告

---

## 🏗️ Technical Design

### 服務架構

```
src/services/gpt-vision/
├── gpt-vision.service.ts         # 主服務（修改）
├── prompt-integration.service.ts  # Prompt 整合服務（新增）
├── vision-result-processor.ts     # 結果處理器
├── types.ts                       # 類型定義
└── index.ts                       # 模組導出
```

### 類型定義

```typescript
// src/services/gpt-vision/types.ts

import { PromptType, ResolvedPrompt } from '@/services/prompt-engine/types';

/**
 * 處理階段
 */
export enum ProcessingStage {
  ISSUER_IDENTIFICATION = 'ISSUER_IDENTIFICATION',
  TERM_CLASSIFICATION = 'TERM_CLASSIFICATION',
  FIELD_EXTRACTION = 'FIELD_EXTRACTION',
  VALIDATION = 'VALIDATION',
}

/**
 * 階段到 Prompt 類型的映射
 */
export const STAGE_TO_PROMPT_TYPE: Record<ProcessingStage, PromptType> = {
  [ProcessingStage.ISSUER_IDENTIFICATION]: PromptType.ISSUER_IDENTIFICATION,
  [ProcessingStage.TERM_CLASSIFICATION]: PromptType.TERM_CLASSIFICATION,
  [ProcessingStage.FIELD_EXTRACTION]: PromptType.FIELD_EXTRACTION,
  [ProcessingStage.VALIDATION]: PromptType.VALIDATION,
};

/**
 * GPT Vision 處理上下文
 */
export interface VisionProcessingContext {
  fileId: string;
  companyId?: string;
  documentFormatId?: string;
  companyName?: string;
  formatName?: string;
  documentType?: string;
  previousResults?: Record<string, unknown>;
}

/**
 * Prompt 使用記錄
 */
export interface PromptUsageRecord {
  fileId: string;
  stage: ProcessingStage;
  promptType: PromptType;
  resolvedPrompt: ResolvedPrompt;
  executionTimeMs: number;
  success: boolean;
  resultConfidence?: number;
}

/**
 * GPT Vision 請求
 */
export interface VisionRequest {
  imageBase64: string;
  stage: ProcessingStage;
  context: VisionProcessingContext;
  options?: {
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * GPT Vision 響應
 */
export interface VisionResponse {
  stage: ProcessingStage;
  result: Record<string, unknown>;
  confidence: number;
  promptUsed: {
    configIds: string[];
    promptType: PromptType;
  };
  processingTimeMs: number;
}
```

### Prompt 整合服務

```typescript
// src/services/gpt-vision/prompt-integration.service.ts

/**
 * @fileoverview GPT Vision Prompt 整合服務
 * @description
 *   負責為 GPT Vision 各處理階段獲取動態 Prompt
 *   整合 PromptEngine 和處理上下文
 *
 * @module src/services/gpt-vision/prompt-integration
 * @since Epic 14 - Story 14-4
 */

import { promptEngine, PromptType, ResolvedPrompt } from '@/services/prompt-engine';
import {
  ProcessingStage,
  STAGE_TO_PROMPT_TYPE,
  VisionProcessingContext,
  PromptUsageRecord
} from './types';

export class PromptIntegrationService {
  private usageRecords: PromptUsageRecord[] = [];

  /**
   * 為處理階段獲取 Prompt
   */
  async getPromptForStage(
    stage: ProcessingStage,
    context: VisionProcessingContext
  ): Promise<{
    prompt: string;
    resolvedPrompt: ResolvedPrompt;
  }> {
    const startTime = Date.now();
    const promptType = STAGE_TO_PROMPT_TYPE[stage];

    try {
      // 建立上下文變數
      const variables = this.buildContextVariables(context);

      // 解析 Prompt
      const resolvedPrompt = await promptEngine.resolvePrompt(
        promptType,
        {
          companyId: context.companyId,
          documentFormatId: context.documentFormatId,
          documentType: context.documentType,
          additionalVariables: variables,
        }
      );

      const executionTimeMs = Date.now() - startTime;

      // 記錄使用
      this.recordUsage({
        fileId: context.fileId,
        stage,
        promptType,
        resolvedPrompt,
        executionTimeMs,
        success: true,
      });

      return {
        prompt: resolvedPrompt.finalPrompt,
        resolvedPrompt,
      };
    } catch (error) {
      console.error(`[PromptIntegration] Failed to resolve prompt for stage ${stage}:`, error);

      // 返回預設 Prompt
      const fallbackPrompt = this.getFallbackPrompt(stage);
      return {
        prompt: fallbackPrompt,
        resolvedPrompt: {
          promptType,
          finalPrompt: fallbackPrompt,
          usedConfigs: [],
          variables: {},
          resolvedAt: new Date(),
        },
      };
    }
  }

  /**
   * 為多個階段批次獲取 Prompt
   */
  async getPromptsForStages(
    stages: ProcessingStage[],
    context: VisionProcessingContext
  ): Promise<Map<ProcessingStage, { prompt: string; resolvedPrompt: ResolvedPrompt }>> {
    const results = new Map<ProcessingStage, { prompt: string; resolvedPrompt: ResolvedPrompt }>();

    await Promise.all(
      stages.map(async (stage) => {
        const result = await this.getPromptForStage(stage, context);
        results.set(stage, result);
      })
    );

    return results;
  }

  /**
   * 建立上下文變數
   */
  private buildContextVariables(
    context: VisionProcessingContext
  ): Record<string, string> {
    return {
      fileId: context.fileId,
      companyName: context.companyName || 'Unknown Company',
      formatName: context.formatName || 'Unknown Format',
      documentType: context.documentType || 'Invoice',
      hasCompanyContext: context.companyId ? 'true' : 'false',
      hasFormatContext: context.documentFormatId ? 'true' : 'false',
      previousResultsAvailable: context.previousResults ? 'true' : 'false',
    };
  }

  /**
   * 獲取降級 Prompt
   */
  private getFallbackPrompt(stage: ProcessingStage): string {
    const fallbacks: Record<ProcessingStage, string> = {
      [ProcessingStage.ISSUER_IDENTIFICATION]: `
        Analyze this document image and identify the document issuer.
        Look for company logos, letterheads, and sender information.
        Return a JSON object with: issuerName, confidence, method.
      `,
      [ProcessingStage.TERM_CLASSIFICATION]: `
        Analyze the terms and descriptions in this document.
        Classify each term into standard categories: FREIGHT, HANDLING, DOCUMENTATION, CUSTOMS, INSURANCE, STORAGE, PICKUP_DELIVERY, SURCHARGE, TAX, OTHER.
        Return a JSON array of classified terms.
      `,
      [ProcessingStage.FIELD_EXTRACTION]: `
        Extract invoice data from this document image.
        Include: invoiceNumber, invoiceDate, vendorName, totalAmount, lineItems.
        Return the extracted data as a JSON object.
      `,
      [ProcessingStage.VALIDATION]: `
        Validate the extracted data for consistency and completeness.
        Check for: date format, numeric values, required fields.
        Return validation results with any issues found.
      `,
    };

    return fallbacks[stage].trim();
  }

  /**
   * 記錄 Prompt 使用
   */
  private recordUsage(record: PromptUsageRecord): void {
    this.usageRecords.push(record);

    // 保留最近 1000 條記錄
    if (this.usageRecords.length > 1000) {
      this.usageRecords = this.usageRecords.slice(-1000);
    }
  }

  /**
   * 更新使用記錄的結果信心度
   */
  updateResultConfidence(fileId: string, stage: ProcessingStage, confidence: number): void {
    const record = this.usageRecords.find(
      r => r.fileId === fileId && r.stage === stage
    );
    if (record) {
      record.resultConfidence = confidence;
    }
  }

  /**
   * 獲取使用統計
   */
  getUsageStatistics(): {
    totalCalls: number;
    byStage: Record<ProcessingStage, { count: number; avgTimeMs: number }>;
    avgConfidence: number;
  } {
    const byStage: Record<ProcessingStage, { count: number; totalTime: number; totalConfidence: number }> = {
      [ProcessingStage.ISSUER_IDENTIFICATION]: { count: 0, totalTime: 0, totalConfidence: 0 },
      [ProcessingStage.TERM_CLASSIFICATION]: { count: 0, totalTime: 0, totalConfidence: 0 },
      [ProcessingStage.FIELD_EXTRACTION]: { count: 0, totalTime: 0, totalConfidence: 0 },
      [ProcessingStage.VALIDATION]: { count: 0, totalTime: 0, totalConfidence: 0 },
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const record of this.usageRecords) {
      byStage[record.stage].count++;
      byStage[record.stage].totalTime += record.executionTimeMs;
      if (record.resultConfidence !== undefined) {
        byStage[record.stage].totalConfidence += record.resultConfidence;
        totalConfidence += record.resultConfidence;
        confidenceCount++;
      }
    }

    const result: Record<ProcessingStage, { count: number; avgTimeMs: number }> = {} as any;
    for (const stage of Object.values(ProcessingStage)) {
      const data = byStage[stage];
      result[stage] = {
        count: data.count,
        avgTimeMs: data.count > 0 ? data.totalTime / data.count : 0,
      };
    }

    return {
      totalCalls: this.usageRecords.length,
      byStage: result,
      avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    };
  }
}
```

### GPT Vision 服務修改

```typescript
// src/services/gpt-vision/gpt-vision.service.ts

/**
 * @fileoverview GPT Vision 服務
 * @description
 *   整合 Azure OpenAI GPT-4 Vision 進行文件分析
 *   使用動態 Prompt 配置提升處理準確度
 *
 * @module src/services/gpt-vision/gpt-vision
 * @since Epic 0 - Story 0-2
 * @lastModified 2026-01-02 (Epic 14 - Story 14-4)
 */

import { AzureOpenAI } from '@azure/openai';
import { PromptIntegrationService } from './prompt-integration.service';
import {
  ProcessingStage,
  VisionProcessingContext,
  VisionRequest,
  VisionResponse
} from './types';

export class GPTVisionService {
  private client: AzureOpenAI;
  private promptIntegration: PromptIntegrationService;

  constructor() {
    this.client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: '2024-02-15-preview',
    });
    this.promptIntegration = new PromptIntegrationService();
  }

  /**
   * 處理單一階段
   */
  async processStage(request: VisionRequest): Promise<VisionResponse> {
    const startTime = Date.now();

    // 獲取動態 Prompt
    const { prompt, resolvedPrompt } = await this.promptIntegration.getPromptForStage(
      request.stage,
      request.context
    );

    // 呼叫 GPT Vision
    const response = await this.client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4-vision',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${request.imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: request.options?.maxTokens || 4096,
      temperature: request.options?.temperature || 0.1,
    });

    // 解析結果
    const content = response.choices[0]?.message?.content || '{}';
    const result = this.parseResult(content);
    const confidence = this.calculateConfidence(result, request.stage);

    // 更新使用記錄
    this.promptIntegration.updateResultConfidence(
      request.context.fileId,
      request.stage,
      confidence
    );

    return {
      stage: request.stage,
      result,
      confidence,
      promptUsed: {
        configIds: resolvedPrompt.usedConfigs.map(c => c.configId),
        promptType: resolvedPrompt.promptType,
      },
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 執行完整處理流程
   */
  async processDocument(
    imageBase64: string,
    context: VisionProcessingContext
  ): Promise<{
    stages: VisionResponse[];
    totalTimeMs: number;
    overallConfidence: number;
  }> {
    const startTime = Date.now();
    const stages: VisionResponse[] = [];

    // 階段 1: 發行者識別
    const issuerResult = await this.processStage({
      imageBase64,
      stage: ProcessingStage.ISSUER_IDENTIFICATION,
      context,
    });
    stages.push(issuerResult);

    // 更新上下文
    const enrichedContext = {
      ...context,
      previousResults: { issuer: issuerResult.result },
    };

    // 階段 2: 欄位提取
    const extractionResult = await this.processStage({
      imageBase64,
      stage: ProcessingStage.FIELD_EXTRACTION,
      context: enrichedContext,
    });
    stages.push(extractionResult);

    // 階段 3: 術語分類
    const termResult = await this.processStage({
      imageBase64,
      stage: ProcessingStage.TERM_CLASSIFICATION,
      context: {
        ...enrichedContext,
        previousResults: {
          ...enrichedContext.previousResults,
          extraction: extractionResult.result,
        },
      },
    });
    stages.push(termResult);

    // 階段 4: 驗證
    const validationResult = await this.processStage({
      imageBase64,
      stage: ProcessingStage.VALIDATION,
      context: {
        ...enrichedContext,
        previousResults: {
          ...enrichedContext.previousResults,
          extraction: extractionResult.result,
          terms: termResult.result,
        },
      },
    });
    stages.push(validationResult);

    // 計算整體信心度
    const overallConfidence = this.calculateOverallConfidence(stages);

    return {
      stages,
      totalTimeMs: Date.now() - startTime,
      overallConfidence,
    };
  }

  /**
   * 解析 GPT 回應
   */
  private parseResult(content: string): Record<string, unknown> {
    try {
      // 嘗試提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { raw: content };
    } catch {
      return { raw: content, parseError: true };
    }
  }

  /**
   * 計算階段信心度
   */
  private calculateConfidence(
    result: Record<string, unknown>,
    stage: ProcessingStage
  ): number {
    // 如果結果包含 confidence 欄位，使用它
    if (typeof result.confidence === 'number') {
      return result.confidence;
    }

    // 基於階段和結果完整度計算
    const baseConfidence = 0.7;
    const fields = Object.keys(result).filter(k => k !== 'raw' && k !== 'parseError');

    // 欄位數量影響信心度
    const fieldBonus = Math.min(fields.length * 0.03, 0.2);

    // 解析錯誤降低信心度
    const parseErrorPenalty = result.parseError ? 0.3 : 0;

    return Math.max(0.1, Math.min(1, baseConfidence + fieldBonus - parseErrorPenalty));
  }

  /**
   * 計算整體信心度
   */
  private calculateOverallConfidence(stages: VisionResponse[]): number {
    if (stages.length === 0) return 0;

    const weights: Record<ProcessingStage, number> = {
      [ProcessingStage.ISSUER_IDENTIFICATION]: 0.2,
      [ProcessingStage.FIELD_EXTRACTION]: 0.4,
      [ProcessingStage.TERM_CLASSIFICATION]: 0.2,
      [ProcessingStage.VALIDATION]: 0.2,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const stage of stages) {
      const weight = weights[stage.stage];
      weightedSum += stage.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 獲取 Prompt 使用統計
   */
  getPromptUsageStatistics() {
    return this.promptIntegration.getUsageStatistics();
  }
}
```

### 模組導出

```typescript
// src/services/gpt-vision/index.ts

export * from './types';
export * from './prompt-integration.service';
export * from './gpt-vision.service';
```

---

## 🔗 API Endpoints

### Prompt 使用統計 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/prompt-usage/statistics` | Prompt 使用統計 |
| GET | `/api/v1/admin/prompt-usage/by-stage` | 按階段統計 |
| GET | `/api/v1/admin/prompt-usage/effectiveness` | 效果分析 |

```typescript
// src/app/api/v1/admin/prompt-usage/statistics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { GPTVisionService } from '@/services/gpt-vision';

export async function GET(request: NextRequest) {
  try {
    const visionService = new GPTVisionService();
    const statistics = visionService.getPromptUsageStatistics();

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}
```

---

## 🧪 Testing Strategy

### 單元測試

```typescript
// tests/unit/services/gpt-vision/prompt-integration.test.ts

import { PromptIntegrationService } from '@/services/gpt-vision';
import { ProcessingStage } from '@/services/gpt-vision/types';

describe('PromptIntegrationService', () => {
  let service: PromptIntegrationService;

  beforeEach(() => {
    service = new PromptIntegrationService();
  });

  describe('getPromptForStage', () => {
    it('should return prompt for issuer identification', async () => {
      const result = await service.getPromptForStage(
        ProcessingStage.ISSUER_IDENTIFICATION,
        { fileId: 'test-file' }
      );

      expect(result.prompt).toBeTruthy();
      expect(result.resolvedPrompt.promptType).toBe('ISSUER_IDENTIFICATION');
    });

    it('should include context variables', async () => {
      const result = await service.getPromptForStage(
        ProcessingStage.FIELD_EXTRACTION,
        {
          fileId: 'test-file',
          companyName: 'Test Company',
          formatName: 'Invoice Format A',
        }
      );

      expect(result.resolvedPrompt.variables).toHaveProperty('companyName');
    });
  });

  describe('getUsageStatistics', () => {
    it('should return empty statistics initially', () => {
      const stats = service.getUsageStatistics();
      expect(stats.totalCalls).toBe(0);
    });
  });
});
```

### 整合測試

```typescript
// tests/integration/services/gpt-vision/gpt-vision.test.ts

import { GPTVisionService } from '@/services/gpt-vision';
import { ProcessingStage } from '@/services/gpt-vision/types';

describe('GPTVisionService Integration', () => {
  let service: GPTVisionService;

  beforeEach(() => {
    service = new GPTVisionService();
  });

  describe('processStage', () => {
    it('should process with dynamic prompt', async () => {
      const mockImageBase64 = 'base64-encoded-image';

      const result = await service.processStage({
        imageBase64: mockImageBase64,
        stage: ProcessingStage.ISSUER_IDENTIFICATION,
        context: {
          fileId: 'test-file',
          companyId: 'test-company',
        },
      });

      expect(result.stage).toBe(ProcessingStage.ISSUER_IDENTIFICATION);
      expect(result.promptUsed.promptType).toBe('ISSUER_IDENTIFICATION');
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });
});
```

---

## 📁 Files to Create/Modify

### New Files
| File | Description |
|------|-------------|
| `src/services/gpt-vision/prompt-integration.service.ts` | Prompt 整合服務 |
| `src/app/api/v1/admin/prompt-usage/statistics/route.ts` | 統計 API |

### Modified Files
| File | Change |
|------|--------|
| `src/services/gpt-vision/gpt-vision.service.ts` | 整合 PromptEngine |
| `src/services/gpt-vision/types.ts` | 新增類型定義 |
| `src/services/gpt-vision/index.ts` | 更新導出 |

---

## 🔗 Dependencies

### Upstream
- **Story 14-3**: Prompt 解析與合併服務（PromptEngine）
- **Epic 0 - Story 0-2**: GPT Vision 基礎服務

### Downstream
- **Story 15-1**: 統一處理流程（調用 GPT Vision 服務）

---

## 📝 Implementation Notes

### 階段處理順序
1. ISSUER_IDENTIFICATION - 識別發行者
2. FIELD_EXTRACTION - 提取欄位
3. TERM_CLASSIFICATION - 分類術語
4. VALIDATION - 驗證結果

### 上下文傳遞
- 每個階段的結果會傳遞給下一個階段
- 通過 `previousResults` 提供上下文
- 變數會自動注入到 Prompt

### 效能優化
- Prompt 解析使用快取
- 目標解析時間 < 50ms
- 批次獲取多階段 Prompt

---

## ✅ Definition of Done

- [ ] 所有 Acceptance Criteria 通過
- [ ] Prompt 整合服務實現
- [ ] GPT Vision 服務修改完成
- [ ] 四個處理階段整合動態 Prompt
- [ ] 使用統計 API 實現
- [ ] 單元測試覆蓋率 > 80%
- [ ] 整合測試通過
- [ ] 效能指標達標（解析 < 50ms）
- [ ] 程式碼審查通過

---

*Created: 2026-01-02*
*Epic: 14 - Prompt 配置與動態生成*
