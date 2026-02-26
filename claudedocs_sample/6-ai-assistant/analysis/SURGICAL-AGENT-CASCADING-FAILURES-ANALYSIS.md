# Surgical Task Executor 連鎖失敗深度分析

> **分析日期**: 2025-11-12
> **問題嚴重程度**: 🔴 Critical - 系統性問題導致連鎖失敗
> **影響範圍**: 所有使用 surgical-task-executor 的任務

---

## 📋 問題陳述

**用戶觀察**:
> "我有留意到通常都會因為運用了 surgical-task-executor,而令到一些原本已經沒問題的頁面或功能突然又出現了報錯"

**本次具體表現**:
1. **FIX-094** (2025-11-11): 使用 surgical-task-executor 清理 Budget Pool export API
2. **連鎖影響**: 導致 Project Detail 頁面崩潰 (FIX-089)
3. **二次失敗**: 第一次修復 (FIX-089) 也使用了錯誤的工具策略,導致修復不完整 (FIX-089B)

**問題本質**:
這不是偶發事件,而是 **surgical-task-executor agent 的系統性設計缺陷** 導致的連鎖失敗模式。

---

## 🔍 深度根本原因分析

### 問題 1: "Surgical Precision" 概念的誤解

#### Surgical-Task-Executor 的設計理念

**Agent 配置** (`.claude/agents/surgical-task-executor.md:9-12`):
```markdown
You are a Surgical Task Executor - an elite AI software engineer specialized
in executing single, concrete tasks with absolute precision and zero deviation
from specifications.

You operate like a surgical team in an operating room: focused, methodical,
precise, and completely dedicated to the specific procedure at hand.
```

**關鍵詞解析**:
- "surgical team" (外科手術團隊)
- "focused, methodical, precise" (專注、有條理、精確)
- "specific procedure" (特定程序)

#### 問題: "Precision" 被錯誤理解為 "Isolation"

**設計者的期望**:
```
Surgical Precision =
  只做任務要求的事 +
  做得非常精確 +
  不添加額外功能
```

**實際執行的理解**:
```
Surgical Precision =
  只看任務範圍內的代碼 +
  忽略任務範圍外的影響 +
  不檢查連鎖反應
```

**真實的外科手術**:
```
外科醫生在手術前會:
✅ 檢查患者的整體健康狀況
✅ 評估手術對其他器官的影響
✅ 準備應對連鎖反應的預案
✅ 術後監測所有生命體徵

surgical-task-executor 實際做的:
❌ 只看要修復的 "器官" (Budget Pool export API)
❌ 不檢查對其他 "器官" (Project API) 的影響
❌ 不監測 "生命體徵" (其他頁面是否正常)
❌ 聲稱 "手術成功" 但患者 (系統) 其他部位出現併發症
```

---

### 問題 2: Task Fidelity 原則的過度執行

#### Agent 配置的 Task Fidelity 原則

**配置** (`.claude/agents/surgical-task-executor.md:16-20`):
```markdown
## 1. Task Fidelity (CRITICAL)
- Execute ONLY what is explicitly specified in the task
- If the task says "implement login form", you implement ONLY the login form
- No additional features, no "helpful" extras, no "while I'm here" additions
- YAGNI is your religion: You Aren't Gonna Need It applies to everything not in the spec
```

**設計目的** (正確):
防止功能範圍蔓延 (scope creep),避免添加不必要的功能

**實際效果** (錯誤):
**也防止了必要的影響分析和驗證**

#### FIX-094 的執行過程

**任務描述**:
```
清理 Budget Pool export API 的遺留程式碼
- 移除未使用的 minAmount/maxAmount 參數
- 清理 deprecated totalAmount 欄位引用
```

**Agent 的理解**:
```
Task Scope (任務範圍):
  ✅ budgetPool.ts 的 export API
  ✅ budget-pools/page.tsx 的 export 功能
  ❌ 其他使用 totalAmount 的地方 ← 認為是 "範圍外"
```

**Agent 的執行**:
```
1. 搜尋所有 "totalAmount" 引用
2. 發現在 budgetPool.ts 和 project.ts 中都有使用
3. 決策:
   - budgetPool.ts: 在任務範圍內 → 移除 ✅
   - project.ts: ???
```

**錯誤的決策邏輯**:
```
if (file == "budgetPool.ts"):
    移除 totalAmount  # 任務範圍內
else if (file == "project.ts"):
    totalAmount 是 deprecated 的
    → 也應該移除  # ← 錯誤! 超出任務範圍!
```

**正確的決策邏輯應該是**:
```
if (file == "budgetPool.ts"):
    if (在 export API 範圍內):
        移除 totalAmount
    else:
        保留 (因為不在任務範圍)

else if (file == "project.ts"):
    ⚠️ 警告: 發現任務範圍外的 totalAmount 使用
    → 不應該修改 (超出任務範圍)
    → 報告給用戶: "發現其他文件也使用 totalAmount,是否也要清理?"
```

