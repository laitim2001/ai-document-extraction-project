# Story 11-3: API 處理結果獲取端點

## Story 資訊

- **Epic**: 11 - 對外 API 服務
- **功能需求**: FR66 (結果獲取 API)
- **優先級**: High
- **故事點數**: 5
- **相關 Stories**:
  - Story 11-1 (API 發票提交端點)
  - Story 11-2 (API 處理狀態查詢端點)
  - Story 11-5 (API 訪問控制與認證)

## 使用者故事

**As a** 外部系統開發者,
**I want** 獲取發票處理的完整結果,
**So that** 我可以使用提取的數據進行後續處理。

## 驗收標準

### AC1: 標準結果獲取

**Given** 發票處理已完成
**When** 調用 `GET /api/v1/invoices/{taskId}/result`
**Then** 返回完整的提取結果：
- taskId - 任務 ID
- status - 狀態
- forwarder - Forwarder 資訊（id, name, code）
- fields - 提取欄位陣列（name, value, confidence, source）
- metadata - 元數據
- processedAt - 處理完成時間

### AC2: 多格式支援

**Given** 獲取結果
**When** 需要特定格式
**Then** 支援 `format` 參數：
- `json` - 標準 JSON 格式（預設）
- `csv` - CSV 格式（僅欄位數據）
- `xml` - XML 格式

### AC3: 未完成狀態處理

**Given** 獲取結果
**When** 處理狀態不是 `completed`
**Then** 返回 HTTP 409 Conflict
**And** 包含當前狀態資訊

### AC4: 過期結果處理

**Given** 獲取結果
**When** 結果已過期（超過保留期限）
**Then** 返回 HTTP 410 Gone
**And** 提示結果已歸檔

## 技術規格

### 1. 資料模型擴展

```prisma
// 提取結果擴展（支援 API 輸出）
model ExtractionResult {
  id                String    @id @default(cuid())
  documentId        String    @unique
  document          Document  @relation(fields: [documentId], references: [id])

  // Forwarder 資訊
  forwarderId       String?
  forwarder         Forwarder? @relation(fields: [forwarderId], references: [id])
  forwarderName     String?
  forwarderCode     String?

  // 提取欄位
  fields            Json      // ExtractionField[]

  // 信心度
  confidenceScore   Float
  overallConfidence Float?

  // 處理資訊
  ocrEngine         String?
  aiModel           String?
  processingTime    Int?      // 毫秒

  // 元數據
  metadata          Json?

  // 時間記錄
  processedAt       DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([documentId])
  @@index([forwarderId])
}

// 提取欄位結構（JSON 內部結構）
// interface ExtractionField {
//   name: string
//   value: string | number | null
//   confidence: number
//   source: 'ocr' | 'ai' | 'rule' | 'manual'
//   boundingBox?: { x: number, y: number, width: number, height: number }
//   pageNumber?: number
//   rawValue?: string  // OCR 原始值
// }
```

### 2. 結果獲取服務

