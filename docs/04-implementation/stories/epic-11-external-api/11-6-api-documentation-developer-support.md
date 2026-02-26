# Story 11-6: API 文檔與開發者支援

## Story 資訊

- **Epic**: 11 - 對外 API 服務
- **功能需求**: FR64, FR65, FR66 (整合文檔)
- **優先級**: Medium
- **故事點數**: 5
- **相關 Stories**:
  - Story 11-1 (API 發票提交端點)
  - Story 11-2 (API 處理狀態查詢端點)
  - Story 11-3 (API 處理結果獲取端點)
  - Story 11-4 (Webhook 通知服務)
  - Story 11-5 (API 訪問控制與認證)

## 使用者故事

**As a** 外部系統開發者,
**I want** 查閱完整的 API 文檔,
**So that** 我可以快速整合發票處理功能。

## 驗收標準

### AC1: 互動式 API 文檔

**Given** 開發者需要了解 API
**When** 訪問 `/api/docs` 端點
**Then** 顯示互動式 API 文檔（Swagger UI）：
- 所有端點的詳細說明
- 請求/回應範例
- 可以直接測試 API（需要 API Key）

### AC2: 完整端點說明

**Given** API 文檔
**When** 查看端點說明
**Then** 包含：
- 端點 URL 和方法
- 請求參數說明
- 回應格式和狀態碼
- 錯誤代碼列表
- 使用範例（cURL, JavaScript, Python）

### AC3: 多語言整合範例

**Given** 開發者需要範例代碼
**When** 查看文檔
**Then** 提供以下語言的整合範例：
- JavaScript/TypeScript
- Python
- C#
**And** 包含完整的錯誤處理範例

## 技術規格

### 1. OpenAPI 3.0 規格文件

