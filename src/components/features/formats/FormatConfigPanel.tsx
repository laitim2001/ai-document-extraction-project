'use client';

/**
 * @fileoverview 格式專屬配置面板
 * @description
 *   顯示格式關聯的 PromptConfig 和 FieldMappingConfig，
 *   以及配置繼承關係說明。
 *
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.4
 * @lastModified 2026-01-12
 *
 * @features
 *   - Prompt 配置區塊（LinkedPromptConfig）
 *   - 映射配置區塊（LinkedMappingConfig）
 *   - 配置繼承說明（ConfigInheritanceInfo）
 *   - 載入狀態和錯誤處理
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { LinkedPromptConfig, type PromptConfigItem } from './LinkedPromptConfig';
import { LinkedMappingConfig, type MappingConfigItem } from './LinkedMappingConfig';
import { ConfigInheritanceInfo, type ConfigInheritance } from './ConfigInheritanceInfo';

// ============================================================================
// Types
// ============================================================================

export interface FormatConfigPanelProps {
  /** 格式 ID */
  formatId: string;
  /** 公司 ID */
  companyId: string;
}

interface ConfigsApiResponse {
  success: boolean;
  data: {
    promptConfigs: PromptConfigItem[];
    fieldMappingConfigs: MappingConfigItem[];
    inheritance: ConfigInheritance;
  };
  error?: {
    type: string;
    title: string;
    status: number;
    detail: string;
  };
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 載入骨架屏
 */
function ConfigPanelSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

/**
 * 錯誤顯示
 */
function ConfigPanelError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-destructive/10 p-3 mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-sm font-medium mb-1">載入配置失敗</h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm">
        {error.message || '無法獲取配置資訊，請稍後再試。'}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        重試
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * 格式專屬配置面板
 *
 * @description
 *   完整的配置管理面板，包含：
 *   1. 繼承說明 - 顯示配置優先級和當前生效層級
 *   2. Prompt 配置區塊 - 顯示/創建/編輯 Prompt 配置
 *   3. 映射配置區塊 - 顯示/創建/編輯欄位映射配置
 */
export function FormatConfigPanel({ formatId, companyId }: FormatConfigPanelProps) {
  // --- Query ---

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<ConfigsApiResponse>({
    queryKey: ['format-configs', formatId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/formats/${formatId}/configs`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.detail || 'Failed to fetch configs');
      }
      return response.json();
    },
    staleTime: 30 * 1000, // 30 秒內不重新請求
  });

  // --- Loading State ---

  if (isLoading) {
    return <ConfigPanelSkeleton />;
  }

  // --- Error State ---

  if (error) {
    return (
      <ConfigPanelError
        error={error instanceof Error ? error : new Error('Unknown error')}
        onRetry={() => refetch()}
      />
    );
  }

  // --- No Data ---

  if (!data?.success || !data.data) {
    return (
      <ConfigPanelError
        error={new Error('無法獲取配置資料')}
        onRetry={() => refetch()}
      />
    );
  }

  const { promptConfigs, fieldMappingConfigs, inheritance } = data.data;

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* 繼承說明 */}
      <ConfigInheritanceInfo inheritance={inheritance} />

      {/* Prompt 配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt 配置</CardTitle>
          <CardDescription>
            定義 AI 提取和分類時使用的提示詞，格式專屬配置優先於公司和全域配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinkedPromptConfig
            configs={promptConfigs}
            formatId={formatId}
            companyId={companyId}
            effectiveLevel={inheritance.effectivePromptLevel}
          />
        </CardContent>
      </Card>

      {/* 映射配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">欄位映射配置</CardTitle>
          <CardDescription>
            定義欄位轉換規則，將提取的欄位映射到標準格式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinkedMappingConfig
            configs={fieldMappingConfigs}
            formatId={formatId}
            companyId={companyId}
            effectiveLevel={inheritance.effectiveMappingLevel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
