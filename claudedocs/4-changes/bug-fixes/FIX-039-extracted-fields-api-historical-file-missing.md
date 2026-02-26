# FIX-039: extracted-fields API 查詢不存在的 HistoricalFile 表

> **建立日期**: 2026-02-12
> **發現方式**: CHANGE-039 UI 驗證測試
> **影響頁面/功能**: `/api/v1/formats/[id]/extracted-fields` API + Template Field Mapping 表單動態來源欄位
> **優先級**: P1
> **狀態**: ✅ 已修復
> **相關**: CHANGE-039（Template Field Mapping Dynamic Source Fields）

---

## 問題描述

`/api/v1/formats/[id]/extracted-fields` API 在 L88 查詢 `prisma.historicalFile`，但 `historical_files` 資料表在目前的資料庫中**不存在**（僅存在於 Prisma Schema 定義中，從未建立 migration）。

這導致 API 在呼叫時直接拋出 `P1014: The underlying table for model 'HistoricalFile' does not exist` 錯誤，catch 區塊將其包裝為 500 Internal Server Error 返回。實際效果是**所有格式的動態提取欄位永遠為空**，CHANGE-039 的動態來源欄位功能完全無法運作。

### 影響範圍

| 項目 | 影響 |
|------|------|
| Template Field Mapping 建立/編輯頁面 | Scope=FORMAT 時動態欄位不顯示 |
| SourceFieldCombobox 動態欄位區塊 | 永遠顯示「No extracted fields found」 |
| 使用者體驗 | 無法看到實際提取的欄位名稱，只能手動輸入 |

---

## 重現步驟

1. 前往 `/admin/template-field-mappings/new`
2. Scope 選擇 `FORMAT`
3. 選擇一個有已處理文件的 Document Format
4. 點擊 Source Field 下拉選單
5. 觀察：動態提取欄位區塊為空（只有標準欄位 + 自訂輸入）

**API 直接測試**:
```
GET /api/v1/formats/{formatId}/extracted-fields
→ 500 Internal Server Error
→ Error: The underlying table for model 'HistoricalFile' does not exist
```

---

## 根本原因

### 1. HistoricalFile 表不存在

`prisma/schema.prisma` L2790 定義了 `model HistoricalFile`（映射到 `historical_files` 表），但此表從未通過 Prisma migration 建立。這是 Epic 0/16 的歷史遺留問題 — 模型定義存在但沒有對應的資料庫表。

### 2. API 使用了錯誤的數據源

`route.ts` L88 使用 `prisma.historicalFile.findMany()` 查詢提取結果，但實際上：
- 文件的提取結果存儲在 **`ExtractionResult`** 模型中（透過 `documentId` 關聯 `Document`）
- `ExtractionResult.fieldMappings` (Json) 包含已映射的欄位資訊（source → target）
- `ExtractionResult.stage1Result` (Json) 包含 Stage 1 GPT 提取的原始欄位

### 3. Document 模型缺少 documentFormatId 直接關聯

`Document` 模型沒有 `documentFormatId` 欄位，無法直接查詢「屬於某個格式的所有文件」。需要透過以下間接路徑：
```
DocumentFormat.companyId → Document.companyId → ExtractionResult.documentId
```

---

## 解決方案

### 修改 `src/app/api/v1/formats/[id]/extracted-fields/route.ts`

將 `prisma.historicalFile` 查詢替換為 `prisma.extractionResult` + `prisma.document` 的聯合查詢：

**新查詢邏輯**:
```typescript
// 1. 從 DocumentFormat 取得 companyId
const format = await prisma.documentFormat.findUnique({
  where: { id },
  select: { id: true, companyId: true, name: true },
});

// 2. 查詢該公司最近 20 個已完成提取的文件結果
const results = await prisma.extractionResult.findMany({
  where: {
    document: {
      companyId: format.companyId,
    },
    status: 'COMPLETED',
  },
  select: {
    fieldMappings: true,
    stage1Result: true,
  },
  orderBy: { updatedAt: 'desc' },
  take: 20,
});
```

**欄位提取邏輯**:
- 從 `stage1Result` 提取 GPT 原始欄位名稱（invoiceData / gptExtraction.fields）
- 從 `fieldMappings` 提取已映射的 source field 名稱
- 合併去重，按出現頻率排序

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/app/api/v1/formats/[id]/extracted-fields/route.ts` | 將 `prisma.historicalFile` 查詢替換為 `prisma.extractionResult` + Document 關聯查詢；更新 `extractFieldsFromData` 以處理 `fieldMappings` 和 `stage1Result` 兩種數據結構 |

---

## 測試驗證

修復完成後需驗證：

- [ ] API 不再返回 500 錯誤：`GET /api/v1/formats/{formatId}/extracted-fields` → 200
- [ ] 有提取記錄的格式返回非空 `fields` 陣列
- [ ] 欄位包含正確的 `name`、`occurrences`、`sampleValues`
- [ ] Template Field Mapping 表單 Scope=FORMAT 時動態欄位正確顯示
- [ ] 無提取記錄的格式返回空 `fields` 陣列（不是 500 錯誤）
- [ ] TypeScript 類型檢查通過：`npx tsc --noEmit`

---

*文件建立日期: 2026-02-12*
*最後更新: 2026-02-12*
