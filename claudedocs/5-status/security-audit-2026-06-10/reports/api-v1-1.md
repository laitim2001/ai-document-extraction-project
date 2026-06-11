# 安全審查報告 — /api/v1 版本化 API 路由（第 1 批）

> 審查日期：2026-06-10 | Scope：scopes/api-v1-1.txt | Agent：api-v1-1

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/v1/formats/[id]/terms/route.ts | 71 | ✅ |
| 2 | src/app/api/v1/formats/route.ts | 273 | ✅ |
| 3 | src/app/api/v1/invoices/[taskId]/document/route.ts | 235 | ✅ |
| 4 | src/app/api/v1/invoices/[taskId]/result/fields/[fieldName]/route.ts | 277 | ✅ |
| 5 | src/app/api/v1/invoices/[taskId]/result/route.ts | 289 | ✅ |
| 6 | src/app/api/v1/invoices/[taskId]/status/route.ts | 226 | ✅ |
| 7 | src/app/api/v1/invoices/batch-results/route.ts | 244 | ✅ |
| 8 | src/app/api/v1/invoices/batch-status/route.ts | 214 | ✅ |
| 9 | src/app/api/v1/invoices/route.ts | 603 | ✅ |
| 10 | src/app/api/v1/pipeline-configs/[id]/route.ts | 157 | ✅ |
| 11 | src/app/api/v1/pipeline-configs/resolve/route.ts | 60 | ✅ |
| 12 | src/app/api/v1/pipeline-configs/route.ts | 159 | ✅ |
| 13 | src/app/api/v1/prompt-configs/[id]/route.ts | 352 | ✅ |
| 14 | src/app/api/v1/prompt-configs/route.ts | 342 | ✅ |
| 15 | src/app/api/v1/prompt-configs/test/route.ts | 526 | ✅ |
| 16 | src/app/api/v1/reference-numbers/[id]/route.ts | 280 | ✅ |
| 17 | src/app/api/v1/reference-numbers/export/route.ts | 69 | ✅ |
| 18 | src/app/api/v1/reference-numbers/import/route.ts | 98 | ✅ |
| 19 | src/app/api/v1/reference-numbers/route.ts | 183 | ✅ |
| 20 | src/app/api/v1/reference-numbers/validate/route.ts | 68 | ✅ |
| 21 | src/app/api/v1/regions/[id]/route.ts | 268 | ✅ |
| 22 | src/app/api/v1/regions/route.ts | 163 | ✅ |
| 23 | src/app/api/v1/template-field-mappings/[id]/route.ts | 225 | ✅ |
| 24 | src/app/api/v1/template-field-mappings/resolve/route.ts | 116 | ✅ |
| 25 | src/app/api/v1/template-field-mappings/route.ts | 197 | ✅ |
| 26 | src/app/api/v1/template-instances/[id]/export/route.ts | 202 | ✅ |
| 27 | src/app/api/v1/template-instances/[id]/route.ts | 263 | ✅ |
| 28 | src/app/api/v1/template-instances/[id]/rows/[rowId]/route.ts | 252 | ✅ |
| 29 | src/app/api/v1/template-instances/[id]/rows/route.ts | 255 | ✅ |
| 30 | src/app/api/v1/template-instances/route.ts | 197 | ✅ |
| 31 | src/app/api/v1/template-matching/check-config/route.ts | 132 | ✅ |
| 32 | src/app/api/v1/template-matching/execute/route.ts | 138 | ✅ |
| 33 | src/app/api/v1/template-matching/preview/route.ts | 133 | ✅ |
| 34 | src/app/api/v1/template-matching/validate/route.ts | 129 | ✅ |
| 35 | src/app/api/v1/users/me/locale/route.ts | 207 | ✅ |
| 36 | src/app/api/v1/users/me/password/route.ts | 244 | ✅ |
| 37 | src/app/api/v1/users/me/route.ts | 284 | ✅ |
| 38 | src/app/api/v1/webhooks/[deliveryId]/retry/route.ts | 160 | ✅ |
| 39 | src/app/api/v1/webhooks/route.ts | 221 | ✅ |
| 40 | src/app/api/v1/webhooks/stats/route.ts | 162 | ✅ |

輔助交叉確認檔案（非 scope，僅供佐證）：
- src/middleware.ts（確認 API 路由是否被全域中間件保護）
- src/middlewares/external-api-auth.ts（確認 API Key 認證機制）
- src/types/external-api/validation.ts（確認 URL/callbackUrl 驗證強度）

---

## 2. 發現

### [Critical] A-01 全批 /api/v1 內部管理路由完全缺乏認證/授權

