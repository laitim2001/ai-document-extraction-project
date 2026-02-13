# FIX-094: Budget Pool export API 遺留程式碼清理

> **修復日期**: 2025-11-11
> **修復人員**: AI Assistant
> **優先級**: 🟢 P3 (Low) - 程式碼品質改善
> **狀態**: ✅ 已修復
> **影響範圍**: Budget Pool API - export 端點,前端 Budget Pools 列表頁

---

## 📋 問題概述

Budget Pool `export` API 和前端頁面包含未使用的 minAmount/maxAmount 功能,屬於遺留程式碼 (legacy code)。前端宣告了狀態變數但從未提供 UI 輸入,後端實作了過濾邏輯但從未被觸發。

### 問題來源

**後端**: `packages/api/src/routers/budgetPool.ts:393-418`
**前端**: `apps/web/src/app/[locale]/budget-pools/page.tsx:25-82`

**遺留程式碼特徵**:
1. 前端宣告 minAmount/maxAmount state (line 28-29)
2. 前端在 export API 呼叫中傳遞 (line 81-82)
3. 但**完全沒有 UI 輸入控制項**讓使用者設定值
4. setMinAmount 和 setMaxAmount 從未被呼叫
5. 後端接收參數但實際使用 deprecated `totalAmount` 欄位

---

## 🔍 根本原因分析 (5 Why)

**Why 1**: 為什麼存在未使用的 minAmount/maxAmount 功能?
→ 因為最初計畫實施金額範圍篩選,但功能未完成

**Why 2**: 為什麼功能未完成?
→ 因為 BudgetCategory 功能實施後,totalAmount 變成 deprecated 欄位

**Why 3**: 為什麼 deprecated 後沒有移除或更新功能?
→ 因為功能從未被使用,不影響正常操作,優先級較低

**Why 4**: 為什麼前端保留了狀態變數?
→ 因為程式碼審查時未發現這些變數從未被修改

**Why 5**: 為什麼後端仍實作了過濾邏輯?
→ 因為保持了與前端參數的一致性,但未察覺實際從未使用

**根本原因**: BudgetCategory 功能重構後,未系統化清理相關的未完成功能,造成遺留程式碼累積。

---

## 🔧 修復內容

### 修改 1: 移除後端 API 參數

**檔案**: `packages/api/src/routers/budgetPool.ts:393-418`

**修改前**:
```typescript
export: protectedProcedure
  .input(
    z.object({
      search: z.string().optional(),
      year: z.number().int().optional(),
      minAmount: z.number().optional(),    // ❌ 遺留參數
      maxAmount: z.number().optional(),    // ❌ 遺留參數
    }).optional()
  )
  .query(async ({ ctx, input }) => {
    const where = {
      AND: [
        input?.search
          ? {
              name: {
                contains: input.search,
                mode: 'insensitive' as const,
              },
            }
          : {},
        input?.year ? { financialYear: input.year } : {},
        input?.minAmount ? { totalAmount: { gte: input.minAmount } } : {},  // ❌ Deprecated 欄位
        input?.maxAmount ? { totalAmount: { lte: input.maxAmount } } : {},  // ❌ Deprecated 欄位
      ].filter(obj => Object.keys(obj).length > 0),
    };
    // ...
  })
```

**修改後**:
```typescript
export: protectedProcedure
  .input(
    z.object({
      search: z.string().optional(),
      year: z.number().int().optional(),
      // ✅ 移除 minAmount 和 maxAmount
    }).optional()
  )
  .query(async ({ ctx, input }) => {
    const where = {
      AND: [
        input?.search
          ? {
              name: {
                contains: input.search,
                mode: 'insensitive' as const,
              },
            }
          : {},
        input?.year ? { financialYear: input.year } : {},
        // ✅ 移除 minAmount 和 maxAmount 過濾條件
      ].filter(obj => Object.keys(obj).length > 0),
    };
    // ...
  })
```

**關鍵改進**:
- ✅ 移除 Zod schema 中的 minAmount 和 maxAmount 定義
- ✅ 移除 where 條件中的金額範圍過濾
- ✅ 移除對 deprecated `totalAmount` 欄位的引用
- ✅ API 簽名簡化,更清晰

---

### 修改 2: 移除前端狀態變數

**檔案**: `apps/web/src/app/[locale]/budget-pools/page.tsx`

