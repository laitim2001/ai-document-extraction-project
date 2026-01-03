/**
 * @fileoverview Prompt 解析 API 端點
 * @description
 *   提供 Prompt 配置解析的 REST API。
 *   根據 promptType、companyId、documentFormatId 解析並合併多層配置。
 *
 * @module src/app/api/prompts/resolve
 * @since Epic 14 - Story 14.3
 * @lastModified 2026-01-03
 *
 * @features
 *   - 三層配置解析（Format > Company > Global）
 *   - 變數替換（靜態/動態/上下文）
 *   - 快取機制支援
 *
 * @related
 *   - src/services/prompt-resolver.service.ts - 解析服務
 *   - src/types/prompt-resolution.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PromptType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPromptResolver } from '@/services/prompt-resolver.factory';
import type { PromptResolutionRequest } from '@/types/prompt-resolution';

/**
 * 解析請求驗證 Schema
 */
const PromptResolutionRequestSchema = z.object({
  promptType: z.nativeEnum(PromptType),
  companyId: z.string().cuid().nullable().optional(),
  documentFormatId: z.string().cuid().nullable().optional(),
  contextVariables: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/prompts/resolve
 * 解析 Prompt 配置
 *
 * @description
 *   根據輸入條件解析並合併多層 Prompt 配置：
 *   1. 查找 Global 層配置
 *   2. 查找 Company 層配置（如提供 companyId）
 *   3. 查找 Format 層配置（如提供 documentFormatId）
 *   4. 按合併策略組合
 *   5. 執行變數替換
 *
 * @requestBody {PromptResolutionRequest}
 * @returns {ResolvedPromptResult}
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析請求體
    const body = await request.json();

    // 2. 驗證請求
    const validationResult = PromptResolutionRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Request validation failed',
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const resolutionRequest: PromptResolutionRequest = validationResult.data;

    // 3. 取得解析服務並執行解析
    const resolver = getPromptResolver(prisma);
    const result = await resolver.resolve(resolutionRequest);

    // 4. 返回結果
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[PromptResolve] Error:', error);

    // 處理已知錯誤類型
    if (error instanceof Error) {
      if (error.name === 'NoGlobalPromptError') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'No Global Prompt',
            status: 404,
            detail: error.message,
          },
          { status: 404 }
        );
      }

      if (error.name === 'VariableResolutionError') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/variable-resolution',
            title: 'Variable Resolution Error',
            status: 422,
            detail: error.message,
          },
          { status: 422 }
        );
      }

      if (error.name === 'ConfigMergeError') {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/merge-error',
            title: 'Configuration Merge Error',
            status: 500,
            detail: error.message,
          },
          { status: 500 }
        );
      }
    }

    // 一般錯誤
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred during prompt resolution',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prompts/resolve
 * 取得支援的變數列表
 *
 * @returns {string[]} 支援的變數名稱列表
 */
export async function GET() {
  try {
    const resolver = getPromptResolver(prisma);
    const supportedVariables = resolver.getSupportedVariables();

    return NextResponse.json({
      success: true,
      data: {
        supportedVariables,
        description: 'List of variables that can be used in prompt templates',
      },
    });
  } catch (error) {
    console.error('[PromptResolve] GET Error:', error);

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to retrieve supported variables',
      },
      { status: 500 }
    );
  }
}
