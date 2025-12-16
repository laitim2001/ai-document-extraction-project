# Story 9-3: Outlook 郵件附件提取 API

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 9: 自動化文件獲取 |
| Story ID | 9.3 |
| 標題 | Outlook 郵件附件提取 API |
| FR 覆蓋 | FR3 |
| 狀態 | ready-for-dev |
| 優先級 | High |
| 估計點數 | 8 |

---

## 用戶故事

**As a** 系統,
**I want** 提供 API 供外部提取 Outlook 郵件附件並提交處理,
**So that** n8n 可以監控郵箱並自動提取發票附件。

---

## 驗收標準

### AC1: API 接收郵件附件提交

**Given** 外部系統（n8n）偵測到符合條件的郵件
**When** 調用平台 API 提交附件
**Then** API 接受以下參數：
- 郵件 ID 或附件直接內容（Base64）
- 來源城市代碼
- 來源類型（outlook）
- 寄件者資訊
- 郵件主旨

### AC2: 附件解析與過濾

**Given** 平台接收到郵件附件提交請求
**When** 處理請求
**Then** 系統解析附件內容
**And** 過濾非發票文件（非 PDF/圖片）
**And** 為每個有效附件創建處理任務

### AC3: 多附件處理

**Given** 郵件包含多個附件
**When** 處理郵件
**Then** 系統為每個有效附件創建獨立的處理任務
**And** 記錄附件與原始郵件的關聯

### AC4: 處理結果返回

**Given** 附件處理完成
**When** 返回結果
**Then** 包含各附件的處理任務 ID
**And** 包含被過濾（跳過）的附件清單

---

## 技術實作規格

### 1. 資料模型

#### Prisma Schema 擴展

```prisma
// Outlook 配置
model OutlookConfig {
  id                String    @id @default(cuid())

  // 配置識別
  name              String
  description       String?

  // 郵箱設定
  mailboxAddress    String    // 監控的郵箱地址

  // Azure AD 設定
  tenantId          String
  clientId          String
  clientSecret      String    // 加密儲存

  // 城市關聯
  cityId            String?   @unique
  city              City?     @relation(fields: [cityId], references: [id])

  // 全域配置標記
  isGlobal          Boolean   @default(false)

  // 過濾規則
  filterRules       OutlookFilterRule[]

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

  // 關聯
  fetchLogs         OutlookFetchLog[]

  @@index([cityId])
  @@index([isActive])
}

// Outlook 過濾規則
model OutlookFilterRule {
  id              String          @id @default(cuid())
  configId        String
  config          OutlookConfig   @relation(fields: [configId], references: [id])

  // 規則類型
  ruleType        OutlookRuleType
  ruleValue       String          // 規則值（可為 JSON）
  isWhitelist     Boolean         @default(true) // true=白名單, false=黑名單

  // 狀態
  isActive        Boolean         @default(true)
  priority        Int             @default(0)

  createdAt       DateTime        @default(now())

  @@index([configId])
}

// 過濾規則類型
enum OutlookRuleType {
  SENDER_EMAIL      // 寄件者 Email
  SENDER_DOMAIN     // 寄件者網域
  SUBJECT_KEYWORD   // 主旨關鍵字
  SUBJECT_REGEX     // 主旨正則表達式
  ATTACHMENT_TYPE   // 附件類型
  ATTACHMENT_NAME   // 附件名稱模式
}

// Outlook 獲取日誌
model OutlookFetchLog {
  id                String              @id @default(cuid())

  // 郵件資訊
  messageId         String?             // Outlook Message ID
  subject           String
  senderEmail       String
  senderName        String?
  receivedAt        DateTime

  // 請求方式
  submissionType    OutlookSubmissionType @default(DIRECT_UPLOAD)

  // 附件統計
  totalAttachments  Int
  validAttachments  Int
  skippedAttachments Int

  // 來源配置
  configId          String?
  config            OutlookConfig?      @relation(fields: [configId], references: [id])
  cityId            String

  // 狀態
  status            OutlookFetchStatus  @default(PENDING)

  // 結果
  documentIds       String[]            // 建立的 Document IDs
  skippedFiles      Json?               // 被跳過的文件清單

  // 錯誤資訊
  errorCode         String?
  errorMessage      String?

  // API 請求資訊
  requestIp         String?
  requestUserAgent  String?

  // 時間戳
  createdAt         DateTime            @default(now())
  completedAt       DateTime?

  @@index([messageId])
  @@index([senderEmail])
  @@index([status])
  @@index([cityId])
}

// 提交方式
enum OutlookSubmissionType {
  MESSAGE_ID        // 使用 Message ID 讓系統獲取
  DIRECT_UPLOAD     // 直接上傳附件內容
}

// Outlook 獲取狀態
enum OutlookFetchStatus {
  PENDING
  FETCHING
  PROCESSING
  COMPLETED
  PARTIAL           // 部分成功
  FAILED
  FILTERED          // 被過濾規則排除
}

// 擴展 Document 模型的 sourceMetadata
// sourceMetadata JSON 結構（Outlook 來源）:
// {
//   "messageId": "AAMk...",
//   "subject": "Invoice for October",
//   "senderEmail": "vendor@example.com",
//   "senderName": "Vendor Company",
//   "receivedAt": "2024-01-15T10:30:00Z",
//   "attachmentName": "invoice.pdf",
//   "attachmentIndex": 0,
//   "totalAttachments": 3,
//   "fetchLogId": "log-123"
// }
```

