# Tech Spec: Story 7-7 - 城市處理數量追蹤

## Overview

### Story Reference
- **Story ID**: 7.7
- **Story Key**: 7-7-city-processing-volume-tracking
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: ready-for-dev

### User Story
**As a** 系統,
**I want** 按城市追蹤發票處理數量,
**So that** 可以進行成本分攤和績效評估。

### Dependencies
- **Story 6.1**: 城市數據模型（cityCode 來源）
- **Story 2.6**: 處理路徑自動路由（處理完成事件）
- **Story 7.1**: 處理統計儀表板（顯示統計數據）

### FR Coverage
- **FR69**: 城市處理數量追蹤

---

## Database Schema

### Prisma Models

```prisma
// prisma/schema.prisma

// 每日處理統計模型
model ProcessingStatistics {
  id                  String   @id @default(uuid())
  cityCode            String   @map("city_code")
  date                DateTime @db.Date

  // 處理量統計
  totalProcessed      Int      @default(0) @map("total_processed")
  autoApproved        Int      @default(0) @map("auto_approved")
  manualReviewed      Int      @default(0) @map("manual_reviewed")
  escalated           Int      @default(0)
  failed              Int      @default(0)

  // 時間統計（秒）
  totalProcessingTime Int      @default(0) @map("total_processing_time")
  avgProcessingTime   Float?   @map("avg_processing_time")
  minProcessingTime   Int?     @map("min_processing_time")
  maxProcessingTime   Int?     @map("max_processing_time")

  // 成功率統計
  successCount        Int      @default(0) @map("success_count")
  successRate         Float?   @map("success_rate")

  // 自動化率統計
  automationRate      Float?   @map("automation_rate")

  // 元數據
  lastUpdatedAt       DateTime @default(now()) @map("last_updated_at")
  version             Int      @default(0)  // 樂觀鎖版本號

  // 關聯
  city                City     @relation(fields: [cityCode], references: [code])

  @@unique([cityCode, date])
  @@index([cityCode])
  @@index([date])
  @@index([cityCode, date])
  @@map("processing_statistics")
}

// 每小時處理統計（細粒度分析用）
model HourlyProcessingStats {
  id                  String   @id @default(uuid())
  cityCode            String   @map("city_code")
  hour                DateTime @db.Timestamptz  // 精確到小時

  // 處理量統計
  totalProcessed      Int      @default(0) @map("total_processed")
  autoApproved        Int      @default(0) @map("auto_approved")
  manualReviewed      Int      @default(0) @map("manual_reviewed")
  escalated           Int      @default(0)
  failed              Int      @default(0)

  // 處理時間
  totalProcessingTime Int      @default(0) @map("total_processing_time")

  createdAt           DateTime @default(now()) @map("created_at")

  @@unique([cityCode, hour])
  @@index([cityCode, hour])
  @@index([hour])
  @@map("hourly_processing_stats")
}

// 統計校驗日誌
model StatisticsAuditLog {
  id              String   @id @default(uuid())
  cityCode        String   @map("city_code")
  date            DateTime @db.Date
  auditType       String   @map("audit_type")  // 'SCHEDULED', 'MANUAL', 'AUTO_REPAIR'

  // 校驗結果
  verified        Boolean
  discrepancies   Json?    // 差異詳情
  corrections     Json?    // 修正內容

  // 元數據
  executedAt      DateTime @default(now()) @map("executed_at")
  executedBy      String?  @map("executed_by")  // 用戶ID或 'SYSTEM'

  @@index([cityCode, date])
  @@index([executedAt])
  @@map("statistics_audit_logs")
}
```

### Migration Script

```sql
-- Migration: create_processing_statistics_tables
-- Created: 2025-12-16

-- Create processing_statistics table
CREATE TABLE "processing_statistics" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "city_code" VARCHAR(10) NOT NULL,
    "date" DATE NOT NULL,

    -- Processing counts
    "total_processed" INTEGER NOT NULL DEFAULT 0,
    "auto_approved" INTEGER NOT NULL DEFAULT 0,
    "manual_reviewed" INTEGER NOT NULL DEFAULT 0,
    "escalated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,

    -- Processing time (seconds)
    "total_processing_time" INTEGER NOT NULL DEFAULT 0,
    "avg_processing_time" DOUBLE PRECISION,
    "min_processing_time" INTEGER,
    "max_processing_time" INTEGER,

    -- Success metrics
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION,
    "automation_rate" DOUBLE PRECISION,

    -- Metadata
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "processing_statistics_city_fkey" FOREIGN KEY ("city_code")
        REFERENCES "cities"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "processing_statistics_city_date_key" UNIQUE ("city_code", "date")
);

-- Create indexes for processing_statistics
CREATE INDEX "processing_statistics_city_code_idx" ON "processing_statistics"("city_code");
CREATE INDEX "processing_statistics_date_idx" ON "processing_statistics"("date");
CREATE INDEX "processing_statistics_city_date_idx" ON "processing_statistics"("city_code", "date");

-- Create hourly_processing_stats table
CREATE TABLE "hourly_processing_stats" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "city_code" VARCHAR(10) NOT NULL,
    "hour" TIMESTAMPTZ NOT NULL,

    "total_processed" INTEGER NOT NULL DEFAULT 0,
    "auto_approved" INTEGER NOT NULL DEFAULT 0,
    "manual_reviewed" INTEGER NOT NULL DEFAULT 0,
    "escalated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,

    "total_processing_time" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hourly_processing_stats_city_hour_key" UNIQUE ("city_code", "hour")
);

-- Create indexes for hourly_processing_stats
CREATE INDEX "hourly_processing_stats_city_hour_idx" ON "hourly_processing_stats"("city_code", "hour");
CREATE INDEX "hourly_processing_stats_hour_idx" ON "hourly_processing_stats"("hour");

-- Create statistics_audit_logs table
CREATE TABLE "statistics_audit_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "city_code" VARCHAR(10) NOT NULL,
    "date" DATE NOT NULL,
    "audit_type" VARCHAR(20) NOT NULL,

    "verified" BOOLEAN NOT NULL,
    "discrepancies" JSONB,
    "corrections" JSONB,

    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_by" VARCHAR(100),

    CONSTRAINT "statistics_audit_logs_audit_type_check"
        CHECK ("audit_type" IN ('SCHEDULED', 'MANUAL', 'AUTO_REPAIR'))
);

-- Create indexes for statistics_audit_logs
CREATE INDEX "statistics_audit_logs_city_date_idx" ON "statistics_audit_logs"("city_code", "date");
CREATE INDEX "statistics_audit_logs_executed_at_idx" ON "statistics_audit_logs"("executed_at");

-- Create function for atomic increment with version check
CREATE OR REPLACE FUNCTION increment_processing_stats(
    p_city_code VARCHAR(10),
    p_date DATE,
    p_result_type VARCHAR(20),
    p_processing_time INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if record exists
    SELECT EXISTS(
        SELECT 1 FROM processing_statistics
        WHERE city_code = p_city_code AND date = p_date
    ) INTO v_exists;

    IF NOT v_exists THEN
        -- Insert new record
        INSERT INTO processing_statistics (
            city_code, date, total_processed,
            auto_approved, manual_reviewed, escalated, failed,
            total_processing_time, success_count, version
        ) VALUES (
            p_city_code, p_date, 1,
            CASE WHEN p_result_type = 'AUTO_APPROVED' THEN 1 ELSE 0 END,
            CASE WHEN p_result_type = 'MANUAL_REVIEWED' THEN 1 ELSE 0 END,
            CASE WHEN p_result_type = 'ESCALATED' THEN 1 ELSE 0 END,
            CASE WHEN p_result_type = 'FAILED' THEN 1 ELSE 0 END,
            p_processing_time,
            CASE WHEN p_result_type != 'FAILED' THEN 1 ELSE 0 END,
            1
        );
    ELSE
        -- Update existing record
        UPDATE processing_statistics SET
            total_processed = total_processed + 1,
            auto_approved = auto_approved + CASE WHEN p_result_type = 'AUTO_APPROVED' THEN 1 ELSE 0 END,
            manual_reviewed = manual_reviewed + CASE WHEN p_result_type = 'MANUAL_REVIEWED' THEN 1 ELSE 0 END,
            escalated = escalated + CASE WHEN p_result_type = 'ESCALATED' THEN 1 ELSE 0 END,
            failed = failed + CASE WHEN p_result_type = 'FAILED' THEN 1 ELSE 0 END,
            total_processing_time = total_processing_time + p_processing_time,
            success_count = success_count + CASE WHEN p_result_type != 'FAILED' THEN 1 ELSE 0 END,
            last_updated_at = CURRENT_TIMESTAMP,
            version = version + 1,
            -- Recalculate averages
            avg_processing_time = (total_processing_time + p_processing_time)::FLOAT / (total_processed + 1),
            success_rate = (success_count + CASE WHEN p_result_type != 'FAILED' THEN 1 ELSE 0 END)::FLOAT / (total_processed + 1) * 100,
            automation_rate = (auto_approved + CASE WHEN p_result_type = 'AUTO_APPROVED' THEN 1 ELSE 0 END)::FLOAT / (total_processed + 1) * 100,
            min_processing_time = LEAST(COALESCE(min_processing_time, p_processing_time), p_processing_time),
            max_processing_time = GREATEST(COALESCE(max_processing_time, p_processing_time), p_processing_time)
        WHERE city_code = p_city_code AND date = p_date;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

---

## Type Definitions

### Core Types

```typescript
// src/types/processing-statistics.ts

