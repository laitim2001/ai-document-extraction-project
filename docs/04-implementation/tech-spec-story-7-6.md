# Tech Spec: Story 7-6 - AI API 使用量與成本顯示

## Overview

### Story Reference
- **Story ID**: 7.6
- **Story Key**: 7-6-ai-api-usage-cost-display
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: ready-for-dev

### User Story
**As a** 用戶,
**I want** 查看 AI API 使用量和成本,
**So that** 我可以監控和控制 AI 服務支出。

### Dependencies
- **Story 7.7**: 城市處理數量追蹤（ApiUsageLog 數據來源）
- **Story 7.1**: 處理統計儀表板（基礎架構）
- **Story 7.2**: 時間範圍篩選（DateRange 篩選器）

### FR Coverage
- **FR35**: AI 成本監控功能

---

## Database Schema

### Prisma Models

```prisma
// prisma/schema.prisma

// API 提供者枚舉
enum ApiProvider {
  AZURE_DOC_INTELLIGENCE  // Azure Document Intelligence OCR
  OPENAI                   // OpenAI GPT API
  AZURE_OPENAI            // Azure OpenAI Service
}

// API 使用日誌模型
model ApiUsageLog {
  id            String      @id @default(uuid())
  documentId    String?     @map("document_id")
  cityCode      String      @map("city_code")
  provider      ApiProvider
  operation     String      // 'ocr', 'extraction', 'validation', 'classification', etc.
  tokensInput   Int?        @map("tokens_input")
  tokensOutput  Int?        @map("tokens_output")
  estimatedCost Float       @map("estimated_cost")
  responseTime  Int?        @map("response_time")  // milliseconds
  success       Boolean     @default(true)
  errorMessage  String?     @map("error_message")
  metadata      Json?       // Additional metadata (model version, etc.)
  createdAt     DateTime    @default(now()) @map("created_at")

  document      Document?   @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([documentId])
  @@index([cityCode])
  @@index([provider])
  @@index([createdAt])
  @@index([cityCode, createdAt])
  @@index([provider, createdAt])
  @@map("api_usage_logs")
}

// API 定價配置模型（可選，用於動態定價）
model ApiPricingConfig {
  id              String      @id @default(uuid())
  provider        ApiProvider
  pricingType     String      // 'per_call', 'per_token_input', 'per_token_output'
  pricePerUnit    Float       @map("price_per_unit")  // USD
  effectiveFrom   DateTime    @map("effective_from")
  effectiveTo     DateTime?   @map("effective_to")
  modelVersion    String?     @map("model_version")
  isActive        Boolean     @default(true) @map("is_active")
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")

  @@index([provider, isActive])
  @@index([effectiveFrom, effectiveTo])
  @@map("api_pricing_configs")
}
```

### Migration Script

```sql
-- Migration: create_api_usage_tables
-- Created: 2025-12-16

-- Create ApiProvider enum
CREATE TYPE "ApiProvider" AS ENUM ('AZURE_DOC_INTELLIGENCE', 'OPENAI', 'AZURE_OPENAI');

-- Create api_usage_logs table
CREATE TABLE "api_usage_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "document_id" UUID,
    "city_code" VARCHAR(10) NOT NULL,
    "provider" "ApiProvider" NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "tokens_input" INTEGER,
    "tokens_output" INTEGER,
    "estimated_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "response_time" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_usage_logs_document_fkey" FOREIGN KEY ("document_id")
        REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for api_usage_logs
CREATE INDEX "api_usage_logs_document_id_idx" ON "api_usage_logs"("document_id");
CREATE INDEX "api_usage_logs_city_code_idx" ON "api_usage_logs"("city_code");
CREATE INDEX "api_usage_logs_provider_idx" ON "api_usage_logs"("provider");
CREATE INDEX "api_usage_logs_created_at_idx" ON "api_usage_logs"("created_at");
CREATE INDEX "api_usage_logs_city_created_idx" ON "api_usage_logs"("city_code", "created_at");
CREATE INDEX "api_usage_logs_provider_created_idx" ON "api_usage_logs"("provider", "created_at");

-- Create api_pricing_configs table
CREATE TABLE "api_pricing_configs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "provider" "ApiProvider" NOT NULL,
    "pricing_type" VARCHAR(30) NOT NULL,
    "price_per_unit" DOUBLE PRECISION NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "model_version" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for api_pricing_configs
CREATE INDEX "api_pricing_configs_provider_active_idx" ON "api_pricing_configs"("provider", "is_active");
CREATE INDEX "api_pricing_configs_effective_idx" ON "api_pricing_configs"("effective_from", "effective_to");

-- Insert default pricing (as of 2025-12)
INSERT INTO "api_pricing_configs" ("provider", "pricing_type", "price_per_unit", "effective_from", "model_version")
VALUES
    ('AZURE_DOC_INTELLIGENCE', 'per_call', 0.001, '2025-01-01', 'v3.1'),
    ('OPENAI', 'per_token_input', 0.00001, '2025-01-01', 'gpt-4-turbo'),
    ('OPENAI', 'per_token_output', 0.00003, '2025-01-01', 'gpt-4-turbo'),
    ('AZURE_OPENAI', 'per_token_input', 0.00001, '2025-01-01', 'gpt-4-turbo'),
    ('AZURE_OPENAI', 'per_token_output', 0.00003, '2025-01-01', 'gpt-4-turbo');
```

---

## Type Definitions

### Core Types

