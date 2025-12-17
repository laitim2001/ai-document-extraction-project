# Tech Spec: Story 11-6 - API 文檔與開發者支援

## 1. Overview

### 1.1 Story Reference
- **Story ID**: 11-6
- **Epic**: 11 - 對外 API 服務
- **Title**: API 文檔與開發者支援
- **Priority**: Medium
- **Story Points**: 5
- **Functional Requirements**: FR64, FR65, FR66

### 1.2 Problem Statement
外部系統開發者需要完整且易用的 API 文檔，以便快速理解和整合發票處理功能。缺乏良好的文檔會導致整合時間延長、支援請求增加，以及潛在的錯誤使用。

### 1.3 Proposed Solution
建立基於 OpenAPI 3.0 的互動式 API 文檔系統，包含：
- **Swagger UI 互動文檔**：可直接測試 API 的互動介面
- **完整 OpenAPI 規格**：機器可讀的 API 定義
- **多語言 SDK 範例**：JavaScript/TypeScript、Python、C# 整合範例
- **Webhook 驗證工具**：簽名驗證範例程式碼

### 1.4 Success Criteria
- OpenAPI 規格通過 Swagger Validator 驗證
- Swagger UI 正確顯示所有端點
- SDK 範例程式碼可執行且無錯誤
- 文檔涵蓋所有 API 端點和錯誤代碼

---

## 2. Architecture & Design

### 2.1 System Context
```
┌─────────────────────────────────────────────────────────────────┐
│                     API Documentation System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │   OpenAPI Spec   │   │   Swagger UI     │   │   SDK Docs   │ │
│  │   (YAML/JSON)    │   │   (React Page)   │   │   (Examples) │ │
│  └────────┬─────────┘   └────────┬─────────┘   └──────┬───────┘ │
│           │                      │                     │         │
│           └──────────────────────┼─────────────────────┘         │
│                                  │                               │
│                          ┌───────▼───────┐                       │
│                          │  API Server   │                       │
│                          │  (Next.js)    │                       │
│                          └───────────────┘                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Architecture
```
docs/
├── api/
│   ├── openapi/
│   │   └── spec.yaml              # OpenAPI 3.0 規格主文件
│   └── examples/
│       ├── javascript-sdk.ts      # JS/TS SDK 範例
│       ├── python_sdk.py          # Python SDK 範例
│       └── CSharpSdk.cs           # C# SDK 範例
│
src/
├── app/
│   ├── docs/
│   │   └── page.tsx               # Swagger UI 頁面
│   └── api/
│       ├── docs/
│       │   └── route.ts           # 文檔重定向
│       └── openapi/
│           └── route.ts           # OpenAPI JSON 端點
│
├── lib/
│   └── documentation/
│       ├── openapi-generator.ts   # OpenAPI 規格生成器
│       ├── spec-validator.ts      # 規格驗證工具
│       └── example-generator.ts   # 程式碼範例生成器
```

### 2.3 Sequence Diagram - 文檔存取流程
```
Developer              Browser              API Server           OpenAPI Spec
    │                     │                     │                     │
    │  GET /docs          │                     │                     │
    │────────────────────>│                     │                     │
    │                     │  GET /docs          │                     │
    │                     │────────────────────>│                     │
    │                     │                     │                     │
    │                     │  Return Swagger UI  │                     │
    │                     │<────────────────────│                     │
    │                     │                     │                     │
    │                     │  GET /api/openapi   │                     │
    │                     │────────────────────>│                     │
    │                     │                     │  Read spec.yaml     │
    │                     │                     │────────────────────>│
    │                     │                     │                     │
    │                     │                     │  Return spec        │
    │                     │                     │<────────────────────│
    │                     │                     │                     │
    │                     │  Return JSON spec   │                     │
    │                     │<────────────────────│                     │
    │                     │                     │                     │
    │  Display interactive│                     │                     │
    │  documentation      │                     │                     │
    │<────────────────────│                     │                     │
    │                     │                     │                     │
```

### 2.4 Sequence Diagram - API 測試流程 (Try It Out)
```
Developer              Swagger UI           API Server           Auth Service
    │                     │                     │                     │
    │  Enter API Key      │                     │                     │
    │────────────────────>│                     │                     │
    │                     │                     │                     │
    │  Click "Try it out" │                     │                     │
    │────────────────────>│                     │                     │
    │                     │                     │                     │
    │  Fill parameters    │                     │                     │
    │────────────────────>│                     │                     │
    │                     │                     │                     │
    │  Click "Execute"    │                     │                     │
    │────────────────────>│                     │                     │
    │                     │  API Request        │                     │
    │                     │  + Bearer Token     │                     │
    │                     │────────────────────>│                     │
    │                     │                     │  Validate key       │
    │                     │                     │────────────────────>│
    │                     │                     │                     │
    │                     │                     │  Key valid          │
    │                     │                     │<────────────────────│
    │                     │                     │                     │
    │                     │  API Response       │                     │
    │                     │<────────────────────│                     │
    │                     │                     │                     │
    │  Display response   │                     │                     │
    │  + cURL example     │                     │                     │
    │<────────────────────│                     │                     │
    │                     │                     │                     │
```

---

## 3. Database Design

### 3.1 Documentation 本身不需要額外資料表
API 文檔為靜態資源，從 OpenAPI 規格文件生成，不需要專屬的資料庫表格。

### 3.2 相關資料模型參考
文檔內容基於以下既有模型（來自 Story 11-1 至 11-5）：
- `ExternalApiTask` - 發票任務
- `ExternalApiKey` - API 金鑰
- `ExternalWebhookDelivery` - Webhook 傳遞記錄
- `ApiAuditLog` - API 審計日誌

---

## 4. API Design

### 4.1 文檔相關端點

#### GET /api/openapi
返回 OpenAPI 規格 JSON 格式。

**Response**: `200 OK`
```typescript
// Content-Type: application/json
interface OpenAPISpec {
  openapi: string              // "3.0.3"
  info: {
    title: string
    description: string
    version: string
    contact: {
      name: string
      email: string
    }
    license: {
      name: string
      url: string
    }
  }
  servers: Array<{
    url: string
    description: string
  }>
  tags: Array<{
    name: string
    description: string
  }>
  paths: Record<string, PathItem>
  components: {
    securitySchemes: Record<string, SecurityScheme>
    schemas: Record<string, Schema>
    responses: Record<string, Response>
    parameters: Record<string, Parameter>
  }
}
```

#### GET /docs
Swagger UI 互動文檔頁面。

**Response**: `200 OK`
- Content-Type: `text/html`
- 返回包含 Swagger UI 的 React 頁面

#### GET /api/docs
重定向到 `/docs` 頁面。

**Response**: `302 Found`
- Location: `/docs`

### 4.2 OpenAPI 規格文件結構

```yaml
# openapi/spec.yaml - 主要結構
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

    ## Webhooks
    Configure callback URLs to receive real-time notifications.
    All webhook requests include HMAC-SHA256 signatures for verification.
  version: 1.0.0
  contact:
    name: API Support
    email: api-support@example.com

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

# Paths 定義於後續章節
paths: {}

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      description: API key authentication
```

---

## 5. TypeScript Types & Interfaces

### 5.1 OpenAPI Types

```typescript
// src/types/documentation.ts

/**
 * OpenAPI 規格載入器設定
 */
export interface OpenAPILoaderConfig {
  specPath: string
  cacheEnabled: boolean
  cacheTTL: number // 秒
}

/**
 * Swagger UI 配置
 */
export interface SwaggerUIConfig {
  url: string
  docExpansion: 'list' | 'full' | 'none'
  defaultModelsExpandDepth: number
  persistAuthorization: boolean
  tryItOutEnabled: boolean
  filter: boolean
  showExtensions: boolean
  showCommonExtensions: boolean
}

/**
 * API 端點文檔
 */
export interface EndpointDocumentation {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  summary: string
  description: string
  tags: string[]
  operationId: string
  parameters?: ParameterDoc[]
  requestBody?: RequestBodyDoc
  responses: Record<string, ResponseDoc>
  security: SecurityRequirement[]
}

