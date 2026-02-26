# CHANGE-046: classifiedAs 入口正規化 + UI 下拉選單

> **日期**: 2026-02-25
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: Feature Enhancement + Bug Fix
> **影響範圍**: Stage 3 提取服務、AGGREGATE 轉換、Template Field Mapping UI、i18n
> **前置條件**: CHANGE-043（AGGREGATE transform）、CHANGE-045（FieldDefinitionSet fieldType）已完成
> **觸發事件**: Template Instance field_2/field_3 值為 0，根因為 classifiedAs 格式不一致

---

## 變更背景

### 現況問題

AGGREGATE 轉換的 `filterItems()` 對 `classifiedAs` 使用精確匹配（`===`），但 GPT 輸出的 `category` 和用戶在 UI 配置的 filter 值之間存在格式差異：

| 欄位 | Mapping Filter (用戶輸入) | stage3Result classifiedAs (GPT 輸出) | 匹配結果 |
|------|--------------------------|--------------------------------------|----------|
| field_1 | `Freight Charges` | `Freight Charges` | ✅ 匹配 → 13731.45 |
| field_2 | `Terminal Handling Charge` | `Terminal_Handling_Charge` | ❌ 空格 vs 底線 → 0 |
| field_3 | `Cleaning At Destination` | `Cleaning at Destination` | ❌ 大寫 At vs 小寫 at → 0 |
| field_4 | `Delivery Order Fee` | `Delivery Order Fee` | ✅ 匹配 → 417.43 |
| field_5 | `Handling & Processing at Destination` | `Handling & Processing at Destination` | ✅ 匹配 → 125.25 |

### 根因分析

```
GPT 輸出 category: "Terminal_Handling_Charge"  ← GPT 自行決定格式（底線）
         ↓
convertRawLineItems(): classifiedAs = rawItem.category  ← 原樣保留，無正規化
         ↓
DB 存儲: classifiedAs = "Terminal_Handling_Charge"

用戶在 UI 手動輸入 filter: "Terminal Handling Charge"  ← 人類自然語言格式

filterItems(): item.classifiedAs !== filter.classifiedAs → 匹配失敗
```

**核心問題**：`convertRawLineItems()` 沒有對 GPT 輸出做正規化。

### 方案選擇

| 方案 | 描述 | 優缺點 |
|------|------|--------|
| A | 快速修法：修正 mapping rule filter 值 | 治標不治本，每個用戶都要手動對齊 |
| B | 容錯匹配：filterItems() 改為 case-insensitive | 掩蓋數據品質問題 |
| C | 入口正規化：convertRawLineItems() 正規化 | 乾淨但用戶仍需手動輸入 |
| **D** | **入口正規化 + UI 下拉選單** | **用戶選擇，最完整方案** |

用戶選擇 **方案 D**：入口正規化 + UI 下拉選單 + 撤回 ad-hoc 容錯匹配。

---

## 變更內容

### Step 1: 建立共用正規化函數

**新建** `src/services/extraction-v3/utils/classify-normalizer.ts`

```typescript
/**
 * 正規化 classifiedAs 值
 * - 底線/連字號 → 空格
 * - Title Case（每個單詞首字母大寫）
 */
export function normalizeClassifiedAs(value: string): string {
  return value.replace(/[_-]/g, ' ').trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
```

從 `extraction-v3/utils/index.ts` 導出。

### Step 2: 源頭正規化 — `convertRawLineItems()`

**修改** `src/services/extraction-v3/stages/stage-3-extraction.service.ts`

- 在 `convertRawLineItems()` 中對 `rawItem.category` 套用 `normalizeClassifiedAs()`
- 強化 GPT prompt 格式指引：`"category": "<charge category>", // MUST use Title Case with spaces`

### Step 3: 新建 API 端點 — 取得 distinct classifiedAs 值

**新建** `src/app/api/companies/[id]/classified-as-values/route.ts`

```
GET /api/companies/{companyId}/classified-as-values
Response: { success: true, data: { values: string[] } }
```

邏輯：
1. 查詢該公司最近 50 筆 `ExtractionResult`（status=COMPLETED, stage3Result != null）
2. 從 `stage3Result` JSON 中提取所有 `lineItems[].classifiedAs`
3. 套用 `normalizeClassifiedAs()` 確保舊資料底線格式也被正規化
4. 去重、排序後返回

### Step 4: 建立 `ClassifiedAsCombobox` 組件

**新建** `src/components/features/template-field-mapping/ClassifiedAsCombobox.tsx`

參考 `SourceFieldCombobox` 的 Popover + Command 模式：

