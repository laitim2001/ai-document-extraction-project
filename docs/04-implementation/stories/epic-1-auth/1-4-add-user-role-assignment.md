# Story 1.4: 新增用戶與角色分配

**Status:** ready-for-dev

---

## Story

**As a** 系統管理員,
**I want** 新增用戶並分配角色,
**So that** 新員工可以使用系統執行其職責。

---

## Acceptance Criteria

### AC1: 新增用戶表單

**Given** 系統管理員在用戶管理頁面
**When** 點擊「新增用戶」按鈕
**Then** 系統顯示新增用戶表單

### AC2: 成功新增用戶

**Given** 填寫有效的用戶資料（Email、姓名、角色、城市）
**When** 點擊「儲存」按鈕
**Then** 系統創建用戶記錄
**And** 系統發送邀請通知（如配置）
**And** 顯示成功訊息並返回列表

### AC3: Email 重複驗證

**Given** 填寫的 Email 已存在
**When** 點擊「儲存」按鈕
**Then** 系統顯示錯誤訊息「此 Email 已被使用」

---

## Tasks / Subtasks

- [ ] **Task 1: 新增用戶對話框** (AC: #1)
  - [ ] 1.1 創建 `AddUserDialog.tsx` 組件
  - [ ] 1.2 使用 shadcn/ui Dialog 組件
  - [ ] 1.3 實現表單欄位（Email、姓名、角色選擇、城市選擇）
  - [ ] 1.4 使用 React Hook Form + Zod 驗證

- [ ] **Task 2: 新增用戶 API** (AC: #2, #3)
  - [ ] 2.1 創建 POST `/api/admin/users` 端點
  - [ ] 2.2 實現 Email 唯一性檢查
  - [ ] 2.3 創建用戶記錄
  - [ ] 2.4 創建用戶角色關聯
  - [ ] 2.5 返回創建結果

- [ ] **Task 3: 用戶服務層擴展** (AC: #2, #3)
  - [ ] 3.1 實現 createUser 函數
  - [ ] 3.2 實現 checkEmailExists 函數
  - [ ] 3.3 實現角色分配邏輯

- [ ] **Task 4: 表單驗證 Schema** (AC: #1, #3)
  - [ ] 4.1 創建 `src/lib/validations/user.ts`
  - [ ] 4.2 定義 createUserSchema（Zod）
  - [ ] 4.3 前後端共用驗證邏輯

- [ ] **Task 5: 角色選擇組件** (AC: #1)
  - [ ] 5.1 創建角色下拉選單組件
  - [ ] 5.2 從 API 載入可用角色
  - [ ] 5.3 支援多角色選擇

- [ ] **Task 6: 城市選擇組件** (AC: #1)
  - [ ] 6.1 創建城市下拉選單組件
  - [ ] 6.2 從 API 載入城市列表
  - [ ] 6.3 根據角色顯示/隱藏城市選項

- [ ] **Task 7: 成功/錯誤處理** (AC: #2, #3)
  - [ ] 7.1 實現 Toast 成功訊息
  - [ ] 7.2 實現錯誤訊息顯示
  - [ ] 7.3 表單提交後刷新用戶列表

- [ ] **Task 8: 權限控制** (AC: #1)
  - [ ] 8.1 驗證用戶具有 USER_MANAGE 權限
  - [ ] 8.2 無權限時隱藏新增按鈕

- [ ] **Task 9: 驗證與測試** (AC: #1-3)
  - [ ] 9.1 測試表單顯示和驗證
  - [ ] 9.2 測試成功新增用戶
  - [ ] 9.3 測試 Email 重複錯誤

---

## Dev Notes

### 依賴項

- **Story 1.3**: 用戶列表頁面、用戶服務層

### Architecture Compliance

#### 表單驗證 Schema

```typescript
// src/lib/validations/user.ts
import { z } from 'zod'

export const createUserSchema = z.object({
  email: z
    .string()
    .email('請輸入有效的 Email 地址')
    .min(1, 'Email 為必填'),
  name: z
    .string()
    .min(2, '姓名至少需要 2 個字元')
    .max(100, '姓名不能超過 100 個字元'),
  roleIds: z
    .array(z.string())
    .min(1, '請至少選擇一個角色'),
  cityId: z
    .string()
    .optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
```

#### 新增用戶 API

```typescript
// POST /api/admin/users
// Request body:
interface CreateUserRequest {
  email: string
  name: string
  roleIds: string[]
  cityId?: string
}

// Response (success):
interface CreateUserResponse {
  success: true
  data: User
}

// Response (error - email exists):
interface ErrorResponse {
  success: false
  error: {
    type: 'validation_error'
    title: 'Email Already Exists'
    status: 409
    detail: '此 Email 已被使用'
  }
}
```

#### 用戶服務層

```typescript
// src/services/user.service.ts
export async function createUser(input: CreateUserInput) {
  // 檢查 Email 是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  })

  if (existingUser) {
    throw new AppError(
      'validation_error',
      'Email Already Exists',
      409,
      '此 Email 已被使用'
    )
  }

  // 創建用戶和角色關聯
  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      status: 'ACTIVE',
      roles: {
        create: input.roleIds.map(roleId => ({
          roleId,
          cityId: input.cityId,
        })),
      },
    },
    include: {
      roles: { include: { role: true } },
    },
  })
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 表單顯示 | 點擊新增按鈕後顯示表單對話框 |
| 欄位驗證 | 空白或無效輸入顯示錯誤訊息 |
| 成功新增 | 創建用戶後顯示成功訊息，列表刷新 |
| Email 重複 | 輸入已存在 Email 顯示錯誤訊息 |

### References

- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-14]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR38]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.4 |
| Story Key | 1-4-add-user-role-assignment |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | FR38 |
| Dependencies | Story 1.3 |

---

*Story created: 2025-12-15*
*Status: ready-for-dev*
