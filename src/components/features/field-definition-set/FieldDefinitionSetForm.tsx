'use client';

/**
 * @fileoverview FieldDefinitionSet 整合表單
 * @description
 *   提供 FieldDefinitionSet 新增/編輯功能的完整表單：
 *   - 基本資訊（name, scope, description）
 *   - Scope 條件選擇（COMPANY 需 companyId，FORMAT 需兩者）
 *   - FieldCandidatePicker 欄位選擇器整合
 *   - React Hook Form + Zod 驗證
 *
 * @module src/components/features/field-definition-set/FieldDefinitionSetForm
 * @since CHANGE-042 Phase 3
 * @lastModified 2026-02-23
 *
 * @dependencies
 *   - react-hook-form + @hookform/resolvers/zod
 *   - next-intl - 國際化
 *   - @/hooks/use-field-definition-sets - CRUD hooks
 *   - ./FieldCandidatePicker - 欄位選擇器
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateFieldDefinitionSet,
  useUpdateFieldDefinitionSet,
  type FieldDefinitionSetDetail,
} from '@/hooks/use-field-definition-sets';
import { useToast } from '@/hooks/use-toast';
import { FieldCandidatePicker } from './FieldCandidatePicker';
import type { FieldDefinitionEntry } from '@/types/extraction-v3.types';

// ============================================================
// Types
// ============================================================

interface FieldDefinitionSetFormProps {
  initialData?: FieldDefinitionSetDetail;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ============================================================
// Form Schema
// ============================================================

const formSchema = z
  .object({
    name: z.string().min(1),
    scope: z.enum(['GLOBAL', 'COMPANY', 'FORMAT']),
    companyId: z.string().optional().nullable(),
    documentFormatId: z.string().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.scope === 'COMPANY' && !data.companyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyId'],
        message: 'Company is required for COMPANY scope',
      });
    }
    if (data.scope === 'FORMAT') {
      if (!data.companyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['companyId'],
          message: 'Company is required for FORMAT scope',
        });
      }
      if (!data.documentFormatId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['documentFormatId'],
          message: 'Document format is required for FORMAT scope',
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

// ============================================================
// Constants
// ============================================================

const SCOPE_OPTIONS = ['GLOBAL', 'COMPANY', 'FORMAT'] as const;

// ============================================================
// Component
// ============================================================

export function FieldDefinitionSetForm({
  initialData,
  onSuccess,
  onCancel,
}: FieldDefinitionSetFormProps) {
  const router = useRouter();
  const t = useTranslations('fieldDefinitionSet');
  const { toast } = useToast();
  const isEditing = !!initialData;

  // --- Fields state (managed outside RHF due to complex structure) ---
  const [fields, setFields] = React.useState<FieldDefinitionEntry[]>(
    initialData?.fields ?? []
  );

  // --- Mutations ---
  const createMutation = useCreateFieldDefinitionSet();
  const updateMutation = useUpdateFieldDefinitionSet();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // --- Form ---
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      scope: (initialData?.scope as FormValues['scope']) ?? 'GLOBAL',
      companyId: initialData?.companyId ?? null,
      documentFormatId: initialData?.documentFormatId ?? null,
      description: initialData?.description ?? '',
      isActive: initialData?.isActive ?? true,
    },
  });

  const watchScope = form.watch('scope');

  // --- Submit ---
  const onSubmit = async (values: FormValues) => {
    if (fields.length === 0) {
      toast({
        variant: 'destructive',
        title: t('validation.fieldsRequired'),
      });
      return;
    }

    try {
      if (isEditing && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          input: {
            name: values.name,
            description: values.description ?? null,
            isActive: values.isActive,
            fields,
          },
        });
        toast({ title: t('messages.updated') });
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          scope: values.scope,
          companyId: values.companyId ?? null,
          documentFormatId: values.documentFormatId ?? null,
          description: values.description ?? null,
          isActive: values.isActive,
          fields,
        });
        toast({ title: t('messages.created') });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/admin/field-definition-sets');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Something went wrong',
      });
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.name')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('form.namePlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Scope */}
        <FormField
          control={form.control}
          name="scope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.scope')}</FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  // Clear dependent fields when scope changes
                  if (v === 'GLOBAL') {
                    form.setValue('companyId', null);
                    form.setValue('documentFormatId', null);
                  } else if (v === 'COMPANY') {
                    form.setValue('documentFormatId', null);
                  }
                }}
                disabled={isEditing}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SCOPE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`scopeBadge.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{t('form.scopeDescription')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Company (shown for COMPANY and FORMAT scope) */}
        {(watchScope === 'COMPANY' || watchScope === 'FORMAT') && (
          <FormField
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.company')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('form.companyPlaceholder')}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value || null)
                    }
                    disabled={isEditing}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Document Format (shown for FORMAT scope) */}
        {watchScope === 'FORMAT' && (
          <FormField
            control={form.control}
            name="documentFormatId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.format')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('form.formatPlaceholder')}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value || null)
                    }
                    disabled={isEditing}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.description')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('form.descriptionPlaceholder')}
                  rows={3}
                  className="resize-none"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value || null)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Active toggle */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <FormLabel className="text-base">
                  {t('form.isActive')}
                </FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Field definitions picker */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t('form.fields')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('form.fieldsDescription')}
          </p>
          <FieldCandidatePicker
            selectedFields={fields}
            onChange={setFields}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('form.submit')}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('form.cancel')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
