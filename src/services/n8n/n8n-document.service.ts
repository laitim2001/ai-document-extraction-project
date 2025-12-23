/**
 * @fileoverview n8n 文件服務 - 處理 n8n 工作流提交的文件
 * @description
 *   本模組負責處理從 n8n 工作流提交的文件，包含：
 *   - 文件提交與驗證
 *   - 處理狀態查詢
 *   - 處理結果獲取
 *   - 批次狀態查詢
 *
 *   ## 文件處理流程
 *   1. 接收 Base64 編碼的文件內容
 *   2. 驗證文件大小和 MIME 類型
 *   3. 上傳至 Blob Storage
 *   4. 建立文件記錄
 *   5. 觸發處理流程
 *   6. 發送回調通知（如有設定）
 *
 *   ## 支援的文件類型
 *   - PDF (application/pdf)
 *   - JPEG (image/jpeg)
 *   - PNG (image/png)
 *   - TIFF (image/tiff)
 *   - Excel (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
 *   - Excel 97-2003 (application/vnd.ms-excel)
 *
 * @module src/services/n8n/n8n-document.service
 * @author Development Team
 * @since Epic 10 - Story 10.1
 * @lastModified 2025-12-20
 *
 * @features
 *   - 文件提交與驗證
 *   - 處理狀態追蹤
 *   - 處理結果獲取
 *   - 進度計算
 *   - 完成時間預估
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/services/n8n/n8n-webhook.service - Webhook 服務
 *
 * @related
 *   - src/types/n8n.ts - n8n 類型定義
 *   - prisma/schema.prisma - Document 模型
 */

import { prisma } from '@/lib/prisma';
import type {
  N8nDocumentSubmitRequest,
  N8nDocumentResponse,
  N8nDocumentStatusResponse,
  N8nDocumentResultResponse,
} from '@/types/n8n';
import { DocumentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// ============================================================
// Constants
// ============================================================

/** 最大文件大小（50MB） */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** 允許的 MIME 類型 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

/** 狀態進度映射 */
const PROGRESS_MAP: Record<string, number> = {
  PENDING: 0,
  UPLOADING: 10,
  OCR_PROCESSING: 30,
  AI_EXTRACTING: 50,
  FORWARDER_IDENTIFYING: 70,
  VALIDATION: 80,
  PENDING_REVIEW: 90,
  APPROVED: 100,
  COMPLETED: 100,
  FAILED: 0,
  REJECTED: 0,
};

/** 終態狀態列表 */
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'REJECTED', 'APPROVED'];

// ============================================================
// Service Class
// ============================================================

/**
 * @class N8nDocumentService
 * @description n8n 文件處理服務
 */
export class N8nDocumentService {
  // ============================================================
  // Public Methods
  // ============================================================

