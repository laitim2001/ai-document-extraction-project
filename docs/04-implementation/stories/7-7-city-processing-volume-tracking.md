# Story 7.7: 城市處理數量追蹤

**Status:** ready-for-dev

---

## Story

**As a** 系統,
**I want** 按城市追蹤發票處理數量,
**So that** 可以進行成本分攤和績效評估。

---

## Acceptance Criteria

### AC1: 處理結果記錄

**Given** 發票處理完成
**When** 系統記錄處理結果
**Then** 累計該城市的處理數量統計
**And** 分別記錄：總處理量、自動通過量、人工審核量

### AC2: 時間維度聚合

**Given** 系統記錄處理量
**When** 按時間維度聚合
**Then** 支援按日、週、月、年查詢

### AC3: 即時更新

**Given** 新的發票完成處理
**When** 統計數據需要更新
**Then** 統計數據在 5 分鐘內反映最新狀態

### AC4: 數據準確性

**Given** 統計查詢
**When** 查詢特定時間範圍
**Then** 統計數據與原始記錄一致
**And** 無重複計算或遺漏

---

## Tasks / Subtasks

- [ ] **Task 1: 處理統計模型** (AC: #1)
  - [ ] 1.1 創建 `ProcessingStatistics` Prisma 模型
  - [ ] 1.2 設計表結構支援多維度聚合
  - [ ] 1.3 添加索引優化查詢效能
  - [ ] 1.4 創建 Database Migration

- [ ] **Task 2: 統計記錄服務** (AC: #1, #3)
  - [ ] 2.1 創建 `ProcessingStatsService`
  - [ ] 2.2 實現處理完成時的統計更新
  - [ ] 2.3 支援增量更新模式
  - [ ] 2.4 處理並發更新

- [ ] **Task 3: 事件觸發機制** (AC: #1, #3)
  - [ ] 3.1 監聽文件狀態變更事件
  - [ ] 3.2 在處理完成時觸發統計更新
  - [ ] 3.3 處理事件重複和失敗

- [ ] **Task 4: 聚合查詢 API** (AC: #2)
  - [ ] 4.1 創建 `GET /api/statistics/processing` 端點
  - [ ] 4.2 支援時間範圍參數
  - [ ] 4.3 支援聚合粒度參數（日/週/月/年）
  - [ ] 4.4 支援城市過濾

- [ ] **Task 5: 快取與效能** (AC: #3)
  - [ ] 5.1 實現 Redis 快取層
  - [ ] 5.2 設定快取失效策略
  - [ ] 5.3 實現快取預熱
  - [ ] 5.4 監控快取命中率

- [ ] **Task 6: 數據一致性** (AC: #4)
  - [ ] 6.1 創建統計校驗任務
  - [ ] 6.2 實現自動修正機制
  - [ ] 6.3 添加數據審計日誌
  - [ ] 6.4 設定定期校驗排程

- [ ] **Task 7: 測試** (AC: #1-4)
  - [ ] 7.1 單元測試統計計算
  - [ ] 7.2 測試並發更新
  - [ ] 7.3 測試聚合查詢準確性
  - [ ] 7.4 壓力測試

---

## Dev Notes

### 依賴項

- **Story 6.1**: 城市數據模型（cityCode 來源）
- **Story 2.6**: 處理路徑自動路由（處理完成事件）

### Architecture Compliance

```prisma
// prisma/schema.prisma - 處理統計模型
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

  // 成功率
  successCount        Int      @default(0) @map("success_count")
  successRate         Float?   @map("success_rate")

  // 元數據
  lastUpdatedAt       DateTime @default(now()) @map("last_updated_at")
  version             Int      @default(0)

  city                City     @relation(fields: [cityCode], references: [code])

  @@unique([cityCode, date])
  @@index([cityCode])
  @@index([date])
  @@index([cityCode, date])
  @@map("processing_statistics")
}

// 每小時統計（可選，用於更細粒度分析）
model HourlyProcessingStats {
  id                  String   @id @default(uuid())
  cityCode            String   @map("city_code")
  hour                DateTime @db.Timestamptz

  totalProcessed      Int      @default(0) @map("total_processed")
  autoApproved        Int      @default(0) @map("auto_approved")
  manualReviewed      Int      @default(0) @map("manual_reviewed")
  failed              Int      @default(0)

  createdAt           DateTime @default(now()) @map("created_at")

  @@unique([cityCode, hour])
  @@index([cityCode, hour])
  @@map("hourly_processing_stats")
}
```

```typescript
// src/types/processing-statistics.ts
export interface ProcessingStats {
  cityCode: string
  date: string
  totalProcessed: number
  autoApproved: number
  manualReviewed: number
  escalated: number
  failed: number
  avgProcessingTime: number | null
  successRate: number | null
}

export interface AggregatedStats {
  period: string  // 日期或期間標識
  totalProcessed: number
  autoApproved: number
  manualReviewed: number
  escalated: number
  failed: number
  avgProcessingTime: number
  successRate: number
  automationRate: number
}

export interface StatsQueryParams {
  cityCodes?: string[]
  startDate: string
  endDate: string
  granularity: 'hour' | 'day' | 'week' | 'month' | 'year'
}

export type ProcessingResultType =
  | 'AUTO_APPROVED'
  | 'MANUAL_REVIEWED'
  | 'ESCALATED'
  | 'FAILED'
```

```typescript
// src/services/processing-stats.service.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { CityFilter, buildCityWhereClause } from '@/middleware/city-filter'
import {
  ProcessingStats,
  AggregatedStats,
  StatsQueryParams,
  ProcessingResultType
} from '@/types/processing-statistics'

export class ProcessingStatsService {
  private readonly CACHE_TTL = 60 * 5 // 5 分鐘
  private readonly LOCK_TTL = 10 // 10 秒鎖定

  /**
   * 記錄處理結果
   * 在文件處理完成時調用
   */
  async recordProcessingResult(
    cityCode: string,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const lockKey = `stats:lock:${cityCode}:${today.toISOString()}`

    // 嘗試獲取鎖
    const locked = await redis.set(lockKey, '1', 'EX', this.LOCK_TTL, 'NX')
    if (!locked) {
      // 如果無法獲取鎖，使用樂觀鎖更新
      await this.updateWithOptimisticLock(cityCode, today, resultType, processingTimeSeconds)
      return
    }

    try {
      await this.updateStatistics(cityCode, today, resultType, processingTimeSeconds)
    } finally {
      await redis.del(lockKey)
    }

    // 清除相關快取
    await this.invalidateCache(cityCode, today)
  }

  private async updateStatistics(
    cityCode: string,
    date: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number
  ): Promise<void> {
    // 使用 upsert 確保記錄存在
    await prisma.processingStatistics.upsert({
      where: {
        cityCode_date: { cityCode, date }
      },
      create: {
        cityCode,
        date,
        totalProcessed: 1,
        autoApproved: resultType === 'AUTO_APPROVED' ? 1 : 0,
        manualReviewed: resultType === 'MANUAL_REVIEWED' ? 1 : 0,
        escalated: resultType === 'ESCALATED' ? 1 : 0,
        failed: resultType === 'FAILED' ? 1 : 0,
        totalProcessingTime: processingTimeSeconds,
        avgProcessingTime: processingTimeSeconds,
        successCount: resultType !== 'FAILED' ? 1 : 0,
        successRate: resultType !== 'FAILED' ? 100 : 0
      },
      update: {
        totalProcessed: { increment: 1 },
        autoApproved: resultType === 'AUTO_APPROVED' ? { increment: 1 } : undefined,
        manualReviewed: resultType === 'MANUAL_REVIEWED' ? { increment: 1 } : undefined,
        escalated: resultType === 'ESCALATED' ? { increment: 1 } : undefined,
        failed: resultType === 'FAILED' ? { increment: 1 } : undefined,
        totalProcessingTime: { increment: processingTimeSeconds },
        successCount: resultType !== 'FAILED' ? { increment: 1 } : undefined,
        lastUpdatedAt: new Date(),
        version: { increment: 1 }
      }
    })

    // 更新平均值和成功率（需要單獨計算）
    await this.recalculateAverages(cityCode, date)
  }

  private async updateWithOptimisticLock(
    cityCode: string,
    date: Date,
    resultType: ProcessingResultType,
    processingTimeSeconds: number,
    retries: number = 3
  ): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        const existing = await prisma.processingStatistics.findUnique({
          where: { cityCode_date: { cityCode, date } }
        })

        if (!existing) {
          await this.updateStatistics(cityCode, date, resultType, processingTimeSeconds)
          return
        }

        // 使用版本號進行樂觀鎖更新
        const result = await prisma.processingStatistics.updateMany({
          where: {
            cityCode,
            date,
            version: existing.version
          },
          data: {
            totalProcessed: { increment: 1 },
            autoApproved: resultType === 'AUTO_APPROVED' ? { increment: 1 } : undefined,
            manualReviewed: resultType === 'MANUAL_REVIEWED' ? { increment: 1 } : undefined,
            escalated: resultType === 'ESCALATED' ? { increment: 1 } : undefined,
            failed: resultType === 'FAILED' ? { increment: 1 } : undefined,
            totalProcessingTime: { increment: processingTimeSeconds },
            successCount: resultType !== 'FAILED' ? { increment: 1 } : undefined,
            lastUpdatedAt: new Date(),
            version: { increment: 1 }
          }
        })

        if (result.count > 0) {
          await this.recalculateAverages(cityCode, date)
          return
        }

        // 版本衝突，重試
      } catch (error) {
        if (i === retries - 1) throw error
      }
    }
  }

  private async recalculateAverages(cityCode: string, date: Date): Promise<void> {
    const stats = await prisma.processingStatistics.findUnique({
      where: { cityCode_date: { cityCode, date } }
    })

    if (!stats) return

    const avgProcessingTime = stats.totalProcessed > 0
      ? stats.totalProcessingTime / stats.totalProcessed
      : null

    const successRate = stats.totalProcessed > 0
      ? (stats.successCount / stats.totalProcessed) * 100
      : null

    await prisma.processingStatistics.update({
      where: { cityCode_date: { cityCode, date } },
      data: { avgProcessingTime, successRate }
    })
  }

  /**
   * 查詢聚合統計
   */
  async getAggregatedStats(
    cityFilter: CityFilter,
    params: StatsQueryParams
  ): Promise<AggregatedStats[]> {
    const cacheKey = this.buildCacheKey(cityFilter, params)

    // 嘗試從快取獲取
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const startDate = new Date(params.startDate)
    const endDate = new Date(params.endDate)

    let result: AggregatedStats[]

    if (params.granularity === 'day') {
      result = await this.getDailyStats(cityFilter, startDate, endDate)
    } else {
      result = await this.getPeriodStats(cityFilter, startDate, endDate, params.granularity)
    }

    // 寫入快取
    await redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL)

    return result
  }

  private async getDailyStats(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedStats[]> {
    const cityWhere = cityFilter.isGlobalAdmin
      ? {}
      : { cityCode: { in: cityFilter.cityCodes } }

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
    })

    return stats.map(s => ({
      period: s.date.toISOString().split('T')[0],
      totalProcessed: s._sum.totalProcessed || 0,
      autoApproved: s._sum.autoApproved || 0,
      manualReviewed: s._sum.manualReviewed || 0,
      escalated: s._sum.escalated || 0,
      failed: s._sum.failed || 0,
      avgProcessingTime: s._sum.totalProcessed
        ? (s._sum.totalProcessingTime || 0) / s._sum.totalProcessed
        : 0,
      successRate: s._sum.totalProcessed
        ? ((s._sum.successCount || 0) / s._sum.totalProcessed) * 100
        : 0,
      automationRate: s._sum.totalProcessed
        ? ((s._sum.autoApproved || 0) / s._sum.totalProcessed) * 100
        : 0
    }))
  }

  private async getPeriodStats(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date,
    granularity: 'week' | 'month' | 'year'
  ): Promise<AggregatedStats[]> {
    const dateFormat = granularity === 'week'
      ? 'IYYY-IW'
      : granularity === 'month'
        ? 'YYYY-MM'
        : 'YYYY'

    const cityCondition = cityFilter.isGlobalAdmin
      ? ''
      : `AND city_code = ANY($3::text[])`

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
      ORDER BY period
    `, startDate, endDate, ...(cityFilter.isGlobalAdmin ? [] : [cityFilter.cityCodes]))

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
    }))
  }

  /**
   * 數據一致性校驗
   */
  async verifyAndReconcile(cityCode: string, date: Date): Promise<{
    verified: boolean
    discrepancies: string[]
    corrected: boolean
  }> {
    const stats = await prisma.processingStatistics.findUnique({
      where: { cityCode_date: { cityCode, date } }
    })

    // 從原始數據計算
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const actualCounts = await prisma.document.groupBy({
      by: ['status'],
      where: {
        cityCode,
        processedAt: { gte: startOfDay, lte: endOfDay }
      },
      _count: { id: true }
    })

    // 比對並記錄差異
    const discrepancies: string[] = []
    let needsCorrection = false

    // ... 比對邏輯（省略詳細實現）

    if (needsCorrection && stats) {
      // 執行修正
      await this.recalculateFromSource(cityCode, date)
    }

    return {
      verified: discrepancies.length === 0,
      discrepancies,
      corrected: needsCorrection
    }
  }

  private async recalculateFromSource(cityCode: string, date: Date): Promise<void> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const documents = await prisma.document.findMany({
      where: {
        cityCode,
        processedAt: { gte: startOfDay, lte: endOfDay }
      },
      select: {
        status: true,
        autoApproved: true,
        processingDuration: true
      }
    })

    const stats = {
      totalProcessed: documents.length,
      autoApproved: documents.filter(d => d.autoApproved).length,
      manualReviewed: documents.filter(d => !d.autoApproved && d.status === 'APPROVED').length,
      escalated: documents.filter(d => d.status === 'ESCALATED').length,
      failed: documents.filter(d => d.status === 'FAILED').length,
      totalProcessingTime: documents.reduce((sum, d) => sum + (d.processingDuration || 0), 0),
      successCount: documents.filter(d => d.status !== 'FAILED').length
    }

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
        lastUpdatedAt: new Date(),
        version: { increment: 1 }
      }
    })
  }

  private async invalidateCache(cityCode: string, date: Date): Promise<void> {
    const patterns = [
      `stats:*:${cityCode}:*`,
      `stats:*:global:*`,
      `dashboard:stats:*`
    ]

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    }
  }

  private buildCacheKey(cityFilter: CityFilter, params: StatsQueryParams): string {
    const cityPart = cityFilter.isGlobalAdmin
      ? 'global'
      : cityFilter.cityCodes.sort().join(',')
    return `stats:${params.granularity}:${cityPart}:${params.startDate}:${params.endDate}`
  }
}

