# Tech Spec: Story 14.4 - GPT Vision 服務整合

## 概述

**Story**: Story 14.4 - GPT Vision Service Integration
**Epic**: Epic 14 - Prompt 配置與動態生成
**目標**: 將動態 Prompt 配置整合到現有 GPT Vision 服務，實現基於 Company 和 Format 的智能 Prompt 選擇

---

## 1. 功能需求

### 1.1 核心功能

1. **發行者識別整合**: 使用 ISSUER_IDENTIFICATION 類型的動態 Prompt
2. **術語分類整合**: 使用 TERM_CLASSIFICATION 類型的動態 Prompt
3. **功能開關**: 支援動態 Prompt 的啟用/禁用
4. **向後兼容**: 功能關閉時使用原有硬編碼 Prompt

### 1.2 Acceptance Criteria

- GPT Vision 發行者識別使用動態 Prompt
- 術語分類使用對應 Company/Format 的專屬 Prompt
- 功能開關可控制是否使用動態 Prompt
- 功能關閉時完全向後兼容

---

## 2. 技術設計

### 2.1 功能開關配置

```typescript
// src/config/feature-flags.ts

/**
 * @fileoverview 功能開關配置
 * @module src/config/feature-flags
 * @since Epic 14 - Story 14.4
 */

export interface FeatureFlags {
  /** 是否啟用動態 Prompt */
  dynamicPromptEnabled: boolean;
  /** 是否啟用發行者識別的動態 Prompt */
  dynamicIssuerPromptEnabled: boolean;
  /** 是否啟用術語分類的動態 Prompt */
  dynamicTermPromptEnabled: boolean;
  /** 是否啟用欄位提取的動態 Prompt */
  dynamicFieldPromptEnabled: boolean;
}

/**
 * 獲取功能開關配置
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    dynamicPromptEnabled: process.env.FEATURE_DYNAMIC_PROMPT === 'true',
    dynamicIssuerPromptEnabled: process.env.FEATURE_DYNAMIC_ISSUER_PROMPT !== 'false',
    dynamicTermPromptEnabled: process.env.FEATURE_DYNAMIC_TERM_PROMPT !== 'false',
    dynamicFieldPromptEnabled: process.env.FEATURE_DYNAMIC_FIELD_PROMPT !== 'false',
  };
}

/**
 * 檢查是否應使用動態 Prompt
 */
export function shouldUseDynamicPrompt(promptType: 'issuer' | 'term' | 'field'): boolean {
  const flags = getFeatureFlags();

  if (!flags.dynamicPromptEnabled) return false;

  switch (promptType) {
    case 'issuer':
      return flags.dynamicIssuerPromptEnabled;
    case 'term':
      return flags.dynamicTermPromptEnabled;
    case 'field':
      return flags.dynamicFieldPromptEnabled;
    default:
      return false;
  }
}
```

### 2.2 Prompt 提供者介面

```typescript
// src/services/prompt-provider.interface.ts

/**
 * @fileoverview Prompt 提供者介面
 * @module src/services/prompt-provider
 * @since Epic 14 - Story 14.4
 */

import { PromptType } from '@prisma/client';

/**
 * Prompt 請求上下文
 */
export interface PromptRequestContext {
  /** Prompt 類型 */
  promptType: PromptType;
  /** 公司 ID */
  companyId?: string | null;
  /** 文件格式 ID */
  documentFormatId?: string | null;
  /** 文件 ID */
  documentId?: string;
  /** 額外上下文變數 */
  contextVariables?: Record<string, unknown>;
}

/**
 * Prompt 結果
 */
export interface PromptResult {
  /** System Prompt */
  systemPrompt: string;
  /** User Prompt */
  userPrompt: string;
  /** 使用的來源 */
  source: 'dynamic' | 'static';
  /** 應用的配置層級 */
  appliedLayers?: string[];
}

/**
 * Prompt 提供者介面
 */
export interface IPromptProvider {
  /**
   * 獲取 Prompt
   */
  getPrompt(context: PromptRequestContext): Promise<PromptResult>;
}
```

### 2.3 混合 Prompt 提供者

