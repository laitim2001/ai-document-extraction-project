# Story 17-1: i18n 基礎架構設置 - Technical Specification

**Version:** 1.0
**Created:** 2026-01-16
**Status:** Ready for Development
**Story Key:** 17-1-i18n-infrastructure-setup

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 17.1 |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Large (8-12h) |
| Dependencies | 無 |
| Blocking | Story 17.2, 17.3, 17.4, 17.5 |

---

## Objective

建立完整的國際化基礎架構，包括安裝 next-intl 套件、配置語言路由、建立翻譯檔案結構，為後續 UI 文字國際化奠定基礎。此 Story 是 Epic 17 的基石，所有後續 Stories 都依賴此架構。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | next-intl 套件安裝與配置 | 安裝 npm 套件、配置 TypeScript 類型 |
| AC2 | 語言路由結構重構 | 建立 `[locale]` 動態路由、移動現有頁面 |
| AC3 | 翻譯檔案結構建立 | 建立 `messages/` 目錄、JSON 翻譯檔案 |
| AC4 | i18n Provider 整合 | 配置 NextIntlClientProvider、Layout 整合 |
| AC5 | Middleware 語言偵測 | 建立 middleware.ts、實作語言偵測和重定向 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Next.js 15 App Router + next-intl                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌────────────────┐     ┌──────────────────────────┐  │
│  │ Middleware   │────▶│ [locale] Route │────▶│ Page/Component           │  │
│  │ (Language    │     │ Layout         │     │ useTranslations()        │  │
│  │  Detection)  │     │                │     │ getTranslations()        │  │
│  └──────────────┘     └────────────────┘     └──────────────────────────┘  │
│         │                    │                          │                   │
│         ▼                    ▼                          ▼                   │
│  ┌──────────────┐     ┌────────────────┐     ┌──────────────────────────┐  │
│  │ Cookie       │     │ i18n/request   │     │ messages/{locale}/       │  │
│  │ (Preference) │     │ (Config)       │     │ common.json              │  │
│  └──────────────┘     └────────────────┘     └──────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**語言優先級流程：**
1. URL 路徑中的 locale (如 `/zh-TW/invoices`)
2. Cookie 中的語言偏好
3. Accept-Language header
4. 預設語言 (`en`)

---

## Implementation Guide

### Phase 1: 安裝與基礎配置 (30 min)

#### Step 1.1: 安裝 next-intl 套件

```bash
npm install next-intl
```

#### Step 1.2: 建立 i18n 配置常數

Create `src/i18n/config.ts`:

```typescript
/**
 * @fileoverview i18n 國際化配置常數
 * @description
 *   定義支援的語言清單、預設語言和語言名稱映射。
 *   所有 i18n 相關功能都應使用此檔案定義的常數。
 *
 * @module src/i18n/config
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 *
 * @features
 *   - 支援語言清單定義
 *   - 預設語言設定
 *   - 語言顯示名稱映射
 *
 * @related
 *   - src/i18n/request.ts - Server-side locale 請求
 *   - src/i18n/routing.ts - 路由配置
 *   - src/middleware.ts - 語言偵測中間件
 */

/** 支援的語言代碼列表 */
export const locales = ['en', 'zh-TW', 'zh-CN'] as const;

/** 語言代碼類型 */
export type Locale = (typeof locales)[number];

/** 預設語言（fallback） */
export const defaultLocale: Locale = 'en';

/** 語言顯示名稱映射 */
export const localeNames: Record<Locale, string> = {
  'en': 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
};

/** 語言對應的 HTML lang 屬性值 */
export const localeHtmlLang: Record<Locale, string> = {
  'en': 'en',
  'zh-TW': 'zh-Hant-TW',
  'zh-CN': 'zh-Hans-CN',
};

/** 判斷是否為有效的 locale */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
```

#### Step 1.3: 建立 i18n 請求配置

Create `src/i18n/request.ts`:

