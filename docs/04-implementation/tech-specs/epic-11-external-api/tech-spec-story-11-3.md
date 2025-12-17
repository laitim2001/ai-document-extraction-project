# Tech Spec: Story 11-3 - API 處理結果獲取端點

## 1. 總覽

### 1.1 功能描述
實現 RESTful API 端點，讓外部系統能夠獲取發票處理的完整提取結果，支援多種輸出格式（JSON、CSV、XML），並提供特定欄位查詢與原始文件下載功能。

### 1.2 目標
- 提供完整的發票提取結果 API
- 支援 JSON / CSV / XML 三種輸出格式
- 實現特定欄位值查詢端點
- 提供原始文件安全下載機制
- 處理未完成任務與過期結果的錯誤狀態

### 1.3 範圍
- 結果獲取服務 `ResultRetrievalService`
- 主要 API 端點：`GET /api/v1/invoices/{taskId}/result`
- 欄位查詢端點：`GET /api/v1/invoices/{taskId}/result/fields/{fieldName}`
- 文件下載端點：`GET /api/v1/invoices/{taskId}/document`
- 結果格式化（CSV、XML）

### 1.4 關聯 Story
- **依賴**: Story 11-1 (任務提交)、Story 11-2 (狀態查詢)、Story 11-5 (認證)
- **被依賴**: Story 11-4 (Webhook 可包含結果摘要)

---

## 2. 驗收標準對照

| AC | 描述 | 實作方式 | 驗證方法 |
|----|------|----------|----------|
| AC1 | 標準結果獲取 | `GET /api/v1/invoices/{taskId}/result` 返回完整提取結果 | API 測試驗證回傳結構 |
| AC2 | 多格式支援 | `format` 參數支援 json/csv/xml | 各格式輸出驗證 |
| AC3 | 未完成狀態處理 | 非 completed 狀態返回 409 Conflict | 狀態錯誤測試 |
| AC4 | 過期結果處理 | 超過保留期限返回 410 Gone | 過期邏輯測試 |

---

## 3. 資料庫設計

### 3.1 ExtractionResult 模型（擴展支援 API 輸出）

```prisma
model ExtractionResult {
  id                String    @id @default(cuid())
  documentId        String    @unique
  document          Document  @relation(fields: [documentId], references: [id])

  // Forwarder 資訊
  forwarderId       String?
  forwarder         Forwarder? @relation(fields: [forwarderId], references: [id])
  forwarderName     String?
  forwarderCode     String?

  // 提取欄位 (JSON 陣列)
  fields            Json      // ExtractionField[]

  // 信心度指標
  confidenceScore   Float
  overallConfidence Float?

  // 處理引擎資訊
  ocrEngine         String?   // 使用的 OCR 引擎
  aiModel           String?   // 使用的 AI 模型
  processingTime    Int?      // 處理時間（毫秒）

  // 元數據
  metadata          Json?

  // 時間記錄
  processedAt       DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([documentId])
  @@index([forwarderId])
}
```

### 3.2 ExternalApiTask 擴展欄位

```prisma
model ExternalApiTask {
  // ... 現有欄位 ...

  // 結果過期時間
  resultExpiresAt   DateTime?

  // 完成時間
  completedAt       DateTime?
}
```

### 3.3 ExtractionField 結構（JSON Schema）

```typescript
interface ExtractionField {
  name: string                          // 欄位名稱
  value: string | number | null         // 欄位值
  confidence: number                    // 信心度 (0-1)
  source: 'ocr' | 'ai' | 'rule' | 'manual'  // 來源
  boundingBox?: {                       // 邊界框位置
    x: number
    y: number
    width: number
    height: number
  }
  pageNumber?: number                   // 頁碼
  rawValue?: string                     // OCR 原始值
}
```

---

## 4. 型別定義

### 4.1 核心型別

```typescript
// lib/types/externalApi/result.ts

/**
 * 輸出格式類型
 */
export type OutputFormat = 'json' | 'csv' | 'xml'

/**
 * 提取欄位
 */
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

/**
 * Forwarder 資訊
 */
export interface ForwarderInfo {
  id: string
  name: string
  code: string
}

/**
 * 結果元數據
 */
export interface ResultMetadata {
  originalFileName: string
  fileSize: number
  mimeType: string
  pageCount?: number
  ocrEngine?: string
  aiModel?: string
  processingTime?: number
}

/**
 * 任務結果回應
 */
export interface TaskResultResponse {
  taskId: string
  status: string
  forwarder: ForwarderInfo | null
  fields: ExtractionField[]
  metadata: ResultMetadata
  processedAt: string
  expiresAt: string
}

/**
 * 欄位值回應
 */
export interface FieldValueResponse {
  fieldName: string
  value: string | number | null
  confidence: number
}

/**
 * 文件下載回應
 */
export interface DocumentDownloadResponse {
  downloadUrl: string
  fileName: string
  mimeType: string
  expiresIn: number  // 秒
}

/**
 * 結果獲取錯誤
 */
export interface ResultError {
  code: ResultErrorCode
  message: string
  status: number
  currentStatus?: string
}

/**
 * 錯誤碼
 */
export type ResultErrorCode =
  | 'TASK_NOT_FOUND'
  | 'RESULT_NOT_READY'
  | 'RESULT_EXPIRED'
  | 'FIELD_NOT_FOUND'
  | 'DOCUMENT_NOT_AVAILABLE'
  | 'INVALID_FORMAT'
  | 'INTERNAL_ERROR'
```

