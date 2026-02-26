# 手動測試記錄 (Manual Testing Log)

> **目的**: 記錄手動測試過程、發現的問題和修復結果
> **開始日期**: 2025-11-12
> **測試人員**: 開發團隊
> **測試環境**: Local Development (localhost:3000)

---

## 📋 測試記錄格式

每次測試包含以下信息：
- **日期時間**: 測試執行時間
- **測試模組**: 被測試的功能模組
- **測試場景**: 具體測試步驟
- **預期結果**: 應該出現的行為
- **實際結果**: 實際觀察到的行為
- **問題記錄**: 發現的 Bug 或異常
- **修復狀態**: 已修復 / 進行中 / 待修復

---

## 🧪 測試記錄

### 2025-11-12 23:45 | 預算池模組 (Budget Pools) 測試

**測試人員**: 開發團隊
**測試環境**: Local Development (localhost:3000)
**測試版本**: Commit 581a514

#### 測試場景 1: 新增預算池 (Create Budget Pool)

**測試步驟**:
1. 訪問 `http://localhost:3000/zh-TW/budget-pools/new`
2. 填寫預算池表單
3. 提交表單
4. 查看新建的預算池詳情頁

**預期結果**:
- 表單提交成功
- 顯示成功訊息
- 跳轉到預算池詳情頁
- 無控制台錯誤

**實際結果**: ❌ 失敗
- 預算池創建成功 ✅
- 但控制台出現多個 I18N 錯誤 ❌

**發現問題 - FIX-088**: I18N 缺失 translation keys (Budget Pool 模組)

**錯誤詳情**:
```
IntlError: MISSING_MESSAGE: Could not resolve `common.actions.saving` in messages for locale `en`.
IntlError: MISSING_MESSAGE: Could not resolve `common.messages.success` in messages for locale `en`.
IntlError: MISSING_MESSAGE: Could not resolve `budgetPools.messages.createSuccess` in messages for locale `en`.
IntlError: MISSING_MESSAGE: Could not resolve `budgetPools.detail.projects.empty` in messages for locale `en`.
```

**影響範圍**:
- 繁體中文 (zh-TW) 和英文 (en) 都缺失相同的 keys
- 新增預算池頁面 (new)
- 預算池詳情頁面 ([id])
- 預算池編輯頁面 ([id]/edit)

**缺失的 Keys**:
1. `common.actions.saving` - "Saving..." 按鈕文字
2. `common.messages.success` - 成功訊息標題
3. `budgetPools.messages.createSuccess` - 創建成功訊息
4. `budgetPools.messages.updateSuccess` - 更新成功訊息
5. `budgetPools.detail.projects.empty` - 無專案時的空狀態文字

**修復狀態**: 🔄 進行中

---

#### 測試場景 2: 更新預算池 (Update Budget Pool)

**測試步驟**:
1. 訪問 `http://localhost:3000/zh-TW/budget-pools/4da1640f-b6c2-4820-b4e3-5143683477d5/edit`
2. 修改預算池資料
3. 提交表單
4. 查看更新後的預算池詳情頁

**預期結果**:
- 表單提交成功
- 資料更新到資料庫
- 顯示成功訊息
- 跳轉到預算池詳情頁
- 無控制台錯誤

**實際結果**: ❌ 失敗
- 表單提交但資料未更新 ❌
- 控制台出現 I18N 錯誤 ❌

**發現問題 - FIX-088 (相同問題)**:

**錯誤詳情**:
```
IntlError: MISSING_MESSAGE: Could not resolve `common.actions.saving` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `common.messages.success` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `budgetPools.messages.updateSuccess` in messages for locale `zh-TW`.
IntlError: MISSING_MESSAGE: Could not resolve `budgetPools.detail.projects.empty` in messages for locale `zh-TW`.
```

**根本原因**:
- 翻譯檔案 (`apps/web/src/messages/zh-TW.json` 和 `en.json`) 缺失必要的 keys
- 導致 next-intl 無法解析翻譯
- 可能影響功能邏輯執行

**修復優先級**: 🔴 P0 (高優先級) - 影響核心功能

---

### 2025-11-12 14:30 | 專案模組 (Projects) 測試

**測試人員**: 用戶
**測試環境**: Local Development (localhost:3000)
**測試版本**: Commit 2481503 (FIX-088 修復後)

#### 測試場景 3: 訪問專案詳情頁 (View Project Detail)

**測試步驟**:
1. 訪問 `http://localhost:3000/zh-TW/projects/93736072-97e2-4d9e-ac4c-615cfc335308`
2. 查看專案詳細資訊

**預期結果**:
- 專案詳情頁正常顯示
- 預算池資訊正常顯示 (包含總金額)
- 無控制台錯誤

