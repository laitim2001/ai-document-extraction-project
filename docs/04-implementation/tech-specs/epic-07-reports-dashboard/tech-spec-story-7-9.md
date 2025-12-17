# Tech Spec: Story 7-9 - 城市成本報表

## Overview

### Story Reference
- **Story ID**: 7.9
- **Story Key**: 7-9-city-cost-report
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: ready-for-dev

### User Story
**As a** 財務人員,
**I want** 查看城市級別的成本報表,
**So that** 我可以進行預算管理和成本控制。

### Dependencies
- **Story 7.7**: 城市處理數量追蹤
- **Story 7.8**: 城市 AI 成本追蹤
- **Story 6.3**: 區域經理跨城市訪問（權限模型）

### FR Coverage
- **FR71**: 城市成本報表

---

## Type Definitions

### Core Types

```typescript
// src/types/city-cost.ts

import { ApiProvider } from '@prisma/client';

/**
 * 城市成本報表數據
 */
export interface CityCostReport {
  cityCode: string;
  cityName: string;
  regionName?: string;

  // 處理量
  processingVolume: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;

  // 成本明細
  aiCost: number;       // AI API 成本
  laborCost: number;    // 人工成本（估算）
  totalCost: number;    // 總成本

  // 效率指標
  costPerDocument: number;       // 單位成本
  automationRate: number;        // 自動化率
  successRate: number;           // 成功率

  // 趨勢數據
  trend: {
    previousPeriodCost: number;
    costChangePercent: number;
    volumeChangePercent: number;
    costPerDocChangePercent: number;
    isAnomalous: boolean;
  };

  // 時間範圍
  period: {
    start: string;
    end: string;
  };
}

/**
 * 成本趨勢點
 */
export interface CostTrendPoint {
  period: string;  // YYYY-MM
  cityCode: string;
  cityName: string;
  aiCost: number;
  laborCost: number;
  totalCost: number;
  processingVolume: number;
  costPerDocument: number;
}

/**
 * 成本異常詳情
 */
export interface CostAnomalyDetail {
  cityCode: string;
  cityName: string;
  currentPeriod: {
    cost: number;
    volume: number;
    aiCost: number;
    laborCost: number;
    costPerDoc: number;
    apiCalls: number;
  };
  previousPeriod: {
    cost: number;
    volume: number;
    aiCost: number;
    laborCost: number;
    costPerDoc: number;
    apiCalls: number;
  };
  changes: {
    costChange: number;
    costChangePercent: number;
    volumeChange: number;
    volumeChangePercent: number;
    costPerDocChange: number;
    costPerDocChangePercent: number;
    aiCostChangePercent: number;
    laborCostChangePercent: number;
  };
  anomalyType: AnomalyType;
  severity: 'low' | 'medium' | 'high';
  possibleCauses: string[];
  recommendations: string[];
  affectedProviders?: {
    provider: ApiProvider;
    costChange: number;
    callsChange: number;
  }[];
}

/**
 * 異常類型
 */
export type AnomalyType =
  | 'volume_spike'           // 處理量激增
  | 'volume_drop'            // 處理量下降
  | 'cost_per_doc_increase'  // 單位成本上升
  | 'cost_per_doc_decrease'  // 單位成本下降
  | 'api_cost_spike'         // API 成本激增
  | 'labor_cost_spike'       // 人工成本激增
  | 'automation_rate_drop'   // 自動化率下降
  | 'unknown';               // 未知原因

/**
 * 人工成本配置
 */
export interface LaborCostConfig {
  costPerManualReview: number;  // 每筆人工審核成本
  costPerEscalation: number;    // 每筆升級處理成本
  overheadMultiplier: number;   // 間接費用倍率
  currency: string;
}

/**
 * 默認人工成本配置
 */
export const DEFAULT_LABOR_COST_CONFIG: LaborCostConfig = {
  costPerManualReview: 0.5,   // $0.50 per document
  costPerEscalation: 2.0,     // $2.00 per escalated case
  overheadMultiplier: 1.2,    // 20% overhead
  currency: 'USD'
};

/**
 * 異常檢測閾值
 */
export interface AnomalyThresholds {
  costChangePercent: number;       // 成本變化閾值
  volumeChangePercent: number;     // 處理量變化閾值
  costPerDocChangePercent: number; // 單位成本變化閾值
  automationRateDropPercent: number; // 自動化率下降閾值
}

/**
 * 默認異常閾值
 */
export const DEFAULT_ANOMALY_THRESHOLDS: AnomalyThresholds = {
  costChangePercent: 20,
  volumeChangePercent: 50,
  costPerDocChangePercent: 15,
  automationRateDropPercent: 10
};

/**
 * 成本報表查詢參數
 */
export interface CostReportQueryParams {
  startDate: string;
  endDate: string;
  cityCodes?: string[];
  regionCode?: string;
  includeAnomalyDetails?: boolean;
}

/**
 * 成本趨勢查詢參數
 */
export interface CostTrendQueryParams {
  months: number;       // 查詢月數
  cityCodes?: string[];
  regionCode?: string;
}
```

### API Response Types

```typescript
// src/types/api/city-cost-report.ts

import { CityCostReport, CostTrendPoint, CostAnomalyDetail } from '../city-cost';

/**
 * 城市成本報表 API 回應
 */
export interface CityCostReportResponse {
  success: boolean;
  data: CityCostReport[];
  meta: {
    totalCities: number;
    totalCost: number;
    totalVolume: number;
    period: { start: string; end: string };
    anomalyCount: number;
  };
}

/**
 * 成本趨勢 API 回應
 */
export interface CostTrendResponse {
  success: boolean;
  data: CostTrendPoint[];
  meta: {
    months: number;
    startMonth: string;
    endMonth: string;
  };
}

/**
 * 異常分析 API 回應
 */
export interface AnomalyAnalysisResponse {
  success: boolean;
  data: CostAnomalyDetail;
}
```

