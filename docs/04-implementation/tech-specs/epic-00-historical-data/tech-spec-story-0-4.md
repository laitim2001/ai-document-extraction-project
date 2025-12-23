# Tech Spec: Story 0.4 - 批量處理進度追蹤

| 屬性 | 值 |
|------|------|
| Story ID | 0.4 |
| Story Key | 0-4-batch-processing-progress-tracking |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.1 (批量上傳), Story 0.2 (智能路由) |
| 預估工時 | 3-4 天 |
| 優先級 | P0 (必要) |

---

## 目標

實現批量處理的即時進度追蹤系統，使用 Server-Sent Events (SSE) 提供實時更新，並支持暫停、恢復、取消、跳過等處理控制功能。

---

## 驗收標準對應

| AC# | 驗收標準 | 實現方式 |
|-----|---------|---------|
| AC1 | 即時進度顯示 | `BatchProgressPanel.tsx` + `useBatchProgress` hook |
| AC2 | 即時更新 (<2秒延遲) | SSE 端點 + 2秒間隔推送 |
| AC3 | 錯誤處理與顯示 | `BatchErrorList.tsx` + 重試 API |
| AC4 | 處理控制 | pause/resume/cancel/skip API 端點 |
| AC5 | 處理完成摘要 | `BatchSummaryCard.tsx` + 統計聚合服務 |

---

## 數據模型

### Prisma Schema 擴展

```prisma
// prisma/schema.prisma

// 擴展現有 HistoricalBatch 模型
model HistoricalBatch {
  id                  String       @id @default(uuid())
  name                String
  description         String?
  status              BatchStatus  @default(PENDING)

  // === 文件計數 ===
  totalFiles          Int          @default(0) @map("total_files")
  processedFiles      Int          @default(0) @map("processed_files")
  failedFiles         Int          @default(0) @map("failed_files")
  skippedFiles        Int          @default(0) @map("skipped_files")

  // === 進度追蹤 ===
  currentFileId       String?      @map("current_file_id")
  currentFileName     String?      @map("current_file_name")
  startedAt           DateTime?    @map("started_at")
  completedAt         DateTime?    @map("completed_at")
  pausedAt            DateTime?    @map("paused_at")

  // === 統計數據 ===
  totalCost           Float        @default(0) @map("total_cost")
  newCompaniesCount   Int          @default(0) @map("new_companies_count")
  extractedTermsCount Int          @default(0) @map("extracted_terms_count")

  // === 處理配置 ===
  concurrentLimit     Int          @default(3) @map("concurrent_limit")
  retryAttempts       Int          @default(3) @map("retry_attempts")

  // === 元數據 ===
  createdAt           DateTime     @default(now()) @map("created_at")
  updatedAt           DateTime     @updatedAt @map("updated_at")
  createdBy           String       @map("created_by")

  // === 關聯 ===
  creator             User         @relation(fields: [createdBy], references: [id])
  files               HistoricalFile[]

  @@index([status])
  @@index([createdAt])
  @@map("historical_batches")
}

enum BatchStatus {
  PENDING      // 待處理
  PROCESSING   // 處理中
  PAUSED       // 已暫停
  COMPLETED    // 已完成
  FAILED       // 失敗
  CANCELLED    // 已取消
}

// 擴展 HistoricalFile 模型
model HistoricalFile {
  id              String              @id @default(uuid())
  batchId         String              @map("batch_id")

  // === 文件信息 ===
  originalName    String              @map("original_name")
  storagePath     String              @map("storage_path")
  mimeType        String              @map("mime_type")
  fileSize        Int                 @map("file_size")

  // === 處理信息 ===
  status          FileProcessingStatus @default(PENDING)
  detectedType    DetectedFileType?   @map("detected_type")
  hasTextLayer    Boolean?            @map("has_text_layer")
  processingRoute ProcessingRoute?    @map("processing_route")

  // === 處理結果 ===
  processingCost  Float?              @map("processing_cost")
  processedAt     DateTime?           @map("processed_at")
  processingTime  Int?                @map("processing_time") // 毫秒

  // === 錯誤追蹤 ===
  errorMessage    String?             @map("error_message")
  errorCode       String?             @map("error_code")
  retryCount      Int                 @default(0) @map("retry_count")
  lastRetryAt     DateTime?           @map("last_retry_at")

  // === 元數據 ===
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  // === 關聯 ===
  batch           HistoricalBatch     @relation(fields: [batchId], references: [id], onDelete: Cascade)

  @@index([batchId])
  @@index([status])
  @@map("historical_files")
}

enum FileProcessingStatus {
  PENDING       // 待處理
  PROCESSING    // 處理中
  COMPLETED     // 已完成
  FAILED        // 失敗
  SKIPPED       // 已跳過
  RETRYING      // 重試中
}
```

---

