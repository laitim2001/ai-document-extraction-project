'use client';

/**
 * @fileoverview 創建模版實例對話框組件
 * @description
 *   提供對話框介面讓用戶創建新的模版實例
 *
 * @module src/components/features/template-instance/CreateInstanceDialog
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Plus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useCreateTemplateInstance, useDataTemplateOptions } from '@/hooks/use-template-instances';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface CreateInstanceDialogProps {
  triggerVariant?: 'default' | 'outline' | 'ghost';
  className?: string;
  onSuccess?: () => void;
}

// ============================================================================
// Form Schema
// ============================================================================

const formSchema = z.object({
  dataTemplateId: z.string().min(1, '請選擇數據模版'),
  name: z.string().min(1, '名稱不能為空').max(200, '名稱不能超過 200 個字元'),
  description: z.string().max(1000, '描述過長').optional(),
});

type FormData = z.infer<typeof formSchema>;

// ============================================================================
// Component
// ============================================================================

/**
 * 創建模版實例對話框
 */
export function CreateInstanceDialog({
  triggerVariant = 'default',
  className,
  onSuccess,
}: CreateInstanceDialogProps) {
  const t = useTranslations('templateInstance');
  const tCommon = useTranslations('common');
  const [open, setOpen] = React.useState(false);

  const { data: templates = [], isLoading: isLoadingTemplates } = useDataTemplateOptions();
  const { mutate: createInstance, isPending } = useCreateTemplateInstance();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dataTemplateId: '',
      name: '',
      description: '',
    },
  });

  // Reset form when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
    }
  };

  // Submit form
  const handleSubmit = (data: FormData) => {
    createInstance(
      {
        dataTemplateId: data.dataTemplateId,
        name: data.name,
        description: data.description || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('toast.createSuccess'));
          handleOpenChange(false);
          onSuccess?.();
        },
        onError: (error) => {
          toast.error(t('toast.createError'), {
            description: error.message,
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className={className}>
          <Plus className="mr-2 h-4 w-4" />
          {t('createDialog.triggerButton')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* 數據模版選擇 */}
            <FormField
              control={form.control}
              name="dataTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('createDialog.templateLabel')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isLoadingTemplates}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('createDialog.templatePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{t('createDialog.templateDescription')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 實例名稱 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('createDialog.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('createDialog.namePlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>{t('createDialog.nameDescription')}</FormDescription>
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
                  <FormLabel>{t('createDialog.descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('createDialog.descriptionPlaceholder')}
                      rows={3}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? t('createDialog.creating') : t('createDialog.submitButton')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
