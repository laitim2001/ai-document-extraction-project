# FIX-036: Reference Number 匹配失敗時中止 Pipeline 處理

> **建立日期**: 2026-02-11
> **發現方式**: 代碼審查（Agent 調查）
> **影響範圍**: extraction-v3 pipeline（V3.1 流程）
> **優先級**: P0（高）
> **狀態**: ✅ 已完成

---

## 問題描述

### 預期行為

當公司啟用了 Reference Number Matching（`refMatchEnabled: true`）時，如果從文件名中**未匹配到任何 Reference Number**，pipeline 應該**中止處理**，因為 Reference Number 是後續業務流程的關鍵索引（用於發票與貨運單據的關聯對照）。

### 實際行為

即使 `refMatchEnabled: true` 且 `matchesFound === 0`，pipeline 仍然繼續執行後續的三階段 GPT 提取（Stage 1/2/3）、信心度計算和路由決策。文件最終被標記為 `MAPPING_COMPLETED` 狀態，進入審核流程，但缺少 Reference Number 索引。

### 場景對照表

| 場景 | `refMatchEnabled` | `matchesFound` | 預期行為 | 實際行為 |
|------|-------------------|----------------|----------|----------|
| A: 功能關閉 | `false` | N/A | 跳過步驟，繼續 pipeline | 跳過步驟，繼續 pipeline |
| B: 有匹配結果 | `true` | `>= 1` | 記錄匹配，繼續 pipeline | 記錄匹配，繼續 pipeline |
| C: 無匹配結果 | `true` | `0` | **中止 pipeline，標記失敗** | 繼續 pipeline（BUG） |
| D: 匹配過程異常 | `true` | N/A（拋異常） | 記錄警告，繼續 pipeline | 記錄警告，繼續 pipeline |

---

## 根本原因分析

### 原因 1：REFERENCE_NUMBER_MATCHING 步驟被 try-catch 包裹為「非阻塞」

**文件**: `src/services/extraction-v3/extraction-v3.service.ts`
**行號**: L357-411

```typescript
// L360: 整個 REFERENCE_NUMBER_MATCHING 區塊被 try-catch 包裹
try {
  // ...
  if (pipelineConfig.refMatchEnabled) {
    const matcher = new ReferenceNumberMatcherService();
    refMatchResult = await matcher.match({ ... });

    // L377-385: 無論 matchesFound 是否為 0，stepResult 都標記為 success: true
    stepResults.push({
      step: 'REFERENCE_NUMBER_MATCHING' as ProcessingStepV3,
      success: true,  // <-- BUG: matchesFound=0 時仍為 true
      data: {
        candidatesFound: refMatchResult.summary.candidatesFound,
        matchesFound: refMatchResult.summary.matchesFound,
      },
      durationMs: stepTimings['REFERENCE_NUMBER_MATCHING'],
    });
  }
} catch (refMatchError) {
  // L402-411: 異常只記錄 warning，不中斷
  warnings.push(`Reference number matching failed: ${errorMsg}`);
}
```

**問題**：`matchesFound === 0` 時，步驟結果仍被標記為 `success: true`，且沒有任何邏輯檢查匹配數量並中止 pipeline。

### 原因 2：ReferenceNumberMatcherService 的 JSDoc 明確聲明「非阻塞」

**文件**: `src/services/extraction-v3/stages/reference-number-matcher.service.ts`
**行號**: L16

```typescript
// L16: JSDoc 明確寫著非阻塞
*   - 非阻塞：失敗不中斷 pipeline
```

**問題**：服務層的設計意圖就是「非阻塞」，但這與業務需求矛盾 -- 當公司主動啟用 ref matching 時，沒有匹配結果應視為阻塞性錯誤。

### 原因 3：信心度計算中 ref match 權重過低

**文件**: `src/services/extraction-v3/confidence-v3-1.service.ts`
**行號**: L282-300

```typescript
// L283-290: 啟用時 weight 僅 0.05
if (input.refMatchEnabled && input.refMatchResult?.enabled) {
  const refMatchScore = this.calculateRefMatchScore(input.refMatchResult);
  const refMatchWeight = 0.05; // 僅佔總權重 5%
  // ...
}
```

