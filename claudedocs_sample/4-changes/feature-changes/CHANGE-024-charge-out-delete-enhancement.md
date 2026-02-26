# CHANGE-024: Charge Out Delete Enhancement

> **建立日期**: 2025-12-15
> **完成日期**: 2025-12-15
> **狀態**: ✅ 已完成
> **優先級**: Medium
> **類型**: 現有功能增強

---

## 1. 變更概述

### 1.1 背景
目前 Charge Out（費用轉嫁）頁面缺少刪除功能，雖然後端 API 已有 `chargeOut.delete` procedure，但前端沒有實現相應的 UI。此外，也沒有批量刪除功能。

### 1.2 目標
- 在前端實現單一刪除功能（調用現有 API）
- 新增批量刪除功能（API + 前端）
- 保持現有的狀態限制邏輯（僅 Draft/Rejected 可刪）
- 新增狀態回退功能（將其他狀態退回 Draft/Rejected）

---

## 2. 現有實現分析

### 2.1 數據模型
```prisma
model ChargeOut {
  id              String    @id @default(uuid())
  name            String
  description     String?
  projectId       String
  opCoId          String
  totalAmount     Float
  status          String    @default("Draft")  // Draft, Submitted, Confirmed, Paid, Rejected
  debitNoteNumber String?   @unique
  issueDate       DateTime?
  paymentDate     DateTime?
  confirmedBy     String?
  confirmedAt     DateTime?

  project   Project
  opCo      OperatingCompany
  confirmer User?
  items     ChargeOutItem[]  // onDelete: Cascade
}

model ChargeOutItem {
  id            String  @id @default(uuid())
  chargeOutId   String
  expenseItemId String?
  expenseId     String?
  amount        Float
  description   String?
  sortOrder     Int     @default(0)

  chargeOut   ChargeOut    @relation(onDelete: Cascade)
  expenseItem ExpenseItem?
  expense     Expense?
}
```

### 2.2 現有 API (`packages/api/src/routers/chargeOut.ts`)
```typescript
delete: protectedProcedure
  .input(z.object({ id: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    // 檢查 ChargeOut 是否存在
    // 驗證狀態（僅 Draft 或 Rejected 可刪除）
    if (chargeOut.status !== 'Draft' && chargeOut.status !== 'Rejected') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `只有草稿或已拒絕狀態可以刪除（當前狀態：${chargeOut.status}）`,
      });
    }
    // 刪除（items 會自動刪除，因為 onDelete: Cascade）
  })
```

### 2.3 刪除限制
| 限制條件 | 說明 |
|---------|------|
| **狀態 = Draft** | ✅ 可刪除 |
| **狀態 = Rejected** | ✅ 可刪除 |
| **其他狀態** | ❌ 不可刪除 |

### 2.4 狀態說明
| 狀態 | 可否刪除 |
|------|---------|
| Draft | ✅ 可刪除 |
| Submitted | ❌ 不可刪除 |
| Confirmed | ❌ 不可刪除 |
| Paid | ❌ 不可刪除 |
| Rejected | ✅ 可刪除 |

### 2.5 現有前端頁面
- **列表頁**: `apps/web/src/app/[locale]/charge-outs/page.tsx`
- **詳情頁**: `apps/web/src/app/[locale]/charge-outs/[id]/page.tsx`

---

## 3. 變更需求

### 3.1 後端 API
| API | 狀態 | 說明 |
|-----|------|------|
| `chargeOut.delete` | ✅ 已完善 | 無需修改（已有狀態檢查） |
| `chargeOut.deleteMany` | ❌ 需新增 | 批量刪除 |
| `chargeOut.revertToDraft` | ❌ 需新增 | 將 Submitted/Confirmed/Paid 退回 Draft |

### 3.2 前端功能
| 功能 | 狀態 | 說明 |
|------|------|------|
| 單一刪除按鈕 | ❌ 需新增 | 列表 + 詳情頁（僅 Draft/Rejected） |
| 批量刪除 | ❌ 需新增 | Checkbox 多選 |
| 確認對話框 | ❌ 需新增 | AlertDialog |
| 退回至 Draft 按鈕 | ❌ 需新增 | 適用於 Submitted/Confirmed/Paid 狀態 |

---

## 4. 技術設計

### 4.1 現有 API: `chargeOut.delete`
已完善，無需修改。

### 4.2 新增 API: `chargeOut.deleteMany`
```typescript
deleteMany: protectedProcedure
  .input(z.object({
    ids: z.array(z.string().min(1)).min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const results = { deleted: 0, skipped: 0, errors: [] as { id: string; reason: string }[] };

    for (const id of input.ids) {
      const chargeOut = await ctx.prisma.chargeOut.findUnique({
        where: { id },
      });

      if (!chargeOut) {
        results.errors.push({ id, reason: 'NOT_FOUND' });
        continue;
      }

      // 狀態檢查
      if (chargeOut.status !== 'Draft' && chargeOut.status !== 'Rejected') {
        results.skipped++;
        results.errors.push({ id, reason: `INVALID_STATUS: ${chargeOut.status}` });
        continue;
      }

      // 刪除（items 自動 Cascade）
      await ctx.prisma.chargeOut.delete({ where: { id } });
      results.deleted++;
    }

    return results;
  })
```

