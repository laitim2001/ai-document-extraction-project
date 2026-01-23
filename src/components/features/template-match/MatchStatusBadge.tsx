'use client';

/**
 * @fileoverview 匹配狀態徽章組件
 * @description
 *   顯示文件的模版匹配狀態（已匹配/未匹配/待審核）
 *
 * @module src/components/features/template-match/MatchStatusBadge
 * @since Epic 19 - Story 19.7
 * @lastModified 2026-01-23
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, Circle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type MatchStatus = 'matched' | 'unmatched' | 'pending';

interface MatchStatusBadgeProps {
  /** 匹配狀態 */
  status: MatchStatus;
  /** 是否顯示圖標 */
  showIcon?: boolean;
  /** 自定義類名 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const statusConfig: Record<MatchStatus, {
  variant: 'default' | 'secondary' | 'outline';
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}> = {
  matched: {
    variant: 'default',
    icon: CheckCircle,
    colorClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  unmatched: {
    variant: 'secondary',
    icon: Circle,
    colorClass: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  pending: {
    variant: 'outline',
    icon: Clock,
    colorClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * 匹配狀態徽章
 */
export function MatchStatusBadge({
  status,
  showIcon = true,
  className,
}: MatchStatusBadgeProps) {
  const t = useTranslations('templateInstance.match.status');
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(config.colorClass, className)}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {t(status)}
    </Badge>
  );
}
