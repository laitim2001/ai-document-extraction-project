# 安全審查報告 — /api/admin 管理端 API（第 0 組）

> 審查日期：2026-06-10 | Scope：scopes/api-admin-0.txt | Agent：api-admin-0 安全審查 agent

## 前提背景

- `src/middleware.ts` 第 90-98 行明確跳過所有 `/api` 路徑（`if (pathname.startsWith('/api')) return NextResponse.next()`），**`/api/admin` 沒有任何全域認證保護**。每個 route 必須自行驗證認證與授權。
- 本組 53 個 route 中，多數有 `auth()` + admin 角色/權限檢查 + Zod 驗證（良好），但有 **4 個檔案完全缺認證**，另有一批檔案只檢查「是否登入」而不檢查 admin 角色（越權面）。

---

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/admin/alerts/[id]/acknowledge/route.ts | 139 | ✅ |
| 2 | src/app/api/admin/alerts/[id]/resolve/route.ts | 140 | ✅ |
| 3 | src/app/api/admin/alerts/[id]/route.ts | 139 | ✅ |
| 4 | src/app/api/admin/alerts/route.ts | 270 | ✅ |
| 5 | src/app/api/admin/alerts/rules/[id]/route.ts | 304 | ✅ |
| 6 | src/app/api/admin/alerts/rules/[id]/toggle/route.ts | 90 | ✅ |
| 7 | src/app/api/admin/alerts/rules/route.ts | 252 | ✅ |
| 8 | src/app/api/admin/alerts/statistics/route.ts | 86 | ✅ |
| 9 | src/app/api/admin/alerts/summary/route.ts | 92 | ✅ |
| 10 | src/app/api/admin/api-keys/[keyId]/rotate/route.ts | 127 | ✅ |
| 11 | src/app/api/admin/api-keys/[keyId]/route.ts | 321 | ✅ |
| 12 | src/app/api/admin/api-keys/[keyId]/stats/route.ts | 156 | ✅ |
| 13 | src/app/api/admin/api-keys/route.ts | 244 | ✅ |
| 14 | src/app/api/admin/backups/[id]/cancel/route.ts | 74 | ✅ |
| 15 | src/app/api/admin/backups/[id]/preview/route.ts | 83 | ✅ |
| 16 | src/app/api/admin/backups/[id]/route.ts | 126 | ✅ |
| 17 | src/app/api/admin/backups/route.ts | 175 | ✅ |
| 18 | src/app/api/admin/backups/storage/route.ts | 86 | ✅ |
| 19 | src/app/api/admin/backups/summary/route.ts | 55 | ✅ |
| 20 | src/app/api/admin/backup-schedules/[id]/route.ts | 216 | ✅ |
| 21 | src/app/api/admin/backup-schedules/[id]/run/route.ts | 71 | ✅ |
| 22 | src/app/api/admin/backup-schedules/[id]/toggle/route.ts | 70 | ✅ |
| 23 | src/app/api/admin/backup-schedules/route.ts | 177 | ✅ |
| 24 | src/app/api/admin/cities/route.ts | 128 | ✅ |
| 25 | src/app/api/admin/companies/[id]/route.ts | 244 | ✅ |
| 26 | src/app/api/admin/companies/merge/route.ts | 169 | ✅ |
| 27 | src/app/api/admin/companies/pending/route.ts | 120 | ✅ |
| 28 | src/app/api/admin/config/[key]/history/route.ts | 148 | ✅ |
| 29 | src/app/api/admin/config/[key]/reset/route.ts | 183 | ✅ |
| 30 | src/app/api/admin/config/[key]/rollback/route.ts | 195 | ✅ |
| 31 | src/app/api/admin/config/[key]/route.ts | 368 | ✅ |
| 32 | src/app/api/admin/config/export/route.ts | 98 | ✅ |
| 33 | src/app/api/admin/config/import/route.ts | 146 | ✅ |
| 34 | src/app/api/admin/config/reload/route.ts | 92 | ✅ |
| 35 | src/app/api/admin/config/route.ts | 284 | ✅ |
| 36 | src/app/api/admin/document-preview-test/extract/route.ts | 410 | ✅ |
| 37 | src/app/api/admin/health/[serviceName]/route.ts | 193 | ✅ |
| 38 | src/app/api/admin/health/route.ts | 181 | ✅ |
| 39 | src/app/api/admin/historical-data/batches/[batchId]/cancel/route.ts | 168 | ✅ |
| 40 | src/app/api/admin/historical-data/batches/[batchId]/company-stats/route.ts | 237 | ✅ |
| 41 | src/app/api/admin/historical-data/batches/[batchId]/files/retry/route.ts | 215 | ✅ |
| 42 | src/app/api/admin/historical-data/batches/[batchId]/files/skip/route.ts | 170 | ✅ |
| 43 | src/app/api/admin/historical-data/batches/[batchId]/pause/route.ts | 129 | ✅ |
| 44 | src/app/api/admin/historical-data/batches/[batchId]/process/route.ts | 195 | ✅ |
| 45 | src/app/api/admin/historical-data/batches/[batchId]/progress/route.ts | 354 | ✅ |
| 46 | src/app/api/admin/historical-data/batches/[batchId]/resume/route.ts | 128 | ✅ |
| 47 | src/app/api/admin/historical-data/batches/[batchId]/route.ts | 374 | ✅ |
| 48 | src/app/api/admin/historical-data/batches/[batchId]/term-stats/route.ts | 258 | ✅ |
| 49 | src/app/api/admin/historical-data/batches/route.ts | 321 | ✅ |
| 50 | src/app/api/admin/historical-data/files/[id]/detail/route.ts | 281 | ✅ |
| 51 | src/app/api/admin/historical-data/files/[id]/result/route.ts | 242 | ✅ |
| 52 | src/app/api/admin/historical-data/files/[id]/retry/route.ts | 180 | ✅ |
| 53 | src/app/api/admin/historical-data/files/[id]/route.ts | 380 | ✅ |