### 4.3 新增 API: `chargeOut.revertToDraft`
```typescript
revertToDraft: protectedProcedure
  .input(z.object({
    id: z.string().min(1),
  }))
  .mutation(async ({ ctx, input }) => {
    const chargeOut = await ctx.prisma.chargeOut.findUnique({
      where: { id: input.id },
    });

    if (!chargeOut) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '費用轉嫁不存在' });
    }

    // 已經是 Draft 或 Rejected 就不需要退回
    if (chargeOut.status === 'Draft' || chargeOut.status === 'Rejected') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `費用轉嫁已經是${chargeOut.status === 'Draft' ? '草稿' : '已拒絕'}狀態，可直接刪除`,
      });
    }

    // 更新狀態為 Draft，清除確認相關資訊
    await ctx.prisma.chargeOut.update({
      where: { id: input.id },
      data: {
        status: 'Draft',
        confirmedBy: null,
        confirmedAt: null,
        paymentDate: null,
      },
    });

    return { success: true };
  })
```

### 4.4 前端組件設計
- 複用 CHANGE-019 (Project Delete) 的模式
- 添加 Checkbox 到列表行
- 僅對 Draft/Rejected 狀態顯示刪除按鈕
- 對 Submitted/Confirmed/Paid 狀態顯示「退回草稿」按鈕
- 使用 AlertDialog 確認

---

## 5. 影響範圍

### 5.1 後端文件
| 文件 | 變更 |
|------|------|
| `packages/api/src/routers/chargeOut.ts` | 新增 `deleteMany`、`revertToDraft` procedure |

### 5.2 前端文件
| 文件 | 變更 |
|------|------|
| `apps/web/src/app/[locale]/charge-outs/page.tsx` | 添加刪除 UI、退回草稿按鈕 |
| `apps/web/src/app/[locale]/charge-outs/[id]/page.tsx` | 添加刪除按鈕、退回草稿按鈕 |
| `apps/web/src/messages/en.json` | 新增翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 新增翻譯鍵 |

---

## 6. 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|---------|
| 誤刪已確認的 ChargeOut | 低 | 已有狀態檢查保護 |
| 財務記錄丟失 | 低 | 僅 Draft/Rejected 可刪 |
| 退回草稿後的數據一致性 | 中 | 清除確認資訊、支付日期 |

---

## 7. 工作量估算

| 任務 | 時間 |
|------|------|
| 後端 `deleteMany` API | 0.5 小時 |
| 後端 `revertToDraft` API | 0.5 小時 |
| 前端刪除 UI + 退回草稿按鈕 | 2 小時 |
| i18n 翻譯 | 0.5 小時 |
| 測試驗證 | 0.5 小時 |
| **總計** | **4 小時** |

---

## 8. 驗收標準

- [x] 單一 ChargeOut 可通過按鈕刪除（僅 Draft/Rejected）
- [x] 批量選擇並刪除多個 Draft/Rejected ChargeOut
- [x] 僅 Draft/Rejected 狀態可刪除
- [x] Submitted/Confirmed/Paid 狀態可通過「退回草稿」按鈕退回 Draft
- [x] 刪除前顯示確認對話框
- [x] i18n 支援中英文

---

## 9. 實施記錄

### 後端變更
1. **`chargeOut.deleteMany`** - 新增批量刪除 API，返回 `{ deleted, skipped, errors }`
2. **`chargeOut.revertToDraft`** - 新增狀態回退 API，清除 `confirmedBy`、`confirmedAt`、`paymentDate`

### 前端變更
1. **`charge-outs/page.tsx`** - 新增：
   - Checkbox 多選功能
   - 批量操作工具列（批量刪除、清除選擇）
   - DropdownMenu 行操作（刪除、退回草稿）
   - AlertDialog 確認對話框（單一刪除、批量刪除、退回草稿）
   - Toast 通知

### i18n 翻譯
- `zh-TW.json` 新增：`chargeOuts.actions.bulkDelete/clearSelection/revertToDraft`、`chargeOuts.messages.*`、`chargeOuts.dialogs.*`
- `en.json` 新增：對應英文翻譯

---

## 10. 備註

ChargeOut 的刪除邏輯相對簡單：
- 現有 `delete` API 已完善（包含狀態檢查）
- ChargeOutItem 有 `onDelete: Cascade`，無需手動處理
- 無需強制刪除功能
- 新增 `revertToDraft` 讓用戶可以將不可刪除的記錄退回草稿

此變更主要是前端 UI 的實現、批量刪除和退回草稿 API 的新增。

---

**最後更新**: 2025-12-15
**負責人**: AI Assistant
