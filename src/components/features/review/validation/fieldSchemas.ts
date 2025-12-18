/**
 * @fileoverview 欄位驗證 Schema 定義
 * @description
 *   定義各種欄位類型的 Zod 驗證規則，用於即時驗證欄位輸入。
 *   支援日期、數字、金額、貨櫃號等常見格式。
 *
 * @module src/components/features/review/validation/fieldSchemas
 * @since Epic 3 - Story 3.5 (修正提取結果)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 日期格式驗證 (YYYY-MM-DD)
 *   - 數字和金額格式驗證
 *   - 貨櫃號、提單號格式驗證
 *   - 自動欄位類型映射
 */

import { z } from 'zod'

// ============================================================
// Basic Validators
// ============================================================

/**
 * 欄位驗證器集合
 */
export const fieldValidators = {
  /**
   * 日期格式驗證
   * @description 驗證 YYYY-MM-DD 格式
   */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必須為 YYYY-MM-DD')
    .refine((val) => !isNaN(Date.parse(val)), '無效的日期'),

  /**
   * 數字格式驗證
   * @description 驗證整數或小數
   */
  number: z.string().regex(/^-?\d+(\.\d+)?$/, '必須為有效數字'),

  /**
   * 金額格式驗證
   * @description 支援千分位和兩位小數
   */
  currency: z.string().regex(/^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d+(\.\d{1,2})?$/, '金額格式無效'),

  /**
   * 必填欄位驗證
   */
  required: z.string().min(1, '此欄位為必填'),

  /**
   * 貨櫃號格式驗證
   * @description 格式：4 字母 + 7 數字
   */
  containerNumber: z.string().regex(/^[A-Z]{4}\d{7}$/, '貨櫃號格式為 4 大寫字母 + 7 數字'),

  /**
   * 提單號格式驗證
   */
  blNumber: z.string().min(1, '提單號不可為空').max(50, '提單號過長'),

  /**
   * Email 格式驗證
   */
  email: z.string().email('Email 格式無效'),

  /**
   * 通用文本驗證
   */
  text: z.string().max(500, '超過最大長度限制'),

  /**
   * 可選文本驗證
   * @description 允許空字串
   */
  optionalText: z.string().max(500, '超過最大長度限制'),
}

// ============================================================
// Field Type Mapping
// ============================================================

/**
 * 欄位名稱到驗證類型的映射
 */
export const fieldTypeMap: Record<string, keyof typeof fieldValidators> = {
  // 日期欄位
  invoiceDate: 'date',
  dueDate: 'date',
  shippingDate: 'date',
  arrivalDate: 'date',
  etd: 'date',
  eta: 'date',

  // 金額欄位
  totalAmount: 'currency',
  subTotal: 'currency',
  taxAmount: 'currency',
  freight: 'currency',
  insurance: 'currency',

  // 數字欄位
  quantity: 'number',
  weight: 'number',
  volume: 'number',

  // 格式化欄位
  containerNumber: 'containerNumber',
  blNumber: 'blNumber',
  email: 'email',

  // 必填欄位
  invoiceNumber: 'required',
  forwarderName: 'required',

  // 文本欄位
  shipperName: 'text',
  consigneeName: 'text',
  vesselName: 'text',
  voyageNumber: 'text',
  portOfLoading: 'text',
  portOfDischarge: 'text',
  description: 'optionalText',
  remarks: 'optionalText',
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取欄位驗證器
 *
 * @param fieldName - 欄位名稱
 * @returns Zod 驗證器
 *
 * @example
 * ```typescript
 * const validator = getFieldValidator('invoiceDate')
 * validator.parse('2024-01-15') // OK
 * validator.parse('15/01/2024') // Throws
 * ```
 */
export function getFieldValidator(fieldName: string): z.ZodString {
  const type = fieldTypeMap[fieldName] || 'optionalText'
  return fieldValidators[type]
}

/**
 * 驗證欄位值
 *
 * @param fieldName - 欄位名稱
 * @param value - 欄位值
 * @returns 驗證結果 { valid, error? }
 *
 * @example
 * ```typescript
 * const result = validateFieldValue('invoiceDate', '2024-01-15')
 * // { valid: true }
 *
 * const result = validateFieldValue('invoiceDate', 'invalid')
 * // { valid: false, error: '日期格式必須為 YYYY-MM-DD' }
 * ```
 */
export function validateFieldValue(
  fieldName: string,
  value: string
): { valid: boolean; error?: string } {
  // 空值對於可選欄位是允許的
  if (value === '' || value === null || value === undefined) {
    const type = fieldTypeMap[fieldName]
    if (type === 'required') {
      return { valid: false, error: '此欄位為必填' }
    }
    return { valid: true }
  }

  try {
    const validator = getFieldValidator(fieldName)
    validator.parse(value)
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues[0]?.message ?? '驗證失敗' }
    }
    return { valid: false, error: '驗證失敗' }
  }
}

/**
 * 批量驗證欄位
 *
 * @param fields - 欄位名稱和值的映射
 * @returns 驗證結果映射
 */
export function validateFields(
  fields: Record<string, string>
): Record<string, { valid: boolean; error?: string }> {
  const results: Record<string, { valid: boolean; error?: string }> = {}

  for (const [fieldName, value] of Object.entries(fields)) {
    results[fieldName] = validateFieldValue(fieldName, value)
  }

  return results
}

/**
 * 獲取欄位類型
 *
 * @param fieldName - 欄位名稱
 * @returns 欄位類型
 */
export function getFieldType(fieldName: string): keyof typeof fieldValidators {
  return fieldTypeMap[fieldName] || 'optionalText'
}

/**
 * 檢查欄位是否為必填
 *
 * @param fieldName - 欄位名稱
 * @returns 是否必填
 */
export function isRequiredField(fieldName: string): boolean {
  return fieldTypeMap[fieldName] === 'required'
}
