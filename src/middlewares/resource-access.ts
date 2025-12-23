/**
 * @fileoverview 資源訪問驗證中間件
 * @description
 *   提供特定資源的城市訪問驗證功能：
 *   - 驗證用戶對特定資源的訪問權限
 *   - 記錄未授權訪問嘗試
 *   - 提供 API middleware wrapper
 *
 *   ## 資源類型支援
 *   - Document: 文件
 *   - Escalation: 升級案例
 *   - Correction: 修正記錄
 *   - Extraction: 提取結果
 *
 * @module src/middleware/resource-access
 * @author Development Team
 * @since Epic 6 - Story 6.2 (City User Data Access Control)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/lib/prisma - Prisma 客戶端
 *   - @/services/security-log - 安全日誌服務
 *
 * @related
 *   - src/middleware/city-filter.ts - 城市過濾中間件
 *   - src/services/security-log.ts - 安全日誌服務
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIp } from './city-filter'

// ===========================================
// Types
// ===========================================

/**
 * 支援的資源類型
 */
export type ResourceType =
  | 'document'
  | 'escalation'
  | 'correction'
  | 'extraction'
  | 'forwarder'
  | 'mappingRule'

/**
 * 資源訪問驗證結果
 */
export interface ResourceAccessResult {
  /** 是否允許訪問 */
  allowed: boolean
  /** 資源的城市代碼 */
  cityCode: string | null
  /** 資源是否存在 */
  resourceExists: boolean
}

/**
 * 資源城市資訊
 */
interface ResourceCityInfo {
  exists: boolean
  cityCode: string | null
}

// ===========================================
// validateResourceAccess Function
// ===========================================

/**
 * 驗證用戶對特定資源的訪問權限
 *
 * @description
 *   檢查用戶是否有權訪問指定的資源：
 *   - 全球管理員可訪問所有資源
 *   - 一般用戶只能訪問其授權城市的資源
 *   - 未授權訪問會被記錄到安全日誌
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @param request - Next.js 請求對象（用於提取 IP 等資訊）
 * @returns 訪問驗證結果
 *
 * @example
 *   const access = await validateResourceAccess('document', 'doc-123', request)
 *   if (!access.allowed) {
 *     return NextResponse.json({ error: 'Access denied' }, { status: 403 })
 *   }
 */
export async function validateResourceAccess(
  resourceType: ResourceType,
  resourceId: string,
  request?: NextRequest
): Promise<ResourceAccessResult> {
  const session = await auth()

  // 未認證
  if (!session?.user) {
    return { allowed: false, cityCode: null, resourceExists: false }
  }

  // 全球管理員有完整訪問權限
  if (session.user.isGlobalAdmin) {
    const exists = await checkResourceExists(resourceType, resourceId)
    return { allowed: exists, cityCode: null, resourceExists: exists }
  }

  // 獲取資源的城市代碼
  const resourceInfo = await getResourceCityCode(resourceType, resourceId)

  if (!resourceInfo.exists) {
    return { allowed: false, cityCode: null, resourceExists: false }
  }

  // 檢查用戶是否有權訪問該城市
  const userCityCodes = session.user.cityCodes || []
  const allowed =
    resourceInfo.cityCode !== null &&
    userCityCodes.includes(resourceInfo.cityCode)

  // 記錄未授權訪問嘗試
  if (!allowed && resourceInfo.cityCode) {
    // 延遲導入以避免循環依賴
    const { SecurityLogService } = await import('@/services/security-log')
    await SecurityLogService.logUnauthorizedAccess({
      userId: session.user.id,
      resourceType,
      resourceId,
      resourceCityCode: resourceInfo.cityCode,
      userCityCodes,
      ipAddress: getClientIp(request),
      userAgent: request?.headers.get('user-agent') || undefined,
      requestPath: request?.nextUrl.pathname,
    })
  }

  return {
    allowed,
    cityCode: resourceInfo.cityCode,
    resourceExists: true,
  }
}

// ===========================================
// getResourceCityCode Function
// ===========================================

/**
 * 獲取資源的城市代碼
 *
 * @description
 *   根據資源類型查詢對應的城市代碼。
 *   對於關聯資源（如 Escalation），會透過關聯查詢到 Document 的城市代碼。
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @returns 資源是否存在及其城市代碼
 */
