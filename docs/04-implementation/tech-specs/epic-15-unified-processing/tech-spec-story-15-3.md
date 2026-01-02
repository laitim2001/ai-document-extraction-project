# Tech Spec: Story 15.3 - 格式匹配與動態配置

## 概述

### 目標
根據識別的 Company 和文件特徵匹配 DocumentFormat，並動態獲取 Epic 13 的欄位映射配置和 Epic 14 的 Prompt 配置，實現每個文件使用最適合的處理策略。

### 前置條件
- Story 15.2 完成（發行者識別整合）
- Epic 13 完成（欄位映射配置 API）
- Epic 14 完成（Prompt 配置 API）

---

## 類型定義

### 格式匹配相關類型

```typescript
// src/types/format-matching.ts

/**
 * 格式匹配方法
 */
export enum FormatMatchMethod {
  /** 精確匹配 - 基於已知格式特徵 */
  EXACT = 'EXACT',
  /** 相似度匹配 - 基於特徵相似度 */
  SIMILARITY = 'SIMILARITY',
  /** AI 推斷 - 使用 GPT 分析 */
  AI_INFERENCE = 'AI_INFERENCE',
  /** 自動創建 - 無匹配時創建新格式 */
  AUTO_CREATED = 'AUTO_CREATED',
}

/**
 * 格式狀態
 */
export enum FormatStatus {
  /** 已驗證 - 經過人工確認 */
  VERIFIED = 'VERIFIED',
  /** 待驗證 - 需要人工確認 */
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  /** 自動創建 - 系統自動創建 */
  AUTO_CREATED = 'AUTO_CREATED',
  /** 已停用 */
  INACTIVE = 'INACTIVE',
}

/**
 * 文件特徵（用於格式匹配）
 */
export interface DocumentCharacteristics {
  /** 頁數 */
  pageCount: number;
  /** 是否有表格 */
  hasTables: boolean;
  /** 表格數量 */
  tableCount: number;
  /** 是否有 Logo */
  hasLogo: boolean;
  /** Logo 位置 */
  logoPosition?: 'TOP_LEFT' | 'TOP_CENTER' | 'TOP_RIGHT';
  /** 文件佈局類型 */
  layoutType: 'PORTRAIT' | 'LANDSCAPE' | 'MIXED';
  /** 主要語言 */
  primaryLanguage?: string;
  /** 貨幣符號 */
  currencySymbols: string[];
  /** 發現的關鍵欄位 */
  detectedFields: string[];
  /** 標題/表頭文字 */
  headerTexts: string[];
  /** 頁腳文字 */
  footerTexts: string[];
}

/**
 * 格式匹配結果
 */
export interface FormatMatchResult {
  /** 匹配是否成功 */
  success: boolean;
  /** 匹配到的格式 ID */
  documentFormatId?: string;
  /** 格式名稱 */
  formatName?: string;
  /** 匹配信心度 (0-100) */
  confidence: number;
  /** 匹配方法 */
  method: FormatMatchMethod;
  /** 是否為新創建的格式 */
  isNewFormat: boolean;
  /** 是否需要驗證 */
  needsVerification: boolean;
  /** 候選格式列表 */
  candidates: FormatCandidate[];
  /** 匹配詳情 */
  matchDetails: FormatMatchDetails;
}

/**
 * 格式候選項
 */
export interface FormatCandidate {
  documentFormatId: string;
  formatName: string;
  companyId: string;
  companyName: string;
  confidence: number;
  matchedFeatures: string[];
  mismatchedFeatures: string[];
}

/**
 * 格式匹配詳情
 */
export interface FormatMatchDetails {
  /** 匹配的特徵 */
  matchedCharacteristics: string[];
  /** 不匹配的特徵 */
  mismatchedCharacteristics: string[];
  /** 特徵相似度分數 */
  similarityScore: number;
  /** 使用的匹配策略 */
  strategyUsed: string;
  /** 處理時間 (ms) */
  processingTimeMs: number;
}
```

### 動態配置相關類型

