# CHANGE-005: OM Expense 批量刪除功能

> **建立日期**: 2025-12-10
> **狀態**: ✅ 已完成
> **完成日期**: 2025-12-10
> **優先級**: Medium
> **類型**: 功能增強

---

## 1. 功能概述

### 1.1 背景
目前 OM Expenses 列表頁面 (`/om-expenses`) 只能單筆查看和編輯，無法批量刪除多筆記錄。
當用戶需要清理測試數據或刪除多筆過期記錄時，需要逐一進入詳情頁刪除，效率低下。

### 1.2 目標
在 OM Expenses 列表頁面新增批量刪除功能，允許用戶：
- 勾選多筆 OM Expense 記錄
- 一次性批量刪除所選記錄
- 刪除前顯示確認對話框，防止誤刪

---

## 2. 功能需求

### 2.1 用戶故事
```
作為一個 Admin/Supervisor，
我想要批量刪除多筆 OM Expense 記錄，
以便快速清理不需要的數據。
```

### 2.2 功能列表

| # | 功能 | 描述 | 優先級 |
|---|------|------|--------|
| 1 | 多選功能 | 列表頁面添加 checkbox，支援全選/取消全選 | 必須 |
| 2 | 批量刪除按鈕 | 選中記錄後顯示刪除按鈕，顯示選中數量 | 必須 |
| 3 | 確認對話框 | 刪除前彈出確認對話框，顯示將刪除的記錄數量 | 必須 |
| 4 | 刪除執行 | 調用 API 批量刪除，顯示進度/結果 | 必須 |
| 5 | 刪除反饋 | 成功/失敗 Toast 通知 | 必須 |
| 6 | 權限控制 | 只有 Admin/Supervisor 可以執行批量刪除 | 必須 |

### 2.3 UI 設計

#### 卡片視圖 (Card View)
- 每張卡片左上角添加 checkbox
- 選中後卡片邊框高亮

#### 列表視圖 (List View)
- 表格第一列添加 checkbox
- 表頭添加全選 checkbox

#### 批量操作工具列
- 位置：過濾器下方，列表上方
- 顯示：選中 X 筆記錄
- 按鈕：批量刪除 (紅色警告色)

---

## 3. 技術設計

### 3.1 後端 API

#### 新增 Procedure: `deleteMany`
```typescript
// packages/api/src/routers/omExpense.ts

deleteMany: protectedProcedure
  .input(z.object({
    ids: z.array(z.string().uuid()).min(1, '至少選擇一筆記錄'),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. 權限檢查 (Admin/Supervisor)
    // 2. 事務處理：
    //    - 刪除關聯的 OMExpenseMonthly 記錄
    //    - 刪除關聯的 OMExpenseItem 記錄
    //    - 刪除 OMExpense 記錄
    // 3. 返回刪除結果
  }),
```

#### 刪除順序（因外鍵約束）
```
1. OMExpenseMonthly (依賴 OMExpenseItem)
2. OMExpenseItem (依賴 OMExpense)
3. OMExpense (主表)
```

### 3.2 前端組件

#### 狀態管理
```typescript
// apps/web/src/app/[locale]/om-expenses/page.tsx

const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
```

#### 新增組件
- `Checkbox` - 使用 shadcn/ui 現有組件
- `AlertDialog` - 使用 shadcn/ui 確認對話框

### 3.3 資料模型

**無需修改 Prisma Schema**，使用現有的 cascade delete 設定。

---

## 4. 影響範圍

### 4.1 修改文件

#### 後端
| 文件 | 變更 |
|------|------|
| `packages/api/src/routers/omExpense.ts` | 新增 `deleteMany` procedure |

#### 前端
| 文件 | 變更 |
|------|------|
| `apps/web/src/app/[locale]/om-expenses/page.tsx` | 添加多選狀態、批量操作 UI、刪除對話框 |
| `apps/web/src/messages/en.json` | 新增翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 新增翻譯鍵 |

### 4.2 新增翻譯鍵
```json
{
  "omExpenses": {
    "list": {
      "batchActions": {
        "selected": "Selected {count} item(s)",
        "delete": "Delete Selected",
        "selectAll": "Select All",
        "deselectAll": "Deselect All"
      },
      "deleteDialog": {
        "title": "Confirm Delete",
        "message": "Are you sure you want to delete {count} OM expense record(s)? This action cannot be undone.",
        "confirm": "Delete",
        "cancel": "Cancel"
      },
      "deleteSuccess": "Successfully deleted {count} record(s)",
      "deleteError": "Failed to delete records"
    }
  }
}
```

---

## 5. 驗收標準

### 5.1 功能驗收
- [x] 卡片視圖可以勾選多筆記錄
- [x] 列表視圖可以勾選多筆記錄
- [x] 全選/取消全選功能正常
- [x] 選中記錄後顯示批量操作工具列
- [x] 點擊刪除按鈕彈出確認對話框
- [x] 確認後成功刪除所選記錄
- [x] 刪除後列表自動刷新
- [x] 成功/失敗顯示 Toast 通知

### 5.2 技術驗收
- [x] TypeScript 無錯誤
- [x] ESLint 無警告
- [x] I18N 翻譯完整 (en + zh-TW) - 2275 鍵
- [x] 刪除使用事務處理，確保數據一致性
- [x] 權限控制正確 (protectedProcedure)

### 5.3 邊界情況
- [x] 未選中任何記錄時，刪除按鈕禁用
- [x] 刪除過程中顯示 loading 狀態
- [x] 網絡錯誤時顯示錯誤訊息
- [x] 部分刪除失敗時的處理（已驗證 ID 才執行刪除）

---

## 6. 工作量估算

| 項目 | 估算時間 |
|------|----------|
| 後端 API 開發 | 0.5 小時 |
| 前端 UI 開發 | 1.5 小時 |
| I18N 翻譯 | 0.5 小時 |
| 測試驗證 | 0.5 小時 |
| **總計** | **3 小時** |

---

## 7. 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 誤刪重要數據 | 中 | 添加確認對話框，顯示將刪除的記錄數量 |
| 刪除大量數據時性能問題 | 低 | 使用事務處理，分批刪除（如需要） |
| 外鍵約束導致刪除失敗 | 低 | 按正確順序刪除關聯數據 |

---

## 8. 實施計劃

### Phase 1: 後端開發 (0.5h) ✅
- [x] 新增 `deleteMany` procedure
- [x] 實現事務刪除邏輯
- [x] 添加權限檢查 (protectedProcedure)

### Phase 2: 前端開發 (1.5h) ✅
- [x] 添加多選狀態管理
- [x] 卡片視圖添加 checkbox
- [x] 列表視圖添加 checkbox
- [x] 添加批量操作工具列
- [x] 添加確認對話框
- [x] 整合 API 調用

### Phase 3: I18N 和測試 (1h) ✅
- [x] 添加翻譯鍵 (en + zh-TW) - 2275 鍵
- [x] 功能測試
- [x] TypeScript 驗證通過

---

## 9. 相關文檔

- [OM Expenses 列表頁面](../../apps/web/src/app/[locale]/om-expenses/page.tsx)
- [OM Expense API Router](../../packages/api/src/routers/omExpense.ts)
- [FEAT-007: OM Expense 表頭-明細架構](../1-planning/features/FEAT-007-om-expense-header-detail-restructure/)

---

**最後更新**: 2025-12-10
**作者**: AI Assistant (Claude)
