/**
 * @fileoverview 可折疊分組全局控制組件
 * @description
 *   提供「展開全部」和「收起全部」按鈕，
 *   用於快速控制所有分組的展開/收起狀態。
 *
 * @module src/components/features/prompt-config/CollapsibleControls
 * @since CHANGE-028 - Prompt Config 列表可折疊分組
 * @lastModified 2026-02-04
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

interface CollapsibleControlsProps {
  /** 有配置的分組數量 */
  totalGroups: number;
  /** 已展開的分組數量 */
  expandedCount: number;
  /** 展開全部回調 */
  onExpandAll: () => void;
  /** 收起全部回調 */
  onCollapseAll: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 可折疊分組全局控制組件
 *
 * @description 提供展開/收起全部分組的快捷按鈕
 */
export function CollapsibleControls({
  totalGroups,
  expandedCount,
  onExpandAll,
  onCollapseAll,
}: CollapsibleControlsProps) {
  const t = useTranslations('promptConfig.collapsible');

  // 如果沒有分組，不顯示控制按鈕
  if (totalGroups === 0) {
    return null;
  }

  const allExpanded = expandedCount >= totalGroups;
  const allCollapsed = expandedCount === 0;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onExpandAll}
        disabled={allExpanded}
        className="text-xs"
      >
        <ChevronsUpDown className="h-3.5 w-3.5 mr-1.5" />
        {t('expandAll')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onCollapseAll}
        disabled={allCollapsed}
        className="text-xs"
      >
        <ChevronsDownUp className="h-3.5 w-3.5 mr-1.5" />
        {t('collapseAll')}
      </Button>
    </div>
  );
}
