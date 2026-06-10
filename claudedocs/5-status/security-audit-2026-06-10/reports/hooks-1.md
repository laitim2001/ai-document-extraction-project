# 安全審查報告 — Hooks 後半（hooks-1）

> 審查日期：2026-06-10 | Scope：scopes/hooks-1.txt | Agent：hooks-1 並行審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/hooks/use-localized-toast.ts | 232 | ✅ |
| 2 | src/hooks/use-localized-zod.ts | 205 | ✅ |
| 3 | src/hooks/use-logs.ts | 464 | ✅ |
| 4 | src/hooks/useMediaQuery.ts | 56 | ✅ |
| 5 | src/hooks/use-monthly-report.ts | 223 | ✅ |
| 6 | src/hooks/use-n8n-health.ts | 231 | ✅ |
| 7 | src/hooks/use-outlook-config.ts | 456 | ✅ |
| 8 | src/hooks/use-pdf-preload.ts | 211 | ✅ |
| 9 | src/hooks/use-pending-companies.ts | 177 | ✅ |
| 10 | src/hooks/use-performance.ts | 424 | ✅ |
| 11 | src/hooks/use-pipeline-configs.ts | 351 | ✅ |
| 12 | src/hooks/useProcessingStats.ts | 414 | ✅ |
| 13 | src/hooks/use-profile.ts | 211 | ✅ |
| 14 | src/hooks/use-prompt-configs.ts | 274 | ✅ |
| 15 | src/hooks/use-reference-numbers.ts | 652 | ✅ |
| 16 | src/hooks/use-regions.ts | 294 | ✅ |
| 17 | src/hooks/useResolveEscalation.ts | 200 | ✅ |
| 18 | src/hooks/use-restore.ts | 320 | ✅ |
| 19 | src/hooks/useRetention.ts | 554 | ✅ |
| 20 | src/hooks/useReviewDetail.ts | 85 | ✅ |
| 21 | src/hooks/useReviewQueue.ts | 171 | ✅ |
| 22 | src/hooks/use-roles.ts | 274 | ✅ |
| 23 | src/hooks/use-rollback.ts | 154 | ✅ |
| 24 | src/hooks/useRuleApprove.ts | 123 | ✅ |
| 25 | src/hooks/useRuleDetail.ts | 139 | ✅ |
| 26 | src/hooks/useRuleEdit.ts | 336 | ✅ |
| 27 | src/hooks/useRuleList.ts | 287 | ✅ |
| 28 | src/hooks/useRulePreview.ts | 239 | ✅ |
| 29 | src/hooks/useRuleReject.ts | 120 | ✅ |
| 30 | src/hooks/useRuleTest.ts | 406 | ✅ |
| 31 | src/hooks/useRuleVersion.ts | 284 | ✅ |
| 32 | src/hooks/useSaveCorrections.ts | 189 | ✅ |
| 33 | src/hooks/use-sharepoint-config.ts | 277 | ✅ |
| 34 | src/hooks/useSimulation.ts | 184 | ✅ |
| 35 | src/hooks/useSuggestionDetail.ts | 432 | ✅ |
| 36 | src/hooks/useSuggestionList.ts | 316 | ✅ |
| 37 | src/hooks/use-system-config.ts | 756 | ✅ |
| 38 | src/hooks/use-system-settings.ts | 256 | ✅ |
| 39 | src/hooks/use-template-field-mappings.ts | 576 | ✅ |
| 40 | src/hooks/use-template-instances.ts | 391 | ✅ |
| 41 | src/hooks/use-term-aggregation.ts | 243 | ✅ |
| 42 | src/hooks/use-term-analysis.ts | 191 | ✅ |
| 43 | src/hooks/useTestRule.ts | 189 | ✅ |
| 44 | src/hooks/use-toast.ts | 224 | ✅ |
| 45 | src/hooks/useTraceability.ts | 270 | ✅ |
| 46 | src/hooks/useUserCity.ts | 178 | ✅ |
| 47 | src/hooks/use-users.ts | 552 | ✅ |
| 48 | src/hooks/useVersions.ts | 339 | ✅ |
| 49 | src/hooks/use-webhook-config.ts | 355 | ✅ |
| 50 | src/hooks/useWorkflowError.ts | 243 | ✅ |
| 51 | src/hooks/useWorkflowExecutions.ts | 416 | ✅ |
| 52 | src/hooks/useWorkflowTrigger.ts | 328 | ✅ |

**合計 52 檔 / 15,472 行，全部完整讀取。**

## 2. 發現

### [Medium] HK1-M01 SSE 重連計時器未清理 — unmount / 登出後仍持續重建連線

