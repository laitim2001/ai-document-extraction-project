# CHANGE-001: OMExpense 來源追蹤

> **建立日期**: 2025-12-01
> **完成日期**: 2025-12-01
> **狀態**: ✅ 已完成 (Phase 1+2+3)
> **類型**: 資料模型增強
> **優先級**: High

---

## 問題描述

### 業務背景
用戶的業務流程中，OM 費用（營運維護費用）應該是由專案費用（Expense）演變而來：
- 專案產生的一次性費用，如果需要每年持續發生，就會轉變為 OM 費用
- OM 費用不會「突然出現」，必定有其來源費用

### 目前問題
- `OMExpense` 模型沒有任何欄位追蹤其來源
- 無法知道某筆 OM 費用是從哪個 `Expense` 轉換而來
- 無法透過 OM 費用追溯到原始專案

### 預期行為
- `OMExpense` 應該可以關聯到來源 `Expense`
- 可以透過 `sourceExpense → PurchaseOrder → Project` 追蹤到專案

---

## 根本原因

資料模型設計時，將 `OMExpense` 視為獨立模組，未考慮其與專案費用的關聯性。

---

## 解決方案

### 方案：新增 sourceExpenseId 欄位

在 `OMExpense` 模型新增 `sourceExpenseId` 欄位，建立與 `Expense` 的可選關聯。

```prisma
model OMExpense {
  // ... 現有欄位 ...

  // 新增: 來源費用追蹤
  sourceExpenseId String?   // 若由 Expense 轉換而來，記錄原始費用 ID
  sourceExpense   Expense?  @relation(fields: [sourceExpenseId], references: [id])
}

model Expense {
  // ... 現有欄位 ...

  // 新增: 反向關聯
  derivedOMExpenses OMExpense[]  // 從此費用衍生的 OM 費用
}
```

### 為什麼不直接加 projectId？
- 可以透過 `sourceExpense.purchaseOrder.project` 間接取得專案
- 避免資料冗餘
- 保留彈性（未來 OM 費用可能有其他來源）

---

## 影響範圍

### 修改文件
| 文件 | 變更說明 |
|------|----------|
| `packages/db/prisma/schema.prisma` | 新增 `sourceExpenseId` 欄位和關聯 |
| `packages/api/src/routers/omExpense.ts` | 更新 CRUD 操作支援新欄位 |
| `apps/web/src/components/om-expense/OMExpenseForm.tsx` | 新增來源費用選擇器 |
| `apps/web/src/messages/zh-TW.json` | 新增翻譯 key |
| `apps/web/src/messages/en.json` | 新增翻譯 key |

### 資料庫遷移
- 新增可選欄位，現有資料不受影響
- 無需資料遷移腳本

---

## 測試驗證

### 功能測試
- [x] 可以建立沒有來源費用的 OM 費用（向後兼容）- API 支援
- [x] 可以建立有來源費用的 OM 費用 - API 支援
- [x] 可以透過 OM 費用查詢來源費用詳情 - getById 已包含 sourceExpense
- [x] 可以透過來源費用查詢衍生的 OM 費用列表 - 新增 getBySourceExpenseId

### 回歸測試
- [x] 現有 OM 費用 CRUD 功能正常 - 向後兼容
- [x] 現有 Expense CRUD 功能正常 - 無影響
- [x] TypeScript 編譯通過
- [x] ESLint 檢查通過（僅 warnings，無 errors）

---

## 實施計劃

### Phase 1: Schema 修改 ✅ 已完成
1. ✅ 修改 `schema.prisma` - 新增 `sourceExpenseId` 到 OMExpense，新增 `derivedOMExpenses` 到 Expense
2. ✅ 執行 `pnpm db:generate` - Prisma Client 已重新生成
3. ✅ 執行 `pnpm db push` - 資料庫已同步 (使用 db push 代替 migrate dev)

### Phase 2: API 更新 ✅ 已完成
1. ✅ 更新 `omExpense.ts` router
2. ✅ 新增 `getBySourceExpenseId` 查詢
3. ✅ 更新 `create` 和 `update` mutation（包含 sourceExpenseId 驗證）
4. ✅ 更新所有 include 加入 sourceExpense 關聯

### Phase 3: 前端更新 ✅ 已完成
1. ✅ 更新 `OMExpenseForm.tsx` - 新增 sourceExpenseId 欄位
2. ✅ 新增來源費用選擇器（下拉選單）
3. ✅ 更新 i18n 翻譯（zh-TW.json 和 en.json）
4. ✅ 顯示關聯專案和採購單資訊

---

## 相關文檔
- [業務流程分析](../../業務流程分析報告.md)
- [CHANGE-002: ExpenseItem ChargeOut 目標](./CHANGE-002-expenseitem-chargeout-target.md)

---

**最後更新**: 2025-12-01
