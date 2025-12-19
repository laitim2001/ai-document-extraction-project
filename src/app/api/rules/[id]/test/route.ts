/**
 * @fileoverview 規則批次測試 API 端點
 * @description
 *   Story 5-4: 測試規則變更效果 - 啟動批次測試
 *   提供在套用規則變更前進行批次測試的能力：
 *   - 選擇測試範圍（最近 N 筆、指定文件、日期範圍、全部）
 *   - 非同步執行測試，返回任務 ID 供輪詢
 *   - 比較原規則和新規則的提取結果
 *
 *   端點：
 *   - POST /api/rules/[id]/test - 啟動批次測試任務
 *
 * @module src/app/api/rules/[id]/test/route
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/services/rule-testing.service - 規則測試服務
 *   - @/types/rule-test - 類型定義
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/app/api/test-tasks/[taskId]/route.ts - 任務狀態查詢
 *   - src/services/rule-testing.service.ts - 測試服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/types/permissions'
import { createTestTask } from '@/services/rule-testing.service'
import { testConfigSchema } from '@/types/rule-test'

// ============================================================
// Validation Schema
// ============================================================

/**
 * 啟動測試請求驗證 Schema
 */
const startTestSchema = z.object({
  testPattern: z.unknown(),
  config: testConfigSchema,
})

// ============================================================
// Helper Functions
// ============================================================

/**
 * 檢查用戶是否有規則管理權限
 */
function hasRuleManagePermission(
  roles: { permissions: string[] }[] | undefined
): boolean {
  if (!roles) return false
  return roles.some((r) => r.permissions.includes(PERMISSIONS.RULE_MANAGE))
}

// ============================================================
// POST /api/rules/[id]/test
// ============================================================

/**
 * POST /api/rules/[id]/test
 * 啟動規則批次測試任務
 *
 * @description
 *   Story 5-4: 測試規則變更效果
 *   建立非同步測試任務，比較新舊規則在歷史文件上的效果
 *
 * @param request - Next.js 請求物件
 * @param params - 路由參數，包含規則 ID
 *
 * @body StartRuleTestRequest
 *   - testPattern: 要測試的新規則模式
 *   - config: 測試配置（範圍、數量等）
 *
 * @returns 測試任務資訊
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
          type: 'https://api.example.com/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: '請先登入',
        },
        { status: 401 }
      )
    }

    // 2. 權限檢查
    if (!hasRuleManagePermission(session.user.roles)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: '需要 RULE_MANAGE 權限',
        },
        { status: 403 }
      )
    }

    // 3. 驗證規則 ID 格式
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(ruleId).success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的規則 ID 格式',
        },
        { status: 400 }
      )
    }

    // 4. 解析並驗證請求體
    const body = await request.json()
    const validation = startTestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '無效的請求內容',
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { testPattern, config } = validation.data

    // 5. 查詢規則
    const rule = await prisma.mappingRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        fieldName: true,
        fieldLabel: true,
        forwarderId: true,
        extractionPattern: true,
      },
    })

    if (!rule) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: '找不到指定的規則',
        },
        { status: 404 }
      )
    }

    // 6. 建立測試任務
    // 注意：createTestTask 內部會自動獲取 forwarderId 和 originalPattern
    // 並且會異步啟動測試執行
    const result = await createTestTask({
      ruleId,
      testPattern: testPattern as Record<string, unknown>,
      config,
      createdById: session.user.id,
    })

    // 7. 返回響應
    return NextResponse.json(
      {
        success: true,
        data: {
          taskId: result.taskId,
          status: 'PENDING',
          estimatedDocuments: result.estimatedDocuments,
          message: `測試任務已建立，將測試 ${result.estimatedDocuments} 份文件`,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error starting rule test:', error)
    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: '啟動測試任務時發生錯誤',
      },
      { status: 500 }
    )
  }
}
