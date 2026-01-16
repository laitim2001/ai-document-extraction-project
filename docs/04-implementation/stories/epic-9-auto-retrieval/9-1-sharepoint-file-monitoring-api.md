# Story 9-1: SharePoint 文件監控 API

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 9: 自動化文件獲取 |
| Story ID | 9.1 |
| 標題 | SharePoint 文件監控 API |
| FR 覆蓋 | FR2 |
| 狀態 | done |
| 優先級 | High |
| 估計點數 | 8 |

---

## 用戶故事

**As a** 系統,
**I want** 提供 API 供外部獲取 SharePoint 文件並提交處理,
**So that** n8n 可以監控 SharePoint 並自動提交新文件。

---

## 驗收標準

### AC1: API 接收 SharePoint 文件提交

**Given** 外部系統（n8n）偵測到 SharePoint 新文件
**When** 調用平台 API 提交文件
**Then** API 接受以下參數：
- 文件 URL（SharePoint 位置）
- 來源城市代碼
- 來源類型（sharepoint）
- 原始文件名

### AC2: 文件下載與處理任務創建

**Given** 平台接收到 SharePoint 文件提交請求
**When** 處理請求
**Then** 系統從 SharePoint URL 下載文件
**And** 儲存至 Azure Blob Storage
**And** 創建處理任務（進入 Epic 2 的處理流程）

### AC3: 成功響應

**Given** SharePoint 文件下載
**When** 下載成功
**Then** 返回處理任務 ID
**And** 可用於後續狀態查詢

### AC4: 錯誤處理

**Given** SharePoint 文件下載
**When** 下載失敗（權限問題、文件不存在）
**Then** 返回適當的錯誤代碼和訊息
**And** 記錄錯誤至日誌

---

## 技術實作規格

### 1. 資料模型

#### Prisma Schema 擴展

```prisma
// 文件來源類型
enum DocumentSourceType {
  MANUAL_UPLOAD   // 手動上傳
  SHAREPOINT      // SharePoint
  OUTLOOK         // Outlook 郵件附件
  API             // 外部 API
}

// 擴展 Document 模型
model Document {
  id                String              @id @default(cuid())

  // 現有欄位...
  originalFileName  String
  fileUrl           String
  fileSize          BigInt
  mimeType          String
  status            DocumentStatus      @default(PENDING)

  // 來源追蹤欄位（新增）
  sourceType        DocumentSourceType  @default(MANUAL_UPLOAD)
  sourceMetadata    Json?               // 來源詳細資訊

  // SharePoint 特定欄位
  sharepointItemId  String?             // SharePoint Item ID
  sharepointDriveId String?             // SharePoint Drive ID
  sharepointSiteId  String?             // SharePoint Site ID
  sharepointUrl     String?             // 原始 SharePoint URL

  // 城市關聯
  cityId            String
  city              City                @relation(fields: [cityId], references: [id])

  // 上傳/獲取者
  uploadedById      String?
  uploadedBy        User?               @relation(fields: [uploadedById], references: [id])

  // 時間戳
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  processedAt       DateTime?

  // 關聯
  processingJob     ProcessingJob?

  @@index([sourceType])
  @@index([cityId])
  @@index([status])
  @@index([createdAt])
  @@index([sharepointItemId])
}

// SharePoint 配置
model SharePointConfig {
  id                String    @id @default(cuid())

  // 配置識別
  name              String
  description       String?

  // 連線設定
  siteUrl           String    // SharePoint Site URL
  tenantId          String    // Azure AD Tenant ID
  clientId          String    // Application ID
  clientSecret      String    // 加密儲存的 Client Secret

  // 文件庫設定
  driveId           String?   // Document Library Drive ID
  libraryPath       String    // 文件庫路徑

  // 城市關聯（可選）
  cityId            String?
  city              City?     @relation(fields: [cityId], references: [id])

  // 狀態
  isActive          Boolean   @default(true)
  lastTestedAt      DateTime?
  lastTestResult    Boolean?
  lastTestError     String?

  // 時間戳
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdById       String
  createdBy         User      @relation(fields: [createdById], references: [id])

  @@index([cityId])
  @@index([isActive])
}

// SharePoint 文件獲取日誌
model SharePointFetchLog {
  id                String                @id @default(cuid())

  // 請求資訊
  sharepointUrl     String
  sharepointItemId  String?
  fileName          String
  fileSize          BigInt?

  // 來源配置
  configId          String?
  config            SharePointConfig?     @relation(fields: [configId], references: [id])
  cityId            String

  // 結果
  status            SharePointFetchStatus @default(PENDING)
  documentId        String?               // 成功時的 Document ID
  document          Document?             @relation(fields: [documentId], references: [id])

  // 錯誤資訊
  errorCode         String?
  errorMessage      String?
  errorDetails      Json?

  // API 請求資訊
  requestIp         String?
  requestUserAgent  String?

  // 時間戳
  createdAt         DateTime              @default(now())
  completedAt       DateTime?

  @@index([sharepointUrl])
  @@index([status])
  @@index([cityId])
  @@index([createdAt])
}

// SharePoint 獲取狀態
enum SharePointFetchStatus {
  PENDING           // 待處理
  DOWNLOADING       // 下載中
  PROCESSING        // 處理中
  COMPLETED         // 已完成
  FAILED            // 失敗
  DUPLICATE         // 重複文件
}
```