---

## Service Implementation

### City Cost Report Service

```typescript
// src/services/city-cost-report.service.ts

import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { CityFilter } from '@/middleware/city-filter';
import {
  CityCostReport,
  CostTrendPoint,
  CostAnomalyDetail,
  AnomalyType,
  DEFAULT_LABOR_COST_CONFIG,
  DEFAULT_ANOMALY_THRESHOLDS,
  LaborCostConfig,
  AnomalyThresholds
} from '@/types/city-cost';
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  differenceInDays
} from 'date-fns';

interface PeriodStats {
  volume: number;
  autoApproved: number;
  manualReviewed: number;
  escalated: number;
  failed: number;
  aiCost: number;
  apiCalls: number;
  laborCost: number;
  totalCost: number;
  costPerDoc: number;
  automationRate: number;
  successRate: number;
}

export class CityCostReportService {
  private readonly CACHE_TTL = 60 * 10; // 10 minutes
  private laborConfig: LaborCostConfig;
  private anomalyThresholds: AnomalyThresholds;

  constructor(
    laborConfig?: LaborCostConfig,
    anomalyThresholds?: AnomalyThresholds
  ) {
    this.laborConfig = laborConfig || DEFAULT_LABOR_COST_CONFIG;
    this.anomalyThresholds = anomalyThresholds || DEFAULT_ANOMALY_THRESHOLDS;
  }

  /**
   * 獲取城市成本報表
   */
  async getCityCostReport(
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): Promise<CityCostReport[]> {
    const cacheKey = this.buildCacheKey('report', cityFilter, startDate, endDate);

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 獲取城市列表
    const cities = await this.getCities(cityFilter);

    // 並行獲取各城市數據
    const reports = await Promise.all(
      cities.map(city => this.buildCityReport(city, startDate, endDate))
    );

    // 按總成本排序
    reports.sort((a, b) => b.totalCost - a.totalCost);

    await redis.set(cacheKey, JSON.stringify(reports), 'EX', this.CACHE_TTL);

    return reports;
  }

  /**
   * 構建單一城市報表
   */
  private async buildCityReport(
    city: { code: string; name: string; region?: { name: string } },
    startDate: Date,
    endDate: Date
  ): Promise<CityCostReport> {
    // 獲取當前期間統計
    const currentStats = await this.getPeriodStats(city.code, startDate, endDate);

    // 獲取上期統計（用於對比）
    const periodLength = differenceInDays(endDate, startDate);
    const prevStartDate = new Date(startDate.getTime() - periodLength * 24 * 60 * 60 * 1000);
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStats = await this.getPeriodStats(city.code, prevStartDate, prevEndDate);

    // 計算趨勢
    const costChangePercent = this.calculateChangePercent(
      currentStats.totalCost,
      prevStats.totalCost
    );
    const volumeChangePercent = this.calculateChangePercent(
      currentStats.volume,
      prevStats.volume
    );
    const costPerDocChangePercent = this.calculateChangePercent(
      currentStats.costPerDoc,
      prevStats.costPerDoc
    );

    // 判斷是否異常
    const isAnomalous = this.checkAnomaly(
      costChangePercent,
      volumeChangePercent,
      costPerDocChangePercent
    );

    return {
      cityCode: city.code,
      cityName: city.name,
      regionName: city.region?.name,
      processingVolume: currentStats.volume,
      autoApproved: currentStats.autoApproved,
      manualReviewed: currentStats.manualReviewed,
      escalated: currentStats.escalated,
      failed: currentStats.failed,
      aiCost: currentStats.aiCost,
      laborCost: currentStats.laborCost,
      totalCost: currentStats.totalCost,
      costPerDocument: currentStats.costPerDoc,
      automationRate: currentStats.automationRate,
      successRate: currentStats.successRate,
      trend: {
        previousPeriodCost: prevStats.totalCost,
        costChangePercent,
        volumeChangePercent,
        costPerDocChangePercent,
        isAnomalous
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    };
  }

  /**
   * 獲取期間統計數據
   */
  private async getPeriodStats(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<PeriodStats> {
    const [procStats, aiStats] = await Promise.all([
      // 處理量統計
      prisma.processingStatistics.aggregate({
        where: {
          cityCode,
          date: { gte: startDate, lte: endDate }
        },
        _sum: {
          totalProcessed: true,
          autoApproved: true,
          manualReviewed: true,
          escalated: true,
          failed: true
        }
      }),
      // AI 成本統計
      prisma.apiUsageLog.aggregate({
        where: {
          cityCode,
          createdAt: { gte: startDate, lte: endDate }
        },
        _sum: { estimatedCost: true },
        _count: { id: true }
      })
    ]);

    const volume = procStats._sum.totalProcessed || 0;
    const autoApproved = procStats._sum.autoApproved || 0;
    const manualReviewed = procStats._sum.manualReviewed || 0;
    const escalated = procStats._sum.escalated || 0;
    const failed = procStats._sum.failed || 0;
    const aiCost = aiStats._sum.estimatedCost || 0;
    const apiCalls = aiStats._count.id;

    // 計算人工成本
    const laborCost = this.calculateLaborCost(manualReviewed, escalated);
    const totalCost = aiCost + laborCost;

    return {
      volume,
      autoApproved,
      manualReviewed,
      escalated,
      failed,
      aiCost,
      apiCalls,
      laborCost,
      totalCost,
      costPerDoc: volume > 0 ? totalCost / volume : 0,
      automationRate: volume > 0 ? (autoApproved / volume) * 100 : 0,
      successRate: volume > 0 ? ((volume - failed) / volume) * 100 : 0
    };
  }

  /**
   * 計算人工成本
   */
  private calculateLaborCost(manualReviewed: number, escalated: number): number {
    const baseCost =
      manualReviewed * this.laborConfig.costPerManualReview +
      escalated * this.laborConfig.costPerEscalation;

    return baseCost * this.laborConfig.overheadMultiplier;
  }

  /**
   * 獲取成本趨勢
   */
  async getCostTrend(
    cityFilter: CityFilter,
    months: number = 6
  ): Promise<CostTrendPoint[]> {
    const cities = await this.getCities(cityFilter);
    const endDate = endOfMonth(new Date());
    const startDate = startOfMonth(subMonths(endDate, months - 1));

    // 獲取 AI 成本趨勢
    const aiCostTrend = await prisma.$queryRaw<{
      period: string;
      city_code: string;
      ai_cost: number;
    }[]>`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as period,
        city_code,
        SUM(estimated_cost) as ai_cost
      FROM api_usage_logs
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND city_code = ANY(${cities.map(c => c.code)})
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), city_code
      ORDER BY period, city_code
    `;

    // 獲取處理量統計
    const volumeTrend = await prisma.$queryRaw<{
      period: string;
      city_code: string;
      volume: bigint;
      manual_reviewed: bigint;
      escalated: bigint;
    }[]>`
      SELECT
        TO_CHAR(date, 'YYYY-MM') as period,
        city_code,
        SUM(total_processed) as volume,
        SUM(manual_reviewed) as manual_reviewed,
        SUM(escalated) as escalated
      FROM processing_statistics
      WHERE date >= ${startDate}
        AND date <= ${endDate}
        AND city_code = ANY(${cities.map(c => c.code)})
      GROUP BY TO_CHAR(date, 'YYYY-MM'), city_code
      ORDER BY period, city_code
    `;

    // 合併數據
    const cityMap = new Map(cities.map(c => [c.code, c.name]));
    const volumeMap = new Map<string, { volume: number; laborCost: number }>();

    for (const v of volumeTrend) {
      const key = `${v.period}-${v.city_code}`;
      const laborCost = this.calculateLaborCost(
        Number(v.manual_reviewed),
        Number(v.escalated)
      );
      volumeMap.set(key, {
        volume: Number(v.volume),
        laborCost
      });
    }

    return aiCostTrend.map(ai => {
      const key = `${ai.period}-${ai.city_code}`;
      const volumeData = volumeMap.get(key) || { volume: 0, laborCost: 0 };
      const totalCost = ai.ai_cost + volumeData.laborCost;

      return {
        period: ai.period,
        cityCode: ai.city_code,
        cityName: cityMap.get(ai.city_code) || ai.city_code,
        aiCost: ai.ai_cost,
        laborCost: volumeData.laborCost,
        totalCost,
        processingVolume: volumeData.volume,
        costPerDocument: volumeData.volume > 0 ? totalCost / volumeData.volume : 0
      };
    });
  }

  /**
   * 分析成本異常
   */
  async analyzeAnomaly(
    cityCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostAnomalyDetail> {
    const city = await prisma.city.findUnique({
      where: { code: cityCode },
      select: { code: true, name: true }
    });

    if (!city) {
      throw new Error('City not found');
    }

    // 當前期間統計
    const currentStats = await this.getPeriodStats(cityCode, startDate, endDate);

    // 上期統計
    const periodLength = differenceInDays(endDate, startDate);
    const prevStartDate = new Date(startDate.getTime() - periodLength * 24 * 60 * 60 * 1000);
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStats = await this.getPeriodStats(cityCode, prevStartDate, prevEndDate);

    // 獲取 API 供應商明細
    const providerBreakdown = await this.getProviderBreakdown(
      cityCode,
      startDate,
      endDate,
      prevStartDate,
      prevEndDate
    );

    // 計算變化
    const changes = {
      costChange: currentStats.totalCost - prevStats.totalCost,
      costChangePercent: this.calculateChangePercent(
        currentStats.totalCost,
        prevStats.totalCost
      ),
      volumeChange: currentStats.volume - prevStats.volume,
      volumeChangePercent: this.calculateChangePercent(
        currentStats.volume,
        prevStats.volume
      ),
      costPerDocChange: currentStats.costPerDoc - prevStats.costPerDoc,
      costPerDocChangePercent: this.calculateChangePercent(
        currentStats.costPerDoc,
        prevStats.costPerDoc
      ),
      aiCostChangePercent: this.calculateChangePercent(
        currentStats.aiCost,
        prevStats.aiCost
      ),
      laborCostChangePercent: this.calculateChangePercent(
        currentStats.laborCost,
        prevStats.laborCost
      )
    };

    // 判斷異常類型
    const anomalyType = this.determineAnomalyType(currentStats, prevStats, changes);
    const severity = this.determineSeverity(changes);
    const { possibleCauses, recommendations } = this.generateAnalysis(
      anomalyType,
      changes,
      currentStats,
      prevStats
    );

    return {
      cityCode: city.code,
      cityName: city.name,
      currentPeriod: {
        cost: currentStats.totalCost,
        volume: currentStats.volume,
        aiCost: currentStats.aiCost,
        laborCost: currentStats.laborCost,
        costPerDoc: currentStats.costPerDoc,
        apiCalls: currentStats.apiCalls
      },
      previousPeriod: {
        cost: prevStats.totalCost,
        volume: prevStats.volume,
        aiCost: prevStats.aiCost,
        laborCost: prevStats.laborCost,
        costPerDoc: prevStats.costPerDoc,
        apiCalls: prevStats.apiCalls
      },
      changes,
      anomalyType,
      severity,
      possibleCauses,
      recommendations,
      affectedProviders: providerBreakdown
    };
  }

  /**
   * 獲取 API 供應商成本變化
   */
  private async getProviderBreakdown(
    cityCode: string,
    startDate: Date,
    endDate: Date,
    prevStartDate: Date,
    prevEndDate: Date
  ) {
    const [current, previous] = await Promise.all([
      prisma.apiUsageLog.groupBy({
        by: ['provider'],
        where: {
          cityCode,
          createdAt: { gte: startDate, lte: endDate }
        },
        _sum: { estimatedCost: true },
        _count: { id: true }
      }),
      prisma.apiUsageLog.groupBy({
        by: ['provider'],
        where: {
          cityCode,
          createdAt: { gte: prevStartDate, lte: prevEndDate }
        },
        _sum: { estimatedCost: true },
        _count: { id: true }
      })
    ]);

    const prevMap = new Map(
      previous.map(p => [
        p.provider,
        { cost: p._sum.estimatedCost || 0, calls: p._count.id }
      ])
    );

    return current.map(c => {
      const prev = prevMap.get(c.provider) || { cost: 0, calls: 0 };
      return {
        provider: c.provider,
        costChange: (c._sum.estimatedCost || 0) - prev.cost,
        callsChange: c._count.id - prev.calls
      };
    });
  }

  /**
   * 判斷異常類型
   */
  private determineAnomalyType(
    current: PeriodStats,
    previous: PeriodStats,
    changes: any
  ): AnomalyType {
    const thresholds = this.anomalyThresholds;

    // 處理量變化
    if (changes.volumeChangePercent >= thresholds.volumeChangePercent) {
      return 'volume_spike';
    }
    if (changes.volumeChangePercent <= -thresholds.volumeChangePercent) {
      return 'volume_drop';
    }

    // 自動化率下降
    const automationChange = current.automationRate - previous.automationRate;
    if (automationChange <= -thresholds.automationRateDropPercent) {
      return 'automation_rate_drop';
    }

    // 單位成本變化
    if (changes.costPerDocChangePercent >= thresholds.costPerDocChangePercent) {
      return 'cost_per_doc_increase';
    }
    if (changes.costPerDocChangePercent <= -thresholds.costPerDocChangePercent) {
      return 'cost_per_doc_decrease';
    }

    // API 成本變化（排除處理量影響）
    if (changes.aiCostChangePercent >= thresholds.costChangePercent * 1.5 &&
        changes.volumeChangePercent < thresholds.volumeChangePercent) {
      return 'api_cost_spike';
    }

    // 人工成本變化
    if (changes.laborCostChangePercent >= thresholds.costChangePercent * 1.5 &&
        changes.volumeChangePercent < thresholds.volumeChangePercent) {
      return 'labor_cost_spike';
    }

    return 'unknown';
  }

  /**
   * 判斷嚴重程度
   */
  private determineSeverity(changes: any): 'low' | 'medium' | 'high' {
    const absChange = Math.abs(changes.costChangePercent);

    if (absChange >= 50) return 'high';
    if (absChange >= 30) return 'medium';
    return 'low';
  }

  /**
   * 生成異常分析
   */
  private generateAnalysis(
    anomalyType: AnomalyType,
    changes: any,
    current: PeriodStats,
    previous: PeriodStats
  ): { possibleCauses: string[]; recommendations: string[] } {
    const analyses: Record<AnomalyType, { possibleCauses: string[]; recommendations: string[] }> = {
      volume_spike: {
        possibleCauses: [
          '處理文件數量大幅增加',
          '可能是月末/季末文件積壓',
          '新客戶或新業務上線',
          '之前的積壓案件集中處理'
        ],
        recommendations: [
          '確認處理量增加是否為預期情況',
          '評估是否需要調整自動化策略以應對高峰',
          '檢查是否有重複處理的情況',
          '考慮增加處理能力或優化流程'
        ]
      },
      volume_drop: {
        possibleCauses: [
          '業務量自然下降',
          '系統問題導致文件未上傳',
          '客戶業務變化',
          '假日或季節性因素'
        ],
        recommendations: [
          '確認業務端是否正常運作',
          '檢查系統上傳和處理流程是否正常',
          '與業務團隊確認是否有預期的業務變化'
        ]
      },
      cost_per_doc_increase: {
        possibleCauses: [
          '自動化率下降，更多文件需要人工審核',
          '文件複雜度增加',
          'AI 服務價格調整',
          '映射規則匹配率下降'
        ],
        recommendations: [
          '檢查自動化率變化趨勢',
          '分析失敗和需要人工審核的案例',
          '評估映射規則是否需要優化',
          '確認 API 單價是否有變更'
        ]
      },
      cost_per_doc_decrease: {
        possibleCauses: [
          '自動化率提升',
          'AI 服務價格下調',
          '流程優化見效'
        ],
        recommendations: [
          '記錄成功經驗，考慮推廣到其他城市',
          '持續監控以確保改善的持續性'
        ]
      },
      api_cost_spike: {
        possibleCauses: [
          'API 調用次數異常增加',
          '可能存在重複調用',
          'AI 服務價格變更',
          '處理更複雜的文件導致 Token 用量增加'
        ],
        recommendations: [
          '檢查 API 調用日誌尋找異常模式',
          '確認沒有重複處理的情況',
          '驗證 API 單價配置是否正確',
          '分析 Token 用量變化原因'
        ]
      },
      labor_cost_spike: {
        possibleCauses: [
          '人工審核量大幅增加',
          '升級處理案件增加',
          '自動化率下降'
        ],
        recommendations: [
          '分析導致人工審核的原因',
          '檢查自動通過規則是否需要調整',
          '評估是否有新類型的文件導致問題'
        ]
      },
      automation_rate_drop: {
        possibleCauses: [
          '新的文件類型或格式',
          '映射規則失效',
          'OCR 識別率下降',
          '業務規則變更'
        ],
        recommendations: [
          '分析自動化失敗的具體原因',
          '更新或新增映射規則',
          '評估是否需要調整自動通過閾值'
        ]
      },
      unknown: {
        possibleCauses: [
          '成本變化原因待進一步分析',
          '可能是多個因素共同作用的結果'
        ],
        recommendations: [
          '建議進行更細緻的數據分析',
          '對比各成本組成的變化情況',
          '檢查是否有異常的系統行為'
        ]
      }
    };

    return analyses[anomalyType];
  }

  /**
   * 檢查是否為異常
   */
  private checkAnomaly(
    costChange: number,
    volumeChange: number,
    costPerDocChange: number
  ): boolean {
    const t = this.anomalyThresholds;
    return (
      Math.abs(costChange) >= t.costChangePercent ||
      Math.abs(volumeChange) >= t.volumeChangePercent ||
      Math.abs(costPerDocChange) >= t.costPerDocChangePercent
    );
  }

  /**
   * 計算變化百分比
   */
  private calculateChangePercent(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  /**
   * 獲取城市列表
   */
  private async getCities(cityFilter: CityFilter) {
    const where = cityFilter.isGlobalAdmin
      ? {}
      : { code: { in: cityFilter.cityCodes } };

    return prisma.city.findMany({
      where,
      select: {
        code: true,
        name: true,
        region: { select: { name: true } }
      }
    });
  }

  /**
   * 構建快取鍵
   */
  private buildCacheKey(
    type: string,
    cityFilter: CityFilter,
    startDate: Date,
    endDate: Date
  ): string {
    const cityPart = cityFilter.isGlobalAdmin
      ? 'global'
      : cityFilter.cityCodes.sort().join(',');
    return `city-cost-report:${type}:${cityPart}:${format(startDate, 'yyyy-MM-dd')}:${format(endDate, 'yyyy-MM-dd')}`;
  }
}

export const cityCostReportService = new CityCostReportService();
```

