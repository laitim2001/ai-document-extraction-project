# Story 6.5: 全局規則共享機制

**Status:** done

---

## Story

**As a** 系統,
**I want** 在所有城市共享 Mapping Rules 和 Forwarder Profiles,
**So that** 規則維護集中化且一致。

---

## Acceptance Criteria

### AC1: 規則全局應用

**Given** Super User 創建或修改規則
**When** 規則生效
**Then** 規則自動應用於所有城市
**And** 無需針對每個城市單獨配置

### AC2: 規則使用一致性

**Given** 城市用戶處理發票
**When** 系統應用規則
**Then** 使用全局共享的規則庫
**And** 規則版本在所有城市保持一致

### AC3: 即時規則更新

**Given** 規則更新後
**When** 任何城市處理發票
**Then** 立即使用最新版本的規則
**And** 無需城市級別的同步操作

### AC4: Forwarder 全局共享

**Given** Forwarder Profile 創建或修改
**When** 配置生效
**Then** 所有城市都可識別該 Forwarder
**And** 使用相同的映射規則集

---

## Tasks / Subtasks

- [x] **Task 1: 數據模型設計** (AC: #1, #4)
  - [x] 1.1 確認 MappingRule 無 cityCode
  - [x] 1.2 確認 Forwarder 無 cityCode
  - [x] 1.3 確認 RuleSuggestion 無 cityCode
  - [x] 1.4 驗證關聯查詢正確性
  - [x] 1.5 新增 RuleCacheVersion 模型用於版本追蹤

- [x] **Task 2: 規則緩存機制** (AC: #2, #3)
  - [x] 2.1 創建規則緩存服務 (RuleResolver)
  - [x] 2.2 實現緩存失效策略 (TTL + 事件驅動)
  - [x] 2.3 支援熱更新 (invalidateForwarderCache)
  - [x] 2.4 使用 Map-based in-memory 快取（適應無 Redis 環境）

- [x] **Task 3: 規則版本同步** (AC: #2)
  - [x] 3.1 創建規則版本號機制 (RuleCacheVersion + incrementGlobalVersion)
  - [x] 3.2 記錄規則更新時間戳
  - [x] 3.3 客戶端版本檢查 (useRuleVersion hook)
  - [x] 3.4 API 端點支援版本查詢 (/api/rules/version)

- [x] **Task 4: 即時更新通知** (AC: #3)
  - [x] 4.1 規則變更事件發布 (onCacheInvalidation callback 機制)
  - [x] 4.2 客戶端輪詢版本檢查 (React Query refetchInterval)
  - [x] 4.3 客戶端緩存刷新 (invalidateQueries)
  - [x] 4.4 整合至規則審核/回滾 API

- [x] **Task 5: 規則應用服務** (AC: #1, #2)
  - [x] 5.1 創建 `src/services/rule-resolver.ts`
  - [x] 5.2 根據 Forwarder 獲取規則 (getRulesForForwarder)
  - [x] 5.3 規則優先級排序
  - [x] 5.4 規則衝突處理 (getBestRuleForField)

- [x] **Task 6: Forwarder 識別服務** (AC: #4)
  - [x] 6.1 確認識別邏輯無城市限制 (getAllActiveForwarders)
  - [x] 6.2 全局 Forwarder 列表查詢 (無 cityCode 過濾)
  - [x] 6.3 識別結果緩存 (forwardersCache, patternsCache)
  - [x] 6.4 新 Forwarder 即時生效 (invalidateCache)

- [x] **Task 7: 規則使用統計** (AC: #1)
  - [x] 7.1 記錄規則應用城市分布 (RuleMetricsService.recordApplication)
  - [x] 7.2 統計各城市規則使用率 (getCityRuleUsage)
  - [x] 7.3 分析規則成效 (getRuleEffectiveness)
  - [x] 7.4 生成規則效果報告 (generateEffectivenessReport)

- [x] **Task 8: 城市特例處理** (AC: #1)
  - [x] 8.1 確認無城市覆寫需求（全局規則設計）
  - [x] 8.2 規則全局共享，無需城市特例
  - [x] 8.3 通過 Forwarder 區分處理差異
  - [x] 8.4 保持核心規則一致 (verified)

- [x] **Task 9: 監控與告警** (AC: #2, #3)
  - [x] 9.1 規則版本追蹤 (RuleCacheVersion)
  - [x] 9.2 版本 API 端點 (/api/rules/version)
  - [x] 9.3 規則成效 API 端點 (/api/rules/[id]/metrics)
  - [x] 9.4 應用歷史記錄 (getApplicationHistory)

- [x] **Task 10: 驗證與測試** (AC: #1-4)
  - [x] 10.1 TypeScript 類型檢查通過
  - [x] 10.2 ESLint 檢查通過
  - [x] 10.3 服務正確導出
  - [x] 10.4 快取失效整合至 API

---

## Dev Notes

### 依賴項

- **Story 6.1**: 城市數據模型
- **Story 4.1**: 映射規則管理
- **Story 5.1**: Forwarder 管理

### Architecture Compliance

```typescript
// 確認全局共享的數據模型（無 cityCode）
// MappingRule - 全局共享
model MappingRule {
  id            String   @id @default(uuid())
  forwarderId   String   @map("forwarder_id")
  fieldName     String   @map("field_name")
  extractionType ExtractionType @map("extraction_type")
  pattern       String?
  confidence    Float    @default(0.8)
  priority      Int      @default(0)
  status        RuleStatus @default(ACTIVE)
  version       Int      @default(1)
  createdBy     String   @map("created_by")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // 注意：無 cityCode 欄位，規則全局共享
  forwarder Forwarder @relation(fields: [forwarderId], references: [id])
  // ...

  @@map("mapping_rules")
}

// Forwarder - 全局共享
model Forwarder {
  id            String   @id @default(uuid())
  name          String   @unique
  code          String   @unique
  description   String?
  status        ForwarderStatus @default(ACTIVE)
  // 注意：無 cityCode 欄位，Forwarder 全局共享
  // ...

  @@map("forwarders")
}

// 規則緩存版本追蹤
model RuleCacheVersion {
  id            String   @id @default(uuid())
  entityType    String   @map("entity_type")  // 'mapping_rules' | 'forwarders'
  version       Int
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@unique([entityType])
  @@map("rule_cache_versions")
}
```

```typescript
// src/services/rule-resolver.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const CACHE_TTL = 60 * 5 // 5 分鐘

export class RuleResolver {
  private static instance: RuleResolver

  static getInstance(): RuleResolver {
    if (!RuleResolver.instance) {
      RuleResolver.instance = new RuleResolver()
    }
    return RuleResolver.instance
  }

  /**
   * 根據 Forwarder 獲取所有適用的映射規則
   * 規則為全局共享，所有城市使用相同的規則集
   */
  async getRulesForForwarder(forwarderId: string): Promise<MappingRule[]> {
    const cacheKey = `rules:forwarder:${forwarderId}`

    // 嘗試從緩存獲取
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // 從數據庫獲取活躍規則
    const rules = await prisma.mappingRule.findMany({
      where: {
        forwarderId,
        status: 'ACTIVE',
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // 緩存結果
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(rules))

    return rules
  }

  /**
   * 獲取特定欄位的最佳匹配規則
   */
  async getBestRuleForField(
    forwarderId: string,
    fieldName: string
  ): Promise<MappingRule | null> {
    const rules = await this.getRulesForForwarder(forwarderId)

    // 找到該欄位優先級最高的規則
    return rules.find(r => r.fieldName === fieldName) || null
  }

  /**
   * 清除特定 Forwarder 的規則緩存
   */
  async invalidateForwarderCache(forwarderId: string): Promise<void> {
    const cacheKey = `rules:forwarder:${forwarderId}`
    await redis.del(cacheKey)

    // 發布緩存失效事件
    await this.publishCacheInvalidation('mapping_rules', forwarderId)
  }

  /**
   * 清除所有規則緩存
   */
  async invalidateAllRulesCache(): Promise<void> {
    const keys = await redis.keys('rules:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }

    // 更新全局版本號
    await this.incrementGlobalVersion('mapping_rules')
  }

  /**
   * 發布緩存失效事件（用於分布式環境）
   */
  private async publishCacheInvalidation(
    entityType: string,
    entityId?: string
  ): Promise<void> {
    await redis.publish('rule-cache-invalidation', JSON.stringify({
      type: entityType,
      id: entityId,
      timestamp: new Date().toISOString(),
    }))
  }

  /**
   * 增加全局版本號
   */
  private async incrementGlobalVersion(entityType: string): Promise<number> {
    const result = await prisma.ruleCacheVersion.upsert({
      where: { entityType },
      create: { entityType, version: 1 },
      update: { version: { increment: 1 } },
    })
    return result.version
  }

  /**
   * 獲取當前全局版本號
   */
  async getGlobalVersion(entityType: string): Promise<number> {
    const record = await prisma.ruleCacheVersion.findUnique({
      where: { entityType },
    })
    return record?.version || 0
  }
}

export const ruleResolver = RuleResolver.getInstance()
```

```typescript
// src/services/forwarder-identifier.ts
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const FORWARDERS_CACHE_KEY = 'global:forwarders'
const CACHE_TTL = 60 * 10 // 10 分鐘

export class ForwarderIdentifier {
  /**
   * 獲取所有活躍的 Forwarder（全局共享）
   */
  async getAllActiveForwarders(): Promise<Forwarder[]> {
    // 嘗試從緩存獲取
    const cached = await redis.get(FORWARDERS_CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }

    // 從數據庫獲取（無城市過濾）
    const forwarders = await prisma.forwarder.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    })

    // 緩存結果
    await redis.setex(FORWARDERS_CACHE_KEY, CACHE_TTL, JSON.stringify(forwarders))

    return forwarders
  }

  /**
   * 根據文件內容識別 Forwarder
   * 識別邏輯對所有城市一致
   */
  async identifyForwarder(documentContent: string): Promise<IdentificationResult> {
    const forwarders = await this.getAllActiveForwarders()

    for (const forwarder of forwarders) {
      const match = await this.matchForwarder(forwarder, documentContent)
      if (match.isMatch) {
        return {
          forwarderId: forwarder.id,
          forwarderCode: forwarder.code,
          forwarderName: forwarder.name,
          confidence: match.confidence,
          matchedPatterns: match.patterns,
        }
      }
    }

    return {
      forwarderId: null,
      forwarderCode: null,
      forwarderName: null,
      confidence: 0,
      matchedPatterns: [],
    }
  }

  /**
   * 清除 Forwarder 緩存
   */
  async invalidateCache(): Promise<void> {
    await redis.del(FORWARDERS_CACHE_KEY)
  }

  private async matchForwarder(
    forwarder: Forwarder,
    content: string
  ): Promise<{ isMatch: boolean; confidence: number; patterns: string[] }> {
    // 實現 Forwarder 識別邏輯
    // 這裡是簡化示例，實際可能更複雜
    const patterns = await this.getForwarderPatterns(forwarder.id)
    const matchedPatterns: string[] = []
    let totalScore = 0

    for (const pattern of patterns) {
      if (content.includes(pattern.text) || new RegExp(pattern.regex).test(content)) {
        matchedPatterns.push(pattern.name)
        totalScore += pattern.weight
      }
    }

    const confidence = patterns.length > 0 ? totalScore / patterns.length : 0

    return {
      isMatch: confidence >= forwarder.defaultConfidence,
      confidence,
      patterns: matchedPatterns,
    }
  }
}

export const forwarderIdentifier = new ForwarderIdentifier()
```

```typescript
// src/lib/rule-sync.ts
import { redis } from '@/lib/redis'
import { ruleResolver } from '@/services/rule-resolver'
import { forwarderIdentifier } from '@/services/forwarder-identifier'

/**
 * 規則同步訂閱者
 * 監聽規則變更事件，確保所有實例緩存一致
 */
export class RuleSyncSubscriber {
  private subscriber: Redis

  constructor() {
    this.subscriber = redis.duplicate()
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe('rule-cache-invalidation')

    this.subscriber.on('message', async (channel, message) => {
      if (channel === 'rule-cache-invalidation') {
        const event = JSON.parse(message)
        await this.handleInvalidation(event)
      }
    })

    console.log('Rule sync subscriber started')
  }

  private async handleInvalidation(event: CacheInvalidationEvent): Promise<void> {
    switch (event.type) {
      case 'mapping_rules':
        if (event.id) {
          await ruleResolver.invalidateForwarderCache(event.id)
        } else {
          await ruleResolver.invalidateAllRulesCache()
        }
        break

      case 'forwarders':
        await forwarderIdentifier.invalidateCache()
        break
    }

    console.log(`Cache invalidated: ${event.type}`, event.id || 'all')
  }

  async stop(): Promise<void> {
    await this.subscriber.unsubscribe('rule-cache-invalidation')
    await this.subscriber.quit()
  }
}

interface CacheInvalidationEvent {
  type: 'mapping_rules' | 'forwarders'
  id?: string
  timestamp: string
}
```

```typescript
// src/app/api/rules/[id]/route.ts - 規則更新時觸發全局緩存失效
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ... 權限驗證和更新邏輯 ...

  // 更新規則
  const updatedRule = await prisma.mappingRule.update({
    where: { id: params.id },
    data: { ...updates, version: { increment: 1 } },
  })

  // 觸發緩存失效（所有城市的緩存都會更新）
  await ruleResolver.invalidateForwarderCache(updatedRule.forwarderId)

  // 發送 WebSocket 通知（可選）
  await notifyRuleUpdate(updatedRule)

  return NextResponse.json({
    success: true,
    data: updatedRule,
  })
}
```

```typescript
// src/hooks/useRuleVersion.ts
'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

/**
 * 監控規則版本，確保客戶端使用最新規則
 */
export function useRuleVersion() {
  const [localVersion, setLocalVersion] = useState<number>(0)

  const { data: serverVersion } = useQuery({
    queryKey: ['rule-version'],
    queryFn: () => fetchRuleVersion(),
    refetchInterval: 30000, // 每 30 秒檢查一次
  })

  useEffect(() => {
    if (serverVersion && serverVersion > localVersion) {
      // 版本不一致，需要刷新本地緩存
      console.log('Rule version changed, refreshing...')
      setLocalVersion(serverVersion)

      // 觸發相關查詢重新獲取
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['forwarders'] })
    }
  }, [serverVersion, localVersion])

  return {
    version: localVersion,
    isOutdated: serverVersion && serverVersion > localVersion,
  }
}
```

### 監控指標

```typescript
// src/services/rule-metrics.ts
export class RuleMetrics {
  /**
   * 記錄規則應用統計（按城市分組）
   */
  async recordRuleApplication(
    ruleId: string,
    cityCode: string,
    success: boolean
  ): Promise<void> {
    const key = `rule:${ruleId}:applications`

    await prisma.ruleApplication.create({
      data: {
        ruleId,
        cityCode, // 記錄應用城市，用於統計
        success,
      },
    })

    // 更新 Redis 計數器（快速統計）
    await redis.hincrby(key, cityCode, 1)
    await redis.hincrby(key, success ? 'success' : 'failure', 1)
  }

  /**
   * 獲取規則在各城市的應用分布
   */
  async getRuleDistribution(ruleId: string): Promise<CityDistribution[]> {
    const applications = await prisma.ruleApplication.groupBy({
      by: ['cityCode'],
      where: { ruleId },
      _count: { id: true },
    })

    const cities = await prisma.city.findMany({
      where: { code: { in: applications.map(a => a.cityCode) } },
    })

    return applications.map(a => ({
      cityCode: a.cityCode,
      cityName: cities.find(c => c.code === a.cityCode)?.name || a.cityCode,
      count: a._count.id,
    }))
  }
}
```

### References

- [Source: docs/03-epics/sections/epic-6-multi-city-data-isolation.md#story-65]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR47]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 6.5 |
| Story Key | 6-5-global-rule-sharing-mechanism |
| Epic | Epic 6: 多城市數據隔離 |
| FR Coverage | FR47 |
| Dependencies | Story 6.1, Story 4.1, Story 5.1 |

---

*Story created: 2025-12-16*
*Status: done*
*Completed: 2025-12-19*
