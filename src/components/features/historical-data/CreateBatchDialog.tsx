'use client'

/**
 * @fileoverview 建立批次對話框組件
 * @description
 *   提供建立新批次的表單對話框
 *
 * @module src/components/features/historical-data/CreateBatchDialog
 * @since Epic 0 - Story 0.1
 * @lastModified 2025-12-23
 */

import * as React from 'react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2 } from 'lucide-react'
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
})

type CreateBatchFormData = z.infer<typeof createBatchSchema>

// ============================================================
// Types
// ============================================================

interface CreateBatchDialogProps {
  /** 建立批次回調 */
  onCreateBatch: (data: { name: string; description?: string }) => Promise<void>
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

  const form = useForm<CreateBatchFormData>({
    resolver: zodResolver(createBatchSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const handleSubmit = async (data: CreateBatchFormData) => {
    setIsSubmitting(true)
    try {
      await onCreateBatch({
        name: data.name,
        description: data.description || undefined,
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
