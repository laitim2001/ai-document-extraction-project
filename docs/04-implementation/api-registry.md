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

> 路徑前綴: `/api/v1`

| 端點 | 方法 | 描述 | 認證 | Story |
|------|------|------|------|-------|
| `/api/v1/invoices` | POST | 提交發票（支援 multipart/form-data、Base64、URL 引用） | Bearer Token (API Key) | 11-1 ✅ |
| `/api/v1/invoices` | GET | 查詢任務列表（分頁、篩選） | Bearer Token (API Key) | 11-2 ✅ |
| `/api/v1/invoices/[taskId]/status` | GET | 查詢單一任務處理狀態 | Bearer Token (API Key) | 11-2 ✅ |
| `/api/v1/invoices/batch-status` | POST | 批量查詢任務狀態（最多 100 個） | Bearer Token (API Key) | 11-2 ✅ |
| `/api/v1/invoices/[taskId]/result` | GET | 取得處理結果（支援 JSON/CSV/XML） | Bearer Token (API Key) | 11-3 ✅ |
| `/api/v1/invoices/[taskId]/result/fields/[fieldName]` | GET | 查詢單一欄位值 | Bearer Token (API Key) | 11-3 ✅ |
| `/api/v1/invoices/[taskId]/document` | GET | 取得原始文件下載資訊 | Bearer Token (API Key) | 11-3 ✅ |
| `/api/v1/invoices/batch-results` | POST | 批量查詢處理結果（最多 50 個） | Bearer Token (API Key) | 11-3 ✅ |
| `/api/v1/webhooks` | GET | 查詢 Webhook 發送歷史（分頁、篩選） | Bearer Token (API Key) | 11-4 ✅ |
| `/api/v1/webhooks/[deliveryId]/retry` | POST | 手動重試失敗的 Webhook | Bearer Token (API Key) | 11-4 ✅ |
| `/api/v1/webhooks/stats` | GET | 查詢 Webhook 發送統計 | Bearer Token (API Key) | 11-4 ✅ |

### 發票提交 API 詳情 (Story 11-1)

**端點**: `POST /api/v1/invoices`

**認證**: `Authorization: Bearer {API_KEY}`

**請求格式**:
1. **Multipart/form-data** (文件直接上傳)
   ```
   file: <binary>
   params: {"cityCode": "HKG", "priority": "NORMAL", "callbackUrl": "https://..."}
   ```

2. **JSON (Base64 編碼)**
   ```json
   {
     "type": "base64",
     "content": "JVBERi0xLjQK...",
     "fileName": "invoice.pdf",
     "mimeType": "application/pdf",
     "cityCode": "HKG",
     "priority": "NORMAL"
   }
   ```

3. **JSON (URL 引用)**
   ```json
   {
     "type": "url",
     "url": "https://example.com/invoice.pdf",
     "fileName": "invoice.pdf",
     "cityCode": "HKG"
   }
   ```

**成功回應** (HTTP 202):
```json
{
  "data": {
    "taskId": "cm...",
    "status": "queued",
    "estimatedProcessingTime": 120,
    "statusUrl": "/api/v1/invoices/{taskId}/status",
    "createdAt": "2025-12-20T..."
  },
  "traceId": "api_..."
}
```

**速率限制標頭**:
- `X-RateLimit-Limit`: 每分鐘請求上限
- `X-RateLimit-Remaining`: 剩餘請求數
- `X-RateLimit-Reset`: 重置時間戳

### 處理結果擷取 API 詳情 (Story 11-3)

#### 1. 取得處理結果

**端點**: `GET /api/v1/invoices/{taskId}/result`

**認證**: `Authorization: Bearer {API_KEY}`

**查詢參數**:
| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `format` | string | 否 | 輸出格式: `json`（預設）、`csv`、`xml` |