---

### 問題 3: 缺少 "Impact Analysis" 階段

#### Agent 配置的執行流程

**當前流程** (`.claude/agents/surgical-task-executor.md:47-83`):
```markdown
## Phase 1: Understand (MANDATORY)
1. Read the task specification completely
2. Identify all explicit requirements
3. Review relevant existing code and patterns
4. Check documentation
5. Clarify any ambiguities BEFORE starting implementation

## Phase 2: Plan
...

## Phase 3: Execute
...

## Phase 4: Validate
1. Run relevant tests
2. Verify functionality matches specification exactly
3. Check for type errors
4. Run linter
5. Verify no breaking changes to existing functionality  ← 問題在這裡!
```

**Phase 4 的問題**:
```
"Verify no breaking changes to existing functionality"

問題: 什麼是 "existing functionality"?
Agent 的理解: 任務範圍內的功能
應該的理解: 整個系統的功能
```

#### 缺少的 "Impact Analysis" 階段

**應該在 Phase 1 和 Phase 2 之間插入**:

```markdown
## Phase 1.5: Impact Analysis (NEW - MANDATORY)

在執行任何修改或刪除操作前,必須進行影響分析:

### 1. 依賴分析 (Dependency Analysis)
- 搜尋要修改/刪除的元素在整個專案中的所有使用
- 工具: `git grep`, `ripgrep`, IDE "Find All References"
- 記錄所有受影響的文件和行號

### 2. 關聯功能分析 (Associated Feature Analysis)
- 識別所有依賴該元素的功能模組
- 評估修改/刪除後的功能完整性
- 確認是否有替代方案可用

### 3. Deprecated 元素特殊處理
- 查看 deprecated 註解的完整說明
- 特別注意 "保留以向後兼容" 等關鍵詞
- 規則: 如果註解包含 "保留"、"向後兼容"、"暫時保留"
  → 不能直接刪除
  → 必須先提供替代方案並遷移所有使用

### 4. 測試範圍規劃
- 基於影響分析結果,規劃完整的測試範圍
- 測試範圍 = 任務範圍 + 所有間接影響的功能
- 測試層級:
  - Layer 1: 直接修改的代碼
  - Layer 2: 直接依賴的功能 (Level 1 dependencies)
  - Layer 3: 間接依賴的功能 (Level 2+ dependencies)

### 5. 影響評估報告
- 生成影響範圍報告
- 包含:
  - 直接影響: X 個文件, Y 個函數
  - 間接影響: Z 個功能模組
  - 需要測試的頁面/功能列表
  - 預估風險等級 (Low/Medium/High/Critical)

### 6. 用戶確認 (High/Critical Risk)
- 如果風險等級 >= High:
  - 向用戶報告影響範圍
  - 請求確認是否繼續
  - 提供建議的替代方案
```

---

### 問題 4: Validation 範圍的系統性不足

#### 當前的 Validation Phase

**配置** (`.claude/agents/surgical-task-executor.md:71-76`):
```markdown
## Phase 4: Validate
1. Run relevant tests (unit, integration, E2E as applicable)
2. Verify functionality matches specification exactly
3. Check for type errors (run typecheck)
4. Run linter and fix any issues
5. Verify no breaking changes to existing functionality
```

**問題分析**:

**"Run relevant tests"** - 什麼是 "relevant"?
```
Agent 的理解: 與任務範圍直接相關的測試
- FIX-094: 測試 Budget Pool export ✅
- FIX-094: 測試 Project pages ❌ (認為不相關)

應該的理解: 所有可能受影響的測試
- Budget Pool export ✅ (直接影響)
- Project pages ✅ (間接影響 - 也使用 budgetPool)
- Dashboard ✅ (間接影響 - 使用 project.getStats)
```

**"Verify no breaking changes"** - 如何驗證?
```
FIX-094 的驗證:
❌ 運行 Budget Pool export → 成功
❌ 檢查 TypeScript 編譯 → 通過
✅ 聲稱 "no breaking changes" → 錯誤!

缺少的驗證:
❌ 訪問 Project detail 頁面
❌ 訪問 Project list 頁面
❌ 訪問 Dashboard
❌ 檢查所有使用 budgetPool 的頁面
```

#### FIX-094 的 Validation 實際執行

**文檔記錄** (`FIX-094-budget-pool-export-legacy-cleanup.md:208-226`):
```markdown
## ✅ 驗證結果

### 開發伺服器測試
**測試環境**: http://localhost:3001

**測試結果**:
- ✅ 後端服務器正常啟動
- ✅ 前端編譯成功,無 TypeScript 錯誤
- ✅ Export API 正常運作
- ✅ CSV 匯出功能正常

**測試證據**:
```
✓ Compiled /[locale]/budget-pools in 564ms
✓ Compiled /api/trpc/[trpc] in 211ms
GET /api/trpc/budgetPool.export?... 200 in 63ms
```
```

