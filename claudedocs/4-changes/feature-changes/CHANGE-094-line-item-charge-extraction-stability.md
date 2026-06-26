# CHANGE-094: 費用明細提取穩定性 — line item 費用確定性回填 field definition key

> **日期**: 2026-06-26
> **狀態**: ⏳ 待實作（方案待決策，見 §設計決策）
> **優先級**: High（直接影響費用提取準確率與 template instance 映射可靠性，關乎 90-95% 準確率目標）
> **類型**: Feature（提取可靠性增強）
> **影響範圍**: V3.1 Stage 3 欄位提取（`stage-3-extraction.service.ts`）+ Template Instance 費用映射（`template-matching-engine.service.ts`）
> **Epic 範圍**: Epic 15（三階段提取）+ Epic 19（資料模板匹配）

---

## 變更背景

使用者測試 CEVA 出口文件的 Template Instance 費用映射時，發現 6 份文件中 5 份費用映射成功、1 份（`CEVA_CEX250440_52240.pdf`）所有費用欄位皆空。深入調查確認這**不是該文件特殊，而是費用提取機制本身不穩定**。

### 費用映射的現行機制

1. Field Definition Set（COMPANY 級）定義費用欄位，例如 `origin_document_processing_fee`、`origin_thc_terminal_handling_charge`、`sealing_charge`、`solas_vgm_management_fee`（`fieldType: lineItem`、`category: charges`）。
2. Stage 3 GPT 輸出含兩個**獨立**區塊（`stage-3-extraction.service.ts:883-919`）：
   - `fields`：用 field def 的 key 填值（`origin_document_processing_fee: { value, confidence }`）
   - `lineItems`：自由的 `description` + `category`（→ 後處理 `normalizeClassifiedAs` 得 `classifiedAs`）
3. Template Field Mapping 的 sourceField 用 **field def 的 key**（`origin_xxx`），`transformFields` 從 `ExtractionResult.fieldMappings`（即 GPT 的 `fields`）取值。
4. 因此費用要映射成功，**必須 GPT 把費用填進 `fields` 對應 key**。

### 根本問題：GPT 對「fields vs lineItems」判斷不穩定（非確定性）

關鍵證據——同一份文件 `CEVA LOGISTICS_CEX240464_39613.pdf` 連續 3 次重新處理：

| 提取時間 | `fields` 費用 key |
|----------|------------------|
| 09:49 | **有 3 個**（`sealing_charge`、`origin_document_processing_fee`、`origin_thc_terminal_handling_charge`）|
| 10:56 | 空 |
| 11:18 | 空 |

`CEVA_CEX250440_52240.pdf`：4 次提取，`fields` **全部空**（費用只進了 `lineItems`）。

即「同文件、同 prompt、同 field def set，每次結果不同」。CEX240464 只是碰巧有一次（09:49）填了 `fields` 且該筆被 instance 取用而「看似成功」；CEX250440 只是 4 次都沒填。

### 為何不穩定（prompt / 設計層）

1. Stage 3 prompt 的 `fields` 與 `lineItems` 是兩個各自獨立的輸出區塊，**完全沒有指示要求「把 line item 費用對應回填進 fields 的 field def key」**。
2. 費用 key 本質是 `fieldType: lineItem`（明細行：筆數不定、名稱多樣），卻被當「固定欄位」要 GPT 在 `fields` 填——與費用本質衝突。
3. GPT 面對「這筆 `Documentation at Origin` 該填 `origin_document_processing_fee` 還是只放 lineItems」無穩定規則，於是時填時不填。
4. 與既有已知問題同源：`classifiedAs` 跨文件不一致（`Documentation` vs `Documentation Fee` vs `Origin Document Processing Fee`），GPT 對費用分類本身就不確定。

---

## 變更內容

目標：讓「費用明細 → 標準 field def key」的對應從「靠 GPT 自由發揮」變成「有明確規則約束」，使費用映射穩定可重現。

提出三個候選方案（擇一或組合，待決策）：

### 方案 A — Prompt 強化（要求 line item 回填 fields）
在 Stage 3 prompt 明確要求：「每個 line item 的費用，若匹配到某個 field def key（依 label / aliases / hints），**必須同時**把該金額回填進 `fields` 對應 key」，並在 prompt 內附 `classifiedAs/label → key` 對照提示。
- 成本：低（僅改 prompt 組裝）。
- 缺點：**仍依賴 GPT 遵從**，無法 100% 消除非確定性。

### 方案 B — 後處理確定性回填（推薦）
在 Stage 3 解析後（`parseAndValidate` 之後）新增**確定性**步驟：用 field def 的 `aliases` / `classifiedAs` 對照表，把 `lineItems` 的金額**程式化**回填進 `fields` 對應 key（GPT 沒填時補上）。
- 成本：中（新增後處理 + field def 需提供 alias 對照）。
- 優點：**不依賴 GPT 第二次判斷**，同 lineItems 必得同結果，最穩定。
- 前提：需要 `classifiedAs/別名 → field def key` 的對照來源（可由 field def 的 `aliases` 欄位提供，或新增對照設定）。

