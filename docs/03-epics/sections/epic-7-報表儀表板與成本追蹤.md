# Epic 7: 報表儀表板與成本追蹤

**目標**：用戶可以查看處理統計儀表板，城市/區域經理可以匯出報表，財務可以查看成本分攤

**FRs 覆蓋**：FR30, FR31, FR32, FR33, FR34, FR35, FR69, FR70, FR71, FR72

---

## Story 7.1: 處理統計儀表板

**As a** 用戶,
**I want** 查看處理統計儀表板,
**So that** 我可以了解整體處理狀況。

**Acceptance Criteria:**

**Given** 用戶已登入
**When** 導航至「儀表板」頁面
**Then** 顯示關鍵指標卡片：
- 今日處理量 / 本週處理量 / 本月處理量
- 成功率（百分比）
- 自動化率（無需人工審核的比例）
- 平均處理時間
- 待審核數量

**Given** 儀表板頁面載入
**When** 數據正在載入
**Then** 顯示 Skeleton 載入狀態
**And** 載入完成後平滑過渡到實際數據

**Given** 儀表板頁面
**When** 數據有更新
**Then** 支援手動刷新按鈕
**And** 顯示最後更新時間

**FR 覆蓋**：FR30

---

## Story 7.2: 時間範圍篩選

**As a** 用戶,
**I want** 按時間範圍篩選報表數據,
**So that** 我可以分析特定時期的表現。

**Acceptance Criteria:**

**Given** 在儀表板頁面
**When** 點擊時間範圍選擇器
**Then** 顯示預設選項：今日、本週、本月、本季、本年

**Given** 選擇「自訂範圍」
**When** 顯示日期選擇器
**Then** 可以選擇開始日期和結束日期
**And** 最大範圍限制為 1 年

**Given** 時間範圍變更
**When** 選擇新的時間範圍
**Then** 所有圖表和指標更新為該時間範圍的數據
**And** URL 參數同步更新（支援書籤）

**FR 覆蓋**：FR31

---

## Story 7.3: Forwarder 篩選

**As a** 用戶,
**I want** 按 Forwarder 篩選報表數據,
**So that** 我可以分析特定 Forwarder 的表現。

**Acceptance Criteria:**

**Given** 在儀表板頁面
**When** 點擊 Forwarder 篩選器
**Then** 顯示所有 Forwarder 的多選清單
**And** 支援搜尋 Forwarder 名稱

**Given** 選擇特定 Forwarder
**When** 篩選器變更
**Then** 所有圖表和指標更新為該 Forwarder 的數據

**Given** 選擇多個 Forwarder
**When** 查看圖表
**Then** 可以顯示對比視圖（各 Forwarder 的對比）

**FR 覆蓋**：FR32

---

## Story 7.4: 費用明細報表匯出

**As a** 城市經理,
**I want** 匯出費用明細報表,
**So that** 我可以進行財務分析和報告。

**Acceptance Criteria:**

**Given** 城市經理在報表頁面
**When** 點擊「匯出報表」按鈕
**Then** 顯示匯出選項對話框

**Given** 匯出選項對話框
**When** 配置匯出參數
**Then** 可以選擇：
- 時間範圍
- 匯出格式（Excel）
- 包含欄位（可勾選）

**Given** 確認匯出
**When** 系統生成報表
**Then** 報表包含：發票編號、上傳時間、處理時間、Forwarder、AI 成本、審核時長
**And** 下載完成後顯示成功訊息

**Given** 匯出大量數據
**When** 數據超過 10,000 筆
**Then** 系統採用背景處理
**And** 完成後發送通知和下載連結

**FR 覆蓋**：FR33

---

## Story 7.5: 跨城市匯總報表

**As a** 區域經理,
**I want** 查看跨城市的匯總報表,
**So that** 我可以比較各城市的表現。

**Acceptance Criteria:**

**Given** 區域經理已登入
**When** 導航至「區域報表」頁面
**Then** 顯示各城市的對比數據表格

