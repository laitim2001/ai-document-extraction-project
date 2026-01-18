# API 目錄 - Next.js API Routes

> **端點數量**: 280+ API 端點
> **最後更新**: 2026-01-18
> **版本**: 1.2.0

---

## 概述

本目錄包含所有 Next.js App Router API 路由，遵循 RESTful 設計原則。API 層負責：
- **請求驗證**: 使用 Zod schema 驗證所有輸入
- **認證授權**: 整合 NextAuth.js 與 Azure AD SSO
- **響應格式**: 統一的成功/錯誤響應格式
- **錯誤處理**: RFC 7807 標準錯誤響應

---

## API 分類

### 1. 管理員 API (Admin) - Epic 12

| 路徑 | 說明 | 子資源 |
|------|------|--------|
| `/admin/alerts/` | 警報管理 | rules, statistics, summary |
| `/admin/api-keys/` | API 金鑰管理 | rotate, stats |
| `/admin/backups/` | 備份管理 | storage, summary, cancel, preview |
| `/admin/backup-schedules/` | 備份排程 | run, toggle |
| `/admin/config/` | 系統配置 | export, import, reload, history, reset, rollback |
| `/admin/health/` | 健康檢查 | [serviceName] |
| `/admin/integrations/` | 外部整合 | n8n, outlook, sharepoint |
| `/admin/logs/` | 日誌管理 | export, stats, stream, related |
| `/admin/n8n-health/` | n8n 健康狀態 | changes, history |
| `/admin/performance/` | 效能監控 | export, slowest, timeseries |
| `/admin/restore/` | 還原管理 | stats, logs, rollback |
| `/admin/retention/` | 資料保留 | archives, deletion, metrics, policies |
| `/admin/users/` | 用戶管理 | CRUD 操作 |

### 2. 分析 API (Analytics) - Epic 7

| 路徑 | 說明 |
|------|------|
| `/analytics/city-comparison/` | 城市比較分析 |
| `/analytics/global/` | 全域分析統計 |
| `/analytics/region/[code]/cities/` | 區域城市分析 |

### 3. 審計 API (Audit) - Epic 8

| 路徑 | 說明 |
|------|------|
| `/audit/reports/[jobId]/download/` | 審計報表下載 |
| `/audit/reports/[jobId]/verify/` | 審計報表驗證 |

### 4. 認證 API (Auth) - Epic 1

| 路徑 | 說明 |
|------|------|
| `/auth/[...nextauth]/` | NextAuth.js 認證路由（Azure AD SSO）|

### 5. 城市 API (Cities) - Epic 6

| 路徑 | 說明 |
|------|------|
| `/cities/` | 城市列表 CRUD |
| `/cities/accessible/` | 用戶可訪問城市 |
| `/cities/[code]/` | 單一城市操作 |

### 6. 公司 API (Companies) - Epic 5

| 路徑 | 說明 |
|------|------|
| `/companies/` | 公司列表和創建 |
| `/companies/[id]/` | 公司詳情和更新 |
| `/companies/[id]/mappings/` | 公司映射規則 |
| `/companies/detect/` | 公司識別 |
| `/companies/match/` | 公司匹配 |

### 7. 信心度 API (Confidence) - Epic 2

| 路徑 | 說明 |
|------|------|
| `/confidence/[id]/` | 信心度詳情和路由決策 |

### 8. 修正 API (Corrections) - Epic 3

| 路徑 | 說明 |
|------|------|
| `/corrections/` | 修正記錄列表 |
| `/corrections/[id]/` | 單一修正操作 |

### 9. 成本 API (Cost) - Epic 7

| 路徑 | 說明 |
|------|------|
| `/cost/city-summary/` | 城市成本摘要 |
| `/cost/city-trend/` | 城市成本趨勢 |
| `/cost/comparison/` | 成本比較 |
| `/cost/pricing/` | 定價管理 |

### 10. 儀表板 API (Dashboard) - Epic 7

