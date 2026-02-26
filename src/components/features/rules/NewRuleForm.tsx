'use client'

/**
 * @fileoverview 新規則建議表單組件
 * @description
 *   Story 4-2: 建議新映射規則
 *   完整的規則建議創建表單，包含：
 *   - Company 選擇（包含通用規則選項）
 *   - 欄位名稱選擇/輸入
 *   - 提取類型選擇（含可用性標記）
 *   - Pattern 編輯器
 *   - 規則測試面板
 *   - 表單驗證與提交
 *   - 完整 i18n 支援（next-intl）
 *
 * @module src/components/features/rules/NewRuleForm
 * @since Epic 4 - Story 4.2 (建議新映射規則)
 * @lastModified 2026-02-22
 *
 * @dependencies
 *   - react-hook-form - 表單狀態管理
 *   - @hookform/resolvers/zod - Zod 驗證
 *   - @/hooks/useCreateRule - 創建規則 Hook
 *   - @/hooks/useCompanyList - Company 列表 Hook
 *   - next-intl - 國際化
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Link } from '@/i18n/routing'

import { useCreateRule } from '@/hooks/useCreateRule'
import { useCompanyList } from '@/hooks/useCompanyList'
import { RuleTestPanel } from './RuleTestPanel'
import { Loader2, Save, Send, AlertCircle, Info } from 'lucide-react'

// ============================================================
// Types & Constants
// ============================================================

/**
 * 提取類型選項（含可用性標記）
 */
const EXTRACTION_TYPES = [
  { value: 'REGEX', available: true },
  { value: 'KEYWORD', available: true },
  { value: 'POSITION', available: false },
  { value: 'AI_PROMPT', available: false },
  { value: 'TEMPLATE', available: false, hasAlternative: true },
] as const

/**
 * 提取類型值到 i18n key 的映射
 */
const EXTRACTION_TYPE_KEYS: Record<string, string> = {
  REGEX: 'regex',
  KEYWORD: 'keyword',
  POSITION: 'position',
  AI_PROMPT: 'aiPrompt',
  TEMPLATE: 'template',
}

/**
 * 表單驗證 Schema（接受 i18n 翻譯函數）
 */
function createFormSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    companyId: z.string().min(1, t('newRule.validation.companyRequired')),
    fieldName: z.string().min(1, t('newRule.validation.fieldNameRequired')),
    extractionType: z.enum(['REGEX', 'KEYWORD', 'POSITION', 'AI_PROMPT', 'TEMPLATE'], {
      message: t('newRule.validation.extractionTypeRequired'),
    }),
    pattern: z.string().min(1, t('newRule.validation.patternRequired')),
    priority: z.number().min(0).max(100).optional(),
    confidence: z.number().min(0).max(1).optional(),
    description: z.string().optional(),
  })
}

type FormValues = z.infer<ReturnType<typeof createFormSchema>>

/**
 * 常用欄位名稱建議
 */
const COMMON_FIELD_NAMES = [
  'invoice_number',
  'invoice_date',
  'total_amount',
  'currency',
  'shipper_name',
  'consignee_name',
  'origin_port',
  'destination_port',
  'vessel_name',
  'voyage_number',
  'bl_number',
  'container_number',
  'weight',
  'volume',
  'description',
]

// ============================================================
// Component
// ============================================================

/**
 * 新規則建議表單
 *
 * @description
 *   提供完整的規則創建界面，使用 React Hook Form 管理表單狀態，
 *   所有使用者可見文字透過 next-intl 國際化。
 */
