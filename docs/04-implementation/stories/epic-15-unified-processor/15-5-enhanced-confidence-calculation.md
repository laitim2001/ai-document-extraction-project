# Story 15-5: 信心度計算增強

> **Epic**: Epic 15 - 統一 3 層機制到日常處理流程
> **Story Points**: 5
> **Priority**: High
> **Status**: Backlog

---

## 📋 User Story

**As a** 系統
**I want** 能夠基於多維度因素計算文件處理的信心度
**So that** 能更準確地決定文件應該自動通過、快速審核還是完整審核

---

## 🎯 Acceptance Criteria

### AC 15-5-1: 多維度信心度因素
- [ ] 納入提取信心度（來自 Azure DI / GPT Vision）
- [ ] 納入發行者識別信心度
- [ ] 納入格式匹配信心度
- [ ] 納入欄位完整度
- [ ] 納入術語匹配度

### AC 15-5-2: 配置匹配加分
- [ ] Specific 配置（公司+格式）獲得最高加分
- [ ] Company 配置獲得中等加分
- [ ] Format 配置獲得較低加分
- [ ] Global/Default 配置不加分

### AC 15-5-3: 歷史準確率權重
- [ ] 計算該 Company/Format 的歷史審核通過率
- [ ] 高歷史準確率提升信心度
- [ ] 低歷史準確率降低信心度
- [ ] 新 Company/Format 使用預設值

### AC 15-5-4: 路由決策優化
- [ ] 信心度 ≥ 90%：AUTO_APPROVE
- [ ] 信心度 70-89%：QUICK_REVIEW
- [ ] 信心度 < 70%：FULL_REVIEW
- [ ] 支援閾值的動態配置
- [ ] 提供路由決策的解釋

---

## 🏗️ Technical Design

### 服務架構

```
src/services/confidence/
├── confidence-calculator.service.ts   # 信心度計算主服務
├── factor-providers/                   # 因素提供者
│   ├── extraction-factor.provider.ts
│   ├── issuer-factor.provider.ts
│   ├── format-factor.provider.ts
│   ├── completeness-factor.provider.ts
│   ├── term-factor.provider.ts
│   └── history-factor.provider.ts
├── routing-decision.service.ts         # 路由決策服務
├── types.ts                            # 類型定義
└── index.ts                            # 模組導出
```

### 類型定義

```typescript
// src/services/confidence/types.ts

/**
 * 信心度因素
 */
export interface ConfidenceFactors {
  // 提取信心度 (來自 Azure DI / GPT Vision)
  extractionConfidence: number;  // 0-1

  // 發行者識別信心度
  issuerConfidence: number;  // 0-1

  // 格式匹配信心度
  formatMatchConfidence: number;  // 0-1

  // 配置匹配層級
  configMatchLevel: ConfigMatchLevel;

  // 歷史準確率
  historicalAccuracy: number | null;  // 0-1, null 表示無歷史數據

  // 欄位完整度
  fieldCompleteness: number;  // 0-1

  // 術語匹配度
  termMatchRate: number;  // 0-1
}

/**
 * 配置匹配層級
 */
export enum ConfigMatchLevel {
  SPECIFIC = 'specific',   // Company + Format 特定配置
  COMPANY = 'company',     // Company 層級配置
  FORMAT = 'format',       // Format 層級配置
  GLOBAL = 'global',       // 全域配置
  DEFAULT = 'default',     // 預設配置
}

/**
 * 路由決策
 */
export enum RoutingDecision {
  AUTO_APPROVE = 'AUTO_APPROVE',
  QUICK_REVIEW = 'QUICK_REVIEW',
  FULL_REVIEW = 'FULL_REVIEW',
}

/**
 * 信心度計算結果
 */
export interface ConfidenceResult {
  overallConfidence: number;  // 0-1
  factors: ConfidenceFactors;
  weights: ConfidenceWeights;
  breakdown: ConfidenceBreakdown;
  routingDecision: RoutingDecision;
  explanation: string;
  calculatedAt: Date;
}

/**
 * 信心度權重
 */
export interface ConfidenceWeights {
  extractionConfidence: number;
  issuerConfidence: number;
  formatMatchConfidence: number;
  configMatchBonus: number;
  historicalAccuracy: number;
  fieldCompleteness: number;
  termMatchRate: number;
}

/**
 * 信心度分解
 */
export interface ConfidenceBreakdown {
  baseScore: number;
  extractionContribution: number;
  issuerContribution: number;
  formatContribution: number;
  configBonus: number;
  historyContribution: number;
  completenessContribution: number;
  termContribution: number;
}

/**
 * 路由閾值配置
 */
export interface RoutingThresholds {
  autoApprove: number;   // 預設 0.90
  quickReview: number;   // 預設 0.70
}

/**
 * 處理上下文
 */
export interface CalculationContext {
  fileId: string;
  companyId?: string;
  documentFormatId?: string;
  extractionResult: Record<string, unknown>;
  issuerResult?: {
    confidence: number;
    method: string;
  };
  formatMatchResult?: {
    confidence: number;
    isExactMatch: boolean;
  };
  configLevel: ConfigMatchLevel;
}
```

