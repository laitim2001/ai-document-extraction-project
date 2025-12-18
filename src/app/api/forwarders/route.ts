/**
 * @fileoverview Forwarder API 端點
 * @description
 *   提供 Forwarder 相關的 RESTful API。
 *   需要認證才能存取。
 *
 *   端點：
 *   - GET /api/forwarders - 獲取所有活躍 Forwarder 列表
 *
 * @module src/app/api/forwarders/route
 * @author Development Team
 * @since Epic 2 - Story 2.3 (Forwarder Auto-Identification)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/forwarders
 * 獲取所有活躍 Forwarder 列表
 *
 * @returns Forwarder 列表（按優先級和名稱排序）
 *
 * @example
 *   GET /api/forwarders
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": [
 *       {
 *         "id": "xxx",
 *         "code": "DHL",
 *         "name": "DHL Express",
 *         "displayName": "DHL Express",
 *         "priority": 100
 *       }
 *     ],
 *     "meta": {
 *       "total": 15
 *     }
 *   }
 */
export async function GET() {
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

    // 獲取所有活躍 Forwarder（排除 UNKNOWN）
    const forwarders = await prisma.forwarder.findMany({
      where: {
        isActive: true,
        code: { not: 'UNKNOWN' },
      },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        priority: true,
      },
    })

    // 計算總數
    const total = forwarders.length

    return NextResponse.json({
      success: true,
      data: forwarders,
      meta: {
        total,
      },
    })
  } catch (error) {
    console.error('Get forwarders error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch forwarders',
        },
      },
      { status: 500 }
    )
  }
}
