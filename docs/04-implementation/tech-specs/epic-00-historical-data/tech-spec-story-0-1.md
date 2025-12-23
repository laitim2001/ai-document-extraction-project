# Story 0-1: 批量文件上傳與元數據檢測 - Technical Specification

**Version:** 1.0
**Created:** 2025-12-22
**Status:** Ready for Development
**Story Key:** 0-1-batch-file-upload-metadata-detection

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 0.1 |
| Epic | Epic 0: 歷史數據初始化 |
| Estimated Effort | High |
| Dependencies | REFACTOR-001 (Forwarder → Company) |
| Blocking | Story 0.2, Story 0.3, Story 0.4 |

---

## Objective

實現批量歷史文件上傳功能，自動檢測文件類型（原生 PDF、掃描 PDF、圖片），為後續智能處理路由提供基礎。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 拖放上傳多文件 | react-dropzone + chunked upload |
| AC2 | 同時上傳 1000+ 文件 | Parallel upload + queue management |
| AC3 | 文件類型檢測 | pdf-lib (text layer) + magic bytes |
| AC4 | 上傳進度顯示 | SSE / polling + progress state |
| AC5 | 檢測結果預覽 | DataTable with sorting/filtering |

---

## Data Models

### Prisma Schema Extensions

```prisma
// prisma/schema.prisma

// 批次處理批次
model HistoricalBatch {
  id              String       @id @default(uuid())
  name            String
  description     String?
  status          BatchStatus  @default(PENDING)
  totalFiles      Int          @map("total_files")
  processedFiles  Int          @default(0) @map("processed_files")
  failedFiles     Int          @default(0) @map("failed_files")
  skippedFiles    Int          @default(0) @map("skipped_files")

  // 進度追蹤
  startedAt       DateTime?    @map("started_at")
  completedAt     DateTime?    @map("completed_at")
  pausedAt        DateTime?    @map("paused_at")
  currentFileId   String?      @map("current_file_id")

  // 統計
  totalCost            Float    @default(0) @map("total_cost")
  newCompaniesCount    Int      @default(0) @map("new_companies_count")
  extractedTermsCount  Int      @default(0) @map("extracted_terms_count")

  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")
  createdBy       String       @map("created_by")

  creator         User         @relation(fields: [createdBy], references: [id])
  files           HistoricalFile[]

  @@map("historical_batches")
}

// 批次內的個別文件
model HistoricalFile {
  id              String              @id @default(uuid())
  batchId         String              @map("batch_id")
  originalName    String              @map("original_name")
  storagePath     String              @map("storage_path")
  fileSize        Int                 @map("file_size")
  mimeType        String              @map("mime_type")

  // 檢測結果
  detectedType    DetectedFileType?   @map("detected_type")
  hasTextLayer    Boolean?            @map("has_text_layer")
  pageCount       Int?                @map("page_count")
  estimatedCost   Float?              @map("estimated_cost")

  // 處理狀態
  status          FileProcessingStatus @default(PENDING)
  processingRoute ProcessingRoute?     @map("processing_route")
  errorMessage    String?              @map("error_message")

  // 處理結果
  extractionResult Json?              @map("extraction_result")
  processedAt     DateTime?           @map("processed_at")
  processingTime  Int?                @map("processing_time") // milliseconds
  actualCost      Float?              @map("actual_cost")

  // 關聯
  documentId      String?             @unique @map("document_id")
  companyId       String?             @map("company_id")

  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  batch           HistoricalBatch     @relation(fields: [batchId], references: [id], onDelete: Cascade)
  document        Document?           @relation(fields: [documentId], references: [id])
  company         Company?            @relation(fields: [companyId], references: [id])

  @@index([batchId])
  @@index([status])
  @@index([detectedType])
  @@map("historical_files")
}

enum BatchStatus {
  PENDING       // 等待開始
  UPLOADING     // 上傳中
  ANALYZING     // 分析中（檢測文件類型）
  PROCESSING    // 處理中（OCR/提取）
  PAUSED        // 已暫停
  COMPLETED     // 完成
  FAILED        // 失敗
  CANCELLED     // 已取消
}

enum DetectedFileType {
  NATIVE_PDF    // 原生 PDF（有文字層）
  SCANNED_PDF   // 掃描 PDF（純圖片）
  IMAGE         // 圖片文件（JPG, PNG, TIFF）
  UNKNOWN       // 無法識別
}

enum FileProcessingStatus {
  PENDING       // 等待處理
  QUEUED        // 已排隊
  PROCESSING    // 處理中
  COMPLETED     // 完成
  FAILED        // 失敗
  SKIPPED       // 跳過
}

enum ProcessingRoute {
  AZURE_DI      // Azure Document Intelligence
  GPT_VISION    // GPT-4o Vision
  MANUAL        // 手動處理
}
```

