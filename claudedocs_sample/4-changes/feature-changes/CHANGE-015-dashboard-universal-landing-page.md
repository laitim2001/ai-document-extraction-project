# CHANGE-015: Dashboard 通用登陸頁面

> **建立日期**: 2025-12-14
> **完成日期**: 2025-12-14
> **狀態**: ✅ 已完成
> **相關功能**: FEAT-011 (Permission Management), Epic 7 (Dashboard)
> **優先級**: High
> **變更類型**: 功能增強 (Enhancement)

## 1. 變更概述

### 1.1 問題背景
在 FEAT-011 權限管理功能測試中發現：即使用戶沒有 `menu:dashboard` 權限，登入後仍會被重定向到 `/dashboard` 頁面。這是因為 NextAuth.js 的登入流程將 `/dashboard` 設定為預設的 `callbackUrl`。

**問題位置**:
```typescript
// apps/web/src/app/[locale]/login/page.tsx
const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
```

### 1.2 選項分析

| 選項 | 描述 | 優點 | 缺點 |
|------|------|------|------|
| **選項 1** (採用) | Dashboard 作為通用登陸頁面 | UX 一致、實現簡單、預期行為 | 需修改 Dashboard 內容 |
| 選項 2 | 動態尋找第一個有權限的頁面 | 最大化權限控制 | 複雜、非預期行為、可能無任何頁面 |

**決定**: 採用選項 1 - Dashboard 作為通用登陸頁面

### 1.3 目標
1. `/dashboard` 頁面不需要特定菜單權限即可訪問
2. Dashboard 顯示通用內容，所有已登入用戶都可查看
3. Dashboard 根據用戶權限顯示不同的快速操作入口
4. 保持登入流程的一致性和可預測性

## 2. 需求規格

### 2.1 Dashboard 內容調整

#### 保留的通用內容（所有用戶可見）
- ✅ 歡迎訊息和頁面標題
- ✅ 系統公告區塊（新增）
- ✅ 用戶個人統計（如：我的待辦事項、我的通知）
- ✅ 最近活動列表（限於用戶有權限查看的活動）

#### 權限控制的內容
- 🔒 快速操作面板：根據菜單權限過濾顯示
- 🔒 統計卡片：根據用戶角色和權限顯示不同數據
- 🔒 AI 智能分析：可保留但顯示通用建議

### 2.2 權限過濾規則

#### 快速操作面板過濾
| 操作 | 所需權限 |
|------|----------|
| 新增專案 | `menu:projects` |
| 建立提案 | `menu:proposals` |
| 新增預算池 | `menu:budgetPools` |
| 供應商管理 | `menu:vendors` |
| 查看採購單 | `menu:purchaseOrders` |
| 費用記錄 | `menu:expenses` |

### 2.3 保留功能
- `/dashboard/pm` - PM 專用儀表板（需 PM 權限）
- `/dashboard/supervisor` - Supervisor 儀表板（需 Supervisor 權限）

## 3. 實施計劃

### Phase 1: Dashboard 頁面修改

#### 3.1 導入權限 Hook
```typescript
// apps/web/src/app/[locale]/dashboard/page.tsx
import { usePermissions, MENU_PERMISSIONS } from '@/hooks/usePermissions';
```

#### 3.2 快速操作面板權限過濾
```typescript
const { hasPermission, isLoading: permissionsLoading } = usePermissions();

const quickActions = [
  {
    name: '新增專案',
    description: '建立新的 IT 專案',
    icon: '📁',
    href: '/projects/new',
    permission: MENU_PERMISSIONS.PROJECTS,
  },
  {
    name: '建立提案',
    description: '提交預算提案申請',
    icon: '📋',
    href: '/proposals/new',
    permission: MENU_PERMISSIONS.PROPOSALS,
  },
  // ... 其他操作
].filter(action => !action.permission || hasPermission(action.permission));
```

#### 3.3 歡迎區塊改進
```typescript
// 顯示更友好的歡迎訊息
<div>
  <h1>{t('title')}</h1>
  <p>{t('welcomeBack', { name: session?.user?.name || '' })}</p>
</div>
```

### Phase 2: 統計卡片權限過濾（可選）

根據用戶角色顯示不同的統計數據：
- **Admin/Supervisor**: 顯示全局統計（總預算、總專案數等）
- **ProjectManager**: 顯示個人統計（我的專案數、我的提案數等）
- **無特定權限**: 顯示通用統計（今日日期、系統狀態等）

### Phase 3: 移除 Dashboard 菜單權限檢查

**不需要修改 Sidebar**:
- `menu:dashboard` 權限仍然控制 Sidebar 中 Dashboard 連結的顯示
- 但 Dashboard 頁面本身不使用 PermissionGate 包裝

## 4. 影響範圍

