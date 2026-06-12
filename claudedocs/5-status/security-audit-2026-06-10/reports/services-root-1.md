# 安全審查報告 — services 根目錄服務（第 2/4 批）

> 審查日期：2026-06-10 | Scope：scopes/services-root-1.txt | Agent：services-root-1

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/services/correction-recording.ts | 342 | ✅ |
| 2 | src/services/cost-estimation.service.ts | 292 | ✅ |
| 3 | src/services/dashboard-statistics.service.ts | 566 | ✅ |
| 4 | src/services/data-retention.service.ts | 1150 | ✅ |
| 5 | src/services/data-template.service.ts | 423 | ✅ |
| 6 | src/services/document.service.ts | 619 | ✅ |
| 7 | src/services/document-format.service.ts | 748 | ✅ |
| 8 | src/services/document-issuer.service.ts | 550 | ✅ |
| 9 | src/services/document-progress.service.ts | 737 | ✅ |
| 10 | src/services/document-source.service.ts | 436 | ✅ |
| 11 | src/services/encryption.service.ts | 258 | ✅ |
| 12 | src/services/example-generator.service.ts | 1139 | ✅ |
| 13 | src/services/exchange-rate.service.ts | 1110 | ✅ |
| 14 | src/services/expense-report.service.ts | 666 | ✅ |
| 15 | src/services/extraction.service.ts | 341 | ✅ |
| 16 | src/services/field-definition-set.service.ts | 618 | ✅ |
| 17 | src/services/file-detection.service.ts | 377 | ✅ |
| 18 | src/services/forwarder.service.ts | 50 | ✅ |
| 19 | src/services/forwarder-identifier.ts | 408 | ✅ |
| 20 | src/services/global-admin.service.ts | 411 | ✅ |
| 21 | src/services/gpt-vision.service.ts | 1199 | ✅ |
| 22 | src/services/health-check.service.ts | 676 | ✅ |
| 23 | src/services/hierarchical-term-aggregation.service.ts | 708 | ✅ |
| 24 | src/services/historical-accuracy.service.ts | 421 | ✅ |
| 25 | src/services/hybrid-prompt-provider.service.ts | 376 | ✅ |
| 26 | src/services/impact-analysis.ts | 484 | ✅ |
| 27 | src/services/index.ts | 455 | ✅ |

> 註：本批 scope 不含 `src/lib/db-context.ts`（位於 `src/lib/`，非 `src/services/` 根目錄），故 FIX-051 的修復點無法在本批次直接驗證。`global-admin.service.ts` 引用了 `withServiceRole`（來自 db-context），其調用方式見發現 K-3（無新風險）。

## 2. 發現

### [Medium] B-1 規則模式以 `new RegExp()` 動態建構，存在 ReDoS 風險
- **檔案**：src/services/impact-analysis.ts:367、:397、:400
- **類別**：B（注入 / ReDoS）/ K（DoS）
- **描述**：`applyPattern()` 直接以資料庫中 `RuleSuggestion.suggestedPattern` / `currentPattern` 建構正則 `new RegExp(pattern)`，並對最近 90 天該公司**所有文件**的 `ocrResult.extractedText` 逐筆執行 `text.match(regex)`。`applyKeywordRules()` 亦對 `rule.pattern` 使用 `new RegExp(rule.pattern, 'g')`。若 pattern 含 catastrophic backtracking 結構（如 `(a+)+$`），且 OCR 文字夠長，單次影響分析即可造成事件迴圈長時間阻塞（ReDoS / DoS）。pattern 來源是規則建議，需具備規則建立權限者才能注入，但屬已認證低權限使用者可觸發的服務端 DoS。
- **證據**：
  ```ts
  case 'REGEX':
    const regex = new RegExp(pattern)
    const match = text.match(regex)
  ...
  result = result.replace(new RegExp(rule.pattern, 'g'), '')
  ```
