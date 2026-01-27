/**
 * @fileoverview 統一處理結果持久化服務
 * @description
 *   將 UnifiedDocumentProcessor 的處理結果寫入資料庫：
 *   - 轉換 MappedFieldValue[] → ExtractionResult.fieldMappings JSON
 *   - Upsert ExtractionResult 記錄
 *   - 更新 Document 狀態、companyId、processingPath
 *   - 使用 Prisma 交易確保原子性
 *
 * @module src/services/processing-result-persistence
 * @since CHANGE-014 Phase 2 — 端到端管線整合
 * @lastModified 2026-01-27
 *
 * @features
 *   - UnifiedProcessingResult → ExtractionResult 轉換
 *   - 原子性資料庫寫入（Prisma $transaction）
 *   - 成功/失敗兩種路徑的狀態更新
 *
 * @dependencies
 *   - @/lib/prisma - Prisma Client
 *   - @/types/unified-processor - 統一處理結果類型
 *
 * @related
 *   - src/services/unified-processor/ - 統一處理器（產生結果）
 *   - src/services/template-matching-engine.service.ts - 模版匹配（消費 ExtractionResult）
 */

import { Prisma, ProcessingPath } from '@prisma/client';
import prisma from '@/lib/prisma';
import type {
  UnifiedProcessingResult,
  UnifiedRoutingDecision,
  MappedFieldValue,
  UnmappedField,
} from '@/types/unified-processor';

// ============================================================================
// Types
// ============================================================================

/**
 * 持久化輸入參數
 */
export interface PersistProcessingResultInput {
  /** 文件 ID */
  documentId: string;
  /** 統一處理結果 */
  result: UnifiedProcessingResult;
  /** 操作用戶 ID */
  userId: string;
}

/**
 * 持久化輸出結果
 */
export interface PersistProcessingResultOutput {
  /** ExtractionResult 記錄 ID */
  extractionResultId: string;
  /** 更新後的 Document 狀態 */
  documentStatus: string;
  /** 欄位統計 */
  fieldCount: {
    total: number;
    mapped: number;
    unmapped: number;
  };
}

/**
 * ExtractionResult.fieldMappings 中每個欄位的結構
 */
