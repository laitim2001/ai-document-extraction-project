# CHANGE-019: Project Delete Enhancement (專案刪除功能增強)

> **建立日期**: 2025-12-15
> **完成日期**: 2025-12-15
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: 現有功能增強
> **相關功能**: CHANGE-017 (Budget Proposal Delete Enhancement)

---

## 1. 背景分析

### 1.1 現有功能
專案已有基本刪除功能 (`project.delete` procedure)，但功能有限：

**現有實現** (`packages/api/src/routers/project.ts:950-1005`):
```typescript
delete: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // 檢查關聯資料
    const project = await ctx.prisma.project.findUnique({
      where: { id: input.id },
      include: {
        _count: {
          select: {
            proposals: true,
            purchaseOrders: true,
            quotes: true,
            chargeOuts: true,
          },
        },
      },
    });

    // 有任何關聯資料則禁止刪除
    if (errors.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: '無法刪除專案...',
      });
    }

    return ctx.prisma.project.delete({ where: { id: input.id } });
  }),
```

### 1.2 現有功能的限制
| 項目 | 現況 | 問題 |
|------|------|------|
| 權限檢查 | ❌ 無 | 任何認證用戶都可嘗試刪除 |
| 狀態檢查 | ❌ 無 | 不論專案狀態都可刪除 |
| 批量刪除 | ❌ 無 | 只能逐一刪除 |
| 前端 UI | ❌ 無 | 沒有刪除按鈕和確認對話框 |
| 審計記錄 | ❌ 無 | 沒有記錄誰刪除了什麼 |

---

## 2. 專案關聯分析 (⚠️ 重要)

### 2.1 直接關聯模型
專案關聯的模型較多，刪除時需要特別注意：

| 模型 | 關聯類型 | Cascade 設定 | 刪除影響 |
|------|----------|--------------|----------|
| **BudgetProposal** | 一對多 | ❌ 無 | 需手動刪除或檢查 |
| **Quote** | 一對多 | ❌ 無 | 需手動刪除或檢查 |
| **PurchaseOrder** | 一對多 | ❌ 無 | 需手動刪除或檢查 |
| **ChargeOut** | 一對多 | ❌ 無 | 需手動刪除或檢查 |
| **ProjectChargeOutOpCo** | 一對多 | ✅ Cascade | 自動刪除 |
| **BudgetPool** | 多對一 | - | 不受影響 |
| **BudgetCategory** | 多對一 | - | 不受影響 |
| **User (manager)** | 多對一 | - | 不受影響 |
| **User (supervisor)** | 多對一 | - | 不受影響 |
| **Currency** | 多對一 | - | 不受影響 |

### 2.2 深層關聯鏈
```
Project
├── BudgetProposal[]
│   ├── Comment[]
│   └── History[]
├── Quote[]
│   └── PurchaseOrder[] (多個 PO 可關聯同一 Quote)
├── PurchaseOrder[]
│   ├── PurchaseOrderItem[]
│   └── Expense[]
│       └── ExpenseItem[]
└── ChargeOut[]
    └── ChargeOutItem[]
```

### 2.3 刪除策略選項

#### 方案 A: 嚴格保護模式 (推薦，現有實現)
```
規則：有任何關聯資料 → 禁止刪除
優點：數據安全，不會誤刪有價值的業務資料
缺點：用戶需要手動清理所有關聯資料
```

#### 方案 B: 級聯刪除模式 (高風險)
```
規則：刪除專案時級聯刪除所有關聯資料
優點：一鍵清理
缺點：高風險，可能誤刪大量重要資料，不建議
```

#### 方案 C: 狀態限制模式 (推薦增強)
```
規則：只允許刪除 Draft 狀態且無關聯資料的專案
優點：在嚴格保護的基礎上增加狀態限制
```

#### 方案 D: 軟刪除模式 (可考慮未來)
```
規則：不真正刪除，標記為 "Deleted" 或 "Archived"
優點：可恢復，安全
缺點：需要修改資料模型，增加查詢複雜度
```

---

## 3. 專案狀態分析

### 3.1 專案狀態定義
```typescript
status: "Draft" | "InProgress" | "Completed" | "Archived"
```

### 3.2 狀態與刪除的建議關係
| 狀態 | 是否允許刪除 | 理由 |
|------|--------------|------|
| **Draft** | ✅ 允許 | 尚未開始執行的專案可以刪除 |
| **InProgress** | ⚠️ 限制 | 進行中專案有活躍業務，建議禁止或需 Admin 權限 |
| **Completed** | ❌ 禁止 | 已完成專案有完整記錄，應保留 |
| **Archived** | ❌ 禁止 | 已歸檔專案應保留歷史記錄 |

### 3.3 建議規則
```
1. 只允許刪除 Draft 狀態的專案
2. 刪除前檢查無關聯資料
3. 權限：建立者 (managerId) 或 Admin 可刪除
4. 批量刪除：同樣規則
```

---

## 4. 功能需求