```yaml
# openapi/spec.yaml
openapi: 3.0.3
info:
  title: Invoice Extraction API
  description: |
    AI-powered invoice extraction API for automated document processing.

    ## Authentication
    All API requests require a valid API key passed in the Authorization header:
    ```
    Authorization: Bearer {your_api_key}
    ```

    ## Rate Limiting
    API requests are rate-limited per API key. Default limit is 60 requests per minute.
    When rate limited, you'll receive a 429 response with a `Retry-After` header.

    ## Webhooks
    Configure callback URLs to receive real-time notifications when processing completes.
    All webhook requests include HMAC-SHA256 signatures for verification.

  version: 1.0.0
  contact:
    name: API Support
    email: api-support@example.com
  license:
    name: Proprietary
    url: https://example.com/terms

servers:
  - url: https://api.example.com/api/v1
    description: Production server
  - url: https://staging-api.example.com/api/v1
    description: Staging server

tags:
  - name: Invoices
    description: Invoice submission and processing operations
  - name: Status
    description: Task status and progress tracking
  - name: Results
    description: Extraction results retrieval
  - name: Webhooks
    description: Webhook delivery management

paths:
  /invoices:
    post:
      tags:
        - Invoices
      summary: Submit invoice for processing
      description: |
        Submit an invoice document for AI extraction. Supports multiple submission methods:
        - Direct file upload (multipart/form-data)
        - Base64 encoded content
        - URL reference to external file
      operationId: submitInvoice
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required:
                - file
                - params
              properties:
                file:
                  type: string
                  format: binary
                  description: Invoice file (PDF, PNG, JPG, TIFF)
                params:
                  type: string
                  description: JSON string with submission parameters
            example:
              params: '{"cityCode": "TPE", "priority": "normal"}'
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/Base64Submission'
                - $ref: '#/components/schemas/UrlSubmission'
      responses:
        '202':
          description: Invoice accepted for processing
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SubmissionResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimited'
        '500':
          $ref: '#/components/responses/InternalError'

    get:
      tags:
        - Status
      summary: List submitted tasks
      description: Retrieve a paginated list of submitted invoice tasks
      operationId: listTasks
      security:
        - BearerAuth: []
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [queued, processing, completed, failed, review_required]
          description: Filter by task status
        - name: cityCode
          in: query
          schema:
            type: string
          description: Filter by city code
        - name: startDate
          in: query
          schema:
            type: string
            format: date-time
          description: Filter by start date
        - name: endDate
          in: query
          schema:
            type: string
            format: date-time
          description: Filter by end date
        - name: page
          in: query
          schema:
            type: integer
            default: 1
          description: Page number
        - name: pageSize
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
          description: Items per page
      responses:
        '200':
          description: List of tasks
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskListResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /invoices/{taskId}/status:
    get:
      tags:
        - Status
      summary: Get task status
      description: Retrieve the current processing status of a submitted task
      operationId: getTaskStatus
      security:
        - BearerAuth: []
      parameters:
        - $ref: '#/components/parameters/TaskId'
      responses:
        '200':
          description: Task status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskStatusResponse'
        '404':
          $ref: '#/components/responses/NotFound'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /invoices/{taskId}/result:
    get:
      tags:
        - Results
      summary: Get extraction result
      description: |
        Retrieve the complete extraction result for a completed task.
        Supports multiple output formats: JSON, CSV, XML.
      operationId: getTaskResult
      security:
        - BearerAuth: []
      parameters:
        - $ref: '#/components/parameters/TaskId'
        - name: format
          in: query
          schema:
            type: string
            enum: [json, csv, xml]
            default: json
          description: Output format
      responses:
        '200':
          description: Extraction result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExtractionResultResponse'
            text/csv:
              schema:
                type: string
            application/xml:
              schema:
                type: string
        '409':
          description: Task not completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '410':
          description: Result expired
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          $ref: '#/components/responses/NotFound'

  /invoices/batch-status:
    post:
      tags:
        - Status
      summary: Batch status query
      description: Query status for multiple tasks in a single request (max 100)
      operationId: batchStatus
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - taskIds
              properties:
                taskIds:
                  type: array
                  items:
                    type: string
                  maxItems: 100
                  description: List of task IDs to query
      responses:
        '200':
          description: Batch status results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchStatusResponse'

  /webhooks:
    get:
      tags:
        - Webhooks
      summary: Get webhook delivery history
      description: Retrieve webhook delivery history for a specific task
      operationId: getWebhookHistory
      security:
        - BearerAuth: []
      parameters:
        - name: taskId
          in: query
          required: true
          schema:
            type: string
          description: Task ID to get webhook history for
      responses:
        '200':
          description: Webhook delivery history
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WebhookHistoryResponse'

  /webhooks/{deliveryId}/retry:
    post:
      tags:
        - Webhooks
      summary: Retry webhook delivery
      description: Manually retry a failed webhook delivery
      operationId: retryWebhook
      security:
        - BearerAuth: []
      parameters:
        - name: deliveryId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Retry initiated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      deliveryId:
                        type: string
                      message:
                        type: string

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      description: API key authentication

  parameters:
    TaskId:
      name: taskId
      in: path
      required: true
      schema:
        type: string
      description: Unique task identifier

  schemas:
    Base64Submission:
      type: object
      required:
        - type
        - content
        - fileName
        - mimeType
        - cityCode
      properties:
        type:
          type: string
          enum: [base64]
        content:
          type: string
          description: Base64 encoded file content
        fileName:
          type: string
          description: Original file name
        mimeType:
          type: string
          enum: [application/pdf, image/png, image/jpeg, image/tiff]
        cityCode:
          type: string
          description: City code for processing
        priority:
          type: string
          enum: [normal, high]
          default: normal
        callbackUrl:
          type: string
          format: uri
          description: Webhook callback URL
        metadata:
          type: object
          additionalProperties: true
          description: Custom metadata

    UrlSubmission:
      type: object
      required:
        - type
        - url
        - cityCode
      properties:
        type:
          type: string
          enum: [url]
        url:
          type: string
          format: uri
          description: URL to fetch file from
        fileName:
          type: string
          description: Optional file name
        cityCode:
          type: string
        priority:
          type: string
          enum: [normal, high]
          default: normal
        callbackUrl:
          type: string
          format: uri
        metadata:
          type: object
          additionalProperties: true

    SubmissionResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            taskId:
              type: string
              description: Unique task identifier
            status:
              type: string
              enum: [queued]
            estimatedProcessingTime:
              type: integer
              description: Estimated processing time in seconds
            statusUrl:
              type: string
              description: URL to check task status
            createdAt:
              type: string
              format: date-time
        traceId:
          type: string

    TaskStatusResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            taskId:
              type: string
            status:
              type: string
              enum: [queued, processing, completed, failed, review_required]
            progress:
              type: integer
              minimum: 0
              maximum: 100
            currentStep:
              type: string
            createdAt:
              type: string
              format: date-time
            updatedAt:
              type: string
              format: date-time
            estimatedCompletion:
              type: string
              format: date-time
            resultUrl:
              type: string
              description: Available when status is completed
            completedAt:
              type: string
              format: date-time
            confidenceScore:
              type: number
              minimum: 0
              maximum: 1
            error:
              type: object
              properties:
                code:
                  type: string
                message:
                  type: string
                retryable:
                  type: boolean
        traceId:
          type: string

    ExtractionResultResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            taskId:
              type: string
            status:
              type: string
            forwarder:
              type: object
              nullable: true
              properties:
                id:
                  type: string
                name:
                  type: string
                code:
                  type: string
            fields:
              type: array
              items:
                $ref: '#/components/schemas/ExtractionField'
            metadata:
              type: object
              properties:
                originalFileName:
                  type: string
                fileSize:
                  type: integer
                mimeType:
                  type: string
                pageCount:
                  type: integer
            processedAt:
              type: string
              format: date-time
            expiresAt:
              type: string
              format: date-time
        traceId:
          type: string

    ExtractionField:
      type: object
      properties:
        name:
          type: string
          description: Field name
        value:
          oneOf:
            - type: string
            - type: number
            - type: 'null'
          description: Extracted value
        confidence:
          type: number
          minimum: 0
          maximum: 1
          description: Confidence score
        source:
          type: string
          enum: [ocr, ai, rule, manual]
          description: Extraction source

    TaskListResponse:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/TaskStatusResponse/properties/data'
        pagination:
          type: object
          properties:
            page:
              type: integer
            pageSize:
              type: integer
            total:
              type: integer
            totalPages:
              type: integer
        traceId:
          type: string

    BatchStatusResponse:
      type: object
      properties:
        data:
          type: object
          additionalProperties:
            oneOf:
              - $ref: '#/components/schemas/TaskStatusResponse/properties/data'
              - type: object
                properties:
                  error:
                    type: object
                    properties:
                      code:
                        type: string
                      message:
                        type: string
        traceId:
          type: string

    WebhookHistoryResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            deliveries:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: string
                  event:
                    type: string
                  status:
                    type: string
                    enum: [pending, sending, delivered, failed, retrying]
                  httpStatus:
                    type: integer
                  attempts:
                    type: integer
                  createdAt:
                    type: string
                    format: date-time
                  completedAt:
                    type: string
                    format: date-time
            total:
              type: integer
        traceId:
          type: string

    ErrorResponse:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: array
              items:
                type: object
        traceId:
          type: string

  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: VALIDATION_ERROR
              message: Invalid request parameters
            traceId: api_123456789_abc

    Unauthorized:
      description: Authentication failed
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: INVALID_API_KEY
              message: Invalid API key
            traceId: api_123456789_abc

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: TASK_NOT_FOUND
              message: Task not found
            traceId: api_123456789_abc

    RateLimited:
      description: Rate limit exceeded
      headers:
        Retry-After:
          schema:
            type: integer
          description: Seconds until rate limit resets
        X-RateLimit-Limit:
          schema:
            type: integer
          description: Request limit per minute
        X-RateLimit-Remaining:
          schema:
            type: integer
          description: Remaining requests
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: RATE_LIMIT_EXCEEDED
              message: Too many requests
            traceId: api_123456789_abc

    InternalError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: INTERNAL_ERROR
              message: An unexpected error occurred
            traceId: api_123456789_abc
```

