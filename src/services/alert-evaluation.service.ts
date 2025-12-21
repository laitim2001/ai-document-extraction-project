/**
 * @fileoverview 警報評估服務
 * @description
 *   負責評估警報規則的觸發條件
 *   包含指標比較、冷卻期檢查、警報創建和恢復邏輯
 *
 * @module src/services/alert-evaluation.service
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import { prisma } from '@/lib/prisma';
import { Prisma, type AlertRule, type AlertStatus } from '@prisma/client';
import type {
  MetricValue,
  AlertOperator,
} from '@/types/alerts';

// ============================================================
// Types
// ============================================================

interface EvaluationResult {
  ruleId: string;
  shouldFire: boolean;
  currentValue: number;
  threshold: number;
  reason?: string;
}

interface ActiveAlert {
  id: string;
  ruleId: string;
  triggeredAt: Date;
  triggeredValue: number;
}

// ============================================================
// AlertEvaluationService Class
// ============================================================

/**
 * 警報評估服務類別
 */
export class AlertEvaluationService {
  /**
   * 評估單個規則
   */
  async evaluateRule(rule: AlertRule, metricValue: MetricValue): Promise<EvaluationResult> {
    const shouldFire = this.compareValue(
      metricValue.value,
      rule.threshold,
      rule.operator as AlertOperator
    );

    return {
      ruleId: rule.id,
      shouldFire,
      currentValue: metricValue.value,
      threshold: rule.threshold,
      reason: shouldFire
        ? `${metricValue.name} (${metricValue.value}) ${this.getOperatorSymbol(rule.operator as AlertOperator)} ${rule.threshold}`
        : undefined,
    };
  }