---

## API Routes

### City Cost Report Endpoint

```typescript
// src/app/api/reports/city-cost/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { withRoleCheck } from '@/middleware/role-check';
import { cityCostReportService } from '@/services/city-cost-report.service';
import { parseISO, subMonths, isValid } from 'date-fns';

const ALLOWED_ROLES = ['FINANCE', 'ADMIN', 'REGIONAL_MANAGER', 'CITY_MANAGER'];

export async function GET(request: NextRequest) {
  return withRoleCheck(request, ALLOWED_ROLES, async (req) => {
    return withCityFilter(req, async (_, cityFilter) => {
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

        const reports = await cityCostReportService.getCityCostReport(
          cityFilter,
          startDate,
          endDate
        );

        const totalCost = reports.reduce((sum, r) => sum + r.totalCost, 0);
        const totalVolume = reports.reduce((sum, r) => sum + r.processingVolume, 0);
        const anomalyCount = reports.filter(r => r.trend.isAnomalous).length;

        return NextResponse.json({
          success: true,
          data: reports,
          meta: {
            totalCities: reports.length,
            totalCost,
            totalVolume,
            period: {
              start: startDate.toISOString(),
              end: endDate.toISOString()
            },
            anomalyCount
          }
        });
      } catch (error) {
        console.error('City cost report error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch city cost report' },
          { status: 500 }
        );
      }
    });
  });
}
```

