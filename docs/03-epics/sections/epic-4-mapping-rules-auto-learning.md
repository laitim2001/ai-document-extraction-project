# Epic 4: 映射規則管理與自動學習

**目標**：Super User 可以查看、建議、審核映射規則，系統可從修正中自動學習並建議規則升級

**FRs 覆蓋**：FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24

---

## Story 4.1: 映射規則列表與查看

**As a** Super User,
**I want** 查看現有的映射規則,
**So that** 我可以了解系統的提取邏輯並進行管理。

**Acceptance Criteria:**

**Given** Super User 已登入
**When** 導航至「規則管理」頁面
**Then** 系統顯示所有映射規則列表
**And** 支援按 Forwarder、欄位名稱、狀態篩選
**And** 顯示規則的版本號和最後更新時間

**Given** 規則列表
**When** 點擊某條規則
**Then** 顯示規則詳情：提取模式、適用 Forwarder、創建人、應用統計

**FR 覆蓋**：FR17

---

## Story 4.2: 建議新映射規則

**As a** Super User,
**I want** 建議新的映射規則,
**So that** 系統可以更準確地提取特定 Forwarder 的發票。

**Acceptance Criteria:**

**Given** Super User 在規則管理頁面
**When** 點擊「建議新規則」
**Then** 顯示規則創建表單

**Given** 填寫規則表單
**When** 輸入規則內容
**Then** 包含：目標欄位、適用 Forwarder、提取模式類型、提取模式內容、優先級

**Given** 提交規則建議
**When** 規則需要審核
**Then** 規則狀態設為「待審核」並通知審核人員

**FR 覆蓋**：FR18

---

## Story 4.3: 修正模式記錄與分析

**As a** 系統,
**I want** 記錄用戶的修正並識別重複模式,
**So that** 可以自動發現潛在的規則改進機會。

**Acceptance Criteria:**

**Given** 用戶完成「正常修正」
**When** 系統記錄修正
**Then** 儲存：原始值、修正值、Forwarder、欄位名稱、修正時間

**Given** 系統累積修正記錄
**When** 執行模式分析
**Then** 識別重複的修正模式（相同 Forwarder + 相同欄位 + 相似修正）

**Given** 發現重複模式
**When** 修正次數 >= 3
**Then** 標記為「潛在規則升級候選」

**FR 覆蓋**：FR20

---

## Story 4.4: 規則升級建議生成

**As a** 系統,
**I want** 在累計 3 次相同修正後建議規則升級,
**So that** Super User 可以審核並決定是否採納。

**Acceptance Criteria:**

**Given** 相同模式修正達到 3 次
**When** 系統檢測到閾值
**Then** 自動生成規則升級建議
**And** 包含：建議的新規則、基於的修正案例、預期影響

**Given** 規則升級建議生成
**When** 系統創建建議
**Then** 通知相關 Super User，建議狀態設為「待審核」

**FR 覆蓋**：FR21

---

## Story 4.5: 規則影響範圍分析

**As a** Super User,
**I want** 在規則升級前查看影響範圍分析,
**So that** 我可以評估變更的風險。

**Acceptance Criteria:**

**Given** 查看規則升級建議
**When** 點擊「影響分析」
**Then** 顯示：受影響的歷史發票數量、預計改善率、可能受負面影響的案例

**Given** 影響分析完成
**When** 顯示結果
**Then** 提供測試運行功能，可對歷史數據進行模擬測試

**Given** 模擬測試完成
**When** 顯示測試結果
**Then** 對比原規則 vs 新規則結果，標記改善和惡化的案例

**FR 覆蓋**：FR22

---

## Story 4.6: 審核學習規則

**As a** Super User,
**I want** 審核待升級的學習規則,
**So that** 只有經過驗證的規則才會被應用。

**Acceptance Criteria:**

**Given** Super User 在規則審核頁面
**When** 查看待審核規則
**Then** 顯示規則詳情和影響分析

**Given** Super User 審核規則
**When** 點擊「批准」
**Then** 規則狀態更新為「已批准」，進入生效隊列

**Given** Super User 審核規則
**When** 點擊「拒絕」
**Then** 需要填寫拒絕原因，規則狀態更新為「已拒絕」

**FR 覆蓋**：FR19

---

## Story 4.7: 規則版本歷史管理

**As a** Super User,
**I want** 查看規則的版本歷史,
**So that** 我可以追溯規則的演變並在需要時回滾。

**Acceptance Criteria:**

**Given** 查看規則詳情
**When** 點擊「版本歷史」
**Then** 顯示該規則的所有版本（至少保留 5 個）

**Given** 版本歷史列表
**When** 選擇兩個版本
**Then** 可以進行版本對比，高亮顯示差異

**FR 覆蓋**：FR23

---

## Story 4.8: 規則自動回滾

**As a** 系統,
**I want** 在準確率下降時自動回滾規則,
**So that** 系統可以自我保護避免錯誤規則的影響。

**Acceptance Criteria:**

**Given** 新規則已生效
**When** 系統監控準確率指標
**Then** 每小時計算規則應用後的準確率

**Given** 準確率監控
**When** 新規則導致準確率下降超過 10%
**Then** 系統自動觸發回滾，恢復到上一個穩定版本

**Given** 自動回滾觸發
**When** 執行回滾
**Then** 發送告警通知給 Super User，記錄回滾原因和時間

**FR 覆蓋**：FR24

---
