# Tech Spec: Story 15.4 - 持續術語學習

## 概述

### 目標
在日常處理中自動識別和記錄新術語到對應的 DocumentFormat，實現系統知識庫的持續擴展，並通過人工審核機制確保術語品質。

### 前置條件
- Story 15.3 完成（格式匹配與動態配置）
- Epic 0 Story 0-9 完成（術語聚合基礎架構）
- Epic 0 Story 0-10 完成（AI 術語驗證）

---

## 類型定義

### 術語學習相關類型

```typescript
// src/types/term-learning.ts

/**
 * 術語狀態
 */
export enum TermStatus {
  /** 待驗證 - 新發現的術語 */
  PENDING = 'PENDING',
  /** 已驗證 - 人工確認有效 */
  VERIFIED = 'VERIFIED',
  /** 已拒絕 - 人工確認無效 */
  REJECTED = 'REJECTED',
  /** 系統術語 - 系統預設 */
  SYSTEM = 'SYSTEM',
  /** 已停用 */
  DEPRECATED = 'DEPRECATED',
}

/**
 * 術語來源
 */
export enum TermSource {
  /** 歷史數據初始化 */
  HISTORICAL_INIT = 'HISTORICAL_INIT',
  /** 日常處理自動發現 */
  DAILY_AUTO = 'DAILY_AUTO',
  /** 人工審核添加 */
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  /** AI 建議 */
  AI_SUGGESTION = 'AI_SUGGESTION',
  /** 系統預設 */
  SYSTEM_DEFAULT = 'SYSTEM_DEFAULT',
}

/**
 * 術語類別
 */
export enum TermCategory {
  /** 費用類 */
  FEE = 'FEE',
  /** 稅金類 */
  TAX = 'TAX',
  /** 折扣類 */
  DISCOUNT = 'DISCOUNT',
  /** 附加費類 */
  SURCHARGE = 'SURCHARGE',
  /** 運輸服務類 */
  TRANSPORT_SERVICE = 'TRANSPORT_SERVICE',
  /** 倉儲類 */
  WAREHOUSING = 'WAREHOUSING',
  /** 報關類 */
  CUSTOMS = 'CUSTOMS',
  /** 保險類 */
  INSURANCE = 'INSURANCE',
  /** 其他 */
  OTHER = 'OTHER',
}

/**
 * 術語實體
 */
export interface Term {
  id: string;
  /** 術語文字 */
  term: string;
  /** 標準化名稱 */
  normalizedName: string;
  /** 術語類別 */
  category: TermCategory;
  /** 術語狀態 */
  status: TermStatus;
  /** 術語來源 */
  source: TermSource;
  /** 所屬文件格式 ID */
  documentFormatId: string;
  /** 所屬公司 ID */
  companyId: string;
  /** 出現次數 */
  occurrenceCount: number;
  /** 信心度 (0-100) */
  confidence: number;
  /** 最後出現日期 */
  lastSeenAt: Date;
  /** 創建日期 */
  createdAt: Date;
  /** 更新日期 */
  updatedAt: Date;
  /** 創建者 ID (人工添加時) */
  createdById?: string;
  /** 驗證者 ID */
  verifiedById?: string;
  /** 驗證日期 */
  verifiedAt?: Date;
  /** 同義詞列表 */
  synonyms: string[];
  /** 備註 */
  notes?: string;
}

/**
 * 新術語檢測結果
 */
export interface NewTermDetectionResult {
  /** 發現的新術語 */
  newTerms: DetectedTerm[];
  /** 匹配到的已知術語 */
  matchedTerms: MatchedTerm[];
  /** 可能的同義詞 */
  potentialSynonyms: SynonymCandidate[];
  /** 處理統計 */
  stats: TermDetectionStats;
}

/**
 * 檢測到的術語
 */
export interface DetectedTerm {
  /** 術語文字 */
  term: string;
  /** 標準化名稱 */
  normalizedName: string;
  /** AI 建議的類別 */
  suggestedCategory: TermCategory;
  /** 信心度 */
  confidence: number;
  /** 來源位置 (line item index) */
  sourceIndex: number;
  /** 來源金額 */
  amount?: number;
  /** 來源貨幣 */
  currency?: string;
}

/**
 * 匹配到的術語
 */
export interface MatchedTerm {
  /** 術語 ID */
  termId: string;
  /** 術語文字 */
  term: string;
  /** 標準化名稱 */
  normalizedName: string;
  /** 類別 */
  category: TermCategory;
  /** 匹配類型 */
  matchType: 'EXACT' | 'NORMALIZED' | 'SYNONYM' | 'FUZZY';
  /** 匹配信心度 */
  matchConfidence: number;
}

/**
 * 同義詞候選
 */
export interface SynonymCandidate {
  /** 新術語 */
  newTerm: string;
  /** 可能的同義詞（已存在的術語） */
  existingTermId: string;
  /** 已存在術語的文字 */
  existingTerm: string;
  /** 相似度 */
  similarity: number;
}

/**
 * 術語檢測統計
 */
export interface TermDetectionStats {
  /** 總術語數 */
  totalTerms: number;
  /** 新術語數 */
  newTermCount: number;
  /** 匹配術語數 */
  matchedTermCount: number;
  /** 潛在同義詞數 */
  potentialSynonymCount: number;
  /** 處理時間 (ms) */
  processingTimeMs: number;
}

/**
 * 術語記錄請求
 */
export interface TermRecordRequest {
  /** 文件 ID */
  documentId: string;
  /** 文件格式 ID */
  documentFormatId: string;
  /** 公司 ID */
  companyId: string;
  /** 檢測到的術語列表 */
  terms: DetectedTerm[];
  /** 是否自動保存新術語 */
  autoSaveNewTerms: boolean;
}

/**
 * 術語審核請求
 */
export interface TermVerificationRequest {
  termId: string;
  action: 'VERIFY' | 'REJECT' | 'UPDATE' | 'MERGE';
  /** 更新的類別 */
  updatedCategory?: TermCategory;
  /** 更新的標準化名稱 */
  updatedNormalizedName?: string;
  /** 合併目標術語 ID */
  mergeTargetId?: string;
  /** 添加的同義詞 */
  addSynonyms?: string[];
  /** 備註 */
  notes?: string;
}
```