```typescript
// src/types/dynamic-config.ts

/**
 * 配置來源層級
 */
export enum ConfigSource {
  /** 格式專屬配置 */
  FORMAT = 'FORMAT',
  /** 公司專屬配置 */
  COMPANY = 'COMPANY',
  /** 全局配置 */
  GLOBAL = 'GLOBAL',
  /** 系統預設 */
  DEFAULT = 'DEFAULT',
}

/**
 * 動態配置上下文
 */
export interface DynamicConfigContext {
  /** 公司 ID */
  companyId?: string;
  /** 文件格式 ID */
  documentFormatId?: string;
  /** 處理方法 */
  processingMethod?: ProcessingMethod;
  /** 文件類型 */
  fileType?: FileType;
}

/**
 * 統一動態配置
 */
export interface UnifiedDynamicConfig {
  /** 欄位映射配置 (Epic 13) */
  fieldMappingConfig: FieldMappingConfig;
  /** Prompt 配置 (Epic 14) */
  promptConfig: ResolvedPromptConfig;
  /** 配置元數據 */
  metadata: ConfigMetadata;
}

/**
 * 欄位映射配置 (來自 Epic 13)
 */
export interface FieldMappingConfig {
  /** 配置 ID */
  configId: string;
  /** 配置來源 */
  source: ConfigSource;
  /** 映射規則 */
  mappings: FieldMapping[];
  /** 必填欄位 */
  requiredFields: string[];
  /** 可選欄位 */
  optionalFields: string[];
  /** 欄位驗證規則 */
  validationRules: FieldValidationRule[];
  /** 轉換規則 */
  transformRules: FieldTransformRule[];
}

/**
 * 欄位映射
 */
export interface FieldMapping {
  /** 源欄位（AI 提取） */
  sourceField: string;
  /** 目標欄位（系統標準） */
  targetField: string;
  /** 映射類型 */
  mappingType: 'DIRECT' | 'TRANSFORM' | 'COMPUTED' | 'CONDITIONAL';
  /** 轉換函數名 */
  transformFunction?: string;
  /** 條件表達式 */
  condition?: string;
  /** 默認值 */
  defaultValue?: string;
  /** 信心度權重 */
  confidenceWeight: number;
}

/**
 * 欄位驗證規則
 */
export interface FieldValidationRule {
  field: string;
  type: 'REQUIRED' | 'FORMAT' | 'RANGE' | 'ENUM' | 'CUSTOM';
  rule: string;
  errorMessage: string;
}

/**
 * 欄位轉換規則
 */
export interface FieldTransformRule {
  field: string;
  transformType: 'DATE_FORMAT' | 'NUMBER_FORMAT' | 'TEXT_CASE' | 'TRIM' | 'REPLACE' | 'CUSTOM';
  params: Record<string, unknown>;
}

/**
 * 已解析的 Prompt 配置 (來自 Epic 14)
 */
export interface ResolvedPromptConfig {
  /** 配置 ID */
  configId: string;
  /** 配置來源 */
  source: ConfigSource;
  /** 發行者識別 Prompt */
  issuerIdentificationPrompt?: string;
  /** 術語分類 Prompt */
  termClassificationPrompt?: string;
  /** 欄位提取 Prompt */
  fieldExtractionPrompt?: string;
  /** 驗證 Prompt */
  validationPrompt?: string;
  /** 已知術語列表（注入到 Prompt） */
  knownTerms: string[];
  /** 特殊指令 */
  specialInstructions: string[];
}

/**
 * 配置元數據
 */
export interface ConfigMetadata {
  /** 欄位映射配置來源 */
  fieldMappingSource: ConfigSource;
  /** Prompt 配置來源 */
  promptConfigSource: ConfigSource;
  /** 配置載入時間 */
  loadedAt: Date;
  /** 配置版本 */
  versions: {
    fieldMapping: string;
    prompt: string;
  };
  /** 是否使用緩存 */
  fromCache: boolean;
  /** 配置匹配程度分數 (用於信心度計算) */
  configMatchScore: number;
}
```

---

## 核心服務

### 格式匹配適配器

