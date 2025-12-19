'use client'

/**
 * @fileoverview 用戶狀態切換組件
 * @description
 *   提供用戶帳戶狀態切換功能，支援啟用/停用操作。
 *   停用操作會顯示確認對話框，啟用操作直接執行。
 *
 *   功能特性：
 *   - 下拉選單觸發（MoreHorizontal 按鈕）
 *   - 停用前確認對話框
 *   - 自我停用防護（無法停用自己）
 *   - 操作結果 Toast 通知
 *   - 載入狀態處理
 *
 * @module src/components/features/admin/UserStatusToggle
 * @author Development Team
 * @since Epic 1 - Story 1.6 (Disable/Enable User Account)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/dropdown-menu - 下拉選單
 *   - @/components/ui/alert-dialog - 確認對話框
 *   - @/hooks/use-users - 狀態更新 Hook
 *   - @/components/ui/toast - Toast 通知
 *
 * @related
 *   - src/components/features/admin/UserTable.tsx - 用戶表格
 *   - src/app/api/admin/users/[id]/status/route.ts - 狀態 API
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { MoreHorizontal, UserCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useUpdateUserStatus } from '@/hooks/use-users'
import type { UserStatus } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface UserStatusToggleProps {
  /** 用戶 ID */
  userId: string
  /** 用戶名稱（顯示在確認對話框） */
  userName: string | null
  /** 當前用戶狀態 */
  currentStatus: UserStatus
  /** 編輯用戶回調（可選，用於顯示編輯選項） */
  onEdit?: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * 用戶狀態切換組件
 *
 * @description
 *   提供用戶帳戶狀態管理的下拉選單和確認對話框。
 *
 *   行為規則：
 *   - 停用操作（ACTIVE → INACTIVE）：顯示確認對話框
 *   - 啟用操作（INACTIVE → ACTIVE）：直接執行
 *   - 自我停用：隱藏停用選項
 *   - SUSPENDED 狀態：只能由系統管理員處理（此組件不支援）
 *
 * @example
 *   <UserStatusToggle
 *     userId="user-id"
 *     userName="John Doe"
 *     currentStatus="ACTIVE"
 *     onEdit={() => handleEdit(user.id)}
 *   />
 */
export function UserStatusToggle({
  userId,
  userName,
  currentStatus,
  onEdit,
}: UserStatusToggleProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { mutate: updateStatus, isPending } = useUpdateUserStatus()

  // --- State ---
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // --- Derived State ---
  const isCurrentUser = session?.user?.id === userId
  const isActive = currentStatus === 'ACTIVE'
  const displayName = userName || '此用戶'

  // --- Handlers ---

  /**
   * 處理停用用戶
   * 顯示確認對話框後執行
   */
  const handleDisable = () => {
    setDropdownOpen(false)
    setShowDisableDialog(true)
  }

  /**
   * 確認停用用戶
   */
  const confirmDisable = () => {
    updateStatus(
      { userId, status: 'INACTIVE' },
      {
        onSuccess: () => {
          toast({
            title: '用戶已停用',
            description: `${displayName} 的帳戶已被停用，該用戶將無法登入系統。`,
          })
          setShowDisableDialog(false)
        },
        onError: (error) => {
          toast({
            title: '停用失敗',
            description: error.message,
            variant: 'destructive',
          })
          setShowDisableDialog(false)
        },
      }
    )
  }

  /**
   * 處理啟用用戶
   * 直接執行，無需確認
   */
  const handleEnable = () => {
    setDropdownOpen(false)
    updateStatus(
      { userId, status: 'ACTIVE' },
      {
        onSuccess: () => {
          toast({
            title: '用戶已啟用',
            description: `${displayName} 的帳戶已恢復啟用，該用戶現在可以登入系統。`,
          })
        },
        onError: (error) => {
          toast({
            title: '啟用失敗',
            description: error.message,
            variant: 'destructive',
          })
        },
      }
    )
  }

  // --- Render ---
  return (
    <>
      {/* 下拉選單 */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isPending}
          >
            <span className="sr-only">操作選單</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* 編輯用戶（如果有提供回調） */}
          {onEdit && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                編輯用戶
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* 狀態切換選項 */}
          {isActive ? (
            // 當前為啟用狀態，顯示停用選項
            // 但不允許停用自己
            !isCurrentUser && (
              <DropdownMenuItem
                onClick={handleDisable}
                className="text-destructive focus:text-destructive"
              >
                <UserX className="mr-2 h-4 w-4" />
                停用帳戶
              </DropdownMenuItem>
            )
          ) : (
            // 當前為停用狀態，顯示啟用選項
            <DropdownMenuItem onClick={handleEnable}>
              <UserCheck className="mr-2 h-4 w-4" />
              啟用帳戶
            </DropdownMenuItem>
          )}

          {/* 如果是自己，顯示提示 */}
          {isActive && isCurrentUser && (
            <DropdownMenuItem disabled>
              <span className="text-muted-foreground text-xs">
                您無法停用自己的帳戶
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 停用確認對話框 */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認停用帳戶</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要停用 <strong>{displayName}</strong> 的帳戶嗎？
              <br />
              <br />
              停用後，該用戶將無法登入系統。您可以隨時重新啟用此帳戶。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisable}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? '處理中...' : '確認停用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