**實際結果**: ❌ 失敗
- 頁面崩潰,無法渲染 ❌
- 控制台出現致命錯誤 ❌

**發現問題 - FIX-089**: budgetPool.totalAmount undefined 錯誤

**錯誤詳情**:
```
Unhandled Runtime Error
TypeError: Cannot read properties of undefined (reading 'toLocaleString')

Source: src\app\[locale]\projects\[id]\page.tsx (532:58)
> 532 |  ${project.budgetPool.totalAmount.toLocaleString()}
```

**影響範圍**:
- 專案詳情頁面 (`/projects/[id]`)
- 新增專案頁面 (`/projects/new`)
- 可能影響 Project list 和 Dashboard

---

#### 測試場景 4: 新增專案 (Create Project)

**測試步驟**:
1. 訪問 `http://localhost:3000/zh-TW/projects/new`
2. 填寫專案表單

**預期結果**:
- 新增頁面正常顯示
- 表單可以填寫
- 無控制台錯誤

**實際結果**: ❌ 失敗
- 頁面崩潰,無法顯示 ❌
- 相同的 `budgetPool.totalAmount` undefined 錯誤 ❌

**根本原因分析**:
在 commit `14815bf` (FIX-094) 時,surgical-task-executor agent 執行 "清理 Budget Pool export API 遺留程式碼" 時過度清理:

1. **任務範圍擴張**: 任務是清理 "Budget Pool export API",但執行了 "清理整個專案中的 totalAmount"
2. **缺乏影響分析**: 未檢查 `totalAmount` 在其他 routers (如 project.ts) 中的使用
3. **誤解 Deprecated**: 將 "DEPRECATED: 保留以向後兼容" 理解為 "可以立即移除"
4. **驗證範圍不足**: 只測試了 Budget Pool export,未測試 Project 相關頁面

**被移除的位置** (實際為 6 個,非 4 個):
- `project.getAll` (Line 167) - 影響 Project list
- `project.getById` (Line 239) - **影響 Project detail** ← 導致本次問題
- `project.getStats` (Line 499) - 影響 Dashboard
- `project.export` (Line 616) - 影響 CSV 匯出 #1
- `project.export` (Line 873) - 影響 CSV 匯出 #2
- `project.chargeOut` (Line 966) - 影響費用轉嫁

**修復過程**:

**第一次修復 (FIX-089)** - Commit `d8903f7`:
- 使用 Edit tool 的 `replace_all: true` 嘗試批量修復
- ❌ **失敗**: 只修復了 1/6 位置 (Line 167)
- **原因**: Edit tool 對縮排敏感,不同位置使用不同縮排 (10 vs 12 空格)
- **驗證失敗**: 使用 `git grep "totalAmount"` 匹配到不相關欄位,誤判為已修復
- **用戶回報**: 測試後問題依然存在

**第二次修復 (FIX-089B)** - Commit `238a93f`:
- 手動逐個修復所有 6 個位置,每個使用唯一上下文
- ✅ **成功**: 使用結構化驗證 (awk) 確認所有 6 個 budgetPool 都有 totalAmount
- **用戶確認**: "經過測試之後, 現在報錯問題解決了"

**修復狀態**: ✅ 已修復並驗證通過

**詳細分析文件**:
- `FIX-089-ROOT-CAUSE-ANALYSIS.md` - 根本原因分析 (FIX-094 過度清理)
- `FIX-089B-EDIT-TOOL-FAILURE-ANALYSIS.md` - Edit tool 失敗原因分析
- `SURGICAL-AGENT-CASCADING-FAILURES-ANALYSIS.md` - surgical-task-executor 系統性問題分析

---

## 📊 測試統計

### 測試覆蓋率
- **已測試模組**: 2/18 (Budget Pools, Projects 部分)
- **測試場景**: 4 個
- **發現問題**: 2 個 (FIX-088, FIX-089/089B)
- **修復完成**: 2 個 ✅
- **修復迭代**: FIX-089 → FIX-089B (2 次迭代)

### 問題分類
- **I18N 問題**: 1 個 (FIX-088)
- **API/後端問題**: 1 個 (FIX-089/089B - Surgical Agent 過度清理)
- **工具問題**: 1 個 (Edit tool 縮排敏感性,已在 FIX-089B 解決)
- **功能性問題**: 0 個
- **UI/UX 問題**: 0 個
- **效能問題**: 0 個

### 修復品質指標
- **首次修復成功率**: 50% (1/2) - FIX-088 ✅, FIX-089 ❌
- **迭代修復成功率**: 100% (2/2) - FIX-089B ✅ after user feedback
- **用戶驗證通過率**: 100% (2/2) - 兩個問題最終都通過用戶驗證

---

## 🔧 待測試模組

