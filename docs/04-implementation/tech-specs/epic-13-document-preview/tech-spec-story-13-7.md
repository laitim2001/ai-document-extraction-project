# Tech Spec: Story 13.7 - Field Mapping 後台管理頁面

> **Version**: 1.0.0
> **Created**: 2026-01-07
> **Status**: Draft
> **Story Key**: STORY-13-7

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 13.7 |
| **Epic** | Epic 13 - 文件預覽與欄位映射 |
| **Estimated Effort** | 13 Story Points |
| **Dependencies** | Story 13-3（映射配置 UI）, Story 13-4（映射配置 API） |
| **Blocking** | None |
| **FR Coverage** | 擴展 Epic 13 管理功能 |

---

## Objective

實現 Field Mapping 後台管理頁面，讓管理員可以：
- 查看所有三層映射配置（GLOBAL/COMPANY/FORMAT）
- 新增、編輯、刪除配置
- 使用現有 MappingConfigPanel 組件管理規則
- 通過 React Query 進行伺服器狀態管理

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-13.7.1 | 列表頁顯示所有配置 | 表格 + useFieldMappingConfigs Hook |
| AC-13.7.2 | 支援篩選（範圍/公司/格式/狀態） | FieldMappingConfigFilters 組件 |
| AC-13.7.3 | 新增配置頁面 | /new 路由 + MappingConfigPanel |
| AC-13.7.4 | 編輯配置頁面 | /[id] 路由 + MappingConfigPanel |
| AC-13.7.5 | 刪除配置（含確認） | AlertDialog + useDeleteFieldMappingConfig |
| AC-13.7.6 | 操作反饋（成功/錯誤提示） | toast 通知 |
| AC-13.7.7 | React Query 整合 | 快取失效、樂觀更新、錯誤重試 |

---

## Implementation Guide

### Phase 1: React Query Hooks (3 points)

#### 1.1 類型定義

```typescript
// src/types/field-mapping-config-api.ts（可選，現有 field-mapping.ts 可能已足夠）

/**
 * @fileoverview Field Mapping Config API 類型定義
 */

export interface GetFieldMappingConfigsParams {
  scope?: 'GLOBAL' | 'COMPANY' | 'FORMAT';
  companyId?: string;
  documentFormatId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface FieldMappingConfigListResponse {
  success: true;
  data: FieldMappingConfigListItem[];
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface FieldMappingConfigListItem {
  id: string;
  name: string;
  description: string | null;
  scope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
  companyId: string | null;
  companyName: string | null;
  documentFormatId: string | null;
  documentFormatName: string | null;
  isActive: boolean;
  rulesCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FieldMappingConfigResponse {
  success: true;
  data: FieldMappingConfigDetail;
}

export interface FieldMappingConfigDetail extends FieldMappingConfigListItem {
  rules: FieldMappingRuleDTO[];
}
```

#### 1.2 Hooks 實現

```typescript
// src/hooks/use-field-mapping-configs.ts

/**
 * @fileoverview Field Mapping 配置 React Query Hooks
 * @description
 *   提供 Field Mapping 配置的資料查詢和變更操作 hooks。
 *   使用 React Query 進行伺服器狀態管理。
 *
 * @module src/hooks/use-field-mapping-configs
 * @since Epic 13 - Story 13.7
 * @lastModified 2026-01-07
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';

// ============================================================================
// 常數
// ============================================================================

const QUERY_KEY = 'field-mapping-configs';
const API_BASE = '/api/v1/field-mapping-configs';

// ============================================================================
// 查詢 Hooks
// ============================================================================

/**
 * 查詢 Field Mapping 配置列表
 */
export function useFieldMappingConfigs(
  params: GetFieldMappingConfigsParams = {},
  options?: Omit<UseQueryOptions<FieldMappingConfigListResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', params],
    queryFn: async (): Promise<FieldMappingConfigListResponse> => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });

      const url = `${API_BASE}?${searchParams.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '載入配置列表失敗');
      }

      return res.json();
    },
    ...options,
  });
}

