# 安全審查報告 — API 文件流（Documents / Extraction / Exports / Mapping / Escalations / Corrections）

> 審查日期：2026-06-10 | Scope：scopes/api-docflow.txt | Agent：api-docflow 並行審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/corrections/patterns/[id]/route.ts | 358 | ✅ |
| 2 | src/app/api/corrections/patterns/route.ts | 253 | ✅ |
| 3 | src/app/api/documents/[id]/blob/route.ts | 133 | ✅ |
| 4 | src/app/api/documents/[id]/process/route.ts | 238 | ✅ |
| 5 | src/app/api/documents/[id]/progress/route.ts | 128 | ✅ |
| 6 | src/app/api/documents/[id]/retry/route.ts | 106 | ✅ |
| 7 | src/app/api/documents/[id]/route.ts | 425 | ✅ |
| 8 | src/app/api/documents/[id]/source/route.ts | 108 | ✅ |
| 9 | src/app/api/documents/[id]/trace/report/route.ts | 133 | ✅ |
| 10 | src/app/api/documents/[id]/trace/route.ts | 114 | ✅ |
| 11 | src/app/api/documents/from-outlook/route.ts | 311 | ✅ |
| 12 | src/app/api/documents/from-outlook/status/[fetchLogId]/route.ts | 253 | ✅ |
| 13 | src/app/api/documents/from-sharepoint/route.ts | 405 | ✅ |
| 14 | src/app/api/documents/from-sharepoint/status/[fetchLogId]/route.ts | 244 | ✅ |
| 15 | src/app/api/documents/processing/route.ts | 121 | ✅ |
| 16 | src/app/api/documents/processing/stats/route.ts | 122 | ✅ |
| 17 | src/app/api/documents/route.ts | 112 | ✅ |
| 18 | src/app/api/documents/search/route.ts | 68 | ✅ |
| 19 | src/app/api/documents/sources/stats/route.ts | 61 | ✅ |
| 20 | src/app/api/documents/sources/trend/route.ts | 58 | ✅ |
| 21 | src/app/api/documents/upload/route.ts | 454 | ✅ |
| 22 | src/app/api/escalations/[id]/resolve/route.ts | 390 | ✅ |
| 23 | src/app/api/escalations/[id]/route.ts | 268 | ✅ |
| 24 | src/app/api/escalations/route.ts | 221 | ✅ |
| 25 | src/app/api/exports/multi-city/route.ts | 417 | ✅ |
| 26 | src/app/api/extraction/route.ts | 212 | ✅ |
| 27 | src/app/api/mapping/[id]/route.ts | 80 | ✅ |
| 28 | src/app/api/mapping/route.ts | 178 | ✅ |

輔助驗證（非 scope 內，僅用於確認嚴重度）：
- src/services/document.service.ts（`getDocuments` 城市過濾行為）
- src/services/mapping.service.ts（`getExtractionResult` / `getMappingRules` 過濾行為）
- src/lib/azure/storage.ts（`uploadFile` 檔名清洗）
- src/services/sharepoint-document.service.ts（SharePoint URL → Graph 下載，SSRF 評估）

---

## 2. 發現

### [Critical] DOCFLOW-01 mapping API 完全無認證，可未登入讀取任意文件提取結果並觸發處理

- **檔案**：src/app/api/mapping/[id]/route.ts:28-79；src/app/api/mapping/route.ts:50-105 (POST)、111-177 (GET)
- **類別**：A（認證與授權）、K（DoS）
- **描述**：此 3 個 handler 完全沒有呼叫 `auth()`，亦無任何權限或城市檢查。
  - `GET /api/mapping/[id]`：傳入 documentId（UUID）即可取得該文件完整提取結果。經輔助驗證，`getExtractionResult(documentId)` 僅以 `where: { documentId }` 查詢（mapping.service.ts:409-411），無城市/擁有者過濾。未認證攻擊者只要列舉/取得 UUID 即可外洩發票欄位（金額、供應商、參考編號等敏感業務資料）。
  - `POST /api/mapping`：未認證即可對任意 documentId 觸發 `mapDocumentFields()`（含 LLM/映射昂貴運算），構成資料篡改（覆寫映射結果）與 DoS（成本放大）面。
  - `GET /api/mapping`：未認證即可列出所有映射規則。
