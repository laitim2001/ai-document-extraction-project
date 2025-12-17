# Tech Spec: Story 7-8 - 城市 AI 成本追蹤

## Overview

### Story Reference
- **Story ID**: 7.8
- **Story Key**: 7-8-city-ai-cost-tracking
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: ready-for-dev

### User Story
**As a** 系統,
**I want** 按城市追蹤 AI API 調用成本,
**So that** 可以準確分攤成本到各城市。

### Dependencies
- **Story 6.1**: 城市數據模型（cityCode 來源）
- **Story 2.2**: 文件 OCR 提取服務（AI 調用觸發）
- **Story 2.4**: 欄位映射提取（AI 調用觸發）
- **Story 7.6**: AI API 使用量與成本顯示（數據消費）

### FR Coverage
- **FR70**: 城市 AI 成本追蹤

---

## Database Schema

### Prisma Models

```prisma
// prisma/schema.prisma

// API 使用日誌模型（與 Story 7-6 共用）
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
  metadata      Json?       // Additional metadata (model version, request ID, etc.)
  createdAt     DateTime    @default(now()) @map("created_at")

  document      Document?   @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([documentId])
  @@index([cityCode])
  @@index([provider])
  @@index([createdAt])
  @@index([cityCode, createdAt])
  @@index([cityCode, provider, createdAt])
  @@map("api_usage_logs")
}

// API 單價配置模型
model ApiPricing {
  id                  String      @id @default(uuid())
  provider            ApiProvider
  operation           String?     // null = default pricing for provider
  modelVersion        String?     @map("model_version")  // e.g., 'gpt-4-turbo', 'gpt-3.5-turbo'

  // 定價方式
  pricePerCall        Float?      @map("price_per_call")        // Per API call (Document Intelligence)
  pricePerInputToken  Float?      @map("price_per_input_token") // Per input token
  pricePerOutputToken Float?      @map("price_per_output_token") // Per output token
  pricePerPage        Float?      @map("price_per_page")        // Per page (Document Intelligence)

  currency            String      @default("USD")
  effectiveFrom       DateTime    @map("effective_from")
  effectiveTo         DateTime?   @map("effective_to")
  isActive            Boolean     @default(true) @map("is_active")

  // 審計欄位
  createdBy           String      @map("created_by")
  updatedBy           String?     @map("updated_by")
  createdAt           DateTime    @default(now()) @map("created_at")
  updatedAt           DateTime    @updatedAt @map("updated_at")

  @@index([provider, operation, isActive])
  @@index([provider, modelVersion, isActive])
  @@index([effectiveFrom, effectiveTo])
  @@map("api_pricing")
}

// 單價變更歷史
model ApiPricingHistory {
  id              String      @id @default(uuid())
  pricingId       String      @map("pricing_id")
  provider        ApiProvider
  operation       String?
  changeType      String      @map("change_type")  // 'CREATE', 'UPDATE', 'DEACTIVATE'

  // 變更前後值
  previousValues  Json?       @map("previous_values")
  newValues       Json        @map("new_values")

  // 審計
  changedBy       String      @map("changed_by")
  changedAt       DateTime    @default(now()) @map("changed_at")
  reason          String?

  @@index([pricingId])
  @@index([provider])
  @@index([changedAt])
  @@map("api_pricing_history")
}

enum ApiProvider {
  AZURE_DOC_INTELLIGENCE
  OPENAI
  AZURE_OPENAI
}
```

### Migration Script

```sql
-- Migration: create_api_cost_tracking_tables
-- Created: 2025-12-16

-- Create api_pricing table
CREATE TABLE "api_pricing" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "provider" "ApiProvider" NOT NULL,
    "operation" VARCHAR(50),
    "model_version" VARCHAR(50),

    "price_per_call" DOUBLE PRECISION,
    "price_per_input_token" DOUBLE PRECISION,
    "price_per_output_token" DOUBLE PRECISION,
    "price_per_page" DOUBLE PRECISION,

    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    "created_by" VARCHAR(100) NOT NULL,
    "updated_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_pricing_valid_pricing_check"
        CHECK (
            "price_per_call" IS NOT NULL OR
            "price_per_input_token" IS NOT NULL OR
            "price_per_output_token" IS NOT NULL OR
            "price_per_page" IS NOT NULL
        )
);

-- Create indexes for api_pricing
CREATE INDEX "api_pricing_provider_operation_active_idx"
    ON "api_pricing"("provider", "operation", "is_active");
CREATE INDEX "api_pricing_provider_model_active_idx"
    ON "api_pricing"("provider", "model_version", "is_active");
CREATE INDEX "api_pricing_effective_idx"
    ON "api_pricing"("effective_from", "effective_to");

-- Create api_pricing_history table
CREATE TABLE "api_pricing_history" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "pricing_id" UUID NOT NULL,
    "provider" "ApiProvider" NOT NULL,
    "operation" VARCHAR(50),
    "change_type" VARCHAR(20) NOT NULL,

    "previous_values" JSONB,
    "new_values" JSONB NOT NULL,

    "changed_by" VARCHAR(100) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "api_pricing_history_change_type_check"
        CHECK ("change_type" IN ('CREATE', 'UPDATE', 'DEACTIVATE'))
);

-- Create indexes for api_pricing_history
CREATE INDEX "api_pricing_history_pricing_id_idx" ON "api_pricing_history"("pricing_id");
CREATE INDEX "api_pricing_history_provider_idx" ON "api_pricing_history"("provider");
CREATE INDEX "api_pricing_history_changed_at_idx" ON "api_pricing_history"("changed_at");

-- Insert default pricing (as of December 2025)
INSERT INTO "api_pricing" (
    "provider", "operation", "model_version",
    "price_per_call", "price_per_page",
    "price_per_input_token", "price_per_output_token",
    "effective_from", "created_by"
) VALUES
    -- Azure Document Intelligence
    ('AZURE_DOC_INTELLIGENCE', 'invoice-analysis', 'v3.1', NULL, 0.001, NULL, NULL, '2025-01-01', 'SYSTEM'),
    ('AZURE_DOC_INTELLIGENCE', 'ocr', 'v3.1', NULL, 0.0015, NULL, NULL, '2025-01-01', 'SYSTEM'),
    ('AZURE_DOC_INTELLIGENCE', 'layout', 'v3.1', NULL, 0.01, NULL, NULL, '2025-01-01', 'SYSTEM'),

    -- OpenAI GPT-4 Turbo
    ('OPENAI', 'field-extraction', 'gpt-4-turbo', NULL, NULL, 0.00001, 0.00003, '2025-01-01', 'SYSTEM'),
    ('OPENAI', 'validation', 'gpt-4-turbo', NULL, NULL, 0.00001, 0.00003, '2025-01-01', 'SYSTEM'),
    ('OPENAI', 'classification', 'gpt-4-turbo', NULL, NULL, 0.00001, 0.00003, '2025-01-01', 'SYSTEM'),

    -- OpenAI GPT-3.5 Turbo (cheaper option)
    ('OPENAI', 'field-extraction', 'gpt-3.5-turbo', NULL, NULL, 0.0000005, 0.0000015, '2025-01-01', 'SYSTEM'),

    -- Azure OpenAI
    ('AZURE_OPENAI', NULL, 'gpt-4-turbo', NULL, NULL, 0.00001, 0.00003, '2025-01-01', 'SYSTEM'),
    ('AZURE_OPENAI', NULL, 'gpt-35-turbo', NULL, NULL, 0.0000005, 0.0000015, '2025-01-01', 'SYSTEM');
```

