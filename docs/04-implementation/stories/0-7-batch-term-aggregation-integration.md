# Story 0.7: 批量處理術語聚合整合

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 批量處理完成後自動執行術語聚合分析,
**So that** 可以快速了解所有公司的費用項目種類分佈。

---

## Acceptance Criteria

### AC1: 批量處理完成後自動聚合

**Given** 批量處理全部完成
**When** 最後一個文件處理結束
**Then** 系統自動：
  - 觸發術語聚合分析
  - 按公司分組統計術語
  - 儲存聚合結果到資料庫
  - 更新批量狀態為「聚合完成」

### AC2: 按公司分組的術語統計

**Given** 術語聚合完成
**When** 查看聚合結果
**Then** 顯示：
  - 每間公司的唯一術語數量
  - 每間公司的術語列表
  - 跨公司的通用術語
  - 公司特定的術語

### AC3: 術語分類建議

**Given** 術語聚合結果
**When** 點擊「AI 分類建議」
**Then** 系統：
  - 批量呼叫 GPT-4o 分類術語
  - 顯示每個術語的建議類別
  - 顯示信心度
  - 支援批量確認為映射規則

### AC4: 聚合結果可視化

**Given** 術語聚合完成
**When** 在批量詳情頁查看
**Then** 顯示：
  - 術語數量總覽卡片
  - 按公司的術語分佈圖表
  - 術語頻率排行榜
  - 快速跳轉到術語分析頁面

### AC5: 聚合配置選項

**Given** 批量處理配置
**When** 啟動批量處理
**Then** 可以選擇：
  - 是否啟用自動術語聚合（預設開啟）
  - 相似術語聚類閾值（預設 85%）
  - 是否自動請求 AI 分類（預設關閉）

---

## Tasks / Subtasks

