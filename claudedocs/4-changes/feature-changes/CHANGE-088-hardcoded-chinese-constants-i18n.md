# CHANGE-088: EN 介面顯示中文 — 全站硬編碼中文顯示常量系統性 i18n 化 ＋ i18n:check 治理擴充

> **日期**: 2026-06-22
> **狀態**: ✅ 已完成（2026-06-22）— 6 Phase + Phase 7 治理擴充全數完成；type-check / eslint / i18n:check（含新增三語言同步檢查 155 key）通過、視覺抽查通過。詳見文末「實作記錄」。**⚠️ 重要範圍發現**：item 7「EN 顯示中文」的真實規模遠大於本 CHANGE — 見實作記錄 §範圍邊界與後續
> **優先級**: 中
> **類型**: Feature（i18n 修正 + 治理）
> **影響範圍**: 6 模組 7 組件 + 6 個 `src/types/*.ts` 顯示常量 + 3 語言 JSON + `i18n:check` 腳本
> **來源**: 由 `FIX-088`（系統性盤點）升級而來（用戶 2026-06-20 approve 升級）
> **分支**: `feature/change-088-hardcoded-chinese-i18n`（自 `feature/change-084-087-phase1` 分出，PR base 暫設該分支，stacked）

---

## 變更背景

EN（英文）介面下部分頁面仍顯示中文。根因**並非** en JSON 缺 key 觸發 fallback，而是**組件直接 render 含中文的顯示用常量、未走 `useTranslations`**。這些中文未經 i18n 系統，無論 en JSON 是否齊全都會顯示中文。

`FIX-088` 階段一已用 4 個並行 Explore agent 盤點 35 個含中文常量檔，並由主 session 逐一複驗實際 render 點，確認**真洩漏跨 6 模組 7 組件**。因規模（>150 i18n key、跨 6 模組）觸發 §升級條件，本 CHANGE-088 承接階段二（修正）＋ 治理擴充。

### 為何長期未被發現（治理缺口）

`npm run i18n:check`（`scripts/check-i18n-completeness.ts`）目前**只檢查 `PROMPT_TYPES` 一個常量**，`PERMISSION_INFO_MAP`、`REJECTION_REASONS` 等數十個顯示用常量完全不在覆蓋範圍。即使常量中文洩漏、即使組件直接 render，現有治理檢查也不會報錯。本 CHANGE 必須**同時修缺口 + 補治理**，否則未來會再犯。

---

## 真洩漏清單（FIX-088 複驗確認 + 本 CHANGE 精掃補充）

| # | 組件 | 來源常量（檔案） | 被 render 的欄位 | 中文條目（估） |
|---|------|----------------|----------------|--------------|
| L1 | `document-preview/ExtractedFieldsPanel.tsx` | `extracted-field.ts` → `DEFAULT_CATEGORIES` | `displayName`（6 類別） | 6 |
| L2 | `admin/config/ConfigItem.tsx` | `config.ts` → `EFFECT_TYPE_INFO` | `label`（3 效果）+ JSX「已修改」 | ~4 |
| L3 | `review/RejectDialog.tsx`（rule-review 用） | `review.ts` → `REJECTION_REASONS`/`REJECT_LABELS` | `label`+`description`（6 原因） | ~12 |
| L4 | `audit/AuditReportJobList.tsx` | `audit-report.ts` → `AUDIT_REPORT_TYPES`+`REPORT_JOB_STATUSES`+`REPORT_OUTPUT_FORMATS` | `label`(+`description`) + JSX「筆記錄」 | ~22 |
| L5 | `prompt-config/PromptEditor.tsx` | `prompt-config-ui.ts` → `SYSTEM_VARIABLES`（+ 類別標籤函數） | `displayName`+`description`（10 變數）+ 類別 ×3 | ~26 |
| L6 | `admin/roles/PermissionSelector.tsx` | `permission-categories.ts` → `PERMISSION_INFO_MAP`+`PERMISSION_CATEGORIES` | `name`+`description`（21 權限）+ `label`+`description`（8 分類） | ~58 |

> **6 模組 7 組件**：L3 的 `RejectDialog` 同時供 review 與 rule-review 兩處引用（計為 7 組件其一）。最終以 §實作各 Phase 的 grep 複驗為準。

### 實作時必須再確認的 3 個邊界（避免遺漏或過度修改）

| 待確認 | 內容 | 處理原則 |
|--------|------|----------|
| C1 | `audit-report.ts` `REPORT_OUTPUT_FORMATS` 的 `label` 是否為中文（grep 未顯示中文 label，疑為 `PDF`/`EXCEL` 英文 + 中文 `description`） | 實作時讀原文：英文技術值保留、中文 description 才 i18n |
| C2 | `config.ts` 另有 `CONFIG_CATEGORY_INFO`（8 類別 ×2）與 `VALUE_TYPE_INFO`（~7）含中文，FIX-088 僅列 `EFFECT_TYPE_INFO` | grep 確認 `ConfigManagement`/`ConfigEditDialog`/`ConfigItem` 是否 render 這兩個常量的文字欄位；若是 → 一併修，若否 → 記為非洩漏 |
| C3 | `prompt-config-ui.ts` `getVariableCategoryLabel`/`getVariableCategoryDescription`（static/dynamic/context ×2）是否被 `PromptEditor` render | grep 確認；若是 → 納入 L5 |

---

## 設計決策

1. **D1 — namespace 對應（優先複用現有 namespace，避免新增）**：

   | 常量 | 目標 namespace | key 前綴（建議） |
   |------|---------------|-----------------|
   | `DEFAULT_CATEGORIES` | `documentPreview` | `fieldsPanel.categories.*`（**半成品 `ExtractedFieldsPanel` 已採此 key**，補 key 即收尾） |
   | `EFFECT_TYPE_INFO`（+C2） | `systemSettings` | `config.effectType.*`（C2 命中則 `config.category.*`/`config.valueType.*`） |
   | `REJECTION_REASONS` | `review` | `rejection.reasons.*`（`.label`/`.description`） |
   | `AUDIT_REPORT_TYPES`/`REPORT_JOB_STATUSES`/`REPORT_OUTPUT_FORMATS` | `admin`（傾向）或 `reports` | `auditReport.types.*` / `auditReport.statuses.*` / `auditReport.formats.*` |
   | `SYSTEM_VARIABLES` | `promptConfig` | `variables.*`（`.displayName`/`.description`）+ `variables.categories.*` |
   | `PERMISSION_INFO_MAP`/`PERMISSION_CATEGORIES` | `admin` | `permissions.items.*`（`.name`/`.description`）+ `permissions.categories.*`（`.label`/`.description`） |

   > 傾向**全部放現有 namespace**（不新增 namespace、不改 `src/i18n/request.ts`，降低風險）。`auditReport` 歸 `admin` 或 `reports` 於 Phase 4 實作時依該頁實際 `useTranslations` namespace 定奪。

2. **D2 — 狀態詞優先複用 `common.json`**：`REPORT_JOB_STATUSES` 的 `等待中/處理中/已完成/失敗/已取消` 等與 `common.json` `status.*` 高度重疊。實作時**先查 `common.json` 是否已有對應 key，能複用就複用**，不重複新增（Karpathy §1.2 Simplicity First）。`color`/`value` 等非文字欄位**保留在常量**（只 i18n 文字欄位）。

3. **D3 — 改造模式（常量保留結構，組件改取 i18n）**：顯示常量的**非文字欄位（id/value/color/order/code）保留**；組件改為以常量的 key 對應 `t()`。兩種等價做法，依各組件現況擇一：
   - (a) 組件內 `t(\`prefix.\${item.id}\`)` 動態取（適合 `PermissionSelector` 這類 map over 常量者）；
   - (b) 移除常量文字欄位，組件直接 `t('prefix.xxx')`（適合少量固定項如 `EFFECT_TYPE_INFO`）。
   - **不刪常量定義本身**（其他模組可能引用 id/color），僅讓「文字欄位不再被當顯示來源」。orphan 清理限本次造成者。

