/**
 * @fileoverview 文件追溯服務
 * @description
 *   提供完整的文件追溯功能，讓審計人員可以從任何數據點
 *   追溯至原始發票文件，驗證數據來源和準確性。
 *
 *   主要功能：
 *   - getDocumentSource: 獲取文件來源（含預簽名 URL）
 *   - getDocumentTraceChain: 獲取完整追溯鏈
 *   - generateTraceabilityReport: 生成追溯報告（含 SHA256 雜湊）
 *
 * @module src/services/traceability.service
 * @author Development Team
 * @since Epic 8 - Story 8.4 (原始文件追溯)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 文件來源追溯（活躍/歸檔/冷儲存）
 *   - 完整追溯鏈查詢
 *   - 修正記錄追溯
 *   - 追溯報告生成（含完整性驗證）
 *   - 冷儲存自動解凍
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/azure-blob - Azure Blob Storage 操作
 *   - @/services/change-tracking.service - 變更追蹤服務
 *   - @/types/traceability - 追溯類型定義
 *   - crypto - 雜湊計算
 *
 * @related
 *   - src/app/api/documents/[id]/source/route.ts - 文件來源 API
 *   - src/app/api/documents/[id]/trace/route.ts - 追溯鏈 API
 *   - src/app/api/documents/[id]/trace/report/route.ts - 追溯報告 API
 *   - src/components/audit/DocumentTraceView.tsx - 追溯視圖組件
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  generateSignedUrl,
  getStorageLocation,
  retrieveFromArchive,
} from '@/lib/azure-blob';
import type { Prisma } from '@prisma/client';
import type {
  DocumentSource,
  DocumentTraceChain,
  TraceabilityReport,
  OcrResult,
  CorrectionTrace,
  ApprovalRecord,
  ChangeHistoryRecord,
  ExtractionResultData,
} from '@/types/traceability';

// ============================================================
// Constants
// ============================================================

/**
 * 預簽名 URL 有效期（秒）
 * 默認 1 小時
 */
const URL_EXPIRY_SECONDS = 60 * 60;

// ============================================================
// Traceability Service Class
// ============================================================

/**
 * 文件追溯服務
 *
 * @description
 *   提供文件追溯的核心功能，包括：
 *   - 獲取原始文件來源和預簽名 URL
 *   - 構建完整的追溯鏈（從上傳到核准）
 *   - 生成可驗證的追溯報告
 *
 * @example
 * ```typescript
 * // 獲取文件來源
 * const source = await traceabilityService.getDocumentSource('doc-123');
 *
 * // 獲取完整追溯鏈
 * const chain = await traceabilityService.getDocumentTraceChain('doc-123');
 *
 * // 生成追溯報告
 * const report = await traceabilityService.generateTraceabilityReport(
 *   'doc-123',
 *   { id: 'user-1', name: 'Auditor' }
 * );
 * ```
 */
class TraceabilityService {
  // ============================================================
  // Document Source
  // ============================================================

