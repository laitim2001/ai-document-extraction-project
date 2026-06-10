# 安全審查報告 — src/services 根目錄服務（第 1/4 批）

> 審查日期：2026-06-10 | Scope：scopes/services-root-0.txt | Agent：services-root-0

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/services/ai-cost.service.ts | 791 | ✅ |
| 2 | src/services/ai-term-validator.service.ts | 653 | ✅ |
| 3 | src/services/alert.service.ts | 700 | ✅ |
| 4 | src/services/alert-evaluation.service.ts | 410 | ✅ |
| 5 | src/services/alert-evaluation-job.ts | 433 | ✅ |
| 6 | src/services/alert-notification.service.ts | 473 | ✅ |
| 7 | src/services/alert-rule.service.ts | 372 | ✅ |
| 8 | src/services/api-audit-log.service.ts | 531 | ✅ |
| 9 | src/services/api-key.service.ts | 521 | ✅ |
| 10 | src/services/audit-log.service.ts | 321 | ✅ |
| 11 | src/services/audit-query.service.ts | 338 | ✅ |
| 12 | src/services/audit-report.service.ts | 767 | ✅ |
| 13 | src/services/auto-rollback.ts | 472 | ✅ |
| 14 | src/services/auto-template-matching.service.ts | 786 | ✅ |
| 15 | src/services/azure-di.service.ts | 453 | ✅ |
| 16 | src/services/backup.service.ts | 978 | ✅ |
| 17 | src/services/backup-scheduler.service.ts | 684 | ✅ |
| 18 | src/services/batch-processor.service.ts | 1226 | ✅ |
| 19 | src/services/batch-progress.service.ts | 428 | ✅ |
| 20 | src/services/batch-term-aggregation.service.ts | 622 | ✅ |
| 21 | src/services/change-tracking.service.ts | 589 | ✅ |
| 22 | src/services/city.service.ts | 262 | ✅ |
| 23 | src/services/city-access.service.ts | 481 | ✅ |
| 24 | src/services/city-cost.service.ts | 839 | ✅ |
| 25 | src/services/city-cost-report.service.ts | 942 | ✅ |
| 26 | src/services/company.service.ts | 1600 | ✅ |
| 27 | src/services/company-auto-create.service.ts | 513 | ✅ |
| 28 | src/services/company-matcher.service.ts | 492 | ✅ |
| 29 | src/services/confidence.service.ts | 390 | ✅ |

合計：29 檔，約 17,066 行，全部完整讀取。

---

## 2. 發現

### [High] CITYCOST-01 城市成本查詢未對使用者指定的 cityCodes 做權限交集過濾（城市資料越權）
- **檔案**：src/services/city-cost.service.ts:173, 385, 553；src/services/city-cost-report.service.ts:245
- **類別**：A（認證與授權 / IDOR）
- **描述**：`getCityCostSummary`、`getCityCostTrend`、`getCityCostComparison`（city-cost.service.ts）與 `getCityCostReport`（city-cost-report.service.ts）一律以 `const cityCodes = params.cityCodes || cityFilter.cityCodes` 取得查詢範圍。若呼叫端（route）將使用者提供的 `params.cityCodes` 傳入，本服務會**直接信任**該值，不像同目錄的 `audit-query.service.ts:224-236` 對「使用者指定城市」與「使用者有權限城市」做交集過濾。非全域管理員可藉由指定其無權限的 `cityCodes` 取得其他城市的 AI/人工成本統計。
- **證據**：
  ```ts
  // city-cost.service.ts:173
  const cityCodes = params.cityCodes || cityFilter.cityCodes
  // ...直接用於 where: { cityCode: { in: cityCodes } }，無交集驗證
  ```
  對比同批 city-cost-report.service.ts 中 `getCostTrend`(528-534) 與 `analyzeAnomaly`(597-603) 有明確 `if (!cityFilter.cityCodes.includes(cityCode)) throw 'Access denied'`，顯示越權防護不一致。
- **建議**：在這四個方法內，若 `params.cityCodes` 有提供且使用者非 `isGlobalAdmin`，應與 `cityFilter.cityCodes` 取交集（過濾掉無權限城市），與 `audit-query.service.ts` 的做法一致；或在所有呼叫端 route 強制驗證。需交叉確認對應 route 是否已補上驗證再定級，否則維持 High。

### [Medium] AUDITRPT-01 審計報告下載 / 詳情 / 驗證未驗證請求者是否為報告擁有者（IDOR）
- **檔案**：src/services/audit-report.service.ts:265 (`downloadReport`), 367 (`getReportJob`), 231 (`verifyReportIntegrity`)
- **類別**：A（IDOR）
- **描述**：`downloadReport(jobId, userId, ...)` 僅以 `findUniqueOrThrow({ where: { id: jobId } })` 取報告，`userId` 只用於寫入下載記錄，**未驗證**該 `jobId` 是否屬於此 `userId`（對比 `getReportJobs` 有 `requestedById: userId` 過濾）。任一已登入者若能猜得 / 取得他人報告的 jobId，即可產生簽名 URL 下載含跨城市 PII 的審計報告。`getReportJob` 與 `verifyReportIntegrity` 同樣只憑 jobId。
- **證據**：
  ```ts
  // audit-report.service.ts:265-299
  async downloadReport(jobId, userId, ...) {
    const job = await prisma.auditReportJob.findUniqueOrThrow({ where: { id: jobId } })
    // 無 requestedById === userId 檢查
    ...
    const url = await generateSignedUrl(job.fileUrl, expiresAt)
  }
  ```
