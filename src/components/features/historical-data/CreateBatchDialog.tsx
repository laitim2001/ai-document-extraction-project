'use client'

/**
 * @fileoverview 建立批次對話框組件（國際化版本）
 * @description
 *   提供建立新批次的表單對話框，包含：
 *   - 批次基本資訊（名稱、描述）
 *   - 公司識別配置選項（Story 0.6）
 *   - 術語聚合配置選項（Story 0.7）
 *   - 發行者識別配置選項（Story 0.8）
 *   - 完整國際化支援
 *
 * @module src/components/features/historical-data/CreateBatchDialog
 * @since Epic 0 - Story 0.1
 * @lastModified 2026-01-17
 *
 * @features
 *   - Story 0.1: 基本批次建立
 *   - Story 0.6: 公司識別配置
 *   - Story 0.7: 術語聚合配置
 *   - Story 0.8: 發行者識別配置
 *   - Epic 17: 完整國際化支援
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2, Building2, Hash, FileText } from 'lucide-react'
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
// Schema Factory
// ============================================================

function createBatchSchemaFactory(t: (key: string) => string) {
  return z.object({
    name: z
      .string()
      .min(1, t('createBatchDialog.validation.nameRequired'))
      .max(100, t('createBatchDialog.validation.nameMaxLength')),
    description: z
      .string()
      .max(500, t('createBatchDialog.validation.descriptionMaxLength'))
      .optional(),
    // Story 0.6: 公司識別配置（不使用 .default()，改用 form 的 defaultValues）
    enableCompanyIdentification: z.boolean(),
    fuzzyMatchThreshold: z.number().min(0.5).max(1),
    autoMergeSimilar: z.boolean(),
    // Story 0.7: 術語聚合配置
    enableTermAggregation: z.boolean(),
    termSimilarityThreshold: z.number().min(0.5).max(1),
    autoClassifyTerms: z.boolean(),
    // Story 0.8: 發行者識別配置
    enableIssuerIdentification: z.boolean(),
    issuerConfidenceThreshold: z.number().min(0.5).max(1),
    autoCreateIssuerCompany: z.boolean(),
    issuerFuzzyThreshold: z.number().min(0.5).max(1),
  })
}

type CreateBatchFormData = z.infer<ReturnType<typeof createBatchSchemaFactory>>

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
  // Story 0.8: 發行者識別配置
  enableIssuerIdentification: boolean
  issuerConfidenceThreshold: number
  autoCreateIssuerCompany: boolean
  issuerFuzzyThreshold: number
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
  const t = useTranslations('historicalData')
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showTermAggregation, setShowTermAggregation] = useState(false)
  const [showIssuerIdentification, setShowIssuerIdentification] = useState(false)

  // Create schema with i18n validation messages
  const createBatchSchema = React.useMemo(() => createBatchSchemaFactory(t), [t])

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
      // Story 0.8: 發行者識別配置預設值
      enableIssuerIdentification: true,
      issuerConfidenceThreshold: 0.7,
      autoCreateIssuerCompany: true,
      issuerFuzzyThreshold: 0.9,
    },
  })

  // 監聽是否啟用公司識別
  const enableCompanyId = form.watch('enableCompanyIdentification')
  // Story 0.7: 監聽是否啟用術語聚合
  const enableTermAgg = form.watch('enableTermAggregation')
  // Story 0.8: 監聽是否啟用發行者識別
  const enableIssuerId = form.watch('enableIssuerIdentification')

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
        // Story 0.8: 發行者識別配置
        enableIssuerIdentification: data.enableIssuerIdentification,
        issuerConfidenceThreshold: data.issuerConfidenceThreshold,
        autoCreateIssuerCompany: data.autoCreateIssuerCompany,
        issuerFuzzyThreshold: data.issuerFuzzyThreshold,
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
          {t('createBatchDialog.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('createBatchDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createBatchDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('createBatchDialog.form.name.label')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('createBatchDialog.form.name.placeholder')}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('createBatchDialog.form.name.description')}
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
                  <FormLabel>{t('createBatchDialog.form.description.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('createBatchDialog.form.description.placeholder')}
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
                    {t('createBatchDialog.companyIdentification.title')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {showAdvanced ? t('createBatchDialog.sections.collapse') : t('createBatchDialog.sections.expand')}
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
                          {t('createBatchDialog.companyIdentification.enable.label')}
                        </FormLabel>
                        <FormDescription className="text-xs">
                          {t('createBatchDialog.companyIdentification.enable.description')}
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
                              {t('createBatchDialog.companyIdentification.fuzzyThreshold.label')}
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
                            {t('createBatchDialog.companyIdentification.fuzzyThreshold.description')}
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
                              {t('createBatchDialog.companyIdentification.autoMerge.label')}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {t('createBatchDialog.companyIdentification.autoMerge.description')}
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
            <Collapsible open={showTermAggregation} onOpenChange={setShowTermAggregation}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full flex items-center justify-between py-2"
                >
                  <span className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    {t('createBatchDialog.termAggregation.title')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {showTermAggregation ? t('createBatchDialog.sections.collapse') : t('createBatchDialog.sections.expand')}
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
                          {t('createBatchDialog.termAggregation.enable.label')}
                        </FormLabel>
                        <FormDescription className="text-xs">
                          {t('createBatchDialog.termAggregation.enable.description')}
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
                              {t('createBatchDialog.termAggregation.similarityThreshold.label')}
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
                            {t('createBatchDialog.termAggregation.similarityThreshold.description')}
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
                              {t('createBatchDialog.termAggregation.autoClassify.label')}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {t('createBatchDialog.termAggregation.autoClassify.description')}
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

            {/* Story 0.8: 發行者識別配置 */}
            <Collapsible open={showIssuerIdentification} onOpenChange={setShowIssuerIdentification}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full flex items-center justify-between py-2"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('createBatchDialog.issuerIdentification.title')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {showIssuerIdentification ? t('createBatchDialog.sections.collapse') : t('createBatchDialog.sections.expand')}
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* 啟用發行者識別 */}
                <FormField
                  control={form.control}
                  name="enableIssuerIdentification"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          {t('createBatchDialog.issuerIdentification.enable.label')}
                        </FormLabel>
                        <FormDescription className="text-xs">
                          {t('createBatchDialog.issuerIdentification.enable.description')}
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

                {/* 發行者識別選項 - 僅在啟用時顯示 */}
                {enableIssuerId && (
                  <>
                    {/* 發行者信心度閾值 */}
                    <FormField
                      control={form.control}
                      name="issuerConfidenceThreshold"
                      render={({ field }) => (
                        <FormItem className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm font-medium">
                              {t('createBatchDialog.issuerIdentification.confidenceThreshold.label')}
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
                            {t('createBatchDialog.issuerIdentification.confidenceThreshold.description')}
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    {/* 發行者模糊匹配閾值 */}
                    <FormField
                      control={form.control}
                      name="issuerFuzzyThreshold"
                      render={({ field }) => (
                        <FormItem className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm font-medium">
                              {t('createBatchDialog.issuerIdentification.fuzzyThreshold.label')}
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
                            {t('createBatchDialog.issuerIdentification.fuzzyThreshold.description')}
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    {/* 自動建立發行公司 */}
                    <FormField
                      control={form.control}
                      name="autoCreateIssuerCompany"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm font-medium">
                              {t('createBatchDialog.issuerIdentification.autoCreate.label')}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {t('createBatchDialog.issuerIdentification.autoCreate.description')}
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
                {t('createBatchDialog.actions.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('createBatchDialog.actions.creating')}
                  </>
                ) : (
                  t('createBatchDialog.actions.create')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
