# Story 2-4: Field Mapping & Extraction - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 2-4-field-mapping-extraction

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 2.4 |
| Epic | Epic 2: Manual Invoice Upload & AI Processing |
| Estimated Effort | Large |
| Dependencies | Story 2.3 (Forwarder identification) |
| Blocking | Story 2.5 ~ 2.7 |
| FR Coverage | FR6 |

---

## Objective

Implement a field mapping system that extracts data from OCR results and maps them to approximately 90 standardized invoice header fields. The system applies Forwarder-specific mapping rules with priority ordering, tracks extraction sources, and handles unmapped fields appropriately.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Apply Forwarder mapping rules | Rule-based extraction with ~90 fields |
| AC2 | Field value extraction | Regex/keyword/position extraction with source tracking |
| AC3 | Unmapped field handling | Null value with reason tracking |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Field Mapping Pipeline                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   OcrResult  │────▶│  Mapping     │────▶│  ExtractionResult        │ │
│  │   + Rules    │     │  Service     │     │  (~90 fields)            │ │
│  └──────────────┘     │  (Python)    │     └──────────────────────────┘ │
│                       └──────────────┘                                   │
│                              │                                           │
│                              │                                           │
│  ┌───────────────────────────┼───────────────────────────┐              │
│  │                           ▼                            │              │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │              │
│  │  │ Regex        │  │ Keyword      │  │ Position     │ │              │
│  │  │ Matcher      │  │ Matcher      │  │ Matcher      │ │              │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │              │
│  │              Extraction Strategies                     │              │
│  └────────────────────────────────────────────────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Phase 1: Database Schema (15 min)

#### Step 1.1: Add Extraction Models to Prisma

Update `prisma/schema.prisma`:

```prisma
// ===========================================
// Field Mapping Models
// ===========================================

model MappingRule {
  id                String    @id @default(uuid())
  forwarderId       String?   @map("forwarder_id")  // null = Universal rule

  // Rule Definition
  fieldName         String    @map("field_name")
  fieldLabel        String    @map("field_label")
  extractionPattern Json      @map("extraction_pattern")
  // extractionPattern: {
  //   type: 'regex' | 'keyword' | 'position' | 'azure_field',
  //   value: string,
  //   flags?: string,
  //   groupIndex?: number,
  //   preprocessor?: string  // trim, uppercase, lowercase
  // }

  // Configuration
  priority          Int       @default(0)
  isRequired        Boolean   @default(false) @map("is_required")
  isActive          Boolean   @default(true) @map("is_active")
  validationPattern String?   @map("validation_pattern")  // Regex for validation
  defaultValue      String?   @map("default_value")

  // Metadata
  category          String?   // Basic, Shipper, Consignee, Shipping, Charges, etc.
  description       String?

  // Timestamps
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  // Relations
  forwarder         Forwarder? @relation(fields: [forwarderId], references: [id])

  @@unique([forwarderId, fieldName])
  @@index([forwarderId])
  @@index([fieldName])
  @@index([isActive])
  @@map("mapping_rules")
}

model ExtractionResult {
  id                String           @id @default(uuid())
  documentId        String           @unique @map("document_id")
  forwarderId       String?          @map("forwarder_id")

  // Extraction Output
  fieldMappings     Json             @map("field_mappings")
  // fieldMappings: { [fieldName]: FieldMapping }

  // Summary Statistics
  totalFields       Int              @map("total_fields")
  mappedFields      Int              @map("mapped_fields")
  unmappedFields    Int              @map("unmapped_fields")
  averageConfidence Float            @map("average_confidence")

  // Processing Info
  processingTime    Int?             @map("processing_time")  // ms
  rulesApplied      Int              @map("rules_applied")
  status            ExtractionStatus @default(PENDING)
  errorMessage      String?          @map("error_message")

  // Timestamps
  createdAt         DateTime         @default(now()) @map("created_at")
  updatedAt         DateTime         @updatedAt @map("updated_at")

  // Relations
  document          Document         @relation(fields: [documentId], references: [id], onDelete: Cascade)
  forwarder         Forwarder?       @relation(fields: [forwarderId], references: [id])

  @@index([documentId])
  @@index([forwarderId])
  @@index([status])
  @@map("extraction_results")
}

enum ExtractionStatus {
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL       // Some fields failed
  FAILED
}
```

#### Step 1.2: Run Migration

```bash
npx prisma migrate dev --name add_field_mapping
npx prisma generate
```

---

### Phase 2: Standard Field Definitions (20 min)

#### Step 2.1: Create Invoice Fields Type Definition

Create `src/types/invoice-fields.ts`:

```typescript
/**
 * Standard Invoice Field Definitions
 * Approximately 90 fields covering all invoice header information
 */

export type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'currency' | 'weight'

export interface FieldDefinition {
  label: string
  labelZh: string      // Chinese label
  type: FieldType
  required: boolean
  category: FieldCategory
  format?: string      // Expected format description
  validation?: string  // Regex pattern for validation
}

export type FieldCategory =
  | 'basic'           // Basic invoice info
  | 'shipper'         // Shipper/Sender info
  | 'consignee'       // Consignee/Receiver info
  | 'shipping'        // Shipping/Transport info
  | 'package'         // Package details
  | 'charges'         // Charges and fees
  | 'customs'         // Customs/Duties info
  | 'payment'         // Payment info
  | 'reference'       // Reference numbers
  | 'service'         // Service details
  | 'other'           // Other fields

/**
 * Standard Invoice Header Fields (~90 fields)
 */
export const INVOICE_FIELDS: Record<string, FieldDefinition> = {
  // ===========================================
  // Basic Information (10 fields)
  // ===========================================
  invoiceNumber: {
    label: 'Invoice Number',
    labelZh: '發票號碼',
    type: 'string',
    required: true,
    category: 'basic'
  },
  invoiceDate: {
    label: 'Invoice Date',
    labelZh: '發票日期',
    type: 'date',
    required: true,
    category: 'basic',
    format: 'YYYY-MM-DD'
  },
  dueDate: {
    label: 'Due Date',
    labelZh: '到期日',
    type: 'date',
    required: false,
    category: 'basic',
    format: 'YYYY-MM-DD'
  },
  invoiceType: {
    label: 'Invoice Type',
    labelZh: '發票類型',
    type: 'string',
    required: false,
    category: 'basic'
  },
  accountNumber: {
    label: 'Account Number',
    labelZh: '帳戶號碼',
    type: 'string',
    required: false,
    category: 'basic'
  },
  billingPeriod: {
    label: 'Billing Period',
    labelZh: '帳單週期',
    type: 'string',
    required: false,
    category: 'basic'
  },
  statementDate: {
    label: 'Statement Date',
    labelZh: '對帳單日期',
    type: 'date',
    required: false,
    category: 'basic'
  },
  customerNumber: {
    label: 'Customer Number',
    labelZh: '客戶編號',
    type: 'string',
    required: false,
    category: 'basic'
  },
  costCenter: {
    label: 'Cost Center',
    labelZh: '成本中心',
    type: 'string',
    required: false,
    category: 'basic'
  },
  department: {
    label: 'Department',
    labelZh: '部門',
    type: 'string',
    required: false,
    category: 'basic'
  },

  // ===========================================
  // Shipper Information (12 fields)
  // ===========================================
  shipperName: {
    label: 'Shipper Name',
    labelZh: '發貨人名稱',
    type: 'string',
    required: true,
    category: 'shipper'
  },
  shipperCompany: {
    label: 'Shipper Company',
    labelZh: '發貨人公司',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperAddress1: {
    label: 'Shipper Address Line 1',
    labelZh: '發貨人地址1',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperAddress2: {
    label: 'Shipper Address Line 2',
    labelZh: '發貨人地址2',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperCity: {
    label: 'Shipper City',
    labelZh: '發貨人城市',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperState: {
    label: 'Shipper State/Province',
    labelZh: '發貨人州/省',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperPostalCode: {
    label: 'Shipper Postal Code',
    labelZh: '發貨人郵遞區號',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperCountry: {
    label: 'Shipper Country',
    labelZh: '發貨人國家',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperPhone: {
    label: 'Shipper Phone',
    labelZh: '發貨人電話',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperEmail: {
    label: 'Shipper Email',
    labelZh: '發貨人電郵',
    type: 'string',
    required: false,
    category: 'shipper',
    validation: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$'
  },
  shipperTaxId: {
    label: 'Shipper Tax ID',
    labelZh: '發貨人稅號',
    type: 'string',
    required: false,
    category: 'shipper'
  },
  shipperAccountNumber: {
    label: 'Shipper Account Number',
    labelZh: '發貨人帳號',
    type: 'string',
    required: false,
    category: 'shipper'
  },

  // ===========================================
  // Consignee Information (12 fields)
  // ===========================================
  consigneeName: {
    label: 'Consignee Name',
    labelZh: '收貨人名稱',
    type: 'string',
    required: true,
    category: 'consignee'
  },
  consigneeCompany: {
    label: 'Consignee Company',
    labelZh: '收貨人公司',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneeAddress1: {
    label: 'Consignee Address Line 1',
    labelZh: '收貨人地址1',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneeAddress2: {
    label: 'Consignee Address Line 2',
    labelZh: '收貨人地址2',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneeCity: {
    label: 'Consignee City',
    labelZh: '收貨人城市',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneeState: {
    label: 'Consignee State/Province',
    labelZh: '收貨人州/省',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneePostalCode: {
    label: 'Consignee Postal Code',
    labelZh: '收貨人郵遞區號',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneeCountry: {
    label: 'Consignee Country',
    labelZh: '收貨人國家',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneePhone: {
    label: 'Consignee Phone',
    labelZh: '收貨人電話',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneeEmail: {
    label: 'Consignee Email',
    labelZh: '收貨人電郵',
    type: 'string',
    required: false,
    category: 'consignee',
    validation: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$'
  },
  consigneeTaxId: {
    label: 'Consignee Tax ID',
    labelZh: '收貨人稅號',
    type: 'string',
    required: false,
    category: 'consignee'
  },
  consigneeContactName: {
    label: 'Consignee Contact',
    labelZh: '收貨人聯絡人',
    type: 'string',
    required: false,
    category: 'consignee'
  },

  // ===========================================
  // Shipping Information (15 fields)
  // ===========================================
  trackingNumber: {
    label: 'Tracking Number',
    labelZh: '追蹤號碼',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  waybillNumber: {
    label: 'Waybill Number',
    labelZh: '運單號碼',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  masterWaybill: {
    label: 'Master Waybill',
    labelZh: '主運單號',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  houseWaybill: {
    label: 'House Waybill',
    labelZh: '分運單號',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  serviceType: {
    label: 'Service Type',
    labelZh: '服務類型',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  shipmentDate: {
    label: 'Shipment Date',
    labelZh: '出貨日期',
    type: 'date',
    required: false,
    category: 'shipping'
  },
  deliveryDate: {
    label: 'Delivery Date',
    labelZh: '送達日期',
    type: 'date',
    required: false,
    category: 'shipping'
  },
  origin: {
    label: 'Origin',
    labelZh: '起運地',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  destination: {
    label: 'Destination',
    labelZh: '目的地',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  originCountry: {
    label: 'Origin Country',
    labelZh: '起運國家',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  destinationCountry: {
    label: 'Destination Country',
    labelZh: '目的國家',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  transitTime: {
    label: 'Transit Time',
    labelZh: '運輸時間',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  shipmentMode: {
    label: 'Shipment Mode',
    labelZh: '運輸方式',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  incoterms: {
    label: 'Incoterms',
    labelZh: '貿易條件',
    type: 'string',
    required: false,
    category: 'shipping'
  },
  routeInfo: {
    label: 'Route Information',
    labelZh: '路線資訊',
    type: 'string',
    required: false,
    category: 'shipping'
  },

  // ===========================================
  // Package Information (10 fields)
  // ===========================================
  totalPieces: {
    label: 'Total Pieces',
    labelZh: '總件數',
    type: 'number',
    required: false,
    category: 'package'
  },
  totalWeight: {
    label: 'Total Weight',
    labelZh: '總重量',
    type: 'weight',
    required: false,
    category: 'package'
  },
  weightUnit: {
    label: 'Weight Unit',
    labelZh: '重量單位',
    type: 'string',
    required: false,
    category: 'package'
  },
  chargeableWeight: {
    label: 'Chargeable Weight',
    labelZh: '計費重量',
    type: 'weight',
    required: false,
    category: 'package'
  },
  actualWeight: {
    label: 'Actual Weight',
    labelZh: '實際重量',
    type: 'weight',
    required: false,
    category: 'package'
  },
  volumetricWeight: {
    label: 'Volumetric Weight',
    labelZh: '材積重量',
    type: 'weight',
    required: false,
    category: 'package'
  },
  dimensions: {
    label: 'Dimensions (LxWxH)',
    labelZh: '尺寸',
    type: 'string',
    required: false,
    category: 'package'
  },
  packageType: {
    label: 'Package Type',
    labelZh: '包裝類型',
    type: 'string',
    required: false,
    category: 'package'
  },
  goodsDescription: {
    label: 'Goods Description',
    labelZh: '貨物描述',
    type: 'string',
    required: false,
    category: 'package'
  },
  declaredValue: {
    label: 'Declared Value',
    labelZh: '申報價值',
    type: 'currency',
    required: false,
    category: 'package'
  },

  // ===========================================
  // Charges Information (20 fields)
  // ===========================================
  totalAmount: {
    label: 'Total Amount',
    labelZh: '總金額',
    type: 'currency',
    required: true,
    category: 'charges'
  },
  currency: {
    label: 'Currency',
    labelZh: '幣別',
    type: 'string',
    required: true,
    category: 'charges'
  },
  subtotal: {
    label: 'Subtotal',
    labelZh: '小計',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  freightCharge: {
    label: 'Freight Charge',
    labelZh: '運費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  fuelSurcharge: {
    label: 'Fuel Surcharge',
    labelZh: '燃油附加費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  handlingFee: {
    label: 'Handling Fee',
    labelZh: '處理費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  insuranceFee: {
    label: 'Insurance Fee',
    labelZh: '保險費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  customsFee: {
    label: 'Customs Fee',
    labelZh: '報關費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  dutyTax: {
    label: 'Duty/Tax',
    labelZh: '關稅',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  vatAmount: {
    label: 'VAT Amount',
    labelZh: '增值稅',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  gstAmount: {
    label: 'GST Amount',
    labelZh: 'GST',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  securitySurcharge: {
    label: 'Security Surcharge',
    labelZh: '安全附加費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  peakSeasonSurcharge: {
    label: 'Peak Season Surcharge',
    labelZh: '旺季附加費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  residentialSurcharge: {
    label: 'Residential Surcharge',
    labelZh: '住宅配送費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  remoteAreaSurcharge: {
    label: 'Remote Area Surcharge',
    labelZh: '偏遠地區附加費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  oversizeSurcharge: {
    label: 'Oversize Surcharge',
    labelZh: '超尺寸附加費',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  discount: {
    label: 'Discount',
    labelZh: '折扣',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  creditApplied: {
    label: 'Credit Applied',
    labelZh: '已用信用額',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  previousBalance: {
    label: 'Previous Balance',
    labelZh: '前期餘額',
    type: 'currency',
    required: false,
    category: 'charges'
  },
  amountDue: {
    label: 'Amount Due',
    labelZh: '應付金額',
    type: 'currency',
    required: false,
    category: 'charges'
  },

  // ===========================================
  // Reference Numbers (8 fields)
  // ===========================================
  poNumber: {
    label: 'PO Number',
    labelZh: '採購單號',
    type: 'string',
    required: false,
    category: 'reference'
  },
  referenceNumber: {
    label: 'Reference Number',
    labelZh: '參考編號',
    type: 'string',
    required: false,
    category: 'reference'
  },
  customerReference: {
    label: 'Customer Reference',
    labelZh: '客戶參考號',
    type: 'string',
    required: false,
    category: 'reference'
  },
  jobNumber: {
    label: 'Job Number',
    labelZh: '工作編號',
    type: 'string',
    required: false,
    category: 'reference'
  },
  bookingNumber: {
    label: 'Booking Number',
    labelZh: '訂艙編號',
    type: 'string',
    required: false,
    category: 'reference'
  },
  containerNumber: {
    label: 'Container Number',
    labelZh: '貨櫃編號',
    type: 'string',
    required: false,
    category: 'reference'
  },
  sealNumber: {
    label: 'Seal Number',
    labelZh: '封條號碼',
    type: 'string',
    required: false,
    category: 'reference'
  },
  blNumber: {
    label: 'B/L Number',
    labelZh: '提單號碼',
    type: 'string',
    required: false,
    category: 'reference'
  },

  // ===========================================
  // Payment Information (5 fields)
  // ===========================================
  paymentTerms: {
    label: 'Payment Terms',
    labelZh: '付款條件',
    type: 'string',
    required: false,
    category: 'payment'
  },
  paymentMethod: {
    label: 'Payment Method',
    labelZh: '付款方式',
    type: 'string',
    required: false,
    category: 'payment'
  },
  bankDetails: {
    label: 'Bank Details',
    labelZh: '銀行資訊',
    type: 'string',
    required: false,
    category: 'payment'
  },
  paymentStatus: {
    label: 'Payment Status',
    labelZh: '付款狀態',
    type: 'string',
    required: false,
    category: 'payment'
  },
  lastPaymentDate: {
    label: 'Last Payment Date',
    labelZh: '上次付款日期',
    type: 'date',
    required: false,
    category: 'payment'
  }
} as const

export type InvoiceFieldName = keyof typeof INVOICE_FIELDS
export const FIELD_COUNT = Object.keys(INVOICE_FIELDS).length

/**
 * Get fields by category
 */
export function getFieldsByCategory(category: FieldCategory): string[] {
  return Object.entries(INVOICE_FIELDS)
    .filter(([_, def]) => def.category === category)
    .map(([name]) => name)
}

/**
 * Get required fields
 */
export function getRequiredFields(): string[] {
  return Object.entries(INVOICE_FIELDS)
    .filter(([_, def]) => def.required)
    .map(([name]) => name)
}
```

