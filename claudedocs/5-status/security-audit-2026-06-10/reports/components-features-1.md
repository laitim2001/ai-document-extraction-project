# 安全審查報告 — components/features 第 2/5 批（docs / document / document-preview / document-source / escalation / exchange-rate / field-definition-set / format-analysis / formats）

> 審查日期：2026-06-10 | Scope：scopes/components-features-1.txt | Agent：components-features-1

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/components/features/data-template/index.ts | 23 | ✅ |
| 2 | src/components/features/docs/CodeBlock.tsx | 142 | ✅ |
| 3 | src/components/features/docs/index.ts | 10 | ✅ |
| 4 | src/components/features/docs/LanguageTabs.tsx | 89 | ✅ |
| 5 | src/components/features/docs/SDKExamplesContent.tsx | 271 | ✅ |
| 6 | src/components/features/docs/SwaggerUIWrapper.tsx | 208 | ✅ |
| 7 | src/components/features/document/detail/AiDetailsTab.tsx | 565 | ✅ |
| 8 | src/components/features/document/detail/DocumentAuditLog.tsx | 304 | ✅ |
| 9 | src/components/features/document/detail/DocumentDetailHeader.tsx | 222 | ✅ |
| 10 | src/components/features/document/detail/DocumentDetailStats.tsx | 248 | ✅ |
| 11 | src/components/features/document/detail/DocumentDetailTabs.tsx | 248 | ✅ |
| 12 | src/components/features/document/detail/index.ts | 19 | ✅ |
| 13 | src/components/features/document/detail/ProcessingTimeline.tsx | 321 | ✅ |
| 14 | src/components/features/document/detail/SmartRoutingBanner.tsx | 170 | ✅ |
| 15 | src/components/features/document/DocumentListTable.tsx | 263 | ✅ |
| 16 | src/components/features/document/FileUploader.tsx | 491 | ✅ |
| 17 | src/components/features/document/index.ts | 10 | ✅ |
| 18 | src/components/features/document/ProcessingStatus.tsx | 122 | ✅ |
| 19 | src/components/features/document/RetryButton.tsx | 116 | ✅ |
| 20 | src/components/features/document-preview/DynamicPDFViewer.tsx | 84 | ✅ |
| 21 | src/components/features/document-preview/ExtractedFieldsPanel.tsx | 280 | ✅ |
| 22 | src/components/features/document-preview/FieldCard.tsx | 288 | ✅ |
| 23 | src/components/features/document-preview/FieldFilters.tsx | 187 | ✅ |
| 24 | src/components/features/document-preview/FieldHighlightOverlay.tsx | 252 | ✅ |
| 25 | src/components/features/document-preview/index.ts | 69 | ✅ |
| 26 | src/components/features/document-preview/LineItemsTable.tsx | 212 | ✅ |
| 27 | src/components/features/document-preview/PDFControls.tsx | 289 | ✅ |
| 28 | src/components/features/document-preview/PDFErrorDisplay.tsx | 124 | ✅ |
| 29 | src/components/features/document-preview/PDFLoadingSkeleton.tsx | 81 | ✅ |
| 30 | src/components/features/document-preview/PDFViewer.tsx | 356 | ✅ |
| 31 | src/components/features/document-source/DocumentSourceBadge.tsx | 122 | ✅ |
| 32 | src/components/features/document-source/DocumentSourceDetails.tsx | 306 | ✅ |
| 33 | src/components/features/document-source/index.ts | 11 | ✅ |
| 34 | src/components/features/document-source/SourceTypeFilter.tsx | 81 | ✅ |
| 35 | src/components/features/document-source/SourceTypeStats.tsx | 179 | ✅ |
| 36 | src/components/features/document-source/SourceTypeTrend.tsx | 165 | ✅ |
| 37 | src/components/features/escalation/EscalationFilters.tsx | 165 | ✅ |
| 38 | src/components/features/escalation/EscalationListSkeleton.tsx | 66 | ✅ |
| 39 | src/components/features/escalation/EscalationListTable.tsx | 154 | ✅ |
| 40 | src/components/features/escalation/EscalationReasonBadge.tsx | 107 | ✅ |
| 41 | src/components/features/escalation/EscalationStatusBadge.tsx | 79 | ✅ |
| 42 | src/components/features/escalation/index.ts | 22 | ✅ |
| 43 | src/components/features/escalation/ResolveDialog.tsx | 531 | ✅ |
| 44 | src/components/features/exchange-rate/CurrencySelect.tsx | 163 | ✅ |
| 45 | src/components/features/exchange-rate/ExchangeRateCalculator.tsx | 235 | ✅ |
| 46 | src/components/features/exchange-rate/ExchangeRateFilters.tsx | 233 | ✅ |
| 47 | src/components/features/exchange-rate/ExchangeRateForm.tsx | 445 | ✅ |
| 48 | src/components/features/exchange-rate/ExchangeRateImportDialog.tsx | 453 | ✅ |
| 49 | src/components/features/exchange-rate/ExchangeRateList.tsx | 363 | ✅ |
| 50 | src/components/features/exchange-rate/index.ts | 25 | ✅ |
| 51 | src/components/features/field-definition-set/FieldCandidatePicker.tsx | 477 | ✅ |
| 52 | src/components/features/field-definition-set/FieldCoverageSummary.tsx | 264 | ✅ |
| 53 | src/components/features/field-definition-set/FieldDefinitionSetFilters.tsx | 178 | ✅ |
| 54 | src/components/features/field-definition-set/FieldDefinitionSetForm.tsx | 429 | ✅ |
| 55 | src/components/features/field-definition-set/FieldDefinitionSetList.tsx | 340 | ✅ |
| 56 | src/components/features/field-definition-set/FieldEntryEditor.tsx | 205 | ✅ |
| 57 | src/components/features/field-definition-set/index.ts | 14 | ✅ |
| 58 | src/components/features/field-definition-set/ScopeBadge.tsx | 58 | ✅ |
| 59 | src/components/features/format-analysis/CompanyFormatTree.tsx | 310 | ✅ |
| 60 | src/components/features/format-analysis/FormatTermsPanel.tsx | 368 | ✅ |
| 61 | src/components/features/format-analysis/index.ts | 22 | ✅ |
| 62 | src/components/features/formats/ConfigInheritanceInfo.tsx | 104 | ✅ |
| 63 | src/components/features/formats/CreateFormatDialog.tsx | 359 | ✅ |
| 64 | src/components/features/formats/FormatBasicInfo.tsx | 196 | ✅ |
| 65 | src/components/features/formats/FormatCard.tsx | 206 | ✅ |
| 66 | src/components/features/formats/FormatConfigPanel.tsx | 221 | ✅ |
| 67 | src/components/features/formats/FormatDetailView.tsx | 315 | ✅ |
| 68 | src/components/features/formats/FormatFilesTable.tsx | 288 | ✅ |
| 69 | src/components/features/formats/FormatFilters.tsx | 196 | ✅ |
| 70 | src/components/features/formats/FormatForm.tsx | 163 | ✅ |
| 71 | src/components/features/formats/FormatList.tsx | 256 | ✅ |

