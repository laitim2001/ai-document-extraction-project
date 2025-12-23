/**
 * @fileoverview 規則統計服務 - 規則應用成效追蹤與分析
 * @description
 *   提供規則應用的統計和分析功能：
 *   - 記錄規則應用紀錄
 *   - 按城市分析規則成效
 *   - 生成規則成效報表
 *
 *   ## 架構概覽
 *
 *   ```
 *   規則應用記錄
 *        ↓
 *   ┌─────────────────────┐
 *   │  RuleMetricsService │
 *   │     (Static)        │
 *   └──────────┬──────────┘
 *              │
 *   ┌──────────┴──────────┐
 *   │                     │
 *   ▼                     ▼
 *   Database          統計分析
 *   (RuleApplication)  (聚合查詢)
 *   ```
 *
 * @module src/services/rule-metrics
 * @author Development Team
 * @since Epic 6 - Story 6.5 (Global Rule Sharing)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 規則應用記錄
 *   - 城市別成效分析
 *   - 規則使用分佈
 *   - 成效報表生成
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *
 * @related
 *   - src/services/rule-resolver.ts - 規則解析服務
 *   - prisma/schema.prisma - RuleApplication 模型
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// Types
// ============================================================

/**
 * 規則應用記錄參數
 */
export interface RecordApplicationParams {
  /** 規則 ID */
  ruleId: string;
  /** 規則版本 */
  ruleVersion: number;
  /** 文件 ID */
  documentId: string;
  /** 欄位名稱 */
  fieldName: string;
  /** 提取值 */
  extractedValue?: string;
}

/**
 * 規則成效統計（按城市）
 */
export interface RuleEffectivenessResult {
  /** 整體統計 */
  overall: {
    /** 總應用次數 */
    total: number;
    /** 已驗證次數 */
    verified: number;
    /** 準確率（已驗證中準確的比例） */
    accuracyRate: number;
  };
  /** 城市別統計 */
  byCity: Array<{
    /** 城市代碼 */
    cityCode: string;
    /** 城市名稱 */
    cityName: string;
    /** 總應用次數 */
    total: number;
    /** 已驗證次數 */
    verified: number;
    /** 準確率 */
    accuracyRate: number;
  }>;
}

/**
 * 城市規則使用統計
 */
export interface CityRuleUsageItem {
  /** 規則 ID */
  ruleId: string;
  /** 欄位名稱 */
  fieldName: string;
  /** Forwarder 名稱 */
  forwarderName: string;
  /** 總應用次數 */
  total: number;
  /** 準確率 */
  accuracyRate: number;
}

/**
 * 成效報表
 */
export interface EffectivenessReport {
  /** 摘要統計 */
  summary: {
    /** 規則總數 */
    totalRules: number;
    /** 總應用次數 */
    totalApplications: number;
    /** 整體準確率 */
    overallAccuracyRate: number;
    /** 使用城市數 */
    citiesUsed: number;
  };
  /** 表現最佳的規則 */
  topPerforming: Array<{
    ruleId: string;
    fieldName: string;
    accuracyRate: number;
    applications: number;
  }>;
  /** 需要改進的規則 */
  needsImprovement: Array<{
    ruleId: string;
    fieldName: string;
    accuracyRate: number;
    applications: number;
  }>;
  /** 城市使用分佈 */
  cityDistribution: Array<{
    cityCode: string;
    cityName: string;
    percentage: number;
  }>;
}

/**
 * 報表生成選項
 */
export interface ReportOptions {
  /** Forwarder ID（可選） */
  forwarderId?: string;
  /** 開始日期 */
  dateFrom?: Date;
  /** 結束日期 */
  dateTo?: Date;
  /** 最少應用次數（過濾噪音） */
  minApplications?: number;
}

// ============================================================
// RuleMetricsService
// ============================================================

/**
 * 規則統計服務
 *
 * @description
 *   提供規則應用的統計和分析功能。
 *   所有方法為 static，不需實例化。
 *
 * @example
 *   // 記錄規則應用
 *   await RuleMetricsService.recordApplication({
 *     ruleId: 'rule-123',
 *     ruleVersion: 1,
 *     documentId: 'doc-456',
 *     fieldName: 'shipper_name',
 *     extractedValue: 'ACME Corp',
 *   });
 *
 *   // 取得規則成效
 *   const effectiveness = await RuleMetricsService.getRuleEffectiveness('rule-123');
 */
export class RuleMetricsService {
  /**
   * 記錄規則應用
   *
   * @description
   *   記錄一次規則應用，用於後續統計分析。
   *   isAccurate 初始為 null，待人工驗證後更新。
   *
   * @param params - 應用參數
   * @returns 建立的應用記錄 ID
   */
  static async recordApplication(params: RecordApplicationParams): Promise<string> {
    const { ruleId, ruleVersion, documentId, fieldName, extractedValue } = params;

    const application = await prisma.ruleApplication.create({
      data: {
        ruleId,
        ruleVersion,
        documentId,
        fieldName,
        extractedValue,
        // isAccurate 初始為 null，待驗證
      },
    });

    return application.id;
  }