```typescript
// src/types/ai-cost.ts

/**
 * API 提供者類型
 */
export type ApiProvider = 'AZURE_DOC_INTELLIGENCE' | 'OPENAI' | 'AZURE_OPENAI';

/**
 * API 操作類型
 */
export type ApiOperation =
  | 'ocr'           // Document Intelligence OCR
  | 'extraction'    // Field extraction
  | 'validation'    // Data validation
  | 'classification' // Document classification
  | 'embedding'     // Vector embedding
  | 'completion';   // Chat completion

/**
 * API 定價配置
 */
export interface ApiPricing {
  perCall?: number;        // Per API call (Document Intelligence)
  perTokenInput?: number;  // Per input token (OpenAI/Azure OpenAI)
  perTokenOutput?: number; // Per output token (OpenAI/Azure OpenAI)
}

/**
 * 默認 API 定價 (USD)
 */
export const DEFAULT_API_PRICING: Record<ApiProvider, ApiPricing> = {
  AZURE_DOC_INTELLIGENCE: {
    perCall: 0.001  // $0.001 per page
  },
  OPENAI: {
    perTokenInput: 0.00001,   // $0.01 per 1K tokens
    perTokenOutput: 0.00003   // $0.03 per 1K tokens
  },
  AZURE_OPENAI: {
    perTokenInput: 0.00001,
    perTokenOutput: 0.00003
  }
};

/**
 * Token 使用統計
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * 單一 API 提供者統計
 */
export interface ProviderStats {
  provider: ApiProvider;
  calls: number;
  tokens: {
    input: number;
    output: number;
  };
  cost: number;
  percentage: number;  // 占總成本百分比
}

/**
 * 趨勢變化數據
 */
export interface TrendChange {
  costChange: number;     // 成本變化百分比
  callsChange: number;    // 調用次數變化百分比
  tokensChange: number;   // Token 用量變化百分比
}

/**
 * AI 成本摘要
 */
export interface AiCostSummary {
  totalCost: number;           // 總成本 (USD)
  totalCalls: number;          // 總調用次數
  totalTokens: TokenUsage;     // 總 Token 使用量
  byProvider: ProviderStats[]; // 按提供者分類
  trend: TrendChange;          // 與上期對比
  periodStart: string;         // 統計起始日期
  periodEnd: string;           // 統計結束日期
}

/**
 * 單一趨勢點數據
 */
export interface AiCostTrendPoint {
  date: string;              // ISO date string
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
  byProvider: {
    provider: ApiProvider;
    cost: number;
    calls: number;
    tokens: number;
  }[];
}

/**
 * 單一 API 調用記錄
 */
export interface ApiCallRecord {
  provider: ApiProvider;
  operation: ApiOperation;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  timestamp: string;
}

/**
 * 文件 API 使用詳情
 */
export interface DocumentApiUsage {
  id: string;
  invoiceNumber: string;
  forwarderCode: string;
  processedAt: string;
  apiCalls: ApiCallRecord[];
  totalCost: number;
}

/**
 * 日期明細數據
 */
export interface DailyAiCostDetail {
  date: string;
  totalCost: number;
  totalCalls: number;
  documents: DocumentApiUsage[];
  byProvider: {
    provider: ApiProvider;
    cost: number;
    calls: number;
  }[];
}

/**
 * 成本趨勢查詢參數
 */
export interface CostTrendQueryParams {
  startDate: string;
  endDate: string;
  granularity?: 'day' | 'week' | 'month';
  providers?: ApiProvider[];
}

/**
 * 成本摘要查詢參數
 */
export interface CostSummaryQueryParams {
  startDate: string;
  endDate: string;
  forwarderCodes?: string[];
}

/**
 * 異常檢測結果
 */
export interface CostAnomaly {
  date: string;
  actualCost: number;
  expectedCost: number;
  deviation: number;      // 偏差百分比
  severity: 'low' | 'medium' | 'high';
  possibleCauses: string[];
}
```

### API Response Types

```typescript
// src/types/api/ai-cost.ts

import { AiCostSummary, AiCostTrendPoint, DailyAiCostDetail, CostAnomaly } from '../ai-cost';

/**
 * 成本摘要 API 回應
 */
export interface AiCostSummaryResponse {
  success: boolean;
  data: AiCostSummary;
  meta?: {
    cacheHit: boolean;
    generatedAt: string;
  };
}

/**
 * 成本趨勢 API 回應
 */
export interface AiCostTrendResponse {
  success: boolean;
  data: AiCostTrendPoint[];
  meta?: {
    granularity: 'day' | 'week' | 'month';
    totalDataPoints: number;
  };
}

/**
 * 日期明細 API 回應
 */
export interface DailyAiCostDetailResponse {
  success: boolean;
  data: DailyAiCostDetail;
}

/**
 * 異常檢測 API 回應
 */
export interface CostAnomalyResponse {
  success: boolean;
  data: {
    anomalies: CostAnomaly[];
    threshold: number;
  };
}
```

---

## Service Implementation

### AI Cost Service

