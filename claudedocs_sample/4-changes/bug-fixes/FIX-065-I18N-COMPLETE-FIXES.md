# FIX-065: I18N 完整修復報告

**修復日期**: 2025-11-05
**問題類型**: 翻譯鍵缺失、變數名稱不匹配、大小寫警告、路由問題
**影響範圍**: 10+ 頁面（Projects, Proposals, Budget Pools 等）
**修復狀態**: ✅ 完成

---

## 🎯 問題總覽

根據用戶的完整測試報告，發現以下四大類問題：

### 1. 翻譯鍵缺失 (MISSING_MESSAGE)
- 影響 10+ 頁面
- 缺少 20+ 翻譯鍵
- 涉及 proposals, projects, budgetPools, common, navigation 等命名空間

### 2. 變數名稱不匹配 (FORMATTING_ERROR)
- Budget Pools 分頁顯示使用 `{from}`, `{to}` 但代碼傳遞 `start`, `end`
- 導致格式化失敗

### 3. Input.tsx 大小寫警告
- 實際檔案名稱：`Input.tsx`（大寫 I）
- 導入語句使用：`'@/components/ui/input'`（小寫 i）
- 影響 17 個檔案
- Windows 環境下產生 Webpack 警告

### 4. Breadcrumb 路由缺少 locale 前綴
- Proposals 詳情頁面麵包屑點擊後導航到 `/proposals`
- 正確應為 `/zh-TW/proposals` 或 `/en/proposals`
- 導致語言環境丟失

---

## 🔧 修復內容

### 修復 1: 新增所有缺失的翻譯鍵

#### en.json 和 zh-TW.json 新增鍵統計

| 命名空間 | 新增鍵數量 | 具體鍵名 |
|---------|----------|---------|
| **navigation** | 1 | home |
| **common.actions** | 3 | cancel, exportCSV, back |
| **common.fields** | 3 | createdAt, updatedAt, actions |
| **proposals** | 12 | description, summary.total, fields.title/projectName/manager/supervisor/budgetPool, detail.project.title, detail.history.title, actions.create/requestInfo/title, status.rejectedMessage |
| **projects.detail** | 1 | loading |
| **budgetPools.fields** | 2 | fiscalYear, totalBudget |
| **budgetPools.detail** | 1 | fiscalYearLabel |
| **budgetPools.actions** | 2 | edit, delete |
| **budgetPools.form.edit** | 2 | title, subtitle |
| **總計** | **27 個新翻譯鍵** | - |

#### 修改的檔案
- `apps/web/src/messages/en.json`
- `apps/web/src/messages/zh-TW.json`

#### 關鍵翻譯鍵示例

**navigation.home** (line 84):
```json
// en.json
"navigation": {
  "home": "Home",
  "dashboard": "Home"
}

// zh-TW.json
"navigation": {
  "home": "首頁",
  "dashboard": "首頁"
}
```

**common.actions** 擴展 (lines 5-9):
```json
// en.json
"common": {
  "actions": {
    "actions": "Actions",
    "view": "View",
    "edit": "Edit",
    "back": "Back",
    "cancel": "Cancel",
    "exportCSV": "Export CSV"
  }
}

// zh-TW.json
"common": {
  "actions": {
    "actions": "操作",
    "view": "查看",
    "edit": "編輯",
    "back": "返回",
    "cancel": "取消",
    "exportCSV": "匯出 CSV"
  }
}
```

**proposals 完整擴展**:
```json
// en.json (lines 429-488)
"proposals": {
  "title": "Budget Proposals",
  "description": "Manage budget proposals and approval workflow",
  "summary": {
    "total": "Total Proposals"
  },
  "fields": {
    "title": "Title",
    "projectName": "Project Name",
    "manager": "Project Manager",
    "supervisor": "Supervisor",
    "budgetPool": "Budget Pool",
    // ... 其他欄位
  },
  "detail": {
    "project": {
      "title": "Project Information"
    },
    "history": {
      "title": "Approval History"
    },
    // ... 其他詳情
  },
  "actions": {
    "create": "Create Proposal",
    "requestInfo": "Request More Information",
    "title": "Actions"
  },
  "status": {
    "rejectedMessage": "This proposal has been rejected"
  }
}

// zh-TW.json 相應的繁體中文翻譯
```

