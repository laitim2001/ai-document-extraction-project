'use client';

/**
 * @fileoverview 創建 API Key 對話框組件
 * @description
 *   提供創建新 API Key 的表單對話框，包含：
 *   - 名稱和描述
 *   - 權限設定
 *   - 速率限制
 *   - IP 限制
 *
 * @module src/components/features/admin/api-keys/CreateApiKeyDialog
 * @author Development Team
 * @since Epic 11 - Story 11.5 (API 存取控制與認證)
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - react-hook-form - 表單管理
 *   - zod - 驗證
 *   - @/components/ui/* - UI 組件
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, Check, AlertTriangle } from 'lucide-react';

// ============================================================
// Types & Schema
// ============================================================

const createApiKeyFormSchema = z.object({
  name: z.string().min(3, '名稱至少需要 3 個字元').max(100),
  description: z.string().max(500).optional(),
  allowedCities: z.array(z.string()).min(1, '至少選擇一個城市'),
  allowedOperations: z.array(z.string()).min(1, '至少選擇一項操作'),
  rateLimit: z.number().int().min(1).max(10000),
  allowedIps: z.string().optional(),
});

type CreateApiKeyFormValues = z.infer<typeof createApiKeyFormSchema>;

interface CreateApiKeyDialogProps {
  /** 是否開啟 */
  open: boolean;
  /** 關閉回調 */
  onOpenChange: (open: boolean) => void;
  /** 創建成功回調 */
  onSuccess?: () => void;
  /** 可用城市列表 */
  availableCities?: { code: string; name: string }[];
}

const DEFAULT_OPERATIONS = [
  { value: 'submit', label: '提交發票' },
  { value: 'query', label: '查詢狀態' },
  { value: 'result', label: '獲取結果' },
  { value: 'webhook', label: 'Webhook 管理' },
];

// ============================================================
// Component
// ============================================================

/**
 * 創建 API Key 對話框組件
 *
 * @component CreateApiKeyDialog
 * @description 用於創建新的 API Key
 */
export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSuccess,
  availableCities = [],
}: CreateApiKeyDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const form = useForm<CreateApiKeyFormValues>({
    resolver: zodResolver(createApiKeyFormSchema),
    defaultValues: {
      name: '',
      description: '',
      allowedCities: [],
      allowedOperations: [],
      rateLimit: 60,
      allowedIps: '',
    },
  });

  const onSubmit = async (data: CreateApiKeyFormValues) => {
    setIsSubmitting(true);
    try {
      const allowedIps = data.allowedIps
        ? data.allowedIps.split(',').map((ip) => ip.trim()).filter(Boolean)
        : undefined;

      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          allowedIps,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '創建失敗');
      }

      const result = await response.json();
      setCreatedKey(result.data.rawKey);
    } catch (error) {
      console.error('Create API key error:', error);
      // 可以添加 toast 通知
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (createdKey) {
      setCreatedKey(null);
      form.reset();
      onSuccess?.();
    }
    onOpenChange(false);
  };

  // 顯示創建成功的 Key
  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key 創建成功</DialogTitle>
            <DialogDescription>
              請立即複製並安全保存此 Key，關閉後將無法再次查看。
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>重要提醒</AlertTitle>
            <AlertDescription>
              這是您唯一一次看到完整 API Key 的機會。請確保已安全保存。
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <code className="flex-1 break-all text-sm">{createdKey}</code>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>我已保存，關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>創建 API Key</DialogTitle>
          <DialogDescription>
            創建新的 API Key 以供外部系統存取 API。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 名稱 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名稱 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：外部系統 API Key" {...field} />
                  </FormControl>
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
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="選填：描述此 Key 的用途"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 允許的城市 */}
            <FormField
              control={form.control}
              name="allowedCities"
              render={() => (
                <FormItem>
                  <FormLabel>允許的城市 *</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="city-all"
                        checked={form.watch('allowedCities').includes('*')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            form.setValue('allowedCities', ['*']);
                          } else {
                            form.setValue('allowedCities', []);
                          }
                        }}
                      />
                      <label htmlFor="city-all" className="text-sm">
                        全部城市
                      </label>
                    </div>
                    {availableCities.map((city) => (
                      <div key={city.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`city-${city.code}`}
                          disabled={form.watch('allowedCities').includes('*')}
                          checked={form.watch('allowedCities').includes(city.code)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues('allowedCities');
                            if (checked) {
                              form.setValue('allowedCities', [...current, city.code]);
                            } else {
                              form.setValue(
                                'allowedCities',
                                current.filter((c) => c !== city.code)
                              );
                            }
                          }}
                        />
                        <label htmlFor={`city-${city.code}`} className="text-sm">
                          {city.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 允許的操作 */}
            <FormField
              control={form.control}
              name="allowedOperations"
              render={() => (
                <FormItem>
                  <FormLabel>允許的操作 *</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_OPERATIONS.map((op) => (
                      <div key={op.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`op-${op.value}`}
                          checked={form.watch('allowedOperations').includes(op.value)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues('allowedOperations');
                            if (checked) {
                              form.setValue('allowedOperations', [...current, op.value]);
                            } else {
                              form.setValue(
                                'allowedOperations',
                                current.filter((o) => o !== op.value)
                              );
                            }
                          }}
                        />
                        <label htmlFor={`op-${op.value}`} className="text-sm">
                          {op.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 速率限制 */}
            <FormField
              control={form.control}
              name="rateLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>速率限制（每分鐘請求數）</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 60)}
                    />
                  </FormControl>
                  <FormDescription>預設為 60 次/分鐘</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* IP 白名單 */}
            <FormField
              control={form.control}
              name="allowedIps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP 白名單</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="選填：以逗號分隔多個 IP"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    留空表示不限制 IP。例如：192.168.1.1, 10.0.0.1
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '創建中...' : '創建 API Key'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
