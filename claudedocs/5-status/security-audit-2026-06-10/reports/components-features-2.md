# 安全審查報告 — components/features 第 3/5 批（formats / forwarders / global / historical-data / history / locale / mapping-config / outlook / pipeline-config / prompt-config 前段）

> 審查日期：2026-06-10 | Scope：components-features-2.txt（70 檔案 / 共 19,808 行） | Agent：components-features-2

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/components/features/formats/FormatTermsTable.tsx | 182 | ✅ |
| 2 | src/components/features/formats/IdentificationRulesEditor.tsx | 251 | ✅ |
| 3 | src/components/features/formats/index.ts | 43 | ✅ |
| 4 | src/components/features/formats/KeywordTagInput.tsx | 111 | ✅ |
| 5 | src/components/features/formats/LinkedMappingConfig.tsx | 176 | ✅ |
| 6 | src/components/features/formats/LinkedPromptConfig.tsx | 177 | ✅ |
| 7 | src/components/features/formats/LogoPatternEditor.tsx | 127 | ✅ |
| 8 | src/components/features/formats/SourceFieldCombobox.tsx | 441 | ✅ |
| 9 | src/components/features/forwarders/ForwarderActions.tsx | 472 | ✅ |
| 10 | src/components/features/forwarders/ForwarderDetailView.tsx | 261 | ✅ |
| 11 | src/components/features/forwarders/ForwarderFilters.tsx | 183 | ✅ |
| 12 | src/components/features/forwarders/ForwarderForm.tsx | 438 | ✅ |
| 13 | src/components/features/forwarders/ForwarderInfo.tsx | 199 | ✅ |
| 14 | src/components/features/forwarders/ForwarderList.tsx | 217 | ✅ |
| 15 | src/components/features/forwarders/ForwarderRulesTable.tsx | 323 | ✅ |
| 16 | src/components/features/forwarders/ForwarderStatsPanel.tsx | 212 | ✅ |
| 17 | src/components/features/forwarders/ForwarderTable.tsx | 347 | ✅ |
| 18 | src/components/features/forwarders/ForwarderTableSkeleton.tsx | 123 | ✅ |
| 19 | src/components/features/forwarders/index.ts | 46 | ✅ |
| 20 | src/components/features/forwarders/LogoUploader.tsx | 256 | ✅ |
| 21 | src/components/features/forwarders/RecentDocumentsTable.tsx | 197 | ✅ |
| 22 | src/components/features/global/CityRankings.tsx | 318 | ✅ |
| 23 | src/components/features/global/GlobalStats.tsx | 221 | ✅ |
| 24 | src/components/features/global/GlobalTrend.tsx | 276 | ✅ |
| 25 | src/components/features/global/index.ts | 16 | ✅ |
| 26 | src/components/features/global/RegionView.tsx | 386 | ✅ |
| 27 | src/components/features/historical-data/BatchErrorList.tsx | 554 | ✅ |
| 28 | src/components/features/historical-data/BatchFileUploader.tsx | 377 | ✅ |
| 29 | src/components/features/historical-data/BatchProgressPanel.tsx | 444 | ✅ |
| 30 | src/components/features/historical-data/BatchSummaryCard.tsx | 409 | ✅ |
| 31 | src/components/features/historical-data/CreateBatchDialog.tsx | 648 | ✅ |
| 32 | src/components/features/historical-data/file-detail/ExtractionResultPanel.tsx | 194 | ✅ |
| 33 | src/components/features/historical-data/file-detail/FileInfoCard.tsx | 141 | ✅ |
| 34 | src/components/features/historical-data/file-detail/index.ts | 22 | ✅ |
| 35 | src/components/features/historical-data/file-detail/IssuerIdentificationPanel.tsx | 206 | ✅ |
| 36 | src/components/features/historical-data/file-detail/LineItemsTable.tsx | 219 | ✅ |
| 37 | src/components/features/historical-data/file-detail/ProcessingTimeline.tsx | 200 | ✅ |
| 38 | src/components/features/historical-data/file-detail/RawJsonViewer.tsx | 194 | ✅ |
| 39 | src/components/features/historical-data/HierarchicalTermsExportButton.tsx | 226 | ✅ |
| 40 | src/components/features/historical-data/HistoricalBatchList.tsx | 344 | ✅ |
| 41 | src/components/features/historical-data/HistoricalFileList.tsx | 585 | ✅ |
| 42 | src/components/features/historical-data/index.ts | 27 | ✅ |
| 43 | src/components/features/historical-data/ProcessingConfirmDialog.tsx | 323 | ✅ |
| 44 | src/components/features/historical-data/TermAggregationSummary.tsx | 679 | ✅ |
| 45 | src/components/features/history/ChangeHistoryTimeline.tsx | 434 | ✅ |
| 46 | src/components/features/history/HistoryVersionCompareDialog.tsx | 398 | ✅ |
| 47 | src/components/features/history/index.ts | 13 | ✅ |
| 48 | src/components/features/locale/LocaleSwitcher.tsx | 153 | ✅ |
| 49 | src/components/features/mapping-config/ConfigSelector.tsx | 268 | ✅ |
| 50 | src/components/features/mapping-config/index.ts | 68 | ✅ |
| 51 | src/components/features/mapping-config/MappingConfigPanel.tsx | 617 | ✅ |
| 52 | src/components/features/mapping-config/MappingPreview.tsx | 558 | ✅ |
| 53 | src/components/features/mapping-config/MappingRuleList.tsx | 219 | ✅ |
| 54 | src/components/features/mapping-config/RuleEditor.tsx | 455 | ✅ |
| 55 | src/components/features/mapping-config/SortableRuleItem.tsx | 288 | ✅ |
| 56 | src/components/features/mapping-config/SourceFieldSelector.tsx | 388 | ✅ |
| 57 | src/components/features/mapping-config/TargetFieldSelector.tsx | 368 | ✅ |
| 58 | src/components/features/mapping-config/TransformConfigPanel.tsx | 539 | ✅ |
| 59 | src/components/features/outlook/index.ts | 10 | ✅ |
| 60 | src/components/features/outlook/OutlookConfigForm.tsx | 474 | ✅ |
| 61 | src/components/features/outlook/OutlookConfigList.tsx | 380 | ✅ |
| 62 | src/components/features/outlook/OutlookFilterRulesEditor.tsx | 671 | ✅ |
| 63 | src/components/features/pipeline-config/index.ts | 18 | ✅ |
| 64 | src/components/features/pipeline-config/PipelineConfigFilters.tsx | 150 | ✅ |
| 65 | src/components/features/pipeline-config/PipelineConfigForm.tsx | 797 | ✅ |
| 66 | src/components/features/pipeline-config/PipelineConfigList.tsx | 326 | ✅ |
| 67 | src/components/features/pipeline-config/PipelineConfigScopeBadge.tsx | 59 | ✅ |
| 68 | src/components/features/prompt-config/CollapsibleControls.tsx | 83 | ✅ |
| 69 | src/components/features/prompt-config/CollapsiblePromptGroup.tsx | 246 | ✅ |
| 70 | src/components/features/prompt-config/index.ts | 37 | ✅ |

