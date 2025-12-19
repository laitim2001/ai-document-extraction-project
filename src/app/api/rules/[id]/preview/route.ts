/**
 * @fileoverview 規則預覽 API 端點
 * @description
 *   提供規則在指定文件上的提取效果預覽功能。
 *   用於在提交變更請求前測試規則配置。
 *
 *   端點：
 *   - POST /api/rules/[id]/preview - 預覽規則提取效果
 *
 * @module src/app/api/rules/[id]/preview/route
 * @author Development Team
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/lib/auth/city-permission - 權限檢查
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { ExtractionType } from '@prisma/client'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 預覽請求 Schema
 */
const PreviewRequestSchema = z
  .object({
    documentId: z.string().optional(),
    documentContent: z.string().optional(),
    previewPattern: z.record(z.string(), z.unknown()).optional(),
    previewExtractionType: z.nativeEnum(ExtractionType).optional(),
  })
  .refine((data) => data.documentId || data.documentContent, {
    message: '請提供測試文件 ID 或文件內容',
  })

// ============================================================
// Types
// ============================================================

interface RouteParams {
  params: Promise<{ id: string }>
}

interface PreviewResult {
  matched: boolean
  extractedValue: string | null
  confidence: number
  processingTime: number
  matchPosition?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  debugInfo?: {
    patternMatched: boolean
    matchDetails?: string
    errorMessage?: string
  }
}

// ============================================================
// POST /api/rules/[id]/preview
// ============================================================

/**
 * POST /api/rules/[id]/preview
 * 預覽規則提取效果
 *
 * @description
 *   在指定文件上測試規則的提取效果。
 *   可以提供自定義的 pattern 和 extractionType 來預覽修改後的效果，
 *   而不需要實際保存變更。
 *
 *   需要 RULE_MANAGE 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含規則 id）
 * @returns 預覽結果
 *
 * @example
 *   POST /api/rules/rule123/preview
 *   Body: {
 *     "documentId": "doc456",
 *     "previewPattern": { "expression": "Invoice:\\s*(\\d+)" }
 *   }
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "matched": true,
 *       "extractedValue": "INV-2024-001",
 *       "confidence": 0.95,
 *       "processingTime": 150
 *     }
 *   }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 驗證認證狀態
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: '請先登入',
          },
        },
        { status: 401 }
      )
    }

    // 2. 驗證權限
    const canManageRules = hasPermission(session.user, PERMISSIONS.RULE_MANAGE)
    if (!canManageRules) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: '您沒有預覽規則的權限',
          },
        },
        { status: 403 }
      )
    }

    // 3. 獲取並驗證路由參數
    const resolvedParams = await params
    const ruleId = resolvedParams.id

    if (!ruleId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: '無效的規則 ID',
          },
        },
        { status: 400 }
      )
    }

    // 4. 解析並驗證請求內容
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: '無效的 JSON 格式',
          },
        },
        { status: 400 }
      )
    }

    const bodyValidation = PreviewRequestSchema.safeParse(body)

    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: '請求資料驗證失敗',
            errors: bodyValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { documentId, documentContent, previewPattern, previewExtractionType } =
      bodyValidation.data

    // 5. 獲取規則
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      include: {
        forwarder: { select: { id: true, name: true } },
      },
    })

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: '找不到指定的規則',
          },
        },
        { status: 404 }
      )
    }

    // 6. 獲取文件（如果提供 documentId）
    let ocrText = ''
    let documentInfo: { id: string; fileName: string } | null = null

    if (documentId) {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          ocrResult: true,
        },
      })

      if (!document) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/not-found',
              title: 'Not Found',
              status: 404,
              detail: '找不到指定的文件',
            },
          },
          { status: 404 }
        )
      }

      // 檢查文件是否屬於同一 Forwarder
      if (document.forwarderId && document.forwarderId !== rule.forwarderId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/bad-request',
              title: 'Bad Request',
              status: 400,
              detail: '此文件不屬於此規則的 Forwarder',
            },
          },
          { status: 400 }
        )
      }

      ocrText = document.ocrResult?.extractedText ?? ''
      documentInfo = { id: document.id, fileName: document.fileName }
    } else if (documentContent) {
      // 使用提供的文件內容（Base64 解碼）
      try {
        ocrText = Buffer.from(documentContent, 'base64').toString('utf-8')
      } catch {
        ocrText = documentContent // 如果不是 Base64，直接使用
      }
    }

    // 7. 執行規則預覽
    const startTime = Date.now()
    const effectivePattern = previewPattern ?? (rule.extractionPattern as Record<string, unknown>)
    const effectiveType = previewExtractionType ??
      ((rule.extractionPattern as Record<string, unknown>)?.type as ExtractionType) ??
      ExtractionType.REGEX

    let result: PreviewResult

    try {
      // 模擬規則執行
      result = await executeRulePreview({
        extractionType: effectiveType,
        pattern: effectivePattern,
        ocrText,
      })
      result.processingTime = Date.now() - startTime
    } catch (execError) {
      result = {
        matched: false,
        extractedValue: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        debugInfo: {
          patternMatched: false,
          errorMessage:
            execError instanceof Error ? execError.message : '執行規則時發生錯誤',
        },
      }
    }

    // 8. 返回成功響應
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        rule: {
          id: rule.id,
          fieldName: rule.fieldName,
          fieldLabel: rule.fieldLabel,
        },
        document: documentInfo,
        previewConfig: {
          usedCustomPattern: !!previewPattern,
          usedCustomType: !!previewExtractionType,
        },
      },
    })
  } catch (error) {
    console.error('Rule preview error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: '預覽規則時發生錯誤',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 執行規則預覽
 * @internal
 */