```typescript
/**
 * @fileoverview next-intl Server-side 請求配置
 * @description
 *   配置 next-intl 的 Server-side 翻譯載入邏輯。
 *   此檔案會在每次請求時執行，載入對應語言的翻譯檔案。
 *
 * @module src/i18n/request
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 *
 * @features
 *   - 動態載入語言翻譯檔案
 *   - 無效語言自動 fallback 到預設語言
 *   - 支援合併多個命名空間
 *
 * @dependencies
 *   - next-intl/server - Server-side i18n 工具
 *
 * @related
 *   - src/i18n/config.ts - 語言配置常數
 *   - messages/ - 翻譯檔案目錄
 */

import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, isValidLocale } from './config';

export default getRequestConfig(async ({ locale }) => {
  // 驗證 locale 是否有效，無效則使用預設語言
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;

  // 動態載入翻譯檔案
  const messages = (
    await import(`../../messages/${validLocale}/common.json`)
  ).default;

  return {
    locale: validLocale,
    messages,
    // 時區設定（可選）
    timeZone: 'Asia/Taipei',
    // 錯誤處理
    onError: (error) => {
      console.error('[i18n] Translation error:', error);
    },
    getMessageFallback: ({ namespace, key }) => {
      return `[Missing: ${namespace}.${key}]`;
    },
  };
});
```

#### Step 1.4: 建立路由配置

Create `src/i18n/routing.ts`:

```typescript
/**
 * @fileoverview next-intl 路由配置
 * @description
 *   定義 i18n 路由行為，包括 locale 前綴策略和預設語言。
 *
 * @module src/i18n/routing
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 */

import { defineRouting } from 'next-intl/routing';
import { createSharedPathnamesNavigation } from 'next-intl/navigation';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always', // 總是顯示 locale 前綴
});

// 建立 locale-aware 的導航函數
export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation(routing);
```

---

### Phase 2: 建立翻譯檔案結構 (20 min)

#### Step 2.1: 建立繁體中文基礎翻譯

Create `messages/zh-TW/common.json`:

```json
{
  "metadata": {
    "title": "AI 文件提取系統",
    "description": "AI 驅動的文件內容提取與自動分類系統"
  },
  "actions": {
    "add": "新增",
    "edit": "編輯",
    "delete": "刪除",
    "save": "保存",
    "cancel": "取消",
    "confirm": "確認",
    "close": "關閉",
    "refresh": "刷新",
    "search": "搜尋",
    "filter": "篩選",
    "export": "導出",
    "import": "導入",
    "submit": "提交",
    "reset": "重設",
    "back": "返回",
    "next": "下一步",
    "previous": "上一步",
    "view": "查看",
    "download": "下載",
    "upload": "上傳",
    "retry": "重試",
    "approve": "批准",
    "reject": "拒絕"
  },
  "status": {
    "pending": "待處理",
    "processing": "處理中",
    "completed": "已完成",
    "failed": "失敗",
    "waitingReview": "待審核",
    "approved": "已通過",
    "rejected": "已拒絕",
    "active": "啟用",
    "inactive": "停用",
    "draft": "草稿"
  },
  "pagination": {
    "previous": "上一頁",
    "next": "下一頁",
    "first": "第一頁",
    "last": "最後一頁",
    "page": "第 {page} 頁",
    "pageOf": "第 {page} / {total} 頁",
    "showing": "顯示 {start} - {end}，共 {total} 筆",
    "itemsPerPage": "每頁顯示",
    "goToPage": "前往頁面"
  },
  "form": {
    "required": "必填",
    "optional": "選填",
    "selectPlaceholder": "請選擇...",
    "searchPlaceholder": "搜尋...",
    "noResults": "沒有結果",
    "loading": "載入中..."
  },
  "dialog": {
    "confirmDelete": "確認刪除？",
    "confirmAction": "確認此操作？",
    "deleteWarning": "此操作無法復原，確定要刪除嗎？",
    "unsavedChanges": "有未保存的變更，確定要離開嗎？"
  },
  "toast": {
    "success": "操作成功",
    "error": "操作失敗",
    "saved": "已保存",
    "deleted": "已刪除",
    "updated": "已更新",
    "created": "已建立",
    "copied": "已複製",
    "networkError": "網路連線錯誤，請檢查網路後重試"
  },
  "time": {
    "justNow": "剛剛",
    "minutesAgo": "{count} 分鐘前",
    "hoursAgo": "{count} 小時前",
    "daysAgo": "{count} 天前",
    "weeksAgo": "{count} 週前",
    "monthsAgo": "{count} 個月前",
    "yearsAgo": "{count} 年前"
  },
  "navigation": {
    "dashboard": "儀表板",
    "invoices": "發票文件",
    "review": "待審核",
    "rules": "映射規則",
    "companies": "公司管理",
    "reports": "報表",
    "admin": "系統管理",
    "settings": "設定",
    "logout": "登出"
  }
}
```

