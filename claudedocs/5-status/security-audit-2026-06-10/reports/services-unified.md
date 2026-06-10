# 安全審查報告 — services-unified（統一處理器與識別服務）

> 審查日期：2026-06-10 | Scope：scopes/services-unified.txt | Agent：services-unified

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/services/identification/identification.service.ts | 385 | ✅ |
| 2 | src/services/identification/index.ts | 16 | ✅ |
| 3 | src/services/unified-processor/adapters/confidence-calculator-adapter.ts | 628 | ✅ |
| 4 | src/services/unified-processor/adapters/config-fetcher-adapter.ts | 362 | ✅ |
| 5 | src/services/unified-processor/adapters/format-matcher-adapter.ts | 293 | ✅ |
| 6 | src/services/unified-processor/adapters/issuer-identifier-adapter.ts | 231 | ✅ |
| 7 | src/services/unified-processor/adapters/legacy-processor.adapter.ts | 218 | ✅ |
| 8 | src/services/unified-processor/adapters/routing-decision-adapter.ts | 452 | ✅ |
| 9 | src/services/unified-processor/adapters/term-recorder-adapter.ts | 765 | ✅ |
| 10 | src/services/unified-processor/factory/step-factory.ts | 180 | ✅ |
| 11 | src/services/unified-processor/index.ts | 117 | ✅ |
| 12 | src/services/unified-processor/interfaces/step-handler.interface.ts | 261 | ✅ |
| 13 | src/services/unified-processor/steps/azure-di-extraction.step.ts | 219 | ✅ |
| 14 | src/services/unified-processor/steps/confidence-calculation.step.ts | 446 | ✅ |
| 15 | src/services/unified-processor/steps/config-fetching.step.ts | 443 | ✅ |
| 16 | src/services/unified-processor/steps/field-mapping.step.ts | 284 | ✅ |
| 17 | src/services/unified-processor/steps/file-type-detection.step.ts | 102 | ✅ |
| 18 | src/services/unified-processor/steps/format-matching.step.ts | 215 | ✅ |
| 19 | src/services/unified-processor/steps/gpt-enhanced-extraction.step.ts | 395 | ✅ |
| 20 | src/services/unified-processor/steps/issuer-identification.step.ts | 341 | ✅ |
| 21 | src/services/unified-processor/steps/routing-decision.step.ts | 263 | ✅ |
| 22 | src/services/unified-processor/steps/smart-routing.step.ts | 115 | ✅ |
| 23 | src/services/unified-processor/steps/term-recording.step.ts | 303 | ✅ |
| 24 | src/services/unified-processor/unified-document-processor.service.ts | 779 | ✅ |

整體性質：本批 24 個檔案皆為**服務層 / 處理管線核心**，不直接暴露為 HTTP route（無 `auth()` 是預期的，認證由呼叫端 route 負責）。因此 A（認證授權）/ F（XSS）/ I（認證機制）等維度大多不適用於本層；風險集中在 B（注入）、E（PII/日誌）、G（SSRF/外部呼叫）、H（檔案處理）、K（資料完整性 / 資源耗用）。

**結論摘要**：未發現 Critical 或 High。最主要的風險是 `legacy-processor.adapter.ts` 在生產路徑回傳「模擬成功」資料（Medium，資料完整性），以及大量殘留 debug 日誌與重試放大成本（Low）。

---

## 2. 發現

### [Medium] UNIFIED-01 Legacy 適配器在生產路徑回傳偽造的「成功」空資料

- **檔案**：src/services/unified-processor/adapters/legacy-processor.adapter.ts:73-87
- **類別**：K（資料完整性 / 邏輯風險）
- **描述**：`callLegacyProcessor()` 是未完成的 stub（含 `TODO: 整合現有的 batch-processor`），它 `await sleep(100)` 後直接回傳 `{ success: true, extractedData: {}, confidence: 0.5 }` 的模擬結果，並被 `convertToUnifiedResult()` 標記為 `status: 'COMPLETED'`。
  - 觸發條件：當 `flags.enableUnifiedProcessor` 為 false 時，`UnifiedDocumentProcessorService.processFile()`（unified-document-processor.service.ts:160）會走 `useLegacyProcessor()` → 本 stub。
  - `DEFAULT_PROCESSOR_FLAGS.enableUnifiedProcessor = process.env.ENABLE_UNIFIED_PROCESSOR === 'true'`（constants/processing-steps.ts:153），即**只要未設定該環境變數即為 false**。
  - 交叉確認：`/api/documents/[id]/process/route.ts:174` 與 `document.service.ts:571`（retry 流程）都呼叫 `getUnifiedDocumentProcessor()`（不帶 flags），因此在未開啟環境變數的部署中，手動觸發處理與重試處理都會得到**偽造的空提取結果並被標記成功**，文件進入後續持久化 / 路由（confidence 0.5 → FULL_REVIEW）。
- **證據**：
  ```ts
  // legacy-processor.adapter.ts:76-87
  // TODO: 整合現有的 batch-processor.service.ts 和 processing-router.service.ts
  // 暫時返回模擬結果
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { success: true, fileId: input.fileId, extractedData: {},
           processingMethod: 'LEGACY', confidence: 0.5 };
  ```
- **建議**：在 stub 完成整合前，`callLegacyProcessor()` 應改為**明確拋錯**（或回傳 `success: false`），避免將偽造資料當成功結果持久化。或在 `processFile()` 進入 legacy 分支時記錄明顯警告並阻擋持久化。上傳路徑（upload/route.ts:360）已用環境變數守門並 fallback 到真實 `extractDocument`，但 process / retry 路徑未守門，需一併處理。

### [Low] UNIFIED-02 殘留 DEBUG 日誌輸出環境變數與處理參數

- **檔案**：src/services/unified-processor/unified-document-processor.service.ts:194-217
- **類別**：J（資訊洩漏）/ E（日誌）
- **描述**：`shouldUseV3()` 內含多處 `[CHANGE-024 DEBUG]` 日誌，直接輸出 `process.env.FEATURE_EXTRACTION_V3`、`process.env.FEATURE_EXTRACTION_V3_PERCENTAGE` 等環境變數值與內部 flag 狀態到 server log。這些雖非機密憑證，但屬於應移除的偵錯殘留，會在每次處理時污染日誌並洩漏內部配置。
- **證據**：
  ```ts
  console.log('[CHANGE-024 DEBUG] shouldUseV3 checking Feature Flags:', {
    'FEATURE_EXTRACTION_V3': process.env.FEATURE_EXTRACTION_V3,
    'FEATURE_EXTRACTION_V3_PERCENTAGE': process.env.FEATURE_EXTRACTION_V3_PERCENTAGE, ... });
  ```
- **建議**：移除這些 DEBUG 日誌，或改用 `logger.debug()` 並確保生產環境關閉 debug level（呼應 §已知差異 console.log 漸進清理）。

### [Low] UNIFIED-03 步驟逾時不取消底層作業 + 重試放大昂貴的 AI/OCR 呼叫

- **檔案**：src/services/unified-processor/interfaces/step-handler.interface.ts:108-151
- **類別**：K（資源耗用 / DoS 面）
- **描述**：`executeWithTimeout()` 用 `Promise.race([executionPromise, timeoutPromise])` 實作逾時，但逾時後**底層的 GPT Vision / Azure DI 呼叫不會被中止**（無 AbortController 傳遞），逾時只是讓上層提早返回，底層作業仍在跑並計費。再加上 `BaseStepHandler.execute()` 有 `retryCount` 指數退避重試，對 `GPT_ENHANCED_EXTRACTION` / `AZURE_DI_EXTRACTION` 這類昂貴步驟，逾時 + 重試會疊加多次計費呼叫。對單檔影響有限，但批次處理（`processFiles` 以 `Promise.all` 全並行，service:550-556）時無上限併發會放大成本與外部 API 壓力。
- **證據**：
  ```ts
  // step-handler.interface.ts:139-151 逾時 promise 不 abort 底層作業
  const executionPromise = this.doExecute(context, flags);
  return Promise.race([executionPromise, timeoutPromise]);
  ```
