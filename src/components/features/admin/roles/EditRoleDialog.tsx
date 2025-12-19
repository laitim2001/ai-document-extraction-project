'use client'

/**
 * @fileoverview 編輯角色對話框組件
 * @description
 *   提供系統管理員編輯現有角色的表單對話框。
 *   包含角色名稱、描述和權限修改。
 *   系統角色（isSystem=true）將顯示為唯讀模式。
 *
 *   功能特點：
 *   - 預填現有角色資料
 *   - 系統角色唯讀保護
 *   - 角色名稱驗證
 *   - 可選的角色描述
 *   - 分類權限選擇器
 *   - 表單驗證錯誤提示
 *   - 提交載入狀態
 *   - 成功/失敗 Toast 通知
 *
 *   權限要求：
 *   - USER_MANAGE 權限（由呼叫端控制顯示）
 *
 * @module src/components/features/admin/roles/EditRoleDialog
 * @author Development Team
 * @since Epic 1 - Story 1.7 (Custom Role Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - react-hook-form - 表單狀態管理
 *   - @hookform/resolvers/zod - Zod 驗證整合
 *   - @/hooks/use-roles - 角色操作 Hook
 *   - @/hooks/use-toast - Toast 通知
 *
 * @related
 *   - src/app/(dashboard)/admin/roles/page.tsx - 角色列表頁面
 *   - src/lib/validations/role.schema.ts - 驗證 Schema
 *   - src/components/features/admin/roles/AddRoleDialog.tsx - 新增角色對話框
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Loader2, ShieldAlert } from 'lucide-react'

import { useUpdateRole } from '@/hooks/use-roles'
import { useToast } from '@/hooks/use-toast'
import { updateRoleSchema, type UpdateRoleInput } from '@/lib/validations/role.schema'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { PermissionSelector } from './PermissionSelector'

// ============================================================
// Types
// ============================================================

interface RoleData {
  id: string
  name: string
  description: string | null
  permissions: string[]
  isSystem: boolean
}

interface EditRoleDialogProps {
  /** 要編輯的角色資料 */
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
 * 編輯角色對話框
 *
 * @description
 *   提供完整的編輯角色表單功能，包含驗證和提交。
 *   系統角色（isSystem=true）將顯示為唯讀模式，無法編輯。
 *   成功更新後自動刷新角色列表並顯示通知。
 *
 * @example
 *   <EditRoleDialog role={roleData} />
 *   <EditRoleDialog role={roleData} iconTrigger />
 */
export function EditRoleDialog({
  role,
  onOpenChange,
  iconTrigger = false,
  className,
}: EditRoleDialogProps) {
  // --- State ---
  const [open, setOpen] = useState(false)

  // --- Hooks ---
  const { toast } = useToast()
  const { mutate: updateRole, isPending } = useUpdateRole()

  // --- Form ---
  const form = useForm<UpdateRoleInput>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions,
    },
  })

  // 當角色資料變更時重置表單
  useEffect(() => {
    form.reset({
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions,
    })
  }, [role, form])

  // --- Handlers ---
  const onSubmit = (data: UpdateRoleInput) => {
    // 如果是系統角色，不允許提交
    if (role.isSystem) {
      toast({
        variant: 'destructive',
        title: '無法修改',
        description: '系統角色無法修改',
      })
      return
    }

    updateRole(
      { id: role.id, data },
      {
        onSuccess: () => {
          toast({
            title: '角色已更新',
            description: `角色「${data.name || role.name}」已成功更新`,
          })
          handleOpenChange(false)
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: '更新失敗',
            description: error.message,
          })
        },
      }
    )
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    onOpenChange?.(newOpen)
    if (!newOpen) {
      // 關閉時重置表單回原始值
      form.reset({
        name: role.name,
        description: role.description ?? '',
        permissions: role.permissions,
      })
    }
  }

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {iconTrigger ? (
          <Button variant="ghost" size="icon" className={className}>
            <Pencil className="h-4 w-4" />
            <span className="sr-only">編輯角色</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={className}>
            <Pencil className="mr-2 h-4 w-4" />
            編輯
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {role.isSystem ? '檢視角色' : '編輯角色'}
          </DialogTitle>
          <DialogDescription>
            {role.isSystem
              ? '系統角色無法修改，僅供檢視。'
              : '修改角色資訊和權限設定。'}
          </DialogDescription>
        </DialogHeader>

        {/* 系統角色警告 */}
        {role.isSystem && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">
              系統角色
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-500">
              此為系統預設角色，無法修改或刪除。如需自訂權限，請建立新的自訂角色。
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="max-h-[calc(90vh-250px)] pr-4">
              <div className="space-y-4">
                {/* 角色名稱 */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>角色名稱</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如：發票審核員"
                          autoComplete="off"
                          disabled={role.isSystem}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        角色名稱需唯一，支援中英文
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 角色描述 */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>描述（選填）</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="簡要描述此角色的職責..."
                          className="resize-none"
                          rows={2}
                          disabled={role.isSystem}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 權限選擇 */}
                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>權限設定</FormLabel>
                      <FormDescription>
                        {role.isSystem
                          ? '系統角色的權限配置'
                          : '選擇此角色可以執行的操作'}
                      </FormDescription>
                      <FormControl>
                        <PermissionSelector
                          value={field.value ?? role.permissions}
                          onChange={field.onChange}
                          disabled={role.isSystem}
                          className="mt-2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                {role.isSystem ? '關閉' : '取消'}
              </Button>
              {!role.isSystem && (
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  儲存變更
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditRoleDialog
