/**
 * @fileoverview 系統健康檢查服務
 * @description
 *   本模組負責系統健康狀態的監控與檢查，包含：
 *   - 多服務健康檢查（Web、AI、Database、Storage、n8n、Cache）
 *   - 整體系統狀態計算
 *   - 24 小時可用性統計
 *   - 活躍用戶數統計
 *   - 服務詳細資訊查詢
 *
 *   ## 服務類型
 *   - WEB_APP: Web 應用程式
 *   - AI_SERVICE: AI 處理服務
 *   - DATABASE: PostgreSQL 資料庫
 *   - STORAGE: Azure Blob Storage
 *   - N8N: n8n 工作流
 *   - CACHE: Redis 快取
 *
 *   ## 健康狀態判斷
 *   - HEALTHY: 服務正常運行
 *   - DEGRADED: 服務響應緩慢但可用
 *   - UNHEALTHY: 服務不可用
 *   - UNKNOWN: 無法確定狀態
 *   - UNCONFIGURED: 服務未配置
 *
 * @module src/services/health-check.service
 * @author Development Team
 * @since Epic 12 - Story 12.1
 * @lastModified 2025-12-21
 *
 * @features
 *   - 多服務並行健康檢查
 *   - 資料庫連接檢查
 *   - Redis 連接檢查
 *   - Azure Blob Storage 檢查
 *   - HTTP 端點健康檢查
 *   - 24 小時可用性計算
 *   - 活躍用戶統計
 *   - 服務歷史與指標
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/types/monitoring - 監控類型定義
 *   - @upstash/redis - Redis 客戶端（可選）
 *   - @azure/storage-blob - Azure Blob 客戶端（可選）
 */

import { prisma } from '@/lib/prisma';
import { HealthStatus, ServiceType, Prisma } from '@prisma/client';
import {
  ServiceConfig,
  ServiceHealthResult,
  OverallHealthStatus,
  ServiceHealthDetails,
  HealthCheckDetailResult,
  ACTIVE_USER_THRESHOLD_MINUTES,
} from '@/types/monitoring';

// ============================================================
// Constants
// ============================================================

/**
 * 服務配置列表
 */
const SERVICES_CONFIG: ServiceConfig[] = [
  {
    name: 'web',
    type: ServiceType.WEB_APP,
    endpoint: '/api/health',
    timeout: 5000,
    checkInterval: 30000,
  },
  {
    name: 'ai',
    type: ServiceType.AI_SERVICE,
    endpoint: process.env.AI_SERVICE_URL ? `${process.env.AI_SERVICE_URL}/health` : '',
    timeout: 10000,
    checkInterval: 30000,
  },
  {
    name: 'database',
    type: ServiceType.DATABASE,
    endpoint: 'prisma',
    timeout: 5000,
    checkInterval: 30000,
  },
  {
    name: 'storage',
    type: ServiceType.STORAGE,
    endpoint: process.env.AZURE_STORAGE_URL || '',
    timeout: 10000,
    checkInterval: 60000,
  },
  {
    name: 'n8n',
    type: ServiceType.N8N,
    endpoint: process.env.N8N_BASE_URL ? `${process.env.N8N_BASE_URL}/healthz` : '',
    timeout: 10000,
    checkInterval: 60000,
  },
  {
    name: 'cache',
    type: ServiceType.CACHE,
    endpoint: 'redis',
    timeout: 3000,
    checkInterval: 30000,
  },
];

// ============================================================
// Service Class
// ============================================================

/**
 * @class HealthCheckService
 * @description 系統健康檢查服務
 */
export class HealthCheckService {
  // ============================================================
  // Public Methods
  // ============================================================