**缺少的驗證**:
```markdown
### 間接影響驗證 (MISSING!)
- ❌ Project list 頁面
- ❌ Project detail 頁面
- ❌ Dashboard
- ❌ 任何其他使用 budgetPool 的頁面
```

---

### 問題 5: "Deprecated" 處理的系統性誤解

#### Prisma Schema 的 Deprecated 註解

**實際註解** (`packages/db/prisma/schema.prisma:96-97`):
```prisma
model BudgetPool {
  id            String   @id @default(uuid())
  name          String
  totalAmount   Float    \ DEPRECATED: 改由 categories 計算，保留以向後兼容
  usedAmount    Float    @default(0) \ DEPRECATED: 改由 categories 計算，保留以向後兼容
  financialYear Int
  ...
}
```

**關鍵詞解析**:

| 關鍵詞 | 含義 | Agent 理解 | 應該理解 |
|--------|------|-----------|---------|
| `DEPRECATED` | 不建議使用 | 可以刪除 ❌ | 仍然可用,但不推薦 |
| `改由 categories 計算` | 有替代方案 | 已經不需要了 ❌ | 新方法是 categories,舊方法仍可用 |
| `保留以向後兼容` | **關鍵!** | 暫時保留 ❌ | **絕對不能刪除** ✅ |

#### "保留以向後兼容" 的真正含義

**軟體工程的向後兼容原則**:
```
Backward Compatibility (向後兼容) 是指:
- 新版本的系統仍然支援舊版本的使用方式
- 允許舊代碼在新系統中繼續運行
- 給予開發者時間逐步遷移到新方法

"保留以向後兼容" = "為了向後兼容而保留" =
  → 不能刪除,直到所有使用都已遷移
```

**Deprecated 的正確生命週期**:
```
Phase 1: 標記為 @deprecated
  - 添加註解說明替代方案
  - 新功能禁止使用

Phase 2: 提供替代方案
  - 實現新的替代方法
  - 文檔化遷移指南

Phase 3: 遷移期 (可能持續數個版本)
  - 逐步遷移現有使用
  - 保留 deprecated 元素 ← 我們在這個階段!
  - 發出 deprecation warnings

Phase 4: 移除準備
  - 確認所有使用已遷移
  - 發出 "將在下一個 major version 移除" 警告

Phase 5: 實際移除
  - Major version bump (如 v2.0)
  - 移除 deprecated 元素
  - 這是 Breaking Change
```

**FIX-094 跳過了 Phase 3 和 Phase 4!**

---

## 🔄 連鎖失敗的完整時間線

### Timeline: FIX-094 → FIX-089 → FIX-089B

```
2025-11-11 23:19 | FIX-094: Budget Pool export API 清理
├─ Surgical Agent 執行:
│  ├─ ✅ 任務: 清理 export API 遺留程式碼
│  ├─ ❌ 決策: 將 "清理 deprecated totalAmount" 擴展到整個專案
│  ├─ ❌ 執行: 移除 budgetPool.ts 和 project.ts 中的 totalAmount
│  ├─ ❌ 驗證: 只測試 Budget Pool export
│  └─ ❌ Commit: 聲稱 "修復完成" 但未測試 Project pages
│
├─ ⚡ 連鎖反應 #1:
│  └─ Project Detail 頁面崩潰 (budgetPool.totalAmount undefined)
│
2025-11-12 14:00 | FIX-089: 嘗試修復 Project Detail
├─ AI Assistant 執行:
│  ├─ ✅ 根本原因分析: 發現是 FIX-094 過度清理
│  ├─ ❌ 工具選擇錯誤: 使用 Edit tool replace_all
│  ├─ ❌ 縮排問題: 只匹配了相同縮排的位置 (1/6)
│  ├─ ❌ 驗證錯誤: 使用 git grep "totalAmount" (匹配到不相關的)
│  └─ ❌ Commit: 聲稱 "修復了 4 個位置" 實際只修復 1 個
│
├─ ⚡ 連鎖反應 #2:
│  └─ 用戶測試發現問題依然存在
│
2025-11-12 14:35 | FIX-089B: 真正的完整修復
├─ AI Assistant 執行:
│  ├─ ✅ 失敗分析: 發現 Edit tool 縮排匹配問題
│  ├─ ✅ 手動修復: 針對每個位置使用唯一上下文 (5/6)
│  ├─ ✅ 結構化驗證: 確認所有 6 個 budgetPool 都有 totalAmount
│  └─ ✅ 完整文檔: 創建 FIX-089B 失敗分析報告
│
└─ ✅ 問題解決
```

