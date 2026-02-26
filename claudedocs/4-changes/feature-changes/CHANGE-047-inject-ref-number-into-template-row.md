# CHANGE-047: 將匹配的 Reference Number 注入 Template Instance Row

> **日期**: 2026-02-25
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: Feature Enhancement
> **影響範圍**: Template Matching Engine、Template Instance Row、匯出流程
> **前置條件**: CHANGE-032（Pipeline Ref Match）已完成
> **後續計畫**: CHANGE-048（用 Ref Number 作為 rowKey，可選）

---

## 變更背景

### 現況問題

文件上傳後，Pipeline 會透過 `reference-number-matcher` 從文件名中匹配 Reference Number（如 Shipment No、HAWB），匹配結果存儲在 `ExtractionResult.referenceNumberMatch` JSON 欄位中。

然而，當文件進入 Template Matching 流程建立 `TemplateInstanceRow` 時，**匹配到的 Reference Number 並未傳遞到 row 的 `fieldValues` 中**。用戶在匯出 Excel 時無法看到該號碼，無法利用它進行後續的資料匹配。

### 資料流斷裂點

```
Pipeline 後處理
  └── ReferenceNumberMatcher.match(fileName)
      └── 結果存入 ExtractionResult.referenceNumberMatch ← 匹配完成
                                                              │
              ─ ─ ─ ─ ─ ─ ─ ─ 斷裂 ─ ─ ─ ─ ─ ─ ─ ─         │
                                                              ↓
Template Matching Engine
  └── loadDocuments() ← 只讀 fieldMappings + stage3Result，不讀 referenceNumberMatch
      └── transformFields() → fieldValues ← 缺少 ref number
          └── TemplateInstanceRow.fieldValues ← 匯出時無 ref number
```

### 用戶需求

用戶希望 Template Instance 匯出的 Excel 中，每行記錄能包含該文件匹配到的 Reference Number，作為主要識別欄位，方便與其他系統（如 ERP、TMS）進行資料匹配。

---

## 變更內容

### 核心策略：將 Ref Number 注入為「合成來源欄位」

在 Template Matching Engine 的 `loadDocuments()` 階段，將 `referenceNumberMatch` 中匹配到的 Reference Number 注入到 `mappedFields` 中，作為合成來源欄位。這樣用戶只需在 Template Field Mapping 中建立一條 DIRECT 映射規則，即可將 Ref Number 映射到 DataTemplate 的目標欄位。

**此方案完全複用現有映射機制，不需要特殊邏輯。**

### Step 1: 修改 `loadDocuments()` — 載入 referenceNumberMatch

**修改** `src/services/template-matching-engine.service.ts`

在 `loadDocuments()` 的 Prisma `select` 中加入 `referenceNumberMatch`：

```typescript
extractionResult: {
  select: {
    fieldMappings: true,
    stage3Result: true,
    referenceNumberMatch: true,  // ← 新增
  },
},
```

### Step 2: 注入合成來源欄位到 mappedFields

**修改** `src/services/template-matching-engine.service.ts`

在 `loadDocuments()` 返回 `mappedFields` 時，從 `referenceNumberMatch` 中提取匹配結果，注入到 `mappedFields` 中：

```typescript
// 從 referenceNumberMatch 中提取合成欄位
const refMatch = doc.extractionResult?.referenceNumberMatch as {
  matches?: Array<{
    referenceNumber: string;
    type: string;
    confidence: number;
  }>;
} | null;

// 注入合成來源欄位（以 _ref_ 前綴區分）
if (refMatch?.matches && refMatch.matches.length > 0) {
  // 主要匹配（第一筆最高信心度）
  mappedFields['_ref_number'] = refMatch.matches[0].referenceNumber;
  mappedFields['_ref_type'] = refMatch.matches[0].type;

  // 按類型注入（如 _ref_SHIPMENT、_ref_HAWB）
  for (const match of refMatch.matches) {
    mappedFields[`_ref_${match.type}`] = match.referenceNumber;
  }
}
```

### Step 3: 在 SourceFieldCombobox 中顯示合成欄位

