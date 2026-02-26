# Story 1.2: 用戶資料庫與角色基礎架構

**Status:** ready-for-dev

---

## Story

**As a** 系統管理員,
**I want** 系統具備用戶和角色的數據結構,
**So that** 可以進行後續的權限管理功能。

---

## Acceptance Criteria

### AC1: 首次登入自動創建用戶

**Given** 用戶通過 Azure AD 首次登入
**When** 系統驗證成功
**Then** 系統自動創建用戶記錄
**And** 用戶被分配預設角色（Data Processor）
**And** 用戶狀態設為「Active」

### AC2: 預定義角色系統

**Given** 系統已有預定義的角色
**When** 查詢角色列表
**Then** 系統返回以下角色：
- System Admin
- Super User
- Data Processor
- City Manager
- Regional Manager
- Auditor

---

## Tasks / Subtasks

- [ ] **Task 1: Role 資料表設計與創建** (AC: #2)
  - [ ] 1.1 更新 Prisma Schema 加入 Role 模型
  - [ ] 1.2 定義 Role 欄位（id, name, description, permissions, isSystem, createdAt）
  - [ ] 1.3 創建 permissions 欄位為 JSON 陣列
  - [ ] 1.4 執行 Prisma 遷移

- [ ] **Task 2: UserRole 關聯表創建** (AC: #1, #2)
  - [ ] 2.1 更新 Prisma Schema 加入 UserRole 模型
  - [ ] 2.2 設定 User 與 Role 的多對多關聯
  - [ ] 2.3 加入 unique constraint（userId + roleId）
  - [ ] 2.4 執行 Prisma 遷移

- [ ] **Task 3: 權限枚舉定義** (AC: #2)
  - [ ] 3.1 創建 `src/types/permissions.ts` 權限常量
  - [ ] 3.2 定義所有系統權限（CRUD 操作 + 特殊權限）
  - [ ] 3.3 創建角色-權限映射配置

- [ ] **Task 4: 種子數據創建** (AC: #2)
  - [ ] 4.1 創建 `prisma/seed.ts` 種子腳本
  - [ ] 4.2 定義 6 個預設角色及其權限
  - [ ] 4.3 配置 package.json prisma seed 命令
  - [ ] 4.4 執行種子數據

- [ ] **Task 5: 首次登入角色分配邏輯** (AC: #1)
  - [ ] 5.1 更新 NextAuth signIn 回調
  - [ ] 5.2 查詢 Data Processor 角色
  - [ ] 5.3 創建 UserRole 關聯記錄
  - [ ] 5.4 處理角色不存在的錯誤情況

- [ ] **Task 6: 角色查詢 API** (AC: #2)
  - [ ] 6.1 創建 `src/app/api/roles/route.ts`
  - [ ] 6.2 實現 GET 端點返回所有角色
  - [ ] 6.3 加入角色權限驗證（僅管理員可查詢）

- [ ] **Task 7: 用戶角色查詢服務** (AC: #1)
  - [ ] 7.1 創建 `src/services/role.service.ts`
  - [ ] 7.2 實現 getUserRoles 函數
  - [ ] 7.3 實現 assignRoleToUser 函數
  - [ ] 7.4 更新 Session 回調加入用戶角色

- [ ] **Task 8: TypeScript 類型定義** (AC: #1, #2)
  - [ ] 8.1 創建 `src/types/role.ts` 角色類型
  - [ ] 8.2 創建 `src/types/user.ts` 更新用戶類型
  - [ ] 8.3 擴展 NextAuth Session 類型加入角色

- [ ] **Task 9: 驗證與測試** (AC: #1, #2)
  - [ ] 9.1 驗證種子數據正確插入
  - [ ] 9.2 測試首次登入角色分配
  - [ ] 9.3 測試角色查詢 API
  - [ ] 9.4 驗證 Session 包含角色資訊

---

## Dev Notes

### 依賴項（Story 1.0, 1.1）

此 Story 依賴：
- **Story 1.0**: Prisma ORM 配置、基礎 User 模型
- **Story 1.1**: NextAuth 配置、登入回調機制

### Project Structure Notes

#### 角色相關文件結構

```
src/
├── app/
│   └── api/
│       └── roles/
│           └── route.ts            # 角色 API 端點
├── services/
│   └── role.service.ts             # 角色服務層
├── types/
│   ├── role.ts                     # 角色類型定義
│   ├── user.ts                     # 用戶類型（更新）
│   └── permissions.ts              # 權限常量定義
prisma/
├── schema.prisma                   # Schema 更新
└── seed.ts                         # 種子數據
```

### Architecture Compliance

#### 角色權限矩陣（來自架構文件）

| 角色 | 處理發票 | 查看報表 | 管理規則 | 系統配置 | 用戶管理 |
|------|:--------:|:--------:|:--------:|:--------:|:--------:|
| Data Processor | ✅ | ❌ | ❌ | ❌ | ❌ |
| City Manager | ✅ | ✅ | ❌ | ❌ | ✅ (本城市) |
| Regional Manager | ✅ | ✅ | ❌ | ❌ | ✅ (管轄城市) |
| Super User | ✅ | ✅ | ✅ | ❌ | ❌ |
| Auditor | ❌ | ✅ | ❌ | ❌ | ❌ |
| System Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

[Source: docs/02-architecture/sections/core-architecture-decisions.md#角色權限矩陣]

#### Prisma Schema 更新

```prisma
// prisma/schema.prisma - 新增/更新內容

model Role {
  id          String     @id @default(uuid())
  name        String     @unique
  description String?
  permissions String[]   // JSON array of permission strings
  isSystem    Boolean    @default(false) @map("is_system")
  createdAt   DateTime   @default(now()) @map("created_at")

  users       UserRole[]

  @@map("roles")
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  roleId    String   @map("role_id")
  cityId    String?  @map("city_id")  // 城市歸屬（City Manager 使用）
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
  @@map("user_roles")
}

// 更新 User 模型，確保關聯正確
model User {
  id            String     @id @default(uuid())
  email         String     @unique
  name          String
  image         String?
  azureAdId     String?    @unique @map("azure_ad_id")
  emailVerified DateTime?  @map("email_verified")
  status        UserStatus @default(ACTIVE)
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  accounts      Account[]
  sessions      Session[]
  roles         UserRole[]

  @@map("users")
}
```

[Source: docs/02-architecture/sections/implementation-patterns-consistency-rules.md]

### Library & Framework Requirements

#### 權限常量定義

```typescript
// src/types/permissions.ts

export const PERMISSIONS = {
  // 發票相關
  INVOICE_VIEW: 'invoice:view',
  INVOICE_CREATE: 'invoice:create',
  INVOICE_REVIEW: 'invoice:review',
  INVOICE_APPROVE: 'invoice:approve',

  // 報表相關
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  // 規則管理
  RULE_VIEW: 'rule:view',
  RULE_MANAGE: 'rule:manage',
  RULE_APPROVE: 'rule:approve',

  // Forwarder 管理
  FORWARDER_VIEW: 'forwarder:view',
  FORWARDER_MANAGE: 'forwarder:manage',

  // 用戶管理
  USER_VIEW: 'user:view',
  USER_MANAGE: 'user:manage',
  USER_MANAGE_CITY: 'user:manage:city',     // 限本城市
  USER_MANAGE_REGION: 'user:manage:region', // 限管轄區域

  // 系統管理
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_MONITOR: 'system:monitor',

  // 審計
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]
```

#### 角色權限映射配置

```typescript
// src/types/role-permissions.ts
import { PERMISSIONS } from './permissions'

export const ROLE_PERMISSIONS = {
  'Data Processor': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
  ],

  'City Manager': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE_CITY,
    PERMISSIONS.FORWARDER_VIEW,
  ],

  'Regional Manager': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE_REGION,
    PERMISSIONS.FORWARDER_VIEW,
  ],

  'Super User': [
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_REVIEW,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.RULE_VIEW,
    PERMISSIONS.RULE_MANAGE,
    PERMISSIONS.RULE_APPROVE,
    PERMISSIONS.FORWARDER_VIEW,
    PERMISSIONS.FORWARDER_MANAGE,
  ],

  'Auditor': [
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
  ],

  'System Admin': Object.values(PERMISSIONS), // 全部權限
} as const

export type RoleName = keyof typeof ROLE_PERMISSIONS
```

### File Structure Requirements

#### 種子數據腳本

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import { ROLE_PERMISSIONS } from '../src/types/role-permissions'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 創建系統預設角色
  const roles = [
    {
      name: 'System Admin',
      description: '系統管理員 - 擁有所有權限',
      isSystem: true,
    },
    {
      name: 'Super User',
      description: '超級用戶 - 可管理規則和 Forwarder',
      isSystem: true,
    },
    {
      name: 'Data Processor',
      description: '數據處理員 - 基礎發票處理權限',
      isSystem: true,
    },
    {
      name: 'City Manager',
      description: '城市經理 - 管理本城市用戶和數據',
      isSystem: true,
    },
    {
      name: 'Regional Manager',
      description: '區域經理 - 管理多城市用戶和數據',
      isSystem: true,
    },
    {
      name: 'Auditor',
      description: '審計員 - 只讀報表和審計日誌',
      isSystem: true,
    },
  ]

  for (const role of roles) {
    const permissions = ROLE_PERMISSIONS[role.name as keyof typeof ROLE_PERMISSIONS] || []

    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        permissions: permissions,
      },
      create: {
        name: role.name,
        description: role.description,
        permissions: permissions,
        isSystem: role.isSystem,
      },
    })

    console.log(`✓ Role created/updated: ${role.name}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

#### package.json 更新

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

#### 角色服務層

```typescript
// src/services/role.service.ts
import { prisma } from '@/lib/prisma'

export async function getAllRoles() {
  return prisma.role.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getRoleByName(name: string) {
  return prisma.role.findUnique({
    where: { name },
  })
}

export async function getUserRoles(userId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  })
  return userRoles.map(ur => ur.role)
}

export async function assignRoleToUser(userId: string, roleName: string, cityId?: string) {
  const role = await getRoleByName(roleName)
  if (!role) {
    throw new Error(`Role not found: ${roleName}`)
  }

  return prisma.userRole.create({
    data: {
      userId,
      roleId: role.id,
      cityId,
    },
  })
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  return prisma.userRole.delete({
    where: {
      userId_roleId: { userId, roleId },
    },
  })
}
```

#### NextAuth 回調更新

```typescript
// src/lib/auth.ts - 更新 signIn 回調
callbacks: {
  async signIn({ user, account, profile }) {
    if (account?.provider === "azure-ad") {
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! },
        include: { roles: true },
      })

      if (!existingUser) {
        // 創建新用戶
        const newUser = await prisma.user.create({
          data: {
            email: user.email!,
            name: user.name!,
            azureAdId: profile?.sub,
            status: "ACTIVE",
          },
        })

        // 分配預設角色 (Data Processor)
        const defaultRole = await prisma.role.findUnique({
          where: { name: "Data Processor" },
        })

        if (defaultRole) {
          await prisma.userRole.create({
            data: {
              userId: newUser.id,
              roleId: defaultRole.id,
            },
          })
        }
      }
    }
    return true
  },

  async session({ session, token }) {
    if (token.sub && session.user) {
      session.user.id = token.sub

      // 加入用戶角色
      const userRoles = await prisma.userRole.findMany({
        where: { userId: token.sub },
        include: { role: true },
      })
      session.user.roles = userRoles.map(ur => ({
        name: ur.role.name,
        permissions: ur.role.permissions,
      }))
    }
    return session
  },
}
```

#### Session 類型擴展

```typescript
// src/types/next-auth.d.ts
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      roles: {
        name: string
        permissions: string[]
      }[]
    } & DefaultSession["user"]
  }
}
```

### Testing Requirements

#### 本次 Story 驗證標準

| 驗證項目 | 測試方法 | 預期結果 |
|---------|---------|---------|
| 種子數據 | `npx prisma db seed` | 成功創建 6 個預設角色 |
| 角色查詢 | GET `/api/roles` | 返回所有角色列表 |
| 首次登入 | 新用戶 Azure AD 登入 | 自動分配 Data Processor 角色 |
| Session 角色 | 檢查登入後 Session | 包含用戶角色和權限 |
| 角色關聯 | 資料庫查詢 UserRole | 正確建立 User-Role 關聯 |

#### 驗證命令

```bash
# 執行種子數據
npx prisma db seed

# 查詢角色是否創建
npx prisma studio  # 開啟 Prisma Studio 檢視數據

# 驗證遷移
npx prisma migrate status
```

### References

- [Source: docs/02-architecture/sections/core-architecture-decisions.md#角色權限矩陣] - 角色權限定義
- [Source: docs/02-architecture/sections/implementation-patterns-consistency-rules.md] - Prisma 命名規範
- [Source: docs/03-epics/sections/epic-1-user-auth-access-control.md#story-12] - Story 需求定義
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR36] - 功能需求 FR36

---

## Dev Agent Record

### Context Reference

- Architecture: `docs/02-architecture/sections/`
- Epic: `docs/03-epics/sections/epic-1-user-auth-access-control.md`
- PRD: `docs/01-planning/prd/sections/`
- Previous Stories:
  - `docs/04-implementation/stories/1-0-project-init-foundation.md`
  - `docs/04-implementation/stories/1-1-azure-ad-sso-login.md`

### Agent Model Used

<!-- Will be filled by Dev Agent -->

### Debug Log References

<!-- Will be filled during implementation -->

### Completion Notes List

<!-- Will be filled after implementation -->

### File List

**Expected Files to Create/Modify:**
- `prisma/schema.prisma` - 新增 Role, UserRole 模型
- `prisma/seed.ts` - 種子數據腳本
- `src/types/permissions.ts` - 權限常量
- `src/types/role-permissions.ts` - 角色權限映射
- `src/types/role.ts` - 角色類型定義
- `src/types/next-auth.d.ts` - NextAuth 類型擴展
- `src/services/role.service.ts` - 角色服務層
- `src/app/api/roles/route.ts` - 角色 API 端點
- `src/lib/auth.ts` - 更新 NextAuth 回調
- `package.json` - 新增 prisma seed 配置

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 1.2 |
| Story Key | 1-2-user-database-role-foundation |
| Epic | Epic 1: 用戶認證與存取控制 |
| FR Coverage | FR36 (部分) |
| Estimated Effort | 中 |
| Dependencies | Story 1.0, Story 1.1 |
| Blocking | Story 1.3 ~ 1.8 |

---

*Story created: 2025-12-15*
*Status: ready-for-dev*
*Generated by: BMAD Method - Create Story Workflow*
