# Tech Spec: Story 6.5 - Global Rule Sharing Mechanism

## Story Reference
- **Story ID**: 6.5
- **Story Title**: 全局規則共享機制
- **Epic**: Epic 6 - 多城市數據隔離
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
實現 Mapping Rules 和 Forwarder Profiles 的全局共享機制，確保規則在所有城市保持一致，並支援即時更新和版本同步。

### 1.2 Scope
- 確認數據模型無城市限制
- 規則緩存機制與失效策略
- 規則版本同步
- 即時更新通知
- 規則應用服務
- Forwarder 識別服務
- 規則使用統計
- 監控與告警

### 1.3 Dependencies
- Story 6.1: 城市數據模型
- Story 4.1: 映射規則管理
- Story 5.1: Forwarder 管理

---

## 2. Data Model Verification

### 2.1 Global Shared Models (No cityCode)

```prisma
// prisma/schema.prisma

// ============================================
// MappingRule - 全局共享（無 cityCode）
// ============================================
model MappingRule {
  id              String         @id @default(uuid())
  forwarderId     String         @map("forwarder_id")
  fieldName       String         @map("field_name")
  extractionType  ExtractionType @map("extraction_type")
  pattern         String?
  aiPrompt        String?        @map("ai_prompt")
  confidence      Float          @default(0.8)
  priority        Int            @default(0)
  status          RuleStatus     @default(ACTIVE)
  version         Int            @default(1)
  createdBy       String         @map("created_by")
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  // 注意：無 cityCode - 規則全局共享
  forwarder       Forwarder      @relation(fields: [forwarderId], references: [id])
  creator         User           @relation(fields: [createdBy], references: [id])
  applications    RuleApplication[]

  @@index([forwarderId])
  @@index([fieldName])
  @@index([status])
  @@map("mapping_rules")
}

// ============================================
// Forwarder - 全局共享（無 cityCode）
// ============================================
model Forwarder {
  id              String          @id @default(uuid())
  name            String          @unique
  code            String          @unique
  description     String?
  logoUrl         String?         @map("logo_url")
  defaultConfidence Float         @default(0.8) @map("default_confidence")
  status          ForwarderStatus @default(ACTIVE)
  createdBy       String          @map("created_by")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  // 注意：無 cityCode - Forwarder 全局共享
  mappingRules    MappingRule[]
  documents       Document[]
  identifierPatterns ForwarderPattern[]

  @@index([status])
  @@index([code])
  @@map("forwarders")
}

// ============================================
// Rule Cache Version - 緩存版本追蹤
// ============================================
model RuleCacheVersion {
  id          String   @id @default(uuid())
  entityType  String   @unique @map("entity_type")  // 'mapping_rules' | 'forwarders'
  version     Int      @default(1)
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("rule_cache_versions")
}

// ============================================
// Rule Application - 規則應用統計
// ============================================
model RuleApplication {
  id          String   @id @default(uuid())
  ruleId      String   @map("rule_id")
  documentId  String   @map("document_id")
  cityCode    String   @map("city_code")  // 記錄應用城市（統計用）
  success     Boolean
  confidence  Float?
  appliedAt   DateTime @default(now()) @map("applied_at")

  rule        MappingRule @relation(fields: [ruleId], references: [id])
  document    Document    @relation(fields: [documentId], references: [id])

  @@index([ruleId])
  @@index([cityCode])
  @@index([appliedAt])
  @@map("rule_applications")
}
```

### 2.2 Migration SQL

```sql
-- prisma/migrations/XXXXXX_add_rule_tracking/migration.sql

-- Rule Cache Version table
CREATE TABLE "rule_cache_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" VARCHAR(50) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_cache_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rule_cache_versions_entity_type_key" UNIQUE ("entity_type")
);

-- Insert initial versions
INSERT INTO "rule_cache_versions" ("entity_type", "version")
VALUES
    ('mapping_rules', 1),
    ('forwarders', 1);

-- Rule Application table for statistics
CREATE TABLE "rule_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "city_code" VARCHAR(10) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "confidence" DOUBLE PRECISION,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rule_applications_rule_fkey" FOREIGN KEY ("rule_id")
        REFERENCES "mapping_rules"("id") ON DELETE CASCADE,
    CONSTRAINT "rule_applications_document_fkey" FOREIGN KEY ("document_id")
        REFERENCES "documents"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_rule_applications_rule_id" ON "rule_applications"("rule_id");
CREATE INDEX "idx_rule_applications_city_code" ON "rule_applications"("city_code");
CREATE INDEX "idx_rule_applications_applied_at" ON "rule_applications"("applied_at" DESC);

-- Composite index for rule effectiveness queries
CREATE INDEX "idx_rule_applications_rule_city" ON "rule_applications"("rule_id", "city_code");
```

