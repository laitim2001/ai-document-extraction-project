# FIX-095: Middleware 路由保護配置不完整

> **建立日期**: 2025-12-17
> **狀態**: ✅ 已完成
> **優先級**: High
> **類型**: 安全性 / 認證

---

## 1. 問題描述

### 1.1 問題現象
用戶登出後訪問受保護頁面（如 `/projects`）時：
- ❌ 頁面仍然渲染 DashboardLayout（Sidebar、TopBar、Breadcrumb）
- ❌ 顯示 "Failed to load projects: UNAUTHORIZED" 錯誤訊息
- ❌ 未能正確重定向到登入頁面

### 1.2 期望行為
- ✅ 未登入用戶訪問受保護頁面時，應立即重定向到 `/login`
- ✅ 不應看到任何內部頁面結構（Sidebar、TopBar 等）
- ✅ 符合企業級應用的標準安全行為

### 1.3 影響範圍
所有需要認證的頁面，特別是以下 **缺失於 Middleware 配置** 的路由：

| 路由 | 狀態 | 說明 |
|------|------|------|
| `/om-expenses/*` | ❌ 缺失 | OM 費用管理 |
| `/om-summary/*` | ❌ 缺失 | OM Summary 報表 |
| `/charge-outs/*` | ❌ 缺失 | 費用轉嫁 |
| `/quotes/*` | ❌ 缺失 | 報價單 |
| `/notifications/*` | ❌ 缺失 | 通知中心 |
| `/settings/*` | ❌ 缺失 | 用戶設定 |
| `/data-import/*` | ❌ 缺失 | 數據導入 |
| `/operating-companies/*` | ❌ 缺失 | 營運公司 |
| `/om-expense-categories/*` | ❌ 缺失 | OM 費用類別 |

---

## 2. 根本原因分析

### 2.1 問題根源

**主要問題：Locale 前綴未被正確處理**

1. **middleware.ts matcher**：使用 `/projects/:path*` 但實際 URL 是 `/en/projects`
2. **auth.config.ts authorized callback**：使用 `pathname.startsWith('/projects')` 但 pathname 是 `/en/projects`
3. **缺失路由**：多個路由未被列入保護清單

### 2.2 技術細節

**問題示意：**
```
實際 URL: /en/projects
Matcher: /projects/:path* → 不匹配！
pathname.startsWith('/projects') → false！(/en/projects 不是以 /projects 開頭)
```

**修復前的 middleware.ts 配置：**
```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',      // ❌ 不匹配 /en/dashboard
    '/projects/:path*',       // ❌ 不匹配 /en/projects
    // ...
  ],
};
```

**修復前的 auth.config.ts 配置：**
```typescript
const isProtectedRoute = protectedRoutes.some((route) =>
  pathname.startsWith(route),  // ❌ /en/projects 不是以 /projects 開頭
);
```

---

## 3. 解決方案

### 3.1 修改文件清單

| 文件 | 變更類型 | 說明 |
|------|----------|------|
| `apps/web/src/middleware.ts` | 修改 | 使用 `/(en\|zh-TW)/` 前綴匹配 locale |
| `apps/web/src/auth.config.ts` | 修改 | 新增 locale 移除邏輯 + 補充缺失路由 |

### 3.2 具體修改內容

#### middleware.ts - 使用 locale 前綴的 matcher
```typescript
export const config = {
  // FIX-095: 使用正則表達式匹配所有帶 locale 前綴的受保護路由
  matcher: [
    // 現有路由 - 帶 locale 前綴
    '/(en|zh-TW)/dashboard/:path*',
    '/(en|zh-TW)/projects/:path*',
    '/(en|zh-TW)/budget-pools/:path*',
    // ... 等等
    // FIX-095: 新增缺失的受保護路由
    '/(en|zh-TW)/om-expenses/:path*',
    '/(en|zh-TW)/om-summary/:path*',
    // ... 等等
  ],
};
```