- **建議**：對使用者/規則來源的 pattern 限制長度與複雜度，或改用具超時保護的安全 regex 引擎（如 `re2`），或在 worker / 帶 timeout 的沙箱中執行；至少限制單次分析的 `documents` 筆數與 `extractedText` 長度上限。

### [Medium] H-1 Excel 報表匯出未防護公式注入（CSV/Formula Injection）
- **檔案**：src/services/expense-report.service.ts:286-325（`buildRowData`）、:238-241（`worksheet.addRow`）
- **類別**：H（檔案處理）/ F（內容注入）
- **描述**：費用報表將 `invoiceNumber`（來自 `extractionResult.fieldMappings`，即 AI 從上傳發票提取的值）、`companyCode`、`companyName` 等使用者可影響的字串直接寫入 Excel 儲存格，未對以 `=`、`+`、`-`、`@`、Tab、CR 開頭的值做前置跳脫。當報表被其他使用者於 Excel/LibreOffice 開啟時，這類儲存格會被視為公式執行，可能導致命令執行或資料外洩（Formula Injection）。發票內容由上傳者控制，屬可被低權限使用者植入、由他人觸發的風險。
- **證據**：
  ```ts
  const invoiceNumber = fieldMappings?.invoiceNumber?.value || doc.id.slice(0, 8)
  ...
  worksheet.addRow(rowData)  // rowData 內含未跳脫的使用者字串
  ```
- **建議**：寫入前對字串型儲存格做防護——若值以 `= + - @` 或控制字元開頭，前置單引號 `'` 或空白；或統一以 `cell.value = { text: ... }` 文字型態並關閉公式解析。

### [Low] D-1 對稱加密使用 AES-256-CBC 無完整性驗證
- **檔案**：src/services/encryption.service.ts:60、:147-153、:169-211
- **類別**：D（Secrets 與設定）/ I（加密機制本身）
- **描述**：`EncryptionService` 以 `aes-256-cbc` 加密 SharePoint Client Secret 等敏感資料，採隨機 IV（良好），但 CBC 為非認證加密（無 HMAC / 非 GCM）。若攻擊者能竄改資料庫中的密文，存在位元翻轉與 padding oracle 類攻擊面，且無法偵測竄改。屬縱深防禦缺層而非可直接利用的漏洞（需資料庫寫入權限）。金鑰由 `process.env.ENCRYPTION_KEY` 讀取、長度驗證完整，未硬編碼（符合 H4）。
- **證據**：
  ```ts
  const ALGORITHM = 'aes-256-cbc';
  ...
  const cipher = createCipheriv(this.algorithm, this.key, iv);
  ```
- **建議**：改用認證加密 `aes-256-gcm`（儲存 IV + authTag + ciphertext），或在現有 CBC 密文外再附 HMAC-SHA256 以驗證完整性。

### [Low] K-1 多處 `findMany` 無 take/limit 上限（記憶體 / DoS 面）
- **檔案**：src/services/hierarchical-term-aggregation.service.ts:152-202、:613-615；src/services/exchange-rate.service.ts:884-891（`exportExchangeRates`）
- **類別**：K（無界查詢）
- **描述**：`aggregateTermsHierarchically` 對單一 batch 以多重 fallback 撈取所有 `COMPLETED` 的 `historicalFile`（含 `extractionResult` JSON）且無 `take`；`getGlobalTermStats` 撈取所有 `documentFormat`；`exportExchangeRates` 無上限匯出全部匯率。在大型 batch / 大量資料下會造成記憶體壓力與處理阻塞。屬於背景/匯出操作，影響為服務端資源耗用。
- **證據**：
  ```ts
  files = await prisma.historicalFile.findMany({
    where: { batchId, status: 'COMPLETED' },
    include: { documentIssuer: true, documentFormat: true },
  })  // 無 take
  ```
- **建議**：以分頁 / cursor 分批處理，或對單次聚合的最大筆數設上限並串流處理。

