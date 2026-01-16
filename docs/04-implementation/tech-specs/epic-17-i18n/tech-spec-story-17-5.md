# Story 17-5: 語言偏好設置與切換 UI - Technical Specification

**Version:** 1.0
**Created:** 2026-01-16
**Status:** Ready for Development
**Story Key:** 17-5-language-preference-settings

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 17.5 |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Medium (6-8h) |
| Dependencies | Story 17.1, Story 17.2 |
| Blocking | 無 |

---

## Objective

實現用戶語言偏好設置和切換功能，包括建立語言切換 UI 組件、實現 LocalStorage 和資料庫雙重持久化、以及 SEO 優化（hreflang 標籤）。確保用戶可以方便地切換語言並在不同設備間同步偏好。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 語言切換 UI 組件 | 建立 LocaleSwitcher 組件、整合到 Header |
| AC2 | LocalStorage 持久化 | 建立 useLocalePreference hook、讀寫 LocalStorage |
| AC3 | 資料庫持久化 | 擴展 User model、建立 API 端點、同步偏好 |
| AC4 | 用戶設定頁面整合 | 在設定頁面添加語言選項 |
| AC5 | SEO 最佳化 | 添加 hreflang 標籤、動態 HTML lang |

---

## Data Models

### Prisma Schema Extensions

```prisma
// prisma/schema.prisma

model User {
  id                String    @id @default(uuid())
  email             String    @unique
  name              String?
  // ... 現有欄位

  // 新增：語言偏好
  preferredLocale   String?   @map("preferred_locale") @default("en")

  updatedAt         DateTime  @updatedAt @map("updated_at")

  @@map("users")
}
```

#### Run Migration

```bash
npx prisma migrate dev --name add_user_preferred_locale
```

---

## Implementation Guide

### Phase 1: 建立語言切換組件 (45 min)

#### Step 1.1: 建立 LocaleSwitcher 組件

Create `src/components/features/locale/LocaleSwitcher.tsx`:

```typescript
/**
 * @fileoverview 語言切換組件
 * @description
 *   提供語言切換下拉選單，支援即時切換和偏好持久化。
 *   整合 next-intl 路由和 useLocalePreference hook。
 *
 * @module src/components/features/locale/LocaleSwitcher
 * @author Development Team
 * @since Epic 17 - Story 17.5 (Language Preference Settings)
 * @lastModified 2026-01-16
 *
 * @features
 *   - 語言下拉選單
 *   - 即時語言切換
 *   - 偏好設定持久化
 *
 * @related
 *   - src/i18n/config.ts - 語言配置
 *   - src/hooks/use-locale-preference.ts - 偏好管理 Hook
 */

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { useLocalePreference } from '@/hooks/use-locale-preference';
import { cn } from '@/lib/utils';

interface LocaleSwitcherProps {
  /** 是否顯示完整語言名稱（預設只顯示圖標） */
  showLabel?: boolean;
  /** 按鈕變體 */
  variant?: 'default' | 'outline' | 'ghost';
  /** 自定義類名 */
  className?: string;
}

/**
 * 語言切換組件
 */
export function LocaleSwitcher({
  showLabel = false,
  variant = 'ghost',
  className,
}: LocaleSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { setLocalePreference, isLoading } = useLocalePreference();

  const handleLocaleChange = async (newLocale: Locale) => {
    if (newLocale === locale) return;

    // 1. 保存偏好設定
    await setLocalePreference(newLocale);

    // 2. 導航到新語言路徑
    // 從當前路徑中移除舊 locale 並添加新 locale
    const segments = pathname.split('/');
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    const newPath = segments.join('/') || '/';

    router.push(newPath);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={showLabel ? 'default' : 'icon'}
          className={cn('gap-2', className)}
          disabled={isLoading}
        >
          <Globe className="h-4 w-4" />
          {showLabel && <span>{localeNames[locale]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={cn(
              'flex items-center justify-between',
              locale === loc && 'bg-accent'
            )}
          >
            <span>{localeNames[loc]}</span>
            {locale === loc && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Step 1.2: 建立語言偏好 Hook

Create `src/hooks/use-locale-preference.ts`:

```typescript
/**
 * @fileoverview 語言偏好管理 Hook
 * @description
 *   管理用戶語言偏好，支援 LocalStorage 和資料庫雙重持久化。
 *   優先級：資料庫 > LocalStorage > 瀏覽器語言 > 預設語言。
 *
 * @module src/hooks/use-locale-preference
 * @author Development Team
 * @since Epic 17 - Story 17.5 (Language Preference Settings)
 * @lastModified 2026-01-16
 *
 * @features
 *   - LocalStorage 讀寫
 *   - 資料庫同步（已登入用戶）
 *   - 優先級判斷
 */

