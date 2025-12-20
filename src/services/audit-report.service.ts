/**
 * @fileoverview 審計報告匯出服務
 * @description
 *   提供審計報告生成和匯出功能：
 *   - 支援多種報告類型（處理記錄、變更歷史、完整審計、合規摘要）
 *   - 支援多種輸出格式（Excel、PDF、CSV、JSON）
 *   - 大量數據背景處理（>5000 筆）
 *   - SHA-256 checksum 和數位簽章驗證
 *   - 報告下載追蹤
 *
 * @module src/services/audit-report.service
 * @since Epic 8 - Story 8.5
 * @lastModified 2025-12-20
 *
 * @features
 *   - createReportJob: 建立報告任務
 *   - generateReport: 生成報告
 *   - generateExcelReport: 生成 Excel 格式報告
 *   - generatePdfReport: 生成 PDF 格式報告
 *   - generateCsvReport: 生成 CSV 格式報告
 *   - generateJsonReport: 生成 JSON 格式報告
 *   - verifyReportIntegrity: 驗證報告完整性
 *   - downloadReport: 下載報告（含追蹤）
 *
 * @dependencies
 *   - exceljs - Excel 生成
 *   - pdfkit - PDF 生成
 *   - crypto - 雜湊計算
 *   - @/lib/prisma - 資料庫存取
 *   - @/lib/azure-blob - Blob 儲存
 */

import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { uploadBufferToBlob, generateSignedUrl } from '@/lib/azure-blob'
import type {
  AuditReportType,
  ReportOutputFormat,
  ReportJobStatus2,
  AuditLog,
  DataChangeHistory,
  Document,
  User,
} from '@prisma/client'
import type {
  AuditReportConfig,
  AuditReportData,
  ProcessingRecordItem,
  ChangeHistoryItem,
  FileListItem,
  ReportIntegrityResult,
} from '@/types/audit-report'
import { LARGE_REPORT_THRESHOLD, REPORT_EXPIRY_DAYS } from '@/types/audit-report'

// =====================
// Types
// =====================

interface AuditLogWithUser extends AuditLog {
  user: Pick<User, 'id' | 'name' | 'email'>
}

interface DataChangeHistoryWithUser extends DataChangeHistory {
  changedByUser: Pick<User, 'id' | 'name' | 'email'>
}

// =====================
// Service Class
// =====================

/**
 * 審計報告服務
 *
 * @description
 *   管理審計報告的生成和匯出，支援多種格式和大量數據處理
 */
export class AuditReportService {
  // =====================
  // Public Methods
  // =====================