---

## Implementation Guide

### Phase 1: 資料庫遷移 (10 min)

```bash
# 創建 Migration
npx prisma migrate dev --name add_historical_batch_models

# 驗證 Schema
npx prisma generate
```

---

### Phase 2: 類型定義 (15 min)

#### Step 2.1: 創建 Batch 類型

Create `src/types/historical-batch.ts`:

```typescript
/**
 * @fileoverview 歷史批次處理相關類型定義
 * @module src/types/historical-batch
 * @since Epic 0 - Story 0.1
 */

import {
  BatchStatus,
  DetectedFileType,
  FileProcessingStatus,
  ProcessingRoute
} from '@prisma/client';

// ============================================
// API Request/Response Types
// ============================================

export interface CreateBatchRequest {
  name: string;
  description?: string;
}

export interface CreateBatchResponse {
  id: string;
  name: string;
  uploadUrl: string;
}

export interface UploadFileRequest {
  batchId: string;
  file: File;
}

export interface FileMetadata {
  id: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  detectedType: DetectedFileType | null;
  hasTextLayer: boolean | null;
  pageCount: number | null;
  estimatedCost: number | null;
  status: FileProcessingStatus;
}

export interface BatchSummary {
  id: string;
  name: string;
  description: string | null;
  status: BatchStatus;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  estimatedTotalCost: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  fileTypeDistribution: {
    nativePdf: number;
    scannedPdf: number;
    image: number;
    unknown: number;
  };
}

export interface BatchDetailResponse extends BatchSummary {
  files: FileMetadata[];
}

// ============================================
// File Detection Types
// ============================================

export interface FileDetectionResult {
  fileType: DetectedFileType;
  hasTextLayer: boolean;
  pageCount: number;
  confidence: number;
  suggestedRoute: ProcessingRoute;
  estimatedCost: number;
}

export interface DetectionProgress {
  totalFiles: number;
  detectedFiles: number;
  currentFile: string | null;
  errors: Array<{
    fileName: string;
    error: string;
  }>;
}

// ============================================
// Upload Progress Types
// ============================================

export interface UploadProgress {
  totalFiles: number;
  uploadedFiles: number;
  uploadedBytes: number;
  totalBytes: number;
  currentFile: string | null;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  errors: Array<{
    fileName: string;
    error: string;
  }>;
}

// ============================================
// Constants
// ============================================

export const BATCH_CONSTANTS = {
  MAX_FILES_PER_BATCH: 5000,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  SUPPORTED_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
  ],
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks for large files
  CONCURRENT_UPLOADS: 5,
} as const;
```

#### Step 2.2: 更新類型索引

Update `src/types/index.ts`:

```typescript
// Historical Batch Types
export * from './historical-batch';
```

---

### Phase 3: 文件檢測服務 (45 min)

#### Step 3.1: 創建檢測服務

Create `src/services/file-detection.service.ts`:

```typescript
/**
 * @fileoverview 文件類型檢測服務
 * @description
 *   - 檢測 PDF 是否有文字層（原生 vs 掃描）
 *   - 識別圖片文件類型
 *   - 估算處理成本
 *
 * @module src/services/file-detection
 * @since Epic 0 - Story 0.1
 */

import { PDFDocument } from 'pdf-lib';
import { DetectedFileType, ProcessingRoute } from '@prisma/client';
import { FileDetectionResult, BATCH_CONSTANTS } from '@/types/historical-batch';

// ============================================
// Cost Configuration
// ============================================

const COST_CONFIG = {
  AZURE_DI: { perPage: 0.01 },     // USD
  GPT_VISION: { perPage: 0.03 },   // USD (approx based on tokens)
} as const;

// ============================================
// File Type Detection
// ============================================

/**
 * 檢測文件類型並估算處理成本
 */
export async function detectFileType(
  file: Buffer,
  mimeType: string
): Promise<FileDetectionResult> {
  // 圖片文件
  if (mimeType.startsWith('image/')) {
    return {
      fileType: 'IMAGE',
      hasTextLayer: false,
      pageCount: 1,
      confidence: 1.0,
      suggestedRoute: 'GPT_VISION',
      estimatedCost: COST_CONFIG.GPT_VISION.perPage,
    };
  }

  // PDF 文件
  if (mimeType === 'application/pdf') {
    return await detectPdfType(file);
  }

  // 無法識別
  return {
    fileType: 'UNKNOWN',
    hasTextLayer: false,
    pageCount: 0,
    confidence: 0,
    suggestedRoute: 'MANUAL',
    estimatedCost: 0,
  };
}

/**
 * 檢測 PDF 類型（原生 vs 掃描）
 */
async function detectPdfType(pdfBuffer: Buffer): Promise<FileDetectionResult> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
    });

    const pageCount = pdfDoc.getPageCount();
    const hasText = await checkForTextContent(pdfDoc);

    if (hasText) {
      // 原生 PDF - 使用 Azure DI
      return {
        fileType: 'NATIVE_PDF',
        hasTextLayer: true,
        pageCount,
        confidence: 0.95,
        suggestedRoute: 'AZURE_DI',
        estimatedCost: pageCount * COST_CONFIG.AZURE_DI.perPage,
      };
    } else {
      // 掃描 PDF - 使用 GPT Vision
      return {
        fileType: 'SCANNED_PDF',
        hasTextLayer: false,
        pageCount,
        confidence: 0.9,
        suggestedRoute: 'GPT_VISION',
        estimatedCost: pageCount * COST_CONFIG.GPT_VISION.perPage,
      };
    }
  } catch (error) {
    console.error('PDF detection error:', error);
    return {
      fileType: 'UNKNOWN',
      hasTextLayer: false,
      pageCount: 0,
      confidence: 0,
      suggestedRoute: 'MANUAL',
      estimatedCost: 0,
    };
  }
}

/**
 * 檢查 PDF 是否包含可提取的文字內容
 *
 * 策略：檢查多個頁面的字體資源
 */
async function checkForTextContent(pdfDoc: PDFDocument): Promise<boolean> {
  const pages = pdfDoc.getPages();
  const pagesToCheck = Math.min(pages.length, 3); // 檢查前 3 頁

  for (let i = 0; i < pagesToCheck; i++) {
    const page = pages[i];
    const { node } = page;

    // 檢查頁面資源中是否有字體
    const resources = node.Resources();
    if (resources) {
      const font = resources.lookup('Font');
      if (font && font.size() > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 批量檢測文件類型
 */
export async function detectFileTypesBatch(
  files: Array<{ buffer: Buffer; mimeType: string; fileName: string }>
): Promise<Map<string, FileDetectionResult>> {
  const results = new Map<string, FileDetectionResult>();

  // 並行處理，但限制同時處理數量
  const concurrency = 10;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async ({ buffer, mimeType, fileName }) => {
        const result = await detectFileType(buffer, mimeType);
        return { fileName, result };
      })
    );

    batchResults.forEach(({ fileName, result }) => {
      results.set(fileName, result);
    });
  }

  return results;
}

/**
 * 估算批次總成本
 */
export function estimateBatchCost(
  detectionResults: Map<string, FileDetectionResult>
): number {
  let totalCost = 0;

  for (const result of detectionResults.values()) {
    totalCost += result.estimatedCost;
  }

  return Math.round(totalCost * 100) / 100; // 四捨五入到分
}
```

---

### Phase 4: 批次管理服務 (30 min)

#### Step 4.1: 創建批次服務

