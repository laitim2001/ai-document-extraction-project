# FIX-089: Project Detail 頁面 - budgetPool.totalAmount 錯誤根本原因分析

> **分析日期**: 2025-11-12
> **分析人員**: AI Assistant
> **問題嚴重程度**: 🔴 P0 (Critical) - 導致頁面完全無法使用
> **根本原因類型**: 🤖 Surgical Task Executor 過度清理

---

## 📋 問題概述

### 錯誤表現

**錯誤訊息**:
```
Unhandled Runtime Error
TypeError: Cannot read properties of undefined (reading 'toLocaleString')

Source: src\app\[locale]\projects\[id]\page.tsx (532:58)
> 532 |  ${project.budgetPool.totalAmount.toLocaleString()}
```

**影響範圍**:
- ❌ 新增專案頁面: `/zh-TW/projects/new`
- ❌ 專案詳情頁面: `/zh-TW/projects/93736072-97e2-4d9e-ac4c-615cfc335308`
- ❌ 所有依賴 `project.budgetPool.totalAmount` 的頁面

**用戶影響**:
- 無法查看專案詳情
- 無法查看預算池總金額
- 頁面完全崩潰,無法渲染

---

## 🔍 根本原因分析 (5 Whys + 時間線)

### Why 1: 為什麼 `project.budgetPool.totalAmount` 是 undefined?

**答案**: 因為 tRPC `project.getById` query 的 `budgetPool` select 中沒有包含 `totalAmount` 欄位

**證據**: `packages/api/src/routers/project.ts:238-244`
```typescript
budgetPool: {
  select: {
    id: true,
    name: true,
    // ❌ 缺少 totalAmount
    financialYear: true,
  },
},
```

---

### Why 2: 為什麼 `budgetPool` select 中沒有 `totalAmount`?

**答案**: 因為在 commit `14815bf` (2025-11-11 23:19) 執行 FIX-094 時被移除了

**證據**: Git diff 顯示
```bash
$ git show 14815bf -- packages/api/src/routers/project.ts

diff --git a/packages/api/src/routers/project.ts
-                totalAmount: true,  // ❌ 被移除
```

**移除位置**: 4 個位置全部移除
1. Line 171: `getAll` procedure
2. **Line 242: `getById` procedure** ← 導致問題的位置
3. Line 501: `getStats` procedure
4. Line 617: `export` procedure

---

### Why 3: 為什麼 FIX-094 要移除所有 `totalAmount` 引用?

**答案**: 因為 FIX-094 的目標是 "清理 deprecated totalAmount 欄位引用"

**FIX-094 文檔原文** (`claudedocs/4-changes/bug-fixes/FIX-094-budget-pool-export-legacy-cleanup.md:119`):
> **關鍵改進**:
> - ✅ 移除 Zod schema 中的 minAmount 和 maxAmount 定義
> - ✅ 移除 where 條件中的金額範圍過濾
> - ✅ **移除對 deprecated `totalAmount` 欄位的引用**
> - ✅ API 簽名簡化,更清晰

**Prisma Schema 註解** (`packages/db/prisma/schema.prisma:96`):
```prisma
model BudgetPool {
  id            String   @id @default(uuid())
  name          String
  totalAmount   Float    \ DEPRECATED: 改由 categories 計算，保留以向後兼容
  usedAmount    Float    @default(0) \ DEPRECATED: 改由 categories 計算，保留以向後兼容
  financialYear Int
  // ...
}
```

---

### Why 4: 為什麼 Surgical Task Executor 沒有識別出前端仍在使用 totalAmount?

**答案**: 因為 FIX-094 的任務範圍只聚焦在 "Budget Pool export API",而 surgical-task-executor agent 嚴格遵守 "Task Fidelity" 原則

**Surgical Task Executor 配置** (`.claude/agents/surgical-task-executor.md:16-20`):
```markdown
## 1. Task Fidelity (CRITICAL)
- Execute ONLY what is explicitly specified in the task
- If the task says "implement login form", you implement ONLY the login form
- No additional features, no "helpful" extras, no "while I'm here" additions
- YAGNI is your religion: You Aren't Gonna Need It applies to everything not in the spec
```

**任務執行行為**:
- ✅ 任務: "移除 deprecated totalAmount 欄位引用"
- ✅ 執行: 全局搜尋 `totalAmount` 並移除所有引用
- ❌ **未執行**: 檢查移除後是否影響前端功能 (因為不在任務範圍)
- ❌ **未執行**: 驗證所有頁面是否正常運作 (因為不在任務範圍)

