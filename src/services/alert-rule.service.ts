/**
 * @fileoverview 警報規則服務
 * @description
 *   提供警報規則的 CRUD 操作、查詢和管理功能
 *   支援條件式警報觸發配置
 *
 * @module src/services/alert-rule.service
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type {
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  AlertRuleResponse,
  AlertRuleListParams,
  AlertSeverity,
  AlertConditionType,
} from '@/types/alerts';

// ============================================================
// Types
// ============================================================

interface AlertRuleListResult {
  rules: AlertRuleResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// AlertRuleService Class
// ============================================================

/**
 * 警報規則服務類別
 */
export class AlertRuleService {
  /**
   * 創建警報規則
   */
  async create(
    data: CreateAlertRuleRequest,
    createdById: string
  ): Promise<AlertRuleResponse> {
    const rule = await prisma.alertRule.create({
      data: {
        name: data.name,
        description: data.description,
        conditionType: data.conditionType,
        metric: data.metric,
        operator: data.operator,
        threshold: data.threshold,
        duration: data.duration,
        serviceName: data.serviceName,
        endpoint: data.endpoint,
        severity: data.severity,
        channels: data.channels,
        recipients: data.recipients,
        cooldownMinutes: data.cooldownMinutes ?? 15,
        cityId: data.cityId,
        createdById,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        city: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            alerts: true,
          },
        },
      },
    });

    return rule as AlertRuleResponse;
  }

  /**
   * 獲取警報規則列表
   */
  async list(params: AlertRuleListParams): Promise<AlertRuleListResult> {
    const {
      page = 1,
      limit = 20,
      isActive,
      severity,
      conditionType,
      cityId,
      search,
    } = params;

    const where: Prisma.AlertRuleWhereInput = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (severity) {
      where.severity = severity;
    }

    if (conditionType) {
      where.conditionType = conditionType;
    }

    if (cityId) {
      where.cityId = cityId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { metric: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rules, total] = await Promise.all([
      prisma.alertRule.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          city: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              alerts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.alertRule.count({ where }),
    ]);

    return {
      rules: rules as AlertRuleResponse[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 獲取單個警報規則詳情
   */
  async getById(id: string): Promise<AlertRuleResponse | null> {
    const rule = await prisma.alertRule.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        city: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            alerts: true,
          },
        },
      },
    });

    return rule as AlertRuleResponse | null;
  }

  /**
   * 更新警報規則
   */
  async update(
    id: string,
    data: UpdateAlertRuleRequest
  ): Promise<AlertRuleResponse> {
    // Build update data object with proper null handling
    const updateData: Prisma.AlertRuleUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.conditionType !== undefined) updateData.conditionType = data.conditionType;
    if (data.metric !== undefined) updateData.metric = data.metric;
    if (data.operator !== undefined) updateData.operator = data.operator;
    if (data.threshold !== undefined) updateData.threshold = data.threshold;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.serviceName !== undefined) updateData.serviceName = data.serviceName;
    if (data.endpoint !== undefined) updateData.endpoint = data.endpoint;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.channels !== undefined) updateData.channels = data.channels;
    if (data.recipients !== undefined) updateData.recipients = data.recipients;
    if (data.cooldownMinutes !== undefined) {
      // cooldownMinutes is non-nullable Int in schema, default to 15 if null
      updateData.cooldownMinutes = data.cooldownMinutes ?? 15;
    }

    // Handle nullable city relation
    if (data.cityId !== undefined) {
      if (data.cityId === null) {
        updateData.city = { disconnect: true };
      } else {
        updateData.city = { connect: { id: data.cityId } };
      }
    }

    const rule = await prisma.alertRule.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        city: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            alerts: true,
          },
        },
      },
    });

    return rule as AlertRuleResponse;
  }

  /**
   * 刪除警報規則
   */
  async delete(id: string): Promise<void> {
    await prisma.alertRule.delete({
      where: { id },
    });
  }

  /**
   * 切換警報規則啟用狀態
   */
  async toggle(id: string): Promise<AlertRuleResponse> {
    const current = await prisma.alertRule.findUnique({
      where: { id },
      select: { isActive: true },
    });

    if (!current) {
      throw new Error('Alert rule not found');
    }

    const rule = await prisma.alertRule.update({
      where: { id },
      data: { isActive: !current.isActive },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        city: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            alerts: true,
          },
        },
      },
    });

    return rule as AlertRuleResponse;
  }

  /**
   * 獲取活躍的警報規則
   */
  async getActiveRules(): Promise<AlertRuleResponse[]> {
    const rules = await prisma.alertRule.findMany({
      where: { isActive: true },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        city: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            alerts: true,
          },
        },
      },
    });

    return rules as AlertRuleResponse[];
  }

  /**
   * 獲取按嚴重程度統計的規則數量
   */
  async getCountBySeverity(): Promise<Record<AlertSeverity, number>> {
    const counts = await prisma.alertRule.groupBy({
      by: ['severity'],
      _count: true,
    });

    const result: Record<string, number> = {
      INFO: 0,
      WARNING: 0,
      CRITICAL: 0,
      EMERGENCY: 0,
    };

    for (const item of counts) {
      result[item.severity] = item._count;
    }

    return result as Record<AlertSeverity, number>;
  }

  /**
   * 獲取按條件類型統計的規則數量
   */
  async getCountByConditionType(): Promise<Record<AlertConditionType, number>> {
    const counts = await prisma.alertRule.groupBy({
      by: ['conditionType'],
      _count: true,
    });

    const result: Record<string, number> = {};

    for (const item of counts) {
      result[item.conditionType] = item._count;
    }

    return result as Record<AlertConditionType, number>;
  }

  /**
   * 檢查規則名稱是否已存在
   */
  async isNameExists(name: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.AlertRuleWhereInput = { name };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await prisma.alertRule.count({ where });
    return count > 0;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const alertRuleService = new AlertRuleService();