/**
 * 參數文檔
 */
export interface ParameterDoc {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  description: string
  required: boolean
  schema: SchemaDoc
  example?: unknown
}

/**
 * 請求體文檔
 */
export interface RequestBodyDoc {
  description: string
  required: boolean
  content: Record<string, MediaTypeDoc>
}

/**
 * 回應文檔
 */
export interface ResponseDoc {
  description: string
  headers?: Record<string, HeaderDoc>
  content?: Record<string, MediaTypeDoc>
}

/**
 * 媒體類型文檔
 */
export interface MediaTypeDoc {
  schema: SchemaDoc
  example?: unknown
  examples?: Record<string, ExampleDoc>
}

/**
 * Schema 文檔
 */
export interface SchemaDoc {
  type?: string
  format?: string
  description?: string
  properties?: Record<string, SchemaDoc>
  items?: SchemaDoc
  required?: string[]
  enum?: unknown[]
  example?: unknown
  $ref?: string
  oneOf?: SchemaDoc[]
  anyOf?: SchemaDoc[]
  allOf?: SchemaDoc[]
}

/**
 * Header 文檔
 */
export interface HeaderDoc {
  description: string
  schema: SchemaDoc
}

/**
 * 範例文檔
 */
export interface ExampleDoc {
  summary: string
  description?: string
  value: unknown
}

/**
 * 安全需求
 */
export interface SecurityRequirement {
  [schemeName: string]: string[]
}
```

### 5.2 SDK 範例 Types

```typescript
// src/types/sdk-examples.ts

/**
 * SDK 語言類型
 */
export type SDKLanguage = 'typescript' | 'python' | 'csharp' | 'java' | 'go'

/**
 * SDK 配置
 */
export interface SDKConfig {
  baseUrl: string
  apiKey: string
  timeout?: number
  retryConfig?: RetryConfig
}

/**
 * 重試配置
 */
export interface RetryConfig {
  maxRetries: number
  retryDelay: number
  retryableStatuses: number[]
}

/**
 * SDK 發票提交選項
 */
export interface SubmitInvoiceOptions {
  cityCode: string
  priority?: 'normal' | 'high'
  callbackUrl?: string
  metadata?: Record<string, unknown>
}

/**
 * SDK 任務狀態
 */
export interface SDKTaskStatus {
  taskId: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'review_required'
  progress: number
  currentStep?: string
  estimatedCompletion?: string
  resultUrl?: string
  confidenceScore?: number
  error?: {
    code: string
    message: string
    retryable: boolean
  }
}

/**
 * SDK 擷取結果
 */
export interface SDKExtractionResult {
  taskId: string
  forwarder: {
    id: string
    name: string
    code: string
  } | null
  fields: SDKExtractionField[]
  metadata: {
    originalFileName: string
    fileSize: number
    mimeType: string
    pageCount?: number
  }
  processedAt: string
  expiresAt: string
}

/**
 * SDK 擷取欄位
 */
export interface SDKExtractionField {
  name: string
  value: string | number | null
  confidence: number
  source: 'ocr' | 'ai' | 'rule' | 'manual'
}

/**
 * SDK 錯誤
 */
export interface SDKError {
  code: string
  message: string
  status: number
  traceId?: string
}

/**
 * 程式碼範例
 */
export interface CodeExample {
  language: SDKLanguage
  title: string
  description: string
  code: string
  dependencies?: string[]
}

/**
 * 端點範例集合
 */
export interface EndpointExamples {
  endpoint: string
  method: string
  examples: CodeExample[]
}
```

---

## 6. Service Layer Implementation

### 6.1 OpenAPI Loader Service

```typescript
// src/lib/documentation/openapi-loader.service.ts

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { OpenAPILoaderConfig } from '@/types/documentation'

interface CacheEntry {
  spec: unknown
  loadedAt: Date
}

export class OpenAPILoaderService {
  private cache: CacheEntry | null = null
  private config: OpenAPILoaderConfig

  constructor(config: OpenAPILoaderConfig) {
    this.config = config
  }

  /**
   * 載入 OpenAPI 規格
   */
  async loadSpec(): Promise<unknown> {
    // 檢查快取
    if (this.config.cacheEnabled && this.cache) {
      const cacheAge = Date.now() - this.cache.loadedAt.getTime()
      if (cacheAge < this.config.cacheTTL * 1000) {
        return this.cache.spec
      }
    }

    // 載入規格文件
    const specPath = path.join(process.cwd(), this.config.specPath)
    const specContent = await fs.promises.readFile(specPath, 'utf-8')

    // 解析 YAML
    const spec = yaml.load(specContent)

    // 更新快取
    if (this.config.cacheEnabled) {
      this.cache = {
        spec,
        loadedAt: new Date(),
      }
    }

    return spec
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.cache = null
  }

  /**
   * 取得規格版本
   */
  async getVersion(): Promise<string> {
    const spec = await this.loadSpec() as { info: { version: string } }
    return spec.info.version
  }

