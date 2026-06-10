# 安全審查報告 — Services Root（第 3/4 批）

> 審查日期：2026-06-10 | Scope：scopes/services-root-2.txt | Agent：services-root-2 並行審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/services/invoice-submission.service.ts | 417 | ✅ |
| 2 | src/services/mapping.service.ts | 605 | ✅ |
| 3 | src/services/microsoft-graph.service.ts | 638 | ✅ |
| 4 | src/services/monthly-cost-report.service.ts | 925 | ✅ |
| 5 | src/services/notification.service.ts | 263 | ✅ |
| 6 | src/services/openapi-loader.service.ts | 409 | ✅ |
| 7 | src/services/outlook-config.service.ts | 843 | ✅ |
| 8 | src/services/outlook-document.service.ts | 768 | ✅ |
| 9 | src/services/outlook-mail.service.ts | 455 | ✅ |
| 10 | src/services/pattern-analysis.ts | 791 | ✅ |
| 11 | src/services/performance.service.ts | 762 | ✅ |
| 12 | src/services/performance-collector.service.ts | 491 | ✅ |
| 13 | src/services/pipeline-config.service.ts | 462 | ✅ |
| 14 | src/services/processing-result-persistence.service.ts | 752 | ✅ |
| 15 | src/services/processing-router.service.ts | 284 | ✅ |
| 16 | src/services/processing-stats.service.ts | 932 | ✅ |
| 17 | src/services/prompt-cache.service.ts | 182 | ✅ |
| 18 | src/services/prompt-merge-engine.service.ts | 160 | ✅ |
| 19 | src/services/prompt-provider.interface.ts | 270 | ✅ |
| 20 | src/services/prompt-resolver.factory.ts | 107 | ✅ |
| 21 | src/services/prompt-resolver.service.ts | 306 | ✅ |
| 22 | src/services/prompt-variable-engine.service.ts | 244 | ✅ |
| 23 | src/services/rate-limit.service.ts | 372 | ✅ |
| 24 | src/services/reference-number.service.ts | 989 | ✅ |
| 25 | src/services/region.service.ts | 427 | ✅ |
| 26 | src/services/regional-manager.service.ts | 583 | ✅ |
| 27 | src/services/regional-report.service.ts | 790 | ✅ |

**總計**：27 檔案 / 14,025 行，全部完整逐行讀取。

---

## 2. 發現

### [High] G-01 SSRF — 外部 API 提交以使用者提供的 URL 直接 fetch
- **檔案**：src/services/invoice-submission.service.ts:293-347（`fetchFromUrl`）
- **類別**：G（SSRF）
- **描述**：外部 API 發票提交支援 `urlReference` 模式，服務端會直接 `fetch(url)` 抓取使用者提供的任意 URL。雖然有檢查協議（只允許 http/https），但**沒有限制目標主機 / 沒有阻擋內網位址**（如 `http://169.254.169.254/`、`http://localhost:`、`http://10.x` 等）。已認證的外部 API 持有者可藉此探測內網服務、雲端 metadata endpoint，造成 SSRF。回傳內容本身不直接外洩，但成功與否、回應大小、計時差異仍可作為 blind SSRF 探測訊號。
- **證據**：
  ```ts
  const parsedUrl = new URL(url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) { throw new Error(...); }
  const response = await fetch(url, { signal: AbortSignal.timeout(URL_FETCH_TIMEOUT), ... });
  ```
- **建議**：對解析後的 hostname 做出站白名單 / 黑名單（拒絕 private IP 範圍、loopback、link-local 169.254.0.0/16、`.internal` 等），或先 DNS 解析再驗證 IP。考慮停用 redirect 跟隨或限制次數，避免以 30x 繞過主機驗證。

### [Medium] G-02 SSRF — Microsoft Graph 下載以任意 URL fetch（縱深防禦缺層）
- **檔案**：src/services/microsoft-graph.service.ts:280-292（`downloadFile`）、174-199（`getFileInfoFromUrl`）
- **類別**：G（SSRF）
- **描述**：`downloadFile(downloadUrl)` 對傳入的 URL 不做任何驗證直接 `fetch`。正常情境 downloadUrl 來自 Graph API 的 `@microsoft.graph.downloadUrl`（受信任），但 `getFileInfoFromUrl` 接受使用者提供的 SharePoint URL，並把它編碼後丟進 Graph `shares/{encodedUrl}` API。若上游路由把使用者輸入的 sharepointUrl 一路傳到此處，存在以受信任 Graph 憑證代為存取非預期資源的風險。利用條件需要 SharePoint 整合已配置且有有效憑證，故列 Medium。
- **證據**：
  ```ts
  async downloadFile(downloadUrl: string): Promise<Buffer> {
    const response = await fetch(downloadUrl); // 無主機驗證
  ```
- **建議**：`downloadFile` 限制只接受 Graph 預簽名 host（`*.sharepoint.com` / `*.svc.ms` 等），或標註此方法只能傳入內部產生的 downloadUrl，並在接受外部 URL 的入口（`getFileInfoFromUrl`）做主機白名單。

### [Medium] A-01 IDOR — 區域報表城市詳情未驗證呼叫者城市範圍
- **檔案**：src/services/regional-report.service.ts:302-330（`getCityDetail`）
- **類別**：A（授權 / IDOR）
- **描述**：`getRegionalSummary` 有完整權限檢查（`isGlobalAdmin || isRegionalManager`）並依 `cityFilter.cityCodes` 限制城市；但 public 方法 `getCityDetail(cityCode, ...)` **不接收 `cityFilter`、不做任何城市範圍驗證**，直接以傳入的 cityCode 查詢該城市完整明細（趨勢、Top Forwarders、處理量）。若路由層未自行驗證呼叫者對該 cityCode 是否有存取權，已登入的低權限使用者可枚舉任意城市代碼讀取跨城市報表資料，構成多城市隔離繞過。
- **證據**：
  ```ts
  async getCityDetail(cityCode: string, startDate, endDate, granularity = 'day') {
    const city = await prisma.city.findUnique({ where: { code: cityCode }, ... })
    // 無 cityFilter 範圍檢查，直接回傳該城市明細
  ```
- **建議**：讓 `getCityDetail` 也接收 `CityFilterContext` 並驗證 `cityCode` 是否在授權範圍內（非 globalAdmin 時 `cityFilter.cityCodes.includes(cityCode)`），或確認所有呼叫端在路由層已做城市授權檢查並補上測試。

### [Low] B-01 ReDoS / 使用者提供 regex 直接編譯（Outlook 過濾規則）
- **檔案**：src/services/outlook-config.service.ts:739-746、773-779（`matchRule` / `matchOperator`）；src/services/outlook-document.service.ts:593-599（`checkRuleMatch`）
- **類別**：K / B（ReDoS）
- **描述**：過濾規則的 `ruleValue` 在 `SUBJECT_REGEX` 或 `operator === 'REGEX'` 時直接 `new RegExp(ruleValue, 'i')` 編譯並對郵件主旨 / 寄件者執行。規則由具配置權限的管理員建立，惡意或失誤的災難性回溯 regex 可在處理郵件時造成 CPU 阻塞（ReDoS）。有 try/catch 但只攔截語法錯誤，無法防回溯爆炸。
- **證據**：
  ```ts
  if (ruleType === 'SUBJECT_REGEX' || operator === 'REGEX') {
    const regex = new RegExp(ruleValue, 'i');
    return regex.test(targetValue);
  }
  ```
- **建議**：建立規則時對 regex 做長度 / 複雜度限制，或使用具 timeout 的 regex 執行環境（如 re2）；至少在儲存時驗證 regex 安全性。

### [Low] K-01 速率限制 in-memory 路徑 fail-open
- **檔案**：src/services/rate-limit.service.ts:225-237（`checkLimitMemory` catch 區塊）
- **類別**：K（DoS 縱深防禦）
- **描述**：in-memory 限速計算發生例外時「優雅降級：允許請求」（fail-open）。雖然 Redis 為主路徑（FIX-052），但在 Redis 未配置 / 故障且記憶體運算又出錯的情境下，限速會被完全繞過，削弱防 DoS 能力。
- **證據**：
  ```ts
  } catch (error) {
    edgeLogger.error('[RateLimit] In-memory check error, degrading to allow', ...);
    return { allowed: true, ... }; // fail-open
  }
  ```
- **建議**：評估對昂貴端點改採 fail-closed（出錯時拒絕或回退保守限額），或至少觸發告警。屬已知系統性缺口的延伸，列為縱深防禦改進。