```typescript
// src/services/hybrid-prompt-provider.service.ts

/**
 * @fileoverview 混合 Prompt 提供者 - 支援動態和靜態 Prompt
 * @module src/services/hybrid-prompt-provider
 * @since Epic 14 - Story 14.4
 *
 * @description
 *   根據功能開關決定使用動態或靜態 Prompt：
 *   - 動態模式：使用 PromptResolver 獲取配置的 Prompt
 *   - 靜態模式：使用硬編碼的原有 Prompt
 */

import { PromptType } from '@prisma/client';
import { IPromptProvider, PromptRequestContext, PromptResult } from './prompt-provider.interface';
import { PromptResolverService } from './prompt-resolver.service';
import { shouldUseDynamicPrompt } from '@/config/feature-flags';
import { STATIC_PROMPTS } from './static-prompts';

export class HybridPromptProvider implements IPromptProvider {
  constructor(
    private readonly dynamicResolver: PromptResolverService
  ) {}

  /**
   * 獲取 Prompt（根據功能開關選擇來源）
   */
  async getPrompt(context: PromptRequestContext): Promise<PromptResult> {
    const promptTypeKey = this.mapPromptTypeToKey(context.promptType);

    // 檢查是否應使用動態 Prompt
    if (shouldUseDynamicPrompt(promptTypeKey)) {
      return this.getDynamicPrompt(context);
    }

    return this.getStaticPrompt(context);
  }

  /**
   * 獲取動態 Prompt
   */
  private async getDynamicPrompt(context: PromptRequestContext): Promise<PromptResult> {
    try {
      const resolved = await this.dynamicResolver.resolve({
        promptType: context.promptType,
        companyId: context.companyId,
        documentFormatId: context.documentFormatId,
        contextVariables: context.contextVariables,
      });

      // 處理 userPromptTemplate 中的文件內容佔位符
      const userPrompt = this.processUserPrompt(
        resolved.userPromptTemplate,
        context.contextVariables
      );

      return {
        systemPrompt: resolved.systemPrompt,
        userPrompt,
        source: 'dynamic',
        appliedLayers: resolved.appliedLayers.map(l => `${l.scope}:${l.configName}`),
      };
    } catch (error) {
      // 動態 Prompt 失敗時回退到靜態
      console.warn('[HybridPromptProvider] Dynamic prompt failed, falling back to static:', error);
      return this.getStaticPrompt(context);
    }
  }

  /**
   * 獲取靜態 Prompt
   */
  private getStaticPrompt(context: PromptRequestContext): PromptResult {
    const staticPrompt = STATIC_PROMPTS[context.promptType];

    const userPrompt = this.processUserPrompt(
      staticPrompt.userPromptTemplate,
      context.contextVariables
    );

    return {
      systemPrompt: staticPrompt.systemPrompt,
      userPrompt,
      source: 'static',
    };
  }

  /**
   * 處理 User Prompt 模板
   */
  private processUserPrompt(
    template: string,
    variables?: Record<string, unknown>
  ): string {
    if (!variables) return template;

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
    return result;
  }

  /**
   * 映射 PromptType 到功能開關鍵
   */
  private mapPromptTypeToKey(promptType: PromptType): 'issuer' | 'term' | 'field' {
    switch (promptType) {
      case PromptType.ISSUER_IDENTIFICATION:
        return 'issuer';
      case PromptType.TERM_CLASSIFICATION:
        return 'term';
      case PromptType.FIELD_EXTRACTION:
        return 'field';
      default:
        return 'field';
    }
  }
}
```

### 2.4 靜態 Prompt 定義

```typescript
// src/services/static-prompts.ts

/**
 * @fileoverview 靜態 Prompt 定義（向後兼容）
 * @module src/services/static-prompts
 * @since Epic 14 - Story 14.4
 */

import { PromptType } from '@prisma/client';

interface StaticPromptConfig {
  systemPrompt: string;
  userPromptTemplate: string;
}

/**
 * 原有的硬編碼 Prompt（用於向後兼容）
 */
export const STATIC_PROMPTS: Record<PromptType, StaticPromptConfig> = {
  [PromptType.ISSUER_IDENTIFICATION]: {
    systemPrompt: `你是一個專業的文件分析助手。你的任務是識別發票或商業文件的發行公司。

