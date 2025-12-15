# Epic 3: 發票審核與修正工作流

**目標**：數據處理員可以審核 AI 提取結果，修正錯誤，並將複雜案例升級給 Super User

**FRs 覆蓋**：FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16

---

## Story 3.1: 待審核發票列表

**As a** 數據處理員,
**I want** 查看分配給我的待審核發票列表,
**So that** 我可以有效地安排審核工作。

**Acceptance Criteria:**

**Given** 數據處理員已登入
**When** 導航至「待審核」頁面
**Then** 系統顯示分配給該用戶的待審核發票列表
**And** 列表包含：文件名、Forwarder、上傳時間、整體信心度、處理路徑
**And** 列表按上傳時間排序（最舊優先）

**Given** 待審核列表
**When** 篩選條件變更
**Then** 支援按 Forwarder、信心度範圍、處理路徑篩選

**Given** 待審核列表
**When** 點擊某筆發票
**Then** 進入該發票的審核詳情頁面

**FR 覆蓋**：FR9

---

## Story 3.2: 並排 PDF 對照審核界面

**As a** 數據處理員,
**I want** 在同一畫面看到原始 PDF 和提取結果的對照,
**So that** 我可以快速核對提取的準確性。

**Acceptance Criteria:**

**Given** 用戶進入發票審核頁面
**When** 頁面載入完成
**Then** 左側顯示原始 PDF 文件（可縮放、翻頁）
**And** 右側顯示提取結果表單

**Given** 審核界面顯示
**When** 用戶選中某個提取欄位
**Then** PDF 視圖自動滾動並高亮對應的來源位置

**Given** PDF 文件多頁
**When** 用戶翻頁
**Then** PDF 視圖支援快速翻頁導航
**And** 顯示當前頁碼 / 總頁數

**Given** 用戶調整視窗大小
**When** 螢幕寬度變化
**Then** 並排佈局自適應調整比例

**FR 覆蓋**：FR10, UX-03

---

## Story 3.3: 信心度顏色編碼顯示

**As a** 數據處理員,
**I want** 通過顏色快速識別需要關注的欄位,
**So that** 我可以優先檢查低信心度的項目。

**Acceptance Criteria:**

**Given** 審核界面的提取結果
**When** 顯示各欄位
**Then** 欄位背景顏色依信心度顯示：
- 綠色：>= 90%（高信心）
- 黃色：70-89%（中信心）
- 紅色：< 70%（低信心）

**Given** 欄位顯示
**When** 滑鼠懸停在信心度指示器上
**Then** 顯示具體的信心度百分比和計算因素

**Given** 審核界面
**When** 點擊「僅顯示低信心度欄位」
**Then** 隱藏高信心度欄位，僅顯示需要關注的項目

**FR 覆蓋**：FR16, UX-04

---

## Story 3.4: 確認提取結果

**As a** 數據處理員,
**I want** 確認正確的提取結果,
**So that** 已驗證的數據可以進入下一步處理。

**Acceptance Criteria:**

**Given** 用戶審核完所有欄位
**When** 所有欄位無需修改
**Then** 可以點擊「確認無誤」按鈕

**Given** 點擊「確認無誤」
**When** 系統處理確認
**Then** 文件狀態更新為「已審核」
**And** 記錄審核人、審核時間
**And** 返回待審核列表

**Given** 快速確認路徑的發票
**When** 進入審核頁面
**Then** 僅顯示需要確認的低信心度欄位
**And** 提供「全部確認」快捷按鈕

**FR 覆蓋**：FR11

---

## Story 3.5: 修正提取結果

**As a** 數據處理員,
**I want** 修正錯誤的提取值,
**So that** 最終數據的準確性得到保證。

**Acceptance Criteria:**

**Given** 用戶發現某欄位提取錯誤
**When** 點擊該欄位
**Then** 欄位變為可編輯狀態

**Given** 修改欄位值
**When** 輸入新值
**Then** 系統即時驗證格式（日期、數字、必填等）
**And** 顯示驗證結果

**Given** 完成修改
**When** 點擊「儲存修正」
**Then** 系統儲存修正後的值
**And** 記錄原始值和修正值
**And** 記錄修正人和時間

**Given** 修改多個欄位
**When** 離開頁面前未儲存
**Then** 系統提示「有未儲存的修改，是否離開？」

**FR 覆蓋**：FR12

---

## Story 3.6: 修正類型標記

**As a** 數據處理員,
**I want** 標記修正是「正常修正」或「特例不學習」,
**So that** 系統可以正確地進行規則學習。

**Acceptance Criteria:**

**Given** 用戶修正某個欄位
**When** 完成修正
**Then** 系統提示選擇修正類型：
- 正常修正：系統應學習此模式
- 特例不學習：此為特殊情況，不應影響規則

**Given** 選擇「正常修正」
**When** 儲存修正
**Then** 系統記錄此修正供規則學習分析

**Given** 選擇「特例不學習」
**When** 儲存修正
**Then** 系統標記此修正為特例
**And** 不納入規則學習統計

**Given** 同一欄位被標記為「正常修正」達 3 次
**When** 系統分析修正模式
**Then** 觸發規則升級建議流程（Epic 4）

**FR 覆蓋**：FR13

---

## Story 3.7: 升級複雜案例

**As a** 數據處理員,
**I want** 將無法處理的複雜案例升級給 Super User,
**So that** 專業人員可以處理特殊情況。

**Acceptance Criteria:**

**Given** 用戶遇到無法判斷的情況
**When** 點擊「升級案例」按鈕
**Then** 系統顯示升級表單

**Given** 填寫升級原因
**When** 提交升級請求
**Then** 文件狀態更新為「已升級」
**And** 指派給 Super User 隊列
**And** 通知相關 Super User

**Given** 升級表單
**When** 填寫內容
**Then** 必須選擇升級原因類型：
- 無法識別 Forwarder
- 映射規則不適用
- 文件品質問題
- 其他（需說明）

**FR 覆蓋**：FR14

---

## Story 3.8: Super User 處理升級案例

**As a** Super User,
**I want** 處理數據處理員升級的複雜案例,
**So that** 特殊情況可以得到正確處理。

**Acceptance Criteria:**

**Given** Super User 已登入
**When** 導航至「升級案例」頁面
**Then** 系統顯示所有待處理的升級案例
**And** 包含：升級人、升級時間、升級原因、原始審核進度

**Given** Super User 查看升級案例
**When** 進入案例詳情
**Then** 可以看到完整的審核界面
**And** 可以看到升級原因和數據處理員的備註

**Given** Super User 完成處理
**When** 提交處理結果
**Then** 文件狀態更新為「已審核」
**And** 記錄 Super User 的處理決策
**And** 可選擇是否創建新規則

**Given** Super User 處理案例
**When** 發現需要新增映射規則
**Then** 可以直接創建規則建議（連結到 Epic 4）

**FR 覆蓋**：FR15

---