| 路徑 | 說明 |
|------|------|
| `/dashboard/statistics/` | 儀表板統計 |
| `/dashboard/ai-cost/` | AI 成本追蹤 |
| `/dashboard/ai-cost/anomalies/` | 成本異常檢測 |
| `/dashboard/ai-cost/daily/[date]/` | 每日成本詳情 |
| `/dashboard/ai-cost/trend/` | 成本趨勢 |

### 11. 文檔 API (Docs) - Epic 11

| 路徑 | 說明 |
|------|------|
| `/docs/` | OpenAPI 文檔首頁 |
| `/docs/error-codes/` | 錯誤碼參考 |
| `/docs/examples/` | API 使用範例 |

### 12. 文件 API (Documents) - Epic 2

| 路徑 | 說明 |
|------|------|
| `/documents/` | 文件列表和上傳 |
| `/documents/[id]/` | 文件詳情 |
| `/documents/[id]/process/` | 觸發處理 |
| `/documents/[id]/download/` | 文件下載 |
| `/documents/batch-upload/` | 批次上傳（Epic 0）|

### 13. 升級 API (Escalations) - Epic 3

| 路徑 | 說明 |
|------|------|
| `/escalations/` | 升級列表 |
| `/escalations/[id]/` | 升級詳情 |
| `/escalations/[id]/resolve/` | 解決升級 |

### 14. 匯出 API (Exports) - Epic 7

| 路徑 | 說明 |
|------|------|
| `/exports/` | 匯出任務管理 |
| `/exports/[id]/download/` | 下載匯出文件 |

### 15. 提取 API (Extraction) - Epic 2

| 路徑 | 說明 |
|------|------|
| `/extraction/` | 欄位提取服務 |
| `/extraction/[id]/fields/` | 提取欄位詳情 |

### 16. Forwarder API (Forwarders) - Epic 5

| 路徑 | 說明 |
|------|------|
| `/forwarders/` | Forwarder 列表（向後兼容）|
| `/forwarders/[id]/` | Forwarder 詳情 |

> **注意**: 因 REFACTOR-001，建議使用 `/companies/` API

### 17. 健康檢查 API (Health) - Epic 12

| 路徑 | 說明 |
|------|------|
| `/health/` | 系統健康狀態 |

### 18. 歷史 API (History) - Epic 8

| 路徑 | 說明 |
|------|------|
| `/history/` | 處理歷史記錄 |
| `/history/export/` | 歷史匯出 |

### 19. 任務 API (Jobs) - Epic 3

| 路徑 | 說明 |
|------|------|
| `/jobs/` | 背景任務列表 |
| `/jobs/[id]/` | 任務詳情 |
| `/jobs/[id]/cancel/` | 取消任務 |

### 20. 映射 API (Mapping) - Epic 4

| 路徑 | 說明 |
|------|------|
| `/mapping/` | 映射規則列表 |
| `/mapping/universal/` | 通用映射（Tier 1）|
| `/mapping/company/[companyId]/` | 公司特定映射（Tier 2）|
| `/mapping/classify/` | LLM 分類（Tier 3）|
| `/mapping/suggestions/` | 規則建議 |
| `/mapping/test/` | 規則測試 |

### 21. n8n API (N8n) - Epic 10

| 路徑 | 說明 |
|------|------|
| `/n8n/webhook/` | n8n Webhook 端點 |
| `/n8n/trigger/` | 工作流觸發 |
| `/n8n/status/` | 執行狀態 |

### 22. OpenAPI API - Epic 11

| 路徑 | 說明 |
|------|------|
| `/openapi/` | OpenAPI 規格文件 |
| `/openapi/swagger/` | Swagger UI |

### 23. 報表 API (Reports) - Epic 7

| 路徑 | 說明 |
|------|------|
| `/reports/` | 報表列表 |
| `/reports/generate/` | 生成報表 |
| `/reports/[id]/` | 報表詳情 |
| `/reports/[id]/download/` | 下載報表 |