- **建議**：將 AbortSignal 傳入底層 fetch / SDK 呼叫以在逾時時真正取消；對重試的步驟限制只在可重試錯誤上重試；批次處理考慮加併發上限（`p-limit` 類）。

### [Low] UNIFIED-04 V3 處理硬編碼預設城市代碼 'HKG'

- **檔案**：src/services/unified-processor/unified-document-processor.service.ts:243
- **類別**：K（資料一致性 / 多城市隔離）
- **描述**：`processWithV3()` 建構 V3 輸入時 `cityCode: input.cityCode ?? 'HKG'`，當呼叫端未提供 cityCode 時靜默套用 'HKG'。cityCode 影響 V3 的公司 / 格式 / 參考編號解析上下文；在多城市資料隔離（Epic 6）情境下，缺漏 cityCode 而預設成特定城市，可能造成跨城市的解析歸屬偏差。
- **證據**：`cityCode: input.cityCode ?? 'HKG', // 預設城市代碼`
- **建議**：缺 cityCode 時應由呼叫端明確帶入文件實際城市，或在缺漏時記錄警告而非靜默套用固定城市；避免將業務隔離鍵硬編碼。

### [Low] UNIFIED-05 處理步驟大量輸出業務識別資訊到日誌

- **檔案**：多個步驟，例如 src/services/unified-processor/steps/issuer-identification.step.ts:113,139；steps/gpt-enhanced-extraction.step.ts:208-209,234-235,282-283；steps/azure-di-extraction.step.ts:93,109-112
- **類別**：E（日誌）
- **描述**：各步驟以 `console.log` 輸出 fileName、發行者 / 公司名稱、fileId、信心度、提取欄位 key 等。這些屬商業資料而非個人 PII（未發現輸出 email / token / 密碼 / 完整檔案內容），風險較低，但屬應收斂的明文日誌，且量大（每檔多條）。
- **證據**：`console.log(\`[IssuerIdentification] Step 3: Identified issuer: ${issuerResult.issuerName ...}\`)`
- **建議**：改用統一 logger 並調整等級；避免持續在 info 等級輸出文件 / 公司識別細節。

### [Low] UNIFIED-06 識別服務錯誤以 console.error 直接輸出 error 物件

- **檔案**：src/services/identification/identification.service.ts:177,195；term-recorder-adapter.ts:623；config-fetcher-adapter.ts:169,193
- **類別**：E（日誌）/ J（資訊洩漏）
- **描述**：`console.error('Identification error:', error)` 等直接輸出整個 error 物件，可能含底層服務的 stack / 內部訊息。屬服務層日誌（非回應給用戶），洩漏面有限，但建議結構化處理。`identifyAsync()` 為 fire-and-forget 並 `.catch` 後僅 console.error，失敗會被靜默吞掉（可觀測性風險）。
- **證據**：`this.identify(request).catch((error) => { console.error('Async identification error:', error) })`
- **建議**：改用 logger，記錄 error.message 與必要 context；fire-and-forget 失敗應有可觀測的記錄 / 計數，避免靜默丟失。

### [Info] UNIFIED-07 暫存檔處理（buffer → temp file）— 已具基本防護，僅記錄

- **檔案**：steps/azure-di-extraction.step.ts:142-166；steps/issuer-identification.step.ts:182-206；steps/gpt-enhanced-extraction.step.ts:363-393
- **類別**：H（檔案處理）
- **描述**：多個步驟將上傳 buffer 寫入 `os.tmpdir()` 再交給下游服務。檔名以 `${Date.now()}-${Math.random()...}` 或固定前綴組成，副檔名取自 `path.extname(fileName)`。已確認：(a) `path.extname` 僅取副檔名，惡意 fileName（如含 `../`）不會造成 path traversal（temp 路徑由隨機名 + extname 組成，無使用者控制的目錄分隔）；(b) 均在 `finally` 清理。屬可接受實作，僅記錄。`gpt-step7-${Date.now()}` 為可預測目錄名，本機多進程理論上有碰撞 / 競態空間，但風險極低。
- **建議**：可選——temp 目錄改用 `fs.mkdtemp()` 取得不可預測名稱以消除理論性本機競態。

