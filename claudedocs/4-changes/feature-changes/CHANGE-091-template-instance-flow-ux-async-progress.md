# CHANGE-091: 模板實例流程優化（狀態/進度回饋 + 文件選取體驗 + export 放寬）

> **日期**: 2026-06-24
> **狀態**: 🚧 Phase 1 已完成（2026-06-26）／Phase 2 待實作
> **優先級**: High（使用者測試後主動反饋的可用性問題）
> **類型**: UI Enhancement + Feature（含一處同步→非同步架構調整）
> **影響範圍**: 模板實例（Template Instance, Epic 19）詳情頁 / 加入文件對話框 / 行表格 / 自動匹配服務 / 匹配 API / 進度查詢 / i18n
> **Epic 範圍**: Epic 19（資料模板匹配與匯出）
>
> **使用者已拍板決策（2026-06-24，經 AskUserQuestion 確認）**：
> - 進度回饋 = **完整版（非同步背景處理 + 即時進度條）**
> - export 限制 = **放寬（允許重複 export）**
> - 主要痛點 = **沒有處理進度/狀態回饋** + **文件選取體驗差**
>
> **OQ-A 已決議（2026-06-24，使用者拍板）**：Phase 2 非同步機制 = **A1（背景處理 + SSE 即時推送，複用既有 SSE pattern）**

---

## 變更背景

使用者在本地測試 template instance 功能後反饋「流程不友好且有問題」。經完整調查（前端 `TemplateInstanceDetail` / `AddFileDialog` / `InstanceRowsTable`、後端 `auto-template-matching.service` / 匹配 API / export API），確認使用者期望的理想流程（新建 → 選 template → 加文件 → 自動處理 → export）**大部分功能已實作**，但存在以下實際缺陷：

### 確認的問題點

| # | 問題 | 根源（檔案:行號） |
|---|------|------------------|
| 1 | **export 一次後就鎖死** | `TemplateInstanceDetail.tsx:116` `canExport = instance.status === 'COMPLETED'`；export 後狀態 → `EXPORTED`，按鈕 disabled。**但後端 `export/route.ts:104` 本就允許 `COMPLETED` 與 `EXPORTED`** → 純前端鎖死、前後端不一致 |
| 2 | **詳情頁無狀態顯示** | `TemplateInstanceDetail.tsx` header 完全沒有 status 徽章，使用者不知道目前是 DRAFT/COMPLETED/EXPORTED，也不知為何有時不能 export（實為卡在 DRAFT） |
| 3 | **狀態轉換不透明** | `auto-template-matching.service.ts:707 tryAutoComplete` — 所有列驗證通過才 DRAFT→COMPLETED；只要有 1 列 invalid 就留在 DRAFT，使用者無從得知原因 |
| 4 | **加文件後無進度回饋** | `batchMatch`（`auto-template-matching.service.ts:472`）為**同步處理**（API request 期間完成，最多 500 文件），UI 僅一個轉圈；大量文件時長時間無回饋、易誤判卡死 |
| 5 | **文件選取無法區分已加入** | `AddFileDialog.tsx:99` 載入**全部**文件（`GET /api/documents?pageSize=50`），不過濾已加入此 instance 者 → 易重複加入 |
| 6 | **無全選** | `AddFileDialog.tsx` 僅單個 checkbox，無「全選/取消全選」 |
| 7 | **看不到每列資料來源** | `TemplateInstanceRow.sourceDocumentIds` 已存來源文件，但 `InstanceRowsTable` 未顯示，使用者無法追溯某列來自哪個文件 |

---

## 變更內容

### Phase 1 — 狀態/選取體驗強化（低風險、快速見效）

#### 1.1 export 放寬（前後端一致）
`TemplateInstanceDetail.tsx` 的 `canExport` 改為 `['COMPLETED', 'EXPORTED'].includes(instance.status)`，與後端 export API 既有判定一致。允許重複 export（換格式、補匯）。