4. **D4 — 治理擴充（i18n:check 加入這批常量）**：擴充 `scripts/check-i18n-completeness.ts`，將本批常量（`PERMISSION_INFO_MAP`、`REJECTION_REASONS`、`AUDIT_REPORT_TYPES`、`SYSTEM_VARIABLES`、`EFFECT_TYPE_INFO`、`DEFAULT_CATEGORIES` 等）納入「常量 key ↔ 3 語言 JSON」完整性檢查，缺 key 即 `i18n:check` 失敗。同步更新 `.claude/rules/i18n.md` §常量→i18n 映射表。

5. **D5 — `ExtractedFieldsPanel` 半成品收尾**：工作樹已有 `ExtractedFieldsPanel.tsx` 改用 `t('fieldsPanel.categories.*')` 但 key 未建（靠 `t.has()` fallback 回中文，目前無效）。Phase 1 補齊 3 語言 key 即生效，無需再改組件。

---

## 實施計劃（分階段，由小到大，每階段獨立驗證）

| 階段 | 範圍 | i18n 檔 | 驗證 | 狀態 |
|------|------|---------|------|------|
| Phase 1 | L1 `ExtractedFieldsPanel`（半成品收尾，6 key） | `documentPreview` | type-check / 視覺：EN 下類別顯示英文 | ⏳ |
| Phase 2 | L2 `ConfigItem` + C2 確認（`config.ts`） | `systemSettings` | type-check / EN 系統設定頁 | ⏳ |
| Phase 3 | L3 `RejectDialog`（`review.ts`） | `review` | type-check / EN 規則拒絕對話框 | ⏳ |
| Phase 4 | L4 `AuditReportJobList` + C1 確認（`audit-report.ts`） | `admin`/`reports` | type-check / EN 審計報告列表 | ⏳ |
| Phase 5 | L5 `PromptEditor` + C3 確認（`prompt-config-ui.ts`） | `promptConfig` | type-check / EN Prompt 編輯器 | ⏳ |
| Phase 6 | L6 `PermissionSelector`（最大，~58 key） | `admin` | type-check / EN 角色權限選擇器 | ⏳ |
| Phase 7 | 治理擴充 `i18n:check` + `.claude/rules/i18n.md` 更新 + 全站 `grep \p{Han}` 於 `src/components/**.tsx` 複查無新洩漏 | 腳本 | `npm run i18n:check` 通過且能偵測本批常量缺 key | ⏳ |

> **並行性**：Phase 1–6 各組件彼此獨立、修不同 namespace JSON，可並行（依 `.claude/rules/agent-orchestration.md`）。但**同一 namespace JSON 不可多 agent 並改**（如 L4+L6 皆可能落 `admin.json` → 需序列或拆不同 namespace）。Phase 7 治理擴充須在 1–6 完成後做。
>
> **3 語言同步**：每個 key 必須同步 `en`/`zh-TW`/`zh-CN`。en = 英文翻譯（非中文）；zh-TW = 原中文；zh-CN = 簡體。

---

## Hard Constraint 檢核

