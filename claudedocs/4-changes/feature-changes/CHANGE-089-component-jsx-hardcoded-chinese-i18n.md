# CHANGE-089: 全站組件級 JSX 硬編碼中文系統性 i18n 化（86 組件，分批推進）

> **日期**: 2026-06-22
> **狀態**: 🚧 進行中（**Batch A pilot 已完成 ✅** 2026-06-22；Batch B–F 待續）
> **優先級**: 中
> **類型**: Feature（i18n 修正）
> **影響範圍**: `src/components/**/*.tsx` 約 86 個組件的 JSX/屬性/toast 硬編碼中文 + 對應 namespace JSON（3 語言）+ 新增 namespace（註冊 `src/i18n/request.ts`）
> **來源**: 承接 `CHANGE-088` §範圍邊界與後續發現（用戶 2026-06-22 approve 開立並確認範圍邊界與節奏）
> **分支**: `feature/change-089-component-jsx-i18n`（自 `main` 分出，分批 commit）

---

## 變更背景

`CHANGE-088` 已清除「**顯示常量洩漏**」這一最隱蔽的根因類別（6 模組 7 組件，常量直接 render 中文、不在 `i18n:check` 覆蓋）。但 CHANGE-088 §範圍邊界與後續複查（`grep '>…\p{Han}'` 於 `src/components/**.tsx`）確認 item 7「EN 介面顯示中文」的**真實規模遠大於常量洩漏**：

| 類別 | 規模（盤點 2026-06-22） | 範例 | 本 CHANGE 範圍 |
|------|------------------------|------|----------------|
| 顯示常量洩漏 | 7 組件 | `PERMISSION_INFO_MAP` 等 | ✅ CHANGE-088 已修 |
| **組件級散落 JSX 硬編碼中文** | **~86 組件** | `<TableHead>歸檔日期</TableHead>`、`<Button>批准</Button>` | ✅ **本 CHANGE-089** |
| page metadata title | ~40-50 頁 | `<title>角色管理</title>` / `generateMetadata` | ❌ 另立後續（性質不同：改 `generateMetadata`） |
| 資料層中文 | 多筆 | 角色 description DB seed | ❌ 另立後續（碰 DB seed 可能觸 H1/資料相容） |

### 範圍邊界（用戶 2026-06-22 確認：僅組件級 JSX）

| 範圍 | 是否納入本 CHANGE | 理由 |
|------|------------------|------|
| 組件級 JSX 文字、JSX 屬性（placeholder/title/aria-label/alt）、toast/throw 給使用者的中文、三元/map label 中文 | ✅ 納入 | 純前端 i18n，可純前端驗證 |
| `src/app/**/*.tsx` 的 `<title>` / `generateMetadata` 中文 | ❌ 排除 | 改 `generateMetadata`，性質不同 → 後續 CHANGE |
| 資料層中文（DB seed 角色 description、enum 中文 fallback） | ❌ 排除 | 碰 seed/DB，可能觸 H1 + 需 migration/seed 驗證 → 後續 CHANGE |
| `src/components/ui/**`（shadcn/ui，34 檔） | ❌ 排除 | 第三方 primitive，不修改 |
| 程式碼註釋、JSDoc、logger、開發者 `throw new Error('...')` | ❌ 排除 | H5 例外（非使用者可見） |

---

## 盤點數據（2026-06-22，Explore agent + 主 session 複核）

- 全站組件（不含 `ui/`）約 308，**已 i18n 約 72%**，**待處理約 86 組件**（與 known-discrepancies #10 的 ~88 估算吻合）。
- 「處數」粗估（agent 報的字元數含註釋，不採信為 user-visible 處數，本文件以**組件數**為主軸）。

### 完全未 i18n 的模組（最髒，優先批次）

| 模組（`src/components/features/`） | 待處理組件數 | 對應 namespace（策略見 D1） |
|------|------|------|
| `suggestions` | 6 | `rules`（複用） |
| `retention` | 5 | `dataRetention`（新增） |
| `rule-review` | 5（`RejectDialog` 已 CHANGE-088 處理） | `rules`（複用） |
| `document-source` | 5 | `documentSource`（新增） |
| `rule-version` | 3 | `rules`（複用） |
| `outlook` | 3 | `integrations`（新增，與 sharepoint 共用） |
| `confidence` | 3 | `confidence`（複用 ✅） |
| `history` | 2 | `changeHistory`（新增） |
| `sharepoint` | 2 | `integrations`（新增，與 outlook 共用） |
| `format-analysis` | 2 | `formats`（複用 ✅） |