#### 1.2 詳情頁狀態徽章 + 卡 DRAFT 原因提示
header 新增 status 徽章（沿用既有 `TemplateInstanceCard` 的狀態徽章樣式/i18n）。當狀態為 DRAFT 且 `errorRowCount > 0` 時，於 export 按鈕旁顯示提示：「有 N 列驗證未通過，需修正後才能匯出」，消除「為何不能 export」的困惑。

#### 1.3 加文件完成回饋強化
`AddFileDialog` 提交完成後，toast/區塊明確顯示「成功加入 N 列，X 列待檢查；目前狀態：可匯出 / 待修正」，銜接 1.2 的狀態語意。

#### 1.4 文件選取：全選 / 取消全選
`AddFileDialog` 文件清單上方加「全選 / 取消全選」按鈕（僅作用於目前載入清單，沿用 `ExportFieldSelector` 既有 selectAll/deselectAll 樣式）。

#### 1.5 文件選取：標示/過濾「已加入此 instance」
載入文件時取得各文件的 `templateInstanceId`，對「已加入本 instance」者：預設**標示**（灰階 + 「已加入」徽章）並可選擇隱藏。需 `GET /api/documents` 回傳 `templateInstanceId` 欄位，或新增查詢參數（見技術設計）。

#### 1.6 行表格顯示來源文件
`InstanceRowsTable` 新增「來源文件」欄/展開，顯示 `sourceDocumentIds` 對應的檔名（需補一支以 id 批量取檔名的查詢，或在 rows API 一併回傳）。

### Phase 2 — 非同步背景處理 + 即時進度（核心、較大）

#### 2.1 匹配改非同步 + 進度持久化
將 `batchMatch` 由「同步處理完才回應」改為「立即回應 + 背景處理 + 進度可查」。進度（processed / total / percentage / 目前列統計）持久化，供查詢端點讀取。

#### 2.2 即時進度回饋（複用既有 SSE pattern）
複用專案既有進度基礎設施（`batch-progress.service` + SSE 端點 + `use-batch-progress` hook 的模式），讓 `AddFileDialog`（或詳情頁）顯示「處理中 12/50（24%）」即時進度條，完成後自動刷新行表格與狀態。

---

## 技術設計

### 修改範圍

| 文件 | 類型 | 變更內容 | Phase |
|------|------|----------|-------|
| `src/components/features/template-instance/TemplateInstanceDetail.tsx` | 🔧 修改 | export 條件放寬、狀態徽章、卡 DRAFT 提示、（P2）接進度狀態刷新 | 1+2 |
| `src/components/features/template-instance/AddFileDialog.tsx` | 🔧 修改 | 全選、標示已加入、完成回饋、（P2）進度條 + 非同步提交流程 | 1+2 |
| `src/components/features/template-instance/InstanceRowsTable.tsx` | 🔧 修改 | 顯示來源文件檔名 | 1 |
| `src/services/auto-template-matching.service.ts` | 🔧 修改 | （P2）`batchMatch` 非同步化 + 進度持久化；`tryAutoComplete` 提示資料 | 2 |
| `src/app/api/v1/documents/match/route.ts` | 🔧 修改 | （P2）改為觸發背景匹配 + 立即回應 jobId/instanceId | 2 |
| `src/app/api/documents/route.ts` | 🔧 修改 | 回傳/可篩 `templateInstanceId`（支援 1.5 標示已加入） | 1 |
| `src/app/api/v1/template-instances/[id]/rows/route.ts` | 🔧 修改 | （視 1.6 實作）一併回傳來源檔名 | 1 |
| `src/app/api/v1/template-instances/[id]/match-progress/` 或複用既有 | 🆕 新增 | （P2）進度查詢/SSE 端點 | 2 |
| `src/hooks/`（新增或複用 `use-batch-progress`） | 🆕/🔧 | （P2）進度訂閱 hook | 2 |
| `prisma/schema.prisma` `TemplateInstance` | 🔧 修改 | （P2，視方案）新增進度欄位（如 `matchStatus` / `matchProgress` JSON）— 純加 nullable 欄位，向後相容 | 2 |
| `messages/{en,zh-TW,zh-CN}/templateInstance.json` | 🔧 修改 | 狀態徽章、卡 DRAFT 提示、全選、已加入、來源文件、進度文案 | 1+2 |

