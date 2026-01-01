# Tech Spec: Story 0-10 - AI 術語驗證服務

**Version:** 1.0.0
**Created:** 2025-01-01
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose

實現基於 GPT-4o 的 AI 術語驗證服務，用於在術語聚合階段智能過濾非運費術語（如地址、人名、公司名等）。此服務將取代現有的硬編碼過濾規則（`isAddressLikeTerm` 函數），消除維護負擔並提高識別準確性。

### 1.2 Scope

| 範圍 | 說明 |
|------|------|
| **In Scope** | AI 術語驗證服務核心、批次處理機制、成本追蹤整合、術語聚合流程整合 |
| **Out of Scope** | 現有過濾規則移除（保留作為回退機制）、UI 介面變更 |

### 1.3 Dependencies

| 依賴 | 說明 | 狀態 |
|------|------|------|
| Story 0-9 | 階層式術語聚合結構 | ✅ 已完成 |
| Azure OpenAI GPT-4o | AI 驗證引擎 | ✅ 可用 |
| `ai-cost.service.ts` | 成本追蹤機制 | ✅ 已存在 |

---

## 2. Technical Design

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI Term Validation Pipeline                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────┐  │
│  │  Term Aggregation │    │  AI Term Validator │    │ Validated Terms  │  │
│  │  Service          │───▶│  Service           │───▶│ (Clean)          │  │
│  └──────────────────┘    └───────────────────┘    └──────────────────┘  │
│           │                       │                        │             │
│           │                       ▼                        │             │
│           │              ┌───────────────────┐             │             │
│           │              │   Batch Processor  │             │             │
│           │              │  (50-100 terms)    │             │             │
│           │              └───────────────────┘             │             │
│           │                       │                        │             │
│           │                       ▼                        │             │
│           │              ┌───────────────────┐             │             │
│           │              │     GPT-4o API     │             │             │
│           │              │  (Azure OpenAI)    │             │             │
│           │              └───────────────────┘             │             │
│           │                       │                        │             │
│           │                       ▼                        │             │
│           │              ┌───────────────────┐             │             │
│           │              │   Cost Tracker     │             │             │
│           └─────────────▶│   Service          │◀────────────┘             │
│                          └───────────────────┘                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Model

#### 2.2.1 TypeScript Interfaces

```typescript
/**
 * 術語驗證結果
 */
interface TermValidationResult {
  term: string;
  isValid: boolean;
  category: TermCategory;
  confidence: number;  // 0.0 - 1.0
  reason?: string;     // 可選的分類原因
}

/**
 * 術語分類類型
 */
type TermCategory =
  | 'FREIGHT_CHARGE'   // 有效運費術語
  | 'SURCHARGE'        // 有效附加費
  | 'SERVICE_FEE'      // 有效服務費
  | 'DUTY_TAX'         // 有效關稅/稅項
  | 'ADDRESS'          // 無效 - 地址
  | 'PERSON_NAME'      // 無效 - 人名
  | 'COMPANY_NAME'     // 無效 - 公司名
  | 'BUILDING_NAME'    // 無效 - 建築物名
  | 'AIRPORT_CODE'     // 無效 - 機場代碼
  | 'REFERENCE'        // 無效 - 參考編號
  | 'OTHER';           // 無效 - 其他

/**
 * 批次驗證統計
 */
interface TermValidationStats {
  totalTerms: number;
  validTerms: number;
  filteredTerms: number;
  byCategory: Record<TermCategory, number>;
  processingTimeMs: number;
  batchCount: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  estimatedCost: number;
}

/**
 * 批次驗證結果
 */
interface BatchValidationResult {
  results: TermValidationResult[];
  stats: TermValidationStats;
  errors?: ValidationError[];
}

/**
 * 驗證錯誤
 */
interface ValidationError {
  batchIndex: number;
  error: string;
  termCount: number;
}

/**
 * 驗證配置
 */
interface TermValidationConfig {
  batchSize: number;        // 預設 50
  maxConcurrency: number;   // 預設 3
  confidenceThreshold: number;  // 預設 0.7
  enableCostTracking: boolean;  // 預設 true
  fallbackToRules: boolean; // 預設 true
}
```