**修改** `src/services/mapping/source-field.service.ts`（或相關的來源欄位提供邏輯）

確保 `_ref_*` 合成欄位在 SourceFieldCombobox 的選項中可見，讓用戶在建立映射規則時能選擇它們。

需要確認：
- source-field.service.ts 是否有固定的欄位列表
- 或者是動態從 extractionResult 中載入的

如果是動態載入，則 `_ref_*` 欄位會自動出現（因為它們已在 mappedFields 中）。
如果是固定列表，需要新增 `_ref_number`、`_ref_type` 等合成欄位。

### Step 4: 用戶配置側（無需代碼修改）

用戶需要在 DataTemplate 和 Template Field Mapping 中進行以下配置：

1. **DataTemplate 新增欄位**：
   - 欄位名：`reference_number`（或自訂名稱）
   - 類型：`text`
   - 必填：視需求

2. **Template Field Mapping 新增規則**：
   - Source Field: `_ref_number`（或 `_ref_SHIPMENT` 等按類型選擇）
   - Target Field: `reference_number`
   - Transform Type: `DIRECT`

配置完成後，每次 Template Matching 會自動將 Ref Number 填入該欄位，匯出時自然出現在 Excel 中。

---

## 技術設計

### 修改檔案清單

| # | 動作 | 檔案 | 說明 |
|---|------|------|------|
| 1 | 修改 | `src/services/template-matching-engine.service.ts` | loadDocuments() 加載 referenceNumberMatch + 注入合成欄位 |
| 2 | 可能修改 | `src/services/mapping/source-field.service.ts` | 若來源欄位為固定列表，需新增 `_ref_*` 合成欄位 |
| 3 | 可能修改 | `src/components/features/formats/SourceFieldCombobox.tsx` | 若需要顯示合成欄位分組（如 "Reference Number" 組別） |

### 資料庫影響

**無需 Prisma 遷移**。所有改動都在應用層：
- `referenceNumberMatch` 欄位已存在於 ExtractionResult model（CHANGE-032 新增）
- `fieldValues` 為 JSON 欄位，可包含任意 key

### i18n 影響

| 語言 | 文件 | 需要新增的 Key |
|------|------|---------------|
| en | `messages/en/standardFields.json` | `_ref_number`、`_ref_type` 等合成欄位的顯示標籤（若來源欄位有 i18n） |
| zh-TW | `messages/zh-TW/standardFields.json` | 同上 |
| zh-CN | `messages/zh-CN/standardFields.json` | 同上 |

> 注意：實際 i18n 影響取決於 SourceFieldCombobox 是否對來源欄位做翻譯，需在 Step 3 確認後更新。

---

## 設計決策

1. **合成來源欄位而非直接注入 fieldValues** — 完全複用現有映射機制（DIRECT/FORMULA/LOOKUP 等），用戶有完全控制權決定要映射哪個 ref number、映射到哪個目標欄位、是否需要。不需要任何特殊邏輯。

2. **以 `_ref_` 前綴命名合成欄位** — 使用底線前綴避免與 GPT 提取的欄位衝突。`_ref_number`（主要）、`_ref_type`（類型）、`_ref_{TYPE}`（按類型）的命名方式清晰且可預測。

3. **注入「主要匹配」+ 「按類型匹配」** — `_ref_number` 取第一筆（最高信心度），`_ref_SHIPMENT` / `_ref_HAWB` 等按類型分別注入，讓用戶可以精確選擇需要的 ref number 類型。

4. **不改變 rowKey 邏輯（留給 CHANGE-048）** — CHANGE-047 專注於「讓 ref number 出現在匯出中」，rowKey 改用 ref number 的需求可在 CHANGE-048 中獨立實現。

---

## 向後兼容分析