### [Low] J-1 服務層錯誤訊息可能原樣回傳內部細節
- **檔案**：src/services/health-check.service.ts:211、:318-331；src/services/expense-report.service.ts:553；src/services/document-issuer.service.ts:547；多處 `error.message`
- **類別**：J（資訊洩漏）
- **描述**：多個服務將 `error.message`（可能含內部路徑、SQL/連線錯誤、套件訊息）寫入回傳物件或持久化（如 `reportJob.error`、`serviceHealthCheck.errorMessage`）。若 API 層未統一包裝為 RFC 7807 友善訊息而直接外露，會造成內部資訊洩漏。實際影響取決於 API 層處理。
- **證據**：
  ```ts
  errorMessage: error instanceof Error ? error.message : 'Unknown error',
  ```
- **建議**：對外回應僅提供通用訊息與錯誤碼，內部細節僅寫入 server log；確認 API 層對這些服務的錯誤有統一包裝。

### [Low] H-2 `file-detection` 以 pdf-parse 解析使用者上傳的 PDF
- **檔案**：src/services/file-detection.service.ts:176-179
- **類別**：H（檔案處理）
- **描述**：`detectPdfType` 以 `require('pdf-parse/lib/pdf-parse')` 解析使用者上傳的 PDF buffer。pdf-parse / 底層 pdfjs 曾有解析類 CVE，惡意 PDF 可能觸發解析端漏洞。已具備 50MB 大小限制（`FILE_SIZE_LIMITS.MAX_SIZE_BYTES`），降低部分 DoS 面。屬依賴層風險。
- **證據**：
  ```ts
  const pdfParse = require('pdf-parse/lib/pdf-parse')
  const data = await pdfParse(buffer)
  ```
- **建議**：保持 pdf-parse / pdfjs 為最新版；考慮對 PDF 解析設置處理超時與資源限制。

### [Low] A-1 文件 / 報表服務層函數未含城市範圍或擁有者驗證
- **檔案**：src/services/document.service.ts:236-267（`getDocumentById`）、:281-306（`deleteDocument`）、:512-595（`retryProcessing`）、:604-619（`getDocumentWithRelations`）；src/services/document-format.service.ts、document-issuer.service.ts 多數匯出函數
- **類別**：A（認證與授權 / IDOR）
- **描述**：這些服務層函數僅以 `id` 操作資源，未驗證呼叫者的城市範圍（`cityCode`）或資源擁有者。若上層 API route 未強制 city scope / 角色檢查，存在 IDOR（依任意 id 讀取或刪除文件）風險。此為服務層慣例（防護應在 API 層 + RLS），本批無法判定實際是否可繞過，列為待 API 層交叉確認項。對照已知系統性缺口：auth 覆蓋率約 60%。
- **證據**：
  ```ts
  export async function deleteDocument(id: string): Promise<void> {
    const document = await prisma.document.findUnique({ where: { id }, ... })
    ...
    await prisma.document.delete({ where: { id } })
  }
  ```
- **建議**：確認對應 API route（`/api/documents/[id]` 等）皆有 session + city scope 驗證；或在服務層接受 `cityContext` 並加入 where 條件作為縱深防禦。

### [Info] B-2 `dashboard-statistics` 原生 SQL 已正確參數化（無回歸）
- **檔案**：src/services/dashboard-statistics.service.ts:387-412
- **類別**：B（注入）
- **描述**：`getAverageProcessingTime` 使用 `prisma.$queryRaw` 計算平均處理時間，城市過濾以 `Prisma.sql\`AND city_code = ${cityWhere.cityCode}\`` 帶入。此為 Prisma tagged-template 參數化（轉為佔位符），即使 `cityCode` 含特殊字元亦不會注入。驗證通過，無 SQL injection 風險，符合 FIX-051 之後的安全慣例。
- **證據**：
  ```ts
  const cityFilter = cityWhere.cityCode
    ? Prisma.sql`AND city_code = ${cityWhere.cityCode}`
    : Prisma.empty
  ```
