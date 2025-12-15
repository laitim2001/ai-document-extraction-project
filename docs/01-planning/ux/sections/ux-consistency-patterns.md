# UX Consistency Patterns

本章節定義系統中所有交互模式的一致性標準，確保用戶體驗的統一性和可預測性。

## Button Hierarchy（按鈕層級系統）

### 視覺層級定義

| 層級 | 變體 | 用途 | 樣式 |
|------|------|------|------|
| Primary | `default` | 主要行動（確認、提交、保存） | 填充背景、高對比 |
| Secondary | `secondary` | 次要行動（取消、返回） | 淺色填充、中等對比 |
| Tertiary | `ghost` | 輔助行動（查看詳情、展開） | 透明背景、低對比 |
| Destructive | `destructive` | 危險操作（刪除、重置） | 紅色填充、警告色 |
| Link | `link` | 導航行動（查看更多、跳轉） | 無背景、帶下劃線 |

### 按鈕尺寸規範

```
尺寸定義（基於 shadcn/ui Button）:
├─ sm: h-8 px-3 text-xs     → 表格內、緊湊區域
├─ default: h-9 px-4 py-2   → 一般表單、對話框
├─ lg: h-10 px-6            → 主要 CTA、頁面級按鈕
└─ icon: h-9 w-9            → 圖標按鈕、工具欄
```

### 狀態規範

| 狀態 | 視覺表現 | 觸發條件 |
|------|----------|----------|
| Default | 標準樣式 | 初始狀態 |
| Hover | 背景加深 5% | 滑鼠懸停 |
| Focus | 2px ring + ring-offset-2 | 鍵盤焦點 |
| Active | 背景加深 10% | 點擊中 |
| Disabled | opacity-50 + cursor-not-allowed | 操作不可用 |
| Loading | Spinner + 禁用交互 | 異步操作中 |

## Feedback Patterns（反饋模式）

### 即時反饋（Toast Notifications）

使用 Sonner 組件統一管理通知：

| 類型 | 持續時間 | 圖標 | 使用場景 |
|------|----------|------|----------|
| Success | 3 秒 | ✓ CheckCircle | 操作成功（確認完成、保存成功） |
| Error | 5 秒 | ✗ XCircle | 操作失敗（提交錯誤、驗證失敗） |
| Warning | 4 秒 | ⚠ AlertTriangle | 需注意（低信心值、數據異常） |
| Info | 3 秒 | ℹ Info | 提示信息（狀態更新、進度通知） |

### 信心度反饋模式

```
信心值 → 視覺反饋:
├─ ≥90%: 綠色徽章 + 自動處理提示
├─ 70-89%: 黃色徽章 + 建議確認提示
└─ <70%: 紅色徽章 + 需要審核警告
```

### 進度反饋

| 場景 | 組件 | 行為 |
|------|------|------|
| 文件上傳 | Progress Bar | 百分比 + 預估時間 |
| 批次處理 | Progress + 計數器 | "處理中 15/100" |
| AI 提取 | Skeleton + Spinner | 脈動動畫 + 狀態文字 |
| 頁面載入 | Skeleton | 內容占位符 |

## Form Patterns（表單模式）

### 輸入欄位規範

| 元素 | 樣式規範 | 行為規範 |
|------|----------|----------|
| Label | text-sm font-medium | 必填標記 * 使用 text-destructive |
| Input | h-9 border-input rounded-md | Focus 時 ring-2 ring-ring |
| Helper Text | text-sm text-muted-foreground | 位於輸入框下方 |
| Error Text | text-sm text-destructive | 替換 helper text 顯示 |

### 表單驗證模式

```
驗證時機策略:
├─ onBlur: 欄位失去焦點時驗證（推薦）
├─ onChange: 即時驗證（用於格式化輸入）
└─ onSubmit: 提交時統一驗證

錯誤顯示:
├─ 欄位級: 紅色邊框 + 錯誤訊息
├─ 表單級: Alert 組件置頂顯示
└─ 欄位 + 表單: 複合錯誤同時顯示
```

### 發票數據編輯模式

針對 AI 提取數據的特殊編輯模式：

| 狀態 | 視覺表現 | 交互行為 |
|------|----------|----------|
| AI 原始值 | 淺灰背景標籤 | 顯示原始提取值 |
| 用戶修正 | 白色背景 + 藍色邊框 | 可編輯輸入框 |
| 已確認 | 綠色 checkmark | 鎖定狀態 |
| 有衝突 | 黃色警告邊框 | 提示需要審核 |

## Navigation Patterns（導航模式）

### 主導航結構

```
AppShell 布局:
├─ Header (h-14)
│   ├─ Logo + 系統名稱 (左側)
│   ├─ 全局搜尋 (中央，可選)
│   └─ 用戶菜單 + 通知 (右側)
├─ Sidebar (w-60，可收起至 w-14)
│   ├─ 主導航項目
│   ├─ 分隔線
│   └─ 次要導航項目
└─ Main Content (flex-1)
    └─ Page Content with Breadcrumb
```

