/**
 * @fileoverview 映射規則種子數據
 * @description
 *   定義通用和 Forwarder 特定的欄位映射規則。
 *   - Universal Rules (Tier 1): 適用於所有 Forwarder
 *   - Forwarder-Specific Rules (Tier 2): 覆蓋特定 Forwarder 的規則
 *
 * @module prisma/seed-data/mapping-rules
 * @since Epic 2 - Story 2.4 (Field Mapping & Extraction)
 * @lastModified 2025-12-18
 */

import type { Prisma } from '@prisma/client';

/**
 * 映射規則種子數據類型
 */
export interface MappingRuleSeedData {
  /** Forwarder ID（null = 通用規則） */
  forwarderId: string | null;
  /** 欄位名稱 */
  fieldName: string;
  /** 欄位標籤 */
  fieldLabel: string;
  /** 提取模式 */
  extractionPattern: {
    method: 'regex' | 'keyword' | 'position' | 'azure_field';
    pattern?: string;
    keywords?: string[];
    azureFieldName?: string;
    confidenceBoost?: number;
  };
  /** 優先級（高 = 優先使用） */
  priority: number;
  /** 是否必填 */
  isRequired: boolean;
  /** 驗證正則表達式 */
  validationPattern?: string;
  /** 預設值 */
  defaultValue?: string;
  /** 欄位分類 */
  category: string;
  /** 描述 */
  description?: string;
}

// ============================================================
// Universal Rules (Tier 1) - 通用映射規則
// ============================================================

