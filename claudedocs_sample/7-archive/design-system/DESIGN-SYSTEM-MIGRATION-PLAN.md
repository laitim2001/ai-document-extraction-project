# 🎨 設計系統遷移執行計劃

> **遷移策略**: 漸進式遷移 (方案 A) + POC 驗證
> **參考項目**: ai-sales-enablement-webapp (Demo 項目)
> **目標**: 建立完整的設計系統，提升 UI/UX 一致性和專業度
> **預估時間**: 16-22 天 (3-4 週)
> **風險等級**: 🟡 中等 (可控)

**最後更新**: 2025-10-15
**狀態**: 📋 計劃階段

---

## 📋 目錄

1. [總體策略](#總體策略)
2. [POC 驗證計劃](#poc-驗證計劃)
3. [階段 1: 設計系統基礎](#階段-1-設計系統基礎)
4. [階段 2: UI 組件庫升級](#階段-2-ui-組件庫升級)
5. [階段 3: 頁面逐步遷移](#階段-3-頁面逐步遷移)
6. [階段 4: 進階功能整合](#階段-4-進階功能整合)
7. [Git 分支策略](#git-分支策略)
8. [驗收標準](#驗收標準)
9. [風險管理](#風險管理)
10. [時間表與里程碑](#時間表與里程碑)

---

## 🎯 總體策略

### 遷移原則

1. **漸進式遷移**: 分階段實施，每階段都有明確的驗收標準和回退點
2. **不影響現有功能**: 只改 UI 樣式，不動核心業務邏輯
3. **保持向後兼容**: 舊組件和新組件可並存過渡期
4. **先驗證後推廣**: POC 驗證成功後才進行全面遷移
5. **持續測試**: 每階段完成後進行回歸測試

### 技術目標

- ✅ 建立基於 CSS 變數的設計系統
- ✅ 實現亮色/暗色主題切換
- ✅ 統一 UI 組件庫（基於 shadcn/ui 風格）
- ✅ 提升用戶體驗一致性
- ✅ 減少樣式硬編碼和技術債務

### 業務目標

- ✅ 提升平台專業度和視覺吸引力
- ✅ 增強品牌一致性
- ✅ 改善用戶體驗和滿意度
- ✅ 為未來擴展打下良好基礎

---

## 🧪 POC 驗證計劃

### POC 目標

**用最小代價驗證新設計系統的可行性和視覺效果**

### POC 範圍

**只遷移 2 個高可見度頁面**:
1. **Dashboard 首頁** (`apps/web/src/app/dashboard/page.tsx`)
2. **Login 頁面** (`apps/web/src/app/login/page.tsx`)

### POC 任務清單

#### **Day 1: 設計系統建立 (4-6 小時)**

- [ ] **Task 1.1**: 建立 POC 分支 `feature/design-system-poc`
  ```bash
  git checkout develop
  git pull origin develop
  git checkout -b feature/design-system-poc
  ```

- [ ] **Task 1.2**: 複製 demo 項目的設計系統文件
  - 複製 `globals.css` 的 CSS 變數系統
  - 複製 `tailwind.config.ts` 的配置
  - 建立 `lib/utils.ts` (cn 函數)

- [ ] **Task 1.3**: 安裝必要依賴
  ```bash
  pnpm add class-variance-authority clsx tailwind-merge
  ```

- [ ] **Task 1.4**: 建立 5-8 個核心 UI 組件
  - Button (使用 CVA)
  - Card (CardHeader, CardTitle, CardContent)
  - Badge
  - Input
  - Alert

- [ ] **Task 1.5**: 驗證設計系統運行
  - 測試 CSS 變數生效
  - 測試 cn() 函數正常
  - 測試暗色模式切換（手動修改 HTML class）

**驗收標準**:
- [ ] ✅ CSS 變數系統正常運行
- [ ] ✅ 新組件樣式正確
- [ ] ✅ 無編譯錯誤

---

#### **Day 2: 頁面遷移 (4-6 小時)**

- [ ] **Task 2.1**: 遷移 Login 頁面
  - 使用新的 Button 組件
  - 使用新的 Input 組件
  - 使用新的 Card 組件包裝表單
  - 應用設計系統色彩變數

- [ ] **Task 2.2**: 遷移 Dashboard 首頁
  - 統計卡片使用新 Card 組件
  - 按鈕使用新 Button 組件
  - Badge 使用新 Badge 組件
  - 應用設計系統色彩變數

- [ ] **Task 2.3**: 截圖對比
  - 遷移前截圖（當前設計）
  - 遷移後截圖（新設計）
  - 暗色模式截圖

- [ ] **Task 2.4**: 功能測試
  - 登入功能正常
  - Dashboard 數據載入正常
  - 所有交互正常

**驗收標準**:
- [ ] ✅ 2 個頁面視覺效果提升
- [ ] ✅ 所有功能無倒退
- [ ] ✅ 無 console 錯誤

---

#### **Day 2.5: 評估與決策 (2-3 小時)**

- [ ] **Task 3.1**: 準備展示材料
  - 遷移前後對比圖
  - 暗色模式效果圖
  - 設計系統文檔說明

- [ ] **Task 3.2**: 用戶評估
  - 視覺效果是否滿意
  - 用戶體驗是否改善
  - 是否值得繼續完整遷移

- [ ] **Task 3.3**: 決策點
  - ✅ **如果滿意** → 繼續完整遷移（階段 1-4）
  - ⚠️ **如果需調整** → 修改設計後再評估
  - ❌ **如果不滿意** → 放棄遷移，回退分支

**POC 總時間**: 1.5 天
**POC 風險**: 🟢 極低

---

## 📐 階段 1: 設計系統基礎

### 階段目標

建立完整的設計系統基礎架構，為後續遷移打下堅實基礎。

### 時間預估

**2-3 天**

### 詳細任務清單

#### **Task 1.1: Git 分支管理 (30 分鐘)**

```bash
# 從 develop 分支創建遷移分支
git checkout develop
git pull origin develop
git checkout -b feature/design-system-migration

# 建立階段分支（可選，用於更細粒度管理）
git checkout -b phase-1-css-variables
```

**驗收標準**:
- [ ] ✅ 分支創建成功
- [ ] ✅ 基於最新 develop 分支

---

#### **Task 1.2: CSS 變數系統遷移 (3-4 小時)**

**1. 更新 `apps/web/src/app/globals.css`**

```css
/**
 * ================================================================
 * IT 專案流程管理平台 - 全域CSS樣式
 * ================================================================
 *
 * 【設計系統】
 * • 主色調: Blue (藍色) - 專業、信任感
 * • 次要色: Gray (灰色) - 中性、平衡
 * • 語意色彩: 成功(綠)、警告(黃)、錯誤(紅)
 * • 字體: Inter - 現代、易讀的無襯線字體
 */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* === 基礎色彩系統 (HSL格式) === */
    --background: 0 0% 100%;           /* 主背景色 - 純白色 */
    --foreground: 222.2 84% 4.9%;      /* 主文字色 - 深藍灰色 */

    /* === 卡片組件色彩 === */
    --card: 0 0% 100%;                 /* 卡片背景 - 白色 */
    --card-foreground: 222.2 84% 4.9%; /* 卡片文字 - 深藍灰色 */

    /* === 彈出視窗色彩 === */
    --popover: 0 0% 100%;              /* 彈出視窗背景 - 白色 */
    --popover-foreground: 222.2 84% 4.9%; /* 彈出視窗文字 - 深藍灰色 */

    /* === 主要色彩 (品牌色) === */
    --primary: 221.2 83.2% 53.3%;      /* 主色 - 藍色(#3B82F6) */
    --primary-foreground: 210 40% 98%; /* 主色文字 - 接近白色 */

    /* === 次要色彩 === */
    --secondary: 210 40% 96%;          /* 次要色 - 淺灰藍 */
    --secondary-foreground: 222.2 84% 4.9%; /* 次要色文字 - 深藍灰 */

    /* === 靜音色彩 (低對比度) === */
    --muted: 210 40% 96%;              /* 靜音背景 - 淺灰 */
    --muted-foreground: 215.4 16.3% 46.9%; /* 靜音文字 - 中灰 */

    /* === 強調色彩 === */
    --accent: 210 40% 96%;             /* 強調背景 - 淺灰 */
    --accent-foreground: 222.2 84% 4.9%; /* 強調文字 - 深藍灰 */

    /* === 破壞性操作色彩 (錯誤/刪除) === */
    --destructive: 0 84.2% 60.2%;      /* 破壞性背景 - 紅色 */
    --destructive-foreground: 210 40% 98%; /* 破壞性文字 - 白色 */

    /* === 邊框和輸入框色彩 === */
    --border: 214.3 31.8% 91.4%;       /* 邊框色 - 淺灰 */
    --input: 214.3 31.8% 91.4%;        /* 輸入框邊框 - 淺灰 */

    /* === 聚焦環色彩 === */
    --ring: 221.2 83.2% 53.3%;         /* 聚焦環 - 主藍色 */

    /* === 全域圓角大小 === */
    --radius: 0.5rem;                  /* 預設圓角 - 8px */
  }

  /* 暗色主題色彩覆寫 */
  .dark {
    --background: 222.2 84% 4.9%;      /* 主背景色 - 深藍灰 */
    --foreground: 210 40% 98%;         /* 主文字色 - 接近白色 */

    --card: 222.2 84% 4.9%;            /* 卡片背景 - 深藍灰 */
    --card-foreground: 210 40% 98%;    /* 卡片文字 - 接近白色 */

    --popover: 222.2 84% 4.9%;         /* 彈出視窗背景 - 深藍灰 */
    --popover-foreground: 210 40% 98%; /* 彈出視窗文字 - 接近白色 */

    --primary: 217.2 91.2% 59.8%;      /* 主色 - 亮藍色 */
    --primary-foreground: 222.2 47.4% 11.2%; /* 主色文字 - 深色 */

    --secondary: 217.2 32.6% 17.5%;    /* 次要色 - 深灰藍 */
    --secondary-foreground: 210 40% 98%; /* 次要色文字 - 白色 */

    --muted: 217.2 32.6% 17.5%;        /* 靜音背景 - 深灰 */
    --muted-foreground: 215 20.2% 65.1%; /* 靜音文字 - 淺灰 */

    --accent: 217.2 32.6% 17.5%;       /* 強調背景 - 深灰 */
    --accent-foreground: 210 40% 98%;  /* 強調文字 - 白色 */

    --destructive: 0 62.8% 30.6%;      /* 破壞性背景 - 暗紅 */
    --destructive-foreground: 210 40% 98%; /* 破壞性文字 - 白色 */

    --border: 217.2 32.6% 17.5%;       /* 邊框色 - 深灰 */
    --input: 217.2 32.6% 17.5%;        /* 輸入框邊框 - 深灰 */

    --ring: 224.3 76.3% 48%;           /* 聚焦環 - 藍色 */
  }
}

/* 全域基礎樣式 */
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

**驗收標準**:
- [ ] ✅ CSS 變數系統定義完整
- [ ] ✅ 亮色主題變數正確
- [ ] ✅ 暗色主題變數正確
- [ ] ✅ 無編譯錯誤

---

#### **Task 1.3: Tailwind 配置更新 (1-2 小時)**

**更新 `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"], // 啟用 class 模式的暗色主題
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 使用 CSS 變數定義色彩
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
```

**驗收標準**:
- [ ] ✅ Tailwind 配置引用 CSS 變數
- [ ] ✅ 暗色模式配置正確
- [ ] ✅ 圓角系統配置正確
- [ ] ✅ TypeScript 無類型錯誤

---

#### **Task 1.4: 工具函數建立 (30 分鐘)**

**建立 `apps/web/src/lib/utils.ts`**

```typescript
/**
 * ================================================================
 * 工具函數 - className 合併工具
 * ================================================================
 *
 * 【主要功能】
 * • cn() - 合併和優化 Tailwind CSS 類名
 * • 使用 clsx 進行條件類名處理
 * • 使用 tailwind-merge 解決 Tailwind 類名衝突
 *
 * 【使用範例】
 * ```tsx
 * // 基本使用
 * cn("px-4 py-2", "bg-blue-500") // "px-4 py-2 bg-blue-500"
 *
 * // 條件類名
 * cn("px-4", isActive && "bg-blue-500") // isActive 為 true 時包含 bg-blue-500
 *
 * // 解決衝突（後者覆蓋前者）
 * cn("px-2 py-1", "px-4") // "py-1 px-4"
 * ```
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合併 className 的工具函數
 * @param inputs - 任意數量的 className 值（字串、物件、陣列）
 * @returns 合併且優化後的 className 字串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**安裝依賴**

```bash
cd apps/web
pnpm add class-variance-authority clsx tailwind-merge
```

**驗收標準**:
- [ ] ✅ `utils.ts` 文件建立成功
- [ ] ✅ 依賴安裝成功
- [ ] ✅ cn() 函數可正常導入使用
- [ ] ✅ TypeScript 類型正確

---

#### **Task 1.5: 驗證設計系統 (1 小時)**

**建立測試頁面驗證設計系統**

```bash
# 建立測試頁面
apps/web/src/app/design-system-test/page.tsx
```

```tsx
/**
 * 設計系統測試頁面
 * 用於驗證 CSS 變數和色彩系統是否正常運行
 */
export default function DesignSystemTestPage() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">設計系統測試頁面</h1>

      {/* 測試主色 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">主要色彩</h2>
        <div className="flex gap-4">
          <div className="bg-primary text-primary-foreground p-4 rounded-lg">
            Primary
          </div>
          <div className="bg-secondary text-secondary-foreground p-4 rounded-lg">
            Secondary
          </div>
          <div className="bg-destructive text-destructive-foreground p-4 rounded-lg">
            Destructive
          </div>
        </div>
      </div>

      {/* 測試背景色 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">背景色彩</h2>
        <div className="flex gap-4">
          <div className="bg-muted text-muted-foreground p-4 rounded-lg">
            Muted
          </div>
          <div className="bg-accent text-accent-foreground p-4 rounded-lg">
            Accent
          </div>
        </div>
      </div>

      {/* 測試邊框 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">邊框與圓角</h2>
        <div className="flex gap-4">
          <div className="border p-4 rounded-lg">
            Border + Large Radius
          </div>
          <div className="border p-4 rounded-md">
            Border + Medium Radius
          </div>
          <div className="border p-4 rounded-sm">
            Border + Small Radius
          </div>
        </div>
      </div>
    </div>
  );
}
```

**測試步驟**:
1. 啟動開發服務器: `pnpm dev`
2. 訪問 `http://localhost:3000/design-system-test`
3. 檢查色彩是否正確顯示
4. 手動切換暗色模式測試:
   ```javascript
   // 在瀏覽器 Console 執行
   document.documentElement.classList.add('dark')    // 啟用暗色
   document.documentElement.classList.remove('dark') // 回到亮色
   ```

**驗收標準**:
- [ ] ✅ 亮色模式色彩正確
- [ ] ✅ 暗色模式色彩正確
- [ ] ✅ 邊框和圓角正確
- [ ] ✅ 無 console 錯誤

---

### 階段 1 總體驗收標準

- [ ] ✅ CSS 變數系統完整建立（30+ 個變數）
- [ ] ✅ Tailwind 配置引用 CSS 變數
- [ ] ✅ cn() 工具函數可用
- [ ] ✅ 暗色模式手動切換成功
- [ ] ✅ 測試頁面顯示正確
- [ ] ✅ 無編譯錯誤和 TypeScript 錯誤
- [ ] ✅ Git commit 已提交

**提交 Git**:
```bash
git add .
git commit -m "feat(design-system): 階段 1 - 建立 CSS 變數系統和設計基礎

- 新增完整的 CSS 變數系統（亮色/暗色主題）
- 更新 Tailwind 配置引用設計系統變數
- 建立 cn() className 合併工具函數
- 新增設計系統測試頁面驗證功能
- 安裝依賴: class-variance-authority, clsx, tailwind-merge

🎨 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🧩 階段 2: UI 組件庫升級

### 階段目標

補充缺失的 UI 組件並統一現有組件樣式，建立完整的組件庫。

### 時間預估

**4-5 天**

### 組件優先級分類

#### **Priority 1: 核心基礎組件 (必須)** - Day 1-2

這些組件是其他組件的基礎，必須優先完成。

1. **Button** - 按鈕組件 (重構)
2. **Input** - 輸入框組件 (重構)
3. **Label** - 標籤組件 (重構)
4. **Card** - 卡片組件 (重構，完善複合組件)
5. **Badge** - 徽章組件 (重構)
6. **Separator** - 分隔線組件 (新增)

#### **Priority 2: 表單與交互組件** - Day 2-3

這些組件用於表單和用戶交互。

7. **Select** - 下拉選單 (重構)
8. **Textarea** - 多行文本 (重構)
9. **Checkbox** - 核取框 (新增)
10. **Switch** - 開關組件 (新增)
11. **Slider** - 滑桿組件 (新增)

#### **Priority 3: 反饋與提示組件** - Day 3-4

這些組件用於用戶反饋和提示。

12. **Alert** - 提示訊息 (新增)
13. **Alert Dialog** - 確認對話框 (新增)
14. **Toast** - 彈出通知 (重構)
15. **Progress** - 進度條 (新增)

#### **Priority 4: 進階組件** - Day 4-5

這些組件提供進階功能。

16. **Dialog** - 對話框 (重構)
17. **Dropdown Menu** - 下拉選單 (新增)
18. **Popover** - 彈出視窗 (新增)
19. **Command** - 快速搜尋 (新增)
20. **Tabs** - 選項卡 (新增)
21. **Avatar** - 頭像組件 (新增)
22. **Skeleton** - 骨架屏 (重構)

#### **Priority 5: 特殊組件 (可選)** - Day 5+

根據時間和需求決定是否實現。

23. **Calendar** - 日曆選擇器
24. **Date Picker** - 日期選擇器
25. **Table** - 表格組件 (重構)

---

### 詳細任務清單

#### **Day 1: 核心基礎組件 (Part 1)**

**Task 2.1: Button 組件重構 (使用 CVA) - 1.5 小時**

**文件路徑**: `apps/web/src/components/ui/button.tsx`

```tsx
/**
 * ================================================================
 * Button 組件 - 基於 shadcn/ui 風格
 * ================================================================
 *
 * 【功能說明】
 * 統一的按鈕組件，支援多種變體和尺寸
 *
 * 【使用 CVA (class-variance-authority)】
 * 提供類型安全的變體管理
 *
 * 【變體說明】
 * • variant: default, destructive, outline, secondary, ghost, link
 * • size: default, sm, lg, icon
 *
 * 【使用範例】
 * ```tsx
 * <Button>預設按鈕</Button>
 * <Button variant="destructive">刪除</Button>
 * <Button variant="outline" size="sm">小按鈕</Button>
 * <Button variant="ghost" size="icon"><IconPlus /></Button>
 * ```
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// 使用 CVA 定義按鈕變體
const buttonVariants = cva(
  // 基礎樣式（所有按鈕共用）
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      // 視覺變體
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // 尺寸變體
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

**安裝依賴**:
```bash
pnpm add @radix-ui/react-slot
```

**驗收標準**:
- [ ] ✅ Button 組件使用 CVA
- [ ] ✅ 6 種 variant 正常運行
- [ ] ✅ 4 種 size 正常運行
- [ ] ✅ 支援 asChild prop (Radix Slot)
- [ ] ✅ 使用設計系統色彩變數
- [ ] ✅ TypeScript 類型完整

---

**Task 2.2: Card 組件重構（完善複合組件）- 1 小時**

**文件路徑**: `apps/web/src/components/ui/card.tsx`

```tsx
/**
 * ================================================================
 * Card 組件 - 卡片容器
 * ================================================================
 *
 * 【複合組件結構】
 * • Card - 主容器
 * • CardHeader - 頂部區域
 * • CardTitle - 標題
 * • CardDescription - 描述文字
 * • CardContent - 內容區域
 * • CardFooter - 底部區域
 *
 * 【使用範例】
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>卡片標題</CardTitle>
 *     <CardDescription>卡片描述</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     卡片內容
 *   </CardContent>
 *   <CardFooter>
 *     <Button>操作</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

**驗收標準**:
- [ ] ✅ Card 複合組件完整
- [ ] ✅ 5 個子組件正常運行
- [ ] ✅ 使用設計系統色彩
- [ ] ✅ forwardRef 支援

---

**Task 2.3: Badge 組件重構 (使用 CVA) - 45 分鐘**

**文件路徑**: `apps/web/src/components/ui/badge.tsx`

```tsx
/**
 * ================================================================
 * Badge 組件 - 徽章/標籤
 * ================================================================
 *
 * 【變體說明】
 * • variant: default, secondary, destructive, outline, success, warning
 *
 * 【使用範例】
 * ```tsx
 * <Badge>預設</Badge>
 * <Badge variant="destructive">錯誤</Badge>
 * <Badge variant="success">成功</Badge>
 * ```
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        warning:
          "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
```

**驗收標準**:
- [ ] ✅ Badge 使用 CVA
- [ ] ✅ 6 種 variant 正常
- [ ] ✅ 新增 success/warning 變體
- [ ] ✅ 使用設計系統色彩

---

**Task 2.4: Input 和 Label 組件重構 - 1 小時**

**Input 組件** (`apps/web/src/components/ui/input.tsx`):

```tsx
/**
 * ================================================================
 * Input 組件 - 輸入框
 * ================================================================
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

**Label 組件** (`apps/web/src/components/ui/label.tsx`):

```tsx
/**
 * ================================================================
 * Label 組件 - 表單標籤
 * ================================================================
 */

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

**安裝依賴**:
```bash
pnpm add @radix-ui/react-label
```

**驗收標準**:
- [ ] ✅ Input 使用設計系統樣式
- [ ] ✅ Label 基於 Radix UI
- [ ] ✅ forwardRef 支援
- [ ] ✅ 無障礙支援

---

**Task 2.5: Separator 組件新增 - 30 分鐘**

**文件路徑**: `apps/web/src/components/ui/separator.tsx`

```tsx
/**
 * ================================================================
 * Separator 組件 - 分隔線
 * ================================================================
 *
 * 【使用範例】
 * ```tsx
 * <Separator />
 * <Separator orientation="vertical" className="h-4" />
 * ```
 */

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
```

**安裝依賴**:
```bash
pnpm add @radix-ui/react-separator
```

**驗收標準**:
- [ ] ✅ 水平分隔線正常
- [ ] ✅ 垂直分隔線正常
- [ ] ✅ 使用設計系統 border 色彩

---

**Day 1 驗收標準**:
- [ ] ✅ 6 個核心基礎組件完成
- [ ] ✅ 所有組件使用 CVA（Button, Badge）
- [ ] ✅ 所有組件使用設計系統變數
- [ ] ✅ 所有組件有完整中文註釋
- [ ] ✅ TypeScript 無錯誤
- [ ] ✅ 測試組件正常運行

**Git Commit**:
```bash
git add .
git commit -m "feat(ui): 階段 2 Day 1 - 核心基礎組件重構

- 重構 Button 組件使用 CVA（6種變體）
- 完善 Card 複合組件（5個子組件）
- 重構 Badge 組件使用 CVA（6種變體，新增 success/warning）
- 重構 Input 和 Label 組件使用設計系統
- 新增 Separator 分隔線組件
- 所有組件使用設計系統 CSS 變數

🎨 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

#### **Day 2: 核心基礎組件 (Part 2) + 表單組件開始**

**預計完成組件**: Select, Textarea, Checkbox, Switch

由於篇幅限制，完整的 Day 2-5 任務清單將在下一部分文檔中繼續...

---

### 階段 2 組件清單總覽

| # | 組件名稱 | 類型 | 優先級 | 預估時間 | 狀態 |
|---|---------|------|--------|---------|------|
| 1 | Button | 重構 | P1 | 1.5h | ⏳ Pending |
| 2 | Card | 重構 | P1 | 1h | ⏳ Pending |
| 3 | Badge | 重構 | P1 | 45min | ⏳ Pending |
| 4 | Input | 重構 | P1 | 30min | ⏳ Pending |
| 5 | Label | 重構 | P1 | 30min | ⏳ Pending |
| 6 | Separator | 新增 | P1 | 30min | ⏳ Pending |
| 7 | Select | 重構 | P2 | 2h | ⏳ Pending |
| 8 | Textarea | 重構 | P2 | 45min | ⏳ Pending |
| 9 | Checkbox | 新增 | P2 | 1h | ⏳ Pending |
| 10 | Switch | 新增 | P2 | 1h | ⏳ Pending |
| 11 | Slider | 新增 | P2 | 1h | ⏳ Pending |
| 12 | Alert | 新增 | P3 | 1h | ⏳ Pending |
| 13 | Alert Dialog | 新增 | P3 | 1.5h | ⏳ Pending |
| 14 | Toast | 重構 | P3 | 1.5h | ⏳ Pending |
| 15 | Progress | 新增 | P3 | 45min | ⏳ Pending |
| 16 | Dialog | 重構 | P4 | 1.5h | ⏳ Pending |
| 17 | Dropdown Menu | 新增 | P4 | 2h | ⏳ Pending |
| 18 | Popover | 新增 | P4 | 1h | ⏳ Pending |
| 19 | Command | 新增 | P4 | 2h | ⏳ Pending |
| 20 | Tabs | 新增 | P4 | 1.5h | ⏳ Pending |
| 21 | Avatar | 新增 | P4 | 1h | ⏳ Pending |
| 22 | Skeleton | 重構 | P4 | 45min | ⏳ Pending |

**總預估時間**: 24-26 小時 (約 4-5 工作日)

---

## 📄 階段 3: 頁面逐步遷移

### 階段目標

將現有頁面逐步遷移到新設計系統，確保視覺一致性和功能完整性。

### 時間預估

**5-7 天**

### 頁面優先級分類

#### **Priority 1: 核心頁面 (高可見度)** - Day 1-3

1. **Dashboard 首頁** (`apps/web/src/app/dashboard/page.tsx`)
2. **Login 頁面** (`apps/web/src/app/login/page.tsx`)
3. **專案列表頁** (`apps/web/src/app/projects/page.tsx`)
4. **Budget Pool 列表頁** (`apps/web/src/app/budget-pools/page.tsx`)

#### **Priority 2: 詳情頁面** - Day 3-5

5. **專案詳情頁** (`apps/web/src/app/projects/[id]/page.tsx`)
6. **Budget Pool 詳情頁** (`apps/web/src/app/budget-pools/[id]/page.tsx`)
7. **Proposal 詳情頁** (`apps/web/src/app/proposals/[id]/page.tsx`)
8. **User 詳情頁** (`apps/web/src/app/users/[id]/page.tsx`)

#### **Priority 3: 表單頁面** - Day 5-7

9. **專案新增/編輯頁** (`apps/web/src/app/projects/new/page.tsx`, `[id]/edit/page.tsx`)
10. **Budget Pool 新增/編輯頁**
11. **Proposal 新增/編輯頁**
12. **User 新增/編輯頁**

#### **Priority 4: 其他頁面** - Day 7+

13. **設置頁面**
14. **錯誤頁面**
15. **通知頁面**

### 遷移模式與檢查清單

每個頁面遷移需要檢查以下項目:

#### **樣式遷移檢查清單**

- [ ] **色彩系統**: 所有硬編碼色彩改用設計系統變數
  - `bg-blue-500` → `bg-primary`
  - `text-gray-700` → `text-foreground`
  - `border-gray-300` → `border-border`

- [ ] **組件替換**: 使用新的 UI 組件
  - 按鈕 → 新 `<Button>` 組件
  - 卡片 → 新 `<Card>` 複合組件
  - 徽章 → 新 `<Badge>` 組件
  - 輸入框 → 新 `<Input>` 組件
  - 下拉選單 → 新 `<Select>` 組件

- [ ] **間距統一**: 使用 Tailwind 標準間距
  - 檢查 padding/margin 一致性
  - 確保使用 `space-y-*` / `gap-*` 等標準間距

- [ ] **圓角統一**: 使用設計系統圓角
  - `rounded-lg` (標準)
  - `rounded-md` (中等)
  - `rounded-sm` (小)

- [ ] **陰影統一**: 使用標準 shadow
  - `shadow-sm` (卡片)
  - `shadow-md` (懸浮)
  - `shadow-lg` (對話框)

#### **功能檢查清單**

- [ ] **無功能倒退**: 所有交互功能正常
- [ ] **數據載入**: API 調用正常
- [ ] **表單驗證**: 驗證邏輯正常
- [ ] **路由導航**: 跳轉功能正常
- [ ] **響應式**: mobile/tablet/desktop 正常

#### **可訪問性檢查清單**

- [ ] **鍵盤導航**: Tab 順序正確
- [ ] **螢幕閱讀器**: aria-label 適當
- [ ] **焦點可見**: focus ring 顯示清晰
- [ ] **對比度**: 文字對比度符合 WCAG AA

---

### 詳細任務清單

#### **Day 1: Dashboard 首頁和 Login 頁面遷移**

**Task 3.1: Dashboard 首頁遷移 - 3 小時**

**文件**: `apps/web/src/app/dashboard/page.tsx`

**遷移重點**:
1. 統計卡片 → 使用新 `Card` 組件
2. 按鈕 → 使用新 `Button` 組件
3. 徽章 → 使用新 `Badge` 組件
4. 色彩 → 使用設計系統變數

**遷移前後對比**:

```tsx
// ===== 遷移前 =====
<div className="bg-white p-6 rounded-lg shadow">
  <h3 className="text-gray-900 font-semibold mb-2">總專案數</h3>
  <p className="text-3xl font-bold text-blue-600">24</p>
  <span className="text-sm text-gray-500">較上月 +5%</span>
</div>

// ===== 遷移後 =====
<Card>
  <CardHeader>
    <CardTitle>總專案數</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold text-primary">24</p>
    <p className="text-sm text-muted-foreground">較上月 +5%</p>
  </CardContent>
</Card>
```

**驗收標準**:
- [ ] ✅ 所有統計卡片使用新 Card 組件
- [ ] ✅ 所有按鈕使用新 Button 組件
- [ ] ✅ 所有色彩使用設計系統變數
- [ ] ✅ 功能無倒退
- [ ] ✅ 響應式正常

---

**Task 3.2: Login 頁面遷移 - 2 小時**

**文件**: `apps/web/src/app/login/page.tsx`

**遷移重點**:
1. 表單容器 → 使用新 `Card` 組件
2. 輸入框 → 使用新 `Input` 組件
3. 標籤 → 使用新 `Label` 組件
4. 按鈕 → 使用新 `Button` 組件

**驗收標準**:
- [ ] ✅ 表單使用新組件
- [ ] ✅ 視覺效果提升
- [ ] ✅ 登入功能正常
- [ ] ✅ 錯誤提示正常

---

**Day 1 驗收標準**:
- [ ] ✅ 2 個核心頁面完成遷移
- [ ] ✅ 視覺一致性達標
- [ ] ✅ 功能完全正常
- [ ] ✅ 響應式正常
- [ ] ✅ 無 console 錯誤

**Git Commit**:
```bash
git add .
git commit -m "feat(migration): 階段 3 Day 1 - Dashboard 和 Login 頁面遷移

- 遷移 Dashboard 首頁使用新設計系統
- 遷移 Login 頁面使用新設計系統
- 所有組件使用 shadcn/ui 風格
- 統一使用設計系統 CSS 變數
- 功能完全正常，無倒退

🎨 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

#### **Day 2-3: 列表頁面遷移**

**Task 3.3: 專案列表頁遷移**
**Task 3.4: Budget Pool 列表頁遷移**
**Task 3.5: Proposal 列表頁遷移**
**Task 3.6: User 列表頁遷移**

（詳細任務清單類似 Day 1 模式）

---

#### **Day 4-5: 詳情頁面遷移**

**Task 3.7: 專案詳情頁遷移**
**Task 3.8: Budget Pool 詳情頁遷移**
**Task 3.9: Proposal 詳情頁遷移**
**Task 3.10: User 詳情頁遷移**

---

#### **Day 6-7: 表單頁面遷移**

**Task 3.11: 所有新增/編輯表單頁遷移**

---

### 階段 3 總體驗收標準

- [ ] ✅ 所有優先級 1-3 頁面完成遷移
- [ ] ✅ 視覺一致性 >95%
- [ ] ✅ 功能完全正常
- [ ] ✅ 響應式支援完整
- [ ] ✅ 無 console 錯誤
- [ ] ✅ 無障礙性符合基本標準
- [ ] ✅ Git commit 已提交

---

## 🚀 階段 4: 進階功能整合

### 階段目標

整合進階 UI 功能，提升用戶體驗和平台專業度。

### 時間預估

**3-4 天**

### 詳細任務清單

#### **Day 1: 主題切換功能 - 全天**

**Task 4.1: ThemeProvider 建立 - 2 小時**

**文件**: `apps/web/src/components/theme-provider.tsx`

```tsx
/**
 * ================================================================
 * ThemeProvider - 主題管理
 * ================================================================
 *
 * 【功能】
 * • 管理亮色/暗色主題切換
 * • 本地存儲持久化
 * • 系統主題自動偵測
 */

"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

**安裝依賴**:
```bash
pnpm add next-themes
```

**更新 `apps/web/src/app/layout.tsx`**:

```tsx
import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**驗收標準**:
- [ ] ✅ ThemeProvider 正常運行
- [ ] ✅ 主題在本地存儲持久化
- [ ] ✅ 系統主題自動偵測

---

**Task 4.2: 主題切換按鈕組件 - 1.5 小時**

**文件**: `apps/web/src/components/theme-toggle.tsx`

```tsx
/**
 * ================================================================
 * ThemeToggle - 主題切換按鈕
 * ================================================================
 */

"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">切換主題</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          亮色
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          暗色
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          系統
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**驗收標準**:
- [ ] ✅ 主題切換按鈕正常
- [ ] ✅ 3 種主題模式可選
- [ ] ✅ 圖標動畫流暢
- [ ] ✅ 整合到 TopBar

---

**Task 4.3: 全站暗色模式測試 - 2 小時**

**測試清單**:
- [ ] ✅ 所有頁面暗色模式正常
- [ ] ✅ 所有組件暗色模式正常
- [ ] ✅ 色彩對比度符合標準
- [ ] ✅ 無視覺問題

---

#### **Day 2: 錯誤邊界和處理 - 全天**

**Task 4.4: 全局 Error Boundary - 2 小時**
**Task 4.5: Error Display 組件整合 - 1.5 小時**
**Task 4.6: Toast 通知系統優化 - 2 小時**

---

#### **Day 3: 載入狀態優化 - 全天**

**Task 4.7: 統一 Skeleton 組件 - 2 小時**
**Task 4.8: Loading 狀態一致性 - 3 小時**

---

#### **Day 4: 表單系統優化 - 全天**

**Task 4.9: React Hook Form 完整整合 - 3 小時**
**Task 4.10: Zod 驗證錯誤 UI 統一 - 2 小時**

---

### 階段 4 總體驗收標準

- [ ] ✅ 主題切換功能完整
- [ ] ✅ 暗色模式無視覺問題
- [ ] ✅ 錯誤處理統一優雅
- [ ] ✅ 載入狀態一致
- [ ] ✅ 表單驗證 UI 統一
- [ ] ✅ 用戶體驗流暢
- [ ] ✅ Git commit 已提交

---

## 🌳 Git 分支策略

### 分支結構

```
main (生產分支)
  └── develop (開發分支)
      └── feature/design-system-migration (遷移主分支)
          ├── phase-1-css-variables (階段 1)
          ├── phase-2-ui-components (階段 2)
          ├── phase-3-page-migration (階段 3)
          └── phase-4-advanced-features (階段 4)
```

### 工作流程

#### **1. 創建遷移分支**

```bash
# 從 develop 創建主遷移分支
git checkout develop
git pull origin develop
git checkout -b feature/design-system-migration
git push -u origin feature/design-system-migration
```

#### **2. 各階段分支管理**

```bash
# 階段 1
git checkout feature/design-system-migration
git checkout -b phase-1-css-variables
# ... 完成階段 1 任務 ...
git add .
git commit -m "feat(design-system): 階段 1 完成 - CSS 變數系統"
git push origin phase-1-css-variables

# 合併回主遷移分支
git checkout feature/design-system-migration
git merge phase-1-css-variables
git push origin feature/design-system-migration

# 階段 2-4 重複相同流程
```

#### **3. POC 分支管理**

```bash
# 從主遷移分支創建 POC 分支
git checkout feature/design-system-migration
git checkout -b feature/design-system-poc

# 完成 POC
git add .
git commit -m "feat(poc): POC 驗證完成 - Dashboard 和 Login 頁面"
git push origin feature/design-system-poc

# 如果 POC 成功，合併回主遷移分支
git checkout feature/design-system-migration
git merge feature/design-system-poc

# 如果 POC 失敗，可直接刪除分支
git branch -D feature/design-system-poc
git push origin --delete feature/design-system-poc
```

#### **4. 最終合併**

```bash
# 所有階段完成後，合併回 develop
git checkout develop
git merge feature/design-system-migration

# 完整測試後，合併到 main
git checkout main
git merge develop
git push origin main
```

### 提交訊息規範

```bash
# 格式
<type>(<scope>): <subject>

<body>

🎨 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>

# 類型
feat     - 新功能
fix      - 修復
refactor - 重構
style    - 樣式調整
docs     - 文檔
test     - 測試
chore    - 雜項

# 範例
feat(design-system): 階段 1 - 建立 CSS 變數系統

- 新增完整的 CSS 變數系統（亮色/暗色主題）
- 更新 Tailwind 配置引用設計系統變數
- 建立 cn() className 合併工具函數

🎨 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## ✅ 驗收標準

### POC 驗收標準

- [ ] ✅ Dashboard 首頁視覺效果提升 >50%
- [ ] ✅ Login 頁面視覺效果提升 >50%
- [ ] ✅ 設計系統基礎運行正常
- [ ] ✅ 暗色模式手動切換成功
- [ ] ✅ 所有功能無倒退
- [ ] ✅ 無 console 錯誤
- [ ] ✅ 用戶評估滿意度 >80%

### 階段 1 驗收標準

- [ ] ✅ CSS 變數系統完整建立（30+ 個變數）
- [ ] ✅ Tailwind 配置引用 CSS 變數
- [ ] ✅ cn() 工具函數可用
- [ ] ✅ 暗色模式手動切換成功
- [ ] ✅ 測試頁面顯示正確
- [ ] ✅ 無編譯錯誤

### 階段 2 驗收標準

- [ ] ✅ 22+ 個 UI 組件完成（含新增和重構）
- [ ] ✅ 所有組件使用設計系統變數
- [ ] ✅ 所有組件支援暗色模式
- [ ] ✅ 組件 API 統一（forwardRef + displayName）
- [ ] ✅ 組件文檔完整
- [ ] ✅ TypeScript 無錯誤

### 階段 3 驗收標準

- [ ] ✅ 核心頁面（P1-P3）100% 遷移完成
- [ ] ✅ 視覺一致性 >95%
- [ ] ✅ 功能完全正常
- [ ] ✅ 響應式支援完整
- [ ] ✅ 無 console 錯誤
- [ ] ✅ 無障礙性符合基本標準

### 階段 4 驗收標準

- [ ] ✅ 主題切換功能完整
- [ ] ✅ 暗色模式無視覺問題
- [ ] ✅ 錯誤處理統一優雅
- [ ] ✅ 載入狀態一致
- [ ] ✅ 表單驗證 UI 統一
- [ ] ✅ 用戶體驗流暢

### 最終驗收標準

- [ ] ✅ 所有階段驗收標準達成
- [ ] ✅ 回歸測試通過（所有功能正常）
- [ ] ✅ 性能測試通過（無性能倒退）
- [ ] ✅ 瀏覽器兼容性測試通過
- [ ] ✅ 無障礙性測試通過（WCAG AA）
- [ ] ✅ 代碼審查通過
- [ ] ✅ 文檔完整
- [ ] ✅ 用戶驗收測試通過

---

## ⚠️ 風險管理

### 技術風險

| 風險 | 嚴重度 | 概率 | 緩解策略 | 回退方案 |
|------|--------|------|----------|----------|
| **CSS 變數衝突** | 🟡 中 | 30% | 使用命名空間，漸進式測試 | 回退到階段 1 之前 |
| **組件 API 不兼容** | 🟡 中 | 25% | 建立 Adapter 層，保持向後兼容 | 使用舊組件過渡期並存 |
| **暗色模式 Bug** | 🟢 低 | 15% | 完整測試所有頁面，色彩對比度檢查 | 暫時禁用暗色模式 |
| **功能倒退** | 🔴 高 | 40% | 每階段完整回歸測試 | 立即回退到上一階段 |
| **性能下降** | 🟢 低 | 10% | 性能監控，Lighthouse 測試 | 優化 CSS，移除不必要樣式 |
| **第三方依賴衝突** | 🟢 低 | 5% | 依賴版本鎖定，提前測試 | 回退依賴版本 |

### 業務風險

| 風險 | 嚴重度 | 概率 | 緩解策略 | 回退方案 |
|------|--------|------|----------|----------|
| **開發時間超出** | 🟡 中 | 50% | 分階段交付，優先核心頁面 | 暫緩低優先級頁面 |
| **用戶體驗暫時下降** | 🟡 中 | 30% | 逐頁遷移，保持功能完整 | 回退到舊版本 |
| **新設計不被接受** | 🟢 低 | 15% | POC 提前驗證，用戶參與評審 | 調整設計或放棄遷移 |
| **團隊學習成本** | 🟢 低 | 20% | 完整文檔，組件示例 | 提供培訓和支援 |

### 回退策略

#### **立即回退 (緊急情況)**

```bash
# 情況: 發現嚴重問題，立即回退到 develop
git checkout develop
git push origin develop --force-with-lease

# 情況: 回退到上一個階段
git checkout feature/design-system-migration
git reset --hard phase-2-ui-components  # 回退到階段 2
git push origin feature/design-system-migration --force-with-lease
```

#### **階段性回退**

```bash
# 保留主遷移分支，只回退特定階段
git checkout feature/design-system-migration
git revert <commit-hash>  # 撤銷特定 commit
git push origin feature/design-system-migration
```

#### **保留分支供參考**

```bash
# 不刪除遷移分支，保留供未來參考
git checkout develop
# 遷移分支仍然存在於 GitHub
# 可隨時回來參考或重新開始
```

---

## 📅 時間表與里程碑

### POC 階段 (1.5 天)

| Day | 任務 | 預估時間 | 狀態 |
|-----|------|---------|------|
| Day 1 | 設計系統建立 | 4-6h | ⏳ Pending |
| Day 2 | 頁面遷移 (2個) | 4-6h | ⏳ Pending |
| Day 2.5 | 評估與決策 | 2-3h | ⏳ Pending |

**里程碑**: ✅ POC 驗證成功 → 決定繼續完整遷移

---

### 完整遷移階段 (16-22 天)

| 階段 | 任務 | 預估時間 | 狀態 |
|------|------|---------|------|
| **階段 1** | 設計系統基礎 | 2-3 天 | ⏳ Pending |
| **階段 2** | UI 組件庫升級 | 4-5 天 | ⏳ Pending |
| **階段 3** | 頁面逐步遷移 | 5-7 天 | ⏳ Pending |
| **階段 4** | 進階功能整合 | 3-4 天 | ⏳ Pending |
| **測試修復** | 回歸測試與修復 | 2-3 天 | ⏳ Pending |

**總計**: 16-22 天 (3-4 週)

---

### 關鍵里程碑

1. **POC 完成** (Day 1.5)
   - [ ] ✅ POC 驗證成功
   - [ ] ✅ 用戶決定繼續遷移

2. **階段 1 完成** (Day 4)
   - [ ] ✅ 設計系統基礎建立
   - [ ] ✅ CSS 變數系統運行正常

3. **階段 2 完成** (Day 9)
   - [ ] ✅ 22+ 個 UI 組件完成
   - [ ] ✅ 組件庫完整可用

4. **階段 3 完成** (Day 16)
   - [ ] ✅ 核心頁面遷移完成
   - [ ] ✅ 視覺一致性達標

5. **階段 4 完成** (Day 20)
   - [ ] ✅ 主題切換功能完成
   - [ ] ✅ 進階功能整合完成

6. **最終驗收** (Day 22)
   - [ ] ✅ 回歸測試通過
   - [ ] ✅ 用戶驗收測試通過
   - [ ] ✅ 合併到 develop 分支
   - [ ] ✅ 準備上線

---

## 📝 附錄

### A. 參考資源

- **Demo 項目**: https://github.com/laitim2001/ai-sales-enablement-webapp
- **shadcn/ui 文檔**: https://ui.shadcn.com/
- **Radix UI 文檔**: https://www.radix-ui.com/
- **Tailwind CSS 文檔**: https://tailwindcss.com/
- **Next.js 文檔**: https://nextjs.org/

### B. 相關文檔

- `DESIGN-SYSTEM-MIGRATION-PLAN.md` (本文件)
- `AI-ASSISTANT-GUIDE.md` (AI 助手指南)
- `PROJECT-INDEX.md` (專案索引)
- `DEVELOPMENT-LOG.md` (開發記錄)

### C. 聯絡與支援

- **技術負責人**: AI 助手
- **項目管理**: 用戶
- **設計審查**: 用戶 + AI 助手
- **測試驗證**: 用戶 + AI 助手

---

**文檔版本**: 1.0
**最後更新**: 2025-10-15
**維護者**: AI 助手

🎨 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