- **建議**：在 `downloadReport` / `getReportJob` 內加入 `if (job.requestedById !== userId) throw Forbidden`（或允許 AUDITOR/GLOBAL_ADMIN 角色），並交叉確認 route 層是否已做擁有者 / 角色驗證。

### [Medium] AUDITRPT-02 CSV 報告未防護 Formula / CSV Injection
- **檔案**：src/services/audit-report.service.ts:567-619 (`generateCsvReport`)
- **類別**：H（檔案處理）/ K
- **描述**：CSV 直接把 `userName`、`resourceName`、`changeReason`、`fileName` 等使用者可控字串以雙引號包入，但未對以 `=`、`+`、`-`、`@`、Tab、CR 開頭的儲存格做轉義。當報告以 Excel/Sheets 開啟時，這些值會被當作公式執行（Formula Injection），可導致資料外洩或本機指令。審計報告的內容來源含 OCR 提取 / 使用者修正資料，屬可控。
- **證據**：
  ```ts
  // audit-report.service.ts:587-591
  rows.push(
    `"${r.timestamp.toISOString()}","${r.userId}","${r.userName}",...,"${r.resourceType}","${r.resourceId}",...`
  )
  ```
- **建議**：對每個儲存格做 CSV 防注入處理（若值以 `= + - @ \t \r` 開頭，前置單引號或 Tab），並對值內的雙引號做 `"` → `""` 跳脫（目前未跳脫，含 `"` 的內容也會破壞 CSV 結構）。

### [Low] ALERTNOTIF-01 Webhook / Teams 通知目標 URL 來自設定且未限制內網主機（SSRF 面）
- **檔案**：src/services/alert-notification.service.ts:419 (`sendTeamsMessage`), 447 (`sendWebhook`)；src/services/alert.service.ts:498-537, 632, 680
- **類別**：G（SSRF）
- **描述**：告警通知會對「告警規則 / 通知設定」中儲存的 `webhookUrl` / `teamsWebhookUrl` / `slackWebhookUrl` 直接發 `fetch` POST。`sendTeamsMessage` 僅檢查 `startsWith('https://')`，`sendWebhook`（WEBHOOK 通道）與 alert.service 的 Teams/Slack 完全未檢查協定或目標主機。能建立 / 編輯告警規則的使用者（通常為管理員）可將 URL 指向內網位址（如 `https://169.254.169.254/...`、內部服務）造成 SSRF，並讓伺服器把告警內容（含指標、城市）外送至任意主機。
- **證據**：
  ```ts
  // alert-notification.service.ts:447-475 sendWebhook
  const response = await fetch(url, { method: 'POST', ... }) // url 無任何白名單 / 協定檢查
  ```
- **建議**：對 webhook URL 做白名單 / 協定（僅 https）/ 阻擋私有 IP 與 metadata 端點的驗證；屬縱深防禦，因觸發需具備規則管理權限，定為 Low。

### [Low] APIKEY-01 API Key 以無 salt 的 SHA-256 儲存
- **檔案**：src/services/api-key.service.ts:503-505 (`hashApiKey`)
- **類別**：I（認證機制）
- **描述**：API Key 以單純 `createHash('sha256')` 雜湊儲存。雖然 key 本身為 `randomBytes(API_KEY_RANDOM_LENGTH)` 高熵隨機（無字典/暴力風險），但無 salt 的快速雜湊在 DB 外洩時仍可被預計算彩虹表 / 大規模比對覆蓋（若曾使用低熵 key）。屬最佳實踐缺失。
- **證據**：
  ```ts
  private hashApiKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex')
  }
  ```
- **建議**：對高熵隨機 token 而言 SHA-256 可接受，但建議加上固定 pepper 或改用 HMAC-SHA256(serverSecret, key)；屬加固建議。

### [Low] BATCHPROC-01 直接以 DB 中 storagePath / originalName 作為檔案路徑讀取（path traversal 面）
- **檔案**：src/services/batch-processor.service.ts:273, 277, 460；src/services/azure-di.service.ts:238
- **類別**：H（檔案處理 / path traversal）
- **描述**：`executeWithUnifiedProcessor` 與 `executeAIProcessing` 使用 `file.storagePath || file.originalName` 直接 `fs.readFile`，`azure-di.service.ts` 的 `processPdfWithAzureDI(pdfPath)` 同樣信任傳入路徑。若上傳階段（不在本批 scope）未清洗檔名 / 未對 storagePath 做安全目錄限制，含 `../` 的值可造成任意檔案讀取。本批未見上傳端清洗邏輯，故僅標記為觀察。
- **證據**：
  ```ts
  // batch-processor.service.ts:273-277
  const filePath = file.storagePath || file.originalName
  fileBuffer = await fs.readFile(filePath)
  ```