### 4.1 需要修改的檔案

| 檔案 | 變更類型 | 說明 |
|------|----------|------|
| `apps/web/src/app/[locale]/dashboard/page.tsx` | 修改 | 添加權限過濾邏輯 |
| `apps/web/src/messages/en.json` | 修改 | 添加新的翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 修改 | 添加新的翻譯鍵 |

### 4.2 不需要修改的檔案
- `apps/web/src/app/[locale]/login/page.tsx` - 保持 `/dashboard` 為預設 callbackUrl
- `apps/web/src/components/layout/Sidebar.tsx` - 保持現有權限過濾邏輯
- `apps/web/src/components/layout/PermissionGate.tsx` - 不需要修改

## 5. 設計說明

### 5.1 為什麼 Dashboard 不需要權限保護？

1. **登入即授權**: Dashboard 是登入後的預設頁面，已登入用戶應該能訪問
2. **通用內容**: Dashboard 顯示的是概覽信息，不包含敏感操作
3. **權限在內容層**: 敏感內容（如快速操作、特定統計）已經通過權限過濾
4. **一致的 UX**: 用戶登入後總是有一個可訪問的頁面

### 5.2 與其他系統的一致性

大多數企業應用系統都採用類似設計：
- GitHub: 登入後進入 Dashboard（顯示個人相關內容）
- Jira: 登入後進入主頁（顯示 Your Work）
- Azure Portal: 登入後進入 Home（顯示服務概覽）

## 6. 驗收標準

- [x] 任何已登入用戶都可以訪問 `/dashboard` 頁面
- [x] 快速操作面板根據用戶權限過濾顯示
- [x] 沒有任何菜單權限的用戶仍可看到基本的 Dashboard 內容
- [x] PM Dashboard 和 Supervisor Dashboard 仍需要相應權限（未修改）
- [x] i18n 翻譯完整（en + zh-TW）- 2389 keys
- [x] 無 TypeScript 錯誤（Dashboard 頁面）
- [ ] 無 Console 錯誤（待測試）

## 7. 測試案例

| 測試案例 | 用戶權限 | 預期結果 |
|----------|----------|----------|
| 無任何菜單權限 | 無 | 可訪問 Dashboard，快速操作面板為空 |
| 只有 Projects 權限 | `menu:projects` | 可訪問 Dashboard，只顯示「新增專案」操作 |
| 完整權限 | 全部 | 可訪問 Dashboard，顯示所有快速操作 |
| Admin | 全部 | 可訪問 Dashboard，顯示全局統計 |

## 8. 後續考慮（可選擴展）

1. **個人化 Dashboard**: 用戶可自定義 Dashboard 顯示的模塊
2. **系統公告**: 添加系統公告區塊供管理員發布訊息
3. **Widget 系統**: 允許用戶添加/移除 Dashboard widgets

## 9. 實施結果

### 9.1 修改的檔案

| 檔案 | 變更說明 |
|------|----------|
| `apps/web/src/app/[locale]/dashboard/page.tsx` | 導入 usePermissions、MENU_PERMISSIONS、Link；添加權限過濾邏輯；修改快速操作面板渲染 |
| `apps/web/src/messages/en.json` | 添加 `dashboard.quickActions.noActions` 翻譯鍵 |
| `apps/web/src/messages/zh-TW.json` | 添加 `dashboard.quickActions.noActions` 翻譯鍵 |

### 9.2 關鍵代碼變更

**1. 導入權限 Hook**:
```typescript
import { usePermissions, MENU_PERMISSIONS } from '@/hooks/usePermissions';
import { Link } from '@/i18n/routing';
```

**2. 快速操作權限過濾**:
```typescript
const { hasPermission, isLoading: permissionsLoading } = usePermissions();

const allQuickActions = [
  {
    name: t('quickActions.actions.newProject.name'),
    description: t('quickActions.actions.newProject.description'),
    icon: '📁',
    href: '/projects/new',
    permission: MENU_PERMISSIONS.PROJECTS,
  },
  // ... 其他操作
];

const quickActions = useMemo(() => {
  if (permissionsLoading) return [];
  return allQuickActions.filter(
    (action) => !action.permission || hasPermission(action.permission)
  );
}, [permissionsLoading, hasPermission, t]);
```

**3. 渲染邏輯**:
- 載入中：顯示 skeleton 動畫
- 無權限：顯示「暫無可用的快速操作」提示
- 正常：顯示有權限的快速操作按鈕（可點擊跳轉）

### 9.3 驗證結果

- ✅ i18n 驗證通過 (2389 keys)
- ✅ TypeScript 編譯通過（Dashboard 頁面無錯誤）
- ⏳ 待用戶測試確認功能正常

---

**維護者**: AI 助手
**最後更新**: 2025-12-14
