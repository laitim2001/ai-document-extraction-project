# FIX-051: db-context.ts `$executeRawUnsafe` 未對 cityCodes 進行輸入驗證

> **建立日期**: 2026-04-21
> **發現方式**: 代碼審查（`docs/06-codebase-analyze/05-security-quality/security-audit.md`）
> **影響頁面/功能**: 資料庫 RLS 上下文（所有使用 `withRlsContext()` 或 `setRlsContext()` 的查詢鏈）
> **優先級**: 🔴 高（SQL Injection 風險）
> **狀態**: ✅ 已修復（2026-04-21）

---

## 問題描述

`src/lib/db-context.ts` 的 `setRlsContext()` 使用 `$executeRawUnsafe` 將 `cityCodes` 陣列以 `.join(',')` 拼接後直接代入 `set_config()` 的字面量參數。**PostgreSQL `set_config()` 函數的參數必須是字面量，無法使用 Prisma 的參數化查詢**，因此一旦 `cityCodes` 含有被汙染的值（如單引號、分號、SQL 關鍵字），會構成 SQL Injection 風險。

雖然目前的呼叫鏈中 `cityCodes` 多由 `cityValidation.allowed` 提供（理論上已過濾），但：
1. `cityValidation` 的上游源頭未保證所有入口都強制驗證
2. `RlsContext.cityCodes: string[]` 型別只限制是字串陣列，沒有內容驗證
3. `clearRlsContext()`（第 106 行）也使用同模式（雖然目前只傳入 hard-coded 值，但模式不安全）

---

## 重現步驟（理論性）

1. 找到任一路由或服務呼叫 `setRlsContext(prisma, { cityCodes: [...userInput] })`
2. 在 `userInput` 注入惡意值：`["HKG', 'false'); DROP TABLE users; --"]`
3. `$executeRawUnsafe` 組出：
   ```sql
   SELECT set_config('app.is_global_admin', 'false', true),
          set_config('app.user_city_codes', 'HKG', 'false'); DROP TABLE users; --', true)
   ```
4. **觀察現象**：若該路由允許用戶輸入影響 `cityCodes`，則可能觸發任意 SQL 執行

> **注意**：目前專案的 `cityCodes` 來源（`cityValidation.allowed`）**應該**已是白名單過濾後的結果，但「防禦縱深」原則要求 `setRlsContext()` 本身也必須拒絕非法輸入。

---

## 根本原因

| # | 位置 | 問題 |
|---|------|------|
| 1 | `src/lib/db-context.ts:87-91` | `$executeRawUnsafe` + 字串插值 `${isGlobalAdmin}`, `${cityCodes}` |
| 2 | `src/lib/db-context.ts:106-110` | 同樣模式（雖目前 hard-coded，但模式不安全） |

### 為什麼無法直接改用 `$executeRaw` 參數化？

- PostgreSQL `set_config(name, value, is_local)` 的 `value` 是字串字面量，**不支援** parameterized binding
- 即使用 `$executeRaw\`SELECT set_config('app.foo', ${value}, true)\``，Prisma 會把 `${value}` 當成 SQL 表達式嵌入，仍需手動跳脫
- 因此**必須**在呼叫端做嚴格輸入驗證

---

## 解決方案

### 1. 在 `setRlsContext` 入口強制白名單驗證

```typescript
// src/lib/db-context.ts
const CITY_CODE_PATTERN = /^[A-Z]{2,4}$/; // 國際機場/城市代碼格式

function sanitizeCityCode(code: string): string {
  if (!CITY_CODE_PATTERN.test(code)) {
    throw new Error(`[RLS] Invalid city code: ${JSON.stringify(code)}`);
  }
  return code;
}

export async function setRlsContext(
  prismaClient: PrismaClient,
  context: RlsContext
): Promise<void> {
  const isGlobalAdmin = context.isGlobalAdmin ? 'true' : 'false';
  const cityCodes = context.cityCodes.map(sanitizeCityCode).join(',');

  await prismaClient.$executeRawUnsafe(`
    SELECT
      set_config('app.is_global_admin', '${isGlobalAdmin}', true),
      set_config('app.user_city_codes', '${cityCodes}', true)
  `);
}
```