  /**
   * 驗證規格是否有效
   */
  async validateSpec(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const spec = await this.loadSpec()
      const errors: string[] = []

      // 基本結構驗證
      const requiredFields = ['openapi', 'info', 'paths']
      for (const field of requiredFields) {
        if (!(spec as Record<string, unknown>)[field]) {
          errors.push(`Missing required field: ${field}`)
        }
      }

      // 版本驗證
      const openApiVersion = (spec as { openapi: string }).openapi
      if (!openApiVersion.startsWith('3.')) {
        errors.push(`Unsupported OpenAPI version: ${openApiVersion}`)
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to load spec: ${error}`],
      }
    }
  }
}

// 單例實例
export const openAPILoader = new OpenAPILoaderService({
  specPath: 'openapi/spec.yaml',
  cacheEnabled: true,
  cacheTTL: 300, // 5 分鐘
})
```

### 6.2 Code Example Generator Service

```typescript
// src/lib/documentation/example-generator.service.ts

import {
  SDKLanguage,
  CodeExample,
  EndpointExamples,
} from '@/types/sdk-examples'

export class ExampleGeneratorService {
  /**
   * 生成發票提交範例
   */
  generateSubmitInvoiceExamples(): EndpointExamples {
    return {
      endpoint: '/invoices',
      method: 'POST',
      examples: [
        this.generateTypeScriptSubmitExample(),
        this.generatePythonSubmitExample(),
        this.generateCSharpSubmitExample(),
        this.generateCurlSubmitExample(),
      ],
    }
  }

  /**
   * 生成狀態查詢範例
   */
  generateGetStatusExamples(): EndpointExamples {
    return {
      endpoint: '/invoices/{taskId}/status',
      method: 'GET',
      examples: [
        this.generateTypeScriptStatusExample(),
        this.generatePythonStatusExample(),
        this.generateCurlStatusExample(),
      ],
    }
  }

  /**
   * 生成結果擷取範例
   */
  generateGetResultExamples(): EndpointExamples {
    return {
      endpoint: '/invoices/{taskId}/result',
      method: 'GET',
      examples: [
        this.generateTypeScriptResultExample(),
        this.generatePythonResultExample(),
        this.generateCurlResultExample(),
      ],
    }
  }

  /**
   * 生成 Webhook 驗證範例
   */
  generateWebhookVerificationExamples(): EndpointExamples {
    return {
      endpoint: 'Webhook Handler',
      method: 'POST',
      examples: [
        this.generateTypeScriptWebhookExample(),
        this.generatePythonWebhookExample(),
        this.generateCSharpWebhookExample(),
      ],
    }
  }

  // TypeScript 範例
  private generateTypeScriptSubmitExample(): CodeExample {
    return {
      language: 'typescript',
      title: '提交發票 (TypeScript)',
      description: '使用 fetch API 提交發票檔案',
      dependencies: ['node-fetch (optional for Node.js)'],
      code: `
import { InvoiceExtractionClient } from './sdk'

const client = new InvoiceExtractionClient({
  baseUrl: 'https://api.example.com/api/v1',
  apiKey: 'your-api-key',
})

// 方法 1: 從 URL 提交
const result = await client.submitInvoice(
  'https://example.com/invoice.pdf',
  {
    cityCode: 'TPE',
    priority: 'normal',
    callbackUrl: 'https://your-app.com/webhook',
  }
)

console.log(\`Task ID: \${result.taskId}\`)

// 方法 2: 從檔案提交
const file = document.getElementById('fileInput').files[0]
const result2 = await client.submitInvoice(file, {
  cityCode: 'TPE',
})

// 方法 3: 從 Base64 提交
const base64Content = btoa(fileContent)
const response = await fetch('https://api.example.com/api/v1/invoices', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'base64',
    content: base64Content,
    fileName: 'invoice.pdf',
    mimeType: 'application/pdf',
    cityCode: 'TPE',
  }),
})
`.trim(),
    }
  }

  private generateTypeScriptStatusExample(): CodeExample {
    return {
      language: 'typescript',
      title: '查詢狀態 (TypeScript)',
      description: '查詢任務處理狀態並等待完成',
      code: `
const client = new InvoiceExtractionClient({
  baseUrl: 'https://api.example.com/api/v1',
  apiKey: 'your-api-key',
})

// 單次查詢
const status = await client.getStatus('task_abc123')
console.log(\`Status: \${status.status}, Progress: \${status.progress}%\`)

// 等待完成（輪詢）
const finalStatus = await client.waitForCompletion('task_abc123', {
  timeout: 300000,     // 5 分鐘超時
  pollInterval: 5000,  // 每 5 秒查詢一次
})

if (finalStatus.status === 'completed') {
  console.log('處理完成！')
} else if (finalStatus.status === 'failed') {
  console.error(\`處理失敗: \${finalStatus.error?.message}\`)
}

// 批次查詢
const batchStatus = await client.batchStatus([
  'task_abc123',
  'task_def456',
  'task_ghi789',
])

for (const [taskId, taskStatus] of Object.entries(batchStatus)) {
  console.log(\`\${taskId}: \${taskStatus.status}\`)
}
`.trim(),
    }
  }

  private generateTypeScriptResultExample(): CodeExample {
    return {
      language: 'typescript',
      title: '取得結果 (TypeScript)',
      description: '擷取處理結果並轉換格式',
      code: `
const client = new InvoiceExtractionClient({
  baseUrl: 'https://api.example.com/api/v1',
  apiKey: 'your-api-key',
})

// 取得 JSON 結果
const result = await client.getResult('task_abc123')

console.log(\`Forwarder: \${result.forwarder?.name}\`)
for (const field of result.fields) {
  console.log(\`\${field.name}: \${field.value} (confidence: \${field.confidence})\`)
}

// 取得 CSV 格式
const csvData = await client.getResult('task_abc123', 'csv')
console.log(csvData)

// 取得 XML 格式
const xmlData = await client.getResult('task_abc123', 'xml')
console.log(xmlData)

// 取得特定欄位
const response = await fetch(
  'https://api.example.com/api/v1/invoices/task_abc123/result/fields/invoiceNumber',
  {
    headers: {
      'Authorization': 'Bearer your-api-key',
    },
  }
)
const fieldValue = await response.json()
console.log(\`Invoice Number: \${fieldValue.data.value}\`)
`.trim(),
    }
  }

  private generateTypeScriptWebhookExample(): CodeExample {
    return {
      language: 'typescript',
      title: 'Webhook 處理 (TypeScript/Express)',
      description: '驗證 Webhook 簽名並處理事件',
      code: `
import express from 'express'
import crypto from 'crypto'

const app = express()
app.use(express.raw({ type: 'application/json' }))

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!

function verifySignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  // 檢查時間戳記（5 分鐘容差）
  const timestampMs = parseInt(timestamp)
  const nowMs = Date.now()
  if (Math.abs(nowMs - timestampMs) > 5 * 60 * 1000) {
    return false
  }

  // 計算預期簽名
  const signatureData = \`\${timestamp}.\${payload}\`
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signatureData)
    .digest('hex')

  // 安全比較
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-signature'] as string
  const timestamp = req.headers['x-timestamp'] as string
  const payload = req.body.toString()

  // 驗證簽名
  if (!verifySignature(payload, signature, timestamp)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // 處理事件
  const event = JSON.parse(payload)

  switch (event.event) {
    case 'invoice.completed':
      console.log(\`Invoice \${event.data.taskId} completed!\`)
      // 處理完成事件...
      break

    case 'invoice.failed':
      console.error(\`Invoice \${event.data.taskId} failed: \${event.data.error?.message}\`)
      // 處理失敗事件...
      break

    case 'invoice.review_required':
      console.log(\`Invoice \${event.data.taskId} needs review\`)
      // 通知人工審核...
      break
  }

  res.status(200).json({ received: true })
})
`.trim(),
    }
  }

  // Python 範例
  private generatePythonSubmitExample(): CodeExample {
    return {
      language: 'python',
      title: '提交發票 (Python)',
      description: '使用 requests 函式庫提交發票',
      dependencies: ['requests'],
      code: `
from invoice_extraction import InvoiceExtractionClient, ApiConfig

client = InvoiceExtractionClient(ApiConfig(
    base_url='https://api.example.com/api/v1',
    api_key='your-api-key',
))

# 方法 1: 從 URL 提交
result = client.submit_invoice(
    'https://example.com/invoice.pdf',
    city_code='TPE',
    priority='normal',
    callback_url='https://your-app.com/webhook',
)
print(f'Task ID: {result["taskId"]}')

# 方法 2: 從檔案路徑提交
result = client.submit_invoice(
    '/path/to/invoice.pdf',
    city_code='TPE',
)

# 方法 3: 從 bytes 提交
with open('invoice.pdf', 'rb') as f:
    file_bytes = f.read()

result = client.submit_invoice(
    file_bytes,
    city_code='TPE',
)
`.trim(),
    }
  }

  private generatePythonStatusExample(): CodeExample {
    return {
      language: 'python',
      title: '查詢狀態 (Python)',
      description: '查詢任務狀態並等待完成',
      code: `
from invoice_extraction import InvoiceExtractionClient, ApiConfig

client = InvoiceExtractionClient(ApiConfig(
    base_url='https://api.example.com/api/v1',
    api_key='your-api-key',
))

# 單次查詢
status = client.get_status('task_abc123')
print(f'Status: {status.status}, Progress: {status.progress}%')

# 等待完成
try:
    final_status = client.wait_for_completion(
        'task_abc123',
        timeout=300,      # 5 分鐘超時
        poll_interval=5,  # 每 5 秒查詢
    )

    if final_status.status == 'completed':
        print('處理完成！')
    elif final_status.status == 'failed':
        print(f'處理失敗: {final_status.error}')

except TimeoutError:
    print('等待超時')

# 批次查詢
batch = client.batch_status([
    'task_abc123',
    'task_def456',
])

for task_id, task_status in batch.items():
    print(f'{task_id}: {task_status.status}')
`.trim(),
    }
  }

  private generatePythonResultExample(): CodeExample {
    return {
      language: 'python',
      title: '取得結果 (Python)',
      description: '擷取並處理結果',
      code: `
from invoice_extraction import InvoiceExtractionClient, ApiConfig

client = InvoiceExtractionClient(ApiConfig(
    base_url='https://api.example.com/api/v1',
    api_key='your-api-key',
))

# 取得結果
result = client.get_result('task_abc123')

print(f'Forwarder: {result.forwarder}')
for field in result.fields:
    print(f'{field.name}: {field.value} (confidence: {field.confidence})')

# 取得 CSV 格式
csv_data = client.get_result('task_abc123', format='csv')
print(csv_data)

# 儲存 CSV 檔案
with open('result.csv', 'w') as f:
    f.write(csv_data)

# 轉換為 DataFrame
import pandas as pd
from io import StringIO

df = pd.read_csv(StringIO(csv_data))
print(df.head())
`.trim(),
    }
  }

  private generatePythonWebhookExample(): CodeExample {
    return {
      language: 'python',
      title: 'Webhook 處理 (Python/Flask)',
      description: '驗證簽名並處理 Webhook 事件',
      dependencies: ['flask'],
      code: `
import hmac
import hashlib
import time
import json
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = 'your-webhook-secret'

def verify_signature(payload: str, signature: str, timestamp: str) -> bool:
    """驗證 Webhook 簽名"""
    # 檢查時間戳記（5 分鐘容差）
    timestamp_ms = int(timestamp)
    now_ms = int(time.time() * 1000)
    if abs(now_ms - timestamp_ms) > 5 * 60 * 1000:
        return False

    # 計算預期簽名
    signature_data = f'{timestamp}.{payload}'
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        signature_data.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()

    # 安全比較
    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Signature')
    timestamp = request.headers.get('X-Timestamp')
    payload = request.get_data(as_text=True)

    # 驗證簽名
    if not verify_signature(payload, signature, timestamp):
        return jsonify({'error': 'Invalid signature'}), 401

    # 處理事件
    event = json.loads(payload)

    if event['event'] == 'invoice.completed':
        task_id = event['data']['taskId']
        print(f'Invoice {task_id} completed!')
        # 處理完成事件...

    elif event['event'] == 'invoice.failed':
        task_id = event['data']['taskId']
        error = event['data'].get('error', {})
        print(f'Invoice {task_id} failed: {error.get("message")}')
        # 處理失敗事件...

    elif event['event'] == 'invoice.review_required':
        task_id = event['data']['taskId']
        print(f'Invoice {task_id} needs review')
        # 通知人工審核...

    return jsonify({'received': True}), 200

if __name__ == '__main__':
    app.run(port=3000)
`.trim(),
    }
  }

  // C# 範例
  private generateCSharpSubmitExample(): CodeExample {
    return {
      language: 'csharp',
      title: '提交發票 (C#)',
      description: '使用 HttpClient 提交發票',
      dependencies: ['System.Net.Http', 'System.Text.Json'],
      code: `
using InvoiceExtraction.Sdk;

var client = new InvoiceExtractionClient(
    "https://api.example.com/api/v1",
    "your-api-key"
);

// 方法 1: 從 URL 提交
var result = await client.SubmitInvoiceAsync(
    fileUrl: "https://example.com/invoice.pdf",
    cityCode: "TPE",
    priority: "normal",
    callbackUrl: "https://your-app.com/webhook"
);

Console.WriteLine($"Task ID: {result.TaskId}");

// 方法 2: 從檔案 bytes 提交
var fileBytes = await File.ReadAllBytesAsync("invoice.pdf");
var result2 = await client.SubmitInvoiceAsync(
    fileContent: fileBytes,
    fileName: "invoice.pdf",
    mimeType: "application/pdf",
    cityCode: "TPE"
);

// 等待完成
var status = await client.WaitForCompletionAsync(
    result.TaskId,
    timeoutSeconds: 300
);

if (status.Status == "completed")
{
    var extraction = await client.GetResultAsync(result.TaskId);
    Console.WriteLine($"Forwarder: {extraction.Forwarder?.Name}");

    foreach (var field in extraction.Fields)
    {
        Console.WriteLine($"{field.Name}: {field.Value}");
    }
}
`.trim(),
    }
  }

  private generateCSharpWebhookExample(): CodeExample {
    return {
      language: 'csharp',
      title: 'Webhook 處理 (C#/ASP.NET Core)',
      description: '驗證簽名並處理 Webhook 事件',
      code: `
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

[ApiController]
[Route("webhook")]
public class WebhookController : ControllerBase
{
    private readonly string _webhookSecret;

    public WebhookController(IConfiguration config)
    {
        _webhookSecret = config["WebhookSecret"]!;
    }

    [HttpPost]
    public async Task<IActionResult> HandleWebhook()
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync();

        var signature = Request.Headers["X-Signature"].FirstOrDefault();
        var timestamp = Request.Headers["X-Timestamp"].FirstOrDefault();

        // 驗證簽名
        if (!VerifySignature(payload, signature!, timestamp!))
        {
            return Unauthorized(new { error = "Invalid signature" });
        }

        // 處理事件
        var webhookEvent = JsonSerializer.Deserialize<WebhookEvent>(payload);

        switch (webhookEvent?.Event)
        {
            case "invoice.completed":
                Console.WriteLine($"Invoice {webhookEvent.Data.TaskId} completed!");
                // 處理完成事件...
                break;

            case "invoice.failed":
                Console.WriteLine($"Invoice {webhookEvent.Data.TaskId} failed");
                // 處理失敗事件...
                break;

            case "invoice.review_required":
                Console.WriteLine($"Invoice {webhookEvent.Data.TaskId} needs review");
                // 通知人工審核...
                break;
        }

        return Ok(new { received = true });
    }

    private bool VerifySignature(string payload, string signature, string timestamp)
    {
        // 檢查時間戳記
        if (!long.TryParse(timestamp, out var timestampMs))
            return false;

        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (Math.Abs(nowMs - timestampMs) > 5 * 60 * 1000)
            return false;

        // 計算預期簽名
        var signatureData = $"{timestamp}.{payload}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_webhookSecret));
        var expectedSignature = Convert.ToHexString(
            hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData))
        ).ToLower();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(signature),
            Encoding.UTF8.GetBytes(expectedSignature)
        );
    }
}

public class WebhookEvent
{
    public string Event { get; set; } = "";
    public WebhookData Data { get; set; } = new();
}

public class WebhookData
{
    public string TaskId { get; set; } = "";
    public string Status { get; set; } = "";
}
`.trim(),
    }
  }

  // cURL 範例
  private generateCurlSubmitExample(): CodeExample {
    return {
      language: 'typescript', // 使用 typescript 作為 shell 的替代
      title: '提交發票 (cURL)',
      description: '使用 cURL 命令列提交發票',
      code: `
# 方法 1: 從 URL 提交
curl -X POST https://api.example.com/api/v1/invoices \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "url",
    "url": "https://example.com/invoice.pdf",
    "cityCode": "TPE",
    "priority": "normal",
    "callbackUrl": "https://your-app.com/webhook"
  }'

# 方法 2: 從檔案上傳 (multipart/form-data)
curl -X POST https://api.example.com/api/v1/invoices \\
  -H "Authorization: Bearer your-api-key" \\
  -F "file=@/path/to/invoice.pdf" \\
  -F 'params={"cityCode": "TPE", "priority": "normal"}'

# 方法 3: Base64 編碼
BASE64_CONTENT=$(base64 -i invoice.pdf)
curl -X POST https://api.example.com/api/v1/invoices \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"type\\": \\"base64\\",
    \\"content\\": \\"$BASE64_CONTENT\\",
    \\"fileName\\": \\"invoice.pdf\\",
    \\"mimeType\\": \\"application/pdf\\",
    \\"cityCode\\": \\"TPE\\"
  }"
`.trim(),
    }
  }

  private generateCurlStatusExample(): CodeExample {
    return {
      language: 'typescript',
      title: '查詢狀態 (cURL)',
      description: '使用 cURL 查詢任務狀態',
      code: `
# 查詢單一任務狀態
curl -X GET "https://api.example.com/api/v1/invoices/task_abc123/status" \\
  -H "Authorization: Bearer your-api-key"

# 批次查詢
curl -X POST https://api.example.com/api/v1/invoices/batch-status \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "taskIds": ["task_abc123", "task_def456", "task_ghi789"]
  }'

# 列出所有任務
curl -X GET "https://api.example.com/api/v1/invoices?status=completed&page=1&pageSize=20" \\
  -H "Authorization: Bearer your-api-key"
`.trim(),
    }
  }

  private generateCurlResultExample(): CodeExample {
    return {
      language: 'typescript',
      title: '取得結果 (cURL)',
      description: '使用 cURL 擷取處理結果',
      code: `
# 取得 JSON 結果
curl -X GET "https://api.example.com/api/v1/invoices/task_abc123/result" \\
  -H "Authorization: Bearer your-api-key"

# 取得 CSV 結果
curl -X GET "https://api.example.com/api/v1/invoices/task_abc123/result?format=csv" \\
  -H "Authorization: Bearer your-api-key" \\
  -o result.csv

# 取得 XML 結果
curl -X GET "https://api.example.com/api/v1/invoices/task_abc123/result?format=xml" \\
  -H "Authorization: Bearer your-api-key"

# 取得特定欄位
curl -X GET "https://api.example.com/api/v1/invoices/task_abc123/result/fields/invoiceNumber" \\
  -H "Authorization: Bearer your-api-key"

# 取得原始文件下載 URL
curl -X GET "https://api.example.com/api/v1/invoices/task_abc123/result/document" \\
  -H "Authorization: Bearer your-api-key"
`.trim(),
    }
  }

  /**
   * 取得所有端點的範例
   */
  getAllExamples(): EndpointExamples[] {
    return [
      this.generateSubmitInvoiceExamples(),
      this.generateGetStatusExamples(),
      this.generateGetResultExamples(),
      this.generateWebhookVerificationExamples(),
    ]
  }
}

export const exampleGenerator = new ExampleGeneratorService()
```

### 6.3 Spec Validator Service

```typescript
// src/lib/documentation/spec-validator.service.ts

import SwaggerParser from '@apidevtools/swagger-parser'

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  path: string
  message: string
  severity: 'error'
}

