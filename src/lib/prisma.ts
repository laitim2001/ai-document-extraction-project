/**
 * @fileoverview Prisma 資料庫客戶端單例配置
 * @description
 *   本模組配置 Prisma 客戶端，確保在開發環境中不會創建多個資料庫連接。
 *   採用全局單例模式，避免 Next.js 熱重載時產生連接洩漏問題。
 *
 *   設計考量：
 *   - 開發環境：將客戶端存儲在 globalThis 中以跨熱重載保持連接
 *   - 生產環境：每次創建新實例，由進程管理生命週期
 *   - 日誌級別：開發時輸出查詢日誌，生產僅輸出錯誤
 *   - Prisma 7.x：使用 driver adapter 進行資料庫連接
 *
 * @module src/lib/prisma
 * @author Development Team
 * @since Epic 1 - Story 1.0 (Project Init Foundation)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 開發環境熱重載支援
 *   - 環境感知的日誌配置
 *   - 類型安全的客戶端導出
 *   - Prisma 7.x driver adapter 支援
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @prisma/adapter-pg - PostgreSQL driver adapter
 *   - pg - PostgreSQL 客戶端
 *
 * @related
 *   - prisma/schema.prisma - 資料庫 Schema 定義
 *   - src/app/api/ - API 路由（使用此客戶端）
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * 創建 Prisma 客戶端實例
 * Prisma 7.x 需要使用 driver adapter
 */
function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
