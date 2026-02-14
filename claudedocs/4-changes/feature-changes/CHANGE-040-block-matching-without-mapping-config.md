# CHANGE-040: 阻擋無映射配置的匹配操作

> **日期**: 2026-02-14
> **狀態**: ⏳ 待實作
> **優先級**: High
> **類型**: Feature Enhancement
> **影響範圍**: `template-matching-engine.service.ts`

---

## 變更背景

### 現有問題

當 `resolveMapping` 返回空的 `mappings` 陣列時（即沒有任何 GLOBAL/COMPANY/FORMAT 映射配置），匹配引擎會**靜默失敗**：

1. `transformFields` 收到空 mappings → 迴圈不執行 → 返回 `{}`
2. `validateRowData` 檢查所有 `isRequired` 欄位 → **全部驗證失敗**
3. `upsertRow` 仍然創建 Row → `fieldValues: {}`、`status: 'INVALID'`
4. 最終結果：`validRows: 0`、`invalidRows: N` — 用戶不知道原因

這種行為不合理，因為沒有映射配置的匹配操作是毫無意義的，只會產生無用的 INVALID 行記錄，增加系統複雜度。

### 解決方案

在匹配執行前檢查映射配置是否為空，如為空直接拋出 `MAPPING_NOT_FOUND` 錯誤，阻擋後續流程。

## 變更內容

### 在 `matchDocuments` 和 `previewMatch` 中加入映射配置檢查

在 `resolveMapping` 返回後、載入文件前，加入 `mappings.length === 0` 檢查：

```typescript
const mappingConfig = await templateFieldMappingService.resolveMapping({...});

if (mappingConfig.mappings.length === 0) {
  throw new MatchingEngineError(
    '找不到映射配置，請先為此模板建立 Template Field Mapping（至少需要 GLOBAL 級別配置）',
    MatchingErrorCode.MAPPING_NOT_FOUND,
    { dataTemplateId: template.id, resolvedFrom: mappingConfig.resolvedFrom }
  );
}
```

## 技術設計

### 修改範圍

| 文件 | 變更內容 |
|------|----------|
| `src/services/template-matching-engine.service.ts` | `matchDocuments` + `previewMatch` 加入空映射檢查 |

### 不需修改的文件

- `src/types/template-matching-engine.ts` — `MatchingErrorCode.MAPPING_NOT_FOUND` 已存在
- `src/services/template-field-mapping.service.ts` — `resolveMapping` 行為不變

## 設計決策

1. **在消費端檢查而非 resolveMapping 內拋錯** — `resolveMapping` 作為通用方法，返回空結果是合理的（其他場景可能需要知道「沒有配置」而非接到錯誤），由匹配引擎決定是否接受空配置
2. **同時保護 previewMatch** — preview 也不應在無配置時執行，避免用戶看到全 INVALID 的預覽結果而困惑

## 影響範圍評估

### 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/services/template-matching-engine.service.ts` | 🔧 修改 | 加入空映射配置檢查 |

### 向後兼容性

- API 返回的錯誤格式不變（仍為 `MatchingEngineError`）
- 已有映射配置的匹配操作完全不受影響
- 原本靜默失敗的場景改為明確報錯 — 行為改善，非破壞性變更

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 無映射配置時阻擋匹配 | `resolveMapping` 返回空 mappings 時拋出 `MAPPING_NOT_FOUND` 錯誤 | High |
| 2 | 錯誤訊息清晰 | 明確告知用戶需要先建立 Template Field Mapping | High |
| 3 | previewMatch 同樣受保護 | `previewMatch` 在無映射時也拋出相同錯誤 | Medium |
| 4 | 有配置時行為不變 | 已有映射配置的匹配操作不受影響 | High |
