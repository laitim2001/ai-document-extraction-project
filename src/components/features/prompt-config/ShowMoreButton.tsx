/**
 * @fileoverview 顯示更多按鈕組件
 * @description
 *   用於可折疊分組中，當配置數量超過當前顯示數量時，
 *   提供「顯示更多」按鈕以漸進式載入更多卡片。
 *
 * @module src/components/features/prompt-config/ShowMoreButton
 * @since CHANGE-028 - Prompt Config 列表可折疊分組
 * @lastModified 2026-02-04
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// Types
// ============================================================================

interface ShowMoreButtonProps {
  /** 剩餘未顯示的數量 */
  remainingCount: number;
  /** 點擊回調 */
  onClick: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * 顯示更多按鈕組件
 *
 * @description 顯示剩餘未載入的配置數量，點擊後觸發載入更多
 */
export function ShowMoreButton({
  remainingCount,
  onClick,
  disabled = false,
}: ShowMoreButtonProps) {
  const t = useTranslations('promptConfig.collapsible');

  if (remainingCount <= 0) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      className="w-full mt-4 text-muted-foreground hover:text-foreground"
      onClick={onClick}
      disabled={disabled}
    >
      <ChevronDown className="h-4 w-4 mr-2" />
      {t('showMore', { count: remainingCount })}
    </Button>
  );
}
