# 安全審查報告 — src/components/features（admin / audit / auth / companies / confidence / data-template，第 1/5 批）

> 審查日期：2026-06-10 | Scope：scopes/components-features-0.txt | Agent：components-features-0

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | src/components/features/admin/AddUserDialog.tsx | 349 | ✅ |
| 2 | src/components/features/admin/alerts/AlertDashboard.tsx | 174 | ✅ |
| 3 | src/components/features/admin/alerts/AlertHistory.tsx | 430 | ✅ |
| 4 | src/components/features/admin/alerts/AlertRuleManagement.tsx | 252 | ✅ |
| 5 | src/components/features/admin/alerts/AlertRuleTable.tsx | 218 | ✅ |
| 6 | src/components/features/admin/alerts/CreateAlertRuleDialog.tsx | 459 | ✅ |
| 7 | src/components/features/admin/alerts/index.ts | 11 | ✅ |
| 8 | src/components/features/admin/api-keys/ApiKeyManagement.tsx | 377 | ✅ |
| 9 | src/components/features/admin/api-keys/ApiKeyTable.tsx | 270 | ✅ |
| 10 | src/components/features/admin/api-keys/CreateApiKeyDialog.tsx | 397 | ✅ |
| 11 | src/components/features/admin/api-keys/index.ts | 9 | ✅ |
| 12 | src/components/features/admin/backup/BackupList.tsx | 446 | ✅ |
| 13 | src/components/features/admin/backup/BackupManagement.tsx | 181 | ✅ |
| 14 | src/components/features/admin/backup/BackupScheduleList.tsx | 382 | ✅ |
| 15 | src/components/features/admin/backup/BackupStatusCard.tsx | 173 | ✅ |
| 16 | src/components/features/admin/backup/CreateBackupDialog.tsx | 249 | ✅ |
| 17 | src/components/features/admin/backup/index.ts | 13 | ✅ |
| 18 | src/components/features/admin/backup/ScheduleDialog.tsx | 425 | ✅ |
| 19 | src/components/features/admin/backup/StorageUsageCard.tsx | 181 | ✅ |
| 20 | src/components/features/admin/CitySelector.tsx | 328 | ✅ |
| 21 | src/components/features/admin/config/ConfigEditDialog.tsx | 341 | ✅ |
| 22 | src/components/features/admin/config/ConfigHistoryDialog.tsx | 266 | ✅ |
| 23 | src/components/features/admin/config/ConfigItem.tsx | 228 | ✅ |
| 24 | src/components/features/admin/config/ConfigManagement.tsx | 468 | ✅ |
| 25 | src/components/features/admin/config/index.ts | 17 | ✅ |
| 26 | src/components/features/admin/EditUserDialog.tsx | 341 | ✅ |
| 27 | src/components/features/admin/index.ts | 33 | ✅ |
| 28 | src/components/features/admin/logs/index.ts | 12 | ✅ |
| 29 | src/components/features/admin/logs/LogDetailDialog.tsx | 330 | ✅ |
| 30 | src/components/features/admin/logs/LogExportDialog.tsx | 337 | ✅ |
| 31 | src/components/features/admin/logs/LogStreamPanel.tsx | 297 | ✅ |
| 32 | src/components/features/admin/logs/LogViewer.tsx | 505 | ✅ |
| 33 | src/components/features/admin/monitoring/HealthDashboard.tsx | 651 | ✅ |
| 34 | src/components/features/admin/monitoring/index.ts | 16 | ✅ |
| 35 | src/components/features/admin/PermissionScopeIndicator.tsx | 329 | ✅ |
| 36 | src/components/features/admin/restore/index.ts | 18 | ✅ |
| 37 | src/components/features/admin/restore/RestoreDetailDialog.tsx | 581 | ✅ |
| 38 | src/components/features/admin/restore/RestoreDialog.tsx | 629 | ✅ |
| 39 | src/components/features/admin/restore/RestoreList.tsx | 328 | ✅ |
| 40 | src/components/features/admin/restore/RestoreManagement.tsx | 214 | ✅ |
| 41 | src/components/features/admin/roles/AddRoleDialog.tsx | 262 | ✅ |
| 42 | src/components/features/admin/roles/DeleteRoleDialog.tsx | 242 | ✅ |
| 43 | src/components/features/admin/roles/EditRoleDialog.tsx | 336 | ✅ |
| 44 | src/components/features/admin/roles/index.ts | 21 | ✅ |
| 45 | src/components/features/admin/roles/PermissionSelector.tsx | 251 | ✅ |
| 46 | src/components/features/admin/roles/RoleList.tsx | 306 | ✅ |
| 47 | src/components/features/admin/settings/DataRetentionForm.tsx | 230 | ✅ |
| 48 | src/components/features/admin/settings/GeneralSettingsForm.tsx | 313 | ✅ |
| 49 | src/components/features/admin/settings/index.ts | 17 | ✅ |
| 50 | src/components/features/admin/settings/NotificationSettingsForm.tsx | 275 | ✅ |
| 51 | src/components/features/admin/settings/SettingsCard.tsx | 140 | ✅ |
| 52 | src/components/features/admin/UserFilters.tsx | 158 | ✅ |
| 53 | src/components/features/admin/UserList.tsx | 209 | ✅ |
| 54 | src/components/features/admin/UserListSkeleton.tsx | 93 | ✅ |
| 55 | src/components/features/admin/UserSearchBar.tsx | 74 | ✅ |
| 56 | src/components/features/admin/UserStatusToggle.tsx | 272 | ✅ |
| 57 | src/components/features/admin/UserTable.tsx | 224 | ✅ |
| 58 | src/components/features/audit/AuditReportExportDialog.tsx | 437 | ✅ |
| 59 | src/components/features/audit/AuditReportJobList.tsx | 396 | ✅ |
| 60 | src/components/features/audit/index.ts | 11 | ✅ |
| 61 | src/components/features/audit/ReportIntegrityDialog.tsx | 343 | ✅ |
| 62 | src/components/features/auth/DevLoginForm.tsx | 120 | ✅ |
| 63 | src/components/features/auth/LoginForm.tsx | 242 | ✅ |
| 64 | src/components/features/auth/RegisterForm.tsx | 322 | ✅ |
| 65 | src/components/features/companies/CompanyMergeDialog.tsx | 228 | ✅ |
| 66 | src/components/features/companies/CompanyTypeSelector.tsx | 192 | ✅ |
| 67 | src/components/features/companies/index.ts | 28 | ✅ |
| 68 | src/components/features/confidence/ConfidenceBadge.tsx | 115 | ✅ |
| 69 | src/components/features/confidence/ConfidenceBreakdown.tsx | 553 | ✅ |
| 70 | src/components/features/confidence/ConfidenceIndicator.tsx | 154 | ✅ |
| 71 | src/components/features/confidence/index.ts | 18 | ✅ |
| 72 | src/components/features/data-template/DataTemplateCard.tsx | 172 | ✅ |
| 73 | src/components/features/data-template/DataTemplateFieldEditor.tsx | 392 | ✅ |
| 74 | src/components/features/data-template/DataTemplateFilters.tsx | 181 | ✅ |
| 75 | src/components/features/data-template/DataTemplateForm.tsx | 292 | ✅ |
| 76 | src/components/features/data-template/DataTemplateList.tsx | 101 | ✅ |

