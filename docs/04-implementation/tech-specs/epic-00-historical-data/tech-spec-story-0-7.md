# Tech Spec: Story 0.7 - 批量處理術語聚合整合

| 屬性 | 值 |
|------|------|
| Story ID | 0.7 |
| Story Key | 0-7-batch-term-aggregation-integration |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.5 (術語聚合), Story 0.6 (公司識別整合) |
| 預估工時 | 3-4 天 |
| 優先級 | P0 (必要) |

---

## 目標

將術語聚合服務整合到批量處理流程中，在批量處理完成後自動執行術語聚合分析，並按公司分組統計術語，為建立映射規則提供數據基礎。

---

## 驗收標準對應

| AC# | 驗收標準 | 實現方式 |
|-----|---------|---------|
| AC1 | 批量處理完成後自動聚合 | 修改批量處理完成邏輯，觸發聚合任務 |
| AC2 | 按公司分組的術語統計 | 擴展 `term-aggregation.service.ts` |
| AC3 | 術語分類建議 | 使用現有 `term-classification.service.ts` |
| AC4 | 聚合結果可視化 | 新增 `TermAggregationSummary` 組件 |
| AC5 | 聚合配置選項 | 擴展 `HistoricalBatch` 配置欄位 |

---

## 數據模型

### Prisma Schema 擴展

```prisma
// prisma/schema.prisma

// === 擴展批量狀態 ===
enum BatchStatus {
  UPLOADING
  PROCESSING
  COMPLETED
  AGGREGATING    // 新增：正在聚合
  AGGREGATED     // 新增：聚合完成
  FAILED
}

// === 擴展 HistoricalBatch 配置 ===
model HistoricalBatch {
  // 現有欄位...

  // 術語聚合配置
  enableTermAggregation   Boolean @default(true) @map("enable_term_aggregation")
  termSimilarityThreshold Float   @default(0.85) @map("term_similarity_threshold")
  autoClassifyTerms       Boolean @default(false) @map("auto_classify_terms")

  // 聚合結果
  aggregationResult TermAggregationResult?
}

// === 術語聚合結果 ===
model TermAggregationResult {
  id        String   @id @default(cuid())
  batchId   String   @unique @map("batch_id")
  batch     HistoricalBatch @relation(fields: [batchId], references: [id])

  // 統計摘要
  totalUniqueTerms      Int @map("total_unique_terms")
  totalOccurrences      Int @map("total_occurrences")
  universalTermsCount   Int @map("universal_terms_count")
  companySpecificCount  Int @map("company_specific_count")
  classifiedTermsCount  Int @default(0) @map("classified_terms_count")

  // 完整聚合數據
  resultData Json @map("result_data")

  // 元數據
  aggregatedAt DateTime @default(now()) @map("aggregated_at")

  @@map("term_aggregation_results")
}
```

---

## 類型定義

```typescript
// src/types/batch-term-aggregation.ts

/**
 * @fileoverview 批量術語聚合類型定義
 * @module src/types/batch-term-aggregation
 * @since Epic 0 - Story 0.7
 */

import { ChargeCategory } from '@prisma/client';

/**
 * 術語聚合配置
 */
export interface TermAggregationConfig {
  enabled: boolean;
  similarityThreshold: number;
  autoClassify: boolean;
}

/**
 * 公司術語聚合結果
 */
export interface CompanyTermAggregation {
  companyId: string;
  companyName: string;
  uniqueTermCount: number;
  totalOccurrences: number;
  terms: CompanyTerm[];
}

/**
 * 公司術語
 */
export interface CompanyTerm {
  term: string;
  frequency: number;
  suggestedCategory?: ChargeCategory;
  confidence?: number;
  isUniversal: boolean;
}

/**
 * 批量術語聚合結果
 */
export interface BatchTermAggregationResult {
  batchId: string;

  // 統計摘要
  stats: {
    totalUniqueTerms: number;
    totalOccurrences: number;
    universalTermsCount: number;
    companySpecificCount: number;
    classifiedTermsCount: number;
    companiesWithTerms: number;
  };

  // 通用術語（出現在 2+ 公司）
  universalTerms: UniversalTerm[];

  // 按公司分組
  companyTerms: CompanyTermAggregation[];

  // 聚合時間
  aggregatedAt: Date;
}

/**
 * 通用術語
 */
export interface UniversalTerm {
  term: string;
  totalFrequency: number;
  companyCount: number;
  companies: {
    companyId: string;
    companyName: string;
    frequency: number;
  }[];
  suggestedCategory?: ChargeCategory;
  confidence?: number;
}

/**
 * 術語分佈摘要（用於 UI）
 */
export interface TermDistributionSummary {
  topTerms: { term: string; frequency: number }[];
  categoryBreakdown: { category: ChargeCategory; count: number }[];
  companyBreakdown: { companyName: string; termCount: number }[];
}
```