### 24. 審核 API (Review) - Epic 3

| 路徑 | 說明 |
|------|------|
| `/review/queue/` | 審核隊列 |
| `/review/[id]/` | 審核詳情 |
| `/review/[id]/approve/` | 批准審核 |
| `/review/[id]/reject/` | 拒絕審核 |
| `/review/[id]/correct/` | 修正並批准 |

### 25. 角色 API (Roles) - Epic 1

| 路徑 | 說明 |
|------|------|
| `/roles/` | 角色列表 |
| `/roles/[id]/` | 角色詳情 |
| `/roles/[id]/permissions/` | 角色權限 |

### 26. 回滾日誌 API (Rollback Logs) - Epic 4

| 路徑 | 說明 |
|------|------|
| `/rollback-logs/` | 回滾日誌列表 |
| `/rollback-logs/[id]/` | 回滾詳情 |

### 27. 路由 API (Routing) - Epic 3

| 路徑 | 說明 |
|------|------|
| `/routing/` | 審核路由配置 |
| `/routing/rules/` | 路由規則 |

### 28. 規則 API (Rules) - Epic 4

| 路徑 | 說明 |
|------|------|
| `/rules/` | 規則列表 |
| `/rules/[id]/` | 規則詳情 |
| `/rules/[id]/accuracy/` | 規則準確度 |
| `/rules/[id]/impact/` | 影響分析 |
| `/rules/suggestions/` | 規則建議 |

### 29. 統計 API (Statistics) - Epic 7

| 路徑 | 說明 |
|------|------|
| `/statistics/processing/` | 處理統計 |
| `/statistics/accuracy/` | 準確度統計 |
| `/statistics/cost/` | 成本統計 |

### 30. 測試任務 API (Test Tasks) - Epic 4

| 路徑 | 說明 |
|------|------|
| `/test-tasks/` | 測試任務列表 |
| `/test-tasks/[id]/` | 測試任務詳情 |
| `/test-tasks/[id]/run/` | 執行測試 |

### 31. 工作流 API (Workflows) - Epic 10

| 路徑 | 說明 |
|------|------|
| `/workflows/` | 工作流列表 |
| `/workflows/[id]/` | 工作流詳情 |
| `/workflows/[id]/execute/` | 執行工作流 |
| `/workflow-executions/` | 執行記錄 |
| `/workflow-errors/` | 錯誤記錄 |

### 32. V1 API（版本化端點） - Epic 0, 11, 13, 14

| 路徑 | 說明 | Epic |
|------|------|------|
| `/v1/batches/` | 批次處理 | Epic 0 |
| `/v1/formats/` | 文件格式 | Epic 0 |
| `/v1/invoices/` | 發票 API | Epic 11 |
| `/v1/webhooks/` | Webhook 管理 | Epic 11 |
| `/v1/field-mapping-configs/` | 欄位映射配置 | Epic 13 |
| `/v1/prompt-configs/` | Prompt 配置管理 | Epic 14 |
| `/v1/users/me/locale/` | 用戶語言偏好 | Epic 17 |

### 33. 欄位映射配置 API (Field Mapping Configs) - Epic 13

> **Story 13-4**: 映射配置 API - 三層範圍優先級系統（GLOBAL → COMPANY → FORMAT）

| 路徑 | 方法 | 說明 |
|------|------|------|
| `/v1/field-mapping-configs/` | GET | 配置列表（支援 scope, companyId, formatId 篩選）|
| `/v1/field-mapping-configs/` | POST | 創建新配置 |
| `/v1/field-mapping-configs/[id]/` | GET | 配置詳情（含規則列表）|
| `/v1/field-mapping-configs/[id]/` | PATCH | 更新配置（樂觀鎖 version 控制）|
| `/v1/field-mapping-configs/[id]/` | DELETE | 刪除配置（級聯刪除規則）|
| `/v1/field-mapping-configs/[id]/rules/` | POST | 創建映射規則 |
| `/v1/field-mapping-configs/[id]/rules/[ruleId]/` | PATCH | 更新規則 |
| `/v1/field-mapping-configs/[id]/rules/[ruleId]/` | DELETE | 刪除規則 |
| `/v1/field-mapping-configs/[id]/rules/reorder/` | POST | 批次重排序規則優先級 |
| `/v1/field-mapping-configs/[id]/test/` | POST | 測試配置映射 |
| `/v1/field-mapping-configs/[id]/export/` | GET | 導出配置為 JSON |
| `/v1/field-mapping-configs/import/` | POST | 導入配置 JSON |

