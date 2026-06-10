# 安全審查報告 — API Identity（companies / auth / audit / review / roles / history）

> 審查日期：2026-06-10 | Scope：scopes/api-identity.txt | Agent：api-identity 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/audit/logs/route.ts | 83 | ✅ |
| 2 | src/app/api/audit/query/count/route.ts | 130 | ✅ |
| 3 | src/app/api/audit/query/route.ts | 164 | ✅ |
| 4 | src/app/api/audit/reports/[jobId]/download/route.ts | 200 | ✅ |
| 5 | src/app/api/audit/reports/[jobId]/route.ts | 192 | ✅ |
| 6 | src/app/api/audit/reports/[jobId]/verify/route.ts | 187 | ✅ |
| 7 | src/app/api/audit/reports/route.ts | 322 | ✅ |
| 8 | src/app/api/auth/[...nextauth]/route.ts | 26 | ✅ |
| 9 | src/app/api/auth/forgot-password/route.ts | 112 | ✅ |
| 10 | src/app/api/auth/register/route.ts | 194 | ✅ |
| 11 | src/app/api/auth/resend-verification/route.ts | 213 | ✅ |
| 12 | src/app/api/auth/reset-password/route.ts | 145 | ✅ |
| 13 | src/app/api/auth/verify-email/route.ts | 106 | ✅ |
| 14 | src/app/api/auth/verify-reset-token/route.ts | 96 | ✅ |
| 15 | src/app/api/companies/[id]/activate/route.ts | 140 | ✅ |
| 16 | src/app/api/companies/[id]/classified-as-values/route.ts | 155 | ✅ |
| 17 | src/app/api/companies/[id]/deactivate/route.ts | 143 | ✅ |
| 18 | src/app/api/companies/[id]/documents/route.ts | 211 | ✅ |
| 19 | src/app/api/companies/[id]/route.ts | 220 | ✅ |
| 20 | src/app/api/companies/[id]/rules/[ruleId]/route.ts | 283 | ✅ |
| 21 | src/app/api/companies/[id]/rules/route.ts | 481 | ✅ |
| 22 | src/app/api/companies/[id]/stats/route.ts | 175 | ✅ |
| 23 | src/app/api/companies/check-code/route.ts | 121 | ✅ |
| 24 | src/app/api/companies/identify/route.ts | 193 | ✅ |
| 25 | src/app/api/companies/list/route.ts | 127 | ✅ |
| 26 | src/app/api/companies/route.ts | 206 | ✅ |
| 27 | src/app/api/history/[resourceType]/[resourceId]/compare/route.ts | 204 | ✅ |
| 28 | src/app/api/history/[resourceType]/[resourceId]/route.ts | 225 | ✅ |
| 29 | src/app/api/review/[id]/approve/route.ts | 264 | ✅ |
| 30 | src/app/api/review/[id]/correct/route.ts | 384 | ✅ |
| 31 | src/app/api/review/[id]/escalate/route.ts | 309 | ✅ |
| 32 | src/app/api/review/[id]/route.ts | 350 | ✅ |
| 33 | src/app/api/review/route.ts | 224 | ✅ |
| 34 | src/app/api/roles/route.ts | 115 | ✅ |

**輔助交叉確認（非 scope，因 auth 端點委派而閱讀）**：src/middleware.ts（183 行）、src/lib/auth.config.ts（312 行）、src/lib/auth.ts（404 行）、src/lib/token.ts（98 行）、src/lib/password.ts（174 行）。

---

## 2. 發現

### [Critical] I-01 認證 fail-open：Azure AD 未配置時，生產環境降級為「任意 email 無密碼登入 + 全域管理員」