- **建議**：維持現狀；勿改為 `$queryRawUnsafe` 字串拼接。

### [Info] K-2 `document-source` JSON 路徑查詢已參數化
- **檔案**：src/services/document-source.service.ts:343-368
- **類別**：B（注入）
- **描述**：`searchBySource` 對 `senderEmail` / `subject` 使用 Prisma JSON filter `{ path: [...], string_contains: options.x }`，為 Prisma 參數化查詢，無字串拼接 SQL，無注入風險。
- **建議**：無。

### [Info] K-3 `global-admin` 使用 `withServiceRole` 繞過 RLS 但具內部權限檢查
- **檔案**：src/services/global-admin.service.ts:142-333
- **類別**：A（授權）
- **描述**：`grantGlobalAdminRole` / `revokeGlobalAdminRole` 以 `withServiceRole`（繞過 RLS）執行，但函式內部已驗證操作者 `isGlobalAdmin`、阻止自我撤銷、保護最後一位管理員，並記錄審計日誌。授權邏輯設計妥當。`isGlobalAdmin` / `getGlobalAdmins` 使用一般 prisma（受 RLS），屬讀取操作。
- **建議**：維持現狀；確認呼叫端 API 仍有 session 驗證作為第一道防線。

### [Info] D-2 Azure OpenAI / OCR 設定皆從環境變數讀取，無硬編碼祕密
- **檔案**：src/services/gpt-vision.service.ts:340-346、:706；src/services/extraction.service.ts:41
- **類別**：D（Secrets 與設定）
- **描述**：`AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY` / `OCR_SERVICE_URL` 等皆由 `process.env` 讀取，未硬編碼。`example-generator.service.ts` 內的 `https://api.example.com` 與 `your-api-key` 為純文件範例佔位字串，非真實祕密。未發現 console.log 輸出 API key / token / email 等 PII（符合 FIX-050 之後慣例；公司名稱等業務識別字非個人 PII）。
- **建議**：無。

### [Info] K-4 單例服務的 `setInterval` 未 unref
- **檔案**：src/services/forwarder-identifier.ts:125；src/services/dashboard-statistics.service.ts:82
- **類別**：K（其他）
- **描述**：快取清理定時器以 `setInterval` 建立但未 `unref()`，理論上會阻止進程自然退出。對常駐 Web 服務影響極小，列為觀察。
- **建議**：可於建立 timer 後呼叫 `.unref()`（若執行環境需要乾淨退出）。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 2 | 4 | 5 |

## 4. 區域整體觀察

- 本批 27 個檔案以**服務層（business logic）**為主，資料庫存取幾乎全採 Prisma 參數化查詢，未發現 `$queryRawUnsafe` / `$executeRawUnsafe` 字串拼接；唯一的 `$queryRaw`（dashboard-statistics）已正確參數化（B-2，無回歸）。
- 認證/授權檢查普遍**不在服務層**，而依賴上層 API route + RLS（A-1）。這符合專案慣例，但結合已知「auth 覆蓋率約 60%」的系統性缺口，建議 API 層批次審查時對 document / document-format / document-issuer / exchange-rate / data-retention / expense-report 等服務的呼叫端逐一確認 session + city scope。
- 最值得優先處理的兩個本層級可利用問題：**impact-analysis 的 ReDoS（B-1）** 與 **expense-report 的 Excel 公式注入（H-1）**，兩者皆為已認證使用者可植入、服務端或他人端觸發。
- 祕密管理良好：未見硬編碼 API key / connection string / tenant id；敏感欄位有加密服務（CBC 模式建議升級為 GCM，D-1）。
- PII 與日誌：大量 `console.log/console.error` 存在（符合已知約 279 處現象），但本批次未發現輸出 email / token / 密碼等個資；錯誤訊息原樣回傳屬潛在資訊洩漏（J-1），須由 API 層統一包裝把關。
