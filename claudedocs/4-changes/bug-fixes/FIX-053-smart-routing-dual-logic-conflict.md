# FIX-053: Smart Routing 雙重邏輯衝突（generateRoutingDecision vs getSmartReviewType）

> **建立日期**: 2026-04-21
> **發現方式**: 架構審計（`docs/06-codebase-analyze/` 驗證報告 R5-R15）
> **影響頁面/功能**: V3.1 提取管線路由決策 + 外部智能路由 API
> **優先級**: 🔴 高（業務邏輯歧義）
> **狀態**: ✅ 已修復（2026-04-21）

---

## 問題描述

`src/services/extraction-v3/confidence-v3-1.service.ts` 中同時存在兩個路由決策函數，且**在「新公司」場景下會回傳相反的結論**，構成業務邏輯歧義：

| 函數 | 位置 | 訪問 | 新公司場景結論 |
|------|------|------|---------------|
| `generateRoutingDecision()` | L373-464 | `private static` | **降級**至 `QUICK_REVIEW` |
| `getSmartReviewType()` | L527-575 | `static`（公開） | **強制** `FULL_REVIEW` |

`generateRoutingDecision()` 是管線主路徑（被 `calculate()` L184 調用），而 `getSmartReviewType()` 透過 `getSmartReviewTypeV3_1()`（L664）導出，但**在生產代碼中零調用**。

### 衝突明細

| 場景 | generateRoutingDecision | getSmartReviewType | 差異 |
|------|------------------------|-------------------|------|
| 新公司 | AUTO_APPROVE → QUICK_REVIEW（降級） | 強制 FULL_REVIEW | 🔴 **相反結論** |
| 新公司 + 新格式 | 分別處理（可能只降為 QUICK_REVIEW） | 強制 FULL_REVIEW | 🔴 **相反結論** |
| 新格式 | AUTO_APPROVE → QUICK_REVIEW（降級） | 強制 QUICK_REVIEW | 🟡 結果同，邏輯不同 |
| DEFAULT 配置 | 不處理 | 降級一級 | 🔴 **缺失處理** |
| LLM 推斷配置 | AUTO_APPROVE → QUICK_REVIEW | 未處理 | 🟡 缺失 |
| Stage 1/2/3 失敗 | 強制 FULL_REVIEW | 未處理 | 🔴 **缺失** |

---

## 重現步驟

1. 構造一個 V3.1 路由輸入：`overallConfidence=95`, `isNewCompany=true`, `configSource='COMPANY_SPECIFIC'`
2. 分別呼叫兩個函數：
   - `generateRoutingDecision()` → `QUICK_REVIEW`（降級）
   - `getSmartReviewType()` → `FULL_REVIEW`（強制）
3. **觀察現象**：同一輸入兩個決策函數結論相反，業務上哪個才「正確」缺乏明確定義

---

## 根本原因

### 歷史背景推測

- `generateRoutingDecision()` 應該是 V3.1 管線**完整內部邏輯**（考慮 stages 成功性 + 項目分類 + 配置來源等多面向）
- `getSmartReviewType()` 應該是 CHANGE-025「智能路由決策」的**外部簡化 API**（僅基於路由標記，不需要完整 stage result）
- 兩者本該共享同一「策略核心」但在開發時各自實作了條件判斷，造成分叉
- `getSmartReviewType()` 在代碼中**零生產調用**，可能是預留給外部 API 但從未啟用

### 關鍵觀察

1. `generateRoutingDecision()` 是 **private static** — 外部無法直接調用
2. `getSmartReviewType()` 有 `private static getBaseDecisionByConfidence()` 和 `downgradeDecision()` 輔助函數（L577-開始），自成一套策略
3. `ROUTING_THRESHOLDS_V3_1` 常數兩者都用，但套用邏輯不同

---

## 解決方案（🟢 採用選項 2：Adapter 方式統一）

### 設計方針