### 信心度計算服務

```typescript
// src/services/confidence/confidence-calculator.service.ts

/**
 * @fileoverview 信心度計算服務
 * @description
 *   基於多維度因素計算文件處理的整體信心度
 *   支援可配置的權重和閾值
 *
 * @module src/services/confidence/confidence-calculator
 * @since Epic 15 - Story 15-5
 */

import {
  ConfidenceFactors,
  ConfidenceResult,
  ConfidenceWeights,
  ConfidenceBreakdown,
  ConfigMatchLevel,
  RoutingDecision,
  CalculationContext
} from './types';
import { ExtractionFactorProvider } from './factor-providers/extraction-factor.provider';
import { IssuerFactorProvider } from './factor-providers/issuer-factor.provider';
import { FormatFactorProvider } from './factor-providers/format-factor.provider';
import { CompletenessFactorProvider } from './factor-providers/completeness-factor.provider';
import { TermFactorProvider } from './factor-providers/term-factor.provider';
import { HistoryFactorProvider } from './factor-providers/history-factor.provider';

export class ConfidenceCalculatorService {
  private extractionProvider: ExtractionFactorProvider;
  private issuerProvider: IssuerFactorProvider;
  private formatProvider: FormatFactorProvider;
  private completenessProvider: CompletenessFactorProvider;
  private termProvider: TermFactorProvider;
  private historyProvider: HistoryFactorProvider;

  /**
   * 預設權重配置
   */
  private readonly defaultWeights: ConfidenceWeights = {
    extractionConfidence: 0.25,
    issuerConfidence: 0.15,
    formatMatchConfidence: 0.10,
    configMatchBonus: 0.10,
    historicalAccuracy: 0.15,
    fieldCompleteness: 0.15,
    termMatchRate: 0.10,
  };

  /**
   * 配置匹配加分
   */
  private readonly configBonusMap: Record<ConfigMatchLevel, number> = {
    [ConfigMatchLevel.SPECIFIC]: 0.10,
    [ConfigMatchLevel.COMPANY]: 0.06,
    [ConfigMatchLevel.FORMAT]: 0.04,
    [ConfigMatchLevel.GLOBAL]: 0.02,
    [ConfigMatchLevel.DEFAULT]: 0,
  };

  constructor() {
    this.extractionProvider = new ExtractionFactorProvider();
    this.issuerProvider = new IssuerFactorProvider();
    this.formatProvider = new FormatFactorProvider();
    this.completenessProvider = new CompletenessFactorProvider();
    this.termProvider = new TermFactorProvider();
    this.historyProvider = new HistoryFactorProvider();
  }

  /**
   * 計算信心度
   */
  async calculate(
    context: CalculationContext,
    customWeights?: Partial<ConfidenceWeights>
  ): Promise<ConfidenceResult> {
    const weights = { ...this.defaultWeights, ...customWeights };

    // 收集各因素
    const factors = await this.collectFactors(context);

    // 計算分解
    const breakdown = this.calculateBreakdown(factors, weights);

    // 計算整體信心度
    const overallConfidence = this.calculateOverall(breakdown);

    // 決定路由
    const routingDecision = this.determineRouting(overallConfidence);

    // 生成解釋
    const explanation = this.generateExplanation(factors, breakdown, routingDecision);

    return {
      overallConfidence,
      factors,
      weights,
      breakdown,
      routingDecision,
      explanation,
      calculatedAt: new Date(),
    };
  }

  /**
   * 收集各因素
   */
  private async collectFactors(context: CalculationContext): Promise<ConfidenceFactors> {
    const [
      extractionConfidence,
      issuerConfidence,
      formatMatchConfidence,
      fieldCompleteness,
      termMatchRate,
      historicalAccuracy,
    ] = await Promise.all([
      this.extractionProvider.getConfidence(context.extractionResult),
      this.issuerProvider.getConfidence(context.issuerResult),
      this.formatProvider.getConfidence(context.formatMatchResult),
      this.completenessProvider.getCompleteness(context.extractionResult),
      this.termProvider.getMatchRate(context),
      this.historyProvider.getHistoricalAccuracy(context.companyId, context.documentFormatId),
    ]);

    return {
      extractionConfidence,
      issuerConfidence,
      formatMatchConfidence,
      configMatchLevel: context.configLevel,
      historicalAccuracy,
      fieldCompleteness,
      termMatchRate,
    };
  }

  /**
   * 計算分解
   */
  private calculateBreakdown(
    factors: ConfidenceFactors,
    weights: ConfidenceWeights
  ): ConfidenceBreakdown {
    const extractionContribution = factors.extractionConfidence * weights.extractionConfidence;
    const issuerContribution = factors.issuerConfidence * weights.issuerConfidence;
    const formatContribution = factors.formatMatchConfidence * weights.formatMatchConfidence;
    const configBonus = this.configBonusMap[factors.configMatchLevel];
    const historyContribution = (factors.historicalAccuracy ?? 0.8) * weights.historicalAccuracy;
    const completenessContribution = factors.fieldCompleteness * weights.fieldCompleteness;
    const termContribution = factors.termMatchRate * weights.termMatchRate;

    const baseScore =
      extractionContribution +
      issuerContribution +
      formatContribution +
      historyContribution +
      completenessContribution +
      termContribution;

    return {
      baseScore,
      extractionContribution,
      issuerContribution,
      formatContribution,
      configBonus,
      historyContribution,
      completenessContribution,
      termContribution,
    };
  }

  /**
   * 計算整體信心度
   */
  private calculateOverall(breakdown: ConfidenceBreakdown): number {
    const total = breakdown.baseScore + breakdown.configBonus;
    return Math.min(1, Math.max(0, total));
  }

  /**
   * 決定路由
   */
  private determineRouting(confidence: number): RoutingDecision {
    if (confidence >= 0.90) return RoutingDecision.AUTO_APPROVE;
    if (confidence >= 0.70) return RoutingDecision.QUICK_REVIEW;
    return RoutingDecision.FULL_REVIEW;
  }

  /**
   * 生成解釋
   */
  private generateExplanation(
    factors: ConfidenceFactors,
    breakdown: ConfidenceBreakdown,
    decision: RoutingDecision
  ): string {
    const parts: string[] = [];

    // 主要貢獻因素
    const contributions = [
      { name: '提取信心度', value: breakdown.extractionContribution },
      { name: '發行者識別', value: breakdown.issuerContribution },
      { name: '格式匹配', value: breakdown.formatContribution },
      { name: '歷史準確率', value: breakdown.historyContribution },
      { name: '欄位完整度', value: breakdown.completenessContribution },
      { name: '術語匹配', value: breakdown.termContribution },
    ].sort((a, b) => b.value - a.value);

    const topContributors = contributions.slice(0, 3);
    parts.push(`主要貢獻因素：${topContributors.map(c => c.name).join('、')}`);

    // 配置加分
    if (breakdown.configBonus > 0) {
      parts.push(`配置匹配加分 +${(breakdown.configBonus * 100).toFixed(0)}%（${factors.configMatchLevel} 層級）`);
    }

    // 路由決策說明
    const decisionMap: Record<RoutingDecision, string> = {
      [RoutingDecision.AUTO_APPROVE]: '自動通過（信心度 ≥ 90%）',
      [RoutingDecision.QUICK_REVIEW]: '快速審核（信心度 70-89%）',
      [RoutingDecision.FULL_REVIEW]: '完整審核（信心度 < 70%）',
    };
    parts.push(`路由決策：${decisionMap[decision]}`);

    return parts.join('。');
  }
}
```

