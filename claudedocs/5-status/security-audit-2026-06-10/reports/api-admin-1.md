# 安全審查報告 — API Admin 管理端（第 1 組）

> 審查日期：2026-06-10 | Scope：scopes/api-admin-1.txt | Agent：api-admin-1

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/admin/historical-data/files/[id]/skip/route.ts | 153 | ✅ |
| 2 | src/app/api/admin/historical-data/files/bulk/route.ts | 250 | ✅ |
| 3 | src/app/api/admin/historical-data/files/route.ts | 233 | ✅ |
| 4 | src/app/api/admin/historical-data/upload/route.ts | 320 | ✅ |
| 5 | src/app/api/admin/integrations/n8n/webhook-configs/[id]/history/route.ts | 138 | ✅ |
| 6 | src/app/api/admin/integrations/n8n/webhook-configs/[id]/route.ts | 334 | ✅ |
| 7 | src/app/api/admin/integrations/n8n/webhook-configs/[id]/test/route.ts | 106 | ✅ |
| 8 | src/app/api/admin/integrations/n8n/webhook-configs/route.ts | 259 | ✅ |
| 9 | src/app/api/admin/integrations/outlook/[configId]/route.ts | 287 | ✅ |
| 10 | src/app/api/admin/integrations/outlook/[configId]/rules/[ruleId]/route.ts | 201 | ✅ |
| 11 | src/app/api/admin/integrations/outlook/[configId]/rules/reorder/route.ts | 117 | ✅ |
| 12 | src/app/api/admin/integrations/outlook/[configId]/rules/route.ts | 204 | ✅ |
| 13 | src/app/api/admin/integrations/outlook/[configId]/test/route.ts | 109 | ✅ |
| 14 | src/app/api/admin/integrations/outlook/route.ts | 214 | ✅ |
| 15 | src/app/api/admin/integrations/outlook/test/route.ts | 105 | ✅ |
| 16 | src/app/api/admin/integrations/sharepoint/[configId]/route.ts | 305 | ✅ |
| 17 | src/app/api/admin/integrations/sharepoint/[configId]/test/route.ts | 109 | ✅ |
| 18 | src/app/api/admin/integrations/sharepoint/route.ts | 227 | ✅ |
| 19 | src/app/api/admin/integrations/sharepoint/test/route.ts | 116 | ✅ |
| 20 | src/app/api/admin/logs/[id]/related/route.ts | 132 | ✅ |
| 21 | src/app/api/admin/logs/[id]/route.ts | 110 | ✅ |
| 22 | src/app/api/admin/logs/export/[id]/route.ts | 139 | ✅ |
| 23 | src/app/api/admin/logs/export/route.ts | 143 | ✅ |
| 24 | src/app/api/admin/logs/route.ts | 181 | ✅ |
| 25 | src/app/api/admin/logs/stats/route.ts | 125 | ✅ |
| 26 | src/app/api/admin/logs/stream/route.ts | 148 | ✅ |
| 27 | src/app/api/admin/n8n-health/changes/route.ts | 135 | ✅ |
| 28 | src/app/api/admin/n8n-health/history/route.ts | 155 | ✅ |
| 29 | src/app/api/admin/n8n-health/route.ts | 250 | ✅ |
| 30 | src/app/api/admin/performance/export/route.ts | 170 | ✅ |
| 31 | src/app/api/admin/performance/route.ts | 111 | ✅ |
| 32 | src/app/api/admin/performance/slowest/route.ts | 179 | ✅ |
| 33 | src/app/api/admin/performance/timeseries/route.ts | 151 | ✅ |
| 34 | src/app/api/admin/restore/[id]/logs/route.ts | 68 | ✅ |
| 35 | src/app/api/admin/restore/[id]/rollback/route.ts | 111 | ✅ |
| 36 | src/app/api/admin/restore/[id]/route.ts | 134 | ✅ |
| 37 | src/app/api/admin/restore/route.ts | 230 | ✅ |
| 38 | src/app/api/admin/restore/stats/route.ts | 63 | ✅ |
| 39 | src/app/api/admin/retention/archives/route.ts | 318 | ✅ |
| 40 | src/app/api/admin/retention/deletion/[requestId]/approve/route.ts | 224 | ✅ |
| 41 | src/app/api/admin/retention/deletion/route.ts | 306 | ✅ |
| 42 | src/app/api/admin/retention/metrics/route.ts | 107 | ✅ |
| 43 | src/app/api/admin/retention/policies/[id]/route.ts | 343 | ✅ |
| 44 | src/app/api/admin/retention/policies/route.ts | 288 | ✅ |
| 45 | src/app/api/admin/retention/restore/route.ts | 312 | ✅ |
| 46 | src/app/api/admin/roles/[id]/route.ts | 409 | ✅ |
| 47 | src/app/api/admin/roles/route.ts | 235 | ✅ |
| 48 | src/app/api/admin/settings/[key]/route.ts | 280 | ✅ |
| 49 | src/app/api/admin/settings/route.ts | 202 | ✅ |
| 50 | src/app/api/admin/term-analysis/route.ts | 172 | ✅ |
| 51 | src/app/api/admin/users/[id]/route.ts | 392 | ✅ |
| 52 | src/app/api/admin/users/[id]/status/route.ts | 203 | ✅ |
| 53 | src/app/api/admin/users/route.ts | 295 | ✅ |

