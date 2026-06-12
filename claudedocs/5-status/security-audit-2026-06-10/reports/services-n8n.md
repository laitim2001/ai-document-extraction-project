# 安全審查報告 — services/n8n + services/logging

> 審查日期：2026-06-10 | Scope：scopes/services-n8n.txt | Agent：services-n8n 審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/services/logging/index.ts | 31 | ✅ |
| 2 | src/services/logging/logger.service.ts | 370 | ✅ |
| 3 | src/services/logging/log-query.service.ts | 609 | ✅ |
| 4 | src/services/n8n/index.ts | 134 | ✅ |
| 5 | src/services/n8n/n8n-api-key.service.ts | 428 | ✅ |
| 6 | src/services/n8n/n8n-document.service.ts | 565 | ✅ |
| 7 | src/services/n8n/n8n-health.service.ts | 746 | ✅ |
| 8 | src/services/n8n/n8n-webhook.service.ts | 464 | ✅ |
| 9 | src/services/n8n/webhook-config.service.ts | 810 | ✅ |
| 10 | src/services/n8n/workflow-definition.service.ts | 442 | ✅ |
| 11 | src/services/n8n/workflow-error.service.ts | 480 | ✅ |
| 12 | src/services/n8n/workflow-execution.service.ts | 536 | ✅ |
| 13 | src/services/n8n/workflow-trigger.service.ts | 703 | ✅ |

總計：13 檔 / 約 6,318 行，全部完整讀取。

---

## 2. 發現

### [High] G-01 使用者控制的 callbackUrl 造成 SSRF，且回應內容被儲存
- **檔案**：src/services/n8n/n8n-webhook.service.ts:169；觸發點 src/services/n8n/n8n-document.service.ts:232-252
- **類別**：G（SSRF 與外部呼叫）
- **描述**：
  n8n 文件提交 API（`POST /api/n8n/documents`，以 API Key `documents:write` 認證）接受 `callbackUrl`，路由層僅以 `z.string().url()` 驗證（src/app/api/n8n/documents/route.ts:63），**不限制目標主機**。該值流入 `n8nWebhookService.sendEvent({ webhookUrl: request.callbackUrl })` → `deliverWebhook()` → `fetch(event.webhookUrl, { method: 'POST', ... })`。攻擊者（持有合法 API Key 的整合方或被竊取的 Key）可令伺服器對任意內部位址（如 `http://169.254.169.254/...` 雲端中繼資料、`http://localhost:5433` 資料庫、內網管理面板）發出 POST 請求。
  更嚴重的是：回應本文被讀取並寫入 DB（`responseBody = await response.text()`，第 184 行，存於第 193 行 `responseBody`），而 `getEventById` / `listRecentEvents`（第 332-360 行）會回傳含 `responseBody` 的事件記錄，使原本的盲 SSRF 變成可讀取內部服務回應的資料外洩管道。
- **證據**：
  ```ts
  // n8n-webhook.service.ts:169
  const response = await fetch(event.webhookUrl, {
    method: 'POST', headers: {...}, body: JSON.stringify(payload), signal: controller.signal,
  });
  // :184  const responseBody = await response.text();  → 第 193 行存入 DB
  // n8n-document.service.ts:239  webhookUrl: request.callbackUrl,
  ```
- **建議**：對所有外呼 URL 實施 allowlist（限定 n8n host／協定僅 https）；解析後拒絕 private/loopback/link-local IP 與 DNS rebinding（解析 IP 再比對）；不要將外部回應本文原樣儲存或回傳，僅記錄狀態碼與長度。

### [High] G-02 testConnection 接受任意 baseUrl 造成 SSRF
- **檔案**：src/services/n8n/webhook-config.service.ts:499-529（fetch 於 :521）
- **類別**：G（SSRF 與外部呼叫）
- **描述**：`testConnection` 在未提供 `configId` 時，直接採用呼叫端提供的 `request.baseUrl` 與 `request.authToken`，組出 `${baseUrl}/health` 後以 `fetch` 發 GET（帶 `Authorization: Bearer <authToken>`）。`baseUrl` 無任何主機限制，可探測內網存活與埠（依回應時間／狀態碼判斷）。屬典型「連線測試」型 SSRF。
- **證據**：
  ```ts
  } else if (request.baseUrl && request.authToken) {
    baseUrl = request.baseUrl; authToken = request.authToken; ...
  }
  const testUrl = `${baseUrl.replace(/\/$/, '')}${TEST_ENDPOINT_PATH}`;
  const response = await fetch(testUrl, { method: 'GET', headers: { Authorization: `Bearer ${authToken}` }, ... });
  ```
- **建議**：同 G-01，對 `baseUrl` 做主機 allowlist 與 private IP 阻擋；測試結果只回傳成功/失敗與狀態碼，避免回應內容差異化的探測。

### [Medium] G-03 / D-01 已解密的 Webhook 認證 Token 會被送往可被竄改的目標 URL（Token 外洩風險）
- **檔案**：src/services/n8n/workflow-trigger.service.ts:480-504（fetch 於 :499，Token 注入於 :489）；src/services/n8n/webhook-config.service.ts:484-529（configId 路徑解密後外送）
- **類別**：G（SSRF）+ D（Secrets）
- **描述**：
  1. `workflowTriggerService.sendTriggerRequest` 取該城市的 active webhook config，**解密** `authToken` 後以 `Authorization: Bearer` 送往 `workflow.triggerUrl`（第 499 行）。`triggerUrl` 來自 `WorkflowDefinition`，可由 `workflowDefinitionService.createDefinition / updateDefinition` 任意設定且**無 host 驗證**。能建立／修改工作流定義者，即可把城市的 webhook 密鑰導向自己控制的 URL 竊取。
  2. `webhookConfigService.testConnection` 走 `configId` 路徑時，會解密 DB 內的 `authToken` 並送往該 config 的 `baseUrl`；而 `update()`（第 319-322 行）允許修改 `baseUrl` 且無 host 限制 —— 先改 `baseUrl` 為惡意位址、再呼叫 testConnection 即可外洩既有密鑰。
- **證據**：
  ```ts
  // workflow-trigger.service.ts:487-489
  const decryptResult = decrypt(config.authToken);
  if (decryptResult.success) headers['Authorization'] = `Bearer ${decryptResult.decrypted}`;
  // :499  await fetch(workflow.triggerUrl, { method: workflow.triggerMethod, headers, ... });
  ```
- **建議**：外送密鑰前驗證目標 host 屬可信 n8n 端點 allowlist；`baseUrl` / `triggerUrl` 變更需經權限控管與 host 白名單；考慮對 config 變更後要求重新測試而非沿用既存密鑰。

### [Medium] A-01 跨城市 IDOR：依 ID 操作但未驗證城市範圍／擁有者
- **檔案**：
  src/services/n8n/workflow-trigger.service.ts:419-447（cancelExecution）、:360-407（retryTrigger）；
  src/services/n8n/workflow-execution.service.ts:116-174（getExecutionDetail）；
  src/services/n8n/workflow-error.service.ts:101-139（getErrorDetail）；
  src/services/n8n/webhook-config.service.ts:252-267（getById）、:279-399（update）、:409-445（delete）
- **類別**：A（認證與授權 / IDOR）
- **描述**：`triggerWorkflow` 有做城市權限檢查（workflow-trigger.service.ts:222 `workflow.cityCode !== cityCode`），但同檔的 `cancelExecution`、`retryTrigger` 僅用 `executionId` 查詢即操作，**未比對呼叫者城市與 `execution.cityCode`**；`retryTrigger` 更以原紀錄的 `execution.cityCode` 重新觸發（第 405 行），形成跨城市重放。`getExecutionDetail` / `getErrorDetail` / webhook config 的 `getById/update/delete` 同樣僅依 ID 取用，服務層無城市隔離。是否安全完全取決於路由層是否補檢查；屬縱深防禦缺層，且與 `getDocumentStatus/Result`（n8n-document.service.ts:298-303 有 `cityCode` 過濾）的一致性落差顯示為漏檢。
- **證據**：
  ```ts
  // workflow-trigger.service.ts:419  async cancelExecution(executionId, cancelledBy) {
  //   const execution = await prisma.workflowExecution.findUnique({ where: { id: executionId } });
  //   ... 直接 update，無 cityCode 比對
  ```
- **建議**：服務層方法接受呼叫者 `cityCode` 並在 `where` 加上城市條件（或操作前比對）；admin 例外時由路由明確標示並驗 admin 角色。

### [Medium] K-01 getErrorStatistics 無界查詢（缺 take/limit）
- **檔案**：src/services/n8n/workflow-error.service.ts:174-179
- **類別**：K（無界查詢 / DoS 面）
- **描述**：`getErrorStatistics` 以 `findMany({ where: { status: in [FAILED, TIMEOUT] }, select: { errorDetails: true } })` 取出**所有**失敗執行的 `errorDetails`（JSON），無 `take`、無時間下限預設。失敗紀錄累積後一次性載入記憶體解析，存在記憶體壓力與回應變慢的 DoS 面。對照同檔其他查詢與 log-query（`take: Math.min(limit, 1000)`）都有上限，此處為例外。
- **證據**：
  ```ts
  const errors = await prisma.workflowExecution.findMany({
    where, select: { errorDetails: true },   // 無 take
  });
  ```
