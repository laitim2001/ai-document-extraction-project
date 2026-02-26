# Story 1.8: 城市經理用戶管理

**Status:** done

---

## Story

**As a** 城市經理,
**I want** 管理本城市的用戶,
**So that** 我可以自主處理本城市的人員異動。

---

## Acceptance Criteria

### AC1: 城市用戶列表篩選

**Given** 城市經理已登入
**When** 導航至「用戶管理」頁面
**Then** 系統僅顯示該城市的用戶列表

### AC2: 城市限制的用戶新增

**Given** 城市經理新增用戶
**When** 選擇城市歸屬時
**Then** 系統僅允許選擇該城市經理管轄的城市

### AC3: 跨城市操作阻擋

**Given** 城市經理嘗試修改其他城市的用戶
**When** 系統檢查權限
**Then** 系統拒絕操作並顯示「無權限」訊息

---

## Tasks / Subtasks

- [x] **Task 1: 用戶列表城市篩選** (AC: #1)
  - [x] 1.1 獲取當前用戶的城市歸屬
  - [x] 1.2 API 自動加入城市篩選條件
  - [x] 1.3 City Manager 看不到其他城市用戶
  - [x] 1.4 System Admin 可看到所有用戶

- [x] **Task 2: 城市權限檢查中間件** (AC: #1, #3)
  - [x] 2.1 創建 `checkCityPermission` 中間件
  - [x] 2.2 從 Session 獲取用戶角色和城市
  - [x] 2.3 驗證操作目標用戶的城市歸屬
  - [x] 2.4 無權限時返回 403 錯誤

- [x] **Task 3: 新增用戶城市限制** (AC: #2)
  - [x] 3.1 City Manager 城市選擇只顯示自己的城市
  - [x] 3.2 API 驗證城市選擇合法性
  - [x] 3.3 自動設定為當前城市（如只有一個）

- [x] **Task 4: 編輯用戶城市限制** (AC: #3)
  - [x] 4.1 City Manager 無法修改其他城市用戶
  - [x] 4.2 無法將用戶移動到其他城市
  - [x] 4.3 顯示友善的權限不足訊息

- [x] **Task 5: API 權限增強** (AC: #1, #2, #3)
  - [x] 5.1 GET `/api/admin/users` 加入城市過濾
  - [x] 5.2 POST `/api/admin/users` 驗證城市權限
  - [x] 5.3 PATCH `/api/admin/users/[id]` 驗證城市權限
  - [x] 5.4 PATCH `/api/admin/users/[id]/status` 驗證城市權限

- [x] **Task 6: 城市選擇器更新** (AC: #2)
  - [x] 6.1 根據用戶角色動態載入城市選項
  - [x] 6.2 City Manager 只顯示管轄城市
  - [x] 6.3 System Admin 顯示所有城市

- [x] **Task 7: UI 權限提示** (AC: #3)
  - [x] 7.1 無權限操作時顯示 Toast 提示
  - [x] 7.2 隱藏無權限的操作按鈕
  - [x] 7.3 顯示權限範圍說明

- [x] **Task 8: 城市資料模型** (AC: #1, #2)
  - [x] 8.1 創建 City 資料表（如尚未存在）
  - [x] 8.2 定義城市種子數據
  - [x] 8.3 建立城市-用戶關聯

- [x] **Task 9: 驗證與測試** (AC: #1-3)
  - [x] 9.1 測試 City Manager 用戶列表篩選
  - [x] 9.2 測試 City Manager 新增用戶限制
  - [x] 9.3 測試跨城市操作阻擋
  - [x] 9.4 測試 System Admin 全權限

---

## Dev Notes

### 依賴項

- **Story 1.3 ~ 1.6**: 用戶管理 CRUD 功能

### Architecture Compliance

#### 城市權限檢查

```typescript
// src/lib/auth/city-permission.ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'

export async function checkCityPermission(
  targetUserId: string,
  requiredPermission: string
) {
  const session = await auth()
  if (!session?.user) {
    throw new AppError('unauthorized', 'Unauthorized', 401, '請先登入')
  }

  const userPermissions = session.user.roles.flatMap(r => r.permissions)

  // System Admin 有全部權限
  if (userPermissions.includes(PERMISSIONS.USER_MANAGE)) {
    return true
  }

  // City Manager 只能管理本城市
  if (userPermissions.includes(PERMISSIONS.USER_MANAGE_CITY)) {
    const currentUserCity = await getUserCity(session.user.id)
    const targetUserCity = await getUserCity(targetUserId)

    if (currentUserCity !== targetUserCity) {
      throw new AppError(
        'forbidden',
        'Access Denied',
        403,
        '您只能管理本城市的用戶'
      )
    }
    return true
  }

  throw new AppError('forbidden', 'Access Denied', 403, '權限不足')
}

async function getUserCity(userId: string): Promise<string | null> {
  const userRole = await prisma.userRole.findFirst({
    where: { userId },
    select: { cityId: true },
  })
  return userRole?.cityId ?? null
}
```

#### API 城市過濾

```typescript
// GET /api/admin/users - 更新邏輯
export async function GET(request: Request) {
  const session = await auth()
  const userPermissions = session.user.roles.flatMap(r => r.permissions)

  let cityFilter: string | undefined

  // City Manager 自動加入城市篩選
  if (
    userPermissions.includes(PERMISSIONS.USER_MANAGE_CITY) &&
    !userPermissions.includes(PERMISSIONS.USER_MANAGE)
  ) {
    const userCity = await getUserCity(session.user.id)
    cityFilter = userCity ?? undefined
  }

  const users = await getUsers({
    ...params,
    cityId: cityFilter || params.cityId,
  })

  return Response.json({ success: true, data: users })
}
```

#### City Prisma Schema

```prisma
model City {
  id        String   @id @default(uuid())
  code      String   @unique  // e.g., "TPE", "HKG"
  name      String            // e.g., "台北", "香港"
  region    String?           // e.g., "East Asia"
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  userRoles UserRole[]

  @@map("cities")
}

// 更新 UserRole 加入 City 關聯
model UserRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  roleId    String   @map("role_id")
  cityId    String?  @map("city_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role  @relation(fields: [roleId], references: [id], onDelete: Cascade)
  city City? @relation(fields: [cityId], references: [id])

  @@unique([userId, roleId])
  @@map("user_roles")
}
```

#### 城市種子數據

```typescript
// prisma/seed.ts - 新增城市數據
const cities = [
  { code: 'TPE', name: '台北', region: 'Taiwan' },
  { code: 'KHH', name: '高雄', region: 'Taiwan' },
  { code: 'HKG', name: '香港', region: 'Greater China' },
  { code: 'SHA', name: '上海', region: 'Greater China' },
  { code: 'BKK', name: '曼谷', region: 'Southeast Asia' },
  { code: 'SGP', name: '新加坡', region: 'Southeast Asia' },
  { code: 'TYO', name: '東京', region: 'Japan' },
  { code: 'OSA', name: '大阪', region: 'Japan' },
  { code: 'SEL', name: '首爾', region: 'Korea' },
  { code: 'SYD', name: '雪梨', region: 'Oceania' },
  { code: 'AKL', name: '奧克蘭', region: 'Oceania' },
]

for (const city of cities) {
  await prisma.city.upsert({
    where: { code: city.code },
    update: {},
    create: city,
  })
}
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| City Manager 列表 | 只顯示本城市用戶 |
| City Manager 新增 | 只能選擇本城市 |
| 跨城市操作 | 顯示權限不足錯誤 |
| System Admin | 可管理所有城市用戶 |

### References

- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-18]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR42]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.8 |
| Story Key | 1-8-city-manager-user-management |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | FR42 |
| Dependencies | Story 1.3 ~ 1.6 |

---

*Story created: 2025-12-15*
*Status: done*
*Completed: 2025-12-18*

## Implementation Summary

### Files Created
- `src/lib/auth/city-permission.ts` - 城市權限檢查中間件
- `src/lib/auth/index.ts` - Auth 模組入口
- `src/services/city.service.ts` - 城市服務層
- `src/app/api/admin/cities/route.ts` - 城市 API 端點
- `src/components/features/admin/CitySelector.tsx` - 城市選擇器組件
- `src/components/features/admin/PermissionScopeIndicator.tsx` - 權限範圍指示器

### Files Modified
- `src/services/index.ts` - 新增 city.service 導出
- `src/hooks/use-cities.ts` - 新增 useCitiesGrouped hook
- `src/app/api/admin/users/route.ts` - 加入城市權限過濾
- `src/app/api/admin/users/[id]/route.ts` - 加入城市編輯權限檢查

### Key Features
1. **城市權限中間件**：統一的權限檢查邏輯，支援全域和城市範圍
2. **自動城市過濾**：City Manager 的 API 請求自動過濾為所屬城市
3. **跨城市操作阻擋**：防止 City Manager 存取其他城市的用戶
4. **權限感知 UI**：CitySelector 和 PermissionScopeIndicator 根據權限調整顯示
