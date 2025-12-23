# Story 0-2: 智能處理路由 - Technical Specification

**Version:** 1.0
**Created:** 2025-12-22
**Status:** Ready for Development
**Story Key:** 0-2-intelligent-processing-routing

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 0.2 |
| Epic | Epic 0: 歷史數據初始化 |
| Estimated Effort | High |
| Dependencies | Story 0.1 (批量文件上傳) |
| Blocking | Story 0.3, Story 0.4, Story 0.5 |

---

## Objective

根據文件類型檢測結果，智能路由到適當的處理引擎（Azure Document Intelligence 或 GPT-4o Vision），實現最佳成本效益的文件處理策略。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 原生 PDF → Azure DI | Route by detectedType + Azure DI SDK |
| AC2 | 掃描 PDF/圖片 → GPT Vision | Route by detectedType + OpenAI Vision API |
| AC3 | 提取發票資訊 | Unified extraction schema |
| AC4 | 成本計算記錄 | Cost tracking per file |
| AC5 | 處理時間記錄 | Timing metrics per file |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Processing Router                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   HistoricalFile                                                 │
│        │                                                         │
│        ▼                                                         │
│   ┌─────────────┐                                               │
│   │ Router      │                                               │
│   │ Service     │                                               │
│   └──────┬──────┘                                               │
│          │                                                       │
│    ┌─────┴─────┐                                                │
│    ▼           ▼                                                │
│ ┌──────────┐ ┌──────────┐                                      │
│ │ Azure DI │ │ GPT-4o   │                                      │
│ │ Adapter  │ │ Vision   │                                      │
│ └────┬─────┘ └────┬─────┘                                      │
│      │            │                                             │
│      └─────┬──────┘                                             │
│            ▼                                                     │
│   ┌─────────────┐                                               │
│   │ Unified     │                                               │
│   │ Extraction  │                                               │
│   │ Result      │                                               │
│   └─────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Extraction Result Schema

```typescript
// src/types/extraction.ts

/**
 * 統一的發票提取結果格式
 */
export interface InvoiceExtractionResult {
  // 文件級別資訊
  documentInfo: {
    invoiceNumber: string | null;
    invoiceDate: string | null;  // ISO format
    dueDate: string | null;
    currency: string;
    totalAmount: number | null;
  };

  // 發票方資訊
  vendor: {
    name: string | null;
    address: string | null;
    taxId: string | null;
  };

  // 收票方資訊
  customer: {
    name: string | null;
    address: string | null;
    reference: string | null;  // PO number, etc.
  };

  // 運輸相關
  shipment: {
    blNumber: string | null;
    containerNumber: string | null;
    vesselName: string | null;
    voyage: string | null;
    portOfLoading: string | null;
    portOfDischarge: string | null;
  };

  // 費用明細
  lineItems: LineItem[];

  // 提取元數據
  metadata: {
    confidence: number;  // 0-1
    processingRoute: 'AZURE_DI' | 'GPT_VISION';
    rawResponse: unknown;
    warnings: string[];
  };
}

export interface LineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  category: string | null;  // 分類後填入
  confidence: number;
}
```

### Processing Queue Model

```prisma
// prisma/schema.prisma (擴展)

model ProcessingQueue {
  id            String            @id @default(uuid())
  fileId        String            @unique @map("file_id")
  batchId       String            @map("batch_id")
  priority      Int               @default(0)
  status        QueueStatus       @default(PENDING)
  route         ProcessingRoute
  attempts      Int               @default(0)
  maxAttempts   Int               @default(3) @map("max_attempts")
  lastError     String?           @map("last_error")
  scheduledAt   DateTime?         @map("scheduled_at")
  startedAt     DateTime?         @map("started_at")
  completedAt   DateTime?         @map("completed_at")
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  file          HistoricalFile    @relation(fields: [fileId], references: [id])

  @@index([status, priority])
  @@index([batchId])
  @@map("processing_queue")
}

enum QueueStatus {
  PENDING
  SCHEDULED
  PROCESSING
  COMPLETED
  FAILED
  RETRY
}
```

---

## Implementation Guide

### Phase 1: 路由服務 (30 min)

#### Step 1.1: 創建路由服務

Create `src/services/processing-router.service.ts`:

