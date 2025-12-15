# Epic 11: 對外 API 服務

**目標**：為外部系統提供 RESTful API，支援發票提交、狀態查詢、結果獲取和 Webhook 通知

**FRs 覆蓋**：FR64, FR65, FR66, FR67, FR68

---

## Story 11.1: API 發票提交端點

**As a** 外部系統開發者,
**I want** 通過 API 提交發票文件進行處理,
**So that** 我可以將發票處理功能整合到我的應用中。

**Acceptance Criteria:**

**Given** 外部系統已獲得 API 訪問權限
**When** 調用 `POST /api/v1/invoices` 端點
**Then** 可以提交發票文件，支援以下方式：
- 文件直接上傳（multipart/form-data）
- Base64 編碼內容
- 外部 URL 引用

**Given** 提交發票請求
**When** 請求包含有效內容
**Then** API 返回：
- HTTP 202 Accepted
- 處理任務 ID
- 預估處理時間
- 狀態查詢 URL

**Given** 提交發票請求
**When** 請求包含可選參數
**Then** 支援以下參數：
- `cityCode` - 指定城市（必填）
- `priority` - 優先級（normal/high）
- `callbackUrl` - 完成回調 URL
- `metadata` - 自定義元數據（JSON）

**Given** 提交發票請求
**When** 文件格式不支援或大小超限
**Then** 返回 HTTP 400 Bad Request
**And** 包含清晰的錯誤訊息和錯誤代碼

**技術備註：**
- 支援格式：PDF, PNG, JPG, TIFF
- 文件大小限制：50MB
- 實現請求速率限制（每分鐘 60 次）

**FR 覆蓋**：FR64

---

## Story 11.2: API 處理狀態查詢端點

**As a** 外部系統開發者,
**I want** 查詢已提交發票的處理狀態,
**So that** 我可以追蹤處理進度並在完成時獲取結果。

**Acceptance Criteria:**

**Given** 已提交發票並獲得任務 ID
**When** 調用 `GET /api/v1/invoices/{taskId}/status`
**Then** 返回處理狀態資訊：
- `status` - 狀態碼（queued/processing/completed/failed/review_required）
- `progress` - 進度百分比
- `currentStep` - 當前步驟描述
- `createdAt` - 創建時間
- `updatedAt` - 最後更新時間
- `estimatedCompletion` - 預估完成時間

**Given** 查詢狀態
**When** 狀態為 `completed`
**Then** 額外返回：
- `resultUrl` - 結果獲取 URL
- `completedAt` - 完成時間
- `confidenceScore` - 整體信心度

**Given** 查詢狀態
**When** 狀態為 `failed`
**Then** 額外返回：
- `error.code` - 錯誤代碼
- `error.message` - 錯誤訊息
- `error.retryable` - 是否可重試

**Given** 查詢不存在的任務 ID
**When** 調用狀態查詢
**Then** 返回 HTTP 404 Not Found

**FR 覆蓋**：FR65

---

## Story 11.3: API 處理結果獲取端點

**As a** 外部系統開發者,
**I want** 獲取發票處理的完整結果,
**So that** 我可以使用提取的數據進行後續處理。

**Acceptance Criteria:**

**Given** 發票處理已完成
**When** 調用 `GET /api/v1/invoices/{taskId}/result`
**Then** 返回完整的提取結果：
- taskId - 任務 ID
- status - 狀態
- forwarder - Forwarder 資訊（id, name, code）
- fields - 提取欄位陣列（name, value, confidence, source）
- metadata - 元數據
- processedAt - 處理完成時間

**Given** 獲取結果
**When** 需要特定格式
**Then** 支援 `format` 參數：
- `json` - 標準 JSON 格式（預設）
- `csv` - CSV 格式（僅欄位數據）
- `xml` - XML 格式

**Given** 獲取結果
**When** 處理狀態不是 `completed`
**Then** 返回 HTTP 409 Conflict
**And** 包含當前狀態資訊

**Given** 獲取結果
**When** 結果已過期（超過保留期限）
**Then** 返回 HTTP 410 Gone
**And** 提示結果已歸檔

**FR 覆蓋**：FR66

---

## Story 11.4: Webhook 通知服務