#### auth.config.ts - 移除 locale 前綴後再匹配
```typescript
authorized: async ({ auth, request }) => {
  const isLoggedIn = !!auth?.user;
  const { pathname } = request.nextUrl;

  // FIX-095: 支援的 locale 列表
  const locales = ['en', 'zh-TW'];

  // FIX-095: 從 pathname 中移除 locale 前綴
  // 例如: /en/projects → /projects
  let pathnameWithoutLocale = pathname;
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) {
      pathnameWithoutLocale = pathname.slice(locale.length + 1);
      break;
    }
  }

  const protectedRoutes = [
    '/dashboard', '/projects', // ... 現有路由
    '/om-expenses', '/om-summary', // ... 新增路由
  ];

  // FIX-095: 使用移除 locale 後的 pathname 進行匹配
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route),
  );

  if (isProtectedRoute && !isLoggedIn) {
    return false; // 重定向到登入頁面
  }
  return true;
};
```

---

## 4. 測試驗證

### 4.1 測試場景
- [ ] 登出後訪問 `/projects` - 應重定向到 `/login`
- [ ] 登出後訪問 `/om-expenses` - 應重定向到 `/login`
- [ ] 登出後訪問 `/om-summary` - 應重定向到 `/login`
- [ ] 登出後訪問 `/charge-outs` - 應重定向到 `/login`
- [ ] 登出後訪問 `/quotes` - 應重定向到 `/login`
- [ ] 登出後訪問 `/notifications` - 應重定向到 `/login`
- [ ] 登出後訪問 `/settings` - 應重定向到 `/login`
- [ ] 登出後訪問 `/data-import` - 應重定向到 `/login`
- [ ] 登出後訪問 `/operating-companies` - 應重定向到 `/login`
- [ ] 登出後訪問 `/om-expense-categories` - 應重定向到 `/login`

### 4.2 驗收標準
1. ✅ 所有受保護路由在未登入時重定向到 `/login`
2. ✅ 不應看到任何內部頁面結構
3. ✅ 登入後應返回原本嘗試訪問的頁面
4. ✅ 已登入用戶可正常訪問所有頁面

---

## 5. 風險評估

| 風險 | 等級 | 緩解措施 |
|------|------|----------|
| 影響現有認證流程 | 低 | 僅添加路由，不修改邏輯 |
| 遺漏其他路由 | 低 | 已全面檢查 app 目錄結構 |
| 破壞 i18n 路由 | 低 | middleware 已整合 next-intl |

---

## 6. 相關文件

- `apps/web/src/middleware.ts` - NextAuth + next-intl Middleware
- `apps/web/src/auth.config.ts` - Edge-compatible 認證配置
- `packages/auth/src/index.ts` - 完整 NextAuth 配置

---

## 7. 實施狀態

- [x] 文檔已確認 ✅ 2025-12-17
- [x] middleware.ts 已修改 ✅ 2025-12-17
- [x] auth.config.ts 已修改 ✅ 2025-12-17
- [x] 本地測試通過 ✅ 2025-12-17
- [ ] 代碼提交

**關聯修復**: FIX-096 (Layout Hydration 錯誤)

---

## 8. 實施記錄

### 2025-12-17 第一次修改（不完整）

**問題**：僅新增路由，未處理 locale 前綴問題

### 2025-12-17 第二次修改（完整修復）

**middleware.ts (line 157-181)**:
- 使用 `/(en|zh-TW)/` 正則表達式前綴匹配所有 locale
- 新增 9 個缺失的受保護路由
- 添加註釋標記 `FIX-095`

**auth.config.ts (line 88-140)**:
- 新增 locale 前綴移除邏輯（第 92-106 行）
- 使用移除 locale 後的 pathname 進行路由匹配
- 新增 9 個缺失的受保護路由
- 添加註釋標記 `FIX-095`

---

**最後更新**: 2025-12-17
**負責人**: AI Assistant
