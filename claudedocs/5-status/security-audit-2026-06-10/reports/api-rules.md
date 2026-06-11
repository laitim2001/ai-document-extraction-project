# 安全審查報告 — Rules / Routing / Confidence / Prompts API

> 審查日期：2026-06-10 | Scope：scopes/api-rules.txt | Agent：api-rules 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/app/api/confidence/[id]/review/route.ts | 133 | ✅ |
| 2 | src/app/api/confidence/[id]/route.ts | 233 | ✅ |
| 3 | src/app/api/prompts/resolve/route.ts | 170 | ✅ |
| 4 | src/app/api/routing/queue/[id]/assign/route.ts | 208 | ✅ |
| 5 | src/app/api/routing/queue/route.ts | 178 | ✅ |
| 6 | src/app/api/routing/route.ts | 236 | ✅ |
| 7 | src/app/api/rules/[id]/accuracy/route.ts | 156 | ✅ |
| 8 | src/app/api/rules/[id]/metrics/route.ts | 167 | ✅ |
| 9 | src/app/api/rules/[id]/preview/route.ts | 599 | ✅ |
| 10 | src/app/api/rules/[id]/route.ts | 526 | ✅ |
| 11 | src/app/api/rules/[id]/test/route.ts | 216 | ✅ |
| 12 | src/app/api/rules/[id]/versions/compare/route.ts | 436 | ✅ |
| 13 | src/app/api/rules/[id]/versions/rollback/route.ts | 291 | ✅ |
| 14 | src/app/api/rules/[id]/versions/route.ts | 229 | ✅ |
| 15 | src/app/api/rules/bulk/route.ts | 541 | ✅ |
| 16 | src/app/api/rules/bulk/undo/route.ts | 364 | ✅ |
| 17 | src/app/api/rules/route.ts | 531 | ✅ |
| 18 | src/app/api/rules/suggestions/[id]/approve/route.ts | 330 | ✅ |
| 19 | src/app/api/rules/suggestions/[id]/impact/route.ts | 127 | ✅ |
| 20 | src/app/api/rules/suggestions/[id]/reject/route.ts | 226 | ✅ |
| 21 | src/app/api/rules/suggestions/[id]/route.ts | 519 | ✅ |
| 22 | src/app/api/rules/suggestions/[id]/simulate/route.ts | 165 | ✅ |
| 23 | src/app/api/rules/suggestions/generate/route.ts | 299 | ✅ |
| 24 | src/app/api/rules/suggestions/route.ts | 447 | ✅ |
| 25 | src/app/api/rules/test/route.ts | 526 | ✅ |
| 26 | src/app/api/rules/version/route.ts | 119 | ✅ |

**輔助確認**：另讀取 `src/middleware.ts`（確認 API 路由不受 middleware 認證保護）、`src/lib/auth/city-permission.ts`（確認 `hasPermission` 與 wildcard `*` 行為）。

---

## 2. 發現

### [High] CONF-01 信心度端點完全無認證 / 授權
- **檔案**：src/app/api/confidence/[id]/route.ts:49（GET）、:147（POST）；src/app/api/confidence/[id]/review/route.ts:55（POST）
- **類別**：A（認證與授權）
- **描述**：三個 confidence 端點全無 `auth()` 檢查，亦無任何權限驗證。任何未認證者皆可：
  - GET 讀取任一文件的信心度結果（含 `processingPath` 等內部處理資訊）；
  - POST 觸發任一文件的信心度重新計算（昂貴運算，含歷史準確率查詢，DoS 面）；
  - POST `/review` 寫入審核修正結果（`recordReviewResult`），直接污染歷史準確率，進而影響後續所有文件的信心度路由決策（資料完整性破壞）。
