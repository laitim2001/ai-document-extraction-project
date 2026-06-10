# 安全審查報告 — src/components/features 第 5/5 批（rules / rule-version / sharepoint / suggestions / template-field-mapping / template-instance / template-match / term-analysis）

> 審查日期：2026-06-10 | Scope：scopes/components-features-4.txt | Agent：components-features-4

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/components/features/rules/index.ts | 50 | ✅ |
| 2 | src/components/features/rules/NewRuleForm.tsx | 587 | ✅ |
| 3 | src/components/features/rules/RecentApplicationsTable.tsx | 191 | ✅ |
| 4 | src/components/features/rules/RuleCreationPanel.tsx | 494 | ✅ |
| 5 | src/components/features/rules/RuleDetailView.tsx | 342 | ✅ |
| 6 | src/components/features/rules/RuleEditDialog.tsx | 135 | ✅ |
| 7 | src/components/features/rules/RuleEditForm.tsx | 751 | ✅ |
| 8 | src/components/features/rules/RuleFilters.tsx | 240 | ✅ |
| 9 | src/components/features/rules/RuleList.tsx | 229 | ✅ |
| 10 | src/components/features/rules/RuleListSkeleton.tsx | 110 | ✅ |
| 11 | src/components/features/rules/RulePatternViewer.tsx | 244 | ✅ |
| 12 | src/components/features/rules/RulePreviewPanel.tsx | 344 | ✅ |
| 13 | src/components/features/rules/RuleStats.tsx | 264 | ✅ |
| 14 | src/components/features/rules/RuleStatusBadge.tsx | 94 | ✅ |
| 15 | src/components/features/rules/RuleSummaryCards.tsx | 153 | ✅ |
| 16 | src/components/features/rules/RuleTable.tsx | 291 | ✅ |
| 17 | src/components/features/rules/RuleTestConfig.tsx | 264 | ✅ |
| 18 | src/components/features/rules/RuleTestPanel.tsx | 335 | ✅ |
| 19 | src/components/features/rules/TestResultComparison.tsx | 317 | ✅ |
| 20 | src/components/features/rule-version/index.ts | 16 | ✅ |
| 21 | src/components/features/rule-version/RollbackConfirmDialog.tsx | 157 | ✅ |
| 22 | src/components/features/rule-version/VersionCompareDialog.tsx | 258 | ✅ |
| 23 | src/components/features/rule-version/VersionDiffViewer.tsx | 309 | ✅ |
| 24 | src/components/features/sharepoint/index.ts | 8 | ✅ |
| 25 | src/components/features/sharepoint/SharePointConfigForm.tsx | 483 | ✅ |
| 26 | src/components/features/sharepoint/SharePointConfigList.tsx | 346 | ✅ |
| 27 | src/components/features/suggestions/ImpactAnalysisPanel.tsx | 274 | ✅ |
| 28 | src/components/features/suggestions/ImpactStatisticsCards.tsx | 158 | ✅ |
| 29 | src/components/features/suggestions/ImpactTimeline.tsx | 211 | ✅ |
| 30 | src/components/features/suggestions/index.ts | 21 | ✅ |
| 31 | src/components/features/suggestions/RiskCasesTable.tsx | 242 | ✅ |
| 32 | src/components/features/suggestions/SimulationConfigForm.tsx | 170 | ✅ |
| 33 | src/components/features/suggestions/SimulationResultsPanel.tsx | 339 | ✅ |
| 34 | src/components/features/template-field-mapping/ClassifiedAsCombobox.tsx | 230 | ✅ |
| 35 | src/components/features/template-field-mapping/FormulaEditor.tsx | 272 | ✅ |
| 36 | src/components/features/template-field-mapping/index.ts | 17 | ✅ |
| 37 | src/components/features/template-field-mapping/LookupTableEditor.tsx | 245 | ✅ |
| 38 | src/components/features/template-field-mapping/MappingRuleEditor.tsx | 312 | ✅ |
| 39 | src/components/features/template-field-mapping/MappingRuleItem.tsx | 395 | ✅ |
| 40 | src/components/features/template-field-mapping/MappingTestPanel.tsx | 275 | ✅ |
| 41 | src/components/features/template-field-mapping/SourceFieldSelector.tsx | 251 | ✅ |
| 42 | src/components/features/template-field-mapping/TargetFieldSelector.tsx | 236 | ✅ |
| 43 | src/components/features/template-field-mapping/TemplateFieldMappingForm.tsx | 624 | ✅ |
| 44 | src/components/features/template-field-mapping/TemplateFieldMappingList.tsx | 443 | ✅ |
| 45 | src/components/features/template-field-mapping/TransformConfigEditor.tsx | 528 | ✅ |
| 46 | src/components/features/template-instance/AddFileDialog.tsx | 300 | ✅ |
| 47 | src/components/features/template-instance/BulkActionsMenu.tsx | 169 | ✅ |
| 48 | src/components/features/template-instance/CreateInstanceDialog.tsx | 233 | ✅ |
| 49 | src/components/features/template-instance/ExportDialog.tsx | 382 | ✅ |
| 50 | src/components/features/template-instance/ExportFieldSelector.tsx | 289 | ✅ |
| 51 | src/components/features/template-instance/index.ts | 25 | ✅ |
| 52 | src/components/features/template-instance/InstanceRowsTable.tsx | 453 | ✅ |
| 53 | src/components/features/template-instance/InstanceStatsOverview.tsx | 103 | ✅ |
| 54 | src/components/features/template-instance/RowDetailDrawer.tsx | 250 | ✅ |
| 55 | src/components/features/template-instance/RowEditDialog.tsx | 256 | ✅ |
| 56 | src/components/features/template-instance/status-config.ts | 100 | ✅ |
| 57 | src/components/features/template-instance/TemplateInstanceCard.tsx | 154 | ✅ |
| 58 | src/components/features/template-instance/TemplateInstanceDetail.tsx | 185 | ✅ |
| 59 | src/components/features/template-instance/TemplateInstanceFilters.tsx | 169 | ✅ |
| 60 | src/components/features/template-instance/TemplateInstanceList.tsx | 292 | ✅ |
| 61 | src/components/features/template-match/BulkMatchDialog.tsx | 372 | ✅ |
| 62 | src/components/features/template-match/DefaultTemplateSelector.tsx | 155 | ✅ |
| 63 | src/components/features/template-match/index.ts | 17 | ✅ |
| 64 | src/components/features/template-match/MatchStatusBadge.tsx | 85 | ✅ |
| 65 | src/components/features/template-match/MatchToTemplateDialog.tsx | 255 | ✅ |
| 66 | src/components/features/template-match/TemplateMatchingConfigAlert.tsx | 103 | ✅ |
| 67 | src/components/features/term-analysis/index.ts | 14 | ✅ |
| 68 | src/components/features/term-analysis/TermFilters.tsx | 192 | ✅ |
| 69 | src/components/features/term-analysis/TermTable.tsx | 324 | ✅ |

