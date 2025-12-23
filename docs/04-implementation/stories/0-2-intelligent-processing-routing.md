# Story 0.2: 智能處理路由

**Status:** pending

---

## Story

**As a** 系統,
**I want** 根據文件類型自動選擇最佳處理方式,
**So that** 可以平衡處理成本和準確性。

---

## Acceptance Criteria

### AC1: 自動處理路由

**Given** 文件已完成元數據檢測
**When** 系統決定處理方式
**Then** 根據 `detectedType` 自動選擇：
  - `NATIVE_PDF` → Azure Document Intelligence
  - `SCANNED_PDF` → GPT-4o Vision
  - `IMAGE` → GPT-4o Vision

### AC2: 處理成本估算

**Given** 批量處理任務準備開始
**When** 顯示確認對話框
**Then** 顯示預估成本：
  - Azure DI 文件數量和估算成本
  - GPT-4o Vision 文件數量和估算成本
  - 總預估成本

### AC3: 處理執行

**Given** 管理員確認開始處理
**When** 系統執行處理
**Then** 根據路由規則調用對應服務
**And** 記錄每個文件的處理方式和實際成本

### AC4: 處理結果記錄

**Given** 文件處理完成
**When** 查看處理結果
**Then** 顯示：
  - 使用的處理方式
  - 處理耗時
  - 實際成本
  - 提取結果

---

## Tasks / Subtasks

- [ ] **Task 1: 處理路由服務** (AC: #1)
  - [ ] 1.1 創建 `src/services/processing-router.service.ts`
  - [ ] 1.2 實現路由決策邏輯
  - [ ] 1.3 整合 Azure DI 服務
  - [ ] 1.4 整合 GPT-4o Vision 服務

- [ ] **Task 2: 成本估算服務** (AC: #2)
  - [ ] 2.1 創建 `src/services/cost-estimation.service.ts`
  - [ ] 2.2 Azure DI 成本計算（$0.01/頁）
  - [ ] 2.3 GPT-4o Vision 成本計算（$0.02-0.04/頁）
  - [ ] 2.4 批量成本聚合

- [ ] **Task 3: 處理確認對話框** (AC: #2)
  - [ ] 3.1 創建 `ProcessingConfirmDialog.tsx`
  - [ ] 3.2 顯示文件分類統計
  - [ ] 3.3 顯示成本估算明細
  - [ ] 3.4 確認/取消按鈕

- [ ] **Task 4: 批量處理執行器** (AC: #3)
  - [ ] 4.1 創建 `src/services/batch-processor.service.ts`
  - [ ] 4.2 實現並發控制（最多 5 個並發）
  - [ ] 4.3 錯誤處理和重試邏輯
  - [ ] 4.4 進度更新

- [ ] **Task 5: Azure DI 整合** (AC: #1, #3)
  - [ ] 5.1 增強現有 Azure DI 服務
  - [ ] 5.2 支援批量處理
  - [ ] 5.3 成本記錄

- [ ] **Task 6: GPT-4o Vision 整合** (AC: #1, #3)
  - [ ] 6.1 創建 `src/services/gpt-vision.service.ts`
  - [ ] 6.2 圖片轉 base64
  - [ ] 6.3 GPT-4o Vision API 調用
  - [ ] 6.4 結果解析

- [ ] **Task 7: 處理記錄 API** (AC: #4)
  - [ ] 7.1 創建 GET `/api/admin/historical-data/files/[id]/result`
  - [ ] 7.2 包含處理方式、耗時、成本
  - [ ] 7.3 包含提取結果

- [ ] **Task 8: 驗證與測試** (AC: #1-4)
  - [ ] 8.1 TypeScript 類型檢查通過
  - [ ] 8.2 ESLint 檢查通過
  - [ ] 8.3 路由邏輯測試
  - [ ] 8.4 成本估算準確性測試

---

## Dev Notes

### 依賴項

- **Story 0.1**: 批量文件上傳與元數據檢測
- 需要 Azure OpenAI API Key（GPT-4o Vision）
- 需要 Azure Document Intelligence Endpoint

### 處理路由邏輯

```typescript
// src/services/processing-router.service.ts

export interface ProcessingRoute {
  fileId: string;
  method: 'AZURE_DI' | 'GPT_VISION';
  estimatedCost: number;
}

export function determineProcessingRoute(
  detectedType: DetectedFileType
): 'AZURE_DI' | 'GPT_VISION' {
  switch (detectedType) {
    case 'NATIVE_PDF':
      return 'AZURE_DI'; // 成本較低，原生 PDF 效果好
    case 'SCANNED_PDF':
    case 'IMAGE':
      return 'GPT_VISION'; // 圖片識別更準確
    default:
      throw new Error(`Unknown file type: ${detectedType}`);
  }
}
```

### 成本估算

```typescript
// src/services/cost-estimation.service.ts

export const COST_CONFIG = {
  AZURE_DI: {
    perPage: 0.01, // USD
    description: 'Azure Document Intelligence',
  },
  GPT_VISION: {
    perPage: 0.03, // USD (平均值)
    description: 'GPT-4o Vision',
  },
};

export interface CostEstimation {
  azureDI: {
    fileCount: number;
    estimatedPages: number;
    estimatedCost: number;
  };
  gptVision: {
    fileCount: number;
    estimatedPages: number;
    estimatedCost: number;
  };
  total: number;
}

export function estimateBatchCost(files: HistoricalFile[]): CostEstimation {
  const azureDIFiles = files.filter(f => f.detectedType === 'NATIVE_PDF');
  const gptVisionFiles = files.filter(f =>
    f.detectedType === 'SCANNED_PDF' || f.detectedType === 'IMAGE'
  );

  // 假設平均每個文件 2 頁
  const avgPagesPerFile = 2;

  return {
    azureDI: {
      fileCount: azureDIFiles.length,
      estimatedPages: azureDIFiles.length * avgPagesPerFile,
      estimatedCost: azureDIFiles.length * avgPagesPerFile * COST_CONFIG.AZURE_DI.perPage,
    },
    gptVision: {
      fileCount: gptVisionFiles.length,
      estimatedPages: gptVisionFiles.length * avgPagesPerFile,
      estimatedCost: gptVisionFiles.length * avgPagesPerFile * COST_CONFIG.GPT_VISION.perPage,
    },
    total: 0, // 計算後填入
  };
}
```

### 數據模型擴展

```prisma
// 在 HistoricalFile 模型中增加

model HistoricalFile {
  // ... 現有欄位 ...

  // 處理相關
  processingMethod ProcessingMethod? @map("processing_method")
  processingStartAt DateTime?        @map("processing_start_at")
  processingEndAt   DateTime?        @map("processing_end_at")
  actualCost        Float?           @map("actual_cost")

  // 提取結果
  extractionResult  Json?            @map("extraction_result")
}

enum ProcessingMethod {
  AZURE_DI
  GPT_VISION
}
```

### References

- [Source: docs/03-epics/sections/epic-0-historical-data-initialization.md#story-02]
- [Source: docs/00-discovery/past-discussions/Batch_Preprocessing_Strategy.md] (參考)

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.2 |
| Story Key | 0-2-intelligent-processing-routing |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.1 |

---

*Story created: 2025-12-22*
*Status: pending*