**行號**: L340-353（`calculateRefMatchScore` 方法）

```typescript
// L347-349: 無匹配時只給 50 分（中性），不懲罰
if (candidatesFound > 0) {
  return 50; // 有候選但無匹配：50 分（中性）
}
// 無候選：50 分（不懲罰）
return 50;
```

**問題**：0.05 權重 * 50 分 = 2.5 分，對整體信心度幾乎沒有影響。即使完全沒有匹配到 Reference Number，信心度仍可能達到 AUTO_APPROVE（>= 90）的門檻。

### 原因 4：持久化服務未保存 ref match 結果

**文件**: `src/services/processing-result-persistence.service.ts`

**問題**：`persistV3_1ProcessingResult` 函數（L448-629）中，沒有保存 `referenceNumberMatch` 結果到 `ExtractionResult` 記錄。雖然 `extraction-v3.service.ts` 在返回 `ExtractionV3Output` 時已包含 `referenceNumberMatch` 欄位（L652），但 persistence 層完全忽略了這個資料。

---

## 修復方案

### 方案概述

採用**「啟用即阻塞」**策略：當 `refMatchEnabled: true` 且 `matchesFound === 0` 時，pipeline 應該提早中止，將文件標記為特定的失敗狀態，並向用戶提供清楚的錯誤訊息。

修復分為 4 個層面：
1. **Pipeline 主流程**：在 REFERENCE_NUMBER_MATCHING 步驟後新增阻塞判斷
2. **文件狀態**：新增 `REF_MATCH_FAILED` 狀態（或複用 `FAILED` 狀態搭配 errorMessage）
3. **持久化**：保存 ref match 結果到資料庫
4. **信心度**：調整無匹配時的分數（改為懲罰性分數）

### 修改範圍

| # | 文件 | 行號 | 修改類型 | 修改內容 |
|---|------|------|----------|----------|
| 1 | `src/services/extraction-v3/extraction-v3.service.ts` | L357-411 | 邏輯修改 | REFERENCE_NUMBER_MATCHING 步驟後新增阻塞判斷 |
| 2 | `src/services/extraction-v3/stages/reference-number-matcher.service.ts` | L16 | 文檔修改 | 更新 JSDoc，移除「非阻塞」描述 |
| 3 | `src/services/extraction-v3/confidence-v3-1.service.ts` | L340-353 | 邏輯修改 | 無匹配時改為懲罰性分數 |
| 4 | `src/services/processing-result-persistence.service.ts` | L448-629 | 功能新增 | 保存 referenceNumberMatch 結果 |
| 5 | `prisma/schema.prisma` | ~L3320 | Schema 修改 | `DocumentStatus` enum 新增 `REF_MATCH_FAILED` |
| 6 | `src/lib/document-status.ts` | L44-55, L90-222 | 配置新增 | 新增 `REF_MATCH_FAILED` 狀態配置 |
| 7 | `messages/en/documents.json` | 新增 | i18n | 新增 `REF_MATCH_FAILED` 狀態翻譯 |
| 8 | `messages/zh-TW/documents.json` | 新增 | i18n | 新增 `REF_MATCH_FAILED` 狀態翻譯 |
| 9 | `messages/zh-CN/documents.json` | 新增 | i18n | 新增 `REF_MATCH_FAILED` 狀態翻譯 |
| 10 | `src/types/extraction-v3.types.ts` | ~L1563 | 類型修改 | `ReferenceNumberMatchResult` 新增 `abortPipeline` 欄位 |

### 詳細修改設計

#### 修改 1：Pipeline 主流程 -- 新增阻塞判斷

**文件**: `src/services/extraction-v3/extraction-v3.service.ts`
**位置**: L357-411（REFERENCE_NUMBER_MATCHING 區塊）

在 `refMatchResult` 獲取後、三階段提取開始前，新增以下判斷邏輯：

