# Story 17-3: 驗證訊息與錯誤處理國際化 - Technical Specification

**Version:** 1.1
**Created:** 2026-01-16
**Updated:** 2026-01-16
**Status:** Ready for Development
**Story Key:** 17-3-validation-error-internationalization

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 17.3 |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Large (10-14h) |
| Dependencies | Story 17.1 |
| Blocking | 無 |

---

## Objective

將 Zod 驗證訊息和 API 錯誤響應國際化，確保用戶在操作失敗時能以其偏好語言理解錯誤原因。預計處理約 **200-250 個翻譯字串**：

| 類別 | 預估字串數 | 說明 |
|------|-----------|------|
| 通用驗證訊息 | 25-30 | required, minLength, email 等 |
| API 標準錯誤 | 16-20 | 401, 403, 404, 500 等 |
| **業務級錯誤** | 30-40 | OCR、映射、處理相關錯誤 (NEW) |
| 網路/認證錯誤 | 10-15 | 連線、token、session 錯誤 |
| Toast 通知 | 15-20 | 成功、失敗、警告訊息 |

> **Version 1.1 更新**：根據深度覆蓋分析，新增 9 個業務級錯誤類型和 5 個額外 Zod 驗證訊息。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Zod 驗證訊息國際化 | 整合 Zod 4.x locales、建立 useLocalizedZod hook |
| AC2 | API 錯誤響應國際化 | 建立 createLocalizedError 函數、解析 Accept-Language |
| AC3 | Toast 通知國際化 | 建立 useLocalizedToast hook、更新現有調用 |
| AC4 | 驗證訊息標準化 | 建立 validation.json 翻譯檔案、定義標準 key |
| **AC5** | **業務錯誤國際化** | 新增 9 個業務級錯誤類型翻譯 (NEW) |
| **AC6** | **擴展驗證訊息** | 新增日期、CUID、整數驗證訊息 (NEW) |

---

## Implementation Guide

### Phase 1: 建立驗證與錯誤翻譯檔案 (30 min)

#### Step 1.1: 建立驗證訊息翻譯檔案

Create `messages/zh-TW/validation.json`:

```json
{
  "required": "{field}不能為空",
  "requiredField": "此欄位為必填",
  "minLength": "{field}至少需要 {min} 個字元",
  "maxLength": "{field}不能超過 {max} 個字元",
  "min": "{field}不能小於 {min}",
  "max": "{field}不能大於 {max}",
  "email": "請輸入有效的電郵地址",
  "url": "請輸入有效的網址",
  "uuid": "請輸入有效的 UUID",
  "regex": "{field}格式不正確",
  "pattern": "{field}格式不符合要求",
  "unique": "{field}已存在",
  "notFound": "{field}不存在",
  "invalid": "請選擇有效的{field}",
  "invalidType": "資料類型不正確",
  "invalidEnum": "請選擇有效的選項",
  "positiveInteger": "{field}必須為正整數",
  "nonNegative": "{field}不能為負數",
  "arrayMinLength": "至少需要 {min} 個項目",
  "arrayMaxLength": "最多只能有 {max} 個項目",
  "dateInvalid": "請輸入有效的日期",
  "dateMin": "日期不能早於 {min}",
  "dateMax": "日期不能晚於 {max}",
  "integer": "{field}必須為整數",
  "cuid": "請輸入有效的 CUID",
  "fileTooLarge": "檔案大小不能超過 {max}MB",
  "fileTypeNotAllowed": "不支援的檔案類型",
  "custom": {
    "fieldNameUnique": "欄位名稱必須唯一",
    "companyRequired": "公司範圍需要選擇公司",
    "formatRequired": "格式範圍需要選擇格式",
    "atLeastOneField": "至少需要定義一個欄位",
    "passwordMismatch": "密碼不一致",
    "invalidCredentials": "帳號或密碼錯誤"
  }
}
```

Create `messages/en/validation.json`:

```json
{
  "required": "{field} is required",
  "requiredField": "This field is required",
  "minLength": "{field} must be at least {min} characters",
  "maxLength": "{field} cannot exceed {max} characters",
  "min": "{field} must be at least {min}",
  "max": "{field} cannot exceed {max}",
  "email": "Please enter a valid email address",
  "url": "Please enter a valid URL",
  "uuid": "Please enter a valid UUID",
  "regex": "{field} format is invalid",
  "pattern": "{field} does not match the required pattern",
  "unique": "{field} already exists",
  "notFound": "{field} not found",
  "invalid": "Please select a valid {field}",
  "invalidType": "Invalid data type",
  "invalidEnum": "Please select a valid option",
  "positiveInteger": "{field} must be a positive integer",
  "nonNegative": "{field} cannot be negative",
  "arrayMinLength": "At least {min} items required",
  "arrayMaxLength": "Maximum {max} items allowed",
  "dateInvalid": "Please enter a valid date",
  "dateMin": "Date cannot be before {min}",
  "dateMax": "Date cannot be after {max}",
  "integer": "{field} must be an integer",
  "cuid": "Please enter a valid CUID",
  "fileTooLarge": "File size cannot exceed {max}MB",
  "fileTypeNotAllowed": "File type not supported",
  "custom": {
    "fieldNameUnique": "Field name must be unique",
    "companyRequired": "Company is required for company scope",
    "formatRequired": "Format is required for format scope",
    "atLeastOneField": "At least one field is required",
    "passwordMismatch": "Passwords do not match",
    "invalidCredentials": "Invalid email or password"
  }
}
```

#### Step 1.2: 建立錯誤訊息翻譯檔案

Create `messages/zh-TW/errors.json`:

```json
{
  "api": {
    "unauthorized": {
      "title": "未授權",
      "detail": "您需要登入才能執行此操作"
    },
    "forbidden": {
      "title": "存取被拒",
      "detail": "您沒有權限執行此操作"
    },
    "notFound": {
      "title": "找不到資源",
      "detail": "請求的資源不存在或已被刪除"
    },
    "validation": {
      "title": "驗證錯誤",
      "detail": "請檢查輸入的資料是否正確"
    },
    "conflict": {
      "title": "資源衝突",
      "detail": "操作與現有資源發生衝突"
    },
    "rateLimit": {
      "title": "請求過於頻繁",
      "detail": "請稍後再試"
    },
    "internal": {
      "title": "伺服器錯誤",
      "detail": "伺服器發生內部錯誤，請稍後再試"
    },
    "serviceUnavailable": {
      "title": "服務暫時不可用",
      "detail": "系統正在維護中，請稍後再試"
    }
  },
  "network": {
    "connectionFailed": "無法連接伺服器，請檢查網路連線",
    "timeout": "請求逾時，請重試",
    "offline": "您目前處於離線狀態"
  },
  "auth": {
    "sessionExpired": "您的登入已過期，請重新登入",
    "invalidToken": "無效的認證令牌",
    "accountDisabled": "您的帳戶已被停用"
  },
  "business": {
    "variableResolution": {
      "title": "變數解析失敗",
      "detail": "無法解析 Prompt 模板中的變數：{variable}"
    },
    "identificationFailed": {
      "title": "文件識別失敗",
      "detail": "無法識別文件類型或公司，請確認文件格式正確"
    },
    "extractionFailed": {
      "title": "資料提取失敗",
      "detail": "OCR 提取過程發生錯誤：{reason}"
    },
    "mappingNotFound": {
      "title": "映射規則不存在",
      "detail": "找不到適用的映射規則：{field}"
    },
    "configurationError": {
      "title": "配置錯誤",
      "detail": "系統配置不完整或無效：{config}"
    },
    "processingTimeout": {
      "title": "處理逾時",
      "detail": "文件處理超過時限（{timeout}秒），請稍後重試"
    },
    "duplicateEntry": {
      "title": "重複記錄",
      "detail": "已存在相同的{entity}記錄"
    },
    "dependencyError": {
      "title": "依賴關係錯誤",
      "detail": "無法刪除，尚有{count}個相關記錄依賴此項目"
    },
    "dataIntegrity": {
      "title": "資料完整性錯誤",
      "detail": "資料驗證失敗：{reason}"
    }
  }
}
```