- **檔案**：src/hooks/use-logs.ts:341-364
- **類別**：K（資源洩漏 / DoS 面）、A（登出後連線殘留）
- **描述**：`useLogStream` 的 `onerror` 處理用 `setTimeout(connect, 5000)` 重連，但該 timer 從未被保存或清除。`disconnect()`（357-364）只關閉 `eventSourceRef`，不取消待執行的重連 timer。組件 unmount（或 `enabled` 變 false）後，已排程的 timer 仍會觸發 `connect()`，建立新的 `EventSource` 連到 `/api/admin/logs/stream`，且此後再無任何 cleanup 機會 — 連線會永久存活直到頁籤關閉。每次「錯誤 + unmount」循環都可能洩漏一條伺服器端 SSE 連線（SSE 連線在伺服器是長駐資源）。另外重連為固定 5 秒間隔、無退避（backoff）、無最大重試次數；若用戶已登出，閉包中的舊 `enabled=true` 仍會驅動重連，向伺服器持續發起串流請求。
- **證據**：
  ```ts
  eventSource.onerror = () => {
    ...
    // 5 秒後嘗試重連
    setTimeout(() => {
      if (enabled) {
        connect();
      }
    }, 5000);
  };
  ```
- **建議**：將 timer 存入 ref，於 `disconnect()` 與 effect cleanup 中 `clearTimeout`；重連前檢查組件仍 mounted（如 `isMountedRef`）；加入指數退避與最大重試次數。

### [Low] HK1-L01 輪詢無終止條件（系統性）— 完成後仍持續輪詢

- **檔案**：
  - src/hooks/use-term-aggregation.ts:229-243（`useTermAggregationStatus` 固定 5 秒輪詢，狀態為 `completed` / `failed` 後仍永久輪詢）
  - src/hooks/use-logs.ts:277-284（`useExportStatus` `polling=true` 時每 2 秒輪詢，匯出完成後不會自動停止）
  - src/hooks/use-restore.ts:276-320（`useRestoreRecordPolling` / `useRestoreLogsPolling` 每 2 秒輪詢，無終止狀態判斷，全靠呼叫端記得關閉）
- **類別**：K（無上限輪詢、伺服器負載 / DoS 面）
- **描述**：以上輪詢 hooks 均無「任務進入終止狀態即停止」的邏輯。對照組 `useTestTask`（src/hooks/useRuleTest.ts:294-303）已正確實作 `COMPLETED/FAILED/CANCELLED` 即回傳 `false` 停止輪詢，可作為修正範本。`useTermAggregationStatus` 最嚴重 — 呼叫端無法關閉（hardcode `refetchInterval: 5000`），頁面開著就每 5 秒打一次 `/api/admin/historical-data/batches/[id]/term-stats`。
- **證據**（use-term-aggregation.ts:230-232）：
  ```ts
  const { data, isLoading, error } = useTermAggregation(batchId, {
    refetchInterval: 5000, // 每 5 秒自動刷新
  })
  ```
- **建議**：仿照 `useTestTask` 用函數型 `refetchInterval`，偵測終止狀態（completed/failed）後回傳 `false`。

### [Low] HK1-L02 render 階段直接觸發網路預取 — 請求放大

- **檔案**：src/hooks/useReviewQueue.ts:135-150
- **類別**：K（請求放大 / 自我 DoS 面）
- **描述**：`usePrefetchNextPage` 在 hook body（即每次 render）直接呼叫 `queryClient.prefetchQuery`，且未設定 `staleTime`（預設 0 = 永遠過期）。父組件每次 re-render 都會對 `/api/review` 下一頁發出 prefetch；由於 `useReviewQueue` 本身有 60 秒 `refetchInterval` + `refetchOnWindowFocus`，會週期性驅動 re-render，形成額外的重複請求。React 規範上 side effect 也不應放在 render 路徑。
- **證據**：
  ```ts
  // 在組件 mount 時預取下一頁
  if (currentPage < totalPages) {
    const nextPageParams = { ...params, page: currentPage + 1 }
    queryClient.prefetchQuery({ ... })
  }
  ```
- **建議**：移入 `useEffect` 並為 prefetch 設定 `staleTime`（如 30 秒），與列表查詢一致。

### [Low] HK1-L03 URL 參數插值未編碼（系統性縱深防禦缺層）

- **檔案**（代表位置）：
  - src/hooks/use-pending-companies.ts:82-84（`?page=${page}&limit=${limit}` 模板字串拼 query）
  - src/hooks/use-monthly-report.ts:178-180（`/${reportId}/download?format=${format}` 直接插入路徑）
  - src/hooks/use-rollback.ts:130（`?ruleId=${ruleId}&pageSize=100` — `ruleId` 含 `&`/`#` 時可改寫 query 結構）
  - src/hooks/useRuleTest.ts:204（`/${taskId}/report?format=${format}`）
  - 此外幾乎所有 hooks 的路徑參數（`/api/rules/${ruleId}`、`/api/v1/...${id}` 等）均未 `encodeURIComponent`
