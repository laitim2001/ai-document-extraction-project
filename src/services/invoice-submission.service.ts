/**
 * @fileoverview 發票提交服務
 * @description
 *   處理外部 API 發票提交的核心服務，支援三種提交方式：
 *   - 文件直接上傳 (multipart/form-data)
 *   - Base64 編碼內容
 *   - URL 引用
 *
 *   服務負責：
 *   - 驗證提交請求
 *   - 處理不同格式的文件內容
 *   - 創建任務記錄
 *   - 觸發處理流程
 *
 * @module src/services/invoice-submission.service
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 三種提交方式支援
 *   - 文件格式和大小驗證
 *   - URL 獲取文件
 *   - 任務記錄創建
 *   - 預估處理時間計算
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *   - @/types/external-api - 外部 API 類型
 *
 * @related
 *   - src/services/rate-limit.service.ts - 速率限制服務
 *   - src/app/api/v1/invoices/route.ts - API 路由
 */

import { prisma } from '@/lib/prisma';
import { ExternalApiKey, SubmissionType, TaskPriority } from '@prisma/client';
import {
  SubmitInvoiceRequest,
  SubmitInvoiceResponse,
  ProcessedFileData,
  ClientInfo,
  SUPPORTED_MIME_TYPES,
  MAX_FILE_SIZE,
  URL_FETCH_TIMEOUT,
} from '@/types/external-api';
import { ExternalApiErrorCode, getDefaultMessageForErrorCode } from '@/types/external-api/response';

// ============================================================
// 錯誤類別
// ============================================================

/**
 * API 錯誤類別
 * @description 用於封裝 API 錯誤資訊
 */
export class ApiError extends Error {
  constructor(
    public code: ExternalApiErrorCode,
    public override message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * 從錯誤代碼創建 ApiError
   */
  static fromCode(code: ExternalApiErrorCode, statusCode: number): ApiError {
    return new ApiError(code, getDefaultMessageForErrorCode(code), statusCode);
  }
}

// ============================================================
// 服務類別
// ============================================================

/**
 * 發票提交服務
 */
export class InvoiceSubmissionService {
  /**
   * 提交發票
   * @param request 提交請求
   * @param apiKey API Key 實體
   * @param clientInfo 客戶端資訊
   * @returns 提交回應
   */
  async submitInvoice(
    request: SubmitInvoiceRequest,
    apiKey: ExternalApiKey,
    clientInfo: ClientInfo
  ): Promise<SubmitInvoiceResponse> {
    // 1. 驗證請求
    await this.validateRequest(request, apiKey);

    // 2. 處理文件內容
    const fileData = await this.processFileContent(request);

    // 3. 創建文件記錄（簡化版本，實際實現需要上傳到 Blob Storage）
    const document = await prisma.document.create({
      data: {
        fileName: fileData.fileName,
        fileType: fileData.mimeType,
        fileExtension: this.getFileExtension(fileData.fileName),
        fileSize: fileData.buffer.length,
        filePath: `pending/${Date.now()}-${fileData.fileName}`, // 臨時路徑
        blobName: `external-api/${apiKey.id}/${Date.now()}-${fileData.fileName}`,
        cityCode: request.cityCode,
        uploadedBy: apiKey.createdById, // 使用 API Key 創建者作為上傳者
        sourceType: 'API',
        sourceMetadata: {
          apiKeyId: apiKey.id,
          apiKeyName: apiKey.name,
          submissionType: fileData.submissionType,
          priority: request.priority || 'NORMAL',
          callbackUrl: request.callbackUrl,
          clientIp: clientInfo.ip,
        },
        status: 'UPLOADED',
      },
    });

    // 4. 創建任務記錄
    const estimatedCompletion = this.calculateEstimatedCompletion(
      request.cityCode,
      request.priority as TaskPriority | undefined
    );

    const task = await prisma.externalApiTask.create({
      data: {
        apiKeyId: apiKey.id,
        documentId: document.id,
        submissionType: fileData.submissionType as SubmissionType,
        originalFileName: fileData.fileName,
        fileSize: fileData.buffer.length,
        mimeType: fileData.mimeType,
        sourceUrl: request.urlReference?.url,
        cityCode: request.cityCode,
        priority: (request.priority || 'NORMAL') as TaskPriority,
        callbackUrl: request.callbackUrl,
        metadata: request.metadata as object | undefined,
        status: 'QUEUED',
        estimatedCompletion,
        clientIp: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      },
    });

    // 5. 計算預估處理時間
    const estimatedProcessingTime = await this.getEstimatedProcessingTime(
      request.cityCode,
      request.priority as TaskPriority | undefined
    );

    return {
      taskId: task.taskId,
      status: 'queued',
      estimatedProcessingTime,
      statusUrl: `/api/v1/invoices/${task.taskId}/status`,
      createdAt: task.createdAt.toISOString(),
    };
  }

