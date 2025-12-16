# Story 1.7: 自定義角色管理

**Status:** ready-for-dev

---

## Story

**As a** 系統管理員,
**I want** 創建自定義角色並定義權限,
**So that** 我可以靈活地配置符合組織需求的權限組合。

---

## Acceptance Criteria

### AC1: 新增自定義角色

**Given** 系統管理員在角色管理頁面
**When** 點擊「新增角色」按鈕
**Then** 系統顯示角色創建表單，包含權限選擇清單

### AC2: 角色創建與使用

**Given** 填寫角色名稱並選擇權限
**When** 點擊「儲存」按鈕
**Then** 系統創建新角色
**And** 新角色可被分配給用戶

### AC3: 系統角色保護

**Given** 查看系統預設角色
**When** 嘗試編輯或刪除
**Then** 系統禁止修改系統預設角色

### AC4: 角色刪除保護

**Given** 自定義角色已被分配給用戶
**When** 嘗試刪除該角色
**Then** 系統顯示警告並要求先移除用戶分配

---

## Tasks / Subtasks

- [ ] **Task 1: 角色管理頁面** (AC: #1, #3)
  - [ ] 1.1 創建 `src/app/(dashboard)/admin/roles/page.tsx`
  - [ ] 1.2 顯示角色列表（系統角色 + 自定義角色）
  - [ ] 1.3 區分系統角色和自定義角色
  - [ ] 1.4 系統角色顯示鎖定圖示

- [ ] **Task 2: 新增角色對話框** (AC: #1, #2)
  - [ ] 2.1 創建 `AddRoleDialog.tsx` 組件
  - [ ] 2.2 角色名稱輸入欄位
  - [ ] 2.3 角色描述輸入欄位
  - [ ] 2.4 權限選擇清單（分類顯示）

- [ ] **Task 3: 權限選擇組件** (AC: #1)
  - [ ] 3.1 創建 `PermissionSelector.tsx` 組件
  - [ ] 3.2 按類別分組顯示權限
  - [ ] 3.3 支援全選/取消全選
  - [ ] 3.4 顯示權限描述

- [ ] **Task 4: 角色 CRUD API** (AC: #1, #2, #3, #4)
  - [ ] 4.1 GET `/api/admin/roles` - 獲取所有角色
  - [ ] 4.2 POST `/api/admin/roles` - 創建角色
  - [ ] 4.3 PATCH `/api/admin/roles/[id]` - 更新角色
  - [ ] 4.4 DELETE `/api/admin/roles/[id]` - 刪除角色

- [ ] **Task 5: 角色服務層** (AC: #2, #3, #4)
  - [ ] 5.1 實現 createRole 函數
  - [ ] 5.2 實現 updateRole 函數（檢查 isSystem）
  - [ ] 5.3 實現 deleteRole 函數（檢查用戶關聯）
  - [ ] 5.4 實現 checkRoleInUse 函數

- [ ] **Task 6: 編輯角色功能** (AC: #3)
  - [ ] 6.1 創建 `EditRoleDialog.tsx` 組件
  - [ ] 6.2 預填現有角色資料
  - [ ] 6.3 系統角色禁止編輯（顯示唯讀）

- [ ] **Task 7: 刪除角色功能** (AC: #4)
  - [ ] 7.1 實現刪除確認對話框
  - [ ] 7.2 檢查角色是否被使用
  - [ ] 7.3 顯示使用中的用戶數量
  - [ ] 7.4 被使用時禁止刪除

- [ ] **Task 8: 表單驗證** (AC: #1, #2)
  - [ ] 8.1 角色名稱唯一性檢查
  - [ ] 8.2 至少選擇一個權限
  - [ ] 8.3 名稱長度限制

- [ ] **Task 9: 驗證與測試** (AC: #1-4)
  - [ ] 9.1 測試創建自定義角色
  - [ ] 9.2 測試角色分配給用戶
  - [ ] 9.3 測試系統角色保護
  - [ ] 9.4 測試角色刪除保護

---

## Dev Notes

### 依賴項

- **Story 1.2**: 角色基礎架構、權限常量

### Project Structure Notes

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── admin/
│   │       └── roles/
│   │           └── page.tsx        # 角色管理頁面
│   └── api/
│       └── admin/
│           └── roles/
│               ├── route.ts        # GET, POST
│               └── [id]/
│                   └── route.ts    # PATCH, DELETE
├── components/
│   └── features/
│       └── admin/
│           ├── RoleList.tsx
│           ├── AddRoleDialog.tsx
│           ├── EditRoleDialog.tsx
│           └── PermissionSelector.tsx
```

### Architecture Compliance

#### 角色 API 設計

```typescript
// POST /api/admin/roles
interface CreateRoleRequest {
  name: string
  description?: string
  permissions: string[]
}

// PATCH /api/admin/roles/[id]
interface UpdateRoleRequest {
  name?: string
  description?: string
  permissions?: string[]
}

// DELETE /api/admin/roles/[id]
// 返回 409 如果角色被使用:
interface DeleteErrorResponse {
  success: false
  error: {
    type: 'conflict'
    title: 'Role In Use'
    status: 409
    detail: '此角色已分配給 5 位用戶，請先移除分配'
    usersCount: number
  }
}
```

#### 權限分類顯示

```typescript
// src/types/permission-categories.ts
export const PERMISSION_CATEGORIES = {
  '發票管理': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
  ],
  '報表': [
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
  ],
  '規則管理': [
    PERMISSIONS.RULE_VIEW,
    PERMISSIONS.RULE_MANAGE,
    PERMISSIONS.RULE_APPROVE,
  ],
  '用戶管理': [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.USER_MANAGE_CITY,
    PERMISSIONS.USER_MANAGE_REGION,
  ],
  '系統管理': [
    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.SYSTEM_MONITOR,
  ],
  '審計': [
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
  ],
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 創建角色 | 成功創建並顯示在列表 |
| 權限選擇 | 分類顯示，可多選 |
| 系統角色保護 | 編輯/刪除按鈕禁用或隱藏 |
| 刪除保護 | 被使用的角色無法刪除 |

### References

- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-17]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR41]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.7 |
| Story Key | 1-7-custom-role-management |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | FR41 |
| Dependencies | Story 1.2 |

---

*Story created: 2025-12-15*
*Status: ready-for-dev*
