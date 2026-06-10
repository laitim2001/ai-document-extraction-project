# 安全審查報告 — 頁面層 (Pages-0：(auth) + admin 前半)

> 審查日期：2026-06-10 | Scope：scopes/pages-0.txt | Agent：pages-0

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/[locale]/(auth)/auth/error/page.tsx | 135 | ✅ |
| 2 | src/app/[locale]/(auth)/auth/forgot-password/page.tsx | 226 | ✅ |
| 3 | src/app/[locale]/(auth)/auth/login/page.tsx | 193 | ✅ |
| 4 | src/app/[locale]/(auth)/auth/register/page.tsx | 108 | ✅ |
| 5 | src/app/[locale]/(auth)/auth/reset-password/page.tsx | 426 | ✅ |
| 6 | src/app/[locale]/(auth)/auth/verify-email/page.tsx | 290 | ✅ |
| 7 | src/app/[locale]/(auth)/layout.tsx | 33 | ✅ |
| 8 | src/app/[locale]/(dashboard)/admin/alerts/page.tsx | 78 | ✅ |
| 9 | src/app/[locale]/(dashboard)/admin/backup/page.tsx | 88 | ✅ |
| 10 | src/app/[locale]/(dashboard)/admin/companies/review/company-review-content.tsx | 490 | ✅ |
| 11 | src/app/[locale]/(dashboard)/admin/companies/review/page.tsx | 128 | ✅ |
| 12 | src/app/[locale]/(dashboard)/admin/config/page.tsx | 89 | ✅ |
| 13 | src/app/[locale]/(dashboard)/admin/data-templates/[id]/page.tsx | 156 | ✅ |
| 14 | src/app/[locale]/(dashboard)/admin/data-templates/new/page.tsx | 105 | ✅ |
| 15 | src/app/[locale]/(dashboard)/admin/data-templates/page.tsx | 213 | ✅ |
| 16 | src/app/[locale]/(dashboard)/admin/document-preview-test/components/DocumentPreviewTestPage.tsx | 354 | ✅ |
| 17 | src/app/[locale]/(dashboard)/admin/document-preview-test/components/index.ts | 15 | ✅ |
| 18 | src/app/[locale]/(dashboard)/admin/document-preview-test/components/TestFileUploader.tsx | 225 | ✅ |
| 19 | src/app/[locale]/(dashboard)/admin/document-preview-test/components/TestToolbar.tsx | 404 | ✅ |
| 20 | src/app/[locale]/(dashboard)/admin/document-preview-test/page.tsx | 47 | ✅ |
| 21 | src/app/[locale]/(dashboard)/admin/exchange-rates/[id]/page.tsx | 170 | ✅ |
| 22 | src/app/[locale]/(dashboard)/admin/exchange-rates/new/page.tsx | 52 | ✅ |
| 23 | src/app/[locale]/(dashboard)/admin/exchange-rates/page.tsx | 206 | ✅ |
| 24 | src/app/[locale]/(dashboard)/admin/field-definition-sets/[id]/page.tsx | 134 | ✅ |
| 25 | src/app/[locale]/(dashboard)/admin/field-definition-sets/new/page.tsx | 59 | ✅ |
| 26 | src/app/[locale]/(dashboard)/admin/field-definition-sets/page.tsx | 156 | ✅ |
| 27 | src/app/[locale]/(dashboard)/admin/field-mapping-configs/[id]/page.tsx | 392 | ✅ |
| 28 | src/app/[locale]/(dashboard)/admin/field-mapping-configs/new/page.tsx | 239 | ✅ |
| 29 | src/app/[locale]/(dashboard)/admin/field-mapping-configs/page.tsx | 590 | ✅ |
| 30 | src/app/[locale]/(dashboard)/admin/historical-data/files/[fileId]/page.tsx | 196 | ✅ |
| 31 | src/app/[locale]/(dashboard)/admin/historical-data/page.tsx | 428 | ✅ |
| 32 | src/app/[locale]/(dashboard)/admin/integrations/outlook/page.tsx | 435 | ✅ |
| 33 | src/app/[locale]/(dashboard)/admin/monitoring/health/page.tsx | 151 | ✅ |
| 34 | src/app/[locale]/(dashboard)/admin/performance/page.tsx | 73 | ✅ |
| 35 | src/app/[locale]/(dashboard)/admin/pipeline-settings/[id]/page.tsx | 152 | ✅ |
| 36 | src/app/[locale]/(dashboard)/admin/pipeline-settings/new/page.tsx | 51 | ✅ |
| 37 | src/app/[locale]/(dashboard)/admin/pipeline-settings/page.tsx | 186 | ✅ |
| 38 | src/app/[locale]/(dashboard)/admin/prompt-configs/[id]/page.tsx | 196 | ✅ |
| 39 | src/app/[locale]/(dashboard)/admin/prompt-configs/new/page.tsx | 104 | ✅ |
| 40 | src/app/[locale]/(dashboard)/admin/prompt-configs/page.tsx | 224 | ✅ |
| 41 | src/app/[locale]/(dashboard)/admin/reference-numbers/[id]/page.tsx | 141 | ✅ |
| 42 | src/app/[locale]/(dashboard)/admin/reference-numbers/new/page.tsx | 85 | ✅ |
| 43 | src/app/[locale]/(dashboard)/admin/reference-numbers/page.tsx | 196 | ✅ |
| 44 | src/app/[locale]/(dashboard)/admin/roles/page.tsx | 108 | ✅ |
| 45 | src/app/[locale]/(dashboard)/admin/settings/client.tsx | 162 | ✅ |
| 46 | src/app/[locale]/(dashboard)/admin/settings/page.tsx | 39 | ✅ |
| 47 | src/app/[locale]/(dashboard)/admin/template-field-mappings/[id]/page.tsx | 119 | ✅ |
| 48 | src/app/[locale]/(dashboard)/admin/template-field-mappings/new/page.tsx | 87 | ✅ |
| 49 | src/app/[locale]/(dashboard)/admin/template-field-mappings/page.tsx | 35 | ✅ |
| 50 | src/app/[locale]/(dashboard)/admin/term-analysis/page.tsx | 268 | ✅ |
| 51 | src/app/[locale]/(dashboard)/admin/test/extraction-compare/page.tsx | 506 | ✅ |

