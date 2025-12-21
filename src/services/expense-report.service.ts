/**
 * @fileoverview 費用報表服務
 * @description
 *   提供費用明細報表的生成與匯出功能：
 *   - 支援直接生成（小量數據）
 *   - 支援背景處理（大量數據 > 10,000 筆）
 *   - Excel 報表生成（ExcelJS）
 *   - Azure Blob Storage 存儲
 *   - 進度追蹤與通知
 *
 * @module src/services/expense-report.service
 * @since Epic 7 - Story 7.4 (費用明細報表匯出)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 匯出選項對話框
 *   - AC2: 匯出參數配置（日期、欄位）
 *   - AC3: 報表內容生成與下載
 *   - AC4: 背景處理大量數據
 *   - AC5: 權限控制（EXPORT_REPORTS）
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/lib/azure-blob - Azure Blob Storage
 *   - @/lib/notification - 通知工具
 *   - @/middlewares/city-filter - 城市過濾
 *   - exceljs - Excel 生成
 */

import { prisma } from '@/lib/prisma'
import { CityFilterContext, buildCityWhereClause } from '@/middlewares/city-filter'
import {
  ExportConfig,
  ExportField,
  DOWNLOAD_LINK_EXPIRY_HOURS
} from '@/types/report-export'
import ExcelJS from 'exceljs'
import { uploadBufferToBlob, generateSignedUrl, deleteBlob } from '@/lib/azure-blob'
import { sendNotification } from '@/lib/notification'

// ============================================================
// Constants
// ============================================================

/**
 * 狀態翻譯映射
 */
const STATUS_TRANSLATIONS: Record<string, string> = {
  PENDING: '待處理',
  PROCESSING: '處理中',
  PENDING_REVIEW: '待審核',
  APPROVED: '已核准',
  COMPLETED: '已完成',
  FAILED: '失敗',
  ESCALATED: '已升級'
}

/**
 * 每批查詢的記錄數
 */
const BATCH_SIZE = 1000

// ============================================================
// Types
// ============================================================

/**
 * 文件查詢結果類型（使用實際 Prisma Schema 關聯）
 */
interface DocumentWithRelations {
  id: string
  status: string
  cityCode: string | null
  processingPath: string | null
  createdAt: Date
  forwarder: {
    code: string
    name: string
  } | null
  extractionResult: {
    averageConfidence: number
    fieldMappings: Record<string, { value?: string | null }> | null
  } | null
  processingQueue: {
    completedAt: Date | null
  } | null
  reviewRecords: Array<{
    completedAt: Date
  }>
}

// ============================================================
// ExpenseReportService Class
// ============================================================

/**
 * 費用報表服務
 *
 * @description
 *   提供費用報表的完整生成流程：
 *   1. 估算記錄數量
 *   2. 生成 Excel 報表
 *   3. 處理背景任務
 *   4. 發送完成通知
 *
 * @example
 * ```typescript
 * const service = new ExpenseReportService()
 *
 * // 估算數量
 * const count = await service.getEstimatedCount(cityContext, config)
 *
 * // 直接生成報表
 * const buffer = await service.exportToExcel(cityContext, config)
 *
 * // 背景處理
 * const jobId = await service.createBackgroundJob(userId, config)
 * await service.processBackgroundJob(jobId, cityContext)
 * ```
 */
export class ExpenseReportService {
  /**
   * 估算符合條件的記錄數
   *
   * @param cityContext - 城市過濾上下文
   * @param config - 匯出配置
   * @returns 估算的記錄數
   */
  async getEstimatedCount(
    cityContext: CityFilterContext,
    config: ExportConfig
  ): Promise<number> {
    const cityWhere = buildCityWhereClause(cityContext)

    return prisma.document.count({
      where: {
        ...cityWhere,
        createdAt: {
          gte: new Date(config.dateRange.startDate),
          lte: new Date(config.dateRange.endDate)
        },
        // 只計算已完成處理的文件
        status: { in: ['COMPLETED', 'APPROVED', 'PENDING_REVIEW'] },
        ...(config.forwarderIds?.length && {
          forwarderId: { in: config.forwarderIds }
        })
      }
    })
  }