- **證據**：
  ```ts
  // mapping/[id]/route.ts — handler 內無 auth()
  export async function GET(request, { params }) {
    const { id } = paramsSchema.parse(resolvedParams);
    const result = await getExtractionResult(id);   // 無認證、無城市檢查
  ```
  ```ts
  // mapping/route.ts POST — handler 內無 auth()
  export async function POST(request: NextRequest) {
    const body = await request.json();
    const validatedData = mapFieldsSchema.parse(body);
    const result = await mapDocumentFields(validatedData.documentId, {...});
  ```
- **建議**：在 3 個 handler 開頭加入 `const session = await auth()` 認證檢查；GET 詳情/POST 處理應加入城市範圍授權（比對 document.cityCode 與使用者 cityAccess）；POST/列表規則建議加上對應權限（如 `INVOICE_CREATE` / `RULE_VIEW`）。需先確認是否有 middleware 對 `/api/mapping` 做保護（本目錄其他端點皆於 handler 內自行驗證，未見全域 middleware 認證，故視為未保護）。

---

### [High] DOCFLOW-02 文件原始來源端點回傳預簽名下載 URL，僅驗認證無城市授權（IDOR）

- **檔案**：src/app/api/documents/[id]/source/route.ts:53-93
- **類別**：A（IDOR）、H（檔案處理）
- **描述**：`GET /api/documents/[id]/source` 只檢查 `session?.user`，未驗證該文件 cityCode 是否在使用者 cityAccess 範圍內。`traceabilityService.getDocumentSource(id)` 回傳含「預簽名 URL（1 小時有效）」。任何已登入的低權限使用者（即使無該城市權限）只要知道 document id，即可取得跨城市原始文件的直接下載連結，繞過城市資料隔離（Epic 6 的核心安全邊界）。比同目錄 `progress/route.ts:92-102` 已正確實作城市檢查，可見此處為遺漏。
- **證據**：
  ```ts
  const session = await auth();
  if (!session?.user) { return 401 }
  const { id } = await context.params;
  const source = await traceabilityService.getDocumentSource(id);  // 無城市授權檢查，含預簽名 URL
  ```
- **建議**：查出 document.cityCode 後比對使用者 cityAccess / GLOBAL_ADMIN，無權限回 403（複用 progress 端點的檢查模式）。

---

### [High] DOCFLOW-03 文件 Blob 串流端點僅驗認證，跨城市文件內容可被讀取（IDOR）

- **檔案**：src/app/api/documents/[id]/blob/route.ts:68-123
- **類別**：A（IDOR）、H（檔案處理）
- **描述**：`GET /api/documents/[id]/blob` 只檢查 `session?.user`，隨後直接 `downloadBlob(document.blobName)` 並把檔案內容串流回客戶端，沒有任何城市/擁有者授權。任何已登入使用者可下載任意文件（含其他城市發票原始檔）。此端點被 `documents/[id]/route.ts:205-207` 設為 `blobUrl` 供前端使用，是實際的文件下載通道，影響面廣。
- **證據**：
  ```ts
  const session = await auth()
  if (!session?.user) { return 401 }
  const document = await prisma.document.findUnique({ where: { id }, select: { blobName, fileName, fileType } })
  const buffer = await downloadBlob(document.blobName)
  return new NextResponse(new Uint8Array(buffer), {...})  // 無城市授權
  ```
- **建議**：查詢時加入 `cityCode`，比對使用者 cityAccess / GLOBAL_ADMIN 後才下載。

---

### [High] DOCFLOW-04 文件列表 API 無城市過濾，已登入者可見全部城市文件

