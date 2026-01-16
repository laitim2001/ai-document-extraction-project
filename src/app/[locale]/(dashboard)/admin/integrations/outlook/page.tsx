'use client';

/**
 * @fileoverview Outlook 連線配置管理頁面
 * @description
 *   全局管理者 Outlook 連線配置介面：
 *   - 配置列表瀏覽
 *   - 新增/編輯配置
 *   - 連線測試
 *   - 過濾規則管理
 *   - 僅限全局管理者訪問
 *
 * @module src/app/(dashboard)/admin/integrations/outlook/page
 * @author Development Team
 * @since Epic 9 - Story 9.4 (Outlook 連線設定)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 配置 CRUD 操作
 *   - 連線測試
 *   - 過濾規則管理
 *   - 城市關聯
 *   - 權限保護
 */

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

import { OutlookConfigList } from '@/components/features/outlook/OutlookConfigList';
import { OutlookConfigForm } from '@/components/features/outlook/OutlookConfigForm';
import { OutlookFilterRulesEditor } from '@/components/features/outlook/OutlookFilterRulesEditor';

import {
  useOutlookConfigs,
  useCreateOutlookConfig,
  useUpdateOutlookConfig,
  useDeleteOutlookConfig,
  useToggleOutlookConfigActive,
  useTestOutlookConfig,
  useTestNewOutlookConfig,
  useOutlookFilterRules,
  useCreateOutlookFilterRule,
  useUpdateOutlookFilterRule,
  useDeleteOutlookFilterRule,
  useReorderOutlookFilterRules,
} from '@/hooks/use-outlook-config';

import type {
  OutlookConfigApiResponse,
  CreateOutlookConfigInput,
  UpdateOutlookConfigInput,
  CreateFilterRuleInput,
  UpdateFilterRuleInput,
} from '@/types/outlook-config.types';

// ============================================================
// Types
// ============================================================

interface City {
  id: string;
  name: string;
  code: string;
}

type ViewMode = 'list' | 'create' | 'edit';

// ============================================================
// Page Component
// ============================================================

/**
 * @page OutlookConfigPage
 * @description Outlook 連線配置管理頁面
 */