### 4.2 標準欄位列表

```typescript
// lib/constants/extractionFields.ts

/**
 * 標準提取欄位定義
 */
export const STANDARD_FIELDS = [
  // 發票基本資訊
  'invoiceNumber',
  'invoiceDate',
  'dueDate',

  // 供應商資訊
  'vendorName',
  'vendorAddress',
  'vendorTaxId',

  // 買方資訊
  'buyerName',
  'buyerAddress',
  'buyerTaxId',

  // 金額資訊
  'subtotal',
  'taxAmount',
  'totalAmount',
  'currency',

  // 付款資訊
  'paymentTerms',
  'poNumber',

  // 物流資訊
  'shipmentNumber',
  'containerNumber',
  'blNumber',
  'portOfLoading',
  'portOfDischarge',

  // 貨物資訊
  'weight',
  'volume',

  // 費用明細
  'freightCharges',
  'handlingFees',
  'customsDuty',

  // 其他
  'description',
  'notes',
] as const

export type StandardFieldName = typeof STANDARD_FIELDS[number]

/**
 * 欄位顯示名稱對照
 */
export const FIELD_DISPLAY_NAMES: Record<StandardFieldName, string> = {
  invoiceNumber: '發票號碼',
  invoiceDate: '發票日期',
  dueDate: '到期日',
  vendorName: '供應商名稱',
  vendorAddress: '供應商地址',
  vendorTaxId: '供應商統編',
  buyerName: '買方名稱',
  buyerAddress: '買方地址',
  buyerTaxId: '買方統編',
  subtotal: '小計',
  taxAmount: '稅額',
  totalAmount: '總金額',
  currency: '幣別',
  paymentTerms: '付款條件',
  poNumber: 'PO 號碼',
  shipmentNumber: '貨運編號',
  containerNumber: '櫃號',
  blNumber: '提單號',
  portOfLoading: '裝貨港',
  portOfDischarge: '卸貨港',
  weight: '重量',
  volume: '體積',
  freightCharges: '運費',
  handlingFees: '處理費',
  customsDuty: '關稅',
  description: '描述',
  notes: '備註',
}
```

---

## 5. 服務層設計

### 5.1 ResultRetrievalService

