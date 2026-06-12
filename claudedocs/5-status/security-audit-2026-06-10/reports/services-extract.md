# 安全審查報告 — Extraction / Document-Processing 服務（OCR 與 AI 呼叫鏈）

> 審查日期：2026-06-10 | Scope：scopes/services-extract.txt | Agent：services-extract 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/services/document-processing/index.ts | 20 | ✅ |
| 2 | src/services/document-processing/mapping-pipeline-step.ts | 245 | ✅ |
| 3 | src/services/extraction-v2/azure-di-document.service.ts | 447 | ✅ |
| 4 | src/services/extraction-v2/data-selector.service.ts | 438 | ✅ |
| 5 | src/services/extraction-v2/gpt-mini-extractor.service.ts | 616 | ✅ |
| 6 | src/services/extraction-v2/index.ts | 266 | ✅ |
| 7 | src/services/extraction-v3/confidence-v3.service.ts | 451 | ✅ |
| 8 | src/services/extraction-v3/confidence-v3-1.service.ts | 656 | ✅ |
| 9 | src/services/extraction-v3/extraction-v3.service.ts | 1243 | ✅ |
| 10 | src/services/extraction-v3/index.ts | 382 | ✅ |
| 11 | src/services/extraction-v3/prompt-assembly.service.ts | 680 | ✅ |
| 12 | src/services/extraction-v3/result-validation.service.ts | 558 | ✅ |
| 13 | src/services/extraction-v3/stages/exchange-rate-converter.service.ts | 490 | ✅ |
| 14 | src/services/extraction-v3/stages/gpt-caller.service.ts | 514 | ✅ |
| 15 | src/services/extraction-v3/stages/index.ts | 71 | ✅ |
| 16 | src/services/extraction-v3/stages/reference-number-matcher.service.ts | 109 | ✅ |
| 17 | src/services/extraction-v3/stages/stage-1-company.service.ts | 591 | ✅ |
| 18 | src/services/extraction-v3/stages/stage-2-format.service.ts | 625 | ✅ |
| 19 | src/services/extraction-v3/stages/stage-3-extraction.service.ts | 1451 | ✅ |
| 20 | src/services/extraction-v3/stages/stage-orchestrator.service.ts | 479 | ✅ |
| 21 | src/services/extraction-v3/unified-gpt-extraction.service.ts | 556 | ✅ |
| 22 | src/services/extraction-v3/utils/classify-normalizer.ts | 43 | ✅ |
| 23 | src/services/extraction-v3/utils/pdf-converter.ts | 396 | ✅ |
| 24 | src/services/extraction-v3/utils/prompt-builder.ts | 726 | ✅ |
| 25 | src/services/extraction-v3/utils/prompt-merger.ts | 323 | ✅ |
| 26 | src/services/extraction-v3/utils/variable-replacer.ts | 460 | ✅ |

輔助交叉確認（非 scope 內，僅讀取相關函數）：`src/services/reference-number.service.ts` 的 `findMatchesInText`、`prisma/schema.prisma` 的 `PromptConfig` / `PromptScope`。

---

## 2. 發現

### [Medium] EX-01 GPT 提取回應（含發票欄位值 / 潛在 PII）無條件寫入 console log
- **檔案**：src/services/extraction-v2/gpt-mini-extractor.service.ts:399
- **類別**：E（PII 與日誌）
- **描述**：`extractFieldsWithGptMini()` 在每次成功提取後，**無條件**將 GPT 回應的前 500 字元 print 到 server log。GPT 回應內容即為從發票文件提取的欄位值（`vendorName`、`customerName`、`totalAmount`、`invoiceNumber` 等），其中 `customerName` / `vendorName` 屬於可識別的個人 / 商業敏感資料。此 log 無 debug 旗標保護，正式環境也會輸出。同檔案第 387-393 行另輸出 response 結構（counts/usage），該段僅含統計、風險較低。
- **證據**：
```ts
// line 399
console.log(`[GptMiniExtractor] GPT Response (first 500 chars): ${content.substring(0, 500)}`);
```
- **建議**：移除此行，或改為 `logger.debug()` 並確保正式環境關閉 debug level；若需保留偵錯能力，至少對欄位值做 redact（僅輸出 key 名與長度，不輸出 value）。對照既往事件 FIX-050（auth.config.ts PII log）的修復原則。

