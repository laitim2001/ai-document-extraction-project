/**
 * @fileoverview Outlook 連線配置 Zod 驗證 Schema
 * @description
 *   提供 Outlook 連線配置的輸入驗證，包含：
 *   - 建立/更新配置驗證
 *   - 過濾規則驗證
 *   - 連線測試驗證
 *
 * @module src/lib/validations/outlook-config.schema
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 配置 CRUD 驗證
 *   - 過濾規則驗證
 *   - UUID 格式驗證
 *   - 自訂錯誤訊息
 *
 * @dependencies
 *   - zod - 驗證庫
 *
 * @related
 *   - src/types/outlook-config.types.ts - 類型定義
 *   - src/services/outlook-config.service.ts - 服務層
 */

import { z } from 'zod';

// ============================================================
// 共用驗證模式
// ============================================================

/**
 * GUID/UUID 格式驗證
 */
const guidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// 配置驗證
// ============================================================

/**
 * 建立配置驗證
 */
export const createOutlookConfigSchema = z.object({
  name: z
    .string()
    .min(1, '名稱為必填')
    .max(100, '名稱不可超過 100 字'),
  description: z
    .string()
    .max(500, '描述不可超過 500 字')
    .optional()
    .nullable()
    .transform((val) => val ?? undefined),
  mailboxAddress: z
    .string()
    .email('請輸入有效的郵箱地址'),
  mailFolders: z
    .array(z.string())
    .default(['inbox']),
  tenantId: z
    .string()
    .min(1, '租戶 ID 為必填')
    .regex(guidPattern, '租戶 ID 格式不正確'),
  clientId: z
    .string()
    .min(1, '應用程式 ID 為必填')
    .regex(guidPattern, '應用程式 ID 格式不正確'),
  clientSecret: z
    .string()
    .min(1, '客戶端密鑰為必填'),
  cityId: z
    .string()
    .cuid('城市 ID 格式不正確')
    .optional()
    .nullable(),
  isGlobal: z
    .boolean()
    .default(false),
  allowedExtensions: z
    .array(z.string())
    .default(['pdf', 'jpg', 'jpeg', 'png', 'tiff']),
  maxAttachmentSizeMb: z
    .number()
    .int('必須為整數')
    .min(1, '最小 1 MB')
    .max(50, '最大 50 MB')
    .default(30),
});

/**
 * 更新配置驗證
 */
export const updateOutlookConfigSchema = z.object({
  name: z
    .string()
    .min(1, '名稱為必填')
    .max(100, '名稱不可超過 100 字')
    .optional(),
  description: z
    .string()
    .max(500, '描述不可超過 500 字')
    .optional()
    .nullable(),
  mailboxAddress: z
    .string()
    .email('請輸入有效的郵箱地址')
    .optional(),
  mailFolders: z
    .array(z.string())
    .optional(),
  tenantId: z
    .string()
    .regex(guidPattern, '租戶 ID 格式不正確')
    .optional(),
  clientId: z
    .string()
    .regex(guidPattern, '應用程式 ID 格式不正確')
    .optional(),
  clientSecret: z
    .string()
    .min(1)
    .optional(),
  allowedExtensions: z
    .array(z.string())
    .optional(),
  maxAttachmentSizeMb: z
    .number()
    .int('必須為整數')
    .min(1, '最小 1 MB')
    .max(50, '最大 50 MB')
    .optional(),
  isActive: z
    .boolean()
    .optional(),
});

/**
 * 測試連線驗證
 */
export const testConnectionSchema = z.object({
  mailboxAddress: z
    .string()
    .email('請輸入有效的郵箱地址'),
  tenantId: z
    .string()
    .min(1, '租戶 ID 為必填')
    .regex(guidPattern, '租戶 ID 格式不正確'),
  clientId: z
    .string()
    .min(1, '應用程式 ID 為必填')
    .regex(guidPattern, '應用程式 ID 格式不正確'),
  clientSecret: z
    .string()
    .min(1, '客戶端密鑰為必填'),
});

// ============================================================
// 過濾規則驗證
// ============================================================

/**
 * 規則類型 enum
 * @see prisma/schema.prisma - OutlookRuleType
 */
export const ruleTypeEnum = z.enum([
  'SENDER_EMAIL',
  'SENDER_DOMAIN',
  'SUBJECT_KEYWORD',
  'SUBJECT_REGEX',
  'ATTACHMENT_TYPE',
  'ATTACHMENT_NAME',
]);

/**
 * 規則運算子 enum
 * @see prisma/schema.prisma - RuleOperator
 */
export const ruleOperatorEnum = z.enum([
  'EQUALS',
  'CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
  'REGEX',
]);

/**
 * 建立過濾規則驗證
 */
export const createFilterRuleSchema = z.object({
  name: z
    .string()
    .min(1, '規則名稱為必填')
    .max(100, '規則名稱不可超過 100 字'),
  description: z
    .string()
    .max(500, '描述不可超過 500 字')
    .optional()
    .nullable()
    .transform((val) => val ?? undefined),
  ruleType: ruleTypeEnum,
  ruleValue: z
    .string()
    .min(1, '規則值為必填'),
  operator: ruleOperatorEnum
    .default('CONTAINS'),
  isWhitelist: z
    .boolean(),
  priority: z
    .number()
    .int('優先級必須為整數')
    .min(0, '優先級不可小於 0')
    .default(0),
});

/**
 * 更新過濾規則驗證
 */
export const updateFilterRuleSchema = z.object({
  name: z
    .string()
    .min(1, '規則名稱為必填')
    .max(100, '規則名稱不可超過 100 字')
    .optional(),
  description: z
    .string()
    .max(500, '描述不可超過 500 字')
    .optional()
    .nullable(),
  ruleType: ruleTypeEnum
    .optional(),
  ruleValue: z
    .string()
    .min(1)
    .optional(),
  operator: ruleOperatorEnum
    .optional(),
  isWhitelist: z
    .boolean()
    .optional(),
  isActive: z
    .boolean()
    .optional(),
  priority: z
    .number()
    .int()
    .min(0)
    .optional(),
});

/**
 * 重新排序規則驗證
 */
export const reorderRulesSchema = z.object({
  ruleIds: z
    .array(z.string().cuid('規則 ID 格式不正確'))
    .min(1, '至少需要一個規則 ID'),
});

// ============================================================
// 型別導出
// ============================================================

export type CreateOutlookConfigSchemaType = z.infer<typeof createOutlookConfigSchema>;
export type UpdateOutlookConfigSchemaType = z.infer<typeof updateOutlookConfigSchema>;
export type TestConnectionSchemaType = z.infer<typeof testConnectionSchema>;
export type CreateFilterRuleSchemaType = z.infer<typeof createFilterRuleSchema>;
export type UpdateFilterRuleSchemaType = z.infer<typeof updateFilterRuleSchema>;
export type ReorderRulesSchemaType = z.infer<typeof reorderRulesSchema>;
