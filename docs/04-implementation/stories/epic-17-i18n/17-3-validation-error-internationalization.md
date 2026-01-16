# Story 17.3: 驗證訊息與錯誤處理國際化

**Status:** ready-for-dev

---

## Story

**As a** 多語言用戶,
**I want** 系統的錯誤訊息和驗證提示以我的語言顯示,
**So that** 我可以清楚理解操作失敗的原因並正確修正。

---

## Acceptance Criteria

### AC1: Zod 驗證訊息國際化

**Given** 系統使用 Zod 進行表單驗證（約 520+ 驗證訊息）
**When** 用戶提交表單並觸發驗證錯誤
**Then** 錯誤訊息以用戶偏好語言顯示
**And** 支援帶參數的訊息（如「{field}不能超過 {max} 個字元」）
**And** 所有驗證規則（必填、長度、格式、唯一性等）均有翻譯

### AC2: API 錯誤響應國際化

**Given** API 返回 RFC 7807 格式的錯誤響應
**When** API 請求失敗
**Then** 錯誤標題（title）根據語言翻譯
**And** 錯誤詳情（detail）根據語言翻譯
**And** 欄位級錯誤訊息根據語言翻譯

### AC3: Toast 通知國際化

**Given** 系統使用 Toast 顯示操作結果
**When** 操作成功或失敗
**Then** Toast 標題和描述以用戶語言顯示
**And** 常見訊息（操作成功、操作失敗、網路錯誤等）已翻譯

### AC4: 驗證訊息標準化

**Given** 驗證訊息需要統一管理
**When** 開發者添加新的驗證規則
**Then** 可使用標準化的驗證訊息 key
**And** 訊息支援變數替換（{field}, {min}, {max} 等）
**And** 有完整的驗證訊息模板庫

---

## Tasks / Subtasks