  /**
   * 取得規則成效（按城市分析）
   *
   * @description
   *   分析特定規則在各城市的應用成效。
   *   透過 Document 關聯取得城市資訊。
   *
   * @param ruleId - 規則 ID
   * @returns 成效統計結果
   */
  static async getRuleEffectiveness(ruleId: string): Promise<RuleEffectivenessResult> {
    // 取得所有應用記錄，包含文件城市資訊
    const applications = await prisma.ruleApplication.findMany({
      where: { ruleId },
      select: {
        id: true,
        isAccurate: true,
        document: {
          select: {
            cityCode: true,
          },
        },
      },
    });

    if (applications.length === 0) {
      return {
        overall: { total: 0, verified: 0, accuracyRate: 0 },
        byCity: [],
      };
    }

    // 按城市分組統計
    const cityStatsMap = new Map<
      string,
      { total: number; verified: number; accurate: number }
    >();

    for (const app of applications) {
      const cityCode = app.document.cityCode;
      const stats = cityStatsMap.get(cityCode) || { total: 0, verified: 0, accurate: 0 };

      stats.total += 1;
      if (app.isAccurate !== null) {
        stats.verified += 1;
        if (app.isAccurate) {
          stats.accurate += 1;
        }
      }

      cityStatsMap.set(cityCode, stats);
    }

    // 取得城市名稱
    const cityCodes = Array.from(cityStatsMap.keys());
    const cities = await prisma.city.findMany({
      where: { code: { in: cityCodes } },
      select: { code: true, name: true },
    });
    const cityNameMap = new Map(cities.map((c) => [c.code, c.name]));

    // 彙整城市別統計
    const byCity = Array.from(cityStatsMap.entries()).map(([cityCode, stats]) => ({
      cityCode,
      cityName: cityNameMap.get(cityCode) || cityCode,
      total: stats.total,
      verified: stats.verified,
      accuracyRate: stats.verified > 0 ? stats.accurate / stats.verified : 0,
    }));

    // 計算整體統計
    const overallTotal = applications.length;
    const overallVerified = applications.filter((a) => a.isAccurate !== null).length;
    const overallAccurate = applications.filter((a) => a.isAccurate === true).length;

    return {
      overall: {
        total: overallTotal,
        verified: overallVerified,
        accuracyRate: overallVerified > 0 ? overallAccurate / overallVerified : 0,
      },
      byCity: byCity.sort((a, b) => b.total - a.total),
    };
  }

