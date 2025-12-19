'use client'

/**
 * @fileoverview 規則編輯表單組件
 * @description
 *   Story 5-3: 編輯 Forwarder 映射規則
 *   提供現有規則的編輯界面，包含：
 *   - 提取類型選擇
 *   - Pattern 編輯器
 *   - 優先級和信心度調整
 *   - 變更原因說明
 *   - 預覽功能
 *
 * @module src/components/features/rules/RuleEditForm
 * @since Epic 5 - Story 5.3 (編輯 Forwarder 映射規則)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - react-hook-form - 表單狀態管理
 *   - @hookform/resolvers/zod - Zod 驗證
 *   - @/hooks/useRuleEdit - 規則編輯 Hook
 *   - @/hooks/useRulePreview - 規則預覽 Hook
 */

import * as React from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

import { useUpdateRule } from '@/hooks/useRuleEdit'
import { useRulePreview } from '@/hooks/useRulePreview'
import {
  Loader2,
  Save,
  Eye,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

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
  extractionType: z
    .enum(['REGEX', 'KEYWORD', 'POSITION', 'AI_PROMPT', 'TEMPLATE'])
    .optional(),
  pattern: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().min(1).max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
  description: z.string().max(500).optional(),
  reason: z.string().min(1, '請說明變更原因').max(1000),
})

type FormValues = z.infer<typeof formSchema>

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

interface RuleEditFormProps {
  /** 要編輯的規則 */
  rule: RuleData
  /** 成功回調 */
  onSuccess?: () => void
  /** 取消回調 */
  onCancel?: () => void
}

// ============================================================
// Helper Components
// ============================================================

/**
 * 正則表達式編輯器
 */
function RegexPatternEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const expression = (value.expression as string) ?? ''
  const flags = (value.flags as string) ?? 'gi'
  const groupIndex = (value.groupIndex as number) ?? 1

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>正則表達式</Label>
        <Input
          placeholder="例如: Invoice\\s*(?:No|Number)?[.:]?\\s*(\\S+)"
          className="font-mono"
          value={expression}
          onChange={(e) =>
            onChange({ ...value, expression: e.target.value })
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>旗標 (Flags)</Label>
          <Select
            value={flags}
            onValueChange={(v) => onChange({ ...value, flags: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gi">gi (全域, 不分大小寫)</SelectItem>
              <SelectItem value="g">g (全域)</SelectItem>
              <SelectItem value="i">i (不分大小寫)</SelectItem>
              <SelectItem value="gim">gim (全域, 不分大小寫, 多行)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>擷取群組索引</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={groupIndex}
            onChange={(e) =>
              onChange({ ...value, groupIndex: parseInt(e.target.value) || 1 })
            }
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 關鍵字編輯器
 */
function KeywordPatternEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const keywords = (value.keywords as string[]) ?? []
  const searchDirection = (value.searchDirection as string) ?? 'right'
  const extractLength = (value.extractLength as number) ?? 50

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>關鍵字（每行一個）</Label>
        <Textarea
          placeholder="Invoice No&#10;Invoice Number&#10;INV#"
          className="font-mono min-h-[100px]"
          value={keywords.join('\n')}
          onChange={(e) =>
            onChange({
              ...value,
              keywords: e.target.value.split('\n').filter((k) => k.trim()),
            })
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>搜尋方向</Label>
          <Select
            value={searchDirection}
            onValueChange={(v) => onChange({ ...value, searchDirection: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="right">右側</SelectItem>
              <SelectItem value="left">左側</SelectItem>
              <SelectItem value="below">下方</SelectItem>
              <SelectItem value="above">上方</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>提取長度</Label>
          <Input
            type="number"
            min={10}
            max={200}
            value={extractLength}
            onChange={(e) =>
              onChange({
                ...value,
                extractLength: parseInt(e.target.value) || 50,
              })
            }
          />
        </div>
      </div>
    </div>
  )
}

/**
 * AI 提示詞編輯器
 */
function AIPromptPatternEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const prompt = (value.prompt as string) ?? ''

  return (
    <div className="space-y-2">
      <Label>AI 提示詞</Label>
      <Textarea
        placeholder="請從文件中提取發票號碼..."
        className="min-h-[120px]"
        value={prompt}
        onChange={(e) => onChange({ ...value, prompt: e.target.value })}
      />
      <p className="text-sm text-muted-foreground">
        提示詞將發送給 AI 模型，請清楚描述要提取的內容
      </p>
    </div>
  )
}

/**
 * 預覽結果顯示
 */
function PreviewResult({
  data,
  isLoading,
  error,
}: {
  data?: {
    matched: boolean
    extractedValue: string | null
    confidence: number
    processingTime: number
    debugInfo?: {
      patternMatched: boolean
      matchDetails?: string
      errorMessage?: string
    }
  }
  isLoading: boolean
  error: Error | null
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">預覽中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground text-center p-4">
        點擊「預覽」按鈕測試規則效果
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {data.matched ? (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            匹配成功
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            未匹配
          </Badge>
        )}
        <Badge variant="outline">信心度: {(data.confidence * 100).toFixed(0)}%</Badge>
        <Badge variant="secondary">{data.processingTime}ms</Badge>
      </div>

      {data.matched && data.extractedValue && (
        <div className="rounded-md border p-3 bg-muted/50">
          <Label className="text-xs text-muted-foreground">提取的值</Label>
          <p className="mt-1 font-mono">{data.extractedValue}</p>
        </div>
      )}

      {data.debugInfo?.matchDetails && (
        <p className="text-xs text-muted-foreground">
          {data.debugInfo.matchDetails}
        </p>
      )}

      {data.debugInfo?.errorMessage && (
        <p className="text-xs text-destructive">{data.debugInfo.errorMessage}</p>
      )}
    </div>
  )
}

// ============================================================
// Component
// ============================================================

/**
 * 規則編輯表單
 *
 * @description
 *   提供現有規則的編輯界面，變更會創建待審核的變更請求
 */
export function RuleEditForm({ rule, onSuccess, onCancel }: RuleEditFormProps) {
  // --- State ---
  const [patternValue, setPatternValue] = React.useState<Record<string, unknown>>(
    rule.extractionPattern
  )
  const [testContent, setTestContent] = React.useState('')

  // --- Hooks ---
  const {
    mutate: updateRule,
    isPending: isUpdating,
  } = useUpdateRule({
    onSuccess: () => {
      onSuccess?.()
    },
  })

  const {
    mutate: previewRule,
    isPending: isPreviewing,
    data: previewData,
    error: previewError,
    reset: resetPreview,
  } = useRulePreview()

  // --- Form ---
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      extractionType: rule.extractionType as FormValues['extractionType'],
      pattern: rule.extractionPattern,
      priority: rule.priority,
      confidence: rule.confidence,
      description: rule.description ?? '',
      reason: '',
    },
  })

  const watchedExtractionType = form.watch('extractionType')

  // --- Effects ---
  React.useEffect(() => {
    form.setValue('pattern', patternValue)
    resetPreview()
  }, [patternValue, form, resetPreview])

  // --- Handlers ---
  const handleSubmit = (values: FormValues) => {
    updateRule({
      forwarderId: rule.forwarderId,
      ruleId: rule.id,
      updates: {
        extractionType: values.extractionType
          ? (values.extractionType as 'REGEX' | 'KEYWORD' | 'POSITION' | 'AI_PROMPT' | 'TEMPLATE')
          : undefined,
        pattern: patternValue,
        priority: values.priority,
        confidence: values.confidence,
        description: values.description,
      },
      reason: values.reason,
    })
  }

  const handlePreview = () => {
    if (!testContent) return

    previewRule({
      ruleId: rule.id,
      documentContent: testContent,
      previewPattern: patternValue,
      previewExtractionType: watchedExtractionType
        ? (watchedExtractionType as 'REGEX' | 'KEYWORD' | 'POSITION' | 'AI_PROMPT' | 'TEMPLATE')
        : undefined,
    })
  }

  // --- Render Pattern Editor ---
  const renderPatternEditor = () => {
    switch (watchedExtractionType) {
      case 'REGEX':
        return (
          <RegexPatternEditor value={patternValue} onChange={setPatternValue} />
        )
      case 'KEYWORD':
        return (
          <KeywordPatternEditor value={patternValue} onChange={setPatternValue} />
        )
      case 'AI_PROMPT':
        return (
          <AIPromptPatternEditor value={patternValue} onChange={setPatternValue} />
        )
      case 'POSITION':
        return (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              座標位置提取需要 OCR 座標資訊，建議使用測試面板獲取座標
            </AlertDescription>
          </Alert>
        )
      case 'TEMPLATE':
        return (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>模板匹配編輯功能尚未開放</AlertDescription>
          </Alert>
        )
      default:
        return null
    }
  }

  // --- Render ---
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* 規則資訊 */}
        <div className="rounded-lg border p-4 bg-muted/30">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">欄位名稱：</span>
              <span className="font-medium ml-2">{rule.fieldName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">欄位標籤：</span>
              <span className="font-medium ml-2">{rule.fieldLabel}</span>
            </div>
          </div>
        </div>

        {/* 提取類型 */}
        <FormField
          control={form.control}
          name="extractionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>提取類型</FormLabel>
              <Tabs
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  // 重置 pattern 為基礎結構
                  if (v !== rule.extractionType) {
                    setPatternValue({})
                  }
                }}
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
                  <TabsContent key={type.value} value={type.value} className="mt-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>{type.description}</AlertDescription>
                    </Alert>
                  </TabsContent>
                ))}
              </Tabs>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Pattern 編輯器 */}
        <div className="space-y-2">
          <Label>提取模式配置</Label>
          {renderPatternEditor()}
        </div>

        {/* 優先級和信心度 */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>優先級 (1-100)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 50)
                    }
                  />
                </FormControl>
                <FormDescription>數字越大優先級越高</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confidence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>信心度閾值 (0-1)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || 0.8)
                    }
                  />
                </FormControl>
                <FormDescription>建議 0.7-0.9 之間</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

        <Separator />

        {/* 預覽區域 */}
        <div className="space-y-4">
          <Label>規則預覽</Label>
          <div className="space-y-2">
            <Textarea
              placeholder="貼上測試文本內容..."
              className="min-h-[100px] font-mono text-sm"
              value={testContent}
              onChange={(e) => {
                setTestContent(e.target.value)
                resetPreview()
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={isPreviewing || !testContent}
              className="w-full"
            >
              {isPreviewing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              預覽
            </Button>
          </div>

          <div className="rounded-lg border p-4">
            <PreviewResult
              data={previewData}
              isLoading={isPreviewing}
              error={previewError}
            />
          </div>
        </div>

        <Separator />

        {/* 變更原因 */}
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>變更原因 *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="請說明為什麼需要修改此規則..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                變更原因將記錄在審核歷史中
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 提交按鈕 */}
        <div className="flex justify-end gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button type="submit" disabled={isUpdating}>
            {isUpdating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            提交變更
          </Button>
        </div>
      </form>
    </Form>
  )
}
