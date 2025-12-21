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
 *   - 響應時間
 *
 * @module src/app/api/health/route
 * @author Development Team
 * @since Epic 1 - Story 1.2 (User Database & Role Foundation)
 * @lastModified 2025-12-21
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
  responseTime: number
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
  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  const uptime = process.uptime()

  try {
    // 檢查資料庫連接
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Date.now() - startTime

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp,
        uptime,
        responseTime,
        services: {
          database: 'connected',
        },
        version: process.env.npm_package_version || '1.0.0',
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  } catch (error) {
    console.error('Health check failed:', error)
    const responseTime = Date.now() - startTime

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        uptime,
        responseTime,
        services: {
          database: 'disconnected',
        },
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  }
}