```typescript
// lib/services/externalApi/resultRetrievalService.ts
import { prisma } from '@/lib/prisma'
import { ExternalApiKey } from '@prisma/client'

// 標準欄位定義
const STANDARD_FIELDS = [
  'invoiceNumber',
  'invoiceDate',
  'dueDate',
  'vendorName',
  'vendorAddress',
  'vendorTaxId',
  'buyerName',
  'buyerAddress',
  'buyerTaxId',
  'subtotal',
  'taxAmount',
  'totalAmount',
  'currency',
  'paymentTerms',
  'poNumber',
  'shipmentNumber',
  'containerNumber',
  'blNumber',
  'portOfLoading',
  'portOfDischarge',
  'weight',
  'volume',
  'freightCharges',
  'handlingFees',
  'customsDuty',
  'description',
  'notes',
]

export interface ExtractionField {
  name: string
  value: string | number | null
  confidence: number
  source: 'ocr' | 'ai' | 'rule' | 'manual'
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  pageNumber?: number
}

export interface TaskResultResponse {
  taskId: string
  status: string
  forwarder: {
    id: string
    name: string
    code: string
  } | null
  fields: ExtractionField[]
  metadata: {
    originalFileName: string
    fileSize: number
    mimeType: string
    pageCount?: number
    ocrEngine?: string
    aiModel?: string
    processingTime?: number
  }
  processedAt: string
  expiresAt: string
}

export type OutputFormat = 'json' | 'csv' | 'xml'

export class ResultRetrievalService {
  // 獲取處理結果
  async getTaskResult(
    taskId: string,
    apiKey: ExternalApiKey,
    format: OutputFormat = 'json'
  ): Promise<{
    result?: TaskResultResponse
    content?: string
    contentType?: string
    error?: {
      code: string
      message: string
      status: number
      currentStatus?: string
    }
  }> {
    // 查詢任務
    const task = await prisma.externalApiTask.findUnique({
      where: { taskId },
      include: {
        document: {
          include: {
            extractionResult: {
              include: {
                forwarder: true,
              },
            },
          },
        },
      },
    })

    // 任務不存在
    if (!task) {
      return {
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
          status: 404,
        },
      }
    }

    // 權限檢查
    if (task.apiKeyId !== apiKey.id) {
      const allowedCities = apiKey.allowedCities as string[]
      if (!allowedCities.includes('*') && !allowedCities.includes(task.cityCode)) {
        return {
          error: {
            code: 'TASK_NOT_FOUND',
            message: 'Task not found',
            status: 404,
          },
        }
      }
    }

    // 檢查狀態
    if (task.status !== 'COMPLETED') {
      return {
        error: {
          code: 'RESULT_NOT_READY',
          message: `Task is not completed. Current status: ${task.status.toLowerCase()}`,
          status: 409,
          currentStatus: task.status.toLowerCase(),
        },
      }
    }

    // 檢查過期
    if (task.resultExpiresAt && task.resultExpiresAt < new Date()) {
      return {
        error: {
          code: 'RESULT_EXPIRED',
          message: 'Result has expired and been archived. Contact support for retrieval.',
          status: 410,
        },
      }
    }

    // 構建結果
    const extractionResult = task.document?.extractionResult
    const fields = (extractionResult?.fields as ExtractionField[]) || []

    const result: TaskResultResponse = {
      taskId: task.taskId,
      status: 'completed',
      forwarder: extractionResult?.forwarder
        ? {
            id: extractionResult.forwarder.id,
            name: extractionResult.forwarder.name,
            code: extractionResult.forwarder.code,
          }
        : null,
      fields: this.normalizeFields(fields),
      metadata: {
        originalFileName: task.originalFileName,
        fileSize: task.fileSize,
        mimeType: task.mimeType,
        pageCount: task.document?.pageCount || undefined,
        ocrEngine: extractionResult?.ocrEngine || undefined,
        aiModel: extractionResult?.aiModel || undefined,
        processingTime: extractionResult?.processingTime || undefined,
      },
      processedAt: task.completedAt?.toISOString() || task.updatedAt.toISOString(),
      expiresAt: task.resultExpiresAt?.toISOString() || '',
    }

    // 根據格式返回
    switch (format) {
      case 'csv':
        return {
          content: this.formatAsCSV(result),
          contentType: 'text/csv',
        }
      case 'xml':
        return {
          content: this.formatAsXML(result),
          contentType: 'application/xml',
        }
      default:
        return { result }
    }
  }

  // 標準化欄位
  private normalizeFields(fields: ExtractionField[]): ExtractionField[] {
    return fields.map((field) => ({
      name: field.name,
      value: field.value,
      confidence: Math.round(field.confidence * 100) / 100,
      source: field.source,
      ...(field.boundingBox && { boundingBox: field.boundingBox }),
      ...(field.pageNumber && { pageNumber: field.pageNumber }),
    }))
  }

  // 格式化為 CSV
  private formatAsCSV(result: TaskResultResponse): string {
    const headers = ['Field Name', 'Value', 'Confidence', 'Source']
    const rows = result.fields.map((field) => [
      this.escapeCSV(field.name),
      this.escapeCSV(String(field.value ?? '')),
      field.confidence.toString(),
      field.source,
    ])

    return [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')
  }

  // CSV 轉義
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  // 格式化為 XML
  private formatAsXML(result: TaskResultResponse): string {
    const escapeXML = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }

    const fieldsXML = result.fields
      .map(
        (field) => `
    <field>
      <name>${escapeXML(field.name)}</name>
      <value>${escapeXML(String(field.value ?? ''))}</value>
      <confidence>${field.confidence}</confidence>
      <source>${field.source}</source>
    </field>`
      )
      .join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<invoiceResult>
  <taskId>${escapeXML(result.taskId)}</taskId>
  <status>${result.status}</status>
  <forwarder>
    ${
      result.forwarder
        ? `<id>${escapeXML(result.forwarder.id)}</id>
    <name>${escapeXML(result.forwarder.name)}</name>
    <code>${escapeXML(result.forwarder.code)}</code>`
        : '<null/>'
    }
  </forwarder>
  <fields>${fieldsXML}
  </fields>
  <metadata>
    <originalFileName>${escapeXML(result.metadata.originalFileName)}</originalFileName>
    <fileSize>${result.metadata.fileSize}</fileSize>
    <mimeType>${escapeXML(result.metadata.mimeType)}</mimeType>
  </metadata>
  <processedAt>${result.processedAt}</processedAt>
  <expiresAt>${result.expiresAt}</expiresAt>
</invoiceResult>`
  }

  // 獲取特定欄位值
  async getFieldValue(
    taskId: string,
    fieldName: string,
    apiKey: ExternalApiKey
  ): Promise<{
    value?: string | number | null
    confidence?: number
    error?: { code: string; message: string; status: number }
  }> {
    const { result, error } = await this.getTaskResult(taskId, apiKey, 'json')

    if (error) {
      return { error }
    }

    const field = result?.fields.find((f) => f.name === fieldName)

    if (!field) {
      return {
        error: {
          code: 'FIELD_NOT_FOUND',
          message: `Field '${fieldName}' not found in extraction result`,
          status: 404,
        },
      }
    }

    return {
      value: field.value,
      confidence: field.confidence,
    }
  }

  // 下載原始文件
  async getOriginalDocument(
    taskId: string,
    apiKey: ExternalApiKey
  ): Promise<{
    url?: string
    fileName?: string
    mimeType?: string
    error?: { code: string; message: string; status: number }
  }> {
    const task = await prisma.externalApiTask.findUnique({
      where: { taskId },
      include: {
        document: true,
      },
    })

    if (!task) {
      return {
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
          status: 404,
        },
      }
    }

    // 權限檢查
    if (task.apiKeyId !== apiKey.id) {
      const allowedCities = apiKey.allowedCities as string[]
      if (!allowedCities.includes('*') && !allowedCities.includes(task.cityCode)) {
        return {
          error: {
            code: 'TASK_NOT_FOUND',
            message: 'Task not found',
            status: 404,
          },
        }
      }
    }

    if (!task.document?.blobUrl) {
      return {
        error: {
          code: 'DOCUMENT_NOT_AVAILABLE',
          message: 'Original document is not available',
          status: 404,
        },
      }
    }

    // 生成臨時下載 URL（有效期 5 分鐘）
    const sasUrl = await this.generateSasUrl(task.document.blobUrl)

    return {
      url: sasUrl,
      fileName: task.originalFileName,
      mimeType: task.mimeType,
    }
  }

  // 生成 SAS URL
  private async generateSasUrl(blobUrl: string): Promise<string> {
    // 實際實現應使用 Azure Blob Storage SDK 生成 SAS URL
    // 這裡提供簡化實現
    const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob')

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)

    // 解析 blob URL
    const urlParts = new URL(blobUrl)
    const pathParts = urlParts.pathname.split('/').filter(Boolean)
    const containerName = pathParts[0]
    const blobName = pathParts.slice(1).join('/')

    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blobClient = containerClient.getBlobClient(blobName)

    // 生成 SAS token（5 分鐘有效）
    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + 5 * 60 * 1000),
    }, blobServiceClient.credential).toString()

    return `${blobUrl}?${sasToken}`
  }
}