async function getResourceCityCode(
  resourceType: ResourceType,
  resourceId: string
): Promise<ResourceCityInfo> {
  try {
    switch (resourceType) {
      case 'document': {
        const doc = await prisma.document.findUnique({
          where: { id: resourceId },
          select: { cityCode: true },
        })
        return { exists: !!doc, cityCode: doc?.cityCode || null }
      }

      case 'escalation': {
        const escalation = await prisma.escalation.findUnique({
          where: { id: resourceId },
          include: {
            document: { select: { cityCode: true } },
          },
        })
        return {
          exists: !!escalation,
          cityCode: escalation?.document?.cityCode || null,
        }
      }

      case 'correction': {
        const correction = await prisma.correction.findUnique({
          where: { id: resourceId },
          include: {
            document: { select: { cityCode: true } },
          },
        })
        return {
          exists: !!correction,
          cityCode: correction?.document?.cityCode || null,
        }
      }

      case 'extraction': {
        const extraction = await prisma.extractionResult.findUnique({
          where: { id: resourceId },
          include: {
            document: { select: { cityCode: true } },
          },
        })
        return {
          exists: !!extraction,
          cityCode: extraction?.document?.cityCode || null,
        }
      }

      case 'forwarder': {
        // REFACTOR-001: Company 是全域資源，沒有城市限制（原 Forwarder）
        const company = await prisma.company.findUnique({
          where: { id: resourceId },
          select: { id: true },
        })
        return { exists: !!company, cityCode: null }
      }

      case 'mappingRule': {
        // MappingRule 是全域資源，沒有城市限制
        const rule = await prisma.mappingRule.findUnique({
          where: { id: resourceId },
          select: { id: true },
        })
        return { exists: !!rule, cityCode: null }
      }

      default:
        return { exists: false, cityCode: null }
    }
  } catch {
    return { exists: false, cityCode: null }
  }
}

// ===========================================
// checkResourceExists Function
// ===========================================

/**
 * 檢查資源是否存在
 *
 * @param resourceType - 資源類型
 * @param resourceId - 資源 ID
 * @returns 資源是否存在
 */
async function checkResourceExists(
  resourceType: ResourceType,
  resourceId: string
): Promise<boolean> {
  const info = await getResourceCityCode(resourceType, resourceId)
  return info.exists
}

// ===========================================
// withResourceAccess Middleware Wrapper
// ===========================================

/**
 * 資源訪問驗證中間件包裝器
 *
 * @description
 *   包裝 API handler 以自動驗證資源訪問權限：
 *   - 資源不存在時返回 404
 *   - 無權訪問時返回 403
 *   - 驗證通過後執行原始 handler
 *
 * @param resourceType - 資源類型
 * @param getResourceId - 從路由參數中提取資源 ID 的函數
 * @returns 中間件包裝函數
 *
 * @example
 *   export const GET = withResourceAccess(
 *     'document',
 *     (params) => params.id
 *   )(async (request, params) => {
 *     // 這裡的代碼只在資源存在且用戶有權訪問時執行
 *     const document = await prisma.document.findUnique(...)
 *     return NextResponse.json({ data: document })
 *   })
 */
export function withResourceAccess(
  resourceType: ResourceType,
  getResourceId: (params: Record<string, string>) => string
) {
  return function <T extends Record<string, string>>(
    handler: (request: NextRequest, params: T) => Promise<NextResponse>
  ) {
    return async (request: NextRequest, context: { params: T }) => {
      const resourceId = getResourceId(context.params)

      const access = await validateResourceAccess(
        resourceType,
        resourceId,
        request
      )

      if (!access.resourceExists) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/not-found',
              title: 'Resource not found',
              status: 404,
              detail: `找不到指定的 ${resourceType}`,
            },
          },
          { status: 404 }
        )
      }

      if (!access.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/access-denied',
              title: 'Access denied',
              status: 403,
              detail: '您沒有權限訪問此資源',
            },
          },
          { status: 403 }
        )
      }

      return handler(request, context.params)
    }
  }
}

// ===========================================
// Export index file for middleware
// ===========================================

export { getClientIp } from './city-filter'