---

## 3. Rule Caching Service

### 3.1 Rule Resolver Service

```typescript
// src/services/rule-resolver.ts
import { prisma } from '@/lib/db-context'
import { redis } from '@/lib/redis'
import { MappingRule, ExtractionType } from '@prisma/client'

const CACHE_TTL = 5 * 60 // 5 minutes
const CACHE_PREFIX = 'rules:'

export interface CachedRule {
  id: string
  fieldName: string
  extractionType: ExtractionType
  pattern: string | null
  aiPrompt: string | null
  confidence: number
  priority: number
  version: number
}

export class RuleResolver {
  private static instance: RuleResolver

  static getInstance(): RuleResolver {
    if (!RuleResolver.instance) {
      RuleResolver.instance = new RuleResolver()
    }
    return RuleResolver.instance
  }

  /**
   * Get all active rules for a forwarder
   * Rules are globally shared - no city filtering
   */
  async getRulesForForwarder(forwarderId: string): Promise<CachedRule[]> {
    const cacheKey = `${CACHE_PREFIX}forwarder:${forwarderId}`

    // Try cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // Fetch from database
    const rules = await prisma.mappingRule.findMany({
      where: {
        forwarderId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        fieldName: true,
        extractionType: true,
        pattern: true,
        aiPrompt: true,
        confidence: true,
        priority: true,
        version: true,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Cache the result
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(rules))

    return rules
  }

  /**
   * Get the best matching rule for a specific field
   */
  async getBestRuleForField(
    forwarderId: string,
    fieldName: string
  ): Promise<CachedRule | null> {
    const rules = await this.getRulesForForwarder(forwarderId)
    return rules.find(r => r.fieldName === fieldName) || null
  }

  /**
   * Get all rules grouped by field name
   */
  async getRulesGroupedByField(
    forwarderId: string
  ): Promise<Map<string, CachedRule[]>> {
    const rules = await this.getRulesForForwarder(forwarderId)
    const grouped = new Map<string, CachedRule[]>()

    for (const rule of rules) {
      const existing = grouped.get(rule.fieldName) || []
      existing.push(rule)
      grouped.set(rule.fieldName, existing)
    }

    return grouped
  }

  /**
   * Invalidate cache for a specific forwarder
   */
  async invalidateForwarderCache(forwarderId: string): Promise<void> {
    const cacheKey = `${CACHE_PREFIX}forwarder:${forwarderId}`
    await redis.del(cacheKey)

    // Publish invalidation event for distributed systems
    await this.publishCacheInvalidation('mapping_rules', forwarderId)

    // Increment global version
    await this.incrementGlobalVersion('mapping_rules')
  }

  /**
   * Invalidate all rule caches
   */
  async invalidateAllRulesCache(): Promise<void> {
    const keys = await redis.keys(`${CACHE_PREFIX}forwarder:*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }

    await this.publishCacheInvalidation('mapping_rules')
    await this.incrementGlobalVersion('mapping_rules')
  }

  /**
   * Get current global version for client sync
   */
  async getGlobalVersion(entityType: string): Promise<number> {
    const record = await prisma.ruleCacheVersion.findUnique({
      where: { entityType },
    })
    return record?.version || 0
  }

  /**
   * Increment global version
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
   * Publish cache invalidation event
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
}

export const ruleResolver = RuleResolver.getInstance()
```

### 3.2 Forwarder Identifier Service

```typescript
// src/services/forwarder-identifier.ts
import { prisma } from '@/lib/db-context'
import { redis } from '@/lib/redis'

const CACHE_KEY = 'global:forwarders:active'
const PATTERNS_PREFIX = 'forwarder:patterns:'
const CACHE_TTL = 10 * 60 // 10 minutes

export interface ForwarderInfo {
  id: string
  name: string
  code: string
  defaultConfidence: number
}

export interface IdentificationResult {
  forwarderId: string | null
  forwarderCode: string | null
  forwarderName: string | null
  confidence: number
  matchedPatterns: string[]
}

export class ForwarderIdentifier {
  private static instance: ForwarderIdentifier

  static getInstance(): ForwarderIdentifier {
    if (!ForwarderIdentifier.instance) {
      ForwarderIdentifier.instance = new ForwarderIdentifier()
    }
    return ForwarderIdentifier.instance
  }

  /**
   * Get all active forwarders (globally shared)
   */
  async getAllActiveForwarders(): Promise<ForwarderInfo[]> {
    // Try cache first
    const cached = await redis.get(CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }

    // Fetch from database - no city filtering
    const forwarders = await prisma.forwarder.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        defaultConfidence: true,
      },
      orderBy: { name: 'asc' },
    })

    // Cache result
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(forwarders))

    return forwarders
  }

  /**
   * Identify forwarder from document content
   * Identification logic is the same for all cities
   */
  async identifyForwarder(documentContent: string): Promise<IdentificationResult> {
    const forwarders = await this.getAllActiveForwarders()

    for (const forwarder of forwarders) {
      const patterns = await this.getForwarderPatterns(forwarder.id)
      const match = this.matchPatterns(documentContent, patterns)

      if (match.isMatch && match.confidence >= forwarder.defaultConfidence) {
        return {
          forwarderId: forwarder.id,
          forwarderCode: forwarder.code,
          forwarderName: forwarder.name,
          confidence: match.confidence,
          matchedPatterns: match.matchedPatterns,
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
   * Get patterns for a forwarder
   */
  private async getForwarderPatterns(forwarderId: string): Promise<Array<{
    name: string
    type: 'text' | 'regex'
    value: string
    weight: number
  }>> {
    const cacheKey = `${PATTERNS_PREFIX}${forwarderId}`

    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    const patterns = await prisma.forwarderPattern.findMany({
      where: { forwarderId, isActive: true },
      select: {
        name: true,
        type: true,
        value: true,
        weight: true,
      },
    })

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(patterns))

    return patterns
  }

  /**
   * Match document content against patterns
   */
  private matchPatterns(
    content: string,
    patterns: Array<{ name: string; type: string; value: string; weight: number }>
  ): { isMatch: boolean; confidence: number; matchedPatterns: string[] } {
    const matchedPatterns: string[] = []
    let totalWeight = 0
    let matchedWeight = 0

    for (const pattern of patterns) {
      totalWeight += pattern.weight
      let matched = false

      if (pattern.type === 'text') {
        matched = content.toLowerCase().includes(pattern.value.toLowerCase())
      } else if (pattern.type === 'regex') {
        try {
          const regex = new RegExp(pattern.value, 'i')
          matched = regex.test(content)
        } catch {
          // Invalid regex, skip
        }
      }

      if (matched) {
        matchedPatterns.push(pattern.name)
        matchedWeight += pattern.weight
      }
    }

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0

    return {
      isMatch: confidence > 0,
      confidence,
      matchedPatterns,
    }
  }

  /**
   * Invalidate forwarder cache
   */
  async invalidateCache(): Promise<void> {
    await redis.del(CACHE_KEY)

    // Clear all pattern caches
    const patternKeys = await redis.keys(`${PATTERNS_PREFIX}*`)
    if (patternKeys.length > 0) {
      await redis.del(...patternKeys)
    }

    // Publish invalidation
    await redis.publish('rule-cache-invalidation', JSON.stringify({
      type: 'forwarders',
      timestamp: new Date().toISOString(),
    }))

    // Increment version
    await prisma.ruleCacheVersion.upsert({
      where: { entityType: 'forwarders' },
      create: { entityType: 'forwarders', version: 1 },
      update: { version: { increment: 1 } },
    })
  }
}

export const forwarderIdentifier = ForwarderIdentifier.getInstance()
```

---

## 4. Real-time Update System

### 4.1 Cache Invalidation Subscriber

```typescript
// src/lib/rule-sync.ts
import { Redis } from 'ioredis'
import { redis } from '@/lib/redis'
import { ruleResolver } from '@/services/rule-resolver'
import { forwarderIdentifier } from '@/services/forwarder-identifier'

const CHANNEL = 'rule-cache-invalidation'

interface CacheInvalidationEvent {
  type: 'mapping_rules' | 'forwarders'
  id?: string
  timestamp: string
}

export class RuleSyncSubscriber {
  private subscriber: Redis
  private isRunning: boolean = false

  constructor() {
    this.subscriber = redis.duplicate()
  }

  /**
   * Start listening for cache invalidation events
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    await this.subscriber.subscribe(CHANNEL)

    this.subscriber.on('message', async (channel, message) => {
      if (channel === CHANNEL) {
        try {
          const event: CacheInvalidationEvent = JSON.parse(message)
          await this.handleInvalidation(event)
        } catch (error) {
          console.error('Failed to handle cache invalidation:', error)
        }
      }
    })

    this.isRunning = true
    console.log('[RuleSync] Subscriber started')
  }

  /**
   * Handle cache invalidation event
   */
  private async handleInvalidation(event: CacheInvalidationEvent): Promise<void> {
    console.log(`[RuleSync] Invalidation received: ${event.type}`, event.id || 'all')

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
  }

  /**
   * Stop the subscriber
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    await this.subscriber.unsubscribe(CHANNEL)
    await this.subscriber.quit()
    this.isRunning = false
    console.log('[RuleSync] Subscriber stopped')
  }
}

// Singleton instance
let subscriberInstance: RuleSyncSubscriber | null = null

export function getRuleSyncSubscriber(): RuleSyncSubscriber {
  if (!subscriberInstance) {
    subscriberInstance = new RuleSyncSubscriber()
  }
  return subscriberInstance
}
```

### 4.2 WebSocket Notification (Optional)

```typescript
// src/lib/rule-notifications.ts
import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { ruleResolver } from '@/services/rule-resolver'

let io: SocketIOServer | null = null

export function initializeRuleNotifications(server: HTTPServer): void {
  io = new SocketIOServer(server, {
    path: '/api/socket/rules',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log('[RuleNotifications] Client connected:', socket.id)

    // Send current version on connect
    socket.on('get-version', async (callback) => {
      const [rulesVersion, forwardersVersion] = await Promise.all([
        ruleResolver.getGlobalVersion('mapping_rules'),
        ruleResolver.getGlobalVersion('forwarders'),
      ])

      callback({
        mappingRules: rulesVersion,
        forwarders: forwardersVersion,
      })
    })

    socket.on('disconnect', () => {
      console.log('[RuleNotifications] Client disconnected:', socket.id)
    })
  })
}

/**
 * Broadcast rule update to all connected clients
 */
export function broadcastRuleUpdate(type: string, data?: unknown): void {
  if (io) {
    io.emit('rule-update', { type, data, timestamp: new Date().toISOString() })
  }
}
```

### 4.3 Client-side Version Hook

```typescript
// src/hooks/useRuleVersion.ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface RuleVersions {
  mappingRules: number
  forwarders: number
}

export function useRuleVersion() {
  const queryClient = useQueryClient()
  const [localVersions, setLocalVersions] = useState<RuleVersions>({
    mappingRules: 0,
    forwarders: 0,
  })

  // Poll server version periodically
  const { data: serverVersions } = useQuery({
    queryKey: ['rule-versions'],
    queryFn: async (): Promise<RuleVersions> => {
      const response = await fetch('/api/rules/version')
      if (!response.ok) throw new Error('Failed to fetch version')
      const data = await response.json()
      return data.data
    },
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 10000,
  })

  // Check for version changes
  useEffect(() => {
    if (!serverVersions) return

    const hasRulesUpdate = serverVersions.mappingRules > localVersions.mappingRules
    const hasForwardersUpdate = serverVersions.forwarders > localVersions.forwarders

    if (hasRulesUpdate) {
      console.log('[RuleVersion] Rules updated, invalidating queries')
      queryClient.invalidateQueries({ queryKey: ['rules'] })
      queryClient.invalidateQueries({ queryKey: ['forwarder-rules'] })
    }

    if (hasForwardersUpdate) {
      console.log('[RuleVersion] Forwarders updated, invalidating queries')
      queryClient.invalidateQueries({ queryKey: ['forwarders'] })
    }

    if (hasRulesUpdate || hasForwardersUpdate) {
      setLocalVersions(serverVersions)
    }
  }, [serverVersions, localVersions, queryClient])

  // Manual refresh function
  const refreshRules = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['rules'] })
    await queryClient.invalidateQueries({ queryKey: ['forwarders'] })
    await queryClient.invalidateQueries({ queryKey: ['rule-versions'] })
  }, [queryClient])

  return {
    versions: localVersions,
    serverVersions,
    isOutdated: serverVersions && (
      serverVersions.mappingRules > localVersions.mappingRules ||
      serverVersions.forwarders > localVersions.forwarders
    ),
    refreshRules,
  }
}
```

---

## 5. Rule Application Statistics

### 5.1 Rule Metrics Service

```typescript
// src/services/rule-metrics.ts
import { prisma } from '@/lib/db-context'
import { redis } from '@/lib/redis'

