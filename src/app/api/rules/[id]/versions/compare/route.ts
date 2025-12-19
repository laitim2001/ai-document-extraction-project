/**
 * @fileoverview 規則版本對比 API 端點
 * @description
 *   提供規則版本對比功能：
 *   - 對比兩個版本之間的差異
 *   - 計算欄位級別差異
 *   - 計算 Pattern 行級差異
 *   - 生成人類可讀的差異摘要
 *
 * @module src/app/api/rules/[id]/versions/compare/route
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 欄位差異分析
 *   - Pattern 差異分析（使用 diff 庫）
 *   - 差異摘要生成
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - diff - 文字差異計算
 *   - zod - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { diffLines, Change } from 'diff'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import type {
  VersionDetail,
  FieldDifference,
  PatternDiff,
  CompareResponse,
  ExtractionPattern,
} from '@/types/version'
import type { RuleVersion, User } from '@prisma/client'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 查詢參數驗證 Schema
 */
const querySchema = z.object({
  v1: z.string().min(1, 'Version 1 ID is required'),
  v2: z.string().min(1, 'Version 2 ID is required'),
})

// ============================================================
// Helper Types
// ============================================================

type VersionWithCreator = RuleVersion & {
  creator: Pick<User, 'id' | 'name' | 'email'>
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 將 ExtractionPattern 序列化為字符串用於比較
 */
function serializePattern(pattern: ExtractionPattern | null): string {
  if (!pattern) return ''
  return JSON.stringify(pattern, null, 2)
}

/**
 * 取得 ExtractionPattern 的方法名稱（中文）
 */
function getMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    regex: '正則表達式',
    keyword: '關鍵字',
    position: '位置',
    azure_field: 'Azure 欄位',
    ai_prompt: 'AI 提示詞',
    template: '模板',
  }
  return labels[method] || method
}

/**
 * 計算兩個版本之間的欄位差異
 */
function calculateDifferences(
  v1: VersionWithCreator,
  v2: VersionWithCreator
): FieldDifference[] {
  const pattern1 = v1.extractionPattern as ExtractionPattern | null
  const pattern2 = v2.extractionPattern as ExtractionPattern | null

  const differences: FieldDifference[] = [
    {
      field: 'method',
      label: '提取方法',
      value1: pattern1?.method ? getMethodLabel(pattern1.method) : '-',
      value2: pattern2?.method ? getMethodLabel(pattern2.method) : '-',
      changed: pattern1?.method !== pattern2?.method,
    },
    {
      field: 'confidence',
      label: '信心度',
      value1: `${(v1.confidence * 100).toFixed(0)}%`,
      value2: `${(v2.confidence * 100).toFixed(0)}%`,
      changed: v1.confidence !== v2.confidence,
    },
    {
      field: 'priority',
      label: '優先級',
      value1: v1.priority,
      value2: v2.priority,
      changed: v1.priority !== v2.priority,
    },
    {
      field: 'changeReason',
      label: '變更原因',
      value1: v1.changeReason || '-',
      value2: v2.changeReason || '-',
      changed: v1.changeReason !== v2.changeReason,
    },
  ]

  return differences
}

/**
 * 計算 Pattern 差異
 */
function calculatePatternDiff(
  v1: VersionWithCreator,
  v2: VersionWithCreator
): PatternDiff {
  const pattern1 = serializePattern(v1.extractionPattern as ExtractionPattern | null)
  const pattern2 = serializePattern(v2.extractionPattern as ExtractionPattern | null)

  // 使用 diff 庫計算行級差異
  const changes = diffLines(pattern1, pattern2)

  const added: string[] = []
  const removed: string[] = []
  const unchanged: string[] = []

  changes.forEach((change: Change) => {
    const lines = change.value.split('\n').filter((line) => line.trim())
    if (change.added) {
      added.push(...lines)
    } else if (change.removed) {
      removed.push(...lines)
    } else {
      unchanged.push(...lines)
    }
  })

  return { added, removed, unchanged }
}

/**
 * 生成人類可讀的差異摘要
 */