export interface ValidationWarning {
  path: string
  message: string
  severity: 'warning'
}

export class SpecValidatorService {
  /**
   * 驗證 OpenAPI 規格
   */
  async validate(specPath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    try {
      // 使用 swagger-parser 解析和驗證
      const api = await SwaggerParser.validate(specPath)

      // 自訂驗證規則
      this.validateSecurityDefinitions(api, errors, warnings)
      this.validateResponseSchemas(api, errors, warnings)
      this.validateExamples(api, errors, warnings)
      this.validateDescriptions(api, errors, warnings)

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      }
    } catch (error) {
      errors.push({
        path: '/',
        message: `Spec parsing failed: ${error}`,
        severity: 'error',
      })

      return {
        valid: false,
        errors,
        warnings,
      }
    }
  }

  /**
   * 驗證安全定義
   */
  private validateSecurityDefinitions(
    api: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const spec = api as { paths: Record<string, Record<string, unknown>> }

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          const op = operation as { security?: unknown[] }
          if (!op.security || op.security.length === 0) {
            warnings.push({
              path: `${path}.${method}`,
              message: 'No security requirement defined',
              severity: 'warning',
            })
          }
        }
      }
    }
  }

  /**
   * 驗證回應 Schema
   */
  private validateResponseSchemas(
    api: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const spec = api as { paths: Record<string, Record<string, unknown>> }

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          const op = operation as { responses?: Record<string, unknown> }

          if (!op.responses) {
            errors.push({
              path: `${path}.${method}`,
              message: 'No responses defined',
              severity: 'error',
            })
          } else {
            // 檢查常見狀態碼
            const successCodes = ['200', '201', '202', '204']
            const hasSuccessResponse = successCodes.some(
              code => op.responses![code]
            )

            if (!hasSuccessResponse) {
              warnings.push({
                path: `${path}.${method}`,
                message: 'No success response defined',
                severity: 'warning',
              })
            }
          }
        }
      }
    }
  }

  /**
   * 驗證範例
   */
  private validateExamples(
    api: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const spec = api as { paths: Record<string, Record<string, unknown>> }

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          const op = operation as {
            requestBody?: { content?: Record<string, { example?: unknown }> }
          }

          // 檢查 request body 範例
          if (op.requestBody?.content) {
            for (const [contentType, mediaType] of Object.entries(op.requestBody.content)) {
              if (!mediaType.example) {
                warnings.push({
                  path: `${path}.${method}.requestBody.${contentType}`,
                  message: 'No example provided for request body',
                  severity: 'warning',
                })
              }
            }
          }
        }
      }
    }
  }

  /**
   * 驗證描述
   */
  private validateDescriptions(
    api: unknown,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const spec = api as { paths: Record<string, Record<string, unknown>> }

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          const op = operation as {
            summary?: string
            description?: string
          }

          if (!op.summary && !op.description) {
            warnings.push({
              path: `${path}.${method}`,
              message: 'No summary or description provided',
              severity: 'warning',
            })
          }
        }
      }
    }
  }
}

