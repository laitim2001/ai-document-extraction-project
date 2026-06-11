# FIX-072: 審計來源偽造（exchange-rates createdById='system'）+ FORMULA 表達式求值加固

> **狀態**: ✅ 已完成（2026-06-11）
> **建立日期**: 2026-06-10
> **發現方式**: 代碼審查（2026-06-10 全面安全審查）
> **影響頁面/功能**: `/api/v1/exchange-rates`、`/api/v1/exchange-rates/import`、`src/services/transform/formula.transform.ts`（FORMULA 轉換）
> **優先級**: 高
> **來源**: SECURITY-ASSESSMENT.md §5 主題 H（審計來源偽造）、§5 主題 I（表達式求值）、REMEDIATION-ROADMAP.md WP-10
> **相依**: createdById 修復依賴 CHANGE-077（WP-1 認證 fail-open 修復）/ CHANGE-078（WP-2 middleware 認證閘）提供可信 session；exchange-rates 寫入端點認證與 FIX-067（v1 端點補認證）相關

---

## 問題描述

本工作包（WP-10）涵蓋兩個獨立但同屬「資料可信度與執行安全」的 High 級發現：

| # | 編號 | 主題 | 嚴重度 | 位置:行 |
|---|------|------|--------|---------|
| BUG-1 | V1-0-A-02 | 審計來源偽造：匯率建立端點寫入硬編碼 `createdById = 'system'` | High | `api/v1/exchange-rates/route.ts:105` |
| BUG-2 | V1-0-A-02 | 審計來源偽造：匯率批次導入端點寫入硬編碼 `createdById = 'system'` | High | `api/v1/exchange-rates/import/route.ts:69` |
| BUG-3 | TRANSFORM-01 | FORMULA 用 `Function()` 動態求值；目前以白名單正則緩解，但白名單一旦放寬即退化為 RCE | High | `services/transform/formula.transform.ts:155` |

### BUG-1 / BUG-2：審計來源偽造（V1-0-A-02）

`POST /api/v1/exchange-rates`（建立）與 `POST /api/v1/exchange-rates/import`（批次導入）兩個寫入端點：

1. **完全無認證**——未呼叫 `auth()`，任何人可未登入寫入匯率主檔（匯率直接影響 Epic 21 成本換算基準）。
2. **審計歸屬偽造**——寫入時硬編碼 `const createdById = 'system'`（兩處均有註解「目前使用固定的 createdById，後續整合認證後替換」，屬未完成的 TODO）。此值流入 `exchangeRate.createdById` 欄位，導致：
   - 無法歸責：任何匯率變更都記為 `'system'`，事後無法追查實際操作者。
   - 掩蓋缺認證事實：`'system'` 看似合理的系統來源，使審計記錄無法暴露「這筆其實是匿名寫入」。

> 已逐行驗證：服務層 `createExchangeRate(input, createdById)`（`exchange-rate.service.ts:378-380`）與 `importExchangeRates(input, createdById)`（`exchange-rate.service.ts:953-955`）皆已正確接收 `createdById` 參數並寫入 `exchangeRate.createdById` 欄位（`:429`、`:1029` 等）。**服務層簽章無需改動**，問題完全在路由層傳入的值。

### BUG-3：FORMULA 表達式求值（TRANSFORM-01）

`formula.transform.ts` 的 FORMULA 轉換器用於資料模板的欄位計算（如 `{sea_freight} + {terminal_handling}`）。其 `safeEval()`（`:139-169`）流程為：

1. `replaceVariables()`（`:110-127`）將 `{field_name}` 佔位符替換為實際數值——非數值/缺失值一律轉為 `'0'`，故**佔位符路徑本身不會注入任意字串**。
2. `safeEval()` 對替換後的表達式用白名單正則 `SAFE_FORMULA_PATTERN = /^[\d\s\+\-\*\/\.\(\)]+$/`（`:35`）檢查，只允許數字、空白、`+ - * / . ( )`。
3. 通過檢查後，用 `Function(\`"use strict"; return (${cleanExpr})\`)()`（`:155`）動態求值。

**目前實際是安全的**：白名單正則只允許數字與基本運算符，無法構造 `Function` 體跳脫或呼叫任意函式。**但這是「正則防線單點依賴」的脆弱設計**——`Function()` 本質是 `eval` 的近親（`@typescript-eslint/no-implied-eval` 已被 `eslint-disable` 抑制）。風險在於：

