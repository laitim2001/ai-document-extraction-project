# Tech Spec: Story 7.4 - Expense Detail Report Export

## Story Reference
- **Story ID**: 7.4
- **Story Title**: 費用明細報表匯出
- **Epic**: Epic 7 - 報表儀表板與成本追蹤
- **Status**: Tech Spec Complete

---

## 1. Technical Overview

### 1.1 Purpose
實現費用明細報表匯出功能，允許城市經理配置匯出參數（時間範圍、欄位選擇）並下載 Excel 格式的費用報表，對於大量數據採用背景處理機制以避免超時。

### 1.2 Scope
- 匯出配置對話框組件
- Excel 報表生成服務
- 背景任務處理系統
- 下載連結管理
- 權限控制實現
- 通知系統整合

### 1.3 Dependencies
- **Story 7.1**: 處理統計儀表板
- **Story 7.2**: 時間範圍篩選
- **Story 6.2**: 城市用戶數據訪問控制
- ExcelJS (Excel 生成)
- Azure Blob Storage (檔案存儲)

---

## 2. Database Schema

### 2.1 ReportJob Model

```prisma
// prisma/schema.prisma

model ReportJob {
  id           String          @id @default(uuid())
  userId       String          @map("user_id")
  type         String          // 'expense-detail', 'city-cost', 'monthly-allocation'
  config       Json            // ExportConfig JSON
  status       ReportJobStatus @default(PENDING)
  progress     Int?            @default(0)
  totalRecords Int?            @map("total_records")
  filePath     String?         @map("file_path")
  downloadUrl  String?         @map("download_url")
  expiresAt    DateTime?       @map("expires_at")
  error        String?
  createdAt    DateTime        @default(now()) @map("created_at")
  completedAt  DateTime?       @map("completed_at")

  // Relations
  user         User            @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("report_jobs")
}

enum ReportJobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

### 2.2 Migration

```sql
-- prisma/migrations/XXXXXX_add_report_jobs/migration.sql

CREATE TABLE report_jobs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  progress INTEGER DEFAULT 0,
  total_records INTEGER,
  file_path VARCHAR(500),
  download_url VARCHAR(1000),
  expires_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_report_jobs_user_id ON report_jobs(user_id);
CREATE INDEX idx_report_jobs_status ON report_jobs(status);
CREATE INDEX idx_report_jobs_created_at ON report_jobs(created_at);

-- 自動清理過期報表任務（30 天前）
CREATE OR REPLACE FUNCTION cleanup_old_report_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM report_jobs
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status IN ('COMPLETED', 'FAILED');
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Type Definitions

### 3.1 Export Types

```typescript
// src/types/report-export.ts

/**
 * 可匯出的欄位
 */
export type ExportField =
  | 'invoiceNumber'
  | 'uploadTime'
  | 'processedTime'
  | 'forwarderCode'
  | 'forwarderName'
  | 'aiCost'
  | 'reviewDuration'
  | 'status'
  | 'cityCode'
  | 'processingType'
  | 'confidenceScore'

/**
 * 匯出欄位標籤
 */
export const EXPORT_FIELD_LABELS: Record<ExportField, string> = {
  invoiceNumber: '發票編號',
  uploadTime: '上傳時間',
  processedTime: '處理時間',
  forwarderCode: 'Forwarder 代碼',
  forwarderName: 'Forwarder 名稱',
  aiCost: 'AI 成本',
  reviewDuration: '審核時長',
  status: '狀態',
  cityCode: '城市代碼',
  processingType: '處理類型',
  confidenceScore: '信心分數'
}

/**
 * 預設匯出欄位
 */
export const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  'invoiceNumber',
  'uploadTime',
  'processedTime',
  'forwarderCode',
  'forwarderName',
  'aiCost',
  'reviewDuration'
]

/**
 * 匯出格式
 */
export type ExportFormat = 'xlsx' | 'csv'

/**
 * 匯出配置
 */
export interface ExportConfig {
  /** 日期範圍 */
  dateRange: {
    startDate: string
    endDate: string
  }
  /** 匯出格式 */
  format: ExportFormat
  /** 選擇的欄位 */
  fields: ExportField[]
  /** 篩選的 Forwarder IDs */
  forwarderIds?: string[]
  /** 篩選的城市代碼 */
  cityCodes?: string[]
}

/**
 * 報表任務狀態
 */
export type ReportJobStatusType = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

/**
 * 報表任務詳情
 */
export interface ExportJobStatus {
  /** 任務 ID */
  id: string
  /** 任務狀態 */
  status: ReportJobStatusType
  /** 處理進度 (0-100) */
  progress?: number
  /** 總記錄數 */
  totalRecords?: number
  /** 下載 URL */
  downloadUrl?: string
  /** 下載連結過期時間 */
  expiresAt?: string
  /** 錯誤訊息 */
  error?: string
  /** 建立時間 */
  createdAt: string
  /** 完成時間 */
  completedAt?: string
}

/**
 * 匯出 API 響應
 */
export interface ExportResponse {
  success: boolean
  data?: {
    mode: 'direct' | 'background'
    jobId?: string
    estimatedCount?: number
    message?: string
  }
  error?: string
}

/**
 * 大量匯出閾值
 */
export const LARGE_EXPORT_THRESHOLD = 10000

/**
 * 下載連結有效期（小時）
 */
export const DOWNLOAD_LINK_EXPIRY_HOURS = 24
```

