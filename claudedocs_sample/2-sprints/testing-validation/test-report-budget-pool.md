# 測試報告: 預算池模組 (Budget Pool Module)

> **測試日期**: 2025-11-10
> **測試人員**: AI 助手
> **測試環境**: http://localhost:3001 (開發環境)
> **測試範圍**: Budget Pool 模組完整功能測試

---

## 📋 測試概要

### 測試頁面
- `/budget-pools` - 預算池列表頁 (卡片視圖 + 列表視圖)
- `/budget-pools/new` - 創建新預算池
- `/budget-pools/[id]` - 預算池詳情頁
- `/budget-pools/[id]/edit` - 編輯預算池

### 測試狀態
- ✅ 已完成: 0 項
- 🔄 進行中: 程式碼審查階段
- ⏳ 待測試: 所有功能項目

---

## 🔍 程式碼審查發現

### 1. ✅ 前端實作分析 (`page.tsx`)

**優點**:
- ✅ **雙視圖支援**: 卡片視圖 + 列表視圖,使用者體驗良好
- ✅ **搜尋優化**: 使用 useDebounce (300ms) 避免過多 API 請求
- ✅ **光標位置保持**: 搜尋時保持輸入框焦點和光標位置 (良好的 UX 細節)
- ✅ **分頁支援**: 完整的分頁控制
- ✅ **多重篩選**: 搜尋、年度篩選、排序 (name/year/amount, asc/desc)
- ✅ **CSV 匯出**: 使用 tRPC client 呼叫 `budgetPool.export`
- ✅ **即時計算**: 使用率顏色編碼 (綠色 <75%, 黃色 75-90%, 紅色 >90%)
- ✅ **錯誤處理**: 完整的 Loading/Error 狀態處理
- ✅ **麵包屑導航**: 清晰的頁面導航結構

**新功能** (使用 BudgetCategory):
- ✅ `computedTotalAmount`: 從 categories 累加總預算 (取代舊的 totalAmount)
- ✅ `computedUsedAmount`: 從 categories 累加已用金額 (取代舊的 usedAmount)
- ✅ `categor Count`: 顯示類別數量
- ✅ `utilizationRate`: 即時計算使用率

**潛在問題**:
- ⚠️ **未測試**: 需要實際測試搜尋框焦點保持功能是否正常
- ⚠️ **CSV 匯出**: 需要測試匯出的資料格式和內容正確性
- ⚠️ **空狀態**: 需要測試無資料時的顯示是否正確

---

### 2. ✅ 後端 API 分析 (`budgetPool.ts`)

**API 路由**:
1. `getAll` - 獲取所有預算池 (分頁、搜尋、篩選、排序)
2. `getById` - 獲取單個預算池詳情
3. `getByYear` - 按財務年度獲取預算池
4. `create` - 創建新預算池 (含類別)
5. `update` - 更新預算池 (含類別)
6. `delete` - 刪除預算池 (檢查關聯專案)
7. `getStats` - 獲取預算池統計 (已分配、已支出、剩餘)
8. `export` - 匯出預算池資料 (CSV)
9. `getCategories` - 獲取預算池的所有類別
10. `getCategoryStats` - 獲取類別統計
11. `updateCategoryUsage` - 更新類別已用金額 (費用轉嫁)

**優點**:
- ✅ **Transaction 支援**: `update` 使用 Prisma transaction 確保資料一致性
- ✅ **計算邏輯**: `getAll` 和 `getById` 都正確計算 `computedTotalAmount` 和 `computedUsedAmount`
- ✅ **刪除驗證**: `delete` 檢查是否有關聯專案,防止資料不一致
- ✅ **預算超支檢查**: `updateCategoryUsage` 檢查是否超支,超支時回滾操作
- ✅ **錯誤處理**: 使用 TRPCError 提供清晰的錯誤訊息
- ✅ **Zod 驗證**: 完整的輸入驗證 schema