### 2. Outlook 郵件服務

```typescript
// lib/services/outlook-mail.service.ts
import { MicrosoftGraphService } from './microsoft-graph.service'

// 郵件資訊
export interface MailInfo {
  id: string
  subject: string
  sender: {
    email: string
    name?: string
  }
  receivedDateTime: string
  attachments: AttachmentInfo[]
}

// 附件資訊
export interface AttachmentInfo {
  id: string
  name: string
  contentType: string
  size: number
  isInline: boolean
}

// 附件內容
export interface AttachmentContent extends AttachmentInfo {
  contentBytes: string // Base64
}

export class OutlookMailService extends MicrosoftGraphService {
  private mailboxAddress: string

  constructor(
    config: { tenantId: string; clientId: string; clientSecret: string },
    mailboxAddress: string
  ) {
    super(config)
    this.mailboxAddress = mailboxAddress
  }

  // 獲取郵件資訊
  async getMailInfo(messageId: string): Promise<MailInfo> {
    const message = await this.client
      .api(`/users/${this.mailboxAddress}/messages/${messageId}`)
      .select('id,subject,sender,receivedDateTime')
      .expand('attachments($select=id,name,contentType,size,isInline)')
      .get()

    return {
      id: message.id,
      subject: message.subject,
      sender: {
        email: message.sender?.emailAddress?.address || '',
        name: message.sender?.emailAddress?.name
      },
      receivedDateTime: message.receivedDateTime,
      attachments: message.attachments?.map((att: any) => ({
        id: att.id,
        name: att.name,
        contentType: att.contentType,
        size: att.size,
        isInline: att.isInline
      })) || []
    }
  }

  // 獲取附件內容
  async getAttachmentContent(
    messageId: string,
    attachmentId: string
  ): Promise<AttachmentContent> {
    const attachment = await this.client
      .api(`/users/${this.mailboxAddress}/messages/${messageId}/attachments/${attachmentId}`)
      .get()

    return {
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      isInline: attachment.isInline,
      contentBytes: attachment.contentBytes
    }
  }

  // 獲取所有附件內容
  async getAllAttachments(messageId: string): Promise<AttachmentContent[]> {
    const mailInfo = await this.getMailInfo(messageId)

    const attachments = await Promise.all(
      mailInfo.attachments
        .filter(att => !att.isInline)
        .map(att => this.getAttachmentContent(messageId, att.id))
    )

    return attachments
  }

  // 測試連線
  async testMailboxAccess(): Promise<{ success: boolean; error?: string }> {
    try {
      // 嘗試獲取郵箱資訊
      await this.client
        .api(`/users/${this.mailboxAddress}`)
        .select('id,displayName,mail')
        .get()

      // 嘗試讀取最近一封郵件（驗證讀取權限）
      await this.client
        .api(`/users/${this.mailboxAddress}/messages`)
        .top(1)
        .select('id')
        .get()

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }
}
```