---

## 核心服務

### 術語學習服務

```typescript
// src/services/unified-processing/term-learning.service.ts

import { prisma } from '@/lib/prisma';
import {
  ProcessingContext,
  ProcessingStep,
  StepPriority,
} from '@/types/unified-processing';
import {
  Term,
  TermStatus,
  TermSource,
  TermCategory,
  DetectedTerm,
  MatchedTerm,
  NewTermDetectionResult,
  TermRecordRequest,
  SynonymCandidate,
} from '@/types/term-learning';
import { IStepHandler, StepResult } from './step-handler.interface';
import { UnifiedProcessorFlags } from './feature-flags';
import { aiTermValidationService } from '@/services/ai-term-validation.service';

/**
 * @fileoverview 持續術語學習服務
 * @description
 *   在日常處理中自動識別新術語
 *   記錄術語到對應的 DocumentFormat
 *   支援術語驗證和同義詞管理
 *
 * @module src/services/unified-processing
 * @since Epic 15 - Story 15.4
 */

/**
 * 術語學習配置
 */
export interface TermLearningConfig {
  /** 是否自動保存新術語 */
  autoSaveNewTerms: boolean;
  /** 新術語最低信心度閾值 */
  minConfidenceThreshold: number;
  /** 啟用 AI 術語分類 */
  enableAiClassification: boolean;
  /** 啟用同義詞檢測 */
  enableSynonymDetection: boolean;
  /** 同義詞相似度閾值 */
  synonymSimilarityThreshold: number;
  /** 模糊匹配閾值 */
  fuzzyMatchThreshold: number;
}

const DEFAULT_CONFIG: TermLearningConfig = {
  autoSaveNewTerms: true,
  minConfidenceThreshold: 60,
  enableAiClassification: true,
  enableSynonymDetection: true,
  synonymSimilarityThreshold: 0.85,
  fuzzyMatchThreshold: 0.80,
};

export class TermLearningService implements IStepHandler {
  readonly step = ProcessingStep.TERM_RECORDING;
  readonly priority = StepPriority.OPTIONAL;

  private config: TermLearningConfig;
  private termNormalizer: TermNormalizer;
  private synonymDetector: SynonymDetector;

  constructor(config: Partial<TermLearningConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.termNormalizer = new TermNormalizer();
    this.synonymDetector = new SynonymDetector(this.config.synonymSimilarityThreshold);
  }

  /**
   * 執行術語記錄步驟
   */
  async execute(context: ProcessingContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 檢查是否啟用
      if (!UnifiedProcessorFlags.ENABLE_TERM_LEARNING) {
        return {
          step: this.step,
          success: true,
          skipped: true,
          message: 'Term learning disabled by feature flag',
          duration: Date.now() - startTime,
        };
      }

      // 檢查必要條件
      if (!context.documentFormatId || !context.companyId) {
        return {
          step: this.step,
          success: true,
          skipped: true,
          message: 'Missing documentFormatId or companyId, skipping term learning',
          duration: Date.now() - startTime,
        };
      }

      // 檢查是否有提取數據
      if (!context.extractedData?.invoiceData?.lineItems?.length) {
        return {
          step: this.step,
          success: true,
          skipped: true,
          message: 'No line items to process',
          duration: Date.now() - startTime,
        };
      }

      // 提取術語
      const extractedTerms = this.extractTermsFromLineItems(
        context.extractedData.invoiceData.lineItems
      );

      // 檢測新術語
      const detectionResult = await this.detectNewTerms(
        extractedTerms,
        context.companyId,
        context.documentFormatId
      );

      // 如果有新術語，進行 AI 分類
      if (detectionResult.newTerms.length > 0 && this.config.enableAiClassification) {
        await this.classifyNewTerms(detectionResult.newTerms, context);
      }

      // 記錄新術語
      if (this.config.autoSaveNewTerms && detectionResult.newTerms.length > 0) {
        await this.saveNewTerms({
          documentId: context.fileId,
          documentFormatId: context.documentFormatId,
          companyId: context.companyId,
          terms: detectionResult.newTerms,
          autoSaveNewTerms: true,
        });
      }

      // 更新已知術語的出現次數
      await this.updateTermOccurrences(detectionResult.matchedTerms);

      // 保存結果到 context
      context.termLearningResult = detectionResult;

      return {
        step: this.step,
        success: true,
        data: detectionResult,
        duration: Date.now() - startTime,
        metadata: {
          newTermCount: detectionResult.newTerms.length,
          matchedTermCount: detectionResult.matchedTerms.length,
          potentialSynonymCount: detectionResult.potentialSynonyms.length,
          autoSaved: this.config.autoSaveNewTerms,
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
   * 從 line items 提取術語
   */
  private extractTermsFromLineItems(lineItems: any[]): DetectedTerm[] {
    const terms: DetectedTerm[] = [];

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      const description = item.description || item.name || '';

      if (!description || typeof description !== 'string') continue;

      // 標準化術語
      const normalizedName = this.termNormalizer.normalize(description);

      terms.push({
        term: description.trim(),
        normalizedName,
        suggestedCategory: this.guessCategoryFromText(description),
        confidence: 0, // 將由 AI 服務更新
        sourceIndex: i,
        amount: item.amount?.value,
        currency: item.amount?.currency,
      });
    }

    return terms;
  }

  /**
   * 檢測新術語
   */
  async detectNewTerms(
    extractedTerms: DetectedTerm[],
    companyId: string,
    documentFormatId: string
  ): Promise<NewTermDetectionResult> {
    const startTime = Date.now();

    // 獲取該格式的已知術語
    const knownTerms = await this.getKnownTerms(companyId, documentFormatId);
    const knownTermMap = new Map(knownTerms.map(t => [t.normalizedName.toLowerCase(), t]));
    const knownSynonyms = this.buildSynonymMap(knownTerms);

    const newTerms: DetectedTerm[] = [];
    const matchedTerms: MatchedTerm[] = [];
    const potentialSynonyms: SynonymCandidate[] = [];

    for (const extracted of extractedTerms) {
      const normalizedLower = extracted.normalizedName.toLowerCase();

      // 1. 嘗試精確匹配
      const exactMatch = knownTermMap.get(normalizedLower);
      if (exactMatch) {
        matchedTerms.push({
          termId: exactMatch.id,
          term: exactMatch.term,
          normalizedName: exactMatch.normalizedName,
          category: exactMatch.category,
          matchType: 'EXACT',
          matchConfidence: 100,
        });
        continue;
      }

      // 2. 嘗試同義詞匹配
      const synonymMatch = knownSynonyms.get(normalizedLower);
      if (synonymMatch) {
        matchedTerms.push({
          termId: synonymMatch.id,
          term: synonymMatch.term,
          normalizedName: synonymMatch.normalizedName,
          category: synonymMatch.category,
          matchType: 'SYNONYM',
          matchConfidence: 95,
        });
        continue;
      }

      // 3. 嘗試模糊匹配
      const fuzzyMatch = this.findFuzzyMatch(extracted.normalizedName, knownTerms);
      if (fuzzyMatch && fuzzyMatch.similarity >= this.config.fuzzyMatchThreshold) {
        matchedTerms.push({
          termId: fuzzyMatch.term.id,
          term: fuzzyMatch.term.term,
          normalizedName: fuzzyMatch.term.normalizedName,
          category: fuzzyMatch.term.category,
          matchType: 'FUZZY',
          matchConfidence: Math.round(fuzzyMatch.similarity * 100),
        });

        // 高相似度視為潛在同義詞
        if (this.config.enableSynonymDetection && fuzzyMatch.similarity >= this.config.synonymSimilarityThreshold) {
          potentialSynonyms.push({
            newTerm: extracted.term,
            existingTermId: fuzzyMatch.term.id,
            existingTerm: fuzzyMatch.term.term,
            similarity: fuzzyMatch.similarity,
          });
        }
        continue;
      }

      // 4. 標記為新術語
      newTerms.push(extracted);
    }

    return {
      newTerms,
      matchedTerms,
      potentialSynonyms,
      stats: {
        totalTerms: extractedTerms.length,
        newTermCount: newTerms.length,
        matchedTermCount: matchedTerms.length,
        potentialSynonymCount: potentialSynonyms.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * 獲取已知術語
   */
  private async getKnownTerms(companyId: string, documentFormatId: string): Promise<Term[]> {
    // 獲取格式專屬術語 + 公司通用術語
    const terms = await prisma.formatTerm.findMany({
      where: {
        OR: [
          { documentFormatId },
          {
            companyId,
            documentFormatId: null, // 公司級通用術語
          },
        ],
        status: { in: [TermStatus.VERIFIED, TermStatus.SYSTEM] },
      },
    });

    return terms as Term[];
  }

  /**
   * 構建同義詞映射
   */
  private buildSynonymMap(terms: Term[]): Map<string, Term> {
    const synonymMap = new Map<string, Term>();

    for (const term of terms) {
      if (term.synonyms && term.synonyms.length > 0) {
        for (const synonym of term.synonyms) {
          synonymMap.set(synonym.toLowerCase(), term);
        }
      }
    }

    return synonymMap;
  }

  /**
   * 模糊匹配
   */
  private findFuzzyMatch(
    normalizedName: string,
    knownTerms: Term[]
  ): { term: Term; similarity: number } | null {
    let bestMatch: { term: Term; similarity: number } | null = null;

    for (const known of knownTerms) {
      const similarity = this.calculateSimilarity(
        normalizedName.toLowerCase(),
        known.normalizedName.toLowerCase()
      );

      if (similarity > (bestMatch?.similarity || 0)) {
        bestMatch = { term: known, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * 計算字串相似度 (Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLen;
  }

  /**
   * Levenshtein 距離
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 根據文字猜測類別
   */
  private guessCategoryFromText(text: string): TermCategory {
    const lowerText = text.toLowerCase();

    if (/tax|vat|gst|hst|pst/.test(lowerText)) return TermCategory.TAX;
    if (/discount|rebate|credit/.test(lowerText)) return TermCategory.DISCOUNT;
    if (/surcharge|fuel|peak|congestion/.test(lowerText)) return TermCategory.SURCHARGE;
    if (/freight|shipping|delivery|transport|carriage/.test(lowerText)) return TermCategory.TRANSPORT_SERVICE;
    if (/storage|warehouse|demurrage|detention/.test(lowerText)) return TermCategory.WAREHOUSING;
    if (/customs|duty|clearance|brokerage/.test(lowerText)) return TermCategory.CUSTOMS;
    if (/insurance|coverage|liability/.test(lowerText)) return TermCategory.INSURANCE;
    if (/fee|charge|cost|handling/.test(lowerText)) return TermCategory.FEE;

    return TermCategory.OTHER;
  }

  /**
   * AI 分類新術語
   */
  private async classifyNewTerms(
    newTerms: DetectedTerm[],
    context: ProcessingContext
  ): Promise<void> {
    try {
      const classificationResult = await aiTermValidationService.classifyTerms(
        newTerms.map(t => t.term),
        {
          companyId: context.companyId,
          documentFormatId: context.documentFormatId,
          context: 'INVOICE_LINE_ITEM',
        }
      );

      // 更新術語的分類和信心度
      for (const term of newTerms) {
        const classification = classificationResult.find(
          c => c.term.toLowerCase() === term.term.toLowerCase()
        );
        if (classification) {
          term.suggestedCategory = classification.category as TermCategory;
          term.confidence = classification.confidence;
        }
      }
    } catch (error) {
      console.warn('[TermLearningService] AI classification failed:', error);
      // 使用規則猜測的類別
    }
  }

  /**
   * 保存新術語
   */
  async saveNewTerms(request: TermRecordRequest): Promise<Term[]> {
    const savedTerms: Term[] = [];

    for (const term of request.terms) {
      // 過濾低信心度術語
      if (term.confidence < this.config.minConfidenceThreshold) {
        continue;
      }

      const savedTerm = await prisma.formatTerm.create({
        data: {
          term: term.term,
          normalizedName: term.normalizedName,
          category: term.suggestedCategory,
          status: TermStatus.PENDING,
          source: TermSource.DAILY_AUTO,
          documentFormatId: request.documentFormatId,
          companyId: request.companyId,
          confidence: term.confidence,
          occurrenceCount: 1,
          lastSeenAt: new Date(),
          synonyms: [],
        },
      });

      savedTerms.push(savedTerm as Term);
    }

    return savedTerms;
  }

  /**
   * 更新術語出現次數
   */
  private async updateTermOccurrences(matchedTerms: MatchedTerm[]): Promise<void> {
    const termIds = matchedTerms.map(t => t.termId);

    if (termIds.length === 0) return;

    await prisma.formatTerm.updateMany({
      where: { id: { in: termIds } },
      data: {
        occurrenceCount: { increment: 1 },
        lastSeenAt: new Date(),
      },
    });
  }
}

/**
 * 術語標準化器
 */
class TermNormalizer {
  private stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at',
    'by', 'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
  ]);

  normalize(term: string): string {
    return term
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')  // 移除特殊字符
      .split(/\s+/)
      .filter(word => !this.stopWords.has(word) && word.length > 1)
      .join(' ')
      .trim();
  }
}

/**
 * 同義詞檢測器
 */
class SynonymDetector {
  constructor(private threshold: number) {}

  detectPotentialSynonyms(
    newTerm: string,
    existingTerms: Term[]
  ): SynonymCandidate[] {
    const candidates: SynonymCandidate[] = [];

    for (const existing of existingTerms) {
      const similarity = this.calculateSemanticSimilarity(newTerm, existing.term);
      if (similarity >= this.threshold) {
        candidates.push({
          newTerm,
          existingTermId: existing.id,
          existingTerm: existing.term,
          similarity,
        });
      }
    }

    return candidates.sort((a, b) => b.similarity - a.similarity);
  }

  private calculateSemanticSimilarity(term1: string, term2: string): number {
    // 簡化版語義相似度（實際可使用 embedding）
    const words1 = new Set(term1.toLowerCase().split(/\s+/));
    const words2 = new Set(term2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}
```