```typescript
/**
 * @fileoverview 智能處理路由服務
 * @description
 *   - 根據文件類型決定處理路徑
 *   - 管理處理佇列
 *   - 成本和效能追蹤
 *
 * @module src/services/processing-router
 * @since Epic 0 - Story 0.2
 */

import { prisma } from '@/lib/prisma';
import { DetectedFileType, ProcessingRoute, QueueStatus } from '@prisma/client';
import { processWithAzureDI } from './azure-di.service';
import { processWithGPTVision } from './gpt-vision.service';
import { InvoiceExtractionResult } from '@/types/extraction';

// ============================================
// Cost Configuration
// ============================================

export const COST_CONFIG = {
  AZURE_DI: {
    perPage: 0.01,        // USD per page
    setupCost: 0,
    minPages: 1,
  },
  GPT_VISION: {
    perPage: 0.03,        // USD per page (approx)
    setupCost: 0,
    minPages: 1,
    maxTokensPerPage: 2000,
    inputTokenCost: 0.00001,   // per token
    outputTokenCost: 0.00003,  // per token
  },
} as const;

// ============================================
// Route Determination
// ============================================

/**
 * 決定文件的處理路徑
 */
export function determineProcessingRoute(
  detectedType: DetectedFileType | null
): ProcessingRoute {
  switch (detectedType) {
    case 'NATIVE_PDF':
      return 'AZURE_DI';
    case 'SCANNED_PDF':
    case 'IMAGE':
      return 'GPT_VISION';
    default:
      return 'MANUAL';
  }
}

/**
 * 估算處理成本
 */
export function estimateProcessingCost(
  route: ProcessingRoute,
  pageCount: number
): number {
  const pages = Math.max(pageCount, 1);

  switch (route) {
    case 'AZURE_DI':
      return pages * COST_CONFIG.AZURE_DI.perPage;
    case 'GPT_VISION':
      return pages * COST_CONFIG.GPT_VISION.perPage;
    default:
      return 0;
  }
}

// ============================================
// Processing Execution
// ============================================

/**
 * 處理單個文件
 */
export async function processFile(fileId: string): Promise<{
  success: boolean;
  result?: InvoiceExtractionResult;
  error?: string;
  cost: number;
  processingTime: number;
}> {
  const startTime = Date.now();

  // 獲取文件資訊
  const file = await prisma.historicalFile.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    return {
      success: false,
      error: 'File not found',
      cost: 0,
      processingTime: 0,
    };
  }

  // 更新狀態為處理中
  await prisma.historicalFile.update({
    where: { id: fileId },
    data: { status: 'PROCESSING' },
  });

  try {
    let result: InvoiceExtractionResult;
    let actualCost: number;

    // 根據路由執行處理
    switch (file.processingRoute) {
      case 'AZURE_DI':
        const azureResult = await processWithAzureDI(file.storagePath);
        result = azureResult.result;
        actualCost = azureResult.cost;
        break;

      case 'GPT_VISION':
        const visionResult = await processWithGPTVision(file.storagePath);
        result = visionResult.result;
        actualCost = visionResult.cost;
        break;

      default:
        throw new Error(`Unsupported route: ${file.processingRoute}`);
    }

    const processingTime = Date.now() - startTime;

    // 更新文件記錄
    await prisma.historicalFile.update({
      where: { id: fileId },
      data: {
        status: 'COMPLETED',
        extractionResult: result as any,
        processedAt: new Date(),
        processingTime,
        actualCost,
      },
    });

    // 更新批次統計
    await prisma.historicalBatch.update({
      where: { id: file.batchId },
      data: {
        processedFiles: { increment: 1 },
        totalCost: { increment: actualCost },
      },
    });

    return {
      success: true,
      result,
      cost: actualCost,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 更新文件狀態為失敗
    await prisma.historicalFile.update({
      where: { id: fileId },
      data: {
        status: 'FAILED',
        errorMessage,
        processingTime,
      },
    });

    // 更新批次失敗計數
    await prisma.historicalBatch.update({
      where: { id: file.batchId },
      data: {
        failedFiles: { increment: 1 },
      },
    });

    return {
      success: false,
      error: errorMessage,
      cost: 0,
      processingTime,
    };
  }
}

// ============================================
// Batch Processing
// ============================================

/**
 * 處理批次中的所有待處理文件
 */
export async function processBatch(
  batchId: string,
  options: {
    concurrency?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<{
  totalProcessed: number;
  totalFailed: number;
  totalCost: number;
  totalTime: number;
}> {
  const { concurrency = 5, onProgress } = options;
  const startTime = Date.now();

  // 獲取待處理文件
  const pendingFiles = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'asc' },
  });

  // 更新批次狀態
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      status: 'PROCESSING',
      startedAt: new Date(),
    },
  });

  let processed = 0;
  let failed = 0;
  let totalCost = 0;

  // 分批並行處理
  for (let i = 0; i < pendingFiles.length; i += concurrency) {
    const batch = pendingFiles.slice(i, i + concurrency);

    const results = await Promise.all(
      batch.map(file => processFile(file.id))
    );

    for (const result of results) {
      if (result.success) {
        processed++;
        totalCost += result.cost;
      } else {
        failed++;
      }
    }

    if (onProgress) {
      onProgress(processed + failed, pendingFiles.length);
    }

    // 更新當前處理文件
    if (i + concurrency < pendingFiles.length) {
      await prisma.historicalBatch.update({
        where: { id: batchId },
        data: {
          currentFileId: pendingFiles[i + concurrency]?.id,
        },
      });
    }
  }

  const totalTime = Date.now() - startTime;

  // 更新批次完成狀態
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      status: failed === pendingFiles.length ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
      currentFileId: null,
    },
  });

  return {
    totalProcessed: processed,
    totalFailed: failed,
    totalCost,
    totalTime,
  };
}
```

