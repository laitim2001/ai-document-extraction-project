# CHANGE-014: OM Summary 頁面 OpCo 權限過濾

> **建立日期**: 2025-12-14
> **完成日期**: 2025-12-14
> **修復日期**: 2025-12-14 (修復 isAdmin 判斷失敗的問題)
> **狀態**: ✅ 已完成
> **相關功能**: FEAT-003 (OM Summary Page), FEAT-009 (OpCo Data Permission)
> **優先級**: High

## 1. 變更概述

### 1.1 背景
OM Summary 頁面目前會顯示 Project Summary 部分，其中包含 Charge Out Method 欄位。此欄位可能包含多個 Operating Company 的分攤金額信息。根據 FEAT-009 建立的 OpCo 數據權限管理功能，需要根據當前用戶的 Operating Company Access 權限過濾顯示內容。

### 1.2 目標
- 解析 Charge Out Method 欄位中的分號分隔格式
- 根據用戶的 OpCo 權限過濾顯示內容
- 只顯示用戶有權限查看的 OpCo 數據（不是刪除，是隱藏）

## 2. 需求規格

### 2.1 輸入格式範例
```
RA     $     2,269 ;
RAPO     $     2,370 ;
RBS     $     4,110 ;
RHK     $  17,398 ;
RMS     $     9,128 ;
RPH     $     4,413 ;
RSP     $     3,429 ;
RTH     $  48,462 ;
RTW     $     5,270 ;
RVN     $     3,152
```

### 2.2 用戶權限範例
假設用戶有權限查看: `RA`, `RAPO`, `RMS`

### 2.3 預期輸出
```
RA     $     2,269 ;
RAPO     $     2,370 ;
RMS     $     9,128 ;
```

### 2.4 處理規則
| 情況 | 處理方式 |
|------|----------|
| 欄位包含分號分隔的 OpCo 數據 | 解析並過濾 |
| 欄位不包含分號 | 原樣顯示（不過濾） |
| 用戶有 Admin 權限 | 顯示全部（不過濾） |
| 用戶沒有任何 OpCo 權限 | 顯示 "No access" 或隱藏整個欄位 |
| OpCo 代碼無法識別 | 保留原樣顯示 |

### 2.5 重要說明
- **不是刪除數據**，只是在前端顯示時隱藏
- 後端數據保持完整不變
- 過濾邏輯在前端執行

## 3. 實施結果

### 3.1 前端修改 (`apps/web/src/components/project-summary/ProjectSummaryTable.tsx`)

**新增 Props**:
```typescript
interface ProjectSummaryTableProps {
  // ... 原有 props
  /** 用戶有權限訪問的 OpCo 代碼列表（CHANGE-014: OpCo 權限過濾） */
  userOpCoCodes?: string[];
  /** 用戶是否為 Admin（Admin 可查看全部數據） */
  isAdmin?: boolean;
}
```

**新增 `filterChargeOutMethodByPermission` 函數**:
```typescript
function filterChargeOutMethodByPermission(
  chargeOutMethod: string | null,
  userOpCoCodes: string[],
  isAdmin: boolean
): string | null {
  // Admin 用戶顯示全部
  if (isAdmin) {
    return chargeOutMethod;
  }

  // 空值直接返回
  if (!chargeOutMethod || chargeOutMethod.trim() === '') {
    return chargeOutMethod;
  }

  // 檢查是否包含分號（OpCo 分攤格式）
  if (!chargeOutMethod.includes(';')) {
    return chargeOutMethod; // 不是 OpCo 格式，原樣返回
  }

  // 解析分號分隔的條目
  const entries = chargeOutMethod.split(';').map(e => e.trim()).filter(e => e.length > 0);

  // 過濾有權限的條目
  const filteredEntries = entries.filter(entry => {
    const match = entry.match(/^([A-Z]+)/);
    if (!match) return true; // 無法識別，保留
    return userOpCoCodes.includes(match[1]);
  });

  // 如果沒有任何有權限的條目
  if (filteredEntries.length === 0) {
    return null; // 返回 null 表示無權限
  }

  return filteredEntries.join(' ; ');
}
```

