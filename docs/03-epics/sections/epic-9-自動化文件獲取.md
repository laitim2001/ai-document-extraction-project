# Epic 9: 自動化文件獲取

**目標**：系統可自動從 SharePoint 獲取待處理文件，從 Outlook 郵件提取附件

**FRs 覆蓋**：FR2, FR3

**分工說明**：平台提供 API 接口，n8n 負責監控觸發源並調用 API

---

## Story 9.1: SharePoint 文件監控 API

**As a** 系統,
**I want** 提供 API 供外部獲取 SharePoint 文件並提交處理,
**So that** n8n 可以監控 SharePoint 並自動提交新文件。

**Acceptance Criteria:**

**Given** 外部系統（n8n）偵測到 SharePoint 新文件
**When** 調用平台 API 提交文件
**Then** API 接受以下參數：
- 文件 URL（SharePoint 位置）
- 來源城市代碼
- 來源類型（sharepoint）
- 原始文件名

**Given** 平台接收到 SharePoint 文件提交請求
**When** 處理請求
**Then** 系統從 SharePoint URL 下載文件
**And** 儲存至 Azure Blob Storage
**And** 創建處理任務（進入 Epic 2 的處理流程）

**Given** SharePoint 文件下載
**When** 下載成功
**Then** 返回處理任務 ID
**And** 可用於後續狀態查詢

**Given** SharePoint 文件下載
**When** 下載失敗（權限問題、文件不存在）
**Then** 返回適當的錯誤代碼和訊息
**And** 記錄錯誤至日誌

**技術備註：**
- 創建 `POST /api/documents/from-sharepoint` 端點
- 使用 Microsoft Graph API 讀取 SharePoint 文件
- 配置 Azure AD 應用程式權限（Files.Read.All）

**FR 覆蓋**：FR2

---

## Story 9.2: SharePoint 連線配置

**As a** 系統管理員,
**I want** 配置 SharePoint 連線設定,
**So that** 系統可以正確存取 SharePoint 資源。

**Acceptance Criteria:**

**Given** 系統管理員在系統設定頁面
**When** 導航至「SharePoint 整合」區塊
**Then** 顯示連線配置表單：
- SharePoint Site URL
- 文件庫路徑
- Azure AD 租戶 ID
- 應用程式 ID
- 客戶端密鑰（加密儲存）

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統驗證連線設定
**And** 顯示連線結果（成功/失敗）

**Given** 連線測試成功
**When** 點擊「儲存」
**Then** 系統儲存配置
**And** 配置立即生效

**Given** 配置的 SharePoint 路徑
**When** 按城市配置不同路徑
**Then** 支援城市級別的 SharePoint 配置
**And** 不同城市可以監控不同的文件庫

**FR 覆蓋**：FR2

---

## Story 9.3: Outlook 郵件附件提取 API

**As a** 系統,
**I want** 提供 API 供外部提取 Outlook 郵件附件並提交處理,
**So that** n8n 可以監控郵箱並自動提取發票附件。

**Acceptance Criteria:**

**Given** 外部系統（n8n）偵測到符合條件的郵件
**When** 調用平台 API 提交附件
**Then** API 接受以下參數：
- 郵件 ID 或附件直接內容（Base64）
- 來源城市代碼
- 來源類型（outlook）
- 寄件者資訊
- 郵件主旨

**Given** 平台接收到郵件附件提交請求
**When** 處理請求
**Then** 系統解析附件內容
**And** 過濾非發票文件（非 PDF/圖片）
**And** 為每個有效附件創建處理任務

**Given** 郵件包含多個附件
**When** 處理郵件
**Then** 系統為每個有效附件創建獨立的處理任務
**And** 記錄附件與原始郵件的關聯

**Given** 附件處理完成
**When** 返回結果
**Then** 包含各附件的處理任務 ID
**And** 包含被過濾（跳過）的附件清單

**技術備註：**
- 創建 `POST /api/documents/from-outlook` 端點
- 支援 Microsoft Graph API 或直接附件上傳
- 實現文件類型過濾邏輯

**FR 覆蓋**：FR3

---

## Story 9.4: Outlook 連線配置

**As a** 系統管理員,
**I want** 配置 Outlook 連線設定,
**So that** 系統可以正確存取郵箱資源。

**Acceptance Criteria:**

**Given** 系統管理員在系統設定頁面
**When** 導航至「Outlook 整合」區塊
**Then** 顯示連線配置表單：
- 郵箱地址
- Azure AD 租戶 ID
- 應用程式 ID
- 客戶端密鑰（加密儲存）

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統驗證連線設定
**And** 顯示連線結果（成功/失敗）

**Given** 連線配置
**When** 按城市配置不同郵箱
**Then** 支援城市級別的 Outlook 配置
**And** 不同城市可以監控不同的郵箱

**Given** 郵件過濾規則
**When** 配置過濾條件
**Then** 可以設定：
- 寄件者白名單/黑名單
- 主旨關鍵字
- 附件類型過濾

**FR 覆蓋**：FR3

---

## Story 9.5: 自動獲取來源追蹤

**As a** 用戶,
**I want** 查看自動獲取的文件來源資訊,
**So that** 我可以追蹤文件的原始來源。

**Acceptance Criteria:**

**Given** 查看發票詳情
**When** 發票來自 SharePoint
**Then** 顯示：
- 來源類型：SharePoint
- SharePoint 文件路徑
- 獲取時間
- 原始文件名

**Given** 查看發票詳情
**When** 發票來自 Outlook
**Then** 顯示：
- 來源類型：Outlook
- 寄件者地址
- 郵件主旨
- 郵件接收時間
- 附件原始名稱

**Given** 發票列表頁面
**When** 需要篩選來源
**Then** 支援按來源類型篩選（手動上傳/SharePoint/Outlook）

**技術備註：**
- 在 Document 表增加 sourceType、sourceMetadata 欄位
- sourceMetadata 使用 JSON 儲存來源詳情

**FR 覆蓋**：FR2, FR3

---
