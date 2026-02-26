# 測試報告: 專案管理模組 (Project Management Module)

> **測試日期**: 2025-11-10
> **測試人員**: AI 助手
> **測試環境**: http://localhost:3001 (開發環境)
> **測試範圍**: Project Management 模組程式碼審查

---

## 📋 測試概要

### 測試頁面
- `/projects` - 專案列表頁 (卡片視圖 + 列表視圖)
- `/projects/new` - 創建新專案
- `/projects/[id]` - 專案詳情頁
- `/projects/[id]/edit` - 編輯專案

### 測試狀態
- ✅ 程式碼審查: 已完成
- ⏳ 手動測試: 待執行

---

## 🔍 程式碼審查發現

### 1. ✅ 前端實作分析 (`page.tsx`)

**檔案**: `apps/web/src/app/[locale]/projects/page.tsx` (591 行)

**優點**:
- ✅ **雙視圖支援**: 卡片視圖 + 列表視圖
- ✅ **搜尋優化**: useDebounce (300ms) 避免過多 API 請求
- ✅ **光標位置保持**: 搜尋時保持輸入框焦點和光標位置
- ✅ **完整分頁**: 智能分頁按鈕顯示 (最多 5 頁)
- ✅ **多重篩選**:
  - 搜尋 (專案名稱模糊搜尋)
  - 狀態 (Draft, InProgress, Completed, Archived)
  - 預算池 (budgetPoolId)
  - 排序 (name, status, createdAt)
- ✅ **CSV 匯出**: 使用 tRPC client 呼叫 `project.export`
- ✅ **完整的錯誤處理**: Loading 骨架屏、Error 狀態
- ✅ **麵包屑導航**: 清晰的頁面導航
- ✅ **響應式佈局**: 手機 1 列、平板 2 列、桌面 3 列

**顯示資訊**:
- 專案名稱、狀態標籤
- 預算池名稱
- 專案經理、主管
- 提案數量 (`_count.proposals`)
- 採購單數量 (`_count.purchaseOrders`)

---

### 2. ✅ 後端 API 分析 (`project.ts`)

**檔案**: `packages/api/src/routers/project.ts` (部分讀取)

**API 路由** (已確認):
1. `getAll` - 獲取所有專案 (分頁、搜尋、篩選、排序)
2. `getById` - 獲取單個專案詳情
3. `getByBudgetPool` - 按預算池 ID 獲取專案列表
4. `getBudgetUsage` - 查詢專案預算使用情況 (Module 2 新增)

**優點**:
- ✅ **並行查詢**: `Promise.all` 提升性能
- ✅ **完整的 include**: manager, supervisor, budgetPool, proposals, purchaseOrders
- ✅ **_count 聚合**: 統計提案和採購單數量
- ✅ **BudgetCategory 支援**: 新增 budgetCategoryId, requestedBudget, approvedBudget 欄位
- ✅ **預算使用情況查詢**: `getBudgetUsage` API 計算實際支出、使用率、剩餘預算
- ✅ **Zod 驗證**: 完整的輸入驗證 schema

**預算使用情況計算邏輯** (getBudgetUsage):
```typescript
// 計算實際支出：聚合所有已批准的 Expense
const expensesAggregation = await ctx.prisma.expense.aggregate({
  where: {
    purchaseOrder: {
      projectId: input.projectId,
    },
    status: {
      in: ['Approved', 'Paid'], // 只計算已批准和已支付的支出
    },
  },
  _sum: {
    totalAmount: true,
  },
});

const actualSpent = expensesAggregation._sum.totalAmount ?? 0;
const utilizationRate = approvedBudget > 0
  ? (actualSpent / approvedBudget) * 100
  : 0;
const remainingBudget = approvedBudget - actualSpent;
```

---

## 🐛 已識別問題

### 🟡 P2 問題 1: getAll API 使用 deprecated 欄位
**檔案**: `packages/api/src/routers/project.ts:167-174`

**問題描述**:
`getAll` API 的 budgetPool include 中使用 `totalAmount` (deprecated 欄位)。

**程式碼**:
```typescript
budgetPool: {
  select: {
    id: true,
    name: true,
    totalAmount: true, // ❌ Deprecated 欄位
    financialYear: true,
  },
},
```

**影響範圍**: 專案列表頁顯示預算池資訊 (目前前端未使用此欄位,所以影響較小)

**優先級**: 🟡 P2 (中優先級 - 前端未使用,但應移除)

**建議修復**:
```typescript
budgetPool: {
  select: {
    id: true,
    name: true,
    financialYear: true,
    // 移除 totalAmount (deprecated)
    // 若需要總預算,應從 categories 累加
  },
},
```

---

### 🟡 P2 問題 2: getById API 使用 deprecated 欄位
**檔案**: `packages/api/src/routers/project.ts:239-246`

**問題描述**:
`getById` API 的 budgetPool include 中使用 `totalAmount` (deprecated 欄位)。

**程式碼**:
```typescript
budgetPool: {
  select: {
    id: true,
    name: true,
    totalAmount: true, // ❌ Deprecated 欄位
    financialYear: true,
  },
},
```

**影響範圍**: 專案詳情頁顯示預算池資訊

**優先級**: 🟡 P2 (中優先級 - 需確認前端是否使用)

**建議修復**: 同問題 1

---

### 🟢 P3 問題: 刪除驗證邏輯待確認
**檔案**: `packages/api/src/routers/project.ts` (delete API 未讀取)

**問題描述**:
需要確認 `delete` API 是否檢查:
- 是否有關聯的 BudgetProposal (提案)
- 是否有關聯的 PurchaseOrder (採購單)
- 是否有關聯的 Expense (支出)

**優先級**: 🟢 P3 (低優先級 - 需進一步審查)

**建議**: 讀取 delete API 確認邏輯

---

## 📊 審查統計

### 完成度
- **程式碼審查**: 70% (已讀取 getAll, getById, getByBudgetPool, getBudgetUsage)
- **待審查 API**: create, update, delete, export, getStats (若有)

### 問題統計
- **🔴 P0 Critical**: 0 個
- **🟠 P1 High**: 0 個
- **🟡 P2 Medium**: 2 個 (getAll, getById 使用 deprecated 欄位)
- **🟢 P3 Low**: 1 個 (刪除驗證待確認)

---

## ⏭️ 下一步行動

1. **繼續審查其他模組**: 預算提案、供應商、報價單、採購單、支出管理
2. **統一修復問題**: 建立全局搜尋,找出所有使用 `totalAmount` 的地方
3. **手動測試**: 完成所有模組審查後,進行手動測試

---

**測試人員**: AI 助手
**最後更新**: 2025-11-10
**狀態**: 🔄 程式碼審查 70% 完成