## 類型定義

### 進度數據類型

```typescript
// src/types/batch-progress.ts

/**
 * @fileoverview 批量處理進度相關類型定義
 * @module src/types/batch-progress
 * @since Epic 0 - Story 0.4
 */

import { BatchStatus, FileProcessingStatus } from '@prisma/client';

/**
 * 批量處理進度數據
 */
export interface BatchProgress {
  /** 批次 ID */
  batchId: string;
  /** 批次名稱 */
  batchName: string;
  /** 當前狀態 */
  status: BatchStatus;

  /** 文件計數 */
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  skippedFiles: number;

  /** 當前處理文件 */
  currentFile: {
    id: string;
    name: string;
  } | null;

  /** 進度計算 */
  progressPercent: number;
  processingRate: number;       // 文件/分鐘
  estimatedTimeRemaining: number; // 秒

  /** 時間信息 */
  startedAt: string | null;
  elapsedTime: number;          // 秒

  /** 成本統計 */
  totalCost: number;

  /** 錯誤列表 */
  errors: BatchFileError[];

  /** 更新時間戳 */
  updatedAt: string;
}

/**
 * 批次文件錯誤信息
 */
export interface BatchFileError {
  fileId: string;
  fileName: string;
  errorCode: string | null;
  errorMessage: string;
  retryCount: number;
  failedAt: string;
}

/**
 * 批量處理完成摘要
 */
export interface BatchSummary {
  batchId: string;
  batchName: string;
  status: BatchStatus;

  /** 文件統計 */
  totalFiles: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  successRate: number;          // 百分比

  /** 時間統計 */
  startedAt: string;
  completedAt: string;
  totalDuration: number;        // 秒
  averageProcessingTime: number; // 毫秒/文件

  /** 成本統計 */
  totalCost: number;
  azureDiCost: number;
  gptVisionCost: number;

  /** 業務統計 */
  newCompaniesCount: number;
  extractedTermsCount: number;

  /** 處理路由分布 */
  routeDistribution: {
    azureDi: number;
    gptVision: number;
  };
}

/**
 * SSE 進度事件類型
 */
export type ProgressEventType =
  | 'progress'      // 進度更新
  | 'file_started'  // 文件開始處理
  | 'file_completed'// 文件處理完成
  | 'file_failed'   // 文件處理失敗
  | 'batch_paused'  // 批次暫停
  | 'batch_resumed' // 批次恢復
  | 'batch_completed' // 批次完成
  | 'batch_cancelled'; // 批次取消

/**
 * SSE 進度事件
 */
export interface ProgressEvent {
  type: ProgressEventType;
  timestamp: string;
  data: BatchProgress | BatchSummary | { fileId: string; fileName: string };
}

/**
 * 處理控制操作
 */
export type BatchControlAction = 'pause' | 'resume' | 'cancel';

/**
 * 批量重試請求
 */
export interface BatchRetryRequest {
  /** 指定要重試的文件 ID，為空則重試所有失敗文件 */
  fileIds?: string[];
}

/**
 * 批量重試結果
 */
export interface BatchRetryResult {
  batchId: string;
  retriedCount: number;
  fileIds: string[];
}
```

---

## 實現指南

### Phase 1: 進度追蹤服務

#### 1.1 進度計算服務