## 識別規則
1. 優先查看文件頂部的 Logo 或公司名稱
2. 檢查頁眉區域的公司資訊
3. 查看發票號碼前綴或格式特徵
4. 注意常見物流公司的標識特徵

## 輸出格式
請以 JSON 格式輸出：
{
  "issuerName": "識別的公司名稱",
  "confidence": 0.0-1.0,
  "identificationMethod": "LOGO" | "HEADER" | "PATTERN" | "CONTENT",
  "evidence": "識別依據說明"
}`,
    userPromptTemplate: `請分析以下文件圖像，識別文件的發行公司：

{{imageDescription}}`,
  },

  [PromptType.TERM_CLASSIFICATION]: {
    systemPrompt: `你是一個專業的物流發票術語分類助手。你的任務是將發票中的費用項目分類到標準類別。

## 標準費用類別
- FREIGHT: 基本運費
- FUEL_SURCHARGE: 燃油附加費
- HANDLING: 操作費
- CUSTOMS: 報關費
- INSURANCE: 保險費
- STORAGE: 倉儲費
- DOCUMENTATION: 文件費
- OTHER: 其他費用

## 分類規則
1. 根據術語的語義進行分類
2. 考慮術語的上下文
3. 如果不確定，標記為 OTHER

## 輸出格式
請以 JSON 陣列格式輸出：
[
  {
    "originalTerm": "原始術語",
    "mappedCategory": "分類結果",
    "confidence": 0.0-1.0,
    "reasoning": "分類理由"
  }
]`,
    userPromptTemplate: `請對以下術語進行分類：

{{terms}}`,
  },

  [PromptType.FIELD_EXTRACTION]: {
    systemPrompt: `你是一個專業的發票欄位提取助手。請從發票圖像中提取關鍵欄位。

## 需提取的欄位
- invoiceNumber: 發票號碼
- invoiceDate: 發票日期
- dueDate: 到期日
- totalAmount: 總金額
- currency: 貨幣
- vendorName: 供應商名稱
- customerName: 客戶名稱

## 輸出格式
請以 JSON 格式輸出所有識別到的欄位。`,
    userPromptTemplate: `請從以下發票圖像中提取欄位資訊：

{{imageDescription}}`,
  },

  [PromptType.VALIDATION]: {
    systemPrompt: `你是一個專業的數據驗證助手。請驗證提取的發票數據是否正確和完整。`,
    userPromptTemplate: `請驗證以下提取的數據：

{{extractedData}}`,
  },
};
```

### 2.5 修改 GPT Vision 服務

