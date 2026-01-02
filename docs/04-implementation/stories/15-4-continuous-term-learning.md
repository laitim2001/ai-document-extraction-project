# Story 15-4: 持續術語學習

> **Epic**: Epic 15 - 統一 3 層機制到日常處理流程
> **Story Points**: 5
> **Priority**: High
> **Status**: Backlog

---

## 📋 User Story

**As a** 系統
**I want** 在日常文件處理中自動識別和記錄新術語
**So that** 系統的術語知識庫能持續成長，提升未來處理的準確度

---

## 🎯 Acceptance Criteria

### AC 15-4-1: 新術語識別
- [ ] 能夠識別提取結果中的術語
- [ ] 與現有術語庫比對，找出未知術語
- [ ] 計算術語相似度，避免重複記錄變體
- [ ] 標記術語的首次出現位置和上下文

### AC 15-4-2: 術語自動記錄
- [ ] 自動將新術語記錄到對應的 DocumentFormat
- [ ] 記錄術語出現頻率和信心度
- [ ] 支援術語的分類建議（基於 AI）
- [ ] 記錄術語與標準欄位的關聯

### AC 15-4-3: 術語審核建議
- [ ] 在人工審核介面顯示新術語
- [ ] 提供術語分類建議供審核員確認
- [ ] 支援批次確認或修正術語分類
- [ ] 審核結果回饋到術語庫

### AC 15-4-4: 術語統計與監控
- [ ] 追蹤每個 Format 的術語成長趨勢
- [ ] 識別高頻新術語（可能需要建立規則）
- [ ] 提供術語學習效果報告
- [ ] 監控術語識別的準確率

---

## 🏗️ Technical Design

### 服務架構

```
src/services/term-learning/
├── term-detector.service.ts       # 術語識別服務
├── term-recorder.service.ts       # 術語記錄服務
├── term-suggester.service.ts      # 術語建議服務
├── term-statistics.service.ts     # 統計服務
├── types.ts                       # 類型定義
└── index.ts                       # 模組導出
```

### 類型定義

```typescript
// src/services/term-learning/types.ts

/**
 * 術語來源
 */
export enum TermSource {
  LINE_ITEM = 'LINE_ITEM',        // 來自 lineItems
  INVOICE_DATA = 'INVOICE_DATA',  // 來自 invoiceData
  CUSTOM_FIELD = 'CUSTOM_FIELD',  // 來自自定義欄位
}

/**
 * 術語狀態
 */
export enum TermStatus {
  PENDING = 'PENDING',        // 待審核
  CONFIRMED = 'CONFIRMED',    // 已確認
  REJECTED = 'REJECTED',      // 已拒絕
  AUTO_APPROVED = 'AUTO_APPROVED', // 自動通過
}

/**
 * 識別的術語
 */
export interface DetectedTerm {
  term: string;
  normalizedTerm: string;  // 標準化後的術語
  source: TermSource;
  context: string;         // 術語出現的上下文
  confidence: number;      // AI 識別信心度
  suggestedCategory?: string;
  fileId: string;
  lineNumber?: number;
}

/**
 * 術語比對結果
 */
export interface TermMatchResult {
  term: string;
  isNew: boolean;
  existingTermId?: string;
  similarity: number;
  bestMatch?: {
    term: string;
    category: string;
    similarity: number;
  };
}

/**
 * 術語學習記錄
 */
export interface TermLearningRecord {
  id: string;
  documentFormatId: string;
  term: string;
  category: string;
  status: TermStatus;
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
}

/**
 * 術語統計
 */
export interface TermStatistics {
  formatId: string;
  totalTerms: number;
  newTermsThisWeek: number;
  pendingReview: number;
  confirmationRate: number;
  topNewTerms: Array<{ term: string; count: number }>;
}
```

### 術語識別服務