- **類別**：B/C（參數注入面 — 客戶端側）
- **描述**：絕大多數 id 來自伺服器回傳的 cuid，實際利用條件高；但若任一 id / 參數值曾經來自 URL query、用戶輸入或被污染的資料，含特殊字元（`/`、`?`、`&`、`#`、`../`）即可改變請求路徑或查詢結構（client-side parameter injection）。屬縱深防禦缺層而非直接漏洞。正面對照：use-system-config.ts:225,372 與 use-system-settings.ts:146,238 均正確使用 `encodeURIComponent(key)`。
- **建議**：路徑插值統一 `encodeURIComponent`；query 一律走 `URLSearchParams`（多數檔案已是）。

### [Low] HK1-L04 批量刪除無界並行 + 無交易性

- **檔案**：src/hooks/use-template-instances.ts:194-197
- **類別**：K（請求風暴 / 資料不一致）
- **描述**：`deleteRows` 以 `Promise.all(rowIds.map(...))` 對每行各發一個 DELETE 請求，無並行上限。使用者勾選數百行時會瞬間發出數百個並行請求（伺服器負載 + 瀏覽器連線耗盡）；且部分成功、部分失敗時無回滾，留下不一致狀態，錯誤訊息也只會反映第一個 reject。
- **證據**：
  ```ts
  async function deleteRows(instanceId: string, rowIds: string[]): Promise<void> {
    // 批量刪除使用 Promise.all
    await Promise.all(rowIds.map(rowId => deleteRow(instanceId, rowId)));
  }
  ```
- **建議**：提供伺服器端批量刪除端點（單一請求 + 交易），或客戶端限制並行數（如 p-limit 模式、分批）。

### [Low] HK1-L05 useRestoreRequests 輪詢條件邏輯錯誤 — 條件永不成立 + 潛在 TypeError

- **檔案**：src/hooks/useRetention.ts:456-462
- **類別**：K（邏輯缺陷導致功能失效 / 執行期錯誤）
- **描述**：`refetchInterval` 的判斷把 `storageTier`（儲存層級枚舉，如 HOT/COOL/ARCHIVE）與 `['PENDING','IN_PROGRESS']`（狀態值）比對，永遠不會匹配 — 「處理中自動刷新」實際從未生效。且 `.some()` 內固定取 `data[0]` 而非迭代變數 `req`；當 `data[0]?.archiveRecord` 為 `null` 時 `.storageTier` 取值會拋 TypeError（`data[0]?.` 只保護 `data[0]` 本身為 undefined 的情況）。
- **證據**：
  ```ts
  refetchInterval: (query) => {
    const hasProcessing = query.state.data?.data.some(
      (req) => req.archiveRecord && ['PENDING', 'IN_PROGRESS'].includes(String(query.state.data?.data[0]?.archiveRecord.storageTier))
    )
    return hasProcessing ? 10000 : false
  },
  ```
- **建議**：改為迭代 `req` 並比對正確的狀態欄位（還原請求的 status），同時做 null 防護。

### [Low] HK1-L06 console.log 殘留（屬已知系統性清理範圍）

- **檔案**：src/hooks/useRuleVersion.ts:198、209、241；src/hooks/use-logs.ts:337（console.error）
- **類別**：E（日誌紀律）
- **描述**：3 處 `console.log('[useRuleVersion] ...')` 與 1 處 `console.error`。內容不含 PII / secrets（僅流程訊息與解析錯誤物件），但屬主 CLAUDE.md 已列管的 console.log 漸進清理範圍。
- **建議**：併入 console.log → logger 漸進替換批次。

### [Info] HK1-I01 secrets 處理驗證通過（正面確認）

- **檔案**：src/hooks/use-sharepoint-config.ts:148-166、src/hooks/use-webhook-config.ts、src/hooks/use-outlook-config.ts
- **類別**：D
- **描述**：交叉驗證結果 — SharePoint `clientSecret` 僅在建立/更新/測試的 POST body 中明文外送（功能上必要，HTTPS 保護），伺服器回應由 `sharepoint-config.service.ts` 的 `maskSecretInResponse`（SECRET_MASK `********`）遮罩後才進入 React Query 快取；n8n `WebhookConfigDto` / `WebhookConfigListItem`（src/types/n8n.ts:401-438）不含 `authToken`；Outlook 回應型別使用 `clientSecretMasked`。客戶端快取不會留存明文 secrets，未發現回歸。

### [Info] HK1-I02 個人 PII 留存於 React Query 客戶端快取