## 2. 發現

### [Low] AUTH-01 開發模式登入後門：固定密碼 'dev'
- **檔案**：src/components/features/auth/DevLoginForm.tsx:26,38
- **類別**：I（認證機制本身）/ A（認證）
- **描述**：`DevLoginForm` 預設 email 為 `admin@example.com`，並以硬編碼 `password: 'dev'` 呼叫 `signIn('credentials', ...)`，使用者只需輸入任意 email 即可用固定密碼登入。此組件本身**沒有**任何環境守衛。
- **證據**：
  ```tsx
  const [email, setEmail] = React.useState('admin@example.com')
  // ...
  const result = await signIn('credentials', { email, password: 'dev', redirect: false })
  ```
- **緩解現況**：交叉確認 `src/app/[locale]/(auth)/auth/login/page.tsx:77-80,138`，此組件僅在 `showDevMode = (process.env.NODE_ENV === 'development') && !azureConfigured` 為真時才渲染，生產環境（NODE_ENV=production 或 Azure AD 已配置）不會出現。因此實際可利用性低。
- **殘餘風險**：真正的擋門在後端 credentials provider 是否會接受 `password: 'dev'` 的登入（不在本批 scope 內）。前端組件層面缺乏自我守衛屬縱深防禦缺層。建議：(1) 後端 credentials provider 對 `'dev'` 密碼路徑同樣加 `NODE_ENV !== 'production'` 守衛；(2) 確認生產建置不會把 `admin@example.com` 帳號以可登入狀態 seed。
- **建議**：列入後端 auth.config / credentials provider 審查重點交叉驗證。

