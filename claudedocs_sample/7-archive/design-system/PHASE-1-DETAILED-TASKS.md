# Phase 1 詳細任務清單 - CSS 變數系統

## 階段概覽

**階段名稱**: Phase 1 - CSS 變數系統建立
**預估時間**: 2-3 天
**目標**: 建立完整的設計系統基礎架構，包含 CSS 變數、主題系統、工具函數
**前置條件**: POC 驗證通過，決策為 GO

---

## 任務總覽

| 任務編號 | 任務名稱 | 預估時間 | 優先級 | 依賴 |
|---------|---------|---------|--------|------|
| 1.1 | 建立 Phase 1 分支 | 5 分鐘 | P0 | - |
| 1.2 | 複製並整合 CSS 變數系統 | 2 小時 | P0 | 1.1 |
| 1.3 | 更新 Tailwind 配置 | 1 小時 | P0 | 1.2 |
| 1.4 | 建立工具函數 (cn) | 30 分鐘 | P0 | 1.1 |
| 1.5 | 安裝必要依賴 | 30 分鐘 | P0 | 1.1 |
| 1.6 | 建立 ThemeProvider 和主題切換組件 | 2 小時 | P1 | 1.2, 1.5 |
| 1.7 | 整合到 Root Layout | 1 小時 | P1 | 1.6 |
| 1.8 | 建立設計 Token 文檔 | 1 小時 | P2 | 1.2 |
| 1.9 | 測試和驗證 | 2 小時 | P0 | 所有 |
| 1.10 | 建立 Phase 1 完成報告 | 1 小時 | P1 | 1.9 |
| 1.11 | Code Review 和合併 | 1 小時 | P0 | 1.10 |

**總計**: 約 12 小時（2 天，每天 6 小時有效工作時間）

---

## Task 1.1: 建立 Phase 1 分支

### 目標
建立乾淨的 Phase 1 開發分支，設置回滾點

### 操作步驟

```bash
# 1. 確認當前在正確的基礎分支
git checkout feature/design-system-migration
git pull origin feature/design-system-migration

# 2. 建立 Phase 1 分支
git checkout -b phase-1/css-variables

# 3. 建立起始點 tag
git tag phase-1-start
git push -u origin phase-1/css-variables
git push origin phase-1-start

# 4. 驗證分支建立成功
git branch --show-current
# 輸出應為: phase-1/css-variables
```

### 驗收標準
- [x] 分支 `phase-1/css-variables` 已建立
- [x] Tag `phase-1-start` 已建立
- [x] 分支已推送到遠端
- [x] 當前工作目錄在 `phase-1/css-variables` 分支

### 預估時間
5 分鐘

---

## Task 1.2: 複製並整合 CSS 變數系統

### 目標
從 demo 項目複製完整的 CSS 變數系統，並整合到當前項目的 globals.css

### 操作步驟

#### Step 1: 備份現有 globals.css

```bash
# 備份當前的 globals.css
cp apps/web/src/app/globals.css apps/web/src/app/globals.css.backup
```

#### Step 2: 讀取 demo 項目的 CSS 變數

從 demo 項目 (`/tmp/demo-project/app/globals.css`) 複製以下內容：

**需要複製的部分:**

1. **Tailwind Directives**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

2. **CSS 變數定義 - Light Mode (`:root`)**
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }
}
```

3. **CSS 變數定義 - Dark Mode (`.dark`)**
```css
@layer base {
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}
```

4. **基礎樣式重置**
```css
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

#### Step 3: 整合到當前項目

**文件路徑**: `apps/web/src/app/globals.css`

**完整文件內容:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ========================================
   CSS Variables - Design System
   ======================================== */

