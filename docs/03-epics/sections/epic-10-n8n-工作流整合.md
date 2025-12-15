# Epic 10: n8n 工作流整合

**目標**：平台與 n8n 工作流引擎無縫整合，支援雙向通訊、狀態監控和錯誤處理

**FRs 覆蓋**：FR54, FR55, FR56, FR57, FR58

**分工說明**：
- 平台負責：提供 API 供 n8n 調用、接收 n8n 回調、顯示執行狀態
- n8n 負責：流程編排、觸發源監控、外部系統整合

---

## Story 10.1: n8n 雙向通訊 API

**As a** 系統,
**I want** 提供完整的 API 供 n8n 工作流調用,
**So that** n8n 可以與平台進行雙向通訊。

**Acceptance Criteria:**

**Given** n8n 工作流需要調用平台功能
**When** 發送 API 請求
**Then** 平台提供以下 API 端點：
- `POST /api/n8n/documents` - 提交文件處理
- `GET /api/n8n/documents/{id}/status` - 查詢處理狀態
- `GET /api/n8n/documents/{id}/result` - 獲取處理結果
- `POST /api/n8n/webhook` - 接收 n8n 回調通知

**Given** n8n 調用 API
**When** 需要認證
**Then** 使用 API Key 認證機制
**And** API Key 綁定特定城市權限
**And** 記錄所有 API 調用至審計日誌

**Given** 平台需要通知 n8n
**When** 文件處理完成或發生錯誤
**Then** 平台調用配置的 n8n Webhook URL
**And** 傳送標準化的事件通知格式

**Given** API 調用
**When** 發生錯誤
**Then** 返回標準錯誤格式：錯誤代碼、錯誤訊息、追蹤 ID

**技術備註：**
- 創建 `ApiKey` 資料表（id, key, cityCode, name, permissions, createdAt, lastUsedAt）
- 實現 API Key 認證中間件
- 設計標準化的 API 回應格式

**FR 覆蓋**：FR54, FR55

---

## Story 10.2: Webhook 配置管理

**As a** 系統管理員,
**I want** 配置 n8n Webhook 設定,
**So that** 平台可以正確地向 n8n 發送通知。

**Acceptance Criteria:**

**Given** 系統管理員在系統設定頁面
**When** 導航至「n8n 整合」區塊
**Then** 顯示 Webhook 配置表單：
- n8n 基礎 URL
- Webhook 端點路徑
- 認證 Token
- 重試策略設定

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統發送測試請求至 n8n
**And** 顯示連線結果（成功/失敗/逾時）

**Given** Webhook 配置
**When** 按城市配置
**Then** 支援城市級別的 Webhook 配置
**And** 不同城市可以連接不同的 n8n 實例

**Given** Webhook 發送失敗
**When** 配置重試策略
**Then** 系統自動重試（最多 3 次）
**And** 重試間隔遞增（1秒、5秒、30秒）
**And** 超過重試次數後記錄失敗日誌

**技術備註：**
- 創建 `WebhookConfig` 資料表
- 實現重試佇列機制
- 配置超時和重試參數

**FR 覆蓋**：FR55

---

## Story 10.3: 工作流執行狀態查看

**As a** 用戶,
**I want** 查看 n8n 工作流的執行狀態,
**So that** 我可以了解自動化流程的運行情況。

**Acceptance Criteria:**

**Given** 用戶已登入
**When** 導航至「工作流監控」頁面
**Then** 顯示近期工作流執行列表
**And** 包含：工作流名稱、觸發時間、狀態、耗時、相關文件

**Given** 工作流執行列表
**When** 篩選條件變更
**Then** 支援按狀態、時間範圍、工作流類型篩選

**Given** 工作流執行
**When** 狀態為「執行中」
**Then** 顯示進度指示器
**And** 支援即時更新（輪詢或 WebSocket）

**Given** 工作流執行
**When** 狀態為「已完成」
**Then** 顯示綠色勾號圖標
**And** 顯示執行耗時

**Given** 工作流執行
**When** 狀態為「失敗」
**Then** 顯示紅色錯誤圖標
**And** 提供「查看詳情」連結

**技術備註：**
- 創建 `WorkflowExecution` 資料表追蹤執行記錄
- n8n 通過 Webhook 回報執行狀態
- 實現狀態輪詢或 WebSocket 更新

**FR 覆蓋**：FR56

---

## Story 10.4: 手動觸發工作流

**As a** Super User,
**I want** 手動觸發特定的 n8n 工作流,
**So that** 我可以在需要時重新處理文件或執行特定任務。