### 4.1 單一刪除增強
- [ ] **狀態檢查**: 只允許刪除 Draft 狀態的專案
- [ ] **權限檢查**: 僅建立者 (manager) 或 Admin 可刪除
- [ ] **關聯檢查**: 保持現有檢查邏輯
- [ ] **確認對話框**: 前端 AlertDialog 確認
- [ ] **成功/失敗通知**: Toast 訊息

### 4.2 批量刪除 (新增)
- [ ] **多選功能**: 專案列表頁面支援多選
- [ ] **批量操作工具列**: 顯示選中數量和批量刪除按鈕
- [ ] **逐一驗證**: 檢查每個專案的狀態和關聯
- [ ] **部分失敗處理**: 顯示哪些專案無法刪除及原因
- [ ] **確認對話框**: 批量刪除前確認

### 4.3 驗證規則摘要
```typescript
// 單一刪除驗證
const canDelete = (project, userId, userRole) => {
  const isManager = project.managerId === userId;
  const isAdmin = userRole === 'Admin';
  const isDraft = project.status === 'Draft';
  const hasNoRelations =
    project._count.proposals === 0 &&
    project._count.purchaseOrders === 0 &&
    project._count.quotes === 0 &&
    project._count.chargeOuts === 0;

  return (isManager || isAdmin) && isDraft && hasNoRelations;
};
```

---

## 5. 技術設計

### 5.1 後端 API 修改

#### 5.1.1 增強 `delete` procedure
```typescript
delete: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const userRole = ctx.session.user.role.name;
    const isAdmin = userRole === 'Admin';

    const project = await ctx.prisma.project.findUnique({
      where: { id: input.id },
      include: {
        _count: {
          select: {
            proposals: true,
            purchaseOrders: true,
            quotes: true,
            chargeOuts: true,
          },
        },
      },
    });

    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '找不到該專案' });
    }

    // 新增：狀態檢查
    if (project.status !== 'Draft') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '只有草稿狀態的專案可以刪除',
      });
    }

    // 新增：權限檢查
    const isManager = project.managerId === userId;
    if (!isManager && !isAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '您沒有權限刪除此專案（僅專案經理或管理員可刪除）',
      });
    }

    // 現有：關聯資料檢查
    const errors: string[] = [];
    if (project._count.proposals > 0) errors.push(`${project._count.proposals} 個預算提案`);
    if (project._count.purchaseOrders > 0) errors.push(`${project._count.purchaseOrders} 個採購單`);
    if (project._count.quotes > 0) errors.push(`${project._count.quotes} 個報價單`);
    if (project._count.chargeOuts > 0) errors.push(`${project._count.chargeOuts} 個費用轉嫁記錄`);

    if (errors.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `無法刪除專案：此專案有以下關聯資料：\n- ${errors.join('\n- ')}\n\n請先處理這些資料後再刪除專案。`,
      });
    }

    // 使用 Transaction 刪除 (ProjectChargeOutOpCo 有 Cascade，但明確刪除更安全)
    return ctx.prisma.$transaction(async (tx) => {
      // 刪除 ProjectChargeOutOpCo (雖有 Cascade，但明確刪除)
      await tx.projectChargeOutOpCo.deleteMany({
        where: { projectId: input.id },
      });

      // 刪除專案
      return tx.project.delete({
        where: { id: input.id },
      });
    });
  }),
```

#### 5.1.2 新增 `deleteMany` procedure
```typescript
deleteMany: protectedProcedure
  .input(z.object({
    ids: z.array(z.string().uuid()).min(1, '請選擇要刪除的專案'),
  }))
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const userRole = ctx.session.user.role.name;
    const isAdmin = userRole === 'Admin';

    // 查詢所有要刪除的專案
    const projects = await ctx.prisma.project.findMany({
      where: { id: { in: input.ids } },
      include: {
        _count: {
          select: {
            proposals: true,
            purchaseOrders: true,
            quotes: true,
            chargeOuts: true,
          },
        },
      },
    });

    // 檢查是否所有專案都存在
    if (projects.length !== input.ids.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: '部分專案不存在',
      });
    }

    // 檢查狀態
    const nonDraftProjects = projects.filter(p => p.status !== 'Draft');
    if (nonDraftProjects.length > 0) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `以下專案不是草稿狀態，無法刪除：${nonDraftProjects.map(p => p.name).join(', ')}`,
      });
    }

    // 檢查權限
    if (!isAdmin) {
      const unauthorizedProjects = projects.filter(p => p.managerId !== userId);
      if (unauthorizedProjects.length > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `您沒有權限刪除以下專案：${unauthorizedProjects.map(p => p.name).join(', ')}`,
        });
      }
    }

    // 檢查關聯資料
    const projectsWithRelations = projects.filter(
      p => p._count.proposals > 0 || p._count.purchaseOrders > 0 ||
           p._count.quotes > 0 || p._count.chargeOuts > 0
    );
    if (projectsWithRelations.length > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `以下專案有關聯資料，無法刪除：${projectsWithRelations.map(p => p.name).join(', ')}`,
      });
    }

    // 使用 Transaction 批量刪除
    const result = await ctx.prisma.$transaction(async (tx) => {
      // 刪除 ProjectChargeOutOpCo
      await tx.projectChargeOutOpCo.deleteMany({
        where: { projectId: { in: input.ids } },
      });

      // 批量刪除專案
      return tx.project.deleteMany({
        where: { id: { in: input.ids } },
      });
    });

    return { success: true, deletedCount: result.count };
  }),
```

