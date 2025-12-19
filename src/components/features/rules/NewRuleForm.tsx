'use client'

/**
 * @fileoverview 新規則建議表單組件
 * @description
 *   Story 4-2: 建議新映射規則
 *   完整的規則建議創建表單，包含：
 *   - Forwarder 選擇（包含通用規則選項）
 *   - 欄位名稱選擇/輸入
 *   - 提取類型選擇
 *   - Pattern 編輯器
 *   - 規則測試面板
 *   - 表單驗證與提交
 *
 * @module src/components/features/rules/NewRuleForm
 * @since Epic 4 - Story 4.2 (建議新映射規則)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - react-hook-form - 表單狀態管理
 *   - @hookform/resolvers/zod - Zod 驗證
 *   - @/hooks/useCreateRule - 創建規則 Hook
 *   - @/hooks/useForwarderList - Forwarder 列表 Hook
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

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

import { useCreateRule } from '@/hooks/useCreateRule'
import { useForwarderList } from '@/hooks/useForwarderList'
import { RuleTestPanel } from './RuleTestPanel'
import { Loader2, Save, Send, AlertCircle, Info } from 'lucide-react'

// ============================================================
// Types & Constants
// ============================================================

/**
 * 提取類型選項
 */
const EXTRACTION_TYPES = [
  {
    value: 'REGEX',
    label: '正則表達式',
    description: '使用正則表達式匹配並提取文字',
  },
  {
    value: 'KEYWORD',
    label: '關鍵字',
    description: '根據關鍵字位置提取相鄰文字',
  },
  {
    value: 'POSITION',
    label: '座標位置',
    description: '根據 PDF 座標提取特定區域（需 OCR 支援）',
  },
  {
    value: 'AI_PROMPT',
    label: 'AI 提示詞',
    description: '使用 AI 理解並提取內容（需 AI 服務）',
  },
  {
    value: 'TEMPLATE',
    label: '模板匹配',
    description: '使用預定義模板匹配並提取（需模板系統）',
  },
] as const

/**
 * 表單驗證 Schema
 */
const formSchema = z.object({
  forwarderId: z.string().min(1, '請選擇 Forwarder 或通用規則'),
  fieldName: z.string().min(1, '請輸入欄位名稱'),
  extractionType: z.enum(['REGEX', 'KEYWORD', 'POSITION', 'AI_PROMPT', 'TEMPLATE'], {
    message: '請選擇提取類型',
  }),
  pattern: z.string().min(1, '請輸入提取模式'),
  priority: z.number().min(0).max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

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
 *   提供完整的規則創建界面，使用 React Hook Form 管理表單狀態
 */
export function NewRuleForm() {
  const router = useRouter()
  const { toast } = useToast()

  // --- Hooks ---
  const { data: forwarders, isLoading: forwardersLoading } = useForwarderList()
  const { mutate: createRule, isPending } = useCreateRule({
    onSuccess: (data) => {
      toast({
        title: '成功',
        description: data.message,
      })
      router.push('/rules')
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: '錯誤',
        description: error.message,
      })
    },
  })

  // --- Form ---
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      forwarderId: '',
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
      forwarderId: values.forwarderId === 'universal' ? '' : values.forwarderId,
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
    if (values.forwarderId && values.fieldName && values.pattern) {
      handleSubmit(values, true)
    } else {
      toast({
        variant: 'destructive',
        title: '無法存為草稿',
        description: '請至少填寫 Forwarder、欄位名稱和提取模式',
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
            <CardTitle>基本設定</CardTitle>
            <CardDescription>
              選擇此規則適用的 Forwarder 和目標欄位
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Forwarder 選擇 */}
            <FormField
              control={form.control}
              name="forwarderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forwarder</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={forwardersLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇 Forwarder..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="universal">
                        <span className="font-medium">🌐 通用規則</span>
                        <span className="text-muted-foreground ml-2">
                          (適用所有 Forwarder)
                        </span>
                      </SelectItem>
                      {forwarders?.map((fw) => (
                        <SelectItem key={fw.id} value={fw.id}>
                          {fw.name} ({fw.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    選擇「通用規則」將適用於所有 Forwarder
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
                  <FormLabel>欄位名稱</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        placeholder="例如: invoice_number"
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
                    輸入欄位名稱或點擊建議
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
                  <FormLabel>描述（選填）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="說明此規則的用途或特殊情況..."
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
            <CardTitle>提取模式</CardTitle>
            <CardDescription>
              配置如何從文件中提取目標欄位的值
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 提取類型選擇 */}
            <FormField
              control={form.control}
              name="extractionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>提取類型</FormLabel>
                  <Tabs
                    value={field.value}
                    onValueChange={field.onChange}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-5">
                      {EXTRACTION_TYPES.map((type) => (
                        <TabsTrigger key={type.value} value={type.value}>
                          {type.label}
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
                            {type.description}
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
                  <FormLabel>提取模式配置</FormLabel>
                  <FormControl>
                    {selectedExtractionType === 'REGEX' ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="輸入正則表達式，例如: ^Invoice No[.:]?\s*(\S+)"
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
                            發票號碼
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
                            日期格式
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
                            金額格式
                          </Button>
                        </div>
                      </div>
                    ) : selectedExtractionType === 'KEYWORD' ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder={`輸入 JSON 格式：
{
  "keywords": ["Invoice No", "Invoice Number"],
  "position": "after",
  "maxDistance": 100
}`}
                          className="font-mono min-h-[120px]"
                          {...field}
                        />
                      </div>
                    ) : selectedExtractionType === 'POSITION' ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          座標位置提取需要 OCR 處理過的文件座標資訊，
                          建議先使用測試面板獲取座標。
                        </AlertDescription>
                      </Alert>
                    ) : selectedExtractionType === 'AI_PROMPT' ? (
                      <Textarea
                        placeholder="輸入 AI 提示詞，例如：請從發票中提取發票號碼"
                        className="min-h-[120px]"
                        {...field}
                      />
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          模板匹配需要先建立模板，此功能尚未開放。
                        </AlertDescription>
                      </Alert>
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
                    <FormLabel>優先級 (0-100)</FormLabel>
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
                      數字越大優先級越高
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
                    <FormLabel>預設信心度 (0-1)</FormLabel>
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
                      建議 0.7-0.9 之間
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
            <CardTitle>測試規則</CardTitle>
            <CardDescription>
              在提交前測試提取效果，確保規則正確運作
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
            存為草稿
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            提交審核
          </Button>
        </div>
      </form>
    </Form>
  )
}
