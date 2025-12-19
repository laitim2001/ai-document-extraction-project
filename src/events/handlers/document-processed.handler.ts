/**
 * @fileoverview 文件處理完成事件處理器
 * @description
 *   處理文件處理完成事件：
 *   - 記錄處理結果統計
 *   - 更新城市統計數據
 *   - 非阻塞式處理（不影響主流程）
 *
 * @module src/events/handlers/document-processed.handler
 * @since Epic 7 - Story 7.7 (城市處理數量追蹤)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 處理結果記錄
 *   - 非阻塞式錯誤處理
 *   - 狀態映射
 *
 * @dependencies
 *   - @/services/processing-stats.service - 處理統計服務
 *   - @/types/processing-statistics - 類型定義
 *
 * @related
 *   - src/services/processing-stats.service.ts - 統計服務
 */

import { processingStatsService } from '@/services/processing-stats.service'
import type {
  ProcessingResultType,
  ProcessingResultEvent,
} from '@/types/processing-statistics'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 將文件狀態映射到處理結果類型
 *
 * @param status - 文件狀態
 * @param autoApproved - 是否自動通過
 * @returns 處理結果類型
 */
function mapStatusToResultType(
  status: string,
  autoApproved: boolean
): ProcessingResultType {
  switch (status) {
    case 'FAILED':
    case 'ERROR':
      return 'FAILED'
    case 'ESCALATED':
      return 'ESCALATED'
    default:
      return autoApproved ? 'AUTO_APPROVED' : 'MANUAL_REVIEWED'
  }
}

// ============================================================
// Event Handler
// ============================================================

/**
 * 文件處理完成事件處理器
 *
 * @description
 *   在文件處理完成時調用，記錄處理結果到統計系統。
 *   此處理器設計為非阻塞式，錯誤不會影響主流程。
 *
 * @param event - 處理結果事件
 *
 * @example
 *   await handleDocumentProcessed({
 *     documentId: 'doc-123',
 *     cityCode: 'HKG',
 *     forwarderCode: 'FWD-001',
 *     status: 'APPROVED',
 *     autoApproved: true,
 *     processingDurationSeconds: 30,
 *     processedAt: new Date()
 *   })
 */
export async function handleDocumentProcessed(
  event: ProcessingResultEvent
): Promise<void> {
  try {
    // 確定處理結果類型
    const resultType = mapStatusToResultType(event.status, event.autoApproved)

    // 記錄處理結果
    await processingStatsService.recordProcessingResult(
      event.cityCode,
      resultType,
      event.processingDurationSeconds
    )

    console.log('[Document Processed Handler] Stats recorded', {
      documentId: event.documentId,
      cityCode: event.cityCode,
      resultType,
      processingTime: event.processingDurationSeconds,
    })
  } catch (error) {
    // 不要重新拋出錯誤，避免影響主流程
    // 統計記錄失敗不應阻塞文件處理流程
    console.error('[Document Processed Handler] Failed to record stats', {
      documentId: event.documentId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * 批量處理文件處理完成事件
 *
 * @description
 *   批量處理多個文件的處理結果，
 *   適用於批量導入或重新處理場景。
 *
 * @param events - 處理結果事件陣列
 *
 * @example
 *   await handleDocumentProcessedBatch([event1, event2, event3])
 */
export async function handleDocumentProcessedBatch(
  events: ProcessingResultEvent[]
): Promise<void> {
  const results = await Promise.allSettled(
    events.map((event) => handleDocumentProcessed(event))
  )

  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    console.warn('[Document Processed Handler] Batch processing completed with errors', {
      total: events.length,
      failed: failures.length,
    })
  }
}

// ============================================================
// Event Registration (Optional)
// ============================================================

/**
 * 註冊事件處理器
 *
 * @description
 *   可選的事件註冊函數，用於事件總線整合。
 *   根據項目的事件系統實現來調用此函數。
 *
 * @example
 *   // 使用 EventEmitter
 *   import { eventBus } from '@/lib/event-bus'
 *   registerDocumentProcessedHandler()
 *
 *   // 在其他地方觸發事件
 *   eventBus.emit('document:processed', event)
 */
export function registerDocumentProcessedHandler(): void {
  // 根據事件系統實現來註冊處理器
  // 例如使用 EventEmitter:
  // eventBus.on('document:processed', handleDocumentProcessed)

  console.log('[Document Processed Handler] Handler registered')
}