---

## Type Definitions

### Core Types

```typescript
// src/types/api-cost.ts

import { ApiProvider } from '@prisma/client';

/**
 * API 調用記錄
 */
export interface ApiCallRecord {
  documentId?: string;
  cityCode: string;
  provider: ApiProvider;
  operation: string;
  modelVersion?: string;
  tokensInput?: number;
  tokensOutput?: number;
  pageCount?: number;
  responseTimeMs?: number;
  success: boolean;
  errorMessage?: string;
  metadata?: ApiCallMetadata;
}

/**
 * API 調用元數據
 */
export interface ApiCallMetadata {
  requestId?: string;
  modelId?: string;
  finishReason?: string;
  promptCacheHit?: boolean;
  [key: string]: unknown;
}

/**
 * 單價配置
 */
export interface PricingConfig {
  id: string;
  provider: ApiProvider;
  operation?: string;
  modelVersion?: string;
  pricePerCall?: number;
  pricePerInputToken?: number;
  pricePerOutputToken?: number;
  pricePerPage?: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

/**
 * 單價更新請求
 */
export interface PricingUpdateRequest {
  provider: ApiProvider;
  operation?: string;
  modelVersion?: string;
  pricePerCall?: number;
  pricePerInputToken?: number;
  pricePerOutputToken?: number;
  pricePerPage?: number;
  currency?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  reason?: string;
}

/**
 * 成本計算結果
 */
export interface CostCalculationResult {
  estimatedCost: number;
  currency: string;
  breakdown: {
    callCost: number;
    inputTokenCost: number;
    outputTokenCost: number;
    pageCost: number;
  };
  pricingId: string;
  pricingEffectiveFrom: Date;
}

/**
 * 城市成本摘要
 */
export interface CityCostSummary {
  cityCode: string;
  cityName: string;
  totalCost: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  avgCostPerCall: number;
  avgTokensPerCall: number;
  byProvider: ProviderCostBreakdown[];
  byOperation: OperationCostBreakdown[];
  period: {
    start: string;
    end: string;
  };
}

/**
 * 提供者成本明細
 */
export interface ProviderCostBreakdown {
  provider: ApiProvider;
  cost: number;
  calls: number;
  tokens: {
    input: number;
    output: number;
  };
  percentage: number;
}

/**
 * 操作成本明細
 */
export interface OperationCostBreakdown {
  operation: string;
  provider: ApiProvider;
  cost: number;
  calls: number;
  avgCost: number;
}

/**
 * 城市成本趨勢
 */
export interface CityCostTrend {
  cityCode: string;
  data: {
    period: string;
    cost: number;
    calls: number;
    tokens: number;
  }[];
}

/**
 * 成本對比數據
 */
export interface CostComparison {
  cities: {
    cityCode: string;
    cityName: string;
    currentCost: number;
    previousCost: number;
    change: number;
    changePercent: number;
  }[];
  period: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
}
```

### API Response Types

```typescript
// src/types/api/city-cost.ts

import {
  CityCostSummary,
  CityCostTrend,
  CostComparison,
  PricingConfig
} from '../api-cost';

/**
 * 城市成本摘要 API 回應
 */
export interface CityCostSummaryResponse {
  success: boolean;
  data: CityCostSummary[];
  meta: {
    totalCities: number;
    totalCost: number;
    period: { start: string; end: string };
  };
}

/**
 * 城市成本趨勢 API 回應
 */
export interface CityCostTrendResponse {
  success: boolean;
  data: CityCostTrend[];
  meta: {
    granularity: string;
    dataPoints: number;
  };
}

/**
 * 成本對比 API 回應
 */
export interface CostComparisonResponse {
  success: boolean;
  data: CostComparison;
}

/**
 * 單價列表 API 回應
 */
export interface PricingListResponse {
  success: boolean;
  data: PricingConfig[];
  meta: {
    total: number;
    activeCount: number;
  };
}

/**
 * 單價更新 API 回應
 */
export interface PricingUpdateResponse {
  success: boolean;
  data: PricingConfig;
  message: string;
}
```

---

## Service Implementation

### API Cost Calculator Service

