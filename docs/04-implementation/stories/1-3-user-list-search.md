# Story 1.3: 用戶列表與搜尋

**Status:** ready-for-dev

---

## Story

**As a** 系統管理員,
**I want** 查看所有系統用戶的列表,
**So that** 我可以了解系統的用戶狀況並進行管理。

---

## Acceptance Criteria

### AC1: 用戶列表顯示

**Given** 系統管理員已登入
**When** 導航至「用戶管理」頁面
**Then** 系統顯示用戶列表，包含：
- 姓名
- Email
- 角色
- 城市
- 狀態
- 最後登入時間

### AC2: 分頁功能

**Given** 用戶列表頁面
**When** 用戶數量超過單頁顯示數量
**Then** 列表支援分頁（每頁 20 筆）

### AC3: 搜尋功能

**Given** 用戶列表頁面
**When** 輸入搜尋關鍵字
**Then** 列表支援按姓名或 Email 搜尋

### AC4: 篩選功能

**Given** 用戶列表頁面
**When** 選擇篩選條件
**Then** 列表支援按角色、城市、狀態篩選

### AC5: 載入狀態

**Given** 用戶列表載入中
**When** 數據尚未返回
**Then** 顯示 Skeleton 載入狀態

---

## Tasks / Subtasks

- [ ] **Task 1: 用戶列表頁面** (AC: #1, #5)
  - [ ] 1.1 創建 `src/app/(dashboard)/admin/users/page.tsx`
  - [ ] 1.2 實現用戶列表表格組件
  - [ ] 1.3 實現 Skeleton 載入狀態
  - [ ] 1.4 實現空狀態顯示

- [ ] **Task 2: 用戶列表 API** (AC: #1, #2, #3, #4)
  - [ ] 2.1 創建 `src/app/api/admin/users/route.ts`
  - [ ] 2.2 實現 GET 端點，支援分頁參數
  - [ ] 2.3 實現搜尋參數（name, email）
  - [ ] 2.4 實現篩選參數（role, city, status）
  - [ ] 2.5 返回用戶列表與總數

- [ ] **Task 3: 用戶服務層** (AC: #1, #2, #3, #4)
  - [ ] 3.1 創建 `src/services/user.service.ts`
  - [ ] 3.2 實現 getUsers 函數（含分頁、搜尋、篩選）
  - [ ] 3.3 實現 Prisma 查詢邏輯
  - [ ] 3.4 加入關聯查詢（roles, city）

- [ ] **Task 4: 分頁組件** (AC: #2)
  - [ ] 4.1 創建或使用 shadcn/ui Pagination 組件
  - [ ] 4.2 實現頁碼切換邏輯
  - [ ] 4.3 更新 URL query params

- [ ] **Task 5: 搜尋組件** (AC: #3)
  - [ ] 5.1 創建搜尋輸入框組件
  - [ ] 5.2 實現 debounce 搜尋（300ms）
  - [ ] 5.3 更新 URL query params

- [ ] **Task 6: 篩選組件** (AC: #4)
  - [ ] 6.1 創建篩選下拉選單（角色、城市、狀態）
  - [ ] 6.2 實現篩選邏輯
  - [ ] 6.3 支援多重篩選組合

- [ ] **Task 7: React Query 整合** (AC: #1, #5)
  - [ ] 7.1 創建 `src/hooks/useUsers.ts`
  - [ ] 7.2 實現 useUsers hook（含分頁、搜尋、篩選參數）
  - [ ] 7.3 配置 staleTime 和緩存策略

- [ ] **Task 8: 權限控制** (AC: #1)
  - [ ] 8.1 驗證用戶具有 USER_VIEW 權限
  - [ ] 8.2 無權限時重導向或顯示錯誤

- [ ] **Task 9: 驗證與測試** (AC: #1-5)
  - [ ] 9.1 測試用戶列表顯示
  - [ ] 9.2 測試分頁功能
  - [ ] 9.3 測試搜尋功能
  - [ ] 9.4 測試篩選功能
  - [ ] 9.5 測試載入狀態

---

## Dev Notes

### 依賴項

- **Story 1.0**: 專案基礎、shadcn/ui 組件
- **Story 1.1**: 認證、Session 管理
- **Story 1.2**: User 模型、Role 模型、權限系統

### Project Structure Notes

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── admin/
│   │       └── users/
│   │           └── page.tsx        # 用戶列表頁面
│   └── api/
│       └── admin/
│           └── users/
│               └── route.ts        # 用戶列表 API
├── components/
│   └── features/
│       └── admin/
│           ├── UserList.tsx        # 用戶列表組件
│           ├── UserListSkeleton.tsx
│           ├── UserSearchBar.tsx   # 搜尋組件
│           └── UserFilters.tsx     # 篩選組件
├── hooks/
│   └── useUsers.ts                 # 用戶查詢 hook
└── services/
    └── user.service.ts             # 用戶服務層
```

### Architecture Compliance

#### API 端點設計

```typescript
// GET /api/admin/users
// Query params:
//   - page: number (default: 1)
//   - pageSize: number (default: 20)
//   - search: string (搜尋 name 或 email)
//   - role: string (角色 ID)
//   - city: string (城市 ID)
//   - status: 'ACTIVE' | 'INACTIVE'

// Response:
interface UsersResponse {
  success: true
  data: User[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}
```

#### 用戶服務層

```typescript
// src/services/user.service.ts
import { prisma } from '@/lib/prisma'
import { UserStatus } from '@prisma/client'

interface GetUsersParams {
  page: number
  pageSize: number
  search?: string
  roleId?: string
  cityId?: string
  status?: UserStatus
}

export async function getUsers(params: GetUsersParams) {
  const { page, pageSize, search, roleId, cityId, status } = params

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(roleId && {
      roles: { some: { roleId } },
    }),
    ...(cityId && {
      roles: { some: { cityId } },
    }),
    ...(status && { status }),
  }

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        roles: {
          include: { role: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}
```

#### React Query Hook

```typescript
// src/hooks/useUsers.ts
import { useQuery } from '@tanstack/react-query'

interface UseUsersParams {
  page: number
  pageSize?: number
  search?: string
  roleId?: string
  cityId?: string
  status?: string
}

export function useUsers(params: UseUsersParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value))
        }
      })

      const response = await fetch(`/api/admin/users?${searchParams}`)
      if (!response.ok) throw new Error('Failed to fetch users')
      return response.json()
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| 列表顯示 | 正確顯示用戶資訊（姓名、Email、角色、狀態） |
| 分頁 | 點擊頁碼正確切換，URL 更新 |
| 搜尋 | 輸入關鍵字後列表正確篩選 |
| 篩選 | 選擇篩選條件後列表正確更新 |
| 載入狀態 | 數據載入時顯示 Skeleton |

### References

- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-13]
- [Source: docs/02-architecture/sections/implementation-patterns-consistency-rules.md]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR37]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.3 |
| Story Key | 1-3-user-list-search |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | FR37 |
| Dependencies | Story 1.0, 1.1, 1.2 |

---

*Story created: 2025-12-15*
*Status: ready-for-dev*
