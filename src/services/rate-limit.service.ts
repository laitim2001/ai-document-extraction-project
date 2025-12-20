/**
 * @fileoverview 速率限制服務
 * @description
 *   使用滑動窗口算法實現 API 速率限制，支援：
 *   - Redis 後端存儲（Upstash）
 *   - 滑動窗口速率限制
 *   - 優雅降級（Redis 故障時）
 *   - 速率限制重置和監控
 *
 * @module src/services/rate-limit.service
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 滑動窗口算法
 *   - 每分鐘請求限制
 *   - 優雅降級機制
 *   - 管理員重置功能
 *   - 使用量監控
 *
 * @dependencies
 *   - @upstash/redis - Redis 客戶端
 *   - @prisma/client - 資料庫類型
 *
 * @related
 *   - src/services/invoice-submission.service.ts - 發票提交服務
 *   - src/middleware/external-api-auth.ts - API 認證中間件
 */

import { ExternalApiKey } from '@prisma/client';

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
 * @description
 *   使用內存實現速率限制（開發環境）。
 *   生產環境應使用 Redis (Upstash) 實現。
 */
export class RateLimitService {
  /** 窗口大小（毫秒） - 1 分鐘 */
  private readonly windowMs = 60 * 1000;

  /** 內存存儲（開發環境用） */
  private readonly memoryStore = new Map<string, { timestamps: number[] }>();

  /** Redis 鍵格式化函數 */
  private readonly keyFormatter: KeyFormatter = (apiKeyId) =>
    `rate_limit:external_api:${apiKeyId}`;

  /**
   * 檢查速率限制
   * @param apiKey API Key 實體
   * @returns 速率限制結果
   */
  async checkLimit(apiKey: ExternalApiKey): Promise<RateLimitResult> {
    const rateLimit = apiKey.rateLimit || 60;
    const key = this.keyFormatter(apiKey.id);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      // 獲取或創建存儲
      let store = this.memoryStore.get(key);
      if (!store) {
        store = { timestamps: [] };
        this.memoryStore.set(key, store);
      }

      // 移除過期的請求記錄
      store.timestamps = store.timestamps.filter((ts) => ts > windowStart);

      const currentCount = store.timestamps.length;

      if (currentCount >= rateLimit) {
        // 計算重試時間
        const oldestTimestamp = store.timestamps[0] || now;
        const retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);

        return {
          allowed: false,
          limit: rateLimit,
          remaining: 0,
          reset: Math.ceil((now + this.windowMs) / 1000),
          retryAfter: Math.max(1, retryAfter),
        };
      }

      // 記錄此次請求
      store.timestamps.push(now);

      return {
        allowed: true,
        limit: rateLimit,
        remaining: rateLimit - currentCount - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // 如果出錯，默認允許請求（優雅降級）
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
    this.memoryStore.delete(key);
  }

  /**
   * 獲取當前使用量（監控用途）
   * @param apiKeyId API Key ID
   * @returns 當前窗口內的請求數
   */
  async getCurrentUsage(apiKeyId: string): Promise<number> {
    const key = this.keyFormatter(apiKeyId);
    const windowStart = Date.now() - this.windowMs;

    const store = this.memoryStore.get(key);
    if (!store) {
      return 0;
    }

    // 清理過期記錄並返回計數
    store.timestamps = store.timestamps.filter((ts) => ts > windowStart);
    return store.timestamps.length;
  }

  /**
   * 獲取所有活躍的速率限制鍵
   * @returns 活躍的 API Key ID 列表
   */
  async getActiveKeys(): Promise<string[]> {
    const prefix = 'rate_limit:external_api:';
    const activeKeys: string[] = [];

    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(prefix)) {
        const apiKeyId = key.replace(prefix, '');
        const usage = await this.getCurrentUsage(apiKeyId);
        if (usage > 0) {
          activeKeys.push(apiKeyId);
        }
      }
    }

    return activeKeys;
  }

  /**
   * 清理所有過期的速率限制記錄
   * @description 定期清理任務使用
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
}

/**
 * 速率限制服務單例
 */
export const rateLimitService = new RateLimitService();

// ============================================================
// Redis 實現（生產環境用）
// ============================================================

/**
 * Redis 速率限制服務
 * @description
 *   使用 Upstash Redis 實現速率限制。
 *   需要設置以下環境變數：
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 *
 * @example
 *   // 使用 Redis 實現（生產環境）
 *   import { Redis } from '@upstash/redis';
 *
 *   const redis = new Redis({
 *     url: process.env.UPSTASH_REDIS_REST_URL!,
 *     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *   });
 *
 *   // 在 checkLimit 中使用 redis.zremrangebyscore, redis.zcard, redis.zadd 等
 */

// 生產環境 Redis 實現可在需要時啟用
// export class RedisRateLimitService extends RateLimitService { ... }
