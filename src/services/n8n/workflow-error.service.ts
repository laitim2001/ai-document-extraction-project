/**
 * @fileoverview 工作流錯誤服務 - 管理工作流錯誤診斷和統計
 * @description
 *   本模組負責工作流錯誤的診斷和分析，包含：
 *   - 獲取錯誤詳情
 *   - 解析和分類錯誤
 *   - 清理敏感資訊
 *   - 錯誤統計分析
 *
 *   ## 錯誤分類邏輯
 *   1. 如果錯誤已有類型，直接使用
 *   2. 否則根據關鍵字自動分類
 *   3. 根據 HTTP 狀態碼輔助判斷
 *
 *   ## 敏感資訊處理
 *   - 自動遮蔽敏感 HTTP 標頭（Authorization, X-API-Key 等）
 *   - 防止敏感資訊外洩
 *
 * @module src/services/n8n/workflow-error.service
 * @author Development Team
 * @since Epic 10 - Story 10.5
 * @lastModified 2025-12-20
 *
 * @features
 *   - 錯誤詳情獲取
 *   - 智能錯誤分類
 *   - 敏感資訊遮蔽
 *   - 錯誤統計分析
 *   - n8n URL 構建
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/lib/constants/error-types - 錯誤類型配置
 *
 * @related
 *   - src/types/workflow-error.ts - 錯誤類型定義
 *   - prisma/schema.prisma - WorkflowExecution 模型
 */

import { prisma } from '@/lib/prisma';
import {
  ERROR_TYPE_CONFIG,
  SENSITIVE_HEADERS,
  TIMEOUT_KEYWORDS,
  CONNECTION_KEYWORDS,
  AUTHENTICATION_KEYWORDS,
  VALIDATION_KEYWORDS,
} from '@/lib/constants/error-types';
import type {
  WorkflowErrorType,
  WorkflowErrorDetails,
  ErrorDetailResponse,
  ErrorStatistics,
  HttpDetails,
  CreateErrorDetailsInput,
} from '@/types/workflow-error';

// ============================================================
// Types
// ============================================================

/**
 * 錯誤統計查詢選項
 */
interface ErrorStatisticsOptions {
  /** 城市代碼 */
  cityCode?: string;
  /** 開始日期 */
  startDate?: Date;
  /** 結束日期 */
  endDate?: Date;
}

// ============================================================
// Service Class
// ============================================================

/**
 * @class WorkflowErrorService
 * @description 工作流錯誤診斷服務
 */
export class WorkflowErrorService {
  // ============================================================
  // Public Methods - 查詢
  // ============================================================