### 5.2 前端修改

#### 5.2.1 專案詳情頁 (`/projects/[id]/page.tsx`)
- 新增刪除按鈕
- 權限判斷顯示
- AlertDialog 確認對話框

#### 5.2.2 專案列表頁 (`/projects/page.tsx`)
- 新增多選功能 (checkbox)
- 批量操作工具列
- 批量刪除確認對話框

### 5.3 翻譯鍵 (i18n)
```json
// projects namespace
{
  "actions": {
    "delete": "刪除專案",
    "deleteMany": "批量刪除",
    "deleting": "刪除中...",
    "confirmDelete": "確定要刪除此專案嗎？此操作無法復原。",
    "confirmDeleteMany": "確定要刪除選中的 {count} 個專案嗎？此操作無法復原。",
    "deleteSuccess": "專案已刪除",
    "deleteManySuccess": "已刪除 {count} 個專案"
  },
  "errors": {
    "onlyDraftCanDelete": "只有草稿狀態的專案可以刪除",
    "noPermissionToDelete": "您沒有權限刪除此專案",
    "hasRelatedData": "此專案有關聯資料，無法刪除"
  }
}
```

---

## 6. 影響範圍

### 6.1 後端文件
| 文件 | 變更類型 | 說明 |
|------|----------|------|
| `packages/api/src/routers/project.ts` | 修改 | 增強 delete + 新增 deleteMany |

### 6.2 前端文件
| 文件 | 變更類型 | 說明 |
|------|----------|------|
| `apps/web/src/app/[locale]/projects/[id]/page.tsx` | 修改 | 新增刪除按鈕和對話框 |
| `apps/web/src/app/[locale]/projects/page.tsx` | 修改 | 新增批量刪除功能 |
| `apps/web/src/messages/en.json` | 修改 | 新增翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 修改 | 新增翻譯鍵 |

### 6.3 資料庫
- ❌ 無 Schema 變更
- ❌ 無 Migration 需求

---

## 7. 測試計劃

### 7.1 單元測試
- [ ] `delete` procedure 狀態檢查
- [ ] `delete` procedure 權限檢查
- [ ] `delete` procedure 關聯資料檢查
- [ ] `deleteMany` procedure 批量驗證

### 7.2 整合測試
- [ ] Draft 專案無關聯資料 → 可刪除
- [ ] Draft 專案有關聯資料 → 禁止刪除
- [ ] InProgress 專案 → 禁止刪除
- [ ] 非 Manager 非 Admin → 禁止刪除
- [ ] 批量刪除部分失敗情況

### 7.3 UI 測試
- [ ] 刪除按鈕顯示條件
- [ ] AlertDialog 確認流程
- [ ] Toast 訊息顯示
- [ ] 批量選擇功能
- [ ] 批量刪除確認流程

---

## 8. 工作量估算

| 項目 | 預估時間 |
|------|----------|
| 後端 API 修改 | 2 小時 |
| 前端詳情頁修改 | 1.5 小時 |
| 前端列表頁修改 (批量刪除) | 2 小時 |
| i18n 翻譯 | 0.5 小時 |
| 測試驗證 | 1 小時 |
| **總計** | **7 小時** |

---

## 9. 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 誤刪有價值專案 | 中 | 嚴格的狀態和關聯檢查 |
| 權限繞過 | 低 | 後端雙重驗證 |
| 批量刪除效能 | 低 | Transaction 保證原子性 |

---

## 10. 決策確認項目

請確認以下設計決策：

### 10.1 狀態限制
- [ ] **方案 A**: 只允許 Draft 狀態刪除 (推薦)
- [ ] **方案 B**: Draft + InProgress 都允許刪除
- [ ] **方案 C**: 任何狀態都可刪除 (只檢查關聯資料)

### 10.2 權限規則
- [ ] **方案 A**: Manager + Admin 可刪除 (推薦)
- [ ] **方案 B**: 只有 Admin 可刪除
- [ ] **方案 C**: 任何認證用戶都可刪除

### 10.3 關聯資料處理
- [ ] **方案 A**: 有關聯資料禁止刪除 (推薦，現有行為)
- [ ] **方案 B**: 級聯刪除所有關聯資料 (高風險)
- [ ] **方案 C**: 軟刪除 (標記為 Archived)

---

**維護者**: AI 助手 + 開發團隊
**最後更新**: 2025-12-15
**版本**: 1.0