const STATS_PREFIX = 'rule:stats:'
const STATS_TTL = 60 * 60 // 1 hour

export class RuleMetricsService {
  /**
   * Record a rule application
   */
  static async recordApplication(params: {
    ruleId: string
    documentId: string
    cityCode: string
    success: boolean
    confidence?: number
  }): Promise<void> {
    const { ruleId, documentId, cityCode, success, confidence } = params

    // Store in database
    await prisma.ruleApplication.create({
      data: {
        ruleId,
        documentId,
        cityCode,
        success,
        confidence,
      },
    })

    // Update Redis counters for real-time stats
    const dayKey = new Date().toISOString().split('T')[0]
    const statsKey = `${STATS_PREFIX}${ruleId}:${dayKey}`

    await redis.multi()
      .hincrby(statsKey, `${cityCode}:total`, 1)
      .hincrby(statsKey, `${cityCode}:${success ? 'success' : 'fail'}`, 1)
      .hincrby(statsKey, 'total', 1)
      .hincrby(statsKey, success ? 'success' : 'fail', 1)
      .expire(statsKey, 7 * 24 * 60 * 60) // Keep for 7 days
      .exec()
  }

  /**
   * Get rule effectiveness by city
   */
  static async getRuleEffectiveness(ruleId: string): Promise<{
    overall: { total: number; successRate: number }
    byCity: Array<{
      cityCode: string
      cityName: string
      total: number
      successRate: number
    }>
  }> {
    // Aggregate from database
    const stats = await prisma.ruleApplication.groupBy({
      by: ['cityCode'],
      where: { ruleId },
      _count: { id: true },
      _avg: { confidence: true },
    })

    const successStats = await prisma.ruleApplication.groupBy({
      by: ['cityCode'],
      where: { ruleId, success: true },
      _count: { id: true },
    })

    const successMap = new Map(
      successStats.map(s => [s.cityCode, s._count.id])
    )

    // Get city names
    const cityCodes = stats.map(s => s.cityCode)
    const cities = await prisma.city.findMany({
      where: { code: { in: cityCodes } },
      select: { code: true, name: true },
    })
    const cityNameMap = new Map(cities.map(c => [c.code, c.name]))

    const byCity = stats.map(s => ({
      cityCode: s.cityCode,
      cityName: cityNameMap.get(s.cityCode) || s.cityCode,
      total: s._count.id,
      successRate: (successMap.get(s.cityCode) || 0) / s._count.id,
    }))

    const overallTotal = stats.reduce((sum, s) => sum + s._count.id, 0)
    const overallSuccess = successStats.reduce((sum, s) => sum + s._count.id, 0)

    return {
      overall: {
        total: overallTotal,
        successRate: overallTotal > 0 ? overallSuccess / overallTotal : 0,
      },
      byCity: byCity.sort((a, b) => b.total - a.total),
    }
  }

