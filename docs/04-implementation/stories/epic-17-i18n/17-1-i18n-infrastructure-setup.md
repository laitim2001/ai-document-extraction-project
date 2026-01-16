# Story 17.1: i18n 基礎架構設置

**Status:** ready-for-dev

---

## Story

**As a** 開發團隊,
**I want** 建立完整的國際化基礎架構,
**So that** 應用程式可以支援多語言切換，為後續 UI 文字國際化奠定基礎。

---

## Acceptance Criteria

### AC1: next-intl 套件安裝與配置

**Given** 專案尚未安裝任何 i18n 框架
**When** 開發者執行套件安裝和配置
**Then** next-intl 套件成功安裝
**And** TypeScript 類型支援正常運作
**And** 無任何建置錯誤

### AC2: 語言路由結構重構

**Given** 現有路由結構為 `/invoices`, `/review` 等
**When** 完成路由重構
**Then** 新路由結構為 `/[locale]/invoices`, `/[locale]/review` 等
**And** 支援 `zh-TW`, `en`, `zh-CN` 三種語言
**And** 預設語言為 `en`（英文）
**And** 舊路徑自動重定向到預設語言路徑

### AC3: 翻譯檔案結構建立

**Given** 需要支援模組化的翻譯管理
**When** 建立翻譯檔案結構
**Then** 建立 `messages/` 目錄，包含 `zh-TW/`, `en/`, `zh-CN/` 子目錄
**And** 每個語言目錄包含 `common.json` 基礎翻譯檔案
**And** 支援命名空間載入（如 `admin/users.json`）

### AC4: i18n Provider 整合

**Given** 應用程式使用 `RootLayout` 作為根佈局
**When** 整合 i18n Provider
**Then** 所有頁面可透過 `useTranslations` hook 取得翻譯
**And** Server Components 可透過 `getTranslations` 取得翻譯
**And** 語言切換後頁面內容即時更新

### AC5: Middleware 語言偵測

**Given** 用戶首次訪問網站
**When** Middleware 處理請求
**Then** 根據 `Accept-Language` header 偵測偏好語言
**And** 若未偵測到支援語言，使用預設語言 `en`
**And** 設置 cookie 記錄語言偏好

---

## Tasks / Subtasks

- [ ] **Task 1: 安裝 next-intl 套件** (AC: #1)
  - [ ] 1.1 執行 `npm install next-intl`
  - [ ] 1.2 驗證 TypeScript 類型支援
  - [ ] 1.3 更新 package.json 記錄

- [ ] **Task 2: 建立 i18n 配置檔案** (AC: #1, #3)
  - [ ] 2.1 建立 `src/i18n/config.ts` - 語言配置常數
  - [ ] 2.2 建立 `src/i18n/request.ts` - Server-side locale 請求
  - [ ] 2.3 建立 `src/i18n/routing.ts` - 路由配置

- [ ] **Task 3: 建立翻譯檔案結構** (AC: #3)
  - [ ] 3.1 建立 `messages/zh-TW/common.json`
  - [ ] 3.2 建立 `messages/en/common.json`
  - [ ] 3.3 建立 `messages/zh-CN/common.json`
  - [ ] 3.4 建立基礎翻譯內容（按鈕、狀態、分頁等）

- [ ] **Task 4: 路由結構重構** (AC: #2)
  - [ ] 4.1 建立 `src/app/[locale]/layout.tsx`
  - [ ] 4.2 移動 `(auth)` 路由到 `[locale]/(auth)`
  - [ ] 4.3 移動 `(dashboard)` 路由到 `[locale]/(dashboard)`
  - [ ] 4.4 更新所有內部連結使用 locale-aware 路徑

- [ ] **Task 5: 配置 Middleware** (AC: #5)
  - [ ] 5.1 建立/更新 `src/middleware.ts`
  - [ ] 5.2 實作語言偵測邏輯
  - [ ] 5.3 實作舊路徑重定向

- [ ] **Task 6: 更新 next.config.ts** (AC: #1, #2)
  - [ ] 6.1 添加 next-intl plugin 配置
  - [ ] 6.2 配置 i18n 設定

- [ ] **Task 7: 整合測試** (AC: #1-5)
  - [ ] 7.1 驗證 `npm run build` 無錯誤
  - [ ] 7.2 驗證各語言路徑可正常訪問
  - [ ] 7.3 驗證語言切換功能正常

---

## Dev Notes

### 依賴項

- 無前置 Story 依賴（此為 Epic 17 第一個 Story）

### Project Structure Notes

```
src/
├── i18n/
│   ├── config.ts              # 語言配置常數
│   ├── request.ts             # Server-side locale 請求
│   └── routing.ts             # 路由配置
│
├── messages/                   # 翻譯檔案（專案根目錄）
│   ├── zh-TW/
│   │   └── common.json
│   ├── en/
│   │   └── common.json
│   └── zh-CN/
│       └── common.json
│
├── app/
│   └── [locale]/              # 語言動態路由
│       ├── layout.tsx         # 語言感知佈局
│       ├── (auth)/
│       │   └── auth/login/
│       └── (dashboard)/
│           ├── invoices/
│           ├── review/
│           └── ...
│
└── middleware.ts              # 語言偵測中間件
```

### Architecture Compliance

#### i18n 配置常數

```typescript
// src/i18n/config.ts
export const locales = ['en', 'zh-TW', 'zh-CN'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  'en': 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
};
```

#### next-intl 請求配置

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale } from './config';

export default getRequestConfig(async ({ locale }) => {
  // Validate locale
  if (!locales.includes(locale as any)) {
    locale = defaultLocale;
  }

  return {
    messages: (await import(`../../messages/${locale}/common.json`)).default,
  };
});
```

#### Middleware 配置

```typescript
// src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
});

export const config = {
  matcher: ['/', '/(zh-TW|en|zh-CN)/:path*', '/((?!api|_next|.*\\..*).*)'],
};
```

### Environment Variables

```bash
# 無需新增環境變數
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| `npm run build` | 無錯誤完成 |
| 訪問 `/` | 重定向到 `/en` |
| 訪問 `/invoices` | 重定向到 `/en/invoices` |
| 訪問 `/zh-TW/invoices` | 正常顯示頁面 |
| 訪問 `/en/invoices` | 正常顯示頁面 |
| `Accept-Language: zh-TW` 訪問 `/` | 重定向到 `/zh-TW` |

### References

- [Source: next-intl 官方文檔](https://next-intl-docs.vercel.app/)
- [Source: docs/CLAUDE.md] - 專案技術棧和開發規範

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 17.1 |
| Story Key | 17-1-i18n-infrastructure-setup |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Large (8-12h) |
| Dependencies | 無 |
| Blocking | Story 17.2, 17.3, 17.4, 17.5 |

---

*Story created: 2026-01-16*
*Status: ready-for-dev*