/**
 * 查詢單一 Field Mapping 配置
 */
export function useFieldMappingConfig(
  id: string,
  options?: Omit<UseQueryOptions<FieldMappingConfigResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: async (): Promise<FieldMappingConfigResponse> => {
      const res = await fetch(`${API_BASE}/${id}`);

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '載入配置詳情失敗');
      }

      return res.json();
    },
    enabled: !!id,
    ...options,
  });
}

// ============================================================================
// 變更 Hooks
// ============================================================================

/**
 * 建立 Field Mapping 配置
 */
export function useCreateFieldMappingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFieldMappingConfigRequest) => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '建立配置失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * 更新 Field Mapping 配置
 */
export function useUpdateFieldMappingConfig(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateFieldMappingConfigRequest) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '更新配置失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/**
 * 刪除 Field Mapping 配置
 */
export function useDeleteFieldMappingConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '刪除配置失敗');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ============================================================================
// 規則 Hooks
// ============================================================================

/**
 * 建立 Field Mapping 規則
 */
export function useCreateFieldMappingRule(configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFieldMappingRuleRequest) => {
      const res = await fetch(`${API_BASE}/${configId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '建立規則失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', configId] });
    },
  });
}

/**
 * 更新 Field Mapping 規則
 */
export function useUpdateFieldMappingRule(configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, data }: { ruleId: string; data: UpdateFieldMappingRuleRequest }) => {
      const res = await fetch(`${API_BASE}/${configId}/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '更新規則失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', configId] });
    },
  });
}

/**
 * 刪除 Field Mapping 規則
 */
export function useDeleteFieldMappingRule(configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/${configId}/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '刪除規則失敗');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', configId] });
    },
  });
}

/**
 * 重排序 Field Mapping 規則
 */
export function useReorderFieldMappingRules(configId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleIds: string[]) => {
      const res = await fetch(`${API_BASE}/${configId}/rules/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleIds }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '重排序失敗');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', configId] });
    },
  });
}

// ============================================================================
// 測試 Hook
// ============================================================================

/**
 * 測試 Field Mapping 配置
 */
export function useTestFieldMappingConfig(configId: string) {
  return useMutation({
    mutationFn: async (testData: { sampleInput: Record<string, unknown> }) => {
      const res = await fetch(`${API_BASE}/${configId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || '測試失敗');
      }

      return res.json();
    },
  });
}

// ============================================================================
// 輔助 Hooks
// ============================================================================

/**
 * 查詢配置可用的公司列表
 */
export function useCompaniesForFieldMapping() {
  return useQuery({
    queryKey: ['companies', 'field-mapping-select'],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const res = await fetch('/api/v1/companies?limit=100&sortBy=name');

      if (!res.ok) {
        throw new Error('載入公司列表失敗');
      }

      const data = await res.json();
      return data.data || [];
    },
  });
}

/**
 * 查詢配置可用的文件格式列表
 */
export function useDocumentFormatsForFieldMapping(companyId?: string) {
  return useQuery({
    queryKey: ['document-formats', 'field-mapping-select', companyId],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const params = new URLSearchParams({ limit: '100', sortBy: 'name' });
      if (companyId) {
        params.set('companyId', companyId);
      }

      const res = await fetch(`/api/v1/document-formats?${params}`);

      if (!res.ok) {
        throw new Error('載入文件格式列表失敗');
      }

      const data = await res.json();
      return data.data || [];
    },
    enabled: true,
  });
}
```

---

### Phase 2: 列表頁實現 (3 points)

#### 2.1 頁面結構

```typescript
// src/app/(dashboard)/admin/field-mapping-configs/page.tsx

