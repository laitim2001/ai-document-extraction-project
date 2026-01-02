# Tech Spec: Story 0-11 - GPT Vision Prompt 優化

**Version:** 1.0.0
**Created:** 2025-01-01
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose

優化 GPT Vision 服務的提取 Prompt，使其在源頭正確識別發票區域並排除非運費內容（如地址、人名、公司名等）。此優化與 Story 0-10（AI 術語驗證服務）形成雙層防護機制，大幅降低最終錯誤率。

### 1.2 Scope

| 範圍 | 說明 |
|------|------|
| **In Scope** | Prompt 優化設計、區域識別增強、負面範例整合、效果驗證測試 |
| **Out of Scope** | 服務架構變更、新 API 端點、資料庫 Schema 變更 |

### 1.3 Dependencies

| 依賴 | 說明 | 狀態 |
|------|------|------|
| Story 0-8 | 文件發行者識別 | ✅ 已完成 |
| `gpt-vision.service.ts` | 現有 GPT Vision 服務 | ✅ 已存在 |
| FIX-005 ~ FIX-006 | 錯誤模式分析資料 | ✅ 已完成 |

### 1.4 與 Story 0-10 的關係

```
┌─────────────────────────────────────────────────────────────────┐
│                     雙層防護機制                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  第一層：Story 0-11 GPT Vision Prompt 優化              │    │
│  │  • 在提取階段過濾 60-70% 錯誤                           │    │
│  │  • 區域識別 + 負面範例 + 自我驗證                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ↓                                      │
│                    提取結果                                      │
│                           ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  第二層：Story 0-10 AI 術語驗證服務                     │    │
│  │  • 捕獲剩餘 20-30% 錯誤                                 │    │
│  │  • 語義分析 + 批次處理                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ↓                                      │
│                    最終有效術語（錯誤率 < 5%）                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technical Design

### 2.1 Current State Analysis

#### 2.1.1 現有 Prompt 問題

**檔案位置**: `src/services/gpt-vision.service.ts`

現有 Prompt 的主要問題：

| 問題 | 說明 | 影響 |
|------|------|------|
| **無區域指引** | 未區分 Header/Line Items/Footer | 地址、公司名被提取為術語 |
| **無排除規則** | 未說明什麼不該提取 | AI 過度提取所有文字 |
| **無負面範例** | 缺乏錯誤案例指導 | AI 無法學習錯誤模式 |
| **無自我驗證** | 無驗證邏輯 | AI 無法自我檢查 |

#### 2.1.2 錯誤提取模式分析

從 FIX-005 ~ FIX-006 收集的錯誤模式：

```typescript
const ERROR_PATTERNS = {
  // 機場代碼 + 城市模式
  airportCity: [
    'HKG, HONG KONG',
    'BLR, BANGALORE',
    'SIN, SINGAPORE',
    'DEL, NEW DELHI',
    'BOM, MUMBAI'
  ],

  // 人名模式
  personNames: [
    'KATHY LAM',
    'Nguyen Van Anh',
    'WONG KA MAN',
    'CHAN TAI MING'
  ],

  // 公司名模式
  companyNames: [
    'RICOH ASIA PACIFIC OPERATIONS LIMITED',
    'DHL EXPRESS (HONG KONG) LIMITED',
    'KINTETSU WORLD EXPRESS (HK) LTD'
  ],

  // 地址模式
  addresses: [
    'CENTRAL PLAZA TOWER',
    '123 QUEEN\'S ROAD',
    'UNIT 2301-05, 23/F'
  ]
};
```

### 2.2 Optimized Prompt Design

#### 2.2.1 Prompt 結構

```
┌─────────────────────────────────────────────────────────────────┐
│                    Optimized Prompt Structure                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ROLE DEFINITION (角色定義)                                   │
│     └─ 明確 AI 的專業角色和任務目標                              │
│                                                                  │
│  2. REGION IDENTIFICATION (區域識別)                             │
│     └─ Header / Line Items / Footer 區域定義                    │
│                                                                  │
│  3. EXTRACTION RULES (提取規則)                                  │
│     └─ 什麼應該提取 + 什麼必須排除                               │
│                                                                  │
│  4. NEGATIVE EXAMPLES (負面範例)                                 │
│     └─ 常見錯誤案例和原因說明                                    │
│                                                                  │
│  5. SELF-VERIFICATION (自我驗證)                                 │
│     └─ 提取前的驗證檢查清單                                      │
│                                                                  │
│  6. OUTPUT FORMAT (輸出格式)                                     │
│     └─ 結構化 JSON 輸出規格                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 完整優化 Prompt