### 既有可複用資產（避免重造 / 避免 H2 引入新 vendor）

| 資產 | 位置 | 複用於 |
|------|------|--------|
| SSE 進度端點 pattern | `src/app/api/admin/historical-data/batches/[batchId]/progress/route.ts` | Phase 2 進度推送 |
| 進度服務 | `src/services/batch-progress.service.ts` | Phase 2 進度讀寫 |
| 前端進度 hook | `src/hooks/use-batch-progress.ts` | Phase 2 前端訂閱 |
| 狀態徽章樣式 + i18n | `TemplateInstanceCard.tsx` | Phase 1 詳情頁徽章 |
| 全選/取消全選 UI | `ExportFieldSelector.tsx` | Phase 1 文件全選 |

### i18n 影響

| 語言 | 文件 | 需要新增的 Key（前綴 `templateInstance.`） |
|------|------|---------------------------------------------|
| en | `messages/en/templateInstance.json` | `detail.status.*`（draft/completed/exported）、`detail.cannotExportHint`、`addFileDialog.selectAll`/`deselectAll`/`alreadyAdded`、`addFileDialog.progress`、`rows.sourceDocuments`、`toast.addFileResult` |
| zh-TW | `messages/zh-TW/templateInstance.json` | 同上 |
| zh-CN | `messages/zh-CN/templateInstance.json` | 同上 |

> 完成後執行 `npm run i18n:check` 驗證三語言同步。

### 資料庫影響

- **Phase 1**：無 schema 變更（`sourceDocumentIds`、`status`、`errorRowCount` 皆已存在）。
- **Phase 2**：視所選方案，可能於 `TemplateInstance` **新增 nullable 進度欄位**（如 `matchProgress Json?`）。純加 nullable 欄位、向後相容，**不觸發 H1**（不改既有 122 model 核心欄位/關聯語意）。需 migration + dry-run 驗證。

---

## 設計決策

### OQ-A（✅ 已決議 = A1，2026-06-24 使用者拍板）— 非同步處理機制的具體實作

完整版非同步進度需要「背景執行 + 進度查詢」。本專案為長運行 Node server（非 serverless 函式），有既有 SSE 進度 pattern 可複用。三個候選：

| 選項 | 做法 | 優點 | 缺點 / 風險 | 觸發 H1？ |
|------|------|------|-------------|-----------|
| **A1（推薦）背景非阻塞 + SSE** | `POST /match` 立即回應，背景非阻塞跑 `batchMatch`（進度寫 DB），前端用 SSE（複用既有 pattern）顯示即時進度 | 體驗最佳、與既有歷史批次進度一致 | 背景任務若 server 重啟會中斷（需「可重跑/續跑」或標記 FAILED）；複雜度較高 | 否（複用既有機制、僅加 nullable 欄位） |
| **A2 背景非阻塞 + 輪詢** | 同 A1，但前端改用簡單 polling（GET 進度），不用 SSE | 實作較簡單、不需維持長連線 | 進度更新間隔較粗（如 1-2 秒一次） | 否 |
| **A3 前端分塊驅動** | `POST /match` 改成處理單一 chunk + 回進度，前端迴圈呼叫直到完成 | 不需背景 worker、最單純 | 前端頁面須保持開啟；關頁即中斷 | 否 |

**決議：採 A1**（2026-06-24 使用者拍板）。複用既有 SSE 進度基礎設施，體驗與歷史批次一致；以「進度持久化 + 完成/失敗狀態落地」緩解中斷風險。

### 其他設計決策