### 方案 C — 改映射來源用 `li_{classifiedAs}`
Template Field Mapping 的 sourceField 改用 `li_{classifiedAs}_total`（`extractMappedFields` 已展平），不經 `fields`。
- 成本：中（需改既有 mapping 規則 + UI 引導）。
- 缺點：`classifiedAs` 跨文件不一致（含空格/大小寫敏感），**需先用別名對照穩定 classifiedAs**，否則只是把不穩定從 fields 移到 li_。

> **建議**：以**方案 B 為主**（確定性回填，根治），**方案 A 為輔**（順手強化 prompt，提高 GPT 第一次就填對的機率）。方案 C 不單獨採用（未解決 classifiedAs 不穩定）。

---

## 技術設計

### 修改範圍（以方案 B + A 為例）

| 文件 | 類型 | 變更內容 |
|------|------|----------|
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 🔧 修改 | (A) prompt 加「line item 回填 fields」指示 + 對照提示；(B) `parseAndValidate` 後新增確定性回填：依 alias 對照把 lineItems 金額補進 `fields` 空缺 key |
| `src/services/extraction-v3/utils/classify-normalizer.ts` | 🔧 修改/參考 | 提供 / 擴充 `classifiedAs → field def key` 正規化對照（CHANGE-046 基礎上） |
| `src/types/...`（FieldDefinitionEntry） | 🔧 確認 | 確認 `aliases` 欄位足以承載「費用別名 → key」對照；不足則評估擴充 |
| `prisma/schema.prisma`（FieldDefinitionSet） | ⚠️ 評估 | 若需新增結構化對照欄位才動（純加 nullable，向後相容）；優先複用既有 `aliases` |

### 不在本次範圍
- Template Field Mapping 既有規則的批次改寫（若採方案 C 才需要，目前不採）。
- classifiedAs 顯示層 / Combobox（CHANGE-046 已處理）。

### 資料庫影響
優先以既有 `FieldDefinitionEntry.aliases`（JSON）承載對照，**避免 schema 變更**；若確需新欄位則僅加 nullable 欄位（向後相容，需 migration + dry-run）。

---

## 設計決策（待用戶確認）

1. **採哪個方案** — 建議 B 為主 + A 為輔（見上）。**待用戶拍板**。
2. **對照來源** — `classifiedAs/別名 → field def key` 用既有 `aliases` 還是新增結構化設定？建議先用 `aliases`。
3. **回填衝突策略** — 若 GPT 已填某 key 且 lineItems 也有對應，以何者為準？建議「GPT 已填值優先，僅補空缺」。
4. **多筆同類費用** — 同一 field def key 對應多筆 lineItems 時加總或取首筆？建議加總（對齊 `li_*_total` 既有語意）。

> 屬 Open Question，實作前需 resolve（記入 `docs/open-questions.md`）。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 確定性回填 | 同一文件（同 lineItems）連續多次重新處理，`fields` 費用 key **每次一致** | High |
| 2 | CEX250440 修復 | `CEVA_CEX250440_52240.pdf` 重新處理後，`fields` 含對應費用 key，Template Instance 費用欄位有值 | High |
| 3 | 無回歸 | 既有 5 份成功文件重新處理後費用映射仍正確 | High |
| 4 | GPT 已填值不被覆蓋 | GPT 已正確填入 `fields` 的值，不被回填邏輯錯誤覆蓋 | Medium |

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 非確定性消除 | CEX250440 重新處理 3 次 | 3 次 `fields` 費用 key 與金額一致、非空 |
| 2 | Template 映射 | 重處理後加入 Template Instance 執行 | `document_fee`/`thc`/`seal_fee` 等有值 |
| 3 | 別名對照 | 文件費用名為 `Documentation at Origin` | 正確回填 `origin_document_processing_fee` |

---

## 相關背景

| CHANGE | 關聯 |
|--------|------|
| CHANGE-042 | Field Definition 動態提取（fields 來源）|
| CHANGE-043 | lineItems pivot 展平 `li_*`（li_ 來源）|
| CHANGE-044 | lineItem hybrid dual-mode |
| CHANGE-045 | Field Definition type + dynamic line items |
| CHANGE-046 | classifiedAs 正規化（normalize-classifier 基礎）|

> 本 CHANGE 是 CEVA Template Instance 測試串的延伸：前序已處理「公司重複」（mergeCompanies）、「field def 未生效需重處理」、FIX-092「referenceNumberMatch 未持久化」。本案處理最後一個——費用明細提取的非確定性。

---

*文件建立日期: 2026-06-26*
*最後更新: 2026-06-26*
