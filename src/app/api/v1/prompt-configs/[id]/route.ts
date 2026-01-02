/**
 * @fileoverview Prompt Config API - 單一配置操作
 * @description
 *   提供單一 Prompt 配置的讀取、更新、刪除功能。
 *   支援樂觀鎖（Optimistic Locking）機制防止並發衝突。
 *
 * @module src/app/api/v1/prompt-configs/[id]
 * @since Epic 14 - Story 14.1
 * @lastModified 2026-01-02
 *
 * @endpoints
 *   GET    /api/v1/prompt-configs/:id - 取得單一配置詳情
 *   PATCH  /api/v1/prompt-configs/:id - 更新配置（需要 version 樂觀鎖）
 *   DELETE /api/v1/prompt-configs/:id - 刪除配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  promptConfigIdParamSchema,
  updatePromptConfigSchema,
} from '@/lib/validations/prompt-config.schema';

// =====================
// Types
// =====================

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/prompt-configs/:id
 * 取得單一 Prompt 配置詳情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 驗證 ID 參數
    const parsed = promptConfigIdParamSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid prompt config ID',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 查詢配置
    const config = await prisma.promptConfig.findUnique({
      where: { id },
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

    if (!config) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Prompt config with id '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        promptType: config.promptType,
        scope: config.scope,
        name: config.name,
        description: config.description,
        companyId: config.companyId,
        companyName: config.company?.name ?? null,
        companyCode: config.company?.code ?? null,
        documentFormatId: config.documentFormatId,
        documentFormatName: config.documentFormat?.name ?? null,
        documentType: config.documentFormat?.documentType ?? null,
        systemPrompt: config.systemPrompt,
        userPromptTemplate: config.userPromptTemplate,
        mergeStrategy: config.mergeStrategy,
        variables: config.variables,
        isActive: config.isActive,
        version: config.version,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[PromptConfig:GET:id] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching prompt config',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/prompt-configs/:id
 * 更新 Prompt 配置
 * 使用樂觀鎖（Optimistic Locking）防止並發衝突
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 驗證 ID 參數
    const idParsed = promptConfigIdParamSchema.safeParse({ id });
    if (!idParsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid prompt config ID',
          errors: idParsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // 驗證請求體
    const parsed = updatePromptConfigSchema.safeParse(body);
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

    const { version, ...updateData } = parsed.data;

    // 檢查配置是否存在
    const existingConfig = await prisma.promptConfig.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Prompt config with id '${id}' not found`,
        },
        { status: 404 }
      );
    }

    // 樂觀鎖檢查
    if (existingConfig.version !== version) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `Version conflict: expected version ${version}, but current version is ${existingConfig.version}. The record may have been modified by another user.`,
          currentVersion: existingConfig.version,
        },
        { status: 409 }
      );
    }

    // 準備更新資料
    const dataToUpdate: Prisma.PromptConfigUpdateInput = {
      version: { increment: 1 },
    };

    if (updateData.name !== undefined) {
      dataToUpdate.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      dataToUpdate.description = updateData.description;
    }
    if (updateData.systemPrompt !== undefined) {
      dataToUpdate.systemPrompt = updateData.systemPrompt;
    }
    if (updateData.userPromptTemplate !== undefined) {
      dataToUpdate.userPromptTemplate = updateData.userPromptTemplate;
    }
    if (updateData.mergeStrategy !== undefined) {
      dataToUpdate.mergeStrategy = updateData.mergeStrategy as Prisma.EnumMergeStrategyFieldUpdateOperationsInput['set'];
    }
    if (updateData.variables !== undefined) {
      dataToUpdate.variables = updateData.variables;
    }
    if (updateData.isActive !== undefined) {
      dataToUpdate.isActive = updateData.isActive;
    }

    // 執行更新
    const updatedConfig = await prisma.promptConfig.update({
      where: { id },
      data: dataToUpdate,
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

    return NextResponse.json({
      success: true,
      data: {
        id: updatedConfig.id,
        promptType: updatedConfig.promptType,
        scope: updatedConfig.scope,
        name: updatedConfig.name,
        description: updatedConfig.description,
        companyId: updatedConfig.companyId,
        companyName: updatedConfig.company?.name ?? null,
        documentFormatId: updatedConfig.documentFormatId,
        documentFormatName: updatedConfig.documentFormat?.name ?? null,
        systemPrompt: updatedConfig.systemPrompt,
        userPromptTemplate: updatedConfig.userPromptTemplate,
        mergeStrategy: updatedConfig.mergeStrategy,
        variables: updatedConfig.variables,
        isActive: updatedConfig.isActive,
        version: updatedConfig.version,
        createdAt: updatedConfig.createdAt.toISOString(),
        updatedAt: updatedConfig.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[PromptConfig:PATCH] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while updating prompt config',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/prompt-configs/:id
 * 刪除 Prompt 配置
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 驗證 ID 參數
    const parsed = promptConfigIdParamSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid prompt config ID',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 檢查配置是否存在
    const existingConfig = await prisma.promptConfig.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Prompt config with id '${id}' not found`,
        },
        { status: 404 }
      );
    }

    // 刪除配置
    await prisma.promptConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Prompt config '${existingConfig.name}' has been deleted successfully`,
    });
  } catch (error) {
    console.error('[PromptConfig:DELETE] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while deleting prompt config',
      },
      { status: 500 }
    );
  }
}