**從問題發生到完全解決: ~15 小時, 3 次嘗試**

---

## 🎯 深層次的系統性問題

### Meta-Problem 1: "局部最優 ≠ 全局最優"

**Surgical Agent 的優化目標**:
```
最小化範圍內的變更 (Minimize In-Scope Changes)
+
最大化任務完成度 (Maximize Task Completion)
=
局部最優解 (Local Optimum)
```

**實際需要的優化目標**:
```
最小化對整個系統的風險 (Minimize System-Wide Risk)
+
最大化系統穩定性 (Maximize System Stability)
=
全局最優解 (Global Optimum)
```

**衝突案例**:
```
任務: "清理 Budget Pool export 的遺留程式碼"

Surgical Agent 的局部最優:
  → 徹底清理所有 deprecated 引用 (包括 project.ts)
  → 任務完成度: 100%
  → 代碼簡化: 50%
  → ✅ 局部最優!

全局最優:
  → 只清理 export API 範圍內的引用
  → 保留其他地方的使用 (因為還在用)
  → 任務完成度: 70%
  → 系統穩定性: 100% ← ✅ 全局最優!
```

---

### Meta-Problem 2: "Type Safety ≠ Runtime Safety"

**TypeScript 編譯通過 ≠ 運行時正常**

**FIX-094 的情況**:
```
✅ TypeScript 編譯通過
  → 因為 budgetPool select 中移除 totalAmount 不會導致類型錯誤
  → TypeScript 只知道 budgetPool 是一個對象
  → 不會警告 budgetPool.totalAmount 可能是 undefined

❌ 運行時崩潰
  → 前端訪問 project.budgetPool.totalAmount.toLocaleString()
  → totalAmount 是 undefined
  → Cannot read properties of undefined
```

**為什麼 TypeScript 沒有發現?**
```typescript
// tRPC query 的類型推導
const { data: project } = api.project.getById.useQuery({ id })

// TypeScript 推導的類型:
project: {
  budgetPool: {
    id: string
    name: string
    financialYear: number
    // totalAmount 不在 select 中 → 不會出現在類型中
  }
}

// 前端代碼訪問:
project.budgetPool.totalAmount.toLocaleString()
         ^^^^^^^^^^^^^^^^^^^^
         TypeScript 認為這是 undefined (正確!)
         但沒有強制 null check,所以編譯通過
```

**Surgical Agent 的錯誤假設**:
```
"TypeScript 通過 → 代碼正確 → 可以 commit"

實際上應該是:
"TypeScript 通過 → 類型正確 → 還需要運行時測試"
```

---

### Meta-Problem 3: "Test Coverage ≠ Behavior Coverage"

**FIX-094 的測試策略**:
```
測試了什麼:
✅ Budget Pool export API
✅ Budget Pool list page
✅ Budget Pool detail page

沒測試什麼:
❌ Project list page (使用 project.getAll)
❌ Project detail page (使用 project.getById) ← 導致 FIX-089
❌ Dashboard (使用 project.getStats)
❌ Project export (使用 project export API)
```

**為什麼沒測試?**
```
Surgical Agent 的邏輯:
"任務是修改 budgetPool.ts → 測試 Budget Pool 相關功能 → 完成"

應該的邏輯:
"修改了 budgetPool 的 schema → 測試所有使用 budgetPool 的地方"
```

**Test Coverage vs Behavior Coverage**:
```
Test Coverage (代碼覆蓋率):
  測試執行了多少 %的代碼行

Behavior Coverage (行為覆蓋率):
  測試驗證了多少 %的用戶行為

FIX-094:
  Test Coverage: ~80% (測試了大部分修改的代碼)
  Behavior Coverage: ~40% (只測試了部分受影響的功能)
```

---

## 🛠️ 完整的解決方案

### Solution 1: 更新 Surgical Agent 配置

#### 新增 Impact Analysis Phase

在 `.claude/agents/surgical-task-executor.md` 中插入:

```markdown
## Phase 1.5: Impact Analysis (MANDATORY - CRITICAL)

⚠️ **THIS PHASE CANNOT BE SKIPPED FOR ANY MODIFICATION OR DELETION TASK**

在執行任何會修改或刪除現有代碼的任務前,必須完成以下分析:

### 1. Full Codebase Dependency Scan

**目的**: 找出所有依賴要修改/刪除元素的代碼

**執行方法**:
```bash
# 使用 ripgrep 或 git grep 搜尋所有引用
git grep -n "element_name"

