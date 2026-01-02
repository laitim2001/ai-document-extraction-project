# Story 13-5: 動態欄位映射服務整合

**Status:** backlog

---

## Story

**As a** 系統,
**I want** 在文件提取流程中自動應用正確的欄位映射配置,
**So that** 不同公司和文件格式的發票可以使用適合的欄位映射規則，提高提取準確率。

---

## 背景說明

### 問題陳述

現有的文件提取流程使用固定的欄位映射規則，無法根據不同的：
- **公司 (Company)**: 不同供應商可能使用不同術語
- **文件格式 (DocumentFormat)**: 同一供應商可能有多種發票格式

這導致提取準確率受限，需要動態應用映射配置。

### 目標

整合 Story 13-4 的映射配置 API，使提取流程能夠：
1. 自動識別文件所屬的公司和格式
2. 動態獲取適用的映射配置
3. 應用映射規則轉換提取結果
4. 處理無配置情況的降級策略

### 提取流程改進

```
原有流程:
[文件上傳] → [Azure DI 提取] → [固定映射] → [儲存結果]

改進後流程:
[文件上傳] → [Azure DI 提取] → [識別公司/格式] → [動態獲取映射配置] → [應用映射] → [儲存結果]
                                      ↓
                              [無配置時使用預設映射]
```

---

## Acceptance Criteria

### AC1: 映射配置自動解析

**Given** 文件提取過程中已識別 company 和 documentFormat
**When** 需要應用欄位映射時
**Then**：
  - 自動調用 `resolveFieldMappingConfig()` 獲取適用配置
  - 按優先級順序嘗試：specific > company > format > global
  - 如果無任何配置，使用內建預設映射

### AC2: 欄位轉換引擎

**Given** 已獲得映射配置和原始提取結果
**When** 執行欄位映射時
**Then**：
  - 正確應用 sourceField → targetField 映射
  - 執行配置的轉換規則（formatDate, formatCurrency 等）
  - 處理必填欄位缺失的情況
  - 保留未映射的原始欄位（如需要）

### AC3: 轉換規則執行

**Given** 映射配置包含轉換規則
**When** 執行欄位轉換時
**Then**：
  - `toUpperCase`: 轉為大寫
  - `toLowerCase`: 轉為小寫
  - `formatDate`: 標準化日期格式 (ISO 8601)
  - `formatCurrency`: 標準化金額格式
  - `extractNumber`: 提取數字部分
  - `trim`: 移除前後空白
  - `regex`: 使用預定義的正則表達式模式

### AC4: 錯誤處理與降級

**Given** 映射過程中發生錯誤
**When** 任何映射步驟失敗時
**Then**：
  - 記錄詳細錯誤日誌
  - 降級使用原始欄位值（不轉換）
  - 標記該欄位為「映射失敗」
  - 不影響其他欄位的正常處理
  - 整體流程繼續執行

### AC5: 映射結果審計

**Given** 完成欄位映射
**When** 儲存提取結果時
**Then**：
  - 記錄使用的映射配置 ID
  - 記錄映射來源（specific/company/format/global/default）
  - 記錄每個欄位的轉換狀態
  - 支援後續追蹤和分析

### AC6: 與現有流程整合

**Given** 現有的文件處理流程
**When** 整合動態映射功能時
**Then**：
  - 向後兼容：無映射配置時行為不變
  - 最小化對現有代碼的修改
  - 提供開關控制是否啟用動態映射
  - 不影響處理效能（<100ms 額外延遲）

---

## Tasks / Subtasks