- [ ] **Task 1: 建立驗證訊息翻譯檔案** (AC: #1, #4)
  - [ ] 1.1 建立 `messages/{locale}/validation.json`
  - [ ] 1.2 定義標準化驗證訊息 key（required, maxLength, minLength 等）
  - [ ] 1.3 支援變數替換格式

- [ ] **Task 2: 建立錯誤訊息翻譯檔案** (AC: #2, #3)
  - [ ] 2.1 建立 `messages/{locale}/errors.json`
  - [ ] 2.2 定義 API 錯誤類型翻譯
  - [ ] 2.3 定義 Toast 通知翻譯

- [ ] **Task 3: 建立 Zod 國際化整合** (AC: #1)
  - [ ] 3.1 建立 `src/lib/i18n-zod.ts` - Zod 錯誤訊息映射
  - [ ] 3.2 建立 `useLocalizedZod` hook
  - [ ] 3.3 整合 Zod 4.x 內建 locales（zh-TW, en）

- [ ] **Task 4: 重構現有 Zod Schema** (AC: #1)
  - [ ] 4.1 更新 `src/validations/data-template.ts`
  - [ ] 4.2 更新 `src/validations/document-format.ts`
  - [ ] 4.3 更新其他驗證 Schema 使用國際化訊息

- [ ] **Task 5: 重構 API 錯誤處理** (AC: #2)
  - [ ] 5.1 建立 `createLocalizedError` 工具函數
  - [ ] 5.2 更新 API 路由使用國際化錯誤響應
  - [ ] 5.3 確保 Accept-Language header 正確處理

- [ ] **Task 6: 重構 Toast 通知** (AC: #3)
  - [ ] 6.1 建立 `useLocalizedToast` hook
  - [ ] 6.2 更新現有 Toast 調用使用翻譯

- [ ] **Task 7: 英文翻譯完成** (AC: #1-4)
  - [ ] 7.1 完成 `en/validation.json`
  - [ ] 7.2 完成 `en/errors.json`

---

## Dev Notes

### 依賴項

- **Story 17.1**: i18n 基礎架構設置（必須先完成）

### Project Structure Notes

```
messages/
├── zh-TW/
│   ├── validation.json      # 驗證訊息 (~80)
│   └── errors.json          # 錯誤訊息 (~60)
│
├── en/
│   ├── validation.json
│   └── errors.json
│
└── zh-CN/
    └── ...

src/
├── lib/
│   └── i18n-zod.ts          # Zod 國際化工具
│
└── hooks/
    ├── use-localized-zod.ts
    └── use-localized-toast.ts
```

### Architecture Compliance

#### 驗證訊息翻譯檔案

```json
// messages/zh-TW/validation.json
{
  "required": "{field}不能為空",
  "maxLength": "{field}不能超過 {max} 個字元",
  "minLength": "{field}至少需要 {min} 個字元",
  "email": "請輸入有效的電郵地址",
  "url": "請輸入有效的網址",
  "pattern": "{field}格式不正確",
  "unique": "{field}已存在",
  "min": "{field}不能小於 {min}",
  "max": "{field}不能大於 {max}",
  "positiveInteger": "{field}必須為正整數",
  "invalidType": "請選擇有效的{field}",
  "arrayMinLength": "至少需要 {min} 個{field}",
  "arrayMaxLength": "{field}數量不能超過 {max} 個"
}
```

#### 錯誤訊息翻譯檔案

```json
// messages/zh-TW/errors.json
{
  "api": {
    "unauthorized": {
      "title": "未授權",
      "detail": "請重新登入後再試"
    },
    "forbidden": {
      "title": "存取被拒",
      "detail": "您沒有權限執行此操作"
    },
    "notFound": {
      "title": "找不到資源",
      "detail": "請求的資源不存在"
    },
    "validation": {
      "title": "驗證錯誤",
      "detail": "一個或多個欄位驗證失敗"
    },
    "internal": {
      "title": "伺服器錯誤",
      "detail": "伺服器發生內部錯誤，請稍後再試"
    },
    "network": {
      "title": "網路錯誤",
      "detail": "無法連接伺服器，請檢查網路連線"
    }
  },
  "toast": {
    "success": "操作成功",
    "error": "操作失敗",
    "saved": "已保存",
    "deleted": "已刪除",
    "updated": "已更新",
    "created": "已建立"
  }
}
```

#### Zod 國際化工具

```typescript
// src/lib/i18n-zod.ts
import { z } from 'zod';
import { useTranslations } from 'next-intl';

export function useLocalizedZodErrorMap() {
  const t = useTranslations('validation');

  const errorMap: z.ZodErrorMap = (issue, ctx) => {
    let message: string;

    switch (issue.code) {
      case z.ZodIssueCode.too_small:
        if (issue.type === 'string') {
          message = issue.minimum === 1
            ? t('required', { field: ctx.defaultError })
            : t('minLength', { field: ctx.defaultError, min: issue.minimum });
        } else {
          message = t('min', { field: ctx.defaultError, min: issue.minimum });
        }
        break;
      case z.ZodIssueCode.too_big:
        message = issue.type === 'string'
          ? t('maxLength', { field: ctx.defaultError, max: issue.maximum })
          : t('max', { field: ctx.defaultError, max: issue.maximum });
        break;
      case z.ZodIssueCode.invalid_type:
        message = t('invalidType', { field: ctx.defaultError });
        break;
      default:
        message = ctx.defaultError;
    }

    return { message };
  };

  return errorMap;
}
```

#### API 錯誤響應國際化

```typescript
// src/lib/api-errors.ts
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';

export async function createLocalizedError(
  errorKey: string,
  status: number,
  instance: string,
  fieldErrors?: Record<string, string[]>
) {
  const headersList = headers();
  const acceptLanguage = headersList.get('accept-language');
  const locale = parseAcceptLanguage(acceptLanguage) || 'en';

  const t = await getTranslations({ locale, namespace: 'errors' });

  return {
    type: `https://api.example.com/errors/${errorKey}`,
    title: t(`api.${errorKey}.title`),
    status,
    detail: t(`api.${errorKey}.detail`),
    instance,
    errors: fieldErrors,
  };
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 表單驗證錯誤（zh-TW） | 顯示「欄位名稱不能為空」 |
| 表單驗證錯誤（en） | 顯示「Field name is required」 |
| API 401 錯誤 | 根據語言顯示「未授權」或「Unauthorized」 |
| Toast 成功通知 | 根據語言顯示「操作成功」或「Operation successful」 |
| 帶參數的驗證訊息 | 正確替換 {field}, {max} 等變數 |

### References

- [Source: src/validations/] - 現有 Zod Schema
- [Source: Zod 4.x locales] - node_modules/zod/v4/locales/

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 17.3 |
| Story Key | 17-3-validation-error-internationalization |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Large (10-14h) |
| Dependencies | Story 17.1 |
| Blocking | 無 |

---

*Story created: 2026-01-16*
*Status: ready-for-dev*