1. **export 放寬只改前端**：後端 `export/route.ts` 本就允許 `EXPORTED`，故 1.1 僅改前端 `canExport`，零後端風險。
2. **狀態徽章複用既有樣式**：沿用 `TemplateInstanceCard` 既有狀態徽章與 i18n，維持一致性（符合 §1.3 Surgical Changes）。
3. **「已加入」採標示而非硬過濾**：預設標示 + 可隱藏，保留使用者覆寫彈性，避免「文件不見了」的困惑。

---

## 影響範圍評估

### 向後兼容性

- export 放寬：放寬限制，不影響既有可 export 的情境。
- 狀態徽章 / 全選 / 來源顯示：純 UI 增益，不改既有資料流。
- 非同步化（Phase 2）：`POST /match` 回應語意由「同步結果」改為「已接受 + 進度可查」，**屬 API 行為調整**，需同步更新呼叫端（`AddFileDialog`、文件列表批量匹配 `CHANGE-041` 整合點）。需檢查所有 `documents/match` 呼叫端。
- 新增 nullable 進度欄位：向後相容。

### 風險評估（Phase 2）

| 風險 | 緩解 |
|------|------|
| 背景任務 server 重啟中斷 | 進度/狀態持久化；中斷標記 FAILED + 可重跑；或上限以下仍同步、超過才轉背景 |
| `documents/match` 呼叫端行為變更 | 全面 grep 呼叫端，統一改非同步流程 + 進度 UI |
| SSE 連線在反向代理/Azure 環境的相容性 | 既有歷史批次 SSE 已在用（含 `X-Accel-Buffering: no`），沿用同設定 |

### 回滾計劃

- Phase 1 各項獨立、可單獨回退（純前端/查詢增益）。
- Phase 2 若非同步不穩，可回退為同步 `batchMatch`（保留原同步路徑為 fallback，依文件數量門檻切換）。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | export 放寬 | EXPORTED 狀態的 instance 仍可再次 export（按鈕可按、檔案正確產出） | High |
| 2 | 狀態徽章 | 詳情頁 header 顯示正確 status；DRAFT 且有錯誤列時顯示「為何不能 export」提示 | High |
| 3 | 全選 | 加文件對話框可一鍵全選/取消全選目前清單 | High |
| 4 | 標示已加入 | 已加入本 instance 的文件被標示，且可選擇隱藏 | Medium |
| 5 | 來源文件 | 行表格可看到每列來源文件檔名 | Medium |
| 6 | 完成回饋 | 加文件完成後明確顯示成功列數與目前可否 export | High |
| 7 | 即時進度（P2） | 加入大量文件時顯示「處理中 X/Y（Z%）」即時進度，完成後自動刷新 | High |
| 8 | 品質 gate | `npm run type-check` / `lint` / `i18n:check` 全通過 | High |

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 重複 export | 對已 EXPORTED 的 instance 再次 export | 成功產出檔案，不被鎖死 |
| 2 | 卡 DRAFT 提示 | 加入含驗證失敗列的文件 | 狀態顯示 DRAFT + 提示「N 列待修正、暫不能匯出」 |
| 3 | 全選加入 | 開加文件對話框 → 全選 → 加入 | 全部文件加入、進度顯示、完成回饋正確 |
| 4 | 已加入標示 | 對已加入文件再開對話框 | 該文件顯示「已加入」標示 |
| 5 | 大量文件進度（P2） | 加入 100+ 文件 | 顯示即時進度條，過程不卡 UI，完成自動刷新 |
| 6 | 來源追溯 | 詳情頁行表格 | 每列可見來源文件檔名 |

---

## 實施計劃（分階段）

- **Phase 1（先交付）**：1.1～1.6（export 放寬 + 狀態徽章 + 全選 + 已加入標示 + 來源顯示 + 完成回饋 + i18n）。低風險、不動架構。
- **Phase 2（後續）**：2.1～2.2 非同步 + 即時進度（依 OQ-A 拍板方案實作；含 schema 進度欄位 + migration + 呼叫端統一）。

> 建議 Phase 1 完成驗證後再啟動 Phase 2，避免一次改動面過大。

---

## Phase 1 實作結果（2026-06-26）

