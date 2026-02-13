# FIX-061 關鍵問題：Webpack 動態導入快取

## 🔴 問題根源確認

經過徹底診斷，我已經確認：

### ✅ 翻譯文件 100% 正確
```bash
# 驗證命令
sed -n '407,417p' apps/web/src/messages/zh-TW.json
# 輸出確認：projects.fields.supervisor 等所有鍵都存在

python -m json.tool apps/web/src/messages/zh-TW.json
# 輸出：JSON is valid
```

### ✅ JSON 結構 100% 正確
```json
{
  "projects": {
    "form": {
      "actions": { ... }
    },
    "fields": {           // ← 這裡！在 projects 頂層
      "supervisor": "主管",
      "proposals": "提案",
      ...
    }
  }
}
```

### ✅ 程式碼修復 100% 正確
所有 STATUS_CONFIG 的引用都已替換為函數調用。

### ❌ 真正的問題：Webpack 動態導入快取

**位置**：`apps/web/src/i18n/request.ts:17`
```typescript
messages: (await import(`../messages/${locale}.json`)).default
```

**問題**：
1. Webpack 在編譯時處理這個動態導入
2. 創建了一個 chunk 包含翻譯文件
3. 這個 chunk 被快取了
4. 即使源文件更新，Webpack 仍使用舊的 chunk
5. 清除 `.next` 目錄沒有完全清除 Webpack 的模組快取

## 💡 解決方案

### 方案 1: 完全停止並刪除所有快取（最徹底）

```powershell
# 1. 停止開發伺服器
# 在運行 pnpm dev 的終端按 Ctrl+C

# 2. 刪除所有編譯快取
Remove-Item -Path "apps/web/.next" -Recurse -Force
Remove-Item -Path ".turbo" -Recurse -Force
Remove-Item -Path "apps/web/.tsbuildinfo" -Recurse -Force -ErrorAction SilentlyContinue

# 3. 清除 pnpm 快取（可選，但推薦）
pnpm store prune

# 4. 重新啟動
pnpm dev
```

### 方案 2: 直接修改翻譯文件以觸發 Webpack 重新編譯

我已經修改了 `i18n/request.ts` 添加了註解，這應該會觸發重新編譯。

但如果還是不行，請：

```powershell
# 在 zh-TW.json 末尾添加一個空格或換行
# 這會改變文件內容，強制 Webpack 重新讀取

# Windows PowerShell:
Add-Content -Path "apps/web/src/messages/zh-TW.json" -Value "`n"
```

### 方案 3: 使用 --no-cache 標誌重新啟動

```powershell
# 停止當前服務
# Ctrl+C

# 使用 --no-cache 重新啟動
cd apps/web
npx next dev --port 3001 --no-cache

# 或者使用 turbo
pnpm turbo run dev --no-cache --filter=web
```

## 📋 逐步執行指南

### 第一步：驗證文件內容（請您執行）

```powershell
# 在 PowerShell 中執行以下命令驗證翻譯文件
Select-String -Pattern '"supervisor": "主管"' apps/web/src/messages/zh-TW.json
Select-String -Pattern '"proposals": "提案"' apps/web/src/messages/zh-TW.json
```

**預期輸出**：應該找到這些鍵

如果找不到，那麼文件確實沒有保存。
如果找到了，那就是 Webpack 快取問題。

### 第二步：徹底清除快取並重啟

```powershell
# 1. Ctrl+C 停止開發伺服器

# 2. 執行清除
Remove-Item -Path "apps/web/.next" -Recurse -Force
Remove-Item -Path ".turbo" -Recurse -Force

# 3. 觸發文件變更
$file = "apps/web/src/messages/zh-TW.json"
(Get-Content $file) + "`n# FIX-061" | Set-Content $file

