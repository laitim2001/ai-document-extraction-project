/**
 * @fileoverview 編輯數據模版頁面
 * @description
 *   提供編輯現有數據模版的表單頁面
 *   系統模版為唯讀模式
 *
 * @module src/app/(dashboard)/admin/data-templates/[id]
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 */

'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FileCode, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { DataTemplateForm } from '@/components/features/data-template';
import {
  useDataTemplate,
  useUpdateDataTemplate,
} from '@/hooks/use-data-templates';
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

export default function EditDataTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const id = params.id as string;

  // --- Queries ---
  const { data: template, isLoading, error } = useDataTemplate(id);

  // --- Mutations ---
  const updateMutation = useUpdateDataTemplate();

  // --- Handlers ---

  const handleSubmit = React.useCallback(
    async (data: FormValues) => {
      try {
        await updateMutation.mutateAsync({
          id,
          input: {
            name: data.name,
            description: data.description ?? null,
            fields: data.fields,
          },
        });

        toast({
          title: '更新成功',
          description: `已更新模版「${data.name}」`,
        });

        router.push('/admin/data-templates');
      } catch (err) {
        toast({
          variant: 'destructive',
          title: '更新失敗',
          description: err instanceof Error ? err.message : '未知錯誤',
        });
      }
    },
    [id, updateMutation, router, toast]
  );

  const handleCancel = React.useCallback(() => {
    router.push('/admin/data-templates');
  }, [router]);

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error || !template) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || '找不到指定的模版'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // --- Render ---
  const isReadOnly = template.isSystem;

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileCode className="h-6 w-6" />
          {isReadOnly ? '查看模版' : '編輯模版'}
        </h1>
        <p className="text-muted-foreground">
          {isReadOnly
            ? '系統模版僅供查看，無法修改'
            : `編輯模版「${template.name}」`}
        </p>
      </div>

      {/* Read-Only Notice */}
      {isReadOnly && (
        <Alert className="mb-6">
          <AlertDescription>
            這是系統內建模版，無法進行修改。如需自訂，請創建新的模版。
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <DataTemplateForm
        initialData={template}
        isEditMode={true}
        readOnly={isReadOnly}
        isSubmitting={updateMutation.isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
