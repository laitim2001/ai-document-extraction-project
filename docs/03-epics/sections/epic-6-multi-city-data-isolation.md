# Epic 6: 多城市數據隔離

**目標**：系統按城市隔離數據，用戶只能訪問授權城市的數據，同時共享全局規則

**FRs 覆蓋**：FR43, FR44, FR45, FR46, FR47

---

## Story 6.1: 城市數據模型與 RLS 配置

**As a** 系統,
**I want** 按城市隔離所有業務數據,
**So that** 確保數據安全和合規。

**Acceptance Criteria:**

**Given** 系統初始化
**When** 創建數據表
**Then** 所有業務數據表包含 cityCode 欄位
**And** 配置 PostgreSQL Row Level Security 策略
**And** 查詢自動過濾非授權城市數據

**Given** 用戶執行查詢
**When** 數據庫處理請求
**Then** RLS 策略自動應用
**And** 無需應用層額外過濾

**技術備註：**
- 創建 `City` 資料表（id, code, name, region, timezone, status）
- 為所有業務表添加 cityCode 外鍵
- 配置 RLS 策略基於 session 變數

**FR 覆蓋**：FR43

---

## Story 6.2: 城市用戶數據訪問控制

**As a** 城市用戶,
**I want** 只能訪問本城市的數據,
**So that** 確保數據隔離和安全。

**Acceptance Criteria:**

**Given** 城市用戶（Data Processor）已登入
**When** 查詢任何業務數據（發票、提取結果、審計記錄）
**Then** 系統自動過濾，僅返回該用戶所屬城市的數據
**And** 無法通過任何方式訪問其他城市數據

**Given** 城市用戶嘗試直接存取其他城市的資源
**When** 通過 URL 或 API 指定其他城市的資源 ID
**Then** 系統返回 403 Forbidden 或空結果
**And** 記錄此次存取嘗試至安全日誌

**Given** 城市用戶查看統計數據
**When** 載入儀表板
**Then** 所有統計僅反映該城市的數據

**FR 覆蓋**：FR44

---

## Story 6.3: 區域經理跨城市訪問

**As a** 區域經理,
**I want** 訪問我管轄的多個城市的數據,
**So that** 我可以進行跨城市的管理和分析。

**Acceptance Criteria:**

**Given** 區域經理已登入
**When** 查詢業務數據
**Then** 系統返回該經理被授權的所有城市數據
**And** 可以按城市篩選查看

**Given** 區域經理查看列表頁面
**When** 頁面載入
**Then** 顯示城市篩選下拉選單
**And** 預設顯示所有授權城市的數據

**Given** 區域經理匯出報表
**When** 選擇匯出選項
**Then** 可以選擇單一城市或多城市匯總
**And** 報表明確標示數據來源城市

**技術備註：**
- 創建 `UserCityAccess` 關聯表
- 區域經理可被授權多個城市

**FR 覆蓋**：FR45

---

## Story 6.4: 全局管理者完整訪問

**As a** 全局管理者,
**I want** 訪問所有城市的數據,
**So that** 我可以進行全球層級的管理和監控。

**Acceptance Criteria:**

**Given** 全局管理者已登入
**When** 查詢業務數據
**Then** 系統返回所有城市的數據
**And** 可以按城市、區域篩選

**Given** 全局管理者查看儀表板
**When** 頁面載入
**Then** 顯示全球匯總統計
**And** 可以切換查看單一城市或區域

**Given** 全局管理者進行系統配置
**When** 修改全局設定
**Then** 變更適用於所有城市

**FR 覆蓋**：FR46

---

## Story 6.5: 全局規則共享機制

**As a** 系統,
**I want** 在所有城市共享 Mapping Rules 和 Forwarder Profiles,
**So that** 規則維護集中化且一致。

**Acceptance Criteria:**

**Given** Super User 創建或修改規則
**When** 規則生效
**Then** 規則自動應用於所有城市
**And** 無需針對每個城市單獨配置

**Given** 城市用戶處理發票
**When** 系統應用規則
**Then** 使用全局共享的規則庫
**And** 規則版本在所有城市保持一致

**Given** 規則更新後
**When** 任何城市處理發票
**Then** 立即使用最新版本的規則
**And** 無需城市級別的同步操作

**技術備註：**
- MappingRule 和 Forwarder 表不包含 cityCode
- 這些表的數據為全局共享

**FR 覆蓋**：FR47

---