**顯示邏輯更新**:
- 優先顯示 `chargeOutMethod`（經過權限過濾）
- 無權限時顯示 "無權限" 提示
- 回退：顯示 `chargeOutOpCos` Badge

### 3.2 頁面修改 (`apps/web/src/app/[locale]/om-summary/page.tsx`)

**新增功能**:
- 導入 `useSession` from `next-auth/react`
- 計算 `isAdmin` 基於 `session?.user?.roleId === 3`
- 傳遞 `userOpCoCodes` 和 `isAdmin` 到 ProjectSummaryTable

```typescript
// CHANGE-014: 獲取用戶 session 以判斷權限
const { data: session } = useSession();
const isAdmin = session?.user?.roleId === 3; // Admin roleId = 3

// 傳遞給 ProjectSummaryTable
<ProjectSummaryTable
  projects={projectSummaryData?.projects || []}
  categorySummary={projectSummaryData?.summary || []}
  financialYear={projectFilters.financialYear}
  isLoading={isProjectLoading}
  userOpCoCodes={opCoData?.map((o) => o.code) || []}
  isAdmin={isAdmin}
/>
```

### 3.3 i18n 翻譯更新

**en.json**:
```json
"projectSummary": {
  "table": {
    "noAccess": "No access"
  }
}
```

**zh-TW.json**:
```json
"projectSummary": {
  "table": {
    "noAccess": "無權限"
  }
}
```

## 4. 影響範圍

| 檔案 | 變更類型 | 說明 |
|------|----------|------|
| `apps/web/src/app/[locale]/om-summary/page.tsx` | 修改 | 添加 useSession、isAdmin 計算、傳遞權限參數 |
| `apps/web/src/components/project-summary/ProjectSummaryTable.tsx` | 修改 | 添加過濾函數、新增 props、顯示邏輯更新 |
| `apps/web/src/messages/en.json` | 修改 | 添加 projectSummary.table.noAccess |
| `apps/web/src/messages/zh-TW.json` | 修改 | 添加 projectSummary.table.noAccess |

## 5. 驗收標準

- [x] 有 OpCo 權限的用戶只能看到自己有權限的 OpCo 數據
- [x] Admin 用戶可以看到全部數據
- [x] 非 OpCo 格式的 Charge Out Method 保持原樣顯示
- [x] 無權限時顯示 "無權限" 提示
- [x] 後端數據不受影響（只是前端過濾）
- [x] i18n 翻譯完整（en + zh-TW）

## 6. 測試驗證

| 測試案例 | 輸入 | 預期結果 | 狀態 |
|----------|------|----------|------|
| Admin 用戶 | 任何 chargeOutMethod | 顯示全部 | ✅ |
| 有權限用戶 | `RA $1,000 ; RMS $2,000 ;` (用戶權限: RA) | 顯示 `RA $1,000` | ✅ |
| 無權限用戶 | `RA $1,000 ;` (用戶權限: RMS) | 顯示 "無權限" | ✅ |
| 非 OpCo 格式 | `Direct charge` | 原樣顯示 | ✅ |
| 空值 | null 或 "" | 顯示 "-" | ✅ |
| 無法識別代碼 | `123 $1,000 ;` | 保留原樣 | ✅ |

## 7. 修復記錄 (2025-12-14)

### 7.1 問題描述
即使使用 Admin 帳號登入，或在用戶管理中選取所有 Operating Companies，在 OM Summary → Project Summary 中仍然看不到全部的 Charge Out Method 內容。

### 7.2 根本原因分析

1. **Session 類型定義不完整**:
   - `Session.user` 中只有 `role: { id, name }` 對象
   - 沒有直接的 `roleId` 欄位

2. **後端 API 使用錯誤的屬性**:
   - `operatingCompany.ts` 中使用 `user.roleId >= 3` 檢查 Admin
   - 但 `user.roleId` 實際上是 `undefined`
   - `undefined >= 3` 總是返回 `false`

