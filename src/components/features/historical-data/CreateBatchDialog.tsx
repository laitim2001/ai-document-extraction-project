'use client'

/**
 * @fileoverview 建立批次對話框組件
 * @description
 *   提供建立新批次的表單對話框，包含：
 *   - 批次基本資訊（名稱、描述）
 *   - 公司識別配置選項（Story 0.6）
 *   - 術語聚合配置選項（Story 0.7）
 *
 * @module src/components/features/historical-data/CreateBatchDialog
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-25
 *
 * @features
 *   - Story 0.1: 基本批次建立
 *   - Story 0.6: 公司識別配置
 *   - Story 0.7: 術語聚合配置
 */

import * as React from 'react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Building2, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

// ============================================================
// Schema
// ============================================================

const createBatchSchema = z.object({
  name: z
    .string()
    .min(1, '請輸入批次名稱')
    .max(100, '批次名稱不能超過 100 個字元'),
  description: z
    .string()
    .max(500, '描述不能超過 500 個字元')
    .optional(),
  // Story 0.6: 公司識別配置（不使用 .default()，改用 form 的 defaultValues）
  enableCompanyIdentification: z.boolean(),
  fuzzyMatchThreshold: z.number().min(0.5).max(1),
  autoMergeSimilar: z.boolean(),
  // Story 0.7: 術語聚合配置
  enableTermAggregation: z.boolean(),
  termSimilarityThreshold: z.number().min(0.5).max(1),
  autoClassifyTerms: z.boolean(),
})

type CreateBatchFormData = z.infer<typeof createBatchSchema>

// ============================================================
// Types
// ============================================================

/**
 * 建立批次表單資料
 */
export interface CreateBatchData {
  name: string
  description?: string
  // Story 0.6: 公司識別配置
  enableCompanyIdentification: boolean
  fuzzyMatchThreshold: number
  autoMergeSimilar: boolean
  // Story 0.7: 術語聚合配置
  enableTermAggregation: boolean
  termSimilarityThreshold: number
  autoClassifyTerms: boolean
}

interface CreateBatchDialogProps {
  /** 建立批次回調 */
  onCreateBatch: (data: CreateBatchData) => Promise<void>
  /** 額外的觸發按鈕 props */
  triggerProps?: React.ComponentProps<typeof Button>
}

// ============================================================
// Component
// ============================================================

/**
 * 建立批次對話框
 */
export function CreateBatchDialog({
  onCreateBatch,
  triggerProps,
}: CreateBatchDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const form = useForm<CreateBatchFormData>({
    resolver: zodResolver(createBatchSchema),
    defaultValues: {
      name: '',
      description: '',
      // Story 0.6: 公司識別配置預設值
      enableCompanyIdentification: true,
      fuzzyMatchThreshold: 0.9,
      autoMergeSimilar: false,
      // Story 0.7: 術語聚合配置預設值
      enableTermAggregation: true,
      termSimilarityThreshold: 0.85,
      autoClassifyTerms: false,
    },
  })

  // 監聽是否啟用公司識別
  const enableCompanyId = form.watch('enableCompanyIdentification')
  // Story 0.7: 監聽是否啟用術語聚合
  const enableTermAgg = form.watch('enableTermAggregation')

  const handleSubmit = async (data: CreateBatchFormData) => {
    setIsSubmitting(true)
    try {
      await onCreateBatch({
        name: data.name,
        description: data.description || undefined,
        // Story 0.6: 公司識別配置
        enableCompanyIdentification: data.enableCompanyIdentification,
        fuzzyMatchThreshold: data.fuzzyMatchThreshold,
        autoMergeSimilar: data.autoMergeSimilar,
        // Story 0.7: 術語聚合配置
        enableTermAggregation: data.enableTermAggregation,
        termSimilarityThreshold: data.termSimilarityThreshold,
        autoClassifyTerms: data.autoClassifyTerms,
      })
      form.reset()
      setOpen(false)
    } catch (error) {
      // 錯誤處理由父組件負責
      console.error('Create batch error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...triggerProps}>
          <Plus className="h-4 w-4 mr-2" />
          建立批次
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>建立新批次</DialogTitle>
          <DialogDescription>
            建立一個新的批次以上傳歷史數據文件
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>批次名稱</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如：2024-Q1 歷史發票"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    為批次取一個容易識別的名稱
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述（選填）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="批次說明..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Story 0.6: 公司識別配置 */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full flex items-center justify-between py-2"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    公司識別設定
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {showAdvanced ? '收起' : '展開'}
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* 啟用公司識別 */}
                <FormField
                  control={form.control}
                  name="enableCompanyIdentification"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          啟用公司識別
                        </FormLabel>
                        <FormDescription className="text-xs">
                          自動從文件中識別並匹配公司資料
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* 模糊匹配閾值 - 僅在啟用公司識別時顯示 */}
                {enableCompanyId && (
                  <>
                    <FormField
                      control={form.control}
                      name="fuzzyMatchThreshold"
                      render={({ field }) => (
                        <FormItem className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm font-medium">
                              模糊匹配閾值
                            </FormLabel>
                            <span className="text-sm text-muted-foreground font-mono">
                              {(field.value * 100).toFixed(0)}%
                            </span>
                          </div>
                          <FormControl>
                            <Slider
                              min={50}
                              max={100}
                              step={5}
                              value={[field.value * 100]}
                              onValueChange={(values) =>
                                field.onChange(values[0] / 100)
                              }
                              disabled={isSubmitting}
                              className="mt-2"
                            />
                          </FormControl>
                          <FormDescription className="text-xs mt-1">
                            匹配相似度達此閾值才視為同一公司（建議 85-95%）
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    {/* 自動合併相似公司 */}
                    <FormField
                      control={form.control}
                      name="autoMergeSimilar"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm font-medium">
                              自動合併相似公司
                            </FormLabel>
                            <FormDescription className="text-xs">
                              自動將相似的公司名稱合併為同一公司
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Story 0.7: 術語聚合配置 */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full flex items-center justify-between py-2"
                >
                  <span className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    術語聚合設定
                  </span>
                  <span className="text-xs text-muted-foreground">
                    展開
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* 啟用術語聚合 */}
                <FormField
                  control={form.control}
                  name="enableTermAggregation"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          啟用術語聚合
                        </FormLabel>
                        <FormDescription className="text-xs">
                          批量處理完成後自動聚合術語統計
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* 術語相似度閾值 - 僅在啟用術語聚合時顯示 */}
                {enableTermAgg && (
                  <>
                    <FormField
                      control={form.control}
                      name="termSimilarityThreshold"
                      render={({ field }) => (
                        <FormItem className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm font-medium">
                              術語相似度閾值
                            </FormLabel>
                            <span className="text-sm text-muted-foreground font-mono">
                              {(field.value * 100).toFixed(0)}%
                            </span>
                          </div>
                          <FormControl>
                            <Slider
                              min={50}
                              max={100}
                              step={5}
                              value={[field.value * 100]}
                              onValueChange={(values) =>
                                field.onChange(values[0] / 100)
                              }
                              disabled={isSubmitting}
                              className="mt-2"
                            />
                          </FormControl>
                          <FormDescription className="text-xs mt-1">
                            相似度達此閾值的術語會被視為相同術語（建議 80-90%）
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    {/* 自動分類術語 */}
                    <FormField
                      control={form.control}
                      name="autoClassifyTerms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm font-medium">
                              自動分類術語
                            </FormLabel>
                            <FormDescription className="text-xs">
                              使用 AI 自動將術語分類到費用類別
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    建立中...
                  </>
                ) : (
                  '建立'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
