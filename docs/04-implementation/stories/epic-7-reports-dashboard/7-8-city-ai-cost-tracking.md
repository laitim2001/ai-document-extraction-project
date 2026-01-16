# Story 7.8: 城市 AI 成本追蹤

**Status:** done

---

## Story

**As a** 系統,
**I want** 按城市追蹤 AI API 調用成本,
**So that** 可以準確分攤成本到各城市。

---

## Acceptance Criteria

### AC1: API 調用記錄

**Given** AI API 被調用
**When** 系統記錄調用
**Then** 記錄以下資訊：
- 調用城市（cityCode）
- API 類型（Document Intelligence / OpenAI）
- Token 數（輸入/輸出）
- 估算成本（基於最新單價）
- 關聯的文件 ID

### AC2: 成本聚合查詢

**Given** 成本記錄
**When** 查詢城市成本
**Then** 可以按時間範圍聚合計算

### AC3: 單價配置

**Given** AI API 單價變更
**When** 系統管理員更新單價配置
**Then** 新的成本計算使用更新後的單價
**And** 歷史記錄保留原始估算成本

### AC4: 即時成本計算

**Given** AI API 調用完成
**When** 系統記錄調用
**Then** 即時計算並儲存估算成本
**And** 成本反映在相關報表中

---

## Tasks / Subtasks