- **檔案**：src/lib/auth.config.ts:129, 135-148；src/lib/auth.ts:91-93, 173-185（由 scope 檔案 src/app/api/auth/[...nextauth]/route.ts 委派）
- **類別**：I（認證機制本身）/ A（授權）
- **描述**：開發模式判斷為 `process.env.NODE_ENV === 'development' || !isAzureADConfigured()`，採用 **OR**。亦即只要 Azure AD 三個環境變數任一缺失、或被設成 `your-/test-/placeholder/mock-/fake-/dummy-` 前綴的值，**即使 `NODE_ENV=production`** 也會進入開發模式。開發模式的 Credentials `authorize` 對任何含 `@` 的 email **不檢查密碼**即回傳 `id: 'dev-user-1'`；JWT callback 進一步賦予該 token `permissions: ['*']`、`isGlobalAdmin: true`、`cityCodes: ['*']`。註解（auth.ts:82）明言「允許在生產環境測試」。配置缺失導致開放最高權限，屬典型 fail-open 反模式。
- **證據**：
  ```ts
  // auth.config.ts:129,135-145
  const isDevelopmentMode = process.env.NODE_ENV === 'development' && !isAzureADConfigured()
  if (isDevelopmentMode) {
    if (email.includes('@')) {
      edgeLogger.debug('[Auth] Development mode login', { email })
      return { id: 'dev-user-1', email, name: email.split('@')[0], image: null }
    }
  // auth.ts:91-93
  function isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || !isAzureADConfigured()
  }
  // auth.ts:173-184 → token.roles=[{permissions:['*']}], isGlobalAdmin=true, cityCodes=['*']
  ```
  （注意：auth.config.ts 的 `isDevelopmentMode` 用 `&&`，auth.ts 用 `||` — 兩處判斷不一致本身亦為風險。）
- **建議**：生產環境（`NODE_ENV=production`）一律禁用開發模式登入；`isDevelopmentMode` 統一只認 `NODE_ENV !== 'production'`，且 Azure AD 未配置應 fail-closed（拒絕登入並報錯），而非授予管理員。

### [High] A-01 /companies/[id]/classified-as-values 完全無認證檢查

- **檔案**：src/app/api/companies/[id]/classified-as-values/route.ts:64-137
- **類別**：A（認證/授權）
- **描述**：此 GET handler 全程**未呼叫 `auth()`**，亦無任何權限檢查。配合 middleware 對所有 `/api` 路由直接放行（見區域觀察），未認證者只要枚舉任意 `companyId`，即可取得該公司最近 50 筆提取結果中所有 `lineItems[].classifiedAs` 去重值（費用分類等業務資料）。同目錄其他端點（documents/stats/rules）都有 `auth()` + `hasPermission(FORWARDER_VIEW)`，此端點為明顯缺漏。
- **證據**：
  ```ts
  export async function GET(request, { params }) {
    let companyId = '';
    try {
      const { id } = await params; companyId = id;
      // 直接驗證參數、查 DB，全程無 auth() / 權限檢查
      const extractionResults = await prisma.extractionResult.findMany({ where: { document: { companyId } }, ... })
  ```
- **建議**：加入 `auth()` session 檢查與 `FORWARDER_VIEW` 權限檢查，與同目錄端點對齊。

### [High] I-02 X-Dev-Bypass-Auth header 後門在 Azure AD 未配置時於生產可用

- **檔案**：src/lib/auth.ts:392-404（getAuthSession）
- **類別**：I / A
- **描述**：`getAuthSession()` 在 `isDevelopmentMode()` 為真且請求帶 `X-Dev-Bypass-Auth: true` header 時，直接回傳全域管理員 `DEV_MOCK_SESSION`（permissions `['*']`、isGlobalAdmin true）。由於 `isDevelopmentMode()` 含 `|| !isAzureADConfigured()`（同 I-01），生產環境若 Azure AD 未配置，任何帶此 header 的請求即可繞過認證取得管理員 session。影響範圍取決於哪些 route 使用 `getAuthSession`（本 scope 內 route 皆使用 `auth()`，未直接受影響，但此後門為全域風險）。第 397 行另以 `console.log` 記錄繞過啟用。
- **證據**：
  ```ts
  if (isDevelopmentMode() && request) {
    const bypassHeader = request.headers.get('X-Dev-Bypass-Auth')
    if (bypassHeader === 'true') { console.log(...); return DEV_MOCK_SESSION }
  }
  ```