---

## 4. Service Implementation

### 4.1 Expense Report Service

```typescript
// src/services/expense-report.service.ts
import { prisma } from '@/lib/prisma'
import { CityFilter, buildCityWhereClause } from '@/middleware/city-filter'
import {
  ExportConfig,
  ExportField,
  LARGE_EXPORT_THRESHOLD,
  DOWNLOAD_LINK_EXPIRY_HOURS
} from '@/types/report-export'
import ExcelJS from 'exceljs'
import { uploadToBlob, generateSignedUrl, deleteBlob } from '@/lib/azure-blob'
import { sendNotification } from '@/lib/notification'

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
 * 費用報表服務
 */
export class ExpenseReportService {
  /**
   * 估算符合條件的記錄數
   */
  async getEstimatedCount(
    cityFilter: CityFilter,
    config: ExportConfig
  ): Promise<number> {
    const cityWhere = buildCityWhereClause(cityFilter)

    return prisma.document.count({
      where: {
        ...cityWhere,
        processedAt: {
          gte: new Date(config.dateRange.startDate),
          lte: new Date(config.dateRange.endDate)
        },
        ...(config.forwarderIds?.length && {
          forwarderId: { in: config.forwarderIds }
        })
      }
    })
  }

  /**
   * 生成 Excel 報表
   */
  async exportToExcel(
    cityFilter: CityFilter,
    config: ExportConfig,
    onProgress?: (progress: number) => Promise<void>
  ): Promise<Buffer> {
    const cityWhere = buildCityWhereClause(cityFilter)

    // 分批查詢數據以處理大量記錄
    const batchSize = 1000
    let offset = 0
    let allDocuments: any[] = []

    // 首先獲取總數
    const totalCount = await this.getEstimatedCount(cityFilter, config)

    while (true) {
      const batch = await prisma.document.findMany({
        where: {
          ...cityWhere,
          processedAt: {
            gte: new Date(config.dateRange.startDate),
            lte: new Date(config.dateRange.endDate)
          },
          ...(config.forwarderIds?.length && {
            forwarderId: { in: config.forwarderIds }
          })
        },
        include: {
          forwarder: {
            select: { code: true, name: true }
          },
          apiUsageLogs: {
            select: { estimatedCost: true }
          }
        },
        orderBy: { processedAt: 'desc' },
        skip: offset,
        take: batchSize
      })

      if (batch.length === 0) break

      allDocuments = allDocuments.concat(batch)
      offset += batch.length

      // 報告進度（查詢階段佔 50%）
      if (onProgress) {
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
      if (onProgress && i % 100 === 0) {
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
  private buildRowData(doc: any, fields: ExportField[]): Record<string, any> {
    const totalAiCost = doc.apiUsageLogs?.reduce(
      (sum: number, log: any) => sum + (log.estimatedCost || 0),
      0
    ) || 0

    const reviewDuration = doc.reviewedAt && doc.processedAt
      ? Math.round(
          (new Date(doc.reviewedAt).getTime() - new Date(doc.processedAt).getTime()) / 60000
        )
      : null

    const fieldMap: Record<ExportField, any> = {
      invoiceNumber: doc.invoiceNumber || doc.id.slice(0, 8),
      uploadTime: doc.createdAt ? this.formatDateTime(doc.createdAt) : '',
      processedTime: doc.processedAt ? this.formatDateTime(doc.processedAt) : '',
      forwarderCode: doc.forwarder?.code || '',
      forwarderName: doc.forwarder?.name || '',
      aiCost: Number(totalAiCost.toFixed(4)),
      reviewDuration: reviewDuration,
      status: STATUS_TRANSLATIONS[doc.status] || doc.status,
      cityCode: doc.cityCode || '',
      processingType: doc.autoApproved ? '自動' : '人工',
      confidenceScore: doc.confidenceScore
        ? `${(doc.confidenceScore * 100).toFixed(1)}%`
        : ''
    }

    const rowData: Record<string, any> = {}
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
    documents: any[],
    config: ExportConfig
  ): void {
    const summarySheet = workbook.addWorksheet('匯總')

    // 計算統計數據
    const totalCost = documents.reduce((sum, doc) => {
      const docCost = doc.apiUsageLogs?.reduce(
        (s: number, l: any) => s + (l.estimatedCost || 0),
        0
      ) || 0
      return sum + docCost
    }, 0)

    const successCount = documents.filter(
      d => d.status === 'COMPLETED' || d.status === 'APPROVED'
    ).length
    const autoApprovedCount = documents.filter(d => d.autoApproved).length

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
      ['成功率', `${((successCount / documents.length) * 100).toFixed(1)}%`],
      ['自動化率', `${((autoApprovedCount / Math.max(successCount, 1)) * 100).toFixed(1)}%`],
      ['總 AI 成本', `$${totalCost.toFixed(2)}`],
      ['平均成本/筆', `$${(totalCost / Math.max(documents.length, 1)).toFixed(4)}`]
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
   */
  async createBackgroundJob(
    userId: string,
    config: ExportConfig
  ): Promise<string> {
    const job = await prisma.reportJob.create({
      data: {
        userId,
        type: 'expense-detail',
        config: config as any,
        status: 'PENDING'
      }
    })
    return job.id
  }

  /**
   * 處理背景任務
   */
  async processBackgroundJob(
    jobId: string,
    cityFilter: CityFilter
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
      const totalRecords = await this.getEstimatedCount(cityFilter, config)
      await prisma.reportJob.update({
        where: { id: jobId },
        data: { totalRecords }
      })

      // 生成報表
      const buffer = await this.exportToExcel(
        cityFilter,
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
      const filePath = await uploadToBlob(buffer, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

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
   */
  async getJobStatus(jobId: string, userId: string): Promise<any> {
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
      expiresAt: job.expiresAt?.toISOString(),
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString()
    }
  }

  /**
   * 清理過期任務和檔案
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

export const expenseReportService = new ExpenseReportService()
```

