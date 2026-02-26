# CHANGE-029: Reference Number 管理頁面 UI 一致性優化

> **建立日期**: 2026-02-06
> **完成日期**: -
> **狀態**: ⏳ 待實作
> **優先級**: Medium
> **類型**: UI Enhancement
> **前置條件**: Epic 20 - Story 20.5/20.6 已完成（Reference Number 管理頁面基礎功能）
> **影響範圍**: Reference Number 列表頁面、新增/編輯頁面、i18n 翻譯

---

## 1. 變更概述

### 1.1 執行摘要

本變更針對 Reference Number 管理頁面進行 UI 一致性優化，使其風格更貼近項目中其他管理頁面（如 Template Field Mappings、Exchange Rates）。主要涉及兩個面向：

1. **列表頁篩選器**：對齊 Template Field Mappings 的 Card 內篩選模式
2. **新增/編輯表單頁**：優化表單寬度與空間利用率

### 1.2 背景與動機

#### 1.2.1 問題描述

**問題 1 - 列表頁與其他管理頁面風格不一致**

當前 Reference Numbers 列表頁（`/admin/reference-numbers`）與 Template Field Mappings 列表頁（`/admin/template-field-mappings`）存在結構差異：

| 項目 | Template Field Mappings | Reference Numbers（現狀） |
|------|------------------------|--------------------------|
| 內容容器 | 單一 Card 包裹全部 | 分離式（header + filter card + list） |
| 操作按鈕 | Card 內的 CardHeader 右側 | 頁面 header 右側 |
| 篩選器佈局 | `flex-1` 搜尋（自動撐寬）+ 下拉 | 固定像素寬度篩選器 |
| 表格位置 | Card 內 `rounded-md border` | 獨立 `rounded-md border` |

> **分析結論**：Reference Numbers 的分離式佈局其實與 Exchange Rates 列表頁一致，並非不合理。但篩選器的固定寬度在寬螢幕上右側會留白，視覺上不如 Template Field Mappings 飽滿。

**問題 2 - 新增/編輯表單頁面空間利用率低**

當前表單頁面使用 `max-w-3xl`（768px）限制寬度，在寬螢幕上兩側留有大量空白：

```
┌─ Sidebar ─┐ ┌──── Main Content Area (~1100px) ────────────────┐
│            │ │                                                   │
│            │ │   ← 空白 →  ┌─ Card (768px) ─┐  ← 空白 →       │
│            │ │              │  # New Ref Num  │                  │
│            │ │              │  [Form Fields]  │                  │
│            │ │              └─────────────────┘                  │
│            │ │                                                   │
└────────────┘ └───────────────────────────────────────────────────┘
```

Exchange Rates 新增頁面同樣存在此問題（使用 `max-w-2xl`，672px，更窄）。

#### 1.2.2 現有頁面對比截圖

| 頁面 | 容器寬度 | 截圖檔案 |
|------|----------|----------|
| Template Field Mappings 列表 | 全寬 `container` | `template-field-mappings-list.png` |
| Reference Numbers 列表 | 全寬 `container` | `reference-numbers-list.png` |
| Reference Numbers 新增 | `max-w-3xl` (768px) | `reference-numbers-new.png` |
| Exchange Rates 新增 | `max-w-2xl` (672px) | `exchange-rates-new.png` |

### 1.3 變更目標

| # | 目標 | 說明 | 優先級 |
|---|------|------|--------|
| 1 | **列表頁篩選器對齊** | 調整篩選器佈局，減少右側留白 | P1 |
| 2 | **表單頁寬度優化** | 調整 `max-w` 設定，改善空間利用率 | P1 |
| 3 | **跨頁面一致性** | 確保 Reference Numbers 與其他管理頁面風格統一 | P2 |
| 4 | **Exchange Rates 同步** | 同步優化 Exchange Rates 表單頁寬度 | P2 |

---

## 2. 功能需求

### 2.1 列表頁篩選器優化

#### 2.1.1 現狀分析

當前篩選器使用固定像素寬度：

```tsx
// 現有佈局
<div className="flex flex-wrap items-end gap-4">
  <Input className="w-[200px]" />          // 搜尋
  <SelectTrigger className="w-[120px]" />  // 年份
  <RegionSelect className="w-[180px]" />   // 地區
  <SelectTrigger className="w-[150px]" />  // 類型
  <SelectTrigger className="w-[120px]" />  // 狀態
</div>
// 總寬度: ~770px + gaps ≈ 836px
// 主內容區寬度: ~1100px → 右側留白 ~264px
```

