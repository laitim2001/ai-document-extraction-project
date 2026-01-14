/**
 * @fileoverview 文件格式驗證 Schema
 * @description
 *   提供文件格式相關的 Zod 驗證 schema：
 *   - 識別規則驗證
 *   - 格式更新驗證
 *   - 格式建立驗證 (Story 16-8)
 *
 * @module src/validations/document-format
 * @since Epic 16 - Story 16.3
 * @lastModified 2026-01-14
 */

import { z } from 'zod';
import { DocumentType, DocumentSubtype } from '@prisma/client';

// ============================================================================
// Logo 特徵驗證
// ============================================================================

/**
 * Logo 位置列表
 */
const LOGO_POSITIONS = [
  'top-left',
  'top-right',
  'top-center',
  'bottom-left',
  'bottom-right',
  'center',
] as const;

/**
 * Logo 特徵 Schema
 */
export const logoPatternSchema = z.object({
  position: z.enum(LOGO_POSITIONS),
  description: z.string().min(1, '請輸入描述').max(200, '描述過長'),
});

export type LogoPatternInput = z.infer<typeof logoPatternSchema>;

// ============================================================================
// 識別規則驗證
// ============================================================================

/**
 * 識別規則 Schema
 */
export const identificationRulesSchema = z.object({
  logoPatterns: z
    .array(logoPatternSchema)
    .max(10, '最多 10 個 Logo 特徵'),
  keywords: z
    .array(z.string().min(1, '關鍵字不可為空').max(100, '關鍵字過長'))
    .max(50, '最多 50 個關鍵字'),
  layoutHints: z.string().max(1000, '版面描述過長').default(''),
  priority: z.number().int().min(0).max(100).default(50),
});

export type IdentificationRulesInput = z.infer<typeof identificationRulesSchema>;

// ============================================================================
// 格式更新驗證
// ============================================================================

/**
 * 格式特徵 Schema
 */
export const formatFeaturesSchema = z.object({
  hasLineItems: z.boolean().optional(),
  hasHeaderLogo: z.boolean().optional(),
  currency: z.string().optional(),
  language: z.string().optional(),
  typicalFields: z.array(z.string()).optional(),
  layoutPattern: z.string().optional(),
});

/**
 * 格式更新 Schema
 */
export const updateFormatSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  features: formatFeaturesSchema.optional(),
  identificationRules: identificationRulesSchema.optional(),
});

export type UpdateFormatInput = z.infer<typeof updateFormatSchema>;

// ============================================================================
// 格式建立驗證 (Story 16-8)
// ============================================================================

/**
 * 自動配置選項 Schema
 */
export const autoCreateConfigsSchema = z.object({
  fieldMapping: z.boolean().default(false),
  promptConfig: z.boolean().default(false),
});

/**
 * 建立文件格式 Schema
 * @since Story 16-8
 */
export const createDocumentFormatSchema = z.object({
  companyId: z.string().uuid({ message: '無效的公司 ID' }),
  documentType: z.nativeEnum(DocumentType, {
    message: '請選擇文件類型',
  }),
  documentSubtype: z.nativeEnum(DocumentSubtype, {
    message: '請選擇文件子類型',
  }),
  name: z.string().min(1).max(200).optional(),
  autoCreateConfigs: autoCreateConfigsSchema.optional(),
});

export type CreateDocumentFormatInput = z.infer<typeof createDocumentFormatSchema>;