@layer base {
  :root {
    /* Colors - Light Mode */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;

    /* Spacing */
    --radius: 0.5rem;

    /* Charts (可選) */
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    /* Colors - Dark Mode */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;

    /* Charts - Dark Mode */
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

/* ========================================
   Base Styles
   ======================================== */

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}

/* ========================================
   Project-Specific Global Styles
   (保留現有項目的自定義樣式)
   ======================================== */

/* 在此添加項目特定的全局樣式 */
```

#### Step 4: 提交變更

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(phase-1): add CSS variable system with light/dark mode

- Define all semantic color variables (background, foreground, primary, etc.)
- Implement HSL color system for better theme control
- Add light mode variables in :root
- Add dark mode variables in .dark class
- Include chart colors for data visualization
- Add base styles for consistent defaults

Ref: DESIGN-SYSTEM-MIGRATION-PLAN.md Phase 1"
```

### 驗收標準
- [x] `globals.css` 包含完整的 CSS 變數定義
- [x] Light mode 所有顏色變數已定義（14+ 變數）
- [x] Dark mode 所有顏色變數已定義（14+ 變數）
- [x] `--radius` 變數已定義
- [x] 基礎樣式重置已添加
- [x] 代碼已提交到 Git

### 預估時間
2 小時

---

## Task 1.3: 更新 Tailwind 配置

### 目標
更新 Tailwind 配置以整合 CSS 變數，啟用 dark mode，配置語義化顏色

### 操作步驟

#### Step 1: 備份現有配置

```bash
cp apps/web/tailwind.config.ts apps/web/tailwind.config.ts.backup
```

#### Step 2: 更新 Tailwind 配置

**文件路徑**: `apps/web/tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  // 啟用 dark mode (class-based)
  darkMode: ["class"],

  // Content 路徑
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // 整合 CSS 變數到 Tailwind colors
      colors: {
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

      // 整合 border radius 變數
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      // 添加關鍵幀動畫（用於組件）
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },

  plugins: [require("tailwindcss-animate")],
};

export default config;
```

#### Step 3: 驗證配置

```bash
# 檢查 TypeScript 語法
pnpm typecheck --filter=web

# 啟動開發服務器測試
pnpm dev --filter=web
```

#### Step 4: 提交變更

```bash
git add apps/web/tailwind.config.ts
git commit -m "feat(phase-1): integrate CSS variables with Tailwind config

- Enable dark mode with class-based strategy
- Map all CSS variables to Tailwind color utilities
- Configure semantic color names (primary, secondary, destructive, etc.)
- Add border radius variables (lg, md, sm)
- Include animations for Radix UI components
- Configure container defaults

Tailwind classes now available:
- bg-primary, text-primary, bg-primary-foreground
- bg-secondary, bg-destructive, bg-muted, bg-accent
- bg-card, bg-popover, bg-background
- border, border-input, ring-ring
- rounded-lg, rounded-md, rounded-sm

Ref: DESIGN-SYSTEM-MIGRATION-PLAN.md Phase 1"
```

### 驗收標準
- [x] `darkMode: ["class"]` 已配置
- [x] 所有 CSS 變數已映射到 Tailwind colors
- [x] `borderRadius` 變數已配置
- [x] 動畫已添加（accordion-down, accordion-up）
- [x] `tailwindcss-animate` plugin 已引入
- [x] TypeScript 類型檢查通過
- [x] 開發服務器啟動無錯誤
- [x] 代碼已提交到 Git

### 預估時間
1 小時

---

## Task 1.4: 建立工具函數 (cn)

### 目標
建立 `cn()` 工具函數，用於合併 Tailwind 類名，避免樣式衝突

### 操作步驟

#### Step 1: 建立 `lib/utils.ts` 文件

**文件路徑**: `apps/web/src/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 *
 * Combines clsx for conditional classes and tailwind-merge to resolve conflicts
 *
 * @example
 * cn("px-2 py-1", "px-4") // => "py-1 px-4" (px-4 overrides px-2)
 * cn("text-red-500", condition && "text-blue-500") // conditional classes
 * cn({ "bg-primary": isPrimary, "bg-secondary": !isPrimary })
 *
 * @param inputs - Class values to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

#### Step 2: 建立測試文件（可選但推薦）

**文件路徑**: `apps/web/src/lib/utils.test.ts`

```typescript
import { describe, it, expect } from "@jest/globals";
import { cn } from "./utils";

describe("cn utility function", () => {
  it("merges class names correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles conditional classes", () => {
    expect(cn("text-base", true && "font-bold")).toBe("text-base font-bold");
    expect(cn("text-base", false && "font-bold")).toBe("text-base");
  });

  it("handles object syntax", () => {
    expect(
      cn({
        "bg-primary": true,
        "bg-secondary": false,
      })
    ).toBe("bg-primary");
  });

  it("resolves Tailwind class conflicts", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("p-4", "px-2")).toBe("p-4 px-2"); // px-2 doesn't override p-4 completely
  });

  it("handles undefined and null values", () => {
    expect(cn("text-base", undefined, null, "font-bold")).toBe(
      "text-base font-bold"
    );
  });

  it("works with array inputs", () => {
    expect(cn(["text-base", "font-bold"])).toBe("text-base font-bold");
  });
});
```

#### Step 3: 執行測試（如果建立了測試文件）

```bash
pnpm test utils.test.ts --filter=web
```

#### Step 4: 建立使用範例文檔

**文件路徑**: `apps/web/src/lib/README.md`

```markdown
# Utility Functions

## `cn()` - Class Name Merger

Utility function to intelligently merge Tailwind CSS class names.

### Features
- Merges multiple class strings
- Handles conditional classes
- Resolves Tailwind class conflicts (later classes override earlier ones)
- Supports object and array syntax

### Usage

```tsx
import { cn } from "@/lib/utils";

// Basic usage
<div className={cn("px-2 py-1", "px-4")} />
// Result: className="py-1 px-4"

// Conditional classes
<div className={cn("text-base", isActive && "font-bold")} />

// Object syntax
<div className={cn({
  "bg-primary": isPrimary,
  "bg-secondary": !isPrimary
})} />

// Multiple sources
<div className={cn(
  "base-class",
  condition && "conditional-class",
  className, // from props
  { "special": isSpecial }
)} />

// Resolving conflicts
<div className={cn("text-red-500", "text-blue-500")} />
// Result: className="text-blue-500" (blue overrides red)
```

### Why use `cn()`?

**Problem without `cn()`:**
```tsx
// Classes conflict, both applied, unpredictable result
<div className={`px-2 py-1 ${className}`} />
// If className="px-4", result might be "px-2 py-1 px-4" (conflict!)
```

**Solution with `cn()`:**
```tsx
// Conflicts resolved intelligently
<div className={cn("px-2 py-1", className)} />
// If className="px-4", result is "py-1 px-4" (px-4 wins!)
```

### Best Practices

1. **Always use `cn()` when merging classes**
   ```tsx
   // ✅ Good
   <div className={cn("base", className)} />

   // ❌ Bad
   <div className={`base ${className}`} />
   ```

2. **Use for component props**
   ```tsx
   interface ButtonProps {
     className?: string;
   }

   function Button({ className }: ButtonProps) {
     return <button className={cn("btn-base", className)} />;
   }
   ```

3. **Leverage conditional logic**
   ```tsx
   <div className={cn(
     "base",
     isActive && "active",
     isDisabled && "disabled",
     size === "lg" && "large"
   )} />
   ```
```

#### Step 5: 提交變更

```bash
git add apps/web/src/lib/utils.ts
git add apps/web/src/lib/utils.test.ts
git add apps/web/src/lib/README.md
git commit -m "feat(phase-1): add cn utility for class name merging

- Implement cn() function combining clsx and tailwind-merge
- Add comprehensive unit tests
- Add usage documentation and examples
- Enable intelligent Tailwind class conflict resolution

This utility is essential for the component library to properly
merge default styles with user-provided className props.

Usage example:
  cn('px-2 py-1', className) // Properly merges classes
  cn('text-red-500', isError && 'text-blue-500') // Conditional

Ref: DESIGN-SYSTEM-MIGRATION-PLAN.md Phase 1"
```

### 驗收標準
- [x] `lib/utils.ts` 文件已建立
- [x] `cn()` 函數實現正確
- [x] JSDoc 註解完整
- [x] 單元測試已建立（可選）
- [x] 測試通過（如果有）
- [x] 使用文檔已建立
- [x] TypeScript 類型檢查通過
- [x] 代碼已提交到 Git

### 預估時間
30 分鐘

---

## Task 1.5: 安裝必要依賴

### 目標
安裝設計系統所需的所有 npm 依賴

### 操作步驟

#### Step 1: 安裝核心依賴

```bash
# 在項目根目錄執行