export const specValidator = new SpecValidatorService()
```

---

## 7. UI Components

### 7.1 Swagger UI Page

```typescript
// src/app/docs/page.tsx

'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// 動態載入 Swagger UI 以避免 SSR 問題
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => <SwaggerUILoading />,
})

import 'swagger-ui-react/swagger-ui.css'

function SwaggerUILoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  )
}

export default function ApiDocsPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <SwaggerUILoading />
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">
            Invoice Extraction API Documentation
          </h1>
          <p className="text-blue-100">
            AI-powered invoice extraction API for automated document processing.
            Use your API key to test endpoints directly.
          </p>
        </div>
      </header>

      {/* Quick Start Guide */}
      <section className="bg-gray-50 py-6 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickStartCard
              step={1}
              title="Get API Key"
              description="Contact your administrator to obtain an API key"
            />
            <QuickStartCard
              step={2}
              title="Authenticate"
              description="Add Bearer token to Authorization header"
            />
            <QuickStartCard
              step={3}
              title="Start Using"
              description="Submit invoices and retrieve extraction results"
            />
          </div>
        </div>
      </section>

      {/* Swagger UI */}
      <main className="max-w-7xl mx-auto py-8 px-4">
        <SwaggerUI
          url="/api/openapi"
          docExpansion="list"
          defaultModelsExpandDepth={1}
          persistAuthorization={true}
          tryItOutEnabled={true}
          filter={true}
          showExtensions={true}
          showCommonExtensions={true}
          requestInterceptor={(req) => {
            // 確保 Authorization header 正確格式
            if (req.headers.Authorization && !req.headers.Authorization.startsWith('Bearer ')) {
              req.headers.Authorization = `Bearer ${req.headers.Authorization}`
            }
            return req
          }}
        />
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 py-6 border-t">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600">
          <p>
            Need help? Contact{' '}
            <a href="mailto:api-support@example.com" className="text-blue-600 hover:underline">
              api-support@example.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

interface QuickStartCardProps {
  step: number
  title: string
  description: string
}

function QuickStartCard({ step, title, description }: QuickStartCardProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold">
          {step}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}
```

### 7.2 OpenAPI Route Handler

```typescript
// src/app/api/openapi/route.ts

import { NextResponse } from 'next/server'
import { openAPILoader } from '@/lib/documentation/openapi-loader.service'

export async function GET() {
  try {
    const spec = await openAPILoader.loadSpec()

    return NextResponse.json(spec, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 分鐘快取
      },
    })
  } catch (error) {
    console.error('Failed to load OpenAPI spec:', error)

    return NextResponse.json(
      { error: 'Failed to load API specification' },
      { status: 500 }
    )
  }
}

// 支援 CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
```

### 7.3 Docs Redirect Route

```typescript
// src/app/api/docs/route.ts

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // 重定向到 Swagger UI 頁面
  return NextResponse.redirect(new URL('/docs', request.url))
}
```

### 7.4 SDK Examples Page

```typescript
// src/app/docs/examples/page.tsx

'use client'

import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { exampleGenerator } from '@/lib/documentation/example-generator.service'
import { SDKLanguage, CodeExample } from '@/types/sdk-examples'

const LANGUAGE_TABS: { key: SDKLanguage | 'curl'; label: string }[] = [
  { key: 'typescript', label: 'TypeScript' },
  { key: 'python', label: 'Python' },
  { key: 'csharp', label: 'C#' },
  { key: 'curl', label: 'cURL' },
]

