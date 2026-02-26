# FIX-098: 麵包屑導航不一致問題

> **建立日期**: 2025-12-18
> **狀態**: 📋 待修復
> **優先級**: Medium
> **類型**: UI 一致性修復

## 問題描述

主要頁面的麵包屑導航顯示不一致：
- **Projects 頁面**: 顯示 "Dashboard > Projects"
- **Vendors 頁面**: 顯示 "Dashboard > Vendors"
- **Budget Pools 頁面**: 顯示 "Home > Budget Pools"
- **其他頁面**: 顯示 "Home > XXXX"

用戶期望：**所有主頁面的麵包屑都應該從 "Home" 開始**

## 重現步驟

1. 訪問 `/en/projects` 頁面
2. 觀察麵包屑顯示 "Dashboard > Projects"
3. 訪問 `/en/budget-pools` 頁面
4. 觀察麵包屑顯示 "Home > Budget Pools"
5. 兩者不一致

## 根本原因

不同頁面使用了不同的翻譯 key：

| 頁面 | 翻譯 Key | 顯示結果 |
|------|----------|----------|
| Projects | `tCommon('nav.dashboard')` | "Dashboard" |
| Vendors | `tNav('dashboard')` | "Dashboard" |
| Budget Pools | `tNav('home')` | "Home" |
| Quotes | `tNav('home')` | "Home" |

## 解決方案

統一所有主頁面的麵包屑使用 `tNav('home')` 翻譯 key，顯示 "Home"。

### 修改的檔案

1. **`apps/web/src/app/[locale]/projects/page.tsx`** (Line 430-440)
   ```typescript
   // 修改前
   <BreadcrumbLink asChild>
     <Link href="/dashboard">{tCommon('nav.dashboard')}</Link>
   </BreadcrumbLink>

   // 修改後
   <BreadcrumbLink asChild>
     <Link href="/dashboard">{tNav('home')}</Link>
   </BreadcrumbLink>
   ```

2. **`apps/web/src/app/[locale]/vendors/page.tsx`** (Line 175-185)
   ```typescript
   // 修改前
   <BreadcrumbLink asChild>
     <Link href="/dashboard">{tNav('dashboard')}</Link>
   </BreadcrumbLink>

   // 修改後
   <BreadcrumbLink asChild>
     <Link href="/dashboard">{tNav('home')}</Link>
   </BreadcrumbLink>
   ```

### 額外需檢查的頁面

可能還有其他頁面使用不一致的翻譯 key，需要全面檢查：
- Purchase Orders
- Expenses
- Charge Outs
- OM Expenses
- Operating Companies
- Users
- Quotes (已確認使用 home)
- Budget Pools (已確認使用 home)

## 測試驗證

- [ ] Projects 頁面麵包屑顯示 "Home > Projects"
- [ ] Vendors 頁面麵包屑顯示 "Home > Vendors"
- [ ] Budget Pools 頁面麵包屑顯示 "Home > Budget Pools"
- [ ] 所有其他主頁面麵包屑以 "Home" 開始
- [ ] 英文和繁體中文模式下都正確顯示

## 影響範圍

- **頁面**: 所有使用麵包屑導航的主頁面
- **風險**: 低（純 UI 文字變更）
- **影響用戶**: 所有用戶

## 預估工時

- 修復時間: 30 分鐘
- 測試時間: 15 分鐘

## 相關文檔

- 無

---

**待用戶確認後實施**
