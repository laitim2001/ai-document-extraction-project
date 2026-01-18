/**
 * @fileoverview 編輯公司頁面
 * @description
 *   提供編輯公司的表單頁面。
 *   需要 FORWARDER_MANAGE 權限才能存取。
 *
 * @module src/app/(dashboard)/companies/[id]/edit/page
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用公司配置)
 * @lastModified 2026-01-12
 *
 * @features
 *   - 伺服器端權限檢查
 *   - 獲取現有公司資料
 *   - 編輯公司表單
 *   - Logo 上傳支援
 *
 * @dependencies
 *   - @/lib/auth - 認證和權限檢查
 *   - @/services/company.service - 公司資料服務
 *   - @/components/features/forwarders - Company 組件
 */

import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { getCompanyById } from '@/services/company.service'
import { ForwarderForm } from '@/components/features/forwarders'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ============================================================
// Types
// ============================================================

interface PageProps {
  params: Promise<{
    id: string
  }>
}

// ============================================================
// Metadata
// ============================================================

export const metadata = {
  title: '編輯公司 | AI Document Extraction',
  description: '編輯公司資料',
}

// ============================================================
// Page Component
// ============================================================

/**
 * 編輯公司頁面
 *
 * @description
 *   提供編輯公司的表單介面。
 *   需要 FORWARDER_MANAGE 權限才能存取。
 *
 *   頁面流程：
 *   1. 伺服器端驗證認證狀態
 *   2. 檢查 FORWARDER_MANAGE 權限
 *   3. 獲取現有公司資料
 *   4. 渲染編輯表單
 */
export default async function EditCompanyPage({ params }: PageProps) {
  // 解析路由參數
  const resolvedParams = await params
  const companyId = resolvedParams.id

  // 驗證認證狀態
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/login')
  }

  // 檢查 FORWARDER_MANAGE 權限（支援 '*' 通配符）
  const hasManagePermission = hasPermission(session.user, PERMISSIONS.FORWARDER_MANAGE)

  if (!hasManagePermission) {
    redirect(`/companies/${companyId}?error=access_denied`)
  }

  // 獲取公司資料
  const company = await getCompanyById(companyId)

  if (!company) {
    notFound()
  }

  // 準備 ForwarderForm 所需的初始資料
  // 注意：code 可能為 null（資料庫允許），但表單需要字串
  const initialData = {
    id: company.id,
    name: company.name,
    code: company.code ?? '',
    description: company.description,
    contactEmail: company.contactEmail,
    defaultConfidence: company.defaultConfidence,
    logoUrl: company.logoUrl,
  }

  return (
    <div className="space-y-6">
      {/* 返回連結 */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/companies/${companyId}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            返回公司詳情
          </Link>
        </Button>
      </div>

      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          編輯公司
        </h1>
        <p className="text-muted-foreground">
          編輯 {company.displayName || company.name} 的基本資訊
        </p>
      </div>

      {/* 表單 */}
      <ForwarderForm
        initialData={initialData}
        isEdit
      />
    </div>
  )
}
