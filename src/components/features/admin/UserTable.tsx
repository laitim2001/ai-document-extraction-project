'use client'

/**
 * @fileoverview 用戶資料表格組件
 * @description
 *   顯示用戶列表的資料表格。
 *   包含用戶資訊、角色、城市、狀態、最後登入時間和操作按鈕。
 *
 * @module src/components/features/admin/UserTable
 * @author Development Team
 * @since Epic 1 - Story 1.3 (User List & Search)
 * @lastModified 2026-06-21 (CHANGE-087 Phase 2: 遷移共用 DataTable)
 *
 * @dependencies
 *   - date-fns - 日期格式化
 *   - @/components/features/common/DataTable - 共用表格封裝（序號欄）
 *
 * @related
 *   - src/components/features/admin/EditUserDialog.tsx - 編輯用戶對話框 (Story 1.5)
 *   - src/components/features/admin/UserStatusToggle.tsx - 狀態切換組件 (Story 1.6)
 */

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { zhTW, enUS } from 'date-fns/locale'
import {
  DataTable,
  type DataTableColumn,
} from '@/components/features/common/DataTable'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserStatusToggle } from './UserStatusToggle'
import type { UserListItem } from '@/hooks/use-users'

interface UserTableProps {
  /** 用戶列表 */
  users: UserListItem[]
  /** 編輯用戶回調（Story 1.5） */
  onEdit?: (userId: string) => void
  /** 是否顯示操作欄 */
  showActions?: boolean
}

/**
 * 獲取用戶名稱首字母縮寫
 * @param name - 用戶名稱
 * @returns 首字母縮寫（最多 2 個字元）
 */
function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * 獲取狀態徽章的樣式
 * @param status - 用戶狀態
 * @returns Badge variant
 */
function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default'
    case 'INACTIVE':
      return 'secondary'
    case 'SUSPENDED':
      return 'destructive'
    default:
      return 'outline'
  }
}

/**
 * 獲取狀態對應的翻譯 key
 * @param status - 用戶狀態
 * @returns 翻譯 key
 */
function getStatusKey(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'users.status.active'
    case 'INACTIVE':
      return 'users.status.inactive'
    case 'SUSPENDED':
      return 'users.status.suspended'
    default:
      return 'users.status.pending'
  }
}

/**
 * 用戶資料表格組件
 *
 * @description
 *   顯示用戶資料的表格，包含以下欄位：
 *   - 用戶（頭像、名稱、電子郵件）
 *   - 角色（多角色以徽章顯示）
 *   - 城市
 *   - 狀態
 *   - 最後登入時間
 *   - 操作（編輯按鈕）
 *
 * @example
 *   <UserTable users={users} />
 *   <UserTable users={users} onEdit={handleEdit} showActions />
 */
export function UserTable({ users, onEdit, showActions = true }: UserTableProps) {
  const t = useTranslations('admin')
  const locale = useLocale()
  const dateLocale = locale === 'zh-TW' ? zhTW : enUS

  // --- Column 定義 ---
  const columns = React.useMemo<DataTableColumn<UserListItem>[]>(() => {
    const cols: DataTableColumn<UserListItem>[] = []

    // 用戶資訊
    cols.push({
      id: 'name',
      header: t('users.table.name'),
      headerClassName: 'w-[300px]',
      cell: (user) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || 'User avatar'}
            />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">
              {user.name || t('users.table.noName')}
            </div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      ),
    })

    // 角色
    cols.push({
      id: 'role',
      header: t('users.table.role'),
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.length > 0 ? (
            user.roles.map((userRole, index) => (
              <Badge key={index} variant="secondary">
                {userRole.role.name}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    })

    // 城市
    cols.push({
      id: 'city',
      header: t('users.table.city'),
      cell: (user) =>
        user.roles[0]?.city ? (
          <span>{user.roles[0].city.name}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    })

    // 狀態
    cols.push({
      id: 'status',
      header: t('users.table.status'),
      cell: (user) => (
        <Badge variant={getStatusVariant(user.status)}>
          {t(getStatusKey(user.status))}
        </Badge>
      ),
    })

    // 最後登入
    cols.push({
      id: 'lastLogin',
      header: t('users.table.lastLogin'),
      cellClassName: 'text-muted-foreground',
      cell: (user) =>
        user.lastLoginAt
          ? formatDistanceToNow(new Date(user.lastLoginAt), {
              addSuffix: true,
              locale: dateLocale,
            })
          : t('users.table.neverLoggedIn'),
    })

    // 操作（條件顯示）
    if (showActions) {
      cols.push({
        id: 'actions',
        header: t('users.table.actions'),
        headerClassName: 'w-[80px]',
        cell: (user) => (
          <UserStatusToggle
            userId={user.id}
            userName={user.name}
            currentStatus={user.status}
            onEdit={() => onEdit?.(user.id)}
          />
        ),
      })
    }

    return cols
  }, [t, dateLocale, showActions, onEdit])

  if (users.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        {t('users.table.emptyState')}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <DataTable data={users} columns={columns} getRowId={(user) => user.id} />
    </div>
  )
}