- **證據**：
  ```ts
  // confidence/[id]/route.ts — POST，無 session 檢查，直接進入計算
  const resolvedParams = await params
  const { id: documentId } = paramsSchema.parse(resolvedParams)
  const body = await request.json().catch(() => ({}))
  const options = calculateOptionsSchema.parse(body)
  ```
  ```ts
  // confidence/[id]/review/route.ts — 直接寫入審核結果
  await recordReviewResult(documentId, corrections)
  ```
  已確認 `src/middleware.ts:91-98` 對所有 `/api` 路由 `return NextResponse.next()`，不提供任何認證；保護完全依賴 handler 自身。
- **建議**：加入 `auth()` session 檢查；`review`（寫入歷史準確率）應要求審核相關權限（如 REVIEW / RULE_MANAGE 等）。同時驗證呼叫者對該文件所屬城市/Company 的存取範圍（IDOR）。

### [High] PROMPT-01 Prompt 解析端點完全無認證 / 授權
- **檔案**：src/app/api/prompts/resolve/route.ts:53（POST）、:145（GET）
- **類別**：A（認證與授權）、J（資訊洩漏）
- **描述**：POST 與 GET 皆無 `auth()`。未認證者可：
  - POST 任意 `companyId` / `documentFormatId` 解析並取回合併後的 Prompt 配置內容（system prompt / user prompt template），這些屬於提取系統的內部智財與業務邏輯，外洩等於暴露公司特定提取策略；
  - GET 取回支援變數列表。此外 POST 接受任意 `contextVariables`（`z.record(z.string(), z.unknown())`）進入變數替換，無認證下擴大被濫用面。
- **證據**：
  ```ts
  export async function POST(request: NextRequest) {
    const body = await request.json();
    const validationResult = PromptResolutionRequestSchema.safeParse(body);
    // ...無任何 auth() / 權限檢查
    const resolver = getPromptResolver(prisma);
    const result = await resolver.resolve(resolutionRequest);
  ```
- **建議**：加入 `auth()` 與適當權限（Prompt 配置屬 Epic 14 管理功能，應要求對應管理權限）；並對 `companyId` 做存取範圍驗證。

### [High] RULES-01 規則測試端點存在 ReDoS（使用者提供 regex 對任意文件 OCR 文字執行）
- **檔案**：src/app/api/rules/test/route.ts:103-178（testRegexPattern，:121 `new RegExp`、:124 `content.match`、:141 `regexForPos.exec` 迴圈）
- **類別**：K（其他風險 — DoS）、B（注入相關面）
- **描述**：使用者完全控制 `pattern.expression` 與 `flags`，直接 `new RegExp(expression, flags)`，對 `documentContent`（使用者任意提供）或指定文件的 OCR 全文執行 `match` 並以全域 flag 迴圈 `exec`。惡意的災難性回溯 regex（如 `(a+)+$`）配合長輸入可使 Node.js 事件迴圈長時間阻塞，造成單一請求拖垮整個 server（Next.js 單執行緒）。雖端點要求 RULE_MANAGE 權限，但仍允許低於管理員的合法低權使用者觸發全服務阻塞。
- **證據**：
  ```ts
  const regex = new RegExp(expression, flags || 'gm')
  const matches = content.match(regex)
  // ...
  const regexForPos = new RegExp(expression, flags || 'gm')
  while ((match = regexForPos.exec(content)) !== null) { ... }
  ```
- **建議**：對使用者 regex 加上執行逾時保護（如 worker thread + 逾時中止、或 `re2` 安全 regex 引擎）；限制 `content` 長度上限；限制 regex 長度與複雜度。

### [High] RULES-02 規則預覽端點存在 ReDoS（與 RULES-01 同模式）
- **檔案**：src/app/api/rules/[id]/preview/route.ts:444-516（executeRegexPattern，:466 `new RegExp`、:467 `regex.exec`）
- **類別**：K（其他風險 — DoS）
- **描述**：與 RULES-01 相同，`previewPattern.expression`（使用者可提供）直接 `new RegExp` 並對 OCR 文字 `exec`。要求 RULE_MANAGE 權限，但合法低權使用者仍可觸發災難性回溯阻塞事件迴圈。另：第 280 行對 `documentContent` 做 `Buffer.from(documentContent, 'base64')` 後當文字處理，無長度上限。
- **證據**：
  ```ts
  const regex = new RegExp(expression, flags)
  const match = regex.exec(text)
  ```