### 術語驗證服務

```typescript
// src/services/term-verification.service.ts

import { prisma } from '@/lib/prisma';
import {
  Term,
  TermStatus,
  TermVerificationRequest,
  TermCategory,
} from '@/types/term-learning';

/**
 * @fileoverview 術語驗證服務
 * @description
 *   處理人工審核術語的驗證、拒絕、更新、合併操作
 *
 * @module src/services
 * @since Epic 15 - Story 15.4
 */

export class TermVerificationService {
  /**
   * 獲取待驗證術語列表
   */
  async getPendingTerms(options: {
    companyId?: string;
    documentFormatId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ terms: Term[]; total: number }> {
    const { companyId, documentFormatId, page = 1, limit = 20 } = options;

    const where = {
      status: TermStatus.PENDING,
      ...(companyId && { companyId }),
      ...(documentFormatId && { documentFormatId }),
    };

    const [terms, total] = await Promise.all([
      prisma.formatTerm.findMany({
        where,
        include: {
          documentFormat: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: [
          { occurrenceCount: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.formatTerm.count({ where }),
    ]);

    return { terms: terms as Term[], total };
  }

  /**
   * 驗證術語
   */
  async verifyTerm(
    request: TermVerificationRequest,
    userId: string
  ): Promise<Term> {
    const term = await prisma.formatTerm.findUnique({
      where: { id: request.termId },
    });

    if (!term) {
      throw new Error(`Term not found: ${request.termId}`);
    }

    switch (request.action) {
      case 'VERIFY':
        return this.confirmTerm(request, userId);

      case 'REJECT':
        return this.rejectTerm(request, userId);

      case 'UPDATE':
        return this.updateTerm(request, userId);

      case 'MERGE':
        return this.mergeTerm(request, userId);

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  /**
   * 確認術語
   */
  private async confirmTerm(
    request: TermVerificationRequest,
    userId: string
  ): Promise<Term> {
    const updatedTerm = await prisma.formatTerm.update({
      where: { id: request.termId },
      data: {
        status: TermStatus.VERIFIED,
        verifiedById: userId,
        verifiedAt: new Date(),
        ...(request.updatedCategory && { category: request.updatedCategory }),
        ...(request.updatedNormalizedName && { normalizedName: request.updatedNormalizedName }),
        ...(request.addSynonyms && {
          synonyms: { push: request.addSynonyms },
        }),
        ...(request.notes && { notes: request.notes }),
      },
    });

    return updatedTerm as Term;
  }

  /**
   * 拒絕術語
   */
  private async rejectTerm(
    request: TermVerificationRequest,
    userId: string
  ): Promise<Term> {
    const updatedTerm = await prisma.formatTerm.update({
      where: { id: request.termId },
      data: {
        status: TermStatus.REJECTED,
        verifiedById: userId,
        verifiedAt: new Date(),
        ...(request.notes && { notes: request.notes }),
      },
    });

    return updatedTerm as Term;
  }

  /**
   * 更新術語
   */
  private async updateTerm(
    request: TermVerificationRequest,
    userId: string
  ): Promise<Term> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (request.updatedCategory) {
      updateData.category = request.updatedCategory;
    }
    if (request.updatedNormalizedName) {
      updateData.normalizedName = request.updatedNormalizedName;
    }
    if (request.addSynonyms) {
      updateData.synonyms = { push: request.addSynonyms };
    }
    if (request.notes) {
      updateData.notes = request.notes;
    }

    const updatedTerm = await prisma.formatTerm.update({
      where: { id: request.termId },
      data: updateData,
    });

    return updatedTerm as Term;
  }

  /**
   * 合併術語
   */
  private async mergeTerm(
    request: TermVerificationRequest,
    userId: string
  ): Promise<Term> {
    if (!request.mergeTargetId) {
      throw new Error('mergeTargetId required for MERGE action');
    }

    const [sourceTerm, targetTerm] = await Promise.all([
      prisma.formatTerm.findUnique({ where: { id: request.termId } }),
      prisma.formatTerm.findUnique({ where: { id: request.mergeTargetId } }),
    ]);

    if (!sourceTerm || !targetTerm) {
      throw new Error('Source or target term not found');
    }

    // 將源術語作為目標術語的同義詞
    const updatedTarget = await prisma.$transaction(async (tx) => {
      // 更新目標術語
      const updated = await tx.formatTerm.update({
        where: { id: request.mergeTargetId },
        data: {
          synonyms: {
            push: [sourceTerm.term, ...sourceTerm.synonyms],
          },
          occurrenceCount: {
            increment: sourceTerm.occurrenceCount,
          },
        },
      });

      // 標記源術語為已停用
      await tx.formatTerm.update({
        where: { id: request.termId },
        data: {
          status: TermStatus.DEPRECATED,
          notes: `Merged into ${targetTerm.term} (${targetTerm.id})`,
        },
      });

      return updated;
    });

    return updatedTarget as Term;
  }

  /**
   * 批量驗證術語
   */
  async batchVerify(
    termIds: string[],
    action: 'VERIFY' | 'REJECT',
    userId: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const termId of termIds) {
      try {
        await this.verifyTerm({ termId, action }, userId);
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 手動添加術語
   */
  async addTerm(
    data: {
      term: string;
      normalizedName: string;
      category: TermCategory;
      documentFormatId: string;
      companyId: string;
      synonyms?: string[];
      notes?: string;
    },
    userId: string
  ): Promise<Term> {
    const newTerm = await prisma.formatTerm.create({
      data: {
        ...data,
        status: TermStatus.VERIFIED,
        source: 'MANUAL_REVIEW',
        confidence: 100,
        occurrenceCount: 0,
        createdById: userId,
        verifiedById: userId,
        verifiedAt: new Date(),
        synonyms: data.synonyms || [],
      },
    });

    return newTerm as Term;
  }
}

export const termVerificationService = new TermVerificationService();
```

