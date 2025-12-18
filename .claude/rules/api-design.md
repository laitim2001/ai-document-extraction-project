---
paths: src/app/api/**/*.ts
---

# API 設計規範

## 路由結構
```
src/app/api/
├── v1/
│   ├── documents/
│   │   ├── route.ts              # GET (list), POST (create)
│   │   ├── [id]/
│   │   │   ├── route.ts          # GET, PATCH, DELETE
│   │   │   └── review/
│   │   │       └── route.ts      # POST (submit review)
│   ├── forwarders/
│   └── mappings/
```

## 響應格式

### 成功響應
```typescript
{
  success: true,
  data: T,
  meta?: {
    pagination?: { page, limit, total, totalPages }
  }
}
```

### 錯誤響應（RFC 7807）
```typescript
{
  type: "https://api.example.com/errors/validation",
  title: "Validation Error",
  status: 400,
  detail: "One or more fields failed validation",
  instance: "/api/v1/documents/123",
  errors?: {
    field: ["error message"]
  }
}
```

## API Route 模板

```typescript
/**
 * @fileoverview [API 功能描述]
 * @module src/app/api/v1/[resource]/route
 * @since Epic X - Story X.X
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resourceSchema } from '@/validations/resource';
import { createApiError, createApiResponse } from '@/lib/api/response';

/**
 * GET /api/v1/[resource]
 * [功能描述]
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 解析和驗證輸入
    const params = resourceSchema.parse(...);

    // 2. 執行業務邏輯
    const data = await prisma.resource.findMany(...);

    // 3. 返回成功響應
    return NextResponse.json(createApiResponse(data));
  } catch (error) {
    // 4. 統一錯誤處理
    return NextResponse.json(
      createApiError(error),
      { status: getErrorStatus(error) }
    );
  }
}
```

## 輸入驗證（必須）
- 所有 API 輸入必須使用 Zod schema 驗證
- 驗證失敗返回 400 + RFC 7807 格式錯誤

## HTTP 狀態碼
| 狀態碼 | 用途 |
|--------|------|
| 200 | 成功（GET, PATCH, DELETE） |
| 201 | 創建成功（POST） |
| 400 | 驗證錯誤 |
| 401 | 未認證 |
| 403 | 無權限 |
| 404 | 資源不存在 |
| 500 | 伺服器錯誤 |

## 分頁參數
```typescript
// 查詢參數
?page=1&limit=20&sort=createdAt&order=desc

// 響應 meta
{
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5
  }
}
```