**成功回應** (HTTP 200 - JSON 格式):
```json
{
  "data": {
    "taskId": "cm...",
    "status": "completed",
    "completedAt": "2025-12-21T10:30:00.000Z",
    "expiresAt": "2026-01-20T10:30:00.000Z",
    "result": {
      "forwarder": {
        "id": "fwd_123",
        "name": "DHL Express",
        "code": "DHL"
      },
      "fields": [
        {
          "name": "invoiceNumber",
          "value": "INV-2024-001",
          "confidence": 0.95,
          "boundingBox": {"x": 100, "y": 50, "width": 200, "height": 30}
        }
      ],
      "metadata": {
        "processingDuration": 15234,
        "ocrProvider": "azure-document-intelligence",
        "modelVersion": "1.0.0"
      }
    }
  },
  "traceId": "api_..."
}
```

**CSV 格式回應** (Content-Type: text/csv):
```csv
fieldName,value,confidence,boundingBoxX,boundingBoxY,boundingBoxWidth,boundingBoxHeight
invoiceNumber,"INV-2024-001",0.95,100,50,200,30
```

**XML 格式回應** (Content-Type: application/xml):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<taskResult>
  <taskId>cm...</taskId>
  <status>completed</status>
  <result>
    <forwarder>
      <id>fwd_123</id>
      <name>DHL Express</name>
    </forwarder>
    <fields>
      <field>
        <name>invoiceNumber</name>
        <value>INV-2024-001</value>
        <confidence>0.95</confidence>
      </field>
    </fields>
  </result>
