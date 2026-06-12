# 安全審查報告 — API 雜項（workflows / n8n / jobs / test / health / docs / openapi / rollback-logs）

> 審查日期：2026-06-10 | Scope：scopes/api-misc.txt | Agent：api-misc 並行審查 agent

---

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/docs/error-codes/route.ts | 52 | ✅ |
| 2 | src/app/api/docs/examples/route.ts | 88 | ✅ |
| 3 | src/app/api/docs/route.ts | 20 | ✅ |
| 4 | src/app/api/docs/version/route.ts | 50 | ✅ |
| 5 | src/app/api/health/route.ts | 99 | ✅ |
| 6 | src/app/api/jobs/pattern-analysis/route.ts | 247 | ✅ |
| 7 | src/app/api/n8n/documents/[id]/result/route.ts | 106 | ✅ |
| 8 | src/app/api/n8n/documents/[id]/status/route.ts | 103 | ✅ |
| 9 | src/app/api/n8n/documents/route.ts | 146 | ✅ |
| 10 | src/app/api/n8n/webhook/route.ts | 317 | ✅ |
| 11 | src/app/api/openapi/route.ts | 57 | ✅ |
| 12 | src/app/api/rollback-logs/route.ts | 161 | ✅ |
| 13 | src/app/api/test/extraction-compare/route.ts | 650 | ✅ |
| 14 | src/app/api/test/extraction-v2/route.ts | 298 | ✅ |
| 15 | src/app/api/test-tasks/[taskId]/cancel/route.ts | 152 | ✅ |
| 16 | src/app/api/test-tasks/[taskId]/details/route.ts | 174 | ✅ |
| 17 | src/app/api/test-tasks/[taskId]/report/route.ts | 308 | ✅ |
| 18 | src/app/api/test-tasks/[taskId]/route.ts | 117 | ✅ |
| 19 | src/app/api/workflow-errors/statistics/route.ts | 239 | ✅ |
| 20 | src/app/api/workflow-executions/[id]/route.ts | 130 | ✅ |
| 21 | src/app/api/workflow-executions/route.ts | 185 | ✅ |
| 22 | src/app/api/workflow-executions/running/route.ts | 93 | ✅ |
| 23 | src/app/api/workflow-executions/stats/route.ts | 131 | ✅ |
| 24 | src/app/api/workflows/executions/[id]/cancel/route.ts | 170 | ✅ |
| 25 | src/app/api/workflows/executions/[id]/error/route.ts | 221 | ✅ |
| 26 | src/app/api/workflows/executions/[id]/retry/route.ts | 170 | ✅ |
| 27 | src/app/api/workflows/trigger/route.ts | 228 | ✅ |
| 28 | src/app/api/workflows/triggerable/route.ts | 201 | ✅ |

輔助閱讀（非 scope，用於交叉驗證）：
- `src/middleware.ts`（確認 `/api` 路由不受全域 middleware 保護）
- `src/lib/middleware/n8n-api.middleware.ts`（n8n API Key 認證機制）
- `src/middlewares/city-filter.ts`（`withCityFilter` 高階函數）

---

## 2. 發現

### [Critical] API-MISC-01 test/extraction-compare 未認證 + Path Traversal 任意檔案寫入

- **檔案**：src/app/api/test/extraction-compare/route.ts:392-436（POST handler、暫存檔寫入）；對照 src/middleware.ts:91-98、181
- **類別**：A（無認證）+ H/B（path traversal / 任意檔案寫入）
- **描述**：
  1. 此端點 **完全沒有任何認證/授權檢查**。全域 middleware（`src/middleware.ts` 第 91-98 行與 matcher 第 181 行）明確跳過所有 `/api` 路由，因此 API 必須自行做認證——但本檔案 GET/POST 皆無 `auth()`、無 API Key、無權限檢查。任何未登入的外部人員都可呼叫。
  2. POST 將上傳檔案寫入暫存目錄時，檔名直接使用使用者可控的 `file.name`：
     `tempFilePath = path.join(tempDir, \`extraction-compare-${Date.now()}-${file.name}\`)`
     `file.name` 來自 multipart 表單，未經清洗。攻擊者可在檔名中放入 `../../...`，由於 `..` 出現在 `/` 之後屬獨立路徑片段，`path.join` 正規化後會跳出 `tmpdir` 寫到任意路徑（受行程權限限制），且寫入內容由攻擊者完全控制 → 未認證任意檔案寫入，最壞情況可覆蓋應用檔案造成 RCE。
