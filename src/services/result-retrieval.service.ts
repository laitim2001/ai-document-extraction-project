/**
 * @fileoverview 處理結果擷取服務
 * @description
 *   處理外部 API 結果擷取的核心服務，支援：
 *   - 單一任務結果查詢
 *   - 批量任務結果查詢
 *   - 單一欄位值查詢
 *   - 原始文件下載資訊
 *   - 多格式輸出（JSON、CSV、XML）
 *
 * @module src/services/result-retrieval.service
 * @author Development Team
 * @since Epic 11 - Story 11.3 (API 處理結果擷取端點)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 單一任務結果擷取
 *   - 批量結果查詢（最多 50 個）
 *   - 多格式輸出支援（JSON、CSV、XML）
 *   - 結果過期檢查
 *   - 文件下載 URL 生成
 *
 * @dependencies
 *   - @prisma/client - 資料庫操作
 *   - @/types/external-api/result - 結果類型定義
 *
 * @related
 *   - src/services/task-status.service.ts - 任務狀態服務
 *   - src/app/api/v1/invoices/[taskId]/result/route.ts - 結果查詢 API
 */

import { prisma } from '@/lib/prisma';
import { ExternalApiKey, ExternalApiTask, Document, ExtractionResult } from '@prisma/client';
import {
  TaskResultResponse,
  ResultMetadata,
  FieldValueResponse,
  DocumentDownloadResponse,
  BatchResultsResponse,
  BatchResultItem,
  OutputFormat,
  ResultErrorCode,
  RESULT_ERROR_CODES,
  RESULT_ERROR_HTTP_STATUS,
  RESULT_ERROR_MESSAGES,
  MAX_BATCH_RESULTS_SIZE,
  DOWNLOAD_URL_EXPIRY_HOURS,
} from '@/types/external-api/result';

// ============================================================
// 錯誤類別
// ============================================================

/**
 * 結果擷取服務錯誤
 */
export class ResultRetrievalError extends Error {
  constructor(
    public code: ResultErrorCode,
    message?: string,
    public statusCode: number = RESULT_ERROR_HTTP_STATUS[code]
  ) {
    super(message ?? RESULT_ERROR_MESSAGES[code]);
    this.name = 'ResultRetrievalError';
  }
}

// ============================================================
// 輔助類型
// ============================================================

/**
 * 任務查詢結果（包含關聯）
 */
type TaskWithRelations = ExternalApiTask & {
  document: (Document & {
    extractionResult: ExtractionResult | null;
    forwarder: { id: string; name: string; code: string } | null;
  }) | null;
};

/**
 * 欄位映射結構（JSON 欄位）
 */
interface FieldMapping {
  fieldName: string;
  originalLabel: string;
  value: string | number | null;
  confidence: number;
  dataType: 'string' | 'number' | 'date' | 'currency' | 'percentage';
  validationStatus: 'valid' | 'warning' | 'error';
  validationMessage?: string;
  boundingBox?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================
// 服務類別
// ============================================================

/**
 * 結果擷取服務
 */
export class ResultRetrievalService {
  /**
   * 查詢任務結果
   * @param taskId 任務 ID
   * @param apiKey API Key 實體
   * @returns 任務結果回應
   * @throws ResultRetrievalError
   */
  async getTaskResult(
    taskId: string,
    apiKey: ExternalApiKey
  ): Promise<TaskResultResponse> {
    // 查詢任務及關聯
    const task = await this.findTaskWithValidation(taskId, apiKey);

    // 檢查任務狀態
    this.validateTaskStatus(task);

    // 構建結果回應
    return this.buildTaskResultResponse(task);
  }

  /**
   * 查詢單一欄位值
   * @param taskId 任務 ID
   * @param fieldName 欄位名稱
   * @param apiKey API Key 實體
   * @returns 欄位值回應
   * @throws ResultRetrievalError
   */
  async getFieldValue(
    taskId: string,
    fieldName: string,
    apiKey: ExternalApiKey
  ): Promise<FieldValueResponse> {
    // 查詢任務及關聯
    const task = await this.findTaskWithValidation(taskId, apiKey);

    // 檢查任務狀態
    this.validateTaskStatus(task);

    // 獲取欄位映射
    const fields = this.getFieldMappings(task);
    const field = fields.find(
      f => f.fieldName.toLowerCase() === fieldName.toLowerCase()
    );

    if (!field) {
      throw new ResultRetrievalError(RESULT_ERROR_CODES.FIELD_NOT_FOUND);
    }

    return {
      taskId: task.taskId,
      fieldName: field.fieldName,
      value: field.value,
      confidence: this.normalizeConfidence(field.confidence),
      dataType: field.dataType,
      validationStatus: field.validationStatus,
    };
  }