---

## 2. 發現

### 背景：認證與授權的兩層機制（交叉驗證結果）

審查時交叉確認 `src/middleware.ts` 與 `src/app/[locale]/(dashboard)/layout.tsx`：

- **`src/middleware.ts:71-74`** `isProtectedRoute()` 只把 `/dashboard` 與 `/documents` 列為受保護路由，**`/admin/*` 不在 middleware 的保護清單內**。
- **`src/app/[locale]/(dashboard)/layout.tsx:47-52`** 在 `(dashboard)` 路由組的 layout 以 `auth()` 做伺服器端檢查，未登入 → redirect `/auth/login`。由於所有 `/admin/*` 頁面都在此路由組下，**「是否登入」這層保護存在**。
- 但 **layout 只驗證「登入」，不驗證「admin 角色」**。因此 admin 頁面的**角色授權**完全依賴各頁面自行檢查，而本 scope 多數 admin 頁面沒有角色檢查。

以下發現均以此為前提。

---

### [High] A-01 admin 路由組缺乏統一的角色授權，多數 admin 頁面無頁面層級角色 gate

- **檔案**：src/app/[locale]/(dashboard)/layout.tsx:47-52（僅驗登入）；middleware.ts:71-74（/admin 未列入保護）
- **類別**：A（認證與授權）
- **描述**：`/admin/*` 的角色授權沒有任何集中式機制（middleware 不管、layout 只驗登入）。本 scope 中，**只有少數頁面自行做角色檢查**：
  - 有檢查：`backup`、`config`、`integrations/outlook`（client 端 `isGlobalAdmin`）；`monitoring/health`、`roles`、`companies/review`（伺服器端 `hasPermission`）。
  - **完全無角色檢查**（任何已登入使用者皆可進入）：`alerts`、`performance`、`data-templates`(列表/新增/編輯)、`exchange-rates`(全部)、`field-definition-sets`(全部)、`field-mapping-configs`(全部)、`historical-data`(列表/檔案詳情)、`pipeline-settings`(全部)、`prompt-configs`(全部)、`reference-numbers`(全部)、`settings`、`template-field-mappings`(全部)、`term-analysis`、`document-preview-test`、`test/extraction-compare`。
