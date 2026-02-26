# CHANGE-052: GLOBAL_ADMIN 角色名稱統一修正

> **日期**: 2026-02-26
> **狀態**: 📋 規劃中
> **優先級**: High（影響全系統權限檢查）
> **類型**: Refactor / Bug Fix
> **影響範圍**: 61 個文件的權限檢查邏輯，涵蓋所有 admin API 路由、audit 路由、document 路由及頁面組件
> **前置條件**: 無
> **觸發事件**: 發現系統中 61 個文件使用硬編碼 `'GLOBAL_ADMIN'` 字串進行權限檢查，但資料庫中實際角色名稱為 `'System Admin'`，導致權限檢查可能全面失效

---

## 變更背景

### 問題描述

系統存在**角色名稱不匹配**的嚴重問題：

| 項目 | 值 | 位置 |
|------|-----|------|
| **資料庫定義的角色名稱** | `'System Admin'` | `src/types/role-permissions.ts` → `ROLE_NAMES.SYSTEM_ADMIN` |
| **API 路由中硬編碼的名稱** | `'GLOBAL_ADMIN'` | 61 個文件中的權限檢查代碼 |

這意味著在正式環境中（使用真實資料庫角色），所有使用 `r.name === 'GLOBAL_ADMIN'` 的權限檢查**永遠返回 false**，因為資料庫中根本不存在名為 `'GLOBAL_ADMIN'` 的角色。

### 額外發現的問題

除了 `'GLOBAL_ADMIN'` 之外，還有以下不存在的角色名稱被使用：

| 硬編碼名稱 | 正確名稱 | 出現位置 |
|-----------|---------|---------|
| `'GLOBAL_ADMIN'` | `'System Admin'`（`ROLE_NAMES.SYSTEM_ADMIN`） | 61 個文件 |
| `'ADMIN'` | 不存在此角色（應為 `'System Admin'`） | 4 個文件（api-keys 相關） |
| `'AUDITOR'` | `'Auditor'`（`ROLE_NAMES.AUDITOR`） | 7 個文件（audit 相關） |
| `'SUPER_USER'` | `'Super User'`（`ROLE_NAMES.SUPER_USER`） | 8 個文件 |

**注意**: `'AUDITOR'` 和 `'SUPER_USER'` 雖然拼寫風格不同，但也與資料庫中的 `'Auditor'` 和 `'Super User'` 不匹配。

### 現有的 `isGlobalAdmin` 機制

系統已有完善的 `isGlobalAdmin` 布爾值機制：

1. **資料庫層**: `User` model 有 `isGlobalAdmin: Boolean` 欄位
2. **認證層**: `src/lib/auth.ts` 在 JWT callback 中從資料庫讀取 `dbUser.isGlobalAdmin` 並寫入 token
3. **Session 層**: `src/types/next-auth.d.ts` 定義了 `session.user.isGlobalAdmin: boolean`
4. **部分路由已正確使用**: 如 `src/app/api/admin/retention/` 系列路由使用 `session.user.isGlobalAdmin`

然而，大量路由仍然使用 `session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN')` 這種字串比對方式。

### 影響範圍

| 分類 | 受影響文件數 | 說明 |
|------|------------|------|
| Admin API 路由 | 41 | `/api/admin/` 下的所有子路由 |
| Audit API 路由 | 7 | `/api/audit/` 下的路由 |
| Document API 路由 | 5 | `/api/documents/` 下的路由 |
| Workflow API 路由 | 2 | `/api/workflows/` 和 `/api/workflow-errors/` |
| Service 文件 | 1 | `audit-query.service.ts`（僅註釋） |
| 頁面組件 | 1 | `admin/monitoring/health/page.tsx` |
| 文檔文件 | 1 | `src/app/api/CLAUDE.md`（僅文檔） |
| **合計** | **58 個代碼文件 + 3 個文檔/註釋** | |

---

## 使用模式分析

