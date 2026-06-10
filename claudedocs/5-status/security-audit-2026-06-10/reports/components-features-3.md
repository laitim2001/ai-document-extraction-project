# 安全審查報告 — components/features 第 4/5 批（prompt-config / reference-number / region / reports / retention / review / rule-review / rules）

> 審查日期：2026-06-10 | Scope：components-features-3.txt | Agent：components-features-3

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/components/features/prompt-config/PromptConfigFilters.tsx | 239 | ✅ |
| 2 | src/components/features/prompt-config/PromptConfigForm.tsx | 465 | ✅ |
| 3 | src/components/features/prompt-config/PromptConfigList.tsx | 277 | ✅ |
| 4 | src/components/features/prompt-config/PromptEditor.tsx | 381 | ✅ |
| 5 | src/components/features/prompt-config/PromptTemplateInserter.tsx | 117 | ✅ |
| 6 | src/components/features/prompt-config/PromptTester.tsx | 263 | ✅ |
| 7 | src/components/features/prompt-config/ShowMoreButton.tsx | 63 | ✅ |
| 8 | src/components/features/prompt-config/TemplatePreviewDialog.tsx | 280 | ✅ |
| 9 | src/components/features/reference-number/index.ts | 15 | ✅ |
| 10 | src/components/features/reference-number/ReferenceNumberDeleteDialog.tsx | 111 | ✅ |
| 11 | src/components/features/reference-number/ReferenceNumberExportButton.tsx | 90 | ✅ |
| 12 | src/components/features/reference-number/ReferenceNumberFilters.tsx | 243 | ✅ |
| 13 | src/components/features/reference-number/ReferenceNumberForm.tsx | 379 | ✅ |
| 14 | src/components/features/reference-number/ReferenceNumberImportDialog.tsx | 785 | ✅ |
| 15 | src/components/features/reference-number/ReferenceNumberList.tsx | 334 | ✅ |
| 16 | src/components/features/reference-number/ReferenceNumberStatusBadge.tsx | 67 | ✅ |
| 17 | src/components/features/reference-number/ReferenceNumberTypeBadge.tsx | 73 | ✅ |
| 18 | src/components/features/region/index.ts | 7 | ✅ |
| 19 | src/components/features/region/RegionSelect.tsx | 166 | ✅ |
| 20 | src/components/features/reports/AiCostCard.tsx | 367 | ✅ |
| 21 | src/components/features/reports/CityCostTable.tsx | 592 | ✅ |
| 22 | src/components/features/reports/CostAnomalyDialog.tsx | 335 | ✅ |
| 23 | src/components/features/reports/index.ts | 8 | ✅ |
| 24 | src/components/features/retention/ArchiveRecordList.tsx | 351 | ✅ |
| 25 | src/components/features/retention/DataRetentionDashboard.tsx | 520 | ✅ |
| 26 | src/components/features/retention/DeletionRequestList.tsx | 444 | ✅ |
| 27 | src/components/features/retention/index.ts | 23 | ✅ |
| 28 | src/components/features/retention/RetentionPolicyList.tsx | 329 | ✅ |
| 29 | src/components/features/retention/StorageMetricsCard.tsx | 343 | ✅ |
| 30 | src/components/features/review/ApprovalConfirmDialog.tsx | 182 | ✅ |
| 31 | src/components/features/review/ConfidenceBadge.tsx | 148 | ✅ |
| 32 | src/components/features/review/ConfidenceIndicator.tsx | 97 | ✅ |
| 33 | src/components/features/review/ConfidenceTooltip.tsx | 129 | ✅ |
| 34 | src/components/features/review/CorrectionTypeDialog.tsx | 434 | ✅ |
| 35 | src/components/features/review/CorrectionTypeSelector.tsx | 168 | ✅ |
| 36 | src/components/features/review/EscalationDialog.tsx | 315 | ✅ |
| 37 | src/components/features/review/index.ts | 86 | ✅ |
| 38 | src/components/features/review/LowConfidenceFilter.tsx | 113 | ✅ |
| 39 | src/components/features/review/PdfViewer/DynamicPdfViewer.tsx | 75 | ✅ |
| 40 | src/components/features/review/PdfViewer/index.ts | 27 | ✅ |
| 41 | src/components/features/review/PdfViewer/PdfHighlightOverlay.tsx | 92 | ✅ |
| 42 | src/components/features/review/PdfViewer/PdfLoadingSkeleton.tsx | 42 | ✅ |
| 43 | src/components/features/review/PdfViewer/PdfToolbar.tsx | 144 | ✅ |
| 44 | src/components/features/review/PdfViewer/PdfViewer.tsx | 187 | ✅ |
| 45 | src/components/features/review/ProcessingPathBadge.tsx | 90 | ✅ |
| 46 | src/components/features/review/ReviewDetailLayout.tsx | 166 | ✅ |
| 47 | src/components/features/review/ReviewFilters.tsx | 269 | ✅ |
| 48 | src/components/features/review/ReviewPanel/FieldEditor.tsx | 276 | ✅ |
| 49 | src/components/features/review/ReviewPanel/FieldGroup.tsx | 108 | ✅ |
| 50 | src/components/features/review/ReviewPanel/FieldRow.tsx | 255 | ✅ |
| 51 | src/components/features/review/ReviewPanel/index.ts | 17 | ✅ |
| 52 | src/components/features/review/ReviewPanel/QuickReviewMode.tsx | 271 | ✅ |
| 53 | src/components/features/review/ReviewPanel/ReviewActions.tsx | 213 | ✅ |
| 54 | src/components/features/review/ReviewPanel/ReviewPanel.tsx | 228 | ✅ |
| 55 | src/components/features/review/ReviewQueue.tsx | 165 | ✅ |
| 56 | src/components/features/review/ReviewQueueSkeleton.tsx | 84 | ✅ |
| 57 | src/components/features/review/ReviewQueueTable.tsx | 127 | ✅ |
| 58 | src/components/features/review/UnsavedChangesGuard.tsx | 310 | ✅ |
| 59 | src/components/features/review/validation/fieldSchemas.ts | 229 | ✅ |
| 60 | src/components/features/review/validation/index.ts | 8 | ✅ |
| 61 | src/components/features/review/validation/ValidationMessage.tsx | 76 | ✅ |
| 62 | src/components/features/rule-review/ApproveDialog.tsx | 169 | ✅ |
| 63 | src/components/features/rule-review/ImpactSummaryCard.tsx | 222 | ✅ |
| 64 | src/components/features/rule-review/index.ts | 12 | ✅ |
| 65 | src/components/features/rule-review/RejectDialog.tsx | 187 | ✅ |
| 66 | src/components/features/rule-review/ReviewDetailPage.tsx | 409 | ✅ |
| 67 | src/components/features/rule-review/SampleCasesTable.tsx | 214 | ✅ |
| 68 | src/components/features/rule-review/SuggestionInfo.tsx | 247 | ✅ |
| 69 | src/components/features/rules/AccuracyMetrics.tsx | 434 | ✅ |
| 70 | src/components/features/rules/BulkRuleActions.tsx | 447 | ✅ |
| 71 | src/components/features/rules/ExtractionTypeIcon.tsx | 168 | ✅ |
| 72 | src/components/features/rules/ImpactStatistics.tsx | 274 | ✅ |

