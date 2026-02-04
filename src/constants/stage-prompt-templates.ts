/**
 * @fileoverview Stage 1-3 Prompt 預設模板
 * @description
 *   為 Prompt Config 頁面提供 Stage 1-3 的預設模板，
 *   讓用戶可以快速插入標準格式的 Prompt。
 *
 *   每個 Stage 提供兩種版本：
 *   - 帶變數版：包含 ${var} 佔位符，用於生產環境
 *   - 範例版：純文字範例，用於參考學習
 *
 * @module src/constants/stage-prompt-templates
 * @since CHANGE-027 - Prompt Template Insertion
 * @lastModified 2026-02-04
 *
 * @related
 *   - src/services/extraction-v3/stages/stage-1-company.service.ts
 *   - src/services/extraction-v3/stages/stage-2-format.service.ts
 *   - src/services/extraction-v3/stages/stage-3-extraction.service.ts
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 插入模式
 */
export type InsertMode = 'override' | 'append';

/**
 * 模板版本
 */
export type TemplateVersion = 'withVariables' | 'example';

/**
 * 支援的變數定義
 */
export interface SupportedVariable {
  /** 變數名稱（含 ${}） */
  name: string;
  /** 變數說明 */
  description: string;
  /** 範例值 */
  example: string;
}

/**
 * Prompt 模板結構
 */
export interface PromptTemplate {
  /** Prompt Type 值（對應 PROMPT_TYPES） */
  promptType: string;
  /** 顯示名稱（用於 UI） */
  displayName: string;
  /** 帶變數版 System Prompt */
  systemPromptWithVariables: string;
  /** 帶變數版 User Prompt */
  userPromptWithVariables: string;
  /** 範例版 System Prompt */
  systemPromptExample: string;
  /** 範例版 User Prompt */
  userPromptExample: string;
  /** 支援的變數列表 */
  supportedVariables: SupportedVariable[];
}

// ============================================================================
// Stage 1 Template - Company Identification
// ============================================================================

const STAGE_1_TEMPLATE: PromptTemplate = {
  promptType: 'STAGE_1_COMPANY_IDENTIFICATION',
  displayName: 'Stage 1 - Company Identification',

  systemPromptWithVariables: `You are an invoice issuer identification specialist.
Your task is to identify the company that issued this invoice.

Known companies:
\${knownCompanies}

Current date: \${currentDate}
File name: \${fileName}

Identification methods (in priority order):
1. LOGO - Company logo on the document
2. HEADER - Company name in header/letterhead
3. ADDRESS - Company address information
4. TAX_ID - Tax identification number

Response format (JSON):
{
  "companyName": "string - identified company name",
  "identificationMethod": "LOGO" | "HEADER" | "ADDRESS" | "TAX_ID",
  "confidence": number (0-100),
  "matchedKnownCompany": "string | null - if matched to known company"
}`,

  userPromptWithVariables: 'Identify the issuing company from this invoice image.',

  systemPromptExample: `You are an invoice issuer identification specialist.
Your task is to identify the company that issued this invoice.

Known companies:
- DHL Express (Aliases: DHL, DHL Global)
- FedEx Corporation (Aliases: FedEx, Federal Express)
- UPS (Aliases: United Parcel Service)
- Maersk Line (Aliases: Maersk, A.P. Moller)

Current date: 2026-02-04
File name: invoice_001.pdf

Identification methods (in priority order):
1. LOGO - Company logo on the document
2. HEADER - Company name in header/letterhead
3. ADDRESS - Company address information
4. TAX_ID - Tax identification number

Response format (JSON):
{
  "companyName": "string - identified company name",
  "identificationMethod": "LOGO" | "HEADER" | "ADDRESS" | "TAX_ID",
  "confidence": number (0-100),
  "matchedKnownCompany": "string | null - if matched to known company"
}`,

  userPromptExample: 'Identify the issuing company from this invoice image.',

  supportedVariables: [
    {
      name: '${knownCompanies}',
      description: 'List of known companies with their aliases',
      example: '- DHL Express (Aliases: DHL, DHL Global)\n- FedEx Corporation',
    },
    {
      name: '${currentDate}',
      description: 'Current date in YYYY-MM-DD format',
      example: '2026-02-04',
    },
    {
      name: '${fileName}',
      description: 'Name of the uploaded file',
      example: 'invoice_001.pdf',
    },
  ],
};

