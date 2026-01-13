/**
 * @fileoverview 來源欄位服務
 * @description
 *   提供動態來源欄位列表，合併：
 *   - 標準欄位（invoice-fields.ts 的 90+ 欄位）
 *   - 提取欄位（GPT 提取結果的欄位）
 *   - 自訂欄位（用戶手動輸入的欄位）
 *
 * @module src/services/mapping
 * @since Epic 16 - Story 16.6
 * @lastModified 2026-01-13
 *
 * @features
 *   - 取得標準發票欄位列表
 *   - 動態合併 GPT 提取欄位
 *   - 分組顯示欄位
 *   - 欄位搜尋功能
 *   - 欄位名稱驗證
 *
 * @dependencies
 *   - @/types/invoice-fields - 標準欄位定義
 */

import {
  INVOICE_FIELDS,
  FIELD_CATEGORIES,
  type FieldCategory,
  type InvoiceFieldDefinition,
} from '@/types/invoice-fields';

// ============================================================================
// Types
// ============================================================================

/**
 * 來源欄位選項
 * @description 用於 UI 下拉選單的欄位選項結構
 */
export interface SourceFieldOption {
  /** 欄位名稱（唯一識別符） */
  name: string;
  /** 顯示標籤 */
  label: string;
  /** 分類 */
  category: string;
  /** 來源類型 */
  source: 'standard' | 'extracted' | 'custom';
  /** 資料類型（標準欄位有） */
  dataType?: string;
  /** 是否必填（標準欄位有） */
  isRequired?: boolean;
  /** 欄位別名（標準欄位有） */
  aliases?: string[];
}

/**
 * 分組的來源欄位選項
 * @description 按類別分組的欄位結構，用於 UI 分組顯示
 */
export interface GroupedSourceFields {
  [category: string]: SourceFieldOption[];
}

/**
 * 提取欄位資訊
 * @description 從 GPT 提取結果取得的欄位資訊
 */
