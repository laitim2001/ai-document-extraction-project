# 系統性測試計劃 - Post FIX-089B 驗證

> **測試目的**: 驗證 FIX-089B 修復後,所有 Project/Expense/Dashboard 相關頁面正常運作
> **測試日期**: 2025-11-12
> **測試環境**: Local Development (localhost:3000)
> **測試方法**: Manual Testing via Browser + Automated checks where possible

---

## 📋 測試範圍

### Layer 2 驗證 (FIX-089B 修復的直接依賴)

根據 FIX-089B 修復的 6 個位置,需要測試以下功能:

#### 1. project.getAll (Line 167) - 影響 Project List
- **測試頁面**: `/projects` (Project list)
- **測試重點**: budgetPool.totalAmount 顯示正常

#### 2. project.getById (Line 239) - 影響 Project Detail
- **測試頁面**: `/projects/[id]` (Project detail)
- **測試重點**: budgetPool.totalAmount 顯示正常,無 undefined 錯誤

#### 3. project.getStats (Line 499) - 影響 Dashboard
- **測試頁面**: `/dashboard` (Project Manager & Supervisor dashboard)
- **測試重點**: 預算池統計數據顯示正常

#### 4. project.export (Line 616, 873) - 影響 CSV Export
- **測試功能**: Dashboard export 功能
- **測試重點**: CSV 包含 budgetPool.totalAmount 欄位

#### 5. project.chargeOut (Line 966) - 影響 Expense Charge-out
- **測試功能**: Expense 費用轉嫁功能
- **測試重點**: 預算池扣款正常

### Layer 3 驗證 (系統冒煙測試)

#### Expense 相關頁面
- **expense.ts** 使用 `budgetPool: true` (Line 662),應該正常
- **測試頁面**: Expense approval, Expense list
- **測試重點**: 預算池資訊顯示,預算檢查功能

#### Dashboard 相關頁面
- **dashboard.ts** 使用 `budgetPool: true` (Line 373, 407),應該正常
- **測試頁面**: Dashboard home, Project export
- **測試重點**: 統計數據,CSV 導出

---

## 🧪 測試執行記錄

### Test Case 1: Project List Page

**URL**: `http://localhost:3000/zh-TW/projects`

**測試步驟**:
1. 訪問 Project list 頁面
2. 檢查頁面是否正常顯示
3. 檢查 budgetPool 資訊是否顯示
4. 檢查控制台是否有錯誤

**預期結果**:
- ✅ 頁面正常載入
- ✅ Project list 顯示
- ✅ 無 budgetPool.totalAmount undefined 錯誤
- ✅ 無控制台錯誤

**實際結果**: (待測試)

---

### Test Case 2: Project Detail Page

**URL**: `http://localhost:3000/zh-TW/projects/[id]`

**測試步驟**:
1. 從 Project list 點擊進入 Project detail
2. 檢查頁面是否正常顯示
3. 檢查預算池資訊區塊是否顯示 totalAmount
4. 檢查控制台是否有錯誤

**預期結果**:
- ✅ 頁面正常載入
- ✅ Project 詳細資訊顯示
- ✅ 預算池總金額顯示 (budgetPool.totalAmount.toLocaleString())
- ✅ 無控制台錯誤

**實際結果**: (待測試)

---

### Test Case 3: Project New Page

**URL**: `http://localhost:3000/zh-TW/projects/new`

**測試步驟**:
1. 訪問新增 Project 頁面
2. 檢查頁面是否正常顯示
3. 檢查表單是否可填寫
4. 檢查控制台是否有錯誤

**預期結果**:
- ✅ 頁面正常載入
- ✅ 表單可填寫
- ✅ Budget Pool 選擇器正常
- ✅ 無控制台錯誤

**實際結果**: (待測試)

---

### Test Case 4: Dashboard (Project Manager)

**URL**: `http://localhost:3000/zh-TW/dashboard`

**測試步驟**:
1. 以 Project Manager 身份登入
2. 訪問 Dashboard
3. 檢查統計卡片是否顯示
4. 檢查預算池資訊是否正常
5. 檢查控制台是否有錯誤

**預期結果**:
- ✅ Dashboard 正常載入
- ✅ 統計數據顯示
- ✅ 預算池概覽顯示
- ✅ 無控制台錯誤