| 約束 | 是否觸發 | 處理 |
|------|----------|------|
| H1（架構/三層映射/信心度/Prisma） | 否 | 純前端 i18n 化 + 腳本，不涉及 |
| H3（task scope / 新抽象層） | 否 | 屬用戶明確要求的 item 7「全面掃描修正」，非 scope 外；不新增 namespace 抽象 |
| H5（i18n / 硬編碼） | **是（核心）** | 本 CHANGE 即為消除硬編碼中文；完成前 `npm run i18n:check` 必過，且擴充其覆蓋本批常量 |
| H6（設計偏離） | 否 | 依既有 i18n 架構（next-intl + messages/*.json），無偏離 |

---

## 驗收標準

| # | 驗收項目 | 標準 | 優先級 |
|---|----------|------|--------|
| 1 | 6 組件無硬編碼中文 render | EN 介面下 L1–L6 對應頁面全顯示英文 | High |
| 2 | 3 語言同步 | 每新增 key 在 en/zh-TW/zh-CN 齊全 | High |
| 3 | 治理可偵測 | `i18n:check` 納入本批常量，故意刪一 key 會報錯 | High |
| 4 | 型別/Lint/i18n | `type-check`、`eslint`（無 warning）、`i18n:check` 全通過 | High |
| 5 | 無回歸 | 常量非文字欄位（color/id/value）行為不變；zh-TW 顯示與原中文一致 | High |
| 6 | 全站複查 | `grep \p{Han}` 於 `src/components/**.tsx` 無「被 render 的」新洩漏（排除註釋） | Medium |
| 7 | 文檔回寫 | FIX-088 / known-discrepancies / `.claude/rules/i18n.md` 同步更新 | Medium |

## 測試場景

| # | 場景 | 步驟 | 預期 |
|---|------|------|------|
| 1 | EN 權限選擇器 | EN 下開角色編輯 → 權限選擇器 | 權限名稱/描述/分類全英文 |
| 2 | EN 提取欄位類別 | EN 下開文件詳情 Extracted Fields | 類別標題英文（Invoice/Vendor/…） |
| 3 | EN 拒絕原因 | EN 下規則建議審核 → 拒絕 | 原因下拉全英文 |
| 4 | zh-TW 無回歸 | zh-TW 下同上頁面 | 顯示與改前中文一致 |
| 5 | 治理偵測 | 暫刪一個新 key 跑 `i18n:check` | 報錯指出缺 key |

---

## 回滾計劃

- 各 Phase 改不同組件 + 不同 namespace JSON，**可單 Phase 回滾**（`git revert` 該 Phase commit）。
- 常量定義保留、未刪 → 回滾後組件改回讀常量即恢復原樣。
- 無資料庫/API/路由變更，回滾無資料副作用。

---

## 依賴與後續

- 自 `feature/change-084-087-phase1`（PR #55）分出，含 CHANGE-087 Phase 2 的組件遷移（`AuditReportJobList` 已遷 DataTable）。本 CHANGE 在其基礎上改 i18n，避免衝突。
- PR base 暫設 `feature/change-084-087-phase1`；待 PR #55 merge 後自動轉 `main`（或 rebase）。

---

## 實作記錄（2026-06-22）

於分支 `feature/change-088-hardcoded-chinese-i18n` 完成。Phase 2–6 以 5 個並行 `code-implementer` agent 實作（各負責一組件 + 一獨立 namespace，零檔案衝突），Phase 1 與 Phase 7 由主 session 親自處理。

### 各 Phase 成果

| Phase | 組件 | namespace | key 數/語言 | 備註 |
|-------|------|-----------|------------|------|
| 1 | `ExtractedFieldsPanel` | `documentPreview.fieldsPanel.categories` | 6 | 半成品收尾（D5），補 key 即生效 |
| 2 | `ConfigItem` / `ConfigEditDialog` / `ConfigManagement` | `systemSettings.config` | 20 | C2 命中：`CONFIG_CATEGORY_INFO` 被 `ConfigManagement` render 已修；`VALUE_TYPE_INFO` 無人用排除 |
| 3 | `RejectDialog` | `review.rejection` | 21 | 另修組件自身 8 處 JSX 中文；`REJECT_LABELS` 常量實不存在 |
| 4 | `AuditReportJobList` | `reports.auditReport` | 32 | C1：`REPORT_OUTPUT_FORMATS.label` 全英文保留；D2：複用 `common.status.*` 3 狀態；另修 `formatDate` 硬編碼 `'zh-TW'` → `useLocale()` |
| 5 | `PromptEditor` | `promptConfig.variables` | 18 | 實際 9 變數；C3：類別標籤早已 i18n，無需處理；無 ICU 轉義 |
| 6 | `PermissionSelector` | `admin.permissions` | 58 | `code` 冒號→底線映射（`user:manage:city`→`user_manage_city`） |
| 7 | `scripts/check-i18n-completeness.ts` + `.claude/rules/i18n.md` | — | — | 治理擴充（見下） |

**三語言 key 合計 155 個**（6 + 20 + 21 + 32 + 18 + 58），與規劃 >150 估算吻合。**未修改任何 `src/types/*.ts` 常量定義**（只改組件改用 `t()`，零型別風險）。

### Phase 7 治理擴充（D4）

`scripts/check-i18n-completeness.ts` 新增 **三語言同步檢查（`LOCALE_SYNC_CHECKS`）**：對 6 個 namespace 子樹，驗證 en/zh-TW/zh-CN 的 leaf key 集合完全一致。

> **實作取向說明**：規劃 D4 原構想「常量 key ↔ i18n 解析」。實作時改採「三語言同步」，因本批常量結構異構（computed property `[PERMISSIONS.X]`、陣列、不同欄位來源），逐一解析 TS 成本高且易碎；而 next-intl 缺某語言 key 只會 fallback（不報錯），故「三語言不同步」才是真實洩漏風險。此為更通用、更有長期價值的 gate。`.claude/rules/i18n.md` §常量→i18n 映射表已同步補入本批 6 個常量。

### 驗證結果

- `npx tsc --noEmit`：通過（exit 0）
- `npx eslint`（8 改動組件）：通過（清理了 `AuditReportJobList` 一個 agent 遺留的 `AUDIT_REPORT_TYPES` orphan import）
- `npm run i18n:check`：通過，6 namespace 三語言同步各 ✅（6/20/21/32/18/58 leaf key）
- 視覺抽查（EN，dev `:3200`）：`ExtractedFieldsPanel` 類別顯示 "Other"（原「其他」）✅；`PermissionSelector` 分類顯示 "Invoice Operations"/"Report Operations"/"Rule Management"（原中文）✅，`code`→key 映射正確無 fallback

### ⚠️ 範圍邊界與後續（重要）

本 CHANGE 精準完成 FIX-088 盤點的 **「顯示常量洩漏」根因類別（6 模組 7 組件）**。但全站複查（`grep '>…\p{Han}'` 於 `src/components/**.tsx`）顯示 item 7「EN 顯示中文」的**真實規模遠大於此**：

| 類別 | 規模（粗估） | 範例 | 是否本 CHANGE 範圍 |
|------|------------|------|-------------------|
| 顯示常量洩漏 | 7 組件 | `PERMISSION_INFO_MAP` 等 | ✅ 本 CHANGE 已修 |
| 組件級散落 JSX 硬編碼中文 | **~88 組件 / ~592 處** | `RoleList` 頁標題「角色管理」、`ConfigEditDialog` 按鈕「取消/儲存」 | ❌ 未修（H3 未擅自擴大） |
| 資料層中文 | 多筆 | 角色 description「審計員 - 只讀報表…」（DB seed） | ❌ 未修（屬資料層） |
| page metadata title | 多頁 | `<title>角色管理</title>` | ❌ 未修 |

> **建議**：item 7 若要達成「EN 介面完全無中文」，需另立 **CHANGE-089（全站組件級 JSX 硬編碼中文 i18n 化，~88 組件）** + 資料層 / metadata 中文處理。規模龐大，建議分模組批次推進，並先由用戶確認優先級。本 CHANGE-088 已將「顯示常量」這一最隱蔽（不在 `i18n:check` 覆蓋、長期未被發現）的根因類別清除並補上治理。

---

*規劃文件建立：2026-06-22（承接 FIX-088 階段二）；實作完成：2026-06-22*