export const resultRetrievalService = new ResultRetrievalService()
```

### 3. API 路由實現

```typescript
// app/api/v1/invoices/[taskId]/result/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { resultRetrievalService, OutputFormat } from '@/lib/services/externalApi/resultRetrievalService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitMiddleware } from '@/lib/middleware/rateLimitMiddleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 1. 認證
    const authResult = await externalApiAuthMiddleware(request, ['result'])
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: {
            code: authResult.errorCode,
            message: authResult.errorMessage,
          },
          traceId,
        },
        { status: authResult.statusCode }
      )
    }

    // 2. 速率限制
    const rateLimitResult = await rateLimitMiddleware(request, authResult.apiKey!)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
          },
          traceId,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          },
        }
      )
    }

    // 3. 解析格式參數
    const format = (request.nextUrl.searchParams.get('format') as OutputFormat) || 'json'

    if (!['json', 'csv', 'xml'].includes(format)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_FORMAT',
            message: 'Format must be one of: json, csv, xml',
          },
          traceId,
        },
        { status: 400 }
      )
    }

    // 4. 獲取結果
    const response = await resultRetrievalService.getTaskResult(
      params.taskId,
      authResult.apiKey!,
      format
    )

    // 5. 處理錯誤
    if (response.error) {
      return NextResponse.json(
        {
          error: {
            code: response.error.code,
            message: response.error.message,
            ...(response.error.currentStatus && {
              currentStatus: response.error.currentStatus,
            }),
          },
          traceId,
        },
        { status: response.error.status }
      )
    }

    // 6. 返回結果
    if (response.content) {
      // CSV 或 XML 格式
      return new NextResponse(response.content, {
        status: 200,
        headers: {
          'Content-Type': response.contentType!,
          'Content-Disposition': `attachment; filename="${params.taskId}.${format}"`,
          'X-Trace-Id': traceId,
        },
      })
    }

    // JSON 格式
    return NextResponse.json(
      {
        data: response.result,
        traceId,
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '59',
        },
      }
    )
  } catch (error) {
    console.error('Get result error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        traceId,
      },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/v1/invoices/[taskId]/result/fields/[fieldName]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { resultRetrievalService } from '@/lib/services/externalApi/resultRetrievalService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string; fieldName: string } }
) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 認證
    const authResult = await externalApiAuthMiddleware(request, ['result'])
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: {
            code: authResult.errorCode,
            message: authResult.errorMessage,
          },
          traceId,
        },
        { status: authResult.statusCode }
      )
    }

    // 獲取欄位值
    const response = await resultRetrievalService.getFieldValue(
      params.taskId,
      params.fieldName,
      authResult.apiKey!
    )

    if (response.error) {
      return NextResponse.json(
        {
          error: {
            code: response.error.code,
            message: response.error.message,
          },
          traceId,
        },
        { status: response.error.status }
      )
    }

    return NextResponse.json(
      {
        data: {
          fieldName: params.fieldName,
          value: response.value,
          confidence: response.confidence,
        },
        traceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get field value error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        traceId,
      },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/v1/invoices/[taskId]/document/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { resultRetrievalService } from '@/lib/services/externalApi/resultRetrievalService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const traceId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    // 認證
    const authResult = await externalApiAuthMiddleware(request, ['result'])
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          error: {
            code: authResult.errorCode,
            message: authResult.errorMessage,
          },
          traceId,
        },
        { status: authResult.statusCode }
      )
    }

    // 獲取文件下載資訊
    const response = await resultRetrievalService.getOriginalDocument(
      params.taskId,
      authResult.apiKey!
    )

    if (response.error) {
      return NextResponse.json(
        {
          error: {
            code: response.error.code,
            message: response.error.message,
          },
          traceId,
        },
        { status: response.error.status }
      )
    }

    // 返回下載 URL
    return NextResponse.json(
      {
        data: {
          downloadUrl: response.url,
          fileName: response.fileName,
          mimeType: response.mimeType,
          expiresIn: 300, // 5 分鐘
        },
        traceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        traceId,
      },
      { status: 500 }
    )
  }
}
```

## 測試案例

### 單元測試

```typescript
// __tests__/services/externalApi/resultRetrievalService.test.ts
import { resultRetrievalService } from '@/lib/services/externalApi/resultRetrievalService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('ResultRetrievalService', () => {
  describe('getTaskResult', () => {
    it('should return result for completed task', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        originalFileName: 'invoice.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        completedAt: new Date(),
        updatedAt: new Date(),
        resultExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cityCode: 'TPE',
        document: {
          extractionResult: {
            forwarder: {
              id: 'f-1',
              name: 'Test Forwarder',
              code: 'TF',
            },
            fields: [
              { name: 'invoiceNumber', value: 'INV-001', confidence: 0.95, source: 'ai' },
              { name: 'totalAmount', value: 1000, confidence: 0.88, source: 'ai' },
            ],
          },
        },
      } as any)

      const apiKey = { id: 'key-1', allowedCities: ['*'] } as any

      const response = await resultRetrievalService.getTaskResult('task-1', apiKey, 'json')

      expect(response.result).toBeDefined()
      expect(response.result?.taskId).toBe('task-1')
      expect(response.result?.forwarder?.code).toBe('TF')
      expect(response.result?.fields).toHaveLength(2)
    })

    it('should return 409 for incomplete task', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'PROCESSING',
        cityCode: 'TPE',
      } as any)

      const apiKey = { id: 'key-1', allowedCities: ['*'] } as any

      const response = await resultRetrievalService.getTaskResult('task-1', apiKey, 'json')

      expect(response.error).toBeDefined()
      expect(response.error?.status).toBe(409)
      expect(response.error?.code).toBe('RESULT_NOT_READY')
    })

    it('should return 410 for expired result', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        resultExpiresAt: new Date(Date.now() - 1000), // 已過期
        cityCode: 'TPE',
      } as any)

      const apiKey = { id: 'key-1', allowedCities: ['*'] } as any

      const response = await resultRetrievalService.getTaskResult('task-1', apiKey, 'json')

      expect(response.error).toBeDefined()
      expect(response.error?.status).toBe(410)
      expect(response.error?.code).toBe('RESULT_EXPIRED')
    })

    it('should format result as CSV', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        originalFileName: 'invoice.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        completedAt: new Date(),
        updatedAt: new Date(),
        resultExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cityCode: 'TPE',
        document: {
          extractionResult: {
            fields: [
              { name: 'invoiceNumber', value: 'INV-001', confidence: 0.95, source: 'ai' },
            ],
          },
        },
      } as any)

      const apiKey = { id: 'key-1', allowedCities: ['*'] } as any

      const response = await resultRetrievalService.getTaskResult('task-1', apiKey, 'csv')

      expect(response.content).toBeDefined()
      expect(response.contentType).toBe('text/csv')
      expect(response.content).toContain('Field Name,Value,Confidence,Source')
      expect(response.content).toContain('invoiceNumber,INV-001,0.95,ai')
    })

    it('should format result as XML', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-1',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        originalFileName: 'invoice.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        completedAt: new Date(),
        updatedAt: new Date(),
        resultExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cityCode: 'TPE',
        document: {
          extractionResult: {
            fields: [
              { name: 'invoiceNumber', value: 'INV-001', confidence: 0.95, source: 'ai' },
            ],
          },
        },
      } as any)

      const apiKey = { id: 'key-1', allowedCities: ['*'] } as any

      const response = await resultRetrievalService.getTaskResult('task-1', apiKey, 'xml')

      expect(response.content).toBeDefined()
      expect(response.contentType).toBe('application/xml')
      expect(response.content).toContain('<?xml version="1.0"')
      expect(response.content).toContain('<invoiceResult>')
      expect(response.content).toContain('<name>invoiceNumber</name>')
    })
  })
})
```

### API 整合測試

```typescript
// __tests__/api/v1/invoices/[taskId]/result.test.ts
import { GET } from '@/app/api/v1/invoices/[taskId]/result/route'
import { createMocks } from 'node-mocks-http'

