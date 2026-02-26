# Story 15-2: 發行者識別整合

> **Epic**: Epic 15 - 統一 3 層機制到日常處理流程
> **Story Points**: 5
> **Priority**: High
> **Status**: 📋 Backlog
> **Prerequisites**: Story 15-1 (處理流程重構 - 統一入口)

---

## 📋 Story 概述

### User Story

```
作為系統，
我希望在日常文件處理流程中自動執行發行者識別，
以便能夠將每個文件關聯到正確的公司和文件格式。
```

### 驗收標準 (Acceptance Criteria)

1. **AC1**: 統一處理器自動調用發行者識別服務
2. **AC2**: 識別結果正確儲存到文件記錄中
3. **AC3**: 支援自動匹配現有公司或創建新公司
4. **AC4**: 識別失敗時使用降級策略（繼續處理但標記為未識別）
5. **AC5**: 識別信心度納入整體信心度計算
6. **AC6**: 可通過功能開關控制此功能的啟用/停用

---

## 🏗️ 技術設計

### 整合架構

```
┌─────────────────────────────────────────────────────────────────┐
│                    統一文件處理流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │ Azure DI 提取 │ ← 基礎欄位提取完成                           │
│  └──────┬───────┘                                               │
│         ↓                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              IssuerIdentificationStep                     │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ 1. 調用 GPT Vision 識別發行者                        │ │   │
│  │  │    - 分析 Logo                                       │ │   │
│  │  │    - 分析 Header 文字                                │ │   │
│  │  │    - 組合識別結果                                    │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ 2. 公司匹配/創建                                     │ │   │
│  │  │    - 搜尋現有公司                                    │ │   │
│  │  │    - 如需要則自動創建                                │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ 3. 更新處理上下文                                    │ │   │
│  │  │    - context.identifiedCompanyId                     │ │   │
│  │  │    - context.issuerConfidence                        │ │   │
│  │  │    - context.issuerIdentificationMethod              │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│         ↓                                                       │
│  ┌──────────────┐                                               │
│  │ 格式匹配步驟  │ ← 使用識別的公司進行格式匹配                 │
│  └──────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 處理上下文擴展

```typescript
// src/types/processing-context.ts（擴展）

/**
 * @fileoverview 處理上下文類型擴展 - 發行者識別
 * @module src/types/processing-context
 * @since Epic 15 - Story 15.2
 */

/**
 * 發行者識別方法
 */
export type IssuerIdentificationMethod = 'LOGO' | 'HEADER' | 'COMBINED' | 'MANUAL';

/**
 * 發行者識別結果
 */
export interface IssuerIdentificationResult {
  /** 識別的公司名稱（原始識別結果） */
  identifiedName: string;

  /** 識別方法 */
  method: IssuerIdentificationMethod;

  /** 識別信心度 (0-1) */
  confidence: number;

  /** Logo 分析結果 */
  logoAnalysis?: {
    detected: boolean;
    description?: string;
    confidence: number;
  };

  /** Header 分析結果 */
  headerAnalysis?: {
    detected: boolean;
    text?: string;
    confidence: number;
  };

  /** 匹配的公司 ID（如果成功匹配） */
  matchedCompanyId?: string;

  /** 匹配分數（與現有公司的相似度） */
  matchScore?: number;

  /** 是否創建了新公司 */
  isNewCompany?: boolean;
}

/**
 * 處理上下文（發行者識別擴展）
 */
export interface ProcessingContextWithIssuer {
  // ... 繼承 ProcessingContext 的所有屬性

  /** 發行者識別結果 */
  issuerIdentification?: IssuerIdentificationResult;

  /** 識別的公司 ID */
  identifiedCompanyId?: string;

  /** 發行者識別信心度 */
  issuerConfidence?: number;

  /** 識別方法 */
  issuerIdentificationMethod?: IssuerIdentificationMethod;
}
```

### IssuerIdentificationStep 實現

```typescript
// src/services/unified-processor/steps/issuer-identification.step.ts