**實際結果**: (待測試)

---

### Test Case 5: Dashboard (Supervisor)

**URL**: `http://localhost:3000/zh-TW/dashboard` (as Supervisor)

**測試步驟**:
1. 以 Supervisor 身份登入
2. 訪問 Dashboard
3. 檢查所有專案統計是否顯示
4. 檢查篩選功能是否正常
5. 檢查控制台是否有錯誤

**預期結果**:
- ✅ Dashboard 正常載入
- ✅ 全部專案統計顯示
- ✅ 篩選功能正常
- ✅ 無控制台錯誤

**實際結果**: (待測試)

---

### Test Case 6: Dashboard Export (CSV)

**URL**: `http://localhost:3000/zh-TW/dashboard` → Export button

**測試步驟**:
1. 訪問 Dashboard
2. 點擊 Export 按鈕
3. 檢查 CSV 是否下載
4. 打開 CSV 檢查是否包含 budgetPool totalAmount 欄位
5. 檢查控制台是否有錯誤

**預期結果**:
- ✅ CSV 成功下載
- ✅ CSV 包含 "預算池總額" 欄位
- ✅ 數值正確顯示
- ✅ 無控制台錯誤

**實際結果**: (待測試)

---

### Test Case 7: Expense List Page

**URL**: `http://localhost:3000/zh-TW/expenses`

**測試步驟**:
1. 訪問 Expense list 頁面
2. 檢查頁面是否正常顯示
3. 檢查 expense 資訊是否包含 budgetPool 資訊
4. 檢查控制台是否有錯誤

**預期結果**:
- ✅ 頁面正常載入
- ✅ Expense list 顯示
- ✅ 預算池資訊顯示 (如果有)
- ✅ 無控制台錯誤

**實際結果**: (待測試)

---

### Test Case 8: Expense Approval (Supervisor)

**URL**: `http://localhost:3000/zh-TW/expenses/[id]` → Approve

**測試步驟**:
1. 以 Supervisor 身份登入
2. 訪問待批准的 Expense
3. 點擊 Approve 按鈕
4. 檢查預算池餘額檢查是否正常
5. 檢查批准後預算池 usedAmount 是否更新
6. 檢查控制台是否有錯誤

**預期結果**:
- ✅ Expense approval 成功
- ✅ 預算池餘額檢查正常 (使用 budgetPool.totalAmount)
- ✅ usedAmount 正確更新
- ✅ 無控制台錯誤

**實際結果**: (待測試)

---

## 📊 測試結果摘要

### 測試統計
- **總測試案例**: 8 個
- **已執行**: 0 個
- **通過**: 0 個
- **失敗**: 0 個
- **待執行**: 8 個

### 問題分類
- **P0 (阻斷)**: 0 個
- **P1 (嚴重)**: 0 個
- **P2 (中等)**: 0 個
- **P3 (輕微)**: 0 個

---

## 🔍 測試注意事項

### 1. budgetPool.totalAmount 使用位置

根據 FIX-089B 分析:
- **project.ts**: 6 個位置 (已修復)
- **expense.ts**: 3 個位置 (使用 `budgetPool: true`,安全)
- **dashboard.ts**: 2 個位置 (使用 `budgetPool: true`,安全)

### 2. 測試重點

**關鍵驗證**:
1. Project detail 頁面的 `${project.budgetPool.totalAmount.toLocaleString()}` (Line 532)
2. Expense approval 的預算檢查 `budgetPool.totalAmount` (expense.ts:690)
3. Dashboard CSV export 的 `預算池總額: p.budgetPool.totalAmount` (dashboard.ts:443)

### 3. 測試環境

- **Browser**: Chrome/Edge (建議)
- **Dev Server**: http://localhost:3000
- **Database**: Local PostgreSQL (port 5434)
- **Test Data**: 使用現有 seed data

---

## ✅ 測試完成條件

1. 所有 8 個測試案例執行完成
2. 所有核心功能正常運作
3. 無 budgetPool.totalAmount undefined 錯誤
4. 無其他控制台錯誤
5. 測試結果記錄在此文件

---

**測試人員**: 開發團隊 + AI 助手
**測試狀態**: ⏳ 進行中
**最後更新**: 2025-11-12
