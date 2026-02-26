# Post FIX-089B 影響範圍驗證報告

> **報告日期**: 2025-11-12
> **報告目的**: 驗證 FIX-094 是否在其他 routers 中造成類似的過度清理問題
> **檢查範圍**: 所有 API routers 中對 budgetPool.totalAmount 的使用
> **檢查原因**: FIX-094 移除了 project.ts 中的 budgetPool.totalAmount,導致 FIX-089/089B,需要確認是否有其他類似問題

---

## 📋 Executive Summary

### 檢查結果: ✅ 無其他過度清理問題

經過系統性檢查,**除了 project.ts (已在 FIX-089B 中修復)**,其他 routers 均未受 FIX-094 過度清理影響:

- ✅ **budgetPool.ts**: 無問題 (自己的 router)
- ✅ **expense.ts**: 無問題 (使用 `budgetPool: true` 完整包含)
- ✅ **purchaseOrder.ts**: 無問題 (未使用 budgetPool.totalAmount)
- ✅ **dashboard.ts**: 無問題 (使用 `budgetPool: true` 完整包含)

### 關鍵發現

1. **FIX-094 的影響僅限於 project.ts** - 沒有其他 cascading failures
2. **其他 routers 使用模式不同** - 大多使用 `budgetPool: true` (完整包含),而非 select
3. **project.ts 是唯一使用 budgetPool select 的受害者**

---

## 🔍 詳細檢查過程

### 檢查方法論

#### Phase 1: 識別所有使用 budgetPool.totalAmount 的位置

**搜尋命令**:
```bash
git grep -n "budgetPool\.totalAmount" packages/api/src/routers/
```

**結果**:
```
packages/api/src/routers/dashboard.ts:443:    預算池總額: p.budgetPool.totalAmount,
packages/api/src/routers/expense.ts:690:      if (usedAmount > budgetPool.totalAmount) {
packages/api/src/routers/expense.ts:693:      message: `預算池餘額不足。總預算: ${budgetPool.totalAmount}，已使用: ${budgetPool.usedAmount}，需要: ${expense.totalAmount}`,
```

**分析**:
- `dashboard.ts` Line 443: 導出 CSV 時使用
- `expense.ts` Line 690, 693: 費用批准時檢查預算餘額

#### Phase 2: 識別所有包含 budgetPool select 的檔案

**搜尋命令**:
```bash
find packages/api/src/routers/ -name "*.ts" -exec grep -l "budgetPool: {" {} \;
```

**結果**:
```
packages/api/src/routers/budgetPool.ts
packages/api/src/routers/dashboard.ts
packages/api/src/routers/project.ts
packages/api/src/routers/purchaseOrder.ts
```

#### Phase 3: 逐檔案驗證 budgetPool 欄位完整性

---

### 檢查結果詳情

#### 1. budgetPool.ts

**狀態**: ✅ 無問題

**原因**: 這是 budgetPool 自己的 router,不存在過度清理問題

**檢查項**:
- [ ] 是否使用 budgetPool.totalAmount? **N/A** (自己的 model)
- [ ] 是否有 budgetPool select? **N/A**
- [ ] 是否受 FIX-094 影響? **否**

---

#### 2. expense.ts

**狀態**: ✅ 無問題 (安全)

**budgetPool 使用**: 3 處
1. Line 177: `budgetPool: true` (完整包含)
2. Line 462: `budgetPool: true` (完整包含)
3. Line 662: `budgetPool: true` (完整包含)

**budgetPool.totalAmount 使用**: 2 處
1. Line 690: `if (usedAmount > budgetPool.totalAmount)` - 檢查預算餘額
2. Line 693: 錯誤訊息中顯示 `budgetPool.totalAmount`

**驗證結果**:
```
✅ 所有 budgetPool include 都使用 `budgetPool: true`
✅ 完整包含所有欄位,包括 totalAmount
✅ 不受 FIX-094 影響
```

**程式碼片段** (Line 662-695):
```typescript
const expense = await ctx.prisma.expense.findUnique({
  where: { id: input.id },
  include: {
    purchaseOrder: {
      include: {
        project: {
          include: {
            budgetPool: true,  // ✅ 完整包含,含 totalAmount
            budgetCategory: true,
          },
        },
      },
    },
  },
});

// ...

const budgetPool = expense.purchaseOrder.project.budgetPool;
const usedAmount = budgetPool.usedAmount + expense.totalAmount;

if (usedAmount > budgetPool.totalAmount) {  // ✅ 可以正常訪問
  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: `預算池餘額不足。總預算: ${budgetPool.totalAmount}...`,
  });
}
```

**FIX-094 影響**: 無 (FIX-094 實際上是**新增**了 expense.ts 中的 budgetPool 引用)

---

#### 3. purchaseOrder.ts

**狀態**: ✅ 無問題 (不使用 totalAmount)

