'use client';

/**
 * @fileoverview 系統健康監控儀表板
 * @description
 *   整合系統健康監控的所有功能，包括：
 *   - 系統整體健康狀態顯示
 *   - 各服務健康狀態卡片
 *   - 服務詳情面板（回應時間圖表、效能指標、錯誤日誌）
 *   - 手動健康檢查觸發
 *   - 即時狀態更新
 *
 * @module src/components/features/admin/monitoring/HealthDashboard
 * @author Development Team
 * @since Epic 12 - Story 12.1 (System Health Monitoring Dashboard)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 整體系統狀態指示器
 *   - 服務狀態卡片網格
 *   - 24 小時可用性統計
 *   - 活躍用戶計數
 *   - 服務回應時間歷史圖表
 *   - 錯誤日誌展示
 *
 * @dependencies
 *   - Card, Badge, Button - shadcn/ui 組件
 *   - recharts - 圖表庫
 *   - lucide-react - 圖標
 *   - useToast - Toast 通知
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Server,
  Database,
  Cloud,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  Activity,
  HardDrive,
  Workflow,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { HealthStatus, ServiceType } from '@prisma/client';
import { STATUS_COLORS, STATUS_LABELS } from '@/types/monitoring';

// ============================================================
// Types
// ============================================================

/**
 * 服務健康狀態結果
 */
interface ServiceHealthResult {
  serviceName: string;
  serviceType: ServiceType;
  status: HealthStatus;
  statusText: string;
  responseTime: number | null;
  errorMessage: string | null;
  details: Record<string, unknown> | null;
  checkedAt: string;
}

/**
 * 系統整體健康狀態
 */
interface OverallHealthStatus {
  status: HealthStatus;
  statusText: string;
  services: ServiceHealthResult[];
  activeUsers: number;
  availability24h: number;
  lastUpdated: string;
}

/**
 * 服務歷史記錄
 */
interface ServiceHistoryItem {
  checkedAt: string;
  status: HealthStatus;
  statusText: string;
  responseTime: number | null;
}

/**
 * 錯誤日誌
 */
interface ErrorLog {
  checkedAt: string;
  errorMessage: string | null;
  errorCode: string | null;
}

/**
 * 效能指標
 */
interface ServiceMetrics {
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  errorRate: number;
}

/**
 * 服務詳情
 */
interface ServiceHealthDetails {
  service: ServiceHealthResult | null;
  history: ServiceHistoryItem[];
  errorLogs: ErrorLog[];
  metrics: ServiceMetrics;
}

// ============================================================
// Constants
// ============================================================

/**
 * 服務圖標映射
 */
const SERVICE_ICONS: Record<string, React.ReactNode> = {
  web: <Server size={24} />,
  ai: <Cpu size={24} />,
  database: <Database size={24} />,
  storage: <Cloud size={24} />,
  n8n: <Workflow size={24} />,
  cache: <HardDrive size={24} />,
};

/**
 * 狀態徽章配置
 */
const STATUS_BADGE_CONFIG: Record<
  HealthStatus,
  { className: string; icon: React.ReactNode }
> = {
  HEALTHY: {
    className: 'bg-green-500 text-white border-transparent',
    icon: <CheckCircle size={14} />,
  },
  DEGRADED: {
    className: 'bg-yellow-500 text-white border-transparent',
    icon: <AlertTriangle size={14} />,
  },
  UNHEALTHY: {
    className: 'bg-red-500 text-white border-transparent',
    icon: <XCircle size={14} />,
  },
  UNKNOWN: {
    className: 'bg-gray-500 text-white border-transparent',
    icon: <AlertTriangle size={14} />,
  },
  UNCONFIGURED: {
    className: 'bg-gray-400 text-white border-transparent',
    icon: <AlertTriangle size={14} />,
  },
};

// ============================================================
// Component
// ============================================================

/**
 * 健康監控儀表板
 *
 * @description
 *   顯示系統整體健康狀態和各服務的詳細狀態。
 *   支援手動觸發健康檢查和查看服務歷史記錄。
 */