### 3. Outlook 文件服務

```typescript
// lib/services/outlook-document.service.ts
import { OutlookMailService } from './outlook-mail.service'
import { BlobStorageService } from './blob-storage.service'
import { decrypt } from '@/lib/utils/encryption'
import { createHash } from 'crypto'

// 允許的 MIME 類型
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/gif'
]

// 最大附件大小 (30MB)
const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024

// 直接上傳的附件
export interface DirectAttachment {
  fileName: string
  contentType: string
  contentBase64: string
}

// 提交請求
export interface OutlookSubmitRequest {
  // 方式一：使用 Message ID
  messageId?: string

  // 方式二：直接上傳附件
  attachments?: DirectAttachment[]

  // 共用欄位
  cityCode: string
  senderEmail: string
  senderName?: string
  subject: string
  receivedAt?: string
  metadata?: Record<string, any>
}

// 處理結果
export interface AttachmentResult {
  fileName: string
  status: 'success' | 'skipped' | 'failed'
  documentId?: string
  processingJobId?: string
  skipReason?: string
  error?: string
}

export interface OutlookSubmitResult {
  success: boolean
  fetchLogId: string
  totalAttachments: number
  processedCount: number
  skippedCount: number
  failedCount: number
  results: AttachmentResult[]
  error?: {
    code: string
    message: string
  }
}

export class OutlookDocumentService {
  constructor(
    private prisma: PrismaClient,
    private blobService: BlobStorageService
  ) {}

  // 提交郵件附件
  async submitMailAttachments(
    request: OutlookSubmitRequest,
    requestContext: { ip?: string; userAgent?: string }
  ): Promise<OutlookSubmitResult> {
    // 驗證城市
    const city = await this.prisma.city.findUnique({
      where: { code: request.cityCode }
    })

    if (!city) {
      return this.createErrorResult('CITY_NOT_FOUND', `找不到城市: ${request.cityCode}`)
    }

    // 建立獲取日誌
    const fetchLog = await this.prisma.outlookFetchLog.create({
      data: {
        messageId: request.messageId,
        subject: request.subject,
        senderEmail: request.senderEmail,
        senderName: request.senderName,
        receivedAt: request.receivedAt ? new Date(request.receivedAt) : new Date(),
        submissionType: request.messageId ? 'MESSAGE_ID' : 'DIRECT_UPLOAD',
        totalAttachments: 0,
        validAttachments: 0,
        skippedAttachments: 0,
        cityId: city.id,
        requestIp: requestContext.ip,
        requestUserAgent: requestContext.userAgent,
        status: 'PENDING'
      }
    })

    try {
      // 檢查過濾規則
      const filterResult = await this.checkFilterRules(request, city.id)
      if (!filterResult.allowed) {
        await this.updateFetchLog(fetchLog.id, {
          status: 'FILTERED',
          errorCode: 'FILTERED',
          errorMessage: filterResult.reason
        })

        return {
          success: false,
          fetchLogId: fetchLog.id,
          totalAttachments: 0,
          processedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          results: [],
          error: { code: 'FILTERED', message: filterResult.reason! }
        }
      }

      let attachments: Array<{ fileName: string; contentType: string; buffer: Buffer }>

      // 獲取附件
      if (request.messageId) {
        attachments = await this.fetchAttachmentsFromOutlook(request.messageId, city.id)
      } else if (request.attachments) {
        attachments = this.parseDirectAttachments(request.attachments)
      } else {
        throw new Error('必須提供 messageId 或 attachments')
      }

      await this.updateFetchLog(fetchLog.id, {
        totalAttachments: attachments.length,
        status: 'PROCESSING'
      })

      // 處理每個附件
      const results: AttachmentResult[] = []
      const documentIds: string[] = []
      const skippedFiles: Array<{ fileName: string; reason: string }> = []

      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i]
        const result = await this.processAttachment(
          attachment,
          {
            cityId: city.id,
            cityCode: request.cityCode,
            senderEmail: request.senderEmail,
            senderName: request.senderName,
            subject: request.subject,
            messageId: request.messageId,
            receivedAt: request.receivedAt,
            attachmentIndex: i,
            totalAttachments: attachments.length,
            fetchLogId: fetchLog.id
          }
        )

        results.push(result)

        if (result.status === 'success' && result.documentId) {
          documentIds.push(result.documentId)
        } else if (result.status === 'skipped') {
          skippedFiles.push({ fileName: result.fileName, reason: result.skipReason! })
        }
      }

      const processedCount = results.filter(r => r.status === 'success').length
      const skippedCount = results.filter(r => r.status === 'skipped').length
      const failedCount = results.filter(r => r.status === 'failed').length

      // 更新獲取日誌
      await this.updateFetchLog(fetchLog.id, {
        status: failedCount === attachments.length ? 'FAILED'
          : skippedCount === attachments.length ? 'FILTERED'
          : processedCount < attachments.length ? 'PARTIAL'
          : 'COMPLETED',
        validAttachments: processedCount,
        skippedAttachments: skippedCount,
        documentIds,
        skippedFiles,
        completedAt: new Date()
      })

      return {
        success: processedCount > 0,
        fetchLogId: fetchLog.id,
        totalAttachments: attachments.length,
        processedCount,
        skippedCount,
        failedCount,
        results
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await this.updateFetchLog(fetchLog.id, {
        status: 'FAILED',
        errorCode: 'PROCESSING_ERROR',
        errorMessage
      })

      return this.createErrorResult('PROCESSING_ERROR', errorMessage, fetchLog.id)
    }
  }

  // 從 Outlook 獲取附件
  private async fetchAttachmentsFromOutlook(
    messageId: string,
    cityId: string
  ): Promise<Array<{ fileName: string; contentType: string; buffer: Buffer }>> {
    // 獲取配置
    const config = await this.getOutlookConfig(cityId)
    if (!config) {
      throw new Error('找不到 Outlook 配置')
    }

    const decryptedSecret = await decrypt(config.clientSecret)
    const mailService = new OutlookMailService(
      {
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: decryptedSecret
      },
      config.mailboxAddress
    )

    const attachments = await mailService.getAllAttachments(messageId)

    return attachments.map(att => ({
      fileName: att.name,
      contentType: att.contentType,
      buffer: Buffer.from(att.contentBytes, 'base64')
    }))
  }

  // 解析直接上傳的附件
  private parseDirectAttachments(
    attachments: DirectAttachment[]
  ): Array<{ fileName: string; contentType: string; buffer: Buffer }> {
    return attachments.map(att => ({
      fileName: att.fileName,
      contentType: att.contentType,
      buffer: Buffer.from(att.contentBase64, 'base64')
    }))
  }

  // 處理單一附件
  private async processAttachment(
    attachment: { fileName: string; contentType: string; buffer: Buffer },
    context: {
      cityId: string
      cityCode: string
      senderEmail: string
      senderName?: string
      subject: string
      messageId?: string
      receivedAt?: string
      attachmentIndex: number
      totalAttachments: number
      fetchLogId: string
    }
  ): Promise<AttachmentResult> {
    const { fileName, contentType, buffer } = attachment

    // 檢查文件類型
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return {
        fileName,
        status: 'skipped',
        skipReason: `不支援的文件類型: ${contentType}`
      }
    }

    // 檢查文件大小
    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      return {
        fileName,
        status: 'skipped',
        skipReason: `文件大小超過限制 (最大 ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)`
      }
    }

    try {
      // 計算文件雜湊
      const fileHash = createHash('sha256').update(buffer).digest('hex')

      // 檢查重複（同一封郵件的同名附件）
      if (context.messageId) {
        const existing = await this.prisma.document.findFirst({
          where: {
            sourceType: 'OUTLOOK',
            sourceMetadata: {
              path: ['messageId'],
              equals: context.messageId
            },
            originalFileName: fileName
          }
        })

        if (existing) {
          return {
            fileName,
            status: 'skipped',
            skipReason: '此附件已處理過'
          }
        }
      }

      // 上傳到 Blob Storage
      const blobPath = `documents/outlook/${context.cityCode}/${Date.now()}_${fileName}`
      const blobUrl = await this.blobService.uploadBuffer(
        buffer,
        blobPath,
        contentType,
        {
          sourceType: 'outlook',
          senderEmail: context.senderEmail,
          subject: context.subject
        }
      )

      // 建立文件記錄
      const document = await this.prisma.document.create({
        data: {
          originalFileName: fileName,
          fileUrl: blobUrl,
          fileSize: BigInt(buffer.length),
          mimeType: contentType,
          fileHash,
          sourceType: 'OUTLOOK',
          sourceMetadata: {
            messageId: context.messageId,
            subject: context.subject,
            senderEmail: context.senderEmail,
            senderName: context.senderName,
            receivedAt: context.receivedAt || new Date().toISOString(),
            attachmentName: fileName,
            attachmentIndex: context.attachmentIndex,
            totalAttachments: context.totalAttachments,
            fetchLogId: context.fetchLogId
          },
          cityId: context.cityId,
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

      return {
        fileName,
        status: 'success',
        documentId: document.id,
        processingJobId: processingJob.id
      }

    } catch (error) {
      return {
        fileName,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 檢查過濾規則
  private async checkFilterRules(
    request: OutlookSubmitRequest,
    cityId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 獲取配置和規則
    const config = await this.getOutlookConfig(cityId)
    if (!config) {
      return { allowed: true } // 沒有配置則允許
    }

    const rules = await this.prisma.outlookFilterRule.findMany({
      where: {
        configId: config.id,
        isActive: true
      },
      orderBy: { priority: 'asc' }
    })

    for (const rule of rules) {
      const matches = this.checkRule(rule, request)

      if (rule.isWhitelist && !matches) {
        return {
          allowed: false,
          reason: `不符合白名單規則: ${rule.ruleType}`
        }
      }

      if (!rule.isWhitelist && matches) {
        return {
          allowed: false,
          reason: `符合黑名單規則: ${rule.ruleType}`
        }
      }
    }

    return { allowed: true }
  }

  // 檢查單一規則
  private checkRule(rule: OutlookFilterRule, request: OutlookSubmitRequest): boolean {
    switch (rule.ruleType) {
      case 'SENDER_EMAIL':
        return request.senderEmail.toLowerCase() === rule.ruleValue.toLowerCase()

      case 'SENDER_DOMAIN': {
        const domain = request.senderEmail.split('@')[1]?.toLowerCase()
        return domain === rule.ruleValue.toLowerCase()
      }

      case 'SUBJECT_KEYWORD':
        return request.subject.toLowerCase().includes(rule.ruleValue.toLowerCase())

      case 'SUBJECT_REGEX': {
        const regex = new RegExp(rule.ruleValue, 'i')
        return regex.test(request.subject)
      }

      default:
        return false
    }
  }

  // 獲取 Outlook 配置
  private async getOutlookConfig(cityId: string): Promise<OutlookConfig | null> {
    // 優先查找城市專屬配置
    let config = await this.prisma.outlookConfig.findFirst({
      where: { cityId, isActive: true },
      include: { filterRules: { where: { isActive: true } } }
    })

    // 如果沒有，使用全域配置
    if (!config) {
      config = await this.prisma.outlookConfig.findFirst({
        where: { isGlobal: true, isActive: true },
        include: { filterRules: { where: { isActive: true } } }
      })
    }

    return config
  }

  // 更新獲取日誌
  private async updateFetchLog(id: string, data: Partial<OutlookFetchLog>): Promise<void> {
    await this.prisma.outlookFetchLog.update({
      where: { id },
      data
    })
  }

  // 建立錯誤結果
  private createErrorResult(
    code: string,
    message: string,
    fetchLogId?: string
  ): OutlookSubmitResult {
    return {
      success: false,
      fetchLogId: fetchLogId || '',
      totalAttachments: 0,
      processedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
      error: { code, message }
    }
  }
}
```