---

## 實現指南

### Phase 1: 批量完成後觸發聚合

#### 1.1 修改批量處理完成邏輯

```typescript
// src/services/batch-processor.service.ts

import { aggregateTermsForBatch, saveAggregationResult } from './batch-term-aggregation.service';

/**
 * 批量處理完成處理
 */
async function onBatchComplete(batchId: string): Promise<void> {
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) return;

  // 檢查是否啟用術語聚合
  if (batch.enableTermAggregation) {
    try {
      // 更新狀態為聚合中
      await prisma.historicalBatch.update({
        where: { id: batchId },
        data: { status: 'AGGREGATING' },
      });

      // 執行術語聚合
      const aggregationResult = await aggregateTermsForBatch(batchId, {
        similarityThreshold: batch.termSimilarityThreshold,
        autoClassify: batch.autoClassifyTerms,
      });

      // 儲存聚合結果
      await saveAggregationResult(batchId, aggregationResult);

      // 更新狀態為聚合完成
      await prisma.historicalBatch.update({
        where: { id: batchId },
        data: { status: 'AGGREGATED' },
      });

      console.log(`Term aggregation completed for batch ${batchId}`);
    } catch (error) {
      console.error(`Term aggregation failed for batch ${batchId}:`, error);
      // 聚合失敗不影響批量處理結果，只記錄錯誤
      await prisma.historicalBatch.update({
        where: { id: batchId },
        data: { status: 'COMPLETED' }, // 回到已完成狀態
      });
    }
  }
}
```

### Phase 2: 按公司分組聚合

#### 2.1 批量術語聚合服務

