/**
 * @fileoverview n8n 健康監控服務
 * @description
 *   本模組負責 n8n 連接狀態的完整健康監控，包含：
 *   - 整體健康狀態獲取
 *   - 健康檢查執行
 *   - 健康歷史記錄查詢
 *   - 狀態變化追蹤
 *   - 24 小時統計
 *   - 城市級別健康狀態
 *
 *   ## 狀態判斷邏輯
 *   - HEALTHY: 成功率 >= 90%
 *   - DEGRADED: 成功率 70-90%
 *   - UNHEALTHY: 成功率 < 70% 或連續失敗 >= 3 次
 *   - UNCONFIGURED: 無活躍配置
 *   - UNKNOWN: 無法確定狀態
 *
 * @module src/services/n8n/n8n-health.service
 * @author Development Team
 * @since Epic 10 - Story 10.7
 * @lastModified 2025-12-20
 *
 * @features
 *   - 整體健康狀態監控
 *   - 24 小時統計數據
 *   - 城市級別健康狀態
 *   - 狀態變化歷史
 *   - 自動告警觸發
 *   - 自動恢復檢測
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - ./webhook-config.service - Webhook 配置服務
 *   - ../alert.service - 告警服務
 */

import { prisma } from '@/lib/prisma';
import { HealthStatus, HealthCheckType, AlertType, AlertSeverity } from '@prisma/client';
import {
  N8nHealthStatus,
  HealthCheckResult,
  StatusChangeRecord,
  HealthHistoryEntry,
  ConnectionStats24h,
  CityHealthStatus,
  DEFAULT_ALERT_THRESHOLDS,
  AlertThresholds,
  GetHealthHistoryParams,
  GetStatusChangesParams,
  PerformHealthCheckParams,
} from '@/types/health-monitoring';
import { webhookConfigService } from './webhook-config.service';
import { alertService } from '../alert.service';

// ============================================================
// Constants
// ============================================================

/** n8n 服務標識 */
const SERVICE_NAME = 'n8n';

/** 全域配置鍵 */
const GLOBAL_CONFIG_KEY = 'global';

// ============================================================
// Service Class
// ============================================================

/**
 * @class N8nHealthService
 * @description n8n 健康監控服務
 */
export class N8nHealthService {
  /** 連續失敗計數器（按配置鍵） */
  private consecutiveFailures: Map<string, number> = new Map();

  /** 告警閾值配置 */
  private thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS;

  // ============================================================
  // Public Methods
  // ============================================================

  /**
   * 獲取整體健康狀態
   *
   * @description
   *   獲取 n8n 服務的整體健康狀態，包含：
   *   - 當前狀態（HEALTHY/DEGRADED/UNHEALTHY/UNCONFIGURED）
   *   - 最後成功時間
   *   - 最後檢查時間
   *   - 連續失敗次數
   *   - 24 小時統計
   *   - 各城市狀態
   *   - 活躍告警
   *
   * @returns 整體健康狀態
   */
  async getOverallHealth(): Promise<N8nHealthStatus> {
    // 獲取所有活躍配置
    const configsResult = await webhookConfigService.list({ isActive: true, pageSize: 100 });
    const configs = configsResult.items;

    if (configs.length === 0) {
      return this.buildUnconfiguredStatus();
    }

    // 並行獲取所有必要數據
    const [latestCheck, lastSuccess, stats24h, consecutiveFailures, activeAlerts] =
      await Promise.all([
        this.getLatestHealthCheck(),
        this.getLastSuccessfulCheck(),
        this.get24HourStats(),
        this.getConsecutiveFailures(),
        alertService.getActiveAlerts(SERVICE_NAME),
      ]);

    // 獲取各城市狀態
    const cityStatuses = await this.getCityStatuses(configs);

    // 判斷整體狀態
    const status = this.determineOverallStatus(consecutiveFailures, stats24h.successRate);

    return {
      status,
      lastSuccessAt: lastSuccess?.createdAt ?? undefined,
      lastCheckAt: latestCheck?.createdAt ?? undefined,
      consecutiveFailures,
      stats24h,
      cityStatuses,
      activeAlerts: activeAlerts.map((alert) => ({
        id: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        createdAt: alert.createdAt,
        status: alert.status,
      })),
    };
  }

