# 2025-12-23 Sidebar 導航與 Select 組件修復

> **日期**: 2025-12-23
> **類型**: Bug 修復 / UI 組件
> **狀態**: ✅ 已完成
> **關聯**: REFACTOR-001 後的頁面測試

---

## 問題概覽

在 REFACTOR-001 完成後進行頁面測試時，發現以下問題：

| # | 問題 | 嚴重程度 | 狀態 |
|---|------|----------|------|
| 1 | Radix UI Select 組件空值錯誤 | 高 | ✅ 已修復 |
| 2 | Sidebar 導航連結與實際路由不匹配 | 中 | ✅ 已修復 |

---

## 問題 1: Select 組件空值錯誤

### 症狀
訪問 `/invoices` 頁面時，console 報錯：
```
Error: A <Select.Item /> must have a value prop that is not an empty string.
```

### 根本原因
Radix UI 的 `<SelectItem>` 組件不允許 `value=""` 空字串值。這是 Radix UI 的設計限制。

### 受影響檔案

| 檔案 | 行號 | 原始代碼 |
|------|------|----------|
| `src/app/(dashboard)/invoices/page.tsx` | 172 | `<SelectItem value="">所有狀態</SelectItem>` |
| `src/components/audit/AuditQueryForm.tsx` | 263 | `<SelectItem value="">全部狀態</SelectItem>` |
| `src/app/(dashboard)/rules/review/page.tsx` | 355 | `<SelectItem value="">全部</SelectItem>` |
| `src/components/features/admin/EditUserDialog.tsx` | 304 | `<SelectItem value="">不指定城市</SelectItem>` |

### 解決方案

使用特殊值（如 `"all"` 或 `"__none__"`）替代空字串，並在 `onValueChange` 中轉換回空字串：

**修復模式：**
```typescript
// Before
<Select value={statusFilter} onValueChange={setStatusFilter}>
  <SelectItem value="">所有狀態</SelectItem>
</Select>

// After
<Select
  value={statusFilter || 'all'}
  onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
>
  <SelectItem value="all">所有狀態</SelectItem>
</Select>
```

### 驗證
修復後 console 無錯誤，篩選功能正常運作。

---

## 問題 2: Sidebar 導航連結錯誤

### 症狀
點擊 Sidebar 某些選項時出現 404 或重定向到錯誤頁面。

### 分析結果

| Sidebar 連結 | 實際頁面位置 | 問題 |
|-------------|-------------|------|
| `/mappings` | `/rules` | 路徑錯誤 |
| `/reports` | `/reports/monthly` (子頁面) | 無主頁 |
| `/audit` | `/audit/query` | 路徑錯誤 |
| `/trace` | 不存在 | 未實現 |
| `/settings` | 不存在 | 未實現 |
| `/users` | `/admin/users` | 路徑錯誤 |

### 解決方案

更新 `src/components/layout/Sidebar.tsx` 中的導航配置：

```typescript
// 修正後的導航配置
const navigation: NavSection[] = [
  // ... 其他區塊
  {
    title: '規則管理',
    items: [
      { name: '映射規則', href: '/rules', icon: GitBranch },  // 從 /mappings 改為 /rules
      { name: 'Forwarder 管理', href: '/forwarders', icon: Building2 },
    ],
  },
  {
    title: '報表',
    items: [
      { name: '分析報表', href: '/reports/monthly', icon: BarChart3 },  // 指向子頁面
      { name: '審計日誌', href: '/audit/query', icon: History },  // 指向實際頁面
      // { name: '文件追蹤', href: '/trace', icon: FileSearch }, // TODO: 待實現
    ],
  },
  {
    title: '系統管理',
    items: [
      // { name: '系統設定', href: '/settings', icon: Settings }, // TODO: 待實現
      { name: '用戶管理', href: '/admin/users', icon: Users },  // 修正路徑
    ],
  },
]
```

---

## 待處理項目（記錄為技術債務）

### 未實現的頁面
以下頁面在 Sidebar 中被註釋，待後續 Epic 實現：
- `/trace` - 文件追蹤功能
- `/settings` - 系統設定頁面

### TypeScript 編譯錯誤
REFACTOR-001 遺留的 Prisma schema 與代碼不同步問題（約 50+ 錯誤），需要另外處理。主要涉及：
- `company` vs `forwarder` 欄位命名
- 關聯查詢的 include 配置

---

## 修改的檔案清單

1. `src/app/(dashboard)/invoices/page.tsx` - SelectItem 修復
2. `src/components/audit/AuditQueryForm.tsx` - SelectItem 修復
3. `src/app/(dashboard)/rules/review/page.tsx` - SelectItem 修復
4. `src/components/features/admin/EditUserDialog.tsx` - SelectItem 修復
5. `src/components/layout/Sidebar.tsx` - 導航連結修復

---

## 頁面測試結果摘要

| 頁面 | HTTP 狀態 | 說明 |
|------|----------|------|
| `/dashboard` | 200 ✅ | 正常 |
| `/global` | 200 ✅ | 正常 |
| `/invoices` | 200 ✅ | 修復後正常 |
| `/invoices/upload` | 200 ✅ | 正常 |
| `/review` | 200 ✅ | 正常 |
| `/escalations` | 307 ✅ | 重定向（需登入） |
| `/rules` | 200 ✅ | 正常 |
| `/forwarders` | 307 ✅ | 重定向（需登入） |
| `/reports/monthly` | 待測 | 需驗證 |
| `/audit/query` | 待測 | 需驗證 |
| `/admin/users` | 待測 | 需驗證 |

---

## 經驗教訓

1. **Radix UI Select 限制**
   - `<SelectItem value="">` 不允許空字串
   - 使用特殊標記值（如 `"all"`、`"__none__"`）替代

2. **頁面路由與 Sidebar 同步**
   - 新增頁面時應同步更新 Sidebar 導航
   - 建議使用常數定義路由，避免硬編碼

3. **大型重構後的回歸測試**
   - REFACTOR-001 後應進行完整頁面測試
   - 建立測試清單追蹤所有頁面狀態

---

*記錄人: AI Assistant*
*記錄時間: 2025-12-23*