**Acceptance Criteria:**

**Given** Super User 在工作流監控頁面
**When** 點擊「手動觸發」按鈕
**Then** 顯示可觸發的工作流列表

**Given** 選擇工作流
**When** 需要輸入參數
**Then** 顯示參數輸入表單
**And** 包含：目標文件（可選）、執行參數

**Given** 確認觸發
**When** 提交請求
**Then** 系統調用 n8n Webhook 觸發工作流
**And** 創建執行記錄
**And** 顯示執行 ID 供追蹤

**Given** 手動觸發
**When** 觸發成功
**Then** 跳轉至執行詳情頁面
**And** 可以即時監控執行狀態

**Given** 手動觸發
**When** 觸發失敗
**Then** 顯示錯誤訊息
**And** 提供重試選項

**FR 覆蓋**：FR55, FR56

---

## Story 10.5: 工作流錯誤詳情查看

**As a** 用戶,
**I want** 查看工作流執行錯誤的詳細資訊,
**So that** 我可以診斷問題並採取修正措施。

**Acceptance Criteria:**

**Given** 工作流執行失敗
**When** 點擊「查看詳情」
**Then** 顯示錯誤詳情頁面：
- 錯誤發生時間
- 錯誤類型（連線失敗/逾時/業務錯誤/系統錯誤）
- 錯誤訊息
- 失敗的步驟
- 相關的文件或資源

**Given** 錯誤詳情頁面
**When** 查看技術細節
**Then** 可以展開查看：
- 錯誤堆疊追蹤
- 請求/回應詳情
- n8n 執行日誌（如有）

**Given** 可恢復的錯誤
**When** 查看錯誤詳情
**Then** 顯示「重試」按鈕
**And** 點擊後重新觸發工作流

**Given** 需要進一步調查
**When** 點擊「在 n8n 中查看」
**Then** 跳轉至 n8n 的執行詳情頁面（新視窗）

**技術備註：**
- 在 `WorkflowExecution` 中增加 errorDetails JSON 欄位
- 儲存 n8n 回傳的錯誤資訊
- 配置 n8n 執行頁面的 URL 模板

**FR 覆蓋**：FR57

---

## Story 10.6: 文件處理進度追蹤

**As a** 用戶,
**I want** 追蹤通過 n8n 工作流處理的文件進度,
**So that** 我可以了解自動化處理的狀態。

**Acceptance Criteria:**

**Given** 文件通過 n8n 工作流提交
**When** 查看文件詳情
**Then** 顯示完整的處理時間軸：
- n8n 觸發時間
- 平台接收時間
- 各處理階段的開始/完成時間
- 當前狀態

**Given** 文件處理中
**When** 查看進度
**Then** 顯示當前步驟和預估剩餘時間
**And** 支援即時更新

**Given** 文件處理完成
**When** 查看結果
**Then** 顯示處理結果摘要
**And** 可以連結至審核頁面

**Given** 文件列表頁面
**When** 查看來自 n8n 的文件
**Then** 顯示來源標記「n8n 工作流」
**And** 顯示觸發的工作流名稱

**技術備註：**
- 在 Document 中增加 workflowExecutionId 關聯
- 記錄各階段的時間戳
- 計算預估剩餘時間基於歷史數據

**FR 覆蓋**：FR58

---

## Story 10.7: n8n 連接狀態監控

**As a** 系統管理員,
**I want** 監控 n8n 的連接狀態,
**So that** 我可以及時發現和處理連接問題。

**Acceptance Criteria:**

**Given** 系統管理員在系統監控頁面
**When** 查看「n8n 連接狀態」區塊
**Then** 顯示：
- 連接狀態（正常/異常/未配置）
- 最後成功通訊時間
- 24 小時內的成功/失敗調用統計

**Given** n8n 連接異常
**When** 連續 3 次調用失敗
**Then** 系統狀態變更為「異常」
**And** 發送告警通知給管理員

**Given** 連接狀態頁面
**When** 點擊「查看歷史」
**Then** 顯示近期的連接狀態變化記錄
**And** 包含每次狀態變化的原因

**Given** 連接異常後恢復
**When** 調用成功
**Then** 系統狀態自動恢復為「正常」
**And** 發送恢復通知

**技術備註：**
- 實現健康檢查機制（定期 ping n8n）
- 創建 `SystemHealthLog` 記錄狀態變化
- 配置告警通知（Email/Teams）

**FR 覆蓋**：FR56, FR57

---