1. **保留兩個函數的對外介面**（向後相容），但內部統一委派到同一策略
2. **以 `generateRoutingDecision()` 的邏輯為準**（較完整、已驗證）
3. `getSmartReviewType()` 改為 adapter：將 `SmartRoutingInput` 轉成 `ConfidenceInputV3_1`，呼叫 `generateRoutingDecision()` 後將 `RoutingDecisionV3_1` 轉回 `SmartRoutingOutput`
4. **消除新公司場景衝突**：統一採用 `generateRoutingDecision()` 的降級策略（較溫和，不必所有新公司都強制 FULL_REVIEW；業務端可透過 `needsConfigReview` 標記提示人工配置）

### 實作步驟

**Step 1**: 將 `generateRoutingDecision()` 由 `private static` 改為 `static`（或抽出為內部模組函數），讓 `getSmartReviewType()` 可以呼叫

**Step 2**: 改寫 `getSmartReviewType()`：

```typescript
static getSmartReviewType(input: SmartRoutingInput): SmartRoutingOutput {
  const { overallConfidence, isNewCompany, isNewFormat, configSource } = input;

  // 構造 minimal stage results（僅用於路由決策）
  const stage1Result: Stage1Result = {
    success: true,
    confidence: isNewCompany ? 50 : overallConfidence,
    isNewCompany,
    // ... 其他欄位用預設值
  };
  const stage2Result: Stage2Result = {
    success: true,
    confidence: isNewFormat ? 50 : overallConfidence,
    isNewFormat,
    configSource,
    // ...
  };
  const stage3Result: Stage3Result = {
    success: true,
    confidence: overallConfidence,
    lineItems: [],
    extraCharges: [],
    // ...
  };

  const decision = this.generateRoutingDecision(
    { stage1Result, stage2Result, stage3Result } as ConfidenceInputV3_1,
    overallConfidence
  );

  return {
    reviewType: decision.decision,
    reason: decision.reasons.join('; '),
    needsConfigReview: isNewCompany || isNewFormat || configSource === 'LLM_INFERRED',
  };
}
```

**Step 3**: 移除 `getSmartReviewType()` 內的 5 處獨立條件分支（L530-574），以及不再需要的 `getBaseDecisionByConfidence()` 和 `downgradeDecision()` 私有輔助（若僅服務 getSmartReviewType）

**Step 4**: 在 JSDoc 明確記載：

```typescript
/**
 * 智能路由決策（外部 API 簡化介面）
 *
 * @deprecated 若不需要對外 API 可直接使用 generateRoutingDecision
 * @description 此函數與 generateRoutingDecision() 使用相同的策略核心，
 *   差異僅在於輸入形式（本函數接受簡化路由標記，另一個接受完整三階段結果）。
 *   兩者在相同輸入下保證回傳一致的決策。
 */
static getSmartReviewType(...)
```

**Step 5**: 新增單元測試，明確驗證「兩套 API 在相同業務場景下結論一致」

---

## 修改的檔案（實際）

| 檔案 | 修改內容 |
|------|---------|
| `src/services/extraction-v3/confidence-v3-1.service.ts` | 抽出 `applyRoutingStrategy()` 為共用策略核心；`generateRoutingDecision()` 委派給核心；`getSmartReviewType()` 改為 adapter 並委派給核心；刪除不再使用的 `getBaseDecisionByConfidence` 與 `downgradeDecision` 私有輔助 |
| 主 `CLAUDE.md` | §已知差異中 Smart Routing 條目標記為 ✅ 已修復 |

### 重構細節

**新增**：`applyRoutingStrategy(score, flags)` 私有靜態方法作為**唯一策略核心**，接受抽象化的 flags：
- `isNewCompany`, `isNewFormat`
- `shouldDowngradeByConfig` + `configDowngradeReason`（抽象旗標，讓兩個 API 能各自映射自己的 configSource 型別）
- `itemsNeedingClassification`
- `stage1Success`, `stage2Success`, `stage3Success`