```typescript
// src/services/gpt-vision.service.ts (修改部分)

/**
 * @fileoverview GPT Vision 服務 - 整合動態 Prompt
 * @module src/services/gpt-vision
 * @since Epic 0 - Story 0-8, Epic 14 - Story 14.4
 *
 * @description
 *   使用 GPT Vision API 進行文件分析：
 *   - 發行者識別
 *   - 術語分類
 *   - 欄位提取
 *
 *   Epic 14.4 新增：動態 Prompt 支援
 */

import { PromptType } from '@prisma/client';
import { HybridPromptProvider } from './hybrid-prompt-provider.service';
import { getPromptResolver } from './prompt-resolver.factory';
import prisma from '@/lib/prisma';

export class GptVisionService {
  private readonly promptProvider: HybridPromptProvider;

  constructor() {
    const resolver = getPromptResolver(prisma);
    this.promptProvider = new HybridPromptProvider(resolver);
  }

  /**
   * 識別文件發行者
   *
   * @param imageBase64 - Base64 編碼的圖像
   * @param existingCompanyId - 已知的公司 ID（可選，用於動態 Prompt）
   */
  async identifyIssuer(
    imageBase64: string,
    existingCompanyId?: string
  ): Promise<IssuerIdentificationResult> {
    // 獲取 Prompt（動態或靜態）
    const promptResult = await this.promptProvider.getPrompt({
      promptType: PromptType.ISSUER_IDENTIFICATION,
      companyId: existingCompanyId,
      contextVariables: {
        imageDescription: '[文件圖像]',
      },
    });

    // 調用 GPT Vision API
    const response = await this.callGptVision({
      systemPrompt: promptResult.systemPrompt,
      userPrompt: promptResult.userPrompt,
      imageBase64,
    });

    // 記錄使用的 Prompt 來源
    console.log(`[GptVision] Issuer identification using ${promptResult.source} prompt`);
    if (promptResult.appliedLayers) {
      console.log(`[GptVision] Applied layers: ${promptResult.appliedLayers.join(', ')}`);
    }

    return this.parseIssuerResponse(response);
  }

  /**
   * 分類術語
   *
   * @param terms - 待分類的術語列表
   * @param companyId - 公司 ID（用於動態 Prompt）
   * @param documentFormatId - 文件格式 ID（用於動態 Prompt）
   */
  async classifyTerms(
    terms: string[],
    companyId?: string,
    documentFormatId?: string
  ): Promise<TermClassificationResult[]> {
    // 獲取 Prompt（動態或靜態）
    const promptResult = await this.promptProvider.getPrompt({
      promptType: PromptType.TERM_CLASSIFICATION,
      companyId,
      documentFormatId,
      contextVariables: {
        terms: terms.map((t, i) => `${i + 1}. ${t}`).join('\n'),
        companyId,
        documentFormatId,
      },
    });

    // 調用 GPT API（文字模式）
    const response = await this.callGptText({
      systemPrompt: promptResult.systemPrompt,
      userPrompt: promptResult.userPrompt,
    });

    // 記錄使用的 Prompt 來源
    console.log(`[GptVision] Term classification using ${promptResult.source} prompt`);

    return this.parseTermResponse(response);
  }

  /**
   * 提取欄位（結合動態 Prompt）
   */
  async extractFields(
    imageBase64: string,
    companyId?: string,
    documentFormatId?: string
  ): Promise<FieldExtractionResult> {
    const promptResult = await this.promptProvider.getPrompt({
      promptType: PromptType.FIELD_EXTRACTION,
      companyId,
      documentFormatId,
      contextVariables: {
        imageDescription: '[文件圖像]',
      },
    });

    const response = await this.callGptVision({
      systemPrompt: promptResult.systemPrompt,
      userPrompt: promptResult.userPrompt,
      imageBase64,
    });

    return this.parseFieldResponse(response);
  }

  // ... 其他方法保持不變 ...

  /**
   * 調用 GPT Vision API
   */
  private async callGptVision(params: {
    systemPrompt: string;
    userPrompt: string;
    imageBase64: string;
  }): Promise<string> {
    // 實際 API 調用實現
    // ...
    return '';
  }

  /**
   * 調用 GPT Text API
   */
  private async callGptText(params: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string> {
    // 實際 API 調用實現
    // ...
    return '';
  }

  // 解析方法...
  private parseIssuerResponse(response: string): IssuerIdentificationResult {
    return JSON.parse(response);
  }

  private parseTermResponse(response: string): TermClassificationResult[] {
    return JSON.parse(response);
  }

  private parseFieldResponse(response: string): FieldExtractionResult {
    return JSON.parse(response);
  }
}

// 類型定義
interface IssuerIdentificationResult {
  issuerName: string;
  confidence: number;
  identificationMethod: 'LOGO' | 'HEADER' | 'PATTERN' | 'CONTENT';
  evidence: string;
}

interface TermClassificationResult {
  originalTerm: string;
  mappedCategory: string;
  confidence: number;
  reasoning: string;
}

interface FieldExtractionResult {
  fields: Record<string, unknown>;
  confidence: number;
}
```

### 2.6 修改 AI Term Validation 服務