  /**
   * 驗證請求
   */
  private async validateRequest(
    request: SubmitInvoiceRequest,
    apiKey: ExternalApiKey
  ): Promise<void> {
    // 驗證城市權限
    const allowedCities = apiKey.allowedCities as string[];
    if (!allowedCities.includes('*') && !allowedCities.includes(request.cityCode)) {
      throw new ApiError('CITY_NOT_ALLOWED', 'API key is not authorized for this city', 403);
    }

    // 驗證操作權限
    const allowedOperations = apiKey.allowedOperations as string[];
    if (!allowedOperations.includes('*') && !allowedOperations.includes('submit')) {
      throw new ApiError('OPERATION_NOT_ALLOWED', 'API key is not authorized for submit operation', 403);
    }

    // 驗證城市是否存在
    const city = await prisma.city.findUnique({
      where: { code: request.cityCode },
    });
    if (!city) {
      throw new ApiError('VALIDATION_ERROR', `City '${request.cityCode}' does not exist`, 400);
    }

    // 驗證提交內容
    const hasFile = !!request.file;
    const hasBase64 = !!request.base64Content;
    const hasUrl = !!request.urlReference;

    if ([hasFile, hasBase64, hasUrl].filter(Boolean).length !== 1) {
      throw new ApiError(
        'INVALID_SUBMISSION',
        'Exactly one of file, base64Content, or urlReference must be provided',
        400
      );
    }

    // 驗證回調 URL 格式
    if (request.callbackUrl) {
      try {
        const url = new URL(request.callbackUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        throw new ApiError('INVALID_CALLBACK_URL', 'Invalid callback URL format', 400);
      }
    }
  }

  /**
   * 處理文件內容
   */
  private async processFileContent(request: SubmitInvoiceRequest): Promise<ProcessedFileData> {
    // 直接上傳
    if (request.file) {
      this.validateFile(request.file.buffer, request.file.mimeType);
      return {
        buffer: request.file.buffer,
        fileName: request.file.originalName,
        mimeType: request.file.mimeType,
        submissionType: 'FILE_UPLOAD',
      };
    }

    // Base64 內容
    if (request.base64Content) {
      const buffer = Buffer.from(request.base64Content.content, 'base64');
      this.validateFile(buffer, request.base64Content.mimeType);
      return {
        buffer,
        fileName: request.base64Content.fileName,
        mimeType: request.base64Content.mimeType,
        submissionType: 'BASE64',
      };
    }

    // URL 引用
    if (request.urlReference) {
      const { buffer, fileName, mimeType } = await this.fetchFromUrl(request.urlReference.url);
      this.validateFile(buffer, mimeType);
      return {
        buffer,
        fileName: request.urlReference.fileName || fileName,
        mimeType,
        submissionType: 'URL_REFERENCE',
      };
    }

    throw new ApiError('INVALID_SUBMISSION', 'No file content provided', 400);
  }

  /**
   * 驗證文件
   */
  private validateFile(buffer: Buffer, mimeType: string): void {
    // 檢查文件是否為空
    if (buffer.length === 0) {
      throw new ApiError('EMPTY_FILE', 'File content is empty', 400);
    }

    // 檢查文件大小
    if (buffer.length > MAX_FILE_SIZE) {
      throw new ApiError(
        'FILE_TOO_LARGE',
        `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400
      );
    }

    // 檢查文件格式
    const normalizedMimeType = mimeType.toLowerCase();
    if (!SUPPORTED_MIME_TYPES.includes(normalizedMimeType as typeof SUPPORTED_MIME_TYPES[number])) {
      throw new ApiError(
        'UNSUPPORTED_FORMAT',
        'File format not supported. Supported formats: PDF, PNG, JPG, TIFF',
        400
      );
    }
  }

  /**
   * 從 URL 獲取文件
   */
  private async fetchFromUrl(url: string): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    try {
      // 驗證 URL 協議
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are supported');
      }

      const response = await fetch(url, {
        signal: AbortSignal.timeout(URL_FETCH_TIMEOUT),
        headers: {
          'User-Agent': 'InvoiceExtractionAPI/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const mimeType = contentType.split(';')[0].trim();

      // 從 URL 或 Content-Disposition 提取文件名
      let fileName = 'document';
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) fileName = match[1];
      } else {
        const segments = parsedUrl.pathname.split('/');
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.includes('.')) {
          fileName = lastSegment;
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return { buffer, fileName, mimeType };
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiError('URL_FETCH_FAILED', 'URL fetch timed out', 400);
      }
      throw new ApiError(
        'URL_FETCH_FAILED',
        `Failed to fetch file from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400
      );
    }
  }

  /**
   * 計算預估完成時間
   */
  private calculateEstimatedCompletion(cityCode: string, priority?: TaskPriority): Date {
    // 基礎處理時間（秒）
    const baseTime = priority === 'HIGH' ? 60 : 120;

    // 考慮當前隊列深度（實際實現中應查詢當前隊列狀態）
    const queueFactor = 1;

    const estimatedSeconds = baseTime * queueFactor;
    return new Date(Date.now() + estimatedSeconds * 1000);
  }

  /**
   * 獲取預估處理時間（秒）
   */
  private async getEstimatedProcessingTime(
    cityCode: string,
    priority?: TaskPriority
  ): Promise<number> {
    // 嘗試基於歷史數據計算
    try {
      const recentTasks = await prisma.externalApiTask.findMany({
        where: {
          cityCode,
          status: 'COMPLETED',
          completedAt: { not: null },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 過去 7 天
          },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
        take: 100,
        orderBy: { createdAt: 'desc' },
      });

      if (recentTasks.length >= 10) {
        const durations = recentTasks.map(
          (task) => (task.completedAt!.getTime() - task.createdAt.getTime()) / 1000
        );
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const adjustedDuration = priority === 'HIGH' ? avgDuration * 0.5 : avgDuration;
        return Math.ceil(adjustedDuration);
      }
    } catch (error) {
      console.error('Failed to calculate estimated processing time:', error);
    }

    // 預設值
    return priority === 'HIGH' ? 60 : 120;
  }

  /**
   * 從文件名提取副檔名
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
  }
}

/**
 * 發票提交服務單例
 */
export const invoiceSubmissionService = new InvoiceSubmissionService();