- **建議**：同 RULES-01——regex 執行逾時 / 安全 regex 引擎 / 輸入長度上限。

### [Medium] RULES-03 規則測試 / 預覽缺對文件擁有者（城市範圍）的存取驗證（潛在 IDOR）
- **檔案**：src/app/api/rules/test/route.ts:440（依 documentId 取 OCR 文字）；src/app/api/rules/[id]/preview/route.ts:237（依 documentId 取 OCR）
- **類別**：A（IDOR）
- **描述**：兩端點接受任意 `documentId` 並回傳該文件的 OCR 全文內容（test 端點直接以 OCR 文字作為比對來源，可間接回讀內容）。僅檢查 RULE_MANAGE 權限，未驗證呼叫者是否有權存取該文件所屬城市/Company。preview 端點有檢查「文件 company 與規則 company 一致」（:260），但未檢查使用者本身的城市範圍。具備 RULE_MANAGE 的低權使用者可藉此讀取非其管轄城市文件的 OCR 內容。
- **證據**：
  ```ts
  // rules/test/route.ts
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, status: true, ocrResult: { select: { extractedText: true } } },
  })
  // 無城市範圍 / 擁有者驗證
  content = document.ocrResult.extractedText
  ```
- **建議**：對 `documentId` 加入城市範圍 / Company 範圍驗證（與系統其他文件存取一致）。

### [Medium] ROUTING-01 隊列分配未驗證 reviewerId 有效性與分配者權限
- **檔案**：src/app/api/routing/queue/[id]/assign/route.ts:79-158
- **類別**：A（授權）
- **描述**：僅檢查 `auth()`（任何登入者），無細粒度權限（如審核 / 隊列管理權限）。`reviewerId` 為使用者提供的任意 UUID（:50-52 僅驗格式），可將隊列項目分配給任意使用者 ID，未驗證該 ID 是否為實際存在且具審核權限的使用者。任何登入者皆可重指派他人的待審項目（業務流程篡改）。
- **證據**：
  ```ts
  const reviewerId = validation.data.reviewerId || session.user.id
  await assignToReviewer(queueId, reviewerId)
  ```
- **建議**：加入隊列分配權限檢查；驗證 `reviewerId` 對應的使用者存在且具審核權限；考慮限制非管理者只能將項目分配給自己。

### [Medium] ROUTING-02 routing / queue 端點僅有登入檢查、無細粒度權限
- **檔案**：src/app/api/routing/route.ts:93（POST，文件路由 + 批量）；src/app/api/routing/queue/route.ts:57（GET，隊列列表）
- **類別**：A（授權）
- **描述**：兩端點僅檢查 `session?.user`，無權限驗證。任何登入者可：觸發任意文件（或批量最多 50 個）的路由決策（會更新文件狀態與隊列、寫審計，:75），以及讀取全系統處理隊列列表與統計（無城市範圍過濾，跨城市資訊洩漏）。相較於同 scope 內 rules 端點普遍要求 RULE_VIEW / RULE_MANAGE，此處授權明顯較弱。
- **證據**：
  ```ts
  // routing/queue/route.ts:62
  if (!session?.user) { return 401 }
  // 之後直接 getProcessingQueue(...) 無城市過濾、無權限分級
  ```
- **建議**：加入對應權限（審核 / 隊列查看）；queue 列表依使用者城市範圍過濾。

