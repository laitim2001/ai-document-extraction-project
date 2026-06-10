# FIX-069: ReDoS — 使用者 regex 對大文本執行無逾時保護（安全 regex 執行工具）

> **狀態**: 🚧 待修復
> **建立日期**: 2026-06-10
> **發現方式**: 代碼審查（2026-06-10 全面安全審查）
> **影響頁面/功能**: 規則測試 / 規則預覽（`/api/rules/test`、`/api/rules/[id]/preview`）+ 多處服務層 regex 執行
> **優先級**: 高（P1）
> **來源**: SECURITY-ASSESSMENT.md §5 主題 F（ReDoS）、§6 模式 5、REMEDIATION-ROADMAP.md WP-6
> **相依**: 無強相依；可獨立開發。`/api/rules/*` 端點認證由 WP-2（CHANGE-078 middleware 閘）統一收口，與本 FIX 互補
> **注意**: 若採 RE2 引擎方案需新增 npm 依賴（觸發 **H2 — Dependency Constraint**），文件中該選項**待 approve**；限長 + timeout 方案**無需新依賴**，預設採此方案

---

## 問題描述

多個端點接收**使用者提供的正則表達式**（`pattern.expression`）並直接以原生 `RegExp` 對**任意大小的 OCR 全文**執行 `.match()` / `.exec()` / `.test()`，且**無 pattern 長度限制、無執行逾時保護**。攻擊者可提交惡意 regex（catastrophic backtracking，例如 `(a+)+$`）搭配特製輸入文本，使 Node.js 單一事件迴圈執行緒長時間阻塞（ReDoS — Regular Expression Denial of Service），導致整個服務無法回應。

### 主要發現（High，逐行驗證）

| # | 編號 | 嚴重度 | 位置:行 | 問題 |
|---|------|--------|---------|------|
| BUG-1 | RULES-01 | High | `app/api/rules/test/route.ts:121,139` | `testRegexPattern()` 以使用者 `expression` + `new RegExp(expression, flags||'gm')` 對 `content`（請求傳入的測試文本）執行 `content.match(regex)` 與 `regexForPos.exec(content)` 迴圈，無 pattern 限長、無逾時 |
| BUG-2 | RULES-02 | High | `app/api/rules/[id]/preview/route.ts:466,467` | `executeRegexPattern()` 以使用者 `expression` + `new RegExp(expression, flags??'gi')` 對 `ocrText`（取自文件 `ocrResult.extractedText`，最長可達整份發票 OCR 全文）執行 `regex.exec(text)`，無 pattern 限長、無逾時 |

> **驗證註記**：
> - BUG-1：`POST /api/rules/test`（route.ts:385）→ `testRegexPattern(pattern, content)`（route.ts:342）。`content` 為請求輸入的測試文本，`expression` 與 `flags` 皆來自使用者 `pattern`（route.ts:114-119）。
> - BUG-2：`POST /api/rules/[id]/preview`（route.ts:113）→ `executeRegexPattern(pattern, ocrText)`（route.ts:382）。`ocrText` 取自 `document.ocrResult?.extractedText`（route.ts:275）或請求傳入的 Base64 文本（route.ts:280-282），可為完整 OCR 全文。
> - 兩處皆有 `try/catch` 捕捉**語法錯誤**，但 `catch` **無法**中斷已進入 catastrophic backtracking 的同步 regex 執行——一旦執行緒卡住，`try/catch` 不會觸發。

### 附帶範圍（Medium，本 FIX 一併納入「需套用安全執行工具」的盤點，可視工作量分批）

> 以下為審查報告 §6 模式 5 點名、且經本次 Grep 確認確實對使用者輸入或外部資料的 regex 執行的位置。風險等級較低（部分輸入受 admin 權限保護、文本較短，或已有局部 try/catch），列為待套用清單。

