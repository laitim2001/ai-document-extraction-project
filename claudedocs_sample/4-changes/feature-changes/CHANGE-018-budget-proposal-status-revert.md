# CHANGE-018: Budget Proposal 狀態回退功能

## 概述
在預算提案系統加入「回退到草稿」功能，讓 Admin 或 Supervisor 能夠將已提交、已審核、已拒絕或需更多資訊的提案回退到 Draft 狀態，以便進行修改或刪除。

## 變更類型
**功能增強 (Feature Enhancement)** - 擴展現有審批工作流，新增反向狀態轉換功能。

---

## 需求確認 ✅

### 1. 權限範圍
**確認**: Admin + Supervisor (原審批者) 可執行回退操作

| 角色 | 可否回退 |
|------|---------|
| Admin | ✅ 可以 |
| Supervisor | ✅ 可以 |
| ProjectManager | ❌ 不可 |

### 2. 回退範圍
**確認**: 所有非 Draft 狀態都可回退

| 原狀態 | 目標狀態 | 操作名稱 |
|--------|---------|---------|
| PendingApproval | Draft | 取消提交 |
| Approved | Draft | 取消已審核 |
| Rejected | Draft | 取消已拒絕 |
| MoreInfoRequired | Draft | 取消請求更多資料 |

### 3. 回退原因
**確認**: 必填

---

## 現有狀態分析

### 當前狀態流（單向）
```
Draft → PendingApproval → Approved
                       → Rejected
                       → MoreInfoRequired → (可重新提交) → PendingApproval
```

### 新增狀態流（雙向）
```
Draft ←→ PendingApproval ←→ Approved
                         ←→ Rejected
                         ←→ MoreInfoRequired
```

### 現有 API (`packages/api/src/routers/budgetProposal.ts`)
- ✅ `submit`: Draft/MoreInfoRequired → PendingApproval
- ✅ `approve`: PendingApproval → Approved/Rejected/MoreInfoRequired
- ❌ **無回退功能**

### 現有組件 (`apps/web/src/components/proposal/ProposalActions.tsx`)
- ✅ Draft 狀態：顯示「提交審批」按鈕
- ✅ PendingApproval 狀態：顯示審批選項（批准/拒絕/請求更多資訊）
- ✅ Approved 狀態：顯示「已批准」訊息
- ✅ Rejected 狀態：顯示「已拒絕」訊息
- ❌ **無回退按鈕**

---

## 技術設計

### 1. 新增 API Procedure

```typescript
// packages/api/src/routers/budgetProposal.ts

revertToDraft: protectedProcedure
  .input(z.object({
    id: z.string().min(1, '無效的提案ID'),
    reason: z.string().min(1, '回退原因為必填'),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. 檢查權限：Admin 或 Supervisor
    const userRole = ctx.session.user.role.name;
    if (userRole !== 'Admin' && userRole !== 'Supervisor') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '只有管理員或主管可以執行此操作',
      });
    }

    // 2. 檢查提案存在
    const proposal = await ctx.prisma.budgetProposal.findUnique({
      where: { id: input.id },
    });

    if (!proposal) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: '提案不存在',
      });
    }

    // 3. 檢查狀態（Draft 不需要回退）
    if (proposal.status === 'Draft') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: '提案已是草稿狀態',
      });
    }

    // 4. 執行回退
    const updatedProposal = await ctx.prisma.budgetProposal.update({
      where: { id: input.id },
      data: {
        status: 'Draft',
        // 清除審批相關欄位
        approvedAmount: null,
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
      },
    });

    // 5. 記錄歷史
    await ctx.prisma.history.create({
      data: {
        proposalId: input.id,
        action: 'REVERTED_TO_DRAFT',
        userId: ctx.session.user.id,
        details: `回退原因：${input.reason}`,
      },
    });

    return updatedProposal;
  }),
```

### 2. 更新 ProposalActions 組件

在 `ProposalActions.tsx` 新增：
- 回退按鈕（Approved/Rejected/MoreInfoRequired/PendingApproval 狀態顯示）
- 回退原因輸入對話框
- 權限檢查（僅 Admin/Supervisor 顯示）

### 3. 新增 i18n 翻譯

```json
// zh-TW.json
"actions": {
  "revertToDraft": "回退到草稿",
  "reverting": "回退中...",
  "revertReason": "回退原因",
  "revertReasonPlaceholder": "請輸入回退原因（必填）",
  "revertReasonRequired": "回退原因為必填",
  "confirmRevert": "確定要將此提案回退到草稿狀態嗎？",
  "revertSuccess": "提案已成功回退到草稿狀態",
  "revertError": "回退失敗"
}

// en.json
"actions": {
  "revertToDraft": "Revert to Draft",
  "reverting": "Reverting...",
  "revertReason": "Revert Reason",
  "revertReasonPlaceholder": "Please enter the reason for reverting (required)",
  "revertReasonRequired": "Revert reason is required",
  "confirmRevert": "Are you sure you want to revert this proposal to draft status?",
  "revertSuccess": "Proposal has been reverted to draft status",
  "revertError": "Failed to revert proposal"
}
```

---

## 影響範圍

### 需修改檔案

| 檔案 | 修改內容 | 優先級 |
|------|---------|--------|
| `packages/api/src/routers/budgetProposal.ts` | 新增 `revertToDraft` procedure | P0 |
| `apps/web/src/components/proposal/ProposalActions.tsx` | 新增回退按鈕和對話框 | P0 |
| `apps/web/src/messages/zh-TW.json` | 新增回退相關翻譯 | P0 |
| `apps/web/src/messages/en.json` | 新增回退相關翻譯 | P0 |
| `apps/web/src/app/[locale]/proposals/[id]/page.tsx` | （可選）詳情頁顯示回退按鈕 | P1 |