```typescript
/**
 * @fileoverview 優化版 GPT Vision 提取 Prompt
 * @version 2.0.0
 * @since Story 0-11
 */

export const OPTIMIZED_EXTRACTION_PROMPT = `
You are an expert freight invoice analyzer. Your task is to extract ONLY the charge line items from freight invoices.

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

### ❌ Contact Information
- Person names: "KATHY LAM", "WONG KA MAN", "Nguyen Van Anh"
- Phone numbers: "+852 1234 5678"
- Email addresses: "contact@company.com"

### ❌ Company Information
- Company names: "RICOH ASIA PACIFIC OPERATIONS LIMITED"
- Business suffixes: "XXX LIMITED", "XXX PTE LTD", "XXX INC"
- Trade names: "DHL EXPRESS", "FEDEX INTERNATIONAL"

### ❌ Address Information
- Building names: "CENTRAL PLAZA TOWER", "WORLD TRADE CENTER"
- Street addresses: "123 QUEEN'S ROAD CENTRAL"
- Unit numbers: "UNIT 2301-05, 23/F"

### ❌ Summary Information
- Total rows: "TOTAL", "SUBTOTAL", "GRAND TOTAL"
- Summary lines: "AMOUNT DUE", "BALANCE"

## STEP 4: NEGATIVE EXAMPLES

Here are common MISTAKES to avoid:

| Extracted (WRONG) | Why It's Wrong | Correct Action |
|-------------------|----------------|----------------|
| "HKG, HONG KONG" | This is origin/destination, not a charge | Skip |
| "KATHY LAM" | This is a contact person name | Skip |
| "RICOH LIMITED" | This is the customer company name | Skip |
| "CENTRAL PLAZA" | This is part of an address | Skip |
| "TOTAL" | This is a summary row, not a charge | Skip |
| "USD" | This is a currency code, not a charge | Skip |

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

Now analyze the invoice image and extract ONLY valid freight charges.
`;
```

### 2.3 Service Implementation

#### 2.3.1 Prompt Version Management

**新增檔案**: `src/services/prompts/extraction-prompts.ts`

```typescript
/**
 * @fileoverview 提取 Prompt 版本管理
 * @module src/services/prompts/extraction-prompts
 * @since Epic 0 - Story 0.11
 */

export interface PromptVersion {
  version: string;
  createdAt: string;
  description: string;
  prompt: string;
  isActive: boolean;
}

// Prompt 版本歷史
export const EXTRACTION_PROMPT_VERSIONS: PromptVersion[] = [
  {
    version: '1.0.0',
    createdAt: '2025-12-20',
    description: 'Initial extraction prompt',
    prompt: LEGACY_EXTRACTION_PROMPT,
    isActive: false
  },
  {
    version: '2.0.0',
    createdAt: '2025-01-01',
    description: 'Optimized prompt with region identification, negative examples, and self-verification',
    prompt: OPTIMIZED_EXTRACTION_PROMPT,
    isActive: true
  }
];

/**
 * 獲取當前活動的 Prompt
 */
export function getActiveExtractionPrompt(): string {
  const active = EXTRACTION_PROMPT_VERSIONS.find(p => p.isActive);
  if (!active) {
    throw new Error('No active extraction prompt found');
  }
  return active.prompt;
}

/**
 * 獲取特定版本的 Prompt
 */
export function getPromptByVersion(version: string): string {
  const prompt = EXTRACTION_PROMPT_VERSIONS.find(p => p.version === version);
  if (!prompt) {
    throw new Error(`Prompt version ${version} not found`);
  }
  return prompt.prompt;
}
```

#### 2.3.2 GPT Vision Service 更新

**修改檔案**: `src/services/gpt-vision.service.ts`