/**
 * @fileoverview 發行者識別步驟
 * @description
 *   統一處理流程中的發行者識別步驟
 *   調用 GPT Vision 識別文件發行者並匹配/創建公司
 *
 * @module src/services/unified-processor/steps/issuer-identification.step
 * @since Epic 15 - Story 15.2
 */

import { ProcessingStep } from '../types';
import type { ProcessingContext } from '@/types/processing-context';
import { documentIssuerService } from '@/services/document-issuer.service';
import { companyAutoCreateService } from '@/services/company-auto-create.service';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

/**
 * 發行者識別處理步驟
 */
export class IssuerIdentificationStep implements ProcessingStep {
  readonly name = 'IssuerIdentification';
  readonly isOptional = true; // 識別失敗不阻止後續處理

  /**
   * 執行發行者識別
   */
  async execute(context: ProcessingContext): Promise<void> {
    // 檢查功能開關
    if (!FEATURE_FLAGS.ENABLE_ISSUER_IDENTIFICATION) {
      console.log('[IssuerIdentificationStep] 功能已停用，跳過');
      return;
    }

    const startTime = Date.now();

    try {
      // 1. 調用發行者識別服務
      const identificationResult = await this.identifyIssuer(context);

      if (!identificationResult) {
        console.log('[IssuerIdentificationStep] 無法識別發行者');
        context.warnings.push('無法識別文件發行者');
        return;
      }

      // 2. 匹配或創建公司
      const companyResult = await this.matchOrCreateCompany(
        identificationResult,
        context
      );

      // 3. 更新上下文
      context.issuerIdentification = {
        ...identificationResult,
        matchedCompanyId: companyResult?.companyId,
        matchScore: companyResult?.matchScore,
        isNewCompany: companyResult?.isNewCompany,
      };

      context.identifiedCompanyId = companyResult?.companyId;
      context.issuerConfidence = identificationResult.confidence;
      context.issuerIdentificationMethod = identificationResult.method;

      console.log(
        `[IssuerIdentificationStep] 識別完成: ${identificationResult.identifiedName} ` +
        `(信心度: ${(identificationResult.confidence * 100).toFixed(1)}%)`
      );
    } catch (error) {
      console.error('[IssuerIdentificationStep] 識別失敗:', error);
      context.errors.push({
        step: this.name,
        error: error instanceof Error ? error.message : '發行者識別失敗',
        recoverable: true,
      });
      context.warnings.push('發行者識別失敗，將使用預設處理');
    } finally {
      context.stepTimings[this.name] = Date.now() - startTime;
    }
  }

  /**
   * 調用發行者識別服務
   */
  private async identifyIssuer(
    context: ProcessingContext
  ): Promise<{
    identifiedName: string;
    method: 'LOGO' | 'HEADER' | 'COMBINED';
    confidence: number;
    logoAnalysis?: { detected: boolean; description?: string; confidence: number };
    headerAnalysis?: { detected: boolean; text?: string; confidence: number };
  } | null> {
    // 需要文件路徑或 Base64 圖片
    if (!context.filePath && !context.fileBase64) {
      console.warn('[IssuerIdentificationStep] 無可用的文件數據');
      return null;
    }

    // 調用文件發行者識別服務
    const result = await documentIssuerService.extractDocumentIssuer({
      filePath: context.filePath,
      fileBase64: context.fileBase64,
      fileType: context.fileType,
    });

    if (!result.success || !result.issuer) {
      return null;
    }

    return {
      identifiedName: result.issuer.name,
      method: result.issuer.method,
      confidence: result.issuer.confidence,
      logoAnalysis: result.logoAnalysis,
      headerAnalysis: result.headerAnalysis,
    };
  }