- **檔案**：
  - src/app/api/v1/formats/route.ts（GET/POST）、formats/[id]/terms/route.ts（GET）
  - src/app/api/v1/pipeline-configs/route.ts（GET/POST）、[id]/route.ts（GET/PATCH/DELETE）、resolve/route.ts（GET）
  - src/app/api/v1/prompt-configs/route.ts（GET/POST）、[id]/route.ts（GET/PATCH/DELETE）
  - src/app/api/v1/reference-numbers/route.ts（GET/POST）、[id]/route.ts（GET/PATCH/DELETE）、export/route.ts、import/route.ts、validate/route.ts
  - src/app/api/v1/regions/route.ts（GET/POST）、[id]/route.ts（GET/PATCH/DELETE）
  - src/app/api/v1/template-field-mappings/*（GET/POST/PATCH/DELETE/resolve）
  - src/app/api/v1/template-instances/*（GET/POST/PATCH/DELETE/rows/export）
  - src/app/api/v1/template-matching/*（execute/preview/validate/check-config）
- **類別**：A（認證與授權）
- **描述**：上述全部路由的 handler 內**完全沒有** `auth()` session 檢查、也沒有 `externalApiAuthMiddleware` API Key 檢查，任何人只要能連到伺服器即可呼叫。經交叉確認 `src/middleware.ts` 第 91-98 行——全域中間件對所有 `pathname.startsWith('/api')` 直接 `NextResponse.next()` 放行，且 `matcher` 第 181 行以 `(?!api|...)` 排除整個 `/api`。換言之**沒有任何全域層保護這些 API**，每個 route 必須自行認證，而這一大批 route 都沒做。攻擊者可未授權地：建立/修改/刪除 PromptConfig（直接控制 LLM 提取與分類的系統提示，等同竄改核心三層映射行為）、PipelineConfig（控制處理管線）、ReferenceNumber/Region 主檔（CRUD + 軟刪除）、TemplateInstance/Row（CRUD）、以及匯出業務資料。符合 Critical 定義「可直接被未授權者利用，造成資料外洩 / 篡改」。
- **證據**：
  ```ts
  // src/middleware.ts:91-98 — 全域中間件直接放行所有 /api
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') || ...
  ) {
    return NextResponse.next()
  }
  ```
  ```ts
  // src/app/api/v1/prompt-configs/route.ts:170 — POST 直接讀 body 建立，無任何認證
  export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = createPromptConfigSchema.safeParse(body);
    // ...直接 prisma.promptConfig.create(...) — 全程無 auth()
  ```
  ```ts
  // src/app/api/v1/regions/[id]/route.ts:187 — DELETE 無認證即可刪除地區主檔
  export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id } = await params
    await deleteRegion(id)   // 無 session/權限檢查
  ```
- **建議**：在每個 handler 起始加入 `auth()` session 檢查 + 角色/權限驗證（如 RULE_MANAGE、ADMIN）。或在 `src/middleware.ts` 取消對 `/api/v1`（authNextAuth 受保護端點）的整批放行，改為集中式保護並對少數公開端點明確 allowlist。註：`src/app/api/CLAUDE.md` 與 `src/middleware.ts` JSDoc 都聲稱「/api/v1/* 為受保護路由」，但實際程式碼並未保護——屬文檔與代碼不一致，需一併修正。

---

### [High] K-01 prompt-configs/test 無認證且無速率限制的昂貴 Azure OpenAI 呼叫

- **檔案**：src/app/api/v1/prompt-configs/test/route.ts:275（POST）
- **類別**：A（認證）/ K（DoS、成本濫用）
- **描述**：此端點未做任何認證，卻會（1）接收使用者上傳檔案、（2）將 PDF 以 `scale: 2` 轉成最多 10 張 PNG、（3）以 `max_completion_tokens: 8192` 呼叫真實的 Azure OpenAI GPT Vision。未授權攻擊者可無限次呼叫，造成 Azure OpenAI 帳單暴增（financial DoS）與運算資源耗盡，並等同把公司付費的 LLM/OCR 能力當成免費代理對外提供。無 rate limit 加成放大此風險。
- **證據**：
  ```ts
  // 第 281-283：直接從 formData 取檔案，無 auth
  const formData = await request.formData();
  const configId = formData.get('configId') as string;
  const file = formData.get('file') as File | null;
  // 第 449-458：真實付費 GPT Vision 呼叫
  const response = await client.chat.completions.create({
    model: deploymentName,
    messages: [{ role: 'user', content: contentArray }],
    max_completion_tokens: 8192,
  });
  ```
- **建議**：加入認證 + 權限檢查，並對此端點套用嚴格 rate limit 與每使用者配額。

---

### [Medium] G-01 SSRF：invoices URL 提交與 callbackUrl 僅驗證協定，未阻擋內網/雲端 metadata

- **檔案**：src/app/api/v1/invoices/route.ts:445-457、476-488（URL 提交分支）；佐證 src/types/external-api/validation.ts:72-96（urlSubmissionSchema）、101-127（callbackUrl）
- **類別**：G（SSRF）
- **描述**：URL 提交模式會把使用者提供的 `url` 交給 `invoiceSubmissionService.submitInvoice` 於伺服器端抓取；`callbackUrl` 也會由伺服器主動發送 webhook。兩者的 Zod 驗證**只檢查 protocol 為 http/https**，未阻擋私有網段（10.x/172.16.x/192.168.x/127.0.0.1）、`localhost`、或雲端 metadata 端點（169.254.169.254）。雖然提交端點需要有效 API Key（'submit' 權限），但已認證的低權限呼叫者仍可藉此探測/存取內網服務與雲端 metadata。
- **證據**：
  ```ts
  // validation.ts:77-87 — 僅檢查協定，無主機 allowlist / 私網阻擋
  .refine((url) => {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  }, { message: 'Only HTTP and HTTPS protocols are supported' })
  ```
- **建議**：對伺服器端抓取的 URL 與 callbackUrl 加入主機 allowlist 或 DNS 解析後的私有/保留 IP 阻擋（含重導向後的再次驗證）。

---

### [Medium] A-02 IP 白名單可被 X-Forwarded-For 標頭偽造繞過

- **檔案**：src/app/api/v1/invoices/route.ts（及所有 invoices/webhooks 端點，經由 middleware）；佐證 src/middlewares/external-api-auth.ts:163-175、213-219
- **類別**：A（授權）/ K
- **描述**：API Key 的 `allowedIps` 白名單比對使用 `getClientIpFromRequest`，其值直接取自 `x-forwarded-for` / `x-real-ip` 標頭。這些標頭由客戶端可控，若部署層未由可信反向代理覆寫，攻擊者可任意偽造來源 IP 繞過 IP 白名單；同樣的 IP 也寫入審計日誌（invoices/route.ts:592-595），導致審計來源 IP 不可信。
- **證據**：
  ```ts
  // external-api-auth.ts:213-219
  export function getClientIpFromRequest(request: NextRequest): string {
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'
    );
  }
  ```
- **建議**：僅信任受控反向代理注入的標頭，或改用平台提供的可信來源 IP；於 proxy 層 strip 客戶端傳入的 `x-forwarded-for`。

---

### [Medium] H-01 prompt-configs/test 檔案上傳缺大小限制且 MIME 僅依客戶端宣告

- **檔案**：src/app/api/v1/prompt-configs/test/route.ts:298-323、365-373
- **類別**：H（檔案處理）/ K
- **描述**：上傳檔案的類型驗證僅檢查 `file.type`（由客戶端宣告、可偽造），且**完全沒有檔案大小上限**。檔案被寫入 `os.tmpdir()` 後再進行 PDF→圖片轉換。配合 K-01 的無認證，攻擊者可上傳超大檔案塞滿暫存磁碟，或以宣告為 PDF 的惡意內容餵給 pdf-to-img 觸發資源耗盡。
- **證據**：
  ```ts
  if (!isValidFileType(file.type)) { ... }      // 僅信任 file.type
  // 無 file.size 上限檢查
  await fs.writeFile(tempFilePath, buffer);     // 第 373
  ```
- **建議**：加入檔案大小上限、以實際 magic bytes 驗證類型，並限制 PDF 頁數/轉換解析度。

---

### [Low] J-01 500 錯誤回應外洩內部 error.message

- **檔案**：template-field-mappings/[id]/route.ts:83,161,218、resolve/route.ts:109、route.ts:108,191；template-instances/route.ts:108,190、[id]/route.ts:88,182,256、[id]/rows/route.ts:131,248、[id]/rows/[rowId]/route.ts:153,245、[id]/export/route.ts:195；template-matching/execute/route.ts:130、preview/route.ts:124、validate/route.ts:121、check-config/route.ts:124
- **類別**：J（資訊洩漏）
- **描述**：這些 route 在 500 回應的 `detail` 直接回傳 `error instanceof Error ? error.message : 'Unknown error'`，可能把內部錯誤訊息（含底層服務/資料庫錯誤細節）暴露給呼叫者，協助攻擊者偵察。對照 invoices/webhooks 系列皆回傳固定通用訊息，屬不一致的最佳實踐缺失。
- **證據**：
  ```ts
  // template-instances/route.ts:104-109
  error: { type:'INTERNAL_ERROR', title:'取得實例列表失敗', status:500,
           detail: error instanceof Error ? error.message : 'Unknown error' }
  ```
- **建議**：500 回應一律回傳固定通用訊息，內部細節僅寫入 logger。

---

### [Low] D-01 reference-numbers 建立/匯入硬編碼 createdById = 'system'，欠缺操作者歸屬

- **檔案**：src/app/api/v1/reference-numbers/route.ts:104、import/route.ts:50
- **類別**：A / K（可問責性）
- **描述**：因路由無認證，POST 與 import 以固定字串 `'system'` 作為 `createdById`，無法追蹤真實操作者。與已知 FIX-054（SYSTEM_USER_ID 硬編碼）同類，且程式碼註解亦標明「後續整合認證後替換」尚未完成。配合 A-01 無認證，等於任何人可匿名建立/匯入主檔且無問責記錄。
- **證據**：
  ```ts
  // reference-numbers/route.ts:103-105
  // 目前使用固定的 createdById，後續整合認證後替換
  const createdById = 'system'
  const item = await createReferenceNumber(parsed.data, createdById)
  ```
- **建議**：加入認證後改用 `session.user.id`。

---

### [Low] J-02 prompt-configs/test 失敗回應回傳原始 error.message

- **檔案**：src/app/api/v1/prompt-configs/test/route.ts:500-512
- **類別**：J（資訊洩漏）
- **描述**：catch 區塊將 `error.message` 直接放入回應 `error` 欄位，Azure OpenAI/檔案系統的底層錯誤可能外洩（含部署名稱、路徑等）。
- **證據**：
  ```ts
  const errorMessage = error instanceof Error ? error.message : '測試執行失敗';
  return NextResponse.json({ success:false, error: errorMessage, ... }, { status:500 });
  ```
- **建議**：回傳通用訊息，細節寫入 logger。

---

### [Info] K-02 generateTraceId 使用 Math.random

- **檔案**：src/middlewares/external-api-auth.ts:274-278（被 invoices/webhooks 系列使用）
- **類別**：K
- **描述**：traceId 以 `Math.random()` 產生。traceId 非安全性 token，僅用於日誌關聯，影響有限；但若未來用於任何防猜測用途則需改用 `crypto.randomUUID()`。屬觀察項。
- **建議**：如需不可猜測性，改用 `crypto.randomUUID()`。

---

### [Info] A-03 對照組：認證實作正確的路由（無問題，列出供對照）

- **檔案**：invoices/*（全部，API Key + 速率限制 + 服務層以 apiKey 做擁有者範圍）、webhooks/*（全部，API Key + 服務層傳入 apiKey.id 做擁有者範圍，無 IDOR）、users/me/*（locale/password/route，皆以 `auth()` session 檢查且僅操作 `session.user.id` 自身資料）。
- **描述**：這些端點認證、授權與擁有者範圍處理正確，password 端點使用 `verifyPassword`/`hashPassword`/強度驗證，且阻擋 Azure AD 帳號改密碼，無發現缺陷。作為基準說明專案內已有正確範式，A-01 的缺口屬「未一致套用」。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 1 | 1 | 3 | 3 | 2 |

> 註：A-01 為涵蓋約 28 個 route 檔案的單一系統性 Critical 發現；若以受影響端點計數則遠超 1。

## 4. 區域整體觀察

- **系統性認證缺口（最關鍵）**：本批 40 檔中，invoices（7 檔）、webhooks（3 檔）、users/me（3 檔）共 13 檔有正確認證；其餘約 27 檔（formats、pipeline-configs、prompt-configs、reference-numbers、regions、template-field-mappings、template-instances、template-matching）**完全沒有任何認證**。根因是全域 `src/middleware.ts` 對 `/api` 整批放行，而這批 route 又未自行檢查 session/API Key。這與 MEMORY 記錄的「auth 覆蓋率約 60%」一致，且 `/companies`、`/cost` 等其他區域的 0% 覆蓋為同一模式。**強烈建議集中式 API 認證治理**，而非逐檔補丁。
- **兩套認證範式並存**：對外資料 API（invoices/webhooks）用 `externalApiAuthMiddleware`（API Key）；使用者自助 API（users/me）用 NextAuth `auth()` session。內部管理型 v1 API 兩者皆未採用——應明確歸類並補上 session + 權限檢查。
- **輸入驗證良好**：幾乎所有 POST/PATCH 都有 Zod 驗證，分頁多有上限（formats limit≤100、webhooks limit≤MAX），Prisma 全程參數化，未發現 SQL injection；FIX-051 的 raw query 風險未在本批回歸。輸入驗證面是本批的相對強項。
- **RFC 7807 格式不一致**：pipeline-configs/reference-numbers/regions/prompt-configs 採 top-level 錯誤物件；formats/template-* 系列把錯誤包在 `error` 物件內（nested）；invoices POST 另用 `{ error: { code, message } }` 自有格式。與已知「RFC 7807 漸進統一」議題吻合（非安全問題，僅記錄）。
- **錯誤資訊洩漏集中在 template-* 系列**：該系列習慣回傳 `error.message`，建議統一收斂為通用訊息。
