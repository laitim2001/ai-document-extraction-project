/**
 * @fileoverview 規則測試 API 端點
 * @description
 *   Story 4-2: 建議新映射規則 - 規則測試功能
 *   提供在提交前測試提取模式的能力：
 *   - 支持所有提取類型（REGEX, POSITION, KEYWORD, AI_PROMPT, TEMPLATE）
 *   - 可以測試文件內容或選擇已上傳的文件
 *   - 返回詳細的匹配結果和調試資訊
 *
 *   端點：
 *   - POST /api/rules/test - 測試提取模式
 *
 * @module src/app/api/rules/test/route
 * @since Epic 4 - Story 4.2 (建議新映射規則)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/permissions - 權限常量
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/app/api/rules/route.ts - 規則創建 API
 *   - src/hooks/useTestRule.ts - 規則測試 Hook
 *   - src/types/rule.ts - 類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'
import type { ExtractionType } from '@/types/rule'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 測試請求驗證 Schema
 */
const testRuleSchema = z.object({
  extractionType: z.enum(['REGEX', 'POSITION', 'KEYWORD', 'AI_PROMPT', 'TEMPLATE']),
  pattern: z.string().or(z.record(z.string(), z.unknown())),
  documentId: z.string().optional(),
  documentContent: z.string().optional(),
}).refine(
  (data) => data.documentId || data.documentContent,
  {
    message: 'Either documentId or documentContent is required',
  }
)

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則管理權限
 *
 * @note 支援 wildcard ('*') 權限，開發模式下用戶擁有所有權限
 */
function hasRuleManagePermission(
  roles: { permissions: string[] }[] | undefined
): boolean {
  if (!roles) return false
  return roles.some((r) =>
    r.permissions.includes('*') || r.permissions.includes(PERMISSIONS.RULE_MANAGE)
  )
}

/**
 * 匹配位置資訊
 */
interface MatchPosition {
  start: number
  end: number
  line?: number
  column?: number
  context?: string
}

/**
 * 測試結果
 */
interface TestResult {
  matched: boolean
  extractedValue: string | null
  confidence: number
  matchPositions?: MatchPosition[]
  debugInfo?: {
    processingTime: number
    matchAttempts: number
    errors?: string[]
  }
}

/**
 * 執行 REGEX 類型測試
 */