### [Medium] RULES-04 bulk/undo 可撤銷他人的批量操作、列出全系統操作（無擁有者範圍）
- **檔案**：src/app/api/rules/bulk/undo/route.ts:66（GET 列出）、:171（POST 撤銷）
- **類別**：A（授權 — 缺擁有者範圍）、K（資料完整性）
- **描述**：僅檢查 RULE_MANAGE。GET 列出最近 24 小時所有人的可撤銷操作（含 `createdBy`）；POST 可依任意 `bulkOperationId` 撤銷任何人的批量建立/更新/軟刪除，無「僅能撤銷自己操作」或更高審核權限的限制。具 RULE_MANAGE 的使用者可回退他人剛完成的合法批量變更，造成規則狀態被惡意/誤操作回滾。
- **證據**：
  ```ts
  const operation = await prisma.bulkOperation.findUnique({ where: { id: bulkOperationId } })
  // 僅檢查 isUndone / 類型，未檢查 operation.createdBy === session.user.id
  ```
- **建議**：限制只能撤銷自己建立的操作，或撤銷他人操作需更高權限（如 RULE_APPROVE）；GET 預設僅列出自己的操作。

### [Low] RULES-05 wildcard `*` 權限在所有 rules 端點均被接受
- **檔案**：所有使用 `r.permissions.includes('*')` 的 helper（如 rules/route.ts:60、bulk/route.ts:80、suggestions/[id]/route.ts:44 等）；底層 src/lib/auth/city-permission.ts:396-409
- **類別**：A（授權 — 縱深防禦）
- **描述**：`hasPermission` 與各 route 內聯 helper 皆將擁有 `*` 權限的角色視為通過所有檢查。註解標示「僅限開發/測試」，但程式無任何環境閘門阻止生產環境的角色帶有 `*`（僅在 development 印出 warning，:402-407）。若任一生產角色被賦予 `*`，等同繞過全部 rules 授權。
- **證據**：
  ```ts
  const hasWildcard = user.roles.some((role) =>
    Array.isArray(role.permissions) && role.permissions.includes('*'))
  if (hasWildcard) { /* development warning only */ return true }
  ```
- **建議**：在生產環境（`NODE_ENV === 'production'`）禁用 wildcard，或於 seed / 角色管理層禁止建立含 `*` 的生產角色。

### [Low] RULES-06 多處查詢參數 id 未驗格式即進 Prisma 查詢
- **檔案**：rules/[id]/route.ts:119、rules/[id]/accuracy/route.ts:56、rules/[id]/versions/route.ts:70、rules/suggestions/[id]/route.ts:97 等（多數 `[id]` 端點未對 ruleId/suggestionId 做 UUID/CUID 驗證即 `findUnique`）
- **類別**：C（輸入驗證 — 縱深防禦）
- **描述**：多數端點直接以未驗證的 `ruleId` 進 `prisma.findUnique`。Prisma 為參數化查詢，無 SQL 注入風險（故僅 Low），但缺格式驗證屬縱深防禦缺層，且與 rules/[id]/test/route.ts:125（有 UUID 驗證）不一致。
- **證據**：
  ```ts
  const { id: ruleId } = await params
  const rule = await prisma.mappingRule.findUnique({ where: { id: ruleId }, ... })
  ```
- **建議**：統一在各 `[id]` 端點加 UUID/CUID 格式驗證，回 400。

### [Low] CONF-02 review 端點 corrections 為無上限的 record
- **檔案**：src/app/api/confidence/[id]/review/route.ts:26-29
- **類別**：C（輸入驗證 — DoS 面）
- **描述**：`corrections: z.record(z.string(), z.boolean())` 無鍵數量上限，配合 CONF-01 的無認證，攻擊者可送超大物件耗用記憶體 / 處理時間。
- **建議**：限制 corrections 鍵數上限；並先補上認證（見 CONF-01）。