async function executeRulePreview(params: {
  extractionType: ExtractionType
  pattern: Record<string, unknown>
  ocrText: string
}): Promise<PreviewResult> {
  const { extractionType, pattern, ocrText } = params

  if (!ocrText) {
    return {
      matched: false,
      extractedValue: null,
      confidence: 0,
      processingTime: 0,
      debugInfo: {
        patternMatched: false,
        errorMessage: '無 OCR 文字可供分析',
      },
    }
  }

  switch (extractionType) {
    case ExtractionType.REGEX: {
      return executeRegexPattern(pattern, ocrText)
    }
    case ExtractionType.KEYWORD: {
      return executeKeywordPattern(pattern, ocrText)
    }
    case ExtractionType.POSITION: {
      // 位置提取需要實際的座標數據，這裡返回模擬結果
      return {
        matched: false,
        extractedValue: null,
        confidence: 0,
        processingTime: 0,
        debugInfo: {
          patternMatched: false,
          errorMessage: '位置提取需要完整的 OCR 座標數據',
        },
      }
    }
    case ExtractionType.AI_PROMPT: {
      // AI 提取需要調用 LLM，這裡返回模擬結果
      return {
        matched: false,
        extractedValue: null,
        confidence: 0,
        processingTime: 0,
        debugInfo: {
          patternMatched: false,
          errorMessage: 'AI 提取預覽功能開發中',
        },
      }
    }
    case ExtractionType.TEMPLATE: {
      // 模板提取返回模擬結果
      return {
        matched: false,
        extractedValue: null,
        confidence: 0,
        processingTime: 0,
        debugInfo: {
          patternMatched: false,
          errorMessage: '模板提取預覽功能開發中',
        },
      }
    }
    default: {
      return {
        matched: false,
        extractedValue: null,
        confidence: 0,
        processingTime: 0,
        debugInfo: {
          patternMatched: false,
          errorMessage: `不支援的提取類型: ${extractionType}`,
        },
      }
    }
  }
}

/**
 * 執行正則表達式提取
 */