#### 2.1.2 優化方案

**方案 A（推薦）：搜尋框 flex-1 + 固定寬度下拉**

參考 Template Field Mappings 的模式，讓搜尋框自動撐滿剩餘空間：

```tsx
<div className="flex flex-wrap items-end gap-4">
  {/* 搜尋 - 自動撐寬 */}
  <div className="flex-1 min-w-[200px] space-y-1.5">
    <label>Search</label>
    <div className="flex items-center gap-2">
      <Input className="flex-1" />
      <Button variant="outline" size="icon"><Search /></Button>
    </div>
  </div>

  {/* 下拉篩選 - 固定寬度 */}
  <div className="space-y-1.5">
    <label>Year</label>
    <SelectTrigger className="w-[120px]" />
  </div>
  <!-- ... 其他篩選器維持固定寬度 -->
</div>
```

**效果對比**：

```
現狀:
[Search (200px)] [Year (120px)] [Region (180px)] [Type (150px)] [Status (120px)]  ← 264px 空白 →

優化後:
[Search ~~~~~~~~ (flex-1) ~~~~] [Year (120px)] [Region (180px)] [Type (150px)] [Status (120px)]
```

**方案 B：全部等寬分配**

使用 grid 佈局均分寬度。此方案視覺更整齊但搜尋框可能過窄，**不推薦**。

### 2.2 表單頁寬度優化

#### 2.2.1 寬度方案分析

| 方案 | CSS class | 實際寬度 | 視覺效果 | 推薦度 |
|------|-----------|----------|----------|--------|
| **A（推薦）** | `max-w-4xl` | 896px | 折衷：減少空白但仍有聚焦感 | ★★★★★ |
| B | `max-w-5xl` | 1024px | 更寬：接近全寬但保留少量邊距 | ★★★★☆ |
| C（現狀） | `max-w-3xl` | 768px | 窄：符合業界慣例但空白明顯 | ★★★☆☆ |
| D | 無限制 | 全寬 | 最寬：需要 grid-cols-2 佈局配合 | ★★☆☆☆ |

#### 2.2.2 推薦方案：max-w-4xl

**理由**：

1. **UX 平衡**：896px 寬度在 1100px 主內容區中僅留 ~102px 兩側邊距，空間感良好
2. **改動最小**：只需修改一個 class，無需重構表單佈局
3. **表單可讀性**：輸入框不至於過寬，仍保持良好的掃描性
4. **一致性**：可同步套用到 Exchange Rates 新增/編輯頁面

```
優化後:
┌─ Sidebar ─┐ ┌──── Main Content Area (~1100px) ──────────────────┐
│            │ │                                                     │
│            │ │  ← ~50px →  ┌─── Card (896px) ───┐  ← ~50px →    │
│            │ │              │  # New Ref Number   │                │
│            │ │              │  [  Form Fields   ] │                │
│            │ │              └─────────────────────┘                │
│            │ │                                                     │
└────────────┘ └─────────────────────────────────────────────────────┘
```

#### 2.2.3 不建議全寬表單的理由

基於 UX 最佳實踐，居中窄表單是後台管理系統的業界標準：

| 因素 | 窄表單 (max-w-3xl/4xl) | 全寬表單 |
|------|------------------------|----------|
| **閱讀性** | 眼睛掃描距離短，易對齊 label/input | 輸入框過寬，短文字顯得空曠 |
| **認知聚焦** | 形成視覺走廊，引導由上往下掃描 | 視覺焦點分散 |
| **業界慣例** | Google、Stripe、AWS Console 均採用 | 少見於主流 SaaS |
| **觸控友善** | 互動元素在合理範圍內 | 下拉選單需大幅移動 |

### 2.3 Exchange Rates 同步優化

為保持跨功能一致性，建議同步調整 Exchange Rates 表單頁：

| 頁面 | 現狀 | 優化後 |
|------|------|--------|
| `/admin/exchange-rates/new` | `max-w-2xl` (672px) | `max-w-4xl` (896px) |
| `/admin/exchange-rates/[id]` | `max-w-2xl` (672px) | `max-w-4xl` (896px) |

---

## 3. 技術設計

### 3.1 列表頁篩選器修改

**文件**: `src/components/features/reference-number/ReferenceNumberFilters.tsx`

#### 3.1.1 修改範圍