- **檔案**：src/app/api/documents/route.ts:52-99（配合 src/services/document.service.ts:154-195）
- **類別**：A（授權 / 城市隔離）
- **描述**：`GET /api/documents` 僅做認證，呼叫 `getDocuments()` 時**未傳入 cityCode**。經輔助驗證，`getDocuments` 的 `cityCode` 為可選參數，未傳時 where 子句不含城市條件（document.service.ts:169-171 `...(cityCode && { cityCode })`），導致回傳所有城市的文件（含 fileName、status、公司等）。任何已登入使用者（含僅單一城市權限者）可瀏覽全系統文件清單，違反城市資料隔離。
- **證據**：
  ```ts
  // documents/route.ts：呼叫時無 cityCode / cityAccess
  getDocuments({ page, pageSize, status, search, sortBy, sortOrder })
  ```
  ```ts
  // document.service.ts:169-171
  const where: Prisma.DocumentWhereInput = {
    ...(cityCode && { cityCode }),   // 未傳 → 無城市過濾
  ```
- **建議**：route 從 session 取 cityAccess，對非 GLOBAL_ADMIN 以 `cityCode: { in: userCities }` 過濾（需擴充 service 支援城市陣列）。

---

### [High] DOCFLOW-05 來源查詢/統計/趨勢端點接受任意 cityId 無權限驗證（跨城市資料越權）

- **檔案**：src/app/api/documents/search/route.ts:31-60；src/app/api/documents/sources/stats/route.ts:26-48；src/app/api/documents/sources/trend/route.ts:25-46
- **類別**：A（授權 / 城市隔離）、C（輸入驗證）
- **描述**：3 個端點僅驗認證，直接把使用者傳入的 `cityId`（search 另含 senderEmail、subject、sharepointUrl）轉給 service 查詢，無任何城市權限檢查。已登入使用者可指定任意 cityId 越權取得他城市的文件清單與來源統計。`search` 還可用 senderEmail/subject 跨城市搜尋，洩漏寄件者 Email 等資訊。
- **證據**：
  ```ts
  // sources/stats/route.ts
  const cityId = searchParams.get('cityId') || undefined
  const stats = await service.getSourceTypeStats({ cityId, dateFrom, dateTo })  // 無權限比對
  ```
- **建議**：對 cityId 比對使用者 cityAccess；非 GLOBAL_ADMIN 強制以可存取城市為過濾條件（不接受越權 cityId）。

---

### [Medium] DOCFLOW-06 文件處理觸發端點僅驗認證，無城市授權（IDOR + 處理成本放大）

- **檔案**：src/app/api/documents/[id]/process/route.ts:81-237
- **類別**：A（IDOR）、K（DoS / 成本）
- **描述**：`POST /api/documents/[id]/process` 僅檢查 `session?.user?.id`，未驗證 document.cityCode 是否在使用者權限內，即觸發完整 11 步處理管線（含 LLM 呼叫）。任何已登入使用者可對任意文件反覆觸發昂貴處理，並改寫其提取結果與狀態（資料完整性 + AI 成本放大）。狀態雖有 `PROCESSABLE_STATUSES` 限制，但仍可在允許狀態下被越權觸發。
- **證據**：
  ```ts
  const session = await auth();
  if (!session?.user?.id) { return 401 }
  const document = await prisma.document.findUnique({ where: { id: documentId }, select: {...無 cityCode 授權...} })
  // 未檢查城市權限即更新狀態並執行 processor.processFile(...)
  ```
- **建議**：查詢加 cityCode 並比對使用者 cityAccess；考慮限制為具 `INVOICE_CREATE` 或審核權限者。

---

### [Medium] DOCFLOW-07 文件重試端點僅驗認證，無城市授權（IDOR）

- **檔案**：src/app/api/documents/[id]/retry/route.ts:47-104
- **類別**：A（IDOR）、K（成本）
- **描述**：`POST /api/documents/[id]/retry` 只驗 `session?.user`，直接呼叫 `retryProcessing(id)` 重置狀態並重新觸發 OCR，無城市/擁有者授權。已登入使用者可對任意失敗文件越權觸發重試（資料改寫 + 處理成本）。
- **證據**：
  ```ts
  const session = await auth()
  if (!session?.user) { return 401 }
  const { id } = await params
  await retryProcessing(id)   // 無城市授權
  ```
- **建議**：在 route 或 service 內加入城市範圍授權檢查。

---

