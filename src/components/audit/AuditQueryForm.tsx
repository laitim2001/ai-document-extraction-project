'use client'

/**
 * @fileoverview 審計查詢表單組件
 * @description
 *   提供審計查詢的多條件篩選表單：
 *   - 日期範圍選擇（必填）
 *   - 城市、Forwarder、狀態篩選
 *   - 結果計數預覽
 *   - 大量結果警告
 *
 * @module src/components/audit/AuditQueryForm
 * @since Epic 8 - Story 8.3 (處理記錄查詢)
 * @lastModified 2025-12-20
 *
 * @features
 *   - AC1: 查詢表單（時間範圍、城市、狀態篩選）
 *   - AC4: 大量結果處理（超過 10,000 筆警告）
 *
 * @dependencies
 *   - react-hook-form - 表單管理
 *   - @hookform/resolvers/zod - Zod 驗證
 *   - date-fns - 日期處理
 *   - @/types/audit-query - 類型定義
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, subDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { CalendarIcon, Search, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  AuditQueryParams,
  AuditQueryFormValues,
  auditQueryFormSchema,
  CountPreview,
  STATUS_OPTIONS,
  MAX_QUERY_RESULTS
} from '@/types/audit-query'

// ============================================================
// Types
// ============================================================

interface AuditQueryFormProps {
  /** 執行查詢回調 */
  onQuery: (params: AuditQueryParams) => void
  /** 獲取結果計數預覽回調 */
  onPreviewCount: (params: AuditQueryParams) => Promise<CountPreview>
  /** 是否正在載入 */
  loading?: boolean
  /** 自定義 className */
  className?: string
}

// ============================================================
// Component
// ============================================================

/**
 * @component AuditQueryForm
 * @description
 *   審計查詢表單組件，支援多條件篩選和大量結果預覽。
 */
export function AuditQueryForm({
  onQuery,
  onPreviewCount,
  loading = false,
  className
}: AuditQueryFormProps) {
  // --- State ---
  const [countPreview, setCountPreview] = useState<CountPreview | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // --- Form ---
  const form = useForm<AuditQueryFormValues>({
    resolver: zodResolver(auditQueryFormSchema),
    defaultValues: {
      startDate: subDays(new Date(), 7),
      endDate: new Date(),
      cityCodes: [],
      forwarderIds: [],
      statuses: [],
      operatorIds: []
    }
  })

  // --- Handlers ---
  const handleSubmit = async (values: AuditQueryFormValues) => {
    const params: AuditQueryParams = {
      startDate: values.startDate.toISOString(),
      endDate: values.endDate.toISOString(),
      cityCodes: values.cityCodes?.length ? values.cityCodes : undefined,
      forwarderIds: values.forwarderIds?.length ? values.forwarderIds : undefined,
      statuses: values.statuses?.length ? values.statuses : undefined,
      operatorIds: values.operatorIds?.length ? values.operatorIds : undefined
    }

    // 先獲取計數預覽
    setIsPreviewLoading(true)
    try {
      const preview = await onPreviewCount(params)
      setCountPreview(preview)

      // 如果未超過限制，執行查詢
      if (!preview.exceedsLimit) {
        onQuery(params)
      }
    } catch (error) {
      console.error('Failed to preview count:', error)
      // 即使預覽失敗，也嘗試執行查詢
      onQuery(params)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleForceQuery = () => {
    const values = form.getValues()
    const params: AuditQueryParams = {
      startDate: values.startDate.toISOString(),
      endDate: values.endDate.toISOString(),
      cityCodes: values.cityCodes?.length ? values.cityCodes : undefined,
      forwarderIds: values.forwarderIds?.length ? values.forwarderIds : undefined,
      statuses: values.statuses?.length ? values.statuses : undefined,
      operatorIds: values.operatorIds?.length ? values.operatorIds : undefined
    }
    onQuery(params)
    setCountPreview(null)
  }

  // --- Render ---
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn('space-y-4', className)}
      >
        {/* 篩選條件 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 開始日期 */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>開始日期 *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value
                          ? format(field.value, 'yyyy-MM-dd', { locale: zhTW })
                          : '選擇日期'}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={date => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 結束日期 */}
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>結束日期 *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value
                          ? format(field.value, 'yyyy-MM-dd', { locale: zhTW })
                          : '選擇日期'}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={date => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 處理狀態 */}
          <FormField
            control={form.control}
            name="statuses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>處理狀態</FormLabel>
                <Select
                  onValueChange={value =>
                    field.onChange(value === 'all' ? [] : [value])
                  }
                  value={field.value?.[0] || 'all'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="全部狀態" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="all">全部狀態</SelectItem>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* 查詢按鈕 */}
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={loading || isPreviewLoading}
              className="w-full"
            >
              {(loading || isPreviewLoading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Search className="mr-2 h-4 w-4" />
              查詢
            </Button>
          </div>
        </div>

        {/* 結果超過限制警告 */}
        {countPreview?.exceedsLimit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>結果過多</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                查詢結果共 {countPreview.count.toLocaleString()} 筆，超過上限{' '}
                {MAX_QUERY_RESULTS.toLocaleString()} 筆。請縮小查詢範圍或使用匯出功能。
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceQuery}
                disabled={loading}
              >
                仍要查詢（僅顯示部分）
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 結果計數提示（未超過限制時） */}
        {countPreview && !countPreview.exceedsLimit && countPreview.count > 0 && (
          <div className="text-sm text-muted-foreground">
            共找到 {countPreview.count.toLocaleString()} 筆符合條件的記錄
          </div>
        )}
      </form>
    </Form>
  )
}