---

## 5. API Routes

### 5.1 Export Endpoint

```typescript
// src/app/api/reports/expense-detail/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withCityFilter, CityFilter } from '@/middleware/city-filter'
import { expenseReportService } from '@/services/expense-report.service'
import { ExportConfig, ExportResponse, LARGE_EXPORT_THRESHOLD } from '@/types/report-export'

/**
 * POST /api/reports/expense-detail/export
 * 匯出費用明細報表
 */
export async function POST(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const session = await auth()

      // 權限檢查
      if (!session?.user?.permissions?.includes('EXPORT_REPORTS')) {
        return NextResponse.json<ExportResponse>(
          { success: false, error: 'Permission denied: EXPORT_REPORTS required' },
          { status: 403 }
        )
      }

      const config: ExportConfig = await req.json()

      // 驗證配置
      if (!config.dateRange?.startDate || !config.dateRange?.endDate) {
        return NextResponse.json<ExportResponse>(
          { success: false, error: 'Date range is required' },
          { status: 400 }
        )
      }

      if (!config.fields?.length) {
        return NextResponse.json<ExportResponse>(
          { success: false, error: 'At least one field must be selected' },
          { status: 400 }
        )
      }

      // 估算數據量
      const estimatedCount = await expenseReportService.getEstimatedCount(
        cityFilter,
        config
      )

      // 大量數據使用背景處理
      if (estimatedCount > LARGE_EXPORT_THRESHOLD) {
        const jobId = await expenseReportService.createBackgroundJob(
          session.user.id,
          config
        )

        // 異步處理（不等待完成）
        expenseReportService.processBackgroundJob(jobId, cityFilter)
          .catch(error => console.error('Background job failed:', error))

        return NextResponse.json<ExportResponse>({
          success: true,
          data: {
            mode: 'background',
            jobId,
            estimatedCount,
            message: '報表正在背景生成，完成後將發送通知'
          }
        })
      }

      // 小量數據直接生成
      const buffer = await expenseReportService.exportToExcel(cityFilter, config)
      const dateStr = new Date().toISOString().split('T')[0]
      const fileName = `expense-report-${dateStr}.xlsx`

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': buffer.length.toString()
        }
      })
    } catch (error) {
      console.error('Export error:', error)
      return NextResponse.json<ExportResponse>(
        { success: false, error: 'Failed to export report' },
        { status: 500 }
      )
    }
  })
}
```