| 編號 | 位置:行 | 說明 |
|------|---------|------|
| TRANSFORM-02 | `services/transform/aggregate.transform.ts:209` | `new RegExp(filter.descriptionPattern, 'i')` 對 line item `description` 執行 `.test()`（已有 try/catch 容錯，但無逾時） |
| CF2-01 | `services/mapping/transform-executor.ts:163,169,178` | 欄位映射 transform 以動態建構 regex 替換（pattern 由配置欄位拼接） |
| services-root-1 | `services/rule-simulation.ts:285,328,333`、`services/system-config.service.ts:905` | 規則模擬與系統配置 validation pattern 以 `new RegExp(pattern)` 對輸入執行 |
| services-root-3 | `services/impact-analysis.ts:367,398,400`、`services/rule-suggestion-generator.ts:394` | 影響分析與規則建議以使用者規則 `pattern` 對樣本文本執行 |
| 其他同類 | `services/outlook-config.service.ts:741,775`、`services/outlook-document.service.ts:595`、`services/n8n/workflow-trigger.service.ts:604`、`services/processing-stats.service.ts:95`、`services/template-instance.service.ts:710` | 規則 `ruleValue` / validation pattern 以 `new RegExp(...)` 對輸入執行 |
| PY-04 | `python-services/`（extraction / mapping 服務） | Python 側對使用者 pattern 執行 `re` 模組，需獨立對等防護（Python 無原生逾時，需 RE2 或 signal/subprocess 隔離）— **本 FIX 僅標記，Python 修復併入 WP-8 範圍評估** |
| lib-1-M2 | `src/lib/*`（審查報告 lib-1 範圍點名的工具層 regex） | 工具層 regex 套用安全執行 helper |

> **不在本 FIX 範圍**：以**硬編碼字面值或內部識別符**（非使用者輸入）建構的 regex，例如 `variable-replacer.ts`（`${prefix}(\w+)${suffix}`，prefix/suffix 為設定符號）、`term-aggregation.service.ts`（`\b${code}\b`，code 為內部術語碼）。這些 pattern 來源可控，ReDoS 風險極低，列為觀察即可，避免擴大 task scope（H3）。

---

## 重現步驟

1. 對 `POST /api/rules/test` 提交 body：
   ```json
   {
     "extractionType": "REGEX",
     "pattern": { "expression": "(a+)+$", "flags": "gm" },
     "content": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaX"
   }
   ```
2. 觀察現象：請求長時間無回應，Node.js 事件迴圈被同步 regex 執行阻塞，期間其他所有請求一併卡住。
3. `/api/rules/[id]/preview` 同理，且 `ocrText` 取自真實文件 OCR 全文（更長），放大效果。

---

## 根本原因

1. **無 pattern 長度上限**：使用者可提交任意長度與複雜度的 regex。
2. **無執行逾時**：原生 `RegExp` 在 V8 上是同步、不可中斷的，現有 `try/catch` 只能捕捉語法錯誤，無法中止 catastrophic backtracking。
3. **無統一安全執行封裝**：各端點 / 服務各自手寫 `new RegExp(...)` + `.match()/.exec()/.test()`（Grep 確認專案中 30+ 處 `new RegExp(`），缺乏統一入口套用防護，導致逐處遺漏。
4. **前端缺提交前語法驗證**：規則編輯表單未在送出前以 `try { new RegExp() }` 驗證語法（`src/types/rule.ts:668` 的 `regexPatternSchema` 有 Zod `refine` 語法驗證，但僅後端 schema，且只驗語法不防 ReDoS；前端 components 未直接套用）。

---

## 解決方案

### 核心：建立統一「安全 regex 執行工具」（共用 helper）

新增單一工具（建議 `src/lib/safe-regex.ts`），對外提供如 `safeRegexExec(expression, flags, text, options)` / `safeRegexTest(...)` / `safeRegexMatchAll(...)`，內部統一施加：
1. **pattern 限長**：`expression.length` 超過上限（建議常數 `MAX_REGEX_PATTERN_LENGTH`，例如 1000）即拒絕並回 400。
2. **flags 白名單**：僅允許 `gimsuy`，拒絕未知 flag。
3. **執行逾時**：見下方兩方案對比，預設採方案 A。
4. **語法驗證**：`new RegExp()` 包 try/catch，語法錯誤回 400（RFC 7807 top-level 格式）。

