# 安全審查報告 — src/types（第 2/2 批）

> 審查日期：2026-06-10 | Scope：scopes/types-1.txt | Agent：types-1 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/types/health-monitoring.ts | 417 | ✅ |
| 2 | src/types/impact.ts | 217 | ✅ |
| 3 | src/types/index.ts | 616 | ✅ |
| 4 | src/types/invoice-fields.ts | 1127 | ✅ |
| 5 | src/types/issuer-identification.ts | 358 | ✅ |
| 6 | src/types/logging.ts | 526 | ✅ |
| 7 | src/types/monitoring.ts | 289 | ✅ |
| 8 | src/types/monthly-report.ts | 392 | ✅ |
| 9 | src/types/n8n.ts | 555 | ✅ |
| 10 | src/types/next-auth.d.ts | 115 | ✅ |
| 11 | src/types/outlook.ts | 411 | ✅ |
| 12 | src/types/outlook-config.types.ts | 354 | ✅ |
| 13 | src/types/pattern.ts | 360 | ✅ |
| 14 | src/types/performance.ts | 662 | ✅ |
| 15 | src/types/permission-categories.ts | 297 | ✅ |
| 16 | src/types/permissions.ts | 181 | ✅ |
| 17 | src/types/processing-statistics.ts | 283 | ✅ |
| 18 | src/types/prompt-config.ts | 479 | ✅ |
| 19 | src/types/prompt-config-ui.ts | 274 | ✅ |
| 20 | src/types/prompt-resolution.ts | 284 | ✅ |
| 21 | src/types/reference-number.ts | 292 | ✅ |
| 22 | src/types/region.ts | 129 | ✅ |
| 23 | src/types/regional-report.ts | 229 | ✅ |
| 24 | src/types/report-export.ts | 139 | ✅ |
| 25 | src/types/restore.ts | 972 | ✅ |
| 26 | src/types/retention.ts | 477 | ✅ |
| 27 | src/types/review.ts | 657 | ✅ |
| 28 | src/types/role.ts | 147 | ✅ |
| 29 | src/types/role-permissions.ts | 220 | ✅ |
| 30 | src/types/routing.ts | 289 | ✅ |
| 31 | src/types/rule.ts | 780 | ✅ |
| 32 | src/types/rule-test.ts | 509 | ✅ |
| 33 | src/types/sdk-examples.ts | 307 | ✅ |
| 34 | src/types/sharepoint.ts | 500 | ✅ |
| 35 | src/types/suggestion.ts | 520 | ✅ |
| 36 | src/types/template-field-mapping.ts | 412 | ✅ |
| 37 | src/types/template-instance.ts | 353 | ✅ |
| 38 | src/types/template-matching-engine.ts | 476 | ✅ |
| 39 | src/types/term-learning.ts | 490 | ✅ |
| 40 | src/types/term-validation.ts | 413 | ✅ |
| 41 | src/types/traceability.ts | 209 | ✅ |
| 42 | src/types/unified-processor.ts | 784 | ✅ |
| 43 | src/types/user.ts | 199 | ✅ |
| 44 | src/types/version.ts | 255 | ✅ |
| 45 | src/types/workflow-error.ts | 368 | ✅ |
| 46 | src/types/workflow-execution.ts | 444 | ✅ |
| 47 | src/types/workflow-trigger.ts | 499 | ✅ |

全部 47 個檔案逐檔逐行完整讀取。

## 2. 發現

> 整體判斷：本批為 `src/types/` 的純型別定義與 UI 配置常量檔案。**無任何硬編碼憑證、API key、connection string、tenant/subscription ID**；**無實際 SQL/command/path 注入點**（型別檔不含執行邏輯）；**無 PII 寫入 log 的程式碼**。所有發現均為 Low / Info 等級，多屬「型別層面縱深防禦」與「需追蹤至服務層驗證」的觀察。

### [Low] types1-01 SharePoint 配置回應型別保留 `clientSecret` 同名欄位，依賴服務層遮罩

- **檔案**：src/types/sharepoint.ts:396-401、475-480；src/types/sharepoint.ts:34-38（GraphApiConfig）
- **類別**：D（Secrets 與設定）
- **描述**：`SharePointConfigResponse` 與 `SharePointConfigDetail` 用 `Omit<SharePointConfig, 'clientSecret'>` 移除 Prisma 原始密鑰後，又重新加回**同名** `clientSecret: string`（註釋說明應為遮罩後 `********`）。對比 `outlook-config.types.ts:221-225` 採用獨立的 `clientSecretMasked` 欄位，sharepoint 沿用 `clientSecret` 原欄位名。風險在於：型別系統無法區分「明文」與「已遮罩」，若服務層忘記呼叫遮罩邏輯，明文密鑰會以合法型別流入 API 回應而不被型別檢查擋下。`CLIENT_SECRET_MASK = '********'`（sharepoint.ts:499）已定義，遮罩責任完全落在服務層。
- **證據**：
  ```ts
  export interface SharePointConfigResponse extends Omit<SharePointConfig, 'clientSecret'> {
    clientSecret: string;  // 遮罩後的密鑰 ********
  }
  ```