export function HealthDashboard() {
  // --- State ---
  const [health, setHealth] = useState<OverallHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [serviceDetails, setServiceDetails] =
    useState<ServiceHealthDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const { toast } = useToast();

  // --- Callbacks ---

  /**
   * 載入健康狀態
   */
  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/health');
      const data = await response.json();
      if (data.success && data.data) {
        setHealth(data.data);
      } else {
        throw new Error(data.detail || '載入失敗');
      }
    } catch {
      toast({
        title: '錯誤',
        description: '載入健康狀態失敗',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * 手動刷新健康狀態
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/admin/health', { method: 'POST' });
      await loadHealth();
      toast({
        title: '成功',
        description: '健康檢查完成',
      });
    } catch {
      toast({
        title: '錯誤',
        description: '健康檢查失敗',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * 載入服務詳情
   */
  const loadServiceDetails = useCallback(
    async (serviceName: string) => {
      setDetailsLoading(true);
      try {
        const response = await fetch(
          `/api/admin/health/${serviceName}?hours=24`
        );
        const data = await response.json();
        if (data.success && data.data) {
          setServiceDetails(data.data);
        } else {
          throw new Error(data.detail || '載入失敗');
        }
      } catch {
        toast({
          title: '錯誤',
          description: '載入服務詳情失敗',
          variant: 'destructive',
        });
      } finally {
        setDetailsLoading(false);
      }
    },
    [toast]
  );

  // --- Effects ---

  // 初始載入
  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // 自動刷新（每 30 秒）
  useEffect(() => {
    const interval = setInterval(() => {
      loadHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadHealth]);

  // 當選擇服務時載入詳情
  useEffect(() => {
    if (selectedService) {
      loadServiceDetails(selectedService);
    } else {
      setServiceDetails(null);
    }
  }, [selectedService, loadServiceDetails]);

  // --- Render ---

  if (loading && !health) {
    return <HealthDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* 頂部狀態欄 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-4">
          <div
            className={`w-4 h-4 rounded-full ${
              STATUS_COLORS[health?.status || 'UNKNOWN']
            }`}
          />
          <h2 className="text-2xl font-bold">
            系統健康狀態: {STATUS_LABELS[health?.status || 'UNKNOWN']}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users size={20} />
            <span>{health?.activeUsers || 0} 活躍用戶</span>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="w-4 h-4" />
            {health?.availability24h?.toFixed(2)}% 可用性 (24h)
          </Badge>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              size={16}
              className={`mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            刷新
          </Button>
        </div>
      </div>

      {/* 服務狀態卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health?.services.map((service) => (
          <ServiceCard
            key={service.serviceName}
            service={service}
            isSelected={selectedService === service.serviceName}
            onClick={() =>
              setSelectedService(
                selectedService === service.serviceName
                  ? null
                  : service.serviceName
              )
            }
          />
        ))}
      </div>

      {/* 服務詳情面板 */}
      {selectedService && (
        <ServiceDetailsPanel
          serviceName={selectedService}
          details={serviceDetails}
          loading={detailsLoading}
        />
      )}

      {/* 最後更新時間 */}
      <div className="text-sm text-muted-foreground text-center">
        最後更新:{' '}
        {health?.lastUpdated
          ? new Date(health.lastUpdated).toLocaleString('zh-TW')
          : 'N/A'}
      </div>
    </div>
  );
}

// ============================================================
// Sub-Components
// ============================================================

/**
 * 服務狀態卡片
 */
interface ServiceCardProps {
  service: ServiceHealthResult;
  isSelected: boolean;
  onClick: () => void;
}

function ServiceCard({ service, isSelected, onClick }: ServiceCardProps) {
  const badgeConfig = STATUS_BADGE_CONFIG[service.status];

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          {SERVICE_ICONS[service.serviceName.toLowerCase()] || (
            <Server size={24} />
          )}
          <span className="font-medium capitalize">{service.serviceName}</span>
        </div>
        <Badge className={`flex items-center gap-1 ${badgeConfig.className}`}>
          {badgeConfig.icon}
          <span className="ml-1">{service.statusText}</span>
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {service.responseTime !== null && (
            <div className="text-sm text-muted-foreground">
              回應時間: {service.responseTime}ms
            </div>
          )}
          {service.errorMessage && (
            <div className="text-sm text-destructive truncate">
              {service.errorMessage}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            最後檢查: {new Date(service.checkedAt).toLocaleTimeString('zh-TW')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 服務詳情面板
 */
interface ServiceDetailsPanelProps {
  serviceName: string;
  details: ServiceHealthDetails | null;
  loading: boolean;
}

function ServiceDetailsPanel({
  serviceName,
  details,
  loading,
}: ServiceDetailsPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[200px]" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!details) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{serviceName} 服務詳情</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 回應時間圖表 */}
          <div>
            <h4 className="font-medium mb-4">回應時間 (24h)</h4>
            {details.history.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={details.history}>
                  <XAxis
                    dataKey="checkedAt"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleTimeString('zh-TW', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(value) =>
                      new Date(value as string).toLocaleString('zh-TW')
                    }
                    formatter={(value) => [
                      `${value ?? 0}ms`,
                      '回應時間',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="responseTime"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                暫無歷史資料
              </div>
            )}
          </div>

          {/* 統計指標 */}
          <div>
            <h4 className="font-medium mb-4">效能指標</h4>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                label="平均回應"
                value={`${details.metrics.avgResponseTime.toFixed(0)}ms`}
              />
              <MetricCard
                label="最大回應"
                value={`${details.metrics.maxResponseTime}ms`}
              />
              <MetricCard
                label="最小回應"
                value={`${details.metrics.minResponseTime}ms`}
              />
              <MetricCard
                label="錯誤率"
                value={`${details.metrics.errorRate.toFixed(2)}%`}
                isError={details.metrics.errorRate > 5}
              />
            </div>
          </div>
        </div>

        {/* 錯誤日誌 */}
        {details.errorLogs.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium mb-4">最近錯誤</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {details.errorLogs.map((log, index) => (
                <div
                  key={index}
                  className="bg-destructive/10 p-3 rounded-lg text-sm"
                >
                  <div className="flex justify-between">
                    <span className="text-destructive font-medium">
                      {log.errorCode || 'Error'}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(log.checkedAt).toLocaleString('zh-TW')}
                    </span>
                  </div>
                  <div className="text-foreground mt-1">
                    {log.errorMessage || '未知錯誤'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 指標卡片
 */
interface MetricCardProps {
  label: string;
  value: string;
  isError?: boolean;
}

function MetricCard({ label, value, isError }: MetricCardProps) {
  return (
    <div className="bg-muted p-4 rounded-lg">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        className={`text-2xl font-bold ${isError ? 'text-destructive' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * 載入中骨架屏
 */
function HealthDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 頂部狀態欄骨架 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Skeleton className="w-4 h-4 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* 服務卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default HealthDashboard;