export interface ExtractedFieldInfo {
  /** 欄位名稱 */
  name: string;
  /** 出現次數 */
  occurrences: number;
  /** 樣本值（最多 3 個） */
  sampleValues: (string | number | null)[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 分類顯示名稱（中文）
 * @description 用於 UI 顯示的分類標籤
 */
export const CATEGORY_LABELS: Record<FieldCategory | 'extracted' | 'custom', string> = {
  basic: '基本資訊',
  shipper: '發貨人資訊',
  consignee: '收貨人資訊',
  shipping: '運輸資訊',
  package: '包裝資訊',
  charges: '費用明細',
  reference: '參考編號',
  payment: '付款資訊',
  extracted: '提取欄位',
  custom: '自訂欄位',
};

/**
 * 分類排序順序
 * @description 定義分類在 UI 中的顯示順序
 */
export const CATEGORY_ORDER: string[] = [
  'basic',
  'shipper',
  'consignee',
  'shipping',
  'package',
  'charges',
  'reference',
  'payment',
  'extracted',
  'custom',
];

// ============================================================================
// Functions
// ============================================================================

/**
 * 取得標準來源欄位列表
 * @description 從 invoice-fields.ts 獲取所有標準欄位定義
 * @returns 標準欄位選項列表
 */
export function getStandardSourceFields(): SourceFieldOption[] {
  return Object.values(INVOICE_FIELDS).map((field: InvoiceFieldDefinition) => ({
    name: field.name,
    label: field.label,
    category: field.category,
    source: 'standard' as const,
    dataType: field.dataType,
    isRequired: field.isRequired,
    aliases: field.aliases,
  }));
}

/**
 * 取得可用的來源欄位（含提取欄位）
 * @description 合併標準欄位和 GPT 提取的動態欄位
 * @param extractedData GPT 提取的數據（可選）
 * @returns 合併後的欄位選項列表
 */
export function getAvailableSourceFields(
  extractedData?: Record<string, unknown>
): SourceFieldOption[] {
  const fields: SourceFieldOption[] = [];

  // 1. 標準欄位 (invoice-fields.ts)
  fields.push(...getStandardSourceFields());

  // 2. 提取的欄位 (從 GPT 結果)
  if (extractedData) {
    const standardNames = new Set(fields.map((f) => f.name));

    for (const key of Object.keys(extractedData)) {
      // 跳過已存在的標準欄位
      if (standardNames.has(key)) {
        continue;
      }
      // 跳過系統內部欄位
      if (key.startsWith('_') || key === 'confidence') {
        continue;
      }

      fields.push({
        name: key,
        label: formatExtractedFieldLabel(key),
        category: 'extracted',
        source: 'extracted',
      });
    }
  }

  return fields;
}

/**
 * 取得分組的來源欄位
 * @description 將欄位按類別分組，用於 UI 分組顯示
 * @param extractedData GPT 提取的數據（可選）
 * @returns 按類別分組的欄位
 */
export function getGroupedSourceFields(
  extractedData?: Record<string, unknown>
): GroupedSourceFields {
  const fields = getAvailableSourceFields(extractedData);
  const grouped: GroupedSourceFields = {};

  for (const field of fields) {
    const category = field.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(field);
  }

  // 按預定義順序排序
  const result: GroupedSourceFields = {};
  for (const cat of CATEGORY_ORDER) {
    if (grouped[cat] && grouped[cat].length > 0) {
      result[cat] = grouped[cat];
    }
  }

  return result;
}

/**
 * 格式化提取欄位的標籤
 * @description 將欄位名稱轉換為人類可讀的標籤
 * @param fieldName 欄位名稱（snake_case 或 camelCase）
 * @returns 格式化後的標籤
 */
export function formatExtractedFieldLabel(fieldName: string): string {
  // 將 snake_case 或 camelCase 轉換為空格分隔
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase());
}

/**
 * 搜尋欄位（用於 Combobox）
 * @description 根據關鍵字過濾欄位列表
 * @param query 搜尋關鍵字
 * @param fields 欄位列表
 * @returns 過濾後的欄位列表
 */
export function searchFields(
  query: string,
  fields: SourceFieldOption[]
): SourceFieldOption[] {
  if (!query) {
    return fields;
  }

  const lowerQuery = query.toLowerCase();
  return fields.filter(
    (f) =>
      f.name.toLowerCase().includes(lowerQuery) ||
      f.label.toLowerCase().includes(lowerQuery) ||
      f.aliases?.some((alias) => alias.toLowerCase().includes(lowerQuery))
  );
}

/**
 * 驗證欄位名稱是否有效
 * @description 檢查欄位名稱是否符合命名規則
 * @param name 欄位名稱
 * @returns 是否有效
 */
export function isValidFieldName(name: string): boolean {
  // 允許字母、數字、底線，不能以數字開頭
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * 建立自訂欄位選項
 * @description 創建一個自訂欄位的選項結構
 * @param name 欄位名稱
 * @returns 欄位選項或 null（如果名稱無效）
 */
export function createCustomFieldOption(name: string): SourceFieldOption | null {
  if (!isValidFieldName(name)) {
    return null;
  }

  return {
    name,
    label: formatExtractedFieldLabel(name),
    category: 'custom',
    source: 'custom',
  };
}

/**
 * 根據欄位名稱查找欄位定義
 * @description 在標準欄位中查找指定名稱的欄位
 * @param fieldName 欄位名稱
 * @returns 欄位定義或 undefined
 */
export function findFieldByName(fieldName: string): SourceFieldOption | undefined {
  const standardFields = getStandardSourceFields();
  return standardFields.find(
    (f) => f.name === fieldName || f.aliases?.includes(fieldName.toLowerCase())
  );
}

/**
 * 取得欄位統計資訊
 * @description 獲取標準欄位的統計數據
 * @returns 統計資訊
 */
export function getFieldStatistics(): {
  total: number;
  byCategory: Record<string, number>;
  required: number;
} {
  const standardFields = getStandardSourceFields();
  const byCategory: Record<string, number> = {};
  let required = 0;

  for (const field of standardFields) {
    byCategory[field.category] = (byCategory[field.category] || 0) + 1;
    if (field.isRequired) {
      required++;
    }
  }

  return {
    total: standardFields.length,
    byCategory,
    required,
  };
}
