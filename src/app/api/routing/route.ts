/**
 * @fileoverview 文件路由 API 端點
 * @description
 *   提供文件路由相關操作：
 *   - POST /api/routing - 路由文件到適當的處理路徑
 *
 *   ## 路由規則
 *
 *   | 信心度 | 處理路徑 | 說明 |
 *   |--------|---------|------|
 *   | ≥95% | AUTO_APPROVE | 自動通過 |
 *   | 80-94% | QUICK_REVIEW | 快速確認 |
 *   | <80% | FULL_REVIEW | 完整審核 |
 *   | 特殊 | MANUAL_REQUIRED | 需人工處理 |
 *
 * @module src/app/api/routing/route
 * @since Epic 2 - Story 2.6 (Processing Path Auto Routing)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/routing.service - 路由服務
 *   - zod - 請求驗證
 *
 * @related
 *   - src/services/routing.service.ts - 路由業務邏輯
 *   - src/lib/routing/ - 路由配置和邏輯
 *   - src/types/routing.ts - 路由類型定義
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { routeDocument, batchRouteDocuments } from '@/services/routing.service'

// ============================================================
// Validation Schemas
// ============================================================

/**
 * 單一文件路由請求驗證
 */
const routeDocumentSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
})

/**
 * 批量文件路由請求驗證
 */
const batchRouteSchema = z.object({
  documentIds: z
    .array(z.string().uuid('Invalid document ID format'))
    .min(1, 'At least one document ID is required')
    .max(50, 'Maximum 50 documents per batch'),
})

/**
 * 請求驗證 - 支援單一或批量
 */
const requestSchema = z.union([routeDocumentSchema, batchRouteSchema])

// ============================================================
// POST /api/routing - 路由文件
// ============================================================

/**
 * 路由文件到適當的處理路徑
 *
 * @description
 *   根據文件的信心度分數決定處理路徑：
 *   1. 獲取文件的信心度結果
 *   2. 根據閾值決定處理路徑
 *   3. 計算隊列優先級
 *   4. 更新文件狀態和隊列
 *   5. 記錄審計日誌
 *
 *   支援單一文件或批量處理（最多 50 個）
 *
 * @param body.documentId - 單一文件 ID
 * @param body.documentIds - 批量文件 ID 列表
 * @returns 路由決策結果
 *
 * @example
 *   // 單一文件
 *   POST /api/routing
 *   { "documentId": "doc-123" }
 *
 *   // 批量處理
 *   POST /api/routing
 *   { "documentIds": ["doc-123", "doc-456"] }
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證認證狀態
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }

    // 解析請求體
    const body = await request.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid request parameters',
            errors: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // 判斷是單一還是批量
    if ('documentId' in data) {
      // 單一文件路由
      const decision = await routeDocument(data.documentId)

      return NextResponse.json({
        success: true,
        data: {
          documentId: data.documentId,
          decision,
        },
      })
    } else {
      // 批量文件路由
      const results = await batchRouteDocuments(data.documentIds)

      // 轉換 Map 為可序列化格式
      const resultsObject: Record<
        string,
        { success: boolean; decision?: unknown; error?: string }
      > = {}

      for (const [id, result] of results) {
        if (result instanceof Error) {
          resultsObject[id] = {
            success: false,
            error: result.message,
          }
        } else {
          resultsObject[id] = {
            success: true,
            decision: result,
          }
        }
      }

      // 計算統計
      const successCount = Object.values(resultsObject).filter((r) => r.success).length
      const failCount = data.documentIds.length - successCount

      return NextResponse.json({
        success: true,
        data: {
          results: resultsObject,
          summary: {
            total: data.documentIds.length,
            success: successCount,
            failed: failCount,
          },
        },
      })
    }
  } catch (error) {
    console.error('[RoutingAPI] POST error:', error)

    // 特定錯誤處理
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/not-found',
              title: 'Not Found',
              status: 404,
              detail: error.message,
            },
          },
          { status: 404 }
        )
      }

      if (error.message.includes('confidence')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/precondition-failed',
              title: 'Precondition Failed',
              status: 412,
              detail: error.message,
            },
          },
          { status: 412 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: error instanceof Error ? error.message : 'Failed to route document',
        },
      },
      { status: 500 }
    )
  }
}