interface FieldMappingEntry {
  value: string | number | null;
  rawValue: string;
  confidence: number;
  source: string;
  ruleId?: string;
  extractionMethod: string;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * 將 MappedFieldValue[] 轉換為 ExtractionResult.fieldMappings JSON 格式
 *
 * @description
 *   統一處理器產出 MappedFieldValue[]（陣列格式），
 *   ExtractionResult.fieldMappings 需要 Record<string, FieldMappingEntry>（物件格式）。
 *   此函數負責轉換。
 *
 * @param mappedFields - 統一處理器的映射結果
 * @param overallConfidence - 整體信心度 (0-1)
 * @returns fieldMappings JSON 物件
 */
function convertMappedFieldsToJson(
  mappedFields: MappedFieldValue[],
  overallConfidence: number = 0,
): Record<string, FieldMappingEntry> {
  const fieldMappings: Record<string, FieldMappingEntry> = {};

  for (const field of mappedFields) {
    if (!field.success) continue;

    fieldMappings[field.targetField] = {
      value: field.value,
      rawValue: String(field.originalValues?.[0] ?? ''),
      confidence: Math.round(overallConfidence * 100),
      source: 'unified',
      ruleId: field.ruleId,
      extractionMethod: field.transformType ?? 'DIRECT',
    };
  }

  return fieldMappings;
}

/**
 * 將 UnmappedField[] 轉換為 ExtractionResult.unmappedFieldDetails JSON 格式
 *
 * @param unmappedFields - 未映射欄位列表
 * @returns unmappedFieldDetails JSON 物件
 */
function convertUnmappedFieldsToJson(
  unmappedFields: UnmappedField[],
): Record<string, { reason: string; attempts: string[] }> {
  const details: Record<string, { reason: string; attempts: string[] }> = {};

  for (const field of unmappedFields) {
    details[field.fieldName] = {
      reason: field.reason,
      attempts: [],
    };
  }

  return details;
}

/**
 * 將 UnifiedRoutingDecision 轉換為 Prisma ProcessingPath enum 值
 *
 * @param routingDecision - 統一處理器的路由決策
 * @returns Prisma ProcessingPath 值
 */
function mapRoutingDecisionToProcessingPath(
  routingDecision?: UnifiedRoutingDecision,
): ProcessingPath | undefined {
  if (!routingDecision) return undefined;

  // UnifiedRoutingDecision 值與 ProcessingPath enum 值相同
  const mapping: Record<string, ProcessingPath> = {
    AUTO_APPROVE: ProcessingPath.AUTO_APPROVE,
    QUICK_REVIEW: ProcessingPath.QUICK_REVIEW,
    FULL_REVIEW: ProcessingPath.FULL_REVIEW,
  };
  return mapping[routingDecision];
}

// ============================================================================
// Main Service
// ============================================================================

/**
 * 持久化統一處理結果
 *
 * @description
 *   將 UnifiedProcessingResult 寫入資料庫：
 *   1. 轉換 mappedFields → fieldMappings JSON
 *   2. Upsert ExtractionResult（以 documentId 唯一鍵）
 *   3. 更新 Document 狀態和關聯欄位
 *   4. 使用 Prisma 交易確保原子性
 *
 * @param input - 持久化輸入（documentId + result + userId）
 * @returns 持久化結果摘要
 * @throws 如果資料庫操作失敗
 */
export async function persistProcessingResult(
  input: PersistProcessingResultInput,
): Promise<PersistProcessingResultOutput> {
  const { documentId, result } = input;

  // 計算欄位統計
  const mappedFieldsList = result.mappedFields?.filter((f) => f.success) ?? [];
  const unmappedFieldsList = result.unmappedFields ?? [];
  const totalFields = mappedFieldsList.length + unmappedFieldsList.length;

  // 轉換欄位格式
  const fieldMappings = convertMappedFieldsToJson(
    result.mappedFields ?? [],
    result.overallConfidence,
  );
  const unmappedFieldDetails = convertUnmappedFieldsToJson(unmappedFieldsList);

  // 構建信心度分數 JSON
  const confidenceScores = result.confidenceBreakdown
    ? {
        overall: result.overallConfidence ?? 0,
        breakdown: result.confidenceBreakdown,
        routingDecision: result.routingDecision,
      }
    : null;

  // 決定 Document 狀態
  const documentStatus = result.success ? 'MAPPING_COMPLETED' : 'OCR_FAILED';
  const processingPath = mapRoutingDecisionToProcessingPath(result.routingDecision);

  // 使用 Prisma 交易確保原子性
  const [extractionResult] = await prisma.$transaction([
    // 1. Upsert ExtractionResult
    prisma.extractionResult.upsert({
      where: { documentId },
      create: {
        documentId,
        companyId: result.companyId ?? null,
        fieldMappings: fieldMappings as unknown as Prisma.InputJsonValue,
        totalFields,
        mappedFields: mappedFieldsList.length,
        unmappedFields: unmappedFieldsList.length,
        averageConfidence: (result.overallConfidence ?? 0) * 100,
        confidenceScores: confidenceScores as unknown as Prisma.InputJsonValue,
        processingTime: result.totalDurationMs,
        rulesApplied: mappedFieldsList.filter((f) => f.ruleId).length,
        status: result.success ? 'COMPLETED' : 'FAILED',
        errorMessage: result.error ?? null,
        unmappedFieldDetails: unmappedFieldDetails as unknown as Prisma.InputJsonValue,
      },
      update: {
        companyId: result.companyId ?? null,
        fieldMappings: fieldMappings as unknown as Prisma.InputJsonValue,
        totalFields,
        mappedFields: mappedFieldsList.length,
        unmappedFields: unmappedFieldsList.length,
        averageConfidence: (result.overallConfidence ?? 0) * 100,
        confidenceScores: confidenceScores as unknown as Prisma.InputJsonValue,
        processingTime: result.totalDurationMs,
        rulesApplied: mappedFieldsList.filter((f) => f.ruleId).length,
        status: result.success ? 'COMPLETED' : 'FAILED',
        errorMessage: result.error ?? null,
        unmappedFieldDetails: unmappedFieldDetails as unknown as Prisma.InputJsonValue,
      },
    }),

    // 2. 更新 Document
    prisma.document.update({
      where: { id: documentId },
      data: {
        status: documentStatus,
        companyId: result.companyId ?? undefined,
        processingPath: processingPath ?? undefined,
        routingDecision: result.routingDecision
          ? ({ decision: result.routingDecision, confidence: result.overallConfidence } as unknown as Prisma.InputJsonValue)
          : undefined,
        processingEndedAt: new Date(),
        processingDuration: result.totalDurationMs,
        errorMessage: result.success ? null : (result.error ?? 'Processing failed'),
      },
    }),
  ]);

  return {
    extractionResultId: extractionResult.id,
    documentStatus,
    fieldCount: {
      total: totalFields,
      mapped: mappedFieldsList.length,
      unmapped: unmappedFieldsList.length,
    },
  };
}

/**
 * 標記文件處理失敗
 *
 * @description
 *   用於在處理過程的任何階段發生不可恢復錯誤時，
 *   更新 Document 狀態為失敗。
 *
 * @param documentId - 文件 ID
 * @param errorMessage - 錯誤訊息
 */
export async function markDocumentProcessingFailed(
  documentId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'OCR_FAILED',
      errorMessage,
      processingEndedAt: new Date(),
    },
  });
}
