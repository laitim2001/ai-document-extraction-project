'use client';

/**
 * @fileoverview 手動建立格式對話框組件
 * @description
 *   提供對話框介面讓用戶手動建立文件格式。
 *   支援選擇文件類型、子類型，以及自動建立關聯配置。
 *
 * @module src/components/features/formats/CreateFormatDialog
 * @since Epic 16 - Story 16-8
 * @lastModified 2026-01-14
 *
 * @dependencies
 *   - @/hooks/use-company-formats - 建立格式 Hook
 *   - @/components/ui/* - UI 組件
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { DocumentType, DocumentSubtype } from '@prisma/client';
import { Plus, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { useCreateFormat } from '@/hooks/use-company-formats';

// ============================================================================
// Types & Constants
// ============================================================================

/**
 * 組件 Props
 */
interface CreateFormatDialogProps {
  /** 公司 ID */
  companyId: string;
  /** 觸發按鈕樣式 */
  triggerVariant?: 'default' | 'outline' | 'ghost';
  /** 自定義類名 */
  className?: string;
  /** 成功回調 */
  onSuccess?: () => void;
}

/**
 * 文件類型列表
 */
const DOCUMENT_TYPES = Object.values(DocumentType);

/**
 * 文件子類型列表
 */
const DOCUMENT_SUBTYPES = Object.values(DocumentSubtype);

/**
 * 表單 Schema
 */
const formSchema = z.object({
  documentType: z.nativeEnum(DocumentType, {
    message: '請選擇文件類型',
  }),
  documentSubtype: z.nativeEnum(DocumentSubtype, {
    message: '請選擇文件子類型',
  }),
  name: z.string().max(200).optional(),
  autoCreateFieldMapping: z.boolean(),
  autoCreatePromptConfig: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

// ============================================================================
// Component
// ============================================================================

/**
 * 手動建立格式對話框
 *
 * @description
 *   提供對話框介面讓用戶在公司詳情頁面主動建立文件格式。
 *   可選擇是否自動建立關聯的 FieldMappingConfig 和 PromptConfig。
 *
 * @param props - 組件屬性
 */
export function CreateFormatDialog({
  companyId,
  triggerVariant = 'default',
  className,
  onSuccess,
}: CreateFormatDialogProps) {
  const t = useTranslations('formats');
  const tCommon = useTranslations('common');
  const [open, setOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const { mutate: createFormat, isPending } = useCreateFormat(companyId);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentType: undefined,
      documentSubtype: undefined,
      name: '',
      autoCreateFieldMapping: false,
      autoCreatePromptConfig: false,
    },
  });

  // 重置表單
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
      setShowAdvanced(false);
    }
  };

  // 提交表單
  const handleSubmit = (data: FormData) => {
    createFormat(
      {
        documentType: data.documentType,
        documentSubtype: data.documentSubtype,
        name: data.name || undefined,
        autoCreateConfigs: {
          fieldMapping: data.autoCreateFieldMapping,
          promptConfig: data.autoCreatePromptConfig,
        },
      },
      {
        onSuccess: () => {
          handleOpenChange(false);
          onSuccess?.();
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* 文件類型 */}
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('createDialog.documentTypeLabel')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('createDialog.documentTypePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`documentTypes.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 文件子類型 */}
            <FormField
              control={form.control}
              name="documentSubtype"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('createDialog.documentSubtypeLabel')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('createDialog.documentSubtypePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_SUBTYPES.map((subtype) => (
                        <SelectItem key={subtype} value={subtype}>
                          {t(`documentSubtypes.${subtype}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 格式名稱 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('createDialog.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('createDialog.namePlaceholder')}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('createDialog.nameDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 進階選項 */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start p-0 h-auto font-normal text-muted-foreground hover:text-foreground"
                >
                  {showAdvanced ? (
                    <ChevronDown className="mr-2 h-4 w-4" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4" />
                  )}
                  {t('createDialog.advancedOptions')}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* 建立欄位映射配置 */}
                <FormField
                  control={form.control}
                  name="autoCreateFieldMapping"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('createDialog.fieldMappingLabel')}
                        </FormLabel>
                        <FormDescription>
                          {t('createDialog.fieldMappingDescription')}
                        </FormDescription>
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

                {/* 建立 Prompt 配置 */}
                <FormField
                  control={form.control}
                  name="autoCreatePromptConfig"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('createDialog.promptConfigLabel')}
                        </FormLabel>
                        <FormDescription>
                          {t('createDialog.promptConfigDescription')}
                        </FormDescription>
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
              </CollapsibleContent>
            </Collapsible>

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
                {t('createDialog.submitButton')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
