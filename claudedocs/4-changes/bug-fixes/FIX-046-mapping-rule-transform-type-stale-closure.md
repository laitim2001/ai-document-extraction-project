# FIX-046: Mapping Rule Transform Type 選擇無反應 — Stale Closure 問題

> **建立日期**: 2026-02-25
> **發現方式**: 用戶報告 Template Field Mapping 頁面中 Transform Type 下拉選單選擇後無反應
> **影響頁面/功能**: `/admin/template-field-mappings/[id]` — Mapping Rule 詳細配置
> **優先級**: P1 (High)
> **狀態**: ✅ 已完成（已修改，待 commit）
> **相關**: CHANGE-043（AGGREGATE transform）、CHANGE-045（FieldDefinitionSet fieldType）

---

## 問題描述

在 Template Field Mapping 編輯頁面中，展開任一 Mapping Rule 後，選擇不同的 Transform Type（如從 DIRECT 切換到 AGGREGATE），下拉選單值不會改變，看起來「選了沒反應」。因此無法看到 AGGREGATE 的 Filter classifiedAs、Aggregation、Field、Default Value 等配置項。

### 復現步驟

1. 進入 `/admin/template-field-mappings/{id}`
2. 展開任一 Mapping Rule
3. 點擊 Transform Type 下拉選單
4. 選擇 `AGGREGATE`（或任何其他類型）
5. **預期**: Transform Type 切換成功，顯示對應的配置面板
6. **實際**: Transform Type 不變，配置面板不出現

---

## 根本原因

### Stale Closure（陳舊閉包）

`TransformConfigEditor.handleTypeChange()` 在同一 tick 中連續呼叫兩個回調：

```typescript
// TransformConfigEditor.tsx handleTypeChange()
function handleTypeChange(type: FieldTransformType) {
  // ① 先更新 transformType
  onTransformTypeChange(type);
  // ② 緊接著更新 transformParams（重置為新類型的預設參數）
  onTransformParamsChange(newDefaultParams);
}
```

在 `MappingRuleItem.tsx` 中，這兩個回調都使用 `rule` 閉包：

```typescript
// 修復前
const handleTransformTypeChange = React.useCallback(
  (transformType: FieldTransformType) => {
    onChange({ ...rule, transformType });     // rule = 舊值 ✅
  },
  [rule, onChange]
);

const handleTransformParamsChange = React.useCallback(
  (transformParams: TransformParams) => {
    onChange({ ...rule, transformParams });   // rule 仍是舊值！❌
    // 第 2 次 onChange 把 transformType 覆蓋回舊值
  },
  [rule, onChange]
);
```

**時序分析**：

```
Tick 1:
  ① onTransformTypeChange('AGGREGATE')
     → onChange({ ...rule(old), transformType: 'AGGREGATE' })
     → React 排隊 re-render（尚未執行）

  ② onTransformParamsChange(newParams)
     → onChange({ ...rule(old), transformParams: newParams })
     → transformType 被覆蓋回舊值 ❌

Tick 2:
  React re-render → rule 更新
  → 但 transformType 已被覆蓋回舊值，看起來「沒反應」
```

---

## 修復方案

使用 `useRef` 追蹤最新的 `rule` 值，確保連續呼叫的回調讀取的是最新狀態。

### 修改文件

| # | 檔案 | 改動量 |
|---|------|--------|
| 1 | `src/components/features/template-field-mapping/MappingRuleItem.tsx` | +22 行, -13 行 |

### 修改內容

```typescript
// 修復後 — MappingRuleItem.tsx

// Use ref to track latest rule to avoid stale closure when
// TransformConfigEditor calls onTransformTypeChange + onTransformParamsChange sequentially
const ruleRef = React.useRef(rule);
ruleRef.current = rule;

const handleTransformTypeChange = React.useCallback(
  (transformType: FieldTransformType) => {
    const updated = { ...ruleRef.current, transformType };
    ruleRef.current = updated;  // 立即更新 ref
    onChange(updated);
  },
  [onChange]  // 不再依賴 rule
);

const handleTransformParamsChange = React.useCallback(
  (transformParams: TransformParams) => {
    const updated = { ...ruleRef.current, transformParams };
    ruleRef.current = updated;  // 立即更新 ref
    onChange(updated);
  },
  [onChange]  // 不再依賴 rule
);
```

**同樣模式套用到所有 handler**：`handleSourceFieldChange`、`handleTargetFieldChange`、`handleIsRequiredChange`、`handleDescriptionChange` — 全部改為從 `ruleRef.current` 讀取，從依賴陣列中移除 `rule`。

---

## 修復後行為

```
Tick 1:
  ① onTransformTypeChange('AGGREGATE')
     → ruleRef.current = { ...rule, transformType: 'AGGREGATE' }
     → onChange(ruleRef.current)

  ② onTransformParamsChange(newParams)
     → ruleRef.current = { ...ruleRef.current, transformParams: newParams }
     → 此時 ruleRef.current 已包含 transformType: 'AGGREGATE' ✅
     → onChange(ruleRef.current)

Tick 2:
  React re-render → transformType = 'AGGREGATE' ✅
  → 顯示 AGGREGATE 配置面板 ✅
```

---

## 驗證

### TypeScript 編譯
```bash
npm run type-check  # 無新錯誤（38 個既有錯誤，均位於 ForwarderRulesTable.tsx 和測試文件）
```

### 手動驗證

1. 進入 Template Field Mapping 編輯頁面
2. 展開 Mapping Rule → 選擇不同的 Transform Type
3. 確認 Transform Type 正確切換
4. 確認 AGGREGATE 類型顯示 Filter classifiedAs、Aggregation、Field、Default Value 等配置項
5. 確認切換回 DIRECT 後配置面板正確還原

---

## 影響範圍

| 項目 | 影響 |
|------|------|
| 其他 handler（source field、target field 等） | 同步修復（同樣的 useRef 模式） |
| 表單提交/保存 | 無影響（ruleRef 與 rule 最終一致） |
| 性能 | 微幅改善（useCallback 依賴減少，memo 更穩定） |
| 其他組件 | 無影響（修改限於 MappingRuleItem 內部） |

---

## 風險評估

| 風險 | 嚴重度 | 說明 |
|------|--------|------|
| useRef 與 rule prop 不同步 | 極低 | 每次 render 都會 `ruleRef.current = rule` 同步 |
| handler 中忘記更新 ruleRef | 極低 | 只有 transformType 和 transformParams 需要立即更新（連續呼叫場景） |
| 刪除 rule 依賴可能遺漏更新 | 無 | ref 每次 render 自動同步，不依賴 useCallback 重建 |