```typescript
// src/services/ai-cost.service.ts

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { CityFilter } from '@/middleware/city-filter';
import {
  AiCostSummary,
  AiCostTrendPoint,
  DailyAiCostDetail,
  ApiProvider,
  ProviderStats,
  DEFAULT_API_PRICING,
  CostAnomaly
} from '@/types/ai-cost';

interface PeriodStats {
  totalCost: number;
  totalCalls: number;
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  byProvider: Omit<ProviderStats, 'percentage'>[];
}

export class AiCostService {
  private readonly CACHE_TTL = 60 * 5; // 5 minutes
  private readonly ANOMALY_THRESHOLD = 2.0; // 2x standard deviation

  /**
   * 獲取成本摘要
   */
  async getCostSummary(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<AiCostSummary> {
    const cacheKey = this.buildCacheKey('summary', cityFilter, startDate, endDate);

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const cityWhere = this.buildCityWhereClause(cityFilter);

    // Fetch current period stats
    const currentStats = await this.getPeriodStats(cityWhere, startDate, endDate);

    // Calculate previous period for comparison
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodLength);
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStats = await this.getPeriodStats(cityWhere, prevStartDate, prevEndDate);

    // Build summary with trend comparison
    const summary: AiCostSummary = {
      totalCost: currentStats.totalCost,
      totalCalls: currentStats.totalCalls,
      totalTokens: currentStats.totalTokens,
      byProvider: currentStats.byProvider.map(p => ({
        ...p,
        percentage: currentStats.totalCost > 0
          ? (p.cost / currentStats.totalCost) * 100
          : 0
      })),
      trend: {
        costChange: this.calculatePercentageChange(
          currentStats.totalCost,
          prevStats.totalCost
        ),
        callsChange: this.calculatePercentageChange(
          currentStats.totalCalls,
          prevStats.totalCalls
        ),
        tokensChange: this.calculatePercentageChange(
          currentStats.totalTokens.total,
          prevStats.totalTokens.total
        )
      },
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString()
    };

    // Cache result
    await redis.set(cacheKey, JSON.stringify(summary), 'EX', this.CACHE_TTL);

    return summary;
  }

  /**
   * 獲取成本趨勢數據
   */
  async getCostTrend(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<AiCostTrendPoint[]> {
    const cityWhere = this.buildCityWhereClause(cityFilter);

    // Build date format based on granularity
    const dateFormat = this.getDateFormat(granularity);

    // Raw SQL for efficient aggregation
    const result = await prisma.$queryRaw<{
      date: string;
      provider: ApiProvider;
      calls: bigint;
      cost: number;
      tokens_input: bigint;
      tokens_output: bigint;
    }[]>`
      SELECT
        TO_CHAR(created_at, ${dateFormat}) as date,
        provider,
        COUNT(*) as calls,
        SUM(estimated_cost) as cost,
        COALESCE(SUM(tokens_input), 0) as tokens_input,
        COALESCE(SUM(tokens_output), 0) as tokens_output
      FROM api_usage_logs
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        ${this.buildCityRawWhere(cityWhere)}
      GROUP BY TO_CHAR(created_at, ${dateFormat}), provider
      ORDER BY date ASC
    `;

    // Aggregate by date
    const trendMap = new Map<string, AiCostTrendPoint>();

    for (const row of result) {
      if (!trendMap.has(row.date)) {
        trendMap.set(row.date, {
          date: row.date,
          totalCost: 0,
          totalCalls: 0,
          totalTokens: 0,
          byProvider: []
        });
      }

      const point = trendMap.get(row.date)!;
      const calls = Number(row.calls);
      const cost = row.cost || 0;
      const tokens = Number(row.tokens_input) + Number(row.tokens_output);

      point.totalCost += cost;
      point.totalCalls += calls;
      point.totalTokens += tokens;
      point.byProvider.push({
        provider: row.provider,
        cost,
        calls,
        tokens
      });
    }

    return Array.from(trendMap.values());
  }

  /**
   * 獲取特定日期的詳細成本明細
   */
  async getDailyDetail(
    cityFilter: CityFilter,
    date: Date
  ): Promise<DailyAiCostDetail> {
    const cityWhere = this.buildCityWhereClause(cityFilter);

    // Set date boundaries
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all API logs for the day with document info
    const logs = await prisma.apiUsageLog.findMany({
      where: {
        ...cityWhere,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        document: {
          select: {
            id: true,
            invoiceNumber: true,
            processedAt: true,
            forwarder: {
              select: { code: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by document
    const documentMap = new Map<string, any>();
    const providerTotals = new Map<ApiProvider, { cost: number; calls: number }>();

    for (const log of logs) {
      const docId = log.documentId || 'system';

      // Initialize document entry
      if (!documentMap.has(docId)) {
        documentMap.set(docId, {
          id: log.document?.id || 'N/A',
          invoiceNumber: log.document?.invoiceNumber || 'System Operation',
          forwarderCode: log.document?.forwarder?.code || 'N/A',
          processedAt: log.document?.processedAt?.toISOString() ||
                       log.createdAt.toISOString(),
          apiCalls: [],
          totalCost: 0
        });
      }

      const doc = documentMap.get(docId)!;

      // Add API call record
      doc.apiCalls.push({
        provider: log.provider,
        operation: log.operation,
        tokensInput: log.tokensInput || 0,
        tokensOutput: log.tokensOutput || 0,
        cost: log.estimatedCost,
        timestamp: log.createdAt.toISOString()
      });
      doc.totalCost += log.estimatedCost;

      // Update provider totals
      const providerStats = providerTotals.get(log.provider) || { cost: 0, calls: 0 };
      providerStats.cost += log.estimatedCost;
      providerStats.calls += 1;
      providerTotals.set(log.provider, providerStats);
    }

    return {
      date: date.toISOString().split('T')[0],
      totalCost: logs.reduce((sum, l) => sum + l.estimatedCost, 0),
      totalCalls: logs.length,
      documents: Array.from(documentMap.values()),
      byProvider: Array.from(providerTotals.entries()).map(([provider, stats]) => ({
        provider,
        cost: stats.cost,
        calls: stats.calls
      }))
    };
  }

  /**
   * 檢測成本異常
   */
  async detectAnomalies(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<CostAnomaly[]> {
    const trendData = await this.getCostTrend(cityFilter, startDate, endDate, 'day');

    if (trendData.length < 7) {
      return []; // Need at least 7 data points for meaningful analysis
    }

    // Calculate statistics
    const costs = trendData.map(d => d.totalCost);
    const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
    const stdDev = Math.sqrt(
      costs.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / costs.length
    );

    // Detect anomalies
    const anomalies: CostAnomaly[] = [];

    for (const point of trendData) {
      const deviation = Math.abs(point.totalCost - mean) / stdDev;

      if (deviation > this.ANOMALY_THRESHOLD) {
        const severity = deviation > 3 ? 'high' : deviation > 2.5 ? 'medium' : 'low';

        anomalies.push({
          date: point.date,
          actualCost: point.totalCost,
          expectedCost: mean,
          deviation: ((point.totalCost - mean) / mean) * 100,
          severity,
          possibleCauses: this.inferAnomalyCauses(point, mean)
        });
      }
    }

    return anomalies;
  }

  /**
   * 記錄 API 使用
   */
  async logApiUsage(
    documentId: string | null,
    cityCode: string,
    provider: ApiProvider,
    operation: string,
    tokensInput: number | null,
    tokensOutput: number | null,
    responseTime: number | null,
    success: boolean = true,
    errorMessage: string | null = null,
    metadata: Record<string, any> | null = null
  ): Promise<void> {
    const estimatedCost = this.calculateCost(provider, tokensInput, tokensOutput);

    await prisma.apiUsageLog.create({
      data: {
        documentId,
        cityCode,
        provider,
        operation,
        tokensInput,
        tokensOutput,
        estimatedCost,
        responseTime,
        success,
        errorMessage,
        metadata
      }
    });

    // Invalidate relevant caches
    await this.invalidateCaches(cityCode);
  }

  // ==================== Private Methods ====================

  private async getPeriodStats(
    cityWhere: Record<string, unknown>,
    startDate: Date,
    endDate: Date
  ): Promise<PeriodStats> {
    const logs = await prisma.apiUsageLog.groupBy({
      by: ['provider'],
      where: {
        ...cityWhere,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _count: { id: true },
      _sum: {
        tokensInput: true,
        tokensOutput: true,
        estimatedCost: true
      }
    });

    const byProvider = logs.map(log => ({
      provider: log.provider,
      calls: log._count.id,
      tokens: {
        input: log._sum.tokensInput || 0,
        output: log._sum.tokensOutput || 0
      },
      cost: log._sum.estimatedCost || 0
    }));

    return {
      totalCost: byProvider.reduce((sum, p) => sum + p.cost, 0),
      totalCalls: byProvider.reduce((sum, p) => sum + p.calls, 0),
      totalTokens: {
        input: byProvider.reduce((sum, p) => sum + p.tokens.input, 0),
        output: byProvider.reduce((sum, p) => sum + p.tokens.output, 0),
        total: byProvider.reduce(
          (sum, p) => sum + p.tokens.input + p.tokens.output,
          0
        )
      },
      byProvider
    };
  }

  private calculateCost(
    provider: ApiProvider,
    tokensInput: number | null,
    tokensOutput: number | null
  ): number {
    const pricing = DEFAULT_API_PRICING[provider];

    if (pricing.perCall) {
      return pricing.perCall;
    }

    let cost = 0;
    if (pricing.perTokenInput && tokensInput) {
      cost += pricing.perTokenInput * tokensInput;
    }
    if (pricing.perTokenOutput && tokensOutput) {
      cost += pricing.perTokenOutput * tokensOutput;
    }

    return cost;
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  private buildCityWhereClause(cityFilter: CityFilter): Record<string, unknown> {
    if (cityFilter.isGlobalAdmin) {
      return {};
    }
    if (cityFilter.cityCodes.length === 1) {
      return { cityCode: cityFilter.cityCodes[0] };
    }
    return { cityCode: { in: cityFilter.cityCodes } };
  }

  private buildCityRawWhere(cityWhere: Record<string, unknown>): string {
    if (Object.keys(cityWhere).length === 0) {
      return '';
    }
    if (typeof cityWhere.cityCode === 'string') {
      return `AND city_code = '${cityWhere.cityCode}'`;
    }
    if (cityWhere.cityCode && (cityWhere.cityCode as any).in) {
      const codes = (cityWhere.cityCode as any).in.map((c: string) => `'${c}'`).join(',');
      return `AND city_code IN (${codes})`;
    }
    return '';
  }

  private getDateFormat(granularity: 'day' | 'week' | 'month'): string {
    switch (granularity) {
      case 'day':
        return 'YYYY-MM-DD';
      case 'week':
        return 'IYYY-IW';
      case 'month':
        return 'YYYY-MM';
    }
  }

  private inferAnomalyCauses(
    point: AiCostTrendPoint,
    expectedCost: number
  ): string[] {
    const causes: string[] = [];

    if (point.totalCost > expectedCost) {
      // High cost anomaly
      const dominantProvider = point.byProvider.reduce(
        (max, p) => p.cost > max.cost ? p : max,
        point.byProvider[0]
      );

      causes.push(`${dominantProvider.provider} 使用量異常增加`);

      if (point.totalCalls > point.totalTokens / 1000) {
        causes.push('大量小型 API 調用');
      } else {
        causes.push('少量大型 API 調用（高 Token 用量）');
      }
    } else {
      // Low cost anomaly (unusual but possible)
      causes.push('處理量異常減少');
      causes.push('可能為假日或系統維護期間');
    }

    return causes;
  }

  private buildCacheKey(
    type: string,
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): string {
    const cityPart = cityFilter.isGlobalAdmin
      ? 'global'
      : cityFilter.cityCodes.sort().join(',');
    return `ai-cost:${type}:${cityPart}:${startDate.toISOString().split('T')[0]}:${endDate.toISOString().split('T')[0]}`;
  }

  private async invalidateCaches(cityCode: string): Promise<void> {
    const pattern = `ai-cost:*:*${cityCode}*:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    // Also invalidate global cache
    const globalPattern = 'ai-cost:*:global:*';
    const globalKeys = await redis.keys(globalPattern);
    if (globalKeys.length > 0) {
      await redis.del(...globalKeys);
    }
  }
}

