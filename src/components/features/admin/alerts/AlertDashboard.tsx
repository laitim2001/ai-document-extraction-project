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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('admin');
  const { data: stats, isLoading: statsLoading } = useAlertStatistics();

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('alerts.title')}</h1>
        <p className="text-muted-foreground">
          {t('alerts.description')}
        </p>
      </div>

      {/* 統計概覽 */}
      {statsLoading ? (
        <StatisticsSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('alerts.stats.firing')}
            value={stats?.data.alerts.firingAlerts || 0}
            description={t('alerts.stats.firingDescription')}
            icon={<AlertTriangle className="h-4 w-4" />}
            variant={stats?.data.alerts.firingAlerts && stats.data.alerts.firingAlerts > 0 ? 'danger' : 'default'}
          />
          <StatCard
            title={t('alerts.stats.acknowledged')}
            value={stats?.data.alerts.acknowledgedAlerts || 0}
            description={t('alerts.stats.acknowledgedDescription')}
            icon={<Clock className="h-4 w-4" />}
            variant={stats?.data.alerts.acknowledgedAlerts && stats.data.alerts.acknowledgedAlerts > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title={t('alerts.stats.resolved')}
            value={stats?.data.alerts.resolvedAlerts || 0}
            description={t('alerts.stats.resolvedDescription')}
            icon={<CheckCircle className="h-4 w-4" />}
            variant="success"
          />
          <StatCard
            title={t('alerts.stats.activeRules')}
            value={Object.values(stats?.data.rules.bySeverity || {}).reduce((a, b) => a + b, 0)}
            description={t('alerts.stats.activeRulesDescription')}
            icon={<Bell className="h-4 w-4" />}
          />
        </div>
      )}

      {/* 分頁內容 */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">{t('alerts.tabs.rules')}</TabsTrigger>
          <TabsTrigger value="history">{t('alerts.tabs.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>{t('alerts.rulesCard.title')}</CardTitle>
              <CardDescription>
                {t('alerts.rulesCard.description')}
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
              <CardTitle>{t('alerts.historyCard.title')}</CardTitle>
              <CardDescription>
                {t('alerts.historyCard.description')}
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
