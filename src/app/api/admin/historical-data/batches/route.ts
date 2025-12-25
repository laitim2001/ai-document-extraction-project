/**
 * @fileoverview 歷史數據批次管理 API
 * @description
 *   提供歷史數據批次的 CRUD 操作：
 *   - POST: 建立新批次
 *   - GET: 列出所有批次（支援分頁和篩選）
 *
 * @module src/app/api/admin/historical-data/batches
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-25
 *
 * @features
 *   - Story 0.1: 批次建立和列表
 *   - Story 0.6: 公司識別配置
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { HistoricalBatchStatus } from '@prisma/client'

// ============================================================
// Validation Schemas
// ============================================================

const CreateBatchSchema = z.object({
  name: z.string().min(1, '批次名稱不得為空').max(100, '批次名稱不得超過 100 字元'),
  description: z.string().max(500, '描述不得超過 500 字元').optional(),
  // Story 0.6: 公司識別配置
  enableCompanyIdentification: z.boolean().default(true),
  fuzzyMatchThreshold: z.number().min(0.5).max(1).default(0.9),
  autoMergeSimilar: z.boolean().default(false),
})

const ListBatchQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(HistoricalBatchStatus).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'name', 'totalFiles', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// ============================================================
// POST /api/admin/historical-data/batches
// ============================================================

/**
 * 建立新的歷史數據批次
 *
 * @description
 *   建立一個空的批次容器，之後再透過 upload API 上傳文件到此批次
 *
 * @returns 新建立的批次資料
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證用戶身份
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

    // 解析並驗證請求體
    const body = await request.json()
    const validation = CreateBatchSchema.safeParse(body)

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

    const {
      name,
      description,
      enableCompanyIdentification,
      fuzzyMatchThreshold,
      autoMergeSimilar,
    } = validation.data

    // 建立批次
    const batch = await prisma.historicalBatch.create({
      data: {
        name,
        description,
        createdBy: session.user.id,
        status: HistoricalBatchStatus.PENDING,
        // Story 0.6: 公司識別配置
        enableCompanyIdentification,
        fuzzyMatchThreshold,
        autoMergeSimilar,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: batch.id,
          name: batch.name,
          description: batch.description,
          status: batch.status,
          totalFiles: batch.totalFiles,
          processedFiles: batch.processedFiles,
          failedFiles: batch.failedFiles,
          createdAt: batch.createdAt.toISOString(),
          creator: batch.creator,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/admin/historical-data/batches] Error:', error)
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

// ============================================================
// GET /api/admin/historical-data/batches
// ============================================================

/**
 * 列出所有歷史數據批次
 *
 * @description
 *   支援分頁、篩選和排序
 *
 * @returns 批次列表和分頁資訊
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證用戶身份
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

    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    }

    const validation = ListBatchQuerySchema.safeParse(queryParams)
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

    const { page, limit, status, search, sortBy, sortOrder } = validation.data

    // 構建查詢條件
    const where: {
      status?: HistoricalBatchStatus
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>
    } = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // 執行查詢
    const [batches, total] = await Promise.all([
      prisma.historicalBatch.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              files: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.historicalBatch.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: batches.map((batch) => ({
        id: batch.id,
        name: batch.name,
        description: batch.description,
        status: batch.status,
        totalFiles: batch.totalFiles,
        processedFiles: batch.processedFiles,
        failedFiles: batch.failedFiles,
        fileCount: batch._count.files,
        errorMessage: batch.errorMessage,
        createdAt: batch.createdAt.toISOString(),
        startedAt: batch.startedAt?.toISOString() || null,
        completedAt: batch.completedAt?.toISOString() || null,
        creator: batch.creator,
      })),
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
    console.error('[GET /api/admin/historical-data/batches] Error:', error)
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