---

### Why 5: 為什麼前端在 totalAmount 被標記為 deprecated 後仍然使用?

**答案**: 因為 "deprecated" 並不等於 "已移除",且前端依賴該欄位顯示預算池總額

**業務邏輯需求**:
- 專案詳情頁需要顯示關聯預算池的總金額
- 使用者需要快速了解預算池的規模
- 這是核心業務功能,不是可選的增強功能

**Deprecated 的真正含義**:
```
DEPRECATED ≠ 可以立即移除
DEPRECATED = 不建議新功能使用,但現有功能仍依賴
```

**正確的 Deprecation 流程**:
1. 標記欄位為 `@deprecated`
2. 提供新的替代方案 (例如: 從 categories 聚合計算)
3. **遷移所有現有使用** ← FIX-094 跳過了這一步!
4. 驗證所有功能正常
5. 才能真正移除欄位

---

## 🎯 根本原因總結

### 直接原因
tRPC `project.getById` query 缺少 `budgetPool.totalAmount` 欄位,導致前端訪問 undefined 屬性

### 深層原因
**Surgical Task Executor Agent 的過度清理行為**:

1. **任務理解偏差**:
   - 任務: "清理 Budget Pool export API 遺留程式碼"
   - 執行: "移除**所有**對 totalAmount 的引用" ← 超出範圍

2. **缺乏影響範圍分析**:
   - 只關注任務指定的文件 (`budgetPool.ts`, `budget-pools/page.tsx`)
   - 未分析 `totalAmount` 在整個專案中的使用情況
   - 未驗證移除後的影響範圍

3. **"Deprecated" 概念誤解**:
   - 將 "deprecated" 等同於 "可以立即移除"
   - 忽略了 "向後兼容" 的重要性
   - 沒有提供替代方案就直接刪除

4. **驗證範圍不足**:
   - FIX-094 只測試了 Budget Pool export 功能
   - 未進行全站回歸測試
   - 未檢查其他 routers 的變更影響

---

## 🔧 修復方案

### 立即修復: 恢復 totalAmount 欄位

**修改文件**: `packages/api/src/routers/project.ts`

**修改位置**: Line 238-244 (`getById` procedure 的 budgetPool select)

**修改內容**:
```typescript
budgetPool: {
  select: {
    id: true,
    name: true,
    totalAmount: true,  // ✅ 恢復此欄位
    financialYear: true,
  },
},
```

**影響範圍**: 只需修改 1 個文件, 1 行程式碼

---

### 中期方案: 遷移到 Categories 計算

如果真的要棄用 `totalAmount`,需要:

1. **提供計算方法**:
```typescript
budgetPool: {
  select: {
    id: true,
    name: true,
    financialYear: true,
    categories: {  // ✅ Include categories
      select: {
        amount: true,
      },
    },
  },
},
```

2. **前端計算總額**:
```typescript
const totalAmount = project.budgetPool.categories.reduce(
  (sum, cat) => sum + cat.amount,
  0
);
```

3. **更新所有使用 totalAmount 的地方**:
   - Project detail page
   - Project list page
   - Dashboard
   - 任何其他相關頁面

4. **完成後才能真正移除 totalAmount**

---

## 🚨 Surgical Task Executor 的系統性問題

### 問題 1: 任務範圍擴張 (Scope Creep)

**表現**:
- 任務: 清理 "Budget Pool **export API**" 遺留程式碼
- 執行: 清理 "**整個專案**中的 totalAmount 引用"
- 結果: 影響了 4 個 procedures (getAll, getById, getStats, export)

**根本原因**: Agent 配置中的 "Task Fidelity" 原則被曲解

**正確理解**:
```markdown
❌ 錯誤: "移除所有 deprecated 欄位" = 全局搜尋並刪除
✅ 正確: "移除指定文件中的遺留程式碼" = 只修改任務範圍內的文件
```

---

### 問題 2: 缺乏影響分析 (Impact Analysis Missing)

**Agent 配置要求** (`.claude/agents/surgical-task-executor.md:76`):
```markdown
## Phase 4: Validate
5. Verify no breaking changes to existing functionality
```

