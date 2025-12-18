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
 *
 * @module src/lib/prisma
 * @author Development Team
 * @since Epic 1 - Story 1.0 (Project Init Foundation)
 * @lastModified 2025-12-17
 *
 * @features
 *   - 開發環境熱重載支援
 *   - 環境感知的日誌配置
 *   - 類型安全的客戶端導出
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *
 * @related
 *   - prisma/schema.prisma - 資料庫 Schema 定義
 *   - src/app/api/ - API 路由（使用此客戶端）
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