- **證據**：
  ```ts
  // 無任何認證
  export async function POST(request: NextRequest): Promise<...> {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    ...
    tempFilePath = path.join(tempDir, `extraction-compare-${Date.now()}-${file.name}`);
    await fs.writeFile(tempFilePath, buffer); // file.name 未清洗
  ```
- **建議**：（1）為所有 `/api/test/*` 端點加認證 + 高權限（或在生產環境以環境變數完全停用）；（2）暫存檔名改用伺服器產生的安全隨機名稱（如 `crypto.randomUUID()`），絕不使用 `file.name`；（3）寫入前以 `path.resolve` 驗證最終路徑仍在 `tmpdir` 之下。

### [High] API-MISC-02 test/extraction-v2 與 extraction-compare 未認證的昂貴操作（成本濫用 / DoS）

- **檔案**：src/app/api/test/extraction-v2/route.ts:136-298；src/app/api/test/extraction-compare/route.ts:358-650
- **類別**：A（無認證）+ K（無界資源 / DoS）
- **描述**：兩個 test 端點皆無認證，POST 會執行完整 Azure Document Intelligence + Azure OpenAI（GPT-5.2 Vision）提取流程，每次呼叫都產生真實雲端費用。未認證攻擊者可大量重複呼叫造成金錢消耗與 DoS。此外 POST 只檢查 `file.type`，**未限制檔案大小**（`extraction-v2` 完全沒有大小檢查；`extraction-compare` 亦無），`await file.arrayBuffer()` 會把整個檔案讀進記憶體 → 大檔案記憶體耗盡 DoS。GET（含 `?testConnections=true`）也會主動對 Azure 發測試連線。這些 test 端點不應暴露於生產環境。
- **證據**：
  ```ts
  // extraction-v2 POST：僅檢查型別，無大小限制、無認證
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const result = await runExtractionV2Pipeline(buffer, file.name, {...});
  ```
- **建議**：生產環境停用 test 端點（環境旗標 gate），或加上認證 + 高權限 + rate limit + 檔案大小上限（對齊 `n8n/documents` 的 50MB 限制）。

### [High] API-MISC-03 n8n/webhook 跨城市 IDOR：可竄改任意 document / workflowExecution

- **檔案**：src/app/api/n8n/webhook/route.ts:160-271
- **類別**：A（授權繞過 / IDOR）
- **描述**：webhook 通過 `n8nApiMiddleware(request, 'webhook:receive')` 驗證 API Key，但後續事件處理器以 payload 中的 `documentId` / `workflowExecutionId` 直接更新資料庫，**完全沒有比對 API Key 的 `cityCode`**。`handleDocumentStatusChanged` 可把任意 `documentId` 的 `status` 改成任意值（含 `APPROVED`/`COMPLETED`）；`handleWorkflowCompleted/Failed/Progress` 可 `updateMany` 任意執行記錄。因此一把僅授權單一城市的 n8n API Key，可跨城市修改其他城市的文件狀態與工作流結果，破壞核心審核流程。
- **證據**：
  ```ts
  async function handleDocumentStatusChanged(data: WebhookEventData) {
    const eventData = data.data as Record<string, unknown>;
    if (data.documentId && eventData.status) {
      const parsedStatus = parseDocumentStatus(eventData.status as string);
      if (parsedStatus) {
        await prisma.document.updateMany({
          where: { id: data.documentId },      // 無 cityCode 範圍限制
          data: { status: parsedStatus },
        });
      }
    }
  }
  ```
- **建議**：所有 webhook 寫入前，先以 `documentId`/`workflowExecutionId` 查出資源並驗證其 `cityCode` 屬於 `authResult.apiKey.cityCode`（或在 `where` 條件加上 `cityCode` 範圍），不符則拒絕。

### [Medium] API-MISC-04 n8n/webhook 將完整請求標頭（含 API Key）以明文存入資料庫

