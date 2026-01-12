/**
 * @fileoverview 格式詳情 API
 * @description
 *   提供單一格式的詳情查詢和更新功能。
 *   - GET: 獲取格式詳情（含公司資訊和統計）
 *   - PATCH: 更新格式名稱、特徵和識別規則
 *
 * @module src/app/api/v1/formats/[id]
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - zod - 參數驗證
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateFormatSchema } from '@/validations/document-format';
import type {
  DocumentType,
  DocumentSubtype,
  DocumentFormatFeatures,
  IdentificationRules,
} from '@/types/document-format';

// ============================================================================
// API Handlers
// ============================================================================

/**
 * GET /api/v1/formats/[id]
 * 獲取格式詳情
 *
 * @description
 *   返回格式的完整資訊，包含公司資訊和文件數量統計。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數（包含 id）
 * @returns 格式詳情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const format = await prisma.documentFormat.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
    });

    if (!format) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'NOT_FOUND',
            title: 'Format not found',
            status: 404,
            detail: `Format with id ${id} not found`,
          },
        },
        { status: 404 }
      );
    }

    // 轉換為 API 響應格式
    const responseData = {
      id: format.id,
      companyId: format.companyId,
      company: format.company,
      documentType: format.documentType as DocumentType,
      documentSubtype: format.documentSubtype as DocumentSubtype,
      name: format.name,
      features: format.features as DocumentFormatFeatures | null,
      identificationRules: format.identificationRules as IdentificationRules | null,
      commonTerms: format.commonTerms,
      fileCount: format._count.files,
      createdAt: format.createdAt.toISOString(),
      updatedAt: format.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[API] Error fetching format detail:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch format detail',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/formats/[id]
 * 更新格式資訊
 *
 * @description
 *   更新格式的名稱或特徵。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數（包含 id）
 * @returns 更新後的格式資訊
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 驗證輸入
    const validationResult = updateFormatSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid request body',
            issues: validationResult.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const validated = validationResult.data;

    // 檢查格式是否存在
    const existingFormat = await prisma.documentFormat.findUnique({
      where: { id },
    });

    if (!existingFormat) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'NOT_FOUND',
            title: 'Format not found',
            status: 404,
            detail: `Format with id ${id} not found`,
          },
        },
        { status: 404 }
      );
    }

    // 準備更新數據
    const updateData: Record<string, unknown> = {};

    if (validated.name !== undefined) {
      updateData.name = validated.name;
    }

    if (validated.features !== undefined) {
      // 合併現有特徵和新特徵
      const existingFeatures = (existingFormat.features as unknown as DocumentFormatFeatures) || {};
      updateData.features = {
        ...existingFeatures,
        ...validated.features,
      };
    }

    if (validated.identificationRules !== undefined) {
      // 直接替換識別規則
      updateData.identificationRules = validated.identificationRules;
    }

    // 執行更新
    const updatedFormat = await prisma.documentFormat.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            files: true,
          },
        },
      },
    });

    const responseData = {
      id: updatedFormat.id,
      companyId: updatedFormat.companyId,
      company: updatedFormat.company,
      documentType: updatedFormat.documentType as DocumentType,
      documentSubtype: updatedFormat.documentSubtype as DocumentSubtype,
      name: updatedFormat.name,
      features: updatedFormat.features as DocumentFormatFeatures | null,
      identificationRules: updatedFormat.identificationRules as IdentificationRules | null,
      commonTerms: updatedFormat.commonTerms,
      fileCount: updatedFormat._count.files,
      createdAt: updatedFormat.createdAt.toISOString(),
      updatedAt: updatedFormat.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[API] Error updating format:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update format',
      },
      { status: 500 }
    );
  }
}