#### 2.2.2 Prisma Schema Extensions

```prisma
// 無需新增資料表，使用現有結構

// 術語驗證結果儲存於 JSON 欄位（如需持久化）
// 可擴展 Batch 模型添加驗證統計
model Batch {
  // ... 現有欄位

  // 新增欄位（可選）
  termValidationStats    Json?      @map("term_validation_stats")
  termValidationCost     Decimal?   @map("term_validation_cost") @db.Decimal(10, 4)
}
```

### 2.3 Service Implementation

#### 2.3.1 AI Term Validator Service

**檔案位置**: `src/services/ai-term-validator.service.ts`

```typescript
/**
 * @fileoverview AI 術語驗證服務
 * @description 使用 GPT-4o 進行術語語義分析，過濾非運費術語
 * @module src/services/ai-term-validator
 * @since Epic 0 - Story 0.10
 */

import { AzureOpenAI } from 'openai';
import { aiCostService } from './ai-cost.service';

// 術語驗證 Prompt
const TERM_VALIDATION_PROMPT = `
You are a freight invoice term classifier. Analyze the following terms extracted from freight invoices.

For each term, determine if it is a VALID freight-related term or should be FILTERED.

## VALID freight terms (isValid: true)
Categories and examples:
- FREIGHT_CHARGE: "AIR FREIGHT", "OCEAN FREIGHT", "GROUND SHIPPING"
- SURCHARGE: "FUEL SURCHARGE", "PEAK SEASON SURCHARGE", "SECURITY FEE"
- SERVICE_FEE: "HANDLING FEE", "CUSTOMS CLEARANCE", "PICKUP FEE", "DELIVERY FEE"
- DUTY_TAX: "IMPORT DUTY", "VAT", "GST", "CUSTOMS DUTY"

## FILTER the following (isValid: false)
- ADDRESS: Cities, countries, street addresses (e.g., "HKG, HONG KONG", "123 Main Street")
- PERSON_NAME: Personal names (e.g., "KATHY LAM", "Nguyen Van Anh", "John Smith")
- COMPANY_NAME: Business names (e.g., "RICOH ASIA PACIFIC OPERATIONS LIMITED", "DHL EXPRESS")
- BUILDING_NAME: Building/tower names (e.g., "CENTRAL PLAZA TOWER", "WORLD TRADE CENTER")
- AIRPORT_CODE: Standalone airport codes (e.g., "HKG", "BLR", "SIN")
- REFERENCE: Tracking numbers, reference codes (e.g., "AWB12345", "INV-2025-001")
- OTHER: Any content not related to freight charges

## Special Rules
1. "HKG, HONG KONG" pattern → ADDRESS (not freight charge)
2. Names ending with common surnames → PERSON_NAME
3. Names ending with "LIMITED", "PTE LTD", "INC" → COMPANY_NAME
4. Currency codes alone (USD, EUR) → OTHER
5. "TOTAL", "SUBTOTAL" → OTHER

Terms to validate:
{TERMS_LIST}

