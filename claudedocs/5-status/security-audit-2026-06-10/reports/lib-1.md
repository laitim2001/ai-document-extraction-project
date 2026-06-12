# 安全審查報告 — src/lib 後半（metrics/pdf/prompts/reports/routing/upload/utils/validations 等）

> 審查日期：2026-06-10 | Scope：scopes/lib-1.txt | Agent：lib-1 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/lib/password.ts | 174 | ✅ |
| 2 | src/lib/pdf/coordinate-transform.ts | 345 | ✅ |
| 3 | src/lib/pdf/index.ts | 8 | ✅ |
| 4 | src/lib/prisma.ts | 67 | ✅ |
| 5 | src/lib/prisma-change-tracking.ts | 292 | ✅ |
| 6 | src/lib/prompts/extraction-prompt.ts | 403 | ✅ |
| 7 | src/lib/prompts/index.ts | 53 | ✅ |
| 8 | src/lib/prompts/optimized-extraction-prompt.ts | 375 | ✅ |
| 9 | src/lib/redis.ts | 74 | ✅ |
| 10 | src/lib/reports/excel-generator.ts | 281 | ✅ |
| 11 | src/lib/reports/excel-i18n.ts | 401 | ✅ |
| 12 | src/lib/reports/hierarchical-terms-excel.ts | 459 | ✅ |
| 13 | src/lib/reports/index.ts | 28 | ✅ |
| 14 | src/lib/reports/pdf-generator.ts | 252 | ✅ |
| 15 | src/lib/routing/config.ts | 209 | ✅ |
| 16 | src/lib/routing/index.ts | 43 | ✅ |
| 17 | src/lib/routing/router.ts | 301 | ✅ |
| 18 | src/lib/token.ts | 98 | ✅ |
| 19 | src/lib/upload/constants.ts | 189 | ✅ |
| 20 | src/lib/upload/index.ts | 18 | ✅ |
| 21 | src/lib/url-params.ts | 206 | ✅ |
| 22 | src/lib/utils.ts | 40 | ✅ |
| 23 | src/lib/utils/string.ts | 204 | ✅ |
| 24 | src/lib/validations/exchange-rate.schema.ts | 302 | ✅ |
| 25 | src/lib/validations/field-definition-set.schema.ts | 296 | ✅ |
| 26 | src/lib/validations/outlook-config.schema.ts | 273 | ✅ |
| 27 | src/lib/validations/pipeline-config.schema.ts | 191 | ✅ |
| 28 | src/lib/validations/prompt-config.schema.ts | 463 | ✅ |
| 29 | src/lib/validations/reference-number.schema.ts | 463 | ✅ |
| 30 | src/lib/validations/region.schema.ts | 201 | ✅ |
| 31 | src/lib/validations/role.schema.ts | 186 | ✅ |
| 32 | src/lib/validations/user.schema.ts | 155 | ✅ |

> 註：清單標題提及 `metrics/middleware`，但實際 scope 檔案未列入 metrics/middleware 路徑；本報告涵蓋 scope 檔案中實際列出的 32 個檔案，全部完整讀取。

## 2. 發現

### [Medium] lib-1-M1 Excel 報告存在公式注入（CSV/Formula Injection）風險
- **檔案**：src/lib/reports/excel-generator.ts:235-256、src/lib/reports/hierarchical-terms-excel.ts:389-413
- **類別**：H（檔案處理）/ K（其他風險）
- **描述**：兩個 Excel 產生器都直接把字串寫入儲存格，未對以 `=`、`+`、`-`、`@`（或 `\t`、`\r`）開頭的值做前綴轉義。寫入的內容來源是**攻擊者可控的提取資料**：
  - excel-generator.ts 的 `detail.document.fileName`、`originalResult`、`testResult`、`actualValue` 來自上傳文件檔名與 OCR/規則測試結果；
  - hierarchical-terms-excel.ts 的 `term`、`examples`、`companyName` 來自 OCR 提取的發票術語與發行公司名稱。
  
  若惡意發票內含 `=HYPERLINK(...)`、`=cmd|'/c calc'!A1` 之類字串，開啟匯出的 Excel 時可能被 Excel/LibreOffice 當公式執行，導致資料外洩或本機命令觸發（取決於使用者點擊與用戶端設定）。
- **證據**：
  ```ts
  // excel-generator.ts:236-245
  const row = detailsSheet.addRow({
    fileName: detail.document.fileName,
    originalResult: detail.originalResult ?? '',
    testResult: detail.testResult ?? '',
    actualValue: detail.actualValue ?? '',
    ...
  })
  ```
