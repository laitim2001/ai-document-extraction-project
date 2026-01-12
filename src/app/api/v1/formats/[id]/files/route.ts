/**
 * @fileoverview 格式關聯文件 API
 * @description
 *   獲取特定格式關聯的文件列表。
 *
 * @module src/app/api/v1/formats/[id]/files
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// ============================================================================
// Schema 驗證
// ============================================================================

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/v1/formats/[id]/files
 * 獲取格式關聯的文件列表
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數（包含 id）
 * @returns 文件列表（分頁）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formatId } = await params;
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    // 檢查格式是否存在
    const format = await prisma.documentFormat.findUnique({
      where: { id: formatId },
      select: { id: true },
    });

    if (!format) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'NOT_FOUND',
            title: 'Format not found',
            status: 404,
            detail: `Format with id ${formatId} not found`,
          },
        },
        { status: 404 }
      );
    }

    // 獲取關聯文件
    const [files, total] = await Promise.all([
      prisma.historicalFile.findMany({
        where: { documentFormatId: formatId },
        select: {
          id: true,
          originalName: true,
          status: true,
          formatConfidence: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.historicalFile.count({
        where: { documentFormatId: formatId },
      }),
    ]);

    const responseData = {
      files: files.map((f) => ({
        id: f.id,
        originalName: f.originalName,
        status: f.status,
        formatConfidence: f.formatConfidence,
        uploadedAt: f.createdAt.toISOString(),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[API] Error fetching format files:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch format files',
      },
      { status: 500 }
    );
  }
}