| Props | 類型 | 說明 |
|-------|------|------|
| `value` | `string` | 當前值 |
| `onChange` | `(value: string) => void` | 值變更回調 |
| `companyId?` | `string` | 用於載入選項 |
| `disabled?` | `boolean` | 禁用狀態 |

行為：
- `companyId` 有值時，`useEffect` 呼叫 Step 3 API 載入選項
- 使用 `Command + CommandInput + CommandItem` 顯示下拉
- 支援搜尋過濾 + 自訂輸入（不在列表中時顯示 "Add: {value}" 選項）
- 無 `companyId` 時回退為純 `Input`

### Step 5: 修改 `AggregateConfigEditor` 使用 Combobox

**修改** `src/components/features/template-field-mapping/TransformConfigEditor.tsx`

1. `AggregateConfigEditor` 新增 `companyId?: string` prop
2. 將 `classifiedAs` 的 `<Input>` 替換為 `<ClassifiedAsCombobox>`
3. `classifiedAsIn` 暫保留 `<Input>`（多選 Combobox 複雜度高，可後續迭代）
4. `TransformConfigEditor` 新增 `companyId?: string` prop，向下傳遞

### Step 6: 傳遞 companyId（最小改動）

**修改** `src/components/features/template-field-mapping/MappingRuleItem.tsx`

已有 `resolveByContext?: { companyId?: string; formatId?: string }`，在呼叫 `TransformConfigEditor` 時新增：

```tsx
<TransformConfigEditor
  ...existing props...
  companyId={resolveByContext?.companyId}
/>
```

不需要改 `TemplateFieldMappingForm` 或 `MappingRuleEditor`（`resolveByContext` 已串好）。

### Step 7: 重構 aggregate.transform.ts — 使用共用正規化

**修改** `src/services/transform/aggregate.transform.ts`

- 移除目前的 ad-hoc `normalizeClassifiedAs()` 私有方法
- 改為 import 共用的 `normalizeClassifiedAs` 函數
- `filterItems()` 保留正規化比較作為向後兼容 shim（舊文件 DB 中仍有底線格式）
- 加上 TODO 註釋：當所有舊文件重新提取後可移除正規化，改為純 `===`

### Step 8: i18n 更新

**修改** `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json`

新增 `aggregate` section 下的 keys：
- `loadingClassifiedAs` / `noClassifiedAsValues` / `addCustomValue`

---

## 技術設計

### 修改檔案清單

