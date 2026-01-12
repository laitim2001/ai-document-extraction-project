'use client';

/**
 * @fileoverview 格式列表組件
 * @description
 *   顯示公司的文件格式列表，整合篩選、排序和分頁功能。
 *   作為公司詳情頁「格式」Tab 的主要內容組件。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.1
 * @lastModified 2026-01-12
 *
 * @dependencies
 *   - @/hooks/use-company-formats - 數據獲取
 *   - FormatCard - 格式卡片
 *   - FormatFilters - 篩選控件
 */

import * as React from 'react';
import { FormatCard } from './FormatCard';
import { FormatFilters } from './FormatFilters';
import { useCompanyFormats } from '@/hooks/use-company-formats';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, AlertCircle } from 'lucide-react';
import type { FormatFiltersState } from '@/types/document-format';

// ============================================================================
// Types
// ============================================================================

export interface FormatListProps {
  /** 公司 ID */
  companyId: string;
  /** 自定義類名 */
  className?: string;
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 載入骨架屏
 */
function FormatListSkeleton() {
  return (
    <div className="space-y-4">
      {/* 篩選器骨架 */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-[160px]" />
        <Skeleton className="h-9 w-[140px]" />
        <Skeleton className="h-9 w-[130px]" />
      </div>
      {/* 卡片骨架 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[160px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * 空狀態顯示
 */
function FormatListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">尚無已識別的格式</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        上傳文件後系統會自動識別格式。每個公司的文件格式會根據文件類型和子類型自動分類。
      </p>
    </div>
  );
}

/**
 * 錯誤狀態顯示
 */
function FormatListError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-medium mb-2">載入失敗</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {error.message || '無法載入格式列表，請稍後再試。'}
      </p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        重試
      </Button>
    </div>
  );
}

/**
 * 無符合篩選條件
 */
function FormatListNoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">無符合條件的格式</h3>
      <p className="text-sm text-muted-foreground mb-4">
        調整篩選條件以查看更多格式。
      </p>
      <Button variant="outline" onClick={onReset}>
        清除篩選
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 格式列表組件
 *
 * @description
 *   顯示公司的文件格式列表，包含：
 *   - 篩選和排序控件
 *   - 格式卡片網格
 *   - 載入、空狀態和錯誤處理
 *
 * @param props - 組件屬性
 */
export function FormatList({ companyId, className }: FormatListProps) {
  // --- 篩選狀態 ---
  const [filters, setFilters] = React.useState<FormatFiltersState>({
    documentType: null,
    documentSubtype: null,
    sortBy: 'fileCount',
    sortOrder: 'desc',
  });

  // --- 數據獲取 ---
  const {
    formats,
    isLoading,
    error,
    pagination,
    refetch,
  } = useCompanyFormats({
    companyId,
    documentType: filters.documentType,
    documentSubtype: filters.documentSubtype,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  // --- 重置篩選 ---
  const handleReset = React.useCallback(() => {
    setFilters({
      documentType: null,
      documentSubtype: null,
      sortBy: 'fileCount',
      sortOrder: 'desc',
    });
  }, []);

  // --- 載入狀態 ---
  if (isLoading) {
    return <FormatListSkeleton />;
  }

  // --- 錯誤狀態 ---
  if (error) {
    return <FormatListError error={error} onRetry={refetch} />;
  }

  // --- 檢查是否有篩選條件 ---
  const hasFilters =
    filters.documentType !== null || filters.documentSubtype !== null;

  // --- 空狀態（無格式） ---
  if (!formats.length && !hasFilters) {
    return <FormatListEmpty />;
  }

  // --- 無符合篩選條件 ---
  if (!formats.length && hasFilters) {
    return (
      <div className={className}>
        <FormatFilters value={filters} onChange={setFilters} className="mb-4" />
        <FormatListNoResults onReset={handleReset} />
      </div>
    );
  }

  // --- 正常顯示 ---
  return (
    <div className={className}>
      {/* 篩選器 */}
      <FormatFilters value={filters} onChange={setFilters} className="mb-4" />

      {/* 統計資訊 */}
      <div className="mb-4 text-sm text-muted-foreground">
        共 {pagination.total} 個格式
      </div>

      {/* 格式卡片網格 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {formats.map((format) => (
          <FormatCard key={format.id} format={format} />
        ))}
      </div>

      {/* TODO: 分頁控件（如需要） */}
    </div>
  );
}