  /**
   * 匹配或創建公司
   */
  private async matchOrCreateCompany(
    identification: {
      identifiedName: string;
      confidence: number;
    },
    context: ProcessingContext
  ): Promise<{
    companyId: string;
    matchScore: number;
    isNewCompany: boolean;
  } | null> {
    try {
      // 調用公司自動創建服務（包含匹配邏輯）
      const result = await companyAutoCreateService.matchOrCreateCompany({
        name: identification.identifiedName,
        confidence: identification.confidence,
        sourceFileId: context.fileId,
        autoCreate: FEATURE_FLAGS.ENABLE_AUTO_CREATE_COMPANY,
      });

      return {
        companyId: result.companyId,
        matchScore: result.matchScore,
        isNewCompany: result.isNewCompany,
      };
    } catch (error) {
      console.error('[IssuerIdentificationStep] 公司匹配/創建失敗:', error);
      return null;
    }
  }
}

// 導出單例
export const issuerIdentificationStep = new IssuerIdentificationStep();
```

### 文件發行者識別服務

```typescript
// src/services/document-issuer.service.ts（擴展）

/**
 * @fileoverview 文件發行者識別服務
 * @description
 *   使用 GPT Vision 識別文件的發行公司
 *   支援 Logo 和 Header 雙重識別
 *
 * @module src/services/document-issuer
 * @since Epic 0 - Story 0.8
 * @lastModified 2026-01-02 (Epic 15 - Story 15.2 整合)
 */

import { gptVisionService } from './gpt-vision.service';
import { promptResolverService } from './prompt-resolver.service';
import type { PromptType } from '@/types/prompt-config';

export interface ExtractIssuerInput {
  filePath?: string;
  fileBase64?: string;
  fileType?: 'NATIVE_PDF' | 'SCANNED_PDF' | 'IMAGE';
}

export interface ExtractIssuerResult {
  success: boolean;
  issuer?: {
    name: string;
    method: 'LOGO' | 'HEADER' | 'COMBINED';
    confidence: number;
  };
  logoAnalysis?: {
    detected: boolean;
    description?: string;
    confidence: number;
  };
  headerAnalysis?: {
    detected: boolean;
    text?: string;
    confidence: number;
  };
  error?: string;
}

