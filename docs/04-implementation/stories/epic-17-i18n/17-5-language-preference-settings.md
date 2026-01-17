# Story 17.5: 語言偏好設置與切換 UI

**Status:** done

---

## Story

**As a** 用戶,
**I want** 在介面上切換語言並記住我的偏好,
**So that** 我每次訪問系統時都能以偏好語言顯示，無需重複設定。

---

## Acceptance Criteria

### AC1: 語言切換 UI 組件

**Given** 用戶已登入系統
**When** 用戶點擊語言切換按鈕
**Then** 顯示支援的語言選項（繁體中文、English、简体中文）
**And** 當前語言有明確標示
**And** 選擇新語言後即時切換頁面內容

### AC2: 語言偏好持久化（LocalStorage）

**Given** 用戶選擇了偏好語言
**When** 用戶再次訪問網站（同一瀏覽器）
**Then** 自動載入上次選擇的語言
**And** 無需用戶再次選擇

### AC3: 語言偏好持久化（資料庫）

**Given** 用戶已登入並選擇了偏好語言
**When** 用戶在另一設備登入
**Then** 自動載入資料庫中儲存的語言偏好
**And** 優先級：資料庫偏好 > LocalStorage > 瀏覽器語言 > 預設語言

### AC4: 用戶設定頁面整合

**Given** 系統有用戶設定頁面（若有）
**When** 用戶訪問設定頁面
**Then** 可以在設定頁面修改語言偏好
**And** 變更即時生效

### AC5: SEO 最佳化

**Given** 系統需要支援多語言 SEO
**When** 搜尋引擎爬取頁面
**Then** 頁面包含正確的 `<html lang="xx">` 屬性
**And** 包含 `hreflang` 標籤指向其他語言版本
**And** 每個語言版本有獨立的 canonical URL

---

## Tasks / Subtasks

