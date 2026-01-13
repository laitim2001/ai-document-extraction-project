'use client';

/**
 * @fileoverview 關聯映射配置卡片
 * @description
 *   顯示格式關聯的 FieldMappingConfig 列表，提供創建和編輯入口。
 *   - 有配置時：顯示配置名稱、規則數量、更新時間
 *   - 無配置時：顯示創建按鈕
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.4
 * @lastModified 2026-01-12
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, ExternalLink, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

// ============================================================================
// Types
// ============================================================================

export interface MappingConfigItem {
  id: string;
  name: string;
  scope: string;
  rulesCount: number;
  isActive: boolean;
  updatedAt: string;
}

export interface LinkedMappingConfigProps {
  /** 映射配置列表 */
  configs: MappingConfigItem[];
  /** 格式 ID */
  formatId: string;
  /** 公司 ID */
  companyId: string;
  /** 目前生效的配置層級 */
  effectiveLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 格式化日期時間
 */
function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'yyyy/MM/dd HH:mm', { locale: zhTW });
  } catch {
    return dateString;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * 關聯映射配置卡片
 *
 * @description
 *   顯示格式關聯的欄位映射配置，支援創建和編輯操作。
 *   創建時會預填 scope=FORMAT、companyId 和 documentFormatId。
 */
export function LinkedMappingConfig({
  configs,
  formatId,
  companyId,
  effectiveLevel,
}: LinkedMappingConfigProps) {
  const router = useRouter();

  // --- Handlers ---

  const handleCreate = React.useCallback(() => {
    const params = new URLSearchParams({
      scope: 'FORMAT',
      companyId,
      documentFormatId: formatId,
    });
    router.push(`/admin/field-mapping-configs/new?${params}`);
  }, [router, companyId, formatId]);

  const handleEdit = React.useCallback(
    (configId: string) => {
      router.push(`/admin/field-mapping-configs/${configId}`);
    },
    [router]
  );

  // --- Empty State ---

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <X className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          尚未配置格式專屬的欄位映射
        </p>
        {effectiveLevel !== 'NONE' && (
          <div className="text-xs text-muted-foreground mb-4">
            目前使用 <Badge variant="outline" className="text-xs">{effectiveLevel}</Badge> 級別配置
          </div>
        )}
        {effectiveLevel === 'NONE' && (
          <p className="text-xs text-muted-foreground mb-4">
            目前使用系統預設配置
          </p>
        )}
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          創建映射配置
        </Button>
      </div>
    );
  }

  // --- Config List ---

  return (
    <div className="space-y-3">
      {configs.map((config) => (
        <div
          key={config.id}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium">{config.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>規則: {config.rulesCount} 個</span>
                <span>|</span>
                <span>更新: {formatDateTime(config.updatedAt)}</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(config.id)}
          >
            編輯
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      ))}

      {/* 創建更多按鈕 */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleCreate}
      >
        <Plus className="h-4 w-4 mr-2" />
        創建新的映射配置
      </Button>
    </div>
  );
}