```typescript
// src/services/api-cost-calculator.service.ts

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import {
  ApiCallRecord,
  PricingConfig,
  CostCalculationResult
} from '@/types/api-cost';
import { ApiProvider } from '@prisma/client';

interface CachedPricing {
  config: PricingConfig;
  cachedAt: number;
}

export class ApiCostCalculatorService {
  // In-memory cache for hot path optimization
  private pricingCache: Map<string, CachedPricing> = new Map();
  private readonly MEMORY_CACHE_TTL = 60 * 1000; // 1 minute
  private readonly REDIS_CACHE_TTL = 60 * 60; // 1 hour

  /**
   * 計算單次 API 調用成本
   */
  async calculateCost(record: ApiCallRecord): Promise<CostCalculationResult> {
    const pricing = await this.getActivePricing(
      record.provider,
      record.operation,
      record.modelVersion
    );

    if (!pricing) {
      console.warn(
        `No pricing found for ${record.provider}/${record.operation}/${record.modelVersion}`
      );
      return {
        estimatedCost: 0,
        currency: 'USD',
        breakdown: {
          callCost: 0,
          inputTokenCost: 0,
          outputTokenCost: 0,
          pageCost: 0
        },
        pricingId: 'NOT_FOUND',
        pricingEffectiveFrom: new Date()
      };
    }

    const breakdown = {
      callCost: 0,
      inputTokenCost: 0,
      outputTokenCost: 0,
      pageCost: 0
    };

    // Per-call pricing (mainly for Document Intelligence)
    if (pricing.pricePerCall) {
      breakdown.callCost = pricing.pricePerCall;
    }

    // Per-page pricing (Document Intelligence)
    if (pricing.pricePerPage && record.pageCount) {
      breakdown.pageCost = pricing.pricePerPage * record.pageCount;
    }

    // Per-token pricing (OpenAI/Azure OpenAI)
    if (pricing.pricePerInputToken && record.tokensInput) {
      breakdown.inputTokenCost = pricing.pricePerInputToken * record.tokensInput;
    }

    if (pricing.pricePerOutputToken && record.tokensOutput) {
      breakdown.outputTokenCost = pricing.pricePerOutputToken * record.tokensOutput;
    }

    const estimatedCost =
      breakdown.callCost +
      breakdown.inputTokenCost +
      breakdown.outputTokenCost +
      breakdown.pageCost;

    return {
      estimatedCost,
      currency: pricing.currency,
      breakdown,
      pricingId: pricing.id,
      pricingEffectiveFrom: pricing.effectiveFrom
    };
  }

  /**
   * 批量計算成本
   */
  async calculateBatchCost(
    records: ApiCallRecord[]
  ): Promise<Map<number, CostCalculationResult>> {
    const results = new Map<number, CostCalculationResult>();

    // Group by provider/operation/model for efficient pricing lookup
    const groups = this.groupRecords(records);

    for (const [key, indices] of groups) {
      const [provider, operation, modelVersion] = key.split('|');
      const pricing = await this.getActivePricing(
        provider as ApiProvider,
        operation || undefined,
        modelVersion || undefined
      );

      for (const index of indices) {
        const record = records[index];
        if (pricing) {
          results.set(index, await this.calculateCostWithPricing(record, pricing));
        } else {
          results.set(index, {
            estimatedCost: 0,
            currency: 'USD',
            breakdown: {
              callCost: 0,
              inputTokenCost: 0,
              outputTokenCost: 0,
              pageCost: 0
            },
            pricingId: 'NOT_FOUND',
            pricingEffectiveFrom: new Date()
          });
        }
      }
    }

    return results;
  }

  /**
   * 獲取當前有效的單價配置
   */
  async getActivePricing(
    provider: ApiProvider,
    operation?: string,
    modelVersion?: string
  ): Promise<PricingConfig | null> {
    const cacheKey = this.buildPricingCacheKey(provider, operation, modelVersion);

    // Check memory cache
    const memoryCached = this.pricingCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.cachedAt < this.MEMORY_CACHE_TTL) {
      return memoryCached.config;
    }

    // Check Redis cache
    const redisCached = await redis.get(cacheKey);
    if (redisCached) {
      const config = JSON.parse(redisCached);
      this.pricingCache.set(cacheKey, { config, cachedAt: Date.now() });
      return config;
    }

    // Query database with fallback logic
    const pricing = await this.findPricing(provider, operation, modelVersion);

    if (pricing) {
      const config: PricingConfig = {
        id: pricing.id,
        provider: pricing.provider,
        operation: pricing.operation || undefined,
        modelVersion: pricing.modelVersion || undefined,
        pricePerCall: pricing.pricePerCall || undefined,
        pricePerInputToken: pricing.pricePerInputToken || undefined,
        pricePerOutputToken: pricing.pricePerOutputToken || undefined,
        pricePerPage: pricing.pricePerPage || undefined,
        currency: pricing.currency,
        effectiveFrom: pricing.effectiveFrom,
        effectiveTo: pricing.effectiveTo || undefined
      };

      // Cache the result
      await redis.set(cacheKey, JSON.stringify(config), 'EX', this.REDIS_CACHE_TTL);
      this.pricingCache.set(cacheKey, { config, cachedAt: Date.now() });

      return config;
    }

    return null;
  }

  /**
   * 查找單價配置（含回退邏輯）
   */
  private async findPricing(
    provider: ApiProvider,
    operation?: string,
    modelVersion?: string
  ) {
    const now = new Date();

    // 1. Try exact match (provider + operation + model)
    if (operation && modelVersion) {
      const exact = await prisma.apiPricing.findFirst({
        where: {
          provider,
          operation,
          modelVersion,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
        },
        orderBy: { effectiveFrom: 'desc' }
      });

      if (exact) return exact;
    }

    // 2. Try provider + operation (any model)
    if (operation) {
      const withOperation = await prisma.apiPricing.findFirst({
        where: {
          provider,
          operation,
          modelVersion: null,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
        },
        orderBy: { effectiveFrom: 'desc' }
      });

      if (withOperation) return withOperation;
    }

    // 3. Try provider + model (default operation)
    if (modelVersion) {
      const withModel = await prisma.apiPricing.findFirst({
        where: {
          provider,
          operation: null,
          modelVersion,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
        },
        orderBy: { effectiveFrom: 'desc' }
      });

      if (withModel) return withModel;
    }

    // 4. Fall back to provider default
    const providerDefault = await prisma.apiPricing.findFirst({
      where: {
        provider,
        operation: null,
        modelVersion: null,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }]
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    return providerDefault;
  }

  /**
   * 清除單價快取
   */
  async clearPricingCache(provider?: ApiProvider): Promise<void> {
    if (provider) {
      // Clear specific provider cache
      const pattern = `pricing:${provider}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      // Clear memory cache for provider
      for (const key of this.pricingCache.keys()) {
        if (key.startsWith(`pricing:${provider}:`)) {
          this.pricingCache.delete(key);
        }
      }
    } else {
      // Clear all pricing cache
      const keys = await redis.keys('pricing:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      this.pricingCache.clear();
    }
  }

  // Helper methods
  private buildPricingCacheKey(
    provider: ApiProvider,
    operation?: string,
    modelVersion?: string
  ): string {
    return `pricing:${provider}:${operation || 'default'}:${modelVersion || 'default'}`;
  }

  private groupRecords(
    records: ApiCallRecord[]
  ): Map<string, number[]> {
    const groups = new Map<string, number[]>();

    records.forEach((record, index) => {
      const key = `${record.provider}|${record.operation || ''}|${record.modelVersion || ''}`;
      const indices = groups.get(key) || [];
      indices.push(index);
      groups.set(key, indices);
    });

    return groups;
  }

  private async calculateCostWithPricing(
    record: ApiCallRecord,
    pricing: PricingConfig
  ): Promise<CostCalculationResult> {
    const breakdown = {
      callCost: pricing.pricePerCall || 0,
      inputTokenCost: (pricing.pricePerInputToken || 0) * (record.tokensInput || 0),
      outputTokenCost: (pricing.pricePerOutputToken || 0) * (record.tokensOutput || 0),
      pageCost: (pricing.pricePerPage || 0) * (record.pageCount || 0)
    };

    return {
      estimatedCost:
        breakdown.callCost +
        breakdown.inputTokenCost +
        breakdown.outputTokenCost +
        breakdown.pageCost,
      currency: pricing.currency,
      breakdown,
      pricingId: pricing.id,
      pricingEffectiveFrom: pricing.effectiveFrom
    };
  }
}

export const apiCostCalculator = new ApiCostCalculatorService();
```

### API Usage Logger Service

```typescript
// src/services/api-usage-logger.service.ts

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { apiCostCalculator } from './api-cost-calculator.service';
import { ApiCallRecord } from '@/types/api-cost';
import { logger } from '@/lib/logger';

interface PendingLog {
  record: ApiCallRecord;
  estimatedCost: number;
  timestamp: Date;
}

export class ApiUsageLoggerService {
  private pendingLogs: PendingLog[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  constructor() {
    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * 記錄單次 API 調用
   */
  async logApiCall(record: ApiCallRecord): Promise<void> {
    try {
      // Calculate cost
      const costResult = await apiCostCalculator.calculateCost(record);

      // Add to pending batch
      this.pendingLogs.push({
        record,
        estimatedCost: costResult.estimatedCost,
        timestamp: new Date()
      });

      // Flush if batch size reached
      if (this.pendingLogs.length >= this.BATCH_SIZE) {
        await this.flushLogs();
      }
    } catch (error) {
      logger.error('Failed to queue API usage log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        record: { provider: record.provider, operation: record.operation }
      });

      // Fail silently - logging should not block main flow
    }
  }

  /**
   * 同步記錄 API 調用（立即寫入）
   */
  async logApiCallSync(record: ApiCallRecord): Promise<string> {
    const costResult = await apiCostCalculator.calculateCost(record);

    const log = await prisma.apiUsageLog.create({
      data: {
        documentId: record.documentId,
        cityCode: record.cityCode,
        provider: record.provider,
        operation: record.operation,
        tokensInput: record.tokensInput,
        tokensOutput: record.tokensOutput,
        estimatedCost: costResult.estimatedCost,
        responseTime: record.responseTimeMs,
        success: record.success,
        errorMessage: record.errorMessage,
        metadata: record.metadata
      }
    });

    // Invalidate relevant caches
    await this.invalidateCaches(record.cityCode);

    return log.id;
  }

  /**
   * 批量記錄 API 調用
   */
  async logBatch(records: ApiCallRecord[]): Promise<void> {
    try {
      // Calculate costs in batch
      const costs = await apiCostCalculator.calculateBatchCost(records);

      // Prepare log entries
      const logEntries = records.map((record, index) => ({
        documentId: record.documentId,
        cityCode: record.cityCode,
        provider: record.provider,
        operation: record.operation,
        tokensInput: record.tokensInput,
        tokensOutput: record.tokensOutput,
        estimatedCost: costs.get(index)?.estimatedCost || 0,
        responseTime: record.responseTimeMs,
        success: record.success,
        errorMessage: record.errorMessage,
        metadata: record.metadata
      }));

      // Batch insert
      await prisma.apiUsageLog.createMany({
        data: logEntries
      });

      // Invalidate caches for affected cities
      const cities = [...new Set(records.map(r => r.cityCode))];
      for (const city of cities) {
        await this.invalidateCaches(city);
      }
    } catch (error) {
      logger.error('Failed to log API usage batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recordCount: records.length
      });
    }
  }

