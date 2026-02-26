# CHANGE-021: Quote Delete Enhancement

> **建立日期**: 2025-12-15
> **狀態**: ✅ 已完成
> **完成日期**: 2025-12-15
> **優先級**: Medium
> **類型**: 現有功能增強

---

## 1. 變更概述

### 1.1 背景
目前 Quote（報價單）頁面缺少刪除功能，雖然後端 API 已有 `quote.delete` procedure，但前端沒有實現相應的 UI。此外，也沒有批量刪除功能。

### 1.2 目標
- 在前端實現單一刪除功能（調用現有 API）
- 新增批量刪除功能（API + 前端）
- 新增狀態回退功能（將關聯 PO 的 Quote 恢復可刪除狀態）
- 保持現有的刪除限制邏輯（有 PO 關聯時需特殊處理）

---

## 2. 現有實現分析

### 2.1 數據模型
```prisma
model Quote {
  id         String   @id @default(uuid())
  filePath   String
  uploadDate DateTime @default(now())
  amount     Float
  vendorId   String
  projectId  String

  vendor         Vendor
  project        Project
  purchaseOrders PurchaseOrder[]  // 關聯的採購單
}
```

### 2.2 現有 API (`packages/api/src/routers/quote.ts`)
```typescript
delete: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // 檢查報價單是否存在
    // 如果報價單已被選為採購單，不允許刪除
    if (quote.purchaseOrders && quote.purchaseOrders.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: '該報價單已被選為採購單，無法刪除',
      });
    }
    // 刪除報價單
  })
```

### 2.3 刪除限制
| 限制條件 | 說明 |
|---------|------|
| **無關聯 PO** | ✅ 可直接刪除 |
| **有關聯 PO（PO 為 Draft）** | ⚠️ 可強制刪除（解除 PO 關聯） |
| **有關聯 PO（PO 非 Draft）** | ❌ 不可刪除（需先將 PO 退回 Draft）|

### 2.4 現有前端頁面
- **列表頁**: `apps/web/src/app/[locale]/quotes/page.tsx`
- **詳情頁**: 無獨立詳情頁（列表展示）

---

## 3. 變更需求

### 3.1 後端 API
| API | 狀態 | 說明 |
|-----|------|------|
| `quote.delete` | ⚠️ 需修改 | 增加 force 選項（僅限 PO 為 Draft 時有效） |
| `quote.deleteMany` | ❌ 需新增 | 批量刪除，支援強制刪除選項 |
| `quote.revertToDraft` | ❌ 需新增 | 解除 PO 關聯，讓 Quote 可刪除 |

### 3.2 前端功能
| 功能 | 狀態 | 說明 |
|------|------|------|
| 單一刪除按鈕 | ❌ 需新增 | 在列表每行添加刪除按鈕 |
| 批量刪除 | ❌ 需新增 | Checkbox 多選 + 批量刪除工具列 |
| 確認對話框 | ❌ 需新增 | AlertDialog 確認刪除 |
| 強制刪除選項 | ❌ 需新增 | 僅當關聯 PO 為 Draft 狀態時顯示 |
| 退回至 Draft 按鈕 | ❌ 需新增 | 解除與 PO 的關聯 |

---

## 4. 技術設計

### 4.1 修改 API: `quote.delete`
```typescript
delete: protectedProcedure
  .input(z.object({
    id: z.string().uuid(),
    force: z.boolean().optional().default(false),
  }))
  .mutation(async ({ ctx, input }) => {
    const quote = await ctx.prisma.quote.findUnique({
      where: { id: input.id },
      include: {
        purchaseOrders: {
          select: { id: true, status: true }
        }
      },
    });

    if (!quote) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '報價單不存在' });
    }

    // 有 PO 關聯時的處理
    if (quote.purchaseOrders.length > 0) {
      if (!input.force) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: '該報價單已被選為採購單，無法刪除',
        });
      }

      // 強制刪除：檢查所有 PO 是否都是 Draft 狀態
      const nonDraftPOs = quote.purchaseOrders.filter(po => po.status !== 'Draft');
      if (nonDraftPOs.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `無法強制刪除：有 ${nonDraftPOs.length} 個關聯的採購單不是草稿狀態`,
        });
      }

      // 解除所有 Draft PO 的關聯
      await ctx.prisma.purchaseOrder.updateMany({
        where: { quoteId: input.id },
        data: { quoteId: null },
      });
    }

    await ctx.prisma.quote.delete({ where: { id: input.id } });
    return { success: true };
  })
```

