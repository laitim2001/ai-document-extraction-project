'use client'

/**
 * @fileoverview 規則編輯對話框組件
 * @description
 *   Story 5-3: 編輯 Forwarder 映射規則
 *   提供規則編輯的對話框包裝，包含：
 *   - 對話框開關狀態管理
 *   - RuleEditForm 嵌入
 *   - 成功/錯誤處理
 *
 * @module src/components/features/rules/RuleEditDialog
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @/components/ui/dialog - shadcn Dialog 組件
 *   - ./RuleEditForm - 規則編輯表單
 */

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RuleEditForm } from './RuleEditForm'
import { useToast } from '@/hooks/use-toast'

// ============================================================
// Types
// ============================================================

/**
 * 規則資料型別
 */
interface RuleData {
  id: string
  fieldName: string
  fieldLabel: string
  extractionType: string
  extractionPattern: Record<string, unknown>
  priority: number
  confidence: number
  description?: string
  forwarderId: string
}

interface RuleEditDialogProps {
  /** 對話框開關狀態 */
  open: boolean
  /** 開關狀態變更回調 */
  onOpenChange: (open: boolean) => void
  /** 要編輯的規則 */
  rule: RuleData | null
  /** 成功回調 */
  onSuccess?: () => void
}

// ============================================================
// Component
// ============================================================

/**
 * 規則編輯對話框
 *
 * @description
 *   提供規則編輯的對話框界面，成功提交後自動關閉並顯示通知
 *
 * @example
 * ```tsx
 * const [editDialogOpen, setEditDialogOpen] = useState(false)
 * const [selectedRule, setSelectedRule] = useState<RuleData | null>(null)
 *
 * <RuleEditDialog
 *   open={editDialogOpen}
 *   onOpenChange={setEditDialogOpen}
 *   rule={selectedRule}
 *   onSuccess={() => {
 *     queryClient.invalidateQueries(['rules'])
 *   }}
 * />
 * ```
 */
export function RuleEditDialog({
  open,
  onOpenChange,
  rule,
  onSuccess,
}: RuleEditDialogProps) {
  const { toast } = useToast()

  // --- Handlers ---
  const handleSuccess = () => {
    toast({
      title: '變更已提交',
      description: '規則變更請求已提交審核，待審核者批准後生效。',
    })
    onOpenChange(false)
    onSuccess?.()
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  // --- Render ---
  if (!rule) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>編輯規則：{rule.fieldLabel}</DialogTitle>
          <DialogDescription>
            修改規則配置後提交審核，變更將在審核通過後生效
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <RuleEditForm
            rule={rule}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
