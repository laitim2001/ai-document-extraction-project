'use client'

/**
 * @fileoverview 新增角色對話框組件
 * @description
 *   提供系統管理員建立自訂角色的表單對話框。
 *   包含角色名稱、描述和權限選擇。
 *
 *   功能特點：
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
 * @module src/components/features/admin/roles/AddRoleDialog
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
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Loader2 } from 'lucide-react'

import { useCreateRole } from '@/hooks/use-roles'
import { useToast } from '@/hooks/use-toast'
import { createRoleSchema, type CreateRoleInput } from '@/lib/validations/role.schema'

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

import { PermissionSelector } from './PermissionSelector'

// ============================================================
// Types
// ============================================================

interface AddRoleDialogProps {
  /** 按鈕觸發器變體 */
  triggerVariant?: 'default' | 'outline' | 'ghost'
  /** 按鈕大小 */
  triggerSize?: 'default' | 'sm' | 'lg' | 'icon'
  /** 自定義類名 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 新增角色對話框
 *
 * @description
 *   提供完整的新增角色表單功能，包含驗證和提交。
 *   成功創建後自動刷新角色列表並顯示通知。
 *
 * @example
 *   <AddRoleDialog />
 *   <AddRoleDialog triggerVariant="outline" />
 */
export function AddRoleDialog({
  triggerVariant = 'default',
  triggerSize = 'default',
  className,
}: AddRoleDialogProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  // --- State ---
  const [open, setOpen] = useState(false)

  // --- Hooks ---
  const { toast } = useToast()
  const { mutate: createRole, isPending } = useCreateRole()

  // --- Form ---
  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
    },
  })

  // --- Handlers ---
  const onSubmit = (data: CreateRoleInput) => {
    createRole(data, {
      onSuccess: () => {
        toast({
          title: t('roles.toast.created.title'),
          description: t('roles.toast.created.description', { name: data.name }),
        })
        setOpen(false)
        form.reset()
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: t('roles.toast.createError.title'),
          description: error.message,
        })
      },
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // 關閉時重置表單
      form.reset()
    }
  }

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={className}>
          <Plus className="mr-2 h-4 w-4" />
          {t('roles.add.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t('roles.add.title')}</DialogTitle>
          <DialogDescription>
            {t('roles.add.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
              <div className="space-y-4">
                {/* 角色名稱 */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('roles.add.form.name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('roles.add.form.namePlaceholder')}
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('roles.add.form.nameDescription')}
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
                      <FormLabel>{t('roles.add.form.descriptionOptional')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('roles.add.form.descriptionPlaceholder')}
                          className="resize-none"
                          rows={2}
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
                      <FormLabel>{t('roles.add.form.permissions')}</FormLabel>
                      <FormDescription>
                        {t('roles.add.form.permissionsDescription')}
                      </FormDescription>
                      <FormControl>
                        <PermissionSelector
                          value={field.value}
                          onChange={field.onChange}
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
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                {t('roles.add.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('roles.add.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default AddRoleDialog
