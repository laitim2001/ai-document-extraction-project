# 安全審查報告 — Hooks 前半（src/hooks/ A–L）

> 審查日期：2026-06-10 | Scope：scopes/hooks-0.txt | Agent：hooks-0 並行審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/hooks/use-accessible-cities.ts | 203 | ✅ |
| 2 | src/hooks/use-accuracy.ts | 184 | ✅ |
| 3 | src/hooks/useAiCost.ts | 360 | ✅ |
| 4 | src/hooks/useAlertRules.ts | 284 | ✅ |
| 5 | src/hooks/use-alerts.ts | 257 | ✅ |
| 6 | src/hooks/useAlerts.ts | 249 | ✅ |
| 7 | src/hooks/useApproveReview.ts | 150 | ✅ |
| 8 | src/hooks/useAuditQuery.ts | 261 | ✅ |
| 9 | src/hooks/useAuditReports.ts | 274 | ✅ |
| 10 | src/hooks/use-auth.ts | 163 | ✅ |
| 11 | src/hooks/use-backup.ts | 244 | ✅ |
| 12 | src/hooks/use-backup-schedule.ts | 252 | ✅ |
| 13 | src/hooks/use-batch-progress.ts | 361 | ✅ |
| 14 | src/hooks/useChangeHistory.ts | 483 | ✅ |
| 15 | src/hooks/use-cities.ts | 178 | ✅ |
| 16 | src/hooks/useCityCost.ts | 558 | ✅ |
| 17 | src/hooks/use-city-cost-report.ts | 328 | ✅ |
| 18 | src/hooks/useCityFilter.ts | 336 | ✅ |
| 19 | src/hooks/use-companies.ts | 385 | ✅ |
| 20 | src/hooks/use-company-detail.ts | 466 | ✅ |
| 21 | src/hooks/use-company-formats.ts | 403 | ✅ |
| 22 | src/hooks/useCompanyList.ts | 289 | ✅ |
| 23 | src/hooks/useCreateRule.ts | 170 | ✅ |
| 24 | src/hooks/useDashboardStatistics.ts | 211 | ✅ |
| 25 | src/hooks/use-data-templates.ts | 301 | ✅ |
| 26 | src/hooks/use-debounce.ts | 59 | ✅ |
| 27 | src/hooks/useDebounce.ts | 111 | ✅ |
| 28 | src/hooks/use-document.ts | 131 | ✅ |
| 29 | src/hooks/use-document-detail.ts | 251 | ✅ |
| 30 | src/hooks/use-document-formats.ts | 149 | ✅ |
| 31 | src/hooks/use-document-progress.ts | 391 | ✅ |
| 32 | src/hooks/use-documents.ts | 194 | ✅ |
| 33 | src/hooks/useEscalateReview.ts | 171 | ✅ |
| 34 | src/hooks/useEscalationDetail.ts | 147 | ✅ |
| 35 | src/hooks/useEscalationList.ts | 227 | ✅ |
| 36 | src/hooks/use-exchange-rates.ts | 729 | ✅ |
| 37 | src/hooks/use-field-definition-sets.ts | 410 | ✅ |
| 38 | src/hooks/use-field-label.ts | 55 | ✅ |
| 39 | src/hooks/use-field-mapping-configs.ts | 591 | ✅ |
| 40 | src/hooks/use-format-analysis.ts | 199 | ✅ |
| 41 | src/hooks/use-format-detail.ts | 165 | ✅ |
| 42 | src/hooks/use-format-files.ts | 140 | ✅ |
| 43 | src/hooks/use-forwarder-detail.ts | 36 | ✅ |
| 44 | src/hooks/useForwarderList.ts | 36 | ✅ |
| 45 | src/hooks/use-forwarders.ts | 33 | ✅ |
| 46 | src/hooks/use-health-monitoring.ts | 353 | ✅ |
| 47 | src/hooks/use-historical-data.ts | 436 | ✅ |
| 48 | src/hooks/use-historical-file-detail.ts | 224 | ✅ |
| 49 | src/hooks/useImpactAnalysis.ts | 145 | ✅ |
| 50 | src/hooks/use-locale-preference.ts | 156 | ✅ |
| 51 | src/hooks/use-localized-date.ts | 100 | ✅ |
| 52 | src/hooks/use-localized-format.ts | 132 | ✅ |