- **建議**：交叉確認上傳服務（documents/upload、historical-data/upload）對檔名與儲存路徑的清洗；如未限制，需於讀取前 `path.resolve` 並驗證落在允許的儲存根目錄內。

### [Low] AITERM-01 AI 術語驗證 cost record ID 使用 Math.random
- **檔案**：src/services/ai-term-validator.service.ts:534
- **類別**：K（不安全隨機數）
- **描述**：成本記錄 ID 以 `Date.now()-Math.random().toString(36)` 生成。此 ID 非安全敏感識別碼（僅內部成本記錄），無 token / 授權用途，風險極低，僅記錄以符合審查維度 K。
- **證據**：`id: \`tv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}\``
- **建議**：若日後此 ID 用於對外引用，改用 `crypto.randomUUID()`；目前無實際風險。

### [Info] CHANGETRACK-01 版本號計算採「讀取最新版本 +1」缺 transaction（race condition）
- **檔案**：src/services/change-tracking.service.ts:145-187；src/services/auto-rollback.ts:137, 283（rollback 已在 transaction 內，較佳）
- **類別**：K（race condition）
- **描述**：`recordChange` 先 `findFirst` 取最新 `version` 再 `create(version+1)`，兩步驟非原子。高併發下可能產生重複 version（若有 `@@unique(resourceType,resourceId,version)` 則會觸發唯一鍵衝突而失敗，屬一致性而非安全風險）。
- **建議**：包進 transaction 或依賴唯一鍵約束 + 重試；屬資料一致性觀察。

### [Info] DIGSIG-01 審計報告「數位簽章」實為 checksum，非真正簽章
- **檔案**：src/services/audit-report.service.ts:839-843 (`generateDigitalSignature`)
- **類別**：J / K
- **描述**：`generateDigitalSignature` 回傳 `hash:${checksum}`，`verifyReportIntegrity` 僅比對 checksum。程式碼自身註解已承認「生產環境應使用私鑰進行真正的數位簽章」。此僅能驗證完整性（防意外損毀），無法防偽造（持有檔案者可重算 checksum）。屬已知設計限制。
- **建議**：若合規要求不可否認性，改用私鑰簽章；否則文件化此限制即可。

### [Info] CITYTREND-01 $queryRaw 使用正確的參數化插值（無 SQL injection）
- **檔案**：src/services/city-cost-report.service.ts:708-747 (`getCityTrendData`)
- **類別**：B（注入 — 驗證為安全）
- **描述**：唯一使用 raw SQL 之處。`cityCode`、`startDate`、`endDate` 皆以 Prisma tagged-template `${...}` 插值，Prisma 會自動參數化，非字串拼接，無注入風險。記錄為正面確認。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 1 | 2 | 4 | 3 |

---

## 4. 區域整體觀察

1. **本批均為服務層（business logic layer）**，認證 / 授權 / Zod 輸入驗證主要應由 route 層執行。多數服務本身屬安全（Prisma 參數化查詢、無字串拼接 SQL、無硬編碼 secret、無 PII 寫入 plaintext log——僅 alert/alert-notification 有 `console.log` 開發佔位的 email/通知內容但屬未實作的 TODO 模擬發信，非生產 PII 外洩）。

2. **最系統性的問題是「城市權限交集過濾不一致」**：同目錄內 `audit-query.service.ts`、`city-cost-report.service.ts` 的 `getCostTrend`/`analyzeAnomaly` 有正確的城市權限驗證範本，但 `city-cost.service.ts` 全部方法與 `city-cost-report.service.ts` 的主報表方法 `getCityCostReport` 採「`params.cityCodes || cityFilter.cityCodes`」直接信任使用者輸入，形成越權缺口（CITYCOST-01）。建議統一採交集過濾範式。

3. **審計報告子系統有兩個越權/注入面**：擁有者驗證缺失（AUDITRPT-01）與 CSV Formula Injection（AUDITRPT-02），因審計報告含跨城市 PII（userEmail、ipAddress、resourceName），影響較高，列為 Medium。

4. **歷史問題未回歸**：FIX-050（auth.config.ts email log）、FIX-051（db-context.ts SQL injection）不在本批範圍；本批唯一 raw SQL（CITYTREND-01）確認為安全參數化，未見新的字串拼接 SQL。

5. **API Key 子系統設計良好**：SHA-256 雜湊儲存、原始 key 僅回傳一次、軟刪除、輪替用 transaction、`toApiKeyResponse` 不外洩 `keyHash` / `webhookSecret`；唯一加固點為無 salt（APIKEY-01，Low）。

6. **多處「無界查詢」**（如 company-matcher 載入全部公司至記憶體比對、audit-report `take: 10000`）在資料量受控下風險低，未單列為發現，僅此提示為效能 / DoS 面的長期觀察點。