### 5.2 Estimate Endpoint

```typescript
// src/app/api/reports/expense-detail/estimate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withCityFilter } from '@/middleware/city-filter'
import { expenseReportService } from '@/services/expense-report.service'

/**
 * POST /api/reports/expense-detail/estimate
 * 估算匯出記錄數
 */
export async function POST(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const body = await req.json()

      const count = await expenseReportService.getEstimatedCount(cityFilter, {
        dateRange: {
          startDate: body.startDate,
          endDate: body.endDate
        },
        format: 'xlsx',
        fields: [],
        forwarderIds: body.forwarderIds
      })

      return NextResponse.json({
        success: true,
        data: { count }
      })
    } catch (error) {
      console.error('Estimate error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to estimate' },
        { status: 500 }
      )
    }
  })
}
```

### 5.3 Job Status Endpoint

```typescript
// src/app/api/reports/jobs/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { expenseReportService } from '@/services/expense-report.service'

interface RouteParams {
  params: { jobId: string }
}

/**
 * GET /api/reports/jobs/:jobId
 * 獲取報表任務狀態
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const status = await expenseReportService.getJobStatus(
    params.jobId,
    session.user.id
  )

  if (!status) {
    return NextResponse.json(
      { success: false, error: 'Job not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: status
  })
}
```

---

## 6. Frontend Components

### 6.1 ExportDialog Component

