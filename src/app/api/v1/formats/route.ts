/**
 * @fileoverview 文件格式 API 端點
 * @description
 *   提供文件格式的列表查詢和手動建立功能。
 *   支援按公司、類型、子類型進行過濾。
 *
 * @module src/app/api/v1/formats
 * @since Epic 0 - Story 0.9
 * @lastModified 2026-01-14
 *
 * @features
 *   - 格式列表查詢（分頁）
 *   - 按公司/類型/子類型過濾
 *   - 手動建立格式（Story 16-8）
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - zod - 參數驗證
 *   - document-format.service - 格式服務
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createDocumentFormatSchema } from '@/validations/document-format';
import { createDocumentFormatManually } from '@/services/document-format.service';

// ============================================================================
// Schema 驗證
// ============================================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  companyId: z.string().optional(),
  documentType: z.string().optional(),
  documentSubtype: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/v1/formats
 * 獲取文件格式列表
 *
 * @description
 *   返回分頁的文件格式列表，包含公司資訊和統計數據。
 *   支援按公司 ID、文件類型、文件子類型過濾。
 *
 * @param request - Next.js 請求物件
 * @returns 分頁格式列表
 *
 * @example
 * ```
 * GET /api/v1/formats?page=1&limit=20
 * GET /api/v1/formats?companyId=xxx&documentType=INVOICE
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    const where: Record<string, unknown> = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.documentType) where.documentType = query.documentType;
    if (query.documentSubtype) where.documentSubtype = query.documentSubtype;

    const [formats, total] = await Promise.all([
      prisma.documentFormat.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true },
          },
        },
        orderBy: { fileCount: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.documentFormat.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        formats: formats.map((f) => ({
          id: f.id,
          companyId: f.companyId,
          companyName: f.company.name,
          documentType: f.documentType,
          documentSubtype: f.documentSubtype,
          name: f.name,
          fileCount: f.fileCount,
          commonTerms: f.commonTerms,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  } catch (error) {
    console.error('[API] Error fetching formats:', error);

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
      { success: false, error: 'Failed to fetch formats' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - 手動建立格式 (Story 16-8)
// ============================================================================

/**
 * POST /api/v1/formats
 * 手動建立文件格式
 *
 * @description
 *   允許用戶在公司詳情頁面主動建立文件格式。
 *   可選擇是否自動建立關聯的 FieldMappingConfig 和 PromptConfig。
 *
 * @param request - Next.js 請求物件
 * @returns 新建立的格式及相關配置
 *
 * @since Story 16-8
 *
 * @example
 * ```
 * POST /api/v1/formats
 * {
 *   "companyId": "company-id",
 *   "documentType": "INVOICE",
 *   "documentSubtype": "OCEAN_FREIGHT",
 *   "name": "自定義名稱",
 *   "autoCreateConfigs": { "fieldMapping": true }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createDocumentFormatSchema.parse(body);

    const result = await createDocumentFormatManually({
      companyId: input.companyId,
      documentType: input.documentType,
      documentSubtype: input.documentSubtype,
      name: input.name,
      autoCreateConfigs: input.autoCreateConfigs,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating format:', error);

    // 業務邏輯錯誤
    if (error instanceof Error) {
      if (error.message === 'COMPANY_NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/not-found',
              title: 'Company Not Found',
              status: 404,
              detail: '指定的公司不存在',
            },
          },
          { status: 404 }
        );
      }

      if (error.message === 'FORMAT_ALREADY_EXISTS') {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/conflict',
              title: 'Format Already Exists',
              status: 409,
              detail: '此公司已存在相同類型的格式',
            },
          },
          { status: 409 }
        );
      }
    }

    // Zod 驗證錯誤
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: '請求資料驗證失敗',
            issues: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: '建立格式時發生錯誤',
        },
      },
      { status: 500 }
    );
  }
}