  /**
   * 提交文件處理
   *
   * @description
   *   接收並處理從 n8n 工作流提交的文件。
   *   流程包含驗證、上傳、建立記錄和觸發處理。
   *
   * @param request - 文件提交請求
   * @param apiKeyId - 使用的 API Key ID
   * @param traceId - 追蹤 ID
   * @returns 提交結果
   *
   * @example
   * ```typescript
   * const result = await n8nDocumentService.submitDocument(
   *   {
   *     fileName: 'invoice.pdf',
   *     fileContent: 'base64-content...',
   *     mimeType: 'application/pdf',
   *     fileSize: 1024000,
   *     cityCode: 'TW',
   *   },
   *   apiKeyId,
   *   traceId
   * );
   * ```
   */
  async submitDocument(
    request: N8nDocumentSubmitRequest,
    apiKeyId: string,
    traceId: string
  ): Promise<N8nDocumentResponse> {
    const timestamp = new Date().toISOString();

    try {
      // 1. 驗證文件大小
      if (request.fileSize > MAX_FILE_SIZE) {
        return {
          success: false,
          message: `File size exceeds maximum allowed (${MAX_FILE_SIZE} bytes)`,
          traceId,
          timestamp,
        };
      }

      // 2. 驗證 MIME 類型
      if (!ALLOWED_MIME_TYPES.includes(request.mimeType)) {
        return {
          success: false,
          message: `Unsupported file type: ${request.mimeType}`,
          traceId,
          timestamp,
        };
      }

      // 3. 解碼文件內容（驗證 Base64）
      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(request.fileContent, 'base64');
      } catch {
        return {
          success: false,
          message: 'Invalid Base64 file content',
          traceId,
          timestamp,
        };
      }

      // 4. 生成 Blob URL（目前使用模擬 URL，待整合 Azure Blob Storage）
      const blobUrl = await this.uploadToStorage(
        fileBuffer,
        request.fileName,
        request.mimeType,
        {
          source: 'n8n',
          workflowId: request.workflowId,
          workflowExecutionId: request.workflowExecutionId,
          correlationId: request.correlationId,
          traceId,
        }
      );

      // 5. 獲取文件副檔名
      const fileExtension = request.fileName.split('.').pop()?.toLowerCase() ?? 'pdf';

      // 6. 創建文件記錄
      const document = await prisma.document.create({
        data: {
          fileName: request.fileName,
          fileType: request.mimeType,
          fileExtension,
          fileSize: request.fileSize,
          filePath: blobUrl,
          blobName: `n8n/${traceId}/${Date.now()}/${request.fileName}`,
          uploadedBy: apiKeyId, // 使用 API Key ID 作為 uploader
          cityCode: request.cityCode,

          // 來源追蹤
          sourceType: 'N8N_WORKFLOW',
          sourceMetadata: {
            workflowId: request.workflowId,
            workflowName: request.workflowName,
            workflowExecutionId: request.workflowExecutionId,
            triggerSource: request.triggerSource,
            correlationId: request.correlationId,
            callbackUrl: request.callbackUrl,
            apiKeyId,
            traceId,
            metadata: (request.metadata ?? {}) as Prisma.JsonObject,
          } as Prisma.JsonObject,

          // 初始狀態
          status: 'UPLOADED',

          // 可選的 company（需通過 ID 關聯）
          companyId: request.forwarderCode
            ? await this.getForwarderIdByCode(request.forwarderCode)
            : null,
        },
      });

      // 6. 觸發處理流程（異步，不阻塞響應）
      this.triggerProcessing(document.id).catch((error) => {
        console.error('Failed to trigger document processing:', error);
      });

      // 7. 發送接收確認回調（如有設定）
      if (request.callbackUrl) {
        // 延遲導入以避免循環依賴
        const { n8nWebhookService } = await import('./n8n-webhook.service');
        n8nWebhookService
          .sendEvent({
            eventType: 'DOCUMENT_RECEIVED',
            documentId: document.id,
            webhookUrl: request.callbackUrl,
            cityCode: request.cityCode,
            payload: {
              documentId: document.id,
              fileName: request.fileName,
              status: 'RECEIVED',
              correlationId: request.correlationId,
              traceId,
            },
          })
          .catch((error) => {
            console.error('Failed to send document received callback:', error);
          });
      }

      return {
        success: true,
        documentId: document.id,
        status: 'RECEIVED',
        message: 'Document submitted successfully',
        traceId,
        timestamp,
      };
    } catch (error) {
      console.error('Failed to submit document:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        traceId,
        timestamp,
      };
    }
  }

  /**
   * 查詢處理狀態
   *
   * @description
   *   取得文件的當前處理狀態，包含進度和預估完成時間。
   *
   * @param documentId - 文件 ID
   * @param cityCode - 城市代碼（用於數據隔離）
   * @returns 處理狀態或 null
   *
   * @example
   * ```typescript
   * const status = await n8nDocumentService.getDocumentStatus(
   *   documentId,
   *   'TW'
   * );
   * if (status) {
   *   console.log(`Progress: ${status.progress}%`);
   * }
   * ```
   */
  async getDocumentStatus(
    documentId: string,
    cityCode: string
  ): Promise<N8nDocumentStatusResponse | null> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        cityCode, // 確保城市隔離
      },
    });

    if (!document) {
      return null;
    }

    const progress = this.calculateProgress(document.status);
    const estimatedCompletionTime = await this.estimateCompletionTime(document);

    return {
      documentId: document.id,
      status: document.status as DocumentStatus,
      processingStage: document.status,
      progress,
      estimatedCompletionTime,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * 獲取處理結果
   *
   * @description
   *   取得文件的處理結果，包含提取的數據和信心度。
   *
   * @param documentId - 文件 ID
   * @param cityCode - 城市代碼（用於數據隔離）
   * @returns 處理結果或 null
   *
   * @example
   * ```typescript
   * const result = await n8nDocumentService.getDocumentResult(
   *   documentId,
   *   'TW'
   * );
   * if (result && result.status === 'COMPLETED') {
   *   console.log('Extracted data:', result.extractedData);
   * }
   * ```
   */
  async getDocumentResult(
    documentId: string,
    cityCode: string
  ): Promise<N8nDocumentResultResponse | null> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        cityCode,
      },
      include: {
        company: true,
      },
    });

    if (!document) {
      return null;
    }

    // 從 sourceMetadata 中提取結果數據
    const sourceMetadata = document.sourceMetadata as Record<string, unknown> | null;
    const extractedData = sourceMetadata?.extractedData as Record<string, unknown> | undefined;
    const confidenceScore =
      typeof sourceMetadata?.confidenceScore === 'number'
        ? sourceMetadata.confidenceScore
        : undefined;

    // 計算處理時間（從創建到最後更新）
    const processingDurationMs = document.updatedAt.getTime() - document.createdAt.getTime();

    // 判斷審核狀態（根據 reviewRecords 或狀態）
    let reviewStatus: string | null = null;
    if (document.status === 'APPROVED') {
      reviewStatus = 'APPROVED';
    } else if (document.status === 'PENDING_REVIEW') {
      reviewStatus = 'PENDING';
    } else if (document.status === 'IN_REVIEW') {
      reviewStatus = 'IN_PROGRESS';
    }

    return {
      documentId: document.id,
      status: document.status as DocumentStatus,
      extractedData: extractedData ?? undefined,
      confidenceScore,
      forwarderCode: document.company?.code ?? null,
      forwarderName: document.company?.name ?? null,
      reviewStatus,
      processingDuration: processingDurationMs,
      completedAt: document.status === 'COMPLETED' ? document.updatedAt : undefined,
    };
  }

  /**
   * 批次查詢多個文件狀態
   *
   * @description
   *   一次查詢多個文件的狀態，適用於批次處理監控。
   *
   * @param documentIds - 文件 ID 列表
   * @param cityCode - 城市代碼
   * @returns 文件狀態列表
   *
   * @example
   * ```typescript
   * const statuses = await n8nDocumentService.getDocumentStatuses(
   *   ['doc-1', 'doc-2', 'doc-3'],
   *   'TW'
   * );
   * ```
   */
  async getDocumentStatuses(
    documentIds: string[],
    cityCode: string
  ): Promise<N8nDocumentStatusResponse[]> {
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        cityCode,
      },
    });

    return documents.map((doc) => ({
      documentId: doc.id,
      status: doc.status as DocumentStatus,
      progress: this.calculateProgress(doc.status),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 上傳文件到儲存空間
   *
   * @description
   *   將文件內容上傳到 Azure Blob Storage。
   *   目前為模擬實現，待整合實際儲存服務。
   *
   * @param _buffer - 文件內容
   * @param fileName - 文件名稱
   * @param _mimeType - MIME 類型
   * @param metadata - 附加元數據
   * @returns Blob URL
   */
  private async uploadToStorage(
    _buffer: Buffer,
    fileName: string,
    _mimeType: string,
    metadata: Record<string, unknown>
  ): Promise<string> {
    // TODO: 整合 Azure Blob Storage
    // 目前返回模擬 URL
    const timestamp = Date.now();
    const traceId = metadata.traceId ?? 'unknown';
    return `https://storage.example.com/n8n/${traceId}/${timestamp}/${fileName}`;
  }

  /**
   * 觸發文件處理
   *
   * @description
   *   觸發文件處理流程。
   *   目前為模擬實現，待整合實際處理服務。
   *
   * @param documentId - 文件 ID
   */
  private async triggerProcessing(documentId: string): Promise<void> {
    // TODO: 整合文件處理服務
    // 更新狀態為 OCR 處理中
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'OCR_PROCESSING' },
    });
  }

  /**
   * 根據 forwarder code 獲取 company ID
   *
   * @param code - Company 代碼
   * @returns Company ID 或 null
   */
  private async getForwarderIdByCode(code: string): Promise<string | null> {
    const company = await prisma.company.findUnique({
      where: { code },
      select: { id: true },
    });
    return company?.id ?? null;
  }

  /**
   * 計算處理進度
   *
   * @description
   *   根據文件狀態計算處理進度百分比。
   *
   * @param status - 文件狀態
   * @returns 進度百分比 (0-100)
   */
  private calculateProgress(status: string): number {
    return PROGRESS_MAP[status] ?? 0;
  }

  /**
   * 預估完成時間
   *
   * @description
   *   根據歷史數據預估文件處理完成時間。
   *   對於已完成的文件，返回 undefined。
   *
   * @param document - 文件記錄
   * @returns 預估完成時間或 undefined
   */
  private async estimateCompletionTime(
    document: { id: string; status: string; cityCode: string; createdAt: Date }
  ): Promise<Date | undefined> {
    if (TERMINAL_STATUSES.includes(document.status)) {
      return undefined;
    }

    // 獲取同城市已完成文件的平均處理時間
    // 計算方式：(updatedAt - createdAt) 的平均值
    const completedDocs = await prisma.document.findMany({
      where: {
        status: 'COMPLETED',
        cityCode: document.cityCode,
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
      take: 100, // 使用最近 100 筆記錄
      orderBy: { updatedAt: 'desc' },
    });

    // 計算平均處理時間
    let avgMs = 60000; // 預設 60 秒
    if (completedDocs.length > 0) {
      const totalMs = completedDocs.reduce((sum, doc) => {
        return sum + (doc.updatedAt.getTime() - doc.createdAt.getTime());
      }, 0);
      avgMs = totalMs / completedDocs.length;
    }

    const elapsedMs = Date.now() - document.createdAt.getTime();
    const remainingMs = Math.max(avgMs - elapsedMs, 5000); // 至少 5 秒

    return new Date(Date.now() + remainingMs);
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * n8n 文件服務單例
 */
export const n8nDocumentService = new N8nDocumentService();