```typescript
// lib/services/externalApi/resultRetrievalService.ts

import { prisma } from '@/lib/prisma'
import { ExternalApiKey } from '@prisma/client'
import {
  OutputFormat,
  TaskResultResponse,
  ExtractionField,
  ResultError,
  FieldValueResponse,
  DocumentDownloadResponse,
} from '@/lib/types/externalApi/result'
import { generateBlobSasUrl } from '@/lib/utils/azure/blobStorage'

/**
 * 結果獲取服務
 * 負責處理 API 結果的獲取、格式化與輸出
 */
export class ResultRetrievalService {
  /** 結果保留天數 */
  private readonly RESULT_RETENTION_DAYS = 30

  /**
   * 獲取任務處理結果
   * @param taskId 任務 ID
   * @param apiKey API Key 物件
   * @param format 輸出格式
   * @returns 結果或格式化內容
   */
  async getTaskResult(
    taskId: string,
    apiKey: ExternalApiKey,
    format: OutputFormat = 'json'
  ): Promise<{
    result?: TaskResultResponse
    content?: string
    contentType?: string
    error?: ResultError
  }> {
    // 1. 查詢任務及相關資料
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

    // 2. 驗證任務存在
    if (!task) {
      return {
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
          status: 404,
        },
      }
    }

    // 3. 權限驗證
    if (!this.hasAccess(task, apiKey)) {
      return {
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
          status: 404,
        },
      }
    }

    // 4. 檢查處理狀態
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

    // 5. 檢查結果是否過期
    if (this.isResultExpired(task.resultExpiresAt)) {
      return {
        error: {
          code: 'RESULT_EXPIRED',
          message: 'Result has expired and been archived. Contact support for retrieval.',
          status: 410,
        },
      }
    }

    // 6. 構建結果物件
    const result = this.buildTaskResult(task)

    // 7. 根據格式返回
    switch (format) {
      case 'csv':
        return {
          content: this.formatAsCSV(result),
          contentType: 'text/csv; charset=utf-8',
        }
      case 'xml':
        return {
          content: this.formatAsXML(result),
          contentType: 'application/xml; charset=utf-8',
        }
      default:
        return { result }
    }
  }

  /**
   * 獲取特定欄位值
   */
  async getFieldValue(
    taskId: string,
    fieldName: string,
    apiKey: ExternalApiKey
  ): Promise<{
    data?: FieldValueResponse
    error?: ResultError
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
      data: {
        fieldName: field.name,
        value: field.value,
        confidence: field.confidence,
      },
    }
  }

  /**
   * 獲取原始文件下載資訊
   */
  async getOriginalDocument(
    taskId: string,
    apiKey: ExternalApiKey
  ): Promise<{
    data?: DocumentDownloadResponse
    error?: ResultError
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

    if (!this.hasAccess(task, apiKey)) {
      return {
        error: {
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
          status: 404,
        },
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
    const downloadUrl = await generateBlobSasUrl(
      task.document.blobUrl,
      5 * 60 // 5 分鐘
    )

    return {
      data: {
        downloadUrl,
        fileName: task.originalFileName,
        mimeType: task.mimeType,
        expiresIn: 300,
      },
    }
  }

  /**
   * 批次獲取多個任務結果
   */
  async getTaskResults(
    taskIds: string[],
    apiKey: ExternalApiKey
  ): Promise<{
    results: Array<{
      taskId: string
      result?: TaskResultResponse
      error?: ResultError
    }>
  }> {
    const results = await Promise.all(
      taskIds.map(async (taskId) => {
        const { result, error } = await this.getTaskResult(taskId, apiKey, 'json')
        return { taskId, result, error }
      })
    )

    return { results }
  }

  // ==================== Private Methods ====================

  /**
   * 檢查 API Key 是否有權存取任務
   */
  private hasAccess(task: any, apiKey: ExternalApiKey): boolean {
    // 同一 API Key 建立的任務
    if (task.apiKeyId === apiKey.id) {
      return true
    }

    // 檢查城市權限
    const allowedCities = apiKey.allowedCities as string[]
    if (allowedCities.includes('*')) {
      return true
    }

    return allowedCities.includes(task.cityCode)
  }

  /**
   * 檢查結果是否已過期
   */
  private isResultExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) {
      return false
    }
    return expiresAt < new Date()
  }

  /**
   * 構建任務結果回應物件
   */
  private buildTaskResult(task: any): TaskResultResponse {
    const extractionResult = task.document?.extractionResult
    const fields = (extractionResult?.fields as ExtractionField[]) || []

    return {
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
  }

  /**
   * 標準化欄位（確保格式一致）
   */
  private normalizeFields(fields: ExtractionField[]): ExtractionField[] {
    return fields.map((field) => ({
      name: field.name,
      value: field.value,
      confidence: Math.round(field.confidence * 100) / 100,
      source: field.source,
      ...(field.boundingBox && { boundingBox: field.boundingBox }),
      ...(field.pageNumber !== undefined && { pageNumber: field.pageNumber }),
    }))
  }

  /**
   * 格式化為 CSV
   */
  private formatAsCSV(result: TaskResultResponse): string {
    const BOM = '\uFEFF' // UTF-8 BOM for Excel compatibility
    const headers = ['Field Name', 'Value', 'Confidence', 'Source']
    const rows = result.fields.map((field) => [
      this.escapeCSV(field.name),
      this.escapeCSV(String(field.value ?? '')),
      field.confidence.toFixed(2),
      field.source,
    ])

    return BOM + [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\r\n')
  }

  /**
   * CSV 值轉義
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  /**
   * 格式化為 XML
   */
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
      ${field.pageNumber !== undefined ? `<pageNumber>${field.pageNumber}</pageNumber>` : ''}
    </field>`
      )
      .join('')

    const forwarderXML = result.forwarder
      ? `
    <id>${escapeXML(result.forwarder.id)}</id>
    <name>${escapeXML(result.forwarder.name)}</name>
    <code>${escapeXML(result.forwarder.code)}</code>`
      : '<null/>'

    return `<?xml version="1.0" encoding="UTF-8"?>
<invoiceResult>
  <taskId>${escapeXML(result.taskId)}</taskId>
  <status>${result.status}</status>
  <forwarder>${forwarderXML}
  </forwarder>
  <fields>${fieldsXML}
  </fields>
  <metadata>
    <originalFileName>${escapeXML(result.metadata.originalFileName)}</originalFileName>
    <fileSize>${result.metadata.fileSize}</fileSize>
    <mimeType>${escapeXML(result.metadata.mimeType)}</mimeType>
    ${result.metadata.pageCount ? `<pageCount>${result.metadata.pageCount}</pageCount>` : ''}
    ${result.metadata.ocrEngine ? `<ocrEngine>${escapeXML(result.metadata.ocrEngine)}</ocrEngine>` : ''}
    ${result.metadata.aiModel ? `<aiModel>${escapeXML(result.metadata.aiModel)}</aiModel>` : ''}
    ${result.metadata.processingTime ? `<processingTime>${result.metadata.processingTime}</processingTime>` : ''}
  </metadata>
  <processedAt>${result.processedAt}</processedAt>
  <expiresAt>${result.expiresAt}</expiresAt>
</invoiceResult>`
  }
}