### 2. Swagger UI 配置

```typescript
// app/api/docs/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // 重定向到 Swagger UI 頁面
  return NextResponse.redirect(new URL('/docs', request.url))
}
```

```typescript
// app/docs/page.tsx
'use client'

import { useEffect, useRef } from 'react'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-4">Invoice Extraction API Documentation</h1>
        <p className="text-gray-600 mb-8">
          Interactive API documentation. Use your API key to test endpoints directly.
        </p>

        <SwaggerUI
          url="/api/openapi"
          docExpansion="list"
          defaultModelsExpandDepth={1}
          persistAuthorization={true}
          tryItOutEnabled={true}
        />
      </div>
    </div>
  )
}
```

```typescript
// app/api/openapi/route.ts
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export async function GET() {
  const specPath = path.join(process.cwd(), 'openapi', 'spec.yaml')
  const specContent = fs.readFileSync(specPath, 'utf-8')
  const spec = yaml.load(specContent)

  return NextResponse.json(spec)
}
```

### 3. 代碼範例文檔

```typescript
// docs/examples/javascript-sdk.ts
/**
 * Invoice Extraction API - JavaScript/TypeScript SDK Example
 */

interface ApiConfig {
  baseUrl: string
  apiKey: string
}

interface SubmitOptions {
  cityCode: string
  priority?: 'normal' | 'high'
  callbackUrl?: string
  metadata?: Record<string, any>
}

interface TaskStatus {
  taskId: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'review_required'
  progress: number
  currentStep?: string
  estimatedCompletion?: string
  resultUrl?: string
  error?: {
    code: string
    message: string
    retryable: boolean
  }
}

interface ExtractionResult {
  taskId: string
  forwarder: { id: string; name: string; code: string } | null
  fields: Array<{
    name: string
    value: string | number | null
    confidence: number
    source: 'ocr' | 'ai' | 'rule' | 'manual'
  }>
  metadata: {
    originalFileName: string
    fileSize: number
    mimeType: string
  }
  processedAt: string
}

class InvoiceExtractionClient {
  private baseUrl: string
  private apiKey: string

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl
    this.apiKey = config.apiKey
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.error?.code || 'UNKNOWN_ERROR',
        data.error?.message || 'An error occurred',
        response.status,
        data.traceId
      )
    }

    return data.data
  }

  /**
   * Submit an invoice for processing
   */
  async submitInvoice(
    file: File | Buffer | string,
    options: SubmitOptions
  ): Promise<{ taskId: string; statusUrl: string }> {
    // Handle different input types
    if (file instanceof File) {
      // File upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('params', JSON.stringify(options))

      const response = await fetch(`${this.baseUrl}/invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new ApiError(
          data.error?.code,
          data.error?.message,
          response.status,
          data.traceId
        )
      }

      return data.data
    } else if (Buffer.isBuffer(file)) {
      // Base64 content
      return this.request('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          type: 'base64',
          content: file.toString('base64'),
          fileName: 'invoice.pdf',
          mimeType: 'application/pdf',
          ...options,
        }),
      })
    } else if (typeof file === 'string' && file.startsWith('http')) {
      // URL reference
      return this.request('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          type: 'url',
          url: file,
          ...options,
        }),
      })
    }

    throw new Error('Invalid file input')
  }

  /**
   * Get task status
   */
  async getStatus(taskId: string): Promise<TaskStatus> {
    return this.request(`/invoices/${taskId}/status`)
  }

  /**
   * Wait for task completion with polling
   */
  async waitForCompletion(
    taskId: string,
    options: { timeout?: number; pollInterval?: number } = {}
  ): Promise<TaskStatus> {
    const { timeout = 300000, pollInterval = 5000 } = options
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus(taskId)

      if (['completed', 'failed', 'review_required'].includes(status.status)) {
        return status
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Timeout waiting for task ${taskId}`)
  }

  /**
   * Get extraction result
   */
  async getResult(
    taskId: string,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<ExtractionResult | string> {
    if (format === 'json') {
      return this.request(`/invoices/${taskId}/result`)
    }

    const response = await fetch(
      `${this.baseUrl}/invoices/${taskId}/result?format=${format}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new ApiError(
        data.error?.code,
        data.error?.message,
        response.status,
        data.traceId
      )
    }

    return response.text()
  }

  /**
   * Batch status query
   */
  async batchStatus(taskIds: string[]): Promise<Record<string, TaskStatus>> {
    return this.request('/invoices/batch-status', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    })
  }
}

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public traceId?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Usage example
async function main() {
  const client = new InvoiceExtractionClient({
    baseUrl: 'https://api.example.com/api/v1',
    apiKey: 'your-api-key',
  })

  try {
    // Submit invoice
    const submission = await client.submitInvoice(
      'https://example.com/invoice.pdf',
      {
        cityCode: 'TPE',
        priority: 'normal',
        callbackUrl: 'https://your-app.com/webhook',
      }
    )

    console.log('Submitted:', submission.taskId)

    // Wait for completion
    const status = await client.waitForCompletion(submission.taskId)

    if (status.status === 'completed') {
      // Get result
      const result = await client.getResult(submission.taskId)
      console.log('Extraction result:', result)
    } else if (status.status === 'failed') {
      console.error('Processing failed:', status.error)
    }
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error [${error.code}]: ${error.message}`)
      console.error(`Trace ID: ${error.traceId}`)
    } else {
      throw error
    }
  }
}

export { InvoiceExtractionClient, ApiError }
```

```python
# docs/examples/python_sdk.py
"""
Invoice Extraction API - Python SDK Example
"""

import time
import base64
import hashlib
import hmac
from typing import Optional, Dict, Any, Union, Literal
from dataclasses import dataclass
import requests


@dataclass
class ApiConfig:
    base_url: str
    api_key: str


@dataclass
class TaskStatus:
    task_id: str
    status: str
    progress: int
    current_step: Optional[str] = None
    estimated_completion: Optional[str] = None
    result_url: Optional[str] = None
    confidence_score: Optional[float] = None
    error: Optional[Dict[str, Any]] = None


@dataclass
class ExtractionField:
    name: str
    value: Union[str, int, float, None]
    confidence: float
    source: str


@dataclass
class ExtractionResult:
    task_id: str
    forwarder: Optional[Dict[str, str]]
    fields: list[ExtractionField]
    metadata: Dict[str, Any]
    processed_at: str


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int, trace_id: Optional[str] = None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.trace_id = trace_id


class InvoiceExtractionClient:
    def __init__(self, config: ApiConfig):
        self.base_url = config.base_url
        self.api_key = config.api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make API request with error handling."""
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)

        data = response.json()

        if not response.ok:
            raise ApiError(
                code=data.get('error', {}).get('code', 'UNKNOWN_ERROR'),
                message=data.get('error', {}).get('message', 'An error occurred'),
                status=response.status_code,
                trace_id=data.get('traceId'),
            )

        return data.get('data', data)

    def submit_invoice(
        self,
        file_input: Union[str, bytes],
        city_code: str,
        priority: Literal['normal', 'high'] = 'normal',
        callback_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, str]:
        """
        Submit an invoice for processing.

        Args:
            file_input: File path, URL, or bytes content
            city_code: City code for processing
            priority: Processing priority
            callback_url: Webhook callback URL
            metadata: Custom metadata

        Returns:
            Dict with taskId and statusUrl
        """
        params = {
            'cityCode': city_code,
            'priority': priority,
        }
        if callback_url:
            params['callbackUrl'] = callback_url
        if metadata:
            params['metadata'] = metadata

        if isinstance(file_input, str):
            if file_input.startswith(('http://', 'https://')):
                # URL reference
                return self._request('POST', '/invoices', json={
                    'type': 'url',
                    'url': file_input,
                    **params,
                })
            else:
                # File path
                with open(file_input, 'rb') as f:
                    file_bytes = f.read()
                return self._submit_base64(file_bytes, file_input, params)
        else:
            # Bytes content
            return self._submit_base64(file_input, 'document.pdf', params)

    def _submit_base64(
        self,
        content: bytes,
        filename: str,
        params: Dict[str, Any],
    ) -> Dict[str, str]:
        """Submit file as base64 content."""
        # Detect MIME type
        if filename.lower().endswith('.pdf'):
            mime_type = 'application/pdf'
        elif filename.lower().endswith('.png'):
            mime_type = 'image/png'
        elif filename.lower().endswith(('.jpg', '.jpeg')):
            mime_type = 'image/jpeg'
        else:
            mime_type = 'application/octet-stream'

        return self._request('POST', '/invoices', json={
            'type': 'base64',
            'content': base64.b64encode(content).decode('utf-8'),
            'fileName': filename,
            'mimeType': mime_type,
            **params,
        })

    def get_status(self, task_id: str) -> TaskStatus:
        """Get task processing status."""
        data = self._request('GET', f'/invoices/{task_id}/status')
        return TaskStatus(
            task_id=data['taskId'],
            status=data['status'],
            progress=data['progress'],
            current_step=data.get('currentStep'),
            estimated_completion=data.get('estimatedCompletion'),
            result_url=data.get('resultUrl'),
            confidence_score=data.get('confidenceScore'),
            error=data.get('error'),
        )

    def wait_for_completion(
        self,
        task_id: str,
        timeout: int = 300,
        poll_interval: int = 5,
    ) -> TaskStatus:
        """
        Wait for task completion with polling.

        Args:
            task_id: Task ID to wait for
            timeout: Maximum wait time in seconds
            poll_interval: Time between polls in seconds

        Returns:
            Final task status
        """
        start_time = time.time()

        while time.time() - start_time < timeout:
            status = self.get_status(task_id)

            if status.status in ('completed', 'failed', 'review_required'):
                return status

            time.sleep(poll_interval)

        raise TimeoutError(f'Timeout waiting for task {task_id}')

    def get_result(
        self,
        task_id: str,
        format: Literal['json', 'csv', 'xml'] = 'json',
    ) -> Union[ExtractionResult, str]:
        """
        Get extraction result.

        Args:
            task_id: Task ID
            format: Output format

        Returns:
            ExtractionResult for JSON format, raw string for CSV/XML
        """
        if format == 'json':
            data = self._request('GET', f'/invoices/{task_id}/result')
            return ExtractionResult(
                task_id=data['taskId'],
                forwarder=data.get('forwarder'),
                fields=[
                    ExtractionField(**f) for f in data.get('fields', [])
                ],
                metadata=data.get('metadata', {}),
                processed_at=data.get('processedAt', ''),
            )
        else:
            response = self.session.get(
                f'{self.base_url}/invoices/{task_id}/result?format={format}'
            )
            if not response.ok:
                data = response.json()
                raise ApiError(
                    code=data.get('error', {}).get('code'),
                    message=data.get('error', {}).get('message'),
                    status=response.status_code,
                )
            return response.text

    def batch_status(self, task_ids: list[str]) -> Dict[str, TaskStatus]:
        """Query status for multiple tasks."""
        data = self._request('POST', '/invoices/batch-status', json={
            'taskIds': task_ids,
        })
        return {
            task_id: TaskStatus(**status) if 'error' not in status else status
            for task_id, status in data.items()
        }


def verify_webhook_signature(
    payload: str,
    signature: str,
    timestamp: str,
    secret: str,
) -> bool:
    """
    Verify webhook signature.

    Args:
        payload: Raw request body
        signature: X-Signature header value
        timestamp: X-Timestamp header value
        secret: Your webhook secret

    Returns:
        True if signature is valid
    """
    # Check timestamp (5 minute tolerance)
    timestamp_ms = int(timestamp)
    now_ms = int(time.time() * 1000)
    if abs(now_ms - timestamp_ms) > 5 * 60 * 1000:
        return False

    # Calculate expected signature
    signature_data = f'{timestamp}.{payload}'
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        signature_data.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)


# Usage example
if __name__ == '__main__':
    client = InvoiceExtractionClient(ApiConfig(
        base_url='https://api.example.com/api/v1',
        api_key='your-api-key',
    ))

    try:
        # Submit invoice from URL
        result = client.submit_invoice(
            'https://example.com/invoice.pdf',
            city_code='TPE',
            priority='normal',
            callback_url='https://your-app.com/webhook',
        )
        print(f'Submitted: {result["taskId"]}')

        # Wait for completion
        status = client.wait_for_completion(result['taskId'])

        if status.status == 'completed':
            # Get result
            extraction = client.get_result(result['taskId'])
            print(f'Forwarder: {extraction.forwarder}')
            for field in extraction.fields:
                print(f'{field.name}: {field.value} (confidence: {field.confidence})')
        elif status.status == 'failed':
            print(f'Processing failed: {status.error}')

    except ApiError as e:
        print(f'API Error [{e.code}]: {e}')
        print(f'Trace ID: {e.trace_id}')
```

```csharp
// docs/examples/CSharpSdk.cs
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace InvoiceExtraction.Sdk
{
    public class InvoiceExtractionClient
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;

        public InvoiceExtractionClient(string baseUrl, string apiKey)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", apiKey);
        }

        /// <summary>
        /// Submit an invoice for processing
        /// </summary>
        public async Task<SubmissionResult> SubmitInvoiceAsync(
            string fileUrl,
            string cityCode,
            string priority = "normal",
            string? callbackUrl = null)
        {
            var request = new
            {
                type = "url",
                url = fileUrl,
                cityCode,
                priority,
                callbackUrl
            };

            var response = await PostAsync<SubmissionResult>("/invoices", request);
            return response;
        }

        /// <summary>
        /// Submit invoice from file bytes
        /// </summary>
        public async Task<SubmissionResult> SubmitInvoiceAsync(
            byte[] fileContent,
            string fileName,
            string mimeType,
            string cityCode,
            string priority = "normal",
            string? callbackUrl = null)
        {
            var request = new
            {
                type = "base64",
                content = Convert.ToBase64String(fileContent),
                fileName,
                mimeType,
                cityCode,
                priority,
                callbackUrl
            };

            var response = await PostAsync<SubmissionResult>("/invoices", request);
            return response;
        }

        /// <summary>
        /// Get task status
        /// </summary>
        public async Task<TaskStatus> GetStatusAsync(string taskId)
        {
            return await GetAsync<TaskStatus>($"/invoices/{taskId}/status");
        }

        /// <summary>
        /// Wait for task completion
        /// </summary>
        public async Task<TaskStatus> WaitForCompletionAsync(
            string taskId,
            int timeoutSeconds = 300,
            int pollIntervalSeconds = 5)
        {
            var startTime = DateTime.UtcNow;

            while ((DateTime.UtcNow - startTime).TotalSeconds < timeoutSeconds)
            {
                var status = await GetStatusAsync(taskId);

                if (status.Status is "completed" or "failed" or "review_required")
                {
                    return status;
                }

                await Task.Delay(TimeSpan.FromSeconds(pollIntervalSeconds));
            }

            throw new TimeoutException($"Timeout waiting for task {taskId}");
        }

        /// <summary>
        /// Get extraction result
        /// </summary>
        public async Task<ExtractionResult> GetResultAsync(string taskId)
        {
            return await GetAsync<ExtractionResult>($"/invoices/{taskId}/result");
        }

        private async Task<T> GetAsync<T>(string endpoint)
        {
            var response = await _httpClient.GetAsync($"{_baseUrl}{endpoint}");
            return await ProcessResponseAsync<T>(response);
        }

        private async Task<T> PostAsync<T>(string endpoint, object data)
        {
            var json = JsonSerializer.Serialize(data);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"{_baseUrl}{endpoint}", content);
            return await ProcessResponseAsync<T>(response);
        }

        private async Task<T> ProcessResponseAsync<T>(HttpResponseMessage response)
        {
            var json = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<ApiResponse<T>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (!response.IsSuccessStatusCode)
            {
                throw new ApiException(
                    result?.Error?.Code ?? "UNKNOWN_ERROR",
                    result?.Error?.Message ?? "An error occurred",
                    (int)response.StatusCode,
                    result?.TraceId
                );
            }

            return result!.Data;
        }
    }

    public class ApiResponse<T>
    {
        public T Data { get; set; } = default!;
        public ApiError? Error { get; set; }
        public string? TraceId { get; set; }
    }

    public class ApiError
    {
        public string Code { get; set; } = "";
        public string Message { get; set; } = "";
    }

    public class SubmissionResult
    {
        public string TaskId { get; set; } = "";
        public string Status { get; set; } = "";
        public int EstimatedProcessingTime { get; set; }
        public string StatusUrl { get; set; } = "";
    }

    public class TaskStatus
    {
        public string TaskId { get; set; } = "";
        public string Status { get; set; } = "";
        public int Progress { get; set; }
        public string? CurrentStep { get; set; }
        public string? EstimatedCompletion { get; set; }
        public string? ResultUrl { get; set; }
        public double? ConfidenceScore { get; set; }
        public TaskError? Error { get; set; }
    }

    public class TaskError
    {
        public string Code { get; set; } = "";
        public string Message { get; set; } = "";
        public bool Retryable { get; set; }
    }

    public class ExtractionResult
    {
        public string TaskId { get; set; } = "";
        public ForwarderInfo? Forwarder { get; set; }
        public List<ExtractionField> Fields { get; set; } = new();
        public Dictionary<string, object> Metadata { get; set; } = new();
        public string ProcessedAt { get; set; } = "";
    }

    public class ForwarderInfo
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Code { get; set; } = "";
    }

    public class ExtractionField
    {
        public string Name { get; set; } = "";
        public object? Value { get; set; }
        public double Confidence { get; set; }
        public string Source { get; set; } = "";
    }

    public class ApiException : Exception
    {
        public string Code { get; }
        public int StatusCode { get; }
        public string? TraceId { get; }

        public ApiException(string code, string message, int statusCode, string? traceId = null)
            : base(message)
        {
            Code = code;
            StatusCode = statusCode;
            TraceId = traceId;
        }
    }

    /// <summary>
    /// Webhook signature verification helper
    /// </summary>
    public static class WebhookVerification
    {
        public static bool VerifySignature(
            string payload,
            string signature,
            string timestamp,
            string secret)
        {
            // Check timestamp (5 minute tolerance)
            if (!long.TryParse(timestamp, out var timestampMs))
                return false;

            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (Math.Abs(nowMs - timestampMs) > 5 * 60 * 1000)
                return false;

            // Calculate expected signature
            var signatureData = $"{timestamp}.{payload}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var expectedSignature = Convert.ToHexString(
                hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData))
            ).ToLower();

            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(signature),
                Encoding.UTF8.GetBytes(expectedSignature)
            );
        }
    }
}
```

## 測試案例

### API 文檔測試

```typescript
// __tests__/docs/openapi.test.ts
import { validateOpenApiSpec } from '@/lib/utils/openApiValidator'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

describe('OpenAPI Specification', () => {
  let spec: any

  beforeAll(() => {
    const specPath = path.join(process.cwd(), 'openapi', 'spec.yaml')
    const specContent = fs.readFileSync(specPath, 'utf-8')
    spec = yaml.load(specContent)
  })

  it('should be valid OpenAPI 3.0', async () => {
    const result = await validateOpenApiSpec(spec)
    expect(result.valid).toBe(true)
  })

  it('should have all required endpoints', () => {
    const requiredPaths = [
      '/invoices',
      '/invoices/{taskId}/status',
      '/invoices/{taskId}/result',
      '/invoices/batch-status',
      '/webhooks',
    ]

    for (const path of requiredPaths) {
      expect(spec.paths[path]).toBeDefined()
    }
  })

  it('should have security defined for all endpoints', () => {
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods as any)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          expect((operation as any).security).toBeDefined()
        }
      }
    }
  })

  it('should have response schemas for all endpoints', () => {
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods as any)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          expect((operation as any).responses).toBeDefined()
          expect((operation as any).responses['200'] || (operation as any).responses['201'] || (operation as any).responses['202']).toBeDefined()
        }
      }
    }
  })
})
```

## 部署注意事項

1. **文檔版本控制**
   - OpenAPI 規格文件納入版本控制
   - 文檔更新與 API 變更同步

2. **Swagger UI 配置**
   - 生產環境限制測試功能
   - 需要認證才能訪問

3. **SDK 維護**
   - 範例代碼定期測試
   - 配合 API 變更更新

## 相依性

- Story 11-1: API 發票提交端點（文檔內容）
- Story 11-2: API 處理狀態查詢端點（文檔內容）
- Story 11-3: API 處理結果獲取端點（文檔內容）
- Story 11-4: Webhook 通知服務（文檔內容）
- Story 11-5: API 訪問控制與認證（文檔內容）

---

## 實施記錄

### 完成日期
2025-12-21

### 實現概要

Story 11-6 實現了完整的 API 文檔與開發者支援功能，包括：

1. **OpenAPI 3.0.3 規格文件** (`openapi/spec.yaml`)
   - 完整記錄所有 API 端點（發票提交、狀態查詢、結果獲取、Webhook）
   - 包含認證說明（Bearer Token）
   - 包含速率限制說明（60 req/min）
   - 完整的請求/響應 Schema

2. **Swagger UI 互動文檔** (`/docs`)
   - 使用 swagger-ui-react 渲染
   - 支援直接測試 API（需 API Key）
   - 暗色模式支援

3. **多語言 SDK 範例** (`/docs/examples`)
   - TypeScript/JavaScript 範例
   - Python 範例
   - C# 範例
   - 包含安裝說明、初始化、完整錯誤處理

4. **文檔 API 端點**
   - `GET /api/openapi` - 返回 OpenAPI 規格（JSON）
   - `GET /api/docs/error-codes` - 錯誤代碼參考
   - `GET /api/docs/version` - API 版本資訊
   - `GET /api/docs/examples` - SDK 範例資料

### 新增文件

| 類型 | 路徑 | 說明 |
|------|------|------|
| Spec | `openapi/spec.yaml` | OpenAPI 3.0.3 規格文件 |
| Types | `src/types/documentation.ts` | 文檔相關類型定義 |
| Types | `src/types/sdk-examples.ts` | SDK 範例類型定義 |
| Service | `src/services/openapi-loader.service.ts` | OpenAPI 規格載入器 |
| Service | `src/services/example-generator.service.ts` | SDK 範例生成器 |
| API | `src/app/api/openapi/route.ts` | OpenAPI 規格端點 |
| API | `src/app/api/docs/route.ts` | 文檔重定向 |
| API | `src/app/api/docs/error-codes/route.ts` | 錯誤代碼端點 |
| API | `src/app/api/docs/version/route.ts` | 版本資訊端點 |
| API | `src/app/api/docs/examples/route.ts` | SDK 範例端點 |
| Component | `src/components/features/docs/SwaggerUIWrapper.tsx` | Swagger UI 包裝器 |
| Component | `src/components/features/docs/CodeBlock.tsx` | 代碼高亮組件 |
| Component | `src/components/features/docs/LanguageTabs.tsx` | 語言切換標籤 |
| Component | `src/components/features/docs/SDKExamplesContent.tsx` | SDK 範例內容 |
| Page | `src/app/docs/page.tsx` | Swagger UI 文檔頁面 |
| Page | `src/app/docs/examples/page.tsx` | SDK 範例頁面 |

### 驗收標準完成狀態

| AC | 狀態 | 說明 |
|----|------|------|
| AC1 | ✅ | 互動式 API 文檔 - Swagger UI 可訪問並支援測試 |
| AC2 | ✅ | 完整端點說明 - 所有端點含參數、響應、錯誤代碼 |
| AC3 | ✅ | 多語言整合範例 - TypeScript、Python、C# 完整範例 |

### 依賴套件

- `swagger-ui-react` - Swagger UI React 組件
- `@types/swagger-ui-react` - TypeScript 類型
- `js-yaml` - YAML 解析
- `@types/js-yaml` - TypeScript 類型
- `react-syntax-highlighter` - 代碼語法高亮
- `@types/react-syntax-highlighter` - TypeScript 類型