Create `src/services/historical-batch.service.ts`:

```typescript
/**
 * @fileoverview 歷史批次管理服務
 * @description
 *   - 創建和管理批次
 *   - 追蹤上傳進度
 *   - 聚合批次統計
 *
 * @module src/services/historical-batch
 * @since Epic 0 - Story 0.1
 */

import { prisma } from '@/lib/prisma';
import { BatchStatus, DetectedFileType, FileProcessingStatus } from '@prisma/client';
import {
  CreateBatchRequest,
  BatchSummary,
  BatchDetailResponse,
  FileMetadata
} from '@/types/historical-batch';
import { detectFileType } from './file-detection.service';

// ============================================
// Batch CRUD Operations
// ============================================

/**
 * 創建新批次
 */
export async function createBatch(
  data: CreateBatchRequest,
  userId: string
): Promise<{ id: string; name: string }> {
  const batch = await prisma.historicalBatch.create({
    data: {
      name: data.name,
      description: data.description,
      totalFiles: 0,
      createdBy: userId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  return batch;
}

/**
 * 獲取批次列表
 */
export async function listBatches(params: {
  page?: number;
  limit?: number;
  status?: BatchStatus;
}): Promise<{ batches: BatchSummary[]; total: number }> {
  const { page = 1, limit = 20, status } = params;
  const skip = (page - 1) * limit;

  const where = status ? { status } : {};

  const [batches, total] = await Promise.all([
    prisma.historicalBatch.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        files: {
          select: {
            detectedType: true,
            estimatedCost: true,
          },
        },
      },
    }),
    prisma.historicalBatch.count({ where }),
  ]);

  return {
    batches: batches.map(batch => ({
      id: batch.id,
      name: batch.name,
      description: batch.description,
      status: batch.status,
      totalFiles: batch.totalFiles,
      processedFiles: batch.processedFiles,
      failedFiles: batch.failedFiles,
      skippedFiles: batch.skippedFiles,
      estimatedTotalCost: batch.files.reduce(
        (sum, f) => sum + (f.estimatedCost || 0),
        0
      ),
      createdAt: batch.createdAt.toISOString(),
      startedAt: batch.startedAt?.toISOString() || null,
      completedAt: batch.completedAt?.toISOString() || null,
      fileTypeDistribution: calculateFileTypeDistribution(batch.files),
    })),
    total,
  };
}

/**
 * 獲取批次詳情
 */
export async function getBatchDetail(batchId: string): Promise<BatchDetailResponse | null> {
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    include: {
      files: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!batch) return null;

  return {
    id: batch.id,
    name: batch.name,
    description: batch.description,
    status: batch.status,
    totalFiles: batch.totalFiles,
    processedFiles: batch.processedFiles,
    failedFiles: batch.failedFiles,
    skippedFiles: batch.skippedFiles,
    estimatedTotalCost: batch.files.reduce(
      (sum, f) => sum + (f.estimatedCost || 0),
      0
    ),
    createdAt: batch.createdAt.toISOString(),
    startedAt: batch.startedAt?.toISOString() || null,
    completedAt: batch.completedAt?.toISOString() || null,
    fileTypeDistribution: calculateFileTypeDistribution(batch.files),
    files: batch.files.map(fileToMetadata),
  };
}

// ============================================
// File Operations
// ============================================

/**
 * 添加文件到批次
 */
export async function addFileToBatch(params: {
  batchId: string;
  originalName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  fileBuffer: Buffer;
}): Promise<FileMetadata> {
  const { batchId, originalName, storagePath, fileSize, mimeType, fileBuffer } = params;

  // 檢測文件類型
  const detection = await detectFileType(fileBuffer, mimeType);

  // 創建文件記錄
  const file = await prisma.historicalFile.create({
    data: {
      batchId,
      originalName,
      storagePath,
      fileSize,
      mimeType,
      detectedType: detection.fileType,
      hasTextLayer: detection.hasTextLayer,
      pageCount: detection.pageCount,
      estimatedCost: detection.estimatedCost,
      processingRoute: detection.suggestedRoute,
      status: 'PENDING',
    },
  });

  // 更新批次文件計數
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      totalFiles: { increment: 1 },
    },
  });

  return fileToMetadata(file);
}

/**
 * 批量添加文件結果
 */
export async function updateBatchAfterUpload(
  batchId: string
): Promise<void> {
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    include: {
      files: {
        select: { id: true },
      },
    },
  });

  if (batch) {
    await prisma.historicalBatch.update({
      where: { id: batchId },
      data: {
        totalFiles: batch.files.length,
        status: 'ANALYZING',
      },
    });
  }
}

// ============================================
// Helper Functions
// ============================================

function calculateFileTypeDistribution(
  files: Array<{ detectedType: DetectedFileType | null }>
): BatchSummary['fileTypeDistribution'] {
  const distribution = {
    nativePdf: 0,
    scannedPdf: 0,
    image: 0,
    unknown: 0,
  };

  for (const file of files) {
    switch (file.detectedType) {
      case 'NATIVE_PDF':
        distribution.nativePdf++;
        break;
      case 'SCANNED_PDF':
        distribution.scannedPdf++;
        break;
      case 'IMAGE':
        distribution.image++;
        break;
      default:
        distribution.unknown++;
    }
  }

  return distribution;
}

function fileToMetadata(file: {
  id: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  detectedType: DetectedFileType | null;
  hasTextLayer: boolean | null;
  pageCount: number | null;
  estimatedCost: number | null;
  status: FileProcessingStatus;
}): FileMetadata {
  return {
    id: file.id,
    originalName: file.originalName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    detectedType: file.detectedType,
    hasTextLayer: file.hasTextLayer,
    pageCount: file.pageCount,
    estimatedCost: file.estimatedCost,
    status: file.status,
  };
}
```