---

### Phase 3: Field Mapping Types (10 min)

#### Step 3.1: Create Mapping Types

Create `src/types/field-mapping.ts`:

```typescript
/**
 * Field mapping type definitions
 */

export type ExtractionMethod = 'regex' | 'keyword' | 'position' | 'azure_field' | 'default'

export interface ExtractionSource {
  page: number
  position?: {
    x: number
    y: number
    width?: number
    height?: number
  }
  text: string              // Original extracted text
  boundingBox?: number[]    // Azure DI bounding box
}

export interface FieldMapping {
  value: string | number | null
  normalizedValue?: string | number | null  // After normalization
  source: ExtractionSource | null
  confidence: number        // 0-100
  method: ExtractionMethod
  ruleId: string | null
  isValid: boolean          // Passed validation
  validationError?: string  // If validation failed
  isEmpty: boolean
  emptyReason?: string      // Why field is empty
}

export type FieldMappings = Record<string, FieldMapping>

export interface ExtractionSummary {
  totalFields: number
  mappedFields: number
  unmappedFields: number
  validFields: number
  invalidFields: number
  averageConfidence: number
  byCategory: Record<string, {
    total: number
    mapped: number
    avgConfidence: number
  }>
}

export interface MappingRuleInput {
  id: string
  forwarderId: string | null
  fieldName: string
  extractionPattern: {
    type: ExtractionMethod
    value: string
    flags?: string
    groupIndex?: number
    preprocessor?: 'trim' | 'uppercase' | 'lowercase' | 'none'
  }
  priority: number
  validationPattern?: string
  defaultValue?: string
}
```