class DocumentIssuerService {
  /**
   * 提取文件發行者
   */
  async extractDocumentIssuer(input: ExtractIssuerInput): Promise<ExtractIssuerResult> {
    try {
      // 1. 獲取發行者識別 Prompt（使用動態配置）
      const resolvedPrompt = await promptResolverService.resolvePrompt(
        'ISSUER_IDENTIFICATION' as PromptType,
        {
          // 第一次識別沒有公司/格式上下文
        }
      );

      // 2. 調用 GPT Vision
      const response = await gptVisionService.analyzeDocument({
        filePath: input.filePath,
        fileBase64: input.fileBase64,
        systemPrompt: resolvedPrompt.systemPrompt,
        userPrompt: resolvedPrompt.userPrompt,
        responseFormat: 'json',
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error,
        };
      }

      // 3. 解析響應
      const parsed = this.parseIssuerResponse(response.content);

      return {
        success: true,
        issuer: parsed.issuer,
        logoAnalysis: parsed.logoAnalysis,
        headerAnalysis: parsed.headerAnalysis,
      };
    } catch (error) {
      console.error('[DocumentIssuerService] 提取失敗:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      };
    }
  }

  /**
   * 解析 GPT 響應
   */
  private parseIssuerResponse(content: string): {
    issuer?: {
      name: string;
      method: 'LOGO' | 'HEADER' | 'COMBINED';
      confidence: number;
    };
    logoAnalysis?: {
      detected: boolean;
      description?: string;
      confidence: number;
    };
    headerAnalysis?: {
      detected: boolean;
      text?: string;
      confidence: number;
    };
  } {
    try {
      const data = JSON.parse(content);

      let method: 'LOGO' | 'HEADER' | 'COMBINED' = 'HEADER';
      let confidence = 0;
      let name = '';

      // 分析 Logo 結果
      const logoAnalysis = data.logoAnalysis ? {
        detected: data.logoAnalysis.detected || false,
        description: data.logoAnalysis.description,
        confidence: data.logoAnalysis.confidence || 0,
      } : undefined;

      // 分析 Header 結果
      const headerAnalysis = data.headerAnalysis ? {
        detected: data.headerAnalysis.detected || false,
        text: data.headerAnalysis.text,
        confidence: data.headerAnalysis.confidence || 0,
      } : undefined;

      // 確定最佳識別方法
      if (logoAnalysis?.detected && headerAnalysis?.detected) {
        method = 'COMBINED';
        confidence = Math.max(logoAnalysis.confidence, headerAnalysis.confidence);
        name = data.issuerName || headerAnalysis.text || '';
      } else if (logoAnalysis?.detected) {
        method = 'LOGO';
        confidence = logoAnalysis.confidence;
        name = data.issuerName || logoAnalysis.description || '';
      } else if (headerAnalysis?.detected) {
        method = 'HEADER';
        confidence = headerAnalysis.confidence;
        name = data.issuerName || headerAnalysis.text || '';
      }

      if (!name) {
        return { logoAnalysis, headerAnalysis };
      }

      return {
        issuer: { name, method, confidence },
        logoAnalysis,
        headerAnalysis,
      };
    } catch (error) {
      console.error('[DocumentIssuerService] 解析響應失敗:', error);
      return {};
    }
  }
}

export const documentIssuerService = new DocumentIssuerService();
```

### 公司自動創建服務

```typescript
// src/services/company-auto-create.service.ts（擴展）

/**
 * @fileoverview 公司自動創建服務
 * @description
 *   根據識別結果匹配現有公司或創建新公司
 *   支援模糊匹配和相似度計算
 *
 * @module src/services/company-auto-create
 * @since Epic 0 - Story 0.3
 * @lastModified 2026-01-02 (Epic 15 - Story 15.2 整合)
 */

import { prisma } from '@/lib/prisma';
import { SYSTEM_USER_ID } from '@/lib/constants';

export interface MatchOrCreateInput {
  /** 識別的公司名稱 */
  name: string;
  /** 識別信心度 */
  confidence: number;
  /** 來源文件 ID */
  sourceFileId?: string;
  /** 是否允許自動創建 */
  autoCreate?: boolean;
}

export interface MatchOrCreateResult {
  /** 公司 ID */
  companyId: string;
  /** 匹配分數 (0-1) */
  matchScore: number;
  /** 是否為新創建的公司 */
  isNewCompany: boolean;
  /** 匹配方法 */
  matchMethod: 'exact' | 'fuzzy' | 'created';
}

// 最小匹配分數閾值
const MIN_MATCH_SCORE = 0.7;

class CompanyAutoCreateService {
  /**
   * 匹配或創建公司
   */
  async matchOrCreateCompany(input: MatchOrCreateInput): Promise<MatchOrCreateResult> {
    const { name, confidence, sourceFileId, autoCreate = true } = input;

    // 1. 嘗試精確匹配
    const exactMatch = await this.findExactMatch(name);
    if (exactMatch) {
      return {
        companyId: exactMatch.id,
        matchScore: 1.0,
        isNewCompany: false,
        matchMethod: 'exact',
      };
    }

    // 2. 嘗試模糊匹配
    const fuzzyMatch = await this.findFuzzyMatch(name);
    if (fuzzyMatch && fuzzyMatch.score >= MIN_MATCH_SCORE) {
      return {
        companyId: fuzzyMatch.company.id,
        matchScore: fuzzyMatch.score,
        isNewCompany: false,
        matchMethod: 'fuzzy',
      };
    }

    // 3. 如果識別信心度足夠且允許自動創建，創建新公司
    if (autoCreate && confidence >= 0.7) {
      const newCompany = await this.createCompany(name, sourceFileId);
      return {
        companyId: newCompany.id,
        matchScore: confidence,
        isNewCompany: true,
        matchMethod: 'created',
      };
    }

    // 4. 無法匹配且不創建，拋出錯誤
    throw new Error(`無法匹配公司: ${name}`);
  }