**As a** 外部系統開發者,
**I want** 在發票處理完成時接收 Webhook 通知,
**So that** 我不需要持續輪詢狀態。

**Acceptance Criteria:**

**Given** 提交發票時指定了 `callbackUrl`
**When** 處理完成或失敗
**Then** 系統發送 POST 請求至回調 URL，包含：
- event - 事件類型
- taskId - 任務 ID
- status - 處理狀態
- timestamp - 時間戳
- result - 結果摘要（confidenceScore, forwarder, resultUrl）

**Given** Webhook 請求
**When** 需要驗證來源
**Then** 請求包含簽名 Header：
- `X-Signature` - HMAC-SHA256 簽名
- `X-Timestamp` - 請求時間戳
**And** 接收方可以驗證請求真實性

**Given** Webhook 發送
**When** 目標 URL 無回應或返回錯誤
**Then** 系統自動重試：
- 最多重試 3 次
- 重試間隔：1分鐘、5分鐘、30分鐘
**And** 超過重試次數後記錄失敗日誌

**Given** Webhook 通知
**When** 事件類型
**Then** 支援以下事件：
- `invoice.processing` - 開始處理
- `invoice.completed` - 處理完成
- `invoice.failed` - 處理失敗
- `invoice.review_required` - 需要人工審核

**技術備註：**
- 使用消息佇列確保可靠投遞
- 記錄所有 Webhook 發送記錄
- 提供 Webhook 日誌查詢 API

**FR 覆蓋**：FR67

---

## Story 11.5: API 訪問控制與認證

**As a** 系統管理員,
**I want** 管理 API 訪問權限和認證,
**So that** 確保 API 安全並可追蹤使用情況。

**Acceptance Criteria:**

**Given** 外部系統需要訪問 API
**When** 發送請求
**Then** 必須在 Header 中包含有效的 API Key：
- `Authorization: Bearer {api_key}`
**And** 無效或缺失的 API Key 返回 HTTP 401

**Given** 系統管理員在管理頁面
**When** 管理 API Key
**Then** 可以執行：
- 創建新 API Key（指定名稱、城市權限、速率限制）
- 查看現有 API Key 列表
- 停用/重新啟用 API Key
- 刪除 API Key（不可恢復）

**Given** API Key 創建
**When** 設定權限
**Then** 可以配置：
- 允許訪問的城市（cityCode 列表）
- 允許的操作（submit/query/result）
- 速率限制（每分鐘請求數）
- 有效期限（可選）

**Given** API 調用
**When** 超過速率限制
**Then** 返回 HTTP 429 Too Many Requests
**And** 包含 `Retry-After` Header

**Given** API 調用
**When** 任何請求
**Then** 記錄至審計日誌：
- API Key ID
- 調用端點
- 請求參數
- 回應狀態
- 調用時間
- 客戶端 IP

**技術備註：**
- API Key 使用安全隨機生成（32 字符）
- 儲存 API Key 的 Hash 值，不儲存明文
- 實現基於 Redis 的速率限制

**FR 覆蓋**：FR68

---

## Story 11.6: API 文檔與開發者支援

**As a** 外部系統開發者,
**I want** 查閱完整的 API 文檔,
**So that** 我可以快速整合發票處理功能。

**Acceptance Criteria:**

**Given** 開發者需要了解 API
**When** 訪問 `/api/docs` 端點
**Then** 顯示互動式 API 文檔（Swagger UI）：
- 所有端點的詳細說明
- 請求/回應範例
- 可以直接測試 API（需要 API Key）

**Given** API 文檔
**When** 查看端點說明
**Then** 包含：
- 端點 URL 和方法
- 請求參數說明
- 回應格式和狀態碼
- 錯誤代碼列表
- 使用範例（cURL, JavaScript, Python）

**Given** 開發者需要範例代碼
**When** 查看文檔
**Then** 提供以下語言的整合範例：
- JavaScript/TypeScript
- Python
- C#
**And** 包含完整的錯誤處理範例

**技術備註：**
- 使用 OpenAPI 3.0 規範
- 自動從代碼生成文檔

**FR 覆蓋**：FR64, FR65, FR66 (整合文檔)

---