Respond ONLY in JSON format:
{
  "validations": [
    {
      "index": 1,
      "term": "...",
      "isValid": true/false,
      "category": "FREIGHT_CHARGE|SURCHARGE|SERVICE_FEE|DUTY_TAX|ADDRESS|PERSON_NAME|COMPANY_NAME|BUILDING_NAME|AIRPORT_CODE|REFERENCE|OTHER",
      "confidence": 0.0-1.0,
      "reason": "brief explanation"
    }
  ]
}
`;

export class AITermValidatorService {
  private client: AzureOpenAI;
  private config: TermValidationConfig;

  constructor(config?: Partial<TermValidationConfig>) {
    this.config = {
      batchSize: 50,
      maxConcurrency: 3,
      confidenceThreshold: 0.7,
      enableCostTracking: true,
      fallbackToRules: true,
      ...config
    };

    this.client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: '2024-02-15-preview',
    });
  }

  /**
   * 驗證單批術語
   * @param terms 術語列表（最多 100 個）
   * @returns 驗證結果列表
   */
  async validateTerms(terms: string[]): Promise<TermValidationResult[]> {
    if (terms.length === 0) return [];
    if (terms.length > 100) {
      throw new Error('Single batch cannot exceed 100 terms');
    }

    const termsFormatted = terms
      .map((t, i) => `${i + 1}. "${t}"`)
      .join('\n');

    const prompt = TERM_VALIDATION_PROMPT.replace('{TERMS_LIST}', termsFormatted);

    const startTime = Date.now();

    const response = await this.client.chat.completions.create({
      model: process.env.AZURE_OPENAI_GPT4O_DEPLOYMENT || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a freight invoice term classifier.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // 低溫度確保一致性
      response_format: { type: 'json_object' }
    });

    const processingTime = Date.now() - startTime;

    // 記錄成本
    if (this.config.enableCostTracking && response.usage) {
      await aiCostService.trackUsage({
        service: 'term-validation',
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        model: 'gpt-4o'
      });
    }

    // 解析結果
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from GPT-4o');
    }

    const parsed = JSON.parse(content);

    return parsed.validations.map((v: any) => ({
      term: terms[v.index - 1],
      isValid: v.isValid,
      category: v.category,
      confidence: v.confidence,
      reason: v.reason
    }));
  }

  /**
   * 批次驗證術語（自動分批處理）
   * @param terms 術語列表
   * @returns 批次驗證結果
   */
  async validateTermsBatch(terms: string[]): Promise<BatchValidationResult> {
    const startTime = Date.now();
    const batches = this.chunkArray(terms, this.config.batchSize);

    const results: TermValidationResult[] = [];
    const errors: ValidationError[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // 並行處理批次（限制並發數）
    for (let i = 0; i < batches.length; i += this.config.maxConcurrency) {
      const batchGroup = batches.slice(i, i + this.config.maxConcurrency);

      const batchPromises = batchGroup.map(async (batch, groupIndex) => {
        try {
          return await this.validateTerms(batch);
        } catch (error) {
          errors.push({
            batchIndex: i + groupIndex,
            error: error instanceof Error ? error.message : 'Unknown error',
            termCount: batch.length
          });

          // 回退到規則過濾
          if (this.config.fallbackToRules) {
            return this.fallbackValidation(batch);
          }
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }

    // 計算統計
    const stats = this.calculateStats(results, Date.now() - startTime, batches.length);

    return { results, stats, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * 過濾有效術語
   * @param terms 原始術語列表
   * @returns 過濾後的有效術語
   */
  async filterValidTerms(terms: string[]): Promise<string[]> {
    const { results } = await this.validateTermsBatch(terms);
    return results
      .filter(r => r.isValid && r.confidence >= this.config.confidenceThreshold)
      .map(r => r.term);
  }

  /**
   * 回退驗證（使用現有規則）
   */
  private fallbackValidation(terms: string[]): TermValidationResult[] {
    // 使用現有的 isAddressLikeTerm 作為回退
    // 這部分保留現有邏輯作為 AI 失敗時的備案
    return terms.map(term => ({
      term,
      isValid: !this.isAddressLikeTerm(term),
      category: this.isAddressLikeTerm(term) ? 'OTHER' as const : 'FREIGHT_CHARGE' as const,
      confidence: 0.5, // 低信心度標記為規則過濾
      reason: 'Fallback to rule-based filtering'
    }));
  }

  /**
   * 現有規則過濾（簡化版本）
   */
  private isAddressLikeTerm(term: string): boolean {
    const normalized = term.toUpperCase().trim();

    // 基本規則檢查
    const patterns = [
      /^[A-Z]{3},\s*[A-Z\s]+$/, // HKG, HONG KONG
      /\b(STREET|ROAD|AVENUE|TOWER|PLAZA|BUILDING)\b/,
      /\b(LIMITED|LTD|PTE|INC|CORP)\b$/,
    ];

    return patterns.some(p => p.test(normalized));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private calculateStats(
    results: TermValidationResult[],
    processingTimeMs: number,
    batchCount: number
  ): TermValidationStats {
    const byCategory: Record<TermCategory, number> = {} as any;
    let validTerms = 0;
    let filteredTerms = 0;

    for (const result of results) {
      byCategory[result.category] = (byCategory[result.category] || 0) + 1;
      if (result.isValid) {
        validTerms++;
      } else {
        filteredTerms++;
      }
    }

    return {
      totalTerms: results.length,
      validTerms,
      filteredTerms,
      byCategory,
      processingTimeMs,
      batchCount,
      tokenUsage: { input: 0, output: 0, total: 0 }, // 實際值從 API 響應獲取
      estimatedCost: batchCount * 0.11 // 約 $0.11/批次
    };
  }
}

// 單例導出
export const aiTermValidatorService = new AITermValidatorService();
```

