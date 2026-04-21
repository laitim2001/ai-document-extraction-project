/**
 * @fileoverview 速率限制服務
 * @description
 *   使用滑動窗口算法實現 API 速率限制，支援兩種後端：
 *   - **Upstash Redis（優先）**：跨實例同步、持久化、適合多實例部署
 *   - **in-memory Map（fallback）**：單實例開發環境使用，若 Redis 未配置或故障
 *
 *   FIX-052: 重構為雙模式支援。行為保持與原介面相容，7 個調用端的
 *   `rateLimitService.checkLimit()` 呼叫方式不變。
 *
 * @module src/services/rate-limit.service
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2026-04-21 (FIX-052: Redis migration)
 *
 * @features
 *   - Sliding window 演算法（ZSET-based for Redis, array-based for memory）
 *   - Redis 優先 + in-memory fallback
 *   - 優雅降級（Redis 故障自動退回 in-memory）
 *   - 管理員重置功能
 *   - 使用量監控
 *
 * @dependencies
 *   - @upstash/redis - Redis 客戶端
 *   - @prisma/client - 資料庫類型
 *   - @/lib/redis - Redis 客戶端單例
 *   - @/lib/edge-logger - 結構化日誌
 *
 * @related
 *   - src/lib/redis.ts - Redis client 單例
 *   - src/services/invoice-submission.service.ts - 發票提交服務
 *   - 7 個 /api/v1/invoices/* API routes - 主要調用方
 */

import { ExternalApiKey } from '@prisma/client';
import type { Redis } from '@upstash/redis';
import { getRedisClient, isRedisConfigured } from '@/lib/redis';
import { edgeLogger } from '@/lib/edge-logger';

// ============================================================
// 類型定義
// ============================================================

/**
 * 速率限制結果
 */
export interface RateLimitResult {
  /** 是否允許請求 */
  allowed: boolean;
  /** 每分鐘限制數 */
  limit: number;
  /** 剩餘請求數 */
  remaining: number;
  /** 重置時間（Unix 時間戳） */
  reset: number;
  /** 需要等待的秒數（僅當 allowed=false 時） */
  retryAfter?: number;
}

/**
 * 速率限制鍵格式函數
 */
type KeyFormatter = (apiKeyId: string) => string;

// ============================================================
// 服務類別
// ============================================================

/**
 * 滑動窗口速率限制服務
 *
 * @description
 *   優先使用 Upstash Redis（ZSET-based sliding window），若 Redis 未配置
 *   或呼叫失敗則降級使用 in-memory Map（single-instance only）。
 */
export class RateLimitService {
  /** 窗口大小（毫秒） - 1 分鐘 */
  private readonly windowMs = 60 * 1000;

  /** 內存存儲（Redis 未配置或故障時的 fallback） */
  private readonly memoryStore = new Map<string, { timestamps: number[] }>();

  /** 鍵格式化函數 */
  private readonly keyFormatter: KeyFormatter = (apiKeyId) =>
    `rate_limit:external_api:${apiKeyId}`;

  /** 避免重複發出 fallback warning 的旗標 */
  private hasWarnedFallback = false;