**輔助交叉確認檔案**（非 scope 內，僅讀取以判斷上下文）：
- src/middleware.ts（確認 /api 不受全域認證保護）
- src/lib/auth.ts（`getAuthSession` 與 `X-Dev-Bypass-Auth` 機制、`isDevelopmentMode()`）
- src/lib/auth/city-permission.ts（`hasPermission` / `checkCityManagePermission` 等）

---

## 2. 發現

### [Critical] ADMIN-1-001 term-analysis 端點完全無認證授權，未授權者可觸發昂貴 AI 操作並讀取歷史術語資料

- **檔案**：src/app/api/admin/term-analysis/route.ts:63（GET）、:130（POST）
- **類別**：A（認證與授權）、K（無 rate limit 的昂貴操作 / DoS）、J（資訊洩漏）
- **描述**：此 `/api/admin/*` 端點的 GET 與 POST handler **完全沒有**任何 `auth()` 檢查或角色檢查（整個檔案未 import `@/lib/auth`）。由於 `src/middleware.ts` 第 91-98 行對所有 `/api` 路徑直接 `NextResponse.next()` 放行（不做認證），此端點對**任何未認證的外部請求**開放。
  - GET 會回傳歷史處理結果中的聚合術語（可依 batchId / companyId 過濾），造成業務資料外洩。
  - POST 直接呼叫 `classifyTerms(terms)`（Azure OpenAI GPT 分類，最多 200 個 term/次），未授權者可無限制觸發，造成 AI 成本濫用 / DoS 面（無 rate limit）。
- **證據**：
  ```ts
  // 檔案頂部 import 完全沒有 auth
  import { aggregateTerms, ... } from '@/services/term-aggregation.service';
  import { classifyTerms, ... } from '@/services/term-classification.service';
  // GET handler 第一行就是解析 query，無任何 session 檢查
  export async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
  // POST handler 同樣直接解析 body 並呼叫 AI
  export async function POST(request: NextRequest) {
      const body = await request.json();
      ...
      const result = await classifyTerms(terms);
  ```
- **建議**：補上與同目錄其他端點一致的 `auth()` 登入檢查 + admin 角色檢查（`isGlobalAdmin || roles 含 GLOBAL_ADMIN`）；POST 額外加上 rate limit。此端點屬 Epic 0 早期實作，疑似遺漏認證。

### [High] ADMIN-1-002 系統設定（System Settings）寫入端點只驗登入、未驗 admin 角色，低權限使用者可竄改全系統設定

