/**
 * @fileoverview Field Mapping Config API - 導入配置
 * @description
 *   提供映射配置的導入功能。
 *   支援從 JSON 格式導入配置和規則。
 *   導入時會驗證數據格式和關聯實體。
 *
 * @module src/app/api/v1/field-mapping-configs/import
 * @since Epic 13 - Story 13.4
 * @lastModified 2026-01-02
 *
 * @endpoints
 *   POST /api/v1/field-mapping-configs/import - 導入配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { FieldMappingScope, FieldTransformType, Prisma } from '@prisma/client';

// =====================
// Validation Schemas
// =====================

/**
 * 導入規則 Schema
 */
const importRuleSchema = z.object({
  sourceFields: z.array(z.string()).min(1),
  targetField: z.string().min(1).max(100),
  transformType: z.nativeEnum(FieldTransformType).default(FieldTransformType.DIRECT),
  transformParams: z.unknown().optional().nullable(),
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
  description: z.string().max(500).optional().nullable(),
});

/**
 * 導入配置 Schema
 */
const importConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  scope: z.nativeEnum(FieldMappingScope).default(FieldMappingScope.GLOBAL),
  isActive: z.boolean().default(true),
  companyCode: z.string().optional(),
  documentFormatName: z.string().optional(),
});

/**
 * 導入請求 Schema
 */
const importRequestSchema = z.object({
  exportVersion: z.string().optional(),
  config: importConfigSchema,
  rules: z.array(importRuleSchema).default([]),
  options: z
    .object({
      overwriteExisting: z.boolean().default(false),
      skipInvalidRules: z.boolean().default(false),
    })
    .optional()
    .default(() => ({ overwriteExisting: false, skipInvalidRules: false })),
});

// =====================
// API Handlers
// =====================

/**
 * POST /api/v1/field-mapping-configs/import
 * 導入配置及其規則
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 驗證請求體
    const parsed = importRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid import data format',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { config: configData, rules: rulesData, options } = parsed.data;
    const { overwriteExisting, skipInvalidRules } = options;

    // 解析關聯實體 ID
    let companyId: string | null = null;
    let documentFormatId: string | null = null;

    // 根據 companyCode 查找公司
    if (configData.companyCode) {
      const company = await prisma.company.findFirst({
        where: { code: configData.companyCode },
      });
      if (!company) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Company with code '${configData.companyCode}' not found`,
          },
          { status: 404 }
        );
      }
      companyId = company.id;
    }

    // 根據 documentFormatName 查找格式
    if (configData.documentFormatName) {
      const format = await prisma.documentFormat.findFirst({
        where: { name: configData.documentFormatName },
      });
      if (!format) {
        return NextResponse.json(
          {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Document format with name '${configData.documentFormatName}' not found`,
          },
          { status: 404 }
        );
      }
      documentFormatId = format.id;
    }

    // 驗證 scope 與 ID 的組合邏輯
    if (configData.scope === FieldMappingScope.GLOBAL && (companyId || documentFormatId)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'GLOBAL scope should not have companyCode or documentFormatName',
        },
        { status: 400 }
      );
    }

    if (configData.scope === FieldMappingScope.COMPANY && (!companyId || documentFormatId)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'COMPANY scope requires companyCode and should not have documentFormatName',
        },
        { status: 400 }
      );
    }

    if (configData.scope === FieldMappingScope.FORMAT && !documentFormatId) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'FORMAT scope requires documentFormatName',
        },
        { status: 400 }
      );
    }

    // 檢查是否存在相同的配置
    const existing = await prisma.fieldMappingConfig.findFirst({
      where: {
        scope: configData.scope,
        companyId: companyId,
        documentFormatId: documentFormatId,
      },
    });

    if (existing && !overwriteExisting) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: `A configuration already exists for this scope combination. Use overwriteExisting: true to replace it.`,
          existingConfigId: existing.id,
        },
        { status: 409 }
      );
    }

    // 處理規則驗證
    const validRules: Array<{
      sourceFields: string[];
      targetField: string;
      transformType: FieldTransformType;
      transformParams: unknown;
      priority: number;
      isActive: boolean;
      description: string | null;
    }> = [];
    const invalidRules: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < rulesData.length; i++) {
      const rule = rulesData[i];

      // 檢查 targetField 是否重複
      const duplicate = validRules.find((r) => r.targetField === rule.targetField);
      if (duplicate) {
        if (skipInvalidRules) {
          invalidRules.push({
            index: i,
            error: `Duplicate targetField: ${rule.targetField}`,
          });
          continue;
        } else {
          return NextResponse.json(
            {
              type: 'https://api.example.com/errors/validation',
              title: 'Validation Error',
              status: 400,
              detail: `Duplicate targetField '${rule.targetField}' at rule index ${i}`,
            },
            { status: 400 }
          );
        }
      }

      validRules.push({
        sourceFields: rule.sourceFields as string[],
        targetField: rule.targetField,
        transformType: rule.transformType,
        transformParams: rule.transformParams ?? undefined,
        priority: rule.priority,
        isActive: rule.isActive,
        description: rule.description ?? null,
      });
    }

    // 執行導入（使用事務）
    const result = await prisma.$transaction(async (tx) => {
      // 如果覆蓋，先刪除舊配置
      if (existing && overwriteExisting) {
        await tx.fieldMappingConfig.delete({
          where: { id: existing.id },
        });
      }

      // 創建新配置
      const newConfig = await tx.fieldMappingConfig.create({
        data: {
          name: configData.name,
          description: configData.description,
          scope: configData.scope,
          companyId,
          documentFormatId,
          isActive: configData.isActive,
          version: 1,
        },
      });

      // 創建規則
      if (validRules.length > 0) {
        await tx.fieldMappingRule.createMany({
          data: validRules.map((rule) => ({
            configId: newConfig.id,
            sourceFields: rule.sourceFields,
            targetField: rule.targetField,
            transformType: rule.transformType,
            transformParams: rule.transformParams as Prisma.InputJsonValue | undefined,
            priority: rule.priority,
            isActive: rule.isActive,
            description: rule.description,
          })),
        });
      }

      return newConfig;
    });

    // 查詢完整的導入結果
    const importedConfig = await prisma.fieldMappingConfig.findUnique({
      where: { id: result.id },
      include: {
        company: {
          select: { id: true, name: true, code: true },
        },
        documentFormat: {
          select: { id: true, name: true },
        },
        _count: {
          select: { rules: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: importedConfig!.id,
          name: importedConfig!.name,
          description: importedConfig!.description,
          scope: importedConfig!.scope,
          companyId: importedConfig!.companyId,
          company: importedConfig!.company,
          documentFormatId: importedConfig!.documentFormatId,
          documentFormat: importedConfig!.documentFormat,
          isActive: importedConfig!.isActive,
          version: importedConfig!.version,
          rulesCount: importedConfig!._count.rules,
          createdAt: importedConfig!.createdAt.toISOString(),
          updatedAt: importedConfig!.updatedAt.toISOString(),
        },
        meta: {
          import: {
            replacedExisting: existing !== null && overwriteExisting,
            rulesImported: validRules.length,
            rulesSkipped: invalidRules.length,
            skippedRules: invalidRules.length > 0 ? invalidRules : undefined,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[FieldMappingConfig:Import] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while importing field mapping config',
      },
      { status: 500 }
    );
  }
}