### [Info] UNIFIED-08 跨範圍觀察：process 觸發端點僅驗證登入、未驗證文件城市 / 擁有權（IDOR 面）

- **檔案**：（非本 scope 檔案，交叉確認）src/app/api/documents/[id]/process/route.ts:96-122
- **類別**：A（IDOR）
- **描述**：本批服務本身無 route，但其主要呼叫端 `/api/documents/[id]/process` 只檢查 `session?.user?.id`（已登入），讀取 Document 後未驗證該使用者對此文件的城市存取權 / 擁有權即觸發處理。任何已登入使用者可對任意 documentId 觸發重新處理。此屬 route 層問題，應由負責 `api-documents` scope 的審查確認；此處僅作交叉提示，因為它決定了本服務層的實際暴露面。
- **建議**：在 process / retry route 加入城市範圍（city access）授權檢查（對照 Epic 6 多城市隔離）。

### [Info] UNIFIED-09 純計算 / 轉換層無安全問題（觀察）

- **檔案**：confidence-calculator-adapter.ts、routing-decision-adapter.ts、confidence-calculation.step.ts、format-matcher-adapter.ts、issuer-identifier-adapter.ts、smart-routing.step.ts、file-type-detection.step.ts、step-factory.ts、index.ts、identification/index.ts
- **類別**：—
- **描述**：上述檔案為純信心度計算、路由閾值判斷、型別轉換、工廠與匯出，無外部輸入拼接、無 raw SQL、無 secrets、無 fetch 使用者 URL。Prisma 存取（config-fetching.step.ts、term-recorder-adapter.ts、identification.service.ts、unified-document-processor.service.ts）皆為參數化 `findUnique/findMany/update/upsert`，未見字串拼接 SQL 或 `$queryRawUnsafe` / `$executeRawUnsafe`，B（注入）維度通過。
- **備註**：identification.service.ts 的外部呼叫 `fetch(\`${this.baseUrl}/identify\`)`（:214）目標主機來自 `process.env.MAPPING_SERVICE_URL`（固定內部服務、預設 localhost:8001），URL **不含使用者輸入**，無 SSRF（G 維度通過）。亦未發現硬編碼憑證（D 維度通過）。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 1 | 5 | 3 |

---

## 4. 區域整體觀察

- **本層定位正確**：24 檔皆為服務 / 管線核心，認證授權交由呼叫端 route。未在本層發現注入、SSRF、硬編碼憑證、PII（email/token/密碼）外洩或 XSS，B/D/G 維度整體通過。
- **最需處理者為資料完整性（K）**：`legacy-processor.adapter.ts` 的 stub 在「未開啟 `ENABLE_UNIFIED_PROCESSOR`」的部署中會經由 process / retry 路徑回傳偽造成功結果（UNIFIED-01）。雖非可被外部利用的漏洞，但會把空提取結果當成功持久化，屬高優先修復的正確性 / 信任問題。
- **系統性模式：debug 日誌殘留**：本批檔案大量使用 `console.log`（呼應專案 §已知差異「console.log 約 279 處」），其中 unified-document-processor.service.ts 的 `[CHANGE-024 DEBUG]` 直接印出環境變數值。建議整批改用 logger 並收斂等級。
- **成本 / 資源面（K）**：逾時不取消底層 AI/OCR 呼叫 + 重試 + 批次全並行（`Promise.all`）三者疊加，在大量檔案時可能放大外部 API 成本與壓力；非安全漏洞但屬 DoS / 成本治理面，建議納入後續強化。
- **多城市隔離（K）**：V3 預設 `cityCode 'HKG'` 與 process route 缺城市授權檢查（交叉提示 UNIFIED-08）共同構成多城市資料隔離的潛在缺口，建議與 Epic 6 治理一併檢視。
- 無回歸跡象：未發現 FIX-050（console.log email）/ FIX-051（SQL injection）類型問題在本批檔案重現。