### 因素提供者範例

```typescript
// src/services/confidence/factor-providers/extraction-factor.provider.ts

/**
 * 提取信心度因素提供者
 */
export class ExtractionFactorProvider {
  /**
   * 從提取結果獲取信心度
   */
  async getConfidence(extractionResult: Record<string, unknown>): Promise<number> {
    // 如果結果包含 confidence 欄位
    if (typeof extractionResult.confidence === 'number') {
      return extractionResult.confidence;
    }

    // 基於結果品質計算
    const invoiceData = extractionResult.invoiceData as Record<string, unknown> | undefined;
    if (!invoiceData) return 0.5;

    let score = 0.5;

    // 必要欄位存在加分
    if (invoiceData.invoiceNumber) score += 0.1;
    if (invoiceData.invoiceDate) score += 0.1;
    if (invoiceData.totalAmount) score += 0.15;
    if (invoiceData.vendorName) score += 0.1;

    // lineItems 存在加分
    const lineItems = extractionResult.lineItems as unknown[];
    if (Array.isArray(lineItems) && lineItems.length > 0) {
      score += 0.05;
    }

    return Math.min(1, score);
  }
}
```

```typescript
// src/services/confidence/factor-providers/history-factor.provider.ts

/**
 * 歷史準確率因素提供者
 */
import { prisma } from '@/lib/prisma';

export class HistoryFactorProvider {
  /**
   * 獲取歷史準確率
   */
  async getHistoricalAccuracy(
    companyId?: string,
    documentFormatId?: string
  ): Promise<number | null> {
    if (!companyId && !documentFormatId) return null;

    // 查詢最近 100 筆審核記錄
    const reviews = await prisma.documentReview.findMany({
      where: {
        document: {
          ...(companyId && { companyId }),
          ...(documentFormatId && { documentFormatId }),
        },
        status: { in: ['APPROVED', 'REJECTED'] },
      },
      orderBy: { reviewedAt: 'desc' },
      take: 100,
      select: { status: true },
    });

    if (reviews.length === 0) return null;

    const approved = reviews.filter(r => r.status === 'APPROVED').length;
    return approved / reviews.length;
  }
}
```