  /**
   * Get city-specific rule usage distribution
   */
  static async getCityRuleUsage(cityCode: string): Promise<Array<{
    ruleId: string
    fieldName: string
    forwarderName: string
    total: number
    successRate: number
  }>> {
    const applications = await prisma.ruleApplication.groupBy({
      by: ['ruleId'],
      where: { cityCode },
      _count: { id: true },
    })

    const ruleIds = applications.map(a => a.ruleId)

    const [rules, successCounts] = await Promise.all([
      prisma.mappingRule.findMany({
        where: { id: { in: ruleIds } },
        include: {
          forwarder: { select: { name: true } },
        },
      }),
      prisma.ruleApplication.groupBy({
        by: ['ruleId'],
        where: { cityCode, success: true },
        _count: { id: true },
      }),
    ])

    const ruleMap = new Map(rules.map(r => [r.id, r]))
    const successMap = new Map(successCounts.map(s => [s.ruleId, s._count.id]))

    return applications.map(a => {
      const rule = ruleMap.get(a.ruleId)
      return {
        ruleId: a.ruleId,
        fieldName: rule?.fieldName || 'Unknown',
        forwarderName: rule?.forwarder.name || 'Unknown',
        total: a._count.id,
        successRate: (successMap.get(a.ruleId) || 0) / a._count.id,
      }
    }).sort((a, b) => b.total - a.total)
  }