# 對於函數/類,使用 IDE 的 "Find All References"
# 記錄所有結果: 文件路徑, 行號, 使用上下文
```

**輸出**: 依賴清單 (Dependency List)
- 直接依賴: 直接調用/引用的代碼
- 間接依賴: 通過其他模組間接依賴的代碼

### 2. Scope Boundary Analysis

**目的**: 明確區分任務範圍內和範圍外的依賴

**決策規則**:
- 範圍內: 任務文檔明確提到的文件/模組
- 範圍外但相關: 使用相同元素但不在任務範圍的代碼
- 範圍外且無關: 完全不相關的代碼

**處理方式**:
- 範圍內依賴: 按任務要求修改 ✅
- 範圍外但相關:
  - ⚠️ 警告用戶: "發現範圍外的相關代碼"
  - 🤔 詢問: "是否也要修改這些代碼?"
  - 📋 如果用戶說 No: 保持不變,並記錄在 commit message
- 範圍外且無關: 不修改 ✅

### 3. Deprecated Element Special Handling

**規則**: 如果要刪除的元素標記為 `@deprecated`,必須執行特殊檢查

**檢查清單**:
```
[ ] 讀取完整的 deprecation 註解
[ ] 檢查是否包含以下關鍵詞:
    - "保留" / "keep" / "retain"
    - "向後兼容" / "backward compat" / "legacy support"
    - "暫時" / "temporary" / "for now"
    - "遷移中" / "migrating" / "in transition"

[ ] 如果包含上述關鍵詞:
    → ⛔ 停止刪除操作
    → 📋 報告: "此元素標記為保留,不應刪除"
    → 🤔 詢問: "是否要先完成遷移再刪除?"

[ ] 如果不包含上述關鍵詞:
    → ✅ 可以刪除
    → 但仍需執行 Step 1-2 的影響分析
```

### 4. Test Scope Planning

**原則**: 測試範圍 >= 影響範圍

**測試層級**:
```
Layer 1: 直接修改的代碼
  → 單元測試

Layer 2: 直接依賴 (Level 1 Dependencies)
  → 集成測試
  → 手動功能測試

Layer 3: 間接依賴 (Level 2+ Dependencies)
  → 冒煙測試 (Smoke Test)
  → 關鍵路徑測試
```

**最低測試要求**:
- 如果修改了 API 層 (如 tRPC routers):
  → 必須測試所有調用該 API 的頁面

- 如果修改了數據模型 (如 Prisma schema):
  → 必須測試所有使用該模型的功能

- 如果刪除了欄位/函數:
  → 必須搜尋所有引用並確認已移除或替換

### 5. Risk Assessment & Impact Report

**生成報告**,包含:

```markdown
## Impact Analysis Report

### Modification Summary
- Files Modified: X
- Functions/Classes Modified: Y
- Lines Added/Removed: +A/-B

### Dependency Analysis
- Direct Dependencies: D files, F functions
- Indirect Dependencies: I modules, P pages

### Scope Analysis
- In-Scope Changes: X modifications
- Out-of-Scope Dependencies Found: Y locations
  - Action: [Modify / Keep / User Decision Required]

### Risk Assessment
- Risk Level: [Low / Medium / High / Critical]
- Reasoning: ...

### Test Plan
- Layer 1 (Direct):
  - Unit tests: ...
  - Files: ...

- Layer 2 (Dependencies):
  - Integration tests: ...
  - Pages to test: ...

- Layer 3 (System):
  - Smoke tests: ...
  - Critical paths: ...

### Estimated Impact
- Breaking Change: [Yes / No]
- Affected Features: [List]
- Required Follow-up: [List]
```

### 6. User Confirmation for High-Risk Changes

**觸發條件**:
- Risk Level >= High
- 或 Out-of-Scope Dependencies > 5
- 或 Deprecated element with "保留" keyword

**確認流程**:
```
1. 生成 Impact Analysis Report
2. 向用戶展示報告
3. 詢問: "是否繼續執行此修改?"
4. 如果 Yes: 繼續 Phase 2 (Plan)
5. 如果 No: 停止任務,請求新的指示
```

---

⚠️ **CRITICAL ENFORCEMENT RULE**:

**如果 Phase 1.5 發現以下任一情況,必須停止並請求用戶確認**:
1. Deprecated element 包含 "保留" 或 "向後兼容"
2. Out-of-Scope dependencies > 3
3. Risk Level >= High
4. 任何 Breaking Change 的可能性

**違反此規則 = 任務失敗**
```

---

### Solution 2: 更新 Validation Phase

#### 擴展的驗證清單

在 `.claude/agents/surgical-task-executor.md` 的 Phase 4 中更新:

```markdown
## Phase 4: Validate (EXPANDED)

### 4.1 Code Quality Validation
- [ ] TypeScript 編譯通過 (`pnpm typecheck`)
- [ ] ESLint 檢查通過 (`pnpm lint`)
- [ ] 前端 build 成功 (`pnpm build`)

### 4.2 Unit Test Validation
- [ ] 修改文件的單元測試通過
- [ ] 相關模組的單元測試通過
- [ ] 新增測試 (如果需要)

### 4.3 Direct Impact Validation (Layer 1)
- [ ] 任務範圍內的功能正常
- [ ] 直接修改的 API/函數正常工作
- [ ] 直接相關的頁面正常顯示

### 4.4 Dependency Impact Validation (Layer 2) ← NEW!
**基於 Phase 1.5 的依賴分析結果**

對於每個直接依賴:
- [ ] 功能測試通過
- [ ] 頁面正常顯示 (如果是前端)
- [ ] API 返回正確結果 (如果是後端)

**示例** (FIX-094 應該執行的):
```
修改了: budgetPool.ts (移除 totalAmount)
直接依賴:
  - project.ts (使用 budgetPool)

Layer 2 驗證:
  [ ] Project list 頁面正常 (使用 project.getAll)
  [ ] Project detail 頁面正常 (使用 project.getById) ← 應該測試!
  [ ] Dashboard 正常 (使用 project.getStats)
  [ ] Project export 正常 (使用 project export API)
```

### 4.5 System-Wide Smoke Test (Layer 3) ← NEW!
- [ ] 關鍵用戶路徑測試
- [ ] 核心功能冒煙測試
- [ ] 無控制台錯誤

**最低要求**:
訪問並確認以下頁面無錯誤:
- [ ] 首頁/Dashboard
- [ ] 主要 CRUD 頁面 (如果修改了數據模型)
- [ ] 所有使用被修改元素的頁面

### 4.6 Breaking Change Check ← NEW!
- [ ] 檢查是否有 Breaking Change
- [ ] 如果有,是否已通知用戶?
- [ ] 是否需要 Migration Guide?

### 4.7 Documentation Update
- [ ] API 文檔更新 (如果需要)
- [ ] CHANGELOG 更新
- [ ] Migration Guide (如果有 Breaking Change)

---

⚠️ **VALIDATION FAILURE PROTOCOL**:

如果任何驗證失敗:
1. ⛔ 停止進入 Phase 5 (Complete)
2. 🔍 分析失敗原因
3. 🔧 修復問題
4. 🔄 重新執行 Phase 4
5. ✅ 所有驗證通過才能繼續

**不允許**:
❌ 跳過失敗的測試
❌ 注釋掉失敗的驗證
❌ "留待後續修復"
❌ 聲稱 "應該沒問題"
```

---

### Solution 3: Git Workflow 改進

#### 誠實的 Commit Message 模板

```markdown
## Commit Message Template for Surgical Tasks

### Format:
```
<type>(<scope>): <subject>

## Changes
- [List actual changes made]

## Impact Analysis
- Direct Impact: [List]
- Indirect Impact: [List]
- Files Modified: X files
- Risk Level: [Low/Medium/High]

## Validation
✅ Code Quality:
  - TypeScript: [Pass/Fail]
  - Linting: [Pass/Fail]
  - Build: [Pass/Fail]

✅ Layer 1 (Direct):
  - [Test/Feature]: [Result]

✅ Layer 2 (Dependencies):
  - [Test/Feature]: [Result]
  OR
  ⏳ [Test/Feature]: [Pending user verification]

✅ Layer 3 (System):
  - Smoke Test: [Pass/Partial/Pending]

## Known Limitations
- [List any known issues or pending work]

## Requires User Testing
- [ ] [Feature/Page to test]
- [ ] [Feature/Page to test]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
```

**範例** (FIX-094 應該使用的):

```
fix(api): 清理 Budget Pool export API 遺留程式碼 (FIX-094)

## Changes
- 移除 budgetPool.ts export API 中的 minAmount/maxAmount 參數
- 移除 budget-pools/page.tsx 中的對應狀態變數
- 移除 4 個 procedures 中 budgetPool select 的 totalAmount 欄位

## Impact Analysis
- Direct Impact:
  - Budget Pool export API (budgetPool.ts)
  - Budget Pool list page (budget-pools/page.tsx)

- Indirect Impact: ⚠️ FOUND!
  - Project API (project.ts) - 也使用 budgetPool
  - 影響範圍: getAll, getById, getStats, export (4 個 procedures)

- Files Modified: 2 files (budgetPool.ts, budget-pools/page.tsx)
                   ⚠️ Also modified: project.ts (範圍外但相關)

- Risk Level: MEDIUM ← 因為有範圍外的修改

## Validation
✅ Code Quality:
  - TypeScript: Pass
  - Linting: Pass
  - Build: Pass

✅ Layer 1 (Direct):
  - Budget Pool export: Pass
  - Budget Pool list: Pass

⏳ Layer 2 (Dependencies): PENDING USER VERIFICATION
  - Project list page (使用 project.getAll): ⚠️ NOT TESTED
  - Project detail page (使用 project.getById): ⚠️ NOT TESTED
  - Dashboard (使用 project.getStats): ⚠️ NOT TESTED
  - Project export (使用 project export API): ⚠️ NOT TESTED