**修改前** (Lines 25-31):
```typescript
const [page, setPage] = useState(1);
const [search, setSearch] = useState('');
const [yearFilter, setYearFilter] = useState<number | undefined>(undefined);
const [minAmount, setMinAmount] = useState<number | undefined>(undefined);  // ❌ 從未使用
const [maxAmount, setMaxAmount] = useState<number | undefined>(undefined);  // ❌ 從未使用
const [sortBy, setSortBy] = useState<'name' | 'year' | 'amount'>('year');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
const [isExporting, setIsExporting] = useState(false);
const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
```

**修改後**:
```typescript
const [page, setPage] = useState(1);
const [search, setSearch] = useState('');
const [yearFilter, setYearFilter] = useState<number | undefined>(undefined);
// ✅ 移除 minAmount 和 maxAmount
const [sortBy, setSortBy] = useState<'name' | 'year' | 'amount'>('year');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
const [isExporting, setIsExporting] = useState(false);
const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
```

---

### 修改 3: 清理 export API 呼叫

**檔案**: `apps/web/src/app/[locale]/budget-pools/page.tsx`

**修改前** (Lines 71-79):
```typescript
const handleExport = async () => {
  try {
    setIsExporting(true);

    // Use tRPC client to fetch export data
    const exportData = await utils.client.budgetPool.export.query({
      search: debouncedSearch || undefined,
      year: yearFilter,
      minAmount: minAmount,    // ❌ 總是 undefined
      maxAmount: maxAmount,    // ❌ 總是 undefined
    });

    // ... CSV 生成邏輯 ...
  } catch (error) {
    console.error('Export failed:', error);
    toast.error('匯出失敗');
  } finally {
    setIsExporting(false);
  }
};
```

**修改後**:
```typescript
const handleExport = async () => {
  try {
    setIsExporting(true);

    // Use tRPC client to fetch export data
    const exportData = await utils.client.budgetPool.export.query({
      search: debouncedSearch || undefined,
      year: yearFilter,
      // ✅ 移除 minAmount 和 maxAmount 參數
    });

    // ... CSV 生成邏輯 ...
  } catch (error) {
    console.error('Export failed:', error);
    toast.error('匯出失敗');
  } finally {
    setIsExporting(false);
  }
};
```

---

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

### TypeScript 類型檢查

**前端類型**:
- ✅ 移除 minAmount/maxAmount 後,無 TypeScript 錯誤
- ✅ tRPC 客戶端自動更新類型,不接受已移除的參數

**後端類型**:
- ✅ Zod schema 更新後,input 類型自動推導正確
- ✅ 不會意外接收到 minAmount/maxAmount 參數

---

## 📊 程式碼簡化效果

### 後端 API (budgetPool.ts)

**修改前**:
- Input schema: 4 個欄位 (search, year, minAmount, maxAmount)
- Where conditions: 4 個過濾條件

**修改後**:
- Input schema: 2 個欄位 (search, year)
- Where conditions: 2 個過濾條件

**簡化**: 50% 參數減少,程式碼更清晰

---

### 前端頁面 (page.tsx)

**修改前**:
- State variables: 9 個
- Export call parameters: 4 個

**修改後**:
- State variables: 7 個
- Export call parameters: 2 個

**簡化**: 22% 狀態變數減少,維護成本降低

---

## 📈 向後兼容性分析

### 功能影響: 無

**原因**:
- 前端從未提供 UI 讓使用者輸入 minAmount/maxAmount
- 這些參數在實際使用中**永遠是 undefined**
- 移除後不會影響任何現有使用場景

### API 變更: 向後兼容

**tRPC 特性**:
- 舊客戶端傳遞 minAmount/maxAmount → 被 Zod schema 忽略
- 新客戶端不傳遞這些參數 → 正常運作
- **無需版本管理,平滑過渡**

---

## 🛡️ 預防措施

### 短期措施 (已實施)

1. **✅ 程式碼審查 Checklist**:
   - 檢查所有宣告的 state 變數是否有對應的 setter 呼叫
   - 檢查所有 API 參數是否在實際使用中被設定
   - 移除未使用的功能而非保留 "以備將來使用"

2. **✅ TypeScript 嚴格模式**:
   - 使用 `@typescript-eslint/no-unused-vars` 檢測未使用變數
   - 使用 tRPC 的類型推導確保前後端一致性

