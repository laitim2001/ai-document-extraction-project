/**
 * @fileoverview 文件統一處理觸發端點
 * @description
 *   觸發統一 11 步處理管線（Epic 15），將結果寫入 ExtractionResult 表，
 *   並在處理成功後 Fire-and-Forget 觸發自動模版匹配（Epic 19）。
 *   - 從 Azure Blob 下載文件 Buffer
 *   - 呼叫 UnifiedDocumentProcessorService.processFile()
 *   - 將結果持久化到 ExtractionResult + 更新 Document 狀態
 *   - 觸發 autoMatch 自動匹配模版（不阻塞 API 回應）
 *
 *   端點：
 *   - POST /api/documents/[id]/process - 觸發統一處理
 *
 * @module src/app/api/documents/[id]/process/route
 * @since CHANGE-014 Phase 2 — 端到端管線整合
 * @lastModified 2026-01-27 (Phase 3 — 連接 autoMatch)
 *
 * @dependencies
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/azure-blob - Azure Blob Storage 下載
 *   - @/services/unified-processor - 統一處理器
 *   - @/services/processing-result-persistence.service - 結果持久化
 *   - @/services/auto-template-matching.service - 自動模版匹配（Phase 3）
 *
 * @related
 *   - src/app/api/documents/[id]/route.ts - 文件詳情端點
 *   - src/services/unified-processor/unified-document-processor.service.ts - 處理器
 *   - claudedocs/4-changes/feature-changes/CHANGE-014-e2e-pipeline-phase2-core-integration.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { downloadBlob } from '@/lib/azure-blob';
import prisma from '@/lib/prisma';
import { getUnifiedDocumentProcessor } from '@/services/unified-processor';
import {
  persistProcessingResult,
  markDocumentProcessingFailed,
} from '@/services/processing-result-persistence.service';
import { autoTemplateMatchingService } from '@/services/auto-template-matching.service';
import type { ProcessFileInput } from '@/types/unified-processor';

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** 允許觸發處理的 Document 狀態 */
const PROCESSABLE_STATUSES = [
  'UPLOADED',
  'OCR_COMPLETED',
  'OCR_FAILED',
  'MAPPING_COMPLETED',
] as const;

// ============================================================
// POST /api/documents/[id]/process
// ============================================================

/**
 * POST /api/documents/[id]/process
 * 觸發統一 11 步處理管線
 *
 * @description
 *   1. 驗證 session 和文件狀態
 *   2. 從 Azure Blob 下載文件 Buffer
 *   3. 呼叫統一處理器
 *   4. 持久化結果到 ExtractionResult + Document
 *   5. 回傳處理摘要
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: documentId } = await params;

  try {
    // 1. 認證檢查
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // 2. 讀取 Document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        blobName: true,
        fileName: true,
        fileType: true,
        status: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 },
      );
    }

    // 3. 檢查狀態
    if (!PROCESSABLE_STATUSES.includes(document.status as typeof PROCESSABLE_STATUSES[number])) {
      return NextResponse.json(
        {
          success: false,
          error: `Document status "${document.status}" cannot be processed. Allowed: ${PROCESSABLE_STATUSES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // 4. 更新狀態為處理中
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'OCR_PROCESSING',
        processingStartedAt: new Date(),
        errorMessage: null,
      },
    });

    // 5. 從 Azure Blob 下載文件
    let fileBuffer: Buffer;
    try {
      fileBuffer = await downloadBlob(document.blobName);
    } catch (downloadError) {
      const msg = downloadError instanceof Error ? downloadError.message : 'Blob download failed';
      await markDocumentProcessingFailed(documentId, `Blob download error: ${msg}`);
      return NextResponse.json(
        { success: false, error: `Failed to download file: ${msg}` },
        { status: 500 },
      );
    }

    // 6. 建構 ProcessFileInput
    const input: ProcessFileInput = {
      fileId: document.id,
      fileName: document.fileName,
      fileBuffer,
      mimeType: document.fileType,
      userId: session.user.id,
    };

    // 7. 執行統一處理
    const processor = getUnifiedDocumentProcessor();
    const result = await processor.processFile(input);

    // 8. 持久化結果
    const persistResult = await persistProcessingResult({
      documentId: document.id,
      result,
      userId: session.user.id,
    });

    // 8.5 觸發自動模版匹配（Fire-and-Forget）
    //   條件：處理成功且已識別 companyId（autoMatch 需要 companyId 解析預設模版）
    if (result.success && result.companyId) {
      autoTemplateMatchingService.autoMatch(document.id)
        .then((matchResult) => {
          if (matchResult.success) {
            console.log(`[Process] Auto-match success for ${document.id}: instance=${matchResult.templateInstanceId}`);
          } else {
            console.log(`[Process] Auto-match skipped for ${document.id}: ${matchResult.error}`);
          }
        })
        .catch((err) => {
          console.error(`[Process] Auto-match error for ${document.id}:`, err);
        });
    }

    // 9. 回傳摘要
    return NextResponse.json({
      success: true,
      data: {
        documentId: document.id,
        status: persistResult.documentStatus,
        processingDuration: result.totalDurationMs,
        confidence: result.overallConfidence ?? null,
        routingDecision: result.routingDecision ?? null,
        fieldCount: persistResult.fieldCount,
        companyId: result.companyId ?? null,
        companyName: result.companyName ?? null,
        warnings: result.warnings?.length ?? 0,
        usedLegacyProcessor: result.usedLegacyProcessor,
      },
    });
  } catch (error) {
    // 10. 錯誤處理
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    console.error(`[Process Document] Failed for ${documentId}:`, error);

    // 嘗試更新 Document 狀態為失敗
    try {
      await markDocumentProcessingFailed(documentId, errorMessage);
    } catch (updateError) {
      console.error(`[Process Document] Failed to update status for ${documentId}:`, updateError);
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
