/**
 * @fileoverview Prompt 配置表單組件
 * @description
 *   提供 Prompt 配置的完整編輯表單。
 *   包含基本資訊、Prompt 編輯和測試功能。
 *
 * @module src/components/features/prompt-config/PromptConfigForm
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 *
 * @features
 *   - 基本資訊表單（名稱、描述、類型、範圍）
 *   - 公司和文件格式選擇（根據範圍動態顯示）
 *   - Prompt 編輯器整合
 *   - 測試器整合
 *   - 表單驗證
 *
 * @dependencies
 *   - @/types/prompt-config - 配置類型定義
 *   - @/types/prompt-config-ui - UI 類型定義
 *   - @/components/ui/* - shadcn/ui 組件
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save } from 'lucide-react';
import { PromptEditor } from './PromptEditor';
import { PromptTester } from './PromptTester';
import {
  PROMPT_TYPES,
  PROMPT_SCOPES,
  MERGE_STRATEGIES,
  type PromptConfigDTO,
} from '@/types/prompt-config';
import type { PromptTestResult } from '@/types/prompt-config-ui';

// ============================================================================
// 表單驗證 Schema
// ============================================================================

const formSchema = z.object({
  promptType: z.string().min(1, '請選擇 Prompt 類型'),
  scope: z.string().min(1, '請選擇適用範圍'),
  name: z.string().min(1, '請輸入配置名稱').max(100, '名稱最多 100 字'),
  description: z.string().max(500, '描述最多 500 字').optional(),
  companyId: z.string().optional(),
  documentFormatId: z.string().optional(),
  systemPrompt: z.string().min(1, '請輸入 System Prompt'),
  userPromptTemplate: z.string().min(1, '請輸入 User Prompt Template'),
  mergeStrategy: z.string(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

/** 表單提交數據類型（不包含 version，由 page 處理） */
export type PromptConfigFormData = FormValues;

// ============================================================================
// 類型定義
// ============================================================================

interface PromptConfigFormProps {
  /** 現有配置（編輯模式） */
  config?: PromptConfigDTO;
  /** 公司列表 */
  companies?: Array<{ id: string; name: string }>;
  /** 文件格式列表 */
  documentFormats?: Array<{ id: string; name: string }>;
  /** 提交回調 */
  onSubmit: (data: PromptConfigFormData) => Promise<void>;
  /** 測試回調 */
  onTest?: (file: File) => Promise<PromptTestResult>;
  /** 是否提交中 */
  isSubmitting?: boolean;
}

// ============================================================================
// 主組件
// ============================================================================

export function PromptConfigForm({
  config,
  companies = [],
  documentFormats = [],
  onSubmit,
  onTest,
  isSubmitting = false,
}: PromptConfigFormProps) {
  const isEditMode = !!config;

  // 初始化表單
  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      promptType: config?.promptType ?? '',
      scope: config?.scope ?? 'GLOBAL',
      name: config?.name ?? '',
      description: config?.description ?? '',
      companyId: config?.companyId ?? undefined,
      documentFormatId: config?.documentFormatId ?? undefined,
      systemPrompt: config?.systemPrompt ?? '',
      userPromptTemplate: config?.userPromptTemplate ?? '',
      mergeStrategy: config?.mergeStrategy ?? 'OVERRIDE',
      isActive: config?.isActive ?? true,
    },
  });

  const watchScope = form.watch('scope');

  // 處理提交
  const handleSubmit = async (data: FormValues) => {
    await onSubmit(data);
  };

  // 測試處理器
  const handleTest = async (file: File): Promise<PromptTestResult> => {
    if (onTest) {
      return onTest(file);
    }
    return {
      success: false,
      error: '測試功能不可用',
      executionTimeMs: 0,
    };
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {/* 基本資訊 */}
        <Card>
          <CardHeader>
            <CardTitle>基本資訊</CardTitle>
            <CardDescription>
              設定 Prompt 配置的基本屬性
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 名稱 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>配置名稱 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：DHL 發票術語分類" {...field} />
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
                      placeholder="配置的用途說明..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              {/* Prompt 類型 */}
              <FormField
                control={form.control}
                name="promptType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt 類型 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇類型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(PROMPT_TYPES).map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {PROMPT_TYPES[field.value as keyof typeof PROMPT_TYPES]?.description}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 適用範圍 */}
              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>適用範圍 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇範圍" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(PROMPT_SCOPES).map((scope) => (
                          <SelectItem key={scope.value} value={scope.value}>
                            {scope.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {PROMPT_SCOPES[field.value as keyof typeof PROMPT_SCOPES]?.description}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 公司選擇（當範圍為 COMPANY 或 FORMAT 時顯示） */}
            {(watchScope === 'COMPANY' || watchScope === 'FORMAT') && (
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公司 {watchScope === 'COMPANY' && '*'}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇公司" />
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

            {/* 文件格式選擇（當範圍為 FORMAT 時顯示） */}
            {watchScope === 'FORMAT' && (
              <FormField
                control={form.control}
                name="documentFormatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>文件格式 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇文件格式" />
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

            <div className="grid gap-4 md:grid-cols-2">
              {/* 合併策略 */}
              <FormField
                control={form.control}
                name="mergeStrategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>合併策略</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇策略" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(MERGE_STRATEGIES).map((strategy) => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            {strategy.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {MERGE_STRATEGIES[field.value as keyof typeof MERGE_STRATEGIES]?.description}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 啟用狀態 */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">啟用狀態</FormLabel>
                      <FormDescription>
                        停用後此配置將不會被使用
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
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Prompt 編輯器 */}
        <Card>
          <CardHeader>
            <CardTitle>Prompt 內容</CardTitle>
            <CardDescription>
              編輯 System Prompt 和 User Prompt Template
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PromptEditor
              systemPrompt={form.watch('systemPrompt')}
              userPromptTemplate={form.watch('userPromptTemplate')}
              onSystemPromptChange={(value) => form.setValue('systemPrompt', value)}
              onUserPromptTemplateChange={(value) => form.setValue('userPromptTemplate', value)}
            />
            {form.formState.errors.systemPrompt && (
              <p className="text-sm text-red-500 mt-2">
                {form.formState.errors.systemPrompt.message}
              </p>
            )}
            {form.formState.errors.userPromptTemplate && (
              <p className="text-sm text-red-500 mt-2">
                {form.formState.errors.userPromptTemplate.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 測試器（僅編輯模式） */}
        {isEditMode && config && onTest && (
          <PromptTester
            configId={config.id}
            onTest={handleTest}
            disabled={form.formState.isDirty}
          />
        )}

        {/* 提交按鈕 */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                儲存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditMode ? '更新配置' : '建立配置'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