```typescript
// src/services/unified-processing/format-matcher-adapter.ts

import { prisma } from '@/lib/prisma';
import { documentFormatService } from '@/services/document-format.service';
import { gptVisionService } from '@/services/gpt-vision.service';
import {
  ProcessingContext,
  ProcessingStep,
  StepPriority,
} from '@/types/unified-processing';
import {
  DocumentCharacteristics,
  FormatMatchResult,
  FormatMatchMethod,
  FormatStatus,
  FormatCandidate,
} from '@/types/format-matching';
import { IStepHandler, StepResult } from './step-handler.interface';
import { UnifiedProcessorFlags } from './feature-flags';

/**
 * @fileoverview 格式匹配適配器
 * @description
 *   將現有的 DocumentFormat 服務適配到統一處理流程中
 *   支援多種匹配策略：精確匹配、相似度匹配、AI 推斷
 *   自動創建新格式（可配置）
 *
 * @module src/services/unified-processing
 * @since Epic 15 - Story 15.3
 */

/**
 * 格式匹配器配置
 */
export interface FormatMatcherConfig {
  /** 是否自動創建新格式 */
  autoCreateFormat: boolean;
  /** 精確匹配信心度閾值 */
  exactMatchThreshold: number;
  /** 相似度匹配信心度閾值 */
  similarityMatchThreshold: number;
  /** 是否使用 AI 推斷 */
  enableAiInference: boolean;
  /** AI 推斷最低信心度 */
  aiInferenceMinConfidence: number;
  /** 最大候選格式數量 */
  maxCandidates: number;
}

const DEFAULT_CONFIG: FormatMatcherConfig = {
  autoCreateFormat: true,
  exactMatchThreshold: 90,
  similarityMatchThreshold: 70,
  enableAiInference: true,
  aiInferenceMinConfidence: 60,
  maxCandidates: 5,
};

export class FormatMatcherAdapter implements IStepHandler {
  readonly step = ProcessingStep.FORMAT_MATCHING;
  readonly priority = StepPriority.OPTIONAL;

  private config: FormatMatcherConfig;
  private characteristicsExtractor: CharacteristicsExtractor;
  private similarityCalculator: SimilarityCalculator;

  constructor(config: Partial<FormatMatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.characteristicsExtractor = new CharacteristicsExtractor();
    this.similarityCalculator = new SimilarityCalculator();
  }

  /**
   * 執行格式匹配步驟
   */
  async execute(context: ProcessingContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 檢查是否啟用
      if (!UnifiedProcessorFlags.ENABLE_FORMAT_MATCHING) {
        return {
          step: this.step,
          success: true,
          skipped: true,
          message: 'Format matching disabled by feature flag',
          duration: Date.now() - startTime,
        };
      }

      // 檢查是否有 companyId
      if (!context.companyId) {
        return {
          step: this.step,
          success: true,
          skipped: true,
          message: 'No company identified, skipping format matching',
          duration: Date.now() - startTime,
        };
      }

      // 提取文件特徵
      const characteristics = await this.extractCharacteristics(context);

      // 執行格式匹配
      const matchResult = await this.matchFormat(
        context.companyId,
        characteristics,
        context.extractedData
      );

      // 更新 context
      if (matchResult.success && matchResult.documentFormatId) {
        context.documentFormatId = matchResult.documentFormatId;
        context.formatMatchResult = matchResult;
      }

      return {
        step: this.step,
        success: true,
        data: matchResult,
        duration: Date.now() - startTime,
        metadata: {
          method: matchResult.method,
          confidence: matchResult.confidence,
          isNewFormat: matchResult.isNewFormat,
          candidateCount: matchResult.candidates.length,
        },
      };

    } catch (error) {
      return {
        step: this.step,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 提取文件特徵
   */
  private async extractCharacteristics(
    context: ProcessingContext
  ): Promise<DocumentCharacteristics> {
    return this.characteristicsExtractor.extract(
      context.extractedData,
      context.fileBuffer,
      context.mimeType
    );
  }

  /**
   * 匹配格式
   */
  private async matchFormat(
    companyId: string,
    characteristics: DocumentCharacteristics,
    extractedData?: ExtractedDocumentData
  ): Promise<FormatMatchResult> {
    const startTime = Date.now();

    // 1. 獲取該公司的所有格式
    const companyFormats = await this.getCompanyFormats(companyId);

    // 2. 嘗試精確匹配
    const exactMatch = await this.tryExactMatch(companyFormats, characteristics);
    if (exactMatch && exactMatch.confidence >= this.config.exactMatchThreshold) {
      return this.buildMatchResult(exactMatch, FormatMatchMethod.EXACT, startTime);
    }

    // 3. 嘗試相似度匹配
    const similarityMatch = await this.trySimilarityMatch(
      companyFormats,
      characteristics
    );
    if (similarityMatch && similarityMatch.confidence >= this.config.similarityMatchThreshold) {
      return this.buildMatchResult(similarityMatch, FormatMatchMethod.SIMILARITY, startTime);
    }

    // 4. 嘗試 AI 推斷
    if (this.config.enableAiInference && extractedData) {
      const aiMatch = await this.tryAiInference(
        companyId,
        companyFormats,
        characteristics,
        extractedData
      );
      if (aiMatch && aiMatch.confidence >= this.config.aiInferenceMinConfidence) {
        return this.buildMatchResult(aiMatch, FormatMatchMethod.AI_INFERENCE, startTime);
      }
    }

    // 5. 自動創建新格式
    if (this.config.autoCreateFormat) {
      const newFormat = await this.createNewFormat(companyId, characteristics);
      return {
        success: true,
        documentFormatId: newFormat.id,
        formatName: newFormat.name,
        confidence: 50, // 新創建的格式信心度較低
        method: FormatMatchMethod.AUTO_CREATED,
        isNewFormat: true,
        needsVerification: true,
        candidates: [],
        matchDetails: {
          matchedCharacteristics: [],
          mismatchedCharacteristics: [],
          similarityScore: 0,
          strategyUsed: 'AUTO_CREATE',
          processingTimeMs: Date.now() - startTime,
        },
      };
    }

    // 6. 無法匹配
    return {
      success: false,
      confidence: 0,
      method: FormatMatchMethod.EXACT,
      isNewFormat: false,
      needsVerification: false,
      candidates: this.getTopCandidates([
        ...(exactMatch ? [exactMatch] : []),
        ...(similarityMatch ? [similarityMatch] : []),
      ]),
      matchDetails: {
        matchedCharacteristics: [],
        mismatchedCharacteristics: Object.keys(characteristics),
        similarityScore: 0,
        strategyUsed: 'NONE',
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * 獲取公司的所有格式
   */
  private async getCompanyFormats(companyId: string) {
    return prisma.documentFormat.findMany({
      where: {
        companyId,
        status: { in: ['VERIFIED', 'PENDING_VERIFICATION', 'AUTO_CREATED'] },
      },
      include: {
        characteristics: true,
        knownTerms: true,
      },
    });
  }

  /**
   * 嘗試精確匹配
   */
  private async tryExactMatch(
    formats: any[],
    characteristics: DocumentCharacteristics
  ): Promise<FormatCandidate | null> {
    for (const format of formats) {
      if (!format.characteristics) continue;

      const matchScore = this.calculateExactMatchScore(
        format.characteristics,
        characteristics
      );

      if (matchScore >= this.config.exactMatchThreshold) {
        return {
          documentFormatId: format.id,
          formatName: format.name,
          companyId: format.companyId,
          companyName: format.company?.name || '',
          confidence: matchScore,
          matchedFeatures: this.getMatchedFeatures(format.characteristics, characteristics),
          mismatchedFeatures: this.getMismatchedFeatures(format.characteristics, characteristics),
        };
      }
    }
    return null;
  }

  /**
   * 嘗試相似度匹配
   */
  private async trySimilarityMatch(
    formats: any[],
    characteristics: DocumentCharacteristics
  ): Promise<FormatCandidate | null> {
    let bestMatch: FormatCandidate | null = null;
    let bestScore = 0;

    for (const format of formats) {
      const score = this.similarityCalculator.calculate(
        format.characteristics || {},
        characteristics
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          documentFormatId: format.id,
          formatName: format.name,
          companyId: format.companyId,
          companyName: format.company?.name || '',
          confidence: score,
          matchedFeatures: this.getMatchedFeatures(format.characteristics, characteristics),
          mismatchedFeatures: this.getMismatchedFeatures(format.characteristics, characteristics),
        };
      }
    }

    return bestMatch;
  }

  /**
   * 嘗試 AI 推斷
   */
  private async tryAiInference(
    companyId: string,
    formats: any[],
    characteristics: DocumentCharacteristics,
    extractedData: ExtractedDocumentData
  ): Promise<FormatCandidate | null> {
    try {
      const formatDescriptions = formats.map(f => ({
        id: f.id,
        name: f.name,
        description: f.description,
        knownTerms: f.knownTerms?.map((t: any) => t.term) || [],
      }));

      const result = await gptVisionService.inferDocumentFormat(
        characteristics,
        extractedData,
        formatDescriptions
      );

      if (result.matchedFormatId) {
        const matchedFormat = formats.find(f => f.id === result.matchedFormatId);
        if (matchedFormat) {
          return {
            documentFormatId: matchedFormat.id,
            formatName: matchedFormat.name,
            companyId: matchedFormat.companyId,
            companyName: matchedFormat.company?.name || '',
            confidence: result.confidence,
            matchedFeatures: result.matchReasons || [],
            mismatchedFeatures: [],
          };
        }
      }

      return null;
    } catch (error) {
      console.warn('[FormatMatcherAdapter] AI inference failed:', error);
      return null;
    }
  }

  /**
   * 創建新格式
   */
  private async createNewFormat(
    companyId: string,
    characteristics: DocumentCharacteristics
  ) {
    const formatName = this.generateFormatName(characteristics);

    return prisma.documentFormat.create({
      data: {
        companyId,
        name: formatName,
        status: FormatStatus.AUTO_CREATED,
        characteristics: {
          create: {
            pageCount: characteristics.pageCount,
            hasTables: characteristics.hasTables,
            tableCount: characteristics.tableCount,
            hasLogo: characteristics.hasLogo,
            logoPosition: characteristics.logoPosition,
            layoutType: characteristics.layoutType,
            primaryLanguage: characteristics.primaryLanguage,
            currencySymbols: characteristics.currencySymbols,
            detectedFields: characteristics.detectedFields,
            headerTexts: characteristics.headerTexts,
            footerTexts: characteristics.footerTexts,
          },
        },
        pendingVerification: {
          create: {
            reason: 'AUTO_CREATED',
            createdAt: new Date(),
          },
        },
      },
    });
  }

  /**
   * 生成格式名稱
   */
  private generateFormatName(characteristics: DocumentCharacteristics): string {
    const parts: string[] = [];

    if (characteristics.layoutType) {
      parts.push(characteristics.layoutType);
    }
    if (characteristics.hasTables) {
      parts.push(`${characteristics.tableCount}Tables`);
    }
    if (characteristics.primaryLanguage) {
      parts.push(characteristics.primaryLanguage.toUpperCase());
    }

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    parts.push(timestamp);

    return `AutoFormat_${parts.join('_')}`;
  }

  /**
   * 構建匹配結果
   */
  private buildMatchResult(
    candidate: FormatCandidate,
    method: FormatMatchMethod,
    startTime: number
  ): FormatMatchResult {
    return {
      success: true,
      documentFormatId: candidate.documentFormatId,
      formatName: candidate.formatName,
      confidence: candidate.confidence,
      method,
      isNewFormat: false,
      needsVerification: candidate.confidence < 80,
      candidates: [candidate],
      matchDetails: {
        matchedCharacteristics: candidate.matchedFeatures,
        mismatchedCharacteristics: candidate.mismatchedFeatures,
        similarityScore: candidate.confidence,
        strategyUsed: method,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  // ... 輔助方法
  private calculateExactMatchScore(stored: any, current: DocumentCharacteristics): number {
    // 實現精確匹配分數計算
    let score = 100;
    const weights = {
      layoutType: 20,
      hasTables: 15,
      tableCount: 10,
      hasLogo: 10,
      logoPosition: 5,
      pageCount: 5,
      primaryLanguage: 10,
      currencySymbols: 10,
      detectedFields: 15,
    };

    if (stored.layoutType !== current.layoutType) score -= weights.layoutType;
    if (stored.hasTables !== current.hasTables) score -= weights.hasTables;
    if (stored.tableCount !== current.tableCount) score -= weights.tableCount;
    if (stored.hasLogo !== current.hasLogo) score -= weights.hasLogo;
    if (stored.logoPosition !== current.logoPosition) score -= weights.logoPosition;
    // ... 更多比較

    return Math.max(0, score);
  }

  private getMatchedFeatures(stored: any, current: DocumentCharacteristics): string[] {
    const matched: string[] = [];
    if (stored?.layoutType === current.layoutType) matched.push('layoutType');
    if (stored?.hasTables === current.hasTables) matched.push('hasTables');
    if (stored?.hasLogo === current.hasLogo) matched.push('hasLogo');
    // ... 更多特徵
    return matched;
  }

  private getMismatchedFeatures(stored: any, current: DocumentCharacteristics): string[] {
    const mismatched: string[] = [];
    if (stored?.layoutType !== current.layoutType) mismatched.push('layoutType');
    if (stored?.hasTables !== current.hasTables) mismatched.push('hasTables');
    if (stored?.hasLogo !== current.hasLogo) mismatched.push('hasLogo');
    // ... 更多特徵
    return mismatched;
  }

  private getTopCandidates(candidates: FormatCandidate[]): FormatCandidate[] {
    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxCandidates);
  }
}

/**
 * 特徵提取器
 */
class CharacteristicsExtractor {
  async extract(
    extractedData?: ExtractedDocumentData,
    fileBuffer?: Buffer,
    mimeType?: string
  ): Promise<DocumentCharacteristics> {
    // 從提取的數據中提取文件特徵
    const invoiceData = extractedData?.invoiceData;

    return {
      pageCount: extractedData?.pageCount || 1,
      hasTables: (extractedData?.tables?.length || 0) > 0,
      tableCount: extractedData?.tables?.length || 0,
      hasLogo: !!extractedData?.logoDetected,
      logoPosition: extractedData?.logoPosition,
      layoutType: this.detectLayoutType(extractedData),
      primaryLanguage: this.detectLanguage(extractedData),
      currencySymbols: this.extractCurrencySymbols(invoiceData),
      detectedFields: this.extractDetectedFields(invoiceData),
      headerTexts: this.extractHeaderTexts(extractedData),
      footerTexts: this.extractFooterTexts(extractedData),
    };
  }

  private detectLayoutType(data?: ExtractedDocumentData): 'PORTRAIT' | 'LANDSCAPE' | 'MIXED' {
    if (!data?.pageInfo) return 'PORTRAIT';
    // 基於頁面尺寸判斷
    const { width, height } = data.pageInfo;
    if (width > height) return 'LANDSCAPE';
    return 'PORTRAIT';
  }

  private detectLanguage(data?: ExtractedDocumentData): string {
    return data?.detectedLanguage || 'en';
  }

  private extractCurrencySymbols(invoiceData?: any): string[] {
    const symbols = new Set<string>();
    if (invoiceData?.totalAmount?.currency) {
      symbols.add(invoiceData.totalAmount.currency);
    }
    if (invoiceData?.lineItems) {
      for (const item of invoiceData.lineItems) {
        if (item.amount?.currency) {
          symbols.add(item.amount.currency);
        }
      }
    }
    return Array.from(symbols);
  }

  private extractDetectedFields(invoiceData?: any): string[] {
    if (!invoiceData) return [];
    return Object.keys(invoiceData).filter(key => invoiceData[key] !== null);
  }

  private extractHeaderTexts(data?: ExtractedDocumentData): string[] {
    return data?.headerTexts || [];
  }

  private extractFooterTexts(data?: ExtractedDocumentData): string[] {
    return data?.footerTexts || [];
  }
}

/**
 * 相似度計算器
 */
class SimilarityCalculator {
  calculate(stored: any, current: DocumentCharacteristics): number {
    if (!stored) return 0;

    let totalWeight = 0;
    let matchedWeight = 0;

    const features = [
      { key: 'layoutType', weight: 20 },
      { key: 'hasTables', weight: 15 },
      { key: 'hasLogo', weight: 10 },
      { key: 'primaryLanguage', weight: 10 },
    ];

    for (const feature of features) {
      totalWeight += feature.weight;
      if (this.compareFeature(stored[feature.key], (current as any)[feature.key])) {
        matchedWeight += feature.weight;
      }
    }

    // 計算欄位重疊度
    const fieldOverlap = this.calculateFieldOverlap(
      stored.detectedFields || [],
      current.detectedFields
    );
    totalWeight += 25;
    matchedWeight += fieldOverlap * 25;

    // 計算貨幣重疊度
    const currencyOverlap = this.calculateArrayOverlap(
      stored.currencySymbols || [],
      current.currencySymbols
    );
    totalWeight += 10;
    matchedWeight += currencyOverlap * 10;

    return Math.round((matchedWeight / totalWeight) * 100);
  }

  private compareFeature(stored: any, current: any): boolean {
    return stored === current;
  }

  private calculateFieldOverlap(stored: string[], current: string[]): number {
    if (stored.length === 0 && current.length === 0) return 1;
    if (stored.length === 0 || current.length === 0) return 0;

    const storedSet = new Set(stored);
    const overlap = current.filter(f => storedSet.has(f)).length;
    return overlap / Math.max(stored.length, current.length);
  }

  private calculateArrayOverlap(stored: string[], current: string[]): number {
    if (stored.length === 0 && current.length === 0) return 1;
    if (stored.length === 0 || current.length === 0) return 0;

    const storedSet = new Set(stored);
    const overlap = current.filter(s => storedSet.has(s)).length;
    return overlap / Math.max(stored.length, current.length);
  }
}
```

