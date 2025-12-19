/**
 * @fileoverview 全域規則解析服務 - 規則快取與版本管理
 * @description
 *   提供全域規則共享機制的核心功能：
 *   - 規則快取管理（記憶體快取）
 *   - 版本追蹤與同步
 *   - 快取失效通知
 *
 *   ## 架構概覽
 *
 *   ```
 *   所有城市共用相同規則
 *         ↓
 *   ┌─────────────────┐
 *   │  RuleResolver   │
 *   │  (Singleton)    │
 *   └────────┬────────┘
 *            │
 *   ┌────────┴────────┐
 *   │                 │
 *   ▼                 ▼
 *   Memory Cache   PostgreSQL
 *   (5 min TTL)   (RuleCacheVersion)
 *   ```
 *
 * @module src/services/rule-resolver
 * @author Development Team
 * @since Epic 6 - Story 6.5 (Global Rule Sharing)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 全域規則快取（無城市區分）
 *   - 版本追蹤（RuleCacheVersion）
 *   - 快取失效機制
 *   - Singleton 模式
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *
 * @related
 *   - src/services/forwarder-identifier.ts - Forwarder 識別服務
 *   - src/services/rule-metrics.ts - 規則統計服務
 *   - prisma/schema.prisma - RuleCacheVersion 模型
 */

import { prisma } from '@/lib/prisma';
import type { RuleStatus } from '@prisma/client';

// ============================================================
// Constants
// ============================================================

