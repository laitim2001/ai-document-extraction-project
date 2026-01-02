/**
 * @fileoverview Field Mapping Rules API - 規則重排序
 * @description
 *   提供映射規則的優先級重排序功能。
 *   批次更新多個規則的 priority 值。
 *
 * @module src/app/api/v1/field-mapping-configs/[id]/rules/reorder
 * @since Epic 13 - Story 13.4
 * @lastModified 2026-01-02
 *
 * @endpoints
 *   POST /api/v1/field-mapping-configs/:id/rules/reorder - 批次重排序規則
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// =====================
// Validation Schemas
// =====================

/**
 * 重排序請求 Schema
 */
const reorderSchema = z.object({
  rules: z.array(
    z.object({
      id: z.string(),
      priority: z.number().int().min(0).max(1000),
    })
  ).min(1).max(100),
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
 * POST /api/v1/field-mapping-configs/:id/rules/reorder
 * 批次重排序規則優先級
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
    const parsed = reorderSchema.safeParse(body);
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

    const { rules } = parsed.data;

    // 檢查配置是否存在
    const config = await prisma.fieldMappingConfig.findUnique({
      where: { id: configId },
      include: {
        rules: {
          select: { id: true },
        },
      },
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

    // 驗證所有規則 ID 都屬於該配置
    const configRuleIds = new Set(config.rules.map((r) => r.id));
    const invalidRuleIds = rules.filter((r) => !configRuleIds.has(r.id)).map((r) => r.id);

    if (invalidRuleIds.length > 0) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: `The following rule IDs do not belong to this config: ${invalidRuleIds.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 批次更新優先級（使用事務確保原子性）
    const updatePromises = rules.map((rule) =>
      prisma.fieldMappingRule.update({
        where: { id: rule.id },
        data: { priority: rule.priority },
        select: {
          id: true,
          targetField: true,
          priority: true,
        },
      })
    );

    const updatedRules = await prisma.$transaction(updatePromises);

    return NextResponse.json({
      success: true,
      data: {
        configId,
        updatedCount: updatedRules.length,
        rules: updatedRules.map((rule) => ({
          id: rule.id,
          targetField: rule.targetField,
          priority: rule.priority,
        })),
      },
    });
  } catch (error) {
    console.error('[FieldMappingRule:Reorder] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while reordering field mapping rules',
      },
      { status: 500 }
    );
  }
}
