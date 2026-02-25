# CHANGE-048: 用匹配的 Reference Number 作為 Template Instance Row Key

> **日期**: 2026-02-25
> **狀態**: ⏳ 待實作（待 CHANGE-047 完成後評估）
> **優先級**: Medium
> **類型**: Feature Enhancement
> **影響範圍**: Template Matching Engine（extractRowKey 邏輯）
> **前置條件**: CHANGE-047（Ref Number 注入 mappedFields）已完成
> **觸發事件**: 用戶反饋希望同一 Ref Number 的多個文件自動合併為一行

---

## 變更背景

### 現況（CHANGE-047 完成後）

CHANGE-047 將匹配到的 Reference Number 注入為合成來源欄位（`_ref_number`），用戶可透過 DIRECT 映射讓 Ref Number 出現在匯出 Excel 中。但 `rowKey` 仍由 `extractRowKey()` 從 `mappedFields` 中的 `rowKeyField`（通常為 `shipment_no`）取值。

### 問題場景

同一筆 Shipment 可能有多張發票（如 Freight Invoice + Surcharge Invoice），它們的文件名中包含相同的 Reference Number，但 GPT 提取的 `shipment_no` 可能因格式差異（如空格、大小寫）而不完全一致，導致無法自動合併為同一行。

```
文件 A: "CEVA-SHP-001-freight.pdf"   → GPT 提取 shipment_no: "SHP 001"
文件 B: "CEVA-SHP-001-surcharge.pdf" → GPT 提取 shipment_no: "SHP-001"

Pipeline Ref Match: 兩個文件都匹配到 referenceNumber: "SHP-001"

目前 rowKey:  "SHP 001" ≠ "SHP-001" → 建立兩行（❌ 用戶期望合併為一行）
期望 rowKey:  "SHP-001" = "SHP-001" → 合併為一行（✅）
```

### 方案價值

使用 Pipeline 匹配到的 Reference Number（來自主檔，格式一致）作為 rowKey，比 GPT 提取的值更穩定可靠，能確保同一筆 Shipment 的多張發票正確合併。

---

## 變更內容

### Step 1: 修改 `extractRowKey()` 優先級邏輯

**修改** `src/services/template-matching-engine.service.ts`

調整 `extractRowKey()` 方法，新增 Ref Number 優先級：

```typescript
/**
 * 提取行識別碼
 * 優先級：
 *   1. mappedFields 中的 _ref_number（Pipeline 匹配，格式一致）
 *   2. mappedFields 中的 rowKeyField（GPT 提取值）
 *   3. 時間戳 fallback
 */
private extractRowKey(
  mappedFields: Record<string, unknown>,
  rowKeyField: string,
  options?: { preferRefNumber?: boolean }
): string {
  // 優先使用 Pipeline 匹配的 Ref Number（CHANGE-048）
  if (options?.preferRefNumber !== false) {
    const refNumber = mappedFields['_ref_number'];
    if (refNumber && typeof refNumber === 'string' && refNumber.trim().length > 0) {
      return refNumber.trim();
    }
  }

  // Fallback: 使用 rowKeyField
  const value = mappedFields[rowKeyField];
  if (value && typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  // 最終 fallback: 時間戳
  return `row-${Date.now()}`;
}
```

### Step 2: 新增配置選項（可選）

**修改** `src/types/template-matching-engine.ts`

在 `MatchDocumentsOptions` 中新增配置：

```typescript
interface MatchDocumentsOptions {
  // ...existing options...
  /** 使用匹配的 Reference Number 作為 rowKey（預設 true） @since CHANGE-048 */
  preferRefNumberAsRowKey?: boolean;
}
```

這讓呼叫端（如 `auto-template-matching.service.ts`）可以控制是否啟用此行為。

### Step 3: 傳遞配置到 extractRowKey

**修改** `src/services/template-matching-engine.service.ts`

在 `processBatch()` 中將配置傳遞到 `extractRowKey()`：

```typescript
const rowKey = this.extractRowKey(
  mappedFields,
  rowKeyField,
  { preferRefNumber: options?.preferRefNumberAsRowKey ?? true }
);
```

---

## 技術設計

### 修改檔案清單

| # | 動作 | 檔案 | 說明 |
|---|------|------|------|
| 1 | 修改 | `src/services/template-matching-engine.service.ts` | extractRowKey() 優先級調整 + processBatch() 傳遞配置 |
| 2 | 修改 | `src/types/template-matching-engine.ts` | MatchDocumentsOptions 新增 `preferRefNumberAsRowKey` |

