/**
 * @fileoverview Field Mapping Rules API - 單一規則操作
 * @description
 *   提供單一映射規則的更新和刪除功能。
 *
 * @module src/app/api/v1/field-mapping-configs/[id]/rules/[ruleId]
 * @since Epic 13 - Story 13.4
 * @lastModified 2026-01-02
 *
 * @endpoints
 *   PATCH  /api/v1/field-mapping-configs/:id/rules/:ruleId - 更新規則
 *   DELETE /api/v1/field-mapping-configs/:id/rules/:ruleId - 刪除規則
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { FieldTransformType, Prisma } from '@prisma/client';

// =====================
// Validation Schemas
// =====================

/**
 * Transform 參數 Schema
 */
const transformParamsSchema = z.union([
  z.object({}).optional(),
  z.object({
    separator: z.string().max(10).default(''),
  }),
  z.object({
    separator: z.string().min(1),
    index: z.number().int().min(0),
  }),
  z.object({
    mapping: z.record(z.string(), z.string()),
    defaultValue: z.string().optional(),
  }),
  z.object({
    expression: z.string().min(1).max(1000),
  }),
]);

/**
 * 更新規則 Schema
 */
const updateRuleSchema = z.object({
  sourceFields: z.array(z.string().min(1).max(100)).min(1).max(10).optional(),
  targetField: z.string().min(1).max(100).optional(),
  transformType: z.nativeEnum(FieldTransformType).optional(),
  transformParams: transformParamsSchema.optional().nullable(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).optional().nullable(),
});

// =====================
// Route Context Type
// =====================

interface RouteContext {
  params: Promise<{ id: string; ruleId: string }>;
}

// =====================
// API Handlers
// =====================

/**
 * PATCH /api/v1/field-mapping-configs/:id/rules/:ruleId
 * 更新映射規則
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id: configId, ruleId } = params;
    const body = await request.json();

    // 驗證 ID 格式
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

    if (!ruleId || typeof ruleId !== 'string') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid rule ID',
        },
        { status: 400 }
      );
    }

    // 驗證請求體
    const parsed = updateRuleSchema.safeParse(body);
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

    const updateData = parsed.data;

    // 檢查規則是否存在且屬於該配置
    const existing = await prisma.fieldMappingRule.findFirst({
      where: {
        id: ruleId,
        configId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Field mapping rule with id '${ruleId}' not found in config '${configId}'`,
        },
        { status: 404 }
      );
    }

    // 如果更改了 targetField，檢查是否會造成重複
    if (updateData.targetField && updateData.targetField !== existing.targetField) {
      const duplicate = await prisma.fieldMappingRule.findFirst({
        where: {
          configId,
          targetField: updateData.targetField,
          id: { not: ruleId },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: `A rule for target field '${updateData.targetField}' already exists in this config`,
          },
          { status: 409 }
        );
      }
    }

    // 驗證 transformParams 與 transformType 的一致性
    const newTransformType = updateData.transformType ?? existing.transformType;
    const newTransformParams = updateData.transformParams !== undefined
      ? updateData.transformParams
      : existing.transformParams;

    if (newTransformType === FieldTransformType.SPLIT && newTransformParams) {
      const splitParams = newTransformParams as { separator?: string; index?: number };
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
    } else if (newTransformType === FieldTransformType.LOOKUP && newTransformParams) {
      const lookupParams = newTransformParams as { mapping?: Record<string, string> };
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
    } else if (newTransformType === FieldTransformType.CUSTOM && newTransformParams) {
      const customParams = newTransformParams as { expression?: string };
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

    // 更新規則
    const updated = await prisma.fieldMappingRule.update({
      where: { id: ruleId },
      data: {
        ...updateData,
        transformParams: (updateData.transformParams === null
          ? undefined
          : updateData.transformParams) as Prisma.InputJsonValue | undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        configId: updated.configId,
        sourceFields: updated.sourceFields,
        targetField: updated.targetField,
        transformType: updated.transformType,
        transformParams: updated.transformParams,
        priority: updated.priority,
        isActive: updated.isActive,
        description: updated.description,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[FieldMappingRule:PATCH] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while updating field mapping rule',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/field-mapping-configs/:id/rules/:ruleId
 * 刪除映射規則
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id: configId, ruleId } = params;

    // 驗證 ID 格式
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

    if (!ruleId || typeof ruleId !== 'string') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid rule ID',
        },
        { status: 400 }
      );
    }

    // 檢查規則是否存在且屬於該配置
    const existing = await prisma.fieldMappingRule.findFirst({
      where: {
        id: ruleId,
        configId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `Field mapping rule with id '${ruleId}' not found in config '${configId}'`,
        },
        { status: 404 }
      );
    }

    // 刪除規則
    await prisma.fieldMappingRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: ruleId,
        configId,
        targetField: existing.targetField,
        message: `Field mapping rule for target '${existing.targetField}' has been deleted`,
      },
    });
  } catch (error) {
    console.error('[FieldMappingRule:DELETE] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while deleting field mapping rule',
      },
      { status: 500 }
    );
  }
}