### 模式 1: 純 `isGlobalAdmin` 布爾值（已正確）

**已正確使用此模式的文件**（不需修改）：
```typescript
// ✅ 正確 — 直接使用 session 布爾值
if (!session.user.isGlobalAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

已使用此模式的路由（約 15+ 個）：`admin/retention/*`、`analytics/*` 等。

### 模式 2: `isGlobalAdmin || roles.some(GLOBAL_ADMIN)` 冗餘檢查（28 個文件）

```typescript
// ⚠️ 冗餘但部分正確 — isGlobalAdmin 部分有效，roles 字串比對無效
const isAdmin =
  session.user.isGlobalAdmin || session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
```

出現在：`admin/logs/*`、`admin/alerts/*`、`admin/n8n-health/*` 等。

### 模式 3: 純 `roles.some(GLOBAL_ADMIN)` 字串比對（約 20 個文件）

```typescript
// ❌ 完全失效 — 資料庫中無 'GLOBAL_ADMIN' 角色
const isAdmin =
  session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');
```

出現在：`admin/integrations/sharepoint/*`、`admin/integrations/outlook/*`、`admin/integrations/n8n/*` 等。

### 模式 4: `roles.includes` 陣列檢查（8 個文件）

```typescript
// ❌ 完全失效 — 多個角色名稱都不匹配
session.user.roles?.some((r) => ['GLOBAL_ADMIN', 'ADMIN', 'SUPER_USER'].includes(r.name));
```

出現在：`admin/performance/*`、`admin/health/*`、`monitoring/health/page.tsx`。

### 模式 5: `['AUDITOR', 'GLOBAL_ADMIN'].includes` 審計路由（6 個文件）

```typescript
// ❌ 完全失效 — 'AUDITOR' 和 'GLOBAL_ADMIN' 都不匹配
session.user.roles?.some(r =>
  ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)
);
```

出現在：`audit/reports/*`、`audit/query/*`。

### 模式 6: `user.role === 'GLOBAL_ADMIN'` 單值檢查（3 個文件）

```typescript
// ❌ 完全失效且結構錯誤 — session.user 沒有 .role 屬性（應為 .roles 陣列）
const user = session.user as { cityAccess?: string[]; role?: string }
const isGlobalAdmin = user.role === 'GLOBAL_ADMIN'
```

出現在：`documents/[id]/progress/route.ts`、`documents/processing/stats/route.ts`、`documents/processing/route.ts`。

### 模式 7: `['SUPER_USER', 'GLOBAL_ADMIN'].includes` 工作流路由（2 個文件）

```typescript
// ❌ 完全失效 — 兩個角色名稱都不匹配
['SUPER_USER', 'GLOBAL_ADMIN'].includes(role.name)
```

出現在：`workflows/executions/[id]/error/route.ts`、`workflow-errors/statistics/route.ts`。

---

## 修正策略評估

### 方案 A: 將所有硬編碼字串替換為正確的角色名稱

**做法**: `'GLOBAL_ADMIN'` → `ROLE_NAMES.SYSTEM_ADMIN`（即 `'System Admin'`）

| 優點 | 缺點 |
|------|------|
| 改動概念簡單 | 每個文件仍需 import `ROLE_NAMES` |
| 直接修復名稱不匹配 | 仍使用字串比對 roles 陣列，效能不佳 |
| | 未來角色名稱變更時仍需大量修改 |
| | 不統一 — `isGlobalAdmin` 和 `roles.some()` 兩種模式並存 |

**評估**: 不推薦。只是換了字串值，根本問題（散落的角色檢查邏輯）未解決。

### 方案 B: 統一改用 `session.user.isGlobalAdmin` 布爾值

**做法**: 將所有 `roles.some(r => r.name === 'GLOBAL_ADMIN')` 替換為 `session.user.isGlobalAdmin`

| 優點 | 缺點 |
|------|------|
| 消除字串比對，使用已驗證的布爾值 | 只解決 `GLOBAL_ADMIN` 問題 |
| 效能更好（布爾值 vs 陣列遍歷） | `'AUDITOR'`、`'SUPER_USER'` 等問題未解決 |
| 系統已有此機制，無需新增基礎設施 | 沒有統一的權限檢查入口 |
| 改動量中等 | 不同角色仍有不同的檢查方式 |

**評估**: 可接受但不完美。可作為**快速修復第一步**。

### 方案 C: 建立統一的權限檢查 utility 函數（推薦）

**做法**: 建立 `src/lib/auth/role-check.ts`，提供統一的角色與權限檢查函數。

| 優點 | 缺點 |
|------|------|
| 從根本上解決所有角色名稱不匹配問題 | 改動量最大（61 個文件） |
| 統一權限檢查入口，便於維護 | 需要設計新的 utility API |
| 未來角色變更只需修改一處 | 需要更多測試 |
| 消除所有硬編碼角色名稱 | |
| 可支援複合權限檢查（如 admin OR auditor） | |

**Utility 函數介面設計**：

```typescript
// src/lib/auth/role-check.ts

import type { Session } from 'next-auth'
import { ROLE_NAMES, type RoleName } from '@/types/role-permissions'

/**
 * 檢查用戶是否為系統管理員
 * 優先使用 session.user.isGlobalAdmin 布爾值
 */
