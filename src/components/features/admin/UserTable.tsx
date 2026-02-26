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
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - date-fns - 日期格式化
 *
 * @related
 *   - src/components/features/admin/EditUserDialog.tsx - 編輯用戶對話框 (Story 1.5)
 *   - src/components/features/admin/UserStatusToggle.tsx - 狀態切換組件 (Story 1.6)
 */

import { useTranslations, useLocale } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { zhTW, enUS } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

  if (users.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        {t('users.table.emptyState')}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">{t('users.table.name')}</TableHead>
            <TableHead>{t('users.table.role')}</TableHead>
            <TableHead>{t('users.table.city')}</TableHead>
            <TableHead>{t('users.table.status')}</TableHead>
            <TableHead>{t('users.table.lastLogin')}</TableHead>
            {showActions && <TableHead className="w-[80px]">{t('users.table.actions')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              {/* 用戶資訊 */}
              <TableCell>
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
                    <div className="text-sm text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </div>
              </TableCell>

              {/* 角色 */}
              <TableCell>
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
              </TableCell>

              {/* 城市 */}
              <TableCell>
                {user.roles[0]?.city ? (
                  <span>{user.roles[0].city.name}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>

              {/* 狀態 */}
              <TableCell>
                <Badge variant={getStatusVariant(user.status)}>
                  {t(getStatusKey(user.status))}
                </Badge>
              </TableCell>

              {/* 最後登入 */}
              <TableCell className="text-muted-foreground">
                {user.lastLoginAt
                  ? formatDistanceToNow(new Date(user.lastLoginAt), {
                      addSuffix: true,
                      locale: dateLocale,
                    })
                  : t('users.table.neverLoggedIn')}
              </TableCell>

              {/* 操作 */}
              {showActions && (
                <TableCell>
                  <UserStatusToggle
                    userId={user.id}
                    userName={user.name}
                    currentStatus={user.status}
                    onEdit={() => onEdit?.(user.id)}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