---

### Phase 2: Azure DI 適配器 (45 min)

#### Step 2.1: 創建 Azure DI 服務

Create `src/services/azure-di.service.ts`:

```typescript
/**
 * @fileoverview Azure Document Intelligence 服務
 * @description
 *   - 呼叫 Azure DI API
 *   - 解析發票結構
 *   - 轉換為統一格式
 *
 * @module src/services/azure-di
 * @since Epic 0 - Story 0.2
 */

import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from '@azure/ai-form-recognizer';
import { InvoiceExtractionResult, LineItem } from '@/types/extraction';
import { COST_CONFIG } from './processing-router.service';
import { readFile } from 'fs/promises';
import { join } from 'path';

// ============================================
// Client Initialization
// ============================================

const client = new DocumentAnalysisClient(
  process.env.AZURE_DI_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_DI_KEY!)
);

// ============================================
// Main Processing Function
// ============================================

/**
 * 使用 Azure Document Intelligence 處理文件
 */
export async function processWithAzureDI(storagePath: string): Promise<{
  result: InvoiceExtractionResult;
  cost: number;
}> {
  // 讀取文件
  const fullPath = join(process.cwd(), 'public', storagePath);
  const fileBuffer = await readFile(fullPath);

  // 呼叫 Azure DI
  const poller = await client.beginAnalyzeDocument(
    'prebuilt-invoice',
    fileBuffer
  );
  const analyzeResult = await poller.pollUntilDone();

  // 計算成本
  const pageCount = analyzeResult.pages?.length || 1;
  const cost = pageCount * COST_CONFIG.AZURE_DI.perPage;

  // 轉換結果
  const result = transformAzureDIResult(analyzeResult);

  return { result, cost };
}

/**
 * 轉換 Azure DI 結果為統一格式
 */
function transformAzureDIResult(analyzeResult: any): InvoiceExtractionResult {
  const documents = analyzeResult.documents || [];
  const doc = documents[0] || {};
  const fields = doc.fields || {};

  // 提取費用明細
  const items = fields.Items?.values || [];
  const lineItems: LineItem[] = items.map((item: any) => {
    const itemFields = item.properties || {};
    return {
      description: itemFields.Description?.content || '',
      quantity: itemFields.Quantity?.value || null,
      unitPrice: itemFields.UnitPrice?.value || null,
      amount: itemFields.Amount?.value || 0,
      category: null,  // 待分類
      confidence: itemFields.Description?.confidence || 0,
    };
  });

  // 計算整體信心度
  const confidences = Object.values(fields)
    .filter((f: any) => f?.confidence !== undefined)
    .map((f: any) => f.confidence);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
    : 0;

  return {
    documentInfo: {
      invoiceNumber: fields.InvoiceId?.content || null,
      invoiceDate: fields.InvoiceDate?.value?.toISOString() || null,
      dueDate: fields.DueDate?.value?.toISOString() || null,
      currency: fields.CurrencyCode?.content || 'USD',
      totalAmount: fields.InvoiceTotal?.value || null,
    },
    vendor: {
      name: fields.VendorName?.content || null,
      address: fields.VendorAddress?.content || null,
      taxId: fields.VendorTaxId?.content || null,
    },
    customer: {
      name: fields.CustomerName?.content || null,
      address: fields.CustomerAddress?.content || null,
      reference: fields.PurchaseOrder?.content || null,
    },
    shipment: {
      blNumber: extractCustomField(fields, 'BLNumber'),
      containerNumber: extractCustomField(fields, 'ContainerNumber'),
      vesselName: extractCustomField(fields, 'VesselName'),
      voyage: extractCustomField(fields, 'Voyage'),
      portOfLoading: extractCustomField(fields, 'PortOfLoading'),
      portOfDischarge: extractCustomField(fields, 'PortOfDischarge'),
    },
    lineItems,
    metadata: {
      confidence: avgConfidence,
      processingRoute: 'AZURE_DI',
      rawResponse: analyzeResult,
      warnings: [],
    },
  };
}

/**
 * 提取自定義欄位（運輸相關）
 */
function extractCustomField(fields: any, fieldName: string): string | null {
  // Azure DI 可能將這些放在自定義欄位或文本內容中
  // 這裡需要根據實際模型調整
  return fields[fieldName]?.content || null;
}
```