  /**
   * Generate rule effectiveness report
   */
  static async generateEffectivenessReport(options: {
    forwarderId?: string
    dateFrom?: Date
    dateTo?: Date
  }): Promise<{
    summary: {
      totalRules: number
      totalApplications: number
      overallSuccessRate: number
      citiesUsed: number
    }
    topPerforming: Array<{
      ruleId: string
      fieldName: string
      successRate: number
      applications: number
    }>
    needsImprovement: Array<{
      ruleId: string
      fieldName: string
      successRate: number
      applications: number
    }>
    cityDistribution: Array<{
      cityCode: string
      cityName: string
      percentage: number
    }>
  }> {
    const { forwarderId, dateFrom, dateTo } = options

    const where: any = {}
    if (forwarderId) {
      where.rule = { forwarderId }
    }
    if (dateFrom || dateTo) {
      where.appliedAt = {}
      if (dateFrom) where.appliedAt.gte = dateFrom
      if (dateTo) where.appliedAt.lte = dateTo
    }

    // Get all applications
    const [totalApps, successApps, uniqueRules, cityDist] = await Promise.all([
      prisma.ruleApplication.count({ where }),
      prisma.ruleApplication.count({ where: { ...where, success: true } }),
      prisma.ruleApplication.groupBy({
        by: ['ruleId'],
        where,
        _count: { id: true },
      }),
      prisma.ruleApplication.groupBy({
        by: ['cityCode'],
        where,
        _count: { id: true },
      }),
    ])

    // Get rule details for top/bottom performers
    const ruleStats = await prisma.$queryRaw<Array<{
      rule_id: string
      field_name: string
      total: bigint
      success_count: bigint
    }>>`
      SELECT
        ra.rule_id,
        mr.field_name,
        COUNT(*) as total,
        SUM(CASE WHEN ra.success THEN 1 ELSE 0 END) as success_count
      FROM rule_applications ra
      JOIN mapping_rules mr ON ra.rule_id = mr.id
      ${forwarderId ? prisma.$queryRaw`WHERE mr.forwarder_id = ${forwarderId}` : prisma.$queryRaw``}
      GROUP BY ra.rule_id, mr.field_name
      HAVING COUNT(*) >= 10
    `

    const rulesWithRates = ruleStats.map(r => ({
      ruleId: r.rule_id,
      fieldName: r.field_name,
      applications: Number(r.total),
      successRate: Number(r.success_count) / Number(r.total),
    }))

    const sorted = [...rulesWithRates].sort((a, b) => b.successRate - a.successRate)

    // Get city names
    const cityNames = await prisma.city.findMany({
      where: { code: { in: cityDist.map(c => c.cityCode) } },
      select: { code: true, name: true },
    })
    const cityNameMap = new Map(cityNames.map(c => [c.code, c.name]))

    return {
      summary: {
        totalRules: uniqueRules.length,
        totalApplications: totalApps,
        overallSuccessRate: totalApps > 0 ? successApps / totalApps : 0,
        citiesUsed: cityDist.length,
      },
      topPerforming: sorted.slice(0, 5),
      needsImprovement: sorted.slice(-5).reverse(),
      cityDistribution: cityDist.map(c => ({
        cityCode: c.cityCode,
        cityName: cityNameMap.get(c.cityCode) || c.cityCode,
        percentage: totalApps > 0 ? c._count.id / totalApps : 0,
      })).sort((a, b) => b.percentage - a.percentage),
    }
  }
}
```

---

## 6. API Endpoints

### 6.1 Rule Version API

```typescript
// src/app/api/rules/version/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ruleResolver } from '@/services/rule-resolver'

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { type: 'UNAUTHORIZED', title: 'Authentication required' },
      { status: 401 }
    )
  }

  const [mappingRulesVersion, forwardersVersion] = await Promise.all([
    ruleResolver.getGlobalVersion('mapping_rules'),
    ruleResolver.getGlobalVersion('forwarders'),
  ])

  return NextResponse.json({
    success: true,
    data: {
      mappingRules: mappingRulesVersion,
      forwarders: forwardersVersion,
    },
  })
}
```

### 6.2 Rule Update Hook (Trigger Cache Invalidation)

```typescript
// src/app/api/rules/[id]/route.ts - Updated
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db-context'
import { ruleResolver } from '@/services/rule-resolver'
import { broadcastRuleUpdate } from '@/lib/rule-notifications'
import { z } from 'zod'