```typescript
// ========== CHANGE-032: REFERENCE_NUMBER_MATCHING ==========
let refMatchResult: ReferenceNumberMatchResult | undefined;
let pipelineConfig;
try {
  const refMatchStart = Date.now();
  this.log('V3.1 CHANGE-032: 參考號碼匹配');

  pipelineConfig = await resolveEffectiveConfig({
    regionId: input.regionId,
  });

  if (pipelineConfig.refMatchEnabled) {
    const matcher = new ReferenceNumberMatcherService();
    refMatchResult = await matcher.match({
      fileName: input.fileName || '',
      config: pipelineConfig,
      regionId: input.regionId,
    });

    stepTimings['REFERENCE_NUMBER_MATCHING'] = Date.now() - refMatchStart;

    // === FIX-036: 阻塞判斷 - 啟用且無匹配時中止 pipeline ===
    const hasMatches = refMatchResult.summary.matchesFound > 0;

    stepResults.push({
      step: 'REFERENCE_NUMBER_MATCHING' as ProcessingStepV3,
      success: hasMatches, // FIX-036: 無匹配時標記為失敗
      data: {
        candidatesFound: refMatchResult.summary.candidatesFound,
        matchesFound: refMatchResult.summary.matchesFound,
      },
      durationMs: stepTimings['REFERENCE_NUMBER_MATCHING'],
    });

    if (!hasMatches) {
      // FIX-036: 啟用 ref match 但未匹配到任何結果 → 中止 pipeline
      return {
        success: false,
        error: `Reference number matching enabled but no matches found in filename "${input.fileName}". Pipeline aborted.`,
        referenceNumberMatch: refMatchResult,
        timing: {
          totalMs: Date.now() - startTime,
          stepTimings,
        },
        stepResults,
        warnings: [
          ...warnings,
          'REF_MATCH_ABORT: No reference numbers matched. File processing stopped.',
        ],
      } as unknown as ExtractionV3Output;
    }
  } else {
    // ... 原有的 disabled 處理邏輯（保持不變）
  }
} catch (refMatchError) {
  // 異常仍然只記錄 warning，不中斷（保持原有行為）
  // 因為異常可能是暫時性的（如 DB 連線問題），不應因此阻塞
  const errorMsg = refMatchError instanceof Error
    ? refMatchError.message : 'Unknown ref match error';
  warnings.push(`Reference number matching failed: ${errorMsg}`);
  stepResults.push({
    step: 'REFERENCE_NUMBER_MATCHING' as ProcessingStepV3,
    success: false,
    durationMs: 0,
    error: errorMsg,
  });
}
```

**設計決策**：
- `refMatchEnabled: true` + `matchesFound === 0` = **中止**（return early with `success: false`）
- `refMatchEnabled: true` + 拋異常 = **不中止**（記錄 warning 繼續），因為 DB 異常是暫時性的
- `refMatchEnabled: false` = **跳過**（保持原有邏輯）

#### 修改 2：更新 ReferenceNumberMatcherService JSDoc

**文件**: `src/services/extraction-v3/stages/reference-number-matcher.service.ts`
**位置**: L16

將 `非阻塞：失敗不中斷 pipeline` 改為：

```typescript
*   - 條件阻塞：當 refMatchEnabled=true 且 matchesFound=0 時，
*     由調用方（extraction-v3.service.ts）決定中止 pipeline（FIX-036）
```

#### 修改 3：調整信心度計算 -- 無匹配時懲罰

**文件**: `src/services/extraction-v3/confidence-v3-1.service.ts`
**位置**: L337-354（`calculateRefMatchScore` 方法）

```typescript
/**
 * CHANGE-032 + FIX-036: 計算參考號碼匹配分數
 *
 * @description
 *   FIX-036: 調整分數策略，無匹配時給予懲罰性分數。
 *   注意：當 refMatchEnabled=true 且 matchesFound=0 時，
 *   pipeline 已在上游被中止，此分數計算理論上不會被觸及。
 *   但作為防禦性設計，仍給予低分。
 */
private static calculateRefMatchScore(
  refMatchResult: import('@/types/extraction-v3.types').ReferenceNumberMatchResult
): number {
  const { matchesFound, candidatesFound } = refMatchResult.summary;

  if (matchesFound > 0) {
    // 有匹配：80-100 分（依匹配數量遞增）
    return Math.min(100, 80 + matchesFound * 5);
  }

  // FIX-036: 無匹配時改為懲罰性分數（防禦性設計）
  // 理論上 pipeline 已在上游中止，此路徑不應被執行
  return 0;
}
```

