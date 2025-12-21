/**
 * @fileoverview 警報評估背景任務
 * @description
 *   定期執行警報規則評估，檢查指標值並觸發或恢復警報
 *   支援多種指標來源（系統指標、資料庫查詢、外部 API）
 *
 * @module src/services/alert-evaluation-job
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import { prisma } from '@/lib/prisma';
import { alertEvaluationService } from './alert-evaluation.service';
import { alertNotificationService } from './alert-notification.service';
import type { AlertRule, Alert } from '@prisma/client';
import type { MetricValue, AlertConditionType } from '@/types/alerts';

// ============================================================
// Types
// ============================================================

interface AlertWithRule extends Alert {
  rule: AlertRule;
}

interface JobExecutionResult {
  rulesEvaluated: number;
  alertsFired: number;
  alertsRecovered: number;
  errors: string[];
  duration: number;
}

// ============================================================
// Metric Collectors
// ============================================================

/**
 * 指標收集器介面
 */
interface MetricCollector {
  collect(rule: AlertRule): Promise<MetricValue | null>;
}

/**
 * 服務停機指標收集器
 */
class ServiceDownCollector implements MetricCollector {
  async collect(rule: AlertRule): Promise<MetricValue | null> {
    // 檢查服務健康狀態
    const serviceName = rule.serviceName || 'unknown';

    try {
      const healthLog = await prisma.systemHealthLog.findFirst({
        where: {
          service: serviceName,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!healthLog) {
        return null;
      }

      // 1 = 服務正常, 0 = 服務停機
      const isHealthy = healthLog.status === 'HEALTHY';

      return {
        name: `service.${serviceName}.status`,
        value: isHealthy ? 1 : 0,
        timestamp: new Date(),
        labels: { service: serviceName },
      };
    } catch {
      return null;
    }
  }
}

/**
 * 錯誤率指標收集器
 */
class ErrorRateCollector implements MetricCollector {
  async collect(rule: AlertRule): Promise<MetricValue | null> {
    const serviceName = rule.serviceName || 'all';
    const duration = rule.duration || 300; // 預設 5 分鐘

    try {
      const since = new Date();
      since.setSeconds(since.getSeconds() - duration);

      // 從 API 審計日誌計算錯誤率
      const [totalLogs, errorLogs] = await Promise.all([
        prisma.apiAuditLog.count({
          where: {
            createdAt: { gte: since },
            ...(serviceName !== 'all' && { endpoint: { contains: serviceName } }),
          },
        }),
        prisma.apiAuditLog.count({
          where: {
            createdAt: { gte: since },
            statusCode: { gte: 400 },
            ...(serviceName !== 'all' && { endpoint: { contains: serviceName } }),
          },
        }),
      ]);

      const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

      return {
        name: `service.${serviceName}.error_rate`,
        value: errorRate,
        timestamp: new Date(),
        labels: { service: serviceName },
      };
    } catch {
      return null;
    }
  }
}

/**
 * 回應時間指標收集器
 */
class ResponseTimeCollector implements MetricCollector {
  async collect(rule: AlertRule): Promise<MetricValue | null> {
    const endpoint = rule.endpoint || 'all';
    const duration = rule.duration || 60; // 預設 1 分鐘

    try {
      const since = new Date();
      since.setSeconds(since.getSeconds() - duration);

      const metrics = await prisma.apiPerformanceMetric.findMany({
        where: {
          timestamp: { gte: since },
          ...(endpoint !== 'all' && { endpoint: { contains: endpoint } }),
        },
        select: { responseTime: true },
      });

      if (metrics.length === 0) {
        return null;
      }

      const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;

      return {
        name: `api.${endpoint}.response_time`,
        value: avgResponseTime,
        timestamp: new Date(),
        labels: { endpoint },
      };
    } catch {
      return null;
    }
  }
}

/**
 * 佇列積壓指標收集器
 */
class QueueBacklogCollector implements MetricCollector {
  async collect(_rule: AlertRule): Promise<MetricValue | null> {
    try {
      // 計算待處理的文件數量
      const backlog = await prisma.processingQueue.count({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      });

      return {
        name: 'queue.backlog',
        value: backlog,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }
}

/**
 * CPU 使用率指標收集器
 */
class CpuHighCollector implements MetricCollector {
  async collect(_rule: AlertRule): Promise<MetricValue | null> {
    try {
      const metric = await prisma.systemResourceMetric.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      if (!metric) {
        return null;
      }

      return {
        name: 'system.cpu_usage',
        value: metric.cpuUsage,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }
}

/**
 * 記憶體使用率指標收集器
 */
class MemoryHighCollector implements MetricCollector {
  async collect(_rule: AlertRule): Promise<MetricValue | null> {
    try {
      const metric = await prisma.systemResourceMetric.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      if (!metric) {
        return null;
      }

      return {
        name: 'system.memory_usage',
        value: metric.memoryUsage,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }
}

// ============================================================
// AlertEvaluationJob Class
// ============================================================

/**
 * 警報評估背景任務
 */
export class AlertEvaluationJob {
  private collectors: Map<AlertConditionType, MetricCollector>;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.collectors = new Map([
      ['SERVICE_DOWN', new ServiceDownCollector()],
      ['ERROR_RATE', new ErrorRateCollector()],
      ['RESPONSE_TIME', new ResponseTimeCollector()],
      ['QUEUE_BACKLOG', new QueueBacklogCollector()],
      ['CPU_HIGH', new CpuHighCollector()],
      ['MEMORY_HIGH', new MemoryHighCollector()],
    ]);
  }

  /**
   * 啟動評估任務
   */
  start(intervalSeconds: number = 60): void {
    if (this.isRunning) {
      console.log('[AlertEvaluationJob] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[AlertEvaluationJob] Starting with ${intervalSeconds}s interval`);

    // 立即執行一次
    this.run();

    // 設定定期執行
    this.intervalId = setInterval(() => {
      this.run();
    }, intervalSeconds * 1000);
  }

  /**
   * 停止評估任務
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[AlertEvaluationJob] Stopped');
  }

  /**
   * 執行評估
   */
  async run(): Promise<JobExecutionResult> {
    const startTime = Date.now();
    const result: JobExecutionResult = {
      rulesEvaluated: 0,
      alertsFired: 0,
      alertsRecovered: 0,
      errors: [],
      duration: 0,
    };

    try {
      // 獲取所有活躍的規則
      const rules = await prisma.alertRule.findMany({
        where: { isActive: true },
      });

      result.rulesEvaluated = rules.length;

      // 評估每個規則
      for (const rule of rules) {
        try {
          await this.evaluateRule(rule, result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Rule ${rule.id}: ${errorMessage}`);
        }
      }

      // 檢查是否有需要恢復的警報
      await this.checkRecoveries(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Job error: ${errorMessage}`);
    }

    result.duration = Date.now() - startTime;

    console.log(
      `[AlertEvaluationJob] Completed: ${result.rulesEvaluated} rules, ` +
      `${result.alertsFired} fired, ${result.alertsRecovered} recovered, ` +
      `${result.errors.length} errors, ${result.duration}ms`
    );

    return result;
  }

  /**
   * 評估單個規則
   */
  private async evaluateRule(rule: AlertRule, result: JobExecutionResult): Promise<void> {
    const collector = this.collectors.get(rule.conditionType as AlertConditionType);

    if (!collector) {
      // 自定義指標暫不支援
      return;
    }

    // 收集指標
    const metricValue = await collector.collect(rule);

    if (!metricValue) {
      return;
    }

    // 評估規則
    const evaluation = await alertEvaluationService.evaluateRule(rule, metricValue);

    if (evaluation.shouldFire) {
      // 檢查是否已有活躍警報
      const existingAlert = await alertEvaluationService.getActiveAlert(rule.id);

      if (existingAlert) {
        // 已有警報，不重複觸發
        return;
      }

      // 檢查冷卻期
      const inCooldown = await alertEvaluationService.isInCooldown(
        rule.id,
        rule.cooldownMinutes
      );

      if (inCooldown) {
        return;
      }

      // 創建新警報
      const alertId = await alertEvaluationService.createAlert(
        rule,
        metricValue.value,
        {
          metric: metricValue.name,
          labels: metricValue.labels,
          evaluationReason: evaluation.reason,
        }
      );

      result.alertsFired++;

      // 發送通知
      const alertWithRule = await prisma.alert.findUnique({
        where: { id: alertId },
        include: { rule: true },
      });

      if (alertWithRule) {
        await alertNotificationService.sendNotifications(alertWithRule as AlertWithRule);
      }
    }
  }

  /**
   * 檢查是否有需要恢復的警報
   */
  private async checkRecoveries(result: JobExecutionResult): Promise<void> {
    // 獲取所有觸發中的警報
    const firingAlerts = await prisma.alert.findMany({
      where: { status: 'FIRING' },
      include: { rule: true },
    });

    for (const alert of firingAlerts) {
      try {
        const rule = alert.rule;
        const collector = this.collectors.get(rule.conditionType as AlertConditionType);

        if (!collector) {
          continue;
        }

        // 收集當前指標
        const metricValue = await collector.collect(rule);

        if (!metricValue) {
          continue;
        }

        // 評估規則
        const evaluation = await alertEvaluationService.evaluateRule(rule, metricValue);

        if (!evaluation.shouldFire) {
          // 條件不再滿足，恢復警報
          await alertEvaluationService.recoverAlert(alert.id);
          result.alertsRecovered++;

          // 發送恢復通知
          const alertWithRule = await prisma.alert.findUnique({
            where: { id: alert.id },
            include: { rule: true },
          });

          if (alertWithRule) {
            await alertNotificationService.sendRecoveryNotifications(
              alertWithRule as AlertWithRule
            );
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Recovery check for alert ${alert.id}: ${errorMessage}`);
      }
    }
  }

  /**
   * 手動觸發單個規則評估
   */
  async evaluateSingleRule(ruleId: string): Promise<{
    shouldFire: boolean;
    currentValue: number | null;
    threshold: number;
    reason?: string;
  }> {
    const rule = await prisma.alertRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new Error('Rule not found');
    }

    const collector = this.collectors.get(rule.conditionType as AlertConditionType);

    if (!collector) {
      return {
        shouldFire: false,
        currentValue: null,
        threshold: rule.threshold,
        reason: 'Unsupported condition type',
      };
    }

    const metricValue = await collector.collect(rule);

    if (!metricValue) {
      return {
        shouldFire: false,
        currentValue: null,
        threshold: rule.threshold,
        reason: 'No metric data available',
      };
    }

    const evaluation = await alertEvaluationService.evaluateRule(rule, metricValue);

    return {
      shouldFire: evaluation.shouldFire,
      currentValue: metricValue.value,
      threshold: rule.threshold,
      reason: evaluation.reason,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const alertEvaluationJob = new AlertEvaluationJob();