const updateSchema = z.object({
  pattern: z.string().optional(),
  aiPrompt: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  priority: z.number().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DEPRECATED']).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { type: 'UNAUTHORIZED', title: 'Authentication required' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const validation = updateSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      {
        type: 'VALIDATION_ERROR',
        title: 'Invalid request',
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  // Get current rule
  const currentRule = await prisma.mappingRule.findUnique({
    where: { id: params.id },
    select: { forwarderId: true },
  })

  if (!currentRule) {
    return NextResponse.json(
      { type: 'NOT_FOUND', title: 'Rule not found' },
      { status: 404 }
    )
  }

  // Update rule with version increment
  const updatedRule = await prisma.mappingRule.update({
    where: { id: params.id },
    data: {
      ...validation.data,
      version: { increment: 1 },
    },
    include: {
      forwarder: { select: { name: true, code: true } },
    },
  })

  // IMPORTANT: Invalidate cache - this affects ALL cities
  await ruleResolver.invalidateForwarderCache(currentRule.forwarderId)

  // Broadcast update to connected clients
  broadcastRuleUpdate('rule-updated', {
    ruleId: params.id,
    forwarderId: currentRule.forwarderId,
    version: updatedRule.version,
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      entityType: 'MappingRule',
      entityId: params.id,
      action: 'UPDATE',
      performedBy: session.user.id,
      changes: validation.data,
    },
  })

  return NextResponse.json({
    success: true,
    data: updatedRule,
    message: 'Rule updated and cache invalidated for all cities',
  })
}
```

### 6.3 Rule Metrics API

```typescript
// src/app/api/rules/[id]/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { RuleMetricsService } from '@/services/rule-metrics'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { type: 'UNAUTHORIZED', title: 'Authentication required' },
      { status: 401 }
    )
  }

  const effectiveness = await RuleMetricsService.getRuleEffectiveness(params.id)

  return NextResponse.json({
    success: true,
    data: effectiveness,
  })
}
```

---

## 7. Monitoring and Alerting

### 7.1 Rule Sync Monitor

```typescript
// src/lib/monitoring/rule-sync-monitor.ts
import { prisma } from '@/lib/db-context'
import { redis } from '@/lib/redis'
import { metrics } from '@/lib/monitoring'

