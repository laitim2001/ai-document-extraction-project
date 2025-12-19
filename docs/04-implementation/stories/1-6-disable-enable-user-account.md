# Story 1.6: 停用與啟用用戶帳戶

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 停用離職員工的帳戶,
**So that** 確保系統安全，離職人員無法存取系統。

---

## Acceptance Criteria

### AC1: 停用用戶帳戶

**Given** 系統管理員查看活躍用戶
**When** 點擊「停用」按鈕並確認
**Then** 用戶狀態變更為「Inactive」
**And** 該用戶無法再登入系統
**And** 記錄變更至審計日誌

### AC2: 啟用用戶帳戶

**Given** 系統管理員查看已停用用戶
**When** 點擊「啟用」按鈕
**Then** 用戶狀態變更為「Active」
**And** 該用戶可以重新登入系統

### AC3: 停用用戶登入阻擋

**Given** 已停用的用戶嘗試登入
**When** Azure AD 驗證成功後
**Then** 系統顯示「您的帳戶已被停用，請聯繫管理員」

---

## Tasks / Subtasks

- [x] **Task 1: 停用/啟用按鈕** (AC: #1, #2)
  - [x] 1.1 在用戶列表加入操作按鈕
  - [x] 1.2 根據用戶狀態顯示「停用」或「啟用」
  - [x] 1.3 使用不同顏色區分操作

- [x] **Task 2: 確認對話框** (AC: #1)
  - [x] 2.1 停用操作需二次確認
  - [x] 2.2 顯示警告訊息說明影響
  - [x] 2.3 確認後執行操作

- [x] **Task 3: 狀態變更 API** (AC: #1, #2)
  - [x] 3.1 創建 PATCH `/api/admin/users/[id]/status` 端點
  - [x] 3.2 更新用戶 status 欄位
  - [x] 3.3 記錄審計日誌
  - [x] 3.4 返回更新結果

- [x] **Task 4: 登入阻擋邏輯** (AC: #3)
  - [x] 4.1 更新 NextAuth signIn 回調
  - [x] 4.2 檢查用戶 status 是否為 ACTIVE
  - [x] 4.3 非 ACTIVE 狀態返回錯誤

- [x] **Task 5: 停用用戶錯誤頁面** (AC: #3)
  - [x] 5.1 更新 `/error` 頁面處理 AccountDisabled 錯誤
  - [x] 5.2 顯示友善的停用訊息
  - [x] 5.3 提供聯繫管理員的指引

- [x] **Task 6: 用戶服務層擴展** (AC: #1, #2)
  - [x] 6.1 實現 updateUserStatus 函數
  - [x] 6.2 處理狀態變更邏輯
  - [x] 6.3 觸發審計日誌記錄

- [x] **Task 7: UI 狀態顯示** (AC: #1, #2)
  - [x] 7.1 用戶列表顯示狀態 Badge
  - [x] 7.2 Active 顯示綠色
  - [x] 7.3 Inactive 顯示灰色

- [x] **Task 8: 驗證與測試** (AC: #1-3)
  - [x] 8.1 測試停用用戶流程
  - [x] 8.2 測試啟用用戶流程
  - [x] 8.3 測試停用用戶登入阻擋
  - [x] 8.4 測試審計日誌記錄

---

## Dev Notes

### 依賴項

- **Story 1.5**: 用戶編輯功能、審計日誌

### Architecture Compliance

#### 狀態變更 API

```typescript
// PATCH /api/admin/users/[id]/status
interface UpdateStatusRequest {
  status: 'ACTIVE' | 'INACTIVE'
}

// Response:
interface UpdateStatusResponse {
  success: true
  data: {
    id: string
    status: UserStatus
  }
}
```

#### NextAuth 登入檢查

```typescript
// src/lib/auth.ts - signIn 回調更新
async signIn({ user, account }) {
  if (account?.provider === "azure-ad") {
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
    })

    // 檢查用戶是否被停用
    if (dbUser && dbUser.status === 'INACTIVE') {
      return '/error?error=AccountDisabled'
    }

    // ... 其他邏輯
  }
  return true
}
```

#### 錯誤頁面處理

```typescript
// src/app/(auth)/error/page.tsx
const errorMessages: Record<string, string> = {
  AccountDisabled: '您的帳戶已被停用，請聯繫管理員',
  // ... 其他錯誤
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 停用用戶 | 狀態變更為 Inactive，審計日誌記錄 |
| 啟用用戶 | 狀態變更為 Active |
| 停用用戶登入 | 顯示帳戶已停用錯誤訊息 |
| 狀態顯示 | 列表正確顯示狀態 Badge |

### References

- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-16]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR40]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.6 |
| Story Key | 1-6-disable-enable-user-account |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | FR40 |
| Dependencies | Story 1.5 |

---

*Story created: 2025-12-15*
*Status: done*
*Completed: 2025-12-18*

## Implementation Notes

### 實作完成項目

1. **狀態切換組件** (`src/components/features/admin/UserStatusToggle.tsx`)
   - 停用/啟用按鈕，根據用戶狀態顯示
   - AlertDialog 二次確認

2. **狀態變更 API** (`src/app/api/admin/users/[id]/status/route.ts`)
   - PATCH 端點處理狀態變更
   - 審計日誌記錄

3. **用戶服務層** (`src/services/user.service.ts`)
   - `updateUserStatus` 函數
   - 狀態變更邏輯

4. **驗證 Schema** (`src/lib/validations/user.schema.ts`)
   - 狀態更新驗證

5. **React Query Hook** (`src/hooks/use-users.ts`)
   - `useToggleUserStatus` mutation hook

6. **登入阻擋邏輯** (`src/lib/auth/index.ts`)
   - signIn 回調檢查用戶狀態
   - INACTIVE 用戶導向錯誤頁面