- 任何未來對白名單的「順手放寬」（例如為支援 `Math.round`、`%`、`,`、科學記號 `e`、字母變數）都會直接打開 RCE 缺口，且 code review 不一定能察覺正則與 `Function()` 的危險耦合。
- 公式來源為資料模板配置（`FormulaTransformParams.formula`），屬使用者/管理者可編輯內容，攻擊面真實存在。

---

## 重現步驟

### BUG-1（審計偽造 + 無認證）
1. 不帶任何認證，`POST /api/v1/exchange-rates`，body 帶合法匯率（`fromCurrency` / `toCurrency` / `rate` / `effectiveYear`）。
2. 觀察現象：回 201 成功建立（預期應為 401）；查該筆記錄 `createdById === 'system'`（預期應為實際操作者 ID）。

### BUG-3（表達式求值脆弱性 — 概念驗證）
1. 現況：以 `formula: '{a} * {b}'` 等合法公式正常運作，惡意字串（如含字母）會被白名單擋下拋出「公式包含不允許的字符」。
2. 風險點驗證：若有人將 `SAFE_FORMULA_PATTERN` 放寬以支援額外語法，`Function()` 即可被注入任意 JS。本 FIX 旨在從架構上移除此單點依賴，而非等待誤改後補救。

---

## 根本原因

| 發現 | 根本原因 |
|------|----------|
| BUG-1 / BUG-2 | 兩端點為 Epic 21 早期實作，認證整合留 TODO 未完成（`createdById = 'system'` 為 placeholder），且路由層從未呼叫 `auth()`。匯率寫入屬高敏感操作卻無認證閘與真實審計歸屬。 |
| BUG-3 | FORMULA 設計選用 `Function()` 動態求值，安全性完全寄託於單一白名單正則。`Function()` 與白名單之間缺乏結構性隔離，屬「一改即破」的脆弱緩解，非縱深防禦。 |

---

## 解決方案

本 FIX 分兩部分，彼此獨立、可並行實作。

### 第一部分：審計歸屬修復（BUG-1 / BUG-2）

> **範本一致性**：本修復沿用 FIX-064（`cost/pricing` 移除 `changedBy='system-admin'` 改用 `session.user.id`）的同類做法，保持全專案審計歸屬修復一致。

1. **補認證**：`exchange-rates/route.ts` POST 與 `exchange-rates/import/route.ts` POST 補 `auth()`；未登入回 401（RFC 7807 top-level 格式）。匯率主檔屬高敏感，建議要求 admin 或對應寫入權限（沿用既有 `hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)`，與 FIX-063/064 一致，避免另造 `requireAdmin` 輪子）；無權限回 403。
2. **改用真實 session user**：移除兩處硬編碼 `const createdById = 'system'`，改為 `const createdById = session.user.id`。服務層簽章不變，僅替換傳入值。
3. **同步移除誤導性註解**：刪除「目前使用固定的 createdById，後續整合認證後替換」TODO 註解。
4. **GET 端點**：本 FIX 聚焦寫入端的審計偽造（主題 H）。`exchange-rates` 的 GET 列表認證歸 FIX-067（v1 端點補認證）統一處理，避免與本 FIX 範圍重疊；本文件僅在「相依」標註關聯，不在此重複修改 GET。

> **相依說明**：步驟 2 的「真實 session user」前提是 `session.user.id` 可信。此可信性由 CHANGE-077（移除 auth fail-open / dev-bypass）與 CHANGE-078（middleware 認證閘）保證。建議於該兩者完成後再上線本修復，但路由層的補認證 + 改傳 `session.user.id` 邏輯本身可先行開發。

### 第二部分：FORMULA 表達式求值加固（BUG-3）

此部分需在兩個方案間抉擇，以下為對比分析。

#### 方案對比