/**
 * 處理結果類型
 */
export type ProcessingResultType =
  | 'AUTO_APPROVED'    // 自動通過
  | 'MANUAL_REVIEWED'  // 人工審核通過
  | 'ESCALATED'        // 升級處理
  | 'FAILED';          // 處理失敗

/**
 * 時間聚合粒度
 */
export type TimeGranularity = 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * 單日處理統計
 */
export interface DailyProcessingStats {
  cityCode: string;
  date: string;  // ISO date string YYYY-MM-DD
  totalProcessed: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  totalProcessingTime: number;  // seconds
  avgProcessingTime: number | null;
  minProcessingTime: number | null;
  maxProcessingTime: number | null;
  successCount: number;
  successRate: number | null;
  automationRate: number | null;
  lastUpdatedAt: string;
}

/**
 * 聚合統計結果
 */
export interface AggregatedStats {
  period: string;  // 日期或期間標識 (YYYY-MM-DD, YYYY-WW, YYYY-MM, YYYY)
  totalProcessed: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  avgProcessingTime: number;
  successRate: number;       // 0-100
  automationRate: number;    // 0-100
  // 計算欄位
  successCount?: number;
  failedRate?: number;
  manualRate?: number;
}

/**
 * 城市統計匯總
 */
export interface CityStatsSummary {
  cityCode: string;
  cityName: string;
  totalProcessed: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  avgProcessingTime: number;
  successRate: number;
  automationRate: number;
  trend: {
    processedChange: number;  // 百分比
    automationChange: number;
  };
}

/**
 * 統計查詢參數
 */
export interface StatsQueryParams {
  startDate: string;
  endDate: string;
  granularity: TimeGranularity;
  cityCodes?: string[];
  forwarderCodes?: string[];
}

/**
 * 處理結果記錄事件
 */
export interface ProcessingResultEvent {
  documentId: string;
  cityCode: string;
  forwarderCode: string;
  status: string;
  autoApproved: boolean;
  processingDurationSeconds: number;
  processedAt: Date;
}

/**
 * 校驗結果
 */
export interface ReconciliationResult {
  verified: boolean;
  discrepancies: StatDiscrepancy[];
  corrected: boolean;
  auditLogId: string;
}

/**
 * 統計差異
 */
export interface StatDiscrepancy {
  field: string;
  expected: number;
  actual: number;
  difference: number;
}

/**
 * 快取鍵配置
 */
export interface StatsCacheConfig {
  key: string;
  ttl: number;  // seconds
  tags: string[];
}
```

### API Response Types

```typescript
// src/types/api/processing-statistics.ts

import {
  AggregatedStats,
  CityStatsSummary,
  DailyProcessingStats,
  ReconciliationResult
} from '../processing-statistics';

/**
 * 聚合統計 API 回應
 */
export interface AggregatedStatsResponse {
  success: boolean;
  data: AggregatedStats[];
  meta: {
    granularity: string;
    startDate: string;
    endDate: string;
    totalDataPoints: number;
    cacheHit: boolean;
  };
}

/**
 * 城市統計匯總 API 回應
 */
export interface CityStatsSummaryResponse {
  success: boolean;
  data: CityStatsSummary[];
  meta: {
    period: string;
    cityCount: number;
  };
}

/**
 * 即時統計 API 回應
 */
export interface RealtimeStatsResponse {
  success: boolean;
  data: {
    todayStats: DailyProcessingStats;
    hourlyTrend: {
      hour: string;
      count: number;
    }[];
    liveQueue: {
      pending: number;
      processing: number;
    };
  };
}

/**
 * 校驗結果 API 回應
 */
export interface ReconciliationResponse {
  success: boolean;
  data: ReconciliationResult;
}
```

---

## Service Implementation

### Processing Stats Service

```typescript
// src/services/processing-stats.service.ts

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { CityFilter } from '@/middleware/city-filter';
import {
  ProcessingResultType,
  TimeGranularity,
  AggregatedStats,
  StatsQueryParams,
  DailyProcessingStats,
  CityStatsSummary,
  ReconciliationResult,
  StatDiscrepancy
} from '@/types/processing-statistics';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

interface StatsUpdateData {
  resultType: ProcessingResultType;
  processingTimeSeconds: number;
}

export class ProcessingStatsService {
  private readonly CACHE_TTL = 60 * 5; // 5 minutes
  private readonly REALTIME_CACHE_TTL = 60; // 1 minute for realtime data
  private readonly LOCK_TTL = 10; // 10 seconds
  private readonly MAX_RETRIES = 3;

