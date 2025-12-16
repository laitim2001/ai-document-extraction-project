# Story 7.4: 費用明細報表匯出

**Status:** ready-for-dev

---

## Story

**As a** 城市經理,
**I want** 匯出費用明細報表,
**So that** 我可以進行財務分析和報告。

---

## Acceptance Criteria

### AC1: 匯出選項對話框

**Given** 城市經理在報表頁面
**When** 點擊「匯出報表」按鈕
**Then** 顯示匯出選項對話框

### AC2: 匯出參數配置

**Given** 匯出選項對話框
**When** 配置匯出參數
**Then** 可以選擇：
- 時間範圍
- 匯出格式（Excel）
- 包含欄位（可勾選）

### AC3: 報表內容與下載

**Given** 確認匯出
**When** 系統生成報表
**Then** 報表包含：發票編號、上傳時間、處理時間、Forwarder、AI 成本、審核時長
**And** 下載完成後顯示成功訊息

### AC4: 大量數據背景處理

**Given** 匯出大量數據
**When** 數據超過 10,000 筆
**Then** 系統採用背景處理
**And** 完成後發送通知和下載連結

### AC5: 權限控制

**Given** 非城市經理用戶
**When** 嘗試匯出費用報表
**Then** 顯示權限不足訊息
**And** 不允許匯出操作

---

## Tasks / Subtasks

