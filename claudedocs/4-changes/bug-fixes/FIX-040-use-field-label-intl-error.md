# FIX-040: useFieldLabel Hook 對非標準欄位拋出 IntlError

> **建立日期**: 2026-02-14
> **發現方式**: 用戶回報（瀏覽器 console 錯誤）
> **影響頁面/功能**: `/template-instances/[id]` 詳情頁（及所有使用 useFieldLabel 的組件）
> **優先級**: P2
> **狀態**: ✅ 已修復

---

## 問題描述

在 Template Instance 詳情頁瀏覽或編輯行資料時，瀏覽器 console 大量報錯：

```
IntlError: MISSING_MESSAGE: Could not resolve `standardFields.fields.field_1` in messages for locale `en`.
```

`useFieldLabel` Hook 將所有欄位名稱（包括動態/自訂名稱如 `field_1`）直接作為 i18n key 查詢 `standardFields.json`，但該檔案只包含 52 個標準發票欄位。對於不存在的 key，next-intl 在 dev 環境拋出 `IntlError`。

雖然 Hook 內有 try-catch 回退機制，但 next-intl 的錯誤在 React 渲染階段拋出，導致 console 仍然顯示大量紅色錯誤訊息。

### 影響範圍

| 組件 | 檔案 | 症狀 |
|------|------|------|
| InstanceRowsTable | `template-instance/InstanceRowsTable.tsx:150` | 表格列標題顯示時報錯 |
| RowEditDialog | `template-instance/RowEditDialog.tsx:66` | 編輯行資料時報錯 |
| RowDetailDrawer | `template-instance/RowDetailDrawer.tsx:101` | 查看行詳情時報錯 |
| ExportFieldSelector | `template-instance/ExportFieldSelector.tsx:83` | 匯出欄位選擇時報錯 |

---

## 重現步驟

1. 建立一個 DataTemplate，使用預設欄位（`field_1`, `field_2` 等）
2. 建立對應的 Template Instance
3. 前往 `/template-instances/[id]`
4. 打開瀏覽器 DevTools → Console
5. 觀察現象：大量 `IntlError: MISSING_MESSAGE: Could not resolve standardFields.fields.field_1` 錯誤

---

## 根本原因

### 1. useFieldLabel 無條件嘗試 i18n 查詢

`src/hooks/use-field-label.ts:48-49`：

```typescript
const key = `fields.${field.name}` as Parameters<typeof tFields>[0];
return tFields(key);  // ← 對 'field_1' 直接拋出 IntlError
```

Hook 對**所有**欄位名稱都嘗試 i18n 查詢，但 `standardFields.json` 只定義了 52 個標準欄位（如 `invoice_number`, `sea_freight`）。自訂欄位名稱（如 `field_1`, `custom_cost`）不在其中。

### 2. try-catch 無法完全抑制 next-intl 錯誤

next-intl 在 dev 環境下使用 `onError` 回調拋出錯誤，這些錯誤在 catch 之前就已經被 console.error 輸出。雖然 catch 區塊會回退到 `field.label`，但 console 中仍然充滿紅色錯誤。

### 3. 預設欄位名稱不是標準欄位

`DataTemplateForm.tsx:114` 建立預設欄位時使用 `field_1`, `field_2` 等名稱，這些不在 `standardFields.json` 中。

---

## 解決方案

### 修復 useFieldLabel Hook：先檢查再查詢

在呼叫 `tFields()` 之前，先使用 `tFields.has()` 檢查 key 是否存在：

```typescript
export function useFieldLabel() {
  const tFields = useTranslations('standardFields');

  return useCallback(
    (field: DataTemplateField): string => {
      const key = `fields.${field.name}` as Parameters<typeof tFields>[0];
      // 先檢查翻譯 key 是否存在，避免 IntlError
      if (tFields.has(key)) {
        return tFields(key);
      }
      // 非標準欄位 — 使用存儲的 label
      return field.label;
    },
    [tFields]
  );
}
```

**關鍵變更**：
- 移除 try-catch（不再需要異常處理）
- 使用 `tFields.has(key)` 進行前置檢查
- 對於非標準欄位，直接使用 `field.label` 回退

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/hooks/use-field-label.ts` | 將 try-catch 改為 `tFields.has()` 前置檢查 |

---

## 測試驗證

修復完成後需驗證：

- [ ] 標準欄位（如 `invoice_number`）仍顯示翻譯後的標籤（如 "Invoice Number"）
- [ ] 自訂欄位（如 `field_1`）顯示存儲的 `field.label`（如 "Field 1"）
- [ ] 瀏覽器 console 無 `IntlError: MISSING_MESSAGE` 錯誤
- [ ] InstanceRowsTable、RowEditDialog、RowDetailDrawer、ExportFieldSelector 正常顯示
- [ ] TypeScript 類型檢查通過：`npx tsc --noEmit`

---

*文件建立日期: 2026-02-14*
*最後更新: 2026-02-14 (已修復)*
