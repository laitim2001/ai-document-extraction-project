# FIX-099: 頁面佈局差異問題

> **建立日期**: 2025-12-18
> **狀態**: 📋 待修復
> **優先級**: Medium
> **類型**: UI 一致性修復

## 問題描述

Projects 和 Vendors 頁面的佈局與 Budget Pools、Quotes 等其他頁面存在差異，導致視覺不統一。

## 重現步驟

1. 訪問 `/en/budget-pools` 頁面，觀察頁面佈局和搜尋欄位位置
2. 訪問 `/en/projects` 頁面
3. 比較兩個頁面的差異：
   - 整體間距不同
   - 搜尋/篩選區域的結構不同
   - 視覺上不一致

## 根本原因

經過代碼層面分析，發現以下差異：

### 1. 主容器間距差異

| 頁面 | 主容器 CSS | 實際間距 |
|------|------------|----------|
| **Projects** | `className="space-y-6"` | 24px (較小) |
| **Vendors** | `className="space-y-8"` | 32px (標準) |
| **Budget Pools** | `className="space-y-8"` | 32px (標準) |
| **Quotes** | `className="space-y-8"` | 32px (標準) |

### 2. 搜尋/篩選區域結構差異

**Projects 頁面** (非標準):
```tsx
<Card>
  <CardHeader>
    <CardTitle>搜尋和篩選</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* 搜尋輸入框 */}
      {/* 篩選按鈕 */}
    </div>
  </CardContent>
</Card>
```

**Budget Pools 頁面** (標準):
```tsx
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
  {/* 搜尋輸入框 */}
  {/* 篩選按鈕 */}
</div>
```

### 3. 差異對照表

| 特性 | Projects | Budget Pools (標準) |
|------|----------|---------------------|
| 主容器間距 | `space-y-6` | `space-y-8` |
| 搜尋區域 | 包在 Card 內 | 直接在 flex 容器 |
| 搜尋區域標題 | 有 CardTitle | 無標題 |
| 篩選器佈局 | 垂直堆疊 | 響應式 flex |

## 解決方案

將 Projects 和 Vendors 頁面的佈局統一為 Budget Pools 等頁面的標準模式。

### 修改的檔案

#### 1. `apps/web/src/app/[locale]/projects/page.tsx`

**修改項目**:
- 主容器間距：`space-y-6` → `space-y-8`
- 移除 Card 包裹，改用 flex 容器
- 調整搜尋/篩選佈局為響應式

**修改前** (約 Line 443-480):
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">{t('search.title')}</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* 搜尋和篩選 */}
    </div>
  </CardContent>
</Card>
```

**修改後**:
```tsx
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
  <div className="relative flex-1 max-w-sm">
    {/* 搜尋輸入框 */}
  </div>
  <div className="flex flex-wrap gap-2">
    {/* 篩選按鈕 */}
  </div>
</div>
```

#### 2. `apps/web/src/app/[locale]/vendors/page.tsx`

**修改項目**:
- 檢查並確認主容器間距為 `space-y-8`
- 確認搜尋/篩選佈局符合標準

## 視覺對照

### 修復前
```
Projects 頁面:
┌─────────────────────────────────┐
│ 搜尋和篩選 (Card)               │ ← 多餘的卡片邊框
│ ┌───────────────────────────┐   │
│ │ 搜尋輸入框                │   │
│ └───────────────────────────┘   │
│ [篩選按鈕] [篩選按鈕]           │
└─────────────────────────────────┘
     ↓ 24px (space-y-6)
┌─────────────────────────────────┐
│ 專案列表                        │
└─────────────────────────────────┘
```

### 修復後
```
Projects 頁面 (與 Budget Pools 一致):
[搜尋輸入框............] [篩選] [篩選]  ← 無卡片包裹

     ↓ 32px (space-y-8)

┌─────────────────────────────────┐
│ 專案列表                        │
└─────────────────────────────────┘
```

## 測試驗證

- [ ] Projects 頁面主容器間距為 `space-y-8`
- [ ] Projects 頁面搜尋區域無 Card 包裹
- [ ] Projects 頁面篩選器為響應式 flex 佈局
- [ ] Vendors 頁面佈局與標準一致
- [ ] 與 Budget Pools、Quotes 等頁面視覺一致
- [ ] 響應式佈局在手機/平板/桌面都正常

## 影響範圍

- **頁面**: Projects, Vendors
- **風險**: 低（純 CSS 類名和結構調整）
- **影響用戶**: 所有用戶

## 預估工時

- 修復時間: 45 分鐘
- 測試時間: 20 分鐘

## 相關文檔

- FIX-098: 麵包屑導航不一致問題（可一同修復）

---

**待用戶確認後實施**