export const aiCostService = new AiCostService();
```

---

## API Routes

### Cost Summary Endpoint

```typescript
// src/app/api/dashboard/ai-cost/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { aiCostService } from '@/services/ai-cost.service';
import { parseISO, subMonths, isValid } from 'date-fns';

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url);

      // Parse date parameters with defaults
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');

      const endDate = endDateParam && isValid(parseISO(endDateParam))
        ? parseISO(endDateParam)
        : new Date();

      const startDate = startDateParam && isValid(parseISO(startDateParam))
        ? parseISO(startDateParam)
        : subMonths(endDate, 1);

      const summary = await aiCostService.getCostSummary(
        cityFilter,
        startDate,
        endDate
      );

      return NextResponse.json({
        success: true,
        data: summary,
        meta: {
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('AI cost summary error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch AI cost summary' },
        { status: 500 }
      );
    }
  });
}
```

### Cost Trend Endpoint

```typescript
// src/app/api/dashboard/ai-cost/trend/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { aiCostService } from '@/services/ai-cost.service';
import { parseISO, subMonths, isValid } from 'date-fns';

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url);

      // Parse parameters
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');
      const granularity = (searchParams.get('granularity') || 'day') as 'day' | 'week' | 'month';

      const endDate = endDateParam && isValid(parseISO(endDateParam))
        ? parseISO(endDateParam)
        : new Date();

      const startDate = startDateParam && isValid(parseISO(startDateParam))
        ? parseISO(startDateParam)
        : subMonths(endDate, 1);

      const trendData = await aiCostService.getCostTrend(
        cityFilter,
        startDate,
        endDate,
        granularity
      );

      return NextResponse.json({
        success: true,
        data: trendData,
        meta: {
          granularity,
          totalDataPoints: trendData.length
        }
      });
    } catch (error) {
      console.error('AI cost trend error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch AI cost trend' },
        { status: 500 }
      );
    }
  });
}
```

### Daily Detail Endpoint

```typescript
// src/app/api/dashboard/ai-cost/daily/[date]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { aiCostService } from '@/services/ai-cost.service';
import { parseISO, isValid } from 'date-fns';

interface RouteParams {
  params: { date: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const date = parseISO(params.date);

      if (!isValid(date)) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }

      const detail = await aiCostService.getDailyDetail(cityFilter, date);

      return NextResponse.json({
        success: true,
        data: detail
      });
    } catch (error) {
      console.error('Daily AI cost detail error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch daily AI cost detail' },
        { status: 500 }
      );
    }
  });
}
```

### Anomaly Detection Endpoint

```typescript
// src/app/api/dashboard/ai-cost/anomalies/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { aiCostService } from '@/services/ai-cost.service';
import { parseISO, subMonths, isValid } from 'date-fns';

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url);

      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');

      const endDate = endDateParam && isValid(parseISO(endDateParam))
        ? parseISO(endDateParam)
        : new Date();

      const startDate = startDateParam && isValid(parseISO(startDateParam))
        ? parseISO(startDateParam)
        : subMonths(endDate, 1);

      const anomalies = await aiCostService.detectAnomalies(
        cityFilter,
        startDate,
        endDate
      );

      return NextResponse.json({
        success: true,
        data: {
          anomalies,
          threshold: 2.0 // Standard deviations
        }
      });
    } catch (error) {
      console.error('Anomaly detection error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to detect anomalies' },
        { status: 500 }
      );
    }
  });
}
```

---

## Frontend Components

### AI Cost Card Component

```typescript
// src/components/dashboard/AiCostCard.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Cpu,
  Zap,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardFilter } from '@/contexts/DashboardFilterContext';
import { AiCostSummary, ApiProvider } from '@/types/ai-cost';