```typescript
// src/services/term-learning/term-detector.service.ts

/**
 * @fileoverview 術語識別服務
 * @description
 *   從提取結果中識別術語
 *   與現有術語庫比對，找出新術語
 *
 * @module src/services/term-learning/term-detector
 * @since Epic 15 - Story 15-4
 */

import { prisma } from '@/lib/prisma';
import { DetectedTerm, TermMatchResult, TermSource } from './types';

export class TermDetectorService {
  private readonly similarityThreshold = 0.85;

  /**
   * 從提取結果中識別術語
   */
  async detectTerms(
    extractionResult: Record<string, unknown>,
    fileId: string
  ): Promise<DetectedTerm[]> {
    const terms: DetectedTerm[] = [];

    // 從 lineItems 提取術語
    const lineItems = extractionResult.lineItems as Array<Record<string, unknown>> || [];
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (item.description && typeof item.description === 'string') {
        terms.push({
          term: item.description,
          normalizedTerm: this.normalizeTerm(item.description),
          source: TermSource.LINE_ITEM,
          context: JSON.stringify(item).substring(0, 200),
          confidence: 0.8,
          fileId,
          lineNumber: i + 1,
        });
      }
    }

    // 從 invoiceData 提取其他術語欄位
    const invoiceData = extractionResult.invoiceData as Record<string, unknown> || {};
    for (const [key, value] of Object.entries(invoiceData)) {
      if (this.isTermField(key) && typeof value === 'string') {
        terms.push({
          term: value,
          normalizedTerm: this.normalizeTerm(value),
          source: TermSource.INVOICE_DATA,
          context: `${key}: ${value}`,
          confidence: 0.9,
          fileId,
        });
      }
    }

    return terms;
  }

  /**
   * 比對術語，找出新術語
   */
  async matchTerms(
    terms: DetectedTerm[],
    documentFormatId: string
  ): Promise<TermMatchResult[]> {
    // 載入該 Format 的現有術語
    const existingTerms = await prisma.formatTerm.findMany({
      where: { documentFormatId },
      select: { id: true, term: true, category: true },
    });

    const results: TermMatchResult[] = [];

    for (const detected of terms) {
      const match = this.findBestMatch(detected.normalizedTerm, existingTerms);

      results.push({
        term: detected.term,
        isNew: !match || match.similarity < this.similarityThreshold,
        existingTermId: match?.id,
        similarity: match?.similarity || 0,
        bestMatch: match ? {
          term: match.term,
          category: match.category,
          similarity: match.similarity,
        } : undefined,
      });
    }

    return results;
  }

  /**
   * 標準化術語
   */
  private normalizeTerm(term: string): string {
    return term
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /**
   * 判斷欄位是否為術語欄位
   */
  private isTermField(fieldName: string): boolean {
    const termFields = [
      'description', 'itemName', 'serviceName',
      'chargeType', 'feeType', 'category'
    ];
    return termFields.some(f =>
      fieldName.toLowerCase().includes(f.toLowerCase())
    );
  }

  /**
   * 找出最佳匹配
   */
  private findBestMatch(
    term: string,
    existingTerms: Array<{ id: string; term: string; category: string }>
  ): { id: string; term: string; category: string; similarity: number } | null {
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const existing of existingTerms) {
      const similarity = this.calculateSimilarity(term, existing.term.toLowerCase());
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { ...existing, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * 計算字串相似度 (Levenshtein-based)
   */
  private calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein 距離計算
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
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
}
```

### 術語記錄服務

```typescript
// src/services/term-learning/term-recorder.service.ts

/**
 * @fileoverview 術語記錄服務
 * @description
 *   將新術語記錄到對應的 DocumentFormat
 *   更新術語出現頻率和統計
 *
 * @module src/services/term-learning/term-recorder
 * @since Epic 15 - Story 15-4
 */

import { prisma } from '@/lib/prisma';
import { DetectedTerm, TermMatchResult, TermStatus } from './types';

export class TermRecorderService {
  /**
   * 記錄新術語
   */
  async recordNewTerms(
    terms: DetectedTerm[],
    matchResults: TermMatchResult[],
    documentFormatId: string
  ): Promise<{ recorded: number; updated: number }> {
    let recorded = 0;
    let updated = 0;

    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const match = matchResults[i];

      if (match.isNew) {
        // 記錄新術語
        await this.createTermRecord(term, documentFormatId);
        recorded++;
      } else if (match.existingTermId) {
        // 更新現有術語的出現次數
        await this.updateTermOccurrence(match.existingTermId);
        updated++;
      }
    }

    return { recorded, updated };
  }

  /**
   * 建立術語記錄
   */
  private async createTermRecord(
    term: DetectedTerm,
    documentFormatId: string
  ): Promise<void> {
    await prisma.formatTerm.create({
      data: {
        documentFormatId,
        term: term.term,
        normalizedTerm: term.normalizedTerm,
        category: term.suggestedCategory || 'UNCATEGORIZED',
        status: TermStatus.PENDING,
        source: term.source,
        context: term.context,
        confidence: term.confidence,
        occurrenceCount: 1,
        firstSeenFileId: term.fileId,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * 更新術語出現次數
   */
  private async updateTermOccurrence(termId: string): Promise<void> {
    await prisma.formatTerm.update({
      where: { id: termId },
      data: {
        occurrenceCount: { increment: 1 },
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * 批次確認術語
   */
  async confirmTerms(
    termIds: string[],
    category: string,
    confirmedBy: string
  ): Promise<number> {
    const result = await prisma.formatTerm.updateMany({
      where: { id: { in: termIds } },
      data: {
        status: TermStatus.CONFIRMED,
        category,
        confirmedBy,
        confirmedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * 拒絕術語
   */
  async rejectTerms(
    termIds: string[],
    rejectedBy: string
  ): Promise<number> {
    const result = await prisma.formatTerm.updateMany({
      where: { id: { in: termIds } },
      data: {
        status: TermStatus.REJECTED,
        confirmedBy: rejectedBy,
        confirmedAt: new Date(),
      },
    });

    return result.count;
  }
}
```

