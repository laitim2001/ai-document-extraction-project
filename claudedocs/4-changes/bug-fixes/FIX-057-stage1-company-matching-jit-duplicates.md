# FIX-057: Stage 1 公司配對失敗導致 JIT 重複公司增生 + COMPANY 配置永不生效

> **建立日期**: 2026-05-31
> **發現方式**: Playwright E2E 測試（文件處理測試，驗證 Fairate Express PromptConfig 是否生效）
> **影響頁面/功能**: Stage 1 公司識別（`resolveCompanyId`）、V3.1 提取管線、所有公司的 COMPANY-scoped `FieldDefinitionSet` / `PromptConfig`
> **優先級**: 高
> **狀態**: ✅ 已修復（Stage 1 公司配對，2026-05-31 驗證通過）；⚠️ 修復過程發現 Stage 2 同類 sibling bug（見「後續發現」）

---

## 問題描述

在測試「為 Fairate Express 設定 COMPANY-scoped `PromptConfig`（Stage 3 條件式提取）」時發現：上傳 Fairate 發票後，Stage 3 的 GPT Prompt **完全沒有套用**該公司的 `PromptConfig` 與 `FieldDefinitionSet`，而是落回 GLOBAL 預設（中文預設 system prompt + 12 欄位通用集）。

追查後發現根因在 **Stage 1 公司識別**：文件雖然被 GPT 正確讀出發行公司為「FAIRATE EXPRESS LTD.」，但系統**沒有把它配對到既有的 Company 記錄**，反而每次都 **JIT 自動建立一間新的重複公司**（`source=AUTO_CREATED`）。新公司沒有任何 config → 後續 Stage 3 自然落回預設。

| # | 問題 | 嚴重度 | 影響範圍 |
|---|------|--------|----------|
| BUG-1 | `resolveCompanyId` Step 2 模糊配對方向相反且不查 `nameVariants`，無法配對到既有公司 | 高 | 所有公司 |
| BUG-2 | Step 1 完全依賴 GPT-5-nano 回傳 `matchedKnownCompany`，但 nano 即使候選清單含完全相同的 alias 也常不回報 | 高 | 所有公司 |
| BUG-3 | 配對失敗即 JIT 建新公司，無重複防護 → 每測一次未配對成功的公司就增生一間重複，污染候選清單 | 中 | 資料整潔 / 後續配對 |

**實質影響**：因為使用者儲存的是**短名**（`Fairate Express`、`CYTS`、`DHL Express`…），而發票上是**法定全名**（`FAIRATE EXPRESS LTD.`…），此 bug 會讓**幾乎每間公司、每份文件**都配對失敗 → COMPANY-scoped 的所有設定（`FieldDefinitionSet`、`PromptConfig`、`FieldMappingConfig`、`MappingRule` Tier 2）**永遠無法生效**。這等同癱瘓「依公司客製化提取」的核心能力。

---

## 重現步驟

1. 建立一間 Company，name 設為短名（如 `Fairate Express`），並啟用為 `ACTIVE`、掛上 COMPANY-scoped `FieldDefinitionSet` + `PromptConfig`。
2. 上傳一張該公司的發票（發票上印的是法定全名，如 `FAIRATE EXPRESS LTD.`）。
3. 觀察現象：
   - DB 多了一間 `source=AUTO_CREATED` 的重複公司（name 等於發票全名），文件 `company_id` 連到這間新公司。
   - 文件詳情的 Stage 3 GPT Prompt 是 GLOBAL 預設（中文 system prompt + 12 欄位通用集），**不是**該公司設定的 prompt / 欄位。
   - `extraction_results.stage_1_result` 顯示 `"isNewCompany": true`，且無 `matchedKnownCompany`。

**實測文件**：`ee9421b1-6bd5-42b6-a33e-e486abcc7bfe`、`e9ba60af-5d98-4889-8706-d6623dfd7d2b`（均 JIT 出「FAIRATE EXPRESS LTD.」）。

---

## 根本原因

`resolveCompanyId`（`src/services/extraction-v3/stages/stage-1-company.service.ts:376-441`）三段邏輯：

### BUG-1：Step 2 模糊配對方向相反 + 不查 nameVariants（主因）

```ts
// stage-1-company.service.ts:407-413
const fuzzyMatch = await this.prisma.company.findFirst({
  where: {
    name: { contains: parsed.companyName, mode: 'insensitive' }, // ← 方向反了
    status: 'ACTIVE',
  },
  select: { id: true, name: true },
});
```