Create `messages/en/errors.json`:

```json
{
  "api": {
    "unauthorized": {
      "title": "Unauthorized",
      "detail": "You need to sign in to perform this action"
    },
    "forbidden": {
      "title": "Access Denied",
      "detail": "You do not have permission to perform this action"
    },
    "notFound": {
      "title": "Not Found",
      "detail": "The requested resource was not found"
    },
    "validation": {
      "title": "Validation Error",
      "detail": "Please check your input data"
    },
    "conflict": {
      "title": "Resource Conflict",
      "detail": "The operation conflicts with existing resources"
    },
    "rateLimit": {
      "title": "Too Many Requests",
      "detail": "Please try again later"
    },
    "internal": {
      "title": "Server Error",
      "detail": "An internal server error occurred. Please try again later"
    },
    "serviceUnavailable": {
      "title": "Service Unavailable",
      "detail": "The system is under maintenance. Please try again later"
    }
  },
  "network": {
    "connectionFailed": "Unable to connect to server. Please check your network",
    "timeout": "Request timed out. Please try again",
    "offline": "You are currently offline"
  },
  "auth": {
    "sessionExpired": "Your session has expired. Please sign in again",
    "invalidToken": "Invalid authentication token",
    "accountDisabled": "Your account has been disabled"
  },
  "business": {
    "variableResolution": {
      "title": "Variable Resolution Failed",
      "detail": "Unable to resolve variable in Prompt template: {variable}"
    },
    "identificationFailed": {
      "title": "Document Identification Failed",
      "detail": "Unable to identify document type or company. Please verify the document format"
    },
    "extractionFailed": {
      "title": "Data Extraction Failed",
      "detail": "OCR extraction process encountered an error: {reason}"
    },
    "mappingNotFound": {
      "title": "Mapping Rule Not Found",
      "detail": "No applicable mapping rule found for: {field}"
    },
    "configurationError": {
      "title": "Configuration Error",
      "detail": "System configuration is incomplete or invalid: {config}"
    },
    "processingTimeout": {
      "title": "Processing Timeout",
      "detail": "Document processing exceeded time limit ({timeout}s). Please try again later"
    },
    "duplicateEntry": {
      "title": "Duplicate Entry",
      "detail": "A {entity} with the same data already exists"
    },
    "dependencyError": {
      "title": "Dependency Error",
      "detail": "Cannot delete. {count} related records depend on this item"
    },
    "dataIntegrity": {
      "title": "Data Integrity Error",
      "detail": "Data validation failed: {reason}"
    }
  }
}
```

---

### Phase 2: 建立 Zod 國際化工具 (45 min)

#### Step 2.1: 建立 Zod 錯誤映射工具

Create `src/lib/i18n-zod.ts`:

```typescript
/**
 * @fileoverview Zod 驗證訊息國際化工具
 * @description
 *   提供 Zod schema 驗證訊息的國際化支援，包括：
 *   - 自定義錯誤映射（Error Map）
 *   - 欄位名稱翻譯
 *   - 帶參數的訊息替換
 *
 * @module src/lib/i18n-zod
 * @author Development Team
 * @since Epic 17 - Story 17.3 (Validation Internationalization)
 * @lastModified 2026-01-16
 *
 * @features
 *   - Zod ErrorMap 自定義
 *   - 變數替換 ({field}, {min}, {max})
 *   - 支援 Server 和 Client 端
 *
 * @dependencies
 *   - zod - Schema 驗證
 *   - next-intl - 國際化框架
 */

import { z, ZodIssueCode, type ZodErrorMap } from 'zod';

/**
 * 翻譯函數類型（支援變數替換）
 */
type TranslateFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * 建立 Zod 錯誤映射
 *
 * @param t - 翻譯函數（來自 useTranslations 或 getTranslations）
 * @param fieldLabels - 欄位名稱映射（可選）
 * @returns Zod ErrorMap
 *
 * @example
 * const t = useTranslations('validation');
 * const errorMap = createZodErrorMap(t, { name: '名稱', email: '電郵' });
 * const schema = z.object({ name: z.string() }).setErrorMap(errorMap);
 */
export function createZodErrorMap(
  t: TranslateFunction,
  fieldLabels?: Record<string, string>
): ZodErrorMap {
  return (issue, ctx) => {
    const field = fieldLabels?.[String(ctx.path[0])] || ctx.defaultError;

    let message: string;

    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === 'undefined' || issue.received === 'null') {
          message = t('required', { field });
        } else {
          message = t('invalidType');
        }
        break;

      case ZodIssueCode.too_small:
        if (issue.type === 'string') {
          message = issue.minimum === 1
            ? t('required', { field })
            : t('minLength', { field, min: String(issue.minimum) });
        } else if (issue.type === 'array') {
          message = t('arrayMinLength', { min: String(issue.minimum) });
        } else {
          message = t('min', { field, min: String(issue.minimum) });
        }
        break;

      case ZodIssueCode.too_big:
        if (issue.type === 'string') {
          message = t('maxLength', { field, max: String(issue.maximum) });
        } else if (issue.type === 'array') {
          message = t('arrayMaxLength', { max: String(issue.maximum) });
        } else {
          message = t('max', { field, max: String(issue.maximum) });
        }
        break;

      case ZodIssueCode.invalid_string:
        if (issue.validation === 'email') {
          message = t('email');
        } else if (issue.validation === 'url') {
          message = t('url');
        } else if (issue.validation === 'uuid') {
          message = t('uuid');
        } else if (issue.validation === 'regex') {
          message = t('regex', { field });
        } else {
          message = t('pattern', { field });
        }
        break;

      case ZodIssueCode.invalid_enum_value:
        message = t('invalidEnum');
        break;

      case ZodIssueCode.invalid_date:
        message = t('dateInvalid');
        break;

      case ZodIssueCode.custom:
        // 自定義錯誤使用 issue.message 作為翻譯 key
        if (issue.message && issue.message.startsWith('custom.')) {
          message = t(issue.message);
        } else {
          message = issue.message || t('invalid', { field });
        }
        break;

      default:
        message = ctx.defaultError;
    }

    return { message };
  };
}

/**
 * 建立帶國際化的 Zod Schema
 *
 * @param schema - 原始 Zod Schema
 * @param t - 翻譯函數
 * @param fieldLabels - 欄位名稱映射
 * @returns 設置了 ErrorMap 的 Schema
 */
export function withI18n<T extends z.ZodTypeAny>(
  schema: T,
  t: TranslateFunction,
  fieldLabels?: Record<string, string>
): T {
  const errorMap = createZodErrorMap(t, fieldLabels);
  // @ts-expect-error - setErrorMap 返回類型不完全正確
  return schema.superRefine(() => {}).errorMap(errorMap);
}
```

#### Step 2.2: 建立 useLocalizedZod Hook

Create `src/hooks/use-localized-zod.ts`:

```typescript
/**
 * @fileoverview 國際化 Zod 驗證 Hook
 * @description
 *   提供簡化的 API 來建立帶國際化支援的 Zod Schema。
 *   自動使用當前語言的翻譯。
 *
 * @module src/hooks/use-localized-zod
 * @author Development Team
 * @since Epic 17 - Story 17.3 (Validation Internationalization)
 * @lastModified 2026-01-16
 */

'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';
import { createZodErrorMap } from '@/lib/i18n-zod';

/**
 * 國際化 Zod 驗證 Hook
 *
 * @returns 工具函數和 ErrorMap
 *
 * @example
 * function MyForm() {
 *   const { errorMap, createSchema } = useLocalizedZod();
 *
 *   const schema = useMemo(() =>
 *     z.object({
 *       name: z.string().min(1),
 *       email: z.string().email(),
 *     }).setErrorMap(errorMap),
 *     [errorMap]
 *   );
 *
 *   // 使用 schema 進行表單驗證
 * }
 */
export function useLocalizedZod(fieldLabels?: Record<string, string>) {
  const t = useTranslations('validation');

  const errorMap = useMemo(
    () => createZodErrorMap(t, fieldLabels),
    [t, fieldLabels]
  );

  const createSchema = useCallback(
    <T extends z.ZodRawShape>(shape: T) => {
      return z.object(shape).superRefine(() => {});
    },
    []
  );

  return {
    errorMap,
    createSchema,
    t,
  };
}

/**
 * 欄位標籤定義（常用欄位）
 */
export const COMMON_FIELD_LABELS = {
  'zh-TW': {
    name: '名稱',
    email: '電郵',
    password: '密碼',
    confirmPassword: '確認密碼',
    phone: '電話',
    description: '描述',
    companyId: '公司',
    formatId: '格式',
    fieldName: '欄位名稱',
    displayLabel: '顯示標籤',
  },
  'en': {
    name: 'Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    phone: 'Phone',
    description: 'Description',
    companyId: 'Company',
    formatId: 'Format',
    fieldName: 'Field Name',
    displayLabel: 'Display Label',
  },
} as const;
```

---

### Phase 3: 建立 API 錯誤國際化工具 (45 min)

#### Step 3.1: 建立國際化錯誤響應工具

Create `src/lib/i18n-api-error.ts`:

```typescript
/**
 * @fileoverview API 錯誤響應國際化工具
 * @description
 *   提供國際化的 RFC 7807 格式錯誤響應。
 *   根據請求的 Accept-Language header 返回對應語言的錯誤訊息。
 *
 * @module src/lib/i18n-api-error
 * @author Development Team
 * @since Epic 17 - Story 17.3 (Validation Internationalization)
 * @lastModified 2026-01-16
 *
 * @features
 *   - RFC 7807 Problem Details 格式
 *   - Accept-Language header 解析
 *   - 欄位級錯誤支援
 *
 * @dependencies
 *   - next-intl/server - Server-side 翻譯
 */

import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { locales, defaultLocale, isValidLocale, type Locale } from '@/i18n/config';

/**
 * 錯誤類型定義
 */
export type ApiErrorType =
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'conflict'
  | 'rateLimit'
  | 'internal'
  | 'serviceUnavailable';

/**
 * RFC 7807 Problem Details 格式
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

/**
 * 錯誤類型到 HTTP 狀態碼映射
 */
const ERROR_STATUS_MAP: Record<ApiErrorType, number> = {
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  validation: 400,
  conflict: 409,
  rateLimit: 429,
  internal: 500,
  serviceUnavailable: 503,
};

/**
 * 從 Accept-Language header 解析語言
 */
function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;

  const preferredLocales = header
    .split(',')
    .map((lang) => lang.split(';')[0].trim());

  for (const preferred of preferredLocales) {
    // 完全匹配
    if (isValidLocale(preferred)) {
      return preferred as Locale;
    }
    // 語言代碼匹配（如 zh 匹配 zh-TW）
    const langCode = preferred.split('-')[0];
    const matched = locales.find((l) => l.startsWith(langCode));
    if (matched) {
      return matched;
    }
  }

  return defaultLocale;
}

/**
 * 建立國際化錯誤響應
 *
 * @param errorType - 錯誤類型
 * @param options - 選項
 * @returns NextResponse 包含國際化錯誤訊息
 *
 * @example
 * // 在 API route 中使用
 * export async function GET() {
 *   const user = await getUser();
 *   if (!user) {
 *     return createLocalizedError('notFound', {
 *       instance: '/api/v1/users/123',
 *     });
 *   }
 * }
 */
export async function createLocalizedError(
  errorType: ApiErrorType,
  options?: {
    instance?: string;
    errors?: Record<string, string[]>;
    detail?: string;
  }
): Promise<NextResponse<ProblemDetails>> {
  const headersList = headers();
  const acceptLanguage = headersList.get('accept-language');
  const locale = parseAcceptLanguage(acceptLanguage);

  const t = await getTranslations({ locale, namespace: 'errors' });

  const status = ERROR_STATUS_MAP[errorType];
  const title = t(`api.${errorType}.title`);
  const detail = options?.detail || t(`api.${errorType}.detail`);

  const problemDetails: ProblemDetails = {
    type: `https://api.example.com/errors/${errorType}`,
    title,
    status,
    detail,
    ...(options?.instance && { instance: options.instance }),
    ...(options?.errors && { errors: options.errors }),
  };

  return NextResponse.json(problemDetails, { status });
}