### 術語建議服務

```typescript
// src/services/term-learning/term-suggester.service.ts

/**
 * @fileoverview 術語建議服務
 * @description
 *   使用 AI 為新術語提供分類建議
 *   基於上下文和現有術語模式
 *
 * @module src/services/term-learning/term-suggester
 * @since Epic 15 - Story 15-4
 */

import { DetectedTerm } from './types';

/**
 * 標準費用類別
 */
export const STANDARD_CATEGORIES = [
  'FREIGHT',           // 運費
  'HANDLING',          // 處理費
  'DOCUMENTATION',     // 文件費
  'CUSTOMS',           // 清關費
  'INSURANCE',         // 保險費
  'STORAGE',           // 倉儲費
  'PICKUP_DELIVERY',   // 取件/派送費
  'SURCHARGE',         // 附加費
  'TAX',               // 稅費
  'OTHER',             // 其他
] as const;

export type StandardCategory = typeof STANDARD_CATEGORIES[number];

export class TermSuggesterService {
  private categoryKeywords: Record<StandardCategory, string[]> = {
    FREIGHT: ['freight', 'shipping', 'transport', 'carriage', 'haulage'],
    HANDLING: ['handling', 'loading', 'unloading', 'stuffing'],
    DOCUMENTATION: ['doc', 'document', 'bill', 'certificate', 'paperwork'],
    CUSTOMS: ['customs', 'duty', 'clearance', 'import', 'export'],
    INSURANCE: ['insurance', 'coverage', 'premium'],
    STORAGE: ['storage', 'warehouse', 'demurrage', 'detention'],
    PICKUP_DELIVERY: ['pickup', 'delivery', 'collection', 'drop'],
    SURCHARGE: ['surcharge', 'fuel', 'peak', 'emergency'],
    TAX: ['tax', 'vat', 'gst', 'levy'],
    OTHER: [],
  };

  /**
   * 為術語生成分類建議
   */
  suggestCategory(term: DetectedTerm): {
    category: StandardCategory;
    confidence: number;
    alternatives: Array<{ category: StandardCategory; score: number }>;
  } {
    const normalizedTerm = term.normalizedTerm.toLowerCase();
    const scores: Array<{ category: StandardCategory; score: number }> = [];

    for (const category of STANDARD_CATEGORIES) {
      const score = this.calculateCategoryScore(normalizedTerm, category);
      scores.push({ category, score });
    }

    // 排序，取最高分
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const alternatives = scores.slice(1, 4).filter(s => s.score > 0);

    return {
      category: best.score > 0.3 ? best.category : 'OTHER',
      confidence: best.score,
      alternatives,
    };
  }

  /**
   * 批次建議分類
   */
  suggestCategories(terms: DetectedTerm[]): Map<string, {
    category: StandardCategory;
    confidence: number;
  }> {
    const results = new Map<string, { category: StandardCategory; confidence: number }>();

    for (const term of terms) {
      const suggestion = this.suggestCategory(term);
      results.set(term.term, {
        category: suggestion.category,
        confidence: suggestion.confidence,
      });
    }

    return results;
  }

  /**
   * 計算類別匹配分數
   */
  private calculateCategoryScore(
    term: string,
    category: StandardCategory
  ): number {
    const keywords = this.categoryKeywords[category];
    if (keywords.length === 0) return 0;

    let maxScore = 0;
    for (const keyword of keywords) {
      if (term.includes(keyword)) {
        // 完全包含關鍵字
        const score = keyword.length / term.length;
        maxScore = Math.max(maxScore, Math.min(score * 1.5, 1));
      } else if (keyword.includes(term)) {
        // 術語是關鍵字的一部分
        const score = term.length / keyword.length * 0.5;
        maxScore = Math.max(maxScore, score);
      }
    }

    return maxScore;
  }
}
```

### 術語統計服務