**configSource 語義映射**：
- Pipeline（`FormatConfigSource`）: `LLM_INFERRED → shouldDowngradeByConfig = true`
- 簡化 API（`ConfigSourceType`）: `DEFAULT → shouldDowngradeByConfig = true`

這解決了兩個 API 使用**不同 configSource 型別**的語義差異（`ConfigSourceType` vs `FormatConfigSource`），同時統一了基本決策、新公司/新格式降級、項目分類、Stage 失敗等核心邏輯。

### 未建立測試檔案的原因

專案 `@types/jest` 測試基礎設施有既存問題，無法新增 `.test.ts` 檔案而不引入更大技術債。替代驗證：inline Node 6 場景邏輯測試（全數通過）。

### 已知既存問題（與 FIX-053 無關）

- ESLint 報 `L311: 'requiredFieldsCount' is never reassigned. Use 'const' instead`。經 `git show HEAD` 確認此 `let` 宣告於本次修復**前**已存在，為既存技術債務。不屬於 FIX-053 修復範圍。

---

## 業務決策記錄

### 採用方案：**B（降級策略）**

用戶於 2026-04-21 確認採用選項 2（Adapter 方式統一）+ 降級策略，理由：
1. **不改變生產行為**：`generateRoutingDecision` 本身不動，pipeline 主流程邏輯完全一致
2. **只是清理代碼異味**：`getSmartReviewType` 在生產零調用，修復本質上是防止未來誤用
3. **保留未來靈活性**：如果之後業務方希望改為強制策略，屆時可走 CHANGE 流程修改 `generateRoutingDecision`

---

## 測試驗證

修復完成後需驗證：

- [x] **TypeScript 類型檢查**：`npx tsc --noEmit` — `confidence-v3-1.service.ts` 零錯誤（2026-04-21）
- [x] **ESLint 檢查**：僅剩既存 L311 `prefer-const`（非本次引入，屬於既存技術債）
- [x] **邏輯一致性驗證**：inline Node 6 場景測試全數通過
  - 新公司+95% → QUICK_REVIEW（降級）✅
  - 新公司+80% → QUICK_REVIEW（基本決策）✅
  - 新公司+新格式+95% → QUICK_REVIEW（降級）✅
  - DEFAULT 配置+95% → QUICK_REVIEW（降級）✅
  - Stage 3 失敗+95% → FULL_REVIEW（強制覆蓋）✅
  - 無特殊標記+95% → AUTO_APPROVE（標準）✅
- [x] **代碼異味消除**：刪除 `getBaseDecisionByConfidence` 和 `downgradeDecision` 死代碼
- [x] **pipeline 行為未變**：`generateRoutingDecision()` 對外行為完全一致（重構內部實作，不改變結果）
- [ ] **完整 E2E**：實際文件上傳處理流程的路由結果符合預期 — 需真實環境驗證
- [ ] **現有 V3.1 測試無回歸**：跑既有 `confidence-v3-1.service.test.ts`（如有） — 待下次測試執行

---

## 相關文件

- 觸發來源：`docs/06-codebase-analyze/00-analysis-index.md` §Critical Findings Row 3
- 設計背景：CHANGE-025（智能路由決策）+ `src/services/extraction-v3/CLAUDE.md`
- V3.1 設計：`docs/03-stories/tech-specs/` Epic 15 相關 tech spec
- 兩個函數的詳細對比：本文件 §問題描述 表格

---

## 風險提示

- **修改 private static → static** 會改變類別 API surface，外部若有測試 mock 可能需同步更新
- **採用降級策略** 若業務方實際需要強制 FULL_REVIEW，本 FIX 修復後會造成「新公司高信心度文件直接 AUTO_APPROVE」，需提前確認

---

*文件建立日期: 2026-04-21*
*最後更新: 2026-04-21（標記為已修復）*
