# OpenAPI Spec Drift Analysis

> **分析日期**: 2026-04-09
> **Spec 位置**: `openapi/spec.yaml`
> **載入服務**: `src/services/openapi-loader.service.ts`

---

## 1. OpenAPI Spec 概覽

| 項目 | 值 |
|------|-----|
| OpenAPI 版本 | 3.0.3 |
| API 標題 | Invoice Extraction API |
| Spec 版本 | 1.0.0 |
| 定義路徑數 | 7 |
| 定義操作數 | 10 |
| Tags | Invoices, Tasks, Webhooks |
| 認證方式 | BearerAuth (API Key) |
| 基礎 URL | `/api/v1` |

### Spec 中定義的全部端點

| # | 路徑 | 方法 | operationId | 說明 |
|---|------|------|-------------|------|
| 1 | `/invoices` | POST | submitInvoice | 提交發票處理 |
| 2 | `/invoices/{taskId}` | GET | getInvoiceResult | 取得提取結果 |
| 3 | `/tasks/{taskId}/status` | GET | getTaskStatus | 取得任務狀態 |
| 4 | `/webhooks` | GET | listWebhooks | 列出 Webhooks |
| 5 | `/webhooks` | POST | registerWebhook | 註冊 Webhook |
| 6 | `/webhooks/{webhookId}` | GET | getWebhook | 取得 Webhook 詳情 |
| 7 | `/webhooks/{webhookId}` | PATCH | updateWebhook | 更新 Webhook |
| 8 | `/webhooks/{webhookId}` | DELETE | deleteWebhook | 刪除 Webhook |
| 9 | `/webhooks/{webhookId}/deliveries` | GET | listWebhookDeliveries | 列出投遞歷史 |
| 10 | `/webhooks/{webhookId}/deliveries/{deliveryId}/retry` | POST | retryWebhookDelivery | 重試投遞 |

---

## 2. 實際 API 路由統計

| 指標 | 數量 |
|------|------|
| route.ts 文件總數 | 331 |
| HTTP 方法總估計 | 400+ |
| 頂級域名數 | 20+ |

### 按域名分佈（前 10）

| 域名 | route.ts 數 | 說明 |
|------|-------------|------|
| `/admin/*` | 106 | 管理後台 API |
| `/v1/*` | 77 | 版本化 API |
| `/rules/*` | 20 | 規則管理 |
| `/documents/*` | 19 | 文件處理 |
| `/reports/*` | 12 | 報表 |
| `/companies/*` | 12 | 公司管理 |
| `/auth/*` | 7 | 認證 |
| `/audit/*` | 7 | 審計 |
| `/workflows/*` | 5 | 工作流 |
| `/review/*` | 5 | 審核 |

---

## 3. 覆蓋差距分析

### 3.1 Phantom Endpoints（Spec 中有，代碼中無）

OpenAPI Spec 定義的路徑使用 `/api/v1` 前綴。對照實際 route.ts 文件：

| Spec 路徑 | 對應代碼路徑 | 狀態 |
|-----------|-------------|------|
| `/invoices` | 無精確對應（`/documents/upload/` 替代） | **Phantom** |
| `/invoices/{taskId}` | 無精確對應 | **Phantom** |
| `/tasks/{taskId}/status` | 無精確對應（`/documents/[id]/` 替代） | **Phantom** |
| `/webhooks` | `src/app/api/admin/webhooks/route.ts` 存在 | **路徑不一致** |
| `/webhooks/{webhookId}` | `src/app/api/admin/webhooks/[id]/route.ts` | **路徑不一致** |
| `/webhooks/{webhookId}/deliveries` | 無精確對應 | **Phantom** |
| `/webhooks/{deliveryId}/retry` | 無精確對應 | **Phantom** |

**結論**: Spec 定義的 10 個操作中，**0 個**完全匹配實際路由路徑。Spec 使用簡化的外部 API 命名，而實際實作使用內部管理系統路由結構。

### 3.2 Undocumented Endpoints（代碼中有，Spec 中無）

實際系統有 **331 個 route.ts 文件** (400+ HTTP 端點)，Spec 僅定義 **10 個操作**。
未文件化比例：**~97.5%**

