/**
 * @fileoverview 新增公司頁面
 * @description
 *   提供新增公司的表單頁面。
 *   需要 FORWARDER_MANAGE 權限才能存取。
 *
 * @module src/app/(dashboard)/companies/new/page
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用公司配置)
 * @lastModified 2026-01-12
 *
 * @features
 *   - 伺服器端權限檢查
 *   - 新增公司表單
 *   - Logo 上傳支援
 *
 * @dependencies
 *   - @/lib/auth - 認證和權限檢查
 *   - @/components/features/forwarders - Company 組件
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/city-permission'
import { PERMISSIONS } from '@/types/permissions'
import { ForwarderForm } from '@/components/features/forwarders'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: '新增公司 | AI Document Extraction',
  description: '新增發票發行公司檔案',
}

/**
 * 新增公司頁面
 *
 * @description
 *   提供新增公司的表單介面。
 *   需要 FORWARDER_MANAGE 權限才能存取。
 *
 *   頁面流程：
 *   1. 伺服器端驗證認證狀態
 *   2. 檢查 FORWARDER_MANAGE 權限
 *   3. 渲染新增表單
 */
export default async function NewCompanyPage() {
  // 驗證認證狀態
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/login')
  }

  // 檢查 FORWARDER_MANAGE 權限（支援 '*' 通配符）
  const hasManagePermission = hasPermission(session.user, PERMISSIONS.FORWARDER_MANAGE)

  if (!hasManagePermission) {
    redirect('/companies?error=access_denied')
  }

  return (
    <div className="space-y-6">
      {/* 返回連結 */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/companies">
            <ChevronLeft className="mr-1 h-4 w-4" />
            返回公司列表
          </Link>
        </Button>
      </div>

      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          新增公司
        </h1>
        <p className="text-muted-foreground">
          填寫公司基本資訊以建立新的發票發行公司檔案
        </p>
      </div>

      {/* 表單 */}
      <ForwarderForm
        title="公司資訊"
        description="請填寫以下必要資訊來建立新的公司"
        submitLabel="建立公司"
      />
    </div>
  )
}