合計：71 個檔案，約 12,962 行，全部完整讀取。

## 2. 發現

整體而言，本批屬於前端展示組件，**未發現 Critical / High 級別問題**。沒有任何 `dangerouslySetInnerHTML`、沒有客戶端組件 import prisma / server 模組、沒有將敏感資料寫入 localStorage 的自有程式碼、沒有硬編碼 secret。以下為縱深防禦層級的 Low / Info 觀察。

---

### [Low] F-01 PDFViewer 於執行期從第三方 CDN（unpkg.com）載入可執行 worker 腳本（供應鏈風險）

- **檔案**：src/components/features/document-preview/PDFViewer.tsx:77
- **類別**：G（外部呼叫 / 供應鏈）、K
- **描述**：PDF.js worker 在執行期由公開 CDN 載入並作為 Web Worker 執行。若 unpkg.com 被入侵、版本被竄改或 DNS 被劫持，會在使用者瀏覽器執行任意程式碼；同時形成對外部主機的可用性依賴（CDN 不可達時 PDF 預覽失效）。版本來自 `pdfjs.version`（套件內建），URL 主機固定，使用者無法注入，因此非注入問題，但屬無 SRI / 無自託管的縱深防禦缺層。
- **證據**：
  ```ts
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  ```
  （同模式亦見於 scope 外的 src/components/features/review/PdfViewer/PdfViewer.tsx:30，使用 `//unpkg.com/...`，連協定都省略。）
