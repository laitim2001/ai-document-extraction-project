# Issue: ExpensesPage HotReload 導致 E2E 測試失敗

**創建日期**: 2025-10-31
**優先級**: 🟡 Medium
**類型**: 🐛 Bug - E2E 測試穩定性
**狀態**: 📋 待修復

---

## 📝 問題描述

ExpensesPage (`apps/web/src/app/expenses/page.tsx`) 在開發模式下執行 E2E 測試時，持續觸發 React HotReload 錯誤，導致測試無法穩定通過。

### 症狀

```
❌ 瀏覽器控制台錯誤: Warning: Cannot update a component (`HotReload`)
while rendering a different component (`ExpensesPage`).

Error: page.click: Target page, context or browser has been closed
```

### 影響範圍

- **測試**: procurement-workflow.spec.ts Step 4
- **環境**: 開發模式 (Next.js dev server)
- **瀏覽器**: Chromium (Playwright)
- **穩定性**: 即使使用重試機制（3次），仍然 100% 失敗率

---

## 🔍 根本原因分析

### 問題時序

1. **測試導航**: `await page.goto('/expenses')`
2. **頁面載入**: ExpensesPage 開始渲染
3. **tRPC 查詢**: 3 個並發查詢開始執行
   - `api.expense.getAll.useQuery()`
   - `api.purchaseOrder.getAll.useQuery()`
   - `api.expense.getStats.useQuery()`
4. **HMR 觸發**: Next.js 檢測到潛在模組更新
5. **React 錯誤**: HotReload 組件在 ExpensesPage 渲染期間嘗試更新狀態
6. **Error Boundary**: React Error Boundary 被觸發
7. **瀏覽器崩潰**: Playwright 上下文關閉

### 為何其他頁面沒有此問題？

ExpensesPage 特殊之處：
- ✅ **3 個並發 tRPC 查詢**（其他頁面通常 1-2 個）
- ✅ **複雜的篩選狀態管理**（status, purchaseOrderId, page, viewMode）
- ✅ **條件渲染**（卡片視圖 vs 列表視圖）
- ✅ **大量的 UI 組件**（表格、卡片、分頁、篩選器）

---

## 🛠️ 已嘗試的修復方案

### ❌ FIX-039-REVISED: tRPC 查詢配置
**修改**: 添加 `refetchOnMount: false` 等配置到所有查詢
**結果**: 部分減少問題頻率，但 HotReload 錯誤仍然出現

### ❌ FIX-039-REVISED-V2: 增強容錯機制
**修改**:
- 使用 `domcontentloaded` 替代 `networkidle`
- 添加 3 次重試機制
- 增加穩定等待時間

**結果**: 重試機制正常工作，但每次重試都遇到相同錯誤

### ✅ FIX-043: 臨時方案（當前使用）
**修改**: 直接導航到 `/expenses/new`，跳過列表頁
**結果**: 繞過問題，但失去了對列表頁的測試覆蓋

---

## 💡 可能的永久解決方案

### 方案 1: 優化 ExpensesPage 渲染邏輯

**目標**: 減少渲染期間的狀態更新

**可能的改進**:
1. **延遲載入統計資訊**:
   ```typescript
   // 將 stats 查詢設為手動觸發，避免初始載入競爭
   const { data: stats, refetch: refetchStats } = api.expense.getStats.useQuery(undefined, {
     enabled: false, // 手動控制
     refetchOnMount: false,
   });

   useEffect(() => {
     // 在主查詢完成後再載入統計
     if (data) {
       refetchStats();
     }
   }, [data]);
   ```

2. **合併查詢**:
   ```typescript
   // 考慮在後端創建一個組合查詢，減少並發請求
   const { data } = api.expense.getPageData.useQuery({
     page,
     limit: 10,
     status,
     purchaseOrderId,
   });
   ```

3. **Suspense 邊界**:
   ```typescript
   // 使用 React Suspense 分離查詢邊界
   <Suspense fallback={<Loading />}>
     <ExpensesList />
   </Suspense>
   <Suspense fallback={<StatsSkeleton />}>
     <ExpenseStats />
   </Suspense>
   ```

### 方案 2: 禁用該頁面的 Fast Refresh

**實施**:
```typescript
// apps/web/src/app/expenses/page.tsx
'use client';

// 暫時禁用 Fast Refresh 直到找到根本原因
// @refresh reset

export default function ExpensesPage() {
  // ... 現有代碼
}
```

**優點**: 簡單快速
**缺點**: 失去該頁面的熱更新功能

### 方案 3: 使用生產模式測試

**時機**: Pre-Production、CI/CD Pipeline
**實施**:
```bash
pnpm build
pnpm start
pnpm test:e2e
```

**優點**: 完全避免 HMR 問題
**缺點**: 不適合日常開發階段

---

## 📋 待辦事項

- [ ] 深入分析 ExpensesPage 的 React 組件樹和狀態流
- [ ] 嘗試方案 1：優化查詢策略
- [ ] 測試方案 1 的效果
- [ ] 如果方案 1 成功，移除 FIX-043 臨時方案
- [ ] 如果方案 1 失敗，考慮方案 2（禁用 Fast Refresh）
- [ ] 更新 E2E 測試以覆蓋列表頁完整流程

---

## 🔗 相關文件

- **測試文件**: `apps/web/e2e/workflows/procurement-workflow.spec.ts:357-369`
- **問題頁面**: `apps/web/src/app/expenses/page.tsx`
- **修復記錄**:
  - FIXLOG.md - FIX-039-REVISED
  - FIXLOG.md - FIX-039-REVISED-V2
  - FIXLOG.md - FIX-043 (臨時方案)

---

## 💬 備註

**為何不在開發階段使用生產模式測試？**

在開發階段使用生產模式測試會：
- ❌ 每次代碼變更都需要重新 build（耗時）
- ❌ 失去熱更新能力（降低開發效率）
- ❌ 增加測試回饋循環時間

**最佳實踐建議**:
- ✅ 開發階段：使用增強容錯性的測試策略
- ✅ Pre-Production：使用生產模式進行最終驗證
- ✅ CI/CD Pipeline：使用生產模式自動化測試