#### 2.3.2 Integration with Term Aggregation

**修改檔案**: `src/services/batch-term-aggregation.service.ts`

```typescript
// 新增導入
import { aiTermValidatorService } from './ai-term-validator.service';

// 修改 aggregateTermsForBatch 函數
export async function aggregateTermsForBatch(batchId: string): Promise<void> {
  // ... 現有代碼 ...

  // 在術語聚合完成後，添加 AI 驗證步驟
  const allTerms = extractedTerms.map(t => t.term);

  // AI 術語驗證
  const validationResult = await aiTermValidatorService.validateTermsBatch(allTerms);

  // 只保留有效術語
  const validTermSet = new Set(
    validationResult.results
      .filter(r => r.isValid)
      .map(r => r.term)
  );

  const filteredTerms = extractedTerms.filter(t => validTermSet.has(t.term));

  // 記錄驗證統計
  console.log(`[Term Validation] Batch ${batchId}:`, {
    total: validationResult.stats.totalTerms,
    valid: validationResult.stats.validTerms,
    filtered: validationResult.stats.filteredTerms,
    cost: validationResult.stats.estimatedCost
  });

  // ... 繼續現有邏輯，使用 filteredTerms ...
}
```

---

## 3. API Endpoints

### 3.1 術語驗證 API

#### POST /api/v1/admin/terms/validate

驗證術語列表（用於測試和調試）。

**Request Body:**
```json
{
  "terms": ["EXPRESS WORLDWIDE NONDOC", "HKG, HONG KONG", "KATHY LAM"],
  "config": {
    "confidenceThreshold": 0.7
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "term": "EXPRESS WORLDWIDE NONDOC",
        "isValid": true,
        "category": "FREIGHT_CHARGE",
        "confidence": 0.95,
        "reason": "Valid express shipping charge"
      },
      {
        "term": "HKG, HONG KONG",
        "isValid": false,
        "category": "ADDRESS",
        "confidence": 0.98,
        "reason": "Airport code with city name pattern"
      },
      {
        "term": "KATHY LAM",
        "isValid": false,
        "category": "PERSON_NAME",
        "confidence": 0.92,
        "reason": "Appears to be a personal name"
      }
    ],
    "stats": {
      "totalTerms": 3,
      "validTerms": 1,
      "filteredTerms": 2,
      "processingTimeMs": 1250,
      "estimatedCost": 0.11
    }
  }
}
```

### 3.2 成本報告 API

#### GET /api/v1/admin/costs/term-validation

獲取術語驗證成本統計。