> 小計：**36 組件**（Batch A pilot 範圍）。

### 部分未 i18n 的模組（後續批次）

| 模組 | 待處理組件數（估） | namespace |
|------|------|------|
| `admin`（含 performance、settings、backup、config、roles、alert、health、restore、log、api-key） | 15 | `admin`（複用） |
| `rules`（規則建立/測試/準確率/預覽） | 8 ⚠️ 偏業務邏輯，agent 建議與規則重構一起做 | `rules` |
| `review`（小型 wrapper：UnsavedChangesGuard/PdfViewer/Skeleton/ValidationMessage） | 5 | `review` |
| `historical-data`（批次上傳/進度/聚合殘留） | 5 | `historicalData` |
| `document-preview`（FieldHighlight/FieldFilters 殘留） | 5 | `documentPreview` |
| `formats` / `mapping-config` / `forwarders` / `escalation` / `audit` 殘留 | ~8 | 各對應 |
| 非 `features` 目錄（`dashboard`/`layout`/`filters`/`analytics`/`export`/`audit`/`auth`/`reports`/`admin/performance`） | ~16 | 各對應（多為 `dashboard`/`common`/`navigation`） |

> 小計：**~50 組件**（Batch B–F）。

---

## 設計決策

1. **D1 — namespace 策略（優先複用，獨立功能才新增）**：延續 CHANGE-088 D1。
   - **複用現有**：`confidence`、`formats`、`rules`、`admin`、`review`、`historicalData`、`documentPreview`、`dashboard`、`common`。
   - **新增（功能獨立、無自然歸屬）**：`documentSource`、`dataRetention`、`integrations`（outlook + sharepoint 共用）、`changeHistory`。**每新增一個必須**：建 `messages/{en,zh-TW,zh-CN}/<ns>.json` ＋ 在 `src/i18n/request.ts` `namespaces` 陣列註冊（H5 要求）。
   - 各模組最終 namespace 於該批實作時以組件實際語意定奪（如 CHANGE-088 各 Phase 做法），本表為初步建議。

2. **D2 — 狀態/通用詞優先複用 `common.json`**：`等待中/處理中/已完成/失敗/已取消`、`儲存/取消/刪除/編輯/確認`、`是/否`、表格分頁等，**先查 `common.json` 既有 key**，能複用就複用，不重複新增（Karpathy §1.2）。

3. **D3 — enum/map 文字模式改造**：大量模組用 `const TEXT_MAP = { ENUM: '中文' }` 或 `status === 'X' ? '中' : '文'` 內聯映射（如 `DocumentSourceBadge`、`getSeverityText`）。改造原則：
   - 文字改 `t(\`prefix.\${enumValue}\`)` 動態取；
   - `color`/`icon`/`value` 等非文字欄位**保留**；
   - 若映射定義在 `src/types/*.ts` 常量，**比照 CHANGE-088：不刪常量定義，只讓組件改用 `t()`**（零型別風險）。

4. **D4 — 3 語言同步 + 治理**：每個新 key 同步 `en`（英文翻譯，**非中文**）/`zh-TW`（原中文）/`zh-CN`（簡體）。每批完成執行 `npm run i18n:check`。新增 namespace 一併納入 `scripts/check-i18n-completeness.ts` 的 `LOCALE_SYNC_CHECKS`（三語言 leaf key 集合一致性 gate），並更新 `.claude/rules/i18n.md`。

5. **D5 — surgical / 不擴大（H3）**：只改「被 render 的使用者可見中文」。不順手 refactor 周邊邏輯、不改 metadata、不碰資料層、不刪 pre-existing dead code。每行改動可 trace 回「消除該組件硬編碼中文」。

6. **D6 — `rules` 模組（8 組件）暫緩**：agent 標記其偏業務邏輯（規則建立/測試/準確率），建議與規則重構一起做。本 CHANGE 將其排入 **Batch C 末位**，實作前再評估是否拆出獨立 CHANGE。