export function isSystemAdmin(session: Session): boolean {
  return (
    session.user.isGlobalAdmin === true ||
    session.user.roles?.some((r) => r.name === ROLE_NAMES.SYSTEM_ADMIN) === true
  )
}

/**
 * 檢查用戶是否擁有指定角色之一
 * 自動處理 isGlobalAdmin（System Admin 擁有所有權限）
 */
export function hasAnyRole(session: Session, roleNames: RoleName[]): boolean {
  // System Admin 擁有所有權限
  if (session.user.isGlobalAdmin === true) return true
  return session.user.roles?.some((r) =>
    roleNames.includes(r.name as RoleName)
  ) === true
}

/**
 * 檢查用戶是否擁有指定權限
 * System Admin 自動擁有所有權限
 */
export function hasPermission(session: Session, permission: string): boolean {
  if (session.user.isGlobalAdmin === true) return true
  return session.user.roles?.some((r) =>
    r.permissions?.includes(permission) || r.permissions?.includes('*')
  ) === true
}

/**
 * 常用角色組合 — 預定義的權限檢查組合
 */
export const ADMIN_ROLES: RoleName[] = [
  ROLE_NAMES.SYSTEM_ADMIN,
  ROLE_NAMES.SUPER_USER,
]

export const AUDIT_ROLES: RoleName[] = [
  ROLE_NAMES.SYSTEM_ADMIN,
  ROLE_NAMES.AUDITOR,
]

export const INTEGRATION_ADMIN_ROLES: RoleName[] = [
  ROLE_NAMES.SYSTEM_ADMIN,
]
```

**使用方式（修改後的路由代碼）**：

```typescript
// Before（模式 2/3）:
const isAdmin =
  session.user.isGlobalAdmin || session.user.roles?.some((r) => r.name === 'GLOBAL_ADMIN');

// After:
import { isSystemAdmin } from '@/lib/auth/role-check'
const isAdmin = isSystemAdmin(session)

// Before（模式 4）:
session.user.roles?.some((r) => ['GLOBAL_ADMIN', 'ADMIN', 'SUPER_USER'].includes(r.name));

// After:
import { hasAnyRole, ADMIN_ROLES } from '@/lib/auth/role-check'
hasAnyRole(session, ADMIN_ROLES)

// Before（模式 5）:
session.user.roles?.some(r => ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name));

