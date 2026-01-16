# Story 0.4: 批量處理進度追蹤

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 查看批量處理的即時進度,
**So that** 我可以監控處理狀態並處理異常。

---

## Acceptance Criteria

### AC1: 即時進度顯示

**Given** 批量處理任務正在執行
**When** 查看處理面板
**Then** 顯示：
  - 總文件數 / 已處理 / 待處理 / 失敗
  - 進度百分比和進度條
  - 預估剩餘時間
  - 當前處理文件名
  - 處理速率（文件/分鐘）

### AC2: 即時更新

**Given** 處理進行中
**When** 每個文件處理完成
**Then** 進度自動更新（無需手動刷新）
**And** 更新延遲 < 2 秒

### AC3: 錯誤處理與顯示

**Given** 處理過程中出現錯誤
**When** 查看錯誤詳情
**Then** 顯示：
  - 失敗文件列表
  - 每個失敗文件的錯誤原因
  - 重試選項
**And** 錯誤不影響其他文件繼續處理

### AC4: 處理控制

**Given** 處理進行中
**When** 管理員需要控制處理
**Then** 可以：
  - 暫停處理（可恢復）
  - 取消處理（不可恢復）
  - 跳過當前文件
  - 批量重試失敗文件

### AC5: 處理完成摘要

**Given** 批量處理完成
**When** 查看處理結果
**Then** 顯示摘要：
  - 成功 / 失敗 / 跳過數量
  - 總處理時間
  - 總成本
  - 新建公司數量
  - 提取術語數量

---

## Tasks / Subtasks