### 資料庫影響

**無需 Prisma 遷移**。rowKey 仍為 `String` 類型，只是值的來源改變。

### i18n 影響

**無**。rowKey 不在 UI 中直接顯示為可翻譯文字。

---

## 設計決策

1. **預設啟用（opt-out 而非 opt-in）** — 當有 Ref Number 匹配時，預設使用它作為 rowKey。這符合用戶的主要使用場景。若特殊情況需要回退到 GPT 提取值，可設定 `preferRefNumberAsRowKey: false`。

2. **三層 fallback 策略** — `_ref_number` → `rowKeyField` → 時間戳。確保任何情況下都能生成有效的 rowKey。

3. **依賴 CHANGE-047 的合成欄位** — 直接從 `mappedFields['_ref_number']` 讀取，不需要額外載入 `referenceNumberMatch`。CHANGE-047 已處理注入邏輯。

4. **配置選項放在 options 而非 PipelineConfig** — 這是 Template Matching 的行為控制，不是 Pipeline 配置。放在 `MatchDocumentsOptions` 中更貼切。

---

## 向後兼容分析

| 場景 | 影響 | 說明 |
|------|------|------|
| 有 Ref Match 的新文件 | ⚠️ rowKey 來源改變 | 從 GPT 提取值改為 Pipeline 匹配的 ref number |
| 無 Ref Match 的文件 | ✅ 無影響 | `_ref_number` 不存在，fallback 到原有 rowKeyField |
| 已有的 Template Instance Row | ✅ 無影響 | 舊 row 的 rowKey 不會被修改 |
| 同一 Instance 新舊文件混合 | ⚠️ 需注意 | 新文件用 ref number 作 rowKey，舊文件可能用不同格式的 rowKey，可能無法合併 |
| rowKey 唯一約束 | ✅ 無影響 | `(templateInstanceId, rowKey)` 唯一約束仍有效，同 ref number 的文件會正確合併 |

### 遷移考量

- **新建的 Template Instance**：完全使用新的 rowKey 邏輯，無問題
- **已有的 Template Instance 追加文件**：新文件使用 ref number 作 rowKey，而舊 row 可能使用 GPT 提取值，兩者可能不同。建議：
  - 如需完整合併，重新執行整個 Template Match
  - 或在 UI 中提供「重新匹配」功能

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | Ref Number 優先 | 有匹配時，rowKey 使用 `_ref_number` 值 | High |
| 2 | Fallback 正常 | 無匹配時，rowKey 使用原有 rowKeyField 值 | High |
| 3 | 多文件合併 | 同 ref number 的多個文件合併為一行 | High |
| 4 | 配置可控 | 設定 `preferRefNumberAsRowKey: false` 可回退到原行為 | Medium |
| 5 | 時間戳 fallback | 兩者都無值時，生成時間戳 rowKey | Low |
| 6 | TypeScript 編譯 | `npm run type-check` 通過 | High |

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 有 Ref Match | 上傳文件（Pipeline 匹配成功）→ Template Match | rowKey = ref number 值 |
| 2 | 無 Ref Match | 上傳文件（Pipeline 未啟用）→ Template Match | rowKey = GPT 提取的 rowKeyField 值 |
| 3 | 多文件同 Ref | 上傳 2 個同 ref number 的文件 → Template Match | 合併為 1 行，sourceDocumentIds 包含 2 個 ID |
| 4 | 配置停用 | 設定 preferRefNumberAsRowKey: false → Template Match | rowKey = GPT 提取值（原行為） |
| 5 | Ref Number 為空 | Pipeline 匹配但 referenceNumber 為空字串 | fallback 到 rowKeyField |
| 6 | 混合場景 | 已有 instance 的舊 row + 新文件（有 ref match） | 新 row 使用 ref number，舊 row 不變 |

---

## 風險評估

| 風險 | 嚴重度 | 緩解措施 |
|------|--------|----------|
| rowKey 來源改變導致舊 Instance 追加文件時無法合併 | 中 | 提供 opt-out 配置 + 文檔說明 |
| 多個 ref match 時 `_ref_number` 取第一筆可能不是用戶期望的 | 低 | 用戶可改用 `_ref_{TYPE}` 作為 rowKeyField |
| 與 CHANGE-047 的合成欄位命名耦合 | 低 | `_ref_number` 命名在 CHANGE-047 中已固定，不會變動 |