**潛在問題**:
- ⚠️ **getStats 使用舊邏輯**: `getStats` 仍使用 `budgetPool.totalAmount` (舊欄位),未使用 categories 累加
  - 行 371: `const remaining = budgetPool.totalAmount - totalAllocated;`
  - 行 372: `const utilizationRate = (totalAllocated / budgetPool.totalAmount) * 100;`
  - **建議**: 應改為從 categories 累加 totalAmount

- ⚠️ **export 使用舊邏輯**: `export` 仍使用 `totalAmount` 和 `usedAmount` (舊欄位)
  - 行 405-407: 篩選條件使用 `totalAmount`
  - **建議**: 應改為從 categories 累加或移除金額篩選

- ⚠️ **updateCategoryUsage 驗證邏輯**: 超支檢查在更新後才檢查,可能導致短暫的資料不一致
  - **建議**: 應在更新前檢查,或使用資料庫層級的 CHECK 約束

---

## 📝 待測試項目清單

### CRUD 操作測試

#### ✅ 1.1 查看預算池列表 (Read - List)
- [ ] **測試步驟**:
  1. 訪問 http://localhost:3001/zh-TW/budget-pools
  2. 驗證頁面載入成功
  3. 驗證顯示預算池卡片 (或列表)
  4. 驗證每個卡片顯示: 名稱、財務年度、類別數量、總預算、已用金額、使用率、專案數量
  5. 驗證使用率顏色正確 (綠色 <75%, 黃色 75-90%, 紅色 >90%)
  6. 驗證分頁控制正常

- [ ] **預期結果**: 正確顯示所有預算池,資料完整,顏色編碼正確

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.2 搜尋預算池 (Search)
- [ ] **測試步驟**:
  1. 在搜尋框輸入預算池名稱 (部分匹配)
  2. 等待 300ms (debounce)
  3. 驗證列表更新為搜尋結果
  4. 驗證搜尋框焦點保持,光標位置不變
  5. 清空搜尋框,驗證顯示所有預算池

- [ ] **預期結果**: 搜尋即時響應,焦點和光標位置保持,結果正確

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.3 篩選預算池 (Filter by Year)
- [ ] **測試步驟**:
  1. 選擇財務年度 (例如: FY 2025)
  2. 驗證列表只顯示該年度的預算池
  3. 選擇 "所有年度",驗證顯示所有預算池

- [ ] **預期結果**: 篩選結果正確,切換流暢

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.4 排序預算池 (Sort)
- [ ] **測試步驟**:
  1. 測試排序選項:
     - 年度降序 (預設)
     - 年度升序
     - 名稱升序
     - 名稱降序
     - 金額降序
     - 金額升序
  2. 驗證每次排序結果正確

- [ ] **預期結果**: 排序邏輯正確,結果符合預期

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.5 切換視圖模式 (Card/List View)
- [ ] **測試步驟**:
  1. 點擊 "卡片視圖" 按鈕,驗證顯示卡片
  2. 點擊 "列表視圖" 按鈕,驗證顯示表格
  3. 驗證兩種視圖顯示的資料一致

- [ ] **預期結果**: 視圖切換流暢,資料一致

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.6 匯出 CSV (Export)
- [ ] **測試步驟**:
  1. 點擊 "匯出 CSV" 按鈕
  2. 等待匯出完成
  3. 下載 CSV 檔案
  4. 開啟 CSV,驗證資料格式和內容
  5. 驗證 CSV 包含: 名稱、財務年度、總預算、已用金額、專案數量

- [ ] **預期結果**: CSV 匯出成功,資料完整正確

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

- [ ] **⚠️ 已知問題**: `export` API 使用舊的 `totalAmount` 和 `usedAmount` 欄位,可能與顯示的資料不一致

---

#### ✅ 1.7 查看預算池詳情 (Read - Detail)
- [ ] **測試步驟**:
  1. 點擊任一預算池卡片 (或列表中的 "查看")
  2. 驗證跳轉到詳情頁 `/budget-pools/[id]`
  3. 驗證顯示基本資訊: 名稱、財務年度、描述、總預算、已用金額、使用率
  4. 驗證顯示所有類別 (BudgetCategory):
     - 類別名稱、類別代碼、總金額、已用金額、使用率
  5. 驗證顯示關聯專案列表:
     - 專案名稱、狀態、經理、請求預算、批准預算
  6. 驗證麵包屑導航正確