// 單例導出
export const resultRetrievalService = new ResultRetrievalService()
```

### 5.2 Azure Blob SAS URL 生成工具

```typescript
// lib/utils/azure/blobStorage.ts

import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'

/**
 * 生成 Blob SAS 下載 URL
 * @param blobUrl 原始 Blob URL
 * @param expiresInSeconds 有效期（秒）
 * @returns SAS URL
 */
export async function generateBlobSasUrl(
  blobUrl: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('Azure Storage connection string not configured')
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)

  // 解析 Blob URL
  const urlParts = new URL(blobUrl)
  const pathParts = urlParts.pathname.split('/').filter(Boolean)
  const containerName = pathParts[0]
  const blobName = pathParts.slice(1).join('/')

  // 獲取帳戶資訊
  const accountName = blobServiceClient.accountName
  const accountKey = extractAccountKey(connectionString)

  if (!accountKey) {
    throw new Error('Unable to extract account key from connection string')
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey)

  // 生成 SAS Token
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // 僅讀取
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
    },
    sharedKeyCredential
  ).toString()

  return `${blobUrl}?${sasToken}`
}

/**
 * 從連接字串提取 Account Key
 */
function extractAccountKey(connectionString: string): string | null {
  const match = connectionString.match(/AccountKey=([^;]+)/)
  return match ? match[1] : null
}
```

---

## 6. API 路由設計

### 6.1 結果獲取端點

```typescript
// app/api/v1/invoices/[taskId]/result/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resultRetrievalService, OutputFormat } from '@/lib/services/externalApi/resultRetrievalService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { rateLimitMiddleware } from '@/lib/middleware/rateLimitMiddleware'
import { generateTraceId } from '@/lib/utils/traceId'
import { logApiRequest } from '@/lib/services/externalApi/apiLogger'

