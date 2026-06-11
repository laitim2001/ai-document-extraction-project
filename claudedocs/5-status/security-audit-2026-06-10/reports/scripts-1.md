# 安全審查報告 — scripts/ 工具腳本後半 (scripts-1)

> 審查日期：2026-06-10 | Scope：scopes/scripts-1.txt | Agent：scripts-1 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | scripts/reaggregate-batch-terms.mjs | 219 | ✅ |
| 2 | scripts/reprocess-missing-issuer.ts | 305 | ✅ |
| 3 | scripts/reset-and-trigger-batch.mjs | 133 | ✅ |
| 4 | scripts/reset-stuck-files.mjs | 73 | ✅ |
| 5 | scripts/run-change006-test.mjs | 308 | ✅ |
| 6 | scripts/run-e2e-historical-test.ts | 537 | ✅ |
| 7 | scripts/run-full-historical-test.mjs | 398 | ✅ |
| 8 | scripts/run-test-plan-003-full.mjs | 606 | ✅ |
| 9 | scripts/run-test-plan-003-prisma.mjs | 489 | ✅ |
| 10 | scripts/run-test-plan-005.mjs | 494 | ✅ |
| 11 | scripts/run-test-plan-005-prisma.ts | 473 | ✅ |
| 12 | scripts/setup-formats-and-test.ts | 135 | ✅ |
| 13 | scripts/temp-check-doc.ts | 40 | ✅ |
| 14 | scripts/temp-query-docs.ts | 20 | ✅ |
| 15 | scripts/temp-query-prompt.ts | 76 | ✅ |
| 16 | scripts/test-change-010.ts | 330 | ✅ |
| 17 | scripts/test-change-024-v3-1-integration.ts | 627 | ✅ |
| 18 | scripts/test-company-matching.mjs | 67 | ✅ |
| 19 | scripts/test-document-query.ts | 81 | ✅ |
| 20 | scripts/test-dual-processing.ts | 453 | ✅ |
| 21 | scripts/test-e2e-pipeline.ts | 650 | ✅ |
| 22 | scripts/test-excel-export.ts | 292 | ✅ |
| 23 | scripts/test-export-api.mjs | 74 | ✅ |
| 24 | scripts/test-fix-004b.ts | 112 | ✅ |
| 25 | scripts/test-fix-005.ts | 53 | ✅ |
| 26 | scripts/test-fix-006.mjs | 209 | ✅ |
| 27 | scripts/test-fix-008-e2e.mjs | 121 | ✅ |
| 28 | scripts/test-gpt5-nano-extraction.ts | 854 | ✅ |
| 29 | scripts/test-gpt-vision-service.mjs | 104 | ✅ |
| 30 | scripts/test-hierarchical-aggregation.ts | 190 | ✅ |
| 31 | scripts/test-hierarchical-export.mjs | 146 | ✅ |
| 32 | scripts/test-hierarchical-service.mjs | 274 | ✅ |
| 33 | scripts/test-model-capabilities.ts | 322 | ✅ |
| 34 | scripts/test-multi-stage-extraction.ts | 464 | ✅ |
| 35 | scripts/test-pdf-conversion.mjs | 76 | ✅ |
| 36 | scripts/test-plan-003-e2e.ts | 1569 | ✅ |
| 37 | scripts/test-template-matching/01-data-exploration.ts | 360 | ✅ |
| 38 | scripts/test-template-matching/02-prepare-test-data.ts | 333 | ✅ |
| 39 | scripts/test-template-matching/03-execute-matching.ts | 809 | ✅ |
| 40 | scripts/test-template-matching/04-priority-cascade.ts | 877 | ✅ |
| 41 | scripts/test-template-matching/05-transform-validation.ts | 821 | ✅ |
| 42 | scripts/test-template-matching/06-boundary-conditions.ts | 500 | ✅ |
| 43 | scripts/test-template-matching/07-pipeline-integration.ts | 809 | ✅ |
| 44 | scripts/test-v3-upload.ts | 67 | ✅ |
| 45 | scripts/validate-fix-008-batch.mjs | 222 | ✅ |
| 46 | scripts/verify-address-filter.mjs | 198 | ✅ |
| 47 | scripts/verify-batch-results.ts | 152 | ✅ |
| 48 | scripts/verify-change-006.mjs | 222 | ✅ |
| 49 | scripts/verify-change-006-db.mjs | 169 | ✅ |
| 50 | scripts/verify-claude-md-sync.sh | 101 | ✅ |
| 51 | scripts/verify-environment.ts | 327 | ✅ |
| 52 | scripts/verify-fix-005.ts | 275 | ✅ |
| 53 | scripts/verify-fix005-results.ts | 332 | ✅ |
| 54 | scripts/verify-fix-059-monthly-cost-sql.ts | 154 | ✅ |
| 55 | scripts/verify-test-plan-003.mjs | 166 | ✅ |