  /**
   * 立即刷新待處理的日誌
   */
  async flushLogs(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      const logEntries = logsToFlush.map(({ record, estimatedCost }) => ({
        documentId: record.documentId,
        cityCode: record.cityCode,
        provider: record.provider,
        operation: record.operation,
        tokensInput: record.tokensInput,
        tokensOutput: record.tokensOutput,
        estimatedCost,
        responseTime: record.responseTimeMs,
        success: record.success,
        errorMessage: record.errorMessage,
        metadata: record.metadata
      }));

      await prisma.apiUsageLog.createMany({
        data: logEntries
      });

      // Invalidate caches
      const cities = [...new Set(logsToFlush.map(l => l.record.cityCode))];
      for (const city of cities) {
        await this.invalidateCaches(city);
      }

      logger.info('Flushed API usage logs', { count: logsToFlush.length });
    } catch (error) {
      // On failure, re-add logs to pending queue
      this.pendingLogs.unshift(...logsToFlush);

      logger.error('Failed to flush API usage logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: logsToFlush.length
      });
    }
  }

  /**
   * 獲取待處理日誌數量
   */
  getPendingCount(): number {
    return this.pendingLogs.length;
  }

  /**
   * 停止服務（清理）
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushLogs();
  }

  // Private methods
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.pendingLogs.length > 0) {
        await this.flushLogs();
      }
    }, this.FLUSH_INTERVAL);
  }

  private async invalidateCaches(cityCode: string): Promise<void> {
    const patterns = [
      `ai-cost:*:*${cityCode}*:*`,
      `ai-cost:*:global:*`,
      `city-cost:*:${cityCode}:*`,
      `city-cost:*:global:*`
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  }
}

export const apiUsageLogger = new ApiUsageLoggerService();
```

### City Cost Service

```typescript
// src/services/city-cost.service.ts

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { CityFilter } from '@/middleware/city-filter';
import {
  CityCostSummary,
  CityCostTrend,
  CostComparison,
  ProviderCostBreakdown,
  OperationCostBreakdown
} from '@/types/api-cost';
import { ApiProvider } from '@prisma/client';
import { format, subDays, differenceInDays } from 'date-fns';

export class CityCostService {
  private readonly CACHE_TTL = 60 * 5; // 5 minutes

  /**
   * 獲取城市成本摘要
   */
  async getCityCostSummary(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<CityCostSummary[]> {
    const cacheKey = this.buildCacheKey('summary', cityFilter, startDate, endDate);

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const cityWhere = this.buildCityWhereClause(cityFilter);

    // Aggregate cost by city
    const costByCity = await prisma.apiUsageLog.groupBy({
      by: ['cityCode'],
      where: {
        ...cityWhere,
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: {
        estimatedCost: true,
        tokensInput: true,
        tokensOutput: true
      },
      _count: { id: true }
    });

    // Get successful/failed counts
    const successCounts = await prisma.apiUsageLog.groupBy({
      by: ['cityCode', 'success'],
      where: {
        ...cityWhere,
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: { id: true }
    });

    // Get provider breakdown
    const providerBreakdown = await prisma.apiUsageLog.groupBy({
      by: ['cityCode', 'provider'],
      where: {
        ...cityWhere,
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: {
        estimatedCost: true,
        tokensInput: true,
        tokensOutput: true
      },
      _count: { id: true }
    });

    // Get operation breakdown
    const operationBreakdown = await prisma.apiUsageLog.groupBy({
      by: ['cityCode', 'operation', 'provider'],
      where: {
        ...cityWhere,
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { estimatedCost: true },
      _count: { id: true }
    });

    // Get city names
    const cities = await prisma.city.findMany({
      where: { code: { in: costByCity.map(c => c.cityCode) } },
      select: { code: true, name: true }
    });
    const cityNameMap = new Map(cities.map(c => [c.code, c.name]));

    // Build success count map
    const successMap = new Map<string, { success: number; failed: number }>();
    for (const row of successCounts) {
      const current = successMap.get(row.cityCode) || { success: 0, failed: 0 };
      if (row.success) {
        current.success = row._count.id;
      } else {
        current.failed = row._count.id;
      }
      successMap.set(row.cityCode, current);
    }

    // Assemble summaries
    const summaries: CityCostSummary[] = costByCity.map(city => {
      const totalCost = city._sum.estimatedCost || 0;
      const totalCalls = city._count.id;
      const cityProviders = providerBreakdown.filter(p => p.cityCode === city.cityCode);
      const cityOperations = operationBreakdown.filter(o => o.cityCode === city.cityCode);
      const successData = successMap.get(city.cityCode) || { success: 0, failed: 0 };

      const byProvider: ProviderCostBreakdown[] = cityProviders.map(p => ({
        provider: p.provider,
        cost: p._sum.estimatedCost || 0,
        calls: p._count.id,
        tokens: {
          input: p._sum.tokensInput || 0,
          output: p._sum.tokensOutput || 0
        },
        percentage: totalCost > 0
          ? ((p._sum.estimatedCost || 0) / totalCost) * 100
          : 0
      }));

      const byOperation: OperationCostBreakdown[] = cityOperations.map(o => ({
        operation: o.operation,
        provider: o.provider,
        cost: o._sum.estimatedCost || 0,
        calls: o._count.id,
        avgCost: o._count.id > 0
          ? (o._sum.estimatedCost || 0) / o._count.id
          : 0
      }));

      return {
        cityCode: city.cityCode,
        cityName: cityNameMap.get(city.cityCode) || city.cityCode,
        totalCost,
        totalCalls,
        successfulCalls: successData.success,
        failedCalls: successData.failed,
        totalTokens: {
          input: city._sum.tokensInput || 0,
          output: city._sum.tokensOutput || 0,
          total: (city._sum.tokensInput || 0) + (city._sum.tokensOutput || 0)
        },
        avgCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
        avgTokensPerCall: totalCalls > 0
          ? ((city._sum.tokensInput || 0) + (city._sum.tokensOutput || 0)) / totalCalls
          : 0,
        byProvider,
        byOperation,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      };
    });

    // Sort by total cost descending
    summaries.sort((a, b) => b.totalCost - a.totalCost);

    await redis.set(cacheKey, JSON.stringify(summaries), 'EX', this.CACHE_TTL);

    return summaries;
  }

  /**
   * 獲取城市成本趨勢
   */
  async getCityCostTrend(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<CityCostTrend[]> {
    const cityWhere = this.buildCityWhereClause(cityFilter);
    const dateFormat = this.getDateFormatSQL(granularity);

    const result = await prisma.$queryRaw<{
      city_code: string;
      period: string;
      cost: number;
      calls: bigint;
      tokens: bigint;
    }[]>`
      SELECT
        city_code,
        TO_CHAR(created_at, ${dateFormat}) as period,
        SUM(estimated_cost) as cost,
        COUNT(*) as calls,
        COALESCE(SUM(tokens_input), 0) + COALESCE(SUM(tokens_output), 0) as tokens
      FROM api_usage_logs
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        ${this.buildCityRawWhere(cityWhere)}
      GROUP BY city_code, TO_CHAR(created_at, ${dateFormat})
      ORDER BY city_code, period
    `;

    // Group by city
    const trendsMap = new Map<string, CityCostTrend>();

    for (const row of result) {
      if (!trendsMap.has(row.city_code)) {
        trendsMap.set(row.city_code, {
          cityCode: row.city_code,
          data: []
        });
      }

      trendsMap.get(row.city_code)!.data.push({
        period: row.period,
        cost: row.cost || 0,
        calls: Number(row.calls),
        tokens: Number(row.tokens)
      });
    }

    return Array.from(trendsMap.values());
  }

  /**
   * 獲取城市成本對比（與上期比較）
   */
  async getCostComparison(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<CostComparison> {
    const periodLength = differenceInDays(endDate, startDate);
    const prevStartDate = subDays(startDate, periodLength + 1);
    const prevEndDate = subDays(startDate, 1);

    const cityWhere = this.buildCityWhereClause(cityFilter);

    // Current period costs
    const currentCosts = await prisma.apiUsageLog.groupBy({
      by: ['cityCode'],
      where: {
        ...cityWhere,
        createdAt: { gte: startDate, lte: endDate }
      },
      _sum: { estimatedCost: true }
    });

    // Previous period costs
    const prevCosts = await prisma.apiUsageLog.groupBy({
      by: ['cityCode'],
      where: {
        ...cityWhere,
        createdAt: { gte: prevStartDate, lte: prevEndDate }
      },
      _sum: { estimatedCost: true }
    });

    const prevCostMap = new Map(
      prevCosts.map(p => [p.cityCode, p._sum.estimatedCost || 0])
    );

    // Get city names
    const allCityCodes = [
      ...new Set([...currentCosts.map(c => c.cityCode), ...prevCosts.map(p => p.cityCode)])
    ];
    const cities = await prisma.city.findMany({
      where: { code: { in: allCityCodes } },
      select: { code: true, name: true }
    });
    const cityNameMap = new Map(cities.map(c => [c.code, c.name]));

    const comparison: CostComparison = {
      cities: currentCosts.map(c => {
        const currentCost = c._sum.estimatedCost || 0;
        const previousCost = prevCostMap.get(c.cityCode) || 0;
        const change = currentCost - previousCost;
        const changePercent = previousCost > 0
          ? (change / previousCost) * 100
          : currentCost > 0 ? 100 : 0;

        return {
          cityCode: c.cityCode,
          cityName: cityNameMap.get(c.cityCode) || c.cityCode,
          currentCost,
          previousCost,
          change,
          changePercent
        };
      }),
      period: {
        current: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        previous: {
          start: prevStartDate.toISOString(),
          end: prevEndDate.toISOString()
        }
      }
    };

    // Sort by change percent descending (biggest increases first)
    comparison.cities.sort((a, b) => b.changePercent - a.changePercent);

    return comparison;
  }

  // Helper methods
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

  private getDateFormatSQL(granularity: 'day' | 'week' | 'month'): string {
    switch (granularity) {
      case 'day':
        return 'YYYY-MM-DD';
      case 'week':
        return 'IYYY-IW';
      case 'month':
        return 'YYYY-MM';
    }
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
    return `city-cost:${type}:${cityPart}:${format(startDate, 'yyyy-MM-dd')}:${format(endDate, 'yyyy-MM-dd')}`;
  }
}

export const cityCostService = new CityCostService();
```

---

## API Routes

### City Cost Summary Endpoint

```typescript
// src/app/api/cost/city-summary/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { cityCostService } from '@/services/city-cost.service';
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

      const summaries = await cityCostService.getCityCostSummary(
        cityFilter,
        startDate,
        endDate
      );

      const totalCost = summaries.reduce((sum, s) => sum + s.totalCost, 0);

      return NextResponse.json({
        success: true,
        data: summaries,
        meta: {
          totalCities: summaries.length,
          totalCost,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
      });
    } catch (error) {
      console.error('City cost summary error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch city cost summary' },
        { status: 500 }
      );
    }
  });
}
```

### City Cost Trend Endpoint

```typescript
// src/app/api/cost/city-trend/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { cityCostService } from '@/services/city-cost.service';
import { parseISO, subMonths, isValid } from 'date-fns';

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url);

      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');
      const granularity = (searchParams.get('granularity') || 'day') as 'day' | 'week' | 'month';

      const endDate = endDateParam && isValid(parseISO(endDateParam))
        ? parseISO(endDateParam)
        : new Date();

      const startDate = startDateParam && isValid(parseISO(startDateParam))
        ? parseISO(startDateParam)
        : subMonths(endDate, 1);

      const trends = await cityCostService.getCityCostTrend(
        cityFilter,
        startDate,
        endDate,
        granularity
      );

      return NextResponse.json({
        success: true,
        data: trends,
        meta: {
          granularity,
          dataPoints: trends.reduce((sum, t) => sum + t.data.length, 0)
        }
      });
    } catch (error) {
      console.error('City cost trend error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch city cost trend' },
        { status: 500 }
      );
    }
  });
}
```

### Cost Comparison Endpoint

```typescript
// src/app/api/cost/comparison/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { cityCostService } from '@/services/city-cost.service';
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

      const comparison = await cityCostService.getCostComparison(
        cityFilter,
        startDate,
        endDate
      );

      return NextResponse.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Cost comparison error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch cost comparison' },
        { status: 500 }
      );
    }
  });
}
```

### Pricing Management Endpoints

```typescript
// src/app/api/admin/pricing/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/admin-auth';
import { prisma } from '@/lib/prisma';
import { apiCostCalculator } from '@/services/api-cost-calculator.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET - List all pricing configs
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const provider = searchParams.get('provider');
      const activeOnly = searchParams.get('activeOnly') !== 'false';

      const where: any = {};
      if (provider) {
        where.provider = provider;
      }
      if (activeOnly) {
        where.isActive = true;
      }

      const pricings = await prisma.apiPricing.findMany({
        where,
        orderBy: [
          { provider: 'asc' },
          { operation: 'asc' },
          { effectiveFrom: 'desc' }
        ]
      });

      return NextResponse.json({
        success: true,
        data: pricings,
        meta: {
          total: pricings.length,
          activeCount: pricings.filter(p => p.isActive).length
        }
      });
    } catch (error) {
      console.error('List pricing error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to list pricing configs' },
        { status: 500 }
      );
    }
  });
}

