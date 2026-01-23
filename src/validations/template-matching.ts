/**
 * @fileoverview 模版匹配 API 驗證 Schema
 * @description
 *   定義模版匹配 API 的 Zod 驗證 Schema
 *   包含執行、預覽、驗證等 API 的輸入驗證
 *
 * @module src/validations/template-matching
 * @since Epic 19 - Story 19.3
 * @lastModified 2026-01-22
 *
 * @features
 *   - 執行匹配 API 驗證
 *   - 預覽匹配 API 驗證
 *   - 驗證映射 API 驗證
 *
 * @dependencies
 *   - zod - 驗證庫
 */

import { z } from 'zod';

// ============================================================================
// Execute Match Schema
// ============================================================================

/**
 * 執行匹配選項 Schema
 */
export const executeMatchOptionsSchema = z.object({
  /**
   * 用於提取 rowKey 的欄位名稱
   */
  rowKeyField: z.string().min(1).optional(),

  /**
   * 公司 ID（用於解析映射規則）
   */
  companyId: z.string().uuid().optional(),

  /**
   * 文件格式 ID（用於解析映射規則）
   */
  formatId: z.string().uuid().optional(),

  /**
   * 批量處理大小（1-1000）
   */
  batchSize: z.number().int().min(1).max(1000).optional(),

  /**
   * 是否跳過驗證
   */
  skipValidation: z.boolean().optional(),
});

/**
 * 執行匹配請求 Schema
 */
export const executeMatchRequestSchema = z.object({
  /**
   * 要處理的文件 ID 列表
   */
  documentIds: z.array(z.string().uuid()).min(1).max(10000),

  /**
   * 目標模版實例 ID
   */
  templateInstanceId: z.string().uuid(),

  /**
   * 匹配選項
   */
  options: executeMatchOptionsSchema.optional(),
});

/**
 * 執行匹配請求類型
 */
export type ExecuteMatchRequest = z.infer<typeof executeMatchRequestSchema>;

// ============================================================================
// Preview Match Schema
// ============================================================================

/**
 * 預覽匹配請求 Schema
 */
export const previewMatchRequestSchema = z.object({
  /**
   * 要預覽的文件 ID 列表（限制數量避免預覽過多）
   */
  documentIds: z.array(z.string().uuid()).min(1).max(100),

  /**
   * 數據模版 ID
   */
  dataTemplateId: z.string().uuid(),

  /**
   * 公司 ID（用於解析映射規則）
   */
  companyId: z.string().uuid().optional(),

  /**
   * 文件格式 ID（用於解析映射規則）
   */
  formatId: z.string().uuid().optional(),

  /**
   * 用於提取 rowKey 的欄位名稱
   */
  rowKeyField: z.string().min(1).optional(),
});

/**
 * 預覽匹配請求類型
 */
export type PreviewMatchRequest = z.infer<typeof previewMatchRequestSchema>;

// ============================================================================
// Validate Mapping Schema
// ============================================================================

/**
 * 驗證映射請求 Schema
 */
export const validateMappingRequestSchema = z.object({
  /**
   * 數據模版 ID
   */
  dataTemplateId: z.string().uuid(),

  /**
   * 公司 ID
   */
  companyId: z.string().uuid().optional(),

  /**
   * 文件格式 ID
   */
  formatId: z.string().uuid().optional(),
});

/**
 * 驗證映射請求類型
 */
export type ValidateMappingRequest = z.infer<typeof validateMappingRequestSchema>;

// ============================================================================
// Story 19.7 - Document Batch Matching Schema
// ============================================================================

/**
 * 批量匹配請求 Schema
 */
export const batchMatchDocumentsRequestSchema = z.object({
  /**
   * 文件 ID 列表（最多 500 個）
   */
  documentIds: z.array(z.string().uuid()).min(1).max(500),

  /**
   * 目標模版實例 ID
   */
  templateInstanceId: z.string().cuid(),

  /**
   * 匹配選項
   */
  options: z.object({
    /**
     * 批量處理大小
     */
    batchSize: z.number().int().min(1).max(100).optional(),
  }).optional(),
});

/**
 * 批量匹配請求類型
 */
export type BatchMatchDocumentsRequest = z.infer<typeof batchMatchDocumentsRequestSchema>;

/**
 * 單一文件匹配請求 Schema
 */
export const singleMatchDocumentRequestSchema = z.object({
  /**
   * 目標模版實例 ID
   */
  templateInstanceId: z.string().cuid(),
});

/**
 * 單一文件匹配請求類型
 */
export type SingleMatchDocumentRequest = z.infer<typeof singleMatchDocumentRequestSchema>;

/**
 * 取消匹配請求 Schema（空物件，無需請求體）
 */
export const unmatchDocumentRequestSchema = z.object({}).optional();

/**
 * 取消匹配請求類型
 */
export type UnmatchDocumentRequest = z.infer<typeof unmatchDocumentRequestSchema>;

// ============================================================================
// Export
// ============================================================================

export const templateMatchingSchemas = {
  executeMatch: executeMatchRequestSchema,
  previewMatch: previewMatchRequestSchema,
  validateMapping: validateMappingRequestSchema,
  batchMatchDocuments: batchMatchDocumentsRequestSchema,
  singleMatchDocument: singleMatchDocumentRequestSchema,
  unmatchDocument: unmatchDocumentRequestSchema,
};