# 安裝 class-variance-authority (組件變體管理)
pnpm add class-variance-authority --filter=web

# 安裝 clsx (條件類名)
pnpm add clsx --filter=web

# 安裝 tailwind-merge (類名衝突解決)
pnpm add tailwind-merge --filter=web

# 安裝 next-themes (主題切換)
pnpm add next-themes --filter=web

# 安裝 Radix UI Slot (用於 asChild pattern)
pnpm add @radix-ui/react-slot --filter=web
```

#### Step 2: 安裝開發依賴

```bash
# 安裝 Tailwind 動畫插件
pnpm add -D tailwindcss-animate --filter=web

# 安裝類型定義（如果需要）
pnpm add -D @types/node --filter=web
```

#### Step 3: 驗證安裝

```bash
# 檢查依賴是否正確安裝
pnpm list --filter=web | grep -E "(class-variance-authority|clsx|tailwind-merge|next-themes|tailwindcss-animate)"

# 預期輸出:
# class-variance-authority 0.7.0
# clsx 2.1.0
# tailwind-merge 2.2.0
# next-themes 0.2.1
# tailwindcss-animate 1.0.7
```

#### Step 4: 更新 package.json（自動完成）

**驗證 `apps/web/package.json` 包含:**

```json
{
  "dependencies": {
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "next-themes": "^0.2.1",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "tailwindcss-animate": "^1.0.7"
  }
}
```

#### Step 5: 測試依賴

建立測試文件驗證依賴可正常引入:

**文件路徑**: `apps/web/src/__tests__/dependencies.test.ts`

```typescript
import { describe, it, expect } from "@jest/globals";

describe("Design System Dependencies", () => {
  it("can import clsx", () => {
    const { clsx } = require("clsx");
    expect(typeof clsx).toBe("function");
  });

  it("can import tailwind-merge", () => {
    const { twMerge } = require("tailwind-merge");
    expect(typeof twMerge).toBe("function");
  });

  it("can import class-variance-authority", () => {
    const { cva } = require("class-variance-authority");
    expect(typeof cva).toBe("function");
  });

  it("can import next-themes", () => {
    const { ThemeProvider } = require("next-themes");
    expect(ThemeProvider).toBeDefined();
  });

  it("can import @radix-ui/react-slot", () => {
    const { Slot } = require("@radix-ui/react-slot");
    expect(Slot).toBeDefined();
  });
});
```

```bash
# 執行測試
pnpm test dependencies.test.ts --filter=web
```

#### Step 6: 提交變更

```bash
git add apps/web/package.json
git add pnpm-lock.yaml
git add apps/web/src/__tests__/dependencies.test.ts
git commit -m "chore(phase-1): install design system dependencies

Installed packages:
- class-variance-authority@0.7.0 - Component variant management
- clsx@2.1.0 - Conditional class names
- tailwind-merge@2.2.0 - Tailwind class conflict resolution
- next-themes@0.2.1 - Theme switching functionality
- @radix-ui/react-slot@1.0.2 - asChild pattern support

Dev dependencies:
- tailwindcss-animate@1.0.7 - Tailwind animation utilities

All dependencies verified and tested.

Ref: DESIGN-SYSTEM-MIGRATION-PLAN.md Phase 1"
```

### 驗收標準
- [x] 所有依賴成功安裝
- [x] `package.json` 已更新
- [x] `pnpm-lock.yaml` 已更新
- [x] 依賴測試通過
- [x] TypeScript 類型檢查通過
- [x] `pnpm dev` 啟動無錯誤
- [x] 代碼已提交到 Git

### 預估時間
30 分鐘

---

## Task 1.6: 建立 ThemeProvider 和主題切換組件

### 目標
建立主題上下文 Provider 和主題切換 UI 組件

### 操作步驟

#### Step 1: 建立 ThemeProvider

**文件路徑**: `apps/web/src/components/theme-provider.tsx`

```typescript
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

/**
 * Theme Provider Component
 *
 * Wraps the application to enable theme switching functionality.
 * Uses next-themes for seamless SSR support and no flash on page load.
 *
 * @example
 * <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
 *   <App />
 * </ThemeProvider>
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

#### Step 2: 建立主題切換按鈕組件

**文件路徑**: `apps/web/src/components/theme-toggle.tsx`

```typescript
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

/**
 * Theme Toggle Component
 *
 * Provides a dropdown menu to switch between light, dark, and system themes.
 * Shows appropriate icon based on current theme.
 * Handles hydration mismatch by only rendering after mount.
 *
 * @example
 * <ThemeToggle />
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">切換主題</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>淺色</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>深色</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <span className="mr-2 h-4 w-4">💻</span>
          <span>系統</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Step 3: 建立簡化版主題切換按鈕（無 Dropdown）

**文件路徑**: `apps/web/src/components/theme-toggle-simple.tsx`

```typescript
"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Simple Theme Toggle Component
 *
 * A simple button that toggles between light and dark themes.
 * No dropdown menu, just a single click toggle.
 *
 * @example
 * <ThemeToggleSimple />
 */
export function ThemeToggleSimple() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">切換主題</span>
    </Button>
  );
}
```

#### Step 4: 建立主題 Hook（可選，但推薦）

**文件路徑**: `apps/web/src/hooks/use-theme.ts`

```typescript
"use client";

import { useTheme as useNextTheme } from "next-themes";

/**
 * Custom hook to access theme functionality
 *
 * Re-exports next-themes useTheme with additional utilities
 *
 * @returns Theme context with theme state and setters
 */
export function useTheme() {
  const context = useNextTheme();

  return {
    ...context,
    isDark: context.theme === "dark",
    isLight: context.theme === "light",
    isSystem: context.theme === "system",
  };
}
```

#### Step 5: 提交變更

```bash
git add apps/web/src/components/theme-provider.tsx
git add apps/web/src/components/theme-toggle.tsx
git add apps/web/src/components/theme-toggle-simple.tsx
git add apps/web/src/hooks/use-theme.ts
git commit -m "feat(phase-1): add ThemeProvider and theme toggle components