```typescript
// src/services/batch-progress.service.ts

/**
 * @fileoverview 批量處理進度計算服務
 * @module src/services/batch-progress
 * @since Epic 0 - Story 0.4
 */

import { prisma } from '@/lib/prisma';
import type { BatchProgress, BatchSummary, BatchFileError } from '@/types/batch-progress';

/**
 * 獲取批次進度
 */
export async function getBatchProgress(batchId: string): Promise<BatchProgress> {
  const batch = await prisma.historicalBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: {
      files: {
        where: { status: 'FAILED' },
        select: {
          id: true,
          originalName: true,
          errorCode: true,
          errorMessage: true,
          retryCount: true,
          updatedAt: true,
        },
      },
    },
  });

  // 計算處理速率和剩餘時間
  const { processingRate, estimatedTimeRemaining } = calculateProcessingMetrics(
    batch.processedFiles,
    batch.totalFiles,
    batch.startedAt
  );

  // 計算進度百分比
  const progressPercent = batch.totalFiles > 0
    ? Math.round((batch.processedFiles / batch.totalFiles) * 100)
    : 0;

  // 計算已用時間
  const elapsedTime = batch.startedAt
    ? Math.floor((Date.now() - batch.startedAt.getTime()) / 1000)
    : 0;

  // 格式化錯誤列表
  const errors: BatchFileError[] = batch.files.map((file) => ({
    fileId: file.id,
    fileName: file.originalName,
    errorCode: file.errorCode,
    errorMessage: file.errorMessage ?? 'Unknown error',
    retryCount: file.retryCount,
    failedAt: file.updatedAt.toISOString(),
  }));

  return {
    batchId: batch.id,
    batchName: batch.name,
    status: batch.status,
    totalFiles: batch.totalFiles,
    processedFiles: batch.processedFiles,
    failedFiles: batch.failedFiles,
    skippedFiles: batch.skippedFiles,
    currentFile: batch.currentFileId
      ? { id: batch.currentFileId, name: batch.currentFileName ?? '' }
      : null,
    progressPercent,
    processingRate,
    estimatedTimeRemaining,
    startedAt: batch.startedAt?.toISOString() ?? null,
    elapsedTime,
    totalCost: batch.totalCost,
    errors,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 計算處理指標
 */
function calculateProcessingMetrics(
  processedFiles: number,
  totalFiles: number,
  startedAt: Date | null
): { processingRate: number; estimatedTimeRemaining: number } {
  if (!startedAt || processedFiles === 0) {
    return { processingRate: 0, estimatedTimeRemaining: 0 };
  }

  const elapsedMinutes = (Date.now() - startedAt.getTime()) / (1000 * 60);
  const processingRate = elapsedMinutes > 0
    ? Math.round((processedFiles / elapsedMinutes) * 10) / 10
    : 0;

  const remainingFiles = totalFiles - processedFiles;
  const estimatedTimeRemaining = processingRate > 0
    ? Math.ceil((remainingFiles / processingRate) * 60) // 轉換為秒
    : 0;

  return { processingRate, estimatedTimeRemaining };
}

/**
 * 獲取批次完成摘要
 */
export async function getBatchSummary(batchId: string): Promise<BatchSummary> {
  const batch = await prisma.historicalBatch.findUniqueOrThrow({
    where: { id: batchId },
  });

  // 計算各路由的文件數
  const routeDistribution = await prisma.historicalFile.groupBy({
    by: ['processingRoute'],
    where: { batchId },
    _count: true,
  });

  const azureDiCount = routeDistribution.find(r => r.processingRoute === 'AZURE_DI')?._count ?? 0;
  const gptVisionCount = routeDistribution.find(r => r.processingRoute === 'GPT_VISION')?._count ?? 0;

  // 計算平均處理時間
  const avgResult = await prisma.historicalFile.aggregate({
    where: { batchId, status: 'COMPLETED' },
    _avg: { processingTime: true },
  });

  const totalDuration = batch.startedAt && batch.completedAt
    ? Math.floor((batch.completedAt.getTime() - batch.startedAt.getTime()) / 1000)
    : 0;

  const successCount = batch.processedFiles - batch.failedFiles;
  const successRate = batch.totalFiles > 0
    ? Math.round((successCount / batch.totalFiles) * 100)
    : 0;

  // 估算成本分布（基於處理路由）
  const AZURE_DI_COST_PER_PAGE = 0.01;
  const GPT_VISION_COST_PER_PAGE = 0.03;
  const azureDiCost = azureDiCount * AZURE_DI_COST_PER_PAGE;
  const gptVisionCost = gptVisionCount * GPT_VISION_COST_PER_PAGE;

  return {
    batchId: batch.id,
    batchName: batch.name,
    status: batch.status,
    totalFiles: batch.totalFiles,
    successCount,
    failedCount: batch.failedFiles,
    skippedCount: batch.skippedFiles,
    successRate,
    startedAt: batch.startedAt?.toISOString() ?? '',
    completedAt: batch.completedAt?.toISOString() ?? '',
    totalDuration,
    averageProcessingTime: avgResult._avg.processingTime ?? 0,
    totalCost: batch.totalCost,
    azureDiCost,
    gptVisionCost,
    newCompaniesCount: batch.newCompaniesCount,
    extractedTermsCount: batch.extractedTermsCount,
    routeDistribution: {
      azureDi: azureDiCount,
      gptVision: gptVisionCount,
    },
  };
}

/**
 * 更新當前處理文件
 */
export async function updateCurrentFile(
  batchId: string,
  fileId: string,
  fileName: string
): Promise<void> {
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      currentFileId: fileId,
      currentFileName: fileName,
    },
  });
}

/**
 * 遞增處理計數
 */
export async function incrementProcessedCount(
  batchId: string,
  success: boolean,
  cost: number
): Promise<void> {
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      processedFiles: { increment: 1 },
      failedFiles: success ? undefined : { increment: 1 },
      totalCost: { increment: cost },
    },
  });
}

/**
 * 標記文件失敗
 */
export async function markFileFailed(
  fileId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await prisma.historicalFile.update({
    where: { id: fileId },
    data: {
      status: 'FAILED',
      errorCode,
      errorMessage,
      retryCount: { increment: 1 },
      lastRetryAt: new Date(),
    },
  });
}
```

