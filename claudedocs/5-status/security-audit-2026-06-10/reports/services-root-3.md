# 安全審查報告 — src/services 根目錄服務（第 4/4 批）

> 審查日期：2026-06-10 | Scope：scopes/services-root-3.txt | Agent：services-root-3

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/services/restore.service.ts | 1018 | ✅ |
| 2 | src/services/result-retrieval.service.ts | 551 | ✅ |
| 3 | src/services/role.service.ts | 496 | ✅ |
| 4 | src/services/routing.service.ts | 576 | ✅ |
| 5 | src/services/rule-accuracy.ts | 361 | ✅ |
| 6 | src/services/rule-change.service.ts | 916 | ✅ |
| 7 | src/services/rule-metrics.ts | 628 | ✅ |
| 8 | src/services/rule-resolver.ts | 527 | ✅ |
| 9 | src/services/rule-simulation.ts | 413 | ✅ |
| 10 | src/services/rule-suggestion-generator.ts | 507 | ✅ |
| 11 | src/services/rule-testing.service.ts | 800 | ✅ |
| 12 | src/services/security-log.ts | 522 | ✅ |
| 13 | src/services/sharepoint-config.service.ts | 494 | ✅ |
| 14 | src/services/sharepoint-document.service.ts | 528 | ✅ |
| 15 | src/services/static-prompts.ts | 416 | ✅ |
| 16 | src/services/system-config.service.ts | 1554 | ✅ |
| 17 | src/services/system-settings.service.ts | 262 | ✅ |
| 18 | src/services/task-status.service.ts | 469 | ✅ |
| 19 | src/services/template-export.service.ts | 480 | ✅ |
| 20 | src/services/template-field-mapping.service.ts | 528 | ✅ |
| 21 | src/services/template-instance.service.ts | 979 | ✅ |
| 22 | src/services/template-matching-engine.service.ts | 801 | ✅ |
| 23 | src/services/term-aggregation.service.ts | 833 | ✅ |
| 24 | src/services/term-classification.service.ts | 484 | ✅ |
| 25 | src/services/traceability.service.ts | 529 | ✅ |
| 26 | src/services/user.service.ts | 903 | ✅ |
| 27 | src/services/webhook.service.ts | 683 | ✅ |
| 28 | src/services/webhook-event-trigger.ts | 312 | ✅ |

**合計**：28 檔案，約 17,000 行，全部完整逐行讀取。

---

## 2. 發現

### [High] D-01 系統配置加密使用硬編碼預設金鑰 + 靜態鹽值
- **檔案**：src/services/system-config.service.ts:68, :71, :306
- **類別**：D（Secrets 與設定）
- **描述**：`ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || 'default-key-for-development-only'`。當 `CONFIG_ENCRYPTION_KEY` 環境變數未設定時，自動退回使用硬編碼預設金鑰，且 `ENCRYPTION_SALT` 為固定字串 `'config-salt'`。系統配置中標記為 `isEncrypted` 的敏感值（如外部整合密鑰、API token）會以此金鑰用 AES-256-GCM 加密儲存於資料庫。若生產環境忘記設定環境變數，所有敏感配置等同以公開（原始碼可見）的金鑰加密 —— 任何能讀到資料庫或原始碼的人即可解密。對比之下，同專案的 `src/services/encryption.service.ts:114-127`（SharePoint 密鑰加密）在缺少 `ENCRYPTION_KEY` 時正確地拋出錯誤、絕不退回預設值，兩個服務的安全標準不一致。
- **證據**：
  ```ts
  const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || 'default-key-for-development-only'
  const ENCRYPTION_SALT = 'config-salt'
  function deriveKey(): Buffer { return scryptSync(ENCRYPTION_KEY, ENCRYPTION_SALT, 32) }
  ```
- **建議**：與 `encryption.service.ts` 一致 —— 缺少 `CONFIG_ENCRYPTION_KEY` 時拋錯（至少在 `NODE_ENV === 'production'` 時硬性 fail）；鹽值不應為固定常量（雖然 GCM 用隨機 IV 已提供語意安全，但固定鹽值削弱了金鑰衍生強度，建議改用隨機鹽並與密文一同儲存）。

---

### [Medium] D-02 Webhook 外送無 SSRF 防護
- **檔案**：src/services/webhook.service.ts:278（搭配 :207 targetUrl 來源）
- **類別**：G（SSRF 與外部呼叫）
- **描述**：`deliverWebhook` 直接 `fetch(delivery.targetUrl)`，而 `targetUrl` 來自 `externalWebhookConfig.url`（由 API 使用者配置的 webhook 端點）。程式碼對目標 URL 無任何驗證：未限制協定（可填 `file://`、`http://`）、未封鎖內網/loopback/雲端 metadata 位址（如 `http://169.254.169.254/`、`http://localhost`）。具備 webhook 配置權限的使用者可令伺服器對內部網段發起 POST 請求，構成 SSRF。實際影響受限於：(a) 僅 POST 固定 payload、(b) 回應僅截取前 5000 字回存（仍可能洩漏內部服務回應）、(c) 需有效 API Key 且能建立 webhook 配置。
- **證據**：
  ```ts
  const response = await fetch(delivery.targetUrl, {
    method: 'POST', headers: { ... }, body: JSON.stringify(delivery.payload), signal: controller.signal,
  });
  ```
- **建議**：在建立/更新 webhook 配置時（及外送前）驗證 URL —— 強制 `https`、解析 host 並拒絕私有 IP 範圍（RFC1918、127.0.0.0/8、169.254.0.0/16、::1 等）、可選 allowlist 網域。

### [Medium] D-03 SharePoint 文件提交以使用者輸入 URL 觸發 Graph 抓取（SSRF 面）
- **檔案**：src/services/sharepoint-document.service.ts:163, :185
- **類別**：G（SSRF 與外部呼叫）/ H（檔案處理）
- **描述**：`submitDocument` 直接以呼叫端傳入的 `request.sharepointUrl` 呼叫 `graphService.getFileInfoFromUrl(...)` 與 `downloadFile(fileInfo.downloadUrl)`。雖然下載走 Microsoft Graph（需有效 tenant/client 認證），但 `sharepointUrl` 來自外部請求且本服務未對其格式/網域作白名單驗證（僅依賴下游 Graph SDK 解析）。若 `getFileInfoFromUrl`/`downloadFile` 內部對 host 無限制，可能被導向非預期目標。本批次未涵蓋 `microsoft-graph.service.ts`，需由負責該檔的審查確認 host 驗證；此處標記為跨檔依賴觀察點。
- **證據**：
  ```ts
  const fileInfo = await graphService.getFileInfoFromUrl(request.sharepointUrl);
  const fileBuffer = await graphService.downloadFile(fileInfo.downloadUrl);
  ```
- **建議**：在本服務層先驗證 `sharepointUrl` 屬於已配置的 SharePoint 站台網域（config.siteUrl 同源）再交給 Graph SDK；並確認 `microsoft-graph.service.ts` 對 downloadUrl host 有限制。

### [Medium] D-04 ReDoS：以使用者/規則資料動態建構正則（無逾時保護）
- **檔案**：src/services/rule-simulation.ts:285, :333；src/services/rule-suggestion-generator.ts:394
- **類別**：K（其他風險 / DoS）
- **描述**：`applyRule` / `tryExtract` 以 `new RegExp(pattern)` 動態建構正則並對文件原文（可能很長）執行 `match`。`pattern` 來自 `RuleSuggestion.suggestedPattern` / `currentPattern`（規則建議流程資料），若包含惡意的災難性回溯模式（如 `(a+)+$`），對長文字執行會造成 CPU 鎖死（ReDoS）。雖然觸發需有規則管理權限，但模擬作業會對大量歷史文件迴圈執行，放大影響。
- **證據**：
  ```ts
  const regex = new RegExp(pattern); const match = text.match(regex);  // rule-simulation.ts:285
  const regex = new RegExp(rule.pattern); const match = value.match(regex);  // rule-suggestion-generator.ts:394
  ```
- **建議**：對動態正則加上長度上限與複雜度檢查，或改用具逾時的安全正則引擎（如 `re2`）；至少在執行模擬時限制 pattern 來源與單次 match 的輸入長度。

### [Medium] D-05 CSV 匯出無公式注入（CSV Injection）防護
- **檔案**：src/services/template-export.service.ts:359-364（escapeCsvValue），:212 exportToCsv
- **類別**：H（檔案處理）/ F（XSS 類延伸）
- **描述**：`escapeCsvValue` 僅對含 `,` `"` 換行的值加引號轉義，但未處理以 `=`、`+`、`-`、`@`、Tab、CR 開頭的儲存格值。匯出的 CSV 由使用者在 Excel/LibreOffice 開啟時，這類值會被當公式執行（CSV/Formula Injection），可能導致資料外洩或在受害者機器執行命令。匯出內容（`fieldValues`）源自文件提取與使用者輸入的模板行資料，屬不可信來源。Excel 匯出路徑（exceljs `addRow`）同樣未做前綴清洗。
- **證據**：
  ```ts
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;  // 以 =/+/-/@ 開頭的值未做防護
  }
  ```
- **建議**：對儲存格值若以 `= + - @` 或 Tab/CR 開頭，前置單引號 `'` 或空白以中和公式；Excel 與 CSV 兩條路徑都需處理。

### [Low] D-06 安全警報日誌輸出包含 PII / 完整請求上下文
- **檔案**：src/services/security-log.ts:475, :487
- **類別**：E（PII 與日誌）
- **描述**：`triggerSecurityAlert` 在 `console.warn('[SECURITY ALERT]', { ...params })` 將整個 params 輸出到日誌，其中 `details` 帶有 `UnauthorizedAccessParams`（含 userCityCodes、ipAddress、userAgent、requestPath）；通知訊息（:475）也含使用者 email。雖屬安全告警情境（可接受一定程度記錄），但完整 PII + IP 進入 plaintext server log 與專案 H4「禁止 log PII 到 plaintext file」精神相左。
- **證據**：
  ```ts
  message: `用戶 ${user?.email || params.userId} 嘗試訪問未授權城市資源。...`,
  console.warn('[SECURITY ALERT]', { timestamp: ..., ...params });
  ```
- **建議**：log 改為遮罩 email（保留 userId）、避免輸出完整 userAgent/上下文，或改用 logger.debug 並確保生產關閉；告警細節保留在 DB securityLog 即可。

### [Low] D-07 result-retrieval 下載 URL 的 SAS Token 為佔位符（無真正簽章）
- **檔案**：src/services/result-retrieval.service.ts:496-512
- **類別**：H（檔案處理）/ I（認證機制）
- **描述**：`generateDownloadUrl` / `generateSasToken` 產生的下載連結帶 `sig=placeholder`，並非真正的 Azure SAS 簽章；註解亦標明「實際實現應使用 Azure SDK」。若此 URL 直接面向外部 API 使用者，等同未受保護的 blob 存取連結（取決於 BLOB_STORAGE_URL 後端是否另有保護）。目前實作未提供真正的時效性簽章保護。
- **證據**：
  ```ts
  return `se=${encodeURIComponent(expiry)}&sp=r&sig=placeholder`;
  ```
- **建議**：以 Azure Blob SDK 生成真正的使用者委派/帳戶 SAS Token（含到期時間與唯讀權限）；在尚未實作前，不應將此 URL 暴露給外部使用者。

### [Low] D-08 多個無界查詢（缺 take/limit）
- **檔案**：src/services/term-aggregation.service.ts:626（historicalFile.findMany 無 take）；src/services/user.service.ts:813（getAllUsersWithRoles 無 take）、:864-878（已有 limit，僅供對照）；src/services/role.service.ts:79/92（getAllRoles 無 take，資料量小可接受）
- **類別**：K（無界查詢 / DoS 面）
- **描述**：`aggregateTerms` 一次撈出所有符合條件的 `historicalFile`（含 extractionResult JSON）再於記憶體聚合，歷史資料量大時記憶體與 CPU 壓力高；`getAllUsersWithRoles` 撈全部使用者含巢狀角色。雖多由內部/管理流程呼叫，仍屬 DoS 面（資源耗盡）。
- **證據**：term-aggregation.service.ts:626 `const files = await prisma.historicalFile.findMany({ where, select: {...} })`（無 take）。
- **建議**：對大表查詢加 take 上限或改為分批/串流處理；`getAllUsersWithRoles` 若僅供下拉選單，限制欄位與筆數。

### [Info] D-09 規則模擬/測試結果不重新執行 pattern（提取為示意實作）
- **檔案**：src/services/rule-testing.service.ts:616-651（applyExtractionPattern）
- **類別**：J（資訊洩漏 / 正確性）
- **描述**：`applyExtractionPattern` 註解標明「簡化的實現」，實際只回傳既有 extractionResult 的欄位值而非真正套用新 pattern，導致「測試規則變更效果」的改善/退化統計可能與真實情形不符。非安全漏洞，但屬功能正確性風險，記為觀察。
- **建議**：若此功能用於正式決策（規則上線），應接上真正的提取引擎重新套用 pattern。

### [Info] D-10 服務層普遍不在本層做 auth/權限檢查（依賴上層 API route）
- **檔案**：本批多數服務（restore / routing / role / user / system-config / template-* / rule-* 等）
- **類別**：A（認證與授權）
- **描述**：本批服務皆為純業務邏輯層，方法直接接收 `userId` / `apiKey` 等並執行操作，本身不驗證呼叫者身分或權限（符合專案分層慣例 —— auth 由 API route 層處理）。task-status.service.ts、result-retrieval.service.ts、webhook.service.ts 對 API Key 範圍（`apiKeyId` 比對 / `query_all` 權限 / 城市 allowlist）有良好的物件級存取控制，是正面範例。風險在於：若有任何 API route 漏接 auth 而直接呼叫這些服務（如 `restoreService.startRestore`、`SystemConfigService.updateConfig`、`role.service` 的 CRUD），即無第二道防線。本批無法判定各 route 是否都有保護，需由 API route 範圍的審查交叉確認高敏感服務（restore、system-config、role/user 管理、rule-change 審核）的呼叫端 auth 覆蓋。
- **建議**：確認上述高敏感服務的所有呼叫端 route 都有 session + 角色/權限檢查（對照已知 auth 覆蓋率約 60% 的缺口）。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 1 | 4 | 3 | 2 |

---

## 4. 區域整體觀察

1. **加密實作標準不一致**：`encryption.service.ts`（SharePoint 密鑰）正確地強制要求環境變數、缺少即拋錯；但 `system-config.service.ts` 卻保留硬編碼 fallback 金鑰（D-01）。同一專案兩套密鑰處理標準，建議統一為「缺金鑰即 fail」。SharePoint 配置服務的密鑰加密 + 回應遮罩（SECRET_MASK）做得很好，是正面範例。

2. **外送/抓取缺 SSRF 防護是系統性缺口**：webhook 外送（D-02）與 SharePoint 抓取（D-03）都以使用者可控 URL 對外發請求且無內網封鎖。建議建立統一的「安全外送」工具（協定白名單 + 私有 IP 封鎖 + 可選網域 allowlist）供所有外呼點共用。

3. **匯出與正則處理的不可信輸入清洗不足**：CSV/Excel 匯出未防公式注入（D-05）；規則模擬以使用者規則資料動態建構正則無 ReDoS 防護（D-04）。兩者皆源自「文件提取值/規則配置」這類不可信內容。

4. **物件級存取控制（IDOR）整體良好**：外部 API 相關服務（task-status、result-retrieval、webhook）一致地以 `apiKeyId` 比對 + `query_all` 權限 + 城市 allowlist 控制資源範圍，未發現可繞過的 IDOR。內部管理服務（role/user/system-config/restore）依賴上層 route 做 auth（D-10），本身無第二道防線，需確認呼叫端覆蓋。

5. **SQL 注入面乾淨**：本批 28 檔全部使用 Prisma 參數化查詢，無 `$queryRawUnsafe` / `$executeRawUnsafe` / 字串拼接 SQL；未發現 FIX-051 類回歸。動態 `where` 條件均透過 Prisma 型別建構，安全。

6. **審計與交易使用充分**：restore / rule-change / system-config / user 等敏感操作普遍使用 `$transaction` 並寫 auditLog，資料一致性與可追溯性良好。
