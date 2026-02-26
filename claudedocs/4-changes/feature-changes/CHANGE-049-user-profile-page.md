# CHANGE-049: User Profile 個人資料頁面

> **日期**: 2026-02-26
> **狀態**: 📋 規劃中
> **優先級**: Medium
> **類型**: New Feature
> **影響範圍**: 新增 `/profile` 頁面路由、TopBar 導航入口、i18n 新命名空間
> **前置條件**: 無
> **觸發事件**: 系統缺少個人資料頁面，用戶無法查看/編輯個人資訊

---

## 變更背景

### 現況分析

系統目前**沒有 User Profile 頁面**。用戶無法：
- 查看自己的帳號資訊（名稱、Email、角色、所屬城市）
- 修改個人資訊（顯示名稱）
- 修改密碼（本地帳號用戶）
- 查看自己的角色與權限

### 已有的後端支援

| 功能 | 現有實現 | 狀態 |
|------|----------|------|
| 用戶資訊 CRUD | `src/services/user.service.ts`（903 行） | ✅ 完整 |
| 用戶 API | `GET/PATCH /api/admin/users/[id]` | ✅ 完整 |
| 語言偏好 API | `PATCH /api/v1/users/me/locale` | ✅ 完整 |
| 語言切換 UI | TopBar `LocaleSwitcher` | ✅ 完整 |
| 用戶 Hook | `src/hooks/use-users.ts`（553 行） | ✅ 完整 |
| 認證系統 | NextAuth（Azure AD + 本地帳號） | ✅ 完整 |

### 缺失的部分

| 功能 | 狀態 |
|------|------|
| Profile 頁面路由 (`/profile/`) | ❌ 不存在 |
| 當前用戶資訊 API (`/api/v1/users/me`) | ❌ 不存在（需新增） |
| 密碼修改 API (`/api/v1/users/me/password`) | ❌ 不存在（需新增） |
| Profile Hook (`use-profile.ts`) | ❌ 不存在 |
| TopBar 用戶選單 Profile 入口 | ⚠️ 連結指向不存在的 `/settings/profile`，需修正為 `/profile` |
| i18n `profile` 命名空間 | ❌ 不存在 |

---

## 變更內容

### Step 1: 建立「當前用戶」API 路由

**新增** `src/app/api/v1/users/me/route.ts`

| HTTP 方法 | 功能 | 說明 |
|-----------|------|------|
| `GET` | 取得當前登入用戶資訊 | 透過 NextAuth session 取得 userId，查詢完整用戶資料（含角色、城市、權限） |
| `PATCH` | 更新當前用戶資訊 | 僅允許修改：`displayName`。其他欄位（email、角色等）需由 Admin 修改 |

**回應格式**：

```typescript
// GET /api/v1/users/me
{
  success: true,
  data: {
    id: string;
    email: string;
    name: string;
    displayName: string | null;
    provider: 'azure-ad' | 'local';  // 認證方式
    roles: Array<{ id: string; name: string; description: string }>;
    cities: Array<{ id: string; name: string }>;
    permissions: string[];
    locale: string;
    createdAt: string;
    lastLoginAt: string | null;
  }
}
```

### Step 2: 建立密碼修改 API

**新增** `src/app/api/v1/users/me/password/route.ts`

| HTTP 方法 | 功能 | 說明 |
|-----------|------|------|
| `POST` | 修改密碼 | Body: `{ currentPassword, newPassword, confirmPassword }` |

**安全規則**：
- 僅 `provider: 'local'` 用戶可修改密碼
- Azure AD 用戶調用此 API 返回 400（密碼由 Azure AD 管理）
- 需驗證 `currentPassword` 正確
- `newPassword` 至少 8 字元，含大小寫字母和數字
- 使用 bcrypt 加密存儲

### Step 3: 建立 Profile Hook

**新增** `src/hooks/use-profile.ts`

```typescript
// 主要 exports：
// - useProfile(): 取得當前用戶資料（React Query）
// - useUpdateProfile(): mutation — 更新顯示名稱
// - useChangePassword(): mutation — 修改密碼
```

### Step 4: 建立 Profile 頁面

#### 4a: Server Component

**新增** `src/app/[locale]/(dashboard)/profile/page.tsx`

```typescript
// Server Component
// - 使用 auth() 驗證登入狀態
// - 使用 getTranslations('profile') 取得翻譯
// - 渲染 ProfileClient 組件
```

#### 4b: Client Component

**新增** `src/app/[locale]/(dashboard)/profile/client.tsx`