#### Step 2.2: 建立英文基礎翻譯

Create `messages/en/common.json`:

```json
{
  "metadata": {
    "title": "AI Document Extraction",
    "description": "AI-powered document extraction and classification system"
  },
  "actions": {
    "add": "Add",
    "edit": "Edit",
    "delete": "Delete",
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "close": "Close",
    "refresh": "Refresh",
    "search": "Search",
    "filter": "Filter",
    "export": "Export",
    "import": "Import",
    "submit": "Submit",
    "reset": "Reset",
    "back": "Back",
    "next": "Next",
    "previous": "Previous",
    "view": "View",
    "download": "Download",
    "upload": "Upload",
    "retry": "Retry",
    "approve": "Approve",
    "reject": "Reject"
  },
  "status": {
    "pending": "Pending",
    "processing": "Processing",
    "completed": "Completed",
    "failed": "Failed",
    "waitingReview": "Waiting Review",
    "approved": "Approved",
    "rejected": "Rejected",
    "active": "Active",
    "inactive": "Inactive",
    "draft": "Draft"
  },
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "first": "First",
    "last": "Last",
    "page": "Page {page}",
    "pageOf": "Page {page} of {total}",
    "showing": "Showing {start} - {end} of {total}",
    "itemsPerPage": "Items per page",
    "goToPage": "Go to page"
  },
  "form": {
    "required": "Required",
    "optional": "Optional",
    "selectPlaceholder": "Select...",
    "searchPlaceholder": "Search...",
    "noResults": "No results",
    "loading": "Loading..."
  },
  "dialog": {
    "confirmDelete": "Confirm Delete?",
    "confirmAction": "Confirm this action?",
    "deleteWarning": "This action cannot be undone. Are you sure?",
    "unsavedChanges": "You have unsaved changes. Are you sure you want to leave?"
  },
  "toast": {
    "success": "Operation successful",
    "error": "Operation failed",
    "saved": "Saved",
    "deleted": "Deleted",
    "updated": "Updated",
    "created": "Created",
    "copied": "Copied",
    "networkError": "Network error. Please check your connection and try again."
  },
  "time": {
    "justNow": "Just now",
    "minutesAgo": "{count} minutes ago",
    "hoursAgo": "{count} hours ago",
    "daysAgo": "{count} days ago",
    "weeksAgo": "{count} weeks ago",
    "monthsAgo": "{count} months ago",
    "yearsAgo": "{count} years ago"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "invoices": "Invoices",
    "review": "Review Queue",
    "rules": "Mapping Rules",
    "companies": "Companies",
    "reports": "Reports",
    "admin": "Admin",
    "settings": "Settings",
    "logout": "Logout"
  }
}
```

#### Step 2.3: 建立簡體中文基礎翻譯

Create `messages/zh-CN/common.json`:

```json
{
  "metadata": {
    "title": "AI 文档提取系统",
    "description": "AI 驱动的文档内容提取与自动分类系统"
  },
  "actions": {
    "add": "添加",
    "edit": "编辑",
    "delete": "删除",
    "save": "保存",
    "cancel": "取消",
    "confirm": "确认",
    "close": "关闭",
    "refresh": "刷新",
    "search": "搜索",
    "filter": "筛选",
    "export": "导出",
    "import": "导入",
    "submit": "提交",
    "reset": "重置",
    "back": "返回",
    "next": "下一步",
    "previous": "上一步",
    "view": "查看",
    "download": "下载",
    "upload": "上传",
    "retry": "重试",
    "approve": "批准",
    "reject": "拒绝"
  },
  "status": {
    "pending": "待处理",
    "processing": "处理中",
    "completed": "已完成",
    "failed": "失败",
    "waitingReview": "待审核",
    "approved": "已通过",
    "rejected": "已拒绝",
    "active": "启用",
    "inactive": "停用",
    "draft": "草稿"
  },
  "pagination": {
    "previous": "上一页",
    "next": "下一页",
    "first": "第一页",
    "last": "最后一页",
    "page": "第 {page} 页",
    "pageOf": "第 {page} / {total} 页",
    "showing": "显示 {start} - {end}，共 {total} 条",
    "itemsPerPage": "每页显示",
    "goToPage": "前往页面"
  },
  "form": {
    "required": "必填",
    "optional": "选填",
    "selectPlaceholder": "请选择...",
    "searchPlaceholder": "搜索...",
    "noResults": "没有结果",
    "loading": "加载中..."
  },
  "dialog": {
    "confirmDelete": "确认删除？",
    "confirmAction": "确认此操作？",
    "deleteWarning": "此操作无法撤销，确定要删除吗？",
    "unsavedChanges": "有未保存的更改，确定要离开吗？"
  },
  "toast": {
    "success": "操作成功",
    "error": "操作失败",
    "saved": "已保存",
    "deleted": "已删除",
    "updated": "已更新",
    "created": "已创建",
    "copied": "已复制",
    "networkError": "网络连接错误，请检查网络后重试"
  },
  "time": {
    "justNow": "刚刚",
    "minutesAgo": "{count} 分钟前",
    "hoursAgo": "{count} 小时前",
    "daysAgo": "{count} 天前",
    "weeksAgo": "{count} 周前",
    "monthsAgo": "{count} 个月前",
    "yearsAgo": "{count} 年前"
  },
  "navigation": {
    "dashboard": "仪表板",
    "invoices": "发票文件",
    "review": "待审核",
    "rules": "映射规则",
    "companies": "公司管理",
    "reports": "报表",
    "admin": "系统管理",
    "settings": "设置",
    "logout": "登出"
  }
}
```

---

### Phase 3: 路由結構重構 (45 min)

#### Step 3.1: 建立 [locale] 動態路由 Layout

Create `src/app/[locale]/layout.tsx`:

```typescript
/**
 * @fileoverview i18n 語言感知的根佈局組件
 * @description
 *   為所有頁面提供語言上下文，整合 next-intl Provider。
 *   此佈局會根據 URL 中的 locale 參數載入對應的翻譯。
 *
 * @module src/app/[locale]/layout
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 *
 * @features
 *   - 語言感知的 HTML lang 屬性
 *   - NextIntlClientProvider 整合
 *   - SEO hreflang 標籤
 *
 * @dependencies
 *   - next-intl - i18n 框架
 *   - next-intl/navigation - 路由整合
 *
 * @related
 *   - src/i18n/config.ts - 語言配置
 *   - src/i18n/request.ts - 翻譯載入
 */

import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter } from 'next/font/google';
import { locales, localeHtmlLang, type Locale } from '@/i18n/config';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

// 生成靜態路由參數
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// 生成元數據
export async function generateMetadata({ params: { locale } }: LocaleLayoutProps) {
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: Object.fromEntries(
        locales.map((loc) => [loc, `${baseUrl}/${loc}`])
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: LocaleLayoutProps) {
  // 驗證 locale 是否有效
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // 載入翻譯訊息
  const messages = await getMessages();

  return (
    <html lang={localeHtmlLang[locale as Locale]} suppressHydrationWarning>
      <head>
        {/* hreflang 標籤 */}
        {locales.map((loc) => (
          <link
            key={loc}
            rel="alternate"
            hrefLang={localeHtmlLang[loc]}
            href={`${process.env.NEXT_PUBLIC_APP_URL}/${loc}`}
          />
        ))}
        <link
          rel="alternate"
          hrefLang="x-default"
          href={`${process.env.NEXT_PUBLIC_APP_URL}/en`}
        />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <QueryProvider>
                {children}
                <Toaster />
              </QueryProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

#### Step 3.2: 更新 next.config.ts

Update `next.config.ts`:

```typescript
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Configure image domains if needed
  images: {
    remotePatterns: [],
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.canvas = false;
    }

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'commonjs canvas',
        'pdf-to-img': 'commonjs pdf-to-img',
        'pdfjs-dist': 'commonjs pdfjs-dist',
      });
    }

    return config;
  },
};

export default withNextIntl(nextConfig);
```

---

### Phase 4: Middleware 配置 (30 min)

#### Step 4.1: 建立/更新 Middleware

Create/Update `src/middleware.ts`:

```typescript
/**
 * @fileoverview Next.js Middleware for i18n language detection
 * @description
 *   處理語言偵測、路由重定向和 cookie 設置。
 *   結合 NextAuth 認證中間件。
 *
 * @module src/middleware
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 *
 * @features
 *   - Accept-Language header 語言偵測
 *   - Cookie 語言偏好持久化
 *   - 舊路徑自動重定向
 *   - 與 NextAuth 整合
 *
 * @dependencies
 *   - next-intl/middleware - i18n 中間件
 *   - next-auth - 認證中間件
 */

import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

// 建立 next-intl 中間件
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
});

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳過 API 路由、靜態檔案和 Next.js 內部路徑
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // 處理舊路徑重定向（向後兼容）
  // 如果路徑不以支援的 locale 開頭，重定向到預設語言
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    // 從 cookie 或 Accept-Language 取得偏好語言
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    const acceptLanguage = request.headers.get('accept-language');

    let detectedLocale = defaultLocale;

    if (cookieLocale && locales.includes(cookieLocale as any)) {
      detectedLocale = cookieLocale as typeof defaultLocale;
    } else if (acceptLanguage) {
      // 解析 Accept-Language header
      const preferredLocales = acceptLanguage
        .split(',')
        .map((lang) => lang.split(';')[0].trim());

      for (const preferred of preferredLocales) {
        // 完全匹配
        if (locales.includes(preferred as any)) {
          detectedLocale = preferred as typeof defaultLocale;
          break;
        }
        // 語言代碼匹配（如 zh 匹配 zh-TW）
        const langCode = preferred.split('-')[0];
        const matched = locales.find((l) => l.startsWith(langCode));
        if (matched) {
          detectedLocale = matched;
          break;
        }
      }
    }

    // 重定向到帶 locale 的路徑
    const redirectUrl = new URL(`/${detectedLocale}${pathname}`, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // 使用 next-intl middleware 處理
  return intlMiddleware(request);
}