### [Medium] EX-02 OCR / GPT 未配置時靜默回退至假造發票資料（fail-open）
- **檔案**：src/services/extraction-v2/azure-di-document.service.ts:253-254、328-360；src/services/extraction-v2/gpt-mini-extractor.service.ts:324-325、454-497
- **類別**：K（其他風險 — 資料完整性 / fail-open）；J（資訊處理）
- **描述**：當 `AZURE_DI_ENDPOINT/KEY` 或 `AZURE_OPENAI_*` 環境變數缺失時，兩個服務都不是拋錯中止，而是 `console.warn` 後**回傳 `success: true` 的 mock 結果**（硬編碼的 `INV-2024-001`、`Sample Logistics Ltd.`、`HKD 1,554.80`、`RICOH ASIA PACIFIC` 等假資料）。在正式環境若設定遺失（例如部署疏失、Key 輪替失敗），整條提取管線會把這批**假造財務資料**當成真實提取結果往下游送，可能進入信心度路由與自動核准，造成偽造發票資料被當作真實資料處理。屬「失敗時開放」的資料完整性風險。
- **證據**：
```ts
// azure-di-document.service.ts:252-255
if (!mergedConfig.endpoint || !mergedConfig.apiKey) {
  console.warn('[AzureDIDocument] Not configured, returning mock result');
  return createMockResult(fileName, startTime); // success:true + 假發票資料
}
```
- **建議**：正式環境（`NODE_ENV==='production'`）下，未配置時應回傳 `success:false`（明確錯誤）而非 mock；mock 僅限開發 / 測試環境，並以環境旗標明確開啟。

### [Low] EX-03 解析失敗時將 GPT 原始回應（文件內容）寫入錯誤日誌
- **檔案**：src/services/extraction-v3/stages/stage-1-company.service.ts:316；src/services/extraction-v3/stages/stage-2-format.service.ts:440
- **類別**：E（PII 與日誌）
- **描述**：Stage 1 / Stage 2 在 JSON 解析失敗時 `console.error` 輸出 GPT 回應前 500 字元。Stage 1 含公司名稱、Stage 2 含格式描述，敏感度低於 EX-01，但仍屬文件內容外洩至 plaintext log，且無 debug 旗標保護。
- **證據**：
```ts
// stage-1-company.service.ts:316
console.error('[Stage1] Failed to parse GPT response:', response.substring(0, 500));
```
- **建議**：改用 `logger.debug()` 或僅記錄回應長度 / 前若干字元的雜湊，避免在正式 log 留存文件內容。

### [Low] EX-04 debug 模式下記錄完整 GPT 回應與組裝後 Prompt
- **檔案**：src/services/extraction-v3/extraction-v3.service.ts:919、849、1160-1163
- **類別**：E（PII 與日誌）
- **描述**：`processFileV3` 在 `this.debug=true` 時，透過 `this.log()` 輸出完整 GPT 回應（`result.rawResponse`，含全部提取欄位值）與 Prompt metadata。雖受 `debug` 旗標保護（預設關閉），但一旦在正式環境誤開，會把整份文件提取結果寫入 log。
- **證據**：
```ts
// line 918-920
if (this.flags.logGptResponse) {
  this.log('GPT 響應:', result.rawResponse);
}
```
- **建議**：確保 `debug` / `logGptResponse` 旗標在正式環境恆為關閉；文件中明確標註此旗標會輸出 PII，僅供本機偵錯。