```typescript
// src/services/ai-term-validation.service.ts (修改部分)

/**
 * @fileoverview AI 術語驗證服務 - 整合動態 Prompt
 * @module src/services/ai-term-validation
 * @since Epic 0 - Story 0-10, Epic 14 - Story 14.4
 */

import { PromptType } from '@prisma/client';
import { HybridPromptProvider } from './hybrid-prompt-provider.service';
import { getPromptResolver } from './prompt-resolver.factory';
import prisma from '@/lib/prisma';

export class AiTermValidationService {
  private readonly promptProvider: HybridPromptProvider;

  constructor() {
    const resolver = getPromptResolver(prisma);
    this.promptProvider = new HybridPromptProvider(resolver);
  }

  /**
   * 驗證術語分類
   *
   * @param terms - 待驗證的術語
   * @param companyId - 公司 ID
   * @param documentFormatId - 文件格式 ID
   */
  async validateTerms(
    terms: TermToValidate[],
    companyId?: string,
    documentFormatId?: string
  ): Promise<TermValidationResult[]> {
    // 獲取動態 Prompt
    const promptResult = await this.promptProvider.getPrompt({
      promptType: PromptType.TERM_CLASSIFICATION,
      companyId,
      documentFormatId,
      contextVariables: {
        terms: terms.map(t => `- ${t.originalTerm}: 當前分類 ${t.currentCategory}`).join('\n'),
        validationMode: true,
      },
    });

    // 調用 AI 進行驗證
    const response = await this.callValidationApi({
      systemPrompt: promptResult.systemPrompt,
      userPrompt: this.buildValidationPrompt(promptResult.userPrompt, terms),
    });

    console.log(`[AiTermValidation] Using ${promptResult.source} prompt`);

    return this.parseValidationResponse(response);
  }

  /**
   * 建立驗證 Prompt
   */
  private buildValidationPrompt(template: string, terms: TermToValidate[]): string {
    const termList = terms
      .map(t => `- "${t.originalTerm}" → 當前: ${t.currentCategory}`)
      .join('\n');

    return template.replace('{{terms}}', termList);
  }

  private async callValidationApi(params: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string> {
    // API 調用實現
    return '';
  }

  private parseValidationResponse(response: string): TermValidationResult[] {
    return JSON.parse(response);
  }
}

interface TermToValidate {
  originalTerm: string;
  currentCategory: string;
}

interface TermValidationResult {
  originalTerm: string;
  suggestedCategory: string;
  isCorrect: boolean;
  confidence: number;
  suggestion?: string;
}
```

---

## 3. 環境變數配置

```bash
# .env.example

# 動態 Prompt 功能開關
FEATURE_DYNAMIC_PROMPT=true          # 主開關
FEATURE_DYNAMIC_ISSUER_PROMPT=true   # 發行者識別
FEATURE_DYNAMIC_TERM_PROMPT=true     # 術語分類
FEATURE_DYNAMIC_FIELD_PROMPT=true    # 欄位提取
```

---

## 4. 整合流程圖

```
文件處理請求
    │
    ├─► 發行者識別
    │   │
    │   ├─ 功能開關檢查
    │   │   ├─ ON  → PromptResolver.resolve(ISSUER_IDENTIFICATION)
    │   │   └─ OFF → STATIC_PROMPTS.ISSUER_IDENTIFICATION
    │   │
    │   ├─ 調用 GPT Vision API
    │   └─► 返回識別結果 + companyId
    │
    ├─► 術語分類（使用識別的 companyId）
    │   │
    │   ├─ 功能開關檢查
    │   │   ├─ ON  → PromptResolver.resolve(TERM_CLASSIFICATION, companyId, formatId)
    │   │   └─ OFF → STATIC_PROMPTS.TERM_CLASSIFICATION
    │   │
    │   ├─ 調用 GPT API
    │   └─► 返回分類結果
    │
    └─► 欄位提取（可選）
        │
        ├─ 功能開關檢查
        │   ├─ ON  → PromptResolver.resolve(FIELD_EXTRACTION, companyId, formatId)
        │   └─ OFF → STATIC_PROMPTS.FIELD_EXTRACTION
        │
        └─► 返回提取結果
```

---

## 5. 效能考量

### 5.1 快取策略

| 層級 | 快取時間 | 說明 |
|------|----------|------|
| Prompt 解析結果 | 5 分鐘 | PromptCache |
| 變數值 | 1 分鐘 | 動態變數 |
| 功能開關 | 啟動時載入 | 環境變數 |