// POST - Create new pricing config
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (req) => {
    try {
      const session = await getServerSession(authOptions);
      const body = await req.json();

      const {
        provider,
        operation,
        modelVersion,
        pricePerCall,
        pricePerInputToken,
        pricePerOutputToken,
        pricePerPage,
        currency,
        effectiveFrom,
        effectiveTo,
        reason
      } = body;

      // Validate at least one pricing is set
      if (!pricePerCall && !pricePerInputToken && !pricePerOutputToken && !pricePerPage) {
        return NextResponse.json(
          { success: false, error: 'At least one pricing value must be provided' },
          { status: 400 }
        );
      }

      // Create pricing
      const pricing = await prisma.apiPricing.create({
        data: {
          provider,
          operation: operation || null,
          modelVersion: modelVersion || null,
          pricePerCall,
          pricePerInputToken,
          pricePerOutputToken,
          pricePerPage,
          currency: currency || 'USD',
          effectiveFrom: new Date(effectiveFrom),
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          createdBy: session?.user?.id || 'UNKNOWN'
        }
      });

      // Record history
      await prisma.apiPricingHistory.create({
        data: {
          pricingId: pricing.id,
          provider,
          operation: operation || null,
          changeType: 'CREATE',
          newValues: {
            pricePerCall,
            pricePerInputToken,
            pricePerOutputToken,
            pricePerPage,
            effectiveFrom,
            effectiveTo
          },
          changedBy: session?.user?.id || 'UNKNOWN',
          reason
        }
      });

      // Clear pricing cache
      await apiCostCalculator.clearPricingCache(provider);

      return NextResponse.json({
        success: true,
        data: pricing,
        message: 'Pricing config created successfully'
      });
    } catch (error) {
      console.error('Create pricing error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create pricing config' },
        { status: 500 }
      );
    }
  });
}
```

```typescript
// src/app/api/admin/pricing/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/middleware/admin-auth';
import { prisma } from '@/lib/prisma';
import { apiCostCalculator } from '@/services/api-cost-calculator.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
}