### 動態配置獲取服務

```typescript
// src/services/unified-processing/dynamic-config-fetcher.ts

import {
  ProcessingContext,
  ProcessingStep,
  StepPriority,
} from '@/types/unified-processing';
import {
  ConfigSource,
  DynamicConfigContext,
  UnifiedDynamicConfig,
  FieldMappingConfig,
  ResolvedPromptConfig,
  ConfigMetadata,
} from '@/types/dynamic-config';
import { IStepHandler, StepResult } from './step-handler.interface';
import { UnifiedProcessorFlags } from './feature-flags';

// Epic 13 & 14 服務
import { fieldMappingConfigService } from '@/services/field-mapping-config.service';
import { promptResolverService } from '@/services/prompt-resolver.service';

/**
 * @fileoverview 動態配置獲取服務
 * @description
 *   統一獲取 Epic 13 的欄位映射配置和 Epic 14 的 Prompt 配置
 *   實現三層配置解析：Format > Company > Global
 *   支援配置緩存以提升性能
 *
 * @module src/services/unified-processing
 * @since Epic 15 - Story 15.3
 */

/**
 * 配置緩存
 */
interface ConfigCache {
  key: string;
  config: UnifiedDynamicConfig;
  expiresAt: Date;
}

export class DynamicConfigFetcher implements IStepHandler {
  readonly step = ProcessingStep.CONFIG_FETCHING;
  readonly priority = StepPriority.OPTIONAL;

  private cache: Map<string, ConfigCache> = new Map();
  private cacheTtlMs = 5 * 60 * 1000; // 5 分鐘

  /**
   * 執行配置獲取步驟
   */
  async execute(context: ProcessingContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 檢查是否啟用
      if (!UnifiedProcessorFlags.ENABLE_DYNAMIC_CONFIG) {
        return {
          step: this.step,
          success: true,
          skipped: true,
          message: 'Dynamic config disabled by feature flag',
          duration: Date.now() - startTime,
        };
      }

      // 構建配置上下文
      const configContext: DynamicConfigContext = {
        companyId: context.companyId,
        documentFormatId: context.documentFormatId,
        processingMethod: context.processingMethod,
        fileType: context.fileType,
      };

      // 嘗試從緩存獲取
      const cacheKey = this.buildCacheKey(configContext);
      const cachedConfig = this.getFromCache(cacheKey);

      if (cachedConfig) {
        context.dynamicConfig = cachedConfig;
        return {
          step: this.step,
          success: true,
          data: cachedConfig,
          duration: Date.now() - startTime,
          metadata: {
            fromCache: true,
            fieldMappingSource: cachedConfig.metadata.fieldMappingSource,
            promptConfigSource: cachedConfig.metadata.promptConfigSource,
          },
        };
      }

      // 並行獲取欄位映射配置和 Prompt 配置
      const [fieldMappingConfig, promptConfig] = await Promise.all([
        this.fetchFieldMappingConfig(configContext),
        this.fetchPromptConfig(configContext),
      ]);

      // 構建統一配置
      const unifiedConfig: UnifiedDynamicConfig = {
        fieldMappingConfig,
        promptConfig,
        metadata: {
          fieldMappingSource: fieldMappingConfig.source,
          promptConfigSource: promptConfig.source,
          loadedAt: new Date(),
          versions: {
            fieldMapping: fieldMappingConfig.configId,
            prompt: promptConfig.configId,
          },
          fromCache: false,
          configMatchScore: this.calculateConfigMatchScore(
            fieldMappingConfig.source,
            promptConfig.source
          ),
        },
      };

      // 存入緩存
      this.setCache(cacheKey, unifiedConfig);

      // 更新 context
      context.dynamicConfig = unifiedConfig;

      return {
        step: this.step,
        success: true,
        data: unifiedConfig,
        duration: Date.now() - startTime,
        metadata: {
          fromCache: false,
          fieldMappingSource: fieldMappingConfig.source,
          promptConfigSource: promptConfig.source,
          configMatchScore: unifiedConfig.metadata.configMatchScore,
        },
      };

    } catch (error) {
      // 配置獲取失敗時使用預設配置
      const defaultConfig = this.getDefaultConfig();
      context.dynamicConfig = defaultConfig;

      return {
        step: this.step,
        success: true, // 標記為成功，因為有降級方案
        data: defaultConfig,
        duration: Date.now() - startTime,
        metadata: {
          fromCache: false,
          fallbackToDefault: true,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * 獲取欄位映射配置 (Epic 13)
   */
  private async fetchFieldMappingConfig(
    context: DynamicConfigContext
  ): Promise<FieldMappingConfig> {
    // 1. 嘗試獲取 Format 專屬配置
    if (context.documentFormatId) {
      const formatConfig = await fieldMappingConfigService.getByDocumentFormat(
        context.documentFormatId
      );
      if (formatConfig) {
        return this.transformFieldMappingConfig(formatConfig, ConfigSource.FORMAT);
      }
    }

    // 2. 嘗試獲取 Company 專屬配置
    if (context.companyId) {
      const companyConfig = await fieldMappingConfigService.getByCompany(
        context.companyId
      );
      if (companyConfig) {
        return this.transformFieldMappingConfig(companyConfig, ConfigSource.COMPANY);
      }
    }

    // 3. 獲取 Global 配置
    const globalConfig = await fieldMappingConfigService.getGlobal();
    if (globalConfig) {
      return this.transformFieldMappingConfig(globalConfig, ConfigSource.GLOBAL);
    }

    // 4. 返回預設配置
    return this.getDefaultFieldMappingConfig();
  }

  /**
   * 獲取 Prompt 配置 (Epic 14)
   */
  private async fetchPromptConfig(
    context: DynamicConfigContext
  ): Promise<ResolvedPromptConfig> {
    // 使用 Epic 14 的 PromptResolver 服務
    const resolvedPrompt = await promptResolverService.resolve({
      companyId: context.companyId,
      documentFormatId: context.documentFormatId,
      promptTypes: [
        'ISSUER_IDENTIFICATION',
        'TERM_CLASSIFICATION',
        'FIELD_EXTRACTION',
        'VALIDATION',
      ],
    });

    return {
      configId: resolvedPrompt.configId,
      source: this.mapPromptSource(resolvedPrompt.source),
      issuerIdentificationPrompt: resolvedPrompt.prompts.ISSUER_IDENTIFICATION,
      termClassificationPrompt: resolvedPrompt.prompts.TERM_CLASSIFICATION,
      fieldExtractionPrompt: resolvedPrompt.prompts.FIELD_EXTRACTION,
      validationPrompt: resolvedPrompt.prompts.VALIDATION,
      knownTerms: resolvedPrompt.knownTerms || [],
      specialInstructions: resolvedPrompt.specialInstructions || [],
    };
  }

  /**
   * 轉換欄位映射配置
   */
  private transformFieldMappingConfig(
    config: any,
    source: ConfigSource
  ): FieldMappingConfig {
    return {
      configId: config.id,
      source,
      mappings: config.mappings || [],
      requiredFields: config.requiredFields || [],
      optionalFields: config.optionalFields || [],
      validationRules: config.validationRules || [],
      transformRules: config.transformRules || [],
    };
  }

  /**
   * 映射 Prompt 配置來源
   */
  private mapPromptSource(source: string): ConfigSource {
    switch (source) {
      case 'FORMAT': return ConfigSource.FORMAT;
      case 'COMPANY': return ConfigSource.COMPANY;
      case 'GLOBAL': return ConfigSource.GLOBAL;
      default: return ConfigSource.DEFAULT;
    }
  }

  /**
   * 計算配置匹配分數
   * 用於信心度計算 (Story 15.5)
   */
  private calculateConfigMatchScore(
    fieldMappingSource: ConfigSource,
    promptSource: ConfigSource
  ): number {
    const sourceScores: Record<ConfigSource, number> = {
      [ConfigSource.FORMAT]: 10,
      [ConfigSource.COMPANY]: 5,
      [ConfigSource.GLOBAL]: 1,
      [ConfigSource.DEFAULT]: 0,
    };

    const fieldMappingScore = sourceScores[fieldMappingSource];
    const promptScore = sourceScores[promptSource];

    // 綜合分數（欄位映射權重 60%，Prompt 權重 40%）
    return fieldMappingScore * 0.6 + promptScore * 0.4;
  }

  /**
   * 構建緩存 Key
   */
  private buildCacheKey(context: DynamicConfigContext): string {
    return [
      context.companyId || 'none',
      context.documentFormatId || 'none',
      context.processingMethod || 'none',
    ].join(':');
  }

  /**
   * 從緩存獲取
   */
  private getFromCache(key: string): UnifiedDynamicConfig | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (new Date() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { ...cached.config, metadata: { ...cached.config.metadata, fromCache: true } };
  }

  /**
   * 存入緩存
   */
  private setCache(key: string, config: UnifiedDynamicConfig): void {
    this.cache.set(key, {
      key,
      config,
      expiresAt: new Date(Date.now() + this.cacheTtlMs),
    });
  }

  /**
   * 獲取預設欄位映射配置
   */
  private getDefaultFieldMappingConfig(): FieldMappingConfig {
    return {
      configId: 'default',
      source: ConfigSource.DEFAULT,
      mappings: [],
      requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
      optionalFields: ['invoiceDate', 'dueDate', 'lineItems'],
      validationRules: [],
      transformRules: [],
    };
  }

  /**
   * 獲取預設配置
   */
  private getDefaultConfig(): UnifiedDynamicConfig {
    return {
      fieldMappingConfig: this.getDefaultFieldMappingConfig(),
      promptConfig: {
        configId: 'default',
        source: ConfigSource.DEFAULT,
        knownTerms: [],
        specialInstructions: [],
      },
      metadata: {
        fieldMappingSource: ConfigSource.DEFAULT,
        promptConfigSource: ConfigSource.DEFAULT,
        loadedAt: new Date(),
        versions: { fieldMapping: 'default', prompt: 'default' },
        fromCache: false,
        configMatchScore: 0,
      },
    };
  }

  /**
   * 清除緩存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清除特定公司/格式的緩存
   */
  invalidateCache(companyId?: string, documentFormatId?: string): void {
    for (const [key] of this.cache) {
      if (companyId && key.startsWith(companyId)) {
        this.cache.delete(key);
      } else if (documentFormatId && key.includes(documentFormatId)) {
        this.cache.delete(key);
      }
    }
  }
}
```

