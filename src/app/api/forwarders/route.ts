/**
 * @fileoverview Forwarder API 端點
 * @description
 *   提供 Forwarder 相關的 RESTful API。
 *   需要認證和 FORWARDER_VIEW/FORWARDER_MANAGE 權限才能存取。
 *
 *   端點：
 *   - GET /api/forwarders - 獲取 Forwarder 列表（支援分頁、搜尋、篩選、排序）
 *   - POST /api/forwarders - 創建新的 Forwarder (Story 5.5)
 *
 *   查詢參數（GET）：
 *   - search: 搜尋關鍵字（name, code, displayName）
 *   - isActive: 狀態篩選 (true/false)
 *   - page: 頁碼（預設 1）
 *   - limit: 每頁數量（預設 10，最大 100）
 *   - sortBy: 排序欄位 (name/code/updatedAt/createdAt/priority/ruleCount)
 *   - sortOrder: 排序方向 (asc/desc，預設 desc)
 *
 * @module src/app/api/forwarders/route
 * @author Development Team
 * @since Epic 2 - Story 2.3 (Forwarder Auto-Identification)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 分頁查詢
 *   - 關鍵字搜尋
 *   - 狀態篩選
 *   - 多欄位排序
 *   - 規則數量統計
 *   - Story 5.5: 創建 Forwarder（含 Logo 上傳）
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/types/forwarder - 類型定義
 *   - @/lib/azure-blob - Azure Blob Storage (Story 5.5)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getForwardersFromQuery,
  createForwarder,
  forwarderCodeExists,
  forwarderNameExists,
} from '@/services/forwarder.service'
import { ForwardersQuerySchema, CreateForwarderSchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { uploadToBlob, isBlobStorageConfigured } from '@/lib/azure-blob'
import { forwarderIdentifier } from '@/services/forwarder-identifier'

/**
 * GET /api/forwarders
 * 獲取 Forwarder 列表
 *
 * @description
 *   支援分頁、搜尋、篩選、排序的 Forwarder 列表查詢。
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @returns Forwarder 列表和分頁資訊
 *
 * @example
 *   GET /api/forwarders
 *   GET /api/forwarders?search=DHL&isActive=true&page=1&limit=10
 *   GET /api/forwarders?sortBy=name&sortOrder=asc
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
 *         "isActive": true,
 *         "priority": 100,
 *         "ruleCount": 25,
 *         "updatedAt": "2025-12-19T10:00:00Z",
 *         "createdAt": "2025-01-01T00:00:00Z"
 *       }
 *     ],
 *     "meta": {
 *       "pagination": {
 *         "page": 1,
 *         "limit": 10,
 *         "total": 15,
 *         "totalPages": 2
 *       }
 *     }
 *   }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 驗證認證狀態
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

    // 2. 驗證權限
    const canView = hasPermission(session.user, PERMISSIONS.FORWARDER_VIEW)
    if (!canView) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'You do not have permission to view forwarders',
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析查詢參數
    const { searchParams } = new URL(request.url)
    const queryParams = {
      search: searchParams.get('search') || undefined,
      isActive: searchParams.get('isActive') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    }

    // 4. 驗證查詢參數
    const validationResult = ForwardersQuerySchema.safeParse(queryParams)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid query parameters',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 5. 獲取 Forwarder 列表
    const result = await getForwardersFromQuery(validationResult.data)

    // 6. 返回成功響應
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: {
        pagination: result.pagination,
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

/**
 * POST /api/forwarders
 * 創建新的 Forwarder
 *
 * @description
 *   創建新的 Forwarder，支援 Logo 上傳。
 *   需要 FORWARDER_MANAGE 權限。
 *   使用 FormData 格式，支援文件上傳。
 *
 * @param request - HTTP 請求（FormData 格式）
 * @returns 新創建的 Forwarder 資訊
 *
 * @example
 *   POST /api/forwarders
 *   Content-Type: multipart/form-data
 *
 *   FormData:
 *   - name: "DHL Express"
 *   - code: "DHL"
 *   - description: "國際快遞服務商"
 *   - contactEmail: "contact@dhl.com"
 *   - defaultConfidence: "0.85"
 *   - logo: File (optional)
 *
 *   Response (201):
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "xxx",
 *       "name": "DHL Express",
 *       "code": "DHL",
 *       "status": "PENDING"
 *     }
 *   }
 *
 * @since Epic 5 - Story 5.5
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 驗證認證狀態
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

    // 2. 驗證權限
    const canManage = hasPermission(session.user, PERMISSIONS.FORWARDER_MANAGE)
    if (!canManage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'You do not have permission to create forwarders',
          },
        },
        { status: 403 }
      )
    }

    // 3. 解析 FormData
    const formData = await request.formData()
    const logoFile = formData.get('logo') as File | null

    const inputData = {
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      description: formData.get('description') as string | null,
      contactEmail: formData.get('contactEmail') as string | null,
      defaultConfidence: formData.get('defaultConfidence')
        ? parseFloat(formData.get('defaultConfidence') as string)
        : 0.8,
    }

    // 4. 驗證輸入數據
    const validationResult = CreateForwarderSchema.safeParse(inputData)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid forwarder data',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data

    // 5. 檢查 Code 唯一性
    const codeExists = await forwarderCodeExists(validatedData.code)
    if (codeExists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: `Forwarder code "${validatedData.code}" already exists`,
            errors: {
              code: ['This code is already in use'],
            },
          },
        },
        { status: 409 }
      )
    }

    // 6. 檢查 Name 唯一性
    const nameExists = await forwarderNameExists(validatedData.name)
    if (nameExists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: `Forwarder name "${validatedData.name}" already exists`,
            errors: {
              name: ['This name is already in use'],
            },
          },
        },
        { status: 409 }
      )
    }

    // 7. 上傳 Logo（如果提供）
    let logoUrl: string | null = null
    if (logoFile && logoFile.size > 0) {
      if (!isBlobStorageConfigured()) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/service-unavailable',
              title: 'Service Unavailable',
              status: 503,
              detail: 'Logo upload service is not configured',
            },
          },
          { status: 503 }
        )
      }

      try {
        logoUrl = await uploadToBlob(logoFile, 'forwarder-logos/logos')
      } catch (uploadError) {
        console.error('Logo upload failed:', uploadError)
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'https://api.example.com/errors/upload-failed',
              title: 'Upload Failed',
              status: 500,
              detail: 'Failed to upload logo file',
            },
          },
          { status: 500 }
        )
      }
    }

    // 8. 創建 Forwarder
    const forwarder = await createForwarder({
      name: validatedData.name,
      code: validatedData.code,
      description: validatedData.description || null,
      contactEmail: validatedData.contactEmail || null,
      defaultConfidence: validatedData.defaultConfidence,
      logoUrl,
      createdById: session.user.id,
    })

    // 9. 創建審計日誌
    await prisma.auditLog.create({
      data: {
        action: 'FORWARDER_CREATED',
        entityType: 'Forwarder',
        entityId: forwarder.id,
        userId: session.user.id,
        details: {
          forwarderName: forwarder.name,
          forwarderCode: forwarder.code,
          hasLogo: !!logoUrl,
        },
      },
    })

    // 10. 失效 Forwarder 快取（確保所有城市取得最新列表）
    await forwarderIdentifier.invalidateCache()

    // 11. 返回成功響應
    return NextResponse.json(
      {
        success: true,
        data: forwarder,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create forwarder error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to create forwarder',
        },
      },
      { status: 500 }
    )
  }
}