合計：55 個檔案，約 17,646 行，全部完整讀取。

---

## 2. 發現

### [Medium] scripts-D-1 多個腳本硬編碼資料庫連線字串（含預設密碼）作為 fallback

- **檔案**：
  - scripts/reprocess-missing-issuer.ts:27
  - scripts/run-change006-test.mjs:21
  - scripts/test-company-matching.mjs:11
  - scripts/test-hierarchical-aggregation.ts:12（透過 test-hierarchical-service.mjs:12 與 verify-change-006-db.mjs:13 同樣模式）
  - scripts/test-hierarchical-service.mjs:12
  - scripts/verify-change-006-db.mjs:13
- **類別**：D（Secrets 與設定）
- **描述**：這些腳本在 `process.env.DATABASE_URL` 缺失時，硬編碼預設連線字串 `postgresql://postgres:postgres@localhost:5433/ai_document_extraction` 作為 fallback。雖然這是本地開發預設值（postgres/postgres 為開發容器預設帳密，非生產憑證），但將連線字串與帳密寫死在原始碼有兩個風險：(1) 形成「預設密碼即 postgres」的習慣，若有人複製此模式到生產腳本會洩漏真實憑證；(2) 在 CI 或共用環境中若意外連到同網段的同名 DB，會以 superuser `postgres` 身分執行寫入/重置操作。
- **證據**：
  ```js
  // scripts/test-company-matching.mjs:10-12
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/ai_document_extraction'
  });
  ```
- **建議**：移除 fallback 字串，改為在缺少 `DATABASE_URL` 時 fail-fast（如 `verify-fix-059-monthly-cost-sql.ts:37-41` 與 `verify-environment.ts` 的優雅 SKIP/錯誤模式）。其餘多數腳本（如 reaggregate-batch-terms.mjs、run-test-plan-003-prisma.mjs）已正確地只用 `process.env.DATABASE_URL` 無 fallback，應統一為此做法。

### [Medium] scripts-A-1 多個測試腳本使用 X-Dev-Bypass-Auth header 繞過認證

- **檔案**：
  - scripts/run-test-plan-005-prisma.ts:163
  - scripts/run-full-historical-test.mjs:52
  - scripts/run-test-plan-003-full.mjs:135,141,259
  - scripts/run-test-plan-003-prisma.mjs:158-159
  - scripts/reset-and-trigger-batch.mjs:81
  - scripts/run-test-plan-005.mjs（透過 makeRequest 無 header，但同系列腳本）
  - scripts/validate-fix-008-batch.mjs:34
  - scripts/test-change-024-v3-1-integration.ts:111,159,216（建立批次/上傳/處理）