export class RuleSyncMonitor {
  private checkInterval: NodeJS.Timer | null = null

  /**
   * Start monitoring rule sync status
   */
  start(intervalMs: number = 60000): void {
    this.checkInterval = setInterval(() => this.checkSyncStatus(), intervalMs)
    console.log('[RuleSyncMonitor] Started')
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      console.log('[RuleSyncMonitor] Stopped')
    }
  }

  /**
   * Check sync status and report metrics
   */
  private async checkSyncStatus(): Promise<void> {
    try {
      // Check cache version vs database
      const [dbRulesVersion, cacheRulesVersion] = await Promise.all([
        prisma.ruleCacheVersion.findUnique({
          where: { entityType: 'mapping_rules' },
        }),
        redis.get('rules:version'),
      ])

      const dbVersion = dbRulesVersion?.version || 0
      const cacheVersion = cacheRulesVersion ? parseInt(cacheRulesVersion) : 0

      // Report metrics
      metrics.gauge('rule_sync.db_version', dbVersion)
      metrics.gauge('rule_sync.cache_version', cacheVersion)
      metrics.gauge('rule_sync.version_diff', dbVersion - cacheVersion)

      // Alert if versions are out of sync
      if (Math.abs(dbVersion - cacheVersion) > 5) {
        console.warn('[RuleSyncMonitor] Version mismatch detected:', {
          dbVersion,
          cacheVersion,
          diff: dbVersion - cacheVersion,
        })

        metrics.increment('rule_sync.alerts', { type: 'version_mismatch' })
      }

      // Check cache hit rate
      const [hits, misses] = await Promise.all([
        redis.get('rules:cache:hits'),
        redis.get('rules:cache:misses'),
      ])

      const totalRequests = (parseInt(hits || '0') + parseInt(misses || '0'))
      const hitRate = totalRequests > 0 ? parseInt(hits || '0') / totalRequests : 0

      metrics.gauge('rule_sync.cache_hit_rate', hitRate)

      // Alert on low hit rate
      if (totalRequests > 100 && hitRate < 0.8) {
        console.warn('[RuleSyncMonitor] Low cache hit rate:', hitRate)
        metrics.increment('rule_sync.alerts', { type: 'low_hit_rate' })
      }

    } catch (error) {
      console.error('[RuleSyncMonitor] Check failed:', error)
      metrics.increment('rule_sync.errors')
    }
  }
}

