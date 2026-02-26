'use client';

/**
 * @fileoverview FieldDefinitionSet Scope Badge
 * @description
 *   顯示 FieldDefinitionSet 的 scope 類型徽章：
 *   - GLOBAL: 藍色
 *   - COMPANY: 綠色
 *   - FORMAT: 紫色
 *
 * @module src/components/features/field-definition-set/ScopeBadge
 * @since CHANGE-042 Phase 3
 * @lastModified 2026-02-23
 *
 * @dependencies
 *   - next-intl - 國際化
 *   - @/components/ui/badge - Badge 組件
 */

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface ScopeBadgeProps {
  scope: string;
  className?: string;
}

// ============================================================
// Constants
// ============================================================

const SCOPE_STYLES: Record<string, string> = {
  GLOBAL: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  COMPANY: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  FORMAT: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
};

// ============================================================
// Component
// ============================================================

export function ScopeBadge({ scope, className }: ScopeBadgeProps) {
  const t = useTranslations('fieldDefinitionSet');

  const label = t(`scopeBadge.${scope}` as Parameters<typeof t>[0]);
  const styles = SCOPE_STYLES[scope] ?? '';

  return (
    <Badge variant="outline" className={cn(styles, className)}>
      {label}
    </Badge>
  );
}