---

## Feature Flags 擴展

```typescript
// src/services/unified-processing/feature-flags.ts (擴展)

export const UnifiedProcessorFlags = {
  // ... 既有 flags

  /** 啟用術語學習 */
  ENABLE_TERM_LEARNING: process.env.ENABLE_TERM_LEARNING !== 'false',

  /** 自動保存新術語 */
  AUTO_SAVE_NEW_TERMS: process.env.AUTO_SAVE_NEW_TERMS !== 'false',

  /** 新術語最低信心度 */
  NEW_TERM_MIN_CONFIDENCE: parseInt(
    process.env.NEW_TERM_MIN_CONFIDENCE || '60',
    10
  ),

  /** 啟用 AI 術語分類 */
  ENABLE_AI_TERM_CLASSIFICATION: process.env.ENABLE_AI_TERM_CLASSIFICATION !== 'false',

  /** 啟用同義詞檢測 */
  ENABLE_SYNONYM_DETECTION: process.env.ENABLE_SYNONYM_DETECTION !== 'false',

  /** 同義詞相似度閾值 */
  SYNONYM_SIMILARITY_THRESHOLD: parseFloat(
    process.env.SYNONYM_SIMILARITY_THRESHOLD || '0.85'
  ),
};
```

---

## Prisma Schema 擴展