---

### Phase 4: Python Mapping Service (40 min)

#### Step 4.1: Create Mapper Module

Create `python-services/mapping/mapper.py`:

```python
"""
Field mapping logic with multiple extraction strategies
"""
import re
import structlog
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime

from models import (
    MappingRuleInput,
    FieldMapping,
    ExtractionSource,
    MapFieldsRequest,
    MapFieldsResponse,
    ExtractionSummary
)
from config import get_settings

logger = structlog.get_logger()
settings = get_settings()


@dataclass
class MatchResult:
    """Result of pattern matching"""
    value: str
    text: str
    page: int
    position: Optional[Dict[str, float]] = None
    confidence: float = 0.0


class FieldMapper:
    """
    Maps OCR text to standardized invoice fields using rules
    """

    def map_fields(
        self,
        document_id: str,
        extracted_text: str,
        ocr_result: Dict[str, Any],
        rules: List[MappingRuleInput],
        invoice_data: Optional[Dict[str, Any]] = None
    ) -> MapFieldsResponse:
        """
        Map extracted text to invoice fields

        Args:
            document_id: Document identifier
            extracted_text: Full extracted text
            ocr_result: Raw OCR result with page/position info
            rules: Mapping rules sorted by priority
            invoice_data: Pre-extracted invoice data from Azure DI

        Returns:
            MapFieldsResponse with all field mappings
        """
        start_time = datetime.now()
        field_mappings: Dict[str, FieldMapping] = {}
        rules_applied = 0

        logger.info(
            "Starting field mapping",
            document_id=document_id,
            rule_count=len(rules),
            text_length=len(extracted_text)
        )

        # Group rules by field name
        rules_by_field: Dict[str, List[MappingRuleInput]] = {}
        for rule in rules:
            if rule.fieldName not in rules_by_field:
                rules_by_field[rule.fieldName] = []
            rules_by_field[rule.fieldName].append(rule)

        # Sort each field's rules by priority (higher first)
        for field_name in rules_by_field:
            rules_by_field[field_name].sort(
                key=lambda r: r.priority,
                reverse=True
            )

        # Process each field
        for field_name, field_rules in rules_by_field.items():
            mapping = self._extract_field(
                field_name,
                field_rules,
                extracted_text,
                ocr_result,
                invoice_data
            )
            field_mappings[field_name] = mapping
            if mapping.ruleId:
                rules_applied += 1

        # Calculate summary
        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
        summary = self._calculate_summary(field_mappings)

        logger.info(
            "Field mapping completed",
            document_id=document_id,
            mapped=summary.mappedFields,
            unmapped=summary.unmappedFields,
            avg_confidence=summary.averageConfidence,
            processing_time_ms=processing_time
        )

        return MapFieldsResponse(
            document_id=document_id,
            field_mappings=field_mappings,
            summary=summary,
            rules_applied=rules_applied,
            processing_time_ms=processing_time
        )

    def _extract_field(
        self,
        field_name: str,
        rules: List[MappingRuleInput],
        text: str,
        ocr_result: Dict[str, Any],
        invoice_data: Optional[Dict[str, Any]]
    ) -> FieldMapping:
        """Extract a single field using available rules"""

        # Try Azure DI pre-extracted data first
        if invoice_data:
            azure_value = self._get_azure_field(field_name, invoice_data)
            if azure_value:
                return FieldMapping(
                    value=azure_value.value,
                    normalizedValue=self._normalize_value(azure_value.value, field_name),
                    source=ExtractionSource(
                        page=azure_value.page,
                        text=azure_value.text,
                        position=azure_value.position
                    ),
                    confidence=azure_value.confidence,
                    method='azure_field',
                    ruleId=None,
                    isValid=True,
                    isEmpty=False
                )

        # Try each rule in priority order
        for rule in rules:
            result = self._apply_rule(rule, text, ocr_result)
            if result:
                normalized = self._normalize_value(result.value, field_name)
                is_valid, validation_error = self._validate_value(
                    normalized,
                    rule.validationPattern
                )

                return FieldMapping(
                    value=result.value,
                    normalizedValue=normalized,
                    source=ExtractionSource(
                        page=result.page,
                        text=result.text,
                        position=result.position
                    ),
                    confidence=result.confidence,
                    method=rule.extractionPattern.type,
                    ruleId=rule.id,
                    isValid=is_valid,
                    validationError=validation_error,
                    isEmpty=False
                )

        # No match found - use default if available
        default_rule = next(
            (r for r in rules if r.defaultValue is not None),
            None
        )

        if default_rule and default_rule.defaultValue:
            return FieldMapping(
                value=default_rule.defaultValue,
                normalizedValue=default_rule.defaultValue,
                source=None,
                confidence=50.0,
                method='default',
                ruleId=default_rule.id,
                isValid=True,
                isEmpty=False
            )

        # Return empty mapping
        return FieldMapping(
            value=None,
            normalizedValue=None,
            source=None,
            confidence=0.0,
            method='regex',
            ruleId=None,
            isValid=True,
            isEmpty=True,
            emptyReason='No matching rule found'
        )

    def _apply_rule(
        self,
        rule: MappingRuleInput,
        text: str,
        ocr_result: Dict[str, Any]
    ) -> Optional[MatchResult]:
        """Apply a single extraction rule"""
        pattern = rule.extractionPattern
        extraction_type = pattern.type

        if extraction_type == 'regex':
            return self._apply_regex(pattern, text)
        elif extraction_type == 'keyword':
            return self._apply_keyword(pattern, text)
        elif extraction_type == 'position':
            return self._apply_position(pattern, ocr_result)

        return None

    def _apply_regex(
        self,
        pattern: Dict[str, Any],
        text: str
    ) -> Optional[MatchResult]:
        """Apply regex extraction"""
        try:
            flags = 0
            if pattern.get('flags'):
                if 'i' in pattern['flags']:
                    flags |= re.IGNORECASE
                if 'm' in pattern['flags']:
                    flags |= re.MULTILINE

            regex = re.compile(pattern['value'], flags)
            match = regex.search(text)

            if match:
                group_index = pattern.get('groupIndex', 0)
                if group_index > 0 and match.groups():
                    value = match.group(group_index)
                else:
                    value = match.group(0)

                # Apply preprocessor
                value = self._preprocess(value, pattern.get('preprocessor'))

                return MatchResult(
                    value=value,
                    text=match.group(0),
                    page=1,  # Default to page 1 for text extraction
                    confidence=85.0
                )
        except re.error as e:
            logger.warning("Invalid regex pattern", pattern=pattern['value'], error=str(e))

        return None

    def _apply_keyword(
        self,
        pattern: Dict[str, Any],
        text: str
    ) -> Optional[MatchResult]:
        """Apply keyword-based extraction"""
        keyword = pattern['value'].lower()
        text_lower = text.lower()

        if keyword in text_lower:
            # Find the line containing the keyword
            lines = text.split('\n')
            for line in lines:
                if keyword in line.lower():
                    # Extract value after keyword
                    idx = line.lower().index(keyword)
                    value_part = line[idx + len(keyword):].strip()

                    # Clean up common separators
                    value_part = value_part.lstrip(':;=').strip()

                    if value_part:
                        return MatchResult(
                            value=value_part,
                            text=line,
                            page=1,
                            confidence=70.0
                        )

        return None

    def _apply_position(
        self,
        pattern: Dict[str, Any],
        ocr_result: Dict[str, Any]
    ) -> Optional[MatchResult]:
        """Apply position-based extraction from OCR result"""
        # Parse position pattern: "page:row:col" or "page:x:y:w:h"
        try:
            parts = pattern['value'].split(':')
            page_num = int(parts[0])

            pages = ocr_result.get('pages', [])
            if page_num <= len(pages):
                page = pages[page_num - 1]
                lines = page.get('lines', [])

                if len(parts) == 3:
                    # row:col format
                    row = int(parts[1])
                    if row <= len(lines):
                        line = lines[row - 1]
                        return MatchResult(
                            value=line['content'],
                            text=line['content'],
                            page=page_num,
                            confidence=75.0
                        )
        except (ValueError, IndexError, KeyError) as e:
            logger.warning("Position extraction failed", pattern=pattern, error=str(e))

        return None

    def _get_azure_field(
        self,
        field_name: str,
        invoice_data: Dict[str, Any]
    ) -> Optional[MatchResult]:
        """Get pre-extracted field from Azure DI invoice data"""
        # Map standard field names to Azure DI field names
        azure_field_map = {
            'invoiceNumber': 'InvoiceId',
            'invoiceDate': 'InvoiceDate',
            'dueDate': 'DueDate',
            'shipperName': 'VendorName',
            'shipperAddress1': 'VendorAddress',
            'consigneeName': 'CustomerName',
            'consigneeAddress1': 'CustomerAddress',
            'totalAmount': 'InvoiceTotal',
            'amountDue': 'AmountDue',
            'subtotal': 'SubTotal',
            'vatAmount': 'TotalTax',
            'poNumber': 'PurchaseOrder',
            'currency': 'CurrencyCode'
        }

        azure_name = azure_field_map.get(field_name)
        if not azure_name or azure_name not in invoice_data:
            return None

        field_data = invoice_data[azure_name]
        if not field_data or not field_data.get('value'):
            return None

        return MatchResult(
            value=str(field_data['value']),
            text=str(field_data['value']),
            page=1,
            confidence=field_data.get('confidence', 90) * 100
        )

    def _normalize_value(self, value: str, field_name: str) -> str:
        """Normalize extracted value based on field type"""
        if not value:
            return value

        # Date normalization
        if 'date' in field_name.lower():
            return self._normalize_date(value)

        # Amount normalization
        if any(x in field_name.lower() for x in ['amount', 'charge', 'fee', 'total', 'tax']):
            return self._normalize_amount(value)

        return value.strip()

    def _normalize_date(self, value: str) -> str:
        """Normalize date to YYYY-MM-DD format"""
        # Common date formats to try
        formats = [
            '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y',
            '%d-%m-%Y', '%Y/%m/%d', '%d.%m.%Y',
            '%B %d, %Y', '%d %B %Y', '%b %d, %Y'
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(value.strip(), fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue

        return value  # Return original if can't parse

    def _normalize_amount(self, value: str) -> str:
        """Normalize currency amount"""
        # Remove currency symbols and thousands separators
        cleaned = re.sub(r'[^\d.,\-]', '', value)

        # Handle comma as decimal separator
        if ',' in cleaned and '.' not in cleaned:
            cleaned = cleaned.replace(',', '.')
        elif ',' in cleaned and '.' in cleaned:
            cleaned = cleaned.replace(',', '')

        return cleaned

    def _preprocess(self, value: str, preprocessor: Optional[str]) -> str:
        """Apply preprocessor to value"""
        if not value or not preprocessor:
            return value

        if preprocessor == 'trim':
            return value.strip()
        elif preprocessor == 'uppercase':
            return value.upper()
        elif preprocessor == 'lowercase':
            return value.lower()

        return value

    def _validate_value(
        self,
        value: Optional[str],
        validation_pattern: Optional[str]
    ) -> Tuple[bool, Optional[str]]:
        """Validate extracted value"""
        if not value or not validation_pattern:
            return True, None

        try:
            if re.match(validation_pattern, value):
                return True, None
            else:
                return False, f"Value '{value}' does not match pattern"
        except re.error:
            return True, None

    def _calculate_summary(
        self,
        field_mappings: Dict[str, FieldMapping]
    ) -> ExtractionSummary:
        """Calculate extraction summary statistics"""
        total = len(field_mappings)
        mapped = sum(1 for m in field_mappings.values() if not m.isEmpty)
        valid = sum(1 for m in field_mappings.values() if m.isValid and not m.isEmpty)

        confidences = [m.confidence for m in field_mappings.values() if not m.isEmpty]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return ExtractionSummary(
            totalFields=total,
            mappedFields=mapped,
            unmappedFields=total - mapped,
            validFields=valid,
            invalidFields=mapped - valid,
            averageConfidence=round(avg_confidence, 2)
        )


# Singleton
_mapper: Optional[FieldMapper] = None


def get_mapper() -> FieldMapper:
    global _mapper
    if _mapper is None:
        _mapper = FieldMapper()
    return _mapper
```

