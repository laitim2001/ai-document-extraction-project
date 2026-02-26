/**
 * @fileoverview Prompt 構建工具 - V3 架構
 * @description
 *   提供動態 Prompt 構建的輔助函數：
 *   - 公司識別規則模板
 *   - 格式識別規則模板
 *   - 欄位提取規則模板
 *   - 術語分類規則模板
 *   - JSON Schema 生成
 *
 * @module src/services/extraction-v3/utils/prompt-builder
 * @since CHANGE-021 - Unified Processor V3 Refactoring
 * @lastModified 2026-01-30
 *
 * @features
 *   - 模組化 Prompt 區塊構建
 *   - JSON Schema 動態生成
 *   - Token 估算
 *   - 多語言支援
 *
 * @related
 *   - src/services/extraction-v3/prompt-assembly.service.ts - Prompt 組裝服務
 *   - src/types/extraction-v3.types.ts - V3 類型定義
 */

import type {
  KnownCompanyForPrompt,
  FormatPatternForPrompt,
  FieldDefinition,
  DynamicPromptConfig,
} from '@/types/extraction-v3.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Prompt 區塊
 */
export interface PromptSection {
  /** 區塊標題 */
  title: string;
  /** 區塊內容 */
  content: string;
  /** 預估 Token 數 */
  estimatedTokens: number;
}

/**
 * JSON Schema 欄位定義
 */
