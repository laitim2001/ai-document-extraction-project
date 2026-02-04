/**
 * @fileoverview Prompt 配置列表組件（可折疊分組版）
 * @description
 *   顯示 Prompt 配置的分組列表，支援按 promptType 分組。
 *   包含可折疊分組、顯示更多、全局展開/收起控制。
 *   Full i18n support
 *
 * @module src/components/features/prompt-config/PromptConfigList
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-02-04
 *
 * @features
 *   - 按 promptType 可折疊分組顯示
 *   - 每組預設顯示 6 筆，支援「顯示更多」
 *   - 展開全部 / 收起全部快捷按鈕
 *   - 智能預設展開（前 2 個有配置的分組）
 *   - 載入骨架屏和錯誤狀態
 *
 * @dependencies
 *   - @/types/prompt-config - 配置類型定義
 *   - @/components/ui/* - shadcn/ui 組件
 *   - @/constants/prompt-config-list - 顯示常量
 *
 * @changelog
 *   - CHANGE-028: 新增可折疊分組和顯示更多功能
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { PromptConfigListItem } from '@/types/prompt-config';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PROMPT_CONFIG_LIST,
  PROMPT_TYPE_ORDER,
} from '@/constants/prompt-config-list';
import { CollapsibleControls } from './CollapsibleControls';
import { CollapsiblePromptGroup } from './CollapsiblePromptGroup';

// ============================================================================
// Types
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

interface GroupedConfig {
  promptType: string;
  configs: PromptConfigListItem[];
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 按 PromptType 分組並排序
 */
function useGroupedConfigs(configs: PromptConfigListItem[]): GroupedConfig[] {
  return React.useMemo(() => {
    // 先按 promptType 分組
    const groups: Record<string, PromptConfigListItem[]> = {};
    for (const config of configs) {
      if (!groups[config.promptType]) {
        groups[config.promptType] = [];
      }
      groups[config.promptType].push(config);
    }

    // 轉換為陣列並按預定義順序排序
    const result: GroupedConfig[] = [];

    // 先加入有順序定義的類型
    for (const type of PROMPT_TYPE_ORDER) {
      if (groups[type]) {
        result.push({ promptType: type, configs: groups[type] });
        delete groups[type];
      }
    }

    // 再加入其他未定義順序的類型
    for (const [type, typeConfigs] of Object.entries(groups)) {
      result.push({ promptType: type, configs: typeConfigs });
    }

    return result;
  }, [configs]);
}

/**
 * 計算預設展開的分組
 */
function getDefaultExpandedGroups(groups: GroupedConfig[]): Set<string> {
  const expandedSet = new Set<string>();
  let count = 0;

  for (const group of groups) {
    if (group.configs.length > 0 && count < PROMPT_CONFIG_LIST.DEFAULT_EXPANDED_LIMIT) {
      expandedSet.add(group.promptType);
      count++;
    }
  }

  return expandedSet;
}

// ============================================================================
// Main Component
// ============================================================================

export function PromptConfigList({
  configs,
  isLoading,
  error,
  onEdit,
}: PromptConfigListProps) {
  const t = useTranslations('promptConfig');

  // 分組後的配置
  const groupedConfigs = useGroupedConfigs(configs);

  // 有配置的分組
  const groupsWithConfigs = React.useMemo(
    () => groupedConfigs.filter((g) => g.configs.length > 0),
    [groupedConfigs]
  );

  // 展開狀態管理
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(() =>
    getDefaultExpandedGroups(groupedConfigs)
  );

  // 每組顯示數量管理
  const [displayCounts, setDisplayCounts] = React.useState<Record<string, number>>({});

  // 當 configs 變化時，重置展開狀態
  React.useEffect(() => {
    setExpandedGroups(getDefaultExpandedGroups(groupedConfigs));
  }, [groupedConfigs]);

  // 切換單個分組展開狀態
  const toggleGroup = React.useCallback((promptType: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(promptType)) {
        next.delete(promptType);
      } else {
        next.add(promptType);
      }
      return next;
    });
  }, []);

  // 展開全部
  const expandAll = React.useCallback(() => {
    const allTypes = new Set(groupsWithConfigs.map((g) => g.promptType));
    setExpandedGroups(allTypes);
  }, [groupsWithConfigs]);

  // 收起全部
  const collapseAll = React.useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  // 獲取某組的當前顯示數量
  const getDisplayCount = React.useCallback(
    (promptType: string): number => {
      return displayCounts[promptType] || PROMPT_CONFIG_LIST.INITIAL_DISPLAY_COUNT;
    },
    [displayCounts]
  );

  // 顯示更多
  const showMore = React.useCallback((promptType: string) => {
    setDisplayCounts((prev) => ({
      ...prev,
      [promptType]:
        (prev[promptType] || PROMPT_CONFIG_LIST.INITIAL_DISPLAY_COUNT) +
        PROMPT_CONFIG_LIST.LOAD_MORE_INCREMENT,
    }));
  }, []);

  // --- Render ---

  if (isLoading) {
    return <PromptConfigListSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        {t('list.loadError', { error: error.message })}
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('list.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 全局控制按鈕 */}
      <div className="flex justify-end mb-4">
        <CollapsibleControls
          totalGroups={groupsWithConfigs.length}
          expandedCount={expandedGroups.size}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
      </div>

      {/* 可折疊分組列表 */}
      <div className="space-y-2">
        {groupedConfigs.map(({ promptType, configs: typeConfigs }) => (
          <div
            key={promptType}
            className="border rounded-lg bg-card"
          >
            <CollapsiblePromptGroup
              promptType={promptType}
              configs={typeConfigs}
              isExpanded={expandedGroups.has(promptType)}
              onToggle={() => toggleGroup(promptType)}
              displayCount={getDisplayCount(promptType)}
              onShowMore={() => showMore(promptType)}
              onEdit={onEdit}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

function PromptConfigListSkeleton() {
  return (
    <div className="space-y-2">
      {/* 控制按鈕骨架 */}
      <div className="flex justify-end mb-4 gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>

      {/* 分組骨架 */}
      {[1, 2, 3].map((group) => (
        <div key={group} className="border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-8" />
          </div>
        </div>
      ))}
    </div>
  );
}