### 4.2 新增 API: `quote.deleteMany`
```typescript
deleteMany: protectedProcedure
  .input(z.object({
    ids: z.array(z.string().uuid()).min(1),
    force: z.boolean().optional().default(false),
  }))
  .mutation(async ({ ctx, input }) => {
    const results = { deleted: 0, skipped: 0, errors: [] as { id: string; reason: string }[] };

    for (const id of input.ids) {
      const quote = await ctx.prisma.quote.findUnique({
        where: { id },
        include: {
          purchaseOrders: {
            select: { id: true, status: true }
          }
        },
      });

      if (!quote) {
        results.errors.push({ id, reason: 'NOT_FOUND' });
        continue;
      }

      // 有 PO 關聯時的處理
      if (quote.purchaseOrders.length > 0) {
        if (!input.force) {
          results.skipped++;
          results.errors.push({ id, reason: 'HAS_PO' });
          continue;
        }

        // 強制刪除：檢查所有 PO 是否都是 Draft 狀態
        const nonDraftPOs = quote.purchaseOrders.filter(po => po.status !== 'Draft');
        if (nonDraftPOs.length > 0) {
          results.skipped++;
          results.errors.push({ id, reason: `HAS_NON_DRAFT_PO: ${nonDraftPOs.length}` });
          continue;
        }

        // 解除所有 Draft PO 的關聯
        await ctx.prisma.purchaseOrder.updateMany({
          where: { quoteId: id },
          data: { quoteId: null },
        });
      }

      await ctx.prisma.quote.delete({ where: { id } });
      results.deleted++;
    }

    return results;
  })
```

### 4.3 新增 API: `quote.revertToDraft`
```typescript
revertToDraft: protectedProcedure
  .input(z.object({
    id: z.string().uuid(),
  }))
  .mutation(async ({ ctx, input }) => {
    const quote = await ctx.prisma.quote.findUnique({
      where: { id: input.id },
      include: {
        purchaseOrders: {
          select: { id: true, status: true, poNumber: true }
        }
      },
    });

    if (!quote) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '報價單不存在' });
    }

    // 檢查所有關聯 PO 是否為 Draft 狀態
    const nonDraftPOs = quote.purchaseOrders.filter(po => po.status !== 'Draft');
    if (nonDraftPOs.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `無法解除關聯：有 ${nonDraftPOs.length} 個採購單不是草稿狀態（${nonDraftPOs.map(po => po.poNumber).join(', ')}）`,
      });
    }

    // 解除所有 PO 關聯
    await ctx.prisma.purchaseOrder.updateMany({
      where: { quoteId: input.id },
      data: { quoteId: null },
    });

    return { success: true, unlinkedCount: quote.purchaseOrders.length };
  })
```

### 4.4 前端組件設計
- 複用 CHANGE-019 (Project Delete) 的模式
- 添加 Checkbox 到列表行
- 添加批量操作工具列
- 使用 AlertDialog 確認
- 顯示「解除關聯」按鈕（僅當有 PO 關聯且 PO 為 Draft 時）

---

## 5. 影響範圍

### 5.1 後端文件
| 文件 | 變更 |
|------|------|
| `packages/api/src/routers/quote.ts` | 修改 `delete`，新增 `deleteMany`、`revertToDraft` |

### 5.2 前端文件
| 文件 | 變更 |
|------|------|
| `apps/web/src/app/[locale]/quotes/page.tsx` | 添加刪除 UI、解除關聯按鈕 |
| `apps/web/src/messages/en.json` | 新增翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 新增翻譯鍵 |

---

## 6. 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|---------|
| 誤刪有 PO 關聯的報價 | 中 | 僅當 PO 為 Draft 時才允許強制刪除 |
| 解除 PO 關聯後無法復原 | 中 | AlertDialog 明確警告 |
| 檔案殘留 | 低 | TODO: 同時刪除 Blob Storage 檔案 |

---

## 7. 工作量估算

| 任務 | 時間 |
|------|------|
| 後端 `delete` 修改 + `deleteMany` API | 1 小時 |
| 後端 `revertToDraft` API | 0.5 小時 |
| 前端刪除 UI + 解除關聯按鈕 | 2 小時 |
| i18n 翻譯 | 0.5 小時 |
| 測試驗證 | 0.5 小時 |
| **總計** | **4.5 小時** |

---

## 8. 驗收標準

- [ ] 單一報價可通過按鈕刪除
- [ ] 批量選擇並刪除多個報價
- [ ] 無 PO 關聯的報價可直接刪除
- [ ] 有 PO 關聯（PO 為 Draft）的報價可強制刪除
- [ ] 有 PO 關聯（PO 非 Draft）的報價不可刪除
- [ ] 可通過「解除關聯」按鈕將 Quote 恢復可刪除狀態
- [ ] 刪除前顯示確認對話框
- [ ] i18n 支援中英文

---

**最後更新**: 2025-12-15
**負責人**: 待分配