- **建議**：寫入字串型儲存格前做公式注入防護——若值開頭為 `= + - @ Tab CR`，前置單引號 `'` 或設定 `cell.value` 為強制文字；或集中一個 `sanitizeCell()` helper 套用到所有外部來源字串欄位。

### [Medium] lib-1-M2 Outlook 過濾規則的 REGEX 值未做安全性驗證（潛在 ReDoS）
- **檔案**：src/lib/validations/outlook-config.schema.ts:182-217（`ruleOperatorEnum` 含 `REGEX`、`createFilterRuleSchema.ruleValue`）
- **類別**：C（輸入驗證）/ K（ReDoS）
- **描述**：`ruleValue` 僅驗證 `min(1)`，當 `operator='REGEX'` 或 `ruleType='SUBJECT_REGEX'` 時，此字串會於下游被直接編譯成正則並對郵件主旨/寄件者執行——`src/services/outlook-config.service.ts:741,775`、`src/services/outlook-document.service.ts:595` 皆為 `new RegExp(ruleValue, 'i')`。未限制長度、未檢查災難性回溯模式，具設定權限者（或被入侵的管理介面）可植入 `(a+)+$` 類 pattern，在郵件輪詢時造成 CPU 阻塞（ReDoS）。
- **證據**：
  ```ts
  // outlook-config.schema.ts
  ruleValue: z.string().min(1, '規則值為必填'),
  operator: ruleOperatorEnum.default('CONTAINS'), // 含 'REGEX'
  // 下游：outlook-config.service.ts:741
  const regex = new RegExp(ruleValue, 'i');
  ```
- **建議**：對 REGEX 類 `ruleValue` 加長度上限與 try/catch 編譯驗證，並考慮以 `re2`（線性時間引擎）或加入逾時保護執行；至少在 schema 層 `.max()` 限制長度。

### [Low] lib-1-L1 變更追蹤 EXCLUDED_FIELDS 未排除 email/password 重設 Token
- **檔案**：src/lib/prisma-change-tracking.ts:100-200（透過 `filterExcludedFields`），對照 src/types/change-tracking.ts:270-278
- **類別**：E（PII 與日誌）/ D（Secrets）
- **描述**：`EXCLUDED_FIELDS` 僅含 `password/passwordHash/refreshToken/accessToken/sessionToken`，**未包含** `User` 模型上的 `emailVerificationToken`、`passwordResetToken`（schema.prisma:24,27，皆為敏感 `@unique` token）。`user` 屬於受追蹤模型（TRACKED_MODELS 含 `user`），一旦未來有經 `withChangeTracking`/`recordCreate/Update` 記錄 user 變更的路徑，這些 token 會以明文寫入 `DataChangeHistory.snapshot`。目前認證流程（register/forgot-password/reset-password 等 route）是直接 `prisma.user.update` 未走變更追蹤，故為潛在/縱深防禦缺口而非現行外洩。
- **證據**：
  ```ts
  // types/change-tracking.ts:270
  export const EXCLUDED_FIELDS: string[] = [
    'updatedAt','createdAt','password','passwordHash',
    'refreshToken','accessToken','sessionToken', // 缺 emailVerificationToken / passwordResetToken
  ];
  ```
- **建議**：把 `emailVerificationToken`、`passwordResetToken`（及任何 `*Token`/`*Secret`）加入 `EXCLUDED_FIELDS`。

### [Low] lib-1-L2 上傳檔案類型驗證僅依賴用戶端提供的 MIME，無內容（magic byte）檢查
- **檔案**：src/lib/upload/constants.ts:78-80（`isAllowedType`），消費端 src/app/api/documents/upload/route.ts:289
- **類別**：H（檔案處理）/ C（輸入驗證）
- **描述**：`isAllowedType(file.type)` 檢查的是瀏覽器送出的 `file.type`（Content-Type），可被任意偽造；上傳 route 也僅以此判斷，未比對副檔名或檔頭魔術位元組。攻擊者可將任意檔案宣告為 `application/pdf` 通過驗證。實際下游為 Azure Document Intelligence OCR，非 PDF 多半解析失敗，故影響有限（不致 RCE/路徑穿越），屬縱深防禦缺層。
- **證據**：
  ```ts
  export function isAllowedType(mimeType: string): mimeType is AllowedMimeType {
    return UPLOAD_CONFIG.ALLOWED_TYPES.includes(mimeType as AllowedMimeType);
  }
  ```
