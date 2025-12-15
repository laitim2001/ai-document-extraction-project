# Epic 1: 用戶認證與存取控制

**目標**：用戶可以安全登入系統，管理員可以管理用戶權限和角色分配

**FRs 覆蓋**：FR36, FR37, FR38, FR39, FR40, FR41, FR42

---

## Story 1.0: 專案初始化與基礎架構設定

**As a** 開發團隊,
**I want** 使用標準化的 Next.js 專案結構初始化專案,
**So that** 後續開發可以在一致的技術棧上進行。

**Acceptance Criteria:**

**Given** 專案需要初始化
**When** 執行初始化腳本
**Then** 使用 create-next-app 創建專案：
- TypeScript 5.x 嚴格模式
- Tailwind CSS 配置
- ESLint 配置
- App Router 模式
- src/ 目錄結構

**Given** 專案創建完成
**When** 初始化 UI 框架
**Then** 執行 shadcn/ui 初始化
**And** 安裝基礎 UI 組件（button, card, table, dialog, toast, form, input, label, badge, tabs）

**Given** UI 框架初始化完成
**When** 配置專案基礎結構
**Then** 創建以下目錄結構：
- src/app/ - 頁面路由
- src/components/ - 可重用組件
- src/lib/ - 工具函數
- src/services/ - API 服務層
- src/types/ - TypeScript 類型定義

**Given** 專案結構完成
**When** 配置開發環境
**Then** 設定環境變數模板（.env.example）
**And** 配置 Prisma ORM 連接 PostgreSQL
**And** 創建初始 Prisma Schema