Created components:
- ThemeProvider: Wraps app for theme context
- ThemeToggle: Dropdown menu with light/dark/system options
- ThemeToggleSimple: Simple button toggle between light/dark
- useTheme hook: Custom hook with additional utilities

Features:
- No flash on page load (SSR-safe)
- Hydration mismatch prevention
- Smooth theme transitions
- System theme detection
- Accessible with sr-only labels

Note: Button and DropdownMenu components will be created in Phase 2.
For now, these components are prepared but won't be used until those
dependencies are available.

Ref: DESIGN-SYSTEM-MIGRATION-PLAN.md Phase 1"
```

### 驗收標準
- [x] `theme-provider.tsx` 已建立
- [x] `theme-toggle.tsx` 已建立（dropdown 版本）
- [x] `theme-toggle-simple.tsx` 已建立（簡化版本）
- [x] `use-theme.ts` hook 已建立
- [x] JSDoc 註解完整
- [x] TypeScript 類型檢查通過
- [x] "use client" directive 已添加
- [x] 無 hydration mismatch（使用 mounted state）
- [x] 代碼已提交到 Git

### 預估時間
2 小時

---

## Task 1.7: 整合到 Root Layout

### 目標
將 ThemeProvider 整合到應用的 Root Layout，啟用全局主題功能

### 操作步驟

#### Step 1: 讀取現有 Root Layout

```bash
cat apps/web/src/app/layout.tsx
```

#### Step 2: 更新 Root Layout

**文件路徑**: `apps/web/src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IT Project Process Management Platform",
  description: "Centralized IT project workflow management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={inter.className}>
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

**重要配置說明:**

- `suppressHydrationWarning`: 防止 next-themes 的 hydration 警告
- `attribute="class"`: 使用 class-based dark mode（與 Tailwind 配置一致）
- `defaultTheme="system"`: 默認使用系統主題
- `enableSystem`: 允許系統主題檢測
- `disableTransitionOnChange`: 防止主題切換時的閃爍過渡

#### Step 3: 測試整合

```bash
# 啟動開發服務器
pnpm dev --filter=web

# 訪問應用
# http://localhost:3000

# 檢查控制台是否有錯誤
# 檢查 <html> 標籤是否有 class="dark" 或 class="light"
```

**手動測試清單:**
- [ ] 頁面加載無錯誤
- [ ] 無 hydration mismatch 警告
- [ ] `<html>` 標籤根據系統主題自動添加 `dark` 或 `light` class
- [ ] 背景顏色根據主題變化（白色 ↔ 深色）
- [ ] 文字顏色根據主題變化（深色 ↔ 淺色）

#### Step 4: 建立測試頁面（可選，用於驗證）

**文件路徑**: `apps/web/src/app/theme-test/page.tsx`

```typescript
"use client";

import { useTheme } from "next-themes";

export default function ThemeTestPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-4">主題測試頁面</h1>

      <div className="space-y-4">
        <p className="text-muted-foreground">當前主題: {theme}</p>

        <div className="flex gap-2">
          <button
            onClick={() => setTheme("light")}
            className="bg-primary text-primary-foreground px-4 py-2 rounded"
          >
            淺色主題
          </button>
          <button
            onClick={() => setTheme("dark")}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded"
          >
            深色主題
          </button>
          <button
            onClick={() => setTheme("system")}
            className="bg-accent text-accent-foreground px-4 py-2 rounded"
          >
            系統主題
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="bg-card p-4 rounded-lg border">
            <h2 className="text-card-foreground font-semibold">Card</h2>
            <p className="text-muted-foreground">Card content</p>
          </div>
          <div className="bg-popover p-4 rounded-lg border">
            <h2 className="text-popover-foreground font-semibold">Popover</h2>
            <p className="text-muted-foreground">Popover content</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded">
            Primary
          </div>
          <div className="bg-secondary text-secondary-foreground px-3 py-1 rounded">
            Secondary
          </div>
          <div className="bg-destructive text-destructive-foreground px-3 py-1 rounded">
            Destructive
          </div>
          <div className="bg-muted text-muted-foreground px-3 py-1 rounded">
            Muted
          </div>
          <div className="bg-accent text-accent-foreground px-3 py-1 rounded">
            Accent
          </div>
        </div>
      </div>
    </div>
  );
}
```

訪問 `http://localhost:3000/theme-test` 測試主題切換。

#### Step 5: 提交變更

```bash
git add apps/web/src/app/layout.tsx
git add apps/web/src/app/theme-test/page.tsx
git commit -m "feat(phase-1): integrate ThemeProvider into Root Layout

Changes:
- Added ThemeProvider wrapper to Root Layout
- Configured class-based dark mode (attribute='class')
- Set default theme to 'system' with auto-detection
- Added suppressHydrationWarning to prevent next-themes warnings
- Disabled transitions on theme change for smoother UX

Configuration:
- defaultTheme: 'system' (respects user OS preference)
- enableSystem: true (allows system theme detection)
- disableTransitionOnChange: true (prevents flash)

Created theme test page at /theme-test for manual verification.

Theme switching is now functional across the entire application.
All CSS variables will automatically update based on active theme.

Ref: DESIGN-SYSTEM-MIGRATION-PLAN.md Phase 1"
```

### 驗收標準
- [x] ThemeProvider 已整合到 `layout.tsx`
- [x] `suppressHydrationWarning` 已添加到 `<html>`
- [x] 配置正確（attribute="class", defaultTheme="system", enableSystem）
- [x] 開發服務器啟動無錯誤
- [x] 無 console 警告（hydration mismatch）
- [x] 主題切換功能正常（手動測試）
- [x] CSS 變數根據主題正確更新
- [x] 測試頁面已建立（可選）
- [x] 代碼已提交到 Git

### 預估時間
1 小時

---

## Task 1.8: 建立設計 Token 文檔

### 目標
建立設計 Token 文檔，記錄所有 CSS 變數的用途和使用方式

### 操作步驟

#### Step 1: 建立設計 Token 文檔

**文件路徑**: `apps/web/src/styles/DESIGN-TOKENS.md`

