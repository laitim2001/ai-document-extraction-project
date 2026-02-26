---
paths: src/**/*.{ts,tsx}
---

# TypeScript 開發規範

## 類型定義優先級
```typescript
// 1. 優先使用 interface（可擴展）
interface Document {
  id: string;
  fileName: string;
}

// 2. 使用 type 定義聯合類型
type Status = 'pending' | 'completed' | 'error';

// 3. 使用 Zod 進行運行時驗證
const DocumentSchema = z.object({
  id: z.string().cuid(),
  fileName: z.string().min(1),
});
```

## 嚴格模式規則
```typescript
// ❌ 禁止
function process(data: any) { }           // 禁止 any
const value = obj!.property;              // 避免非空斷言
function process(data) { }                // 禁止隱式 any

// ✅ 正確
function process(data: Document) { }      // 具體類型
const value = obj?.property ?? default;   // 可選鏈 + 空值合併
function process(data: unknown) {         // unknown + 類型守衛
  if (isDocument(data)) { ... }
}
```

## Import 順序
```typescript
// 1. React/Next.js
import * as React from 'react';
import { useRouter } from 'next/navigation';

// 2. 第三方庫
import { useForm } from 'react-hook-form';

// 3. 本地組件
import { Button } from '@/components/ui/button';

// 4. Hooks
import { useDocuments } from '@/hooks/use-documents';

// 5. Utils
import { cn } from '@/lib/utils';

// 6. Types
import type { Document } from '@/types/document';
```

## 類型守衛
```typescript
// 使用 Zod 進行類型守衛
function isValidDocument(value: unknown): value is Document {
  return DocumentSchema.safeParse(value).success;
}
```

## 泛型命名
- `T` - 一般類型
- `TData` - 數據類型
- `TError` - 錯誤類型
- `K extends keyof T` - 鍵類型

## i18n 類型支援

### Locale 類型

```typescript
import type { Locale } from '@/i18n/config';

// Locale 類型為 'en' | 'zh-TW' | 'zh-CN'
function formatByLocale(date: Date, locale: Locale): string {
  // ...
}
```

### 翻譯函數類型

```typescript
// 取得翻譯函數類型
type TranslateFunction = ReturnType<typeof useTranslations>;

// 在 Props 中傳遞翻譯函數
interface ComponentProps {
  t: TranslateFunction;
}
```

### 格式化函數參數

```typescript
import type { Locale } from '@/i18n/config';

// 所有格式化函數接受 Locale 類型
function formatDate(date: Date | string | number, locale: Locale): string;
function formatNumber(value: number, locale: Locale): string;
function formatCurrency(value: number, currency: string, locale: Locale): string;
```

### 訊息命名空間類型

```typescript
// 使用 namespace 限制翻譯範圍
const t = useTranslations('common');      // 只能訪問 common.* keys
const tNav = useTranslations('navigation'); // 只能訪問 navigation.* keys
```