'use client';

import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { Locale } from '@/i18n/config';

const LOCALE_STORAGE_KEY = 'preferred-locale';

/**
 * 語言偏好管理 Hook
 */
export function useLocalePreference() {
  const { data: session, update: updateSession } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 獲取語言偏好
   *
   * 優先級：
   * 1. 資料庫偏好（已登入）
   * 2. LocalStorage
   * 3. null（使用瀏覽器偵測）
   */
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

  /**
   * 設置語言偏好
   *
   * 同時保存到 LocalStorage 和資料庫（如果已登入）
   */
  const setLocalePreference = useCallback(
    async (locale: Locale) => {
      setIsLoading(true);

      try {
        // 1. 保存到 LocalStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        }

        // 2. 如果已登入，保存到資料庫
        if (session?.user) {
          const response = await fetch('/api/v1/users/me/locale', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale }),
          });

          if (response.ok) {
            // 更新 session
            await updateSession({ preferredLocale: locale });
          }
        }
      } catch (error) {
        console.error('Failed to save locale preference:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [session, updateSession]
  );

  /**
   * 清除語言偏好（恢復預設）
   */
  const clearLocalePreference = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    }
  }, []);

  return {
    getLocalePreference,
    setLocalePreference,
    clearLocalePreference,
    isLoading,
  };
}
```

---

### Phase 2: 建立 API 端點 (30 min)

#### Step 2.1: 建立語言偏好更新 API

Create `src/app/api/v1/users/me/locale/route.ts`:

```typescript
/**
 * @fileoverview 用戶語言偏好 API
 * @description
 *   更新當前登入用戶的語言偏好設定。
 *
 * @module src/app/api/v1/users/me/locale
 * @author Development Team
 * @since Epic 17 - Story 17.5 (Language Preference Settings)
 * @lastModified 2026-01-16
 *
 * @api PATCH /api/v1/users/me/locale
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { locales } from '@/i18n/config';

// 驗證 Schema
const UpdateLocaleSchema = z.object({
  locale: z.enum(locales as unknown as [string, ...string[]]),
});

/**
 * PATCH /api/v1/users/me/locale
 * 更新用戶語言偏好
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. 驗證認證
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // 2. 解析和驗證請求
    const body = await request.json();
    const validationResult = UpdateLocaleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid locale value',
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { locale } = validationResult.data;

    // 3. 更新資料庫
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferredLocale: locale },
    });

    // 4. 返回成功
    return NextResponse.json({
      success: true,
      data: { locale },
    });
  } catch (error) {
    console.error('Failed to update locale preference:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to update locale preference',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/users/me/locale
 * 獲取用戶語言偏好
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferredLocale: true },
    });

    return NextResponse.json({
      success: true,
      data: { locale: user?.preferredLocale || 'en' },
    });
  } catch (error) {
    console.error('Failed to get locale preference:', error);
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to get locale preference',
      },
      { status: 500 }
    );
  }
}
```

---

### Phase 3: 整合到 Header 組件 (20 min)

#### Step 3.1: 更新 Header 組件

Update Header 組件以包含 LocaleSwitcher：

```typescript
// src/components/layouts/Header.tsx
'use client';

import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '@/components/features/locale/LocaleSwitcher';
import { UserMenu } from '@/components/features/user/UserMenu';
import { ThemeToggle } from '@/components/features/theme/ThemeToggle';

export function Header() {
  const t = useTranslations('navigation');

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Logo 和標題 */}
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">AI Document Extraction</h1>
        </div>

        {/* 右側工具欄 */}
        <div className="flex items-center gap-2">
          {/* 語言切換 */}
          <LocaleSwitcher />

          {/* 主題切換 */}
          <ThemeToggle />

          {/* 用戶菜單 */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
```

---

### Phase 4: SEO 優化 (30 min)

#### Step 4.1: 更新 Layout 添加 hreflang 標籤

SEO 優化已在 Story 17-1 的 Layout 中實現，這裡確保完整性：

```typescript
// src/app/[locale]/layout.tsx
import { locales, localeHtmlLang, type Locale } from '@/i18n/config';

export async function generateMetadata({ params: { locale } }: LocaleLayoutProps) {
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://example.com';

  return {
    title: {
      default: t('title'),
      template: `%s | ${t('title')}`,
    },
    description: t('description'),
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: Object.fromEntries(
        locales.map((loc) => [loc, `${baseUrl}/${loc}`])
      ),
    },
    openGraph: {
      locale: locale,
      alternateLocale: locales.filter((l) => l !== locale),
    },
  };
}
```

#### Step 4.2: 添加結構化 hreflang 標籤

在 Layout 的 `<head>` 中添加完整的 hreflang 標籤：

```typescript
// 在 LocaleLayout 組件的 return 中
<head>
  {/* hreflang 標籤 - 指向所有語言版本 */}
  {locales.map((loc) => (
    <link
      key={loc}
      rel="alternate"
      hrefLang={localeHtmlLang[loc]}
      href={`${process.env.NEXT_PUBLIC_APP_URL}/${loc}`}
    />
  ))}

  {/* x-default - 指向預設語言版本 */}
  <link
    rel="alternate"
    hrefLang="x-default"
    href={`${process.env.NEXT_PUBLIC_APP_URL}/en`}
  />
