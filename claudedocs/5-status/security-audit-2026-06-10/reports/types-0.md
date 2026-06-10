# 安全審查報告 — src/types 型別檔（第 1/2 批）

> 審查日期：2026-06-10 | Scope：scopes/types-0.txt | Agent：types-0 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/types/accuracy.ts | 289 | ✅ |
| 2 | src/types/ai-cost.ts | 404 | ✅ |
| 3 | src/types/alerts.ts | 383 | ✅ |
| 4 | src/types/alert-service.ts | 393 | ✅ |
| 5 | src/types/audit.ts | 325 | ✅ |
| 6 | src/types/audit-query.ts | 281 | ✅ |
| 7 | src/types/audit-report.ts | 430 | ✅ |
| 8 | src/types/backup.ts | 890 | ✅ |
| 9 | src/types/batch-company.ts | 132 | ✅ |
| 10 | src/types/batch-term-aggregation.ts | 244 | ✅ |
| 11 | src/types/change-request.ts | 442 | ✅ |
| 12 | src/types/change-tracking.ts | 426 | ✅ |
| 13 | src/types/city-cost.ts | 806 | ✅ |
| 14 | src/types/company.ts | 1062 | ✅ |
| 15 | src/types/company-filter.ts | 222 | ✅ |
| 16 | src/types/confidence.ts | 649 | ✅ |
| 17 | src/types/config.ts | 415 | ✅ |
| 18 | src/types/dashboard.ts | 200 | ✅ |
| 19 | src/types/dashboard-filter.ts | 181 | ✅ |
| 20 | src/types/data-template.ts | 300 | ✅ |
| 21 | src/types/date-range.ts | 145 | ✅ |
| 22 | src/types/documentation.ts | 429 | ✅ |
| 23 | src/types/document-format.ts | 637 | ✅ |
| 24 | src/types/document-issuer.ts | 186 | ✅ |
| 25 | src/types/document-progress.ts | 481 | ✅ |
| 26 | src/types/document-source.types.ts | 243 | ✅ |
| 27 | src/types/dynamic-config.ts | 379 | ✅ |
| 28 | src/types/escalation.ts | 507 | ✅ |
| 29 | src/types/exchange-rate.ts | 115 | ✅ |
| 30 | src/types/external-api/auth.ts | 344 | ✅ |
| 31 | src/types/external-api/index.ts | 52 | ✅ |
| 32 | src/types/external-api/query.ts | 251 | ✅ |
| 33 | src/types/external-api/response.ts | 314 | ✅ |
| 34 | src/types/external-api/result.ts | 366 | ✅ |
| 35 | src/types/external-api/status.ts | 303 | ✅ |
| 36 | src/types/external-api/steps.ts | 296 | ✅ |
| 37 | src/types/external-api/submission.ts | 190 | ✅ |
| 38 | src/types/external-api/validation.ts | 276 | ✅ |
| 39 | src/types/external-api/webhook.ts | 539 | ✅ |
| 40 | src/types/extracted-field.ts | 204 | ✅ |
| 41 | src/types/extraction.ts | 205 | ✅ |
| 42 | src/types/extraction-v3.types.ts | 1743 | ✅（分 2 段讀完） |
| 43 | src/types/field-mapping.ts | 1537 | ✅（分 2 段讀完） |
| 44 | src/types/format-matching.ts | 362 | ✅ |
| 45 | src/types/forwarder.ts | 848 | ✅ |
| 46 | src/types/forwarder-filter.ts | 162 | ✅ |

> **scope 覆蓋說明**：scopes/types-0.txt 共列 46 個檔案，**全部 46 個檔案皆已逐檔逐行完整讀取**（大檔 backup.ts / city-cost.ts / company.ts / confidence.ts / extraction-v3.types.ts / field-mapping.ts 以 offset 分段讀至檔尾）。無抽樣、無遺漏。

## 2. 發現

