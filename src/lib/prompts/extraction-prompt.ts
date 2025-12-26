/**
 * @fileoverview GPT Vision 提取提示詞模組
 * @description
 *   提供 GPT-5.2 Vision API 所需的各種提示詞：
 *   - BASE_EXTRACTION_PROMPT: 基本發票提取
 *   - DOCUMENT_ISSUER_PROMPT: 文件發行者識別 (Story 0.8)
 *   - DOCUMENT_FORMAT_PROMPT: 文件格式識別 (Story 0.9)
 *   - TERM_EXTRACTION_PROMPT: 術語提取
 *
 * @module src/lib/prompts/extraction-prompt
 * @since Epic 0 - Story 0.9
 * @lastModified 2025-12-26
 *
 * @features
 *   - 模組化提示詞設計
 *   - 可組合的提示詞建構函數
 *   - 支援多語言（中英文）
 *
 * @dependencies
 *   - Azure OpenAI GPT-5.2 Vision API
 *
 * @related
 *   - src/services/gpt-vision.service.ts - GPT Vision 服務
 *   - src/services/document-format.service.ts - 格式識別服務
 *   - src/types/document-format.ts - 類型定義
 */

// ============================================================================
// 基本發票提取提示詞
// ============================================================================

/**
 * 基本發票提取提示詞
 * 用於提取發票的基本欄位信息
 */
export const BASE_EXTRACTION_PROMPT = `你是一個專業的發票 OCR 和數據提取專家。請仔細分析這張發票圖片，提取以下信息：

## 基本發票信息
1. 發票號碼 (invoiceNumber)
2. 發票日期 (invoiceDate) - 格式：YYYY-MM-DD
3. 付款截止日期 (dueDate) - 格式：YYYY-MM-DD（如有）
4. 供應商信息 (vendor):
   - 名稱 (name)
   - 地址 (address)
   - 稅號 (taxId)
5. 買方信息 (buyer):
   - 名稱 (name)
   - 地址 (address)
6. 明細項目 (lineItems) - 每個項目包含：
   - 描述 (description)
   - 數量 (quantity)
   - 單價 (unitPrice)
   - 金額 (amount)
7. 小計 (subtotal)
8. 稅額 (taxAmount)
9. 總金額 (totalAmount)
10. 貨幣 (currency)

請以 JSON 格式回覆，結構如下：
{
  "invoiceNumber": "...",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "vendor": { "name": "...", "address": "...", "taxId": "..." },
  "buyer": { "name": "...", "address": "..." },
  "lineItems": [{ "description": "...", "quantity": 1, "unitPrice": 100, "amount": 100 }],
  "subtotal": 100,
  "taxAmount": 10,
  "totalAmount": 110,
  "currency": "USD"
}

如果某個欄位無法識別，請設為 null。`;

// ============================================================================
// 文件發行者識別提示詞 (Story 0.8)
// ============================================================================

/**
 * 文件發行者識別提示詞
 * 用於識別發出文件的公司（如 DHL、FedEx）
 */
export const DOCUMENT_ISSUER_PROMPT = `
## 文件發行者識別 (Document Issuer Identification)

【重要】請識別「發出這份文件的公司」，而非交易對象。

發行者（documentIssuer）vs 交易對象（vendor/buyer）的區別：
- documentIssuer: 創建並發送這份發票的公司（如 DHL、FedEx、Kuehne+Nagel）
- vendor/buyer: 參與交易的各方（客戶、發貨人、收貨人）

範例：
- 一份 DHL 發出的運費發票：
  - documentIssuer: "DHL Express"（發出發票的公司）
  - vendor: "DHL Express"（可能相同）
  - buyer: "ABC Trading Co."（客戶）

請依優先順序從以下區域識別文件發行者：
1. **公司 Logo** - 通常在文件左上角或頂部中央
2. **文件標題區** - 標題/抬頭區域的公司名稱
3. **信頭紙** - 官方信頭的公司品牌
4. **頁尾** - 底部的公司信息

提取文件發行者信息 (documentIssuer):
- name: 發行公司名稱
- identificationMethod: 識別方法 ("LOGO" | "HEADER" | "LETTERHEAD" | "FOOTER" | "AI_INFERENCE")
- confidence: 識別信心度 (0-100)
- rawText: 在文件上看到的原始文字

### 輸出格式
"documentIssuer": {
  "name": "發行公司名稱",
  "identificationMethod": "LOGO",
  "confidence": 95,
  "rawText": "文件上看到的原始公司名稱"
}`;

// ============================================================================
// 文件格式識別提示詞 (Story 0.9)
// ============================================================================

/**
 * 文件格式識別提示詞
 * 用於識別文件類型、子類型和格式特徵
 */