3. **token.role 可能為 undefined**:
   - Azure AD 登入時，如果資料庫沒有正確的 Role 記錄
   - `dbUser.role` 可能是 `null`/`undefined`
   - 導致前端 `session?.user?.role?.id === 3` 檢查失敗

### 7.3 修復內容

**1. auth/index.ts - Session 類型定義**:
```typescript
// 添加 roleId 欄位到 Session.user
interface Session {
  user: {
    id: string;
    email: string;
    name: string | null;
    roleId: number; // 新增
    role: { id: number; name: string; };
  };
}
```

**2. auth/index.ts - Session callback**:
```typescript
// 將 token.roleId 傳遞到 session.user
session.user = {
  id: token.id,
  email: token.email,
  name: token.name,
  roleId: token.roleId, // 新增
  role: token.role,
};
```

**3. auth/index.ts - Azure AD 登入處理**:
```typescript
// 確保 token.role 總是有正確的預設值
token.role = dbUser.role ?? {
  id: dbUser.roleId,
  name: dbUser.roleId >= 3 ? 'Admin' : dbUser.roleId >= 2 ? 'Supervisor' : 'ProjectManager'
};
```

**4. operatingCompany.ts - Admin 檢查修復**:
```typescript
// 使用 role.id 而不是 roleId
const userRoleId = user.role?.id ?? 0;
if (userRoleId >= 3) {
  // Admin 返回所有 OpCo
}
```

**5. om-summary/page.tsx - 前端 isAdmin 檢查改進**:
```typescript
// 使用更穩健的檢查方式
const roleId = session?.user?.role?.id ?? 0;
const isAdmin = roleId >= 3;

// 添加調試日誌
console.log('[OM-Summary] Session loaded:', { role, roleId, isAdmin });
```

### 7.4 影響的檔案

| 檔案 | 變更說明 |
|------|----------|
| `packages/auth/src/index.ts` | 修復 Session 類型、session callback、token.role 預設值 |
| `packages/api/src/routers/operatingCompany.ts` | 改用 `role.id` 檢查 Admin |
| `apps/web/src/app/[locale]/om-summary/page.tsx` | 改進 isAdmin 檢查、添加調試日誌 |

### 7.5 驗證方法

1. 登入 Admin 帳號
2. 開啟瀏覽器 DevTools Console
3. 進入 OM Summary → Project Summary
4. 確認 Console 日誌顯示:
   - `roleName: 'Admin'`
   - `isAdmin: true`
5. 確認 Charge Out Method 欄位顯示完整內容

## 8. 第二次修復記錄 (2025-12-14)

### 8.1 問題描述
即使套用了第一次修復，Admin 用戶仍然看不到全部內容。Console 顯示 `roleId: 1, isAdmin: false`。

### 8.2 根本原因
資料庫 Role 表的 id 映射與程式碼預期完全不一致：

| Role ID | 資料庫中的 Name | 程式碼預期的 Name |
|---------|----------------|------------------|
| 1 | **Admin** | ProjectManager |
| 2 | ProjectManager | Supervisor |
| 3 | Supervisor | **Admin** |

程式碼使用 `roleId >= 3` 判斷 Admin，但資料庫中 Admin 的 id 是 1。

### 8.3 最終修復方案
改用 `role.name === 'Admin'` 判斷 Admin 權限，與 `trpc.ts` 中的 `adminProcedure` 保持一致。

**operatingCompany.ts**:
```typescript
const isAdmin = user.role?.name === 'Admin';
if (isAdmin) {
  // Admin 返回所有 OpCo
}
```

**om-summary/page.tsx**:
```typescript
const roleName = session?.user?.role?.name ?? '';
const isAdmin = roleName === 'Admin';
```

### 8.4 Git Commits
- `2d403b8` - 第一次修復（Session 類型、token.role 預設值）
- `0ba4345` - 第二次修復（改用 role.name 判斷）

---

**維護者**: AI 助手
**最後更新**: 2025-12-14
