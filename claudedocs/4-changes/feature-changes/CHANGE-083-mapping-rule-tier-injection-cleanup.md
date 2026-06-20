# CHANGE-083: MappingRule Tier 1/2 術語注入清理（遷移公司術語至 FieldDefinitionSet + 停用冗餘注入）

> **日期**: 2026-06-20
> **狀態**: ✅ 已完成
> **優先級**: Medium
> **類型**: Refactor（清理上一代架構遺留）
> **影響範圍**: `stage-3-extraction.service.ts` 術語注入 + 一筆公司 FieldDefinitionSet 資料 + 文件回寫

---

## 變更背景

目前環境 100% 走 V3.1 三階段提取（`.env`：`ENABLE_UNIFIED_PROCESSOR=true`、`FEATURE_EXTRACTION_V3=true` @100%、`FEATURE_EXTRACTION_V3_1=true` @100%）。在 GPT Vision 架構下，`MappingRule`（Epic 4）原本的「欄位提取規則引擎」角色已大幅弱化：

- Stage 3 的 `loadTier1Mappings()` / `loadTier2Mappings()` 只 `SELECT fieldName/fieldLabel`，經 `buildMappingsSection()` 組成 `Term Classification Rules` 注入 Stage 3 system prompt（`stage-3-extraction.service.ts` 第 519-565、748-778、705 行），且帶 `TODO: Phase 2` 註解。
- `MappingRule` 最核心的 `extractionPattern` / `validationPattern` 在整個 `extraction-v3/` 目錄**完全未被使用**。

### 本地 DB 實查結果（2026-06-20）

| 項目 | 數量 |
|------|------|
| `MappingRule` 總筆數 | 31（全部 `status=ACTIVE` / `isActive=true`） |
| Tier 1（`companyId=null`） | 21 |
| Tier 2（4 家公司） | 10 |

逐筆檢視：**30 / 31 筆是 `snake_case 鍵 → Title Case 英文名` 的直譯**（如 `invoice_number → Invoice Number`），與 `FieldDefinitionSet` 注入的欄位區塊高度重複、對 GPT 無資訊量。**唯一一筆**有公司特有術語價值：

```
companyId = be691f33（海運 forwarder）："tracking_number" → "Bill of Lading Number"
```

因此目前「術語小抄」的實際貢獻趨近於零，唯一例外可遷移到新架構的正規位置（`FieldDefinitionSet` 的 `aliases` / `extractionHints`）後安全停用。

---

## 變更內容

### 1. 將唯一有效的公司特有術語遷至標準欄位別名（H6 修正，見實作備註）

> **實作修正**：Phase 1 查 DB 發現 `be691f33` = **Maersk**，且**無任何 FieldDefinitionSet**；全系統 17 個定義集皆 COMPANY scope 且只放「自訂費用欄位」、無 GLOBAL 定義集。原規劃「遷移到 Maersk 的 `FieldDefinitionSet`」不可行（Maersk 走 fallback = `invoice-fields.ts`）。

改為：在 `src/types/invoice-fields.ts` 的標準欄位 `tracking_number.aliases` 補海運別名 `'bill of lading number'`、`'b/l no'`、`'bill of lading'`（既有別名全為空運 awb，對稱補上海運 B/L）。因 `tracking_number` 為 `isRequired: true`，Maersk 走 fallback 時即可生效。

### 2. 停用 Stage 3 的 Tier 1 / Tier 2 術語注入

`loadExtractionConfig()` 不再呼叫 `loadTier1Mappings()` / `loadTier2Mappings()`，`universalMappings` / `companyMappings` 改為空物件 `{}`；`buildMappingsSection()` 因輸入恆空而不輸出該段。剩餘 30 筆直譯冗餘不再注入 prompt。

### 3. 文件回寫

更新 `known-discrepancies.md`、`open-questions.md`、Epic 4 相關 Story / 治理矩陣，記錄「`MappingRule` 在 V3.1 半退役、Tier1/2 注入已停用」此一決定與其理由。

---

## 技術設計

### 修改範圍