describe('GET /api/v1/invoices/{taskId}/result', () => {
  it('should return JSON result for completed task', async () => {
    const { req } = createMocks({
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid-api-key',
      },
    })

    const response = await GET(req as any, { params: { taskId: 'task-1' } })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data.taskId).toBe('task-1')
  })

  it('should return CSV when format=csv', async () => {
    const { req } = createMocks({
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid-api-key',
      },
      query: {
        format: 'csv',
      },
    })

    const response = await GET(req as any, { params: { taskId: 'task-1' } })

    expect(response.headers.get('Content-Type')).toBe('text/csv')
  })

  it('should return 409 for processing task', async () => {
    const { req } = createMocks({
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid-api-key',
      },
    })

    // Mock processing task
    const response = await GET(req as any, { params: { taskId: 'processing-task' } })

    expect(response.status).toBe(409)
  })
})
```

## 部署注意事項

1. **結果保留策略**
   - 結果預設保留 30 天
   - 過期後自動標記為 `EXPIRED`
   - 可配置歸檔策略

2. **大文件處理**
   - CSV/XML 輸出使用串流處理
   - 原始文件下載使用 SAS URL

3. **監控指標**
   - 結果獲取成功率
   - 各格式使用分佈
   - 過期結果訪問次數

## 相依性

- Story 11-1: API 發票提交端點（任務創建）
- Story 11-2: API 處理狀態查詢端點（狀態檢查）
- Story 11-5: API 訪問控制與認證（認證機制）
- Story 2-4: 欄位映射與提取（提取結果來源）