> 整體結論：本批 46 個檔案**全部為 TypeScript 型別宣告檔**（interface / type / enum / const 配置 + 純函數 helper）。型別宣告本身不執行、不持有執行期 secret、不連資料庫、不處理 HTTP 請求，因此**無 Critical、無 High 風險**。最高發現為 1 個 Medium（TYPES-09：欄位映射 CUSTOM「自訂 JavaScript 表達式」設計——本檔 helper 安全，但須在服務層 `ITransformExecutor` 實作確認非 eval）。其餘為 Low / Info 級的縱深防禦觀察與「型別揭露的下游風險點」標註，實際風險落在對應的 service / API route（屬其他 scope）。

### [Low] TYPES-01 預設備份加密演算法使用 AES-256-CBC（無認證加密模式）
- **檔案**：src/types/backup.ts:564-571（`DEFAULT_BACKUP_CONFIG`）、:223-227（`EncryptionSettings`）
- **類別**：D / K
- **描述**：預設備份加密演算法硬編碼為 `aes-256-cbc`。CBC 模式不提供完整性認證（缺 MAC），相較 `aes-256-gcm` 易受 padding oracle / 篡改攻擊。對備份檔（含資料庫匯出）而言，缺認證加密屬縱深防禦缺層。此處僅為型別預設常數，實際加密行為在備份服務。
- **證據**：
  ```ts
  export const DEFAULT_BACKUP_CONFIG = {
    ...
    encryptionAlgorithm: 'aes-256-cbc',
  } as const
  ```
- **建議**：評估改用 `aes-256-gcm`（認證加密）；若需相容既有備份，至少在備份服務層為 CBC 密文附加 HMAC 完整性校驗。

