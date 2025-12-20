/**
 * @fileoverview 變更歷史時間線組件
 * @description
 *   顯示資源的變更歷史時間線，支援：
 *   - 時間線展示變更記錄
 *   - 版本點擊查看詳情
 *   - 版本選擇進行比較
 *   - 載入更多歷史記錄
 *
 * @module src/components/features/history/ChangeHistoryTimeline
 * @since Epic 8 - Story 8.2 (數據變更追蹤)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @/components/ui - shadcn/ui 組件
 *   - @/types/change-tracking - 變更追蹤類型
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronDown,
  GitCompare,
  Clock,
  User,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type {
  TimelineItem,
  HistoryChangeType,
  TrackedModel,
} from '@/types/change-tracking';

// ============================================================
// Types
// ============================================================

interface ChangeHistoryTimelineProps {
  /** 資源類型 */
  resourceType: TrackedModel;
  /** 資源 ID */
  resourceId: string;
  /** 時間線項目 */
  items: TimelineItem[];
  /** 是否正在載入 */
  isLoading?: boolean;
  /** 是否有更多數據 */
  hasMore?: boolean;
  /** 載入更多回調 */
  onLoadMore?: () => void;
  /** 點擊版本回調 */
  onVersionClick?: (version: number) => void;
  /** 比較版本回調 */
  onCompareVersions?: (fromVersion: number, toVersion: number) => void;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取變更類型圖標
 */
