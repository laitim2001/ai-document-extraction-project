/**
 * @fileoverview 路由服務
 * @description
 *   處理文件路由和處理隊列管理的核心服務：
 *   - 文件路由決策與更新
 *   - 處理隊列管理（創建、分配、完成）
 *   - 自動通過處理
 *   - 隊列統計查詢
 *
 *   ## 路由流程
 *
 *   ```
 *   routeDocument(documentId)
 *   ├─ 獲取文件與提取結果
 *   ├─ 計算信心度（如需）
 *   ├─ 決定處理路徑
 *   ├─ 計算優先級
 *   ├─ 更新文件狀態
 *   ├─ 創建/更新隊列項目
 *   └─ 記錄審計日誌
 *   ```
 *
 * @module src/services/routing
 * @since Epic 2 - Story 2.6 (Processing Path Auto Routing)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/routing - 路由邏輯模組
 *   - ./confidence.service - 信心度計算服務
 *
 * @related
 *   - src/lib/routing/router.ts - 路由決策邏輯
 *   - src/app/api/routing/ - API 端點
 *   - prisma/schema.prisma - ProcessingQueue model
 */

import { prisma } from '@/lib/prisma'
import { DocumentStatus, ProcessingPath, QueueStatus } from '@prisma/client'
import type { RoutingDecision, QueueStats, ProcessingQueueItem } from '@/types/routing'
import type { DocumentConfidenceResult } from '@/types/confidence'
import { determineProcessingPath, calculateQueuePriority } from '@/lib/routing'
import { calculateAndSaveConfidence, getDocumentConfidence } from './confidence.service'

// ============================================================
// Core Routing Functions
// ============================================================

/**
 * 路由文件到適當的處理路徑
 *
 * @description
 *   完整的路由流程：
 *   1. 獲取文件和提取結果
 *   2. 計算/獲取信心度
 *   3. 決定處理路徑
 *   4. 計算優先級
 *   5. 更新文件和隊列
 *   6. 記錄審計日誌
 *
 * @param documentId - 文件 ID
 * @returns 路由決策
 * @throws 文件不存在時拋出錯誤
 *
 * @example
 *   const decision = await routeDocument('doc-123')
 *   // { path: 'QUICK_REVIEW', reason: '...', confidence: 85.5, ... }
 */
export async function routeDocument(documentId: string): Promise<RoutingDecision> {
  // 1. 獲取文件
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      extractionResult: true,
    },
  })

  if (!document) {
    throw new Error(`Document not found: ${documentId}`)
  }

  // 2. 獲取或計算信心度
  let confidenceResult: DocumentConfidenceResult | null = null

  // 優先從提取結果獲取已計算的信心度
  if (document.extractionResult?.confidenceScores) {
    confidenceResult = document.extractionResult
      .confidenceScores as unknown as DocumentConfidenceResult
  }

  // 如果沒有信心度，嘗試計算
  if (!confidenceResult) {
    confidenceResult = await getDocumentConfidence(documentId)

    if (!confidenceResult && document.extractionResult) {
      // 有提取結果但沒有信心度，執行計算
      const result = await calculateAndSaveConfidence(document.extractionResult.id)
      confidenceResult = result.confidence
    }
  }

  // 如果仍然沒有信心度結果，無法路由
  if (!confidenceResult) {
    throw new Error(`Cannot route document without confidence scores: ${documentId}`)
  }

  // 3. 決定處理路徑
  const decision = determineProcessingPath(confidenceResult)

  // 4. 計算文件年齡和優先級
  const documentAge = (Date.now() - document.createdAt.getTime()) / (1000 * 60 * 60)
  const priority = calculateQueuePriority(decision, documentAge)

  // 5. 更新文件和創建隊列項目（事務）
  await prisma.$transaction(async (tx) => {
    // 更新文件狀態
    const newStatus =
      decision.path === 'AUTO_APPROVE'
        ? DocumentStatus.COMPLETED
        : DocumentStatus.PENDING_REVIEW

    await tx.document.update({
      where: { id: documentId },
      data: {
        processingPath: decision.path as ProcessingPath,
        routingDecision: JSON.parse(JSON.stringify(decision)),
        status: newStatus,
      },
    })

    // 如果是自動通過，更新提取結果狀態
    if (decision.path === 'AUTO_APPROVE' && document.extractionResult) {
      await tx.extractionResult.update({
        where: { id: document.extractionResult.id },
        data: { status: 'COMPLETED' },
      })
    } else {
      // 創建或更新隊列項目
      await tx.processingQueue.upsert({
        where: { documentId },
        create: {
          documentId,
          processingPath: decision.path as ProcessingPath,
          priority,
          routingReason: decision.reason,
          status: QueueStatus.PENDING,
        },
        update: {
          processingPath: decision.path as ProcessingPath,
          priority,
          routingReason: decision.reason,
          status: QueueStatus.PENDING,
        },
      })
    }

    // 記錄審計日誌
    await tx.auditLog.create({
      data: {
        entityType: 'Document',
        entityId: documentId,
        action: 'ROUTED',
        details: {
          path: decision.path,
          reason: decision.reason,
          confidence: decision.confidence,
          priority,
          lowConfidenceFields: decision.lowConfidenceFields,
          criticalFieldsAffected: decision.criticalFieldsAffected,
        },
      },
    })
  })

  return decision
}

