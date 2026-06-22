'use client';

/**
 * @fileoverview Forwarder Comparison Chart Component
 * @description
 *   貨代商比較圖表組件，支援：
 *   - 文件數量比較（柱狀圖）
 *   - 自動化率比較（柱狀圖）
 *   - 平均處理時間比較（柱狀圖）
 *   - 響應式設計
 *
 * @module src/components/dashboard/ForwarderComparisonChart
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - recharts - 圖表庫
 *   - @/components/ui/card - Card 組件
 *   - @/types/forwarder-filter - Forwarder 類型
 *
 * @related
 *   - src/contexts/DashboardFilterContext.tsx - Filter context
 *   - src/components/dashboard/DashboardFilters.tsx - Parent wrapper
 */

import * as React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ForwarderComparisonData } from '@/types/forwarder-filter';

// ============================================================
// Types
// ============================================================

interface ForwarderComparisonChartProps {
  /** 比較資料 */
  data: ForwarderComparisonData[];
  /** 是否正在載入 */
  isLoading?: boolean;
  /** 自訂 className */
  className?: string;
}

type ChartType = 'volume' | 'automation' | 'time';

// ============================================================
// Constants
// ============================================================

const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  accent: 'hsl(var(--accent))',
  muted: 'hsl(var(--muted))',
  documents: '#3b82f6',    // blue-500
  autoApproved: '#22c55e', // green-500
  reviewRequired: '#eab308', // yellow-500
  processingTime: '#8b5cf6', // violet-500
  confidence: '#06b6d4',   // cyan-500
};

// 圖表分頁的 value 清單（label 透過 i18n 在 render 取得）
const CHART_TAB_VALUES: ChartType[] = ['volume', 'automation', 'time'];

// ============================================================
// Component
// ============================================================

/**
 * ForwarderComparisonChart Component
 * @description 貨代商比較圖表組件
 */
export function ForwarderComparisonChart({
  data,
  isLoading = false,
  className,
}: ForwarderComparisonChartProps) {
  const t = useTranslations('dashboard');
  const [activeTab, setActiveTab] = React.useState<ChartType>('volume');

  // 轉換資料格式
  const chartData = React.useMemo(() => {
    return data.map((item) => ({
      name: item.forwarderCode,
      fullName: item.forwarderName,
      documentCount: item.documentCount,
      autoApprovedCount: item.autoApprovedCount,
      reviewRequiredCount: item.reviewRequiredCount,
      automationRate: item.documentCount > 0
        ? Math.round((item.autoApprovedCount / item.documentCount) * 100)
        : 0,
      averageProcessingTime: Math.round(item.averageProcessingTime),
      averageConfidence: Math.round(item.averageConfidence),
    }));
  }, [data]);

  // 載入狀態
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t('comparison.title')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="text-muted-foreground">{t('comparison.loading')}</div>
        </CardContent>
      </Card>
    );
  }

  // 無資料狀態
  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t('comparison.title')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="text-muted-foreground">
            {t('comparison.selectAtLeastTwo')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t('comparison.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChartType)}>
          <TabsList className="mb-4">
            {CHART_TAB_VALUES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(`comparison.tabs.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 處理量圖表 */}
          <TabsContent value="volume" className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label: _label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3">
                          <p className="font-medium">{data.fullName}</p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p>
                              <span className="text-muted-foreground">
                                {t('comparison.tooltip.totalDocuments')}
                              </span>
                              <span className="font-medium ml-1">{data.documentCount}</span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">
                                {t('comparison.tooltip.autoApproved')}
                              </span>
                              <span className="font-medium ml-1 text-green-500">
                                {data.autoApprovedCount}
                              </span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">
                                {t('comparison.tooltip.reviewRequired')}
                              </span>
                              <span className="font-medium ml-1 text-yellow-500">
                                {data.reviewRequiredCount}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar
                  dataKey="autoApprovedCount"
                  name={t('comparison.legend.autoApproved')}
                  fill={CHART_COLORS.autoApproved}
                  stackId="a"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="reviewRequiredCount"
                  name={t('comparison.legend.reviewRequired')}
                  fill={CHART_COLORS.reviewRequired}
                  stackId="a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* 自動化率圖表 */}
          <TabsContent value="automation" className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3">
                          <p className="font-medium">{data.fullName}</p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p>
                              <span className="text-muted-foreground">
                                {t('comparison.tooltip.automationRate')}
                              </span>
                              <span className="font-medium ml-1">{data.automationRate}%</span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">
                                {t('comparison.tooltip.averageConfidence')}
                              </span>
                              <span className="font-medium ml-1">{data.averageConfidence}%</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar
                  dataKey="automationRate"
                  name={t('comparison.legend.automationRate')}
                  fill={CHART_COLORS.autoApproved}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="averageConfidence"
                  name={t('comparison.legend.averageConfidence')}
                  fill={CHART_COLORS.confidence}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* 處理時間圖表 */}
          <TabsContent value="time" className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(value) => `${value}s`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3">
                          <p className="font-medium">{data.fullName}</p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p>
                              <span className="text-muted-foreground">
                                {t('comparison.tooltip.averageProcessingTime')}
                              </span>
                              <span className="font-medium ml-1">
                                {data.averageProcessingTime} {t('comparison.tooltip.seconds')}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar
                  dataKey="averageProcessingTime"
                  name={t('comparison.legend.averageProcessingTime')}
                  fill={CHART_COLORS.processingTime}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
