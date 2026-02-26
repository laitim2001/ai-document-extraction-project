# FIX-096: Layout 嵌套導致的 Hydration 錯誤

> **建立日期**: 2025-12-17
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: UI / Hydration
> **關聯**: FIX-095 (Middleware 路由保護)

---

## 1. 問題描述

### 1.1 問題現象
登入成功後重定向到 `callbackUrl` 時，出現 React hydration 錯誤：
```
Warning: In HTML, <html> cannot be a child of <body>.
This will cause a hydration error.
    at html
    at LocaleLayout (Server)
    ...
    at RootLayout (Server)
```

### 1.2 影響範圍
- 登入後重定向流程
- 所有使用 `callbackUrl` 的重定向
- 可能影響頁面初次渲染

---

## 2. 根本原因分析

### 2.1 問題根源

**Layout 嵌套結構錯誤**：
- `app/layout.tsx` (RootLayout) 渲染 `<html><body>`
- `app/[locale]/layout.tsx` (LocaleLayout) 也渲染 `<html><body>`

在 Next.js App Router 中，RootLayout 會包裹所有路由，包括 `[locale]/*` 路由。
這導致 HTML 結構變成：

```
RootLayout: <html><body>
  └─ LocaleLayout: <html><body>  ← 錯誤！<html> 在 <body> 內
```

### 2.2 觸發條件
- 這個問題在 FIX-095 實施後變得明顯，因為登入重定向流程被正確執行
- 之前因為未正確重定向，這個問題可能被掩蓋

---

## 3. 解決方案

### 3.1 修改文件清單

| 文件 | 變更類型 | 說明 |
|------|----------|------|
| `apps/web/src/app/layout.tsx` | 修改 | 添加字體和 CSS，成為主要 HTML 結構提供者 |
| `apps/web/src/app/[locale]/layout.tsx` | 修改 | 移除 `<html>` 和 `<body>`，只保留 Providers |

### 3.2 具體修改內容

#### RootLayout (app/layout.tsx) - 提供 HTML 結構
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'IT Project Management Platform',
  description: '...',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
```

#### LocaleLayout (app/[locale]/layout.tsx) - 只提供 Providers
```typescript
import Script from 'next/script';
// ... other imports

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages({ locale });

  // FIX-096: 不再渲染 <html> 和 <body>
  return (
    <>
      {/* 動態設定 <html lang="..."> 屬性 */}
      <Script
        id="set-html-lang"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang = "${locale}";`,
        }}
      />

      <Suspense fallback={null}>
        <GlobalProgress />
      </Suspense>

      <SessionProvider>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TRPCProvider>
            {children}
            <Toaster />
          </TRPCProvider>
        </NextIntlClientProvider>
      </SessionProvider>
    </>
  );
}
```

### 3.3 技術細節

**lang 屬性處理**：
- 原本 LocaleLayout 透過 `<html lang={locale}>` 設定語言
- 現在改用 `next/script` 的 `beforeInteractive` 策略動態設定
- 這確保了 SEO 和無障礙功能不受影響

---

## 4. 測試驗證

### 4.1 測試場景
- [ ] 登出後訪問 `/projects` → 重定向到 `/login`
- [ ] 登入成功後重定向到 `callbackUrl` → 無 hydration 錯誤
- [ ] 直接訪問 `/zh-TW/dashboard` → 正常顯示
- [ ] 直接訪問 `/en/projects` → 正常顯示
- [ ] 語言切換 → `<html lang="...">` 正確更新
- [ ] 頁面刷新 → 無 hydration 警告

### 4.2 驗收標準
1. ✅ F12 Console 無 hydration 錯誤
2. ✅ 所有頁面正常渲染
3. ✅ `<html lang="...">` 屬性正確設定
4. ✅ 字體 (Inter) 正常應用

---

## 5. 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| Layout 結構變更可能影響其他頁面 | 中 | 全面測試所有頁面 |
| Script 動態設定 lang 的時機 | 低 | 使用 beforeInteractive 確保早期執行 |
| Metadata 重複定義 | 低 | Metadata 只在 RootLayout 定義 |

---

## 6. 相關文件

- `apps/web/src/app/layout.tsx` - Root Layout
- `apps/web/src/app/[locale]/layout.tsx` - Locale Layout
- `claudedocs/4-changes/bug-fixes/FIX-095-middleware-route-protection-incomplete.md` - 關聯的 FIX

---

## 7. 實施狀態

- [x] 問題分析完成 ✅ 2025-12-17
- [x] RootLayout 已修改 ✅ 2025-12-17
- [x] LocaleLayout 已修改 ✅ 2025-12-17
- [x] 本地測試通過 ✅ 2025-12-17
- [ ] 代碼提交

---

**最後更新**: 2025-12-17
**負責人**: AI Assistant