#### Step 4.2: Update Models

Add to `python-services/mapping/models.py`:

```python
"""
Field mapping models
"""
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from enum import Enum


class ExtractionMethod(str, Enum):
    REGEX = "regex"
    KEYWORD = "keyword"
    POSITION = "position"
    AZURE_FIELD = "azure_field"
    DEFAULT = "default"


class ExtractionPatternInput(BaseModel):
    type: ExtractionMethod
    value: str
    flags: Optional[str] = None
    groupIndex: Optional[int] = Field(None, alias="group_index")
    preprocessor: Optional[str] = None


class MappingRuleInput(BaseModel):
    id: str
    forwarderId: Optional[str] = Field(None, alias="forwarder_id")
    fieldName: str = Field(..., alias="field_name")
    extractionPattern: ExtractionPatternInput = Field(..., alias="extraction_pattern")
    priority: int = 0
    validationPattern: Optional[str] = Field(None, alias="validation_pattern")
    defaultValue: Optional[str] = Field(None, alias="default_value")

    class Config:
        populate_by_name = True


class ExtractionSource(BaseModel):
    page: int
    text: str
    position: Optional[Dict[str, float]] = None
    boundingBox: Optional[List[float]] = Field(None, alias="bounding_box")


class FieldMapping(BaseModel):
    value: Optional[str] = None
    normalizedValue: Optional[str] = Field(None, alias="normalized_value")
    source: Optional[ExtractionSource] = None
    confidence: float
    method: str
    ruleId: Optional[str] = Field(None, alias="rule_id")
    isValid: bool = Field(True, alias="is_valid")
    validationError: Optional[str] = Field(None, alias="validation_error")
    isEmpty: bool = Field(True, alias="is_empty")
    emptyReason: Optional[str] = Field(None, alias="empty_reason")


class ExtractionSummary(BaseModel):
    totalFields: int = Field(..., alias="total_fields")
    mappedFields: int = Field(..., alias="mapped_fields")
    unmappedFields: int = Field(..., alias="unmapped_fields")
    validFields: int = Field(..., alias="valid_fields")
    invalidFields: int = Field(..., alias="invalid_fields")
    averageConfidence: float = Field(..., alias="average_confidence")


class MapFieldsRequest(BaseModel):
    document_id: str
    forwarder_id: Optional[str] = None
    extracted_text: str
    ocr_result: Dict[str, Any]
    mapping_rules: List[MappingRuleInput]
    invoice_data: Optional[Dict[str, Any]] = None


class MapFieldsResponse(BaseModel):
    document_id: str
    field_mappings: Dict[str, FieldMapping]
    summary: ExtractionSummary
    rules_applied: int
    processing_time_ms: int
```

