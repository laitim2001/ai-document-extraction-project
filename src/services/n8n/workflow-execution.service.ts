/**
 * @fileoverview 工作流執行服務
 * @description
 *   提供工作流執行狀態管理功能，包含：
 *   - 執行列表查詢與分頁
 *   - 執行詳情獲取
 *   - 執行統計計算
 *   - 執行中工作流追蹤
 *   - 執行狀態更新（從 n8n Webhook 調用）
 *   - 執行步驟管理
 *
 * @module src/services/n8n/workflow-execution.service
 * @since Epic 10 - Story 10.3
 * @lastModified 2025-12-20
 *
 * @features
 *   - 工作流執行 CRUD 操作
 *   - 城市級別權限過濾
 *   - 執行統計與分析
 *   - 實時狀態追蹤
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/workflow-execution - 類型定義
 */

import { prisma } from '@/lib/prisma';
import type {
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowTriggerType,
  StepExecutionStatus,
} from '@prisma/client';
import type {
  ListExecutionsOptions,
  ExecutionSummary,
  ExecutionDetail,
  PaginatedExecutions,
  ExecutionStats,
  ExecutionStatsOptions,
  ErrorDetails,
  ExecutionStepSummary,
} from '@/types/workflow-execution';

/**
 * 工作流執行服務類
 * 負責管理工作流執行的所有業務邏輯
 */
export class WorkflowExecutionService {
  // ===========================================
  // 列出執行記錄
  // ===========================================