// PUT - Update pricing config
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(request, async (req) => {
    try {
      const session = await getServerSession(authOptions);
      const body = await req.json();

      const existing = await prisma.apiPricing.findUnique({
        where: { id: params.id }
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Pricing config not found' },
          { status: 404 }
        );
      }

      const {
        pricePerCall,
        pricePerInputToken,
        pricePerOutputToken,
        pricePerPage,
        effectiveTo,
        isActive,
        reason
      } = body;

      // Update pricing
      const updated = await prisma.apiPricing.update({
        where: { id: params.id },
        data: {
          pricePerCall: pricePerCall ?? existing.pricePerCall,
          pricePerInputToken: pricePerInputToken ?? existing.pricePerInputToken,
          pricePerOutputToken: pricePerOutputToken ?? existing.pricePerOutputToken,
          pricePerPage: pricePerPage ?? existing.pricePerPage,
          effectiveTo: effectiveTo !== undefined
            ? (effectiveTo ? new Date(effectiveTo) : null)
            : existing.effectiveTo,
          isActive: isActive ?? existing.isActive,
          updatedBy: session?.user?.id || 'UNKNOWN'
        }
      });

      // Record history
      await prisma.apiPricingHistory.create({
        data: {
          pricingId: params.id,
          provider: existing.provider,
          operation: existing.operation,
          changeType: isActive === false ? 'DEACTIVATE' : 'UPDATE',
          previousValues: {
            pricePerCall: existing.pricePerCall,
            pricePerInputToken: existing.pricePerInputToken,
            pricePerOutputToken: existing.pricePerOutputToken,
            pricePerPage: existing.pricePerPage,
            effectiveTo: existing.effectiveTo,
            isActive: existing.isActive
          },
          newValues: {
            pricePerCall: updated.pricePerCall,
            pricePerInputToken: updated.pricePerInputToken,
            pricePerOutputToken: updated.pricePerOutputToken,
            pricePerPage: updated.pricePerPage,
            effectiveTo: updated.effectiveTo,
            isActive: updated.isActive
          },
          changedBy: session?.user?.id || 'UNKNOWN',
          reason
        }
      });

      // Clear pricing cache
      await apiCostCalculator.clearPricingCache(existing.provider);

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Pricing config updated successfully'
      });
    } catch (error) {
      console.error('Update pricing error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update pricing config' },
        { status: 500 }
      );
    }
  });
}

// GET - Get pricing history
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(request, async (req) => {
    try {
      const history = await prisma.apiPricingHistory.findMany({
        where: { pricingId: params.id },
        orderBy: { changedAt: 'desc' }
      });

      return NextResponse.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Get pricing history error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get pricing history' },
        { status: 500 }
      );
    }
  });
}
```

---

## AI Service Wrappers

### Document Intelligence Service

```typescript
// src/services/ai/document-intelligence.service.ts

import {
  DocumentAnalysisClient,
  AzureKeyCredential
} from '@azure/ai-form-recognizer';
import { apiUsageLogger } from '../api-usage-logger.service';
import { ApiCallRecord } from '@/types/api-cost';
import { logger } from '@/lib/logger';

export interface DocumentAnalysisResult {
  fields: Record<string, any>;
  pages: number;
  confidence: number;
  rawContent: string;
}

export class DocumentIntelligenceService {
  private client: DocumentAnalysisClient;

  constructor() {
    this.client = new DocumentAnalysisClient(
      process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT!,
      new AzureKeyCredential(process.env.AZURE_DOC_INTELLIGENCE_KEY!)
    );
  }

  /**
   * 分析發票文件
   */
  async analyzeInvoice(
    documentId: string,
    cityCode: string,
    documentUrl: string
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let pageCount = 0;

    try {
      const poller = await this.client.beginAnalyzeDocumentFromUrl(
        'prebuilt-invoice',
        documentUrl
      );
      const result = await poller.pollUntilDone();

      pageCount = result.pages?.length || 1;

      return this.transformInvoiceResult(result);
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Document Intelligence analysis failed', {
        documentId,
        error: errorMessage
      });
      throw error;
    } finally {
      // Log API usage
      const record: ApiCallRecord = {
        documentId,
        cityCode,
        provider: 'AZURE_DOC_INTELLIGENCE',
        operation: 'invoice-analysis',
        pageCount,
        responseTimeMs: Date.now() - startTime,
        success,
        errorMessage,
        metadata: {
          modelId: 'prebuilt-invoice'
        }
      };

      await apiUsageLogger.logApiCall(record);
    }
  }

  /**
   * OCR 文字提取
   */
  async extractText(
    documentId: string,
    cityCode: string,
    documentUrl: string
  ): Promise<string> {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let pageCount = 0;

    try {
      const poller = await this.client.beginAnalyzeDocumentFromUrl(
        'prebuilt-read',
        documentUrl
      );
      const result = await poller.pollUntilDone();

      pageCount = result.pages?.length || 1;

      return result.content || '';
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const record: ApiCallRecord = {
        documentId,
        cityCode,
        provider: 'AZURE_DOC_INTELLIGENCE',
        operation: 'ocr',
        pageCount,
        responseTimeMs: Date.now() - startTime,
        success,
        errorMessage
      };

      await apiUsageLogger.logApiCall(record);
    }
  }

  private transformInvoiceResult(result: any): DocumentAnalysisResult {
    const fields: Record<string, any> = {};
    const document = result.documents?.[0];

    if (document?.fields) {
      for (const [key, field] of Object.entries(document.fields as Record<string, any>)) {
        fields[key] = {
          value: field.value || field.content,
          confidence: field.confidence
        };
      }
    }

    return {
      fields,
      pages: result.pages?.length || 1,
      confidence: document?.confidence || 0,
      rawContent: result.content || ''
    };
  }
}