| 維度 | 方案 A：強化現有白名單正則 | 方案 B：改用 AST 白名單解析器 |
|------|---------------------------|------------------------------|
| 做法 | 保留 `Function()`，但收緊正則（明確錨定、限制長度、禁止連續運算符與空括號）、加表達式長度上限、加括號平衡檢查 | 移除 `Function()`，改用受限算術解析器（自實作 shunting-yard / Pratt parser，或引入經審查的安全運算庫），只支援 `+ - * / ( )` 與數字，逐 token 白名單 |
| 安全性 | 中——仍保留 `Function()`，安全性仍寄託於正則，「一改即破」風險未根除 | 高——**完全消除 `Function()`/`eval`**，無論輸入如何都不可能執行任意 JS；RCE 攻擊面從架構上移除 |
| 實作成本 | 低（僅改正則 + 加幾個前置檢查，數十行） | 中（需實作或引入解析器；自實作算術解析器約 100-150 行，含測試） |
| 相依（H2 約束） | 無新依賴 | 自實作 = 無新依賴；引入第三方安全運算庫 = 觸發 H2，需 approve |
| 維護風險 | 高——未來放寬白名單仍會破防，且危險耦合不易在 review 察覺 | 低——解析器明確列舉允許的 token/運算，擴充語法時不會意外開放 `eval` |
| 對現有行為影響 | 無（僅更嚴格，合法公式不受影響） | 需確保解析器對既有合法公式（變數替換後的純算術式）輸出與現行一致；需迴歸測試 |

#### 建議方案

**建議採方案 B（AST/解析器，自實作優先）**，理由：

- TRANSFORM-01 的核心風險是「`Function()` 與白名單的危險耦合，一改即破」。方案 A 僅讓正則更嚴格，**並未移除根本風險**——`Function()` 仍在，未來任何放寬都可能重新打開 RCE。方案 B 從架構上移除 `Function()`，徹底消除攻擊面，符合 §Karpathy 守則「最少代碼解決問題」中「解決問題本身」而非「緩解症狀」的取向。
- 公式只需 `+ - * / ( )` 與數字（變數已在 `replaceVariables` 階段轉為數值），語法極簡，自實作 shunting-yard 算術解析器成本可控且**無需新依賴**（不觸發 H2）。
- 若評估後傾向引入第三方安全運算庫（如經審查的 expression evaluator），屬 H2 dependency 約束，**須 STOP 並向用戶說明後等 approve**，不可自行加套件。

> **H6 提示**：FORMULA 對外行為（接受 `{var}` 佔位符 + 基本算術，回傳數值）不改變，屬內部實作加固（bug fix / 安全強化），不偏離設計規格。但「方案 A vs 方案 B」屬實作策略決策，實作前應向用戶確認採哪個方案（本文件已附對比與建議，供拍板）。

---

## 修改的檔案

| 檔案 | 修改內容 | 對應 |
|------|----------|------|
| `src/app/api/v1/exchange-rates/route.ts` | POST 補 `auth()` + 權限檢查；移除硬編碼 `createdById = 'system'`（:105），改用 `session.user.id`；移除 TODO 註解 | BUG-1 |
| `src/app/api/v1/exchange-rates/import/route.ts` | POST 補 `auth()` + 權限檢查；移除硬編碼 `createdById = 'system'`（:69），改用 `session.user.id`；移除 TODO 註解 | BUG-2 |
| `src/services/transform/formula.transform.ts` | FORMULA 求值加固——採方案 B 則以受限算術解析器取代 `Function()`（:155）+ 移除 `eslint-disable no-implied-eval`；採方案 A 則收緊 `SAFE_FORMULA_PATTERN`（:35）+ 加長度/括號平衡前置檢查 | BUG-3 |

> 服務層 `src/services/exchange-rate.service.ts` **不需修改**（`createExchangeRate` / `importExchangeRates` 已正確接收並寫入 `createdById`）。

---

## 測試驗證

### 程式碼層面
- [x] `exchange-rates` POST 與 `import` POST：補 `auth()` + 權限檢查，401（未登入）/ 403（無權限）/ 201（有權限）分支齊備
- [x] 兩端點硬編碼 `createdById = 'system'` 已移除（grep 計數 = 0），改用 `session.user.id`
- [x] 兩處誤導性 TODO 註解已移除
- [x] FORMULA 加固：採方案 B，`Function()` 已完全移除（grep `Function(` 在該檔計數 = 0，僅餘說明性註解亦去括號）、`eslint-disable @typescript-eslint/no-implied-eval` 已移除
- [x] `npm run type-check`：本批改動檔案零錯誤
- [x] `npm run lint`：本批檔案無 warning/error

### 功能/迴歸層面
- [ ] 匯率建立：有權限使用者建立匯率後，查 `exchangeRate.createdById` 為**真實操作者 ID**（非 `'system'`）
- [ ] 匯率批次導入：導入後各筆 `createdById` 為真實操作者 ID
- [ ] FORMULA 迴歸：既有合法公式（如 `{sea_freight} + {terminal_handling}`、含括號與多級運算）計算結果與修復前一致
- [ ] FORMULA 安全：惡意公式（含字母、函式呼叫、`Function`/`eval` 片段、屬性存取）一律被拒絕並拋出明確錯誤；採方案 B 時驗證無任何路徑可執行任意 JS