### [Low] J-01 CSV 匯出未做公式注入跳脫
- **檔案**：src/services/performance.service.ts:679-705（`exportToCsv`）
- **類別**：J / H（CSV Formula Injection）
- **描述**：`exportToCsv` 直接以 `row.join(',')` 組 CSV，未對以 `=`、`+`、`-`、`@` 開頭的儲存格做跳脫。目前匯出的欄位為時間戳、數值、enum（metric/timeRange），使用者可控成分低，故風險小；但若日後 endpoint 名稱等使用者可影響的字串進入匯出，Excel 開啟時可能觸發公式注入。
- **證據**：
  ```ts
  const rows = timeSeries.data.map((d) => [ d.timestamp, d.value.toString(), options.metric, options.timeRange ]);
  ... rows.map((row) => row.join(','))
  ```
- **建議**：CSV 儲存格統一做公式注入跳脫（前綴 `'` 或包裹引號並轉義），並對含逗號 / 引號 / 換行的值做標準 CSV escaping。

### [Low] K-02 報表 / 趨勢查詢缺上限（無界 findMany）
- **檔案**：src/services/performance.service.ts:355-359 / 375-379 / 399-403 等（`getApiTimeSeries` 系列）；src/services/regional-report.service.ts:346-358（`getCityTrend`）
- **類別**：K（無界查詢 / DoS）
- **描述**：多個時間序列 / 趨勢查詢的 `findMany` 只有 `where` 與 `orderBy`、**無 `take`**。在長時間範圍 + 高量資料下會一次載入大量列到記憶體做應用層聚合，可被用來放大資源消耗（記憶體 / GC 壓力）。
- **證據**：
  ```ts
  const metrics = await prisma.apiPerformanceMetric.findMany({
    where, select: { timestamp: true, responseTime: true }, orderBy: { timestamp: 'asc' },
  }); // 無 take
  ```
- **建議**：以 DB 端聚合（`groupBy` / `$queryRaw` 時間分桶）取代應用層全量載入，或對查詢加上合理 `take` 上限與時間範圍硬上限。

### [Low] D-01 Outlook 配置回應 spread 仍含加密 clientSecret 欄位
- **檔案**：src/services/outlook-config.service.ts:792-799（`maskSecretInResponse`）
- **類別**：D / E（Secrets 處理）
- **描述**：`maskSecretInResponse` 以 `...config` 展開後僅新增 `clientSecretMasked`，**未移除原 `clientSecret` 欄位**。回應物件中仍帶有加密後的 secret 值。雖然是 AES 密文（非明文）且 API 層多半會挑欄位回傳，但密文不應出現在回應 payload，屬最小權限 / 資料外洩縱深防禦缺失。
- **證據**：
  ```ts
  return { ...config, clientSecretMasked: SECRET_MASK }; // 原 clientSecret(密文)仍在
  ```
- **建議**：明確 `const { clientSecret: _omit, ...rest } = config` 後回傳，確保密文不進入回應。

### [Low] H-01 附件 / URL 檔名直接用於 blob 路徑與副檔名（路徑控制）
- **檔案**：src/services/outlook-document.service.ts:416-424、739-742；src/services/invoice-submission.service.ts:108-109、408-411
- **類別**：H（檔案處理）
- **描述**：附件 / URL 取得的 `fileName` 未做檔名清洗即用於 blob folder 路徑（`outlook/${cityCode}` + fileName）與 `filePath`/`blobName` 組裝。Azure Blob 對 `..` 不像本機檔案系統有 traversal 風險，且 MIME 已用白名單檢查，但檔名仍可能含特殊字元 / 控制字元，影響後續下載時的 Content-Disposition 或路徑可讀性。
- **證據**：
  ```ts
  folder: `outlook/${context.cityCode}`,  // fileName 由 uploadFile 內部組進 blobName
  filePath: `pending/${Date.now()}-${fileData.fileName}`,
  ```
- **建議**：上傳前對 fileName 做 sanitize（去除路徑分隔符、控制字元、限制長度），副檔名以白名單映射。