- [ ] **Task 1: 報表匯出 API** (AC: #3, #4)
  - [ ] 1.1 創建 `POST /api/reports/expense-detail/export` 端點
  - [ ] 1.2 實現報表數據查詢
  - [ ] 1.3 實現 Excel 生成邏輯
  - [ ] 1.4 處理大量數據背景任務
  - [ ] 1.5 創建下載連結生成

- [ ] **Task 2: 背景任務系統** (AC: #4)
  - [ ] 2.1 創建 `ReportJob` 任務模型
  - [ ] 2.2 實現任務狀態追蹤
  - [ ] 2.3 創建背景處理 worker
  - [ ] 2.4 實現任務完成通知

- [ ] **Task 3: 匯出對話框組件** (AC: #1, #2)
  - [ ] 3.1 創建 `ExportDialog` 組件
  - [ ] 3.2 實現時間範圍選擇
  - [ ] 3.3 實現欄位選擇 checkbox
  - [ ] 3.4 添加格式選擇（目前僅 Excel）
  - [ ] 3.5 顯示估計數據量

- [ ] **Task 4: 權限檢查** (AC: #5)
  - [ ] 4.1 定義匯出權限（EXPORT_REPORTS）
  - [ ] 4.2 在 API 層驗證權限
  - [ ] 4.3 在 UI 層條件顯示匯出按鈕

- [ ] **Task 5: 下載與通知** (AC: #3, #4)
  - [ ] 5.1 實現即時下載流程
  - [ ] 5.2 創建下載連結頁面
  - [ ] 5.3 實現完成通知 toast
  - [ ] 5.4 添加郵件通知（背景任務完成）

- [ ] **Task 6: 測試** (AC: #1-5)
  - [ ] 6.1 測試小量數據匯出
  - [ ] 6.2 測試大量數據背景處理
  - [ ] 6.3 測試權限控制
  - [ ] 6.4 測試 Excel 文件內容

---

## Dev Notes

### 依賴項

- **Story 7.1**: 處理統計儀表板
- **Story 7.2**: 時間範圍篩選
- **Story 6.2**: 城市用戶數據訪問控制

### Architecture Compliance

```typescript
// src/types/report-export.ts
export interface ExportConfig {
  dateRange: {
    startDate: string
    endDate: string
  }
  format: 'xlsx' | 'csv'
  fields: ExportField[]
  forwarderIds?: string[]
}

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

export const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  'invoiceNumber',
  'uploadTime',
  'processedTime',
  'forwarderCode',
  'forwarderName',
  'aiCost',
  'reviewDuration'
]

export interface ExportJobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  totalRecords?: number
  downloadUrl?: string
  expiresAt?: string
  error?: string
  createdAt: string
  completedAt?: string
}

export const LARGE_EXPORT_THRESHOLD = 10000 // 超過此數量使用背景處理
```

```prisma
// prisma/schema.prisma - 報表任務模型
model ReportJob {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  type        String   // 'expense-detail', 'city-cost', etc.
  config      Json     // ExportConfig
  status      ReportJobStatus @default(PENDING)
  progress    Int?     @default(0)
  totalRecords Int?    @map("total_records")
  filePath    String?  @map("file_path")
  downloadUrl String?  @map("download_url")
  expiresAt   DateTime? @map("expires_at")
  error       String?
  createdAt   DateTime @default(now()) @map("created_at")
  completedAt DateTime? @map("completed_at")

  user        User     @relation(fields: [userId], references: [id])

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

```typescript
// src/services/expense-report.service.ts
import { prisma } from '@/lib/prisma'
import { CityFilter, buildCityWhereClause } from '@/middleware/city-filter'
import { ExportConfig, ExportField, LARGE_EXPORT_THRESHOLD } from '@/types/report-export'
import ExcelJS from 'exceljs'
import { uploadToBlob, generateSignedUrl } from '@/lib/azure-blob'

export class ExpenseReportService {
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

  async exportToExcel(
    cityFilter: CityFilter,
    config: ExportConfig,
    onProgress?: (progress: number) => void
  ): Promise<Buffer> {
    const cityWhere = buildCityWhereClause(cityFilter)

    // 查詢數據
    const documents = await prisma.document.findMany({
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
      orderBy: { processedAt: 'desc' }
    })

    // 創建 Excel 工作簿
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AI Document Extraction System'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet('費用明細')

    // 設置標題列
    const columns = this.buildColumns(config.fields)
    worksheet.columns = columns

    // 添加數據行
    const totalRecords = documents.length
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      const rowData = this.buildRowData(doc, config.fields)
      worksheet.addRow(rowData)

      // 回報進度
      if (onProgress && i % 100 === 0) {
        onProgress(Math.round((i / totalRecords) * 100))
      }
    }

    // 設置樣式
    this.applyStyles(worksheet)

    // 生成 Buffer
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

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

  private buildRowData(doc: any, fields: ExportField[]): Record<string, any> {
    const totalAiCost = doc.apiUsageLogs?.reduce(
      (sum: number, log: any) => sum + (log.estimatedCost || 0),
      0
    ) || 0

    const reviewDuration = doc.reviewedAt && doc.processedAt
      ? Math.round((new Date(doc.reviewedAt).getTime() - new Date(doc.processedAt).getTime()) / 60000)
      : null

    const fieldMap: Record<ExportField, any> = {
      invoiceNumber: doc.invoiceNumber || doc.id,
      uploadTime: doc.createdAt?.toISOString() || '',
      processedTime: doc.processedAt?.toISOString() || '',
      forwarderCode: doc.forwarder?.code || '',
      forwarderName: doc.forwarder?.name || '',
      aiCost: totalAiCost.toFixed(4),
      reviewDuration: reviewDuration,
      status: this.translateStatus(doc.status),
      cityCode: doc.cityCode || '',
      processingType: doc.autoApproved ? '自動' : '人工',
      confidenceScore: doc.confidenceScore ? `${(doc.confidenceScore * 100).toFixed(1)}%` : ''
    }

    const rowData: Record<string, any> = {}
    fields.forEach(field => {
      rowData[field] = fieldMap[field]
    })
    return rowData
  }

  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: '待處理',
      PROCESSING: '處理中',
      PENDING_REVIEW: '待審核',
      APPROVED: '已核准',
      COMPLETED: '已完成',
      FAILED: '失敗',
      ESCALATED: '已升級'
    }
    return statusMap[status] || status
  }

  private applyStyles(worksheet: ExcelJS.Worksheet) {
    // 標題行樣式
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    // 添加篩選
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columns.length }
    }

    // 凍結首行
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  }

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

  async processBackgroundJob(jobId: string, cityFilter: CityFilter) {
    const job = await prisma.reportJob.findUnique({ where: { id: jobId } })
    if (!job) throw new Error('Job not found')

    try {
      // 更新狀態為處理中
      await prisma.reportJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' }
      })

      const config = job.config as ExportConfig

      // 獲取總數
      const totalRecords = await this.getEstimatedCount(cityFilter, config)
      await prisma.reportJob.update({
        where: { id: jobId },
        data: { totalRecords }
      })

      // 生成報表
      const buffer = await this.exportToExcel(cityFilter, config, async (progress) => {
        await prisma.reportJob.update({
          where: { id: jobId },
          data: { progress }
        })
      })

      // 上傳到 Blob Storage
      const fileName = `expense-report-${jobId}.xlsx`
      const filePath = await uploadToBlob(buffer, fileName, 'reports')

      // 生成下載連結（24 小時有效）
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
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
      await this.sendCompletionNotification(job.userId, downloadUrl)
    } catch (error) {
      await prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      throw error
    }
  }

  private async sendCompletionNotification(userId: string, downloadUrl: string) {
    // 發送應用內通知和/或郵件
    // 實現細節取決於通知系統
  }
}