### Cost Trend Endpoint

```typescript
// src/app/api/reports/city-cost/trend/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { withRoleCheck } from '@/middleware/role-check';
import { cityCostReportService } from '@/services/city-cost-report.service';

const ALLOWED_ROLES = ['FINANCE', 'ADMIN', 'REGIONAL_MANAGER', 'CITY_MANAGER'];

export async function GET(request: NextRequest) {
  return withRoleCheck(request, ALLOWED_ROLES, async (req) => {
    return withCityFilter(req, async (_, cityFilter) => {
      try {
        const { searchParams } = new URL(req.url);
        const months = parseInt(searchParams.get('months') || '6');

        if (months < 1 || months > 24) {
          return NextResponse.json(
            { success: false, error: 'Months must be between 1 and 24' },
            { status: 400 }
          );
        }

        const trend = await cityCostReportService.getCostTrend(cityFilter, months);

        // Calculate start and end months
        const periods = [...new Set(trend.map(t => t.period))].sort();

        return NextResponse.json({
          success: true,
          data: trend,
          meta: {
            months,
            startMonth: periods[0] || '',
            endMonth: periods[periods.length - 1] || ''
          }
        });
      } catch (error) {
        console.error('Cost trend error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch cost trend' },
          { status: 500 }
        );
      }
    });
  });
}
```

