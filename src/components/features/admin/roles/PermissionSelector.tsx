'use client'

/**
 * @fileoverview 權限選擇器組件
 * @description
 *   提供分類顯示的權限選擇介面，使用 Accordion 展示各權限分類。
 *   支援全選/取消全選單一分類、勾選/取消勾選單一權限。
 *
 *   功能：
 *   - 按分類（Accordion）展示權限
 *   - 分類標題顯示勾選狀態（全選/部分/無）
 *   - 點擊分類 checkbox 全選/取消該分類
 *   - 每個權限顯示名稱和描述 tooltip
 *
 * @module src/components/features/admin/roles/PermissionSelector
 * @author Development Team
 * @since Epic 1 - Story 1.7 (Custom Role Management)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/accordion - Accordion 組件
 *   - @/components/ui/checkbox - Checkbox 組件
 *   - @/types/permission-categories - 權限分類定義
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  PERMISSION_CATEGORIES,
  hasAllCategoryPermissions,
  hasSomeCategoryPermissions,
  getCategoryPermissionCodes,
} from '@/types/permission-categories'

// ============================================================
// Types
// ============================================================

interface PermissionSelectorProps {
  /** 當前選中的權限列表 */
  value: string[]
  /** 權限變更回調 */
  onChange: (permissions: string[]) => void
  /** 是否禁用（用於系統角色顯示） */
  disabled?: boolean
  /** 自訂樣式 */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * 權限選擇器組件
 *
 * @description
 *   提供分類顯示的權限選擇介面。
 *   使用 Accordion 展示各權限分類，支援全選操作。
 */
export function PermissionSelector({
  value,
  onChange,
  disabled = false,
  className,
}: PermissionSelectorProps) {
  // --- i18n ---
  const t = useTranslations('admin')

  // --- Handlers ---

  /**
   * 處理分類全選/取消
   */
  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    const categoryPermissions = getCategoryPermissionCodes(categoryId)

    if (checked) {
      // 全選：添加該分類所有權限
      const newPermissions = new Set(value)
      categoryPermissions.forEach((p) => newPermissions.add(p))
      onChange(Array.from(newPermissions))
    } else {
      // 取消：移除該分類所有權限
      const newPermissions = value.filter(
        (p) => !categoryPermissions.includes(p as typeof categoryPermissions[number])
      )
      onChange(newPermissions)
    }
  }

  /**
   * 處理單一權限勾選
   */
  const handlePermissionToggle = (permissionCode: string, checked: boolean) => {
    if (checked) {
      onChange([...value, permissionCode])
    } else {
      onChange(value.filter((p) => p !== permissionCode))
    }
  }

  /**
   * 獲取分類的勾選狀態
   */
  const getCategoryState = (categoryId: string) => {
    const hasAll = hasAllCategoryPermissions(value, categoryId)
    const hasSome = hasSomeCategoryPermissions(value, categoryId)

    if (hasAll) return 'checked'
    if (hasSome) return 'indeterminate'
    return 'unchecked'
  }

  // --- Render ---

  return (
    <TooltipProvider>
      <div className={cn('space-y-2', className)}>
        <Accordion type="multiple" className="w-full">
          {PERMISSION_CATEGORIES.map((category) => {
            const categoryState = getCategoryState(category.id)
            const selectedCount = category.permissions.filter((p) =>
              value.includes(p.code)
            ).length

            return (
              <AccordionItem key={category.id} value={category.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={categoryState === 'checked'}
                      ref={(el) => {
                        if (el) {
                          // 設置 indeterminate 狀態
                          const input = el.querySelector('button')
                          if (input) {
                            ;(input as HTMLButtonElement).dataset.state =
                              categoryState === 'indeterminate'
                                ? 'indeterminate'
                                : categoryState === 'checked'
                                  ? 'checked'
                                  : 'unchecked'
                          }
                        }
                      }}
                      onCheckedChange={(checked) => {
                        handleCategoryToggle(category.id, checked === true)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={disabled}
                      className={cn(
                        categoryState === 'indeterminate' &&
                          'data-[state=unchecked]:bg-primary/50'
                      )}
                    />
                    <div className="flex flex-col items-start text-left">
                      <span className="font-medium">{category.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('roles.permissionSelector.permissionCount', {
                          selected: selectedCount,
                          total: category.permissions.length,
                        })}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="ml-8 space-y-3 pt-2">
                    {category.permissions.map((permission) => (
                      <div
                        key={permission.code}
                        className="flex items-start space-x-3"
                      >
                        <Checkbox
                          id={permission.code}
                          checked={value.includes(permission.code)}
                          onCheckedChange={(checked) => {
                            handlePermissionToggle(
                              permission.code,
                              checked === true
                            )
                          }}
                          disabled={disabled}
                        />
                        <div className="flex flex-col">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Label
                                htmlFor={permission.code}
                                className={cn(
                                  'cursor-pointer font-normal',
                                  disabled && 'cursor-not-allowed opacity-50'
                                )}
                              >
                                {permission.name}
                              </Label>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="max-w-xs text-sm">
                                {permission.description}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                          <span className="text-xs text-muted-foreground">
                            {permission.code}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        {/* 已選權限統計 */}
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">{t('roles.permissionSelector.selectedLabel')}</span>
          <span className="font-medium">
            {t('roles.permissionSelector.selectedCount', {
              selected: value.length,
              total: PERMISSION_CATEGORIES.reduce(
                (acc, cat) => acc + cat.permissions.length,
                0
              ),
            })}
          </span>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default PermissionSelector