```tsx
// 修改前
<div className="flex flex-wrap items-end gap-4">
  {/* 搜尋 */}
  <div className="space-y-1.5">
    <label>...</label>
    <div className="flex items-center gap-2">
      <Input className="w-[200px]" />    // ← 固定寬度
      <Button>...</Button>
    </div>
  </div>
  ...
</div>

// 修改後
<div className="flex flex-wrap items-end gap-4">
  {/* 搜尋 - flex-1 自動撐寬 */}
  <div className="flex-1 min-w-[200px] space-y-1.5">
    <label>...</label>
    <div className="flex items-center gap-2">
      <Input className="flex-1" />       // ← 自動撐寬
      <Button>...</Button>
    </div>
  </div>
  ...
</div>
```

### 3.2 表單頁寬度修改

#### 3.2.1 Reference Numbers 新增頁

**文件**: `src/app/[locale]/(dashboard)/admin/reference-numbers/new/page.tsx`

```tsx
// 修改前
<div className="container mx-auto py-6 max-w-3xl">

// 修改後
<div className="container mx-auto py-6 max-w-4xl">
```

#### 3.2.2 Reference Numbers 編輯頁

**文件**: `src/app/[locale]/(dashboard)/admin/reference-numbers/[id]/page.tsx`

```tsx
// 修改前
<div className="container mx-auto py-6 max-w-3xl">

// 修改後
<div className="container mx-auto py-6 max-w-4xl">
```

#### 3.2.3 Exchange Rates 新增頁（同步優化）

**文件**: `src/app/[locale]/(dashboard)/admin/exchange-rates/new/page.tsx`

```tsx
// 修改前
<div className="container mx-auto py-6 max-w-2xl">

// 修改後
<div className="container mx-auto py-6 max-w-4xl">
```

#### 3.2.4 Exchange Rates 編輯頁（同步優化）

**文件**: `src/app/[locale]/(dashboard)/admin/exchange-rates/[id]/page.tsx`

```tsx
// 修改前
<div className="container mx-auto py-6 max-w-2xl">

// 修改後
<div className="container mx-auto py-6 max-w-4xl">
```

---

## 4. 影響範圍評估

### 4.1 文件影響清單

| 文件路徑 | 類型 | 說明 |
|----------|------|------|
| `src/components/features/reference-number/ReferenceNumberFilters.tsx` | 🔧 修改 | 搜尋框改為 flex-1 |
| `src/app/[locale]/(dashboard)/admin/reference-numbers/new/page.tsx` | 🔧 修改 | max-w-3xl → max-w-4xl |
| `src/app/[locale]/(dashboard)/admin/reference-numbers/[id]/page.tsx` | 🔧 修改 | max-w-3xl → max-w-4xl |
| `src/app/[locale]/(dashboard)/admin/exchange-rates/new/page.tsx` | 🔧 修改 | max-w-2xl → max-w-4xl |
| `src/app/[locale]/(dashboard)/admin/exchange-rates/[id]/page.tsx` | 🔧 修改 | max-w-2xl → max-w-4xl（需確認是否存在） |

### 4.2 向後兼容性

- **完全向後兼容**：純 CSS class 調整，不影響數據結構或 API
- **功能保持**：所有篩選、表單提交、導航功能不變
- **i18n 無影響**：不涉及新翻譯 key

### 4.3 不受影響的文件

- ReferenceNumberList.tsx（表格組件）
- ReferenceNumberForm.tsx（表單組件內部佈局）
- 所有 i18n 翻譯文件
- API 路由和服務層

---

## 5. 實施計劃

### 5.1 階段概覽

```
Phase 1: 篩選器優化                 Phase 2: 表單寬度優化
(預計: 15 分鐘)                    (預計: 15 分鐘)
───────────────────                ─────────────────────
• ReferenceNumberFilters.tsx       • reference-numbers/new/page.tsx
  搜尋框 flex-1                    • reference-numbers/[id]/page.tsx
                                   • exchange-rates/new/page.tsx
                                   • exchange-rates/[id]/page.tsx
         │                                  │
         └──────────┬──────────────────────┘
                    ▼
          Phase 3: 視覺驗證
          (預計: 15 分鐘)
          ─────────────────
          • 截圖對比（修改前/後）
          • 多頁面一致性檢查
          • 響應式檢查
```

### 5.2 Phase 1: 篩選器優化

