/**
 * @fileoverview Prompt 配置新增頁
 * @description
 *   建立新的 Prompt 配置：
 *   - 基本資訊表單（名稱、描述、類型、範圍）
 *   - Prompt 編輯器（System / User Prompt）
 *   - 變數插入功能
 *
 * @module src/app/(dashboard)/admin/prompt-configs/new
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PromptConfigForm } from '@/components/features/prompt-config';
import {
  useCreatePromptConfig,
  useCompaniesForPromptConfig,
  useDocumentFormatsForPromptConfig,
} from '@/hooks/use-prompt-configs';
import type { CreatePromptConfigRequest } from '@/types/prompt-config';

// ============================================================================
// Page Component
// ============================================================================

export default function NewPromptConfigPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('promptConfig');

  // --- Queries ---
  const { data: companies = [] } = useCompaniesForPromptConfig();
  // Note: Document formats currently fetched without company filter
  // Future: Add form onChange to track company selection
  const { data: documentFormats = [] } = useDocumentFormatsForPromptConfig(
    undefined
  );

  const createMutation = useCreatePromptConfig();

  // --- Handlers ---

  const handleGoBack = React.useCallback(() => {
    router.push('/admin/prompt-configs');
  }, [router]);

  const handleSubmit = React.useCallback(
    async (data: CreatePromptConfigRequest) => {
      try {
        const result = await createMutation.mutateAsync(data);
        toast({
          title: t('page.toast.createSuccess'),
          description: t('page.toast.createSuccessDesc', { name: result.data.name }),
        });
        router.push('/admin/prompt-configs');
      } catch (err) {
        toast({
          variant: 'destructive',
          title: t('page.toast.createFailed'),
          description: err instanceof Error ? err.message : t('page.unknownError'),
        });
      }
    },
    [createMutation, toast, router, t]
  );

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
            {t('newPage.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('newPage.description')}
          </p>
        </div>
      </div>

      {/* Form */}
      <PromptConfigForm
        companies={companies}
        documentFormats={documentFormats}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