### Anomaly Analysis Endpoint

```typescript
// src/app/api/reports/city-cost/anomaly/[cityCode]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withCityFilter } from '@/middleware/city-filter';
import { withRoleCheck } from '@/middleware/role-check';
import { cityCostReportService } from '@/services/city-cost-report.service';
import { parseISO, subMonths, isValid } from 'date-fns';

const ALLOWED_ROLES = ['FINANCE', 'ADMIN', 'REGIONAL_MANAGER', 'CITY_MANAGER'];

interface RouteParams {
  params: { cityCode: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withRoleCheck(request, ALLOWED_ROLES, async (req) => {
    return withCityFilter(req, async (_, cityFilter) => {
      try {
        const { cityCode } = params;

        // Check city access
        if (!cityFilter.isGlobalAdmin && !cityFilter.cityCodes.includes(cityCode)) {
          return NextResponse.json(
            { success: false, error: 'Access denied to city' },
            { status: 403 }
          );
        }

        const { searchParams } = new URL(req.url);

        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        const endDate = endDateParam && isValid(parseISO(endDateParam))
          ? parseISO(endDateParam)
          : new Date();

        const startDate = startDateParam && isValid(parseISO(startDateParam))
          ? parseISO(startDateParam)
          : subMonths(endDate, 1);

        const analysis = await cityCostReportService.analyzeAnomaly(
          cityCode,
          startDate,
          endDate
        );

        return NextResponse.json({
          success: true,
          data: analysis
        });
      } catch (error) {
        console.error('Anomaly analysis error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to analyze anomaly' },
          { status: 500 }
        );
      }
    });
  });
}
```