- [ ] **預期結果**: 詳情頁資料完整,類別和專案顯示正確

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.8 創建新預算池 (Create)
- [ ] **測試步驟**:
  1. 點擊 "創建預算池" 按鈕
  2. 跳轉到 `/budget-pools/new`
  3. 填寫表單:
     - 名稱: "測試預算池 2025"
     - 財務年度: 2025
     - 描述: "測試用預算池"
     - 類別 1: 名稱 "人力成本", 代碼 "HR", 金額 100000
     - 類別 2: 名稱 "軟體授權", 代碼 "SW", 金額 50000
  4. 點擊 "提交"
  5. 驗證顯示成功訊息
  6. 驗證跳轉回列表頁
  7. 驗證新預算池顯示在列表中

- [ ] **預期結果**: 創建成功,資料儲存正確,類別顯示正確

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.9 表單驗證 (Create - Validation)
- [ ] **測試步驟**:
  1. 嘗試提交空表單,驗證錯誤訊息
  2. 測試以下驗證規則:
     - 名稱必填 (min: 1, max: 255)
     - 財務年度必填 (2000-2100)
     - 至少一個類別 (min: 1)
     - 類別名稱必填
     - 類別金額 ≥ 0
  3. 驗證錯誤訊息清晰

- [ ] **預期結果**: 驗證邏輯正確,錯誤訊息清晰

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.10 編輯預算池 (Update)
- [ ] **測試步驟**:
  1. 進入預算池詳情頁
  2. 點擊 "編輯" 按鈕
  3. 跳轉到 `/budget-pools/[id]/edit`
  4. 修改資料:
     - 名稱: "測試預算池 2025 (已修改)"
     - 描述: "修改後的描述"
     - 修改類別 1 金額: 120000 (原 100000)
     - 新增類別 3: "硬體設備", "HW", 80000
  5. 點擊 "提交"
  6. 驗證顯示成功訊息
  7. 驗證跳轉回詳情頁
  8. 驗證修改已生效

- [ ] **預期結果**: 更新成功,資料正確,Transaction 確保一致性

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.11 刪除預算池 (Delete - Success)
- [ ] **測試步驟**:
  1. 創建一個新預算池 (無關聯專案)
  2. 進入詳情頁
  3. 點擊 "刪除" 按鈕
  4. 確認刪除對話框
  5. 驗證顯示成功訊息
  6. 驗證跳轉回列表頁
  7. 驗證預算池已從列表中移除

- [ ] **預期結果**: 刪除成功,列表更新正確

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 1.12 刪除預算池 (Delete - With Projects)
- [ ] **測試步驟**:
  1. 選擇一個有關聯專案的預算池
  2. 嘗試刪除
  3. 驗證顯示錯誤訊息: "Cannot delete budget pool with existing projects..."
  4. 驗證預算池未被刪除

- [ ] **預期結果**: 刪除被阻止,錯誤訊息清晰

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

### 即時追蹤測試 (Epic 6.5)

#### ✅ 2.1 Budget Category 即時更新
- [ ] **測試步驟**:
  1. 查看預算池詳情頁,記錄類別的 `usedAmount`
  2. 創建一個專案,關聯到該預算池的某個類別
  3. 創建一個支出,關聯到該專案,金額 10000
  4. 提交支出審核 → 批准支出
  5. 返回預算池詳情頁,刷新
  6. 驗證類別的 `usedAmount` 增加 10000
  7. 驗證類別的使用率正確更新

- [ ] **預期結果**: `usedAmount` 即時更新,使用率計算正確

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 2.2 Budget Pool 總計正確
- [ ] **測試步驟**:
  1. 查看預算池詳情頁
  2. 手動計算: `computedTotalAmount` = sum(categories.totalAmount)
  3. 手動計算: `computedUsedAmount` = sum(categories.usedAmount)
  4. 手動計算: `utilizationRate` = (computedUsedAmount / computedTotalAmount) * 100
  5. 驗證顯示的總計與手動計算一致