```prisma
// prisma/schema.prisma (擴展)

model FormatTerm {
  id                String       @id @default(cuid())
  term              String
  normalizedName    String       @map("normalized_name")
  category          TermCategory
  status            TermStatus   @default(PENDING)
  source            TermSource   @default(DAILY_AUTO)
  documentFormatId  String?      @map("document_format_id")
  companyId         String       @map("company_id")
  confidence        Int          @default(0)
  occurrenceCount   Int          @default(1) @map("occurrence_count")
  lastSeenAt        DateTime     @default(now()) @map("last_seen_at")
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")
  createdById       String?      @map("created_by_id")
  verifiedById      String?      @map("verified_by_id")
  verifiedAt        DateTime?    @map("verified_at")
  synonyms          String[]
  notes             String?

  // 關聯
  documentFormat    DocumentFormat? @relation(fields: [documentFormatId], references: [id])
  company           Company         @relation(fields: [companyId], references: [id])
  createdBy         User?           @relation("TermCreatedBy", fields: [createdById], references: [id])
  verifiedBy        User?           @relation("TermVerifiedBy", fields: [verifiedById], references: [id])

  @@unique([normalizedName, documentFormatId])
  @@index([companyId, status])
  @@index([documentFormatId, status])
  @@map("format_terms")
}

enum TermStatus {
  PENDING
  VERIFIED
  REJECTED
  SYSTEM
  DEPRECATED
}

enum TermSource {
  HISTORICAL_INIT
  DAILY_AUTO
  MANUAL_REVIEW
  AI_SUGGESTION
  SYSTEM_DEFAULT
}

enum TermCategory {
  FEE
  TAX
  DISCOUNT
  SURCHARGE
  TRANSPORT_SERVICE
  WAREHOUSING
  CUSTOMS
  INSURANCE
  OTHER
}
```

