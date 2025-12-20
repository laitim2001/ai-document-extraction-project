/**
 * @fileoverview 月度成本報告下載 API
 * @description
 *   提供月度報告下載連結
 *
 * @module src/app/api/reports/monthly-cost/[id]/download
 * @since Epic 7 - Story 7.10
 * @lastModified 2025-12-20
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { monthlyCostReportService } from '@/services/monthly-cost-report.service'
import type { ReportFormat } from '@/types/monthly-report'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!hasPermission(session?.user, PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') as ReportFormat

    if (!format || !['excel', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format parameter' },
        { status: 400 }
      )
    }

    const result = await monthlyCostReportService.getDownloadUrl(id, format)

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Report not found or not ready' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: result.url,
        fileName: result.fileName,
        expiresAt: result.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Get download URL error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get download URL' },
      { status: 500 }
    )
  }
}