- [ ] **Task 1: 欄位轉換引擎** (AC: #2, #3)
  - [ ] 1.1 創建 `src/services/field-transformation.service.ts`
  - [ ] 1.2 實現內建轉換函數（toUpperCase, formatDate 等）
  - [ ] 1.3 實現正則表達式模式庫（安全預定義模式）
  - [ ] 1.4 創建轉換錯誤處理邏輯

- [ ] **Task 2: 動態映射服務** (AC: #1, #4)
  - [ ] 2.1 創建 `src/services/dynamic-field-mapping.service.ts`
  - [ ] 2.2 整合 `field-mapping-resolver.service.ts`
  - [ ] 2.3 實現預設映射配置
  - [ ] 2.4 實現降級和錯誤處理策略

- [ ] **Task 3: 映射結果模型** (AC: #5)
  - [ ] 3.1 擴展 `ProcessedFile` 模型添加映射元數據
  - [ ] 3.2 創建 `FieldMappingResult` 類型
  - [ ] 3.3 添加審計欄位（配置 ID、來源、狀態）
  - [ ] 3.4 執行資料庫遷移

- [ ] **Task 4: 提取流程整合** (AC: #6)
  - [ ] 4.1 修改 `batch-processor.service.ts` 整合動態映射
  - [ ] 4.2 添加功能開關 `ENABLE_DYNAMIC_FIELD_MAPPING`
  - [ ] 4.3 確保向後兼容性
  - [ ] 4.4 添加效能監控

- [ ] **Task 5: 類型定義更新** (AC: #1-6)
  - [ ] 5.1 更新 `src/types/field-mapping.ts`
  - [ ] 5.2 創建 `src/types/transformation.ts`
  - [ ] 5.3 更新 `src/services/index.ts` 導出

- [ ] **Task 6: 驗證與測試** (AC: #1-6)
  - [ ] 6.1 TypeScript 類型檢查通過
  - [ ] 6.2 ESLint 檢查通過
  - [ ] 6.3 單元測試：轉換函數、映射邏輯
  - [ ] 6.4 整合測試：完整流程
  - [ ] 6.5 效能測試：確認 <100ms 延遲

---

## Dev Notes

### 依賴項

- **Story 13-4**: 映射配置 API（提供配置解析服務）
- **Story 0-8**: 文件發行者識別（提供 company 識別）
- **Story 0-9**: 文件格式識別（提供 documentFormat 識別）

### 欄位轉換引擎

```typescript
// src/services/field-transformation.service.ts

/**
 * @fileoverview 欄位值轉換引擎
 * @description
 *   提供多種內建轉換函數，使用安全的預定義模式
 *   不使用動態代碼執行，確保安全性
 *
 * @module src/services/field-transformation
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 */

import { TransformationType, TransformationResult } from '@/types/transformation';

/**
 * 預定義的正則表達式模式庫
 * 只允許使用這些預定義模式，避免任意代碼執行
 */
const REGEX_PATTERNS: Record<string, RegExp> = {
  extractDigits: /\d+/g,
  extractDecimal: /[-+]?[0-9]*\.?[0-9]+/,
  extractCurrency: /[$€¥£]?\s*[\d,]+\.?\d*/,
  extractDate: /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/,
  removeSpaces: /\s+/g,
  removeNonAlphanumeric: /[^a-zA-Z0-9]/g,
  extractEmail: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  extractPhone: /[\d\s\-().+]+/,
};

/**
 * 轉換函數映射表
 */
const TRANSFORMERS: Record<
  TransformationType,
  (value: unknown, options?: Record<string, unknown>) => unknown
> = {
  none: (value) => value,

  toUpperCase: (value) => {
    if (typeof value !== 'string') return value;
    return value.toUpperCase();
  },

  toLowerCase: (value) => {
    if (typeof value !== 'string') return value;
    return value.toLowerCase();
  },

  trim: (value) => {
    if (typeof value !== 'string') return value;
    return value.trim();
  },

  formatDate: (value, options) => {
    if (!value) return value;

    const date = new Date(value as string);
    if (isNaN(date.getTime())) return value;

    const format = (options?.format as string) || 'ISO';

    switch (format) {
      case 'ISO':
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      case 'US':
        return date.toLocaleDateString('en-US'); // MM/DD/YYYY
      case 'EU':
        return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
      default:
        return date.toISOString().split('T')[0];
    }
  },

  formatCurrency: (value, options) => {
    if (value === null || value === undefined) return value;

    const numValue = typeof value === 'string'
      ? parseFloat(value.replace(/[^0-9.-]/g, ''))
      : Number(value);

    if (isNaN(numValue)) return value;

    const currency = (options?.currency as string) || 'USD';
    const locale = (options?.locale as string) || 'en-US';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(numValue);
  },

  extractNumber: (value) => {
    if (typeof value !== 'string') return value;

    const pattern = REGEX_PATTERNS.extractDecimal;
    const match = value.match(pattern);
    if (!match) return null;

    return parseFloat(match[0]);
  },

  regex: (value, options) => {
    if (typeof value !== 'string') return value;

    // 只允許使用預定義的正則模式
    const patternName = options?.pattern as string;
    if (!patternName || !REGEX_PATTERNS[patternName]) {
      throw new Error(`Invalid regex pattern: ${patternName}. Use predefined patterns only.`);
    }

    const pattern = REGEX_PATTERNS[patternName];
    const match = value.match(pattern);

    if (!match) return null;
    return match[0];
  },

  split: (value, options) => {
    if (typeof value !== 'string') return value;

    const delimiter = (options?.delimiter as string) || ',';
    const index = (options?.index as number) ?? 0;
    const parts = value.split(delimiter);

    return parts[index]?.trim() ?? null;
  },

  replace: (value, options) => {
    if (typeof value !== 'string') return value;

    // 只允許簡單的字符串替換
    const search = options?.search as string;
    const replacement = (options?.replacement as string) || '';

    if (!search) return value;

    return value.split(search).join(replacement);
  },

  concat: (value, options) => {
    if (value === null || value === undefined) return value;

    const prefix = (options?.prefix as string) || '';
    const suffix = (options?.suffix as string) || '';

    return `${prefix}${String(value)}${suffix}`;
  },
};

/**
 * 執行欄位轉換
 */
export function transformFieldValue(
  value: unknown,
  transformationType: TransformationType,
  options?: Record<string, unknown>
): TransformationResult {
  try {
    const transformer = TRANSFORMERS[transformationType];

    if (!transformer) {
      return {
        success: false,
        originalValue: value,
        transformedValue: value,
        error: `Unknown transformation type: ${transformationType}`,
      };
    }

    const transformedValue = transformer(value, options);

    return {
      success: true,
      originalValue: value,
      transformedValue,
      transformationType,
    };
  } catch (error) {
    return {
      success: false,
      originalValue: value,
      transformedValue: value,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 批量轉換多個欄位
 */
export function transformFields(
  fields: Record<string, unknown>,
  mappings: Array<{
    sourceField: string;
    targetField: string;
    transformation: TransformationType;
    transformationOptions?: Record<string, unknown>;
  }>
): Record<string, TransformationResult> {
  const results: Record<string, TransformationResult> = {};

  for (const mapping of mappings) {
    const sourceValue = fields[mapping.sourceField];

    const result = transformFieldValue(
      sourceValue,
      mapping.transformation,
      mapping.transformationOptions
    );

    results[mapping.targetField] = result;
  }

  return results;
}

/**
 * 獲取可用的正則模式列表
 */
export function getAvailableRegexPatterns(): string[] {
  return Object.keys(REGEX_PATTERNS);
}
```

### 動態映射服務

```typescript
// src/services/dynamic-field-mapping.service.ts

/**
 * @fileoverview 動態欄位映射服務
 * @description
 *   整合映射配置解析和欄位轉換，提供完整的動態映射功能
 *
 * @module src/services/dynamic-field-mapping
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 */

import { prisma } from '@/lib/prisma';
import { resolveFieldMappingConfig } from './field-mapping-resolver.service';
import { transformFieldValue } from './field-transformation.service';
import { DEFAULT_FIELD_MAPPINGS } from '@/lib/field-mapping/default-mappings';
import type {
  FieldMappingConfig,
  FieldMapping,
  MappingContext,
  MappingResult,
  FieldMappingAudit,
} from '@/types/field-mapping';

/**
 * 動態應用欄位映射
 *
 * @param extractedData - Azure DI 提取的原始數據
 * @param context - 映射上下文（公司、格式）
 * @returns 映射後的數據和審計資訊
 */
export async function applyDynamicFieldMapping(
  extractedData: Record<string, unknown>,
  context: MappingContext
): Promise<MappingResult> {
  const startTime = Date.now();
  const audit: FieldMappingAudit = {
    configId: null,
    configSource: 'default',
    appliedMappings: [],
    failedMappings: [],
    processingTimeMs: 0,
  };

  try {
    // 1. 嘗試獲取動態映射配置
    const resolvedConfig = await resolveFieldMappingConfig({
      companyId: context.companyId,
      documentFormatId: context.documentFormatId,
    });

    let mappings: FieldMapping[];

    if (resolvedConfig) {
      // 使用動態配置
      mappings = resolvedConfig.config.mappings as FieldMapping[];
      audit.configId = resolvedConfig.config.id;
      audit.configSource = resolvedConfig.source;
    } else {
      // 降級使用預設映射
      mappings = DEFAULT_FIELD_MAPPINGS;
      audit.configSource = 'default';
    }

    // 2. 執行欄位映射和轉換
    const mappedData: Record<string, unknown> = {};

    for (const mapping of mappings) {
      const sourceValue = getNestedValue(extractedData, mapping.sourceField);

      // 處理缺失的必填欄位
      if (sourceValue === undefined || sourceValue === null) {
        if (mapping.isRequired) {
          if (mapping.defaultValue !== undefined) {
            // 使用預設值
            mappedData[mapping.targetField] = mapping.defaultValue;
            audit.appliedMappings.push({
              sourceField: mapping.sourceField,
              targetField: mapping.targetField,
              status: 'default_value',
            });
          } else {
            // 記錄缺失的必填欄位
            audit.failedMappings.push({
              sourceField: mapping.sourceField,
              targetField: mapping.targetField,
              status: 'missing_required',
              error: '必填欄位缺失且無預設值',
            });
          }
        }
        continue;
      }

      // 執行轉換
      const result = transformFieldValue(
        sourceValue,
        mapping.transformation || 'none',
        mapping.transformationOptions
      );

      if (result.success) {
        mappedData[mapping.targetField] = result.transformedValue;
        audit.appliedMappings.push({
          sourceField: mapping.sourceField,
          targetField: mapping.targetField,
          status: 'success',
          originalValue: result.originalValue,
          transformedValue: result.transformedValue,
        });
      } else {
        // 轉換失敗，使用原始值
        mappedData[mapping.targetField] = sourceValue;
        audit.failedMappings.push({
          sourceField: mapping.sourceField,
          targetField: mapping.targetField,
          status: 'transformation_failed',
          error: result.error,
        });
      }
    }

    // 3. 保留未映射的原始欄位（可選）
    if (context.preserveUnmappedFields) {
      const mappedSourceFields = new Set(mappings.map(m => m.sourceField));

      for (const [key, value] of Object.entries(extractedData)) {
        if (!mappedSourceFields.has(key) && !(key in mappedData)) {
          mappedData[`_original_${key}`] = value;
        }
      }
    }

    audit.processingTimeMs = Date.now() - startTime;

    return {
      success: true,
      data: mappedData,
      audit,
    };

  } catch (error) {
    audit.processingTimeMs = Date.now() - startTime;

    // 完全降級：返回原始數據
    console.error('Dynamic field mapping failed:', error);

    return {
      success: false,
      data: extractedData,
      audit: {
        ...audit,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * 獲取嵌套對象的值
 * 支援 dot notation: "invoice.items[0].description"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(/[.\[\]]+/).filter(Boolean);

  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 處理行項目（Line Items）的映射
 * 行項目是數組，需要對每個項目應用映射
 */
export async function applyLineItemMapping(
  lineItems: Array<Record<string, unknown>>,
  context: MappingContext
): Promise<Array<Record<string, unknown>>> {
  // 獲取行項目專用的映射配置
  const resolvedConfig = await resolveFieldMappingConfig({
    companyId: context.companyId,
    documentFormatId: context.documentFormatId,
  });

  const lineItemMappings = resolvedConfig
    ? (resolvedConfig.config.mappings as FieldMapping[]).filter(m => m.isLineItem)
    : DEFAULT_FIELD_MAPPINGS.filter(m => m.isLineItem);

  if (lineItemMappings.length === 0) {
    return lineItems;
  }

  return lineItems.map(item => {
    const mappedItem: Record<string, unknown> = {};

    for (const mapping of lineItemMappings) {
      const sourceValue = item[mapping.sourceField];

      if (sourceValue !== undefined && sourceValue !== null) {
        const result = transformFieldValue(
          sourceValue,
          mapping.transformation || 'none'
        );

        mappedItem[mapping.targetField] = result.success
          ? result.transformedValue
          : sourceValue;
      } else if (mapping.defaultValue !== undefined) {
        mappedItem[mapping.targetField] = mapping.defaultValue;
      }
    }

    return mappedItem;
  });
}
```

### 預設映射配置

```typescript
// src/lib/field-mapping/default-mappings.ts

/**
 * @fileoverview 預設欄位映射配置
 * @description
 *   當沒有特定映射配置時使用的預設映射規則
 *   基於 Azure Document Intelligence prebuilt-invoice 模型
 *
 * @module src/lib/field-mapping/default-mappings
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 */

import type { FieldMapping } from '@/types/field-mapping';

/**
 * Invoice 主體欄位的預設映射
 */
export const DEFAULT_INVOICE_MAPPINGS: FieldMapping[] = [
  // 發票基本資訊
  {
    id: 'default-invoice-id',
    sourceField: 'InvoiceId',
    targetField: 'invoiceNumber',
    isRequired: true,
    transformation: 'trim',
    isLineItem: false,
  },
  {
    id: 'default-invoice-date',
    sourceField: 'InvoiceDate',
    targetField: 'invoiceDate',
    isRequired: true,
    transformation: 'formatDate',
    transformationOptions: { format: 'ISO' },
    isLineItem: false,
  },
  {
    id: 'default-due-date',
    sourceField: 'DueDate',
    targetField: 'dueDate',
    isRequired: false,
    transformation: 'formatDate',
    transformationOptions: { format: 'ISO' },
    isLineItem: false,
  },

  // 供應商資訊
  {
    id: 'default-vendor-name',
    sourceField: 'VendorName',
    targetField: 'vendorName',
    isRequired: true,
    transformation: 'trim',
    isLineItem: false,
  },
  {
    id: 'default-vendor-address',
    sourceField: 'VendorAddress',
    targetField: 'vendorAddress',
    isRequired: false,
    transformation: 'trim',
    isLineItem: false,
  },
  {
    id: 'default-vendor-tax-id',
    sourceField: 'VendorTaxId',
    targetField: 'vendorTaxId',
    isRequired: false,
    transformation: 'trim',
    isLineItem: false,
  },

  // 客戶資訊
  {
    id: 'default-customer-name',
    sourceField: 'CustomerName',
    targetField: 'customerName',
    isRequired: false,
    transformation: 'trim',
    isLineItem: false,
  },
  {
    id: 'default-customer-address',
    sourceField: 'CustomerAddress',
    targetField: 'customerAddress',
    isRequired: false,
    transformation: 'trim',
    isLineItem: false,
  },
  {
    id: 'default-billing-address',
    sourceField: 'BillingAddress',
    targetField: 'billingAddress',
    isRequired: false,
    transformation: 'trim',
    isLineItem: false,
  },
  {
    id: 'default-shipping-address',
    sourceField: 'ShippingAddress',
    targetField: 'shippingAddress',
    isRequired: false,
    transformation: 'trim',
    isLineItem: false,
  },

  // 金額資訊
  {
    id: 'default-subtotal',
    sourceField: 'SubTotal',
    targetField: 'subtotal',
    isRequired: false,
    transformation: 'extractNumber',
    isLineItem: false,
  },
  {
    id: 'default-total-tax',
    sourceField: 'TotalTax',
    targetField: 'totalTax',
    isRequired: false,
    transformation: 'extractNumber',
    isLineItem: false,
  },
  {
    id: 'default-invoice-total',
    sourceField: 'InvoiceTotal',
    targetField: 'invoiceTotal',
    isRequired: true,
    transformation: 'extractNumber',
    isLineItem: false,
  },
  {
    id: 'default-amount-due',
    sourceField: 'AmountDue',
    targetField: 'amountDue',
    isRequired: false,
    transformation: 'extractNumber',
    isLineItem: false,
  },

  // 付款資訊
  {
    id: 'default-payment-term',
    sourceField: 'PaymentTerm',
    targetField: 'paymentTerms',
    isRequired: false,
    transformation: 'trim',
    isLineItem: false,
  },
  {
    id: 'default-purchase-order',
    sourceField: 'PurchaseOrder',
    targetField: 'purchaseOrderNumber',
    isRequired: false,
    transformation: 'trim',
    isLineItem: false,
  },
];

/**
 * Line Item 欄位的預設映射
 */
export const DEFAULT_LINE_ITEM_MAPPINGS: FieldMapping[] = [
  {
    id: 'default-item-description',
    sourceField: 'Description',
    targetField: 'description',
    isRequired: true,
    transformation: 'trim',
    isLineItem: true,
  },
  {
    id: 'default-item-quantity',
    sourceField: 'Quantity',
    targetField: 'quantity',
    isRequired: false,
    transformation: 'extractNumber',
    defaultValue: 1,
    isLineItem: true,
  },
  {
    id: 'default-item-unit',
    sourceField: 'Unit',
    targetField: 'unit',
    isRequired: false,
    transformation: 'trim',
    isLineItem: true,
  },
  {
    id: 'default-item-unit-price',
    sourceField: 'UnitPrice',
    targetField: 'unitPrice',
    isRequired: false,
    transformation: 'extractNumber',
    isLineItem: true,
  },
  {
    id: 'default-item-amount',
    sourceField: 'Amount',
    targetField: 'amount',
    isRequired: true,
    transformation: 'extractNumber',
    isLineItem: true,
  },
  {
    id: 'default-item-product-code',
    sourceField: 'ProductCode',
    targetField: 'productCode',
    isRequired: false,
    transformation: 'trim',
    isLineItem: true,
  },
  {
    id: 'default-item-tax',
    sourceField: 'Tax',
    targetField: 'tax',
    isRequired: false,
    transformation: 'extractNumber',
    isLineItem: true,
  },
  {
    id: 'default-item-date',
    sourceField: 'Date',
    targetField: 'serviceDate',
    isRequired: false,
    transformation: 'formatDate',
    isLineItem: true,
  },
];

/**
 * 完整的預設映射配置
 */
export const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  ...DEFAULT_INVOICE_MAPPINGS,
  ...DEFAULT_LINE_ITEM_MAPPINGS,
];
```

### 類型定義

```typescript
// src/types/field-mapping.ts

/**
 * 轉換類型
 */
export type TransformationType =
  | 'none'
  | 'toUpperCase'
  | 'toLowerCase'
  | 'trim'
  | 'formatDate'
  | 'formatCurrency'
  | 'extractNumber'
  | 'regex'
  | 'split'
  | 'replace'
  | 'concat';

/**
 * 單個欄位映射定義
 */
export interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  isRequired: boolean;
  defaultValue?: unknown;
  transformation: TransformationType;
  transformationOptions?: Record<string, unknown>;
  isLineItem: boolean;
}

/**
 * 映射上下文
 */
export interface MappingContext {
  companyId?: string;
  documentFormatId?: string;
  preserveUnmappedFields?: boolean;
}

/**
 * 映射配置來源
 */
export type ConfigSource = 'specific' | 'company' | 'format' | 'global' | 'default';

/**
 * 單個欄位的映射記錄
 */
export interface AppliedMapping {
  sourceField: string;
  targetField: string;
  status: 'success' | 'default_value';
  originalValue?: unknown;
  transformedValue?: unknown;
}

/**
 * 映射失敗記錄
 */
export interface FailedMapping {
  sourceField: string;
  targetField: string;
  status: 'missing_required' | 'transformation_failed';
  error?: string;
}

/**
 * 映射審計資訊
 */
export interface FieldMappingAudit {
  configId: string | null;
  configSource: ConfigSource;
  appliedMappings: AppliedMapping[];
  failedMappings: FailedMapping[];
  processingTimeMs: number;
  error?: string;
}

/**
 * 映射結果
 */
export interface MappingResult {
  success: boolean;
  data: Record<string, unknown>;
  audit: FieldMappingAudit;
}
```

```typescript
// src/types/transformation.ts

/**
 * 轉換結果
 */
export interface TransformationResult {
  success: boolean;
  originalValue: unknown;
  transformedValue: unknown;
  transformationType?: string;
  error?: string;
}
```

### 資料庫擴展

```prisma
// 在 ProcessedFile 模型中添加映射審計欄位

model ProcessedFile {
  // ... 現有欄位 ...

  // 映射審計資訊
  mappingConfigId    String?  @map("mapping_config_id")
  mappingConfigSource String? @map("mapping_config_source")  // specific/company/format/global/default
  mappingAudit       Json?    @map("mapping_audit")          // FieldMappingAudit

  mappingConfig      FieldMappingConfig? @relation(fields: [mappingConfigId], references: [id])
}
```

### 整合到處理流程

```typescript
// src/services/batch-processor.service.ts 修改示例

import { applyDynamicFieldMapping } from './dynamic-field-mapping.service';

// 在處理文件時整合動態映射
async function processFile(file: ProcessedFile) {
  // ... 現有的 Azure DI 提取邏輯 ...

  // 獲取提取結果
  const extractedData = await extractWithAzureDI(file);

  // 檢查是否啟用動態映射
  const enableDynamicMapping = process.env.ENABLE_DYNAMIC_FIELD_MAPPING === 'true';

  let finalData = extractedData;
  let mappingAudit: FieldMappingAudit | null = null;

  if (enableDynamicMapping) {
    // 應用動態欄位映射
    const mappingResult = await applyDynamicFieldMapping(extractedData, {
      companyId: file.identifiedCompanyId,
      documentFormatId: file.documentFormatId,
      preserveUnmappedFields: true,
    });

    finalData = mappingResult.data;
    mappingAudit = mappingResult.audit;
  }

  // 儲存結果，包含映射審計資訊
  await prisma.processedFile.update({
    where: { id: file.id },
    data: {
      invoiceData: finalData,
      mappingConfigId: mappingAudit?.configId,
      mappingConfigSource: mappingAudit?.configSource,
      mappingAudit: mappingAudit ? JSON.stringify(mappingAudit) : null,
    },
  });
}
```

### 技術考量

1. **安全性**
   - 不使用動態代碼執行（無 eval、無 Function constructor）
   - 只允許預定義的正則表達式模式
   - 所有轉換函數都是純函數
   - 輸入驗證和類型檢查

2. **效能優化**
   - 配置解析結果緩存（避免重複查詢）
   - 轉換函數是同步的純函數
   - 批量處理時共享配置上下文

3. **可靠性**
   - 完整的錯誤處理
   - 降級策略
   - 詳細的審計日誌

4. **可測試性**
   - 純函數設計
   - 依賴注入
   - Mock 友好

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 13-5 |
| Story Key | 13-5-dynamic-field-mapping-integration |
| Epic | Epic 13: 欄位映射配置介面 |
| Dependencies | Story 13-4, Story 0-8, Story 0-9 |
| Estimated Points | 8 |

---

*Story created: 2026-01-02*
*Status: backlog*
