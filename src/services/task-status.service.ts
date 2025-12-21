/**
 * @fileoverview 任務狀態查詢服務
 * @description
 *   處理外部 API 任務狀態查詢的核心服務，支援：
 *   - 單一任務狀態查詢
 *   - 批量任務狀態查詢
 *   - 任務列表查詢（含分頁和篩選）
 *   - 任務狀態更新
 *
 * @module src/services/task-status.service
 * @author Development Team
 * @since Epic 11 - Story 11.2 (API 處理狀態查詢端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 單一任務狀態查詢
 *   - 批量狀態查詢（最多 100 個任務）
 *   - 分頁列表查詢
 *   - 依狀態、城市、日期範圍篩選
 *   - 狀態映射（Prisma enum → API 格式）
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *   - @/types/external-api - 外部 API 類型
 *
 * @related
 *   - src/services/invoice-submission.service.ts - 發票提交服務
 *   - src/app/api/v1/invoices/[taskId]/status/route.ts - 狀態查詢 API
 *   - src/app/api/v1/invoices/batch-status/route.ts - 批量查詢 API
 */

import { prisma } from '@/lib/prisma';
import { ExternalApiKey, ApiTaskStatus, ExternalApiTask, Prisma } from '@prisma/client';
import {
  TaskStatus,
  TaskStatusResponse,
  TaskListResponse,
  BatchStatusResponse,
  PaginationInfo,
  TaskError,
  ReviewInfo,
  STATUS_PROGRESS,
} from '@/types/external-api/status';
import { ListQueryParams } from '@/types/external-api/query';
import { STEP_DESCRIPTIONS, isValidStepCode } from '@/types/external-api/steps';

// ============================================================
// 常數定義
// ============================================================

/**
 * 結果 URL 有效期（小時）
 */
export const RESULT_URL_EXPIRY_HOURS = 24;

/**
 * 狀態映射：Prisma enum → API 狀態
 */
const STATUS_MAP: Record<ApiTaskStatus, TaskStatus> = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVIEW_REQUIRED: 'review_required',
  EXPIRED: 'expired',
};

/**
 * 反向狀態映射：API 狀態 → Prisma enum
 */
const REVERSE_STATUS_MAP: Record<TaskStatus, ApiTaskStatus> = {
  queued: 'QUEUED',
  processing: 'PROCESSING',
  completed: 'COMPLETED',
  failed: 'FAILED',
  review_required: 'REVIEW_REQUIRED',
  expired: 'EXPIRED',
};

// ============================================================
// 輔助類型
// ============================================================

/**
 * 任務查詢結果（包含關聯）
 */
type TaskWithRelations = ExternalApiTask;

// ============================================================
// 錯誤類別
// ============================================================

/**
 * 任務狀態服務錯誤
 */
export class TaskStatusError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'TaskStatusError';
  }
}

// ============================================================
// 服務類別
// ============================================================

/**
 * 任務狀態查詢服務
 */
export class TaskStatusService {
  /**
   * 查詢單一任務狀態
   * @param taskId 任務 ID
   * @param apiKey API Key 實體
   * @returns 任務狀態回應或 null（如果未找到）
   */
  async getTaskStatus(
    taskId: string,
    apiKey: ExternalApiKey
  ): Promise<TaskStatusResponse | null> {
    // 查詢任務
    const task = await prisma.externalApiTask.findUnique({
      where: { taskId },
    });

    // 未找到任務
    if (!task) {
      return null;
    }

    // 驗證存取權限（任務必須屬於此 API Key）
    if (task.apiKeyId !== apiKey.id) {
      // 檢查是否有跨租戶權限
      const allowedOperations = apiKey.allowedOperations as string[];
      if (!allowedOperations.includes('*') && !allowedOperations.includes('query_all')) {
        return null; // 無權限視為未找到
      }
    }

    // 轉換為回應格式
    return this.mapTaskToResponse(task);
  }