### 2. Microsoft Graph API 服務

```typescript
// lib/services/microsoft-graph.service.ts
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials'

// Graph API 配置
export interface GraphApiConfig {
  tenantId: string
  clientId: string
  clientSecret: string
}

// SharePoint 文件資訊
export interface SharePointFileInfo {
  id: string
  name: string
  size: number
  mimeType: string
  webUrl: string
  driveId: string
  siteId: string
  createdDateTime: string
  lastModifiedDateTime: string
  downloadUrl: string
}

export class MicrosoftGraphService {
  private client: Client

  constructor(private config: GraphApiConfig) {
    this.initializeClient()
  }

  private initializeClient(): void {
    const credential = new ClientSecretCredential(
      this.config.tenantId,
      this.config.clientId,
      this.config.clientSecret
    )

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    })

    this.client = Client.initWithMiddleware({
      authProvider
    })
  }

  // 從 SharePoint URL 解析文件資訊
  async getFileInfoFromUrl(sharepointUrl: string): Promise<SharePointFileInfo> {
    // 解析 SharePoint URL
    const urlParts = this.parseSharePointUrl(sharepointUrl)

    if (!urlParts) {
      throw new Error('Invalid SharePoint URL format')
    }

    try {
      // 使用 shares API 解析共享連結
      const encodedUrl = this.encodeSharePointUrl(sharepointUrl)

      const shareResponse = await this.client
        .api(`/shares/${encodedUrl}/driveItem`)
        .get()

      const downloadUrl = await this.getDownloadUrl(
        shareResponse.parentReference.driveId,
        shareResponse.id
      )

      return {
        id: shareResponse.id,
        name: shareResponse.name,
        size: shareResponse.size,
        mimeType: shareResponse.file?.mimeType || 'application/octet-stream',
        webUrl: shareResponse.webUrl,
        driveId: shareResponse.parentReference.driveId,
        siteId: shareResponse.parentReference.siteId,
        createdDateTime: shareResponse.createdDateTime,
        lastModifiedDateTime: shareResponse.lastModifiedDateTime,
        downloadUrl
      }
    } catch (error) {
      // 嘗試使用直接路徑方式
      return this.getFileInfoFromPath(urlParts.siteUrl, urlParts.filePath)
    }
  }

  // 從站點路徑獲取文件
  private async getFileInfoFromPath(
    siteUrl: string,
    filePath: string
  ): Promise<SharePointFileInfo> {
    // 獲取站點 ID
    const siteId = await this.getSiteId(siteUrl)

    // 獲取文件
    const file = await this.client
      .api(`/sites/${siteId}/drive/root:/${filePath}`)
      .get()

    const downloadUrl = await this.getDownloadUrl(
      file.parentReference.driveId,
      file.id
    )

    return {
      id: file.id,
      name: file.name,
      size: file.size,
      mimeType: file.file?.mimeType || 'application/octet-stream',
      webUrl: file.webUrl,
      driveId: file.parentReference.driveId,
      siteId: siteId,
      createdDateTime: file.createdDateTime,
      lastModifiedDateTime: file.lastModifiedDateTime,
      downloadUrl
    }
  }

  // 獲取站點 ID
  private async getSiteId(siteUrl: string): Promise<string> {
    const url = new URL(siteUrl)
    const hostname = url.hostname
    const sitePath = url.pathname

    const site = await this.client
      .api(`/sites/${hostname}:${sitePath}`)
      .get()

    return site.id
  }

  // 獲取下載 URL
  private async getDownloadUrl(driveId: string, itemId: string): Promise<string> {
    const item = await this.client
      .api(`/drives/${driveId}/items/${itemId}`)
      .select('@microsoft.graph.downloadUrl')
      .get()

    return item['@microsoft.graph.downloadUrl']
  }

  // 下載文件內容
  async downloadFile(downloadUrl: string): Promise<Buffer> {
    const response = await fetch(downloadUrl)

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  // 下載文件（使用 driveId 和 itemId）
  async downloadFileById(driveId: string, itemId: string): Promise<Buffer> {
    const stream = await this.client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .getStream()

    return this.streamToBuffer(stream)
  }

  // 測試連線
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // 嘗試獲取當前用戶資訊（驗證權限）
      await this.client.api('/organization').get()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  // 編碼 SharePoint URL 用於 shares API
  private encodeSharePointUrl(url: string): string {
    const base64 = Buffer.from(url).toString('base64')
    return 'u!' + base64.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-')
  }

  // 解析 SharePoint URL
  private parseSharePointUrl(url: string): { siteUrl: string; filePath: string } | null {
    try {
      const urlObj = new URL(url)

      // 處理不同格式的 SharePoint URL
      // 格式1: https://tenant.sharepoint.com/sites/SiteName/Shared Documents/file.pdf
      // 格式2: https://tenant.sharepoint.com/:f:/s/SiteName/...

      const pathParts = urlObj.pathname.split('/')
      const sitesIndex = pathParts.indexOf('sites') !== -1
        ? pathParts.indexOf('sites')
        : pathParts.indexOf('s')

      if (sitesIndex === -1) {
        return null
      }

      const siteUrl = `${urlObj.origin}/sites/${pathParts[sitesIndex + 1]}`
      const filePath = pathParts.slice(sitesIndex + 2).join('/')

      return { siteUrl, filePath: decodeURIComponent(filePath) }
    } catch {
      return null
    }
  }

  // Stream 轉 Buffer
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }
}
```