**總行數：約 9,500 行**

---

## 2. 發現

### [Critical] ADMIN0-01 historical-data/files/[id]/detail 完全無認證，洩漏內部路徑與發票業務資料

- **檔案**：src/app/api/admin/historical-data/files/[id]/detail/route.ts:111
- **類別**：A（認證與授權）、J（資訊洩漏）
- **描述**：GET handler **完全沒有任何 `auth()` 呼叫或權限檢查**。任何未授權者只要知道（或暴力枚舉）一個 fileId（cuid），即可取得歷史文件的完整詳情，包括 `storagePath`（伺服器內部檔案路徑）、`extractionResult`（OCR/LLM 提取的發票業務資料，含供應商、金額、稅號等）、`actualCost`、發行者識別結果。由於 middleware 不保護 `/api`，此端點對網際網路完全開放。
- **證據**：
  ```typescript
  export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse<FileDetailResponse | ErrorResponse>> {
    const resolvedParams = await params;
    const fileId = resolvedParams.id;
    try {
      // ← 直接查詢，無任何 session / 權限檢查
      const file = await prisma.historicalFile.findUnique({
        where: { id: fileId },
        select: { /* ... storagePath, extractionResult ... */ },
      });
  ```
- **建議**：在 handler 開頭加入 `const session = await auth()` 與 admin 角色/權限檢查（與同目錄 `result/route.ts`、`retry/route.ts` 一致）。同時建議不要對外回傳 `storagePath`（內部路徑無前端用途）。

### [Critical] ADMIN0-02 historical-data/batches/[batchId]/company-stats 完全無認證

- **檔案**：src/app/api/admin/historical-data/batches/[batchId]/company-stats/route.ts:73
- **類別**：A（認證與授權）、J（資訊洩漏）
- **描述**：GET handler 完全沒有認證/授權檢查。任何未授權者可透過 batchId 取得批次的公司識別統計（公司名稱、文件數量分佈、匹配類型細分等內部業務資料）。
- **證據**：
  ```typescript
  export async function GET(
    request: NextRequest,
    context: RouteContext
  ): Promise<NextResponse<CompanyStatsResponse | { error: string }>> {
    try {
      const { batchId } = await context.params
      // ← 無 auth()，直接查詢資料庫
      const batch = await prisma.historicalBatch.findUnique({ where: { id: batchId }, ... })
  ```
- **建議**：加入 `auth()` + `hasPermission(session.user, PERMISSIONS.ADMIN_VIEW)`（與同目錄 progress/cancel 一致）。

### [Critical] ADMIN0-03 historical-data/batches/[batchId]/term-stats 完全無認證且 POST 觸發昂貴 LLM 操作

