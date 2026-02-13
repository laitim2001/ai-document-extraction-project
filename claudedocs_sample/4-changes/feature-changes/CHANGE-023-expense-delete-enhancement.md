# CHANGE-023: Expense Delete Enhancement

> **建立日期**: 2025-12-15
> **完成日期**: 2025-12-15
> **狀態**: ✅ 已完成
> **優先級**: Medium
> **類型**: 現有功能增強

---

## 1. 變更概述

### 1.1 背景
目前 Expense（費用）頁面缺少刪除功能，雖然後端 API 已有 `expense.delete` procedure，但前端沒有實現相應的 UI。此外，也沒有批量刪除功能。

### 1.2 目標
- 在前端實現單一刪除功能（調用現有 API）
- 新增批量刪除功能（API + 前端）
- 保持現有的狀態限制邏輯（僅 Draft 可刪，Rejected 也不可刪）
- 新增狀態回退功能（將任何非 Draft 狀態退回 Draft）

---

## 2. 現有實現分析

### 2.1 數據模型
```prisma
model Expense {
  id               String   @id @default(uuid())
  name             String
  description      String?
  totalAmount      Float
  currencyId       String?
  status           String   @default("Draft")  // Draft, PendingApproval, Approved, Paid, Rejected
  invoiceNumber    String?
  invoiceDate      DateTime
  invoiceFilePath  String?
  requiresChargeOut Boolean @default(false)
  isOperationMaint  Boolean @default(false)
  purchaseOrderId  String
  budgetCategoryId String?
  vendorId         String?
  expenseDate      DateTime
  approvedDate     DateTime?
  paidDate         DateTime?

  purchaseOrder  PurchaseOrder
  items          ExpenseItem[]    // onDelete: Cascade
  chargeOutItems ChargeOutItem[]  // 關聯的 ChargeOut 明細
  derivedOMExpenses OMExpense[]   // 衍生的 OM 費用
}
```

### 2.2 現有 API (`packages/api/src/routers/expense.ts`)
```typescript
delete: protectedProcedure
  .input(z.object({ id: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    // 檢查費用是否存在
    // 只有 Draft 狀態才能刪除
    if (expense.status !== 'Draft') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: '只有草稿狀態的費用才能刪除',
      });
    }
    // 刪除費用（items 會 Cascade 刪除）
  })
```

### 2.3 刪除限制（確認後）
| 限制條件 | 說明 |
|---------|------|
| **狀態 = Draft** | ✅ 可刪除 |
| **狀態 ≠ Draft** | ❌ 不可刪除（需先退回 Draft） |
| **有 ChargeOutItem 關聯** | ❌ 不可刪除（無強制刪除選項） |

### 2.4 狀態說明（確認後）
| 狀態 | 可否刪除 | 可否退回 Draft |
|------|---------|---------------|
| Draft | ✅ 可刪除 | - |
| PendingApproval | ❌ 不可刪除 | ✅ 可退回 |
| Approved | ❌ 不可刪除 | ✅ 可退回 |
| Paid | ❌ 不可刪除 | ✅ 可退回 |
| Rejected | ❌ 不可刪除 | ✅ 可退回 |

### 2.5 現有前端頁面
- **列表頁**: `apps/web/src/app/[locale]/expenses/page.tsx`
- **詳情頁**: `apps/web/src/app/[locale]/expenses/[id]/page.tsx`

---

## 3. 變更需求

### 3.1 後端 API
| API | 狀態 | 說明 |
|-----|------|------|
| `expense.delete` | ⚠️ 需修改 | 增加 ChargeOut 關聯檢查（無強制刪除） |
| `expense.deleteMany` | ❌ 需新增 | 批量刪除 |
| `expense.revertToDraft` | ❌ 需新增 | 將任何非 Draft 狀態退回 Draft |

### 3.2 前端功能
| 功能 | 狀態 | 說明 |
|------|------|------|
| 單一刪除按鈕 | ❌ 需新增 | 列表 + 詳情頁（僅 Draft 顯示） |
| 批量刪除 | ❌ 需新增 | Checkbox 多選 |
| 確認對話框 | ❌ 需新增 | AlertDialog |
| 退回至 Draft 按鈕 | ❌ 需新增 | 適用於所有非 Draft 狀態 |

---

## 4. 技術設計

### 4.1 修改 API: `expense.delete`
```typescript
delete: protectedProcedure
  .input(z.object({
    id: z.string().min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const expense = await ctx.prisma.expense.findUnique({
      where: { id: input.id },
      include: {
        chargeOutItems: true,
      },
    });

    if (!expense) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '費用不存在' });
    }

    // 狀態檢查：僅 Draft 可刪
    if (expense.status !== 'Draft') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `只有草稿狀態的費用可以刪除（當前狀態：${expense.status}）`,
      });
    }

    // ChargeOut 關聯檢查（無強制刪除選項）
    if (expense.chargeOutItems.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `此費用已有 ${expense.chargeOutItems.length} 筆費用轉嫁記錄關聯，無法刪除`,
      });
    }

    // 刪除費用（items 會 Cascade 刪除）
    await ctx.prisma.expense.delete({ where: { id: input.id } });

    return { success: true };
  })
```

