# CHANGE-017: Budget Proposal 刪除功能增強

## 概述
在預算提案頁面加入刪除和批量刪除功能，讓用戶能夠清理不需要的提案記錄。

## 變更類型
**功能增強 (Feature Enhancement)** - 因為刪除 API 已存在，但前端 UI 未實現。

## 現有狀態分析

### API 層 (`packages/api/src/routers/budgetProposal.ts`)
- ✅ `delete` procedure 已存在 (第 661-696 行)
- ⚠️ 僅允許刪除 `Draft` 狀態的提案
- ❌ 無 `deleteMany` 批量刪除 procedure

### 前端頁面 (`apps/web/src/app/[locale]/proposals/page.tsx`)
- ❌ 列表頁無刪除按鈕
- ❌ 無 checkbox 批量選擇
- ❌ 無刪除確認對話框
- 現有操作僅有：「查看」和「編輯」

## 需求確認事項

### 1. 刪除權限範圍
**問題**: 目前 API 僅允許刪除 `Draft` 狀態的提案，是否需要擴展？

| 狀態 | 目前能否刪除 | 建議 |
|------|-------------|------|
| Draft | ✅ 可以 | 保持 |
| PendingApproval | ❌ 不可 | ❓ 需確認 |
| Approved | ❌ 不可 | 建議保持不可 (已批准) |
| Rejected | ❌ 不可 | ❓ 可考慮允許 |
| MoreInfoRequired | ❌ 不可 | ❓ 可考慮允許 |

**請確認**: 您希望哪些狀態的提案可以被刪除？

### 2. 批量刪除功能
**問題**: 是否需要批量刪除功能？

- **方案 A**: 僅單筆刪除 (簡單實現)
- **方案 B**: 單筆 + 批量刪除 (完整實現)

**請確認**: 您希望實現哪種方案？

### 3. 刪除確認機制
建議實現刪除確認對話框，避免誤刪。

### 4. 角色權限
**問題**: 誰可以刪除提案？

- **方案 A**: 僅提案建立者 (managerId) 可刪除
- **方案 B**: 建立者 + Admin 可刪除
- **方案 C**: 建立者 + Supervisor + Admin 可刪除

**請確認**: 您希望哪種權限模式？

## 預計實現內容

### Phase 1: 單筆刪除 UI
1. **列表頁增加刪除操作**
   - 在「操作」欄位加入刪除按鈕
   - 僅對允許刪除的狀態顯示刪除按鈕
   - 刪除前顯示確認對話框

2. **詳情頁增加刪除操作**
   - 在詳情頁頭部加入刪除按鈕
   - 刪除後重定向到列表頁

### Phase 2: 批量刪除功能 (如選擇方案 B)
1. **API 層**
   - 新增 `deleteMany` procedure
   - 驗證所有選中的提案是否可刪除

2. **前端層**
   - 列表頁增加 checkbox 選擇
   - 增加「全選」功能
   - 批量操作工具欄
   - 批量刪除確認對話框

## 影響範圍

### 需修改檔案
| 檔案 | 修改內容 |
|------|---------|
| `packages/api/src/routers/budgetProposal.ts` | 新增 `deleteMany` (如選方案 B) |
| `apps/web/src/app/[locale]/proposals/page.tsx` | 刪除按鈕、checkbox、批量操作 |
| `apps/web/src/app/[locale]/proposals/[id]/page.tsx` | 詳情頁刪除按鈕 |
| `apps/web/src/messages/en.json` | 刪除相關翻譯 |
| `apps/web/src/messages/zh-TW.json` | 刪除相關翻譯 |

### 不受影響
- 資料庫 Schema (無需修改)
- 其他 API Router
- 其他頁面

## 時間估算

| 項目 | 預估時間 |
|------|---------|
| Phase 1: 單筆刪除 UI | 2-3 小時 |
| Phase 2: 批量刪除功能 | 3-4 小時 |
| 測試驗證 | 1 小時 |
| **總計 (方案 A)** | **3-4 小時** |
| **總計 (方案 B)** | **6-8 小時** |

## 相關參考

### 類似實現
- `CHANGE-005-om-expense-batch-delete.md` - OM Expense 批量刪除 (可參考實現模式)

### 現有 API 代碼
```typescript
// packages/api/src/routers/budgetProposal.ts (第 661-696 行)
delete: protectedProcedure
  .input(z.object({ id: z.string().min(1, '無效的提案ID') }))
  .mutation(async ({ ctx, input }) => {
    // 僅 Draft 狀態可刪除
    if (existingProposal.status !== 'Draft') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '只有草稿狀態的提案可以刪除',
      });
    }
    // ...
  }),
```

---

## 已確認需求 (2025-12-15)

1. **刪除權限範圍**: 僅允許刪除 `Draft` 狀態的提案
2. **批量刪除**: 需要實現 (方案 B)
3. **角色權限**: 建立者 (managerId) + Admin 可刪除

---

## 實現完成記錄 (2025-12-15)

### 已完成項目

#### 1. API 層修改 (`packages/api/src/routers/budgetProposal.ts`)

**修改 `delete` procedure**:
- 新增權限檢查：建立者 (managerId) 或 Admin 可刪除
- 保持原有 Draft 狀態限制

**新增 `deleteMany` procedure**:
- 支援批量刪除 Draft 狀態的提案
- 驗證所有選中的提案：
  - 存在性檢查
  - Draft 狀態檢查
  - 權限檢查 (建立者或 Admin)
- 返回刪除數量

#### 2. i18n 翻譯 (`apps/web/src/messages/`)

新增翻譯鍵 (zh-TW.json & en.json):
```json
"actions": {
  "delete": "刪除" / "Delete",
  "deleting": "刪除中..." / "Deleting...",
  "confirmDelete": "確定要刪除此提案嗎？此操作無法復原。",
  "deleteSuccess": "提案已成功刪除" / "Proposal deleted successfully",
  "deleteError": "刪除提案失敗" / "Failed to delete proposal",
  "batchDelete": "批量刪除" / "Batch Delete",
  "confirmBatchDelete": "確定要刪除選中的 {count} 個提案嗎？此操作無法復原。",
  "batchDeleteSuccess": "已成功刪除 {count} 個提案",
  "batchDeleteError": "批量刪除失敗" / "Batch delete failed",
  "selectAll": "全選" / "Select All",
  "deselectAll": "取消全選" / "Deselect All",
  "selectedCount": "已選擇 {count} 項" / "{count} selected"
}
```

#### 3. 列表頁更新 (`apps/web/src/app/[locale]/proposals/page.tsx`)

- ✅ 新增 checkbox 選擇功能（僅 Draft 狀態且有權限的項目）
- ✅ 新增全選/取消全選功能
- ✅ 新增批量刪除工具欄
- ✅ 新增單筆刪除按鈕（卡片視圖和表格視圖）
- ✅ 新增刪除確認對話框 (AlertDialog)
- ✅ 權限檢查：建立者或 Admin 可看到刪除按鈕

#### 4. 詳情頁更新 (`apps/web/src/app/[locale]/proposals/[id]/page.tsx`)

- ✅ 新增刪除按鈕（僅 Draft 狀態且有權限時顯示）
- ✅ 新增刪除確認對話框
- ✅ 刪除成功後導向列表頁

### 驗證結果
- ✅ TypeScript 編譯通過
- ✅ i18n 驗證通過 (`pnpm validate:i18n`)
- ✅ ESLint 無新增錯誤

---

**文檔建立日期**: 2025-12-15
**狀態**: ✅ 已完成
**確認日期**: 2025-12-15
**完成日期**: 2025-12-15