**Query Parameters:**
- `startDate`: 開始日期 (YYYY-MM-DD)
- `endDate`: 結束日期 (YYYY-MM-DD)
- `groupBy`: 分組方式 (day | week | month)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalCost": 5.50,
    "totalBatches": 50,
    "totalTermsProcessed": 2500,
    "avgCostPerBatch": 0.11,
    "avgTermsPerBatch": 50,
    "byPeriod": [
      { "date": "2025-01-01", "cost": 2.20, "batches": 20 }
    ]
  }
}
```

---

## 4. UI Components

本 Story 不包含 UI 變更。驗證服務在後端自動執行。

未來可考慮添加：
- Admin Dashboard 中的驗證統計面板
- 術語過濾結果查看頁面

---

## 5. Testing Strategy

### 5.1 單元測試

**檔案**: `tests/unit/services/ai-term-validator.test.ts`

```typescript
describe('AITermValidatorService', () => {
  describe('validateTerms', () => {
    it('should correctly classify freight charge terms', async () => {
      const terms = ['EXPRESS WORLDWIDE NONDOC', 'FUEL SURCHARGE'];
      const results = await service.validateTerms(terms);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[0].category).toBe('FREIGHT_CHARGE');
    });

    it('should filter address patterns', async () => {
      const terms = ['HKG, HONG KONG', 'BLR, BANGALORE'];
      const results = await service.validateTerms(terms);

      expect(results.every(r => !r.isValid)).toBe(true);
      expect(results.every(r => r.category === 'ADDRESS')).toBe(true);
    });

    it('should filter person names', async () => {
      const terms = ['KATHY LAM', 'Nguyen Van Anh'];
      const results = await service.validateTerms(terms);

      expect(results.every(r => !r.isValid)).toBe(true);
      expect(results.every(r => r.category === 'PERSON_NAME')).toBe(true);
    });
  });

  describe('validateTermsBatch', () => {
    it('should handle large term lists with batching', async () => {
      const terms = Array(200).fill('FREIGHT CHARGE');
      const result = await service.validateTermsBatch(terms);

      expect(result.stats.batchCount).toBe(4); // 200 / 50
      expect(result.results).toHaveLength(200);
    });

    it('should fallback to rules on API error', async () => {
      // Mock API failure
      mockGptApi.mockRejectedValue(new Error('API Error'));

      const terms = ['HKG, HONG KONG'];
      const result = await service.validateTermsBatch(terms);

      expect(result.errors).toHaveLength(1);
      expect(result.results[0].reason).toContain('Fallback');
    });
  });
});
```

### 5.2 整合測試

**檔案**: `tests/integration/term-validation.test.ts`

```typescript
describe('Term Validation Integration', () => {
  it('should integrate with batch term aggregation', async () => {
    // 創建測試批次
    const batch = await createTestBatch(testFiles);

    // 執行處理（包含術語驗證）
    await processBatch(batch.id);

    // 驗證結果
    const result = await getBatchResult(batch.id);

    // 確認沒有地址類術語
    const terms = result.hierarchicalTerms.flatMap(c => c.formats.flatMap(f => f.terms));
    const addressLikeTerms = terms.filter(t =>
      /^[A-Z]{3},\s*[A-Z\s]+$/.test(t.term)
    );

    expect(addressLikeTerms).toHaveLength(0);
  });
});
```

### 5.3 驗證測試（使用真實數據）

使用 TEST-PLAN-005 數據進行驗證：

1. **提取當前錯誤術語**: 從現有結果中識別需要過濾的術語
2. **執行 AI 驗證**: 對這些術語運行驗證服務
3. **比較結果**: 確認 AI 正確識別了錯誤術語
4. **回歸測試**: 確認有效術語未被誤過濾

---

## 6. Migration Plan

### 6.1 部署步驟

```
Phase 1: 部署服務（不啟用）
├─ 部署 ai-term-validator.service.ts
├─ 添加環境變數配置
└─ 部署 API 端點

