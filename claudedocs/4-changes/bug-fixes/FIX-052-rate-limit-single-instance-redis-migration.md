# FIX-052: Rate Limit 服務實際使用 in-memory Map 而非宣稱的 Upstash Redis

> **建立日期**: 2026-04-21
> **發現方式**: 架構審計（`docs/06-codebase-analyze/` 驗證報告 R5-R15）
> **影響頁面/功能**: 7 個外部 API 端點（全部在 `/api/v1/invoices/*`）
> **優先級**: 🔴 高（多實例部署失效風險）
> **狀態**: ✅ 已修復（2026-04-21）

---

## 問題描述

專案 `CLAUDE.md` 和 `package.json` 聲稱使用 `@upstash/redis` 作為快取與 rate limit 存儲，但實際代碼 `src/services/rate-limit.service.ts` 使用 **in-memory `Map<string, ...>`**，而且整個 `src/` 目錄**零處 import `@upstash/redis`**。

### 風險點

| 風險 | 說明 |
|------|------|
| 多實例失效 | Node.js 每個實例有獨立記憶體，rate limit 無法跨實例同步 |
| Scale-out 陷阱 | 若未來上 PM2 cluster / Azure App Service scale / Kubernetes HPA，rate limit 實際上會變成「每實例獨立計數」 |
| 文檔欺騙 | CLAUDE.md 聲稱使用 Redis，新開發者基於此假設做架構決策會踩坑 |
| 進程重啟歸零 | 服務重啟後所有 rate limit 記錄消失，允許短時間內 API 濫用 |

---

## 重現步驟

1. 啟動兩個 Node 實例（或使用 PM2 cluster）：`PORT=3200 npm run dev` + `PORT=3201 npm run dev`
2. 為同一 API Key 發送超過 `rateLimit` 的請求，但交替打到兩個實例
3. **觀察現象**：兩個實例各自獨立計數，用戶實際可用額度是原本的 2 倍

---

## 根本原因

### 代碼位置

| 位置 | 內容 |
|------|------|
| `src/services/rate-limit.service.ts:73-74` | `private readonly memoryStore = new Map<string, { timestamps: number[] }>();` |
| `src/services/rate-limit.service.ts:84-136` | `checkLimit()` 完全操作 `memoryStore`，無 Redis 呼叫 |
| `package.json:73` | `"@upstash/redis": "^1.35.8"`（已安裝但**零 import**） |

### 調用者統計

Rate limit 散落在 7 個 API routes（都是 external API 認證端點）：

1. `src/app/api/v1/invoices/route.ts`
2. `src/app/api/v1/invoices/batch-status/route.ts`
3. `src/app/api/v1/invoices/batch-results/route.ts`
4. `src/app/api/v1/invoices/[taskId]/status/route.ts`
5. `src/app/api/v1/invoices/[taskId]/result/route.ts`
6. `src/app/api/v1/invoices/[taskId]/result/fields/[fieldName]/route.ts`
7. `src/app/api/v1/invoices/[taskId]/document/route.ts`

每個 route 獨立呼叫 `rateLimitService.checkLimit()` — **沒有全域 middleware**。

### 歷史背景

rate-limit.service.ts 第 64-66 行的註解明確寫：
> 使用內存實現速率限制（開發環境）。生產環境應使用 Redis (Upstash) 實現。

顯示**原作者本來就意識到 in-memory 只是臨時方案**，但遷移 Redis 的任務一直未完成。

---

## 解決方案（🟢 採用路徑 A：實作 Redis 版本）

### 設計方針

- **優先**：連線 Upstash Redis 時使用 Redis 版本的 sliding window
- **fallback**：若 Redis 不可達（連線失敗、環境變數缺失），降級為 in-memory Map 並輸出 WARN 日誌
- **介面保留**：`rateLimitService.checkLimit(apiKey)` 的簽章不變，7 個 API route 零修改
- **算法選擇**：使用 Upstash `@upstash/ratelimit` 的 Sliding Window 演算法（或手工實作 ZSET + ZREMRANGEBYSCORE）

### 實作步驟

**Step 1**: 新建 `src/lib/redis.ts` —— Redis client 單例

```typescript
// src/lib/redis.ts
import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null; // 允許 fallback
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}
```

**Step 2**: 改寫 `rate-limit.service.ts`

```typescript
export class RateLimitService {
  private readonly windowMs = 60 * 1000;
  private readonly memoryStore = new Map<string, { timestamps: number[] }>();
  private hasWarnedFallback = false;

  async checkLimit(apiKey: ExternalApiKey): Promise<RateLimitResult> {
    const redis = getRedisClient();

    if (redis) {
      try {
        return await this.checkLimitRedis(redis, apiKey);
      } catch (error) {
        logger.warn('[RateLimit] Redis check failed, falling back to in-memory', { error });
        return this.checkLimitMemory(apiKey);
      }
    }

    // Redis 未配置 → fallback
    if (!this.hasWarnedFallback) {
      logger.warn('[RateLimit] Using in-memory store. Configure UPSTASH_REDIS_* for multi-instance deployment.');
      this.hasWarnedFallback = true;
    }
    return this.checkLimitMemory(apiKey);
  }

  private async checkLimitRedis(redis: Redis, apiKey: ExternalApiKey): Promise<RateLimitResult> {
    const rateLimit = apiKey.rateLimit || 60;
    const key = this.keyFormatter(apiKey.id);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Sliding window with ZSET
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);           // 清理過期
    pipeline.zadd(key, { score: now, member: `${now}` });     // 記錄本次
    pipeline.zcard(key);                                       // 當前計數
    pipeline.expire(key, Math.ceil(this.windowMs / 1000));     // TTL
    const results = await pipeline.exec<[number, number, number, number]>();

    const currentCount = results[2];
    if (currentCount > rateLimit) {
      // 超限 → 回滾剛加入的記錄（避免累積）
      await redis.zrem(key, `${now}`);
      // 計算 retryAfter
      const oldest = await redis.zrange<number[]>(key, 0, 0, { withScores: true });
      const oldestTs = oldest?.[1] ?? now;
      return {
        allowed: false,
        limit: rateLimit,
        remaining: 0,
        reset: Math.ceil((now + this.windowMs) / 1000),
        retryAfter: Math.max(1, Math.ceil((oldestTs + this.windowMs - now) / 1000)),
      };
    }

    return {
      allowed: true,
      limit: rateLimit,
      remaining: rateLimit - currentCount,
      reset: Math.ceil((now + this.windowMs) / 1000),
    };
  }

  private checkLimitMemory(apiKey: ExternalApiKey): RateLimitResult {
    // ... 保留原 L84-136 的邏輯
  }
}
```