**總行數**：13,121 行 | **覆蓋率**：52/52（100%）

## 2. 發現

### [Medium] HOOKS0-01 將 PENDING_REVIEW / IN_REVIEW 視為「處理中」，以 3 秒間隔無上限輪詢重負載端點

- **檔案**：src/hooks/use-document-detail.ts:148-157、209-215
- **類別**：K（無 rate limit 的昂貴操作 / DoS 面）
- **描述**：`PROCESSING_STATUSES` 把 `PENDING_REVIEW` 和 `IN_REVIEW` 也列為處理中狀態。這兩個是「等待人工審核」的穩定狀態，文件可能停留數小時至數天。只要審核人員開著文件詳情頁，就會每 3 秒對 `/api/documents/[id]?include=extractedFields,processingSteps,uploadedBy,company,city,aiDetails` 發出一次重查詢（aiDetails 含完整 AI prompt 與 GPT 原始回應，負載大）。輪詢沒有最大次數、沒有退避（backoff）。多名審核人員同時開多個詳情頁時，會對伺服器產生持續性壓力。
- **證據**：
  ```typescript
  const PROCESSING_STATUSES = [
    'UPLOADING',
    'OCR_PROCESSING',
    'MAPPING_PROCESSING',
    'PENDING_REVIEW',
    'IN_REVIEW',
  ]
  // ...
  refetchInterval: (query) => {
    const status = query.state.data?.data?.status
    if (status && PROCESSING_STATUSES.includes(status)) {
      return PROCESSING_POLL_INTERVAL  // 3000ms
    }
    return false
  },
  ```
- **建議**：將 `PENDING_REVIEW` / `IN_REVIEW` 從輪詢狀態移除（或將間隔拉長至 30-60 秒並加入指數退避 / 最大輪詢次數）；輪詢時改用輕量端點（不帶 `aiDetails`）。

### [Low] HOOKS0-02 路徑參數未經 encodeURIComponent 直接拼入 API URL（系統性模式）

- **檔案**（代表位置）：
  - src/hooks/useChangeHistory.ts:122、169、207、250（`/api/history/${resourceType}/${resourceId}`）
  - src/hooks/use-health-monitoring.ts:177-179（`/api/admin/health/${serviceName}?hours=${hours}`）
  - src/hooks/useAiCost.ts:140（`/api/dashboard/ai-cost/daily/${params.date}`）
  - src/hooks/use-accuracy.ts:66、110，及其餘約 30 個檔案的 `${id}` 路徑插值
- **類別**：B / C（縱深防禦 — URL 路徑注入）
- **描述**：幾乎所有 hooks 直接把識別碼插入 URL 路徑而不做 `encodeURIComponent`。若 ID 來源（URL 參數、UI 狀態、上游 API 回應）含 `/`、`..`、`?`、`#` 等字符，最終請求會被改寫指向其他端點或附帶非預期 query。多數 ID 是自家 API 回傳的 cuid，實際可利用性低，但 `useChangeHistory` 的 `resourceType` / `resourceId` 與 `use-health-monitoring` 的 `serviceName` 可能來自頁面路由參數。同倉庫 `use-city-cost-report.ts:263` 有正確使用 `encodeURIComponent(params.cityCode)`，顯示慣例不一致。
- **證據**：
  ```typescript
  // useChangeHistory.ts:121-122
  const response = await fetch(
    `/api/history/${resourceType}/${resourceId}?${params}`,
  ```
- **建議**：建立統一的 API client helper（或至少對所有路徑插值套用 `encodeURIComponent`），與 use-city-cost-report.ts 的做法對齊。