### [Low] LOG-01 匯出檔案下載使用 window.open(downloadUrl) 未驗證協議
- **檔案**：src/components/features/admin/logs/LogExportDialog.tsx:165-170
- **類別**：F（前端 / open redirect）
- **描述**：`handleDownload` 直接 `window.open(exportStatus.downloadUrl, '_blank')`，`downloadUrl` 來自後端匯出狀態 API 回應。若後端回傳的 URL 可被污染為 `javascript:` 等協議，理論上有風險。實務上此 URL 為後端產生的 Blob/SAS 下載連結，由後端控制，注入面極小。
- **證據**：
  ```tsx
  const handleDownload = () => {
    if (exportStatus?.downloadUrl) {
      window.open(exportStatus.downloadUrl, '_blank')
    }
  }
  ```
- **建議**：縱深防禦可在開啟前校驗 URL 以 `https://` 或站內相對路徑開頭再 open。屬最佳實踐缺失，非實際漏洞。

### [Info] AUTH-02 callbackUrl 由 searchParams 傳入並用於 router.push
- **檔案**：src/components/features/auth/LoginForm.tsx:67,136 / DevLoginForm.tsx:50
- **類別**：I（open redirect）
- **描述**：登入成功後以 `router.push(callbackUrl)` 導向。`callbackUrl` 源自 URL searchParams（見 login page）。Next.js `router.push` 對外部絕對 URL 不會做跨站導向（會被當作站內路徑處理），open redirect 風險低，但仍建議於頁面層校驗 callbackUrl 為站內相對路徑。
- **建議**：在登入頁解析 callbackUrl 時加入 `startsWith('/')` 且非 `//` 開頭的白名單檢查。

### [Info] AUDIT-01 / RESTORE-01 整檔讀入記憶體做 base64（前端 DoS 面）
- **檔案**：src/components/features/audit/ReportIntegrityDialog.tsx:147-153
- **類別**：K（其他風險 / 前端資源耗用）
- **描述**：`handleVerify` 對使用者上傳檔案 `file.arrayBuffer()` 後以 reduce 逐 byte `btoa`，無檔案大小上限。超大檔可能使瀏覽器分頁卡死。僅影響操作者自身分頁，非伺服器側風險。
- **建議**：上傳前加檔案大小上限（如 ≤ 20MB）並改用 chunked / FileReader.readAsDataURL 以提升穩定性。屬使用者體驗 / 健壯性建議。

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 0 | 2 | 2 |

## 4. 區域整體觀察

- **無前端注入面**：全 76 檔均無 `dangerouslySetInnerHTML`、無 `innerHTML` 操作、無未轉義使用者內容渲染；所有顯示均透過 JSX 自動轉義。錯誤訊息 / log message / 檔名等使用者或後端內容都以 `{value}` 形式渲染，安全。
- **無客戶端 import server 模組**：全部為 `'use client'` 組件，資料存取一律透過 React Query hooks（`@/hooks/*`）或 `fetch('/api/...')` 呼叫後端 API，**無任何**直接 import `prisma` / server-only 模組。
- **無敏感資料存 localStorage**：全批未見 `localStorage` / `sessionStorage` 寫入 token / PII；剪貼簿複製（API key rotate、log 詳情）為使用者主動操作，屬正常。
- **無 postMessage**：全批未使用 `window.postMessage` / message 事件監聽。
- **權限為前端 UX 控制、依賴後端強制**：多處（CitySelector 唯讀模式、UserStatusToggle「不可停用自己」、PermissionScopeIndicator、RoleList/DeleteRoleDialog/EditRoleDialog 的系統角色保護、ApiKeyManagement 等）皆為**前端顯示層**的權限呈現/防呆，真正授權須由對應後端 API route 強制。本批屬純前端組件，未發現前端自行決定授權結果的情況；惟提醒對應 API（`/api/admin/users/[id]/status`、`/api/roles`、`/api/admin/config`、`/api/admin/api-keys`、`/api/admin/companies/merge` 等）需在後端逐一驗證 session + 角色 + 城市範圍（IDOR）— 不在本批 scope。
- **表單驗證良好**：表單組件普遍採 React Hook Form + Zod（AddUserDialog、CreateAlertRuleDialog、CreateApiKeyDialog、DataTemplateForm、Register/Login、settings 三表單），數值/長度/枚舉皆有約束；少數以本地 state 管理的表單（CreateBackupDialog、ScheduleDialog、ConfigEditDialog、AuditReportExportDialog）有手動 validate，後端仍應重新驗證。
- **破壞性操作有確認機制**：RestoreDialog（多步 + 輸入 `RESTORE-CONFIRM`）、RestoreDetailDialog 回滾（輸入 `ROLLBACK-CONFIRM`）、刪除類均有 AlertDialog 二次確認，設計良好。
- **本批無 Critical / High**：唯一較需注意者為 AUTH-01（dev 登入後門），但已被頁面層 `NODE_ENV === 'development'` 守衛限制於開發環境，故評為 Low 並建議交叉驗證後端 credentials provider。
