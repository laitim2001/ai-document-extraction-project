# API Registry (API 註冊表)

本文件追蹤專案中所有已實作的 API 端點，幫助 AI 助手和開發者了解現有的 API 結構並避免重複實作。

> **維護指南**: 每當新增或修改 API 端點時，請更新此文件。

---

## 目錄

- [認證 API](#認證-api)
- [使用者管理 API](#使用者管理-api)
- [發票處理 API](#發票處理-api)
- [審核工作流 API](#審核工作流-api)
- [映射規則 API](#映射規則-api)
- [Forwarder 管理 API](#forwarder-管理-api)
- [報表 API](#報表-api)
- [審計日誌 API](#審計日誌-api)
- [系統管理 API](#系統管理-api)
- [外部 API](#外部-api)

---

## API 設計規範

### 基本 URL 結構
```
/api/[domain]/[resource]/[action]
```

### 標準回應格式
```typescript
// 成功回應
{
  success: true,
  data: T,
  meta?: {
    total?: number,
    page?: number,
    pageSize?: number,
    totalPages?: number
  }
}

// 錯誤回應
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

### HTTP 方法慣例
| 方法 | 用途 | 範例 |
|------|------|------|
| GET | 取得資源 | GET /api/users |
| POST | 建立資源 | POST /api/users |
| PUT | 完整更新資源 | PUT /api/users/[id] |
| PATCH | 部分更新資源 | PATCH /api/users/[id] |
| DELETE | 刪除資源 | DELETE /api/users/[id] |

---

## 認證 API

> 路徑前綴: `/api/auth`

| 端點 | 方法 | 描述 | 認證 | Story |
|------|------|------|------|-------|
| `/api/auth/[...nextauth]` | * | NextAuth.js 處理程式 | - | 1-1 |
| `/api/auth/session` | GET | 取得當前 session | - | 1-1 |
| `/api/auth/providers` | GET | 取得可用的認證提供者 | - | 1-1 |

---

## 使用者管理 API

> 路徑前綴: `/api/admin/users`

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/admin/users` | GET | 取得使用者列表 | 是 | ADMIN | 1-3 |
| `/api/admin/users` | POST | 建立使用者 | 是 | ADMIN | 1-4 |
| `/api/admin/users/[id]` | GET | 取得使用者詳情 | 是 | ADMIN | 1-5 |
| `/api/admin/users/[id]` | PUT | 更新使用者資料 | 是 | ADMIN | 1-5 |
| `/api/admin/users/[id]/role` | PATCH | 更新使用者角色 | 是 | ADMIN | 1-5 |
| `/api/admin/users/[id]/cities` | PATCH | 更新使用者城市權限 | 是 | ADMIN | 1-5 |
| `/api/admin/users/[id]/status` | PATCH | 啟用/停用使用者 | 是 | ADMIN | 1-6 |
| `/api/admin/users/search` | GET | 搜尋使用者 | 是 | ADMIN | 1-3 |

### 角色管理

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/admin/roles` | GET | 取得角色列表 | 是 | ADMIN | 1-7 |
| `/api/admin/roles` | POST | 建立自定義角色 | 是 | GLOBAL_ADMIN | 1-7 |
| `/api/admin/roles/[id]` | PUT | 更新角色 | 是 | GLOBAL_ADMIN | 1-7 |
| `/api/admin/roles/[id]` | DELETE | 刪除角色 | 是 | GLOBAL_ADMIN | 1-7 |
| `/api/admin/roles/[id]/permissions` | GET | 取得角色權限 | 是 | ADMIN | 1-7 |
| `/api/admin/roles/[id]/permissions` | PUT | 更新角色權限 | 是 | GLOBAL_ADMIN | 1-7 |

---

## 發票處理 API

> 路徑前綴: `/api/invoices`

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/invoices/upload` | POST | 上傳發票檔案 | 是 | USER+ | 2-1 |
| `/api/invoices/[id]` | GET | 取得發票詳情 | 是 | USER+ | 2-7 |
| `/api/invoices/[id]/status` | GET | 取得處理狀態 | 是 | USER+ | 2-7 |
| `/api/invoices/[id]/extraction` | GET | 取得擷取結果 | 是 | USER+ | 2-4 |
| `/api/invoices/batch` | POST | 批次上傳發票 | 是 | USER+ | 2-1 |

### 處理服務

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/processing/ocr` | POST | 執行 OCR 擷取 | 內部 | - | 2-2 |
| `/api/processing/identify-forwarder` | POST | 識別 Forwarder | 內部 | - | 2-3 |
| `/api/processing/extract-fields` | POST | 擷取欄位資料 | 內部 | - | 2-4 |
| `/api/processing/calculate-confidence` | POST | 計算信心度 | 內部 | - | 2-5 |
| `/api/processing/route` | POST | 決定處理路徑 | 內部 | - | 2-6 |

---

## 審核工作流 API

> 路徑前綴: `/api/review`

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/review/pending` | GET | 取得待審核列表 | 是 | USER+ | 3-1 |
| `/api/review/[id]` | GET | 取得審核詳情 | 是 | USER+ | 3-2 |
| `/api/review/[id]/confirm` | POST | 確認擷取結果 | 是 | USER+ | 3-4 |
| `/api/review/[id]/correct` | POST | 提交修正 | 是 | USER+ | 3-5 |
| `/api/review/[id]/escalate` | POST | 升級案件 | 是 | USER+ | 3-7 |
| `/api/review/escalated` | GET | 取得已升級案件 | 是 | SUPER_USER+ | 3-8 |
| `/api/review/[id]/resolve` | POST | 解決升級案件 | 是 | SUPER_USER+ | 3-8 |

---

## 映射規則 API

> 路徑前綴: `/api/rules`

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/rules` | GET | 取得規則列表 | 是 | USER+ | 4-1 |
| `/api/rules/[id]` | GET | 取得規則詳情 | 是 | USER+ | 4-1 |
| `/api/rules/suggest` | POST | 建議新規則 | 是 | USER+ | 4-2 |
| `/api/rules/suggestions` | GET | 取得規則建議列表 | 是 | ADMIN | 4-6 |
| `/api/rules/suggestions/[id]/approve` | POST | 核准規則建議 | 是 | ADMIN | 4-6 |
| `/api/rules/suggestions/[id]/reject` | POST | 拒絕規則建議 | 是 | ADMIN | 4-6 |
| `/api/rules/[id]/history` | GET | 取得規則版本歷史 | 是 | ADMIN | 4-7 |
| `/api/rules/[id]/rollback` | POST | 回滾規則版本 | 是 | ADMIN | 4-8 |

### 學習服務

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/learning/corrections` | GET | 取得修正記錄 | 是 | ADMIN | 4-3 |
| `/api/learning/patterns` | GET | 取得修正模式分析 | 是 | ADMIN | 4-3 |
| `/api/learning/generate-suggestions` | POST | 生成規則建議 | 內部 | - | 4-4 |
| `/api/learning/impact-analysis` | POST | 分析規則影響 | 是 | ADMIN | 4-5 |

---

## Forwarder 管理 API

> 路徑前綴: `/api/forwarders`

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/forwarders` | GET | 取得 Forwarder 列表 | 是 | USER+ | 5-1 |
| `/api/forwarders` | POST | 建立 Forwarder | 是 | ADMIN | 5-5 |
| `/api/forwarders/[id]` | GET | 取得 Forwarder 詳情 | 是 | USER+ | 5-2 |
| `/api/forwarders/[id]` | PUT | 更新 Forwarder | 是 | ADMIN | 5-2 |
| `/api/forwarders/[id]/status` | PATCH | 啟用/停用 Forwarder | 是 | ADMIN | 5-5 |
| `/api/forwarders/[id]/rules` | GET | 取得 Forwarder 規則 | 是 | USER+ | 5-3 |
| `/api/forwarders/[id]/rules` | PUT | 更新 Forwarder 規則 | 是 | ADMIN | 5-3 |
| `/api/forwarders/[id]/test` | POST | 測試規則效果 | 是 | ADMIN | 5-4 |

---

## 報表 API

> 路徑前綴: `/api/reports`

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/reports/dashboard` | GET | 取得儀表板資料 | 是 | USER+ | 7-1 |
| `/api/reports/processing-stats` | GET | 取得處理統計 | 是 | USER+ | 7-1 |
| `/api/reports/expense-detail` | GET | 取得費用明細 | 是 | USER+ | 7-4 |
| `/api/reports/expense-detail/export` | POST | 匯出費用明細 | 是 | USER+ | 7-4 |
| `/api/reports/cross-city-summary` | GET | 取得跨城市摘要 | 是 | REGIONAL+ | 7-5 |
| `/api/reports/ai-usage` | GET | 取得 AI 使用成本 | 是 | ADMIN | 7-6 |
| `/api/reports/city-volume` | GET | 取得城市處理量 | 是 | ADMIN | 7-7 |
| `/api/reports/city-cost` | GET | 取得城市 AI 成本 | 是 | ADMIN | 7-8 |
| `/api/reports/city-cost-report` | GET | 取得城市成本報表 | 是 | CITY_MANAGER+ | 7-9 |
| `/api/reports/monthly-allocation` | GET | 取得月度成本分攤 | 是 | ADMIN | 7-10 |

---

## 審計日誌 API

> 路徑前綴: `/api/audit`

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/audit/logs` | GET | 取得操作日誌 | 是 | ADMIN | 8-1 |
| `/api/audit/changes` | GET | 取得資料變更記錄 | 是 | ADMIN | 8-2 |
| `/api/audit/processing-records` | GET | 取得處理記錄 | 是 | USER+ | 8-3 |
| `/api/audit/[invoiceId]/trail` | GET | 取得發票審計軌跡 | 是 | USER+ | 8-4 |
| `/api/audit/export` | POST | 匯出審計報表 | 是 | ADMIN | 8-5 |

---

## 系統管理 API

> 路徑前綴: `/api/admin/system`

| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/admin/system/health` | GET | 取得系統健康狀態 | 是 | ADMIN | 12-1 |
| `/api/admin/system/health/detailed` | GET | 取得詳細健康資訊 | 是 | ADMIN | 12-1 |
| `/api/admin/system/metrics` | GET | 取得效能指標 | 是 | ADMIN | 12-2 |
| `/api/admin/system/metrics/history` | GET | 取得歷史指標 | 是 | ADMIN | 12-2 |
| `/api/admin/alerts` | GET | 取得警報配置 | 是 | ADMIN | 12-3 |
| `/api/admin/alerts` | POST | 建立警報規則 | 是 | GLOBAL_ADMIN | 12-3 |
| `/api/admin/alerts/[id]` | PUT | 更新警報規則 | 是 | GLOBAL_ADMIN | 12-3 |
| `/api/admin/alerts/[id]` | DELETE | 刪除警報規則 | 是 | GLOBAL_ADMIN | 12-3 |
| `/api/admin/alerts/[id]/test` | POST | 測試警報規則 | 是 | ADMIN | 12-3 |
| `/api/admin/config` | GET | 取得系統配置 | 是 | ADMIN | 12-4 |
| `/api/admin/config` | PUT | 更新系統配置 | 是 | GLOBAL_ADMIN | 12-4 |
| `/api/admin/backups` | GET | 取得備份列表 | 是 | ADMIN | 12-5 |
| `/api/admin/backups` | POST | 建立備份 | 是 | GLOBAL_ADMIN | 12-5 |
| `/api/admin/backups/[id]/restore` | POST | 還原備份 | 是 | GLOBAL_ADMIN | 12-6 |
| `/api/admin/logs` | GET | 查詢系統日誌 | 是 | ADMIN | 12-7 |
| `/api/admin/logs/stream` | GET | 即時日誌串流 (SSE) | 是 | ADMIN | 12-7 |
| `/api/admin/logs/export` | POST | 匯出日誌 | 是 | ADMIN | 12-7 |

---

## 外部 API

> 路徑前綴: `/api/external/v1`

| 端點 | 方法 | 描述 | 認證 | Story |
|------|------|------|------|-------|
| `/api/external/v1/invoices` | POST | 提交發票 | API Key | 11-1 |
| `/api/external/v1/invoices/[id]/status` | GET | 查詢處理狀態 | API Key | 11-2 |
| `/api/external/v1/invoices/[id]/result` | GET | 取得處理結果 | API Key | 11-3 |
| `/api/external/v1/webhooks` | POST | 註冊 Webhook | API Key | 11-4 |
| `/api/external/v1/webhooks/[id]` | DELETE | 取消 Webhook | API Key | 11-4 |

---

## 整合 API

### SharePoint 整合 (Epic 9)
| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/integrations/sharepoint/config` | GET | 取得 SharePoint 配置 | 是 | ADMIN | 9-2 |
| `/api/integrations/sharepoint/config` | PUT | 更新 SharePoint 配置 | 是 | ADMIN | 9-2 |
| `/api/integrations/sharepoint/test` | POST | 測試連線 | 是 | ADMIN | 9-2 |

### Outlook 整合 (Epic 9)
| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/integrations/outlook/config` | GET | 取得 Outlook 配置 | 是 | ADMIN | 9-4 |
| `/api/integrations/outlook/config` | PUT | 更新 Outlook 配置 | 是 | ADMIN | 9-4 |
| `/api/integrations/outlook/test` | POST | 測試連線 | 是 | ADMIN | 9-4 |

### n8n 整合 (Epic 10)
| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/integrations/n8n/webhook` | POST | n8n Webhook 接收 | Webhook Secret | - | 10-1 |
| `/api/integrations/n8n/config` | GET | 取得 n8n 配置 | 是 | ADMIN | 10-2 |
| `/api/integrations/n8n/config` | PUT | 更新 n8n 配置 | 是 | ADMIN | 10-2 |
| `/api/integrations/n8n/workflows` | GET | 取得工作流狀態 | 是 | ADMIN | 10-3 |
| `/api/integrations/n8n/workflows/[id]/trigger` | POST | 手動觸發工作流 | 是 | ADMIN | 10-4 |
| `/api/integrations/n8n/workflows/[id]/errors` | GET | 取得工作流錯誤 | 是 | ADMIN | 10-5 |
| `/api/integrations/n8n/status` | GET | 取得連線狀態 | 是 | ADMIN | 10-7 |

---

## API 開發指南

### 建立新 API 端點

```typescript
// src/app/api/[domain]/[resource]/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// 定義請求 schema
const RequestSchema = z.object({
  name: z.string().min(1).max(100),
  // ... 其他欄位
});

// GET: 取得資源列表
export async function GET(request: Request) {
  try {
    // 1. 驗證身份
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未認證' } },
        { status: 401 }
      );
    }

    // 2. 權限檢查
    if (!hasPermission(session.user, 'resource:read')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '無權限' } },
        { status: 403 }
      );
    }

    // 3. 處理查詢參數
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    // 4. 查詢資料 (含 RLS)
    const [data, total] = await Promise.all([
      prisma.resource.findMany({
        where: { cityId: session.user.cityId }, // RLS
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.resource.count({
        where: { cityId: session.user.cityId },
      }),
    ]);

    // 5. 返回結果
    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '伺服器錯誤' } },
      { status: 500 }
    );
  }
}

// POST: 建立資源
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未認證' } },
        { status: 401 }
      );
    }

    // 驗證請求內容
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '驗證失敗',
            details: validation.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    // 建立資源
    const resource = await prisma.resource.create({
      data: {
        ...validation.data,
        cityId: session.user.cityId,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, data: resource }, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '伺服器錯誤' } },
      { status: 500 }
    );
  }
}
```

### 權限常數
```typescript
export const PERMISSIONS = {
  // 使用者管理
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // 發票處理
  INVOICE_READ: 'invoice:read',
  INVOICE_CREATE: 'invoice:create',
  INVOICE_REVIEW: 'invoice:review',
  INVOICE_ESCALATE: 'invoice:escalate',

  // 系統管理
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_LOGS: 'system:logs',
} as const;
```

---

*最後更新: 2025-12-17*
*請在每次新增 API 後更新此文件*