**總計**：72 檔案 / 15,581 行，全數完整讀取。

### 前端重點面向總體結果

| 重點面向 | 結果 |
|----------|------|
| `dangerouslySetInnerHTML` | ❌ 未出現（0 處）。所有使用者/AI 內容渲染均經 React JSX 自動轉義（`<pre>{content}</pre>`、`<code>{...}</code>` 等） |
| 客戶端組件 import prisma / server 模組 | ❌ 未出現。僅 import `@prisma/client` 的 enum/type（`ProcessingPath`、`StorageTier` 等），屬類型/枚舉引用，不會連線資料庫 |
| 未驗證的 URL / href | ⚠️ 1 處風險：PdfViewer worker 從外部 CDN 載入（見 M-1）。其餘 href 均為固定路由路徑或 `URL.createObjectURL` 產生的 blob URL，無 `javascript:` 注入面 |
| postMessage | ❌ 未出現 |
| 敏感資料存 localStorage / sessionStorage | ❌ 未出現 |

---

## 2. 發現

### [Medium] CF3-01 PDF.js worker 從第三方 CDN（unpkg.com）載入 — 供應鏈與隱私風險
- **檔案**：src/components/features/review/PdfViewer/PdfViewer.tsx:30
- **類別**：F / G（前端供應鏈、外部呼叫）
- **描述**：PDF.js worker script 以 protocol-relative URL 從 unpkg.com 動態載入，在審核人員瀏覽器中執行。風險包括：(1) 供應鏈 — unpkg 被入侵或回應被竄改時，惡意 worker 可讀取正在審核的發票 PDF 內容（含商業敏感資料）；worker script 無法使用 SRI 完整性驗證；(2) 隱私 — 每次開啟審核詳情頁都向第三方 CDN 發出請求，洩漏內部系統使用足跡；(3) 可用性 — 企業內網/防火牆封鎖 unpkg 時 PDF 預覽全面失效；(4) 版本浮動 — URL 以 `pdfjs.version` 插值，套件升級時自動切換到未經審查的 CDN 檔案；(5) 若部署 CSP，需為 unpkg 開洞，削弱整體 CSP 防護。本機 dev 以 http 執行時 protocol-relative URL 退化為 http，存在 MITM 注入面。
- **證據**：
  ```ts
  // 設置 PDF.js worker (使用 legacy 版本以兼容 Next.js 15)
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.