- **建議**：bypass 僅限 `NODE_ENV !== 'production'`，與 Azure AD 配置狀態解耦；或以一次性的明確旗標（如獨立 env flag）控制，避免「未配置即開後門」。

### [Medium] A-02 companies 寫操作僅驗認證、無角色/權限檢查（越權）

- **檔案**：src/app/api/companies/route.ts:125-153（POST 創建）；src/app/api/companies/[id]/route.ts:102-170（PUT 更新）；src/app/api/companies/[id]/activate/route.ts:38-96（POST）；src/app/api/companies/[id]/deactivate/route.ts:40-99（POST）
- **類別**：A
- **描述**：以上寫入端點只檢查 `session?.user` 是否存在，未檢查任何角色或權限（對比同域 rules 端點有 `RULE_MANAGE`、documents/stats 有 `FORWARDER_VIEW`）。任何已登入的最低權限使用者（含 I-01/I-02 路徑取得的身份）可創建、修改、啟用、停用任意公司主檔，並間接連動映射規則狀態。
- **證據**：companies/route.ts:128-140 僅 `if (!session?.user) → 401`，其後直接 `createCompany`；activate/deactivate/[id] PUT 同模式。
- **建議**：對寫操作加入適當權限（如 `FORWARDER_MANAGE` / `RULE_MANAGE` 或管理員角色）檢查。

### [Medium] A-03 companies 讀取/識別端點僅驗認證、無權限檢查

- **檔案**：src/app/api/companies/route.ts:40-80（GET 列表）；src/app/api/companies/list/route.ts:35-84；src/app/api/companies/check-code/route.ts:34-91；src/app/api/companies/identify/route.ts:81-160
- **類別**：A
- **描述**：四個讀取/識別端點僅檢查登入，無 `FORWARDER_VIEW` 等權限（與同域 documents/stats/rules 不一致）。任何登入者可列舉全部公司主檔、檢查代碼、並對任意 documentId + 任意文字觸發公司識別（identify 會寫入識別結果關聯文件）。敏感度中等，但屬縱深防禦缺層與授權不一致。
- **建議**：補齊 `FORWARDER_VIEW` 檢查；identify 額外確認呼叫者對該 documentId 的存取權。

### [Medium] A-04 review 工作流端點無角色檢查且無城市範圍隔離（IDOR）

- **檔案**：src/app/api/review/route.ts:61-89；src/app/api/review/[id]/route.ts:131-148；src/app/api/review/[id]/approve/route.ts:76-93；src/app/api/review/[id]/correct/route.ts:133-147；src/app/api/review/[id]/escalate/route.ts:84-98
- **類別**：A（IDOR + 缺多城市隔離）
- **描述**：審核列表、詳情與三個寫操作（approve/correct/escalate）僅檢查 `session?.user`，**未檢查角色（如 REVIEWER）亦未做城市過濾**。任何登入者可：(1) 透過 `GET /api/review` 取得所有城市的待審清單；(2) 以任意 `documentId` 讀取審核詳情（含 `fieldMappings` 與 Azure Blob `filePath` URL，review/[id]/route.ts:216）；(3) 核准 / 修正 / 升級任意城市的文件。違反 Epic 6 多城市資料隔離設計，且影響審核合規性。
- **證據**：review/[id]/approve/route.ts:79-90 僅 `if (!session?.user?.id) → 401`，隨後 `prisma.document.findUnique({ where: { id: documentId } })` 無城市/擁有者過濾；其餘端點相同模式。
- **建議**：加入 REVIEWER 角色檢查，並在查詢 document 時依 `session.user.cityCodes` 過濾（或查到後驗證文件所屬城市在使用者可存取範圍內）。

