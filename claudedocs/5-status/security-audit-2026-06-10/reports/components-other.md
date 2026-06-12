# 安全審查報告 — Components（features 以外）

> 審查日期：2026-06-10 | Scope：components-other.txt（72 檔案 / 12,273 行） | Agent：components-other 審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/components/admin/performance/index.ts | 7 | ✅ |
| 2 | src/components/admin/performance/PerformanceDashboard.tsx | 620 | ✅ |
| 3 | src/components/analytics/CityComparison.tsx | 583 | ✅ |
| 4 | src/components/analytics/index.ts | 7 | ✅ |
| 5 | src/components/audit/AuditQueryForm.tsx | 322 | ✅ |
| 6 | src/components/audit/AuditResultTable.tsx | 346 | ✅ |
| 7 | src/components/audit/DocumentTraceView.tsx | 487 | ✅ |
| 8 | src/components/audit/index.ts | 13 | ✅ |
| 9 | src/components/auth/CityRestricted.tsx | 206 | ✅ |
| 10 | src/components/dashboard/AccessDeniedAlert.tsx | 68 | ✅ |
| 11 | src/components/dashboard/ControlledDateRangePicker.tsx | 245 | ✅ |
| 12 | src/components/dashboard/DashboardFilters.tsx | 263 | ✅ |
| 13 | src/components/dashboard/DashboardStats.tsx | 256 | ✅ |
| 14 | src/components/dashboard/DashboardStatsWithDateRange.tsx | 86 | ✅ |
| 15 | src/components/dashboard/DateRangePicker.tsx | 186 | ✅ |
| 16 | src/components/dashboard/DateRangeQuickSelect.tsx | 198 | ✅ |
| 17 | src/components/dashboard/ForwarderComparisonChart.tsx | 321 | ✅ |
| 18 | src/components/dashboard/ForwarderMultiSelect.tsx | 335 | ✅ |
| 19 | src/components/dashboard/StatCard.tsx | 175 | ✅ |
| 20 | src/components/export/index.ts | 7 | ✅ |
| 21 | src/components/export/MultiCityExportDialog.tsx | 413 | ✅ |
| 22 | src/components/filters/CityFilter.tsx | 525 | ✅ |
| 23 | src/components/filters/CityMultiSelect.tsx | 518 | ✅ |
| 24 | src/components/filters/index.ts | 8 | ✅ |
| 25 | src/components/layout/CityIndicator.tsx | 259 | ✅ |
| 26 | src/components/layout/DashboardHeader.tsx | 80 | ✅ |
| 27 | src/components/layout/DashboardLayout.tsx | 149 | ✅ |
| 28 | src/components/layout/SessionGuard.tsx | 102 | ✅ |
| 29 | src/components/layout/Sidebar.tsx | 310 | ✅ |
| 30 | src/components/layout/TopBar.tsx | 342 | ✅ |
| 31 | src/components/reports/AiCostReportContent.tsx | 530 | ✅ |
| 32 | src/components/reports/CityComparisonTable.tsx | 303 | ✅ |
| 33 | src/components/reports/CityCostReportContent.tsx | 420 | ✅ |
| 34 | src/components/reports/CityDetailPanel.tsx | 236 | ✅ |
| 35 | src/components/reports/ExportDialog.tsx | 334 | ✅ |
| 36 | src/components/reports/index.ts | 7 | ✅ |
| 37 | src/components/reports/MonthlyReportDialog.tsx | 231 | ✅ |
| 38 | src/components/reports/RegionalReportContent.tsx | 202 | ✅ |
| 39 | src/components/ui/accordion.tsx | 58 | ✅ |
| 40 | src/components/ui/alert.tsx | 59 | ✅ |
| 41 | src/components/ui/alert-dialog.tsx | 141 | ✅ |
| 42 | src/components/ui/avatar.tsx | 50 | ✅ |
| 43 | src/components/ui/badge.tsx | 46 | ✅ |
| 44 | src/components/ui/button.tsx | 56 | ✅ |
| 45 | src/components/ui/calendar.tsx | 79 | ✅ |
| 46 | src/components/ui/card.tsx | 79 | ✅ |
| 47 | src/components/ui/checkbox.tsx | 30 | ✅ |
| 48 | src/components/ui/collapsible.tsx | 11 | ✅ |
| 49 | src/components/ui/command.tsx | 155 | ✅ |
| 50 | src/components/ui/dialog.tsx | 122 | ✅ |
| 51 | src/components/ui/dropdown-menu.tsx | 201 | ✅ |
| 52 | src/components/ui/form.tsx | 178 | ✅ |
| 53 | src/components/ui/input.tsx | 22 | ✅ |
| 54 | src/components/ui/label.tsx | 26 | ✅ |
| 55 | src/components/ui/month-picker.tsx | 222 | ✅ |
| 56 | src/components/ui/pagination.tsx | 127 | ✅ |
| 57 | src/components/ui/popover.tsx | 33 | ✅ |
| 58 | src/components/ui/progress.tsx | 28 | ✅ |
| 59 | src/components/ui/radio-group.tsx | 44 | ✅ |
| 60 | src/components/ui/resizable.tsx | 70 | ✅ |
| 61 | src/components/ui/scroll-area.tsx | 48 | ✅ |
| 62 | src/components/ui/select.tsx | 160 | ✅ |
| 63 | src/components/ui/separator.tsx | 31 | ✅ |
| 64 | src/components/ui/skeleton.tsx | 15 | ✅ |
| 65 | src/components/ui/slider.tsx | 63 | ✅ |
| 66 | src/components/ui/switch.tsx | 29 | ✅ |
| 67 | src/components/ui/table.tsx | 117 | ✅ |
| 68 | src/components/ui/tabs.tsx | 55 | ✅ |
| 69 | src/components/ui/textarea.tsx | 22 | ✅ |
| 70 | src/components/ui/toast.tsx | 129 | ✅ |
| 71 | src/components/ui/toaster.tsx | 35 | ✅ |
| 72 | src/components/ui/tooltip.tsx | 32 | ✅ |