const PROVIDER_LABELS: Record<ApiProvider, string> = {
  AZURE_DOC_INTELLIGENCE: 'Doc Intelligence',
  OPENAI: 'OpenAI',
  AZURE_OPENAI: 'Azure OpenAI'
};

const PROVIDER_COLORS: Record<ApiProvider, string> = {
  AZURE_DOC_INTELLIGENCE: 'bg-blue-500',
  OPENAI: 'bg-emerald-500',
  AZURE_OPENAI: 'bg-purple-500'
};

export function AiCostCard() {
  const { filterParams } = useDashboardFilter();

  const { data, isLoading, error } = useQuery<AiCostSummary>({
    queryKey: ['ai-cost-summary', filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate
      });
      const response = await fetch(`/api/dashboard/ai-cost?${params}`);
      if (!response.ok) throw new Error('Failed to fetch AI cost');
      const result = await response.json();
      return result.data;
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  if (isLoading) {
    return <AiCostCardSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            AI 成本
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">載入失敗，請稍後再試</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          AI 成本
        </CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {/* Main Cost Display */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {formatCurrency(data?.totalCost || 0)}
          </span>
          {data?.trend.costChange !== undefined && (
            <TrendIndicator value={data.trend.costChange} inverse />
          )}
        </div>

        {/* API Metrics */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" />
            <span>{formatNumber(data?.totalCalls || 0)} 次調用</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            <span>{formatNumber(data?.totalTokens.total || 0)} tokens</span>
          </div>
        </div>

        {/* Provider Breakdown */}
        <div className="mt-4 space-y-2">
          {data?.byProvider.map((provider) => (
            <ProviderRow key={provider.provider} provider={provider} />
          ))}
        </div>

        {/* Detail Link */}
        <Button variant="ghost" size="sm" className="mt-4 w-full" asChild>
          <Link href="/dashboard/ai-cost">
            查看詳情
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ProviderRow({ provider }: { provider: AiCostSummary['byProvider'][0] }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full', PROVIDER_COLORS[provider.provider])} />
        <span className="text-muted-foreground">
          {PROVIDER_LABELS[provider.provider]}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium">{formatCurrency(provider.cost)}</span>
        <Badge variant="secondary" className="text-xs">
          {provider.percentage.toFixed(0)}%
        </Badge>
      </div>
    </div>
  );
}

function TrendIndicator({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const isPositive = inverse ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.1;

  const Icon = isNeutral ? Minus : value > 0 ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-medium',
        isNeutral
          ? 'text-muted-foreground'
          : isPositive
            ? 'text-emerald-600'
            : 'text-red-600'
      )}
    >
      <Icon className="h-3 w-3 mr-0.5" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function AiCostCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-16" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-8 w-24" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

// Utility functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-TW').format(value);
}
```

### AI Cost Detail Page

```typescript
// src/app/(dashboard)/dashboard/ai-cost/page.tsx

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Cpu,
  Zap,
  FileText,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { useDashboardFilter } from '@/contexts/DashboardFilterContext';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import {
  AiCostSummary,
  AiCostTrendPoint,
  DailyAiCostDetail,
  CostAnomaly,
  ApiProvider
} from '@/types/ai-cost';
import { cn } from '@/lib/utils';

const PROVIDER_COLORS: Record<ApiProvider, string> = {
  AZURE_DOC_INTELLIGENCE: '#0078d4',
  OPENAI: '#10a37f',
  AZURE_OPENAI: '#5c2d91'
};

const PROVIDER_LABELS: Record<ApiProvider, string> = {
  AZURE_DOC_INTELLIGENCE: 'Doc Intelligence',
  OPENAI: 'OpenAI',
  AZURE_OPENAI: 'Azure OpenAI'
};

export default function AiCostPage() {
  const { filterParams } = useDashboardFilter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

  // Fetch summary data
  const { data: summary, isLoading: summaryLoading } = useQuery<AiCostSummary>({
    queryKey: ['ai-cost-summary', filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate
      });
      const response = await fetch(`/api/dashboard/ai-cost?${params}`);
      if (!response.ok) throw new Error('Failed to fetch summary');
      return (await response.json()).data;
    }
  });

  // Fetch trend data
  const { data: trendData, isLoading: trendLoading } = useQuery<AiCostTrendPoint[]>({
    queryKey: ['ai-cost-trend', filterParams, granularity],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate,
        granularity
      });
      const response = await fetch(`/api/dashboard/ai-cost/trend?${params}`);
      if (!response.ok) throw new Error('Failed to fetch trend');
      return (await response.json()).data;
    }
  });

  // Fetch anomalies
  const { data: anomalyData } = useQuery<{ anomalies: CostAnomaly[] }>({
    queryKey: ['ai-cost-anomalies', filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate
      });
      const response = await fetch(`/api/dashboard/ai-cost/anomalies?${params}`);
      if (!response.ok) throw new Error('Failed to fetch anomalies');
      return (await response.json()).data;
    }
  });

  // Fetch daily detail
  const { data: dailyDetail, isLoading: dailyLoading } = useQuery<DailyAiCostDetail>({
    queryKey: ['ai-cost-daily', selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/ai-cost/daily/${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch daily detail');
      return (await response.json()).data;
    },
    enabled: !!selectedDate
  });

  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.date) {
      setSelectedDate(data.activePayload[0].payload.date);
    }
  };

  const hasAnomalies = anomalyData?.anomalies && anomalyData.anomalies.length > 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI 成本分析</h1>
          <p className="text-muted-foreground">監控 AI API 使用量與成本趨勢</p>
        </div>
      </div>

      {/* Filters */}
      <DashboardFilters />

      {/* Anomaly Alert */}
      {hasAnomalies && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>檢測到成本異常</AlertTitle>
          <AlertDescription>
            在選定期間內發現 {anomalyData!.anomalies.length} 個異常數據點。
            {anomalyData!.anomalies
              .filter(a => a.severity === 'high')
              .map(a => (
                <Badge key={a.date} variant="destructive" className="ml-2">
                  {a.date}: +{a.deviation.toFixed(0)}%
                </Badge>
              ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="總成本"
          value={summary?.totalCost || 0}
          format="currency"
          trend={summary?.trend.costChange}
          icon={DollarSign}
          loading={summaryLoading}
        />
        <SummaryCard
          title="API 調用次數"
          value={summary?.totalCalls || 0}
          format="number"
          trend={summary?.trend.callsChange}
          icon={Cpu}
          loading={summaryLoading}
        />
        <SummaryCard
          title="輸入 Tokens"
          value={summary?.totalTokens.input || 0}
          format="number"
          icon={Zap}
          loading={summaryLoading}
        />
        <SummaryCard
          title="輸出 Tokens"
          value={summary?.totalTokens.output || 0}
          format="number"
          icon={Zap}
          loading={summaryLoading}
        />
      </div>

      {/* Main Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cost Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>成本趨勢</CardTitle>
              <CardDescription>點擊數據點查看當日明細</CardDescription>
            </div>
            <Select value={granularity} onValueChange={(v) => setGranularity(v as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">按日</SelectItem>
                <SelectItem value="week">按週</SelectItem>
                <SelectItem value="month">按月</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={trendData || []}
                  onClick={handleChartClick}
                >
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => formatDateLabel(v, granularity)}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    className="text-xs"
                  />
                  <Tooltip content={<CostTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="totalCost"
                    name="總成本"
                    stroke="#3b82f6"
                    fill="url(#colorCost)"
                    strokeWidth={2}
                    dot={{
                      cursor: 'pointer',
                      fill: '#3b82f6',
                      r: 4
                    }}
                    activeDot={{
                      r: 6,
                      fill: '#3b82f6'
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Provider Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>API 類型分佈</CardTitle>
            <CardDescription>各 AI 服務成本占比</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prepareProviderData(trendData || [])}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis tickFormatter={(v) => `$${v}`} className="text-xs" />
                  <Tooltip />
                  <Legend />
                  {Object.entries(PROVIDER_COLORS).map(([provider, color]) => (
                    <Bar
                      key={provider}
                      dataKey={provider}
                      name={PROVIDER_LABELS[provider as ApiProvider]}
                      stackId="a"
                      fill={color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* API Calls Trend */}
        <Card>
          <CardHeader>
            <CardTitle>API 調用次數</CardTitle>
            <CardDescription>各服務 API 調用量趨勢</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalCalls"
                    name="總調用次數"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {summary?.byProvider.map((provider) => (
          <Card key={provider.provider}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {PROVIDER_LABELS[provider.provider]}
                </CardTitle>
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: PROVIDER_COLORS[provider.provider] }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${provider.cost.toFixed(2)}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>{provider.calls.toLocaleString()} 次調用</span>
                <Badge variant="secondary">{provider.percentage.toFixed(0)}%</Badge>
              </div>
              {provider.tokens && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Tokens: {provider.tokens.input.toLocaleString()} in / {provider.tokens.output.toLocaleString()} out
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Detail Dialog */}
      <DailyDetailDialog
        open={!!selectedDate}
        onOpenChange={() => setSelectedDate(null)}
        date={selectedDate}
        data={dailyDetail}
        loading={dailyLoading}
      />
    </div>
  );
}

// ==================== Sub Components ====================

interface SummaryCardProps {
  title: string;
  value: number;
  format: 'currency' | 'number';
  trend?: number;
  icon: React.ElementType;
  loading?: boolean;
}

function SummaryCard({ title, value, format, trend, icon: Icon, loading }: SummaryCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  const formattedValue = format === 'currency'
    ? `$${value.toFixed(2)}`
    : value.toLocaleString();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formattedValue}</span>
          {trend !== undefined && (
            <span
              className={cn(
                'flex items-center text-xs font-medium',
                trend > 0 ? 'text-red-600' : trend < 0 ? 'text-emerald-600' : 'text-muted-foreground'
              )}
            >
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3 mr-0.5" />
              ) : trend < 0 ? (
                <TrendingDown className="h-3 w-3 mr-0.5" />
              ) : null}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DailyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  data?: DailyAiCostDetail;
  loading?: boolean;
}

function DailyDetailDialog({ open, onOpenChange, date, data, loading }: DailyDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {date && format(new Date(date), 'yyyy年MM月dd日', { locale: zhTW })} 成本明細
          </DialogTitle>
          <DialogDescription>
            當日所有 AI API 調用記錄與成本分析
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">總成本</div>
                <div className="text-lg font-bold">${data.totalCost.toFixed(4)}</div>
              </div>
              <div className="px-4 py-2 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">API 調用</div>
                <div className="text-lg font-bold">{data.totalCalls} 次</div>
              </div>
              <div className="px-4 py-2 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">文件數</div>
                <div className="text-lg font-bold">{data.documents.length} 份</div>
              </div>
            </div>

            {/* Provider Breakdown */}
            <div className="flex gap-2 flex-wrap">
              {data.byProvider.map((p) => (
                <Badge
                  key={p.provider}
                  variant="outline"
                  className="gap-1"
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PROVIDER_COLORS[p.provider] }}
                  />
                  {PROVIDER_LABELS[p.provider]}: ${p.cost.toFixed(4)} ({p.calls}次)
                </Badge>
              ))}
            </div>

            {/* Document List */}
            <div className="space-y-3">
              <h4 className="font-medium">文件處理明細</h4>
              {data.documents.map((doc) => (
                <div key={doc.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {doc.invoiceNumber}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {doc.forwarderCode} | {format(new Date(doc.processedAt), 'HH:mm:ss')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${doc.totalCost.toFixed(4)}</div>
                      <div className="text-xs text-muted-foreground">
                        {doc.apiCalls.length} 次 API 調用
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 flex-wrap">
                    {doc.apiCalls.map((call, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {call.operation}: ${call.cost.toFixed(4)}
                        {call.tokensInput > 0 && ` (${call.tokensInput}/${call.tokensOutput} tokens)`}
                      </Badge>
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    asChild
                  >
                    <Link href={`/documents/${doc.id}`}>
                      查看文件詳情
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">無數據</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CostTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-medium">${entry.value.toFixed(2)}</span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-2">
        點擊查看當日明細
      </p>
    </div>
  );
}

// ==================== Utility Functions ====================

function formatDateLabel(date: string, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'week') {
    return `W${date.split('-')[1]}`;
  }
  if (granularity === 'month') {
    return format(new Date(date + '-01'), 'MMM', { locale: zhTW });
  }
  return format(new Date(date), 'MM/dd');
}

function prepareProviderData(trendData: AiCostTrendPoint[]): any[] {
  return trendData.map((point) => {
    const result: any = { date: point.date };
    for (const provider of point.byProvider) {
      result[provider.provider] = provider.cost;
    }
    return result;
  });
}
```

### Custom Hooks

```typescript
// src/hooks/useAiCost.ts

import { useQuery } from '@tanstack/react-query';
import { useDashboardFilter } from '@/contexts/DashboardFilterContext';
import {
  AiCostSummary,
  AiCostTrendPoint,
  DailyAiCostDetail,
  CostAnomaly
} from '@/types/ai-cost';

export function useAiCostSummary() {
  const { filterParams } = useDashboardFilter();

  return useQuery<AiCostSummary>({
    queryKey: ['ai-cost-summary', filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate
      });
      const response = await fetch(`/api/dashboard/ai-cost?${params}`);
      if (!response.ok) throw new Error('Failed to fetch AI cost summary');
      return (await response.json()).data;
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
}

export function useAiCostTrend(granularity: 'day' | 'week' | 'month' = 'day') {
  const { filterParams } = useDashboardFilter();

  return useQuery<AiCostTrendPoint[]>({
    queryKey: ['ai-cost-trend', filterParams, granularity],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate,
        granularity
      });
      const response = await fetch(`/api/dashboard/ai-cost/trend?${params}`);
      if (!response.ok) throw new Error('Failed to fetch AI cost trend');
      return (await response.json()).data;
    },
    staleTime: 1000 * 60 * 5
  });
}

export function useAiCostDaily(date: string | null) {
  return useQuery<DailyAiCostDetail>({
    queryKey: ['ai-cost-daily', date],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/ai-cost/daily/${date}`);
      if (!response.ok) throw new Error('Failed to fetch daily detail');
      return (await response.json()).data;
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 10 // 10 minutes
  });
}

export function useAiCostAnomalies() {
  const { filterParams } = useDashboardFilter();

  return useQuery<{ anomalies: CostAnomaly[]; threshold: number }>({
    queryKey: ['ai-cost-anomalies', filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate
      });
      const response = await fetch(`/api/dashboard/ai-cost/anomalies?${params}`);
      if (!response.ok) throw new Error('Failed to fetch anomalies');
      return (await response.json()).data;
    },
    staleTime: 1000 * 60 * 15 // 15 minutes
  });
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/services/__tests__/ai-cost.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiCostService } from '../ai-cost.service';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { CityFilter } from '@/middleware/city-filter';

vi.mock('@/lib/prisma');
vi.mock('@/lib/redis');

describe('AiCostService', () => {
  let service: AiCostService;
  const mockCityFilter: CityFilter = {
    isGlobalAdmin: false,
    cityCodes: ['TPE']
  };

  beforeEach(() => {
    service = new AiCostService();
    vi.clearAllMocks();
  });

  describe('getCostSummary', () => {
    it('should return cached data if available', async () => {
      const cachedData = {
        totalCost: 100,
        totalCalls: 1000,
        totalTokens: { input: 50000, output: 25000, total: 75000 }
      };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getCostSummary(
        mockCityFilter,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(result.totalCost).toBe(100);
      expect(prisma.apiUsageLog.groupBy).not.toHaveBeenCalled();
    });

    it('should calculate period comparison correctly', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.apiUsageLog.groupBy)
        .mockResolvedValueOnce([
          {
            provider: 'OPENAI',
            _count: { id: 100 },
            _sum: { tokensInput: 50000, tokensOutput: 25000, estimatedCost: 1.5 }
          }
        ])
        .mockResolvedValueOnce([
          {
            provider: 'OPENAI',
            _count: { id: 80 },
            _sum: { tokensInput: 40000, tokensOutput: 20000, estimatedCost: 1.2 }
          }
        ]);

      const result = await service.getCostSummary(
        mockCityFilter,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(result.trend.costChange).toBeCloseTo(25, 0); // (1.5-1.2)/1.2 * 100 = 25%
      expect(result.trend.callsChange).toBeCloseTo(25, 0);
    });

    it('should handle global admin filter', async () => {
      const globalFilter: CityFilter = {
        isGlobalAdmin: true,
        cityCodes: []
      };
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.apiUsageLog.groupBy).mockResolvedValue([]);

      await service.getCostSummary(
        globalFilter,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(prisma.apiUsageLog.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ cityCode: expect.anything() })
        })
      );
    });
  });

  describe('calculateCost', () => {
    it('should calculate Document Intelligence cost per call', () => {
      const cost = (service as any).calculateCost('AZURE_DOC_INTELLIGENCE', null, null);
      expect(cost).toBe(0.001);
    });

    it('should calculate OpenAI cost based on tokens', () => {
      const cost = (service as any).calculateCost('OPENAI', 1000, 500);
      expect(cost).toBeCloseTo(0.01 + 0.015, 4); // $0.01/1K input + $0.03/1K output
    });
  });

  describe('detectAnomalies', () => {
    it('should detect high cost anomalies', async () => {
      const mockTrendData = Array.from({ length: 10 }, (_, i) => ({
        date: `2025-01-${(i + 1).toString().padStart(2, '0')}`,
        totalCost: i === 7 ? 500 : 100, // Day 8 is anomaly
        totalCalls: 100,
        totalTokens: 50000,
        byProvider: []
      }));

      vi.spyOn(service, 'getCostTrend').mockResolvedValue(mockTrendData);

      const anomalies = await service.detectAnomalies(
        mockCityFilter,
        new Date('2025-01-01'),
        new Date('2025-01-10')
      );

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].date).toBe('2025-01-08');
      expect(anomalies[0].severity).toBe('high');
    });

    it('should return empty array for insufficient data', async () => {
      vi.spyOn(service, 'getCostTrend').mockResolvedValue([
        { date: '2025-01-01', totalCost: 100, totalCalls: 100, totalTokens: 50000, byProvider: [] }
      ]);

      const anomalies = await service.detectAnomalies(
        mockCityFilter,
        new Date('2025-01-01'),
        new Date('2025-01-01')
      );

      expect(anomalies).toHaveLength(0);
    });
  });
});
```

### Integration Tests

```typescript
// src/app/api/dashboard/ai-cost/__tests__/route.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

describe('AI Cost API', () => {
  beforeEach(async () => {
    await prisma.apiUsageLog.deleteMany();
  });

  describe('GET /api/dashboard/ai-cost', () => {
    it('should return cost summary for date range', async () => {
      // Seed test data
      await prisma.apiUsageLog.createMany({
        data: [
          {
            cityCode: 'TPE',
            provider: 'OPENAI',
            operation: 'extraction',
            tokensInput: 1000,
            tokensOutput: 500,
            estimatedCost: 0.025,
            createdAt: new Date('2025-01-15')
          },
          {
            cityCode: 'TPE',
            provider: 'AZURE_DOC_INTELLIGENCE',
            operation: 'ocr',
            estimatedCost: 0.001,
            createdAt: new Date('2025-01-15')
          }
        ]
      });

      const request = new NextRequest(
        'http://localhost/api/dashboard/ai-cost?startDate=2025-01-01&endDate=2025-01-31'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.totalCost).toBeCloseTo(0.026, 3);
      expect(data.data.totalCalls).toBe(2);
      expect(data.data.byProvider).toHaveLength(2);
    });

    it('should respect city filter', async () => {
      await prisma.apiUsageLog.createMany({
        data: [
          { cityCode: 'TPE', provider: 'OPENAI', operation: 'test', estimatedCost: 1 },
          { cityCode: 'KHH', provider: 'OPENAI', operation: 'test', estimatedCost: 2 }
        ]
      });

      // Mock city filter for TPE only
      const request = new NextRequest(
        'http://localhost/api/dashboard/ai-cost',
        { headers: { 'x-city-codes': 'TPE' } }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.totalCost).toBe(1);
    });
  });
});
```

### Component Tests

```typescript
// src/components/dashboard/__tests__/AiCostCard.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiCostCard } from '../AiCostCard';

const mockSummary = {
  totalCost: 125.50,
  totalCalls: 5000,
  totalTokens: { input: 100000, output: 50000, total: 150000 },
  byProvider: [
    { provider: 'OPENAI', calls: 3000, tokens: { input: 80000, output: 40000 }, cost: 100, percentage: 80 },
    { provider: 'AZURE_DOC_INTELLIGENCE', calls: 2000, tokens: { input: 0, output: 0 }, cost: 25.50, percentage: 20 }
  ],
  trend: { costChange: 15.5, callsChange: 10, tokensChange: 12 }
};

describe('AiCostCard', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockSummary })
    });
  });

  it('should display loading skeleton initially', () => {
    render(<AiCostCard />, { wrapper });
    expect(screen.getByTestId('ai-cost-skeleton')).toBeInTheDocument();
  });

  it('should display cost data after loading', async () => {
    render(<AiCostCard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('$125.50')).toBeInTheDocument();
    });

    expect(screen.getByText('5,000 次調用')).toBeInTheDocument();
    expect(screen.getByText('150,000 tokens')).toBeInTheDocument();
  });

  it('should display provider breakdown', async () => {
    render(<AiCostCard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Doc Intelligence')).toBeInTheDocument();
    });

    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('should show trend indicator', async () => {
    render(<AiCostCard />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('15.5%')).toBeInTheDocument();
    });
  });
});
```

---

## Performance Considerations

### Caching Strategy

| Data Type | Cache TTL | Invalidation Trigger |
|-----------|-----------|---------------------|
| Cost Summary | 5 minutes | New API log entry |
| Cost Trend | 10 minutes | New API log entry |
| Daily Detail | 30 minutes | Manual refresh |
| Anomaly Detection | 15 minutes | Cost summary update |

### Database Optimization

1. **Indexes**: Composite indexes on `(city_code, created_at)` and `(provider, created_at)` for efficient filtering
2. **Aggregation**: Use database-level aggregation (`groupBy`, raw SQL) instead of application-level processing
3. **Pagination**: For daily detail, consider pagination if document count exceeds 100

### Query Optimization

```typescript
// Efficient aggregation query
const stats = await prisma.$queryRaw`
  SELECT
    provider,
    COUNT(*) as calls,
    SUM(estimated_cost) as cost,
    SUM(tokens_input) as tokens_input,
    SUM(tokens_output) as tokens_output
  FROM api_usage_logs
  WHERE city_code = ${cityCode}
    AND created_at BETWEEN ${startDate} AND ${endDate}
  GROUP BY provider
`;
```

### Frontend Optimization

1. **Stale-While-Revalidate**: Use TanStack Query's `staleTime` for smooth UX
2. **Chart Data Sampling**: For periods > 90 days, downsample to weekly aggregation
3. **Lazy Loading**: Load daily detail dialog only when clicked
4. **Memoization**: Memoize expensive chart data transformations

---

## Security Considerations

### Access Control

1. **City-based Isolation**: Users can only view costs for their authorized cities
2. **Role Validation**: Global admin check for cross-city aggregation
3. **API Rate Limiting**: Prevent excessive queries

### Data Protection

1. **No PII in Logs**: API usage logs should not contain sensitive document content
2. **Cost Obfuscation**: Consider masking exact costs for non-admin users
3. **Audit Trail**: Log access to cost reports

### Input Validation

```typescript
// Validate date range
const MAX_DATE_RANGE_DAYS = 365;
const daysDiff = differenceInDays(endDate, startDate);

if (daysDiff > MAX_DATE_RANGE_DAYS) {
  return NextResponse.json(
    { success: false, error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days` },
    { status: 400 }
  );
}
```

---

## Acceptance Criteria Verification

### AC1: AI 成本區塊顯示
- [x] `AiCostCard` 組件顯示 API 調用次數（按提供者分類）
- [x] 顯示 Token 使用量（輸入/輸出）
- [x] 顯示估算成本（美元）
- [x] 顯示與上期對比（增減百分比）

### AC2: 成本明細頁面
- [x] `/dashboard/ai-cost` 頁面實現
- [x] 包含按日期的成本趨勢圖（可切換日/週/月）
- [x] 支援時間範圍篩選

### AC3: 異常調查功能
- [x] 圖表點擊事件實現
- [x] `DailyDetailDialog` 顯示當日處理明細
- [x] 連結到文件詳情頁面
- [x] 異常檢測功能實現

### AC4: API 類型分類
- [x] 分別顯示 Azure Document Intelligence 使用量與成本
- [x] 分別顯示 OpenAI API Token 使用量與成本
- [x] 支援 Azure OpenAI Service（其他 AI 服務）
- [x] 每個提供者顯示獨立卡片和百分比占比

---

## File Structure

```
src/
├── types/
│   └── ai-cost.ts                          # Type definitions
├── services/
│   └── ai-cost.service.ts                  # Business logic
├── app/
│   └── api/
│       └── dashboard/
│           └── ai-cost/
│               ├── route.ts                # Cost summary API
│               ├── trend/
│               │   └── route.ts            # Trend data API
│               ├── daily/
│               │   └── [date]/
│               │       └── route.ts        # Daily detail API
│               └── anomalies/
│                   └── route.ts            # Anomaly detection API
├── components/
│   └── dashboard/
│       └── AiCostCard.tsx                  # Dashboard card component
├── app/
│   └── (dashboard)/
│       └── dashboard/
│           └── ai-cost/
│               └── page.tsx                # Cost detail page
└── hooks/
    └── useAiCost.ts                        # Custom hooks
```

---

## References

- [Story 7.6 Definition](../stories/7-6-ai-api-usage-cost-display.md)
- [Epic 7: Reports Dashboard & Cost Tracking](../../03-epics/sections/epic-7-reports-dashboard-cost-tracking.md)
- [FR35: AI Cost Monitoring](../../01-planning/prd/sections/functional-requirements.md)
- [Tech Spec Story 7-1: Processing Statistics Dashboard](./tech-spec-story-7-1.md)
- [Tech Spec Story 7-2: Time Range Filter](./tech-spec-story-7-2.md)
