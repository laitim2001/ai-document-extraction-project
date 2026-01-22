/**
 * @fileoverview 標準欄位定義常數
 * @description
 *   定義系統使用的標準欄位列表，用於第二層映射（標準欄位 → 模版欄位）
 *   標準欄位是 AI 提取後的統一欄位名稱，與 Forwarder 和文件格式無關
 *
 * @module src/constants/standard-fields
 * @since Epic 19 - Story 19.4
 * @lastModified 2026-01-22
 *
 * @features
 *   - 標準欄位分類（基本、供應商、物流、費用、金額）
 *   - 欄位元數據（名稱、標籤、類型、分類）
 *   - 輔助函數（取得欄位、分類篩選）
 *
 * @dependencies
 *   - None
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 欄位分類
 */
export type FieldCategory =
  | 'basic'
  | 'vendor'
  | 'logistics'
  | 'charges'
  | 'amount'
  | 'shipment'
  | 'customs'
  | 'other';

/**
 * 欄位數據類型
 */
export type FieldDataType = 'string' | 'number' | 'date' | 'boolean' | 'currency';

/**
 * 標準欄位定義
 */
export interface StandardField {
  /** 欄位名稱（技術名稱） */
  name: string;
  /** 欄位標籤（顯示名稱，需 i18n） */
  labelKey: string;
  /** 數據類型 */
  dataType: FieldDataType;
  /** 分類 */
  category: FieldCategory;
  /** 是否常用 */
  isCommon?: boolean;
  /** 說明 */
  description?: string;
}

// ============================================================================
// Field Categories
// ============================================================================

/**
 * 欄位分類配置
 */
export const FIELD_CATEGORIES: Record<FieldCategory, { labelKey: string; order: number }> = {
  basic: { labelKey: 'standardFields.categories.basic', order: 1 },
  vendor: { labelKey: 'standardFields.categories.vendor', order: 2 },
  logistics: { labelKey: 'standardFields.categories.logistics', order: 3 },
  shipment: { labelKey: 'standardFields.categories.shipment', order: 4 },
  charges: { labelKey: 'standardFields.categories.charges', order: 5 },
  amount: { labelKey: 'standardFields.categories.amount', order: 6 },
  customs: { labelKey: 'standardFields.categories.customs', order: 7 },
  other: { labelKey: 'standardFields.categories.other', order: 8 },
};

// ============================================================================
// Standard Fields Definition
// ============================================================================

/**
 * 標準欄位列表
 * 這些是 AI 提取後的統一欄位名稱
 */
