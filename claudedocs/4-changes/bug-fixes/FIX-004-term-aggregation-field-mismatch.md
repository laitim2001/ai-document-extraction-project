# FIX-004: 術語聚合欄位名稱不匹配

> **發現日期**: 2025-12-27
> **修復日期**: 2025-12-27
> **狀態**: ✅ 已修復
> **嚴重程度**: Critical
> **影響範圍**: Epic 0 - 術語聚合功能完全失效

---

## 1. 問題描述

術語聚合功能返回 0 個術語，導致 Excel 報告中所有術語相關數據顯示為空。

### 症狀
- TEST-PLAN-002 執行成功（5/5 文件處理完成）
- 發行者識別正常（識別出 5 個發行者，創建 2 個新公司）
- 批次狀態正確顯示為 `COMPLETED`
- **但術語聚合結果為 0**
- Excel 匯出報告中所有術語、公司相關數據為空

---

## 2. 根本原因

`batch-term-aggregation.service.ts` 中的 `ExtractionResultJson` 介面與實際 AI 服務返回格式不匹配：

### 錯誤的介面定義 (Line 94-98)
```typescript
invoiceData?: {
  items?: Array<{  // ❌ 錯誤：使用 "items"
    description?: string | null;
  }>;
};
```

### 實際 AI 服務返回格式
```typescript
// azure-di.service.ts & gpt-vision.service.ts
invoiceData?: {
  lineItems?: Array<{  // ✅ 正確：使用 "lineItems"
    description?: string | null;
    name?: string | null;
    chargeType?: string | null;
    amount?: number | null;
  }>;
};
```

### 提取邏輯錯誤 (Line 130)
```typescript
// 錯誤
result.invoiceData?.items

// 正確
result.invoiceData?.lineItems
```

---

## 3. 修復方案

### 修改文件
1. `src/services/batch-term-aggregation.service.ts` - 批次術語聚合（API 使用）
2. `src/services/hierarchical-term-aggregation.service.ts` - 階層術語聚合（Excel 匯出使用）

### 修改內容

#### 3.0 重要發現（FIX-004b）
初次修復只修正了 `batch-term-aggregation.service.ts`，但 Excel 匯出功能使用的是另一個服務 `hierarchical-term-aggregation.service.ts`，該服務有相同的欄位名稱錯誤。

**影響**：
- API `/api/v1/batches/{id}/term-stats` 使用 batch-term-aggregation.service.ts ✅
- API `/api/v1/batches/{id}/hierarchical-terms/export` 使用 hierarchical-term-aggregation.service.ts ❌

因此需要同時修復兩個文件。

#### 3.1 修正介面定義 (Line 94-101)
```typescript
// Before
invoiceData?: {
  items?: Array<{
    description?: string | null;
  }>;
};

// After
invoiceData?: {
  lineItems?: Array<{
    description?: string | null;
    name?: string | null;
    chargeType?: string | null;
    amount?: number | null;
  }>;
};
```

#### 3.2 修正提取邏輯 (Line 129-136)
```typescript
// Before
const items =
  result.lineItems ??
  result.items ??
  result.invoiceData?.items ??
  result.extractedData?.lineItems ??
  [];

// After
// Azure DI 和 GPT Vision 都返回 invoiceData.lineItems 格式
const items =
  result.lineItems ??
  result.items ??
  result.invoiceData?.lineItems ??
  result.extractedData?.lineItems ??
  [];
```

#### 3.3 修正 hierarchical-term-aggregation.service.ts

**介面定義 (Line 74)**
```typescript
// Before
invoiceData?: { items?: Array<{ description?: string | null }> };

// After
invoiceData?: { lineItems?: Array<{ description?: string | null }> };
```

**提取邏輯 (Line 494)**
```typescript
// Before
result.invoiceData?.items ??

// After
result.invoiceData?.lineItems ??
```

---

## 4. 驗證方式

1. 重新執行現有批次的術語聚合
2. 確認術語數量 > 0
3. 匯出 Excel 報告確認數據正確

---

## 5. 影響分析

| 影響項目 | 說明 |
|----------|------|
| **影響功能** | Epic 0 術語聚合、Excel 報告匯出 |
| **影響範圍** | 所有已處理批次的術語統計 |
| **回溯影響** | 需重新執行術語聚合以獲取正確數據 |
| **風險等級** | 無風險（僅修正介面定義和欄位名稱） |

---

## 6. 相關文件

| 文件 | 說明 |
|------|------|
| `src/services/batch-term-aggregation.service.ts` | 批次術語聚合服務（已修復 FIX-004） |
| `src/services/hierarchical-term-aggregation.service.ts` | 階層術語聚合服務（已修復 FIX-004b） |
| `src/app/api/v1/batches/[batchId]/hierarchical-terms/export/route.ts` | Excel 匯出 API |
| `src/services/azure-di.service.ts` | Azure DI 服務（參考格式） |
| `src/services/gpt-vision.service.ts` | GPT Vision 服務（參考格式） |
| `TEST-PLAN-002` | 觸發此問題的測試計劃 |

---

**修復者**: Claude Code AI 助手
**審核者**: -
**修復日期**: 2025-12-27
