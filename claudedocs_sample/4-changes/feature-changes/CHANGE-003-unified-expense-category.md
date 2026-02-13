# CHANGE-003: 統一費用類別系統

## 變更概述

| 項目 | 內容 |
|------|------|
| **變更編號** | CHANGE-003 |
| **變更名稱** | 統一費用類別系統 |
| **影響範圍** | ExpenseItem, OMExpense, ExpenseCategory (原 OMExpenseCategory) |
| **優先級** | 高 |
| **狀態** | 🔄 進行中 |
| **開始日期** | 2025-12-01 |

## 問題背景

### 現狀問題
1. **ExpenseItem.category** 使用前端硬編碼選項 (Hardware, Software, Consulting, Maintenance, Other)
2. **OMExpense.category** 使用從現有記錄提取的動態值（`getCategories` API 用 `distinct`）
3. **OMExpenseCategory** 模型已建立 (FEAT-005) 但未被使用
4. Expense 和 OMExpense 透過 CHANGE-001 建立了關聯 (`sourceExpenseId`)，但類別系統不一致

### 影響
- 使用者在不同表單看到不同的類別選項，造成混淆
- 無法統一管理和維護費用類別
- 資料一致性問題

## 解決方案

### 統一架構設計

```
┌─────────────────────────────────────────────────────────────────┐
│                   ExpenseCategory (單一類別來源)                  │
│  ├── id, code, name, description, sortOrder, isActive           │
│  └── 被 ExpenseItem 和 OMExpense 共同引用                        │
├─────────────────────────────────────────────────────────────────┤
│  ExpenseItem                    │  OMExpense                     │
│    ├── category (舊欄位,保留)   │    ├── category (舊欄位,保留)  │
│    └── categoryId (新FK)        │    └── categoryId (已存在)     │
└─────────────────────────────────────────────────────────────────┘
```

### 統一類別清單

| 代碼 | 類別名稱 | 用途說明 |
|------|----------|----------|
| `HW` | Hardware | 硬體設備採購 |
| `SW` | Software | 軟體/授權採購 |
| `SV` | Services | 顧問/專業服務 |
| `MAINT` | Maintenance | 維護/維修服務 |
| `LICENSE` | License | 軟體/服務授權費 |
| `CLOUD` | Cloud Services | 雲端服務費用 |
| `TELECOM` | Telecom | 通訊/網路費用 |
| `OTHER` | Other | 其他費用 |

## 實施計劃

### Phase 1: Schema 修改
- [ ] 重命名 `OMExpenseCategory` → `ExpenseCategory`
- [ ] `ExpenseItem` 新增 `categoryId` 外鍵
- [ ] 更新 `OMExpense.categoryId` 關聯名稱
- [ ] 執行資料庫遷移

### Phase 2: API 更新
- [ ] 重命名 `omExpenseCategoryRouter` → `expenseCategoryRouter`
- [ ] 更新 `root.ts` 路由註冊
- [ ] 更新 `omExpense.ts` 的 `getCategories` 改用新模型

### Phase 3: 前端更新
- [ ] `ExpenseForm.tsx` 改用 `api.expenseCategory.getActive.useQuery()`
- [ ] `OMExpenseForm.tsx` 改用相同 API
- [ ] 更新 I18N 翻譯鍵
- [ ] 更新頁面路由 (om-expense-categories → expense-categories)

### Phase 4: Seed Data
- [ ] 添加 8 個預設類別到 `seed.ts`
- [ ] 確保部署時自動建立類別

### Phase 5: 測試驗證
- [ ] TypeScript 類型檢查
- [ ] ESLint 檢查
- [ ] 功能測試 (Expense 表單)
- [ ] 功能測試 (OMExpense 表單)
- [ ] 類別管理頁面測試

## 修改文件清單

### Schema
- `packages/db/prisma/schema.prisma`

### API
- `packages/api/src/routers/expenseCategory.ts` (重命名自 omExpenseCategory.ts)
- `packages/api/src/routers/expense.ts`
- `packages/api/src/routers/omExpense.ts`
- `packages/api/src/root.ts`

### 前端組件
- `apps/web/src/components/expense/ExpenseForm.tsx`
- `apps/web/src/components/om-expense/OMExpenseForm.tsx`

### 頁面
- `apps/web/src/app/[locale]/expense-categories/` (重命名自 om-expense-categories)

### Seed
- `packages/api/src/routers/seed.ts`

### I18N
- `apps/web/src/messages/zh-TW.json`
- `apps/web/src/messages/en.json`

## 向後兼容性

1. **保留舊欄位**: `ExpenseItem.category` 和 `OMExpense.category` String 欄位保留
2. **新欄位可選**: `categoryId` 設為可選，不強制現有資料遷移
3. **漸進式遷移**: 未來可透過資料遷移腳本將舊 category 值對應到 categoryId

## 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 資料庫遷移失敗 | 中 | 先在本地測試，備份後再執行 |
| 現有頁面路由改變 | 低 | 更新導航連結 |
| I18N 翻譯缺失 | 低 | 統一更新翻譯檔案 |

## 開發記錄

### 2025-12-01
- 建立 CHANGE-003 文檔
- 開始實施 Phase 1

---

**負責人**: AI Assistant
**審核人**: 待定
**最後更新**: 2025-12-01