### [Info] RULES-07 suggestions/generate 批量處理未傳遞 limit 參數
- **檔案**：src/app/api/rules/suggestions/generate/route.ts:251-282（handleBatchGenerate）
- **類別**：K（非安全 — 功能 / 資源）
- **描述**：batch 模式驗證了 `limit`（:62-64，最大 100）但呼叫 `ruleSuggestionGenerator.processAllCandidates()` 時未傳入 limit，可能處理超出預期數量的候選（資源消耗），屬潛在無界操作。非直接安全漏洞，記為觀察。
- **建議**：將驗證後的 `limit` 傳入 `processAllCandidates(limit)`。

### [Info] RULES-08 內部錯誤訊息回傳給客戶端（資訊洩漏面）
- **檔案**：confidence/[id]/route.ts:119,228；confidence/[id]/review/route.ts:128；routing/route.ts:230；routing/queue/route.ts:172；routing/queue/[id]/assign/route.ts:202；rules/suggestions/[id]/approve/route.ts:308 等
- **類別**：J（資訊洩漏）
- **描述**：多處 catch 區塊將 `error.message` 直接放入 RFC 7807 `detail` 回傳客戶端（如 `error instanceof Error ? error.message : ...`）。Prisma / 內部例外訊息可能洩漏 schema 欄位、約束或內部邏輯。屬輕微資訊洩漏。注意：本 scope 內未發現 console.log 輸出 email / token / 密碼等 PII（E 類乾淨）。
- **建議**：對外回傳統一通用訊息，內部詳情僅寫 logger。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 4 | 4 | 3 | 3 |

---

## 4. 區域整體觀察

1. **認證覆蓋呈兩極化**：`/rules/*` 域（本 scope 19 個 rules 檔案）實際上**全部**具備 `auth()` + 細粒度權限檢查（RULE_VIEW / RULE_MANAGE / RULE_APPROVE），覆蓋率遠高於 MEMORY.md 中記錄的「/rules 域約 16%」舊數據——該舊數據與本次逐檔審查結果不符，rules 域授權實際上是健全的。**真正的認證缺口集中在非 rules 的鄰近端點**：`confidence/*`（3 個檔案全無 auth）與 `prompts/resolve`（1 個檔案全無 auth），共 4 個端點完全公開（CONF-01、PROMPT-01，均 High）。

2. **routing 域授權偏弱**：`routing/*` 3 個端點僅有「登入即可」層級，缺細粒度權限與城市範圍過濾（ROUTING-01、ROUTING-02），與同目錄 rules 端點的嚴謹度不一致。

3. **使用者控制 regex 的 ReDoS 是本區最具體的系統性技術風險**：`rules/test` 與 `rules/[id]/preview` 兩處皆 `new RegExp(使用者輸入)` 並對長文字執行，無逾時保護（RULES-01、RULES-02）。雖受 RULE_MANAGE 權限保護，但 Next.js 單執行緒下足以被合法低權使用者拖垮整個服務。

4. **缺「操作擁有者」範圍**：bulk/undo 可撤銷他人操作、routing/queue 可分配給任意 reviewerId、test/preview 可讀任意文件 OCR——授權僅止於「有無權限」而未及「能否操作此特定資源」，IDOR / 越權操作風險貫穿多個端點（RULES-03、RULES-04、ROUTING-01）。

5. **注入面整體乾淨**：本 scope 無 `$queryRawUnsafe` / `$executeRawUnsafe` / 字串拼接 SQL / exec / spawn；所有 DB 存取走 Prisma 參數化。FIX-051（db-context.ts SQL injection）無回歸跡象（該檔案不在本 scope）。PII 日誌（FIX-050）在本 scope 亦無回歸——未見 console.log 輸出 email / token。

6. **驗證一致性問題**：多數 `[id]` 端點未對路徑參數做格式驗證即進 Prisma（RULES-06），與 rules/[id]/test 的 UUID 驗證不一致；分頁 / limit 多處有正確上限（如 versions:max 100、suggestions:max 100、queue:min(100)），此部分良好。
