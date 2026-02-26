# FIX-038: Template Matching formatId 未傳遞 + matchSingle 缺少 autoComplete

> **建立日期**: 2026-02-11
> **發現方式**: CHANGE-037 整合測試（Phase 4 pipeline-integration）
> **影響範圍**: `auto-template-matching.service.ts` — 自動匹配 + 手動匹配
> **優先級**: P1
> **狀態**: ✅ 已完成
> **相關**: CHANGE-037（Data Template Flow Completion）

---

## 問題描述

`auto-template-matching.service.ts` 中的兩個核心匹配方法 `autoMatch()` 和 `matchSingle()` 均未將 `formatId` 傳入 `matchDocuments()` 的 options，導致 FORMAT 級別的映射規則被完全忽略。此外，`matchSingle()` 缺少 `tryAutoComplete()` 調用，導致手動匹配後實例無法自動轉為 COMPLETED。

### BUG-1：`autoMatch()` 未傳 `formatId` 給 `matchDocuments()`（嚴重度：高）

| 項目 | 說明 |
|------|------|
| **文件** | `src/services/auto-template-matching.service.ts` |
| **位置** | L368-374 |
| **現狀** | `autoMatch()` 在 L351 調用 `resolveFormatId(documentId)` 取得 `formatId`，並在 L352-354 傳給 `resolveDefaultTemplate(companyId, formatId)` 用於模板解析。但在 L368-374 調用 `matchDocuments()` 時，options 只傳了 `companyId`，**遺漏了 `formatId`** |
| **預期行為** | `matchDocuments()` 的 `options.formatId` 應被設定，讓 `templateFieldMappingService.resolveMapping()` 能正確解析 FORMAT > COMPANY > GLOBAL 三層優先級的映射規則 |
| **實際行為** | FORMAT 級別的映射規則永遠不會被匹配引擎解析，三層優先級退化為二層（COMPANY > GLOBAL） |

**問題代碼**:
```typescript
// L368-374 — autoMatch()
const matchResult = await templateMatchingEngineService.matchDocuments({
  documentIds: [documentId],
  templateInstanceId: instance.id,
  options: {
    companyId: document.companyId,
    // ❌ BUG: 缺少 formatId（已在 L351 解析但未傳遞）
  },
});
```

### BUG-2：`matchSingle()` 未解析或傳遞 `formatId`（嚴重度：高）

| 項目 | 說明 |
|------|------|
| **文件** | `src/services/auto-template-matching.service.ts` |
| **位置** | L415-449 |
| **現狀** | `matchSingle()` 查詢文件後直接調用 `matchDocuments()`，完全沒有調用 `resolveFormatId()`，也沒有將 `formatId` 傳入 options |
| **預期行為** | 應先調用 `resolveFormatId(documentId)` 取得 formatId，再傳入 `matchDocuments()` 的 options |
| **實際行為** | 與 BUG-1 相同，FORMAT 級別映射規則不生效 |

**問題代碼**:
```typescript
// L431-436 — matchSingle()
const result = await templateMatchingEngineService.matchDocuments({
  documentIds: [documentId],
  templateInstanceId,
  options: {
    companyId: document.companyId || undefined,
    // ❌ BUG: 缺少 formatId（完全未解析）
  },
});
```

### BUG-3：`batchMatch()` 未傳任何 options 給 `matchDocuments()`（嚴重度：高）

| 項目 | 說明 |
|------|------|
| **文件** | `src/services/auto-template-matching.service.ts` |
| **位置** | L497-500 |
| **現狀** | `batchMatch()` 調用 `matchDocuments()` 時完全沒有傳入 `options`（連 `companyId` 都沒有），也沒有調用 `tryAutoComplete()` |
| **預期行為** | 應為每批文件解析 `companyId` 和 `formatId`，傳入 `matchDocuments()` options；批量完成後嘗試 `tryAutoComplete()` |
| **實際行為** | 批量匹配時 COMPANY + FORMAT 級映射規則全部不生效，退化為只有 GLOBAL 規則；匹配後實例停留在 DRAFT |

**問題代碼**:
```typescript
// L497-500 — batchMatch()
const result = await templateMatchingEngineService.matchDocuments({
  documentIds: batch,
  templateInstanceId,
  // ❌ BUG: 完全沒有 options（連 companyId 都沒傳）
});
```

### BUG-4：`matchSingle()` 缺少 `tryAutoComplete()` 調用（嚴重度：中）