  /**
   * 精確匹配
   */
  private async findExactMatch(name: string) {
    const normalizedName = this.normalizeName(name);

    return prisma.company.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { name: { equals: normalizedName, mode: 'insensitive' } },
          { code: { equals: normalizedName, mode: 'insensitive' } },
          {
            aliases: {
              some: {
                alias: { equals: name, mode: 'insensitive' },
              },
            },
          },
        ],
      },
    });
  }

  /**
   * 模糊匹配
   */
  private async findFuzzyMatch(name: string): Promise<{
    company: { id: string; name: string };
    score: number;
  } | null> {
    const normalizedName = this.normalizeName(name);

    // 獲取所有公司進行模糊匹配
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        aliases: {
          select: { alias: true },
        },
      },
    });

    let bestMatch: { company: { id: string; name: string }; score: number } | null = null;

    for (const company of companies) {
      // 計算與公司名稱的相似度
      const nameScore = this.calculateSimilarity(normalizedName, this.normalizeName(company.name));

      // 計算與代碼的相似度
      const codeScore = company.code
        ? this.calculateSimilarity(normalizedName, this.normalizeName(company.code))
        : 0;

      // 計算與別名的最高相似度
      const aliasScores = company.aliases.map((a) =>
        this.calculateSimilarity(normalizedName, this.normalizeName(a.alias))
      );
      const maxAliasScore = aliasScores.length > 0 ? Math.max(...aliasScores) : 0;

      // 取最高分
      const score = Math.max(nameScore, codeScore, maxAliasScore);

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          company: { id: company.id, name: company.name },
          score,
        };
      }
    }

    return bestMatch;
  }

  /**
   * 創建新公司
   */
  private async createCompany(name: string, sourceFileId?: string) {
    const code = this.generateCompanyCode(name);

    return prisma.company.create({
      data: {
        name,
        code,
        isAutoCreated: true,
        autoCreateSource: sourceFileId,
        createdById: SYSTEM_USER_ID,
      },
    });
  }

  /**
   * 正規化名稱
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]/g, '') // 保留字母、數字、中文
      .trim();
  }

  /**
   * 計算字符串相似度 (Levenshtein distance based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    const longerLength = longer.length;
    if (longerLength === 0) return 1;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longerLength - distance) / longerLength;
  }

  /**
   * Levenshtein 距離計算
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }

    return costs[s2.length];
  }

  /**
   * 生成公司代碼
   */
  private generateCompanyCode(name: string): string {
    // 取英文部分的首字母或中文的前兩個字
    const englishMatch = name.match(/[A-Za-z]+/g);
    if (englishMatch) {
      const initials = englishMatch
        .map((word) => word[0].toUpperCase())
        .join('')
        .substring(0, 5);
      return `AUTO_${initials}_${Date.now().toString(36).toUpperCase()}`;
    }

    // 中文名稱
    const chineseChars = name.match(/[\u4e00-\u9fff]/g);
    if (chineseChars) {
      return `AUTO_${chineseChars.slice(0, 2).join('')}_${Date.now().toString(36).toUpperCase()}`;
    }

    return `AUTO_${Date.now().toString(36).toUpperCase()}`;
  }
}

export const companyAutoCreateService = new CompanyAutoCreateService();
```

### 功能開關擴展

```typescript
// src/lib/feature-flags.ts（擴展）

/**
 * 功能開關配置 - 發行者識別相關
 */
