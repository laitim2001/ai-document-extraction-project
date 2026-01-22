/**
 * @fileoverview 模版欄位映射表單組件
 * @description
 *   用於創建和編輯 TemplateFieldMapping 配置
 *   包含基本資訊、映射規則編輯和測試預覽
 *
 * @module src/components/features/template-field-mapping
 * @since Epic 19 - Story 19.4
 * @lastModified 2026-01-22
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

import { MappingRuleEditor } from './MappingRuleEditor';
import { MappingTestPanel } from './MappingTestPanel';
import type { TemplateField } from './TargetFieldSelector';
import {
  useCreateTemplateFieldMapping,
  useUpdateTemplateFieldMapping,
  useTemplateFieldMapping,
} from '@/hooks/use-template-field-mappings';
import type {
  TemplateFieldMapping,
  TemplateFieldMappingScope,
  TemplateFieldMappingRuleInput,
} from '@/types/template-field-mapping';
import { SCOPE_OPTIONS } from '@/types/template-field-mapping';

// ============================================================================
// Types
// ============================================================================

interface TemplateFieldMappingFormProps {
  mappingId?: string;
  dataTemplates: Array<{ id: string; name: string; fields: TemplateField[] }>;
  companies: Array<{ id: string; name: string }>;
  documentFormats: Array<{ id: string; name: string }>;
  className?: string;
}

// ============================================================================
// Form Schema
// ============================================================================

const formSchema = z.object({
  dataTemplateId: z.string().min(1, '請選擇數據模版'),
  scope: z.enum(['GLOBAL', 'COMPANY', 'FORMAT']),
  companyId: z.string().optional(),
  documentFormatId: z.string().optional(),
  name: z.string().min(1, '名稱不能為空').max(200, '名稱過長'),
  description: z.string().max(1000).optional(),
  priority: z.number().int().min(0).max(1000),
  isActive: z.boolean(),
}).refine(
  (data) => {
    if (data.scope === 'COMPANY' && !data.companyId) {
      return false;
    }
    return true;
  },
  { message: '公司範圍需要選擇公司', path: ['companyId'] }
).refine(
  (data) => {
    if (data.scope === 'FORMAT' && !data.documentFormatId) {
      return false;
    }
    return true;
  },
  { message: '格式範圍需要選擇文件格式', path: ['documentFormatId'] }
);

type FormValues = z.infer<typeof formSchema>;

// ============================================================================
// Main Component
// ============================================================================

/**
 * @component TemplateFieldMappingForm
 * @description 模版欄位映射表單
 */