/**
 * 建立驗證錯誤響應
 *
 * @param fieldErrors - 欄位錯誤映射
 * @param instance - 請求實例路徑
 * @returns NextResponse 包含驗證錯誤詳情
 */
export async function createValidationError(
  fieldErrors: Record<string, string[]>,
  instance?: string
): Promise<NextResponse<ProblemDetails>> {
  return createLocalizedError('validation', {
    instance,
    errors: fieldErrors,
  });
}
```

---

### Phase 4: 建立 Toast 國際化 Hook (30 min)

#### Step 4.1: 建立 useLocalizedToast Hook

Create `src/hooks/use-localized-toast.ts`:

```typescript
/**
 * @fileoverview 國際化 Toast 通知 Hook
 * @description
 *   提供國際化的 Toast 通知功能，自動使用當前語言的翻譯。
 *
 * @module src/hooks/use-localized-toast
 * @author Development Team
 * @since Epic 17 - Story 17.3 (Validation Internationalization)
 * @lastModified 2026-01-16
 */

'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast as sonnerToast } from 'sonner';

/**
 * Toast 類型
 */
type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Toast 選項
 */
interface ToastOptions {
  /** 自定義描述（覆蓋預設翻譯） */
  description?: string;
  /** 持續時間（毫秒） */
  duration?: number;
  /** 操作按鈕 */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * 國際化 Toast 通知 Hook
 *
 * @returns Toast 函數集合
 *
 * @example
 * function MyComponent() {
 *   const toast = useLocalizedToast();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       toast.saved(); // 顯示「已保存」或「Saved」
 *     } catch {
 *       toast.error(); // 顯示「操作失敗」或「Operation failed」
 *     }
 *   };
 * }
 */