</head>
```

---

## Verification Checklist

### LocaleSwitcher Component Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 顯示在 Header | 載入頁面 | 語言切換按鈕可見 | [ ] |
| 顯示當前語言 | 查看下拉選單 | 當前語言有勾選標記 | [ ] |
| 切換語言 | 選擇不同語言 | 頁面內容即時切換 | [ ] |
| URL 更新 | 切換語言後 | URL 路徑包含新 locale | [ ] |

### Persistence Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| LocalStorage 保存 | 切換語言後刷新 | 保持選擇的語言 | [ ] |
| 資料庫保存（已登入） | 切換語言後登出 | API 請求成功 | [ ] |
| 跨設備同步 | 不同設備登入 | 載入資料庫中的偏好 | [ ] |

### SEO Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| HTML lang 屬性 | 檢視頁面源碼 | `<html lang="zh-Hant-TW">` 或對應語言 | [ ] |
| hreflang 標籤 | 檢視頁面源碼 | 包含所有語言版本的 hreflang | [ ] |
| x-default 標籤 | 檢視頁面源碼 | 包含 x-default 指向 /en | [ ] |
| canonical URL | 檢視頁面源碼 | canonical 包含當前 locale | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `prisma/schema.prisma` | 更新：添加 preferredLocale 欄位 |
| `src/components/features/locale/LocaleSwitcher.tsx` | 語言切換組件 |
| `src/hooks/use-locale-preference.ts` | 語言偏好管理 Hook |
| `src/app/api/v1/users/me/locale/route.ts` | 語言偏好 API |
| `src/components/layouts/Header.tsx` | 更新：整合 LocaleSwitcher |
| `src/app/[locale]/layout.tsx` | 更新：完善 SEO 標籤 |

---

## Dependencies

```bash
# 無需新增套件，使用現有的 next-intl 和 @prisma/client
npx prisma migrate dev --name add_user_preferred_locale
```

---

## Environment Variables

```bash
# .env
# 確保設置應用程式 URL（用於 hreflang 和 canonical）
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## Next Steps

完成 Story 17-5 後：
1. Epic 17 基本功能完成
2. 可考慮擴展其他模組的翻譯（P1、P2 優先級）
3. 可考慮整合翻譯管理平台（Crowdin/Lokalise）

---

*Generated by BMAD Method - Create Tech Spec Workflow*
