# 安全審查報告 — Pages 區域（src/app 非 API 頁面/layout 後半）

> 審查日期：2026-06-10 | Scope：scopes/pages-1.txt | Agent：pages-1

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/[locale]/(dashboard)/admin/test/extraction-v2/page.tsx | 594 | ✅ |
| 2 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/ExportTester.tsx | 342 | ✅ |
| 3 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/index.ts | 15 | ✅ |
| 4 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/MappingPreview.tsx | 280 | ✅ |
| 5 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/MatchExecutor.tsx | 357 | ✅ |
| 6 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/ResultViewer.tsx | 383 | ✅ |
| 7 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/TemplateMatchingTestClient.tsx | 211 | ✅ |
| 8 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/TemplateSelector.tsx | 284 | ✅ |
| 9 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/TestDataSelector.tsx | 260 | ✅ |
| 10 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/TestReportGenerator.tsx | 333 | ✅ |
| 11 | src/app/[locale]/(dashboard)/admin/test/template-matching/components/TestWizard.tsx | 160 | ✅ |
| 12 | src/app/[locale]/(dashboard)/admin/test/template-matching/page.tsx | 27 | ✅ |
| 13 | src/app/[locale]/(dashboard)/admin/test/template-matching/types.ts | 191 | ✅ |
| 14 | src/app/[locale]/(dashboard)/admin/users/page.tsx | 117 | ✅ |
| 15 | src/app/[locale]/(dashboard)/audit/query/client.tsx | 153 | ✅ |
| 16 | src/app/[locale]/(dashboard)/audit/query/page.tsx | 72 | ✅ |
| 17 | src/app/[locale]/(dashboard)/companies/[id]/edit/page.tsx | 148 | ✅ |
| 18 | src/app/[locale]/(dashboard)/companies/[id]/formats/[formatId]/page.tsx | 25 | ✅ |
| 19 | src/app/[locale]/(dashboard)/companies/[id]/page.tsx | 74 | ✅ |
| 20 | src/app/[locale]/(dashboard)/companies/[id]/rules/[ruleId]/test/page.tsx | 351 | ✅ |
| 21 | src/app/[locale]/(dashboard)/companies/new/page.tsx | 89 | ✅ |
| 22 | src/app/[locale]/(dashboard)/companies/page.tsx | 300 | ✅ |
| 23 | src/app/[locale]/(dashboard)/dashboard/page.tsx | 155 | ✅ |
| 24 | src/app/[locale]/(dashboard)/documents/[id]/loading.tsx | 43 | ✅ |
| 25 | src/app/[locale]/(dashboard)/documents/[id]/page.tsx | 120 | ✅ |
| 26 | src/app/[locale]/(dashboard)/documents/page.tsx | 298 | ✅ |
| 27 | src/app/[locale]/(dashboard)/documents/upload/page.tsx | 145 | ✅ |
| 28 | src/app/[locale]/(dashboard)/escalations/[id]/page.tsx | 372 | ✅ |
| 29 | src/app/[locale]/(dashboard)/escalations/page.tsx | 243 | ✅ |
| 30 | src/app/[locale]/(dashboard)/global/page.tsx | 203 | ✅ |
| 31 | src/app/[locale]/(dashboard)/layout.tsx | 55 | ✅ |
| 32 | src/app/[locale]/(dashboard)/profile/client.tsx | 405 | ✅ |
| 33 | src/app/[locale]/(dashboard)/profile/page.tsx | 57 | ✅ |
| 34 | src/app/[locale]/(dashboard)/reports/ai-cost/page.tsx | 95 | ✅ |
| 35 | src/app/[locale]/(dashboard)/reports/cost/page.tsx | 92 | ✅ |
| 36 | src/app/[locale]/(dashboard)/reports/monthly/page.tsx | 292 | ✅ |
| 37 | src/app/[locale]/(dashboard)/reports/regional/page.tsx | 106 | ✅ |
| 38 | src/app/[locale]/(dashboard)/review/[id]/page.tsx | 500 | ✅ |
| 39 | src/app/[locale]/(dashboard)/review/page.tsx | 176 | ✅ |
| 40 | src/app/[locale]/(dashboard)/rollback-history/page.tsx | 344 | ✅ |
| 41 | src/app/[locale]/(dashboard)/rules/[id]/edit/page.tsx | 187 | ✅ |
| 42 | src/app/[locale]/(dashboard)/rules/[id]/history/page.tsx | 431 | ✅ |
| 43 | src/app/[locale]/(dashboard)/rules/[id]/page.tsx | 53 | ✅ |
| 44 | src/app/[locale]/(dashboard)/rules/new/page.tsx | 136 | ✅ |
| 45 | src/app/[locale]/(dashboard)/rules/page.tsx | 64 | ✅ |
| 46 | src/app/[locale]/(dashboard)/rules/review/[id]/page.tsx | 82 | ✅ |
| 47 | src/app/[locale]/(dashboard)/rules/review/page.tsx | 422 | ✅ |
| 48 | src/app/[locale]/(dashboard)/template-instances/[id]/page.tsx | 42 | ✅ |
| 49 | src/app/[locale]/(dashboard)/template-instances/page.tsx | 38 | ✅ |
| 50 | src/app/[locale]/docs/examples/page.tsx | 104 | ✅ |
| 51 | src/app/[locale]/docs/page.tsx | 98 | ✅ |
| 52 | src/app/[locale]/layout.tsx | 110 | ✅ |
| 53 | src/app/[locale]/page.tsx | 24 | ✅ |
| 54 | src/app/layout.tsx | 23 | ✅ |
| 55 | src/app/page.tsx | 18 | ✅ |