對 BUG-1 / BUG-2 兩個端點先行套用此 helper，附帶範圍（Medium）依工作量分批改用。

### 方案對比

| 選項 | 方案 | 是否需新依賴 | 防護強度 | 取捨 | H 約束 |
|------|------|--------------|----------|------|--------|
| **A（預設）** | pattern 限長 + 執行 timeout（限長為第一道閘；timeout 以 worker_threads / Worker 隔離執行同步 regex，逾時即 terminate worker 回 408/422） | **否**（Node 內建 `worker_threads`） | 中高（限長阻擋多數惡意 pattern；worker 逾時可硬中斷卡死的執行） | worker 啟動有額外開銷；需序列化 text 進 worker。對「規則測試 / 預覽」這類非高頻端點可接受 | 無 |
| **A-簡化** | 僅 pattern 限長 + flags 白名單（不加 timeout） | 否 | 中（擋住超長 / 明顯惡意 pattern，但無法硬中斷已開始 backtracking 的合法長度 pattern） | 實作最簡、零開銷；殘留風險：限長內仍可能構造 catastrophic pattern | 無 |
| **B** | 改用 RE2 引擎（`re2` npm 套件，線性時間、無 backtracking，從根本消除 ReDoS） | **是**（新增 `re2`，含原生 binding / node-gyp 編譯） | 高（線性時間保證，無 catastrophic backtracking） | **觸發 H2**：新增依賴含原生編譯，需確認跨平台（Win/Linux 容器）建置、Azure 部署相容性、bundle / 啟動影響；RE2 不支援部分 JS regex 特性（backreference、lookbehind 部分），既有規則需相容性盤點 | **H2 — 待 approve** |

#### 建議

- **預設採方案 A**（限長 + worker timeout），無需新依賴，可立即實作，先堵住 BUG-1 / BUG-2 兩個 High。
- **方案 B（RE2）列為待 approve 選項**：若團隊評估後認為需要線性時間的根本性保證（尤其 Python 側 PY-04 也需對等防護，RE2 在兩端皆有實作），再依 **H2** 流程提請 approve 後納入。屆時需一併盤點既有規則是否使用 RE2 不支援的語法。

### 前端：提交前語法驗證

在規則編輯 / 測試表單（規則管理相關 components）送出前，以 `try { new RegExp(expression, flags) } catch { 顯示錯誤 }` 做語法驗證，並對 `expression.length` 做與後端一致的上限檢查，錯誤訊息走 i18n（**H5**：3 語言同步 `messages/{en,zh-TW,zh-CN}/rules.json`，新增 key 例如 `validation.regexSyntaxError` / `validation.regexTooLong`）。

> **i18n 注意**：若錯誤訊息文案含 `{` `}`（regex 字面），需依 `.claude/rules/i18n.md` ICU 轉義規則處理。

---

## 修改的檔案

