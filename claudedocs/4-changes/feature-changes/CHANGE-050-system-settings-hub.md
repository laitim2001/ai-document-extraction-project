# CHANGE-050: System Settings Hub 統一系統設定頁面

> **日期**: 2026-02-26
> **狀態**: 📋 規劃中
> **優先級**: Low
> **類型**: New Feature
> **影響範圍**: 新增 `/admin/settings` 頁面路由、Sidebar 導航、i18n 新命名空間、Prisma Model
> **前置條件**: 無
> **觸發事件**: 系統設定分散在多個獨立頁面，缺乏統一管理入口

---

## 變更背景

### 現況分析

目前系統設定功能分散在多個獨立的 admin 頁面中，使用者需要分別前往不同路由才能管理各類設定：

| 設定功能 | 現有路由 | 來源 | 狀態 |
|----------|----------|------|------|
| 系統配置（key-value） | `/admin/config` | Epic 12 - Story 12-4 | 已完成 |
| Pipeline 管線配置 | `/admin/pipeline-settings` | CHANGE-032 | 已完成 |
| Prompt 配置 | `/admin/prompt-configs` | Epic 14 | 已完成 |
| 系統健康監控 | `/admin/monitoring/health` | Epic 12 | 已完成 |
| 備份管理 | `/admin/backup` | Epic 12 | 已完成 |
| 系統警報 | `/admin/alerts` | Epic 12 | 已完成 |
| 效能監控 | `/admin/performance` | Epic 12 | 已完成 |

### 問題

1. **缺乏統一入口**：Sidebar 導航中沒有「系統設定」的統一分組，管理者需要記住各功能的獨立路徑
2. **新增全域設定無處安放**：例如系統名稱、預設語言、時區、通知偏好、資料保留策略等全域設定目前沒有對應的管理介面
3. **既有 `/admin/config` 定位模糊**：Epic 12 的 ConfigManagement 是以 key-value 形式管理系統配置，但缺乏分類組織和使用者友善的表單介面

### 目標

建立一個 System Settings Hub 頁面，作為所有系統設定的**統一入口**，同時新增目前缺失的全域設定功能（一般設定、通知設定、資料保留設定）。

---

## 設計決策

### 方案比較

| 項目 | 方案 A：Settings Hub 導航入口（推薦） | 方案 B：全部內嵌 Tabs |
|------|--------------------------------------|----------------------|
| 架構 | Card Grid 顯示各設定分類，點擊跳轉至對應頁面。新增設定以 inline form 實現 | 所有設定頁面都以 Tab 形式內嵌於同一頁面 |
| 優勢 | 輕量、不影響既有頁面、漸進式增強 | 所有設定集中在一處 |
| 劣勢 | 部分設定仍需跳轉 | 頁面龐大、效能風險、與既有頁面衝突 |
| 維護成本 | 低 | 高（需重構多個既有頁面） |
| 建議 | **採用** | 不採用 |

### 選定方案：方案 A — Settings Hub 導航入口

**核心理念**：Settings Hub 不是重新實現已有的設定頁面，而是建立一個統一入口，以 Card Grid 佈局整合現有分散的設定功能，並新增目前缺失的全域設定。

---

## 變更內容

### Step 1: 建立 Prisma Model — SystemSetting

**新增** `prisma/schema.prisma`

新增 `SystemSetting` model，用於儲存全域設定（key-value 結構）：

```prisma
model SystemSetting {
  id        String   @id @default(uuid())
  key       String   @unique
  value     Json
  category  String   @default("general")
  updatedBy String?  @map("updated_by")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([category])
  @@map("system_settings")
}
```

**設定 key 規劃**：

| Category | Key | 預設值 | 說明 |
|----------|-----|--------|------|
| `general` | `system.name` | `"AI Document Extraction"` | 系統顯示名稱 |
| `general` | `system.defaultLocale` | `"en"` | 預設語言 |
| `general` | `system.timezone` | `"Asia/Hong_Kong"` | 預設時區 |
| `general` | `system.dateFormat` | `"YYYY-MM-DD"` | 日期顯示格式 |
| `notifications` | `notifications.emailEnabled` | `true` | Email 通知總開關 |
| `notifications` | `notifications.alertThreshold` | `"warning"` | 告警通知最低等級 |
| `notifications` | `notifications.digestFrequency` | `"daily"` | 摘要通知頻率 |
| `notifications` | `notifications.recipients` | `[]` | 通知收件人清單 |
| `retention` | `retention.documentDays` | `365` | 文件保留天數 |
| `retention` | `retention.logDays` | `90` | 日誌保留天數 |
| `retention` | `retention.auditDays` | `730` | 審計記錄保留天數 |
| `retention` | `retention.tempFileDays` | `7` | 暫存檔案保留天數 |

**執行遷移**：

```bash
npx prisma migrate dev --name add_system_settings
```

### Step 2: 建立 Service 層 — SystemSettingsService

**新增** `src/services/system-settings.service.ts`

主要方法：
- `getAll(category?: string)`: 取得所有設定（可依分類篩選）
- `get(key: string)`: 取得單一設定值
- `set(key: string, value: Json, updatedBy?: string)`: 設定值
- `bulkSet(settings: { key: string; value: Json }[], updatedBy?: string)`: 批量更新
- `getDefaults()`: 取得預設值清單
- `resetToDefault(key: string)`: 重置為預設值

### Step 3: 建立 API 路由

**新增** `src/app/api/admin/settings/route.ts`

| HTTP 方法 | 功能 | 說明 |
|-----------|------|------|
| `GET` | 取得系統設定 | Query param: `?category=general` 可選篩選 |
| `PATCH` | 更新系統設定 | Body: `{ settings: [{ key, value }] }` 批量更新 |

**新增** `src/app/api/admin/settings/[key]/route.ts`

| HTTP 方法 | 功能 | 說明 |
|-----------|------|------|
| `GET` | 取得單一設定 | 路徑參數: `key` |
| `PUT` | 更新單一設定 | Body: `{ value: Json }` |
| `DELETE` | 重置為預設值 | 刪除自訂值，恢復預設 |

### Step 4: 建立 React Query Hook

**新增** `src/hooks/use-system-settings.ts`

主要 exports：
- `useSystemSettings(category?: string)`: 取得設定列表
- `useSystemSetting(key: string)`: 取得單一設定
- `useUpdateSystemSettings()`: mutation — 批量更新設定
- `useResetSystemSetting()`: mutation — 重置單一設定為預設值

### Step 5: 建立頁面與組件

#### 5a: Settings Hub 頁面

**新增** `src/app/[locale]/(dashboard)/admin/settings/page.tsx` (Server Component)
**新增** `src/app/[locale]/(dashboard)/admin/settings/client.tsx` (Client Component)

Settings Hub 主頁面使用 Card Grid 佈局，分為兩區：

1. **內嵌設定**（直接在頁面內管理）：
   - GeneralSettingsForm（一般設定）
   - NotificationSettingsForm（通知設定）
   - DataRetentionForm（資料保留設定）

2. **連結卡片**（跳轉到已有頁面）：
   - Pipeline Settings -> /admin/pipeline-settings
   - Prompt Configs -> /admin/prompt-configs
   - System Config -> /admin/config
   - Health Monitoring -> /admin/monitoring/health
   - Backup -> /admin/backup
   - Alerts -> /admin/alerts

#### 5b-5e: 組件

**新增** `src/components/features/admin/settings/SettingsCard.tsx`
**新增** `src/components/features/admin/settings/GeneralSettingsForm.tsx`
**新增** `src/components/features/admin/settings/NotificationSettingsForm.tsx`
**新增** `src/components/features/admin/settings/DataRetentionForm.tsx`
**新增** `src/components/features/admin/settings/index.ts`

### Step 6: 新增 i18n 命名空間 — systemSettings

**新增** `messages/en/systemSettings.json`
**新增** `messages/zh-TW/systemSettings.json`
**新增** `messages/zh-CN/systemSettings.json`

### Step 7: 更新 i18n 配置

**修改** `src/i18n/request.ts` — 在 `namespaces` 陣列中新增 `'systemSettings'`

### Step 8: 更新 Sidebar 導航

**修改** `src/components/layout/Sidebar.tsx` — 在 Admin 區塊首位新增 Settings 入口
**修改** `messages/{en,zh-TW,zh-CN}/navigation.json` — 新增 `sidebar.settings` 翻譯 key

### Step 9: Seed Data（可選）

為 `SystemSetting` 插入預設值，確保首次部署時有基礎設定資料。

---

## 頁面佈局設計

```
+--------------------------------------------------------------+
|  System Settings                                              |
|  Manage system-wide configurations and preferences            |
+--------------------------------------------------------------+
|                                                               |
|  +------------------+  +------------------+  +--------------+ |
|  | [icon] General   |  | [icon] Pipeline  |  | [icon] Prompt| |
|  | Settings         |  | Settings    [->] |  | Configs [->] | |
|  | System name,     |  | Configure pipe-  |  | Manage AI    | |
|  | language, tz     |  | line stages...   |  | prompts...   | |
|  | [Expand Form]    |  |                  |  |              | |
|  +------------------+  +------------------+  +--------------+ |
|                                                               |
|  +------------------+  +------------------+  +--------------+ |
|  | [icon] Notif.    |  | [icon] Data      |  | [icon] Health| |
|  | Settings         |  | Retention        |  | Monitor [->] | |
|  | Email alerts,    |  | Document, log    |  | System       | |
|  | thresholds...    |  | retention...     |  | health...    | |
|  | [Expand Form]    |  | [Expand Form]    |  |              | |
|  +------------------+  +------------------+  +--------------+ |
|                                                               |
|  +------------------+  +------------------+  +--------------+ |
|  | [icon] System    |  | [icon] Backup    |  | [icon] Alert | |
|  | Config      [->] |  | & Restore   [->] |  | Rules   [->] | |
|  | Advanced key-    |  | Database backup  |  | System alert | |
|  | value configs    |  | management...    |  | rules...     | |
|  +------------------+  +------------------+  +--------------+ |
|                                                               |
+--------------------------------------------------------------+

[->] = 連結型卡片，點擊跳轉到已有頁面
[Expand Form] = 內嵌型卡片，點擊展開表單直接編輯
```