interface JsonSchemaProperty {
  type: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  required?: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** 每個字元約等於的 Token 數（估算值） */
const CHARS_PER_TOKEN = 4;

/** 標準欄位鍵名（8 個核心欄位） */
export const STANDARD_FIELD_KEYS = [
  'invoiceNumber',
  'invoiceDate',
  'dueDate',
  'vendorName',
  'customerName',
  'totalAmount',
  'subtotal',
  'currency',
] as const;

// ============================================================================
// System Prompt Templates
// ============================================================================

/**
 * 基礎 System Prompt 模板
 */
export const BASE_SYSTEM_PROMPT = `You are an expert invoice data extraction assistant specialized in freight and logistics invoices.

Your task is to analyze the provided invoice image(s) and extract structured data according to the rules and schemas provided.

## Core Capabilities
1. **Issuer Identification**: Identify the company that issued the invoice
2. **Format Recognition**: Recognize the invoice format/template
3. **Field Extraction**: Extract standard and custom fields
4. **Term Classification**: Classify line items and extra charges using provided term mappings

## Output Requirements
- Always respond with valid JSON matching the provided schema
- Use null for fields that cannot be extracted
- Provide confidence scores (0-100) for each extracted value
- Flag items that need human classification when uncertain

## Important Notes
- Analyze ALL pages of the document if multiple images are provided
- Cross-reference information across pages for accuracy
- Use context clues when exact values are unclear
`;

/**
 * 取得基礎 System Prompt
 */
export function getBaseSystemPrompt(): PromptSection {
  return {
    title: 'Base System Prompt',
    content: BASE_SYSTEM_PROMPT,
    estimatedTokens: estimateTokens(BASE_SYSTEM_PROMPT),
  };
}

// ============================================================================
// Section Builders
// ============================================================================

/**
 * 構建公司識別規則區塊
 *
 * @param companies - 已知公司列表
 * @returns Prompt 區塊
 */
export function buildIssuerIdentificationSection(
  companies: KnownCompanyForPrompt[]
): PromptSection {
  if (companies.length === 0) {
    const content = `## Section 1: Issuer Identification Rules

No known companies configured. Identify the issuer by:
1. Company name in header/letterhead
2. Logo recognition
3. Address information
4. Tax ID / Registration number

If the issuer cannot be matched to a known company, set isNewCompany: true.
`;
    return {
      title: 'Issuer Identification Rules',
      content,
      estimatedTokens: estimateTokens(content),
    };
  }

  const companyList = companies
    .map((c) => {
      const aliases =
        c.aliases.length > 0 ? `\n   - Aliases: ${c.aliases.join(', ')}` : '';
      const identifiers =
        c.identifiers.length > 0
          ? `\n   - Identifiers: ${c.identifiers.join(', ')}`
          : '';
      return `- **${c.name}** (ID: ${c.id})${aliases}${identifiers}`;
    })
    .join('\n');

  const content = `## Section 1: Issuer Identification Rules

### Known Companies (${companies.length})
${companyList}

### Identification Methods (Priority Order)
1. **LOGO**: Match company logo in header
2. **HEADER**: Match company name in letterhead
3. **ADDRESS**: Match registered address
4. **TAX_ID**: Match tax ID / registration number

### Instructions
- Search for these companies first
- If matched, return the company ID and name
- If not matched, set isNewCompany: true and extract the company name
`;

  return {
    title: 'Issuer Identification Rules',
    content,
    estimatedTokens: estimateTokens(content),
  };
}

/**
 * 構建格式識別規則區塊
 *
 * @param formats - 格式模式列表
 * @returns Prompt 區塊
 */
export function buildFormatIdentificationSection(
  formats: FormatPatternForPrompt[]
): PromptSection {
  if (formats.length === 0) {
    const content = `## Section 2: Format Identification Rules

No known formats configured. Describe the invoice format based on:
1. Layout structure (table positions, header style)
2. Distinctive visual elements
3. Field arrangement patterns

Set isNewFormat: true for unrecognized formats.
`;
    return {
      title: 'Format Identification Rules',
      content,
      estimatedTokens: estimateTokens(content),
    };
  }

  const formatList = formats
    .map((f) => {
      const patterns =
        f.patterns.length > 0
          ? `\n   - Patterns: ${f.patterns.join(', ')}`
          : '';
      const keywords =
        f.keywords.length > 0
          ? `\n   - Keywords: ${f.keywords.join(', ')}`
          : '';
      return `- **${f.formatName}** (ID: ${f.formatId})${patterns}${keywords}`;
    })
    .join('\n');

  const content = `## Section 2: Format Identification Rules

### Known Formats (${formats.length})
${formatList}

### Instructions
- Match the invoice layout against known formats
- Use patterns and keywords to identify the format
- If matched, return the format ID and name
- If not matched, set isNewFormat: true and describe the format
`;

  return {
    title: 'Format Identification Rules',
    content,
    estimatedTokens: estimateTokens(content),
  };
}

/**
 * 構建欄位提取規則區塊
 *
 * @param standardFields - 標準欄位定義
 * @param customFields - 自定義欄位定義
 * @returns Prompt 區塊
 */
export function buildFieldExtractionSection(
  standardFields: FieldDefinition[],
  customFields: FieldDefinition[] = []
): PromptSection {
  const standardFieldsList = standardFields
    .map((f) => {
      const required = f.required ? ' **(Required)**' : '';
      const hints =
        f.extractionHints && f.extractionHints.length > 0
          ? `\n   - Hints: ${f.extractionHints.join(', ')}`
          : '';
      return `- **${f.key}** (${f.type})${required}: ${f.displayName}${hints}`;
    })
    .join('\n');

  let customFieldsList = '';
  if (customFields.length > 0) {
    customFieldsList =
      '\n\n### Custom Fields\n' +
      customFields
        .map((f) => {
          const required = f.required ? ' **(Required)**' : '';
          return `- **${f.key}** (${f.type})${required}: ${f.displayName}`;
        })
        .join('\n');
  }

  const content = `## Section 3: Field Extraction Rules

### Standard Fields (8 Core Fields)
${standardFieldsList}${customFieldsList}

### Extraction Guidelines
1. Extract values exactly as they appear in the document
2. For dates, use ISO 8601 format (YYYY-MM-DD)
3. For currency amounts, extract the numeric value without currency symbols
4. Provide confidence score (0-100) for each extracted field
5. Use null for fields that cannot be found
`;

  return {
    title: 'Field Extraction Rules',
    content,
    estimatedTokens: estimateTokens(content),
  };
}

/**
 * 構建術語分類規則區塊
 *
 * @param universalMappings - 通用映射
 * @param companyMappings - 公司特定映射
 * @param fallbackBehavior - 回退行為
 * @returns Prompt 區塊
 */
export function buildTermClassificationSection(
  universalMappings: Record<string, string>,
  companyMappings: Record<string, string> = {},
  fallbackBehavior: 'MARK_UNCLASSIFIED' | 'USE_ORIGINAL' = 'MARK_UNCLASSIFIED'
): PromptSection {
  const universalList = Object.entries(universalMappings)
    .slice(0, 50) // 限制顯示數量
    .map(([term, category]) => `- "${term}" → "${category}"`)
    .join('\n');

  const companyList =
    Object.keys(companyMappings).length > 0
      ? '\n\n### Company-Specific Mappings (Priority)\n' +
        Object.entries(companyMappings)
          .slice(0, 20)
          .map(([term, category]) => `- "${term}" → "${category}"`)
          .join('\n')
      : '';

  const totalMappings =
    Object.keys(universalMappings).length +
    Object.keys(companyMappings).length;

  const fallbackInstruction =
    fallbackBehavior === 'MARK_UNCLASSIFIED'
      ? 'set needsClassification: true and leave classifiedAs empty'
      : 'use the original description as classifiedAs';

  const content = `## Section 4: Term Classification Rules

### Universal Term Mappings (${Object.keys(universalMappings).length} total)
${universalList}
${Object.keys(universalMappings).length > 50 ? `... and ${Object.keys(universalMappings).length - 50} more` : ''}${companyList}

### Classification Instructions
1. For each line item and extra charge, try to match the description
2. Check company-specific mappings first (if available)
3. Then check universal mappings
4. If no match found, ${fallbackInstruction}

### Total Available Mappings: ${totalMappings}
`;

  return {
    title: 'Term Classification Rules',
    content,
    estimatedTokens: estimateTokens(content),
  };
}

/**
 * 構建輸出 JSON Schema 區塊
 *
 * @param standardFields - 標準欄位定義
 * @param customFields - 自定義欄位定義
 * @returns Prompt 區塊和 Schema 對象
 */
export function buildOutputSchemaSection(
  standardFields: FieldDefinition[],
  customFields: FieldDefinition[] = []
): { section: PromptSection; schema: Record<string, unknown> } {
  const schema = generateJsonSchema(standardFields, customFields);
  const schemaJson = JSON.stringify(schema, null, 2);

  const content = `## Section 5: Output JSON Schema

Your response MUST be valid JSON matching this schema:

\`\`\`json
${schemaJson}
\`\`\`

### Important
- All confidence scores should be integers between 0 and 100
- Use null for values that cannot be extracted
- Do not include any text outside the JSON object
`;

  return {
    section: {
      title: 'Output JSON Schema',
      content,
      estimatedTokens: estimateTokens(content),
    },
    schema,
  };
}

// ============================================================================
// JSON Schema Generator
// ============================================================================

/**
 * 生成完整的 JSON Schema
 *
 * @param standardFields - 標準欄位定義
 * @param customFields - 自定義欄位定義
 * @returns JSON Schema 對象
 */
export function generateJsonSchema(
  standardFields: FieldDefinition[],
  customFields: FieldDefinition[] = []
): Record<string, unknown> {
  const fieldValueSchema: JsonSchemaProperty = {
    type: 'object',
    properties: {
      value: { type: 'string', description: 'Extracted value' },
      confidence: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: 'Confidence score',
      },
      source: { type: 'string', description: 'Location in document' },
    },
    required: ['value', 'confidence'],
  };