// 格式驗證
const formatSchema = z.enum(['json', 'csv', 'xml']).optional().default('json')

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const traceId = generateTraceId()
  const startTime = Date.now()

  try {
    // 1. 認證驗證
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
            'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '60',
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    // 3. 解析並驗證格式參數
    const formatParam = request.nextUrl.searchParams.get('format') || 'json'
    const formatResult = formatSchema.safeParse(formatParam)

    if (!formatResult.success) {
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

    const format = formatResult.data as OutputFormat

    // 4. 獲取結果
    const response = await resultRetrievalService.getTaskResult(
      params.taskId,
      authResult.apiKey!,
      format
    )

    // 5. 記錄 API 請求
    await logApiRequest({
      apiKeyId: authResult.apiKey!.id,
      endpoint: `/api/v1/invoices/${params.taskId}/result`,
      method: 'GET',
      statusCode: response.error ? response.error.status : 200,
      responseTime: Date.now() - startTime,
      traceId,
    })

    // 6. 處理錯誤
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

    // 7. 返回結果
    if (response.content) {
      // CSV 或 XML 格式 - 直接返回檔案
      const filename = `invoice-result-${params.taskId}.${format}`
      return new NextResponse(response.content, {
        status: 200,
        headers: {
          'Content-Type': response.contentType!,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Trace-Id': traceId,
          'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '59',
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

    await logApiRequest({
      apiKeyId: 'unknown',
      endpoint: `/api/v1/invoices/${params.taskId}/result`,
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      traceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

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

### 6.2 欄位查詢端點

```typescript
// app/api/v1/invoices/[taskId]/result/fields/[fieldName]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { resultRetrievalService } from '@/lib/services/externalApi/resultRetrievalService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { generateTraceId } from '@/lib/utils/traceId'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string; fieldName: string } }
) {
  const traceId = generateTraceId()

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

    // 2. 解碼欄位名稱（支援 URL 編碼）
    const fieldName = decodeURIComponent(params.fieldName)

    // 3. 獲取欄位值
    const response = await resultRetrievalService.getFieldValue(
      params.taskId,
      fieldName,
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
        data: response.data,
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

### 6.3 文件下載端點

```typescript
// app/api/v1/invoices/[taskId]/document/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { resultRetrievalService } from '@/lib/services/externalApi/resultRetrievalService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { generateTraceId } from '@/lib/utils/traceId'

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const traceId = generateTraceId()

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

    // 2. 獲取文件下載資訊
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

    // 3. 返回下載資訊（不直接重導向，讓客戶端決定）
    return NextResponse.json(
      {
        data: response.data,
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

### 6.4 批次結果獲取端點

```typescript
// app/api/v1/invoices/batch-results/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resultRetrievalService } from '@/lib/services/externalApi/resultRetrievalService'
import { externalApiAuthMiddleware } from '@/lib/middleware/externalApiAuthMiddleware'
import { generateTraceId } from '@/lib/utils/traceId'

// 請求驗證
const batchResultsSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(50),
})

export async function POST(request: NextRequest) {
  const traceId = generateTraceId()

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

    // 2. 解析請求
    const body = await request.json()
    const validationResult = batchResultsSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request body',
            details: validationResult.error.errors,
          },
          traceId,
        },
        { status: 400 }
      )
    }

    // 3. 批次獲取結果
    const response = await resultRetrievalService.getTaskResults(
      validationResult.data.taskIds,
      authResult.apiKey!
    )

    // 4. 格式化回應
    const formattedResults = response.results.map((item) => ({
      taskId: item.taskId,
      ...(item.result ? { data: item.result } : {}),
      ...(item.error ? { error: { code: item.error.code, message: item.error.message } } : {}),
    }))

    return NextResponse.json(
      {
        data: {
          results: formattedResults,
          summary: {
            total: response.results.length,
            success: response.results.filter((r) => r.result).length,
            failed: response.results.filter((r) => r.error).length,
          },
        },
        traceId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Batch results error:', error)
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

---

## 7. 前端組件（測試用）

### 7.1 結果檢視器組件

```typescript
// components/api-test/ResultViewer.tsx

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExtractionField {
  name: string
  value: string | number | null
  confidence: number
  source: string
}

interface TaskResult {
  taskId: string
  status: string
  forwarder: { id: string; name: string; code: string } | null
  fields: ExtractionField[]
  metadata: {
    originalFileName: string
    fileSize: number
    mimeType: string
    pageCount?: number
  }
  processedAt: string
  expiresAt: string
}

type OutputFormat = 'json' | 'csv' | 'xml'

export function ResultViewer() {
  const [apiKey, setApiKey] = useState('')
  const [taskId, setTaskId] = useState('')
  const [format, setFormat] = useState<OutputFormat>('json')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TaskResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 獲取結果
  const fetchResult = async () => {
    if (!apiKey || !taskId) {
      setError('請輸入 API Key 和 Task ID')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(
        `/api/v1/invoices/${taskId}/result?format=${format}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      )

      if (format !== 'json') {
        // CSV 或 XML - 直接下載
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `result-${taskId}.${format}`
          a.click()
          URL.revokeObjectURL(url)
        } else {
          const data = await response.json()
          setError(data.error?.message || '獲取結果失敗')
        }
      } else {
        // JSON - 顯示結果
        const data = await response.json()
        if (response.ok) {
          setResult(data.data)
        } else {
          setError(data.error?.message || '獲取結果失敗')
        }
      }
    } catch (err) {
      setError('網路錯誤，請稍後重試')
    } finally {
      setLoading(false)
    }
  }

  // 下載原始文件
  const downloadDocument = async () => {
    if (!apiKey || !taskId) return

    try {
      const response = await fetch(`/api/v1/invoices/${taskId}/document`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      const data = await response.json()

      if (response.ok) {
        window.open(data.data.downloadUrl, '_blank')
      } else {
        setError(data.error?.message || '下載失敗')
      }
    } catch (err) {
      setError('網路錯誤')
    }
  }

  // 獲取信心度顏色
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800'
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          API 結果檢視器
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 輸入區 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="輸入 API Key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taskId">Task ID</Label>
            <Input
              id="taskId"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="輸入任務 ID"
            />
          </div>
        </div>

        {/* 格式選擇 */}
        <div className="flex items-center gap-4">
          <div className="space-y-2">
            <Label>輸出格式</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as OutputFormat)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xml">XML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={fetchResult} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              獲取結果
            </Button>

            {result && (
              <Button variant="outline" onClick={downloadDocument}>
                <Download className="h-4 w-4 mr-2" />
                下載原始文件
              </Button>
            )}
          </div>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 結果顯示 */}
        {result && (
          <div className="space-y-4">
            {/* 基本資訊 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Task ID</Label>
                <p className="font-mono text-sm">{result.taskId}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">狀態</Label>
                <Badge variant="default">{result.status}</Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">Forwarder</Label>
                <p>{result.forwarder?.name || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">處理時間</Label>
                <p>{new Date(result.processedAt).toLocaleString()}</p>
              </div>
            </div>

            {/* 欄位列表 */}
            <div>
              <Label className="text-muted-foreground mb-2 block">
                提取欄位 ({result.fields.length})
              </Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">欄位名稱</th>
                      <th className="text-left p-2">值</th>
                      <th className="text-left p-2">信心度</th>
                      <th className="text-left p-2">來源</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.fields.map((field, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2 font-medium">{field.name}</td>
                        <td className="p-2">{field.value ?? '-'}</td>
                        <td className="p-2">
                          <Badge
                            variant="secondary"
                            className={cn(getConfidenceColor(field.confidence))}
                          >
                            {(field.confidence * 100).toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline">{field.source}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 元數據 */}
            <div className="text-sm text-muted-foreground">
              <p>檔案: {result.metadata.originalFileName}</p>
              <p>大小: {(result.metadata.fileSize / 1024).toFixed(1)} KB</p>
              {result.metadata.pageCount && <p>頁數: {result.metadata.pageCount}</p>}
              <p>過期時間: {new Date(result.expiresAt).toLocaleString()}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 8. 測試計劃

### 8.1 單元測試

```typescript
// __tests__/services/externalApi/resultRetrievalService.test.ts

import { resultRetrievalService } from '@/lib/services/externalApi/resultRetrievalService'
import { prismaMock } from '@/lib/__mocks__/prisma'

describe('ResultRetrievalService', () => {
  const mockApiKey = {
    id: 'key-1',
    allowedCities: ['*'],
  } as any

  describe('getTaskResult', () => {
    it('應返回已完成任務的完整結果', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        originalFileName: 'invoice.pdf',
        fileSize: 102400,
        mimeType: 'application/pdf',
        completedAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        resultExpiresAt: new Date('2024-02-14'),
        cityCode: 'TPE',
        document: {
          pageCount: 2,
          extractionResult: {
            forwarder: {
              id: 'fw-1',
              name: 'Test Forwarder',
              code: 'TF',
            },
            fields: [
              { name: 'invoiceNumber', value: 'INV-001', confidence: 0.95, source: 'ai' },
              { name: 'totalAmount', value: 15000, confidence: 0.88, source: 'ai' },
            ],
            ocrEngine: 'azure-ocr',
            aiModel: 'gpt-4o',
            processingTime: 5200,
          },
        },
      } as any)

      const response = await resultRetrievalService.getTaskResult(
        'task-123',
        mockApiKey,
        'json'
      )

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      expect(response.result?.taskId).toBe('task-123')
      expect(response.result?.status).toBe('completed')
      expect(response.result?.forwarder?.code).toBe('TF')
      expect(response.result?.fields).toHaveLength(2)
      expect(response.result?.metadata.ocrEngine).toBe('azure-ocr')
    })

    it('任務不存在時應返回 404', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue(null)

      const response = await resultRetrievalService.getTaskResult(
        'non-existent',
        mockApiKey,
        'json'
      )

      expect(response.error).toBeDefined()
      expect(response.error?.status).toBe(404)
      expect(response.error?.code).toBe('TASK_NOT_FOUND')
    })

    it('任務未完成時應返回 409', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
        apiKeyId: 'key-1',
        status: 'PROCESSING',
        cityCode: 'TPE',
      } as any)

      const response = await resultRetrievalService.getTaskResult(
        'task-123',
        mockApiKey,
        'json'
      )

      expect(response.error).toBeDefined()
      expect(response.error?.status).toBe(409)
      expect(response.error?.code).toBe('RESULT_NOT_READY')
      expect(response.error?.currentStatus).toBe('processing')
    })

    it('結果已過期時應返回 410', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
        apiKeyId: 'key-1',
        status: 'COMPLETED',
        resultExpiresAt: new Date('2023-01-01'), // 已過期
        cityCode: 'TPE',
      } as any)

      const response = await resultRetrievalService.getTaskResult(
        'task-123',
        mockApiKey,
        'json'
      )

      expect(response.error).toBeDefined()
      expect(response.error?.status).toBe(410)
      expect(response.error?.code).toBe('RESULT_EXPIRED')
    })

    it('應正確格式化 CSV 輸出', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
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
              { name: 'amount', value: 1000, confidence: 0.88, source: 'ocr' },
            ],
          },
        },
      } as any)

      const response = await resultRetrievalService.getTaskResult(
        'task-123',
        mockApiKey,
        'csv'
      )

      expect(response.content).toBeDefined()
      expect(response.contentType).toContain('text/csv')
      expect(response.content).toContain('Field Name,Value,Confidence,Source')
      expect(response.content).toContain('invoiceNumber,INV-001,0.95,ai')
      expect(response.content).toContain('amount,1000,0.88,ocr')
    })

    it('應正確格式化 XML 輸出', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
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
            forwarder: { id: 'fw-1', name: 'Forwarder A', code: 'FA' },
            fields: [
              { name: 'invoiceNumber', value: 'INV-001', confidence: 0.95, source: 'ai' },
            ],
          },
        },
      } as any)

      const response = await resultRetrievalService.getTaskResult(
        'task-123',
        mockApiKey,
        'xml'
      )

      expect(response.content).toBeDefined()
      expect(response.contentType).toContain('application/xml')
      expect(response.content).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(response.content).toContain('<invoiceResult>')
      expect(response.content).toContain('<name>invoiceNumber</name>')
      expect(response.content).toContain('<code>FA</code>')
    })

    it('CSV 應正確處理包含逗號和引號的值', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
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
              { name: 'description', value: 'Item A, Item B', confidence: 0.9, source: 'ai' },
              { name: 'notes', value: 'Contains "quotes"', confidence: 0.85, source: 'ai' },
            ],
          },
        },
      } as any)

      const response = await resultRetrievalService.getTaskResult(
        'task-123',
        mockApiKey,
        'csv'
      )

      expect(response.content).toContain('"Item A, Item B"')
      expect(response.content).toContain('"Contains ""quotes"""')
    })
  })

  describe('getFieldValue', () => {
    it('應返回特定欄位的值', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
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
              { name: 'totalAmount', value: 15000, confidence: 0.88, source: 'ai' },
            ],
          },
        },
      } as any)

      const response = await resultRetrievalService.getFieldValue(
        'task-123',
        'invoiceNumber',
        mockApiKey
      )

      expect(response.error).toBeUndefined()
      expect(response.data).toBeDefined()
      expect(response.data?.fieldName).toBe('invoiceNumber')
      expect(response.data?.value).toBe('INV-001')
      expect(response.data?.confidence).toBe(0.95)
    })

    it('欄位不存在時應返回 404', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
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

      const response = await resultRetrievalService.getFieldValue(
        'task-123',
        'nonExistentField',
        mockApiKey
      )

      expect(response.error).toBeDefined()
      expect(response.error?.status).toBe(404)
      expect(response.error?.code).toBe('FIELD_NOT_FOUND')
    })
  })

  describe('getOriginalDocument', () => {
    it('應返回文件下載資訊', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
        apiKeyId: 'key-1',
        originalFileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        cityCode: 'TPE',
        document: {
          blobUrl: 'https://storage.blob.core.windows.net/documents/invoice.pdf',
        },
      } as any)

      // Mock SAS URL 生成
      jest.mock('@/lib/utils/azure/blobStorage', () => ({
        generateBlobSasUrl: jest.fn().mockResolvedValue(
          'https://storage.blob.core.windows.net/documents/invoice.pdf?sas=token'
        ),
      }))

      const response = await resultRetrievalService.getOriginalDocument(
        'task-123',
        mockApiKey
      )

      expect(response.data).toBeDefined()
      expect(response.data?.fileName).toBe('invoice.pdf')
      expect(response.data?.mimeType).toBe('application/pdf')
      expect(response.data?.expiresIn).toBe(300)
    })

    it('文件不可用時應返回 404', async () => {
      prismaMock.externalApiTask.findUnique.mockResolvedValue({
        taskId: 'task-123',
        apiKeyId: 'key-1',
        cityCode: 'TPE',
        document: {
          blobUrl: null,
        },
      } as any)

      const response = await resultRetrievalService.getOriginalDocument(
        'task-123',
        mockApiKey
      )

      expect(response.error).toBeDefined()
      expect(response.error?.status).toBe(404)
      expect(response.error?.code).toBe('DOCUMENT_NOT_AVAILABLE')
    })
  })

  describe('getTaskResults (批次)', () => {
    it('應批次返回多個任務結果', async () => {
      prismaMock.externalApiTask.findUnique
        .mockResolvedValueOnce({
          taskId: 'task-1',
          apiKeyId: 'key-1',
          status: 'COMPLETED',
          originalFileName: 'invoice1.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          completedAt: new Date(),
          updatedAt: new Date(),
          resultExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cityCode: 'TPE',
          document: {
            extractionResult: {
              fields: [{ name: 'invoiceNumber', value: 'INV-001', confidence: 0.9, source: 'ai' }],
            },
          },
        } as any)
        .mockResolvedValueOnce(null) // 第二個任務不存在

      const response = await resultRetrievalService.getTaskResults(
        ['task-1', 'task-2'],
        mockApiKey
      )

      expect(response.results).toHaveLength(2)
      expect(response.results[0].result).toBeDefined()
      expect(response.results[1].error).toBeDefined()
      expect(response.results[1].error?.code).toBe('TASK_NOT_FOUND')
    })
  })
})
```

### 8.2 API 整合測試

```typescript
// __tests__/api/v1/invoices/[taskId]/result.test.ts