---

## Frontend Components

### City Cost Table Component

```typescript
// src/components/reports/CityCostTable.tsx

'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CityCostReport } from '@/types/city-cost';
import { CostAnomalyDialog } from './CostAnomalyDialog';

interface CityCostTableProps {
  data: CityCostReport[];
  loading?: boolean;
  onCityClick?: (cityCode: string) => void;
}

type SortField = 'cityName' | 'processingVolume' | 'aiCost' | 'laborCost' | 'totalCost' | 'costPerDocument';

export function CityCostTable({ data, loading, onCityClick }: CityCostTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalCost');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const modifier = sortDirection === 'asc' ? 1 : -1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * modifier;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * modifier;
    }
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('zh-TW').format(num);

  const TrendIndicator = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
    if (Math.abs(value) < 0.1) {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    }

    const isPositive = inverse ? value < 0 : value > 0;
    const Icon = value > 0 ? TrendingUp : TrendingDown;

    return (
      <span className={cn(
        'flex items-center gap-0.5 text-sm',
        isPositive ? 'text-emerald-600' : 'text-red-600'
      )}>
        <Icon className="h-4 w-4" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  const SortableHeader = ({
    field,
    children,
    className
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={cn('cursor-pointer select-none', className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn(
          'h-3 w-3',
          sortField === field ? 'text-foreground' : 'text-muted-foreground/50'
        )} />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="rounded-md border">
        <div className="animate-pulse">
          <div className="h-12 bg-muted border-b" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 border-b bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="cityName">城市</SortableHeader>
              <SortableHeader field="processingVolume" className="text-right">
                處理量
              </SortableHeader>
              <SortableHeader field="aiCost" className="text-right">
                AI 成本
              </SortableHeader>
              <SortableHeader field="laborCost" className="text-right">
                人工成本
              </SortableHeader>
              <SortableHeader field="totalCost" className="text-right">
                總成本
              </SortableHeader>
              <SortableHeader field="costPerDocument" className="text-right">
                單位成本
              </SortableHeader>
              <TableHead className="text-right">趨勢</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((city) => (
              <TableRow
                key={city.cityCode}
                className={cn(
                  'cursor-pointer hover:bg-muted/50',
                  city.trend.isAnomalous && 'bg-amber-50/50'
                )}
                onClick={() => onCityClick?.(city.cityCode)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium">{city.cityName}</div>
                      {city.regionName && (
                        <div className="text-xs text-muted-foreground">
                          {city.regionName}
                        </div>
                      )}
                    </div>
                    {city.trend.isAnomalous && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCity(city.cityCode);
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          成本異常，點擊查看分析
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div>
                    <div>{formatNumber(city.processingVolume)}</div>
                    <div className="text-xs text-muted-foreground">
                      自動化率: {city.automationRate.toFixed(1)}%
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(city.aiCost)}
                </TableCell>
                <TableCell className="text-right">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <span className="border-b border-dashed border-muted-foreground/30">
                        {formatCurrency(city.laborCost)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p>人工審核: {formatNumber(city.manualReviewed)} 筆</p>
                        <p>升級處理: {formatNumber(city.escalated)} 筆</p>
                        <p className="text-xs text-muted-foreground">
                          此為估算值
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(city.totalCost)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(city.costPerDocument)}
                </TableCell>
                <TableCell className="text-right">
                  <TrendIndicator value={city.trend.costChangePercent} inverse />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CostAnomalyDialog
        cityCode={selectedCity}
        open={!!selectedCity}
        onClose={() => setSelectedCity(null)}
      />
    </TooltipProvider>
  );
}
```

### Cost Anomaly Dialog