### 3. SharePoint 文件服務

```typescript
// lib/services/sharepoint-document.service.ts
import { MicrosoftGraphService, SharePointFileInfo } from './microsoft-graph.service'
import { BlobStorageService } from './blob-storage.service'
import { createHash } from 'crypto'

// 允許的文件類型
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/gif'
]

// 最大文件大小 (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024

// SharePoint 提交請求
export interface SharePointSubmitRequest {
  sharepointUrl: string
  cityCode: string
  originalFileName?: string
  metadata?: Record<string, any>
}

// SharePoint 提交結果
export interface SharePointSubmitResult {
  success: boolean
  documentId?: string
  processingJobId?: string
  error?: {
    code: string
    message: string
    details?: any
  }
}

export class SharePointDocumentService {
  constructor(
    private prisma: PrismaClient,
    private blobService: BlobStorageService
  ) {}

  // 提交 SharePoint 文件
  async submitDocument(
    request: SharePointSubmitRequest,
    requestContext: { ip?: string; userAgent?: string }
  ): Promise<SharePointSubmitResult> {
    // 建立獲取日誌
    const fetchLog = await this.prisma.sharePointFetchLog.create({
      data: {
        sharepointUrl: request.sharepointUrl,
        fileName: request.originalFileName || 'unknown',
        cityId: await this.getCityIdByCode(request.cityCode),
        requestIp: requestContext.ip,
        requestUserAgent: requestContext.userAgent,
        status: 'PENDING'
      }
    })

    try {
      // 獲取城市對應的 SharePoint 配置
      const config = await this.getSharePointConfig(request.cityCode)

      if (!config) {
        throw new SharePointError('CONFIG_NOT_FOUND', '找不到該城市的 SharePoint 配置')
      }

      // 初始化 Graph API 服務
      const graphService = new MicrosoftGraphService({
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: await this.decryptSecret(config.clientSecret)
      })

      // 更新狀態為下載中
      await this.updateFetchLog(fetchLog.id, { status: 'DOWNLOADING' })

      // 獲取文件資訊
      const fileInfo = await graphService.getFileInfoFromUrl(request.sharepointUrl)

      // 驗證文件
      await this.validateFile(fileInfo)

      // 檢查重複
      const isDuplicate = await this.checkDuplicate(fileInfo)
      if (isDuplicate) {
        await this.updateFetchLog(fetchLog.id, {
          status: 'DUPLICATE',
          errorCode: 'DUPLICATE_FILE',
          errorMessage: '文件已存在'
        })
        throw new SharePointError('DUPLICATE_FILE', '此文件已經提交過')
      }

      // 下載文件
      const fileBuffer = await graphService.downloadFile(fileInfo.downloadUrl)

      // 計算文件雜湊
      const fileHash = createHash('sha256').update(fileBuffer).digest('hex')

      // 上傳到 Blob Storage
      const blobPath = `documents/sharepoint/${request.cityCode}/${Date.now()}_${fileInfo.name}`
      const blobUrl = await this.blobService.uploadBuffer(
        fileBuffer,
        blobPath,
        fileInfo.mimeType,
        {
          sourceType: 'sharepoint',
          sharepointUrl: request.sharepointUrl,
          originalFileName: fileInfo.name
        }
      )

      // 更新狀態為處理中
      await this.updateFetchLog(fetchLog.id, { status: 'PROCESSING' })

      // 建立文件記錄
      const document = await this.prisma.document.create({
        data: {
          originalFileName: request.originalFileName || fileInfo.name,
          fileUrl: blobUrl,
          fileSize: BigInt(fileInfo.size),
          mimeType: fileInfo.mimeType,
          fileHash,
          sourceType: 'SHAREPOINT',
          sourceMetadata: {
            sharepointUrl: request.sharepointUrl,
            webUrl: fileInfo.webUrl,
            createdDateTime: fileInfo.createdDateTime,
            lastModifiedDateTime: fileInfo.lastModifiedDateTime,
            fetchedAt: new Date().toISOString()
          },
          sharepointItemId: fileInfo.id,
          sharepointDriveId: fileInfo.driveId,
          sharepointSiteId: fileInfo.siteId,
          sharepointUrl: request.sharepointUrl,
          cityId: await this.getCityIdByCode(request.cityCode),
          status: 'PENDING'
        }
      })

      // 建立處理任務
      const processingJob = await this.prisma.processingJob.create({
        data: {
          documentId: document.id,
          status: 'QUEUED',
          priority: 'NORMAL'
        }
      })

      // 更新獲取日誌為完成
      await this.updateFetchLog(fetchLog.id, {
        status: 'COMPLETED',
        documentId: document.id,
        fileSize: BigInt(fileInfo.size),
        sharepointItemId: fileInfo.id,
        completedAt: new Date()
      })

      return {
        success: true,
        documentId: document.id,
        processingJobId: processingJob.id
      }

    } catch (error) {
      const errorInfo = this.parseError(error)

      await this.updateFetchLog(fetchLog.id, {
        status: 'FAILED',
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        errorDetails: errorInfo.details
      })

      return {
        success: false,
        error: errorInfo
      }
    }
  }

  // 批次提交
  async submitDocumentsBatch(
    requests: SharePointSubmitRequest[],
    requestContext: { ip?: string; userAgent?: string }
  ): Promise<{
    total: number
    successful: number
    failed: number
    results: SharePointSubmitResult[]
  }> {
    const results: SharePointSubmitResult[] = []

    for (const request of requests) {
      const result = await this.submitDocument(request, requestContext)
      results.push(result)
    }

    return {
      total: requests.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  }

  // 驗證文件
  private async validateFile(fileInfo: SharePointFileInfo): Promise<void> {
    // 檢查文件類型
    if (!ALLOWED_MIME_TYPES.includes(fileInfo.mimeType)) {
      throw new SharePointError(
        'INVALID_FILE_TYPE',
        `不支援的文件類型: ${fileInfo.mimeType}`,
        { allowedTypes: ALLOWED_MIME_TYPES }
      )
    }

    // 檢查文件大小
    if (fileInfo.size > MAX_FILE_SIZE) {
      throw new SharePointError(
        'FILE_TOO_LARGE',
        `文件大小超過限制 (最大 ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        { fileSize: fileInfo.size, maxSize: MAX_FILE_SIZE }
      )
    }
  }

  // 檢查重複
  private async checkDuplicate(fileInfo: SharePointFileInfo): Promise<boolean> {
    const existing = await this.prisma.document.findFirst({
      where: {
        sharepointItemId: fileInfo.id,
        sharepointDriveId: fileInfo.driveId
      }
    })

    return !!existing
  }

  // 獲取 SharePoint 配置
  private async getSharePointConfig(cityCode: string): Promise<SharePointConfig | null> {
    const city = await this.prisma.city.findUnique({
      where: { code: cityCode }
    })

    if (!city) {
      throw new SharePointError('CITY_NOT_FOUND', `找不到城市: ${cityCode}`)
    }

    // 優先查找城市專屬配置
    let config = await this.prisma.sharePointConfig.findFirst({
      where: {
        cityId: city.id,
        isActive: true
      }
    })

    // 如果沒有城市專屬配置，使用全域配置
    if (!config) {
      config = await this.prisma.sharePointConfig.findFirst({
        where: {
          cityId: null,
          isActive: true
        }
      })
    }

    return config
  }

  // 解密密鑰
  private async decryptSecret(encryptedSecret: string): Promise<string> {
    // 使用 AES 解密（實際實作應使用 Azure Key Vault）
    const crypto = require('crypto')
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
    const [iv, encrypted] = encryptedSecret.split(':')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'))
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  // 更新獲取日誌
  private async updateFetchLog(id: string, data: Partial<SharePointFetchLog>): Promise<void> {
    await this.prisma.sharePointFetchLog.update({
      where: { id },
      data
    })
  }

  // 獲取城市 ID
  private async getCityIdByCode(cityCode: string): Promise<string> {
    const city = await this.prisma.city.findUnique({
      where: { code: cityCode }
    })

    if (!city) {
      throw new SharePointError('CITY_NOT_FOUND', `找不到城市: ${cityCode}`)
    }

    return city.id
  }

  // 解析錯誤
  private parseError(error: unknown): { code: string; message: string; details?: any } {
    if (error instanceof SharePointError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details
      }
    }

    if (error instanceof Error) {
      // Graph API 錯誤
      if (error.message.includes('ItemNotFound')) {
        return { code: 'FILE_NOT_FOUND', message: '找不到指定的文件' }
      }
      if (error.message.includes('AccessDenied')) {
        return { code: 'ACCESS_DENIED', message: '沒有權限存取此文件' }
      }
      if (error.message.includes('InvalidAuthenticationToken')) {
        return { code: 'AUTH_ERROR', message: '認證失敗，請檢查 SharePoint 配置' }
      }

      return { code: 'UNKNOWN_ERROR', message: error.message }
    }

    return { code: 'UNKNOWN_ERROR', message: '未知錯誤' }
  }
}