/** 快取 TTL（毫秒）- 5 分鐘 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 支援的實體類型 */
export const ENTITY_TYPES = {
  MAPPING_RULES: 'mapping_rules',
  FORWARDERS: 'forwarders',
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

// ============================================================
// Types
// ============================================================

/**
 * 快取規則結構
 */
export interface CachedRule {
  /** 規則 ID */
  id: string;
  /** 欄位名稱 */
  fieldName: string;
  /** 欄位標籤 */
  fieldLabel: string;
  /** 提取模式 (JSON) */
  extractionPattern: unknown;
  /** 優先級 */
  priority: number;
  /** 信心度閾值 */
  confidence: number;
  /** 規則版本 */
  version: number;
  /** 規則狀態 */
  status: RuleStatus;
  /** 是否必填 */
  isRequired: boolean;
  /** 是否啟用 */
  isActive: boolean;
  /** 分類 */
  category: string | null;
}

/**
 * 快取項目
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * 快取失效事件
 */
export interface CacheInvalidationEvent {
  /** 實體類型 */
  type: EntityType;
  /** 實體 ID（可選，如 forwarderId） */
  id?: string;
  /** 時間戳 */
  timestamp: string;
}

// ============================================================
// Rule Resolver Service
// ============================================================

/**
 * 全域規則解析器
 *
 * @description
 *   單例模式，提供規則快取和版本追蹤功能。
 *   規則是全域共享的，所有城市使用相同的規則。
 *
 * @example
 *   const resolver = RuleResolver.getInstance();
 *   const rules = await resolver.getRulesForForwarder(forwarderId);
 */
export class RuleResolver {
  private static instance: RuleResolver | null = null;

  /** 規則快取 (forwarderId -> CachedRule[]) */
  private ruleCache: Map<string, CacheEntry<CachedRule[]>> = new Map();

  /** 快取失效回調 */
  private invalidationCallbacks: Array<(event: CacheInvalidationEvent) => void> =
    [];

  /**
   * 私有建構函數（單例模式）
   */
  private constructor() {
    // 定期清理過期快取
    setInterval(() => this.cleanExpiredCache(), 60000);
  }

  /**
   * 取得 RuleResolver 單例
   */
  static getInstance(): RuleResolver {
    if (!RuleResolver.instance) {
      RuleResolver.instance = new RuleResolver();
    }
    return RuleResolver.instance;
  }

  /**
   * 重置單例（僅用於測試）
   */
  static resetInstance(): void {
    RuleResolver.instance = null;
  }

  // ============================================================
  // Rule Fetching
  // ============================================================

  /**
   * 取得指定 Forwarder 的所有啟用規則
   *
   * @description
   *   規則是全域共享的，無城市過濾。
   *   首先檢查快取，如果快取過期則從資料庫取得。
   *
   * @param forwarderId - Forwarder ID
   * @returns 快取的規則列表
   */
  async getRulesForForwarder(forwarderId: string): Promise<CachedRule[]> {
    const cacheKey = forwarderId;
    const now = Date.now();

    // 檢查快取
    const cached = this.ruleCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    // 從資料庫取得規則
    const rules = await prisma.mappingRule.findMany({
      where: {
        forwarderId,
        status: 'ACTIVE',
        isActive: true,
      },
      select: {
        id: true,
        fieldName: true,
        fieldLabel: true,
        extractionPattern: true,
        priority: true,
        confidence: true,
        version: true,
        status: true,
        isRequired: true,
        isActive: true,
        category: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const cachedRules: CachedRule[] = rules.map((rule) => ({
      id: rule.id,
      fieldName: rule.fieldName,
      fieldLabel: rule.fieldLabel,
      extractionPattern: rule.extractionPattern,
      priority: rule.priority,
      confidence: rule.confidence,
      version: rule.version,
      status: rule.status,
      isRequired: rule.isRequired,
      isActive: rule.isActive,
      category: rule.category,
    }));

    // 更新快取
    this.ruleCache.set(cacheKey, {
      data: cachedRules,
      expiresAt: now + CACHE_TTL_MS,
    });

    return cachedRules;
  }

  /**
   * 取得指定欄位的最佳匹配規則
   *
   * @param forwarderId - Forwarder ID
   * @param fieldName - 欄位名稱
   * @returns 最佳匹配規則或 null
   */
  async getBestRuleForField(
    forwarderId: string,
    fieldName: string
  ): Promise<CachedRule | null> {
    const rules = await this.getRulesForForwarder(forwarderId);
    return rules.find((r) => r.fieldName === fieldName) || null;
  }

  /**
   * 取得按欄位名稱分組的規則
   *
   * @param forwarderId - Forwarder ID
   * @returns 按欄位名稱分組的規則
   */
  async getRulesGroupedByField(
    forwarderId: string
  ): Promise<Map<string, CachedRule[]>> {
    const rules = await this.getRulesForForwarder(forwarderId);
    const grouped = new Map<string, CachedRule[]>();

    for (const rule of rules) {
      const existing = grouped.get(rule.fieldName) || [];
      existing.push(rule);
      grouped.set(rule.fieldName, existing);
    }

    return grouped;
  }

  /**
   * 取得所有通用規則（forwarderId = null）
   *
   * @returns 通用規則列表
   */
  async getUniversalRules(): Promise<CachedRule[]> {
    const cacheKey = '__universal__';
    const now = Date.now();

    const cached = this.ruleCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const rules = await prisma.mappingRule.findMany({
      where: {
        forwarderId: null,
        status: 'ACTIVE',
        isActive: true,
      },
      select: {
        id: true,
        fieldName: true,
        fieldLabel: true,
        extractionPattern: true,
        priority: true,
        confidence: true,
        version: true,
        status: true,
        isRequired: true,
        isActive: true,
        category: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const cachedRules: CachedRule[] = rules.map((rule) => ({
      id: rule.id,
      fieldName: rule.fieldName,
      fieldLabel: rule.fieldLabel,
      extractionPattern: rule.extractionPattern,
      priority: rule.priority,
      confidence: rule.confidence,
      version: rule.version,
      status: rule.status,
      isRequired: rule.isRequired,
      isActive: rule.isActive,
      category: rule.category,
    }));

    this.ruleCache.set(cacheKey, {
      data: cachedRules,
      expiresAt: now + CACHE_TTL_MS,
    });

    return cachedRules;
  }

  // ============================================================
  // Cache Invalidation
  // ============================================================

  /**
   * 失效指定 Forwarder 的規則快取
   *
   * @description
   *   當規則更新時，必須失效快取，確保所有城市取得最新規則。
   *
   * @param forwarderId - Forwarder ID
   */
  async invalidateForwarderCache(forwarderId: string): Promise<void> {
    this.ruleCache.delete(forwarderId);

    // 發布失效事件
    await this.publishCacheInvalidation(ENTITY_TYPES.MAPPING_RULES, forwarderId);

    // 遞增全域版本
    await this.incrementGlobalVersion(ENTITY_TYPES.MAPPING_RULES);
  }

  /**
   * 失效所有規則快取
   */
  async invalidateAllRulesCache(): Promise<void> {
    this.ruleCache.clear();

    await this.publishCacheInvalidation(ENTITY_TYPES.MAPPING_RULES);
    await this.incrementGlobalVersion(ENTITY_TYPES.MAPPING_RULES);
  }

  /**
   * 失效通用規則快取
   */
  async invalidateUniversalRulesCache(): Promise<void> {
    this.ruleCache.delete('__universal__');

    await this.publishCacheInvalidation(ENTITY_TYPES.MAPPING_RULES, '__universal__');
    await this.incrementGlobalVersion(ENTITY_TYPES.MAPPING_RULES);
  }

  // ============================================================
  // Version Tracking
  // ============================================================

  /**
   * 取得全域版本號
   *
   * @param entityType - 實體類型
   * @returns 當前版本號
   */
  async getGlobalVersion(entityType: EntityType): Promise<number> {
    const record = await prisma.ruleCacheVersion.findUnique({
      where: { entityType },
    });
    return record?.version ?? 0;
  }

  /**
   * 遞增全域版本號
   *
   * @param entityType - 實體類型
   * @returns 新版本號
   */
  private async incrementGlobalVersion(entityType: EntityType): Promise<number> {
    const result = await prisma.ruleCacheVersion.upsert({
      where: { entityType },
      create: { entityType, version: 1 },
      update: { version: { increment: 1 } },
    });
    return result.version;
  }

  /**
   * 取得所有實體類型的版本
   *
   * @returns 版本資訊
   */
  async getAllVersions(): Promise<{
    mappingRules: number;
    forwarders: number;
  }> {
    const [mappingRulesVersion, forwardersVersion] = await Promise.all([
      this.getGlobalVersion(ENTITY_TYPES.MAPPING_RULES),
      this.getGlobalVersion(ENTITY_TYPES.FORWARDERS),
    ]);

    return {
      mappingRules: mappingRulesVersion,
      forwarders: forwardersVersion,
    };
  }

  // ============================================================
  // Event Handling
  // ============================================================

  /**
   * 發布快取失效事件
   *
   * @param entityType - 實體類型
   * @param entityId - 實體 ID（可選）
   */
  private async publishCacheInvalidation(
    entityType: EntityType,
    entityId?: string
  ): Promise<void> {
    const event: CacheInvalidationEvent = {
      type: entityType,
      id: entityId,
      timestamp: new Date().toISOString(),
    };

    // 通知所有註冊的回調
    for (const callback of this.invalidationCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[RuleResolver] Invalidation callback error:', error);
      }
    }
  }

  /**
   * 註冊快取失效回調
   *
   * @param callback - 回調函數
   * @returns 取消註冊函數
   */
  onCacheInvalidation(
    callback: (event: CacheInvalidationEvent) => void
  ): () => void {
    this.invalidationCallbacks.push(callback);
    return () => {
      const index = this.invalidationCallbacks.indexOf(callback);
      if (index > -1) {
        this.invalidationCallbacks.splice(index, 1);
      }
    };
  }

  // ============================================================
  // Cache Management
  // ============================================================

  /**
   * 清理過期快取
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.ruleCache.entries()) {
      if (entry.expiresAt <= now) {
        this.ruleCache.delete(key);
      }
    }
  }

  /**
   * 取得快取統計
   *
   * @returns 快取統計資訊
   */
  getCacheStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.ruleCache.size,
      keys: Array.from(this.ruleCache.keys()),
    };
  }

  /**
   * 強制清除所有快取（不發布事件）
   */
  clearCache(): void {
    this.ruleCache.clear();
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * RuleResolver 單例實例
 */
export const ruleResolver = RuleResolver.getInstance();
