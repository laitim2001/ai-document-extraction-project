# Story 8-5: 審計報告匯出

## Story 資訊

| 屬性 | 值 |
|------|-----|
| Epic | Epic 8: 審計追溯與合規 |
| Story ID | 8.5 |
| 標題 | 審計報告匯出 |
| FR 覆蓋 | FR52 |
| 狀態 | ready-for-dev |
| 優先級 | High |
| 估計點數 | 8 |

---

## 用戶故事

**As a** 審計人員,
**I want** 匯出符合審計要求的報告,
**So that** 可以提供給內部或外部審計使用。

---

## 驗收標準

### AC1: 報告配置選項

**Given** 審計人員完成查詢
**When** 點擊「匯出審計報告」
**Then** 顯示報告配置選項：
- 報告類型（處理記錄/變更歷史/完整審計）
- 時間範圍
- 包含欄位
- 輸出格式（Excel/PDF/CSV）

### AC2: 完整審計報告內容

**Given** 選擇「完整審計報告」
**When** 生成報告
**Then** 報告包含：
- 封面和目錄
- 查詢條件摘要
- 處理記錄明細
- 數據變更歷史
- 附件（原始文件清單）

### AC3: 大量數據背景處理

**Given** 報告生成
**When** 報告包含大量數據（>5,000 筆記錄）
**Then** 系統採用背景處理
**And** 完成後發送下載通知

### AC4: 報告完整性驗證

**Given** 生成的報告
**When** 需要驗證完整性
**Then** 報告包含數位簽章或雜湊值
**And** 可以驗證報告未被篡改

---

## 技術實作規格

### 1. 資料模型

#### Prisma Schema 擴展

```prisma
// 審計報告任務
model AuditReportJob {
  id              String            @id @default(cuid())

  // 報告配置
  reportType      AuditReportType   // 報告類型
  outputFormat    ReportOutputFormat // 輸出格式
  title           String            // 報告標題

  // 查詢條件
  queryParams     Json              // 儲存查詢條件
  dateFrom        DateTime          // 起始日期
  dateTo          DateTime          // 結束日期
  cityIds         String[]          // 城市篩選
  forwarderIds    String[]          // Forwarder 篩選

  // 欄位配置
  includedFields  String[]          // 包含欄位列表
  includeChanges  Boolean           @default(true) // 包含變更歷史
  includeFiles    Boolean           @default(true) // 包含文件清單

  // 任務狀態
  status          ReportJobStatus   @default(PENDING)
  progress        Int               @default(0) // 0-100
  totalRecords    Int?              // 總記錄數
  processedRecords Int              @default(0) // 已處理記錄數

  // 結果
  fileUrl         String?           // 生成的報告 URL
  fileSize        BigInt?           // 檔案大小
  checksum        String?           // SHA-256 雜湊值
  digitalSignature String?          // 數位簽章

  // 錯誤處理
  errorMessage    String?
  errorDetails    Json?

  // 關聯
  requestedById   String
  requestedBy     User              @relation(fields: [requestedById], references: [id])

  // 時間戳
  createdAt       DateTime          @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  expiresAt       DateTime?         // 報告過期時間

  // 索引
  @@index([requestedById])
  @@index([status])
  @@index([createdAt])
  @@index([reportType])
}

// 報告類型
enum AuditReportType {
  PROCESSING_RECORDS  // 處理記錄
  CHANGE_HISTORY      // 變更歷史
  FULL_AUDIT          // 完整審計
  COMPLIANCE_SUMMARY  // 合規摘要
}

// 報告輸出格式
enum ReportOutputFormat {
  EXCEL
  PDF
  CSV
  JSON
}

// 報告任務狀態
enum ReportJobStatus {
  PENDING       // 待處理
  QUEUED        // 已排隊
  PROCESSING    // 處理中
  GENERATING    // 生成報告中
  SIGNING       // 簽章中
  COMPLETED     // 已完成
  FAILED        // 失敗
  CANCELLED     // 已取消
  EXPIRED       // 已過期
}

// 報告下載記錄（審計追蹤）
model AuditReportDownload {
  id              String          @id @default(cuid())
  reportJobId     String
  reportJob       AuditReportJob  @relation(fields: [reportJobId], references: [id])
  downloadedById  String
  downloadedBy    User            @relation(fields: [downloadedById], references: [id])
  downloadedAt    DateTime        @default(now())
  ipAddress       String?
  userAgent       String?

  @@index([reportJobId])
  @@index([downloadedById])
}
```

### 2. 報告生成服務

#### 審計報告服務

