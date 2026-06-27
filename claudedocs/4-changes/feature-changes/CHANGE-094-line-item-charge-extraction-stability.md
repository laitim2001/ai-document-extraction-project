# CHANGE-094: 費用明細提取穩定性 — line item 費用確定性回填 field definition key

> **日期**: 2026-06-26（實作 2026-06-27）
> **狀態**: ✅ 已完成（方案 B 為主 + A 為輔，2026-06-27 用戶拍板並實作）
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

## 設計決策（✅ 已 resolve，2026-06-27）

1. **採哪個方案** — ✅ **B 為主 + A 為輔**（用戶 2026-06-27 拍板）。
2. **對照來源** — ✅ 用既有 `aliases`（不新增結構化設定、不動 schema）。對照 = lineItem `classifiedAs` 對 field def `label` + `aliases`，經 `canonicalizeLabel` 正規化後做「相等 / 詞邊界子字串」比對。
3. **回填衝突策略** — ✅ **GPT 已填值優先，僅補空缺**（`fields[key]` 已有有效值則不覆蓋）。
4. **多筆同類費用** — ✅ **加總**（同一 key 對應多筆 lineItem 時金額相加，對齊 `li_*_total` 語意）。

### ⚠️ 實作中的關鍵發現（影響覆蓋率，需用戶知悉）

調查 CEVA field def set（`f13aaf3b`，15 個欄位）+ 實際提取結果後確認：

1. **CEVA 15 個費用欄位的 `aliases` 全部為空 `[]`**。故方案 B 第一版只能靠 `label` 精確 / 子字串對照，覆蓋有限。
2. **GPT 本身有強語意對照能力但不穩定**。CEX240464 09:49「成功那次」證據：`Documentation Fee`→`origin_document_processing_fee`、`Handling And Processing`→`origin_thc_terminal_handling_charge`（純字串完全匹配不到，是 GPT 語意對到），但同文件 10:56 / 11:18 GPT 又不填 → 這正是**方案 A（prompt 強制回填）才是覆蓋主力**的原因，B 是確定性安全兜底。
3. **歧義保護導致部分跳過（刻意，安全優先）**。`classifiedAs` 經 `normalizeClassifiedAs` 後丟失方位資訊（`Terminal Handling Charge at Origin` → `Terminal Handling Charge`），同時是 `Origin THC` 與 `Destination THC` 兩個 label 的子字串 → 視為歧義**跳過不填**（寧可不填、不可填錯）。

實測 CEX250440 三筆 lineItem 經方案 B 程式回填的裁決：

| classifiedAs | 裁決 | 回填 |
|---|---|---|
| `Sealing Charge` | 1 exact（`sealing_charge`）| ✅ 回填 |
| `Terminal Handling Charge` | 2 substring（origin+destination THC）→ 歧義 | ⏭️ 跳過 |
| `Documentation Fee` | 無匹配（`documentation`≠`document`）| ⏭️ 跳過（需 alias）|

→ **要讓方案 B 達到高覆蓋，需在 CEVA field def 補 `aliases`**（屬資料維護，不在本次 code 改動 scope）。建議補充清單見 §後續建議。

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

## 實作摘要（2026-06-27）

### 修改的檔案

| 檔案 | 類型 | 變更內容 |
|------|------|----------|
| `src/services/extraction-v3/utils/classify-normalizer.ts` | 🔧 修改 | 新增對照純函數：`canonicalizeLabel`（小寫去標點正規化）、`matchLabel`（回傳 `'exact' \| 'substring' \| null`，子字串需詞邊界 + ≥8 字元 + ≥2 詞避免短詞誤命中）、type `LabelMatchKind` |
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 🔧 修改 | **(B)** 新增 `backfillLineItemCharges()` + `hasFieldValue()`，在 `parseExtractionResult` 後（`extract` 主流程 step 4b）就地回填 `parsed.fields`；**(A)** `buildFieldDefinitionsSection()` 加「強制 line item 回填」指示 + 費用 field key 對照清單（`chargeFields`）|

### 核心邏輯（方案 B）

1. 僅針對 `fieldType === 'lineItem'` 的費用欄位。
2. 對每個 lineItem 的 `classifiedAs`，比對所有費用 def 的 `label` + `aliases`，分類為 exact / substring 命中。
3. **唯一性裁決**：恰 1 個 exact → 採用；無 exact 且恰 1 個 substring → 採用；多個命中（歧義）→ 跳過。
4. **GPT 優先**：`fields[key]` 已有有效值則不覆蓋（`null` / `''` / 未填視為空缺）。
5. **多筆加總**：同一 key 多筆 lineItem 金額相加，寫入 `{ value, confidence: 85, source: 'lineItem-backfill' }`。

### 驗證

- ✅ `npm run type-check` 通過（`tsc --noEmit` 無錯誤）
- ✅ `npm run lint` 改動 2 檔 0 error（既有 console / unused `index` warning 非本次引入）
- ✅ 離線對照裁決驗證（真實 CEVA 15 def + CEX250440/CEX240464 lineItems）符合預期：安全、確定性、不誤填
- ⏳ 待用戶重新處理文件做端到端驗證（見 §測試場景）

---

## 後續建議（補 aliases 以提升方案 B 覆蓋率，屬資料維護）

CEVA field def 的 `aliases` 全空，致方案 B 程式回填覆蓋有限。建議在 CEVA「自訂費用欄位集」（`f13aaf3b`）為 **origin 系列**補充常見 `classifiedAs` 變體（出口文件均為 origin，避免與 destination 歧義）：

| field key | 建議補充 aliases |
|---|---|
| `origin_document_processing_fee` | `Documentation Fee`、`Documentation at Origin`、`Document Processing Fee` |
| `origin_thc_terminal_handling_charge` | `Terminal Handling Charge`、`Handling And Processing`、`Origin Terminal Handling Charge` |
| `sealing_charge` | （已 exact 命中，可不補）`Seal Fee` |

> ⚠️ **勿**對 `destination_*` 系列補與 origin 重疊的裸 alias（如裸 `Terminal Handling Charge`），否則 origin/destination 會再度歧義跳過。
> 補 aliases 後，方案 B 即可確定性命中上述費用；在此之前主要依賴方案 A（prompt 強制 GPT 回填）。

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