---

## 分批計畫

| 批次 | 範圍 | 組件數 | namespace | 並行性 | 狀態 |
|------|------|--------|-----------|--------|------|
| **Batch A（pilot）** | 完全未 i18n 的 10 個小模組 | 36 | confidence/formats/rules（既有補 key）+ 新增 documentSource/dataRetention/integrations/changeHistory/ruleSimulation | 子批按 namespace 切，不同 namespace 可並行 | ✅ 完成（2026-06-22，677 leaf key×3，見實作記錄） |
| Batch B | `admin` 未 i18n（15 檔，按功能分子批） | 15 | `admin` | 同 namespace JSON → 子批序列或拆 key 區段 | ⏳ |
| Batch C | `review`(5) + `rules`(8, D6 再評估) | 13 | review/rules | review 與 rules 不同 JSON 可並行 | ⏳ |
| Batch D | `historical-data`(5) + `document-preview`(5) 殘留 | 10 | historicalData/documentPreview | 可並行 | ⏳ |
| Batch E | `formats`/`mapping-config`/`forwarders`/`escalation`/`audit` 殘留 | ~8 | 各對應 | 可並行 | ⏳ |
| Batch F | 非 `features` 目錄（dashboard/layout/filters/...） | ~16 | dashboard/common/navigation | 注意共用 namespace JSON 衝突 | ⏳ |

> **並行紀律**（`.claude/rules/agent-orchestration.md`）：同一 namespace JSON 不可多 agent 並改。Batch A 子批以 namespace 為界切分派發。每批由主 session 統一 commit（agent 內不執行 git）。

### Batch A pilot 子批（36 組件，按 namespace 分派避免 JSON 衝突）

| 子批 | 模組 | 組件 | namespace | 動作 |
|------|------|------|-----------|------|
| A1 | confidence | ConfidenceBadge / ConfidenceIndicator / ConfidenceBreakdown | `confidence`（既有） | 補 key + 組件改 `t()` |
| A2 | format-analysis | CompanyFormatTree / FormatTermsPanel | `formats`（既有） | 補 key + 組件改 `t()` |
| A3 | document-source | DocumentSourceBadge / DocumentSourceDetails / SourceTypeFilter / SourceTypeStats / SourceTypeTrend | `documentSource`（新增 + 註冊） | 建 ns + 組件改 `t()` |
| A4 | retention | DataRetentionDashboard / StorageMetricsCard / ArchiveRecordList / DeletionRequestList / RetentionPolicyList | `dataRetention`（新增 + 註冊） | 建 ns + 組件改 `t()` |
| A5 | outlook + sharepoint | OutlookConfigForm / OutlookConfigList / OutlookFilterRulesEditor / SharePointConfigForm / SharePointConfigList | `integrations`（新增 + 註冊） | 建 ns + 組件改 `t()` |
| A6 | history | ChangeHistoryTimeline / HistoryVersionCompareDialog | `changeHistory`（新增 + 註冊） | 建 ns + 組件改 `t()` |
| A7 | rule-review + rule-version + suggestions | ApproveDialog / ImpactSummaryCard / ReviewDetailPage / SampleCasesTable / SuggestionInfo + RollbackConfirmDialog / VersionCompareDialog / VersionDiffViewer + 6 suggestions | `rules`（既有，補 key 區段） | 補 key + 組件改 `t()`（同 ns → 子批內序列或單 agent） |

> A1–A6 namespace 互不重疊，可並行。A7 集中於 `rules` namespace，單獨派發（避免 `rules.json` 多 agent 衝突）。

---

## Hard Constraint 檢核

| 約束 | 是否觸發 | 處理 |
|------|----------|------|
| H1（架構/三層映射/信心度/Prisma） | 否 | 純前端 i18n，不涉及 |
| H2（依賴/vendor） | 否 | 無新 dep（next-intl 既有） |
| H3（task scope） | **嚴守** | 僅改使用者可見中文；不擴大到 metadata/資料層/周邊 refactor；rules 模組（D6）標記暫緩 |
| H4（安全/PII） | 否 | 無 secret/PII |
| H5（i18n/硬編碼） | **是（核心）** | 即為消除硬編碼中文；新增 namespace 必註冊 `request.ts` + 3 語言同步；每批 `i18n:check` 過 |
| H6（設計偏離） | 否 | 依既有 next-intl 架構 |

