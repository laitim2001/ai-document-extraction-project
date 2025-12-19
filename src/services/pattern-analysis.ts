/**
 * @fileoverview 模式分析服務
 * @description
 *   負責識別重複的修正模式並標記候選規則：
 *   - 從未分析的修正記錄中識別相似模式
 *   - 使用 Levenshtein、數值、日期相似度算法
 *   - 當模式達到閾值時標記為 CANDIDATE
 *
 * @module src/services/pattern-analysis
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 *
 * @features
 *   - 每日定時分析修正模式
 *   - 相似度識別與分組
 *   - 候選規則自動標記
 *   - 分析日誌記錄
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/lib/hash - Hash 生成工具
 *   - @/services/similarity - 相似度算法
 *   - @/types/pattern - 類型定義
 */

import { prisma } from '@/lib/prisma';
import type { PatternStatus, Correction } from '@prisma/client';
import { generateSimplePatternHash, extractRepresentativePair } from '@/lib/hash';
import { calculateSimilarityWithThreshold } from './similarity/levenshtein';
import { numericSimilarity } from './similarity/numeric-similarity';
import { dateSimilarity } from './similarity/date-similarity';
import {
  PATTERN_THRESHOLDS,
  type AnalysisResult,
  type GroupedCorrection,
} from '@/types/pattern';

// ============================================================
// Types
// ============================================================

/**
 * 修正分組
 */
interface PatternGroup {
  /** 分組鍵 (forwarderId:fieldName) */
  key: string;
  /** Forwarder ID */
  forwarderId: string;
  /** 欄位名稱 */
  fieldName: string;
  /** 該組的修正記錄 */
  corrections: GroupedCorrection[];
}

/**
 * 帶有文件資訊的修正記錄
 */
type CorrectionWithDocument = Correction & {
  document: {
    id: string;
    fileName: string;
    forwarderId: string | null;
  };
};

/**
 * 內部使用的樣本值結構（存儲在 patterns JSON 中）
 */
interface InternalSampleValue {
  originalValue: string;
  correctedValue: string;
  documentId: string;
  correctedAt: string;
}

/**
 * 內部使用的模式 JSON 結構
 */
interface InternalPatternData {
  originalValue: string;
  correctedValue: string;
  similarity: number;
  count: number;
  samples: InternalSampleValue[];
}

/**
 * 分析狀態結果
 */
export interface AnalysisStatus {
  lastAnalysis: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    correctionsAnalyzed: number;
    patternsFound: number;
    candidatesMarked: number;
  } | null;
  pendingCorrections: number;
  totalPatterns: number;
  candidatePatterns: number;
}

// ============================================================
// Service
// ============================================================

/**
 * 模式分析服務
 *
 * @description
 *   負責識別重複的修正模式並標記候選規則
 *   - DETECTED: 初次發現的模式
 *   - CANDIDATE: 達到閾值（>=3次）的候選規則
 *   - SUGGESTED: 已建議給 Super User
 *   - PROCESSED/IGNORED: 已處理
 */
export class PatternAnalysisService {
  private readonly THRESHOLD = PATTERN_THRESHOLDS.CANDIDATE_THRESHOLD;
  private readonly SIMILARITY_THRESHOLD = PATTERN_THRESHOLDS.SIMILARITY_THRESHOLD;
  private readonly MAX_SAMPLES = PATTERN_THRESHOLDS.MAX_SAMPLE_VALUES;
  private readonly BATCH_SIZE = 1000;

  // --------------------------------------------------------
  // Main Analysis
  // --------------------------------------------------------