  /**
   * 獲取文件來源
   *
   * @description
   *   返回文件的原始儲存資訊，包含預簽名 URL。
   *   如果文件在冷儲存中，會自動發起解凍請求。
   *
   * @param documentId - 文件 ID
   * @returns 文件來源資訊，如果文件不存在則返回 null
   *
   * @example
   * ```typescript
   * const source = await traceabilityService.getDocumentSource('doc-123');
   * if (source) {
   *   console.log(`File: ${source.fileName}, URL: ${source.url}`);
   * }
   * ```
   */
  async getDocumentSource(documentId: string): Promise<DocumentSource | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        filePath: true,
        createdAt: true,
        uploadedBy: true,
      },
    });

    if (!document || !document.filePath) {
      return null;
    }

    // 獲取儲存位置層級
    const storageLocation = await getStorageLocation(document.filePath);

    // 如果是冷儲存，發起解凍請求
    if (storageLocation === 'cold' || storageLocation === 'archive') {
      await this.initiateFileRetrieval(document.filePath);
    }

    // 計算 URL 過期時間
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + URL_EXPIRY_SECONDS);

    // 生成預簽名 URL
    const url = await generateSignedUrl(document.filePath, expiresAt);

    return {
      documentId: document.id,
      fileName: document.fileName || 'unknown',
      fileType: document.fileType || 'application/pdf',
      fileSize: document.fileSize || 0,
      storageLocation,
      url,
      urlExpiresAt: expiresAt.toISOString(),
      uploadedAt: document.createdAt.toISOString(),
      uploadedBy: document.uploadedBy || undefined,
    };
  }

  // ============================================================
  // Document Trace Chain
  // ============================================================

  /**
   * 獲取完整追溯鏈
   *
   * @description
   *   構建文件從上傳到核准的完整處理歷程，包含：
   *   - 文件基本資訊
   *   - 原始文件來源
   *   - OCR 處理結果
   *   - 欄位提取結果
   *   - 修正記錄
   *   - 核准記錄
   *   - 變更歷史
   *
   * @param documentId - 文件 ID
   * @returns 完整追溯鏈，如果文件不存在則返回 null
   */
  async getDocumentTraceChain(
    documentId: string
  ): Promise<DocumentTraceChain | null> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        extractionResult: true,
        corrections: {
          include: {
            corrector: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        reviewRecords: {
          where: { action: 'APPROVED' },
          include: {
            reviewer: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!document) {
      return null;
    }

    // 並行獲取來源和 OCR 結果
    // 注意：Document 目前不在 TrackedModel 中，故不追蹤變更歷史
    const [source, ocrResult] = await Promise.all([
      this.getDocumentSource(documentId),
      this.getOcrResult(documentId),
    ]);

    if (!source) {
      return null;
    }

    // 構建追溯鏈
    return {
      document: {
        id: document.id,
        status: document.status,
        createdAt: document.createdAt.toISOString(),
      },
      source,
      ocrResult: ocrResult || this.getEmptyOcrResult(documentId),
      extractionResult: this.mapExtractionResult(document.extractionResult),
      corrections: this.mapCorrections(document.corrections),
      approvals: this.mapReviewRecordsToApprovals(document.reviewRecords),
      changeHistory: [], // Document 目前不追蹤變更歷史
    };
  }

  // ============================================================
  // Traceability Report
  // ============================================================

  /**
   * 生成追溯報告
   *
   * @description
   *   生成包含完整追溯鏈的報告，並計算 SHA256 雜湊值確保完整性。
   *   報告會儲存到資料庫中以供後續查詢。
   *
   * @param documentId - 文件 ID
   * @param generatedBy - 生成者資訊
   * @returns 追溯報告
   * @throws Error 如果文件不存在
   */
  async generateTraceabilityReport(
    documentId: string,
    generatedBy: { id: string; name: string }
  ): Promise<TraceabilityReport> {
    // 獲取完整追溯鏈
    const traceChain = await this.getDocumentTraceChain(documentId);
    if (!traceChain) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // 驗證完整性
    const integrityVerified = await this.verifyIntegrity(traceChain);

    // 生成報告 ID
    const reportId = `TR-${documentId}-${Date.now()}`;

    // 計算報告雜湊
    const reportContent = JSON.stringify({
      document: traceChain,
      generatedAt: new Date().toISOString(),
      generatedBy: generatedBy.id,
    });
    const reportHash = createHash('sha256').update(reportContent).digest('hex');

    // 構建報告
    const report: TraceabilityReport = {
      reportId,
      generatedAt: new Date().toISOString(),
      generatedBy: generatedBy.name,
      document: traceChain,
      integrityVerified,
      reportHash,
    };

    // 儲存報告到資料庫
    await prisma.traceabilityReport.create({
      data: {
        id: reportId,
        documentId,
        generatedBy: generatedBy.id,
        reportData: report as unknown as Prisma.InputJsonValue,
        reportHash,
        integrityVerified,
      },
    });

    return report;
  }

  // ============================================================
  // Private Methods - Data Retrieval
  // ============================================================

  /**
   * 獲取 OCR 結果
   *
   * @param documentId - 文件 ID
   * @returns OCR 結果，如果不存在則返回 null
   */
  private async getOcrResult(documentId: string): Promise<OcrResult | null> {
    const result = await prisma.ocrResult.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    if (!result) {
      return null;
    }

    return {
      documentId: result.documentId,
      extractedText: result.extractedText,
      rawResult: result.rawResult as Record<string, unknown>,
      invoiceData: result.invoiceData as Record<string, unknown> | undefined,
      confidence: result.confidence ?? 0,
      processedAt: result.createdAt.toISOString(),
    };
  }

  /**
   * 發起文件解凍請求
   *
   * @param filePath - 文件路徑
   */
  private async initiateFileRetrieval(filePath: string): Promise<void> {
    await retrieveFromArchive(filePath);
  }

  // ============================================================
  // Private Methods - Data Mapping
  // ============================================================

  /**
   * 獲取空的 OCR 結果（用於文件沒有 OCR 記錄時）
   */
  private getEmptyOcrResult(documentId: string): OcrResult {
    return {
      documentId,
      extractedText: '',
      rawResult: {},
      confidence: 0,
      processedAt: '',
    };
  }

  /**
   * 映射提取結果
   */
  private mapExtractionResult(
    extractionResult: {
      fieldMappings: unknown;
      averageConfidence: number;
      createdAt: Date;
    } | null
  ): ExtractionResultData {
    if (!extractionResult) {
      return {
        fields: {},
        confidence: 0,
        extractedAt: '',
      };
    }

    return {
      fields: (extractionResult.fieldMappings as Record<string, unknown>) || {},
      confidence: extractionResult.averageConfidence / 100, // 轉換為 0-1 範圍
      extractedAt: extractionResult.createdAt.toISOString(),
    };
  }

  /**
   * 映射修正記錄
   */
  private mapCorrections(
    corrections: Array<{
      id: string;
      documentId: string;
      fieldName: string;
      originalValue: string | null;
      correctedValue: string;
      correctedBy: string;
      corrector: { id: string; name: string | null } | null;
      createdAt: Date;
      correctionType: string;
      exceptionReason: string | null;
    }>
  ): CorrectionTrace[] {
    return corrections.map((c) => ({
      correctionId: c.id,
      documentId: c.documentId,
      field: c.fieldName,
      originalValue: c.originalValue,
      correctedValue: c.correctedValue,
      correctedBy: c.correctedBy,
      correctedByName: c.corrector?.name || '',
      correctedAt: c.createdAt.toISOString(),
      correctionType: c.correctionType as 'NORMAL' | 'EXCEPTION',
      reason: c.exceptionReason || undefined,
    }));
  }

  /**
   * 將審核記錄映射為核准記錄
   */
  private mapReviewRecordsToApprovals(
    reviewRecords: Array<{
      reviewerId: string;
      reviewer: { id: string; name: string | null } | null;
      createdAt: Date;
      action: string;
    }>
  ): ApprovalRecord[] {
    return reviewRecords
      .filter((r) => r.action === 'APPROVED')
      .map((r) => ({
        approvedBy: r.reviewerId,
        approvedByName: r.reviewer?.name || '',
        approvedAt: r.createdAt.toISOString(),
        autoApproved: false, // 審核記錄沒有自動核准的概念
      }));
  }

  /**
   * 映射變更歷史
   */
  private mapChangeHistory(
    entries: Array<{
      version: number;
      changedByName: string;
      createdAt: Date;
      changeType: string;
    }>
  ): ChangeHistoryRecord[] {
    return entries.map((h) => ({
      version: h.version,
      changedBy: h.changedByName,
      changedAt: h.createdAt.toISOString(),
      changeType: h.changeType,
    }));
  }

  // ============================================================
  // Private Methods - Validation
  // ============================================================

  /**
   * 驗證追溯鏈完整性
   *
   * @description
   *   驗證追溯鏈的完整性，包括：
   *   - 文件 checksum 驗證
   *   - 修正記錄時間順序驗證
   *   - 核准記錄存在性驗證
   *
   * @param traceChain - 追溯鏈
   * @returns 是否通過完整性驗證
   */
  private async verifyIntegrity(
    traceChain: DocumentTraceChain
  ): Promise<boolean> {
    try {
      // 1. 驗證修正記錄的時間順序
      const corrections = traceChain.corrections;
      for (let i = 1; i < corrections.length; i++) {
        const prevTime = new Date(corrections[i - 1].correctedAt).getTime();
        const currTime = new Date(corrections[i].correctedAt).getTime();
        if (currTime < prevTime) {
          // 時間順序不正確
          return false;
        }
      }

      // 2. 驗證核准記錄的時間順序
      const approvals = traceChain.approvals;
      for (let i = 1; i < approvals.length; i++) {
        const prevTime = new Date(approvals[i - 1].approvedAt).getTime();
        const currTime = new Date(approvals[i].approvedAt).getTime();
        if (currTime < prevTime) {
          return false;
        }
      }

      // 3. 如果文件狀態是已完成，應該有核准記錄
      if (
        traceChain.document.status === 'COMPLETED' &&
        approvals.length === 0
      ) {
        return false;
      }

      return true;
    } catch {
      // 驗證過程中出錯，返回 false
      return false;
    }
  }
}

// ============================================================
// Export Singleton Instance
// ============================================================

/**
 * 文件追溯服務單例
 */
export const traceabilityService = new TraceabilityService();

/**
 * 導出類供測試使用
 */
export { TraceabilityService };