## Known Limitations
- 移除了 project.ts 中的 budgetPool.totalAmount (範圍外修改)
- 原因: totalAmount 標記為 DEPRECATED
- 風險: 可能影響 Project 相關頁面

## Requires User Testing ⚠️ IMPORTANT!
- [ ] Project list 頁面 (/projects)
- [ ] Project detail 頁面 (/projects/[id])
- [ ] Dashboard (/dashboard)
- [ ] Project export 功能

⚠️ 如果這些頁面出現 budgetPool.totalAmount undefined 錯誤:
   → 需要恢復 project.ts 中的 totalAmount 欄位
   → 或提供替代的計算方法 (從 categories 計算)
```

**這樣的 commit message 會**:
✅ 誠實報告範圍外的修改
✅ 明確列出未測試的功能
✅ 邀請用戶驗證
✅ 提供問題排查指引

**結果**:
- 用戶會立即測試 Project 頁面
- 發現問題時有上下文
- 知道可能的原因和解決方向
- **避免 FIX-089 的發生!**

---

### Solution 4: 建立 "Surgical Safety Checklist"

#### 概念: 外科手術安全檢查清單

**真實世界的啟發**:
世界衛生組織 (WHO) 的 "Surgical Safety Checklist" 大幅降低了手術併發症和死亡率

**軟體工程版本**:

```markdown
# Surgical Task Executor - Safety Checklist

## Before Starting (Sign In)
- [ ] Task specification is clear and unambiguous
- [ ] All requirements are documented
- [ ] Relevant documentation reviewed
- [ ] Team/user is available for questions

## Before Modification (Time Out)
- [ ] Impact Analysis completed
- [ ] All dependencies identified and documented
- [ ] Scope boundaries clearly defined
- [ ] Risk level assessed
- [ ] Test plan created
- [ ] User confirmation obtained (if high-risk)

## Before Committing (Sign Out)
- [ ] All validations passed (Layer 1, 2, 3)
- [ ] No new errors or warnings
- [ ] Commit message is honest and complete
- [ ] Known limitations documented
- [ ] User testing requirements listed
- [ ] Team/user notified of changes

---

⚠️ **MANDATORY**: Each checkbox must be explicitly verified and documented
⛔ **STOP RULE**: If any checkbox cannot be checked, stop and request guidance
```

---

## 📊 預期成效

### 如果 FIX-094 使用了新的 Surgical Agent 配置

**Phase 1.5: Impact Analysis**
```
1. Dependency Scan:
   git grep "totalAmount"

   發現:
   - budgetPool.ts: 5 處
   - project.ts: 4 處 ← 發現範圍外依賴!

2. Scope Boundary Analysis:
   - budgetPool.ts: 範圍內 ✅
   - project.ts: 範圍外但相關 ⚠️

   決策: 停止並詢問用戶

3. Deprecated Element Check:
   註解: "DEPRECATED: 改由 categories 計算，保留以向後兼容"
   關鍵詞: "保留"、"向後兼容"

   決策: ⛔ 不能刪除!

4. Risk Assessment:
   Risk Level: HIGH
   - 範圍外依賴: 4 處
   - Deprecated 且標記保留
   - 影響多個功能模組

5. User Confirmation:
   "發現 project.ts 也使用 totalAmount (範圍外)
    且 totalAmount 標記為 '保留以向後兼容'
    是否仍要刪除?"

用戶回應: "只刪除 export API 範圍內的,保留其他"

結果: ✅ 避免了 FIX-089!
```

**Phase 4: Expanded Validation**
```
Layer 1: Budget Pool export ✅
Layer 2: (無 - 因為沒有修改 project.ts)
Layer 3: Smoke test ✅

結果: ✅ 系統穩定,無連鎖影響!
```

---

## 🎓 關鍵經驗教訓

### 教訓 1: "Surgical" 不等於 "Isolated"

**錯誤理解**:
```
Surgical = 專注於手術部位,忽略其他
```

**正確理解**:
```
Surgical = 對手術部位精確操作,同時監測整個系統
```

**類比**:
```
外科醫生做心臟手術時:
✅ 專注於心臟 (任務範圍)
✅ 但同時監測: 血壓、呼吸、腦部血氧 (系統整體)
✅ 如果其他器官出現問題,立即應對

Surgical Agent 應該:
✅ 專注於任務範圍
✅ 但同時分析: 依賴關係、影響範圍、系統風險
✅ 如果發現範圍外影響,立即報告用戶
```

---

### 教訓 2: "Task Fidelity" 不等於 "Scope Blindness"

**Task Fidelity 的正確含義**:
```
✅ 不添加任務範圍外的功能
✅ 不做任務沒要求的事

❌ 但不是:
  不看任務範圍外的代碼
  不分析任務範圍外的影響