---

## Feature Flags 擴展

```typescript
// src/services/unified-processing/feature-flags.ts (擴展)

export const UnifiedProcessorFlags = {
  // ... 既有 flags

  /** 啟用格式匹配 */
  ENABLE_FORMAT_MATCHING: process.env.ENABLE_FORMAT_MATCHING !== 'false',

  /** 啟用動態配置 */
  ENABLE_DYNAMIC_CONFIG: process.env.ENABLE_DYNAMIC_CONFIG !== 'false',

  /** 自動創建格式 */
  AUTO_CREATE_FORMAT: process.env.AUTO_CREATE_FORMAT !== 'false',

  /** 格式匹配精確閾值 */
  FORMAT_EXACT_MATCH_THRESHOLD: parseInt(
    process.env.FORMAT_EXACT_MATCH_THRESHOLD || '90',
    10
  ),

  /** 格式匹配相似度閾值 */
  FORMAT_SIMILARITY_THRESHOLD: parseInt(
    process.env.FORMAT_SIMILARITY_THRESHOLD || '70',
    10
  ),

  /** 啟用 AI 格式推斷 */
  ENABLE_AI_FORMAT_INFERENCE: process.env.ENABLE_AI_FORMAT_INFERENCE !== 'false',

  /** 配置緩存 TTL (毫秒) */
  CONFIG_CACHE_TTL_MS: parseInt(
    process.env.CONFIG_CACHE_TTL_MS || '300000',
    10
  ),
};
```