**budgetPools 完整擴展**:
```json
// en.json (lines 565-667)
"budgetPools": {
  "fields": {
    "fiscalYear": "Fiscal Year",
    "totalBudget": "Total Budget"
  },
  "list": {
    "showing": "Showing {start} - {end} / {total} budget pools"  // 修復變數名
  },
  "detail": {
    "fiscalYearLabel": "Fiscal Year"
  },
  "actions": {
    "edit": "Edit Budget Pool",
    "delete": "Delete Budget Pool"
  },
  "form": {
    "edit": {
      "title": "Edit Budget Pool",
      "subtitle": "Update budget pool information"
    }
  }
}

// zh-TW.json 相應的繁體中文翻譯
```

---

### 修復 2: 修正 Budget Pools 分頁變數名稱

**問題代碼** (apps/web/src/app/[locale]/budget-pools/page.tsx):
```typescript
{t('budgetPools.list.showing', {
  start: (page - 1) * limit + 1,
  end: Math.min(page * limit, total),
  total: total
})}
```

**原翻譯鍵**（錯誤）:
```json
// zh-TW.json
"showing": "顯示 {from} - {to} / {total} 個預算池"
```
使用 `{from}`, `{to}` 但代碼傳遞 `start`, `end` → FORMATTING_ERROR

**修復後翻譯鍵**（正確）:
```json
// en.json (line 589)
"showing": "Showing {start} - {end} / {total} budget pools"

// zh-TW.json (line 640)
"showing": "顯示 {start} - {end} / {total} 個預算池"
```

**修復位置**:
- `apps/web/src/messages/en.json` line 589
- `apps/web/src/messages/zh-TW.json` line 640

---

### 修復 3: Input.tsx 大小寫統一

**問題**:
- 實際檔案：`apps/web/src/components/ui/Input.tsx`（大寫 I）
- 導入語句：`'@/components/ui/input'`（小寫 i）
- Windows 環境警告：`There are multiple modules with names that only differ in casing`

**修復策略**: 將所有導入語句統一改為大寫 `Input`

**修改的 17 個檔案**:

| 檔案路徑 | 原導入 | 修復後 |
|---------|--------|--------|
| `apps/web/src/components/charge-out/ChargeOutForm.tsx:24` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/components/layout/TopBar.tsx:19` | `"@/components/ui/input"` | `"@/components/ui/Input"` |
| `apps/web/src/components/proposal/ProposalMeetingNotes.tsx:16` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/components/expense/ExpenseForm.tsx:24` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/components/quote/QuoteUploadForm.tsx:20` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/components/purchase-order/PurchaseOrderForm.tsx:24` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/budget-pools/page.tsx:8` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/vendors/page.tsx:19` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/settings/page.tsx:22` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/login/page.tsx:21` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/forgot-password/page.tsx:18` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/projects/page.tsx:34` | `"@/components/ui/input"` | `"@/components/ui/Input"` |
| `apps/web/src/app/[locale]/quotes/new/page.tsx:30` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/proposals/[id]/page.tsx:30` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/register/page.tsx:18` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/quotes/[id]/edit/page.tsx:31` | `'@/components/ui/input'` | `'@/components/ui/Input'` |
| `apps/web/src/app/[locale]/purchase-orders/page.tsx:20` | `'@/components/ui/input'` | `'@/components/ui/Input'` |

**修復方法**: 使用 surgical-task-executor agent 批量處理所有檔案

**預期結果**:
- ✅ 消除 Webpack 警告
- ✅ 確保模組導入大小寫與檔案系統一致
- ✅ 提升 Windows 開發環境穩定性

---

### 修復 4: Proposals 詳情頁 Breadcrumb 路由

**問題頁面**: `apps/web/src/app/[locale]/proposals/[id]/page.tsx`

**問題**: 所有硬編碼路徑缺少 locale 前綴
```typescript
// ❌ 錯誤
<BreadcrumbLink href="/dashboard">
<BreadcrumbLink href="/proposals">
<Link href="/proposals">
<Link href={`/projects/${proposal.project.id}`}>
<Link href={`/proposals/${proposal.id}/edit`}>
<Link href={`/budget-pools/${proposal.project.budgetPool.id}`}>
```

**修復策略**:
1. 從 `useParams()` 獲取當前 locale
2. 在所有 href 中添加 locale 前綴

**具體修改**:

1. **獲取 locale** (line 41):
```typescript
const params = useParams();
const id = params.id as string;
const locale = params.locale as string;  // 新增
```

2. **Breadcrumb 修復** (3 處):
```typescript
// Loading state (lines 113, 117)
<BreadcrumbLink href={`/${locale}/dashboard`}>{tNav('dashboard')}</BreadcrumbLink>
<BreadcrumbLink href={`/${locale}/proposals`}>{t('title')}</BreadcrumbLink>

