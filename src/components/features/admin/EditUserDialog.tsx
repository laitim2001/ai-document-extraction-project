'use client'

/**
 * @fileoverview 編輯用戶對話框組件
 * @description
 *   提供系統管理員編輯用戶資料的表單對話框。
 *   支援用戶名稱修改、角色變更、城市指派等功能。
 *
 *   功能特點：
 *   - Email 唯讀顯示（不可修改）
 *   - 名稱編輯
 *   - 角色多選（至少選擇一個）
 *   - 城市選擇
 *   - 表單驗證錯誤提示
 *   - 提交載入狀態
 *   - 成功/失敗 Toast 通知
 *
 *   權限要求：
 *   - USER_MANAGE 權限（由呼叫端控制顯示）
 *
 * @module src/components/features/admin/EditUserDialog
 * @author Development Team
 * @since Epic 1 - Story 1.5 (Modify User Role & City)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - react-hook-form - 表單狀態管理
 *   - @hookform/resolvers/zod - Zod 驗證整合
 *   - @/hooks/use-users - 更新用戶 Hook
 *   - @/hooks/use-roles - 角色列表 Hook
 *   - @/hooks/use-cities - 城市列表 Hook
 *   - @/hooks/use-toast - Toast 通知
 *
 * @related
 *   - src/app/(dashboard)/admin/users/page.tsx - 用戶列表頁面
 *   - src/lib/validations/user.schema.ts - 驗證 Schema
 *   - src/components/features/admin/AddUserDialog.tsx - 新增用戶對話框
 */

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { useUpdateUser, type UserDetail } from '@/hooks/use-users'
import { useRoles } from '@/hooks/use-roles'
import { useCities } from '@/hooks/use-cities'
import { useToast } from '@/hooks/use-toast'
import { updateUserSchema, type UpdateUserInput } from '@/lib/validations/user.schema'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ============================================================
// Types
// ============================================================

interface EditUserDialogProps {
  /** 要編輯的用戶資料 */
  user: UserDetail | null
  /** 對話框是否開啟 */
  open: boolean
  /** 對話框開關狀態變更回調 */
  onOpenChange: (open: boolean) => void
}

// ============================================================
// Component
// ============================================================

/**
 * 編輯用戶對話框
 *
 * @description
 *   提供完整的編輯用戶表單功能，包含驗證和提交。
 *   成功更新後自動刷新用戶列表並顯示通知。
 *
 * @example
 *   <EditUserDialog
 *     user={selectedUser}
 *     open={isEditDialogOpen}
 *     onOpenChange={setIsEditDialogOpen}
 *   />
 */
export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  // --- Hooks ---
  const { toast } = useToast()
  const { mutate: updateUser, isPending } = useUpdateUser()
  const { data: roles, isLoading: isLoadingRoles } = useRoles()
  const { data: cities, isLoading: isLoadingCities } = useCities()

  // --- Form ---
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: '',
      roleIds: [],
      cityId: null,
    },
  })

  // --- Effects ---
  // 當用戶資料變更時，重置表單
  useEffect(() => {
    if (user && open) {
      // 提取用戶當前的角色 ID 列表
      const currentRoleIds = user.roles.map((r) => r.roleId)
      // 提取用戶當前的城市 ID（取第一個有城市的角色）
      const currentCityId = user.roles.find((r) => r.cityId)?.cityId || null

      form.reset({
        name: user.name || '',
        roleIds: currentRoleIds,
        cityId: currentCityId,
      })
    }
  }, [user, open, form])

  // --- Handlers ---
  const onSubmit = (data: UpdateUserInput) => {
    if (!user) return

    updateUser(
      { userId: user.id, data },
      {
        onSuccess: () => {
          toast({
            title: '用戶已更新',
            description: `${data.name || user.email} 的資料已成功更新`,
          })
          onOpenChange(false)
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
    onOpenChange(newOpen)
    if (!newOpen) {
      // 關閉時重置表單
      form.reset()
    }
  }

  // --- Render ---
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>編輯用戶</DialogTitle>
          <DialogDescription>修改用戶的資料、角色和城市指派。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email 欄位（唯讀） */}
            <FormItem>
              <FormLabel>電子郵件</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </FormControl>
              <FormDescription>電子郵件無法修改（與 Azure AD 帳號綁定）</FormDescription>
            </FormItem>

            {/* 名稱欄位 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <Input placeholder="王小明" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 角色欄位 */}
            <FormField
              control={form.control}
              name="roleIds"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel>角色</FormLabel>
                    <FormDescription>選擇用戶的角色權限（至少選擇一個）</FormDescription>
                  </div>
                  <div className="space-y-2">
                    {isLoadingRoles ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        載入角色...
                      </div>
                    ) : (
                      roles?.map((role) => (
                        <FormField
                          key={role.id}
                          control={form.control}
                          name="roleIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(role.id)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || []
                                    if (checked) {
                                      field.onChange([...current, role.id])
                                    } else {
                                      field.onChange(current.filter((id) => id !== role.id))
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {role.name}
                                {role.description && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({role.description})
                                  </span>
                                )}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 城市欄位 */}
            <FormField
              control={form.control}
              name="cityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>城市（選填）</FormLabel>
                  <Select
                    value={field.value || '__none__'}
                    onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                    disabled={isLoadingCities}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇城市...">
                          {isLoadingCities ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              載入中...
                            </span>
                          ) : field.value ? (
                            cities?.find((c) => c.id === field.value)?.name || '選擇城市...'
                          ) : (
                            '選擇城市...'
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">不指定城市</SelectItem>
                      {cities?.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name} ({city.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>若分配 City Manager 角色，建議指定城市</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                儲存變更
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