function getChangeTypeIcon(changeType: HistoryChangeType) {
  switch (changeType) {
    case 'CREATE':
      return <Plus className="h-4 w-4" />;
    case 'UPDATE':
      return <Pencil className="h-4 w-4" />;
    case 'DELETE':
      return <Trash2 className="h-4 w-4" />;
    case 'RESTORE':
      return <RotateCcw className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

/**
 * 獲取變更類型顏色
 */
function getChangeTypeColor(changeType: HistoryChangeType) {
  switch (changeType) {
    case 'CREATE':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'DELETE':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    case 'RESTORE':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
  }
}

/**
 * 獲取變更類型中文名稱
 */
function getChangeTypeLabel(changeType: HistoryChangeType) {
  switch (changeType) {
    case 'CREATE':
      return '建立';
    case 'UPDATE':
      return '更新';
    case 'DELETE':
      return '刪除';
    case 'RESTORE':
      return '還原';
    default:
      return changeType;
  }
}

/**
 * 獲取時間線連接線顏色
 */
function getTimelineLineColor(changeType: HistoryChangeType) {
  switch (changeType) {
    case 'CREATE':
      return 'bg-green-500';
    case 'UPDATE':
      return 'bg-blue-500';
    case 'DELETE':
      return 'bg-red-500';
    case 'RESTORE':
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
  }
}

// ============================================================
// Sub Components
// ============================================================

/**
 * 時間線項目骨架
 */
function TimelineItemSkeleton() {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-16 w-0.5 mt-2" />
      </div>
      <div className="flex-1 pb-8">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}

/**
 * 時間線項目組件
 */
function TimelineItemComponent({
  item,
  isLast,
  isSelected,
  onSelect,
  onClick,
}: {
  item: TimelineItem;
  isLast: boolean;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onClick: () => void;
}) {
  const iconColor = getChangeTypeColor(item.changeType);
  const lineColor = getTimelineLineColor(item.changeType);

  return (
    <div className="flex gap-4 group">
      {/* 時間線左側 */}
      <div className="flex flex-col items-center">
        {/* 變更類型圖標 */}
        <div
          className={`flex items-center justify-center h-8 w-8 rounded-full ${iconColor} transition-transform group-hover:scale-110`}
        >
          {getChangeTypeIcon(item.changeType)}
        </div>
        {/* 連接線 */}
        {!isLast && <div className={`h-full w-0.5 mt-2 ${lineColor} opacity-30`} />}
      </div>

      {/* 內容區 */}
      <div className="flex-1 pb-8 min-w-0">
        <div
          className="bg-muted/50 rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted"
          onClick={onClick}
        >
          {/* 標題行 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant={item.isCurrent ? 'default' : 'outline'}>
                版本 {item.version}
              </Badge>
              <Badge variant="secondary" className={iconColor}>
                {getChangeTypeLabel(item.changeType)}
              </Badge>
              {item.isCurrent && (
                <Badge variant="default" className="bg-primary">
                  目前版本
                </Badge>
              )}
            </div>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              aria-label={`選擇版本 ${item.version} 進行比較`}
            />
          </div>

          {/* 變更資訊 */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>{item.changedByName}</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {formatDistanceToNow(new Date(item.timestamp), {
                        addSuffix: true,
                        locale: zhTW,
                      })}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {format(new Date(item.timestamp), 'yyyy/MM/dd HH:mm:ss', {
                    locale: zhTW,
                  })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* 變更原因 */}
          {item.changeReason && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.changeReason}
            </p>
          )}

          {/* 變更欄位數 */}
          {item.changedFieldCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              變更了 {item.changedFieldCount} 個欄位
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

/**
 * 變更歷史時間線
 *
 * @description
 *   以時間線形式展示資源的變更歷史。
 *   支援版本選擇進行比較，點擊查看版本詳情。
 *
 * @example
 * ```tsx
 * <ChangeHistoryTimeline
 *   resourceType="mappingRule"
 *   resourceId="rule-123"
 *   items={timelineItems}
 *   hasMore={hasNextPage}
 *   onLoadMore={fetchNextPage}
 *   onVersionClick={(version) => console.log('View version', version)}
 *   onCompareVersions={(from, to) => console.log('Compare', from, to)}
 * />
 * ```
 */
export function ChangeHistoryTimeline({
  resourceType: _resourceType,
  resourceId: _resourceId,
  items,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onVersionClick,
  onCompareVersions,
}: ChangeHistoryTimelineProps) {
  // Note: resourceType and resourceId can be used for future features like
  // deep-linking or analytics tracking
  void _resourceType;
  void _resourceId;
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  /**
   * 處理版本選擇
   */
  const handleVersionSelect = (version: number, checked: boolean) => {
    if (checked) {
      if (selectedVersions.length < 2) {
        setSelectedVersions([...selectedVersions, version]);
      } else {
        // 最多選兩個，替換最早選的
        setSelectedVersions([selectedVersions[1], version]);
      }
    } else {
      setSelectedVersions(selectedVersions.filter((v) => v !== version));
    }
  };

  /**
   * 處理比較按鈕點擊
   */
  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      onCompareVersions?.(v1, v2);
    }
  };

  /**
   * 清除選擇
   */
  const handleClearSelection = () => {
    setSelectedVersions([]);
  };

  // 空狀態
  if (!isLoading && items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">暫無變更歷史記錄</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">變更歷史</CardTitle>
          {selectedVersions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                已選擇 {selectedVersions.length} 個版本
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
              >
                清除
              </Button>
              <Button
                size="sm"
                disabled={selectedVersions.length !== 2}
                onClick={handleCompare}
              >
                <GitCompare className="mr-2 h-4 w-4" />
                比較版本
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {/* 時間線 */}
          <div className="space-y-0">
            {items.map((item, index) => (
              <TimelineItemComponent
                key={item.id}
                item={item}
                isLast={index === items.length - 1 && !hasMore}
                isSelected={selectedVersions.includes(item.version)}
                onSelect={(checked) => handleVersionSelect(item.version, checked)}
                onClick={() => onVersionClick?.(item.version)}
              />
            ))}

            {/* 載入中骨架 */}
            {isLoading && (
              <>
                <TimelineItemSkeleton />
                <TimelineItemSkeleton />
              </>
            )}
          </div>

          {/* 載入更多按鈕 */}
          {hasMore && !isLoading && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={onLoadMore}>
                <ChevronDown className="mr-2 h-4 w-4" />
                載入更多
              </Button>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