---

## API 端點

### 待驗證術語列表 API

```typescript
// src/app/api/v1/admin/term-verifications/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { termVerificationService } from '@/services/term-verification.service';

/**
 * GET /api/v1/admin/term-verifications
 * 獲取待驗證術語列表
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId') || undefined;
  const documentFormatId = searchParams.get('documentFormatId') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const result = await termVerificationService.getPendingTerms({
    companyId,
    documentFormatId,
    page,
    limit,
  });

  return NextResponse.json({
    success: true,
    data: result.terms,
    meta: {
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    },
  });
});
```

### 術語驗證操作 API

```typescript
// src/app/api/v1/admin/term-verifications/[id]/verify/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { termVerificationService } from '@/services/term-verification.service';
import { TermVerificationRequest } from '@/types/term-learning';
import { z } from 'zod';

const VerifyTermSchema = z.object({
  action: z.enum(['VERIFY', 'REJECT', 'UPDATE', 'MERGE']),
  updatedCategory: z.nativeEnum(TermCategory).optional(),
  updatedNormalizedName: z.string().optional(),
  mergeTargetId: z.string().optional(),
  addSynonyms: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/v1/admin/term-verifications/[id]/verify
 * 驗證術語
 */
export const POST = withAuth(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const body = await req.json();
  const validatedData = VerifyTermSchema.parse(body);
  const userId = req.headers.get('x-user-id') || 'system';

  const request: TermVerificationRequest = {
    termId: params.id,
    ...validatedData,
  };

  const result = await termVerificationService.verifyTerm(request, userId);

  return NextResponse.json({
    success: true,
    data: result,
  });
});
```