```typescript
// src/services/term-learning/term-statistics.service.ts

/**
 * @fileoverview 術語統計服務
 * @description
 *   追蹤術語學習趨勢和效果
 *   提供監控和報告功能
 *
 * @module src/services/term-learning/term-statistics
 * @since Epic 15 - Story 15-4
 */

import { prisma } from '@/lib/prisma';
import { TermStatistics, TermStatus } from './types';

export class TermStatisticsService {
  /**
   * 取得 Format 的術語統計
   */
  async getFormatStatistics(formatId: string): Promise<TermStatistics> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // 總術語數
    const totalTerms = await prisma.formatTerm.count({
      where: { documentFormatId: formatId },
    });

    // 本週新術語
    const newTermsThisWeek = await prisma.formatTerm.count({
      where: {
        documentFormatId: formatId,
        firstSeenAt: { gte: oneWeekAgo },
      },
    });

    // 待審核
    const pendingReview = await prisma.formatTerm.count({
      where: {
        documentFormatId: formatId,
        status: TermStatus.PENDING,
      },
    });

    // 確認率
    const confirmed = await prisma.formatTerm.count({
      where: {
        documentFormatId: formatId,
        status: TermStatus.CONFIRMED,
      },
    });
    const reviewed = confirmed + await prisma.formatTerm.count({
      where: {
        documentFormatId: formatId,
        status: TermStatus.REJECTED,
      },
    });
    const confirmationRate = reviewed > 0 ? confirmed / reviewed : 0;

    // 高頻新術語
    const topNewTerms = await prisma.formatTerm.findMany({
      where: {
        documentFormatId: formatId,
        firstSeenAt: { gte: oneWeekAgo },
      },
      orderBy: { occurrenceCount: 'desc' },
      take: 10,
      select: { term: true, occurrenceCount: true },
    });

    return {
      formatId,
      totalTerms,
      newTermsThisWeek,
      pendingReview,
      confirmationRate,
      topNewTerms: topNewTerms.map(t => ({
        term: t.term,
        count: t.occurrenceCount,
      })),
    };
  }

  /**
   * 取得所有 Format 的統計摘要
   */
  async getAllStatistics(): Promise<{
    totalFormats: number;
    totalTerms: number;
    pendingReview: number;
    weeklyGrowth: number;
  }> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [totalFormats, totalTerms, pendingReview, newThisWeek] = await Promise.all([
      prisma.documentFormat.count(),
      prisma.formatTerm.count(),
      prisma.formatTerm.count({ where: { status: TermStatus.PENDING } }),
      prisma.formatTerm.count({ where: { firstSeenAt: { gte: oneWeekAgo } } }),
    ]);

    const weeklyGrowth = totalTerms > 0 ? newThisWeek / totalTerms : 0;

    return {
      totalFormats,
      totalTerms,
      pendingReview,
      weeklyGrowth,
    };
  }

  /**
   * 取得術語學習效果報告
   */
  async getLearningEffectivenessReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: { start: Date; end: Date };
    newTermsLearned: number;
    termsConfirmed: number;
    termsRejected: number;
    avgConfirmationTime: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    const terms = await prisma.formatTerm.findMany({
      where: {
        firstSeenAt: { gte: startDate, lte: endDate },
      },
      select: {
        status: true,
        category: true,
        firstSeenAt: true,
        confirmedAt: true,
      },
    });

    const confirmed = terms.filter(t => t.status === TermStatus.CONFIRMED);
    const rejected = terms.filter(t => t.status === TermStatus.REJECTED);

    // 計算平均確認時間
    let totalConfirmTime = 0;
    let confirmedCount = 0;
    for (const term of confirmed) {
      if (term.confirmedAt && term.firstSeenAt) {
        totalConfirmTime += term.confirmedAt.getTime() - term.firstSeenAt.getTime();
        confirmedCount++;
      }
    }
    const avgConfirmationTime = confirmedCount > 0
      ? totalConfirmTime / confirmedCount / (1000 * 60 * 60) // 轉換為小時
      : 0;

    // 類別統計
    const categoryCount: Record<string, number> = {};
    for (const term of confirmed) {
      categoryCount[term.category] = (categoryCount[term.category] || 0) + 1;
    }
    const topCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      period: { start: startDate, end: endDate },
      newTermsLearned: terms.length,
      termsConfirmed: confirmed.length,
      termsRejected: rejected.length,
      avgConfirmationTime,
      topCategories,
    };
  }
}
```

### 模組導出

```typescript
// src/services/term-learning/index.ts

export * from './types';
export * from './term-detector.service';
export * from './term-recorder.service';
export * from './term-suggester.service';
export * from './term-statistics.service';
```

---

## 📊 Database Schema

