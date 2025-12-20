/**
 * @fileoverview Forwarder 詳情 API 端點
 * @description
 *   提供單一 Forwarder 的詳情查詢和更新 API。
 *   需要認證和 FORWARDER_VIEW/FORWARDER_MANAGE 權限才能存取。
 *
 *   端點：
 *   - GET /api/forwarders/[id] - 獲取 Forwarder 詳情（含統計、規則摘要、近期文件）
 *   - PUT /api/forwarders/[id] - 更新 Forwarder 資訊（Story 5.5）
 *
 * @module src/app/api/forwarders/[id]/route
 * @author Development Team
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-19
 *
 * @features
 *   - Forwarder 基本資訊
 *   - 規則摘要（按狀態分組）
 *   - 處理統計（成功率、信心度、趨勢）
 *   - 近期文件列表
 *   - Story 5.5: 更新 Forwarder（含 Logo 上傳）
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/forwarder.service - Forwarder 服務
 *   - @/types/forwarder - 類型定義
 *   - @/lib/azure-blob - Azure Blob Storage (Story 5.5)
 *   - @/lib/prisma - Prisma Client (Story 5.5)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getForwarderDetailView,
  updateForwarder,
  getForwarderById,
  forwarderNameExists,
} from '@/services/forwarder.service'
import { ForwarderIdSchema, UpdateForwarderSchema } from '@/types/forwarder'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { uploadToBlob, deleteFromBlob, isBlobStorageConfigured } from '@/lib/azure-blob'

/**
 * GET /api/forwarders/[id]
 * 獲取 Forwarder 詳情
 *
 * @description
 *   獲取單一 Forwarder 的完整詳情，包含：
 *   - 基本資訊（名稱、代碼、狀態等）
 *   - 識別模式
 *   - 規則摘要（按狀態分組的數量）
 *   - 處理統計（成功率、平均信心度、30 天趨勢）
 *   - 近期文件列表（最多 10 筆）
 *
 *   需要 FORWARDER_VIEW 權限。
 *
 * @param request - HTTP 請求
 * @param context - 路由參數（包含 id）
 * @returns Forwarder 詳情
 *
 * @example
 *   GET /api/forwarders/cuid123
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "cuid123",
 *       "name": "DHL Express",
 *       "code": "DHL",
 *       "displayName": "DHL Express",
 *       "isActive": true,
 *       "priority": 100,
 *       "ruleCount": 25,
 *       "documentCount": 1500,
 *       "identificationPatterns": [...],
 *       "rulesSummary": {
 *         "total": 25,
 *         "byStatus": { "active": 20, "draft": 3, "pendingReview": 2, "deprecated": 0 }
 *       },
 *       "stats": {
 *         "totalDocuments": 1500,
 *         "processedLast30Days": 150,
 *         "successRate": 92,
 *         "avgConfidence": 87,
 *         "dailyTrend": [...]
 *       },
 *       "recentDocuments": [...]
 *     }
 *   }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 3. 獲取並驗證路由參數
    const resolvedParams = await params
    const validationResult = ForwarderIdSchema.safeParse({ id: resolvedParams.id })

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid forwarder ID',
            errors: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // 4. 獲取 Forwarder 詳情
    const forwarder = await getForwarderDetailView(validationResult.data.id)

    if (!forwarder) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Forwarder with ID '${validationResult.data.id}' not found`,
            instance: `/api/forwarders/${validationResult.data.id}`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 返回成功響應
    return NextResponse.json({
      success: true,
      data: forwarder,
    })
  } catch (error) {
    console.error('Get forwarder detail error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to fetch forwarder details',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/forwarders/[id]
 * 更新 Forwarder 資訊
 *
 * @description
 *   更新 Forwarder 的基本資訊，支援 Logo 上傳和更新。
 *   需要 FORWARDER_MANAGE 權限。
 *   使用 FormData 格式，支援文件上傳。
 *
 * @param request - HTTP 請求（FormData 格式）
 * @param context - 路由參數（包含 id）
 * @returns 更新後的 Forwarder 資訊
 *
 * @example
 *   PUT /api/forwarders/cuid123
 *   Content-Type: multipart/form-data
 *
 *   FormData:
 *   - name: "DHL Express Updated"
 *   - description: "更新後的描述"
 *   - contactEmail: "new@dhl.com"
 *   - defaultConfidence: "0.9"
 *   - logo: File (optional)
 *   - removeLogo: "true" (optional, 移除現有 Logo)
 *
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "cuid123",
 *       "name": "DHL Express Updated",
 *       "code": "DHL",
 *       "status": "ACTIVE"
 *     }
 *   }
 *
 * @since Epic 5 - Story 5.5
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
            detail: 'You do not have permission to update forwarders',
          },
        },
        { status: 403 }
      )
    }

    // 3. 獲取並驗證路由參數
    const resolvedParams = await params
    const idValidation = ForwarderIdSchema.safeParse({ id: resolvedParams.id })

    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'Invalid forwarder ID',
            errors: idValidation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const forwarderId = idValidation.data.id

    // 4. 檢查 Forwarder 是否存在
    const existingForwarder = await getForwarderById(forwarderId)
    if (!existingForwarder) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'https://api.example.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Forwarder with ID '${forwarderId}' not found`,
            instance: `/api/forwarders/${forwarderId}`,
          },
        },
        { status: 404 }
      )
    }

    // 5. 解析 FormData
    const formData = await request.formData()
    const logoFile = formData.get('logo') as File | null
    const removeLogo = formData.get('removeLogo') === 'true'

    const inputData = {
      name: formData.get('name') as string | undefined,
      description: formData.get('description') as string | null | undefined,
      contactEmail: formData.get('contactEmail') as string | null | undefined,
      defaultConfidence: formData.get('defaultConfidence')
        ? parseFloat(formData.get('defaultConfidence') as string)
        : undefined,
    }

    // 6. 驗證輸入數據
    const validationResult = UpdateForwarderSchema.safeParse(inputData)

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

    // 7. 檢查 Name 唯一性（如果要更新名稱）
    if (validatedData.name && validatedData.name !== existingForwarder.name) {
      const nameExists = await forwarderNameExists(validatedData.name, forwarderId)
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
    }

    // 8. 處理 Logo
    let logoUrl: string | null | undefined = undefined
    const oldLogoUrl = existingForwarder.logoUrl

    // 如果要移除 Logo
    if (removeLogo && oldLogoUrl) {
      try {
        await deleteFromBlob(oldLogoUrl)
        logoUrl = null
      } catch (deleteError) {
        console.warn('Failed to delete old logo, continuing:', deleteError)
        logoUrl = null
      }
    }
    // 如果要上傳新 Logo
    else if (logoFile && logoFile.size > 0) {
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
        // 刪除舊 Logo
        if (oldLogoUrl) {
          try {
            await deleteFromBlob(oldLogoUrl)
          } catch (deleteError) {
            console.warn('Failed to delete old logo, continuing:', deleteError)
          }
        }

        // 上傳新 Logo
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

    // 9. 更新 Forwarder
    const updatedForwarder = await updateForwarder(forwarderId, {
      name: validatedData.name,
      description: validatedData.description,
      contactEmail: validatedData.contactEmail,
      defaultConfidence: validatedData.defaultConfidence,
      logoUrl,
    })

    // 10. 創建審計日誌
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        resourceType: 'forwarder',
        resourceId: forwarderId,
        resourceName: updatedForwarder.name,
        userId: session.user.id,
        userName: session.user.name || 'Unknown',
        description: `Updated forwarder: ${updatedForwarder.name}`,
        changes: {
          before: {
            name: existingForwarder.name,
            description: existingForwarder.description,
            contactEmail: existingForwarder.contactEmail,
            logoUrl: existingForwarder.logoUrl,
          },
          after: {
            name: validatedData.name ?? existingForwarder.name,
            description: validatedData.description ?? existingForwarder.description,
            contactEmail: validatedData.contactEmail ?? existingForwarder.contactEmail,
            logoUrl: logoUrl ?? existingForwarder.logoUrl,
          },
        },
        status: 'SUCCESS',
      },
    })

    // 11. 返回成功響應
    return NextResponse.json({
      success: true,
      data: updatedForwarder,
    })
  } catch (error) {
    console.error('Update forwarder error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'https://api.example.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to update forwarder',
        },
      },
      { status: 500 }
    )
  }
}