```markdown
# Design Tokens - CSS Variables

完整的設計 Token 系統文檔，記錄所有 CSS 變數及其用途。

## 顏色系統

### 基礎顏色

#### Background & Foreground
```css
--background: 0 0% 100%;           /* 頁面背景色 */
--foreground: 222.2 84% 4.9%;      /* 主要文字顏色 */
```

**使用方式:**
```tsx
<div className="bg-background text-foreground">
  頁面內容
</div>
```

#### Card
```css
--card: 0 0% 100%;                 /* 卡片背景色 */
--card-foreground: 222.2 84% 4.9%; /* 卡片文字顏色 */
```

**使用方式:**
```tsx
<div className="bg-card text-card-foreground border rounded-lg p-4">
  卡片內容
</div>
```

#### Popover
```css
--popover: 0 0% 100%;              /* 彈出層背景色 */
--popover-foreground: 222.2 84% 4.9%; /* 彈出層文字顏色 */
```

**使用方式:**
```tsx
<div className="bg-popover text-popover-foreground">
  彈出層內容
</div>
```

### 語義化顏色

#### Primary (主要)
```css
--primary: 221.2 83.2% 53.3%;      /* 主要品牌色 */
--primary-foreground: 210 40% 98%; /* 主要色上的文字顏色 */
```

**用途**: 主要操作、重要按鈕、關鍵元素
**使用方式:**
```tsx
<button className="bg-primary text-primary-foreground">
  主要按鈕
</button>
```

#### Secondary (次要)
```css
--secondary: 210 40% 96.1%;        /* 次要顏色 */
--secondary-foreground: 222.2 47.4% 11.2%; /* 次要色上的文字顏色 */
```

**用途**: 次要操作、輔助按鈕
**使用方式:**
```tsx
<button className="bg-secondary text-secondary-foreground">
  次要按鈕
</button>
```

#### Destructive (破壞性)
```css
--destructive: 0 84.2% 60.2%;      /* 危險/錯誤顏色 */
--destructive-foreground: 210 40% 98%; /* 危險色上的文字顏色 */
```

**用途**: 刪除按鈕、錯誤訊息、警告操作
**使用方式:**
```tsx
<button className="bg-destructive text-destructive-foreground">
  刪除
</button>
```

#### Muted (柔和)
```css
--muted: 210 40% 96.1%;            /* 柔和背景色 */
--muted-foreground: 215.4 16.3% 46.9%; /* 柔和文字顏色 */
```

**用途**: 輔助文字、禁用狀態、次要信息
**使用方式:**
```tsx
<p className="text-muted-foreground">
  輔助說明文字
</p>
<div className="bg-muted">
  柔和背景區域
</div>
```

#### Accent (強調)
```css
--accent: 210 40% 96.1%;           /* 強調背景色 */
--accent-foreground: 222.2 47.4% 11.2%; /* 強調文字顏色 */
```

**用途**: Hover 狀態、選中狀態、強調區域
**使用方式:**
```tsx
<div className="hover:bg-accent hover:text-accent-foreground">
  可 hover 的元素
</div>
```

### 邊框和輸入框

#### Border
```css
--border: 214.3 31.8% 91.4%;       /* 邊框顏色 */
```

**使用方式:**
```tsx
<div className="border">
  有邊框的元素
</div>
```

#### Input
```css
--input: 214.3 31.8% 91.4%;        /* 輸入框邊框顏色 */
```

**使用方式:**
```tsx
<input className="border-input" />
```

#### Ring (Focus Ring)
```css
--ring: 221.2 83.2% 53.3%;         /* Focus ring 顏色 */
```

**使用方式:**
```tsx
<button className="focus-visible:ring-2 focus-visible:ring-ring">
  可聚焦的按鈕
</button>
```

### 間距

#### Border Radius
```css
--radius: 0.5rem;                  /* 基礎圓角 (8px) */
```

**使用方式:**
```tsx
<div className="rounded-lg">       {/* 使用 var(--radius) */}
<div className="rounded-md">       {/* var(--radius) - 2px */}
<div className="rounded-sm">       {/* var(--radius) - 4px */}
```

### 圖表顏色（可選）

```css
--chart-1: 12 76% 61%;
--chart-2: 173 58% 39%;
--chart-3: 197 37% 24%;
--chart-4: 43 74% 66%;
--chart-5: 27 87% 67%;
```

**用途**: 數據可視化、圖表配色

---

## Dark Mode 對照表

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `--background` | `0 0% 100%` (白色) | `222.2 84% 4.9%` (深灰) |
| `--foreground` | `222.2 84% 4.9%` (深灰) | `210 40% 98%` (淺灰) |
| `--primary` | `221.2 83.2% 53.3%` (藍色) | `217.2 91.2% 59.8%` (亮藍) |
| `--destructive` | `0 84.2% 60.2%` (紅色) | `0 62.8% 30.6%` (暗紅) |
| `--border` | `214.3 31.8% 91.4%` (淺灰) | `217.2 32.6% 17.5%` (深灰) |

完整對照見 `globals.css` 中的 `:root` 和 `.dark` 定義。

---

## 使用範例

### 按鈕變體

```tsx
// Primary button
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Primary
</button>

// Secondary button
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
  Secondary
</button>

// Destructive button
<button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
  Delete
</button>

// Ghost button
<button className="hover:bg-accent hover:text-accent-foreground">
  Ghost
</button>

// Outline button
<button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground">
  Outline
</button>
```

### 卡片組件

```tsx
<div className="bg-card text-card-foreground rounded-lg border p-6">
  <h3 className="text-2xl font-semibold">卡片標題</h3>
  <p className="text-muted-foreground">卡片說明文字</p>
</div>
```

### 輸入框

```tsx
<input
  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  type="text"