// After:
import { hasAnyRole, AUDIT_ROLES } from '@/lib/auth/role-check'
hasAnyRole(session, AUDIT_ROLES)
```

### 推薦方案

**推薦方案 C**（統一權限檢查 utility），理由：

1. **根本性修復**: 不僅修復 `GLOBAL_ADMIN`，同時修復 `ADMIN`、`AUDITOR`、`SUPER_USER` 等所有硬編碼角色名稱
2. **防止回歸**: 未來開發者只需使用 utility 函數，無需知道底層角色名稱
3. **單一修改點**: 如果角色名稱未來需要變更，只需修改 `role-check.ts`
4. **已有基礎**: `isGlobalAdmin` 布爾值機制已經可用，utility 函數是其自然延伸

---

## 變更內容

### Step 1: 建立權限檢查 Utility

**新增** `src/lib/auth/role-check.ts`

包含以下函數和常量：

| 導出 | 類型 | 說明 |
|------|------|------|
| `isSystemAdmin(session)` | 函數 | 檢查是否為系統管理員 |
| `hasAnyRole(session, roleNames)` | 函數 | 檢查是否擁有指定角色之一 |
| `hasPermission(session, permission)` | 函數 | 檢查是否擁有指定權限 |
| `ADMIN_ROLES` | 常量 | `[SYSTEM_ADMIN, SUPER_USER]` |
| `AUDIT_ROLES` | 常量 | `[SYSTEM_ADMIN, AUDITOR]` |
| `INTEGRATION_ADMIN_ROLES` | 常量 | `[SYSTEM_ADMIN]` |

**更新** `src/lib/auth/index.ts` — 新增 `role-check.ts` 的導出。

### Step 2: 修正所有 admin API 路由（41 個文件）

按模式分批替換：

#### 2a: 模式 2 — `isGlobalAdmin || roles.some(GLOBAL_ADMIN)`（28 個文件）

替換為 `isSystemAdmin(session)`。

#### 2b: 模式 3 — 純 `roles.some(GLOBAL_ADMIN)`（20 個文件）

替換為 `isSystemAdmin(session)` 或 `hasAnyRole(session, INTEGRATION_ADMIN_ROLES)`。

#### 2c: 模式 4 — `['GLOBAL_ADMIN', 'ADMIN', 'SUPER_USER'].includes`（8 個文件）

替換為 `hasAnyRole(session, ADMIN_ROLES)`。

### Step 3: 修正 audit API 路由（7 個文件）

將 `['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)` 替換為 `hasAnyRole(session, AUDIT_ROLES)`。

同時修正錯誤訊息中的角色名稱引用。

### Step 4: 修正 document API 路由（5 個文件）

#### 4a: 修正模式 6（3 個文件）

`documents/[id]/progress/route.ts`、`documents/processing/stats/route.ts`、`documents/processing/route.ts` 中的 `user.role === 'GLOBAL_ADMIN'` 替換為 `isSystemAdmin(session)`。這些文件還存在錯誤的類型斷言 `session.user as { role?: string }`，需要一併修正。

#### 4b: 修正 trace 路由（2 個文件）

`documents/[id]/trace/route.ts` 和 `documents/[id]/trace/report/route.ts`。

### Step 5: 修正 workflow 路由（2 個文件）

將 `['SUPER_USER', 'GLOBAL_ADMIN'].includes(role.name)` 替換為 `hasAnyRole(session, ADMIN_ROLES)`。

### Step 6: 修正頁面組件（1 個文件）

`admin/monitoring/health/page.tsx` 中的 `['GLOBAL_ADMIN', 'ADMIN', 'SUPER_USER'].includes(role.name)` 替換為 `hasAnyRole(session, ADMIN_ROLES)`。

### Step 7: 修正 retention policies Zod schema（1 個文件）

`admin/retention/policies/route.ts` 中的 `z.string().default('GLOBAL_ADMIN')` — 需確認此值的用途，如果是寫入資料庫的值則需修正為 `'System Admin'`。

### Step 8: 更新文檔（2 個文件）

- `src/app/api/CLAUDE.md` — 更新權限層級表格中的角色名稱
- `src/services/audit-query.service.ts` — 更新註釋中的角色名稱

---

## 修改檔案清單

### 新增文件（1 個）

| # | 動作 | 檔案 | 說明 |
|---|------|------|------|
| 1 | 新增 | `src/lib/auth/role-check.ts` | 統一權限檢查 utility 函數 |

### 修改文件 — Admin Integrations（20 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 2 | 修改 | `src/app/api/admin/integrations/sharepoint/route.ts` | 模式 3 |
| 3 | 修改 | `src/app/api/admin/integrations/sharepoint/test/route.ts` | 模式 3 |
| 4 | 修改 | `src/app/api/admin/integrations/sharepoint/[configId]/route.ts` | 模式 3 |
| 5 | 修改 | `src/app/api/admin/integrations/sharepoint/[configId]/test/route.ts` | 模式 3 |
| 6 | 修改 | `src/app/api/admin/integrations/outlook/route.ts` | 模式 3 |
| 7 | 修改 | `src/app/api/admin/integrations/outlook/test/route.ts` | 模式 3 |
| 8 | 修改 | `src/app/api/admin/integrations/outlook/[configId]/route.ts` | 模式 3 |
| 9 | 修改 | `src/app/api/admin/integrations/outlook/[configId]/test/route.ts` | 模式 3 |
| 10 | 修改 | `src/app/api/admin/integrations/outlook/[configId]/rules/route.ts` | 模式 3 |
| 11 | 修改 | `src/app/api/admin/integrations/outlook/[configId]/rules/[ruleId]/route.ts` | 模式 3 |
| 12 | 修改 | `src/app/api/admin/integrations/outlook/[configId]/rules/reorder/route.ts` | 模式 3 |
| 13 | 修改 | `src/app/api/admin/integrations/n8n/webhook-configs/route.ts` | 模式 3 |
| 14 | 修改 | `src/app/api/admin/integrations/n8n/webhook-configs/[id]/route.ts` | 模式 3 |
| 15 | 修改 | `src/app/api/admin/integrations/n8n/webhook-configs/[id]/test/route.ts` | 模式 3 |
| 16 | 修改 | `src/app/api/admin/integrations/n8n/webhook-configs/[id]/history/route.ts` | 模式 3 |

### 修改文件 — Admin Alerts（8 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 17 | 修改 | `src/app/api/admin/alerts/route.ts` | 模式 2 |
| 18 | 修改 | `src/app/api/admin/alerts/summary/route.ts` | 模式 2 |
| 19 | 修改 | `src/app/api/admin/alerts/statistics/route.ts` | 模式 2 |
| 20 | 修改 | `src/app/api/admin/alerts/[id]/route.ts` | 模式 2 |
| 21 | 修改 | `src/app/api/admin/alerts/[id]/resolve/route.ts` | 模式 2 |
| 22 | 修改 | `src/app/api/admin/alerts/[id]/acknowledge/route.ts` | 模式 2 |
| 23 | 修改 | `src/app/api/admin/alerts/rules/route.ts` | 模式 2 |
| 24 | 修改 | `src/app/api/admin/alerts/rules/[id]/route.ts` | 模式 2 |
| 25 | 修改 | `src/app/api/admin/alerts/rules/[id]/toggle/route.ts` | 模式 2 |

### 修改文件 — Admin Logs（6 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 26 | 修改 | `src/app/api/admin/logs/route.ts` | 模式 2 |
| 27 | 修改 | `src/app/api/admin/logs/stats/route.ts` | 模式 2 |
| 28 | 修改 | `src/app/api/admin/logs/stream/route.ts` | 模式 2 |
| 29 | 修改 | `src/app/api/admin/logs/[id]/route.ts` | 模式 2 |
| 30 | 修改 | `src/app/api/admin/logs/[id]/related/route.ts` | 模式 2 |
| 31 | 修改 | `src/app/api/admin/logs/export/route.ts` | 模式 2 |
| 32 | 修改 | `src/app/api/admin/logs/export/[id]/route.ts` | 模式 2 |

### 修改文件 — Admin N8n Health（3 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 33 | 修改 | `src/app/api/admin/n8n-health/route.ts` | 模式 2 |
| 34 | 修改 | `src/app/api/admin/n8n-health/history/route.ts` | 模式 2 |
| 35 | 修改 | `src/app/api/admin/n8n-health/changes/route.ts` | 模式 2 |

### 修改文件 — Admin API Keys（4 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 36 | 修改 | `src/app/api/admin/api-keys/route.ts` | 模式 3（含 `'ADMIN'`） |
| 37 | 修改 | `src/app/api/admin/api-keys/[keyId]/route.ts` | 模式 3（含 `'ADMIN'`） |
| 38 | 修改 | `src/app/api/admin/api-keys/[keyId]/rotate/route.ts` | 模式 3（含 `'ADMIN'`） |
| 39 | 修改 | `src/app/api/admin/api-keys/[keyId]/stats/route.ts` | 模式 3（含 `'ADMIN'`） |

### 修改文件 — Admin Performance（4 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 40 | 修改 | `src/app/api/admin/performance/route.ts` | 模式 4 |
| 41 | 修改 | `src/app/api/admin/performance/export/route.ts` | 模式 4 |
| 42 | 修改 | `src/app/api/admin/performance/slowest/route.ts` | 模式 4 |
| 43 | 修改 | `src/app/api/admin/performance/timeseries/route.ts` | 模式 4 |

### 修改文件 — Admin Health（2 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 44 | 修改 | `src/app/api/admin/health/route.ts` | 模式 4 |
| 45 | 修改 | `src/app/api/admin/health/[serviceName]/route.ts` | 模式 4 |

### 修改文件 — Admin Retention（1 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 46 | 修改 | `src/app/api/admin/retention/policies/route.ts` | Zod schema `default('GLOBAL_ADMIN')` |

### 修改文件 — Audit API（7 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 47 | 修改 | `src/app/api/audit/query/route.ts` | 模式 5 |
| 48 | 修改 | `src/app/api/audit/query/count/route.ts` | 模式 5 |
| 49 | 修改 | `src/app/api/audit/reports/route.ts` | 模式 5 |
| 50 | 修改 | `src/app/api/audit/reports/[jobId]/route.ts` | 模式 5 |
| 51 | 修改 | `src/app/api/audit/reports/[jobId]/download/route.ts` | 模式 5 |
| 52 | 修改 | `src/app/api/audit/reports/[jobId]/verify/route.ts` | 模式 5 |

### 修改文件 — Document API（5 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 53 | 修改 | `src/app/api/documents/[id]/progress/route.ts` | 模式 6 |
| 54 | 修改 | `src/app/api/documents/processing/route.ts` | 模式 6 |
| 55 | 修改 | `src/app/api/documents/processing/stats/route.ts` | 模式 6 |
| 56 | 修改 | `src/app/api/documents/[id]/trace/route.ts` | 註釋修正 |
| 57 | 修改 | `src/app/api/documents/[id]/trace/report/route.ts` | 模式 5 |

### 修改文件 — Workflow API（2 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 58 | 修改 | `src/app/api/workflows/executions/[id]/error/route.ts` | 模式 7 |
| 59 | 修改 | `src/app/api/workflow-errors/statistics/route.ts` | 模式 7 |

### 修改文件 — 頁面組件（1 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 60 | 修改 | `src/app/[locale]/(dashboard)/admin/monitoring/health/page.tsx` | 模式 4 |

### 修改文件 — Service（1 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 61 | 修改 | `src/services/audit-query.service.ts` | 僅修正註釋中的角色名稱 |

### 修改文件 — 導出與文檔（2 個）

| # | 動作 | 檔案 | 修正模式 |
|---|------|------|----------|
| 62 | 修改 | `src/lib/auth/index.ts` | 新增 role-check 導出 |
| 63 | 修改 | `src/app/api/CLAUDE.md` | 更新文檔中的角色名稱 |

**合計**: 1 個新增 + 62 個修改 = **63 個文件**

---

## 影響評估

### API 影響

- **新增端點**: 0
- **修改端點**: 約 100+ 個 API handler（分布在 58 個 route 文件中）
- **行為變更**: 修正後權限檢查將**正確比對資料庫角色名稱**，可能導致：
  - 原本意外放行的請求被正確攔截（如果開發環境 mock 角色名稱不一致）
  - 原本被攔截的合法請求被正確放行

### 組件影響

- **修改組件**: 1 個（`monitoring/health/page.tsx`）
- **無新增組件**

### 認證影響

- **核心認證邏輯不變**: `auth.ts` 中的 `isGlobalAdmin` 設定邏輯不受影響
- **Session 類型不變**: `next-auth.d.ts` 無需修改
- **新增 utility 層**: 在 session 和 route handler 之間增加了一層抽象

### 資料庫影響

- **無需 Migration**: 不修改 Schema 或資料
- **角色種子資料不變**: `role-permissions.ts` 中的 `ROLE_NAMES` 不受影響

---

## 風險評估

| 風險 | 嚴重度 | 可能性 | 緩解措施 |
|------|--------|--------|----------|
| 大量文件同時修改導致引入新 bug | 高 | 中 | 分批修改 + 每批進行 type-check；使用統一的 utility 函數減少手動錯誤 |
| 修正後權限變嚴格導致合法用戶被拒 | 中 | 中 | 在開發環境下測試所有角色的 API 存取；`isSystemAdmin` 保留 `isGlobalAdmin` fallback |
| 開發環境 mock session 與正式環境不一致 | 中 | 低 | 在 `auth.ts` 的 DEV_MOCK_SESSION 中確認角色名稱正確 |
| 修改 62 個文件時遺漏部分檔案 | 低 | 低 | 修改完成後重新 grep `GLOBAL_ADMIN` 確認零殘留 |
| Merge conflict（當前分支有大量未合併變更） | 中 | 中 | 建議在獨立分支 `fix/change-052-role-name-unification` 上進行 |

---

## 實施順序建議

### Phase 1: 基礎設施（1 個文件）

```
1. 新增 src/lib/auth/role-check.ts — utility 函數
2. 更新 src/lib/auth/index.ts — 新增導出
3. npm run type-check — 確認新文件無類型錯誤
```

### Phase 2: Admin Integrations 路由（16 個文件）

```
4-19. 修正 admin/integrations/sharepoint/* (4 個文件)
      修正 admin/integrations/outlook/* (7 個文件)
      修正 admin/integrations/n8n/* (5 個文件)
20. npm run type-check
```

### Phase 3: Admin Alerts + Logs 路由（15 個文件）

```
21-29. 修正 admin/alerts/* (9 個文件)
30-36. 修正 admin/logs/* (7 個文件)
37. npm run type-check
```

### Phase 4: Admin N8n Health + API Keys + Performance + Health（13 個文件）

```
38-40. 修正 admin/n8n-health/* (3 個文件)
41-44. 修正 admin/api-keys/* (4 個文件)
45-48. 修正 admin/performance/* (4 個文件)
49-50. 修正 admin/health/* (2 個文件)
51. npm run type-check
```

### Phase 5: Audit + Document + Workflow 路由（14 個文件）

```
52-57. 修正 audit/* (6 個文件)
58-62. 修正 documents/* (5 個文件)
63-64. 修正 workflows/* (2 個文件)
65-66. 修正 admin/retention/policies (1 個文件)
67. npm run type-check
```

### Phase 6: 頁面組件 + 文檔（3 個文件）

```
68. 修正 admin/monitoring/health/page.tsx
69. 修正 audit-query.service.ts 註釋
70. 更新 src/app/api/CLAUDE.md
```

### Phase 7: 全面驗證

```
71. npm run type-check — 全量類型檢查
72. npm run lint — ESLint 檢查
73. grep -r "GLOBAL_ADMIN" src/ — 確認零殘留（排除 role-check.ts 中可能的向後相容處理）
74. grep -r "'ADMIN'" src/app/api/ — 確認 'ADMIN' 字串已清除
75. grep -r "'AUDITOR'" src/app/api/ — 確認 'AUDITOR' 已替換為常量
76. grep -r "'SUPER_USER'" src/app/api/ — 確認 'SUPER_USER' 已替換為常量
```

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | System Admin 存取 admin 路由 | 以 System Admin 角色登入 -> 訪問 `/api/admin/logs` | 正常返回 200 |
| 2 | System Admin 存取 audit 路由 | 以 System Admin 角色登入 -> 訪問 `/api/audit/query` | 正常返回 200 |
| 3 | System Admin 存取 integration 路由 | 以 System Admin 角色登入 -> 訪問 `/api/admin/integrations/sharepoint` | 正常返回 200 |
| 4 | Auditor 存取 audit 路由 | 以 Auditor 角色登入 -> 訪問 `/api/audit/query` | 正常返回 200 |
| 5 | Auditor 存取 admin 路由 | 以 Auditor 角色登入 -> 訪問 `/api/admin/logs` | 返回 403 Forbidden |
| 6 | Super User 存取 performance 路由 | 以 Super User 角色登入 -> 訪問 `/api/admin/performance` | 正常返回 200 |
| 7 | Data Processor 存取 admin 路由 | 以 Data Processor 角色登入 -> 訪問 `/api/admin/alerts` | 返回 403 Forbidden |
| 8 | isGlobalAdmin=true 的用戶 | 資料庫 isGlobalAdmin=true -> 訪問任意 admin 路由 | 正常返回 200 |
| 9 | 開發模式 mock session | 使用 dev-user-1 登入 -> 訪問 admin 路由 | 正常返回 200（isGlobalAdmin=true） |
| 10 | Health 監控頁面 | System Admin 登入 -> 訪問 `/admin/monitoring/health` | 頁面正常載入，無權限錯誤 |
| 11 | Document progress 權限 | 一般用戶訪問自己城市的文件進度 | 正常返回 200 |
| 12 | Document progress 跨城市 | 一般用戶訪問其他城市的文件進度 | 返回 403（除非 isGlobalAdmin） |
| 13 | Workflow error 查看 | Super User 查看工作流錯誤 | 正常返回 200 |
| 14 | API Keys 管理 | System Admin 管理 API Keys | 正常返回 200 |
| 15 | 全量 grep 驗證 | `grep -r "GLOBAL_ADMIN" src/` | 僅在 role-check.ts 的註釋或 CLAUDE.md 文檔中出現 |

---

## 附錄: 正確的角色名稱對照表

| `ROLE_NAMES` 常量 | 資料庫值 | 舊硬編碼值（需修正） |
|-------------------|---------|---------------------|
| `ROLE_NAMES.SYSTEM_ADMIN` | `'System Admin'` | `'GLOBAL_ADMIN'`, `'ADMIN'` |
| `ROLE_NAMES.SUPER_USER` | `'Super User'` | `'SUPER_USER'` |
| `ROLE_NAMES.DATA_PROCESSOR` | `'Data Processor'` | （未發現硬編碼問題） |
| `ROLE_NAMES.CITY_MANAGER` | `'City Manager'` | （未發現硬編碼問題） |
| `ROLE_NAMES.REGIONAL_MANAGER` | `'Regional Manager'` | （未發現硬編碼問題） |
| `ROLE_NAMES.AUDITOR` | `'Auditor'` | `'AUDITOR'` |