// ============================================================================
// Stage 2 Template - Format Identification
// ============================================================================

const STAGE_2_TEMPLATE: PromptTemplate = {
  promptType: 'STAGE_2_FORMAT_IDENTIFICATION',
  displayName: 'Stage 2 - Format Identification',

  systemPromptWithVariables: `You are an invoice format identification specialist.
Your task is to identify the format/template of this invoice.

Company: \${companyName}

Known formats:
\${knownFormats}

File name: \${fileName}

Response format (JSON):
{
  "formatName": "string - identified format name",
  "confidence": number (0-100),
  "matchedKnownFormat": "string | null - if matched to known format",
  "formatCharacteristics": ["array of observed format characteristics"]
}`,

  userPromptWithVariables: 'Identify the format/template of this invoice image.',

  systemPromptExample: `You are an invoice format identification specialist.
Your task is to identify the format/template of this invoice.

Company: DHL Express

Known formats:
- DHL Express Invoice: Standard DHL billing invoice with shipment details
- DHL AWB (Air Waybill): Air freight tracking document
- DHL Commercial Invoice: International commercial invoice for customs

File name: dhl_invoice_202602.pdf

Response format (JSON):
{
  "formatName": "string - identified format name",
  "confidence": number (0-100),
  "matchedKnownFormat": "string | null - if matched to known format",
  "formatCharacteristics": ["array of observed format characteristics"]
}`,

  userPromptExample: 'Identify the format/template of this invoice image.',

  supportedVariables: [
    {
      name: '${companyName}',
      description: 'Company name identified from Stage 1',
      example: 'DHL Express',
    },
    {
      name: '${knownFormats}',
      description: 'List of known formats for this company',
      example: '- DHL Express Invoice: Standard billing invoice\n- DHL AWB: Air freight document',
    },
    {
      name: '${fileName}',
      description: 'Name of the uploaded file',
      example: 'dhl_invoice_202602.pdf',
    },
  ],
};

// ============================================================================
// Stage 3 Template - Field Extraction
// ============================================================================

