# FIX-066: 快取清除完整指引

**建立日期**: 2025-11-05
**問題類型**: 開發伺服器快取導致翻譯鍵顯示為 MISSING_MESSAGE
**根本原因**: Next.js + Webpack + 瀏覽器多層快取
**解決方案**: 完整重啟開發環境

---

## 🎯 問題診斷結果

### ✅ 代碼層面檢查（全部通過）

1. **JSON 格式驗證**: ✅ 通過
   ```
   en.json: Valid JSON
   zh-TW.json: Valid JSON
   ```

2. **翻譯鍵存在性驗證**: ✅ 全部存在
   ```
   navigation.home: Home / 首頁
   common.actions.cancel: Cancel / 取消
   common.actions.exportCSV: Export CSV / 匯出 CSV
   proposals.description: ✅ 存在
   proposals.fields.title: Title / ✅ 存在
   proposals.summary.total: Total Proposals / ✅ 存在
   budgetPools.fields.fiscalYear: 財政年度 ✅
   budgetPools.fields.totalBudget: 總預算 ✅
   budgetPools.detail.fiscalYearLabel: 財政年度 ✅
   budgetPools.list.showing: 顯示 {start} - {end} / {total} 個預算池 ✅
   ```

3. **代碼修復**: ✅ 完成
   - `ui/index.ts`: 修復小寫 `input` → 大寫 `Input`
   - `ProposalActions.tsx`: 修復 `status.rejected.message` → `status.rejectedMessage`

### ❌ 環境層面問題（需要清除）

即使代碼完全正確，您仍然看到錯誤的原因是**多層快取**：

1. **Next.js 開發伺服器快取** (.next/ 目錄)
2. **Webpack 模組快取** (記憶體中)
3. **瀏覽器 HTTP 快取** (JSON 檔案)
4. **瀏覽器 Service Worker 快取** (如果啟用)

---

## 🔧 完整解決方案

### 方案 A: 完整重啟（最徹底，推薦）

```powershell
# 1. 停止開發伺服器
# 在運行 pnpm dev 的終端按 Ctrl+C

# 2. 清除 Next.js 快取
Remove-Item -Recurse -Force apps\web\.next

# 3. 清除 Turbo 快取
pnpm turbo clean

# 4. 重新啟動開發伺服器
pnpm dev

# 5. 等待編譯完成（約 30-60 秒）

# 6. 使用無痕模式開啟瀏覽器
# Chrome: Ctrl+Shift+N
# Edge: Ctrl+Shift+P

# 7. 訪問測試頁面
```

### 方案 B: 快速重啟（較快，但可能不夠徹底）

```powershell
# 1. 停止開發伺服器 (Ctrl+C)

# 2. 只清除 Next.js 快取
Remove-Item -Recurse -Force apps\web\.next

# 3. 重啟
pnpm dev

# 4. 硬性重新整理瀏覽器（Ctrl+Shift+R）
```

### 方案 C: 僅瀏覽器端（最快，但可能無效）

```
1. 開啟無痕模式（Ctrl+Shift+N）
2. 訪問 http://localhost:3001
3. 如果仍有錯誤，則需要使用方案 A 或 B
```

---

## 📋 驗證清單

完整重啟後，請在**無痕模式**下測試以下頁面：

### 1. Projects 頁面
- [ ] http://localhost:3001/zh-TW/projects
- [ ] http://localhost:3001/en/projects
- [ ] ✅ F12 Console 無 Input.tsx 警告
- [ ] ✅ F12 Console 無 MISSING_MESSAGE 錯誤

### 2. Proposals 列表
- [ ] http://localhost:3001/en/proposals
- [ ] ✅ 顯示 "Manage budget proposals and approval workflow"
- [ ] ✅ 表格標題顯示 "Title"
- [ ] ✅ 顯示 "Total Proposals"
- [ ] ✅ F12 Console 無錯誤

### 3. Proposals 詳情
- [ ] http://localhost:3001/en/proposals/[id]
- [ ] http://localhost:3001/zh-TW/proposals/[id]
- [ ] ✅ F12 Console 無 `proposals.status.rejected.message` 錯誤
- [ ] ✅ 已駁回狀態顯示正確訊息
- [ ] ✅ 無 Input.tsx 警告