```

**類比**:
```
建築工人被要求 "拆除一面牆":

Task Fidelity ✅:
  - 只拆除指定的那面牆
  - 不拆除其他牆 (範圍外)

Task Fidelity + Impact Analysis ✅:
  - 拆除前檢查: 這面牆是否承重?
  - 如果是承重牆: 警告 "這會導致房屋倒塌!"
  - 請求確認或提供替代方案

Scope Blindness ❌:
  - 只看那面牆
  - 不檢查是否承重
  - 直接拆除
  - 房屋倒塌!
```

---

### 教訓 3: "Deprecated" 有不同的階段

**理解 Deprecation Lifecycle**:

| 階段 | 關鍵詞 | 能否刪除? | 需要做什麼 |
|------|--------|----------|-----------|
| 1. Soft Deprecation | "不建議使用" | ❌ | 標記,提供替代方案 |
| 2. Hard Deprecation | "將在下版本移除" | ❌ | 發出警告,開始遷移 |
| 3. Deprecation with Compat | **"保留以向後兼容"** | **❌** | **等待所有使用遷移** |
| 4. Scheduled Removal | "將在 v2.0 移除" | ⚠️ | 確認遷移完成 |
| 5. Actually Removed | Major version bump | ✅ | 移除並更新文檔 |

**FIX-094 的情況**:
```
totalAmount 的狀態: Stage 3 (Deprecation with Compat)
關鍵詞: "保留以向後兼容"

應該做的: ❌ 不刪除,等待遷移
FIX-094 做的: ✅ 直接刪除 → 導致 Breaking Change
```

---

### 教訓 4: TypeScript 通過 ≠ 功能正常

**Type Safety vs Runtime Safety**:

```
TypeScript 檢查的:
✅ 類型正確
✅ 語法正確
✅ 靜態分析可以發現的問題

TypeScript 不檢查的:
❌ 運行時的 undefined 訪問 (如果沒有 strict null checks)
❌ API 返回的數據結構
❌ 用戶實際操作流程
❌ 業務邏輯正確性
```

**FIX-094 的教訓**:
```
✅ TypeScript 通過
  → 只代表: 代碼結構正確

❌ 運行時崩潰
  → 因為: 數據結構變化 (totalAmount 缺失)

教訓: 必須進行運行時測試!
```

---

### 教訓 5: 驗證必須覆蓋 "行為" 而非 "代碼"

**Code Coverage vs Behavior Coverage**:

```
Code Coverage (代碼覆蓋率):
  測試執行了多少行代碼

  FIX-094: 80%
  - 執行了修改的代碼
  - 執行了 export API

Behavior Coverage (行為覆蓋率):
  測試驗證了多少用戶行為

  FIX-094: 40%
  - 驗證了 Budget Pool export
  - 未驗證 Project 相關功能 ← 遺漏!
```

**正確的驗證策略**:
```
1. 列出所有使用被修改元素的功能
2. 對每個功能進行行為測試
3. 確認用戶操作流程正常
4. 檢查所有相關頁面無錯誤
```

---

## 📚 建議閱讀

### 外部資源

1. **WHO Surgical Safety Checklist**
   - 展示系統化檢查清單如何降低風險
   - https://www.who.int/teams/integrated-health-services/patient-safety/research/safe-surgery

2. **Semantic Versioning 2.0.0**
   - 理解 Breaking Changes 和版本管理
   - https://semver.org/

3. **The Checklist Manifesto** by Atul Gawande
   - 為什麼檢查清單在複雜系統中如此重要

4. **Site Reliability Engineering** (Google)
   - Chapter 17: Testing for Reliability
   - 測試層級和覆蓋率策略

---

## 🔄 持續改進計劃

### Short-Term (立即執行)
- [x] 創建 FIX-089B 失敗分析文檔
- [x] 分析 Surgical Agent 的系統性問題
- [ ] 更新 `.claude/agents/surgical-task-executor.md`
  - [ ] 新增 Phase 1.5: Impact Analysis
  - [ ] 擴展 Phase 4: Validation
  - [ ] 新增 Surgical Safety Checklist

### Medium-Term (本週內)
- [ ] 建立 Impact Analysis 模板
- [ ] 建立 Commit Message 模板
- [ ] 建立驗證清單模板
- [ ] 對現有 agents 進行審查

### Long-Term (下個 Sprint)
- [ ] 建立自動化影響分析工具
- [ ] 整合到 CI/CD pipeline
- [ ] 建立 Deprecated Element 追蹤系統
- [ ] 建立行為測試覆蓋率工具

---

**分析人員**: AI Assistant (Deep Self-Analysis)
**最後更新**: 2025-11-12
**狀態**: ✅ 完整分析,建議已提出
**關鍵結論**: Surgical Precision ≠ Isolated Execution | 需要系統性思維