- [x] **Task 1: 進度追蹤服務** (AC: #1, #2)
  - [x] 1.1 創建 `src/services/batch-progress.service.ts`
  - [x] 1.2 進度計算邏輯
  - [x] 1.3 處理速率計算
  - [x] 1.4 剩餘時間估算

- [x] **Task 2: 即時更新機制** (AC: #2)
  - [x] 2.1 選擇實現方式（SSE / WebSocket / 輪詢）→ 選用 SSE
  - [x] 2.2 創建 `/api/admin/historical-data/batches/[id]/progress` 端點
  - [x] 2.3 前端進度訂閱 Hook (`use-batch-progress.ts`)
  - [x] 2.4 自動重連機制

- [x] **Task 3: 進度面板組件** (AC: #1)
  - [x] 3.1 創建 `BatchProgressPanel.tsx`
  - [x] 3.2 進度條組件
  - [x] 3.3 統計數據卡片
  - [x] 3.4 當前處理文件顯示
  - [x] 3.5 處理速率圖表（可選）→ 整合在 BatchProgressPanel

- [x] **Task 4: 錯誤處理 UI** (AC: #3)
  - [x] 4.1 創建 `BatchErrorList.tsx`
  - [x] 4.2 失敗文件列表
  - [x] 4.3 錯誤詳情展開
  - [x] 4.4 單個重試按鈕
  - [x] 4.5 批量重試按鈕

- [x] **Task 5: 處理控制功能** (AC: #4)
  - [x] 5.1 暫停/恢復 API (`pause/route.ts`, `resume/route.ts`)
  - [x] 5.2 取消 API (`cancel/route.ts`)
  - [x] 5.3 跳過 API (`files/skip/route.ts`, `files/[id]/skip/route.ts`)
  - [x] 5.4 控制按鈕 UI (整合在 BatchProgressPanel)
  - [x] 5.5 確認對話框 (`ProcessingConfirmDialog.tsx`)

- [x] **Task 6: 處理完成摘要** (AC: #5)
  - [x] 6.1 創建 `BatchSummaryCard.tsx`
  - [x] 6.2 統計數據聚合
  - [x] 6.3 成本計算
  - [x] 6.4 導出報告功能（JSON/CSV 格式）

- [x] **Task 7: 數據模型擴展** (AC: #1-5)
  - [x] 7.1 更新 HistoricalBatch 模型
  - [x] 7.2 新增進度相關欄位 (`pausedAt`, `skippedFiles`)
  - [x] 7.3 新增 PAUSED 狀態到 HistoricalBatchStatus
  - [x] 7.4 新增 SKIPPED 狀態到 HistoricalFileStatus
  - [x] 7.5 新增 ADMIN_VIEW 和 ADMIN_MANAGE 權限

- [x] **Task 8: 驗證與測試** (AC: #1-5)
  - [x] 8.1 TypeScript 類型檢查通過
  - [x] 8.2 ESLint 檢查通過
  - [x] 8.3 進度更新延遲測試（SSE 1秒更新間隔）
  - [x] 8.4 錯誤處理測試

---

## Dev Notes

### 依賴項

- **Story 0.1**: 批量文件上傳
- **Story 0.2**: 智能處理路由

### 即時更新方案選擇

```typescript
// 方案 A: Server-Sent Events (SSE) - 推薦
// 優點：簡單、瀏覽器原生支持、單向推送足夠
// 缺點：需要保持連接

// 方案 B: 輪詢
// 優點：實現簡單、無連接維護
// 缺點：延遲較高、浪費請求

// 方案 C: WebSocket
// 優點：雙向通信
// 缺點：此場景不需要雙向、實現複雜

// 建議使用 SSE
```

### SSE 實現

```typescript
// src/app/api/admin/historical-data/batches/[id]/progress/route.ts

import { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const batchId = params.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = async () => {
        const progress = await getBatchProgress(batchId);
        const data = `data: ${JSON.stringify(progress)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // 初始發送
      await sendProgress();

      // 定期更新（每 2 秒）
      const interval = setInterval(async () => {
        try {
          await sendProgress();
          const batch = await prisma.historicalBatch.findUnique({
            where: { id: batchId },
            select: { status: true },
          });
          if (batch?.status === 'COMPLETED' || batch?.status === 'FAILED') {
            clearInterval(interval);
            controller.close();
          }
        } catch (error) {
          clearInterval(interval);
          controller.error(error);
        }
      }, 2000);

      // 清理
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 前端 Hook

```typescript
// src/hooks/use-batch-progress.ts

import { useEffect, useState } from 'react';

export interface BatchProgress {
  batchId: string;
  status: BatchStatus;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  currentFile: string | null;
  processingRate: number; // 文件/分鐘
  estimatedTimeRemaining: number; // 秒
  startedAt: string;
  errors: {
    fileId: string;
    fileName: string;
    errorMessage: string;
  }[];
}

export function useBatchProgress(batchId: string) {
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/admin/historical-data/batches/${batchId}/progress`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
    };

    eventSource.onerror = (err) => {
      setError(new Error('Connection lost'));
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [batchId]);

  return { progress, error };
}
```

### 數據模型擴展

```prisma
model HistoricalBatch {
  // ... 現有欄位 ...

  // 進度相關
  startedAt         DateTime? @map("started_at")
  completedAt       DateTime? @map("completed_at")
  pausedAt          DateTime? @map("paused_at")
  currentFileId     String?   @map("current_file_id")

  // 統計
  skippedFiles      Int       @default(0) @map("skipped_files")
  totalCost         Float     @default(0) @map("total_cost")
  newCompaniesCount Int       @default(0) @map("new_companies_count")
  extractedTermsCount Int     @default(0) @map("extracted_terms_count")
}
```

### API 端點

```typescript
// 控制 API

// POST /api/admin/historical-data/batches/[id]/pause
// POST /api/admin/historical-data/batches/[id]/resume
// POST /api/admin/historical-data/batches/[id]/cancel
// POST /api/admin/historical-data/batches/[id]/skip/[fileId]
// POST /api/admin/historical-data/batches/[id]/retry
interface RetryRequest {
  fileIds?: string[]; // 不提供則重試所有失敗
}
```

### References

- [Source: docs/03-epics/sections/epic-0-historical-data-initialization.md#story-04]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.4 |
| Story Key | 0-4-batch-processing-progress-tracking |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.1, Story 0.2 |

---

## Implementation Notes

### 實現摘要

**完成日期**: 2025-12-23

**實現的組件和服務**:

1. **進度追蹤服務** (`src/services/batch-progress.service.ts`)
   - 進度計算、處理速率、剩餘時間估算
   - 整合錯誤文件列表

2. **SSE 即時更新** (`src/app/api/admin/historical-data/batches/[id]/progress/route.ts`)
   - 1秒更新間隔
   - 15秒心跳保活
   - 5分鐘最大連線時間
   - 自動完成檢測

3. **前端組件**:
   - `BatchProgressPanel.tsx` - 進度面板（進度條、統計、控制按鈕）
   - `BatchErrorList.tsx` - 錯誤列表（展開詳情、重試功能）
   - `BatchSummaryCard.tsx` - 完成摘要（統計、成本、導出）
   - `ProcessingConfirmDialog.tsx` - 確認對話框

4. **控制 API**:
   - `pause/route.ts` - 暫停處理
   - `resume/route.ts` - 恢復處理
   - `cancel/route.ts` - 取消處理
   - `files/skip/route.ts` - 批量跳過
   - `files/[id]/skip/route.ts` - 單個跳過
   - `files/[id]/retry/route.ts` - 單個重試
   - `files/retry/route.ts` - 批量重試

5. **數據模型擴展**:
   - HistoricalBatchStatus: 新增 `PAUSED`
   - HistoricalFileStatus: 新增 `SKIPPED`
   - HistoricalBatch: 新增 `pausedAt` 欄位

6. **權限擴展**:
   - 新增 `ADMIN_VIEW` 權限
   - 新增 `ADMIN_MANAGE` 權限
   - 更新權限分類 UI

### 技術決策

- **SSE vs WebSocket**: 選用 SSE，因為只需單向推送，實現簡單且瀏覽器原生支持
- **更新頻率**: 1秒間隔，平衡即時性與效能

---

*Story created: 2025-12-22*
*Story completed: 2025-12-23*
*Status: done*