---

### 長期措施 (建議)

#### 1. 自動化 Dead Code 檢測

```bash
# 使用 ts-unused-exports 檢測未使用的 exports
pnpm add -D ts-unused-exports

# 定期執行檢查
pnpm ts-unused-exports tsconfig.json --ignoreFiles=".next/**"
```

#### 2. ESLint 規則強化

```json
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
      "caughtErrorsIgnorePattern": "^_"
    }],
    "no-unreachable": "error",
    "no-useless-return": "error"
  }
}
```

#### 3. Code Review 準則

**遺留程式碼識別標準**:
- State 變數宣告後 100 行內未使用 → 標記為可疑
- API 參數在實作中永遠是 undefined → 標記為遺留
- 註解包含 "TODO", "FIXME", "未完成" → 必須處理或移除

#### 4. 功能完整性測試

```typescript
// 在 E2E 測試中驗證功能完整性
describe('Budget Pool Export', () => {
  it('should export with all implemented filters', async () => {
    // 驗證 search 功能可用
    await fillInput('search', 'Test Pool');
    await clickExport();
    expect(exportedData).toContainSearchResult('Test Pool');

    // 驗證 year 功能可用
    await selectYear(2024);
    await clickExport();
    expect(exportedData).toContainYear(2024);

    // ✅ 不測試 minAmount/maxAmount,因為功能已移除
  });
});
```

---

## 🧪 建議測試場景

### 手動測試 Checklist

1. **✅ 場景 1: 匯出所有資料 (無過濾)**
   - 不輸入任何過濾條件
   - 點擊匯出按鈕
   - 預期: 成功匯出所有 Budget Pools

2. **✅ 場景 2: 按名稱搜尋後匯出**
   - 輸入 "Test" 到搜尋框
   - 點擊匯出按鈕
   - 預期: CSV 只包含名稱含 "Test" 的資料

3. **✅ 場景 3: 按年度過濾後匯出**
   - 選擇 2024 年度
   - 點擊匯出按鈕
   - 預期: CSV 只包含 2024 年度的資料

4. **✅ 場景 4: 組合過濾後匯出**
   - 輸入 "Infrastructure" + 選擇 2025 年度
   - 點擊匯出按鈕
   - 預期: CSV 只包含 2025 年度且名稱含 "Infrastructure" 的資料

5. **✅ 場景 5: 空結果匯出**
   - 輸入不存在的名稱 "NonExistent"
   - 點擊匯出按鈕
   - 預期: 匯出空 CSV (只有 header)

---

## 📚 相關文檔

- **審查報告**: `claudedocs/2-sprints/testing-validation/P3-ISSUES-REVIEW-REPORT.md`
- **問題清單**: `claudedocs/2-sprints/testing-validation/all-issues-summary.md` (P3-001)
- **API Router**: `packages/api/src/routers/budgetPool.ts`
- **前端頁面**: `apps/web/src/app/[locale]/budget-pools/page.tsx`

---

## 💡 經驗教訓

### 1. 功能未完成應立即移除

**錯誤做法**: 保留未完成的程式碼 "以備將來使用"

**正確做法**:
- 立即移除未使用的程式碼
- 如果需要,記錄在 Feature Backlog 中
- 重新實施時從乾淨的基礎開始

### 2. 前後端一致性驗證

**檢查點**:
- 前端傳遞的所有參數是否在後端使用?
- 後端接收的參數是否都有前端來源?
- 是否存在 "永遠是 undefined" 的參數?

### 3. Deprecated 欄位的系統化清理

**流程**:
1. 標記欄位為 `@deprecated` (TypeScript)
2. 搜尋所有使用位置
3. 逐一評估: 更新 vs 移除功能
4. 建立 Migration Plan
5. 在 Major Version 中完全移除

### 4. Code Review 重點

**遺留程式碼紅旗**:
- 變數宣告但從未修改 (只有 initialization)
- API 參數在所有呼叫中都是 undefined
- 沒有對應 UI 的功能實作
- 使用 deprecated 欄位的新功能

---

**修復人員**: AI Assistant
**最後更新**: 2025-11-11
**狀態**: ✅ 已完成並驗證
**程式碼簡化**: 50% 參數減少, 22% 狀態變數減少
**下一步**: 建立定期 Dead Code 檢測流程
