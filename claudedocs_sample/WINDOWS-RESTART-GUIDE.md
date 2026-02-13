# Windows PowerShell 重啟開發伺服器指南

## 當前狀態

✅ **已完成的操作**：
1. 所有 7 個問題的程式碼修復已完成
2. 翻譯文件（zh-TW.json, en.json）已正確更新
3. `.next` 編譯快取已清除

## 下一步操作（請您執行）

### 步驟 1: 重啟開發伺服器

在運行 `pnpm dev` 的終端視窗中：

```powershell
# 按 Ctrl+C 停止當前運行的開發伺服器
# 等待看到 "Process terminated" 或類似訊息

# 重新啟動開發伺服器
pnpm dev
```

### 步驟 2: 等待編譯完成

您會看到類似以下的輸出：
```
▲ Next.js 14.1.0
- Local:        http://localhost:3001
- Network:      http://[your-ip]:3001

✓ Ready in 5s
```

**重要**: 等待 "Ready" 訊息出現後再測試頁面

### 步驟 3: 測試修復

在瀏覽器中訪問以下頁面，使用 **Ctrl+Shift+R** 硬重載：

#### 測試清單

1. **Projects 頁面**
   - URL: http://localhost:3001/zh-TW/projects
   - ✅ 預期：所有欄位顯示中文（主管、提案、採購單等）
   - ✅ 預期：Console 無 `MISSING_MESSAGE` 錯誤

2. **Proposals 頁面**
   - URL: http://localhost:3001/zh-TW/proposals
   - ✅ 預期：狀態顯示中文（草稿、待審批、已批准等）
   - ✅ 預期：Console 無 `MISSING_MESSAGE` 錯誤

3. **Budget Pools 頁面**
   - URL: http://localhost:3001/zh-TW/budget-pools
   - ✅ 預期：類別計數顯示中文
   - ✅ 預期：Console 無 `MISSING_MESSAGE` 錯誤

4. **Vendors 頁面**
   - URL: http://localhost:3001/zh-TW/vendors
   - ✅ 預期：報價單數和採購單數顯示中文
   - ✅ 預期：Console 無 `MISSING_MESSAGE` 錯誤

5. **Projects Detail 頁面**
   - URL: http://localhost:3001/zh-TW/projects/d4ba5d69-cb32-4321-a39e-23b680d7d205
   - ✅ 預期：專案狀態 Badge 正常顯示
   - ✅ 預期：無 `PROJECT_STATUS_CONFIG is not defined` 錯誤

6. **Expenses 頁面**
   - URL: http://localhost:3001/zh-TW/expenses
   - ✅ 預期：費用狀態正常顯示
   - ✅ 預期：無 `t is not a function` 錯誤

7. **Quotes 導航測試**
   - URL: http://localhost:3001/zh-TW/quotes
   - 點擊任一報價單記錄
   - ✅ 預期：跳轉到 `/zh-TW/projects/[id]/quotes`（這是正常行為）
   - 返回專案詳情頁
   - ✅ 預期：專案狀態 Badge 正常顯示，無錯誤

## Windows PowerShell 常用命令參考

### 如果未來需要再次清除快取

```powershell
# 刪除 .next 目錄
Remove-Item -Path "apps/web/.next" -Recurse -Force

# 刪除 node_modules（如果需要完全重置）
Remove-Item -Path "node_modules" -Recurse -Force
Remove-Item -Path "apps/web/node_modules" -Recurse -Force

# 重新安裝依賴
pnpm install
```

### 檢查服務狀態

```powershell
# 檢查 port 3001 是否被佔用
netstat -ano | findstr :3001

# 強制終止特定進程（替換 PID）
Stop-Process -Id <PID> -Force
```

### 清除所有快取和重置（完全重置時使用）

```powershell
# 停止開發伺服器 (Ctrl+C)

# 清除 Next.js 快取
Remove-Item -Path "apps/web/.next" -Recurse -Force

# 清除 Turborepo 快取
Remove-Item -Path ".turbo" -Recurse -Force

# 清除 TypeScript 快取
Remove-Item -Path "apps/web/.tsbuildinfo" -Recurse -Force -ErrorAction SilentlyContinue

# 重新啟動
pnpm dev
```

## 故障排除

### 問題：重啟後仍有錯誤

**解決方案 1**: 清除瀏覽器快取
1. 打開開發者工具（F12）
2. 右鍵點擊刷新按鈕
3. 選擇 "清空快取並硬性重新載入"

**解決方案 2**: 使用無痕模式
1. 開啟無痕視窗（Ctrl+Shift+N）
2. 訪問測試頁面
3. 確認是否仍有錯誤

**解決方案 3**: 完全重置
```powershell
# 1. 停止服務
# 2. 清除所有快取（見上方命令）
# 3. 重新安裝依賴
pnpm install
# 4. 重新啟動
pnpm dev
```

### 問題：某些頁面仍顯示英文

可能原因：
1. 該頁面尚未完成 i18n 遷移
2. 翻譯鍵路徑不正確

請提供具體頁面 URL 和錯誤訊息以便診斷。

### 問題：重啟服務很慢

這是正常的，因為：
1. 清除了 `.next` 快取，Next.js 需要重新編譯所有頁面
2. TypeScript 需要重新檢查類型
3. Turborepo 需要重建快取

首次啟動可能需要 30-60 秒。

## 修復驗證報告格式

測試完成後，請提供以下格式的反饋：

```
✅ Projects 頁面 - 正常
✅ Proposals 頁面 - 正常
✅ Budget Pools 頁面 - 正常
✅ Vendors 頁面 - 正常
✅ Projects Detail 頁面 - 正常
✅ Expenses 頁面 - 正常
✅ Quotes 導航 - 正常

或者

❌ [頁面名稱] - 仍有問題
錯誤訊息：[具體錯誤]
```

## 技術說明

### 為什麼清除 .next 目錄能解決問題？

`.next` 目錄包含：
- 編譯後的 JavaScript 和 CSS
- 伺服器端渲染（SSR）的快取
- 靜態頁面生成（SSG）的結果
- Webpack 編譯快取

當翻譯文件或關鍵程式碼變更時，快取可能不會自動失效，導致：
- 舊的翻譯仍在使用
- 舊的程式碼邏輯仍在執行
- 熱重載機制失效

刪除 `.next` 強制 Next.js 重新編譯所有內容，確保使用最新的程式碼和翻譯。

### 為什麼單純重啟服務不夠？

Next.js 在重啟時會嘗試重用 `.next` 目錄中的快取以加快啟動速度。如果快取內容與源碼不一致，問題會持續存在。

### 未來如何避免？

開發翻譯功能時的最佳實踐：
1. 修改翻譯文件後，總是清除 `.next` 並重啟
2. 使用 `pnpm dev --turbo` 啟用更好的熱重載（如果支援）
3. 配置 `next.config.js` 監視翻譯文件變更（高級選項）

---

**已完成的準備工作**：
- ✅ 所有程式碼修復已完成
- ✅ 所有翻譯鍵已添加
- ✅ .next 快取已清除

**等待您執行**：
- ⏳ 重啟開發伺服器
- ⏳ 測試所有頁面
- ⏳ 提供測試結果反饋