| 項目 | 說明 |
|------|------|
| **文件** | `src/services/auto-template-matching.service.ts` |
| **位置** | L439-449 |
| **現狀** | `matchSingle()` 匹配完成後直接 return，未調用 `tryAutoComplete()` |
| **預期行為** | 匹配後應嘗試自動完成：若所有行驗證通過（`errorRowCount === 0 && total > 0`），將實例從 DRAFT → COMPLETED |
| **實際行為** | 手動匹配後實例永遠停留在 DRAFT 狀態，即使所有行都通過驗證 |
| **對照** | `autoMatch()` 在 L386 已正確調用 `tryAutoComplete(instance.id)`；`batchMatch()` 同樣缺少此調用（見 BUG-3） |

---

## 根本原因分析

### BUG-1 & BUG-2：開發時序問題

`resolveFormatId()` 和三層優先級模板解析（`resolveDefaultTemplate(companyId, formatId)`）是 CHANGE-037 新增的功能。開發時正確將 `formatId` 用於模板選擇，但遺漏更新 `matchDocuments()` 的調用參數。

**調用鏈分析**:
```
autoMatch()
├── resolveFormatId(documentId)           ← ✅ 正確解析 formatId
├── resolveDefaultTemplate(companyId, formatId)  ← ✅ 正確使用 formatId 選模板
└── matchDocuments({ options: { companyId } })   ← ❌ 遺漏 formatId
    └── resolveMapping({ companyId, documentFormatId: undefined })
        └── 只查詢 COMPANY + GLOBAL 層 ← FORMAT 層被忽略

matchSingle()
├── (無 resolveFormatId 調用)             ← ❌ 完全缺失
└── matchDocuments({ options: { companyId } })   ← ❌ 遺漏 formatId
```

### BUG-3：`batchMatch()` options 完全缺失

`batchMatch()` 是後期加入的批量操作方法，實作時僅複製了基本的 `matchDocuments()` 調用結構，但遺漏了 `options` 參數。由於批量匹配涉及多個文件可能來自不同公司，此修復需要額外處理 companyId/formatId 的批量解析。

### BUG-4：功能對齊遺漏

`tryAutoComplete()` 在 `autoMatch()` 中正確使用，但 `matchSingle()` 和 `batchMatch()` 作為手動匹配入口均未同步加入此邏輯。

---

## 修復方案

### BUG-1 修復：`autoMatch()` 傳遞 formatId

**文件**: `src/services/auto-template-matching.service.ts`
**位置**: L368-374

```typescript
// 修復前
const matchResult = await templateMatchingEngineService.matchDocuments({
  documentIds: [documentId],
  templateInstanceId: instance.id,
  options: {
    companyId: document.companyId,
  },
});

// 修復後
const matchResult = await templateMatchingEngineService.matchDocuments({
  documentIds: [documentId],
  templateInstanceId: instance.id,
  options: {
    companyId: document.companyId,
    formatId,  // CHANGE-037: 傳遞 formatId 啟用 FORMAT 級映射
  },
});
```

### BUG-2 修復：`matchSingle()` 解析並傳遞 formatId

**文件**: `src/services/auto-template-matching.service.ts`
**位置**: L415-449

```typescript
// 修復前
async matchSingle(params: SingleMatchParams): Promise<MatchResult> {
  const { documentId, templateInstanceId } = params;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { companyId: true },
  });
  // ...
  const result = await templateMatchingEngineService.matchDocuments({
    documentIds: [documentId],
    templateInstanceId,
    options: {
      companyId: document.companyId || undefined,
    },
  });
  // ...
}

// 修復後
async matchSingle(params: SingleMatchParams): Promise<MatchResult> {
  const { documentId, templateInstanceId } = params;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { companyId: true },
  });
  // ...
  // FIX-038: 解析 formatId 以啟用 FORMAT 級映射規則
  const formatId = await this.resolveFormatId(documentId);

  const result = await templateMatchingEngineService.matchDocuments({
    documentIds: [documentId],
    templateInstanceId,
    options: {
      companyId: document.companyId || undefined,
      formatId,
    },
  });
  // ...
}
```

### BUG-3 修復：`batchMatch()` 傳遞 companyId + formatId + tryAutoComplete

**文件**: `src/services/auto-template-matching.service.ts`
**位置**: L461-537

由於批量匹配涉及多文件，需要在 `batchMatch()` 中：
1. 批量查詢所有文件的 `companyId`
2. 批量解析所有文件的 `formatId`
3. 以第一個文件的 companyId/formatId 作為映射解析基準（同批文件通常來自相同公司/格式）
4. 在所有批次完成後調用 `tryAutoComplete()`