---

## Prisma Schema 擴展

```prisma
// prisma/schema.prisma (擴展)

model DocumentFormat {
  id                String               @id @default(cuid())
  companyId         String               @map("company_id")
  name              String
  description       String?
  status            FormatStatus         @default(AUTO_CREATED)
  createdAt         DateTime             @default(now()) @map("created_at")
  updatedAt         DateTime             @updatedAt @map("updated_at")

  // 關聯
  company           Company              @relation(fields: [companyId], references: [id])
  characteristics   FormatCharacteristics?
  knownTerms        FormatTerm[]
  fieldMappingConfig FieldMappingConfig?
  promptConfigs     PromptConfig[]
  pendingVerification PendingFormatVerification?
  documents         Document[]

  @@unique([companyId, name])
  @@map("document_formats")
}

enum FormatStatus {
  VERIFIED
  PENDING_VERIFICATION
  AUTO_CREATED
  INACTIVE
}

model FormatCharacteristics {
  id                String   @id @default(cuid())
  documentFormatId  String   @unique @map("document_format_id")
  pageCount         Int?     @map("page_count")
  hasTables         Boolean  @default(false) @map("has_tables")
  tableCount        Int      @default(0) @map("table_count")
  hasLogo           Boolean  @default(false) @map("has_logo")
  logoPosition      String?  @map("logo_position")
  layoutType        String   @default("PORTRAIT") @map("layout_type")
  primaryLanguage   String?  @map("primary_language")
  currencySymbols   String[] @map("currency_symbols")
  detectedFields    String[] @map("detected_fields")
  headerTexts       String[] @map("header_texts")
  footerTexts       String[] @map("footer_texts")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  documentFormat    DocumentFormat @relation(fields: [documentFormatId], references: [id])

  @@map("format_characteristics")
}

model PendingFormatVerification {
  id                String   @id @default(cuid())
  documentFormatId  String   @unique @map("document_format_id")
  reason            String
  sampleDocumentIds String[] @map("sample_document_ids")
  createdAt         DateTime @default(now()) @map("created_at")
  expiresAt         DateTime @map("expires_at")

  documentFormat    DocumentFormat @relation(fields: [documentFormatId], references: [id])

  @@map("pending_format_verifications")
}
```