---

### Phase 5: API 路由 (45 min)

#### Step 5.1: 批次列表和創建

Create `src/app/api/admin/historical-data/batches/route.ts`:

```typescript
/**
 * @fileoverview 歷史批次 API - 列表和創建
 * @module src/app/api/admin/historical-data/batches
 * @since Epic 0 - Story 0.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import {
  createBatch,
  listBatches
} from '@/services/historical-batch.service';

// Request validation
const CreateBatchSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const ListBatchesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum([
    'PENDING', 'UPLOADING', 'ANALYZING', 'PROCESSING',
    'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'
  ]).optional(),
});

/**
 * GET /api/admin/historical-data/batches
 * 獲取批次列表
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = ListBatchesSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
    });

    const result = await listBatches(params);

    return NextResponse.json({
      success: true,
      data: result.batches,
      meta: {
        pagination: {
          page: params.page,
          limit: params.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / params.limit),
        },
      },
    });
  } catch (error) {
    console.error('List batches error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/historical-data/batches
 * 創建新批次
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = CreateBatchSchema.parse(body);

    const batch = await createBatch(data, session.user.id);

    return NextResponse.json({
      success: true,
      data: batch,
    }, { status: 201 });
  } catch (error) {
    console.error('Create batch error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### Step 5.2: 文件上傳 API

Create `src/app/api/admin/historical-data/batches/[id]/files/route.ts`:

```typescript
/**
 * @fileoverview 批次文件上傳 API
 * @module src/app/api/admin/historical-data/batches/[id]/files
 * @since Epic 0 - Story 0.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { addFileToBatch } from '@/services/historical-batch.service';
import { BATCH_CONSTANTS } from '@/types/historical-batch';

/**
 * POST /api/admin/historical-data/batches/[id]/files
 * 上傳文件到批次
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const batchId = params.id;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 驗證文件類型
    if (!BATCH_CONSTANTS.SUPPORTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // 驗證文件大小
    if (file.size > BATCH_CONSTANTS.MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size: ${BATCH_CONSTANTS.MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // 讀取文件內容
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 生成存儲路徑
    const fileId = randomUUID();
    const ext = file.name.split('.').pop() || 'bin';
    const storagePath = join('uploads', 'historical', batchId, `${fileId}.${ext}`);

    // 保存文件（實際應使用 Azure Blob Storage）
    const fullPath = join(process.cwd(), 'public', storagePath);
    await writeFile(fullPath, buffer);

    // 添加到批次並檢測類型
    const fileMetadata = await addFileToBatch({
      batchId,
      originalName: file.name,
      storagePath,
      fileSize: file.size,
      mimeType: file.type,
      fileBuffer: buffer,
    });

    return NextResponse.json({
      success: true,
      data: fileMetadata,
    }, { status: 201 });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'File upload failed' },
      { status: 500 }
    );
  }
}
```

---

### Phase 6: 前端組件 (60 min)

#### Step 6.1: 創建上傳組件

Create `src/components/features/historical-data/BatchUploader.tsx`:

```typescript
'use client';

/**
 * @fileoverview 批量文件上傳組件
 * @module src/components/features/historical-data
 * @since Epic 0 - Story 0.1
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  Image,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { BATCH_CONSTANTS, UploadProgress } from '@/types/historical-batch';
import { cn } from '@/lib/utils';

interface BatchUploaderProps {
  batchId: string;
  onUploadComplete?: () => void;
}

interface FileWithPreview extends File {
  preview?: string;
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export function BatchUploader({ batchId, onUploadComplete }: BatchUploaderProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    totalFiles: 0,
    uploadedFiles: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    currentFile: null,
    speed: 0,
    estimatedTimeRemaining: 0,
    errors: [],
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file =>
      Object.assign(file, { uploadStatus: 'pending' as const })
    );
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
    },
    maxSize: BATCH_CONSTANTS.MAX_FILE_SIZE,
    maxFiles: BATCH_CONSTANTS.MAX_FILES_PER_BATCH,
  });

  const uploadFiles = async () => {
    setUploading(true);
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

    setProgress({
      totalFiles: files.length,
      uploadedFiles: 0,
      uploadedBytes: 0,
      totalBytes,
      currentFile: null,
      speed: 0,
      estimatedTimeRemaining: 0,
      errors: [],
    });

    let uploadedCount = 0;
    let uploadedBytes = 0;
    const errors: Array<{ fileName: string; error: string }> = [];
    const startTime = Date.now();

    // 並行上傳，但限制同時數量
    const concurrency = BATCH_CONSTANTS.CONCURRENT_UPLOADS;

    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async (file, idx) => {
          const globalIdx = i + idx;

          setFiles(prev =>
            prev.map((f, j) =>
              j === globalIdx ? { ...f, uploadStatus: 'uploading' } : f
            )
          );

          setProgress(prev => ({
            ...prev,
            currentFile: file.name,
          }));

          try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(
              `/api/admin/historical-data/batches/${batchId}/files`,
              {
                method: 'POST',
                body: formData,
              }
            );

            if (!response.ok) {
              throw new Error(`Upload failed: ${response.statusText}`);
            }

            uploadedCount++;
            uploadedBytes += file.size;

            const elapsed = (Date.now() - startTime) / 1000;
            const speed = uploadedBytes / elapsed;
            const remaining = (totalBytes - uploadedBytes) / speed;

            setProgress(prev => ({
              ...prev,
              uploadedFiles: uploadedCount,
              uploadedBytes,
              speed,
              estimatedTimeRemaining: remaining,
            }));

            setFiles(prev =>
              prev.map((f, j) =>
                j === globalIdx ? { ...f, uploadStatus: 'success' } : f
              )
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ fileName: file.name, error: errorMessage });

            setFiles(prev =>
              prev.map((f, j) =>
                j === globalIdx
                  ? { ...f, uploadStatus: 'error', errorMessage }
                  : f
              )
            );

            setProgress(prev => ({
              ...prev,
              errors: [...prev.errors, { fileName: file.name, error: errorMessage }],
            }));
          }
        })
      );
    }

    setUploading(false);
    setProgress(prev => ({ ...prev, currentFile: null }));

    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const uploadedPercentage = progress.totalBytes > 0
    ? Math.round((progress.uploadedBytes / progress.totalBytes) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          批量文件上傳
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
            uploading && 'pointer-events-none opacity-50'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">
            {isDragActive ? '放開以上傳文件' : '拖放文件到此處'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            支援 PDF、JPG、PNG、TIFF 格式，單檔最大 {BATCH_CONSTANTS.MAX_FILE_SIZE / 1024 / 1024}MB
          </p>
          <Button variant="outline" className="mt-4" type="button">
            或點擊選擇文件
          </Button>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                已選擇 {files.length} 個文件 ({formatBytes(files.reduce((s, f) => s + f.size, 0))})
              </span>
              <Button variant="ghost" size="sm" onClick={clearFiles} disabled={uploading}>
                清除全部
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  {file.type === 'application/pdf' ? (
                    <FileText className="h-5 w-5 text-red-500" />
                  ) : (
                    <Image className="h-5 w-5 text-blue-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  {file.uploadStatus === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {file.uploadStatus === 'success' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {file.uploadStatus === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {file.uploadStatus === 'pending' && !uploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(idx)}
                    >
                      移除
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>上傳進度</span>
              <span>
                {progress.uploadedFiles} / {progress.totalFiles} 文件 ({uploadedPercentage}%)
              </span>
            </div>
            <Progress value={uploadedPercentage} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>速度: {formatBytes(progress.speed)}/s</span>
              <span>預估剩餘: {formatTime(progress.estimatedTimeRemaining)}</span>
            </div>
            {progress.currentFile && (
              <p className="text-xs text-muted-foreground truncate">
                正在上傳: {progress.currentFile}
              </p>
            )}
          </div>
        )}

        {/* Error Summary */}
        {progress.errors.length > 0 && (
          <div className="rounded-lg bg-red-50 p-4 space-y-2">
            <p className="text-sm font-medium text-red-800">
              {progress.errors.length} 個文件上傳失敗
            </p>
            {progress.errors.slice(0, 5).map((err, idx) => (
              <p key={idx} className="text-xs text-red-600">
                {err.fileName}: {err.error}
              </p>
            ))}
            {progress.errors.length > 5 && (
              <p className="text-xs text-red-600">
                ...還有 {progress.errors.length - 5} 個錯誤
              </p>
            )}
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={uploadFiles}
          disabled={files.length === 0 || uploading}
          className="w-full"
          size="lg"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              上傳中...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              開始上傳 ({files.length} 個文件)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

#### Step 6.2: 創建文件檢測結果表格

Create `src/components/features/historical-data/FileDetectionTable.tsx`:

```typescript
'use client';

/**
 * @fileoverview 文件檢測結果表格組件
 * @module src/components/features/historical-data
 * @since Epic 0 - Story 0.1
 */

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileMetadata } from '@/types/historical-batch';
import { FileText, Image, HelpCircle } from 'lucide-react';

interface FileDetectionTableProps {
  files: FileMetadata[];
}

export function FileDetectionTable({ files }: FileDetectionTableProps) {
  const getFileTypeIcon = (type: string | null) => {
    switch (type) {
      case 'NATIVE_PDF':
      case 'SCANNED_PDF':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'IMAGE':
        return <Image className="h-4 w-4 text-blue-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getFileTypeBadge = (type: string | null) => {
    switch (type) {
      case 'NATIVE_PDF':
        return <Badge variant="secondary">原生 PDF</Badge>;
      case 'SCANNED_PDF':
        return <Badge variant="outline">掃描 PDF</Badge>;
      case 'IMAGE':
        return <Badge className="bg-blue-100 text-blue-800">圖片</Badge>;
      default:
        return <Badge variant="destructive">未知</Badge>;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCost = (cost: number | null): string => {
    if (cost === null) return '-';
    return `$${cost.toFixed(3)}`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>文件名稱</TableHead>
            <TableHead>檔案大小</TableHead>
            <TableHead>類型</TableHead>
            <TableHead>頁數</TableHead>
            <TableHead>文字層</TableHead>
            <TableHead>預估成本</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell>{getFileTypeIcon(file.detectedType)}</TableCell>
              <TableCell className="font-medium max-w-xs truncate">
                {file.originalName}
              </TableCell>
              <TableCell>{formatBytes(file.fileSize)}</TableCell>
              <TableCell>{getFileTypeBadge(file.detectedType)}</TableCell>
              <TableCell>{file.pageCount ?? '-'}</TableCell>
              <TableCell>
                {file.hasTextLayer === null ? '-' : file.hasTextLayer ? '是' : '否'}
              </TableCell>
              <TableCell>{formatCost(file.estimatedCost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

### Phase 7: 頁面整合 (30 min)

#### Step 7.1: 創建批次管理頁面

Create `src/app/(dashboard)/admin/historical-data/page.tsx`:

```typescript
/**
 * @fileoverview 歷史數據批次管理頁面
 * @module src/app/(dashboard)/admin/historical-data
 * @since Epic 0 - Story 0.1
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listBatches } from '@/services/historical-batch.service';
import { BatchListTable } from '@/components/features/historical-data/BatchListTable';
import { CreateBatchDialog } from '@/components/features/historical-data/CreateBatchDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function HistoricalDataPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { batches, total } = await listBatches({ page: 1, limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">歷史數據批次</h2>
          <p className="text-muted-foreground">
            管理和處理歷史發票文件
          </p>
        </div>
        <CreateBatchDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建批次
          </Button>
        </CreateBatchDialog>
      </div>

      <BatchListTable batches={batches} total={total} />
    </div>
  );
}
```

---

## Verification Checklist

### 文件上傳

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 拖放上傳 | 拖放 PDF 文件到區域 | 文件加入列表 | [ ] |
| 點擊上傳 | 點擊選擇文件 | 開啟文件選擇器 | [ ] |
| 批量上傳 | 選擇 100 個文件 | 全部加入列表 | [ ] |
| 類型過濾 | 上傳 .docx 文件 | 被拒絕 | [ ] |
| 大小限制 | 上傳 60MB 文件 | 顯示錯誤 | [ ] |

### 文件檢測

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 原生 PDF | 上傳有文字層的 PDF | 識別為 NATIVE_PDF | [ ] |
| 掃描 PDF | 上傳掃描的 PDF | 識別為 SCANNED_PDF | [ ] |
| 圖片 | 上傳 JPG 圖片 | 識別為 IMAGE | [ ] |
| 頁數計算 | 上傳多頁 PDF | 正確顯示頁數 | [ ] |
| 成本估算 | 檢測完成後 | 顯示估算成本 | [ ] |

### 進度顯示

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 進度條 | 上傳多個文件 | 顯示正確進度 | [ ] |
| 速度計算 | 觀察上傳過程 | 顯示上傳速度 | [ ] |
| 時間估算 | 觀察上傳過程 | 顯示剩餘時間 | [ ] |
| 當前文件 | 上傳過程中 | 顯示當前文件名 | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `prisma/schema.prisma` | 新增 HistoricalBatch, HistoricalFile 模型 |
| `src/types/historical-batch.ts` | 批次相關類型定義 |
| `src/services/file-detection.service.ts` | 文件類型檢測服務 |
| `src/services/historical-batch.service.ts` | 批次管理服務 |
| `src/app/api/admin/historical-data/batches/route.ts` | 批次列表/創建 API |
| `src/app/api/admin/historical-data/batches/[id]/files/route.ts` | 文件上傳 API |
| `src/components/features/historical-data/BatchUploader.tsx` | 上傳組件 |
| `src/components/features/historical-data/FileDetectionTable.tsx` | 檢測結果表格 |
| `src/app/(dashboard)/admin/historical-data/page.tsx` | 批次管理頁面 |

---

## Dependencies

```bash
# 需要安裝的套件
npm install react-dropzone pdf-lib
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| PDF 解析失敗 | 確認 pdf-lib 版本，處理加密 PDF |
| 上傳速度慢 | 調整 CONCURRENT_UPLOADS 數量 |
| 內存溢出 | 使用流式處理大文件 |
| 文件類型誤判 | 增加檢測頁面數量 |

---

## Next Steps

完成 Story 0-1 後：
1. 進入 **Story 0-2**（智能處理路由）
2. 實現 Azure DI 和 GPT Vision 整合
3. 設計處理佇列機制

---

*Generated by BMAD Method - Create Tech Spec Workflow*