  const standardFieldsProperties: Record<string, JsonSchemaProperty> = {};
  const requiredStandardFields: string[] = [];

  for (const field of standardFields) {
    standardFieldsProperties[field.key] = fieldValueSchema;
    if (field.required) {
      requiredStandardFields.push(field.key);
    }
  }

  const customFieldsProperties: Record<string, JsonSchemaProperty> = {};
  for (const field of customFields) {
    customFieldsProperties[field.key] = fieldValueSchema;
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      issuerIdentification: {
        type: 'object',
        properties: {
          companyName: { type: 'string' },
          companyId: { type: 'string' },
          identificationMethod: {
            type: 'string',
            enum: ['LOGO', 'HEADER', 'ADDRESS', 'TAX_ID', 'UNKNOWN'],
          },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          isNewCompany: { type: 'boolean' },
        },
        required: ['companyName', 'identificationMethod', 'confidence', 'isNewCompany'],
      },
      formatIdentification: {
        type: 'object',
        properties: {
          formatName: { type: 'string' },
          formatId: { type: 'string' },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          isNewFormat: { type: 'boolean' },
        },
        required: ['formatName', 'confidence', 'isNewFormat'],
      },
      standardFields: {
        type: 'object',
        properties: standardFieldsProperties,
        required: requiredStandardFields,
      },
      customFields: {
        type: 'object',
        properties: customFieldsProperties,
      },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            classifiedAs: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
            amount: { type: 'number' },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            needsClassification: { type: 'boolean' },
          },
          required: ['description', 'amount', 'confidence'],
        },
      },
      extraCharges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            classifiedAs: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            needsClassification: { type: 'boolean' },
          },
          required: ['description', 'amount', 'confidence'],
        },
      },
      overallConfidence: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: 'Overall extraction confidence',
      },
    },
    required: [
      'issuerIdentification',
      'formatIdentification',
      'standardFields',
      'lineItems',
      'overallConfidence',
    ],
  };
}

// ============================================================================
// User Prompt Builder
// ============================================================================

/**
 * 構建 User Prompt
 *
 * @param imageCount - 圖片數量
 * @param additionalInstructions - 額外指示
 * @returns User Prompt 字串
 */
