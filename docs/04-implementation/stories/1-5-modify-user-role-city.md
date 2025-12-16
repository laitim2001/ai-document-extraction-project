# Story 1.5: 修改用戶角色與城市歸屬

**Status:** ready-for-dev

---

## Story

**As a** 系統管理員,
**I want** 修改用戶的角色和城市歸屬,
**So that** 我可以調整用戶的權限以符合其職責變更。

---

## Acceptance Criteria

### AC1: 編輯用戶表單

**Given** 系統管理員查看用戶詳情
**When** 點擊「編輯」按鈕
**Then** 系統顯示可編輯的用戶資料表單

### AC2: 成功修改用戶

**Given** 修改用戶的角色或城市歸屬
**When** 點擊「儲存」按鈕
**Then** 系統更新用戶記錄
**And** 記錄變更至審計日誌
**And** 顯示成功訊息

### AC3: 權限即時生效

**Given** 用戶被分配新角色
**When** 該用戶下次操作時
**Then** 系統應用新的權限設定

---

## Tasks / Subtasks

- [ ] **Task 1: 用戶詳情頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/admin/users/[id]/page.tsx`
  - [ ] 1.2 顯示用戶詳細資訊
  - [ ] 1.3 顯示當前角色和城市歸屬
  - [ ] 1.4 加入編輯按鈕

- [ ] **Task 2: 編輯用戶對話框** (AC: #1)
  - [ ] 2.1 創建 `EditUserDialog.tsx` 組件
  - [ ] 2.2 預填現有用戶資料
  - [ ] 2.3 允許修改姓名、角色、城市
  - [ ] 2.4 Email 為唯讀欄位

- [ ] **Task 3: 更新用戶 API** (AC: #2)
  - [ ] 3.1 創建 PATCH `/api/admin/users/[id]` 端點
  - [ ] 3.2 更新用戶基本資料
  - [ ] 3.3 更新用戶角色關聯
  - [ ] 3.4 返回更新結果

- [ ] **Task 4: 審計日誌記錄** (AC: #2)
  - [ ] 4.1 記錄角色變更（舊值 → 新值）
  - [ ] 4.2 記錄城市變更（舊值 → 新值）
  - [ ] 4.3 記錄操作者和時間戳

- [ ] **Task 5: 用戶服務層擴展** (AC: #2, #3)
  - [ ] 5.1 實現 updateUser 函數
  - [ ] 5.2 實現 updateUserRoles 函數
  - [ ] 5.3 處理角色新增和移除邏輯

- [ ] **Task 6: Session 刷新機制** (AC: #3)
  - [ ] 6.1 角色變更後標記 Session 需刷新
  - [ ] 6.2 用戶下次請求時重新載入權限
  - [ ] 6.3 或使用 JWT 短效期策略

- [ ] **Task 7: 表單驗證** (AC: #1, #2)
  - [ ] 7.1 創建 updateUserSchema（Zod）
  - [ ] 7.2 驗證角色變更合法性
  - [ ] 7.3 驗證城市選擇正確性

- [ ] **Task 8: 驗證與測試** (AC: #1-3)
  - [ ] 8.1 測試編輯表單顯示
  - [ ] 8.2 測試成功修改用戶
  - [ ] 8.3 測試審計日誌記錄
  - [ ] 8.4 測試權限即時生效

---

## Dev Notes

### 依賴項

- **Story 1.4**: 用戶新增功能、角色選擇組件

### Architecture Compliance

#### 更新用戶 API

```typescript
// PATCH /api/admin/users/[id]
interface UpdateUserRequest {
  name?: string
  roleIds?: string[]
  cityId?: string | null
}

// Response:
interface UpdateUserResponse {
  success: true
  data: User
}
```

#### 審計日誌記錄

```typescript
// src/lib/audit/logger.ts
import { prisma } from '@/lib/prisma'

export async function logUserChange(params: {
  userId: string
  action: 'UPDATE_ROLE' | 'UPDATE_CITY' | 'UPDATE_INFO'
  oldValue: unknown
  newValue: unknown
  performedBy: string
}) {
  await prisma.auditLog.create({
    data: {
      entityType: 'USER',
      entityId: params.userId,
      action: params.action,
      oldValue: JSON.stringify(params.oldValue),
      newValue: JSON.stringify(params.newValue),
      performedBy: params.performedBy,
      performedAt: new Date(),
    },
  })
}
```

#### Prisma Schema - AuditLog

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  entityType  String   @map("entity_type")
  entityId    String   @map("entity_id")
  action      String
  oldValue    String?  @map("old_value") @db.Text
  newValue    String?  @map("new_value") @db.Text
  performedBy String   @map("performed_by")
  performedAt DateTime @map("performed_at")

  @@index([entityType, entityId])
  @@index([performedAt])
  @@map("audit_logs")
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 編輯表單 | 正確顯示現有用戶資料 |
| 修改角色 | 角色變更成功並記錄審計日誌 |
| 修改城市 | 城市變更成功並記錄審計日誌 |
| 權限生效 | 用戶重新登入後權限更新 |

### References

- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-15]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR39]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.5 |
| Story Key | 1-5-modify-user-role-city |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | FR39 |
| Dependencies | Story 1.4 |

---

*Story created: 2025-12-15*
*Status: ready-for-dev*