```typescript
// src/services/confidence/factor-providers/completeness-factor.provider.ts

/**
 * 欄位完整度因素提供者
 */
export class CompletenessFactorProvider {
  private readonly requiredFields = [
    'invoiceNumber',
    'invoiceDate',
    'vendorName',
    'totalAmount',
  ];

  private readonly optionalFields = [
    'vendorAddress',
    'customerName',
    'dueDate',
    'currency',
    'lineItems',
  ];

  /**
   * 計算欄位完整度
   */
  async getCompleteness(extractionResult: Record<string, unknown>): Promise<number> {
    const invoiceData = extractionResult.invoiceData as Record<string, unknown> || {};

    // 必要欄位權重 70%
    let requiredScore = 0;
    for (const field of this.requiredFields) {
      if (this.hasValue(invoiceData[field])) {
        requiredScore += 1;
      }
    }
    const requiredRatio = requiredScore / this.requiredFields.length;

    // 可選欄位權重 30%
    let optionalScore = 0;
    for (const field of this.optionalFields) {
      if (this.hasValue(invoiceData[field]) || this.hasValue(extractionResult[field])) {
        optionalScore += 1;
      }
    }
    const optionalRatio = optionalScore / this.optionalFields.length;

    return requiredRatio * 0.7 + optionalRatio * 0.3;
  }

  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }
}
```