### Phase 2: SSE 進度端點

#### 2.1 SSE 路由

```typescript
// src/app/api/admin/historical-data/batches/[id]/progress/route.ts

/**
 * @fileoverview 批量處理進度 SSE 端點
 * @module src/app/api/admin/historical-data/batches/[id]/progress
 * @since Epic 0 - Story 0.4
 */

import { NextRequest } from 'next/server';
import { getBatchProgress } from '@/services/batch-progress.service';
import { prisma } from '@/lib/prisma';

const PROGRESS_INTERVAL = 2000; // 2 秒更新間隔

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  // 驗證批次存在
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    select: { id: true },
  });

  if (!batch) {
    return new Response(JSON.stringify({ error: 'Batch not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      /**
       * 發送進度數據
       */
      const sendProgress = async () => {
        try {
          const progress = await getBatchProgress(batchId);
          const eventData = `data: ${JSON.stringify({
            type: 'progress',
            timestamp: new Date().toISOString(),
            data: progress,
          })}\n\n`;
          controller.enqueue(encoder.encode(eventData));

          // 檢查是否應該結束
          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(progress.status)) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            controller.close();
          }
        } catch (error) {
          console.error('Error sending progress:', error);
          // 發送錯誤事件
          const errorData = `data: ${JSON.stringify({
            type: 'error',
            timestamp: new Date().toISOString(),
            data: { message: 'Failed to fetch progress' },
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        }
      };

      // 立即發送初始進度
      await sendProgress();

      // 設置定期更新
      intervalId = setInterval(sendProgress, PROGRESS_INTERVAL);

      // 處理客戶端斷開連接
      request.signal.addEventListener('abort', () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 緩存
    },
  });
}
```

### Phase 3: 處理控制 API

#### 3.1 暫停處理

```typescript
// src/app/api/admin/historical-data/batches/[id]/pause/route.ts

