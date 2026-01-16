/**
 * @fileoverview Field Mapping 配置管理列表頁
 * @description
 *   Field Mapping 配置的管理介面入口：
 *   - 表格形式顯示所有配置
 *   - 支援篩選（範圍、公司、格式、狀態、搜尋）
 *   - 提供新增、編輯、刪除功能
 *
 * @module src/app/(dashboard)/admin/field-mapping-configs
 * @since Epic 13 - Story 13.7
 * @lastModified 2026-01-07
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Settings2,
  Pencil,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import {
  useFieldMappingConfigs,
  useDeleteFieldMappingConfig,
  useCompaniesForFieldMapping,
  useDocumentFormatsForFieldMapping,
  type GetFieldMappingConfigsParams,
  type FieldMappingConfigListItem,
} from '@/hooks/use-field-mapping-configs';
import type { ConfigScope } from '@/types/field-mapping';

// ============================================================================
// Types
// ============================================================================

interface FiltersState {
  scope?: ConfigScope;
  companyId?: string;
  documentFormatId?: string;
  isActive?: boolean;
  search?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SCOPE_OPTIONS: { value: ConfigScope; label: string }[] = [
  { value: 'GLOBAL', label: '通用' },
  { value: 'COMPANY', label: '公司' },
  { value: 'FORMAT', label: '格式' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '啟用' },
  { value: 'inactive', label: '停用' },
];

// ============================================================================
// Helper Components
// ============================================================================

function ScopeBadge({ scope }: { scope: ConfigScope }) {
  const variants: Record<ConfigScope, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
    GLOBAL: { variant: 'default', label: '通用' },
    COMPANY: { variant: 'secondary', label: '公司' },
    FORMAT: { variant: 'outline', label: '格式' },
  };

  const { variant, label } = variants[scope];

  return <Badge variant={variant}>{label}</Badge>;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? 'default' : 'secondary'}>
      {isActive ? '啟用' : '停用'}
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ============================================================================
// Filters Component
// ============================================================================

interface FiltersProps {
  filters: FiltersState;
  onFiltersChange: (filters: FiltersState) => void;
  companies: Array<{ id: string; name: string }>;
  documentFormats: Array<{ id: string; name: string }>;
}

function ConfigFilters({
  filters,
  onFiltersChange,
  companies,
  documentFormats,
}: FiltersProps) {
  const handleScopeChange = (value: string) => {
    if (value === 'all') {
      const { scope: _, ...rest } = filters;
      onFiltersChange(rest);
    } else {
      onFiltersChange({ ...filters, scope: value as ConfigScope });
    }
  };

  const handleCompanyChange = (value: string) => {
    if (value === 'all') {
      const { companyId: _, ...rest } = filters;
      onFiltersChange(rest);
    } else {
      onFiltersChange({ ...filters, companyId: value });
    }
  };

  const handleFormatChange = (value: string) => {
    if (value === 'all') {
      const { documentFormatId: _, ...rest } = filters;
      onFiltersChange(rest);
    } else {
      onFiltersChange({ ...filters, documentFormatId: value });
    }
  };

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      const { isActive: _, ...rest } = filters;
      onFiltersChange(rest);
    } else {
      onFiltersChange({ ...filters, isActive: value === 'active' });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      onFiltersChange({ ...filters, search: value });
    } else {
      const { search: _, ...rest } = filters;
      onFiltersChange(rest);
    }
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Scope Filter */}
      <Select
        value={filters.scope ?? 'all'}
        onValueChange={handleScopeChange}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="選擇範圍" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部範圍</SelectItem>
          {SCOPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Company Filter */}
      <Select
        value={filters.companyId ?? 'all'}
        onValueChange={handleCompanyChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="選擇公司" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部公司</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Document Format Filter */}
      <Select
        value={filters.documentFormatId ?? 'all'}
        onValueChange={handleFormatChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="選擇格式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部格式</SelectItem>
          {documentFormats.map((format) => (
            <SelectItem key={format.id} value={format.id}>
              {format.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={
          filters.isActive === undefined
            ? 'all'
            : filters.isActive
              ? 'active'
              : 'inactive'
        }
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="選擇狀態" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜尋配置名稱..."
          value={filters.search ?? ''}
          onChange={handleSearchChange}
          className="pl-10"
        />
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>
          <X className="h-4 w-4 mr-1" />
          清除篩選
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Config Table Component
// ============================================================================

interface ConfigTableProps {
  configs: FieldMappingConfigListItem[];
  isLoading: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

function ConfigTable({ configs, isLoading, onEdit, onDelete }: ConfigTableProps) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Settings2 className="h-12 w-12 mb-4 opacity-50" />
        <p>沒有找到配置</p>
        <p className="text-sm">請調整篩選條件或新增配置</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名稱</TableHead>
          <TableHead>範圍</TableHead>
          <TableHead>公司</TableHead>
          <TableHead>格式</TableHead>
          <TableHead className="text-center">規則數</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>更新時間</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {configs.map((config) => (
          <TableRow key={config.id}>
            <TableCell className="font-medium">
              <div>
                <div>{config.name}</div>
                {config.description && (
                  <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {config.description}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <ScopeBadge scope={config.scope} />
            </TableCell>
            <TableCell>{config.companyName ?? '-'}</TableCell>
            <TableCell>{config.documentFormatName ?? '-'}</TableCell>
            <TableCell className="text-center">{config.rulesCount}</TableCell>
            <TableCell>
              <StatusBadge isActive={config.isActive} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(config.updatedAt).toLocaleDateString('zh-TW')}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(config.id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(config.id, config.name)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function FieldMappingConfigsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // --- State ---
  const [filters, setFilters] = React.useState<FiltersState>({});
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  // --- Build Query Params ---
  const queryParams: GetFieldMappingConfigsParams = React.useMemo(() => {
    const params: GetFieldMappingConfigsParams = {
      limit: 100,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    };

    if (filters.scope) params.scope = filters.scope;
    if (filters.companyId) params.companyId = filters.companyId;
    if (filters.documentFormatId) params.documentFormatId = filters.documentFormatId;
    if (filters.isActive !== undefined) params.isActive = filters.isActive;
    if (filters.search) params.search = filters.search;

    return params;
  }, [filters]);

  // --- Queries ---
  const {
    data: configsData,
    isLoading,
    error,
    refetch,
  } = useFieldMappingConfigs(queryParams);

  const { data: companies = [] } = useCompaniesForFieldMapping();
  const { data: documentFormats = [] } = useDocumentFormatsForFieldMapping(
    filters.companyId
  );

  const deleteMutation = useDeleteFieldMappingConfig();

  // --- Derived State ---
  const configs = configsData?.data ?? [];
  const totalCount = configsData?.meta?.pagination?.total ?? configs.length;

  // --- Handlers ---

  const handleCreateNew = React.useCallback(() => {
    router.push('/admin/field-mapping-configs/new');
  }, [router]);

  const handleEdit = React.useCallback(
    (id: string) => {
      router.push(`/admin/field-mapping-configs/${id}`);
    },
    [router]
  );

  const handleDeleteRequest = React.useCallback(
    (id: string, name: string) => {
      setDeleteTarget({ id, name });
    },
    []
  );

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({
        title: '刪除成功',
        description: `已刪除配置「${deleteTarget.name}」`,
      });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '刪除失敗',
        description: err instanceof Error ? err.message : '未知錯誤',
      });
    }
  }, [deleteTarget, deleteMutation, toast]);

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  // --- Render ---

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            欄位映射配置管理
          </h1>
          <p className="text-muted-foreground">
            管理三層級欄位映射規則配置（通用 / 公司 / 格式）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            重新整理
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            新增配置
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">篩選條件</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigFilters
            filters={filters}
            onFiltersChange={setFilters}
            companies={companies}
            documentFormats={documentFormats}
          />
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            載入配置資料時發生錯誤：
            {error instanceof Error ? error.message : '未知錯誤'}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">共 {totalCount} 個配置</div>

      {/* Config Table */}
      <Card>
        <CardContent className="p-0">
          <ConfigTable
            configs={configs}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除配置</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除配置「{deleteTarget?.name}」嗎？此操作無法復原，配置中的所有規則也將被刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '刪除中...' : '確認刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