export function TemplateFieldMappingForm({
  mappingId,
  dataTemplates,
  companies,
  documentFormats,
  className,
}: TemplateFieldMappingFormProps) {
  const t = useTranslations('templateFieldMapping');
  const router = useRouter();
  const isEditing = !!mappingId;

  // Fetch existing mapping data if editing
  const { mapping: existingMapping, isLoading: isLoadingMapping } = useTemplateFieldMapping(
    mappingId || '',
    isEditing
  );

  // Mutations
  const { createMapping, isCreating } = useCreateTemplateFieldMapping();
  const { updateMapping, isUpdating } = useUpdateTemplateFieldMapping(mappingId || '');

  // State for mapping rules (separate from form)
  const [mappingRules, setMappingRules] = React.useState<Partial<TemplateFieldMappingRuleInput>[]>([]);

  // Form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dataTemplateId: '',
      scope: 'GLOBAL',
      companyId: '',
      documentFormatId: '',
      name: '',
      description: '',
      priority: 0,
      isActive: true,
    },
  });

  // Watch scope for conditional fields
  const scope = form.watch('scope');
  const selectedTemplateId = form.watch('dataTemplateId');

  // Get template fields for selected template
  const templateFields = React.useMemo(() => {
    const template = dataTemplates.find((t) => t.id === selectedTemplateId);
    return template?.fields || [];
  }, [dataTemplates, selectedTemplateId]);

  // Initialize form with existing data
  React.useEffect(() => {
    if (existingMapping && isEditing) {
      form.reset({
        dataTemplateId: existingMapping.dataTemplateId,
        scope: existingMapping.scope,
        companyId: existingMapping.companyId || '',
        documentFormatId: existingMapping.documentFormatId || '',
        name: existingMapping.name,
        description: existingMapping.description || '',
        priority: existingMapping.priority,
        isActive: existingMapping.isActive,
      });
      setMappingRules(existingMapping.mappings.map((r) => ({
        sourceField: r.sourceField,
        targetField: r.targetField,
        transformType: r.transformType,
        transformParams: r.transformParams,
        isRequired: r.isRequired,
        order: r.order,
        description: r.description,
      })));
    }
  }, [existingMapping, isEditing, form]);

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    // Validate mapping rules
    if (mappingRules.length === 0) {
      toast.error(t('form.errors.noRules'));
      return;
    }

    const invalidRules = mappingRules.filter(
      (r) => !r.sourceField || !r.targetField
    );
    if (invalidRules.length > 0) {
      toast.error(t('form.errors.incompleteRules'));
      return;
    }

    try {
      const input = {
        ...values,
        companyId: values.scope === 'COMPANY' ? values.companyId : undefined,
        documentFormatId: values.scope === 'FORMAT' ? values.documentFormatId : undefined,
        mappings: mappingRules.map((r, i) => ({
          sourceField: r.sourceField!,
          targetField: r.targetField!,
          transformType: r.transformType || 'DIRECT',
          transformParams: r.transformParams,
          isRequired: r.isRequired ?? false,
          order: r.order ?? i,
          description: r.description,
        })),
      };

      if (isEditing) {
        await updateMapping(input);
        toast.success(t('toast.updated.title'));
      } else {
        await createMapping(input);
        toast.success(t('toast.created.title'));
      }

      router.push('/admin/template-field-mappings');
    } catch (err) {
      toast.error(
        isEditing ? t('toast.updateError.title') : t('toast.createError.title'),
        { description: err instanceof Error ? err.message : undefined }
      );
    }
  };

  const handleCancel = () => {
    router.push('/admin/template-field-mappings');
  };

  const isSubmitting = isCreating || isUpdating;

  if (isEditing && isLoadingMapping) {
    return <FormSkeleton />;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn('space-y-6', className)}>
        {/* Basic Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t('form.basicInfo.title')}</CardTitle>
            <CardDescription>{t('form.basicInfo.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.name')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('form.namePlaceholder')}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t('form.descriptionPlaceholder')}
                      disabled={isSubmitting}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Data Template */}
            <FormField
              control={form.control}
              name="dataTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.dataTemplate')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting || isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.dataTemplatePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {dataTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{t('form.dataTemplateDescription')}</FormDescription>
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
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting || isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SCOPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(`scope.${option.value.toLowerCase()}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{t('form.scopeDescription')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company (conditional) */}
            {scope === 'COMPANY' && (
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.company')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting || isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.companyPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Document Format (conditional) */}
            {scope === 'FORMAT' && (
              <FormField
                control={form.control}
                name="documentFormatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.documentFormat')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting || isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.documentFormatPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {documentFormats.map((format) => (
                          <SelectItem key={format.id} value={format.id}>
                            {format.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.priority')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        disabled={isSubmitting}
                        min={0}
                        max={1000}
                      />
                    </FormControl>
                    <FormDescription>{t('form.priorityDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('form.isActive')}</FormLabel>
                      <FormDescription>{t('form.isActiveDescription')}</FormDescription>
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
            </div>
          </CardContent>
        </Card>

        {/* Mapping Rules Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t('form.mappingRules.title')}</CardTitle>
            <CardDescription>{t('form.mappingRules.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedTemplateId ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                {t('form.mappingRules.selectTemplateFirst')}
              </div>
            ) : (
              <MappingRuleEditor
                rules={mappingRules}
                onChange={setMappingRules}
                templateFields={templateFields}
                disabled={isSubmitting}
              />
            )}
          </CardContent>
        </Card>

        {/* Test Panel */}
        {mappingRules.length > 0 && (
          <MappingTestPanel rules={mappingRules} />
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={handleCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('form.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('form.saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? t('form.update') : t('form.create')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