  /**
   * 比較指標值與閾值
   */
  private compareValue(
    value: number,
    threshold: number,
    operator: AlertOperator
  ): boolean {
    switch (operator) {
      case 'GREATER_THAN':
        return value > threshold;
      case 'GREATER_THAN_EQ':
        return value >= threshold;
      case 'LESS_THAN':
        return value < threshold;
      case 'LESS_THAN_EQ':
        return value <= threshold;
      case 'EQUALS':
        return value === threshold;
      case 'NOT_EQUALS':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * 獲取運算符符號
   */
  private getOperatorSymbol(operator: AlertOperator): string {
    const symbols: Record<AlertOperator, string> = {
      GREATER_THAN: '>',
      GREATER_THAN_EQ: '>=',
      LESS_THAN: '<',
      LESS_THAN_EQ: '<=',
      EQUALS: '=',
      NOT_EQUALS: '!=',
    };
    return symbols[operator] || '?';
  }

  /**
   * 檢查是否在冷卻期內
   */
  async isInCooldown(ruleId: string, cooldownMinutes: number): Promise<boolean> {
    const cooldownEnd = new Date();
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() - cooldownMinutes);

    const recentAlert = await prisma.alert.findFirst({
      where: {
        ruleId,
        triggeredAt: { gte: cooldownEnd },
      },
      orderBy: { triggeredAt: 'desc' },
    });

    return recentAlert !== null;
  }

  /**
   * 創建警報
   */
  async createAlert(
    rule: AlertRule,
    triggeredValue: number,
    details?: Record<string, unknown>
  ): Promise<string> {
    const alert = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        status: 'FIRING',
        triggeredValue,
        triggeredAt: new Date(),
        details: details as Prisma.InputJsonValue | undefined,
        metricData: {
          metric: rule.metric,
          threshold: rule.threshold,
          operator: rule.operator,
          duration: rule.duration,
        },
        cityId: rule.cityId,
      },
    });

    return alert.id;
  }

  /**
   * 獲取活躍的警報
   */
  async getActiveAlert(ruleId: string): Promise<ActiveAlert | null> {
    const alert = await prisma.alert.findFirst({
      where: {
        ruleId,
        status: 'FIRING',
      },
      orderBy: { triggeredAt: 'desc' },
      select: {
        id: true,
        ruleId: true,
        triggeredAt: true,
        triggeredValue: true,
      },
    });

    return alert;
  }

  /**
   * 恢復警報
   */
  async recoverAlert(alertId: string): Promise<void> {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'RECOVERED',
        recoveredAt: new Date(),
      },
    });
  }

  /**
   * 確認警報
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    note?: string
  ): Promise<void> {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy,
        acknowledgedAt: new Date(),
        details: note ? { note } : undefined,
      },
    });
  }

  /**
   * 解決警報
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedBy,
        resolvedAt: new Date(),
        resolution,
      },
    });
  }

  /**
   * 獲取警報列表
   */
  async listAlerts(params: {
    page?: number;
    limit?: number;
    status?: AlertStatus;
    ruleId?: string;
    cityId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const {
      page = 1,
      limit = 20,
      status,
      ruleId,
      cityId,
      startDate,
      endDate,
    } = params;

    const where: Prisma.AlertWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (ruleId) {
      where.ruleId = ruleId;
    }

    if (cityId) {
      where.cityId = cityId;
    }

    if (startDate || endDate) {
      where.triggeredAt = {};
      if (startDate) {
        where.triggeredAt.gte = startDate;
      }
      if (endDate) {
        where.triggeredAt.lte = endDate;
      }
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              severity: true,
              conditionType: true,
              metric: true,
              operator: true,
              threshold: true,
            },
          },
          city: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { triggeredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.alert.count({ where }),
    ]);

    return {
      alerts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 獲取單個警報詳情
   */
  async getAlertById(alertId: string) {
    return prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            severity: true,
            conditionType: true,
            metric: true,
            operator: true,
            threshold: true,
          },
        },
        city: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        notifications: true,
      },
    });
  }

  /**
   * 獲取警報統計
   */
  async getStatistics(cityId?: string) {
    const where = cityId ? { cityId } : {};

    const [
      totalAlerts,
      firingAlerts,
      acknowledgedAlerts,
      resolvedAlerts,
      recoveredAlerts,
    ] = await Promise.all([
      prisma.alert.count({ where }),
      prisma.alert.count({ where: { ...where, status: 'FIRING' } }),
      prisma.alert.count({ where: { ...where, status: 'ACKNOWLEDGED' } }),
      prisma.alert.count({ where: { ...where, status: 'RESOLVED' } }),
      prisma.alert.count({ where: { ...where, status: 'RECOVERED' } }),
    ]);

    // 計算平均解決時間
    const resolvedWithTime = await prisma.alert.findMany({
      where: {
        ...where,
        status: 'RESOLVED',
        resolvedAt: { not: null },
      },
      select: {
        triggeredAt: true,
        resolvedAt: true,
      },
    });

    let avgResolutionTime: number | null = null;
    if (resolvedWithTime.length > 0) {
      const totalTime = resolvedWithTime.reduce((sum, alert) => {
        if (alert.resolvedAt) {
          return sum + (alert.resolvedAt.getTime() - alert.triggeredAt.getTime());
        }
        return sum;
      }, 0);
      avgResolutionTime = totalTime / resolvedWithTime.length / 60000; // 轉換為分鐘
    }

    // 計算平均恢復時間
    const recoveredWithTime = await prisma.alert.findMany({
      where: {
        ...where,
        status: 'RECOVERED',
        recoveredAt: { not: null },
      },
      select: {
        triggeredAt: true,
        recoveredAt: true,
      },
    });

    let avgRecoveryTime: number | null = null;
    if (recoveredWithTime.length > 0) {
      const totalTime = recoveredWithTime.reduce((sum, alert) => {
        if (alert.recoveredAt) {
          return sum + (alert.recoveredAt.getTime() - alert.triggeredAt.getTime());
        }
        return sum;
      }, 0);
      avgRecoveryTime = totalTime / recoveredWithTime.length / 60000; // 轉換為分鐘
    }

    // 獲取按條件類型統計
    const byConditionTypeRaw = await prisma.alert.findMany({
      where,
      select: {
        rule: {
          select: {
            conditionType: true,
          },
        },
      },
    });

    const byConditionType: Record<string, number> = {};
    for (const alert of byConditionTypeRaw) {
      const type = alert.rule.conditionType;
      byConditionType[type] = (byConditionType[type] || 0) + 1;
    }

    return {
      totalAlerts,
      firingAlerts,
      acknowledgedAlerts,
      resolvedAlerts,
      recoveredAlerts,
      bySeverity: {
        INFO: 0,
        WARNING: 0,
        CRITICAL: 0,
        EMERGENCY: 0,
      },
      byConditionType,
      avgResolutionTime,
      avgRecoveryTime,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const alertEvaluationService = new AlertEvaluationService();