```typescript
// lib/services/audit-report.service.ts
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { createHash, createSign } from 'crypto'
import { Readable } from 'stream'

// 報告配置類型
export interface AuditReportConfig {
  reportType: AuditReportType
  outputFormat: ReportOutputFormat
  title: string
  dateRange: {
    from: Date
    to: Date
  }
  filters: {
    cityIds?: string[]
    forwarderIds?: string[]
    userIds?: string[]
    statuses?: string[]
  }
  includedFields: string[]
  includeChanges: boolean
  includeFiles: boolean
}

// 報告元數據
export interface ReportMetadata {
  generatedAt: Date
  generatedBy: string
  queryParams: AuditReportConfig
  recordCount: number
  checksum: string
  version: string
}

// 大量數據閾值
const LARGE_REPORT_THRESHOLD = 5000
const REPORT_EXPIRY_DAYS = 7

export class AuditReportService {
  constructor(
    private prisma: PrismaClient,
    private blobService: BlobStorageService,
    private notificationService: NotificationService
  ) {}

  // 建立報告任務
  async createReportJob(
    config: AuditReportConfig,
    requestedById: string
  ): Promise<{ jobId: string; isAsync: boolean }> {
    // 預估記錄數量
    const estimatedCount = await this.estimateRecordCount(config)
    const isAsync = estimatedCount > LARGE_REPORT_THRESHOLD

    const job = await this.prisma.auditReportJob.create({
      data: {
        reportType: config.reportType,
        outputFormat: config.outputFormat,
        title: config.title,
        queryParams: config as any,
        dateFrom: config.dateRange.from,
        dateTo: config.dateRange.to,
        cityIds: config.filters.cityIds || [],
        forwarderIds: config.filters.forwarderIds || [],
        includedFields: config.includedFields,
        includeChanges: config.includeChanges,
        includeFiles: config.includeFiles,
        totalRecords: estimatedCount,
        status: isAsync ? 'QUEUED' : 'PROCESSING',
        requestedById,
        expiresAt: new Date(Date.now() + REPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      }
    })

    if (isAsync) {
      // 排入背景佇列
      await this.queueReportGeneration(job.id)
    } else {
      // 同步生成
      await this.generateReport(job.id)
    }

    return { jobId: job.id, isAsync }
  }

  // 預估記錄數量
  private async estimateRecordCount(config: AuditReportConfig): Promise<number> {
    const whereClause = this.buildWhereClause(config)

    let count = 0

    if (config.reportType === 'PROCESSING_RECORDS' || config.reportType === 'FULL_AUDIT') {
      count += await this.prisma.auditLog.count({ where: whereClause })
    }

    if (config.reportType === 'CHANGE_HISTORY' || config.reportType === 'FULL_AUDIT') {
      count += await this.prisma.dataChangeHistory.count({
        where: {
          createdAt: {
            gte: config.dateRange.from,
            lte: config.dateRange.to
          }
        }
      })
    }

    return count
  }

  // 生成報告主流程
  async generateReport(jobId: string): Promise<void> {
    const job = await this.prisma.auditReportJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { requestedBy: true }
    })

    try {
      // 更新狀態為處理中
      await this.updateJobStatus(jobId, 'PROCESSING')

      // 收集報告數據
      const reportData = await this.collectReportData(job)

      // 更新狀態為生成中
      await this.updateJobStatus(jobId, 'GENERATING')

      // 根據格式生成報告
      let fileBuffer: Buffer
      let contentType: string
      let fileExtension: string

      switch (job.outputFormat) {
        case 'EXCEL':
          fileBuffer = await this.generateExcelReport(job, reportData)
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          fileExtension = 'xlsx'
          break
        case 'PDF':
          fileBuffer = await this.generatePdfReport(job, reportData)
          contentType = 'application/pdf'
          fileExtension = 'pdf'
          break
        case 'CSV':
          fileBuffer = await this.generateCsvReport(job, reportData)
          contentType = 'text/csv'
          fileExtension = 'csv'
          break
        case 'JSON':
          fileBuffer = await this.generateJsonReport(job, reportData)
          contentType = 'application/json'
          fileExtension = 'json'
          break
        default:
          throw new Error(`Unsupported format: ${job.outputFormat}`)
      }

      // 計算雜湊值
      const checksum = this.calculateChecksum(fileBuffer)

      // 更新狀態為簽章中
      await this.updateJobStatus(jobId, 'SIGNING')

      // 生成數位簽章
      const digitalSignature = await this.generateDigitalSignature(fileBuffer)

      // 上傳到 Blob Storage
      const fileName = `audit-reports/${jobId}/report_${Date.now()}.${fileExtension}`
      const fileUrl = await this.blobService.uploadBuffer(
        fileBuffer,
        fileName,
        contentType,
        {
          checksum,
          reportType: job.reportType,
          generatedBy: job.requestedById
        }
      )

      // 更新任務完成
      await this.prisma.auditReportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          processedRecords: job.totalRecords,
          fileUrl,
          fileSize: BigInt(fileBuffer.length),
          checksum,
          digitalSignature,
          completedAt: new Date()
        }
      })

      // 發送完成通知
      await this.notificationService.send({
        userId: job.requestedById,
        type: 'AUDIT_REPORT_READY',
        title: '審計報告已生成',
        message: `您的審計報告「${job.title}」已生成完成，可以下載了。`,
        data: { jobId, fileUrl }
      })

    } catch (error) {
      await this.prisma.auditReportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error instanceof Error ? { stack: error.stack } : null
        }
      })

      // 發送失敗通知
      await this.notificationService.send({
        userId: job.requestedById,
        type: 'AUDIT_REPORT_FAILED',
        title: '審計報告生成失敗',
        message: `您的審計報告「${job.title}」生成失敗，請重試。`,
        data: { jobId, error: error instanceof Error ? error.message : 'Unknown error' }
      })

      throw error
    }
  }

  // 收集報告數據
  private async collectReportData(job: AuditReportJob): Promise<AuditReportData> {
    const config = job.queryParams as AuditReportConfig
    const whereClause = this.buildWhereClause(config)

    const data: AuditReportData = {
      metadata: {
        title: job.title,
        reportType: job.reportType,
        generatedAt: new Date(),
        dateRange: { from: job.dateFrom, to: job.dateTo },
        filters: config.filters
      },
      processingRecords: [],
      changeHistory: [],
      fileList: []
    }

    // 收集處理記錄
    if (job.reportType === 'PROCESSING_RECORDS' || job.reportType === 'FULL_AUDIT') {
      const batchSize = 1000
      let offset = 0

      while (true) {
        const records = await this.prisma.auditLog.findMany({
          where: whereClause,
          include: {
            user: { select: { id: true, name: true, email: true } }
          },
          orderBy: { timestamp: 'desc' },
          take: batchSize,
          skip: offset
        })

        if (records.length === 0) break

        data.processingRecords.push(...records)
        offset += batchSize

        // 更新進度
        const progress = Math.min(50, Math.floor((offset / (job.totalRecords || 1)) * 50))
        await this.updateJobProgress(job.id, progress)
      }
    }

    // 收集變更歷史
    if (job.includeChanges && (job.reportType === 'CHANGE_HISTORY' || job.reportType === 'FULL_AUDIT')) {
      const changeRecords = await this.prisma.dataChangeHistory.findMany({
        where: {
          createdAt: {
            gte: job.dateFrom,
            lte: job.dateTo
          }
        },
        include: {
          changedBy: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      })

      data.changeHistory = changeRecords
      await this.updateJobProgress(job.id, 75)
    }

    // 收集文件清單
    if (job.includeFiles) {
      const documents = await this.prisma.document.findMany({
        where: {
          createdAt: {
            gte: job.dateFrom,
            lte: job.dateTo
          }
        },
        select: {
          id: true,
          originalFileName: true,
          fileUrl: true,
          status: true,
          createdAt: true,
          processedAt: true
        },
        orderBy: { createdAt: 'desc' }
      })

      data.fileList = documents
      await this.updateJobProgress(job.id, 90)
    }

    return data
  }

  // 生成 Excel 報告
  private async generateExcelReport(
    job: AuditReportJob,
    data: AuditReportData
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AI Document Extraction System'
    workbook.created = new Date()

    // 封面頁
    const coverSheet = workbook.addWorksheet('封面')
    this.addCoverPage(coverSheet, job, data)

    // 目錄頁
    const tocSheet = workbook.addWorksheet('目錄')
    this.addTableOfContents(tocSheet, job)

    // 查詢條件摘要
    const summarySheet = workbook.addWorksheet('查詢條件摘要')
    this.addQuerySummary(summarySheet, job)

    // 處理記錄明細
    if (data.processingRecords.length > 0) {
      const recordsSheet = workbook.addWorksheet('處理記錄明細')
      this.addProcessingRecordsSheet(recordsSheet, data.processingRecords, job.includedFields)
    }

    // 變更歷史
    if (data.changeHistory.length > 0) {
      const changeSheet = workbook.addWorksheet('數據變更歷史')
      this.addChangeHistorySheet(changeSheet, data.changeHistory)
    }

    // 文件清單
    if (data.fileList.length > 0) {
      const fileSheet = workbook.addWorksheet('原始文件清單')
      this.addFileListSheet(fileSheet, data.fileList)
    }

    // 報告完整性資訊
    const integritySheet = workbook.addWorksheet('報告完整性')
    this.addIntegrityInfo(integritySheet, data)

    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  // 生成 PDF 報告
  private async generatePdfReport(
    job: AuditReportJob,
    data: AuditReportData
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: job.title,
          Author: 'AI Document Extraction System',
          Subject: `審計報告 - ${job.reportType}`,
          CreationDate: new Date()
        }
      })

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // 封面
      this.addPdfCoverPage(doc, job, data)

      // 目錄
      doc.addPage()
      this.addPdfTableOfContents(doc, job)

      // 查詢條件摘要
      doc.addPage()
      this.addPdfQuerySummary(doc, job)

      // 處理記錄
      if (data.processingRecords.length > 0) {
        doc.addPage()
        this.addPdfProcessingRecords(doc, data.processingRecords)
      }

      // 變更歷史
      if (data.changeHistory.length > 0) {
        doc.addPage()
        this.addPdfChangeHistory(doc, data.changeHistory)
      }

      // 文件清單
      if (data.fileList.length > 0) {
        doc.addPage()
        this.addPdfFileList(doc, data.fileList)
      }

      // 報告完整性
      doc.addPage()
      this.addPdfIntegrityInfo(doc, data)

      doc.end()
    })
  }

  // 生成 CSV 報告
  private async generateCsvReport(
    job: AuditReportJob,
    data: AuditReportData
  ): Promise<Buffer> {
    const rows: string[] = []

    // 添加 BOM 以支援 Excel 正確顯示中文
    const bom = '\ufeff'

    // 報告元數據
    rows.push(`# 審計報告: ${job.title}`)
    rows.push(`# 生成時間: ${new Date().toISOString()}`)
    rows.push(`# 報告類型: ${job.reportType}`)
    rows.push(`# 時間範圍: ${job.dateFrom.toISOString()} - ${job.dateTo.toISOString()}`)
    rows.push('')

    // 處理記錄
    if (data.processingRecords.length > 0) {
      rows.push('# 處理記錄')
      const headers = ['時間戳', '用戶', '操作類型', '資源類型', '資源ID', 'IP地址', '結果']
      rows.push(headers.join(','))

      for (const record of data.processingRecords) {
        const row = [
          record.timestamp.toISOString(),
          `"${record.user?.name || record.userId}"`,
          record.actionType,
          record.resourceType,
          record.resourceId,
          record.ipAddress || '',
          record.success ? '成功' : '失敗'
        ]
        rows.push(row.join(','))
      }
      rows.push('')
    }

    // 變更歷史
    if (data.changeHistory.length > 0) {
      rows.push('# 變更歷史')
      const headers = ['時間', '變更人', '資源類型', '資源ID', '版本', '變更原因']
      rows.push(headers.join(','))

      for (const change of data.changeHistory) {
        const row = [
          change.createdAt.toISOString(),
          `"${change.changedBy?.name || change.changedById}"`,
          change.resourceType,
          change.resourceId,
          change.version.toString(),
          `"${change.changeReason || ''}"`
        ]
        rows.push(row.join(','))
      }
    }

    return Buffer.from(bom + rows.join('\n'), 'utf-8')
  }

  // 生成 JSON 報告
  private async generateJsonReport(
    job: AuditReportJob,
    data: AuditReportData
  ): Promise<Buffer> {
    const report = {
      metadata: {
        title: job.title,
        reportType: job.reportType,
        outputFormat: job.outputFormat,
        generatedAt: new Date().toISOString(),
        generatedBy: job.requestedById,
        dateRange: {
          from: job.dateFrom.toISOString(),
          to: job.dateTo.toISOString()
        },
        filters: {
          cityIds: job.cityIds,
          forwarderIds: job.forwarderIds
        },
        recordCounts: {
          processingRecords: data.processingRecords.length,
          changeHistory: data.changeHistory.length,
          files: data.fileList.length
        }
      },
      processingRecords: data.processingRecords,
      changeHistory: data.changeHistory,
      fileList: data.fileList
    }

    return Buffer.from(JSON.stringify(report, null, 2), 'utf-8')
  }

  // 計算雜湊值
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  // 生成數位簽章
  private async generateDigitalSignature(buffer: Buffer): Promise<string> {
    const privateKey = process.env.REPORT_SIGNING_PRIVATE_KEY
    if (!privateKey) {
      // 如果沒有設定私鑰，返回雜湊值作為替代
      return `hash:${this.calculateChecksum(buffer)}`
    }

    const sign = createSign('RSA-SHA256')
    sign.update(buffer)
    return sign.sign(privateKey, 'base64')
  }

  // 驗證報告完整性
  async verifyReportIntegrity(jobId: string, fileBuffer: Buffer): Promise<{
    isValid: boolean
    details: {
      checksumMatch: boolean
      signatureValid: boolean
      originalChecksum: string
      calculatedChecksum: string
    }
  }> {
    const job = await this.prisma.auditReportJob.findUniqueOrThrow({
      where: { id: jobId }
    })

    const calculatedChecksum = this.calculateChecksum(fileBuffer)
    const checksumMatch = calculatedChecksum === job.checksum

    let signatureValid = false
    if (job.digitalSignature) {
      if (job.digitalSignature.startsWith('hash:')) {
        signatureValid = checksumMatch
      } else {
        const publicKey = process.env.REPORT_SIGNING_PUBLIC_KEY
        if (publicKey) {
          const verify = require('crypto').createVerify('RSA-SHA256')
          verify.update(fileBuffer)
          signatureValid = verify.verify(publicKey, job.digitalSignature, 'base64')
        }
      }
    }

    return {
      isValid: checksumMatch && signatureValid,
      details: {
        checksumMatch,
        signatureValid,
        originalChecksum: job.checksum || '',
        calculatedChecksum
      }
    }
  }

  // 下載報告（帶審計記錄）
  async downloadReport(
    jobId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ url: string; fileName: string }> {
    const job = await this.prisma.auditReportJob.findUniqueOrThrow({
      where: { id: jobId }
    })

    if (job.status !== 'COMPLETED') {
      throw new Error('Report is not ready for download')
    }

    if (job.expiresAt && job.expiresAt < new Date()) {
      throw new Error('Report has expired')
    }

    // 記錄下載
    await this.prisma.auditReportDownload.create({
      data: {
        reportJobId: jobId,
        downloadedById: userId,
        ipAddress,
        userAgent
      }
    })

    const extension = this.getFileExtension(job.outputFormat)
    const fileName = `${job.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${
      job.dateFrom.toISOString().split('T')[0]
    }_${job.dateTo.toISOString().split('T')[0]}.${extension}`

    return {
      url: job.fileUrl!,
      fileName
    }
  }

  // 輔助方法
  private buildWhereClause(config: AuditReportConfig): any {
    const where: any = {
      timestamp: {
        gte: config.dateRange.from,
        lte: config.dateRange.to
      }
    }

    if (config.filters.cityIds?.length) {
      where.cityId = { in: config.filters.cityIds }
    }

    if (config.filters.userIds?.length) {
      where.userId = { in: config.filters.userIds }
    }

    return where
  }

  private async updateJobStatus(jobId: string, status: ReportJobStatus): Promise<void> {
    await this.prisma.auditReportJob.update({
      where: { id: jobId },
      data: { status, ...(status === 'PROCESSING' ? { startedAt: new Date() } : {}) }
    })
  }

  private async updateJobProgress(jobId: string, progress: number): Promise<void> {
    await this.prisma.auditReportJob.update({
      where: { id: jobId },
      data: { progress }
    })
  }

  private getFileExtension(format: ReportOutputFormat): string {
    const extensions: Record<ReportOutputFormat, string> = {
      EXCEL: 'xlsx',
      PDF: 'pdf',
      CSV: 'csv',
      JSON: 'json'
    }
    return extensions[format]
  }

  private async queueReportGeneration(jobId: string): Promise<void> {
    // 實際實作應使用訊息佇列（如 Bull、Azure Queue）
    setTimeout(() => this.generateReport(jobId), 100)
  }

  // Excel 輔助方法省略...
  private addCoverPage(sheet: ExcelJS.Worksheet, job: AuditReportJob, data: AuditReportData): void { /* ... */ }
  private addTableOfContents(sheet: ExcelJS.Worksheet, job: AuditReportJob): void { /* ... */ }
  private addQuerySummary(sheet: ExcelJS.Worksheet, job: AuditReportJob): void { /* ... */ }
  private addProcessingRecordsSheet(sheet: ExcelJS.Worksheet, records: any[], fields: string[]): void { /* ... */ }
  private addChangeHistorySheet(sheet: ExcelJS.Worksheet, changes: any[]): void { /* ... */ }
  private addFileListSheet(sheet: ExcelJS.Worksheet, files: any[]): void { /* ... */ }
  private addIntegrityInfo(sheet: ExcelJS.Worksheet, data: AuditReportData): void { /* ... */ }

  // PDF 輔助方法省略...
  private addPdfCoverPage(doc: PDFKit.PDFDocument, job: AuditReportJob, data: AuditReportData): void { /* ... */ }
  private addPdfTableOfContents(doc: PDFKit.PDFDocument, job: AuditReportJob): void { /* ... */ }
  private addPdfQuerySummary(doc: PDFKit.PDFDocument, job: AuditReportJob): void { /* ... */ }
  private addPdfProcessingRecords(doc: PDFKit.PDFDocument, records: any[]): void { /* ... */ }
  private addPdfChangeHistory(doc: PDFKit.PDFDocument, changes: any[]): void { /* ... */ }
  private addPdfFileList(doc: PDFKit.PDFDocument, files: any[]): void { /* ... */ }
  private addPdfIntegrityInfo(doc: PDFKit.PDFDocument, data: AuditReportData): void { /* ... */ }
}