### 4.2 新增 API: `expense.deleteMany`
```typescript
deleteMany: protectedProcedure
  .input(z.object({
    ids: z.array(z.string().min(1)).min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const results = { deleted: 0, skipped: 0, errors: [] as { id: string; reason: string }[] };

    for (const id of input.ids) {
      const expense = await ctx.prisma.expense.findUnique({
        where: { id },
        include: { chargeOutItems: true },
      });

      if (!expense) {
        results.errors.push({ id, reason: 'NOT_FOUND' });
        continue;
      }

      // 狀態檢查：僅 Draft 可刪
      if (expense.status !== 'Draft') {
        results.skipped++;
        results.errors.push({ id, reason: `INVALID_STATUS: ${expense.status}` });
        continue;
      }

      // ChargeOut 關聯檢查
      if (expense.chargeOutItems.length > 0) {
        results.skipped++;
        results.errors.push({ id, reason: `HAS_CHARGEOUT: ${expense.chargeOutItems.length}` });
        continue;
      }

      // 刪除
      await ctx.prisma.expense.delete({ where: { id } });
      results.deleted++;
    }

    return results;
  })
```

### 4.3 新增 API: `expense.revertToDraft`
```typescript
revertToDraft: protectedProcedure
  .input(z.object({
    id: z.string().min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const expense = await ctx.prisma.expense.findUnique({
      where: { id: input.id },
    });

    if (!expense) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '費用不存在' });
    }

    // 已經是 Draft 就不需要退回
    if (expense.status === 'Draft') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: '費用已經是草稿狀態',
      });
    }

    // 更新狀態為 Draft，清除審批相關日期
    await ctx.prisma.expense.update({
      where: { id: input.id },
      data: {
        status: 'Draft',
        approvedDate: null,
        paidDate: null,
      },
    });

    return { success: true };
  })
```

### 4.4 前端組件設計
- 複用 CHANGE-019 (Project Delete) 的模式
- 添加 Checkbox 到列表行
- 僅對 Draft 狀態的費用顯示刪除按鈕
- 對非 Draft 狀態顯示「退回草稿」按鈕
- 使用 AlertDialog 確認

---

## 5. 影響範圍

### 5.1 後端文件
| 文件 | 變更 |
|------|------|
| `packages/api/src/routers/expense.ts` | 修改 `delete`，新增 `deleteMany`、`revertToDraft` |

### 5.2 前端文件
| 文件 | 變更 |
|------|------|
| `apps/web/src/app/[locale]/expenses/page.tsx` | 添加刪除 UI、退回草稿按鈕 |
| `apps/web/src/app/[locale]/expenses/[id]/page.tsx` | 添加刪除按鈕、退回草稿按鈕 |
| `apps/web/src/messages/en.json` | 新增翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 新增翻譯鍵 |

---

## 6. 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|---------|
| 誤刪有 ChargeOut 關聯的費用 | 低 | 關聯檢查禁止刪除，無強制刪除 |
| 財務數據丟失 | 低 | 僅 Draft 可刪 |
| 退回草稿後的數據一致性 | 中 | 清除審批日期、支付日期 |

---

## 7. 工作量估算

| 任務 | 時間 |
|------|------|
| 後端 `delete` 修改 + `deleteMany` API | 1 小時 |
| 後端 `revertToDraft` API | 0.5 小時 |
| 前端刪除 UI + 退回草稿按鈕 | 2 小時 |
| i18n 翻譯 | 0.5 小時 |
| 測試驗證 | 0.5 小時 |
| **總計** | **4.5 小時** |

---

## 8. 驗收標準

- [x] 單一費用可通過按鈕刪除（僅 Draft 狀態）
- [x] 批量選擇並刪除多個 Draft 費用
- [x] 僅 Draft 狀態可刪除（Rejected 不可刪）
- [x] 有 ChargeOut 關聯的費用不可刪除
- [x] 所有非 Draft 狀態可通過「退回草稿」按鈕退回 Draft
- [x] 刪除前顯示確認對話框
- [x] i18n 支援中英文

---

## 9. 實施記錄

### 後端變更
1. **`expense.delete`** - 增加 ChargeOut 關聯檢查 (`_count.chargeOutItems`)
2. **`expense.deleteMany`** - 新增批量刪除 API，返回 `{ deleted, skipped, errors }`
3. **`expense.revertToDraft`** - 新增狀態回退 API，清除 `approvedDate` 和 `paidDate`

### 前端變更
1. **`expenses/page.tsx`** - 新增：
   - Checkbox 多選功能（卡片視圖 + 列表視圖）
   - 批量操作工具列（批量刪除、清除選擇）
   - DropdownMenu 行操作（刪除、退回草稿）
   - AlertDialog 確認對話框（單一刪除、批量刪除、退回草稿）
   - Toast 通知

### i18n 翻譯
- `zh-TW.json` 新增：`expenses.actions.bulkDelete/clearSelection/revertToDraft`、`expenses.messages.*`、`expenses.dialogs.*`
- `en.json` 新增：對應英文翻譯

---

**最後更新**: 2025-12-15
**負責人**: AI Assistant