Phase 2: 影子模式測試
├─ 在術語聚合中同時執行 AI 驗證和現有規則
├─ 記錄差異到日誌
├─ 分析 AI 準確率
└─ 調整 Prompt 和配置

Phase 3: 逐步啟用
├─ 先用於新批次
├─ 監控準確率和成本
└─ 確認後完全啟用

Phase 4: 現有規則降級
├─ 將現有規則改為回退機制
├─ AI 失敗時使用規則過濾
└─ 監控回退頻率
```

### 6.2 配置開關

```typescript
// 環境變數配置
TERM_VALIDATION_ENABLED=true          // 是否啟用 AI 驗證
TERM_VALIDATION_SHADOW_MODE=false     // 影子模式（只記錄不過濾）
TERM_VALIDATION_BATCH_SIZE=50         // 批次大小
TERM_VALIDATION_CONCURRENCY=3         // 並發數
TERM_VALIDATION_FALLBACK=true         // 是否啟用規則回退
```

---

## 7. Performance Considerations

### 7.1 處理時間

| 操作 | 預期時間 |
|------|----------|
| 單批次 API 調用（50 術語） | 1-2 秒 |
| 100 文件批次（~300 術語） | 6-12 秒 |
| 並行處理（3 並發） | 提升 3x |

### 7.2 成本估算

| 項目 | 數量 | 成本 |
|------|------|------|
| 每批次（50 術語） | 1 | ~$0.11 |
| 100 文件批次 | ~6 批次 | ~$0.66 |
| 月處理量（10,000 文件） | ~600 批次 | ~$66 |

### 7.3 優化策略

1. **智能分批**: 根據術語相似性分批，減少重複解釋
2. **結果快取**: 快取常見術語的驗證結果
3. **批次大小調優**: 根據成本/時間平衡調整批次大小
4. **並發控制**: 根據 API 限制調整並發數

---

## 8. Rollback Plan

### 8.1 觸發條件

- AI 驗證準確率 < 80%
- 每批次成本 > $0.50
- API 失敗率 > 10%
- 處理時間 > 30 秒/100 術語

### 8.2 回滾步驟

```
1. 設置 TERM_VALIDATION_ENABLED=false
2. 系統自動回退到現有規則過濾
3. 分析問題原因
4. 調整 Prompt 或配置
5. 重新測試後啟用
```

### 8.3 回退機制

服務內建回退機制：
- API 失敗時自動使用 `isAddressLikeTerm` 規則
- 記錄回退事件供監控
- 低信心度結果（< 0.7）使用規則輔助判斷

---

## 9. Monitoring & Alerting

### 9.1 監控指標

| 指標 | 閾值 | 告警級別 |
|------|------|----------|
| 驗證準確率 | < 85% | Warning |
| 每批次成本 | > $0.30 | Warning |
| API 失敗率 | > 5% | Error |
| 處理時間 | > 5s/批次 | Warning |
| 回退觸發率 | > 10% | Warning |

### 9.2 日誌記錄

```typescript
// 記錄格式
{
  "timestamp": "2025-01-01T12:00:00Z",
  "service": "ai-term-validator",
  "batchId": "xxx",
  "event": "validation_complete",
  "stats": {
    "totalTerms": 50,
    "validTerms": 45,
    "filteredTerms": 5,
    "processingTimeMs": 1500,
    "cost": 0.11
  }
}
```

---

## 10. References

- [Story 0-10: AI 術語驗證服務](../stories/0-10-ai-term-validation-service.md)
- [Story 0-11: GPT Vision Prompt 優化](../stories/0-11-gpt-vision-prompt-optimization.md)
- [FIX-005: 術語過濾問題](../../claudedocs/4-changes/bug-fixes/)
- [Azure OpenAI GPT-4o API 文檔](https://learn.microsoft.com/en-us/azure/ai-services/openai/)

---

**Author:** Claude AI Assistant
**Last Updated:** 2025-01-01
**Version:** 1.0.0
