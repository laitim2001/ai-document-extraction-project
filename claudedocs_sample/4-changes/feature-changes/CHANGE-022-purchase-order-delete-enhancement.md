# CHANGE-022: Purchase Order Delete Enhancement

> **建立日期**: 2025-12-15
> **狀態**: ✅ 已完成
> **完成日期**: 2025-12-15
> **優先級**: Medium
> **類型**: 現有功能增強

---

## 1. 變更概述

### 1.1 背景
目前 Purchase Order（採購單）頁面缺少刪除功能，雖然後端 API 已有 `purchaseOrder.delete` procedure，但前端沒有實現相應的 UI。此外，也沒有批量刪除功能。

### 1.2 目標
- 在前端實現單一刪除功能（調用現有 API）
- 新增批量刪除功能（API + 前端）
- 增加狀態檢查（僅 Draft 可刪除）
- 新增狀態回退功能（將 Submitted/Cancelled 退回 Draft）
- 保持現有的關聯資料保護邏輯（有 Expense 關聯時不可刪除）

---

## 2. 現有實現分析

### 2.1 數據模型
```prisma
model PurchaseOrder {
  id           String    @id @default(uuid())
  poNumber     String    @unique
  name         String
  description  String?
  date         DateTime
  totalAmount  Float
  currencyId   String?
  status       String    @default("Draft")  // Draft, Submitted, Approved, Completed, Cancelled
  projectId    String
  vendorId     String
  quoteId      String?
  approvedDate DateTime?

  project  Project
  vendor   Vendor
  quote    Quote?
  items    PurchaseOrderItem[]  // onDelete: Cascade
  expenses Expense[]            // 關聯的費用
}
```

### 2.2 現有 API (`packages/api/src/routers/purchaseOrder.ts`)
```typescript
delete: protectedProcedure
  .input(z.object({ id: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    // 檢查 PO 是否存在
    // 如果 PO 有關聯的 Expense，不允許刪除
    if (purchaseOrder._count.expenses > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `無法刪除採購單，因為有 ${purchaseOrder._count.expenses} 筆費用記錄與之關聯`,
      });
    }
    // Transaction: 先刪除 items，再刪除 PO
  })
```

### 2.3 刪除限制（確認後）
| 限制條件 | 說明 |
|---------|------|
| **狀態 = Draft** | ✅ 可刪除 |
| **狀態 ≠ Draft** | ❌ 不可刪除（需先退回 Draft） |
| **有關聯 Expense** | ❌ 不可刪除（無強制刪除選項） |

### 2.4 狀態說明（確認後）
| 狀態 | 可否刪除 | 可否退回 Draft |
|------|---------|---------------|
| Draft | ✅ 可刪除 | - |
| Submitted | ❌ 不可刪除 | ✅ 可退回 |
| Approved | ❌ 不可刪除 | ❌ 不可退回 |
| Completed | ❌ 不可刪除 | ❌ 不可退回 |
| Cancelled | ❌ 不可刪除 | ✅ 可退回 |

### 2.5 現有前端頁面
- **列表頁**: `apps/web/src/app/[locale]/purchase-orders/page.tsx`
- **詳情頁**: `apps/web/src/app/[locale]/purchase-orders/[id]/page.tsx`

---

## 3. 變更需求

### 3.1 後端 API
| API | 狀態 | 說明 |
|-----|------|------|
| `purchaseOrder.delete` | ⚠️ 需修改 | 增加狀態檢查（僅 Draft 可刪） |
| `purchaseOrder.deleteMany` | ❌ 需新增 | 批量刪除 |
| `purchaseOrder.revertToDraft` | ❌ 需新增 | 將 Submitted/Cancelled 退回 Draft |

### 3.2 前端功能
| 功能 | 狀態 | 說明 |
|------|------|------|
| 單一刪除按鈕 | ❌ 需新增 | 列表 + 詳情頁（僅 Draft 顯示） |
| 批量刪除 | ❌ 需新增 | Checkbox 多選 |
| 確認對話框 | ❌ 需新增 | AlertDialog |
| 退回至 Draft 按鈕 | ❌ 需新增 | 適用於 Submitted/Cancelled 狀態 |

---

## 4. 技術設計

