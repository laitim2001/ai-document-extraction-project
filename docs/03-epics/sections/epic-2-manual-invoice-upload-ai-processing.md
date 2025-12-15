# Epic 2: 手動發票上傳與 AI 處理

**目標**：用戶可以上傳發票文件，系統自動進行 OCR 提取、Forwarder 識別、欄位映射並計算信心度

**FRs 覆蓋**：FR1, FR4, FR5, FR6, FR7, FR8

---

## Story 2.1: 文件上傳介面與驗證

**As a** 數據處理員,
**I want** 上傳發票文件到系統,
**So that** 系統可以開始處理和提取發票內容。

**Acceptance Criteria:**

**Given** 用戶在發票上傳頁面
**When** 點擊上傳區域或拖放文件
**Then** 系統接受 PDF、JPG、PNG 格式的文件
**And** 單個文件大小限制為 10MB
**And** 顯示上傳進度指示器

**Given** 用戶選擇了不支援的文件格式
**When** 嘗試上傳
**Then** 系統顯示錯誤訊息「不支援的文件格式，請上傳 PDF、JPG 或 PNG」

**Given** 用戶選擇多個文件（批量上傳）
**When** 確認上傳
**Then** 系統接受最多 20 個文件
**And** 顯示每個文件的上傳狀態

**技術備註：**
- 創建 `Document` 資料表（id, fileName, fileType, fileSize, filePath, status, uploadedBy, cityCode, createdAt）
- 文件儲存至 Azure Blob Storage
- 實現前端拖放上傳組件

**FR 覆蓋**：FR1

---

## Story 2.2: 文件 OCR 提取服務

**As a** 系統,
**I want** 對上傳的發票進行 OCR 文字提取,
**So that** 可以獲取發票中的所有文字內容供後續處理。

**Acceptance Criteria:**

**Given** 文件已成功上傳
**When** 系統開始處理文件
**Then** 調用 Azure Document Intelligence API 進行 OCR
**And** 提取文件中的所有文字和結構化數據
**And** 處理時間 < 30 秒（單張發票）

**Given** OCR 處理成功
**When** 結果返回
**Then** 系統儲存原始 OCR 結果（JSON 格式）
**And** 更新文件狀態為「OCR 完成」

**Given** OCR 處理失敗
**When** API 返回錯誤
**Then** 系統記錄錯誤詳情
**And** 更新文件狀態為「OCR 失敗」
**And** 標記為需要人工處理

**技術備註：**
- 創建 `OcrResult` 資料表（id, documentId, rawResult, extractedText, processingTime, createdAt）
- 實現 FastAPI 端點處理 OCR 請求
- 配置 Azure Document Intelligence 連線

**FR 覆蓋**：FR4

---

## Story 2.3: Forwarder 自動識別

**As a** 系統,
**I want** 自動識別發票所屬的 Forwarder,
**So that** 可以應用該 Forwarder 特定的映射規則。

**Acceptance Criteria:**

**Given** OCR 提取完成
**When** 系統分析提取的文字
**Then** 系統識別 Forwarder 標識（公司名稱、Logo 文字、格式特徵）
**And** 返回 Forwarder ID 和信心度分數

**Given** 系統成功識別 Forwarder
**When** 信心度 >= 80%
**Then** 自動關聯該 Forwarder Profile
**And** 記錄識別結果

**Given** 系統無法識別 Forwarder
**When** 信心度 < 80% 或無匹配
**Then** 標記為「未識別 Forwarder」
**And** 列入需人工指定的隊列

**技術備註：**
- 創建 `Forwarder` 資料表（id, name, code, identificationPatterns, status, createdAt）
- 創建 `ForwarderIdentification` 結果記錄
- 實現模式匹配識別邏輯

**FR 覆蓋**：FR5

---

## Story 2.4: 欄位映射與提取

**As a** 系統,
**I want** 將 OCR 提取的內容映射到標準化欄位,
**So that** 數據可以被統一格式儲存和使用。

**Acceptance Criteria:**