- **建議**：上傳時讀取檔案前幾個位元組驗證真實格式（PDF `%PDF`、JPEG `FFD8`、PNG `89504E47`），並交叉比對副檔名。

### [Low] lib-1-L3 密碼政策偏弱（最小長度 8、不要求特殊字元）
- **檔案**：src/lib/password.ts:40-51、75-128
- **類別**：I（認證機制本身）
- **描述**：`PASSWORD_REQUIREMENTS` 最小長度 8、`requireSpecialChar: false`。雜湊本身使用 bcrypt（rounds 12，可由 `BCRYPT_SALT_ROUNDS` 調整）且 `verifyPassword` 用 `bcrypt.compare`（常數時間比較）——這些都正確。僅密碼複雜度屬最佳實踐缺失。
- **證據**：`minLength: 8`、`requireSpecialChar: false`。
- **建議**：考慮提升至 12 字元並依風險決定是否要求特殊字元；屬政策決策，非技術缺陷。

### [Low] lib-1-L4 開發環境 Prisma 查詢日誌可能輸出 PII 至 console
- **檔案**：src/lib/prisma.ts:52-57
- **類別**：E（PII 與日誌）
- **描述**：`NODE_ENV === 'development'` 時 log 等級為 `['query','error','warn']`，會把含參數（可能含 email 等 PII）的 SQL 輸出到 console。僅限開發環境，生產為 `['error']`，屬 Prisma 標準行為，風險低。
- **證據**：
  ```ts
  log: process.env.NODE_ENV === 'development' ? ['query','error','warn'] : ['error'],
  ```
- **建議**：知悉即可；若不希望本機印出含 PII 的查詢，可移除 `'query'`。

### [Info] lib-1-I1 buildUrlWithDateRange 以外部 baseUrl 建構 URL
- **檔案**：src/lib/url-params.ts:121-146
- **類別**：F（前端）/ K
- **描述**：`new URL(baseUrl, window.location.origin)` 若 `baseUrl` 傳入完整外部 URL，會以該外部來源為基底；寫入的參數值皆為已驗證的 ISO 日期，無注入風險。屬觀察，呼叫端應確保 `baseUrl` 為內部相對路徑。

### [Info] lib-1-I2 Prompt 模板為靜態字串，未注入使用者文字
- **檔案**：src/lib/prompts/extraction-prompt.ts、optimized-extraction-prompt.ts
- **類別**：B（注入）觀察
- **描述**：提取 Prompt 全為靜態常數，與圖片一起送至 GPT Vision，未在本層串接使用者輸入字串，無 prompt injection 串接點。屬觀察，正面確認。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 2 | 4 | 2 |

## 4. 區域整體觀察

- **Zod 驗證品質整體良好**：9 個 `validations/*.schema.ts` 普遍有長度/數值/枚舉約束，分頁 `limit` 一致上限 100、批次匯入/查詢皆設上限（exchange-rate 50/500、reference-number 100/1000、field-definition-set 200 欄位），有效抵禦無界查詢與大量匯入 DoS。`scope` 條件式必填（COMPANY/FORMAT/REGION）以 `refine/superRefine` 妥善處理。主要缺口是 outlook REGEX 值未驗證（M2）。
- **Token / 密碼基礎建設安全**：`token.ts` 使用 `crypto.randomBytes`（非 `Math.random`），`password.ts` 用 bcrypt + 常數時間比較，無不安全隨機數問題。
- **Secrets 管理乾淨**：`prisma.ts`、`redis.ts` 全由 `process.env` 讀取，無硬編碼連線字串、tenant/subscription ID 或金鑰；redis 未配置時優雅回傳 null。
- **系統性風險集中在「外部資料 → 匯出/正則」路徑**：本區最值得處理的是 Excel 報告的公式注入（M1），因報告資料源自攻擊者可控的上傳檔名與 OCR 提取內容；PDF 產生器（pdf-generator.ts）以純文字渲染則無此問題。
- **變更追蹤排除清單需補強**（L1）：敏感欄位排除清單未涵蓋 `*Token` 類，建議比照 password 一併排除以防未來新增追蹤路徑時外洩。
- 本批檔案無 SQL raw query、無 command exec/spawn、無 `dangerouslySetInnerHTML`、無客戶端 import prisma、無 FIX-050/051 回歸跡象。