  /**
   * 執行健康檢查
   *
   * @description
   *   執行 n8n 連接健康檢查：
   *   1. 獲取適用的 Webhook 配置
   *   2. 執行連接測試
   *   3. 記錄檢查結果
   *   4. 處理狀態變化和告警
   *
   * @param options - 檢查選項
   * @returns 健康檢查結果
   */
  async performHealthCheck(options?: PerformHealthCheckParams): Promise<HealthCheckResult> {
    const { cityCode, checkType = HealthCheckType.MANUAL } = options || {};

    // 獲取適用的配置
    const config = cityCode
      ? await this.getActiveConfigForCity(cityCode)
      : await this.getFirstActiveConfig();

    if (!config) {
      return {
        success: false,
        status: HealthStatus.UNCONFIGURED,
        error: 'No active webhook configuration found',
      };
    }

    const configKey = cityCode || GLOBAL_CONFIG_KEY;
    const startTime = Date.now();

    try {
      // 執行健康檢查請求
      const testResult = await webhookConfigService.testConnection({ configId: config.id });
      const responseTimeMs = Date.now() - startTime;

      // 判斷狀態
      let status: HealthStatus;
      if (testResult.success) {
        status = HealthStatus.HEALTHY;
        this.consecutiveFailures.set(configKey, 0);
      } else {
        status = HealthStatus.UNHEALTHY;
        const current = this.consecutiveFailures.get(configKey) || 0;
        this.consecutiveFailures.set(configKey, current + 1);
      }

      // 獲取前一次狀態
      const previousLog = await prisma.systemHealthLog.findFirst({
        where: { service: SERVICE_NAME, cityCode },
        orderBy: { createdAt: 'desc' },
      });

      // 記錄健康檢查結果
      await prisma.systemHealthLog.create({
        data: {
          service: SERVICE_NAME,
          serviceUrl: `${config.baseUrl}${config.endpointPath}`,
          status,
          previousStatus: previousLog?.status,
          message: testResult.success ? 'Connection successful' : testResult.error,
          checkType,
          responseTimeMs,
          httpStatus: testResult.statusCode,
          cityCode,
          details: {
            endpoint: `${config.baseUrl}${config.endpointPath}`,
            method: 'GET',
          },
        },
      });

      // 處理告警
      await this.handleStatusChange(configKey, status, previousLog?.status, testResult.error);

      return {
        success: testResult.success,
        status,
        responseTimeMs,
        error: testResult.error,
        httpStatus: testResult.statusCode,
      };
    } catch (error) {
      return await this.handleHealthCheckError(error, configKey, cityCode, checkType, startTime);
    }
  }

