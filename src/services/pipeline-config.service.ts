/**
 * @fileoverview Pipeline Config 服務層
 * @description
 *   管理 Pipeline 配置的 CRUD 和 resolve 邏輯。
 *   支援 GLOBAL/REGION/COMPANY 三層 scope 配置，
 *   透過 resolveEffectiveConfig 合併為最終有效配置。
 *
 * @module src/services/pipeline-config
 * @since CHANGE-032 - Pipeline Reference Number Matching & FX Conversion
 * @lastModified 2026-02-08
 *
 * @features
 *   - CRUD 操作（列表、取得、建立、更新、刪除）
 *   - 三層 scope 配置合併（COMPANY > REGION > GLOBAL）
 *   - 分頁、篩選、排序查詢
 *
 * @dependencies
 *   - @prisma/client - 資料庫存取
 *
 * @related
 *   - src/lib/validations/pipeline-config.schema.ts - 驗證 Schema
 *   - src/app/api/v1/pipeline-configs/ - API 端點
 *   - src/types/extraction-v3.types.ts - EffectivePipelineConfig 類型
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { PipelineConfig, PipelineConfigScope } from '@prisma/client';
import type { EffectivePipelineConfig } from '@/types/extraction-v3.types';

// ============================================================================
// Types
// ============================================================================

interface PipelineConfigQueryParams {
  page?: number;
  limit?: number;
  scope?: PipelineConfigScope;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PipelineConfigCreateInput {
  scope: PipelineConfigScope;
  regionId?: string | null;
  companyId?: string | null;
  refMatchEnabled?: boolean;
  refMatchTypes?: string[];
  refMatchMaxResults?: number;
  fxConversionEnabled?: boolean;
  fxTargetCurrency?: string | null;
  fxConvertLineItems?: boolean;
  fxConvertExtraCharges?: boolean;
  fxRoundingPrecision?: number;
  fxFallbackBehavior?: string;
  isActive?: boolean;
  description?: string | null;
}

interface PipelineConfigUpdateInput {
  refMatchEnabled?: boolean;
  refMatchTypes?: string[];
  refMatchMaxResults?: number;
  fxConversionEnabled?: boolean;
  fxTargetCurrency?: string | null;
  fxConvertLineItems?: boolean;
  fxConvertExtraCharges?: boolean;
  fxRoundingPrecision?: number;
  fxFallbackBehavior?: string;
  isActive?: boolean;
  description?: string | null;
}

// ============================================================================
// Default Config Values
// ============================================================================

const DEFAULT_EFFECTIVE_CONFIG: EffectivePipelineConfig = {
  refMatchEnabled: false,
  refMatchTypes: ['SHIPMENT', 'HAWB', 'MAWB', 'BL', 'CONTAINER'],
  refMatchMaxResults: 10,
  fxConversionEnabled: false,
  fxTargetCurrency: null,
  fxConvertLineItems: true,
  fxConvertExtraCharges: true,
  fxRoundingPrecision: 2,
  fxFallbackBehavior: 'skip',
  resolvedFrom: {},
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 查詢 Pipeline Config 列表
 */