**總計**：55 檔案，9,738 行，全部完整讀取。

> 輔助交叉確認（非 scope 內檔案，僅供關聯）：`src/middleware.ts`、`src/lib/auth/city-permission.ts`、`src/app/api/test/extraction-v2/route.ts`。

---

## 2. 發現

### [High] PAGES-A-01 admin test 頁面缺乏 admin 角色 gate，任何登入者可存取管理員測試工具

- **檔案**：src/app/[locale]/(dashboard)/admin/test/extraction-v2/page.tsx:152、src/app/[locale]/(dashboard)/admin/test/template-matching/page.tsx:14
- **類別**：A（認證與授權）
- **描述**：兩個 `/admin/test/*` 頁面位於 admin 命名空間下，但頁面層級**完全沒有**任何角色或權限檢查。唯一的保護是 `(dashboard)/layout.tsx` 的 `auth()`（只驗證「是否登入」，見 layout.tsx:47-51），以及 `src/middleware.ts` 的受保護路由判斷。但 middleware 的 `isProtectedRoute()` 只涵蓋 `/dashboard` 與 `/documents` 前綴（middleware.ts:71-74），**不涵蓋 `/admin`**；而 layout 只要登入即放行。對照同目錄的 `admin/users/page.tsx:83` 有 `hasPermission(session.user, PERMISSIONS.USER_VIEW)`，可見 admin 頁面本應有權限 gate。結果：任何已登入的低權限使用者（如 VIEWER）皆可開啟管理員測試工具。`extraction-v2` 頁面會上傳檔案並觸發實際 Azure DI OCR + GPT 提取（會產生雲端費用），`template-matching` 可讀取資料模板與映射規則。
- **證據**：
  ```tsx
  // admin/test/template-matching/page.tsx:14
  export default async function TemplateMatchingTestPage() {
    const t = await getTranslations('templateMatchingTest');  // 無 auth()/hasPermission
  // admin/test/extraction-v2/page.tsx:152
  export default function ExtractionV2TestPage() {            // 'use client'，全程無權限檢查
  ```
- **建議**：在這兩個 admin 頁面（server component 或其資料 API）加入與 `admin/users/page.tsx` 一致的 admin/權限檢查（如 `hasPermission` 或 admin 角色判斷），或在 middleware `isProtectedRoute()` 加上 `/admin` 前綴並對 admin 區域做角色驗證。

### [High] PAGES-A-02 admin test 頁面消費的 `/api/test/extraction-v2` 端點無任何認證（可被未登入者觸發 OCR/GPT）

- **檔案**：src/app/[locale]/(dashboard)/admin/test/extraction-v2/page.tsx:162,207（呼叫端）→ 實際漏洞在 src/app/api/test/extraction-v2/route.ts:136,177（GET/POST，**非本 scope 檔案**）
- **類別**：A（認證與授權）/ K（DoS、成本濫用）
- **描述**：`extraction-v2` 頁面透過 `fetch('/api/test/extraction-v2')`（GET 檢查設定）與 `fetch('/api/test/extraction-v2', { method: 'POST', body: formData })`（POST 上傳檔案執行提取）呼叫測試 API。交叉確認該 API route（`src/app/api/test/extraction-v2/route.ts`）的 `GET`（第 136 行）與 `POST`（第 177 行）函式**完全沒有 `auth()` / session / API key 檢查**；又因 middleware matcher 排除 `/api`（middleware.ts:181），此端點對**未認證**請求完全開放。任何人可直接 POST 任意 PDF/影像，觸發 Azure Document Intelligence OCR + Azure OpenAI GPT 提取，造成雲端費用濫用（成本型 DoS）並取回 OCR/提取結果。
- **證據**：
  ```ts
  // src/app/api/test/extraction-v2/route.ts:177（無 session 檢查即解析上傳檔）
  export async function POST(request: NextRequest): Promise<NextResponse<...>> {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
  ```
