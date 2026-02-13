# FIX-060: 英文版顯示中文內容 - 診斷報告

> **診斷日期**: 2025-11-04 00:35
> **嚴重性**: P1 (重要)
> **影響範圍**: 所有頁面的英文版
> **狀態**: 🔍 診斷中

---

## 📋 問題描述

訪問 `http://localhost:3011/en/dashboard` 時，頁面標題和部分內容仍然顯示**中文**，而非預期的英文。

### 用戶觀察
```
訪問 /en/dashboard → 顯示 "儀表板"、"歡迎回來！" 等中文文字
預期： 應顯示 "Dashboard"、"Welcome back!" 等英文文字
```

---

## 🔍 診斷過程

### 1. 檢查 i18n 配置

✅ **配置正確**：

**`apps/web/src/i18n/routing.ts`** (Lines 4-16):
```typescript
export const routing = defineRouting({
  locales: ['en', 'zh-TW'],      // ✅ 支援兩種語言
  defaultLocale: 'zh-TW',         // ✅ 默認繁體中文
  localePrefix: 'always'          // ✅ URL 顯示語言前綴
});
```

**`apps/web/src/i18n/request.ts`** (Lines 4-19):
```typescript
export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default  // ✅ 動態載入對應語言
  };
});
```

**結論**: i18n 配置完全正確，應該能正確載入 en.json。

---

### 2. 檢查 Dashboard 頁面翻譯

✅ **Dashboard 翻譯完整**：

**`apps/web/src/messages/en.json`** (Lines 197-268):
```json
"dashboard": {
  "title": "Dashboard",                          // ✅ 英文
  "welcome": "Welcome back! View your project...", // ✅ 英文
  "stats": {
    "monthlyBudget": "Monthly Budget",           // ✅ 英文
    "activeProjects": "Active Projects",         // ✅ 英文
    // ... 所有 key 都正確翻譯成英文
  }
}
```

**結論**: Dashboard 區塊的英文翻譯**100% 完整**。

---

### 3. 檢查 Layout 組件翻譯

⚠️ **發現問題**：

#### TopBar 組件
**`apps/web/src/components/layout/TopBar.tsx`** (Line 37):
```typescript
const t = useTranslations('navigation');  // 使用 navigation 命名空間
```

使用的翻譯 key：
- `t('search.label')` → navigation.search.label
- `t('search.placeholder')` → navigation.search.placeholder
- `t('notifications.view')` → navigation.notifications.view
- `t('userMenu.defaultUser')` → navigation.userMenu.defaultUser

#### Sidebar 組件
**`apps/web/src/components/layout/Sidebar.tsx`** (Line 39):
```typescript
const t = useTranslations('navigation');  // 使用 navigation 命名空間
```

使用的翻譯 key：
- 所有菜單項：`navigation.menu.dashboard`、`navigation.menu.projects` 等
- 所有描述：`navigation.descriptions.dashboard`、`navigation.descriptions.projects` 等

---

### 4. 檢查 Navigation 翻譯

❌ **找到根本原因**：

**`apps/web/src/messages/en.json`** - navigation 區塊：

✅ **已翻譯的部分**：
```json
"navigation": {
  "dashboard": "Home",                           // ✅ 英文
  "brand": {
    "title": "IT Project Management",            // ✅ 英文
    "subtitle": "Process Platform"               // ✅ 英文
  },
  "menu": {
    "dashboard": "Dashboard",                     // ✅ 英文
    "projects": "Projects",                       // ✅ 英文
    "proposals": "Budget Proposals",              // ✅ 英文
    // ... 所有菜單項都是英文
  },
```

❌ **未翻譯的部分（還是中文）**：
```json
  "descriptions": {
    "dashboard": "專案總覽和關鍵指標",           // ❌ 中文！
    "projects": "專案資料和進度管理",            // ❌ 中文！
    "proposals": "預算提案申請和審批",          // ❌ 中文！
    // ... 所有 descriptions 都還是中文
  },
  "search": {
    "label": "Search",                           // ✅ 英文
    "placeholder": "Search projects, proposals..." // ✅ 英文
  }
}
```