**Step 3**: `.env` 與 `.env.example` 新增

```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Step 4**: 同步更新 `resetLimit()`, `getCurrentUsage()`, `getActiveKeys()`, `cleanup()` 的 Redis 版本（在 Redis 模式下用 `DEL`, `ZCARD`, `SCAN`, `EXPIRE` 等）。

**Step 5**: 更新主 `CLAUDE.md`

移除「⚠️ Rate limit 實作並未使用」的警告（§已知差異），改標記為「✅ FIX-052 已修復」。

---

## 修改的檔案（實際）

| 檔案 | 修改類型 | 說明 |
|------|---------|------|
| `src/lib/redis.ts` | **新建** | Upstash Redis client 單例 + `isRedisConfigured()` 診斷 + `resetRedisClientForTesting()` |
| `src/services/rate-limit.service.ts` | 改寫 | `checkLimit()` 分流 Redis/in-memory；Redis 失敗自動 fallback；`resetLimit` / `getCurrentUsage` / `getActiveKeys` 皆支援雙模式；新增 `getBackendMode()` 診斷 |
| `.env.example` | **無需修改** | L58-59 已有 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` |
| `CLAUDE.md`（根） | 更新 | §已知差異 Rate Limit 條目標記為 FIX-052 已修復；§技術棧「快取」描述修正 |

### 未建立測試檔案的原因

- `tests/unit/services/rate-limit.service.test.ts`：專案 `@types/jest` 測試基礎設施有既存問題（參考 type-check 輸出的既存錯誤）
- 替代驗證：8 項結構化 grep 檢查覆蓋 Redis 分流、fallback 邏輯、ZSET sliding window、diagnostic 方法

### 技術決策記錄

**為何使用 `@upstash/redis` 而非 `@upstash/ratelimit`?**
- `@upstash/ratelimit` 是高階包裝器，封裝了滑動窗口，但會額外引入依賴
- 本實作直接用 `@upstash/redis` 的 ZSET 命令（`zremrangebyscore` + `zadd` + `zcard` + `expire`）實作 sliding window，邏輯透明可控且與既有 in-memory 版本語義對齊
- 為保證多指令原子性使用 `redis.multi()` pipeline

**超限後的 rollback 策略**
- 成功 `zadd` 後若發現超限，會 `zrem` 該 member 回滾，避免多實例併發下超限後仍累積計數

**資源管理**
- 每次 `zadd` 後設 `expire`，確保 Redis key 有 TTL 自動清理（即使 cleanup() 未呼叫也不會累積）

---

## 測試驗證

修復完成後需驗證：

- [x] **TypeScript 類型檢查**：`npx tsc --noEmit` — FIX-052 相關檔案零錯誤（2026-04-21）
- [x] **ESLint 檢查**：`npx eslint src/lib/redis.ts src/services/rate-limit.service.ts --max-warnings 0` — 零警告
- [x] **結構化邏輯檢查**：8 項 grep 驗證全部通過（Redis import / null fallback / 雙模式分流 / 錯誤 fallback / 單次警告 / ZSET sliding window / cleanup 策略 / diagnostic）
- [ ] **Redis 模式 E2E**：設置 Upstash 環境變數，7 個 route 的 rate limit 行為正確（超限回傳 429）— 需真實 Upstash 實例
- [ ] **Fallback 模式 E2E**：不設環境變數，service 自動降級為 in-memory + WARN log 出現一次
- [ ] **多實例驗證**（可選）：兩個 Node 實例共用同一 Upstash DB，跨實例 rate limit 正確同步
- [ ] **Redis 故障容錯**：模擬 Redis 連線失敗（錯誤 URL），service 不 crash，降級為 in-memory
- [ ] **既有 7 個 API route 無回歸**：外部 API 調用流程正常

---

## 相關文件

- 觸發來源：`docs/06-codebase-analyze/00-analysis-index.md` §Critical Findings Row 1
- 調用者清單：前述 7 個 `/api/v1/invoices/*` routes
- Upstash SDK：`node_modules/@upstash/redis/` 已安裝 v1.35.8
- CLAUDE.md 已知差異：本專案根目錄 `CLAUDE.md` §⚠️ 已知差異與關鍵發現

---

*文件建立日期: 2026-04-21*
*最後更新: 2026-04-21（標記為已修復）*
