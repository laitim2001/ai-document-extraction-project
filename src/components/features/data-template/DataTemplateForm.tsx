/**
 * @fileoverview 數據模版表單組件
 * @description
 *   提供數據模版的創建和編輯功能
 *
 * @module src/components/features/data-template/DataTemplateForm
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 *
 * @features
 *   - 創建/編輯模式
 *   - 表單驗證
 *   - 欄位編輯器整合
 *   - 公司選擇（COMPANY 範圍時）
 */

'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTemplateFieldEditor } from './DataTemplateFieldEditor';
import {
  createDataTemplateSchema,
  updateDataTemplateSchema,
} from '@/validations/data-template';
import type { DataTemplate, DataTemplateField } from '@/types/data-template';
import { SCOPE_OPTIONS } from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

export interface DataTemplateFormProps {
  /** 編輯模式時的初始資料 */
  initialData?: DataTemplate;
  /** 是否為編輯模式 */
  isEditMode?: boolean;
  /** 是否唯讀（系統模版） */
  readOnly?: boolean;
  /** 是否提交中 */
  isSubmitting?: boolean;
  /** 提交回調 */
  onSubmit: (data: FormValues) => void | Promise<void>;
  /** 取消回調 */
  onCancel: () => void;
  /** 公司選項（COMPANY 範圍時使用） */
  companies?: Array<{ id: string; name: string }>;
}

interface FormValues {
  name: string;
  description?: string | null;
  scope: 'GLOBAL' | 'COMPANY';
  companyId?: string | null;
  fields: DataTemplateField[];
  isActive?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function DataTemplateForm({
  initialData,
  isEditMode = false,
  readOnly = false,
  isSubmitting = false,
  onSubmit,
  onCancel,
  companies = [],
}: DataTemplateFormProps) {
  // --- Form Setup ---
  // 使用類型斷言來處理不同模式下的 schema 差異
  const schema = isEditMode ? updateDataTemplateSchema : createDataTemplateSchema;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      scope: initialData?.scope ?? 'GLOBAL',
      companyId: initialData?.companyId ?? undefined,
      fields: initialData?.fields ?? [
        { name: 'field_1', label: '欄位 1', dataType: 'string', isRequired: false, order: 1 },
      ],
    },
  });

  const scope = watch('scope');
  const fields = watch('fields');

  // --- Handlers ---

  const handleFieldsChange = React.useCallback(
    (newFields: DataTemplateField[]) => {
      setValue('fields', newFields, { shouldValidate: true });
    },
    [setValue]
  );

  // --- Render ---
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 基本資訊 */}
      <Card>
        <CardHeader>
          <CardTitle>基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 模版名稱 */}
          <div className="space-y-2">
            <Label htmlFor="name">模版名稱 *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="例：ERP 標準匯入格式"
              disabled={readOnly}
              className={readOnly ? 'bg-muted' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* 模版說明 */}
          <div className="space-y-2">
            <Label htmlFor="description">說明</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="描述此模版的用途..."
              rows={3}
              disabled={readOnly}
              className={readOnly ? 'bg-muted' : ''}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* 範圍設定 */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 配置範圍 */}
            <div className="space-y-2">
              <Label>配置範圍 *</Label>
              <Controller
                name="scope"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={readOnly || isEditMode}
                  >
                    <SelectTrigger
                      className={(readOnly || isEditMode) ? 'bg-muted' : ''}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCOPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.scope && (
                <p className="text-sm text-destructive">{errors.scope.message}</p>
              )}
            </div>

            {/* 公司選擇（COMPANY 範圍時） */}
            {scope === 'COMPANY' && (
              <div className="space-y-2">
                <Label>所屬公司 *</Label>
                <Controller
                  name="companyId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={field.onChange}
                      disabled={readOnly || isEditMode}
                    >
                      <SelectTrigger
                        className={(readOnly || isEditMode) ? 'bg-muted' : ''}
                      >
                        <SelectValue placeholder="選擇公司" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.companyId && (
                  <p className="text-sm text-destructive">
                    {errors.companyId.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 欄位定義 */}
      <Card>
        <CardHeader>
          <CardTitle>欄位定義</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTemplateFieldEditor
            fields={fields}
            onChange={handleFieldsChange}
            readOnly={readOnly}
            error={
              errors.fields?.message ||
              (errors.fields as { root?: { message?: string } })?.root?.message
            }
          />
        </CardContent>
      </Card>

      {/* 操作按鈕 */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        {!readOnly && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                儲存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditMode ? '更新模版' : '創建模版'}
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