```typescript
// src/services/batch-term-aggregation.service.ts

/**
 * @fileoverview 批量術語聚合服務
 * @module src/services/batch-term-aggregation
 * @since Epic 0 - Story 0.7
 */

import { prisma } from '@/lib/prisma';
import { classifyTerms } from './term-classification.service';
import type {
  BatchTermAggregationResult,
  CompanyTermAggregation,
  UniversalTerm,
  TermAggregationConfig,
} from '@/types/batch-term-aggregation';

/**
 * 執行批量術語聚合
 */
export async function aggregateTermsForBatch(
  batchId: string,
  config: Omit<TermAggregationConfig, 'enabled'>
): Promise<BatchTermAggregationResult> {
  // 1. 獲取所有處理完成的文件及其公司關聯
  const files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
    },
    select: {
      id: true,
      extractionResult: true,
      identifiedCompanyId: true,
      identifiedCompany: {
        select: { id: true, name: true },
      },
    },
  });

  // 2. 建立術語 → 公司 → 頻率 的映射
  const termCompanyMap = new Map<string, Map<string, {
    companyName: string;
    frequency: number;
  }>>();

  let totalOccurrences = 0;

  for (const file of files) {
    if (!file.extractionResult) continue;

    const result = file.extractionResult as any;
    const companyId = file.identifiedCompanyId ?? 'UNKNOWN';
    const companyName = file.identifiedCompany?.name ?? '未識別';

    // 提取 line items 中的術語
    const lineItems = result.lineItems ?? result.items ?? [];

    for (const item of lineItems) {
      const term = normalizeTermForAggregation(
        item.description ?? item.name ?? ''
      );

      if (!term) continue;

      totalOccurrences++;

      if (!termCompanyMap.has(term)) {
        termCompanyMap.set(term, new Map());
      }

      const companyMap = termCompanyMap.get(term)!;
      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, { companyName, frequency: 0 });
      }
      companyMap.get(companyId)!.frequency++;
    }
  }

  // 3. 分類：通用術語 vs 公司特定術語
  const universalTerms: UniversalTerm[] = [];
  const companyTermsMap = new Map<string, CompanyTermAggregation>();

  for (const [term, companyMap] of termCompanyMap.entries()) {
    const totalFrequency = Array.from(companyMap.values())
      .reduce((sum, c) => sum + c.frequency, 0);

    if (companyMap.size >= 2) {
      // 通用術語：出現在 2+ 公司
      universalTerms.push({
        term,
        totalFrequency,
        companyCount: companyMap.size,
        companies: Array.from(companyMap.entries()).map(([companyId, data]) => ({
          companyId,
          companyName: data.companyName,
          frequency: data.frequency,
        })),
      });
    }

    // 同時添加到公司特定統計
    for (const [companyId, data] of companyMap.entries()) {
      if (!companyTermsMap.has(companyId)) {
        companyTermsMap.set(companyId, {
          companyId,
          companyName: data.companyName,
          uniqueTermCount: 0,
          totalOccurrences: 0,
          terms: [],
        });
      }

      const companyAgg = companyTermsMap.get(companyId)!;
      companyAgg.uniqueTermCount++;
      companyAgg.totalOccurrences += data.frequency;
      companyAgg.terms.push({
        term,
        frequency: data.frequency,
        isUniversal: companyMap.size >= 2,
      });
    }
  }

  // 4. 相似術語聚類（可選）
  if (config.similarityThreshold < 1) {
    // TODO: 實現相似術語合併
  }

  // 5. AI 分類（如果啟用）
  if (config.autoClassify) {
    const allTerms = Array.from(termCompanyMap.keys());
    const classifications = await classifyTerms(allTerms);

    // 更新術語分類
    for (const classification of classifications) {
      const normalizedTerm = classification.term.toLowerCase().trim();

      // 更新通用術語
      const universal = universalTerms.find(t => t.term === normalizedTerm);
      if (universal) {
        universal.suggestedCategory = classification.category;
        universal.confidence = classification.confidence;
      }

      // 更新公司術語
      for (const companyAgg of companyTermsMap.values()) {
        const companyTerm = companyAgg.terms.find(t => t.term === normalizedTerm);
        if (companyTerm) {
          companyTerm.suggestedCategory = classification.category;
          companyTerm.confidence = classification.confidence;
        }
      }
    }
  }

  // 6. 排序
  universalTerms.sort((a, b) => b.totalFrequency - a.totalFrequency);

  const companyTerms = Array.from(companyTermsMap.values())
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences);

  for (const company of companyTerms) {
    company.terms.sort((a, b) => b.frequency - a.frequency);
  }

  // 7. 計算統計
  const classifiedCount = config.autoClassify
    ? universalTerms.filter(t => t.suggestedCategory).length
    : 0;

  return {
    batchId,
    stats: {
      totalUniqueTerms: termCompanyMap.size,
      totalOccurrences,
      universalTermsCount: universalTerms.length,
      companySpecificCount: termCompanyMap.size - universalTerms.length,
      classifiedTermsCount: classifiedCount,
      companiesWithTerms: companyTermsMap.size,
    },
    universalTerms,
    companyTerms,
    aggregatedAt: new Date(),
  };
}

/**
 * 儲存聚合結果
 */
export async function saveAggregationResult(
  batchId: string,
  result: BatchTermAggregationResult
): Promise<void> {
  await prisma.termAggregationResult.upsert({
    where: { batchId },
    create: {
      batchId,
      totalUniqueTerms: result.stats.totalUniqueTerms,
      totalOccurrences: result.stats.totalOccurrences,
      universalTermsCount: result.stats.universalTermsCount,
      companySpecificCount: result.stats.companySpecificCount,
      classifiedTermsCount: result.stats.classifiedTermsCount,
      resultData: result as any,
    },
    update: {
      totalUniqueTerms: result.stats.totalUniqueTerms,
      totalOccurrences: result.stats.totalOccurrences,
      universalTermsCount: result.stats.universalTermsCount,
      companySpecificCount: result.stats.companySpecificCount,
      classifiedTermsCount: result.stats.classifiedTermsCount,
      resultData: result as any,
      aggregatedAt: new Date(),
    },
  });
}

/**
 * 獲取聚合結果
 */
export async function getAggregationResult(
  batchId: string
): Promise<BatchTermAggregationResult | null> {
  const result = await prisma.termAggregationResult.findUnique({
    where: { batchId },
  });

  if (!result) return null;

  return result.resultData as BatchTermAggregationResult;
}

/**
 * 正規化術語
 */
function normalizeTermForAggregation(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Phase 3: 聚合結果 API

#### 3.1 聚合結果 API

```typescript
// src/app/api/admin/historical-data/[batchId]/term-aggregation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAggregationResult } from '@/services/batch-term-aggregation.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;

    const result = await getAggregationResult(batchId);

    if (!result) {
      return NextResponse.json(
        { error: 'Aggregation result not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching aggregation result:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aggregation result' },
      { status: 500 }
    );
  }
}
```

### Phase 4: 聚合結果 UI

#### 4.1 術語聚合摘要組件

```tsx
// src/components/features/historical-data/TermAggregationSummary.tsx

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  Building2,
  Globe,
  Sparkles,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import type { BatchTermAggregationResult } from '@/types/batch-term-aggregation';