- **證據**（layout 只驗登入，無角色判斷）：
  ```ts
  // (dashboard)/layout.tsx
  const session = await auth()
  if (!session) { redirect('/auth/login') }   // 無 isGlobalAdmin / role 檢查
  return <DashboardLayout>{children}</DashboardLayout>
  ```
- **建議**：在 `(dashboard)/admin` 增設一層 `layout.tsx` 做集中式 admin 角色 gate（伺服器端 `hasPermission` / `isGlobalAdmin`），或於 middleware 把 `/admin` 納入並做角色判斷。實際資料外洩風險最終取決於各 API 端點是否驗角色（屬其他 scope），但頁面層缺角色 gate 已是 broken access control 的縱深防禦缺層。

---

### [High] A-02 template-field-mappings 伺服器組件直接查 DB 並回傳資料，無角色檢查（具體資料外洩點）

- **檔案**：
  - src/app/[locale]/(dashboard)/admin/template-field-mappings/new/page.tsx:23-67, 69-87
  - src/app/[locale]/(dashboard)/admin/template-field-mappings/[id]/page.tsx:23-38, 40-84, 86-100
- **類別**：A（認證與授權）/ J（資訊洩漏）
- **描述**：與 A-01 多數頁面（client 端呼叫 API 取資料）不同，這兩個頁面是 **Server Component 直接用 Prisma 查詢** `company`、`documentFormat`、`dataTemplate`，再把結果以 props 傳入 client 組件。由於頁面本身**沒有任何角色檢查**（僅靠 layout 驗登入），**任何已登入的低權限使用者**造訪 `/admin/template-field-mappings/new` 或 `/admin/template-field-mappings/[id]` 都能取得全部公司名稱、文件格式、資料模板欄位定義。這是頁面層可直接觸發的越權資料讀取，繞過了 API 層的任何授權。
- **證據**（new/page.tsx，server component 內直接查 DB，無 auth()/hasPermission）：
  ```ts
  async function getFormData() {
    const dataTemplates = await prisma.dataTemplate.findMany({ where: { isActive: true }, ... })
    const companies = await prisma.company.findMany({ where: { status: 'ACTIVE' }, select: { id, name } })
    const documentFormats = await prisma.documentFormat.findMany({ select: { id, name } })
    return { dataTemplates, companies, documentFormats }
  }
  export default async function CreateTemplateFieldMappingPage() {
    const { dataTemplates, companies, documentFormats } = await getFormData()  // 無角色檢查
    ...
  }
  ```
- **建議**：在這兩個頁面（及 `generateMetadata` 內的 `findUnique`）查詢前加入 `auth()` + `hasPermission(...)` 角色檢查，未授權即 `redirect`/`notFound`；或統一交由 A-01 建議的 admin layout gate 處理。

---

### [Medium] A-03 document-preview-test 頁面註解宣稱「ADMIN only 由 middleware 處理」，實際 middleware 並未做角色檢查