#### 修改 4：持久化 ref match 結果

**文件**: `src/services/processing-result-persistence.service.ts`

需要在 `persistV3_1ProcessingResult` 的 `ExtractionResult` upsert 中新增 `referenceNumberMatch` 欄位的保存。

前提：需要在 `ExtractionResult` Prisma model 中新增 `referenceNumberMatch Json?` 欄位。

```typescript
// 在 prisma.extractionResult.upsert 的 create/update 中新增：
referenceNumberMatch: result.referenceNumberMatch
  ? (result.referenceNumberMatch as unknown as Prisma.InputJsonValue)
  : null,
```

同時需要更新 `ExtractionV3_1Output` 介面或在 `PersistV3_1ResultInput` 中擴展以包含 `referenceNumberMatch`。

#### 修改 5：新增 DocumentStatus -- `REF_MATCH_FAILED`

**文件**: `prisma/schema.prisma`
**位置**: `enum DocumentStatus`（~L3320）

```prisma
enum DocumentStatus {
  UPLOADING
  UPLOADED
  OCR_PROCESSING
  OCR_COMPLETED
  OCR_FAILED
  MAPPING_PROCESSING
  MAPPING_COMPLETED
  REF_MATCH_FAILED    // FIX-036: 新增
  PENDING_REVIEW
  IN_REVIEW
  COMPLETED
  FAILED
  APPROVED
  ESCALATED
}
```

**migration 命名**: `npx prisma migrate dev --name add_ref_match_failed_status`

#### 修改 6：新增狀態顯示配置

**文件**: `src/lib/document-status.ts`

1. 在 `DocumentStatusKey` union type 中新增 `'REF_MATCH_FAILED'`（L44-55）

```typescript
export type DocumentStatusKey =
  | 'UPLOADING'
  | 'UPLOADED'
  | 'OCR_PROCESSING'
  | 'OCR_COMPLETED'
  | 'OCR_FAILED'
  | 'MAPPING_PROCESSING'
  | 'MAPPING_COMPLETED'
  | 'REF_MATCH_FAILED'   // FIX-036: 新增
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'FAILED'
```

2. 在 `DOCUMENT_STATUS_CONFIG` 中新增配置（插入在 `MAPPING_COMPLETED` 之後）

```typescript
REF_MATCH_FAILED: {
  label: 'Ref Match Failed',
  labelZh: '參考編號匹配失敗',
  icon: AlertCircle,
  color: 'orange',
  bgColor: 'bg-orange-100',
  textColor: 'text-orange-700',
  isProcessing: false,
  isError: true,
  canRetry: true,
  order: 8, // 插入在 MAPPING_COMPLETED(7) 和 PENDING_REVIEW(8) 之間
},
```

注意：後續狀態的 `order` 需相應 +1。

3. 在 `getProcessingStage` 函數中新增映射

```typescript
REF_MATCH_FAILED: 3, // 與 MAPPING 階段同層
```

#### 修改 7-9：i18n 翻譯

**文件**: `messages/en/documents.json`

在 `status` 區段新增：
```json
"REF_MATCH_FAILED": "Reference Number Match Failed"
```

在 `detail.timeline.steps` 區段確認已有 `REFERENCE_NUMBER_MATCHING` 的翻譯（CHANGE-036 已新增）。

新增錯誤描述翻譯：
```json
"errors": {
  "refMatchFailed": "No reference numbers matched in filename. Please verify the filename contains a valid reference number or disable reference number matching for this region."
}
```

**文件**: `messages/zh-TW/documents.json`

```json
"REF_MATCH_FAILED": "參考編號匹配失敗"
```

```json
"errors": {
  "refMatchFailed": "文件名中未匹配到參考編號。請確認文件名包含有效的參考編號，或為此區域停用參考編號匹配功能。"
}
```

**文件**: `messages/zh-CN/documents.json`

```json
"REF_MATCH_FAILED": "参考编号匹配失败"
```

```json
"errors": {
  "refMatchFailed": "文件名中未匹配到参考编号。请确认文件名包含有效的参考编号，或为此区域停用参考编号匹配功能。"
}
```