import { GET } from '@/app/api/v1/invoices/[taskId]/result/route'
import { createMockRequest } from '@/lib/test-utils/mockRequest'

describe('GET /api/v1/invoices/{taskId}/result', () => {
  it('應返回 JSON 格式結果', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-api-key',
      },
    })

    const response = await GET(request, { params: { taskId: 'task-123' } })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data.taskId).toBe('task-123')
    expect(data.data.fields).toBeDefined()
    expect(data.traceId).toBeDefined()
  })

  it('format=csv 時應返回 CSV 檔案', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-api-key',
      },
      url: '/api/v1/invoices/task-123/result?format=csv',
    })

    const response = await GET(request, { params: { taskId: 'task-123' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
  })

  it('format=xml 時應返回 XML 檔案', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-api-key',
      },
      url: '/api/v1/invoices/task-123/result?format=xml',
    })

    const response = await GET(request, { params: { taskId: 'task-123' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/xml')
  })

  it('無效格式應返回 400', async () => {
    const request = createMockRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-api-key',
      },
      url: '/api/v1/invoices/task-123/result?format=invalid',
    })

    const response = await GET(request, { params: { taskId: 'task-123' } })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error.code).toBe('INVALID_FORMAT')
  })

  it('未認證請求應返回 401', async () => {
    const request = createMockRequest({
      method: 'GET',
    })

    const response = await GET(request, { params: { taskId: 'task-123' } })

    expect(response.status).toBe(401)
  })
})
```

---

## 9. 實作注意事項

### 9.1 信心度值標準化
- 信心度值統一為 0-1 之間的小數
- 輸出時四捨五入到小數點後兩位
- 前端顯示時可轉換為百分比

### 9.2 特殊字元處理
- CSV 輸出需正確處理逗號、引號、換行符
- XML 輸出需正確轉義 `<`, `>`, `&`, `"`, `'`
- 檔案名稱需符合 Content-Disposition 規範