**Given** 對比數據表格
**When** 查看內容
**Then** 包含以下欄位：
- 城市名稱
- 處理量
- 成功率
- 自動化率
- 平均處理時間
- AI 成本

**Given** 區域報表頁面
**When** 點擊某個城市
**Then** 展開顯示該城市的詳細趨勢圖

**Given** 區域報表
**When** 點擊「匯出」
**Then** 可以匯出跨城市對比報表（Excel 格式）

**FR 覆蓋**：FR34

---

## Story 7.6: AI API 使用量與成本顯示

**As a** 用戶,
**I want** 查看 AI API 使用量和成本,
**So that** 我可以監控和控制 AI 服務支出。

**Acceptance Criteria:**

**Given** 在儀表板頁面
**When** 查看「AI 成本」區塊
**Then** 顯示：
- API 調用次數（Document Intelligence / OpenAI）
- Token 使用量（輸入/輸出）
- 估算成本（美元）
- 與上期對比（增減百分比）

**Given** 成本區塊
**When** 點擊「查看詳情」
**Then** 顯示成本明細頁面
**And** 包含按日期的成本趨勢圖

**Given** 成本趨勢圖
**When** 發現異常高峰
**Then** 可以點擊該日期查看當日處理明細

**FR 覆蓋**：FR35

---

## Story 7.7: 城市處理數量追蹤

**As a** 系統,
**I want** 按城市追蹤發票處理數量,
**So that** 可以進行成本分攤和績效評估。

**Acceptance Criteria:**

**Given** 發票處理完成
**When** 系統記錄處理結果
**Then** 累計該城市的處理數量統計
**And** 分別記錄：總處理量、自動通過量、人工審核量

**Given** 系統記錄處理量
**When** 按時間維度聚合
**Then** 支援按日、週、月、年查詢

**技術備註：**
- 創建 `ProcessingStatistics` 資料表
- 支援增量更新和快照備份

**FR 覆蓋**：FR69

---

## Story 7.8: 城市 AI 成本追蹤

**As a** 系統,
**I want** 按城市追蹤 AI API 調用成本,
**So that** 可以準確分攤成本到各城市。

**Acceptance Criteria:**

**Given** AI API 被調用
**When** 系統記錄調用
**Then** 記錄以下資訊：
- 調用城市（cityCode）
- API 類型（Document Intelligence / OpenAI）
- Token 數（輸入/輸出）
- 估算成本（基於最新單價）
- 關聯的文件 ID

**Given** 成本記錄
**When** 查詢城市成本
**Then** 可以按時間範圍聚合計算

**技術備註：**
- 創建 `ApiUsageLog` 資料表
- 配置 API 單價參數（可更新）

**FR 覆蓋**：FR70

---

## Story 7.9: 城市成本報表

**As a** 財務人員,
**I want** 查看城市級別的成本報表,
**So that** 我可以進行預算管理和成本控制。

**Acceptance Criteria:**

**Given** 財務人員已登入
**When** 導航至「成本報表」頁面
**Then** 顯示各城市的成本明細表格

**Given** 成本明細表格
**When** 查看內容
**Then** 包含：城市、處理量、AI 成本、人工成本（估算）、總成本

**Given** 成本報表頁面
**When** 查看趨勢
**Then** 顯示各城市成本的月度趨勢圖
**And** 可以識別成本異常增長

**FR 覆蓋**：FR71

---

## Story 7.10: 月度成本分攤報告

**As a** 財務人員,
**I want** 生成月度成本分攤報告,
**So that** 可以進行內部成本結算。

**Acceptance Criteria:**

**Given** 財務人員在成本報表頁面
**When** 點擊「生成月度報告」
**Then** 顯示月份選擇對話框

**Given** 選擇月份
**When** 點擊「生成」
**Then** 系統生成包含以下內容的報告：
- 各城市處理量統計
- 各城市 AI API 成本明細
- 成本分攤比例
- 與上月對比

**Given** 報告生成完成
**When** 下載報告
**Then** 支援 Excel 和 PDF 格式
**And** PDF 格式包含圖表和摘要

**FR 覆蓋**：FR72

---
