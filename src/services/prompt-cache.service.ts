/**
 * @fileoverview Prompt 解析結果快取服務
 * @description
 *   提供 In-Memory 快取機制，避免重複查詢和計算。
 *   支援 TTL（Time-To-Live）自動過期和模式失效。
 *
 * @module src/services/prompt-cache
 * @since Epic 14 - Story 14.3
 * @lastModified 2026-01-03
 *
 * @features
 *   - TTL 自動過期（預設 5 分鐘）
 *   - 模式匹配失效（支援 * 萬用字元）
 *   - 快取統計資訊
 *   - 手動清除
 *
 * @related
 *   - src/types/prompt-resolution.ts - 類型定義
 *   - src/services/prompt-resolver.service.ts - 主解析服務
 */

import type { ResolvedPromptResult, PromptCacheEntry, CacheStats } from '@/types/prompt-resolution';

/**
 * Prompt 快取服務
 * @description 負責快取解析結果，提升效能
 */
export class PromptCache {
  /** 快取存儲 */
  private readonly cache: Map<string, PromptCacheEntry<ResolvedPromptResult>>;

  /** 預設 TTL（5 分鐘） */
  private readonly DEFAULT_TTL = 5 * 60 * 1000;

  constructor() {
    this.cache = new Map();
  }

  /**
   * 取得快取資料
   * @param key - 快取鍵
   * @returns 快取資料，若不存在或已過期則返回 null
   */
  async get(key: string): Promise<ResolvedPromptResult | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 檢查是否過期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 設置快取資料
   * @param key - 快取鍵
   * @param data - 快取資料
   * @param ttl - 過期時間（毫秒），預設 5 分鐘
   */
  async set(
    key: string,
    data: ResolvedPromptResult,
    ttl?: number
  ): Promise<void> {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttl ?? this.DEFAULT_TTL),
    });
  }

  /**
   * 刪除指定快取
   * @param key - 快取鍵
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * 按模式失效快取
   * @param pattern - 模式字串（支援 * 萬用字元）
   * @example
   * ```typescript
   * await cache.invalidatePattern('prompt:TERM_CLASSIFICATION:*');
   * ```
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // 將 * 轉換為正則表達式
    const regexPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清除所有快取
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * 取得快取統計
   * @returns 快取統計資訊
   */
  getStats(): CacheStats {
    // 清理過期條目
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 檢查快取是否存在且有效
   * @param key - 快取鍵
   * @returns 是否存在有效快取
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 取得剩餘 TTL
   * @param key - 快取鍵
   * @returns 剩餘毫秒數，若不存在則返回 -1
   */
  async getTtl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return -1;

    const remaining = entry.expiresAt - Date.now();
    if (remaining <= 0) {
      this.cache.delete(key);
      return -1;
    }

    return remaining;
  }

  /**
   * 延長快取 TTL
   * @param key - 快取鍵
   * @param additionalTtl - 額外時間（毫秒）
   * @returns 是否成功延長
   */
  async extend(key: string, additionalTtl: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    entry.expiresAt += additionalTtl;
    return true;
  }
}