#### 範圍優先級說明

```
GLOBAL → COMPANY → FORMAT（越具體優先級越高）
```

| Scope | 說明 | 關聯欄位 |
|-------|------|----------|
| GLOBAL | 通用映射（所有文件適用）| 無 |
| COMPANY | 公司特定映射 | companyId |
| FORMAT | 文件格式特定映射 | documentFormatId |

#### Transform 類型

| 類型 | 說明 | 參數範例 |
|------|------|----------|
| DIRECT | 直接映射 | 無 |
| CONCAT | 多欄位連接 | `{ separator: " " }` |
| SPLIT | 分割取值 | `{ separator: "-", index: 0 }` |
| LOOKUP | 查表映射 | `{ mapping: { "A": "Alpha" } }` |
| CUSTOM | 自定義表達式 | `{ expression: "..." }` |

### 34. Prompt 配置 API (Prompt Configs) - Epic 14

> **Story 14-1**: Prompt 配置模型與 API - 三層範圍繼承系統（GLOBAL → COMPANY → FORMAT）

| 路徑 | 方法 | 說明 |
|------|------|------|
| `/v1/prompt-configs/` | GET | 配置列表（支援 promptType, scope, companyId, documentFormatId 篩選）|
| `/v1/prompt-configs/` | POST | 創建新配置（唯一約束：promptType + scope + companyId + documentFormatId）|
| `/v1/prompt-configs/[id]/` | GET | 配置詳情（含 systemPrompt, userPromptTemplate, variables）|
| `/v1/prompt-configs/[id]/` | PATCH | 更新配置（樂觀鎖 version 控制）|
| `/v1/prompt-configs/[id]/` | DELETE | 刪除配置 |

#### Prompt 類型（PromptType）

| 類型 | 說明 |
|------|------|
| ISSUER_IDENTIFICATION | 發行方識別 - 用於識別文件發行方 |
| TERM_CLASSIFICATION | 術語分類 - 用於分類提取的術語 |
| FIELD_EXTRACTION | 欄位提取 - 用於從文件中提取特定欄位 |
| VALIDATION | 驗證 - 用於驗證提取結果的準確性 |

#### 範圍優先級（PromptScope）

```
GLOBAL → COMPANY → FORMAT（越具體優先級越高）
```

| Scope | 說明 | 必要關聯 |
|-------|------|----------|
| GLOBAL | 全域配置（所有文件適用）| 無 |
| COMPANY | 公司特定配置 | companyId |
| FORMAT | 文件格式特定配置 | companyId + documentFormatId |

#### 合併策略（MergeStrategy）

| 策略 | 說明 |
|------|------|
| OVERRIDE | 完全覆蓋父層配置 |
| APPEND | 附加到父層配置末尾 |
| PREPEND | 插入到父層配置開頭 |

#### 變數插值

支援 `{{variableName}}` 語法在 systemPrompt 和 userPromptTemplate 中進行變數插值。

### 35. 用戶語言偏好 API (User Locale) - Epic 17

> **Story 17-5**: 語言偏好設定 - 支援 LocalStorage + 資料庫雙重持久化

| 路徑 | 方法 | 說明 |
|------|------|------|
| `/v1/users/me/locale/` | PATCH | 更新當前用戶的語言偏好 |

#### 請求格式

