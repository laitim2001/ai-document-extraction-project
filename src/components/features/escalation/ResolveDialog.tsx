'use client'

/**
 * @fileoverview 升級案例處理對話框組件
 * @description
 *   提供 Super User 處理升級案例的對話框介面：
 *   - 選擇處理決策（APPROVED/CORRECTED/REJECTED）
 *   - CORRECTED 時可編輯修正項目
 *   - 可選創建規則建議
 *   - 備註輸入
 *
 * @module src/components/features/escalation/ResolveDialog
 * @since Epic 3 - Story 3.8 (Super User 處理升級案例)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/types/escalation - 類型定義
 *   - lucide-react - 圖示
 */

import * as React from 'react'
import {
  CheckCircle,
  Edit,
  XCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  RESOLVE_DECISIONS,
  type ResolveDecision,
  type ResolveEscalationRequest,
  type CorrectionItem,
  type CreateRuleRequest,
  type EscalationFieldData,
} from '@/types/escalation'

// ============================================================
// Types
// ============================================================

interface ResolveDialogProps {
  /** 對話框開啟狀態 */
  open: boolean
  /** 開啟狀態變更回呼 */
  onOpenChange: (open: boolean) => void
  /** 確認處理回呼 */
  onConfirm: (data: ResolveEscalationRequest) => void
  /** 文件名稱（顯示用） */
  documentName: string
  /** 可用的欄位列表（用於修正選擇） */
  fields?: EscalationFieldData[]
  /** 是否正在提交 */
  isSubmitting?: boolean
}

// ============================================================
// Constants
// ============================================================

/**
 * 決策對應的圖示
 */
const DECISION_ICONS: Record<ResolveDecision, React.ElementType> = {
  APPROVED: CheckCircle,
  CORRECTED: Edit,
  REJECTED: XCircle,
}

/**
 * 決策對應的顏色
 */
const DECISION_COLORS: Record<ResolveDecision, string> = {
  APPROVED: 'border-green-500 bg-green-50',
  CORRECTED: 'border-amber-500 bg-amber-50',
  REJECTED: 'border-red-500 bg-red-50',
}

// ============================================================
// Component
// ============================================================

/**
 * 升級案例處理對話框
 *
 * @description 用於 Super User 處理升級案例的對話框。
 *   支持三種處理決策：核准、修正後核准、拒絕。
 *
 * @example
 * ```tsx
 * <ResolveDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   onConfirm={handleResolve}
 *   documentName="invoice-001.pdf"
 *   fields={extractionFields}
 *   isSubmitting={isPending}
 * />
 * ```
 */