export const processingStatsService = new ProcessingStatsService()
```

```typescript
// src/events/document-processed.handler.ts
import { processingStatsService } from '@/services/processing-stats.service'
import { ProcessingResultType } from '@/types/processing-statistics'

interface DocumentProcessedEvent {
  documentId: string
  cityCode: string
  status: string
  autoApproved: boolean
  processingDurationSeconds: number
}

export async function handleDocumentProcessed(event: DocumentProcessedEvent) {
  let resultType: ProcessingResultType

  if (event.status === 'FAILED') {
    resultType = 'FAILED'
  } else if (event.status === 'ESCALATED') {
    resultType = 'ESCALATED'
  } else if (event.autoApproved) {
    resultType = 'AUTO_APPROVED'
  } else {
    resultType = 'MANUAL_REVIEWED'
  }

  await processingStatsService.recordProcessingResult(
    event.cityCode,
    resultType,
    event.processingDurationSeconds
  )
}
```

```typescript
// src/app/api/statistics/processing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter } from '@/middleware/city-filter'
import { processingStatsService } from '@/services/processing-stats.service'

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)

      const params = {
        startDate: searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: searchParams.get('endDate') || new Date().toISOString(),
        granularity: (searchParams.get('granularity') || 'day') as 'hour' | 'day' | 'week' | 'month' | 'year'
      }

      const stats = await processingStatsService.getAggregatedStats(cityFilter, params)

      return NextResponse.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('Processing stats error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch processing statistics' },
        { status: 500 }
      )
    }
  })
}
```

### 效能考量

- **增量更新**: 每次處理完成只更新當天統計，避免全表掃描
- **樂觀鎖**: 使用版本號處理並發更新
- **快取策略**: 聚合查詢結果快取 5 分鐘
- **索引優化**: 複合索引 (cityCode, date) 支援高效查詢
- **定期校驗**: 每日凌晨執行數據一致性校驗

### 安全考量

- **數據隔離**: 所有查詢自動應用城市過濾
- **審計追蹤**: 統計修正操作記錄日誌
- **版本控制**: 使用 version 欄位追蹤更新

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-77]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR69]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.7 |
| Story Key | 7-7-city-processing-volume-tracking |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR69 |
| Dependencies | Story 6.1, Story 2.6 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