export default function OutlookConfigPage() {
  const { data: session, status } = useSession();

  // --- State ---
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');
  const [editingConfig, setEditingConfig] = React.useState<OutlookConfigApiResponse | null>(null);
  const [rulesConfig, setRulesConfig] = React.useState<OutlookConfigApiResponse | null>(null);
  const [testingConfigId, setTestingConfigId] = React.useState<string | undefined>();

  // --- Queries ---
  const { data: configsData, isLoading: isLoadingConfigs } = useOutlookConfigs({
    includeRules: true,
  });

  const { data: citiesData } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const response = await fetch('/api/cities');
      if (!response.ok) throw new Error('Failed to fetch cities');
      return response.json();
    },
  });

  const { data: rulesData, isLoading: isLoadingRules } = useOutlookFilterRules(
    rulesConfig?.id ?? ''
  );

  // --- Mutations ---
  const createMutation = useCreateOutlookConfig();
  const updateMutation = useUpdateOutlookConfig();
  const deleteMutation = useDeleteOutlookConfig();
  const toggleActiveMutation = useToggleOutlookConfigActive();
  const testConfigMutation = useTestOutlookConfig();
  const testNewConfigMutation = useTestNewOutlookConfig();
  const createRuleMutation = useCreateOutlookFilterRule();
  const updateRuleMutation = useUpdateOutlookFilterRule();
  const deleteRuleMutation = useDeleteOutlookFilterRule();
  const reorderRulesMutation = useReorderOutlookFilterRules();

  // --- Auth Check ---
  if (status === 'loading') {
    return <PageSkeleton />;
  }

  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.isGlobalAdmin) {
    redirect('/dashboard');
  }

  // --- Data ---
  const configs = configsData ?? [];
  const cities: City[] = citiesData?.data ?? [];

  // --- Handlers ---
  const handleCreate = async (data: Record<string, unknown>) => {
    try {
      // 處理 mailFolders: 表單中是逗號分隔字串，需轉換為陣列
      const mailFoldersStr = data.mailFolders as string | undefined;
      const mailFolders = mailFoldersStr
        ? mailFoldersStr.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      // 處理 allowedExtensions: 表單中是逗號分隔字串，需轉換為陣列
      const allowedExtStr = data.allowedExtensions as string | undefined;
      const allowedExtensions = allowedExtStr
        ? allowedExtStr.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      const input: CreateOutlookConfigInput = {
        name: data.name as string,
        description: data.description as string | undefined,
        tenantId: data.tenantId as string,
        clientId: data.clientId as string,
        clientSecret: data.clientSecret as string,
        mailboxAddress: data.mailboxAddress as string,
        mailFolders,
        cityId: data.cityId as string | undefined,
        isGlobal: data.isGlobal as boolean | undefined,
        maxAttachmentSizeMb: data.maxAttachmentSizeMb as number | undefined,
        allowedExtensions,
      };

      await createMutation.mutateAsync(input);
      toast.success('配置已建立');
      setViewMode('list');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '建立失敗');
    }
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editingConfig) return;

    try {
      // 處理 mailFolders: 表單中是逗號分隔字串，需轉換為陣列
      const mailFoldersStr = data.mailFolders as string | undefined;
      const mailFolders = mailFoldersStr
        ? mailFoldersStr.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      // 處理 allowedExtensions: 表單中是逗號分隔字串，需轉換為陣列
      const allowedExtStr = data.allowedExtensions as string | undefined;
      const allowedExtensions = allowedExtStr
        ? allowedExtStr.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      const input: UpdateOutlookConfigInput = {
        name: data.name as string,
        description: data.description as string | undefined,
        tenantId: data.tenantId as string,
        clientId: data.clientId as string,
        clientSecret: data.clientSecret as string | undefined,
        mailboxAddress: data.mailboxAddress as string,
        mailFolders,
        maxAttachmentSizeMb: data.maxAttachmentSizeMb as number | undefined,
        allowedExtensions,
      };

      await updateMutation.mutateAsync({
        configId: editingConfig.id,
        input,
      });
      toast.success('配置已更新');
      setViewMode('list');
      setEditingConfig(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失敗');
    }
  };

  const handleDelete = async (configId: string) => {
    try {
      await deleteMutation.mutateAsync(configId);
      toast.success('配置已刪除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  const handleToggleActive = async (configId: string, isActive: boolean) => {
    try {
      await toggleActiveMutation.mutateAsync({ configId, isActive });
      toast.success(isActive ? '配置已啟用' : '配置已停用');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失敗');
    }
  };

  const handleTestConnection = async (configId: string) => {
    setTestingConfigId(configId);
    try {
      const result = await testConfigMutation.mutateAsync(configId);
      if (result.success) {
        toast.success('連線測試成功');
      } else {
        toast.error(result.error || '連線測試失敗');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '連線測試失敗');
    } finally {
      setTestingConfigId(undefined);
    }
  };

  const handleTestNewConnection = async (data: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    mailboxAddress: string;
  }) => {
    try {
      const result = await testNewConfigMutation.mutateAsync(data);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '連線測試失敗',
      };
    }
  };

  const handleEdit = (config: OutlookConfigApiResponse) => {
    setEditingConfig(config);
    setViewMode('edit');
  };

  const handleManageRules = (config: OutlookConfigApiResponse) => {
    setRulesConfig(config);
  };

  const handleCancelForm = () => {
    setViewMode('list');
    setEditingConfig(null);
  };

  // --- Rules Handlers ---
  const handleCreateRule = async (input: CreateFilterRuleInput) => {
    if (!rulesConfig) return;
    try {
      await createRuleMutation.mutateAsync({
        configId: rulesConfig.id,
        input,
      });
      toast.success('規則已建立');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '建立失敗');
    }
  };

  const handleUpdateRule = async (ruleId: string, input: UpdateFilterRuleInput) => {
    if (!rulesConfig) return;
    try {
      await updateRuleMutation.mutateAsync({
        configId: rulesConfig.id,
        ruleId,
        input,
      });
      toast.success('規則已更新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失敗');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!rulesConfig) return;
    try {
      await deleteRuleMutation.mutateAsync({
        configId: rulesConfig.id,
        ruleId,
      });
      toast.success('規則已刪除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  const handleReorderRules = async (ruleIds: string[]) => {
    if (!rulesConfig) return;
    try {
      await reorderRulesMutation.mutateAsync({
        configId: rulesConfig.id,
        ruleIds,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '排序失敗');
    }
  };

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              Outlook 連線配置
            </h1>
            <p className="text-muted-foreground mt-1">
              管理 Outlook 信箱連線和過濾規則
            </p>
          </div>
        </div>

        {viewMode === 'list' && (
          <Button onClick={() => setViewMode('create')}>
            <Plus className="mr-2 h-4 w-4" />
            新增配置
          </Button>
        )}
      </div>

      {/* 內容區域 */}
      {viewMode === 'list' ? (
        <OutlookConfigList
          configs={configs}
          isLoading={isLoadingConfigs}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onTestConnection={handleTestConnection}
          onManageRules={handleManageRules}
          testingConfigId={testingConfigId}
        />
      ) : (
        <OutlookConfigForm
          config={viewMode === 'edit' ? editingConfig ?? undefined : undefined}
          cities={cities}
          onSubmit={viewMode === 'create' ? handleCreate : handleUpdate}
          onCancel={handleCancelForm}
          onTestConnection={handleTestNewConnection}
        />
      )}

      {/* 過濾規則編輯器 */}
      {rulesConfig && (
        <OutlookFilterRulesEditor
          configId={rulesConfig.id}
          configName={rulesConfig.name}
          rules={rulesData ?? []}
          isLoading={isLoadingRules}
          onCreateRule={handleCreateRule}
          onUpdateRule={handleUpdateRule}
          onDeleteRule={handleDeleteRule}
          onReorderRules={handleReorderRules}
          onClose={() => setRulesConfig(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Skeleton Component
// ============================================================

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
