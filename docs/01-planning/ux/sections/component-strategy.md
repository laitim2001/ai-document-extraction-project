# Component Strategy

## Design System Components

**shadcn/ui 可用組件分析：**

| 組件類別 | 可用組件 | 應用場景 |
|---------|---------|---------|
| **佈局** | ResizablePanel, Card, Separator | PDF 對照佈局、卡片容器 |
| **導航** | Tabs, Breadcrumb, NavigationMenu | 視圖切換、層級導航 |
| **數據展示** | Table, DataTable, Badge, Progress | 發票列表、信心度標識 |
| **表單** | Input, Select, Checkbox, Form | 數據修正、篩選器 |
| **反饋** | Toast (Sonner), Alert, Dialog | 操作反饋、確認彈窗 |
| **操作** | Button, DropdownMenu, Command | 確認/修正按鈕、批量操作 |

## Custom Components

### ConfidenceBadge - 信心度徽章

**用途：** 顯示 AI 提取結果的信心度，使用三重編碼

| 屬性 | 說明 |
|------|------|
| **Props** | `confidence: number` (0-100), `size: 'sm' \| 'md' \| 'lg'` |
| **視覺編碼** | 顏色 + 形狀 + 圖標 |
| **狀態** | high (>90%), medium (70-90%), low (<70%) |

```tsx
// 使用示例
<ConfidenceBadge confidence={95} size="md" />
// 輸出: 綠色圓角矩形 + ✓ 圖標 + "95%"
```

**視覺規格：**

| 狀態 | 背景色 | 文字色 | 圖標 | 邊框 |
|------|--------|--------|------|------|
| High | `bg-green-100` | `text-green-800` | CheckCircle | `border-green-200` |
| Medium | `bg-yellow-100` | `text-yellow-800` | Circle | `border-yellow-200` |
| Low | `bg-red-100` | `text-red-800` | AlertTriangle | `border-red-200` |

### PDFCompareView - PDF 對照視圖

**用途：** 並排顯示 PDF 原文和提取數據，支援智能高亮連接

| 屬性 | 說明 |
|------|------|
| **Props** | `pdfUrl: string`, `extractedData: object`, `highlights: HighlightArea[]` |
| **功能** | PDF 渲染、縮放控制、高亮區域、欄位連接 |
| **互動** | 懸停欄位 → 高亮 PDF 對應區域 |

**組件結構：**

```
PDFCompareView
├── PDFViewer (左側)
│   ├── PDFToolbar (縮放、頁碼)
│   ├── PDFCanvas (渲染區)
│   └── HighlightOverlay (高亮層)
└── DataForm (右側)
    ├── FormHeader (發票資訊)
    ├── FieldGroup[] (欄位組)
    └── FormActions (操作按鈕)
```

### InvoiceDataTable - 發票數據表格

**用途：** 顯示發票列表，支援排序、篩選、批量操作

| 屬性 | 說明 |
|------|------|
| **Props** | `data: Invoice[]`, `onConfirm`, `onBatchConfirm` |
| **功能** | 分頁、排序、篩選、批量選擇、行內操作 |
| **列配置** | 信心度、發票號、金額、日期、Forwarder、操作 |

**列規格：**

| 列名 | 寬度 | 對齊 | 排序 | 篩選 |
|------|------|------|------|------|
| 選擇框 | 40px | center | - | - |
| 信心度 | 100px | center | ✓ | ✓ |
| 發票號 | 150px | left | ✓ | ✓ |
| 金額 | 120px | right | ✓ | - |
| 日期 | 100px | center | ✓ | ✓ |
| Forwarder | 120px | left | ✓ | ✓ |
| 操作 | 100px | center | - | - |

### ProcessingStats - 處理統計卡片

**用途：** 側邊欄顯示處理進度和統計數據

| 屬性 | 說明 |
|------|------|
| **Props** | `stats: ProcessingStats` |
| **顯示** | 今日處理量、本週處理量、準確率、預計完成時間 |
| **更新** | 即時更新（WebSocket 或輪詢） |

**數據結構：**

```typescript
interface ProcessingStats {
  todayProcessed: number;
  todayTotal: number;
  weeklyProcessed: number;
  accuracy: number;
  estimatedCompletion: string;
}
```

### ActionToast - 操作反饋 Toast

**用途：** 顯示操作結果的正向反饋訊息

| 類型 | 訊息範例 | 圖標 |
|------|---------|------|
| confirm | 「已確認，處理下一張」 | CheckCircle |
| correction | 「感謝修正，系統將學習此模式」 | Sparkles |
| batch | 「已批量確認 15 張發票」 | CheckCheck |
| undo | 「已撤銷上次操作」 | Undo |

## Component Implementation Strategy

**分層架構：**

```
src/components/
├── ui/                    # shadcn/ui 基礎組件
│   ├── button.tsx
│   ├── table.tsx
│   └── ...
├── invoice/               # 發票業務組件
│   ├── ConfidenceBadge.tsx
│   ├── PDFCompareView.tsx
│   ├── InvoiceDataTable.tsx
│   └── ProcessingStats.tsx
├── common/                # 通用業務組件
│   ├── PageHeader.tsx
│   ├── ActionToast.tsx
│   └── EmptyState.tsx
└── layout/                # 佈局組件
    ├── AppShell.tsx
    ├── Sidebar.tsx
    └── Header.tsx
```

**組件開發原則：**

| 原則 | 實施方式 |
|------|---------|
| **組合優先** | 基於 shadcn/ui 組件組合，而非從零構建 |
| **類型安全** | 所有 Props 使用 TypeScript 定義 |
| **可訪問性** | 內建 ARIA 標籤和鍵盤支援 |
| **可測試** | 每個組件配套 Storybook 故事和單元測試 |
| **樣式一致** | 使用 Design Token，不硬編碼顏色/間距 |

## Implementation Roadmap

**Phase 1: MVP 0.5 核心組件**

| 組件 | 優先級 | 依賴 |
|------|--------|------|
| ConfidenceBadge | P0 | Badge |
| InvoiceDataTable | P0 | DataTable, Checkbox |
| PDFCompareView (基礎版) | P0 | ResizablePanel |
| ActionToast | P0 | Sonner |
| AppShell | P0 | - |

**Phase 2: MVP 1.0 增強組件**

| 組件 | 優先級 | 依賴 |
|------|--------|------|
| PDFCompareView (智能高亮) | P1 | Phase 1 完成 |
| ProcessingStats | P1 | Card, Progress |
| KeyboardShortcuts | P1 | Command |
| BatchConfirmDialog | P1 | Dialog |

**Phase 3: 優化組件**

| 組件 | 優先級 | 依賴 |
|------|--------|------|
| AchievementCard | P2 | Card, Animation |
| UserContributionChart | P2 | Chart library |
| AdvancedFilters | P2 | Popover, Form |

---