```typescript
// src/components/reports/ExportDialog.tsx
'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Download, Loader2, FileSpreadsheet, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import {
  ExportConfig,
  ExportField,
  EXPORT_FIELD_LABELS,
  DEFAULT_EXPORT_FIELDS,
  LARGE_EXPORT_THRESHOLD,
  ExportResponse
} from '@/types/report-export'

interface ExportDialogProps {
  /** 是否禁用 */
  disabled?: boolean
  /** 權限檢查 */
  hasPermission?: boolean
}

/**
 * 匯出對話框組件
 */
export function ExportDialog({
  disabled = false,
  hasPermission = true
}: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedFields, setSelectedFields] = useState<ExportField[]>(DEFAULT_EXPORT_FIELDS)
  const { filterParams } = useDashboardFilter()
  const { toast } = useToast()

  // 獲取估計數量
  const { data: estimatedCount, isLoading: countLoading } = useQuery({
    queryKey: ['export-estimate', filterParams],
    queryFn: async () => {
      const response = await fetch('/api/reports/expense-detail/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterParams)
      })
      const result = await response.json()
      return result.data?.count as number
    },
    enabled: open
  })

  // 匯出 mutation
  const exportMutation = useMutation({
    mutationFn: async (config: ExportConfig): Promise<ExportResponse & { mode?: string }> => {
      const response = await fetch('/api/reports/expense-detail/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }

      // 檢查是否為背景任務
      const contentType = response.headers.get('Content-Type')
      if (contentType?.includes('application/json')) {
        const result = await response.json()
        return { ...result, mode: 'background' }
      }

      // 直接下載
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expense-report-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return { success: true, mode: 'direct' }
    },
    onSuccess: (result) => {
      if (result.mode === 'background') {
        toast({
          title: '報表生成中',
          description: '報表正在背景生成，完成後將發送通知。'
        })
      } else {
        toast({
          title: '匯出成功',
          description: '報表已下載。'
        })
      }
      setOpen(false)
    },
    onError: (error) => {
      toast({
        title: '匯出失敗',
        description: error instanceof Error ? error.message : '請稍後再試',
        variant: 'destructive'
      })
    }
  })

  // 切換欄位選擇
  const toggleField = useCallback((field: ExportField) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }, [])

  // 全選/取消全選
  const toggleAllFields = useCallback(() => {
    const allFields = Object.keys(EXPORT_FIELD_LABELS) as ExportField[]
    if (selectedFields.length === allFields.length) {
      setSelectedFields(DEFAULT_EXPORT_FIELDS)
    } else {
      setSelectedFields(allFields)
    }
  }, [selectedFields])

  // 執行匯出
  const handleExport = useCallback(() => {
    const config: ExportConfig = {
      dateRange: {
        startDate: filterParams.startDate,
        endDate: filterParams.endDate
      },
      format: 'xlsx',
      fields: selectedFields,
      forwarderIds: filterParams.forwarderIds
    }
    exportMutation.mutate(config)
  }, [filterParams, selectedFields, exportMutation])

  const isLargeExport = estimatedCount && estimatedCount > LARGE_EXPORT_THRESHOLD
  const allFields = Object.keys(EXPORT_FIELD_LABELS) as ExportField[]

  // 權限不足
  if (!hasPermission) {
    return (
      <Button variant="outline" disabled>
        <Download className="mr-2 h-4 w-4" />
        匯出報表
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          匯出報表
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>匯出費用明細報表</DialogTitle>
          <DialogDescription>
            選擇要包含的欄位，然後匯出 Excel 報表。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 數據量提示 */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span>
                {countLoading ? (
                  '計算中...'
                ) : (
                  <>預計匯出 <strong>{estimatedCount?.toLocaleString() || 0}</strong> 筆資料</>
                )}
              </span>
            </div>
            {isLargeExport && (
              <Alert className="mt-3" variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  數據量較大，將在背景處理，完成後發送通知。
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* 欄位選擇 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>選擇欄位</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAllFields}
              >
                {selectedFields.length === allFields.length ? '重設為預設' : '全選'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-2">
              {allFields.map((field) => (
                <div
                  key={field}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-muted"
                >
                  <Checkbox
                    id={field}
                    checked={selectedFields.includes(field)}
                    onCheckedChange={() => toggleField(field)}
                  />
                  <label
                    htmlFor={field}
                    className="text-sm font-medium leading-none cursor-pointer select-none"
                  >
                    {EXPORT_FIELD_LABELS[field]}
                  </label>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              已選擇 {selectedFields.length} / {allFields.length} 個欄位
            </p>
          </div>

          {/* 匯出進度 */}
          {exportMutation.isPending && (
            <div className="space-y-2">
              <Progress value={50} />
              <p className="text-sm text-center text-muted-foreground">
                正在生成報表...
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={exportMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportMutation.isPending || selectedFields.length === 0}
          >
            {exportMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isLargeExport ? '開始背景匯出' : '匯出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 7. Testing Strategy

### 7.1 Service Unit Tests

```typescript
// __tests__/services/expense-report.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExpenseReportService } from '@/services/expense-report.service'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma')
vi.mock('@/lib/azure-blob')

