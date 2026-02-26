# FIX-097: href 模板字符串語法錯誤

> **建立日期**: 2025-12-17
> **狀態**: ✅ 已完成
> **優先級**: Medium
> **類型**: UI / 導航

---

## 1. 問題描述

### 1.1 問題現象
在 Project Edit 頁面的麵包屑導航中，點擊專案名稱連結時：
- URL 變成 `/projects/$%7BprojectId%7D` (即 `${projectId}` 的 URL 編碼)
- 頁面顯示錯誤，API 返回 400 Bad Request
- 錯誤訊息：`Invalid uuid`

### 1.2 影響範圍
- `apps/web/src/app/[locale]/projects/[id]/edit/page.tsx` - 專案編輯頁面麵包屑
- `apps/web/src/app/[locale]/proposals/[id]/page.tsx` - 提案詳情頁面連結

---

## 2. 根本原因分析

### 2.1 問題根源
使用了普通字符串（雙引號）而不是模板字符串（反引號）來構建動態 href：

```typescript
// 錯誤：使用普通字符串，${projectId} 被當作字面字符串
<Link href="/projects/${projectId}">

// 正確：使用模板字符串（反引號），${projectId} 被替換為實際值
<Link href={`/projects/${projectId}`}>
```

---

## 3. 解決方案

### 3.1 修改文件清單

| 文件 | 行號 | 變更 |
|------|------|------|
| `apps/web/src/app/[locale]/projects/[id]/edit/page.tsx` | 197 | 改用模板字符串 |
| `apps/web/src/app/[locale]/proposals/[id]/page.tsx` | 442 | 改用模板字符串 |

### 3.2 具體修改內容

#### projects/[id]/edit/page.tsx
```diff
- <Link href="/projects/${projectId}">{project.name}</Link>
+ <Link href={`/projects/${projectId}`}>{project.name}</Link>
```

#### proposals/[id]/page.tsx
```diff
- <Link href="/budget-pools/${proposal.project.budgetPool.id}">
+ <Link href={`/budget-pools/${proposal.project.budgetPool.id}`}>
```

---

## 4. 測試驗證

- [x] Project Edit 頁面麵包屑導航正確跳轉
- [x] Proposal 詳情頁面的 Budget Pool 連結正確跳轉

---

## 5. 實施狀態

- [x] 問題識別 ✅ 2025-12-17
- [x] 代碼修復 ✅ 2025-12-17
- [x] 本地測試通過 ✅ 2025-12-17
- [ ] 代碼提交

---

**最後更新**: 2025-12-17
**負責人**: AI Assistant
