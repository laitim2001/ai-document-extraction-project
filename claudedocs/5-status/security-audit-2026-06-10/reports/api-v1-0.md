# 安全審查報告 — API v1 版本化端點（批次 0）

> 審查日期：2026-06-10 | Scope：scopes/api-v1-0.txt | Agent：api-v1-0 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/v1/admin/costs/term-validation/route.ts | 236 | ✅ |
| 2 | src/app/api/v1/admin/terms/validate/route.ts | 233 | ✅ |
| 3 | src/app/api/v1/batches/[batchId]/hierarchical-terms/export/route.ts | 171 | ✅ |
| 4 | src/app/api/v1/batches/[batchId]/hierarchical-terms/route.ts | 95 | ✅ |
| 5 | src/app/api/v1/data-templates/[id]/route.ts | 244 | ✅ |
| 6 | src/app/api/v1/data-templates/available/route.ts | 67 | ✅ |
| 7 | src/app/api/v1/data-templates/route.ts | 179 | ✅ |
| 8 | src/app/api/v1/documents/[id]/match/route.ts | 147 | ✅ |
| 9 | src/app/api/v1/documents/[id]/unmatch/route.ts | 106 | ✅ |
| 10 | src/app/api/v1/documents/match/route.ts | 110 | ✅ |
| 11 | src/app/api/v1/exchange-rates/[id]/route.ts | 262 | ✅ |
| 12 | src/app/api/v1/exchange-rates/[id]/toggle/route.ts | 99 | ✅ |
| 13 | src/app/api/v1/exchange-rates/batch/route.ts | 85 | ✅ |
| 14 | src/app/api/v1/exchange-rates/convert/route.ts | 112 | ✅ |
| 15 | src/app/api/v1/exchange-rates/export/route.ts | 103 | ✅ |
| 16 | src/app/api/v1/exchange-rates/import/route.ts | 117 | ✅ |
| 17 | src/app/api/v1/exchange-rates/route.ts | 172 | ✅ |
| 18 | src/app/api/v1/extraction-v3/test/route.ts | 209 | ✅ |
| 19 | src/app/api/v1/field-definition-sets/[id]/coverage/route.ts | 54 | ✅ |
| 20 | src/app/api/v1/field-definition-sets/[id]/fields/route.ts | 54 | ✅ |
| 21 | src/app/api/v1/field-definition-sets/[id]/route.ts | 148 | ✅ |
| 22 | src/app/api/v1/field-definition-sets/[id]/toggle/route.ts | 54 | ✅ |
| 23 | src/app/api/v1/field-definition-sets/candidates/route.ts | 42 | ✅ |
| 24 | src/app/api/v1/field-definition-sets/resolve/route.ts | 53 | ✅ |
| 25 | src/app/api/v1/field-definition-sets/route.ts | 121 | ✅ |
| 26 | src/app/api/v1/field-mapping-configs/[id]/export/route.ts | 164 | ✅ |
| 27 | src/app/api/v1/field-mapping-configs/[id]/route.ts | 487 | ✅ |
| 28 | src/app/api/v1/field-mapping-configs/[id]/rules/[ruleId]/route.ts | 340 | ✅ |
| 29 | src/app/api/v1/field-mapping-configs/[id]/rules/reorder/route.ts | 168 | ✅ |
| 30 | src/app/api/v1/field-mapping-configs/[id]/rules/route.ts | 245 | ✅ |
| 31 | src/app/api/v1/field-mapping-configs/[id]/test/route.ts | 369 | ✅ |
| 32 | src/app/api/v1/field-mapping-configs/import/route.ts | 344 | ✅ |
| 33 | src/app/api/v1/field-mapping-configs/route.ts | 353 | ✅ |
| 34 | src/app/api/v1/formats/[id]/configs/route.ts | 242 | ✅ |
| 35 | src/app/api/v1/formats/[id]/extracted-fields/route.ts | 280 | ✅ |
| 36 | src/app/api/v1/formats/[id]/files/route.ts | 129 | ✅ |
| 37 | src/app/api/v1/formats/[id]/route.ts | 375 | ✅ |

