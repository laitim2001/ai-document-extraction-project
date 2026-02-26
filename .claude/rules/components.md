---
paths: src/components/**/*.tsx, src/app/**/*.tsx
---

# React 組件開發規範

## 組件分類
| 類型 | 位置 | 說明 |
|------|------|------|
| UI 組件 | `src/components/ui/` | shadcn/ui 基礎組件（不修改） |
| 功能組件 | `src/components/features/` | 業務功能組件 |
| 佈局組件 | `src/components/layouts/` | 頁面佈局 |

## 組件文件結構

```typescript
'use client';  // 如果需要客戶端互動

/**
 * @fileoverview [組件功能描述]
 * @module src/components/features/[name]
 * @since Epic X - Story X.X
 */

import * as React from 'react';
// ... imports

// ============================================================
// Types
// ============================================================

interface ComponentProps {
  // props 定義
}

// ============================================================
// Component
// ============================================================

/**
 * @component ComponentName
 * @description 組件描述
 */
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // --- Hooks ---

  // --- State ---

  // --- Effects ---

  // --- Handlers ---

  // --- Render ---
  return (
    <div>...</div>
  );
}
```

## Server vs Client Components

```typescript
// Server Component（預設）- 數據獲取
// src/app/documents/page.tsx
import { prisma } from '@/lib/prisma';

export default async function DocumentsPage() {
  const documents = await prisma.document.findMany();
  return <DocumentList documents={documents} />;
}

// Client Component - 互動邏輯
// src/components/features/document-list.tsx
'use client';

export function DocumentList({ documents }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  // 互動邏輯...
}
```

## 狀態管理

```typescript
// UI 狀態 - Zustand
import { useUIStore } from '@/stores/ui-store';

// 伺服器狀態 - React Query
import { useDocuments } from '@/hooks/use-documents';

// 表單狀態 - React Hook Form
import { useForm } from 'react-hook-form';
```

## 國際化（i18n）

### 翻譯使用

```typescript
'use client';

import { useTranslations, useLocale } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('namespace');
  const locale = useLocale();

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description', { count: 5 })}</p>
    </div>
  );
}
```

### 路由導航

```typescript
// ✅ 使用 i18n-aware 路由
import { Link, useRouter, usePathname } from '@/i18n/routing';

// ❌ 不要直接使用 next/link（會失去 locale 前綴）
import Link from 'next/link';  // 避免
```

### 日期/數字格式化

```typescript
import { formatShortDate, formatRelativeTime } from '@/lib/i18n-date';
import { formatNumber, formatPercent } from '@/lib/i18n-number';

// 使用當前 locale 進行格式化
formatShortDate(date, locale);     // 2026/01/18
formatNumber(1234567, locale);     // 1,234,567
```

> **完整規範**: 請參考 `.claude/rules/i18n.md`

## shadcn/ui 組件使用

```typescript
// 使用 cn() 合併類名
import { cn } from '@/lib/utils';

<Button
  className={cn(
    'base-styles',
    isActive && 'active-styles',
    className
  )}
/>
```

## 注意事項
- ❌ 不要修改 `src/components/ui/` 下的 shadcn 組件
- ✅ 如需自定義，在 `src/components/features/` 建立包裝組件
- ✅ 組件保持在 300 行以內
- ✅ 使用 `useMemo` / `useCallback` 優化性能

## 重要變更記錄

### REFACTOR-001: Forwarders → Companies 組件重構
- **變更日期**: 2025-12-24 (Story 0-3)
- **說明**: 將 `features/forwarders/` 重構為 `features/companies/`
- **影響**: 所有涉及 Forwarder 的組件、Props、Hook 均已更新
- **舊目錄**: `src/components/features/forwarders/`
- **新目錄**: `src/components/features/companies/`

> **注意**: 完整組件列表請參考 `src/components/CLAUDE.md`
