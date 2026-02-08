/**
 * @fileoverview Pipeline Config 驗證 Schema
 * @description
 *   使用 Zod 定義 Pipeline Config 相關的驗證 Schema。
 *   用於前端表單驗證和後端 API 輸入驗證。
 *
 * @module src/lib/validations/pipeline-config.schema
 * @since CHANGE-032 - Pipeline Reference Number Matching & FX Conversion
 * @lastModified 2026-02-08
 *
 * @dependencies
 *   - zod - Schema 驗證庫
 *
 * @related
 *   - src/services/pipeline-config.service.ts - 服務層
 *   - src/app/api/v1/pipeline-configs/ - API 端點
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

const PAGE_SIZE_MIN = 1;
const PAGE_SIZE_MAX = 100;
const PAGE_SIZE_DEFAULT = 20;

// ============================================================================
// Enum Schemas
// ============================================================================

export const pipelineConfigScopeSchema = z.enum(['GLOBAL', 'REGION', 'COMPANY']);

export const fxFallbackBehaviorSchema = z.enum(['skip', 'warn', 'error']);

export const referenceNumberTypeSchema = z.enum([
  'SHIPMENT',
  'DELIVERY',
  'BOOKING',
  'CONTAINER',
  'HAWB',
  'MAWB',
  'BL',
  'CUSTOMS',
  'OTHER',
]);

// ============================================================================
// Create Schema
// ============================================================================

export const createPipelineConfigSchema = z
  .object({
    scope: pipelineConfigScopeSchema,
    regionId: z.string().uuid().nullable().optional(),
    companyId: z.string().uuid().nullable().optional(),

    // Reference Number Matching
    refMatchEnabled: z.boolean().default(false),
    refMatchTypes: z.array(referenceNumberTypeSchema).optional(),
    refMatchFromFilename: z.boolean().default(true),
    refMatchFromContent: z.boolean().default(true),
    refMatchPatterns: z.record(z.string(), z.string()).nullable().optional(),
    refMatchMaxCandidates: z.number().int().min(1).max(100).default(20),

    // FX Conversion
    fxConversionEnabled: z.boolean().default(false),
    fxTargetCurrency: z
      .string()
      .length(3)
      .toUpperCase()
      .nullable()
      .optional(),
    fxConvertLineItems: z.boolean().default(true),
    fxConvertExtraCharges: z.boolean().default(true),
    fxRoundingPrecision: z.number().int().min(0).max(8).default(2),
    fxFallbackBehavior: fxFallbackBehaviorSchema.default('skip'),

    // General
    isActive: z.boolean().default(true),
    description: z.string().max(500).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.scope === 'REGION') return !!data.regionId;
      return true;
    },
    { message: 'regionId is required for REGION scope', path: ['regionId'] }
  )
  .refine(
    (data) => {
      if (data.scope === 'COMPANY') return !!data.companyId;
      return true;
    },
    { message: 'companyId is required for COMPANY scope', path: ['companyId'] }
  );

// ============================================================================
// Update Schema
// ============================================================================

export const updatePipelineConfigSchema = z.object({
  refMatchEnabled: z.boolean().optional(),
  refMatchTypes: z.array(referenceNumberTypeSchema).optional(),
  refMatchFromFilename: z.boolean().optional(),
  refMatchFromContent: z.boolean().optional(),
  refMatchPatterns: z.record(z.string(), z.string()).nullable().optional(),
  refMatchMaxCandidates: z.number().int().min(1).max(100).optional(),
  fxConversionEnabled: z.boolean().optional(),
  fxTargetCurrency: z
    .string()
    .length(3)
    .toUpperCase()
    .nullable()
    .optional(),
  fxConvertLineItems: z.boolean().optional(),
  fxConvertExtraCharges: z.boolean().optional(),
  fxRoundingPrecision: z.number().int().min(0).max(8).optional(),
  fxFallbackBehavior: fxFallbackBehaviorSchema.optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(500).nullable().optional(),
});

// ============================================================================
// Query Schemas
// ============================================================================

export const getPipelineConfigsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : PAGE_SIZE_DEFAULT))
    .pipe(z.number().int().min(PAGE_SIZE_MIN).max(PAGE_SIZE_MAX)),
  scope: pipelineConfigScopeSchema.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'scope'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const resolveConfigQuerySchema = z.object({
  regionId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreatePipelineConfigInput = z.infer<typeof createPipelineConfigSchema>;
export type UpdatePipelineConfigInput = z.infer<typeof updatePipelineConfigSchema>;
export type GetPipelineConfigsQuery = z.infer<typeof getPipelineConfigsQuerySchema>;
export type ResolveConfigQuery = z.infer<typeof resolveConfigQuerySchema>;
