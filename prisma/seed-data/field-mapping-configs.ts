/**
 * @fileoverview FieldMappingConfig Seed 數據
 * @description
 *   提供 1 個 GLOBAL scope 的預設欄位映射配置，確保四層配置繼承中
 *   的映射配置層有預設值。
 *
 *   包含基礎的 sourceField → targetField 映射規則，
 *   對應 DataTemplate "ERP Standard Export" 的欄位。
 *
 * @module prisma/seed-data/field-mapping-configs
 * @since CHANGE-039
 * @lastModified 2026-02-13
 */

export interface FieldMappingRuleSeed {
  sourceFields: string[]
  targetField: string
  transformType: string
  transformParams: Record<string, unknown> | null
  priority: number
  isActive: boolean
  description: string
}

export interface FieldMappingConfigSeed {
  scope: string
  name: string
  description: string
  isActive: boolean
  version: number
  dataTemplateId: string | null
  rules: FieldMappingRuleSeed[]
}

/**
 * 1 個 GLOBAL 預設欄位映射配置
 *
 * 注意: FieldMappingConfig 的 unique 約束為 [scope, companyId, documentFormatId]，
 * GLOBAL scope 加 null companyId + null documentFormatId 確保唯一。
 */
export const FIELD_MAPPING_CONFIG_SEEDS: FieldMappingConfigSeed[] = [
  {
    scope: 'GLOBAL',
    name: 'Default Global Mapping',
    description: '全局預設欄位映射配置，適用於所有公司和格式。將提取欄位直接映射到 ERP 標準匯入格式。',
    isActive: true,
    version: 1,
    dataTemplateId: 'erp-standard-import',
    rules: [
      {
        sourceFields: ['invoice_number'],
        targetField: 'invoice_number',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 1,
        isActive: true,
        description: '發票號碼直接映射',
      },
      {
        sourceFields: ['invoice_date'],
        targetField: 'invoice_date',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 2,
        isActive: true,
        description: '發票日期直接映射',
      },
      {
        sourceFields: ['vendor_code', 'supplier_code'],
        targetField: 'vendor_code',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 3,
        isActive: true,
        description: '供應商代碼映射（支援多來源欄位名稱）',
      },
      {
        sourceFields: ['vendor_name', 'supplier_name', 'company_name'],
        targetField: 'vendor_name',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 4,
        isActive: true,
        description: '供應商名稱映射（支援多來源欄位名稱）',
      },
      {
        sourceFields: ['currency', 'currency_code'],
        targetField: 'currency',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 5,
        isActive: true,
        description: '幣別映射',
      },
      {
        sourceFields: ['subtotal', 'sub_total'],
        targetField: 'subtotal',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 6,
        isActive: true,
        description: '小計映射',
      },
      {
        sourceFields: ['tax_amount', 'tax', 'vat'],
        targetField: 'tax_amount',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 7,
        isActive: true,
        description: '稅額映射',
      },
      {
        sourceFields: ['total_amount', 'total', 'grand_total'],
        targetField: 'total_amount',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 8,
        isActive: true,
        description: '總金額映射（支援多來源欄位名稱）',
      },
      {
        sourceFields: ['due_date', 'payment_due_date'],
        targetField: 'due_date',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 9,
        isActive: true,
        description: '付款到期日映射',
      },
      {
        sourceFields: ['po_number', 'purchase_order'],
        targetField: 'po_number',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 10,
        isActive: true,
        description: '採購單號映射',
      },
      {
        sourceFields: ['tracking_number', 'tracking_no', 'awb_number', 'bl_number'],
        targetField: 'tracking_number',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 11,
        isActive: true,
        description: '追蹤號碼映射（支援空運提單號/海運提單號）',
      },
      {
        sourceFields: ['description', 'remarks', 'notes'],
        targetField: 'description',
        transformType: 'DIRECT',
        transformParams: null,
        priority: 12,
        isActive: true,
        description: '說明映射',
      },
    ],
  },
]