### 手動添加術語 API

```typescript
// src/app/api/v1/admin/terms/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { termVerificationService } from '@/services/term-verification.service';
import { TermCategory } from '@/types/term-learning';
import { z } from 'zod';

const AddTermSchema = z.object({
  term: z.string().min(1),
  normalizedName: z.string().min(1),
  category: z.nativeEnum(TermCategory),
  documentFormatId: z.string(),
  companyId: z.string(),
  synonyms: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/v1/admin/terms
 * 手動添加術語
 */
export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const validatedData = AddTermSchema.parse(body);
  const userId = req.headers.get('x-user-id') || 'system';

  const result = await termVerificationService.addTerm(validatedData, userId);

  return NextResponse.json({
    success: true,
    data: result,
  }, { status: 201 });
});
```

### 批量驗證 API

```typescript
// src/app/api/v1/admin/term-verifications/batch/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middlewares/auth';
import { termVerificationService } from '@/services/term-verification.service';
import { z } from 'zod';

const BatchVerifySchema = z.object({
  termIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['VERIFY', 'REJECT']),
});

/**
 * POST /api/v1/admin/term-verifications/batch
 * 批量驗證術語
 */
export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const { termIds, action } = BatchVerifySchema.parse(body);
  const userId = req.headers.get('x-user-id') || 'system';

  const result = await termVerificationService.batchVerify(termIds, action, userId);

  return NextResponse.json({
    success: true,
    data: result,
  });
});
```