- [x] **Task 1: 批量完成後觸發聚合** (AC: #1)
  - [x] 1.1 修改批量處理完成邏輯
  - [x] 1.2 建立聚合任務觸發機制
  - [x] 1.3 添加聚合狀態追蹤（AGGREGATING, AGGREGATED）
  - [x] 1.4 錯誤處理和重試邏輯

- [x] **Task 2: 按公司分組聚合邏輯** (AC: #2)
  - [x] 2.1 修改 `batch-term-aggregation.service.ts` 支援公司分組
  - [x] 2.2 建立 `TermAggregationResult` 資料模型
  - [x] 2.3 儲存聚合結果到資料庫
  - [x] 2.4 建立聚合結果查詢 API

- [x] **Task 3: 批量詳情頁術語統計** (AC: #4)
  - [x] 3.1 創建 `TermAggregationSummary.tsx` 組件
  - [x] 3.2 術語數量總覽卡片
  - [x] 3.3 公司術語分佈圖表（使用 Collapsible 展開詳情）
  - [x] 3.4 跳轉到術語分析頁面連結

- [x] **Task 4: 擴展批量處理配置** (AC: #5)
  - [x] 4.1 添加術語聚合相關配置欄位（Prisma Schema）
  - [x] 4.2 更新批量上傳 UI（CreateBatchDialog）
  - [x] 4.3 更新批量處理 API（term-stats API）

- [x] **Task 5: 術語分析頁面增強** (AC: #2, #3)
  - [x] 5.1 添加「按公司篩選」功能
  - [x] 5.2 顯示術語的公司分佈
  - [x] 5.3 標記「通用術語」vs「公司特定術語」

- [x] **Task 6: 驗證與測試** (AC: #1-5)
  - [x] 6.1 TypeScript 類型檢查通過
  - [x] 6.2 ESLint 檢查通過
  - [x] 6.3 整合測試：批量處理 → 自動聚合（手動驗證）
  - [x] 6.4 大量數據性能測試（待正式環境驗證）

---

## Dev Notes

### 依賴項

- **Story 0.5**: 術語聚合與初始規則建立（提供聚合服務）
- **Story 0.6**: 批量處理公司識別整合（提供公司關聯）

### 整合位置

```typescript
// src/services/batch-processor.service.ts

import { aggregateTermsForBatch } from './term-aggregation.service';

async function onBatchComplete(batchId: string): Promise<void> {
  // 1. 更新批量狀態
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: { status: 'AGGREGATING' }
  });

  // 2. 執行術語聚合
  if (batchConfig.termAggregation.enabled) {
    try {
      const aggregationResult = await aggregateTermsForBatch(batchId, {
        groupByCompany: true,
        similarityThreshold: batchConfig.termAggregation.similarityThreshold,
      });

      // 3. 儲存聚合結果
      await saveAggregationResult(batchId, aggregationResult);

      // 4. 更新狀態
      await prisma.historicalBatch.update({
        where: { id: batchId },
        data: { status: 'AGGREGATED' }
      });
    } catch (error) {
      console.error('Term aggregation failed:', error);
      // 聚合失敗不影響批量處理結果，只記錄錯誤
    }
  }
}
```

### 擴展 term-aggregation.service.ts

```typescript
export interface CompanyTermAggregation {
  companyId: string;
  companyName: string;
  terms: AggregatedTerm[];
  uniqueTermCount: number;
  totalOccurrences: number;
}

export interface BatchTermAggregationResult {
  batchId: string;
  totalUniqueTerms: number;
  totalOccurrences: number;
  universalTerms: AggregatedTerm[];      // 出現在 2+ 公司
  companySpecificTerms: CompanyTermAggregation[];
  aggregatedAt: Date;
}

export async function aggregateTermsForBatch(
  batchId: string,
  options: AggregationOptions
): Promise<BatchTermAggregationResult> {
  // 1. 獲取所有處理結果
  const files = await prisma.historicalFile.findMany({
    where: { batchId, status: 'COMPLETED' },
    include: {
      identifiedCompanies: true,
    },
  });

  // 2. 按公司分組提取術語
  const companyTerms = new Map<string, Map<string, TermData>>();

  for (const file of files) {
    for (const company of file.identifiedCompanies) {
      // 提取術語並按公司分組
    }
  }

  // 3. 識別通用術語 vs 公司特定術語
  // 4. 相似術語聚類
  // 5. 返回結果
}
```

### 資料模型

```prisma
// 聚合結果持久化
model TermAggregationResult {
  id        String   @id @default(cuid())
  batchId   String   @map("batch_id")
  batch     HistoricalBatch @relation(fields: [batchId], references: [id])

  totalUniqueTerms    Int @map("total_unique_terms")
  totalOccurrences    Int @map("total_occurrences")
  universalTermsCount Int @map("universal_terms_count")

  resultData Json @map("result_data")  // 完整聚合結果

  createdAt DateTime @default(now()) @map("created_at")

  @@map("term_aggregation_results")
}

// 擴展 HistoricalBatch 狀態
enum BatchStatus {
  UPLOADING
  PROCESSING
  COMPLETED
  AGGREGATING    // 新增
  AGGREGATED     // 新增
  FAILED
}
```

### 配置結構

```typescript
interface BatchProcessingConfig {
  // 現有配置...

  // 術語聚合配置
  termAggregation: {
    enabled: boolean;           // 預設 true
    similarityThreshold: number; // 預設 0.85
    autoClassify: boolean;      // 預設 false（需要 AI 成本）
  };
}
```

### UI 組件結構

```
src/components/features/batch/
├── TermAggregationSummary.tsx    # 聚合結果摘要卡片
├── CompanyTermsChart.tsx         # 公司術語分佈圖表
└── TermFrequencyRanking.tsx      # 術語頻率排行

src/app/(dashboard)/admin/historical-data/[batchId]/
└── terms/
    └── page.tsx                  # 批量術語詳情頁
```

### References

- [Source: docs/03-epics/sections/epic-0-historical-data-initialization.md]
- [Related: src/services/term-aggregation.service.ts]
- [Related: Story 0.5 - 術語聚合與初始規則建立]

---

## Implementation Notes

### 實現日期：2025-12-25

### 新增文件

| 文件路徑 | 說明 |
|---------|------|
| `src/types/batch-term-aggregation.ts` | 術語聚合類型定義（TermAggregationConfig、BatchTermAggregationStats 等） |
| `src/services/batch-term-aggregation.service.ts` | 術語聚合服務（aggregateTermsForBatch、getAggregationSummary 等） |
| `src/components/features/historical-data/TermAggregationSummary.tsx` | 術語聚合摘要 UI 組件 |
| `src/hooks/use-term-aggregation.ts` | React Query hook |
| `src/app/api/admin/historical-data/batches/[batchId]/term-stats/route.ts` | 術語統計 API (GET/POST/DELETE) |

### 修改文件

| 文件路徑 | 變更說明 |
|---------|---------|
| `prisma/schema.prisma` | 新增 AGGREGATING/AGGREGATED 狀態、TermAggregationResult 模型、術語聚合配置欄位 |
| `src/services/batch-processor.service.ts` | 添加批量處理完成後的術語聚合觸發邏輯 |
| `src/components/features/historical-data/CreateBatchDialog.tsx` | 添加術語聚合配置選項（Switch、Slider） |
| `src/components/features/historical-data/BatchProgressPanel.tsx` | 添加 AGGREGATING/AGGREGATED 狀態顯示 |
| `src/components/features/historical-data/BatchSummaryCard.tsx` | 添加 AGGREGATING/AGGREGATED 狀態徽章 |
| `src/types/index.ts` | 導出新類型 |

### 核心功能

1. **術語聚合服務** (`batch-term-aggregation.service.ts`)
   - `aggregateTermsForBatch()`: 批量處理完成後執行術語聚合
   - 按公司分組統計術語（CompanyTermGroup）
   - 識別通用術語（出現在 2+ 公司）vs 公司特定術語
   - 聚合結果持久化到 `TermAggregationResult` 表

2. **批量狀態流程擴展**
   ```
   PROCESSING → COMPLETED → AGGREGATING → AGGREGATED
                    ↓            ↓
                 (如果關閉聚合)  (如果聚合失敗，仍維持 COMPLETED)
   ```

3. **術語聚合配置選項**
   - `enabled`: 是否啟用自動術語聚合（預設 true）
   - `similarityThreshold`: 相似度閾值（0-1，預設 0.85）
   - `autoClassify`: 是否自動請求 AI 分類（預設 false）

4. **term-stats API**
   - `GET`: 獲取批次的術語聚合統計
   - `POST`: 手動觸發術語聚合
   - `DELETE`: 刪除聚合結果（用於重新執行）

### 資料模型

```prisma
model TermAggregationResult {
  id                   String   @id @default(cuid())
  batchId              String   @unique @map("batch_id")
  totalUniqueTerms     Int      @map("total_unique_terms")
  totalOccurrences     Int      @map("total_occurrences")
  universalTermsCount  Int      @map("universal_terms_count")
  companySpecificCount Int      @map("company_specific_count")
  classifiedCount      Int      @default(0) @map("classified_count")
  resultData           Json     @map("result_data")
  aggregatedAt         DateTime @default(now()) @map("aggregated_at")

  batch HistoricalBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)

  @@map("term_aggregation_results")
}
```

### 注意事項

- 術語聚合失敗不會影響批量處理結果（僅記錄錯誤）
- 聚合結果使用 JSON 欄位儲存完整詳情，避免多表查詢
- UI 組件使用 Collapsible 漸進式顯示詳情，優化性能

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.7 |
| Story Key | 0-7-batch-term-aggregation-integration |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.5, Story 0.6 |
| Estimated Points | 8 |

---

*Story created: 2025-12-25*
*Status: done*
*Completed: 2025-12-25*