### [Low] HOOKS0-03 伺服器回傳的 downloadUrl 未驗證即自動觸發瀏覽器下載

- **檔案**：src/hooks/useAuditReports.ts:240-246
- **類別**：F / G（前端開放導向 / 未驗證外部 URL）
- **描述**：`useDownloadAuditReport` 在 onSuccess 中將 API 回傳的 `downloadUrl` 直接設為 `<a href>` 並自動 `click()`，客戶端未檢查 URL 協議或主機。若該值在任何環節被污染（例如後端組 URL 時引入可控輸入、或回應被中間層改寫），使用者會被無感導向任意網域（跨域 URL 上 `download` 屬性會被瀏覽器忽略，變成直接導航）。
- **證據**：
  ```typescript
  onSuccess: (data) => {
    const link = document.createElement('a')
    link.href = data.downloadUrl
    link.download = data.fileName
    link.click()
  },
  ```
- **建議**：下載前驗證 URL（僅允許同源相對路徑，或白名單列出 Azure Blob SAS 網域）；`fileName` 也建議過濾控制字符。

### [Low] HOOKS0-04 文件列表固定 30 秒背景輪詢，無處理中文件亦不停止

- **檔案**：src/hooks/use-documents.ts:153-161
- **類別**：K（資源消耗 / 無界輪詢）
- **描述**：`refetchInterval` 在沒有任何處理中文件時仍回傳 30000，即列表頁只要開著就永久每 30 秒打一次 `/api/documents`（含 stats 聚合查詢）。雖有「處理中 5 秒、閒置 30 秒」的動態調整，但缺少完全停止條件，多分頁/多用戶長期掛頁面時形成持續背景負載。
- **證據**：
  ```typescript
  refetchInterval: (query) => {
    const data = query.state.data
    if (!data?.data) return 30000 // 30s default
    const statuses = data.data.map((doc) => doc.status)
    return hasProcessingDocuments(statuses) ? 5000 : 30000
  },
  ```
- **建議**：閒置時回傳 `false` 停止輪詢（依賴 `refetchOnWindowFocus` 即可），或將閒置間隔大幅拉長並在頁籤不可見時暫停（React Query 預設僅在 focus 狀態輪詢，可確認 `refetchIntervalInBackground` 未開啟後降級為 Info）。

### [Low] HOOKS0-05 敏感資料長駐客戶端 React Query 快取

- **檔案**：
  - src/hooks/use-document-detail.ts:48-63、95-99（`aiDetails.prompt` / `aiDetails.response`、`uploadedBy.email`、`blobUrl`）
  - src/hooks/use-documents.ts:66-71（`uploader.email`）
  - src/hooks/use-document.ts:68-72（`uploader.email`）
  - src/hooks/use-historical-data.ts:38-42（`creator.email`）
  - src/hooks/use-historical-file-detail.ts:114-134（`extractionResult.rawText`、`storagePath`）
- **類別**：E / J（敏感資料快取 / 內部路徑洩漏）
- **描述**：多個 hooks 將含 PII（用戶 email）、完整 AI prompt / GPT 原始回應（可能包含整份發票內容）、OCR 原始文字以及**內部儲存路徑**（`storagePath`）的回應快取於客戶端記憶體，gcTime 最長 30 分鐘。共用電腦情境下，登出後快取仍在記憶體中（React Query 快取不會因登出自動清除，除非有呼叫 `queryClient.clear()`）。`storagePath` 屬內部基礎設施資訊，前端並無顯示需求。
- **建議**：(1) 確認登出流程有 `queryClient.clear()`；(2) 後端 detail API 移除 `storagePath` 等內部欄位；(3) 評估列表 API 是否需要回傳 uploader email（顯示 name 即可）。

### [Low] HOOKS0-06 URL 查詢參數直接類型斷言、數值無界限即傳後端

