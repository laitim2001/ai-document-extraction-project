/**
 * @fileoverview Prompt Config API - 列表與建立
 * @description
 *   提供 Prompt 配置的列表查詢和建立功能。
 *   支援三層範圍繼承：GLOBAL → COMPANY → FORMAT
 *
 * @module src/app/api/v1/prompt-configs
 * @since Epic 14 - Story 14.1
 * @lastModified 2026-01-02
 *
 * @endpoints
 *   GET  /api/v1/prompt-configs - 列表查詢（支援篩選和分頁）
 *   POST /api/v1/prompt-configs - 建立新配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PromptType, PromptScope, MergeStrategy, Prisma } from '@prisma/client';
import {
  createPromptConfigSchema,
  getPromptConfigsQuerySchema,
} from '@/lib/validations/prompt-config.schema';

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/prompt-configs
 * 查詢 Prompt 配置列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // 驗證查詢參數
    const parsed = getPromptConfigsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      promptType,
      scope,
      companyId,
      documentFormatId,
      isActive,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = parsed.data;

    // 建立查詢條件
    const where: Prisma.PromptConfigWhereInput = {};

    if (promptType) {
      where.promptType = promptType as PromptType;
    }

    if (scope) {
      where.scope = scope as PromptScope;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (documentFormatId) {
      where.documentFormatId = documentFormatId;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 計算總數
    const total = await prisma.promptConfig.count({ where });

    // 查詢資料
    const configs = await prisma.promptConfig.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        documentFormat: {
          select: {
            id: true,
            name: true,
            documentType: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 格式化響應
    const data = configs.map((config) => ({
      id: config.id,
      promptType: config.promptType,
      scope: config.scope,
      name: config.name,
      description: config.description,
      companyId: config.companyId,
      companyName: config.company?.name ?? null,
      documentFormatId: config.documentFormatId,
      documentFormatName: config.documentFormat?.name ?? null,
      mergeStrategy: config.mergeStrategy,
      isActive: config.isActive,
      version: config.version,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[PromptConfig:GET] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching prompt configs',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/prompt-configs
 * 建立新的 Prompt 配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 驗證請求體
    const parsed = createPromptConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      promptType,
      scope,
      name,
      description,
      companyId,
      documentFormatId,
      systemPrompt,
      userPromptTemplate,
      mergeStrategy,
      variables,
      isActive,
    } = parsed.data;

    // 檢查唯一約束：相同 promptType + scope + companyId + documentFormatId 組合不可重複
    const existing = await prisma.promptConfig.findFirst({
      where: {
        promptType: promptType as PromptType,
        scope: scope as PromptScope,
        companyId: companyId ?? null,
        documentFormatId: documentFormatId ?? null,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `A prompt configuration already exists for this combination (promptType=${promptType}, scope=${scope}, companyId=${companyId || 'null'}, documentFormatId=${documentFormatId || 'null'})`,
        },
        { status: 409 }
      );
    }

    // 驗證關聯實體存在
    if (companyId) {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Company with id '${companyId}' not found`,
          },
          { status: 404 }
        );
      }
    }

    if (documentFormatId) {
      const format = await prisma.documentFormat.findUnique({ where: { id: documentFormatId } });
      if (!format) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Document format with id '${documentFormatId}' not found`,
          },
          { status: 404 }
        );
      }
    }

    // 建立配置
    const config = await prisma.promptConfig.create({
      data: {
        promptType: promptType as PromptType,
        scope: scope as PromptScope,
        name,
        description: description ?? null,
        companyId: companyId ?? null,
        documentFormatId: documentFormatId ?? null,
        systemPrompt,
        userPromptTemplate,
        mergeStrategy: mergeStrategy as MergeStrategy,
        variables: variables ?? [],
        isActive,
        version: 1,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        documentFormat: {
          select: {
            id: true,
            name: true,
            documentType: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: config.id,
          promptType: config.promptType,
          scope: config.scope,
          name: config.name,
          description: config.description,
          companyId: config.companyId,
          companyName: config.company?.name ?? null,
          documentFormatId: config.documentFormatId,
          documentFormatName: config.documentFormat?.name ?? null,
          systemPrompt: config.systemPrompt,
          userPromptTemplate: config.userPromptTemplate,
          mergeStrategy: config.mergeStrategy,
          variables: config.variables,
          isActive: config.isActive,
          version: config.version,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[PromptConfig:POST] Error:', error);

    // 處理唯一約束違反
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'A prompt configuration with this combination already exists',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while creating prompt config',
      },
      { status: 500 }
    );
  }
}