### 4. Projects 詳情
- [ ] http://localhost:3001/en/projects/[id]
- [ ] ✅ 顯示 "Loading project details..." (載入時)
- [ ] ✅ F12 Console 無錯誤

### 5. Projects 編輯
- [ ] http://localhost:3001/en/projects/[id]/edit
- [ ] ✅ 顯示 "Cancel" 按鈕
- [ ] ✅ F12 Console 無錯誤

### 6. Budget Pools 列表
- [ ] http://localhost:3001/zh-TW/budget-pools
- [ ] ✅ 顯示「首頁」
- [ ] ✅ 顯示「匯出 CSV」按鈕
- [ ] ✅ 顯示「顯示 1 - 10 / 50 個預算池」（無 FORMATTING_ERROR）
- [ ] ✅ 表格標題顯示「財政年度」、「總預算」
- [ ] ✅ F12 Console 無錯誤

### 7. Budget Pools 詳情
- [ ] http://localhost:3001/zh-TW/budget-pools/[id]
- [ ] ✅ 顯示「首頁」
- [ ] ✅ 顯示「財政年度」標籤
- [ ] ✅ 顯示「編輯預算池」、「刪除預算池」按鈕
- [ ] ✅ F12 Console 無錯誤

### 8. Budget Pools 編輯
- [ ] http://localhost:3001/zh-TW/budget-pools/[id]/edit
- [ ] ✅ 顯示「首頁」
- [ ] ✅ 頁面標題顯示「編輯預算池」
- [ ] ✅ 副標題顯示「更新預算池資訊」
- [ ] ✅ 無 Input.tsx 警告
- [ ] ✅ F12 Console 無錯誤

---

## 🔍 如果仍有問題

### 檢查點 1: 確認代碼修復已生效

```powershell
# 檢查 ui/index.ts
findstr /n "from \"./Input\"" apps\web\src\components\ui\index.ts
# 應該顯示: 5:export { Input } from "./Input"
# 應該顯示: 6:export type { InputProps } from "./Input"

# 檢查 ProposalActions.tsx
findstr /n "rejectedMessage" apps\web\src\components\proposal\ProposalActions.tsx
# 應該顯示: 196:          <p className="text-sm font-medium text-red-800">{t('status.rejectedMessage')}</p>
```

### 檢查點 2: 確認翻譯鍵存在

```powershell
# 驗證 en.json
node -e "const msg = require('./apps/web/src/messages/en.json'); console.log('proposals.description:', msg.proposals.description); console.log('proposals.fields.title:', msg.proposals.fields.title); console.log('proposals.summary.total:', msg.proposals.summary.total);"

# 預期輸出:
# proposals.description: Manage budget proposals and approval workflow
# proposals.fields.title: Title
# proposals.summary.total: Total Proposals

# 驗證 zh-TW.json
node -e "const msg = require('./apps/web/src/messages/zh-TW.json'); console.log('navigation.home:', msg.navigation.home); console.log('budgetPools.fields.fiscalYear:', msg.budgetPools.fields.fiscalYear); console.log('budgetPools.list.showing:', msg.budgetPools.list.showing);"

# 預期輸出:
# navigation.home: 首頁
# budgetPools.fields.fiscalYear: 財政年度
# budgetPools.list.showing: 顯示 {start} - {end} / {total} 個預算池
```

### 檢查點 3: 檢查開發伺服器狀態

```powershell
# 檢查 pnpm dev 輸出
# 應該看到:
✓ Compiled successfully
```

如果看到編譯錯誤，先解決編譯錯誤。

### 檢查點 4: 檢查瀏覽器

1. **確認使用無痕模式**: 地址欄旁應有無痕模式圖標
2. **檢查 Network 面板**:
   - F12 → Network
   - 重新整理頁面
   - 查看 `en.json` 或 `zh-TW.json` 請求
   - 應該顯示 `200 OK` 且 Size 不是 "(disk cache)" 或 "(memory cache)"
3. **檢查 Console**:
   - 如果仍有 MISSING_MESSAGE，複製完整錯誤訊息
   - 檢查錯誤中的翻譯鍵名是否正確

---

## 🐛 常見問題

### Q1: 為什麼重啟後仍有 Input.tsx 警告？

**A**: 檢查是否有其他檔案也在導出 Input：

