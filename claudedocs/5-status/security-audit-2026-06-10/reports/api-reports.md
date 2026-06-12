# 安全審查報告 — 報表 / 統計 / 儀表板 / 分析 / 成本 / 城市 API

> 審查日期：2026-06-10 | Scope：api-reports.txt（32 檔案）| Agent：api-reports 並行審查 agent

---

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/analytics/city-comparison/route.ts | 379 | ✅ |
| 2 | src/app/api/analytics/global/route.ts | 487 | ✅ |
| 3 | src/app/api/analytics/region/[code]/cities/route.ts | 289 | ✅ |
| 4 | src/app/api/cities/[code]/route.ts | 174 | ✅ |
| 5 | src/app/api/cities/accessible/route.ts | 118 | ✅ |
| 6 | src/app/api/cities/route.ts | 92 | ✅ |
| 7 | src/app/api/cost/city-summary/route.ts | 153 | ✅ |
| 8 | src/app/api/cost/city-trend/route.ts | 155 | ✅ |
| 9 | src/app/api/cost/comparison/route.ts | 153 | ✅ |
| 10 | src/app/api/cost/pricing/[id]/route.ts | 188 | ✅ |
| 11 | src/app/api/cost/pricing/route.ts | 186 | ✅ |
| 12 | src/app/api/dashboard/ai-cost/anomalies/route.ts | 131 | ✅ |
| 13 | src/app/api/dashboard/ai-cost/daily/[date]/route.ts | 173 | ✅ |
| 14 | src/app/api/dashboard/ai-cost/route.ts | 153 | ✅ |
| 15 | src/app/api/dashboard/ai-cost/trend/route.ts | 137 | ✅ |
| 16 | src/app/api/dashboard/statistics/route.ts | 144 | ✅ |
| 17 | src/app/api/reports/city-cost/anomaly/[cityCode]/route.ts | 198 | ✅ |
| 18 | src/app/api/reports/city-cost/route.ts | 156 | ✅ |
| 19 | src/app/api/reports/city-cost/trend/route.ts | 169 | ✅ |
| 20 | src/app/api/reports/expense-detail/estimate/route.ts | 88 | ✅ |
| 21 | src/app/api/reports/expense-detail/export/route.ts | 119 | ✅ |
| 22 | src/app/api/reports/jobs/[jobId]/route.ts | 86 | ✅ |
| 23 | src/app/api/reports/monthly-cost/[id]/download/route.ts | 66 | ✅ |
| 24 | src/app/api/reports/monthly-cost/generate/route.ts | 78 | ✅ |
| 25 | src/app/api/reports/monthly-cost/route.ts | 48 | ✅ |
| 26 | src/app/api/reports/regional/city/[cityCode]/route.ts | 156 | ✅ |
| 27 | src/app/api/reports/regional/export/route.ts | 154 | ✅ |
| 28 | src/app/api/reports/regional/summary/route.ts | 125 | ✅ |
| 29 | src/app/api/statistics/processing/cities/route.ts | 194 | ✅ |
| 30 | src/app/api/statistics/processing/realtime/route.ts | 84 | ✅ |
| 31 | src/app/api/statistics/processing/reconcile/route.ts | 192 | ✅ |
| 32 | src/app/api/statistics/processing/route.ts | 229 | ✅ |

**總行數：5,254**

### 交叉確認的輔助檔案（非 scope，僅閱讀佐證）

- `src/middlewares/city-filter.ts`（`withCityFilter` 確認內建 `auth()` 認證 + 無城市授權即 403）
- `src/middleware.ts`（確認全局 middleware **完全跳過** `/api/*` 路徑 — matcher 排除 api，無法補救 route 層缺認證）
- `src/lib/auth/city-permission.ts`（`hasPermission` 對 undefined user 安全回傳 false）
- `src/services/expense-report.service.ts:608`（`getJobStatus` 以 `{ id, userId }` 過濾 — IDOR 防護確認）
- `src/services/monthly-cost-report.service.ts:845`（下載用 `generateSignedUrl` + 1 小時過期）
- `src/services/city-cost.service.ts:753-880`（pricing CRUD 在 service 層亦無任何權限檢查）

---

## 2. 發現

### [Critical] RPT-001 POST /api/cost/pricing 完全無認證 — 未授權者可創建計價配置

