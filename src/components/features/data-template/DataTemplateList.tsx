/**
 * @fileoverview 數據模版列表組件
 * @description
 *   顯示數據模版的網格列表，支援載入狀態和空狀態
 *
 * @module src/components/features/data-template/DataTemplateList
 * @since Epic 16 - Story 16.7
 * @lastModified 2026-01-13
 */

'use client';

import * as React from 'react';
import { FileCode } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTemplateCard } from './DataTemplateCard';
import type { DataTemplateSummary } from '@/types/data-template';

// ============================================================================
// Types
// ============================================================================

export interface DataTemplateListProps {
  /** 模版列表 */
  templates: DataTemplateSummary[];
  /** 是否載入中 */
  isLoading?: boolean;
  /** 錯誤 */
  error?: Error;
  /** 編輯回調 */
  onEdit?: (id: string) => void;
  /** 刪除回調 */
  onDelete?: (id: string, name: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DataTemplateList({
  templates,
  isLoading,
  error,
  onEdit,
  onDelete,
}: DataTemplateListProps) {
  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[180px] w-full" />
        ))}
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileCode className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium text-destructive">載入失敗</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {error.message || '無法載入模版列表'}
        </p>
      </div>
    );
  }

  // --- Empty State ---
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">尚無數據模版</h3>
        <p className="text-sm text-muted-foreground mt-1">
          點擊「新增模版」按鈕建立第一個數據模版
        </p>
      </div>
    );
  }

  // --- Template List ---
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <DataTemplateCard
          key={template.id}
          template={template}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