/**
 * @fileoverview Field Mapping 配置管理列表頁
 * @description 顯示所有 Field Mapping 配置，支援篩選和 CRUD 操作
 * @module src/app/(dashboard)/admin/field-mapping-configs
 * @since Epic 13 - Story 13.7
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, Settings2, Trash2, Edit } from 'lucide-react';
import {
  useFieldMappingConfigs,
  useDeleteFieldMappingConfig,
  useCompaniesForFieldMapping,
} from '@/hooks/use-field-mapping-configs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { GetFieldMappingConfigsParams } from '@/types/field-mapping';

const SCOPE_LABELS = {
  GLOBAL: '全域',
  COMPANY: '公司',
  FORMAT: '格式',
} as const;

export default function FieldMappingConfigsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // 篩選狀態
  const [filters, setFilters] = React.useState<GetFieldMappingConfigsParams>({});
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // 資料查詢
  const { data, isLoading, refetch } = useFieldMappingConfigs(filters);
  const { data: companies = [] } = useCompaniesForFieldMapping();
  const deleteMutation = useDeleteFieldMappingConfig();

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteMutation.mutateAsync(deleteId);
      toast({ title: '刪除成功', description: '配置已刪除' });
      setDeleteId(null);
    } catch (error) {
      toast({
        title: '刪除失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      {/* 頁面標題和操作 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">欄位映射配置管理</h1>
          <p className="text-muted-foreground">管理三層級欄位映射規則</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重新整理
          </Button>
          <Button onClick={() => router.push('/admin/field-mapping-configs/new')}>
            <Plus className="mr-2 h-4 w-4" />
            新增配置
          </Button>
        </div>
      </div>

      {/* 篩選卡片 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            篩選條件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* 範圍篩選 */}
            <Select
              value={filters.scope || ''}
              onValueChange={(v) =>
                setFilters((prev) => ({
                  ...prev,
                  scope: v as 'GLOBAL' | 'COMPANY' | 'FORMAT' | undefined,
                }))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="所有範圍" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">所有範圍</SelectItem>
                <SelectItem value="GLOBAL">全域</SelectItem>
                <SelectItem value="COMPANY">公司</SelectItem>
                <SelectItem value="FORMAT">格式</SelectItem>
              </SelectContent>
            </Select>

            {/* 公司篩選 */}
            <Select
              value={filters.companyId || ''}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, companyId: v || undefined }))
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="所有公司" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">所有公司</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 狀態篩選 */}
            <Select
              value={
                filters.isActive === true
                  ? 'active'
                  : filters.isActive === false
                    ? 'inactive'
                    : ''
              }
              onValueChange={(v) =>
                setFilters((prev) => ({
                  ...prev,
                  isActive: v === '' ? undefined : v === 'active',
                }))
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="所有狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">所有狀態</SelectItem>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>

            {/* 搜尋 */}
            <Input
              placeholder="搜尋名稱..."
              className="w-[200px]"
              value={filters.search || ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 配置列表表格 */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名稱</TableHead>
              <TableHead>範圍</TableHead>
              <TableHead>公司</TableHead>
              <TableHead>格式</TableHead>
              <TableHead>規則數</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>更新時間</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  載入中...
                </TableCell>
              </TableRow>
            ) : !data?.data?.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  尚無配置資料
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{SCOPE_LABELS[config.scope]}</Badge>
                  </TableCell>
                  <TableCell>{config.companyName || '-'}</TableCell>
                  <TableCell>{config.documentFormatName || '-'}</TableCell>
                  <TableCell>{config.rulesCount}</TableCell>
                  <TableCell>
                    <Badge variant={config.isActive ? 'default' : 'secondary'}>
                      {config.isActive ? '啟用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(config.updatedAt).toLocaleDateString('zh-TW')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          router.push(`/admin/field-mapping-configs/${config.id}`)
                        }
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteId(config.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此映射配置嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

---

### Phase 3: 新增頁實現 (2 points)

```typescript
// src/app/(dashboard)/admin/field-mapping-configs/new/page.tsx

/**
 * @fileoverview 新增 Field Mapping 配置頁面
 * @module src/app/(dashboard)/admin/field-mapping-configs/new
 * @since Epic 13 - Story 13.7
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MappingConfigPanel } from '@/components/features/mapping-config';
import {
  useCreateFieldMappingConfig,
  useCreateFieldMappingRule,
} from '@/hooks/use-field-mapping-configs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { VisualMappingConfig } from '@/types/field-mapping';

export default function NewFieldMappingConfigPage() {
  const router = useRouter();
  const { toast } = useToast();

  const createConfigMutation = useCreateFieldMappingConfig();

  const handleSave = async (config: VisualMappingConfig) => {
    try {
      // 1. 創建配置
      const result = await createConfigMutation.mutateAsync({
        name: config.name || '新配置',
        description: config.description,
        scope: config.scope,
        companyId: config.companyId || undefined,
        documentFormatId: config.formatId || undefined,
        isActive: config.isActive ?? true,
      });

      // 2. 批量創建規則
      const configId = result.data.id;
      for (const rule of config.rules) {
        await fetch(`/api/v1/field-mapping-configs/${configId}/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceFields: rule.sourceFields,
            targetField: rule.targetField,
            transformType: rule.transformType,
            transformParams: rule.transformParams,
            priority: rule.priority,
            isActive: rule.isActive,
            description: rule.description,
          }),
        });
      }

      toast({ title: '建立成功', description: '配置已建立' });
      router.push('/admin/field-mapping-configs');
    } catch (error) {
      toast({
        title: '建立失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      {/* 返回按鈕和標題 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/field-mapping-configs')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <h1 className="mt-4 text-2xl font-bold">新增欄位映射配置</h1>
      </div>

      {/* 使用現有的 MappingConfigPanel */}
      <MappingConfigPanel
        onSave={handleSave}
        onCancel={() => router.push('/admin/field-mapping-configs')}
      />
    </div>
  );
}
```

---

### Phase 4: 編輯頁實現 (3 points)

```typescript
// src/app/(dashboard)/admin/field-mapping-configs/[id]/page.tsx

