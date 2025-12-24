/**
 * @fileoverview 公司詳情和更新 API
 * @description
 *   提供單個公司的查詢和更新功能：
 *   - GET: 獲取公司詳情
 *   - PATCH: 更新公司類型/狀態
 *
 * @module src/app/api/admin/companies/[id]
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - 公司詳情查詢
 *   - 類型/狀態更新
 *   - 顯示名稱更新
 *
 * @dependencies
 *   - Prisma Client - 數據庫操作
 *   - company-auto-create.service - 公司更新服務
 *
 * @related
 *   - src/components/features/companies/CompanyTypeSelector.tsx - 類型選擇器
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { prisma } from '@/lib/prisma'
import { updateCompanyType, clearMatcherCache } from '@/services'
import { CompanyType, CompanyStatus } from '@prisma/client'

// ============================================================
// Validation Schemas
// ============================================================

const UpdateCompanySchema = z.object({
  type: z.nativeEnum(CompanyType).optional(),
  status: z.nativeEnum(CompanyStatus).optional(),
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
})

// ============================================================
// GET Handler
// ============================================================

/**
 * 獲取公司詳情
 *
 * @param request - Next.js 請求對象
 * @param params - 路由參數
 * @returns 公司詳情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 驗證認證
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 檢查權限
    const hasViewPerm = hasPermission(session.user, PERMISSIONS.FORWARDER_VIEW)
    if (!hasViewPerm) {
      return NextResponse.json(
        { success: false, error: '權限不足' },
        { status: 403 }
      )
    }

    // 獲取公司
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        mergedInto: {
          select: {
            id: true,
            name: true,
          },
        },
        mergedFrom: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json(
        { success: false, error: '公司不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: company,
    })
  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json(
      {
        success: false,
        error: '獲取公司詳情失敗',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH Handler
// ============================================================

/**
 * 更新公司資訊
 *
 * @description
 *   更新公司的類型、狀態、顯示名稱等資訊。
 *   設定類型後，狀態自動變更為 ACTIVE。
 *
 * @param request - Next.js 請求對象
 * @param params - 路由參數
 * @returns 更新後的公司
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 驗證認證
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 檢查權限
    const hasManagePerm = hasPermission(session.user, PERMISSIONS.FORWARDER_MANAGE)
    if (!hasManagePerm) {
      return NextResponse.json(
        { success: false, error: '權限不足' },
        { status: 403 }
      )
    }

    // 解析請求體
    const body = await request.json()
    const validation = UpdateCompanySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: '請求參數無效',
          details: validation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { type, status, displayName, description } = validation.data

    // 檢查公司是否存在
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    })

    if (!existingCompany) {
      return NextResponse.json(
        { success: false, error: '公司不存在' },
        { status: 404 }
      )
    }

    // 如果設定類型，使用專門的服務函數
    if (type) {
      const updatedCompany = await updateCompanyType(id, type)
      return NextResponse.json({
        success: true,
        data: updatedCompany,
        message: '公司類型已更新，狀態已變更為啟用',
      })
    }

    // 否則執行一般更新
    const updateData: {
      status?: CompanyStatus
      displayName?: string
      description?: string
    } = {}

    if (status) updateData.status = status
    if (displayName) updateData.displayName = displayName
    if (description !== undefined) updateData.description = description

    const updatedCompany = await prisma.company.update({
      where: { id },
      data: updateData,
    })

    // 清除匹配快取
    clearMatcherCache()

    return NextResponse.json({
      success: true,
      data: updatedCompany,
    })
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新公司失敗',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
