/**
 * @fileoverview 月度成本報告生成 API
 * @description
 *   提供月度報告生成端點
 *
 * @module src/app/api/reports/monthly-cost/generate
 * @since Epic 7 - Story 7.10
 * @lastModified 2025-12-20
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { monthlyCostReportService } from '@/services/monthly-cost-report.service'
import { z } from 'zod'

const generateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
  formats: z.array(z.enum(['excel', 'pdf'])).min(1),
  sendNotification: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!hasPermission(session.user, PERMISSIONS.REPORT_EXPORT)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { month, formats } = generateSchema.parse(body)

    // 驗證不能是未來月份
    const [year, monthNum] = month.split('-').map(Number)
    const now = new Date()
    if (
      year > now.getFullYear() ||
      (year === now.getFullYear() && monthNum > now.getMonth() + 1)
    ) {
      return NextResponse.json(
        { success: false, error: 'Cannot generate report for future months' },
        { status: 400 }
      )
    }

    const report = await monthlyCostReportService.generateReport(
      month,
      formats,
      session.user.id,
      false
    )

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Monthly report generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