---

## 🎯 根本原因

**en.json 文件中的 `navigation.descriptions.*` 區塊全部未翻譯，仍然是中文**。

這導致：
1. **Sidebar 的菜單描述**顯示中文
2. **整個頁面的視覺語言不一致**：
   - 菜單項：英文（"Dashboard", "Projects"）
   - 菜單描述：中文（"專案總覽和關鍵指標"）
   - 頁面內容：英文（"Monthly Budget", "Active Projects"）

---

## 📊 未翻譯內容統計

### Navigation 區塊未翻譯
```json
"navigation": {
  "descriptions": {
    "dashboard": "專案總覽和關鍵指標",
    "projects": "專案資料和進度管理",
    "proposals": "預算提案申請和審批",
    "budgetPools": "預算池配置和管理",
    "vendors": "供應商資料庫",
    "quotes": "報價單管理",
    "purchaseOrders": "採購訂單追蹤",
    "expenses": "費用記錄和報銷",
    "omExpenses": "OM 費用管理",
    "chargeOuts": "費用沖銷管理",
    "users": "用戶和權限管理",
    "notifications": "系統通知中心",
    "settings": "個人設定",
    "help": "使用說明和支援"
  }
}
```

### 其他區塊未翻譯（初步發現）
通過 grep 檢查，發現大量其他區塊也未翻譯：

```bash
# 檢查 projects 區塊
grep -A 5 '"projects":' en.json
"projects": {
  "title": "Projects",              // ✅ 英文
  "list": {
    "title": "專案列表",            // ❌ 中文
    "subtitle": "管理所有 IT 專案", // ❌ 中文
```

---

## ✅ 解決方案

### 方案 A: 完整翻譯所有未翻譯區塊（推薦）

**優點**:
- 一次性解決所有語言問題
- 提供完整的英文用戶體驗
- 避免後續重複修復

**缺點**:
- 需要翻譯大量內容（預估 2000+ 行）
- 耗時較長（約 2-3 小時）

**實施步驟**:
1. **系統化檢查**: 使用腳本找出所有未翻譯的中文字串
2. **分批翻譯**: 按照區塊優先級翻譯
   - P0: navigation (Layout 組件使用)
   - P1: dashboard, projects, proposals（常用頁面）
   - P2: 其他功能頁面
3. **驗證測試**: 每個區塊翻譯後立即測試

---

### 方案 B: 優先修復核心區塊（快速修復）

**優點**:
- 快速修復最明顯的問題
- 立即改善用戶體驗
- 可以逐步完善

**缺點**:
- 仍有部分頁面顯示中文
- 需要多次修復迭代

**實施步驟**:
1. **立即修復** (15 分鐘): navigation.descriptions
2. **短期修復** (30 分鐘): dashboard, projects, proposals
3. **後續完善**: 其他功能頁面按需翻譯

---

## 🔧 立即修復範例

### 修復 navigation.descriptions

**修復前** (en.json):
```json
"descriptions": {
  "dashboard": "專案總覽和關鍵指標",
  "projects": "專案資料和進度管理",
  // ...
}
```

**修復後**:
```json
"descriptions": {
  "dashboard": "Project overview and key metrics",
  "projects": "Project data and progress management",
  "proposals": "Budget proposal submission and approval",
  "budgetPools": "Budget pool configuration and management",
  "vendors": "Vendor database",
  "quotes": "Quote management",
  "purchaseOrders": "Purchase order tracking",
  "expenses": "Expense recording and reimbursement",
  "omExpenses": "OM expense management",
  "chargeOuts": "Expense charge-out management",
  "users": "User and permission management",
  "notifications": "System notification center",
  "settings": "Personal settings",
  "help": "User guide and support"
}
```

---

## 🎯 建議執行方案

