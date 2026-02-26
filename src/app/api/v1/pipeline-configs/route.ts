/**
 * @fileoverview Pipeline Config API - 列表與建立
 * @description
 *   提供 Pipeline Config 的列表查詢和建立功能。
 *   支援分頁、篩選、排序等功能。
 *
 * @module src/app/api/v1/pipeline-configs
 * @since CHANGE-032 - Pipeline Reference Number Matching & FX Conversion
 * @lastModified 2026-02-08
 *
 * @endpoints
 *   GET  /api/v1/pipeline-configs - 列表查詢
 *   POST /api/v1/pipeline-configs - 建立新配置
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPipelineConfigs,
  createPipelineConfig,
} from '@/services/pipeline-config.service';
import {
  createPipelineConfigSchema,
  getPipelineConfigsQuerySchema,
} from '@/lib/validations/pipeline-config.schema';
import { Prisma } from '@prisma/client';

/**
 * GET /api/v1/pipeline-configs
 * 查詢 Pipeline Config 列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const parsed = getPipelineConfigsQuerySchema.safeParse(queryParams);
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

    const result = await getPipelineConfigs(parsed.data);

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: {
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error('[PipelineConfig:GET] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while fetching pipeline configs',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/pipeline-configs
 * 建立新的 Pipeline Config
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = createPipelineConfigSchema.safeParse(body);
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

    const item = await createPipelineConfig(parsed.data);

    return NextResponse.json(
      {
        success: true,
        data: item,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[PipelineConfig:POST] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('已存在')) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: error.message,
          },
          { status: 409 }
        );
      }

      if (error.message.includes('requires')) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: error.message,
          },
          { status: 400 }
        );
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'A pipeline config with this scope combination already exists',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while creating pipeline config',
      },
      { status: 500 }
    );
  }
}