// 自定義錯誤類
class SharePointError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'SharePointError'
  }
}
```

### 4. API 路由

```typescript
// app/api/documents/from-sharepoint/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { SharePointDocumentService } from '@/lib/services/sharepoint-document.service'
import { z } from 'zod'
import { verifyApiKey } from '@/lib/auth/api-key'

// 請求驗證 Schema
const submitSchema = z.object({
  sharepointUrl: z.string().url('無效的 SharePoint URL'),
  cityCode: z.string().min(1, '城市代碼為必填'),
  originalFileName: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

const batchSubmitSchema = z.object({
  documents: z.array(submitSchema).min(1).max(50)
})

// POST - 提交單一文件
export async function POST(request: NextRequest) {
  // 驗證 API Key
  const apiKeyResult = await verifyApiKey(request)
  if (!apiKeyResult.valid) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_API_KEY' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    // 檢查是否為批次請求
    if (body.documents) {
      const validated = batchSubmitSchema.parse(body)

      const service = new SharePointDocumentService(prisma, blobService)
      const result = await service.submitDocumentsBatch(
        validated.documents,
        {
          ip: request.headers.get('x-forwarded-for') || request.ip,
          userAgent: request.headers.get('user-agent') || undefined
        }
      )

      return NextResponse.json(result)
    }

    // 單一文件請求
    const validated = submitSchema.parse(body)

    const service = new SharePointDocumentService(prisma, blobService)
    const result = await service.submitDocument(
      validated,
      {
        ip: request.headers.get('x-forwarded-for') || request.ip,
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          documentId: result.documentId,
          processingJobId: result.processingJobId,
          message: '文件已成功提交處理'
        }
      })
    } else {
      const statusCode = getStatusCodeFromError(result.error?.code)
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: statusCode }
      )
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '請求參數驗證失敗',
            details: error.errors
          }
        },
        { status: 400 }
      )
    }

    console.error('SharePoint submit error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '內部伺服器錯誤'
        }
      },
      { status: 500 }
    )
  }
}