- **建議**：與 outlook 對齊，改用 `clientSecretMasked` 獨立欄位（型別上不重用 `clientSecret`），讓「未遮罩明文不可能出現在回應型別」由型別系統保證。屬縱深防禦；實際是否洩漏需檢查 `sharepoint-config.service.ts` 的遮罩實作（不在本 scope）。

### [Low] types1-02 Outlook 配置輸入型別以明文 `clientSecret` 傳遞，加密責任在服務層

- **檔案**：src/types/outlook-config.types.ts:64-65、86、176；src/types/sharepoint.ts:352
- **類別**：D（Secrets 與設定）
- **描述**：`CreateOutlookConfigInput.clientSecret`、`UpdateOutlookConfigInput.clientSecret`、`TestConnectionInput.clientSecret`、`SharePointConfigInput.clientSecret` 均為明文 `string`（註釋「明文，儲存時加密」）。型別本身正確（建立時必然需要明文），但這提醒：1) 這些 input 物件若被整體 `console.log` 會洩漏密鑰；2) 連線測試輸入（`TestConnectionInput`）走 API 時明文密鑰在請求體中傳輸，需確保 HTTPS 與不落 log。型別檔無法解決，但標記為需在對應 API route / service 驗證的點。
- **證據**：
  ```ts
  /** 客戶端密鑰 (明文，儲存時加密) */
  clientSecret: string;
  ```
- **建議**：在處理這些 input 的 service / route 確認：(a) 寫入 DB 前加密；(b) 不整體序列化進 logger；(c) 連線測試端點有 auth 保護。屬服務層查核項，型別層無 action。

### [Info] types1-03 CUSTOM transform 型別暴露「JavaScript 表達式」欄位（已交叉確認當前實作安全）

- **檔案**：src/types/template-field-mapping.ts:104-114（CustomTransformParams.expression）
- **類別**：K（其他風險 — code injection 面）
- **描述**：`CustomTransformParams.expression` 型別註釋為「自定義 JavaScript 表達式，可用變數 value, row，例 `value.toUpperCase()`」，字面上像會被 `eval`/`Function` 執行的使用者輸入，屬潛在 RCE 信號。**已交叉確認**：實際執行此型別的 `src/services/mapping/transform-executor.ts:142-148`（CustomStrategy）只做 `${fieldName}` 字串替換（註釋「僅支援簡單替換」），**不執行 JS**；另一路 `src/services/transform/formula.transform.ts:139-167` 的公式執行雖用 `Function("use strict"; return (...))`，但對象是 FORMULA（非 CUSTOM）且前置白名單字符檢查（只允許數字與 `+-*/().`，transform-executor.ts:144 同類）。故當前無 RCE。
- **證據**：
  ```ts
  export interface CustomTransformParams {
    /** JavaScript 表達式 ... @example "value.toUpperCase()" */
    expression: string;
  }
  ```
- **建議**：型別 JSDoc 用「JavaScript 表達式」字眼具誤導性，且若日後有人按字面實作 `eval` 即成 RCE。建議將 JSDoc 改為準確描述（目前實作 = 字串模板替換），並在實作 CUSTOM 真正 JS 求值前必須 STOP+設計審查。屬觀察與防回歸提醒。

### [Info] types1-04 FORMULA / CUSTOM 公式以使用者可控字串組裝，依賴字符白名單防護

- **檔案**：src/types/template-field-mapping.ts:45-54（FormulaTransformParams.formula）；交叉確認 src/services/transform/formula.transform.ts:144-155
- **類別**：K（其他風險）
- **描述**：`FormulaTransformParams.formula` 為使用者配置的公式字串（如 `{a} + {b}`），服務層以 `Function("use strict"; return (cleanExpr))()` 求值。安全性完全依賴第 144 行的字符白名單（拒絕非數字/運算符字元）。型別檔本身無問題，但記錄此處為「白名單是唯一防線」——若白名單正則被放寬，將直接變成 code injection。
- **證據**：服務層 `if (!/^[\d+\-*/().\s]*$/.test(cleanExpr)) throw ...` 後才 `Function(...)`。
- **建議**：保持白名單嚴格；考慮改用安全運算式求值庫（如 expr-eval）取代 `Function`。屬服務層觀察，型別層無 action。

### [Info] types1-05 AI 詳情 / Prompt 解析型別暴露完整 prompt 與 OCR 全文（含潛在 PII）給前端 Tab

- **檔案**：src/types/unified-processor.ts:492-538（aiDetails / stageAiDetails，含 `prompt`、`response`）；src/types/prompt-config-ui.ts:164-168（documentText 變數）；src/types/traceability.ts:76-89（OcrResult.extractedText / rawResult）
- **類別**：E（PII 與資訊揭露面）
- **描述**：`UnifiedProcessingResult.aiDetails.prompt` / `.response` 與 `stageAiDetails.stageN.prompt/response` 型別會把「完整 GPT prompt（內含 OCR 文件全文，可能含 shipper/consignee email、電話、稅號等 PII）+ 原始 GPT 響應」帶到「AI 詳情 Tab」顯示。這是設計上給已登入審核員看的內容，型別本身不構成洩漏；但記錄此資料路徑攜帶 PII，提醒對應 API route 需有 auth + 城市範圍授權（IDOR 防護），避免低權限或跨城市使用者讀到他人文件的 prompt 全文。
- **建議**：確認提供 `aiDetails` 的 API（如 review detail / document detail）有 session + 城市範圍檢查；確認這些欄位不被寫入 plaintext log。屬服務/route 查核項。