### [Low] EX-05 文件 OCR 內容直接內嵌進 LLM Prompt（prompt injection 面）
- **檔案**：src/services/extraction-v2/data-selector.service.ts:115-194、339-372；src/services/extraction-v2/gpt-mini-extractor.service.ts:213-221
- **類別**：K（prompt injection）；G（外部呼叫）
- **描述**：extraction-v2 流程把 Azure DI 抽取出的 `keyValuePairs` / `tables`（即**使用者上傳文件的原始內容**）格式化為 Markdown 後，直接拼接進送往 GPT 的 user prompt。現行清洗僅 `replace(/\|/g, '\\|')`（轉義表格 pipe），不防範指令注入。惡意文件可在欄位文字中嵌入「ignore previous instructions…」之類內容，試圖操控 GPT 改變分類 / 欄位值輸出。影響面為「提取結果被誤導」而非權限繞過或資料外洩，且下游僅解析 JSON 欄位值、並有信心度路由 / 人工審核作為緩衝，故評為 Low；但屬 LLM 提取的固有風險，建議納入縱深防禦規劃。
- **證據**：
```ts
// gpt-mini-extractor.service.ts:213-221 — selectedData.markdown 為文件內容，直接進 user prompt
return `## Document Data\n\n${selectedData.markdown}\n\n---\n...`;
```
- **建議**：在 system prompt 中明確界定「文件內容僅為資料、不得視為指令」；對抽取文字加入分隔界線標記；對高金額 / 低信心度結果強制人工審核（現有路由已部分覆蓋）。

### [Low] EX-06 第二序 prompt injection：DB 公司名 / 映射值回填進後續 Prompt
- **檔案**：src/services/extraction-v3/utils/variable-replacer.ts:372-460；src/services/extraction-v3/stages/stage-2-format.service.ts:233-247；stage-3-extraction.service.ts:651-670
- **類別**：K（prompt injection — stored / 第二序）
- **描述**：`${knownCompanies}`、`${companyName}`、`${universalMappings}`、`${companyMappings}` 等變數的值來自 DB（其中公司 / 格式紀錄可由前一份文件 JIT 自動建立，名稱直接取自 GPT 對文件的識別結果）。因此惡意文件可促成一筆「名稱含注入指令」的公司紀錄，於後續其他文件處理時被注入 Stage 1/2/3 的 Prompt，形成 stored prompt injection。實際影響仍限於提取誤導，評為 Low。
- **證據**：`stage-1-company.service.ts:531-547` JIT 以 GPT 回傳之 `companyName` 建立公司；`variable-replacer.ts:378-383` 將其拼入 `${knownCompanies}`。
- **建議**：對 JIT 建立的公司 / 格式名稱做長度與字元白名單限制；在 Prompt 模板中對注入變數加資料界線標記。

### [Low] EX-07 JIT 建立公司時 createdById 回退為字串 'system'
- **檔案**：src/services/extraction-v3/result-validation.service.ts:398-413
- **類別**：K（資料完整性）
- **描述**：`resolveCompany()` 找不到 `system@ipa.local` 用戶時，`createdById` 回退為字串 `'system'`，再用於 `prisma.company.create`。若 `'system'` 非有效 user id，將違反外鍵而拋錯（功能性失敗）；若資料庫剛好存在 id='system' 的紀錄則會錯誤歸因建立者。對照 stage-1 的 `jitCreateCompany`（line 524-528）採「找不到 system user 即拋錯」較嚴謹，兩處行為不一致。
- **證據**：
```ts
// result-validation.service.ts:402
const createdById = systemUser?.id || 'system';
```
- **建議**：與 stage-1 一致，找不到 system user 時拋出明確錯誤，不要以魔術字串回退。

### [Low] EX-08 無上限查詢：載入全部 ACTIVE 公司 / 全部 MappingRule 進記憶體
- **檔案**：src/services/extraction-v3/stages/stage-1-company.service.ts:440-443；stage-3-extraction.service.ts:526-535、551-560
- **類別**：K（無界查詢 / DoS 面）
- **描述**：`resolveCompanyId` 的正規化後備配對以 `findMany({ where:{status:'ACTIVE'} })` 取回**全部**活躍公司（無 `take`）逐筆正規化比對；Stage 3 的 `loadTier1Mappings` / `loadTier2Mappings` 同樣 `findMany` 無 `take` 載入全部映射規則。隨資料量成長，每份文件處理都會做全表載入，存在記憶體與延遲放大風險。目前資料量受業務規模限制，評為 Low。
- **證據**：
```ts
// stage-1-company.service.ts:440
const activeCompanies = await this.prisma.company.findMany({
  where: { status: 'ACTIVE' },
  select: { id: true, name: true, nameVariants: true },
}); // 無 take 上限
```
- **建議**：為這類載入加上合理上限或改以 DB 端比對（如以正規化欄位建索引查詢），避免全表載入。

### [Info] EX-09 Stage Prompt 配置 orderBy `scope: 'desc'` 無法正確表達 FORMAT>COMPANY>GLOBAL 優先級
- **檔案**：src/services/extraction-v3/prompt-assembly.service.ts:486-491、542、595
- **類別**：K（邏輯正確性 — 可能載入非預期 scope 配置）
- **描述**：`loadStage1/2/3PromptConfig` 以 `orderBy:[{ scope:'desc' }]` + `take:1` 取「最具體」配置，但 enum 字串字典序降冪為 GLOBAL > FORMAT > COMPANY，與意圖的 FORMAT > COMPANY > GLOBAL 不符；當同時存在 FORMAT 與 GLOBAL 配置時可能誤選 GLOBAL。屬正確性缺陷而非直接安全漏洞，但可能導致套用非預期範圍的 Prompt 配置。
- **建議**：改以明確的 scope 權重排序（程式端排序或 `CASE` 權重），不要倚賴 enum 字典序。

### [Info] EX-10 GPT API 錯誤原文向上拋出，可能含內部端點 / 請求細節
- **檔案**：src/services/extraction-v3/stages/gpt-caller.service.ts:400-411；unified-gpt-extraction.service.ts:356-358
- **類別**：J（資訊洩漏）
- **描述**：GPT API 非 2xx 時 `throw new Error('GPT API 錯誤: ${status} - ${errorText}')`，`errorText` 為 Azure 原始回應。此錯誤會沿管線向上傳遞並可能寫入 `stepResults.error` / log / 持久化。Azure 錯誤回應一般不含 api-key，但可能含部署名稱、API 版本等內部資訊。風險低。
- **建議**：對外暴露時包裝為通用訊息，內部細節僅寫入受控 logger.debug。

### [Info] EX-11 灰度發布使用 Math.random()
- **檔案**：src/services/extraction-v3/extraction-v3.service.ts:172
- **類別**：K（不安全隨機數 — 非安全用途）
- **描述**：`Math.random()*100` 用於 V3.1 灰度百分比路由，**非**用於 token / 密碼 / session，因此不構成安全弱點，僅記錄以排除誤判。
- **建議**：無需修改。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 2 | 6 | 3 |

---

## 4. 區域整體觀察

- **API Key 處理良好**：本區域所有 vendor 金鑰（`AZURE_DI_KEY`、`AZURE_OPENAI_API_KEY`）皆從 `process.env` 讀取，無硬編碼 secret，金鑰未被寫入 log 或回應，符合 H4。
- **SQL 安全**：唯一的 raw query（`reference-number.service.ts` 的 `findMatchesInText`，由 reference-number-matcher 呼叫）使用 `Prisma.sql` 標籤模板與 `Prisma.join`，全參數化，未見 FIX-051 類型回歸。
- **系統性模式 1 — 文件內容入 log**：多處（EX-01/03/04）將 GPT 回應或文件抽取內容輸出至 console，其中 EX-01 無 debug 保護、含潛在 PII，是本區域最需優先處理的項目；其餘受旗標保護。建議統一改用 logger 並對欄位值 redact。
- **系統性模式 2 — fail-open 至 mock 資料**：extraction-v2 兩個服務在未配置時靜默回傳假發票資料（EX-02），屬資料完整性 / fail-open 風險，正式環境應改為明確失敗。
- **系統性模式 3 — LLM prompt injection 面**：文件內容（直接與第二序經由 DB 公司名）會進入 GPT Prompt（EX-05/06），屬 OCR+AI 管線的固有風險；目前僅有 markdown pipe 轉義，缺少指令隔離與輸入字元限制，建議納入縱深防禦。
- **認證 / 授權（維度 A）**：本區域為服務層，不直接處理 HTTP session；存取控制應由上游 API route 負責，本批檔案未見越權邏輯。