### [Medium] A-05 history 變更歷史/版本比較僅驗認證（IDOR + 敏感變更洩漏）

- **檔案**：src/app/api/history/[resourceType]/[resourceId]/route.ts:72-93；src/app/api/history/[resourceType]/[resourceId]/compare/route.ts:67-88
- **類別**：A（IDOR）
- **描述**：兩端點僅檢查登入，未檢查角色或資源擁有權/城市範圍。任何登入者可指定任意 `resourceType`（user / role / company / mappingRule 等受追蹤模型）+ `resourceId`，取得完整變更歷史、時間線與版本快照，含被追蹤欄位的前後值。可洩漏其他使用者帳號、角色權限、公司設定的變更明細。
- **建議**：依 resourceType 套用對應權限（如查 user/role 變更需 `USER_VIEW`/管理員），並對城市範圍資源做過濾。

### [Medium] A-06 /audit/logs 缺 AUDITOR/GLOBAL_ADMIN 權限檢查（與同域不一致）

- **檔案**：src/app/api/audit/logs/route.ts:38-67
- **類別**：A
- **描述**：本端點僅 `auth()` 檢查登入，**未做 audit 角色檢查**；而同目錄其餘所有 audit 端點（query、query/count、reports*）皆有 `hasAuditAccess`（限 AUDITOR / GLOBAL_ADMIN）。任何登入者可用 `entityType` + `entityId` 查詢任意實體（如 USER、DOCUMENT）的審計歷史。`limit` 以 `parseInt` 取得且無上限（第 50 行）。
- **證據**：audit/logs/route.ts:39-45 僅檢查 `session?.user`；無 `hasAuditAccess`。
- **建議**：補上與其他 audit 端點一致的 AUDITOR/GLOBAL_ADMIN 權限檢查；`limit` 加上限（如最大 100）。

### [Low] K-01 /api/review 無界查詢 + 應用層分頁（DoS 面）

- **檔案**：src/app/api/review/route.ts:108-143
- **類別**：K（無界查詢 / 資源耗用）
- **描述**：因信心度篩選在 JSON 欄位故於應用層進行，handler 先 `findMany` 撈出所有符合 `status=PENDING` 的 ProcessingQueue（**無 take/limit**），再於記憶體 filter 與 slice 分頁。待審佇列龐大時將一次載入全部記錄（含關聯 document/extractionResult），造成記憶體與延遲壓力。
- **建議**：將信心度改為可索引欄位或以 DB 層分頁，至少對 `findMany` 加合理上限。

### [Low] K-02 /auth/resend-verification 使用 in-memory rate limit

- **檔案**：src/app/api/auth/resend-verification/route.ts:36-76
- **類別**：K
- **描述**：速率限制以模組層 `Map` 實作，多實例 / serverless 部署下失效（各實例獨立計數），且重啟即清空。註解亦自承「僅適用單實例」。已知專案 FIX-052 已將主要 rate limit 移至 Upstash Redis，此端點仍為舊式 in-memory，削弱對郵件濫用 / 帳號列舉探測的防護。
- **建議**：改用集中式（Redis）速率限制。

### [Low] A-07 audit reports download / verify 缺報告擁有權檢查（與 GET 不一致）

- **檔案**：src/app/api/audit/reports/[jobId]/download/route.ts:100-125；src/app/api/audit/reports/[jobId]/verify/route.ts:100-123
- **類別**：A
- **描述**：`GET /audit/reports/[jobId]`（route.ts:104-116）有「僅建立者本人或 GLOBAL_ADMIN」擁有權檢查，但 download 與 verify 僅檢查 `hasAuditAccess`（AUDITOR/GLOBAL_ADMIN），未驗證 jobId 是否屬於呼叫者。任一 AUDITOR 可下載 / 驗證其他人建立的報告。考量 AUDITOR 屬高權限審計角色，或為設計意圖，但與 GET 行為不一致。
- **建議**：若報告含跨城市敏感資料，download/verify 亦應比照 GET 加擁有權（或城市範圍）檢查。