**技術備註：**
- 使用 Architecture 文件中定義的初始化命令
- 配置 @/* 路徑別名
- 設定 ESLint 和 Prettier 規則

**FR 覆蓋**：基礎架構（無對應 FR，為技術前置條件）

---

## Story 1.1: Azure AD SSO 登入

**As a** 系統用戶,
**I want** 使用公司的 Azure AD 帳戶登入系統,
**So that** 我可以使用單一身份驗證安全地存取系統。

**Acceptance Criteria:**

**Given** 用戶尚未登入系統
**When** 用戶點擊「使用 Microsoft 登入」按鈕
**Then** 系統重導向至 Azure AD 登入頁面
**And** 成功驗證後，用戶被重導向回系統首頁
**And** 系統顯示用戶的名稱和頭像

**Given** 用戶已登入系統
**When** Session 超過 8 小時
**Then** 系統自動登出用戶
**And** 重導向至登入頁面

**Given** 用戶已登入但閒置超過 30 分鐘
**When** 用戶嘗試進行任何操作
**Then** 系統要求重新驗證

**技術備註：**
- 創建 `User` 資料表（id, email, name, azureAdId, status, createdAt, updatedAt）
- 配置 NextAuth v5 with Azure AD Provider
- 實現 Session 管理

**FR 覆蓋**：FR36

---

## Story 1.2: 用戶資料庫與角色基礎架構

**As a** 系統管理員,
**I want** 系統具備用戶和角色的數據結構,
**So that** 可以進行後續的權限管理功能。

**Acceptance Criteria:**

**Given** 用戶通過 Azure AD 首次登入
**When** 系統驗證成功
**Then** 系統自動創建用戶記錄
**And** 用戶被分配預設角色（Data Processor）
**And** 用戶狀態設為「Active」

**Given** 系統已有預定義的角色
**When** 查詢角色列表
**Then** 系統返回以下角色：System Admin, Super User, Data Processor, City Manager, Regional Manager, Auditor

**技術備註：**
- 創建 `Role` 資料表（id, name, description, permissions, isSystem, createdAt）
- 創建 `UserRole` 關聯表
- 種子數據：6 個預設角色

**FR 覆蓋**：FR36 (部分)

---

## Story 1.3: 用戶列表與搜尋

**As a** 系統管理員,
**I want** 查看所有系統用戶的列表,
**So that** 我可以了解系統的用戶狀況並進行管理。

**Acceptance Criteria:**

**Given** 系統管理員已登入
**When** 導航至「用戶管理」頁面
**Then** 系統顯示用戶列表，包含：姓名、Email、角色、城市、狀態、最後登入時間
**And** 列表支援分頁（每頁 20 筆）
**And** 列表支援按姓名或 Email 搜尋
**And** 列表支援按角色、城市、狀態篩選

**Given** 用戶列表載入中
**When** 數據尚未返回
**Then** 顯示 Skeleton 載入狀態

**FR 覆蓋**：FR37

---

## Story 1.4: 新增用戶與角色分配

**As a** 系統管理員,
**I want** 新增用戶並分配角色,
**So that** 新員工可以使用系統執行其職責。

**Acceptance Criteria:**

**Given** 系統管理員在用戶管理頁面
**When** 點擊「新增用戶」按鈕
**Then** 系統顯示新增用戶表單

**Given** 填寫有效的用戶資料（Email、姓名、角色、城市）
**When** 點擊「儲存」按鈕
**Then** 系統創建用戶記錄
**And** 系統發送邀請通知（如配置）
**And** 顯示成功訊息並返回列表

**Given** 填寫的 Email 已存在
**When** 點擊「儲存」按鈕
**Then** 系統顯示錯誤訊息「此 Email 已被使用」

**FR 覆蓋**：FR38

---

## Story 1.5: 修改用戶角色與城市歸屬

**As a** 系統管理員,
**I want** 修改用戶的角色和城市歸屬,
**So that** 我可以調整用戶的權限以符合其職責變更。

**Acceptance Criteria:**

**Given** 系統管理員查看用戶詳情
**When** 點擊「編輯」按鈕
**Then** 系統顯示可編輯的用戶資料表單

**Given** 修改用戶的角色或城市歸屬
**When** 點擊「儲存」按鈕
**Then** 系統更新用戶記錄
**And** 記錄變更至審計日誌
**And** 顯示成功訊息

**Given** 用戶被分配新角色
**When** 該用戶下次操作時
**Then** 系統應用新的權限設定

**FR 覆蓋**：FR39

---

## Story 1.6: 停用與啟用用戶帳戶

**As a** 系統管理員,
**I want** 停用離職員工的帳戶,
**So that** 確保系統安全，離職人員無法存取系統。

**Acceptance Criteria:**

**Given** 系統管理員查看活躍用戶
**When** 點擊「停用」按鈕並確認
**Then** 用戶狀態變更為「Inactive」
**And** 該用戶無法再登入系統
**And** 記錄變更至審計日誌

**Given** 系統管理員查看已停用用戶
**When** 點擊「啟用」按鈕
**Then** 用戶狀態變更為「Active」
**And** 該用戶可以重新登入系統

**Given** 已停用的用戶嘗試登入
**When** Azure AD 驗證成功後
**Then** 系統顯示「您的帳戶已被停用，請聯繫管理員」

**FR 覆蓋**：FR40

---

## Story 1.7: 自定義角色管理

**As a** 系統管理員,
**I want** 創建自定義角色並定義權限,
**So that** 我可以靈活地配置符合組織需求的權限組合。

**Acceptance Criteria:**

**Given** 系統管理員在角色管理頁面
**When** 點擊「新增角色」按鈕
**Then** 系統顯示角色創建表單，包含權限選擇清單

**Given** 填寫角色名稱並選擇權限
**When** 點擊「儲存」按鈕
**Then** 系統創建新角色
**And** 新角色可被分配給用戶

**Given** 查看系統預設角色
**When** 嘗試編輯或刪除
**Then** 系統禁止修改系統預設角色

**Given** 自定義角色已被分配給用戶
**When** 嘗試刪除該角色
**Then** 系統顯示警告並要求先移除用戶分配

**FR 覆蓋**：FR41

---

## Story 1.8: 城市經理用戶管理

**As a** 城市經理,
**I want** 管理本城市的用戶,
**So that** 我可以自主處理本城市的人員異動。

**Acceptance Criteria:**

**Given** 城市經理已登入
**When** 導航至「用戶管理」頁面
**Then** 系統僅顯示該城市的用戶列表

**Given** 城市經理新增用戶
**When** 選擇城市歸屬時
**Then** 系統僅允許選擇該城市經理管轄的城市

**Given** 城市經理嘗試修改其他城市的用戶
**When** 系統檢查權限
**Then** 系統拒絕操作並顯示「無權限」訊息

**FR 覆蓋**：FR42

---