// Error state (lines 113, 117)
<BreadcrumbLink href={`/${locale}/dashboard`}>{tNav('dashboard')}</BreadcrumbLink>
<BreadcrumbLink href={`/${locale}/proposals`}>{t('title')}</BreadcrumbLink>

// Main content (lines 154, 158)
<BreadcrumbLink href={`/${locale}/dashboard`}>{tNav('dashboard')}</BreadcrumbLink>
<BreadcrumbLink href={`/${locale}/proposals`}>{t('title')}</BreadcrumbLink>
```

3. **頁面內連結修復** (5 處):
```typescript
// 專案連結 (line 179)
<Link href={`/${locale}/projects/${proposal.project.id}`}>

// 編輯按鈕 (line 188)
<Link href={`/${locale}/proposals/${proposal.id}/edit`}>

// 返回按鈕 (line 192)
<Link href={`/${locale}/proposals`}>

// 錯誤狀態返回 (line 135)
<Link href={`/${locale}/proposals`}>

// Tab 內專案連結 (line 286)
<Link href={`/${locale}/projects/${proposal.project.id}`}>

// Tab 內預算池連結 (line 319)
<Link href={`/${locale}/budget-pools/${proposal.project.budgetPool.id}`}>
```

**修復檔案**: `apps/web/src/app/[locale]/proposals/[id]/page.tsx`

**修復的連結數量**: 11 個

**預期結果**:
- ✅ 麵包屑導航保持語言環境
- ✅ 所有頁面內連結保持 locale 前綴
- ✅ 用戶在中文/英文環境下導航時不會切換語言

---

## 📊 修復統計

### 整體統計

| 項目 | 數量 |
|------|------|
| 新增翻譯鍵 (en.json) | 27 |
| 新增翻譯鍵 (zh-TW.json) | 27 |
| 修復變數名稱 | 2 (from→start, to→end) |
| 修復導入大小寫 | 17 個檔案 |
| 修復路由 locale 前綴 | 11 個連結 |
| 修改檔案總數 | 20 |
| 影響頁面 | 10+ |

### 修改的檔案列表

#### 翻譯檔案 (2)
- `apps/web/src/messages/en.json`
- `apps/web/src/messages/zh-TW.json`

#### 組件檔案 (6)
- `apps/web/src/components/charge-out/ChargeOutForm.tsx`
- `apps/web/src/components/layout/TopBar.tsx`
- `apps/web/src/components/proposal/ProposalMeetingNotes.tsx`
- `apps/web/src/components/expense/ExpenseForm.tsx`
- `apps/web/src/components/quote/QuoteUploadForm.tsx`
- `apps/web/src/components/purchase-order/PurchaseOrderForm.tsx`

#### 頁面檔案 (12)
- `apps/web/src/app/[locale]/budget-pools/page.tsx`
- `apps/web/src/app/[locale]/vendors/page.tsx`
- `apps/web/src/app/[locale]/settings/page.tsx`
- `apps/web/src/app/[locale]/login/page.tsx`
- `apps/web/src/app/[locale]/forgot-password/page.tsx`
- `apps/web/src/app/[locale]/projects/page.tsx`
- `apps/web/src/app/[locale]/quotes/new/page.tsx`
- `apps/web/src/app/[locale]/proposals/[id]/page.tsx`
- `apps/web/src/app/[locale]/register/page.tsx`
- `apps/web/src/app/[locale]/quotes/[id]/edit/page.tsx`
- `apps/web/src/app/[locale]/purchase-orders/page.tsx`

---

## ✅ 修復驗證

### 驗證步驟

請按以下步驟驗證所有修復：

#### 1. 清除快取（重要！）

**方法 A: 使用無痕模式（推薦）**
```bash
Chrome: Ctrl+Shift+N
Edge: Ctrl+Shift+P
```

**方法 B: 清除瀏覽器快取**
1. F12 開啟開發者工具
2. Application → Storage → Clear site data
3. 重新整理頁面（Ctrl+F5）

#### 2. 測試頁面清單

| 頁面 | URL | 驗證項目 |
|------|-----|---------|
| **Projects 列表** | `/zh-TW/projects` | ✅ 無 Input.tsx 警告 |
| **Projects 列表** | `/en/projects` | ✅ 無 Input.tsx 警告 |
| **Proposals 列表** | `/en/proposals` | ✅ 所有欄位顯示英文<br>✅ "Create Proposal" 按鈕<br>✅ F12 無 MISSING_MESSAGE |
| **Proposals 詳情** | `/en/proposals/[id]` | ✅ 所有欄位顯示英文<br>✅ "Approval History"<br>✅ "Project Information"<br>✅ F12 無 MISSING_MESSAGE |
| **Proposals 詳情** | `/zh-TW/proposals/[id]` | ✅ 麵包屑點擊保持 `/zh-TW/proposals`<br>✅ 所有連結包含 locale<br>✅ F12 無錯誤 |
| **Projects 詳情** | `/en/projects/[id]` | ✅ "Loading project details..."<br>✅ F12 無 MISSING_MESSAGE |
| **Projects 編輯** | `/en/projects/[id]/edit` | ✅ "Cancel" 按鈕<br>✅ 無 Input.tsx 警告 |
| **Budget Pools 列表** | `/zh-TW/budget-pools` | ✅ "顯示 1 - 10 / 50 個預算池"<br>✅ 無 FORMATTING_ERROR<br>✅ "首頁" 顯示<br>✅ "匯出 CSV" 按鈕 |
| **Budget Pools 詳情** | `/zh-TW/budget-pools/[id]` | ✅ "財政年度" 顯示<br>✅ "編輯預算池" 按鈕 |
| **Budget Pools 編輯** | `/zh-TW/budget-pools/[id]/edit` | ✅ "編輯預算池"<br>✅ "更新預算池資訊"<br>✅ 無 Input.tsx 警告 |

#### 3. Console 檢查

所有頁面應該：
- ✅ 無 `MISSING_MESSAGE` 錯誤
- ✅ 無 `FORMATTING_ERROR` 錯誤
- ✅ 無 `INVALID_KEY` 錯誤
- ✅ 無 Input.tsx 大小寫警告

#### 4. 功能測試

- ✅ 語言切換正常工作（zh-TW ↔ en）
- ✅ 麵包屑導航保持正確 locale
- ✅ 所有頁面內連結保持語言環境
- ✅ 分頁顯示正確數字
- ✅ 表單按鈕顯示正確文字

---

## 🔍 技術細節

### next-intl 翻譯鍵命名規範

```
{namespace}.{category}.{subcategory}.{key}