### 4. API 路由

```typescript
// app/api/documents/from-outlook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { OutlookDocumentService } from '@/lib/services/outlook-document.service'
import { verifyApiKey } from '@/lib/auth/api-key'
import { z } from 'zod'

// 請求驗證 Schema
const directAttachmentSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  contentBase64: z.string().min(1)
})

const submitSchema = z.object({
  messageId: z.string().optional(),
  attachments: z.array(directAttachmentSchema).optional(),
  cityCode: z.string().min(1, '城市代碼為必填'),
  senderEmail: z.string().email('請輸入有效的寄件者 Email'),
  senderName: z.string().optional(),
  subject: z.string().min(1, '郵件主旨為必填'),
  receivedAt: z.string().optional(),
  metadata: z.record(z.any()).optional()
}).refine(
  data => data.messageId || (data.attachments && data.attachments.length > 0),
  { message: '必須提供 messageId 或 attachments' }
)

// POST - 提交郵件附件
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
    const validated = submitSchema.parse(body)

    const service = new OutlookDocumentService(prisma, blobService)
    const result = await service.submitMailAttachments(
      validated,
      {
        ip: request.headers.get('x-forwarded-for') || request.ip,
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    if (result.success || result.processedCount > 0) {
      return NextResponse.json({
        success: true,
        data: {
          fetchLogId: result.fetchLogId,
          summary: {
            total: result.totalAttachments,
            processed: result.processedCount,
            skipped: result.skippedCount,
            failed: result.failedCount
          },
          results: result.results.map(r => ({
            fileName: r.fileName,
            status: r.status,
            documentId: r.documentId,
            processingJobId: r.processingJobId,
            reason: r.skipReason || r.error
          }))
        }
      })
    } else {
      const statusCode = getStatusCodeFromError(result.error?.code)
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          fetchLogId: result.fetchLogId
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

    console.error('Outlook submit error:', error)
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

function getStatusCodeFromError(code?: string): number {
  const statusMap: Record<string, number> = {
    CITY_NOT_FOUND: 404,
    CONFIG_NOT_FOUND: 404,
    FILTERED: 422,
    AUTH_ERROR: 401,
    VALIDATION_ERROR: 400
  }
  return statusMap[code || ''] || 500
}
```