- [x] **Task 1: 建立語言切換組件** (AC: #1)
  - [x] 1.1 建立 `LocaleSwitcher.tsx` 組件
  - [x] 1.2 使用 Dropdown 或 Select 顯示語言選項
  - [x] 1.3 顯示國旗或語言名稱
  - [x] 1.4 整合到 Header 組件

- [x] **Task 2: 實作 LocalStorage 持久化** (AC: #2)
  - [x] 2.1 建立 `useLocalePreference` hook
  - [x] 2.2 語言切換時寫入 LocalStorage
  - [x] 2.3 初始載入時讀取 LocalStorage

- [x] **Task 3: 實作資料庫持久化** (AC: #3)
  - [x] 3.1 擴展 User model 添加 `preferredLocale` 欄位
  - [x] 3.2 建立 `PATCH /api/v1/users/me/locale` API
  - [x] 3.3 登入時從資料庫載入語言偏好
  - [x] 3.4 語言切換時更新資料庫

- [x] **Task 4: 語言偏好優先級邏輯** (AC: #2, #3)
  - [x] 4.1 實作優先級判斷邏輯
  - [x] 4.2 整合到 Middleware

- [x] **Task 5: SEO 最佳化** (AC: #5)
  - [x] 5.1 更新 `RootLayout` 設置動態 `lang` 屬性
  - [x] 5.2 添加 `hreflang` 標籤
  - [x] 5.3 更新 Metadata 生成邏輯

- [x] **Task 6: 用戶設定頁面整合（若適用）** (AC: #4)
  - [x] 6.1 在設定頁面添加語言選項（整合至 TopBar）
  - [x] 6.2 與 LocaleSwitcher 共用邏輯

---

## Dev Notes

### 依賴項

- **Story 17.1**: i18n 基礎架構設置（必須先完成）
- **Story 17.2**: 核心 UI 文字國際化（翻譯檔案）

### Project Structure Notes

```
src/
├── components/
│   └── features/
│       └── locale/
│           ├── LocaleSwitcher.tsx
│           └── LocaleFlag.tsx
│
├── hooks/
│   └── use-locale-preference.ts
│
├── app/
│   └── api/
│       └── v1/
│           └── users/
│               └── me/
│                   └── locale/
│                       └── route.ts

prisma/
└── schema.prisma            # 添加 preferredLocale 欄位
```

### Architecture Compliance

#### Prisma Schema 擴展

```prisma
// prisma/schema.prisma
model User {
  id              String    @id @default(uuid())
  // ... 現有欄位
  preferredLocale String?   @map("preferred_locale") @default("en")

  @@map("users")
}
```

#### 語言切換組件

```typescript
// src/components/features/locale/LocaleSwitcher.tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { useLocalePreference } from '@/hooks/use-locale-preference';

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { setLocalePreference } = useLocalePreference();

  const switchLocale = async (newLocale: Locale) => {
    // 1. 更新偏好設定
    await setLocalePreference(newLocale);

    // 2. 導航到新語言路徑
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={locale === loc ? 'bg-accent' : ''}
          >
            {localeNames[loc]}
            {locale === loc && ' ✓'}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 語言偏好 Hook

```typescript
// src/hooks/use-locale-preference.ts
'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { Locale } from '@/i18n/config';

const LOCALE_STORAGE_KEY = 'preferred-locale';

export function useLocalePreference() {
  const { data: session, update } = useSession();

  const getLocalePreference = useCallback((): Locale | null => {
    // 1. 優先使用資料庫偏好（已登入）
    if (session?.user?.preferredLocale) {
      return session.user.preferredLocale as Locale;
    }

    // 2. 使用 LocalStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored) return stored as Locale;
    }

    return null;
  }, [session]);

  const setLocalePreference = useCallback(async (locale: Locale) => {
    // 1. 保存到 LocalStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }

    // 2. 如果已登入，保存到資料庫
    if (session?.user) {
      try {
        await fetch('/api/v1/users/me/locale', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
        // 更新 session
        await update({ preferredLocale: locale });
      } catch (error) {
        console.error('Failed to save locale preference:', error);
      }
    }
  }, [session, update]);

  return {
    getLocalePreference,
    setLocalePreference,
  };
}
```

#### API 端點

```typescript
// src/app/api/v1/users/me/locale/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { locales } from '@/i18n/config';

const UpdateLocaleSchema = z.object({
  locale: z.enum(locales as unknown as [string, ...string[]]),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { locale } = UpdateLocaleSchema.parse(body);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferredLocale: locale },
  });

  return NextResponse.json({ success: true, locale });
}
```

#### SEO 元數據

```typescript
// src/app/[locale]/layout.tsx
import { locales, type Locale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: Locale } }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

  return {
    alternates: {
      canonical: `${baseUrl}/${params.locale}`,
      languages: Object.fromEntries(
        locales.map((loc) => [loc, `${baseUrl}/${loc}`])
      ),
    },
  };
}

export default function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {locales.map((loc) => (
          <link
            key={loc}
            rel="alternate"
            hrefLang={loc}
            href={`${process.env.NEXT_PUBLIC_APP_URL}/${loc}`}
          />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Database Migration

```bash
npx prisma migrate dev --name add_user_preferred_locale
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 語言切換按鈕 | 顯示在 Header 中 |
| 點擊切換語言 | 頁面內容即時更新 |
| 刷新頁面 | 保持上次選擇的語言 |
| 登出後登入 | 載入資料庫中的語言偏好 |
| 新設備登入 | 載入資料庫中的語言偏好 |
| `<html lang>` | 根據當前語言正確設置 |
| `hreflang` 標籤 | 指向所有支援的語言版本 |

### References

- [Source: next-intl 路由](https://next-intl-docs.vercel.app/docs/routing)
- [Source: Google hreflang 指南](https://developers.google.com/search/docs/specialty/international/localized-versions)

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 17.5 |
| Story Key | 17-5-language-preference-settings |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Medium (6-8h) |
| Dependencies | Story 17.1, Story 17.2 |
| Blocking | 無 |

---

*Story created: 2026-01-16*
*Status: done*
*Completed: 2026-01-17*