範例:
- common.actions.view              (通用操作: 查看)
- common.fields.createdAt          (通用欄位: 創建時間)
- proposals.actions.create         (提案操作: 新增)
- proposals.detail.tabs.basic      (提案詳情標籤: 基本資訊)
- proposals.detail.history.title   (提案詳情審批歷史: 標題)
- budgetPools.form.edit.title      (預算池表單編輯: 標題)
```

**重要規則**:
- ✅ 使用 camelCase 命名鍵
- ✅ 使用 `.` 表示命名空間嵌套
- ❌ 不要在鍵名本身使用 `.`（例如：`rejected.message` 應改為 `rejectedMessage`）

### 變數插值規範

翻譯字串中的變數名必須與代碼傳遞的變數名完全匹配：

```typescript
// ✅ 正確
// 代碼
t('budgetPools.list.showing', { start: 1, end: 10, total: 50 })

// 翻譯
"showing": "Showing {start} - {end} / {total} budget pools"

// ❌ 錯誤
// 代碼
t('budgetPools.list.showing', { start: 1, end: 10, total: 50 })

// 翻譯（變數名不匹配）
"showing": "Showing {from} - {to} / {total} budget pools"
```

### locale 路由規範

使用 `next-intl` 的 `Link` 組件會自動添加 locale 前綴，但 UI 組件（如 Breadcrumb）不會：

```typescript
// ✅ 自動添加 locale（來自 @/i18n/routing）
import { Link } from '@/i18n/routing';
<Link href="/proposals">  // 自動變成 /zh-TW/proposals 或 /en/proposals

