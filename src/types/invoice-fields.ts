/**
 * @fileoverview 標準發票欄位定義
 * @description
 *   定義系統支援的所有發票欄位，包括：
 *   - 基本資訊（約15個欄位）
 *   - 託運人/發貨人資訊（約12個欄位）
 *   - 收貨人資訊（約12個欄位）
 *   - 運輸資訊（約15個欄位）
 *   - 包裝資訊（約10個欄位）
 *   - 費用明細（約15個欄位）
 *   - 參考編號（約8個欄位）
 *   - 付款資訊（約6個欄位）
 *
 * @module src/types/invoice-fields
 * @since Epic 2 - Story 2.4 (Field Mapping & Extraction)
 * @lastModified 2025-12-18
 */

// =====================
// Field Categories
// =====================

export const FIELD_CATEGORIES = {
  BASIC: 'basic',
  SHIPPER: 'shipper',
  CONSIGNEE: 'consignee',
  SHIPPING: 'shipping',
  PACKAGE: 'package',
  CHARGES: 'charges',
  REFERENCE: 'reference',
  PAYMENT: 'payment',
} as const;

export type FieldCategory = (typeof FIELD_CATEGORIES)[keyof typeof FIELD_CATEGORIES];

// =====================
// Field Data Types
// =====================

export const FIELD_DATA_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  DATE: 'date',
  CURRENCY: 'currency',
  ADDRESS: 'address',
  PHONE: 'phone',
  EMAIL: 'email',
  WEIGHT: 'weight',
  DIMENSION: 'dimension',
} as const;

export type FieldDataType = (typeof FIELD_DATA_TYPES)[keyof typeof FIELD_DATA_TYPES];

// =====================
// Field Definition Interface
// =====================

export interface InvoiceFieldDefinition {
  /** 欄位名稱（唯一識別符） */
  name: string;
  /** 顯示標籤 */
  label: string;
  /** 欄位分類 */
  category: FieldCategory;
  /** 資料類型 */
  dataType: FieldDataType;
  /** 是否必填 */
  isRequired: boolean;
  /** 欄位描述 */
  description: string;
  /** 常見別名（用於映射匹配） */
  aliases?: string[];
  /** 驗證正則表達式（可選） */
  validationPattern?: string;
  /** 格式範例 */
  example?: string;
}

// =====================
// Standard Invoice Fields (~90 fields)
// =====================