  /**
   * 獲取工作流執行列表
   * @param options - 查詢選項
   * @returns 分頁執行結果
   */
  async listExecutions(options: ListExecutionsOptions): Promise<PaginatedExecutions> {
    const {
      cityCode,
      status,
      workflowName,
      triggerType,
      triggeredBy,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      orderBy = 'startedAt',
      orderDirection = 'desc',
    } = options;

    // 建構查詢條件
    const where = this.buildWhereClause({
      cityCode,
      status,
      workflowName,
      triggerType,
      triggeredBy,
      startDate,
      endDate,
    });

    // 並行執行查詢和計數
    const [items, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { documents: true },
          },
        },
      }),
      prisma.workflowExecution.count({ where }),
    ]);

    return {
      items: items.map(this.mapToSummary),
      total,
    };
  }

  // ===========================================
  // 獲取執行詳情
  // ===========================================

  /**
   * 獲取工作流執行詳情
   * @param id - 執行 ID
   * @returns 執行詳情或 null
   */
  async getExecutionDetail(id: string): Promise<ExecutionDetail | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id },
      include: {
        documents: {
          select: {
            id: true,
            fileName: true,
            status: true,
          },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    if (!execution) return null;

    const errorDetails = execution.errorDetails as ErrorDetails | null;

    return {
      id: execution.id,
      n8nExecutionId: execution.n8nExecutionId ?? undefined,
      workflowId: execution.workflowId ?? undefined,
      workflowName: execution.workflowName,
      triggerType: execution.triggerType,
      triggerSource: execution.triggerSource ?? undefined,
      triggeredBy: execution.triggeredBy ?? undefined,
      cityCode: execution.cityCode,
      status: execution.status,
      progress: execution.progress,
      currentStep: execution.currentStep ?? undefined,
      startedAt: execution.startedAt ?? undefined,
      completedAt: execution.completedAt ?? undefined,
      durationMs: execution.durationMs ?? undefined,
      documentCount: execution.documents.length,
      result: execution.result as Record<string, unknown> | undefined,
      errorDetails: errorDetails ?? undefined,
      errorMessage: errorDetails?.message,
      steps: execution.steps.map(
        (step): ExecutionStepSummary => ({
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          stepType: step.stepType ?? undefined,
          status: step.status,
          startedAt: step.startedAt ?? undefined,
          completedAt: step.completedAt ?? undefined,
          durationMs: step.durationMs ?? undefined,
          errorMessage: step.errorMessage ?? undefined,
        })
      ),
      documents: execution.documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        status: doc.status,
      })),
    };
  }

  // ===========================================
  // 獲取執行統計
  // ===========================================

  /**
   * 獲取工作流執行統計
   * @param options - 統計選項
   * @returns 執行統計
   */
  async getExecutionStats(options: ExecutionStatsOptions): Promise<ExecutionStats> {
    const { cityCode, startDate, endDate } = options;

    const where = this.buildWhereClause({ cityCode, startDate, endDate });

    // 並行查詢所有統計資料
    const [total, statusCounts, triggerTypeCounts, avgDuration] = await Promise.all([
      prisma.workflowExecution.count({ where }),
      prisma.workflowExecution.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.workflowExecution.groupBy({
        by: ['triggerType'],
        where,
        _count: true,
      }),
      prisma.workflowExecution.aggregate({
        where: {
          ...where,
          status: 'COMPLETED',
          durationMs: { not: null },
        },
        _avg: {
          durationMs: true,
        },
      }),
    ]);

    // 轉換狀態計數
    const byStatus: Partial<Record<WorkflowExecutionStatus, number>> = {};
    statusCounts.forEach((item) => {
      byStatus[item.status] = item._count;
    });

    // 轉換觸發類型計數
    const byTriggerType: Partial<Record<WorkflowTriggerType, number>> = {};
    triggerTypeCounts.forEach((item) => {
      byTriggerType[item.triggerType] = item._count;
    });

    // 計算成功率
    const completed = byStatus['COMPLETED'] || 0;
    const failed = byStatus['FAILED'] || 0;
    const successRate =
      completed + failed > 0
        ? Math.round((completed / (completed + failed)) * 10000) / 100
        : 0;

    return {
      total,
      byStatus,
      byTriggerType,
      avgDurationMs: Math.round(avgDuration._avg.durationMs ?? 0),
      successRate,
    };
  }

  // ===========================================
  // 獲取執行中的工作流
  // ===========================================

  /**
   * 獲取執行中的工作流列表
   * @param cityCode - 城市代碼（可選）
   * @returns 執行中的工作流摘要列表
   */
  async getRunningExecutions(cityCode?: string): Promise<ExecutionSummary[]> {
    const executions = await prisma.workflowExecution.findMany({
      where: {
        status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
        ...(cityCode ? { cityCode } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });

    return executions.map(this.mapToSummary);
  }

  // ===========================================
  // 更新執行狀態 (從 n8n Webhook 調用)
  // ===========================================

  /**
   * 更新工作流執行狀態
   * @param n8nExecutionId - n8n 執行 ID
   * @param status - 新狀態
   * @param data - 附加資料
   * @returns 更新後的執行記錄或 null
   */
  async updateExecutionStatus(
    n8nExecutionId: string,
    status: WorkflowExecutionStatus,
    data?: {
      progress?: number;
      currentStep?: string;
      result?: Record<string, unknown>;
      errorDetails?: ErrorDetails;
    }
  ): Promise<WorkflowExecution | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { n8nExecutionId },
    });

    if (!execution) return null;

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    // 更新可選欄位
    if (data?.progress !== undefined) updateData.progress = data.progress;
    if (data?.currentStep !== undefined) updateData.currentStep = data.currentStep;
    if (data?.result !== undefined) updateData.result = data.result;
    if (data?.errorDetails !== undefined) updateData.errorDetails = data.errorDetails;

    // 根據狀態更新時間
    if (status === 'RUNNING' && !execution.startedAt) {
      updateData.startedAt = new Date();
    }

    // 終止狀態處理
    const terminalStatuses: WorkflowExecutionStatus[] = [
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'TIMEOUT',
    ];
    if (terminalStatuses.includes(status)) {
      updateData.completedAt = new Date();
      if (execution.startedAt) {
        updateData.durationMs = Date.now() - execution.startedAt.getTime();
      }
    }

    return prisma.workflowExecution.update({
      where: { n8nExecutionId },
      data: updateData,
    });
  }

  // ===========================================
  // 建立執行記錄
  // ===========================================

  /**
   * 建立新的工作流執行記錄
   * @param data - 執行資料
   * @returns 創建的執行記錄
   */
  async createExecution(data: {
    workflowId?: string;
    workflowName: string;
    triggerType: WorkflowTriggerType;
    triggerSource?: string;
    triggeredBy?: string;
    cityCode: string;
    scheduledAt?: Date;
    n8nExecutionId?: string;
  }): Promise<WorkflowExecution> {
    return prisma.workflowExecution.create({
      data: {
        ...data,
        status: 'PENDING',
        progress: 0,
      },
    });
  }

  // ===========================================
  // 新增執行步驟
  // ===========================================

  /**
   * 新增工作流執行步驟
   * @param executionId - 執行 ID
   * @param stepData - 步驟資料
   * @returns 創建的步驟記錄
   */
  async addExecutionStep(
    executionId: string,
    stepData: {
      stepNumber: number;
      stepName: string;
      stepType?: string;
    }
  ) {
    return prisma.workflowExecutionStep.create({
      data: {
        executionId,
        ...stepData,
        status: 'PENDING',
      },
    });
  }

  // ===========================================
  // 更新執行步驟狀態
  // ===========================================

  /**
   * 更新工作流執行步驟狀態
   * @param executionId - 執行 ID
   * @param stepNumber - 步驟編號
   * @param status - 新狀態
   * @param data - 附加資料
   * @returns 更新後的步驟記錄
   */
  async updateStepStatus(
    executionId: string,
    stepNumber: number,
    status: StepExecutionStatus,
    data?: {
      inputData?: Record<string, unknown>;
      outputData?: Record<string, unknown>;
      errorMessage?: string;
    }
  ) {
    const updateData: Record<string, unknown> = { status };

    if (status === 'RUNNING') {
      updateData.startedAt = new Date();
    }

    if (['COMPLETED', 'FAILED', 'SKIPPED'].includes(status)) {
      updateData.completedAt = new Date();

      // 取得開始時間以計算耗時
      const step = await prisma.workflowExecutionStep.findUnique({
        where: {
          executionId_stepNumber: { executionId, stepNumber },
        },
      });

      if (step?.startedAt) {
        updateData.durationMs = Date.now() - step.startedAt.getTime();
      }
    }

    if (data?.inputData) updateData.inputData = data.inputData;
    if (data?.outputData) updateData.outputData = data.outputData;
    if (data?.errorMessage) updateData.errorMessage = data.errorMessage;

    return prisma.workflowExecutionStep.update({
      where: {
        executionId_stepNumber: { executionId, stepNumber },
      },
      data: updateData,
    });
  }

  // ===========================================
  // 根據 n8n 執行 ID 獲取執行記錄
  // ===========================================

  /**
   * 根據 n8n 執行 ID 獲取執行記錄
   * @param n8nExecutionId - n8n 執行 ID
   * @returns 執行記錄或 null
   */
  async getByN8nExecutionId(n8nExecutionId: string): Promise<WorkflowExecution | null> {
    return prisma.workflowExecution.findUnique({
      where: { n8nExecutionId },
    });
  }

  // ===========================================
  // 私有方法: 建構查詢條件
  // ===========================================

  /**
   * 建構 Prisma 查詢條件
   * @param options - 查詢選項
   * @returns Prisma where 子句
   */
  private buildWhereClause(options: {
    cityCode?: string;
    status?: WorkflowExecutionStatus | WorkflowExecutionStatus[];
    workflowName?: string;
    triggerType?: WorkflowTriggerType;
    triggeredBy?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (options.cityCode) where.cityCode = options.cityCode;

    if (options.status) {
      where.status = Array.isArray(options.status)
        ? { in: options.status }
        : options.status;
    }

    if (options.workflowName) {
      where.workflowName = { contains: options.workflowName, mode: 'insensitive' };
    }

    if (options.triggerType) where.triggerType = options.triggerType;
    if (options.triggeredBy) where.triggeredBy = options.triggeredBy;

    if (options.startDate || options.endDate) {
      where.startedAt = {};
      if (options.startDate) where.startedAt.gte = options.startDate;
      if (options.endDate) where.startedAt.lte = options.endDate;
    }

    return where;
  }

  // ===========================================
  // 私有方法: 轉換為摘要格式
  // ===========================================

  /**
   * 將執行記錄轉換為摘要格式
   * @param item - 執行記錄（含關聯計數）
   * @returns 執行摘要
   */
  private mapToSummary = (
    item: WorkflowExecution & { _count: { documents: number } }
  ): ExecutionSummary => {
    const errorDetails = item.errorDetails as ErrorDetails | null;

    return {
      id: item.id,
      workflowName: item.workflowName,
      triggerType: item.triggerType,
      triggerSource: item.triggerSource ?? undefined,
      status: item.status,
      progress: item.progress,
      currentStep: item.currentStep ?? undefined,
      startedAt: item.startedAt ?? undefined,
      completedAt: item.completedAt ?? undefined,
      durationMs: item.durationMs ?? undefined,
      documentCount: item._count.documents,
      errorMessage: errorDetails?.message,
    };
  };
}

// 單例導出
export const workflowExecutionService = new WorkflowExecutionService();