// Export singleton
export const ruleSyncMonitor = new RuleSyncMonitor()
```

---

## 8. Testing Strategy

### 8.1 Rule Sharing Tests

```typescript
// __tests__/services/rule-resolver.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ruleResolver } from '@/services/rule-resolver'
import { prisma } from '@/lib/db-context'
import { redis } from '@/lib/redis'

describe('RuleResolver', () => {
  beforeEach(async () => {
    // Clear cache
    const keys = await redis.keys('rules:*')
    if (keys.length > 0) await redis.del(...keys)
  })

  describe('getRulesForForwarder', () => {
    it('should return globally shared rules', async () => {
      // Create test forwarder and rules
      const forwarder = await prisma.forwarder.create({
        data: {
          name: 'Test Forwarder',
          code: 'TEST',
          createdBy: 'test-user',
        },
      })

      await prisma.mappingRule.createMany({
        data: [
          { forwarderId: forwarder.id, fieldName: 'invoiceNumber', extractionType: 'REGEX', createdBy: 'test-user' },
          { forwarderId: forwarder.id, fieldName: 'totalAmount', extractionType: 'AI_ASSISTED', createdBy: 'test-user' },
        ],
      })

      const rules = await ruleResolver.getRulesForForwarder(forwarder.id)

      expect(rules).toHaveLength(2)
      expect(rules.every(r => r.fieldName)).toBe(true)
    })

    it('should cache rules on first access', async () => {
      const forwarder = await prisma.forwarder.findFirst()

      // First call - should hit database
      await ruleResolver.getRulesForForwarder(forwarder!.id)

      // Check cache exists
      const cached = await redis.get(`rules:forwarder:${forwarder!.id}`)
      expect(cached).not.toBeNull()

      // Second call should use cache
      const start = Date.now()
      await ruleResolver.getRulesForForwarder(forwarder!.id)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10) // Cache should be fast
    })

    it('should invalidate cache on rule update', async () => {
      const forwarder = await prisma.forwarder.findFirst()

      // Populate cache
      await ruleResolver.getRulesForForwarder(forwarder!.id)

      // Invalidate
      await ruleResolver.invalidateForwarderCache(forwarder!.id)

      // Check cache is cleared
      const cached = await redis.get(`rules:forwarder:${forwarder!.id}`)
      expect(cached).toBeNull()
    })
  })

  describe('version tracking', () => {
    it('should increment version on cache invalidation', async () => {
      const initialVersion = await ruleResolver.getGlobalVersion('mapping_rules')

      await ruleResolver.invalidateAllRulesCache()

      const newVersion = await ruleResolver.getGlobalVersion('mapping_rules')
      expect(newVersion).toBe(initialVersion + 1)
    })
  })
})
```

---

## 9. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | 規則全局應用 | No cityCode in MappingRule/Forwarder models | Rules apply to all cities |
| AC2 | 規則使用一致性 | RuleResolver with version tracking | Same version across cities |
| AC3 | 即時規則更新 | Redis pub/sub, cache invalidation | Rules update immediately |
| AC4 | Forwarder 全局共享 | ForwarderIdentifier service | Same identification logic everywhere |

---

## 10. Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    Global Rule Sharing                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   City A    │    │   City B    │    │   City C    │         │
│  │ (Document)  │    │ (Document)  │    │ (Document)  │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                            ▼                                    │
│              ┌─────────────────────────┐                       │
│              │     RuleResolver        │                       │
│              │  (Global Rule Cache)    │                       │
│              └───────────┬─────────────┘                       │
│                          │                                      │
│         ┌────────────────┼────────────────┐                    │
│         ▼                ▼                ▼                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Redis Cache │  │ PostgreSQL  │  │ Version     │            │
│  │ (5 min TTL) │  │ (Rules DB)  │  │ Tracking    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │               Cache Invalidation                     │      │
│  │  Rule Update → Invalidate → Pub/Sub → All Instances  │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. References

- Story 6.5 Requirements
- Story 4.1 Tech Spec (Mapping Rules)
- Story 5.1 Tech Spec (Forwarder Management)
- Redis Pub/Sub Documentation