#### 修改 10：擴展 ReferenceNumberMatchResult 類型（可選）

**文件**: `src/types/extraction-v3.types.ts`
**位置**: `ReferenceNumberMatchResult` interface（~L1563）

考慮新增 `shouldAbortPipeline` 計算屬性，讓調用方可以直接判斷：

```typescript
export interface ReferenceNumberMatchResult {
  enabled: boolean;
  matches: ReferenceNumberMatch[];
  summary: {
    candidatesFound: number;
    matchesFound: number;
    sources: string[];
  };
  processingTimeMs: number;
  /** FIX-036: 是否應中止 pipeline（enabled=true 且 matchesFound=0） */
  shouldAbortPipeline?: boolean;
}
```

此欄位可由 `ReferenceNumberMatcherService.match()` 在返回前計算：

```typescript
return {
  enabled: true,
  matches,
  summary: { ... },
  processingTimeMs: Date.now() - startTime,
  // FIX-036: 啟用且無匹配時標記為應中止
  shouldAbortPipeline: matches.length === 0,
};
```

---

## i18n 影響

| 命名空間 | 語言 | 新增 Key | 說明 |
|----------|------|----------|------|
| `documents` | en | `status.REF_MATCH_FAILED` | 新狀態英文名稱 |
| `documents` | zh-TW | `status.REF_MATCH_FAILED` | 新狀態繁中名稱 |
| `documents` | zh-CN | `status.REF_MATCH_FAILED` | 新狀態簡中名稱 |
| `documents` | en | `errors.refMatchFailed` | 錯誤描述英文 |
| `documents` | zh-TW | `errors.refMatchFailed` | 錯誤描述繁中 |
| `documents` | zh-CN | `errors.refMatchFailed` | 錯誤描述簡中 |

需同步更新 `src/components/features/document/detail/ProcessingTimeline.tsx` 的 `STEP_LABELS` 確認 `REFERENCE_NUMBER_MATCHING` 已存在（前次 CHANGE-036 已新增）。

---

## 資料庫影響

### 需要 Migration

```bash
npx prisma migrate dev --name add_ref_match_failed_status
```

**變更內容**：

1. `DocumentStatus` enum 新增 `REF_MATCH_FAILED` 值
2. `ExtractionResult` model 新增 `referenceNumberMatch Json?` 欄位（可選，用於持久化 ref match 結果）

**Migration SQL 預估**：

```sql
ALTER TYPE "DocumentStatus" ADD VALUE 'REF_MATCH_FAILED';
ALTER TABLE "ExtractionResult" ADD COLUMN "referenceNumberMatch" JSONB;
```

### 影響的 Prisma Models

| Model | 欄位 | 變更 |
|-------|------|------|
| `Document` | `status` | enum 新增值，無 schema 變更 |
| `ExtractionResult` | `referenceNumberMatch` | 新增 `Json?` 欄位 |

---

## 向後兼容性

### 評估

| 面向 | 影響 | 說明 |
|------|------|------|
| 既有文件 | **無影響** | 已處理完成的文件狀態不受影響 |
| `refMatchEnabled: false` 的公司 | **無影響** | 功能未啟用時完全不觸發新邏輯 |
| `refMatchEnabled: true` 的公司 | **行為變更** | 之前會繼續處理的無匹配文件，現在會中止 |
| API 回應格式 | **無影響** | `ExtractionV3Output` 已包含 `referenceNumberMatch` 欄位 |
| 前端文件列表 | **需更新** | 需處理新的 `REF_MATCH_FAILED` 狀態顯示 |
| 資料庫 | **向前兼容** | 新增 enum 值和可選欄位，不影響既有數據 |

### 遷移策略

不需要數據遷移。新的 `REF_MATCH_FAILED` 狀態只會出現在修復後新處理的文件上。

---

## 測試驗證

### 測試場景表

