/**
 * @fileoverview 規則建議批准 API 端點
 * @description
 *   提供規則建議的批准功能，執行以下操作：
 *   - 更新建議狀態為 APPROVED
 *   - 檢查並棄用現有規則
 *   - 創建新版本的 MappingRule
 *   - 創建 RuleVersion 記錄
 *   - 更新建議狀態為 IMPLEMENTED
 *   - 更新關聯的 CorrectionPattern 狀態
 *
 * @module src/app/api/rules/suggestions/[id]/approve/route
 * @since Epic 4 - Story 4.6 (審核學習規則)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 權限檢查（RULE_APPROVE）
 *   - 事務處理確保數據一致性
 *   - 版本管理（新建/升級規則）
 *   - 審計記錄
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/types/permissions - 權限常量
 *   - zod - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 批准請求驗證 Schema
 */
const approveSchema = z.object({
  /** 審核備註（選填） */
  notes: z.string().optional(),
  /** 生效日期（選填，ISO 8601 格式） */
  effectiveDate: z.string().optional(),
})

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則批准權限
 */
function hasRuleApprovePermission(roles: { permissions: string[] }[] | undefined): boolean {
  if (!roles) return false
  return roles.some((r) => r.permissions.includes(PERMISSIONS.RULE_APPROVE))
}

// ============================================================
// POST /api/rules/suggestions/[id]/approve
// ============================================================

/**
 * POST /api/rules/suggestions/[id]/approve
 * 批准規則建議
 *
 * @description
 *   批准規則建議並創建/更新對應的映射規則：
 *   1. 驗證建議狀態為 PENDING
 *   2. 更新建議狀態為 APPROVED
 *   3. 檢查現有活躍規則
 *   4. 如有現有規則，棄用並創建新版本
 *   5. 如無現有規則，創建版本 1
 *   6. 創建 RuleVersion 記錄
 *   7. 更新建議狀態為 IMPLEMENTED
 *   8. 更新關聯的 CorrectionPattern 狀態
 *
 * @body RuleApproveRequest
 *   - notes: 審核備註（可選）
 *   - effectiveDate: 生效日期（可選）
 *
 * @returns RuleApproveResponse
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: suggestionId } = await params

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
          },
        },
        { status: 401 }
      )
    }

    // 2. 權限檢查
    if (!hasRuleApprovePermission(session.user.roles)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_APPROVE permission required',
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析並驗證請求體
    const body = await request.json().catch(() => ({}))
    const validation = approveSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid request body',
            errors: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { notes } = validation.data

    // 4. 執行事務
    const result = await prisma.$transaction(async (tx) => {
      // 4.1 獲取建議
      const suggestion = await tx.ruleSuggestion.findUnique({
        where: { id: suggestionId },
        include: {
          forwarder: true,
        },
      })

      if (!suggestion) {
        throw new Error('Suggestion not found')
      }

      if (suggestion.status !== 'PENDING') {
        throw new Error(`Suggestion is not pending (current status: ${suggestion.status})`)
      }

      // 4.2 更新建議狀態為 APPROVED
      await tx.ruleSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: 'APPROVED',
          reviewedBy: session.user!.id,
          reviewedAt: new Date(),
          reviewNotes: notes || null,
        },
      })

      // 4.3 檢查是否有現有活躍規則
      const existingRule = await tx.mappingRule.findFirst({
        where: {
          forwarderId: suggestion.forwarderId,
          fieldName: suggestion.fieldName,
          status: 'ACTIVE',
        },
      })

      let newRule
      let newVersion: number

      // 構建 extractionPattern
      const extractionPattern = {
        method: suggestion.extractionType.toLowerCase(),
        pattern: suggestion.suggestedPattern,
      }

      if (existingRule) {
        // 4.4a 棄用舊規則
        await tx.mappingRule.update({
          where: { id: existingRule.id },
          data: { status: 'DEPRECATED' },
        })

        newVersion = existingRule.version + 1

        // 4.4b 創建新版本規則
        newRule = await tx.mappingRule.create({
          data: {
            forwarderId: suggestion.forwarderId,
            fieldName: suggestion.fieldName,
            fieldLabel: existingRule.fieldLabel,
            extractionPattern,
            confidence: suggestion.confidence,
            priority: existingRule.priority,
            version: newVersion,
            status: 'ACTIVE',
            description: `Upgraded from suggestion (${suggestion.source})`,
            createdBy: session.user!.id,
            suggestionId: suggestion.id,
          },
        })
      } else {
        // 4.4c 創建新規則（版本 1）
        newVersion = 1

        newRule = await tx.mappingRule.create({
          data: {
            forwarderId: suggestion.forwarderId,
            fieldName: suggestion.fieldName,
            fieldLabel: suggestion.fieldName,
            extractionPattern,
            confidence: suggestion.confidence,
            priority: 50,
            version: newVersion,
            status: 'ACTIVE',
            description: `Created from suggestion (${suggestion.source})`,
            createdBy: session.user!.id,
            suggestionId: suggestion.id,
          },
        })
      }

      // 4.5 創建版本歷史記錄
      await tx.ruleVersion.create({
        data: {
          ruleId: newRule.id,
          version: newVersion,
          extractionPattern: {
            method: suggestion.extractionType.toLowerCase(),
            pattern: suggestion.suggestedPattern,
          },
          confidence: suggestion.confidence,
          priority: newRule.priority,
          changeReason: `Approved from suggestion: ${suggestion.id}`,
          createdBy: session.user!.id,
        },
      })

      // 4.6 更新建議狀態為 IMPLEMENTED
      await tx.ruleSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'IMPLEMENTED' },
      })

      // 4.7 如果有關聯的 CorrectionPattern，更新其狀態
      if (suggestion.patternId) {
        await tx.correctionPattern.update({
          where: { id: suggestion.patternId },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        })
      }

      return { suggestion, rule: newRule, version: newVersion }
    })

    // 5. 返回成功響應
    return NextResponse.json({
      success: true,
      data: {
        suggestionId,
        ruleId: result.rule.id,
        ruleVersion: result.version,
        status: 'IMPLEMENTED',
        message:
          result.version === 1
            ? 'New rule created and activated'
            : `Rule upgraded to version ${result.version}`,
      },
    })
  } catch (error) {
    console.error('Failed to approve suggestion:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('not found')
      ? 404
      : message.includes('not pending')
        ? 400
        : 500

    return NextResponse.json(
      {
        success: false,
        error: {
          type:
            status === 404 ? 'not_found' : status === 400 ? 'bad_request' : 'internal_error',
          title:
            status === 404 ? 'Not Found' : status === 400 ? 'Bad Request' : 'Internal Server Error',
          status,
          detail: message,
        },
      },
      { status }
    )
  }
}
