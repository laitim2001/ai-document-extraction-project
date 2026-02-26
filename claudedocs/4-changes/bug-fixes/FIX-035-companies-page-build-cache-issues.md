# FIX-035: Companies 頁面構建快取與 Locale 問題

> **建立日期**: 2026-01-28
> **發現方式**: Playwright E2E 手動測試
> **影響頁面**: `/[locale]/companies`, `/[locale]/companies/[id]`
> **優先級**: 中
> **狀態**: ✅ 已完成（BUG-2 代碼修復 commit: `65f2199`；BUG-1/3 為快取問題，清除 .next 解決）

---

## 問題描述

Companies 頁面在開發環境下存在 3 項問題，主要源自 `.next` build cache 損壞及 locale 快取不一致。

**涉及 3 個子問題**：

| # | 問題 | 嚴重度 | 影響頁面 |
|---|------|--------|----------|
| BUG-1 | Runtime Error: Cannot find module react-hook-form | 高 | `/companies/[id]` |
| BUG-2 | 英文 locale 路由顯示中文內容 | 中 | `/en/companies` |
| BUG-3 | companies/page.js chunk 404 | 高 | `/companies` |

---

## 重現步驟

### BUG-1: react-hook-form vendor chunk 缺失
1. 啟動開發服務器 (`npm run dev`)
2. 導航至 `/en/companies/{company-id}`（公司詳情頁）
3. 頁面顯示 Runtime Error：`Cannot find module 'react-hook-form'`
4. Console 報告 vendor chunk 載入失敗

### BUG-2: 英文頁面顯示中文
1. 導航至 `/en/companies`
2. 頁面 URL 為 `/en/` 但 UI 內容為中文
3. 切換語言後問題仍存在

### BUG-3: page.js chunk 404
1. 導航至 `/en/companies`
2. 開發者工具 Network 面板顯示 `companies/page.js` 返回 404
3. 頁面無法正常載入

---

## 根本原因

### BUG-1 & BUG-3: `.next` build cache 損壞

開發過程中頻繁切換分支或熱重載失敗，導致 `.next` 目錄中的 webpack chunk 索引與實際編譯產物不一致：
- Vendor chunk（包含 `react-hook-form`）的 hash 已更新，但舊的 chunk manifest 仍指向不存在的檔案
- `companies/page.js` chunk 同理，manifest 引用了已被清除的編譯產物

### BUG-2: Locale 偵測/Cookie 快取

- `NEXT_LOCALE` cookie 可能快取了之前的 locale 設定（`zh-TW`）
- 即使 URL path 為 `/en/`，middleware 的 locale 解析可能從 cookie 讀取到 `zh-TW`
- 導致 server-side 使用中文翻譯渲染頁面

---

## 解決方案

### BUG-1 & BUG-3 修復：清除 `.next` 快取並重建

```bash
# Windows PowerShell
Remove-Item -Recurse -Force .next
npm run dev

# 或使用 cmd
rmdir /s /q .next
npm run dev
```

這將強制 Next.js 重新編譯所有頁面和 vendor chunk，解決 manifest 不一致問題。

### BUG-2 修復：清除 Locale Cookie + 重建

1. 清除瀏覽器中的 `NEXT_LOCALE` cookie
2. 清除 `.next` 快取後重啟開發服務器
3. 若問題持續，檢查 `src/middleware.ts` 中的 locale 偵測邏輯：
   - 確認 URL path locale 優先級高於 cookie
   - 確認 `next-intl` middleware 正確解析 `[locale]` segment

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `.next/` (目錄) | 清除並重建 |
| 瀏覽器 Cookie | 清除 `NEXT_LOCALE` |
| `src/middleware.ts` | 若 locale 優先級有誤則需修正（待確認） |

---

## 測試驗證

修復完成後需驗證：

- [ ] `/en/companies` 頁面正常載入，無 404 chunk 錯誤
- [ ] `/en/companies/{id}` 頁面正常載入，react-hook-form 可用
- [ ] `/en/companies` 顯示英文內容，`/zh-TW/companies` 顯示繁中內容
- [ ] 語言切換後內容正確更新
- [ ] 開發服務器重啟後問題不再復現

---

*文件建立日期: 2026-01-28*
*最後更新: 2026-01-28*