- **建議**：改用 DB 端聚合（groupBy/分桶），或加 `take` 上限 + 強制時間範圍預設（如近 30 天）。

### [Medium] C-01 文件大小以呼叫端宣告值驗證、MIME 未比對實際內容
- **檔案**：src/services/n8n/n8n-document.service.ts:140-171
- **類別**：C（輸入驗證）+ H（檔案處理）
- **描述**：大小檢查比對的是 `request.fileSize`（呼叫端宣告值，第 141 行），而非實際 `Buffer.from(request.fileContent, 'base64')` 解碼後的長度（第 163 行已有 buffer 卻未用其長度驗證），可宣告小值繞過 50MB 限制送入更大內容；MIME 類型亦僅信任 `request.mimeType` 字串，無 magic-byte／實際內容比對，可上傳偽裝副檔的內容。另：`Buffer.from(..., 'base64')` 對非法 base64 不會 throw（採寬鬆解碼），第 162-171 行的 try/catch 形同無效，無法真正攔截「Invalid Base64」。
- **證據**：
  ```ts
  if (request.fileSize > MAX_FILE_SIZE) { ... }   // 用宣告值
  let fileBuffer: Buffer;
  try { fileBuffer = Buffer.from(request.fileContent, 'base64'); } catch { ... } // 不會 throw
  ```
- **建議**：以 `fileBuffer.length` 為準驗證大小；以內容 magic bytes 驗證型別；改用嚴格 base64 驗證（如先正則檢查再解碼）。

### [Low] H-01 fileName 未清洗即用於 blobName 路徑
- **檔案**：src/services/n8n/n8n-document.service.ts:198, 188
- **類別**：H（檔案處理 / path traversal）
- **描述**：`blobName: n8n/${traceId}/${Date.now()}/${request.fileName}` 直接拼入未清洗的 `fileName`；`fileExtension` 亦由 `fileName.split('.').pop()` 取得。目前 `uploadToStorage` 為 mock（見 D-02）尚未實際寫檔，但一旦接上真實 Blob 儲存，含 `../` 或特殊字元的檔名可能影響儲存路徑。
- **建議**：對 `fileName` 做 sanitize（移除路徑分隔符、限制字元集）後再組 blobName。

### [Low] K-02 工作流參數 pattern 以 new RegExp 在使用者輸入上執行（ReDoS）
- **檔案**：src/services/n8n/workflow-trigger.service.ts:603-607
- **類別**：K（DoS / ReDoS）
- **描述**：`validateParameterType` 對 string 參數以 `new RegExp(param.validation.pattern)` 編譯並對使用者提供的 `value` 執行 `regex.test(value)`。`pattern` 來自工作流定義（可由建立者設定），惡意或低效正則搭配特製輸入可造成 catastrophic backtracking 阻塞事件迴圈。
- **建議**：限制 pattern 長度／來源信任邊界，或使用具逾時保護的 regex 引擎（如 re2）。

### [Low] E-01 日誌詳情回應包含使用者 email
- **檔案**：src/services/logging/log-query.service.ts:74-101（`userEmail: log.user?.email`，第 99 行）
- **類別**：E（PII 與日誌）
- **描述**：`getLogDetail` 將關聯使用者 email 放入回應 `LogDetail.userEmail`。屬管理端日誌查詢功能，若該 API 未嚴格限管理員角色，等於對較低權限者揭露 PII。CSV/JSON 匯出（第 428-466 行）僅含 userId/userName 未含 email，相對較佳。
- **建議**：確認對應路由限管理員；非必要不回傳 email，或遮蔽（如 `a***@x.com`）。

### [Low] K-03 API Key 速率限制存在 TOCTOU 競態
- **檔案**：src/services/n8n/n8n-api-key.service.ts:348-359
- **類別**：K（race condition）
- **描述**：`checkRateLimit` 以「過去一分鐘 `n8nApiCall` 筆數 >= limit」判斷，但計數與實際記錄該次呼叫分屬不同步驟，高併發下多個請求可同時通過檢查再各自記錄，短暫超出上限。屬輕微限流繞過。
- **建議**：以原子操作（DB 端 upsert+increment 視窗計數，或既有 Upstash Redis 限流，FIX-052）取代讀後判斷。

### [Info] D-02 上傳為 mock 實作，回傳假 storage URL
- **檔案**：src/services/n8n/n8n-document.service.ts:451-462（另 triggerProcessing:473-480 亦為 TODO）
- **類別**：D / J（設定 / 功能完整性）
- **描述**：`uploadToStorage` 回傳 `https://storage.example.com/...` 占位 URL，文件實際未上傳；`filePath` 指向不存在資源。非機密外洩，但會使後續以 `filePath` 取檔的流程失敗或讀到無效位址，屬安全相關的功能缺口（n8n 提交路徑與一般上傳路徑行為不一致）。
- **建議**：完成 Azure Blob 整合或在未整合前明確拒絕該路徑，避免產生指向外部範例網域的紀錄。

