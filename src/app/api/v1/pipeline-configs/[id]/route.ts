/**
 * @fileoverview Pipeline Config API - 單筆操作
 * @description
 *   提供 Pipeline Config 的讀取、更新、刪除功能。
 *
 * @module src/app/api/v1/pipeline-configs/[id]
 * @since CHANGE-032 - Pipeline Reference Number Matching & FX Conversion
 * @lastModified 2026-02-08
 *
 * @endpoints
 *   GET    /api/v1/pipeline-configs/:id - 讀取單筆
 *   PATCH  /api/v1/pipeline-configs/:id - 更新
 *   DELETE /api/v1/pipeline-configs/:id - 刪除
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPipelineConfigById,
  updatePipelineConfig,
  deletePipelineConfig,
} from '@/services/pipeline-config.service';
import { updatePipelineConfigSchema } from '@/lib/validations/pipeline-config.schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/pipeline-configs/:id
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await getPipelineConfigById(id);

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Pipeline config not found') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Pipeline config not found',
        },
        { status: 404 }
      );
    }

    console.error('[PipelineConfig:GET:id] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/pipeline-configs/:id
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = updatePipelineConfigSchema.safeParse(body);
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

    const item = await updatePipelineConfig(id, parsed.data);

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Pipeline config not found') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Pipeline config not found',
        },
        { status: 404 }
      );
    }

    console.error('[PipelineConfig:PATCH] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while updating pipeline config',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/pipeline-configs/:id
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deletePipelineConfig(id);

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Pipeline config not found') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Pipeline config not found',
        },
        { status: 404 }
      );
    }

    console.error('[PipelineConfig:DELETE] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while deleting pipeline config',
      },
      { status: 500 }
    );
  }
}