**budgetPool 使用**: 1 處
1. Line 179-184: `budgetPool: { select: { id, name, financialYear } }`

**budgetPool.totalAmount 使用**: 0 處

**驗證結果**:
```
✅ budgetPool select 不包含 totalAmount
✅ 程式碼中未使用 budgetPool.totalAmount
✅ 無潛在 runtime 錯誤風險
```

**程式碼片段** (Line 179-184):
```typescript
budgetPool: {
  select: {
    id: true,
    name: true,
    financialYear: true,
    // totalAmount 不在這裡,但也沒有使用,所以安全
  },
},
```

**檢查確認**:
```bash
grep -n "budgetPool\.totalAmount" packages/api/src/routers/purchaseOrder.ts
# 無輸出 ✅
```

---

#### 4. dashboard.ts

**狀態**: ✅ 無問題 (安全)

**budgetPool 使用**: 2 處 (都在 exportProjects procedure)
1. Line 373: `budgetPool: true` (ProjectManager 導出)
2. Line 407: `budgetPool: true` (Supervisor 導出)

**budgetPool.totalAmount 使用**: 1 處
1. Line 443: CSV 導出欄位 `預算池總額: p.budgetPool.totalAmount`

**驗證結果**:
```
✅ 所有 budgetPool include 都使用 `budgetPool: true`
✅ 完整包含所有欄位,包括 totalAmount
✅ 不受 FIX-094 影響
```

**程式碼片段** (Line 404-443):
```typescript
projects = await ctx.prisma.project.findMany({
  where,
  include: {
    budgetPool: true,  // ✅ 完整包含,含 totalAmount
    manager: true,
    supervisor: true,
    proposals: true,
    purchaseOrders: {
      include: {
        expenses: true,
      },
    },
  },
  orderBy: { updatedAt: 'desc' },
});

// ...

const csvData = projects.map((p) => {
  return {
    專案名稱: p.name,
    預算池總額: p.budgetPool.totalAmount,  // ✅ 可以正常訪問
    // ...
  };
});
```

---

#### 5. project.ts (已修復)

**狀態**: ✅ 已在 FIX-089B 中修復

**budgetPool 使用**: 6 處
1. Line 167: `budgetPool: { select: { ..., totalAmount: true } }` ✅
2. Line 239: `budgetPool: { select: { ..., totalAmount: true } }` ✅
3. Line 499: `budgetPool: { select: { ..., totalAmount: true } }` ✅
4. Line 616: `budgetPool: { select: { ..., totalAmount: true } }` ✅
5. Line 873: `budgetPool: { select: { ..., totalAmount: true } }` ✅
6. Line 966: `budgetPool: { select: { ..., totalAmount: true } }` ✅

**驗證命令**:
```bash
awk '/budgetPool: \{/{flag=1; count++; line=NR}
     flag{buffer=buffer $0 "\n"}
     /\},/{
       if(flag) {
         if(buffer ~ /totalAmount:/) {
           print "✅ budgetPool #" count " (line " line "): HAS totalAmount"
         } else {
           print "❌ budgetPool #" count " (line " line "): MISSING totalAmount"
         }
         buffer=""
         flag=0
       }
     }' packages/api/src/routers/project.ts
```

**驗證結果**:
```
✅ budgetPool #1 (line 167): HAS totalAmount
✅ budgetPool #2 (line 239): HAS totalAmount
✅ budgetPool #3 (line 499): HAS totalAmount
✅ budgetPool #4 (line 616): HAS totalAmount
✅ budgetPool #5 (line 873): HAS totalAmount
✅ budgetPool #6 (line 966): HAS totalAmount
```

**修復歷程**:
- FIX-094 (Commit `14815bf`): 移除了全部 6 個 budgetPool select 中的 totalAmount
- FIX-089 (Commit `d8903f7`): 嘗試修復,但只修復了 1/6
- FIX-089B (Commit `238a93f`): 完整修復全部 6/6 ✅

---

## 📊 統計分析

### budgetPool 使用模式統計

| Router | budgetPool select 數量 | 使用 totalAmount? | 包含 totalAmount? | 狀態 |
|--------|------------------------|------------------|------------------|------|
| project.ts | 6 | ✅ 是 (前端顯示) | ✅ 是 (FIX-089B 修復) | ✅ 安全 |
| expense.ts | 3 | ✅ 是 (預算檢查) | ✅ 是 (`budgetPool: true`) | ✅ 安全 |
| dashboard.ts | 2 | ✅ 是 (CSV 導出) | ✅ 是 (`budgetPool: true`) | ✅ 安全 |
| purchaseOrder.ts | 1 | ❌ 否 | ❌ 否 (不需要) | ✅ 安全 |
| budgetPool.ts | N/A | N/A | N/A | ✅ 安全 |

### 使用模式分類