#### Step 4.3: Update FastAPI Endpoint

Add to `python-services/mapping/main.py`:

```python
from mapper import get_mapper
from models import MapFieldsRequest, MapFieldsResponse

@app.post("/map-fields", response_model=MapFieldsResponse)
async def map_fields(request: MapFieldsRequest):
    """
    Map OCR extracted text to invoice fields

    Applies mapping rules in priority order to extract field values.
    """
    mapper = get_mapper()

    return mapper.map_fields(
        document_id=request.document_id,
        extracted_text=request.extracted_text,
        ocr_result=request.ocr_result,
        rules=request.mapping_rules,
        invoice_data=request.invoice_data
    )
```

---

### Phase 5: Next.js Mapping Service (25 min)

#### Step 5.1: Mapping Service Layer

Create `src/services/mapping.service.ts`:

```typescript
/**
 * Mapping Service
 * Handles field mapping for invoice documents
 */

import { prisma } from '@/lib/prisma'
import { DocumentStatus, ExtractionStatus } from '@prisma/client'
import type { FieldMappings, ExtractionSummary } from '@/types/field-mapping'

const MAPPING_SERVICE_URL = process.env.MAPPING_SERVICE_URL || 'http://localhost:8002'

/**
 * Perform field mapping for a document
 */
export async function mapDocumentFields(documentId: string): Promise<{
  fieldMappings: FieldMappings
  summary: ExtractionSummary
}> {
  // Get document with OCR result and forwarder
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      ocrResults: true,
      forwarder: true
    }
  })

  if (!document) {
    throw new Error(`Document not found: ${documentId}`)
  }

  if (!document.ocrResults || document.ocrResults.length === 0) {
    throw new Error('No OCR result available')
  }

  const ocrResult = document.ocrResults[0]

  // Update document status
  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.MAPPING_PROCESSING }
  })

  try {
    // Get applicable mapping rules
    const rules = await getMappingRules(document.forwarderId)

    // Call Python mapping service
    const response = await fetch(`${MAPPING_SERVICE_URL}/map-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: documentId,
        forwarder_id: document.forwarderId,
        extracted_text: ocrResult.extractedText,
        ocr_result: ocrResult.rawResult,
        mapping_rules: rules.map(r => ({
          id: r.id,
          forwarder_id: r.forwarderId,
          field_name: r.fieldName,
          extraction_pattern: r.extractionPattern,
          priority: r.priority,
          validation_pattern: r.validationPattern,
          default_value: r.defaultValue
        })),
        invoice_data: ocrResult.invoiceData
      }),
      signal: AbortSignal.timeout(60000)  // 60s timeout
    })

    if (!response.ok) {
      throw new Error(`Mapping service error: ${response.statusText}`)
    }

    const result = await response.json()

    // Save extraction result
    await prisma.extractionResult.upsert({
      where: { documentId },
      create: {
        documentId,
        forwarderId: document.forwarderId,
        fieldMappings: result.field_mappings,
        totalFields: result.summary.total_fields,
        mappedFields: result.summary.mapped_fields,
        unmappedFields: result.summary.unmapped_fields,
        averageConfidence: result.summary.average_confidence,
        processingTime: result.processing_time_ms,
        rulesApplied: result.rules_applied,
        status: ExtractionStatus.COMPLETED
      },
      update: {
        fieldMappings: result.field_mappings,
        totalFields: result.summary.total_fields,
        mappedFields: result.summary.mapped_fields,
        unmappedFields: result.summary.unmapped_fields,
        averageConfidence: result.summary.average_confidence,
        processingTime: result.processing_time_ms,
        rulesApplied: result.rules_applied,
        status: ExtractionStatus.COMPLETED
      }
    })

    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.MAPPING_COMPLETED }
    })

    return {
      fieldMappings: result.field_mappings,
      summary: {
        totalFields: result.summary.total_fields,
        mappedFields: result.summary.mapped_fields,
        unmappedFields: result.summary.unmapped_fields,
        validFields: result.summary.valid_fields,
        invalidFields: result.summary.invalid_fields,
        averageConfidence: result.summary.average_confidence,
        byCategory: {}
      }
    }

  } catch (error) {
    // Handle failure
    await prisma.$transaction([
      prisma.extractionResult.upsert({
        where: { documentId },
        create: {
          documentId,
          forwarderId: document.forwarderId,
          fieldMappings: {},
          totalFields: 0,
          mappedFields: 0,
          unmappedFields: 0,
          averageConfidence: 0,
          rulesApplied: 0,
          status: ExtractionStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        update: {
          status: ExtractionStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }),
      prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Mapping failed'
        }
      })
    ])

    throw error
  }
}