輔助交叉確認檔案（非 scope，僅供判斷攻擊面）：
- src/middleware.ts（確認 API 路由不經 middleware 認證）
- src/services/mapping/transform-executor.ts（確認 CUSTOM expression 不執行 eval）
- src/services/transform/formula.transform.ts（確認 FORMULA 的 Function() 有白名單防護，且未在本範圍 API 暴露）

## 2. 發現

### [High] V1-0-A-01 全範圍 37 個版本化 API 端點完全無認證與授權檢查（系統性）
- **檔案**：本 scope 全部 37 個 route.ts（涵蓋 GET/POST/PATCH/DELETE 共 60+ handler）
- **類別**：A（認證與授權）
- **描述**：本批次每一個 route handler 都沒有呼叫 `auth()` / `getServerSession()`，也沒有任何角色或城市範圍檢查。同時 `src/middleware.ts` 已將所有 `/api` 路徑排除在認證之外（見下方證據），因此這些端點對**任何未登入的匿名請求者**完全開放。受影響的操作包括：建立/修改/刪除匯率（exchange-rates）、建立/修改/刪除欄位映射配置與規則（field-mapping-configs）、刪除文件格式及其級聯資料（formats/[id] DELETE）、建立/刪除資料模板、批次匹配文件、查詢術語驗證成本與 AI 服務狀態（admin/* 端點）。這代表未授權的資料讀取、竄改與刪除（含 admin 命名空間下的端點）。
- **證據**：

  middleware 明確跳過所有 API 路由（src/middleware.ts:90-98、179-182）：
  ```ts
  if (
    pathname.startsWith('/api') ||  // ← 所有 API 直接放行，不做認證
    ...
  ) {
    return NextResponse.next()
  }
  // ...
  export const config = {
    matcher: ['/((?!api|_next|.*\\..*).*)'],  // ← matcher 也排除 api
  }
  ```
  以 admin 端點為例，handler 第一行即進入業務邏輯，無任何 session 檢查（src/app/api/v1/admin/terms/validate/route.ts:102-107）：
  ```ts
  export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
      const body = await request.json()  // ← 無 auth() 檢查
  ```
  刪除格式（含級聯刪除多張表資料）同樣無認證（src/app/api/v1/formats/[id]/route.ts:263-268）：
  ```ts
  export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const { id } = await params;  // ← 無 auth() 檢查即可級聯刪除
  ```
- **建議**：在每個 handler 開頭加入 `auth()` session 檢查並回傳 401（未登入）；對 `admin/*`、刪除類與寫入類操作再加角色/權限驗證回傳 403。或在 middleware 層為 `/api/v1/*` 補上統一認證（須同時調整 matcher 與第 90-98 行的 API 略過邏輯）。註：`middleware.ts` 的 JSDoc（第 14 行）聲稱「受保護路由：/api/v1/*」，與實際行為矛盾，應一併修正。

### [High] V1-0-A-02 寫入操作硬編碼 `createdById = 'system'`，掩蓋缺認證並污染審計來源
- **檔案**：src/app/api/v1/exchange-rates/route.ts:104-106、src/app/api/v1/exchange-rates/import/route.ts:68-70
- **類別**：A（認證與授權）/ D（設定）
- **描述**：建立與匯入匯率時，建立者一律寫死為字串 `'system'`，並附註解「目前使用固定的 createdById，後續整合認證後替換」。這既證實端點原本就沒有認證，也使所有匿名寫入的審計來源都被偽裝成系統帳號，破壞可追溯性。
- **證據**：
  ```ts
  // exchange-rates/route.ts:104-106
  // 目前使用固定的 createdById，後續整合認證後替換
  const createdById = 'system'
  const item = await createExchangeRate(parsed.data, createdById)
  ```
  ```ts
  // exchange-rates/import/route.ts:68-70
  // 目前使用固定的 createdById，後續整合認證後替換
  const createdById = 'system';
  const result = await importExchangeRates(parsed.data, createdById);
  ```
- **建議**：與 V1-0-A-01 一併修復——取得登入使用者 id 作為 `createdById`，移除硬編碼 `'system'`。

### [Medium] V1-0-K-01 無認證的昂貴 AI／OCR 端點構成成本與 DoS 攻擊面
- **檔案**：src/app/api/v1/extraction-v3/test/route.ts:112-171、src/app/api/v1/admin/terms/validate/route.ts:102-133
- **類別**：K（其他風險 — 無 rate limit 的昂貴操作）/ A
- **描述**：`extraction-v3/test` 接受任意檔案上傳（FormData，無檔案大小/類型/MIME 白名單限制），並直接觸發完整 V3 提取管線（含 GPT 呼叫）；`admin/terms/validate` 接受最多 500 個術語並呼叫 GPT-5.2 分類。兩者皆無認證、無 rate limit。匿名使用者可重複呼叫造成 Azure OpenAI 成本飆升與服務壓垮。`extraction-v3/test` 另允許 `debug=true` 回傳更多內部資訊（stepResults、warnings）。
- **證據**：
  ```ts
  // extraction-v3/test/route.ts:115-121 — 僅檢查 file/cityCode 是否存在，無大小/類型限制
  const file = formData.get('file') as File | null;
  const cityCode = formData.get('cityCode') as string | null;
  const debug = formData.get('debug') === 'true';
  if (!file) { ... }
  ```
- **建議**：加認證；對檔案上傳設定大小上限與 MIME 白名單；對觸發 AI/OCR 的端點套用 rate limit（專案已有 rate-limit.service.ts，但無全域中介層）；test 端點應限制為非生產環境或具特定權限的使用者。

### [Medium] V1-0-A-03 巢狀資源端點缺擁有權／範圍隔離，存在 IDOR 與跨格式資料外洩
- **檔案**：src/app/api/v1/formats/[id]/extracted-fields/route.ts:87-101、src/app/api/v1/formats/[id]/files/route.ts:36-84、src/app/api/v1/formats/[id]/configs/route.ts、src/app/api/v1/field-definition-sets/[id]/* 系列、src/app/api/v1/field-mapping-configs/[id]/* 系列、src/app/api/v1/documents/[id]/match|unmatch
- **類別**：A（IDOR / 城市範圍隔離）
- **描述**：所有以 `[id]` 取得或操作資源的端點都只用 id 直接查 DB，未驗證請求者是否有權存取該資源（無城市範圍、無公司歸屬、無角色檢查）。即使未來補上「是否登入」，仍會留下水平越權：任一登入使用者可用他人/他城市的 formatId、configId、documentId 進行讀取與修改。其中 `formats/[id]/extracted-fields` 還會回傳該公司最近 20 份文件提取結果中的實際欄位值樣本（最多每欄 3 個樣本值），可能洩漏跨公司/跨城市的發票內容。
- **證據**：
  ```ts
  // formats/[id]/extracted-fields/route.ts:88-101
  const results = await prisma.extractionResult.findMany({
    where: { document: { companyId: format.companyId }, status: 'COMPLETED' },
    select: { fieldMappings: true, stage1Result: true },  // ← 含實際欄位值
    take: 20,
  });
  // 之後 accumulateFields 會收集 sampleValues 回傳給呼叫者
  ```
- **建議**：在認證之上，加入資源層級授權——驗證 format/config/document 是否屬於使用者可存取的城市/公司範圍（專案已有 city-access.service.ts、db-context.ts 的 RLS 機制可參考）。

### [Low] V1-0-J-01 錯誤回應直接回傳內部例外訊息，洩漏實作細節
- **檔案**：多處，例如 src/app/api/v1/data-templates/[id]/route.ts:78、154、224；src/app/api/v1/data-templates/route.ts:107；src/app/api/v1/admin/costs/term-validation/route.ts:185-192；src/app/api/v1/admin/terms/validate/route.ts:174-181；src/app/api/v1/formats/[id]/extracted-fields/route.ts:145
- **類別**：J（資訊洩漏）
- **描述**：多個 catch 區塊把 `error.message` 原樣放進回應的 `detail`／`error`，可能洩漏資料庫錯誤、內部訊息或邏輯細節。配合 V1-0-A-01 的無認證，攻擊者可藉錯誤訊息探測系統。data-templates 的 PATCH/DELETE 還用 `errorMessage.includes('系統模版')` 等字串比對來決定 4xx/5xx，屬脆弱判斷且會反映原始訊息。
- **證據**：
  ```ts
  // data-templates/[id]/route.ts:154-167
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const isBusinessError = errorMessage.includes('系統模版') || errorMessage.includes('不可');
  // ...
  detail: errorMessage,  // ← 原始例外訊息回傳給呼叫者
  ```
- **建議**：對外回應使用一般化訊息，詳細 error 僅寫入伺服器日誌；以錯誤碼/型別（而非訊息字串比對）區分業務錯誤與系統錯誤。

### [Low] V1-0-C-01 RFC 7807 錯誤格式不一致（nested vs top-level），部分缺 instance
- **檔案**：data-templates/*（nested `error: {...}`）、field-definition-sets/*（top-level）、formats/*（混用且 files/route.ts:113 用自訂 `{ error, details }`）
- **類別**：C/J（次要）
- **描述**：屬已知系統性差異。本範圍中 data-templates 與 formats 系列把錯誤包在 `error` 物件內（nested），而 field-definition-sets、exchange-rates、field-mapping-configs 多採 top-level RFC 7807。雖非直接漏洞，但格式不一致會讓客戶端錯誤處理與安全監控規則難以統一。
- **建議**：新 API 統一採 top-level RFC 7807（符合專案約定），逐步收斂既有 nested 格式。

### [Info] V1-0-B-01 CUSTOM transform expression 在生產執行器不執行動態代碼（無 RCE）
- **檔案**：src/app/api/v1/field-mapping-configs/[id]/rules/route.ts:44-48、test/route.ts:156-164；交叉確認 src/services/mapping/transform-executor.ts:142-193
- **類別**：B（注入 — 經查證為非問題）
- **描述**：field-mapping rule 的 `CUSTOM` 類型允許使用者提交 `expression` 字串（上限 1000 字元）。經交叉確認，生產執行器 `CustomStrategy` 僅以正則做 `${field}`/`${index}` 字串替換，**不**呼叫 `eval`/`Function`；test 端點亦明確標註「不執行動態代碼（安全考量）」。故此處目前無 RCE 風險。另注意 `src/services/transform/formula.transform.ts:155` 雖使用 `Function()`，但有嚴格白名單 `SAFE_FORMULA_PATTERN`（僅 `\d\s+\-*/.()`）且變數先被替換為數字；且 `FORMULA` 類型不在本範圍 API 的 schema 中暴露。建議保留現有限制，未來若新增 CUSTOM/FORMULA 的真正運算執行路徑，務必維持白名單與沙箱。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 2 | 2 | 2 | 1 |

## 4. 區域整體觀察

- **系統性無認證（最關鍵）**：本批次 37 個 `/api/v1` 端點 **100% 沒有任何 `auth()`／權限檢查**，且 `middleware.ts` 明確將 `/api` 全部排除於認證之外（matcher 與函數內雙重略過）。這代表整個 v1 版本化 API 對匿名請求者開放讀寫刪——這是本區域最嚴重且具普遍性的問題，符合專案已知「auth 覆蓋率約 60%」缺口，但本範圍實測為 0%。
- **middleware 文件與行為不符**：`middleware.ts` JSDoc 聲稱 `/api/v1/*` 為「受保護路由」，實際完全未保護，屬危險的錯誤安全假設，極易讓開發者誤以為已有保護而不在 route 內補檢查。
- **「待整合認證」技術債具體化**：exchange-rates 的 create/import 留有 `createdById = 'system' // 後續整合認證後替換` 註解，顯示認證從一開始就被延後，且已影響審計來源正確性。
- **缺資源層級授權**：即使補上「是否登入」，所有 `[id]` 端點仍缺擁有權/城市範圍檢查，會留下水平越權（IDOR）。建議認證與授權兩層一併設計。
- **正面**：輸入驗證（Zod）覆蓋良好——除少數純讀取端點外，多數 POST/PATCH 皆有 Zod schema 與合理上下限（分頁 limit 上限 100、術語 500、批次 50 等）；DB 操作全採 Prisma 參數化，本範圍未發現 SQL injection；CUSTOM/FORMULA 動態執行已有防護；無硬編碼 secrets/connection string；export 端點檔名以 `encodeURIComponent` 處理。