export const INVOICE_FIELDS: Record<string, InvoiceFieldDefinition> = {
  // ===================
  // Basic Information (~15 fields)
  // ===================
  INVOICE_NUMBER: {
    name: 'invoice_number',
    label: 'Invoice Number',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: true,
    description: '發票編號',
    aliases: ['inv no', 'invoice no', 'inv #', 'invoice #', 'bill no'],
    example: 'INV-2024-001234',
  },
  INVOICE_DATE: {
    name: 'invoice_date',
    label: 'Invoice Date',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.DATE,
    isRequired: true,
    description: '發票日期',
    aliases: ['inv date', 'date', 'bill date'],
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    example: '2024-12-18',
  },
  DUE_DATE: {
    name: 'due_date',
    label: 'Due Date',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.DATE,
    isRequired: false,
    description: '付款到期日',
    aliases: ['payment due', 'due by'],
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    example: '2024-12-31',
  },
  CURRENCY: {
    name: 'currency',
    label: 'Currency',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: true,
    description: '幣別',
    aliases: ['ccy', 'curr'],
    validationPattern: '^[A-Z]{3}$',
    example: 'USD',
  },
  FORWARDER_NAME: {
    name: 'forwarder_name',
    label: 'Forwarder Name',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: true,
    description: '貨運代理名稱',
    aliases: ['carrier', 'shipper name', 'freight forwarder'],
    example: 'DHL Express',
  },
  FORWARDER_ACCOUNT: {
    name: 'forwarder_account',
    label: 'Forwarder Account',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '貨運代理帳號',
    aliases: ['account no', 'account number', 'customer account'],
    example: '123456789',
  },
  SERVICE_TYPE: {
    name: 'service_type',
    label: 'Service Type',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '服務類型',
    aliases: ['service', 'product type', 'shipment type'],
    example: 'Express Worldwide',
  },
  INCOTERM: {
    name: 'incoterm',
    label: 'Incoterm',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '國際貿易條款',
    aliases: ['terms', 'trade terms', 'delivery terms'],
    validationPattern: '^(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)$',
    example: 'DAP',
  },
  CUSTOMS_ENTRY_NUMBER: {
    name: 'customs_entry_number',
    label: 'Customs Entry Number',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '報關單號',
    aliases: ['entry no', 'customs no', 'declaration no'],
    example: 'ENT-2024-001234',
  },
  BILLING_PERIOD: {
    name: 'billing_period',
    label: 'Billing Period',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '帳單週期',
    aliases: ['period', 'statement period'],
    example: '2024-12-01 to 2024-12-31',
  },
  DOCUMENT_TYPE: {
    name: 'document_type',
    label: 'Document Type',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '文件類型',
    aliases: ['doc type', 'type'],
    example: 'Commercial Invoice',
  },
  TAX_ID: {
    name: 'tax_id',
    label: 'Tax ID',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '統一編號/稅號',
    aliases: ['vat no', 'vat number', 'tax number', 'ein', 'tin'],
    example: '12345678',
  },
  PAGE_NUMBER: {
    name: 'page_number',
    label: 'Page Number',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '頁碼',
    aliases: ['page', 'page no'],
    example: '1 of 3',
  },
  STATEMENT_NUMBER: {
    name: 'statement_number',
    label: 'Statement Number',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '對帳單號',
    aliases: ['stmt no', 'statement no'],
    example: 'STM-2024-001234',
  },
  CUSTOMER_CODE: {
    name: 'customer_code',
    label: 'Customer Code',
    category: FIELD_CATEGORIES.BASIC,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '客戶代碼',
    aliases: ['client code', 'cust code'],
    example: 'CUST001',
  },

  // ===================
  // Shipper Information (~12 fields)
  // ===================
  SHIPPER_NAME: {
    name: 'shipper_name',
    label: 'Shipper Name',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: true,
    description: '發貨人名稱',
    aliases: ['sender name', 'from', 'origin'],
    example: 'ABC Trading Co., Ltd.',
  },
  SHIPPER_ADDRESS_LINE1: {
    name: 'shipper_address_line1',
    label: 'Shipper Address Line 1',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.ADDRESS,
    isRequired: false,
    description: '發貨人地址行1',
    aliases: ['shipper address', 'sender address'],
    example: '123 Main Street',
  },
  SHIPPER_ADDRESS_LINE2: {
    name: 'shipper_address_line2',
    label: 'Shipper Address Line 2',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.ADDRESS,
    isRequired: false,
    description: '發貨人地址行2',
    example: 'Suite 100',
  },
  SHIPPER_CITY: {
    name: 'shipper_city',
    label: 'Shipper City',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '發貨人城市',
    aliases: ['origin city'],
    example: 'Taipei',
  },
  SHIPPER_STATE: {
    name: 'shipper_state',
    label: 'Shipper State/Province',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '發貨人州/省',
    aliases: ['origin state', 'shipper province'],
    example: 'Taiwan',
  },
  SHIPPER_POSTAL_CODE: {
    name: 'shipper_postal_code',
    label: 'Shipper Postal Code',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '發貨人郵遞區號',
    aliases: ['origin zip', 'shipper zip'],
    example: '10492',
  },
  SHIPPER_COUNTRY: {
    name: 'shipper_country',
    label: 'Shipper Country',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: true,
    description: '發貨人國家',
    aliases: ['origin country', 'country of origin'],
    example: 'TW',
  },
  SHIPPER_PHONE: {
    name: 'shipper_phone',
    label: 'Shipper Phone',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.PHONE,
    isRequired: false,
    description: '發貨人電話',
    aliases: ['origin phone', 'sender phone'],
    example: '+886-2-1234-5678',
  },
  SHIPPER_EMAIL: {
    name: 'shipper_email',
    label: 'Shipper Email',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.EMAIL,
    isRequired: false,
    description: '發貨人電子郵件',
    aliases: ['origin email', 'sender email'],
    example: 'shipper@example.com',
  },
  SHIPPER_CONTACT: {
    name: 'shipper_contact',
    label: 'Shipper Contact Person',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '發貨人聯絡人',
    aliases: ['origin contact', 'sender contact'],
    example: 'John Smith',
  },
  SHIPPER_REFERENCE: {
    name: 'shipper_reference',
    label: 'Shipper Reference',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '發貨人參考號',
    aliases: ['sender ref', 'origin ref'],
    example: 'PO-2024-001',
  },
  SHIPPER_TAX_ID: {
    name: 'shipper_tax_id',
    label: 'Shipper Tax ID',
    category: FIELD_CATEGORIES.SHIPPER,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '發貨人稅號',
    aliases: ['shipper vat', 'origin tax id'],
    example: '12345678',
  },

  // ===================
  // Consignee Information (~12 fields)
  // ===================
  CONSIGNEE_NAME: {
    name: 'consignee_name',
    label: 'Consignee Name',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: true,
    description: '收貨人名稱',
    aliases: ['receiver name', 'to', 'destination'],
    example: 'XYZ Corporation',
  },
  CONSIGNEE_ADDRESS_LINE1: {
    name: 'consignee_address_line1',
    label: 'Consignee Address Line 1',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.ADDRESS,
    isRequired: false,
    description: '收貨人地址行1',
    aliases: ['consignee address', 'receiver address'],
    example: '456 Oak Avenue',
  },
  CONSIGNEE_ADDRESS_LINE2: {
    name: 'consignee_address_line2',
    label: 'Consignee Address Line 2',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.ADDRESS,
    isRequired: false,
    description: '收貨人地址行2',
    example: 'Building A',
  },
  CONSIGNEE_CITY: {
    name: 'consignee_city',
    label: 'Consignee City',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '收貨人城市',
    aliases: ['dest city', 'destination city'],
    example: 'Hong Kong',
  },
  CONSIGNEE_STATE: {
    name: 'consignee_state',
    label: 'Consignee State/Province',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '收貨人州/省',
    aliases: ['dest state', 'consignee province'],
    example: 'HK',
  },
  CONSIGNEE_POSTAL_CODE: {
    name: 'consignee_postal_code',
    label: 'Consignee Postal Code',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '收貨人郵遞區號',
    aliases: ['dest zip', 'consignee zip'],
    example: '00000',
  },
  CONSIGNEE_COUNTRY: {
    name: 'consignee_country',
    label: 'Consignee Country',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: true,
    description: '收貨人國家',
    aliases: ['dest country', 'country of destination'],
    example: 'HK',
  },
  CONSIGNEE_PHONE: {
    name: 'consignee_phone',
    label: 'Consignee Phone',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.PHONE,
    isRequired: false,
    description: '收貨人電話',
    aliases: ['dest phone', 'receiver phone'],
    example: '+852-1234-5678',
  },
  CONSIGNEE_EMAIL: {
    name: 'consignee_email',
    label: 'Consignee Email',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.EMAIL,
    isRequired: false,
    description: '收貨人電子郵件',
    aliases: ['dest email', 'receiver email'],
    example: 'consignee@example.com',
  },
  CONSIGNEE_CONTACT: {
    name: 'consignee_contact',
    label: 'Consignee Contact Person',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '收貨人聯絡人',
    aliases: ['dest contact', 'receiver contact'],
    example: 'Jane Doe',
  },
  CONSIGNEE_REFERENCE: {
    name: 'consignee_reference',
    label: 'Consignee Reference',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '收貨人參考號',
    aliases: ['receiver ref', 'dest ref'],
    example: 'REF-2024-001',
  },
  CONSIGNEE_TAX_ID: {
    name: 'consignee_tax_id',
    label: 'Consignee Tax ID',
    category: FIELD_CATEGORIES.CONSIGNEE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '收貨人稅號',
    aliases: ['consignee vat', 'dest tax id'],
    example: '87654321',
  },

  // ===================
  // Shipping Information (~15 fields)
  // ===================
  TRACKING_NUMBER: {
    name: 'tracking_number',
    label: 'Tracking Number',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: true,
    description: '追蹤號碼',
    aliases: ['awb', 'airway bill', 'waybill', 'tracking no', 'pro number'],
    example: '1234567890',
  },
  MASTER_TRACKING_NUMBER: {
    name: 'master_tracking_number',
    label: 'Master Tracking Number',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '主追蹤號碼',
    aliases: ['mawb', 'master awb', 'master waybill'],
    example: '999-12345678',
  },
  HOUSE_TRACKING_NUMBER: {
    name: 'house_tracking_number',
    label: 'House Tracking Number',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '分追蹤號碼',
    aliases: ['hawb', 'house awb', 'house waybill'],
    example: 'HAWB-001234',
  },
  SHIP_DATE: {
    name: 'ship_date',
    label: 'Ship Date',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.DATE,
    isRequired: false,
    description: '發貨日期',
    aliases: ['shipment date', 'pickup date', 'dispatch date'],
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    example: '2024-12-15',
  },
  DELIVERY_DATE: {
    name: 'delivery_date',
    label: 'Delivery Date',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.DATE,
    isRequired: false,
    description: '交付日期',
    aliases: ['pod date', 'arrival date'],
    validationPattern: '^\\d{4}-\\d{2}-\\d{2}$',
    example: '2024-12-18',
  },
  ORIGIN_CODE: {
    name: 'origin_code',
    label: 'Origin Code',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '起運地代碼',
    aliases: ['origin', 'from code', 'departure'],
    example: 'TPE',
  },
  DESTINATION_CODE: {
    name: 'destination_code',
    label: 'Destination Code',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '目的地代碼',
    aliases: ['destination', 'to code', 'arrival'],
    example: 'HKG',
  },
  TRANSPORT_MODE: {
    name: 'transport_mode',
    label: 'Transport Mode',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '運輸方式',
    aliases: ['mode', 'shipping mode', 'method'],
    example: 'Air',
  },
  CARRIER_CODE: {
    name: 'carrier_code',
    label: 'Carrier Code',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '承運人代碼',
    aliases: ['airline code', 'carrier'],
    example: 'CX',
  },
  FLIGHT_NUMBER: {
    name: 'flight_number',
    label: 'Flight Number',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '航班號',
    aliases: ['flight no', 'vessel number'],
    example: 'CX450',
  },
  VESSEL_NAME: {
    name: 'vessel_name',
    label: 'Vessel Name',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '船名',
    aliases: ['vessel', 'ship name'],
    example: 'Ever Given',
  },
  VOYAGE_NUMBER: {
    name: 'voyage_number',
    label: 'Voyage Number',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '航次號',
    aliases: ['voyage no', 'voyage'],
    example: 'VY001',
  },
  CONTAINER_NUMBER: {
    name: 'container_number',
    label: 'Container Number',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '貨櫃號',
    aliases: ['container no', 'container'],
    example: 'MSCU1234567',
  },
  SEAL_NUMBER: {
    name: 'seal_number',
    label: 'Seal Number',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '封條號',
    aliases: ['seal no', 'seal'],
    example: 'SEAL001234',
  },
  ETD: {
    name: 'etd',
    label: 'Estimated Time of Departure',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.DATE,
    isRequired: false,
    description: '預計離港時間',
    aliases: ['departure date', 'etd date'],
    example: '2024-12-15',
  },
  ETA: {
    name: 'eta',
    label: 'Estimated Time of Arrival',
    category: FIELD_CATEGORIES.SHIPPING,
    dataType: FIELD_DATA_TYPES.DATE,
    isRequired: false,
    description: '預計到港時間',
    aliases: ['arrival date', 'eta date'],
    example: '2024-12-18',
  },

  // ===================
  // Package Information (~10 fields)
  // ===================
  TOTAL_PIECES: {
    name: 'total_pieces',
    label: 'Total Pieces',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.NUMBER,
    isRequired: false,
    description: '總件數',
    aliases: ['pieces', 'pcs', 'qty', 'quantity'],
    example: '10',
  },
  GROSS_WEIGHT: {
    name: 'gross_weight',
    label: 'Gross Weight',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.WEIGHT,
    isRequired: true,
    description: '毛重',
    aliases: ['actual weight', 'weight', 'total weight'],
    example: '100.5',
  },
  GROSS_WEIGHT_UNIT: {
    name: 'gross_weight_unit',
    label: 'Gross Weight Unit',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '毛重單位',
    aliases: ['weight unit'],
    example: 'KG',
  },
  CHARGEABLE_WEIGHT: {
    name: 'chargeable_weight',
    label: 'Chargeable Weight',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.WEIGHT,
    isRequired: false,
    description: '計費重量',
    aliases: ['billable weight', 'charged weight'],
    example: '120.0',
  },
  VOLUME_WEIGHT: {
    name: 'volume_weight',
    label: 'Volume Weight',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.WEIGHT,
    isRequired: false,
    description: '材積重',
    aliases: ['dimensional weight', 'dim weight', 'vol weight'],
    example: '120.0',
  },
  LENGTH: {
    name: 'length',
    label: 'Length',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.DIMENSION,
    isRequired: false,
    description: '長度',
    aliases: ['l'],
    example: '100',
  },
  WIDTH: {
    name: 'width',
    label: 'Width',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.DIMENSION,
    isRequired: false,
    description: '寬度',
    aliases: ['w'],
    example: '50',
  },
  HEIGHT: {
    name: 'height',
    label: 'Height',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.DIMENSION,
    isRequired: false,
    description: '高度',
    aliases: ['h'],
    example: '30',
  },
  DIMENSION_UNIT: {
    name: 'dimension_unit',
    label: 'Dimension Unit',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '尺寸單位',
    aliases: ['dim unit'],
    example: 'CM',
  },
  COMMODITY_DESCRIPTION: {
    name: 'commodity_description',
    label: 'Commodity Description',
    category: FIELD_CATEGORIES.PACKAGE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '商品描述',
    aliases: ['goods description', 'description of goods', 'contents'],
    example: 'Electronic Components',
  },

  // ===================
  // Charges Information (~15 fields)
  // ===================
  FREIGHT_CHARGE: {
    name: 'freight_charge',
    label: 'Freight Charge',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: true,
    description: '運費',
    aliases: ['freight', 'shipping cost', 'carriage'],
    example: '1500.00',
  },
  FUEL_SURCHARGE: {
    name: 'fuel_surcharge',
    label: 'Fuel Surcharge',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '燃油附加費',
    aliases: ['fuel', 'fsc', 'fuel charge'],
    example: '150.00',
  },
  SECURITY_SURCHARGE: {
    name: 'security_surcharge',
    label: 'Security Surcharge',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '安全附加費',
    aliases: ['security fee', 'ssc'],
    example: '50.00',
  },
  HANDLING_FEE: {
    name: 'handling_fee',
    label: 'Handling Fee',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '處理費',
    aliases: ['handling', 'handling charge'],
    example: '75.00',
  },
  CUSTOMS_DUTY: {
    name: 'customs_duty',
    label: 'Customs Duty',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '關稅',
    aliases: ['duty', 'import duty'],
    example: '200.00',
  },
  IMPORT_TAX: {
    name: 'import_tax',
    label: 'Import Tax',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '進口稅',
    aliases: ['tax', 'vat', 'gst'],
    example: '100.00',
  },
  DOCUMENTATION_FEE: {
    name: 'documentation_fee',
    label: 'Documentation Fee',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '文件費',
    aliases: ['doc fee', 'documentation'],
    example: '35.00',
  },
  INSURANCE: {
    name: 'insurance',
    label: 'Insurance',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '保險費',
    aliases: ['ins', 'insurance charge'],
    example: '25.00',
  },
  STORAGE_FEE: {
    name: 'storage_fee',
    label: 'Storage Fee',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '倉儲費',
    aliases: ['storage', 'warehousing'],
    example: '50.00',
  },
  DELIVERY_FEE: {
    name: 'delivery_fee',
    label: 'Delivery Fee',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '派送費',
    aliases: ['delivery charge', 'last mile'],
    example: '80.00',
  },
  PICKUP_FEE: {
    name: 'pickup_fee',
    label: 'Pickup Fee',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '取件費',
    aliases: ['collection fee', 'pickup charge'],
    example: '60.00',
  },
  MISC_CHARGES: {
    name: 'misc_charges',
    label: 'Miscellaneous Charges',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '其他雜費',
    aliases: ['other charges', 'miscellaneous', 'additional charges'],
    example: '45.00',
  },
  SUBTOTAL: {
    name: 'subtotal',
    label: 'Subtotal',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '小計',
    aliases: ['sub total', 'net amount'],
    example: '2000.00',
  },
  TAX_AMOUNT: {
    name: 'tax_amount',
    label: 'Tax Amount',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: false,
    description: '稅額',
    aliases: ['tax', 'vat amount', 'gst amount'],
    example: '100.00',
  },
  TOTAL_AMOUNT: {
    name: 'total_amount',
    label: 'Total Amount',
    category: FIELD_CATEGORIES.CHARGES,
    dataType: FIELD_DATA_TYPES.CURRENCY,
    isRequired: true,
    description: '總金額',
    aliases: ['grand total', 'total', 'amount due', 'invoice total'],
    example: '2100.00',
  },

  // ===================
  // Reference Numbers (~8 fields)
  // ===================
  PO_NUMBER: {
    name: 'po_number',
    label: 'Purchase Order Number',
    category: FIELD_CATEGORIES.REFERENCE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '採購單號',
    aliases: ['po', 'purchase order', 'po #'],
    example: 'PO-2024-001234',
  },
  SO_NUMBER: {
    name: 'so_number',
    label: 'Sales Order Number',
    category: FIELD_CATEGORIES.REFERENCE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '銷售單號',
    aliases: ['so', 'sales order', 'so #'],
    example: 'SO-2024-001234',
  },
  BOOKING_NUMBER: {
    name: 'booking_number',
    label: 'Booking Number',
    category: FIELD_CATEGORIES.REFERENCE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '訂艙號',
    aliases: ['booking ref', 'booking #'],
    example: 'BK-2024-001234',
  },
  REFERENCE_1: {
    name: 'reference_1',
    label: 'Reference 1',
    category: FIELD_CATEGORIES.REFERENCE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '參考編號1',
    aliases: ['ref1', 'ref 1', 'reference'],
    example: 'REF-001',
  },
  REFERENCE_2: {
    name: 'reference_2',
    label: 'Reference 2',
    category: FIELD_CATEGORIES.REFERENCE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '參考編號2',
    aliases: ['ref2', 'ref 2'],
    example: 'REF-002',
  },
  REFERENCE_3: {
    name: 'reference_3',
    label: 'Reference 3',
    category: FIELD_CATEGORIES.REFERENCE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '參考編號3',
    aliases: ['ref3', 'ref 3'],
    example: 'REF-003',
  },
  BATCH_NUMBER: {
    name: 'batch_number',
    label: 'Batch Number',
    category: FIELD_CATEGORIES.REFERENCE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '批次號',
    aliases: ['batch', 'lot number'],
    example: 'BATCH-001',
  },
  JOB_NUMBER: {
    name: 'job_number',
    label: 'Job Number',
    category: FIELD_CATEGORIES.REFERENCE,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '工作單號',
    aliases: ['job', 'job ref', 'job #'],
    example: 'JOB-2024-001',
  },

  // ===================
  // Payment Information (~6 fields)
  // ===================
  PAYMENT_TERMS: {
    name: 'payment_terms',
    label: 'Payment Terms',
    category: FIELD_CATEGORIES.PAYMENT,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '付款條件',
    aliases: ['terms', 'payment method'],
    example: 'Net 30',
  },
  BANK_NAME: {
    name: 'bank_name',
    label: 'Bank Name',
    category: FIELD_CATEGORIES.PAYMENT,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '銀行名稱',
    aliases: ['bank'],
    example: 'HSBC',
  },
  BANK_ACCOUNT: {
    name: 'bank_account',
    label: 'Bank Account Number',
    category: FIELD_CATEGORIES.PAYMENT,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '銀行帳號',
    aliases: ['account number', 'acct no'],
    example: '1234567890',
  },
  SWIFT_CODE: {
    name: 'swift_code',
    label: 'SWIFT Code',
    category: FIELD_CATEGORIES.PAYMENT,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: 'SWIFT代碼',
    aliases: ['swift', 'bic'],
    validationPattern: '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$',
    example: 'HSBCHKHH',
  },
  REMITTANCE_INFO: {
    name: 'remittance_info',
    label: 'Remittance Information',
    category: FIELD_CATEGORIES.PAYMENT,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '匯款資訊',
    aliases: ['remittance', 'payment info'],
    example: 'Please reference invoice number',
  },
  CREDIT_NOTE: {
    name: 'credit_note',
    label: 'Credit Note Number',
    category: FIELD_CATEGORIES.PAYMENT,
    dataType: FIELD_DATA_TYPES.STRING,
    isRequired: false,
    description: '貸項通知單號',
    aliases: ['cn', 'credit', 'credit memo'],
    example: 'CN-2024-001',
  },
} as const;

