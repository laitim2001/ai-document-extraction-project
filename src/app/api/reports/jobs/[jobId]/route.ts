/**
 * @fileoverview 報表任務狀態 API
 * @description
 *   提供報表任務狀態查詢端點：
 *   - 查詢背景任務處理進度
 *   - 獲取下載連結
 *   - 只能查詢自己的任務
 *
 * @module src/app/api/reports/jobs/[jobId]
 * @since Epic 7 - Story 7.4 (費用明細報表匯出)
 * @lastModified 2025-12-19
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { expenseReportService } from '@/services/expense-report.service'

/**
 * 路由參數
 */
interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * 任務狀態響應
 */
interface JobStatusResponse {
  success: boolean
  data?: {
    id: string
    status: string
    progress: number | null
    totalRecords: number | null
    downloadUrl: string | null
    expiresAt: string | null
    error: string | null
    createdAt: string
    completedAt: string | null
  }
  error?: string
}

/**
 * GET /api/reports/jobs/:jobId
 *
 * @description
 *   獲取報表任務的處理狀態。
 *   包含進度百分比、下載連結（如已完成）、錯誤訊息（如失敗）。
 *   用戶只能查詢自己創建的任務。
 *
 * @param request - GET 請求
 * @param params - 包含 jobId 的路由參數
 * @returns 任務狀態資訊
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json<JobStatusResponse>(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { jobId } = await params

  const status = await expenseReportService.getJobStatus(
    jobId,
    session.user.id
  )

  if (!status) {
    return NextResponse.json<JobStatusResponse>(
      { success: false, error: 'Job not found' },
      { status: 404 }
    )
  }

  return NextResponse.json<JobStatusResponse>({
    success: true,
    data: status
  })
}