/**
 * Get extraction result for a document
 */
export async function getExtractionResult(documentId: string) {
  return prisma.extractionResult.findUnique({
    where: { documentId },
    include: {
      document: {
        select: {
          fileName: true,
          status: true
        }
      },
      forwarder: {
        select: {
          name: true,
          code: true
        }
      }
    }
  })
}

/**
 * Get mapping rules for a forwarder
 */
async function getMappingRules(forwarderId: string | null) {
  // Get forwarder-specific rules and universal rules (forwarderId = null)
  const rules = await prisma.mappingRule.findMany({
    where: {
      isActive: true,
      OR: [
        { forwarderId },
        { forwarderId: null }
      ]
    },
    orderBy: [
      { priority: 'desc' },
      { fieldName: 'asc' }
    ]
  })

  // Deduplicate - prefer forwarder-specific over universal
  const ruleMap = new Map<string, typeof rules[0]>()

  for (const rule of rules) {
    const existing = ruleMap.get(rule.fieldName)
    if (!existing || rule.forwarderId) {
      ruleMap.set(rule.fieldName, rule)
    }
  }

  return Array.from(ruleMap.values())
}
```

#### Step 5.2: Mapping API Endpoint

Create `src/app/api/mapping/route.ts`:

```typescript
/**
 * POST /api/mapping
 * Trigger field mapping for a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mapDocumentFields } from '@/services/mapping.service'
import { z } from 'zod'

const requestSchema = z.object({
  documentId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const result = await mapDocumentFields(validation.data.documentId)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Mapping API error:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message.includes('No OCR result')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### Step 5.3: Get Extraction Result API

Create `src/app/api/mapping/[documentId]/route.ts`:

```typescript
/**
 * GET /api/mapping/[documentId]
 * Get field mapping result for a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getExtractionResult } from '@/services/mapping.service'

interface RouteParams {
  params: Promise<{ documentId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params

    const result = await getExtractionResult(documentId)

    if (!result) {
      return NextResponse.json(
        { error: 'Extraction result not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Get extraction result error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

### Phase 6: Mapping Rules Seed Data (15 min)

#### Step 6.1: Create Universal Mapping Rules

Create `prisma/seed-data/mapping-rules.ts`:

```typescript
/**
 * Universal mapping rules that work across all forwarders
 */

export interface MappingRuleSeed {
  fieldName: string
  fieldLabel: string
  category: string
  extractionPattern: {
    type: 'regex' | 'keyword' | 'position' | 'azure_field'
    value: string
    flags?: string
    groupIndex?: number
    preprocessor?: string
  }
  priority: number
  validationPattern?: string
  forwarderId?: string  // null for universal
}

export const universalRules: MappingRuleSeed[] = [
  // Invoice Number patterns
  {
    fieldName: 'invoiceNumber',
    fieldLabel: 'Invoice Number',
    category: 'basic',
    extractionPattern: {
      type: 'regex',
      value: '(?:Invoice|INV|Inv)\\s*(?:#|No\\.?|Number)?\\s*[:.]?\\s*([A-Z0-9-]+)',
      flags: 'i',
      groupIndex: 1,
      preprocessor: 'trim'
    },
    priority: 100
  },
  // Invoice Date patterns
  {
    fieldName: 'invoiceDate',
    fieldLabel: 'Invoice Date',
    category: 'basic',
    extractionPattern: {
      type: 'regex',
      value: '(?:Invoice\\s+Date|Date)\\s*[:.]?\\s*(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})',
      flags: 'i',
      groupIndex: 1
    },
    priority: 100
  },
  // Total Amount patterns
  {
    fieldName: 'totalAmount',
    fieldLabel: 'Total Amount',
    category: 'charges',
    extractionPattern: {
      type: 'regex',
      value: '(?:Total|Amount\\s+Due|Grand\\s+Total)\\s*[:.]?\\s*\\$?\\s*([\\d,]+\\.?\\d*)',
      flags: 'i',
      groupIndex: 1
    },
    priority: 100
  },
  // Currency
  {
    fieldName: 'currency',
    fieldLabel: 'Currency',
    category: 'charges',
    extractionPattern: {
      type: 'regex',
      value: '(?:Currency|Curr\\.?)\\s*[:.]?\\s*([A-Z]{3})',
      flags: 'i',
      groupIndex: 1,
      preprocessor: 'uppercase'
    },
    priority: 100
  },
  // Tracking Number
  {
    fieldName: 'trackingNumber',
    fieldLabel: 'Tracking Number',
    category: 'shipping',
    extractionPattern: {
      type: 'regex',
      value: '(?:Tracking|Track|AWB|Waybill)\\s*(?:#|No\\.?)?\\s*[:.]?\\s*([A-Z0-9]+)',
      flags: 'i',
      groupIndex: 1
    },
    priority: 100
  },
  // Shipper Name - keyword based
  {
    fieldName: 'shipperName',
    fieldLabel: 'Shipper Name',
    category: 'shipper',
    extractionPattern: {
      type: 'keyword',
      value: 'shipper:',
      preprocessor: 'trim'
    },
    priority: 80
  },
  // Consignee Name - keyword based
  {
    fieldName: 'consigneeName',
    fieldLabel: 'Consignee Name',
    category: 'consignee',
    extractionPattern: {
      type: 'keyword',
      value: 'consignee:',
      preprocessor: 'trim'
    },
    priority: 80
  },
  // Weight patterns
  {
    fieldName: 'totalWeight',
    fieldLabel: 'Total Weight',
    category: 'package',
    extractionPattern: {
      type: 'regex',
      value: '(?:Weight|Wt\\.?)\\s*[:.]?\\s*([\\d.]+)\\s*(?:kg|KG|lbs?|LB)',
      flags: 'i',
      groupIndex: 1
    },
    priority: 90
  },
  // Pieces
  {
    fieldName: 'totalPieces',
    fieldLabel: 'Total Pieces',
    category: 'package',
    extractionPattern: {
      type: 'regex',
      value: '(?:Pieces|Pcs\\.?|Qty)\\s*[:.]?\\s*(\\d+)',
      flags: 'i',
      groupIndex: 1
    },
    priority: 90
  },
  // PO Number
  {
    fieldName: 'poNumber',
    fieldLabel: 'PO Number',
    category: 'reference',
    extractionPattern: {
      type: 'regex',
      value: '(?:P\\.?O\\.?|Purchase\\s+Order)\\s*(?:#|No\\.?)?\\s*[:.]?\\s*([A-Z0-9-]+)',
      flags: 'i',
      groupIndex: 1
    },
    priority: 90
  }
]