// 報告數據類型
interface AuditReportData {
  metadata: {
    title: string
    reportType: AuditReportType
    generatedAt: Date
    dateRange: { from: Date; to: Date }
    filters: any
  }
  processingRecords: any[]
  changeHistory: any[]
  fileList: any[]
}
```

### 3. API 路由

```typescript
// app/api/audit/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditReportService } from '@/lib/services/audit-report.service'

// POST - 建立報告任務
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 檢查審計權限
  if (!['ADMIN', 'AUDITOR', 'REGIONAL_MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { reportType, outputFormat, title, dateRange, filters, includedFields, includeChanges, includeFiles } = body

    // 驗證必填欄位
    if (!reportType || !outputFormat || !title || !dateRange?.from || !dateRange?.to) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const reportService = new AuditReportService(prisma, blobService, notificationService)

    const result = await reportService.createReportJob(
      {
        reportType,
        outputFormat,
        title,
        dateRange: {
          from: new Date(dateRange.from),
          to: new Date(dateRange.to)
        },
        filters: filters || {},
        includedFields: includedFields || [],
        includeChanges: includeChanges ?? true,
        includeFiles: includeFiles ?? true
      },
      session.user.id
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Create audit report error:', error)
    return NextResponse.json(
      { error: 'Failed to create audit report' },
      { status: 500 }
    )
  }
}

// GET - 取得報告任務列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  try {
    const [jobs, total] = await Promise.all([
      prisma.auditReportJob.findMany({
        where: { requestedById: session.user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.auditReportJob.count({
        where: { requestedById: session.user.id }
      })
    ])

    return NextResponse.json({
      items: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch report jobs' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/audit/reports/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server'

// GET - 取得報告任務狀態
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const job = await prisma.auditReportJob.findUnique({
      where: { id: params.jobId },
      include: {
        requestedBy: { select: { id: true, name: true } }
      }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // 檢查權限（只能查看自己的報告或有管理員權限）
    if (job.requestedById !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(job)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/audit/reports/[jobId]/download/route.ts
import { NextRequest, NextResponse } from 'next/server'

// GET - 下載報告
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const reportService = new AuditReportService(prisma, blobService, notificationService)

    const ipAddress = request.headers.get('x-forwarded-for') || request.ip
    const userAgent = request.headers.get('user-agent') || undefined

    const { url, fileName } = await reportService.downloadReport(
      params.jobId,
      session.user.id,
      ipAddress || undefined,
      userAgent
    )

    // 產生臨時下載連結
    const downloadUrl = await blobService.generateSasUrl(url, {
      expiresIn: 3600, // 1 小時
      contentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`
    })

    return NextResponse.json({ downloadUrl, fileName })
  } catch (error) {
    console.error('Download report error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download report' },
      { status: 500 }
    )
  }
}
```

```typescript
// app/api/audit/reports/[jobId]/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'

// POST - 驗證報告完整性
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const reportService = new AuditReportService(prisma, blobService, notificationService)

    const result = await reportService.verifyReportIntegrity(params.jobId, buffer)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to verify report integrity' },
      { status: 500 }
    )
  }
}
```

### 4. React 元件

```typescript
// components/audit/AuditReportExportDialog.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, FileSpreadsheet, FileText, FileJson, File } from 'lucide-react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const reportSchema = z.object({
  title: z.string().min(1, '請輸入報告標題'),
  reportType: z.enum(['PROCESSING_RECORDS', 'CHANGE_HISTORY', 'FULL_AUDIT', 'COMPLIANCE_SUMMARY']),
  outputFormat: z.enum(['EXCEL', 'PDF', 'CSV', 'JSON']),
  dateFrom: z.date(),
  dateTo: z.date(),
  includeChanges: z.boolean(),
  includeFiles: z.boolean()
})

type ReportFormData = z.infer<typeof reportSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDateRange?: { from: Date; to: Date }
  defaultFilters?: {
    cityIds?: string[]
    forwarderIds?: string[]
  }
}

const REPORT_TYPES = [
  { value: 'PROCESSING_RECORDS', label: '處理記錄報告', description: '僅包含操作日誌' },
  { value: 'CHANGE_HISTORY', label: '變更歷史報告', description: '僅包含數據變更' },
  { value: 'FULL_AUDIT', label: '完整審計報告', description: '包含所有審計資訊' },
  { value: 'COMPLIANCE_SUMMARY', label: '合規摘要報告', description: '合規檢查總覽' }
]

const OUTPUT_FORMATS = [
  { value: 'EXCEL', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { value: 'PDF', label: 'PDF (.pdf)', icon: FileText },
  { value: 'CSV', label: 'CSV (.csv)', icon: File },
  { value: 'JSON', label: 'JSON (.json)', icon: FileJson }
]

export function AuditReportExportDialog({
  open,
  onOpenChange,
  defaultDateRange,
  defaultFilters
}: Props) {
  const [estimatedRecords, setEstimatedRecords] = useState<number | null>(null)

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      title: `審計報告_${format(new Date(), 'yyyyMMdd')}`,
      reportType: 'FULL_AUDIT',
      outputFormat: 'EXCEL',
      dateFrom: defaultDateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dateTo: defaultDateRange?.to || new Date(),
      includeChanges: true,
      includeFiles: true
    }
  })

  const createReportMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      const response = await fetch('/api/audit/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          dateRange: {
            from: data.dateFrom.toISOString(),
            to: data.dateTo.toISOString()
          },
          filters: defaultFilters
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create report')
      }

      return response.json()
    },
    onSuccess: (result) => {
      onOpenChange(false)
      if (result.isAsync) {
        // 顯示背景處理通知
        toast.info('報告正在背景生成中，完成後會通知您')
      } else {
        toast.success('報告生成完成')
      }
    },
    onError: () => {
      toast.error('報告生成失敗')
    }
  })

  const onSubmit = (data: ReportFormData) => {
    createReportMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>匯出審計報告</DialogTitle>
          <DialogDescription>
            配置報告參數，選擇需要包含的內容和輸出格式
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 報告標題 */}
          <div className="space-y-2">
            <Label htmlFor="title">報告標題</Label>
            <Input
              id="title"
              {...form.register('title')}
              placeholder="輸入報告標題"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {/* 報告類型 */}
          <div className="space-y-2">
            <Label>報告類型</Label>
            <Select
              value={form.watch('reportType')}
              onValueChange={(value: any) => form.setValue('reportType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 時間範圍 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>開始日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.watch('dateFrom'), 'yyyy/MM/dd', { locale: zhTW })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch('dateFrom')}
                    onSelect={(date) => date && form.setValue('dateFrom', date)}
                    locale={zhTW}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>結束日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.watch('dateTo'), 'yyyy/MM/dd', { locale: zhTW })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch('dateTo')}
                    onSelect={(date) => date && form.setValue('dateTo', date)}
                    locale={zhTW}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* 輸出格式 */}
          <div className="space-y-2">
            <Label>輸出格式</Label>
            <div className="grid grid-cols-4 gap-2">
              {OUTPUT_FORMATS.map((format) => {
                const Icon = format.icon
                const isSelected = form.watch('outputFormat') === format.value
                return (
                  <Button
                    key={format.value}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    className="flex flex-col h-auto py-3"
                    onClick={() => form.setValue('outputFormat', format.value as any)}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-xs">{format.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>

          {/* 包含內容選項 */}
          <div className="space-y-4">
            <Label>包含內容</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeChanges"
                  checked={form.watch('includeChanges')}
                  onCheckedChange={(checked) =>
                    form.setValue('includeChanges', checked as boolean)
                  }
                />
                <Label htmlFor="includeChanges" className="font-normal">
                  包含數據變更歷史
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeFiles"
                  checked={form.watch('includeFiles')}
                  onCheckedChange={(checked) =>
                    form.setValue('includeFiles', checked as boolean)
                  }
                />
                <Label htmlFor="includeFiles" className="font-normal">
                  包含原始文件清單
                </Label>
              </div>
            </div>
          </div>

          {/* 預估記錄數 */}
          {estimatedRecords !== null && estimatedRecords > 5000 && (
            <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              <p className="font-medium">大量數據提醒</p>
              <p>
                預估報告包含約 {estimatedRecords.toLocaleString()} 筆記錄，
                將採用背景處理方式生成，完成後會發送通知。
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={createReportMutation.isPending}
            >
              {createReportMutation.isPending ? '生成中...' : '生成報告'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

```typescript
// components/audit/AuditReportJobList.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ShieldCheck
} from 'lucide-react'
import { useState } from 'react'
import { ReportIntegrityDialog } from './ReportIntegrityDialog'

const STATUS_MAP: Record<string, { label: string; variant: any; icon: any }> = {
  PENDING: { label: '待處理', variant: 'secondary', icon: Clock },
  QUEUED: { label: '已排隊', variant: 'secondary', icon: Clock },
  PROCESSING: { label: '處理中', variant: 'default', icon: Loader2 },
  GENERATING: { label: '生成中', variant: 'default', icon: Loader2 },
  SIGNING: { label: '簽章中', variant: 'default', icon: ShieldCheck },
  COMPLETED: { label: '已完成', variant: 'success', icon: CheckCircle },
  FAILED: { label: '失敗', variant: 'destructive', icon: XCircle },
  CANCELLED: { label: '已取消', variant: 'outline', icon: XCircle },
  EXPIRED: { label: '已過期', variant: 'outline', icon: Clock }
}

export function AuditReportJobList() {
  const [verifyJobId, setVerifyJobId] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-report-jobs'],
    queryFn: async () => {
      const response = await fetch('/api/audit/reports')
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    },
    refetchInterval: 10000 // 每 10 秒刷新一次
  })

  const handleDownload = async (jobId: string) => {
    try {
      const response = await fetch(`/api/audit/reports/${jobId}/download`)
      if (!response.ok) throw new Error('Failed to get download URL')

      const { downloadUrl, fileName } = await response.json()

      // 建立下載連結
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      toast.error('下載失敗')
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">我的報告</h3>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>報告標題</TableHead>
            <TableHead>類型</TableHead>
            <TableHead>時間範圍</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead>建立時間</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.items?.map((job: any) => {
            const status = STATUS_MAP[job.status]
            const StatusIcon = status?.icon

            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{job.reportType}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(job.dateFrom), 'yyyy/MM/dd')} -{' '}
                  {format(new Date(job.dateTo), 'yyyy/MM/dd')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={status?.variant}>
                      {StatusIcon && (
                        <StatusIcon className={`h-3 w-3 mr-1 ${
                          ['PROCESSING', 'GENERATING', 'SIGNING'].includes(job.status)
                            ? 'animate-spin'
                            : ''
                        }`} />
                      )}
                      {status?.label}
                    </Badge>
                    {['PROCESSING', 'GENERATING'].includes(job.status) && (
                      <Progress value={job.progress} className="w-20 h-2" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(job.createdAt), {
                    addSuffix: true,
                    locale: zhTW
                  })}
                </TableCell>
                <TableCell className="text-right">
                  {job.status === 'COMPLETED' && (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVerifyJobId(job.id)}
                      >
                        <ShieldCheck className="h-4 w-4 mr-1" />
                        驗證
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDownload(job.id)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        下載
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {verifyJobId && (
        <ReportIntegrityDialog
          jobId={verifyJobId}
          open={!!verifyJobId}
          onOpenChange={(open) => !open && setVerifyJobId(null)}
        />
      )}
    </div>
  )
}
```

```typescript
// components/audit/ReportIntegrityDialog.tsx
'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle, XCircle, Upload, ShieldCheck, AlertCircle } from 'lucide-react'

interface Props {
  jobId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportIntegrityDialog({ jobId, open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)

  const verifyMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/audit/reports/${jobId}/verify`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Verification failed')
      return response.json()
    },
    onSuccess: (data) => {
      setResult(data)
    }
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleVerify = () => {
    if (file) {
      verifyMutation.mutate(file)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            驗證報告完整性
          </DialogTitle>
          <DialogDescription>
            上傳報告檔案以驗證其是否被篡改
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              id="report-file"
              accept=".xlsx,.pdf,.csv,.json"
            />
            <label htmlFor="report-file" className="cursor-pointer">
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                點擊或拖曳報告檔案到此處
              </p>
              {file && (
                <p className="mt-2 text-sm font-medium">{file.name}</p>
              )}
            </label>
          </div>

          {file && !result && (
            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? '驗證中...' : '開始驗證'}
            </Button>
          )}

          {result && (
            <div className={`rounded-lg p-4 ${
              result.isValid
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {result.isValid ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      報告完整性驗證通過
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-800">
                      報告完整性驗證失敗
                    </span>
                  </>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">雜湊值驗證</span>
                  <span className={result.details.checksumMatch ? 'text-green-600' : 'text-red-600'}>
                    {result.details.checksumMatch ? '通過' : '不符'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">數位簽章驗證</span>
                  <span className={result.details.signatureValid ? 'text-green-600' : 'text-red-600'}>
                    {result.details.signatureValid ? '通過' : '不符'}
                  </span>
                </div>
                {!result.isValid && (
                  <div className="mt-3 flex items-start gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>
                      此報告可能已被修改，請重新從系統下載原始報告。
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 測試案例

### 單元測試

```typescript
// __tests__/services/audit-report.service.test.ts
import { AuditReportService } from '@/lib/services/audit-report.service'

describe('AuditReportService', () => {
  let service: AuditReportService

  beforeEach(() => {
    service = new AuditReportService(
      mockPrisma,
      mockBlobService,
      mockNotificationService
    )
  })

  describe('createReportJob', () => {
    it('should create synchronous job for small reports', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(100)

      const result = await service.createReportJob(
        {
          reportType: 'PROCESSING_RECORDS',
          outputFormat: 'EXCEL',
          title: 'Test Report',
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-01-31')
          },
          filters: {},
          includedFields: [],
          includeChanges: true,
          includeFiles: true
        },
        'user-1'
      )

      expect(result.isAsync).toBe(false)
    })

    it('should create async job for large reports (>5000 records)', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(10000)

      const result = await service.createReportJob(
        {
          reportType: 'FULL_AUDIT',
          outputFormat: 'EXCEL',
          title: 'Large Report',
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-12-31')
          },
          filters: {},
          includedFields: [],
          includeChanges: true,
          includeFiles: true
        },
        'user-1'
      )

      expect(result.isAsync).toBe(true)
    })
  })

  describe('verifyReportIntegrity', () => {
    it('should return valid for matching checksum', async () => {
      const testBuffer = Buffer.from('test content')
      const checksum = createHash('sha256').update(testBuffer).digest('hex')

      mockPrisma.auditReportJob.findUniqueOrThrow.mockResolvedValue({
        checksum,
        digitalSignature: `hash:${checksum}`
      })

      const result = await service.verifyReportIntegrity('job-1', testBuffer)

      expect(result.isValid).toBe(true)
      expect(result.details.checksumMatch).toBe(true)
    })

    it('should return invalid for mismatched checksum', async () => {
      mockPrisma.auditReportJob.findUniqueOrThrow.mockResolvedValue({
        checksum: 'original-hash',
        digitalSignature: 'hash:original-hash'
      })

      const result = await service.verifyReportIntegrity(
        'job-1',
        Buffer.from('modified content')
      )

      expect(result.isValid).toBe(false)
      expect(result.details.checksumMatch).toBe(false)
    })
  })

  describe('generateExcelReport', () => {
    it('should generate valid Excel file with all sections', async () => {
      const buffer = await service['generateExcelReport'](
        mockJob,
        mockReportData
      )

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)

      // 驗證 Excel 結構
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)

      expect(workbook.worksheets.length).toBeGreaterThanOrEqual(4)
      expect(workbook.getWorksheet('封面')).toBeDefined()
      expect(workbook.getWorksheet('目錄')).toBeDefined()
    })
  })
})
```

### 整合測試

```typescript
// __tests__/api/audit-reports.test.ts
import { createMocks } from 'node-mocks-http'

describe('POST /api/audit/reports', () => {
  it('should create report job for auditor role', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: 'AUDITOR' }
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        reportType: 'FULL_AUDIT',
        outputFormat: 'EXCEL',
        title: 'Quarterly Audit',
        dateRange: {
          from: '2024-01-01',
          to: '2024-03-31'
        }
      }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(JSON.parse(res._getData())).toHaveProperty('jobId')
  })

  it('should reject non-auditor users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', role: 'USER' }
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: { /* ... */ }
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(403)
  })
})
```

---

## 相依性

### 前置 Stories
- **Story 8-1**: 用戶操作日誌記錄（AuditLog 資料模型）
- **Story 8-2**: 數據變更追蹤（DataChangeHistory 資料模型）
- **Story 8-3**: 處理記錄查詢（審計查詢服務）

### 後續 Stories
- **Story 8-6**: 長期數據保留（歸檔報告管理）

### 外部相依
- ExcelJS（Excel 生成）
- PDFKit（PDF 生成）
- Azure Blob Storage（報告儲存）
- 通知服務（完成通知）

---

## 備註

### 安全考量
1. 報告下載記錄完整追蹤
2. 數位簽章確保報告完整性
3. 報告過期機制防止無限期存取
4. 權限控制確保只有授權用戶可存取

### 效能優化
1. 大量數據採用背景處理
2. 分批讀取資料減少記憶體壓力
3. 報告檔案存儲在 Blob Storage
4. 進度追蹤提供即時回饋

### 合規要求
1. 報告包含完整的查詢條件記錄
2. 支援多種輸出格式滿足不同審計需求
3. 數位簽章/雜湊值確保報告可驗證
4. 下載記錄提供完整審計追蹤
