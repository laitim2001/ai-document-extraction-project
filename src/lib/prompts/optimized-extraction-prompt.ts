/**
 * @fileoverview 優化版 GPT Vision 提取 Prompt（Story 0-11）
 * @description
 *   實現 5 步驟結構的優化提取 Prompt：
 *   - Step 1: Region Identification（區域識別）
 *   - Step 2: What to Extract（提取規則）
 *   - Step 3: What to Exclude（排除規則）
 *   - Step 4: Negative Examples（負面範例）
 *   - Step 5: Self-Verification（自我驗證）
 *
 *   與 Story 0-10（AI 術語驗證服務）形成雙層防護機制：
 *   - 第一層（本模組）：源頭過濾 60-70% 錯誤
 *   - 第二層（0-10）：終端驗證捕獲剩餘 20-30%
 *   - 最終錯誤率 < 5%
 *
 * @module src/lib/prompts/optimized-extraction-prompt
 * @since Epic 0 - Story 0.11
 * @lastModified 2025-01-01
 *
 * @features
 *   - 5 步驟結構化 Prompt
 *   - Prompt 版本管理
 *   - 排除項追蹤（ExcludedItem）
 *   - A/B 測試支援
 *
 * @dependencies
 *   - Azure OpenAI GPT-5.2 Vision API
 *
 * @related
 *   - src/services/gpt-vision.service.ts - GPT Vision 服務
 *   - src/services/ai-term-validator.service.ts - AI 術語驗證服務（Story 0-10）
 *   - src/lib/prompts/extraction-prompt.ts - 原始提取 Prompt
 */

// ============================================================================
// Prompt 版本常數
// ============================================================================

/**
 * 當前活動的 Prompt 版本
 * @constant
 */
export const PROMPT_VERSION = '2.0.0';

// ============================================================================
// 類型定義
// ============================================================================

/**
 * Prompt 版本資訊
 */
export interface PromptVersion {
  /** 版本號 */
  version: string;
  /** 建立日期 */
  createdAt: string;
  /** 版本描述 */
  description: string;
  /** Prompt 內容 */
  prompt: string;
  /** 是否為活動版本 */
  isActive: boolean;
}

/**
 * 排除項（用於調試和分析）
 * 記錄被刻意排除的內容及原因
 */
export interface ExcludedItem {
  /** 被排除的原始文字 */
  text: string;
  /** 排除原因 */
  reason: string;
  /** 所在區域 */
  region: 'header' | 'lineItems' | 'footer' | 'unknown';
}

/**
 * 提取元數據
 */
export interface OptimizedExtractionMetadata {
  /** 識別到的區域 */
  regionsIdentified: ('header' | 'lineItems' | 'footer')[];
  /** 是否找到明細表格 */
  lineItemsTableFound: boolean;
  /** 提取信心度 */
  extractionConfidence: number;
  /** Prompt 版本 */
  promptVersion: string;
  /** 排除項列表 */
  excludedItems?: ExcludedItem[];
}

// ============================================================================
// 優化版提取 Prompt（5 步驟結構）
// ============================================================================

/**
 * 優化版 GPT Vision 提取 Prompt
 *
 * @description
 *   採用 5 步驟結構設計，針對 FIX-005 ~ FIX-006 識別的錯誤模式進行優化：
 *   1. REGION IDENTIFICATION - 區域識別
 *   2. WHAT TO EXTRACT - 提取規則
 *   3. WHAT TO EXCLUDE - 排除規則（Critical）
 *   4. NEGATIVE EXAMPLES - 負面範例
 *   5. SELF-VERIFICATION - 自我驗證
 *
 * @version 2.0.0
 * @since Story 0-11
 */