### 導航項目狀態

| 狀態 | 視覺表現 |
|------|----------|
| Default | text-muted-foreground |
| Hover | bg-accent text-accent-foreground |
| Active | bg-primary/10 text-primary font-medium |
| Disabled | opacity-50 cursor-not-allowed |

### 麵包屑規範

```
格式: Dashboard / Invoices / INV-2024-001
├─ 分隔符: / 或 ChevronRight 圖標
├─ 當前頁: text-foreground (不可點擊)
├─ 父層頁: text-muted-foreground (可點擊)
└─ 最大層級: 3-4 層，超過用 ... 省略
```

## Empty & Loading States（空狀態和載入狀態）

### 空狀態設計

| 場景 | 標題 | 描述 | CTA |
|------|------|------|-----|
| 首次使用 | 開始處理您的第一張發票 | 上傳 PDF 開始體驗 AI 提取 | [上傳發票] |
| 搜尋無結果 | 找不到符合的發票 | 嘗試調整篩選條件 | [清除篩選] |
| 處理隊列為空 | 所有發票已處理完成 | 您的工作已完成！ | [查看統計] |
| 錯誤狀態 | 載入發票時發生錯誤 | 請稍後再試或聯繫支援 | [重試] |

### 載入狀態模式

| 類型 | 組件 | 使用場景 |
|------|------|----------|
| 全頁載入 | Spinner + 文字 | 初始頁面載入 |
| 區域載入 | Skeleton | 表格、卡片內容載入 |
| 按鈕載入 | Button with Spinner | 異步操作中 |
| 無限滾動 | 底部 Spinner | 載入更多內容 |

### Skeleton 規範

```
Skeleton 尺寸匹配:
├─ 文字: h-4 rounded-sm
├─ 標題: h-6 rounded-sm
├─ 頭像: h-10 w-10 rounded-full
├─ 圖片: aspect-video rounded-md
└─ 卡片: h-[200px] rounded-lg
```

## Modal & Overlay Patterns（彈窗和覆蓋層模式）

### 對話框類型

| 類型 | 尺寸 | 用途 | 關閉方式 |
|------|------|------|----------|
| Alert Dialog | sm (max-w-sm) | 確認操作、警告 | 僅按鈕 |
| Form Dialog | md (max-w-md) | 簡單表單輸入 | 按鈕 + X |
| Detail Dialog | lg (max-w-lg) | 詳細信息展示 | 按鈕 + X + Backdrop |
| Full Dialog | full (max-w-4xl) | PDF 對照審核 | 按鈕 + X + Backdrop |

### 對話框行為規範

```
開啟動畫: fade-in + scale (150ms)
關閉動畫: fade-out + scale (100ms)
背景: bg-black/50 backdrop-blur-sm
焦點管理: 自動聚焦到首個可交互元素
ESC 關閉: 除 Alert Dialog 外皆支持
```

### 確認對話框規範

針對批次操作的確認流程：

| 操作類型 | 標題格式 | 動作按鈕 |
|----------|----------|----------|
| 單一確認 | 確認發票 INV-001？ | [取消] [確認] |
| 批次確認 | 確認選中的 15 張發票？ | [取消] [全部確認] |
| 刪除操作 | 確定要刪除？ | [取消] [刪除]（destructive） |

## Data Display Patterns（數據展示模式）

### 表格規範（基於 DataTable）

| 元素 | 樣式 | 行為 |
|------|------|------|
| Header | bg-muted font-medium | 支持排序、固定 |
| Row | hover:bg-muted/50 | 可選擇、可展開 |
| Cell | py-3 px-4 | 文字左對齊、數字右對齊 |
| 分頁 | 底部居中 | 10/25/50/100 選項 |

### 發票數據表格特殊規範

```
必顯欄位（固定）:
├─ 選擇框 (w-10)
├─ 發票編號 (w-32)
├─ 信心度徽章 (w-24)
└─ 操作按鈕 (w-20)

可收起欄位（響應式）:
├─ 供應商名稱
├─ 發票日期
├─ 金額
└─ 狀態
```

### 數字格式規範

| 類型 | 格式 | 範例 |
|------|------|------|
| 貨幣（TWD） | NT$ #,##0 | NT$ 125,000 |
| 貨幣（USD） | $ #,##0.00 | $ 1,234.56 |
| 百分比 | #0.0% | 92.5% |
| 日期 | YYYY-MM-DD | 2024-12-15 |
| 時間 | HH:mm | 14:30 |

### 信心度展示規範

三重編碼確保可及性：

| 信心度 | 顏色 | 形狀 | 標籤 |
|--------|------|------|------|
| ≥90% | 綠色 (green-500) | 圓形 ● | 高 |
| 70-89% | 黃色 (yellow-500) | 菱形 ◆ | 中 |
| <70% | 紅色 (red-500) | 三角形 ▲ | 低 |

---