**Given** Forwarder 已識別
**When** 系統應用該 Forwarder 的映射規則
**Then** 系統提取並映射約 90 個標準 Header 欄位
**And** 每個欄位包含：值、來源位置、提取方法

**Given** 映射規則存在
**When** OCR 文字包含匹配內容
**Then** 系統提取對應的值
**And** 記錄提取來源（頁碼、位置）

**Given** 某些欄位無法映射
**When** 規則無匹配或值不存在
**Then** 該欄位標記為「空值」
**And** 記錄無法映射的原因

**技術備註：**
- 創建 `ExtractionResult` 資料表（id, documentId, forwarderId, fieldMappings JSON, status, createdAt）
- 創建 `MappingRule` 資料表（id, forwarderId, fieldName, extractionPattern, priority）
- 實現映射引擎服務

**FR 覆蓋**：FR6

---

## Story 2.5: 信心度評分計算

**As a** 系統,
**I want** 為每個提取結果計算信心度評分,
**So that** 可以識別需要人工審核的項目。

**Acceptance Criteria:**

**Given** 欄位映射完成
**When** 系統計算信心度
**Then** 為每個欄位計算 0-100% 的信心度分數
**And** 計算整體文件的平均信心度

**Given** 信心度計算完成
**When** 結果返回
**Then** 欄位按信心度分類：
- 高信心 (>=90%)：綠色
- 中信心 (70-89%)：黃色
- 低信心 (<70%)：紅色

**Given** 信心度計算因素
**When** 評估欄位
**Then** 考慮以下因素：
- OCR 識別清晰度
- 規則匹配精確度
- 數據格式驗證結果
- 歷史修正頻率

**技術備註：**
- 在 `ExtractionResult` 中增加 confidenceScores JSON 欄位
- 實現信心度計算算法
- 配置信心度閾值參數

**FR 覆蓋**：FR7

---

## Story 2.6: 處理路徑自動分流

**As a** 系統,
**I want** 根據信心度自動分流處理路徑,
**So that** 高信心度的發票可以自動處理，低信心度的需要人工審核。

**Acceptance Criteria:**

**Given** 信心度評分完成
**When** 整體信心度 >= 95%
**Then** 文件分流至「自動通過」路徑
**And** 無需人工審核直接完成

**Given** 信心度評分完成
**When** 整體信心度在 80-94% 之間
**Then** 文件分流至「快速確認」路徑
**And** 僅需確認低信心度欄位

**Given** 信心度評分完成
**When** 整體信心度 < 80%
**Then** 文件分流至「完整審核」路徑
**And** 需要逐欄檢查和修正

**Given** 分流完成
**When** 更新文件狀態
**Then** 記錄分流決策和原因
**And** 通知相關審核人員（如需要）

**技術備註：**
- 在 `Document` 中增加 processingPath 欄位
- 創建 `ProcessingQueue` 資料表追蹤待審核項目
- 配置分流閾值參數

**FR 覆蓋**：FR8

---

## Story 2.7: 處理狀態追蹤與顯示

**As a** 數據處理員,
**I want** 查看已上傳文件的處理狀態,
**So that** 我可以了解處理進度並採取後續行動。

**Acceptance Criteria:**

**Given** 用戶在文件列表頁面
**When** 查看已上傳的文件
**Then** 系統顯示每個文件的處理狀態：
- 上傳中 / 已上傳
- OCR 處理中 / OCR 完成 / OCR 失敗
- 映射中 / 映射完成
- 待審核 / 審核中 / 已完成

**Given** 文件處理中
**When** 狀態更新
**Then** 頁面自動刷新顯示最新狀態（輪詢或 WebSocket）

**Given** 文件處理出錯
**When** 任一步驟失敗
**Then** 顯示錯誤圖標和錯誤原因
**And** 提供「重試」按鈕

**技術備註：**
- 實現狀態輪詢機制（每 5 秒）
- 使用 React Query 管理狀態
- 實現錯誤重試邏輯

**FR 覆蓋**：FR1, FR4, FR5, FR6, FR7, FR8 (整合)

---