### [Info] types1-06 日誌型別含 PII 欄位（email / ipAddress / userAgent），屬正常資料形狀

- **檔案**：src/types/logging.ts:94-105（LogEntry.ipAddress/userAgent、LogDetail.userEmail）、245-258（LogRequestContext）
- **類別**：E（PII 與日誌）
- **描述**：日誌查詢型別包含 `userEmail`、`ipAddress`、`userAgent`、`userId`。這是日誌系統合理的資料形狀（型別檔僅定義結構，非實際寫 log）。提醒：實際 logger 寫入這些欄位時應遵守 H4（不把 PII 寫 plaintext file / 應 redact），且日誌查詢 API 應限管理員（system:monitor 權限）。屬已知系統性查核項，非本檔缺陷。

### [Info] types1-07 SYSTEM_USER_ID fallback 預設值（FIX-054 後狀態，非硬編碼憑證）

- **檔案**：src/types/issuer-identification.ts:349-357（DEFAULT_IDENTIFICATION_OPTIONS.createdById）
- **類別**：D（Secrets 與設定）
- **描述**：`createdById: process.env.SYSTEM_USER_ID ?? 'system-user-1'`。FIX-054 已將原硬編碼 `'dev-user-1'` 改為 env 覆蓋 + fallback。`'system-user-1'` 為非機密的系統使用者識別字串（非密鑰、非 tenant/subscription ID），且優先讀 env。屬可接受的 fallback，非 H4 違規。記錄供確認生產環境已設定 `SYSTEM_USER_ID`。

### [Info] types1-08 型別檔內含 Azure 儲存定價與外部端點佔位字串（公開資訊，非機密）

- **檔案**：src/types/retention.ts:44-81（STORAGE_TIER_CONFIG 的 costPerGBMonth）；src/types/sdk-examples.ts:191-225（`https://api.example.com/...` 範例 base URL + `your-api-key` 佔位）
- **類別**：D（Secrets 與設定）
- **描述**：retention.ts 含 Azure Blob 分層定價（公開定價，非機密）。sdk-examples.ts 的初始化範例使用佔位 `https://api.example.com` 與 `your-api-key`/`API_KEY` 佔位符，非真實端點或密鑰。兩者均無敏感資訊洩漏。記錄以示已檢視。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 0 | 2 | 6 |

## 4. 區域整體觀察

1. **本批 100% 為型別定義 / UI 配置常量檔**，不含 API route、DB 查詢、檔案處理或認證執行邏輯，因此維度 A（authz/IDOR）、B（注入）、C（輸入驗證執行）、G（SSRF）、H（檔案處理）、I（認證機制）在本批**沒有可被直接利用的缺陷**——這些風險的實際著陸點在 services / app/api，需由對應 scope 的 agent 覆蓋。

2. **無任何硬編碼憑證 / secret / connection string / tenant ID / subscription ID / 內部主機名**。涉及密鑰的型別（GraphApiConfig、Outlook/SharePoint config input）均為合法的密鑰傳遞型別，值不在型別檔內。

3. **密鑰遮罩採「型別層縱深防禦」不一致**：outlook 用獨立 `clientSecretMasked` 欄位（較佳），sharepoint 沿用 `clientSecret` 同名欄位（types1-01），後者把「不洩漏明文」的保證完全推給服務層。建議統一為前者模式。

4. **Zod 驗證在含 schema 的型別檔中品質良好**：logging.ts、rule.ts、rule-test.ts 的 Zod schema 有 `.max()` 長度上限、分頁 `pageSize` 上限（如 logging `max(1000)`、rule-test `maxDocuments max(10000)`）、`cuid()` 格式驗證、regex 語法 `refine` 安全檢查（rule.ts:668-685 用 try/catch 包 `new RegExp` 僅驗證語法、不執行）。未見明顯的無界輸入型別缺口。

5. **兩個 transform 系統（mapping/ 與 transform/）的「自定義表達式」型別需持續盯防**（types1-03/04）：當前 CUSTOM 走純字串替換、FORMULA 走白名單 + `Function`，皆安全；但型別 JSDoc 的「JavaScript 表達式」字眼具誤導性，若日後按字面實作真正 JS 求值即成 RCE，建議修正 JSDoc 並在實作前設計審查。

6. **權限 / 角色型別定義（permissions.ts、role-permissions.ts、permission-categories.ts）結構清晰**：採 `resource:action[:scope]` 模式、System Admin = 全部權限、Auditor = 唯讀，無發現過度授權的預設角色配置問題（型別層）。