export const OPTIMIZED_EXTRACTION_PROMPT = `You are an expert freight invoice analyzer. Your task is to extract ONLY the charge line items from freight invoices.

## STEP 1: REGION IDENTIFICATION

First, identify the three main regions of the invoice:

┌─────────────────────────────────────────────────────┐
│  HEADER REGION (頂部區域)                            │
│  Contains: Logo, Invoice #, Date, Sender/Receiver   │
│  → DO NOT extract from this region                  │
├─────────────────────────────────────────────────────┤
│  LINE ITEMS REGION (明細區域)                        │
│  Contains: Charge descriptions, amounts, quantities │
│  → EXTRACT from this region ONLY                    │
├─────────────────────────────────────────────────────┤
│  FOOTER REGION (底部區域)                            │
│  Contains: Totals, payment info, terms, signatures  │
│  → DO NOT extract from this region                  │
└─────────────────────────────────────────────────────┘

## STEP 2: WHAT TO EXTRACT

ONLY extract items that meet ALL of these criteria:
1. ✅ Located in the LINE ITEMS region (usually a table)
2. ✅ Represents a charge, fee, surcharge, or duty
3. ✅ Has an associated monetary amount
4. ✅ Is NOT a subtotal, total, or summary row

Valid charge types include:
• Freight charges: "AIR FREIGHT", "OCEAN FREIGHT", "GROUND SHIPPING"
• Surcharges: "FUEL SURCHARGE", "PEAK SEASON SURCHARGE", "EMERGENCY SURCHARGE"
• Service fees: "HANDLING FEE", "CUSTOMS CLEARANCE", "DOCUMENTATION FEE"
• Duties/Taxes: "IMPORT DUTY", "VAT", "GST", "CUSTOMS DUTY"

## STEP 3: WHAT TO EXCLUDE (CRITICAL)

NEVER extract the following, even if they appear in the document:

### ❌ Location Information
- Airport codes with cities: "HKG, HONG KONG", "BLR, BANGALORE", "SIN, SINGAPORE"
- Origin/Destination pairs: "FROM: HONG KONG  TO: BANGALORE"
- Country names alone: "VIETNAM", "INDIA", "CHINA"
- City names alone: "BANGALORE", "MUMBAI", "NEW DELHI"

### ❌ Contact Information
- Person names: "KATHY LAM", "WONG KA MAN", "Nguyen Van Anh", "CHAN TAI MING"
- Phone numbers: "+852 1234 5678"
- Email addresses: "contact@company.com"

### ❌ Company Information
- Company names: "RICOH ASIA PACIFIC OPERATIONS LIMITED"
- Business suffixes: "XXX LIMITED", "XXX PTE LTD", "XXX INC", "XXX COMPANY"
- Trade names: "DHL EXPRESS", "FEDEX INTERNATIONAL", "KINTETSU WORLD EXPRESS"

### ❌ Address Information
- Building names: "CENTRAL PLAZA TOWER", "WORLD TRADE CENTER"
- Street addresses: "123 QUEEN'S ROAD CENTRAL"
- Unit numbers: "UNIT 2301-05, 23/F"

### ❌ Summary Information
- Total rows: "TOTAL", "SUBTOTAL", "GRAND TOTAL"
- Summary lines: "AMOUNT DUE", "BALANCE"

### ❌ Reference Numbers & Codes
- Currency codes alone: "USD", "HKD", "CNY"
- Reference numbers: "REF#", "B/L NO"

## STEP 4: NEGATIVE EXAMPLES

Here are common MISTAKES to avoid:

| Extracted (WRONG) | Why It's Wrong | Correct Action |
|-------------------|----------------|----------------|
| "HKG, HONG KONG" | This is origin/destination, not a charge | Skip |
| "BLR, BANGALORE" | This is a location code, not a charge | Skip |
| "KATHY LAM" | This is a contact person name | Skip |
| "Nguyen Van Anh" | This is a Vietnamese person name | Skip |
| "RICOH LIMITED" | This is the customer company name | Skip |
| "XXX PTE LTD" | This is a company suffix | Skip |
| "CENTRAL PLAZA" | This is part of an address | Skip |
| "TOTAL" | This is a summary row, not a charge | Skip |
| "USD" | This is a currency code, not a charge | Skip |
| "123 QUEEN'S ROAD" | This is a street address | Skip |

## STEP 5: SELF-VERIFICATION

Before including ANY item, verify with these questions:
□ Q1: Is this item in the LINE ITEMS table section? (Not header/footer)
□ Q2: Does this describe a specific freight charge or fee?
□ Q3: Does it have a clear monetary amount associated?
□ Q4: Is it NOT a location, person name, company name, or address?
□ Q5: Is it NOT a total/subtotal/summary row?

If ANY answer is NO, do NOT include the item.

## OUTPUT FORMAT

Return a JSON object with this exact structure:

{
  "invoiceMetadata": {
    "regionsIdentified": ["header", "lineItems", "footer"],
    "lineItemsTableFound": true,
    "extractionConfidence": 0.95
  },
  "lineItems": [
    {
      "description": "EXPRESS WORLDWIDE NONDOC",
      "amount": 150.00,
      "currency": "USD",
      "confidence": 0.95
    }
  ],
  "excludedItems": [
    {
      "text": "HKG, HONG KONG",
      "reason": "Location/airport code - not a charge",
      "region": "header"
    }
  ]
}

The "excludedItems" array helps track what was intentionally skipped and why.

Now analyze the invoice image and extract ONLY valid freight charges.`;