/**
 * 處理自動通過的文件
 *
 * @description
 *   完成自動通過流程，更新文件和提取結果狀態。
 *
 * @param documentId - 文件 ID
 *
 * @example
 *   await handleAutoApprove('doc-123')
 */
export async function handleAutoApprove(documentId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 更新文件狀態
    await tx.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.COMPLETED },
    })

    // 更新提取結果狀態
    const extraction = await tx.extractionResult.findUnique({
      where: { documentId },
    })

    if (extraction) {
      await tx.extractionResult.update({
        where: { id: extraction.id },
        data: { status: 'COMPLETED' },
      })
    }

    // 記錄審計日誌
    await tx.auditLog.create({
      data: {
        entityType: 'Document',
        entityId: documentId,
        action: 'AUTO_APPROVED',
        details: {
          timestamp: new Date().toISOString(),
        },
      },
    })
  })
}

// ============================================================
// Queue Management Functions
// ============================================================

/**
 * 獲取處理隊列
 *
 * @description
 *   查詢處理隊列，支援按路徑和狀態過濾。
 *
 * @param path - 處理路徑過濾（可選）
 * @param status - 狀態過濾（預設 PENDING）
 * @param limit - 數量限制（預設 50）
 * @returns 隊列項目列表
 */
export async function getProcessingQueue(
  path?: ProcessingPath,
  status: QueueStatus = QueueStatus.PENDING,
  limit: number = 50
): Promise<ProcessingQueueItem[]> {
  const queues = await prisma.processingQueue.findMany({
    where: {
      ...(path && { processingPath: path }),
      status,
    },
    include: {
      document: {
        select: {
          id: true,
          fileName: true,
          status: true,
          createdAt: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { enteredAt: 'asc' }],
    take: limit,
  })

  return queues.map((q) => ({
    id: q.id,
    documentId: q.documentId,
    processingPath: q.processingPath as ProcessingQueueItem['processingPath'],
    priority: q.priority,
    routingReason: q.routingReason,
    status: q.status as ProcessingQueueItem['status'],
    assignedTo: q.assignedTo,
    assignedAt: q.assignedAt,
    enteredAt: q.enteredAt,
    startedAt: q.startedAt,
    completedAt: q.completedAt,
    document: {
      id: q.document.id,
      fileName: q.document.fileName,
      status: q.document.status,
      createdAt: q.document.createdAt,
    },
    assignee: q.assignee
      ? {
          id: q.assignee.id,
          name: q.assignee.name,
        }
      : null,
  }))
}

/**
 * 分配隊列項目給審核者
 *
 * @param queueId - 隊列項目 ID
 * @param reviewerId - 審核者 ID
 * @throws 隊列項目不存在或狀態不正確時拋出錯誤
 */
export async function assignToReviewer(
  queueId: string,
  reviewerId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const queue = await tx.processingQueue.findUnique({
      where: { id: queueId },
    })

    if (!queue) {
      throw new Error('Queue item not found')
    }

    if (queue.status !== QueueStatus.PENDING) {
      throw new Error('Queue item is not pending')
    }

    await tx.processingQueue.update({
      where: { id: queueId },
      data: {
        assignedTo: reviewerId,
        assignedAt: new Date(),
        status: QueueStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    })

    await tx.document.update({
      where: { id: queue.documentId },
      data: { status: DocumentStatus.IN_REVIEW },
    })

    await tx.auditLog.create({
      data: {
        userId: reviewerId,
        entityType: 'ProcessingQueue',
        entityId: queueId,
        action: 'ASSIGNED',
        details: {
          documentId: queue.documentId,
          assignedTo: reviewerId,
        },
      },
    })
  })
}

/**
 * 完成隊列項目審核
 *
 * @param queueId - 隊列項目 ID
 * @param reviewSummary - 審核摘要
 */
export async function completeReview(
  queueId: string,
  reviewSummary: {
    fieldsReviewed: number
    fieldsModified: number
    notes?: string
  }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const queue = await tx.processingQueue.findUnique({
      where: { id: queueId },
    })

    if (!queue) {
      throw new Error('Queue item not found')
    }

    await tx.processingQueue.update({
      where: { id: queueId },
      data: {
        status: QueueStatus.COMPLETED,
        completedAt: new Date(),
        fieldsReviewed: reviewSummary.fieldsReviewed,
        fieldsModified: reviewSummary.fieldsModified,
        reviewNotes: reviewSummary.notes,
      },
    })

    await tx.document.update({
      where: { id: queue.documentId },
      data: { status: DocumentStatus.COMPLETED },
    })

    // 更新提取結果狀態
    await tx.extractionResult.updateMany({
      where: { documentId: queue.documentId },
      data: { status: 'COMPLETED' },
    })

    await tx.auditLog.create({
      data: {
        userId: queue.assignedTo,
        entityType: 'ProcessingQueue',
        entityId: queueId,
        action: 'REVIEW_COMPLETED',
        details: {
          documentId: queue.documentId,
          ...reviewSummary,
        },
      },
    })
  })
}