| 文件 | 類型 | 變更內容 |
|------|------|----------|
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | ✅ 已改 | `loadExtractionConfig`：`universalMappings` / `companyMappings` 直接設為 `{}`，移除對 `loadTier1Mappings`/`loadTier2Mappings` 的呼叫；兩個 private 方法標 `@deprecated` 保留（供未來 Phase 2 重用）；`buildMappingsSection` 保留不動（輸入恆空 → 回傳空字串） |
| `src/types/invoice-fields.ts` | ✅ 已改 | `tracking_number.aliases` 補 `'bill of lading number'`/`'b/l no'`/`'bill of lading'`（取代原「遷移到 FieldDefinitionSet」做法，見實作備註 H6）。`aliases` 為 GPT 提取提示、非 UI 字串，不觸發 i18n |
| `claudedocs/reference/known-discrepancies.md` | 🔧 修改 | 新增一行：`MappingRule` Tier1/2 注入停用 + 理由 |
| `docs/open-questions.md` | 🔧 修改 | 新增 OQ：`MappingRule` Phase 2 術語映射正規化是否要做（決定 /rules 與 Epic 4 自動學習生態的去留） |
| Epic 4 對應 Story / 治理矩陣 | 🔧 修改 | 註記 Tier1/2 術語注入在 V3.1 已停用 |

### i18n 影響

無。本變更不涉及任何使用者可見 UI 字串。

### 資料庫影響

**無 schema 變更、無 Prisma migration、無資料異動。** H6 修正後改為靜態程式碼別名（`invoice-fields.ts`），不再動任何 DB 資料。`MappingRule` 資料表（31 筆）與 `FieldDefinitionSet`（17 筆）資料**完全不動**。

---

## 設計決策

1. **先遷移、後停用（順序依賴）** — 必須先完成第 1 步（遷移 `be691f33` 術語），才能做第 2 步（停用注入），避免該公司在空窗期失去提單號提示。
2. **停用方式採「不呼叫 + 空物件」，不刪表 / 不刪頁** — 保留 `MappingRule` 表、`/rules` 頁面、Epic 4 自動學習 API（`/api/rules/*`）原封不動。這些屬更大的架構決策，不在本 CHANGE 範圍。此做法完全可逆。
3. **保留 `buildMappingsSection` 與兩個 load 方法（標 `@deprecated`）** — 若未來決定補完 `TODO: Phase 2`（把 forwarder 真實術語差異正規化餵給 GPT），可直接重用，符合 surgical change 原則，不過度刪除。
4. **遷移用 `aliases` 而非 `extractionHints`** — `aliases` 是 GPT 提取的標準別名機制，語意最貼近「同一欄位的不同稱呼」；`extractionHints` 為備案。
5. **`be691f33` 為 companyId，實作前需確認對應公司名稱與其 COMPANY scope `FieldDefinitionSet` 是否已存在**（若不存在則需先建立，或改放對應 FORMAT scope）。

---

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 🔧 修改 | 停用 Tier1/2 注入（1 個程式檔） |
| `be691f33` 公司 `FieldDefinitionSet`（DB） | 🔧 資料 | 補 `tracking_number` aliases |
| `claudedocs/reference/known-discrepancies.md` | 🔧 修改 | 文件回寫 |
| `docs/open-questions.md` | 🔧 修改 | 新增 OQ |
| Epic 4 Story / 治理矩陣 | 🔧 修改 | 狀態註記 |

### 向後兼容性

- `MappingRule` 表、`/rules` 頁面、`/api/rules/*` 自動學習 API **均不受影響**（資料與行為不變，只是其產物不再注入 Stage 3 prompt）。
- 不動 V2 路徑與 V3→V2 fallback。
- 不改 Prisma schema → 無 migration、無資料結構遷移風險。
- 唯一行為改變：Stage 3 system prompt 不再含 `Term Classification Rules` 段落。

---

## 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 提取準確率下降 | 🟢 低 | 31 筆中 30 筆為冗餘直譯，與 FieldDefinitionSet 重複；唯一有效術語已遷移 |
| `be691f33` 提單號漏抽 | 🟡 中 → 低 | 嚴格「先遷移後停用」；遷移後以該公司實際文件驗證 `tracking_number` 提取 |
| 未來想恢復 Tier1/2 機制 | 🟢 低 | 方法保留 `@deprecated`、表與資料不動，還原呼叫即可 |
| 其他公司隱性依賴此注入 | 🟢 低 | 已全表檢視，其餘 9 家公司規則皆為直譯，無語意轉換 |

---

## 回滾計劃

1. **程式回滾**：還原 `stage-3-extraction.service.ts` 的 `loadExtractionConfig` 改動（恢復呼叫 `loadTier1Mappings`/`loadTier2Mappings`），注入即恢復——因 `MappingRule` 資料全程未動。
2. **資料**：`FieldDefinitionSet` 補的 `aliases` 無害，回滾時可保留（不會造成負面影響）。

---

## 實施計劃（分階段，有順序依賴）

