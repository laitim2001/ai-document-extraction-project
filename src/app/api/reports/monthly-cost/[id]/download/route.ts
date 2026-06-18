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

    const file = await monthlyCostReportService.getReportFile(id, format)

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Report not found or not ready' },
        { status: 404 }
      )
    }

    // FIX-085: server-side 串流檔案 bytes。Storage 為私有端點，瀏覽器無法直連 blob SAS URL，
    // 改由 app 經私有端點下載後串流（Content-Disposition: attachment 觸發下載）。
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.buffer.length),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.fileName)}"`,
        'Cache-Control': 'private, no-store',
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