```typescript
// PATCH /api/v1/users/me/locale
{
  "locale": "zh-TW"  // 'en' | 'zh-TW' | 'zh-CN'
}
```

#### 響應格式

```typescript
{
  "success": true,
  "data": {
    "preferredLocale": "zh-TW"
  }
}
```

#### 語言偏好優先級

```
1. URL 路徑中的 locale（/zh-TW/dashboard）
2. 資料庫偏好（已登入用戶）
3. LocalStorage 偏好
4. 瀏覽器 Accept-Language
5. 預設語言（en）
```

---

## 響應格式標準

### 成功響應

```typescript
{
  success: true,
  data: T,
  meta?: {
    pagination?: {
      page: number,
      limit: number,
      total: number,
      totalPages: number
    }
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
    [field: string]: string[]
  }
}
```

---

## HTTP 狀態碼

| 狀態碼 | 用途 |
|--------|------|
| 200 | 成功（GET, PATCH, DELETE）|
| 201 | 創建成功（POST）|
| 204 | 無內容（DELETE 成功）|
| 400 | 驗證錯誤 |
| 401 | 未認證 |
| 403 | 無權限 |
| 404 | 資源不存在 |
| 409 | 衝突（重複資源）|
| 422 | 業務邏輯錯誤 |
| 500 | 伺服器錯誤 |

---

## API Route 標準模板

```typescript
/**
 * @fileoverview [API 功能描述]
 * @module src/app/api/[resource]/route
 * @since Epic X - Story X.X
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resourceSchema } from '@/validations/resource';
import { createApiResponse, createApiError } from '@/lib/api/response';

/**
 * GET /api/[resource]
 * [功能描述]
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 認證檢查
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        createApiError({ type: 'auth', message: 'Unauthorized' }),
        { status: 401 }
      );
    }

    // 2. 解析和驗證輸入
    const { searchParams } = new URL(request.url);
    const params = resourceSchema.parse(Object.fromEntries(searchParams));

    // 3. 執行業務邏輯（調用 Service）
    const data = await resourceService.list(params);

    // 4. 返回成功響應
    return NextResponse.json(createApiResponse(data));
  } catch (error) {
    // 5. 統一錯誤處理
    return NextResponse.json(
      createApiError(error),
      { status: getErrorStatus(error) }
    );
  }
}
```

---

## 認證與授權

### 認證流程

```
請求 → NextAuth Session 檢查 → 角色權限驗證 → 城市存取控制 → 業務邏輯
```

### 權限層級

| 角色 | 權限範圍 |
|------|----------|
| GLOBAL_ADMIN | 全系統管理 |
| REGIONAL_MANAGER | 區域內所有城市 |
| CITY_ADMIN | 特定城市管理 |
| REVIEWER | 審核操作 |
| VIEWER | 僅查看 |

---

## 分頁與排序

### 查詢參數

```
GET /api/documents?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

### 標準參數

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| page | number | 1 | 頁碼 |
| limit | number | 20 | 每頁數量（最大 100）|
| sortBy | string | createdAt | 排序欄位 |
| sortOrder | 'asc' \| 'desc' | desc | 排序方向 |

---

## 新增 API 端點指南

1. **確定資源分類**: 選擇正確的目錄或建立新目錄
2. **建立 route.ts**: 使用標準模板
3. **定義 Zod Schema**: 在 `src/validations/` 建立驗證 schema
4. **調用 Service**: 業務邏輯放在 `src/services/`
5. **更新本文檔**: 將新端點加入對應分類表格

---

## 相關文檔

- [CLAUDE.md (根目錄)](../../CLAUDE.md) - 項目總指南
- [.claude/rules/api-design.md](../../.claude/rules/api-design.md) - API 設計規範
- [src/services/CLAUDE.md](../services/CLAUDE.md) - 服務層文檔
- [docs/04-implementation/tech-specs/](../../docs/04-implementation/tech-specs/) - 技術規格

---

**維護者**: Development Team
**最後更新**: 2026-01-18
**版本**: 1.2.0