- **檔案**：src/app/api/cost/pricing/route.ts:143
- **類別**：A（認證與授權）
- **描述**：POST handler 從頭到尾沒有任何 `auth()` / session / 權限檢查，直接解析 body 後呼叫 `cityCostService.createPricingConfig()` 寫入資料庫。檔案頭部與 JSDoc 明確聲稱「僅系統管理員可以創建計價配置」，但實際沒有實作。已交叉確認：(1) 全局 `src/middleware.ts` matcher 排除全部 `/api` 路徑，不會補上認證；(2) service 層（city-cost.service.ts:812）亦無任何權限檢查。任何未登入的網路存取者皆可創建計價配置，直接篡改整個 AI 成本計算的基準資料（影響所有成本報表、儀表板、月度報告的正確性）。
- **證據**：
  ```typescript
  export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
      // 解析請求體
      const body = await request.json()
      const validation = createPricingSchema.safeParse(body)
      ...
      const config = await cityCostService.createPricingConfig(validation.data)
  ```
- **建議**：加入 `auth()` 檢查 + 系統管理員角色驗證（比照 `reports/monthly-cost/generate` 的 `hasPermission` 模式），未認證回 401、無權限回 403。

### [Critical] RPT-002 PATCH /api/cost/pricing/[id] 完全無認證 — 未授權篡改 + 審計記錄歸屬偽造

- **檔案**：src/app/api/cost/pricing/[id]/route.ts:125、152
- **類別**：A（認證與授權）
- **描述**：PATCH handler 無任何認證/授權檢查，任何未登入者可修改任意計價配置（價格、生效期、啟用狀態）。更嚴重的是第 151-152 行有未完成的 TODO，`changedBy` 硬編碼為 `'system-admin'`，所有變更歷史（`apiPricingHistory`）一律記錄為 system-admin 所為 — 即使被惡意篡改，審計追蹤也無法歸責，破壞 Epic 8 審計合規目標。
- **證據**：
  ```typescript
  // 更新計價配置
  // TODO: 從認證 context 獲取當前用戶 ID
  const changedBy = 'system-admin' // 暫時使用固定值
  const config = await cityCostService.updatePricingConfig(id, validation.data, changedBy)
  ```
- **建議**：加入 `auth()` + 管理員權限檢查，並以 `session.user.id` 取代硬編碼的 `changedBy`。

### [High] RPT-003 GET /api/cost/pricing 與 GET /api/cost/pricing/[id] 無認證 — 未授權讀取內部計價資料與變更歷史

- **檔案**：src/app/api/cost/pricing/route.ts:75；src/app/api/cost/pricing/[id]/route.ts:60
- **類別**：A（認證與授權）
- **描述**：兩個 GET handler 均無認證檢查。未登入者可列出全部 API 計價配置（內部成本參數、各 provider 單價），以及單一配置的最近 20 筆變更歷史（含 `changedBy` 內部用戶識別、變更原因）。屬內部商業資訊與內部用戶資訊外洩。
- **證據**：
  ```typescript
  export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
      const searchParams = Object.fromEntries(request.nextUrl.searchParams)
      const validation = listQuerySchema.safeParse(searchParams)
      ...
      const result = await cityCostService.getPricingConfigs({
  ```
- **建議**：與 RPT-001/002 一併修復 — 整個 `/api/cost/pricing` 域加入認證與管理員（或至少 REPORT_VIEW 級）權限。

### [Medium] RPT-004 五個報表端點 500 錯誤直接回傳 error.message 給客戶端

- **檔案**：
  - src/app/api/reports/city-cost/route.ts:150
  - src/app/api/reports/city-cost/trend/route.ts:163
  - src/app/api/reports/city-cost/anomaly/[cityCode]/route.ts:192
  - src/app/api/reports/regional/city/[cityCode]/route.ts:151
  - src/app/api/reports/regional/export/route.ts:148
- **類別**：J（資訊洩漏）
- **描述**：catch 區塊以 `error instanceof Error ? error.message : 'Internal server error'` 將內部例外訊息原樣回傳。Prisma / service 層例外訊息可能包含資料表名、欄位名、內部路徑或連線細節，提供攻擊者偵察素材。同 scope 其他端點（如 dashboard、statistics 系列）皆回傳固定訊息，此 5 檔屬於不一致的縱深防禦缺層。
- **證據**（reports/city-cost/route.ts:147-153）：
  ```typescript
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    },
    { status: 500 }
  )
  ```
- **建議**：500 回應一律回傳固定訊息，詳細錯誤只進 server log。

### [Medium] RPT-005 city-comparison 城市清單無數量上限 — N 倍查詢放大（DoS 面）

- **檔案**：src/app/api/analytics/city-comparison/route.ts:64-68、262-326
- **類別**：K（無界查詢 / DoS）
- **描述**：`cities` 參數僅驗證 `min(1)` 並以逗號切割，無數量上限、無格式驗證。每個城市代碼觸發 6 個資料庫查詢（含 1 個 raw SQL 聚合），以 `Promise.all` 並行。多城市用戶（或全局管理員）一次請求帶入數百個代碼即可造成查詢風暴；全局管理員路徑（第 228 行 `if (!isGlobalAdmin)`）甚至完全跳過城市代碼合法性驗證，任意字串都會進入查詢。raw SQL 本身為 tagged template 參數化，無注入風險。
- **證據**：
  ```typescript
  cities: z
    .string()
    .min(1, '必須選擇至少一個城市')
    .transform((s) => s.split(',').filter(Boolean)),
  ```