```typescript
// src/components/reports/CostAnomalyDialog.tsx

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CostAnomalyDetail } from '@/types/city-cost';
import { useDashboardFilter } from '@/contexts/DashboardFilterContext';

interface CostAnomalyDialogProps {
  cityCode: string | null;
  open: boolean;
  onClose: () => void;
}

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  volume_spike: '處理量激增',
  volume_drop: '處理量下降',
  cost_per_doc_increase: '單位成本上升',
  cost_per_doc_decrease: '單位成本下降',
  api_cost_spike: 'API 成本激增',
  labor_cost_spike: '人工成本激增',
  automation_rate_drop: '自動化率下降',
  unknown: '待分析'
};

const SEVERITY_CONFIG = {
  low: { label: '低', color: 'bg-yellow-100 text-yellow-800' },
  medium: { label: '中', color: 'bg-orange-100 text-orange-800' },
  high: { label: '高', color: 'bg-red-100 text-red-800' }
};

export function CostAnomalyDialog({ cityCode, open, onClose }: CostAnomalyDialogProps) {
  const { filterParams } = useDashboardFilter();

  const { data, isLoading, error } = useQuery<CostAnomalyDetail>({
    queryKey: ['cost-anomaly', cityCode, filterParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: filterParams.startDate,
        endDate: filterParams.endDate
      });
      const response = await fetch(
        `/api/reports/city-cost/anomaly/${cityCode}?${params}`
      );
      if (!response.ok) throw new Error('Failed to fetch anomaly analysis');
      return (await response.json()).data;
    },
    enabled: !!cityCode && open
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);

  const formatPercent = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            成本異常分析
            {data && (
              <Badge
                variant="outline"
                className={cn('ml-2', SEVERITY_CONFIG[data.severity].color)}
              >
                {SEVERITY_CONFIG[data.severity].label}風險
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {data?.cityName || cityCode} 的成本變化分析
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>載入失敗</AlertTitle>
            <AlertDescription>無法載入異常分析數據</AlertDescription>
          </Alert>
        ) : data ? (
          <div className="space-y-6">
            {/* 異常類型 */}
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="font-medium text-amber-800">
                異常類型：{ANOMALY_TYPE_LABELS[data.anomalyType]}
              </div>
            </div>

            {/* 數據對比 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">當前期間</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>總成本</span>
                    <span className="font-medium">
                      {formatCurrency(data.currentPeriod.cost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>處理量</span>
                    <span>{data.currentPeriod.volume.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>單位成本</span>
                    <span>{formatCurrency(data.currentPeriod.costPerDoc)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">上期</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>總成本</span>
                    <span className="font-medium">
                      {formatCurrency(data.previousPeriod.cost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>處理量</span>
                    <span>{data.previousPeriod.volume.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>單位成本</span>
                    <span>{formatCurrency(data.previousPeriod.costPerDoc)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 變化摘要 */}
            <div className="flex flex-wrap gap-3">
              <Badge
                variant="outline"
                className={cn(
                  data.changes.costChangePercent > 0 ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                成本 {formatPercent(data.changes.costChangePercent)}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  data.changes.volumeChangePercent > 0 ? 'text-blue-600' : 'text-muted-foreground'
                )}
              >
                處理量 {formatPercent(data.changes.volumeChangePercent)}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  data.changes.costPerDocChangePercent > 0 ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                單位成本 {formatPercent(data.changes.costPerDocChangePercent)}
              </Badge>
            </div>

            {/* 可能原因 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">可能原因</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {data.possibleCauses.map((cause, i) => (
                  <li key={i}>{cause}</li>
                ))}
              </ul>
            </div>

            {/* 建議行動 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span className="font-medium">建議行動</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {data.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* 受影響的 API 供應商 */}
            {data.affectedProviders && data.affectedProviders.length > 0 && (
              <div>
                <div className="font-medium mb-2">API 供應商變化</div>
                <div className="space-y-2">
                  {data.affectedProviders.map((provider) => (
                    <div
                      key={provider.provider}
                      className="flex justify-between text-sm p-2 bg-muted rounded"
                    >
                      <span>{provider.provider}</span>
                      <span className={cn(
                        provider.costChange > 0 ? 'text-red-600' : 'text-emerald-600'
                      )}>
                        {formatCurrency(provider.costChange)}
                        {' '}
                        ({provider.callsChange > 0 ? '+' : ''}{provider.callsChange} 次調用)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/services/__tests__/city-cost-report.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CityCostReportService } from '../city-cost-report.service';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

vi.mock('@/lib/prisma');
vi.mock('@/lib/redis');

describe('CityCostReportService', () => {
  let service: CityCostReportService;

  beforeEach(() => {
    service = new CityCostReportService();
    vi.clearAllMocks();
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.set).mockResolvedValue('OK');
  });

  describe('getCityCostReport', () => {
    it('should calculate labor cost correctly', async () => {
      vi.mocked(prisma.city.findMany).mockResolvedValue([
        { code: 'TPE', name: 'Taipei', region: { name: 'North' } }
      ] as any);

      vi.mocked(prisma.processingStatistics.aggregate).mockResolvedValue({
        _sum: {
          totalProcessed: 100,
          autoApproved: 80,
          manualReviewed: 15,
          escalated: 5,
          failed: 0
        }
      } as any);

      vi.mocked(prisma.apiUsageLog.aggregate).mockResolvedValue({
        _sum: { estimatedCost: 10 },
        _count: { id: 100 }
      } as any);

      const reports = await service.getCityCostReport(
        { isGlobalAdmin: true, cityCodes: [] },
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(reports[0]).toBeDefined();
      // Labor cost = (15 * 0.5 + 5 * 2.0) * 1.2 = (7.5 + 10) * 1.2 = 21
      expect(reports[0].laborCost).toBeCloseTo(21, 2);
    });

    it('should detect anomaly when cost change exceeds threshold', async () => {
      vi.mocked(prisma.city.findMany).mockResolvedValue([
        { code: 'TPE', name: 'Taipei' }
      ] as any);

      // Current period - high cost
      vi.mocked(prisma.processingStatistics.aggregate)
        .mockResolvedValueOnce({
          _sum: { totalProcessed: 100, autoApproved: 80, manualReviewed: 20, escalated: 0, failed: 0 }
        } as any)
        // Previous period - lower cost
        .mockResolvedValueOnce({
          _sum: { totalProcessed: 80, autoApproved: 64, manualReviewed: 16, escalated: 0, failed: 0 }
        } as any);

      vi.mocked(prisma.apiUsageLog.aggregate)
        .mockResolvedValueOnce({ _sum: { estimatedCost: 50 }, _count: { id: 100 } } as any)
        .mockResolvedValueOnce({ _sum: { estimatedCost: 30 }, _count: { id: 80 } } as any);

      const reports = await service.getCityCostReport(
        { isGlobalAdmin: true, cityCodes: [] },
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(reports[0].trend.isAnomalous).toBe(true);
      expect(reports[0].trend.costChangePercent).toBeGreaterThan(20);
    });
  });

  describe('analyzeAnomaly', () => {
    it('should identify volume spike correctly', async () => {
      vi.mocked(prisma.city.findUnique).mockResolvedValue({
        code: 'TPE',
        name: 'Taipei'
      } as any);

      vi.mocked(prisma.processingStatistics.aggregate)
        .mockResolvedValueOnce({
          _sum: { totalProcessed: 200, autoApproved: 160, manualReviewed: 40, escalated: 0, failed: 0 }
        } as any)
        .mockResolvedValueOnce({
          _sum: { totalProcessed: 100, autoApproved: 80, manualReviewed: 20, escalated: 0, failed: 0 }
        } as any);

      vi.mocked(prisma.apiUsageLog.aggregate)
        .mockResolvedValueOnce({ _sum: { estimatedCost: 20 }, _count: { id: 200 } } as any)
        .mockResolvedValueOnce({ _sum: { estimatedCost: 10 }, _count: { id: 100 } } as any);

      vi.mocked(prisma.apiUsageLog.groupBy)
        .mockResolvedValue([])
        .mockResolvedValue([]);

      const analysis = await service.analyzeAnomaly(
        'TPE',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(analysis.anomalyType).toBe('volume_spike');
      expect(analysis.changes.volumeChangePercent).toBe(100);
    });
  });
});
```