function executeRegexPattern(
  pattern: Record<string, unknown>,
  text: string
): PreviewResult {
  const expression = pattern.expression as string
  const flags = (pattern.flags as string) ?? 'gi'
  const groupIndex = (pattern.groupIndex as number) ?? 1

  if (!expression) {
    return {
      matched: false,
      extractedValue: null,
      confidence: 0,
      processingTime: 0,
      debugInfo: {
        patternMatched: false,
        errorMessage: '缺少正則表達式',
      },
    }
  }

  try {
    const regex = new RegExp(expression, flags)
    const match = regex.exec(text)

    if (match) {
      const extractedValue = match[groupIndex] ?? match[0]

      // 應用預處理
      let processedValue = extractedValue
      const preprocessing = pattern.preprocessing as Record<string, boolean> | undefined
      if (preprocessing) {
        if (preprocessing.trim) processedValue = processedValue.trim()
        if (preprocessing.toUpperCase) processedValue = processedValue.toUpperCase()
        if (preprocessing.toLowerCase) processedValue = processedValue.toLowerCase()
        if (preprocessing.removeSpaces) processedValue = processedValue.replace(/\s+/g, '')
      }

      return {
        matched: true,
        extractedValue: processedValue,
        confidence: 0.85, // 基礎信心度
        processingTime: 0,
        debugInfo: {
          patternMatched: true,
          matchDetails: `在位置 ${match.index} 找到匹配`,
        },
      }
    }

    return {
      matched: false,
      extractedValue: null,
      confidence: 0,
      processingTime: 0,
      debugInfo: {
        patternMatched: false,
        matchDetails: '正則表達式未匹配到任何內容',
      },
    }
  } catch (regexError) {
    return {
      matched: false,
      extractedValue: null,
      confidence: 0,
      processingTime: 0,
      debugInfo: {
        patternMatched: false,
        errorMessage: `無效的正則表達式: ${regexError instanceof Error ? regexError.message : '未知錯誤'}`,
      },
    }
  }
}

/**
 * 執行關鍵字提取
 */
function executeKeywordPattern(
  pattern: Record<string, unknown>,
  text: string
): PreviewResult {
  const keywords = pattern.keywords as string[]
  const searchDirection = (pattern.searchDirection as string) ?? 'right'
  const extractLength = (pattern.extractLength as number) ?? 50
  const caseSensitive = (pattern.caseSensitive as boolean) ?? false

  if (!keywords || keywords.length === 0) {
    return {
      matched: false,
      extractedValue: null,
      confidence: 0,
      processingTime: 0,
      debugInfo: {
        patternMatched: false,
        errorMessage: '缺少關鍵字列表',
      },
    }
  }

  const searchText = caseSensitive ? text : text.toLowerCase()

  for (const keyword of keywords) {
    const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase()
    const keywordIndex = searchText.indexOf(searchKeyword)

    if (keywordIndex !== -1) {
      let extractedValue = ''

      if (searchDirection === 'right') {
        const startPos = keywordIndex + keyword.length
        extractedValue = text.substring(startPos, startPos + extractLength).trim()
      } else if (searchDirection === 'left') {
        const endPos = keywordIndex
        const startPos = Math.max(0, endPos - extractLength)
        extractedValue = text.substring(startPos, endPos).trim()
      } else if (searchDirection === 'below' || searchDirection === 'above') {
        // 簡化處理：尋找下一行或上一行
        const lines = text.split('\n')
        const currentLineIndex = text.substring(0, keywordIndex).split('\n').length - 1

        if (searchDirection === 'below' && currentLineIndex < lines.length - 1) {
          extractedValue = lines[currentLineIndex + 1]?.trim() ?? ''
        } else if (searchDirection === 'above' && currentLineIndex > 0) {
          extractedValue = lines[currentLineIndex - 1]?.trim() ?? ''
        }
      }

      // 清理提取的值（移除關鍵字後的分隔符號）
      extractedValue = extractedValue.replace(/^[:：\s]+/, '').trim()

      if (extractedValue) {
        return {
          matched: true,
          extractedValue: extractedValue.substring(0, extractLength),
          confidence: 0.8,
          processingTime: 0,
          debugInfo: {
            patternMatched: true,
            matchDetails: `通過關鍵字 "${keyword}" 找到匹配`,
          },
        }
      }
    }
  }

  return {
    matched: false,
    extractedValue: null,
    confidence: 0,
    processingTime: 0,
    debugInfo: {
      patternMatched: false,
      matchDetails: `未找到任何關鍵字: ${keywords.join(', ')}`,
    },
  }
}