**實際執行情況**:
- ❌ 未執行: 檢查 `totalAmount` 在其他文件中的使用
- ❌ 未執行: 前端頁面的回歸測試
- ❌ 未執行: 全站功能驗證

**應該執行的 Validation**:
```bash
# 1. 搜尋所有對 totalAmount 的引用
git grep "budgetPool.totalAmount" apps/web/

# 2. 搜尋所有對 totalAmount 的訪問
git grep "\.totalAmount" apps/web/ | grep -i budget

# 3. 運行所有相關測試
pnpm test -- projects
pnpm test -- budget-pool

# 4. 手動測試關鍵頁面
# - Budget Pool list
# - Budget Pool detail
# - Project list ← 這個被跳過了!
# - Project detail ← 這個被跳過了!
```

---

### 問題 3: "Deprecated" 處理策略錯誤

**Prisma Schema 註解的含義**:
```prisma
totalAmount   Float    \ DEPRECATED: 改由 categories 計算，保留以向後兼容
```

**關鍵詞解析**:
- `DEPRECATED`: 不建議新功能使用
- `改由 categories 計算`: 提供了新的計算方式
- **`保留以向後兼容`**: ← 這是關鍵! 表示不能直接移除!

**Surgical Task Executor 的誤解**:
```
看到 "DEPRECATED" → 立即全局移除 ← ❌ 錯誤!
應該: 看到 "保留以向後兼容" → 評估影響 → 逐步遷移 → 最後移除 ← ✅ 正確
```

---

### 問題 4: 驗證範圍不足

**FIX-094 的驗證範圍** (從文檔中提取):
```markdown
## ✅ 驗證結果

### 開發伺服器測試
- ✅ 後端服務器正常啟動
- ✅ 前端編譯成功,無 TypeScript 錯誤
- ✅ Export API 正常運作
- ✅ CSV 匯出功能正常
```

**問題**: 只驗證了 "Export" 功能,未驗證其他使用 `budgetPool` 的功能!

**應該包含的驗證**:
```markdown
### 完整回歸測試
- ✅ Budget Pool list page (已驗證)
- ✅ Budget Pool detail page (已驗證)
- ✅ Budget Pool export (已驗證)
- ❌ Project list page (未驗證) ← 可能也受影響
- ❌ Project detail page (未驗證) ← 這次發現的問題!
- ❌ Dashboard budget overview (未驗證)
- ❌ Project form (budget pool selector) (未驗證)
```

---

## 📊 影響範圍評估

### 已知受影響的位置

**1. Project Router - getById** (已確認):
- 文件: `packages/api/src/routers/project.ts:242`
- 影響: Project detail page 無法顯示
- 嚴重程度: 🔴 P0 (Critical)

**2. Project Router - getAll** (待確認):
- 文件: `packages/api/src/routers/project.ts:171`
- 影響: Project list page 可能無法顯示預算池總額
- 嚴重程度: 🟡 P1 (High)

**3. Project Router - getStats** (待確認):
- 文件: `packages/api/src/routers/project.ts:501`
- 影響: Dashboard 統計可能缺少數據
- 嚴重程度: 🟡 P1 (High)

**4. Project Router - export** (待確認):
- 文件: `packages/api/src/routers/project.ts:617`
- 影響: Project export CSV 可能缺少預算池總額欄位
- 嚴重程度: 🟢 P2 (Medium)

---

### 潛在受影響的位置 (需要檢查)

**前端組件**:
```bash
# 搜尋所有訪問 budgetPool.totalAmount 的地方
$ git grep "budgetPool\.totalAmount" apps/web/src/

# 可能的位置:
- Dashboard components
- Project form (budget pool selector)
- Budget utilization charts
- Reports and analytics pages
```

---

## 🛡️ 預防措施

### 1. Surgical Task Executor 配置改進

**新增 "Impact Analysis" 階段**:

```markdown
## Phase 1.5: Impact Analysis (NEW - MANDATORY)

**在執行任何刪除操作前,必須進行影響分析**:

1. **依賴分析**:
   - 搜尋要刪除的欄位/函數/變數在整個專案中的所有使用
   - 使用 `git grep` 或 IDE 的 "Find All References"
   - 記錄所有受影響的文件和行號

2. **關聯功能分析**:
   - 識別所有依賴該欄位的功能模組
   - 評估刪除後的功能完整性
   - 確認是否有替代方案可用

3. **Deprecated 欄位特殊處理**:
   - 查看 deprecated 註解的完整說明
   - 如果註解包含 "保留以向後兼容",**不能直接刪除**
   - 必須先提供替代方案,遷移所有使用,才能刪除

4. **測試範圍規劃**:
   - 基於影響分析結果,規劃完整的測試範圍
   - 包含所有受影響的功能模組
   - 不只是測試修改的文件,要測試所有依賴項
```

