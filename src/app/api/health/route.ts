/**
 * @fileoverview 健康檢查 API 端點
 * @description
 *   提供系統健康狀態檢查的 API。
 *   不需要認證，用於監控和負載均衡器健康探測。
 *
 *   檢查項目：
 *   - 資料庫連接狀態
 *   - 系統版本資訊
 *   - 服務運行時間
 *
 * @module src/app/api/health/route
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/prisma - Prisma 客戶端
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * 健康狀態響應類型
 */
interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  uptime: number
  services: {
    database: 'connected' | 'disconnected'
  }
  version?: string
}

/**
 * GET /api/health
 * 健康檢查端點（無需認證）
 *
 * @returns 系統健康狀態
 *
 * @example
 *   GET /api/health
 *   // Response: { status: 'healthy', services: { database: 'connected' }, ... }
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const timestamp = new Date().toISOString()
  const uptime = process.uptime()

  try {
    // 檢查資料庫連接
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'healthy',
      timestamp,
      uptime,
      services: {
        database: 'connected',
      },
      version: process.env.npm_package_version || '1.0.0',
    })
  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        uptime,
        services: {
          database: 'disconnected',
        },
      },
      { status: 503 }
    )
  }
}