const STAGE_3_TEMPLATE: PromptTemplate = {
  promptType: 'STAGE_3_FIELD_EXTRACTION',
  displayName: 'Stage 3 - Field Extraction',

  systemPromptWithVariables: `You are an expert invoice data extraction specialist.
Extract all requested fields accurately from the provided invoice image.

Company: \${companyName}
Document Format: \${documentFormatName}

Standard Fields to Extract:
\${standardFields}

Custom Fields:
\${customFields}

Term Classification Rules:
Universal Mappings (Tier 1):
\${universalMappings}

Company-Specific Mappings (Tier 2 - override Tier 1):
\${companyMappings}

Output Schema:
\${fieldSchema}

Respond in valid JSON format matching the provided schema.`,

  userPromptWithVariables: 'Extract all invoice data from this image according to the field definitions.',

  systemPromptExample: `You are an expert invoice data extraction specialist.
Extract all requested fields accurately from the provided invoice image.

Company: DHL Express
Document Format: DHL Express Invoice

Standard Fields to Extract:
- invoiceNumber (string, required): Invoice Number
- invoiceDate (date, required): Invoice Date
- dueDate (date): Due Date
- vendorName (string, required): Vendor Name
- customerName (string): Customer Name
- totalAmount (currency, required): Total Amount
- currency (string, required): Currency

Custom Fields:
- shipmentWeight (number): Shipment Weight in KG
- awbNumber (string): Air Waybill Number

Term Classification Rules:
Universal Mappings (Tier 1):
  "Freight" → "Freight"
  "Fuel Surcharge" → "Fuel Surcharge"
  "Handling Fee" → "Handling"
  "Insurance" → "Insurance"

Company-Specific Mappings (Tier 2 - override Tier 1):
  "Express Handling" → "Express Handling"
  "DHL Fuel Surcharge" → "Fuel Surcharge"

Output Schema:
{
  "type": "object",
  "properties": {
    "standardFields": { "type": "object" },
    "customFields": { "type": "object" },
    "lineItems": { "type": "array" },
    "extraCharges": { "type": "array" },
    "overallConfidence": { "type": "number" }
  }
}

Respond in valid JSON format matching the provided schema.`,

  userPromptExample: 'Extract all invoice data from this image according to the field definitions.',

  supportedVariables: [
    {
      name: '${companyName}',
      description: 'Company name identified from Stage 1',
      example: 'DHL Express',
    },
    {
      name: '${documentFormatName}',
      description: 'Document format identified from Stage 2',
      example: 'DHL Express Invoice',
    },
    {
      name: '${standardFields}',
      description: 'List of standard fields to extract',
      example: '- invoiceNumber (string, required): Invoice Number\n- invoiceDate (date, required): Invoice Date',
    },
    {
      name: '${customFields}',
      description: 'List of custom fields specific to this format',
      example: '- shipmentWeight (number): Shipment Weight in KG',
    },
    {
      name: '${universalMappings}',
      description: 'Tier 1 universal term mappings',
      example: '"Freight" → "Freight"\n"Fuel Surcharge" → "Fuel Surcharge"',
    },
    {
      name: '${companyMappings}',
      description: 'Tier 2 company-specific term mappings (override Tier 1)',
      example: '"Express Handling" → "Express Handling"',
    },
    {
      name: '${fieldSchema}',
      description: 'JSON Schema for the expected output format',
      example: '{"type":"object","properties":{...}}',
    },
  ],
};

// ============================================================================
// Exports
// ============================================================================

/**
 * Stage 模板映射表
 * @description 按 Prompt Type 索引的模板集合
 */
export const STAGE_TEMPLATES: Record<string, PromptTemplate> = {
  STAGE_1_COMPANY_IDENTIFICATION: STAGE_1_TEMPLATE,
  STAGE_2_FORMAT_IDENTIFICATION: STAGE_2_TEMPLATE,
  STAGE_3_FIELD_EXTRACTION: STAGE_3_TEMPLATE,
};

/**
 * 支援模板插入的 Prompt Types
 * @description 僅這些 type 會顯示「插入模板」按鈕
 */
export const STAGE_PROMPT_TYPES = [
  'STAGE_1_COMPANY_IDENTIFICATION',
  'STAGE_2_FORMAT_IDENTIFICATION',
  'STAGE_3_FIELD_EXTRACTION',
] as const;

export type StagePromptType = (typeof STAGE_PROMPT_TYPES)[number];

/**
 * 檢查指定 Prompt Type 是否有預設模板
 * @param promptType - Prompt Type 值
 * @returns 是否有預設模板
 */
export function hasDefaultTemplate(promptType: string): boolean {
  return promptType in STAGE_TEMPLATES;
}

/**
 * 獲取指定 Prompt Type 的預設模板
 * @param promptType - Prompt Type 值
 * @returns 模板物件，如果不存在則返回 null
 */
export function getDefaultTemplate(promptType: string): PromptTemplate | null {
  return STAGE_TEMPLATES[promptType] || null;
}

/**
 * 獲取模板的指定版本內容
 * @param template - 模板物件
 * @param version - 版本類型
 * @returns System 和 User Prompt 內容
 */
export function getTemplateContent(
  template: PromptTemplate,
  version: TemplateVersion
): { systemPrompt: string; userPrompt: string } {
  if (version === 'withVariables') {
    return {
      systemPrompt: template.systemPromptWithVariables,
      userPrompt: template.userPromptWithVariables,
    };
  }
  return {
    systemPrompt: template.systemPromptExample,
    userPrompt: template.userPromptExample,
  };
}