  /**
   * 記錄處理結果
   * 在文件處理完成時調用
   */
  async recordProcessingResult(
    cityCode: string,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    const today = startOfDay(new Date());
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    // 並行更新日統計和小時統計
    await Promise.all([
      this.updateDailyStats(cityCode, today, resultType, processingTimeSeconds),
      this.updateHourlyStats(cityCode, currentHour, resultType, processingTimeSeconds)
    ]);

    // 清除相關快取
    await this.invalidateRelatedCaches(cityCode);
  }

  /**
   * 更新每日統計
   */
  private async updateDailyStats(
    cityCode: string,
    date: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    const lockKey = `stats:lock:daily:${cityCode}:${format(date, 'yyyy-MM-dd')}`;

    // 嘗試獲取分佈式鎖
    const locked = await redis.set(lockKey, '1', 'EX', this.LOCK_TTL, 'NX');

    if (locked) {
      try {
        await this.performDailyUpdate(cityCode, date, resultType, processingTimeSeconds);
      } finally {
        await redis.del(lockKey);
      }
    } else {
      // 無法獲取鎖，使用樂觀鎖更新
      await this.updateWithOptimisticLock(cityCode, date, resultType, processingTimeSeconds);
    }
  }

  /**
   * 執行每日統計更新
   */
  private async performDailyUpdate(
    cityCode: string,
    date: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    // 使用資料庫函數執行原子更新
    await prisma.$executeRaw`
      SELECT increment_processing_stats(
        ${cityCode}::VARCHAR,
        ${date}::DATE,
        ${resultType}::VARCHAR,
        ${processingTimeSeconds}::INTEGER
      )
    `;
  }