  /**
   * 執行所有服務的健康檢查
   *
   * @description
   *   對所有配置的服務執行健康檢查，記錄結果到資料庫，
   *   並更新整體系統狀態。
   *
   * @returns 所有服務的健康檢查結果
   */
  async checkAllServices(): Promise<ServiceHealthResult[]> {
    const results: ServiceHealthResult[] = [];
    const previousStatuses = await this.getPreviousStatuses();

    for (const service of SERVICES_CONFIG) {
      const result = await this.checkService(service);
      results.push(result);

      // 記錄到資料庫
      await prisma.serviceHealthCheck.create({
        data: {
          serviceName: service.name,
          serviceType: service.type,
          status: result.status,
          responseTime: result.responseTime,
          errorMessage: result.errorMessage,
          errorCode: result.errorCode,
          details: result.details as Prisma.InputJsonValue,
          endpoint: service.endpoint,
        },
      });

      // 檢查狀態變化
      const previousStatus = previousStatuses.get(service.name);
      if (previousStatus && previousStatus !== result.status) {
        await this.handleStatusChange(service.name, previousStatus, result.status);
      }
    }

    // 更新整體狀態
    await this.updateOverallStatus(results);

    return results;
  }

  /**
   * 檢查單一服務
   *
   * @param config - 服務配置
   * @returns 健康檢查結果
   */
  async checkService(config: ServiceConfig): Promise<ServiceHealthResult> {
    const startTime = Date.now();

    try {
      let checkResult: HealthCheckDetailResult;

      switch (config.type) {
        case ServiceType.DATABASE:
          checkResult = await this.checkDatabase(config.timeout);
          break;

        case ServiceType.CACHE:
          checkResult = await this.checkRedis(config.timeout);
          break;

        case ServiceType.STORAGE:
          checkResult = await this.checkStorage(config.timeout);
          break;

        default:
          checkResult = await this.checkHttpEndpoint(config.endpoint, config.timeout);
      }

      return {
        serviceName: config.name,
        serviceType: config.type,
        status: checkResult.status,
        responseTime: Date.now() - startTime,
        details: checkResult.details,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        serviceName: config.name,
        serviceType: config.type,
        status: HealthStatus.UNHEALTHY,
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date(),
      };
    }
  }

  /**
   * 獲取整體健康狀態
   *
   * @returns 整體健康狀態
   */
  async getOverallHealth(): Promise<OverallHealthStatus> {
    // 獲取最新的服務狀態
    const latestChecks = await prisma.serviceHealthCheck.findMany({
      where: {
        checkedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { checkedAt: 'desc' },
      distinct: ['serviceName'],
    });

    // 獲取整體狀態
    const overallStatus = await prisma.systemOverallStatus.findUnique({
      where: { id: 'current' },
    });

    // 計算 24 小時可用性
    const availability24h = await this.calculate24hAvailability();

    return {
      status: overallStatus?.status || HealthStatus.UNKNOWN,
      services: latestChecks.map((check) => ({
        serviceName: check.serviceName,
        serviceType: check.serviceType,
        status: check.status,
        responseTime: check.responseTime || undefined,
        errorMessage: check.errorMessage || undefined,
        details: check.details as Record<string, unknown> | undefined,
        checkedAt: check.checkedAt,
      })),
      activeUsers: overallStatus?.activeUsers || 0,
      availability24h,
      lastUpdated: overallStatus?.lastUpdated || new Date(),
    };
  }

  /**
   * 獲取服務詳情
   *
   * @param serviceName - 服務名稱
   * @param hours - 查詢時間範圍（小時）
   * @returns 服務詳細資訊
   */
  async getServiceDetails(serviceName: string, hours: number = 24): Promise<ServiceHealthDetails> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // 獲取最新狀態
    const latestCheck = await prisma.serviceHealthCheck.findFirst({
      where: { serviceName },
      orderBy: { checkedAt: 'desc' },
    });

    // 獲取歷史記錄
    const history = await prisma.serviceHealthCheck.findMany({
      where: {
        serviceName,
        checkedAt: { gt: since },
      },
      orderBy: { checkedAt: 'asc' },
      select: {
        checkedAt: true,
        status: true,
        responseTime: true,
      },
    });

    // 獲取錯誤日誌
    const errorLogs = await prisma.serviceHealthCheck.findMany({
      where: {
        serviceName,
        checkedAt: { gt: since },
        status: { in: [HealthStatus.UNHEALTHY, HealthStatus.DEGRADED] },
      },
      orderBy: { checkedAt: 'desc' },
      take: 20,
      select: {
        checkedAt: true,
        errorMessage: true,
        errorCode: true,
      },
    });

    // 計算指標
    const responseTimes = history
      .map((h) => h.responseTime)
      .filter((t): t is number => t !== null);

    const unhealthyCount = history.filter((h) => h.status === HealthStatus.UNHEALTHY).length;

    return {
      service: latestCheck
        ? {
            serviceName: latestCheck.serviceName,
            serviceType: latestCheck.serviceType,
            status: latestCheck.status,
            responseTime: latestCheck.responseTime || undefined,
            errorMessage: latestCheck.errorMessage || undefined,
            details: latestCheck.details as Record<string, unknown> | undefined,
            checkedAt: latestCheck.checkedAt,
          }
        : null,
      history: history.map((h) => ({
        checkedAt: h.checkedAt,
        status: h.status,
        responseTime: h.responseTime,
      })),
      errorLogs: errorLogs.map((e) => ({
        checkedAt: e.checkedAt,
        errorMessage: e.errorMessage,
        errorCode: e.errorCode,
      })),
      metrics: {
        avgResponseTime:
          responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0,
        maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
        minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        errorRate: history.length > 0 ? (unhealthyCount / history.length) * 100 : 0,
      },
    };
  }

