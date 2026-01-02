/**
 * @fileoverview Prompt 配置列表組件（按類型分組）
 * @description
 *   顯示 Prompt 配置的分組列表，支援按 promptType 分組。
 *   包含載入狀態、空狀態和錯誤處理。
 *
 * @module src/components/features/prompt-config/PromptConfigList
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-02
 *
 * @features
 *   - 按 promptType 分組顯示
 *   - 配置卡片顯示 scope、公司、格式資訊
 *   - 下拉選單操作（編輯）
 *   - 載入骨架屏和錯誤狀態
 *
 * @dependencies
 *   - @/types/prompt-config - 配置類型定義
 *   - @/components/ui/* - shadcn/ui 組件
 */

'use client';

import * as React from 'react';
import type { PromptConfigListItem } from '@/types/prompt-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Building2,
  Globe,
  Layers,
  Edit,
  MoreVertical,
  CheckCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// 類型定義
// ============================================================================

interface PromptConfigListProps {
  /** 配置列表 */
  configs: PromptConfigListItem[];
  /** 是否載入中 */
  isLoading: boolean;
  /** 錯誤訊息 */
  error?: Error;
  /** 編輯回調 */
  onEdit: (id: string) => void;
  /** 刪除回調 */
  onDelete?: (id: string, name: string) => void;
}

// ============================================================================
// 常數定義
// ============================================================================

const PROMPT_TYPE_LABELS: Record<string, string> = {
  ISSUER_IDENTIFICATION: '發行者識別',
  TERM_CLASSIFICATION: '術語分類',
  FIELD_EXTRACTION: '欄位提取',
  VALIDATION: '結果驗證',
};

const PROMPT_TYPE_ICONS: Record<string, React.ReactNode> = {
  ISSUER_IDENTIFICATION: <Building2 className="h-5 w-5" />,
  TERM_CLASSIFICATION: <FileText className="h-5 w-5" />,
  FIELD_EXTRACTION: <Layers className="h-5 w-5" />,
  VALIDATION: <CheckCircle className="h-5 w-5" />,
};

const SCOPE_COLORS: Record<string, string> = {
  GLOBAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  COMPANY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  FORMAT: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

// ============================================================================
// 主組件
// ============================================================================

export function PromptConfigList({
  configs,
  isLoading,
  error,
  onEdit,
}: PromptConfigListProps) {
  // 按 promptType 分組
  const groupedConfigs = React.useMemo(() => {
    const groups: Record<string, PromptConfigListItem[]> = {};
    for (const config of configs) {
      if (!groups[config.promptType]) {
        groups[config.promptType] = [];
      }
      groups[config.promptType].push(config);
    }
    return groups;
  }, [configs]);

  if (isLoading) {
    return <PromptConfigListSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        載入失敗：{error.message}
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        尚無 Prompt 配置
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedConfigs).map(([promptType, typeConfigs]) => (
        <div key={promptType}>
          {/* 類型標題 */}
          <div className="flex items-center gap-2 mb-4">
            {PROMPT_TYPE_ICONS[promptType] ?? <FileText className="h-5 w-5" />}
            <h2 className="text-lg font-semibold">
              {PROMPT_TYPE_LABELS[promptType] ?? promptType}
            </h2>
            <Badge variant="secondary">{typeConfigs.length}</Badge>
          </div>

          {/* 配置卡片列表 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {typeConfigs.map((config) => (
              <PromptConfigCard
                key={config.id}
                config={config}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 配置卡片組件
// ============================================================================

interface PromptConfigCardProps {
  config: PromptConfigListItem;
  onEdit: (id: string) => void;
}

function PromptConfigCard({ config, onEdit }: PromptConfigCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{config.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={SCOPE_COLORS[config.scope] ?? ''}>
                {config.scope}
              </Badge>
              {!config.isActive && (
                <Badge variant="outline" className="text-muted-foreground">
                  停用
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(config.id)}>
                <Edit className="h-4 w-4 mr-2" />
                編輯
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {config.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {config.description}
          </p>
        )}
        <div className="mt-2 text-xs text-muted-foreground space-y-1">
          {config.companyName && (
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{config.companyName}</span>
            </div>
          )}
          {config.documentFormatName && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="truncate">{config.documentFormatName}</span>
            </div>
          )}
          {config.scope === 'GLOBAL' && !config.companyName && !config.documentFormatName && (
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              全局配置
            </div>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          版本 v{config.version}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 骨架屏組件
// ============================================================================

function PromptConfigListSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((group) => (
        <div key={group}>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-8" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((card) => (
              <Skeleton key={card} className="h-32" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