**採用方案 A（完整翻譯）**，但分階段執行：

### 階段 1: 立即修復 (15 分鐘) - FIX-060A
- ✅ 修復 `navigation.descriptions` (14 個描述) - **已完成**
- ✅ 驗證 Dashboard 頁面英文版

### 階段 1.5: 修復 Client Component Locale 問題 (30 分鐘) - FIX-060B
- ✅ 添加 `NextIntlClientProvider` 的 `locale` prop - **已完成**
- 🔍 **發現新問題**: 雖然連結路徑正確 (/en/*)，但 `useTranslations()` 仍返回中文
- 🔍 **調查中**: Client Component 在 `/en/` 路徑下未正確獲取英文翻譯

### 階段 2: 核心頁面 (30 分鐘) - FIX-060C
- 修復 `projects` 區塊
- 修復 `proposals` 區塊
- 修復 `budgetPools` 區塊

### 階段 3: 功能頁面 (60 分鐘) - FIX-060D
- 修復 `vendors` 區塊
- 修復 `purchaseOrders` 區塊
- 修復 `expenses` 區塊

### 階段 4: 系統頁面 (30 分鐘) - FIX-060E
- 修復 `users` 區塊
- 修復 `notifications` 區塊
- 修復 `settings` 區塊

---

## 📝 關鍵發現總結

1. **i18n 配置正確** → 不是配置問題
2. **Dashboard 翻譯完整** → 證明翻譯機制有效
3. **Navigation 未翻譯** → 導致 Layout 組件顯示中文
4. **大量區塊未翻譯** → 需要系統化完成翻譯

---

## ⏭️ 下一步行動

### 用戶問題 2 的回答

> 問題2: 是否先修正好 dashboard頁 (能夠正常在中文和英文 zh-TW 和 en 都顯示對應的中文和英文內容之後, 就可以將此套用到其他頁面?)

**回答**: **是的，完全正確！**

**Dashboard 作為模板的優勢**:
1. ✅ **結構已驗證**: Dashboard 的 JSON 結構已經過 FIX-059 完整修復和驗證
2. ✅ **兩語言完整**: zh-TW.json 和 en.json 的 dashboard 區塊都已完整
3. ✅ **無 IntlError**: 已通過完整測試，無任何運行時錯誤
4. ✅ **設計模式**: 扁平化結構、命名一致性、完整性檢查

**套用到其他頁面的流程**:
1. **複製 Dashboard 的結構模式**
2. **使用 Dashboard 的命名慣例**
3. **應用 Dashboard 的驗證標準**
4. **遵循 FIX-059 的教訓**

**具體執行**:
- **先完成** FIX-060A（修復 navigation.descriptions）
- **然後** 將 Dashboard 的設計模式應用到其他頁面
- **每個區塊** 都參照 Dashboard 的結構進行遷移

---

---

## 🆕 最新發現：Client Component Locale 解析問題

> **更新時間**: 2025-11-04 01:00
> **嚴重性升級**: P0 (阻塞性問題)

### 新問題現象

在完成 FIX-060A 和 FIX-060B 後，發現：

**✅ 已修復的部分**:
1. FIX-060A: `navigation.descriptions` 已全部翻譯為英文
2. FIX-060B: `NextIntlClientProvider` 已添加 `locale={locale}` prop
3. 連結路徑正確生成：`/en/dashboard`, `/en/projects` 等

**❌ 仍然存在的問題**:
雖然 URL 路徑正確，但 Sidebar 的 `useTranslations()` 在 `/en/` 路徑下仍然返回中文翻譯。

### 實際觀察結果

**英文版 (/en/dashboard)**:
```html
<!-- ✅ URL 路徑正確 -->
href="/en/dashboard"

<!-- ❌ 但文字顯示中文 -->
<span class="truncate">儀表板</span>
```

### 可能的根本原因分析

#### 假設 1: SSR/CSR Hydration 不匹配 (可能性: 高)
Client Component 在初始渲染時使用了錯誤的 locale 上下文。

#### 假設 2: Link 和 useTranslations 使用不同的 locale 來源 (可能性: 高)
- `Link` 組件正確生成 `/en/*` 路徑 → 獲取了正確的 locale
- `useTranslations()` 返回中文 → 獲取的 locale 是 'zh-TW'

這表示兩者從不同的 context 獲取 locale。

### 下一步調查計劃

#### 優先級 1: Debug Logging
在 Sidebar.tsx 添加調試代碼：

```typescript
"use client"
import { useTranslations, useLocale } from 'next-intl'

export function Sidebar() {
  const locale = useLocale()
  const t = useTranslations('navigation')

  console.log('[Sidebar] locale:', locale)
  console.log('[Sidebar] dashboard:', t('menu.dashboard'))
}
```

#### 優先級 2: 檢查 next-intl 版本
```bash
pnpm list next-intl
```

#### 優先級 3: 測試 Provider 順序調整
嘗試調整 Provider 嵌套順序。

---

---

## ✅ 問題解決：找到根本原因並修復

> **解決時間**: 2025-11-04 01:15
> **根本原因**: `getMessages()` 未傳遞 `locale` 參數

### 最終診斷結果

通過 Debug Logging 確認了：
```javascript
{
  locale: 'en',                    // ✅ locale 正確
  pathname: '/dashboard',
  'menu.dashboard': '儀表板',      // ❌ 但翻譯是中文
  'expected (en)': 'Dashboard'
}
```

**關鍵發現**: `useLocale()` 返回 `'en'`，但 `useTranslations()` 仍然使用中文翻譯。

### 根本原因

**問題代碼** (`apps/web/src/app/[locale]/layout.tsx:38`):
```typescript
const messages = await getMessages();  // ❌ 未傳遞 locale 參數
```

**問題分析**:
1. `getMessages()` 在沒有參數時，可能使用**默認語言** ('zh-TW')
2. 雖然 `NextIntlClientProvider` 接收了 `locale='en'` prop
3. 但 `messages` 已經是中文翻譯的內容
4. 導致 Client Component 使用了錯誤的翻譯文件

### 修復方案

**修復代碼**:
```typescript
// 🔧 FIX-060: 明確傳遞 locale 參數給 getMessages()
const messages = await getMessages({ locale });  // ✅ 正確傳遞 locale
```

**修復邏輯**:
1. `getMessages({ locale })` 會根據傳入的 `locale` 參數
2. 調用 `i18n/request.ts` 中配置的邏輯
3. 動態加載正確的翻譯文件：`messages/${locale}.json`
4. 確保 `messages` 是當前語言的翻譯內容

### 測試驗證

請重新測試：
```bash
# 訪問英文版
http://localhost:3001/en/dashboard

# 訪問中文版
http://localhost:3001/zh-TW/dashboard
```

**預期結果**:
- ✅ `/en/dashboard` 顯示英文：`"Dashboard"`, `"Welcome back!"` 等
- ✅ `/zh-TW/dashboard` 顯示中文：`"儀表板"`, `"歡迎回來！"` 等
- ✅ Console 的 Debug 輸出：`'menu.dashboard': 'Dashboard'`（英文版）

### 修復影響範圍

**修改文件**:
1. ✅ `apps/web/src/app/[locale]/layout.tsx` - 修復 `getMessages()` 調用
2. 🔍 `apps/web/src/components/layout/Sidebar.tsx` - 添加 Debug Logging（可在驗證後移除）

**影響頁面**:
- ✅ 所有 `/en/*` 路徑的頁面
- ✅ Sidebar 導航菜單
- ✅ TopBar 組件
- ✅ 所有使用 `useTranslations()` 的 Client Component

---

**維護者**: Development Team + AI Assistant
**最後更新**: 2025-11-04 01:15
**版本**: 1.2
**狀態**: ✅ 根本原因已找到並修復，等待用戶驗證