export const expenseReportService = new ExpenseReportService()
```

```typescript
// src/app/api/reports/expense-detail/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withCityFilter } from '@/middleware/city-filter'
import { expenseReportService } from '@/services/expense-report.service'
import { ExportConfig, LARGE_EXPORT_THRESHOLD } from '@/types/report-export'

export async function POST(request: NextRequest) {
  return withCityFilter(request, async (req, cityFilter) => {
    try {
      const session = await auth()

      // 權限檢查：需要 EXPORT_REPORTS 權限
      if (!session?.user?.permissions?.includes('EXPORT_REPORTS')) {
        return NextResponse.json(
          { success: false, error: 'Permission denied' },
          { status: 403 }
        )
      }

      const config: ExportConfig = await req.json()

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

        // 觸發背景任務（可以使用 Queue 或直接異步處理）
        // 這裡簡化為直接異步處理
        expenseReportService.processBackgroundJob(jobId, cityFilter)
          .catch(console.error)

        return NextResponse.json({
          success: true,
          data: {
            mode: 'background',
            jobId,
            estimatedCount,
            message: '報表正在背景生成，完成後將發送通知'
          }
        })
      }

      // 小量數據直接生成並返回
      const buffer = await expenseReportService.exportToExcel(cityFilter, config)

      const fileName = `expense-report-${new Date().toISOString().split('T')[0]}.xlsx`

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
      return NextResponse.json(
        { success: false, error: 'Failed to export report' },
        { status: 500 }
      )
    }
  })
}
```

```typescript
// src/components/reports/ExportDialog.tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Download, Loader2, FileSpreadsheet } from 'lucide-react'
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
import { useToast } from '@/components/ui/use-toast'
import { useDashboardFilter } from '@/contexts/DashboardFilterContext'
import {
  ExportConfig,
  ExportField,
  EXPORT_FIELD_LABELS,
  DEFAULT_EXPORT_FIELDS,
  LARGE_EXPORT_THRESHOLD
} from '@/types/report-export'

interface ExportDialogProps {
  disabled?: boolean
}

export function ExportDialog({ disabled = false }: ExportDialogProps) {
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
      return result.data.count as number
    },
    enabled: open
  })

  // 匯出 mutation
  const exportMutation = useMutation({
    mutationFn: async (config: ExportConfig) => {
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
        return response.json()
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
          description: '報表正在背景生成，完成後將發送通知。',
        })
      } else {
        toast({
          title: '匯出成功',
          description: '報表已下載。',
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

  const toggleField = (field: ExportField) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }

  const handleExport = () => {
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
  }

  const isLargeExport = estimatedCount && estimatedCount > LARGE_EXPORT_THRESHOLD

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          匯出報表
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
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
              <FileSpreadsheet className="h-4 w-4" />
              <span>
                {countLoading ? (
                  '計算中...'
                ) : (
                  `預計匯出 ${estimatedCount?.toLocaleString() || 0} 筆資料`
                )}
              </span>
            </div>
            {isLargeExport && (
              <p className="mt-2 text-xs text-muted-foreground">
                數據量較大，將在背景處理，完成後發送通知。
              </p>
            )}
          </div>

          {/* 欄位選擇 */}
          <div className="space-y-2">
            <Label>選擇欄位</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(EXPORT_FIELD_LABELS) as ExportField[]).map((field) => (
                <div key={field} className="flex items-center space-x-2">
                  <Checkbox
                    id={field}
                    checked={selectedFields.includes(field)}
                    onCheckedChange={() => toggleField(field)}
                  />
                  <label
                    htmlFor={field}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {EXPORT_FIELD_LABELS[field]}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
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

### 安全考量

- **權限驗證**: 僅允許具有 `EXPORT_REPORTS` 權限的用戶匯出
- **數據隔離**: 匯出數據自動應用城市過濾
- **下載連結**: 使用簽名 URL，24 小時過期
- **檔案清理**: 定期清理過期的報表檔案

### References

- [Source: docs/03-epics/sections/epic-7-reports-dashboard-cost-tracking.md#story-74]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR33]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 7.4 |
| Story Key | 7-4-expense-detail-report-export |
| Epic | Epic 7: 報表儀表板與成本追蹤 |
| FR Coverage | FR33 |
| Dependencies | Story 7.1, Story 7.2, Story 6.2 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