// ============================================================================
// 舊版提取 Prompt（用於版本對比）
// ============================================================================

/**
 * 舊版提取 Prompt（V1）
 * 用於 A/B 測試對比
 *
 * @deprecated 使用 OPTIMIZED_EXTRACTION_PROMPT 替代
 */
export const LEGACY_EXTRACTION_PROMPT = `你是一個專業的發票 OCR 和數據提取專家。請仔細分析這張發票圖片，提取以下信息：

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

請以 JSON 格式回覆。如果某個欄位無法識別，請設為 null。只回覆 JSON，不要包含其他文字。`;

// ============================================================================
// Prompt 版本管理
// ============================================================================

/**
 * Prompt 版本歷史記錄
 */
export const EXTRACTION_PROMPT_VERSIONS: PromptVersion[] = [
  {
    version: '1.0.0',
    createdAt: '2025-12-20',
    description: 'Initial extraction prompt - basic invoice extraction',
    prompt: LEGACY_EXTRACTION_PROMPT,
    isActive: false,
  },
  {
    version: '2.0.0',
    createdAt: '2025-01-01',
    description:
      'Optimized prompt with 5-step structure: region identification, extraction rules, exclusion rules, negative examples, and self-verification (Story 0-11)',
    prompt: OPTIMIZED_EXTRACTION_PROMPT,
    isActive: true,
  },
];

// ============================================================================
// Prompt 獲取函數
// ============================================================================

/**
 * 獲取當前活動的提取 Prompt
 *
 * @returns 當前活動版本的 Prompt 內容
 * @throws {Error} 當沒有活動版本時
 *
 * @example
 * ```typescript
 * const prompt = getActiveExtractionPrompt();
 * // 返回 OPTIMIZED_EXTRACTION_PROMPT (v2.0.0)
 * ```
 */
export function getActiveExtractionPrompt(): string {
  const active = EXTRACTION_PROMPT_VERSIONS.find((p) => p.isActive);
  if (!active) {
    throw new Error('No active extraction prompt found');
  }
  return active.prompt;
}

/**
 * 獲取當前活動的 Prompt 版本資訊
 *
 * @returns 活動版本的完整資訊
 * @throws {Error} 當沒有活動版本時
 */
export function getActivePromptVersion(): PromptVersion {
  const active = EXTRACTION_PROMPT_VERSIONS.find((p) => p.isActive);
  if (!active) {
    throw new Error('No active extraction prompt found');
  }
  return active;
}

/**
 * 獲取特定版本的提取 Prompt
 *
 * @param version - 版本號
 * @returns 指定版本的 Prompt 內容
 * @throws {Error} 當版本不存在時
 *
 * @example
 * ```typescript
 * const oldPrompt = getPromptByVersion('1.0.0');
 * const newPrompt = getPromptByVersion('2.0.0');
 * ```
 */
export function getPromptByVersion(version: string): string {
  const prompt = EXTRACTION_PROMPT_VERSIONS.find((p) => p.version === version);
  if (!prompt) {
    throw new Error(`Prompt version ${version} not found`);
  }
  return prompt.prompt;
}

/**
 * 獲取所有 Prompt 版本列表
 *
 * @returns 所有版本的資訊（不含完整 Prompt 內容）
 */
export function getPromptVersionList(): Omit<PromptVersion, 'prompt'>[] {
  return EXTRACTION_PROMPT_VERSIONS.map(({ prompt: _, ...rest }) => rest);
}

/**
 * 檢查指定版本是否存在
 *
 * @param version - 版本號
 * @returns 是否存在
 */
export function isPromptVersionExists(version: string): boolean {
  return EXTRACTION_PROMPT_VERSIONS.some((p) => p.version === version);
}
