/**
 * @fileoverview 測試報告下載 API 端點
 * @description
 *   Story 5-4: 測試規則變更效果 - 報告生成與下載
 *   提供測試結果報告的生成和下載功能：
 *   - PDF 格式報告（摘要 + 前 50 筆詳情）
 *   - Excel 格式報告（完整詳情，含顏色編碼）
 *
 *   端點：
 *   - GET /api/test-tasks/[taskId]/report?format=pdf - 下載 PDF 報告
 *   - GET /api/test-tasks/[taskId]/report?format=excel - 下載 Excel 報告
 *
 * @module src/app/api/test-tasks/[taskId]/report/route
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/reports - 報告生成器
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/app/api/test-tasks/[taskId]/route.ts - 任務狀態
 *   - src/lib/reports/pdf-generator.ts - PDF 生成
 *   - src/lib/reports/excel-generator.ts - Excel 生成
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePDFReport, generateExcelReport } from '@/lib/reports'
import type { TestChangeType } from '@prisma/client'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  format: z.enum(['pdf', 'excel']).default('pdf'),
})

// ============================================================
// GET /api/test-tasks/[taskId]/report
// ============================================================

/**
 * GET /api/test-tasks/[taskId]/report
 * 下載測試報告
 *
 * @description
 *   Story 5-4: 測試規則變更效果
 *   生成並下載測試結果報告
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含任務 ID
 *
 * @query
 *   - format: 報告格式（pdf 或 excel）
 *
 * @returns 報告檔案（PDF 或 Excel）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    // 1. 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入',
        },
        { status: 401 }
      )
    }

    // 2. 驗證任務 ID 格式
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(taskId).success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的任務 ID 格式',
        },
        { status: 400 }
      )
    }

    // 3. 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const formatParam = searchParams.get('format') ?? 'pdf'

    const validation = querySchema.safeParse({ format: formatParam })
    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的格式參數',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { format } = validation.data

    // 4. 取得任務資料
    const task = await prisma.ruleTestTask.findUnique({
      where: { id: taskId },
      include: {
        rule: {
          select: {
            id: true,
            fieldName: true,
            fieldLabel: true,
            extractionPattern: true,
          },
        },
        // REFACTOR-001: 原 forwarder
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        details: {
          include: {
            document: {
              select: {
                id: true,
                fileName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的測試任務',
        },
        { status: 404 }
      )
    }

    // 5. 檢查任務狀態
    if (task.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/invalid-state',
          title: 'Invalid State',
          status: 400,
          detail: '測試尚未完成，無法生成報告',
        },
        { status: 400 }
      )
    }

    // 5.1 REFACTOR-001: 驗證 company 存在
    if (!task.company) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/invalid-state',
          title: 'Invalid State',
          status: 400,
          detail: '測試任務沒有關聯的公司',
        },
        { status: 400 }
      )
    }

    // 6. 準備報告資料
    const results = task.results as {
      improved: number
      regressed: number
      unchanged: number
      bothWrong: number
      bothRight: number
      improvementRate: number
      regressionRate: number
    } | null

    if (!results) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/invalid-state',
          title: 'Invalid State',
          status: 400,
          detail: '測試結果資料不完整',
        },
        { status: 400 }
      )
    }

    // 獲取提取類型
    const extractionPattern = task.rule.extractionPattern as { method?: string } | null
    const extractionType = extractionPattern?.method ?? 'unknown'

    const reportData = {
      task: {
        id: task.id,
        rule: {
          fieldName: task.rule.fieldLabel || task.rule.fieldName,
          extractionType,
        },
        // REFACTOR-001: 原 forwarder
        company: {
          name: task.company.name,
          code: task.company.code,
        },
        totalDocuments: task.totalDocuments,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      },
      results: {
        improved: results.improved,
        regressed: results.regressed,
        unchanged: results.unchanged,
        bothWrong: results.bothWrong,
        bothRight: results.bothRight,
        improvementRate: results.improvementRate,
        regressionRate: results.regressionRate,
        netImprovement: results.improved - results.regressed,
      },
      details: task.details.map((detail) => ({
        document: {
          fileName: detail.document.fileName,
        },
        originalResult: detail.originalResult,
        originalConfidence: detail.originalConfidence,
        testResult: detail.testResult,
        testConfidence: detail.testConfidence,
        actualValue: detail.actualValue,
        changeType: detail.changeType as TestChangeType,
      })),
      generatedAt: new Date(),
      generatedBy: session.user.name || session.user.id,
    }

    // 7. 生成報告
    let reportBuffer: Buffer
    let contentType: string
    let filename: string

    if (format === 'pdf') {
      reportBuffer = await generatePDFReport(reportData)
      contentType = 'application/pdf'
      filename = `rule-test-report-${task.id}.pdf`
    } else {
      reportBuffer = await generateExcelReport(reportData)
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      filename = `rule-test-report-${task.id}.xlsx`
    }

    // 8. 返回檔案
    return new NextResponse(new Uint8Array(reportBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': reportBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '生成報告時發生錯誤',
      },
      { status: 500 }
    )
  }
}
