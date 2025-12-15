# Design System Foundation

## Design System Choice

**選擇：shadcn/ui + Tailwind CSS**

| 項目 | 決策 |
|------|------|
| **核心框架** | shadcn/ui（基於 Radix UI） |
| **樣式系統** | Tailwind CSS |
| **圖標庫** | Lucide Icons |
| **技術棧** | Next.js 14 + React 18 + TypeScript |

## Rationale for Selection

**為什麼選擇 shadcn/ui：**

| 考量因素 | shadcn/ui 優勢 |
|---------|---------------|
| **可定制性** | 組件代碼直接複製到項目，完全可控 |
| **無依賴鎖定** | 不是 npm 包，而是代碼模板 |
| **可訪問性** | 基於 Radix UI，內建 WCAG 2.1 AA 支援 |
| **企業適用** | 專業外觀，無花俏動畫 |
| **維護成本** | 組件獨立，更新不破壞現有代碼 |
| **團隊學習** | 文檔完善，社區活躍 |

**與項目需求的契合：**

| 項目需求 | shadcn/ui 對應能力 |
|---------|-------------------|
| 信心度視覺編碼 | Badge、Progress 組件可定制顏色 |
| PDF 並排對照 | ResizablePanel 支援分割視圖 |
| 批量操作 | Table + Checkbox 組件完善 |
| 鍵盤導航 | Radix UI 內建焦點管理 |
| Toast 反饋 | Sonner toast 組件整合 |
| 表單處理 | React Hook Form 整合良好 |

## Implementation Approach

**組件優先級（MVP 0.5）：**

| 優先級 | 組件 | 用途 |
|--------|------|------|
| P0 | Table, DataTable | 發票列表 |
| P0 | Badge | 信心度標識 |
| P0 | Button | 確認/修正操作 |
| P0 | Input, Form | 數據修正 |
| P0 | ResizablePanel | PDF 對照視圖 |
| P1 | Dialog, Sheet | 詳情面板 |
| P1 | Toast (Sonner) | 操作反饋 |
| P1 | Tabs | 視圖切換 |
| P2 | Command | 鍵盤快捷命令（MVP 1.0） |
| P2 | Progress | 處理進度 |

**檔案結構：**

```
src/
├── components/
│   ├── ui/              # shadcn/ui 組件
│   │   ├── button.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   ├── invoice/         # 業務組件
│   │   ├── InvoiceList.tsx
│   │   ├── InvoiceDetail.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   └── PDFViewer.tsx
│   └── common/          # 通用組件
│       ├── PageHeader.tsx
│       └── DataTable.tsx
├── styles/
│   └── globals.css      # Tailwind + CSS 變數
└── lib/
    └── utils.ts         # cn() 工具函數
```

## Customization Strategy

**Design Tokens（CSS 變數）：**

```css
:root {
  /* 信心度顏色系統 */
  --confidence-high: 142 76% 36%;      /* 綠色 - >90% */
  --confidence-medium: 45 93% 47%;     /* 黃色 - 70-90% */
  --confidence-low: 0 84% 60%;         /* 紅色 - <70% */

  /* 品牌色 */
  --primary: 222 47% 11%;              /* 深藍 */
  --secondary: 210 40% 96%;            /* 淺灰藍 */

  /* 狀態色 */
  --success: 142 76% 36%;
  --warning: 45 93% 47%;
  --error: 0 84% 60%;
  --info: 199 89% 48%;

  /* 數據展示 */
  --data-primary: 222 47% 11%;         /* 重要數字 */
  --data-secondary: 215 16% 47%;       /* 次要數字 */
}
```

**信心度視覺系統擴展：**

| 信心度 | 顏色 | 形狀 | 位置 | 樣式類 |
|--------|------|------|------|--------|
| >90% | 綠色 | ✓ 勾號 | 頂部 | `confidence-high` |
| 70-90% | 黃色 | ○ 圓圈 | 中部 | `confidence-medium` |
| <70% | 紅色 | △ 三角 | 底部 | `confidence-low` |

**自定義組件規範：**

| 組件 | 基於 | 自定義內容 |
|------|------|-----------|
| ConfidenceBadge | Badge | 三重編碼（顏色+形狀+圖標） |
| InvoiceRow | TableRow | 信心度排序、批量選擇 |
| PDFCompareView | ResizablePanel | 智能高亮連接（MVP 1.0） |
| ActionToast | Sonner | 正向措辭反饋 |

## Design System Governance

**組件添加流程：**

1. 檢查 shadcn/ui 是否有現成組件
2. 有 → 使用 `npx shadcn-ui@latest add [component]`
3. 無 → 基於 Radix UI 構建，遵循 shadcn/ui 風格
4. 添加 Storybook 文檔
5. 更新組件索引

**風格統一原則：**

- 圓角：`rounded-md`（6px）統一使用
- 間距：基於 4px 網格（`space-1` = 4px）
- 字體：系統字體棧，中文優先 Noto Sans TC
- 陰影：僅在懸浮和彈窗使用 `shadow-md`
- 動畫：150ms ease-out，保持專業克制

---