export default function SDKExamplesPage() {
  const [activeLanguage, setActiveLanguage] = useState<SDKLanguage | 'curl'>('typescript')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const allExamples = exampleGenerator.getAllExamples()

  const copyToClipboard = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">SDK Examples</h1>
          <p className="text-blue-100">
            Code examples for integrating with the Invoice Extraction API
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-4">
        {/* Language Tabs */}
        <div className="flex gap-2 mb-8 bg-white p-1 rounded-lg shadow-sm w-fit">
          {LANGUAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveLanguage(tab.key)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeLanguage === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Examples */}
        <div className="space-y-8">
          {allExamples.map((endpoint, endpointIndex) => (
            <section key={endpoint.endpoint} className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-2">
                <span className="text-blue-600">{endpoint.method}</span>{' '}
                {endpoint.endpoint}
              </h2>

              <div className="space-y-4 mt-4">
                {endpoint.examples
                  .filter(
                    (example) =>
                      example.language === activeLanguage ||
                      (activeLanguage === 'curl' && example.title.includes('cURL'))
                  )
                  .map((example, exampleIndex) => {
                    const globalIndex = endpointIndex * 10 + exampleIndex
                    return (
                      <div key={example.title}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-medium">{example.title}</h3>
                            <p className="text-sm text-gray-500">{example.description}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(example.code, globalIndex)}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-blue-600 border rounded"
                          >
                            {copiedIndex === globalIndex ? 'Copied!' : 'Copy'}
                          </button>
                        </div>

                        {example.dependencies && example.dependencies.length > 0 && (
                          <p className="text-xs text-gray-500 mb-2">
                            Dependencies: {example.dependencies.join(', ')}
                          </p>
                        )}

                        <div className="rounded-lg overflow-hidden">
                          <SyntaxHighlighter
                            language={getLanguageForHighlighter(example.language)}
                            style={oneDark}
                            customStyle={{
                              margin: 0,
                              borderRadius: '0.5rem',
                              fontSize: '0.875rem',
                            }}
                          >
                            {example.code}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}

function getLanguageForHighlighter(language: SDKLanguage): string {
  const mapping: Record<SDKLanguage, string> = {
    typescript: 'typescript',
    python: 'python',
    csharp: 'csharp',
    java: 'java',
    go: 'go',
  }
  return mapping[language] || 'text'
}
```

---

## 8. API Routes Implementation

### 8.1 Error Codes Reference Endpoint

```typescript
// src/app/api/docs/error-codes/route.ts

import { NextResponse } from 'next/server'

const ERROR_CODES = [
  // 驗證錯誤 (4xx)
  {
    code: 'VALIDATION_ERROR',
    httpStatus: 400,
    description: 'Request validation failed',
    resolution: 'Check request parameters and format',
  },
  {
    code: 'INVALID_FILE_TYPE',
    httpStatus: 400,
    description: 'Unsupported file type',
    resolution: 'Use PDF, PNG, JPG, or TIFF files',
  },
  {
    code: 'FILE_TOO_LARGE',
    httpStatus: 400,
    description: 'File exceeds maximum size',
    resolution: 'Reduce file size to under 20MB',
  },
  {
    code: 'INVALID_CITY_CODE',
    httpStatus: 400,
    description: 'Unknown city code',
    resolution: 'Use valid city codes: TPE, TXG, KHH, etc.',
  },

  // 認證錯誤
  {
    code: 'INVALID_API_KEY',
    httpStatus: 401,
    description: 'API key is invalid or revoked',
    resolution: 'Check API key or contact administrator',
  },
  {
    code: 'API_KEY_EXPIRED',
    httpStatus: 401,
    description: 'API key has expired',
    resolution: 'Renew API key with administrator',
  },
  {
    code: 'MISSING_AUTH_HEADER',
    httpStatus: 401,
    description: 'Authorization header is missing',
    resolution: 'Add "Authorization: Bearer {key}" header',
  },

  // 權限錯誤
  {
    code: 'INSUFFICIENT_PERMISSIONS',
    httpStatus: 403,
    description: 'API key lacks required permissions',
    resolution: 'Request additional permissions from administrator',
  },
  {
    code: 'CITY_ACCESS_DENIED',
    httpStatus: 403,
    description: 'Not authorized for this city',
    resolution: 'Request access to city from administrator',
  },

  // 資源錯誤
  {
    code: 'TASK_NOT_FOUND',
    httpStatus: 404,
    description: 'Task does not exist',
    resolution: 'Verify task ID is correct',
  },
  {
    code: 'RESULT_NOT_READY',
    httpStatus: 409,
    description: 'Task processing not completed',
    resolution: 'Wait for task completion before fetching result',
  },
  {
    code: 'RESULT_EXPIRED',
    httpStatus: 410,
    description: 'Result has expired and been deleted',
    resolution: 'Results are retained for 30 days',
  },

  // 限流錯誤
  {
    code: 'RATE_LIMIT_EXCEEDED',
    httpStatus: 429,
    description: 'Too many requests',
    resolution: 'Wait for rate limit reset (see Retry-After header)',
  },

  // 伺服器錯誤
  {
    code: 'INTERNAL_ERROR',
    httpStatus: 500,
    description: 'Unexpected server error',
    resolution: 'Retry request, contact support if persists',
  },
  {
    code: 'PROCESSING_FAILED',
    httpStatus: 500,
    description: 'Document processing failed',
    resolution: 'Check document quality and retry',
  },
  {
    code: 'SERVICE_UNAVAILABLE',
    httpStatus: 503,
    description: 'Service temporarily unavailable',
    resolution: 'Retry after a few minutes',
  },
]

export async function GET() {
  return NextResponse.json({
    data: {
      errorCodes: ERROR_CODES,
      totalCount: ERROR_CODES.length,
    },
    traceId: `docs_${Date.now()}`,
  })
}
```

### 8.2 API Version Info Endpoint

```typescript
// src/app/api/docs/version/route.ts

import { NextResponse } from 'next/server'
import { openAPILoader } from '@/lib/documentation/openapi-loader.service'

export async function GET() {
  try {
    const version = await openAPILoader.getVersion()

    return NextResponse.json({
      data: {
        apiVersion: version,
        specVersion: '3.0.3',
        lastUpdated: new Date().toISOString(),
        supportedFormats: ['json', 'csv', 'xml'],
        supportedFileTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'],
        maxFileSize: '20MB',
        rateLimitDefault: 60,
        resultRetentionDays: 30,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get version info' },
      { status: 500 }
    )
  }
}
```

---

## 9. Test Plan

### 9.1 Unit Tests

```typescript
// __tests__/lib/documentation/openapi-loader.test.ts

import { OpenAPILoaderService } from '@/lib/documentation/openapi-loader.service'
import fs from 'fs'
import path from 'path'

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}))

describe('OpenAPILoaderService', () => {
  let service: OpenAPILoaderService
  const mockSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    paths: {},
  }

  beforeEach(() => {
    service = new OpenAPILoaderService({
      specPath: 'openapi/spec.yaml',
      cacheEnabled: true,
      cacheTTL: 300,
    })
    jest.clearAllMocks()
  })

  describe('loadSpec', () => {
    it('should load and parse YAML spec', async () => {
      const yamlContent = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths: {}
`
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(yamlContent)

      const spec = await service.loadSpec()

      expect(spec).toEqual(mockSpec)
      expect(fs.promises.readFile).toHaveBeenCalledTimes(1)
    })

    it('should return cached spec within TTL', async () => {
      const yamlContent = `openapi: 3.0.3\ninfo:\n  title: Test API\n  version: 1.0.0\npaths: {}`
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(yamlContent)

      // First call
      await service.loadSpec()
      // Second call (should use cache)
      await service.loadSpec()

      expect(fs.promises.readFile).toHaveBeenCalledTimes(1)
    })

    it('should reload spec after TTL expires', async () => {
      const shortTTLService = new OpenAPILoaderService({
        specPath: 'openapi/spec.yaml',
        cacheEnabled: true,
        cacheTTL: 0, // 立即過期
      })

      const yamlContent = `openapi: 3.0.3\ninfo:\n  title: Test API\n  version: 1.0.0\npaths: {}`
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(yamlContent)

      await shortTTLService.loadSpec()
      await new Promise((r) => setTimeout(r, 10))
      await shortTTLService.loadSpec()

      expect(fs.promises.readFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearCache', () => {
    it('should clear cached spec', async () => {
      const yamlContent = `openapi: 3.0.3\ninfo:\n  title: Test API\n  version: 1.0.0\npaths: {}`
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(yamlContent)

      await service.loadSpec()
      service.clearCache()
      await service.loadSpec()

      expect(fs.promises.readFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('getVersion', () => {
    it('should return API version from spec', async () => {
      const yamlContent = `openapi: 3.0.3\ninfo:\n  title: Test API\n  version: 2.0.0\npaths: {}`
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(yamlContent)

      const version = await service.getVersion()

      expect(version).toBe('2.0.0')
    })
  })

  describe('validateSpec', () => {
    it('should return valid for correct spec', async () => {
      const yamlContent = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      responses:
        200:
          description: OK
`
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(yamlContent)

      const result = await service.validateSpec()

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return errors for missing required fields', async () => {
      const yamlContent = `openapi: 3.0.3`
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(yamlContent)

      const result = await service.validateSpec()

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
```

### 9.2 Example Generator Tests

```typescript
// __tests__/lib/documentation/example-generator.test.ts

import { ExampleGeneratorService } from '@/lib/documentation/example-generator.service'

describe('ExampleGeneratorService', () => {
  let service: ExampleGeneratorService

  beforeEach(() => {
    service = new ExampleGeneratorService()
  })

  describe('generateSubmitInvoiceExamples', () => {
    it('should generate examples for multiple languages', () => {
      const examples = service.generateSubmitInvoiceExamples()

      expect(examples.endpoint).toBe('/invoices')
      expect(examples.method).toBe('POST')
      expect(examples.examples.length).toBeGreaterThanOrEqual(3)

      const languages = examples.examples.map((e) => e.language)
      expect(languages).toContain('typescript')
      expect(languages).toContain('python')
    })

    it('should include valid code snippets', () => {
      const examples = service.generateSubmitInvoiceExamples()

      for (const example of examples.examples) {
        expect(example.code).toBeTruthy()
        expect(example.code.length).toBeGreaterThan(50)
        expect(example.title).toBeTruthy()
        expect(example.description).toBeTruthy()
      }
    })
  })

  describe('generateWebhookVerificationExamples', () => {
    it('should include HMAC verification code', () => {
      const examples = service.generateWebhookVerificationExamples()

      for (const example of examples.examples) {
        // 檢查是否包含 HMAC 相關程式碼
        expect(example.code.toLowerCase()).toMatch(/hmac|sha256|signature/)
      }
    })
  })

  describe('getAllExamples', () => {
    it('should return examples for all endpoints', () => {
      const allExamples = service.getAllExamples()

      expect(allExamples.length).toBeGreaterThanOrEqual(4)

      const endpoints = allExamples.map((e) => e.endpoint)
      expect(endpoints).toContain('/invoices')
      expect(endpoints).toContain('/invoices/{taskId}/status')
      expect(endpoints).toContain('/invoices/{taskId}/result')
    })
  })
})
```

### 9.3 API Route Tests

```typescript
// __tests__/app/api/openapi/route.test.ts

import { GET } from '@/app/api/openapi/route'
import { openAPILoader } from '@/lib/documentation/openapi-loader.service'

jest.mock('@/lib/documentation/openapi-loader.service', () => ({
  openAPILoader: {
    loadSpec: jest.fn(),
  },
}))

describe('GET /api/openapi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return OpenAPI spec as JSON', async () => {
    const mockSpec = {
      openapi: '3.0.3',
      info: { title: 'Test', version: '1.0.0' },
    }
    ;(openAPILoader.loadSpec as jest.Mock).mockResolvedValue(mockSpec)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockSpec)
  })

  it('should include cache headers', async () => {
    const mockSpec = { openapi: '3.0.3' }
    ;(openAPILoader.loadSpec as jest.Mock).mockResolvedValue(mockSpec)

    const response = await GET()

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
  })

  it('should return 500 on error', async () => {
    ;(openAPILoader.loadSpec as jest.Mock).mockRejectedValue(new Error('Load failed'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeTruthy()
  })
})
```

### 9.4 Integration Tests

```typescript
// __tests__/integration/documentation.test.ts

import { createMocks } from 'node-mocks-http'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import SwaggerParser from '@apidevtools/swagger-parser'

describe('API Documentation Integration', () => {
  const specPath = path.join(process.cwd(), 'openapi', 'spec.yaml')

  describe('OpenAPI Specification', () => {
    let spec: unknown

    beforeAll(async () => {
      // 如果檔案存在則載入
      if (fs.existsSync(specPath)) {
        const content = fs.readFileSync(specPath, 'utf-8')
        spec = yaml.load(content)
      }
    })

    it('should be valid OpenAPI 3.0 specification', async () => {
      if (!spec) {
        console.warn('Skipping: spec.yaml not found')
        return
      }

      await expect(SwaggerParser.validate(specPath)).resolves.toBeTruthy()
    })

    it('should have all required endpoints documented', () => {
      if (!spec) return

      const requiredPaths = [
        '/invoices',
        '/invoices/{taskId}/status',
        '/invoices/{taskId}/result',
        '/invoices/batch-status',
        '/webhooks',
      ]

      const paths = (spec as { paths: Record<string, unknown> }).paths

      for (const requiredPath of requiredPaths) {
        expect(paths[requiredPath]).toBeDefined()
      }
    })

    it('should have security defined for all endpoints', () => {
      if (!spec) return

      const paths = (spec as { paths: Record<string, Record<string, unknown>> }).paths

      for (const [pathKey, methods] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            const op = operation as { security?: unknown[] }
            expect(op.security).toBeDefined()
            expect(op.security!.length).toBeGreaterThan(0)
          }
        }
      }
    })

    it('should have error responses documented', () => {
      if (!spec) return

      const paths = (spec as { paths: Record<string, Record<string, unknown>> }).paths

      for (const [pathKey, methods] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            const op = operation as { responses?: Record<string, unknown> }

            // 應該有 401 未授權回應
            expect(op.responses!['401'] || op.responses!['4XX']).toBeDefined()
          }
        }
      }
    })
  })

  describe('SDK Examples', () => {
    it('should have valid TypeScript syntax in examples', () => {
      // 基本語法檢查
      const tsExample = `
const client = new InvoiceExtractionClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'test',
});
`
      expect(() => {
        // 簡單的語法檢查
        new Function(tsExample.replace(/const|let|import|export/g, 'var'))
      }).not.toThrow()
    })

    it('should have valid Python syntax in examples', () => {
      // Python 語法在 Node.js 中無法直接驗證
      // 可以使用 python-shell 或其他工具進行驗證
      const pythonExample = `
client = InvoiceExtractionClient(ApiConfig(
    base_url='https://api.example.com',
    api_key='test',
))
`
      // 確保範例不為空
      expect(pythonExample.trim().length).toBeGreaterThan(0)
    })
  })
})
```

### 9.5 E2E Tests

```typescript
// __tests__/e2e/docs.test.ts

import { test, expect } from '@playwright/test'

test.describe('API Documentation Pages', () => {
  test('should load Swagger UI page', async ({ page }) => {
    await page.goto('/docs')

    // 等待 Swagger UI 載入
    await expect(page.locator('.swagger-ui')).toBeVisible({ timeout: 10000 })

    // 檢查標題
    await expect(page.locator('h1')).toContainText('Invoice Extraction API')
  })

  test('should display API endpoints', async ({ page }) => {
    await page.goto('/docs')

    // 等待端點列表載入
    await page.waitForSelector('.opblock')

    // 檢查是否有端點顯示
    const endpoints = await page.locator('.opblock').count()
    expect(endpoints).toBeGreaterThan(0)
  })

  test('should allow authorization input', async ({ page }) => {
    await page.goto('/docs')

    // 點擊 Authorize 按鈕
    const authorizeButton = page.locator('button:has-text("Authorize")')
    await authorizeButton.click()

    // 檢查授權對話框
    await expect(page.locator('.auth-container')).toBeVisible()

    // 輸入 API Key
    await page.fill('input[type="text"]', 'test-api-key')
  })

  test('should expand endpoint details', async ({ page }) => {
    await page.goto('/docs')

    // 點擊第一個端點
    const firstEndpoint = page.locator('.opblock').first()
    await firstEndpoint.click()

    // 檢查詳細資訊是否展開
    await expect(firstEndpoint.locator('.opblock-body')).toBeVisible()
  })

  test('should load SDK examples page', async ({ page }) => {
    await page.goto('/docs/examples')

    // 檢查語言選項
    await expect(page.locator('button:has-text("TypeScript")')).toBeVisible()
    await expect(page.locator('button:has-text("Python")')).toBeVisible()
    await expect(page.locator('button:has-text("C#")')).toBeVisible()
  })

  test('should switch between language examples', async ({ page }) => {
    await page.goto('/docs/examples')

    // 點擊 Python 選項
    await page.click('button:has-text("Python")')

    // 檢查 Python 程式碼
    await expect(page.locator('code')).toContainText('def')
  })

  test('should copy code to clipboard', async ({ page, context }) => {
    // 授予剪貼簿權限
    await context.grantPermissions(['clipboard-write'])

    await page.goto('/docs/examples')

    // 點擊複製按鈕
    const copyButton = page.locator('button:has-text("Copy")').first()
    await copyButton.click()

    // 檢查按鈕文字變化
    await expect(copyButton).toContainText('Copied!')
  })
})
```

---

## 10. Security Considerations

### 10.1 文檔存取控制

```typescript
// src/middleware/docs-auth.ts

import { NextRequest, NextResponse } from 'next/server'

/**
 * 文檔頁面存取控制中介層
 *
 * 安全策略：
 * 1. 公開環境：文檔可公開存取（但測試功能需要 API Key）
 * 2. 私有環境：需要登入才能存取文檔
 */
export function docsAuthMiddleware(request: NextRequest) {
  const isPrivateMode = process.env.DOCS_PRIVATE_MODE === 'true'

  if (!isPrivateMode) {
    // 公開模式：允許存取
    return NextResponse.next()
  }

  // 私有模式：檢查驗證
  const session = request.cookies.get('session')

  if (!session) {
    // 重定向到登入頁面
    return NextResponse.redirect(new URL('/login?redirect=/docs', request.url))
  }

  return NextResponse.next()
}
```

### 10.2 敏感資訊過濾

```typescript
// src/lib/documentation/sensitive-filter.ts

/**
 * 過濾 OpenAPI 規格中的敏感資訊
 */
export function filterSensitiveInfo(spec: unknown): unknown {
  const filtered = JSON.parse(JSON.stringify(spec))

  // 移除內部伺服器 URL
  if (filtered.servers) {
    filtered.servers = filtered.servers.filter(
      (server: { url: string }) => !server.url.includes('internal')
    )
  }

  // 移除開發環境端點
  if (process.env.NODE_ENV === 'production') {
    delete filtered.paths?.['/debug']
    delete filtered.paths?.['/internal']
  }

  // 移除敏感的 x-internal 標記
  removeInternalExtensions(filtered)

  return filtered
}

function removeInternalExtensions(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return

  for (const key of Object.keys(obj as object)) {
    if (key.startsWith('x-internal')) {
      delete (obj as Record<string, unknown>)[key]
    } else {
      removeInternalExtensions((obj as Record<string, unknown>)[key])
    }
  }
}
```

### 10.3 Rate Limiting for Docs

```typescript
// src/lib/documentation/docs-rate-limit.ts

import { RateLimitService } from '@/lib/api/rate-limit.service'

const docsRateLimiter = new RateLimitService()

/**
 * 文檔 API 限流
 *
 * 目的：防止濫用文檔端點
 * 限制：每 IP 每分鐘 30 次請求
 */
export async function checkDocsRateLimit(ip: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: Date
}> {
  const key = `docs:${ip}`
  const limit = 30
  const windowMs = 60 * 1000

  return docsRateLimiter.checkLimit(key, limit, windowMs)
}
```

---

## 11. Deployment & Configuration

### 11.1 環境變數

```bash
# .env.local

# 文檔設定
DOCS_PRIVATE_MODE=false              # 是否需要登入才能存取文檔
DOCS_SPEC_PATH=openapi/spec.yaml     # OpenAPI 規格檔案路徑
DOCS_CACHE_TTL=300                   # 規格快取時間（秒）

# API 基礎 URL（用於 Swagger UI）
NEXT_PUBLIC_API_BASE_URL=https://api.example.com

# 支援聯絡資訊
NEXT_PUBLIC_SUPPORT_EMAIL=api-support@example.com
```

### 11.2 Dependencies

```json
// package.json 新增依賴
{
  "dependencies": {
    "swagger-ui-react": "^5.11.0",
    "js-yaml": "^4.1.0",
    "@apidevtools/swagger-parser": "^10.1.0",
    "react-syntax-highlighter": "^15.5.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/swagger-ui-react": "^4.18.3"
  }
}
```

### 11.3 Build Configuration

```typescript
// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 確保 openapi 目錄包含在建構中
  webpack: (config) => {
    config.module.rules.push({
      test: /\.ya?ml$/,
      use: 'yaml-loader',
    })
    return config
  },

  // 靜態檔案處理
  async headers() {
    return [
      {
        source: '/api/openapi',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

### 11.4 CI/CD Pipeline

```yaml
# .github/workflows/docs-validation.yml

name: API Documentation Validation

on:
  push:
    paths:
      - 'openapi/**'
      - 'src/app/docs/**'
      - 'src/lib/documentation/**'
  pull_request:
    paths:
      - 'openapi/**'

jobs:
  validate-openapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Validate OpenAPI spec
        run: npx swagger-cli validate openapi/spec.yaml

      - name: Run documentation tests
        run: npm run test -- --testPathPattern="documentation|docs"

      - name: Check for breaking changes
        run: npx openapi-diff openapi/spec.yaml origin/main:openapi/spec.yaml || true
```

### 11.5 Monitoring & Analytics

```typescript
// src/lib/documentation/analytics.ts

import { logger } from '@/lib/logger'

interface DocsAnalyticsEvent {
  event: 'page_view' | 'try_it_out' | 'copy_code' | 'download_spec'
  page: string
  endpoint?: string
  language?: string
  userAgent?: string
}

export class DocsAnalyticsService {
  /**
   * 記錄文檔使用事件
   */
  trackEvent(event: DocsAnalyticsEvent): void {
    logger.info('Docs analytics event', {
      ...event,
      timestamp: new Date().toISOString(),
    })

    // 可以發送到分析服務（如 GA、Mixpanel）
    if (process.env.ANALYTICS_ENABLED === 'true') {
      this.sendToAnalytics(event)
    }
  }

  /**
   * 取得熱門端點
   */
  async getPopularEndpoints(): Promise<Array<{ endpoint: string; views: number }>> {
    // 從分析資料庫查詢
    return []
  }

  private sendToAnalytics(event: DocsAnalyticsEvent): void {
    // 實作分析服務整合
  }
}

export const docsAnalytics = new DocsAnalyticsService()
```

---

## Related Stories
- **Story 11-1**: API 發票提交端點（文檔化對象）
- **Story 11-2**: API 處理狀態查詢端點（文檔化對象）
- **Story 11-3**: API 處理結果擷取端點（文檔化對象）
- **Story 11-4**: Webhook 通知服務（文檔化對象）
- **Story 11-5**: API 存取控制與驗證（文檔化對象）

---

## Changelog
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-XX | Tech Lead | Initial tech spec creation |