```typescript
// app/api/documents/from-outlook/status/[fetchLogId]/route.ts
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
    const fetchLog = await prisma.outlookFetchLog.findUnique({
      where: { id: params.fetchLogId }
    })

    if (!fetchLog) {
      return NextResponse.json(
        { error: 'Fetch log not found' },
        { status: 404 }
      )
    }

    // 獲取關聯的文件處理狀態
    const documents = fetchLog.documentIds.length > 0
      ? await prisma.document.findMany({
          where: { id: { in: fetchLog.documentIds } },
          include: { processingJob: true }
        })
      : []

    return NextResponse.json({
      id: fetchLog.id,
      status: fetchLog.status,
      subject: fetchLog.subject,
      senderEmail: fetchLog.senderEmail,
      summary: {
        total: fetchLog.totalAttachments,
        valid: fetchLog.validAttachments,
        skipped: fetchLog.skippedAttachments
      },
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.originalFileName,
        status: doc.status,
        processingStatus: doc.processingJob?.status
      })),
      skippedFiles: fetchLog.skippedFiles,
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

---

## 測試案例

### 單元測試

```typescript
// __tests__/services/outlook-document.service.test.ts
describe('OutlookDocumentService', () => {
  let service: OutlookDocumentService

  beforeEach(() => {
    service = new OutlookDocumentService(mockPrisma, mockBlobService)
  })

  describe('submitMailAttachments', () => {
    it('should process multiple attachments successfully', async () => {
      const result = await service.submitMailAttachments(
        {
          cityCode: 'TPE',
          senderEmail: 'vendor@example.com',
          subject: 'Invoice October 2024',
          attachments: [
            {
              fileName: 'invoice1.pdf',
              contentType: 'application/pdf',
              contentBase64: 'base64content...'
            },
            {
              fileName: 'invoice2.pdf',
              contentType: 'application/pdf',
              contentBase64: 'base64content...'
            }
          ]
        },
        {}
      )

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(2)
      expect(result.results).toHaveLength(2)
    })

    it('should skip unsupported file types', async () => {
      const result = await service.submitMailAttachments(
        {
          cityCode: 'TPE',
          senderEmail: 'vendor@example.com',
          subject: 'Documents',
          attachments: [
            {
              fileName: 'invoice.pdf',
              contentType: 'application/pdf',
              contentBase64: 'base64content...'
            },
            {
              fileName: 'document.docx',
              contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              contentBase64: 'base64content...'
            }
          ]
        },
        {}
      )

      expect(result.processedCount).toBe(1)
      expect(result.skippedCount).toBe(1)
      expect(result.results.find(r => r.fileName === 'document.docx')?.status).toBe('skipped')
    })

    it('should apply filter rules correctly', async () => {
      // 設置黑名單規則
      mockPrisma.outlookFilterRule.findMany.mockResolvedValue([
        {
          ruleType: 'SENDER_DOMAIN',
          ruleValue: 'spam.com',
          isWhitelist: false
        }
      ])

      const result = await service.submitMailAttachments(
        {
          cityCode: 'TPE',
          senderEmail: 'sender@spam.com',
          subject: 'Invoice',
          attachments: [{ fileName: 'invoice.pdf', contentType: 'application/pdf', contentBase64: '...' }]
        },
        {}
      )

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('FILTERED')
    })
  })
})
```

### 整合測試

```typescript
// __tests__/api/from-outlook.test.ts
describe('POST /api/documents/from-outlook', () => {
  it('should process direct upload attachments', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-api-key': 'valid-api-key' },
      body: {
        cityCode: 'TPE',
        senderEmail: 'vendor@example.com',
        subject: 'October Invoice',
        attachments: [
          {
            fileName: 'invoice.pdf',
            contentType: 'application/pdf',
            contentBase64: Buffer.from('%PDF-1.4...').toString('base64')
          }
        ]
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    expect(data.data.summary.processed).toBe(1)
  })

  it('should require either messageId or attachments', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-api-key': 'valid-api-key' },
      body: {
        cityCode: 'TPE',
        senderEmail: 'vendor@example.com',
        subject: 'Invoice'
        // 沒有 messageId 或 attachments
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
  })
})
```

---

## 相依性

### 前置 Stories
- **Story 9-1**: SharePoint 文件監控 API（共用 MicrosoftGraphService）
- **Story 1-0**: 專案初始化基礎

### 後續 Stories
- **Story 9-4**: Outlook 連線配置
- **Story 9-5**: 自動獲取來源追蹤

### 外部相依
- Microsoft Graph API SDK
- Azure Blob Storage SDK

---

## 備註

### n8n 整合模式
1. **Message ID 模式**：n8n 監控郵箱，偵測到符合條件的郵件後傳送 Message ID
2. **Direct Upload 模式**：n8n 讀取郵件附件，直接以 Base64 傳送

### 建議使用 Direct Upload 模式
- 減少系統對 Outlook 的存取
- n8n 可以預先過濾不需要的附件
- 降低 API 權限需求

### 安全注意事項
1. API Key 驗證所有請求
2. 過濾規則可防止處理不相關郵件
3. 文件類型白名單驗證
4. 寄件者追蹤完整記錄