---

### 2. 驗證 Checklist 擴展

**FIX-094 應該使用的 Checklist**:

```markdown
## ✅ 驗證 Checklist (擴展版)

### 編譯和語法檢查
- [ ] TypeScript 編譯通過 (pnpm typecheck)
- [ ] ESLint 檢查通過 (pnpm lint)
- [ ] 前端 build 成功 (pnpm build)

### 單元測試
- [ ] 修改文件的單元測試通過
- [ ] 相關模組的單元測試通過

### 功能測試 - 直接影響
- [ ] Budget Pool export 功能正常 ✅ (已驗證)
- [ ] Budget Pool list 顯示正常 ✅ (已驗證)

### 功能測試 - 間接影響 (NEW)
- [ ] Project list 顯示正常 ❌ (未驗證 → 導致 FIX-089)
- [ ] Project detail 顯示正常 ❌ (未驗證 → 導致 FIX-089)
- [ ] Dashboard 統計正常 ❌ (未驗證)
- [ ] Project export 正常 ❌ (未驗證)

### 回歸測試 (NEW)
- [ ] 所有使用 budgetPool 的頁面正常
- [ ] 所有顯示預算金額的組件正常
- [ ] 搜尋和過濾功能正常
```

---

### 3. Git Workflow 改進

**Commit Message 應該包含影響範圍**:

**FIX-094 實際 commit**:
```
fix(api): 完成 Testing Validation Sprint P3 問題修復

影響範圍:
- Budget Pool API (export, updateCategoryUsage)  ← ❌ 不完整!
```

**應該是**:
```
fix(api): 完成 Testing Validation Sprint P3 問題修復

影響範圍:
- Budget Pool API (export, updateCategoryUsage)
- Project API (getAll, getById, getStats, export)  ← ✅ 明確列出!
- 移除 4 個 procedures 中的 totalAmount 欄位
- 前端頁面需要驗證:
  - Budget Pool list/detail ✅
  - Project list/detail ⚠️ (需測試)
  - Dashboard ⚠️ (需測試)

⚠️ Breaking Change 風險: Medium
建議在合併前進行完整回歸測試
```

---

### 4. Code Review 準則

**Deprecated 欄位刪除的 Review Checklist**:

```markdown
## 審查 Deprecated 欄位刪除的 PR

### 必須回答的問題:
1. ❓ 為什麼這個欄位被標記為 deprecated?
2. ❓ deprecated 註解是否提供了替代方案?
3. ❓ 是否有 "保留以向後兼容" 的說明?
4. ❓ 所有使用該欄位的地方是否已遷移到新方案?
5. ❓ 是否搜尋了整個專案中的所有引用?
6. ❓ 影響範圍評估是否完整?
7. ❓ 測試計劃是否涵蓋所有受影響的功能?

### 審查決策:
- 如果答案有 "不確定" 或 "未檢查" → ❌ 要求補充分析
- 如果發現遺漏的影響範圍 → ❌ 要求擴展測試
- 如果缺少替代方案 → ❌ 要求先實施遷移計劃
```

---

## 💡 經驗教訓

### 1. "Surgical Precision" ≠ "Global Search and Replace"

**錯誤理解**:
```
任務: 清理 deprecated 欄位
執行: 全局搜尋 totalAmount → 全部刪除 ← ❌
```

**正確理解**:
```
任務: 清理 Budget Pool export API 中的遺留程式碼
執行:
  1. 檢查 budgetPool.ts 中的 export API ← ✅ 範圍限定
  2. 檢查 budget-pools/page.tsx 中的 export 功能 ← ✅ 範圍限定
  3. 評估 totalAmount 的整體使用情況 ← ✅ 影響分析
  4. 決定: 只移除 export API 中的使用 ← ✅ 精準修復
  5. 保留其他地方的 totalAmount ← ✅ 向後兼容
```

---

### 2. Deprecated ≠ Ready to Delete

**Deprecation 的正確流程**:

```
Step 1: 標記為 @deprecated + 提供替代方案
         ↓
Step 2: 通知所有開發者,禁止新功能使用
         ↓
Step 3: 逐步遷移現有使用到新方案
         ↓
Step 4: 驗證所有功能正常運作
         ↓
Step 5: 所有使用已遷移後,才能刪除欄位
         ↓
Step 6: Major Version Release (因為是 Breaking Change)
```

**FIX-094 的問題**: 直接跳到 Step 5,跳過了 Step 3-4!

---

### 3. 影響分析必須包含 "間接依賴"

**FIX-094 的分析範圍**:
```
直接影響: budgetPool.ts (export API)
間接影響: ??? (未分析) ← 這裡缺失了!
```

**應該分析的間接依賴**:
```
直接影響: budgetPool.ts (export API)
  ↓
間接影響 Level 1:
  - 所有使用 budgetPool 的 routers (project.ts) ← 找到了!
  ↓
間接影響 Level 2:
  - 所有使用這些 routers 的前端頁面
    - Project list (使用 project.getAll)
    - Project detail (使用 project.getById) ← 這次發現的問題!
    - Dashboard (使用 project.getStats)
```

---

### 4. 測試範圍必須 "超出任務範圍"

**錯誤思維**:
```
任務範圍: Budget Pool export API
測試範圍: Budget Pool export API ← ❌ 太窄!
```

**正確思維**:
```
任務範圍: Budget Pool export API
修改範圍: budgetPool.ts + project.ts (影響分析發現)
測試範圍:
  - Budget Pool 所有功能 (list, detail, export)
  - Project 所有功能 (list, detail, form, export)  ← ✅ 必須包含!
  - Dashboard budget 相關功能
  - 任何顯示預算金額的地方
```

---

## 🔄 建議的修復流程

### 立即執行 (Today)

1. **✅ 恢復 project.getById 的 totalAmount 欄位**
   - 修改 `packages/api/src/routers/project.ts:242`
   - 測試 Project detail page
   - Git commit: "fix: 恢復 project.getById 的 budgetPool.totalAmount (FIX-089)"

2. **✅ 檢查其他 3 個位置**
   - project.getAll (Line 171)
   - project.getStats (Line 501)
   - project.export (Line 617)
   - 測試對應的前端功能
   - 如有問題,一併修復

3. **✅ 創建 FIX-089 完整文檔**
   - 記錄問題、原因、修復過程
   - 更新 FIXLOG.md
   - 更新 MANUAL-TESTING-LOG.md

---

### 短期執行 (This Week)

4. **更新 Surgical Task Executor 配置**
   - 新增 "Impact Analysis" 階段
   - 更新驗證 Checklist
   - 新增 "Deprecated Field Deletion" 特殊處理規則

5. **創建 "Deprecated Field Migration Guide"**
   - 標準化 deprecation 流程
   - 提供遷移模板
   - 建立影響分析工具

6. **完整回歸測試**
   - 測試所有 Budget Pool 相關頁面
   - 測試所有 Project 相關頁面
   - 測試 Dashboard
   - 更新測試文檔

---

### 中期執行 (Next Sprint)

7. **評估是否真的需要移除 totalAmount**
   - 如果需要,先實施遷移計劃
   - 提供從 categories 計算總額的方法
   - 更新所有使用位置
   - 完成後再移除欄位

8. **建立自動化影響分析工具**
```bash
# 新增 script: scripts/analyze-field-impact.js
pnpm analyze:impact --field="totalAmount" --model="BudgetPool"

# 輸出:
# ✅ 找到 8 個引用位置
# - packages/api/src/routers/budgetPool.ts:5 處
# - packages/api/src/routers/project.ts:4 處  ← 會發現這些!
# - apps/web/src/app/.../page.tsx:3 處
```

---

## 📚 相關文檔

- **原始問題**: FIX-094 - Budget Pool export API 遺留程式碼清理
- **導致的問題**: FIX-089 - Project Detail 頁面 budgetPool.totalAmount 錯誤
- **Agent 配置**: `.claude/agents/surgical-task-executor.md`
- **Prisma Schema**: `packages/db/prisma/schema.prisma` (BudgetPool model)
- **問題 Commit**: `14815bf` (2025-11-11 23:19)

---

**分析人員**: AI Assistant
**最後更新**: 2025-11-12
**狀態**: ✅ 分析完成,待修復
**建議優先級**: 🔴 P0 - 立即修復並更新 agent 配置