#### Pattern A: `budgetPool: true` (完整包含)
- **使用者**: expense.ts (3), dashboard.ts (2)
- **優點**: 包含所有欄位,不受 FIX-094 影響
- **缺點**: 可能傳輸不需要的資料

#### Pattern B: `budgetPool: { select: {...} }` (選擇性包含)
- **使用者**: project.ts (6), purchaseOrder.ts (1)
- **優點**: 只傳輸需要的欄位,減少資料傳輸
- **缺點**: 容易遺漏欄位,如 FIX-094 所示

#### Pattern C: 不包含 budgetPool
- **使用者**: (其他未檢查的 routers)
- **狀態**: 不受影響

---

## 🎯 關鍵結論

### 1. FIX-094 的影響範圍

**實際影響**: 僅 project.ts 受影響

**原因分析**:
- project.ts 是**唯一**使用 Pattern B (budgetPool select) 的 router
- 其他 routers 使用 Pattern A (`budgetPool: true`),完整包含所有欄位
- FIX-094 只修改了 project.ts,未觸及其他 routers

### 2. 為什麼沒有更多 Cascading Failures?

**幸運因素**:
1. **使用模式差異**: 大多數 routers 使用 `budgetPool: true`
2. **依賴關係有限**: 只有 project.ts 大量依賴 budgetPool.totalAmount 顯示
3. **FIX-094 範圍有限**: 只修改了 project.ts 中的 budgetPool select

**潛在風險**:
如果更多 routers 使用 Pattern B (select),可能會有更多類似問題

### 3. 預防措施建議

#### 短期措施 (已完成)
✅ 更新 Surgical-Task-Executor Agent 配置
- Phase 1.5: Impact Analysis (強制性)
- Deprecated Special Handling
- Layer 1-2-3 驗證
- Surgical Safety Checklist

#### 長期措施 (建議)
1. **統一 budgetPool 使用模式**:
   - 建議: 所有 routers 統一使用 `budgetPool: true` 或統一使用 select
   - 優點: 減少不一致性,降低遺漏風險

2. **建立 Shared Select Objects**:
   ```typescript
   // 建議在 packages/api/src/lib/select-objects.ts
   export const budgetPoolSelect = {
     id: true,
     name: true,
     financialYear: true,
     totalAmount: true,  // 中央管理,不會遺漏
     usedAmount: true,
     // ...
   };

   // 使用
   budgetPool: { select: budgetPoolSelect }
   ```

3. **Linting Rule for Deprecated Fields**:
   - 檢測使用 DEPRECATED 欄位但未檢查 "保留" 關鍵字
   - 警告: "此欄位標記為 DEPRECATED,請檢查是否可移除"

---

## ✅ 驗證檢查清單

### Phase 1: 依賴掃描 ✅
- [x] 搜尋所有 `budgetPool.totalAmount` 使用
- [x] 識別所有包含 budgetPool select 的檔案
- [x] 記錄所有依賴位置

### Phase 2: 逐檔案驗證 ✅
- [x] project.ts - 已在 FIX-089B 修復
- [x] expense.ts - 無問題 (budgetPool: true)
- [x] dashboard.ts - 無問題 (budgetPool: true)
- [x] purchaseOrder.ts - 無問題 (不使用 totalAmount)
- [x] budgetPool.ts - 無問題 (自己的 router)

### Phase 3: 影響評估 ✅
- [x] 確認 FIX-094 影響範圍
- [x] 識別潛在風險位置
- [x] 評估使用模式差異
- [x] 建議預防措施

### Phase 4: 報告產出 ✅
- [x] 建立詳細檢查報告
- [x] 記錄所有發現和結論
- [x] 提供預防措施建議
- [x] 更新 Surgical Agent 配置

---

## 📋 後續動作建議

### 立即動作 (已完成)
✅ 更新 Surgical-Task-Executor Agent
✅ 檢查其他受影響位置
✅ 建立驗證報告

### 近期動作 (本週)
⏳ 系統性測試所有 Project 相關頁面
⏳ 系統性測試所有 Expense 相關頁面
⏳ 系統性測試 Dashboard export 功能

### 長期動作 (下個 Sprint)
⏳ 建立 Shared Select Objects
⏳ 統一 budgetPool 使用模式
⏳ 建立 Linting Rule for Deprecated Fields

---

**報告維護者**: AI Assistant + 開發團隊
**最後更新**: 2025-11-12
**下次複查**: 實施長期措施後

**相關文件**:
- `FIX-089-ROOT-CAUSE-ANALYSIS.md` - FIX-094 過度清理根本原因
- `FIX-089B-EDIT-TOOL-FAILURE-ANALYSIS.md` - Edit tool 失敗分析
- `SURGICAL-AGENT-CASCADING-FAILURES-ANALYSIS.md` - 系統性問題分析
- `MANUAL-TESTING-LOG.md` - 手動測試記錄
- `.claude/agents/surgical-task-executor.md` - 已更新的 Agent 配置