### [Medium] DOCFLOW-08 文件詳情端點僅驗認證，無城市授權（IDOR）

- **檔案**：src/app/api/documents/[id]/route.ts:128-207
- **類別**：A（IDOR）、E（PII）
- **描述**：`GET /api/documents/[id]` 只驗 `session?.user`，未做城市授權，即回傳文件詳情。透過 `?include=uploadedBy` 還會回傳上傳者 name + email（route.ts:149-151），以及 AI prompt/response、提取欄位等敏感內容。已登入使用者可越權讀取其他城市文件詳情與上傳者 Email。注意：此端點產生的 `blobUrl` 指向 DOCFLOW-03 的 blob 端點，兩者授權缺口疊加。
- **證據**：
  ```ts
  const session = await auth()
  if (!session?.user) { return 401 }
  const document = await prisma.document.findUnique({ where: { id }, include: {
    uploader: includes.has('uploadedBy') ? { select: { id, name, email } } : false, ...
  }})  // 無城市授權
  ```
- **建議**：取得 document.cityCode 後比對使用者 cityAccess / GLOBAL_ADMIN，無權限回 403/404。

---

### [Medium] DOCFLOW-09 OCR 提取端點無城市授權（IDOR + 成本放大）

- **檔案**：src/app/api/extraction/route.ts:75-205
- **類別**：A（IDOR）、K（成本）
- **描述**：`POST /api/extraction` 有 `INVOICE_CREATE` 權限檢查與 documentId UUID 驗證（良好），但無城市範圍檢查 — 具 INVOICE_CREATE 的使用者可對任意城市的 documentId 觸發 `extractDocument()`（OCR/AI 成本）。屬縱深防禦缺層（已有權限門檻，故降為 Medium）。
- **證據**：
  ```ts
  if (!hasPermission(session.user, PERMISSIONS.INVOICE_CREATE)) { return 403 }
  const { documentId, force } = parseResult.data
  const result = await extractDocument(documentId, { force })  // 未驗 document 是否屬使用者城市
  ```
- **建議**：在 service 或 route 加入 document.cityCode 與使用者 cityAccess 的比對。

---

### [Medium] DOCFLOW-10 文件上傳未驗證使用者對目標 cityCode 的權限

- **檔案**：src/app/api/documents/upload/route.ts:154-332
- **類別**：A（授權 / 城市隔離）、C（輸入驗證）
- **描述**：upload 有 `INVOICE_CREATE` 權限、檔案類型/大小驗證、cityCode 必填驗證（良好），但**未比對 cityCode 是否在使用者 cityAccess 內**。具 INVOICE_CREATE 的使用者可把文件上傳並歸戶到任意城市（污染他城市資料、繞過城市隔離）。cityCode 同時作為 Blob folder 路徑（upload→`uploadFile({ folder: cityCode })`）；folder 字串未清洗，但 cityCode Schema 在 from-outlook/from-sharepoint 有長度限制，此 route 則完全未約束 cityCode 格式（任意字串）。
- **證據**：
  ```ts
  const cityCode = formData.get('cityCode') as string | null
  if (!cityCode) { return 400 }            // 僅檢查非空，未檢查格式 / 權限
  const uploadResult = await uploadFile(buffer, file.name, { folder: cityCode || 'general', ... })
  ```
- **建議**：對 cityCode 加入 Zod/格式約束並比對使用者 cityAccess；非授權城市回 403。檔名清洗已由 `uploadFile`（storage.ts:173）以 `replace(/[^a-zA-Z0-9.-]/g, '_')` 處理，路徑遍歷風險低。

---

### [Medium] DOCFLOW-11 追溯鏈端點僅驗認證即回傳完整處理歷程（含原始來源）