```typescript
// 新增導入
import {
  getActiveExtractionPrompt,
  getPromptByVersion
} from './prompts/extraction-prompts';

/**
 * 處理圖片並提取發票內容
 * @param imageData Base64 encoded image or URL
 * @param options 處理選項
 */
export async function processImageWithVision(
  imageData: string,
  options?: {
    promptVersion?: string;  // 可選指定 Prompt 版本
    includeExcludedItems?: boolean;  // 是否返回排除項
  }
): Promise<InvoiceExtractionResult> {
  // 獲取 Prompt
  const extractionPrompt = options?.promptVersion
    ? getPromptByVersion(options.promptVersion)
    : getActiveExtractionPrompt();

  const response = await openai.chat.completions.create({
    model: process.env.AZURE_OPENAI_GPT4O_DEPLOYMENT || 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: extractionPrompt },
          {
            type: 'image_url',
            image_url: {
              url: imageData.startsWith('data:')
                ? imageData
                : `data:image/jpeg;base64,${imageData}`,
              detail: 'high'
            }
          }
        ]
      }
    ],
    max_tokens: 4096,
    temperature: 0.1  // 低溫度確保一致性
  });

  // 解析響應
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from GPT-4o Vision');
  }

  const parsed = JSON.parse(content);

  // 記錄排除項供調試
  if (parsed.excludedItems?.length > 0) {
    console.log('[GPT Vision] Excluded items:', parsed.excludedItems);
  }

  // 返回結果
  return {
    lineItems: parsed.lineItems,
    metadata: {
      ...parsed.invoiceMetadata,
      promptVersion: options?.promptVersion || '2.0.0',
      excludedItems: options?.includeExcludedItems
        ? parsed.excludedItems
        : undefined
    }
  };
}
```

### 2.4 輸出格式增強

#### 2.4.1 更新 Interface 定義

```typescript
/**
 * 發票提取結果
 */
interface InvoiceExtractionResult {
  lineItems: ExtractedLineItem[];
  metadata: ExtractionMetadata;
}

/**
 * 提取的行項目
 */
interface ExtractedLineItem {
  description: string;
  amount: number;
  currency: string;
  confidence: number;
}

/**
 * 提取元數據
 */
interface ExtractionMetadata {
  regionsIdentified: ('header' | 'lineItems' | 'footer')[];
  lineItemsTableFound: boolean;
  extractionConfidence: number;
  promptVersion: string;
  excludedItems?: ExcludedItem[];
}

/**
 * 排除項（用於調試和分析）
 */
interface ExcludedItem {
  text: string;
  reason: string;
  region: 'header' | 'lineItems' | 'footer' | 'unknown';
}
```

---

## 3. API Endpoints

### 3.1 Prompt 版本管理 API

#### GET /api/v1/admin/prompts/extraction

獲取提取 Prompt 版本列表。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "activeVersion": "2.0.0",
    "versions": [
      {
        "version": "1.0.0",
        "createdAt": "2025-12-20",
        "description": "Initial extraction prompt",
        "isActive": false
      },
      {
        "version": "2.0.0",
        "createdAt": "2025-01-01",
        "description": "Optimized prompt with region identification",
        "isActive": true
      }
    ]
  }
}
```

### 3.2 A/B 測試 API

#### POST /api/v1/admin/prompts/test

使用不同 Prompt 版本測試同一文件。

**Request Body:**
```json
{
  "fileId": "xxx",
  "versions": ["1.0.0", "2.0.0"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "fileId": "xxx",
    "results": {
      "1.0.0": {
        "lineItems": [...],
        "extractedCount": 15,
        "processingTimeMs": 2500
      },
      "2.0.0": {
        "lineItems": [...],
        "extractedCount": 8,
        "excludedItems": [
          { "text": "HKG, HONG KONG", "reason": "Location" }
        ],
        "processingTimeMs": 2800
      }
    },
    "comparison": {
      "itemsReducedBy": 7,
      "reductionPercentage": 46.7
    }
  }
}
```

---

## 4. UI Components

本 Story 不包含 UI 變更。Prompt 優化在後端自動應用。

未來可考慮添加：
- Admin Dashboard 中的 Prompt 版本切換介面
- A/B 測試結果查看頁面

---

## 5. Testing Strategy

### 5.1 單元測試

**檔案**: `tests/unit/services/gpt-vision.test.ts`

```typescript
describe('GPT Vision Service - Optimized Prompt', () => {
  describe('processImageWithVision', () => {
    it('should use active prompt version by default', async () => {
      const result = await processImageWithVision(testImageBase64);
      expect(result.metadata.promptVersion).toBe('2.0.0');
    });

    it('should allow specifying prompt version', async () => {
      const result = await processImageWithVision(testImageBase64, {
        promptVersion: '1.0.0'
      });
      expect(result.metadata.promptVersion).toBe('1.0.0');
    });

    it('should include excluded items when requested', async () => {
      const result = await processImageWithVision(testImageBase64, {
        includeExcludedItems: true
      });
      expect(result.metadata.excludedItems).toBeDefined();
    });
  });
});
```

### 5.2 A/B 測試方案

#### 5.2.1 測試數據準備

```typescript
// 測試數據集
const TEST_DATASET = {
  // 包含已知錯誤提取的文件
  filesWithKnownErrors: [
    { fileId: 'xxx', knownErrors: ['HKG, HONG KONG', 'KATHY LAM'] },
    { fileId: 'yyy', knownErrors: ['BLR, BANGALORE', 'CENTRAL PLAZA'] }
  ],

  // 正常文件（驗證無誤殺）
  normalFiles: [
    { fileId: 'zzz', validTerms: ['FREIGHT CHARGES', 'FUEL SURCHARGE'] }
  ]
};
```

#### 5.2.2 效果驗證腳本

**檔案**: `scripts/test-prompt-optimization.ts`

```typescript
import { processImageWithVision } from '@/services/gpt-vision.service';
import { prisma } from '@/lib/prisma';