使用 Card 組件分區顯示，佈局如下：

```
+----------------------------------------------------------+
|  My Profile                                               |
+----------------------------------------------------------+
|                                                           |
|  +-----------------------------------------------------+ |
|  | Basic Information                                     | |
|  |                                                       | |
|  |  Name:       John Doe              [Edit]             | |
|  |  Email:      john@example.com      (read-only)       | |
|  |  Provider:   Azure AD              (read-only)       | |
|  |  Member Since: 2026-01-15          (read-only)       | |
|  |  Last Login:   2026-02-26 10:30    (read-only)       | |
|  +-----------------------------------------------------+ |
|                                                           |
|  +-----------------------------------------------------+ |
|  | Roles & Permissions                                   | |
|  |                                                       | |
|  |  Roles:      [System Admin] [City Manager - HK]      | |
|  |  Permissions: user:view, user:manage, report:view,   | |
|  |               document:view, document:manage, ...     | |
|  +-----------------------------------------------------+ |
|                                                           |
|  +-----------------------------------------------------+ |
|  | Language Preference                                    | |
|  |                                                       | |
|  |  Language:   [English ▼]                              | |
|  |  (整合已有的 LocaleSwitcher 邏輯)                     | |
|  +-----------------------------------------------------+ |
|                                                           |
|  +-----------------------------------------------------+ |  ← 僅 local 帳號顯示
|  | Change Password                                       | |
|  |                                                       | |
|  |  Current Password:  [________]                       | |
|  |  New Password:      [________]                       | |
|  |  Confirm Password:  [________]                       | |
|  |                                                       | |
|  |  [Change Password]                                    | |
|  +-----------------------------------------------------+ |
|                                                           |
+----------------------------------------------------------+
```

### Step 5: 新增 i18n 命名空間 — profile

**新增** `messages/en/profile.json`

```json
{
  "pageTitle": "My Profile",
  "pageDescription": "View and manage your account information",
  "basicInfo": {
    "title": "Basic Information",
    "name": "Display Name",
    "email": "Email",
    "provider": "Login Method",
    "providerAzureAd": "Azure AD (SSO)",
    "providerLocal": "Local Account",
    "memberSince": "Member Since",
    "lastLogin": "Last Login",
    "edit": "Edit",
    "save": "Save",
    "cancel": "Cancel",
    "updateSuccess": "Profile updated successfully",
    "updateError": "Failed to update profile"
  },
  "roles": {
    "title": "Roles & Permissions",
    "rolesLabel": "Roles",
    "permissionsLabel": "Permissions",
    "noRoles": "No roles assigned",
    "cityLabel": "City"
  },
  "language": {
    "title": "Language Preference",
    "label": "Language",
    "description": "Select your preferred language for the interface"
  },
  "password": {
    "title": "Change Password",
    "description": "Change your local account password",
    "azureAdNote": "Your password is managed by Azure AD. Please use your organization's portal to change it.",
    "currentPassword": "Current Password",
    "newPassword": "New Password",
    "confirmPassword": "Confirm New Password",
    "submit": "Change Password",
    "success": "Password changed successfully",
    "error": "Failed to change password",
    "mismatch": "Passwords do not match",
    "requirements": "Password must be at least 8 characters with uppercase, lowercase, and numbers"
  }
}
```

**新增** `messages/zh-TW/profile.json`（繁體中文翻譯）
**新增** `messages/zh-CN/profile.json`（簡體中文翻譯）

### Step 6: 更新 i18n 配置

**修改** `src/i18n/request.ts` — 在 `namespaces` 陣列中新增 `'profile'`

### Step 7: 新增 TopBar Profile 入口

**修改** `src/components/layout/TopBar.tsx`（或 TopBar 中的用戶選單組件）

在右上角用戶頭像/名稱的 dropdown menu 中新增 "My Profile" 連結：

```typescript
<DropdownMenuItem>
  <Link href="/profile">
    <User className="h-4 w-4 mr-2" />
    {t('navigation.profile')}
  </Link>
</DropdownMenuItem>
```

**修改** `messages/{en,zh-TW,zh-CN}/navigation.json` — 新增 `navigation.profile` 翻譯 key

---

## 修改檔案清單