```typescript
// src/services/confidence/factor-providers/term-factor.provider.ts

/**
 * 術語匹配度因素提供者
 */
import { prisma } from '@/lib/prisma';
import { CalculationContext } from '../types';

export class TermFactorProvider {
  /**
   * 計算術語匹配度
   */
  async getMatchRate(context: CalculationContext): Promise<number> {
    if (!context.documentFormatId) return 0.5; // 無格式時返回中性值

    // 獲取該格式的已確認術語
    const confirmedTerms = await prisma.formatTerm.findMany({
      where: {
        documentFormatId: context.documentFormatId,
        status: 'CONFIRMED',
      },
      select: { normalizedTerm: true },
    });

    if (confirmedTerms.length === 0) return 0.7; // 無術語庫時返回較高預設值

    // 從提取結果獲取術語
    const extractedTerms = this.extractTerms(context.extractionResult);
    if (extractedTerms.length === 0) return 0.5;

    // 計算匹配率
    const confirmedSet = new Set(confirmedTerms.map(t => t.normalizedTerm.toLowerCase()));
    let matchCount = 0;

    for (const term of extractedTerms) {
      const normalized = term.toLowerCase().trim().replace(/\s+/g, ' ');
      if (confirmedSet.has(normalized)) {
        matchCount++;
      }
    }

    return matchCount / extractedTerms.length;
  }

  private extractTerms(result: Record<string, unknown>): string[] {
    const terms: string[] = [];
    const lineItems = result.lineItems as Array<Record<string, unknown>> || [];

    for (const item of lineItems) {
      if (typeof item.description === 'string') {
        terms.push(item.description);
      }
    }

    return terms;
  }
}
```

### 路由決策服務

```typescript
// src/services/confidence/routing-decision.service.ts

/**
 * @fileoverview 路由決策服務
 * @description
 *   基於信心度結果決定文件的處理路由
 *   支援動態閾值配置
 *
 * @module src/services/confidence/routing-decision
 * @since Epic 15 - Story 15-5
 */

import {
  RoutingDecision,
  RoutingThresholds,
  ConfidenceResult
} from './types';

export class RoutingDecisionService {
  private thresholds: RoutingThresholds = {
    autoApprove: 0.90,
    quickReview: 0.70,
  };

  /**
   * 更新閾值配置
   */
  updateThresholds(thresholds: Partial<RoutingThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 決定路由
   */
  decide(confidence: number): RoutingDecision {
    if (confidence >= this.thresholds.autoApprove) {
      return RoutingDecision.AUTO_APPROVE;
    }
    if (confidence >= this.thresholds.quickReview) {
      return RoutingDecision.QUICK_REVIEW;
    }
    return RoutingDecision.FULL_REVIEW;
  }

  /**
   * 獲取路由統計
   */
  async getRoutingStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byDecision: Record<RoutingDecision, number>;
    avgConfidenceByDecision: Record<RoutingDecision, number>;
  }> {
    // 實際實現會查詢資料庫
    // 這裡提供介面定義
    return {
      total: 0,
      byDecision: {
        [RoutingDecision.AUTO_APPROVE]: 0,
        [RoutingDecision.QUICK_REVIEW]: 0,
        [RoutingDecision.FULL_REVIEW]: 0,
      },
      avgConfidenceByDecision: {
        [RoutingDecision.AUTO_APPROVE]: 0,
        [RoutingDecision.QUICK_REVIEW]: 0,
        [RoutingDecision.FULL_REVIEW]: 0,
      },
    };
  }
}
```

### 模組導出

```typescript
// src/services/confidence/index.ts

export * from './types';
export * from './confidence-calculator.service';
export * from './routing-decision.service';
export * from './factor-providers/extraction-factor.provider';
export * from './factor-providers/issuer-factor.provider';
export * from './factor-providers/format-factor.provider';
export * from './factor-providers/completeness-factor.provider';
export * from './factor-providers/term-factor.provider';
export * from './factor-providers/history-factor.provider';
```

---

## 📊 Database Schema

### 信心度記錄模型

```prisma
// prisma/schema.prisma

model ConfidenceRecord {
  id                   String   @id @default(cuid())
  fileId               String   @map("file_id")

  // 整體信心度
  overallConfidence    Float    @map("overall_confidence")
  routingDecision      String   @map("routing_decision")

  // 各因素值
  extractionConfidence Float    @map("extraction_confidence")
  issuerConfidence     Float    @map("issuer_confidence")
  formatMatchConfidence Float   @map("format_match_confidence")
  configMatchLevel     String   @map("config_match_level")
  historicalAccuracy   Float?   @map("historical_accuracy")
  fieldCompleteness    Float    @map("field_completeness")
  termMatchRate        Float    @map("term_match_rate")

  // 分解
  breakdown            Json

  // 解釋
  explanation          String   @db.Text

  // 時間戳
  calculatedAt         DateTime @default(now()) @map("calculated_at")

  // 關聯
  file                 ProcessedFile @relation(fields: [fileId], references: [id])

  @@index([fileId])
  @@index([routingDecision])
  @@index([calculatedAt])
  @@map("confidence_records")
}
```