  /**
   * 建立報告任務
   *
   * @param config - 報告配置
   * @param requestedById - 請求者 ID
   * @returns 任務 ID 和是否為異步處理
   */
  async createReportJob(
    config: AuditReportConfig,
    requestedById: string
  ): Promise<{ jobId: string; isAsync: boolean; estimatedRecords: number }> {
    const estimatedCount = await this.estimateRecordCount(config)
    const isAsync = estimatedCount > LARGE_REPORT_THRESHOLD

    const dateFrom = new Date(config.dateRange.from)
    const dateTo = new Date(config.dateRange.to)

    const job = await prisma.auditReportJob.create({
      data: {
        reportType: config.reportType,
        outputFormat: config.outputFormat,
        title: config.title,
        queryParams: JSON.parse(JSON.stringify(config)),
        dateFrom,
        dateTo,
        cityIds: config.filters.cityIds || [],
        forwarderIds: config.filters.forwarderIds || [],
        includedFields: config.includedFields,
        includeChanges: config.includeChanges,
        includeFiles: config.includeFiles,
        totalRecords: estimatedCount,
        status: isAsync ? 'QUEUED' : 'PROCESSING',
        requestedById,
        expiresAt: new Date(Date.now() + REPORT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
    })

    if (isAsync) {
      // 背景處理
      this.queueReportGeneration(job.id)
    } else {
      // 同步處理
      this.generateReport(job.id).catch((error) => {
        console.error(`Report generation failed for job ${job.id}:`, error)
      })
    }

    return { jobId: job.id, isAsync, estimatedRecords: estimatedCount }
  }

  /**
   * 生成報告
   *
   * @param jobId - 報告任務 ID
   */
  async generateReport(jobId: string): Promise<void> {
    const job = await prisma.auditReportJob.findUniqueOrThrow({
      where: { id: jobId },
      include: { requestedBy: { select: { id: true, name: true, email: true } } },
    })

    try {
      await this.updateJobStatus(jobId, 'PROCESSING', { startedAt: new Date() })

      // 收集報告數據
      const reportData = await this.collectReportData(job)

      await this.updateJobStatus(jobId, 'GENERATING')

      // 生成報告檔案
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
          throw new Error(`不支援的格式: ${job.outputFormat}`)
      }

      // 計算 checksum
      const checksum = this.calculateChecksum(fileBuffer)

      await this.updateJobStatus(jobId, 'SIGNING')

      // 生成數位簽章
      const digitalSignature = this.generateDigitalSignature(fileBuffer, checksum)

      // 上傳到 Blob Storage
      const fileName = `audit-reports/${jobId}/report_${Date.now()}.${fileExtension}`
      await uploadBufferToBlob(fileBuffer, fileName, contentType)

      // 更新任務狀態
      await prisma.auditReportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          processedRecords: job.totalRecords || 0,
          fileUrl: fileName,
          fileSize: BigInt(fileBuffer.length),
          checksum,
          digitalSignature,
          completedAt: new Date(),
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await prisma.auditReportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage,
          errorDetails: { stack: error instanceof Error ? error.stack : undefined },
        },
      })
      throw error
    }
  }

  /**
   * 驗證報告完整性
   *
   * @param jobId - 報告任務 ID
   * @param fileBuffer - 檔案 Buffer
   * @returns 驗證結果
   */
  async verifyReportIntegrity(jobId: string, fileBuffer: Buffer): Promise<ReportIntegrityResult> {
    const job = await prisma.auditReportJob.findUniqueOrThrow({
      where: { id: jobId },
    })

    const calculatedChecksum = this.calculateChecksum(fileBuffer)
    const checksumMatch = calculatedChecksum === job.checksum

    // 驗證數位簽章
    let signatureValid = false
    if (job.digitalSignature?.startsWith('hash:')) {
      signatureValid = checksumMatch
    }

    return {
      isValid: checksumMatch && signatureValid,
      details: {
        checksumMatch,
        signatureValid,
        originalChecksum: job.checksum || '',
        calculatedChecksum,
      },
    }
  }

  /**
   * 下載報告
   *
   * @param jobId - 報告任務 ID
   * @param userId - 下載者 ID
   * @param ipAddress - IP 地址
   * @param userAgent - User Agent
   * @returns 下載 URL 和檔案名稱
   */
  async downloadReport(
    jobId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ url: string; fileName: string; fileSize: number; checksum: string }> {
    const job = await prisma.auditReportJob.findUniqueOrThrow({
      where: { id: jobId },
    })

    if (job.status !== 'COMPLETED') {
      throw new Error('報告尚未完成')
    }

    if (!job.fileUrl) {
      throw new Error('報告檔案不存在')
    }

    if (job.expiresAt && job.expiresAt < new Date()) {
      throw new Error('報告已過期')
    }

    // 記錄下載
    await prisma.auditReportDownload.create({
      data: {
        reportJobId: jobId,
        downloadedById: userId,
        ipAddress,
        userAgent,
      },
    })

    // 生成簽名 URL（24 小時有效）
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const url = await generateSignedUrl(job.fileUrl, expiresAt)

    const extensionMap: Record<ReportOutputFormat, string> = {
      EXCEL: 'xlsx',
      PDF: 'pdf',
      CSV: 'csv',
      JSON: 'json',
    }
    const extension = extensionMap[job.outputFormat]
    const safeTitle = job.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
    const dateStr = job.dateFrom.toISOString().split('T')[0]
    const fileName = `${safeTitle}_${dateStr}.${extension}`

    return {
      url,
      fileName,
      fileSize: Number(job.fileSize || 0),
      checksum: job.checksum || '',
    }
  }

  /**
   * 取得報告任務列表
   */
  async getReportJobs(
    userId: string,
    params: { page?: number; limit?: number; status?: ReportJobStatus2 }
  ) {
    const page = params.page || 1
    const limit = params.limit || 20
    const skip = (page - 1) * limit

    const where = {
      requestedById: userId,
      ...(params.status && { status: params.status }),
    }

    const [items, total] = await Promise.all([
      prisma.auditReportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { downloads: true } },
        },
      }),
      prisma.auditReportJob.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        ...item,
        fileSize: item.fileSize ? Number(item.fileSize) : null,
        downloadCount: item._count.downloads,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * 取得報告任務詳情
   */
  async getReportJob(jobId: string) {
    const job = await prisma.auditReportJob.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        downloads: {
          orderBy: { downloadedAt: 'desc' },
          take: 10,
          include: {
            downloadedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    return {
      ...job,
      fileSize: job.fileSize ? Number(job.fileSize) : null,
    }
  }

  // =====================
  // Private Methods
  // =====================

  /**
   * 生成 Excel 報告
   */
  private async generateExcelReport(
    job: { id: string; title: string; reportType: AuditReportType; dateFrom: Date; dateTo: Date },
    data: AuditReportData
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AI Document Extraction System'
    workbook.created = new Date()

    // 封面工作表
    const coverSheet = workbook.addWorksheet('封面')
    coverSheet.columns = [
      { header: '項目', key: 'item', width: 25 },
      { header: '內容', key: 'value', width: 60 },
    ]
    coverSheet.addRows([
      { item: '報告標題', value: job.title },
      { item: '報告類型', value: job.reportType },
      { item: '生成時間', value: new Date().toLocaleString('zh-TW') },
      { item: '時間範圍', value: `${job.dateFrom.toISOString().split('T')[0]} 至 ${job.dateTo.toISOString().split('T')[0]}` },
      { item: '處理記錄數', value: data.processingRecords.length },
      { item: '變更歷史數', value: data.changeHistory.length },
      { item: '文件數', value: data.fileList.length },
    ])
    coverSheet.getRow(1).font = { bold: true }

    // 處理記錄工作表
    if (data.processingRecords.length > 0) {
      const recordsSheet = workbook.addWorksheet('處理記錄明細')
      recordsSheet.columns = [
        { header: '時間戳', key: 'timestamp', width: 22 },
        { header: '用戶', key: 'userName', width: 20 },
        { header: '操作類型', key: 'action', width: 15 },
        { header: '資源類型', key: 'resourceType', width: 15 },
        { header: '資源ID', key: 'resourceId', width: 25 },
        { header: '資源名稱', key: 'resourceName', width: 25 },
        { header: 'IP地址', key: 'ipAddress', width: 15 },
        { header: '結果', key: 'status', width: 10 },
      ]
      data.processingRecords.forEach((r) => {
        recordsSheet.addRow({
          timestamp: r.timestamp.toLocaleString('zh-TW'),
          userName: r.userName,
          action: r.action,
          resourceType: r.resourceType,
          resourceId: r.resourceId,
          resourceName: r.resourceName || '',
          ipAddress: r.ipAddress || '',
          status: r.status === 'SUCCESS' ? '成功' : r.status === 'FAILURE' ? '失敗' : '部分',
        })
      })
      recordsSheet.getRow(1).font = { bold: true }
      recordsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      recordsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    }

    // 變更歷史工作表
    if (data.changeHistory.length > 0) {
      const changeSheet = workbook.addWorksheet('數據變更歷史')
      changeSheet.columns = [
        { header: '時間', key: 'createdAt', width: 22 },
        { header: '變更人', key: 'changedByName', width: 20 },
        { header: '資源類型', key: 'resourceType', width: 15 },
        { header: '資源ID', key: 'resourceId', width: 25 },
        { header: '版本', key: 'version', width: 8 },
        { header: '變更類型', key: 'changeType', width: 12 },
        { header: '變更原因', key: 'changeReason', width: 30 },
      ]
      data.changeHistory.forEach((c) => {
        changeSheet.addRow({
          createdAt: c.createdAt.toLocaleString('zh-TW'),
          changedByName: c.changedByName,
          resourceType: c.resourceType,
          resourceId: c.resourceId,
          version: c.version,
          changeType: c.changeType,
          changeReason: c.changeReason || '',
        })
      })
      changeSheet.getRow(1).font = { bold: true }
      changeSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      changeSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    }

    // 文件清單工作表
    if (data.fileList.length > 0) {
      const fileSheet = workbook.addWorksheet('原始文件清單')
      fileSheet.columns = [
        { header: 'ID', key: 'id', width: 28 },
        { header: '檔名', key: 'fileName', width: 40 },
        { header: '類型', key: 'fileType', width: 12 },
        { header: '大小(KB)', key: 'fileSize', width: 12 },
        { header: '狀態', key: 'status', width: 15 },
        { header: '城市', key: 'cityCode', width: 10 },
        { header: '建立時間', key: 'createdAt', width: 22 },
      ]
      data.fileList.forEach((f) => {
        fileSheet.addRow({
          id: f.id,
          fileName: f.fileName,
          fileType: f.fileType,
          fileSize: Math.round(f.fileSize / 1024),
          status: f.status,
          cityCode: f.cityCode || '',
          createdAt: f.createdAt.toLocaleString('zh-TW'),
        })
      })
      fileSheet.getRow(1).font = { bold: true }
      fileSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      fileSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  /**
   * 生成 PDF 報告
   */
  private async generatePdfReport(
    job: { id: string; title: string; reportType: AuditReportType; dateFrom: Date; dateTo: Date },
    data: AuditReportData
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const doc = new PDFDocument({ size: 'A4', margin: 50 })

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // 標題
      doc.fontSize(24).text(job.title, { align: 'center' })
      doc.moveDown()

      // 報告資訊
      doc.fontSize(12)
      doc.text(`報告類型: ${job.reportType}`)
      doc.text(`生成時間: ${new Date().toLocaleString('zh-TW')}`)
      doc.text(`時間範圍: ${job.dateFrom.toISOString().split('T')[0]} 至 ${job.dateTo.toISOString().split('T')[0]}`)
      doc.moveDown()

      // 統計摘要
      doc.fontSize(14).text('統計摘要', { underline: true })
      doc.fontSize(10)
      doc.text(`處理記錄總數: ${data.processingRecords.length}`)
      doc.text(`變更歷史總數: ${data.changeHistory.length}`)
      doc.text(`文件總數: ${data.fileList.length}`)
      doc.moveDown()

      // 處理記錄摘要（前 20 筆）
      if (data.processingRecords.length > 0) {
        doc.addPage()
        doc.fontSize(14).text('處理記錄摘要 (前 20 筆)', { underline: true })
        doc.fontSize(8)
        data.processingRecords.slice(0, 20).forEach((r, i) => {
          doc.text(`${i + 1}. [${r.timestamp.toLocaleString('zh-TW')}] ${r.userName} - ${r.action} ${r.resourceType}`)
        })
        if (data.processingRecords.length > 20) {
          doc.text(`... 及其他 ${data.processingRecords.length - 20} 筆記錄`)
        }
      }

      // 頁腳
      doc.fontSize(8)
      doc.text(`報告 ID: ${job.id}`, { align: 'right' })

      doc.end()
    })
  }

  /**
   * 生成 CSV 報告
   */
  private async generateCsvReport(
    job: { id: string; title: string; reportType: AuditReportType; dateFrom: Date; dateTo: Date },
    data: AuditReportData
  ): Promise<Buffer> {
    const rows: string[] = []

    // BOM for UTF-8
    rows.push('\ufeff')

    // 標題資訊
    rows.push(`# 審計報告: ${job.title}`)
    rows.push(`# 報告類型: ${job.reportType}`)
    rows.push(`# 生成時間: ${new Date().toISOString()}`)
    rows.push(`# 時間範圍: ${job.dateFrom.toISOString()} - ${job.dateTo.toISOString()}`)
    rows.push('')

    // 處理記錄
    if (data.processingRecords.length > 0) {
      rows.push('# 處理記錄')
      rows.push('時間戳,用戶ID,用戶名稱,操作類型,資源類型,資源ID,IP地址,結果')
      data.processingRecords.forEach((r) => {
        rows.push(
          `"${r.timestamp.toISOString()}","${r.userId}","${r.userName}","${r.action}","${r.resourceType}","${r.resourceId}","${r.ipAddress || ''}","${r.status}"`
        )
      })
      rows.push('')
    }

    // 變更歷史
    if (data.changeHistory.length > 0) {
      rows.push('# 變更歷史')
      rows.push('時間,變更人ID,變更人名稱,資源類型,資源ID,版本,變更類型,變更原因')
      data.changeHistory.forEach((c) => {
        rows.push(
          `"${c.createdAt.toISOString()}","${c.changedBy}","${c.changedByName}","${c.resourceType}","${c.resourceId}","${c.version}","${c.changeType}","${c.changeReason || ''}"`
        )
      })
      rows.push('')
    }

    // 文件清單
    if (data.fileList.length > 0) {
      rows.push('# 文件清單')
      rows.push('ID,檔名,類型,大小,狀態,城市,建立時間')
      data.fileList.forEach((f) => {
        rows.push(
          `"${f.id}","${f.fileName}","${f.fileType}","${f.fileSize}","${f.status}","${f.cityCode || ''}","${f.createdAt.toISOString()}"`
        )
      })
    }

    return Buffer.from(rows.join('\n'), 'utf-8')
  }

  /**
   * 生成 JSON 報告
   */
  private async generateJsonReport(
    job: { id: string; title: string; reportType: AuditReportType; dateFrom: Date; dateTo: Date },
    data: AuditReportData
  ): Promise<Buffer> {
    const report = {
      metadata: {
        title: job.title,
        reportType: job.reportType,
        generatedAt: new Date().toISOString(),
        dateRange: {
          from: job.dateFrom.toISOString(),
          to: job.dateTo.toISOString(),
        },
        statistics: {
          processingRecords: data.processingRecords.length,
          changeHistory: data.changeHistory.length,
          fileList: data.fileList.length,
        },
      },
      processingRecords: data.processingRecords,
      changeHistory: data.changeHistory,
      fileList: data.fileList,
    }

    return Buffer.from(JSON.stringify(report, null, 2), 'utf-8')
  }

  /**
   * 收集報告數據
   */
  private async collectReportData(job: {
    reportType: AuditReportType
    dateFrom: Date
    dateTo: Date
    cityIds: string[]
    forwarderIds: string[]
    includeChanges: boolean
    includeFiles: boolean
    requestedBy: Pick<User, 'id' | 'name' | 'email'>
  }): Promise<AuditReportData> {
    const data: AuditReportData = {
      metadata: {
        title: '',
        reportType: job.reportType,
        generatedAt: new Date(),
        generatedBy: job.requestedBy.name || job.requestedBy.email || job.requestedBy.id,
        dateRange: { from: job.dateFrom, to: job.dateTo },
        filters: { cityIds: job.cityIds, forwarderIds: job.forwarderIds },
        totalRecords: 0,
      },
      processingRecords: [],
      changeHistory: [],
      fileList: [],
    }

    const dateWhere = {
      createdAt: {
        gte: job.dateFrom,
        lte: job.dateTo,
      },
    }

    // 處理記錄
    if (job.reportType === 'PROCESSING_RECORDS' || job.reportType === 'FULL_AUDIT') {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          ...dateWhere,
          ...(job.cityIds.length > 0 && { cityCode: { in: job.cityIds } }),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }) as AuditLogWithUser[]

      data.processingRecords = auditLogs.map((log): ProcessingRecordItem => ({
        id: log.id,
        timestamp: log.createdAt,
        userId: log.userId,
        userName: log.user.name || log.user.email || log.userId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId || '',
        resourceName: log.resourceName || undefined,
        ipAddress: log.ipAddress || undefined,
        status: log.status as 'SUCCESS' | 'FAILURE' | 'PARTIAL',
        details: log.metadata as Record<string, unknown> | undefined,
      }))
    }

    // 變更歷史
    if (job.includeChanges && (job.reportType === 'CHANGE_HISTORY' || job.reportType === 'FULL_AUDIT')) {
      const changeHistory = await prisma.dataChangeHistory.findMany({
        where: {
          ...dateWhere,
          ...(job.cityIds.length > 0 && { cityCode: { in: job.cityIds } }),
        },
        include: { changedByUser: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }) as DataChangeHistoryWithUser[]

      data.changeHistory = changeHistory.map((c): ChangeHistoryItem => ({
        id: c.id,
        resourceType: c.resourceType,
        resourceId: c.resourceId,
        version: c.version,
        changeType: c.changeType as 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
        changedBy: c.changedBy,
        changedByName: c.changedByUser.name || c.changedByUser.email || c.changedBy,
        changeReason: c.changeReason || undefined,
        changes: c.changes as { before: Record<string, unknown>; after: Record<string, unknown>; changedFields: string[] } | undefined,
        createdAt: c.createdAt,
      }))
    }

    // 文件清單
    if (job.includeFiles) {
      const documents = await prisma.document.findMany({
        where: {
          ...dateWhere,
          ...(job.cityIds.length > 0 && { cityCode: { in: job.cityIds } }),
          ...(job.forwarderIds.length > 0 && { forwarderId: { in: job.forwarderIds } }),
        },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          status: true,
          cityCode: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }) as Pick<Document, 'id' | 'fileName' | 'fileType' | 'fileSize' | 'status' | 'cityCode' | 'createdAt' | 'updatedAt'>[]

      data.fileList = documents.map((d): FileListItem => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        fileSize: d.fileSize,
        status: d.status,
        cityCode: d.cityCode || undefined,
        createdAt: d.createdAt,
        processedAt: d.updatedAt,
      }))
    }

    data.metadata.totalRecords =
      data.processingRecords.length + data.changeHistory.length + data.fileList.length

    return data
  }

  /**
   * 估算記錄數量
   */
  private async estimateRecordCount(config: AuditReportConfig): Promise<number> {
    const dateFrom = new Date(config.dateRange.from)
    const dateTo = new Date(config.dateRange.to)

    const count = await prisma.auditLog.count({
      where: {
        createdAt: {
          gte: dateFrom,
          lte: dateTo,
        },
        ...(config.filters.cityIds?.length && { cityCode: { in: config.filters.cityIds } }),
      },
    })

    return count
  }

  /**
   * 更新任務狀態
   */
  private async updateJobStatus(
    jobId: string,
    status: ReportJobStatus2,
    extra?: { startedAt?: Date; progress?: number }
  ): Promise<void> {
    await prisma.auditReportJob.update({
      where: { id: jobId },
      data: { status, ...extra },
    })
  }

  /**
   * 佇列報告生成（背景處理）
   */
  private queueReportGeneration(jobId: string): void {
    // 使用 setTimeout 進行簡單的背景處理
    // 在生產環境中應使用專門的佇列系統（如 Bull、BullMQ）
    setTimeout(() => {
      this.generateReport(jobId).catch((error) => {
        console.error(`Background report generation failed for job ${jobId}:`, error)
      })
    }, 100)
  }

  /**
   * 計算 SHA-256 checksum
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  /**
   * 生成數位簽章
   */
  private generateDigitalSignature(buffer: Buffer, checksum: string): string {
    // 簡化版本：使用 hash 作為簽章
    // 在生產環境中應使用私鑰進行真正的數位簽章
    return `hash:${checksum}`
  }
}

// =====================
// Export Singleton
// =====================

export const auditReportService = new AuditReportService()