  /**
   * 生成 Excel 報表
   *
   * @param cityContext - 城市過濾上下文
   * @param config - 匯出配置
   * @param onProgress - 進度回調函數
   * @returns Excel 報表 Buffer
   */
  async exportToExcel(
    cityContext: CityFilterContext,
    config: ExportConfig,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<Buffer> {
    const cityWhere = buildCityWhereClause(cityContext)

    // 分批查詢數據以處理大量記錄
    let offset = 0
    const allDocuments: DocumentWithRelations[] = []

    // 首先獲取總數
    const totalCount = await this.getEstimatedCount(cityContext, config)

    while (true) {
      const batch = await prisma.document.findMany({
        where: {
          ...cityWhere,
          createdAt: {
            gte: new Date(config.dateRange.startDate),
            lte: new Date(config.dateRange.endDate)
          },
          // 只查詢已完成處理的文件
          status: { in: ['COMPLETED', 'APPROVED', 'PENDING_REVIEW'] },
          ...(config.forwarderIds?.length && {
            forwarderId: { in: config.forwarderIds }
          })
        },
        include: {
          forwarder: {
            select: { code: true, name: true }
          },
          extractionResult: {
            select: { averageConfidence: true, fieldMappings: true }
          },
          processingQueue: {
            select: { completedAt: true }
          },
          reviewRecords: {
            select: { completedAt: true },
            orderBy: { completedAt: 'desc' },
            take: 1
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: BATCH_SIZE
      })

      if (batch.length === 0) break

      allDocuments.push(...(batch as unknown as DocumentWithRelations[]))
      offset += batch.length

      // 報告進度（查詢階段佔 50%）
      if (onProgress && totalCount > 0) {
        const queryProgress = Math.min(Math.round((offset / totalCount) * 50), 50)
        await onProgress(queryProgress)
      }
    }

    // 創建 Excel 工作簿
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AI Document Extraction System'
    workbook.created = new Date()

    // 費用明細工作表
    const worksheet = workbook.addWorksheet('費用明細', {
      views: [{ state: 'frozen', ySplit: 1 }]
    })

    // 設置標題列
    worksheet.columns = this.buildColumns(config.fields)

    // 添加數據行
    for (let i = 0; i < allDocuments.length; i++) {
      const doc = allDocuments[i]
      const rowData = this.buildRowData(doc, config.fields)
      worksheet.addRow(rowData)

      // 報告進度（Excel 生成階段佔 50%）
      if (onProgress && i % 100 === 0 && allDocuments.length > 0) {
        const excelProgress = 50 + Math.round((i / allDocuments.length) * 50)
        await onProgress(excelProgress)
      }
    }

    // 應用樣式
    this.applyStyles(worksheet)

    // 添加匯總工作表
    this.addSummarySheet(workbook, allDocuments, config)

    // 生成 Buffer
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  /**
   * 建構欄位配置
   */
  private buildColumns(fields: ExportField[]): Partial<ExcelJS.Column>[] {
    const columnConfig: Record<ExportField, Partial<ExcelJS.Column>> = {
      invoiceNumber: { header: '發票編號', key: 'invoiceNumber', width: 20 },
      uploadTime: { header: '上傳時間', key: 'uploadTime', width: 20 },
      processedTime: { header: '處理時間', key: 'processedTime', width: 20 },
      forwarderCode: { header: 'Forwarder 代碼', key: 'forwarderCode', width: 15 },
      forwarderName: { header: 'Forwarder 名稱', key: 'forwarderName', width: 25 },
      aiCost: { header: 'AI 成本 (USD)', key: 'aiCost', width: 15 },
      reviewDuration: { header: '審核時長 (分鐘)', key: 'reviewDuration', width: 15 },
      status: { header: '狀態', key: 'status', width: 12 },
      cityCode: { header: '城市代碼', key: 'cityCode', width: 10 },
      processingType: { header: '處理類型', key: 'processingType', width: 12 },
      confidenceScore: { header: '信心分數', key: 'confidenceScore', width: 12 }
    }

    return fields.map(field => columnConfig[field])
  }

  /**
   * 建構行數據
   */
  private buildRowData(doc: DocumentWithRelations, fields: ExportField[]): Record<string, unknown> {
    // 從 extractionResult.fieldMappings 取得發票編號
    const fieldMappings = doc.extractionResult?.fieldMappings as Record<string, { value?: string | null }> | null
    const invoiceNumber = fieldMappings?.invoiceNumber?.value || doc.id.slice(0, 8)

    // 處理完成時間：優先使用 processingQueue.completedAt
    const processedTime = doc.processingQueue?.completedAt

    // 審核完成時間：從 reviewRecords 取得
    const reviewedAt = doc.reviewRecords?.[0]?.completedAt

    // 計算審核時長（分鐘）
    const reviewDuration = reviewedAt && processedTime
      ? Math.round(
          (new Date(reviewedAt).getTime() - new Date(processedTime).getTime()) / 60000
        )
      : null

    // 信心分數：從 extractionResult.averageConfidence 取得（已是 0-100 scale）
    const confidenceScore = doc.extractionResult?.averageConfidence

    // 判斷處理類型：AUTO_APPROVE = 自動，其他 = 人工
    const isAutoApproved = doc.processingPath === 'AUTO_APPROVE'

    const fieldMap: Record<ExportField, unknown> = {
      invoiceNumber: invoiceNumber,
      uploadTime: doc.createdAt ? this.formatDateTime(doc.createdAt) : '',
      processedTime: processedTime ? this.formatDateTime(processedTime) : '',
      forwarderCode: doc.forwarder?.code || '',
      forwarderName: doc.forwarder?.name || '',
      aiCost: 0, // AI 成本追蹤功能待實現
      reviewDuration: reviewDuration,
      status: STATUS_TRANSLATIONS[doc.status] || doc.status,
      cityCode: doc.cityCode || '',
      processingType: isAutoApproved ? '自動' : '人工',
      confidenceScore: confidenceScore
        ? `${confidenceScore.toFixed(1)}%`
        : ''
    }

    const rowData: Record<string, unknown> = {}
    fields.forEach(field => {
      rowData[field] = fieldMap[field]
    })
    return rowData
  }

  /**
   * 格式化日期時間
   */
  private formatDateTime(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  /**
   * 應用 Excel 樣式
   */
  private applyStyles(worksheet: ExcelJS.Worksheet): void {
    // 標題行樣式
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 25

    // 添加篩選
    if (worksheet.columns.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columns.length }
      }
    }

    // 數據行樣式
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'middle' }
        // 交替行背景色
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
          }
        }
      }
    })

    // 設置邊框
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        }
      })
    })
  }

  /**
   * 添加匯總工作表
   */
  private addSummarySheet(
    workbook: ExcelJS.Workbook,
    documents: DocumentWithRelations[],
    config: ExportConfig
  ): void {
    const summarySheet = workbook.addWorksheet('匯總')

    // 計算統計數據
    const successCount = documents.filter(
      d => d.status === 'COMPLETED' || d.status === 'APPROVED'
    ).length

    // 自動處理數：processingPath === 'AUTO_APPROVE'
    const autoApprovedCount = documents.filter(
      d => d.processingPath === 'AUTO_APPROVE'
    ).length

    // 計算平均信心分數
    const confidenceScores = documents
      .map(d => d.extractionResult?.averageConfidence)
      .filter((c): c is number => c !== null && c !== undefined)
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length
      : 0

    // 添加匯總數據
    const summaryData = [
      ['報表類型', '費用明細報表'],
      ['報表期間', `${config.dateRange.startDate} ~ ${config.dateRange.endDate}`],
      ['生成時間', this.formatDateTime(new Date())],
      [''],
      ['統計項目', '數值'],
      ['總記錄數', documents.length],
      ['成功處理數', successCount],
      ['自動處理數', autoApprovedCount],
      ['成功率', documents.length > 0 ? `${((successCount / documents.length) * 100).toFixed(1)}%` : 'N/A'],
      ['自動化率', successCount > 0 ? `${((autoApprovedCount / successCount) * 100).toFixed(1)}%` : 'N/A'],
      ['平均信心分數', avgConfidence > 0 ? `${avgConfidence.toFixed(1)}%` : 'N/A']
    ]

    summaryData.forEach((row, index) => {
      const excelRow = summarySheet.addRow(row)
      if (index < 3 || index === 4) {
        excelRow.font = { bold: true }
      }
    })

    // 設置欄寬
    summarySheet.getColumn(1).width = 20
    summarySheet.getColumn(2).width = 30
  }

  /**
   * 創建背景任務
   *
   * @param userId - 用戶 ID
   * @param config - 匯出配置
   * @returns 任務 ID
   */
  async createBackgroundJob(
    userId: string,
    config: ExportConfig
  ): Promise<string> {
    const job = await prisma.reportJob.create({
      data: {
        userId,
        type: 'expense-detail',
        config: config as object,
        status: 'PENDING'
      }
    })
    return job.id
  }

  /**
   * 處理背景任務
   *
   * @param jobId - 任務 ID
   * @param cityContext - 城市過濾上下文
   */
  async processBackgroundJob(
    jobId: string,
    cityContext: CityFilterContext
  ): Promise<void> {
    const job = await prisma.reportJob.findUnique({ where: { id: jobId } })
    if (!job) throw new Error('Job not found')

    try {
      // 更新狀態為處理中
      await prisma.reportJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' }
      })

      const config = job.config as unknown as ExportConfig

      // 獲取總數
      const totalRecords = await this.getEstimatedCount(cityContext, config)
      await prisma.reportJob.update({
        where: { id: jobId },
        data: { totalRecords }
      })

      // 生成報表
      const buffer = await this.exportToExcel(
        cityContext,
        config,
        async (progress) => {
          await prisma.reportJob.update({
            where: { id: jobId },
            data: { progress }
          })
        }
      )

      // 上傳到 Blob Storage
      const fileName = `reports/expense-report-${jobId}.xlsx`
      const filePath = await uploadBufferToBlob(
        buffer,
        fileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )

      // 生成下載連結
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + DOWNLOAD_LINK_EXPIRY_HOURS)
      const downloadUrl = await generateSignedUrl(filePath, expiresAt)

      // 更新任務狀態
      await prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          filePath,
          downloadUrl,
          expiresAt,
          completedAt: new Date()
        }
      })

      // 發送通知
      await this.sendCompletionNotification(job.userId, jobId, downloadUrl)
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error)

      await prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      // 發送失敗通知
      await this.sendFailureNotification(job.userId, jobId)

      throw error
    }
  }

  /**
   * 發送完成通知
   */
  private async sendCompletionNotification(
    userId: string,
    jobId: string,
    downloadUrl: string
  ): Promise<void> {
    await sendNotification({
      userId,
      type: 'REPORT_READY',
      title: '報表生成完成',
      message: '您的費用明細報表已生成完成，點擊下載。',
      data: {
        jobId,
        downloadUrl,
        expiresIn: `${DOWNLOAD_LINK_EXPIRY_HOURS} 小時`
      }
    })
  }

  /**
   * 發送失敗通知
   */
  private async sendFailureNotification(
    userId: string,
    jobId: string
  ): Promise<void> {
    await sendNotification({
      userId,
      type: 'REPORT_FAILED',
      title: '報表生成失敗',
      message: '抱歉，您的報表生成失敗，請稍後重試。',
      data: { jobId }
    })
  }

  /**
   * 獲取任務狀態
   *
   * @param jobId - 任務 ID
   * @param userId - 用戶 ID（用於驗證所有權）
   * @returns 任務狀態或 null
   */
  async getJobStatus(jobId: string, userId: string) {
    const job = await prisma.reportJob.findFirst({
      where: { id: jobId, userId }
    })

    if (!job) return null

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      totalRecords: job.totalRecords,
      downloadUrl: job.downloadUrl,
      expiresAt: job.expiresAt?.toISOString() ?? null,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null
    }
  }

  /**
   * 清理過期任務和檔案
   *
   * @returns 清理的任務數量
   */
  async cleanupExpiredJobs(): Promise<number> {
    const expiredJobs = await prisma.reportJob.findMany({
      where: {
        status: 'COMPLETED',
        expiresAt: { lt: new Date() }
      }
    })

    let cleanedCount = 0
    for (const job of expiredJobs) {
      if (job.filePath) {
        try {
          await deleteBlob(job.filePath)
        } catch (error) {
          console.error(`Failed to delete blob: ${job.filePath}`, error)
        }
      }

      await prisma.reportJob.delete({ where: { id: job.id } })
      cleanedCount++
    }

    return cleanedCount
  }
}

// ============================================================
// Export Singleton Instance
// ============================================================

/**
 * 費用報表服務實例
 */
export const expenseReportService = new ExpenseReportService()