export function buildUserPrompt(
  imageCount: number,
  additionalInstructions?: string
): string {
  let prompt = `Please analyze the provided invoice ${imageCount > 1 ? `images (${imageCount} pages)` : 'image'} and extract all relevant data according to the rules specified above.

Return your response as a single valid JSON object matching the provided schema.`;

  if (additionalInstructions) {
    prompt += `\n\n### Additional Instructions\n${additionalInstructions}`;
  }

  return prompt;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 估算文字的 Token 數
 *
 * @param text - 文字內容
 * @returns 預估 Token 數
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * 合併多個 Prompt 區塊
 *
 * @param sections - Prompt 區塊列表
 * @returns 合併後的內容和總 Token 數
 */
export function combineSections(
  sections: PromptSection[]
): { content: string; totalTokens: number } {
  const content = sections.map((s) => s.content).join('\n\n');
  const totalTokens = sections.reduce((sum, s) => sum + s.estimatedTokens, 0);
  return { content, totalTokens };
}

/**
 * 獲取預設標準欄位定義
 *
 * @returns 標準欄位定義列表
 */
export function getDefaultStandardFields(): FieldDefinition[] {
  return [
    {
      key: 'invoiceNumber',
      displayName: 'Invoice Number',
      type: 'string',
      required: true,
      extractionHints: ['Invoice No.', 'Invoice #', 'Inv No', 'Bill No'],
    },
    {
      key: 'invoiceDate',
      displayName: 'Invoice Date',
      type: 'date',
      required: true,
      extractionHints: ['Invoice Date', 'Date', 'Dated'],
    },
    {
      key: 'dueDate',
      displayName: 'Due Date',
      type: 'date',
      required: false,
      extractionHints: ['Due Date', 'Payment Due', 'Pay By'],
    },
    {
      key: 'vendorName',
      displayName: 'Vendor Name',
      type: 'string',
      required: true,
      extractionHints: ['From', 'Vendor', 'Supplier', 'Bill From'],
    },
    {
      key: 'customerName',
      displayName: 'Customer Name',
      type: 'string',
      required: false,
      extractionHints: ['Bill To', 'Customer', 'To', 'Consignee'],
    },
    {
      key: 'totalAmount',
      displayName: 'Total Amount',
      type: 'currency',
      required: true,
      extractionHints: ['Total', 'Grand Total', 'Amount Due', 'Total Due'],
    },
    {
      key: 'subtotal',
      displayName: 'Subtotal',
      type: 'currency',
      required: false,
      extractionHints: ['Subtotal', 'Sub Total', 'Net Amount'],
    },
    {
      key: 'currency',
      displayName: 'Currency',
      type: 'string',
      required: true,
      extractionHints: ['Currency', 'Ccy', '$', '€', '£'],
    },
  ];
}

/**
 * 從 DynamicPromptConfig 構建完整的 System Prompt
 *
 * @param config - 動態 Prompt 配置
 * @returns 合併後的 System Prompt 和元數據
 */
export function buildFullSystemPrompt(config: DynamicPromptConfig): {
  systemPrompt: string;
  schema: Record<string, unknown>;
  metadata: {
    companiesCount: number;
    formatsCount: number;
    universalMappingsCount: number;
    companyMappingsCount: number;
    estimatedTokens: number;
  };
} {
  const sections: PromptSection[] = [];

  // Base prompt
  sections.push(getBaseSystemPrompt());

  // Section 1: Issuer Identification
  sections.push(
    buildIssuerIdentificationSection(
      config.issuerIdentificationRules.knownCompanies
    )
  );

  // Section 2: Format Identification
  sections.push(
    buildFormatIdentificationSection(
      config.formatIdentificationRules.formatPatterns
    )
  );

  // Section 3: Field Extraction
  sections.push(
    buildFieldExtractionSection(
      config.fieldExtractionRules.standardFields,
      config.fieldExtractionRules.customFields
    )
  );

  // Section 4: Term Classification
  sections.push(
    buildTermClassificationSection(
      config.termClassificationRules.universalMappings,
      config.termClassificationRules.companyMappings,
      config.termClassificationRules.fallbackBehavior
    )
  );

  // Section 5: Output Schema
  const { section: schemaSection, schema } = buildOutputSchemaSection(
    config.fieldExtractionRules.standardFields,
    config.fieldExtractionRules.customFields
  );
  sections.push(schemaSection);

  // Combine all sections
  const { content, totalTokens } = combineSections(sections);

  return {
    systemPrompt: content,
    schema,
    metadata: {
      companiesCount: config.issuerIdentificationRules.knownCompanies.length,
      formatsCount: config.formatIdentificationRules.formatPatterns.length,
      universalMappingsCount: Object.keys(
        config.termClassificationRules.universalMappings
      ).length,
      companyMappingsCount: Object.keys(
        config.termClassificationRules.companyMappings
      ).length,
      estimatedTokens: totalTokens,
    },
  };
}