| 階段 | 步驟 | 結果 |
|------|------|------|
| Phase 1 | 查 DB 確認 `be691f33` 現況 | ✅ 完成：= Maersk、無定義集、系統無 GLOBAL、COMPANY 集只放費用欄位 → **觸發 H6，遷移做法修正**（見實作備註） |
| Phase 2 | 補 `invoice-fields.ts tracking_number.aliases` 海運別名 | ✅ 完成 |
| Phase 3 | 停用注入：`loadExtractionConfig` 改用空 `{}`，方法標 `@deprecated` | ✅ 完成：`type-check` 0 errors、`eslint` 0 errors（3 個 pre-existing warnings 與本變更無關） |
| Phase 4 | 文件回寫：`known-discrepancies.md` #9 / `open-questions.md` OQ-Q4 / 本文件 | ✅ 完成 |

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 術語遷移 | `be691f33` 公司 `FieldDefinitionSet` 的 `tracking_number` 含 `Bill of Lading Number` 別名 | High |
| 2 | 遷移後提取驗證 | 該公司海運文件提取，提單號正確填入 `tracking_number` | High |
| 3 | 停用注入 | Stage 3 system prompt 不再出現 `Term Classification Rules` 段落 | High |
| 4 | 無迴歸 | 一般文件（非 `be691f33`）提取準確率不下降 | High |
| 5 | 範圍邊界 | `MappingRule` 表、`/rules` 頁面、`/api/rules/*` 行為不變 | High |
| 6 | 文件回寫 | `known-discrepancies.md` / `open-questions.md` / Epic 4 Story 三處更新 | Medium |
| 7 | 品質 | `npm run type-check` + `npx eslint` 0 errors | High |

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 提單號提取（遷移後） | 上傳 `be691f33` 公司含 Bill of Lading Number 的海運文件 | `tracking_number` 正確抽到提單號 |
| 2 | prompt 不含術語段 | 開 `DEBUG_EXTRACTION_V3_PROMPT=true` 觀察 Stage 3 system prompt | 無 `Term Classification Rules` 段落 |
| 3 | 一般文件迴歸 | 上傳其他公司文件 | 標準欄位提取結果與停用前一致 |
| 4 | /rules 頁面不受影響 | 開 `/rules` 頁面、呼叫 `/api/rules/*` | 列表、CRUD、自動學習 API 行為正常 |

---

## 實作備註

### ⚠️ H6 設計偏離（Phase 1 後修正，已獲用戶 approve 2026-06-20）

| 項目 | 說明 |
|------|------|
| 原規劃 | 將 Maersk 的 `tracking_number → Bill of Lading Number` 遷移到該公司 COMPANY scope `FieldDefinitionSet` 的 `aliases` |
| Phase 1 發現 | `be691f33` = Maersk，**無任何 FieldDefinitionSet**；全系統 `FieldDefinitionSet` 17 筆**全為 COMPANY scope 且只放「自訂費用欄位」**（DHL 範例僅 2 個費用欄位、無標準欄位）；**無 GLOBAL 定義集** → Maersk 走 `getFallbackFieldDefinitions()`（= `invoice-fields.ts` required 欄位） |
| 為何原設計不可行 | (1) Maersk 無定義集需新建；(2) 標準欄位 `tracking_number` 不屬於「自訂費用欄位集」慣例；(3) 無 GLOBAL base，硬建只含 `tracking_number` 的 COMPANY 集會干擾合併；(4) 別名真正生效位置是 fallback 來源 `invoice-fields.ts` |
| 實際實現 | 在 `invoice-fields.ts` 的 `tracking_number.aliases` 補海運別名（對所有走 fallback 的公司含 Maersk 生效、語意對稱、無資料漂移、無需建定義集） |
| 用戶確認 | 2026-06-20 採選項 A |

### 範圍與後續

- 本 CHANGE 是「清理上一代 OCR 架構遺留」的第一步，僅處理 `MappingRule` 的 Stage 3 注入。
- 後續更大的決策（`MappingRule` 表與 Epic 4 自動學習生態是否整體退場、`FieldMappingConfig` Epic 13 是否退場）見 `open-questions.md` **OQ-Q4**，另開 CHANGE 評估。
- 依專案教訓（停用既定功能須建 CHANGE + 全鏈回寫文件），文件回寫已納入 Phase 4：`known-discrepancies.md` #9、`open-questions.md` OQ-Q4、本文件。

---

*文件建立日期: 2026-06-20*
*最後更新: 2026-06-20（Phase 1-4 完成，含 H6 修正）*