// ❌ 不會自動添加 locale（原生 HTML）
import { BreadcrumbLink } from '@/components/ui/breadcrumb';
<BreadcrumbLink href="/proposals">  // 保持 /proposals，缺少 locale

// ✅ 手動添加 locale
const locale = useParams().locale as string;
<BreadcrumbLink href={`/${locale}/proposals`}>  // 正確添加 locale
```

### Windows 檔案系統大小寫

Windows 檔案系統不區分大小寫，但 Webpack 會警告：

```typescript
// 實際檔案: Input.tsx
// ❌ 警告: 導入路徑小寫
import { Input } from '@/components/ui/input';

// ✅ 正確: 導入路徑大寫匹配檔案名
import { Input } from '@/components/ui/Input';
```

---

## 🎬 用戶操作指引

### 第一步：重啟開發伺服器（可選）

如果開發伺服器正在運行，建議重啟以確保所有變更生效：

```bash
# 停止開發伺服器（Ctrl+C）
# 重新啟動
pnpm dev
```

### 第二步：清除瀏覽器快取（必須）

**重要**: 由於 Next.js 和瀏覽器快取，即使代碼已修復，您可能仍會看到舊的錯誤。請務必清除快取：

1. **開啟無痕模式**（推薦）
   - Chrome: `Ctrl+Shift+N`
   - Edge: `Ctrl+Shift+P`

2. **或清除站點快取**
   - F12 開啟開發者工具
   - Application → Storage → Clear site data
   - 重新整理頁面（`Ctrl+F5`）

### 第三步：系統化測試

按照上述「修復驗證」章節的測試清單進行系統化測試。

### 第四步：報告結果

如果仍有問題，請提供：
1. 頁面 URL
2. F12 Console 完整錯誤訊息
3. 瀏覽器和版本
4. 是否清除了快取

---

## 🐛 已知限制

### 1. 其他頁面的 Breadcrumb
目前只修復了 **Proposals 詳情頁** 的 Breadcrumb locale 問題。如果其他頁面也有類似問題（例如 Projects 詳情、Budget Pools 詳情等），需要套用相同的修復方法。

### 2. 數據內容不翻譯
根據用戶強調："多語言轉換的概念是平台上的既定文字信息, 而不是那些數據"

**翻譯範圍**:
- ✅ UI 標籤和按鈕
- ✅ 表格標題
- ✅ 表單欄位名稱
- ✅ 系統訊息
- ✅ 麵包屑和導航

**不翻譯範圍**:
- ❌ 專案名稱
- ❌ 使用者姓名
- ❌ 評論內容
- ❌ 提案標題
- ❌ 任何用戶輸入的數據

### 3. 日期格式
目前日期格式硬編碼為 `zh-TW`：
```typescript
{new Date(proposal.createdAt).toLocaleString('zh-TW')}
```

建議改為根據 locale 動態調整：
```typescript
{new Date(proposal.createdAt).toLocaleString(locale)}
```

---

## 📋 後續建議

### 1. 全面檢查 Breadcrumb 路由
建議對所有包含 Breadcrumb 的頁面進行系統化檢查，確保所有連結都包含 locale 前綴。

可搜尋的檔案：
```bash
# 搜尋所有使用 BreadcrumbLink 的頁面
grep -r "BreadcrumbLink" apps/web/src/app
```

### 2. 建立路由輔助函數
為避免手動添加 locale 前綴的重複工作，建議建立輔助函數：

```typescript
// lib/i18n-helpers.ts
export function getLocalizedPath(locale: string, path: string) {
  return `/${locale}${path.startsWith('/') ? path : `/${path}`}`;
}