### [Info] I-03 認證機制正面確認

- **檔案**：src/lib/token.ts、src/lib/password.ts、src/app/api/auth/*、src/lib/auth.config.ts
- **描述（已驗證良好實踐）**：
  - Token 以 `crypto.randomBytes` 產生（token.ts:35-37），加密安全。
  - 密碼使用 bcryptjs，salt rounds 預設 12（password.ts:21,147）。
  - 帳號列舉防護：forgot-password（一律回傳相同訊息）、resend-verification（不洩漏存在與否）、verify-reset-token（`maskEmail`）、auth.config.ts authorize 合併「帳號不存在 / 密碼錯誤」分支（auth.config.ts:174）。
  - **FIX-050 無回歸**：auth.config.ts 中 email 僅於 `edgeLogger.debug` 輸出（行 139/176/187），登入成功只記錄 `userId`（行 215），未見 plaintext email 的 `console.log`。
- **建議**：維持現狀；確保 production 關閉 debug log level。

### [Info] I-04 reset token 驗證採 DB 字串相等查詢（非常數時間）

- **檔案**：src/app/api/auth/reset-password/route.ts:80-90；verify-reset-token/route.ts:68-77；verify-email/route.ts:50-61
- **類別**：I（時序）
- **描述**：以 `where: { passwordResetToken: token }` 做 DB 相等比對，非常數時間比較。但 token 為 256-bit crypto 隨機且經 DB 索引查詢，實務上時序攻擊不可行，僅記錄為觀察。
- **建議**：無需處理（理論性）。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 1 | 2 | 5 | 3 | 2 |

---

## 4. 區域整體觀察

1. **middleware 完全不保護 API**：src/middleware.ts:91-98 對所有 `/api` 路由 early-return `NextResponse.next()`，且 matcher（第 181 行）以 `(?!api...)` 排除 API。因此**每個 API route 的認證/授權完全自負**，無中介層兜底——這放大了任何單一 route 漏掉 `auth()`（如 A-01）的後果，未認證者可直達。

2. **授權層級嚴重不一致**：同一資源域內，部分端點有細緻權限檢查（companies rules → `RULE_MANAGE`、documents/stats → `FORWARDER_VIEW`、audit query/reports → AUDITOR/GLOBAL_ADMIN），部分僅檢查登入（companies CRUD、review 全部、history、audit/logs），少數完全無檢查（classified-as-values）。此不一致是本區最主要的系統性風險，符合專案已知「auth 覆蓋率約 60%」的描述——本次具體定位了缺口位置。「companies 域 auth 覆蓋率 0%」的舊說法需修正：12 個 companies 端點中僅 1 個（classified-as-values）完全無 `auth()`，其餘 11 個皆有 `auth()`，但多數缺**授權（角色/權限）**層。

3. **多城市資料隔離（Epic 6）在 review / history 域未落實**：session 已載入 `cityCodes`，但 review 與 history 端點查詢時未使用，形成跨城市 IDOR。

4. **認證核心存在 fail-open 設計**：Azure AD 未配置即降級為無密碼管理員登入（I-01）與 header 後門（I-02），且兩處 `isDevelopmentMode` 判斷邏輯（`&&` vs `||`）不一致，是本區風險等級最高之處，建議優先處理。

5. **正面**：auth 子域（register / forgot / reset / verify）的列舉防護、密碼雜湊、token 隨機性與 FIX-050 修復狀態良好；RFC 7807 錯誤格式與 Zod 驗證在多數寫端點落實到位（注意 audit/logs、review 讀端點以手動 parseInt 取代 Zod，屬輕微缺層）。