- **檔案**：src/app/[locale]/(dashboard)/admin/document-preview-test/page.tsx:13-14, 40-47
- **類別**：A（認證與授權）
- **描述**：頁面 JSDoc 明確標示 `@access ADMIN only` 並在註解寫「權限檢查由 middleware 處理（ADMIN only）」。但交叉確認 `middleware.ts` 後，`/admin/*` 根本不在 `isProtectedRoute` 清單，middleware 也未做任何角色判斷。此為**錯誤的安全假設**：開發者誤以為已有 ADMIN 保護而未在頁面內補檢查，導致此頁（及其上傳/OCR 提取功能）對任何已登入使用者開放。
- **證據**：
  ```ts
  /** @access ADMIN only @route /admin/document-preview-test */
  // 權限檢查由 middleware 處理（ADMIN only）。
  export default function DocumentPreviewTestPageRoute() {
    return <DocumentPreviewTestPage />   // 無任何 auth / role 檢查
  }
  ```
- **建議**：在頁面加入伺服器端角色檢查，並修正誤導性註解；避免「假設上游已保護」的模式擴散。

---

### [Medium] A-04 部分 admin 頁面採 client 端 `useSession` 角色檢查，屬 UX 級別、非真正安全邊界

- **檔案**：
  - src/app/[locale]/(dashboard)/admin/backup/page.tsx:50-69
  - src/app/[locale]/(dashboard)/admin/config/page.tsx:51-70
  - src/app/[locale]/(dashboard)/admin/integrations/outlook/page.tsx:85-135
- **類別**：A（認證與授權）
- **描述**：這三頁用 client 端 `useSession()` 判斷 `isGlobalAdmin` 後 `redirect`。client 端 redirect 只是介面導向，可被停用 JS / 直接呼叫底層 API 繞過；真正的資料保護仍須落在 API。這比「完全無檢查」好，但**不應被視為授權邊界**。其中 `outlook` 頁處理 `clientSecret` 等機敏欄位（見 D-01），更需伺服器端把關。
- **證據**（config/page.tsx）：
  ```ts
  'use client'
  const { data: session, status } = useSession()
  if (!session.user.isGlobalAdmin) { redirect('/dashboard') }  // client 端，僅 UX
  ```
- **建議**：將 admin 角色檢查上移到伺服器端（layout 或 server component），client 端檢查僅作為輔助 UX。

---

### [Low] D-01 Outlook 連線設定表單在 client 端處理並傳遞 clientSecret / tenantId 等機敏值

- **檔案**：src/app/[locale]/(dashboard)/admin/integrations/outlook/page.tsx:156-216, 252-267
- **類別**：D（Secrets 與設定）
- **描述**：`clientSecret`、`tenantId`、`clientId` 在 client 組件以明文物件組裝後送往 API（建立/更新/測試連線）。值本身來自表單輸入（非硬編碼），且經由自身 API 端點，故風險屬縱深防禦面：機敏值經過 client 記憶體與網路請求，且「測試連線」流程把 secret 直接以 mutation 送出。需確認 API 端點對應 RBAC、傳輸為 HTTPS、且 secret 不被寫入 log（API 層職責）。頁面層本身未把 secret 寫入 log。
- **證據**：
  ```ts
  const input: CreateOutlookConfigInput = { ... clientSecret: data.clientSecret as string, tenantId: data.tenantId as string, ... }
  await createMutation.mutateAsync(input)
  ```
- **建議**：確保此頁有伺服器端 admin gate（見 A-04）；確認對應 API 對 `clientSecret` 做 write-only 處理（不回傳、不入 log）。

---

### [Low] I-01 reset-password 將 token 以未編碼方式拼入查詢字串

- **檔案**：src/app/[locale]/(auth)/auth/reset-password/page.tsx:167
- **類別**：I（認證機制本身）/ J（資訊洩漏）
- **描述**：`fetch(\`/api/auth/verify-reset-token?token=${token}\`)` 直接字串插值，未 `encodeURIComponent`。token 來自 URL 查詢參數，若含特殊字元可能造成參數解析偏差。送往自身端點，風險低；token 出現在前端網路請求 query 亦屬一般密碼重設流程慣例。
- **證據**：
  ```ts
  const response = await fetch(`/api/auth/verify-reset-token?token=${token}`)
  ```
