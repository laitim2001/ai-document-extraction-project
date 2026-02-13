# FIX-061 熱重載問題診斷

## 問題現象

修復完成後，瀏覽器仍然顯示舊的錯誤：
1. 翻譯文件（zh-TW.json, en.json）已正確修改
2. 程式碼文件（page.tsx）已正確修改
3. 但瀏覽器仍然顯示舊版本的錯誤

## 根本原因

**Next.js 開發伺服器的熱模組替換（HMR）對翻譯文件的支援不完整**

- next-intl 的翻譯文件變更可能不會觸發 HMR
- TypeScript 檔案的變更會觸發重新編譯，但瀏覽器可能使用舊的緩存
- `.next` 目錄中可能存在過期的編譯結果

## 解決方案

### 方案 1: 清除 .next 快取並重啟（推薦，但需要重啟服務）

```bash
# 停止開發伺服器 (Ctrl+C)
# 刪除 .next 目錄
rm -rf apps/web/.next

# 重新啟動
pnpm dev
```

### 方案 2: 在不重啟的情況下解決（當前嘗試）

我已經執行：
1. ✅ 修改了 Projects Detail 頁面的註解（添加 "- FIX-061"）
2. ✅ 修改了 Expenses 頁面的註解（添加 "- FIX-061"）
3. ✅ 使用 `touch` 更新了翻譯文件的時間戳

**請執行以下步驟驗證**：

1. 在瀏覽器中打開開發者工具（F12）
2. 切換到 Network 標籤
3. 勾選 "Disable cache"
4. 按 Ctrl+Shift+R（硬重載）刷新每個問題頁面

如果仍然不行，需要執行方案 1。

### 方案 3: 僅重啟 Next.js 開發伺服器（保持其他服務）

如果您有多個服務在運行，可以只重啟 Next.js：

```bash
# 找到 Next.js 進程
Get-Process | Where-Object {$_.Id -eq 67044} | Stop-Process

# 或者在 VS Code 終端中按 Ctrl+C 停止
# 然後重新執行
pnpm dev
```

## 驗證清單

修復生效後，以下頁面應該正常顯示中文且無錯誤：

- [ ] http://localhost:3001/zh-TW/projects - 所有欄位顯示中文
- [ ] http://localhost:3001/zh-TW/proposals - 狀態顯示中文
- [ ] http://localhost:3001/zh-TW/budget-pools - 類別計數顯示中文
- [ ] http://localhost:3001/zh-TW/vendors - 報價單數和採購單數顯示中文
- [ ] http://localhost:3001/zh-TW/projects/[id] - 專案狀態 Badge 正常顯示
- [ ] http://localhost:3001/zh-TW/expenses - 費用狀態正常顯示

## 技術細節

### 為什麼會發生這個問題？

1. **next-intl 的翻譯載入機制**:
   - 翻譯文件在伺服器端載入
   - 變更可能需要伺服器重新讀取文件系統

2. **Next.js 的快取層級**:
   - 伺服器端快取（`.next/cache`）
   - 客戶端快取（瀏覽器）
   - HMR 快取（webpack）

3. **修改的文件類型**:
   - JSON 翻譯文件：可能不觸發 HMR
   - TypeScript 組件文件：應該觸發 HMR，但可能被快取

### 如何避免未來遇到此問題？

1. **開發翻譯時的最佳實踐**:
   - 修改翻譯文件後，手動重啟開發伺服器
   - 或使用瀏覽器硬重載（Ctrl+Shift+R）

2. **配置改進**（可選）:
   - 在 `next.config.js` 中配置監視翻譯文件
   - 使用 `nodemon` 或類似工具監視翻譯文件變更並自動重啟

3. **測試流程**:
   - 修復程式碼錯誤後，先重啟再測試
   - 使用無痕模式瀏覽器避免快取干擾

## 下一步行動

**建議**: 為了確保所有修復都正確生效，請執行以下操作之一：

### 選項 A: 完全重啟開發伺服器（最可靠）
```bash
# 在運行 pnpm dev 的終端按 Ctrl+C
# 等待服務完全停止
# 重新執行
pnpm dev
```

### 選項 B: 瀏覽器硬重載（快速但可能不完整）
1. 在每個問題頁面按 Ctrl+Shift+R
2. 如果仍有問題，執行選項 A

## 修復確認

執行重啟後，請確認：
1. Console 中沒有 `MISSING_MESSAGE` 錯誤
2. 所有中文翻譯正確顯示
3. 狀態 Badge 正常渲染
4. 沒有 JavaScript runtime 錯誤

如果問題仍然存在，可能表示修復本身有問題，需要重新檢查程式碼。