export const DOCUMENT_FORMAT_PROMPT = `
## Document Format Identification (文件格式識別)

Identify the TYPE and FORMAT of this document by analyzing its structure and content.

### Output Structure

documentFormat: {
  documentType: The main document type (REQUIRED)
    - INVOICE: Standard invoice for services/goods (發票)
    - DEBIT_NOTE: Additional charges notification (借項通知單)
    - CREDIT_NOTE: Refund or adjustment (貸項通知單)
    - STATEMENT: Account statement (對帳單)
    - QUOTATION: Price quote (報價單)
    - BILL_OF_LADING: Shipping document (提單)
    - CUSTOMS_DECLARATION: Customs paperwork (報關單)
    - OTHER: Other document types

  documentSubtype: The specific subtype based on business domain (REQUIRED)
    - OCEAN_FREIGHT: Sea shipping related (海運)
    - AIR_FREIGHT: Air shipping related (空運)
    - LAND_TRANSPORT: Ground/road transport (陸運)
    - CUSTOMS_CLEARANCE: Customs processing (報關)
    - WAREHOUSING: Storage related (倉儲)
    - GENERAL: General/mixed services (一般)

  formatConfidence: 0-100 confidence in format identification

  formatFeatures: {
    hasLineItems: boolean - Does the document contain itemized line items?
    hasHeaderLogo: boolean - Is there a company logo in the header?
    currency: detected currency code (e.g., "USD", "CNY", "HKD")
    language: primary language of document (e.g., "en", "zh-TW", "zh-CN")
    typicalFields: array of key field names found in this document
    layoutPattern: brief description of document layout
  }
}

### Identification Guidelines

1. **Document Type Detection**:
   - Look for keywords: "INVOICE", "發票", "DEBIT NOTE", "借項", "CREDIT NOTE", "貸項"
   - Check document title/header area
   - Analyze document structure and purpose

2. **Subtype Detection**:
   - Look for shipping mode indicators: "OCEAN", "SEA", "AIR", "ROAD", "RAIL"
   - Check for industry-specific terms
   - Analyze the nature of charges listed

3. **Feature Extraction**:
   - Count line items to determine hasLineItems
   - Check header area for logo presence
   - Identify currency from amounts
   - Detect primary language from text

### Example Output

"documentFormat": {
  "documentType": "INVOICE",
  "documentSubtype": "OCEAN_FREIGHT",
  "formatConfidence": 92,
  "formatFeatures": {
    "hasLineItems": true,
    "hasHeaderLogo": true,
    "currency": "USD",
    "language": "en",
    "typicalFields": ["Invoice No", "B/L No", "Vessel", "POL", "POD"],
    "layoutPattern": "Header with logo, client info block, line items table, totals section"
  }
}`;

// ============================================================================
// 術語提取提示詞
// ============================================================================

/**
 * 術語提取提示詞
 * 用於從明細項目中提取術語（費用名稱）
 */
export const TERM_EXTRACTION_PROMPT = `
## Term Extraction (術語提取)

Extract all unique charge terms/descriptions from line items in this document.

For each term found:
- term: The exact text as shown in the document
- normalizedTerm: Standardized/cleaned version (uppercase, no special chars)
- suggestedCategory: Your best guess for the category

### Common Categories
- OCEAN_FREIGHT: 海運費相關 (Ocean Freight, Sea Freight, FCL, LCL)
- AIR_FREIGHT: 空運費相關 (Air Freight, AWB Fee)
- TERMINAL: 碼頭費相關 (THC, Terminal Handling)
- DOCUMENTATION: 文件費相關 (DOC Fee, B/L Fee, Telex)
- CUSTOMS: 報關費相關 (Customs, Brokerage, Duty)
- HANDLING: 處理費相關 (Handling, Operation)
- STORAGE: 倉儲費相關 (Storage, Warehouse, Demurrage)
- DELIVERY: 派送費相關 (Delivery, Trucking, Cartage)
- SURCHARGE: 附加費相關 (BAF, CAF, PSS, GRI)
- INSURANCE: 保險費相關 (Insurance, Cargo Insurance)
- OTHER: 其他費用

### Output Format

"extractedTerms": [
  {
    "term": "OCEAN FREIGHT",
    "normalizedTerm": "OCEAN FREIGHT",
    "suggestedCategory": "OCEAN_FREIGHT",
    "confidence": 95
  },
  {
    "term": "T.H.C.",
    "normalizedTerm": "THC",
    "suggestedCategory": "TERMINAL",
    "confidence": 90
  }
]`;

// ============================================================================
// 完整提取提示詞（合併版本）
// ============================================================================

