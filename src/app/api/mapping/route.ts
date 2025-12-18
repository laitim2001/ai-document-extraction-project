/**
 * @fileoverview 欄位映射 API 端點
 * @description
 *   提供欄位映射相關 API：
 *   - POST /api/mapping - 執行文件欄位映射
 *   - GET /api/mapping - 取得映射規則列表
 *
 * @module src/app/api/mapping/route
 * @since Epic 2 - Story 2.4 (Field Mapping & Extraction)
 * @lastModified 2025-12-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  mapDocumentFields,
  getMappingRules,
  getApplicableRules,
} from '@/services/mapping.service';

// ============================================================
// Validation Schemas
// ============================================================

const mapFieldsSchema = z.object({
  documentId: z.string().uuid(),
  forwarderId: z.string().uuid().optional(),
  force: z.boolean().optional().default(false),
});

const getMappingRulesSchema = z.object({
  forwarderId: z.string().uuid().optional().nullable(),
  category: z.string().optional(),
  fieldName: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

// ============================================================
// POST /api/mapping - 執行文件欄位映射
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = mapFieldsSchema.parse(body);

    const result = await mapDocumentFields(validatedData.documentId, {
      forwarderId: validatedData.forwarderId,
      force: validatedData.force,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'One or more fields failed validation',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // 特定錯誤處理
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: error.message,
          },
          { status: 404 }
        );
      }
    }

    console.error('Field mapping error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Failed to map fields',
      },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /api/mapping - 取得映射規則列表
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = getMappingRulesSchema.parse({
      forwarderId: searchParams.get('forwarderId'),
      category: searchParams.get('category'),
      fieldName: searchParams.get('fieldName'),
      isActive: searchParams.get('isActive'),
    });

    // 如果指定了 forwarderId，取得該 Forwarder 的適用規則（含通用規則）
    // 否則取得所有規則
    let rules;
    if (params.forwarderId) {
      rules = await getApplicableRules(params.forwarderId);
    } else {
      rules = await getMappingRules({
        forwarderId: params.forwarderId,
        category: params.category,
        fieldName: params.fieldName,
        isActive: params.isActive,
      });
    }

    // 計算統計
    const universalCount = rules.filter((r) => r.forwarderId === null).length;
    const forwarderSpecificCount = rules.filter((r) => r.forwarderId !== null).length;

    return NextResponse.json({
      success: true,
      data: rules,
      meta: {
        total: rules.length,
        universalCount,
        forwarderSpecificCount,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    console.error('Get mapping rules error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Failed to get mapping rules',
      },
      { status: 500 }
    );
  }
}