- **建議**：改為自託管 worker（從 `pdfjs-dist` 套件 bundle / copy 到 `public/`），或在 CSP 的 `script-src` / `worker-src` 明確限制來源並考慮 SRI。生產環境不應依賴公開 CDN 載入可執行碼。

---

### [Low] F-02 SwaggerUIWrapper 啟用 tryItOut + persistAuthorization，會將 API 認證憑證寫入瀏覽器 localStorage

- **檔案**：src/components/features/docs/SwaggerUIWrapper.tsx:118-119
- **類別**：E（敏感資料儲存）、F
- **描述**：`tryItOutEnabled={true}` 允許在文檔頁直接對真實 API 發出請求；`persistAuthorization={true}` 是 swagger-ui-react 的功能，會把使用者於授權框輸入的 API key / Bearer token 持久化至瀏覽器（localStorage），存活於重整與分頁之間，增加 token 在共用 / 受感染裝置上被竊取的面。雖然這是第三方組件行為而非自有程式碼寫入，但組態選擇放大了暴露面。
- **證據**：
  ```tsx
  <SwaggerUI spec={spec} ... tryItOutEnabled={true} persistAuthorization={true} />
  ```
- **建議**：評估是否真的需要 `persistAuthorization`；如非必要設為 `false`，避免長期把憑證留在 localStorage。同時確認此頁面（及其載入的 `/api/openapi`）有適當存取控制，避免未授權者取得完整 API 規格並做 tryItOut（屬 API 端審查範圍，於此標註交叉確認）。

---

### [Low] F-03 DocumentSourceDetails 將 SharePoint webUrl 直接放入 `href`，無 scheme 白名單驗證

- **檔案**：src/components/features/document-source/DocumentSourceDetails.tsx:147-156
- **類別**：F（XSS / 連結注入）
- **描述**：`details.sharepoint.webUrl` 來自來源追蹤資料（Microsoft Graph / SharePoint），未經 scheme 驗證即作為 `<a href>` 渲染。React **不會**自動封鎖 `javascript:` 協定的 href，若該 URL 在任一上游可被污染為 `javascript:...`，使用者點擊「在 SharePoint 中查看」即可觸發 script 執行（DOM XSS）。實際來源為受信任的 Graph API，遭污染機率低，故列為 Low。
- **證據**：
  ```tsx
  <a href={details.sharepoint.webUrl} target="_blank" rel="noopener noreferrer" ...>
    在 SharePoint 中查看
  </a>
  ```
- **建議**：渲染前驗證 scheme 僅允許 `https:`（或 `http:`），對非白名單協定不渲染連結或降級為純文字。

---

### [Info] F-04 DocumentDetailHeader 以 blobUrl 作為 `<a>` href 並程式化點擊下載，未驗證 scheme

- **檔案**：src/components/features/document/detail/DocumentDetailHeader.tsx:99-101
- **類別**：F、H
- **描述**：`handleDownload` 動態建立 `<a>`，將 `document.blobUrl`（伺服器提供的 Azure Blob / SAS URL）設為 `href` 後 `.click()` 觸發下載。blobUrl 為伺服器生成，使用者不可控，且僅用於下載，風險低；惟與 F-03 同類，缺 scheme 白名單為理論性連結注入面。`download` 屬性設為 `document.fileName`，亦未清洗（檔名來自上傳，瀏覽器一般會處理路徑分隔，影響有限）。
- **證據**：
  ```ts
  const link = window.document.createElement('a')
  link.href = document.blobUrl
  link.download = document.fileName
  link.click()
  ```
- **建議**：可選擇性對 blobUrl 做 `https:` scheme 檢查作為縱深防禦；現狀風險可接受。

---

### [Info] F-05 審計日誌與來源詳情在 UI 顯示 PII（email / 寄件者），屬授權檢視非日誌外洩

