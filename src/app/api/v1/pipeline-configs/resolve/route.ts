/**
 * @fileoverview Pipeline Config Resolve API
 * @description
 *   解析有效的 Pipeline 配置（合併 GLOBAL/REGION/COMPANY 三層）。
 *
 * @module src/app/api/v1/pipeline-configs/resolve
 * @since CHANGE-032 - Pipeline Reference Number Matching & FX Conversion
 * @lastModified 2026-02-08
 *
 * @endpoints
 *   GET /api/v1/pipeline-configs/resolve?regionId=xxx&companyId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveEffectiveConfig } from '@/services/pipeline-config.service';
import { resolveConfigQuerySchema } from '@/lib/validations/pipeline-config.schema';

/**
 * GET /api/v1/pipeline-configs/resolve
 * 解析有效配置
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const parsed = resolveConfigQuerySchema.safeParse(queryParams);
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

    const config = await resolveEffectiveConfig(parsed.data);

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('[PipelineConfig:Resolve] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while resolving pipeline config',
      },
      { status: 500 }
    );
  }
}