| 場景 | 影響 | 說明 |
|------|------|------|
| 無 Pipeline Ref Match 的文件 | ✅ 無影響 | `referenceNumberMatch` 為 null，不注入任何合成欄位 |
| 已有的 Template Instance Row | ✅ 無影響 | 只影響新建立的 row，舊 row 不受影響 |
| 現有映射規則 | ✅ 無影響 | 合成欄位使用 `_ref_` 前綴，不與現有來源欄位衝突 |
| 匯出時未配置 ref number 欄位 | ✅ 無影響 | 合成欄位存在於 mappedFields 但不會自動出現在匯出中（需要 DataTemplate 定義 + 映射規則） |
| fieldValues 包含額外 key | ✅ 無影響 | validateRowData() 只驗證 DataTemplate.fields 中定義的欄位，忽略額外 key |

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 合成欄位注入 | loadDocuments() 將 referenceNumberMatch 注入到 mappedFields 的 `_ref_*` 欄位 | High |
| 2 | 主要 Ref Number | `_ref_number` 包含第一筆匹配的 referenceNumber 值 | High |
| 3 | 按類型 Ref Number | `_ref_{TYPE}` 包含對應類型的 referenceNumber 值 | Medium |
| 4 | SourceField 可見 | 用戶在 SourceFieldCombobox 中能看到並選擇 `_ref_*` 欄位 | High |
| 5 | DIRECT 映射可用 | 建立 `_ref_number → reference_number` 的 DIRECT 映射後，row 的 fieldValues 包含正確的值 | High |
| 6 | 匯出包含 Ref Number | DataTemplate 定義 reference_number 欄位後，匯出 Excel 包含該值 | High |
| 7 | 無 Ref Match 時不影響 | Pipeline 未啟用或無匹配結果時，mappedFields 中無 `_ref_*` 欄位，不影響現有邏輯 | High |
| 8 | TypeScript 編譯 | `npm run type-check` 通過 | High |

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 有 Ref Match 的文件 | 上傳文件（文件名含 ref number）→ Pipeline 匹配成功 → Template Match | `_ref_number` 出現在 mappedFields，映射後出現在 fieldValues |
| 2 | 無 Ref Match 的文件 | 上傳文件（Pipeline 未啟用 ref match）→ Template Match | mappedFields 中無 `_ref_*` 欄位，其他欄位正常 |
| 3 | 多類型匹配 | 文件名同時匹配 SHIPMENT 和 HAWB | `_ref_SHIPMENT` 和 `_ref_HAWB` 分別包含對應值 |
| 4 | 匯出驗證 | 配置完成後 → 匯出 Excel | Excel 中有 reference_number 欄位且值正確 |
| 5 | 多文件合併 | 同 rowKey 的多個文件有不同 ref number | fieldValues 使用最後一個文件的 ref number（合併覆蓋） |
| 6 | 來源欄位選擇 | 打開 SourceFieldCombobox | 能看到 `_ref_number`、`_ref_SHIPMENT` 等合成欄位 |

---

## 與 CHANGE-048 的關係

| 項目 | CHANGE-047（本次） | CHANGE-048（未來） |
|------|-------------------|-------------------|
| 目標 | Ref Number 出現在匯出 Excel | Ref Number 作為 rowKey |
| 範圍 | mappedFields 注入 + 映射規則 | extractRowKey() 邏輯調整 |
| 依賴 | 無 | 依賴 CHANGE-047 |
| 用戶價值 | 匯出包含 Ref Number 欄位 | 同 Ref Number 的多文件自動合併為一行 |
| 風險 | 低（不改變現有行為） | 中（改變 rowKey 行為） |

---

## 實施計劃

### Phase 1: 核心注入（Step 1-2）
- 修改 `loadDocuments()` 加載 `referenceNumberMatch`
- 注入 `_ref_*` 合成欄位到 `mappedFields`
- 確認 transformFields() 能正確傳遞合成欄位

### Phase 2: UI 可見性（Step 3）
- 確認 SourceFieldCombobox 是否自動顯示合成欄位
- 如需手動添加，更新來源欄位列表和 i18n

### Phase 3: 驗證
- `npm run type-check`
- `npm run lint`
- 端到端測試：上傳文件 → 匹配 → 配置映射 → 匯出 Excel → 確認 ref number 欄位