- **建議**：此修復需在 API route 檔案進行（屬 API scope agent 範圍），在此記錄供主 session 派發。應對 `/api/test/*` 全部端點加上 `auth()` + admin 角色檢查，或在非開發環境停用測試端點。

### [Medium] PAGES-A-03 companies 詳情/格式頁面無頁面層級權限 gate，僅依賴下游 API

- **檔案**：src/app/[locale]/(dashboard)/companies/[id]/page.tsx:65、src/app/[locale]/(dashboard)/companies/[id]/formats/[formatId]/page.tsx:21
- **類別**：A（認證與授權）
- **描述**：公司詳情頁與格式詳情頁均為極薄的 server component，直接渲染 client view 組件（`ForwarderDetailView` / `FormatDetailView`），**無 `auth()`、無 `hasPermission(FORWARDER_VIEW)`**。對照同模組的 `companies/new/page.tsx:56-61` 與 `companies/[id]/edit/page.tsx:91-96` 都有 `FORWARDER_MANAGE` 檢查，可見檢視類頁面遺漏了 `FORWARDER_VIEW` gate（JSDoc 第 8 行甚至聲稱「需要 FORWARDER_VIEW 權限」但程式未實作）。資料授權完全落在 `/api/companies/[id]` 上；專案 MEMORY 記錄 companies API 認證覆蓋率偏低（0%），形成縱深防禦缺層。
- **證據**：
  ```tsx
  // companies/[id]/page.tsx:65 — 文件註解宣稱「需要使用者認證和 FORWARDER_VIEW 權限」但無任何檢查
  export default async function CompanyDetailPage({ params }: PageProps) {
    const resolvedParams = await params
    return <ForwarderDetailView forwarderId={resolvedParams.id} />
  }
  ```
- **建議**：在頁面 server component 加入 `auth()` + `hasPermission(FORWARDER_VIEW)`，並確認 `/api/companies/[id]` 端點本身有 session + 城市範圍檢查。

### [Medium] PAGES-A-04 global 全域管理儀表板僅做客戶端權限判斷

- **檔案**：src/app/[locale]/(dashboard)/global/page.tsx:68-104
- **類別**：A（認證與授權）
- **描述**：全域管理者儀表板為 `'use client'` 組件，使用 `useSession()` 在客戶端做 `isGlobalAdmin` 判斷並 `redirect('/dashboard')`。權限檢查發生在瀏覽器端，非全域管理員在重定向前頁面仍會短暫掛載並渲染 `GlobalStats` / `GlobalTrend` / `CityRankings` 等會發 API 請求的子組件。若對應的 `/api/analytics/global` 等端點未獨立驗證 `isGlobalAdmin`，全域跨城市統計資料會洩漏給非授權使用者。對照 `reports/regional/page.tsx:48-63` 採 server component 端 `auth()` + 角色檢查，是更安全的做法。
- **證據**：
  ```tsx
  // global/page.tsx:102 — 客戶端 redirect，子組件已掛載
  if (session.user.isGlobalAdmin === false) { redirect('/dashboard') }
  // 隨後渲染 <GlobalStats period={period} /> 等會 fetch 的組件
  ```
- **建議**：改為 server component 在伺服器端驗證 `isGlobalAdmin`，或確保所有全域分析 API 端點皆強制 `isGlobalAdmin`。

### [Medium] PAGES-A-05 報表頁面僅檢查「已登入」，未做角色/城市範圍 gate

