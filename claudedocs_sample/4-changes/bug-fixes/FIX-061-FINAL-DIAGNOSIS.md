# FIX-061 最終診斷與解決方案

## 問題根源分析

經過深入診斷，我發現了真正的問題：

### 1. 翻譯文件修改正確 ✅
- `apps/web/src/messages/zh-TW.json` - 所有翻譯鍵已正確添加
- `apps/web/src/messages/en.json` - 所有英文翻譯已正確添加

驗證：
```bash
# projects.fields 存在於 line 407-417
# proposals.status 存在於 line 421-426
# budgetPools.fields 存在於 line 527-530
# vendors.fields 存在於 line 618-621
```

### 2. 程式碼修復遺漏 ❌

**已完成的修復**：
- ✅ Projects Detail: `getProjectStatusConfig` 函數已創建
- ✅ Expenses: `getExpenseStatusConfig` 函數已移入組件內部

**遺漏的修復**（剛剛完成）：
- ✅ Projects Detail: `getProposalStatusConfig` 函數已創建（line 111-117）
- ✅ Projects Detail: 已替換 line 416-418 的 `PROPOSAL_STATUS_CONFIG` 使用

### 3. Source Map 不同步問題 ⚠️

**關鍵發現**：
- 瀏覽器報錯顯示 line 219 有 `PROJECT_STATUS_CONFIG`
- 實際文件 line 219 是麵包屑導航
- 這表示瀏覽器使用的是舊的編譯版本和 Source Map

**原因**：
1. `.next` 目錄的編譯快取與源碼不同步
2. 瀏覽器的 Service Worker 或 HTTP 快取保留了舊版本
3. Hot Module Replacement (HMR) 沒有正確更新所有模組

## 完整修復清單

### 文件修改記錄

#### `apps/web/src/messages/zh-TW.json`
- Lines 407-417: 添加 `projects.fields.*` (9 個鍵)
- Lines 421-426: 添加 `proposals.status.*` (5 個鍵)
- Lines 428-434: 添加 `proposals.fields.*` (5 個鍵)
- Lines 527-530: 添加 `budgetPools.fields.*` (2 個鍵)
- Line 548: 添加 `budgetPools.list.table.categoryCount`
- Lines 618-621: 添加 `vendors.fields.*` (2 個鍵)

#### `apps/web/src/messages/en.json`
- Lines 363-373: 添加 `projects.fields.*` (英文版)
- Lines 377-383: 添加 `proposals.status.*` (英文版)
- Lines 384-390: 添加 `proposals.fields.*` (英文版)
- Lines 483-486: 添加 `budgetPools.fields.*` (英文版)
- Line 504: 添加 `budgetPools.list.table.categoryCount` (英文版)
- Lines 574-577: 添加 `vendors.fields.*` (英文版)

#### `apps/web/src/app/[locale]/projects/[id]/page.tsx`
- Lines 61-74: 創建 `getProjectStatusConfig` 函數
- Lines 234-236: 替換 `PROJECT_STATUS_CONFIG` 使用
- Lines 111-117: 創建 `getProposalStatusConfig` 函數
- Lines 416-418: 替換 `PROPOSAL_STATUS_CONFIG` 使用

#### `apps/web/src/app/[locale]/expenses/page.tsx`
- Lines 37-52: 將 `getExpenseStatusConfig` 移入組件內部
- Line 38: 添加 "FIX-061" 註解標記
- Lines 447-448: 移除 `t` 參數傳遞

## 徹底解決方案

### 步驟 1: 確認所有修復已應用 ✅

所有程式碼和翻譯文件的修復已完成。

### 步驟 2: 徹底清除所有快取

```powershell
# 1. 停止開發伺服器 (在運行 pnpm dev 的終端按 Ctrl+C)

# 2. 清除 Next.js 編譯快取
Remove-Item -Path "apps/web/.next" -Recurse -Force

# 3. 清除 Turborepo 快取
Remove-Item -Path ".turbo" -Recurse -Force

# 4. 清除 TypeScript 快取（如果存在）
Remove-Item -Path "apps/web/.tsbuildinfo" -Recurse -Force -ErrorAction SilentlyContinue

# 5. (可選) 如果問題仍存在，清除 node_modules 並重新安裝
# Remove-Item -Path "node_modules" -Recurse -Force
# Remove-Item -Path "apps/web/node_modules" -Recurse -Force
# pnpm install
```

### 步驟 3: 重啟開發伺服器

```powershell
pnpm dev
```

等待 "✓ Ready" 訊息（可能需要 30-60 秒）。

### 步驟 4: 徹底清除瀏覽器快取

**方法 A: 使用開發者工具**
1. 打開開發者工具 (F12)
2. 右鍵點擊瀏覽器刷新按鈕
3. 選擇 "清空快取並硬性重新載入"

**方法 B: 使用無痕模式**
1. 開啟無痕視窗 (Ctrl+Shift+N)
2. 訪問測試頁面
3. 這樣可以避免所有快取干擾

**方法 C: 手動清除快取**
1. 開發者工具 (F12) → Application 標籤
2. 左側 "Storage" → "Clear site data"
3. 勾選所有選項 → "Clear site data"
4. 重新載入頁面

### 步驟 5: 測試所有頁面

使用 **Ctrl+Shift+R** 硬重載每個頁面：

1. ✅ http://localhost:3001/zh-TW/projects
   - 預期：所有欄位顯示中文
   - 預期：無 `MISSING_MESSAGE` 錯誤