// 根據錯誤碼獲取 HTTP 狀態碼
function getStatusCodeFromError(code?: string): number {
  const statusMap: Record<string, number> = {
    FILE_NOT_FOUND: 404,
    ACCESS_DENIED: 403,
    AUTH_ERROR: 401,
    INVALID_FILE_TYPE: 400,
    FILE_TOO_LARGE: 400,
    DUPLICATE_FILE: 409,
    CONFIG_NOT_FOUND: 404,
    CITY_NOT_FOUND: 404,
    VALIDATION_ERROR: 400
  }

  return statusMap[code || ''] || 500
}
```

```typescript
// app/api/documents/from-sharepoint/status/[fetchLogId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKey } from '@/lib/auth/api-key'

// GET - 查詢提交狀態
export async function GET(
  request: NextRequest,
  { params }: { params: { fetchLogId: string } }
) {
  const apiKeyResult = await verifyApiKey(request)
  if (!apiKeyResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const fetchLog = await prisma.sharePointFetchLog.findUnique({
      where: { id: params.fetchLogId },
      include: {
        document: {
          include: {
            processingJob: true
          }
        }
      }
    })

    if (!fetchLog) {
      return NextResponse.json(
        { error: 'Fetch log not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: fetchLog.id,
      status: fetchLog.status,
      sharepointUrl: fetchLog.sharepointUrl,
      fileName: fetchLog.fileName,
      documentId: fetchLog.documentId,
      processingJobId: fetchLog.document?.processingJob?.id,
      processingStatus: fetchLog.document?.processingJob?.status,
      error: fetchLog.errorCode ? {
        code: fetchLog.errorCode,
        message: fetchLog.errorMessage
      } : null,
      createdAt: fetchLog.createdAt,
      completedAt: fetchLog.completedAt
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    )
  }
}
```

### 5. API Key 驗證

```typescript
// lib/auth/api-key.ts
import { NextRequest } from 'next/server'
import { createHash } from 'crypto'

export interface ApiKeyResult {
  valid: boolean
  keyId?: string
  permissions?: string[]
  cityAccess?: string[]
  error?: string
}

export async function verifyApiKey(request: NextRequest): Promise<ApiKeyResult> {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')

  if (!apiKey) {
    return { valid: false, error: 'API key is required' }
  }

  // 雜湊 API Key 進行比對
  const hashedKey = createHash('sha256').update(apiKey).digest('hex')

  const keyRecord = await prisma.apiKey.findFirst({
    where: {
      keyHash: hashedKey,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    include: {
      permissions: true,
      cityAccess: true
    }
  })

  if (!keyRecord) {
    return { valid: false, error: 'Invalid or expired API key' }
  }

  // 更新最後使用時間
  await prisma.apiKey.update({
    where: { id: keyRecord.id },
    data: { lastUsedAt: new Date() }
  })

  return {
    valid: true,
    keyId: keyRecord.id,
    permissions: keyRecord.permissions.map(p => p.name),
    cityAccess: keyRecord.cityAccess.map(c => c.cityCode)
  }
}
```

---

## 測試案例

### 單元測試

```typescript
// __tests__/services/sharepoint-document.service.test.ts
import { SharePointDocumentService } from '@/lib/services/sharepoint-document.service'

describe('SharePointDocumentService', () => {
  let service: SharePointDocumentService

  beforeEach(() => {
    service = new SharePointDocumentService(mockPrisma, mockBlobService)
  })

  describe('submitDocument', () => {
    it('should successfully submit a valid SharePoint file', async () => {
      mockPrisma.sharePointConfig.findFirst.mockResolvedValue({
        tenantId: 'tenant-123',
        clientId: 'client-123',
        clientSecret: 'encrypted-secret'
      })

      mockGraphService.getFileInfoFromUrl.mockResolvedValue({
        id: 'file-123',
        name: 'invoice.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        downloadUrl: 'https://...'
      })

      const result = await service.submitDocument(
        {
          sharepointUrl: 'https://tenant.sharepoint.com/sites/Site/Shared Documents/invoice.pdf',
          cityCode: 'TPE'
        },
        {}
      )

      expect(result.success).toBe(true)
      expect(result.documentId).toBeDefined()
      expect(result.processingJobId).toBeDefined()
    })

    it('should reject unsupported file types', async () => {
      mockGraphService.getFileInfoFromUrl.mockResolvedValue({
        id: 'file-123',
        name: 'document.docx',
        size: 1024,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      const result = await service.submitDocument(
        {
          sharepointUrl: 'https://tenant.sharepoint.com/sites/Site/document.docx',
          cityCode: 'TPE'
        },
        {}
      )

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INVALID_FILE_TYPE')
    })

    it('should detect duplicate files', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'existing-doc'
      })

      const result = await service.submitDocument(
        {
          sharepointUrl: 'https://tenant.sharepoint.com/sites/Site/duplicate.pdf',
          cityCode: 'TPE'
        },
        {}
      )

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('DUPLICATE_FILE')
    })
  })
})
```

### 整合測試

```typescript
// __tests__/api/from-sharepoint.test.ts
import { createMocks } from 'node-mocks-http'

describe('POST /api/documents/from-sharepoint', () => {
  it('should accept valid submission with API key', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'x-api-key': 'valid-api-key',
        'content-type': 'application/json'
      },
      body: {
        sharepointUrl: 'https://tenant.sharepoint.com/sites/Test/invoice.pdf',
        cityCode: 'TPE'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(JSON.parse(res._getData())).toHaveProperty('success', true)
  })

  it('should reject request without API key', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        sharepointUrl: 'https://tenant.sharepoint.com/sites/Test/invoice.pdf',
        cityCode: 'TPE'
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })

  it('should validate required fields', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-api-key': 'valid-api-key' },
      body: {
        sharepointUrl: 'https://tenant.sharepoint.com/sites/Test/invoice.pdf'
        // missing cityCode
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData()).error.code).toBe('VALIDATION_ERROR')
  })
})
```

---

## 相依性

### 前置 Stories
- **Story 1-0**: 專案初始化基礎（基礎架構）
- **Story 2-1**: 文件上傳介面與驗證（Document 模型基礎）

### 後續 Stories
- **Story 9-2**: SharePoint 連線配置（配置管理介面）
- **Story 9-5**: 自動獲取來源追蹤（來源顯示功能）

### 外部相依
- Microsoft Graph API SDK
- Azure Identity SDK
- Azure Blob Storage SDK

---

## 備註

### 安全考量
1. API Key 驗證所有外部請求
2. Client Secret 加密儲存
3. 文件類型白名單驗證
4. 文件大小限制防止濫用
5. 詳細的錯誤日誌但不洩露敏感資訊

### n8n 整合說明
此 API 設計為供 n8n 調用：
1. n8n 監控 SharePoint 文件變更
2. 偵測到新文件時調用此 API
3. API 返回處理任務 ID
4. n8n 可使用任務 ID 查詢處理狀態

### 效能優化
1. 文件下載使用串流處理
2. 重複文件檢測避免重複處理
3. 批次提交支援提高效率
4. 非同步處理不阻塞 API 響應