  /**
   * 獲取服務配置列表
   *
   * @returns 服務配置列表
   */
  getServicesConfig(): ServiceConfig[] {
    return [...SERVICES_CONFIG];
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 獲取之前的服務狀態
   */
  private async getPreviousStatuses(): Promise<Map<string, HealthStatus>> {
    const statuses = new Map<string, HealthStatus>();

    const latestChecks = await prisma.serviceHealthCheck.findMany({
      where: {
        checkedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { checkedAt: 'desc' },
      distinct: ['serviceName'],
    });

    for (const check of latestChecks) {
      statuses.set(check.serviceName, check.status);
    }

    return statuses;
  }

  /**
   * 處理狀態變化
   */
  private async handleStatusChange(
    serviceName: string,
    oldStatus: HealthStatus,
    newStatus: HealthStatus
  ): Promise<void> {
    // 記錄狀態變化到系統日誌（健康監控需要此日誌）
    // eslint-disable-next-line no-console
    console.log(`[HealthCheck] Service ${serviceName} status changed: ${oldStatus} → ${newStatus}`);

    // TODO: 整合 WebSocket 通知（Story 12-1 Phase 2）
    // const { broadcastServiceChange } = await import('@/lib/websocket/healthWebSocket')
    // broadcastServiceChange(serviceName, oldStatus, newStatus)
  }

  /**
   * 檢查 HTTP 端點
   */
  private async checkHttpEndpoint(
    url: string,
    timeout: number
  ): Promise<HealthCheckDetailResult> {
    // 如果端點未配置
    if (!url) {
      return {
        status: HealthStatus.UNCONFIGURED,
        details: { message: 'Endpoint not configured' },
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 構建完整 URL（如果是相對路徑）
      const fullUrl = url.startsWith('/')
        ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${url}`
        : url;

      const response = await fetch(fullUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          status: HealthStatus.HEALTHY,
          details: { statusCode: response.status, ...data },
        };
      } else if (response.status >= 500) {
        return {
          status: HealthStatus.UNHEALTHY,
          details: { statusCode: response.status },
        };
      } else {
        return {
          status: HealthStatus.DEGRADED,
          details: { statusCode: response.status },
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: HealthStatus.DEGRADED,
          details: { message: 'Request timed out' },
        };
      }
      throw error;
    }
  }

  /**
   * 檢查數據庫
   */
  private async checkDatabase(timeout: number): Promise<HealthCheckDetailResult> {
    try {
      const startTime = Date.now();

      // 執行簡單查詢測試連接
      await prisma.$queryRaw`SELECT 1`;

      const queryTime = Date.now() - startTime;

      return {
        status: queryTime > timeout / 2 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
        details: {
          queryTime,
          provider: 'postgresql',
          connected: true,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 檢查 Redis
   */
  private async checkRedis(_timeout: number): Promise<HealthCheckDetailResult> {
    // 檢查 Redis 是否配置
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return {
        status: HealthStatus.UNCONFIGURED,
        details: { message: 'Redis not configured' },
      };
    }

    try {
      const startTime = Date.now();

      // 動態載入 Redis 客戶端（處理模組未安裝的情況）
      let Redis: { new (config: { url: string; token: string }): { ping(): Promise<string> } };
      try {
        const upstashRedis = await import('@upstash/redis');
        Redis = upstashRedis.Redis;
      } catch {
        return {
          status: HealthStatus.UNCONFIGURED,
          details: { message: 'Redis client not installed (@upstash/redis)' },
        };
      }

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      // 執行 PING 測試
      const pong = await redis.ping();
      const pingTime = Date.now() - startTime;

      return {
        status: pong === 'PONG' ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        details: {
          pingTime,
          response: pong,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 檢查 Azure Blob Storage
   */
  private async checkStorage(_timeout: number): Promise<HealthCheckDetailResult> {
    // 檢查 Storage 是否配置
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      return {
        status: HealthStatus.UNCONFIGURED,
        details: { message: 'Azure Storage not configured' },
      };
    }

    try {
      const startTime = Date.now();

      // 動態載入 Azure Storage 客戶端
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
      );

      // 列出容器測試連接
      const containers: string[] = [];
      for await (const container of blobServiceClient.listContainers()) {
        containers.push(container.name);
        if (containers.length >= 1) break;
      }

      const checkTime = Date.now() - startTime;

      // 獲取帳戶資訊
      const accountInfo = await blobServiceClient.getAccountInfo();

      return {
        status: HealthStatus.HEALTHY,
        details: {
          checkTime,
          accountKind: accountInfo.accountKind,
          skuName: accountInfo.skuName,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 更新整體狀態
   */
  private async updateOverallStatus(results: ServiceHealthResult[]): Promise<void> {
    const healthyCount = results.filter((r) => r.status === HealthStatus.HEALTHY).length;
    const degradedCount = results.filter((r) => r.status === HealthStatus.DEGRADED).length;
    const unhealthyCount = results.filter((r) => r.status === HealthStatus.UNHEALTHY).length;

    let overallStatus: HealthStatus = HealthStatus.HEALTHY;
    if (unhealthyCount > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (degradedCount > 0) {
      overallStatus = HealthStatus.DEGRADED;
    }

    // 獲取活躍用戶數
    const activeUsers = await this.getActiveUserCount();

    await prisma.systemOverallStatus.upsert({
      where: { id: 'current' },
      update: {
        status: overallStatus,
        activeUsers,
        servicesSummary: {
          healthy: healthyCount,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
        },
        lastUpdated: new Date(),
      },
      create: {
        id: 'current',
        status: overallStatus,
        activeUsers,
        servicesSummary: {
          healthy: healthyCount,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
        },
      },
    });

    // TODO: 廣播更新（Story 12-1 Phase 2）
    // const overallHealth = await this.getOverallHealth()
    // const { broadcastHealthUpdate } = await import('@/lib/websocket/healthWebSocket')
    // broadcastHealthUpdate(overallHealth)
  }

  /**
   * 獲取活躍用戶數
   */
  private async getActiveUserCount(): Promise<number> {
    const thresholdTime = new Date(Date.now() - ACTIVE_USER_THRESHOLD_MINUTES * 60 * 1000);

    const count = await prisma.session.count({
      where: {
        expires: { gt: new Date() },
        user: {
          lastActiveAt: { gt: thresholdTime },
        },
      },
    });

    return count;
  }

  /**
   * 計算 24 小時可用性
   *
   * @description
   *   可用性計算公式：
   *   (healthy×100 + degraded×50) / total / 100 × 100
   */
  private async calculate24hAvailability(): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const checks = await prisma.serviceHealthCheck.groupBy({
      by: ['status'],
      where: {
        checkedAt: { gt: twentyFourHoursAgo },
      },
      _count: true,
    });

    const total = checks.reduce((sum, c) => sum + c._count, 0);
    const healthy = checks.find((c) => c.status === HealthStatus.HEALTHY)?._count || 0;
    const degraded = checks.find((c) => c.status === HealthStatus.DEGRADED)?._count || 0;

    if (total === 0) return 100;

    // 健康 = 100%, 降級 = 50%, 異常 = 0%
    const availability = ((healthy * 100 + degraded * 50) / total / 100) * 100;

    return Math.round(availability * 100) / 100;
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 系統健康檢查服務單例
 */
export const healthCheckService = new HealthCheckService();