/**
 * 取消隊列項目
 *
 * @param queueId - 隊列項目 ID
 * @param reason - 取消原因
 */
export async function cancelQueueItem(queueId: string, reason?: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const queue = await tx.processingQueue.findUnique({
      where: { id: queueId },
    })

    if (!queue) {
      throw new Error('Queue item not found')
    }

    await tx.processingQueue.update({
      where: { id: queueId },
      data: {
        status: QueueStatus.CANCELLED,
        reviewNotes: reason,
      },
    })

    await tx.auditLog.create({
      data: {
        entityType: 'ProcessingQueue',
        entityId: queueId,
        action: 'CANCELLED',
        details: {
          documentId: queue.documentId,
          reason,
        },
      },
    })
  })
}

// ============================================================
// Statistics Functions
// ============================================================

/**
 * 獲取隊列統計資訊
 *
 * @returns 隊列統計
 */
export async function getQueueStats(): Promise<QueueStats> {
  const queues = await prisma.processingQueue.groupBy({
    by: ['processingPath', 'status'],
    _count: true,
  })

  const byPath: Partial<Record<ProcessingPath, number>> = {}
  const byStatus: Partial<Record<QueueStatus, number>> = {}

  for (const item of queues) {
    const pathKey = item.processingPath as ProcessingPath
    const statusKey = item.status as QueueStatus
    byPath[pathKey] = (byPath[pathKey] || 0) + item._count
    byStatus[statusKey] = (byStatus[statusKey] || 0) + item._count
  }

  // 計算待處理項目的平均等待時間
  const pendingItems = await prisma.processingQueue.findMany({
    where: { status: QueueStatus.PENDING },
    select: { enteredAt: true },
  })

  const now = Date.now()
  const totalWaitTime = pendingItems.reduce((sum, item) => {
    return sum + (now - item.enteredAt.getTime())
  }, 0)

  const averageWaitTime =
    pendingItems.length > 0
      ? Math.round(totalWaitTime / pendingItems.length / (1000 * 60)) // 分鐘
      : 0

  return {
    byPath,
    byStatus,
    averageWaitTime,
  }
}

/**
 * 獲取指定用戶的待處理隊列數量
 *
 * @param userId - 用戶 ID
 * @returns 待處理數量
 */
export async function getUserPendingCount(userId: string): Promise<number> {
  return prisma.processingQueue.count({
    where: {
      assignedTo: userId,
      status: QueueStatus.IN_PROGRESS,
    },
  })
}

/**
 * 獲取下一個待處理項目
 *
 * @description
 *   按優先級和進入時間排序，獲取下一個應處理的項目。
 *
 * @param path - 處理路徑過濾（可選）
 * @returns 下一個隊列項目或 null
 */
export async function getNextQueueItem(
  path?: ProcessingPath
): Promise<ProcessingQueueItem | null> {
  const items = await getProcessingQueue(path, QueueStatus.PENDING, 1)
  return items[0] || null
}

/**
 * 批量路由多個文件
 *
 * @param documentIds - 文件 ID 列表
 * @returns 路由結果映射
 */
export async function batchRouteDocuments(
  documentIds: string[]
): Promise<Map<string, RoutingDecision | Error>> {
  const results = new Map<string, RoutingDecision | Error>()

  // 使用 Promise.allSettled 避免單個失敗影響其他
  const routingResults = await Promise.allSettled(
    documentIds.map(async (id) => {
      const decision = await routeDocument(id)
      return { id, decision }
    })
  )

  for (const result of routingResults) {
    if (result.status === 'fulfilled') {
      results.set(result.value.id, result.value.decision)
    } else {
      // 找到對應的 documentId
      const failedId = documentIds[routingResults.indexOf(result)]
      results.set(failedId, result.reason as Error)
    }
  }

  return results
}