---

### Phase 3: GPT Vision 適配器 (45 min)

#### Step 3.1: 創建 GPT Vision 服務

Create `src/services/gpt-vision.service.ts`:

```typescript
/**
 * @fileoverview GPT-4o Vision 服務
 * @description
 *   - 呼叫 OpenAI Vision API
 *   - 使用結構化 Prompt 提取發票資訊
 *   - 轉換為統一格式
 *
 * @module src/services/gpt-vision
 * @since Epic 0 - Story 0.2
 */

import OpenAI from 'openai';
import { InvoiceExtractionResult, LineItem } from '@/types/extraction';
import { COST_CONFIG } from './processing-router.service';
import { readFile } from 'fs/promises';
import { join } from 'path';

// ============================================
// Client Initialization
// ============================================

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: process.env.AZURE_OPENAI_ENDPOINT,
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY,
  },
});

// ============================================
// Extraction Prompt
// ============================================

const EXTRACTION_PROMPT = `你是一個專業的物流發票資料提取專家。請從這張發票圖片中提取以下資訊，以 JSON 格式返回。

請提取：
1. 文件資訊：發票號碼、發票日期、到期日、幣別、總金額
2. 供應商資訊：名稱、地址、稅號
3. 客戶資訊：名稱、地址、參考號（如 PO 號）
4. 運輸資訊：提單號、貨櫃號、船名、航次、裝貨港、卸貨港
5. 費用明細：每一行的描述、數量、單價、金額

返回格式：
{
  "documentInfo": {
    "invoiceNumber": "string or null",
    "invoiceDate": "YYYY-MM-DD or null",
    "dueDate": "YYYY-MM-DD or null",
    "currency": "USD/EUR/etc",
    "totalAmount": number or null
  },
  "vendor": {
    "name": "string or null",
    "address": "string or null",
    "taxId": "string or null"
  },
  "customer": {
    "name": "string or null",
    "address": "string or null",
    "reference": "string or null"
  },
  "shipment": {
    "blNumber": "string or null",
    "containerNumber": "string or null",
    "vesselName": "string or null",
    "voyage": "string or null",
    "portOfLoading": "string or null",
    "portOfDischarge": "string or null"
  },
  "lineItems": [
    {
      "description": "string",
      "quantity": number or null,
      "unitPrice": number or null,
      "amount": number
    }
  ],
  "confidence": 0.0-1.0
}

