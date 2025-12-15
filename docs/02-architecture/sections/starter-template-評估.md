# Starter Template 評估

## 主要技術領域

全端 Web 應用 + AI 服務整合，基於 PRD 已定義的技術棧。

## 評估的選項

| 選項 | 評估結果 | 原因 |
|------|----------|------|
| create-next-app + shadcn/ui | ✅ 選定 | 最靈活、與 Azure AD 和 Python 後端相容 |
| create-t3-app | ❌ 不適合 | tRPC 與 Python 重複、NextAuth 整合複雜 |
| Next.js SaaS Starter | ❌ 不適合 | 功能過多、需刪除大量代碼 |

## 選定方案：create-next-app + shadcn/ui init

**選擇理由：**
- 靈活性：可完全自定義 Azure AD 整合
- 簡潔性：不引入不需要的功能
- 官方支持：Next.js 和 shadcn/ui 推薦方式
- 與 Python 後端相容：API Routes 作為 BFF 層

**初始化命令：**

```bash
npx create-next-app@latest ai-document-extraction --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn@latest init
npx shadcn@latest add button card table dialog toast form input label badge tabs
```

## Starter 提供的架構決策

| 類別 | 決策 |
|------|------|
| 語言與運行時 | TypeScript 5.x 嚴格模式 |
| 樣式方案 | Tailwind CSS 3.x |
| UI 組件 | shadcn/ui + Radix UI |
| 路由模式 | Next.js App Router |
| 目錄結構 | src/ 目錄 + @/* 別名 |
| 代碼品質 | ESLint 配置 |

**備註：** 專案初始化應作為第一個實作 Story。

---