- **檔案**：src/app/api/n8n/webhook/route.ts:95-107
- **類別**：D（Secrets）+ E（敏感資料落地）
- **描述**：建立 `n8nIncomingWebhook` 時，`headers: Object.fromEntries(request.headers.entries())` 把整包請求標頭寫進 DB，其中包含 `Authorization: Bearer <api_key>` 或 `X-API-Key`。等同把可重放的 API 金鑰明文長期儲存於資料庫，任何具 DB 讀取權者皆可取得並重放。
- **證據**：
  ```ts
  await prisma.n8nIncomingWebhook.create({
    data: {
      ...
      headers: Object.fromEntries(request.headers.entries()) as Prisma.JsonObject,
      ...
    },
  });
  ```
- **建議**：存入前過濾敏感標頭（`authorization`、`x-api-key`、`cookie`），或只保留白名單標頭（如 `content-type`、`user-agent`）。

### [Medium] API-MISC-05 test-tasks 系列缺擁有者 / 城市 / 權限範圍檢查（IDOR）

- **檔案**：src/app/api/test-tasks/[taskId]/route.ts:50-117；src/app/api/test-tasks/[taskId]/details/route.ts:75-174；src/app/api/test-tasks/[taskId]/report/route.ts:69-308；src/app/api/test-tasks/[taskId]/cancel/route.ts:68-152
- **類別**：A（IDOR / 授權不一致）
- **描述**：這組端點僅做登入檢查（`session?.user?.id`），對任務本身**無擁有者 / 城市 / 公司範圍驗證**，且權限檢查不一致：
  - `[taskId]` GET 與 `details` GET：**只檢查登入，連 RULE_VIEW 權限都沒有**，任何登入者可用任意 `taskId` 讀取任務狀態與逐筆測試明細。
  - `report` GET：只檢查登入即可下載任意 `taskId` 的 PDF/Excel，內含其他城市的文件檔名（`detail.document.fileName`）與提取結果 → 跨城市資訊洩漏。
  - `cancel` POST：有 `RULE_MANAGE` 但仍無任務擁有者 / 城市檢查，具該權限者可取消任意任務。
- **證據**：
  ```ts
  // details/route.ts：登入後直接取資料，無權限/城市檢查
  const session = await auth()
  if (!session?.user?.id) { ...401 }
  // （此處無 RULE_VIEW、無 city / owner 檢查）
  const result = await getTestDetails(taskId, {...})
  ```
  ```ts
  // report/route.ts：直接以 taskId 查詢，無城市過濾
  const task = await prisma.ruleTestTask.findUnique({ where: { id: taskId }, include: {...} })
  ```
- **建議**：統一加上 `RULE_VIEW`/`RULE_MANAGE` 權限檢查，並以使用者城市範圍或任務 `creatorId` 驗證可存取性（對齊 `withCityFilter` 或 `workflow-executions/[id]` 的城市驗證模式）。

### [Medium] API-MISC-06 workflows/executions cancel 與 retry 缺城市範圍檢查（與 error 路由不一致）

- **檔案**：src/app/api/workflows/executions/[id]/cancel/route.ts:101-170；src/app/api/workflows/executions/[id]/retry/route.ts:101-170
- **類別**：A（授權範圍不足）
- **描述**：cancel / retry 僅檢查角色為 `SUPER_USER`/`ADMIN`，直接以路由 `id` 呼叫 service，**未驗證該執行記錄的 `cityCode` 是否在使用者城市範圍內**。相對地，同目錄的 `error` 路由（第 149-179 行）有先 `findUnique` 取出 `cityCode` 再做 `hasCityAccess` 驗證。若 `ADMIN` 為城市層級角色，城市 A 的 ADMIN 可取消 / 重試城市 B 的工作流（retry 還會重新觸發跨城市工作流）。
- **證據**：
  ```ts
  // cancel：只有角色檢查，無城市範圍驗證
  if (!hasAnyRole(session.user, ALLOWED_ROLES)) { ...403 }
  const success = await workflowTriggerService.cancelExecution(id, session.user.id);
  ```
- **建議**：比照 `error` 路由，先查出執行記錄的 `cityCode` 並驗證 `hasCityAccess`，再執行 cancel / retry。

### [Low] API-MISC-07 資訊洩漏：設定狀態 / 版本 / 原始錯誤訊息直接回傳客戶端

