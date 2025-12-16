# Story 7.8: 城市 AI 成本追蹤

**Status:** ready-for-dev

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

- [ ] **Task 1: API 使用日誌模型** (AC: #1)
  - [ ] 1.1 創建 `ApiUsageLog` Prisma 模型（如未建立）
  - [ ] 1.2 添加必要欄位
  - [ ] 1.3 設計索引結構
  - [ ] 1.4 創建 Database Migration

- [ ] **Task 2: 成本計算服務** (AC: #1, #4)
  - [ ] 2.1 創建 `ApiCostCalculator` 服務
  - [ ] 2.2 實現各 API 類型的成本計算
  - [ ] 2.3 從系統配置讀取單價
  - [ ] 2.4 處理 Token 計算邏輯

- [ ] **Task 3: API 調用記錄器** (AC: #1, #4)
  - [ ] 3.1 創建 `ApiUsageLogger` 服務
  - [ ] 3.2 封裝 AI 服務調用
  - [ ] 3.3 自動記錄調用詳情
  - [ ] 3.4 處理記錄失敗情況

- [ ] **Task 4: 單價配置管理** (AC: #3)
  - [ ] 4.1 創建 `ApiPricing` 配置模型
  - [ ] 4.2 實現單價管理 API
  - [ ] 4.3 添加單價歷史追蹤
  - [ ] 4.4 實現單價變更通知

- [ ] **Task 5: 成本聚合 API** (AC: #2)
  - [ ] 5.1 創建 `GET /api/cost/city-summary` 端點
  - [ ] 5.2 支援時間範圍和城市篩選
  - [ ] 5.3 實現多維度聚合
  - [ ] 5.4 添加快取機制

- [ ] **Task 6: AI 服務封裝** (AC: #1, #4)
  - [ ] 6.1 創建 Azure Document Intelligence 封裝
  - [ ] 6.2 創建 OpenAI/Azure OpenAI 封裝
  - [ ] 6.3 整合使用日誌記錄
  - [ ] 6.4 統一錯誤處理

- [ ] **Task 7: 測試** (AC: #1-4)
  - [ ] 7.1 測試成本計算準確性
  - [ ] 7.2 測試日誌記錄完整性
  - [ ] 7.3 測試單價變更影響
  - [ ] 7.4 壓力測試日誌寫入

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
*Status: ready-for-dev*
