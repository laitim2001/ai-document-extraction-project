'use client';

/**
 * @fileoverview 儀表板統計容器組件
 * @description
 *   整合 React Query 和日期範圍篩選器：
 *   - 日期範圍選擇（快速選擇 + 自訂範圍）
 *   - URL 參數同步（書籤/分享）
 *   - 自動刷新（5 分鐘）
 *   - 手動刷新按鈕
 *   - 5 個關鍵指標卡片
 *
 * @module src/components/dashboard/DashboardStats
 * @author Development Team
 * @since Epic 7 - Story 7.1 (Processing Statistics Dashboard)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 時間範圍篩選器（Story 7.2）
 *   - 處理量統計
 *   - 成功率與自動化率
 *   - 平均處理時間
 *   - 待審核數量（含緊急）
 *
 * @dependencies
 *   - @tanstack/react-query - 數據獲取
 *   - date-fns - 時間格式化
 *   - lucide-react - 圖示
 *
 * @related
 *   - src/components/dashboard/StatCard.tsx - 統計卡片
 *   - src/components/dashboard/DateRangePicker.tsx - 日期選擇器
 *   - src/components/dashboard/DateRangeQuickSelect.tsx - 快速選擇
 *   - src/contexts/DateRangeContext.tsx - 日期範圍 Context
 *   - src/app/api/dashboard/statistics/route.ts - 統計 API
 */

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  RefreshCw,
  FileText,
  CheckCircle,
  Zap,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { StatCard } from './StatCard';
import { DateRangePicker } from './DateRangePicker';
import { DateRangeQuickSelectCompact } from './DateRangeQuickSelect';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  useDashboardStatistics,
  useRefreshDashboardStatistics,
} from '@/hooks/useDashboardStatistics';
import { useDateRange } from '@/contexts/DateRangeContext';
import { formatDateRangeDisplay } from '@/lib/date-range-utils';
import { PRESET_LABELS } from '@/types/date-range';

// ============================================================
// Utility Functions
// ============================================================

/**
 * 格式化數字（千分位）
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('zh-TW').format(num);
}

// ============================================================
// Component
// ============================================================

/**
 * 儀表板統計組件
 *
 * @description
 *   顯示 5 個關鍵業務指標卡片：
 *   1. 處理量
 *   2. 成功率
 *   3. 自動化率
 *   4. 平均處理時間
 *   5. 待審核數量
 *
 *   必須包裹在 DateRangeProvider 內使用。
 */
export function DashboardStats() {
  const { dateRange, isLoading: isDateRangeLoading } = useDateRange();
  const { data, isLoading, isError, error, isFetching, dataUpdatedAt } =
    useDashboardStatistics();
  const refreshStatistics = useRefreshDashboardStatistics();

  // 計算顯示標題
  const rangeTitle = React.useMemo(() => {
    if (dateRange.preset && dateRange.preset !== 'custom') {
      return PRESET_LABELS[dateRange.preset];
    }
    return formatDateRangeDisplay(dateRange);
  }, [dateRange]);

  // ============================================================
  // Error State
  // ============================================================

  if (isError && !data) {
    return (
      <div className="space-y-4">
        {/* 日期範圍篩選器 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <DateRangeQuickSelectCompact />
          </div>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            無法載入統計數據：{(error as Error).message}
            <Button
              variant="link"
              size="sm"
              onClick={refreshStatistics}
              className="ml-2"
            >
              重試
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-4">
      {/* 日期範圍篩選器與刷新按鈕 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker disabled={isDateRangeLoading} />
          <DateRangeQuickSelectCompact disabled={isDateRangeLoading} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {dataUpdatedAt && (
            <span>
              最後更新：
              {formatDistanceToNow(dataUpdatedAt, {
                addSuffix: true,
                locale: zhTW,
              })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStatistics}
            disabled={isFetching}
            aria-label="刷新統計數據"
          >
            <RefreshCw
              className={cn('h-4 w-4', isFetching && 'animate-spin')}
            />
          </Button>
        </div>
      </div>

      {/* 統計標題 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">處理統計</h2>
        <span className="text-sm text-muted-foreground">{rangeTitle}</span>
      </div>

      {/* 指標卡片網格 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* 處理量 */}
        <StatCard
          title="處理量"
          value={formatNumber(data?.processingVolume?.thisMonth ?? 0)}
          subtitle={`今日 ${formatNumber(data?.processingVolume?.today ?? 0)}`}
          trend={data?.processingVolume?.trend}
          trendValue={`${data?.processingVolume?.trendPercentage?.toFixed(1) ?? 0}%`}
          icon={<FileText className="h-4 w-4" />}
          loading={isLoading}
        />

        {/* 成功率 */}
        <StatCard
          title="成功率"
          value={`${data?.successRate?.value?.toFixed(1) ?? 0}%`}
          trend={data?.successRate?.trend}
          trendValue={`${data?.successRate?.trendPercentage?.toFixed(1) ?? 0}%`}
          icon={<CheckCircle className="h-4 w-4" />}
          loading={isLoading}
          variant={
            data?.successRate?.value !== undefined
              ? data.successRate.value >= 95
                ? 'success'
                : data.successRate.value < 80
                  ? 'danger'
                  : 'default'
              : 'default'
          }
        />

        {/* 自動化率 */}
        <StatCard
          title="自動化率"
          value={`${data?.automationRate?.value?.toFixed(1) ?? 0}%`}
          trend={data?.automationRate?.trend}
          trendValue={`${data?.automationRate?.trendPercentage?.toFixed(1) ?? 0}%`}
          icon={<Zap className="h-4 w-4" />}
          loading={isLoading}
        />

        {/* 平均處理時間 */}
        <StatCard
          title="平均處理時間"
          value={data?.averageProcessingTime?.formatted ?? '—'}
          trend={data?.averageProcessingTime?.trend}
          trendValue={`${data?.averageProcessingTime?.trendPercentage?.toFixed(1) ?? 0}%`}
          icon={<Clock className="h-4 w-4" />}
          loading={isLoading}
        />

        {/* 待審核 */}
        <StatCard
          title="待審核"
          value={formatNumber(data?.pendingReview?.count ?? 0)}
          subtitle={
            data?.pendingReview?.urgent && data.pendingReview.urgent > 0
              ? `${data.pendingReview.urgent} 緊急`
              : undefined
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={isLoading}
          variant={
            data?.pendingReview?.urgent && data.pendingReview.urgent > 0
              ? 'warning'
              : 'default'
          }
        />
      </div>
    </div>
  );
}