| # | 任務 | 文件 |
|---|------|------|
| 1.1 | 搜尋框容器改為 `flex-1 min-w-[200px]` | `ReferenceNumberFilters.tsx` |
| 1.2 | 搜尋 Input 改為 `flex-1`（移除 `w-[200px]`） | `ReferenceNumberFilters.tsx` |

### 5.3 Phase 2: 表單寬度優化

| # | 任務 | 文件 |
|---|------|------|
| 2.1 | Reference Numbers 新增頁 `max-w-3xl` → `max-w-4xl` | `new/page.tsx` |
| 2.2 | Reference Numbers 編輯頁 `max-w-3xl` → `max-w-4xl` | `[id]/page.tsx` |
| 2.3 | Exchange Rates 新增頁 `max-w-2xl` → `max-w-4xl` | `new/page.tsx` |
| 2.4 | Exchange Rates 編輯頁 `max-w-2xl` → `max-w-4xl`（如存在） | `[id]/page.tsx` |

### 5.4 Phase 3: 視覺驗證

| # | 任務 | 說明 |
|---|------|------|
| 3.1 | Reference Numbers 列表頁截圖驗證 | 篩選器排列、搜尋框寬度 |
| 3.2 | Reference Numbers 新增頁截圖驗證 | Card 寬度、表單佈局 |
| 3.3 | Exchange Rates 新增頁截圖驗證 | Card 寬度一致性 |
| 3.4 | 響應式縮窄驗證 | 確認篩選器在窄螢幕正確 wrap |

---

## 6. UI 設計參考

### 6.1 列表頁篩選器（優化後）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Search                    Year       Region         Type         Status     │
│  ┌───────────────────┐ Q   ┌──────┐  ┌──────────┐  ┌─────────┐  ┌──────┐  │
│  │ Search by number.. │ 🔍  │ All  ▾│  │ Loading  ▾│  │ All     ▾│  │ All  ▾│  │
│  └───────────────────┘     └──────┘  └──────────┘  └─────────┘  └──────┘  │
│  ↑ flex-1 (自動撐寬)       ↑ 120px   ↑ 180px       ↑ 150px      ↑ 120px  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 表單頁（優化後 - max-w-4xl）

```
┌─ Sidebar ─┐ ┌──── Main Content Area ────────────────────────────┐
│            │ │                                                     │
│            │ │  ← Reference Numbers                               │
│            │ │                                                     │
│            │ │  ┌──────────── Card (max-w-4xl = 896px) ────────┐  │
│            │ │  │                                                │  │
│            │ │  │  # New Reference Number                       │  │
│            │ │  │  Create a new reference number record          │  │
│            │ │  │                                                │  │
│            │ │  │  Number *                                     │  │
│            │ │  │  ┌────────────────────────────────────────┐   │  │
│            │ │  │  │ Enter number...                         │   │  │
│            │ │  │  └────────────────────────────────────────┘   │  │
│            │ │  │                                                │  │
│            │ │  │  Type *                    Year *              │  │
│            │ │  │  ┌───────────────────┐    ┌──────────────┐   │  │
│            │ │  │  │ Shipment         ▾│    │ 2026         │   │  │
│            │ │  │  └───────────────────┘    └──────────────┘   │  │
│            │ │  │                                                │  │
│            │ │  │             [ Cancel ]  [ Create ]             │  │
│            │ │  │                                                │  │
│            │ │  └────────────────────────────────────────────────┘  │
│            │ │                                                     │
└────────────┘ └─────────────────────────────────────────────────────┘
```

---

## 7. 驗收標準

### 7.1 功能驗收

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|---------|--------|
| F1 | 篩選器搜尋框撐寬 | 搜尋框自動佔滿篩選器行的剩餘空間 | P0 |
| F2 | 篩選器功能不變 | 搜尋、年份、地區、類型、狀態篩選正常工作 | P0 |
| F3 | 表單頁寬度增大 | Reference Numbers 新增/編輯頁使用 max-w-4xl | P0 |
| F4 | Exchange Rates 同步 | Exchange Rates 新增/編輯頁同步使用 max-w-4xl | P1 |
| F5 | 響應式正常 | 篩選器在窄螢幕正確 wrap，表單在小螢幕不溢出 | P1 |
| F6 | 視覺一致性 | 各管理頁面風格統一，無明顯風格跳躍 | P2 |

