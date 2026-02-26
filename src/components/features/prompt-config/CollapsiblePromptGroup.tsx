/**
 * @fileoverview 可折疊 Prompt 類型分組組件
 * @description
 *   將同一 PromptType 的配置包裝在可折疊區塊中，
 *   支援展開/收起、顯示更多功能。
 *
 * @module src/components/features/prompt-config/CollapsiblePromptGroup
 * @since CHANGE-028 - Prompt Config 列表可折疊分組
 * @lastModified 2026-02-04
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, FileText, Building2, Layers, CheckCircle, Inbox } from 'lucide-react';
import type { PromptConfigListItem } from '@/types/prompt-config';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, MoreVertical, Edit } from 'lucide-react';
import { ShowMoreButton } from './ShowMoreButton';

// ============================================================================
// Types
// ============================================================================

interface CollapsiblePromptGroupProps {
  /** Prompt Type */
  promptType: string;
  /** 該類型的配置列表 */
  configs: PromptConfigListItem[];
  /** 是否展開 */
  isExpanded: boolean;
  /** 切換展開回調 */
  onToggle: () => void;
  /** 當前顯示數量 */
  displayCount: number;
  /** 顯示更多回調 */
  onShowMore: () => void;
  /** 編輯配置回調 */
  onEdit: (id: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PROMPT_TYPE_ICONS: Record<string, React.ReactNode> = {
  ISSUER_IDENTIFICATION: <Building2 className="h-5 w-5" />,
  TERM_CLASSIFICATION: <FileText className="h-5 w-5" />,
  FIELD_EXTRACTION: <Layers className="h-5 w-5" />,
  VALIDATION: <CheckCircle className="h-5 w-5" />,
  STAGE_1_COMPANY_IDENTIFICATION: <Building2 className="h-5 w-5" />,
  STAGE_2_FORMAT_IDENTIFICATION: <FileText className="h-5 w-5" />,
  STAGE_3_FIELD_EXTRACTION: <Layers className="h-5 w-5" />,
};

const SCOPE_COLORS: Record<string, string> = {
  GLOBAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  COMPANY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  FORMAT: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

// ============================================================================
// Component
// ============================================================================

/**
 * 可折疊 Prompt 類型分組組件
 *
 * @description 將同一類型的配置卡片包裝在可折疊區塊中
 */
export function CollapsiblePromptGroup({
  promptType,
  configs,
  isExpanded,
  onToggle,
  displayCount,
  onShowMore,
  onEdit,
}: CollapsiblePromptGroupProps) {
  const t = useTranslations('promptConfig');

  // 計算顯示的配置和剩餘數量
  const visibleConfigs = configs.slice(0, displayCount);
  const remainingCount = configs.length - displayCount;
  const hasMore = remainingCount > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      {/* 分組標題（可點擊展開/收起） */}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-between w-full p-4 rounded-lg transition-colors',
            'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            isExpanded && 'bg-muted/30'
          )}
        >
          <div className="flex items-center gap-3">
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
            />
            {PROMPT_TYPE_ICONS[promptType] ?? <FileText className="h-5 w-5" />}
            <span className="font-medium text-base">
              {t(`types.${promptType}`)}
            </span>
            <Badge variant="secondary" className="ml-1">
              {configs.length}
            </Badge>
          </div>
        </button>
      </CollapsibleTrigger>

      {/* 分組內容 */}
      <CollapsibleContent className="px-4 pb-4">
        {configs.length === 0 ? (
          /* 空狀態 */
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
            <Inbox className="h-8 w-8 mb-2" />
            <span className="text-sm">{t('collapsible.emptyGroup')}</span>
          </div>
        ) : (
          <>
            {/* 配置卡片網格 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-2">
              {visibleConfigs.map((config) => (
                <PromptConfigCard
                  key={config.id}
                  config={config}
                  onEdit={onEdit}
                  t={t}
                />
              ))}
            </div>

            {/* 顯示更多按鈕 */}
            {hasMore && (
              <ShowMoreButton
                remainingCount={remainingCount}
                onClick={onShowMore}
              />
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// 配置卡片組件（內部使用）
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TranslationFunction = ReturnType<typeof import('next-intl').useTranslations<any>>;

interface PromptConfigCardProps {
  config: PromptConfigListItem;
  onEdit: (id: string) => void;
  t: TranslationFunction;
}

function PromptConfigCard({ config, onEdit, t }: PromptConfigCardProps) {
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
                  {t('list.disabled')}
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
                {t('list.edit')}
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
              {t('list.globalConfig')}
            </div>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {t('list.version', { version: config.version })}
        </div>
      </CardContent>
    </Card>
  );
}