- **檔案**：src/app/[locale]/(dashboard)/reports/ai-cost/page.tsx:69-75、src/app/[locale]/(dashboard)/reports/cost/page.tsx:66-72、src/app/[locale]/(dashboard)/reports/monthly/page.tsx:236
- **類別**：A（認證與授權）
- **描述**：`ai-cost` 與 `cost` 報表頁僅檢查 `session?.user`（任何登入者皆通過），未檢查任何成本檢視權限或城市範圍；`monthly` 報表頁為 `'use client'` 且**完全沒有任何認證檢查**，僅靠 dashboard layout 的登入 gate。這些報表含 AI 成本、城市成本與月度成本分攤等敏感營運資料。對照 `reports/regional/page.tsx` 有明確角色 gate，這三頁屬於授權缺層。資料是否隔離取決於下游 API（`/api/dashboard/ai-cost`、`/api/cost/*`、`/api/reports/*`）。
- **證據**：
  ```tsx
  // reports/cost/page.tsx:67-72 — 只檢查登入
  const session = await auth()
  if (!session?.user) { redirect('/auth/login') }
  // reports/monthly/page.tsx:236 — client component，無任何 auth
  export default function MonthlyReportsPage() { ... }
  ```
- **建議**：依業務需求補上對應的成本檢視權限/角色判斷與城市範圍過濾，並確保對應 API 端點做相同檢查。

### [Low] PAGES-E-01 dashboard 開發模式將完整 session 序列化輸出至 DOM

- **檔案**：src/app/[locale]/(dashboard)/dashboard/page.tsx:143-151
- **類別**：E（PII 與日誌）/ J（資訊洩漏）
- **描述**：`process.env.NODE_ENV === 'development'` 時，頁面以 `<pre>{JSON.stringify(session, null, 2)}</pre>` 將整個 session 物件（含 email、roles、permissions、isGlobalAdmin 等）渲染到頁面。僅限開發環境，但若 staging/預覽環境誤設 `NODE_ENV=development`，會把使用者身分與權限資訊暴露在 DOM。
- **證據**：
  ```tsx
  {process.env.NODE_ENV === 'development' && (
    <pre ...>{JSON.stringify(session, null, 2)}</pre>
  )}
  ```
- **建議**：確認部署環境 `NODE_ENV=production`；可考慮移除或改為只顯示非敏感欄位。

### [Low] PAGES-F-01 升級詳情頁以 iframe 直接載入 document.fileUrl

- **檔案**：src/app/[locale]/(dashboard)/escalations/[id]/page.tsx:230-237
- **類別**：F（XSS 與前端）
- **描述**：以 `<iframe src={escalation.document.fileUrl} />` 直接嵌入文件預覽。`fileUrl` 來源為後端 `escalation.document.filePath`（交叉確認 `src/app/api/escalations/[id]/route.ts:227`），屬伺服器控制值，正常情況風險低。但此處未限制協定（未驗證為 http(s)/blob），若上游某處允許使用者控制 filePath，理論上可注入 `javascript:` 或外部惡意 URL 於 iframe。對比 `review/[id]/page.tsx:457` 走受控的 `/api/documents/{id}/blob` 端點，較安全。
- **證據**：
  ```tsx
  {escalation.document.fileUrl ? (
    <iframe src={escalation.document.fileUrl} className="w-full h-full" title="PDF Preview" />
  ```
- **建議**：對 `fileUrl` 做協定白名單（僅允許 http/https/受控 blob 端點），或統一改走 `/api/documents/[id]/blob` 受控代理。

### [Low] PAGES-C-01 規則測試頁直接 JSON.parse URL 查詢參數且無 try/catch

- **檔案**：src/app/[locale]/(dashboard)/companies/[id]/rules/[ruleId]/test/page.tsx:112-115
- **類別**：C（輸入驗證）/ K（健壯性）
- **描述**：`testPattern` 由 URL 查詢參數 `pattern` 經 `JSON.parse(decodeURIComponent(...))` 解析，外層無 `try/catch`，且解析結果直接送往 `/api/rules/.../test`。`JSON.parse` 不會執行程式碼（無 RCE），但格式錯誤輸入會拋出未捕捉例外導致頁面渲染崩潰；解析出的物件未經 Zod 驗證即傳給後端，授權與驗證需仰賴 API 端。
- **證據**：
  ```tsx
  const testPattern = testPatternParam
    ? JSON.parse(decodeURIComponent(testPatternParam))  // 無 try/catch、無 schema 驗證
    : null
  ```
- **建議**：以 `try/catch` 包裹並對解析結果做 Zod schema 驗證；後端 `/api/rules/.../test` 必須對 pattern 做完整驗證。

### [Low] PAGES-H-01 ExportTester 客戶端 CSV 匯出未防公式注入