  /**
   * 獲取健康歷史記錄
   *
   * @param options - 查詢選項
   * @returns 健康歷史記錄列表
   */
  async getHealthHistory(options: GetHealthHistoryParams = {}): Promise<HealthHistoryEntry[]> {
    const { cityCode, limit = 100, startDate, endDate, status } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { service: SERVICE_NAME };
    if (cityCode) where.cityCode = cityCode;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const logs = await prisma.systemHealthLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: {
        status: true,
        message: true,
        responseTimeMs: true,
        httpStatus: true,
        createdAt: true,
        cityCode: true,
      },
    });

    return logs.map((log) => ({
      status: log.status,
      message: log.message ?? undefined,
      responseTimeMs: log.responseTimeMs ?? undefined,
      httpStatus: log.httpStatus ?? undefined,
      createdAt: log.createdAt,
      cityCode: log.cityCode ?? undefined,
    }));
  }

  /**
   * 獲取狀態變化記錄
   *
   * @param options - 查詢選項
   * @returns 狀態變化記錄列表
   */
  async getStatusChanges(options: GetStatusChangesParams = {}): Promise<StatusChangeRecord[]> {
    const { limit = 20, cityCode } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      service: SERVICE_NAME,
      previousStatus: { not: null },
    };
    if (cityCode) where.cityCode = cityCode;

    const logs = await prisma.systemHealthLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        previousStatus: true,
        status: true,
        message: true,
        responseTimeMs: true,
        createdAt: true,
        cityCode: true,
        city: {
          select: { name: true },
        },
      },
    });

    return logs
      .filter((log) => log.previousStatus !== log.status)
      .map((log) => ({
        previousStatus: log.previousStatus ?? undefined,
        newStatus: log.status,
        reason: log.message ?? undefined,
        changedAt: log.createdAt,
        cityCode: log.cityCode ?? undefined,
        cityName: log.city?.name ?? undefined,
        responseTimeMs: log.responseTimeMs ?? undefined,
      }));
  }

  /**
   * 定期健康檢查（由排程任務調用）
   *
   * @description
   *   對所有活躍配置執行健康檢查
   */
  async scheduledHealthCheck(): Promise<void> {
    const configsResult = await webhookConfigService.list({ isActive: true, pageSize: 100 });
    const configs = configsResult.items;

    // 並行檢查所有配置
    await Promise.all(
      configs.map((config) =>
        this.performHealthCheck({
          cityCode: config.cityCode ?? undefined,
          checkType: HealthCheckType.SCHEDULED,
        }).catch((error) => {
          console.error(`Health check failed for ${config.cityCode || GLOBAL_CONFIG_KEY}:`, error);
        })
      )
    );
  }

  /**
   * 設定告警閾值
   *
   * @param thresholds - 新的閾值配置
   */
  setThresholds(thresholds: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 獲取告警閾值
   *
   * @returns 當前閾值配置
   */
  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 建立未配置狀態
   */
  private buildUnconfiguredStatus(): N8nHealthStatus {
    return {
      status: HealthStatus.UNCONFIGURED,
      consecutiveFailures: 0,
      stats24h: {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        successRate: 0,
      },
      activeAlerts: [],
    };
  }

  /**
   * 獲取最新健康檢查記錄
   */
  private async getLatestHealthCheck() {
    return prisma.systemHealthLog.findFirst({
      where: { service: SERVICE_NAME },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 獲取最後成功的健康檢查
   */
  private async getLastSuccessfulCheck() {
    return prisma.systemHealthLog.findFirst({
      where: {
        service: SERVICE_NAME,
        status: HealthStatus.HEALTHY,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 獲取 24 小時統計
   */
  private async get24HourStats(): Promise<ConnectionStats24h> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [stats, successCount, errorCountByStatus] = await Promise.all([
      prisma.n8nApiCall.aggregate({
        where: { timestamp: { gte: since } },
        _count: true,
        _avg: { durationMs: true },
        _max: { durationMs: true },
        _min: { durationMs: true },
      }),
      prisma.n8nApiCall.count({
        where: {
          timestamp: { gte: since },
          statusCode: { gte: 200, lt: 300 },
        },
      }),
      // 按 HTTP 狀態碼分組統計錯誤
      prisma.n8nApiCall.groupBy({
        by: ['statusCode'],
        where: {
          timestamp: { gte: since },
          statusCode: { gte: 400 },
        },
        _count: true,
      }),
    ]);

    const totalCalls = stats._count;
    const successCalls = successCount;
    const failedCalls = totalCalls - successCalls;
    const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 100;

    // 構建錯誤分類（按 HTTP 狀態碼）
    const errorsByType: Record<string, number> = {};
    errorCountByStatus.forEach((stat) => {
      const errorCategory = stat.statusCode >= 500 ? 'server_error' : 'client_error';
      errorsByType[errorCategory] = (errorsByType[errorCategory] || 0) + stat._count;
    });

    return {
      totalCalls,
      successCalls,
      failedCalls,
      successRate,
      avgResponseMs: stats._avg.durationMs ?? undefined,
      maxResponseMs: stats._max.durationMs ?? undefined,
      minResponseMs: stats._min.durationMs ?? undefined,
      errorsByType: Object.keys(errorsByType).length > 0 ? errorsByType : undefined,
    };
  }

  /**
   * 獲取各城市狀態
   */
  private async getCityStatuses(
    configs: Array<{ cityCode: string | null; cityName: string | null }>
  ): Promise<CityHealthStatus[]> {
    const cityStatuses: CityHealthStatus[] = [];

    for (const config of configs) {
      if (!config.cityCode) continue;

      const lastCheck = await prisma.systemHealthLog.findFirst({
        where: {
          service: SERVICE_NAME,
          cityCode: config.cityCode,
        },
        orderBy: { createdAt: 'desc' },
      });

      // 計算城市的連續失敗次數
      const recentLogs = await prisma.systemHealthLog.findMany({
        where: {
          service: SERVICE_NAME,
          cityCode: config.cityCode,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      let consecutiveFailures = 0;
      for (const log of recentLogs) {
        if (log.status === HealthStatus.UNHEALTHY) {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      cityStatuses.push({
        cityCode: config.cityCode,
        cityName: config.cityName || config.cityCode,
        status: lastCheck?.status || HealthStatus.UNKNOWN,
        lastCheckAt: lastCheck?.createdAt ?? undefined,
        consecutiveFailures,
      });
    }

    return cityStatuses;
  }

  /**
   * 獲取連續失敗次數
   */
  private async getConsecutiveFailures(): Promise<number> {
    const recentLogs = await prisma.systemHealthLog.findMany({
      where: { service: SERVICE_NAME },
      orderBy: { createdAt: 'desc' },
      take: this.thresholds.consecutiveFailuresThreshold + 1,
    });

    let failures = 0;
    for (const log of recentLogs) {
      if (log.status === HealthStatus.UNHEALTHY) {
        failures++;
      } else {
        break;
      }
    }

    return failures;
  }

  /**
   * 判斷整體狀態
   */
  private determineOverallStatus(
    consecutiveFailures: number,
    successRate: number
  ): HealthStatus {
    // 連續失敗超過閾值
    if (consecutiveFailures >= this.thresholds.consecutiveFailuresThreshold) {
      return HealthStatus.UNHEALTHY;
    }

    // 根據成功率判斷
    if (successRate < this.thresholds.degradedSuccessRateMin) {
      return HealthStatus.UNHEALTHY;
    }

    if (successRate < this.thresholds.healthySuccessRateMin) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * 處理狀態變化
   */
  private async handleStatusChange(
    configKey: string,
    newStatus: HealthStatus,
    previousStatus: HealthStatus | undefined | null,
    errorMessage?: string | null
  ): Promise<void> {
    const consecutiveFailures = this.consecutiveFailures.get(configKey) || 0;

    // 狀態從健康變為異常
    if (
      previousStatus === HealthStatus.HEALTHY &&
      newStatus === HealthStatus.UNHEALTHY
    ) {
      if (consecutiveFailures >= this.thresholds.consecutiveFailuresThreshold) {
        await alertService.createAlert({
          alertType: AlertType.CONNECTION_FAILURE,
          severity: AlertSeverity.ERROR,
          title: 'n8n 連接失敗',
          message: `n8n 連接已連續失敗 ${consecutiveFailures} 次`,
          details: {
            consecutiveFailures,
            lastErrorMessage: errorMessage ?? undefined,
            triggerCondition: `連續失敗 >= ${this.thresholds.consecutiveFailuresThreshold}`,
            suggestedActions: [
              '檢查 n8n 服務是否正常運行',
              '確認網路連接正常',
              '驗證 Webhook 配置是否正確',
              '查看 n8n 日誌檔案',
            ],
          },
          service: SERVICE_NAME,
          cityCode: configKey === GLOBAL_CONFIG_KEY ? undefined : configKey,
        });
      }
    }

    // 狀態從異常恢復為健康
    if (
      previousStatus === HealthStatus.UNHEALTHY &&
      newStatus === HealthStatus.HEALTHY
    ) {
      await alertService.createAlert({
        alertType: AlertType.SERVICE_RECOVERED,
        severity: AlertSeverity.INFO,
        title: 'n8n 連接已恢復',
        message: 'n8n 服務連接已恢復正常',
        details: {
          triggerCondition: '連接測試成功',
        },
        service: SERVICE_NAME,
        cityCode: configKey === GLOBAL_CONFIG_KEY ? undefined : configKey,
      });

      // 自動解決相關的活躍告警
      await alertService.resolveAlertsByService(SERVICE_NAME, {
        cityCode: configKey === GLOBAL_CONFIG_KEY ? undefined : configKey,
        note: '服務已自動恢復',
      });
    }

    // 狀態變為降級
    if (newStatus === HealthStatus.DEGRADED && previousStatus !== HealthStatus.DEGRADED) {
      await alertService.createAlert({
        alertType: AlertType.SERVICE_DEGRADED,
        severity: AlertSeverity.WARNING,
        title: 'n8n 服務降級',
        message: '部分 n8n 請求失敗，服務處於降級狀態',
        details: {
          triggerCondition: `成功率低於 ${this.thresholds.healthySuccessRateMin}%`,
          suggestedActions: [
            '監控服務狀態',
            '檢查錯誤日誌',
            '考慮擴展服務資源',
          ],
        },
        service: SERVICE_NAME,
        cityCode: configKey === GLOBAL_CONFIG_KEY ? undefined : configKey,
      });
    }
  }

  /**
   * 處理健康檢查錯誤
   */
  private async handleHealthCheckError(
    error: unknown,
    configKey: string,
    cityCode: string | undefined,
    checkType: HealthCheckType,
    startTime: number
  ): Promise<HealthCheckResult> {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 更新連續失敗計數
    const current = this.consecutiveFailures.get(configKey) || 0;
    this.consecutiveFailures.set(configKey, current + 1);

    // 獲取前一次狀態
    const previousLog = await prisma.systemHealthLog.findFirst({
      where: { service: SERVICE_NAME, cityCode },
      orderBy: { createdAt: 'desc' },
    });

    // 記錄失敗
    await prisma.systemHealthLog.create({
      data: {
        service: SERVICE_NAME,
        status: HealthStatus.UNHEALTHY,
        previousStatus: previousLog?.status,
        message: errorMessage,
        checkType,
        responseTimeMs,
        cityCode,
        details: {
          errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        },
      },
    });

    // 處理告警
    await this.handleStatusChange(
      configKey,
      HealthStatus.UNHEALTHY,
      previousLog?.status,
      errorMessage
    );

    return {
      success: false,
      status: HealthStatus.UNHEALTHY,
      responseTimeMs,
      error: errorMessage,
    };
  }

  /**
   * 獲取城市的活躍配置
   */
  private async getActiveConfigForCity(
    cityCode: string
  ): Promise<{ id: string; baseUrl: string; endpointPath: string } | null> {
    const config = await prisma.webhookConfig.findFirst({
      where: {
        cityCode,
        isActive: true,
      },
      select: {
        id: true,
        baseUrl: true,
        endpointPath: true,
      },
    });

    return config;
  }

  /**
   * 獲取第一個活躍配置
   */
  private async getFirstActiveConfig(): Promise<{
    id: string;
    baseUrl: string;
    endpointPath: string;
  } | null> {
    const config = await prisma.webhookConfig.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        baseUrl: true,
        endpointPath: true,
      },
    });

    return config;
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * n8n 健康監控服務單例
 */
export const n8nHealthService = new N8nHealthService();
