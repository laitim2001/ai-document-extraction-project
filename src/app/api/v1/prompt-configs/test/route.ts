/**
 * @fileoverview Prompt 配置測試 API
 * @description
 *   提供 Prompt 配置的測試功能。
 *   接收文件和配置 ID，使用配置處理文件並返回結果。
 *
 * @module src/app/api/v1/prompt-configs/test
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-07
 *
 * @features
 *   - POST: 測試 Prompt 配置效果
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - gpt-vision.service - GPT Vision 服務（模擬）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================================================
// POST /api/v1/prompt-configs/test - 測試配置
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 解析 FormData
    const formData = await request.formData();
    const configId = formData.get('configId') as string;
    const file = formData.get('file') as File | null;

    if (!configId) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '缺少 configId 參數',
          instance: '/api/v1/prompt-configs/test',
        },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '缺少測試文件',
          instance: '/api/v1/prompt-configs/test',
        },
        { status: 400 }
      );
    }

    // 2. 獲取配置
    const config = await prisma.promptConfig.findUnique({
      where: { id: configId },
      include: {
        company: { select: { id: true, name: true } },
        documentFormat: { select: { id: true, name: true } },
      },
    });

    if (!config) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `找不到配置 ID: ${configId}`,
          instance: '/api/v1/prompt-configs/test',
        },
        { status: 404 }
      );
    }

    // 3. 準備變數替換
    const variables: Record<string, string> = {
      companyName: config.company?.name ?? 'Unknown Company',
      documentFormatName: config.documentFormat?.name ?? 'Unknown Format',
      knownTerms: '[]', // 模擬空的已知術語
    };

    // 4. 替換 Prompt 中的變數
    let resolvedSystemPrompt = config.systemPrompt;
    let resolvedUserPrompt = config.userPromptTemplate;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      resolvedSystemPrompt = resolvedSystemPrompt.replace(new RegExp(placeholder, 'g'), value);
      resolvedUserPrompt = resolvedUserPrompt.replace(new RegExp(placeholder, 'g'), value);
    }

    // 5. 模擬測試結果
    // TODO: 實際整合 GPT Vision 服務進行測試
    const executionTimeMs = Date.now() - startTime;

    const testResult = {
      success: true,
      extractedData: {
        _testMode: true,
        _message: '這是模擬的測試結果。實際整合需要連接 GPT Vision 服務。',
        resolvedSystemPrompt: resolvedSystemPrompt.substring(0, 200) + '...',
        resolvedUserPrompt: resolvedUserPrompt.substring(0, 200) + '...',
        variables,
        configInfo: {
          id: config.id,
          name: config.name,
          promptType: config.promptType,
          scope: config.scope,
        },
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      },
      rawResponse: JSON.stringify({
        message: '測試模式 - 未實際調用 AI 服務',
        timestamp: new Date().toISOString(),
      }),
      executionTimeMs,
      tokensUsed: {
        prompt: 0,
        completion: 0,
      },
    };

    return NextResponse.json(testResult);
  } catch (error) {
    console.error('[API] POST /api/v1/prompt-configs/test error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '測試執行失敗',
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
