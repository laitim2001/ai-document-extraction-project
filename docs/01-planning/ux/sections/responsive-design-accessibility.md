# Responsive Design & Accessibility

本章節定義系統的響應式設計策略和無障礙合規標準。

## Responsive Strategy（響應式策略）

### Desktop Strategy（桌面優先）

作為企業級數據處理平台，**桌面是主要使用環境**：

| 功能區域 | 桌面策略 | 利用優勢 |
|----------|----------|----------|
| PDF 對照審核 | 雙欄並排顯示（55:45） | 最大化對比效率 |
| 數據表格 | 完整欄位展示 + 批次操作工具列 | 高密度信息展示 |
| Dashboard | 多卡片網格佈局（3-4 欄） | 一覽式統計概覽 |
| 側邊欄 | 展開式導航（w-60） | 完整導航標籤 |

### Tablet Strategy（平板策略）

針對現場核對和移動審批場景：

| 功能區域 | 平板策略 | 適配方式 |
|----------|----------|----------|
| PDF 對照審核 | 切換式顯示（Tab 切換） | PDF / 數據 分頁呈現 |
| 數據表格 | 簡化欄位 + 水平滾動 | 優先顯示核心欄位 |
| Dashboard | 2 欄網格 | 保持統計可讀性 |
| 導航 | 可收起側邊欄（w-14） | 圖標 + 展開操作 |

### Mobile Strategy（行動裝置策略）

針對通知查看和簡單審批操作：

| 功能區域 | 行動策略 | 實作方式 |
|----------|----------|----------|
| PDF 審核 | 僅支持數據查看 | PDF 預覽連結 |
| 數據表格 | 卡片式列表 | 每張發票一張卡片 |
| Dashboard | 單欄堆疊 | 垂直滾動統計 |
| 導航 | 底部 Tab Bar | 4-5 個主要入口 |

## Breakpoint Strategy（斷點策略）

基於 Tailwind CSS 預設斷點，採用 **Desktop-First** 策略：

```
斷點定義:
├─ sm:  640px   → 大型手機（橫向）
├─ md:  768px   → 平板（直向）     ← 平板起點
├─ lg:  1024px  → 平板（橫向）/ 小筆電
├─ xl:  1280px  → 桌面標準         ← 主要設計目標
└─ 2xl: 1536px  → 大螢幕桌面
```

### 關鍵佈局變化

| 斷點 | 佈局變化 | CSS 類別範例 |
|------|----------|--------------|
| < md (768px) | 單欄佈局、底部導航、卡片列表 | `md:hidden`, `block md:grid` |
| md - lg | 雙欄彈性、側邊欄收起、簡化表格 | `md:grid-cols-2 lg:grid-cols-3` |
| ≥ lg | 完整功能、雙欄對照、展開導航 | `lg:flex lg:gap-6` |
| ≥ xl | 優化間距、增加信息密度 | `xl:px-8 xl:max-w-7xl` |

### PDF 對照審核響應式

```
螢幕寬度 → 佈局策略:
├─ ≥1280px: ResizablePanel 雙欄 (55% : 45%)
├─ 1024-1279px: ResizablePanel 雙欄 (50% : 50%)
├─ 768-1023px: Tab 切換 (PDF Tab | Data Tab)
└─ <768px: 僅數據卡片 + PDF 下載連結
```

## Accessibility Strategy（無障礙策略）

### WCAG 合規等級

**目標等級：WCAG 2.1 Level AA**

理由：
- 企業級產品的行業標準
- 符合政府採購無障礙要求
- 平衡開發成本與可及性

### 核心無障礙要求

| 類別 | 要求 | 實作標準 |
|------|------|----------|
| 顏色對比 | 文字 4.5:1 / 大文字 3:1 | 使用 Tailwind 語意色彩 |
| 鍵盤導航 | 100% 功能可鍵盤操作 | Tab 順序 + 焦點指示器 |
| 螢幕閱讀器 | 完整 ARIA 標籤 | 語意 HTML + role 屬性 |
| 觸控目標 | 最小 44x44px | shadcn/ui 按鈕預設符合 |
| 焦點指示 | 2px ring 可見 | focus-visible:ring-2 |

### 鍵盤快捷鍵

| 操作 | 快捷鍵 | 上下文 |
|------|--------|--------|
| 確認當前發票 | Enter / Space | 審核頁面 |
| 下一張發票 | → / J | 發票列表 |
| 上一張發票 | ← / K | 發票列表 |
| 批次確認 | Ctrl/Cmd + Enter | 多選狀態 |
| 開啟搜尋 | Ctrl/Cmd + K | 全局 |
| 關閉彈窗 | Esc | 彈窗開啟時 |

## Testing Strategy（測試策略）

### 響應式測試

| 測試類型 | 工具 | 覆蓋範圍 |
|----------|------|----------|
| 開發時預覽 | Chrome DevTools | 主要斷點模擬 |
| 視覺回歸 | Playwright Screenshot | 各斷點截圖對比 |
| 實機測試 | BrowserStack / 實體設備 | iOS Safari, Android Chrome |
| 觸控測試 | 平板實機 | 手勢、觸控目標 |

### 無障礙測試

| 測試類型 | 工具 | 檢測項目 |
|----------|------|----------|
| 自動化掃描 | axe-core / Lighthouse | WCAG 違規檢測 |
| 螢幕閱讀器 | VoiceOver (Mac) / NVDA (Win) | 朗讀順序、ARIA 正確性 |
| 鍵盤測試 | 手動 Tab 瀏覽 | 焦點順序、可操作性 |
| 對比測試 | WebAIM Contrast Checker | 色彩對比度 |
| 色盲模擬 | Chrome 模擬器 | 信心度識別度 |

## Implementation Guidelines（實作指南）

### 響應式開發規範

```
開發原則:
├─ 使用 Tailwind 響應式類別，避免 @media 查詢
├─ 優先使用 rem/em，避免固定 px（除 1px 邊框）
├─ 圖片使用 next/image 自動響應式優化
├─ 測試每個組件在 3 個主要斷點的表現
└─ 行動端優先測試觸控交互
```

### 無障礙開發規範

```
開發原則:
├─ 使用語意 HTML 元素（button, nav, main, article）
├─ 所有圖片提供 alt 屬性
├─ 表單欄位關聯 label（htmlFor）
├─ 動態內容使用 aria-live 區域
├─ 可交互元素保持 focus-visible 樣式
├─ 避免僅依賴顏色傳達信息
└─ 測試 Tab 鍵遍歷順序
```

### 組件無障礙清單

| 組件 | 必要 ARIA | 鍵盤支援 |
|------|-----------|----------|
| ConfidenceBadge | aria-label（信心度值） | - |
| DataTable | role="grid", aria-sort | 方向鍵導航 |
| PDFCompareView | aria-label（區域說明） | Tab 切換面板 |
| ActionToast | role="alert", aria-live | 自動關閉計時 |
| Dialog | aria-modal, aria-labelledby | Esc 關閉、焦點陷阱 |

---