export function ResolveDialog({
  open,
  onOpenChange,
  onConfirm,
  documentName,
  fields = [],
  isSubmitting = false,
}: ResolveDialogProps) {
  // --- State ---
  const [decision, setDecision] = React.useState<ResolveDecision | null>(null)
  const [notes, setNotes] = React.useState('')
  const [corrections, setCorrections] = React.useState<CorrectionItem[]>([])
  const [showRuleForm, setShowRuleForm] = React.useState(false)
  const [ruleRequest, setRuleRequest] = React.useState<CreateRuleRequest>({
    fieldName: '',
    suggestedPattern: '',
    description: '',
  })

  // --- Derived State ---
  const canSubmit = React.useMemo(() => {
    if (!decision) return false
    if (decision === 'CORRECTED' && corrections.length === 0) return false
    if (showRuleForm && (!ruleRequest.fieldName || !ruleRequest.suggestedPattern)) {
      return false
    }
    return true
  }, [decision, corrections, showRuleForm, ruleRequest])

  // --- Handlers ---
  const handleConfirm = () => {
    if (!decision) return

    const request: ResolveEscalationRequest = {
      decision,
      notes: notes.trim() || undefined,
    }

    if (decision === 'CORRECTED' && corrections.length > 0) {
      request.corrections = corrections
    }

    if (showRuleForm && ruleRequest.fieldName && ruleRequest.suggestedPattern) {
      request.createRule = {
        fieldName: ruleRequest.fieldName,
        suggestedPattern: ruleRequest.suggestedPattern,
        description: ruleRequest.description || undefined,
      }
    }

    onConfirm(request)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // 關閉時重置狀態
      setDecision(null)
      setNotes('')
      setCorrections([])
      setShowRuleForm(false)
      setRuleRequest({ fieldName: '', suggestedPattern: '', description: '' })
    }
    onOpenChange(newOpen)
  }

  const handleAddCorrection = () => {
    setCorrections([
      ...corrections,
      {
        fieldName: '',
        originalValue: null,
        correctedValue: '',
        correctionType: 'NORMAL',
      },
    ])
  }

  const handleRemoveCorrection = (index: number) => {
    setCorrections(corrections.filter((_, i) => i !== index))
  }

  const handleUpdateCorrection = (
    index: number,
    field: keyof CorrectionItem,
    value: string
  ) => {
    const updated = [...corrections]
    if (field === 'fieldName') {
      // 當選擇欄位時，自動填入原始值
      const selectedField = fields.find((f) => f.name === value)
      updated[index] = {
        ...updated[index],
        fieldName: value,
        originalValue: selectedField?.value || null,
      }
    } else if (field === 'correctionType') {
      updated[index] = {
        ...updated[index],
        correctionType: value as 'NORMAL' | 'EXCEPTION',
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setCorrections(updated)
  }

  // --- Render ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>處理升級案例</DialogTitle>
          <DialogDescription>
            選擇處理決策並完成此升級案例
          </DialogDescription>
        </DialogHeader>

        {/* 文件資訊 */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm">
            <span className="text-muted-foreground">文件：</span>
            <span className="font-medium">{documentName}</span>
          </p>
        </div>

        {/* 決策選擇 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">選擇處理決策</Label>
          <RadioGroup
            value={decision || ''}
            onValueChange={(value) => setDecision(value as ResolveDecision)}
            className="space-y-3"
          >
            {RESOLVE_DECISIONS.map((config) => {
              const Icon = DECISION_ICONS[config.value]
              const isSelected = decision === config.value

              return (
                <div
                  key={config.value}
                  className={cn(
                    'flex items-start space-x-3 rounded-lg border p-4 transition-colors cursor-pointer',
                    isSelected ? DECISION_COLORS[config.value] : 'hover:bg-muted/50'
                  )}
                  onClick={() => setDecision(config.value)}
                >
                  <RadioGroupItem
                    value={config.value}
                    id={config.value}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={config.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          config.color === 'success' && 'text-green-600',
                          config.color === 'warning' && 'text-amber-600',
                          config.color === 'destructive' && 'text-red-600'
                        )}
                      />
                      <span className="font-medium">{config.label}</span>
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {config.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </RadioGroup>
        </div>

        {/* 修正項目（CORRECTED 決策時顯示） */}
        {decision === 'CORRECTED' && (
          <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                修正項目
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCorrection}
              >
                <Plus className="h-4 w-4 mr-1" />
                新增修正
              </Button>
            </div>

            {corrections.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  請新增至少一項修正
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {corrections.map((correction, index) => (
                  <div
                    key={index}
                    className="rounded-lg border p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        修正項目 #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCorrection(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">欄位</Label>
                        <Select
                          value={correction.fieldName}
                          onValueChange={(value) =>
                            handleUpdateCorrection(index, 'fieldName', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="選擇欄位" />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((field) => (
                              <SelectItem key={field.id} value={field.name}>
                                {field.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">修正類型</Label>
                        <Select
                          value={correction.correctionType}
                          onValueChange={(value) =>
                            handleUpdateCorrection(index, 'correctionType', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NORMAL">一般修正</SelectItem>
                            <SelectItem value="EXCEPTION">例外修正</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">原始值</Label>
                        <Input
                          value={correction.originalValue || ''}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">修正值</Label>
                        <Input
                          value={correction.correctedValue}
                          onChange={(e) =>
                            handleUpdateCorrection(
                              index,
                              'correctedValue',
                              e.target.value
                            )
                          }
                          placeholder="輸入修正後的值"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* 備註 */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm">
            備註（選填）
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="輸入處理備註..."
            className="min-h-[60px] resize-none"
            maxLength={2000}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground text-right">
            {notes.length}/2000
          </p>
        </div>

        {/* 創建規則建議 */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createRule"
              checked={showRuleForm}
              onCheckedChange={(checked) => setShowRuleForm(checked === true)}
            />
            <Label htmlFor="createRule" className="text-sm cursor-pointer">
              創建規則建議（連接 Epic 4 規則管理）
            </Label>
          </div>

          {showRuleForm && (
            <div className="space-y-3 pl-6 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-1">
                <Label className="text-xs">
                  欄位名稱 <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={ruleRequest.fieldName}
                  onChange={(e) =>
                    setRuleRequest({ ...ruleRequest, fieldName: e.target.value })
                  }
                  placeholder="例如：Freight Charge"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  建議模式 <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={ruleRequest.suggestedPattern}
                  onChange={(e) =>
                    setRuleRequest({
                      ...ruleRequest,
                      suggestedPattern: e.target.value,
                    })
                  }
                  placeholder="例如：/freight|運費/i"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">描述說明（選填）</Label>
                <Input
                  value={ruleRequest.description}
                  onChange={(e) =>
                    setRuleRequest({
                      ...ruleRequest,
                      description: e.target.value,
                    })
                  }
                  placeholder="說明此規則的用途"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
            className={cn(
              decision === 'APPROVED' && 'bg-green-600 hover:bg-green-700',
              decision === 'CORRECTED' && 'bg-amber-600 hover:bg-amber-700',
              decision === 'REJECTED' && 'bg-red-600 hover:bg-red-700'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                處理中...
              </>
            ) : (
              '確認處理'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
