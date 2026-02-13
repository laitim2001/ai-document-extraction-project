# CHANGE-029: Budget Category Statistics 限定 Admin 可見

> **建立日期**: 2025-12-16
> **狀態**: 📋 待確認
> **優先級**: Medium
> **複雜度**: 低
> **預估工時**: 1 小時

---

## 1. 變更概述

### 1.1 當前行為
- OM Summary > Project Summary > Budget Category Statistics 區塊對所有登入用戶可見

### 1.2 期望行為
- Budget Category Statistics 區塊**只有 Admin 角色**可見
- 其他角色 (ProjectManager, Supervisor) 看不到此區塊

### 1.3 變更原因
- 敏感財務數據保護
- 符合權限分級原則

---

## 2. 技術設計

### 2.1 影響範圍

| 類型 | 檔案路徑 | 變更說明 |
|------|----------|----------|
| 組件 | `apps/web/src/components/om-summary/OMSummaryTable.tsx` 或相關組件 | 添加角色判斷邏輯 |
| 頁面 | `apps/web/src/app/[locale]/om-summary/page.tsx` | 可能需要傳遞用戶角色 |

### 2.2 角色定義

| RoleId | 角色名稱 | 可見 Budget Category Statistics |
|--------|----------|----------------------------------|
| 1 | ProjectManager | ❌ 不可見 |
| 2 | Supervisor | ❌ 不可見 |
| 3 | Admin | ✅ 可見 |

### 2.3 實現方案

**方案 A: 前端判斷**
```typescript
import { useSession } from 'next-auth/react';

const { data: session } = useSession();
const isAdmin = session?.user?.roleId === 3;

// 只有 Admin 可見
{isAdmin && (
  <BudgetCategoryStatistics data={budgetCategoryData} />
)}
```

**方案 B: 後端過濾** (更安全)
```typescript
// API 端根據角色返回不同數據
if (ctx.session.user.roleId !== 3) {
  return { ...data, budgetCategoryStats: null };
}
```

### 2.4 建議方案
- **採用方案 A (前端判斷)**: 因為這是顯示控制，不涉及敏感數據洩露風險
- 如果需要更嚴格的安全性，可同時實施方案 B

---

## 3. 測試計畫

### 3.1 測試項目
- [ ] Admin 登入：可見 Budget Category Statistics
- [ ] Supervisor 登入：不可見 Budget Category Statistics
- [ ] ProjectManager 登入：不可見 Budget Category Statistics

### 3.2 UI 測試
- [ ] 隱藏區塊後，頁面布局正常
- [ ] 無錯誤訊息或空白區域

---

## 4. 確認事項

**請確認以下事項：**

1. ✅ 只有 Admin (roleId=3) 可見是否正確？
2. ❓ Supervisor 是否也應該可見？(請確認)
3. ❓ 是否需要在隱藏區塊的位置顯示「權限不足」提示？還是完全隱藏？

---

## 5. 相關文件
- `packages/api/src/routers/omExpense.ts` - OM Expense API
- `apps/web/src/app/[locale]/om-summary/page.tsx` - OM Summary 頁面
- `FEAT-009-opco-data-permission/` - OpCo 數據權限相關功能
