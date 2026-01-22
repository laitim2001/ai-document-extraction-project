/**
 * @fileoverview 模版實例狀態配置
 * @description
 *   定義實例和行的狀態圖標、顏色配置
 *
 * @module src/components/features/template-instance/status-config
 * @since Epic 19 - Story 19.5
 * @lastModified 2026-01-22
 */

import type { TemplateInstanceStatus, TemplateInstanceRowStatus } from '@/types/template-instance';

// ============================================================================
// Types
// ============================================================================

interface StatusConfig {
  icon: string;
  color: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}

// ============================================================================
// Instance Status Configuration
// ============================================================================

/**
 * 實例狀態配置
 */
export const INSTANCE_STATUS_CONFIG: Record<TemplateInstanceStatus, StatusConfig> = {
  DRAFT: {
    icon: '📝',
    color: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
  PROCESSING: {
    icon: '⏳',
    color: 'text-blue-500',
    badgeVariant: 'outline',
  },
  COMPLETED: {
    icon: '✅',
    color: 'text-green-600',
    badgeVariant: 'default',
  },
  ERROR: {
    icon: '⚠️',
    color: 'text-orange-500',
    badgeVariant: 'destructive',
  },
  EXPORTED: {
    icon: '📤',
    color: 'text-purple-500',
    badgeVariant: 'outline',
  },
};

/**
 * 獲取實例狀態配置
 */
export function getInstanceStatusConfig(status: TemplateInstanceStatus): StatusConfig {
  return INSTANCE_STATUS_CONFIG[status] ?? INSTANCE_STATUS_CONFIG.DRAFT;
}

// ============================================================================
// Row Status Configuration
// ============================================================================

/**
 * 行狀態配置
 */
export const ROW_STATUS_CONFIG: Record<TemplateInstanceRowStatus, StatusConfig> = {
  PENDING: {
    icon: '⏳',
    color: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
  VALID: {
    icon: '✅',
    color: 'text-green-600',
    badgeVariant: 'default',
  },
  INVALID: {
    icon: '❌',
    color: 'text-red-500',
    badgeVariant: 'destructive',
  },
  SKIPPED: {
    icon: '⏭️',
    color: 'text-muted-foreground',
    badgeVariant: 'secondary',
  },
};

/**
 * 獲取行狀態配置
 */
export function getRowStatusConfig(status: TemplateInstanceRowStatus): StatusConfig {
  return ROW_STATUS_CONFIG[status] ?? ROW_STATUS_CONFIG.PENDING;
}