## 2. 發現

### [Medium] CF2-01 Outlook 過濾規則允許任意 REGEX，後端以 `new RegExp(ruleValue)` 直接執行（ReDoS 面）
- **檔案**：src/components/features/outlook/OutlookFilterRulesEditor.tsx:118-125（輸入面）；src/services/outlook-config.service.ts:741、src/services/outlook-document.service.ts:595（執行點，交叉確認）
- **類別**：B / K
- **描述**：規則表單的 Zod schema 對 `ruleValue` 僅驗證 `min(1)`，當 `ruleType = SUBJECT_REGEX` 或 `operator = REGEX` 時不做任何正則語法 / 複雜度檢查。後端在郵件擷取流程對每封進站郵件主旨直接 `new RegExp(ruleValue, 'i')` 編譯並執行使用者輸入的 pattern。具災難性回溯（catastrophic backtracking）的 pattern（如 `(a+)+$`）會使 Outlook 擷取管線在每封郵件上消耗指數級 CPU，造成文件自動獲取功能 DoS。利用需要 Outlook 配置管理權限，故評為 Medium 而非 High。
- **證據**：
  ```ts
  // OutlookFilterRulesEditor.tsx:118-125
  const ruleFormSchema = z.object({
    ...
    operator: z.enum(['EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX']),
    ruleValue: z.string().min(1, '匹配值不能為空'),
  ```
  ```ts
  // outlook-config.service.ts:741
  const regex = new RegExp(ruleValue, 'i');
  ```
- **建議**：前端與後端雙重驗證——(1) 提交前 `try { new RegExp(value) } catch` 驗證語法；(2) 後端限制 pattern 長度（如 ≤ 200 字元）並考慮以 RE2 類安全引擎或加上匹配超時保護；(3) 對非 REGEX operator 的規則禁止傳入 regex 元字符組合。

### [Medium] CF2-02 Logo 上傳允許 SVG（image/svg+xml），存儲型 XSS 載體風險
- **檔案**：src/components/features/forwarders/LogoUploader.tsx:120-132
- **類別**：H / F
- **描述**：上傳組件 accept 清單包含 `image/svg+xml`。SVG 可內嵌 `<script>` 與事件處理器。組件本身以 `next/image`（`<img>`）渲染預覽，script 不會執行；但若伺服器端原樣存入 Blob Storage 並以 `Content-Type: image/svg+xml`、inline disposition 提供下載，任何能直接開啟該 UR