/>
```

### 文字層次

```tsx
<h1 className="text-foreground">主標題</h1>
<p className="text-foreground">正文內容</p>
<p className="text-muted-foreground">輔助說明</p>
```

---

## 最佳實踐

### ✅ DO (應該做)

1. **使用語義化 token**
   ```tsx
   // ✅ Good - 語義化
   <button className="bg-primary">Primary</button>

   // ❌ Bad - 硬編碼顏色
   <button className="bg-blue-500">Primary</button>
   ```

2. **配對使用 background 和 foreground**
   ```tsx
   // ✅ Good - 配對使用確保對比度
   <div className="bg-primary text-primary-foreground">Content</div>

   // ❌ Bad - 可能對比度不足
   <div className="bg-primary text-white">Content</div>
   ```

3. **使用 Tailwind 的透明度修飾符**
   ```tsx
   // ✅ Good - 使用 /90 語法
   <button className="bg-primary hover:bg-primary/90">Hover</button>

   // ❌ Bad - 硬編碼透明度
   <button className="bg-primary hover:bg-blue-600">Hover</button>
   ```

### ❌ DON'T (不應該做)

1. **不要跳過設計 token 直接用硬編碼顏色**
2. **不要混用設計系統和硬編碼樣式**
3. **不要自行定義新的顏色變數（應提出需求討論）**

---

## 擴展設計 Token

如果需要添加新的設計 token:

1. **在 `globals.css` 中添加 CSS 變數**
   ```css
   :root {
     --success: 142 76% 36%;
     --success-foreground: 355.7 100% 97.3%;
   }

   .dark {
     --success: 142 71% 45%;
     --success-foreground: 144 61% 8%;
   }
   ```

2. **在 `tailwind.config.ts` 中映射**
   ```typescript
   theme: {
     extend: {
       colors: {
         success: {
           DEFAULT: "hsl(var(--success))",
           foreground: "hsl(var(--success-foreground))",
         },
       },
     },
   },
   ```

3. **在此文檔中記錄**
   ```markdown
   #### Success (成功)
   用途: 成功訊息、完成狀態
   使用: `bg-success text-success-foreground`
   ```

---

## 參考資源

- Tailwind CSS 文檔: https://tailwindcss.com
- HSL 顏色選擇器: https://hslpicker.com
- 可訪問性對比度檢查: https://webaim.org/resources/contrastchecker/
```

#### Step 2: 提交變更

```bash
git add apps/web/src/styles/DESIGN-TOKENS.md
git commit -m "docs(phase-1): add comprehensive design tokens documentation

Created detailed documentation for all CSS variables:
- Background, foreground, card, popover colors
- Semantic colors (primary, secondary, destructive, muted, accent)
- Border, input, ring colors
- Border radius variables
- Chart colors

Documentation includes:
- Variable definitions with HSL values
- Usage examples for each token
- Light/dark mode comparison table
- Best practices and anti-patterns
- Extension guidelines

This serves as the single source of truth for design tokens
and helps maintain consistency across the application.

Ref: DESIGN-SYSTEM-MIGRATION-PLAN.md Phase 1"
```

### 驗收標準
- [x] `DESIGN-TOKENS.md` 文檔已建立
- [x] 所有 CSS 變數已記錄
- [x] 每個 token 有清晰的用途說明
- [x] 包含使用範例
- [x] 包含 light/dark mode 對照表
- [x] 包含最佳實踐指引
- [x] 包含擴展指引
- [x] Markdown 格式正確
- [x] 代碼已提交到 Git

### 預估時間
1 小時

---

## Task 1.9: 測試和驗證

### 目標
全面測試 Phase 1 的所有功能，確保一切正常運行

### 測試清單

#### 1. TypeScript 類型檢查

```bash
pnpm typecheck --filter=web
```

**驗收標準:**
- [x] 無 TypeScript 錯誤
- [x] 無類型警告

#### 2. ESLint 檢查

```bash
pnpm lint --filter=web
```

**驗收標準:**
- [x] 無 ESLint 錯誤
- [x] 無 ESLint 警告（或僅有可忽略的警告）

#### 3. 構建測試

```bash
pnpm build --filter=web
```

**驗收標準:**
- [x] 構建成功無錯誤
- [x] 無構建警告
- [x] CSS 文件成功生成
- [x] JavaScript bundle 成功生成

#### 4. 開發服務器測試

```bash
pnpm dev --filter=web
```

**手動檢查清單:**
- [x] 服務器啟動成功
- [x] 無 console 錯誤
- [x] 無 hydration mismatch 警告
- [x] Hot reload 正常運作

#### 5. CSS 變數測試

**測試步驟:**
1. 訪問 `http://localhost:3000/theme-test`
2. 檢查頁面背景顏色（應為白色或深色，取決於系統主題）
3. 點擊 "淺色主題" 按鈕
4. 點擊 "深色主題" 按鈕
5. 點擊 "系統主題" 按鈕

**驗收標準:**
- [x] CSS 變數正確加載
- [x] 主題切換流暢無閃爍
- [x] 所有顏色 token 正確顯示
- [x] Light mode 顏色正確
- [x] Dark mode 顏色正確
- [x] System mode 跟隨系統設置

#### 6. 瀏覽器開發者工具檢查

**檢查清單:**
- [x] `<html>` 標籤有 `class="light"` 或 `class="dark"`
- [x] CSS 變數已定義（Elements > Styles > :root）
- [x] 無 console 錯誤
- [x] 無 console 警告
- [x] 無網絡請求錯誤

#### 7. 響應式測試

**測試斷點:**
- [x] Mobile (375px)
- [x] Tablet (768px)
- [x] Desktop (1920px)

**驗收標準:**
- [x] 所有斷點佈局正常
- [x] 文字可讀
- [x] 無橫向滾動條

#### 8. 可訪問性測試

**手動測試:**
- [x] Tab 鍵可聚焦所有互動元素
- [x] Focus ring 清晰可見
- [x] Screen reader 可讀（使用 NVDA/JAWS/VoiceOver）
- [x] 顏色對比度符合 WCAG AA 標準

**自動化測試 (可選):**
```bash
# 安裝 axe-core (如果尚未安裝)
pnpm add -D @axe-core/cli --filter=web

# 運行可訪問性測試
pnpm axe http://localhost:3000 --filter=web
```

#### 9. 性能測試

**Lighthouse 測試:**
1. 打開 Chrome DevTools
2. 切換到 Lighthouse 面板
3. 選擇 "Performance" + "Accessibility"
4. 點擊 "Generate report"

**驗收標準:**
- [x] Performance Score ≥ 90
- [x] Accessibility Score ≥ 90
- [x] Best Practices Score ≥ 90

#### 10. 跨瀏覽器測試