| # | 場景 | 前置條件 | 操作 | 預期結果 |
|---|------|----------|------|----------|
| T1 | 功能關閉 + 上傳文件 | `refMatchEnabled: false` | 上傳任意文件 | Pipeline 正常完成，跳過 ref match 步驟 |
| T2 | 功能開啟 + 匹配成功 | `refMatchEnabled: true`，文件名包含已知 ref number | 上傳文件 | Pipeline 正常完成，ref match 步驟 success=true |
| T3 | 功能開啟 + 匹配失敗 | `refMatchEnabled: true`，文件名不含任何 ref number | 上傳文件 | **Pipeline 中止**，文件狀態 `REF_MATCH_FAILED`，errorMessage 包含原因 |
| T4 | 功能開啟 + DB 異常 | `refMatchEnabled: true`，模擬 DB 連線失敗 | 上傳文件 | Pipeline 繼續（warning 記錄），不中止 |
| T5 | 文件名為空 | `refMatchEnabled: true`，`fileName: ''` | 上傳文件 | **Pipeline 中止**，matchesFound=0 |
| T6 | 重試機制 | 文件狀態為 `REF_MATCH_FAILED` | 點擊重試 | 文件重新進入 pipeline 處理 |
| T7 | 前端狀態顯示 | 文件狀態為 `REF_MATCH_FAILED` | 查看文件列表 | 顯示橙色圖標 + 「參考編號匹配失敗」文字 |
| T8 | 信心度計算 | `refMatchEnabled: true`，`matchesFound: 0` | 不適用（pipeline 已中止） | 信心度計算不被觸發 |

### 單元測試清單

1. `reference-number-matcher.service.test.ts`
   - 測試 `shouldAbortPipeline` 欄位正確設置
   - 測試 `enabled: true` + `matchesFound: 0` 的返回結構

2. `extraction-v3.service.test.ts`
   - 測試 `refMatchEnabled: true` + 無匹配時返回 `success: false`
   - 測試 `refMatchEnabled: true` + 有匹配時繼續 pipeline
   - 測試 `refMatchEnabled: false` 時跳過阻塞判斷
   - 測試 DB 異常時不中止 pipeline

3. `confidence-v3-1.service.test.ts`
   - 測試 `calculateRefMatchScore` 無匹配時返回 0

4. `document-status.test.ts`
   - 測試 `REF_MATCH_FAILED` 狀態配置正確

---

## 風險評估

| 風險 | 嚴重度 | 機率 | 緩解措施 |
|------|--------|------|----------|
| 已啟用 ref match 的公司大量文件被中止 | 中 | 中 | 部署前通知受影響公司確認文件命名規範 |
| 新增 DocumentStatus 造成前端渲染問題 | 低 | 低 | `getStatusConfig` 有 fallback 到 FAILED |
| Migration 在生產環境執行時間過長 | 低 | 低 | PostgreSQL ADD VALUE 和 ADD COLUMN 都是快速操作 |
| 異常路徑（catch block）誤判為中止 | 低 | 低 | 異常路徑保持原有行為（不中止），只有明確的 matchesFound=0 才中止 |

### 部署注意事項

1. **先執行 migration** → 再部署代碼
2. **通知使用者**：已啟用 ref match 的區域/公司，部署後文件名必須包含有效的 Reference Number
3. **監控指標**：部署後觀察 `REF_MATCH_FAILED` 狀態的文件數量，若異常高需檢查 ref number 主檔是否完整

---

## 實作優先順序

| 步驟 | 工作內容 | 預估時間 |
|------|----------|----------|
| 1 | Prisma schema 修改 + migration | 15 分鐘 |
| 2 | `extraction-v3.service.ts` 阻塞邏輯 | 30 分鐘 |
| 3 | `reference-number-matcher.service.ts` JSDoc 更新 | 5 分鐘 |
| 4 | `confidence-v3-1.service.ts` 分數調整 | 10 分鐘 |
| 5 | `document-status.ts` 新增狀態配置 | 15 分鐘 |
| 6 | `processing-result-persistence.service.ts` 持久化 | 20 分鐘 |
| 7 | i18n 翻譯更新（3 語言） | 15 分鐘 |
| 8 | 類型定義更新 | 10 分鐘 |
| 9 | 單元測試 | 45 分鐘 |
| **合計** | | **約 2.5 小時** |

---

*文件建立日期: 2026-02-11*
*最後更新: 2026-02-11*