describe('ExpenseReportService', () => {
  let service: ExpenseReportService

  beforeEach(() => {
    service = new ExpenseReportService()
    vi.clearAllMocks()
  })

  describe('getEstimatedCount', () => {
    it('should return document count for given filters', async () => {
      vi.mocked(prisma.document.count).mockResolvedValue(500)

      const count = await service.getEstimatedCount(
        { isGlobalAdmin: false, cityCodes: ['HKG'] },
        {
          dateRange: { startDate: '2025-01-01', endDate: '2025-01-31' },
          format: 'xlsx',
          fields: []
        }
      )

      expect(count).toBe(500)
      expect(prisma.document.count).toHaveBeenCalled()
    })
  })

  describe('exportToExcel', () => {
    it('should generate Excel buffer', async () => {
      vi.mocked(prisma.document.count).mockResolvedValue(10)
      vi.mocked(prisma.document.findMany).mockResolvedValue([
        {
          id: 'doc-1',
          invoiceNumber: 'INV001',
          status: 'COMPLETED',
          createdAt: new Date(),
          processedAt: new Date(),
          cityCode: 'HKG',
          forwarder: { code: 'FWD001', name: 'Test Forwarder' },
          apiUsageLogs: [{ estimatedCost: 0.01 }]
        }
      ])

      const buffer = await service.exportToExcel(
        { isGlobalAdmin: false, cityCodes: ['HKG'] },
        {
          dateRange: { startDate: '2025-01-01', endDate: '2025-01-31' },
          format: 'xlsx',
          fields: ['invoiceNumber', 'status', 'aiCost']
        }
      )

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })
  })

  describe('createBackgroundJob', () => {
    it('should create a pending job', async () => {
      vi.mocked(prisma.reportJob.create).mockResolvedValue({
        id: 'job-123',
        status: 'PENDING'
      } as any)

      const jobId = await service.createBackgroundJob('user-1', {
        dateRange: { startDate: '2025-01-01', endDate: '2025-01-31' },
        format: 'xlsx',
        fields: ['invoiceNumber']
      })

      expect(jobId).toBe('job-123')
    })
  })
})
```

### 7.2 API Tests

```typescript
// __tests__/api/reports/export.test.ts
import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/reports/expense-detail/export/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', permissions: ['EXPORT_REPORTS'] }
  })
}))

vi.mock('@/services/expense-report.service')
vi.mock('@/middleware/city-filter', () => ({
  withCityFilter: vi.fn((req, handler) =>
    handler(req, { isGlobalAdmin: false, cityCodes: ['HKG'] })
  )
}))

describe('POST /api/reports/expense-detail/export', () => {
  it('should return 403 without permission', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user-1', permissions: [] }
    } as any)

    const request = new NextRequest('http://localhost/api/reports/expense-detail/export', {
      method: 'POST',
      body: JSON.stringify({
        dateRange: { startDate: '2025-01-01', endDate: '2025-01-31' },
        format: 'xlsx',
        fields: ['invoiceNumber']
      })
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })
})
```

---

## 8. Performance Considerations

1. **分批查詢**: 大量數據時分批查詢，避免記憶體溢出
2. **流式處理**: 考慮使用流式寫入 Excel 以減少記憶體使用
3. **背景處理**: 超過閾值自動轉為背景任務
4. **下載連結過期**: 24 小時後自動過期，定期清理檔案
5. **進度回報**: 背景任務提供進度追蹤

---

## 9. Security Considerations

1. **權限驗證**: 需要 `EXPORT_REPORTS` 權限
2. **數據隔離**: 自動應用城市過濾
3. **簽名 URL**: 下載連結使用簽名 URL，防止未授權訪問
4. **任務歸屬**: 只能查看自己的任務狀態

---

## 10. Acceptance Criteria Verification

| AC | Description | Implementation | Verification |
|----|-------------|----------------|--------------|
| AC1 | 匯出選項對話框 | ExportDialog 組件 | 組件測試 |
| AC2 | 匯出參數配置 | 欄位選擇 + 日期範圍 | 組件測試 |
| AC3 | 報表內容與下載 | ExpenseReportService | 服務測試 |
| AC4 | 背景處理 | processBackgroundJob | 整合測試 |
| AC5 | 權限控制 | EXPORT_REPORTS 權限檢查 | API 測試 |

---

## 11. References

- [ExcelJS Documentation](https://github.com/exceljs/exceljs)
- [Azure Blob Storage - Signed URLs](https://docs.microsoft.com/azure/storage/blobs/storage-blob-user-delegation-sas-create-javascript)
- Story 7.4 Requirements Document
