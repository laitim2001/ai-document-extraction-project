/**
 * @fileoverview 模式分析定時任務
 * @description
 *   定義模式分析的定時任務配置：
 *   - 提供手動觸發函數供 API 調用
 *   - 記錄執行日誌
 *   - 可整合 Vercel Cron 或 n8n 外部排程
 *
 * @module src/jobs/pattern-analysis-job
 * @since Epic 4 - Story 4.3
 * @lastModified 2025-12-19
 *
 * @features
 *   - 每日凌晨 2 點執行模式分析
 *   - 手動觸發 API
 *   - 執行結果通知
 *
 * @dependencies
 *   - @/services/pattern-analysis - 模式分析服務
 *
 * @note
 *   此任務可透過以下方式觸發：
 *   1. Vercel Cron: 在 vercel.json 配置
 *   2. n8n: 設定 HTTP webhook 調用 API
 *   3. 手動: POST /api/jobs/pattern-analysis
 */

import { patternAnalysisService } from '@/services/pattern-analysis';
import type { AnalysisResult } from '@/types/pattern';

// ============================================================
// Types
// ============================================================

/**
 * 任務執行結果
 */
export interface JobExecutionResult {
  success: boolean;
  result?: AnalysisResult;
  error?: string;
  timestamp: string;
}

// ============================================================
// Job Functions
// ============================================================

/**
 * 觸發模式分析
 *
 * @description
 *   手動觸發模式分析任務
 *   可由 API 路由或外部排程器調用
 *
 * @returns 執行結果
 *
 * @example
 * ```typescript
 * const result = await triggerPatternAnalysis();
 * if (result.success) {
 *   console.log('Analysis completed:', result.result);
 * }
 * ```
 */
export async function triggerPatternAnalysis(): Promise<JobExecutionResult> {
  const timestamp = new Date().toISOString();

  console.log('[PatternAnalysis] Starting pattern analysis job...', { timestamp });

  try {
    const result = await patternAnalysisService.analyzeCorrections();

    console.log('[PatternAnalysis] Job completed successfully', {
      totalAnalyzed: result.totalAnalyzed,
      patternsDetected: result.patternsDetected,
      patternsUpdated: result.patternsUpdated,
      candidatesCreated: result.candidatesCreated,
      executionTime: `${result.executionTime}ms`,
      timestamp,
    });

    return {
      success: true,
      result,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[PatternAnalysis] Job failed', {
      error: errorMessage,
      timestamp,
    });

    return {
      success: false,
      error: errorMessage,
      timestamp,
    };
  }
}

/**
 * 獲取分析任務狀態
 *
 * @returns 分析狀態資訊
 */
export async function getPatternAnalysisStatus() {
  return patternAnalysisService.getAnalysisStatus();
}

// ============================================================
// Cron Configuration (for reference)
// ============================================================

/**
 * Vercel Cron 配置範例
 *
 * 在 vercel.json 中添加：
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/jobs/pattern-analysis",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 * ```
 *
 * n8n Webhook 配置：
 * - URL: https://your-domain.com/api/jobs/pattern-analysis
 * - Method: POST
 * - Headers: { "x-cron-secret": "your-secret" }
 * - Schedule: 0 2 * * * (每天凌晨 2 點，台北時間)
 */
export const CRON_CONFIG = {
  schedule: '0 2 * * *', // 每天凌晨 2 點
  timezone: 'Asia/Taipei',
  description: 'Daily pattern analysis job',
};
