# 手動測試計劃 (Manual Testing Plan)

> **目的**: 系統化測試所有功能模組，確保功能正常運作
> **範圍**: 18 個功能頁面的完整測試
> **時程**: 2025-11-12 開始
> **負責人**: 開發團隊

---

## 📋 測試策略

### 測試目標
1. **功能驗證**: 確保所有 CRUD 操作正常運作
2. **I18N 驗證**: 確保繁中/英文翻譯完整無誤
3. **UI/UX 驗證**: 確保用戶體驗流暢
4. **效能驗證**: 確保頁面載入和操作響應速度
5. **錯誤處理**: 確保錯誤訊息清晰且有幫助

### 測試環境
- **URL**: http://localhost:3000
- **語言**: 繁體中文 (zh-TW) + 英文 (en)
- **瀏覽器**: Chrome (主要), Firefox, Safari
- **資料庫**: PostgreSQL 本地開發環境

### 測試方法
- **手動測試**: 通過瀏覽器手動執行測試場景
- **記錄方式**: 記錄在 `MANUAL-TESTING-LOG.md`
- **問題追蹤**: 記錄在 `FIXLOG.md` (FIX-XXX)

---

## 🗂️ 測試模組清單

### 1. 核心工作流程 (P0 - 高優先級)

#### 1.1 Budget Pools (預算池)
**優先級**: 🔴 P0
**頁面**: 4 個
- [ ] 列表頁 (`/budget-pools`)
- [x] 詳情頁 (`/budget-pools/[id]`) - 發現 FIX-088
- [x] 新增頁 (`/budget-pools/new`) - 發現 FIX-088
- [x] 編輯頁 (`/budget-pools/[id]/edit`) - 發現 FIX-088

**測試重點**:
- CRUD 操作完整性
- 預算類別 (categories) 動態管理
- 財年 (financialYear) 驗證
- 預算額度計算正確性
- I18N 翻譯完整性

#### 1.2 Projects (專案)
**優先級**: 🔴 P0
**頁面**: 4 個
- [ ] 列表頁 (`/projects`)
- [ ] 詳情頁 (`/projects/[id]`)
- [ ] 新增頁 (`/projects/new`)
- [ ] 編輯頁 (`/projects/[id]/edit`)

**測試重點**:
- 專案與預算池關聯
- PM 和 Supervisor 指派
- 日期範圍驗證
- 狀態流轉

#### 1.3 Budget Proposals (預算提案)
**優先級**: 🔴 P0
**頁面**: 4 個
- [ ] 列表頁 (`/proposals`)
- [ ] 詳情頁 (`/proposals/[id]`)
- [ ] 新增頁 (`/proposals/new`)
- [ ] 編輯頁 (`/proposals/[id]/edit`)

**測試重點**:
- 提案狀態機 (Draft → Pending → Approved/Rejected)
- 審批工作流
- 評論系統
- 歷史記錄

#### 1.4 Expenses (費用記錄)
**優先級**: 🔴 P0
**頁面**: 4 個
- [ ] 列表頁 (`/expenses`)
- [ ] 詳情頁 (`/expenses/[id]`)
- [ ] 新增頁 (`/expenses/new`)
- [ ] 編輯頁 (`/expenses/[id]/edit`)

**測試重點**:
- 費用與 PO 關聯
- 發票上傳
- 審批流程
- 金額計算

---

### 2. 採購管理 (P1 - 中優先級)

#### 2.1 Vendors (供應商)
**優先級**: 🟡 P1
**頁面**: 4 個
- [ ] 列表頁 (`/vendors`)
- [ ] 詳情頁 (`/vendors/[id]`)
- [ ] 新增頁 (`/vendors/new`)
- [ ] 編輯頁 (`/vendors/[id]/edit`)

#### 2.2 Quotes (報價單)
**優先級**: 🟡 P1
**頁面**: 1 個
- [ ] 列表頁 (`/quotes`)

#### 2.3 Purchase Orders (採購訂單)
**優先級**: 🟡 P1
**頁面**: 2 個
- [ ] 列表頁 (`/purchase-orders`)
- [ ] 詳情頁 (`/purchase-orders/[id]`)

---

### 3. 財務管理 (P1 - 中優先級)

#### 3.1 Charge-Outs (費用轉嫁)
**優先級**: 🟡 P1
**頁面**: 4 個
- [ ] 列表頁 (`/charge-outs`)
- [ ] 詳情頁 (`/charge-outs/[id]`)
- [ ] 新增頁 (`/charge-outs/new`)
- [ ] 編輯頁 (`/charge-outs/[id]/edit`)

#### 3.2 OM Expenses (營運支出)
**優先級**: 🟡 P1
**頁面**: 4 個
- [ ] 列表頁 (`/om-expenses`)
- [ ] 詳情頁 (`/om-expenses/[id]`)
- [ ] 新增頁 (`/om-expenses/new`)
- [ ] 編輯頁 (`/om-expenses/[id]/edit`)

---

### 4. 系統功能 (P2 - 低優先級)

