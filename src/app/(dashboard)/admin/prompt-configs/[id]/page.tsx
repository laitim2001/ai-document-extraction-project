/**
 * @fileoverview Prompt 配置編輯頁
 * @description
 *   編輯現有的 Prompt 配置：
 *   - 載入配置詳情
 *   - 編輯基本資訊和 Prompt 內容
 *   - 測試配置效果
 *   - 儲存變更
 *
 * @module src/app/(dashboard)/admin/prompt-configs/[id]
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 */

'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Settings2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  PromptConfigForm,
  type PromptConfigFormData,
} from '@/components/features/prompt-config';
import {
  usePromptConfig,
  useUpdatePromptConfig,
  useTestPromptConfig,
  useCompaniesForPromptConfig,
  useDocumentFormatsForPromptConfig,
} from '@/hooks/use-prompt-configs';
import type { PromptTestResult } from '@/types/prompt-config-ui';

// ============================================================================
// Page Component
// ============================================================================

export default function EditPromptConfigPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const configId = params.id as string;

  // --- State ---
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>();

  // --- Queries ---
  const {
    data: configResponse,
    isLoading: isLoadingConfig,
    error: configError,
  } = usePromptConfig(configId);

  const { data: companies = [] } = useCompaniesForPromptConfig();
  const { data: documentFormats = [] } = useDocumentFormatsForPromptConfig(
    selectedCompanyId ?? configResponse?.data?.companyId ?? undefined
  );

  const updateMutation = useUpdatePromptConfig(configId);
  const testMutation = useTestPromptConfig(configId);

  // --- Derived State ---
  const config = configResponse?.data;

  // Initialize company selection from loaded config
  React.useEffect(() => {
    if (config?.companyId && !selectedCompanyId) {
      setSelectedCompanyId(config.companyId);
    }
  }, [config?.companyId, selectedCompanyId]);

  // --- Handlers ---

  const handleGoBack = React.useCallback(() => {
    router.push('/admin/prompt-configs');
  }, [router]);

  const handleSubmit = React.useCallback(
    async (data: PromptConfigFormData) => {
      if (!config) return;
      try {
        await updateMutation.mutateAsync({
          ...data,
          version: config.version,
        });
        toast({
          title: '更新成功',
          description: '配置已成功更新',
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: '更新失敗',
          description: err instanceof Error ? err.message : '未知錯誤',
        });
      }
    },
    [updateMutation, toast, config]
  );

  const handleTest = React.useCallback(
    async (file: File): Promise<PromptTestResult> => {
      try {
        const result = await testMutation.mutateAsync(file);
        return result;
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : '測試失敗',
          executionTimeMs: 0,
        };
      }
    },
    [testMutation]
  );

  // --- Loading State ---
  if (isLoadingConfig) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  // --- Error State ---
  if (configError || !config) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleGoBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">載入失敗</h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            無法載入配置資料：
            {configError instanceof Error
              ? configError.message
              : '配置不存在或已被刪除'}
          </AlertDescription>
        </Alert>
        <Button onClick={handleGoBack}>返回配置列表</Button>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleGoBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            編輯 Prompt 配置
          </h1>
          <p className="text-muted-foreground">
            {config.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <PromptConfigForm
        config={config}
        companies={companies}
        documentFormats={documentFormats}
        onSubmit={handleSubmit}
        onTest={handleTest}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}