/**
 * @fileoverview 暫停批量處理
 * @module src/app/api/admin/historical-data/batches/[id]/pause
 * @since Epic 0 - Story 0.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  try {
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    if (batch.status !== 'PROCESSING') {
      return NextResponse.json(
        { error: 'Only processing batches can be paused' },
        { status: 400 }
      );
    }

    const updatedBatch = await prisma.historicalBatch.update({
      where: { id: batchId },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        batchId: updatedBatch.id,
        status: updatedBatch.status,
        pausedAt: updatedBatch.pausedAt,
      },
    });
  } catch (error) {
    console.error('Error pausing batch:', error);
    return NextResponse.json(
      { error: 'Failed to pause batch' },
      { status: 500 }
    );
  }
}
```

#### 3.2 恢復處理

```typescript
// src/app/api/admin/historical-data/batches/[id]/resume/route.ts

/**
 * @fileoverview 恢復批量處理
 * @module src/app/api/admin/historical-data/batches/[id]/resume
 * @since Epic 0 - Story 0.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  try {
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    if (batch.status !== 'PAUSED') {
      return NextResponse.json(
        { error: 'Only paused batches can be resumed' },
        { status: 400 }
      );
    }

    const updatedBatch = await prisma.historicalBatch.update({
      where: { id: batchId },
      data: {
        status: 'PROCESSING',
        pausedAt: null,
      },
    });

    // 注意：實際恢復處理邏輯需要通知處理 worker
    // 可以通過 Redis Pub/Sub 或其他機制實現

    return NextResponse.json({
      success: true,
      data: {
        batchId: updatedBatch.id,
        status: updatedBatch.status,
      },
    });
  } catch (error) {
    console.error('Error resuming batch:', error);
    return NextResponse.json(
      { error: 'Failed to resume batch' },
      { status: 500 }
    );
  }
}
```

#### 3.3 取消處理

```typescript
// src/app/api/admin/historical-data/batches/[id]/cancel/route.ts

/**
 * @fileoverview 取消批量處理
 * @module src/app/api/admin/historical-data/batches/[id]/cancel
 * @since Epic 0 - Story 0.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  try {
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    if (!['PROCESSING', 'PAUSED', 'PENDING'].includes(batch.status)) {
      return NextResponse.json(
        { error: 'Batch cannot be cancelled in current status' },
        { status: 400 }
      );
    }

    // 使用事務更新批次和所有待處理文件
    const result = await prisma.$transaction(async (tx) => {
      // 取消批次
      const updatedBatch = await tx.historicalBatch.update({
        where: { id: batchId },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });

      // 將所有待處理/處理中的文件標記為已跳過
      await tx.historicalFile.updateMany({
        where: {
          batchId,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        data: {
          status: 'SKIPPED',
        },
      });

      // 統計被跳過的文件數
      const skippedCount = await tx.historicalFile.count({
        where: { batchId, status: 'SKIPPED' },
      });

      await tx.historicalBatch.update({
        where: { id: batchId },
        data: { skippedFiles: skippedCount },
      });

      return updatedBatch;
    });

    return NextResponse.json({
      success: true,
      data: {
        batchId: result.id,
        status: result.status,
        message: 'Batch cancelled successfully',
      },
    });
  } catch (error) {
    console.error('Error cancelling batch:', error);
    return NextResponse.json(
      { error: 'Failed to cancel batch' },
      { status: 500 }
    );
  }
}
```

#### 3.4 跳過文件

```typescript
// src/app/api/admin/historical-data/batches/[id]/skip/[fileId]/route.ts

/**
 * @fileoverview 跳過指定文件
 * @module src/app/api/admin/historical-data/batches/[id]/skip/[fileId]
 * @since Epic 0 - Story 0.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: batchId, fileId } = await params;

  try {
    const file = await prisma.historicalFile.findFirst({
      where: { id: fileId, batchId },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found in batch' },
        { status: 404 }
      );
    }

    if (!['PENDING', 'FAILED', 'PROCESSING'].includes(file.status)) {
      return NextResponse.json(
        { error: 'File cannot be skipped in current status' },
        { status: 400 }
      );
    }

    // 使用事務更新
    await prisma.$transaction(async (tx) => {
      await tx.historicalFile.update({
        where: { id: fileId },
        data: { status: 'SKIPPED' },
      });

      await tx.historicalBatch.update({
        where: { id: batchId },
        data: {
          skippedFiles: { increment: 1 },
          processedFiles: { increment: 1 },
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        status: 'SKIPPED',
      },
    });
  } catch (error) {
    console.error('Error skipping file:', error);
    return NextResponse.json(
      { error: 'Failed to skip file' },
      { status: 500 }
    );
  }
}
```

#### 3.5 重試失敗文件

```typescript
// src/app/api/admin/historical-data/batches/[id]/retry/route.ts

/**
 * @fileoverview 重試失敗文件
 * @module src/app/api/admin/historical-data/batches/[id]/retry
 * @since Epic 0 - Story 0.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { BatchRetryRequest, BatchRetryResult } from '@/types/batch-progress';

const retrySchema = z.object({
  fileIds: z.array(z.string().uuid()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;

  try {
    const body = await request.json();
    const { fileIds } = retrySchema.parse(body) as BatchRetryRequest;

    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // 構建查詢條件
    const whereClause: any = {
      batchId,
      status: 'FAILED',
    };

    if (fileIds && fileIds.length > 0) {
      whereClause.id = { in: fileIds };
    }

    // 獲取要重試的文件
    const filesToRetry = await prisma.historicalFile.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (filesToRetry.length === 0) {
      return NextResponse.json(
        { error: 'No failed files to retry' },
        { status: 400 }
      );
    }

    // 使用事務重置文件狀態
    await prisma.$transaction(async (tx) => {
      await tx.historicalFile.updateMany({
        where: {
          id: { in: filesToRetry.map(f => f.id) },
        },
        data: {
          status: 'PENDING',
          errorCode: null,
          errorMessage: null,
        },
      });

      // 更新批次統計
      await tx.historicalBatch.update({
        where: { id: batchId },
        data: {
          failedFiles: { decrement: filesToRetry.length },
          processedFiles: { decrement: filesToRetry.length },
          status: 'PROCESSING',
        },
      });
    });

    const result: BatchRetryResult = {
      batchId,
      retriedCount: filesToRetry.length,
      fileIds: filesToRetry.map(f => f.id),
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error retrying files:', error);
    return NextResponse.json(
      { error: 'Failed to retry files' },
      { status: 500 }
    );
  }
}
```

### Phase 4: 前端實現

#### 4.1 進度訂閱 Hook

```typescript
// src/hooks/use-batch-progress.ts

/**
 * @fileoverview 批量處理進度訂閱 Hook
 * @module src/hooks/use-batch-progress
 * @since Epic 0 - Story 0.4
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { BatchProgress, ProgressEvent } from '@/types/batch-progress';

interface UseBatchProgressOptions {
  /** 是否啟用自動訂閱 */
  enabled?: boolean;
  /** 重連延遲（毫秒） */
  reconnectDelay?: number;
  /** 最大重連次數 */
  maxReconnectAttempts?: number;
}

interface UseBatchProgressReturn {
  progress: BatchProgress | null;
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
}