- **建議**：使用 `encodeURIComponent(token)`；或改以 POST body 傳遞 token 以避免出現在 query 與可能的存取日誌。

---

### [Info] J-02 認證錯誤頁開發模式顯示原始 error code；硬編碼支援信箱

- **檔案**：src/app/[locale]/(auth)/auth/error/page.tsx:103-107, 119-124
- **類別**：J（資訊洩漏）/ D
- **描述**：(1) 原始 `error` 字串僅在 `NODE_ENV === 'development'` 顯示，production 不洩漏，屬正確處理，僅記錄為觀察。(2) `mailto:it-support@company.com` 為硬編碼佔位信箱（非機敏），建議改 i18n / 環境設定，但非安全問題。
- **建議**：保持 dev-only 行為；支援信箱改為設定值。

---

### [Info] K-01 historical-data / forgot-password 等的錯誤處理與輸入處理觀察

- **檔案**：src/app/[locale]/(auth)/auth/forgot-password/page.tsx:99-107；src/app/[locale]/(dashboard)/admin/historical-data/page.tsx:259-309
- **類別**：K（其他）
- **描述**：(1) forgot-password 無論成功失敗皆顯示成功訊息（防使用者列舉），為**正確**的安全設計，記錄為正面觀察。(2) historical-data 頁的 `fetch('/api/admin/historical-data/batches/[id]')` 與 `/process` 使用內部 batchId（來自列表資料），URL 由受控值組裝，無使用者自由輸入拼接，無 path traversal/SSRF 疑慮；處理觸發為昂貴操作但有確認對話框與成本估算，rate limit 屬 API 層職責。
- **建議**：無需頁面層變更；確認對應 API 有授權與 rate limit。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 2 | 2 | 2 | 2 |

---

## 4. 區域整體觀察

1. **系統性授權缺口（最重要）**：`/admin/*` 全部位於 `(dashboard)` 路由組，layout 僅以 `auth()` 驗「是否登入」，**不驗 admin 角色**；middleware 也未把 `/admin` 納入保護或做角色判斷。導致本 scope 約 **70%（37/51 個檔案、約 30+ 個 admin 頁面）沒有頁面層級的角色 gate**。多數頁面靠 client 端 API 呼叫取資料，最終保護落在 API 層（其他 scope 審查），但頁面層普遍缺少縱深防禦。

2. **授權模式極不一致**：少數頁面伺服器端 `hasPermission`（health/roles/companies-review）、少數 client 端 `isGlobalAdmin`（backup/config/outlook）、其餘完全無檢查。沒有統一慣例，極易在新增頁面時遺漏（如 A-03 的錯誤假設）。

3. **具體可觸發的資料外洩**：`template-field-mappings` 的 `new` 與 `[id]` 是少數**伺服器組件直接查 DB**的 admin 頁，無角色檢查即把公司/格式/模板資料回傳給任何已登入者（A-02）。其餘 admin 頁多為 client 取數，故無「server prop 直接外洩」問題，但同樣缺角色 gate。

4. **(auth) 路由組整體良好**：登入/註冊/重設密碼/驗證信箱頁設計穩健——forgot-password 防使用者列舉、error 頁 dev-only 顯示 error code、皆以 server component `auth()` 處理已登入重導。僅 reset-password token 未編碼（I-01，Low）為小瑕疵。

5. **無 XSS / 注入面**：本 scope 未見 `dangerouslySetInnerHTML`、未見字串拼接 SQL、未見 client 端 `import prisma`（template-field-mappings 的 prisma 使用發生在 Server Component，正確）；`term-analysis` 以 `URLSearchParams` 組裝導向 URL（已編碼），`historical-data` 的 fetch URL 由受控 id 組裝，皆無使用者自由輸入拼接。

**統一建議**：新增 `src/app/[locale]/(dashboard)/admin/layout.tsx` 做集中式伺服器端 admin 角色 gate，作為所有 admin 頁的縱深防禦底線，並逐頁移除/修正誤導性「由 middleware 保護」註解。
