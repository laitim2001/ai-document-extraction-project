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

const CONDITION_TYPES = [
  { value: 'SERVICE_DOWN', label: '服務停機' },
  { value: 'ERROR_RATE', label: '錯誤率' },
  { value: 'RESPONSE_TIME', label: '回應時間' },
  { value: 'QUEUE_BACKLOG', label: '佇列積壓' },
  { value: 'STORAGE_LOW', label: '儲存空間不足' },
  { value: 'CPU_HIGH', label: 'CPU 使用率過高' },
  { value: 'MEMORY_HIGH', label: '記憶體使用率過高' },
  { value: 'CUSTOM_METRIC', label: '自定義指標' },
];

const OPERATORS = [
  { value: 'GREATER_THAN', label: '大於 (>)' },
  { value: 'GREATER_THAN_EQ', label: '大於等於 (>=)' },
  { value: 'LESS_THAN', label: '小於 (<)' },
  { value: 'LESS_THAN_EQ', label: '小於等於 (<=)' },
  { value: 'EQUALS', label: '等於 (=)' },
  { value: 'NOT_EQUALS', label: '不等於 (!=)' },
];

const SEVERITIES = [
  { value: 'INFO', label: '資訊' },
  { value: 'WARNING', label: '警告' },
  { value: 'ERROR', label: '錯誤' },
  { value: 'CRITICAL', label: '嚴重' },
  { value: 'EMERGENCY', label: '緊急' },
];

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
          <DialogTitle>創建警報規則</DialogTitle>
          <DialogDescription>
            設定新的警報規則以監控系統指標。
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
                    <FormLabel>規則名稱 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：API 錯誤率過高" {...field} />
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
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea placeholder="選填：描述此規則的用途" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 條件設定 */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">條件設定</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="conditionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>條件類型 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇條件類型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONDITION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
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
                      <FormLabel>指標名稱 *</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：error_rate" {...field} />
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
                      <FormLabel>運算符 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇運算符" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
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
                      <FormLabel>閾值 *</FormLabel>
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
                      <FormLabel>持續時間（秒）*</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 1)}
                        />
                      </FormControl>
                      <FormDescription>條件需持續多久才觸發警報</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>服務名稱</FormLabel>
                      <FormControl>
                        <Input placeholder="選填：特定服務" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 通知設定 */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">通知設定</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>嚴重程度 *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇嚴重程度" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SEVERITIES.map((sev) => (
                            <SelectItem key={sev.value} value={sev.value}>
                              {sev.label}
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
                      <FormLabel>冷卻時間（分鐘）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 30)}
                        />
                      </FormControl>
                      <FormDescription>重複警報的最小間隔</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="channels"
                  render={() => (
                    <FormItem>
                      <FormLabel>通知頻道 *</FormLabel>
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
                      <FormLabel>收件人 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="email@example.com, webhook-url, teams-webhook"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>以逗號分隔多個收件人</FormDescription>
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
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '創建中...' : '創建規則'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