## 2. 發現

### [Low] CO-01 DocumentTraceView 將 API 回傳的 URL 直接放入 iframe src / img src / a href，未驗證 scheme
- **檔案**：src/components/audit/DocumentTraceView.tsx:451、458、467、476
- **類別**：F（XSS 與前端）
- **描述**：原始文件預覽對話框直接以 `traceChain.source.url` 渲染 `<iframe src>`、`<img src>` 與兩個 `<a href>`（其中一個 `target="_blank"`，已正確帶 `rel="noopener noreferrer"`）。前端完全信任此 URL，未驗證 scheme 必須為 http(s)。若該值被污染為 `javascript:` URI，點擊「新視窗 / 下載」連結會在頁面 origin 執行腳本。已交叉確認後端來源為 `src/services/traceability.service.ts:149` 的 `generateSignedUrl(document.filePath, expiresAt)`（自家 Blob 預簽名 URL），正常情況下恆為 https，因此利用需先污染後端資料 → 屬縱深防禦缺層。
- **證據**：
  ```tsx
  {traceChain.source.fileType.includes('pdf') ? (
    <iframe src={traceChain.source.url} className="w-full h-full" title="原始文件" />
  ) : (
    <img src={traceChain.source.url} ... />
  )}
  ...
  <a href={traceChain.source.url} target="_blank" rel="noopener noreferrer">
  ```
- **建議**：渲染前以 `new URL(url)` 驗證 `protocol` 屬於 `https:`（或開發環境 `http:`）白名單，不符則不渲染連結。

### [Low] CO-02 MultiCityExportDialog 以簡陋方式解析 Content-Disposition 檔名並直接用於下載
- **檔案**：src/components/export/MultiCityExportDialog.tsx:196-205
- **類別**：H（檔案處理）
- **描述**：用 `contentDisposition?.split('filename=')[1]?.replace(/"/g, '')` 取得伺服器回傳檔名並設定為 `a.download`。解析未處理 `filename*=`、分號後綴參數或特殊字元；若回應頭被中間層注入或後端拼接使用者輸入產生檔名，可能得到誤導性下載檔名（如偽裝副檔名）。瀏覽器對 `download` 屬性會剝離路徑分隔符，無法 path traversal，故風險低。
- **證據**：
  ```ts
  const contentDisposition = response.headers.get('Content-Disposition')
  const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || `multi-city-report-${Date.now()}`
  ```
- **建議**：在前端對解析出的檔名做白名單清洗（僅允許 `[\w.\-]`），或忽略伺服器檔名一律使用本地產生的固定格式檔名（如 ExportDialog.tsx 的做法）。

### [Info] CO-03 多個組件將 API 錯誤訊息原文直接顯示給使用者
- **檔案**：src/components/audit/DocumentTraceView.tsx:87、97；src/components/export/MultiCityExportDialog.tsx:191、216；src/components/reports/ExportDialog.tsx:131、171；src/components/reports/CityDetailPanel.tsx:88；src/components/reports/RegionalReportContent.tsx:128、140；src/components/dashboard/DashboardStats.tsx:127；src/components/reports/CityCostReportContent.tsx:250
- **類別**：J（資訊洩漏）
- **描述**：共通 pattern：`throw new Error(error.error || error.detail || ...)` 後直接渲染 `error.message` 到 Alert / Toast。若後端錯誤回應含內部細節（stack、SQL 訊息、內部路徑），會原樣呈現給終端使用者。實際洩漏程度取決於各 API 的錯誤格式（RFC 7807 detail 欄位一般為安全文案）。
- **建議**：前端統一將非預期錯誤映射為通用文案，僅在已知錯誤代碼時顯示 detail。