### [Info] A-02 區域權限管理以 service-role 繞過 RLS — 授權全賴路由層
- **檔案**：src/services/regional-manager.service.ts:121-199、440-521、528-538（`grantRegionalManagerRole` / `grantRegionAccess` / `cleanupExpiredAccesses` 等）
- **類別**：A（授權）
- **描述**：所有授權變更操作（授予 / 撤銷區域經理、批量授予城市權限）皆在 `withServiceRole`（提升權限、繞過 RLS）內執行，服務層本身**不檢查呼叫者是否為 admin**。這是合理的服務層設計，但代表「誰能呼叫這些方法」完全取決於 `src/app/api/admin/users/[userId]/regions` 等路由的授權守衛。若任何呼叫端漏掉 admin 檢查，即構成提權。
- **建議**：確認所有呼叫端（admin routes）皆有 admin / 全域管理員授權守衛，並納入 auth 覆蓋率治理清單追蹤。

### [Info] C-01 動態 orderBy 欄位依賴路由層白名單
- **檔案**：src/services/pipeline-config.service.ts:158（`orderBy: { [sortBy]: sortOrder }`）；src/services/reference-number.service.ts:204（同模式）
- **類別**：C（輸入驗證）
- **描述**：列表查詢以使用者可控的 `sortBy` 作為動態 orderBy key。Prisma 對未知欄位會拋型別錯誤（非 SQL 注入），但若無路由層 Zod 約束，可被用來觸發錯誤或枚舉欄位存在性。屬縱深防禦觀察。
- **建議**：確認 `reference-number.schema.ts` / `pipeline-config.schema.ts` 對 `sortBy` 採 enum 白名單驗證。

### [Info] E-01 服務層 console.log / console.error 殘留
- **檔案**：src/services/invoice-submission.service.ts:398；src/services/performance-collector.service.ts:109,113,141,216,255,392,395,403,431
- **類別**：E（日誌）
- **描述**：數處使用 `console.log/error` 而非結構化 logger，內容為錯誤物件與收集器統計，**未發現 PII / token / secret 外洩**（已逐行確認）。屬已知系統性 console.log 清理範圍（約 279 處），記錄具體位置供治理。
- **建議**：逐步替換為 logger；確保 error 物件序列化時不夾帶敏感欄位。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 1 | 2 | 5 | 3 |

---

## 4. 區域整體觀察

1. **注入面整體良好**：本批 27 檔皆使用 Prisma 參數化查詢；唯二的 raw query（`monthly-cost-report.service.ts` 的 `$queryRaw` 日期分桶、`reference-number.service.ts` 的 `findMatchesInText`）皆使用 Prisma 標籤模板 / `Prisma.sql` + `Prisma.join` 正確參數化，**未發現 SQL injection**（FIX-051 無回歸）。

2. **授權檢查不在服務層**：本批服務層普遍將授權責任上推到路由層（符合專案慣例）。系統性風險集中在「服務層公開方法不自帶城市 / 角色範圍驗證」——`regional-report.service.ts:getCityDetail`（A-01, Medium）是最具體的 IDOR 風險點；`regional-manager.service.ts` 全程 service-role（A-02, Info）則放大了路由層漏檢的後果。對應已知 auth 覆蓋率約 60% 的系統性缺口。

3. **SSRF 為本批最高風險主題**：兩個對外整合服務（`invoice-submission` 的 URL fetch、`microsoft-graph` 的 downloadFile / shares URL）皆以使用者可影響的 URL 發出出站請求且缺主機白名單。`invoice-submission.fetchFromUrl`（G-01, High）因面向已認證外部 API 且無內網阻擋，影響最大。

4. **Secrets 處理大致到位但有縫**：Outlook clientSecret 有 AES 加密儲存 + 回應遮罩（良好），但 `maskSecretInResponse` spread 殘留密文欄位（D-01）。全批未發現硬編碼 secret / connection string / tenant ID / subscription ID。

5. **PII 與日誌**：逐行確認 console.log / logger 輸出（含 `notification.service` 回傳 recipients email、`performance-collector` 統計、各 catch 區塊），**未發現 email / token / 密碼 / 完整檔案內容被寫入 plaintext log**（FIX-050 無回歸）。`notification.service.ts` 的 `recipients` email 為函式回傳值而非日誌輸出，屬正常。

6. **DoS 縱深防禦兩處小缺口**：限速 in-memory 路徑 fail-open（K-01）、效能 / 趨勢報表的無界 findMany（K-02），在極端資料量或 Redis 故障時可被放大利用，建議納入後續強化。
