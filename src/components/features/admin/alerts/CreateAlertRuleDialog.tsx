'use client';

/**
 * @fileoverview 創建警報規則對話框組件
 * @description
 *   提供創建新警報規則的表單對話框。
 *
 * @module src/components/features/admin/alerts/CreateAlertRuleDialog
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateAlertRule } from '@/hooks/useAlertRules';
import type { CreateAlertRuleRequest } from '@/types/alerts';

// ============================================================
// Types & Schema
// ============================================================

const formSchema = z.object({
  name: z.string().min(1, '名稱不能為空').max(100, '名稱不能超過 100 字元'),
  description: z.string().max(500, '描述不能超過 500 字元'),
  conditionType: z.enum([
    'SERVICE_DOWN',
    'ERROR_RATE',
    'RESPONSE_TIME',
    'QUEUE_BACKLOG',
    'STORAGE_LOW',
    'CPU_HIGH',
    'MEMORY_HIGH',
    'CUSTOM_METRIC',
  ]),
  metric: z.string().min(1, '指標名稱不能為空'),
  operator: z.enum([
    'GREATER_THAN',
    'GREATER_THAN_EQ',
    'LESS_THAN',
    'LESS_THAN_EQ',
    'EQUALS',
    'NOT_EQUALS',
  ]),
  threshold: z.number(),
  duration: z.number().int().positive(),
  serviceName: z.string(),
  endpoint: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'EMERGENCY']),
  channels: z.array(z.enum(['EMAIL', 'TEAMS', 'WEBHOOK'])).min(1, '至少選擇一個通知頻道'),
  recipients: z.string().min(1, '至少設定一個收件人'),
  cooldownMinutes: z.number().int().min(1).max(1440),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateAlertRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CONDITION_TYPE_VALUES = [
  'SERVICE_DOWN',
  'ERROR_RATE',
  'RESPONSE_TIME',
  'QUEUE_BACKLOG',
  'STORAGE_LOW',
  'CPU_HIGH',
  'MEMORY_HIGH',
  'CUSTOM_METRIC',
] as const;

const OPERATOR_VALUES = [
  'GREATER_THAN',
  'GREATER_THAN_EQ',
  'LESS_THAN',
  'LESS_THAN_EQ',
  'EQUALS',
  'NOT_EQUALS',
] as const;

const SEVERITY_VALUES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'EMERGENCY'] as const;

const CHANNELS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'TEAMS', label: 'Microsoft Teams' },
  { value: 'WEBHOOK', label: 'Webhook' },
];

// ============================================================
// Component
// ============================================================

export function CreateAlertRuleDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateAlertRuleDialogProps) {
  const t = useTranslations('admin.alerts');
  const tCommon = useTranslations('common');
  const createMutation = useCreateAlertRule();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      conditionType: 'ERROR_RATE',
      metric: 'error_rate',
      operator: 'GREATER_THAN',
      threshold: 10,
      duration: 300,
      serviceName: '',
      endpoint: '',
      severity: 'WARNING',
      channels: [],
      recipients: '',
      cooldownMinutes: 30,
    },
  });

  const onSubmit = async (data: FormValues) => {
    const payload: CreateAlertRuleRequest = {
      ...data,
      recipients: data.recipients.split(',').map((r) => r.trim()).filter(Boolean),
    };

    try {
      await createMutation.mutateAsync(payload);
      form.reset();
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Create alert rule error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('createDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 基本資訊 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('createDialog.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('createDialog.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('createDialog.descriptionLabel')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('createDialog.descriptionPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 條件設定 */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">{t('createDialog.sectionCondition')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="conditionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.conditionType')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('createDialog.conditionTypePlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONDITION_TYPE_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(`createDialog.conditionOptions.${value}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="metric"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.metric')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('createDialog.metricPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="operator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.operator')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('createDialog.operatorPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OPERATOR_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(`createDialog.operatorOptions.${value}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.threshold')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.duration')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 1)}
                        />
                      </FormControl>
                      <FormDescription>{t('createDialog.durationDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.serviceName')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('createDialog.serviceNamePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 通知設定 */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">{t('createDialog.sectionNotification')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.severity')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('createDialog.severityPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SEVERITY_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(`severity.${value}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cooldownMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('createDialog.cooldown')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 30)}
                        />
                      </FormControl>
                      <FormDescription>{t('createDialog.cooldownDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="channels"
                  render={() => (
                    <FormItem>
                      <FormLabel>{t('createDialog.channels')}</FormLabel>
                      <div className="flex flex-wrap gap-4">
                        {CHANNELS.map((channel) => (
                          <div key={channel.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`channel-${channel.value}`}
                              checked={form.watch('channels').includes(channel.value as 'EMAIL' | 'TEAMS' | 'WEBHOOK')}
                              onCheckedChange={(checked) => {
                                const current = form.getValues('channels');
                                if (checked) {
                                  form.setValue('channels', [...current, channel.value as 'EMAIL' | 'TEAMS' | 'WEBHOOK']);
                                } else {
                                  form.setValue(
                                    'channels',
                                    current.filter((c) => c !== channel.value)
                                  );
                                }
                              }}
                            />
                            <label htmlFor={`channel-${channel.value}`} className="text-sm">
                              {channel.label}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipients"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>{t('createDialog.recipients')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="email@example.com, webhook-url, teams-webhook"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t('createDialog.recipientsDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t('createDialog.submitting') : t('createDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