### 執行期（待 staging 驗證）
- [ ] 未認證直打 `POST /api/v1/exchange-rates` → 401（驗證 CHANGE-077/078 上線後 session 可信）
- [ ] 審計記錄可正確歸責至實際操作者

---

## 實作筆記（2026-06-11）

### 採用方案
- **第一部分（BUG-1/2）**：沿用 FIX-064 同類做法 — 補 `auth()`（401）+ `hasPermission(session.user, PERMISSIONS.ADMIN_MANAGE)`（403），審計歸屬改 `session.user.id`。兩端點既有錯誤回應已是 RFC 7807 top-level，401/403 沿用同格式（match existing style）。
- **第二部分（BUG-3）**：經用戶拍板採 **方案 B（AST 解析器，自實作）**（H6 方案抉擇，approve 2026-06-11）。以受限算術解析器（`tokenizeArithmetic` → `toReversePolish` shunting-yard → `evaluateReversePolish`）取代 `Function`，完全移除 eval 路徑，無新依賴（不觸發 H2）。

### 修改檔案
| 檔案 | 改動 |
|------|------|
| `src/app/api/v1/exchange-rates/route.ts` | POST 補 auth + ADMIN_MANAGE；`createdById` 改 `session.user.id`；移除誤導性 TODO 註解 |
| `src/app/api/v1/exchange-rates/import/route.ts` | 同上（批次導入） |
| `src/services/transform/formula.transform.ts` | 新增受限算術解析器（tokenize / shunting-yard / RPN 計算）取代 `Function`；`safeEval` 求值核心替換；移除 `no-implied-eval` disable；保留 `SAFE_FORMULA_PATTERN` 作第一道快速白名單（縱深防禦） |

### 行為一致性（迴歸保證）
- 解析器支援數字、`+ - * / ( )` 與一元正負號，與原 `SAFE_FORMULA_PATTERN` 涵蓋範圍一致；既有合法公式（變數替換後純算術式）計算結果不變。
- 運算符優先級（`* /` > `+ -`）、左結合、括號、一元負號（如 `a + -b`、`-(a+b)`）行為與原 `Function` 求值一致。
- 除以零 / `0/0` 保留 JS 語義（Infinity / NaN），由 `safeEval` 尾端既有 `Number.isFinite` 檢查統一守門 → 與原行為一致（拋「計算結果無效」）。
- 科學記號（極端數值 `String()` 產生的 `1e21`）：tokenizer 視 `e` 為不允許字符而拒絕 → 與原白名單拒絕行為一致。

### 殘留風險 / 相依
- BUG-1/2 的「`session.user.id` 完全可信」前提依賴 CHANGE-077（移除 auth fail-open）/ CHANGE-078（middleware 認證閘）上線；本路由層補認證邏輯已先行完成，commit 標註 `Note: depends on CHANGE-077/078`。
- 本 FIX 聚焦兩個 High（V1-0-A-02、TRANSFORM-01）；roadmap WP-10 之 Low（EX-07、reference-numbers D-01）未展開。
- 驗證範圍：程式碼層面（type-check / lint / grep）已通過；功能迴歸與執行期 401 分支待 staging（專案目前無單元測試框架，單元測試延後）。

---

## 備註

- **本工作包對應 REMEDIATION-ROADMAP.md WP-10**，含 2 個 High（V1-0-A-02、TRANSFORM-01）+ Low（EX-07、reference-numbers D-01，本 FIX 暫不展開，聚焦兩個 High）。
- **編號說明**：本文件依任務指定為 FIX-072（WP-10）。FIX-068~071 為 WP-5~WP-9 各工作包之立案範圍（roadmap 階段 2/3），與本 FIX 並行立案、互不重疊。
- **OQ 關聯**：`createdById` 真實歸屬的可信前提（CHANGE-077/078）尚在規劃中，本 FIX 路由層補認證邏輯可獨立開發，但「`session.user.id` 完全可信」依賴上述兩者完成。Commit 時建議標註 `Note: depends on CHANGE-077/078`。

---

*文件建立日期: 2026-06-10*
*最後更新: 2026-06-10（立案規劃）*