按域名列出主要未文件化 API：

| 域名 | 端點數 | 功能範圍 |
|------|--------|---------|
| `/admin/alerts/*` | ~8 | 警報規則 CRUD、評估 |
| `/admin/backups/*` | ~10 | 備份排程、還原 |
| `/admin/config/*` | ~6 | 系統配置 |
| `/admin/health/*` | ~8 | 健康檢查、效能指標 |
| `/admin/integrations/*` | ~15 | Outlook/SharePoint/n8n |
| `/admin/logs/*` | ~8 | 日誌查詢、SSE 串流 |
| `/admin/users/*` | ~12 | 用戶管理、角色 |
| `/v1/data-templates/*` | ~3 | 資料模板 |
| `/v1/exchange-rates/*` | ~7 | 匯率管理 |
| `/v1/field-definition-sets/*` | ~5 | 欄位定義 |
| `/v1/prompt-configs/*` | ~8 | Prompt 配置 |
| `/documents/*` | ~19 | 文件上傳、處理、預覽 |
| `/rules/*` | ~20 | 映射規則 CRUD |
| `/companies/*` | ~12 | 公司管理 |
| `/reports/*` | ~12 | 報表生成、下載 |

---

## 4. Response Schema 比對

### Spec 定義的回應格式

```
成功: { success: true, data: T, meta?: { pagination? } }
錯誤: RFC 7807 ProblemDetails { type, title, status, detail, instance, errors? }
```

### 實際代碼使用的格式

```
成功: { success: true, data: T, meta?: { pagination? } }
錯誤: RFC 7807 格式（.claude/rules/api-design.md 規範）
```

**回應格式一致性**: Spec 與代碼規範**一致**。兩者都使用 `{ success, data, meta }` 成功格式和 RFC 7807 錯誤格式。

### 術語差異

| Spec 用語 | 代碼用語 | 說明 |
|-----------|---------|------|
| `forwarderId` | `companyId` | REFACTOR-001 後 Forwarder→Company |
| `taskId` | `documentId` / `processingQueueId` | 任務追蹤模型不同 |
| `InvoiceSubmissionRequest` | multipart form upload | 上傳機制相同但名稱不同 |

---

## 5. 整體漂移評估

| 指標 | 值 | 評分 |
|------|-----|------|
| Spec 端點覆蓋率 | 10/400+ (2.5%) | **極低** |
| 路徑匹配率 | 0/10 (0%) | **無匹配** |
| Response Schema 一致性 | 高 | **良好** |
| 術語一致性 | 低（Forwarder vs Company） | **過時** |
| 總體漂移 | **~97.5%** | **嚴重** |

### 根本原因分析

1. **Spec 定位不同**: `openapi/spec.yaml` 是 Epic 11 設計的**外部 API** 規格（給第三方整合），而 331 個 route.ts 大部分是**內部管理系統 API**
2. **Spec 未持續更新**: Spec 版本仍為 1.0.0，仍使用 `forwarderId`（REFACTOR-001 前的用語）
3. **範圍差異**: Spec 只涵蓋 Invoice 提交和 Webhook 管理（外部消費者視角），不涵蓋管理後台、規則、報表等

### 建議行動

| 優先級 | 行動 | 影響 |
|--------|------|------|
| **高** | 更新 Spec 中 `forwarderId` → `companyId` | 術語一致性 |
| **高** | 為外部 API（`/v1/*` 下 77 個路由）生成 OpenAPI Spec | 文件化比例 |
| **中** | 評估是否需要為 `/admin/*` API 生成獨立 Spec | 內部開發文件 |
| **低** | 使用自動工具（如 next-swagger-doc）從 route.ts 生成 Spec | 長期維護 |

---

## 6. Spec 載入機制

`src/services/openapi-loader.service.ts` 提供：
- YAML 解析與記憶體快取（TTL 5 分鐘）
- Spec 驗證（必須有 openapi、info、paths）
- 端點列舉、版本資訊、錯誤碼參考
- 用於 `/docs/api` 頁面的 Swagger UI 渲染

載入路徑預設: `openapi/spec.yaml`（透過 `process.cwd()` 解析）

---

*分析完成: 2026-04-09*