export const UNIVERSAL_MAPPING_RULES: MappingRuleSeedData[] = [
  // --- Basic Information ---
  {
    forwarderId: null,
    fieldName: 'invoice_number',
    fieldLabel: 'Invoice Number',
    extractionPattern: {
      method: 'azure_field',
      azureFieldName: 'InvoiceId',
      confidenceBoost: 5,
    },
    priority: 100,
    isRequired: true,
    category: 'basic',
    description: '發票編號 - 優先使用 Azure DI 提取',
  },
  {
    forwarderId: null,
    fieldName: 'invoice_number',
    fieldLabel: 'Invoice Number',
    extractionPattern: {
      method: 'regex',
      pattern: '(?:Invoice|Inv|Bill)\\s*(?:No|Number|#)?[.:]?\\s*([A-Z0-9-]{5,30})',
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'basic',
    description: '發票編號 - 正則表達式備用',
  },
  {
    forwarderId: null,
    fieldName: 'invoice_date',
    fieldLabel: 'Invoice Date',
    extractionPattern: {
      method: 'azure_field',
      azureFieldName: 'InvoiceDate',
      confidenceBoost: 5,
    },
    priority: 100,
    isRequired: true,
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    category: 'basic',
    description: '發票日期',
  },
  {
    forwarderId: null,
    fieldName: 'invoice_date',
    fieldLabel: 'Invoice Date',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Invoice Date', 'Inv Date', 'Date', 'Bill Date'],
      confidenceBoost: 0,
    },
    priority: 80,
    isRequired: true,
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    category: 'basic',
    description: '發票日期 - 關鍵字備用',
  },
  {
    forwarderId: null,
    fieldName: 'due_date',
    fieldLabel: 'Due Date',
    extractionPattern: {
      method: 'azure_field',
      azureFieldName: 'DueDate',
      confidenceBoost: 5,
    },
    priority: 100,
    isRequired: false,
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    category: 'basic',
    description: '付款到期日',
  },
  {
    forwarderId: null,
    fieldName: 'currency',
    fieldLabel: 'Currency',
    extractionPattern: {
      method: 'regex',
      pattern: '\\b(USD|EUR|GBP|JPY|CNY|HKD|TWD|SGD|AUD)\\b',
      confidenceBoost: 5,
    },
    priority: 100,
    isRequired: true,
    validationPattern: '^[A-Z]{3}$',
    category: 'basic',
    description: '幣別',
  },

  // --- Shipper Information ---
  {
    forwarderId: null,
    fieldName: 'shipper_name',
    fieldLabel: 'Shipper Name',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Shipper', 'Sender', 'From', 'Origin', 'Ship From'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'shipper',
    description: '發貨人名稱',
  },
  {
    forwarderId: null,
    fieldName: 'shipper_country',
    fieldLabel: 'Shipper Country',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Origin Country', 'Ship From Country', 'Shipper Country'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'shipper',
    description: '發貨人國家',
  },

  // --- Consignee Information ---
  {
    forwarderId: null,
    fieldName: 'consignee_name',
    fieldLabel: 'Consignee Name',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Consignee', 'Receiver', 'To', 'Destination', 'Ship To'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'consignee',
    description: '收貨人名稱',
  },
  {
    forwarderId: null,
    fieldName: 'consignee_country',
    fieldLabel: 'Consignee Country',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Destination Country', 'Ship To Country', 'Consignee Country'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'consignee',
    description: '收貨人國家',
  },

  // --- Shipping Information ---
  {
    forwarderId: null,
    fieldName: 'tracking_number',
    fieldLabel: 'Tracking Number',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Tracking', 'AWB', 'Airway Bill', 'Waybill', 'Pro Number', 'Tracking No'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'shipping',
    description: '追蹤號碼',
  },
  {
    forwarderId: null,
    fieldName: 'ship_date',
    fieldLabel: 'Ship Date',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Ship Date', 'Shipment Date', 'Pickup Date', 'Dispatch Date'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: false,
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    category: 'shipping',
    description: '發貨日期',
  },
  {
    forwarderId: null,
    fieldName: 'delivery_date',
    fieldLabel: 'Delivery Date',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Delivery Date', 'POD Date', 'Arrival Date', 'Delivered'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: false,
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    category: 'shipping',
    description: '交付日期',
  },
  {
    forwarderId: null,
    fieldName: 'origin_code',
    fieldLabel: 'Origin Code',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Origin', 'From', 'Departure'],
      confidenceBoost: 0,
    },
    priority: 80,
    isRequired: false,
    category: 'shipping',
    description: '起運地代碼',
  },
  {
    forwarderId: null,
    fieldName: 'destination_code',
    fieldLabel: 'Destination Code',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Destination', 'To', 'Arrival'],
      confidenceBoost: 0,
    },
    priority: 80,
    isRequired: false,
    category: 'shipping',
    description: '目的地代碼',
  },

  // --- Package Information ---
  {
    forwarderId: null,
    fieldName: 'total_pieces',
    fieldLabel: 'Total Pieces',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Pieces', 'Pcs', 'Qty', 'Quantity', 'No. of Pieces'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: false,
    category: 'package',
    description: '總件數',
  },
  {
    forwarderId: null,
    fieldName: 'gross_weight',
    fieldLabel: 'Gross Weight',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Gross Weight', 'Actual Weight', 'Weight', 'Total Weight'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'package',
    description: '毛重',
  },
  {
    forwarderId: null,
    fieldName: 'chargeable_weight',
    fieldLabel: 'Chargeable Weight',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Chargeable Weight', 'Billable Weight', 'Charged Weight'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: false,
    category: 'package',
    description: '計費重量',
  },

  // --- Charges Information ---
  {
    forwarderId: null,
    fieldName: 'freight_charge',
    fieldLabel: 'Freight Charge',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Freight', 'Shipping Cost', 'Carriage', 'Transportation'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'charges',
    description: '運費',
  },
  {
    forwarderId: null,
    fieldName: 'fuel_surcharge',
    fieldLabel: 'Fuel Surcharge',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Fuel Surcharge', 'Fuel', 'FSC', 'Fuel Charge'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: false,
    category: 'charges',
    description: '燃油附加費',
  },
  {
    forwarderId: null,
    fieldName: 'total_amount',
    fieldLabel: 'Total Amount',
    extractionPattern: {
      method: 'azure_field',
      azureFieldName: 'InvoiceTotal',
      confidenceBoost: 5,
    },
    priority: 100,
    isRequired: true,
    category: 'charges',
    description: '總金額 - 優先使用 Azure DI',
  },
  {
    forwarderId: null,
    fieldName: 'total_amount',
    fieldLabel: 'Total Amount',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Total', 'Grand Total', 'Amount Due', 'Invoice Total', 'Total Amount'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: true,
    category: 'charges',
    description: '總金額 - 關鍵字備用',
  },

  // --- Reference Numbers ---
  {
    forwarderId: null,
    fieldName: 'po_number',
    fieldLabel: 'Purchase Order Number',
    extractionPattern: {
      method: 'azure_field',
      azureFieldName: 'PurchaseOrder',
      confidenceBoost: 5,
    },
    priority: 100,
    isRequired: false,
    category: 'reference',
    description: '採購單號',
  },
  {
    forwarderId: null,
    fieldName: 'po_number',
    fieldLabel: 'Purchase Order Number',
    extractionPattern: {
      method: 'keyword',
      keywords: ['PO', 'Purchase Order', 'P.O.', 'PO Number', 'PO#'],
      confidenceBoost: 0,
    },
    priority: 90,
    isRequired: false,
    category: 'reference',
    description: '採購單號 - 關鍵字備用',
  },

  // --- Payment Information ---
  {
    forwarderId: null,
    fieldName: 'payment_terms',
    fieldLabel: 'Payment Terms',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Payment Terms', 'Terms', 'Payment Method'],
      confidenceBoost: 0,
    },
    priority: 80,
    isRequired: false,
    category: 'payment',
    description: '付款條件',
  },
];