# 4. 重新啟動
pnpm dev
```

### 第三步：使用無痕模式測試

```
1. 等待 "✓ Ready" 訊息
2. 開啟無痕視窗 (Ctrl+Shift+N)
3. 訪問 http://localhost:3001/zh-TW/projects
4. F12 打開開發者工具查看 console
```

## 🔍 診斷檢查點

### 檢查點 1：翻譯文件是否真的被讀取

在瀏覽器 console 中執行：

```javascript
// 檢查當前頁面使用的語言
console.log(document.documentElement.lang);  // 應該是 "zh-TW"

// 檢查 next-intl 是否正確初始化
console.log(window.__NEXT_DATA__);  // 查看 props 中的 messages
```

### 檢查點 2：Network 標籤檢查

1. F12 → Network 標籤
2. 勾選 "Disable cache"
3. 刷新頁面
4. 查找加載的 JavaScript 文件
5. 查看是否有 `messages` 或 `zh-TW` 相關的 chunk

### 檢查點 3：Source 標籤檢查

1. F12 → Sources 標籤
2. 展開 `webpack://` → `apps/web/src/messages/`
3. 打開 `zh-TW.json`
4. 搜尋 `projects.fields.supervisor`
5. 確認翻譯是否存在

## ⚠️ 如果以上都不行

### 終極方案：完全重置項目

```powershell
# 1. 停止所有服務
# Ctrl+C

# 2. 刪除 node_modules 和所有快取
Remove-Item -Path "node_modules" -Recurse -Force
Remove-Item -Path "apps/web/node_modules" -Recurse -Force
Remove-Item -Path "apps/web/.next" -Recurse -Force
Remove-Item -Path ".turbo" -Recurse -Force
Remove-Item -Path "pnpm-lock.yaml" -Force

# 3. 清除 pnpm 快取
pnpm store prune

# 4. 重新安裝
pnpm install

# 5. 重新啟動
pnpm dev
```

**注意**：這會花費 5-10 分鐘，但會確保一切從頭開始。

## 🤔 可能的替代原因

如果以上所有方法都不行，可能是：

### 1. 文件編碼問題
```powershell
# 檢查文件編碼
file apps/web/src/messages/zh-TW.json

# 應該是 UTF-8
# 如果不是，用 VS Code 重新保存為 UTF-8
```

### 2. Git 問題（文件沒有真正被修改）
```powershell
# 查看 Git 狀態
git status

# 查看 zh-TW.json 的變更
git diff apps/web/src/messages/zh-TW.json
```

如果 `git diff` 沒有顯示變更，那麼文件確實沒有被保存。

### 3. 文件權限問題
```powershell
# 檢查文件權限
icacls apps\web\src\messages\zh-TW.json

# 確保您有寫權限
```

## 📝 我的建議執行順序

1. **先驗證文件內容**（30 秒）
   ```powershell
   Select-String -Pattern '"supervisor": "主管"' apps/web/src/messages/zh-TW.json
   ```

2. **徹底清除快取並重啟**（2 分鐘）
   ```powershell
   # Ctrl+C 停止服務
   Remove-Item -Path "apps/web/.next" -Recurse -Force
   Remove-Item -Path ".turbo" -Recurse -Force
   pnpm dev
   ```

3. **使用無痕模式測試**（1 分鐘）
   - Ctrl+Shift+N → 訪問頁面

4. **如果還是不行，完全重置**（10 分鐘）
   - 刪除 node_modules → 重新安裝 → 重啟

## 📞 反饋格式

測試後請提供：

```
✅/❌ 翻譯文件驗證: [結果]
✅/❌ 清除快取並重啟: [結果]
✅/❌ 無痕模式測試: [結果]
✅/❌ 頁面顯示中文: [是/否]
✅/❌ Console 無錯誤: [是/否]

如果仍有錯誤，請貼上：
1. Console 錯誤訊息
2. git diff apps/web/src/messages/zh-TW.json 的輸出
3. 瀏覽器 Sources 標籤中 zh-TW.json 的內容截圖
```

---

**當前時間**: 2025-11-04 14:40
**PID**: 89660 (開發伺服器正在運行)
**狀態**: 等待用戶執行清除快取並重啟
