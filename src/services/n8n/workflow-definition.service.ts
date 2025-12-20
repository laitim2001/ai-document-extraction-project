/**
 * @fileoverview 工作流定義服務 - 管理 n8n 工作流定義的 CRUD 操作
 * @description
 *   本模組負責工作流定義的生命週期管理，包含：
 *   - 創建工作流定義
 *   - 更新工作流定義
 *   - 刪除工作流定義
 *   - 啟用/停用工作流
 *   - 列表查詢
 *
 *   ## 工作流定義結構
 *   - 基本資訊：名稱、描述、n8n 工作流 ID
 *   - 觸發配置：Webhook URL、HTTP 方法
 *   - 參數定義：JSON Schema 格式
 *   - 權限控制：城市隔離、角色限制
 *
 * @module src/services/n8n/workflow-definition.service
 * @author Development Team
 * @since Epic 10 - Story 10.4
 * @lastModified 2025-12-20
 *
 * @features
 *   - 工作流定義 CRUD
 *   - 城市級別隔離
 *   - 角色權限控制
 *   - 分類和標籤管理
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *
 * @related
 *   - src/types/workflow-trigger.ts - 工作流觸發類型
 *   - prisma/schema.prisma - WorkflowDefinition 模型
 */

import { prisma } from '@/lib/prisma';
import type { WorkflowDefinition, Prisma } from '@prisma/client';
import type {
  CreateWorkflowDefinitionInput,
  UpdateWorkflowDefinitionInput,
  ListWorkflowDefinitionsOptions,
  WorkflowDefinitionListResult,
} from '@/types/workflow-trigger';

// ============================================================
// Constants
// ============================================================

/** 預設每頁數量 */
const DEFAULT_PAGE_SIZE = 20;

// ============================================================
// Service Class
// ============================================================

/**
 * @class WorkflowDefinitionService
 * @description 工作流定義管理服務
 */
export class WorkflowDefinitionService {
  // ============================================================
  // Public Methods - 查詢
  // ============================================================