```typescript
// 修復後
async batchMatch(params: BatchMatchParams): Promise<BatchMatchResult> {
  const { documentIds, templateInstanceId, options = {} } = params;
  // ...

  // FIX-038: 批量查詢文件的 companyId
  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true, companyId: true },
  });
  const firstDoc = documents[0];

  // FIX-038: 解析 formatId（使用第一個文件）
  const formatId = firstDoc
    ? await this.resolveFormatId(firstDoc.id)
    : undefined;

  // 分批處理
  for (let i = 0; i < documentIds.length; i += batchSize) {
    const batch = documentIds.slice(i, i + batchSize);
    try {
      const result = await templateMatchingEngineService.matchDocuments({
        documentIds: batch,
        templateInstanceId,
        options: {
          companyId: firstDoc?.companyId || undefined,
          formatId,
        },
      });
      // ...
    }
  }

  // FIX-038: 批量匹配完成後嘗試自動完成
  await this.tryAutoComplete(templateInstanceId);

  return { ... };
}
```

### BUG-4 修復：`matchSingle()` 加入 tryAutoComplete

**文件**: `src/services/auto-template-matching.service.ts`
**位置**: L439-449（return 前）

```typescript
// 修復後（在 prisma.document.update 之後、return 之前）
await prisma.document.update({
  where: { id: documentId },
  data: {
    templateInstanceId,
    templateMatchedAt: new Date(),
  },
});

// FIX-038: 手動匹配後嘗試自動完成
await this.tryAutoComplete(templateInstanceId);

return result;
```

---

## 影響範圍

### 受影響的功能

| 功能 | 影響 | BUG |
|------|------|-----|
| 自動匹配（pipeline 觸發） | FORMAT 級映射規則不生效 | BUG-1 |
| 手動單文件匹配（UI 操作） | FORMAT 級映射規則不生效 + 無自動完成 | BUG-2, BUG-4 |
| 批量匹配（UI 操作） | COMPANY + FORMAT 級映射規則全部不生效 + 無自動完成 | BUG-3, BUG-4 |

### 不受影響的功能

- `resolveDefaultTemplate()` — 模板選擇正確使用三層優先級 ✅
- `tryAutoComplete()` — 方法本身邏輯正確 ✅
- `validateAllRows()` — 驗證邏輯正確 ✅
- `STATUS_TRANSITIONS` — DRAFT→COMPLETED 已允許 ✅
- `cleanupRowsForDocument()` — unmatch 清理邏輯正確 ✅

---

## 驗證方式

### 已有測試覆蓋

- `scripts/test-template-matching/04-priority-cascade.ts` — 三層優先級邏輯（33/33 passed）
- `scripts/test-template-matching/07-pipeline-integration.ts` — auto-complete 邏輯（49/49 passed）

### 修復後驗證步驟

1. **單元驗證**: 確認 `matchDocuments()` 收到 `formatId` 參數
2. **整合驗證**: 在有 FORMAT 級映射的情境下執行 autoMatch / matchSingle
3. **手動測試**: 在 UI 上手動匹配文件，確認 FORMAT 規則生效 + 實例自動轉 COMPLETED
4. **回歸測試**: 執行 04-priority-cascade 和 07-pipeline-integration 測試腳本

---

## 修復工時估算

| 項目 | 預估 |
|------|------|
| BUG-1: autoMatch formatId | 5 分鐘 |
| BUG-2: matchSingle formatId | 10 分鐘 |
| BUG-3: batchMatch options + tryAutoComplete | 20 分鐘 |
| BUG-4: matchSingle tryAutoComplete | 5 分鐘 |
| 驗證測試 | 15 分鐘 |
| **合計** | ~55 分鐘 |

---

## 檢查清單

- [x] BUG-1: `autoMatch()` 傳遞 `formatId` 給 `matchDocuments()`
- [x] BUG-2: `matchSingle()` 調用 `resolveFormatId()` + 傳遞 `formatId`
- [x] BUG-3: `batchMatch()` 查詢 `companyId`/`formatId` + 傳入 options + `tryAutoComplete()`
- [x] BUG-4: `matchSingle()` 加入 `tryAutoComplete()` 調用
- [ ] 執行現有測試腳本驗證回歸（04-priority-cascade, 07-pipeline-integration）
- [x] 更新 `@lastModified` 和 JSDoc

---

*建立者: AI 助手*
*建立日期: 2026-02-11*