- **建議**：限制城市數量上限（如 `.refine(arr => arr.length <= 20)`）並驗證城市代碼格式（2-10 位英數字）。

### [Medium] RPT-006 statistics/processing/reconcile 寫入型校正操作僅需一般城市授權，無角色權限與 rate limit

- **檔案**：src/app/api/statistics/processing/reconcile/route.ts:86、163-168
- **類別**：A / K
- **描述**：POST reconcile 會執行「統計與原始記錄全量比對 → 自動修正資料 → 寫審計日誌」。目前只要通過 `withCityFilter`（任何被授權至少一個城市的一般用戶）即可對其授權城市任意日期重複觸發。這是寫入型且昂貴的操作：(1) 無管理員/維運角色限制，與其「數據校驗修正」的管理性質不符；(2) 無 rate limit，可被重複呼叫造成資料庫負載與審計日誌灌水。
- **證據**：
  ```typescript
  export const POST = withCityFilter(
    async (request, cityContext) => {
      ...
      const result = await processingStatsService.verifyAndReconcile(
        cityCode, parsedDate, cityContext.userId
      )
  ```
- **建議**：限制為管理員角色（或專屬權限如 STATS_RECONCILE），並加上 rate limit。

### [Medium] RPT-007 expense-detail estimate/export 缺 Zod 驗證；estimate 缺權限檢查；export fields 無白名單

- **檔案**：src/app/api/reports/expense-detail/estimate/route.ts:55-74；src/app/api/reports/expense-detail/export/route.ts:50-65
- **類別**：C（輸入驗證）/ A
- **描述**：
  1. 兩個 POST 端點都未用 Zod，僅手動檢查欄位存在性。`startDate` / `endDate` 任意字串直接傳入 service（estimate 第 66-74 行；export 第 50 行整個 `config` 物件原樣轉交）。
  2. export 要求 `REPORT_EXPORT` 權限（第 40-48 行正確），但 estimate 完全沒有對應權限檢查 — 權限不對稱，無匯出權限的用戶仍可反覆探測任意篩選條件下的記錄數量。
  3. export 的 `config.fields`（欄位名陣列）只驗證非空，未做白名單驗證即傳入 Excel 生成 — 若 service 端直接以欄位名取值，可能選取到非預期內部欄位。
- **證據**（estimate）：
  ```typescript
  const body: EstimateRequestBody = await request.json()
  if (!body.startDate || !body.endDate) { ... }
  const count = await expenseReportService.getEstimatedCount(cityContext, {
    dateRange: { startDate: body.startDate, endDate: body.endDate },
  ```
- **建議**：兩端點補 Zod schema（日期 regex、companyIds 為 cuid 陣列、fields 白名單枚舉）；estimate 加上與 export 相同或較低的報表權限檢查。

### [Low] RPT-008 多個端點分頁參數無上限 / 無 NaN 防護

- **檔案**：
  - src/app/api/cost/pricing/route.ts:40-41、99-100（`page`/`limit` regex 僅驗數字，無上限）
  - src/app/api/cost/comparison/route.ts:53、126（`limit` 無上限）
  - src/app/api/dashboard/ai-cost/daily/[date]/route.ts:42-43、146-147（`page`/`limit` 無上限）
  - src/app/api/reports/monthly-cost/route.ts:28-29（`parseInt(searchParams.get('page') || '1')` 無 NaN / 上限防護，`?page=abc` 產生 NaN 直接傳 service）
- **類別**：C / K
- **描述**：分頁參數缺 `max` 約束（專案標準為最大 100），攻擊者可用 `limit=1000000` 拉取大量資料造成記憶體與 DB 壓力；monthly-cost 的 parseInt 結果可能為 NaN 或負數。
- **建議**：統一用 Zod `coerce.number().int().min(1).max(100)` 模式。

### [Low] RPT-009 日期參數無範圍約束、無效日期靜默回退

- **檔案**：
  - src/app/api/statistics/processing/route.ts:68-72（無效日期靜默 fallback 預設值）
  - src/app/api/statistics/processing/cities/route.ts:60-64（同上）
  - src/app/api/reports/city-cost/route.ts:87-111、reports/regional/summary/route.ts:69-91 等（只驗格式，不限範圍，可查詢任意大時間跨度）