  /**
   * 列出工作流定義
   *
   * @description
   *   獲取工作流定義列表，支持篩選和分頁
   *
   * @param options - 查詢選項
   * @returns 工作流定義列表和總數
   */
  async listDefinitions(
    options: ListWorkflowDefinitionsOptions = {}
  ): Promise<WorkflowDefinitionListResult> {
    const { cityCode, category, isActive, page = 1, pageSize = DEFAULT_PAGE_SIZE } = options;

    const where: Prisma.WorkflowDefinitionWhereInput = {};

    // 城市篩選（包含全域配置）
    if (cityCode !== undefined) {
      where.OR = [
        { cityCode },
        { cityCode: null },
      ];
    }

    if (category !== undefined) {
      where.category = category;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [items, total] = await Promise.all([
      prisma.workflowDefinition.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          city: true,
          createdByUser: {
            select: { id: true, name: true },
          },
          updatedByUser: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.workflowDefinition.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 獲取工作流定義詳情
   *
   * @param id - 工作流定義 ID
   * @returns 工作流定義或 null
   */
  async getDefinitionById(id: string): Promise<WorkflowDefinition | null> {
    return prisma.workflowDefinition.findUnique({
      where: { id },
      include: {
        city: true,
        createdByUser: {
          select: { id: true, name: true },
        },
        updatedByUser: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * 根據 n8n 工作流 ID 獲取定義
   *
   * @param n8nWorkflowId - n8n 工作流 ID
   * @returns 工作流定義或 null
   */
  async getDefinitionByN8nId(n8nWorkflowId: string): Promise<WorkflowDefinition | null> {
    return prisma.workflowDefinition.findUnique({
      where: { n8nWorkflowId },
    });
  }

  /**
   * 獲取所有分類
   *
   * @param cityCode - 城市代碼（可選）
   * @returns 分類列表
   */
  async getCategories(cityCode?: string): Promise<string[]> {
    const where: Prisma.WorkflowDefinitionWhereInput = {
      category: { not: null },
    };

    if (cityCode) {
      where.OR = [
        { cityCode },
        { cityCode: null },
      ];
    }

    const result = await prisma.workflowDefinition.findMany({
      where,
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return result
      .map((r) => r.category)
      .filter((c): c is string => c !== null);
  }

  // ============================================================
  // Public Methods - CRUD
  // ============================================================

  /**
   * 創建工作流定義
   *
   * @description
   *   建立新的工作流定義，包含驗證 n8n 工作流 ID 唯一性
   *
   * @param input - 創建輸入
   * @returns 創建的工作流定義
   * @throws 如果 n8n 工作流 ID 已存在
   */
  async createDefinition(input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinition> {
    // 檢查 n8n 工作流 ID 是否已存在
    const existing = await this.getDefinitionByN8nId(input.n8nWorkflowId);
    if (existing) {
      throw new Error(`n8n 工作流 ID "${input.n8nWorkflowId}" 已存在`);
    }

    return prisma.workflowDefinition.create({
      data: {
        name: input.name,
        description: input.description,
        n8nWorkflowId: input.n8nWorkflowId,
        triggerUrl: input.triggerUrl,
        triggerMethod: input.triggerMethod ?? 'POST',
        parameters: input.parameters as unknown as Prisma.InputJsonValue,
        cityCode: input.cityCode,
        allowedRoles: input.allowedRoles ?? [],
        category: input.category,
        tags: input.tags ?? [],
        createdBy: input.createdBy,
      },
      include: {
        city: true,
        createdByUser: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * 更新工作流定義
   *
   * @param id - 工作流定義 ID
   * @param input - 更新輸入
   * @returns 更新後的工作流定義或 null
   */
  async updateDefinition(
    id: string,
    input: UpdateWorkflowDefinitionInput
  ): Promise<WorkflowDefinition | null> {
    const existing = await prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    // 構建更新資料（只更新有提供的欄位）
    const updateData: Prisma.WorkflowDefinitionUpdateInput = {
      updatedByUser: input.updatedBy ? { connect: { id: input.updatedBy } } : undefined,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.triggerUrl !== undefined) updateData.triggerUrl = input.triggerUrl;
    if (input.triggerMethod !== undefined) updateData.triggerMethod = input.triggerMethod;
    if (input.parameters !== undefined) {
      updateData.parameters = input.parameters as unknown as Prisma.InputJsonValue;
    }
    if (input.allowedRoles !== undefined) updateData.allowedRoles = input.allowedRoles;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return prisma.workflowDefinition.update({
      where: { id },
      data: updateData,
      include: {
        city: true,
        createdByUser: {
          select: { id: true, name: true },
        },
        updatedByUser: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * 刪除工作流定義
   *
   * @description
   *   刪除工作流定義（軟刪除或硬刪除取決於業務需求）
   *   目前實現為硬刪除，但不會刪除關聯的執行記錄
   *
   * @param id - 工作流定義 ID
   * @returns 是否刪除成功
   */
  async deleteDefinition(id: string): Promise<boolean> {
    const existing = await prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) {
      return false;
    }

    // 先解除與執行記錄的關聯
    await prisma.workflowExecution.updateMany({
      where: { workflowDefinitionId: id },
      data: { workflowDefinitionId: null },
    });

    // 刪除工作流定義
    await prisma.workflowDefinition.delete({ where: { id } });
    return true;
  }

  /**
   * 啟用/停用工作流
   *
   * @param id - 工作流定義 ID
   * @param isActive - 是否啟用
   * @param updatedBy - 更新者 ID
   * @returns 更新後的工作流定義或 null
   */
  async toggleActive(
    id: string,
    isActive: boolean,
    updatedBy: string
  ): Promise<WorkflowDefinition | null> {
    const existing = await prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    return prisma.workflowDefinition.update({
      where: { id },
      data: { isActive, updatedBy },
      include: {
        city: true,
        createdByUser: {
          select: { id: true, name: true },
        },
        updatedByUser: {
          select: { id: true, name: true },
        },
      },
    });
  }

  // ============================================================
  // Public Methods - 批量操作
  // ============================================================

  /**
   * 批量啟用/停用工作流
   *
   * @param ids - 工作流定義 ID 列表
   * @param isActive - 是否啟用
   * @param updatedBy - 更新者 ID
   * @returns 更新的數量
   */
  async batchToggleActive(
    ids: string[],
    isActive: boolean,
    updatedBy: string
  ): Promise<number> {
    const result = await prisma.workflowDefinition.updateMany({
      where: { id: { in: ids } },
      data: { isActive, updatedBy },
    });

    return result.count;
  }

  /**
   * 批量更新分類
   *
   * @param ids - 工作流定義 ID 列表
   * @param category - 新分類
   * @param updatedBy - 更新者 ID
   * @returns 更新的數量
   */
  async batchUpdateCategory(
    ids: string[],
    category: string,
    updatedBy: string
  ): Promise<number> {
    const result = await prisma.workflowDefinition.updateMany({
      where: { id: { in: ids } },
      data: { category, updatedBy },
    });

    return result.count;
  }

  // ============================================================
  // Public Methods - 統計
  // ============================================================

  /**
   * 獲取統計資訊
   *
   * @param cityCode - 城市代碼（可選）
   * @returns 統計資訊
   */
  async getStatistics(cityCode?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
  }> {
    const where: Prisma.WorkflowDefinitionWhereInput = {};
    if (cityCode) {
      where.OR = [
        { cityCode },
        { cityCode: null },
      ];
    }

    const [total, active, byCategory] = await Promise.all([
      prisma.workflowDefinition.count({ where }),
      prisma.workflowDefinition.count({
        where: { ...where, isActive: true },
      }),
      prisma.workflowDefinition.groupBy({
        by: ['category'],
        where,
        _count: { id: true },
      }),
    ]);

    const categoryCounts: Record<string, number> = {};
    for (const item of byCategory) {
      const key = item.category ?? '未分類';
      categoryCounts[key] = item._count.id;
    }

    return {
      total,
      active,
      inactive: total - active,
      byCategory: categoryCounts,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 工作流定義服務單例
 */
export const workflowDefinitionService = new WorkflowDefinitionService();