- `parsed.companyName` = GPT 讀到的發票名（如 `FAIRATE EXPRESS LTD.`，較長）。
- 條件 `name contains parsed.companyName` 是查「**公司 name 包含發票名**」。但公司 name 是短名 `Fairate Express`，**不可能**包含更長的 `FAIRATE EXPRESS LTD.` → 永遠 miss。
- 且此查詢**完全沒有檢查 `nameVariants`** —— 即使在公司上加了變體 `FAIRATE EXPRESS LTD.`，這步也用不到。

### BUG-2：Step 1 過度依賴 GPT-5-nano 回傳 matchedKnownCompany

```ts
// stage-1-company.service.ts:385-403
if (parsed.matchedKnownCompany) {
  const company = await this.prisma.company.findFirst({
    where: {
      OR: [
        { name: parsed.matchedKnownCompany },
        { nameVariants: { has: parsed.matchedKnownCompany } },
      ],
      status: 'ACTIVE',
    },
    ...
  });
  ...
}
```

- `loadKnownCompanies`（`stage-orchestrator.service.ts:351-356`）已正確把 `nameVariants` 當 aliases 餵給 GPT（`aliases: c.nameVariants || []`），Stage 1 prompt 也有列出 `- 公司名 (Aliases: ...)` 並要求回傳 `matchedKnownCompany`。
- **但** GPT-5-nano 即使看到完全相同的 alias，實測仍常常不回報 `matchedKnownCompany`（stage_1_result 無此欄位）→ Step 1 直接被跳過，全靠壞掉的 Step 2 後備。

### BUG-3：JIT 無重複防護

```ts
// stage-1-company.service.ts:424-434
if (options?.autoCreateCompany !== false && parsed.companyName) {
  const newCompany = await this.jitCreateCompany(parsed.companyName, options?.cityCode);
  ...
}
```

- 配對失敗即建新公司，且不檢查是否已有 name/變體高度相似的 PENDING/既有公司 → 重複增生。

---

## 解決方案

### BUG-1 修復（核心）：Step 2 後備配對改為查 nameVariants + 雙向/正規化比對

把 Step 2 改為**也**用 `parsed.companyName` 比對 `nameVariants`（精確變體），並修正 name 比對方向（雙向 contains 或正規化後相等）：

```ts
// 後備配對（修正後示意）
const candidate = parsed.companyName;
const fuzzyMatch = await this.prisma.company.findFirst({
  where: {
    status: 'ACTIVE',
    OR: [
      { nameVariants: { has: candidate } },                 // 精確變體（新增）
      { name: { equals: candidate, mode: 'insensitive' } }, // 大小寫不敏感相等（新增）
      { name: { contains: candidate, mode: 'insensitive' } },// 公司名包含發票名（原邏輯保留）
    ],
  },
  select: { id: true, name: true },
});
```

> 進一步可考慮「正規化比對」：移除 `LTD.`/`LIMITED`/`CO.`/標點、大小寫統一、空白壓縮後，比對 `name` 與每個 `nameVariant`，以涵蓋 `Fairate Express` ↔ `FAIRATE EXPRESS LTD.` 這類差異（建議用既有 `similarity/` 工具或簡單正規化函數，避免引入新依賴 — 遵守 H2）。

### BUG-2 緩解：降低對 nano matchedKnownCompany 的依賴

Step 1 失敗時，由修好的 Step 2（含 nameVariants + 正規化）承接，使配對不再單點依賴 nano 的 `matchedKnownCompany` 回報。

### BUG-3（可選）：JIT 前的重複防護

`jitCreateCompany` 前，先以正規化名比對**所有** Company（含 PENDING），若已存在高度相似者 → 回報配對到既有（並可標記為待人工確認），而非直接建新；避免重複增生。

> ⚠️ 注意（H1）：以上僅修「配對比對邏輯」與「JIT 重複防護」，**不改**三層映射架構、信心度路由、Prisma model 結構。屬 bug fix 範疇。

---

## 臨時 Workaround（已於 2026-05-31 套用，僅 Fairate 個案）

為讓使用者即時續測 Fairate，已做以下**資料操作**（非代碼修復）：