export const STANDARD_FIELDS: StandardField[] = [
  // ===== 基本資訊 (Basic) =====
  {
    name: 'invoice_number',
    labelKey: 'standardFields.fields.invoice_number',
    dataType: 'string',
    category: 'basic',
    isCommon: true,
    description: '發票號碼',
  },
  {
    name: 'invoice_date',
    labelKey: 'standardFields.fields.invoice_date',
    dataType: 'date',
    category: 'basic',
    isCommon: true,
    description: '發票日期',
  },
  {
    name: 'due_date',
    labelKey: 'standardFields.fields.due_date',
    dataType: 'date',
    category: 'basic',
    isCommon: true,
    description: '付款到期日',
  },
  {
    name: 'po_number',
    labelKey: 'standardFields.fields.po_number',
    dataType: 'string',
    category: 'basic',
    isCommon: true,
    description: '採購單號',
  },
  {
    name: 'reference_number',
    labelKey: 'standardFields.fields.reference_number',
    dataType: 'string',
    category: 'basic',
    description: '參考編號',
  },

  // ===== 供應商 (Vendor) =====
  {
    name: 'vendor_name',
    labelKey: 'standardFields.fields.vendor_name',
    dataType: 'string',
    category: 'vendor',
    isCommon: true,
    description: '供應商名稱',
  },
  {
    name: 'vendor_code',
    labelKey: 'standardFields.fields.vendor_code',
    dataType: 'string',
    category: 'vendor',
    isCommon: true,
    description: '供應商代碼',
  },
  {
    name: 'vendor_address',
    labelKey: 'standardFields.fields.vendor_address',
    dataType: 'string',
    category: 'vendor',
    description: '供應商地址',
  },
  {
    name: 'vendor_tax_id',
    labelKey: 'standardFields.fields.vendor_tax_id',
    dataType: 'string',
    category: 'vendor',
    description: '供應商統編',
  },
  {
    name: 'vendor_contact',
    labelKey: 'standardFields.fields.vendor_contact',
    dataType: 'string',
    category: 'vendor',
    description: '供應商聯絡人',
  },

  // ===== 物流 (Logistics) =====
  {
    name: 'shipment_no',
    labelKey: 'standardFields.fields.shipment_no',
    dataType: 'string',
    category: 'logistics',
    isCommon: true,
    description: '出貨單號',
  },
  {
    name: 'tracking_number',
    labelKey: 'standardFields.fields.tracking_number',
    dataType: 'string',
    category: 'logistics',
    isCommon: true,
    description: '追蹤號碼',
  },
  {
    name: 'bl_number',
    labelKey: 'standardFields.fields.bl_number',
    dataType: 'string',
    category: 'logistics',
    description: '提單號碼',
  },
  {
    name: 'container_number',
    labelKey: 'standardFields.fields.container_number',
    dataType: 'string',
    category: 'logistics',
    description: '貨櫃號碼',
  },
  {
    name: 'origin',
    labelKey: 'standardFields.fields.origin',
    dataType: 'string',
    category: 'logistics',
    isCommon: true,
    description: '起運地',
  },
  {
    name: 'destination',
    labelKey: 'standardFields.fields.destination',
    dataType: 'string',
    category: 'logistics',
    isCommon: true,
    description: '目的地',
  },
  {
    name: 'ship_date',
    labelKey: 'standardFields.fields.ship_date',
    dataType: 'date',
    category: 'logistics',
    description: '發貨日期',
  },
  {
    name: 'delivery_date',
    labelKey: 'standardFields.fields.delivery_date',
    dataType: 'date',
    category: 'logistics',
    description: '交付日期',
  },
  {
    name: 'eta',
    labelKey: 'standardFields.fields.eta',
    dataType: 'date',
    category: 'logistics',
    description: '預計到達日期',
  },
  {
    name: 'etd',
    labelKey: 'standardFields.fields.etd',
    dataType: 'date',
    category: 'logistics',
    description: '預計出發日期',
  },

  // ===== 貨物 (Shipment) =====
  {
    name: 'weight',
    labelKey: 'standardFields.fields.weight',
    dataType: 'number',
    category: 'shipment',
    description: '重量',
  },
  {
    name: 'volume',
    labelKey: 'standardFields.fields.volume',
    dataType: 'number',
    category: 'shipment',
    description: '體積',
  },
  {
    name: 'quantity',
    labelKey: 'standardFields.fields.quantity',
    dataType: 'number',
    category: 'shipment',
    description: '數量',
  },
  {
    name: 'package_type',
    labelKey: 'standardFields.fields.package_type',
    dataType: 'string',
    category: 'shipment',
    description: '包裝類型',
  },
  {
    name: 'commodity',
    labelKey: 'standardFields.fields.commodity',
    dataType: 'string',
    category: 'shipment',
    description: '商品描述',
  },
  {
    name: 'hs_code',
    labelKey: 'standardFields.fields.hs_code',
    dataType: 'string',
    category: 'shipment',
    description: 'HS Code',
  },

  // ===== 費用 (Charges) =====
  {
    name: 'sea_freight',
    labelKey: 'standardFields.fields.sea_freight',
    dataType: 'currency',
    category: 'charges',
    isCommon: true,
    description: '海運費',
  },
  {
    name: 'air_freight',
    labelKey: 'standardFields.fields.air_freight',
    dataType: 'currency',
    category: 'charges',
    isCommon: true,
    description: '空運費',
  },
  {
    name: 'terminal_handling',
    labelKey: 'standardFields.fields.terminal_handling',
    dataType: 'currency',
    category: 'charges',
    isCommon: true,
    description: '碼頭處理費',
  },
  {
    name: 'documentation_fee',
    labelKey: 'standardFields.fields.documentation_fee',
    dataType: 'currency',
    category: 'charges',
    isCommon: true,
    description: '文件費',
  },
  {
    name: 'customs_fee',
    labelKey: 'standardFields.fields.customs_fee',
    dataType: 'currency',
    category: 'charges',
    isCommon: true,
    description: '報關費',
  },
  {
    name: 'insurance',
    labelKey: 'standardFields.fields.insurance',
    dataType: 'currency',
    category: 'charges',
    description: '保險費',
  },
  {
    name: 'storage_fee',
    labelKey: 'standardFields.fields.storage_fee',
    dataType: 'currency',
    category: 'charges',
    description: '倉儲費',
  },
  {
    name: 'handling_fee',
    labelKey: 'standardFields.fields.handling_fee',
    dataType: 'currency',
    category: 'charges',
    description: '處理費',
  },
  {
    name: 'pickup_fee',
    labelKey: 'standardFields.fields.pickup_fee',
    dataType: 'currency',
    category: 'charges',
    description: '取件費',
  },
  {
    name: 'delivery_fee',
    labelKey: 'standardFields.fields.delivery_fee',
    dataType: 'currency',
    category: 'charges',
    description: '配送費',
  },
  {
    name: 'fuel_surcharge',
    labelKey: 'standardFields.fields.fuel_surcharge',
    dataType: 'currency',
    category: 'charges',
    description: '燃油附加費',
  },
  {
    name: 'security_fee',
    labelKey: 'standardFields.fields.security_fee',
    dataType: 'currency',
    category: 'charges',
    description: '安檢費',
  },
  {
    name: 'other_charges',
    labelKey: 'standardFields.fields.other_charges',
    dataType: 'currency',
    category: 'charges',
    description: '其他費用',
  },

  // ===== 金額 (Amount) =====
  {
    name: 'subtotal',
    labelKey: 'standardFields.fields.subtotal',
    dataType: 'currency',
    category: 'amount',
    isCommon: true,
    description: '小計',
  },
  {
    name: 'tax_amount',
    labelKey: 'standardFields.fields.tax_amount',
    dataType: 'currency',
    category: 'amount',
    isCommon: true,
    description: '稅額',
  },
  {
    name: 'tax_rate',
    labelKey: 'standardFields.fields.tax_rate',
    dataType: 'number',
    category: 'amount',
    description: '稅率',
  },
  {
    name: 'total_amount',
    labelKey: 'standardFields.fields.total_amount',
    dataType: 'currency',
    category: 'amount',
    isCommon: true,
    description: '總金額',
  },
  {
    name: 'currency',
    labelKey: 'standardFields.fields.currency',
    dataType: 'string',
    category: 'amount',
    isCommon: true,
    description: '幣別',
  },
  {
    name: 'exchange_rate',
    labelKey: 'standardFields.fields.exchange_rate',
    dataType: 'number',
    category: 'amount',
    description: '匯率',
  },
  {
    name: 'discount',
    labelKey: 'standardFields.fields.discount',
    dataType: 'currency',
    category: 'amount',
    description: '折扣',
  },

  // ===== 報關 (Customs) =====
  {
    name: 'customs_declaration_no',
    labelKey: 'standardFields.fields.customs_declaration_no',
    dataType: 'string',
    category: 'customs',
    description: '報關單號',
  },
  {
    name: 'customs_value',
    labelKey: 'standardFields.fields.customs_value',
    dataType: 'currency',
    category: 'customs',
    description: '報關價值',
  },
  {
    name: 'duty_amount',
    labelKey: 'standardFields.fields.duty_amount',
    dataType: 'currency',
    category: 'customs',
    description: '關稅金額',
  },
  {
    name: 'vat_amount',
    labelKey: 'standardFields.fields.vat_amount',
    dataType: 'currency',
    category: 'customs',
    description: '營業稅金額',
  },

  // ===== 其他 (Other) =====
  {
    name: 'notes',
    labelKey: 'standardFields.fields.notes',
    dataType: 'string',
    category: 'other',
    description: '備註',
  },
  {
    name: 'payment_terms',
    labelKey: 'standardFields.fields.payment_terms',
    dataType: 'string',
    category: 'other',
    description: '付款條款',
  },
  {
    name: 'incoterms',
    labelKey: 'standardFields.fields.incoterms',
    dataType: 'string',
    category: 'other',
    description: '貿易條款',
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 取得所有標準欄位
 * @returns 標準欄位列表
 */
export function getAllStandardFields(): StandardField[] {
  return STANDARD_FIELDS;
}

/**
 * 依分類取得標準欄位
 * @param category - 分類
 * @returns 該分類的欄位列表
 */
export function getStandardFieldsByCategory(category: FieldCategory): StandardField[] {
  return STANDARD_FIELDS.filter((field) => field.category === category);
}

/**
 * 取得常用標準欄位
 * @returns 常用欄位列表
 */
export function getCommonStandardFields(): StandardField[] {
  return STANDARD_FIELDS.filter((field) => field.isCommon);
}

/**
 * 依名稱取得標準欄位
 * @param name - 欄位名稱
 * @returns 欄位定義或 undefined
 */
export function getStandardFieldByName(name: string): StandardField | undefined {
  return STANDARD_FIELDS.find((field) => field.name === name);
}

/**
 * 取得依分類分組的標準欄位
 * @returns 分組後的欄位
 */
export function getStandardFieldsGroupedByCategory(): Record<FieldCategory, StandardField[]> {
  const grouped: Record<FieldCategory, StandardField[]> = {
    basic: [],
    vendor: [],
    logistics: [],
    shipment: [],
    charges: [],
    amount: [],
    customs: [],
    other: [],
  };

  for (const field of STANDARD_FIELDS) {
    grouped[field.category].push(field);
  }

  return grouped;
}

/**
 * 搜尋標準欄位
 * @param query - 搜尋關鍵字
 * @returns 符合的欄位列表
 */
export function searchStandardFields(query: string): StandardField[] {
  const lowerQuery = query.toLowerCase();
  return STANDARD_FIELDS.filter(
    (field) =>
      field.name.toLowerCase().includes(lowerQuery) ||
      (field.description?.toLowerCase().includes(lowerQuery) ?? false)
  );
}

/**
 * 取得所有分類（已排序）
 * @returns 分類列表
 */
export function getSortedCategories(): Array<{ key: FieldCategory; labelKey: string }> {
  return (Object.entries(FIELD_CATEGORIES) as Array<[FieldCategory, { labelKey: string; order: number }]>)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, value]) => ({ key, labelKey: value.labelKey }));
}