function generateSummaryText(
  v1: VersionWithCreator,
  v2: VersionWithCreator,
  differences: FieldDifference[]
): string {
  const changedFields = differences.filter((d) => d.changed)

  if (changedFields.length === 0) {
    return '兩個版本完全相同'
  }

  const parts: string[] = []

  const pattern1 = v1.extractionPattern as ExtractionPattern | null
  const pattern2 = v2.extractionPattern as ExtractionPattern | null

  if (pattern1?.method !== pattern2?.method) {
    const method1 = pattern1?.method ? getMethodLabel(pattern1.method) : '無'
    const method2 = pattern2?.method ? getMethodLabel(pattern2.method) : '無'
    parts.push(`提取方法從「${method1}」變更為「${method2}」`)
  }

  if (v1.confidence !== v2.confidence) {
    const diff = (v2.confidence - v1.confidence) * 100
    const direction = diff > 0 ? '提高' : '降低'
    parts.push(`信心度${direction}了 ${Math.abs(diff).toFixed(0)}%`)
  }

  if (v1.priority !== v2.priority) {
    parts.push(`優先級從 ${v1.priority} 變更為 ${v2.priority}`)
  }

  const patternStr1 = serializePattern(pattern1)
  const patternStr2 = serializePattern(pattern2)
  if (patternStr1 !== patternStr2 && !parts.some((p) => p.includes('提取方法'))) {
    parts.push('提取模式配置有變更')
  }

  return parts.join('；') || '有細微變更'
}

/**
 * 轉換版本為響應格式
 */
function transformVersion(
  version: VersionWithCreator,
  currentVersion: number
): VersionDetail {
  return {
    id: version.id,
    version: version.version,
    extractionPattern: version.extractionPattern as unknown as ExtractionPattern,
    confidence: version.confidence,
    priority: version.priority,
    changeReason: version.changeReason,
    createdBy: {
      id: version.creator.id,
      name: version.creator.name,
      email: version.creator.email,
    },
    createdAt: version.createdAt.toISOString(),
    isActive: version.version === currentVersion,
  }
}

// ============================================================
// GET /api/rules/[id]/versions/compare
// ============================================================

/**
 * GET /api/rules/[id]/versions/compare
 * 對比兩個版本的差異
 *
 * @description
 *   對比兩個版本並返回差異分析：
 *   1. 驗證用戶認證和權限
 *   2. 驗證兩個版本存在且屬於同一規則
 *   3. 計算欄位差異
 *   4. 計算 Pattern 差異
 *   5. 生成差異摘要
 *
 * @query v1 - 版本 1 ID
 * @query v2 - 版本 2 ID
 *
 * @returns CompareResponse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ruleId } = await params

    // 1. 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
            instance: `/api/rules/${ruleId}/versions/compare`,
          },
        },
        { status: 401 }
      )
    }

    // 2. 權限檢查
    if (!hasPermission(session.user, PERMISSIONS.RULE_VIEW)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_VIEW permission required',
            instance: `/api/rules/${ruleId}/versions/compare`,
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析查詢參數
    const searchParams = request.nextUrl.searchParams
    const queryResult = querySchema.safeParse({
      v1: searchParams.get('v1'),
      v2: searchParams.get('v2'),
    })

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: queryResult.error.issues[0].message,
            instance: `/api/rules/${ruleId}/versions/compare`,
          },
        },
        { status: 400 }
      )
    }

    const { v1, v2 } = queryResult.data

    // 4. 驗證不能比較相同版本
    if (v1 === v2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: 'Cannot compare a version with itself',
            instance: `/api/rules/${ruleId}/versions/compare`,
          },
        },
        { status: 400 }
      )
    }

    // 5. 並行取得兩個版本
    const [version1, version2] = await Promise.all([
      prisma.ruleVersion.findUnique({
        where: { id: v1 },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.ruleVersion.findUnique({
        where: { id: v2 },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ])

    // 6. 驗證版本存在
    if (!version1 || !version2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Version Not Found',
            status: 404,
            detail: 'One or both versions not found',
            instance: `/api/rules/${ruleId}/versions/compare`,
          },
        },
        { status: 404 }
      )
    }

    // 7. 驗證版本屬於同一規則
    if (version1.ruleId !== ruleId || version2.ruleId !== ruleId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: 'Versions do not belong to the specified rule',
            instance: `/api/rules/${ruleId}/versions/compare`,
          },
        },
        { status: 400 }
      )
    }

    // 8. 取得當前規則版本
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      select: { version: true },
    })

    const currentVersion = rule?.version ?? 0

    // 9. 計算差異
    const differences = calculateDifferences(version1, version2)
    const patternDiff = calculatePatternDiff(version1, version2)
    const summaryText = generateSummaryText(version1, version2, differences)

    // 10. 構建響應
    const response: CompareResponse = {
      version1: transformVersion(version1, currentVersion),
      version2: transformVersion(version2, currentVersion),
      differences,
      patternDiff,
      summaryText,
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error('Error comparing versions:', error)

    const ruleId = (await params).id
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
          instance: `/api/rules/${ruleId}/versions/compare`,
        },
      },
      { status: 500 }
    )
  }
}