- **檔案**：src/hooks/use-profile.ts:162-168；src/hooks/use-users.ts:190-197
- **類別**：E（PII 快取）
- **描述**：`useProfile` 快取當前用戶 email / roles / permissions（staleTime 5 分鐘）；`useUsers` 快取全體用戶 email（admin 功能）。皆為記憶體內快取、不落地。風險點在登出流程：若登出時未 `queryClient.clear()`，同分頁的下一個 session 理論上可短暫讀到前一用戶的快取（登出邏輯不在本 scope，建議由 auth 區域 agent 確認）。

### [Info] HK1-I03 城市權限檢查為純客戶端 UI gating

- **檔案**：src/hooks/useUserCity.ts:99-178
- **類別**：A
- **描述**：`canAccessCity` / `useIsCityRestricted` 僅讀取 session 欄位做前端顯示控制，可被開發者工具繞過。本身設計如此（檔頭已註明「前置檢查」），但依賴所有城市範圍 API 在伺服器端有對等過濾（db-context / city-filter middleware）。鑑於專案已知 auth 覆蓋率約 60%，此客戶端 gating 不可視為防線。

### [Info] HK1-I04 工作流觸發的 cityCode 由客戶端傳入

- **檔案**：src/hooks/useWorkflowTrigger.ts:104-121、184-198
- **類別**：A（跨層 IDOR 面）
- **描述**：`triggerWorkflow` 的 `cityCode` 與 `documentIds` 由客戶端組裝送出。Hook 層無法（也不應）做授權；必須由 `/api/workflows/trigger` 伺服器端驗證使用者對該 cityCode 與 documentIds 的權限，否則低權限用戶可改 payload 觸發他城工作流。建議由 API 區域 agent 確認該 route 的城市授權檢查。

### [Info] HK1-I05 自動點擊伺服器回傳的下載 URL

- **檔案**：src/hooks/use-monthly-report.ts:189-198
- **類別**：F/G
- **描述**：`useDownloadMonthlyReport` 將 API 回傳的 `downloadUrl` 直接設為 `<a href>` 並自動 click。URL 來源為受信 API（通常為 Blob SAS URL），目前無注入路徑；但 hook 端未檢查協定（如限定 https:），若上游資料被污染會自動導向任意 URL。屬理論性風險。

### [Info] HK1-I06 日誌資料（可能含 PII）緩衝於客戶端記憶體

- **檔案**：src/hooks/use-logs.ts:300、333（SSE buffer 上限 500 條）；列表查詢結果進入 React Query 快取
- **類別**：E
- **描述**：系統日誌條目可能含 userId、錯誤上下文等。客戶端保留最近 500 條（有上限，設計合理），且為 admin 專屬頁面。前提是 `/api/admin/logs` 與 `/api/admin/logs/stream` 在伺服器端確實限 admin（EventSource 無法帶自訂 header，依賴 cookie session — 須確認 stream route 有 session 檢查；屬 API 區域範圍）。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 1 | 6 | 6 |

## 4. 區域整體觀察

1. **本區域為純客戶端 React Query hooks，無直接 DB / secrets / 檔案系統操作**，攻擊面集中在：(a) 發出的請求參數組裝、(b) 伺服器回應的客戶端留存、(c) 輪詢 / 串流的資源行為。逐檔審查後未發現 Critical / High 等級問題。
2. **參數組裝紀律整體良好但不一致**：約 85% 的 hooks 使用 `URLSearchParams`（自動編碼），但路徑插值（`/api/xxx/${id}`）幾乎全數未 `encodeURIComponent`，且有 4 處模板字串直接拼 query（HK1-L03）。建議訂立統一的 API client helper。
3. **輪詢設計品質參差**：`useTestTask`（useRuleTest.ts）有正確的終止條件，是好範本；但 `useTermAggregationStatus`、`useExportStatus`、restore 輪詢等 4 處缺終止條件（HK1-L01），SSE 串流的重連則有計時器洩漏（HK1-M01）。
4. **敏感資料快取面驗證通過**：SharePoint / Outlook / n8n Webhook 三類整合配置的 secrets 在伺服器端遮罩 / 排除後才回傳，客戶端快取無明文 secrets 殘留（HK1-I01 正面確認）。
5. **授權一律依賴伺服器端**：本區域多個 hooks（useUserCity、useWorkflowTrigger、use-logs userId 篩選）將授權語意交給 API 層；結合專案已知 auth 覆蓋率缺口（約 60%），這些 hooks 對應的 route 是否有 session / 城市 / 角色檢查，應由 API 區域報告交叉比對（特別是 `/api/workflows/trigger`、`/api/admin/logs/stream`、`/api/review`、`/api/rules/*`）。
6. **錯誤處理模式**：約三分之一的 fetch 在 `!response.ok` 時直接 `await response.json()` 而未 `.catch()`，伺服器回非 JSON（如 502 HTML）時會拋出原生 SyntaxError 而非友善訊息 — 韌性問題，非安全問題，不列入發現。