- **檔案**：src/components/features/document/detail/DocumentAuditLog.tsx:243,257,266；src/components/features/document-source/DocumentSourceDetails.tsx:173-177,184
- **類別**：E
- **描述**：組件以文字方式渲染 `performedBy.email`、變更前後值、寄件者 email/姓名。這些是面向已授權審核者的正常 UI 顯示（非寫入 plaintext log），且皆以 React 文字節點渲染（無 XSS）。資料來源 API（`/api/audit/logs`）已驗證會檢查 session（route.ts:39-40 `auth()`）。此處僅作為 PII 流經前端的觀察，提醒在權限收斂時將文件詳情 / 審計頁納入存取範圍控制。
- **證據**：
  ```tsx
  const userName = log.performedBy?.name || log.performedBy?.email || t('detail.audit.system')
  ```
- **建議**：確認文件詳情頁 / 審計查詢有適當 RBAC 與城市範圍限制（API 端審查範圍）。前端無需改動。

---

### [Info] F-06 ExchangeRateImportDialog 以 JSON.parse 解析使用者貼上 / 上傳的內容

- **檔案**：src/components/features/exchange-rate/ExchangeRateImportDialog.tsx:135,192；handleFileUpload:162-171
- **類別**：C、K
- **描述**：客戶端以 `JSON.parse` 解析使用者提供的 JSON（貼上文字或上傳 .json 經 FileReader 讀取），再將 `items` 透過 mutation 傳給後端匯入 API。客戶端解析本身安全（`JSON.parse` 不會原型污染），預覽只取前 10 筆。實際驗證與寫入應由後端 API 把關（含原型污染 / 數值範圍 / 重複鍵），屬 API 端審查範圍。前端未限制上傳檔案大小，超大 JSON 可能造成瀏覽器端記憶體壓力（僅影響操作者自身，影響有限）。
- **證據**：
  ```ts
  const data = JSON.parse(jsonText)
  const items = data.items || data
  const importResult = await importMutation.mutateAsync({ items, options })
  ```
- **建議**：後端 `/api/.../exchange-rates/import` 必須對 `items` 做 Zod 結構與長度上限驗證（交叉確認）；前端可選擇性加上傳大小上限。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 0 | 3 | 3 |

## 4. 區域整體觀察

- **本批整體安全衛生良好**：71 個檔案全為前端展示 / 表單組件，普遍正確使用 next-intl、React Query、React Hook Form + Zod（客戶端表單驗證如 ExchangeRateForm、FieldDefinitionSetForm 皆有 Zod schema），所有使用者內容均以 React 文字節點渲染。
- **零高危模式命中**：全批未出現 `dangerouslySetInnerHTML`、客戶端 import prisma / 伺服器模組、把 token/密碼存 localStorage 的自有程式碼、硬編碼 secret / 內部主機名。
- **系統性可改善點 1（連結 scheme 驗證）**：DocumentSourceDetails 與 DocumentDetailHeader 將伺服器提供的 URL 直接放入 `href` / 程式化點擊，缺 scheme 白名單（F-03、F-04）。建議建立共用的 `safeHref()` 工具集中處理。
- **系統性可改善點 2（外部資源載入）**：PDF 預覽 worker 由公開 CDN unpkg.com 載入（F-01，且 scope 外的 review/PdfViewer 連協定都省略），建議自託管並搭配 CSP `worker-src` / `script-src` 收斂——本專案 next.config 與 middleware 目前未設定 Content-Security-Policy（grep 無命中），補上 CSP 可一併緩解 F-01～F-04 的前端注入 / 供應鏈面。
- **交叉確認交棒（API 端）**：SwaggerUI 的 `/api/openapi` 存取控制（F-02）、audit logs RBAC（F-05，已確認該 route 有 `auth()`）、匯率 import 的後端 Zod 驗證（F-06）需由 API 範圍 agent 確認。
- **依賴版本**：react-pdf ^9.2.1 / pdfjs-dist ^4.10.38（已知刻意降級以避開 v5 ESM 問題，見 FIX-026），swagger-ui-react ^5.31.0，react-syntax-highlighter ^16.1.0；本批未發現直接因版本造成的高危問題。