---

## 審核界面整合

### 術語建議組件

```typescript
// src/components/features/review/TermSuggestionPanel.tsx

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DetectedTerm, TermCategory } from '@/types/term-learning';

interface TermSuggestionPanelProps {
  /** 檢測到的新術語 */
  newTerms: DetectedTerm[];
  /** 驗證術語回調 */
  onVerify: (term: DetectedTerm, category: TermCategory) => void;
  /** 拒絕術語回調 */
  onReject: (term: DetectedTerm) => void;
  /** 添加新術語回調 */
  onAddNew: (term: string, category: TermCategory) => void;
}

/**
 * 術語建議面板
 * 在審核界面中顯示新發現的術語，供用戶確認或添加
 */
export function TermSuggestionPanel({
  newTerms,
  onVerify,
  onReject,
  onAddNew,
}: TermSuggestionPanelProps) {
  const [newTermInput, setNewTermInput] = React.useState('');
  const [newTermCategory, setNewTermCategory] = React.useState<TermCategory>(
    TermCategory.OTHER
  );

  const handleAddNew = () => {
    if (newTermInput.trim()) {
      onAddNew(newTermInput.trim(), newTermCategory);
      setNewTermInput('');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">新發現的術語</h3>

      {newTerms.length === 0 ? (
        <p className="text-muted-foreground">無新術語</p>
      ) : (
        <div className="space-y-2">
          {newTerms.map((term, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 border rounded"
            >
              <div className="flex-1">
                <span className="font-medium">{term.term}</span>
                <Badge variant="secondary" className="ml-2">
                  {term.suggestedCategory}
                </Badge>
                <span className="text-sm text-muted-foreground ml-2">
                  信心度: {term.confidence}%
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onVerify(term, term.suggestedCategory)}
                >
                  確認
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onReject(term)}
                >
                  忽略
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 手動添加術語 */}
      <div className="pt-4 border-t">
        <h4 className="text-sm font-medium mb-2">手動添加術語</h4>
        <div className="flex gap-2">
          <Input
            placeholder="輸入術語..."
            value={newTermInput}
            onChange={(e) => setNewTermInput(e.target.value)}
            className="flex-1"
          />
          <Select
            value={newTermCategory}
            onValueChange={(v) => setNewTermCategory(v as TermCategory)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(TermCategory).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddNew}>添加</Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 驗收標準對照

| 驗收標準 | 實現方式 |
|---------|---------|
| 發現新術語（不在現有術語庫中）時記錄到對應的 DocumentFormat | `TermLearningService.detectNewTerms()` + `saveNewTerms()` |
| 標記為待驗證狀態 | `TermStatus.PENDING` |
| 人工審核確認術語時更新狀態為已驗證 | `TermVerificationService.confirmTerm()` → `TermStatus.VERIFIED` |
| 用戶在審核時添加新術語 | `TermSuggestionPanel` 組件 + `addTerm()` API |
| 關聯到當前 Company/Format | `FormatTerm.companyId` + `FormatTerm.documentFormatId` |

---

## 檔案清單

| 檔案路徑 | 用途 |
|---------|------|
| `src/types/term-learning.ts` | 術語學習類型定義 |
| `src/services/unified-processing/term-learning.service.ts` | 術語學習服務 |
| `src/services/term-verification.service.ts` | 術語驗證服務 |
| `src/app/api/v1/admin/term-verifications/route.ts` | 待驗證術語列表 API |
| `src/app/api/v1/admin/term-verifications/[id]/verify/route.ts` | 術語驗證操作 API |
| `src/app/api/v1/admin/term-verifications/batch/route.ts` | 批量驗證 API |
| `src/app/api/v1/admin/terms/route.ts` | 手動添加術語 API |
| `src/components/features/review/TermSuggestionPanel.tsx` | 術語建議面板組件 |
| `prisma/schema.prisma` | FormatTerm 模型擴展 |

---

*Tech Spec 建立日期: 2026-01-02*
*Epic: 15 - 統一 3 層機制到日常處理流程*
*Story: 15.4 - 持續術語學習*