  /**
   * 獲取文件下載資訊
   * @param taskId 任務 ID
   * @param apiKey API Key 實體
   * @returns 文件下載回應
   * @throws ResultRetrievalError
   */
  async getDocumentDownload(
    taskId: string,
    apiKey: ExternalApiKey
  ): Promise<DocumentDownloadResponse> {
    // 查詢任務
    const task = await this.findTaskWithValidation(taskId, apiKey);

    // 驗證文件存在
    if (!task.document) {
      throw new ResultRetrievalError(RESULT_ERROR_CODES.DOCUMENT_NOT_FOUND);
    }

    // 生成下載 URL（帶有 SAS Token）
    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_EXPIRY_HOURS * 60 * 60 * 1000);
    const downloadUrl = this.generateDownloadUrl(task.document, expiresAt);

    return {
      taskId: task.taskId,
      downloadUrl,
      fileName: task.originalFileName,
      fileSize: task.fileSize,
      mimeType: task.mimeType,
      urlExpiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * 批量查詢任務結果
   * @param taskIds 任務 ID 列表
   * @param apiKey API Key 實體
   * @returns 批量結果回應
   */
  async getBatchResults(
    taskIds: string[],
    apiKey: ExternalApiKey
  ): Promise<BatchResultsResponse> {
    // 驗證批量大小
    if (taskIds.length > MAX_BATCH_RESULTS_SIZE) {
      throw new ResultRetrievalError(RESULT_ERROR_CODES.BATCH_SIZE_EXCEEDED);
    }

    // 查詢所有匹配的任務
    const tasks = await prisma.externalApiTask.findMany({
      where: {
        taskId: { in: taskIds },
        OR: [
          { apiKeyId: apiKey.id },
          ...(this.hasQueryAllPermission(apiKey) ? [{}] : []),
        ],
      },
      include: {
        document: {
          include: {
            extractionResult: true,
            forwarder: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    // 建立任務 ID 到任務的映射
    const taskMap = new Map<string, TaskWithRelations>();
    tasks.forEach(task => taskMap.set(task.taskId, task as TaskWithRelations));

    // 找出未找到的任務
    const notFound = taskIds.filter(id => !taskMap.has(id));

    // 處理每個任務結果
    const results: BatchResultItem[] = [];
    for (const taskId of taskIds) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      try {
        // 驗證狀態
        this.validateTaskStatus(task);
        // 構建結果
        const result = this.buildTaskResultResponse(task);
        results.push({
          taskId,
          success: true,
          result,
        });
      } catch (error) {
        if (error instanceof ResultRetrievalError) {
          results.push({
            taskId,
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          results.push({
            taskId,
            success: false,
            error: {
              code: RESULT_ERROR_CODES.TASK_NOT_FOUND,
              message: 'Unknown error occurred',
            },
          });
        }
      }
    }

    return {
      results,
      notFound,
    };
  }

  /**
   * 格式化結果為 CSV
   * @param result 任務結果
   * @returns CSV 字串
   */
  formatAsCsv(result: TaskResultResponse): string {
    const headers = [
      'fieldName',
      'originalLabel',
      'value',
      'confidence',
      'dataType',
      'validationStatus',
    ];

    const rows = result.fields.map(field => [
      this.escapeCsvValue(field.fieldName),
      this.escapeCsvValue(field.originalLabel),
      this.escapeCsvValue(String(field.value ?? '')),
      field.confidence.toFixed(2),
      field.dataType,
      field.validationStatus,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * 格式化結果為 XML
   * @param result 任務結果
   * @returns XML 字串
   */
  formatAsXml(result: TaskResultResponse): string {
    const fieldsXml = result.fields
      .map(
        field => `
    <field>
      <fieldName>${this.escapeXml(field.fieldName)}</fieldName>
      <originalLabel>${this.escapeXml(field.originalLabel)}</originalLabel>
      <value>${this.escapeXml(String(field.value ?? ''))}</value>
      <confidence>${field.confidence.toFixed(2)}</confidence>
      <dataType>${field.dataType}</dataType>
      <validationStatus>${field.validationStatus}</validationStatus>
    </field>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<taskResult>
  <taskId>${this.escapeXml(result.taskId)}</taskId>
  <status>${result.status}</status>
  <confidenceScore>${result.confidenceScore.toFixed(2)}</confidenceScore>
  <completedAt>${result.completedAt}</completedAt>
  <expiresAt>${result.expiresAt}</expiresAt>
  <fields>${fieldsXml}
  </fields>
  <metadata>
    <pageCount>${result.metadata.pageCount}</pageCount>
    <processingTimeMs>${result.metadata.processingTimeMs}</processingTimeMs>
    <documentLanguage>${this.escapeXml(result.metadata.documentLanguage)}</documentLanguage>
    <ocrEngineVersion>${this.escapeXml(result.metadata.ocrEngineVersion)}</ocrEngineVersion>
    <aiModelVersion>${this.escapeXml(result.metadata.aiModelVersion)}</aiModelVersion>
  </metadata>
</taskResult>`;
  }

  /**
   * 獲取格式對應的 Content-Type
   */
  getContentType(format: OutputFormat): string {
    const contentTypes: Record<OutputFormat, string> = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml',
    };
    return contentTypes[format];
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 查詢任務並驗證存取權限
   */
  private async findTaskWithValidation(
    taskId: string,
    apiKey: ExternalApiKey
  ): Promise<TaskWithRelations> {
    const task = await prisma.externalApiTask.findUnique({
      where: { taskId },
      include: {
        document: {
          include: {
            extractionResult: true,
            forwarder: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });

    if (!task) {
      throw new ResultRetrievalError(RESULT_ERROR_CODES.TASK_NOT_FOUND);
    }

    // 驗證存取權限
    if (task.apiKeyId !== apiKey.id && !this.hasQueryAllPermission(apiKey)) {
      throw new ResultRetrievalError(RESULT_ERROR_CODES.TASK_NOT_FOUND);
    }

    return task as TaskWithRelations;
  }

  /**
   * 驗證任務狀態
   */
  private validateTaskStatus(task: TaskWithRelations): void {
    // 檢查是否已完成
    if (task.status !== 'COMPLETED') {
      throw new ResultRetrievalError(
        RESULT_ERROR_CODES.TASK_NOT_COMPLETED,
        `Task is currently ${task.status.toLowerCase()}. Please wait for processing to complete.`
      );
    }

    // 檢查結果是否過期
    if (task.resultExpiresAt && new Date() > task.resultExpiresAt) {
      throw new ResultRetrievalError(RESULT_ERROR_CODES.RESULT_EXPIRED);
    }
  }

  /**
   * 構建任務結果回應
   */
  private buildTaskResultResponse(task: TaskWithRelations): TaskResultResponse {
    const fields = this.getFieldMappings(task);
    const metadata = this.buildMetadata(task);

    return {
      taskId: task.taskId,
      status: 'completed',
      confidenceScore: this.normalizeConfidence(task.confidenceScore ?? 0),
      fields: fields.map(f => ({
        ...f,
        confidence: this.normalizeConfidence(f.confidence),
      })),
      metadata,
      completedAt: task.completedAt?.toISOString() ?? task.updatedAt.toISOString(),
      expiresAt: task.resultExpiresAt?.toISOString() ?? '',
    };
  }

  /**
   * 獲取欄位映射
   */
  private getFieldMappings(task: TaskWithRelations): FieldMapping[] {
    const extractionResult = task.document?.extractionResult;
    if (!extractionResult) {
      return [];
    }

    // 從 JSON 欄位解析欄位映射
    const fieldMappings = extractionResult.fieldMappings as FieldMapping[] | null;
    return fieldMappings ?? [];
  }

  /**
   * 構建元數據
   */
  private buildMetadata(task: TaskWithRelations): ResultMetadata {
    const extractionResult = task.document?.extractionResult;
    const forwarder = task.document?.forwarder;

    return {
      pageCount: (extractionResult as { pageCount?: number } | null)?.pageCount ?? 1,
      processingTimeMs: extractionResult?.processingTime ?? 0,
      forwarder: forwarder
        ? {
            id: forwarder.id,
            name: forwarder.name,
            code: forwarder.code,
          }
        : null,
      documentLanguage: 'en',
      ocrEngineVersion: 'Azure Document Intelligence 4.0',
      aiModelVersion: 'GPT-4o-2024',
    };
  }

  /**
   * 正規化信心度（0-1，保留兩位小數）
   */
  private normalizeConfidence(confidence: number): number {
    // 如果信心度大於 1，假設是百分比，轉換為 0-1
    const normalized = confidence > 1 ? confidence / 100 : confidence;
    return Math.round(normalized * 100) / 100;
  }

  /**
   * 生成下載 URL
   */
  private generateDownloadUrl(document: Document, expiresAt: Date): string {
    // 實際實現應使用 Azure Blob Storage SAS Token
    // 這裡提供一個基本實現
    const baseUrl = process.env.BLOB_STORAGE_URL ?? 'https://storage.example.com';
    const blobPath = document.blobName ?? document.id;
    const sasToken = this.generateSasToken(blobPath, expiresAt);
    return `${baseUrl}/${blobPath}?${sasToken}`;
  }

  /**
   * 生成 SAS Token（簡化版）
   */
  private generateSasToken(path: string, expiresAt: Date): string {
    // 實際實現應使用 Azure SDK 生成真正的 SAS Token
    const expiry = expiresAt.toISOString();
    return `se=${encodeURIComponent(expiry)}&sp=r&sig=placeholder`;
  }

  /**
   * 檢查是否有 query_all 權限
   */
  private hasQueryAllPermission(apiKey: ExternalApiKey): boolean {
    const allowedOperations = apiKey.allowedOperations as string[];
    return (
      allowedOperations.includes('*') || allowedOperations.includes('query_all')
    );
  }

  /**
   * 轉義 CSV 值
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * 轉義 XML 特殊字符
   */
  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

/**
 * 結果擷取服務單例
 */
export const resultRetrievalService = new ResultRetrievalService();