interface TestResult {
  fileId: string;
  v1Results: {
    extractedCount: number;
    errorTerms: string[];
  };
  v2Results: {
    extractedCount: number;
    errorTerms: string[];
    excludedItems: string[];
  };
  improvement: {
    errorsReduced: number;
    validTermsKept: boolean;
  };
}

async function runABTest(fileIds: string[]): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const fileId of fileIds) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    const imageData = await loadImageAsBase64(file.storagePath);

    // V1 結果
    const v1 = await processImageWithVision(imageData, { promptVersion: '1.0.0' });

    // V2 結果
    const v2 = await processImageWithVision(imageData, {
      promptVersion: '2.0.0',
      includeExcludedItems: true
    });

    // 分析
    const v1Errors = findKnownErrorTerms(v1.lineItems);
    const v2Errors = findKnownErrorTerms(v2.lineItems);

    results.push({
      fileId,
      v1Results: {
        extractedCount: v1.lineItems.length,
        errorTerms: v1Errors
      },
      v2Results: {
        extractedCount: v2.lineItems.length,
        errorTerms: v2Errors,
        excludedItems: v2.metadata.excludedItems?.map(e => e.text) || []
      },
      improvement: {
        errorsReduced: v1Errors.length - v2Errors.length,
        validTermsKept: checkValidTermsPreserved(v1.lineItems, v2.lineItems)
      }
    });
  }

  return results;
}

// 執行測試
runABTest(TEST_DATASET.filesWithKnownErrors.map(f => f.fileId))
  .then(results => {
    console.log('A/B Test Results:');
    console.log('================');

    const totalErrorsReduced = results.reduce(
      (sum, r) => sum + r.improvement.errorsReduced, 0
    );
    const allValidKept = results.every(r => r.improvement.validTermsKept);

    console.log(`Total errors reduced: ${totalErrorsReduced}`);
    console.log(`All valid terms preserved: ${allValidKept}`);
  });
```

### 5.3 效果指標

| 指標 | 定義 | 目標 |
|------|------|------|
| **錯誤提取率** | 錯誤術語數 / 總提取數 | < 5% (下降 50%+) |
| **有效提取率** | 正確術語數 / 應提取術語數 | > 90% |
| **區域識別準確率** | 正確識別區域 / 總區域數 | > 95% |
| **處理時間** | 平均每文件處理時間 | 無顯著增加（< 10%） |

---

## 6. Migration Plan

### 6.1 部署步驟

```
Phase 1: 部署新 Prompt（不啟用）
├─ 部署 extraction-prompts.ts
├─ 部署更新的 gpt-vision.service.ts
├─ 新 Prompt 設置為 isActive: false
└─ 舊 Prompt 保持 isActive: true

