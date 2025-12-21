'use client';

/**
 * @fileoverview 警報儀表板組件
 * @description
 *   整合警報規則管理和歷史記錄的主要儀表板組件。
 *   提供分頁顯示和統計概覽。
 *
 * @module src/components/features/admin/alerts/AlertDashboard
 * @since Epic 12 - Story 12-3 (錯誤警報設定)
 */

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertRuleManagement } from './AlertRuleManagement';
import { AlertHistory } from './AlertHistory';
import { useAlertStatistics } from '@/hooks/useAlerts';
import { Bell, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface StatCardProps {
  title: string;
  value: number;
  description?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

// ============================================================
// Sub-Components
// ============================================================

function StatCard({ title, value, description, icon, variant = 'default' }: StatCardProps) {
  const variants = {
    default: 'text-muted-foreground',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
    success: 'text-green-500',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={variants[variant]}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatisticsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-4 w-4 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-12 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Component
// ============================================================

/**
 * @component AlertDashboard
 * @description 警報管理儀表板主組件
 */
export function AlertDashboard() {
  const { data: stats, isLoading: statsLoading } = useAlertStatistics();

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">警報設定</h1>
        <p className="text-muted-foreground">
          設定系統警報規則並管理警報通知
        </p>
      </div>

      {/* 統計概覽 */}
      {statsLoading ? (
        <StatisticsSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="觸發中警報"
            value={stats?.data.alerts.firingAlerts || 0}
            description="需要立即處理"
            icon={<AlertTriangle className="h-4 w-4" />}
            variant={stats?.data.alerts.firingAlerts && stats.data.alerts.firingAlerts > 0 ? 'danger' : 'default'}
          />
          <StatCard
            title="已確認警報"
            value={stats?.data.alerts.acknowledgedAlerts || 0}
            description="正在處理中"
            icon={<Clock className="h-4 w-4" />}
            variant={stats?.data.alerts.acknowledgedAlerts && stats.data.alerts.acknowledgedAlerts > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="已解決警報"
            value={stats?.data.alerts.resolvedAlerts || 0}
            description="過去 24 小時"
            icon={<CheckCircle className="h-4 w-4" />}
            variant="success"
          />
          <StatCard
            title="活躍規則"
            value={Object.values(stats?.data.rules.bySeverity || {}).reduce((a, b) => a + b, 0)}
            description="正在監控中"
            icon={<Bell className="h-4 w-4" />}
          />
        </div>
      )}

      {/* 分頁內容 */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">規則管理</TabsTrigger>
          <TabsTrigger value="history">警報歷史</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>警報規則</CardTitle>
              <CardDescription>
                設定監控指標和觸發條件，系統將自動發送通知
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertRuleManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>警報歷史</CardTitle>
              <CardDescription>
                查看所有警報記錄，進行確認或解決操作
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertHistory />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
