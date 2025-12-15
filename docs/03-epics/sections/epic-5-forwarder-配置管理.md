# Epic 5: Forwarder 配置管理

**目標**：Super User 可以查看和編輯 Forwarder Profile，測試規則變更效果

**FRs 覆蓋**：FR25, FR26, FR27, FR28, FR29

---

## Story 5.1: Forwarder Profile 列表

**As a** Super User,
**I want** 查看所有 Forwarder Profile 列表,
**So that** 我可以管理不同 Forwarder 的配置。

**Acceptance Criteria:**

**Given** Super User 已登入
**When** 導航至「Forwarder 管理」頁面
**Then** 顯示所有 Forwarder Profile 列表
**And** 包含：名稱、代碼、狀態、規則數量、最後更新時間

**FR 覆蓋**：FR25

---

## Story 5.2: Forwarder 詳細配置查看

**As a** Super User,
**I want** 查看單個 Forwarder 的詳細配置,
**So that** 我可以了解該 Forwarder 的所有設定。

**Acceptance Criteria:**

**Given** 在 Forwarder 列表頁面
**When** 點擊某個 Forwarder
**Then** 顯示詳細配置：基本資訊、關聯規則、處理統計、最近發票範例

**FR 覆蓋**：FR26

---

## Story 5.3: 編輯 Forwarder 映射規則

**As a** Super User,
**I want** 編輯 Forwarder 特定的映射規則,
**So that** 可以優化特定 Forwarder 的提取準確性。

**Acceptance Criteria:**

**Given** 在 Forwarder 詳情頁面
**When** 點擊「編輯規則」
**Then** 顯示該 Forwarder 的規則編輯界面

**Given** 編輯規則
**When** 修改規則內容
**Then** 規則變更需要經過審核流程

**FR 覆蓋**：FR27

---

## Story 5.4: 測試規則變更效果

**As a** Super User,
**I want** 在規則生效前測試變更效果,
**So that** 可以驗證規則變更不會造成負面影響。

**Acceptance Criteria:**

**Given** 編輯規則後
**When** 點擊「測試規則」
**Then** 可以選擇歷史發票進行測試，顯示原規則 vs 新規則對比

**FR 覆蓋**：FR28

---

## Story 5.5: 新增與停用 Forwarder Profile

**As a** 系統管理員,
**I want** 新增或停用 Forwarder Profile,
**So that** 可以支援新的 Forwarder 或停止不再使用的 Forwarder。

**Acceptance Criteria:**

**Given** 系統管理員在 Forwarder 管理頁面
**When** 點擊「新增 Forwarder」
**Then** 顯示新增表單，提交後創建新 Profile

**Given** 需要停用某個 Forwarder
**When** 點擊「停用」並確認
**Then** Forwarder 狀態變更為「停用」，歷史數據保留

**FR 覆蓋**：FR29

---