export async function getPipelineConfigs(query: PipelineConfigQueryParams) {
  const {
    page = 1,
    limit = 20,
    scope,
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const where: Prisma.PipelineConfigWhereInput = {};
  if (scope) where.scope = scope;
  if (isActive !== undefined) where.isActive = isActive;

  const [items, total] = await Promise.all([
    prisma.pipelineConfig.findMany({
      where,
      include: {
        region: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pipelineConfig.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 取得單筆 Pipeline Config
 */
export async function getPipelineConfigById(id: string) {
  const config = await prisma.pipelineConfig.findUnique({
    where: { id },
    include: {
      region: { select: { id: true, name: true, code: true } },
      company: { select: { id: true, name: true } },
    },
  });

  if (!config) {
    throw new Error('Pipeline config not found');
  }

  return config;
}

/**
 * 建立 Pipeline Config
 */
export async function createPipelineConfig(data: PipelineConfigCreateInput) {
  // Scope 驗證：GLOBAL 不需要 regionId/companyId
  if (data.scope === 'GLOBAL') {
    data.regionId = null;
    data.companyId = null;
  } else if (data.scope === 'REGION') {
    if (!data.regionId) throw new Error('Region scope requires regionId');
    data.companyId = null;
  } else if (data.scope === 'COMPANY') {
    if (!data.companyId) throw new Error('Company scope requires companyId');
  }

  // 檢查重複
  const existing = await prisma.pipelineConfig.findFirst({
    where: {
      scope: data.scope,
      regionId: data.regionId ?? null,
      companyId: data.companyId ?? null,
    },
  });

  if (existing) {
    throw new Error('此 scope + region + company 組合的配置已存在');
  }

  return prisma.pipelineConfig.create({
    data: {
      scope: data.scope,
      regionId: data.regionId ?? null,
      companyId: data.companyId ?? null,
      refMatchEnabled: data.refMatchEnabled ?? false,
      refMatchTypes: data.refMatchTypes ?? ['SHIPMENT', 'HAWB', 'MAWB', 'BL', 'CONTAINER'],
      refMatchMaxResults: data.refMatchMaxResults ?? 10,
      fxConversionEnabled: data.fxConversionEnabled ?? false,
      fxTargetCurrency: data.fxTargetCurrency ?? null,
      fxConvertLineItems: data.fxConvertLineItems ?? true,
      fxConvertExtraCharges: data.fxConvertExtraCharges ?? true,
      fxRoundingPrecision: data.fxRoundingPrecision ?? 2,
      fxFallbackBehavior: data.fxFallbackBehavior ?? 'skip',
      isActive: data.isActive ?? true,
      description: data.description ?? null,
    },
    include: {
      region: { select: { id: true, name: true, code: true } },
      company: { select: { id: true, name: true } },
    },
  });
}

/**
 * 更新 Pipeline Config
 */
export async function updatePipelineConfig(id: string, data: PipelineConfigUpdateInput) {
  const existing = await prisma.pipelineConfig.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Pipeline config not found');
  }

  // Transform refMatchTypes for Prisma JSON compatibility
  const prismaData: Prisma.PipelineConfigUpdateInput = {
    ...data,
    refMatchTypes: data.refMatchTypes === undefined
      ? undefined
      : data.refMatchTypes as unknown as Prisma.InputJsonValue,
  };

  return prisma.pipelineConfig.update({
    where: { id },
    data: prismaData,
    include: {
      region: { select: { id: true, name: true, code: true } },
      company: { select: { id: true, name: true } },
    },
  });
}

/**
 * 刪除 Pipeline Config
 */
export async function deletePipelineConfig(id: string) {
  const existing = await prisma.pipelineConfig.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Pipeline config not found');
  }

  return prisma.pipelineConfig.delete({ where: { id } });
}

/**
 * 解析有效配置 - 核心方法
 *
 * @description
 *   合併三層 scope 配置：COMPANY > REGION > GLOBAL
 *   逐欄位覆蓋，更具體的 scope 優先。
 *
 * @param options - regionId 和 companyId（可選）
 * @returns 合併後的有效配置
 */
export async function resolveEffectiveConfig(
  options: { regionId?: string; companyId?: string } = {}
): Promise<EffectivePipelineConfig> {
  const { regionId, companyId } = options;

  // 1. 載入 GLOBAL config
  const globalConfig = await prisma.pipelineConfig.findFirst({
    where: {
      scope: 'GLOBAL',
      regionId: null,
      companyId: null,
      isActive: true,
    },
  });

  // 2. 載入 REGION config（if regionId provided）
  let regionConfig: PipelineConfig | null = null;
  if (regionId) {
    regionConfig = await prisma.pipelineConfig.findFirst({
      where: {
        scope: 'REGION',
        regionId,
        isActive: true,
      },
    });
  }

  // 3. 載入 COMPANY config（if companyId provided）
  let companyConfig: PipelineConfig | null = null;
  if (companyId) {
    companyConfig = await prisma.pipelineConfig.findFirst({
      where: {
        scope: 'COMPANY',
        companyId,
        isActive: true,
      },
    });
  }

  // 4. 逐欄位合併：COMPANY > REGION > GLOBAL > DEFAULT
  const configs = [globalConfig, regionConfig, companyConfig].filter(
    (c): c is PipelineConfig => c !== null
  );

  if (configs.length === 0) {
    return { ...DEFAULT_EFFECTIVE_CONFIG };
  }

  const resolved: EffectivePipelineConfig = { ...DEFAULT_EFFECTIVE_CONFIG };
  const resolvedFrom: Record<string, string> = {};

  for (const config of configs) {
    const scopeLabel = config.scope.toLowerCase();

    resolved.refMatchEnabled = config.refMatchEnabled;
    resolved.refMatchMaxResults = config.refMatchMaxResults;
    resolved.fxConversionEnabled = config.fxConversionEnabled;
    resolved.fxConvertLineItems = config.fxConvertLineItems;
    resolved.fxConvertExtraCharges = config.fxConvertExtraCharges;
    resolved.fxRoundingPrecision = config.fxRoundingPrecision;
    resolved.fxFallbackBehavior = config.fxFallbackBehavior as 'skip' | 'warn' | 'error';

    if (config.refMatchTypes) {
      resolved.refMatchTypes = config.refMatchTypes as string[];
    }
    if (config.fxTargetCurrency) {
      resolved.fxTargetCurrency = config.fxTargetCurrency;
    }

    resolvedFrom[scopeLabel] = config.id;
  }

  resolved.resolvedFrom = resolvedFrom;
  return resolved;
}