Phase 2: A/B 測試
├─ 選擇 20+ 測試文件
├─ 執行 A/B 測試腳本
├─ 分析結果：錯誤減少率、誤殺率
└─ 調整 Prompt 細節（如需要）

Phase 3: 逐步切換
├─ 新批次使用新 Prompt
├─ 監控提取準確率
├─ 收集排除項日誌
└─ 確認效果後完全切換

Phase 4: 完全啟用
├─ 設置新 Prompt 為 isActive: true
├─ 保留舊 Prompt 供回滾
└─ 更新文檔和監控
```

### 6.2 配置開關

```typescript
// 環境變數配置
GPT_VISION_PROMPT_VERSION=2.0.0      // 指定 Prompt 版本
GPT_VISION_LOG_EXCLUDED=true         // 是否記錄排除項
GPT_VISION_INCLUDE_EXCLUDED=false    // API 響應是否包含排除項
```

---

## 7. Performance Considerations

### 7.1 處理時間影響

| 指標 | V1 Prompt | V2 Prompt | 差異 |
|------|-----------|-----------|------|
| Prompt 長度 | ~500 tokens | ~1500 tokens | +1000 tokens |
| 處理時間 | ~2.5s | ~3.0s | +20% |
| 輸出質量 | 基礎 | 增強（含排除項） | 顯著提升 |

### 7.2 成本影響

| 項目 | V1 成本 | V2 成本 | 差異 |
|------|---------|---------|------|
| Input tokens | ~1500 | ~2500 | +$0.01 |
| Output tokens | ~2000 | ~2500 | +$0.015 |
| **每文件總成本** | ~$0.10 | ~$0.125 | +25% |

**成本效益分析**：
- 每文件增加 ~$0.025
- 但減少 50%+ 後續過濾工作
- 減少人工審核負擔
- 總體效益為正

### 7.3 優化建議

1. **Prompt 快取**: 快取編譯後的 Prompt 減少解析時間
2. **批次處理優化**: 對相似文件使用快取結果
3. **響應壓縮**: 只返回必要欄位減少傳輸時間

---

## 8. Rollback Plan

### 8.1 觸發條件

- 有效術語提取率 < 80%
- 處理時間增加 > 50%
- 關鍵運費術語被誤排除

### 8.2 回滾步驟

```
1. 設置 GPT_VISION_PROMPT_VERSION=1.0.0
2. 或在代碼中設置舊 Prompt isActive: true
3. 重新部署服務
4. 分析問題原因
5. 調整 Prompt 後重新測試
```

### 8.3 版本共存

- V1 和 V2 Prompt 可同時存在
- 通過環境變數或 API 參數切換
- 支持漸進式遷移

---

## 9. Monitoring & Alerting

### 9.1 監控指標

| 指標 | 閾值 | 告警級別 |
|------|------|----------|
| 有效提取率 | < 85% | Error |
| 排除項比例 | > 60% | Warning |
| 處理時間 | > 5s | Warning |
| 區域識別失敗 | > 10% | Error |

### 9.2 日誌記錄

```typescript
// 提取完成日誌
{
  "timestamp": "2025-01-01T12:00:00Z",
  "service": "gpt-vision",
  "event": "extraction_complete",
  "fileId": "xxx",
  "promptVersion": "2.0.0",
  "stats": {
    "lineItemsExtracted": 8,
    "itemsExcluded": 5,
    "regionsIdentified": ["header", "lineItems", "footer"],
    "confidence": 0.95,
    "processingTimeMs": 2800
  }
}
```

### 9.3 排除項分析

定期分析排除項日誌：
- 識別新的錯誤模式
- 驗證排除邏輯正確性
- 發現誤排除的有效術語

---

## 10. References

- [Story 0-11: GPT Vision Prompt 優化](../stories/0-11-gpt-vision-prompt-optimization.md)
- [Story 0-10: AI 術語驗證服務](../stories/0-10-ai-term-validation-service.md)
- [FIX-005 ~ FIX-006: 術語過濾問題](../../claudedocs/4-changes/bug-fixes/)
- [GPT-4o Vision API 文檔](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/vision)

---

**Author:** Claude AI Assistant
**Last Updated:** 2025-01-01
**Version:** 1.0.0
