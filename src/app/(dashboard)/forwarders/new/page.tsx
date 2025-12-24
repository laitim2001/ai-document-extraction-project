/**
 * @fileoverview 新增 Forwarder 頁面
 * @description
 *   提供新增貨代商的表單頁面。
 *   需要 FORWARDER_MANAGE 權限才能存取。
 *
 * @module src/app/(dashboard)/forwarders/new/page
 * @author Development Team
 * @since Epic 5 - Story 5.5 (新增/停用貨代商配置)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 伺服器端權限檢查
 *   - 新增貨代商表單
 *   - Logo 上傳支援
 *
 * @dependencies
 *   - @/lib/auth - 認證和權限檢查
 *   - @/components/features/forwarders - Forwarder 組件
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
  title: '新增貨代商 | AI Document Extraction',
  description: '新增貨運代理商檔案',
}

/**
 * 新增 Forwarder 頁面
 *
 * @description
 *   提供新增貨代商的表單介面。
 *   需要 FORWARDER_MANAGE 權限才能存取。
 *
 *   頁面流程：
 *   1. 伺服器端驗證認證狀態
 *   2. 檢查 FORWARDER_MANAGE 權限
 *   3. 渲染新增表單
 */
export default async function NewForwarderPage() {
  // 驗證認證狀態
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/login')
  }

  // 檢查 FORWARDER_MANAGE 權限（支援 '*' 通配符）
  const hasManagePermission = hasPermission(session.user, PERMISSIONS.FORWARDER_MANAGE)

  if (!hasManagePermission) {
    redirect('/forwarders?error=access_denied')
  }

  return (
    <div className="space-y-6">
      {/* 返回連結 */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/forwarders">
            <ChevronLeft className="mr-1 h-4 w-4" />
            返回貨代商列表
          </Link>
        </Button>
      </div>

      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          新增貨代商
        </h1>
        <p className="text-muted-foreground">
          填寫貨代商基本資訊以建立新的貨代商檔案
        </p>
      </div>

      {/* 表單 */}
      <ForwarderForm
        title="貨代商資訊"
        description="請填寫以下必要資訊來建立新的貨代商"
        submitLabel="建立貨代商"
      />
    </div>
  )
}
