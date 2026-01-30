/**
 * @fileoverview 結果驗證服務 - V3 架構
 * @description
 *   驗證 GPT 提取結果並解析公司/格式 ID：
 *   - JSON Schema 驗證
 *   - 公司 ID 解析（匹配已知公司或 JIT 創建）
 *   - 格式 ID 解析（匹配已知格式或 JIT 創建）
 *   - 欄位格式驗證
 *   - 警告和錯誤收集
 *
 * @module src/services/extraction-v3/result-validation
 * @since CHANGE-021 - Unified Processor V3 Refactoring
 * @lastModified 2026-01-30
 *
 * @features
 *   - 結構驗證
 *   - 公司/格式 JIT 創建
 *   - 欄位格式驗證
 *   - 缺失欄位檢測
 *
 * @dependencies
 *   - @/lib/prisma - Prisma ORM
 *   - zod - Schema 驗證
 *
 * @related
 *   - src/services/extraction-v3/extraction-v3.service.ts - V3 主服務
 *   - src/types/extraction-v3.types.ts - V3 類型定義
 */

import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type {
  UnifiedExtractionResult,
  ValidatedExtractionResult,
  ValidationResultV3,
  JitCreatedV3,
  DynamicPromptConfig,
} from '@/types/extraction-v3.types';

// ============================================================================
// Types
// ============================================================================

/**
 * 驗證選項
 */
export interface ValidationOptions {
  /** 城市代碼（用於 JIT 創建） */
  cityCode: string;
  /** 是否自動創建公司 */
  autoCreateCompany?: boolean;
  /** 是否自動創建格式 */
  autoCreateFormat?: boolean;
  /** 動態配置（用於驗證參考） */
  promptConfig?: DynamicPromptConfig;
}

/**
 * 驗證服務結果
 */
export interface ValidationServiceResult {
  /** 是否成功 */
  success: boolean;
  /** 驗證後的結果 */
  result?: ValidatedExtractionResult;
  /** 錯誤訊息 */
  error?: string;
  /** 處理時間（毫秒） */
  processingTimeMs: number;
}

/**
 * 公司解析結果
 */
interface CompanyResolutionResult {
  companyId: string;
  companyName: string;
  isNewCompany: boolean;
}

/**
 * 格式解析結果
 */
interface FormatResolutionResult {
  formatId?: string;
  formatName: string;
  isNewFormat: boolean;
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * 欄位值 Schema
 */
const fieldValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  confidence: z.number().min(0).max(100),
  source: z.string().optional(),
});

/**
 * 發行方識別 Schema
 */
const issuerIdentificationSchema = z.object({
  companyName: z.string().min(1),
  companyId: z.string().optional(),
  identificationMethod: z.enum(['LOGO', 'HEADER', 'ADDRESS', 'TAX_ID', 'UNKNOWN']),
  confidence: z.number().min(0).max(100),
  isNewCompany: z.boolean(),
});

/**
 * 格式識別 Schema
 */
const formatIdentificationSchema = z.object({
  formatName: z.string(),
  formatId: z.string().optional(),
  confidence: z.number().min(0).max(100),
  isNewFormat: z.boolean(),
});

/**
 * 行項目 Schema
 */
