/**
 * @fileoverview 新增數據模版頁面
 * @description
 *   提供創建新數據模版的表單頁面
 *
 * @module src/app/(dashboard)/admin/data-templates/new
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DataTemplateForm } from '@/components/features/data-template';
import { useCreateDataTemplate } from '@/hooks/use-data-templates';
import type { DataTemplateField } from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

interface FormValues {
  name: string;
  description?: string | null;
  scope: 'GLOBAL' | 'COMPANY';
  companyId?: string | null;
  fields: DataTemplateField[];
  isActive?: boolean;
}

// ============================================================================
// Page Component
// ============================================================================

export default function NewDataTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();

  // --- Mutations ---
  const createMutation = useCreateDataTemplate();

  // --- Handlers ---

  const handleSubmit = React.useCallback(
    async (data: FormValues) => {
      try {
        await createMutation.mutateAsync({
          name: data.name,
          description: data.description ?? undefined,
          scope: data.scope,
          companyId: data.scope === 'COMPANY' ? (data.companyId ?? undefined) : undefined,
          fields: data.fields,
        });

        toast({
          title: '創建成功',
          description: `已創建模版「${data.name}」`,
        });

        router.push('/admin/data-templates');
      } catch (err) {
        toast({
          variant: 'destructive',
          title: '創建失敗',
          description: err instanceof Error ? err.message : '未知錯誤',
        });
      }
    },
    [createMutation, router, toast]
  );

  const handleCancel = React.useCallback(() => {
    router.push('/admin/data-templates');
  }, [router]);

  // --- Render ---
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileCode className="h-6 w-6" />
          新增數據模版
        </h1>
        <p className="text-muted-foreground">
          創建新的目標欄位結構模版
        </p>
      </div>

      {/* Form */}
      <DataTemplateForm
        isEditMode={false}
        isSubmitting={createMutation.isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
