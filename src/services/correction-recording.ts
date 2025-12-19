/**
 * @fileoverview 修正記錄服務
 * @description
 *   負責記錄用戶的欄位修正並準備後續模式分析：
 *   - 記錄單一和批量修正
 *   - 區分 NORMAL 和 EXCEPTION 類型
 *   - 提供修正統計資訊
 *
 * @module src/services/correction-recording
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 *
 * @features
 *   - 修正記錄創建
 *   - 批量修正記錄
 *   - 待分析修正統計
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @prisma/client - Prisma 類型
 */

import { prisma } from '@/lib/prisma';
import type { CorrectionType } from '@prisma/client';
import type { ExtractionContext } from '@/types/pattern';

// ============================================================
// Types
// ============================================================

/**
 * 記錄修正的輸入參數
 */
export interface RecordCorrectionInput {
  /** 文件 ID */
  documentId: string;
  /** 欄位名稱 */
  fieldName: string;
  /** 原始值（可為 null） */
  originalValue: string | null;
  /** 修正後的值 */
  correctedValue: string;
  /** 修正類型 */
  correctionType: CorrectionType;
  /** 特例原因（EXCEPTION 時必填） */
  exceptionReason?: string;
  /** 修正者 ID */
  correctedBy: string;
  /** 提取上下文資訊 */
  extractionContext?: ExtractionContext;
}

/**
 * 修正統計結果
 */
export interface CorrectionStats {
  /** 總修正數 */
  total: number;
  /** 正常修正數 */
  normal: number;
  /** 特例修正數 */
  exception: number;
  /** 已分析數 */
  analyzed: number;
  /** 待分析數 */
  pending: number;
}

// ============================================================
// Service
// ============================================================

/**
 * 修正記錄服務
 *
 * @description
 *   負責記錄用戶修正並準備後續分析
 *   - NORMAL 類型修正會被後續的模式分析服務處理
 *   - EXCEPTION 類型修正會直接標記為已處理，不參與學習
 */
export class CorrectionRecordingService {
  // --------------------------------------------------------
  // 修正記錄
  // --------------------------------------------------------

  /**
   * 記錄單一修正
   *
   * @param input - 修正輸入參數
   * @returns 創建的修正記錄 ID
   *
   * @example
   * ```typescript
   * const correctionId = await correctionRecordingService.recordCorrection({
   *   documentId: 'doc-123',
   *   fieldName: 'amount',
   *   originalValue: '100',
   *   correctedValue: '1000',
   *   correctionType: 'NORMAL',
   *   correctedBy: 'user-456'
   * })
   * ```
   */
  async recordCorrection(input: RecordCorrectionInput): Promise<string> {
    const correction = await prisma.correction.create({
      data: {
        documentId: input.documentId,
        fieldName: input.fieldName,
        originalValue: input.originalValue,
        correctedValue: input.correctedValue,
        correctionType: input.correctionType,
        exceptionReason: input.exceptionReason,
        correctedBy: input.correctedBy,
        extractionContext: input.extractionContext as object | undefined,
        // NORMAL 類型的修正 analyzedAt 保持 null，等待分析
        // EXCEPTION 類型直接標記為已處理（不用於學習）
        analyzedAt: input.correctionType === 'EXCEPTION' ? new Date() : null,
      },
    });

    return correction.id;
  }

  /**
   * 批量記錄修正
   *
   * @param inputs - 修正輸入參數陣列
   * @returns 創建的修正記錄數量
   */
  async recordCorrections(inputs: RecordCorrectionInput[]): Promise<number> {
    if (inputs.length === 0) return 0;

    const result = await prisma.correction.createMany({
      data: inputs.map((input) => ({
        documentId: input.documentId,
        fieldName: input.fieldName,
        originalValue: input.originalValue,
        correctedValue: input.correctedValue,
        correctionType: input.correctionType,
        exceptionReason: input.exceptionReason,
        correctedBy: input.correctedBy,
        extractionContext: input.extractionContext as object | undefined,
        analyzedAt: input.correctionType === 'EXCEPTION' ? new Date() : null,
      })),
    });

    return result.count;
  }