- **類別**：A（認證與授權）
- **描述**：這些腳本對 `/api/admin/historical-data/*` 等需要管理員權限的端點，傳送 `X-Dev-Bypass-Auth: 'true'` header 來取得模擬的全域管理員 session（`src/lib/auth.ts:392-404` 的 `getAuthSession`，回傳 `DEV_MOCK_SESSION`，`isGlobalAdmin: true`、`cityCodes: ['*']`）。腳本本身只是「使用者」，但此 header 機制的啟用條件 `isDevelopmentMode()`（`src/lib/auth.ts:91-93`）為 `NODE_ENV === 'development' || !isAzureADConfigured()`。**風險點不在腳本，而在於此 OR 條件**：若生產環境未正確設定 Azure AD（`isAzureADConfigured()` 回 false），則任何帶 `X-Dev-Bypass-Auth: true` 的請求都能取得全域管理員 session，繞過所有 admin 端點授權。腳本的存在證明此 bypass 路徑在 codebase 中被實際依賴。
- **證據**：
  ```ts
  // scripts/run-test-plan-005-prisma.ts:159-167
  const response = await fetch(`${BASE_URL}/api/admin/historical-data/batches/${batchId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dev-Bypass-Auth': 'true' },
    ...
  ```
  ```ts
  // src/lib/auth.ts:91-93（交叉確認，超出本 scope 但為風險根因）
  function isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' || !isAzureADConfigured()
  }
  ```
- **建議**：腳本層面無需修改（這是合法的本地測試手段）。但應確認 `src/lib/auth.ts` 的 bypass 條件在生產環境必須額外要求 `NODE_ENV !== 'production'`（移除 `|| !isAzureADConfigured()` 在 production 的效力），避免 Azure AD 配置缺失時意外開放 admin 繞過。此根因應由負責 src/lib/auth.ts 的審查項追蹤；本報告記錄腳本作為「bypass 被實際使用」的證據。

### [Low] scripts-K-1 transform 測試腳本使用 Function() 動態執行公式運算

- **檔案**：scripts/test-template-matching/05-transform-validation.ts:108-138
- **類別**：K（其他風險 — 程式碼注入面）
- **描述**：`formulaTransform` 將使用者可控的 `formula` 字串中 `{變數}` 取代為數值後，用 `Function("use strict"; return (...))()` 動態執行。雖然有 `SAFE_PATTERN = /^[\d\s\+\-\*\/\.\(\)]+$/` 白名單僅允許數字與四則運算符號、且變數值經 `Number()` 轉換（非數字→`0`），降低了注入面，但這是 production transform 服務（`src/services/transform/*.transform.ts`，註解標明本檔複製其邏輯）的反映。若實際服務的白名單正則有缺漏（例如未過濾某些可構造表達式的字元），則公式來源（TemplateFieldMapping 設定）可成為程式碼執行管道。
- **證據**：
  ```ts
  // 05-transform-validation.ts:127-137
  const cleanExpr = expression.replace(/\s+/g, '')
  if (!SAFE_PATTERN.test(cleanExpr)) { throw new Error(...) }
  const result = Function(`"use strict"; return (${cleanExpr})`)() as number
  ```
- **建議**：腳本本身為純邏輯測試、無 DB/網路面，風險低。但應交叉檢查 production 的 `formula.transform.ts` 是否使用同一個 `SAFE_PATTERN` 白名單（建議改用受限數學表達式 parser 而非 `Function()`）。此項應由 services 層審查確認。

### [Low] scripts-J-1 硬編碼開發者本機絕對路徑（含 Windows 使用者名稱）

- **檔案**：scripts/run-e2e-historical-test.ts:30-35
- **類別**：J（資訊洩漏 — 環境資訊）
- **描述**：`DOC_SAMPLE_DIR` 與 `REPORT_OUTPUT_DIR` 硬編碼完整絕對路徑 `C:\Users\rci.ChrisLai\Documents\GitHub\...`，將開發者 Windows 帳號名稱 `rci.ChrisLai` 寫入版控。屬輕微資訊洩漏（內部使用者名稱）兼可攜性問題；其餘同類腳本（run-full-historical-test.mjs、run-test-plan-003-prisma.mjs 等）已正確使用 `path.join(__dirname, '..', ...)` 相對路徑。
- **證據**：
  ```ts
  // scripts/run-e2e-historical-test.ts:30-32
  const DOC_SAMPLE_DIR = path.resolve(
    'C:\\Users\\rci.ChrisLai\\Documents\\GitHub\\ai-document-extraction-project\\docs\\Doc Sample'
  )
  ```
- **建議**：改用 `path.join(__dirname, '..', 'docs', 'Doc Sample')` 等相對路徑，與同目錄其他腳本一致。

### [Low] scripts-A-2 測試腳本以未認證 fetch 直接呼叫 export / hierarchical-terms API

- **檔案**：
  - scripts/test-export-api.mjs:16-18（`/api/v1/batches/{id}/hierarchical-terms/export`，無任何 auth header）
  - scripts/run-test-plan-005.mjs:297（`/api/admin/historical-data/batches/{id}/hierarchical-terms/export`，無 header）
  - scripts/run-test-plan-003-prisma.mjs:326（同上，無 header）
- **類別**：A（認證與授權 — 觀察）
- **描述**：這些腳本對匯出/階層術語 API 發出**無任何認證 header** 的 fetch 並預期成功。若這些端點本身正確要求認證，腳本應會收到 401；腳本作者預期能拿到 Excel 二進位代表這些 export 端點**可能未做認證檢查**（屬已知 auth 覆蓋率缺口的徵兆）。腳本本身不是漏洞，但其使用模式間接指出 `/api/v1/batches/[id]/hierarchical-terms/export` 與 `/api/admin/historical-data/batches/[id]/hierarchical-terms/export` 的授權需另行核實。
- **證據**：
  ```js
  // scripts/test-export-api.mjs:16-18
  const response = await fetch(
    `${baseUrl}/api/v1/batches/${batchId}/hierarchical-terms/export`
  ); // 無 headers，預期 200 + Excel
  ```
- **建議**：腳本無需改。請 API route 審查項確認上述兩個 export 端點是否有 `getAuthSession`/權限檢查；若缺失應補上（admin/v1 端點不應允許匿名匯出批次資料）。

### [Info] scripts-D-2 大量硬編碼測試用 ID / UUID / 城市代碼

- **檔案**：reset-and-trigger-batch.mjs:25-26（BATCH_ID、BASE_URL）、run-change006-test.mjs:27（TARGET_COMPANY_ID）、setup-formats-and-test.ts:16（batchId）、temp-check-doc.ts:5、temp-query-prompt.ts:13-14、test-document-query.ts:10、test-e2e-pipeline.ts:31-36、verify-batch-results.ts:22、verify-fix005-results.ts:17 等多處
- **類別**：D（設定 — 觀察）
- **描述**：眾多一次性調試/驗證腳本硬編碼特定的 batchId、companyId、documentId、formatId 等 UUID 與本地 `localhost:3000/3010/3011/3200` URL。這些非 secret（為 DB 內測試資料識別碼），不構成安全風險，僅為一次性腳本的預期特性。記錄以供完整性。
- **建議**：無須處理。若日後重用這些腳本，建議改為命令列參數（部分腳本如 reaggregate-batch-terms.mjs:107 已支援 `process.argv[2]`）。

### [Info] scripts-E-1 測試腳本將提取結果完整內容輸出至 console

- **檔案**：temp-check-doc.ts:21-37（輸出 stage1/2/3 AI Details）、verify-change-006-db.mjs:120,136（輸出 documentIssuer、invoiceData keys）、test-hierarchical-service.mjs:138（輸出 extractionResult 前 2000 字）、test-change-024-v3-1-integration.ts:514-531（將完整 results 寫入 JSON 報告檔）
- **類別**：E（PII 與日誌 — 觀察）
- **描述**：測試腳本將文件提取結果（可能含發票上的公司名、地址、人名等業務資料）印至 console 或寫入 `claudedocs/5-status/testing/reports/*.json`。這些屬本地測試輸出，非生產日誌路徑，且資料為測試樣本（docs/Doc Sample）。風險極低，但若測試報告含真實客戶發票資料並提交版控需留意。
- **建議**：無立即處理需求。確保 `claudedocs/5-status/testing/reports/` 與 `temp_*.json`（test-gpt5-nano-extraction.ts:821 寫入專案根）不含真實客戶 PII 即可；建議將這類臨時輸出加入 .gitignore。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 2 | 3 | 2 |

---

## 4. 區域整體觀察

1. **性質定位**：本批 55 個檔案全為**開發/測試/驗證工具腳本**，不屬於部署到生產的應用程式 runtime。多數透過 Prisma driver adapter（`@prisma/adapter-pg` + `pg.Pool`）直連本地 DB，或對本地 dev server 發 fetch。因此整體安全風險偏低，無 Critical/High 級項目。

2. **系統性模式 1 — 連線字串 fallback 不一致**：約 6 個腳本硬編碼 `postgres:postgres@localhost:5433` fallback，其餘約 20+ 個腳本正確地僅讀 `process.env.DATABASE_URL`。應統一移除硬編碼 fallback（scripts-D-1）。

3. **系統性模式 2 — X-Dev-Bypass-Auth 依賴**：至少 8 個腳本依賴 `X-Dev-Bypass-Auth: true` 取得全域管理員 session。腳本本身合法，但反映出 `src/lib/auth.ts` 存在一個由 `!isAzureADConfigured()` 觸發的 admin 繞過路徑（scripts-A-1），此根因需由 auth 層審查項確認在生產不可被觸發。

4. **間接指出的 API auth 缺口**：部分腳本對 export / hierarchical-terms 端點以**無認證 fetch** 呼叫並預期成功（scripts-A-2），間接佐證了已知的 auth 覆蓋率缺口（reports/v1 路由），建議由 API route 審查項核實這些匯出端點的授權。

5. **無敏感金鑰外洩**：所有 Azure OpenAI / Azure DI 憑證皆透過 `process.env.AZURE_OPENAI_API_KEY` 等環境變數讀取（test-gpt5-nano-extraction.ts、test-model-capabilities.ts、test-multi-stage-extraction.ts），未發現硬編碼 API key、token 或生產 connection string。`verify-environment.ts` 甚至內建 placeholder 偵測（`PLACEHOLDER_PATTERNS`）主動檢查 secret 是否仍為預設值，為良好實踐。