2. ✅ http://localhost:3001/zh-TW/proposals
   - 預期：狀態顯示中文
   - 預期：無 `MISSING_MESSAGE` 錯誤

3. ✅ http://localhost:3001/zh-TW/budget-pools
   - 預期：類別計數顯示中文
   - 預期：無 `MISSING_MESSAGE` 錯誤

4. ✅ http://localhost:3001/zh-TW/vendors
   - 預期：報價單數和採購單數顯示中文
   - 預期：無 `MISSING_MESSAGE` 錯誤

5. ✅ http://localhost:3001/zh-TW/projects/d4ba5d69-cb32-4321-a39e-23b680d7d205
   - 預期：專案狀態 Badge 正常顯示
   - 預期：提案狀態 Badge 正常顯示
   - 預期：無 `PROJECT_STATUS_CONFIG` 錯誤
   - 預期：無 `PROPOSAL_STATUS_CONFIG` 錯誤

6. ✅ http://localhost:3001/zh-TW/expenses
   - 預期：費用狀態正常顯示
   - 預期：無 `t is not a function` 錯誤

7. ✅ http://localhost:3001/zh-TW/quotes
   - 測試：點擊報價單 → 跳轉到 `/projects/[id]/quotes`
   - 測試：返回專案詳情頁
   - 預期：無錯誤

## 為什麼第一次修復沒有生效？

### 原因分析

1. **Next.js 快取機制複雜**：
   - Server Components 快取
   - Static Generation 快取
   - Incremental Static Regeneration 快取
   - Webpack 編譯快取

2. **Hot Module Replacement 限制**：
   - 翻譯文件變更可能不觸發完整重新編譯
   - Source Map 可能不會立即更新
   - 某些模組可能被 HMR 忽略

3. **瀏覽器快取層級**：
   - Memory Cache (最快)
   - Service Worker Cache
   - HTTP Disk Cache
   - Compiled JavaScript 快取

4. **遺漏的程式碼修復**：
   - `PROPOSAL_STATUS_CONFIG` 沒有被修復
   - 導致 Projects Detail 頁面仍然崩潰

## 技術債務與改進建議

### 短期改進

1. **開發時的最佳實踐**：
   ```powershell
   # 修改翻譯文件後，總是清除快取並重啟
   Remove-Item -Path "apps/web/.next" -Recurse -Force
   pnpm dev
   ```

2. **使用無痕模式測試**：
   - 避免快取干擾
   - 確保測試的是最新版本

3. **監視文件變更**（可選）：
   ```javascript
   // next.config.js
   module.exports = {
     webpack: (config, { dev, isServer }) => {
       if (dev && !isServer) {
         config.watchOptions = {
           ...config.watchOptions,
           ignored: /node_modules/,
           poll: 1000, // 每秒檢查一次
         };
       }
       return config;
     },
   };
   ```

### 長期改進

1. **統一翻譯結構**：
   - 為所有實體添加 `fields` 區段
   - 為所有狀態機添加 `status` 區段
   - 建立翻譯鍵命名規範文檔

2. **改進 CI/CD**：
   - 添加翻譯鍵完整性檢查
   - 自動化測試翻譯覆蓋率
   - Pre-commit hook 驗證翻譯文件格式

3. **文檔化**：
   - 建立 i18n 開發指南
   - 記錄常見陷阱和解決方案
   - 維護翻譯鍵索引

## 後續驗證步驟

### 1. 功能驗證
- [ ] 所有頁面中文顯示正常
- [ ] 所有頁面無 console 錯誤
- [ ] 所有頁面無 runtime 錯誤
- [ ] 英文/中文切換正常

### 2. 效能驗證
- [ ] 頁面載入速度正常
- [ ] 無明顯效能退化
- [ ] Source Map 正確對應

### 3. 回歸測試
- [ ] 既有功能未受影響
- [ ] 狀態 Badge 顯示正確
- [ ] 表單驗證正常

## 最終檢查清單

執行以下命令確認所有修復：

```powershell
# 1. 確認翻譯文件正確
Select-String -Pattern "projects.fields.supervisor" apps/web/src/messages/zh-TW.json
Select-String -Pattern "proposals.status.pendingApproval" apps/web/src/messages/zh-TW.json

# 2. 確認程式碼修復
Select-String -Pattern "getProjectStatusConfig" apps/web/src/app/[locale]/projects/[id]/page.tsx
Select-String -Pattern "getProposalStatusConfig" apps/web/src/app/[locale]/projects/[id]/page.tsx
Select-String -Pattern "getExpenseStatusConfig.*status: string.*{" apps/web/src/app/[locale]/expenses/page.tsx

# 3. 確認沒有舊的常量引用
Select-String -Pattern "PROJECT_STATUS_CONFIG" apps/web/src/app/[locale]/projects/[id]/page.tsx
Select-String -Pattern "PROPOSAL_STATUS_CONFIG" apps/web/src/app/[locale]/projects/[id]/page.tsx
Select-String -Pattern "EXPENSE_STATUS_CONFIG" apps/web/src/app/[locale]/expenses/page.tsx
```

預期結果：
- ✅ 前兩組命令應該找到修復
- ✅ 最後一組命令應該找不到任何匹配（或只有函數定義內部的使用）

---

**修復完成時間**: 2025-11-04 14:30
**最後更新**: 添加 `getProposalStatusConfig` 修復
**狀態**: ✅ 所有程式碼修復已完成，等待用戶清除快取並驗證