  /**
   * 執行模式分析
   *
   * @description
   *   主入口方法，由定時任務調用
   *   1. 獲取未分析的 NORMAL 修正
   *   2. 按 Forwarder + FieldName 分組
   *   3. 識別相似模式
   *   4. 標記達標的候選
   *
   * @returns 分析結果統計
   */
  async analyzeCorrections(): Promise<AnalysisResult> {
    const startTime = Date.now();

    // 創建分析日誌
    const log = await prisma.patternAnalysisLog.create({
      data: {
        startedAt: new Date(),
        status: 'RUNNING',
        totalAnalyzed: 0,
        patternsDetected: 0,
        patternsUpdated: 0,
        candidatesCreated: 0,
        executionTime: 0,
      },
    });

    try {
      // 1. 獲取未分析的 NORMAL 修正
      const corrections = await this.fetchUnanalyzedCorrections();

      if (corrections.length === 0) {
        await this.completeLog(log.id, 0, 0, 0, 0, Date.now() - startTime);
        return {
          totalAnalyzed: 0,
          patternsDetected: 0,
          patternsUpdated: 0,
          candidatesCreated: 0,
          executionTime: Date.now() - startTime,
          status: 'success',
        };
      }

      // 2. 按 Forwarder + FieldName 分組
      const groups = this.groupCorrections(corrections);

      // 3. 識別相似模式
      let patternsFound = 0;
      let patternsUpdated = 0;

      for (const group of groups) {
        const { found, updated } = await this.processGroup(group);
        patternsFound += found;
        patternsUpdated += updated;
      }

      // 4. 標記達標的候選
      const candidatesMarked = await this.markCandidates();

      // 5. 標記修正為已分析
      await this.markCorrectionsAnalyzed(corrections.map((c) => c.id));

      // 6. 完成日誌
      const duration = Date.now() - startTime;
      await this.completeLog(
        log.id,
        corrections.length,
        patternsFound,
        patternsUpdated,
        candidatesMarked,
        duration
      );

      return {
        totalAnalyzed: corrections.length,
        patternsDetected: patternsFound,
        patternsUpdated,
        candidatesCreated: candidatesMarked,
        executionTime: duration,
        status: 'success',
      };
    } catch (error) {
      // 記錄錯誤
      await prisma.patternAnalysisLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          executionTime: Date.now() - startTime,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  // --------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------

  /**
   * 獲取未分析的修正記錄
   *
   * @returns 未分析的 NORMAL 類型修正列表
   */
  private async fetchUnanalyzedCorrections(): Promise<CorrectionWithDocument[]> {
    return prisma.correction.findMany({
      where: {
        correctionType: 'NORMAL',
        analyzedAt: null,
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
      orderBy: { createdAt: 'asc' },
      take: this.BATCH_SIZE,
    });
  }

  // --------------------------------------------------------
  // Grouping
  // --------------------------------------------------------

  /**
   * 按 Forwarder + FieldName 分組
   *
   * @param corrections - 修正記錄列表
   * @returns 分組後的修正
   */
  private groupCorrections(corrections: CorrectionWithDocument[]): PatternGroup[] {
    const grouped = new Map<string, PatternGroup>();

    for (const correction of corrections) {
      const forwarderId = correction.document.forwarderId;
      if (!forwarderId) continue;

      const key = `${forwarderId}:${correction.fieldName}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          forwarderId,
          fieldName: correction.fieldName,
          corrections: [],
        });
      }

      grouped.get(key)!.corrections.push({
        id: correction.id,
        originalValue: correction.originalValue || '',
        correctedValue: correction.correctedValue,
        documentId: correction.document.id,
        correctedAt: correction.createdAt,
      });
    }

    return Array.from(grouped.values());
  }

  // --------------------------------------------------------
  // Pattern Processing
  // --------------------------------------------------------

  /**
   * 處理單一分組
   *
   * @param group - 修正分組
   * @returns 發現和更新的模式數量
   */
  private async processGroup(
    group: PatternGroup
  ): Promise<{ found: number; updated: number }> {
    const { forwarderId, fieldName, corrections } = group;

    // 找出相似的修正模式
    const similarGroups = this.findSimilarPatterns(corrections);

    let found = 0;
    let updated = 0;

    for (const similarGroup of similarGroups) {
      const result = await this.upsertPattern(forwarderId, fieldName, similarGroup);
      if (result.created) found++;
      if (result.updated) updated++;
    }

    return { found, updated };
  }

  /**
   * 識別相似的修正模式
   *
   * @description
   *   使用相似度算法將相似的修正分組
   *   相似度閾值預設為 0.8
   *
   * @param corrections - 修正記錄列表
   * @returns 相似修正的分組
   */
  private findSimilarPatterns(corrections: GroupedCorrection[]): GroupedCorrection[][] {
    if (corrections.length === 0) return [];

    const groups: GroupedCorrection[][] = [];
    const assigned = new Set<string>();

    for (let i = 0; i < corrections.length; i++) {
      if (assigned.has(corrections[i].id)) continue;

      const group: GroupedCorrection[] = [corrections[i]];
      assigned.add(corrections[i].id);

      for (let j = i + 1; j < corrections.length; j++) {
        if (assigned.has(corrections[j].id)) continue;

        if (this.areSimilar(corrections[i], corrections[j])) {
          group.push(corrections[j]);
          assigned.add(corrections[j].id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * 判斷兩個修正是否相似
   *
   * @param c1 - 第一個修正
   * @param c2 - 第二個修正
   * @returns 是否相似
   */
  private areSimilar(c1: GroupedCorrection, c2: GroupedCorrection): boolean {
    const similarity = this.calculateComprehensiveSimilarity(
      c1.originalValue || '',
      c1.correctedValue,
      c2.originalValue || '',
      c2.correctedValue
    );

    return similarity >= this.SIMILARITY_THRESHOLD;
  }

  /**
   * 計算綜合相似度
   *
   * @description
   *   依序嘗試數值、日期、字串相似度
   *   返回最合適的相似度分數
   *
   * @param original1 - 第一個原始值
   * @param corrected1 - 第一個修正值
   * @param original2 - 第二個原始值
   * @param corrected2 - 第二個修正值
   * @returns 綜合相似度 (0-1)
   */
  private calculateComprehensiveSimilarity(
    original1: string,
    corrected1: string,
    original2: string,
    corrected2: string
  ): number {
    // 嘗試數值相似度
    const numOrig = numericSimilarity(original1, original2);
    const numCorr = numericSimilarity(corrected1, corrected2);
    if (numOrig.isNumeric && numCorr.isNumeric) {
      return (numOrig.similarity + numCorr.similarity) / 2;
    }

    // 嘗試日期相似度
    const dateOrig = dateSimilarity(original1, original2);
    const dateCorr = dateSimilarity(corrected1, corrected2);
    if (dateOrig.isDate && dateCorr.isDate) {
      return (dateOrig.similarity + dateCorr.similarity) / 2;
    }

    // 使用 Levenshtein 相似度
    const origSim = calculateSimilarityWithThreshold(
      original1,
      original2,
      this.SIMILARITY_THRESHOLD * 0.5 // 寬鬆一些
    );
    const corrSim = calculateSimilarityWithThreshold(
      corrected1,
      corrected2,
      this.SIMILARITY_THRESHOLD * 0.5
    );

    return (origSim.similarity + corrSim.similarity) / 2;
  }

  // --------------------------------------------------------
  // Pattern Persistence
  // --------------------------------------------------------

  /**
   * 更新或創建模式記錄
   *
   * @param forwarderId - Forwarder ID
   * @param fieldName - 欄位名稱
   * @param corrections - 相似的修正列表
   * @returns 是否創建或更新
   */
  private async upsertPattern(
    forwarderId: string,
    fieldName: string,
    corrections: GroupedCorrection[]
  ): Promise<{ created: boolean; updated: boolean }> {
    if (corrections.length === 0) {
      return { created: false, updated: false };
    }

    // 提取代表性模式
    const { originalPattern, correctedPattern } = extractRepresentativePair(
      corrections.map((c) => ({
        originalValue: c.originalValue,
        correctedValue: c.correctedValue,
      }))
    );

    // 生成模式 Hash
    const patternHash = generateSimplePatternHash(
      forwarderId,
      fieldName,
      originalPattern,
      correctedPattern
    );

    // 準備樣本值
    const sampleValues: InternalSampleValue[] = corrections
      .slice(0, this.MAX_SAMPLES)
      .map((c) => ({
        originalValue: c.originalValue || '',
        correctedValue: c.correctedValue,
        documentId: c.documentId,
        correctedAt: c.correctedAt.toISOString(),
      }));

    // 計算信心度（基於樣本數量和一致性）
    const confidence = Math.min(1, corrections.length / 10);

    // 準備 patterns JSON 結構
    const patternsData: InternalPatternData[] = [
      {
        originalValue: originalPattern,
        correctedValue: correctedPattern,
        similarity: 1.0,
        count: corrections.length,
        samples: sampleValues,
      },
    ];

    // 嘗試查找現有模式
    const existing = await prisma.correctionPattern.findUnique({
      where: { patternHash },
    });

    if (existing) {
      // 更新現有模式
      const existingPatterns = (existing.patterns as unknown as InternalPatternData[]) || [];
      const existingSamples =
        Array.isArray(existingPatterns) && existingPatterns[0]?.samples
          ? existingPatterns[0].samples
          : [];

      const mergedSamples = [...existingSamples];

      for (const sample of sampleValues) {
        if (!mergedSamples.some((s) => s.documentId === sample.documentId)) {
          mergedSamples.push(sample);
        }
      }

      // 更新 patterns 結構
      const updatedPatterns: InternalPatternData[] = [
        {
          originalValue: originalPattern,
          correctedValue: correctedPattern,
          similarity: 1.0,
          count: existing.occurrenceCount + corrections.length,
          samples: mergedSamples.slice(0, this.MAX_SAMPLES),
        },
      ];

      await prisma.correctionPattern.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: { increment: corrections.length },
          lastSeenAt: new Date(),
          confidence: Math.max(existing.confidence, confidence),
          patterns: updatedPatterns as unknown as Parameters<typeof prisma.correctionPattern.update>[0]['data']['patterns'],
        },
      });

      // 關聯修正記錄
      await prisma.correction.updateMany({
        where: { id: { in: corrections.map((c) => c.id) } },
        data: { patternId: existing.id },
      });

      return { created: false, updated: true };
    }

    // 創建新模式
    const pattern = await prisma.correctionPattern.create({
      data: {
        forwarderId,
        fieldName,
        patternHash,
        patterns: patternsData as unknown as Parameters<typeof prisma.correctionPattern.create>[0]['data']['patterns'],
        occurrenceCount: corrections.length,
        confidence,
        firstSeenAt: corrections[0].correctedAt,
        lastSeenAt: new Date(),
      },
    });

    // 關聯修正記錄
    await prisma.correction.updateMany({
      where: { id: { in: corrections.map((c) => c.id) } },
      data: { patternId: pattern.id },
    });

    return { created: true, updated: false };
  }

  // --------------------------------------------------------
  // Status Updates
  // --------------------------------------------------------

  /**
   * 標記達標的候選
   *
   * @description
   *   將 occurrenceCount >= THRESHOLD 且狀態為 DETECTED 的模式
   *   標記為 CANDIDATE
   *
   * @returns 更新的記錄數
   */
  private async markCandidates(): Promise<number> {
    const result = await prisma.correctionPattern.updateMany({
      where: {
        occurrenceCount: { gte: this.THRESHOLD },
        status: 'DETECTED',
      },
      data: {
        status: 'CANDIDATE',
      },
    });

    return result.count;
  }

  /**
   * 標記修正為已分析
   *
   * @param correctionIds - 修正 ID 列表
   */
  private async markCorrectionsAnalyzed(correctionIds: string[]): Promise<void> {
    await prisma.correction.updateMany({
      where: { id: { in: correctionIds } },
      data: { analyzedAt: new Date() },
    });
  }

  // --------------------------------------------------------
  // Logging
  // --------------------------------------------------------

  /**
   * 完成分析日誌
   *
   * @param logId - 日誌 ID
   * @param correctionsAnalyzed - 分析的修正數量
   * @param patternsFound - 發現的模式數量
   * @param patternsUpdated - 更新的模式數量
   * @param candidatesMarked - 標記的候選數量
   * @param duration - 執行時間（毫秒）
   */
  private async completeLog(
    logId: string,
    correctionsAnalyzed: number,
    patternsFound: number,
    patternsUpdated: number,
    candidatesMarked: number,
    duration: number
  ): Promise<void> {
    await prisma.patternAnalysisLog.update({
      where: { id: logId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalAnalyzed: correctionsAnalyzed,
        patternsDetected: patternsFound,
        patternsUpdated: patternsUpdated,
        candidatesCreated: candidatesMarked,
        executionTime: duration,
      },
    });
  }

  // --------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------

  /**
   * 獲取分析狀態
   *
   * @returns 分析狀態資訊
   */
  async getAnalysisStatus(): Promise<AnalysisStatus> {
    const [lastLog, pendingCount, patternStats] = await Promise.all([
      prisma.patternAnalysisLog.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.correction.count({
        where: {
          correctionType: 'NORMAL',
          analyzedAt: null,
        },
      }),
      prisma.correctionPattern.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const statsMap = patternStats.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      lastAnalysis: lastLog
        ? {
            id: lastLog.id,
            status: lastLog.status,
            startedAt: lastLog.startedAt.toISOString(),
            completedAt: lastLog.completedAt?.toISOString() || null,
            correctionsAnalyzed: lastLog.totalAnalyzed,
            patternsFound: lastLog.patternsDetected,
            candidatesMarked: lastLog.candidatesCreated,
          }
        : null,
      pendingCorrections: pendingCount,
      totalPatterns: Object.values(statsMap).reduce((a, b) => a + b, 0),
      candidatePatterns: statsMap['CANDIDATE'] || 0,
    };
  }

  /**
   * 獲取候選模式列表
   *
   * @param forwarderId - 可選的 Forwarder ID 過濾
   * @param limit - 返回筆數限制
   * @returns 候選模式列表
   */
  async getCandidatePatterns(forwarderId?: string, limit: number = 50) {
    return prisma.correctionPattern.findMany({
      where: {
        status: 'CANDIDATE',
        ...(forwarderId && { forwarderId }),
      },
      include: {
        forwarder: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: { corrections: true },
        },
      },
      orderBy: [{ occurrenceCount: 'desc' }, { confidence: 'desc' }],
      take: limit,
    });
  }

  /**
   * 更新模式狀態
   *
   * @param patternId - 模式 ID
   * @param status - 新狀態
   * @returns 更新後的模式
   */
  async updatePatternStatus(patternId: string, status: PatternStatus) {
    const now = new Date();
    const updateData: Record<string, unknown> = { status };

    // 根據狀態設置相應的時間戳
    if (status === 'SUGGESTED') {
      updateData.suggestedAt = now;
    } else if (status === 'PROCESSED' || status === 'IGNORED') {
      updateData.processedAt = now;
    }

    return prisma.correctionPattern.update({
      where: { id: patternId },
      data: updateData,
    });
  }

  /**
   * 獲取特定模式的詳細資訊
   *
   * @param patternId - 模式 ID
   * @returns 模式詳細資訊
   */
  async getPatternDetail(patternId: string) {
    return prisma.correctionPattern.findUnique({
      where: { id: patternId },
      include: {
        forwarder: {
          select: {
            id: true,
            name: true,
            code: true,
            displayName: true,
          },
        },
        corrections: {
          select: {
            id: true,
            originalValue: true,
            correctedValue: true,
            createdAt: true,
            document: {
              select: {
                id: true,
                fileName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 模式分析服務單例
 */
export const patternAnalysisService = new PatternAnalysisService();