  /**
   * 批量查詢任務狀態
   * @param taskIds 任務 ID 列表
   * @param apiKey API Key 實體
   * @returns 批量狀態回應
   */
  async getTaskStatuses(
    taskIds: string[],
    apiKey: ExternalApiKey
  ): Promise<BatchStatusResponse> {
    // 查詢所有匹配的任務
    const tasks = await prisma.externalApiTask.findMany({
      where: {
        taskId: { in: taskIds },
        OR: [
          { apiKeyId: apiKey.id },
          // 如果有 query_all 權限，可以查詢所有任務
          ...(this.hasQueryAllPermission(apiKey) ? [{}] : []),
        ],
      },
    });

    // 找到的任務 ID
    const foundTaskIds = new Set(tasks.map(t => t.taskId));

    // 轉換為回應格式
    const results = await Promise.all(
      tasks.map(task => this.mapTaskToResponse(task))
    );

    // 找出未找到的任務 ID
    const notFound = taskIds.filter(id => !foundTaskIds.has(id));

    return {
      results,
      notFound,
    };
  }

  /**
   * 列表查詢任務
   * @param params 查詢參數
   * @param apiKey API Key 實體
   * @returns 任務列表回應
   */
  async listTasks(
    params: ListQueryParams,
    apiKey: ExternalApiKey
  ): Promise<TaskListResponse> {
    // 構建查詢條件
    const where: Prisma.ExternalApiTaskWhereInput = this.buildWhereClause(params, apiKey);

    // 查詢總數
    const total = await prisma.externalApiTask.count({ where });

    // 計算分頁
    const pageSize = params.pageSize;
    const page = params.page;
    const totalPages = Math.ceil(total / pageSize);
    const skip = (page - 1) * pageSize;

    // 查詢任務列表
    const tasks = await prisma.externalApiTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    });

    // 轉換為回應格式
    const taskResponses = await Promise.all(
      tasks.map(task => this.mapTaskToResponse(task))
    );

    // 構建分頁資訊
    const pagination: PaginationInfo = {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return {
      tasks: taskResponses,
      pagination,
    };
  }

  /**
   * 更新任務狀態（內部使用）
   * @param taskId 任務 ID
   * @param status 新狀態
   * @param options 更新選項
   */
  async updateTaskStatus(
    taskId: string,
    status: ApiTaskStatus,
    options?: {
      progress?: number;
      currentStep?: string;
      errorCode?: string;
      errorMessage?: string;
      errorRetryable?: boolean;
      confidenceScore?: number;
      completedAt?: Date;
    }
  ): Promise<ExternalApiTask> {
    const updateData: Prisma.ExternalApiTaskUpdateInput = {
      status,
      updatedAt: new Date(),
    };

    if (options?.progress !== undefined) {
      updateData.progress = options.progress;
    }

    if (options?.currentStep !== undefined) {
      updateData.currentStep = options.currentStep;
    }

    if (options?.errorCode !== undefined) {
      updateData.errorCode = options.errorCode;
      updateData.errorMessage = options.errorMessage;
      updateData.errorRetryable = options.errorRetryable;
    }

    if (options?.confidenceScore !== undefined) {
      updateData.confidenceScore = options.confidenceScore;
    }

    if (options?.completedAt !== undefined) {
      updateData.completedAt = options.completedAt;
      updateData.resultAvailable = true;
      updateData.resultExpiresAt = new Date(
        options.completedAt.getTime() + RESULT_URL_EXPIRY_HOURS * 60 * 60 * 1000
      );
    }

    // 處理開始時間
    if (status === 'PROCESSING') {
      updateData.processingStartedAt = new Date();
    }

    return prisma.externalApiTask.update({
      where: { taskId },
      data: updateData,
    });
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 將任務記錄轉換為 API 回應格式
   */
  private mapTaskToResponse(task: TaskWithRelations): TaskStatusResponse {
    const status = STATUS_MAP[task.status];
    const baseResponse = {
      taskId: task.taskId,
      status,
      progress: task.progress ?? STATUS_PROGRESS[status],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };

    switch (status) {
      case 'queued':
        return {
          ...baseResponse,
          status: 'queued',
          estimatedCompletion: task.estimatedCompletion?.toISOString(),
        };

      case 'processing':
        return {
          ...baseResponse,
          status: 'processing',
          currentStep: this.getStepDescription(task.currentStep),
          estimatedCompletion: task.estimatedCompletion?.toISOString() ??
            new Date(Date.now() + 60000).toISOString(),
        };

      case 'completed':
        return {
          ...baseResponse,
          status: 'completed',
          progress: 100,
          resultUrl: `/api/v1/invoices/${task.taskId}/result`,
          completedAt: task.completedAt?.toISOString() ?? task.updatedAt.toISOString(),
          confidenceScore: task.confidenceScore ?? 0,
        };

      case 'failed':
        return {
          ...baseResponse,
          status: 'failed',
          error: this.buildTaskError(task),
        };

      case 'review_required':
        return {
          ...baseResponse,
          status: 'review_required',
          reviewInfo: this.buildReviewInfo(task),
        };

      case 'expired':
        return {
          ...baseResponse,
          status: 'expired',
          expiredAt: task.resultExpiresAt?.toISOString() ?? task.updatedAt.toISOString(),
        };

      default:
        // 預設返回基本狀態
        return {
          ...baseResponse,
          status: 'queued',
        } as TaskStatusResponse;
    }
  }

  /**
   * 獲取步驟描述
   */
  private getStepDescription(stepCode: string | null): string {
    if (!stepCode) {
      return 'Processing';
    }

    if (isValidStepCode(stepCode)) {
      return STEP_DESCRIPTIONS[stepCode];
    }

    // 未知步驟，直接返回步驟代碼
    return stepCode;
  }

  /**
   * 構建任務錯誤資訊
   */
  private buildTaskError(task: TaskWithRelations): TaskError {
    return {
      code: task.errorCode ?? 'UNKNOWN_ERROR',
      message: task.errorMessage ?? 'An unknown error occurred',
      retryable: task.errorRetryable ?? false,
    };
  }

  /**
   * 構建審核資訊
   */
  private buildReviewInfo(task: TaskWithRelations): ReviewInfo {
    return {
      reason: 'Low confidence score requires manual review',
      reviewUrl: `/review/tasks/${task.taskId}`,
      fieldsRequiringReview: [], // TODO: 從任務元數據中提取需要審核的欄位
    };
  }

  /**
   * 構建查詢條件
   */
  private buildWhereClause(
    params: ListQueryParams,
    apiKey: ExternalApiKey
  ): Prisma.ExternalApiTaskWhereInput {
    const where: Prisma.ExternalApiTaskWhereInput = {};

    // 存取控制：只能查詢自己的任務（除非有 query_all 權限）
    if (!this.hasQueryAllPermission(apiKey)) {
      where.apiKeyId = apiKey.id;
    }

    // 狀態篩選
    if (params.status) {
      where.status = REVERSE_STATUS_MAP[params.status];
    }

    // 城市代碼篩選
    if (params.cityCode) {
      // 檢查 API Key 是否有權限存取此城市
      const allowedCities = apiKey.allowedCities as string[];
      if (!allowedCities.includes('*') && !allowedCities.includes(params.cityCode)) {
        // 無權限存取此城市，返回空結果條件
        where.id = { equals: 'IMPOSSIBLE_ID' };
      } else {
        where.cityCode = params.cityCode;
      }
    }

    // 日期範圍篩選
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.createdAt.lte = new Date(params.endDate);
      }
    }

    return where;
  }

  /**
   * 檢查是否有 query_all 權限
   */
  private hasQueryAllPermission(apiKey: ExternalApiKey): boolean {
    const allowedOperations = apiKey.allowedOperations as string[];
    return allowedOperations.includes('*') || allowedOperations.includes('query_all');
  }
}

/**
 * 任務狀態服務單例
 */
export const taskStatusService = new TaskStatusService();
