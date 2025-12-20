'use client';

/**
 * @fileoverview Outlook 配置表單元件
 * @description
 *   提供 Outlook 連線配置的建立和編輯表單。
 *   包含連線測試功能和表單驗證。
 *
 * @module src/components/features/outlook/OutlookConfigForm
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 新增/編輯 Outlook 配置
 *   - 即時連線測試
 *   - Zod 表單驗證
 *   - 城市選擇
 *   - Mailbox 和 Folder 設定
 */

import * as React from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, TestTube, CheckCircle2, XCircle, Mail, Folder } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type {
  OutlookConfigApiResponse,
  OutlookConnectionTestResult,
  TestConnectionInput,
} from '@/types/outlook-config.types';

// ============================================================
// Types
// ============================================================

interface City {
  id: string;
  name: string;
  code: string;
}

interface OutlookConfigFormProps {
  config?: OutlookConfigApiResponse;
  cities: City[];
  onSubmit: (data: OutlookConfigFormData) => Promise<void>;
  onCancel: () => void;
  onTestConnection?: (data: TestConnectionInput) => Promise<OutlookConnectionTestResult>;
}

// ============================================================
// Validation Schema
// ============================================================

const formSchema = z.object({
  name: z.string().min(1, '名稱不能為空').max(100, '名稱不能超過 100 字元'),
  description: z.string().max(500, '說明不能超過 500 字元').optional(),
  tenantId: z.string().uuid('Tenant ID 格式不正確'),
  clientId: z.string().uuid('Client ID 格式不正確'),
  clientSecret: z.string().min(1, 'Client Secret 不能為空').optional(),
  mailboxAddress: z.string().email('請輸入有效的電子郵件地址'),
  mailFolders: z.string().optional(),
  cityId: z.string().optional().nullable(),
  isGlobal: z.boolean().optional(),
  maxAttachmentSizeMb: z.coerce.number().min(1).max(100).optional(),
  allowedExtensions: z.string().optional(),
});

type OutlookConfigFormData = z.infer<typeof formSchema>;

// ============================================================
// Component
// ============================================================

/**
 * Outlook 配置表單
 */