export const documentIntelligenceService = new DocumentIntelligenceService();
```

### OpenAI Service

```typescript
// src/services/ai/openai.service.ts

import OpenAI from 'openai';
import { apiUsageLogger } from '../api-usage-logger.service';
import { ApiCallRecord } from '@/types/api-cost';
import { logger } from '@/lib/logger';

export interface FieldExtractionResult {
  fields: Record<string, any>;
  confidence: number;
}

export class OpenAIService {
  private client: OpenAI;
  private readonly defaultModel = 'gpt-4-turbo-preview';

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * 欄位提取
   */
  async extractFields(
    documentId: string,
    cityCode: string,
    ocrText: string,
    forwarderCode: string,
    model?: string
  ): Promise<FieldExtractionResult> {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let tokensInput = 0;
    let tokensOutput = 0;
    const modelVersion = model || this.defaultModel;

    try {
      const response = await this.client.chat.completions.create({
        model: modelVersion,
        messages: [
          {
            role: 'system',
            content: this.getExtractionPrompt(forwarderCode)
          },
          {
            role: 'user',
            content: `Extract invoice fields from the following OCR text:\n\n${ocrText}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      tokensInput = response.usage?.prompt_tokens || 0;
      tokensOutput = response.usage?.completion_tokens || 0;

      return this.parseExtractionResponse(response);
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('OpenAI field extraction failed', {
        documentId,
        error: errorMessage
      });
      throw error;
    } finally {
      const record: ApiCallRecord = {
        documentId,
        cityCode,
        provider: 'OPENAI',
        operation: 'field-extraction',
        modelVersion,
        tokensInput,
        tokensOutput,
        responseTimeMs: Date.now() - startTime,
        success,
        errorMessage,
        metadata: {
          forwarderCode
        }
      };

      await apiUsageLogger.logApiCall(record);
    }
  }

  /**
   * 資料驗證
   */
  async validateData(
    documentId: string,
    cityCode: string,
    extractedData: Record<string, any>,
    validationRules: string,
    model?: string
  ): Promise<{ valid: boolean; issues: string[] }> {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let tokensInput = 0;
    let tokensOutput = 0;
    const modelVersion = model || this.defaultModel;

    try {
      const response = await this.client.chat.completions.create({
        model: modelVersion,
        messages: [
          {
            role: 'system',
            content: `You are a data validation assistant. Validate the extracted invoice data against the rules. Return JSON with "valid" (boolean) and "issues" (array of strings).`
          },
          {
            role: 'user',
            content: `Rules:\n${validationRules}\n\nData:\n${JSON.stringify(extractedData, null, 2)}`
          }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      });

      tokensInput = response.usage?.prompt_tokens || 0;
      tokensOutput = response.usage?.completion_tokens || 0;

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const record: ApiCallRecord = {
        documentId,
        cityCode,
        provider: 'OPENAI',
        operation: 'validation',
        modelVersion,
        tokensInput,
        tokensOutput,
        responseTimeMs: Date.now() - startTime,
        success,
        errorMessage
      };

      await apiUsageLogger.logApiCall(record);
    }
  }

  private getExtractionPrompt(forwarderCode: string): string {
    return `You are an invoice field extraction assistant specialized for ${forwarderCode} invoices.
Extract the following fields from the OCR text and return as JSON:
- invoiceNumber
- invoiceDate
- vendorName
- vendorAddress
- totalAmount
- currency
- lineItems (array with description, quantity, unitPrice, amount)
- taxAmount
- dueDate

Return only the JSON object with extracted values. Use null for fields that cannot be found.`;
  }

  private parseExtractionResponse(response: OpenAI.Chat.Completions.ChatCompletion): FieldExtractionResult {
    const content = response.choices[0]?.message?.content || '{}';
    const fields = JSON.parse(content);

    // Calculate confidence based on how many fields were extracted
    const totalFields = 9;
    const extractedCount = Object.values(fields).filter(v => v !== null).length;
    const confidence = extractedCount / totalFields;

    return {
      fields,
      confidence
    };
  }
}

export const openaiService = new OpenAIService();
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/services/__tests__/api-cost-calculator.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiCostCalculatorService } from '../api-cost-calculator.service';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

vi.mock('@/lib/prisma');
vi.mock('@/lib/redis');

describe('ApiCostCalculatorService', () => {
  let service: ApiCostCalculatorService;

  beforeEach(() => {
    service = new ApiCostCalculatorService();
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
  });

  describe('calculateCost', () => {
    it('should calculate Document Intelligence cost per page', async () => {
      vi.mocked(prisma.apiPricing.findFirst).mockResolvedValue({
        id: 'price-1',
        provider: 'AZURE_DOC_INTELLIGENCE',
        operation: 'invoice-analysis',
        pricePerPage: 0.001,
        currency: 'USD',
        effectiveFrom: new Date('2025-01-01')
      } as any);

      const result = await service.calculateCost({
        cityCode: 'TPE',
        provider: 'AZURE_DOC_INTELLIGENCE',
        operation: 'invoice-analysis',
        pageCount: 3,
        success: true
      });

      expect(result.estimatedCost).toBeCloseTo(0.003, 4);
      expect(result.breakdown.pageCost).toBeCloseTo(0.003, 4);
    });

    it('should calculate OpenAI cost per token', async () => {
      vi.mocked(prisma.apiPricing.findFirst).mockResolvedValue({
        id: 'price-2',
        provider: 'OPENAI',
        operation: 'field-extraction',
        pricePerInputToken: 0.00001,
        pricePerOutputToken: 0.00003,
        currency: 'USD',
        effectiveFrom: new Date('2025-01-01')
      } as any);

      const result = await service.calculateCost({
        cityCode: 'TPE',
        provider: 'OPENAI',
        operation: 'field-extraction',
        tokensInput: 1000,
        tokensOutput: 500,
        success: true
      });

      // Input: 1000 * 0.00001 = 0.01
      // Output: 500 * 0.00003 = 0.015
      expect(result.estimatedCost).toBeCloseTo(0.025, 4);
      expect(result.breakdown.inputTokenCost).toBeCloseTo(0.01, 4);
      expect(result.breakdown.outputTokenCost).toBeCloseTo(0.015, 4);
    });

    it('should return zero cost when no pricing found', async () => {
      vi.mocked(prisma.apiPricing.findFirst).mockResolvedValue(null);

      const result = await service.calculateCost({
        cityCode: 'TPE',
        provider: 'OPENAI',
        operation: 'unknown-operation',
        success: true
      });

      expect(result.estimatedCost).toBe(0);
      expect(result.pricingId).toBe('NOT_FOUND');
    });
  });

  describe('getActivePricing', () => {
    it('should use memory cache for hot path', async () => {
      const pricing = {
        id: 'price-1',
        provider: 'OPENAI',
        pricePerInputToken: 0.00001,
        pricePerOutputToken: 0.00003,
        currency: 'USD',
        effectiveFrom: new Date('2025-01-01')
      };

      vi.mocked(prisma.apiPricing.findFirst).mockResolvedValue(pricing as any);

      // First call - fetches from DB
      await service.getActivePricing('OPENAI', 'field-extraction');

      // Second call - should use memory cache
      await service.getActivePricing('OPENAI', 'field-extraction');

      expect(prisma.apiPricing.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should fall back to provider default when specific pricing not found', async () => {
      vi.mocked(prisma.apiPricing.findFirst)
        .mockResolvedValueOnce(null) // Exact match not found
        .mockResolvedValueOnce(null) // Operation default not found
        .mockResolvedValueOnce(null) // Model default not found
        .mockResolvedValue({         // Provider default found
          id: 'price-default',
          provider: 'OPENAI',
          operation: null,
          modelVersion: null,
          pricePerInputToken: 0.00001,
          pricePerOutputToken: 0.00003,
          currency: 'USD',
          effectiveFrom: new Date('2025-01-01')
        } as any);

      const result = await service.getActivePricing(
        'OPENAI',
        'new-operation',
        'gpt-4-turbo'
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe('price-default');
    });
  });
});
```

### Integration Tests

```typescript
// src/services/__tests__/city-cost.service.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CityCostService } from '../city-cost.service';
import { prisma } from '@/lib/prisma';
import { CityFilter } from '@/middleware/city-filter';

describe('CityCostService Integration', () => {
  let service: CityCostService;

  beforeEach(async () => {
    service = new CityCostService();
    await prisma.apiUsageLog.deleteMany();
  });

  afterEach(async () => {
    await prisma.apiUsageLog.deleteMany();
  });

  describe('getCityCostSummary', () => {
    it('should aggregate costs by city correctly', async () => {
      // Seed test data
      await prisma.apiUsageLog.createMany({
        data: [
          {
            cityCode: 'TPE',
            provider: 'OPENAI',
            operation: 'field-extraction',
            tokensInput: 1000,
            tokensOutput: 500,
            estimatedCost: 0.025,
            success: true
          },
          {
            cityCode: 'TPE',
            provider: 'AZURE_DOC_INTELLIGENCE',
            operation: 'invoice-analysis',
            estimatedCost: 0.003,
            success: true
          },
          {
            cityCode: 'KHH',
            provider: 'OPENAI',
            operation: 'field-extraction',
            tokensInput: 500,
            tokensOutput: 250,
            estimatedCost: 0.0125,
            success: true
          }
        ]
      });

      const filter: CityFilter = { isGlobalAdmin: true, cityCodes: [] };
      const summaries = await service.getCityCostSummary(
        filter,
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );

      expect(summaries.length).toBe(2);

      const tpe = summaries.find(s => s.cityCode === 'TPE');
      expect(tpe).toBeDefined();
      expect(tpe!.totalCost).toBeCloseTo(0.028, 3);
      expect(tpe!.totalCalls).toBe(2);
      expect(tpe!.byProvider.length).toBe(2);

      const khh = summaries.find(s => s.cityCode === 'KHH');
      expect(khh).toBeDefined();
      expect(khh!.totalCost).toBeCloseTo(0.0125, 4);
    });

    it('should respect city filter', async () => {
      await prisma.apiUsageLog.createMany({
        data: [
          { cityCode: 'TPE', provider: 'OPENAI', operation: 'test', estimatedCost: 1, success: true },
          { cityCode: 'KHH', provider: 'OPENAI', operation: 'test', estimatedCost: 2, success: true }
        ]
      });

      const filter: CityFilter = { isGlobalAdmin: false, cityCodes: ['TPE'] };
      const summaries = await service.getCityCostSummary(
        filter,
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );

      expect(summaries.length).toBe(1);
      expect(summaries[0].cityCode).toBe('TPE');
      expect(summaries[0].totalCost).toBe(1);
    });
  });
});
```

---

## Performance Considerations

### Caching Strategy

| Data Type | Memory Cache | Redis Cache | Invalidation |
|-----------|--------------|-------------|--------------|
| Pricing Config | 1 minute | 1 hour | On pricing update |
| City Summary | - | 5 minutes | On new API log |
| City Trend | - | 10 minutes | On new API log |

### Batch Processing

```typescript
// Batch write configuration
const BATCH_SIZE = 50;
const FLUSH_INTERVAL = 5000; // 5 seconds

// High-throughput logging with batching
await apiUsageLogger.logApiCall(record); // Queued
// ... more calls ...
// Auto-flushes when batch size reached or interval elapsed
```

### Database Optimization

1. **Composite Indexes**: `(city_code, created_at)`, `(city_code, provider, created_at)`
2. **Partitioning**: Consider monthly partitioning for api_usage_logs table
3. **Aggregation**: Use database-level aggregation for reports

---

## Security Considerations

### Access Control

1. **City-based Isolation**: Users can only view costs for authorized cities
2. **Admin-only Pricing Management**: Only system admins can modify pricing
3. **Audit Trail**: All pricing changes are logged with user ID and reason

### Data Protection

1. **No Sensitive Data**: API logs should not contain sensitive document content
2. **Cost Masking**: Consider masking exact costs for non-admin users

### Input Validation

```typescript
// Validate pricing update request
if (!pricePerCall && !pricePerInputToken && !pricePerOutputToken && !pricePerPage) {
  return NextResponse.json(
    { success: false, error: 'At least one pricing value must be provided' },
    { status: 400 }
  );
}
```

---

## Acceptance Criteria Verification

### AC1: API 調用記錄
- [x] `ApiUsageLog` 模型記錄調用城市（cityCode）
- [x] 記錄 API 類型（Document Intelligence / OpenAI / Azure OpenAI）
- [x] 記錄 Token 數（輸入/輸出）
- [x] 記錄估算成本（基於最新單價）
- [x] 記錄關聯的文件 ID

### AC2: 成本聚合查詢
- [x] `getCityCostSummary` 支援時間範圍查詢
- [x] 支援按城市篩選
- [x] 支援按提供者和操作分類

### AC3: 單價配置
- [x] `ApiPricing` 模型支援多種定價方式
- [x] 單價管理 API（建立、更新、停用）
- [x] `ApiPricingHistory` 追蹤單價變更歷史
- [x] 歷史記錄保留原始估算成本

### AC4: 即時成本計算
- [x] `ApiCostCalculator` 即時計算成本
- [x] AI 服務封裝自動記錄調用
- [x] 成本即時反映在快取失效後的報表中

---

## File Structure

```
src/
├── types/
│   └── api-cost.ts                         # Type definitions
├── services/
│   ├── api-cost-calculator.service.ts      # Cost calculation
│   ├── api-usage-logger.service.ts         # Usage logging
│   ├── city-cost.service.ts                # City cost queries
│   └── ai/
│       ├── document-intelligence.service.ts
│       └── openai.service.ts
├── app/
│   └── api/
│       ├── cost/
│       │   ├── city-summary/
│       │   │   └── route.ts
│       │   ├── city-trend/
│       │   │   └── route.ts
│       │   └── comparison/
│       │       └── route.ts
│       └── admin/
│           └── pricing/
│               ├── route.ts
│               └── [id]/
│                   └── route.ts
prisma/
└── schema.prisma
```

---

## References

- [Story 7.8 Definition](../stories/7-8-city-ai-cost-tracking.md)
- [Epic 7: Reports Dashboard & Cost Tracking](../../03-epics/sections/epic-7-reports-dashboard-cost-tracking.md)
- [FR70: City AI Cost Tracking](../../01-planning/prd/sections/functional-requirements.md)
- [Tech Spec Story 7-6: AI API Usage & Cost Display](./tech-spec-story-7-6.md)
