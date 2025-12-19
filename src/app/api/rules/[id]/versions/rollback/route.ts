/**
 * @fileoverview 規則版本回滾 API 端點
 * @description
 *   提供規則版本手動回滾功能：
 *   - 將規則回滾到指定的歷史版本
 *   - 創建新版本記錄（以目標版本內容）
 *   - 更新規則為新版本
 *
 * @module src/app/api/rules/[id]/versions/rollback/route
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 回滾到指定歷史版本
 *   - 創建新版本記錄（非覆蓋）
 *   - 事務處理確保數據一致性
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - zod - 輸入驗證
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { ruleResolver } from '@/services/rule-resolver'
import type { RollbackResult } from '@/types/version'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 回滾請求驗證 Schema
 */
const bodySchema = z.object({
  targetVersionId: z.string().min(1, 'Target version ID is required'),
  reason: z.string().max(500).optional(),
})

// ============================================================
// POST /api/rules/[id]/versions/rollback
// ============================================================

/**
 * POST /api/rules/[id]/versions/rollback
 * 手動回滾規則至指定版本
 *
 * @description
 *   執行版本回滾操作：
 *   1. 驗證用戶認證和 RULE_MANAGE 權限
 *   2. 驗證目標版本存在且屬於該規則
 *   3. 驗證不是回滾到當前版本
 *   4. 創建新版本（使用目標版本的內容）
 *   5. 更新規則版本
 *
 * @body targetVersionId - 要回滾到的版本 ID
 * @body reason - 回滾原因（選填）
 *
 * @returns RollbackResult
 */
export async function POST(
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
            instance: `/api/rules/${ruleId}/versions/rollback`,
          },
        },
        { status: 401 }
      )
    }

    // 2. 權限檢查 - 回滾需要 RULE_MANAGE 權限
    if (!hasPermission(session.user, PERMISSIONS.RULE_MANAGE)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'RULE_MANAGE permission required for rollback',
            instance: `/api/rules/${ruleId}/versions/rollback`,
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析請求體
    const body = await request.json().catch(() => ({}))
    const bodyResult = bodySchema.safeParse(body)

    if (!bodyResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: bodyResult.error.issues[0].message,
            instance: `/api/rules/${ruleId}/versions/rollback`,
          },
        },
        { status: 400 }
      )
    }

    const { targetVersionId, reason } = bodyResult.data

    // 4. 取得目標版本
    const targetVersion = await prisma.ruleVersion.findUnique({
      where: { id: targetVersionId },
    })

    if (!targetVersion) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Version Not Found',
            status: 404,
            detail: `Target version ${targetVersionId} not found`,
            instance: `/api/rules/${ruleId}/versions/rollback`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 驗證版本屬於正確的規則
    if (targetVersion.ruleId !== ruleId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: 'Target version does not belong to this rule',
            instance: `/api/rules/${ruleId}/versions/rollback`,
          },
        },
        { status: 400 }
      )
    }

    // 6. 取得當前規則
    const currentRule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
    })

    if (!currentRule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'not_found',
            title: 'Rule Not Found',
            status: 404,
            detail: `Rule ${ruleId} not found`,
            instance: `/api/rules/${ruleId}/versions/rollback`,
          },
        },
        { status: 404 }
      )
    }

    // 7. 驗證不是回滾到當前版本
    if (targetVersion.version === currentRule.version) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'validation_error',
            title: 'Validation Error',
            status: 400,
            detail: 'Cannot rollback to the current active version',
            instance: `/api/rules/${ruleId}/versions/rollback`,
          },
        },
        { status: 400 }
      )
    }

    // 8. 執行回滾事務
    const result = await prisma.$transaction(async (tx) => {
      const newVersionNumber = currentRule.version + 1
      const changeReason =
        reason || `Manual rollback to version ${targetVersion.version}`

      // 8.1 更新規則（使用目標版本的內容）
      // Handle Prisma Json type - null needs to be Prisma.JsonNull for input
      const targetPattern = targetVersion.extractionPattern === null
        ? Prisma.JsonNull
        : (targetVersion.extractionPattern as Prisma.InputJsonValue)

      await tx.mappingRule.update({
        where: { id: ruleId },
        data: {
          extractionPattern: targetPattern,
          confidence: targetVersion.confidence,
          priority: targetVersion.priority,
          version: newVersionNumber,
          updatedAt: new Date(),
        },
      })

      // 8.2 創建新版本記錄
      const newVersion = await tx.ruleVersion.create({
        data: {
          ruleId: ruleId,
          version: newVersionNumber,
          extractionPattern: targetPattern,
          confidence: targetVersion.confidence,
          priority: targetVersion.priority,
          changeReason: changeReason,
          createdBy: session.user!.id,
        },
      })

      return {
        newVersion,
        fromVersion: currentRule.version,
        toVersion: targetVersion.version,
        forwarderId: currentRule.forwarderId,
      }
    })

    // 9. 失效規則快取（確保所有城市取得最新規則）
    if (result.forwarderId) {
      await ruleResolver.invalidateForwarderCache(result.forwarderId)
    }

    // 10. 返回成功響應
    const response: RollbackResult = {
      ruleId: ruleId,
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      newVersion: result.newVersion.version,
      message: `Successfully rolled back to version ${result.toVersion}`,
      createdAt: result.newVersion.createdAt.toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error('Error rolling back version:', error)

    const ruleId = (await params).id
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred during rollback',
          instance: `/api/rules/${ruleId}/versions/rollback`,
        },
      },
      { status: 500 }
    )
  }
}