- **檔案**：src/app/[locale]/(dashboard)/admin/test/template-matching/components/ExportTester.tsx:43-65
- **類別**：H（檔案處理）
- **描述**：`generateCsv()` 對含 `,`/`"`/換行的值做引號轉義，但未處理 CSV 公式注入（值以 `=`、`+`、`-`、`@` 開頭時，Excel 開檔會被當公式執行）。`generateExcelXml()` 有轉義 `&`/`<`/`>`。當前匯出資料來自 mock/測試資料且完全在客戶端產生，影響有限；但若日後此匯出邏輯被複用於真實使用者輸入資料，存在公式注入風險。
- **證據**：
  ```ts
  // ExportTester.tsx:52-58 — 僅處理分隔符與引號，未對 = + - @ 開頭值加前綴
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
  ```
- **建議**：若未來用於真實資料，對以 `= + - @` 開頭的儲存格值加前置單引號或 tab 進行中和。

### [Info] PAGES-A-06 多數頁面為 client component，授權完全依賴下游 API（系統性模式）

- **檔案**：documents/[id]/page.tsx、documents/page.tsx、rules/[id]/page.tsx、rules/page.tsx、escalations/[id]/page.tsx、escalations/page.tsx、template-instances/*、rollback-history/page.tsx 等
- **類別**：A（認證與授權）
- **描述**：此區域大量頁面僅靠 `(dashboard)/layout.tsx` 的登入 gate，本身不做任何權限/城市範圍檢查，所有資料授權落在 React Query 呼叫的 API 端。這是合理的架構模式（前端不應是授權邊界），但代表本區域的實際存取控制強度**完全取決於對應 API 路由**的 auth 覆蓋率。建議 API scope 的審查重點覆蓋這些頁面對應的端點。
- **建議**：無需改頁面；確保對應 API 端點皆有 session + 角色 + 城市範圍檢查即可。

### [Info] PAGES-A-07 部分非授權重定向未帶 locale 前綴

- **檔案**：src/app/[locale]/(dashboard)/rules/review/[id]/page.tsx:72（`redirect('/unauthorized')`）、companies/new/page.tsx:60、companies/[id]/edit/page.tsx:88,95 等（`redirect('/auth/login')` / `redirect('/companies...')`）
- **類別**：A（認證與授權，功能性觀察）
- **描述**：部分 server component 的 `redirect()` 目標未帶 `${locale}` 前綴（對照 `admin/users/page.tsx:79,86` 與 `profile/page.tsx:40` 有帶 locale）。中介層會再補 locale 重導，故非安全漏洞，但 `redirect('/unauthorized')` 指向的路由若不存在可能變成 404 而非清楚的拒絕訊息。屬一致性/UX 問題，非安全風險。
- **建議**：統一改用帶 locale 的重定向路徑並確認 `/unauthorized` 路由存在。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 2 | 3 | 4 | 2 |

---

## 4. 區域整體觀察

1. **頁面層級授權不一致是本區域最系統性的問題**。同一 `admin/` 與 `companies/` 模組內，「寫入/管理」頁面（users、companies new/edit）有正確的 `hasPermission` gate，但「檢視」與「測試」頁面（admin/test/*、companies/[id] detail/formats）卻無任何權限檢查。最嚴重的是 `/admin/test/*` 兩個頁面僅靠登入即可進入，且 middleware 的受保護前綴清單只含 `/dashboard` 與 `/documents`，不含 `/admin`（middleware.ts:71-74）——意味 admin 區域的存取控制完全寄望於各頁/各 API 自行檢查，但實際上 test 頁面沒有檢查。

2. **前端非授權邊界、實際安全取決於 API**。約三分之二的頁面為 client component，授權落在 React Query 呼叫的 API。`global` 與 `reports/monthly` 甚至把權限判斷放在客戶端或完全省略。需與 API scope 審查結果合併評估真實風險，重點端點：`/api/test/extraction-v2`（已確認無 auth）、`/api/companies/[id]`、`/api/analytics/global`、`/api/cost/*`、`/api/dashboard/ai-cost`。

3. **正向觀察**：`audit/query/page.tsx`（角色白名單）、`reports/regional/page.tsx`（server 端角色檢查）、`rules/review/[id]/page.tsx`（RULE_APPROVE 權限）、`admin/users/page.tsx`（USER_VIEW/USER_MANAGE）為正確的 server 端授權範例，可作為修補其他頁面的樣板。未發現硬編碼 secrets、SQL/command injection 或 `dangerouslySetInnerHTML` 等注入問題；FIX-050（auth.config.ts PII log）無回歸跡象（本區域無 console.log email 等情形，僅 dashboard 開發模式 session dump 屬 Low）。
</content>
</invoke>