  /**
   * 獲取錯誤詳情
   *
   * @description
   *   獲取工作流執行的錯誤詳細資訊，包含：
   *   - 錯誤類型和訊息
   *   - 技術詳情（堆疊追蹤）
   *   - HTTP 請求/回應（已遮蔽敏感資訊）
   *   - n8n 執行資訊
   *   - 相關文件列表
   *
   * @param executionId - 執行記錄 ID
   * @returns 錯誤詳情或 null（如果執行不存在或非失敗狀態）
   */
  async getErrorDetail(executionId: string): Promise<ErrorDetailResponse | null> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        documents: {
          select: {
            id: true,
            fileName: true,
            status: true,
          },
        },
      },
    });

    if (!execution) return null;

    // 只處理失敗狀態
    if (execution.status !== 'FAILED' && execution.status !== 'TIMEOUT') {
      return null;
    }

    const errorDetails = this.parseErrorDetails(execution.errorDetails);
    const n8nUrl = await this.buildN8nUrl(execution.n8nExecutionId);

    return {
      execution: {
        id: execution.id,
        workflowName: execution.workflowName,
        status: execution.status,
        startedAt: execution.startedAt?.toISOString(),
        completedAt: execution.completedAt?.toISOString(),
        durationMs: execution.durationMs ?? undefined,
      },
      error: errorDetails,
      documents: execution.documents,
      canRetry: errorDetails.recoverable,
      n8nUrl,
    };
  }

  /**
   * 獲取錯誤統計
   *
   * @description
   *   統計工作流錯誤資訊，包含：
   *   - 按錯誤類型分組統計
   *   - 按失敗步驟分組統計
   *   - 可恢復錯誤比例
   *   - 總錯誤數
   *
   * @param options - 統計選項
   * @returns 錯誤統計資料
   */
  async getErrorStatistics(options: ErrorStatisticsOptions = {}): Promise<ErrorStatistics> {
    const { cityCode, startDate, endDate } = options;

    // 構建查詢條件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      status: { in: ['FAILED', 'TIMEOUT'] },
    };

    if (cityCode) {
      where.cityCode = cityCode;
    }

    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt.gte = startDate;
      if (endDate) where.completedAt.lte = endDate;
    }

    // 查詢所有失敗的執行記錄
    const errors = await prisma.workflowExecution.findMany({
      where,
      select: {
        errorDetails: true,
      },
    });

    // 初始化統計
    const byType: Record<WorkflowErrorType, number> = {
      CONNECTION_ERROR: 0,
      TIMEOUT_ERROR: 0,
      AUTHENTICATION_ERROR: 0,
      VALIDATION_ERROR: 0,
      BUSINESS_ERROR: 0,
      SYSTEM_ERROR: 0,
      EXTERNAL_ERROR: 0,
      UNKNOWN_ERROR: 0,
    };

    const byStep: Record<string, number> = {};
    let recoverableCount = 0;

    // 統計各類錯誤
    for (const error of errors) {
      const details = this.parseErrorDetails(error.errorDetails);

      // 按類型統計
      byType[details.type] = (byType[details.type] || 0) + 1;

      // 按步驟統計
      if (details.failedStep?.stepName) {
        byStep[details.failedStep.stepName] =
          (byStep[details.failedStep.stepName] || 0) + 1;
      }

      // 可恢復統計
      if (details.recoverable) {
        recoverableCount++;
      }
    }

    return {
      byType,
      byStep,
      recoverableRate:
        errors.length > 0
          ? Math.round((recoverableCount / errors.length) * 10000) / 100
          : 0,
      totalErrors: errors.length,
    };
  }

  // ============================================================
  // Public Methods - 錯誤解析
  // ============================================================

  /**
   * 解析錯誤詳情
   *
   * @description
   *   將儲存的 JSON 格式錯誤詳情解析為結構化對象
   *   如果原始資料不完整，會自動補充預設值
   *
   * @param rawDetails - 原始錯誤詳情（JSON）
   * @returns 結構化的錯誤詳情
   */
  parseErrorDetails(rawDetails: unknown): WorkflowErrorDetails {
    if (!rawDetails || typeof rawDetails !== 'object') {
      return this.createDefaultError();
    }

    const details = rawDetails as Partial<WorkflowErrorDetails>;
    const errorType = this.classifyError(details);

    return {
      type: errorType,
      message: details.message || 'Unknown error',
      timestamp: details.timestamp || new Date().toISOString(),
      failedStep: details.failedStep,
      technical: details.technical,
      http: this.sanitizeHttpDetails(details.http),
      n8n: details.n8n,
      context: details.context,
      recoverable: details.recoverable ?? this.isRecoverable(errorType),
      recoveryHint: details.recoveryHint ?? ERROR_TYPE_CONFIG[errorType].defaultHint,
      stage: details.stage ?? 'unknown',
    };
  }

  /**
   * 創建錯誤詳情
   *
   * @description
   *   根據輸入創建完整的錯誤詳情結構
   *   用於在觸發或執行過程中記錄錯誤
   *
   * @param input - 錯誤輸入
   * @returns 完整的錯誤詳情
   */
  createErrorDetails(input: CreateErrorDetailsInput): WorkflowErrorDetails {
    const errorType = input.type ?? this.classifyError({ message: input.message });

    return {
      type: errorType,
      message: input.message,
      timestamp: new Date().toISOString(),
      stage: input.stage ?? 'unknown',
      failedStep: input.failedStep,
      technical: input.technical,
      http: this.sanitizeHttpDetails(input.http),
      n8n: input.n8n,
      context: input.context,
      recoverable: this.isRecoverable(errorType),
      recoveryHint: ERROR_TYPE_CONFIG[errorType].defaultHint,
    };
  }

  // ============================================================
  // Private Methods - 錯誤分類
  // ============================================================

  /**
   * 分類錯誤
   *
   * @description
   *   根據錯誤訊息和其他資訊自動分類錯誤類型
   *   分類優先級：
   *   1. 已有類型 → 直接使用
   *   2. 關鍵字匹配 → 逾時 > 連線 > 認證 > 驗證
   *   3. HTTP 狀態碼 → 5xx 外部錯誤, 4xx 業務錯誤
   *   4. 未知錯誤
   *
   * @param details - 部分錯誤詳情
   * @returns 錯誤類型
   */
  private classifyError(details: Partial<WorkflowErrorDetails>): WorkflowErrorType {
    // 如果已經有類型，直接使用
    if (details.type && details.type in ERROR_TYPE_CONFIG) {
      return details.type;
    }

    const message = (details.message || '').toLowerCase();
    const errorCode = details.technical?.errorCode?.toLowerCase() || '';

    // 逾時錯誤
    if (this.matchesKeywords(message, errorCode, TIMEOUT_KEYWORDS)) {
      return 'TIMEOUT_ERROR';
    }

    // 連線錯誤
    if (this.matchesKeywords(message, errorCode, CONNECTION_KEYWORDS)) {
      return 'CONNECTION_ERROR';
    }

    // 認證錯誤
    if (this.matchesKeywords(message, errorCode, AUTHENTICATION_KEYWORDS)) {
      return 'AUTHENTICATION_ERROR';
    }

    // 驗證錯誤
    if (this.matchesKeywords(message, errorCode, VALIDATION_KEYWORDS)) {
      return 'VALIDATION_ERROR';
    }

    // 外部服務錯誤（HTTP 5xx）
    if (details.http?.responseStatus && details.http.responseStatus >= 500) {
      return 'EXTERNAL_ERROR';
    }

    // 業務錯誤（HTTP 4xx，但不是 400/401/403）
    if (
      details.http?.responseStatus &&
      details.http.responseStatus >= 400 &&
      details.http.responseStatus < 500
    ) {
      return 'BUSINESS_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * 檢查是否匹配關鍵字
   *
   * @param message - 錯誤訊息
   * @param errorCode - 錯誤代碼
   * @param keywords - 關鍵字列表
   * @returns 是否匹配
   */
  private matchesKeywords(
    message: string,
    errorCode: string,
    keywords: string[]
  ): boolean {
    const combined = `${message} ${errorCode}`;
    return keywords.some((keyword) => combined.includes(keyword.toLowerCase()));
  }

  /**
   * 判斷錯誤是否可恢復
   *
   * @param errorType - 錯誤類型
   * @returns 是否可恢復
   */
  private isRecoverable(errorType: WorkflowErrorType): boolean {
    return ERROR_TYPE_CONFIG[errorType]?.recoverable ?? false;
  }

  // ============================================================
  // Private Methods - 敏感資訊處理
  // ============================================================

  /**
   * 清理 HTTP 詳情中的敏感資訊
   *
   * @param http - HTTP 詳情
   * @returns 清理後的 HTTP 詳情
   */
  private sanitizeHttpDetails(http?: Partial<HttpDetails>): HttpDetails | undefined {
    if (!http) return undefined;

    const sanitizedRequestHeaders = this.sanitizeHeaders(http.requestHeaders);
    const sanitizedResponseHeaders = this.sanitizeHeaders(http.responseHeaders);

    return {
      ...http,
      requestHeaders: sanitizedRequestHeaders,
      responseHeaders: sanitizedResponseHeaders,
    };
  }

  /**
   * 清理敏感標頭
   *
   * @param headers - HTTP 標頭
   * @returns 清理後的標頭
   */
  private sanitizeHeaders(
    headers?: Record<string, string>
  ): Record<string, string> | undefined {
    if (!headers) return undefined;

    const sanitized = { ...headers };

    Object.keys(sanitized).forEach((key) => {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  // ============================================================
  // Private Methods - 工具方法
  // ============================================================

  /**
   * 創建預設錯誤
   *
   * @returns 預設錯誤詳情
   */
  private createDefaultError(): WorkflowErrorDetails {
    return {
      type: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      recoverable: false,
      recoveryHint: ERROR_TYPE_CONFIG.UNKNOWN_ERROR.defaultHint,
    };
  }

  /**
   * 構建 n8n 執行頁面 URL
   *
   * @param n8nExecutionId - n8n 執行 ID
   * @returns n8n URL 或 undefined
   */
  private async buildN8nUrl(
    n8nExecutionId?: string | null
  ): Promise<string | undefined> {
    if (!n8nExecutionId) return undefined;

    try {
      const config = await prisma.systemConfig.findFirst({
        where: { key: 'n8n.baseUrl' },
      });

      if (!config?.value || typeof config.value !== 'string') return undefined;

      const baseUrl = config.value.replace(/\/$/, '');
      return `${baseUrl}/execution/${n8nExecutionId}`;
    } catch {
      return undefined;
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 工作流錯誤服務單例
 */
export const workflowErrorService = new WorkflowErrorService();