---

## API 端點

### 格式驗證 API

```typescript
// src/app/api/v1/admin/format-verifications/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middlewares/auth';
import { FormatStatus } from '@prisma/client';

/**
 * GET /api/v1/admin/format-verifications
 * 獲取待驗證的格式列表
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const where = {
    status: { in: [FormatStatus.AUTO_CREATED, FormatStatus.PENDING_VERIFICATION] },
    ...(companyId && { companyId }),
  };

  const [formats, total] = await Promise.all([
    prisma.documentFormat.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        characteristics: true,
        pendingVerification: true,
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.documentFormat.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: formats,
    meta: {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});
```

```typescript
// src/app/api/v1/admin/format-verifications/[id]/verify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middlewares/auth';
import { FormatStatus } from '@prisma/client';
import { z } from 'zod';

const VerifyFormatSchema = z.object({
  action: z.enum(['CONFIRM', 'REJECT', 'MERGE']),
  mergeTargetId: z.string().optional(),
  updatedName: z.string().optional(),
});

/**
 * POST /api/v1/admin/format-verifications/[id]/verify
 * 驗證格式
 */
export const POST = withAuth(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const body = await req.json();
  const { action, mergeTargetId, updatedName } = VerifyFormatSchema.parse(body);

  const format = await prisma.documentFormat.findUnique({
    where: { id: params.id },
    include: { pendingVerification: true },
  });

  if (!format) {
    return NextResponse.json(
      { success: false, error: 'Format not found' },
      { status: 404 }
    );
  }

  switch (action) {
    case 'CONFIRM':
      await prisma.$transaction([
        prisma.documentFormat.update({
          where: { id: params.id },
          data: {
            status: FormatStatus.VERIFIED,
            ...(updatedName && { name: updatedName }),
          },
        }),
        prisma.pendingFormatVerification.delete({
          where: { documentFormatId: params.id },
        }),
      ]);
      break;

    case 'REJECT':
      // 標記為 INACTIVE，但保留數據
      await prisma.$transaction([
        prisma.documentFormat.update({
          where: { id: params.id },
          data: { status: FormatStatus.INACTIVE },
        }),
        prisma.pendingFormatVerification.delete({
          where: { documentFormatId: params.id },
        }),
      ]);
      break;

    case 'MERGE':
      if (!mergeTargetId) {
        return NextResponse.json(
          { success: false, error: 'mergeTargetId required for MERGE action' },
          { status: 400 }
        );
      }
      // 將文件遷移到目標格式，然後刪除當前格式
      await prisma.$transaction([
        prisma.document.updateMany({
          where: { documentFormatId: params.id },
          data: { documentFormatId: mergeTargetId },
        }),
        prisma.pendingFormatVerification.delete({
          where: { documentFormatId: params.id },
        }),
        prisma.documentFormat.delete({
          where: { id: params.id },
        }),
      ]);
      break;
  }

  return NextResponse.json({ success: true });
});
```

