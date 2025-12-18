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