```powershell
# 搜尋所有 export.*Input.*from
Get-ChildItem -Recurse -Filter "*.ts" apps\web\src\components\ui | Select-String "export.*Input.*from"
```

如果找到多個，確保全部都使用大寫 `Input`。

### Q2: 為什麼 proposals.description 仍顯示 MISSING_MESSAGE？

**A**: 檢查頁面代碼是否正確使用翻譯鍵：

```powershell
# 搜尋使用 proposals.description 的位置
Get-ChildItem -Recurse -Filter "*.tsx" apps\web\src\app | Select-String "proposals\.description"
```

確認代碼使用 `t('proposals.description')` 或 `t('description')`（如果已在 `useTranslations('proposals')` 作用域內）。

### Q3: 為什麼 Budget Pools 分頁仍有 FORMATTING_ERROR？

**A**: 檢查翻譯鍵中的變數名：

```powershell
# 檢查 zh-TW.json
findstr "showing" apps\web\src\messages\zh-TW.json
# 應該顯示: "showing": "顯示 {start} - {end} / {total} 個預算池"
```

確認使用 `{start}` 和 `{end}`，不是 `{from}` 和 `{to}`。

### Q4: 頁面部分文字仍顯示錯誤語言

**A**: 這是**數據內容**，不是**UI 文字**。根據用戶說明：

> 多語言轉換的概念是平台上的既定文字信息, 而不是那些數據

**應該翻譯**:
- ✅ 按鈕文字（"新增"、"編輯"、"取消"）
- ✅ 表格標題（"創建時間"、"操作"）
- ✅ 表單標籤（"專案名稱"、"預算金額"）
- ✅ 系統訊息（"載入中..."、"操作成功"）

**不應翻譯**:
- ❌ 專案名稱（用戶輸入的數據）
- ❌ 使用者姓名（資料庫數據）
- ❌ 提案標題（用戶輸入的數據）
- ❌ 評論內容（用戶輸入的數據）

如果您看到「錯誤語言」，請確認是 UI 文字還是數據內容。

---

## 📊 修復摘要

### 代碼修復（已完成）

| 檔案 | 問題 | 修復 | 狀態 |
|------|------|------|------|
| `ui/index.ts` | 小寫 `"./input"` | 改為 `"./Input"` | ✅ |
| `ProposalActions.tsx` | 錯誤鍵名 `rejected.message` | 改為 `rejectedMessage` | ✅ |
| `en.json` | 27 個翻譯鍵缺失 | 已全部新增 | ✅ |
| `zh-TW.json` | 27 個翻譯鍵缺失 | 已全部新增 | ✅ |
| `budgetPools.list.showing` | 變數名 `{from}/{to}` | 改為 `{start}/{end}` | ✅ |

### 環境清理（需要用戶執行）

| 操作 | 目的 | 必要性 |
|------|------|--------|
| 停止開發伺服器 | 釋放端口和記憶體 | 🔴 必須 |
| 刪除 `.next/` | 清除 Next.js 快取 | 🔴 必須 |
| `pnpm turbo clean` | 清除 Turborepo 快取 | 🟡 推薦 |
| 重啟開發伺服器 | 重新編譯所有模組 | 🔴 必須 |
| 使用無痕模式 | 避免瀏覽器快取 | 🔴 必須 |

---

## 🎯 最終驗證

完成所有步驟後，您應該：

1. ✅ **F12 Console 完全乾淨** - 無任何 MISSING_MESSAGE 或 FORMATTING_ERROR
2. ✅ **無 Input.tsx 警告** - 無大小寫警告
3. ✅ **所有 UI 文字正確顯示** - 根據 locale 顯示對應語言
4. ✅ **語言切換正常** - 在 zh-TW 和 en 之間切換無問題
5. ✅ **麵包屑導航正確** - 保持 locale 前綴

如果所有檢查通過，恭喜您！I18N 問題已完全解決。

如果仍有問題，請提供：
1. 完整的 F12 Console 錯誤訊息
2. 頁面 URL
3. 檢查點 1-4 的執行結果

---

**建立日期**: 2025-11-05
**修復負責人**: Claude (AI Assistant)
**相關文檔**: FIX-065-I18N-COMPLETE-FIXES.md
**版本**: 1.0