| # | 動作 | 檔案 | 說明 |
|---|------|------|------|
| 1 | 新增 | `src/app/api/v1/users/me/route.ts` | 當前用戶 GET/PATCH API |
| 2 | 新增 | `src/app/api/v1/users/me/password/route.ts` | 密碼修改 API |
| 3 | 新增 | `src/hooks/use-profile.ts` | Profile React Query hook |
| 4 | 新增 | `src/app/[locale]/(dashboard)/profile/page.tsx` | Profile 頁面（Server） |
| 5 | 新增 | `src/app/[locale]/(dashboard)/profile/client.tsx` | Profile 客戶端組件 |
| 6 | 新增 | `messages/en/profile.json` | 英文翻譯 |
| 7 | 新增 | `messages/zh-TW/profile.json` | 繁體中文翻譯 |
| 8 | 新增 | `messages/zh-CN/profile.json` | 簡體中文翻譯 |
| 9 | 修改 | `src/i18n/request.ts` | 新增 `profile` 命名空間 |
| 10 | 修改 | `src/components/layout/TopBar.tsx` | 新增 Profile 連結 |
| 11 | 修改 | `messages/en/navigation.json` | 新增 `navigation.profile` |
| 12 | 修改 | `messages/zh-TW/navigation.json` | 新增 `navigation.profile` |
| 13 | 修改 | `messages/zh-CN/navigation.json` | 新增 `navigation.profile` |

---

## 影響評估

### API 影響

- **新增端點**: 2 個 route files（3 個端點：GET me、PATCH me、POST password）
- **API 路由總量**: 175 -> 177 files
- **不影響既有 `/api/admin/users/[id]` API**

### 組件影響

- **新增組件**: 2 個（page.tsx, client.tsx）
- **修改組件**: 1 個（TopBar.tsx — 新增 dropdown 項目）
- **不需要修改 Sidebar**（Profile 入口在 TopBar）

### i18n 影響

- **新增命名空間**: `profile`（第 31 個命名空間）
- **修改命名空間**: `navigation`（新增 1 個 key）

### 資料庫影響

- **無需 Migration**：使用既有的 `User` model，不新增欄位或表

### 認證影響

- **Azure AD 用戶**：隱藏密碼修改區塊，顯示「密碼由 Azure AD 管理」提示
- **本地帳號用戶**：顯示密碼修改表單

---

## 風險評估

| 風險 | 嚴重度 | 可能性 | 緩解措施 |
|------|--------|--------|----------|
| `/api/v1/users/me` 與 `/api/admin/users/[id]` 路徑混淆 | 低 | 低 | `me` 路由使用 session userId，`admin` 路由使用路徑參數，邏輯完全分離 |
| 密碼修改安全風險 | 中 | 低 | 使用 bcrypt 驗證舊密碼、rate limiting（可選）、Zod schema 強驗證 |
| TopBar 修改影響既有佈局 | 低 | 低 | 僅在 dropdown menu 中新增一個項目，不影響 TopBar 主結構 |
| Azure AD 用戶嘗試修改密碼 | 低 | 中 | 前端隱藏密碼區塊 + API 端檢查 provider 類型雙重防護 |

---

## 實施順序建議

```
Phase 1（API 層）:
  1. /api/v1/users/me — GET/PATCH
  2. /api/v1/users/me/password — POST
  3. use-profile.ts hook

Phase 2（UI 層）:
  4. Profile 頁面（page.tsx + client.tsx）
  5. i18n 翻譯（3 語言）
  6. 更新 i18n request.ts

Phase 3（導航）:
  7. TopBar Profile 入口
  8. navigation.json 更新

Phase 4（驗證）:
  9. TypeScript 類型檢查
  10. i18n 同步檢查
  11. 手動測試
```

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 頁面載入 | 登入後點擊 TopBar 用戶選單 -> My Profile | 顯示 Profile 頁面，資訊正確 |
| 2 | 修改顯示名稱 | 點擊 Edit -> 修改名稱 -> Save | Toast 成功，名稱更新 |
| 3 | 角色檢視 | 查看 Roles & Permissions 區塊 | 顯示所有角色和權限（唯讀） |
| 4 | 語言偏好 | 切換語言 | 介面語言切換，偏好持久化 |
| 5 | 密碼修改（本地帳號） | 輸入舊密碼 + 新密碼 -> Submit | 密碼更新成功 |
| 6 | 密碼修改（Azure AD） | 檢查是否顯示密碼修改表單 | 不顯示表單，顯示 Azure AD 提示 |
| 7 | 密碼驗證失敗 | 輸入錯誤的舊密碼 | 顯示錯誤訊息 |
| 8 | 未登入訪問 | 未登入直接訪問 `/profile` | 重定向到登入頁 |
| 9 | 語言切換 | 在不同語言下查看 Profile 頁面 | 所有文字正確翻譯 |