// DHL-specific rules
export const dhlRules: MappingRuleSeed[] = [
  {
    fieldName: 'waybillNumber',
    fieldLabel: 'Waybill Number',
    category: 'shipping',
    extractionPattern: {
      type: 'regex',
      value: 'DHL\\s+(?:Express\\s+)?Waybill\\s*[:.]?\\s*(\\d{10})',
      flags: 'i',
      groupIndex: 1
    },
    priority: 150  // Higher priority for forwarder-specific
  },
  {
    fieldName: 'serviceType',
    fieldLabel: 'Service Type',
    category: 'service',
    extractionPattern: {
      type: 'regex',
      value: '(?:EXPRESS\\s+WORLDWIDE|EXPRESS\\s+9:00|EXPRESS\\s+12:00|EXPRESS\\s+EASY)',
      flags: 'i'
    },
    priority: 150
  }
]

// FedEx-specific rules
export const fedexRules: MappingRuleSeed[] = [
  {
    fieldName: 'trackingNumber',
    fieldLabel: 'Tracking Number',
    category: 'shipping',
    extractionPattern: {
      type: 'regex',
      value: '(?:Tracking\\s+ID|Track\\s+#)\\s*[:.]?\\s*(\\d{12,15})',
      groupIndex: 1
    },
    priority: 150
  },
  {
    fieldName: 'serviceType',
    fieldLabel: 'Service Type',
    category: 'service',
    extractionPattern: {
      type: 'regex',
      value: '(?:INTERNATIONAL\\s+PRIORITY|INTERNATIONAL\\s+ECONOMY|EXPRESS\\s+SAVER)',
      flags: 'i'
    },
    priority: 150
  }
]
```

#### Step 6.2: Update Seed Script

Add to `prisma/seed.ts`:

```typescript
import { universalRules, dhlRules, fedexRules } from './seed-data/mapping-rules'

async function seedMappingRules() {
  console.log('Seeding Mapping Rules...')

  // Seed universal rules
  for (const rule of universalRules) {
    await prisma.mappingRule.upsert({
      where: {
        forwarderId_fieldName: {
          forwarderId: null as unknown as string,  // Prisma workaround
          fieldName: rule.fieldName
        }
      },
      create: {
        forwarderId: null,
        fieldName: rule.fieldName,
        fieldLabel: rule.fieldLabel,
        category: rule.category,
        extractionPattern: rule.extractionPattern,
        priority: rule.priority,
        validationPattern: rule.validationPattern
      },
      update: {
        extractionPattern: rule.extractionPattern,
        priority: rule.priority
      }
    })
  }
  console.log(`  ✓ ${universalRules.length} universal rules`)

  // Get DHL forwarder ID
  const dhl = await prisma.forwarder.findUnique({ where: { code: 'DHL' } })
  if (dhl) {
    for (const rule of dhlRules) {
      await prisma.mappingRule.upsert({
        where: {
          forwarderId_fieldName: {
            forwarderId: dhl.id,
            fieldName: rule.fieldName
          }
        },
        create: {
          forwarderId: dhl.id,
          fieldName: rule.fieldName,
          fieldLabel: rule.fieldLabel,
          category: rule.category,
          extractionPattern: rule.extractionPattern,
          priority: rule.priority
        },
        update: {
          extractionPattern: rule.extractionPattern,
          priority: rule.priority
        }
      })
    }
    console.log(`  ✓ ${dhlRules.length} DHL rules`)
  }

  // Get FedEx forwarder ID
  const fedex = await prisma.forwarder.findUnique({ where: { code: 'FDX' } })
  if (fedex) {
    for (const rule of fedexRules) {
      await prisma.mappingRule.upsert({
        where: {
          forwarderId_fieldName: {
            forwarderId: fedex.id,
            fieldName: rule.fieldName
          }
        },
        create: {
          forwarderId: fedex.id,
          fieldName: rule.fieldName,
          fieldLabel: rule.fieldLabel,
          category: rule.category,
          extractionPattern: rule.extractionPattern,
          priority: rule.priority
        },
        update: {
          extractionPattern: rule.extractionPattern,
          priority: rule.priority
        }
      })
    }
    console.log(`  ✓ ${fedexRules.length} FedEx rules`)
  }
}
```

---

## Testing Guide

### Integration Test

```bash
# Test mapping endpoint
curl -X POST http://localhost:8002/map-fields \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-123",
    "extracted_text": "Invoice #: INV-2024-001\nInvoice Date: 12/15/2024\nTotal: $1,234.56",
    "ocr_result": {"pages": []},
    "mapping_rules": [
      {
        "id": "rule-1",
        "field_name": "invoiceNumber",
        "extraction_pattern": {
          "type": "regex",
          "value": "Invoice\\s*#\\s*:\\s*([A-Z0-9-]+)",
          "flags": "i",
          "group_index": 1
        },
        "priority": 100
      }
    ]
  }'
```

---

## Verification Checklist

| Item | Expected Result | Status |
|------|-----------------|--------|
| Prisma migration runs | MappingRule, ExtractionResult tables | [ ] |
| Seed rules created | Universal + forwarder-specific | [ ] |
| Invoice number extraction | Correct value extracted | [ ] |
| Date normalization | YYYY-MM-DD format | [ ] |
| Amount normalization | Numeric string | [ ] |
| Priority ordering | Higher priority wins | [ ] |
| Empty field handling | isEmpty=true with reason | [ ] |
| Summary statistics | Correct counts | [ ] |

---

## Related Documentation

- [Story 2.4 User Story](./stories/2-4-field-mapping-extraction.md)
- [Story 2.3 Tech Spec](./tech-spec-story-2-3.md) (Prerequisite)
- [Invoice Fields Definition](../src/types/invoice-fields.ts)

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
