/**
 * @fileoverview 映射快取服務
 * @description
 *   提供映射配置的快取功能，減少資料庫查詢次數。
 *   支援 TTL（Time To Live）和範圍級別的快取失效。
 *
 * @module src/services/mapping/mapping-cache
 * @since Epic 13 - Story 13.5
 * @lastModified 2026-01-02
 *
 * @features
 *   - 記憶體內快取（In-Memory Cache）
 *   - TTL 自動過期機制
 *   - 範圍級別快取失效（GLOBAL/COMPANY/FORMAT）
 *   - 快取統計和監控
 *
 * @dependencies
 *   - @/types/field-mapping - 類型定義
 */

import type {
  IMappingCache,
  CacheKey,
  CachedConfig,
  ResolvedConfig,
  ConfigScope,
} from '@/types/field-mapping';

// ============================================================================
// 常數定義
// ============================================================================

/**
 * 預設 TTL（5 分鐘）
 */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * 最大快取項目數
 */
const MAX_CACHE_SIZE = 1000;

/**
 * 清理檢查間隔（1 分鐘）
 */
const CLEANUP_INTERVAL_MS = 60 * 1000;

// ============================================================================
// MappingCache 實現
// ============================================================================

/**
 * 映射快取服務
 * @description 提供映射配置的記憶體內快取
 */
export class MappingCache implements IMappingCache {
  private readonly cache: Map<string, CachedConfig>;
  private readonly defaultTtlMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats: CacheStats;

  constructor(options?: { defaultTtlMs?: number }) {
    this.cache = new Map();
    this.defaultTtlMs = options?.defaultTtlMs ?? DEFAULT_TTL_MS;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
    };

    // 啟動定期清理
    this.startCleanup();
  }

  // ==========================================================================
  // IMappingCache 實現
  // ==========================================================================

  /**
   * 獲取快取的配置
   * @param key 快取鍵
   * @returns 快取的配置（如存在且未過期）
   */
  get(key: CacheKey): CachedConfig | null {
    const cacheKey = this.serializeKey(key);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    // 檢查是否過期
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(cacheKey);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateSize();
      return null;
    }

    this.stats.hits++;
    return cached;
  }

  /**
   * 設定快取
   * @param key 快取鍵
   * @param config 配置
   * @param ttlMs TTL（毫秒），預設 5 分鐘
   */
  set(key: CacheKey, config: ResolvedConfig, ttlMs?: number): void {
    // 檢查快取大小限制
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const cacheKey = this.serializeKey(key);
    const now = Date.now();
    const effectiveTtl = ttlMs ?? this.defaultTtlMs;

    const cached: CachedConfig = {
      config,
      cachedAt: now,
      expiresAt: now + effectiveTtl,
    };

    this.cache.set(cacheKey, cached);
    this.updateSize();
  }

  /**
   * 刪除快取
   * @param key 快取鍵
   */
  delete(key: CacheKey): void {
    const cacheKey = this.serializeKey(key);
    this.cache.delete(cacheKey);
    this.updateSize();
  }

  /**
   * 清空所有快取
   */
  clear(): void {
    this.cache.clear();
    this.stats.evictions += this.stats.size;
    this.updateSize();
  }

  /**
   * 使特定範圍的快取失效
   * @param scope 配置範圍
   * @param id 相關 ID（companyId 或 documentFormatId）
   */
  invalidate(scope: ConfigScope, id?: string): void {
    const keysToDelete: string[] = [];

    for (const [cacheKey, cached] of this.cache.entries()) {
      const config = cached.config;

      // 檢查是否匹配
      if (config.scope !== scope) {
        continue;
      }

      // 如果提供了 ID，檢查是否匹配
      if (id) {
        if (scope === 'COMPANY' && config.companyId !== id) {
          continue;
        }
        if (scope === 'FORMAT' && config.documentFormatId !== id) {
          continue;
        }
      }

      keysToDelete.push(cacheKey);
    }

    // 刪除匹配的快取項目
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.stats.evictions++;
    }

    this.updateSize();
  }

  // ==========================================================================
  // 擴展方法
  // ==========================================================================

  /**
   * 獲取快取統計
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重設統計
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: this.cache.size,
    };
  }

  /**
   * 獲取快取命中率
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) {
      return 0;
    }
    return this.stats.hits / total;
  }

  /**
   * 停止快取服務
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 序列化快取鍵
   */
  private serializeKey(key: CacheKey): string {
    const parts: string[] = [key.type, key.scope];

    if (key.companyId) {
      parts.push(`company:${key.companyId}`);
    }
    if (key.documentFormatId) {
      parts.push(`format:${key.documentFormatId}`);
    }

    return parts.join(':');
  }

  /**
   * 更新快取大小統計
   */
  private updateSize(): void {
    this.stats.size = this.cache.size;
  }

  /**
   * 驅逐最舊的項目
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.cachedAt < oldestTime) {
        oldestTime = cached.cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.updateSize();
    }
  }

  /**
   * 清理過期項目
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.stats.evictions++;
    }

    if (keysToDelete.length > 0) {
      this.updateSize();
    }
  }

  /**
   * 啟動定期清理
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    // 確保在 Node.js 環境中不阻止進程退出
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 快取統計
 */
export interface CacheStats {
  /** 命中次數 */
  hits: number;
  /** 未命中次數 */
  misses: number;
  /** 驅逐次數 */
  evictions: number;
  /** 當前大小 */
  size: number;
}

// ============================================================================
// 導出
// ============================================================================

/**
 * MappingCache 單例實例
 */
export const mappingCache = new MappingCache();