---

## 驗收標準

| # | 驗收項目 | 標準 | 優先級 |
|---|----------|------|--------|
| 1 | 各批組件無使用者可見硬編碼中文 | EN 介面下對應頁面顯示英文 | High |
| 2 | 3 語言同步 | 每新增 key 在 en/zh-TW/zh-CN 齊全 | High |
| 3 | 新增 namespace 正確註冊 | `request.ts` `namespaces` 含新 ns；頁面無 `[Missing: ...]` | High |
| 4 | 型別/Lint/i18n | `type-check`、`eslint`（無 warning）、`i18n:check` 全通過 | High |
| 5 | 無回歸 | 非文字欄位（color/id/value/icon）行為不變；zh-TW 顯示與原中文一致 | High |
| 6 | 治理 | 新增 namespace 納入 `LOCALE_SYNC_CHECKS`；`.claude/rules/i18n.md` 同步 | Medium |
| 7 | 文檔回寫 | known-discrepancies #10 隨批次更新進度；本 CHANGE 各批狀態 flip | Medium |

---

## 回滾計劃

- 各批改不同組件 + 多為不同 namespace JSON，**可單批回滾**（`git revert` 該批 commit）。
- 常量定義保留、未刪 → 回滾後組件改回讀常量即恢復。
- 無資料庫/API/路由變更，回滾無資料副作用。
- 新增 namespace 回滾需一併移除 `request.ts` 註冊與 JSON 檔（同一 commit 內，原子回滾）。

---

## 依賴與後續

- 承接 CHANGE-088（PR #56，已 merge `main`）。
- **後續另立**：page metadata title i18n（CHANGE-09X）、資料層中文（角色 description seed 等，CHANGE-09X，需評估 H1）。
- Batch B–F 於 Batch A pilot 驗證 pattern 後逐批推進（每批前向用戶確認）。

---

## Batch A pilot 實作記錄（2026-06-22）

Batch A（完全未 i18n 的 10 個小模組，36 組件）已完成。範本 `document-source`（5 組件）由主 session 親作以確立 pattern，其餘以 **7 個並行 `code-implementer` agent** 實作（各一模組 + 一獨立 namespace，零檔案衝突）。`request.ts` 新 namespace 註冊與 `check-i18n-completeness.ts` 治理擴充由主 session 統一處理（避免多 agent 並改同檔）。

### 各子批成果

| 子批 | 模組 | 組件 | namespace | leaf key/語言 | 備註 |
|------|------|------|-----------|--------------|------|
| 範本 | document-source | 5 | documentSource（新增） | 35 | 主 session 親作；雙語常量 `SOURCE_TYPE_CONFIG.label/labelEn` → `t()` |
| A1 | confidence | 3 | confidence（既有補 key） | badge 3 + breakdown.weightedScore 1 | 順帶修 `locale==='zh'` 漏判 zh-CN；`locale` prop 標 `@deprecated` 保留（surgical 不碰呼叫點） |
| A2 | format-analysis | 2 | formats（既有補 key） | formatAnalysis 39 | 移除 `DOCUMENT_TYPE/SUBTYPE_LABELS` orphan，顏色常量保留 |
| A4 | retention | 5 | dataRetention（新增） | 178 | 通用詞收進 `dataRetention.common.*` |
| A5 | outlook + sharepoint | 5 | integrations（新增） | 209 | 複用 `common.actions.cancel` |
| A6 | history | 2 | changeHistory（新增） | 37 | changeType/diffType enum → `t()` |
| A7a | rule-review + rule-version | 8 | rules（既有補 key） | ruleReview 66 + ruleVersion 30 | `RejectDialog` 已 CHANGE-088 排除；複用 `common.actions.cancel` |
| A7b | suggestions | 6 | ruleSimulation（新增） | 79 | **原計畫 A7 拆為 A7a/A7b**，避免 `rules.json` 衝突 + 減單 agent 負擔 |

**新增 5 個 namespace**（documentSource / dataRetention / integrations / changeHistory / ruleSimulation），全部註冊 `src/i18n/request.ts`。**本批新增三語言 i18n key 約 677 個/語言**（676 納入 i18n:check + `breakdown.weightedScore` 1）。