export function useBatchProgress(
  batchId: string,
  options: UseBatchProgressOptions = {}
): UseBatchProgressReturn {
  const {
    enabled = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !batchId) return;

    // 清理現有連接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/admin/historical-data/batches/${batchId}/progress`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed: ProgressEvent = JSON.parse(event.data);

        if (parsed.type === 'progress') {
          setProgress(parsed.data as BatchProgress);
        }

        // 如果處理完成，關閉連接
        const progressData = parsed.data as BatchProgress;
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(progressData.status)) {
          eventSource.close();
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();

      // 自動重連
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
      } else {
        setError(new Error('Failed to connect after multiple attempts'));
      }
    };
  }, [batchId, enabled, reconnectDelay, maxReconnectAttempts]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { progress, isConnected, error, reconnect };
}
```

#### 4.2 進度面板組件

```tsx
// src/components/features/historical-data/BatchProgressPanel.tsx

/**
 * @fileoverview 批量處理進度面板
 * @module src/components/features/historical-data/BatchProgressPanel
 * @since Epic 0 - Story 0.4
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Pause,
  Play,
  XCircle,
  RefreshCw,
  FileText,
  Clock,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { useBatchProgress } from '@/hooks/use-batch-progress';
import type { BatchProgress } from '@/types/batch-progress';
import { cn } from '@/lib/utils';

interface BatchProgressPanelProps {
  batchId: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-500',
  PROCESSING: 'bg-blue-500',
  PAUSED: 'bg-yellow-500',
  COMPLETED: 'bg-green-500',
  FAILED: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待處理',
  PROCESSING: '處理中',
  PAUSED: '已暫停',
  COMPLETED: '已完成',
  FAILED: '失敗',
  CANCELLED: '已取消',
};

export function BatchProgressPanel({
  batchId,
  onPause,
  onResume,
  onCancel,
  className,
}: BatchProgressPanelProps) {
  const { progress, isConnected, error, reconnect } = useBatchProgress(batchId);

  if (error) {
    return (
      <Card className={cn('border-red-200', className)}>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>連接失敗</span>
            <Button variant="outline" size="sm" onClick={reconnect}>
              <RefreshCw className="h-4 w-4 mr-1" />
              重連
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>載入中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canPause = progress.status === 'PROCESSING';
  const canResume = progress.status === 'PAUSED';
  const canCancel = ['PROCESSING', 'PAUSED', 'PENDING'].includes(progress.status);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{progress.batchName}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[progress.status]}>
              {STATUS_LABELS[progress.status]}
            </Badge>
            {isConnected && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                即時更新
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 進度條 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>處理進度</span>
            <span className="font-medium">{progress.progressPercent}%</span>
          </div>
          <Progress value={progress.progressPercent} className="h-2" />
        </div>

        {/* 統計數據 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="總文件"
            value={progress.totalFiles}
          />
          <StatCard
            icon={<FileText className="h-4 w-4 text-green-500" />}
            label="已處理"
            value={progress.processedFiles}
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4 text-red-500" />}
            label="失敗"
            value={progress.failedFiles}
          />
          <StatCard
            icon={<DollarSign className="h-4 w-4 text-blue-500" />}
            label="成本"
            value={`$${progress.totalCost.toFixed(2)}`}
          />
        </div>

        {/* 當前處理文件 */}
        {progress.currentFile && progress.status === 'PROCESSING' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>正在處理: {progress.currentFile.name}</span>
          </div>
        )}

        {/* 處理速率和剩餘時間 */}
        {progress.status === 'PROCESSING' && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>速率: {progress.processingRate} 文件/分鐘</span>
            </div>
            <div>
              預估剩餘: {formatTime(progress.estimatedTimeRemaining)}
            </div>
          </div>
        )}

        {/* 控制按鈕 */}
        <div className="flex gap-2 pt-2">
          {canPause && (
            <Button variant="outline" size="sm" onClick={onPause}>
              <Pause className="h-4 w-4 mr-1" />
              暫停
            </Button>
          )}
          {canResume && (
            <Button variant="outline" size="sm" onClick={onResume}>
              <Play className="h-4 w-4 mr-1" />
              恢復
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" size="sm" onClick={onCancel}>
              <XCircle className="h-4 w-4 mr-1" />
              取消
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
      {icon}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分鐘`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}小時${mins}分鐘`;
}
```

#### 4.3 錯誤列表組件

```tsx
// src/components/features/historical-data/BatchErrorList.tsx

/**
 * @fileoverview 批量處理錯誤列表
 * @module src/components/features/historical-data/BatchErrorList
 * @since Epic 0 - Story 0.4
 */

'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, SkipForward, AlertCircle } from 'lucide-react';
import type { BatchFileError } from '@/types/batch-progress';
import { cn } from '@/lib/utils';

interface BatchErrorListProps {
  batchId: string;
  errors: BatchFileError[];
  onRetry?: (fileIds: string[]) => void;
  onRetryAll?: () => void;
  onSkip?: (fileId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function BatchErrorList({
  batchId,
  errors,
  onRetry,
  onRetryAll,
  onSkip,
  isLoading,
  className,
}: BatchErrorListProps) {
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(new Set());

  const toggleFile = (fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleRetrySelected = () => {
    if (onRetry && selectedFiles.size > 0) {
      onRetry(Array.from(selectedFiles));
      setSelectedFiles(new Set());
    }
  };

  if (errors.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>沒有失敗的文件</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 批量操作 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          共 {errors.length} 個失敗文件
          {selectedFiles.size > 0 && ` (已選 ${selectedFiles.size})`}
        </div>
        <div className="flex gap-2">
          {selectedFiles.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetrySelected}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', isLoading && 'animate-spin')} />
              重試選中 ({selectedFiles.size})
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={onRetryAll}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', isLoading && 'animate-spin')} />
            全部重試
          </Button>
        </div>
      </div>

      {/* 錯誤列表 */}
      <ScrollArea className="h-[400px] border rounded-md">
        <Accordion type="multiple" className="w-full">
          {errors.map((error) => (
            <AccordionItem key={error.fileId} value={error.fileId}>
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(error.fileId)}
                    onChange={() => toggleFile(error.fileId)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {error.fileName}
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    重試 {error.retryCount} 次
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 text-sm">
                  {error.errorCode && (
                    <div>
                      <span className="text-muted-foreground">錯誤代碼: </span>
                      <code className="bg-muted px-1 rounded">{error.errorCode}</code>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">錯誤訊息: </span>
                    <span className="text-red-600">{error.errorMessage}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">失敗時間: </span>
                    {new Date(error.failedAt).toLocaleString('zh-TW')}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry?.([error.fileId])}
                      disabled={isLoading}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      重試
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSkip?.(error.fileId)}
                      disabled={isLoading}
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      跳過
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );
}
```

#### 4.4 完成摘要組件

```tsx
// src/components/features/historical-data/BatchSummaryCard.tsx

/**
 * @fileoverview 批量處理完成摘要
 * @module src/components/features/historical-data/BatchSummaryCard
 * @since Epic 0 - Story 0.4
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  DollarSign,
  Building2,
  FileText,
  Download,
  Percent,
} from 'lucide-react';
import type { BatchSummary } from '@/types/batch-progress';
import { cn } from '@/lib/utils';

interface BatchSummaryCardProps {
  summary: BatchSummary;
  onExport?: () => void;
  className?: string;
}

export function BatchSummaryCard({
  summary,
  onExport,
  className,
}: BatchSummaryCardProps) {
  const isSuccess = summary.status === 'COMPLETED' && summary.failedCount === 0;
  const hasFailures = summary.failedCount > 0;

  return (
    <Card className={cn(
      'border-2',
      isSuccess ? 'border-green-200' : hasFailures ? 'border-yellow-200' : 'border-gray-200',
      className
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : hasFailures ? (
              <XCircle className="h-6 w-6 text-yellow-500" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-gray-500" />
            )}
            處理完成摘要
          </CardTitle>
          <Badge
            variant={isSuccess ? 'default' : 'secondary'}
            className={isSuccess ? 'bg-green-500' : ''}
          >
            成功率 {summary.successRate}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 文件統計 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryItem
            icon={<FileText className="h-5 w-5" />}
            label="總文件"
            value={summary.totalFiles}
          />
          <SummaryItem
            icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
            label="成功"
            value={summary.successCount}
            highlight="green"
          />
          <SummaryItem
            icon={<XCircle className="h-5 w-5 text-red-500" />}
            label="失敗"
            value={summary.failedCount}
            highlight={summary.failedCount > 0 ? 'red' : undefined}
          />
          <SummaryItem
            icon={<SkipForward className="h-5 w-5 text-gray-500" />}
            label="跳過"
            value={summary.skippedCount}
          />
        </div>

        {/* 時間和成本 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
          <SummaryItem
            icon={<Clock className="h-5 w-5 text-blue-500" />}
            label="總耗時"
            value={formatDuration(summary.totalDuration)}
          />
          <SummaryItem
            icon={<Percent className="h-5 w-5 text-purple-500" />}
            label="平均處理"
            value={`${Math.round(summary.averageProcessingTime)}ms`}
          />
          <SummaryItem
            icon={<DollarSign className="h-5 w-5 text-green-600" />}
            label="總成本"
            value={`$${summary.totalCost.toFixed(2)}`}
          />
        </div>

        {/* 成本明細 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-muted/30 rounded">
            <div className="text-muted-foreground">Azure DI</div>
            <div className="flex justify-between">
              <span>{summary.routeDistribution.azureDi} 文件</span>
              <span className="font-medium">${summary.azureDiCost.toFixed(2)}</span>
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded">
            <div className="text-muted-foreground">GPT Vision</div>
            <div className="flex justify-between">
              <span>{summary.routeDistribution.gptVision} 文件</span>
              <span className="font-medium">${summary.gptVisionCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* 業務統計 */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <SummaryItem
            icon={<Building2 className="h-5 w-5 text-indigo-500" />}
            label="新建公司"
            value={summary.newCompaniesCount}
          />
          <SummaryItem
            icon={<FileText className="h-5 w-5 text-orange-500" />}
            label="提取術語"
            value={summary.extractedTermsCount}
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="outline" onClick={onExport} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          導出報告
        </Button>
      </CardFooter>
    </Card>
  );
}

interface SummaryItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: 'green' | 'red';
}

function SummaryItem({ icon, label, value, highlight }: SummaryItemProps) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={cn(
          'text-lg font-semibold',
          highlight === 'green' && 'text-green-600',
          highlight === 'red' && 'text-red-600'
        )}>
          {value}
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}小時${mins}分鐘`;
}
```

---

## 驗證清單

### 功能驗證

- [ ] **AC1 即時進度顯示**
  - [ ] 進度百分比正確計算
  - [ ] 統計數據（總數/成功/失敗/跳過）準確
  - [ ] 當前處理文件名顯示正確
  - [ ] 處理速率計算合理
  - [ ] 預估剩餘時間顯示

- [ ] **AC2 即時更新**
  - [ ] SSE 連接建立成功
  - [ ] 更新間隔 < 2 秒
  - [ ] 斷線自動重連
  - [ ] 處理完成後連接關閉

- [ ] **AC3 錯誤處理**
  - [ ] 錯誤列表顯示正確
  - [ ] 單個文件重試功能
  - [ ] 批量重試功能
  - [ ] 錯誤詳情展開

- [ ] **AC4 處理控制**
  - [ ] 暫停功能正常
  - [ ] 恢復功能正常
  - [ ] 取消功能正常
  - [ ] 跳過文件功能正常

- [ ] **AC5 完成摘要**
  - [ ] 統計數據準確
  - [ ] 成本計算正確
  - [ ] 時間統計正確
  - [ ] 導出功能可用

### 技術驗證

- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] Prisma Migration 成功
- [ ] SSE 端點效能測試（100+ 並發連接）

---

## 文件清單

### 新增文件

| 文件路徑 | 說明 |
|---------|------|
| `src/types/batch-progress.ts` | 進度相關類型定義 |
| `src/services/batch-progress.service.ts` | 進度計算服務 |
| `src/app/api/admin/historical-data/batches/[id]/progress/route.ts` | SSE 進度端點 |
| `src/app/api/admin/historical-data/batches/[id]/pause/route.ts` | 暫停 API |
| `src/app/api/admin/historical-data/batches/[id]/resume/route.ts` | 恢復 API |
| `src/app/api/admin/historical-data/batches/[id]/cancel/route.ts` | 取消 API |
| `src/app/api/admin/historical-data/batches/[id]/skip/[fileId]/route.ts` | 跳過 API |
| `src/app/api/admin/historical-data/batches/[id]/retry/route.ts` | 重試 API |
| `src/hooks/use-batch-progress.ts` | 進度訂閱 Hook |
| `src/components/features/historical-data/BatchProgressPanel.tsx` | 進度面板 |
| `src/components/features/historical-data/BatchErrorList.tsx` | 錯誤列表 |
| `src/components/features/historical-data/BatchSummaryCard.tsx` | 完成摘要 |

### 修改文件

| 文件路徑 | 說明 |
|---------|------|
| `prisma/schema.prisma` | 擴展 HistoricalBatch 和 HistoricalFile 模型 |
| `src/types/index.ts` | 導出新類型 |
| `src/services/index.ts` | 導出新服務 |

---

## 依賴項

### 內部依賴

- Story 0.1: HistoricalBatch, HistoricalFile 模型
- Story 0.2: 處理路由和成本計算

### 外部依賴

無新增外部依賴，使用現有技術棧

---

## 疑難排解

### SSE 連接問題

```typescript
// 問題：Nginx 代理導致 SSE 緩衝
// 解決：添加 X-Accel-Buffering header
headers: {
  'X-Accel-Buffering': 'no',
}

// 問題：連接頻繁斷開
// 解決：增加心跳機制
setInterval(() => {
  controller.enqueue(encoder.encode(': heartbeat\n\n'));
}, 30000);
```

### 進度計算不準確

```typescript
// 問題：處理速率波動大
// 解決：使用滑動窗口平均
const WINDOW_SIZE = 10;
const recentRates: number[] = [];

function updateRate(newRate: number) {
  recentRates.push(newRate);
  if (recentRates.length > WINDOW_SIZE) {
    recentRates.shift();
  }
  return recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
}
```

---

## 下一步

完成 Story 0.4 後，進入 Story 0.5：
- 術語聚合與初始規則建立
- 建立 Universal Mapping 基礎

---

*Tech Spec 建立日期: 2025-12-22*
*Story Status: pending*