---

## 配置失效 API

```typescript
// src/app/api/v1/admin/config-cache/invalidate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { dynamicConfigFetcher } from '@/services/unified-processing';
import { z } from 'zod';

const InvalidateCacheSchema = z.object({
  companyId: z.string().optional(),
  documentFormatId: z.string().optional(),
  all: z.boolean().optional(),
});

/**
 * POST /api/v1/admin/config-cache/invalidate
 * 使配置緩存失效
 */
export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const { companyId, documentFormatId, all } = InvalidateCacheSchema.parse(body);

  if (all) {
    dynamicConfigFetcher.clearCache();
    return NextResponse.json({
      success: true,
      message: 'All config cache cleared',
    });
  }

  if (companyId || documentFormatId) {
    dynamicConfigFetcher.invalidateCache(companyId, documentFormatId);
    return NextResponse.json({
      success: true,
      message: `Cache invalidated for company: ${companyId || 'all'}, format: ${documentFormatId || 'all'}`,
    });
  }

  return NextResponse.json(
    { success: false, error: 'Must specify companyId, documentFormatId, or all' },
    { status: 400 }
  );
});
```

---

## 處理管道整合

```typescript
// src/services/unified-processing/unified-document-processor.ts (擴展)

import { FormatMatcherAdapter } from './format-matcher-adapter';
import { DynamicConfigFetcher } from './dynamic-config-fetcher';

// 在 constructor 中添加步驟處理器
this.stepHandlers.set(ProcessingStep.FORMAT_MATCHING, new FormatMatcherAdapter({
  autoCreateFormat: UnifiedProcessorFlags.AUTO_CREATE_FORMAT,
  exactMatchThreshold: UnifiedProcessorFlags.FORMAT_EXACT_MATCH_THRESHOLD,
  similarityMatchThreshold: UnifiedProcessorFlags.FORMAT_SIMILARITY_THRESHOLD,
  enableAiInference: UnifiedProcessorFlags.ENABLE_AI_FORMAT_INFERENCE,
}));

this.stepHandlers.set(ProcessingStep.CONFIG_FETCHING, new DynamicConfigFetcher());
```

---

## 驗收標準對照

| 驗收標準 | 實現方式 |
|---------|---------|
| 根據發行者 + 文件特徵匹配 DocumentFormat | `FormatMatcherAdapter.matchFormat()` 方法 |
| 如無匹配則建立新格式 | `FormatMatcherAdapter.createNewFormat()` 方法，受 `AUTO_CREATE_FORMAT` flag 控制 |
| 調用 Epic 13 的欄位映射配置 API | `DynamicConfigFetcher.fetchFieldMappingConfig()` |
| 調用 Epic 14 的 Prompt 配置 API | `DynamicConfigFetcher.fetchPromptConfig()` |
| 無特定配置時降級使用 Global 配置 | 三層降級邏輯：Format → Company → Global → Default |
| 記錄配置來源 | `ConfigMetadata` 記錄來源、版本、配置匹配分數 |

---

## 檔案清單

| 檔案路徑 | 用途 |
|---------|------|
| `src/types/format-matching.ts` | 格式匹配類型定義 |
| `src/types/dynamic-config.ts` | 動態配置類型定義 |
| `src/services/unified-processing/format-matcher-adapter.ts` | 格式匹配適配器 |
| `src/services/unified-processing/dynamic-config-fetcher.ts` | 動態配置獲取服務 |
| `src/app/api/v1/admin/format-verifications/route.ts` | 格式驗證列表 API |
| `src/app/api/v1/admin/format-verifications/[id]/verify/route.ts` | 格式驗證操作 API |
| `src/app/api/v1/admin/config-cache/invalidate/route.ts` | 配置緩存失效 API |
| `prisma/schema.prisma` | FormatCharacteristics, PendingFormatVerification 模型 |

---

*Tech Spec 建立日期: 2026-01-02*
*Epic: 15 - 統一 3 層機制到日常處理流程*
*Story: 15.3 - 格式匹配與動態配置*