- **檔案**：src/app/api/admin/settings/route.ts:131（PATCH 批次更新）；src/app/api/admin/settings/[key]/route.ts:145（PUT）、:234（DELETE）
- **類別**：A（認證與授權 — 越權 / 缺 admin 角色檢查）
- **描述**：這三個寫入端點只檢查 `session?.user`（已登入即可），**未檢查任何 admin 角色或權限**。任何已登入的低權限帳號（如 VIEWER / REVIEWER）皆可：
  - PATCH `/api/admin/settings`：批次 upsert 任意 key/value（最多 100 筆）；
  - PUT `/api/admin/settings/[key]`：更新任意設定值；
  - DELETE `/api/admin/settings/[key]`：將任意設定重置為預設值。
  系統設定可能包含影響全系統行為的開關（通知、保留策略、AI 行為等），低權限竄改屬縱深越權。GET（讀取）同樣只驗登入，洩漏面較低但亦不符 admin 端點慣例。
- **證據**：
  ```ts
  // settings/route.ts PATCH（第 132-145 行）只有登入檢查，之後直接進入更新
  const session = await auth()
  if (!session?.user) { /* 401 */ }
  // 無 isGlobalAdmin / roles 檢查
  ...
  const updated = await systemSettingsService.bulkSet(validation.data.settings, session.user.id)
  ```
  ```ts
  // settings/[key]/route.ts PUT（第 149-162 行）同樣只有登入檢查
  const session = await auth()
  if (!session?.user) { /* 401 */ }
  ...
  const setting = await systemSettingsService.set(decodedKey, validation.data.value, undefined, session.user.id)
  ```
- **建議**：補上 admin 角色檢查（與同目錄 logs / n8n-health 等端點的 `isGlobalAdmin || roles?.some(r => r.name === 'GLOBAL_ADMIN')` 一致），寫入操作（PATCH/PUT/DELETE）必須限制 admin。

### [High] ADMIN-1-003 歷史資料管理端點只驗登入、未驗 admin 角色（含實體檔案刪除與本機寫檔）

- **檔案**：src/app/api/admin/historical-data/files/route.ts:44（GET）；src/app/api/admin/historical-data/files/bulk/route.ts:51（POST 批次刪除/改類型）；src/app/api/admin/historical-data/upload/route.ts:83（POST 上傳）
- **類別**：A（認證與授權 — 缺 admin 角色檢查）、H（檔案處理）、K（資料破壞）
- **描述**：這三個 `/api/admin/historical-data/*` 端點只檢查 `session?.user?.id`（已登入即可），未檢查 admin 角色。相較之下，同一功能群組的 `files/[id]/skip/route.ts` 有正確使用 `hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)`，顯示此處為不一致的遺漏。任何已登入的低權限帳號可：
  - GET：列出任意批次內所有歷史檔案（含 metadata、檔名）；
  - bulk POST `action: 'delete'`：批次刪除 DB 記錄並 `fs.unlink` 實體檔案（資料破壞，bulk/route.ts 第 157 行）；
  - upload POST：寫入檔案到伺服器本機磁碟（upload/route.ts 第 234 行 `fs.writeFile`）。
- **證據**：
  ```ts
  // files/bulk/route.ts 第 53-64 行：只有登入檢查
  const session = await auth()
  if (!session?.user?.id) { /* 401 */ }
  // 之後無角色檢查，delete 分支直接 fs.unlink + deleteMany
  await fs.unlink(file.storagePath)   // 第 157 行
  ```
  ```ts
  // upload/route.ts 第 86-87 行：getAuthSession 只驗登入
  const session = await getAuthSession(request)
  if (!session?.user?.id) { /* 401 */ }
  ...
  await fs.writeFile(storagePath, buffer)   // 第 234 行
  ```
- **建議**：補上 admin 角色 / `ADMIN_MANAGE` 權限檢查，與 `skip/route.ts` 一致。