// 使用
<BreadcrumbLink href={getLocalizedPath(locale, '/proposals')}>
```

### 3. 日期格式國際化
建立統一的日期格式化函數：

```typescript
// lib/date-helpers.ts
export function formatDate(date: Date, locale: string) {
  return date.toLocaleString(locale === 'zh-TW' ? 'zh-TW' : 'en-US');
}

// 使用
{formatDate(new Date(proposal.createdAt), locale)}
```

### 4. 翻譯鍵命名一致性
建議建立翻譯鍵命名規範文檔，確保團隊一致性：

- 使用 camelCase
- 遵循 `{namespace}.{category}.{key}` 結構
- 避免在鍵名中使用 `.`
- 變數名使用描述性名稱（`start`/`end` 而不是 `from`/`to`）

### 5. 自動化測試
建議添加 E2E 測試來驗證 I18N 功能：

```typescript
// tests/e2e/i18n.spec.ts
test('proposals breadcrumb should keep locale', async ({ page }) => {
  await page.goto('/zh-TW/proposals/123');
  await page.click('a:has-text("預算提案")');
  expect(page.url()).toContain('/zh-TW/proposals');
});

test('all pages should have no MISSING_MESSAGE errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.text().includes('MISSING_MESSAGE')) {
      errors.push(msg.text());
    }
  });

  await page.goto('/zh-TW/proposals');
  await page.goto('/en/proposals');

  expect(errors).toHaveLength(0);
});
```

---

## 🎯 結論

所有用戶報告的 I18N 問題已完成修復：

- ✅ **翻譯鍵缺失**: 新增 27 個翻譯鍵（en + zh-TW）
- ✅ **變數名稱不匹配**: 修復 Budget Pools 分頁變數 from/to → start/end
- ✅ **Input.tsx 大小寫**: 統一 17 個檔案的導入路徑
- ✅ **Breadcrumb locale 路由**: 修復 Proposals 詳情頁 11 個連結

**修改檔案**: 20 個
**影響頁面**: 10+
**新增翻譯鍵**: 54 個（27 個 × 2 語言）

**下一步**:
1. 清除瀏覽器快取（必須）
2. 按照測試清單驗證所有頁面
3. 檢查 F12 Console 確認無錯誤
4. 測試語言切換和麵包屑導航

如有任何問題，請提供詳細的錯誤訊息和測試環境資訊。

---

**修復完成日期**: 2025-11-05
**相關修復**: FIX-062, FIX-063, FIX-064
**文檔版本**: 1.0
**修復負責人**: Claude (AI Assistant)