| 檔案 | 修改內容 | 範圍 |
|------|----------|------|
| `src/lib/safe-regex.ts`（新增） | 統一安全 regex 執行 helper（限長 + flags 白名單 + 語法驗證 + 逾時；方案 A） | 核心 |
| `src/app/api/rules/test/route.ts` | `testRegexPattern()` 改用 `safeRegexExec/MatchAll`（取代 :121,:139 的原生 `new RegExp`）；pattern 限長/逾時回 RFC 7807 | BUG-1 |
| `src/app/api/rules/[id]/preview/route.ts` | `executeRegexPattern()` 改用 `safeRegexExec`（取代 :466,:467 的原生 `new RegExp`）；同上 | BUG-2 |
| `src/types/rule.ts` | `regexPatternSchema`（:668）`expression` 補 `.max(MAX_REGEX_PATTERN_LENGTH)` 限長驗證 | 後端 schema |
| 規則編輯 / 測試表單 component（`src/components/features/rules/*`，待實作時定位） | 提交前 `try{new RegExp()}` 語法驗證 + 限長檢查 + i18n 錯誤訊息 | 前端 |
| `messages/{en,zh-TW,zh-CN}/rules.json` | 新增 regex 語法 / 超長錯誤訊息 key（3 語言同步） | i18n（H5） |
| **附帶範圍（分批）** | `services/transform/aggregate.transform.ts`、`services/mapping/transform-executor.ts`、`services/rule-simulation.ts`、`services/impact-analysis.ts`、`services/rule-suggestion-generator.ts`、`services/system-config.service.ts`、`services/outlook-config.service.ts`、`services/outlook-document.service.ts`、`services/n8n/workflow-trigger.service.ts`、`services/processing-stats.service.ts`、`services/template-instance.service.ts` 等改用 `safe-regex` helper | Medium |
| **Python 對等防護** | `python-services/`（extraction / mapping）PY-04 — 標記，併入 WP-8 範圍評估 | Python |

> **限制（避免擴大 scope，H3）**：以硬編碼字面值 / 內部識別符建構的 regex（`variable-replacer.ts`、`term-aggregation.service.ts`、`prompt-cache.service.ts` 等）**不在**本 FIX 範圍。

---

## 測試驗證

**程式碼層面**
- [ ] `src/lib/safe-regex.ts` 新增，含 pattern 限長（`MAX_REGEX_PATTERN_LENGTH`）+ flags 白名單 + 語法驗證 + 逾時（方案 A）
- [ ] BUG-1（`rules/test`）、BUG-2（`rules/[id]/preview`）兩端點改用 helper，移除直接 `new RegExp(...)` 對全文執行
- [ ] `regexPatternSchema` 補 `.max()` 限長
- [ ] 前端表單提交前語法驗證 + 限長，錯誤訊息走 i18n
- [ ] `npm run type-check`：`src/` 零錯誤
- [ ] `npm run lint`：本批檔案無 error
- [ ] `npm run i18n:check`：新增 key 3 語言同步通過

**功能 / 安全行為（待 staging 驗證）**
- [ ] 提交惡意 pattern `(a+)+$` + 長文本 → 在逾時上限內返回（408/422），事件迴圈不被阻塞（並發其他請求正常）
- [ ] 提交超長 pattern（> 上限）→ 回 400 RFC 7807
- [ ] 提交語法錯誤 pattern → 回 400 RFC 7807（前端亦先攔截）
- [ ] 提交正常合法 pattern → 行為與修復前一致（正確回傳匹配結果，無迴歸）
- [ ] 前端輸入語法錯誤 / 超長 → 送出前即顯示 i18n 錯誤訊息

**單元測試（Goal-Driven）**
- [ ] 為 `safe-regex.ts` 寫測試：(a) 惡意 pattern 在逾時內中止；(b) 超長 pattern 被拒；(c) 合法 pattern 正確執行；(d) flags 白名單外被拒

---

## 待用戶決策事項

1. **方案 A vs B**：是否採預設方案 A（限長 + worker timeout，無新依賴）？或需要方案 B（RE2，**觸發 H2 需 approve 新增 `re2` 依賴** + 既有規則語法相容性盤點）？
2. **逾時上限值**：`safeRegex` 執行逾時建議值（例如 100ms / 500ms）— 需權衡正常複雜 regex 的合理執行時間 vs DoS 防護。
3. **附帶 Medium 範圍批次**：是否本 FIX 一併處理服務層 11+ 處，或先只修 BUG-1/BUG-2 兩個 High、其餘另開後續 FIX？
4. **Python 對等防護（PY-04）**：是否併入 WP-8（Python 服務）一起處理，或於本 FIX 同步？

---

*文件建立日期: 2026-06-10*
*最後更新: 2026-06-10*