- [ ] **預期結果**: 總計計算正確,無四捨五入誤差

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 2.3 使用率顏色編碼
- [ ] **測試步驟**:
  1. 測試使用率 < 75%: 驗證顯示綠色
  2. 測試使用率 75-90%: 驗證顯示黃色
  3. 測試使用率 > 90%: 驗證顯示紅色

- [ ] **預期結果**: 顏色編碼正確,閾值準確

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

### 資料驗證測試

#### ✅ 3.1 重複名稱檢查
- [ ] **測試步驟**:
  1. 創建預算池 "IT 預算 2025"
  2. 嘗試創建另一個預算池 "IT 預算 2025"
  3. 驗證是否顯示錯誤訊息 (或允許重複?)

- [ ] **預期結果**: _待確認業務邏輯_ (允許重複 OR 阻止重複)

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

- [ ] **⚠️ 疑問**: Prisma schema 未定義 `@@unique` 約束,是否允許重複名稱?

---

#### ✅ 3.2 財務年度格式驗證
- [ ] **測試步驟**:
  1. 嘗試輸入無效年度: 1999 (< 2000)
  2. 嘗試輸入無效年度: 2101 (> 2100)
  3. 驗證錯誤訊息

- [ ] **預期結果**: 驗證邏輯正確,範圍 2000-2100

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 3.3 類別金額非負驗證
- [ ] **測試步驟**:
  1. 嘗試輸入負數金額: -10000
  2. 驗證錯誤訊息: "Amount must be non-negative"

- [ ] **預期結果**: 驗證邏輯正確,阻止負數

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

### 權限控制測試

#### ✅ 4.1 PM 角色權限
- [ ] **測試步驟**:
  1. 以 PM 角色登入
  2. 訪問 `/budget-pools`
  3. 驗證可以查看列表
  4. 驗證可以創建預算池
  5. 驗證可以編輯預算池
  6. 驗證_不可_刪除預算池 (或可刪除?)

- [ ] **預期結果**: PM 有查看、創建、編輯權限

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

- [ ] **⚠️ 疑問**: PM 是否有刪除權限? (需確認業務邏輯)

---

#### ✅ 4.2 Supervisor 角色權限
- [ ] **測試步驟**:
  1. 以 Supervisor 角色登入
  2. 訪問 `/budget-pools`
  3. 驗證可以查看所有預算池
  4. 驗證可以創建、編輯、刪除預算池

- [ ] **預期結果**: Supervisor 有完整權限

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

#### ✅ 4.3 未登入無法訪問
- [ ] **測試步驟**:
  1. 登出系統
  2. 直接訪問 `/budget-pools`
  3. 驗證跳轉到登入頁

- [ ] **預期結果**: 未登入無法訪問,跳轉到登入頁

- [ ] **實際結果**: _待填寫_

- [ ] **問題記錄**: _待填寫_

---

## 🐛 已識別問題 (Code Review)

### 🔴 P1 問題: getStats API 使用舊欄位
**檔案**: `packages/api/src/routers/budgetPool.ts:371-372`

**問題描述**:
`getStats` 仍使用 `budgetPool.totalAmount` (舊欄位),未從 categories 累加。這會導致統計資料與列表頁/詳情頁顯示的資料不一致。

**程式碼**:
```typescript
const remaining = budgetPool.totalAmount - totalAllocated; // ❌ 使用舊欄位
const utilizationRate = (totalAllocated / budgetPool.totalAmount) * 100; // ❌ 使用舊欄位
```

**建議修復**:
```typescript
// 從 categories 累加總預算
const totalAmount = categories.reduce((sum, cat) => sum + cat.totalAmount, 0);
const remaining = totalAmount - totalAllocated;
const utilizationRate = (totalAllocated / totalAmount) * 100;
```

**影響範圍**: 預算池統計頁面 (若有)