### 7.2 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|---------|---------|
| T1 | 列表頁篩選器 | 進入 /admin/reference-numbers | 搜尋框自動撐寬，右側無大量留白 |
| T2 | 篩選功能 | 依序使用各篩選器 | 所有篩選器正常工作，URL 參數正確更新 |
| T3 | 新增頁寬度 | 進入 /admin/reference-numbers/new | Card 寬度為 max-w-4xl，視覺適中 |
| T4 | 編輯頁寬度 | 進入 /admin/reference-numbers/[id] | Card 寬度同新增頁 |
| T5 | Exchange Rates 新增 | 進入 /admin/exchange-rates/new | Card 寬度為 max-w-4xl |
| T6 | 響應式 - 窄螢幕 | 瀏覽器縮窄至 768px | 篩選器正確 wrap 為多行 |
| T7 | 響應式 - 表單 | 瀏覽器縮窄至 768px | 表單佈局正常，無水平溢出 |
| T8 | i18n 驗證 | 切換 en/zh-TW/zh-CN | 篩選器標籤、表單正常顯示 |

---

## 8. 風險評估

### 8.1 風險矩陣

| # | 風險 | 可能性 | 影響 | 風險等級 | 緩解措施 |
|---|------|--------|------|---------|----------|
| R1 | flex-1 在極窄螢幕上搜尋框過窄 | 低 | 低 | 🟢 低 | 已設定 `min-w-[200px]`，flex-wrap 會自動換行 |
| R2 | max-w-4xl 在小螢幕上超出 | 低 | 低 | 🟢 低 | `container` class 有內建響應式 padding |
| R3 | Exchange Rates 編輯頁不存在或結構不同 | 中 | 低 | 🟢 低 | 實施前先確認文件是否存在 |
| R4 | 表單內部欄位在更寬容器中顯示異常 | 低 | 中 | 🟡 中 | 視覺驗證階段逐一檢查各欄位 |

### 8.2 回滾計劃

- **回滾方式**: Revert 相關 commit
- **回滾影響**: 恢復為原始的固定寬度篩選器和 max-w-3xl/max-w-2xl 表單
- **數據影響**: 無，純 CSS class 變更

---

## 9. 相關文件

### 9.1 前置文件

| 文件 | 說明 |
|------|------|
| Epic 20 - Story 20.5 | Reference Number Management Page - List & Filter |
| Epic 20 - Story 20.6 | Reference Number Management Page - Form & Import |
| Epic 21 - Story 21.7 | Exchange Rate Management Page - Form |

### 9.2 參考頁面代碼

| 文件 | 說明 |
|------|------|
| `src/app/[locale]/(dashboard)/admin/template-field-mappings/page.tsx` | 參考：Template Field Mappings 列表頁 |
| `src/components/features/template-field-mapping/TemplateFieldMappingList.tsx` | 參考：Card 內篩選 + 表格模式 |
| `src/app/[locale]/(dashboard)/admin/exchange-rates/page.tsx` | 參考：Exchange Rates 列表頁 |
| `src/components/features/exchange-rate/ExchangeRateFilters.tsx` | 參考：篩選器佈局模式 |

### 9.3 受影響代碼

| 文件 | 說明 |
|------|------|
| `src/components/features/reference-number/ReferenceNumberFilters.tsx` | 篩選器組件 |
| `src/app/[locale]/(dashboard)/admin/reference-numbers/new/page.tsx` | 新增頁面 |
| `src/app/[locale]/(dashboard)/admin/reference-numbers/[id]/page.tsx` | 編輯頁面 |
| `src/app/[locale]/(dashboard)/admin/exchange-rates/new/page.tsx` | Exchange Rates 新增頁面 |

---

## 10. 待決事項

| # | 事項 | 狀態 | 優先級 | 說明 |
|---|------|------|--------|------|
| 1 | 確認表單寬度方案 | ⏳ 待確認 | P0 | max-w-4xl 或 max-w-5xl？ |
| 2 | 確認是否同步 Exchange Rates | ⏳ 待確認 | P1 | 是否一併調整 Exchange Rates 頁面寬度？ |
| 3 | Exchange Rates 編輯頁是否存在 | ⏳ 待確認 | P1 | 需確認 `exchange-rates/[id]/page.tsx` 文件存在 |

---

**文檔建立日期**: 2026-02-06
**作者**: AI Assistant (Claude)
**版本**: 1.0.0
**狀態**: ⏳ 待實作

### 更新記錄

| 版本 | 日期 | 變更內容 |
|------|------|---------|
| 1.0.0 | 2026-02-06 | 初始版本 - 完整規劃文檔，含列表頁篩選器和表單頁寬度優化分析 |
