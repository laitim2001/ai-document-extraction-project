/**
 * @fileoverview Field Mapping Config API - 導出配置
 * @description
 *   提供映射配置的導出功能，支援單一配置或批次導出。
 *   導出格式為 JSON，包含配置和所有關聯的規則。
 *
 * @module src/app/api/v1/field-mapping-configs/[id]/export
 * @since Epic 13 - Story 13.4
 * @lastModified 2026-01-02
 *
 * @endpoints
 *   GET /api/v1/field-mapping-configs/:id/export - 導出單一配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// =====================
// Route Context Type
// =====================

interface RouteContext {
  params: Promise<{ id: string }>;
}

// =====================
// Export Types
// =====================

interface ExportedRule {
  sourceFields: unknown;
  targetField: string;
  transformType: string;
  transformParams: unknown;
  priority: number;
  isActive: boolean;
  description: string | null;
}

interface ExportedConfig {
  exportVersion: string;
  exportedAt: string;
  config: {
    name: string;
    description: string | null;
    scope: string;
    isActive: boolean;
    companyCode?: string;
    documentFormatName?: string;
  };
  rules: ExportedRule[];
}

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/field-mapping-configs/:id/export
 * 導出單一配置及其所有規則
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const { id: configId } = params;

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

    // 查詢配置及其所有規則
    const config = await prisma.fieldMappingConfig.findUnique({
      where: { id: configId },
      include: {
        company: {
          select: {
            code: true,
            name: true,
          },
        },
        documentFormat: {
          select: {
            name: true,
          },
        },
        rules: {
          orderBy: { priority: 'desc' },
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

    // 構建導出數據
    const exportData: ExportedConfig = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      config: {
        name: config.name,
        description: config.description,
        scope: config.scope,
        isActive: config.isActive,
        ...(config.company?.code && { companyCode: config.company.code }),
        ...(config.documentFormat?.name && {
          documentFormatName: config.documentFormat.name,
        }),
      },
      rules: config.rules.map((rule) => ({
        sourceFields: rule.sourceFields,
        targetField: rule.targetField,
        transformType: rule.transformType,
        transformParams: rule.transformParams,
        priority: rule.priority,
        isActive: rule.isActive,
        description: rule.description,
      })),
    };

    // 設置下載響應頭
    const fileName = `field-mapping-config-${config.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('[FieldMappingConfig:Export] Error:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while exporting field mapping config',
      },
      { status: 500 }
    );
  }
}