export function useLocalizedToast() {
  const t = useTranslations('toast');
  const tErrors = useTranslations('errors');

  const showToast = useCallback(
    (type: ToastType, key: string, options?: ToastOptions) => {
      const title = t(key);
      const toastFn = type === 'error' ? sonnerToast.error : sonnerToast.success;

      toastFn(title, {
        description: options?.description,
        duration: options?.duration || 4000,
        action: options?.action
          ? {
              label: options.action.label,
              onClick: options.action.onClick,
            }
          : undefined,
      });
    },
    [t]
  );

  return {
    /** 操作成功 */
    success: (options?: ToastOptions) => showToast('success', 'success', options),

    /** 操作失敗 */
    error: (options?: ToastOptions) => showToast('error', 'error', options),

    /** 已保存 */
    saved: (options?: ToastOptions) => showToast('success', 'saved', options),

    /** 已刪除 */
    deleted: (options?: ToastOptions) => showToast('success', 'deleted', options),

    /** 已更新 */
    updated: (options?: ToastOptions) => showToast('success', 'updated', options),

    /** 已建立 */
    created: (options?: ToastOptions) => showToast('success', 'created', options),

    /** 已複製 */
    copied: (options?: ToastOptions) => showToast('success', 'copied', options),

    /** 網路錯誤 */
    networkError: () => {
      sonnerToast.error(tErrors('network.connectionFailed'));
    },

    /** 自定義 Toast */
    custom: (
      type: ToastType,
      title: string,
      options?: Omit<ToastOptions, 'description'>
    ) => {
      const toastFn =
        type === 'error'
          ? sonnerToast.error
          : type === 'warning'
            ? sonnerToast.warning
            : type === 'info'
              ? sonnerToast.info
              : sonnerToast.success;

      toastFn(title, {
        duration: options?.duration || 4000,
        action: options?.action,
      });
    },
  };
}
```

---

## Verification Checklist

### Validation Message Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 必填欄位（zh-TW） | 提交空白表單 | 顯示「欄位名稱不能為空」 | [ ] |
| 必填欄位（en） | 提交空白表單 | 顯示「Field name is required」 | [ ] |
| 長度驗證 | 輸入過長文字 | 顯示對應語言的長度錯誤 | [ ] |
| Email 驗證 | 輸入無效 email | 顯示對應語言的格式錯誤 | [ ] |
| 自定義錯誤 | 觸發自定義驗證 | 顯示對應語言的自定義訊息 | [ ] |

### API Error Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 401 錯誤（zh-TW） | Accept-Language: zh-TW | title: 「未授權」 | [ ] |
| 401 錯誤（en） | Accept-Language: en | title: 「Unauthorized」 | [ ] |
| 驗證錯誤 | 提交無效資料 | 返回國際化欄位錯誤 | [ ] |
| 404 錯誤 | 訪問不存在資源 | 返回國際化錯誤訊息 | [ ] |

### Business Error Verification (NEW)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| OCR 提取失敗（zh-TW） | 上傳無法識別的文件 | 「資料提取失敗」 | [ ] |
| OCR 提取失敗（en） | 上傳無法識別的文件 | 「Data Extraction Failed」 | [ ] |
| 映射規則不存在 | 遇到未知費用類型 | 顯示對應語言的錯誤 | [ ] |
| 處理逾時 | 處理大型文件超時 | 顯示對應語言的逾時訊息 | [ ] |
| 重複記錄 | 建立重複的公司代碼 | 顯示對應語言的重複訊息 | [ ] |
| 依賴關係錯誤 | 刪除有依賴的記錄 | 顯示對應語言的依賴錯誤 | [ ] |

### Toast Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 保存成功（zh-TW） | 保存資料 | 顯示「已保存」 | [ ] |
| 保存成功（en） | 保存資料 | 顯示「Saved」 | [ ] |
| 刪除成功 | 刪除項目 | 顯示對應語言的成功訊息 | [ ] |
| 網路錯誤 | 模擬網路失敗 | 顯示對應語言的錯誤訊息 | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `messages/zh-TW/validation.json` | 驗證訊息繁體中文翻譯 |
| `messages/en/validation.json` | 驗證訊息英文翻譯 |
| `messages/zh-TW/errors.json` | 錯誤訊息繁體中文翻譯 |
| `messages/en/errors.json` | 錯誤訊息英文翻譯 |
| `src/lib/i18n-zod.ts` | Zod 國際化工具 |
| `src/lib/i18n-api-error.ts` | API 錯誤國際化工具 |
| `src/hooks/use-localized-zod.ts` | 國際化 Zod Hook |
| `src/hooks/use-localized-toast.ts` | 國際化 Toast Hook |

---

## Next Steps

完成 Story 17-3 後：
1. 更新現有的 Zod Schema 使用國際化錯誤訊息
2. 更新現有的 API 路由使用國際化錯誤響應
3. 更新現有的 Toast 調用使用國際化 Hook

---

*Generated by BMAD Method - Create Tech Spec Workflow*