### FormatTerm 模型擴展

```prisma
// prisma/schema.prisma

model FormatTerm {
  id               String   @id @default(cuid())
  documentFormatId String   @map("document_format_id")

  // 術語資訊
  term             String
  normalizedTerm   String   @map("normalized_term")
  category         String

  // 狀態
  status           String   @default("PENDING")

  // 來源
  source           String?
  context          String?  @db.Text
  confidence       Float    @default(0)

  // 統計
  occurrenceCount  Int      @default(1) @map("occurrence_count")
  firstSeenFileId  String?  @map("first_seen_file_id")
  firstSeenAt      DateTime @default(now()) @map("first_seen_at")
  lastSeenAt       DateTime @default(now()) @map("last_seen_at")

  // 審核
  confirmedBy      String?  @map("confirmed_by")
  confirmedAt      DateTime? @map("confirmed_at")

  // 關聯
  documentFormat   DocumentFormat @relation(fields: [documentFormatId], references: [id])

  @@index([documentFormatId])
  @@index([status])
  @@index([normalizedTerm])
  @@map("format_terms")
}
```

---

## 🔗 API Endpoints

### 術語管理 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/terms` | 列出術語（支援篩選） |
| GET | `/api/v1/admin/terms/pending` | 待審核術語 |
| POST | `/api/v1/admin/terms/confirm` | 批次確認術語 |
| POST | `/api/v1/admin/terms/reject` | 批次拒絕術語 |
| GET | `/api/v1/admin/terms/statistics` | 術語統計 |
| GET | `/api/v1/admin/terms/report` | 學習效果報告 |

---

## 🧪 Testing Strategy

### 單元測試

```typescript
// tests/unit/services/term-learning/term-detector.test.ts

import { TermDetectorService } from '@/services/term-learning';

describe('TermDetectorService', () => {
  let service: TermDetectorService;

  beforeEach(() => {
    service = new TermDetectorService();
  });

  describe('detectTerms', () => {
    it('should extract terms from lineItems', async () => {
      const result = {
        lineItems: [
          { description: 'Ocean Freight - FCL' },
          { description: 'Customs Clearance' },
        ],
      };

      const terms = await service.detectTerms(result, 'file-1');

      expect(terms).toHaveLength(2);
      expect(terms[0].term).toBe('Ocean Freight - FCL');
    });
  });

  describe('normalizeTerm', () => {
    it('should normalize terms correctly', () => {
      const normalized = service['normalizeTerm']('  Ocean FREIGHT - FCL  ');
      expect(normalized).toBe('ocean freight fcl');
    });
  });
});
```

---

## 📁 Files to Create/Modify

### New Files
| File | Description |
|------|-------------|
| `src/services/term-learning/types.ts` | 類型定義 |
| `src/services/term-learning/term-detector.service.ts` | 術語識別服務 |
| `src/services/term-learning/term-recorder.service.ts` | 術語記錄服務 |
| `src/services/term-learning/term-suggester.service.ts` | 術語建議服務 |
| `src/services/term-learning/term-statistics.service.ts` | 統計服務 |
| `src/services/term-learning/index.ts` | 模組導出 |
| `src/app/api/v1/admin/terms/` | 術語管理 API |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | 擴展 FormatTerm 模型 |
| `src/services/index.ts` | 導出 term-learning 模組 |

---

## 🔗 Dependencies

### Upstream
- **Story 15-1**: 統一處理流程（術語學習步驟）
- **Story 15-3**: 格式匹配（DocumentFormat 關聯）
- **Epic 0**: 術語聚合基礎（Term 模型）

### Downstream
- **Story 15-5**: 信心度計算增強（術語匹配度因素）

---

## 📝 Implementation Notes

### 術語識別策略
- 主要從 lineItems.description 提取
- 輔助從 invoiceData 的特定欄位提取
- 使用標準化處理避免重複

### 相似度計算
- 使用 Levenshtein 距離計算
- 閾值 0.85 以上視為相同術語
- 支援大小寫不敏感比對

### 分類建議
- 基於關鍵字匹配的規則引擎
- 10 個標準費用類別
- 可擴展使用 AI 增強

---

## ✅ Definition of Done

- [ ] 所有 Acceptance Criteria 通過
- [ ] 術語識別功能完整
- [ ] 術語記錄功能正確
- [ ] 分類建議準確率 > 70%
- [ ] 統計功能完整
- [ ] API 端點實現
- [ ] 單元測試覆蓋率 > 80%
- [ ] 程式碼審查通過

---

*Created: 2026-01-02*
*Epic: 15 - 統一 3 層機制到日常處理流程*