- **檔案**：src/hooks/use-companies.ts:160-180（同模式亦見於 useCityFilter.ts:144-148）
- **類別**：C（縱深防禦 — 客戶端輸入無驗證）
- **描述**：從 URL 讀取的 `type` / `status` / `sortBy` / `sortOrder` 直接以 `as CompanyType` 等 TypeScript 斷言處理（運行時無任何驗證），`page` / `limit` 用 `parseInt` 後未檢查 NaN、負數或上限，原樣轉發給 `/api/companies`。任意 URL 值（如 `?limit=999999&sortBy=__proto__`）會直接成為 API 查詢參數。實際風險取決於後端 Zod 驗證（已知後端 Zod 覆蓋率約 60-65%），客戶端缺這層僅是縱深防禦缺口。
- **證據**：
  ```typescript
  const typeParam = searchParams.get('type') as CompanyType | null
  // ...
  page: page ? parseInt(page, 10) : initialParams.page || 1,
  limit: limit ? parseInt(limit, 10) : initialParams.limit || DEFAULT_LIMIT,
  ```
- **建議**：對 URL 來源參數做白名單 / 範圍校驗後再放入查詢；同時確認 `/api/companies` 後端有 Zod 驗證 limit 上限。

### [Info] HOOKS0-07 use-alerts.ts 與 useAlerts.ts 共用 query key 根 `['alerts']`，回應 shape 不同

- **檔案**：src/hooks/use-alerts.ts:36-43、src/hooks/useAlerts.ts:24-31
- **類別**：K（快取污染 / 資料不一致）
- **描述**：兩個檔案都導出名為 `alertKeys` 的工廠，key 結構同為 `['alerts', 'list', filters]` / `['alerts', 'detail', id]`，但 `use-alerts.ts` 的 fetcher 回傳 `{items, pagination}`，`useAlerts.ts` 回傳原始 `{success, data, meta}`。若同一頁面樹同時使用兩組 hooks 且 filters 形狀重疊，React Query 會發生 key 碰撞，組件拿到非預期 shape 導致 runtime 錯誤或顯示錯誤資料（含跨 hook 的 `invalidateQueries` 誤傷）。
- **建議**：合併為單一 hook 檔案，或將其中一組 key 根改名（如 `['admin-alerts']`）。

### [Info] HOOKS0-08 城市權限過濾僅在客戶端 UI 層執行

- **檔案**：src/hooks/useCityFilter.ts:153-161、185-196
- **類別**：A（授權 — 客戶端防護不可信）
- **描述**：`validateSelection` 以 session 取得的 `cityCodes` 過濾 URL 中選擇的城市，`isGlobalAdmin` 時不過濾。這只是 UI 便利層 — 攻擊者可直接呼叫 API 帶任意 `cities` 參數。安全性完全取決於伺服器端城市隔離（db-context RLS）。本檔案本身無漏洞，記錄為跨層驗證提示：所有接受 `cities` / `cityCodes` 參數的 API route 必須在伺服器端重做城市授權檢查。
- **建議**：在 API 區域審查中確認 `/api/dashboard/*`、`/api/reports/*`、`/api/cost/*` 等接受 cities 參數的端點有伺服器端城市範圍驗證。

### [Info] HOOKS0-09 useRulesAccuracy 對每個 ruleId 發並行請求且每 5 分鐘重複，無併發上限

- **檔案**：src/hooks/use-accuracy.ts:101-128
- **類別**：K（N+1 請求放大）
- **描述**：對 `ruleIds` 陣列中每個 ID 各發一次 `/api/rules/${ruleId}/accuracy`，`Promise.all` 無併發上限，並以 `refetchInterval: 5 分鐘` 持續重複。規則列表大時（如 100+ 規則）每次刷新打出 100+ 個請求。
- **建議**：改用批次端點（一次查多個規則準確率），或限制併發數。

### [Info] HOOKS0-10 客戶端 console.error / console.warn 輸出錯誤詳情