export const config = {
  // 匹配所有路徑，除了 API、靜態檔案和 Next.js 內部路徑
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

---

### Phase 5: 移動現有頁面到 [locale] 路由 (60 min)

#### Step 5.1: 移動 (auth) 路由

1. 將 `src/app/(auth)/` 目錄移動到 `src/app/[locale]/(auth)/`
2. 保持內部結構不變

```bash
# 在 Windows PowerShell 執行
Move-Item -Path "src/app/(auth)" -Destination "src/app/[locale]/(auth)"
```

#### Step 5.2: 移動 (dashboard) 路由

1. 將 `src/app/(dashboard)/` 目錄移動到 `src/app/[locale]/(dashboard)/`
2. 保持內部結構不變

```bash
# 在 Windows PowerShell 執行
Move-Item -Path "src/app/(dashboard)" -Destination "src/app/[locale]/(dashboard)"
```

#### Step 5.3: 更新根 page.tsx 進行重定向

Create `src/app/page.tsx`:

```typescript
/**
 * @fileoverview 根頁面重定向
 * @description
 *   將根路徑 `/` 重定向到預設語言路徑 `/en`
 *
 * @module src/app/page
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 */

import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/config';

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
```

#### Step 5.4: 更新內部連結使用 locale-aware Link

在組件中使用 `@/i18n/routing` 提供的 `Link` 替代 `next/link`：

```typescript
// 之前
import Link from 'next/link';
<Link href="/invoices">發票</Link>

// 之後
import { Link } from '@/i18n/routing';
<Link href="/invoices">發票</Link>
```

---

## Verification Checklist

### Build Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| TypeScript 編譯 | `npm run type-check` | 無錯誤 | [ ] |
| 專案建置 | `npm run build` | 建置成功 | [ ] |
| 開發服務器 | `npm run dev` | 正常啟動 | [ ] |

### Route Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 根路徑重定向 | 訪問 `/` | 重定向到 `/en` | [ ] |
| 舊路徑重定向 | 訪問 `/invoices` | 重定向到 `/en/invoices` | [ ] |
| 繁中路徑 | 訪問 `/zh-TW/invoices` | 正常顯示頁面 | [ ] |
| 英文路徑 | 訪問 `/en/invoices` | 正常顯示頁面 | [ ] |
| 簡中路徑 | 訪問 `/zh-CN/invoices` | 正常顯示頁面 | [ ] |
| 無效 locale | 訪問 `/xx/invoices` | 顯示 404 | [ ] |

### Language Detection Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Accept-Language: zh-TW | 訪問 `/` | 重定向到 `/zh-TW` | [ ] |
| Accept-Language: en | 訪問 `/` | 重定向到 `/en` | [ ] |
| Cookie 偏好 | 設置 NEXT_LOCALE cookie | 使用 cookie 語言 | [ ] |

### Translation Loading Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Server Component | 使用 `getTranslations` | 正確載入翻譯 | [ ] |
| Client Component | 使用 `useTranslations` | 正確載入翻譯 | [ ] |
| 缺失翻譯 | 使用不存在的 key | 顯示 fallback 訊息 | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/i18n/config.ts` | i18n 配置常數 |
| `src/i18n/request.ts` | Server-side 翻譯載入配置 |
| `src/i18n/routing.ts` | 路由配置和 locale-aware 導航 |
| `src/app/[locale]/layout.tsx` | 語言感知根佈局 |
| `src/app/page.tsx` | 根頁面重定向 |
| `src/middleware.ts` | 語言偵測中間件 |
| `messages/zh-TW/common.json` | 繁體中文翻譯 |
| `messages/en/common.json` | 英文翻譯 |
| `messages/zh-CN/common.json` | 簡體中文翻譯 |
| `next.config.ts` | Next.js 配置（更新） |

---

## Dependencies

```bash
npm install next-intl
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Module not found: next-intl` | 確保執行 `npm install next-intl` |
| Middleware 不執行 | 檢查 `config.matcher` 設定 |
| 翻譯載入失敗 | 檢查 `messages/` 目錄路徑和 JSON 格式 |
| TypeScript 類型錯誤 | 確保 `src/i18n/config.ts` 正確導出類型 |
| 路由不匹配 | 確認已移動頁面到 `[locale]` 目錄 |

---

## Next Steps

完成 Story 17-1 後：
1. 進入 **Story 17-2**（核心 UI 文字國際化）
2. 開始提取頁面中的硬編碼文字
3. 建立模組專屬翻譯檔案

---

*Generated by BMAD Method - Create Tech Spec Workflow*