  /**
   * 取得城市規則使用分佈
   *
   * @description
   *   分析特定城市中各規則的使用情況。
   *
   * @param cityCode - 城市代碼
   * @returns 規則使用統計列表
   */
  static async getCityRuleUsage(cityCode: string): Promise<CityRuleUsageItem[]> {
    // 取得該城市的所有規則應用
    const applications = await prisma.ruleApplication.findMany({
      where: {
        document: { cityCode },
      },
      select: {
        ruleId: true,
        fieldName: true,
        isAccurate: true,
        rule: {
          select: {
            company: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (applications.length === 0) {
      return [];
    }

    // 按規則分組統計
    const ruleStatsMap = new Map<
      string,
      {
        fieldName: string;
        forwarderName: string;
        total: number;
        verified: number;
        accurate: number;
      }
    >();

    for (const app of applications) {
      const stats = ruleStatsMap.get(app.ruleId) || {
        fieldName: app.fieldName,
        forwarderName: app.rule?.company?.name || 'Universal',
        total: 0,
        verified: 0,
        accurate: 0,
      };

      stats.total += 1;
      if (app.isAccurate !== null) {
        stats.verified += 1;
        if (app.isAccurate) {
          stats.accurate += 1;
        }
      }

      ruleStatsMap.set(app.ruleId, stats);
    }

    // 轉換為結果格式
    return Array.from(ruleStatsMap.entries())
      .map(([ruleId, stats]) => ({
        ruleId,
        fieldName: stats.fieldName,
        forwarderName: stats.forwarderName,
        total: stats.total,
        accuracyRate: stats.verified > 0 ? stats.accurate / stats.verified : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * 生成規則成效報表
   *
   * @description
   *   生成完整的規則成效分析報表，包含：
   *   - 摘要統計
   *   - 表現最佳規則
   *   - 需要改進規則
   *   - 城市使用分佈
   *
   * @param options - 報表選項
   * @returns 成效報表
   */
  static async generateEffectivenessReport(
    options: ReportOptions = {}
  ): Promise<EffectivenessReport> {
    const { forwarderId, dateFrom, dateTo, minApplications = 10 } = options;

    // 建立查詢條件
    type ApplicationWhereInput = {
      createdAt?: { gte?: Date; lte?: Date };
      rule?: { companyId?: string };
    };

    const where: ApplicationWhereInput = {};

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    if (forwarderId) {
      where.rule = { companyId: forwarderId };
    }

    // 取得所有符合條件的應用記錄
    const applications = await prisma.ruleApplication.findMany({
      where,
      select: {
        ruleId: true,
        fieldName: true,
        isAccurate: true,
        rule: true,
        document: {
          select: { cityCode: true },
        },
      },
    });

    if (applications.length === 0) {
      return {
        summary: {
          totalRules: 0,
          totalApplications: 0,
          overallAccuracyRate: 0,
          citiesUsed: 0,
        },
        topPerforming: [],
        needsImprovement: [],
        cityDistribution: [],
      };
    }

    // 按規則統計
    const ruleStatsMap = new Map<
      string,
      {
        fieldName: string;
        total: number;
        verified: number;
        accurate: number;
      }
    >();

    // 按城市統計
    const cityCountMap = new Map<string, number>();

    let overallVerified = 0;
    let overallAccurate = 0;

    for (const app of applications) {
      // 規則統計
      const ruleStats = ruleStatsMap.get(app.ruleId) || {
        fieldName: app.fieldName,
        total: 0,
        verified: 0,
        accurate: 0,
      };
      ruleStats.total += 1;
      if (app.isAccurate !== null) {
        ruleStats.verified += 1;
        overallVerified += 1;
        if (app.isAccurate) {
          ruleStats.accurate += 1;
          overallAccurate += 1;
        }
      }
      ruleStatsMap.set(app.ruleId, ruleStats);

      // 城市統計
      if (app.document) {
        const cityCode = app.document.cityCode;
        cityCountMap.set(cityCode, (cityCountMap.get(cityCode) || 0) + 1);
      }
    }

    // 過濾低使用量規則，計算準確率排名
    const rulesWithRates = Array.from(ruleStatsMap.entries())
      .filter(([, stats]) => stats.total >= minApplications)
      .map(([ruleId, stats]) => ({
        ruleId,
        fieldName: stats.fieldName,
        applications: stats.total,
        accuracyRate: stats.verified > 0 ? stats.accurate / stats.verified : 0,
      }));

    // 排序
    const sortedByRate = [...rulesWithRates].sort((a, b) => b.accuracyRate - a.accuracyRate);

    // 取得城市名稱
    const cityCodes = Array.from(cityCountMap.keys());
    const cities = await prisma.city.findMany({
      where: { code: { in: cityCodes } },
      select: { code: true, name: true },
    });
    const cityNameMap = new Map(cities.map((c) => [c.code, c.name]));

    // 城市分佈
    const totalApps = applications.length;
    const cityDistribution = Array.from(cityCountMap.entries())
      .map(([cityCode, count]) => ({
        cityCode,
        cityName: cityNameMap.get(cityCode) || cityCode,
        percentage: count / totalApps,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return {
      summary: {
        totalRules: ruleStatsMap.size,
        totalApplications: applications.length,
        overallAccuracyRate: overallVerified > 0 ? overallAccurate / overallVerified : 0,
        citiesUsed: cityCountMap.size,
      },
      topPerforming: sortedByRate.slice(0, 5),
      needsImprovement: sortedByRate.slice(-5).reverse(),
      cityDistribution,
    };
  }

  /**
   * 更新應用記錄的準確性
   *
   * @description
   *   在人工驗證後更新規則應用的準確性。
   *
   * @param applicationId - 應用記錄 ID
   * @param isAccurate - 是否準確
   * @param verifiedBy - 驗證者 ID
   */
  static async updateAccuracy(
    applicationId: string,
    isAccurate: boolean,
    verifiedBy: string
  ): Promise<void> {
    await prisma.ruleApplication.update({
      where: { id: applicationId },
      data: {
        isAccurate,
        verifiedBy,
        verifiedAt: new Date(),
      },
    });
  }

  /**
   * 取得規則應用歷史
   *
   * @description
   *   取得特定規則的應用歷史記錄。
   *
   * @param ruleId - 規則 ID
   * @param options - 查詢選項
   * @returns 應用記錄列表
   */
  static async getApplicationHistory(
    ruleId: string,
    options: {
      limit?: number;
      offset?: number;
      cityCode?: string;
    } = {}
  ): Promise<{
    items: Array<{
      id: string;
      documentId: string;
      fieldName: string;
      extractedValue: string | null;
      isAccurate: boolean | null;
      cityCode: string;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const { limit = 50, offset = 0, cityCode } = options;

    type HistoryWhereInput = {
      ruleId: string;
      document?: { cityCode?: string };
    };

    const where: HistoryWhereInput = { ruleId };
    if (cityCode) {
      where.document = { cityCode };
    }

    const [items, total] = await Promise.all([
      prisma.ruleApplication.findMany({
        where,
        select: {
          id: true,
          documentId: true,
          fieldName: true,
          extractedValue: true,
          isAccurate: true,
          createdAt: true,
          document: {
            select: { cityCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ruleApplication.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        documentId: item.documentId,
        fieldName: item.fieldName,
        extractedValue: item.extractedValue,
        isAccurate: item.isAccurate,
        cityCode: item.document.cityCode,
        createdAt: item.createdAt,
      })),
      total,
    };
  }
}