- **檔案**：src/app/api/documents/[id]/trace/route.ts:59-99
- **類別**：A（IDOR）、E（PII）
- **描述**：`GET /api/documents/[id]/trace` 註解明言「任何已認證用戶均可訪問」，回傳 `getDocumentTraceChain(id)`，內容含原始文件來源、OCR、欄位、修正記錄、核准記錄、變更歷史等完整稽核鏈，無城市授權。雖有審計日誌包裝（`withAuditLogParams`），但仍可讓低權限使用者越權取得跨城市完整文件生命週期資料。與 trace/report（DOCFLOW 已有 AUDITOR/GLOBAL_ADMIN 角色限制）相比，本端點門檻明顯偏低。
- **證據**：
  ```ts
  // 註解：任何已認證用戶均可訪問（供 ProcessingTimeline 使用）
  const session = await auth();
  if (!session?.user) { return 401 }
  const traceChain = await traceabilityService.getDocumentTraceChain(id);  // 無城市授權
  ```
- **建議**：至少加入城市範圍授權；若 ProcessingTimeline 確需此資料，應以 document 的城市授權為前提，而非「任何已認證用戶」。

---

### [Low] DOCFLOW-12 corrections patterns 端點無城市範圍隔離（依 RULE_VIEW/RULE_MANAGE 權限保護）

- **檔案**：src/app/api/corrections/patterns/route.ts:76-108；src/app/api/corrections/patterns/[id]/route.ts:80-112、239-271
- **類別**：A（授權）
- **描述**：兩端點有正確的認證 + RULE_VIEW/RULE_MANAGE 權限檢查，但無城市範圍過濾，且 `companyId` 為可選查詢參數（patterns/route.ts:114、128-130），具 RULE_VIEW 者可查任意公司的修正模式與樣本值。鑒於規則/模式管理多屬跨城市的 Super User 職能，影響有限，列為 Low；若規則管理需依城市隔離則應提升處置。
- **證據**：
  ```ts
  if (!hasPermission(session.user.roles, PERMISSIONS.RULE_VIEW)) { return 403 }
  const companyId = searchParams.get('companyId') || undefined  // 任意 companyId，無城市/擁有者比對
  ```
- **建議**：確認規則管理的城市隔離需求；若需要，對 companyId 加入使用者可存取範圍比對。

---

### [Low] DOCFLOW-13 escalations 系列無城市範圍隔離（依 Super User 權限保護）

- **檔案**：src/app/api/escalations/route.ts:73-166；src/app/api/escalations/[id]/route.ts:77-154；src/app/api/escalations/[id]/resolve/route.ts:133-331
- **類別**：A（授權）、E（PII）
- **描述**：3 端點皆有 Super User 檢查（`isSuperUser` = 含 `*` 或 `RULE_MANAGE`），但無城市範圍過濾。Super User 可跨城市查看/處理所有升級案例與 escalator email（escalations/[id]/route.ts:134-139）。若 Super User 設計為全域角色則屬預期；列為 Low 供確認。另注意 `isSuperUser` 接受 wildcard `'*'`（開發模式全權限），需確保生產環境無使用者持有 `'*'`。
- **證據**：
  ```ts
  function isSuperUser(roles) {
    return roles.some((r) => r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_MANAGE))
  }
  ```
- **建議**：確認 Super User 是否應受城市範圍限制；確認生產環境角色不含 `'*'` 萬用權限。

---

### [Low] DOCFLOW-14 SharePoint 提交端點存在受控 SSRF 面（已有 domain 白名單）

- **檔案**：src/app/api/documents/from-sharepoint/route.ts:57-72（配合 sharepoint-document.service.ts:163-185）
- **類別**：G（SSRF）
- **描述**：`sharepointUrl` 由使用者提供並交給 `graphService.getFileInfoFromUrl()` / `downloadFile()` 取檔。Zod Schema 已限制 URL 必須含 `.sharepoint.com` 或 `.sharepoint.cn`（route.ts:61-65），且下載走 Microsoft Graph（OAuth token），非任意 fetch，SSRF 風險受控。殘餘風險：白名單為子字串比對（`url.includes('.sharepoint.com')`），理論上 `https://evil.com/?x=.sharepoint.com` 可繞過字串檢查，但實際取檔由 Graph API 解析，難以指向內網。列為 Low。
- **證據**：
  ```ts
  .refine((url) => url.includes('.sharepoint.com') || url.includes('.sharepoint.cn'), '必須是 SharePoint URL')
  ```
