/**
 * @fileoverview RLS Context Manager for Prisma
 * @description
 *   本模組提供 Row Level Security (RLS) 上下文管理，
 *   確保資料庫查詢自動根據用戶的城市權限進行過濾。
 *
 *   設計考量：
 *   - 使用 PostgreSQL session variables 設置 RLS 上下文
 *   - 支援 Global Admin 繞過所有限制
 *   - 支援 Regional Manager 跨城市訪問
 *   - 提供 withServiceRole 繞過 RLS 的方法
 *
 * @module src/lib/db-context
 * @author Development Team
 * @since Epic 6 - Story 6.1 (City Data Model and RLS Configuration)
 * @lastModified 2025-12-19
 *
 * @features
 *   - RLS 上下文自動設置
 *   - 城市權限過濾
 *   - 服務角色繞過支援
 *   - 背景任務專用上下文
 *
 * @dependencies
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/lib/prisma - 基礎 Prisma 客戶端
 *
 * @related
 *   - src/lib/prisma.ts - 基礎 Prisma 客戶端
 *   - src/services/city-access.service.ts - 城市權限服務
 *   - prisma/migrations/20251219010000_add_multi_city_support - RLS 策略
 */

import { PrismaClient } from '@prisma/client'
import { prisma as basePrisma } from '@/lib/prisma'

// ============================================================
// Types
// ============================================================

/**
 * RLS 上下文介面
 * 定義設置 PostgreSQL session variables 所需的資訊
 */
export interface RlsContext {
  /** 是否為全域管理員（繞過所有 RLS 限制） */
  isGlobalAdmin: boolean
  /** 用戶可存取的城市代碼列表 */
  cityCodes: string[]
  /** 用戶 ID（用於日誌追蹤） */
  userId?: string
}

/**
 * 繞過 RLS 的上下文（Global Admin 模式）
 */
export const SERVICE_ROLE_CONTEXT: RlsContext = {
  isGlobalAdmin: true,
  cityCodes: [],
  userId: 'system',
}

// ============================================================
// RLS Context Functions
// ============================================================

/**
 * 設置 PostgreSQL session variables 以啟用 RLS
 *
 * @description
 *   使用 set_config 設置以下 session variables:
 *   - app.is_global_admin: 是否為全域管理員
 *   - app.user_city_codes: 用戶可存取的城市代碼（逗號分隔）
 *
 *   這些變數會被 RLS 策略中的 user_has_city_access() 函數讀取
 *
 * @param prismaClient - Prisma 客戶端實例
 * @param context - RLS 上下文
 */
export async function setRlsContext(
  prismaClient: PrismaClient,
  context: RlsContext
): Promise<void> {
  const isGlobalAdmin = context.isGlobalAdmin ? 'true' : 'false'
  const cityCodes = context.cityCodes.join(',')

  await prismaClient.$executeRawUnsafe(`
    SELECT
      set_config('app.is_global_admin', '${isGlobalAdmin}', true),
      set_config('app.user_city_codes', '${cityCodes}', true)
  `)
}

/**
 * 清除 RLS 上下文
 *
 * @description
 *   重置所有 RLS 相關的 session variables。
 *   通常在請求結束或錯誤處理時調用。
 *
 * @param prismaClient - Prisma 客戶端實例
 */
export async function clearRlsContext(
  prismaClient: PrismaClient
): Promise<void> {
  await prismaClient.$executeRawUnsafe(`
    SELECT
      set_config('app.is_global_admin', 'false', true),
      set_config('app.user_city_codes', '', true)
  `)
}

// ============================================================
// Context-Aware Operations
// ============================================================

/**
 * 在特定 RLS 上下文中執行操作
 *
 * @description
 *   此函數創建一個新的 Prisma 客戶端連接，
 *   設置 RLS 上下文，執行操作，然後斷開連接。
 *
 *   適用場景：
 *   - 背景任務需要特定城市權限
 *   - API 端點需要模擬其他用戶權限
 *
 * @example
 * ```typescript
 * const documents = await withRlsContext(
 *   { isGlobalAdmin: false, cityCodes: ['HKG', 'SIN'] },
 *   async (tx) => {
 *     return await tx.document.findMany();
 *   }
 * );
 * ```
 *
 * @param context - RLS 上下文
 * @param operation - 要執行的操作函數
 * @returns 操作的返回值
 */
export async function withRlsContext<T>(
  context: RlsContext,
  operation: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  // 設置 RLS 上下文
  await setRlsContext(basePrisma as PrismaClient, context)

  try {
    // 執行操作
    return await operation(basePrisma as PrismaClient)
  } finally {
    // 清除上下文
    await clearRlsContext(basePrisma as PrismaClient)
  }
}

/**
 * 以服務角色執行操作（繞過 RLS）
 *
 * @description
 *   使用 Global Admin 權限執行操作，繞過所有 RLS 限制。
 *
 *   適用場景：
 *   - 系統背景任務（如清理過期權限）
 *   - 權限檢查服務（需要跨城市查詢）
 *   - 管理員操作（如分配城市權限）
 *
 * @example
 * ```typescript
 * const allDocuments = await withServiceRole(async (tx) => {
 *   return await tx.document.findMany();
 * });
 * ```
 *
 * @param operation - 要執行的操作函數
 * @returns 操作的返回值
 */
export async function withServiceRole<T>(
  operation: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return withRlsContext(SERVICE_ROLE_CONTEXT, operation)
}

/**
 * 創建帶有 RLS 上下文的 Prisma 客戶端包裝器
 *
 * @description
 *   返回一個包裝過的 Prisma 客戶端，每次查詢前都會自動設置 RLS 上下文。
 *
 *   注意：此方法主要用於開發調試，生產環境建議使用 withRlsContext。
 *
 * @param context - RLS 上下文
 * @returns 包裝過的 Prisma 客戶端
 */
export function createContextualPrisma(context: RlsContext): PrismaClient {
  // 使用 Proxy 攔截所有模型訪問
  return new Proxy(basePrisma as PrismaClient, {
    get(target, prop) {
      const value = target[prop as keyof PrismaClient]

      // 如果是模型訪問，包裝其方法
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, {
          get(modelTarget, modelProp) {
            const modelMethod = modelTarget[modelProp as keyof typeof modelTarget]

            // 如果是查詢方法，在執行前設置上下文
            if (typeof modelMethod === 'function') {
              return async (...args: unknown[]) => {
                await setRlsContext(target, context)
                try {
                  return await (modelMethod as (...args: unknown[]) => Promise<unknown>).apply(modelTarget, args)
                } finally {
                  await clearRlsContext(target)
                }
              }
            }

            return modelMethod
          },
        })
      }

      return value
    },
  })
}

// ============================================================
// Exports
// ============================================================

export { basePrisma as prisma }