| 操作 | 對象 |
|------|------|
| 停用 2 間 JIT 重複公司 | `db9dd885`、`4cf48b42` → INACTIVE |
| 把既有 Fairate（`369c787f`）改名為發票全名 `FAIRATE EXPRESS LTD.`，並把短名移入 nameVariants | 使 Step 2 `name contains "FAIRATE EXPRESS LTD."` 命中 |

此 workaround 不可規模化（每間公司都要改名為發票全名、且對 GPT 讀名變動脆弱），**本 FIX 完成後應可改回正常短名**。

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/services/extraction-v3/stages/stage-1-company.service.ts` | `resolveCompanyId` Step 2 後備配對加入 `nameVariants` 精確比對 + name 雙向/正規化比對；（可選）`jitCreateCompany` 前加重複防護 |
| （可選）`src/services/similarity/` 或新增正規化 helper | 公司名正規化（移除 LTD./標點、大小寫統一）供配對使用 |

---

## 實作結果（2026-05-31）

`resolveCompanyId` Step 2 已改寫為：

- **2a**：DB 層 OR 條件 —— `nameVariants has candidate` ∪ `name 大小寫不敏感相等` ∪ `name contains candidate`。
- **2b**：正規化配對 —— 新增 `normalizeCompanyName()`（移除 `LTD/LIMITED/CO/...` 後綴與標點、小寫、壓縮空白），對所有 ACTIVE 公司的 `name` 與 `nameVariants` 做正規化相等比對。「Fairate Express」與「FAIRATE EXPRESS LTD.」皆正規化為 `fairate express` → 命中。

**驗證**（document `ee9421b1`，dev log 確認新查詢執行）：把 Fairate 改回短名 `Fairate Express` **且清空 nameVariants** 後重新處理，Stage 1 仍正確配對到既有公司 `369c787f`（Stage 2/3 載入該公司 COMPANY-scoped config），不再 JIT 增生 → **Stage 1 配對根治成功**。

> 註：此前的臨時 workaround（改名為 `FAIRATE EXPRESS LTD.`）已撤銷，恢復短名 `Fairate Express`、變體清空。

---

## ⚠️ 後續發現：Stage 2 同類 sibling bug（建議另開 FIX-058）

修復 Stage 1 後，重新處理時 Stage 2 出現 **同一類型**的錯誤：

```
Invalid `prisma.documentFormat.create()` invocation:
Unique constraint failed on the fields: (company_id, document_type, document_subtype)
```

- **位置**：`stage-2-format.service.ts` 的 `jitCreateFormat`。
- **根因**：與 Stage 1 同類 —— 以**格式 name** 搜尋既有格式，找不到就直接 `create`；但唯一約束是 `(company_id, document_type, document_subtype)`。當公司已有相同 `(type, subtype)`、僅 name 不同時 → 撞唯一約束 → Stage 2 失敗 → `OCR_FAILED`。
- **影響**：不只 re-process，**同一公司同 (type/subtype) 的第 2+ 份文件**都會中。
- **建議修法**：`jitCreateFormat` 改用 `(companyId, documentType, documentSubtype)` 做 find-or-create（upsert），而非以 name 搜尋後盲目 create。
- **狀態**：超出 FIX-057 scope（Stage 1），建議開 **FIX-058** 處理（同類 idempotency 問題）。

---

## 測試驗證

- [x] 把 Fairate 改回短名 `Fairate Express` + 清空 nameVariants 後仍正確配對到 369c787f（dev log + DB 確認）
- [x] `stage_1` 不再 JIT 建新公司（`company_id` 指向既有 369c787f）
- [x] `npm run type-check` 通過（修改檔案無錯誤）+ `npx eslint` 0 errors
- [x] Stage 3 GPT Prompt 套用該公司的 `PromptConfig` + `FieldDefinitionSet`（15:10 workaround run 已驗證；FIX 後配對邏輯一致）
- [ ] 抽測其他公司（如 CYTS、DHL Express）發票全名 → 正確配對到短名公司（待用戶上傳測試）
- [x] **FIX-058**：Stage 2 `jitCreateFormat` 唯一約束 idempotency → 已修復，端到端完整綠燈（`ee9421b1`、`e9ba60af` 皆 `MAPPING_COMPLETED`、6/6 欄位、Fairate prompt）
- [x] 既有已 JIT 增生的重複公司清理 → 已刪除 2 間 JIT 孤兒公司（`db9dd885`、`4cf48b42`）及其孤兒格式；現只剩唯一一間 `Fairate Express`

---

*文件建立日期: 2026-05-31*
*最後更新: 2026-05-31*