- **檔案**：src/hooks/useAuditQuery.ts:162、177、230；src/hooks/use-accuracy.ts:119；src/hooks/use-batch-progress.ts:227、243；src/hooks/use-locale-preference.ts:131
- **類別**：E（日誌 — 與項目「console.log 漸進清理」差異一致）
- **描述**：錯誤物件直接輸出至瀏覽器 console。經查內容為錯誤訊息與 ruleId 等識別碼，無 email / token 等 PII，風險極低，記錄供 logger 統一化清理時參照。
- **建議**：併入既有的 console.log → logger 漸進清理工作。

### [Info] HOOKS0-11 SSE error 事件處理中 JSON.parse 無 try/catch

- **檔案**：src/hooks/use-batch-progress.ts:254-262
- **類別**：K（健壯性）
- **描述**：`error` 事件 listener 中 `JSON.parse((event as MessageEvent).data)` 沒有包 try/catch（同檔其他事件 listener 都有包）。伺服器送出畸形 error 事件資料時會拋出未捕捉異常，中斷錯誤處理流程（不會觸發 onError 回調）。非安全漏洞，屬可靠性問題。
- **證據**：
  ```typescript
  eventSource.addEventListener('error', (event) => {
    const errorMessage = (event as MessageEvent)?.data
      ? JSON.parse((event as MessageEvent).data).message
      : 'Connection error'
  ```
- **建議**：與其他 listener 一致加上 try/catch。

### [Info] HOOKS0-12 verifyReport 將完整檔案內容字串化後 POST，客戶端無大小限制

- **檔案**：src/hooks/useAuditReports.ts:112-129、262-273
- **類別**：H（檔案處理 — 依賴後端限制）
- **描述**：`useVerifyAuditReport` 接受 `fileContent: string`（整份報告內容）以 JSON 形式 POST 到 `/api/audit/reports/[jobId]/verify`，客戶端未限制大小。大型報告會造成記憶體與傳輸負擔；伺服器端必須有 body 大小限制與驗證（待 API 區域審查確認）。
- **建議**：考慮改傳 client 端計算的 checksum 而非整份內容；確認後端有 payload 大小上限。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 1 | 5 | 6 |

## 4. 區域整體觀察

1. **整體風險低**：本區域 52 個檔案全部是客戶端 React Query hooks（查詢/變更自家 API），不含 `dangerouslySetInnerHTML`、不 import prisma / server 模組、無硬編碼 secrets、無 `eval` / 動態代碼執行、無不安全隨機數。授權與輸入驗證的真正防線在對應的 API route（A / C 類風險須由 API 區域審查確認）。

2. **系統性模式 — 路徑插值不編碼**：約 30+ 個檔案以模板字串直接插入 ID 到 URL 路徑，僅 use-city-cost-report.ts 一處正確使用 `encodeURIComponent`。建議建立統一 API client helper 收斂此模式。

3. **系統性模式 — 輪詢策略不一致**：輪詢類 hooks 品質參差 — 好的範例（use-historical-data.ts：僅處理中時輪詢、否則停止；use-batch-progress.ts：SSE 重連有 maxRetries 上限）與壞的範例（use-document-detail.ts 把待審核狀態當處理中 3 秒輪詢；use-documents.ts 閒置仍 30 秒永久輪詢）並存。建議訂立輪詢規範：穩定狀態停止輪詢、長輪詢必須有退避或上限。

4. **系統性模式 — PII 與內部資訊進入前端**：多個 API 回應型別含 `email`、`storagePath`、完整 AI prompt/response、OCR rawText，全部進入客戶端快取。屬 API 回應欄位設計問題，hooks 僅忠實反映；建議在 API 層做欄位裁剪。

5. **重複 hook 檔案**（use-debounce/useDebounce、use-alerts/useAlerts、3 個 deprecated forwarder re-export）增加 query key 碰撞與維護負擔，其中 alerts 一組已有實際碰撞風險（HOOKS0-07）。

6. **錯誤處理一致性良好**：所有 fetcher 對非 2xx 回應拋錯且僅向 UI 透出 `detail` 訊息，無 stack trace 滲漏；錯誤訊息洩漏風險取決於後端 RFC 7807 `detail` 欄位內容（API 區域審查範圍）。