/**
 * @fileoverview 編輯 Field Mapping 配置頁面
 * @module src/app/(dashboard)/admin/field-mapping-configs/[id]
 * @since Epic 13 - Story 13.7
 */

'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { MappingConfigPanel } from '@/components/features/mapping-config';
import {
  useFieldMappingConfig,
  useUpdateFieldMappingConfig,
  useCreateFieldMappingRule,
  useUpdateFieldMappingRule,
  useDeleteFieldMappingRule,
} from '@/hooks/use-field-mapping-configs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { VisualMappingConfig, VisualMappingRule } from '@/types/field-mapping';

export default function EditFieldMappingConfigPage() {
  const router = useRouter();
  const params = useParams();
  const configId = params.id as string;
  const { toast } = useToast();

  // 載入配置
  const { data: configResponse, isLoading } = useFieldMappingConfig(configId);

  // 變更 Hooks
  const updateConfigMutation = useUpdateFieldMappingConfig(configId);
  const createRuleMutation = useCreateFieldMappingRule(configId);
  const updateRuleMutation = useUpdateFieldMappingRule(configId);
  const deleteRuleMutation = useDeleteFieldMappingRule(configId);

  // 轉換為 UI 格式
  const visualConfig = React.useMemo<VisualMappingConfig | null>(() => {
    if (!configResponse?.data) return null;
    const config = configResponse.data;
    return {
      id: config.id,
      name: config.name,
      description: config.description || undefined,
      scope: config.scope as 'GLOBAL' | 'COMPANY' | 'FORMAT',
      companyId: config.companyId || undefined,
      formatId: config.documentFormatId || undefined,
      isActive: config.isActive,
      version: config.version,
      rules: (config.rules || []).map((rule) => ({
        id: rule.id,
        sourceFields: rule.sourceFields,
        targetField: rule.targetField,
        transformType: rule.transformType,
        transformParams: rule.transformParams || {},
        priority: rule.priority,
        isActive: rule.isActive,
        description: rule.description,
      })),
    };
  }, [configResponse]);

  const handleSave = async (newConfig: VisualMappingConfig) => {
    try {
      // 1. 更新配置基本資訊
      await updateConfigMutation.mutateAsync({
        name: newConfig.name,
        description: newConfig.description,
        scope: newConfig.scope,
        companyId: newConfig.companyId || null,
        documentFormatId: newConfig.formatId || null,
        isActive: newConfig.isActive,
        version: visualConfig?.version || 1,
      });

      // 2. 同步規則
      const oldRules = visualConfig?.rules || [];
      const newRules = newConfig.rules || [];

      // 找出需要刪除的規則
      const newRuleIds = new Set(newRules.filter((r) => r.id).map((r) => r.id));
      for (const oldRule of oldRules) {
        if (oldRule.id && !newRuleIds.has(oldRule.id)) {
          await deleteRuleMutation.mutateAsync(oldRule.id);
        }
      }

      // 處理新增和更新
      for (let i = 0; i < newRules.length; i++) {
        const rule = newRules[i];
        const ruleData = {
          sourceFields: rule.sourceFields,
          targetField: rule.targetField,
          transformType: rule.transformType,
          transformParams: rule.transformParams,
          priority: i,
          isActive: rule.isActive,
          description: rule.description,
        };

        if (rule.id) {
          // 更新現有規則
          await updateRuleMutation.mutateAsync({ ruleId: rule.id, data: ruleData });
        } else {
          // 創建新規則
          await createRuleMutation.mutateAsync(ruleData);
        }
      }

      toast({ title: '更新成功', description: '配置已更新' });
      router.push('/admin/field-mapping-configs');
    } catch (error) {
      toast({
        title: '更新失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!visualConfig) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-center text-muted-foreground">配置不存在</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      {/* 返回按鈕和標題 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/field-mapping-configs')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        <h1 className="mt-4 text-2xl font-bold">編輯欄位映射配置</h1>
        <p className="text-muted-foreground">版本 {visualConfig.version}</p>
      </div>

      {/* 使用現有的 MappingConfigPanel */}
      <MappingConfigPanel
        initialConfig={visualConfig}
        onSave={handleSave}
        onCancel={() => router.push('/admin/field-mapping-configs')}
      />
    </div>
  );
}
```

---

## Project Structure

```
src/
├── app/(dashboard)/admin/field-mapping-configs/
│   ├── page.tsx                    # 列表頁
│   ├── new/
│   │   └── page.tsx                # 新增頁
│   └── [id]/
│       └── page.tsx                # 編輯頁
│
├── hooks/
│   └── use-field-mapping-configs.ts  # React Query Hooks
│
├── components/features/mapping-config/
│   ├── MappingConfigPanel.tsx      # 主面板（現有）
│   ├── ConfigSelector.tsx          # 配置選擇器（現有）
│   ├── MappingRuleList.tsx         # 規則列表（現有）
│   └── ...                         # 其他現有組件
│
└── types/
    └── field-mapping.ts            # 類型定義（現有）
```

---

## Dependencies

| 依賴 | 版本 | 用途 |
|------|------|------|
| @tanstack/react-query | ^5.x | 伺服器狀態管理 |
| lucide-react | ^0.x | 圖標 |
| shadcn/ui | - | UI 組件 |

---

## Verification Checklist

### 功能驗證

- [ ] 列表頁顯示所有配置
- [ ] 篩選功能正常（範圍/公司/格式/狀態）
- [ ] 搜尋功能正常
- [ ] 新增配置成功並導航回列表
- [ ] 編輯配置成功並導航回列表
- [ ] 刪除配置成功並刷新列表
- [ ] 規則的新增/編輯/刪除/排序正常
- [ ] 成功/錯誤 toast 正確顯示

### 邊界條件

- [ ] 空列表顯示適當提示
- [ ] 載入中顯示載入狀態
- [ ] 網路錯誤顯示錯誤訊息
- [ ] 版本衝突處理正確

---

*Tech Spec 建立日期: 2026-01-07*
*狀態: Draft*