- [x] **Task 1: API 計價歷史模型** (AC: #3)
  - [x] 1.1 創建 `ApiPricingHistory` Prisma 模型
  - [x] 1.2 添加必要欄位（新舊價格、變更者、變更原因）
  - [x] 1.3 設計索引結構
  - [x] 1.4 執行 prisma db push

- [x] **Task 2: 城市成本類型定義** (AC: #1-4)
  - [x] 2.1 創建 `src/types/city-cost.ts`
  - [x] 2.2 定義城市成本摘要類型（CityCostSummary）
  - [x] 2.3 定義城市成本趨勢類型（CityCostTrend）
  - [x] 2.4 定義城市成本比較類型（CityCostComparison）
  - [x] 2.5 定義計價配置管理類型

- [x] **Task 3: 城市成本服務** (AC: #1, #2, #4)
  - [x] 3.1 創建 `CityCostService` 類別
  - [x] 3.2 實現城市成本摘要查詢（getCityCostSummary）
  - [x] 3.3 實現城市成本趨勢查詢（getCityCostTrend）
  - [x] 3.4 實現城市成本比較查詢（getCityCostComparison）
  - [x] 3.5 實現記憶體快取機制（SimpleCache）

- [x] **Task 4: 計價配置管理** (AC: #3)
  - [x] 4.1 實現計價配置列表（getPricingConfigs）
  - [x] 4.2 實現計價配置詳情（getPricingConfigDetail）
  - [x] 4.3 實現創建計價配置（createPricingConfig）
  - [x] 4.4 實現更新計價配置（updatePricingConfig）
  - [x] 4.5 自動記錄計價變更歷史

- [x] **Task 5: API 路由實現** (AC: #2)
  - [x] 5.1 創建 `GET /api/cost/city-summary` 端點
  - [x] 5.2 創建 `GET /api/cost/city-trend` 端點
  - [x] 5.3 創建 `GET /api/cost/comparison` 端點
  - [x] 5.4 創建 `GET /api/cost/pricing` 端點
  - [x] 5.5 創建 `POST /api/cost/pricing` 端點
  - [x] 5.6 創建 `GET /api/cost/pricing/[id]` 端點
  - [x] 5.7 創建 `PATCH /api/cost/pricing/[id]` 端點

- [x] **Task 6: React Query Hooks** (AC: #1-4)
  - [x] 6.1 創建 `useCityCostSummary` hook
  - [x] 6.2 創建 `useCityCostTrend` hook
  - [x] 6.3 創建 `useCityCostComparison` hook
  - [x] 6.4 創建 `usePricingConfigs` hook
  - [x] 6.5 創建 `usePricingConfigDetail` hook
  - [x] 6.6 創建 `useCreatePricingConfig` mutation
  - [x] 6.7 創建 `useUpdatePricingConfig` mutation
  - [x] 6.8 創建 `useCityCostDashboard` 組合 hook

- [x] **Task 7: 類型檢查與品質確保**
  - [x] 7.1 通過 TypeScript 類型檢查
  - [x] 7.2 通過 ESLint 檢查
  - [x] 7.3 更新服務層導出

---

## Dev Notes

### 依賴項

- **Story 6.1**: 城市數據模型（cityCode 來源）
- **Story 2.2**: 文件 OCR 提取服務（AI 調用觸發）
- **Story 2.4**: 欄位映射提取（AI 調用觸發）

### Architecture Compliance

```prisma
// prisma/schema.prisma - API 單價配置
model ApiPricing {
  id            String      @id @default(uuid())
  provider      ApiProvider
  operation     String?     // null 表示該 provider 的默認單價
  pricePerCall  Float?      @map("price_per_call")      // 每次調用單價
  pricePerInputToken  Float?  @map("price_per_input_token")   // 輸入 token 單價
  pricePerOutputToken Float?  @map("price_per_output_token")  // 輸出 token 單價
  currency      String      @default("USD")
  effectiveFrom DateTime    @map("effective_from")
  effectiveTo   DateTime?   @map("effective_to")
  isActive      Boolean     @default(true) @map("is_active")
  createdBy     String      @map("created_by")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  @@index([provider, operation, isActive])
  @@index([effectiveFrom, effectiveTo])
  @@map("api_pricing")
}
```

```typescript
// src/types/api-cost.ts
export interface ApiCallRecord {
  documentId?: string
  cityCode: string
  provider: 'AZURE_DOC_INTELLIGENCE' | 'OPENAI' | 'AZURE_OPENAI'
  operation: string
  tokensInput?: number
  tokensOutput?: number
  responseTimeMs?: number
  success: boolean
  errorMessage?: string
  metadata?: Record<string, any>
}

export interface PricingConfig {
  provider: string
  operation?: string
  pricePerCall?: number
  pricePerInputToken?: number
  pricePerOutputToken?: number
  currency: string
}

export interface CityCostSummary {
  cityCode: string
  cityName: string
  totalCost: number
  totalCalls: number
  totalTokens: {
    input: number
    output: number
  }
  byProvider: {
    provider: string
    cost: number
    calls: number
    percentage: number
  }[]
  byOperation: {
    operation: string
    cost: number
    calls: number
  }[]
  period: {
    start: string
    end: string
  }
}
```

```typescript
// src/services/api-cost-calculator.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { ApiCallRecord, PricingConfig } from '@/types/api-cost'

export class ApiCostCalculator {
  private pricingCache: Map<string, PricingConfig> = new Map()
  private readonly CACHE_TTL = 60 * 60 // 1 小時

  /**
   * 計算單次 API 調用成本
   */
  async calculateCost(record: ApiCallRecord): Promise<number> {
    const pricing = await this.getPricing(record.provider, record.operation)

    if (!pricing) {
      console.warn(`No pricing found for ${record.provider}/${record.operation}`)
      return 0
    }

    let cost = 0

    // 按調用計費
    if (pricing.pricePerCall) {
      cost += pricing.pricePerCall
    }

    // 按 Token 計費
    if (record.tokensInput && pricing.pricePerInputToken) {
      cost += record.tokensInput * pricing.pricePerInputToken
    }

    if (record.tokensOutput && pricing.pricePerOutputToken) {
      cost += record.tokensOutput * pricing.pricePerOutputToken
    }

    return cost
  }

  /**
   * 獲取當前有效的單價配置
   */
  async getPricing(provider: string, operation?: string): Promise<PricingConfig | null> {
    const cacheKey = `pricing:${provider}:${operation || 'default'}`

    // 檢查記憶體快取
    if (this.pricingCache.has(cacheKey)) {
      return this.pricingCache.get(cacheKey)!
    }

    // 檢查 Redis 快取
    const cached = await redis.get(cacheKey)
    if (cached) {
      const pricing = JSON.parse(cached)
      this.pricingCache.set(cacheKey, pricing)
      return pricing
    }

    // 從資料庫查詢
    const now = new Date()

    // 先嘗試查找特定操作的單價
    let pricing = await prisma.apiPricing.findFirst({
      where: {
        provider: provider as any,
        operation: operation,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gt: now } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' }
    })

    // 如果沒有特定操作的單價，使用默認單價
    if (!pricing && operation) {
      pricing = await prisma.apiPricing.findFirst({
        where: {
          provider: provider as any,
          operation: null,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: now } }
          ]
        },
        orderBy: { effectiveFrom: 'desc' }
      })
    }

    if (!pricing) return null

    const config: PricingConfig = {
      provider: pricing.provider,
      operation: pricing.operation || undefined,
      pricePerCall: pricing.pricePerCall || undefined,
      pricePerInputToken: pricing.pricePerInputToken || undefined,
      pricePerOutputToken: pricing.pricePerOutputToken || undefined,
      currency: pricing.currency
    }

    // 寫入快取
    await redis.set(cacheKey, JSON.stringify(config), 'EX', this.CACHE_TTL)
    this.pricingCache.set(cacheKey, config)

    return config
  }

  /**
   * 清除單價快取（單價變更時調用）
   */
  async clearPricingCache(): Promise<void> {
    this.pricingCache.clear()
    const keys = await redis.keys('pricing:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }
}

export const apiCostCalculator = new ApiCostCalculator()
```

```typescript
// src/services/api-usage-logger.ts
import { prisma } from '@/lib/prisma'
import { apiCostCalculator } from './api-cost-calculator'
import { ApiCallRecord } from '@/types/api-cost'

export class ApiUsageLogger {
  /**
   * 記錄 API 調用
   */
  async logApiCall(record: ApiCallRecord): Promise<void> {
    try {
      // 計算成本
      const estimatedCost = await apiCostCalculator.calculateCost(record)

      // 寫入日誌
      await prisma.apiUsageLog.create({
        data: {
          documentId: record.documentId,
          cityCode: record.cityCode,
          provider: record.provider as any,
          operation: record.operation,
          tokensInput: record.tokensInput,
          tokensOutput: record.tokensOutput,
          estimatedCost,
          responseTime: record.responseTimeMs,
          success: record.success,
          errorMessage: record.errorMessage,
          metadata: record.metadata
        }
      })
    } catch (error) {
      // 記錄失敗不應影響主流程
      console.error('Failed to log API usage:', error)
    }
  }

  /**
   * 批次記錄 API 調用
   */
  async logBatch(records: ApiCallRecord[]): Promise<void> {
    try {
      const logsWithCost = await Promise.all(
        records.map(async record => ({
          documentId: record.documentId,
          cityCode: record.cityCode,
          provider: record.provider as any,
          operation: record.operation,
          tokensInput: record.tokensInput,
          tokensOutput: record.tokensOutput,
          estimatedCost: await apiCostCalculator.calculateCost(record),
          responseTime: record.responseTimeMs,
          success: record.success,
          errorMessage: record.errorMessage,
          metadata: record.metadata
        }))
      )

      await prisma.apiUsageLog.createMany({
        data: logsWithCost
      })
    } catch (error) {
      console.error('Failed to log API usage batch:', error)
    }
  }
}

export const apiUsageLogger = new ApiUsageLogger()
```

```typescript
// src/services/ai/document-intelligence.service.ts
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer'
import { apiUsageLogger } from '../api-usage-logger'
import { ApiCallRecord } from '@/types/api-cost'

export class DocumentIntelligenceService {
  private client: DocumentAnalysisClient

  constructor() {
    this.client = new DocumentAnalysisClient(
      process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT!,
      new AzureKeyCredential(process.env.AZURE_DOC_INTELLIGENCE_KEY!)
    )
  }

  async analyzeDocument(
    documentId: string,
    cityCode: string,
    documentUrl: string
  ): Promise<AnalysisResult> {
    const startTime = Date.now()
    let success = true
    let errorMessage: string | undefined

    try {
      const poller = await this.client.beginAnalyzeDocumentFromUrl(
        'prebuilt-invoice',
        documentUrl
      )
      const result = await poller.pollUntilDone()

      return this.transformResult(result)
    } catch (error) {
      success = false
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw error
    } finally {
      // 記錄 API 使用
      const record: ApiCallRecord = {
        documentId,
        cityCode,
        provider: 'AZURE_DOC_INTELLIGENCE',
        operation: 'invoice-analysis',
        responseTimeMs: Date.now() - startTime,
        success,
        errorMessage
      }

      await apiUsageLogger.logApiCall(record)
    }
  }

  private transformResult(result: any): AnalysisResult {
    // 轉換結果...
    return {} as AnalysisResult
  }
}

interface AnalysisResult {
  // 分析結果類型...
}
```

```typescript
// src/services/ai/openai.service.ts
import OpenAI from 'openai'
import { apiUsageLogger } from '../api-usage-logger'
import { ApiCallRecord } from '@/types/api-cost'

export class OpenAIService {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  async extractFields(
    documentId: string,
    cityCode: string,
    ocrText: string,
    forwarderCode: string
  ): Promise<ExtractionResult> {
    const startTime = Date.now()
    let success = true
    let errorMessage: string | undefined
    let tokensInput = 0
    let tokensOutput = 0

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(forwarderCode)
          },
          {
            role: 'user',
            content: `Extract invoice fields from:\n\n${ocrText}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })

      tokensInput = response.usage?.prompt_tokens || 0
      tokensOutput = response.usage?.completion_tokens || 0

      return this.parseResponse(response)
    } catch (error) {
      success = false
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw error
    } finally {
      // 記錄 API 使用
      const record: ApiCallRecord = {
        documentId,
        cityCode,
        provider: 'OPENAI',
        operation: 'field-extraction',
        tokensInput,
        tokensOutput,
        responseTimeMs: Date.now() - startTime,
        success,
        errorMessage
      }

      await apiUsageLogger.logApiCall(record)
    }
  }

  private getSystemPrompt(forwarderCode: string): string {
    return `You are an invoice field extractor for ${forwarderCode}...`
  }

  private parseResponse(response: any): ExtractionResult {
    // 解析回應...
    return {} as ExtractionResult
  }
}

interface ExtractionResult {
  // 提取結果類型...
}
```

```typescript
// src/app/api/cost/city-summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter } from '@/middleware/city-filter'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const { searchParams } = new URL(req.url)
      const startDate = new Date(searchParams.get('startDate') || new Date().setMonth(new Date().getMonth() - 1))
      const endDate = new Date(searchParams.get('endDate') || new Date())

      const cityWhere = cityFilter.isGlobalAdmin
        ? {}
        : { cityCode: { in: cityFilter.cityCodes } }

      // 按城市聚合成本
      const costByCity = await prisma.apiUsageLog.groupBy({
        by: ['cityCode'],
        where: {
          ...cityWhere,
          createdAt: { gte: startDate, lte: endDate }
        },
        _sum: {
          estimatedCost: true,
          tokensInput: true,
          tokensOutput: true
        },
        _count: { id: true }
      })

      // 獲取城市名稱
      const cities = await prisma.city.findMany({
        where: { code: { in: costByCity.map(c => c.cityCode) } },
        select: { code: true, name: true }
      })

      const cityMap = new Map(cities.map(c => [c.code, c.name]))

      // 按城市獲取 provider 分佈
      const providerDistribution = await prisma.apiUsageLog.groupBy({
        by: ['cityCode', 'provider'],
        where: {
          ...cityWhere,
          createdAt: { gte: startDate, lte: endDate }
        },
        _sum: { estimatedCost: true },
        _count: { id: true }
      })

      // 組裝結果
      const summaries = costByCity.map(city => {
        const cityProviders = providerDistribution
          .filter(p => p.cityCode === city.cityCode)

        const totalCost = city._sum.estimatedCost || 0

        return {
          cityCode: city.cityCode,
          cityName: cityMap.get(city.cityCode) || city.cityCode,
          totalCost,
          totalCalls: city._count.id,
          totalTokens: {
            input: city._sum.tokensInput || 0,
            output: city._sum.tokensOutput || 0
          },
          byProvider: cityProviders.map(p => ({
            provider: p.provider,
            cost: p._sum.estimatedCost || 0,
            calls: p._count.id,
            percentage: totalCost > 0
              ? ((p._sum.estimatedCost || 0) / totalCost) * 100
              : 0
          })),
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
      })

      // 按成本排序
      summaries.sort((a, b) => b.totalCost - a.totalCost)

      return NextResponse.json({
        success: true,
        data: summaries
      })
    } catch (error) {
      console.error('City cost summary error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch city cost summary' },
        { status: 500 }
      )
    }
  })
}
```

### 效能考量

- **非同步記錄**: API 使用記錄異步寫入，不阻塞主流程
- **批次寫入**: 支援批次記錄以提高寫入效率
- **單價快取**: 單價配置快取 1 小時
- **索引優化**: 針對常用查詢添加適當索引

### 安全考量

- **數據隔離**: 成本查詢自動應用城市過濾
- **單價變更審計**: 記錄所有單價配置變更

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-78]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR70]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.8 |
| Story Key | 7-8-city-ai-cost-tracking |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR70 |
| Dependencies | Story 6.1, Story 2.2, Story 2.4 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-19*

---

## Implementation Notes

### 實現的檔案

| 檔案 | 說明 |
|------|------|
| `prisma/schema.prisma` | 新增 `ApiPricingHistory` 模型，用於追蹤計價配置變更歷史 |
| `src/types/city-cost.ts` | 城市成本追蹤相關類型定義（摘要、趨勢、比較、計價配置） |
| `src/types/index.ts` | 更新導出城市成本類型 |
| `src/services/city-cost.service.ts` | 城市成本服務（查詢、計價配置管理） |
| `src/services/index.ts` | 更新導出城市成本服務 |
| `src/app/api/cost/city-summary/route.ts` | 城市成本摘要 API |
| `src/app/api/cost/city-trend/route.ts` | 城市成本趨勢 API |
| `src/app/api/cost/comparison/route.ts` | 城市成本比較 API |
| `src/app/api/cost/pricing/route.ts` | 計價配置列表與創建 API |
| `src/app/api/cost/pricing/[id]/route.ts` | 計價配置詳情與更新 API |
| `src/hooks/useCityCost.ts` | 城市成本 React Query hooks |

### API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/cost/city-summary` | GET | 獲取城市成本摘要 |
| `/api/cost/city-trend` | GET | 獲取城市成本趨勢 |
| `/api/cost/comparison` | GET | 獲取城市成本比較 |
| `/api/cost/pricing` | GET | 獲取計價配置列表 |
| `/api/cost/pricing` | POST | 創建計價配置 |
| `/api/cost/pricing/[id]` | GET | 獲取計價配置詳情（含歷史） |
| `/api/cost/pricing/[id]` | PATCH | 更新計價配置（自動記錄歷史） |

### 關鍵功能

1. **城市成本摘要**
   - 按城市聚合 AI API 使用成本
   - 顯示各提供者成本分佈
   - 計算平均每日成本和每次呼叫成本
   - 與上期比較的變化百分比

2. **城市成本趨勢**
   - 支援日/週/月時間粒度
   - 多城市趨勢比較
   - 成本峰值分析

3. **城市成本比較**
   - 成本排名（支援按成本/呼叫次數/效率排序）
   - 成本佔比分析
   - 與上期比較的變化

4. **計價配置管理**
   - 計價配置 CRUD
   - 自動記錄計價變更歷史
   - 支援每次呼叫計費和 Token 計費

### 設計決策

1. **使用 SimpleCache 而非 Redis**
   - 遵循專案現有架構模式
   - 5 分鐘快取 TTL
   - 減少外部依賴

2. **計價歷史自動追蹤**
   - 更新計價配置時自動檢測價格變更
   - 自動創建 `ApiPricingHistory` 記錄
   - 保留變更者和變更原因

3. **城市數據隔離**
   - 使用 `withCityFilter` 中間件
   - 自動驗證城市訪問權限