合計 69 檔案，約 14,300 行，全部完整讀取。

---

## 2. 發現

### [High] COMP4-01 ClassifiedAsCombobox 呼叫的 classified-as-values API 完全無認證，可越權枚舉任意公司業務資料
- **檔案**：src/components/features/template-field-mapping/ClassifiedAsCombobox.tsx:99-125（消費端）；根因在 src/app/api/companies/[id]/classified-as-values/route.ts:64-155
- **類別**：A（認證與授權 / IDOR）
- **描述**：`ClassifiedAsCombobox` 在收到 `companyId` 時 `fetch('/api/companies/${companyId}/classified-as-values')`。追蹤該 API route 後確認其 `GET` handler **完全沒有 `auth()` / session 檢查**（檔案內無任何認證匯入，從 line 64 直接進入 `params` 解析與 Prisma 查詢），且 middleware（src/middleware.ts:85-92）對所有 `/api` 路徑直接 `NextResponse.next()` 跳過。任何未登入者只要帶任意 `companyId` 即可取得該公司最近 50 筆 `ExtractionResult.stage3Result` 中的 `lineItems[].classifiedAs`（收費分類術語）。屬無認證 + IDOR（無城市範圍 / 擁有者驗證），可枚舉公司 ID 橫向取得業務資料。
- **證據**：
  - 組件端：`const response = await fetch(\`/api/companies/${companyId}/classified-as-values\`);`（ClassifiedAsCombobox.tsx:102-104）
  - API 端 handler 起點無任何 session 檢查：`export async function GET(request, { params }) { ... const { id } = await params; companyId = id;`（route.ts:64-72），其後直接 `prisma.extractionResult.findMany({ where: { document: { companyId } } ... })`
- **建議**：在該 API route 加入 `auth()` session 檢查與城市/角色範圍驗證；前端無需改動。（此根因屬 API 範圍，可能與 api scope agent 重疊，於此標註以利交叉比對。）

