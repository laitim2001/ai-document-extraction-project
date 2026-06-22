'use client';

/**
 * @fileoverview 格式編輯表單組件
 * @description
 *   提供格式名稱編輯功能的對話框。
 *   使用 React Hook Form 和 Zod 進行表單驗證。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.2
 * @lastModified 2026-01-12
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFormatDetail } from '@/hooks/use-format-detail';
import type { DocumentFormatDetail } from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

export interface FormatFormProps {
  /** 格式詳情 */
  format: DocumentFormatDetail;
  /** 是否開啟 */
  open: boolean;
  /** 關閉回調 */
  onClose: () => void;
  /** 成功回調 */
  onSuccess: () => void;
}

// ============================================================================
// Schema
// ============================================================================

const formSchema = z.object({
  name: z
    .string()
    .min(1, '請輸入格式名稱')
    .max(200, '格式名稱不能超過 200 字元'),
});

type FormValues = z.infer<typeof formSchema>;

// ============================================================================
// Component
// ============================================================================

/**
 * 格式編輯表單組件
 *
 * @description
 *   以對話框形式顯示格式編輯表單，目前支援編輯格式名稱。
 *
 * @param props - 組件屬性
 */
export function FormatForm({ format, open, onClose, onSuccess }: FormatFormProps) {
  const t = useTranslations('formats.editDialog');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const { updateFormat, isUpdating } = useFormatDetail(format.id);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: format.name || '',
    },
  });

  // 重置表單當 format 變更時
  React.useEffect(() => {
    form.reset({
      name: format.name || '',
    });
  }, [format, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await updateFormat({ name: values.name });
      toast({
        title: t('toast.updateSuccess'),
        description: t('toast.updateSuccessDescription'),
      });
      onSuccess();
    } catch (error) {
      toast({
        title: t('toast.updateError'),
        description: error instanceof Error ? error.message : t('toast.updateErrorRetry'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('nameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('namePlaceholder')}
                      {...field}
                      disabled={isUpdating}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('nameDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isUpdating}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? tCommon('actions.saving') : tCommon('actions.save')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