// ============================================================
// DHL Specific Rules (Tier 2)
// ============================================================

/**
 * DHL 特定規則
 * 這些規則會覆蓋通用規則
 */
export const DHL_MAPPING_RULES: Omit<MappingRuleSeedData, 'forwarderId'>[] = [
  {
    fieldName: 'tracking_number',
    fieldLabel: 'Tracking Number',
    extractionPattern: {
      method: 'regex',
      pattern: '(?:AWB|Waybill|Tracking)\\s*(?:No|Number)?[.:]?\\s*(\\d{10,11})',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: true,
    category: 'shipping',
    description: 'DHL AWB 格式: 10-11 位數字',
  },
  {
    fieldName: 'invoice_number',
    fieldLabel: 'Invoice Number',
    extractionPattern: {
      method: 'regex',
      pattern: 'Invoice\\s*(?:No|Number)?[.:]?\\s*([A-Z]{2}\\d{9,12})',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: true,
    category: 'basic',
    description: 'DHL Invoice 格式',
  },
  {
    fieldName: 'service_type',
    fieldLabel: 'Service Type',
    extractionPattern: {
      method: 'regex',
      pattern: '(EXPRESS WORLDWIDE|EXPRESS 9:00|EXPRESS 10:30|EXPRESS 12:00|ECONOMY SELECT)',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: false,
    category: 'basic',
    description: 'DHL 服務類型',
  },
];

// ============================================================
// FedEx Specific Rules (Tier 2)
// ============================================================

export const FEDEX_MAPPING_RULES: Omit<MappingRuleSeedData, 'forwarderId'>[] = [
  {
    fieldName: 'tracking_number',
    fieldLabel: 'Tracking Number',
    extractionPattern: {
      method: 'regex',
      pattern: '(?:Tracking|Track)\\s*(?:No|Number)?[.:]?\\s*(\\d{12,22})',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: true,
    category: 'shipping',
    description: 'FedEx Tracking 格式: 12-22 位數字',
  },
  {
    fieldName: 'service_type',
    fieldLabel: 'Service Type',
    extractionPattern: {
      method: 'regex',
      pattern:
        '(INTERNATIONAL PRIORITY|INTERNATIONAL ECONOMY|GROUND|EXPRESS SAVER|FIRST OVERNIGHT)',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: false,
    category: 'basic',
    description: 'FedEx 服務類型',
  },
];

// ============================================================
// UPS Specific Rules (Tier 2)
// ============================================================

export const UPS_MAPPING_RULES: Omit<MappingRuleSeedData, 'forwarderId'>[] = [
  {
    fieldName: 'tracking_number',
    fieldLabel: 'Tracking Number',
    extractionPattern: {
      method: 'regex',
      pattern: '(?:Tracking|1Z)\\s*([1Z][A-Z0-9]{17,18})',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: true,
    category: 'shipping',
    description: 'UPS Tracking 格式: 1Z 開頭',
  },
  {
    fieldName: 'service_type',
    fieldLabel: 'Service Type',
    extractionPattern: {
      method: 'regex',
      pattern: '(WORLDWIDE EXPRESS|WORLDWIDE EXPEDITED|WORLDWIDE SAVER|GROUND|NEXT DAY AIR)',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: false,
    category: 'basic',
    description: 'UPS 服務類型',
  },
];

// ============================================================
// Maersk Specific Rules (Tier 2)
// ============================================================

export const MAERSK_MAPPING_RULES: Omit<MappingRuleSeedData, 'forwarderId'>[] = [
  {
    fieldName: 'tracking_number',
    fieldLabel: 'Bill of Lading Number',
    extractionPattern: {
      method: 'regex',
      pattern: '(?:B/L|BOL|Bill of Lading)\\s*(?:No|Number)?[.:]?\\s*([A-Z]{4}\\d{10,14})',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: true,
    category: 'shipping',
    description: 'Maersk B/L 格式',
  },
  {
    fieldName: 'container_number',
    fieldLabel: 'Container Number',
    extractionPattern: {
      method: 'regex',
      pattern: '(M[A-Z]{3}U\\d{7})',
      confidenceBoost: 10,
    },
    priority: 100,
    isRequired: false,
    category: 'shipping',
    description: 'Maersk Container 格式: MSKU/MRKU',
  },
  {
    fieldName: 'vessel_name',
    fieldLabel: 'Vessel Name',
    extractionPattern: {
      method: 'keyword',
      keywords: ['Vessel', 'Ship Name', 'M/V', 'MV'],
      confidenceBoost: 5,
    },
    priority: 100,
    isRequired: false,
    category: 'shipping',
    description: 'Maersk 船名',
  },
];

// ============================================================
// Helper Function to Get All Rules
// ============================================================

/**
 * 取得所有映射規則（包含通用和特定規則）
 *
 * @param forwarderIds Forwarder ID 對照表
 * @returns 完整的映射規則列表
 */
export function getAllMappingRules(forwarderIds: Record<string, string>): MappingRuleSeedData[] {
  const allRules: MappingRuleSeedData[] = [...UNIVERSAL_MAPPING_RULES];

  // 添加 DHL 規則
  if (forwarderIds['DHL']) {
    allRules.push(
      ...DHL_MAPPING_RULES.map((rule) => ({
        ...rule,
        forwarderId: forwarderIds['DHL'],
      }))
    );
  }

  // 添加 FedEx 規則
  if (forwarderIds['FDX']) {
    allRules.push(
      ...FEDEX_MAPPING_RULES.map((rule) => ({
        ...rule,
        forwarderId: forwarderIds['FDX'],
      }))
    );
  }

  // 添加 UPS 規則
  if (forwarderIds['UPS']) {
    allRules.push(
      ...UPS_MAPPING_RULES.map((rule) => ({
        ...rule,
        forwarderId: forwarderIds['UPS'],
      }))
    );
  }

  // 添加 Maersk 規則
  if (forwarderIds['MAERSK']) {
    allRules.push(
      ...MAERSK_MAPPING_RULES.map((rule) => ({
        ...rule,
        forwarderId: forwarderIds['MAERSK'],
      }))
    );
  }

  return allRules;
}