  // --------------------------------------------------------
  // 統計查詢
  // --------------------------------------------------------

  /**
   * 獲取待分析的修正數量
   *
   * @returns 待分析的 NORMAL 類型修正數量
   */
  async getPendingAnalysisCount(): Promise<number> {
    return prisma.correction.count({
      where: {
        correctionType: 'NORMAL',
        analyzedAt: null,
      },
    });
  }

  /**
   * 獲取修正統計
   *
   * @param forwarderId - 可選的 Forwarder ID 過濾
   * @param days - 統計天數（預設 30 天）
   * @returns 修正統計結果
   */
  async getCorrectionStats(forwarderId?: string, days: number = 30): Promise<CorrectionStats> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 構建查詢條件
    const baseWhere = {
      createdAt: { gte: since },
      ...(forwarderId && {
        document: { forwarderId },
      }),
    };

    // 並行執行統計查詢
    const [total, byType, analyzed] = await Promise.all([
      // 總數
      prisma.correction.count({ where: baseWhere }),

      // 按類型分組
      prisma.correction.groupBy({
        by: ['correctionType'],
        where: baseWhere,
        _count: { id: true },
      }),

      // 已分析數
      prisma.correction.count({
        where: {
          ...baseWhere,
          analyzedAt: { not: null },
        },
      }),
    ]);

    // 轉換類型統計
    const typeMap = byType.reduce(
      (acc, t) => {
        acc[t.correctionType] = t._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total,
      normal: typeMap['NORMAL'] || 0,
      exception: typeMap['EXCEPTION'] || 0,
      analyzed,
      pending: total - analyzed,
    };
  }

  /**
   * 獲取特定文件的修正記錄
   *
   * @param documentId - 文件 ID
   * @returns 該文件的所有修正記錄
   */
  async getCorrectionsByDocument(documentId: string) {
    return prisma.correction.findMany({
      where: { documentId },
      include: {
        corrector: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pattern: {
          select: {
            id: true,
            status: true,
            occurrenceCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 獲取特定欄位的修正歷史
   *
   * @param fieldName - 欄位名稱
   * @param forwarderId - 可選的 Forwarder ID 過濾
   * @param limit - 返回筆數限制
   * @returns 該欄位的修正歷史
   */
  async getCorrectionsByField(fieldName: string, forwarderId?: string, limit: number = 100) {
    return prisma.correction.findMany({
      where: {
        fieldName,
        correctionType: 'NORMAL',
        ...(forwarderId && {
          document: { forwarderId },
        }),
      },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            forwarderId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // --------------------------------------------------------
  // 管理操作
  // --------------------------------------------------------

  /**
   * 將修正標記為已分析
   *
   * @param correctionIds - 要標記的修正 ID 陣列
   * @param patternId - 可選的關聯模式 ID
   * @returns 更新的記錄數
   */
  async markAsAnalyzed(correctionIds: string[], patternId?: string): Promise<number> {
    if (correctionIds.length === 0) return 0;

    const result = await prisma.correction.updateMany({
      where: {
        id: { in: correctionIds },
        analyzedAt: null,
      },
      data: {
        analyzedAt: new Date(),
        ...(patternId && { patternId }),
      },
    });

    return result.count;
  }

  /**
   * 更新修正的關聯模式
   *
   * @param correctionIds - 修正 ID 陣列
   * @param patternId - 模式 ID
   * @returns 更新的記錄數
   */
  async updatePatternAssociation(correctionIds: string[], patternId: string): Promise<number> {
    if (correctionIds.length === 0) return 0;

    const result = await prisma.correction.updateMany({
      where: { id: { in: correctionIds } },
      data: { patternId },
    });

    return result.count;
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 修正記錄服務單例
 */
export const correctionRecordingService = new CorrectionRecordingService();