---

## 🔗 API Endpoints

### 信心度 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/files/:id/confidence` | 獲取文件信心度 |
| POST | `/api/v1/confidence/calculate` | 計算信心度 |
| GET | `/api/v1/admin/confidence/statistics` | 信心度統計 |
| PUT | `/api/v1/admin/routing/thresholds` | 更新路由閾值 |

---

## 🧪 Testing Strategy

### 單元測試

```typescript
// tests/unit/services/confidence/confidence-calculator.test.ts

import { ConfidenceCalculatorService } from '@/services/confidence';
import { ConfigMatchLevel } from '@/services/confidence/types';

describe('ConfidenceCalculatorService', () => {
  let service: ConfidenceCalculatorService;

  beforeEach(() => {
    service = new ConfidenceCalculatorService();
  });

  describe('calculate', () => {
    it('should return AUTO_APPROVE for high confidence', async () => {
      const result = await service.calculate({
        fileId: 'test-file',
        companyId: 'test-company',
        documentFormatId: 'test-format',
        extractionResult: {
          confidence: 0.95,
          invoiceData: {
            invoiceNumber: 'INV-001',
            invoiceDate: '2025-01-01',
            totalAmount: 1000,
            vendorName: 'Test Vendor',
          },
          lineItems: [{ description: 'Test Item' }],
        },
        issuerResult: { confidence: 0.95, method: 'LOGO' },
        formatMatchResult: { confidence: 0.9, isExactMatch: true },
        configLevel: ConfigMatchLevel.SPECIFIC,
      });

      expect(result.routingDecision).toBe('AUTO_APPROVE');
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should return FULL_REVIEW for low confidence', async () => {
      const result = await service.calculate({
        fileId: 'test-file',
        extractionResult: {
          confidence: 0.3,
          invoiceData: {},
        },
        configLevel: ConfigMatchLevel.DEFAULT,
      });

      expect(result.routingDecision).toBe('FULL_REVIEW');
      expect(result.overallConfidence).toBeLessThan(0.7);
    });
  });
});
```

---

## 📁 Files to Create/Modify

### New Files
| File | Description |
|------|-------------|
| `src/services/confidence/types.ts` | 類型定義 |
| `src/services/confidence/confidence-calculator.service.ts` | 計算服務 |
| `src/services/confidence/routing-decision.service.ts` | 路由決策服務 |
| `src/services/confidence/factor-providers/*.ts` | 各因素提供者 |
| `src/services/confidence/index.ts` | 模組導出 |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | 添加 ConfidenceRecord 模型 |
| `src/services/index.ts` | 導出 confidence 模組 |

---

## 🔗 Dependencies

### Upstream
- **Story 15-2**: 發行者識別（issuerConfidence）
- **Story 15-3**: 格式匹配（formatMatchConfidence）
- **Story 15-4**: 術語學習（termMatchRate）

### Downstream
- **Story 15-1**: 統一處理流程（RoutingDecisionStep）

---

## 📝 Implementation Notes

### 權重配置
- 總權重為 1.0（不含配置加分）
- 配置加分最高 10%
- 可通過環境變數或資料庫配置調整

### 歷史準確率
- 使用最近 100 筆審核記錄
- 新 Company/Format 使用預設值 0.8
- 準確率低於 0.5 會顯著降低信心度

### 路由閾值
- 預設值可在管理介面調整
- 建議不要設置 AUTO_APPROVE 低於 0.85
- 閾值變更會記錄到審計日誌

---

## ✅ Definition of Done

- [ ] 所有 Acceptance Criteria 通過
- [ ] 多維度因素計算實現
- [ ] 配置加分邏輯正確
- [ ] 歷史準確率整合
- [ ] 路由決策服務完成
- [ ] API 端點實現
- [ ] 單元測試覆蓋率 > 80%
- [ ] 程式碼審查通過
- [ ] 文檔更新完成

---

*Created: 2026-01-02*
*Epic: 15 - 統一 3 層機制到日常處理流程*
