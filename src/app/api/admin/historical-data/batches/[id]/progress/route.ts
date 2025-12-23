/**
 * @fileoverview 批量處理進度 SSE API
 * @description
 *   提供 Server-Sent Events (SSE) 即時進度更新：
 *   - 即時進度推送
 *   - 處理速率更新
 *   - 錯誤事件通知
 *
 * @module src/app/api/admin/historical-data/batches/[id]/progress
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - SSE 即時推送
 *   - 自動重連支援
 *   - 心跳保活
 *
 * @dependencies
 *   - batch-progress.service - 進度追蹤服務
 *
 * @related
 *   - src/hooks/use-batch-progress.ts - 前端進度訂閱 Hook
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { getBatchProgress } from '@/services/batch-progress.service'
import { HistoricalBatchStatus } from '@prisma/client'

// ============================================================
// Constants
// ============================================================

/** 進度更新間隔（毫秒） */
const PROGRESS_UPDATE_INTERVAL = 1000

/** 心跳間隔（毫秒） */
const HEARTBEAT_INTERVAL = 15000

/** 最大連線時間（毫秒） - 5 分鐘 */
const MAX_CONNECTION_TIME = 5 * 60 * 1000

// ============================================================
// Types
// ============================================================

interface RouteContext {
  params: Promise<{ id: string }>
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 編碼 SSE 消息
 */
function encodeSSEMessage(event: string, data: unknown): string {
  const jsonData = JSON.stringify(data)
  return `event: ${event}\ndata: ${jsonData}\n\n`
}

/**
 * 檢查批次是否已完成
 */
function isBatchCompleted(status: HistoricalBatchStatus): boolean {
  const completedStatuses: HistoricalBatchStatus[] = [
    HistoricalBatchStatus.COMPLETED,
    HistoricalBatchStatus.FAILED,
    HistoricalBatchStatus.CANCELLED,
  ]
  return completedStatuses.includes(status)
}

// ============================================================
// GET Handler - SSE Endpoint
// ============================================================

/**
 * SSE 進度訂閱端點
 *
 * @description
 *   客戶端透過 EventSource 連接此端點，
 *   接收即時進度更新。
 *
 * @example
 * ```javascript
 * const eventSource = new EventSource('/api/admin/historical-data/batches/123/progress');
 * eventSource.addEventListener('progress', (e) => {
 *   const progress = JSON.parse(e.data);
 *   console.log(progress);
 * });
 * ```
 *
 * @events
 *   - connected: 連線建立
 *   - progress: 進度更新
 *   - heartbeat: 心跳保活
 *   - completed: 處理完成
 *   - error: 錯誤事件
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // 驗證認證
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // 檢查權限
    const hasViewPerm = hasPermission(session.user, PERMISSIONS.ADMIN_VIEW)
    if (!hasViewPerm) {
      return new Response('Forbidden', { status: 403 })
    }

    // 獲取批次 ID
    const { id: batchId } = await context.params

    // 確認批次存在
    const initialProgress = await getBatchProgress(batchId)
    if (!initialProgress) {
      return new Response('Batch not found', { status: 404 })
    }

    // 創建 SSE 響應流
    const encoder = new TextEncoder()
    let isConnectionClosed = false
    let progressIntervalId: NodeJS.Timeout | null = null
    let heartbeatIntervalId: NodeJS.Timeout | null = null
    let connectionTimeoutId: NodeJS.Timeout | null = null

    const stream = new ReadableStream({
      async start(controller) {
        // 發送連線建立事件
        controller.enqueue(
          encoder.encode(
            encodeSSEMessage('connected', {
              batchId,
              timestamp: new Date().toISOString(),
            })
          )
        )

        // 發送初始進度
        controller.enqueue(
          encoder.encode(encodeSSEMessage('progress', initialProgress))
        )

        // 如果批次已完成，直接關閉連線
        if (isBatchCompleted(initialProgress.status)) {
          controller.enqueue(
            encoder.encode(
              encodeSSEMessage('completed', {
                status: initialProgress.status,
                timestamp: new Date().toISOString(),
              })
            )
          )
          controller.close()
          return
        }

        // 設置進度更新定時器
        progressIntervalId = setInterval(async () => {
          if (isConnectionClosed) {
            return
          }

          try {
            const progress = await getBatchProgress(batchId)
            if (!progress) {
              controller.enqueue(
                encoder.encode(
                  encodeSSEMessage('error', {
                    message: 'Batch not found',
                    timestamp: new Date().toISOString(),
                  })
                )
              )
              cleanup()
              controller.close()
              return
            }

            // 發送進度更新
            controller.enqueue(
              encoder.encode(encodeSSEMessage('progress', progress))
            )

            // 如果批次已完成，發送完成事件並關閉連線
            if (isBatchCompleted(progress.status)) {
              controller.enqueue(
                encoder.encode(
                  encodeSSEMessage('completed', {
                    status: progress.status,
                    timestamp: new Date().toISOString(),
                  })
                )
              )
              cleanup()
              controller.close()
            }
          } catch (error) {
            console.error('Error fetching batch progress:', error)
            controller.enqueue(
              encoder.encode(
                encodeSSEMessage('error', {
                  message: error instanceof Error ? error.message : 'Unknown error',
                  timestamp: new Date().toISOString(),
                })
              )
            )
          }
        }, PROGRESS_UPDATE_INTERVAL)

        // 設置心跳定時器
        heartbeatIntervalId = setInterval(() => {
          if (isConnectionClosed) {
            return
          }

          try {
            controller.enqueue(
              encoder.encode(
                encodeSSEMessage('heartbeat', {
                  timestamp: new Date().toISOString(),
                })
              )
            )
          } catch {
            // 連線可能已關閉
            cleanup()
          }
        }, HEARTBEAT_INTERVAL)

        // 設置最大連線時間
        connectionTimeoutId = setTimeout(() => {
          if (!isConnectionClosed) {
            controller.enqueue(
              encoder.encode(
                encodeSSEMessage('timeout', {
                  message: 'Connection timeout, please reconnect',
                  timestamp: new Date().toISOString(),
                })
              )
            )
            cleanup()
            controller.close()
          }
        }, MAX_CONNECTION_TIME)

        // 清理函數
        function cleanup() {
          isConnectionClosed = true
          if (progressIntervalId) {
            clearInterval(progressIntervalId)
            progressIntervalId = null
          }
          if (heartbeatIntervalId) {
            clearInterval(heartbeatIntervalId)
            heartbeatIntervalId = null
          }
          if (connectionTimeoutId) {
            clearTimeout(connectionTimeoutId)
            connectionTimeoutId = null
          }
        }
      },
      cancel() {
        isConnectionClosed = true
        if (progressIntervalId) {
          clearInterval(progressIntervalId)
        }
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId)
        }
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId)
        }
      },
    })

    // 返回 SSE 響應
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('Error in SSE endpoint:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
      { status: 500 }
    )
  }
}
