# 安全審查報告 — Services Mapping / Rule-Inference / Similarity / Transform / Prompt

> 審查日期：2026-06-10 | Scope：scopes/services-mapping.txt | Agent：services-mapping 並行審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/services/mapping/config-resolver.ts | 301 | ✅ |
| 2 | src/services/mapping/dynamic-mapping.service.ts | 398 | ✅ |
| 3 | src/services/mapping/field-mapping-engine.ts | 254 | ✅ |
| 4 | src/services/mapping/index.ts | 119 | ✅ |
| 5 | src/services/mapping/mapping-cache.ts | 347 | ✅ |
| 6 | src/services/mapping/source-field.service.ts | 455 | ✅ |
| 7 | src/services/mapping/transform-executor.ts | 349 | ✅ |
| 8 | src/services/prompt/identification-rules-prompt-builder.ts | 179 | ✅ |
| 9 | src/services/prompt/index.ts | 11 | ✅ |
| 10 | src/services/rule-inference/index.ts | 177 | ✅ |
| 11 | src/services/rule-inference/keyword-inferrer.ts | 359 | ✅ |
| 12 | src/services/rule-inference/position-inferrer.ts | 318 | ✅ |
| 13 | src/services/rule-inference/regex-inferrer.ts | 273 | ✅ |
| 14 | src/services/similarity/date-similarity.ts | 363 | ✅ |
| 15 | src/services/similarity/index.ts | 39 | ✅ |
| 16 | src/services/similarity/levenshtein.ts | 212 | ✅ |
| 17 | src/services/similarity/numeric-similarity.ts | 282 | ✅ |
| 18 | src/services/transform/aggregate.transform.ts | 262 | ✅ |
| 19 | src/services/transform/concat.transform.ts | 128 | ✅ |
| 20 | src/services/transform/direct.transform.ts | 87 | ✅ |
| 21 | src/services/transform/formula.transform.ts | 215 | ✅ |
| 22 | src/services/transform/index.ts | 59 | ✅ |
| 23 | src/services/transform/lookup.transform.ts | 148 | ✅ |
| 24 | src/services/transform/split.transform.ts | 139 | ✅ |
| 25 | src/services/transform/transform-executor.ts | 267 | ✅ |
| 26 | src/services/transform/types.ts | 153 | ✅ |

全部 26 檔案逐行完整讀取。本目錄全為服務層（純函數 / 類別），無 API route、無資料庫 raw query、無認證邏輯、無檔案上傳/下載處理，因此維度 A（認證）、B（SQL/command injection）、D（secrets）、G（SSRF）、H（檔案處理）、I（認證機制）大致不適用，重點集中於 B（regex / 表達式執行）、C（輸入驗證）、E（日誌）、K（ReDoS / DoS / 不安全求值）。

---

## 2. 發現

### [High] TRANSFORM-01 FORMULA 轉換使用 `Function()` 動態求值（已有白名單緩解，但屬深度防禦關注點）

- **檔案**：src/services/transform/formula.transform.ts:155
- **類別**：B（注入）、K（不安全求值）
- **描述**：
  FORMULA 轉換器透過 `Function("use strict"; return (...))()` 動態求值使用者定義的公式。雖然已有白名單 `SAFE_FORMULA_PATTERN = /^[\d\s\+\-\*\/\.\(\)]+$/`（第 35 行）在求值前過濾字元，且變數佔位符 `{field_name}` 在替換時一律經 `Number()` 轉為純數字（第 110-127 行，非數字 → '0'），使得目前無法注入任意 JavaScript。此判定為「目前安全，但實現方式脆弱」：
  1. 防護完全依賴單一正則白名單。若未來有人放寬該正則（例如為支援 `Math.round`、`%`、字母函數名）而未同步重新評估，立即退化為 RCE。
  2. `Function()` 求值在 Node.js 伺服器端執行，一旦白名單被繞過即為伺服器端任意代碼執行。
  3. 白名單允許的字元組合仍可造成資源消耗（例如極長的連乘 `9*9*9*...`，但有 Zod `max(500)` 上限，影響有限）。
- **證據**：
  ```ts
  // formula.transform.ts:143-155
  if (!SAFE_FORMULA_PATTERN.test(cleanExpr)) {
    throw new Error(`公式包含不允許的字符: ${expression}`);
  }
  ...
  const result = Function(`"use strict"; return (${cleanExpr})`)() as number;
  ```
- **建議**：
  1. 維持並在 code comment 中明確標註：「`SAFE_FORMULA_PATTERN` 是唯一安全屏障，任何放寬都必須重新做安全評估」。
  2. 中長期可考慮改用不含 `Function`/`eval` 的安全運算式求值器（例如自寫 shunting-yard 解析器，僅支援 `+ - * / ( )`），徹底移除動態代碼求值面。
  3. 確認 `transformParams.formula` 在所有寫入路徑都經過 `formulaTransformParamsSchema`（已驗證存在 `max(500)`，但 Zod 未檢查字元集，求值前的白名單是實際屏障）。

