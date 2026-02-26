# CHANGE-038: Template Field Mapping Source Field 動態載入

> **建立日期**: 2026-02-11
> **發現方式**: 手動 UI 測試
> **影響範圍**: Template Field Mapping 建立/編輯頁面
> **優先級**: P2
> **狀態**: ✅ 已完成
> **相關**: CHANGE-037（Data Template Flow Completion）

---

## 問題描述

在 `/admin/template-field-mappings/new` 頁面建立映射規則時，source field 下拉選單只顯示 ~90 個硬編碼的標準欄位（來自 `@/constants/standard-fields`），無法顯示實際文件提取後產生的動態欄位名稱。

不同公司/格式的文件經 GPT 提取後，會產生不同的欄位名稱（如 `sea_freight`, `documentation_fee`）。這些動態欄位是映射規則中 sourceField 的真正來源，但目前的 UI 完全看不到它們，導致使用者無法正確建立映射規則。

## 根本原因

- `MappingRuleItem.tsx` 使用 `SourceFieldSelector`（僅支援標準欄位）
- 已有更完善的 `SourceFieldCombobox`（支援標準 + 動態提取 + 自訂欄位）但未被使用
- `formatId` 沒有從表單層級傳遞到規則項目層級

## 修復方案

### Scope 策略

| Scope | Source Field 行為 |
|-------|------------------|
| FORMAT | 標準欄位 + 動態提取欄位 + 自訂 |
| COMPANY | 標準欄位 + 自訂 |
| GLOBAL | 標準欄位 + 自訂 |

### 修改檔案

| # | 檔案 | 變更 |
|---|------|------|
| 1 | `src/components/features/formats/SourceFieldCombobox.tsx` | 加入 `usedFields` prop |
| 2 | `src/components/features/template-field-mapping/MappingRuleItem.tsx` | 替換 SourceFieldSelector → SourceFieldCombobox |
| 3 | `src/components/features/template-field-mapping/MappingRuleEditor.tsx` | 透傳 `formatId` |
| 4 | `src/components/features/template-field-mapping/TemplateFieldMappingForm.tsx` | 傳遞 `documentFormatId` 到 MappingRuleEditor |

### 資料流

TemplateFieldMappingForm (watch documentFormatId)
→ MappingRuleEditor (formatId prop)
→ MappingRuleItem (formatId prop)
→ SourceFieldCombobox (formatId → fetch extracted-fields API)

## 不修改的部分

- NEW/EDIT page.tsx — 表單已接收 documentFormats 列表
- SourceFieldSelector.tsx — 保留（可能其他地方還在用）
- API endpoint — `/api/v1/formats/{formatId}/extracted-fields` 已存在

## 檢查清單

- [x] SourceFieldCombobox 加入 usedFields prop
- [x] MappingRuleItem 替換為 SourceFieldCombobox
- [x] MappingRuleEditor 透傳 formatId
- [x] TemplateFieldMappingForm 傳遞 documentFormatId
- [ ] TypeScript 類型檢查通過
- [ ] 手動 UI 驗證（FORMAT scope 顯示動態欄位）

---

*建立者: AI 助手*
*建立日期: 2026-02-11*