#### 4.1 Dashboard (儀表板)
**優先級**: 🟢 P2
**頁面**: 1 個
- [ ] PM Dashboard (`/dashboard`)
- [ ] Supervisor Dashboard (`/dashboard/supervisor`)

#### 4.2 Users (用戶管理)
**優先級**: 🟢 P2
**頁面**: 2 個
- [ ] 列表頁 (`/users`)
- [ ] 詳情頁 (`/users/[id]`)

#### 4.3 Notifications (通知)
**優先級**: 🟢 P2
**頁面**: 1 個
- [ ] 通知列表 (`/notifications`)

#### 4.4 Settings (設定)
**優先級**: 🟢 P2
**頁面**: 1 個
- [ ] 用戶設定 (`/settings`)

#### 4.5 Authentication (認證)
**優先級**: 🟢 P2
**頁面**: 3 個
- [ ] 登入 (`/login`)
- [ ] 註冊 (`/register`)
- [ ] 忘記密碼 (`/forgot-password`)

---

## 🧪 標準測試場景

### CRUD 操作測試

#### Create (新增)
1. 訪問新增頁面
2. 填寫所有必填欄位
3. 提交表單
4. 驗證成功訊息
5. 驗證跳轉到詳情頁
6. 驗證資料已存入資料庫
7. 驗證 I18N 翻譯 (zh-TW + en)

#### Read (查看)
1. 訪問列表頁
2. 驗證資料顯示完整
3. 點擊查看詳情
4. 驗證詳情頁資料正確
5. 驗證 I18N 翻譯 (zh-TW + en)

#### Update (更新)
1. 訪問編輯頁面
2. 修改欄位值
3. 提交表單
4. 驗證成功訊息
5. 驗證資料已更新
6. 驗證 I18N 翻譯 (zh-TW + en)

#### Delete (刪除)
1. 訪問列表頁或詳情頁
2. 點擊刪除按鈕
3. 確認刪除對話框
4. 驗證刪除成功訊息
5. 驗證資料已從資料庫刪除
6. 驗證 I18N 翻譯 (zh-TW + en)

---

## 🔍 I18N 測試重點

### 必須測試的 Keys
每個模組都需要檢查以下翻譯 keys:

#### Common Keys
- `common.actions.*` (按鈕文字)
- `common.messages.*` (訊息文字)
- `common.labels.*` (標籤文字)
- `common.placeholders.*` (提示文字)

#### 模組 Keys
- `[module].list.*` (列表頁)
- `[module].detail.*` (詳情頁)
- `[module].form.*` (表單)
- `[module].messages.*` (訊息)
- `[module].actions.*` (操作)

### 測試步驟
1. 在繁體中文模式下測試所有操作
2. 切換到英文模式重複相同操作
3. 檢查控制台是否有 `IntlError: MISSING_MESSAGE` 錯誤
4. 記錄所有缺失的 keys

---

## 📊 測試進度追蹤

### 總體進度
- **總頁面數**: 18 個
- **已測試**: 1 個 (Budget Pools 部分)
- **待測試**: 17 個
- **完成率**: 5.6%

### 模組進度
| 模組 | 頁面數 | 已測試 | 待測試 | 問題數 |
|------|--------|--------|--------|--------|
| Budget Pools | 4 | 3 | 1 | 1 (FIX-088) |
| Projects | 4 | 0 | 4 | 0 |
| Proposals | 4 | 0 | 4 | 0 |
| Expenses | 4 | 0 | 4 | 0 |
| Vendors | 4 | 0 | 4 | 0 |
| Quotes | 1 | 0 | 1 | 0 |
| Purchase Orders | 2 | 0 | 2 | 0 |
| Charge-Outs | 4 | 0 | 4 | 0 |
| OM Expenses | 4 | 0 | 4 | 0 |
| Dashboard | 2 | 0 | 2 | 0 |
| Users | 2 | 0 | 2 | 0 |
| Notifications | 1 | 0 | 1 | 0 |
| Settings | 1 | 0 | 1 | 0 |
| Auth | 3 | 0 | 3 | 0 |

---

## 🎯 測試里程碑

### Milestone 1: 核心工作流程 (P0)
**目標**: 完成 Budget Pools, Projects, Proposals, Expenses 測試
**預計時間**: 2025-11-13
**狀態**: 🔄 進行中

### Milestone 2: 採購管理 (P1)
**目標**: 完成 Vendors, Quotes, Purchase Orders 測試
**預計時間**: 2025-11-14
**狀態**: ⏳ 待開始

### Milestone 3: 財務管理 (P1)
**目標**: 完成 Charge-Outs, OM Expenses 測試
**預計時間**: 2025-11-15
**狀態**: ⏳ 待開始

### Milestone 4: 系統功能 (P2)
**目標**: 完成 Dashboard, Users, Notifications, Settings, Auth 測試
**預計時間**: 2025-11-16
**狀態**: ⏳ 待開始

---

**維護者**: 開發團隊 + AI 助手
**最後更新**: 2025-11-12 23:45
**下次檢視**: 完成 FIX-088 修復後