**優先級**: 🟠 P1 (高優先級 - 資料不一致)

---

### 🟡 P2 問題: export API 使用舊欄位
**檔案**: `packages/api/src/routers/budgetPool.ts:405-407`

**問題描述**:
`export` API 的篩選條件使用 `totalAmount` (舊欄位),且匯出的資料也使用 `totalAmount` 和 `usedAmount` (舊欄位)。

**程式碼**:
```typescript
input?.minAmount ? { totalAmount: { gte: input.minAmount } } : {}, // ❌ 使用舊欄位
input?.maxAmount ? { totalAmount: { lte: input.maxAmount } } : {}, // ❌ 使用舊欄位
```

**建議修復**:
1. 移除金額篩選 (因為 totalAmount 已 deprecated)
2. 或在查詢後過濾 (從 categories 累加後再篩選)
3. 匯出時從 categories 累加 totalAmount 和 usedAmount

**影響範圍**: CSV 匯出功能

**優先級**: 🟡 P2 (中優先級 - 功能可用但資料可能不準)

---

### 🟡 P2 問題: updateCategoryUsage 超支檢查時機
**檔案**: `packages/api/src/routers/budgetPool.ts:553-568`

**問題描述**:
超支檢查在更新 `usedAmount` 後才檢查,可能導致短暫的資料不一致 (雖然會回滾)。

**程式碼**:
```typescript
const updated = await ctx.prisma.budgetCategory.update({
  where: { id: input.categoryId },
  data: {
    usedAmount: {
      increment: input.amount,
    },
  },
});

// 驗證不會超過總預算（僅在增加時檢查）
if (input.amount > 0 && updated.usedAmount > updated.totalAmount) {
  // 回滾操作
  await ctx.prisma.budgetCategory.update({ ... });
  throw new TRPCError({ ... });
}
```

**建議修復**:
在更新前先檢查:
```typescript
if (input.amount > 0) {
  const newUsedAmount = category.usedAmount + input.amount;
  if (newUsedAmount > category.totalAmount) {
    throw new TRPCError({ ... });
  }
}

// 然後才更新
const updated = await ctx.prisma.budgetCategory.update({ ... });
```

**影響範圍**: 費用轉嫁邏輯

**優先級**: 🟡 P2 (中優先級 - 功能正常但邏輯可優化)

---

### 🟢 P3 問題: 重複名稱檢查缺失
**檔案**: `packages/db/prisma/schema.prisma`

**問題描述**:
BudgetPool 的 `name` 欄位未定義 `@@unique` 約束,可能允許創建重複名稱的預算池。

**建議**:
1. 確認業務邏輯: 是否允許重複名稱?
2. 若不允許,在 Prisma schema 添加:
   ```prisma
   model BudgetPool {
     // ...
     @@unique([name, financialYear]) // 同一年度不可重複名稱
   }
   ```
3. 或在 `create` API 添加重複檢查邏輯

**影響範圍**: 預算池創建

**優先級**: 🟢 P3 (低優先級 - 需確認業務需求)

---

## 📊 測試統計

### 完成度
- **總測試項目**: 25 項
- **已完成**: 0 項 (0%)
- **進行中**: 1 項 (程式碼審查)
- **待測試**: 24 項

### 問題統計
- **🔴 P0 Critical**: 0 個
- **🟠 P1 High**: 1 個 (getStats 使用舊欄位)
- **🟡 P2 Medium**: 2 個 (export 使用舊欄位, updateCategoryUsage 邏輯)
- **🟢 P3 Low**: 1 個 (重複名稱檢查)

---

## ⏭️ 下一步行動

1. **開始手動測試**: 按照測試清單逐項測試
2. **修復 P1 問題**: 優先修復 getStats API
3. **修復 P2 問題**: 優化 export 和 updateCategoryUsage
4. **確認業務邏輯**: 重複名稱是否允許?
5. **記錄所有測試結果**: 更新測試報告

---

**測試人員**: AI 助手
**最後更新**: 2025-11-10
**狀態**: 🔄 程式碼審查完成,等待手動測試