- **建議**：將白名單改為解析 `new URL(url).hostname` 後以 `endsWith('.sharepoint.com')` 嚴格比對，避免子字串繞過。

---

### [Info] DOCFLOW-15 documents 詳情錯誤回應在 development 模式回傳錯誤名稱與訊息

- **檔案**：src/app/api/documents/[id]/route.ts:408-422
- **類別**：J（資訊洩漏）
- **描述**：catch 區塊在 `NODE_ENV === 'development'` 時回傳 `${error.name}: ${error.message}`，生產環境則回 'Internal server error'（正確）。僅需確保部署環境 NODE_ENV 正確為 production，避免內部錯誤外洩。多個 service-backed 端點（如 search、processing、progress）直接回傳 `error.message`，雖多為自訂訊息，但建議統一不外洩底層錯誤。
- **證據**：
  ```ts
  error: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error'
  ```
- **建議**：確保生產 NODE_ENV=production；對直接回傳 `error.message` 的端點改為固定文案，避免洩漏內部細節。

---

### [Info] DOCFLOW-16 多處非結構化 console.log/console.error（含文件 id）

- **檔案**：全 scope 多檔（如 process/route.ts:190-197、223、229；blob/route.ts:125；upload/route.ts:348,428 等）
- **類別**：E（日誌）
- **描述**：大量使用 `console.log`/`console.error`，符合專案已知系統性缺口（console.log 約 279 處）。本 scope 未發現記錄 email/token/密碼到 plaintext 的情形（escalation detail email 僅回應給授權用戶，非寫 log）；FIX-050 的 auth.config.ts PII log 不在本 scope，未見回歸。記錄內容多為 document id 與錯誤物件，PII 風險低，列為 Info。
- **建議**：依專案計畫漸進改用結構化 logger。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 1 | 4 | 6 | 3 | 2 |

---

## 4. 區域整體觀察

1. **系統性城市隔離（IDOR）缺口為本區域最大風險**：documents 目錄中依 id 存取文件資源的端點普遍只做 `session?.user` 認證、不驗城市範圍 — blob、source、process、retry、[id] 詳情、trace 皆如此。同目錄的 `progress/route.ts`、`processing/route.ts`、`processing/stats/route.ts` 與 `exports/multi-city/route.ts` 已正確實作城市授權，可作為修補範本（複用 `user.cityAccess` + `role === 'GLOBAL_ADMIN'` + `includes('*')` 模式）。建議集中為共用 helper（如 `assertDocumentCityAccess(session, document.cityCode)`）以消除遺漏。

2. **mapping 目錄完全無認證（Critical）**：`/api/mapping`（GET/POST）與 `/api/mapping/[id]`（GET）三個 handler 內無 `auth()`，未見全域 middleware 補位，是本區域唯一可被未授權者直接利用的 Critical 缺口（讀取提取結果 + 觸發昂貴處理）。應優先修復。

3. **外部來源端點（from-outlook / from-sharepoint 及其 status）授權設計完整**：採 API Key 驗證 + 權限檢查 + 逐城市 `checkCityAccess` 比對，輸入有 Zod 驗證，RFC 7807 錯誤格式一致，是本區域的正面範例；SharePoint URL 雖為使用者輸入但有 domain 白名單 + Graph OAuth 下載，SSRF 受控。

4. **輸入驗證大致到位但城市授權與驗證脫節**：多數 POST/PATCH 有 Zod（upload、extraction、escalations/resolve、mapping、from-*），分頁上限亦多有約束（patterns pageSize≤100、escalations≤100、sources/trend months≤12、processing limit≤100）。問題不在「有無驗證」，而在「驗證通過後未做城市範圍授權」——cityCode/cityId/documentId 被當作可信輸入直接查詢。

5. **無 SQL injection / command injection / path traversal 實證**：全程使用 Prisma 參數化查詢，無 raw SQL；檔名上傳經 `uploadFile` 清洗（storage.ts:173），FIX-051 的 db-context raw query 不在本 scope。`exports/multi-city` 經 `withServiceRole` 但已先做城市權限驗證（exports route.ts:339-352），未發現繞過。