### 2. （選用）抽出 `sanitizeCityCode()` 為共用 helper

若專案其他地方（CSV 匯入、mapping rules 等）也使用 city code，可移到 `src/lib/validations/city-code.ts` 或 `src/types/city.ts`，避免重複定義正則。

### 3. `clearRlsContext()` 保留現狀但加註解

第 106-110 行目前只用 hard-coded 值，風險低，但加 JSDoc 註解提醒「禁止加入動態字串參數」。

### 4. （選用）加入 Unit Test

```typescript
// tests/unit/lib/db-context.test.ts
it('rejects city codes with single quotes', async () => {
  await expect(
    setRlsContext(prisma, { isGlobalAdmin: false, cityCodes: ["HKG', 'a"] })
  ).rejects.toThrow(/Invalid city code/);
});

it('rejects city codes with semicolons', async () => {
  await expect(
    setRlsContext(prisma, { isGlobalAdmin: false, cityCodes: ['HK;DROP'] })
  ).rejects.toThrow(/Invalid city code/);
});
```

---

## 修改的檔案（實際）

| 檔案 | 修改內容 |
|------|---------|
| `src/lib/db-context.ts` | 新增 `CITY_CODE_PATTERN` 常數 (`^[A-Z]{2,4}$`) + `sanitizeCityCode()` helper；於 `setRlsContext` 對 `cityCodes` 每個元素套用 sanitizer；`clearRlsContext` 加安全警告 JSDoc |

### 未建立的檔案與原因

- `tests/unit/lib/db-context.test.ts`：專案現有測試基礎設施 `@types/jest` 未完整配置（既存問題），暫以 inline Node 手動測試驗證白名單正則行為（15 測試案例全數通過）
- `src/lib/validations/city-code.ts`：目前只有 `db-context.ts` 使用，未達抽共用模組門檻，keep it local

---

## 測試驗證

修復完成後需驗證：

- [x] **TypeScript 類型檢查**：`npx tsc --noEmit` — `db-context.ts` 零錯誤（2026-04-21）
- [x] **ESLint 檢查**：`npx eslint src/lib/db-context.ts --max-warnings 0` — 零警告（2026-04-21）
- [x] **白名單正則正確性**：inline Node 測試 15 案例全數通過（2026-04-21）
  - 正常值（HKG/SGP/NYC/TPE/LAX/AP/APAC）→ accept ✅
  - 惡意值（含引號/分號/空白/小寫/數字/底線/超長）→ reject ✅
- [x] **現有 seed 資料全相容**：TPE/HKG/SGP/TYO/SHA/SYD/LON/FRA/NYC/LAX 全部符合 `^[A-Z]{2,4}$`
- [ ] **RLS 功能無退化**（需手動 E2E 驗證）：
  - 既有的城市權限過濾仍正常
  - Global Admin 繞過 RLS 仍正常
  - Regional Manager 跨城市存取仍正常
- [ ] **完整 E2E**：文件上傳 → 審核 → 報表流程確認無影響

---

## 相關文件

- 觸發來源：`docs/06-codebase-analyze/00-analysis-index.md` §Critical Findings Row 6（`$executeRawUnsafe` 系統性低估 → 已確認 2 處都在 db-context.ts）
- 安全審計：`docs/06-codebase-analyze/05-security-quality/security-audit.md`
- RLS 設計：`prisma/migrations/20251219010000_add_multi_city_support/` 的 RLS policy
- 城市權限服務：`src/services/city-access.service.ts`

---

*文件建立日期: 2026-04-21*
*最後更新: 2026-04-21（標記為已修復）*