### 5.2 效能目標

| 指標 | 目標 | 說明 |
|------|------|------|
| Prompt 獲取 | < 10ms | 快取命中時 |
| Prompt 獲取 | < 60ms | 完整解析時 |
| 總體延遲增加 | < 100ms | 相比靜態 Prompt |

---

## 6. 監控與日誌

### 6.1 日誌格式

```typescript
// 使用動態 Prompt 時的日誌
console.log('[GptVision] Issuer identification using dynamic prompt');
console.log('[GptVision] Applied layers: GLOBAL:default, COMPANY:DHL');

// 回退到靜態 Prompt 時的日誌
console.warn('[HybridPromptProvider] Dynamic prompt failed, falling back to static:', error);
```

### 6.2 監控指標

```typescript
// src/lib/metrics/prompt-metrics.ts

export const promptMetrics = {
  // 計數器
  dynamicPromptUsed: 0,
  staticPromptUsed: 0,
  dynamicPromptFailed: 0,

  // 記錄使用
  record(source: 'dynamic' | 'static', promptType: string) {
    if (source === 'dynamic') {
      this.dynamicPromptUsed++;
    } else {
      this.staticPromptUsed++;
    }
  },

  // 記錄失敗
  recordFailure(promptType: string, error: Error) {
    this.dynamicPromptFailed++;
    console.error(`[PromptMetrics] Dynamic prompt failed for ${promptType}:`, error);
  },
};
```

---

## 7. 測試計劃

### 7.1 單元測試

```typescript
describe('HybridPromptProvider', () => {
  describe('getPrompt', () => {
    it('should return dynamic prompt when feature is enabled', async () => {});
    it('should return static prompt when feature is disabled', async () => {});
    it('should fallback to static when dynamic fails', async () => {});
    it('should process user prompt template variables', async () => {});
  });
});

describe('GptVisionService with dynamic prompts', () => {
  describe('identifyIssuer', () => {
    it('should use dynamic prompt with company context', async () => {});
    it('should use static prompt when disabled', async () => {});
  });

  describe('classifyTerms', () => {
    it('should use format-specific prompt when available', async () => {});
    it('should merge company and global prompts', async () => {});
  });
});
```

### 7.2 整合測試

```typescript
describe('Dynamic Prompt Integration', () => {
  it('should process document with dynamic prompts end-to-end', async () => {
    // 1. 創建測試 Prompt 配置
    // 2. 上傳測試文件
    // 3. 驗證使用了正確的 Prompt
    // 4. 驗證處理結果
  });

  it('should fallback gracefully when no config exists', async () => {
    // 驗證沒有配置時使用靜態 Prompt
  });
});
```

---

## 8. 遷移計劃

### 8.1 Phase 1: 準備（功能關閉）

1. 部署新代碼，功能開關設為 `false`
2. 驗證系統正常運行（使用靜態 Prompt）
3. 監控錯誤日誌

### 8.2 Phase 2: 配置 Prompt

1. 透過 Admin UI 創建 Global Prompt 配置
2. 創建主要 Company 的專屬配置
3. 驗證配置正確儲存

### 8.3 Phase 3: 漸進啟用

1. 啟用 `FEATURE_DYNAMIC_ISSUER_PROMPT=true`
2. 監控發行者識別效果
3. 確認無問題後啟用 `FEATURE_DYNAMIC_TERM_PROMPT=true`
4. 最後啟用 `FEATURE_DYNAMIC_PROMPT=true`

### 8.4 Phase 4: 優化

1. 根據實際使用情況調整 Prompt
2. 創建更多 Format 級別的專屬配置
3. 持續監控和改進

---

## 9. 依賴關係

```
Story 14.4 依賴:
├── Story 14.1 (PromptConfig 模型)
├── Story 14.3 (PromptResolver 服務)
└── 現有服務:
    ├── gpt-vision.service.ts
    └── ai-term-validation.service.ts

Story 14.4 被依賴:
└── Epic 15 (統一處理流程)
    └── 使用動態 Prompt 進行智能處理
```

---

*Tech Spec 建立日期: 2026-01-02*
*版本: 1.0.0*