### 各子項落地

| 子項 | 實作 | 檔案 |
|------|------|------|
| 1.1 export 放寬 | `canExport = ['COMPLETED','EXPORTED'].includes(status)`，與後端一致 | `TemplateInstanceDetail.tsx` |
| 1.2 狀態徽章 + DRAFT 提示 | header 加狀態徽章（複用 `getInstanceStatusConfig`）；DRAFT 且有錯誤列時顯示 `draftExportHint` | `TemplateInstanceDetail.tsx` |
| 1.3 完成回饋強化 | 加文件成功 toast 補 `addFileSuccessHint`（引導至詳情頁查看狀態/可否匯出）| `AddFileDialog.tsx` |
| 1.4 全選 / 取消全選 | 工具列加「全選/取消全選」（僅作用於可選取範圍）| `AddFileDialog.tsx` |
| 1.5 標示已加入 | `getDocuments` 回傳 `templateInstanceId`；對話框標示「已加入」徽章 + 停用 checkbox + 可「隱藏已加入」| `document.service.ts` / `use-documents.ts` / `AddFileDialog.tsx` |
| 1.6 來源文件 | `getRows` 批量解析 `sourceDocumentIds → fileName`，行表格新增「來源文件」欄、詳情抽屜顯示檔名 | `template-instance.service.ts` / `types/template-instance.ts` / `InstanceRowsTable.tsx` / `RowDetailDrawer.tsx` |

### 修改檔案清單

| 文件 | 類型 | Phase 1 子項 |
|------|------|--------------|
| `src/components/features/template-instance/TemplateInstanceDetail.tsx` | 🔧 修改 | 1.1, 1.2 |
| `src/components/features/template-instance/AddFileDialog.tsx` | 🔧 修改 | 1.3, 1.4, 1.5 |
| `src/components/features/template-instance/InstanceRowsTable.tsx` | 🔧 修改 | 1.6 |
| `src/components/features/template-instance/RowDetailDrawer.tsx` | 🔧 修改 | 1.6 |
| `src/services/document.service.ts` | 🔧 修改 | 1.5（select + 型別加 `templateInstanceId`）|
| `src/hooks/use-documents.ts` | 🔧 修改 | 1.5（型別加 `templateInstanceId`）|
| `src/services/template-instance.service.ts` | 🔧 修改 | 1.6（`getRows` 附加 `sourceDocuments`）|
| `src/types/template-instance.ts` | 🔧 修改 | 1.6（`TemplateInstanceRow` 加 `sourceDocuments?`）|
| `messages/{en,zh-TW,zh-CN}/templateInstance.json` | 🔧 修改 | `detail.draftExportHint` / `rows.columns.sourceDocuments` / `addFileDialog.selectAll`/`deselectAll`/`hideAdded`/`alreadyAdded` / `toast.addFileSuccessHint` |

### 設計沿用 / 範圍邊界

- 狀態徽章、行狀態圖示沿用既有 `status-config.ts`（§1.3 Surgical）。
- 1.3：match API 回傳的是「文件匹配成功/失敗數」而非列 valid/invalid 數，故完成回饋採「成功數 + 引導至詳情頁狀態徽章（1.2）」的誠實版本，不虛報列驗證統計。
- 1.5：採「標示 + 可隱藏」而非硬過濾，保留覆寫彈性；僅停用「已加入本實例」者，未限制其他實例文件。
- **不觸發 H1**：無架構改動、無 schema 變更、無 vendor 變更；`getDocuments` 僅多 select 一個既有 scalar 欄位。
- Phase 2（非同步 + SSE + schema 進度欄位）未動，維持原同步 `batchMatch`。

### 驗證

| 項目 | 結果 |
|------|------|
| `npm run type-check` | ✅ 通過 |
| `npm run lint`（改動檔案）| ✅ 0 error；11 warning 全為既有 dead import / deps（非本次引入，依 H3 不順手清）|
| `npm run i18n:check` | ✅ 三語言同步通過 |