### [Low] COMP4-02 模板匹配相關 fetch query 參數未經 encodeURIComponent
- **檔案**：src/components/features/template-match/MatchToTemplateDialog.tsx:119；src/components/features/template-match/BulkMatchDialog.tsx:140
- **類別**：C（輸入驗證）/ K（其他）
- **描述**：`fetch(\`/api/v1/template-instances?dataTemplateId=${selectedTemplateId}&status=DRAFT,ACTIVE\`)` 直接把 `selectedTemplateId` 拼進 query string 未編碼。該值來源為後端回傳的 `template.id`（受信任，CUID），目前無法由使用者任意注入，故風險低；但若 id 含 `&`、`#` 等字元會破壞 query 解析。屬最佳實踐缺失。
- **證據**：`\`/api/v1/template-instances?dataTemplateId=${selectedTemplateId}&status=DRAFT,ACTIVE\``（MatchToTemplateDialog.tsx:119）
- **建議**：使用 `URLSearchParams` 或 `encodeURIComponent` 包裹拼接值（與同目錄 AddFileDialog.tsx 已採用的 `URLSearchParams` 寫法一致）。

### [Info] COMP4-03 MappingTestPanel 客戶端 JSON 預覽以使用者輸入 key 寫入物件，理論原型污染面
- **檔案**：src/components/features/template-field-mapping/MappingTestPanel.tsx:45-107, 142-152
- **類別**：K（其他風險 / 原型污染）
- **描述**：`previewMappings` 將使用者貼上的 JSON `JSON.parse` 後讀取 `input[rule.sourceField]`，並以 `output[rule.targetField] = ...` 寫回新物件。`targetField`/`sourceField` 來自模板映射規則（受信任配置，非使用者任意輸入），且 `output` 為新建的 plain object、結果僅作畫面預覽不回傳後端，實際利用條件極低。僅記錄為觀察。
- **證據**：`const input = JSON.parse(inputJson); ... output[rule.targetField] = sourceValue;`（MappingTestPanel.tsx:143, 59）
- **建議**：無須立即處理；若日後 `targetField` 可由不受信來源提供，應過濾 `__proto__`/`constructor`/`prototype` 或改用 `Object.create(null)`。

### [Info] COMP4-04 多個組件以 `console.error` 記錄載入失敗（無 PII，僅觀察）
- **檔案**：ClassifiedAsCombobox.tsx:112、AddFileDialog.tsx:107、BulkMatchDialog.tsx:120/146、DefaultTemplateSelector.tsx:87、MatchToTemplateDialog.tsx:98/124、ExportDialog.tsx:184
- **類別**：E（PII 與日誌）
- **描述**：這些 `console.error` 僅輸出固定字串與 error 物件，未記錄 email / token / 密碼 / 完整檔案內容，不構成 PII 洩漏。與根 CLAUDE.md「console.log 漸進清理為 logger」的既有系統性議題一致，僅供清單參考。
- **建議**：併入既有 logger 遷移計畫，無安全急迫性。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 1 | 0 | 1 | 2 |

---

## 4. 區域整體觀察

- **前端組件本身整體安全**：本批 69 個檔案皆為 `'use client'` 功能組件，**未發現** `dangerouslySetInnerHTML`、未發現 `javascript:` 可注入的 `href`、未發現 `postMessage`、未發現客戶端組件直接 `import prisma` 或 server 模組、未發現將 token/secret 寫入 `localStorage`。`SharePointConfigForm` 的 `clientSecret` 使用 `type="password"` 且僅於連線測試時透過 callback 傳給後端，前端未 log 亦未持久化，符合預期。
- **無前端可執行表達式注入**：`FormulaEditor`、`TransformConfigEditor`（CUSTOM expression）、`MappingTestPanel`（FORMULA）皆**不在前端執行** `eval` / `new Function`；FORMULA/CUSTOM 明確標註「需後端計算」，前端僅做語法提示與括號/變數名格式驗證（防禦縱深，非安全邊界）。
- **主要風險集中在被消費的 API 認證缺口**：本批最嚴重的問題（COMP4-01）並非組件碼缺陷，而是組件呼叫的 `/api/companies/[id]/classified-as-values` 後端無認證。已確認 `src/middleware.ts` 對所有 `/api` 路徑一律跳過，因此 API 認證完全依賴各 route 自身的 `auth()`；對照 `/api/rules/route.ts` 已有 `auth()`（line 120、362），可見覆蓋不一致——與專案已知「Auth 覆蓋率約 60%」系統性缺口吻合。建議將前端會帶 `companyId`/`id` 參數呼叫的所有讀取型 API 一併納入 auth 補強清單。
- **fetch 目標皆為同源相對路徑**：本批所有 `fetch` 目標都是 `/api/...` 同源端點，無 SSRF 面；使用者輸入僅作為 query 參數或 JSON body，未用於組裝外部 URL。
