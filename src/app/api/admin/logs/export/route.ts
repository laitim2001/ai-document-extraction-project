/**
 * @fileoverview 系統日誌匯出 API
 * @description
 *   提供日誌匯出功能。
 *   支援 CSV、JSON、TXT 格式。
 *   僅限管理員存取。
 *
 * @module src/app/api/admin/logs/export/route
 * @author Development Team
 * @since Epic 12 - Story 12-7 (System Log Query)
 * @lastModified 2025-12-21
 *
 * @endpoints
 *   - POST /api/admin/logs/export - 建立匯出任務
 *   - GET /api/admin/logs/export/:id - 獲取匯出狀態
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { logQueryService } from '@/services/logging';
import { LogLevel, LogSource, LogExportFormat } from '@prisma/client';

// ============================================================
// Validation Schemas
// ============================================================

const createExportSchema = z.object({
  format: z.enum(['CSV', 'JSON', 'TXT']),
  filters: z.object({
    timeRange: z.object({
      start: z.string().transform((v) => new Date(v)),
      end: z.string().transform((v) => new Date(v)),
    }).optional(),
    levels: z.array(z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'])).optional(),
    sources: z.array(z.enum(['WEB', 'API', 'AI', 'DATABASE', 'N8N', 'SCHEDULER', 'BACKGROUND', 'SYSTEM'])).optional(),
    keyword: z.string().optional(),
    correlationId: z.string().optional(),
    userId: z.string().optional(),
    errorCode: z.string().optional(),
  }).optional(),
});

// ============================================================
// Handlers
// ============================================================

/**
 * POST /api/admin/logs/export
 * 建立匯出任務
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證權限
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '需要登入',
        },
        { status: 401 }
      );
    }

    // 檢查管理員權限
    const isAdmin =
      session.user.isGlobalAdmin || session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
    if (!isAdmin) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '需要管理員權限',
        },
        { status: 403 }
      );
    }

    // 解析請求內容
    const body = await request.json();
    const parseResult = createExportSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '請求內容驗證失敗',
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 建立匯出任務
    const exportId = await logQueryService.createExport(
      {
        format: parseResult.data.format as LogExportFormat,
        filters: parseResult.data.filters
          ? {
              startTime: parseResult.data.filters.timeRange?.start,
              endTime: parseResult.data.filters.timeRange?.end,
              levels: parseResult.data.filters.levels as LogLevel[] | undefined,
              sources: parseResult.data.filters.sources as LogSource[] | undefined,
              keyword: parseResult.data.filters.keyword,
              correlationId: parseResult.data.filters.correlationId,
              userId: parseResult.data.filters.userId,
              errorCode: parseResult.data.filters.errorCode,
            }
          : {},
      },
      session.user.id
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          exportId,
          status: 'PENDING',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating log export:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : '伺服器內部錯誤',
      },
      { status: 500 }
    );
  }
}