---

## Performance Considerations

### Caching Strategy

| Data Type | Cache TTL | Invalidation |
|-----------|-----------|--------------|
| City Cost Report | 10 minutes | On new processing stats |
| Cost Trend | 30 minutes | On new processing stats |
| Anomaly Analysis | On-demand | No caching |

### Query Optimization

1. **Parallel Queries**: Fetch AI cost and processing stats in parallel
2. **Aggregate at DB Level**: Use database aggregation instead of application-level
3. **Lazy Loading**: Load anomaly details only when requested

---

## Security Considerations

### Permission Model

| Role | Access Level |
|------|-------------|
| FINANCE | View all cities' cost reports |
| ADMIN | View all cities' cost reports |
| REGIONAL_MANAGER | View cities in their region |
| CITY_MANAGER | View own city's cost report |

### Data Protection

1. **City-based Isolation**: Users can only view authorized cities
2. **No PII Exposure**: Reports contain only aggregated financial data
3. **Audit Trail**: Consider logging access to cost reports

---

## Acceptance Criteria Verification

### AC1: 成本報表頁面入口
- [x] `/reports/cost` 頁面路由
- [x] 權限檢查（FINANCE、ADMIN 等角色）
- [x] 顯示各城市的成本明細表格

### AC2: 成本明細內容
- [x] 顯示城市名稱和區域
- [x] 顯示處理量和自動化率
- [x] 顯示 AI 成本和人工成本（估算）
- [x] 顯示總成本和單位成本

### AC3: 成本趨勢分析
- [x] `getCostTrend` 方法提供月度趨勢數據
- [x] API 支援查詢 1-24 個月的歷史數據
- [x] 趨勢數據包含成本和處理量

### AC4: 異常警示
- [x] 異常閾值配置（成本變化 20%、處理量變化 50%）
- [x] 異常標記顯示（警告圖示）
- [x] 異常分析對話框顯示原因和建議

### AC5: 權限控制
- [x] `withRoleCheck` 中間件驗證角色
- [x] `withCityFilter` 限制城市訪問範圍
- [x] 非授權用戶無法訪問報表

---

## File Structure

```
src/
├── types/
│   └── city-cost.ts                        # Type definitions
├── services/
│   └── city-cost-report.service.ts         # Business logic
├── app/
│   └── api/
│       └── reports/
│           └── city-cost/
│               ├── route.ts                # Main report API
│               ├── trend/
│               │   └── route.ts            # Trend API
│               └── anomaly/
│                   └── [cityCode]/
│                       └── route.ts        # Anomaly analysis API
├── components/
│   └── reports/
│       ├── CityCostTable.tsx               # Cost table component
│       └── CostAnomalyDialog.tsx           # Anomaly dialog component
└── app/
    └── (dashboard)/
        └── reports/
            └── cost/
                └── page.tsx                # Cost report page
```

---

## References

- [Story 7.9 Definition](../stories/7-9-city-cost-report.md)
- [Epic 7: Reports Dashboard & Cost Tracking](../../03-epics/sections/epic-7-reports-dashboard-cost-tracking.md)
- [FR71: City Cost Report](../../01-planning/prd/sections/functional-requirements.md)
- [Tech Spec Story 7-7: City Processing Volume Tracking](./tech-spec-story-7-7.md)
- [Tech Spec Story 7-8: City AI Cost Tracking](./tech-spec-story-7-8.md)