</taskResult>
```

**錯誤回應**:
- **HTTP 404**: 任務不存在
- **HTTP 409**: 任務尚未完成（返回當前狀態）
- **HTTP 410**: 結果已過期（已超過 30 天保留期）

#### 2. 查詢單一欄位值

**端點**: `GET /api/v1/invoices/{taskId}/result/fields/{fieldName}`

**路徑參數**:
| 參數 | 類型 | 說明 |
|------|------|------|
| `taskId` | string | 任務 ID |
| `fieldName` | string | 欄位名稱（URL 編碼，不區分大小寫） |

**成功回應** (HTTP 200):
```json
{
  "data": {
    "taskId": "cm...",
    "field": {
      "name": "invoiceNumber",
      "value": "INV-2024-001",
      "confidence": 0.95,
      "boundingBox": {"x": 100, "y": 50, "width": 200, "height": 30}
    }
  },
  "traceId": "api_..."
}
```

**錯誤回應**:
- **HTTP 404**: 任務不存在或欄位不存在

#### 3. 取得原始文件下載資訊

**端點**: `GET /api/v1/invoices/{taskId}/document`

**成功回應** (HTTP 200):
```json
{
  "data": {
    "taskId": "cm...",
    "document": {
      "id": "doc_123",
      "fileName": "invoice.pdf",
      "mimeType": "application/pdf",
      "size": 1024000,
      "downloadUrl": "https://storage.blob.core.windows.net/...?sas_token",
      "downloadUrlExpiresAt": "2025-12-21T11:30:00.000Z"
    }
  },
  "traceId": "api_..."
}
```

**注意**: `downloadUrl` 包含 SAS Token，有效期為 1 小時。

#### 4. 批量查詢處理結果

**端點**: `POST /api/v1/invoices/batch-results`

**請求內容**:
```json
{
  "taskIds": ["cm...", "cm...", "cm..."]
}
```

**限制**: 每次最多查詢 50 個任務 ID。

**成功回應** (HTTP 200):
```json
{
  "data": {
    "results": [
      {
        "taskId": "cm...",
        "status": "completed",
        "result": { ... }
      },
      {
        "taskId": "cm...",
        "status": "processing",
        "error": null
      },
      {
        "taskId": "cm...",
        "status": "error",
        "error": {
          "code": "RESULT_EXPIRED",
          "message": "Result has expired"
        }
      }
    ],
    "summary": {
      "total": 3,
      "completed": 1,
      "processing": 1,
      "failed": 1
    }
  },
  "traceId": "api_..."
}
```

### Webhook 通知服務 API 詳情 (Story 11-4)

Webhook 服務用於在發票處理過程中向外部系統推送事件通知。

**事件類型**:
| 事件類型 | 說明 |
|---------|------|
| `INVOICE_PROCESSING` | 發票開始處理 |
| `INVOICE_COMPLETED` | 發票處理完成 |
| `INVOICE_FAILED` | 發票處理失敗 |
| `INVOICE_REVIEW_REQUIRED` | 發票需要人工審核 |

**Webhook Payload 格式**:
```json
{
  "event": "INVOICE_COMPLETED",
  "taskId": "cm...",
  "timestamp": "2025-12-21T10:30:00.000Z",
  "data": {
    "confidenceScore": 0.95,
    "fieldCount": 12,
    "processingTimeMs": 15234,
    "completedAt": "2025-12-21T10:30:00.000Z",
    "resultUrl": "https://api.example.com/api/v1/invoices/cm.../result"
  }
}
```

**簽名驗證**:
- Header: `X-Webhook-Signature`
- 算法: HMAC-SHA256
- 格式: `sha256={signature}`

驗證範例:
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

**重試機制**:
- 最多 3 次重試
- 重試間隔: 1 分鐘 → 5 分鐘 → 30 分鐘
- 可手動觸發重試

#### 1. 查詢發送歷史

**端點**: `GET /api/v1/webhooks`

**查詢參數**:
| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `page` | number | 否 | 頁碼（預設: 1） |
| `limit` | number | 否 | 每頁筆數（預設: 20，最大: 100） |
| `event` | string | 否 | 事件類型篩選 |
| `status` | string | 否 | 發送狀態篩選（PENDING/SENDING/DELIVERED/FAILED/RETRYING） |
| `from` | string | 否 | 開始時間（ISO 8601） |
| `to` | string | 否 | 結束時間（ISO 8601） |
| `taskId` | string | 否 | 任務 ID 篩選 |

**成功回應** (HTTP 200):
```json
{
  "success": true,
  "data": [
    {
      "id": "delivery_123",
      "event": "INVOICE_COMPLETED",
      "taskId": "cm...",
      "status": "DELIVERED",
      "attempts": 1,
      "lastAttemptAt": "2025-12-21T10:30:05.000Z",
      "completedAt": "2025-12-21T10:30:05.500Z",
      "createdAt": "2025-12-21T10:30:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "traceId": "api_..."
}
```

#### 2. 手動重試發送

**端點**: `POST /api/v1/webhooks/{deliveryId}/retry`

**成功回應** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "id": "delivery_123",
    "status": "RETRYING",
    "attempts": 2,
    "scheduledAt": "2025-12-21T10:35:00.000Z"
  },
  "traceId": "api_..."
}
```

**錯誤回應**:
- **HTTP 404**: 發送記錄不存在
- **HTTP 409**: 無法重試（已成功或進行中）

#### 3. 查詢發送統計

**端點**: `GET /api/v1/webhooks/stats`

**查詢參數**:
| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `from` | string | 否 | 開始時間（預設: 7 天前） |
| `to` | string | 否 | 結束時間（預設: 現在） |

**成功回應** (HTTP 200):
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2025-12-14T00:00:00.000Z",
      "to": "2025-12-21T23:59:59.000Z"
    },
    "summary": {
      "total": 1000,
      "delivered": 950,
      "failed": 30,
      "pending": 20,
      "successRate": 0.95
    },
    "byEventType": [
      {
        "event": "INVOICE_COMPLETED",
        "total": 500,
        "delivered": 490,
        "failed": 5,
        "pending": 5,
        "successRate": 0.98
      }
    ],
    "byStatus": {
      "PENDING": 20,
      "SENDING": 0,
      "DELIVERED": 950,
      "FAILED": 30,
      "RETRYING": 0
    }
  },
  "traceId": "api_..."
}
```

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

### 文件來源追蹤 (Epic 9)
| 端點 | 方法 | 描述 | 認證 | 權限 | Story |
|------|------|------|------|------|-------|
| `/api/documents/[documentId]/source` | GET | 取得文件來源資訊 | 是 | USER+ | 9-5 |
| `/api/documents/sources/stats` | GET | 取得來源類型統計 | 是 | USER+ | 9-5 |
| `/api/documents/sources/trend` | GET | 取得來源類型趨勢 | 是 | USER+ | 9-5 |
| `/api/documents/search` | GET | 搜尋文件 (支援來源篩選) | 是 | USER+ | 9-5 |

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

*最後更新: 2025-12-21*
*請在每次新增 API 後更新此文件*