/**
 * 完整的發票提取提示詞
 * 結合所有提取功能的單一提示詞
 */
export const FULL_EXTRACTION_PROMPT = `你是一個專業的發票 OCR 和數據提取專家。請仔細分析這張發票圖片，提取以下信息：

## 基本發票信息
1. 發票號碼 (invoiceNumber)
2. 發票日期 (invoiceDate) - 格式：YYYY-MM-DD
3. 付款截止日期 (dueDate) - 格式：YYYY-MM-DD（如有）
4. 供應商信息 (vendor):
   - 名稱 (name)
   - 地址 (address)
   - 稅號 (taxId)
5. 買方信息 (buyer):
   - 名稱 (name)
   - 地址 (address)
6. 明細項目 (lineItems) - 每個項目包含：
   - 描述 (description)
   - 數量 (quantity)
   - 單價 (unitPrice)
   - 金額 (amount)
7. 小計 (subtotal)
8. 稅額 (taxAmount)
9. 總金額 (totalAmount)
10. 貨幣 (currency)

${DOCUMENT_ISSUER_PROMPT}

${DOCUMENT_FORMAT_PROMPT}

${TERM_EXTRACTION_PROMPT}

## 完整輸出格式

請以 JSON 格式回覆，結構如下：
{
  "invoiceNumber": "...",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "vendor": { "name": "...", "address": "...", "taxId": "..." },
  "buyer": { "name": "...", "address": "..." },
  "lineItems": [{ "description": "...", "quantity": 1, "unitPrice": 100, "amount": 100 }],
  "subtotal": 100,
  "taxAmount": 10,
  "totalAmount": 110,
  "currency": "USD",
  "documentIssuer": {
    "name": "發行公司名稱",
    "identificationMethod": "LOGO",
    "confidence": 95,
    "rawText": "原始文字"
  },
  "documentFormat": {
    "documentType": "INVOICE",
    "documentSubtype": "OCEAN_FREIGHT",
    "formatConfidence": 92,
    "formatFeatures": {
      "hasLineItems": true,
      "hasHeaderLogo": true,
      "currency": "USD",
      "language": "en",
      "typicalFields": ["Invoice No", "B/L No"],
      "layoutPattern": "Header with logo, line items table"
    }
  },
  "extractedTerms": [
    {
      "term": "OCEAN FREIGHT",
      "normalizedTerm": "OCEAN FREIGHT",
      "suggestedCategory": "OCEAN_FREIGHT",
      "confidence": 95
    }
  ]
}

如果某個欄位無法識別，請設為 null。只回覆 JSON，不要包含其他文字。`;

// ============================================================================
// 提示詞建構函數
// ============================================================================

/**
 * 建構提示詞選項
 */
export interface BuildPromptOptions {
  /** 是否包含發行者識別 (Story 0.8) */
  includeIssuer?: boolean;
  /** 是否包含格式識別 (Story 0.9) */
  includeFormat?: boolean;
  /** 是否包含術語提取 */
  includeTerms?: boolean;
}

/**
 * 建構可組合的提取提示詞
 *
 * @description
 *   根據選項組合不同的提示詞模組，用於靈活控制提取功能。
 *
 * @param options - 提示詞組合選項
 * @returns 組合後的完整提示詞
 *
 * @example
 * ```typescript
 * // 基本提取 + 發行者識別
 * const prompt = buildExtractionPrompt({ includeIssuer: true });
 *
 * // 完整提取（所有功能）
 * const fullPrompt = buildExtractionPrompt({
 *   includeIssuer: true,
 *   includeFormat: true,
 *   includeTerms: true
 * });
 * ```
 */
export function buildExtractionPrompt(options: BuildPromptOptions = {}): string {
  const { includeIssuer = false, includeFormat = false, includeTerms = false } = options;

  let prompt = BASE_EXTRACTION_PROMPT;

  if (includeIssuer) {
    prompt += '\n\n' + DOCUMENT_ISSUER_PROMPT;
  }

  if (includeFormat) {
    prompt += '\n\n' + DOCUMENT_FORMAT_PROMPT;
  }

  if (includeTerms) {
    prompt += '\n\n' + TERM_EXTRACTION_PROMPT;
  }

  // 添加 JSON 輸出說明
  prompt += `

## 輸出要求
請以 JSON 格式回覆。如果某個欄位無法識別，請設為 null。只回覆 JSON，不要包含其他文字。`;

  return prompt;
}

/**
 * 取得預設的批量處理提示詞
 *
 * @description
 *   用於批量歷史資料處理，包含完整的提取功能。
 *
 * @returns 完整提取提示詞
 */
export function getBatchProcessingPrompt(): string {
  return FULL_EXTRACTION_PROMPT;
}