- **檔案**：src/app/api/admin/historical-data/batches/[batchId]/term-stats/route.ts:91（GET）、:154（POST）、:229（DELETE）
- **類別**：A（認證與授權）、K（DoS / 昂貴操作無防護）
- **描述**：GET、POST、DELETE 三個方法全部沒有認證檢查。其中 POST `triggerTermAggregation` 會觸發批次術語聚合，依 `autoClassify` 配置可能呼叫 LLM 進行分類（成本與運算密集）。未授權者可無限觸發此操作，造成成本耗盡與 DoS；DELETE 可未授權刪除聚合結果。
- **證據**：
  ```typescript
  export async function POST(
    request: NextRequest,
    context: RouteContext
  ): Promise<NextResponse<...>> {
    try {
      const { batchId } = await context.params
      // ← 無 auth()
      ...
      const result = await triggerTermAggregation(batchId, body.config)
  ```
- **建議**：三個方法皆加入 `auth()` + `PERMISSIONS.ADMIN_MANAGE`（寫操作）/`ADMIN_VIEW`（讀操作）。

### [Critical] ADMIN0-04 document-preview-test/extract 無認證 + 無檔案大小限制，可耗盡 OCR/LLM 成本

- **檔案**：src/app/api/admin/document-preview-test/extract/route.ts:278
- **類別**：A（認證與授權）、H（檔案處理）、K（DoS / 成本耗盡）、J（資訊洩漏）
- **描述**：POST handler **完全沒有認證檢查**，接受任意 multipart 檔案上傳，直接呼叫 `processPdfWithAzureDI`（Azure Document Intelligence）或 `processImageWithVision`（GPT Vision）。問題複合：
  1. 未授權者可直接呼叫，每次請求都產生真實的 Azure DI / GPT Vision 費用 → 成本耗盡攻擊。
  2. **沒有任何檔案大小限制**（grep 確認無 `file.size` / `MAX_FILE_SIZE` 檢查），可上傳超大檔案放大成本與資源佔用。
  3. `file.type` 驗證僅依賴客戶端宣告的 MIME type（可偽造），且 `fileExtension` 取自使用者檔名直接拼進 temp 路徑。
  4. 500 回應回傳 `errorMessage`（內部錯誤細節洩漏，第 394 行）。

  此端點雖在 admin 目錄下、被受保護的 dashboard 測試頁面使用，但 API 本身不受 middleware 或 route-level 認證保護，可被直接呼叫。
- **證據**：
  ```typescript
  export async function POST(request: NextRequest): Promise<NextResponse<ExtractResponse>> {
    let tempFilePath: string | null = null;
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      // ← 無 auth()；只有 file 存在性與 MIME 白名單檢查，無大小限制
      ...
      extractionResult = await processPdfWithAzureDI(tempFilePath, {});  // 真實付費 API
  ```
- **建議**：加入 `auth()` + admin 權限檢查；加入檔案大小上限（如 ≤ 20MB）；500 回應改用通用訊息不回傳 `errorMessage`。若此為純測試端點，生產環境應停用或以環境變數 gate。

### [High] ADMIN0-05 historical-data 多個寫操作只檢查「是否登入」未檢查 admin 角色（越權）

- **檔案**：
  - src/app/api/admin/historical-data/batches/route.ts:68（POST 建批次）、:194（GET 列批次）— 用 `getAuthSession`
  - src/app/api/admin/historical-data/batches/[batchId]/route.ts:47（GET）、:186（PATCH）、:295（DELETE 級聯刪文件）— 用 `getAuthSession`
  - src/app/api/admin/historical-data/batches/[batchId]/process/route.ts:40（POST 觸發批次處理）— 用 `getAuthSession`
  - src/app/api/admin/historical-data/files/[id]/route.ts:45（GET）、:132（PATCH）、:276（DELETE，含 `fs.unlink` 刪實體檔）— 用 `auth()`
  - src/app/api/admin/historical-data/files/[id]/result/route.ts:126（GET）— 用 `auth()`