- **檔案**：src/app/api/test/extraction-v2/route.ts:145-170、287-296；src/app/api/test/extraction-compare/route.ts:358-386、628-639；src/app/api/health/route.ts:69；src/app/api/docs/error-codes/route.ts:39-49；src/app/api/openapi/route.ts:44-55
- **類別**：J（資訊洩漏）
- **描述**：（1）test 端點 GET 回傳哪些 Azure 環境變數「missing」（`azureDIConfig.missing`、`gptMiniConfig.missing`、deploymentName），洩漏基礎設施設定狀態；（2）多個端點以 `error.message` / `String(error)` 直接回傳給客戶端，可能洩漏內部路徑或套件細節；（3）health 回傳 `process.env.npm_package_version`，洩漏版本。皆屬縱深防禦缺層。
- **建議**：對外回傳通用錯誤訊息、內部細節改寫入 logger；移除/限制 test 端點的設定狀態輸出。

### [Low] API-MISC-08 CRON_SECRET 以非時序安全比較驗證

- **檔案**：src/app/api/jobs/pattern-analysis/route.ts:69-73
- **類別**：I（認證機制 / 時序攻擊）
- **描述**：`isValidCronSecret` 以 `providedSecret === CRON_SECRET` 直接字串比較，理論上存在時序側信道。正面之處：`CRON_SECRET` 未設定時回傳 `false`（fail-closed），且 POST 在 cron 路徑外仍要求 `RULE_MANAGE`，實際風險低。
- **建議**：改用 `crypto.timingSafeEqual` 做常數時間比較。

### [Info] API-MISC-09 traceId 使用 Math.random 產生

- **檔案**：src/lib/middleware/n8n-api.middleware.ts:216-220（由本 scope 的 n8n 路由使用）
- **類別**：K（不安全隨機數）
- **描述**：`generateTraceId` 以 `Math.random()` 產生追蹤 ID。traceId 僅用於追蹤/稽核非安全憑證，影響極低，僅記錄供參考。
- **建議**：如需可預測性保證可改 `crypto.randomUUID()`；非必要。

### [Info] API-MISC-10 n8n/webhook 以客戶端提供的 timestamp 作為 receivedAt

- **檔案**：src/app/api/n8n/webhook/route.ts:105
- **類別**：K（資料完整性）
- **描述**：`receivedAt: new Date(validatedData.timestamp)` 採用 payload 內客戶端可控時間，且無重放保護 / 簽章。對審計時間正確性與重放偵測為弱點，影響有限。
- **建議**：`receivedAt` 改用伺服器時間 `new Date()`；如需防重放，加入 nonce 或 HMAC 簽章驗證。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 1 | 2 | 3 | 2 | 2 |

---

## 4. 區域整體觀察

1. **`/api/test/*` 屬開發測試端點卻無任何認證且暴露於生產**：已由 `src/middleware.ts`（第 91-98 行 + matcher）確認所有 `/api` 不受全域認證保護，因此 test 端點為完全公開。結合昂貴 Azure 呼叫、無檔案大小限制與 path traversal，是本區域最嚴重的系統性問題（API-MISC-01/02）。

2. **n8n 端點 City 隔離不一致**：`n8n/documents`（POST/result/status）有正確以 `apiKey.cityCode` 做範圍限制，但 `n8n/webhook` 的事件處理器完全沒有城市範圍驗證（API-MISC-03），形成跨城市資料竄改面。

3. **workflow / test-tasks 兩種授權模式並存且不一致**：
   - `workflow-executions/*`（列表/詳情/running/stats）一律以 `withCityFilter` 包裝，城市隔離良好。
   - `workflows/executions/[id]/error` 有城市檢查，但同層的 `cancel`/`retry` 只有角色檢查、缺城市檢查（API-MISC-06）。
   - `test-tasks/*` 整組僅登入檢查、缺權限與城市/擁有者範圍（API-MISC-05），且 GET 類連 RULE_VIEW 都沒有。
   建議統一抽象一個「先取資源 → 驗城市/擁有者 → 再操作」的授權輔助函數，消除各路由各自為政的落差。

4. **正面項**：`rollback-logs`（auth + RULE_VIEW + Zod，UUID 驗證、分頁上限 100）、`n8n/documents` POST（Zod + 50MB 上限 + city 比對）、`workflow-errors/statistics`（角色 + 城市驗證 + Zod）、`workflow-executions` 系列（`withCityFilter`）皆為良好範例。`docs/*`、`openapi`、`health` 為刻意公開的文件/健康端點，可接受（僅輕微資訊洩漏）。未發現原始 SQL 注入（health 的 `$queryRaw\`SELECT 1\`` 為無參數安全用法），未發現硬編碼密鑰。