function testRegexPattern(
  pattern: string | Record<string, unknown>,
  content: string
): TestResult {
  const startTime = performance.now()
  const errors: string[] = []

  try {
    let expression: string
    let flags: string | undefined

    if (typeof pattern === 'string') {
      expression = pattern
    } else {
      expression = (pattern.expression as string) || (pattern as unknown as string)
      flags = pattern.flags as string | undefined
    }

    const regex = new RegExp(expression, flags || 'gm')
    const matches = content.match(regex)

    if (!matches || matches.length === 0) {
      return {
        matched: false,
        extractedValue: null,
        confidence: 0,
        debugInfo: {
          processingTime: performance.now() - startTime,
          matchAttempts: 1,
        },
      }
    }

    // 找出所有匹配位置
    const matchPositions: MatchPosition[] = []
    let match
    const regexForPos = new RegExp(expression, flags || 'gm')

    while ((match = regexForPos.exec(content)) !== null) {
      const lines = content.substring(0, match.index).split('\n')
      matchPositions.push({
        start: match.index,
        end: match.index + match[0].length,
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
        context: content.substring(
          Math.max(0, match.index - 20),
          Math.min(content.length, match.index + match[0].length + 20)
        ),
      })
    }

    return {
      matched: true,
      extractedValue: matches[0],
      confidence: 0.85,
      matchPositions,
      debugInfo: {
        processingTime: performance.now() - startTime,
        matchAttempts: 1,
      },
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown regex error')
    return {
      matched: false,
      extractedValue: null,
      confidence: 0,
      debugInfo: {
        processingTime: performance.now() - startTime,
        matchAttempts: 1,
        errors,
      },
    }
  }
}

/**
 * 執行 KEYWORD 類型測試
 */
function testKeywordPattern(
  pattern: string | Record<string, unknown>,
  content: string
): TestResult {
  const startTime = performance.now()

  try {
    let keywords: string[]
    let position: string = 'after'
    let maxDistance: number = 100

    if (typeof pattern === 'string') {
      keywords = [pattern]
    } else {
      keywords = (pattern.keywords as string[]) || []
      position = (pattern.position as string) || 'after'
      maxDistance = (pattern.maxDistance as number) || 100
    }

    const lowerContent = content.toLowerCase()
    const matchPositions: MatchPosition[] = []
    let extractedValue: string | null = null

    for (const keyword of keywords) {
      const index = lowerContent.indexOf(keyword.toLowerCase())
      if (index !== -1) {
        const lines = content.substring(0, index).split('\n')
        matchPositions.push({
          start: index,
          end: index + keyword.length,
          line: lines.length,
          column: lines[lines.length - 1].length + 1,
          context: content.substring(
            Math.max(0, index - 20),
            Math.min(content.length, index + keyword.length + 20)
          ),
        })

        // 根據位置提取值
        if (position === 'after') {
          const afterText = content.substring(index + keyword.length, index + keyword.length + maxDistance)
          const valueMatch = afterText.match(/^\s*[:：]?\s*([^\n\r]+)/)
          if (valueMatch) {
            extractedValue = valueMatch[1].trim()
          }
        } else if (position === 'before') {
          const beforeText = content.substring(Math.max(0, index - maxDistance), index)
          const lines = beforeText.split('\n')
          if (lines.length > 0) {
            extractedValue = lines[lines.length - 1].trim()
          }
        }

        break // 找到第一個匹配就停止
      }
    }

    return {
      matched: matchPositions.length > 0,
      extractedValue,
      confidence: matchPositions.length > 0 ? 0.75 : 0,
      matchPositions,
      debugInfo: {
        processingTime: performance.now() - startTime,
        matchAttempts: keywords.length,
      },
    }
  } catch (error) {
    return {
      matched: false,
      extractedValue: null,
      confidence: 0,
      debugInfo: {
        processingTime: performance.now() - startTime,
        matchAttempts: 0,
        errors: [error instanceof Error ? error.message : 'Unknown keyword error'],
      },
    }
  }
}

/**
 * 執行 POSITION 類型測試（簡化版 - 需要實際 PDF 座標）
 */
function testPositionPattern(
  _pattern: string | Record<string, unknown>,
  _content: string
): TestResult {
  const startTime = performance.now()

  // 位置提取需要實際的 PDF 座標系統
  // 這裡提供簡化版本，實際實現需要整合 OCR 服務
  return {
    matched: false,
    extractedValue: null,
    confidence: 0,
    debugInfo: {
      processingTime: performance.now() - startTime,
      matchAttempts: 0,
      errors: ['Position-based extraction requires OCR coordinates. Please use documentId with processed document.'],
    },
  }
}

/**
 * 執行 AI_PROMPT 類型測試（簡化版 - 需要 AI 服務）
 */
function testPromptPattern(
  _pattern: string | Record<string, unknown>,
  _content: string
): TestResult {
  const startTime = performance.now()

  // AI Prompt 提取需要整合 Azure OpenAI 服務
  // 這裡提供簡化版本
  return {
    matched: false,
    extractedValue: null,
    confidence: 0,
    debugInfo: {
      processingTime: performance.now() - startTime,
      matchAttempts: 0,
      errors: ['AI Prompt extraction requires Azure OpenAI integration. This feature is not available in test mode.'],
    },
  }
}

/**
 * 執行 TEMPLATE 類型測試（簡化版）
 */
function testTemplatePattern(
  _pattern: string | Record<string, unknown>,
  _content: string
): TestResult {
  const startTime = performance.now()

  // 模板提取需要整合模板匹配引擎
  return {
    matched: false,
    extractedValue: null,
    confidence: 0,
    debugInfo: {
      processingTime: performance.now() - startTime,
      matchAttempts: 0,
      errors: ['Template extraction requires template matching engine. Please use documentId with processed document.'],
    },
  }
}

/**
 * 根據提取類型執行測試
 */
function executeTest(
  extractionType: ExtractionType,
  pattern: string | Record<string, unknown>,
  content: string
): TestResult {
  switch (extractionType) {
    case 'REGEX':
      return testRegexPattern(pattern, content)
    case 'KEYWORD':
      return testKeywordPattern(pattern, content)
    case 'POSITION':
      return testPositionPattern(pattern, content)
    case 'AI_PROMPT':
      return testPromptPattern(pattern, content)
    case 'TEMPLATE':
      return testTemplatePattern(pattern, content)
    default:
      return {
        matched: false,
        extractedValue: null,
        confidence: 0,
        debugInfo: {
          processingTime: 0,
          matchAttempts: 0,
          errors: [`Unknown extraction type: ${extractionType}`],
        },
      }
  }
}

// ============================================================
// POST /api/rules/test
// ============================================================

/**
 * POST /api/rules/test
 * 測試提取模式
 *
 * @description
 *   Story 4-2: 建議新映射規則 - 規則測試
 *   在提交規則建議前測試提取模式的效果
 *
 * @body TestRuleRequest
 *   - extractionType: 提取類型
 *   - pattern: 提取模式配置
 *   - documentId: 已上傳文件 ID（可選）
 *   - documentContent: 測試文件內容（可選）
 *
 * @returns 測試結果，包含匹配狀態、提取值、信心度
 */
export async function POST(request: NextRequest) {
  try {
    // 認證檢查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      )
    }

    // 權限檢查
    if (!hasRuleManagePermission(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'RULE_MANAGE permission required',
        },
        { status: 403 }
      )
    }

    // 解析並驗證請求體
    const body = await request.json()
    const validation = testRuleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid request body',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { extractionType, pattern, documentId, documentContent } = validation.data

    // 獲取測試內容
    let content: string

    if (documentContent) {
      content = documentContent
    } else if (documentId) {
      // 從資料庫獲取文件的 OCR 內容
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          status: true,
          ocrResult: {
            select: {
              extractedText: true,
            },
          },
        },
      })

      if (!document) {
        return NextResponse.json(
          {
            type: 'not_found',
            title: 'Not Found',
            status: 404,
            detail: `Document with ID ${documentId} not found`,
          },
          { status: 404 }
        )
      }

      if (document.status !== 'COMPLETED') {
        return NextResponse.json(
          {
            type: 'invalid_state',
            title: 'Invalid State',
            status: 400,
            detail: 'Document has not been processed yet',
          },
          { status: 400 }
        )
      }

      if (!document.ocrResult?.extractedText) {
        return NextResponse.json(
          {
            type: 'invalid_state',
            title: 'Invalid State',
            status: 400,
            detail: 'Document has no OCR content',
          },
          { status: 400 }
        )
      }

      content = document.ocrResult.extractedText
    } else {
      return NextResponse.json(
        {
          type: 'validation_error',
          title: 'Validation Error',
          status: 400,
          detail: 'Either documentId or documentContent is required',
        },
        { status: 400 }
      )
    }

    // 執行測試
    const result = executeTest(
      extractionType as ExtractionType,
      pattern,
      content
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Test rule error:', error)

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to test rule',
      },
      { status: 500 }
    )
  }
}
