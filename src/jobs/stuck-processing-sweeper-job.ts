/**
 * @fileoverview 殭屍處理回收定時任務（FIX-094）
 * @description
 *   掃描卡在 OCR_PROCESSING / MAPPING_PROCESSING 且超過時間閾值的文件，
 *   自動標記為 OCR_FAILED，使其回到既有的「失敗 → 重試」路徑。
 *   解決處理程序被硬中斷（程序回收 / 逾時 / 容器重啟）後文件永久卡死、無法自救的問題。
 *
 * @module src/jobs/stuck-processing-sweeper-job
 * @since FIX-094
 *
 * @features
 *   - 手動 / 排程觸發掃描（標記逾時殭屍處理為 OCR_FAILED）
 *   - 狀態查詢（唯讀）
 *   - 閾值可透過環境變數 STUCK_PROCESSING_THRESHOLD_MINUTES 調整（預設 10 分鐘）
 *
 * @dependencies
 *   - @/services/document.service - 文件服務層
 *
 * @note
 *   此任務可透過以下方式觸發：
 *   1. n8n / Vercel Cron: HTTP 調用 API
 *   2. 手動: POST /api/jobs/stuck-processing-sweeper
 */

import {
  sweepStuckProcessingDocuments,
  getStuckProcessingDocuments,
} from '@/services/document.service';

// ============================================================
// Types
// ============================================================

/** 任務執行結果 */
export interface StuckProcessingSweepResult {
  success: boolean;
  sweptCount: number;
  documentIds?: string[];
  thresholdMinutes?: number;
  error?: string;
  timestamp: string;
  executionTimeMs: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * 解析環境變數中的閾值（分鐘）
 *
 * @returns 有效的正數閾值，否則 undefined（交由 service 使用預設值）
 */
function resolveThresholdMinutes(): number | undefined {
  const raw = process.env.STUCK_PROCESSING_THRESHOLD_MINUTES;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// ============================================================
// Job Functions
// ============================================================

/**
 * 觸發殭屍處理回收
 *
 * @description
 *   掃描並將逾時卡住的處理中文件標記為 OCR_FAILED。
 *   可由 API 路由或外部排程器調用。
 *
 * @returns 執行結果
 */
export async function triggerStuckProcessingSweep(): Promise<StuckProcessingSweepResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const threshold = resolveThresholdMinutes();

  console.log('[StuckProcessingSweeper] Starting sweep...', { timestamp, threshold });

  try {
    const result =
      threshold !== undefined
        ? await sweepStuckProcessingDocuments(threshold)
        : await sweepStuckProcessingDocuments();

    const executionTimeMs = Date.now() - startTime;

    console.log('[StuckProcessingSweeper] Job completed successfully', {
      sweptCount: result.sweptCount,
      thresholdMinutes: result.thresholdMinutes,
      executionTimeMs,
      timestamp,
    });

    return {
      success: true,
      sweptCount: result.sweptCount,
      documentIds: result.documentIds,
      thresholdMinutes: result.thresholdMinutes,
      timestamp,
      executionTimeMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const executionTimeMs = Date.now() - startTime;

    console.error('[StuckProcessingSweeper] Job failed', {
      error: errorMessage,
      executionTimeMs,
      timestamp,
    });

    return {
      success: false,
      sweptCount: 0,
      error: errorMessage,
      timestamp,
      executionTimeMs,
    };
  }
}

/**
 * 獲取殭屍處理狀態（唯讀）
 *
 * @returns 目前卡住的文件統計與清單
 */
export async function getStuckProcessingStatus() {
  const threshold = resolveThresholdMinutes();
  return threshold !== undefined
    ? getStuckProcessingDocuments(threshold)
    : getStuckProcessingDocuments();
}

// ============================================================
// Cron Configuration (for reference)
// ============================================================

/**
 * Cron 配置
 *
 * n8n / Vercel Cron 範例：
 * - URL: https://your-domain.com/api/jobs/stuck-processing-sweeper
 * - Method: POST
 * - Headers: { "x-cron-secret": "<CRON_SECRET>" }
 * - Schedule: 每 5 分鐘執行（閾值預設 10 分鐘）
 */
export const STUCK_PROCESSING_SWEEPER_CRON_CONFIG = {
  schedule: '*/5 * * * *',
  timezone: 'Asia/Taipei',
  description: 'Sweep stuck (zombie) processing documents and mark them OCR_FAILED',
};