- **類別**：A（認證與授權）
- **描述**：以上 handler 只驗證 `session?.user?.id`（任何已登入用戶皆通過），**沒有任何 admin 角色或權限檢查**。對比同目錄下 cancel/pause/resume/retry/skip 皆有 `hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)`，此處屬授權層缺漏。已登入的最低權限用戶（如 VIEWER）即可：建立/讀取/更新/刪除批次（DELETE 級聯刪除所有關聯文件）、刪除單一文件（含 `fs.unlink` 刪除伺服器實體檔，files/[id]/route.ts:333）、觸發昂貴的批次處理（process 端點啟動 OCR/LLM）。`process`/`batches`/`batches/[batchId]` 還透過 `getAuthSession` 開啟 X-Dev-Bypass-Auth 開發繞過面（見 ADMIN0-06）。
- **證據**（files/[id]/route.ts DELETE）：
  ```typescript
  export async function DELETE(request: NextRequest, context: RouteContext) {
    const session = await auth()
    if (!session?.user?.id) { /* 401 */ }
    // ← 僅檢查登入，無 admin 權限檢查
    ...
    await fs.unlink(file.storagePath)  // 刪除實體檔案
    await prisma.$transaction([ prisma.historicalFile.delete(...), ... ])
  ```
- **建議**：所有 `/api/admin/historical-data/**` 寫操作（POST/PATCH/DELETE）統一加 `hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)`，讀操作加 `ADMIN_VIEW`，與同目錄既有 route 一致。

### [High] ADMIN0-06 getAuthSession 的 X-Dev-Bypass-Auth 開發繞過在「Azure AD 未配置」時於生產環境啟用

- **檔案**：src/lib/auth.ts:392-404（`getAuthSession`）、:91-93（`isDevelopmentMode`）；使用於 process/route.ts:43、batches/route.ts:71/197、batches/[batchId]/route.ts:50/188/297
- **類別**：A（認證與授權）、I（認證機制本身）
- **描述**：`getAuthSession(request)` 在 `isDevelopmentMode()` 為 true 時，若請求帶 `X-Dev-Bypass-Auth: true` header 會回傳一個**完整全域管理員**的模擬 session（`DEV_MOCK_SESSION`，`isGlobalAdmin: true`、`permissions: ['*']`、`cityCodes: ['*']`）。而 `isDevelopmentMode()` 的條件是 `NODE_ENV === 'development' || !isAzureADConfigured()`——意即**只要 Azure AD 環境變數缺失/設成 placeholder（例如生產環境設定錯誤或尚未配置 SSO），即使 `NODE_ENV=production`，此繞過仍會被啟用**。屆時任何匿名請求只要帶上該 header 即可取得全域管理員權限存取所有使用 `getAuthSession` 的端點。
- **證據**：
  ```typescript
  function isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || !isAzureADConfigured()
  }
  export async function getAuthSession(request?: NextRequest) {
    if (isDevelopmentMode() && request) {
      const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
      if (bypassHeader === 'true') {
        console.log('[Auth] Development mode bypass enabled via X-Dev-Bypass-Auth header')
        return DEV_MOCK_SESSION  // 全域管理員
      }
    }
    return auth()
  }
  ```
- **建議**：將繞過條件嚴格限縮為 `process.env.NODE_ENV === 'development'`（移除 `!isAzureADConfigured()` 這條，或為繞過另設專屬旗標如 `ALLOW_DEV_AUTH_BYPASS`），確保任何生產建置下絕不啟用。本檔在本組範圍外（src/lib/auth.ts 非 scope 檔案），但因被本組多個 route 使用，列此以供主 session 彙總。

### [Low] ADMIN0-07 多數 route 在 500 回應中回傳 error.message（內部資訊洩漏，縱深防禦缺層）

- **檔案**（部分代表，全組約 25+ 處）：
  - alerts 系列全部（如 alerts/route.ts:179、alerts/[id]/route.ts:134）：`detail: error instanceof Error ? error.message : ...`
  - backups 系列（backups/route.ts:106、backups/[id]/route.ts:60 等）：`error: error instanceof Error ? error.message : ...`
  - companies 系列（companies/[id]/route.ts:124/239、companies/merge/route.ts:164、companies/pending/route.ts:115）：`details: error instanceof Error ? error.message : String(error)`
  - historical-data 系列（batches/route.ts:175/316、batches/[batchId]/route.ts:170/279/369、process/route.ts:190、files/[id]/route.ts:114/260/375、files/[id]/result/route.ts:237、term-stats/route.ts:128/206/254）
  - health 系列（health/route.ts:103/176、health/[serviceName]/route.ts:188）
- **類別**：J（資訊洩漏）
- **描述**：這些 route 在 500 錯誤時把 `error.message` 直接回傳給客戶端，可能洩漏 Prisma/SQL 錯誤、內部欄位名、堆疊片段等。利用條件需先觸發伺服器錯誤，影響有限，故列 Low。對比之下 api-keys 與 config 系列已採通用訊息（"An unexpected error occurred" / "Failed to ..."），為正確做法。
- **建議**：統一改為通用訊息，內部細節僅 `console.error` 到伺服器日誌。

