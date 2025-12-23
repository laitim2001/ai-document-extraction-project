/**
 * @fileoverview 批量處理進度訂閱 Hook
 * @description
 *   提供 SSE 即時進度訂閱功能：
 *   - 自動連線和重連
 *   - 進度狀態管理
 *   - 錯誤處理
 *
 * @module src/hooks/use-batch-progress
 * @since Epic 0 - Story 0.4
 * @lastModified 2025-12-23
 *
 * @features
 *   - SSE 即時訂閱
 *   - 自動重連機制
 *   - 連線狀態追蹤
 *   - 錯誤回調
 *
 * @dependencies
 *   - React - 狀態管理
 *
 * @related
 *   - src/app/api/admin/historical-data/batches/[id]/progress/route.ts - SSE API
 *   - src/components/features/historical-data/BatchProgressPanel.tsx - 進度面板
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { HistoricalBatchStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 各狀態文件數統計
 */
export interface FileStatusCounts {
  pending: number
  detecting: number
  detected: number
  processing: number
  completed: number
  failed: number
  skipped: number
}

/**
 * 批量進度資訊
 */
export interface BatchProgress {
  batchId: string
  batchName: string
  status: HistoricalBatchStatus
  totalFiles: number
  processedFiles: number
  failedFiles: number
  skippedFiles: number
  currentFileId: string | null
  currentFileName: string | null
  percentage: number
  processingRate: number
  estimatedRemainingTime: number | null
  startedAt: string | null
  pausedAt: string | null
  completedAt: string | null
  totalCost: number
  newCompaniesCount: number
  extractedTermsCount: number
  filesByStatus: FileStatusCounts
}

/**
 * 連線狀態
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Hook 選項
 */
export interface UseBatchProgressOptions {
  /** 是否啟用訂閱 */
  enabled?: boolean
  /** 最大重連次數 */
  maxRetries?: number
  /** 重連延遲（毫秒） */
  retryDelay?: number
  /** 進度更新回調 */
  onProgress?: (progress: BatchProgress) => void
  /** 完成回調 */
  onComplete?: (status: HistoricalBatchStatus) => void
  /** 錯誤回調 */
  onError?: (error: Error) => void
}

/**
 * Hook 返回值
 */
export interface UseBatchProgressReturn {
  /** 進度資訊 */
  progress: BatchProgress | null
  /** 連線狀態 */
  connectionStatus: ConnectionStatus
  /** 是否正在載入 */
  isLoading: boolean
  /** 錯誤資訊 */
  error: Error | null
  /** 手動重連 */
  reconnect: () => void
  /** 斷開連線 */
  disconnect: () => void
}

// ============================================================
// Constants
// ============================================================

/** 預設最大重連次數 */
const DEFAULT_MAX_RETRIES = 3

/** 預設重連延遲（毫秒） */
const DEFAULT_RETRY_DELAY = 2000

// ============================================================
// Hook
// ============================================================

/**
 * 批量處理進度訂閱 Hook
 *
 * @description
 *   透過 SSE 訂閱批量處理進度，自動處理連線和重連。
 *
 * @param batchId - 批次 ID
 * @param options - 選項
 * @returns 進度資訊和連線狀態
 *
 * @example
 * ```tsx
 * const { progress, connectionStatus, isLoading } = useBatchProgress(batchId, {
 *   onComplete: (status) => {
 *     toast.success(`處理完成: ${status}`);
 *   },
 * });
 * ```
 */
export function useBatchProgress(
  batchId: string | null,
  options: UseBatchProgressOptions = {}
): UseBatchProgressReturn {
  const {
    enabled = true,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    onProgress,
    onComplete,
    onError,
  } = options

  // State
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<Error | null>(null)

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Callbacks refs for stable references
  const onProgressRef = useRef(onProgress)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onProgressRef.current = onProgress
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onProgress, onComplete, onError])

  // Disconnect function
  const disconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setConnectionStatus('disconnected')
  }, [])

  // Connect function
  const connect = useCallback(() => {
    if (!batchId || !enabled) {
      return
    }

    // 清理現有連線
    disconnect()

    setConnectionStatus('connecting')
    setError(null)

    const url = `/api/admin/historical-data/batches/${batchId}/progress`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    // 連線建立
    eventSource.addEventListener('connected', () => {
      setConnectionStatus('connected')
      retryCountRef.current = 0
    })

    // 進度更新
    eventSource.addEventListener('progress', (event) => {
      try {
        const progressData = JSON.parse(event.data) as BatchProgress
        setProgress(progressData)
        onProgressRef.current?.(progressData)
      } catch (e) {
        console.error('Failed to parse progress data:', e)
      }
    })

    // 心跳
    eventSource.addEventListener('heartbeat', () => {
      // 保持連線活躍
    })

    // 處理完成
    eventSource.addEventListener('completed', (event) => {
      try {
        const { status } = JSON.parse(event.data)
        onCompleteRef.current?.(status)
        disconnect()
      } catch (e) {
        console.error('Failed to parse completed data:', e)
      }
    })

    // 超時
    eventSource.addEventListener('timeout', () => {
      // 連線超時，嘗試重連
      scheduleReconnect()
    })

    // 錯誤
    eventSource.addEventListener('error', (event) => {
      const errorMessage = (event as MessageEvent)?.data
        ? JSON.parse((event as MessageEvent).data).message
        : 'Connection error'

      const err = new Error(errorMessage)
      setError(err)
      onErrorRef.current?.(err)
    })

    // EventSource 原生錯誤處理
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setConnectionStatus('error')
        scheduleReconnect()
      }
    }
  }, [batchId, enabled, disconnect])

  // Schedule reconnect
  const scheduleReconnect = useCallback(() => {
    if (retryCountRef.current >= maxRetries) {
      setConnectionStatus('error')
      setError(new Error('Max retries exceeded'))
      return
    }

    retryCountRef.current++
    const delay = retryDelay * retryCountRef.current

    retryTimeoutRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect, maxRetries, retryDelay])

  // Manual reconnect
  const reconnect = useCallback(() => {
    retryCountRef.current = 0
    connect()
  }, [connect])

  // Effect to manage connection
  useEffect(() => {
    if (enabled && batchId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [batchId, enabled, connect, disconnect])

  return {
    progress,
    connectionStatus,
    isLoading: connectionStatus === 'connecting',
    error,
    reconnect,
    disconnect,
  }
}

/**
 * 格式化剩餘時間
 *
 * @param seconds - 剩餘秒數
 * @returns 格式化的時間字串
 */
export function formatRemainingTime(seconds: number | null): string {
  if (seconds === null || seconds <= 0) {
    return '--'
  }

  if (seconds < 60) {
    return `${seconds} 秒`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes} 分 ${remainingSeconds} 秒`
      : `${minutes} 分`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0
    ? `${hours} 小時 ${remainingMinutes} 分`
    : `${hours} 小時`
}

/**
 * 格式化處理速率
 *
 * @param rate - 處理速率（files/minute）
 * @returns 格式化的速率字串
 */
export function formatProcessingRate(rate: number): string {
  if (rate <= 0) {
    return '-- files/min'
  }

  return `${rate.toFixed(1)} files/min`
}
