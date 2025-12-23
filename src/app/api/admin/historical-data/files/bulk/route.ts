/**
 * @fileoverview 歷史數據文件批量操作 API
 * @description
 *   提供文件的批量操作：
 *   - POST: 批量刪除或批量更新類型
 *
 * @module src/app/api/admin/historical-data/files/bulk
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { DetectedFileType, HistoricalBatchStatus, HistoricalFileStatus } from '@prisma/client'
import fs from 'fs/promises'

// ============================================================
// Validation Schemas
// ============================================================

const BulkDeleteSchema = z.object({
  action: z.literal('delete'),
  fileIds: z.array(z.string()).min(1, '至少需要選擇一個文件'),
})

const BulkUpdateTypeSchema = z.object({
  action: z.literal('updateType'),
  fileIds: z.array(z.string()).min(1, '至少需要選擇一個文件'),
  detectedType: z.nativeEnum(DetectedFileType),
})

const BulkOperationSchema = z.discriminatedUnion('action', [
  BulkDeleteSchema,
  BulkUpdateTypeSchema,
])

// ============================================================
// POST /api/admin/historical-data/files/bulk
// ============================================================

/**
 * 批量操作文件
 *
 * @description
 *   支援的操作：
 *   - delete: 批量刪除文件
 *   - updateType: 批量更新文件類型（手動修正）
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入',
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = BulkOperationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '輸入驗證失敗',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // 取得所有文件並驗證
    const files = await prisma.historicalFile.findMany({
      where: {
        id: { in: data.fileIds },
      },
      include: {
        batch: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (files.length === 0) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的文件',
        },
        { status: 404 }
      )
    }

    // 檢查是否有處理中的批次
    const processingFiles = files.filter(
      (f) => f.batch.status === HistoricalBatchStatus.PROCESSING
    )
    if (processingFiles.length > 0) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: '部分文件的批次正在處理中，無法操作',
        },
        { status: 409 }
      )
    }

    // 執行批量操作
    if (data.action === 'delete') {
      // 批量刪除
      const results = {
        deleted: 0,
        failed: 0,
        errors: [] as { fileId: string; error: string }[],
      }

      // 按批次分組以更新統計
      const batchGroups = files.reduce(
        (acc, file) => {
          if (!acc[file.batch.id]) {
            acc[file.batch.id] = {
              files: [],
              failedCount: 0,
            }
          }
          acc[file.batch.id].files.push(file)
          if (file.status === HistoricalFileStatus.FAILED) {
            acc[file.batch.id].failedCount++
          }
          return acc
        },
        {} as Record<string, { files: typeof files; failedCount: number }>
      )

      // 刪除實體文件
      for (const file of files) {
        try {
          await fs.unlink(file.storagePath)
          results.deleted++
        } catch (fsError) {
          // 文件可能已經不存在，記錄但不中斷
          console.warn(`[BULK DELETE] Failed to delete physical file: ${file.storagePath}`, fsError)
          results.deleted++ // 仍然計入已刪除（資料庫記錄會被刪除）
        }
      }

      // 批量刪除資料庫記錄並更新批次統計
      await prisma.$transaction([
        prisma.historicalFile.deleteMany({
          where: { id: { in: data.fileIds } },
        }),
        ...Object.entries(batchGroups).map(([batchId, group]) =>
          prisma.historicalBatch.update({
            where: { id: batchId },
            data: {
              totalFiles: { decrement: group.files.length },
              failedFiles: { decrement: group.failedCount },
            },
          })
        ),
      ])

      return NextResponse.json({
        success: true,
        data: {
          action: 'delete',
          deleted: results.deleted,
          failed: results.failed,
          errors: results.errors,
        },
      })
    } else if (data.action === 'updateType') {
      // 批量更新類型
      const now = new Date()

      // 更新文件並記錄手動修正
      await prisma.$transaction(
        files.map((file) =>
          prisma.historicalFile.update({
            where: { id: file.id },
            data: {
              detectedType: data.detectedType,
              metadata: {
                ...(file.metadata as Record<string, unknown> || {}),
                manualCorrection: {
                  previousType: file.detectedType,
                  correctedType: data.detectedType,
                  correctedBy: session.user.id,
                  correctedAt: now.toISOString(),
                  bulkOperation: true,
                },
              },
            },
          })
        )
      )

      return NextResponse.json({
        success: true,
        data: {
          action: 'updateType',
          updated: files.length,
          detectedType: data.detectedType,
        },
      })
    }

    // 不應該到達這裡
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: '不支援的操作',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[POST /api/admin/historical-data/files/bulk] Error:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : '伺服器錯誤',
      },
      { status: 500 }
    )
  }
}