### [Low] ADMIN0-08 admin 角色判定字串分散、不一致（縱深防禦/維護風險）

- **檔案**：
  - alerts 系列：`isGlobalAdmin || roles.some(r => r.name === 'GLOBAL_ADMIN')`
  - api-keys 系列：部分 `'ADMIN' || 'GLOBAL_ADMIN'`（rotate/[keyId]/stats/POST），列表 GET 僅 `'GLOBAL_ADMIN'`
  - health 系列：`['GLOBAL_ADMIN','ADMIN','SUPER_USER'].includes(r.name)`
  - backups / config 系列：僅 `isGlobalAdmin`
  - companies / historical-data 系列：用 `hasPermission(..., PERMISSIONS.FORWARDER_*/ADMIN_*)`
- **類別**：A（認證與授權）、K（一致性/維護風險）
- **描述**：相同「admin gate」用了 5 種不同寫法與不同可接受角色集合。雖各自正確擋住未授權，但角色名稱以硬編碼字串散落，易因錯字或漏改造成授權漏洞（例如某處誤判 `'ADMIN'` 通過但該角色在系統中其實為更低權限）。屬縱深防禦與可維護性問題。
- **建議**：抽出共用 helper（如 `requireAdmin(session)`）集中角色集合定義，所有 admin route 統一使用。

### [Info] ADMIN0-09 RFC 7807 錯誤格式在本組不一致（top-level vs nested vs 自訂）

- **檔案**：alerts/api-keys/config/health/historical-data(部分) 用 top-level RFC 7807；backups/backup-schedules 用 `{ success:false, error }`；cities/route.ts:54 用 nested `{ success:false, error:{ type,title,status,detail } }`；historical-data 多處用 `{ success:false, error:'...' }`。
- **類別**：（非安全，記錄供參）
- **描述**：與專案已知差異一致（新 API 應採 top-level RFC 7807）。非安全問題，但錯誤格式不一致會影響前端統一錯誤處理。僅供參考。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 4 | 2 | 0 | 2 | 1 |

---

## 4. 區域整體觀察

1. **系統性認證缺口集中在 historical-data 子目錄**：4 個 Critical 中有 3 個（detail、company-stats、term-stats）位於 `historical-data/**`，且該目錄存在「有些 route 嚴格檢查 ADMIN_MANAGE、有些只檢查登入、有些完全不檢查」三種等級並存的不一致，顯示此目錄缺乏統一的授權基線。配合 middleware 不保護 `/api` 的前提，無認證的 route 等同對外完全開放。建議對整個 `historical-data/**` 做一次授權補強並加迴歸測試。

2. **昂貴外部服務（Azure DI / GPT Vision / LLM 聚合）缺乏存取與用量防護**：document-preview-test/extract（無認證、無大小限制）、term-stats POST（無認證觸發聚合）、process（只需登入即可觸發批次 OCR/LLM）三處都能在低/無權限下消耗付費 API，構成成本耗盡與 DoS 面。建議昂貴操作一律要求 admin 權限並加用量/速率限制。

3. **開發繞過機制的生產風險**：`getAuthSession` 的 X-Dev-Bypass-Auth 在「Azure AD 未配置」時也會生效，這在尚未接好 SSO 的生產/預備環境是高風險（任何人帶 header 即拿全域管理員）。雖然 auth.ts 不在本組 scope，但本組有 4 個 route 透過它認證，需主 session 一併治理。

4. **品質兩極**：alerts、api-keys、config、backups、health 系列實作品質高（一致的 auth + admin gate + Zod + 多數通用錯誤訊息，config export 還主動排除 SECRET、敏感值遮罩）。問題幾乎全部集中在 historical-data 與 document-preview-test 兩塊。

5. **未見硬編碼 secrets / SQL injection / command injection / path traversal 的直接利用**：本組所有 DB 操作均走 Prisma 參數化（無 `$queryRawUnsafe`/`$executeRawUnsafe`）；extract 端點雖用使用者檔名拼 temp 路徑，但寫入 `os.tmpdir()` 下的隔離目錄，路徑穿越風險低（仍建議清洗副檔名）。未發現 D（硬編碼 secrets）類問題。