### 9.3 大型結果處理
- 欄位數量超過 100 時考慮分頁
- CSV/XML 輸出使用串流處理避免記憶體溢出
- 設定合理的響應超時時間

### 9.4 安全考量
- SAS URL 僅授予讀取權限
- SAS URL 有效期限制為 5 分鐘
- 原始文件存取需經過權限驗證

---

## 10. 部署注意事項

### 10.1 環境變數
```bash
# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=xxx
AZURE_STORAGE_CONTAINER_NAME=documents

# 結果保留設定
RESULT_RETENTION_DAYS=30
```

### 10.2 結果過期處理
- 設定排程任務清理過期結果
- 過期結果可選擇歸檔到冷儲存
- 提供管理介面恢復已歸檔結果

### 10.3 監控指標
| 指標 | 說明 | 告警閾值 |
|------|------|----------|
| result_retrieval_success_rate | 結果獲取成功率 | < 99% |
| result_retrieval_latency_p95 | P95 回應時間 | > 500ms |
| format_distribution | 各格式使用分佈 | - |
| expired_result_access_count | 過期結果存取次數 | > 100/day |

### 10.4 快取策略
- 完成狀態的結果可快取
- 快取 TTL 設為 5 分鐘
- 使用 ETag 支援條件式請求

---

## 11. 相依性

### 11.1 內部相依
| 相依項目 | 說明 |
|----------|------|
| Story 11-1 | 任務提交建立 ExternalApiTask |
| Story 11-2 | 狀態查詢確認任務完成 |
| Story 11-5 | 認證中間件 externalApiAuthMiddleware |
| Story 2-4 | 欄位映射產生 ExtractionResult |

### 11.2 外部相依
| 相依項目 | 版本 | 說明 |
|----------|------|------|
| @azure/storage-blob | ^12.17.0 | SAS URL 生成 |
| zod | ^3.22.0 | 請求參數驗證 |

### 11.3 API 端點摘要
| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/v1/invoices/{taskId}/result` | GET | 獲取處理結果 |
| `/api/v1/invoices/{taskId}/result/fields/{fieldName}` | GET | 獲取特定欄位 |
| `/api/v1/invoices/{taskId}/document` | GET | 獲取原始文件下載資訊 |
| `/api/v1/invoices/batch-results` | POST | 批次獲取結果 |
