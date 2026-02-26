/**
 * @fileoverview 格式詳情 API
 * @description
 *   提供單一格式的詳情查詢、更新和刪除功能。
 *   - GET: 獲取格式詳情（含公司資訊和統計）
 *   - PATCH: 更新格式名稱、特徵和識別規則
 *   - DELETE: 刪除格式（含級聯清理關聯資料）
 *
 * @module src/app/api/v1/formats/[id]
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-02-26
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

/**
 * DELETE /api/v1/formats/[id]
 * 刪除格式
 *
 * @description
 *   刪除格式及其關聯的 FORMAT 層級配置。
 *   - 解除關聯文件（設 documentFormatId 為 null）
 *   - 刪除 FORMAT 層級的 FieldMappingConfig（含級聯刪除規則）
 *   - 刪除 FORMAT 層級的 PromptConfig
 *   - 刪除 FORMAT 層級的 TemplateFieldMapping（含級聯刪除規則）
 *   - 刪除 FORMAT 層級的 FieldDefinitionSet（含級聯刪除 entries）
 *   - 最終刪除格式本身
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數（包含 id）
 * @returns 刪除結果
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 確認格式存在
    const existingFormat = await prisma.documentFormat.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            files: true,
            fieldMappingConfigs: true,
            promptConfigs: true,
            templateFieldMappings: true,
            fieldDefinitionSets: true,
          },
        },
      },
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

    // 使用事務處理級聯刪除
    await prisma.$transaction(async (tx) => {
      // 1. 解除文件關聯（設 documentFormatId 為 null）
      await tx.historicalFile.updateMany({
        where: { documentFormatId: id },
        data: { documentFormatId: null },
      });

      // 2. 刪除 FORMAT 層級的 FieldMappingConfig（級聯刪除規則）
      const mappingConfigs = await tx.fieldMappingConfig.findMany({
        where: { documentFormatId: id },
        select: { id: true },
      });
      if (mappingConfigs.length > 0) {
        const configIds = mappingConfigs.map((c) => c.id);
        await tx.fieldMappingRule.deleteMany({
          where: { configId: { in: configIds } },
        });
        await tx.fieldMappingConfig.deleteMany({
          where: { id: { in: configIds } },
        });
      }

      // 3. 刪除 FORMAT 層級的 PromptConfig
      await tx.promptConfig.deleteMany({
        where: { documentFormatId: id },
      });

      // 4. 刪除 FORMAT 層級的 TemplateFieldMapping（規則存在 JSON 欄位中）
      await tx.templateFieldMapping.deleteMany({
        where: { documentFormatId: id },
      });

      // 5. 刪除 FORMAT 層級的 FieldDefinitionSet（先刪除 feedbacks，再刪除 sets）
      const fieldDefSets = await tx.fieldDefinitionSet.findMany({
        where: { documentFormatId: id },
        select: { id: true },
      });
      if (fieldDefSets.length > 0) {
        const setIds = fieldDefSets.map((s) => s.id);
        await tx.fieldExtractionFeedback.deleteMany({
          where: { fieldDefinitionSetId: { in: setIds } },
        });
        await tx.fieldDefinitionSet.deleteMany({
          where: { id: { in: setIds } },
        });
      }

      // 6. 刪除格式本身
      await tx.documentFormat.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    console.error('[API] Error deleting format:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          title: 'Delete failed',
          status: 500,
          detail: 'Failed to delete format',
        },
      },
      { status: 500 }
    );
  }
}