| # | 動作 | 檔案 | Phase | 說明 |
|---|------|------|-------|------|
| 1 | 新建 | `src/services/extraction-v3/utils/classify-normalizer.ts` | 1 | 共用正規化函數 |
| 2 | 修改 | `src/services/extraction-v3/utils/index.ts` | 1 | 導出新函數 |
| 3 | 修改 | `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 2 | 源頭正規化 + prompt |
| 4 | 新建 | `src/app/api/companies/[id]/classified-as-values/route.ts` | 3 | API 端點 |
| 5 | 新建 | `src/components/features/template-field-mapping/ClassifiedAsCombobox.tsx` | 4 | 下拉組件 |
| 6 | 修改 | `src/components/features/template-field-mapping/TransformConfigEditor.tsx` | 5 | 使用 Combobox |
| 7 | 修改 | `src/components/features/template-field-mapping/MappingRuleItem.tsx` | 6 | 傳遞 companyId |
| 8 | 修改 | `src/services/transform/aggregate.transform.ts` | 7 | 引入共用正規化 |
| 9-11 | 修改 | `messages/{en,zh-TW,zh-CN}/templateFieldMapping.json` | 8 | i18n |

### 資料庫影響

**無需 Prisma 遷移**。所有改動都在應用層（正規化函數、API、UI）。

### i18n 影響

| 語言 | 文件 | 需要新增的 Key |
|------|------|---------------|
| en | `messages/en/templateFieldMapping.json` | `aggregate.loadingClassifiedAs`, `aggregate.noClassifiedAsValues`, `aggregate.addCustomValue` |
| zh-TW | `messages/zh-TW/templateFieldMapping.json` | 同上 |
| zh-CN | `messages/zh-CN/templateFieldMapping.json` | 同上 |

---

## 設計決策

1. **源頭正規化而非比較時容錯** — 在 `convertRawLineItems()` 入口處將 GPT 輸出轉為 Title Case，確保 DB 存儲的 `classifiedAs` 格式一致。比在 `filterItems()` 做容錯比較更乾淨。

2. **保留 aggregate.transform.ts 的正規化比較作為 shim** — 舊文件的 `stage3Result` 中仍有底線格式的 `classifiedAs`，需要正規化比較確保向後兼容。當所有舊文件重新提取後可移除。

3. **UI 下拉選單而非純文字輸入** — 減少手動輸入錯誤，提供已知 classifiedAs 值的自動完成。支援自訂輸入以處理新類型。

4. **API 端點限定公司範圍** — 每個公司的 Forwarder 發票類型不同，顯示該公司的 distinct classifiedAs 值更精確。

5. **classifiedAsIn 暫不改為 Combobox** — 多選 Combobox 的 UX 複雜度高，可後續迭代。

---

## 向後兼容分析

| 場景 | 影響 | 說明 |
|------|------|------|
| 新提取的文件 | ✅ classifiedAs 自動正規化為 Title Case | `convertRawLineItems()` 入口處理 |
| 舊文件（DB 中底線格式） | ✅ 透過 aggregate.transform.ts 正規化比較兼容 | shim 層確保匹配 |
| 現有 mapping rule filter 值 | ✅ 無需修改 | 正規化後的值與 Title Case filter 自然匹配 |
| API 端點回傳的選項 | ✅ 舊資料也被正規化 | API 查詢時套用 `normalizeClassifiedAs()` |
| 無 companyId 的場景 | ✅ 回退為純 Input | ClassifiedAsCombobox 降級處理 |

---

## 臨時修復記錄

### 已套用的 ad-hoc 修復（待 CHANGE-046 實作時撤回）

在 `src/services/transform/aggregate.transform.ts` 中新增了臨時的 `normalizeClassifiedAs()` 私有方法，將 `filterItems()` 從精確匹配改為容錯匹配。

**修改內容**：
- 新增 `normalizeClassifiedAs()` 方法（底線/連字號 → 空格 + 小寫）
- `classifiedAs` 過濾改為正規化後比較
- `classifiedAsIn` 過濾改為正規化後列表匹配

**注意**：CHANGE-046 Step 7 實作時，需將此 ad-hoc 方法替換為共用的 `normalizeClassifiedAs` import，並將比較邏輯從小寫匹配改為 Title Case 匹配。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 源頭正規化 | 新提取文件的 `lineItems[].classifiedAs` 為 Title Case（無底線） | High |
| 2 | GPT prompt 指引 | Stage 3 prompt 包含 category 格式要求 | Medium |
| 3 | API 端點 | `GET /api/companies/{id}/classified-as-values` 返回去重排序的 classifiedAs 值 | High |
| 4 | ClassifiedAsCombobox | AGGREGATE 配置中 classifiedAs 欄位顯示下拉選單 | High |
| 5 | 自訂輸入 | 下拉選單支援輸入不在列表中的自訂值 | Medium |
| 6 | 向後兼容 | 舊文件的底線格式 classifiedAs 仍能正確匹配 | High |
| 7 | 共用正規化 | aggregate.transform.ts 使用共用函數而非 ad-hoc 方法 | Medium |
| 8 | TypeScript 編譯 | `npm run type-check` 通過 | High |
| 9 | i18n 同步 | `npm run i18n:check` 通過 | High |

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | classifiedAs 下拉 | 打開 AGGREGATE rule → classifiedAs 欄位 | 顯示 Combobox，下拉列出公司的分類值 |
| 2 | 選擇已有值 | 從下拉選擇 "Terminal Handling Charge" | 值填入，保存後正確保留 |
| 3 | 自訂輸入 | 輸入 "New Custom Charge" | 顯示 "Add: New Custom Charge" 選項，可選擇保存 |
| 4 | 無 companyId | 在非公司專屬的 mapping 中 | classifiedAs 回退為純文字 Input |
| 5 | 重新提取文件 | 使用修改後的 Stage 3 重新提取 CEVA 發票 | classifiedAs 為 Title Case，field_2/field_3 正確計算 |
| 6 | 舊資料兼容 | 不重新提取，直接 match 舊文件 | 透過正規化比較，field_2/field_3 仍能正確計算 |

---

## 風險評估

| 風險 | 嚴重度 | 緩解措施 |
|------|--------|----------|
| Title Case 正規化遺失語義（如 "THC" 變成 "Thc"） | 低 | GPT 通常輸出全名而非縮寫；可在正規化函數中加入縮寫白名單 |
| API 查詢 50 筆文件效能 | 低 | 限制查詢量 + JSON 提取在應用層處理 |
| 舊文件重新提取前的過渡期 | 無 | aggregate.transform.ts 保留正規化比較作為 shim |
| classifiedAsIn（多選）暫未改為 Combobox | 低 | 用戶仍可手動輸入逗號分隔值，後續迭代 |

---

## 計畫文件

已批准的完整實作計畫：`~/.claude/plans/hidden-stirring-dawn.md`
