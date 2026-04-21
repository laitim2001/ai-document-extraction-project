/**
 * @fileoverview Upstash Redis 客戶端單例
 * @description
 *   提供全專案共用的 Upstash Redis 客戶端。
 *
 *   設計考量：
 *   - **可選依賴**：若環境變數 `UPSTASH_REDIS_REST_URL` 或 `UPSTASH_REDIS_REST_TOKEN`
 *     未配置，`getRedisClient()` 回傳 `null`，讓呼叫端決定 fallback 行為
 *     （例如 rate-limit.service 會退回 in-memory 實作）
 *   - **單例模式**：客戶端只初始化一次，重複呼叫返回同一實例
 *   - **Edge / Node 兼容**：`@upstash/redis` 是 REST-based SDK，可在 Edge Runtime
 *     和 Node Runtime 運作
 *
 * @module src/lib/redis
 * @since FIX-052
 * @lastModified 2026-04-21
 *
 * @related
 *   - src/services/rate-limit.service.ts - 主要消費者
 *   - .env.example - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;
let initialized = false;

/**
 * 取得 Upstash Redis 客戶端（單例）
 *
 * @returns Redis 實例，若環境變數未配置則回傳 `null`
 *
 * @example
 * ```typescript
 * const redis = getRedisClient();
 * if (redis) {
 *   await redis.set('key', 'value');
 * } else {
 *   // Fallback 邏輯
 * }
 * ```
 */
export function getRedisClient(): Redis | null {
  if (initialized) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    initialized = true;
    return null;
  }

  redisClient = new Redis({ url, token });
  initialized = true;
  return redisClient;
}

/**
 * 檢查 Redis 是否已配置（用於 health check / 診斷）
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * 重置客戶端（僅測試用途）
 * @internal
 */
export function resetRedisClientForTesting(): void {
  redisClient = null;
  initialized = false;
}