### [Medium] TRANSFORM-02 AGGREGATE `descriptionPattern` 以使用者正則執行，存在 ReDoS 風險

- **檔案**：src/services/transform/aggregate.transform.ts:209
- **類別**：K（ReDoS / DoS）
- **描述**：
  `filterItems()` 直接用使用者提供的 `filter.descriptionPattern` 建立 `new RegExp(filter.descriptionPattern, 'i')` 並對每個 lineItem 的 `description` 執行 `regex.test()`。`try/catch` 只攔截「無效正則」語法錯誤（第 211 行），無法防止「語法有效但具災難性回溯」的惡意正則（如 `(a+)+$`）。對應的 Zod schema（src/validations/template-field-mapping.ts:92）僅限制 `descriptionPattern` 長度 `max(200)`，未檢查正則安全性。攻擊 / 誤用條件：能建立 / 編輯模板欄位映射規則的使用者（通常為已登入的管理 / 設定角色），可寫入一個 catastrophic-backtracking 正則，後續每次套用該轉換（批次處理大量文件時）都會在伺服器端造成單執行緒 CPU 阻塞。
- **證據**：
  ```ts
  // aggregate.transform.ts:206-214
  if (filter.descriptionPattern) {
    try {
      const regex = new RegExp(filter.descriptionPattern, 'i');
      if (!regex.test(item.description)) return false;
    } catch {
      // 無效正則，跳過此過濾條件
    }
  }
  ```
- **建議**：
  1. 對 `descriptionPattern` 改用安全正則執行（如限制執行時間，或以 RE2 類型安全引擎；或在建立規則時用 ReDoS 偵測 lint）。
  2. 在 Zod schema 對 `descriptionPattern` 增加結構限制（例如禁止嵌套量詞）或降低 `max` 至更小值。
  3. 由於此模式由內部設定角色填入，風險屬 Medium；若該設定面未來開放給較低權限使用者，應升級為 High。

### [Low] TRANSFORM-03 AGGREGATE `MAX`/`MIN` 對空陣列回傳 ±Infinity（資料正確性 / 邊界）

- **檔案**：src/services/transform/aggregate.transform.ts:240-243
- **類別**：K（邊界 / 資料一致性）
- **描述**：
  `aggregate()` 在 `filtered.length === 0` 時已於 execute() 提前回傳 `defaultValue ?? null`（第 96-98 行），但若 `filtered` 非空而所有 `item[field]` 皆非數字，`values` 仍會是 `[0,0,...]`，`Math.max(...values)` 正常；真正問題在於若上游邏輯改動使 `aggregate` 在空陣列被呼叫，`Math.max()` / `Math.min()` 對空陣列回傳 `-Infinity` / `Infinity`。目前由 execute() 的提前返回保護，屬理論性風險。
- **證據**：
  ```ts
  case 'MAX': return Math.max(...values);
  case 'MIN': return Math.min(...values);
  ```
- **建議**：在 `aggregate()` 內對 `values.length === 0` 做防禦性檢查回傳 `0`，避免未來呼叫路徑改動時洩漏 `Infinity` 到下游欄位。

### [Low] SIMILARITY-01 `levenshteinDistance` 無輸入長度上限，O(m×n) 記憶體 / CPU 放大

- **檔案**：src/services/similarity/levenshtein.ts:42-75
- **類別**：K（DoS）
- **描述**：
  `levenshteinDistance` 配置完整 `(m+1)×(n+1)` 的二維 DP 陣列，無長度上限。若兩個輸入字串都很長（例如各 10 萬字元），記憶體與 CPU 會放大到不可接受（~10^10 cell）。本服務用於規則測試 / 修正樣本相似度比較，輸入通常為短欄位值，故實際風險低；但若被用於比較任意大文字（如整份 OCR 文字），可造成記憶體耗盡。`calculateSimilarityWithThreshold` 有「長度差過大提前返回」優化，但對「兩者都長且相近」無保護。
- **證據**：
  ```ts
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  ```
- **建議**：在 `levenshteinDistance` / `levenshteinSimilarity` 入口加入合理的長度上限（如 > 2000 字元時改用較廉價的近似或直接回傳 0），作為深度防禦。

### [Info] TRANSFORM-04 CUSTOM 轉換已停用，但型別與驗證 schema 仍保留

- **檔案**：src/services/transform/transform-executor.ts:93、src/services/transform/types.ts:5
- **類別**：K（觀察）
- **描述**：
  transform 目錄的 `TransformExecutor` 建構子明確註解「CUSTOM 轉換器因安全考量暫不啟用」（第 93 行），未註冊 CUSTOM handler，呼叫 CUSTOM 會拋「不支援的轉換類型」。這是良好的安全決策。需注意的是 mapping 目錄另有一個獨立的 `transform-executor.ts`（CUSTOM 啟用，見 MAPPING-01），兩者命名相同但行為不同，易混淆。
- **建議**：無需立即處理；建議文件 / 命名上區分兩個 transform-executor 以避免誤用。

### [Info] MAPPING-01 mapping 目錄 CUSTOM 策略以 `String.replace` 實作，無 eval（安全確認）