export function OutlookConfigForm({
  config,
  cities,
  onSubmit,
  onCancel,
  onTestConnection,
}: OutlookConfigFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<OutlookConnectionTestResult | null>(null);

  const isEditing = !!config;

  const form = useForm<OutlookConfigFormData>({
    resolver: zodResolver(formSchema) as Resolver<OutlookConfigFormData>,
    defaultValues: {
      name: config?.name ?? '',
      description: config?.description ?? '',
      tenantId: config?.tenantId ?? '',
      clientId: config?.clientId ?? '',
      clientSecret: '',
      mailboxAddress: config?.mailboxAddress ?? '',
      mailFolders: config?.mailFolders?.join(', ') ?? 'inbox',
      cityId: config?.cityId ?? null,
      isGlobal: config?.isGlobal ?? false,
      maxAttachmentSizeMb: config?.maxAttachmentSizeMb ?? 30,
      allowedExtensions: config?.allowedExtensions?.join(', ') ?? 'pdf, jpg, jpeg, png, tiff',
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const isGlobal = watch('isGlobal');

  const handleFormSubmit = async (data: OutlookConfigFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!onTestConnection) return;

    const values = watch();
    if (!values.tenantId || !values.clientId || !values.mailboxAddress) {
      setTestResult({
        success: false,
        error: '請填寫所有必要的連線資訊',
      });
      return;
    }

    // 編輯模式下若未輸入新密鑰，則需要提示
    if (!isEditing && !values.clientSecret) {
      setTestResult({
        success: false,
        error: '請填寫 Client Secret',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await onTestConnection({
        tenantId: values.tenantId,
        clientId: values.clientId,
        clientSecret: values.clientSecret ?? '',
        mailboxAddress: values.mailboxAddress,
      });
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        error: '連線測試失敗',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* 基本資訊 */}
      <Card>
        <CardHeader>
          <CardTitle>基本資訊</CardTitle>
          <CardDescription>設定配置名稱和說明</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">配置名稱 *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="例：香港辦公室 Outlook"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">說明</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="配置的用途說明"
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Azure AD 設定 */}
      <Card>
        <CardHeader>
          <CardTitle>Azure AD 設定</CardTitle>
          <CardDescription>Microsoft Entra ID 應用程式認證資訊</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenantId">Tenant ID *</Label>
            <Input
              id="tenantId"
              {...register('tenantId')}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            {errors.tenantId && (
              <p className="text-sm text-red-500">{errors.tenantId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID *</Label>
            <Input
              id="clientId"
              {...register('clientId')}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            {errors.clientId && (
              <p className="text-sm text-red-500">{errors.clientId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">
              Client Secret *
              {isEditing && (
                <span className="text-muted-foreground ml-2">
                  (留空則不更新)
                </span>
              )}
            </Label>
            <Input
              id="clientSecret"
              type="password"
              {...register('clientSecret')}
              placeholder={isEditing ? '留空則保持原密鑰' : '請輸入 Client Secret'}
            />
            {errors.clientSecret && (
              <p className="text-sm text-red-500">{errors.clientSecret.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Outlook 信箱設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Outlook 信箱設定
          </CardTitle>
          <CardDescription>設定要監控的信箱和資料夾</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mailboxAddress">信箱電子郵件地址 *</Label>
            <Input
              id="mailboxAddress"
              type="email"
              {...register('mailboxAddress')}
              placeholder="invoices@company.com"
            />
            {errors.mailboxAddress && (
              <p className="text-sm text-red-500">{errors.mailboxAddress.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mailFolders" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              監控資料夾
            </Label>
            <Input
              id="mailFolders"
              {...register('mailFolders')}
              placeholder="inbox, invoices"
            />
            <p className="text-sm text-muted-foreground">
              以逗號分隔多個資料夾名稱，留空則使用收件匣（inbox）
            </p>
          </div>

          {/* 連線測試 */}
          {onTestConnection && (
            <div className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    測試中...
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    測試連線
                  </>
                )}
              </Button>

              {testResult && (
                <Alert
                  className="mt-4"
                  variant={testResult.success ? 'default' : 'destructive'}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {testResult.success ? (
                      <div className="space-y-1">
                        <p>連線成功！</p>
                        {testResult.details?.mailboxInfo && (
                          <p className="text-sm text-muted-foreground">
                            信箱: {testResult.details.mailboxInfo.displayName}
                          </p>
                        )}
                        {testResult.details?.recentMailCount !== undefined && (
                          <p className="text-sm text-muted-foreground">
                            近期郵件數: {testResult.details.recentMailCount}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p>{testResult.error}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 處理設定 */}
      <Card>
        <CardHeader>
          <CardTitle>處理設定</CardTitle>
          <CardDescription>設定附件限制</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxAttachmentSizeMb">最大附件大小 (MB)</Label>
            <Input
              id="maxAttachmentSizeMb"
              type="number"
              {...register('maxAttachmentSizeMb')}
              min={1}
              max={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowedExtensions">允許的檔案類型</Label>
            <Input
              id="allowedExtensions"
              {...register('allowedExtensions')}
              placeholder="pdf, jpg, jpeg, png, tiff"
            />
            <p className="text-sm text-muted-foreground">以逗號分隔多個副檔名（不需要加點）</p>
          </div>
        </CardContent>
      </Card>

      {/* 城市關聯 */}
      <Card>
        <CardHeader>
          <CardTitle>城市關聯</CardTitle>
          <CardDescription>設定此配置適用的城市或設為全域配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="isGlobal"
              checked={isGlobal}
              onCheckedChange={(checked) => {
                setValue('isGlobal', checked);
                if (checked) {
                  setValue('cityId', null);
                }
              }}
              disabled={isEditing}
            />
            <Label htmlFor="isGlobal">設為全域預設配置</Label>
          </div>

          {!isGlobal && (
            <div className="space-y-2">
              <Label htmlFor="cityId">選擇城市</Label>
              <Select
                value={watch('cityId') ?? undefined}
                onValueChange={(value) => setValue('cityId', value)}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇城市..." />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name} ({city.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 操作按鈕 */}
      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              儲存中...
            </>
          ) : isEditing ? (
            '更新配置'
          ) : (
            '建立配置'
          )}
        </Button>
      </div>
    </form>
  );
}

export type { OutlookConfigFormData };