interface TermAggregationSummaryProps {
  batchId: string;
  result: BatchTermAggregationResult | null;
  isLoading: boolean;
}

export function TermAggregationSummary({
  batchId,
  result,
  isLoading,
}: TermAggregationSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          載入術語聚合結果...
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          尚未執行術語聚合
        </CardContent>
      </Card>
    );
  }

  const { stats, universalTerms, companyTerms } = result;

  return (
    <div className="space-y-4">
      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              唯一術語
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUniqueTerms}</div>
            <p className="text-xs text-muted-foreground">
              總出現 {stats.totalOccurrences} 次
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Globe className="h-4 w-4" />
              通用術語
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.universalTermsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              出現在 2+ 公司
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              公司數量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.companiesWithTerms}</div>
            <p className="text-xs text-muted-foreground">
              有術語記錄
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              已分類
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.classifiedTermsCount}
            </div>
            <Progress
              value={(stats.classifiedTermsCount / stats.totalUniqueTerms) * 100}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* 熱門通用術語 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">熱門通用術語</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/term-analysis?batchId=${batchId}`}>
              查看全部 <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {universalTerms.slice(0, 5).map((term, index) => (
              <div
                key={term.term}
                className="flex items-center justify-between p-2 rounded border"
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground w-6">#{index + 1}</span>
                  <span className="font-medium">{term.term}</span>
                  {term.suggestedCategory && (
                    <Badge variant="secondary">{term.suggestedCategory}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{term.totalFrequency} 次</span>
                  <span>{term.companyCount} 公司</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 公司術語分佈 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            公司術語分佈
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {companyTerms.slice(0, 5).map((company) => (
              <div key={company.companyId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{company.companyName}</span>
                  <span className="text-muted-foreground">
                    {company.uniqueTermCount} 術語
                  </span>
                </div>
                <Progress
                  value={(company.uniqueTermCount / stats.totalUniqueTerms) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 驗證清單

### 功能驗證

- [ ] **AC1 批量處理完成後自動聚合**
  - [ ] 批量完成時觸發聚合
  - [ ] 狀態正確更新為 AGGREGATING → AGGREGATED
  - [ ] 聚合失敗不影響批量結果

- [ ] **AC2 按公司分組的術語統計**
  - [ ] 公司分組正確
  - [ ] 通用術語識別正確
  - [ ] 頻率統計準確

- [ ] **AC3 術語分類建議**
  - [ ] AI 分類可選開啟
  - [ ] 分類結果正確保存

- [ ] **AC4 聚合結果可視化**
  - [ ] 統計卡片顯示正確
  - [ ] 熱門術語列表正確
  - [ ] 公司分佈圖表正確

- [ ] **AC5 聚合配置選項**
  - [ ] 可啟用/禁用聚合
  - [ ] 可調整相似度閾值
  - [ ] 可選擇自動分類

### 技術驗證

- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] Prisma Migration 成功
- [ ] 大量數據性能測試

---

## 文件清單

### 新增文件

| 文件路徑 | 說明 |
|---------|------|
| `src/types/batch-term-aggregation.ts` | 批量術語聚合類型 |
| `src/services/batch-term-aggregation.service.ts` | 批量術語聚合服務 |
| `src/app/api/admin/historical-data/[batchId]/term-aggregation/route.ts` | 聚合結果 API |
| `src/components/features/historical-data/TermAggregationSummary.tsx` | 聚合結果組件 |

### 修改文件

| 文件路徑 | 說明 |
|---------|------|
| `prisma/schema.prisma` | 新增 TermAggregationResult，擴展 BatchStatus |
| `src/services/batch-processor.service.ts` | 添加聚合觸發邏輯 |
| `src/components/features/historical-data/BatchUploadDialog.tsx` | 添加聚合配置 |
| `src/app/(dashboard)/admin/historical-data/[batchId]/page.tsx` | 添加聚合結果區塊 |

---

*Tech Spec 建立日期: 2025-12-25*
*Story Status: backlog*
