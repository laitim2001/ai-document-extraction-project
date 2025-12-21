/**
 * @fileoverview Performance Dashboard Component
 * @description
 *   效能監控儀表板組件，包含：
 *   - 效能概覽卡片（API/DB/AI/System）
 *   - 時間序列圖表（Recharts）
 *   - 最慢端點表格
 *   - 時間範圍選擇
 *   - 自動刷新功能
 *   - CSV 匯出功能
 *
 * @module src/components/admin/performance/PerformanceDashboard
 * @since Epic 12 - Story 12-2
 * @lastModified 2025-12-21
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, RefreshCw, Activity, Database, Cpu, HardDrive } from 'lucide-react';
import { usePerformanceDashboard } from '@/hooks/use-performance';
import type {
  TimeRange,
  MetricType,
  MetricStatus,
  TimeSeriesDataPoint,
  SlowestEndpoint,
} from '@/types/performance';
import {
  TIME_RANGE_LABELS,
  DEFAULT_THRESHOLDS,
  getMetricStatus,
  formatMs,
  formatPercent,
} from '@/types/performance';

// ============================================================
// Types
// ============================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: MetricStatus;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

interface PerformanceChartProps {
  data: TimeSeriesDataPoint[];
  title: string;
  color: string;
  unit: string;
  thresholds?: {
    warning: number;
    critical: number;
  };
  isLoading?: boolean;
}

interface SlowestEndpointsTableProps {
  endpoints: SlowestEndpoint[];
  isLoading?: boolean;
}

// ============================================================
// Time Range Options
// ============================================================

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1h', label: TIME_RANGE_LABELS['1h'] },
  { value: '6h', label: TIME_RANGE_LABELS['6h'] },
  { value: '24h', label: TIME_RANGE_LABELS['24h'] },
  { value: '7d', label: TIME_RANGE_LABELS['7d'] },
  { value: '30d', label: TIME_RANGE_LABELS['30d'] },
];

// ============================================================
// Metric Card Component
// ============================================================

function MetricCard({
  title,
  value,
  unit,
  subtitle,
  trend,
  status = 'normal',
  icon,
  isLoading,
}: MetricCardProps) {
  const statusClasses = {
    normal: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    critical: 'border-red-200 bg-red-50',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
  };

  const trendColors = {
    up: 'text-red-500',
    down: 'text-green-500',
    stable: 'text-gray-500',
  };

  if (isLoading) {
    return (
      <Card className="border">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border ${statusClasses[status]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">{title}</span>
          {icon && <span className="text-gray-500">{icon}</span>}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value}</span>
          {unit && <span className="text-sm text-gray-500">{unit}</span>}
          {trend && (
            <span className={`ml-2 text-sm ${trendColors[trend]}`}>
              {trendIcons[trend]}
            </span>
          )}
        </div>
        {subtitle && (
          <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Performance Chart Component
// ============================================================

function PerformanceChart({
  data,
  title,
  color,
  unit,
  thresholds,
  isLoading,
}: PerformanceChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient
                id={`gradient-${color.replace('#', '')}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
              tickFormatter={(v) => `${v}${unit}`}
            />
            <Tooltip
              labelFormatter={(label) => new Date(label as string).toLocaleString('zh-TW')}
              formatter={(value) => [
                `${(value as number).toFixed(2)}${unit}`,
                '數值',
              ]}
            />
            {thresholds && (
              <>
                <ReferenceLine
                  y={thresholds.warning}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  label={{
                    value: '警告',
                    fill: '#f59e0b',
                    fontSize: 10,
                  }}
                />
                <ReferenceLine
                  y={thresholds.critical}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{
                    value: '嚴重',
                    fill: '#ef4444',
                    fontSize: 10,
                  }}
                />
              </>
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#gradient-${color.replace('#', '')})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Slowest Endpoints Table Component
// ============================================================

function SlowestEndpointsTable({
  endpoints,
  isLoading,
}: SlowestEndpointsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">最慢的 API 端點</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMethodBadgeVariant = (method: string) => {
    switch (method) {
      case 'GET':
        return 'default';
      case 'POST':
        return 'secondary';
      case 'PUT':
        return 'outline';
      case 'DELETE':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    const icons = { up: '↑', down: '↓', stable: '→' };
    const colors = {
      up: 'text-red-500',
      down: 'text-green-500',
      stable: 'text-gray-500',
    };
    return <span className={colors[trend]}>{icons[trend]}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">最慢的 API 端點</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>端點</TableHead>
              <TableHead className="text-right">平均</TableHead>
              <TableHead className="text-right">P95</TableHead>
              <TableHead className="text-right">請求數</TableHead>
              <TableHead className="text-right">錯誤率</TableHead>
              <TableHead className="text-center">趨勢</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpoints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  暫無數據
                </TableCell>
              </TableRow>
            ) : (
              endpoints.map((ep, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={getMethodBadgeVariant(ep.method)}>
                        {ep.method}
                      </Badge>
                      <span className="font-mono text-sm truncate max-w-[200px]">
                        {ep.endpoint}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        ep.avgResponseTime > 500
                          ? 'text-red-600 font-medium'
                          : ''
                      }
                    >
                      {formatMs(ep.avgResponseTime)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMs(ep.p95ResponseTime)}
                  </TableCell>
                  <TableCell className="text-right">
                    {ep.count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        ep.errorRate > 5 ? 'text-red-600 font-medium' : ''
                      }
                    >
                      {formatPercent(ep.errorRate)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getTrendIcon(ep.trend)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Dashboard Component
// ============================================================

export function PerformanceDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    overview,
    apiTimeSeries,
    cpuTimeSeries,
    memoryTimeSeries,
    slowestEndpoints,
    isLoading,
    refetchAll,
    exportData,
    isExporting,
  } = usePerformanceDashboard(timeRange, undefined, autoRefresh);

  // 判斷閾值狀態
  const getApiStatus = useCallback((): MetricStatus => {
    if (!overview) return 'normal';
    return getMetricStatus(overview.api.p95, DEFAULT_THRESHOLDS.api_response_time);
  }, [overview]);

  const getCpuStatus = useCallback((): MetricStatus => {
    if (!overview) return 'normal';
    return getMetricStatus(overview.system.cpuCurrent, DEFAULT_THRESHOLDS.cpu_usage);
  }, [overview]);

  const getMemoryStatus = useCallback((): MetricStatus => {
    if (!overview) return 'normal';
    return getMetricStatus(
      overview.system.memoryCurrent,
      DEFAULT_THRESHOLDS.memory_usage
    );
  }, [overview]);

  // 處理匯出
  const handleExport = useCallback(
    (metric: MetricType) => {
      exportData({ metric, timeRange, format: 'csv' });
    },
    [exportData, timeRange]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">效能監控</h1>
          <p className="text-sm text-gray-500 mt-1">
            監控系統效能指標和資源使用情況
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* 時間範圍選擇 */}
          <Select
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as TimeRange)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="選擇時間範圍" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 自動刷新開關 */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="autoRefresh"
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(checked as boolean)}
            />
            <label
              htmlFor="autoRefresh"
              className="text-sm text-gray-600 cursor-pointer"
            >
              自動刷新
            </label>
          </div>

          {/* 匯出按鈕 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('api_response_time')}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-1" />
            匯出 CSV
          </Button>

          {/* 手動刷新 */}
          <Button variant="outline" size="sm" onClick={refetchAll}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="API 回應時間 (P95)"
          value={overview?.api.p95 || 0}
          unit="ms"
          subtitle={`平均: ${overview?.api.avg || 0}ms`}
          status={getApiStatus()}
          icon={<Activity className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="API 請求數"
          value={(overview?.api.count || 0).toLocaleString()}
          subtitle={`錯誤率: ${formatPercent(overview?.api.errorRate || 0)}`}
          status={
            overview && overview.api.errorRate > 5 ? 'warning' : 'normal'
          }
          icon={<Activity className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="數據庫查詢 (P95)"
          value={overview?.database.p95 || 0}
          unit="ms"
          subtitle={`平均: ${overview?.database.avg || 0}ms`}
          icon={<Database className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="AI 處理時間 (P95)"
          value={overview?.ai.p95 || 0}
          unit="ms"
          subtitle={`成功率: ${formatPercent(overview?.ai.successRate || 100)}`}
          icon={<Cpu className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="CPU 使用率"
          value={overview?.system.cpuCurrent.toFixed(1) || 0}
          unit="%"
          subtitle={`平均: ${overview?.system.cpuAvg.toFixed(1) || 0}%`}
          status={getCpuStatus()}
          icon={<Cpu className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="記憶體使用率"
          value={overview?.system.memoryCurrent.toFixed(1) || 0}
          unit="%"
          subtitle={`平均: ${overview?.system.memoryAvg.toFixed(1) || 0}%`}
          status={getMemoryStatus()}
          icon={<HardDrive className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceChart
          data={apiTimeSeries?.data || []}
          title="API 回應時間趨勢"
          color="#3b82f6"
          unit="ms"
          thresholds={apiTimeSeries?.thresholds || DEFAULT_THRESHOLDS.api_response_time}
          isLoading={isLoading}
        />
        <PerformanceChart
          data={cpuTimeSeries?.data || []}
          title="CPU 使用率趨勢"
          color="#10b981"
          unit="%"
          thresholds={cpuTimeSeries?.thresholds || DEFAULT_THRESHOLDS.cpu_usage}
          isLoading={isLoading}
        />
      </div>

      {/* Memory Chart */}
      <PerformanceChart
        data={memoryTimeSeries?.data || []}
        title="記憶體使用率趨勢"
        color="#8b5cf6"
        unit="%"
        thresholds={memoryTimeSeries?.thresholds || DEFAULT_THRESHOLDS.memory_usage}
        isLoading={isLoading}
      />

      {/* Slowest Endpoints */}
      <SlowestEndpointsTable
        endpoints={slowestEndpoints || []}
        isLoading={isLoading}
      />
    </div>
  );
}

export default PerformanceDashboard;