重要：
- 如果某個欄位無法識別，返回 null
- 金額必須是數字類型
- 日期格式統一為 YYYY-MM-DD
- confidence 是你對整體提取結果的信心度`;

// ============================================
// Main Processing Function
// ============================================

/**
 * 使用 GPT-4o Vision 處理文件
 */
export async function processWithGPTVision(storagePath: string): Promise<{
  result: InvoiceExtractionResult;
  cost: number;
}> {
  // 讀取文件並轉換為 base64
  const fullPath = join(process.cwd(), 'public', storagePath);
  const fileBuffer = await readFile(fullPath);
  const base64Image = fileBuffer.toString('base64');

  // 判斷文件類型
  const mimeType = storagePath.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : storagePath.toLowerCase().endsWith('.png')
    ? 'image/png'
    : 'image/jpeg';

  // 呼叫 GPT-4o Vision
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  // 計算成本
  const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };
  const cost =
    usage.prompt_tokens * COST_CONFIG.GPT_VISION.inputTokenCost +
    usage.completion_tokens * COST_CONFIG.GPT_VISION.outputTokenCost;

  // 解析結果
  const content = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  // 轉換為統一格式
  const result = transformGPTVisionResult(parsed, response);

  return { result, cost };
}

/**
 * 轉換 GPT Vision 結果為統一格式
 */
function transformGPTVisionResult(
  parsed: any,
  rawResponse: any
): InvoiceExtractionResult {
  const lineItems: LineItem[] = (parsed.lineItems || []).map((item: any) => ({
    description: item.description || '',
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount || 0,
    category: null,
    confidence: parsed.confidence || 0.8,
  }));

  return {
    documentInfo: {
      invoiceNumber: parsed.documentInfo?.invoiceNumber || null,
      invoiceDate: parsed.documentInfo?.invoiceDate || null,
      dueDate: parsed.documentInfo?.dueDate || null,
      currency: parsed.documentInfo?.currency || 'USD',
      totalAmount: parsed.documentInfo?.totalAmount || null,
    },
    vendor: {
      name: parsed.vendor?.name || null,
      address: parsed.vendor?.address || null,
      taxId: parsed.vendor?.taxId || null,
    },
    customer: {
      name: parsed.customer?.name || null,
      address: parsed.customer?.address || null,
      reference: parsed.customer?.reference || null,
    },
    shipment: {
      blNumber: parsed.shipment?.blNumber || null,
      containerNumber: parsed.shipment?.containerNumber || null,
      vesselName: parsed.shipment?.vesselName || null,
      voyage: parsed.shipment?.voyage || null,
      portOfLoading: parsed.shipment?.portOfLoading || null,
      portOfDischarge: parsed.shipment?.portOfDischarge || null,
    },
    lineItems,
    metadata: {
      confidence: parsed.confidence || 0.8,
      processingRoute: 'GPT_VISION',
      rawResponse,
      warnings: [],
    },
  };
}
```

---

### Phase 4: API 路由 (30 min)

#### Step 4.1: 創建處理 API

Create `src/app/api/admin/historical-data/batches/[id]/process/route.ts`:

```typescript
/**
 * @fileoverview 批次處理 API
 * @module src/app/api/admin/historical-data/batches/[id]/process
 * @since Epic 0 - Story 0.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { processBatch } from '@/services/processing-router.service';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/historical-data/batches/[id]/process
 * 開始處理批次
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

    // 檢查批次狀態
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    if (batch.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Batch is already being processed' },
        { status: 400 }
      );
    }

    // 異步開始處理（不等待完成）
    processBatch(batchId, { concurrency: 5 })
      .then(result => {
        console.log(`Batch ${batchId} completed:`, result);
      })
      .catch(error => {
        console.error(`Batch ${batchId} failed:`, error);
      });

    return NextResponse.json({
      success: true,
      message: 'Processing started',
      data: {
        batchId,
        status: 'PROCESSING',
      },
    });
  } catch (error) {
    console.error('Start processing error:', error);
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    );
  }
}
```

#### Step 4.2: 成本預估 API

Create `src/app/api/admin/historical-data/batches/[id]/estimate/route.ts`:

```typescript
/**
 * @fileoverview 批次成本預估 API
 * @module src/app/api/admin/historical-data/batches/[id]/estimate
 * @since Epic 0 - Story 0.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  determineProcessingRoute,
  estimateProcessingCost
} from '@/services/processing-router.service';

/**
 * GET /api/admin/historical-data/batches/[id]/estimate
 * 獲取批次處理成本預估
 */
export async function GET(
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

    // 獲取批次文件
    const files = await prisma.historicalFile.findMany({
      where: { batchId },
      select: {
        id: true,
        detectedType: true,
        pageCount: true,
        processingRoute: true,
        estimatedCost: true,
      },
    });

    // 計算路由分佈和成本
    const routeDistribution = {
      AZURE_DI: { count: 0, pages: 0, cost: 0 },
      GPT_VISION: { count: 0, pages: 0, cost: 0 },
      MANUAL: { count: 0, pages: 0, cost: 0 },
    };

    for (const file of files) {
      const route = file.processingRoute || determineProcessingRoute(file.detectedType);
      const pages = file.pageCount || 1;
      const cost = file.estimatedCost || estimateProcessingCost(route, pages);

      if (route in routeDistribution) {
        routeDistribution[route as keyof typeof routeDistribution].count++;
        routeDistribution[route as keyof typeof routeDistribution].pages += pages;
        routeDistribution[route as keyof typeof routeDistribution].cost += cost;
      }
    }

    const totalCost = Object.values(routeDistribution).reduce(
      (sum, r) => sum + r.cost,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        totalFiles: files.length,
        totalCost: Math.round(totalCost * 100) / 100,
        routeDistribution,
        estimatedProcessingTime: estimateProcessingTime(files.length),
      },
    });
  } catch (error) {
    console.error('Estimate error:', error);
    return NextResponse.json(
      { error: 'Failed to estimate cost' },
      { status: 500 }
    );
  }
}

function estimateProcessingTime(fileCount: number): {
  min: number;
  max: number;
  unit: string;
} {
  // 假設每個文件平均處理時間為 5-15 秒
  const minSeconds = fileCount * 5;
  const maxSeconds = fileCount * 15;

  if (maxSeconds < 60) {
    return { min: minSeconds, max: maxSeconds, unit: 'seconds' };
  } else if (maxSeconds < 3600) {
    return {
      min: Math.round(minSeconds / 60),
      max: Math.round(maxSeconds / 60),
      unit: 'minutes',
    };
  } else {
    return {
      min: Math.round(minSeconds / 3600),
      max: Math.round(maxSeconds / 3600),
      unit: 'hours',
    };
  }
}
```

---

## Verification Checklist

### 路由邏輯

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 原生 PDF 路由 | 處理 NATIVE_PDF 文件 | 使用 AZURE_DI | [ ] |
| 掃描 PDF 路由 | 處理 SCANNED_PDF 文件 | 使用 GPT_VISION | [ ] |
| 圖片路由 | 處理 IMAGE 文件 | 使用 GPT_VISION | [ ] |
| 未知類型 | 處理 UNKNOWN 文件 | 標記為 MANUAL | [ ] |

### Azure DI 處理

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 基本提取 | 處理標準發票 PDF | 提取發票資訊 | [ ] |
| 費用明細 | 處理多行發票 | 提取所有明細 | [ ] |
| 成本計算 | 處理完成後 | 記錄實際成本 | [ ] |
| 錯誤處理 | 處理損壞文件 | 正確記錄錯誤 | [ ] |

### GPT Vision 處理

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 掃描 PDF | 處理掃描發票 | 提取發票資訊 | [ ] |
| 圖片發票 | 處理 JPG 發票 | 提取發票資訊 | [ ] |
| Token 計費 | 處理完成後 | 記錄 token 成本 | [ ] |
| JSON 解析 | 處理任意格式 | 正確解析 JSON | [ ] |

### 批次處理

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 並行處理 | 處理 10 個文件 | 5 個同時處理 | [ ] |
| 進度更新 | 處理過程中 | 正確更新計數 | [ ] |
| 錯誤計數 | 部分文件失敗 | 正確記錄失敗數 | [ ] |
| 成本彙總 | 處理完成後 | 計算總成本 | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/types/extraction.ts` | 統一提取結果類型 |
| `src/services/processing-router.service.ts` | 處理路由服務 |
| `src/services/azure-di.service.ts` | Azure DI 適配器 |
| `src/services/gpt-vision.service.ts` | GPT Vision 適配器 |
| `src/app/api/admin/historical-data/batches/[id]/process/route.ts` | 處理啟動 API |
| `src/app/api/admin/historical-data/batches/[id]/estimate/route.ts` | 成本預估 API |

---

## Environment Variables

```bash
# Azure Document Intelligence
AZURE_DI_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_DI_KEY="your-api-key"

# Azure OpenAI (GPT-4o)
AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
AZURE_OPENAI_API_KEY="your-api-key"
AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o"
```

---

## Dependencies

```bash
npm install @azure/ai-form-recognizer openai
```

---

## Next Steps

完成 Story 0-2 後：
1. 進入 **Story 0-3**（即時公司 Profile 建立）
2. 從提取結果中識別公司名稱
3. 實現模糊匹配和 Just-in-Time 建立

---

*Generated by BMAD Method - Create Tech Spec Workflow*