// =====================
// Helper Functions
// =====================

/**
 * 取得所有欄位名稱
 */
export function getAllFieldNames(): string[] {
  return Object.values(INVOICE_FIELDS).map((f) => f.name);
}

/**
 * 依分類取得欄位
 * @param category 欄位分類
 */
export function getFieldsByCategory(category: FieldCategory): InvoiceFieldDefinition[] {
  return Object.values(INVOICE_FIELDS).filter((f) => f.category === category);
}

/**
 * 取得必填欄位
 */
export function getRequiredFields(): InvoiceFieldDefinition[] {
  return Object.values(INVOICE_FIELDS).filter((f) => f.isRequired);
}

/**
 * 依欄位名稱取得定義
 * @param fieldName 欄位名稱
 */
export function getFieldDefinition(fieldName: string): InvoiceFieldDefinition | undefined {
  return Object.values(INVOICE_FIELDS).find((f) => f.name === fieldName);
}

/**
 * 依別名尋找欄位
 * @param alias 別名
 */
export function findFieldByAlias(alias: string): InvoiceFieldDefinition | undefined {
  const normalizedAlias = alias.toLowerCase().trim();
  return Object.values(INVOICE_FIELDS).find(
    (f) =>
      f.name === normalizedAlias ||
      f.label.toLowerCase() === normalizedAlias ||
      f.aliases?.some((a) => a.toLowerCase() === normalizedAlias)
  );
}

/**
 * 取得欄位總數
 */
export function getTotalFieldCount(): number {
  return Object.keys(INVOICE_FIELDS).length;
}

/**
 * 取得分類統計
 */
export function getCategoryStats(): Record<FieldCategory, number> {
  const stats: Record<string, number> = {};
  for (const category of Object.values(FIELD_CATEGORIES)) {
    stats[category] = getFieldsByCategory(category).length;
  }
  return stats as Record<FieldCategory, number>;
}