### [High] ADMIN-1-004 `X-Dev-Bypass-Auth` 開發繞過在「Azure AD 未配置」時於生產環境亦會生效，可被冒充全權管理員

- **檔案**：src/lib/auth.ts:392（`getAuthSession`）、:91（`isDevelopmentMode`）；本 scope 受影響端點：historical-data/files/route.ts:47、historical-data/upload/route.ts:86
- **類別**：A（認證繞過）、I（認證機制本身）
- **描述**：`getAuthSession(request)` 在 `isDevelopmentMode()` 為真時，只要請求帶 `X-Dev-Bypass-Auth: true` header，即回傳 `DEV_MOCK_SESSION`（`isGlobalAdmin: true`、`permissions: ['*']`、`cityCodes: ['*']` 的全權管理員）。而 `isDevelopmentMode()` 的條件為 `NODE_ENV === 'development' || !isAzureADConfigured()` — 亦即**只要生產環境的 Azure AD 環境變數缺失或仍是 placeholder（`your-` 開頭），此繞過就會在生產生效**，任何外部請求帶上該 header 即可取得全權管理員 session。本 scope 中 historical-data 的 GET/upload 兩端點使用 `getAuthSession`，直接受此影響（且這兩端點本身又缺 admin 檢查，見 ADMIN-1-003，使影響疊加）。
- **證據**：
  ```ts
  function isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || !isAzureADConfigured()
  }
  ...
  export async function getAuthSession(request?: NextRequest) {
    if (isDevelopmentMode() && request) {
      const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
      if (bypassHeader === 'true') {
        console.log('[Auth] Development mode bypass enabled ...')
        return DEV_MOCK_SESSION   // isGlobalAdmin: true, permissions: ['*']
      }
    }
    return auth()
  }
  ```
- **建議**：將繞過條件嚴格限制為 `NODE_ENV === 'development'`（移除 `|| !isAzureADConfigured()` 的耦合），或改用只有測試環境才有的獨立旗標（如 `ALLOW_DEV_AUTH_BYPASS === 'true'` 且 `NODE_ENV !== 'production'`），確保生產環境永遠無法觸發。屬跨檔案系統性風險，非本 scope 單一端點問題，但於此記錄具體受影響端點。

### [Low] ADMIN-1-005 Outlook 規則更新/刪除/重排序未驗證規則歸屬於 path 的 configId（潛在 IDOR）

- **檔案**：src/app/api/admin/integrations/outlook/[configId]/rules/[ruleId]/route.ts:83（PUT）、:168（DELETE）；rules/reorder/route.ts:82（POST）
- **類別**：A（IDOR — 依 id 操作但未驗證上層擁有者）
- **描述**：這些 handler 取出 path 中的 `configId` 與 `ruleId`，但呼叫 `configService.updateFilterRule(ruleId, ...)` / `deleteFilterRule(ruleId)` / `reorderFilterRules(ruleIds)` 時，僅以 `ruleId`/`ruleIds` 操作，未驗證該規則是否屬於 path 指定的 `configId`。理論上可用 A config 的 URL 去操作 B config 底下的規則。由於這些端點皆需 admin 角色（已正確檢查），實際利用門檻高，僅屬縱深防禦缺層；但若未來放寬權限或多租戶化，會升級為 IDOR。
- **證據**：
  ```ts
  // rules/[ruleId]/route.ts PUT：只取 ruleId，未用 configId 驗證歸屬
  const { ruleId } = await context.params;
  const rule = await configService.updateFilterRule(ruleId, input);
  ```
- **建議**：在 service 層或 handler 加上「該 ruleId 必須屬於 configId」的驗證後再操作。

### [Info] ADMIN-1-006 整合設定端點回傳含 secret（authToken / clientSecret），需確認 service 層有遮罩

