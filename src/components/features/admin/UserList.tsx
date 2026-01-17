'use client'

/**
 * @fileoverview 用戶列表主組件
 * @description
 *   整合搜尋、篩選、表格和分頁的用戶管理列表。
 *   使用 URL 參數管理狀態，支援書籤和分享。
 *
 * @module src/components/features/admin/UserList
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 分頁用戶列表（每頁 20 筆）
 *   - 名稱/電子郵件搜尋（300ms debounce）
 *   - 角色/城市/狀態篩選
 *   - URL 狀態同步
 *   - 骨架屏載入狀態
 *   - 編輯用戶對話框（Story 1.5）
 *
 * @dependencies
 *   - @/hooks/use-users - 用戶查詢
 *   - next/navigation - URL 路由
 *
 * @related
 *   - src/components/features/admin/EditUserDialog.tsx - 編輯用戶對話框
 */

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useUsers, useUser, type UseUsersParams } from '@/hooks/use-users'
import { UserSearchBar } from './UserSearchBar'
import { UserFilters } from './UserFilters'
import { UserTable } from './UserTable'
import { UserListSkeleton } from './UserListSkeleton'
import { EditUserDialog } from './EditUserDialog'
import { Pagination } from '@/components/ui/pagination'
import { Card, CardContent } from '@/components/ui/card'
import type { UserStatus } from '@prisma/client'

/**
 * 用戶列表主組件
 *
 * @description
 *   整合用戶管理的所有功能：
 *   - 搜尋欄：按名稱或電子郵件搜尋
 *   - 篩選器：按角色、城市、狀態篩選
 *   - 資料表：顯示用戶列表
 *   - 分頁：每頁 20 筆，支援頁碼導航
 *
 *   所有狀態透過 URL 參數管理，支援：
 *   - 頁面重載後保留狀態
 *   - 書籤和分享連結
 *   - 瀏覽器前進/後退
 *
 * @example
 *   // 在頁面中使用
 *   <Suspense fallback={<UserListSkeleton />}>
 *     <UserList />
 *   </Suspense>
 */
export function UserList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations('admin.users')

  // --- Edit Dialog State (Story 1.5) ---
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // 從 URL 解析參數
  const params: UseUsersParams = {
    page: parseInt(searchParams.get('page') || '1', 10),
    pageSize: 20,
    search: searchParams.get('search') || undefined,
    roleId: searchParams.get('roleId') || undefined,
    cityId: searchParams.get('cityId') || undefined,
    status: (searchParams.get('status') as UserStatus) || undefined,
  }

  // 查詢用戶資料
  const { data, isLoading, error } = useUsers(params)

  // 查詢選中用戶的詳情（Story 1.5）
  const { data: selectedUserData } = useUser(selectedUserId || '', {
    enabled: !!selectedUserId && isEditDialogOpen,
  })

  /**
   * 更新 URL 參數
   * 當搜尋或篩選條件變更時，重置頁碼到第 1 頁
   */
  const updateParams = useCallback(
    (newParams: Partial<UseUsersParams>) => {
      const current = new URLSearchParams(searchParams.toString())

      // 更新參數
      Object.entries(newParams).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          current.delete(key)
        } else {
          current.set(key, String(value))
        }
      })

      // 當篩選條件變更時，重置頁碼
      const isFilterChange =
        'search' in newParams ||
        'roleId' in newParams ||
        'cityId' in newParams ||
        'status' in newParams

      if (isFilterChange) {
        current.set('page', '1')
      }

      router.push(`${pathname}?${current.toString()}`)
    },
    [router, pathname, searchParams]
  )

  /**
   * 處理編輯用戶（Story 1.5）
   * 設置選中的用戶 ID 並打開編輯對話框
   */
  const handleEdit = useCallback((userId: string) => {
    setSelectedUserId(userId)
    setIsEditDialogOpen(true)
  }, [])

  /**
   * 處理編輯對話框關閉（Story 1.5）
   * 關閉對話框並清除選中的用戶
   */
  const handleEditDialogOpenChange = useCallback((open: boolean) => {
    setIsEditDialogOpen(open)
    if (!open) {
      setSelectedUserId(null)
    }
  }, [])

  // 載入中狀態
  if (isLoading) {
    return <UserListSkeleton />
  }

  // 錯誤狀態
  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-destructive">{t('list.loadError')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {error instanceof Error ? error.message : t('list.unknownError')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 搜尋和篩選 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <UserSearchBar
          value={params.search || ''}
          onChange={(search) => updateParams({ search })}
        />
        <UserFilters
          roleId={params.roleId}
          cityId={params.cityId}
          status={params.status}
          onChange={updateParams}
        />
      </div>

      {/* 用戶表格 */}
      <UserTable users={data?.data || []} onEdit={handleEdit} />

      {/* 編輯用戶對話框（Story 1.5） */}
      <EditUserDialog
        user={selectedUserData?.data || null}
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogOpenChange}
      />

      {/* 分頁 */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={(page) => updateParams({ page })}
          />
        </div>
      )}

      {/* 結果摘要 */}
      {data?.meta && (
        <p className="text-center text-sm text-muted-foreground">
          {t('list.summary', { count: data.data?.length || 0, total: data.meta.total })}
        </p>
      )}
    </div>
  )
}