### [Low] TYPES-02 RFC 7807 錯誤 type URI 硬編碼為 placeholder 域名
- **檔案**：src/types/external-api/response.ts:305（`createExternalApiError`）
- **類別**：D / J
- **描述**：`createExternalApiError` 將錯誤 `type` 欄位硬編碼為 `https://api.example.com/errors/${params.type}`，會出現在對外 API 的錯誤回應 body。`api.example.com` 為佔位域名，非真實內部主機（不算敏感資訊洩漏），但會讓對外錯誤回應含無效/誤導性 URI。
- **證據**：
  ```ts
  return {
    type: `https://api.example.com/errors/${params.type}`,
    ...
  };
  ```
- **建議**：改用環境變數（如 `process.env.API_DOCS_BASE_URL`）或相對路徑；上線前替換 placeholder 域名。

### [Low] TYPES-03 webhookSecret 無最小長度約束
- **檔案**：src/types/external-api/auth.ts:281（`CreateApiKeySchema`）、:305（`UpdateApiKeySchema`）
- **類別**：C / I
- **描述**：`webhookSecret: z.string().max(128).optional()` 只限制上限 128，未設最小長度。允許過短（甚至 1 字元）的 HMAC 簽名密鑰，弱化 webhook 簽名強度。屬輸入驗證縱深防禦缺層；實際安全取決於是否由系統生成密鑰或允許使用者自帶。
- **證據**：
  ```ts
  webhookSecret: z.string().max(128).optional(),
  ```
- **建議**：若允許使用者自帶密鑰，加 `.min(16)`（或更高）；最佳作法是由系統生成高熵密鑰，不接受使用者輸入。

### [Info] TYPES-04 API Key 的 allowedIps / blockedIps 無 IP 格式驗證
- **檔案**：src/types/external-api/auth.ts:279-280、:303-304（Create/Update `ApiKeySchema`）
- **類別**：C
- **描述**：`allowedIps` / `blockedIps` 為 `z.array(z.string())`，未驗證每個元素是否為合法 IP / CIDR。錯誤格式的 IP 規則可能導致 IP 白名單/黑名單靜默失效（fail-open 風險取決於中間件如何比對）。
- **建議**：加 `z.string().ip()` 或 CIDR 驗證；確保中間件對無法解析的 IP 規則採 fail-closed。

### [Info] TYPES-05 型別揭露下游 PII / 識別資料（須在 API route 層確認遮罩）
- **檔案**：
  - src/types/document-source.types.ts:48-79（`ManualUploadSourceMetadata.sourceIp`/`userAgent`、`ApiSourceMetadata.apiKeyId`）、:118-148（`SourceDetails.outlook.senderEmail`、`api.apiKeyId`）
  - src/types/extraction.ts:71-109（`InvoiceData.vendorAddress`/`customerAddress` 等 PII）
  - src/types/audit.ts:75-110（`AuditLogEntry.userEmail`/`ipAddress`/`userAgent`/`sessionId`）
  - src/types/alerts.ts:159-173、src/types/alert-service.ts:141-145（response 型別內含 `email`）
  - src/types/external-api/auth.ts:204-235（`ApiAuditLogEntry.clientIp`/`requestBody`）
- **類別**：E / J
- **描述**：上述 response / metadata 型別宣告中包含 email、IP、user-agent、session、API key 識別、發票交易方地址等 PII / 識別資料。型別宣告本身不構成洩漏，但標示了「這些欄位會流向前端 / 日誌 / API 回應」的資料路徑。需在對應的 service / API route 確認：(a) 對外 API 回應不回 `sessionId` / 完整 IP；(b) 日誌寫入時依 `external-api/auth.ts` 的 `SENSITIVE_FIELDS` 過濾。
- **建議**：交由 service / API route scope 驗證實際序列化欄位；本批型別層不需修改。

### [Info] TYPES-06 SAS 下載 URL / connectionString 出現在 response 型別（須確認傳遞範圍）
- **檔案**：src/types/external-api/result.ts:180-193（`DocumentDownloadResponse.downloadUrl`，含 SAS Token，1 小時有效）；src/types/backup.ts:232-237（`StorageSettings.connectionString?`）
- **類別**：D
- **描述**：`DocumentDownloadResponse` 回傳含 SAS Token 的下載 URL（短時效 1 小時，設計合理）。`StorageSettings.connectionString` 為可選欄位——若此型別被用於對前端的備份配置回應，Azure Blob 連線字串可能外洩。型別層無法判定實際傳遞範圍。
- **建議**：確認 `StorageSettings` 僅用於後端內部，對外回應的備份配置型別不得包含 `connectionString`（應遮罩或省略）。

### [Info] TYPES-07 外部 API URL/callbackUrl 限制協議但未限制目標主機（SSRF 防護須在服務層）
- **檔案**：src/types/external-api/validation.ts:72-96（`urlSubmissionSchema`）、:111-125（`commonParamsSchema.callbackUrl`）
- **類別**：G
- **描述**：URL 提交與 callbackUrl 的 Zod 驗證已正確限制僅 http/https 協議（擋掉 `file:`/`gopher:` 等），但**未限制目標主機**（無私網位址 / metadata endpoint `169.254.169.254` 封鎖、無 allowlist）。對「從 URL 取檔」與「callbackUrl 回呼」兩條路徑，SSRF 防護必須在實際發起 fetch 的服務層（`invoice-submission.service.ts` / webhook 服務）實施。本批型別層的協議限制是正確的第一層防禦。
- **建議**：在服務層 fetch 前加私網/保留位址封鎖與 DNS rebinding 防護；本批型別檔不需改。

### [Medium] TYPES-09 欄位映射 CUSTOM 轉換含「自訂 JavaScript 表達式」設計，須在服務層確認非 eval 執行
- **檔案**：src/types/field-mapping.ts:531（`TransformType`）、:571-574（`TRANSFORM_TYPE_OPTIONS` CUSTOM 描述「使用自訂 JavaScript 表達式進行轉換」）、:625-628（`TransformParams.expression`/`customFormula`）、:792-793（`TransformParamsSchema` 對 expression 無內容約束）、:1039-1050（`executeTransform` CUSTOM 分支）、:1441-1452（`ITransformExecutor` 介面）
- **類別**：B / K
- **描述**：映射規則的 CUSTOM 轉換類型在 UI 描述為「使用自訂 JavaScript 表達式」，`expression` / `customFormula` 欄位為使用者可設定（映射配置由具 RULE_MANAGE 權限者編輯）。`TransformParamsSchema` 的 `expression: z.string().optional()` 完全無內容/長度約束。
  - **本檔內的 `executeTransform`（:1039-1050）實作是安全的**：CUSTOM 分支僅做 `${field}` 字串 `.replace()` 佔位符替換，未使用 `eval` / `new Function`，註釋亦標明「僅支援簡單替換」。此 helper 不構成 RCE。
  - **風險點在服務層的 `ITransformExecutor` 實作**：Story 13.5 定義了 `ITransformExecutor.execute()` / `IFieldMappingEngine` 介面交由 `src/services/mapping/field-mapping-engine.ts`（及相關 transform-executor）實作。若該服務層實作對 `expression` 採 `eval` / `new Function` / `vm` 執行，則具 RULE_MANAGE 權限者可注入任意 JavaScript（伺服端 RCE）。型別層無法判定服務層實際實作。
- **證據**：
  ```ts
  // field-mapping.ts:571-574
  { value: 'CUSTOM', label: '自訂表達式',
    description: '使用自訂 JavaScript 表達式進行轉換' },
  // field-mapping.ts:792-793（無長度/內容約束）
  expression: z.string().optional(),
  customFormula: z.string().optional(),
  // field-mapping.ts:1040-1048（本檔 helper —— 安全的字串替換，非 eval）
  // 安全執行自訂表達式（僅支援簡單替換）
  targetValue = expression;
  sourceFields.forEach((field, idx) => {
    targetValue = targetValue.replace(new RegExp(`\\$\\{${field}\\}`, 'g'), values[idx] ?? '');
  });
  ```
- **建議**：在 `src/services/mapping/` 的 `ITransformExecutor` 實作 scope 重點驗證 CUSTOM expression **絕不**經 `eval`/`new Function`/`vm` 執行；應沿用本檔 `executeTransform` 的純字串替換策略，或使用安全沙箱（如受限運算式解析器）。同時可在 `TransformParamsSchema` 為 `expression` 加長度上限與字元白名單作為縱深防禦。

### [Info] TYPES-10 AI 詳情型別含完整 Prompt / GPT 原始 Response（PII），且有寫日誌 flag
- **檔案**：src/types/extraction-v3.types.ts:826-846（`AiDetailsV3`：`prompt`/`response`）、:1029-1048（`StageAiDetails`：`prompt`/`response`）、:857-907（`ExtractionV3Flags.logPromptAssembly`/`logGptResponse`，預設 false）、:692-735（`ExtractionV3Output.aiDetails`/`stageAiDetails`）
- **類別**：E / J
- **描述**：`AiDetailsV3` / `StageAiDetails` 完整保存組裝後的 Prompt（含內部已知公司清單、識別規則等配置）與 GPT 原始 JSON 響應（含發票 PII：供應商/客戶名稱、金額、地址）。這些經 `ExtractionV3Output` 流向「AI 詳情 Tab」。`logPromptAssembly` / `logGptResponse` 兩個除錯 flag 預設關閉（良好預設），但開啟時會把含 PII 的 prompt/response 寫入日誌。
- **建議**：交由 service / API route scope 確認：(a)「AI 詳情 Tab」對應 API 有 admin/權限檢查，不對外洩漏內部 prompt 配置；(b) `logGptResponse` 在 production 環境保持關閉，或寫日誌前對 PII 遮罩。本批型別層不需修改。

### [Info] TYPES-11 良好安全實踐（記錄以利後續驗證未回歸）
- **檔案 / 觀察**：
  - src/types/change-tracking.ts:270-278（`EXCLUDED_FIELDS`）正確排除 `password`/`passwordHash`/`refreshToken`/`accessToken`/`sessionToken`，變更追蹤不記錄敏感欄位。
  - src/types/external-api/auth.ts:108-143（`ApiKeyResponse` 明示「不含敏感資訊」只回 `keyPrefix`）、:148-155（`rawKey` 僅創建時返回一次）、:240-252（`SENSITIVE_FIELDS` 日誌過濾清單完整）。
  - src/types/config.ts:81-84、:351-354（`isEncrypted` 旗標、`SECRET` 值類型、「敏感值會被遮罩」註釋）。
  - src/types/external-api/webhook.ts:331-340、:538（HMAC-SHA256 簽名 header、`TIMESTAMP_TOLERANCE_SECONDS = 300` 防重放）。
  - src/types/external-api/validation.ts:56-59、:88-94（檔名正則 `/^[a-zA-Z0-9._-]+$/` 防 path traversal）。
  - 多數查詢 Zod schema（company.ts、forwarder.ts、audit-query.ts、external-api/query.ts）正確限制分頁 `limit` 上限（≤100）與批量上限（≤100/50），降低無界查詢 / DoS 面。
- **類別**：A–K（正向）
- **建議**：無需修改，後續服務層審查時確認這些約定確實被執行。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 1 | 3 | 7 |

## 4. 區域整體觀察

1. **本批全為純型別宣告檔，無執行期安全風險**：46 個檔案皆為 interface / type / enum / 配置常數 / 純 helper 函數。沒有硬編碼憑證、connection string、tenant ID、subscription ID，也沒有任何 raw SQL / exec / fetch 等可被攻擊的執行路徑。FIX-050（auth.config console.log email）、FIX-051（db-context SQL injection）兩個歷史問題的檔案不在本批，無回歸跡象。

2. **Zod 驗證品質整體良好**：external-api 系列、company.ts、forwarder.ts、audit-query.ts 的 Zod schema 普遍有長度上限、枚舉約束、分頁上限、正則檢查（檔名、城市代碼、公司代碼）。檔案上傳型別有 MIME allowlist + 50MB 上限 + Base64 大小驗證。URL 提交限制 http/https 協議。

3. **敏感資料隔離意識存在**：`SENSITIVE_FIELDS` 過濾清單、`EXCLUDED_FIELDS` 變更追蹤排除、`ApiKeyResponse` 不含 rawKey、`config.ts` 的 `isEncrypted`/`SECRET` 機制，顯示設計層已考慮 secret/PII 隔離。

4. **真正的風險落在下游 service / API route**：型別層揭露了多條「PII / SAS URL / connectionString / 使用者輸入 URL」的資料路徑（TYPES-05/06/07）。這些是否構成實際洩漏 / SSRF，取決於 API route 是否回傳全部欄位、service 是否在 fetch 前做 SSRF 防護。建議在 services / api routes 的 scope 重點驗證：(a) 對外回應遮罩 sessionId / connectionString；(b) URL fetch 與 webhook 回呼的私網位址封鎖。

5. **最值得追蹤到服務層的單點：TYPES-09（CUSTOM 表達式）**：field-mapping.ts 的 CUSTOM 轉換在 UI 描述為「自訂 JavaScript 表達式」，Schema 對 expression 無任何約束。本檔內的 `executeTransform` helper 實作是安全的純字串替換（非 eval），但 Story 13.5 的 `ITransformExecutor` 介面把 expression 執行交給 `src/services/mapping/` 實作。**強烈建議在 services scope 確認該實作未使用 eval / new Function / vm**——這是唯一一個若服務層實作不當即可升級為 Critical（RCE）的設計點。

6. **可在型別/驗證層直接收斂的 3 個 Low**：TYPES-01（CBC→GCM）、TYPES-02（placeholder 域名）、TYPES-03（webhookSecret 最小長度）屬縱深防禦改善，可在型別/驗證層直接修，成本低。