### 高優先級 (P0)
- [ ] Projects (專案管理)
- [ ] Budget Proposals (預算提案)
- [ ] Expenses (費用記錄)
- [ ] Notifications (通知系統)

### 中優先級 (P1)
- [ ] Vendors (供應商管理)
- [ ] Quotes (報價單)
- [ ] Purchase Orders (採購訂單)
- [ ] Charge-Outs (費用轉嫁)
- [ ] OM Expenses (營運支出)

### 低優先級 (P2)
- [ ] Dashboard (儀表板)
- [ ] Users (用戶管理)
- [ ] Settings (系統設定)
- [ ] Authentication (登入/註冊)

---

## 📝 測試檢查清單

### Budget Pools 模組
- [x] 新增預算池 - 發現 I18N 問題
- [x] 更新預算池 - 發現 I18N 問題
- [ ] 刪除預算池 - 待測試
- [ ] 查看預算池列表 - 待測試
- [ ] 查看預算池詳情 - 部分測試 (發現 I18N 問題)
- [ ] 預算池搜尋/過濾 - 待測試
- [ ] 預算池排序 - 待測試

---

## 🐛 已發現問題清單

| ID | 模組 | 嚴重程度 | 狀態 | 描述 | Commits |
|----|------|----------|------|------|---------|
| FIX-089B | Projects | 🔴 P0 | ✅ 已修復並驗證 | budgetPool.totalAmount undefined - Surgical Agent 過度清理 | `d8903f7` (失敗) → `238a93f` (成功) |
| FIX-088 | Budget Pools | 🔴 P0 | ✅ 已修復 | I18N 缺失 5 個 translation keys | `2481503` |

---

## ✅ 已修復問題

| ID | 修復日期 | 描述 | Commits | 驗證狀態 |
|----|----------|------|---------|----------|
| FIX-089B | 2025-11-12 | Project API 恢復 budgetPool.totalAmount 欄位 (實際 6 個位置,非 4 個) | `d8903f7` (1/6) → `238a93f` (6/6) | ✅ 用戶驗證通過 |
| FIX-088 | 2025-11-12 | Budget Pool 模組新增 5 個 I18N translation keys (zh-TW + en) | `2481503` | ✅ 已驗證 |

### 修復迭代記錄

**FIX-089B 修復歷程** (展示了工具限制和驗證重要性):

1. **第一次嘗試 (FIX-089)** - Commit `d8903f7`:
   - 方法: Edit tool `replace_all: true` 批量替換
   - 結果: ❌ 只修復 1/6 位置
   - 問題: 縮排差異 (10 vs 12 空格) 導致字串匹配失敗
   - 驗證: 使用 `git grep` 誤匹配不相關欄位
   - 用戶反饋: "經過手動測試之後, 還是出現報錯"

2. **第二次修復 (FIX-089B)** - Commit `238a93f`:
   - 方法: 手動逐個修復,每個位置使用唯一上下文
   - 結果: ✅ 成功修復全部 6/6 位置
   - 驗證: 使用結構化 awk 驗證每個 budgetPool 區塊
   - 用戶反饋: "經過測試之後, 現在報錯問題解決了"

**關鍵教訓**:
- Edit tool 對縮排/空白敏感,批量替換需謹慎
- 驗證方法要針對性 (結構化驗證 > 關鍵字搜尋)
- 用戶測試是最終真相來源

---

## 📚 分析文件索引

本次測試產生了 3 份深入分析文件:

1. **`FIX-089-ROOT-CAUSE-ANALYSIS.md`** (671 行)
   - FIX-094 如何導致 FIX-089 的連鎖反應
   - surgical-task-executor 過度清理的 5 Why 分析
   - 預防措施和改進建議

2. **`FIX-089B-EDIT-TOOL-FAILURE-ANALYSIS.md`** (527 行)
   - Edit tool `replace_all` 失敗的技術原因
   - 縮排敏感性問題詳解
   - 正確的批量修改策略

3. **`SURGICAL-AGENT-CASCADING-FAILURES-ANALYSIS.md`** (完整系統分析)
   - surgical-task-executor 的 5 個系統性問題
   - "Surgical Precision" vs "Isolation" 的誤解
   - Phase 1.5: Impact Analysis 提案
   - Surgical Safety Checklist (基於 WHO 醫療檢查表)
   - 完整的 FIX-094 → FIX-089 → FIX-089B 時間線

---

**維護者**: 開發團隊 + AI 助手
**最後更新**: 2025-11-12 (FIX-089B 完成後)
**下次測試**: 繼續測試其他 P0 模組 (Budget Proposals, Expenses, Notifications)
**測試經驗**: 本次測試揭示了 surgical-task-executor 的系統性問題,已完成深入分析並提出改進方案
