'use client'

/**
 * @fileoverview 刪除角色確認對話框組件
 * @description
 *   提供刪除角色前的確認對話框。
 *   包含系統角色保護和使用中角色保護機制。
 *
 *   功能特點：
 *   - 顯示角色名稱和使用者數量
 *   - 系統角色無法刪除
 *   - 有使用者的角色無法刪除
 *   - 刪除前二次確認
 *   - 提交載入狀態
 *   - 成功/失敗 Toast 通知
 *
 *   權限要求：
 *   - USER_MANAGE 權限（由呼叫端控制顯示）
 *
 * @module src/components/features/admin/roles/DeleteRoleDialog
 * @author Development Team
 * @since Epic 1 - Story 1.7 (Custom Role Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/hooks/use-roles - 角色操作 Hook
 *   - @/hooks/use-toast - Toast 通知
 *
 * @related
 *   - src/app/(dashboard)/admin/roles/page.tsx - 角色列表頁面
 *   - src/components/features/admin/roles/EditRoleDialog.tsx - 編輯角色對話框
 */

import { useState } from 'react'
import { Trash2, Loader2, AlertTriangle, ShieldAlert, Users } from 'lucide-react'

import { useDeleteRole } from '@/hooks/use-roles'
import { useToast } from '@/hooks/use-toast'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// ============================================================
// Types
// ============================================================

interface RoleData {
  id: string
  name: string
  isSystem: boolean
  _count?: {
    users: number
  }
}

interface DeleteRoleDialogProps {
  /** 要刪除的角色資料 */
  role: RoleData
  /** 對話框開啟狀態變更回調（可選） */
  onOpenChange?: (open: boolean) => void
  /** 使用圖標按鈕觸發器 */
  iconTrigger?: boolean
  /** 自定義類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 刪除角色確認對話框
 *
 * @description
 *   提供刪除角色前的確認機制。
 *   系統角色和有使用者的角色無法刪除。
 *   成功刪除後自動刷新角色列表並顯示通知。
 *
 * @example
 *   <DeleteRoleDialog role={roleData} />
 *   <DeleteRoleDialog role={roleData} iconTrigger />
 */
export function DeleteRoleDialog({
  role,
  onOpenChange,
  iconTrigger = false,
  className,
}: DeleteRoleDialogProps) {
  // --- State ---
  const [open, setOpen] = useState(false)

  // --- Hooks ---
  const { toast } = useToast()
  const { mutate: deleteRole, isPending } = useDeleteRole()

  // --- Computed ---
  const userCount = role._count?.users ?? 0
  const isInUse = userCount > 0
  const canDelete = !role.isSystem && !isInUse

  // --- Handlers ---
  const handleDelete = () => {
    if (!canDelete) {
      toast({
        variant: 'destructive',
        title: '無法刪除',
        description: role.isSystem
          ? '系統角色無法刪除'
          : `角色「${role.name}」目前有 ${userCount} 位使用者，請先移除使用者後再刪除`,
      })
      return
    }

    deleteRole(role.id, {
      onSuccess: () => {
        toast({
          title: '角色已刪除',
          description: `角色「${role.name}」已成功刪除`,
        })
        handleOpenChange(false)
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: '刪除失敗',
          description: error.message,
        })
      },
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  // --- Render ---
  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        {iconTrigger ? (
          <Button
            variant="ghost"
            size="icon"
            className={className}
            disabled={role.isSystem}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="sr-only">刪除角色</span>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={className}
            disabled={role.isSystem}
          >
            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
            刪除
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            確認刪除角色
          </AlertDialogTitle>
          <AlertDialogDescription>
            您確定要刪除角色「<strong>{role.name}</strong>」嗎？此操作無法復原。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* 警告訊息 */}
        {role.isSystem && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">
              系統角色
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-500">
              此為系統預設角色，無法刪除。
            </AlertDescription>
          </Alert>
        )}

        {!role.isSystem && isInUse && (
          <Alert variant="destructive">
            <Users className="h-4 w-4" />
            <AlertTitle>角色使用中</AlertTitle>
            <AlertDescription>
              此角色目前有 {userCount} 位使用者正在使用，請先將這些使用者改為其他角色後再刪除。
            </AlertDescription>
          </Alert>
        )}

        {canDelete && (
          <Alert variant="default" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              刪除後，此角色的所有設定將永久移除，且無法復原。
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!canDelete || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            確認刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default DeleteRoleDialog