**測試瀏覽器:**
- [x] Chrome (最新版)
- [x] Firefox (最新版)
- [x] Safari (最新版，如果有 Mac）
- [x] Edge (最新版)

**驗收標準:**
- [x] 所有瀏覽器功能正常
- [x] 樣式一致
- [x] 主題切換正常

### 測試結果記錄

建立測試結果文件:

**文件路徑**: `claudedocs/PHASE-1-TEST-RESULTS.md`

```markdown
# Phase 1 測試結果

測試日期: [填入日期]
測試人員: [填入姓名]

## 自動化測試

### TypeScript 類型檢查
- 狀態: ✅ PASS
- 錯誤數: 0
- 警告數: 0

### ESLint 檢查
- 狀態: ✅ PASS
- 錯誤數: 0
- 警告數: 0

### 構建測試
- 狀態: ✅ PASS
- 構建時間: [X]秒
- Bundle 大小: [X]KB

## 手動測試

### CSS 變數
- ✅ Light mode 顏色正確
- ✅ Dark mode 顏色正確
- ✅ System mode 正常
- ✅ 主題切換流暢

### 響應式
- ✅ Mobile (375px) 正常
- ✅ Tablet (768px) 正常
- ✅ Desktop (1920px) 正常

### 可訪問性
- ✅ Tab 鍵導航正常
- ✅ Focus ring 清晰
- ✅ Screen reader 可讀
- ✅ 顏色對比度符合標準

### Lighthouse 評分
- Performance: [分數]/100
- Accessibility: [分數]/100
- Best Practices: [分數]/100

### 跨瀏覽器
- ✅ Chrome 正常
- ✅ Firefox 正常
- ✅ Safari 正常
- ✅ Edge 正常

## 發現的問題

[列出任何發現的問題]

## 總結

Phase 1 測試 ✅ 通過 / ❌ 未通過

[簡述測試總結]
```

### 驗收標準
- [x] 所有自動化測試通過
- [x] 所有手動測試通過
- [x] 測試結果已記錄
- [x] 發現的問題已記錄並修復

### 預估時間
2 小時

---

## Task 1.10: 建立 Phase 1 完成報告

### 目標
撰寫詳細的 Phase 1 完成報告，記錄所有成果和發現

### 操作步驟

**文件路徑**: `claudedocs/PHASE-1-COMPLETION-REPORT.md`

```markdown
# Phase 1 完成報告 - CSS 變數系統

## 執行概要

**階段名稱**: Phase 1 - CSS 變數系統建立
**執行時間**: [實際開始日期] - [實際結束日期]
**預估時間**: 2-3 天
**實際時間**: [實際天數] 天
**狀態**: ✅ 完成

---

## 完成的任務

### 1. Git 分支管理
- ✅ 建立 `phase-1/css-variables` 分支
- ✅ 建立 `phase-1-start` tag
- ✅ [X] 次提交

### 2. CSS 變數系統
- ✅ 完整的 CSS 變數定義（light + dark mode）
- ✅ 14+ 語義化顏色變數
- ✅ Border radius 變數
- ✅ Chart 顏色變數（可選）

### 3. Tailwind 整合
- ✅ Dark mode 配置（class-based）
- ✅ CSS 變數映射到 Tailwind colors
- ✅ Border radius 配置
- ✅ 動畫配置

### 4. 工具函數
- ✅ `cn()` 函數實現
- ✅ 單元測試
- ✅ 使用文檔

### 5. 依賴安裝
- ✅ class-variance-authority
- ✅ clsx
- ✅ tailwind-merge
- ✅ next-themes
- ✅ @radix-ui/react-slot
- ✅ tailwindcss-animate

### 6. 主題系統
- ✅ ThemeProvider 組件
- ✅ ThemeToggle 組件（dropdown 版本）
- ✅ ThemeToggleSimple 組件（簡化版本）
- ✅ useTheme hook
- ✅ Root Layout 整合

### 7. 文檔
- ✅ 設計 Token 文檔
- ✅ 工具函數使用文檔
- ✅ 測試結果文檔

### 8. 測試
- ✅ TypeScript 類型檢查通過
- ✅ ESLint 檢查通過
- ✅ 構建成功
- ✅ 手動測試通過
- ✅ 跨瀏覽器測試通過

---

## 交付成果

### 代碼文件

| 文件路徑 | 用途 | 行數 |
|---------|------|------|
| `apps/web/src/app/globals.css` | CSS 變數定義 | ~[X] |
| `apps/web/tailwind.config.ts` | Tailwind 配置 | ~[X] |
| `apps/web/src/lib/utils.ts` | 工具函數 | ~[X] |
| `apps/web/src/components/theme-provider.tsx` | 主題 Provider | ~[X] |
| `apps/web/src/components/theme-toggle.tsx` | 主題切換組件 | ~[X] |
| `apps/web/src/components/theme-toggle-simple.tsx` | 簡化主題切換 | ~[X] |
| `apps/web/src/hooks/use-theme.ts` | 主題 Hook | ~[X] |
| `apps/web/src/app/layout.tsx` | Root Layout（更新）| ~[X] |

### 文檔文件

| 文件路徑 | 用途 |
|---------|------|
| `apps/web/src/styles/DESIGN-TOKENS.md` | 設計 Token 文檔 |
| `apps/web/src/lib/README.md` | 工具函數文檔 |
| `claudedocs/PHASE-1-TEST-RESULTS.md` | 測試結果 |
| `claudedocs/PHASE-1-COMPLETION-REPORT.md` | 本報告 |

---

## 關鍵指標

### 代碼質量
- TypeScript 類型覆蓋率: 100%
- ESLint 錯誤: 0
- ESLint 警告: [X]
- 單元測試覆蓋率: [X]%

### 性能
- Lighthouse Performance: [X]/100
- Lighthouse Accessibility: [X]/100
- Lighthouse Best Practices: [X]/100
- Bundle size 增加: +[X]KB ([X]%)

### 功能完整性
- CSS 變數定義: 100%
- Tailwind 整合: 100%
- 主題切換: 100%
- 文檔完整性: 100%

---

## 遇到的挑戰和解決方案

### 挑戰 1: [描述挑戰]
**問題**: [詳細描述]
**解決方案**: [如何解決]
**結果**: [解決結果]

### 挑戰 2: [描述挑戰]
**問題**: [詳細描述]
**解決方案**: [如何解決]
**結果**: [解決結果]

---

## 學到的經驗

1. **[經驗 1]**: [描述]
2. **[經驗 2]**: [描述]
3. **[經驗 3]**: [描述]

---

## 遺留問題和待辦事項

### 遺留問題
- [ ] [問題 1]（優先級: 高/中/低）
- [ ] [問題 2]（優先級: 高/中/低）

### 後續優化
- [ ] [優化項 1]
- [ ] [優化項 2]

---

## 對下一階段的建議

1. **Phase 2 準備**: [建議]
2. **注意事項**: [注意事項]
3. **優先順序調整**: [如有需要]

---

## 驗收標準檢查

- [x] 所有計劃任務完成
- [x] 所有測試通過
- [x] 代碼已 review
- [x] 文檔完整
- [x] 無阻塞性問題
- [x] 符合性能要求

**Phase 1 驗收結果**: ✅ 通過

---

## 附錄

### Git 提交歷史

```bash
git log phase-1-start..HEAD --oneline
```

[貼上提交歷史]

### 變更統計

```bash
git diff phase-1-start..HEAD --stat
```

[貼上變更統計]

---

**報告撰寫人**: [姓名]
**報告日期**: [日期]
**審核人**: [審核人姓名]（如適用）
```

### 驗收標準
- [x] 完成報告已撰寫
- [x] 所有章節完整
- [x] 關鍵指標已記錄
- [x] 遇到的問題已記錄
- [x] 學到的經驗已總結
- [x] 驗收標準已檢查
- [x] 報告已提交到 Git

### 預估時間
1 小時

---

## Task 1.11: Code Review 和合併

### 目標
進行代碼審查並將 Phase 1 合併到主遷移分支

### 操作步驟

#### Step 1: 自我審查

**審查清單:**
- [ ] 所有代碼遵循項目編碼規範
- [ ] 無重複代碼
- [ ] 命名清晰且有意義
- [ ] 複雜邏輯有註解
- [ ] TypeScript 類型完整
- [ ] 無 `any` 類型（除非必要）
- [ ] 所有組件有 JSDoc
- [ ] 所有文件有正確的 copyright header（如適用）

#### Step 2: 建立 Pull Request

```bash
# 確保所有變更已提交
git status

# 推送最新代碼
git push origin phase-1/css-variables
```

**在 GitHub 建立 PR:**
- 標題: `[Phase 1] CSS Variables System Implementation`
- 描述: 使用 PR 模板（見 GIT-WORKFLOW-AND-BRANCHING-STRATEGY.md）
- 指定審查者
- 添加標籤: `phase-1`, `design-system`, `css-variables`

#### Step 3: Code Review

**審查者檢查清單:**
- [ ] 代碼品質符合標準
- [ ] TypeScript 類型正確
- [ ] 樣式符合設計規範
- [ ] 測試充分
- [ ] 文檔完整
- [ ] 無安全問題
- [ ] 性能符合要求

#### Step 4: 處理審查意見

根據審查者的回饋進行修改:

```bash
# 修改代碼
# ...

# 提交修改
git add .
git commit -m "refactor(phase-1): address code review feedback

- [修改項 1]
- [修改項 2]

Reviewer: @[審查者]"

# 推送更新
git push origin phase-1/css-variables
```

#### Step 5: 合併到主分支

**PR 批准後:**

```bash
# 切換到主遷移分支
git checkout feature/design-system-migration
git pull origin feature/design-system-migration

# 合併 Phase 1 (使用 squash merge)
git merge --squash phase-1/css-variables

# 提交合併
git commit -m "feat(phase-1): complete CSS variables system ✅

Phase 1 deliverables:
- ✅ CSS variable system (light + dark mode)
- ✅ Tailwind config integration
- ✅ ThemeProvider setup
- ✅ Theme toggle components
- ✅ cn() utility function
- ✅ Complete documentation

Acceptance criteria met:
- All CSS variables working correctly
- Theme switching smooth with no flicker
- TypeScript type checking passed
- All tests passed
- Performance benchmarks met
- Cross-browser compatibility verified
- Accessibility standards met

Files changed: [X]
Lines added: +[X]
Lines removed: -[X]

Reviewed-by: @[審查者]
Ref: PHASE-1-COMPLETION-REPORT.md"

# 建立完成 tag
git tag phase-1-completed
git push origin feature/design-system-migration
git push origin phase-1-completed
```

#### Step 6: 清理（可選）

```bash
# 刪除本地 phase 分支
git branch -d phase-1/css-variables

# 刪除遠端 phase 分支（可選，也可保留作為參考）
# git push origin --delete phase-1/css-variables
```

### 驗收標準
- [x] PR 已建立
- [x] Code review 完成
- [x] 所有審查意見已處理
- [x] PR 已批准
- [x] 代碼已合併到 `feature/design-system-migration`
- [x] `phase-1-completed` tag 已建立
- [x] 分支清理完成（如適用）

### 預估時間
1 小時

---

## Phase 1 總結

### 完成標準

所有任務完成並通過驗收：

- ✅ Task 1.1: 建立 Phase 1 分支
- ✅ Task 1.2: 複製並整合 CSS 變數系統
- ✅ Task 1.3: 更新 Tailwind 配置
- ✅ Task 1.4: 建立工具函數 (cn)
- ✅ Task 1.5: 安裝必要依賴
- ✅ Task 1.6: 建立 ThemeProvider 和主題切換組件
- ✅ Task 1.7: 整合到 Root Layout
- ✅ Task 1.8: 建立設計 Token 文檔
- ✅ Task 1.9: 測試和驗證
- ✅ Task 1.10: 建立 Phase 1 完成報告
- ✅ Task 1.11: Code Review 和合併

### 下一步

**Phase 2: UI 組件庫** 開發準備

建議在開始 Phase 2 前:
1. 休息一天，回顧 Phase 1 的經驗
2. 閱讀 Phase 2 詳細任務清單
3. 準備 Phase 2 所需的組件設計稿（如適用）
4. 與團隊同步 Phase 1 的完成狀況

---

**Phase 1 完成！** 🎉
