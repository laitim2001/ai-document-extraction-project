/**
 * @fileoverview 格式關聯配置 API
 * @description
 *   返回格式關聯的 PromptConfig 和 FieldMappingConfig（scope=FORMAT），
 *   以及配置繼承關係資訊。
 *
 * @module src/app/api/v1/formats/[id]/configs
 * @since Epic 16 - Story 16.4
 * @lastModified 2026-01-12
 *
 * @dependencies
 *   - prisma - 資料庫操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================================================
// Types
// ============================================================================

interface ConfigInheritance {
  hasFormatPrompt: boolean;
  hasCompanyPrompt: boolean;
  hasGlobalPrompt: boolean;
  hasFormatMapping: boolean;
  hasCompanyMapping: boolean;
  hasGlobalMapping: boolean;
  effectivePromptLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
  effectiveMappingLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * GET /api/v1/formats/[id]/configs
 * 獲取格式關聯的配置
 *
 * @description
 *   返回格式關聯的 Prompt 配置和映射配置，以及繼承關係資訊。
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數（包含 id）
 * @returns 關聯配置列表和繼承資訊
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formatId } = await params;

    // 檢查格式是否存在
    const format = await prisma.documentFormat.findUnique({
      where: { id: formatId },
      select: {
        id: true,
        companyId: true,
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
            detail: `Format with id ${formatId} not found`,
          },
        },
        { status: 404 }
      );
    }

    // 並行查詢所有配置
    const [
      formatPromptConfigs,
      formatMappingConfigs,
      companyPromptConfigs,
      companyMappingConfigs,
      globalPromptConfigs,
      globalMappingConfigs,
    ] = await Promise.all([
      // FORMAT 級別的 Prompt 配置
      prisma.promptConfig.findMany({
        where: {
          documentFormatId: formatId,
          scope: 'FORMAT',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          promptType: true,
          scope: true,
          isActive: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // FORMAT 級別的 FieldMapping 配置
      prisma.fieldMappingConfig.findMany({
        where: {
          documentFormatId: formatId,
          scope: 'FORMAT',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          scope: true,
          isActive: true,
          updatedAt: true,
          _count: {
            select: { rules: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // COMPANY 級別的 Prompt 配置
      prisma.promptConfig.findMany({
        where: {
          companyId: format.companyId,
          documentFormatId: null,
          scope: 'COMPANY',
          isActive: true,
        },
        select: { id: true, promptType: true },
      }),

      // COMPANY 級別的 FieldMapping 配置
      prisma.fieldMappingConfig.findMany({
        where: {
          companyId: format.companyId,
          documentFormatId: null,
          scope: 'COMPANY',
          isActive: true,
        },
        select: { id: true },
      }),

      // GLOBAL 級別的 Prompt 配置
      prisma.promptConfig.findMany({
        where: {
          scope: 'GLOBAL',
          companyId: null,
          documentFormatId: null,
          isActive: true,
        },
        select: { id: true, promptType: true },
      }),

      // GLOBAL 級別的 FieldMapping 配置
      prisma.fieldMappingConfig.findMany({
        where: {
          scope: 'GLOBAL',
          companyId: null,
          documentFormatId: null,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);

    // 計算有效層級
    const effectivePromptLevel = formatPromptConfigs.length > 0
      ? 'FORMAT'
      : companyPromptConfigs.length > 0
      ? 'COMPANY'
      : globalPromptConfigs.length > 0
      ? 'GLOBAL'
      : 'NONE';

    const effectiveMappingLevel = formatMappingConfigs.length > 0
      ? 'FORMAT'
      : companyMappingConfigs.length > 0
      ? 'COMPANY'
      : globalMappingConfigs.length > 0
      ? 'GLOBAL'
      : 'NONE';

    const inheritance: ConfigInheritance = {
      hasFormatPrompt: formatPromptConfigs.length > 0,
      hasCompanyPrompt: companyPromptConfigs.length > 0,
      hasGlobalPrompt: globalPromptConfigs.length > 0,
      hasFormatMapping: formatMappingConfigs.length > 0,
      hasCompanyMapping: companyMappingConfigs.length > 0,
      hasGlobalMapping: globalMappingConfigs.length > 0,
      effectivePromptLevel,
      effectiveMappingLevel,
    };

    // 轉換響應格式
    const promptConfigs = formatPromptConfigs.map((c) => ({
      id: c.id,
      name: c.name,
      promptType: c.promptType,
      scope: c.scope,
      isActive: c.isActive,
      updatedAt: c.updatedAt.toISOString(),
    }));

    const fieldMappingConfigs = formatMappingConfigs.map((c) => ({
      id: c.id,
      name: c.name,
      scope: c.scope,
      rulesCount: c._count.rules,
      isActive: c.isActive,
      updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        promptConfigs,
        fieldMappingConfigs,
        inheritance,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching format configs:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch format configs',
        },
      },
      { status: 500 }
    );
  }
}