- **檔案**：src/app/api/admin/integrations/n8n/webhook-configs/[id]/route.ts:121（GET 回傳 config）、route.ts:139（list）；integrations/sharepoint/[configId]/route.ts:98、sharepoint/route.ts:100；integrations/outlook 同類
- **類別**：D（Secrets 與設定）、E（敏感資料於回應）
- **描述**：Webhook 設定含 `authToken`，SharePoint 設定含 `clientSecret`，這些端點 GET/list 直接回傳 `await service.getById(...)` / `getConfigs(...)` 結果。本次審查僅限本 scope 檔案（route 層），未讀取對應 service（`webhookConfigService`、`SharePointConfigService`、`OutlookConfigService`）以確認其 select 是否已遮罩 secret 欄位。若 service 未遮罩，已登入 admin 即可讀回明文 secret（屬 admin 可見，風險中低，但仍建議遮罩）。
- **建議**：由負責 services 的審查 scope 確認上述 service 的查詢是否排除/遮罩 `authToken`、`clientSecret`、`clientId`、`tenantId` 等欄位；route 層本身無法修補。

### [Info] ADMIN-1-007 retention 與 settings route 檔案頂部誤用 `'use server'` 指令

- **檔案**：retention/archives/route.ts:1、retention/deletion/route.ts:1、retention/deletion/[requestId]/approve/route.ts:1、retention/metrics/route.ts:1、retention/policies/route.ts:1、retention/policies/[id]/route.ts:1、retention/restore/route.ts:1、settings/route.ts:1、settings/[key]/route.ts:1
- **類別**：K（其他 — 框架使用，非直接安全漏洞）
- **描述**：上述 Route Handler 檔案頂部標註了 `'use server'`（Server Actions 指令）。Next.js App Router 的 route.ts 本就在伺服器執行，`'use server'` 在此處語意不正確，可能造成預期外的 action 匯出行為。非安全漏洞，但屬可能引入風險的不當用法，故記為 Info。
- **建議**：移除 route.ts 中的 `'use server'`。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 1 | 3 | 0 | 1 | 3 |

---

## 4. 區域整體觀察

1. **授權檢查存在兩種不一致的「強度」**：本組 53 個端點中，多數（integrations、logs、n8n-health、performance、restore、retention 全系列）皆有正確的 admin 角色檢查（`isGlobalAdmin || roles 含 GLOBAL_ADMIN`，或 restore/retention 用 `isGlobalAdmin`，或 roles 用 `PERMISSIONS.USER_MANAGE`）。但有一群端點只做「登入檢查」而漏掉角色檢查（settings 全部寫入、historical-data 的 files/bulk/upload），以及一個**完全無認證**的端點（term-analysis）。這顯示授權並非以統一 middleware/wrapper 強制，而是每個 handler 手寫，容易遺漏 — 是系統性的脆弱點。

2. **缺乏統一的 admin 授權封裝**：建議引入單一 `requireAdmin(request)` helper（內含 auth + 角色檢查 + 統一 RFC 7807 回應），全部 `/api/admin/*` 端點一律套用，避免再出現逐檔遺漏。目前角色檢查寫法本身也分歧（`isGlobalAdmin` vs `roles.some(name==='GLOBAL_ADMIN')` vs `['GLOBAL_ADMIN','ADMIN','SUPER_USER']` vs `PERMISSIONS.USER_MANAGE` vs `PERMISSIONS.ADMIN_MANAGE`），缺乏一致標準。

3. **`/api` 不受 middleware 保護的前提放大了上述遺漏的後果**：middleware（第 91-98 行）對所有 `/api` 路徑直接放行，因此任何漏掉 `auth()` 的端點即等同對公開網路開放（term-analysis 即為此情況，升級為 Critical）。

4. **輸入驗證整體良好**：除 term-analysis 外，本組端點普遍使用 Zod 驗證 body/query，分頁 limit 多有上限（max 100），未見原始 SQL 拼接或 command injection；historical-data 上傳有副檔名/MIME/大小驗證。主要風險集中在授權層，而非注入層。