const lineItemSchema = z.object({
  description: z.string(),
  classifiedAs: z.string().optional(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  amount: z.number(),
  confidence: z.number().min(0).max(100),
  needsClassification: z.boolean().optional(),
});

/**
 * 額外費用 Schema
 */
const extraChargeSchema = z.object({
  description: z.string(),
  classifiedAs: z.string().optional(),
  amount: z.number(),
  currency: z.string().optional(),
  confidence: z.number().min(0).max(100),
  needsClassification: z.boolean().optional(),
});

/**
 * 標準欄位 Schema
 */
const standardFieldsSchema = z.object({
  invoiceNumber: fieldValueSchema,
  invoiceDate: fieldValueSchema,
  dueDate: fieldValueSchema.optional(),
  vendorName: fieldValueSchema,
  customerName: fieldValueSchema.optional(),
  totalAmount: fieldValueSchema,
  subtotal: fieldValueSchema.optional(),
  currency: fieldValueSchema,
});

/**
 * 完整提取結果 Schema
 */
const extractionResultSchema = z.object({
  issuerIdentification: issuerIdentificationSchema,
  formatIdentification: formatIdentificationSchema,
  standardFields: standardFieldsSchema,
  customFields: z.record(z.string(), fieldValueSchema).optional(),
  lineItems: z.array(lineItemSchema),
  extraCharges: z.array(extraChargeSchema).optional(),
  overallConfidence: z.number().min(0).max(100),
  metadata: z.object({
    modelUsed: z.string(),
    processingTimeMs: z.number(),
    tokensUsed: z.object({
      input: z.number(),
      output: z.number(),
      total: z.number(),
    }),
    pageCount: z.number(),
    warnings: z.array(z.string()).optional(),
  }),
});

// ============================================================================
// Service Class
// ============================================================================

/**
 * 結果驗證服務
 *
 * @description 驗證 GPT 提取結果並解析公司/格式 ID
 *
 * @example
 * ```typescript
 * const result = await ResultValidationService.validate(
 *   extractionResult,
 *   { cityCode: 'HKG', autoCreateCompany: true }
 * );
 * if (result.success) {
 *   console.log(result.result.resolvedCompanyId);
 * }
 * ```
 */
export class ResultValidationService {
  /**
   * 驗證提取結果
   *
   * @param extractionResult - GPT 提取結果
   * @param options - 驗證選項
   * @returns 驗證服務結果
   */
  static async validate(
    extractionResult: UnifiedExtractionResult,
    options: ValidationOptions
  ): Promise<ValidationServiceResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingRequiredFields: string[] = [];
    const jitCreated: JitCreatedV3 = {};

    try {
      // 1. Schema 驗證
      const schemaValidation = this.validateSchema(extractionResult);
      if (!schemaValidation.success) {
        errors.push(...schemaValidation.errors);
      }
      warnings.push(...schemaValidation.warnings);

      // 2. 欄位驗證
      const fieldValidation = this.validateFields(extractionResult);
      missingRequiredFields.push(...fieldValidation.missingRequired);
      warnings.push(...fieldValidation.warnings);

      // 3. 解析公司 ID
      const companyResolution = await this.resolveCompany(
        extractionResult.issuerIdentification,
        options
      );
      if (companyResolution.isNewCompany && options.autoCreateCompany !== false) {
        jitCreated.company = true;
      }

      // 4. 解析格式 ID
      const formatResolution = await this.resolveFormat(
        extractionResult.formatIdentification,
        companyResolution.companyId,
        options
      );
      if (formatResolution.isNewFormat && options.autoCreateFormat !== false) {
        jitCreated.format = true;
      }

      // 5. 構建驗證結果
      const validationResult: ValidationResultV3 = {
        isValid: errors.length === 0,
        errors,
        warnings,
        missingRequiredFields,
      };

      // 6. 構建完整的驗證後結果
      const validatedResult: ValidatedExtractionResult = {
        ...extractionResult,
        resolvedCompanyId: companyResolution.companyId,
        resolvedFormatId: formatResolution.formatId,
        validation: validationResult,
        jitCreated: Object.keys(jitCreated).length > 0 ? jitCreated : undefined,
      };

      return {
        success: true,
        result: validatedResult,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '驗證過程發生未知錯誤',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Schema 驗證
   */
  private static validateSchema(
    result: UnifiedExtractionResult
  ): { success: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      extractionResultSchema.parse(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          const path = issue.path.join('.');
          const message = `${path}: ${issue.message}`;

          // 區分錯誤和警告
          if (issue.path[0] === 'standardFields' && ['dueDate', 'customerName', 'subtotal'].includes(issue.path[1] as string)) {
            warnings.push(message);
          } else {
            errors.push(message);
          }
        }
      } else {
        errors.push('Schema 驗證失敗');
      }
    }

    return { success: errors.length === 0, errors, warnings };
  }

  /**
   * 欄位驗證
   */
  private static validateFields(
    result: UnifiedExtractionResult
  ): { missingRequired: string[]; warnings: string[] } {
    const missingRequired: string[] = [];
    const warnings: string[] = [];

    const requiredFields = ['invoiceNumber', 'invoiceDate', 'vendorName', 'totalAmount', 'currency'];

    for (const fieldKey of requiredFields) {
      const field = result.standardFields[fieldKey as keyof typeof result.standardFields];
      if (!field || field.value === null || field.value === '') {
        missingRequired.push(fieldKey);
      }
    }

    // 檢查信心度過低的欄位
    for (const [key, field] of Object.entries(result.standardFields)) {
      if (field && field.confidence < 50) {
        warnings.push(`欄位 ${key} 信心度過低 (${field.confidence}%)`);
      }
    }

    // 檢查需要人工分類的行項目
    const itemsNeedingClassification = result.lineItems.filter(
      (item) => item.needsClassification
    );
    if (itemsNeedingClassification.length > 0) {
      warnings.push(
        `${itemsNeedingClassification.length} 個行項目需要人工分類`
      );
    }

    return { missingRequired, warnings };
  }

  /**
   * 解析公司 ID
   */
  private static async resolveCompany(
    issuerIdentification: UnifiedExtractionResult['issuerIdentification'],
    options: ValidationOptions
  ): Promise<CompanyResolutionResult> {
    // 如果已有 companyId，直接使用
    if (issuerIdentification.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: issuerIdentification.companyId },
        select: { id: true, name: true },
      });

      if (company) {
        return {
          companyId: company.id,
          companyName: company.name,
          isNewCompany: false,
        };
      }
    }

    // 嘗試按名稱匹配
    const matchedCompany = await prisma.company.findFirst({
      where: {
        OR: [
          { name: { equals: issuerIdentification.companyName, mode: 'insensitive' } },
          { nameVariants: { has: issuerIdentification.companyName } },
        ],
        status: 'ACTIVE',
      },
      select: { id: true, name: true },
    });

    if (matchedCompany) {
      return {
        companyId: matchedCompany.id,
        companyName: matchedCompany.name,
        isNewCompany: false,
      };
    }

    // JIT 創建新公司
    if (options.autoCreateCompany !== false) {
      // 獲取系統用戶 ID（用於 createdById）
      const systemUser = await prisma.user.findFirst({
        where: { email: 'system@ipa.local' },
        select: { id: true },
      });
      const createdById = systemUser?.id || 'system';

      const newCompany = await prisma.company.create({
        data: {
          name: issuerIdentification.companyName,
          displayName: issuerIdentification.companyName,
          status: 'ACTIVE',
          nameVariants: [],
          identificationPatterns: [],
          source: 'AUTO_CREATED',
          createdById,
        },
        select: { id: true, name: true },
      });

      return {
        companyId: newCompany.id,
        companyName: newCompany.name,
        isNewCompany: true,
      };
    }

    // 無法解析，使用佔位符
    throw new Error(`無法解析公司: ${issuerIdentification.companyName}`);
  }

  /**
   * 解析格式 ID
   */
  private static async resolveFormat(
    formatIdentification: UnifiedExtractionResult['formatIdentification'],
    companyId: string,
    options: ValidationOptions
  ): Promise<FormatResolutionResult> {
    // 如果已有 formatId，直接使用
    if (formatIdentification.formatId) {
      const format = await prisma.documentFormat.findUnique({
        where: { id: formatIdentification.formatId },
        select: { id: true, name: true },
      });

      if (format) {
        return {
          formatId: format.id,
          formatName: format.name ?? formatIdentification.formatName,
          isNewFormat: false,
        };
      }
    }

    // 嘗試按名稱匹配
    const matchedFormat = await prisma.documentFormat.findFirst({
      where: {
        name: { equals: formatIdentification.formatName, mode: 'insensitive' },
        companyId,
      },
      select: { id: true, name: true },
    });

    if (matchedFormat) {
      return {
        formatId: matchedFormat.id,
        formatName: matchedFormat.name ?? formatIdentification.formatName,
        isNewFormat: false,
      };
    }

    // JIT 創建新格式
    if (options.autoCreateFormat !== false && formatIdentification.formatName) {
      const newFormat = await prisma.documentFormat.create({
        data: {
          name: formatIdentification.formatName,
          companyId,
          documentType: 'INVOICE',
          documentSubtype: 'GENERAL',
          features: {
            autoCreated: true,
            createdAt: new Date().toISOString(),
          },
        },
        select: { id: true, name: true },
      });

      return {
        formatId: newFormat.id,
        formatName: newFormat.name ?? formatIdentification.formatName,
        isNewFormat: true,
      };
    }

    // 格式可選，返回無格式
    return {
      formatId: undefined,
      formatName: formatIdentification.formatName || 'Unknown',
      isNewFormat: formatIdentification.isNewFormat,
    };
  }

  /**
   * 日期格式驗證
   */
  static isValidDateFormat(value: string | null | undefined): boolean {
    if (!value) return false;
    // ISO 8601 格式
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    // 常見日期格式
    const commonPatterns = [
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
      /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    ];

    return (
      isoPattern.test(value) ||
      commonPatterns.some((pattern) => pattern.test(value))
    );
  }

  /**
   * 金額格式驗證
   */
  static isValidCurrencyAmount(value: string | number | null | undefined): boolean {
    if (value === null || value === undefined) return false;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(numValue) && numValue >= 0;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 快速驗證提取結果
 */
export async function validateExtractionResult(
  result: UnifiedExtractionResult,
  options: ValidationOptions
): Promise<ValidationServiceResult> {
  return ResultValidationService.validate(result, options);
}

/**
 * 驗證日期格式
 */
export function isValidDateFormat(value: string | null | undefined): boolean {
  return ResultValidationService.isValidDateFormat(value);
}

/**
 * 驗證金額格式
 */
export function isValidCurrencyAmount(
  value: string | number | null | undefined
): boolean {
  return ResultValidationService.isValidCurrencyAmount(value);
}