export const FEATURE_FLAGS = {
  // ... 現有的功能開關

  /**
   * 啟用發行者識別
   * 控制統一處理器是否執行發行者識別步驟
   */
  ENABLE_ISSUER_IDENTIFICATION:
    process.env.ENABLE_ISSUER_IDENTIFICATION !== 'false',

  /**
   * 啟用自動創建公司
   * 當無法匹配現有公司時，是否自動創建新公司
   */
  ENABLE_AUTO_CREATE_COMPANY:
    process.env.ENABLE_AUTO_CREATE_COMPANY !== 'false',

  /**
   * 發行者識別最低信心度
   * 低於此閾值的識別結果將被忽略
   */
  ISSUER_IDENTIFICATION_MIN_CONFIDENCE:
    parseFloat(process.env.ISSUER_IDENTIFICATION_MIN_CONFIDENCE || '0.5'),

  /**
   * 自動創建公司最低信心度
   * 識別信心度低於此值時不自動創建公司
   */
  AUTO_CREATE_COMPANY_MIN_CONFIDENCE:
    parseFloat(process.env.AUTO_CREATE_COMPANY_MIN_CONFIDENCE || '0.7'),
};
```

### 統一處理器整合

```typescript
// src/services/unified-document-processor.service.ts（更新）

import { IssuerIdentificationStep } from './steps/issuer-identification.step';

/**
 * 統一文件處理器
 */
export class UnifiedDocumentProcessor {
  private pipeline: ProcessingStep[] = [
    new FileTypeDetectionStep(),
    new ProcessingRouterStep(),
    new AzureDIExtractionStep(),
    new IssuerIdentificationStep(),  // 新增：發行者識別步驟
    new FormatMatchingStep(),
    new ConfigResolutionStep(),
    new GPTEnhancedExtractionStep(),
    new FieldMappingStep(),
    new TermRecordingStep(),
    new ConfidenceCalculationStep(),
    new RoutingDecisionStep(),
  ];

  // ... 其他方法保持不變
}
```

---

## 📁 檔案結構

```
新增/修改檔案:
├── src/
│   ├── types/
│   │   └── processing-context.ts                  # 擴展發行者識別類型
│   ├── services/
│   │   ├── unified-processor/
│   │   │   └── steps/
│   │   │       └── issuer-identification.step.ts  # 發行者識別步驟
│   │   ├── document-issuer.service.ts             # 發行者識別服務（整合）
│   │   └── company-auto-create.service.ts         # 公司自動創建服務（整合）
│   ├── lib/
│   │   └── feature-flags.ts                       # 功能開關擴展
│   └── services/
│       └── unified-document-processor.service.ts  # 整合步驟
```

---

## 🧪 測試案例

### 單元測試

```typescript
// tests/unit/services/steps/issuer-identification.step.test.ts

import { IssuerIdentificationStep } from '@/services/unified-processor/steps/issuer-identification.step';
import { documentIssuerService } from '@/services/document-issuer.service';
import { companyAutoCreateService } from '@/services/company-auto-create.service';

jest.mock('@/services/document-issuer.service');
jest.mock('@/services/company-auto-create.service');