- **類別**：C / K
- **描述**：日期範圍無最大跨度限制（如 1 年），可構造跨數十年的聚合查詢加重 DB 負擔；statistics 系列對無效日期不報錯而是默默改用預設值，可能掩蓋客戶端錯誤並產生與請求不符的結果。
- **建議**：限制最大查詢跨度並對無效日期回 400。

### [Info] RPT-010 'use server' 指令出現在 3 個 route.ts 檔案

- **檔案**：src/app/api/analytics/city-comparison/route.ts:1；src/app/api/analytics/global/route.ts:1；src/app/api/analytics/region/[code]/cities/route.ts:1
- **類別**：K（其他）
- **描述**：`'use server'` 是 Server Actions 指令，不應出現在 Route Handler 檔案。目前未觀察到直接可利用的問題（GET handler 仍按 route handler 處理），但屬非預期用法，未來 Next.js 版本行為可能改變（如將匯出函數註冊為可呼叫的 action 端點）。
- **建議**：移除這 3 個檔案第 1 行的 `'use server'`。

### [Info] RPT-011 未登入時回 403 而非 401

- **檔案**：src/app/api/reports/monthly-cost/route.ts:20-25；src/app/api/reports/monthly-cost/[id]/download/route.ts:24-29
- **類別**：A
- **描述**：`hasPermission(session?.user, ...)` 對未登入（session 為 null）直接回傳 false，導致未認證請求收到 403 Permission denied 而非 401。不洩漏資訊，僅語意不準確，與同 scope 其他端點（401/403 分離）不一致。

### [Info] RPT-012 城市主檔對所有登入用戶完全開放

- **檔案**：src/app/api/cities/route.ts:34；src/app/api/cities/[code]/route.ts:67
- **類別**：A
- **描述**：任何登入用戶可列出全部活躍城市與查詢任意城市詳情（含 id、timezone、region），不受城市授權範圍限制。城市主檔屬低敏感參照資料且供篩選選單使用，設計上可接受，僅記錄此設計事實。

### [Info] RPT-013 系統性使用 console.error 而非 logger

- **檔案**：本 scope 全部 32 檔的 catch 區塊（例：analytics/global/route.ts:475、cost/city-summary/route.ts:140 等）
- **類別**：E
- **描述**：屬已知系統性缺口（CLAUDE.md 已列 console.log 約 279 處漸進清理）。本 scope 的 console.error 輸出皆為 error 物件與固定前綴，未觀察到 email / token / 密碼等 PII 直接輸出，風險低，但 error 物件序列化後仍可能含查詢細節。建議隨漸進清理替換為 logger。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 2 | 1 | 4 | 2 | 4 |

---

## 4. 區域整體觀察

1. **`/api/cost/pricing` 是本區域唯一完全無認證的子域，但屬 Critical 級**：scope 內 32 檔中 30 檔有認證（27 檔經 `withCityFilter` 內建 `auth()`，3 檔直接 `auth()` + `hasPermission`）。先前盤點聲稱「`/cost/*` 域 0% auth 覆蓋」並不準確 — `city-summary` / `city-trend` / `comparison` 實際透過 `withCityFilter` 有完整認證；真正裸奔的是 `pricing` 與 `pricing/[id]` 兩檔共 4 個 handler（GET/POST/GET/PATCH），且全局 middleware 排除 `/api` 路徑、service 層也無權限檢查，三層皆無防護。
2. **`withCityFilter` 中間件本身設計良好**：認證、無城市授權拒絕（403）、`validateRequestedCities` 對非管理員嚴格比對，城市資料隔離（Epic 6 三層防護之 API 層）在本區域落實一致。`reports/jobs/[jobId]` 的擁有者過濾（`where: { id, userId }`）與月度報告簽名下載 URL（1 小時過期）皆正確。
3. **輸入驗證呈兩代風格**：Epic 7 前期檔案（reports/city-cost、reports/regional 系列）用手寫 `searchParams.get()` + 手動 if 檢查，後期檔案（dashboard、statistics、cost/city-* 系列）用 Zod。手寫驗證的檔案同時也是回傳 `error.message` 的檔案（RPT-004），品質相關性明顯 — 建議將這批 Epic 7 報表端點統一遷移到 Zod + 固定錯誤訊息。
4. **分頁與範圍上限普遍缺失**：本區域多為聚合統計查詢，單次成本高，但 limit / 日期跨度 / 城市數量普遍無上限（RPT-005/008/009），疊加「全域無 rate limit 中間件」的已知缺口，DoS 面偏大。
5. **SQL 注入面乾淨**：本區域所有 raw SQL（analytics/city-comparison、analytics/global 共 4 處 `$queryRaw`）均為 tagged template 參數化，未發現 `$queryRawUnsafe` / 字串拼接，無 FIX-051 型回歸。