### [Info] CO-04 城市權限控制為純客戶端 UI gating，實際 enforcement 依賴 API 層
- **檔案**：src/components/auth/CityRestricted.tsx:129-161；src/components/filters/CityFilter.tsx:198-204；src/components/analytics/CityComparison.tsx:436-472；src/components/export/MultiCityExportDialog.tsx:147-170
- **類別**：A（認證與授權）
- **描述**：`CityRestricted` / `CityFilter` / `CityComparison` / `MultiCityExportDialog` 均以 `useUserCity()` 在客戶端決定可見性與可選城市；URL 參數（`?cities=`）與請求 body 的 `cityCodes` 可被使用者任意改寫後直接送往 API。此為正常前端模式，但意味著 `/api/analytics/city-comparison`、`/api/exports/multi-city`、`/api/cities/accessible` 等端點**必須**在伺服器端重新驗證城市範圍。已抽查 `/api/cities/accessible`（route.ts:63）與 `/api/analytics/city-comparison`（route.ts:177）均有 `auth()` session 檢查；城市範圍的伺服器端驗證完整性屬 API 區域審查範圍，請該區 agent 確認。
- **建議**：無前端修改需求；列為 API 審查交叉檢核項。

### [Info] CO-05 SessionGuard callbackUrl 構造安全，但下游 LoginForm 的 open redirect 防護需另行確認
- **檔案**：src/components/layout/SessionGuard.tsx:88-92
- **類別**：I（認證機制本身）
- **描述**：`callbackUrl = window.location.pathname + window.location.search` 為站內相對路徑，本檔案自身無 open redirect 風險。但註釋表明 `LoginForm 使用 next/navigation 的 router.push(callbackUrl)`——若 LoginForm 未驗證 callbackUrl 為相對路徑，攻擊者可構造 `/auth/login?callbackUrl=https://evil.com` 連結造成登入後 open redirect。LoginForm（src/components/features/auth/）不在本 scope，請 features 區 agent 驗證。
- **建議**：LoginForm 端應限制 callbackUrl 以 `/` 開頭且不以 `//` 開頭。

### [Info] CO-06 console.error 殘留（已知系統性缺口的具體位置）
- **檔案**：src/components/audit/AuditQueryForm.tsx:135
- **類別**：E（PII 與日誌）
- **描述**：`console.error('Failed to preview count:', error)` 為 console 直用而非 logger。輸出內容為錯誤物件，未含 PII，僅屬規範缺口（全庫 console.log 約 279 處的其中一處）。
- **建議**：併入既有 console → logger 漸進清理。

### [Info] CO-07 審計追溯頁全量渲染提取欄位與修正前後值
- **檔案**：src/components/audit/DocumentTraceView.tsx:367-374、425-428
- **類別**：E / J
- **描述**：`JSON.stringify(traceChain.extractionResult.fields)` 與修正前後值（`originalValue` / `correctedValue`）原樣顯示。發票提取結果可能含商業敏感資料（金額、客戶名）。此為審計功能的設計用途，且皆以 React 文字節點渲染（自動轉義，無 XSS），僅提醒：該頁面對應 API 的角色授權（限 Auditor / Admin）必須由 API 層保證。
- **建議**：API 審查時確認 `/api/documents/[id]/trace` 有角色 + 城市範圍檢查。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 0 | 2 | 5 |

## 4. 區域整體觀察

1. **整體狀況良好**：本區 72 檔案中無 `dangerouslySetInnerHTML`、無客戶端組件 import prisma / server 模組、無硬編碼 secrets / tenant ID、無 postMessage 使用、無不安全隨機數。`target="_blank"` 連結均正確附帶 `rel="noopener noreferrer"`。
2. **ui/ 目錄（34 檔）為標準 shadcn/ui 生成組件**：純展示層、無資料存取與外部呼叫，逐檔審查未發現任何安全問題。
3. **系統性模式 A — 客戶端權限 gating**：城市資料隔離（Epic 6）在此區全部以 `useUserCity()` 做 UI 層過濾，安全性完全依賴對應 API 的伺服器端驗證；本區抽查的 2 個 API 均有 `auth()`，但完整的城市範圍 enforcement 驗證須由 API 區審查收口（CO-04）。
4. **系統性模式 B — 錯誤訊息透傳**：約 8 個組件把 API 錯誤訊息原樣顯示到 UI（CO-03），實際風險取決於後端錯誤格式紀律（RFC 7807 detail）。
5. **系統性模式 C — 信任伺服器回傳值**：URL（CO-01）與下載檔名（CO-02）直接採用 API 回傳值而無前端驗證，屬縱深防禦缺層而非可直接利用的漏洞。
6. 本區大量硬編碼中文 UI 字串（i18n 未遷移），依協議不在本次範圍，未列入發現。