### 確立的 i18n pattern（供 Batch B–F 沿用）

1. 雙語常量（label/labelEn）或中文常量 label → 組件統一改 `t()`；**常量定義保留不刪**，非文字欄位（color/icon/value）續用；清「組件改動造成的」orphan import。
2. enum/status map（`{ X: '中文' }` 或三元）→ `t(\`prefix.\${val}\`)`，未知值 `t.has(key) ? t(key) : t('prefix.unknown')`。
3. prop 預設值中文 → 改無預設 + `const resolved = prop ?? t('key')`。
4. ICU 參數（`第 X 個共 Y 個`）→ `t('key', { index, total })`。
5. **不碰**：純數字日期格式（date-fns `'yyyy/MM/dd'`、`toLocaleDateString('zh-TW')` 輸出無中文 token → 不洩漏）、全形冒號「：」標點、JSDoc/註釋/logger/開發者 `throw new Error`。
6. 通用詞優先複用 `common`（先查 `messages/en/common.json`）。

### 治理擴充（D4）

`scripts/check-i18n-completeness.ts` `LOCALE_SYNC_CHECKS` 新增 **9 條 CHANGE-089 規則**：5 個新 namespace 整檔三語言同步（新增 `navigateToPrefix` 空 prefix guard 支援 `keyPrefix='' ` 整檔檢查）+ 既有 namespace 新增子樹（confidence.badge / formats.formatAnalysis / rules.ruleReview / rules.ruleVersion）。`.claude/rules/i18n.md` 常量→i18n 映射表同步補入新 namespace。

### ⚠️ 範圍邊界（本批未處理，記為後續）

1. **Zod schema 驗證訊息中文（9 處）**：`outlook`/`sharepoint` 3 個表單組件（`OutlookConfigForm` / `OutlookFilterRulesEditor` / `SharePointConfigForm`）的 zod schema 仍含中文訊息（如 `z.string().min(1, '名稱不能為空')`）。屬**表單驗證層**，需引入 `useLocalizedZod` 體系重構，性質不同於 JSX render 文字，超出 Batch A surgical scope（範本 document-source 亦無此問題）。→ 建議另立 zod i18n 專項（全站表單一併處理）。
2. **Batch B–F**（admin 15 / review 5 / rules 業務 8 / historical-data 5 / document-preview 5 / 其他殘留 ~8 / 非 features ~16）約 50 組件未動。
3. **page 層（`src/app/**/*.tsx`）render 中文（視覺抽查新發現，範圍比原估廣）**：抽查 `/admin/integrations/outlook` 證實——組件 `OutlookConfigList` 已英文（`integrations` namespace 無 Missing），但 **page.tsx 的 h1「Outlook 連線配置」+ 描述 + 「新增配置」按鈕仍中文**。此屬 `src/app` 頁面層、**非本 CHANGE 的 86 組件範圍**；範圍遠大於原記錄的「page metadata title」（grep 粗估 ≥13+ page.tsx 含 render 中文，且 pattern 不完整、實際更多）→ **建議獨立 CHANGE（page 層 i18n）**。
4. page metadata title、資料層中文（DB seed，如角色 description）依範圍邊界排除（另立後續 CHANGE）。

### 驗證結果

- `npm run type-check`：exit 0
- `npx eslint`（10 模組 36 組件）：exit 0（無 warning）
- `npm run i18n:check`：exit 0，9 條 CHANGE-089 規則三語言一致
- 全模組 grep（排除註釋）：render 路徑**零殘留中文**；唯一剩餘為上述 9 處 zod schema 訊息（範圍邊界）
- **視覺抽查**（EN，dev `:3200`）：`/admin/integrations/outlook` → `[Missing:]` = 0（`integrations` 新 namespace 正確載入）、`OutlookConfigList` 組件 render 英文 ✅、console 0 error；`/documents` `[Missing:]` = 0。確認**組件級 i18n + 新 namespace 註冊運作正常**（頁面殘留中文均來自 page.tsx 層，見範圍邊界 #3）

---

*規劃文件建立：2026-06-22（承接 CHANGE-088 §範圍邊界與後續）；Batch A 實作完成：2026-06-22*
