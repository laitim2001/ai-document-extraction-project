/**
 * @fileoverview Field Mapping Rules API - 建立規則
 * @description
 *   提供在指定配置下建立新映射規則的功能。
 *   規則定義了來源欄位如何映射到目標欄位。
 *
 * @module src/app/api/v1/field-mapping-configs/[id]/rules
 * @since Epic 13 - Story 13.4
 * @lastModified 2026-01-02
 *
 * @endpoints
 *   POST /api/v1/field-mapping-configs/:id/rules - 建立新規則
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { FieldTransformType, Prisma } from '@prisma/client';

// =====================
// Validation Schemas
// =====================

/**
 * Transform 參數 Schema（根據 transformType 動態驗證）
 */
const transformParamsSchema = z.union([
  // DIRECT: 無需參數
  z.object({}).optional(),
  // CONCAT: 分隔符
  z.object({
    separator: z.string().max(10).default(''),
  }),
  // SPLIT: 分隔符和索引
  z.object({
    separator: z.string().min(1),
    index: z.number().int().min(0),
  }),
  // LOOKUP: 查表映射
  z.object({
    mapping: z.record(z.string(), z.string()),
    defaultValue: z.string().optional(),
  }),
  // CUSTOM: JavaScript 表達式
  z.object({
    expression: z.string().min(1).max(1000),
  }),
]);

/**
 * 建立規則 Schema
 */
const createRuleSchema = z.object({
  sourceFields: z.array(z.string().min(1).max(100)).min(1).max(10),
  targetField: z.string().min(1).max(100),
  transformType: z.nativeEnum(FieldTransformType).default(FieldTransformType.DIRECT),
  transformParams: transformParamsSchema.optional().nullable(),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
  description: z.string().max(500).optional(),
});

// =====================
// Route Context Type
// =====================

interface RouteContext {
  params: Promise<{ id: string }>;
}

// =====================
// API Handlers
// =====================

/**
 * POST /api/v1/field-mapping-configs/:id/rules
 * 建立新的映射規則
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id: configId } = params;
    const body = await request.json();

    // 驗證 configId 格式
    if (!configId || typeof configId !== 'string') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid config ID',
        },
        { status: 400 }
      );
    }

    // 驗證請求體
    const parsed = createRuleSchema.safeParse(body);
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

    const { sourceFields, targetField, transformType, transformParams, priority, isActive, description } = parsed.data;

    // 檢查配置是否存在
    const config = await prisma.fieldMappingConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Field mapping config with id '${configId}' not found`,
        },
        { status: 404 }
      );
    }

    // 驗證 transformParams 與 transformType 的一致性
    if (transformType === FieldTransformType.CONCAT && transformParams) {
      // CONCAT 需要 separator（可選）
    } else if (transformType === FieldTransformType.SPLIT && transformParams) {
      const splitParams = transformParams as { separator?: string; index?: number };
      if (!splitParams.separator || splitParams.index === undefined) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'SPLIT transform requires separator and index in transformParams',
          },
          { status: 400 }
        );
      }
    } else if (transformType === FieldTransformType.LOOKUP && transformParams) {
      const lookupParams = transformParams as { mapping?: Record<string, string> };
      if (!lookupParams.mapping || Object.keys(lookupParams.mapping).length === 0) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'LOOKUP transform requires mapping object in transformParams',
          },
          { status: 400 }
        );
      }
    } else if (transformType === FieldTransformType.CUSTOM && transformParams) {
      const customParams = transformParams as { expression?: string };
      if (!customParams.expression) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'CUSTOM transform requires expression in transformParams',
          },
          { status: 400 }
        );
      }
    }

    // 檢查是否已存在相同 targetField 的規則
    const existingRule = await prisma.fieldMappingRule.findFirst({
      where: {
        configId,
        targetField,
      },
    });

    if (existingRule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `A rule for target field '${targetField}' already exists in this config`,
        },
        { status: 409 }
      );
    }

    // 建立規則
    const rule = await prisma.fieldMappingRule.create({
      data: {
        configId,
        sourceFields,
        targetField,
        transformType,
        transformParams: (transformParams ?? undefined) as Prisma.InputJsonValue | undefined,
        priority,
        isActive,
        description,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: rule.id,
          configId: rule.configId,
          sourceFields: rule.sourceFields,
          targetField: rule.targetField,
          transformType: rule.transformType,
          transformParams: rule.transformParams,
          priority: rule.priority,
          isActive: rule.isActive,
          description: rule.description,
          createdAt: rule.createdAt.toISOString(),
          updatedAt: rule.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[FieldMappingRule:POST] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while creating field mapping rule',
      },
      { status: 500 }
    );
  }
}