### 不受影響
- 資料庫 Schema（無需修改，使用現有 History 模型）
- 其他 API Router
- 其他頁面
- 刪除功能 (CHANGE-017)

---

## 實施計劃

### Phase 1: API 層 (預估 1.5 小時)
1. 新增 `revertToDraft` procedure
2. 實現權限檢查 (Admin + Supervisor)
3. 實現狀態回退邏輯
4. 記錄 History

### Phase 2: i18n 翻譯 (預估 0.5 小時)
1. 新增 zh-TW.json 翻譯
2. 新增 en.json 翻譯
3. 驗證翻譯 (`pnpm validate:i18n`)

### Phase 3: 前端組件 (預估 2 小時)
1. 更新 `ProposalActions.tsx`
   - 新增回退按鈕
   - 新增回退原因輸入對話框 (AlertDialog)
   - 權限檢查（僅 Admin/Supervisor 顯示）
2. 新增 revertToDraft mutation

### Phase 4: 測試驗證 (預估 1 小時)
1. TypeScript 編譯檢查
2. ESLint 檢查
3. 功能測試

---

## 時間估算

| 項目 | 預估時間 |
|------|---------|
| Phase 1: API 層 | 1.5 小時 |
| Phase 2: i18n 翻譯 | 0.5 小時 |
| Phase 3: 前端組件 | 2 小時 |
| Phase 4: 測試驗證 | 1 小時 |
| **總計** | **5 小時** |

---

## UI 設計建議

### 回退按鈕位置
在 `ProposalActions` 組件中，各狀態下顯示：

```
┌─────────────────────────────────────┐
│ 操作                                │
├─────────────────────────────────────┤
│ [PendingApproval 狀態]              │
│                                     │
│ [批准] [拒絕] [請求更多資訊]         │
│                                     │
│ ─────────────────────────────────── │
│ [🔙 回退到草稿]  ← Admin/Supervisor │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 操作                                │
├─────────────────────────────────────┤
│ [Approved 狀態]                     │
│                                     │
│ ✅ 此提案已批准                      │
│                                     │
│ ─────────────────────────────────── │
│ [🔙 回退到草稿]  ← Admin/Supervisor │
└─────────────────────────────────────┘
```

### 回退對話框
```
┌─────────────────────────────────────┐
│ 回退到草稿                          │
├─────────────────────────────────────┤
│ 確定要將此提案回退到草稿狀態嗎？     │
│                                     │
│ 回退原因（必填）：                   │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │ [文字輸入區域]                   │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│           [取消]  [確認回退]         │
└─────────────────────────────────────┘
```

---

## 相關參考

### History Action 類型
現有：`SUBMITTED`, `APPROVED`, `REJECTED`, `MORE_INFO_REQUIRED`
新增：`REVERTED_TO_DRAFT`

### 與 CHANGE-017 的關係
- CHANGE-017：刪除功能（僅 Draft 可刪除）
- CHANGE-018：回退功能（讓非 Draft 可以回退到 Draft，然後刪除）
- 兩者互補，CHANGE-018 解決了 CHANGE-017 的限制

---

## 實現完成記錄 (2025-12-15)

### 已完成項目

#### 1. API 層 (`packages/api/src/routers/budgetProposal.ts`)

**新增 `revertToDraft` procedure** (第 779-890 行):
- 權限檢查：Admin 或 Supervisor
- 狀態檢查：非 Draft 狀態才可回退
- 使用 Transaction 確保資料一致性
- 清除審批欄位 (approvedAmount, approvedBy, approvedAt, rejectionReason)
- 記錄 History (`REVERTED_TO_DRAFT`)
- 如果原狀態是 Approved，回退 Project 的 approvedBudget

#### 2. i18n 翻譯 (`apps/web/src/messages/`)

新增翻譯鍵 (zh-TW.json & en.json):
```json
"actions": {
  "revertToDraft": "回退到草稿" / "Revert to Draft",
  "reverting": "回退中..." / "Reverting...",
  "revertReason": "回退原因" / "Revert Reason",
  "revertReasonPlaceholder": "請輸入回退原因（必填）",
  "revertReasonRequired": "回退原因為必填",
  "confirmRevert": "確定要將此提案回退到草稿狀態嗎？回退後可重新編輯或刪除。",
  "revertSuccess": "提案已成功回退到草稿狀態",
  "revertError": "回退失敗"
}
```

#### 3. 前端組件 (`apps/web/src/components/proposal/ProposalActions.tsx`)

- ✅ 新增回退狀態 (revertReason, isRevertDialogOpen, isReverting)
- ✅ 新增權限檢查 (canRevert: Admin 或 Supervisor + 非 Draft 狀態)
- ✅ 新增 revertMutation
- ✅ 新增 handleRevert 處理函數
- ✅ 新增回退按鈕（灰色，帶 RotateCcw 圖標）
- ✅ 新增 AlertDialog 確認對話框（含必填原因輸入）

### 驗證結果
- ✅ TypeScript 編譯通過
- ✅ i18n 驗證通過 (`pnpm validate:i18n` - 2414 個鍵)
- ✅ ESLint 無新增錯誤

### UI 展示

回退按鈕顯示位置：
- 在 ProposalActions 組件底部（非 Draft 狀態時）
- 僅 Admin 或 Supervisor 可見
- 點擊後彈出確認對話框，需填寫回退原因

---

**文檔建立日期**: 2025-12-15
**狀態**: ✅ 已完成
**確認日期**: 2025-12-15
**完成日期**: 2025-12-15