- **檔案**：src/services/mapping/transform-executor.ts:142-193
- **類別**：B（注入 — 確認無風險）
- **描述**：
  此處的 `CustomStrategy` 只做 `${fieldName}` / `${index}` 的字串替換（`result.replace(...)`），不執行任何動態代碼，且替換用的正則對 `field` 經 `escapeRegex()`（第 190-192 行）轉義，無正則注入。與 transform/formula.transform.ts 的 `Function()` 路徑不同，此 CUSTOM 安全。記錄此項以澄清「mapping 的 CUSTOM」與「transform 的 FORMULA/CUSTOM」是兩套不同機制。
- **建議**：無。

### [Info] RULE-INFERENCE-01 推斷器生成的 regex pattern 由下游服務以 `new RegExp` 執行

- **檔案**：src/services/rule-inference/regex-inferrer.ts:227-271、src/services/rule-inference/keyword-inferrer.ts:319-348
- **類別**：K（ReDoS — 上游確認）
- **描述**：
  推斷器本身不執行使用者正則，僅由「修正值的字元結構」推斷並輸出 regex 字串（`regex.source` 或 JSON 字串）。`inferGenericPattern` 由字元類別生成 `[A-Z]{n}` / `\d{n}` / `.` 結構（第 258-262 行），`findExtractionPattern` 生成含 lookbehind/lookahead 的 pattern（第 344 行），且邊界字元已 `escapeRegex()`。這些生成的 pattern 本身結構簡單、無嵌套量詞，ReDoS 風險低。
  交叉確認（輔助）：這些 `pattern` 字串會被 scope 外的 src/services/impact-analysis.ts、src/services/rule-simulation.ts、src/services/rule-suggestion-generator.ts 用 `new RegExp(rule.pattern)` 對文字執行。由於 pattern 也可能來自使用者手填的規則（非僅推斷器生成），那些下游執行點才是真正的 ReDoS 評估對象 — 已超出本 scope，建議由負責 impact-analysis / rule-simulation 的審查 agent 評估。
- **建議**：在本 scope 內無需修改；提示主 session 確認 impact-analysis.ts / rule-simulation.ts / rule-suggestion-generator.ts 的 `new RegExp(rule.pattern)` 是否在另一 scope 被審查。

### [Info] GENERAL-01 服務層使用 `console.error`/`console.log` 而非統一 logger（與已知系統性缺口一致）

- **檔案**：dynamic-mapping.service.ts:129,153,165,208,210、field-mapping-engine.ts:227、mapping/transform-executor.ts:260
- **類別**：E（PII / 日誌）
- **描述**：
  多處使用 `console.error` / `console.log` 輸出錯誤與快取失效訊息。檢查所記錄內容：記錄的是 rule.id、scope、context（companyId / documentFormatId）、error message，**未發現記錄 email / token / 密碼 / 完整文件內容等 PII**。`context` 物件理論上可能含 companyId / documentFormatId（內部 ID，非 PII）。屬於既知「console.log 約 279 處」系統性技術債的一部分，非新增風險。
- **建議**：依專案既有計畫漸進替換為 logger；確保未來不要把 `extractedFields` 的實際值（可能含發票上的個資 / 商業敏感資料）直接 console 輸出。目前 dynamic-mapping.service.ts:208 的 `preloadConfigs` 記錄整個 `context` 物件，建議只記錄 ID 欄位。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 1 | 1 | 2 | 4 |

---

## 4. 區域整體觀察

1. **整體安全姿態良好**：此區域全為純運算 / 資料轉換服務，無認證、無 raw SQL、無檔案 I/O、無外部網路呼叫、無 secrets。輸入驗證主要委派給上層 Zod schema（`template-field-mapping.ts` 驗證 transformParams），服務層本身亦有 `validateParams()` 防禦。

2. **唯一的動態代碼求值點**集中在 transform/formula.transform.ts 的 `Function()`，目前由字元白名單與 `Number()` 強制轉型雙重保護而安全；最大風險在於「白名單是唯一屏障」這個脆弱前提（TRANSFORM-01 High）。建議將此標註為高度敏感、改動需重新評估的代碼。

3. **唯一的使用者正則執行點**在 transform/aggregate.transform.ts:209 的 `descriptionPattern`，缺乏 ReDoS 防護（TRANSFORM-02 Medium）。風險受限於「只有設定角色能寫入規則」，但若該面開放或被低權限濫用會升級。

4. **CUSTOM 表達式機制在 transform 目錄已主動停用**（安全決策正確），mapping 目錄的同名 CUSTOM 則以安全的字串替換實作。兩個同名 `transform-executor.ts` 行為不同，是維護混淆點而非安全漏洞。

5. **日誌**：本區域 `console.*` 用法未洩漏 PII，但 `preloadConfigs` 記錄整個 context 物件、且整體仍屬「console.log 系統性技術債」範圍，建議納入既有漸進清理。

6. **無回歸**：未發現 FIX-050（PII console.log）/ FIX-051（SQL injection）相關回歸 — 本區域不涉及 auth.config.ts 或 raw SQL。