describe('IssuerIdentificationStep', () => {
  const step = new IssuerIdentificationStep();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should identify issuer and match company', async () => {
      const context = {
        fileId: 'file-1',
        filePath: '/path/to/invoice.pdf',
        errors: [],
        warnings: [],
        stepTimings: {},
      };

      (documentIssuerService.extractDocumentIssuer as jest.Mock).mockResolvedValue({
        success: true,
        issuer: {
          name: 'DHL Express',
          method: 'LOGO',
          confidence: 0.95,
        },
      });

      (companyAutoCreateService.matchOrCreateCompany as jest.Mock).mockResolvedValue({
        companyId: 'company-dhl',
        matchScore: 0.98,
        isNewCompany: false,
      });

      await step.execute(context as any);

      expect(context.identifiedCompanyId).toBe('company-dhl');
      expect(context.issuerConfidence).toBe(0.95);
      expect(context.issuerIdentificationMethod).toBe('LOGO');
      expect(context.errors).toHaveLength(0);
    });

    it('should handle identification failure gracefully', async () => {
      const context = {
        fileId: 'file-1',
        filePath: '/path/to/invoice.pdf',
        errors: [],
        warnings: [],
        stepTimings: {},
      };

      (documentIssuerService.extractDocumentIssuer as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Cannot identify issuer',
      });

      await step.execute(context as any);

      expect(context.identifiedCompanyId).toBeUndefined();
      expect(context.warnings).toContain('無法識別文件發行者');
      expect(context.errors).toHaveLength(0); // 不應該是錯誤
    });

    it('should create new company when no match found', async () => {
      const context = {
        fileId: 'file-1',
        filePath: '/path/to/invoice.pdf',
        errors: [],
        warnings: [],
        stepTimings: {},
      };

      (documentIssuerService.extractDocumentIssuer as jest.Mock).mockResolvedValue({
        success: true,
        issuer: {
          name: 'New Logistics Co',
          method: 'HEADER',
          confidence: 0.85,
        },
      });

      (companyAutoCreateService.matchOrCreateCompany as jest.Mock).mockResolvedValue({
        companyId: 'company-new',
        matchScore: 0.85,
        isNewCompany: true,
      });

      await step.execute(context as any);

      expect(context.issuerIdentification?.isNewCompany).toBe(true);
      expect(context.identifiedCompanyId).toBe('company-new');
    });
  });
});
```

### 整合測試

```typescript
// tests/integration/unified-processor/issuer-identification.test.ts

import { UnifiedDocumentProcessor } from '@/services/unified-document-processor.service';
import { prisma } from '@/lib/prisma';

describe('UnifiedDocumentProcessor - Issuer Identification', () => {
  const processor = new UnifiedDocumentProcessor();

  beforeEach(async () => {
    // 清理測試數據
    await prisma.company.deleteMany({ where: { isAutoCreated: true } });
  });

  it('should identify issuer and link to existing company', async () => {
    // 準備測試公司
    const company = await prisma.company.create({
      data: {
        name: 'DHL Express',
        code: 'DHL',
        createdById: 'test-user',
      },
    });

    const result = await processor.process('test-file-id');

    expect(result.context.identifiedCompanyId).toBe(company.id);
    expect(result.context.issuerConfidence).toBeGreaterThan(0.7);
  });

  it('should auto-create company when not found', async () => {
    const result = await processor.process('test-file-id-new-company');

    expect(result.context.identifiedCompanyId).toBeDefined();
    expect(result.context.issuerIdentification?.isNewCompany).toBe(true);

    // 驗證公司已創建
    const company = await prisma.company.findUnique({
      where: { id: result.context.identifiedCompanyId },
    });
    expect(company).not.toBeNull();
    expect(company?.isAutoCreated).toBe(true);
  });
});
```

---

## 📋 實施檢查清單

### 開發階段
- [ ] 擴展 ProcessingContext 類型
- [ ] 實現 IssuerIdentificationStep
- [ ] 整合 documentIssuerService
- [ ] 整合 companyAutoCreateService
- [ ] 擴展功能開關
- [ ] 更新 UnifiedDocumentProcessor
- [ ] 添加步驟計時記錄

### 測試階段
- [ ] 單元測試：IssuerIdentificationStep
- [ ] 單元測試：公司匹配邏輯
- [ ] 整合測試：完整處理流程
- [ ] 錯誤處理測試

### 文檔階段
- [ ] 更新 API 文檔
- [ ] 更新功能開關說明

---

## 🔗 相關文檔

- **Epic 概覽**: `claudedocs/1-planning/epics/epic-15/epic-15-overview.md`
- **Story 15-1**: 處理流程重構 - 統一入口
- **Story 15-3**: 格式匹配與動態配置
- **Epic 0 參考**: Story 0-8 (發行者識別), Story 0-3 (JIT 公司配置)

---

*Story created: 2026-01-02*
*Last updated: 2026-01-02*