---

## 修改檔案清單

| # | 動作 | 檔案 | 說明 |
|---|------|------|------|
| 1 | 修改 | `prisma/schema.prisma` | 新增 `SystemSetting` model |
| 2 | 新增 | `prisma/migrations/YYYYMMDDHHMMSS_add_system_settings/` | 遷移檔案 |
| 3 | 新增 | `src/services/system-settings.service.ts` | 系統設定服務 |
| 4 | 新增 | `src/app/api/admin/settings/route.ts` | GET/PATCH 系統設定 API |
| 5 | 新增 | `src/app/api/admin/settings/[key]/route.ts` | 單一設定 CRUD API |
| 6 | 新增 | `src/hooks/use-system-settings.ts` | React Query hook |
| 7 | 新增 | `src/app/[locale]/(dashboard)/admin/settings/page.tsx` | Settings Hub 頁面 |
| 8 | 新增 | `src/app/[locale]/(dashboard)/admin/settings/client.tsx` | Settings Hub 客戶端組件 |
| 9 | 新增 | `src/components/features/admin/settings/SettingsCard.tsx` | 設定卡片組件 |
| 10 | 新增 | `src/components/features/admin/settings/GeneralSettingsForm.tsx` | 一般設定表單 |
| 11 | 新增 | `src/components/features/admin/settings/NotificationSettingsForm.tsx` | 通知設定表單 |
| 12 | 新增 | `src/components/features/admin/settings/DataRetentionForm.tsx` | 資料保留設定表單 |
| 13 | 新增 | `src/components/features/admin/settings/index.ts` | 組件索引 |
| 14 | 新增 | `messages/en/systemSettings.json` | 英文翻譯 |
| 15 | 新增 | `messages/zh-TW/systemSettings.json` | 繁體中文翻譯 |
| 16 | 新增 | `messages/zh-CN/systemSettings.json` | 簡體中文翻譯 |
| 17 | 修改 | `src/i18n/request.ts` | 新增 `systemSettings` 命名空間 |
| 18 | 修改 | `src/components/layout/Sidebar.tsx` | Admin 區塊新增 Settings 連結 |
| 19 | 修改 | `messages/en/navigation.json` | 新增 `sidebar.settings` |
| 20 | 修改 | `messages/zh-TW/navigation.json` | 新增 `sidebar.settings` |
| 21 | 修改 | `messages/zh-CN/navigation.json` | 新增 `sidebar.settings` |
| 22 | 修改 | `prisma/seed.ts`（可選） | 新增 SystemSetting 預設資料 |

---

## 影響評估

### 資料庫影響

- **新增 Model**: `SystemSetting`（1 個 model）
- **Prisma Schema**: 117 -> 118 models
- **遷移**: 需要執行 `prisma migrate dev`

### API 影響

- **新增端點**: 2 個 route files（約 5 個端點）
- **API 路由總量**: 175 -> 177 files

### 組件影響

- **新增組件**: 5 個
- **修改組件**: 1 個（Sidebar.tsx）

### i18n 影響

- **新增命名空間**: `systemSettings`（第 31 個命名空間）
- **修改命名空間**: `navigation`（新增 `sidebar.settings` key）

### 既有功能兼容性

| 既有功能 | 影響 | 說明 |
|----------|------|------|
| `/admin/config` (Epic 12) | 無影響 | Settings Hub 以連結卡片指向此頁面 |
| `/admin/pipeline-settings` | 無影響 | Settings Hub 以連結卡片指向此頁面 |
| `/admin/prompt-configs` | 無影響 | Settings Hub 以連結卡片指向此頁面 |
| 其他設定頁面 | 無影響 | 均以連結卡片指向，不修改既有功能 |

---

## 風險評估

| 風險 | 嚴重度 | 可能性 | 緩解措施 |
|------|--------|--------|----------|
| SystemSetting model 與既有 `/admin/config` 功能重疊 | 中 | 中 | SystemSetting 專注於結構化全域設定，ConfigManagement 處理進階 key-value 配置，兩者定位不同 |
| 新增命名空間遺漏 `request.ts` 註冊 | 低 | 低 | Step 7 明確列出需修改，`npm run i18n:check` 可驗證 |
| Seed data 缺失導致新部署無預設設定 | 中 | 中 | Service 層 `getDefaults()` 提供程式碼級預設值作為 fallback |
| 日後新增設定分類需同步多處 | 低 | 中 | `SystemSetting.category` + i18n `categories.*` 結構一致，擴展成本低 |

---

## 實施順序建議

```
Phase 1（核心）:
  1. Prisma Model + 遷移
  2. Service 層
  3. API 路由
  4. React Query Hook
  5. Settings Hub 頁面 + SettingsCard 組件
  6. i18n 翻譯（3 語言）
  7. Sidebar 導航更新

Phase 2（表單）:
  8. GeneralSettingsForm
  9. NotificationSettingsForm
  10. DataRetentionForm

Phase 3（收尾）:
  11. Seed data
  12. 驗證與測試
```