export function NewRuleForm() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('rules')

  // --- Hooks ---
  const { data: companies, isLoading: companiesLoading } = useCompanyList()
  const { mutate: createRule, isPending } = useCreateRule({
    onSuccess: (data) => {
      toast({
        title: t('newRule.toast.success'),
        description: data.message,
      })
      router.push('/rules')
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('newRule.toast.error'),
        description: error.message,
      })
    },
  })

  // --- Form ---
  const formSchema = React.useMemo(() => createFormSchema(t), [t])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyId: '',
      fieldName: '',
      extractionType: 'REGEX',
      pattern: '',
      priority: 0,
      confidence: 0.8,
      description: '',
    },
  })

  const watchedValues = form.watch()
  const selectedExtractionType = watchedValues.extractionType

  // --- Handlers ---
  const handleSubmit = (values: FormValues, saveAsDraft: boolean = false) => {
    createRule({
      companyId: values.companyId === 'universal' ? '' : values.companyId,
      fieldName: values.fieldName,
      extractionType: values.extractionType,
      pattern: values.pattern,
      priority: values.priority ?? 0,
      confidence: values.confidence ?? 0.8,
      description: values.description,
      saveAsDraft,
    })
  }

  const onSubmit = (values: FormValues) => {
    handleSubmit(values, false)
  }

  const onSaveDraft = () => {
    const values = form.getValues()
    if (values.companyId && values.fieldName && values.pattern) {
      handleSubmit(values, true)
    } else {
      toast({
        variant: 'destructive',
        title: t('newRule.toast.draftError'),
        description: t('newRule.toast.draftMinFields'),
      })
    }
  }

  // --- Render ---
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本設定區 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('newRule.basicSettings.title')}</CardTitle>
            <CardDescription>
              {t('newRule.basicSettings.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company 選擇 */}
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('newRule.company.label')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={companiesLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('newRule.company.placeholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="universal">
                        <span className="font-medium">
                          {'🌐 '}{t('newRule.company.universalRule')}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {t('newRule.company.universalRuleAppliesAll')}
                        </span>
                      </SelectItem>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.displayName} ({company.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('newRule.company.universalRuleDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 欄位名稱 */}
            <FormField
              control={form.control}
              name="fieldName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('newRule.fieldName.label')}</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        placeholder={t('newRule.fieldName.placeholder')}
                        {...field}
                      />
                      <div className="flex flex-wrap gap-1">
                        {COMMON_FIELD_NAMES.slice(0, 8).map((name) => (
                          <Button
                            key={name}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => form.setValue('fieldName', name)}
                          >
                            {name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t('newRule.fieldName.description')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 描述 */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('newRule.description.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('newRule.description.placeholder')}
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 提取模式區 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('newRule.extractionMode.title')}</CardTitle>
            <CardDescription>
              {t('newRule.extractionMode.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 提取類型選擇 */}
            <FormField
              control={form.control}
              name="extractionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('newRule.extractionMode.typeLabel')}</FormLabel>
                  <Tabs
                    value={field.value}
                    onValueChange={field.onChange}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-5">
                      {EXTRACTION_TYPES.map((type) => (
                        <TabsTrigger key={type.value} value={type.value}>
                          {t(`newRule.extractionTypes.${EXTRACTION_TYPE_KEYS[type.value]}.label`)}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {EXTRACTION_TYPES.map((type) => (
                      <TabsContent
                        key={type.value}
                        value={type.value}
                        className="mt-4"
                      >
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            {t(`newRule.extractionTypes.${EXTRACTION_TYPE_KEYS[type.value]}.description`)}
                          </AlertDescription>
                        </Alert>
                      </TabsContent>
                    ))}
                  </Tabs>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pattern 編輯器 */}
            <FormField
              control={form.control}
              name="pattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('newRule.extractionMode.patternLabel')}</FormLabel>
                  <FormControl>
                    {selectedExtractionType === 'REGEX' ? (
                      <div className="space-y-2">
                        <Input
                          placeholder={t('newRule.regex.placeholder')}
                          className="font-mono"
                          {...field}
                        />
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() =>
                              form.setValue(
                                'pattern',
                                '^Invoice\\s*(?:No|Number|#)?[.:]?\\s*(\\S+)'
                              )
                            }
                          >
                            {t('newRule.regex.presetInvoiceNumber')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() =>
                              form.setValue(
                                'pattern',
                                '\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}'
                              )
                            }
                          >
                            {t('newRule.regex.presetDateFormat')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() =>
                              form.setValue(
                                'pattern',
                                '[A-Z]{3}\\s*[\\d,]+\\.?\\d{0,2}'
                              )
                            }
                          >
                            {t('newRule.regex.presetAmountFormat')}
                          </Button>
                        </div>
                      </div>
                    ) : selectedExtractionType === 'KEYWORD' ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder={t('newRule.keyword.placeholder')}
                          className="font-mono min-h-[120px]"
                          {...field}
                        />
                      </div>
                    ) : selectedExtractionType === 'POSITION' ? (
                      <Alert variant="default">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {t('newRule.extractionTypes.position.notAvailable')}
                        </AlertDescription>
                      </Alert>
                    ) : selectedExtractionType === 'AI_PROMPT' ? (
                      <Alert variant="default">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {t('newRule.extractionTypes.aiPrompt.notAvailable')}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-3">
                        <Alert variant="default">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {t('newRule.extractionTypes.template.notAvailable')}
                          </AlertDescription>
                        </Alert>
                        <Link
                          href="/admin/test/template-matching"
                          className="inline-flex items-center text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {t('newRule.extractionTypes.template.linkText')}
                        </Link>
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 優先級和信心度 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('newRule.priority.label')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t('newRule.priority.description')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('newRule.confidence.label')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0.8)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t('newRule.confidence.description')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 測試面板 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('testPanel.title')}</CardTitle>
            <CardDescription>
              {t('testPanel.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RuleTestPanel
              extractionType={selectedExtractionType}
              pattern={watchedValues.pattern}
            />
          </CardContent>
        </Card>

        {/* 提交按鈕 */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('newRule.buttons.saveDraft')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {t('newRule.buttons.submitReview')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