### [Info] A-02 API Key / Webhook Config 服務層未強制城市或 admin 範圍
- **檔案**：src/services/n8n/n8n-api-key.service.ts（createApiKey/listApiKeys/revokeApiKey/deleteApiKey）
- **類別**：A（授權）
- **描述**：金鑰與配置的 CRUD 在服務層不檢查呼叫者身分／城市，完全依賴路由層授權。此為常見分層設計，但與 A-01 並列代表 n8n 管理面授權集中於路由，建議在對應路由審查時確認皆有 admin/city 檢查（本報告範圍為服務層，僅記錄供路由審查交叉比對）。

### [Info] J-01 服務層大量使用 console.error 而非 logger
- **檔案**：n8n-document.service.ts:227,250,263；n8n-api-key.service.ts:196；n8n-webhook.service.ts:427；n8n-health.service.ts:338；log-query.service.ts:246 等
- **類別**：J / E
- **描述**：多處以 `console.error` 記錄錯誤（屬全專案已知 console.* 漸進清理項，約 279 處）。本批次記錄的多為 error 物件，未見直接輸出 email/token/密碼等 PII，**未發現 FIX-050 類 email 外洩回歸**；本批次亦無 raw SQL，未見 FIX-051 類注入回歸。建議統一改用 logger 並確保不夾帶敏感欄位。

### [Info] I-01 API Key 驗證錯誤碼可區分「停用 vs 無效」
- **檔案**：src/services/n8n/n8n-api-key.service.ts:176-186
- **類別**：I / J（資訊洩漏）
- **描述**：`validateApiKey` 對「不存在」回 `INVALID_KEY`、對「已停用」回 `DISABLED`、過期回 `EXPIRED`，可被用於推測某金鑰是否存在。影響輕微。
- **建議**：對外回應可統一為一般化錯誤，細分原因僅記錄於內部日誌。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 2 | 4 | 4 | 4 |

（High：G-01、G-02；Medium：G-03/D-01、A-01、K-01、C-01；Low：H-01、K-02、E-01、K-03；Info：D-02、A-02、J-01、I-01）

---

## 4. 區域整體觀察

1. **系統性 SSRF 缺口（最關鍵模式）**：此目錄是全系統的「外呼集中區」，共有 4 處 `fetch` 對外送出（n8n-webhook.service.ts:169、webhook-config.service.ts:521、workflow-trigger.service.ts:499，及 health 透過 testConnection 間接），**沒有任何一處對目標 host 做 allowlist 或 private/loopback IP 阻擋**。其中 callbackUrl 與 testConnection 的 baseUrl 為使用者輸入，且 webhook 回應本文會被儲存可回讀 —— SSRF 在本區屬可實際利用的高風險面。建議統一抽出一個「安全外呼」工具（URL host 白名單 + IP 解析阻擋 + 不回存回應本文），供本目錄所有 fetch 共用。

2. **城市隔離不一致**：文件查詢路徑（n8n-document.service.ts）確實帶 `cityCode` 過濾，但 workflow 執行／錯誤／webhook config 的「依 ID 取用」普遍未在服務層做城市比對，授權集中押注在路由層。建議服務層補上城市條件作為縱深防禦，並在路由審查階段交叉確認。

3. **密鑰處理良好但外送邊界薄弱**：API Key 採 `randomBytes(32)` + SHA-256 雜湊存儲（n8n-api-key.service.ts）、webhook authToken 採 AES-256-GCM 加密（webhook-config.service.ts，依賴 src/lib/encryption.ts，未在本範圍深審），歷史值記錄僅存遮蔽版（configToHistoryValue 用 maskToken）—— 這些設計正確。風險集中在「解密後把密鑰送往可被竄改的 URL」（G-03），即邊界控制而非加密本身。

4. **無 raw SQL、無 PII console 回歸**：本批次 13 檔全部走 Prisma 參數化查詢，未見 `$queryRawUnsafe`/`$executeRawUnsafe`/字串拼接 SQL；console.* 雖多但未見輸出 email/token。FIX-050（auth email log）、FIX-051（db-context SQL injection）在本範圍無回歸跡象。

5. **查詢上限大致良好，單點例外**：log-query 與多數 n8n 查詢都有 take 上限，唯 workflow-error.service.ts 的 `getErrorStatistics` 為無界查詢（K-01），建議優先修補。