  /**
   * 檢查速率限制
   *
   * @param apiKey API Key 實體
   * @returns 速率限制結果
   */
  async checkLimit(apiKey: ExternalApiKey): Promise<RateLimitResult> {
    const redis = getRedisClient();

    if (redis) {
      try {
        return await this.checkLimitRedis(redis, apiKey);
      } catch (error) {
        edgeLogger.warn('[RateLimit] Redis check failed, falling back to in-memory', {
          apiKeyId: apiKey.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return this.checkLimitMemory(apiKey);
      }
    }

    // Redis 未配置 → fallback（首次呼叫時警告一次）
    if (!this.hasWarnedFallback) {
      edgeLogger.warn(
        '[RateLimit] UPSTASH_REDIS_* not configured; using in-memory store. ' +
          'This is NOT safe for multi-instance deployment.'
      );
      this.hasWarnedFallback = true;
    }
    return this.checkLimitMemory(apiKey);
  }

  /**
   * Redis 版本的 sliding window 速率限制
   *
   * 使用 ZSET 存儲 timestamp，搭配 ZREMRANGEBYSCORE 清理過期 + ZCARD 計數。
   * 若超限則 rollback 剛加入的 member，避免累積誤差。
   */
  private async checkLimitRedis(
    redis: Redis,
    apiKey: ExternalApiKey
  ): Promise<RateLimitResult> {
    const rateLimit = apiKey.rateLimit || 60;
    const key = this.keyFormatter(apiKey.id);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const ttlSec = Math.ceil(this.windowMs / 1000) + 1;
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    // Pipeline: 清理過期 → 記錄本次 → 計數 → 設 TTL
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, { score: now, member });
    pipeline.zcard(key);
    pipeline.expire(key, ttlSec);
    const results = (await pipeline.exec()) as [number, number, number, number];

    const currentCount = results[2] ?? 0;

    if (currentCount > rateLimit) {
      // 超限 → 回滾剛加入的 member（避免累積誤差）
      await redis.zrem(key, member);

      // 取最舊 timestamp 計算 retryAfter
      const oldest = (await redis.zrange(key, 0, 0, { withScores: true })) as
        | [string, number]
        | [];
      const oldestTs = oldest.length === 2 ? Number(oldest[1]) : now;
      const retryAfter = Math.max(
        1,
        Math.ceil((oldestTs + this.windowMs - now) / 1000)
      );

      return {
        allowed: false,
        limit: rateLimit,
        remaining: 0,
        reset: Math.ceil((now + this.windowMs) / 1000),
        retryAfter,
      };
    }

    return {
      allowed: true,
      limit: rateLimit,
      remaining: Math.max(0, rateLimit - currentCount),
      reset: Math.ceil((now + this.windowMs) / 1000),
    };
  }

  /**
   * 內存版本的 sliding window 速率限制（fallback）
   *
   * 與原 Epic 11 實作等價，僅在 Redis 未配置或故障時使用。
   */
  private checkLimitMemory(apiKey: ExternalApiKey): RateLimitResult {
    const rateLimit = apiKey.rateLimit || 60;
    const key = this.keyFormatter(apiKey.id);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      let store = this.memoryStore.get(key);
      if (!store) {
        store = { timestamps: [] };
        this.memoryStore.set(key, store);
      }

      store.timestamps = store.timestamps.filter((ts) => ts > windowStart);

      const currentCount = store.timestamps.length;

      if (currentCount >= rateLimit) {
        const oldestTimestamp = store.timestamps[0] || now;
        const retryAfter = Math.ceil(
          (oldestTimestamp + this.windowMs - now) / 1000
        );

        return {
          allowed: false,
          limit: rateLimit,
          remaining: 0,
          reset: Math.ceil((now + this.windowMs) / 1000),
          retryAfter: Math.max(1, retryAfter),
        };
      }

      store.timestamps.push(now);

      return {
        allowed: true,
        limit: rateLimit,
        remaining: rateLimit - currentCount - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
      };
    } catch (error) {
      edgeLogger.error('[RateLimit] In-memory check error, degrading to allow', {
        apiKeyId: apiKey.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // 出錯時優雅降級：允許請求（不阻斷業務）
      return {
        allowed: true,
        limit: rateLimit,
        remaining: rateLimit - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
      };
    }
  }

  /**
   * 重置速率限制（管理用途）
   * @param apiKeyId API Key ID
   */
  async resetLimit(apiKeyId: string): Promise<void> {
    const key = this.keyFormatter(apiKeyId);
    const redis = getRedisClient();

    if (redis) {
      try {
        await redis.del(key);
      } catch (error) {
        edgeLogger.warn('[RateLimit] Redis resetLimit failed', {
          apiKeyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 無論 Redis 是否成功，都清理 in-memory 以保持一致
    this.memoryStore.delete(key);
  }

  /**
   * 獲取當前使用量（監控用途）
   * @param apiKeyId API Key ID
   * @returns 當前窗口內的請求數
   */
  async getCurrentUsage(apiKeyId: string): Promise<number> {
    const key = this.keyFormatter(apiKeyId);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const redis = getRedisClient();

    if (redis) {
      try {
        await redis.zremrangebyscore(key, 0, windowStart);
        const count = await redis.zcard(key);
        return Number(count) || 0;
      } catch (error) {
        edgeLogger.warn('[RateLimit] Redis getCurrentUsage failed, using in-memory', {
          apiKeyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const store = this.memoryStore.get(key);
    if (!store) return 0;

    store.timestamps = store.timestamps.filter((ts) => ts > windowStart);
    return store.timestamps.length;
  }

  /**
   * 獲取所有活躍的速率限制鍵
   *
   * @description
   *   Redis 模式使用 `SCAN` 以 match prefix；in-memory 模式遍歷 Map。
   *
   * @returns 活躍的 API Key ID 列表
   */
  async getActiveKeys(): Promise<string[]> {
    const prefix = 'rate_limit:external_api:';
    const redis = getRedisClient();
    const activeKeys = new Set<string>();

    if (redis) {
      try {
        // 使用 SCAN 避免 KEYS 阻塞
        let cursor: string | number = 0;
        do {
          const result = (await redis.scan(cursor, {
            match: `${prefix}*`,
            count: 100,
          })) as [string | number, string[]];
          cursor = result[0];
          for (const redisKey of result[1]) {
            const apiKeyId = redisKey.replace(prefix, '');
            const usage = await this.getCurrentUsage(apiKeyId);
            if (usage > 0) activeKeys.add(apiKeyId);
          }
        } while (cursor !== 0 && cursor !== '0');
      } catch (error) {
        edgeLogger.warn('[RateLimit] Redis getActiveKeys failed, falling back to in-memory', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 合併 in-memory（即使 Redis 成功，in-memory 也可能有 fallback 期間的記錄）
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(prefix)) {
        const apiKeyId = key.replace(prefix, '');
        const usage = await this.getCurrentUsage(apiKeyId);
        if (usage > 0) activeKeys.add(apiKeyId);
      }
    }

    return Array.from(activeKeys);
  }

  /**
   * 清理所有過期的速率限制記錄
   *
   * @description
   *   Redis 自有 TTL 機制自動清理；此方法主要清理 in-memory store。
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, store] of this.memoryStore.entries()) {
      store.timestamps = store.timestamps.filter((ts) => ts > windowStart);
      if (store.timestamps.length === 0) {
        this.memoryStore.delete(key);
      }
    }
  }

  /**
   * 診斷：回報目前正在使用的後端
   * @internal
   */
  getBackendMode(): 'redis' | 'in-memory' {
    return isRedisConfigured() ? 'redis' : 'in-memory';
  }
}

/**
 * 速率限制服務單例
 */
export const rateLimitService = new RateLimitService();
