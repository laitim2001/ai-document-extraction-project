/**
 * @fileoverview 歷史數據文件列表 API
 * @description
 *   提供批次內文件的列表查詢：
 *   - GET: 列出指定批次內的所有文件（支援篩選和分頁）
 *
 * @module src/app/api/admin/historical-data/files
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthSession } from '@/lib/auth'
import { DetectedFileType, HistoricalFileStatus } from '@prisma/client'

// ============================================================
// Validation Schemas
// ============================================================

const ListFilesQuerySchema = z.object({
  batchId: z.string().min(1, '必須指定批次 ID'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.nativeEnum(HistoricalFileStatus).optional(),
  detectedType: z.nativeEnum(DetectedFileType).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'originalName', 'fileSize', 'status', 'detectedType']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// ============================================================
// GET /api/admin/historical-data/files
// ============================================================

/**
 * 列出批次內的文件
 *
 * @description
 *   必須提供 batchId 參數
 *   支援依狀態、類型篩選和搜尋
 */
export async function GET(request: NextRequest) {
  try {
    // 支援開發模式 X-Dev-Bypass-Auth header
    const session = await getAuthSession(request)
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

    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      batchId: searchParams.get('batchId') || '',
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      status: searchParams.get('status') || undefined,
      detectedType: searchParams.get('detectedType') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    }

    const validation = ListFilesQuerySchema.safeParse(queryParams)
    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '查詢參數驗證失敗',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { batchId, page, limit, status, detectedType, search, sortBy, sortOrder } = validation.data

    // 檢查批次是否存在
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    })

    if (!batch) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的批次',
        },
        { status: 404 }
      )
    }

    // 構建查詢條件
    const where: {
      batchId: string
      status?: HistoricalFileStatus
      detectedType?: DetectedFileType
      originalName?: { contains: string; mode: 'insensitive' }
    } = {
      batchId,
    }

    if (status) {
      where.status = status
    }

    if (detectedType) {
      where.detectedType = detectedType
    }

    if (search) {
      where.originalName = { contains: search, mode: 'insensitive' }
    }

    // 執行查詢
    const [files, total] = await Promise.all([
      prisma.historicalFile.findMany({
        where,
        select: {
          id: true,
          fileName: true,
          originalName: true,
          fileSize: true,
          mimeType: true,
          detectedType: true,
          status: true,
          metadata: true,
          errorMessage: true,
          createdAt: true,
          detectedAt: true,
          processedAt: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.historicalFile.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    // 計算統計資訊
    const stats = await prisma.historicalFile.groupBy({
      by: ['status'],
      where: { batchId },
      _count: true,
    })

    const typeStats = await prisma.historicalFile.groupBy({
      by: ['detectedType'],
      where: { batchId },
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        batch,
        files: files.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          originalName: file.originalName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          detectedType: file.detectedType,
          status: file.status,
          metadata: file.metadata,
          errorMessage: file.errorMessage,
          createdAt: file.createdAt.toISOString(),
          detectedAt: file.detectedAt?.toISOString() || null,
          processedAt: file.processedAt?.toISOString() || null,
        })),
        statistics: {
          byStatus: stats.reduce(
            (acc, s) => {
              acc[s.status] = s._count
              return acc
            },
            {} as Record<string, number>
          ),
          byType: typeStats.reduce(
            (acc, t) => {
              const type = t.detectedType || 'UNKNOWN'
              acc[type] = t._count
              return acc
            },
            {} as Record<string, number>
          ),
        },
      },
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/historical-data/files] Error:', error)
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