  /**
   * 樂觀鎖更新
   */
  private async updateWithOptimisticLock(
    cityCode: string,
    date: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number,
    attempt: number = 0
  ): Promise<void> {
    if (attempt >= this.MAX_RETRIES) {
      throw new Error(`Failed to update stats after ${this.MAX_RETRIES} attempts`);
    }

    try {
      const existing = await prisma.processingStatistics.findUnique({
        where: { cityCode_date: { cityCode, date } }
      });

      if (!existing) {
        // 記錄不存在，創建新記錄
        await this.performDailyUpdate(cityCode, date, resultType, processingTimeSeconds);
        return;
      }

      // 使用版本號進行樂觀鎖更新
      const updateResult = await prisma.processingStatistics.updateMany({
        where: {
          cityCode,
          date,
          version: existing.version
        },
        data: this.buildIncrementData(
          existing,
          resultType,
          processingTimeSeconds
        )
      });

      if (updateResult.count === 0) {
        // 版本衝突，重試
        await this.updateWithOptimisticLock(
          cityCode,
          date,
          resultType,
          processingTimeSeconds,
          attempt + 1
        );
      }
    } catch (error) {
      if (attempt < this.MAX_RETRIES - 1) {
        // 短暫延遲後重試
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        await this.updateWithOptimisticLock(
          cityCode,
          date,
          resultType,
          processingTimeSeconds,
          attempt + 1
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * 構建增量更新數據
   */
  private buildIncrementData(
    existing: any,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ) {
    const newTotal = existing.totalProcessed + 1;
    const newProcessingTime = existing.totalProcessingTime + processingTimeSeconds;
    const newSuccessCount = existing.successCount + (resultType !== 'FAILED' ? 1 : 0);
    const newAutoApproved = existing.autoApproved + (resultType === 'AUTO_APPROVED' ? 1 : 0);

    return {
      totalProcessed: { increment: 1 },
      autoApproved: resultType === 'AUTO_APPROVED' ? { increment: 1 } : undefined,
      manualReviewed: resultType === 'MANUAL_REVIEWED' ? { increment: 1 } : undefined,
      escalated: resultType === 'ESCALATED' ? { increment: 1 } : undefined,
      failed: resultType === 'FAILED' ? { increment: 1 } : undefined,
      totalProcessingTime: { increment: processingTimeSeconds },
      successCount: resultType !== 'FAILED' ? { increment: 1 } : undefined,
      avgProcessingTime: newProcessingTime / newTotal,
      successRate: (newSuccessCount / newTotal) * 100,
      automationRate: (newAutoApproved / newTotal) * 100,
      minProcessingTime: existing.minProcessingTime
        ? Math.min(existing.minProcessingTime, processingTimeSeconds)
        : processingTimeSeconds,
      maxProcessingTime: existing.maxProcessingTime
        ? Math.max(existing.maxProcessingTime, processingTimeSeconds)
        : processingTimeSeconds,
      lastUpdatedAt: new Date(),
      version: { increment: 1 }
    };
  }

  /**
   * 更新小時統計
   */
  private async updateHourlyStats(
    cityCode: string,
    hour: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    await prisma.hourlyProcessingStats.upsert({
      where: {
        cityCode_hour: { cityCode, hour }
      },
      create: {
        cityCode,
        hour,
        totalProcessed: 1,
        autoApproved: resultType === 'AUTO_APPROVED' ? 1 : 0,
        manualReviewed: resultType === 'MANUAL_REVIEWED' ? 1 : 0,
        escalated: resultType === 'ESCALATED' ? 1 : 0,
        failed: resultType === 'FAILED' ? 1 : 0,
        totalProcessingTime: processingTimeSeconds
      },
      update: {
        totalProcessed: { increment: 1 },
        autoApproved: resultType === 'AUTO_APPROVED' ? { increment: 1 } : undefined,
        manualReviewed: resultType === 'MANUAL_REVIEWED' ? { increment: 1 } : undefined,
        escalated: resultType === 'ESCALATED' ? { increment: 1 } : undefined,
        failed: resultType === 'FAILED' ? { increment: 1 } : undefined,
        totalProcessingTime: { increment: processingTimeSeconds }
      }
    });
  }

  /**
   * 獲取聚合統計數據
   */
  async getAggregatedStats(
    cityFilter: CityFilter,
    params: StatsQueryParams
  ): Promise<AggregatedStats[]> {
    const cacheKey = this.buildCacheKey('aggregated', cityFilter, params);

    // 嘗試從快取獲取
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    let result: AggregatedStats[];

    switch (params.granularity) {
      case 'hour':
        result = await this.getHourlyAggregation(cityFilter, startDate, endDate);
        break;
      case 'day':
        result = await this.getDailyAggregation(cityFilter, startDate, endDate);
        break;
      case 'week':
      case 'month':
      case 'year':
        result = await this.getPeriodAggregation(cityFilter, startDate, endDate, params.granularity);
        break;
      default:
        result = await this.getDailyAggregation(cityFilter, startDate, endDate);
    }

    // 寫入快取
    await redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL);

    return result;
  }

  /**
   * 每小時聚合
   */
  private async getHourlyAggregation(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedStats[]> {
    const cityWhere = this.buildCityWhereClause(cityFilter);

    const stats = await prisma.hourlyProcessingStats.groupBy({
      by: ['hour'],
      where: {
        ...cityWhere,
        hour: { gte: startDate, lte: endDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true,
        failed: true,
        totalProcessingTime: true
      },
      orderBy: { hour: 'asc' }
    });

    return stats.map(s => this.mapToAggregatedStats(
      s.hour.toISOString(),
      s._sum
    ));
  }

  /**
   * 每日聚合
   */
  private async getDailyAggregation(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedStats[]> {
    const cityWhere = this.buildCityWhereClause(cityFilter);

    const stats = await prisma.processingStatistics.groupBy({
      by: ['date'],
      where: {
        ...cityWhere,
        date: { gte: startDate, lte: endDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true,
        failed: true,
        totalProcessingTime: true,
        successCount: true
      },
      orderBy: { date: 'asc' }
    });

    return stats.map(s => this.mapToAggregatedStats(
      format(s.date, 'yyyy-MM-dd'),
      s._sum
    ));
  }

  /**
   * 週/月/年聚合
   */
  private async getPeriodAggregation(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date,
    granularity: 'week' | 'month' | 'year'
  ): Promise<AggregatedStats[]> {
    const dateFormat = this.getDateFormatSQL(granularity);
    const cityCondition = this.buildCitySQLCondition(cityFilter);

    const result = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        TO_CHAR(date, '${dateFormat}') as period,
        SUM(total_processed) as total_processed,
        SUM(auto_approved) as auto_approved,
        SUM(manual_reviewed) as manual_reviewed,
        SUM(escalated) as escalated,
        SUM(failed) as failed,
        SUM(total_processing_time) as total_processing_time,
        SUM(success_count) as success_count
      FROM processing_statistics
      WHERE date >= $1 AND date <= $2 ${cityCondition}
      GROUP BY TO_CHAR(date, '${dateFormat}')
      ORDER BY period ASC
    `, startDate, endDate, ...(cityFilter.isGlobalAdmin ? [] : [cityFilter.cityCodes]));

    return result.map(r => ({
      period: r.period,
      totalProcessed: parseInt(r.total_processed) || 0,
      autoApproved: parseInt(r.auto_approved) || 0,
      manualReviewed: parseInt(r.manual_reviewed) || 0,
      escalated: parseInt(r.escalated) || 0,
      failed: parseInt(r.failed) || 0,
      avgProcessingTime: r.total_processed
        ? parseFloat(r.total_processing_time) / parseInt(r.total_processed)
        : 0,
      successRate: r.total_processed
        ? (parseInt(r.success_count) / parseInt(r.total_processed)) * 100
        : 0,
      automationRate: r.total_processed
        ? (parseInt(r.auto_approved) / parseInt(r.total_processed)) * 100
        : 0
    }));
  }

  /**
   * 獲取城市統計匯總
   */
  async getCityStatsSummary(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<CityStatsSummary[]> {
    const cacheKey = `city-stats-summary:${this.getCityFilterKey(cityFilter)}:${format(startDate, 'yyyy-MM-dd')}:${format(endDate, 'yyyy-MM-dd')}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const cityWhere = this.buildCityWhereClause(cityFilter);

    // 當前期間統計
    const currentStats = await prisma.processingStatistics.groupBy({
      by: ['cityCode'],
      where: {
        ...cityWhere,
        date: { gte: startDate, lte: endDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true,
        failed: true,
        totalProcessingTime: true,
        successCount: true
      }
    });

    // 上一期間統計（用於趨勢計算）
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodLength);
    const prevEndDate = new Date(startDate.getTime() - 1);

    const prevStats = await prisma.processingStatistics.groupBy({
      by: ['cityCode'],
      where: {
        ...cityWhere,
        date: { gte: prevStartDate, lte: prevEndDate }
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true
      }
    });

    const prevStatsMap = new Map(
      prevStats.map(s => [s.cityCode, s._sum])
    );

    // 獲取城市名稱
    const cities = await prisma.city.findMany({
      where: { code: { in: currentStats.map(s => s.cityCode) } },
      select: { code: true, name: true }
    });
    const cityNameMap = new Map(cities.map(c => [c.code, c.name]));

    const result: CityStatsSummary[] = currentStats.map(s => {
      const prev = prevStatsMap.get(s.cityCode);
      const totalProcessed = s._sum.totalProcessed || 0;
      const autoApproved = s._sum.autoApproved || 0;

      return {
        cityCode: s.cityCode,
        cityName: cityNameMap.get(s.cityCode) || s.cityCode,
        totalProcessed,
        autoApproved,
        manualReviewed: s._sum.manualReviewed || 0,
        escalated: s._sum.escalated || 0,
        failed: s._sum.failed || 0,
        avgProcessingTime: totalProcessed
          ? (s._sum.totalProcessingTime || 0) / totalProcessed
          : 0,
        successRate: totalProcessed
          ? ((s._sum.successCount || 0) / totalProcessed) * 100
          : 0,
        automationRate: totalProcessed
          ? (autoApproved / totalProcessed) * 100
          : 0,
        trend: {
          processedChange: this.calculatePercentageChange(
            totalProcessed,
            prev?.totalProcessed || 0
          ),
          automationChange: this.calculatePercentageChange(
            autoApproved,
            prev?.autoApproved || 0
          )
        }
      };
    });

    await redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL);

    return result;
  }

  /**
   * 獲取即時統計（當日）
   */
  async getRealtimeStats(cityFilter: CityFilter): Promise<{
    todayStats: DailyProcessingStats | null;
    hourlyTrend: { hour: string; count: number }[];
  }> {
    const cacheKey = `realtime-stats:${this.getCityFilterKey(cityFilter)}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const today = startOfDay(new Date());
    const cityWhere = this.buildCityWhereClause(cityFilter);

    // 獲取今日統計
    const todayStatsRaw = await prisma.processingStatistics.aggregate({
      where: {
        ...cityWhere,
        date: today
      },
      _sum: {
        totalProcessed: true,
        autoApproved: true,
        manualReviewed: true,
        escalated: true,
        failed: true,
        totalProcessingTime: true,
        successCount: true
      }
    });

    // 獲取今日每小時趨勢
    const hourlyTrend = await prisma.hourlyProcessingStats.groupBy({
      by: ['hour'],
      where: {
        ...cityWhere,
        hour: { gte: today }
      },
      _sum: { totalProcessed: true },
      orderBy: { hour: 'asc' }
    });

    const result = {
      todayStats: todayStatsRaw._sum.totalProcessed ? {
        cityCode: cityFilter.isGlobalAdmin ? 'ALL' : cityFilter.cityCodes.join(','),
        date: format(today, 'yyyy-MM-dd'),
        totalProcessed: todayStatsRaw._sum.totalProcessed || 0,
        autoApproved: todayStatsRaw._sum.autoApproved || 0,
        manualReviewed: todayStatsRaw._sum.manualReviewed || 0,
        escalated: todayStatsRaw._sum.escalated || 0,
        failed: todayStatsRaw._sum.failed || 0,
        totalProcessingTime: todayStatsRaw._sum.totalProcessingTime || 0,
        avgProcessingTime: todayStatsRaw._sum.totalProcessed
          ? (todayStatsRaw._sum.totalProcessingTime || 0) / todayStatsRaw._sum.totalProcessed
          : null,
        minProcessingTime: null,
        maxProcessingTime: null,
        successCount: todayStatsRaw._sum.successCount || 0,
        successRate: todayStatsRaw._sum.totalProcessed
          ? ((todayStatsRaw._sum.successCount || 0) / todayStatsRaw._sum.totalProcessed) * 100
          : null,
        automationRate: todayStatsRaw._sum.totalProcessed
          ? ((todayStatsRaw._sum.autoApproved || 0) / todayStatsRaw._sum.totalProcessed) * 100
          : null,
        lastUpdatedAt: new Date().toISOString()
      } : null,
      hourlyTrend: hourlyTrend.map(h => ({
        hour: format(h.hour, 'HH:00'),
        count: h._sum.totalProcessed || 0
      }))
    };

    await redis.set(cacheKey, JSON.stringify(result), 'EX', this.REALTIME_CACHE_TTL);

    return result;
  }

  /**
   * 數據一致性校驗與修正
   */
  async verifyAndReconcile(
    cityCode: string,
    date: Date,
    executedBy: string = 'SYSTEM'
  ): Promise<ReconciliationResult> {
    const stats = await prisma.processingStatistics.findUnique({
      where: { cityCode_date: { cityCode, date } }
    });

    const startOfDayDate = startOfDay(date);
    const endOfDayDate = endOfDay(date);

    // 從原始文件數據計算實際值
    const actualCounts = await prisma.document.groupBy({
      by: ['status', 'autoApproved'],
      where: {
        cityCode,
        processedAt: { gte: startOfDayDate, lte: endOfDayDate }
      },
      _count: { id: true },
      _sum: { processingDuration: true }
    });

    // 計算實際統計
    const actual = {
      totalProcessed: 0,
      autoApproved: 0,
      manualReviewed: 0,
      escalated: 0,
      failed: 0,
      totalProcessingTime: 0,
      successCount: 0
    };

    for (const row of actualCounts) {
      actual.totalProcessed += row._count.id;
      actual.totalProcessingTime += row._sum.processingDuration || 0;

      if (row.status === 'FAILED') {
        actual.failed += row._count.id;
      } else {
        actual.successCount += row._count.id;
        if (row.status === 'ESCALATED') {
          actual.escalated += row._count.id;
        } else if (row.autoApproved) {
          actual.autoApproved += row._count.id;
        } else {
          actual.manualReviewed += row._count.id;
        }
      }
    }

    // 比對並記錄差異
    const discrepancies: StatDiscrepancy[] = [];

    if (stats) {
      const fields = [
        'totalProcessed', 'autoApproved', 'manualReviewed',
        'escalated', 'failed', 'totalProcessingTime', 'successCount'
      ];

      for (const field of fields) {
        const expected = actual[field as keyof typeof actual];
        const statsValue = stats[field as keyof typeof stats] as number;

        if (expected !== statsValue) {
          discrepancies.push({
            field,
            expected,
            actual: statsValue,
            difference: expected - statsValue
          });
        }
      }
    }

    const needsCorrection = discrepancies.length > 0 || !stats;
    let corrected = false;

    if (needsCorrection) {
      // 執行修正
      await this.recalculateFromSource(cityCode, date);
      corrected = true;
    }

    // 記錄審計日誌
    const auditLog = await prisma.statisticsAuditLog.create({
      data: {
        cityCode,
        date,
        auditType: executedBy === 'SYSTEM' ? 'SCHEDULED' : 'MANUAL',
        verified: discrepancies.length === 0,
        discrepancies: discrepancies.length > 0 ? discrepancies : null,
        corrections: corrected ? actual : null,
        executedBy
      }
    });

    return {
      verified: discrepancies.length === 0,
      discrepancies,
      corrected,
      auditLogId: auditLog.id
    };
  }

  /**
   * 從原始數據重新計算統計
   */
  private async recalculateFromSource(cityCode: string, date: Date): Promise<void> {
    const startOfDayDate = startOfDay(date);
    const endOfDayDate = endOfDay(date);

    const documents = await prisma.document.findMany({
      where: {
        cityCode,
        processedAt: { gte: startOfDayDate, lte: endOfDayDate }
      },
      select: {
        status: true,
        autoApproved: true,
        processingDuration: true
      }
    });

    const stats = {
      totalProcessed: documents.length,
      autoApproved: documents.filter(d => d.autoApproved).length,
      manualReviewed: documents.filter(
        d => !d.autoApproved && d.status === 'APPROVED'
      ).length,
      escalated: documents.filter(d => d.status === 'ESCALATED').length,
      failed: documents.filter(d => d.status === 'FAILED').length,
      totalProcessingTime: documents.reduce(
        (sum, d) => sum + (d.processingDuration || 0),
        0
      ),
      successCount: documents.filter(d => d.status !== 'FAILED').length
    };

    const processingTimes = documents
      .map(d => d.processingDuration)
      .filter((t): t is number => t !== null);

    await prisma.processingStatistics.upsert({
      where: { cityCode_date: { cityCode, date } },
      create: {
        cityCode,
        date,
        ...stats,
        avgProcessingTime: stats.totalProcessed > 0
          ? stats.totalProcessingTime / stats.totalProcessed
          : null,
        successRate: stats.totalProcessed > 0
          ? (stats.successCount / stats.totalProcessed) * 100
          : null,
        automationRate: stats.totalProcessed > 0
          ? (stats.autoApproved / stats.totalProcessed) * 100
          : null,
        minProcessingTime: processingTimes.length > 0
          ? Math.min(...processingTimes)
          : null,
        maxProcessingTime: processingTimes.length > 0
          ? Math.max(...processingTimes)
          : null
      },
      update: {
        ...stats,
        avgProcessingTime: stats.totalProcessed > 0
          ? stats.totalProcessingTime / stats.totalProcessed
          : null,
        successRate: stats.totalProcessed > 0
          ? (stats.successCount / stats.totalProcessed) * 100
          : null,
        automationRate: stats.totalProcessed > 0
          ? (stats.autoApproved / stats.totalProcessed) * 100
          : null,
        minProcessingTime: processingTimes.length > 0
          ? Math.min(...processingTimes)
          : null,
        maxProcessingTime: processingTimes.length > 0
          ? Math.max(...processingTimes)
          : null,
        lastUpdatedAt: new Date(),
        version: { increment: 1 }
      }
    });
  }

  // ==================== Helper Methods ====================

  private mapToAggregatedStats(period: string, sum: any): AggregatedStats {
    const totalProcessed = sum.totalProcessed || 0;
    const successCount = sum.successCount || (totalProcessed - (sum.failed || 0));

    return {
      period,
      totalProcessed,
      autoApproved: sum.autoApproved || 0,
      manualReviewed: sum.manualReviewed || 0,
      escalated: sum.escalated || 0,
      failed: sum.failed || 0,
      avgProcessingTime: totalProcessed
        ? (sum.totalProcessingTime || 0) / totalProcessed
        : 0,
      successRate: totalProcessed
        ? (successCount / totalProcessed) * 100
        : 0,
      automationRate: totalProcessed
        ? ((sum.autoApproved || 0) / totalProcessed) * 100
        : 0
    };
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

  private buildCitySQLCondition(cityFilter: CityFilter): string {
    if (cityFilter.isGlobalAdmin) {
      return '';
    }
    return 'AND city_code = ANY($3::text[])';
  }

  private getDateFormatSQL(granularity: 'week' | 'month' | 'year'): string {
    switch (granularity) {
      case 'week':
        return 'IYYY-IW';
      case 'month':
        return 'YYYY-MM';
      case 'year':
        return 'YYYY';
    }
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  private getCityFilterKey(cityFilter: CityFilter): string {
    if (cityFilter.isGlobalAdmin) {
      return 'global';
    }
    return cityFilter.cityCodes.sort().join(',');
  }

  private buildCacheKey(
    type: string,
    cityFilter: CityFilter,
    params: StatsQueryParams
  ): string {
    return `stats:${type}:${params.granularity}:${this.getCityFilterKey(cityFilter)}:${params.startDate}:${params.endDate}`;
  }

  private async invalidateRelatedCaches(cityCode: string): Promise<void> {
    const patterns = [
      `stats:*:*${cityCode}*`,
      `stats:*:global:*`,
      `realtime-stats:*`,
      `city-stats-summary:*`,
      `dashboard:stats:*`
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  }
}

export const processingStatsService = new ProcessingStatsService();
```

---

## Event Handler

```typescript
// src/events/handlers/document-processed.handler.ts

import { processingStatsService } from '@/services/processing-stats.service';
import { ProcessingResultType, ProcessingResultEvent } from '@/types/processing-statistics';
import { logger } from '@/lib/logger';

/**
 * 文件處理完成事件處理器
 */
export async function handleDocumentProcessed(
  event: ProcessingResultEvent
): Promise<void> {
  try {
    // 確定處理結果類型
    const resultType = mapStatusToResultType(event.status, event.autoApproved);

    // 記錄處理結果
    await processingStatsService.recordProcessingResult(
      event.cityCode,
      resultType,
      event.processingDurationSeconds
    );

    logger.info('Processing stats recorded', {
      documentId: event.documentId,
      cityCode: event.cityCode,
      resultType,
      processingTime: event.processingDurationSeconds
    });
  } catch (error) {
    logger.error('Failed to record processing stats', {
      documentId: event.documentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // 不要重新拋出錯誤，避免影響主流程
    // 統計記錄失敗不應阻塞文件處理流程
  }
}

/**
 * 將文件狀態映射到處理結果類型
 */
function mapStatusToResultType(
  status: string,
  autoApproved: boolean
): ProcessingResultType {
  switch (status) {
    case 'FAILED':
      return 'FAILED';
    case 'ESCALATED':
      return 'ESCALATED';
    default:
      return autoApproved ? 'AUTO_APPROVED' : 'MANUAL_REVIEWED';
  }
}

// 事件訂閱器（可選，根據事件系統實現）
export function registerDocumentProcessedHandler(): void {
  // 例如使用 EventEmitter
  // eventBus.on('document:processed', handleDocumentProcessed);
}
```

---

## API Routes

### Processing Statistics Endpoint

```typescript
// src/app/api/statistics/processing/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { processingStatsService } from '@/services/processing-stats.service';
import { StatsQueryParams, TimeGranularity } from '@/types/processing-statistics';
import { parseISO, subDays, isValid } from 'date-fns';

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url);

      // Parse query parameters
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');
      const granularity = (searchParams.get('granularity') || 'day') as TimeGranularity;

      // Validate and set default dates
      const endDate = endDateParam && isValid(parseISO(endDateParam))
        ? parseISO(endDateParam)
        : new Date();

      const startDate = startDateParam && isValid(parseISO(startDateParam))
        ? parseISO(startDateParam)
        : subDays(endDate, 30);

      // Validate granularity
      const validGranularities: TimeGranularity[] = ['hour', 'day', 'week', 'month', 'year'];
      if (!validGranularities.includes(granularity)) {
        return NextResponse.json(
          { success: false, error: 'Invalid granularity parameter' },
          { status: 400 }
        );
      }

      const params: StatsQueryParams = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        granularity
      };

      const stats = await processingStatsService.getAggregatedStats(cityFilter, params);

      return NextResponse.json({
        success: true,
        data: stats,
        meta: {
          granularity,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalDataPoints: stats.length,
          cacheHit: false // Would be set by service if applicable
        }
      });
    } catch (error) {
      console.error('Processing stats error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch processing statistics' },
        { status: 500 }
      );
    }
  });
}
```

### City Summary Endpoint

```typescript
// src/app/api/statistics/processing/cities/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { processingStatsService } from '@/services/processing-stats.service';
import { parseISO, subDays, isValid } from 'date-fns';

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
        : subDays(endDate, 30);

      const summary = await processingStatsService.getCityStatsSummary(
        cityFilter,
        startDate,
        endDate
      );

      return NextResponse.json({
        success: true,
        data: summary,
        meta: {
          period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          cityCount: summary.length
        }
      });
    } catch (error) {
      console.error('City stats summary error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch city statistics summary' },
        { status: 500 }
      );
    }
  });
}
```

### Realtime Stats Endpoint

```typescript
// src/app/api/statistics/processing/realtime/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { processingStatsService } from '@/services/processing-stats.service';

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const realtimeStats = await processingStatsService.getRealtimeStats(cityFilter);

      return NextResponse.json({
        success: true,
        data: realtimeStats
      });
    } catch (error) {
      console.error('Realtime stats error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch realtime statistics' },
        { status: 500 }
      );
    }
  });
}
```

### Reconciliation Endpoint

```typescript
// src/app/api/statistics/processing/reconcile/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { processingStatsService } from '@/services/processing-stats.service';
import { parseISO, isValid } from 'date-fns';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const body = await req.json();
      const { cityCode, date } = body;

      // Validate parameters
      if (!cityCode || !date) {
        return NextResponse.json(
          { success: false, error: 'cityCode and date are required' },
          { status: 400 }
        );
      }

      const parsedDate = parseISO(date);
      if (!isValid(parsedDate)) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format' },
          { status: 400 }
        );
      }

      // Check city access
      if (!cityFilter.isGlobalAdmin && !cityFilter.cityCodes.includes(cityCode)) {
        return NextResponse.json(
          { success: false, error: 'Access denied to city' },
          { status: 403 }
        );
      }

      // Get user info
      const session = await getServerSession(authOptions);
      const executedBy = session?.user?.id || 'UNKNOWN';

      const result = await processingStatsService.verifyAndReconcile(
        cityCode,
        parsedDate,
        executedBy
      );

      return NextResponse.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Reconciliation error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to reconcile statistics' },
        { status: 500 }
      );
    }
  });
}
```

---

## Scheduled Jobs

### Daily Reconciliation Job

```typescript
// src/jobs/daily-stats-reconciliation.job.ts

import { processingStatsService } from '@/services/processing-stats.service';
import { prisma } from '@/lib/prisma';
import { subDays, format } from 'date-fns';
import { logger } from '@/lib/logger';

interface ReconciliationJobResult {
  date: string;
  citiesProcessed: number;
  discrepanciesFound: number;
  correctionsMade: number;
  errors: string[];
}

/**
 * 每日統計校驗任務
 * 建議於每日凌晨 2:00 執行
 */
export async function runDailyReconciliation(): Promise<ReconciliationJobResult> {
  const yesterday = subDays(new Date(), 1);
  const dateStr = format(yesterday, 'yyyy-MM-dd');

  logger.info('Starting daily stats reconciliation', { date: dateStr });

  // Get all cities
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { code: true }
  });

  const result: ReconciliationJobResult = {
    date: dateStr,
    citiesProcessed: 0,
    discrepanciesFound: 0,
    correctionsMade: 0,
    errors: []
  };

  for (const city of cities) {
    try {
      const reconcileResult = await processingStatsService.verifyAndReconcile(
        city.code,
        yesterday,
        'SYSTEM'
      );

      result.citiesProcessed++;

      if (reconcileResult.discrepancies.length > 0) {
        result.discrepanciesFound += reconcileResult.discrepancies.length;
      }

      if (reconcileResult.corrected) {
        result.correctionsMade++;
      }
    } catch (error) {
      const errorMsg = `Failed to reconcile ${city.code}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      logger.error(errorMsg);
    }
  }

  logger.info('Daily stats reconciliation completed', result);

  return result;
}

/**
 * 批量歷史數據校驗
 * 用於初始化或修復
 */
export async function runHistoricalReconciliation(
  startDate: Date,
  endDate: Date,
  cityCodes?: string[]
): Promise<void> {
  const cities = cityCodes
    ? await prisma.city.findMany({
        where: { code: { in: cityCodes } },
        select: { code: true }
      })
    : await prisma.city.findMany({
        where: { isActive: true },
        select: { code: true }
      });

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    for (const city of cities) {
      try {
        await processingStatsService.verifyAndReconcile(
          city.code,
          currentDate,
          'SYSTEM'
        );
      } catch (error) {
        logger.error('Historical reconciliation error', {
          cityCode: city.code,
          date: format(currentDate, 'yyyy-MM-dd'),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }
}
```

### Cache Warming Job

```typescript
// src/jobs/stats-cache-warming.job.ts

import { processingStatsService } from '@/services/processing-stats.service';
import { prisma } from '@/lib/prisma';
import { subDays, subMonths, format } from 'date-fns';
import { logger } from '@/lib/logger';

/**
 * 快取預熱任務
 * 建議於每日凌晨 3:00 執行
 */
export async function warmStatsCache(): Promise<void> {
  logger.info('Starting stats cache warming');

  // Get active cities
  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { code: true }
  });

  const now = new Date();
  const periods = [
    { start: subDays(now, 7), end: now, granularity: 'day' as const },
    { start: subDays(now, 30), end: now, granularity: 'day' as const },
    { start: subMonths(now, 3), end: now, granularity: 'week' as const },
    { start: subMonths(now, 12), end: now, granularity: 'month' as const }
  ];

  // Warm global cache
  for (const period of periods) {
    try {
      await processingStatsService.getAggregatedStats(
        { isGlobalAdmin: true, cityCodes: [] },
        {
          startDate: period.start.toISOString(),
          endDate: period.end.toISOString(),
          granularity: period.granularity
        }
      );
    } catch (error) {
      logger.error('Cache warming error (global)', {
        period: period.granularity,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Warm per-city cache for common periods
  for (const city of cities) {
    try {
      // Last 30 days daily stats
      await processingStatsService.getAggregatedStats(
        { isGlobalAdmin: false, cityCodes: [city.code] },
        {
          startDate: subDays(now, 30).toISOString(),
          endDate: now.toISOString(),
          granularity: 'day'
        }
      );
    } catch (error) {
      logger.error('Cache warming error', {
        cityCode: city.code,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  logger.info('Stats cache warming completed');
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/services/__tests__/processing-stats.service.test.ts

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProcessingStatsService } from '../processing-stats.service';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { CityFilter } from '@/middleware/city-filter';

vi.mock('@/lib/prisma');
vi.mock('@/lib/redis');

describe('ProcessingStatsService', () => {
  let service: ProcessingStatsService;
  const mockCityFilter: CityFilter = {
    isGlobalAdmin: false,
    cityCodes: ['TPE']
  };

  beforeEach(() => {
    service = new ProcessingStatsService();
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
    vi.mocked(redis.del).mockResolvedValue(0);
    vi.mocked(redis.keys).mockResolvedValue([]);
  });

  describe('recordProcessingResult', () => {
    it('should record AUTO_APPROVED result correctly', async () => {
      vi.mocked(redis.set).mockResolvedValueOnce('OK'); // Lock acquired
      vi.mocked(prisma.$executeRaw).mockResolvedValue(1);

      await service.recordProcessingResult('TPE', 'AUTO_APPROVED', 30);

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should handle concurrent updates with optimistic lock', async () => {
      vi.mocked(redis.set).mockResolvedValueOnce(null); // Lock not acquired

      vi.mocked(prisma.processingStatistics.findUnique).mockResolvedValue({
        cityCode: 'TPE',
        date: new Date(),
        totalProcessed: 100,
        version: 5
      } as any);

      vi.mocked(prisma.processingStatistics.updateMany).mockResolvedValue({
        count: 1
      });

      await service.recordProcessingResult('TPE', 'AUTO_APPROVED', 30);

      expect(prisma.processingStatistics.updateMany).toHaveBeenCalled();
    });

    it('should retry on version conflict', async () => {
      vi.mocked(redis.set).mockResolvedValueOnce(null);

      vi.mocked(prisma.processingStatistics.findUnique)
        .mockResolvedValue({
          cityCode: 'TPE',
          date: new Date(),
          totalProcessed: 100,
          version: 5
        } as any);

      vi.mocked(prisma.processingStatistics.updateMany)
        .mockResolvedValueOnce({ count: 0 }) // First attempt: conflict
        .mockResolvedValueOnce({ count: 1 }); // Second attempt: success

      await service.recordProcessingResult('TPE', 'AUTO_APPROVED', 30);

      expect(prisma.processingStatistics.updateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAggregatedStats', () => {
    it('should return cached data if available', async () => {
      const cachedData = [
        { period: '2025-01-01', totalProcessed: 100 }
      ];
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getAggregatedStats(mockCityFilter, {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        granularity: 'day'
      });

      expect(result).toEqual(cachedData);
      expect(prisma.processingStatistics.groupBy).not.toHaveBeenCalled();
    });

    it('should calculate correct aggregations', async () => {
      vi.mocked(prisma.processingStatistics.groupBy).mockResolvedValue([
        {
          date: new Date('2025-01-01'),
          _sum: {
            totalProcessed: 100,
            autoApproved: 80,
            manualReviewed: 15,
            escalated: 3,
            failed: 2,
            totalProcessingTime: 3000,
            successCount: 98
          }
        }
      ] as any);

      const result = await service.getAggregatedStats(mockCityFilter, {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        granularity: 'day'
      });

      expect(result[0].totalProcessed).toBe(100);
      expect(result[0].automationRate).toBe(80);
      expect(result[0].successRate).toBe(98);
      expect(result[0].avgProcessingTime).toBe(30);
    });
  });

  describe('verifyAndReconcile', () => {
    it('should detect discrepancies', async () => {
      vi.mocked(prisma.processingStatistics.findUnique).mockResolvedValue({
        totalProcessed: 100,
        autoApproved: 80
      } as any);

      vi.mocked(prisma.document.groupBy).mockResolvedValue([
        {
          status: 'APPROVED',
          autoApproved: true,
          _count: { id: 85 },
          _sum: { processingDuration: 2500 }
        },
        {
          status: 'APPROVED',
          autoApproved: false,
          _count: { id: 10 },
          _sum: { processingDuration: 500 }
        }
      ] as any);

      vi.mocked(prisma.statisticsAuditLog.create).mockResolvedValue({ id: 'audit-1' } as any);
      vi.mocked(prisma.processingStatistics.upsert).mockResolvedValue({} as any);

      const result = await service.verifyAndReconcile('TPE', new Date('2025-01-01'));

      expect(result.verified).toBe(false);
      expect(result.discrepancies.length).toBeGreaterThan(0);
      expect(result.corrected).toBe(true);
    });

    it('should verify correctly when data matches', async () => {
      vi.mocked(prisma.processingStatistics.findUnique).mockResolvedValue({
        totalProcessed: 95,
        autoApproved: 85,
        manualReviewed: 10,
        escalated: 0,
        failed: 0,
        totalProcessingTime: 3000,
        successCount: 95
      } as any);

      vi.mocked(prisma.document.groupBy).mockResolvedValue([
        {
          status: 'APPROVED',
          autoApproved: true,
          _count: { id: 85 },
          _sum: { processingDuration: 2500 }
        },
        {
          status: 'APPROVED',
          autoApproved: false,
          _count: { id: 10 },
          _sum: { processingDuration: 500 }
        }
      ] as any);

      vi.mocked(prisma.statisticsAuditLog.create).mockResolvedValue({ id: 'audit-1' } as any);

      const result = await service.verifyAndReconcile('TPE', new Date('2025-01-01'));

      expect(result.verified).toBe(true);
      expect(result.discrepancies.length).toBe(0);
      expect(result.corrected).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
// src/app/api/statistics/processing/__tests__/route.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { format, subDays } from 'date-fns';

describe('Processing Statistics API', () => {
  beforeEach(async () => {
    await prisma.processingStatistics.deleteMany();
  });

  afterEach(async () => {
    await prisma.processingStatistics.deleteMany();
  });

  describe('GET /api/statistics/processing', () => {
    it('should return daily aggregated stats', async () => {
      // Seed test data
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.processingStatistics.create({
        data: {
          cityCode: 'TPE',
          date: today,
          totalProcessed: 100,
          autoApproved: 80,
          manualReviewed: 15,
          escalated: 3,
          failed: 2,
          totalProcessingTime: 3000,
          successCount: 98
        }
      });

      const startDate = format(subDays(today, 1), 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');

      const request = new NextRequest(
        `http://localhost/api/statistics/processing?startDate=${startDate}&endDate=${endDate}&granularity=day`
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0].totalProcessed).toBe(100);
    });

    it('should support weekly aggregation', async () => {
      const request = new NextRequest(
        'http://localhost/api/statistics/processing?granularity=week'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.meta.granularity).toBe('week');
    });

    it('should respect city filter', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.processingStatistics.createMany({
        data: [
          { cityCode: 'TPE', date: today, totalProcessed: 100 },
          { cityCode: 'KHH', date: today, totalProcessed: 50 }
        ]
      });

      const request = new NextRequest(
        'http://localhost/api/statistics/processing',
        { headers: { 'x-city-codes': 'TPE' } }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data[0].totalProcessed).toBe(100);
    });
  });
});
```

---

## Performance Considerations

### Caching Strategy

| Data Type | Cache TTL | Invalidation Trigger |
|-----------|-----------|---------------------|
| Aggregated Stats | 5 minutes | New processing result |
| Realtime Stats | 1 minute | New processing result |
| City Summary | 5 minutes | New processing result |
| Historical Data | 30 minutes | Manual reconciliation |

### Database Optimization

1. **Composite Indexes**: `(city_code, date)` for efficient range queries
2. **Partitioning**: Consider table partitioning by date for large datasets
3. **Materialized Views**: For frequently accessed weekly/monthly aggregations
4. **Atomic Operations**: Use database functions for concurrent updates

### Concurrency Handling

1. **Distributed Lock**: Redis-based lock for exclusive updates
2. **Optimistic Lock**: Version-based for conflict resolution
3. **Retry Logic**: Exponential backoff for failed updates
4. **Idempotency**: Event handlers designed for safe replay

---

## Security Considerations

### Access Control

1. **City-based Isolation**: Users can only view stats for authorized cities
2. **Role-based Access**: Only admins can trigger manual reconciliation
3. **API Rate Limiting**: Prevent excessive queries

### Data Integrity

1. **Version Control**: Track all updates with version numbers
2. **Audit Logging**: Record all reconciliation activities
3. **Immutable History**: Never delete historical statistics

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

### AC1: 處理結果記錄
- [x] `recordProcessingResult` 方法在文件處理完成時記錄統計
- [x] 累計城市的總處理量、自動通過量、人工審核量、升級處理量、失敗量
- [x] 支援增量更新模式

### AC2: 時間維度聚合
- [x] `getAggregatedStats` 支援按日、週、月、年聚合
- [x] API 支援 `granularity` 參數選擇聚合粒度
- [x] 小時級統計支援細粒度分析

### AC3: 即時更新
- [x] 統計數據在處理完成後立即更新
- [x] Redis 快取 TTL 設為 5 分鐘內失效
- [x] 即時統計 API 提供當日小時趨勢

### AC4: 數據準確性
- [x] `verifyAndReconcile` 方法校驗統計與原始記錄一致性
- [x] 自動修正機制處理數據不一致
- [x] 審計日誌記錄所有校驗和修正操作
- [x] 定期校驗排程確保長期數據準確

---

## File Structure

```
src/
├── types/
│   └── processing-statistics.ts           # Type definitions
├── services/
│   └── processing-stats.service.ts        # Business logic
├── events/
│   └── handlers/
│       └── document-processed.handler.ts  # Event handler
├── jobs/
│   ├── daily-stats-reconciliation.job.ts  # Scheduled reconciliation
│   └── stats-cache-warming.job.ts         # Cache warming
├── app/
│   └── api/
│       └── statistics/
│           └── processing/
│               ├── route.ts               # Main stats API
│               ├── cities/
│               │   └── route.ts           # City summary API
│               ├── realtime/
│               │   └── route.ts           # Realtime stats API
│               └── reconcile/
│                   └── route.ts           # Reconciliation API
prisma/
└── schema.prisma                          # Database models
```

---

## References

- [Story 7.7 Definition](../stories/7-7-city-processing-volume-tracking.md)
- [Epic 7: Reports Dashboard & Cost Tracking](../../03-epics/sections/epic-7-reports-dashboard-cost-tracking.md)
- [FR69: City Processing Volume Tracking](../../01-planning/prd/sections/functional-requirements.md)
- [Tech Spec Story 7-1: Processing Statistics Dashboard](./tech-spec-story-7-1.md)