### 4.1 修改 API: `purchaseOrder.delete`
```typescript
delete: protectedProcedure
  .input(z.object({
    id: z.string().min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const po = await ctx.prisma.purchaseOrder.findUnique({
      where: { id: input.id },
      include: { _count: { select: { expenses: true } } },
    });

    if (!po) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '採購單不存在' });
    }

    // 狀態檢查：僅 Draft 可刪除
    if (po.status !== 'Draft') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `只有草稿狀態的採購單可以刪除（當前狀態：${po.status}）`,
      });
    }

    // 關聯檢查：有 Expense 關聯時不可刪除
    if (po._count.expenses > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `無法刪除採購單，有 ${po._count.expenses} 筆費用記錄關聯`,
      });
    }

    // 刪除 PO（items 會 Cascade 刪除）
    await ctx.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: input.id } });
      await tx.purchaseOrder.delete({ where: { id: input.id } });
    });

    return { success: true };
  })
```

### 4.2 新增 API: `purchaseOrder.deleteMany`
```typescript
deleteMany: protectedProcedure
  .input(z.object({
    ids: z.array(z.string().min(1)).min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const results = { deleted: 0, skipped: 0, errors: [] as { id: string; reason: string }[] };

    for (const id of input.ids) {
      const po = await ctx.prisma.purchaseOrder.findUnique({
        where: { id },
        include: { _count: { select: { expenses: true } } },
      });

      if (!po) {
        results.errors.push({ id, reason: 'NOT_FOUND' });
        continue;
      }

      // 狀態檢查：僅 Draft 可刪除
      if (po.status !== 'Draft') {
        results.skipped++;
        results.errors.push({ id, reason: `INVALID_STATUS: ${po.status}` });
        continue;
      }

      // 關聯檢查
      if (po._count.expenses > 0) {
        results.skipped++;
        results.errors.push({ id, reason: `HAS_EXPENSES: ${po._count.expenses}` });
        continue;
      }

      // 刪除
      await ctx.prisma.$transaction(async (tx) => {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrder.delete({ where: { id } });
      });
      results.deleted++;
    }

    return results;
  })
```

### 4.3 新增 API: `purchaseOrder.revertToDraft`
```typescript
revertToDraft: protectedProcedure
  .input(z.object({
    id: z.string().min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const po = await ctx.prisma.purchaseOrder.findUnique({
      where: { id: input.id },
    });

    if (!po) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '採購單不存在' });
    }

    // 只有 Submitted 和 Cancelled 可以退回 Draft
    const revertableStatuses = ['Submitted', 'Cancelled'];
    if (!revertableStatuses.includes(po.status)) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `無法退回草稿狀態（當前狀態：${po.status}，僅限已提交或已取消）`,
      });
    }

    // 更新狀態為 Draft
    await ctx.prisma.purchaseOrder.update({
      where: { id: input.id },
      data: { status: 'Draft' },
    });

    return { success: true };
  })
```

### 4.4 前端組件設計
- 複用 CHANGE-019 (Project Delete) 的模式
- 添加 Checkbox 到列表行
- 僅對 Draft 狀態的 PO 顯示刪除按鈕
- 對 Submitted/Cancelled 狀態顯示「退回草稿」按鈕
- 使用 AlertDialog 確認

---

## 5. 影響範圍

### 5.1 後端文件
| 文件 | 變更 |
|------|------|
| `packages/api/src/routers/purchaseOrder.ts` | 修改 `delete`，新增 `deleteMany`、`revertToDraft` |

### 5.2 前端文件
| 文件 | 變更 |
|------|------|
| `apps/web/src/app/[locale]/purchase-orders/page.tsx` | 添加刪除 UI、退回草稿按鈕 |
| `apps/web/src/app/[locale]/purchase-orders/[id]/page.tsx` | 添加刪除按鈕、退回草稿按鈕 |
| `apps/web/src/messages/en.json` | 新增翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 新增翻譯鍵 |

---

## 6. 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|---------|
| 誤刪已審批 PO | 低 | 僅 Draft 可刪，無強制刪除 |
| 有 Expense 的 PO 被刪 | 低 | 關聯檢查禁止刪除 |
| 退回草稿後的數據一致性 | 中 | 限制僅 Submitted/Cancelled 可退回 |

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

- [ ] 單一 PO 可通過按鈕刪除（僅 Draft 狀態）
- [ ] 批量選擇並刪除多個 Draft PO
- [ ] 僅 Draft 狀態可刪除
- [ ] 有 Expense 關聯的 PO 不可刪除
- [ ] Submitted/Cancelled 狀態可通過「退回草稿」按鈕退回 Draft
- [ ] 刪除前顯示確認對話框
- [ ] i18n 支援中英文

---

**最後更新**: 2025-12-15
**負責人**: 待分配
